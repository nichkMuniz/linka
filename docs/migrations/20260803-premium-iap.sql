-- ============================================================================
-- Migration: 20260803 — LinKa Premium Fase 2 (cobrança real via IAP/RevenueCat)
--
-- OBJETIVO: fazer a assinatura paga e a liberação manual conviverem na MESMA
-- linha de `subscriptions` sem se destruírem.
--
-- O PROBLEMA QUE ISTO RESOLVE
-- Até aqui a liberação manual gravava `status='active', store='manual'` — as
-- mesmas colunas que o webhook do RevenueCat passa a escrever. Como `user_id`
-- é a PK (uma linha por usuário), os dois brigariam pela mesma linha:
--   * liberar manualmente quem já paga apagaria os dados da assinatura real;
--   * qualquer evento do RevenueCat (renovação, expiração, cancelamento)
--     sobrescreveria a liberação manual e o acesso sumiria sozinho.
--
-- A SOLUÇÃO: dois conjuntos de colunas DISJUNTOS na mesma linha.
--   * Assinatura paga  → status, product_id, store, rc_*, environment,
--                        current_period_end   ← escritas SÓ pelo webhook
--   * Liberação manual → manual_active, manual_until, manual_note
--                        ← escritas SÓ por admin_set_premium()
-- `is_premium()` passa a ser o OR dos dois. Ninguém pisa no pé de ninguém, e um
-- usuário pode ter as duas coisas ao mesmo tempo sem conflito.
--
-- Rodar no SQL Editor do Supabase. Idempotente.
-- ============================================================================

-- ─── 1. Colunas da liberação manual ─────────────────────────────────────────

alter table public.subscriptions
  add column if not exists manual_active boolean not null default false,
  -- NULL com manual_active = true  →  liberação PERMANENTE (sem expiração).
  add column if not exists manual_until  timestamptz,
  -- Por que a cortesia foi concedida. Só o painel admin lê.
  add column if not exists manual_note   text;

comment on column public.subscriptions.manual_active is
  'Cortesia concedida pelo admin. Independente da assinatura paga: o webhook do RevenueCat NUNCA escreve nesta coluna.';
comment on column public.subscriptions.manual_until is
  'Fim da cortesia. NULL com manual_active = true significa permanente.';

-- ─── 2. Converter as liberações manuais já existentes ───────────────────────
--
-- Linhas com store='manual' foram criadas pelo fluxo antigo, que ocupava as
-- colunas de assinatura paga. Move para as colunas novas e LIMPA as de
-- pagamento — senão o painel mostraria uma "assinatura App Store" fantasma e o
-- SubscriptionDrawer ofereceria "Gerenciar na App Store" para uma cortesia.

update public.subscriptions
   set manual_active      = (status = 'active'),
       manual_until       = current_period_end,
       manual_note        = 'Migrado da Fase 1 (liberação manual)',
       status             = 'inactive',
       product_id         = null,
       store              = null,
       current_period_end = null,
       updated_at         = now()
 where store = 'manual'
   -- Guarda de idempotência: não reprocessa se a migração já rodou.
   and not manual_active;

-- ─── 3. is_premium(): assinatura paga OU cortesia ───────────────────────────

create or replace function public.is_premium(uid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = uid
      and (
        -- (a) assinatura paga vigente
        (
          s.status = 'active'
          and (s.current_period_end is null or s.current_period_end > now())
        )
        -- (b) assinatura CANCELADA mas dentro do período já pago.
        -- A Apple não estorna o período corrente: quem cancela hoje continua
        -- com acesso até a data de renovação. Sem este braço, o webhook de
        -- CANCELLATION cortaria na hora um acesso que o usuário pagou —
        -- e o SubscriptionDrawer já exibe essa data como "Acesso até".
        or (
          s.status = 'cancelled'
          and s.current_period_end is not null
          and s.current_period_end > now()
        )
        -- (c) cortesia vigente (NULL em manual_until = permanente)
        or (
          s.manual_active
          and (s.manual_until is null or s.manual_until > now())
        )
      )
  );
$$;

grant execute on function public.is_premium(uuid) to authenticated;

-- ─── 4. admin_set_premium(): mexe SÓ nas colunas de cortesia ────────────────
--
-- Diferença central para a versão anterior: nenhuma escrita em status/store/
-- product_id/current_period_end. Conceder cortesia a um assinante pagante não
-- toca na assinatura dele, e revogar a cortesia não cancela nada na Apple.

create or replace function public.admin_set_premium(
  p_user_id uuid,
  p_active  boolean,
  p_days    integer default null,
  p_note    text default null
)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
begin
  if not public.is_app_admin(auth.uid()) then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  if p_user_id is null then
    raise exception 'INVALID_USER' using errcode = '22023';
  end if;

  if p_active then
    insert into public.subscriptions (user_id, status, manual_active, manual_until, manual_note)
    values (
      p_user_id,
      'inactive',   -- só o webhook promove para 'active'
      true,
      case when p_days is null then null else now() + make_interval(days => p_days) end,
      p_note
    )
    on conflict (user_id) do update
      set manual_active = true,
          manual_until  = excluded.manual_until,
          manual_note   = coalesce(excluded.manual_note, public.subscriptions.manual_note),
          updated_at    = now();
  else
    update public.subscriptions s
      set manual_active = false,
          manual_until  = null,
          updated_at    = now()
    where s.user_id = p_user_id;
  end if;
end;
$$;

-- A assinatura antiga (3 argumentos) sairia de circulação sozinha, mas ficaria
-- resolvível por chamadas antigas e criaria ambiguidade no PostgREST.
drop function if exists public.admin_set_premium(uuid, boolean, integer);

grant execute on function public.admin_set_premium(uuid, boolean, integer, text) to authenticated;

-- ─── 5. admin_list_premium(): distingue cortesia de assinatura ──────────────

drop function if exists public.admin_list_premium();

create or replace function public.admin_list_premium()
returns table (
  user_id            uuid,
  nickname           text,
  handle             text,
  photo              text,
  status             text,
  store              text,
  current_period_end timestamptz,
  updated_at         timestamptz,
  manual_active      boolean,
  manual_until       timestamptz,
  manual_note        text,
  -- Assinatura paga vigente (independente da cortesia).
  paid_active        boolean,
  -- Tem acesso premium por qualquer motivo — espelha is_premium().
  is_active          boolean
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_app_admin(auth.uid()) then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  return query
    select
      s.user_id,
      coalesce(p.nickname, '')::text,
      coalesce(p.handle, '')::text,
      p.photo::text,
      s.status::text,
      s.store::text,
      s.current_period_end,
      s.updated_at,
      s.manual_active,
      s.manual_until,
      s.manual_note,
      -- Repete a regra de is_premium() para a lista não divergir da verdade.
      (
        (s.status = 'active'
          and (s.current_period_end is null or s.current_period_end > now()))
        or (s.status = 'cancelled'
          and s.current_period_end is not null
          and s.current_period_end > now())
      ) as paid_active,
      (
        (s.status = 'active'
          and (s.current_period_end is null or s.current_period_end > now()))
        or (s.status = 'cancelled'
          and s.current_period_end is not null
          and s.current_period_end > now())
        or (s.manual_active
          and (s.manual_until is null or s.manual_until > now()))
      ) as is_active
    from public.subscriptions s
    left join public.profiles p on p.user_id = s.user_id
    order by is_active desc, s.updated_at desc;
end;
$$;

grant execute on function public.admin_list_premium() to authenticated;

-- ─── 6. Índice para o webhook ───────────────────────────────────────────────
--
-- O webhook do RevenueCat identifica o usuário pelo app_user_id, que gravamos
-- em rc_app_user_id. Sem índice isso vira seq scan a cada evento.

create index if not exists subscriptions_rc_app_user_id_idx
  on public.subscriptions (rc_app_user_id)
  where rc_app_user_id is not null;

-- ============================================================================
-- VERIFICAÇÃO
--
--   -- Cortesias ativas:
--   select user_id, manual_until, manual_note from public.subscriptions
--    where manual_active;
--
--   -- Nenhuma linha deve ter sobrado com store='manual':
--   select count(*) from public.subscriptions where store = 'manual';
--
--   -- Status de um usuário:
--   select public.is_premium('<uid>');
-- ============================================================================
