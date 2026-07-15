-- Plano de treino semanal (redesign da aba Rotinas em Metas)
-- 1 registro por usuário. Define a divisão (split) e o mapeamento dia da semana → treino.
-- Rodar no Supabase (SQL Editor) antes de usar a feature.

create table if not exists public.user_training_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  split text not null check (split in ('full_body','ab','abc','abcd','abcde')),
  days_per_week smallint not null,
  preferred_period text check (preferred_period in ('morning','afternoon','evening')),
  scheduled_days jsonb not null default '[]'::jsonb, -- [{ "weekday": 0-6, "letter": "A", "routine_id": <bigint|null> }]
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.user_training_plans enable row level security;

drop policy if exists "user_can_manage_own_training_plan" on public.user_training_plans;
create policy "user_can_manage_own_training_plan"
  on public.user_training_plans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
