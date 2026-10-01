-- ============================================================================
-- Migration: 20261001 — flows fixados no perfil (estilo destaques do Instagram)
--
-- ⚠️ Rodar ANTES do build. Sem ela o app continua funcionando (a leitura cai
--    para as colunas antigas e a faixa de fixados some), mas o botão de fixar
--    responde "migração não aplicada".
--
-- COMO FUNCIONA
--   O flow nunca é apagado depois de 24h — ele só sai do ring porque as leituras
--   filtram `created_at >= now() - 24h` (ver `getActiveStoriesDb`). Então fixar
--   NÃO copia nada: é só uma marca no próprio flow. O ring do feed continua
--   expirando normalmente; o perfil lê os fixados sem o filtro de 24h.
--
--   `pinned_at` = quando foi fixado (ordena a faixa, mais recente primeiro).
--   NULL = não fixado.
--
-- POR QUE RPC (e não UPDATE direto)
--   UPDATE barrado pela RLS volta "0 linhas" SEM erro — o app diria "fixado"
--   sem ter fixado (mesma lição de 20260811). A RPC só mexe no flow do próprio
--   usuário e devolve se mexeu.
--
-- LIMITE: 20 fixados por pessoa (`PIN_LIMIT`). A faixa é horizontal; acima
--   disso vira uma esteira que ninguém percorre.
--
-- Rodar no SQL Editor do Supabase.
-- ============================================================================

alter table public.flow
  add column if not exists pinned_at timestamptz;

create index if not exists flow_user_pinned_idx
  on public.flow (user_id, pinned_at desc)
  where pinned_at is not null;

create or replace function public.set_flow_pinned(
  p_flow_id bigint,
  p_pinned  boolean
)
returns boolean
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_rows integer := 0;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  if p_pinned then
    -- Re-fixar um que já está fixado não conta contra o limite.
    if (select count(*) from public.flow f
         where f.user_id = v_uid and f.pinned_at is not null and f.id <> p_flow_id) >= 20 then
      raise exception 'PIN_LIMIT' using errcode = 'P0001';
    end if;
    update public.flow f
       set pinned_at = coalesce(f.pinned_at, now())
     where f.id = p_flow_id and f.user_id = v_uid;
  else
    update public.flow f
       set pinned_at = null
     where f.id = p_flow_id and f.user_id = v_uid;
  end if;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

revoke all on function public.set_flow_pinned(bigint, boolean) from public, anon;
grant execute on function public.set_flow_pinned(bigint, boolean) to authenticated;

-- ─── Conferência ────────────────────────────────────────────────────────────
--   select id, user_id, created_at, pinned_at from public.flow
--    where pinned_at is not null order by pinned_at desc limit 20;
