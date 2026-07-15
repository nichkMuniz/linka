-- Peso corporal com histórico/tendência (Tela de Metas) — 2026-07-13
-- Um registro por usuário por dia (upsert). Alimenta o gráfico de tendência de peso.

create table if not exists public.user_weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weight numeric(6,2) not null check (weight > 0 and weight < 1000),
  logged_at date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, logged_at)
);

create index if not exists idx_user_weight_logs_user_date
  on public.user_weight_logs (user_id, logged_at);

alter table public.user_weight_logs enable row level security;

-- RLS: cada usuário só enxerga/gerencia os próprios registros.
drop policy if exists "weight_logs_select_own" on public.user_weight_logs;
create policy "weight_logs_select_own"
  on public.user_weight_logs for select
  using (auth.uid() = user_id);

drop policy if exists "weight_logs_insert_own" on public.user_weight_logs;
create policy "weight_logs_insert_own"
  on public.user_weight_logs for insert
  with check (auth.uid() = user_id);

drop policy if exists "weight_logs_update_own" on public.user_weight_logs;
create policy "weight_logs_update_own"
  on public.user_weight_logs for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "weight_logs_delete_own" on public.user_weight_logs;
create policy "weight_logs_delete_own"
  on public.user_weight_logs for delete
  using (auth.uid() = user_id);
