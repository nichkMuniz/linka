-- ============================================================================
-- Migration: 20260714 — Dono dos itens criados manualmente
--                       (diets / habits / workouts)
--
-- BUG: um alimento, hábito ou exercício criado manualmente no drawer de Metas
-- some se o usuário sai do drawer antes de concluir a rotina.
--
-- Causa: a linha ERA gravada em `diets`/`habits`/`workouts` com
-- `created_by_user = true`, mas o app só volta a exibir itens custom que estejam
-- vinculados ao usuário em `user_diets`/`user_habits`/`user_workouts`. O vínculo
-- só nasce quando a rotina é concluída — então, ao abandonar o drawer, o item
-- ficava órfão: existia no banco e era invisível para todo mundo, inclusive para
-- quem o criou.
--
-- Correção: guardar QUEM criou o item (`created_by`), e não inferir a autoria a
-- partir do vínculo com a rotina. Com isso o app filtra por dono e o item
-- persiste mesmo sem rotina.
--
-- Rodar no SQL Editor do Supabase.
-- ============================================================================

-- ─── 1. Colunas ─────────────────────────────────────────────────────────────
--
-- `created_by_user` já existe em produção (o app grava nela), mas nunca foi
-- versionada aqui — o `if not exists` deixa a migração idempotente.
-- `created_by` = dono do item custom. NULL = item de catálogo (sistema).

alter table public.diets
  add column if not exists created_by_user boolean not null default false,
  add column if not exists created_by uuid references auth.users(id) on delete cascade;

alter table public.habits
  add column if not exists created_by_user boolean not null default false,
  add column if not exists created_by uuid references auth.users(id) on delete cascade;

alter table public.workouts
  add column if not exists created_by_user boolean not null default false,
  add column if not exists created_by uuid references auth.users(id) on delete cascade;

create index if not exists idx_diets_created_by
  on public.diets (created_by) where created_by is not null;

create index if not exists idx_habits_created_by
  on public.habits (created_by) where created_by is not null;

create index if not exists idx_workouts_created_by
  on public.workouts (created_by) where created_by is not null;

-- ─── 2. Backfill dos itens custom que já existem ────────────────────────────
--
-- Para os itens antigos a única pista de autoria é o vínculo com a rotina. Quem
-- vinculou primeiro é tratado como dono. Itens órfãos (criados e abandonados
-- antes desta migração) não têm pista nenhuma e continuam sem dono — seguem
-- invisíveis, mas inertes.

update public.diets d
set created_by = link.user_id
from (
  select distinct on (diet_id) diet_id, user_id
  from public.user_diets
  order by diet_id, created_at asc
) as link
where d.id = link.diet_id
  and d.created_by_user
  and d.created_by is null;

update public.habits h
set created_by = link.user_id
from (
  select distinct on (habit_id) habit_id, user_id
  from public.user_habits
  order by habit_id, created_at asc
) as link
where h.id = link.habit_id
  and h.created_by_user
  and h.created_by is null;

update public.workouts w
set created_by = link.user_id
from (
  select distinct on (workout_id) workout_id, user_id
  from public.user_workouts
  order by workout_id, created_at asc
) as link
where w.id = link.workout_id
  and w.created_by_user
  and w.created_by is null;

-- ─── 3. RLS ─────────────────────────────────────────────────────────────────
--
-- Os catálogos são de leitura pública (item custom de um usuário é filtrado no
-- app, não é segredo). O que precisa de trava é a ESCRITA: um usuário só pode
-- criar item marcado como seu, e só pode editar/apagar o que é dele — nunca uma
-- linha do catálogo do sistema.
--
-- Os seeds de catálogo (scripts/seed-*.mjs, migrate-exercise-images.mjs) usam a
-- service role key e passam por cima da RLS — continuam funcionando.

alter table public.diets    enable row level security;
alter table public.habits   enable row level security;
alter table public.workouts enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array['diets', 'habits', 'workouts'] loop
    execute format('drop policy if exists "%1$s_select_all" on public.%1$I', tbl);
    execute format($p$
      create policy "%1$s_select_all" on public.%1$I
        for select to authenticated, anon using (true)
    $p$, tbl);

    execute format('drop policy if exists "%1$s_insert_own_custom" on public.%1$I', tbl);
    execute format($p$
      create policy "%1$s_insert_own_custom" on public.%1$I
        for insert to authenticated
        with check (created_by_user and created_by = auth.uid())
    $p$, tbl);

    execute format('drop policy if exists "%1$s_update_own_custom" on public.%1$I', tbl);
    execute format($p$
      create policy "%1$s_update_own_custom" on public.%1$I
        for update to authenticated
        using (created_by_user and created_by = auth.uid())
        with check (created_by_user and created_by = auth.uid())
    $p$, tbl);

    execute format('drop policy if exists "%1$s_delete_own_custom" on public.%1$I', tbl);
    execute format($p$
      create policy "%1$s_delete_own_custom" on public.%1$I
        for delete to authenticated
        using (created_by_user and created_by = auth.uid())
    $p$, tbl);
  end loop;
end $$;
