-- ============================================================================
-- Migration: 20260803 — Limites do plano grátis no SERVIDOR (RLS)
--
-- ⚠️ RODAR SEPARADAMENTE, e só DEPOIS de validar o fluxo de compra em sandbox.
-- Esta migração é a única do pacote Premium que pode QUEBRAR uma criação
-- existente se a contagem divergir do que o app espera. As instruções de
-- reversão estão no fim do arquivo — é um DROP POLICY, reversível em segundos.
--
-- POR QUE AGORA
-- A Decisão D3 (`docs/17-premium.md`) aceitou enforcement só no cliente com a
-- justificativa explícita de que "não há dinheiro envolvido". Com cobrança
-- real essa premissa caiu: sem RLS, alguém com a anon key cria rotinas e
-- duelos ilimitados sem pagar, e o gate vira decoração.
--
-- OS DOIS LIMITES (espelham `docs/17-premium.md` → "Mapa de gates"):
--   * rotinas ativas .... 1 no grátis (a 2ª abre o paywall)
--   * duelos criados .... 1 ativo no grátis (participar é sempre livre)
--
-- Só o INSERT é limitado. UPDATE/DELETE ficam livres — quem já passou do limite
-- (ex.: assinante que cancelou, ou o quiz "Sugerido pelo app", que cria N
-- rotinas de uma vez) precisa continuar editando e apagando o que tem.
-- ============================================================================

-- ─── 1. Rotinas ─────────────────────────────────────────────────────────────

alter table public.routines enable row level security;

-- Helper: quantas rotinas o usuário já tem. SECURITY DEFINER para contar sem
-- recursar na própria RLS da tabela (a policy que estamos criando consultaria
-- routines de novo, e o Postgres aborta com recursão infinita).
create or replace function public.count_own_routines(uid uuid)
returns integer
language sql stable security definer
set search_path = public
as $$
  select count(*)::int from public.routines r where r.user_id = uid;
$$;

grant execute on function public.count_own_routines(uuid) to authenticated;

drop policy if exists routines_insert_within_plan on public.routines;
create policy routines_insert_within_plan
  on public.routines
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (
      public.is_premium(auth.uid())
      or public.count_own_routines(auth.uid()) < 1
    )
  );

-- ─── 2. Duelos criados ──────────────────────────────────────────────────────

alter table public.duel_groups enable row level security;

-- "Ativo" = sem data de encerramento OU com encerramento no futuro. É a MESMA
-- regra do cliente (`activeCreatedDuels` em `Community.tsx`); divergir aqui
-- faria o app oferecer a criação e o banco recusar.
create or replace function public.count_own_active_duels(uid uuid)
returns integer
language sql stable security definer
set search_path = public
as $$
  select count(*)::int
    from public.duel_groups g
   where g.created_by = uid
     and (g.end_date is null or g.end_date > now());
$$;

grant execute on function public.count_own_active_duels(uuid) to authenticated;

drop policy if exists duel_groups_insert_within_plan on public.duel_groups;
create policy duel_groups_insert_within_plan
  on public.duel_groups
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and (
      public.is_premium(auth.uid())
      or public.count_own_active_duels(auth.uid()) < 1
    )
  );

-- ============================================================================
-- VERIFICAÇÃO
--
--   -- Com uma conta grátis que já tem 1 rotina, isto deve FALHAR:
--   insert into public.routines (user_id, type, name)
--   values (auth.uid(), 1, 'teste');
--   -- → "new row violates row-level security policy"
--
--   -- Conferir que as policies de SELECT/UPDATE/DELETE continuam de pé:
--   select policyname, cmd from pg_policies
--    where tablename in ('routines','duel_groups') order by tablename, cmd;
--
-- REVERSÃO (se algo quebrar em produção)
--
--   drop policy if exists routines_insert_within_plan on public.routines;
--   drop policy if exists duel_groups_insert_within_plan on public.duel_groups;
--
--   -- ATENÇÃO: se estas tabelas não tinham RLS ligada antes desta migração,
--   -- remover só as policies deixaria a tabela SEM NENHUMA policy de INSERT,
--   -- o que bloqueia toda escrita. Neste caso recrie a policy permissiva:
--   --   create policy routines_insert_own on public.routines
--   --     for insert to authenticated with check (user_id = auth.uid());
--   --   create policy duel_groups_insert_own on public.duel_groups
--   --     for insert to authenticated with check (created_by = auth.uid());
--
-- ANTES DE RODAR, confira o que já existe:
--   select tablename, policyname, cmd from pg_policies
--    where tablename in ('routines','duel_groups');
-- ============================================================================
