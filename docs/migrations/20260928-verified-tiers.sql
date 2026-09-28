-- ═══════════════════════════════════════════════════════════════════════════
-- 20260928 — Dois níveis de conta verificada
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Até aqui `profiles.is_verified` era um booleano só: o selo do admin e o de
-- qualquer conta verificada pelo painel eram idênticos (dourado). Agora:
--
--   verified_tier = 'official' → equipe LinKa (admin). Selo dourado, roseta.
--   verified_tier = 'notable'  → usuário importante.   Selo azul, círculo.
--   verified_tier = null       → sem selo.
--
-- `is_verified` continua existindo e fica SINCRONIZADO (true ⇔ tier não nulo):
-- builds antigos do app, que só leem `is_verified`, seguem mostrando um selo.
--
-- ⚠ RODAR ANTES DE PUBLICAR O BUILD NOVO: o app passa a pedir `verified_tier`
-- no select, e o PostgREST falha a query inteira se a coluna não existir.
-- A migração é aditiva — não quebra os builds que já estão na loja.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Coluna ──────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists verified_tier text;

alter table public.profiles
  drop constraint if exists profiles_verified_tier_check;
alter table public.profiles
  add constraint profiles_verified_tier_check
  check (verified_tier is null or verified_tier in ('official', 'notable'));

-- ─── 2. Backfill ────────────────────────────────────────────────────────────
-- Quem já era verificado: admins viram 'official', o resto vira 'notable'.

update public.profiles p
   set verified_tier = case
         when exists (select 1 from public.app_admins a where a.user_id = p.user_id)
           then 'official'
         else 'notable'
       end
 where p.is_verified = true
   and p.verified_tier is null;

-- ─── 3. Trava contra auto-promoção ──────────────────────────────────────────
-- Mesma regra do `freeze_is_verified` (20260811): só service_role ou admin
-- mexem no nível. Sem isto qualquer usuário daria a si mesmo o selo oficial
-- com um UPDATE na própria linha (policy `profiles_update_own`).

create or replace function public.freeze_verified_tier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verified_tier is distinct from old.verified_tier
     and coalesce(current_setting('request.jwt.claims', true)::json ->> 'role', '') <> 'service_role'
     and auth.role() <> 'service_role'
     and not public.is_app_admin(auth.uid())
  then
    new.verified_tier := old.verified_tier;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_freeze_verified_tier on public.profiles;
create trigger trg_freeze_verified_tier
  before update on public.profiles
  for each row
  execute function public.freeze_verified_tier();

-- ─── 4. RPC do painel ───────────────────────────────────────────────────────
-- p_tier: 'official' | 'notable' | null (null remove o selo).
-- Grava as duas colunas juntas para `is_verified` nunca divergir do nível.

create or replace function public.admin_set_verified_tier(
  p_user_id uuid,
  p_tier    text
)
returns boolean
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  if not public.is_app_admin(auth.uid()) then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  if p_user_id is null then
    raise exception 'INVALID_USER' using errcode = '22023';
  end if;

  if p_tier is not null and p_tier not in ('official', 'notable') then
    raise exception 'INVALID_TIER' using errcode = '22023';
  end if;

  update public.profiles p
     set verified_tier = p_tier,
         is_verified   = (p_tier is not null),
         updated_at    = now()
   where p.user_id = p_user_id;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

grant execute on function public.admin_set_verified_tier(uuid, text) to authenticated;

-- A RPC antiga (booleana) continua existindo para builds antigos do painel,
-- mas passa a gravar o nível também: verificar = 'notable', remover = null.
create or replace function public.admin_set_verified(
  p_user_id  uuid,
  p_verified boolean default true
)
returns boolean
language plpgsql volatile security definer
set search_path = public
as $$
begin
  return public.admin_set_verified_tier(
    p_user_id,
    case when p_verified then 'notable' else null end
  );
end;
$$;

grant execute on function public.admin_set_verified(uuid, boolean) to authenticated;

-- ─── Verificação rápida (opcional) ──────────────────────────────────────────
--
--   select user_id, nickname, is_verified, verified_tier
--     from public.profiles where is_verified = true;
--
--   Toda linha com is_verified = true deve ter verified_tier preenchido.
