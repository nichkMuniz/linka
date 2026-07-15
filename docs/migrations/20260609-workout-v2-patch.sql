-- ============================================================
-- Patch v2 — recria training_plan_days e training_day_exercises
-- com schema correto (caso a migration principal tenha ficado
-- incompleta e as tabelas existam com schema antigo/incompleto).
--
-- Seguro para reexecutar. Dropa as tabelas filhas e as recria.
-- user_training_plans NÃO é tocada (mantém dados já inseridos).
-- ============================================================

-- Remove dependentes primeiro (ordem inversa da FK)
drop table if exists public.workout_sets_hist cascade;
drop table if exists public.user_workouts_hist cascade;
drop table if exists public.training_day_exercises cascade;
drop table if exists public.training_plan_days cascade;

-- ── training_plan_days ────────────────────────────────────────
create table public.training_plan_days (
  id uuid primary key default gen_random_uuid(),
  training_plan_id uuid not null references public.user_training_plans(id) on delete cascade,
  day_code text not null,
  name text,
  position smallint not null default 0,
  weekday smallint check (weekday between 0 and 6),
  muscle_focus text,
  scheduled_time text,
  created_at timestamptz default now()
);

create index training_plan_days_plan_idx on public.training_plan_days (training_plan_id);

alter table public.training_plan_days enable row level security;

drop policy if exists "training_plan_days_manage_own" on public.training_plan_days;
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

-- ── training_day_exercises ────────────────────────────────────
create table public.training_day_exercises (
  id uuid primary key default gen_random_uuid(),
  training_plan_day_id uuid not null references public.training_plan_days(id) on delete cascade,
  workout_id uuid not null references public.workouts(id),
  position smallint not null default 0,
  sets smallint,
  reps text,
  rest_seconds int,
  notes text,
  created_at timestamptz default now()
);

create index training_day_exercises_day_idx on public.training_day_exercises (training_plan_day_id);
create index training_day_exercises_workout_idx on public.training_day_exercises (workout_id);

alter table public.training_day_exercises enable row level security;

drop policy if exists "training_day_exercises_manage_own" on public.training_day_exercises;
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

-- ── user_workouts_hist ────────────────────────────────────────
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
  time varchar,
  date_completed timestamp with time zone default now(),
  created_at timestamptz default now()
);

create index user_workouts_hist_user_idx on public.user_workouts_hist (user_id);
create index user_workouts_hist_day_idx on public.user_workouts_hist (training_plan_day_id);
create index user_workouts_hist_exercise_idx on public.user_workouts_hist (training_day_exercise_id);

alter table public.user_workouts_hist enable row level security;

drop policy if exists "user_workouts_hist_manage_own" on public.user_workouts_hist;
create policy "user_workouts_hist_manage_own"
  on public.user_workouts_hist for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── workout_sets_hist ─────────────────────────────────────────
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

drop policy if exists "workout_sets_hist_manage_own" on public.workout_sets_hist;
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
