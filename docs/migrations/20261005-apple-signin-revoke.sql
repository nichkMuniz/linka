-- ============================================================================
-- Migration: 20261005 — revogar o Sign in with Apple ao excluir a conta
--
-- A Apple exige (5.1.1(v)) que a exclusão de uma conta criada com Sign in with
-- Apple REVOGUE a autorização pela REST API (POST appleid.apple.com/auth/revoke).
-- Revogar pede um token da Apple, e o login nativo só entrega um
-- `authorizationCode` de uso único (5 min). A edge function `apple-auth` troca
-- esse code pelo refresh_token logo após o login e guarda aqui.
--
-- Quando revoga:
--   * ao PEDIR a exclusão (o app chama `apple-auth` com action "revoke") — é o
--     momento em que o revisor confere Ajustes → ID Apple → "Iniciar sessão
--     com a Apple" e espera o LinKa fora da lista;
--   * na exclusão definitiva (`purge-scheduled-deletions`), se sobrou token.
-- Reativar entrando de novo com a Apple gera um code novo, que é guardado de
-- novo (o `sub` da Apple é o mesmo, então é a mesma conta no Supabase).
--
-- Contas Apple criadas ANTES desta mudança não têm token guardado até
-- entrarem de novo com a Apple — para elas a revogação não acontece.
--
-- Sem policy: só a service role (edge functions) lê e grava. O refresh_token
-- é credencial — nunca exposto ao app.
--
-- ORDEM: rodar esta migração → secrets APPLE_SIGNIN_KEY_P8 / APPLE_SIGNIN_KEY_ID
-- → `supabase functions deploy apple-auth` (e redeploy de
-- `purge-scheduled-deletions`) → build novo no Appflow.
--
-- Reexecutável.
-- ============================================================================

create table if not exists public.apple_auth_tokens (
  -- Cascade: a linha some junto com a conta (delete_user_data / auth admin).
  user_id       uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.apple_auth_tokens is
  'Refresh token do Sign in with Apple, guardado só para poder revogar a autorização na exclusão da conta (guideline 5.1.1(v)). Só service role.';

alter table public.apple_auth_tokens enable row level security;
revoke all on public.apple_auth_tokens from anon, authenticated;

-- Conferência:
--   select count(*) as contas_apple_com_token from apple_auth_tokens;
