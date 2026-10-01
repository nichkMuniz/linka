-- ============================================================================
-- Migration: 20261001 — nome dos flows fixados
--
-- ⚠️ Rodar DEPOIS de `20261001-flow-pinned.sql` e ANTES do build.
--    Sem ela o app ainda fixa (cai na RPC de 2 argumentos), só sem o nome — a
--    faixa mostra a data, como antes.
--
-- O QUE MUDA
--   • `flow.pinned_title` — nome do destaque na faixa do perfil (até 30
--     caracteres; vazio = mostra a data do flow).
--   • `set_flow_pinned` ganha `p_title`. Fixar um flow já fixado com outro nome
--     = RENOMEAR (o `pinned_at` não muda, então a ordem da faixa também não).
--     Desafixar limpa os dois.
--
--   A versão de 2 argumentos é DERRUBADA: com as duas no banco, o PostgREST
--   não sabe qual chamar quando o app manda 2 argumentos.
--
-- Rodar no SQL Editor do Supabase.
-- ============================================================================

alter table public.flow
  add column if not exists pinned_title text;

drop function if exists public.set_flow_pinned(bigint, boolean);

create or replace function public.set_flow_pinned(
  p_flow_id bigint,
  p_pinned  boolean,
  p_title   text default null
)
returns boolean
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_rows  integer := 0;
  v_title text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  -- Espaços colapsados, corte em 30 caracteres; vazio vira NULL (= data).
  v_title := nullif(btrim(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g')), '');
  if v_title is not null and char_length(v_title) > 30 then
    v_title := left(v_title, 30);
  end if;

  if p_pinned then
    -- Re-fixar (renomear) um que já está fixado não conta contra o limite.
    if (select count(*) from public.flow f
         where f.user_id = v_uid and f.pinned_at is not null and f.id <> p_flow_id) >= 20 then
      raise exception 'PIN_LIMIT' using errcode = 'P0001';
    end if;
    update public.flow f
       set pinned_at    = coalesce(f.pinned_at, now()),
           pinned_title = v_title
     where f.id = p_flow_id and f.user_id = v_uid;
  else
    update public.flow f
       set pinned_at    = null,
           pinned_title = null
     where f.id = p_flow_id and f.user_id = v_uid;
  end if;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

revoke all on function public.set_flow_pinned(bigint, boolean, text) from public, anon;
grant execute on function public.set_flow_pinned(bigint, boolean, text) to authenticated;

-- ─── Conferência ────────────────────────────────────────────────────────────
-- Só deve existir UMA assinatura, com 3 argumentos:
--   select oid::regprocedure from pg_proc where proname = 'set_flow_pinned';
