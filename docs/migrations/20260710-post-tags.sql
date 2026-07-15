-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-07-10 — Marcação de pessoas em posts (estilo Instagram)
--
-- Nova tabela post_tags: quem foi marcado em cada post do feed.
-- + Trigger de notificação (type 9 = "marcou você em uma publicação"),
--   seguindo o mesmo padrão SECURITY DEFINER das demais notificações.
--
-- Rodar no Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.post_tags (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade, -- pessoa marcada
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

alter table public.post_tags enable row level security;

-- Leitura pública (as marcações aparecem no feed para qualquer usuário)
create policy "post_tags_select" on public.post_tags
  for select using (true);

-- Só o dono do post pode marcar pessoas
create policy "post_tags_insert" on public.post_tags
  for insert with check (
    exists (
      select 1 from public.posts p
      where p.id = post_id and p.user_id = auth.uid()
    )
  );

-- O dono do post pode remover marcações; a pessoa marcada pode se desmarcar
create policy "post_tags_delete" on public.post_tags
  for delete using (
    auth.uid() = user_id
    or exists (
      select 1 from public.posts p
      where p.id = post_id and p.user_id = auth.uid()
    )
  );

create index post_tags_post_id_idx on public.post_tags(post_id);
create index post_tags_user_id_idx on public.post_tags(user_id);

-- ── Notificação type 9: "fulano marcou você em uma publicação" ──────────────
-- AFTER INSERT em post_tags → insere em notifications; o push é automático
-- via trigger notify-push-on-notification já existente em notifications.
create or replace function public.notify_post_tag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_owner uuid;
begin
  select user_id into post_owner from public.posts where id = new.post_id;
  if post_owner is not null and post_owner <> new.user_id then
    insert into public.notifications (user_id, follower_id, type, post_id, read, created_at)
    values (new.user_id, post_owner, 9, new.post_id, false, now());
  end if;
  return new;
end;
$$;

create trigger trg_notify_post_tag
  after insert on public.post_tags
  for each row execute function public.notify_post_tag();
