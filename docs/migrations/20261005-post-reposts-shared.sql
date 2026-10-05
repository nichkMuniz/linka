-- ═══════════════════════════════════════════════════════════════════════════
-- 20261005 — Repost vira um post ÚNICO compartilhado (estilo Instagram)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ANTES (20260928-post-reposts.sql): repostar criava OUTRA linha em `posts`,
-- do usuário que repostou, com as mesmas fotos. Um post com 10 marcados virava
-- até 11 posts iguais, cada um com curtidas e comentários próprios.
--
-- AGORA: repostar grava só um vínculo em `post_reposts (post_id, user_id)`.
-- O post continua um só:
--   • aparece no perfil do autor E no de quem repostou;
--   • aparece no feed de quem segue o autor OU quem repostou (uma vez só);
--   • curtidas, comentários e marcações são do post original, para todo mundo.
--
-- Esta migração:
--   1. cria `post_reposts` (+ RLS, validação, notificação type 21);
--   2. converte os reposts antigos: vínculo novo + curtidas, comentários,
--      notificações e denúncias levados para o original; a linha duplicada sai;
--   3. mantém os builds antigos funcionando: um INSERT legado em `posts` com
--      `reposted_from` vira um vínculo e a linha duplicada NÃO é gravada;
--   4. passa a contar os reposts no total de posts do perfil.
--
-- As colunas `posts.reposted_from*` FICAM (os builds da loja ainda pedem elas
-- no select — o PostgREST derruba a query inteira se a coluna sumir).
--
-- ⚠ RODAR ANTES DE PUBLICAR O BUILD NOVO. Reexecutável. Supabase SQL Editor.
-- Pré-requisitos: 20260928-post-reposts.sql e 20261001-hide-banned-users.sql
-- (a seção 7 recria get_profile_counts com banned_user_ids()).
-- Push: o texto do type 21 não mudou — não precisa redeploy.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Tabela ──────────────────────────────────────────────────────────────

create table if not exists public.post_reposts (
  post_id         uuid not null references public.posts(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  -- Cópia de posts.created_at (gravada pelo trigger). O feed pagina por ela:
  -- o post entra no feed na data em que foi publicado, como no Instagram.
  post_created_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- Feed/perfil: "posts repostados por estas pessoas, mais recentes primeiro".
create index if not exists post_reposts_user_feed_idx
  on public.post_reposts (user_id, post_created_at desc);

alter table public.post_reposts enable row level security;

drop policy if exists "post_reposts_select" on public.post_reposts;
create policy "post_reposts_select"
  on public.post_reposts for select
  using (true);

-- Só repostar como si mesmo. As demais regras ficam no trigger abaixo.
drop policy if exists "post_reposts_insert_own" on public.post_reposts;
create policy "post_reposts_insert_own"
  on public.post_reposts for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- Quem repostou tira do próprio perfil; o autor do post também pode tirar.
drop policy if exists "post_reposts_delete" on public.post_reposts;
create policy "post_reposts_delete"
  on public.post_reposts for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.posts p
       where p.id = post_reposts.post_id
         and p.user_id = (select auth.uid())
    )
  );

-- Banido some daqui também (mesmo padrão de 20261001-hide-banned-users).
do $$
begin
  if exists (select 1 from pg_proc where proname = 'banned_user_ids')
     and exists (select 1 from pg_proc where proname = 'viewer_sees_banned') then
    execute 'drop policy if exists "post_reposts_hide_banned_user_id" on public.post_reposts';
    execute $p$
      create policy "post_reposts_hide_banned_user_id"
        on public.post_reposts
        as restrictive
        for select
        using (
          not (user_id::text = any ((select public.banned_user_ids())::text[]))
          or user_id = (select auth.uid())
          or (select public.viewer_sees_banned())
        )
    $p$;
  else
    raise notice 'post_reposts: banned_user_ids() não existe — policy de banido pulada';
  end if;
end $$;

-- ─── 2. Converter os reposts antigos ────────────────────────────────────────
-- ANTES dos triggers da seção 3: a conversão não deve notificar de novo nem
-- ser barrada pela validação. Repost cujo autor deixou de marcar a pessoa (ou
-- com bloqueio no meio) não vira vínculo — só some.

insert into public.post_reposts (post_id, user_id, post_created_at, created_at)
select r.reposted_from, r.user_id, o.created_at, r.created_at
  from public.posts r
  join public.posts o on o.id = r.reposted_from
 where r.reposted_from is not null
   and o.user_id <> r.user_id
   and exists (
     select 1 from public.post_tags t
      where t.post_id = r.reposted_from and t.user_id = r.user_id
   )
   and not exists (
     select 1 from public.user_blocks b
      where (b.blocker_id = o.user_id and b.blocked_id = r.user_id)
         or (b.blocker_id = r.user_id and b.blocked_id = o.user_id)
   )
on conflict (post_id, user_id) do nothing;

-- Curtidas: UPDATE (não INSERT) para não disparar notificação de curtida de
-- novo. Uma por (pessoa, tipo) no original — a repetida é apagada adiante.
with moved as (
  select l.id,
         r.reposted_from as original_id,
         row_number() over (
           partition by r.reposted_from, l.user_id, l.type
           order by l.created_at
         ) as rn
    from public.likes l
    join public.posts r on r.id = l.post_id
   where r.reposted_from is not null
)
update public.likes l
   set post_id = m.original_id
  from moved m
 where l.id = m.id
   and m.rn = 1
   and not exists (
     select 1 from public.likes x
      where x.post_id = m.original_id
        and x.user_id = l.user_id
        and x.type = l.type
   );

-- Comentários (respostas vão juntas: parent_id aponta para comentário, não post).
update public.comments c
   set post_id = r.reposted_from
  from public.posts r
 where c.post_id = r.id
   and r.reposted_from is not null;

-- Notificações (inclusive a type 21, que apontava para o repost).
update public.notifications n
   set post_id = r.reposted_from
  from public.posts r
 where n.post_id = r.id
   and r.reposted_from is not null;

update public.post_complaint pc
   set post_id = r.reposted_from
  from public.posts r
 where pc.post_id = r.id
   and r.reposted_from is not null;

-- Sobras (curtida repetida, marcação) e a linha duplicada. Os ARQUIVOS não são
-- tocados: são as mesmas URLs do original.
delete from public.likes
 where post_id in (select id from public.posts where reposted_from is not null);
delete from public.post_tags
 where post_id in (select id from public.posts where reposted_from is not null);
delete from public.posts
 where reposted_from is not null;

-- ─── 3. Regras do repost ────────────────────────────────────────────────────

create or replace function public.validate_post_reposts_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post public.posts%rowtype;
begin
  select * into v_post from public.posts where id = new.post_id;
  if not found then
    raise exception 'REPOST_ORIGINAL_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Linha legada (build antigo) que por algum motivo ainda exista.
  if v_post.reposted_from is not null then
    raise exception 'REPOST_OF_REPOST' using errcode = '22023';
  end if;

  if v_post.user_id = new.user_id then
    raise exception 'REPOST_OWN_POST' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.post_tags t
     where t.post_id = new.post_id and t.user_id = new.user_id
  ) then
    raise exception 'REPOST_NOT_TAGGED' using errcode = '42501';
  end if;

  -- Autor que só mostra posts para seguidores: o repost levaria o post para
  -- fora desse círculo.
  if public.profile_hides_posts(v_post.user_id) then
    raise exception 'REPOST_PRIVATE_AUTHOR' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.user_blocks b
     where (b.blocker_id = v_post.user_id and b.blocked_id = new.user_id)
        or (b.blocker_id = new.user_id and b.blocked_id = v_post.user_id)
  ) then
    raise exception 'REPOST_BLOCKED' using errcode = '42501';
  end if;

  new.post_created_at := v_post.created_at;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists trg_validate_post_reposts_row on public.post_reposts;
create trigger trg_validate_post_reposts_row
  before insert on public.post_reposts
  for each row execute function public.validate_post_reposts_row();

-- ─── 4. Notificação type 21 (autor do post) ─────────────────────────────────
-- `post_id` agora é o próprio post (não existe mais "o repost").

create or replace function public.notify_post_reposts_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
begin
  begin
    select user_id into v_author from public.posts where id = new.post_id;
    if v_author is null or v_author = new.user_id then
      return new;
    end if;
    insert into public.notifications (user_id, follower_id, type, post_id, read, created_at)
    values (v_author, new.user_id, 21, new.post_id, false, now());
  exception when others then
    -- Notificação nunca impede o repost de ser salvo.
    raise warning 'notify_post_reposts_row: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists trg_notify_post_reposts_row on public.post_reposts;
create trigger trg_notify_post_reposts_row
  after insert on public.post_reposts
  for each row execute function public.notify_post_reposts_row();

-- Desfazer o repost leva a notificação junto.
create or replace function public.cleanup_post_reposts_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.notifications
   where type = 21
     and post_id = old.post_id
     and follower_id = old.user_id;
  return old;
end;
$$;

drop trigger if exists trg_cleanup_post_reposts_row on public.post_reposts;
create trigger trg_cleanup_post_reposts_row
  after delete on public.post_reposts
  for each row execute function public.cleanup_post_reposts_row();

-- ─── 5. Desmarcar tira o repost ─────────────────────────────────────────────
-- O direito de repostar vem da marcação: o autor tirar a marcação (ou a pessoa
-- se desmarcar) tira o post do perfil dela.

create or replace function public.remove_repost_on_untag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.post_reposts
   where post_id = old.post_id
     and user_id = old.user_id;
  return old;
end;
$$;

drop trigger if exists trg_remove_repost_on_untag on public.post_tags;
create trigger trg_remove_repost_on_untag
  after delete on public.post_tags
  for each row execute function public.remove_repost_on_untag();

-- ─── 6. Builds antigos ──────────────────────────────────────────────────────
-- O build da loja ainda repostará com INSERT em `posts` (reposted_from + as
-- fotos). O trigger converte em vínculo e devolve NULL: a linha duplicada não
-- é gravada e o app antigo recebe sucesso (ele não pede a linha de volta).
-- Os erros de regra (REPOST_*) sobem do trigger de post_reposts, iguais aos
-- que o app antigo já traduz.

create or replace function public.validate_post_repost()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_original uuid;
begin
  if tg_op = 'UPDATE' then
    new.reposted_from := old.reposted_from;
    new.reposted_from_user := old.reposted_from_user;
    return new;
  end if;

  if new.reposted_from is null then
    new.reposted_from_user := null;
    return new;
  end if;

  -- Repost de repost aponta para a origem.
  select coalesce(p.reposted_from, p.id) into v_original
    from public.posts p where p.id = new.reposted_from;
  if v_original is null then
    raise exception 'REPOST_ORIGINAL_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.post_reposts (post_id, user_id)
  values (v_original, new.user_id)
  on conflict (post_id, user_id) do nothing;

  return null;
end;
$$;

drop trigger if exists trg_validate_post_repost on public.posts;
create trigger trg_validate_post_repost
  before insert or update on public.posts
  for each row execute function public.validate_post_repost();

-- O type 21 agora nasce em post_reposts; o trigger antigo em posts sai.
drop trigger if exists trg_notify_post_repost on public.posts;

-- ─── 7. Contagem de posts do perfil inclui os reposts ───────────────────────
-- O número tem que bater com a grade, que agora mostra os dois.

create or replace function public.get_profile_counts(target uuid)
returns table (posts_count bigint, followers_count bigint, following_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  with banned as (select public.banned_user_ids() as ids)
  select
    (select count(*) from public.posts p where p.user_id = target)
      + (select count(*) from public.post_reposts r where r.user_id = target),
    (select count(*) from public.following f, banned b
      where f.following_id = target and not (f.user_id = any (b.ids))),
    (select count(*) from public.following f, banned b
      where f.user_id = target and not (f.following_id = any (b.ids)));
$$;

grant execute on function public.get_profile_counts(uuid) to authenticated, anon;

-- ─── Conferência ────────────────────────────────────────────────────────────
--
--   select count(*) from public.posts where reposted_from is not null;  -- 0
--   select * from public.post_reposts order by created_at desc limit 20;
