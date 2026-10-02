-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-10-02 — Treino rápido: vincular o histórico à rotina salva no resumo
--
-- O "Treino rápido" (tela de Metas, para quem ainda não tem rotina) é uma
-- sessão SEM rotina: as séries vão para `user_workouts_hist` com
-- `routine_id` e `user_workout_id` NULOS — o mesmo caminho do convidado do
-- "treinar junto". No resumo, a pessoa pode transformar o treino numa rotina
-- (nome + exercícios). Esta função liga as séries daquela sessão à rotina
-- recém-criada, para ela já nascer com o histórico:
--   • "concluída nesta semana" e "último treino" do card (leem
--     `user_workout_id`);
--   • ícone de resumo da rotina (gateado por `routine_id` no histórico).
-- PR, coluna ANTERIOR e gráficos já funcionavam sem isto (leem `workout_id`).
--
-- Por que RPC SECURITY DEFINER, e não um UPDATE do cliente: o app nunca fez
-- UPDATE em `user_workouts_hist`, e a policy "for all" das migrações de junho
-- não estava aplicada em produção (foi por isso que o DELETE precisou de
-- 20260716-hist-delete-rls). Um UPDATE barrado pela RLS volta 0 linhas SEM
-- erro — o vínculo falharia em silêncio. Aqui o dono é conferido à mão.
--
-- Escopo (nada fora da sessão é tocado):
--   • só linhas do próprio usuário (auth.uid());
--   • só linhas ainda SEM vínculo (routine_id e user_workout_id nulos);
--   • só dentro da janela [p_since, p_since + 10 min] — `p_since` é o instante
--     base com que a finalização grava a rajada de séries (`date_completed` =
--     base + índice em ms);
--   • só exercícios que fazem parte da rotina (casados por workout_id).
-- Devolve quantas linhas foram vinculadas.
--
-- Sem redeploy de edge function. Rodar no Supabase SQL Editor ANTES do build
-- (sem a função, salvar a rotina funciona; só o histórico fica sem vínculo).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.link_session_history_to_routine(
  p_routine_id bigint,
  p_since timestamptz
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer := 0;
begin
  if v_uid is null or p_routine_id is null or p_since is null then
    return 0;
  end if;

  -- A rotina precisa ser do próprio usuário.
  if not exists (
    select 1 from public.routines r
    where r.id = p_routine_id and r.user_id = v_uid
  ) then
    return 0;
  end if;

  update public.user_workouts_hist h
     set routine_id = p_routine_id,
         user_workout_id = uw.id
    from public.user_workouts uw
   where uw.user_id = v_uid
     and uw.routine_id = p_routine_id
     and uw.workout_id::text = h.workout_id::text
     and h.user_id = v_uid
     and h.routine_id is null
     and h.user_workout_id is null
     -- `date_completed` é `timestamp` SEM fuso, gravado em UTC (ISO com "Z"
     -- vindo do app): compara no mesmo referencial, independente do TimeZone
     -- da sessão do banco.
     and h.date_completed >= (p_since at time zone 'UTC') - interval '2 seconds'
     and h.date_completed <= (p_since at time zone 'UTC') + interval '10 minutes';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.link_session_history_to_routine(bigint, timestamptz) from public;
grant execute on function public.link_session_history_to_routine(bigint, timestamptz) to authenticated;
