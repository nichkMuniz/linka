-- ============================================================================
-- Migration: 20261005 — apagar treinos do Histórico de treinos
--
-- A tela /metas/historico ganhou "Apagar este treino" (no detalhe da sessão) e
-- "Apagar histórico" (menu ⋮ da lista). Uma sessão do histórico NÃO é uma
-- linha: são as séries de `user_workouts_hist` gravadas no mesmo "Finalizar".
-- O app manda os `id` dessas séries (ou NULL = o histórico inteiro).
--
-- Por que RPC SECURITY DEFINER, e não DELETE do cliente: um DELETE barrado pela
-- RLS volta 0 linhas SEM erro. A policy de DELETE de `user_workouts_hist` vem de
-- `20260716-hist-delete-rls.sql`, que pode não ter rodado em produção — o
-- apagar falharia em silêncio. Aqui o dono é conferido à mão (auth.uid()) e a
-- função devolve quantas linhas saíram.
--
-- Escopo: só linhas do próprio usuário. `workout_sets_hist` (se existir) cai
-- por cascade. Nada mais é tocado: posts publicados (o `workout_summary` é uma
-- cópia), desafios, treinos em conjunto, metas e `routines.last_summary` ficam.
-- O que é DERIVADO do histórico (recordes, coluna ANTERIOR, progressão,
-- cobertura muscular, "concluída nesta semana") recalcula sem as séries.
--
-- Sem redeploy de edge function. O app tolera a função ausente (cai no DELETE
-- direto, que depende da policy de 20260716), mas rodar ANTES do build.
--
-- Reexecutável.
-- ============================================================================

create or replace function public.delete_my_workout_history(p_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if p_ids is null then
    delete from public.user_workouts_hist where user_id = v_uid;
  else
    delete from public.user_workouts_hist where user_id = v_uid and id = any(p_ids);
  end if;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.delete_my_workout_history(uuid[]) from public, anon;
grant execute on function public.delete_my_workout_history(uuid[]) to authenticated;

-- Conferência:
--   select proname, prosecdef from pg_proc where proname = 'delete_my_workout_history';
