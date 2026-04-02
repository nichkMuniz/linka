-- Migration: mood_logs
-- Registra o humor diário do usuário após completar rotinas de dieta ou hábitos.

create table if not exists public.mood_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  mood       text not null check (mood in ('muito_triste', 'triste', 'neutro', 'feliz', 'muito_feliz')),
  log_date   date not null default current_date,
  created_at timestamptz not null default now(),

  -- Apenas um registro de humor por usuário por dia
  unique (user_id, log_date)
);

-- RLS
alter table public.mood_logs enable row level security;

create policy "Usuário lê seu próprio humor"
  on public.mood_logs for select
  using (auth.uid() = user_id);

create policy "Usuário insere/atualiza seu humor"
  on public.mood_logs for insert
  with check (auth.uid() = user_id);

create policy "Usuário atualiza seu humor"
  on public.mood_logs for update
  using (auth.uid() = user_id);

-- Índice para consultas por usuário + data
create index if not exists mood_logs_user_date_idx on public.mood_logs (user_id, log_date desc);