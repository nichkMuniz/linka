-- ============================================================
-- Workout System v2 — Remodelagem da estrutura de treinos
-- ============================================================
-- Separa corretamente: catálogo (workouts) → plano (user_training_plans)
--   → dias (training_plan_days, A/B/C…) → exercícios do dia (training_day_exercises)
--   → execução (user_workouts_hist) → séries (workout_sets_hist).
--
-- BIG-BANG / GREENFIELD: substitui o modelo antigo de treino
--   (user_workouts + routines type=1 + user_training_plans com scheduled_days jsonb).
--   Dieta/Hábito (routines type 2/3, user_diets, user_habits) NÃO são tocados.
--
-- Rodar no Supabase (SQL Editor) de uma vez. Idempotente o suficiente p/ reexecução.
-- ============================================================

-- ── 1. Remover o modelo antigo de treino ──────────────────────
-- Drops explícitos em ordem inversa de FK para garantir idempotência.
drop table if exists public.workout_sets_hist cascade;
drop table if exists public.user_workouts_hist cascade;
drop table if exists public.training_day_exercises cascade;
drop table if exists public.training_plan_days cascade;
drop table if exists public.user_workouts cascade;
drop table if exists public.user_training_plans cascade;

-- Rotinas de TREINO (type=1) deixam de existir. Dieta(2)/Hábito(3) permanecem.
delete from public.routines where type = 1;

-- ── 2. user_training_plans (vários planos por usuário) ────────
create table public.user_training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  split text not null check (split in ('full_body','ab','abc','abcd','abcde','ppl','upper_lower')),
  days_per_week smallint not null,
  preferred_period text check (preferred_period in ('morning','afternoon','evening')),
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Garante no máximo 1 plano ativo por usuário.
create unique index user_training_plans_one_active_idx
  on public.user_training_plans (user_id) where is_active;
create index user_training_plans_user_idx on public.user_training_plans (user_id);

alter table public.user_training_plans enable row level security;
create policy "training_plans_manage_own"
  on public.user_training_plans for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 3. training_plan_days (os dias A/B/C… do plano) ───────────
create table public.training_plan_days (
  id uuid primary key default gen_random_uuid(),
  training_plan_id uuid not null references public.user_training_plans(id) on delete cascade,
  day_code text not null,                 -- 'A'..'E' ou 'PUSH'/'PULL'/'LEGS'/'UPPER'/'LOWER'/'FULL'
  name text,                              -- "Peito e Tríceps"
  position smallint not null default 0,
  weekday smallint check (weekday between 0 and 6), -- 0=Dom..6=Sáb (nullable = sem agenda)
  muscle_focus text,                      -- reaproveita o foco de suggested_routines
  scheduled_time text,                    -- lembrete diário do treino (HH:MM)
  created_at timestamptz default now()
);

create index training_plan_days_plan_idx on public.training_plan_days (training_plan_id);

alter table public.training_plan_days enable row level security;
create policy "training_plan_days_manage_own"
  on public.training_plan_days for all
  using (exists (
    select 1 from public.user_training_plans p
    where p.id = training_plan_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.user_training_plans p
    where p.id = training_plan_id and p.user_id = auth.uid()
  ));

-- ── 4. training_day_exercises (exercícios de cada dia) ────────
create table public.training_day_exercises (
  id uuid primary key default gen_random_uuid(),
  training_plan_day_id uuid not null references public.training_plan_days(id) on delete cascade,
  workout_id uuid not null references public.workouts(id),
  position smallint not null default 0,
  sets smallint,
  reps text,                              -- '8-12'
  rest_seconds int,
  notes text,
  created_at timestamptz default now()
);

create index training_day_exercises_day_idx on public.training_day_exercises (training_plan_day_id);

alter table public.training_day_exercises enable row level security;
create policy "training_day_exercises_manage_own"
  on public.training_day_exercises for all
  using (exists (
    select 1 from public.training_plan_days d
    join public.user_training_plans p on p.id = d.training_plan_id
    where d.id = training_plan_day_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.training_plan_days d
    join public.user_training_plans p on p.id = d.training_plan_id
    where d.id = training_plan_day_id and p.user_id = auth.uid()
  ));

-- ── 5. user_workouts_hist (execução de exercício) ─────────────
create table public.user_workouts_hist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  training_day_exercise_id uuid references public.training_day_exercises(id) on delete set null,
  training_plan_day_id uuid references public.training_plan_days(id) on delete set null,
  workout_id uuid not null references public.workouts(id),
  kilos numeric,
  volume varchar,
  calories numeric,
  km float8,
  "time" varchar,
  date_completed timestamp default now(),
  created_at timestamp default now()
);

create index user_workouts_hist_user_idx on public.user_workouts_hist (user_id);
create index user_workouts_hist_workout_idx on public.user_workouts_hist (user_id, workout_id);
create index user_workouts_hist_day_idx on public.user_workouts_hist (training_plan_day_id);

alter table public.user_workouts_hist enable row level security;
create policy "user_workouts_hist_manage_own"
  on public.user_workouts_hist for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 6. workout_sets_hist (série a série) ──────────────────────
create table public.workout_sets_hist (
  id uuid primary key default gen_random_uuid(),
  user_workout_hist_id uuid not null references public.user_workouts_hist(id) on delete cascade,
  set_number smallint not null,
  weight numeric,
  reps smallint,
  created_at timestamptz default now()
);

create index workout_sets_hist_parent_idx on public.workout_sets_hist (user_workout_hist_id);

alter table public.workout_sets_hist enable row level security;
create policy "workout_sets_hist_manage_own"
  on public.workout_sets_hist for all
  using (exists (
    select 1 from public.user_workouts_hist h
    where h.id = user_workout_hist_id and h.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.user_workouts_hist h
    where h.id = user_workout_hist_id and h.user_id = auth.uid()
  ));
