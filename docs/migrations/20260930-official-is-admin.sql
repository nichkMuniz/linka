-- ═══════════════════════════════════════════════════════════════════════════
-- 20260930 — Selo "oficial" dá acesso de admin
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Regra de produto (2026-09-30): toda conta com o selo OFICIAL
-- (profiles.verified_tier = 'official', roseta dourada) é admin, com painel
-- /admin e ações liberados. O selo VERIFICADO ('notable', azul) NÃO dá acesso.
--
-- Antes: o botão "Admin" do perfil já aparecia para 'official', mas a rota
-- só aceitava a lista fixa ADMIN_USER_IDS do app (a pessoa caía no feed) e as
-- RPCs do painel só aceitavam quem estava em `app_admins` (NOT_ADMIN).
--
-- Segurança: `verified_tier` só muda por service_role ou por admin — o
-- trigger `freeze_verified_tier` (20260928) desfaz qualquer UPDATE vindo da
-- própria pessoa. Então ninguém se promove a admin sozinho; só um admin pode
-- dar o selo oficial a outra conta (pela RPC admin_set_verified_tier).
--
-- `app_admins` continua valendo (donos que não têm o selo seguem admins).
-- Todas as RPCs do painel e os triggers de trava usam esta função, então a
-- regra nova vale para todas de uma vez — nenhuma outra precisa mudar.
--
-- Pode rodar a qualquer momento: não quebra build nenhum.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.is_app_admin(uid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select uid is not null and (
    exists (select 1 from public.app_admins a where a.user_id = uid)
    or exists (
      select 1 from public.profiles p
       where p.user_id = uid
         and p.verified_tier = 'official'
    )
  );
$$;

grant execute on function public.is_app_admin(uuid) to authenticated;

-- ─── Verificação rápida (opcional) ──────────────────────────────────────────
--
--   -- Quem é admin agora (lista + selo oficial):
--   select p.user_id, p.nickname, p.verified_tier, public.is_app_admin(p.user_id) as admin
--     from public.profiles p
--    where p.verified_tier is not null
--       or exists (select 1 from public.app_admins a where a.user_id = p.user_id);
--
--   'notable' deve sair com admin = false (a menos que esteja em app_admins).
