-- ============================================================================
-- Migration: 20260715 — LinKa Premium (Fase 1: status de assinatura + gates)
--
-- OBJETIVO: introduzir o plano premium. Nesta fase NÃO há cobrança — o status
-- é ativado manualmente via SQL (ver bloco "Como ativar" no fim). A estrutura
-- já nasce pronta para a Fase 2 (RevenueCat/StoreKit): o webhook do RevenueCat
-- escreverá nesta mesma tabela via service role, sem migração destrutiva.
--
-- DECISÕES:
--   * Tabela separada `subscriptions` (e não colunas em `profiles`): profiles
--     tem policy de UPDATE pelo próprio usuário — status premium ali permitiria
--     auto-upgrade. Aqui NÃO existe policy de escrita para `authenticated`:
--     só o service role (que bypassa RLS) escreve.
--   * Função `is_premium(uid)` SECURITY DEFINER: usada pelo app via RPC agora,
--     e reutilizável em policies de RLS (WITH CHECK) na Fase 2.
--   * `badges.premium`: insígnias exclusivas de assinante. Desbloqueiam por
--     status (required_checkins = 0), o gate fica na SELEÇÃO (app).
--
-- Rodar no SQL Editor do Supabase.
-- ============================================================================

-- ─── 1. Tabela de assinaturas ───────────────────────────────────────────────
--
-- Uma linha por usuário. Campos rc_* / environment ficam NULL na Fase 1 e
-- serão preenchidos pelo webhook do RevenueCat na Fase 2.

create table if not exists public.subscriptions (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  status             text not null default 'inactive',  -- 'active' | 'inactive' | 'expired' | 'cancelled'
  product_id         text,          -- 'manual' (Fase 1) | product id do RevenueCat (Fase 2)
  store              text,          -- 'manual' | 'app_store'
  rc_app_user_id     text,          -- app_user_id do RevenueCat (Fase 2)
  environment        text,          -- 'production' | 'sandbox'
  current_period_end timestamptz,   -- NULL = sem expiração (ativação manual)
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- Leitura: só a própria linha. Escrita: NENHUMA policy — apenas service role.
drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions
  for select to authenticated
  using (auth.uid() = user_id);

-- ─── 2. Helper is_premium(uid) ──────────────────────────────────────────────
--
-- SECURITY DEFINER para poder ser usada em RLS de outras tabelas na Fase 2
-- (a policy avalia a função com privilégio do dono, sem expor a tabela).

create or replace function public.is_premium(uid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = uid
      and s.status = 'active'
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;

grant execute on function public.is_premium(uuid) to authenticated;

-- ─── 3. Insígnias premium ───────────────────────────────────────────────────

alter table public.badges
  add column if not exists premium boolean not null default false;

-- Seed: desbloqueadas "por conquista zero" (required_checkins = 0) para que
-- isBadgeUnlocked() do app as considere disponíveis; quem trava a seleção
-- para não-assinantes é o app (e setSelectedBadgeDb).
insert into public.badges
  (key, name, emoji, description, required_checkins, sort_order, condition_type, premium)
values
  ('premium_coroa',    'Membro Premium', '👑', 'Exclusiva para assinantes LinKa Premium.', 0, 200, 'checkin_total', true),
  ('premium_diamante', 'Diamante',       '💎', 'Brilhe no feed — exclusiva do Premium.',   0, 201, 'checkin_total', true)
on conflict (key) do nothing;

-- ─── Como ativar/desativar premium manualmente (Fase 1) ─────────────────────
--
-- Ativar:
--   insert into public.subscriptions (user_id, status, product_id, store)
--   values ('<uid do auth.users>', 'active', 'manual', 'manual')
--   on conflict (user_id) do update
--     set status = 'active', current_period_end = null, updated_at = now();
--
-- Desativar:
--   update public.subscriptions set status = 'inactive', updated_at = now()
--   where user_id = '<uid>';
