-- ============================================================================
-- Migration: 20260925 — `claim_push_token`: um aparelho, um dono
--
-- ⚠️ OBRIGATÓRIA. Sem ela o app cai no caminho antigo (que tem o bug abaixo),
-- mas continua funcionando.
--
-- O BUG:
--   `savePushTokenDb` tentava apagar o token do aparelho de QUALQUER OUTRO
--   usuário antes de gravar o próprio (troca de conta no mesmo iPhone). Só
--   que a RLS de `push_tokens` só deixa cada um mexer nos próprios tokens, e
--   DELETE barrado por RLS é no-op silencioso: 0 linhas, sem erro.
--
--   No uso normal o logout apaga o token e nada acontece. Mas se A perde a
--   sessão sem logout (sessão expirada, reinstalação) e B entra no mesmo
--   aparelho, o token fica com os dois — e os pushes de A, inclusive prévia
--   de mensagem privada, aparecem no aparelho de B.
--
-- O QUE ESTA MIGRAÇÃO FAZ:
--   1. função `claim_push_token(token, platform)` SECURITY DEFINER: tira o
--      token de todo mundo e grava para quem chamou, numa transação;
--   2. limpa o passivo: token com mais de um dono fica só com o registro
--      mais recente (o último login naquele aparelho).
--
-- Reexecutável.
-- ============================================================================

-- ─── 1. Função ──────────────────────────────────────────────────────────────

create or replace function public.claim_push_token(p_token text, p_platform text default 'ios')
returns void
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
  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'INVALID_TOKEN' using errcode = '22023';
  end if;
  if p_platform not in ('ios', 'android') then
    raise exception 'INVALID_PLATFORM' using errcode = '22023';
  end if;

  -- O token identifica o APARELHO: quem entrou por último é o único dono.
  delete from public.push_tokens
   where token = p_token
     and user_id <> v_uid;

  insert into public.push_tokens (user_id, token, platform, updated_at)
  values (v_uid, p_token, p_platform, now())
  on conflict (user_id, token)
  do update set platform = excluded.platform, updated_at = now();
end;
$$;

revoke all on function public.claim_push_token(text, text) from public, anon;
grant execute on function public.claim_push_token(text, text) to authenticated;

-- ─── 2. Limpeza do passivo ──────────────────────────────────────────────────

-- Diagnóstico (só leitura, opcional):
-- select token, count(*) as donos from public.push_tokens
--  group by token having count(*) > 1;

delete from public.push_tokens p
 using public.push_tokens newer
 where newer.token = p.token
   and newer.user_id <> p.user_id
   and (coalesce(newer.updated_at, newer.created_at), newer.id::text)
     > (coalesce(p.updated_at, p.created_at), p.id::text);
