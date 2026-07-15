-- ============================================================================
-- Migration: 20260713 — Endurecimento de segurança (RLS + privacidade + DM)
--
-- Corrige as falhas encontradas na auditoria de 2026-07-13:
--   1. profiles: policy de UPDATE com USING (true) permitia que qualquer
--      usuário autenticado editasse o perfil de qualquer outro.
--   2. is_verified: proteção movida para trigger (a subquery da policy antiga
--      sombreava a tabela e não protegia nada).
--   3. posts / following: as opções de privacidade do perfil eram aplicadas
--      só no cliente — agora são RLS de verdade.
--   4. messages: RLS explícita (só remetente e destinatário leem a conversa).
--   5. chat-media: bucket privado para imagens/áudios de DM (antes iam para o
--      bucket público `posts`, com URL pública permanente).
--   6. get_profile_counts(): contadores continuam corretos mesmo quando as
--      listas ficam invisíveis por RLS.
--
-- Rodar no SQL Editor do Supabase.
-- ============================================================================

-- ─── 1. Helpers (SECURITY DEFINER para não recursar em RLS) ─────────────────

-- Perfil `target` esconde os posts de quem não segue?
create or replace function public.profile_hides_posts(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.hide_posts_from_non_followers from public.profiles p where p.user_id = target limit 1),
    false
  );
$$;

-- Perfil `target` esconde as listas de seguidores/seguindo?
create or replace function public.profile_hides_follow_lists(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.hide_follow_lists from public.profiles p where p.user_id = target limit 1),
    false
  );
$$;

-- O usuário logado segue `target`?
create or replace function public.viewer_follows(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.following f
    where f.user_id = auth.uid() and f.following_id = target
  );
$$;

grant execute on function public.profile_hides_posts(uuid) to authenticated, anon;
grant execute on function public.profile_hides_follow_lists(uuid) to authenticated, anon;
grant execute on function public.viewer_follows(uuid) to authenticated, anon;

-- ─── 2. profiles: UPDATE só do próprio dono; is_verified só via service_role ─

-- A policy antiga (`only_service_role_can_set_verified`) era FOR UPDATE
-- USING (true): como as policies são permissivas e combinadas com OR, ela
-- liberava UPDATE em qualquer linha da tabela para qualquer autenticado.
drop policy if exists "only_service_role_can_set_verified" on public.profiles;

alter table public.profiles enable row level security;

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- is_verified não pode ser alterado por quem não é service_role.
create or replace function public.freeze_is_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_verified is distinct from old.is_verified
     and coalesce(current_setting('request.jwt.claims', true)::json ->> 'role', '') <> 'service_role'
     and auth.role() <> 'service_role'
  then
    new.is_verified := old.is_verified;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_freeze_is_verified on public.profiles;
create trigger trg_freeze_is_verified
  before update on public.profiles
  for each row
  execute function public.freeze_is_verified();

-- ─── 3. posts: honra hide_posts_from_non_followers ──────────────────────────

alter table public.posts enable row level security;

-- Remove TODAS as policies de SELECT existentes em posts. Uma policy antiga do
-- tipo `using (true)` sobreviveria e, por ser permissiva (OR), anularia a nova.
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'posts' and cmd = 'SELECT'
  loop
    execute format('drop policy if exists %I on public.posts', pol.policyname);
  end loop;
end $$;

create policy "posts_select_respects_privacy"
  on public.posts
  for select
  using (
    user_id = auth.uid()
    or not public.profile_hides_posts(user_id)
    or public.viewer_follows(user_id)
  );

-- ─── 4. following: honra hide_follow_lists ──────────────────────────────────

alter table public.following enable row level security;

do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'following' and cmd = 'SELECT'
  loop
    execute format('drop policy if exists %I on public.following', pol.policyname);
  end loop;
end $$;

-- Um vínculo envolve dois perfis. Terceiros só enxergam a linha se NENHUM dos
-- dois lados escondeu suas listas. As duas pontas sempre enxergam o próprio
-- vínculo (necessário para o botão "Seguindo" e para o feed).
create policy "following_select_respects_privacy"
  on public.following
  for select
  using (
    user_id = auth.uid()
    or following_id = auth.uid()
    or (
      not public.profile_hides_follow_lists(user_id)
      and not public.profile_hides_follow_lists(following_id)
    )
  );

-- Escrita: só o próprio usuário cria/apaga os vínculos que ele origina.
drop policy if exists "following_insert_own" on public.following;
create policy "following_insert_own"
  on public.following
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "following_delete_own" on public.following;
create policy "following_delete_own"
  on public.following
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Mesmo tratamento na tabela simétrica `followers`.
alter table public.followers enable row level security;

do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'followers' and cmd = 'SELECT'
  loop
    execute format('drop policy if exists %I on public.followers', pol.policyname);
  end loop;
end $$;

create policy "followers_select_respects_privacy"
  on public.followers
  for select
  using (
    user_id = auth.uid()
    or follower_id = auth.uid()
    or (
      not public.profile_hides_follow_lists(user_id)
      and not public.profile_hides_follow_lists(follower_id)
    )
  );

drop policy if exists "followers_insert_own" on public.followers;
create policy "followers_insert_own"
  on public.followers
  for insert
  to authenticated
  with check (auth.uid() = follower_id);

drop policy if exists "followers_delete_own" on public.followers;
create policy "followers_delete_own"
  on public.followers
  for delete
  to authenticated
  using (auth.uid() = follower_id);

-- ─── 5. Contadores do perfil (posts/seguidores/seguindo) ────────────────────
--
-- Com a RLS acima, um `count` direto retornaria 0 para perfis privados. O app
-- continua mostrando os NÚMEROS (só as listas e os posts é que ficam ocultos),
-- então os contadores passam a vir desta função.
create or replace function public.get_profile_counts(target uuid)
returns table (posts_count bigint, followers_count bigint, following_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.posts p where p.user_id = target),
    (select count(*) from public.following f where f.following_id = target),
    (select count(*) from public.following f where f.user_id = target);
$$;

grant execute on function public.get_profile_counts(uuid) to authenticated, anon;

-- ─── 6. messages: só remetente e destinatário ───────────────────────────────

alter table public.messages enable row level security;

drop policy if exists "messages_select_participants" on public.messages;
create policy "messages_select_participants"
  on public.messages
  for select
  to authenticated
  using (auth.uid() = user_id or auth.uid() = following_id);

drop policy if exists "messages_insert_own" on public.messages;
create policy "messages_insert_own"
  on public.messages
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- UPDATE é usado para marcar como lida (destinatário) e para reagir com emoji
-- (qualquer um dos dois participantes).
drop policy if exists "messages_update_participants" on public.messages;
create policy "messages_update_participants"
  on public.messages
  for update
  to authenticated
  using (auth.uid() = user_id or auth.uid() = following_id)
  with check (auth.uid() = user_id or auth.uid() = following_id);

drop policy if exists "messages_delete_own" on public.messages;
create policy "messages_delete_own"
  on public.messages
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ─── 7. notifications: só o destinatário lê ─────────────────────────────────

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Qualquer autenticado pode gerar notificação PARA outro (like, comentário,
-- follow...), mas só assinando como origem — não dá para forjar o `follower_id`.
drop policy if exists "notifications_insert_as_self" on public.notifications;
create policy "notifications_insert_as_self"
  on public.notifications
  for insert
  to authenticated
  with check (auth.uid() = follower_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own"
  on public.notifications
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ─── 8. Bucket privado para mídia de DM ─────────────────────────────────────
--
-- Antes: imagens e áudios de mensagem iam para o bucket PÚBLICO `posts`, com
-- URL permanente e caminho previsível (`message-images/{user_id}/{timestamp}`).
-- Agora: bucket privado `chat-media`, caminho `{idA}_{idB}/{uuid}.{ext}` (os
-- dois uuids ordenados), lido só pelos dois participantes via signed URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media',
  'chat-media',
  false,
  26214400, -- 25 MB
  array['image/jpeg','image/png','image/webp','image/heic','audio/mp4','audio/aac','audio/mpeg','audio/webm']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- O primeiro segmento do caminho é "{uuidA}_{uuidB}" (ordenados). O usuário só
-- lê/escreve se o próprio id for uma das duas pontas.
drop policy if exists "chat_media_select_participants" on storage.objects;
create policy "chat_media_select_participants"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'chat-media'
    and auth.uid()::text = any(string_to_array(split_part(name, '/', 1), '_'))
  );

drop policy if exists "chat_media_insert_participants" on storage.objects;
create policy "chat_media_insert_participants"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'chat-media'
    and auth.uid()::text = any(string_to_array(split_part(name, '/', 1), '_'))
  );

drop policy if exists "chat_media_delete_participants" on storage.objects;
create policy "chat_media_delete_participants"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'chat-media'
    and auth.uid()::text = any(string_to_array(split_part(name, '/', 1), '_'))
  );
