-- ============================================================================
-- Migration: 20261001 — cadastro por Google/Apple só existe se for CONCLUÍDO
--
-- PROBLEMA:
--   Entrar com Apple/Google cria a linha em `auth.users` na hora (o Supabase
--   precisa dela para dar a sessão), e o trigger `handle_new_user` cria o
--   `profiles` junto, com um @ tirado do email. Se a pessoa desistisse no meio
--   dos passos de perfil (voltar, fechar o app), a conta ficava para sempre:
--   aparecia na busca, ocupava o @ e contava como usuário.
--
-- O QUE ESTA MIGRAÇÃO FAZ:
--   1. `is_abandoned_social_signup(uuid)` — a regra única de "cadastro social
--      incompleto". Interna (ninguém chama pela API).
--   2. `discard_incomplete_social_signup()` — RPC que o app chama quando a
--      pessoa desiste (botão voltar do passo 2) ou quando reabre o login com a
--      sessão incompleta. Apaga a PRÓPRIA conta, e só se a regra acima valer.
--   3. `purge_abandoned_social_signups()` + pg_cron de hora em hora — pega quem
--      fechou o app no meio e nunca voltou (contas incompletas com mais de 1h).
--      Na primeira execução também limpa as que sobraram desde 29/09/2026.
--
-- REGRA DE "INCOMPLETO" (tudo junto):
--   • provedor google/apple;
--   • `user_metadata.signup_completed` diferente de true (o app grava no fim
--     dos passos e, desde esta versão, NÃO conclui o cadastro se essa gravação
--     falhar — ver `markSocialSignupCompleted`);
--   • criada a partir de 29/09/2026 (contas do login social antigo ficam fora);
--   • travas de segurança, para nunca apagar uma conta de verdade:
--       – nenhum post e nenhum flow;
--       – o `profiles` não foi tocado depois de criado pelo trigger (o fim do
--         cadastro grava `updated_at`; tolerância de 30s).
--
-- DEPENDE DE: 20260915-delete-user-data.sql (reaproveita `delete_user_data`).
--
-- CONFERIR ANTES DE APLICAR (dry-run — lista o que o cron vai apagar):
--
--   select u.id, u.email, u.created_at, u.raw_app_meta_data->>'provider' as provider
--     from auth.users u
--    where u.created_at < now() - interval '1 hour'
--      and public.is_abandoned_social_signup(u.id);   -- (depois do passo 1)
--
-- MÍDIA: o cron não toca no Storage (o Postgres não fala com ele). Conta
--   incompleta não sobe foto — o upload só acontece no último passo, que
--   conclui o cadastro —, então na prática não sobra nada lá.
-- ============================================================================

create extension if not exists pg_cron;

-- ─── 1. Regra única de "cadastro social incompleto" ─────────────────────────
create or replace function public.is_abandoned_social_signup(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
      from auth.users u
     where u.id = p_user_id
       and coalesce(u.raw_app_meta_data ->> 'provider', '') in ('google', 'apple')
       and coalesce(u.raw_user_meta_data ->> 'signup_completed', '') <> 'true'
       and u.created_at >= timestamptz '2026-09-29 00:00:00+00'
       and not exists (select 1 from public.posts p where p.user_id = u.id)
       and not exists (select 1 from public.flow f where f.user_id = u.id)
       and not exists (
         select 1 from public.profiles pr
          where pr.user_id = u.id
            and pr.updated_at > pr.created_at + interval '30 seconds'
       )
  );
$$;

revoke all on function public.is_abandoned_social_signup(uuid) from public, anon, authenticated;

-- ─── 2. Desistiu no app: apaga a PRÓPRIA conta incompleta ───────────────────
-- Devolve o mesmo jsonb de `delete_user_data` — com `"auth.users": 1` quando a
-- conta saiu de auth.users (sem a chave, o app cai no fallback com service
-- role, igual ao "Excluir minha conta").
create or replace function public.discard_incomplete_social_signup()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  -- Conta concluída (ou com conteúdo) nunca é apagada por aqui.
  if not public.is_abandoned_social_signup(v_uid) then
    raise exception 'SIGNUP_NOT_ABANDONED' using errcode = 'P0001';
  end if;
  return public.delete_user_data(v_uid);
end;
$$;

revoke all on function public.discard_incomplete_social_signup() from public, anon;
grant execute on function public.discard_incomplete_social_signup() to authenticated;

-- ─── 3. Fechou o app no meio e não voltou: limpeza agendada ─────────────────
-- Roda sem JWT (pg_cron), que é o caminho "acesso direto" de delete_user_data.
create or replace function public.purge_abandoned_social_signups()
returns integer
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  r   record;
  v_n integer := 0;
begin
  for r in
    select u.id
      from auth.users u
     where u.created_at < now() - interval '1 hour'
       and public.is_abandoned_social_signup(u.id)
  loop
    begin
      perform public.delete_user_data(r.id);
      v_n := v_n + 1;
    exception when others then
      -- Uma conta com problema não pode travar a limpeza das outras.
      raise warning 'purge_abandoned_social_signups: % — %', r.id, sqlerrm;
    end;
  end loop;
  return v_n;
end;
$$;

revoke all on function public.purge_abandoned_social_signups() from public, anon, authenticated;

select cron.unschedule('purge-abandoned-social-signups')
where exists (select 1 from cron.job where jobname = 'purge-abandoned-social-signups');

select cron.schedule(
  'purge-abandoned-social-signups',
  '15 * * * *',
  $$ select public.purge_abandoned_social_signups(); $$
);

-- Conferir:   select * from cron.job where jobname = 'purge-abandoned-social-signups';
-- Rodar já:   select public.purge_abandoned_social_signups();
