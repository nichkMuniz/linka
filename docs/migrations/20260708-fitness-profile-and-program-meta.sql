-- ============================================================
-- Migration: quiz de personalização de treino (2026-07-08)
-- ============================================================
-- 1. routines.program_meta (jsonb) — metadados do programa gerado pelo quiz
--    "Sugerido pelo app": séries × reps sugeridas por exercício
--    ({ origin, exercises: [{ name, muscleGroup, series, reps }] }).
--    Programas gerados são únicos por usuário e não existem no catálogo
--    estático (suggested-routines-data.ts), então o pré-preenchimento das
--    séries na sessão de treino passa a ler daqui (fallback: catálogo estático
--    casado pelo nome, para rotinas antigas). NULL = rotina criada do zero.
--
-- 2. user_fitness_profile — respostas do quiz de personalização (1 linha por
--    usuário, upsert a cada programa criado). Usada para pré-preencher o quiz
--    na próxima criação e, no futuro, para personalizar outras sugestões.
--
-- Rodar no Supabase (SQL Editor). Idempotente.

ALTER TABLE routines
  ADD COLUMN IF NOT EXISTS program_meta jsonb;

create table if not exists public.user_fitness_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goal text not null check (goal in ('hypertrophy','fat_loss','strength','conditioning')),
  level text not null check (level in ('beginner','intermediate','advanced')),
  -- dias de treino escolhidos, índices Monday-first separados por vírgula ("0,2,4")
  training_days text not null default '',
  session_minutes smallint not null default 60,
  emphasis text not null check (emphasis in ('balanced','lower','upper')),
  location text not null check (location in ('gym','home')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.user_fitness_profile enable row level security;

drop policy if exists "fitness_profile_manage_own" on public.user_fitness_profile;
create policy "fitness_profile_manage_own"
  on public.user_fitness_profile for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
