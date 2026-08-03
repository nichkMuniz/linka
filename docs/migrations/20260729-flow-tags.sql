-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-07-29 — Marcação de pessoas em Flows (estilo Instagram)
--
-- Espelha post_tags (docs/migrations/20260710-post-tags.sql), mas para a tabela
-- `flow` (id = bigint). Além da marcação + notificação (type 16 = "marcou você em
-- um flow"), adiciona colunas em `flow` para atribuir o repost ("↻ de @fulano").
--
-- Rodar no Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Atribuição de repost em `flow` ──────────────────────────────────────────
-- Quando um usuário marcado reposta o flow, o novo flow guarda de quem veio.
alter table public.flow
  add column if not exists reposted_from        bigint references public.flow(id) on delete set null,
  add column if not exists reposted_from_user   uuid   references auth.users(id) on delete set null;

-- ── flow_tags: quem foi marcado em cada flow ────────────────────────────────
create table if not exists public.flow_tags (
  id         uuid primary key default gen_random_uuid(),
  flow_id    bigint not null references public.flow(id) on delete cascade,
  user_id    uuid   not null references auth.users(id) on delete cascade, -- pessoa marcada
  created_at timestamptz not null default now(),
  unique (flow_id, user_id)
);

alter table public.flow_tags enable row level security;

-- Leitura pública (as marcações aparecem para qualquer usuário que vê o flow)
drop policy if exists "flow_tags_select" on public.flow_tags;
create policy "flow_tags_select" on public.flow_tags
  for select using (true);

-- Só o dono do flow pode marcar pessoas
drop policy if exists "flow_tags_insert" on public.flow_tags;
create policy "flow_tags_insert" on public.flow_tags
  for insert with check (
    exists (
      select 1 from public.flow f
      where f.id = flow_id and f.user_id = auth.uid()
    )
  );

-- O dono do flow pode remover marcações; a pessoa marcada pode se desmarcar
drop policy if exists "flow_tags_delete" on public.flow_tags;
create policy "flow_tags_delete" on public.flow_tags
  for delete using (
    auth.uid() = user_id
    or exists (
      select 1 from public.flow f
      where f.id = flow_id and f.user_id = auth.uid()
    )
  );

create index if not exists flow_tags_flow_id_idx on public.flow_tags(flow_id);
create index if not exists flow_tags_user_id_idx on public.flow_tags(user_id);

-- ── Notificação type 16: "fulano marcou você em um flow" ────────────────────
-- AFTER INSERT em flow_tags → insere em notifications; o push é automático via
-- o trigger de push já existente em notifications.
create or replace function public.notify_flow_tag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  flow_owner uuid;
begin
  select user_id into flow_owner from public.flow where id = new.flow_id;
  if flow_owner is not null and flow_owner <> new.user_id then
    insert into public.notifications (user_id, follower_id, type, flow_id, read, created_at)
    values (new.user_id, flow_owner, 16, new.flow_id, false, now());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_flow_tag on public.flow_tags;
create trigger trg_notify_flow_tag
  after insert on public.flow_tags
  for each row execute function public.notify_flow_tag();
