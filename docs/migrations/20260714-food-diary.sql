-- ============================================================================
-- Migration: 20260714 — Diário Alimentar
--
-- A rotina de Dieta era só um checklist (marca/desmarca itens do dia), sem
-- registro do que foi de fato comido nem contagem de calorias. Esta migração
-- cria a base do diário alimentar:
--   1. diets: colunas de macros (o app já as consulta em getUserDietsDb /
--      getDietsDb com fallback — esta migração garante que existam).
--   2. user_food_logs: uma linha por alimento registrado num dia/refeição,
--      com calorias e macros denormalizados (o valor da época do registro).
--   3. user_nutrition_goals: meta diária de calorias/macros do usuário.
--
-- Rodar no SQL Editor do Supabase.
-- ============================================================================

-- ─── 1. diets: macros no catálogo ───────────────────────────────────────────

alter table public.diets add column if not exists protein_g real;
alter table public.diets add column if not exists carbs_g real;
alter table public.diets add column if not exists fat_g real;
alter table public.diets add column if not exists fiber_g real;
-- Classificação NOVA simplificada: 'in_natura' | 'processado' | 'ultraprocessado'
alter table public.diets add column if not exists food_quality text;

-- ─── 2. user_food_logs: o diário ────────────────────────────────────────────
--
-- meal_type: 0 = café da manhã, 1 = almoço, 2 = lanche, 3 = jantar.
-- Calorias/macros são POR PORÇÃO já multiplicados pela quantidade (o app grava
-- o total consumido), então somar a coluna dá o total do dia direto.
-- diet_id/user_diet_id são opcionais: entradas manuais ("comi um pastel,
-- ~300 kcal") não referenciam o catálogo. user_diet_id marca as entradas
-- criadas automaticamente ao concluir um item da rotina de dieta — desmarcar o
-- item remove a entrada do dia via esse vínculo.

create table if not exists public.user_food_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  meal_type smallint not null default 0,
  diet_id bigint references public.diets(id) on delete set null,
  user_diet_id bigint references public.user_diets(id) on delete set null,
  name text not null,
  quantity real not null default 1,
  calories real,
  protein_g real,
  carbs_g real,
  fat_g real,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_food_logs_user_date
  on public.user_food_logs (user_id, log_date);

alter table public.user_food_logs enable row level security;

drop policy if exists "food_logs_select_own" on public.user_food_logs;
create policy "food_logs_select_own"
  on public.user_food_logs for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "food_logs_insert_own" on public.user_food_logs;
create policy "food_logs_insert_own"
  on public.user_food_logs for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "food_logs_update_own" on public.user_food_logs;
create policy "food_logs_update_own"
  on public.user_food_logs for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "food_logs_delete_own" on public.user_food_logs;
create policy "food_logs_delete_own"
  on public.user_food_logs for delete
  to authenticated
  using (auth.uid() = user_id);

-- ─── 3. user_nutrition_goals: meta diária ───────────────────────────────────

create table if not exists public.user_nutrition_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  calories_target real,
  protein_target_g real,
  carbs_target_g real,
  fat_target_g real,
  updated_at timestamptz not null default now()
);

alter table public.user_nutrition_goals enable row level security;

drop policy if exists "nutrition_goals_select_own" on public.user_nutrition_goals;
create policy "nutrition_goals_select_own"
  on public.user_nutrition_goals for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "nutrition_goals_upsert_own" on public.user_nutrition_goals;
create policy "nutrition_goals_upsert_own"
  on public.user_nutrition_goals for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "nutrition_goals_update_own" on public.user_nutrition_goals;
create policy "nutrition_goals_update_own"
  on public.user_nutrition_goals for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "nutrition_goals_delete_own" on public.user_nutrition_goals;
create policy "nutrition_goals_delete_own"
  on public.user_nutrition_goals for delete
  to authenticated
  using (auth.uid() = user_id);
