-- ============================================================================
-- Migration: 20261005 — exclusão de conta agendada (30 dias) com justificativa
--
-- ANTES: "Encerrar conta" apagava tudo na hora (Storage → delete_user_data →
-- auth.users). Sem volta e sem saber por que a pessoa saiu.
--
-- AGORA:
--   1. A pessoa escolhe o MOTIVO (+ detalhes opcionais) e confirma.
--      `request_account_deletion` grava o pedido com data = agora + 30 dias,
--      tira os tokens de push e o app desloga.
--   2. QUARENTENA (30 dias): a conta some para todo mundo — reaproveita o
--      esconderijo do banimento (`banned_user_ids()` e a policy restritiva de
--      `profiles`, ver 20261001-hide-banned-users.sql). Nada é apagado.
--   3. Entrou de novo nesse prazo → o app mostra "Reativar minha conta";
--      `cancel_account_deletion` cancela o pedido e tudo reaparece.
--   4. Venceu o prazo → a edge function `purge-scheduled-deletions` (pg_cron,
--      1x/dia) apaga a mídia pela API do Storage, chama `delete_user_data` e
--      encerra `auth.users`. O pedido fica, ANÔNIMO (user_id = null), só com
--      motivo e datas — é o dado de "por que as pessoas saem".
--
-- Apple 5.1.1(v): a exclusão continua começando dentro do app, sem contato com
-- suporte, e o prazo é informado antes da confirmação — o que a Apple aceita.
--
-- EXCEÇÃO CONSCIENTE à regra do `v_targets` (20260915): esta tabela NÃO entra
-- em `delete_user_data`. O pedido sobrevive à conta de propósito, e a edge
-- function anonimiza a linha ao concluir.
--
-- DEPENDE DE: 20260915-delete-user-data.sql e 20261001-hide-banned-users.sql.
--
-- ORDEM:
--   1. rodar esta migração (antes do build — o app novo chama as RPCs);
--   2. secret ACCOUNT_PURGE_CRON_SECRET + `supabase functions deploy purge-scheduled-deletions`;
--   3. agendar o cron (bloco 5, trocar os placeholders);
--   4. build novo no Appflow.
--
-- Reexecutável.
-- ============================================================================

-- ─── 1. Pedidos ─────────────────────────────────────────────────────────────

create table if not exists public.account_deletion_requests (
  id            bigserial primary key,
  -- Sem FK: o pedido sobrevive à conta. NULL depois da exclusão (anônimo).
  user_id       uuid,
  -- Chave estável (o app traduz): no_longer_use | other_app | privacy |
  -- too_many_notifications | bugs | missing_features | new_account | other
  reason        text not null,
  details       text,
  requested_at  timestamptz not null default now(),
  scheduled_for timestamptz not null,
  status        text not null default 'pending'
                check (status in ('pending', 'cancelled', 'completed')),
  cancelled_at  timestamptz,
  completed_at  timestamptz,
  constraint account_deletion_requests_details_len
    check (details is null or char_length(details) <= 1000)
);

comment on table public.account_deletion_requests is
  'Pedidos de exclusão de conta (prazo de 30 dias). pending = conta em quarentena e escondida; cancelled = reativada; completed = apagada (user_id anonimizado). Fora do delete_user_data de propósito.';

-- Um pedido em aberto por pessoa.
create unique index if not exists account_deletion_requests_one_pending
  on public.account_deletion_requests (user_id)
  where status = 'pending';

-- O cron procura os vencidos.
create index if not exists account_deletion_requests_due
  on public.account_deletion_requests (scheduled_for)
  where status = 'pending';

alter table public.account_deletion_requests enable row level security;

-- Só leitura do próprio pedido (o app pergunta "tenho exclusão agendada?").
-- Escrita só pelas RPCs abaixo.
drop policy if exists "account_deletion_requests_select_own" on public.account_deletion_requests;
create policy "account_deletion_requests_select_own"
  on public.account_deletion_requests
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ─── 2. RPCs do app ─────────────────────────────────────────────────────────

create or replace function public.request_account_deletion(p_reason text, p_details text default null)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_details text := nullif(trim(coalesce(p_details, '')), '');
  v_when    timestamptz;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in (
    'no_longer_use', 'other_app', 'privacy', 'too_many_notifications',
    'bugs', 'missing_features', 'new_account', 'other'
  ) then
    raise exception 'INVALID_REASON' using errcode = '22023';
  end if;
  if p_reason = 'other' and v_details is null then
    raise exception 'DETAILS_REQUIRED' using errcode = '22023';
  end if;
  if v_details is not null and char_length(v_details) > 1000 then
    v_details := left(v_details, 1000);
  end if;

  -- Pedido já em aberto (toque duplo, rede lenta): mantém a data original e
  -- só atualiza o motivo.
  update public.account_deletion_requests
     set reason = p_reason, details = v_details
   where user_id = v_uid and status = 'pending'
  returning scheduled_for into v_when;

  if v_when is null then
    insert into public.account_deletion_requests (user_id, reason, details, scheduled_for)
    values (v_uid, p_reason, v_details, now() + interval '30 days')
    returning scheduled_for into v_when;
  end if;

  -- Sem push durante a quarentena. Ao reativar, o app regrava o token.
  delete from public.push_tokens where user_id = v_uid;

  return v_when;
end;
$$;

revoke all on function public.request_account_deletion(text, text) from public, anon;
grant execute on function public.request_account_deletion(text, text) to authenticated;

create or replace function public.cancel_account_deletion()
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_n   int;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  update public.account_deletion_requests
     set status = 'cancelled', cancelled_at = now()
   where user_id = v_uid and status = 'pending';
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

revoke all on function public.cancel_account_deletion() from public, anon;
grant execute on function public.cancel_account_deletion() to authenticated;

-- ─── 3. Quarentena = invisível (mesmo esconderijo do banimento) ─────────────

create or replace function public.pending_deletion_user_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(r.user_id), '{}'::uuid[])
    from public.account_deletion_requests r
   where r.status = 'pending' and r.user_id is not null;
$$;

revoke all on function public.pending_deletion_user_ids() from public;
grant execute on function public.pending_deletion_user_ids() to anon, authenticated;

-- `banned_user_ids()` alimenta as ~20 policies restritivas e as RPCs que
-- filtram pessoas. Incluir a quarentena aqui esconde a conta em todas elas de
-- uma vez (o nome ficou "banned" por histórico: lê-se "escondidos").
create or replace function public.banned_user_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct x.user_id), '{}'::uuid[])
    from (
      select p.user_id from public.profiles p where p.is_banned = true
      union all
      select r.user_id from public.account_deletion_requests r
       where r.status = 'pending' and r.user_id is not null
    ) x;
$$;

revoke all on function public.banned_user_ids() from public;
grant execute on function public.banned_user_ids() to anon, authenticated;

-- `profiles` lê a coluna `is_banned` direto (tabela mais lida do app); a
-- quarentena entra pela função, avaliada uma vez por consulta (initplan).
do $$
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public' and c.relname = 'profiles' and c.relrowsecurity) then
    execute 'drop policy if exists "profiles_hide_banned" on public.profiles';
    execute $p$
      create policy "profiles_hide_banned"
        on public.profiles
        as restrictive
        for select
        using (
          -- O cast faz o Postgres tratar o resultado como ARRAY; sem ele,
          -- `= any ((select …))` vira comparação com subconsulta (uuid × uuid[]).
          (is_banned is not true
             and not (user_id = any ((select public.pending_deletion_user_ids())::uuid[])))
          or user_id = (select auth.uid())
          or (select public.viewer_sees_banned())
        )
    $p$;
  else
    raise notice 'profiles: RLS desligada — conta em quarentena continua visível';
  end if;
end $$;

-- ─── 4. Pedidos vencidos (usado pela edge function) ─────────────────────────

create or replace function public.due_account_deletions(p_limit int default 25)
returns table (id bigint, user_id uuid, scheduled_for timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.user_id, r.scheduled_for
    from public.account_deletion_requests r
   where r.status = 'pending'
     and r.scheduled_for <= now()
     and r.user_id is not null
   order by r.scheduled_for
   limit greatest(1, least(p_limit, 100));
$$;

revoke all on function public.due_account_deletions(int) from public, anon, authenticated;
grant execute on function public.due_account_deletions(int) to service_role;

-- ─── 5. Agendamento (pg_cron) ───────────────────────────────────────────────
-- Trocar os placeholders e rodar À PARTE, depois do deploy da função (mesmo
-- esquema do 20260713-reengagement-cron.sql):
--   <PROJECT_REF> → ref do projeto
--   <ANON_KEY>    → a chave PÚBLICA (anon). NÃO a service role: o texto do job
--                   fica salvo em cron.job.
--   <CRON_SECRET> → mesmo valor do secret ACCOUNT_PURGE_CRON_SECRET
--
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
--
-- select cron.unschedule('purge-scheduled-deletions')
--  where exists (select 1 from cron.job where jobname = 'purge-scheduled-deletions');
--
-- -- 06:00 UTC = 03:00 America/Sao_Paulo.
-- select cron.schedule(
--   'purge-scheduled-deletions',
--   '0 6 * * *',
--   $$
--   select net.http_post(
--     url     := 'https://<PROJECT_REF>.functions.supabase.co/purge-scheduled-deletions',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer <ANON_KEY>',
--       'x-cron-secret', '<CRON_SECRET>'
--     ),
--     body    := '{}'::jsonb
--   );
--   $$
-- );
--
-- Testar SEM apagar (lista os vencidos):
--   select net.http_post(url := 'https://<PROJECT_REF>.functions.supabase.co/purge-scheduled-deletions',
--     headers := jsonb_build_object('Content-Type','application/json',
--       'Authorization','Bearer <ANON_KEY>','x-cron-secret','<CRON_SECRET>'),
--     body := '{"dryRun": true}'::jsonb);
--   select id, status_code, content from net._http_response order by id desc limit 1;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- Por que as pessoas saem:
--   select reason, count(*) as pedidos,
--          count(*) filter (where status = 'cancelled') as reativaram
--     from account_deletion_requests
--    group by reason order by pedidos desc;
--
--   select requested_at, reason, details, status
--     from account_deletion_requests order by requested_at desc limit 50;
