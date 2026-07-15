-- ============================================================================
-- Migration: 20260714 — Água e açúcar no diário alimentar
--
-- As insígnias `nutrition_hydration` (hidratação) e `nutrition_no_sugar` (sem
-- açúcar) não podiam ser concedidas porque o app simplesmente NÃO REGISTRAVA
-- esses dados. Em vez de afrouxar o desbloqueio (o bug que acabamos de corrigir),
-- esta migração cria o dado que falta:
--   1. user_water_logs      → quanto o usuário bebeu por dia (ml).
--   2. user_nutrition_goals.water_target_ml → meta diária de água.
--   3. diets.sugar_g / user_food_logs.sugar_g → açúcar por porção / consumido.
--
-- Rodar no SQL Editor do Supabase.
-- ============================================================================

-- ─── 1. Açúcar: catálogo e diário ───────────────────────────────────────────
--
-- Mesmo padrão dos outros macros: `diets.sugar_g` é POR PORÇÃO e
-- `user_food_logs.sugar_g` já é o TOTAL consumido (porção × quantidade), então
-- somar a coluna dá o total do dia direto.

alter table public.diets           add column if not exists sugar_g real;
alter table public.user_food_logs  add column if not exists sugar_g real;

-- ─── 2. Meta diária de água ─────────────────────────────────────────────────

alter table public.user_nutrition_goals
  add column if not exists water_target_ml real;

-- ─── 3. user_water_logs: uma linha por dia ──────────────────────────────────
--
-- O app faz upsert do TOTAL do dia (não um registro por copo), então a PK
-- composta (user_id, log_date) já garante idempotência.

create table if not exists public.user_water_logs (
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  ml real not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, log_date)
);

create index if not exists idx_user_water_logs_user_date
  on public.user_water_logs (user_id, log_date);

alter table public.user_water_logs enable row level security;

drop policy if exists "water_logs_select_own" on public.user_water_logs;
create policy "water_logs_select_own"
  on public.user_water_logs for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "water_logs_insert_own" on public.user_water_logs;
create policy "water_logs_insert_own"
  on public.user_water_logs for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "water_logs_update_own" on public.user_water_logs;
create policy "water_logs_update_own"
  on public.user_water_logs for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "water_logs_delete_own" on public.user_water_logs;
create policy "water_logs_delete_own"
  on public.user_water_logs for delete
  to authenticated
  using (auth.uid() = user_id);

-- ─── 4. Limiar da insígnia "sem açúcar" ─────────────────────────────────────
--
-- 25 g/dia é o teto de açúcar livre recomendado pela OMS para um adulto. Fica em
-- condition_metadata para dar para ajustar sem mexer no app.
-- IMPORTANTE: um dia só conta para a insígnia se TODOS os alimentos tiverem
-- sugar_g conhecido. Enquanto o catálogo (diets.sugar_g) não estiver populado,
-- a insígnia continua (corretamente) inalcançável — sem o dado não há prova.

update public.badges
set condition_metadata = coalesce(condition_metadata, '{}'::jsonb) || '{"max_sugar_g": 25}'::jsonb
where condition_type = 'nutrition_no_sugar';

-- Meta de água padrão da insígnia quando o usuário não definiu a dele (2 L).
update public.badges
set condition_metadata = coalesce(condition_metadata, '{}'::jsonb) || '{"ml": 2000}'::jsonb
where condition_type = 'nutrition_hydration';
