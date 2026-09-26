-- ============================================================================
-- Migration: 20260925 — `user_workouts_hist.series`: número da série
--
-- ⚠️ Rodar ANTES do próximo build. Só adiciona coluna, então é segura para
-- builds antigos (eles simplesmente não preenchem). O build novo também tolera
-- a coluna ausente, mas aí grava sem o número.
--
-- O QUE FALTAVA:
--   O histórico grava UMA LINHA POR SÉRIE, mas nenhuma coluna dizia qual
--   série era. A ordem só dava para inferir pelo `date_completed` (a sessão
--   grava cada série com +1 ms), o que não sobrevive a nada além da leitura
--   ordenada.
--
-- A REGRA DO NÚMERO (a mesma do cartão da sessão, `workingSetLabels` em
-- workout-session-dialog.tsx):
--   * aquecimento é numerado junto (2 de aquecimento + 3 normais = 1..5);
--   * drop NÃO abre série nova: recebe o número da série de cima (é a
--     continuação dela), o mesmo que `countsAsSeries` faz na contagem;
--   * série pulada (não concluída) não gera linha, mas o número das seguintes
--     continua sendo o que o usuário viu na tela (concluiu 1 e 3 → grava 1 e 3).
--
-- Reexecutável: o backfill só preenche linhas com `series` NULL.
-- ============================================================================

alter table public.user_workouts_hist
  add column if not exists series smallint check (series >= 1);

-- ─── Backfill das linhas antigas ────────────────────────────────────────────
--
-- Sessão = séries do mesmo usuário e exercício gravadas numa rajada. O app
-- grava cada série com +1 ms, então uma diferença maior que 5 minutos entre
-- duas linhas seguidas do mesmo exercício é uma sessão nova. Dentro da
-- sessão, numera na ordem gravada, com drop herdando o número anterior.
--
-- Limitação: séries puladas não existem no histórico antigo, então aqui a
-- numeração é sempre contínua (concluiu 1 e 3 → vira 1 e 2).

with ordered as (
  select
    h.id,
    h.user_id,
    h.workout_id,
    h.set_kind,
    h.date_completed,
    h.created_at,
    case
      when lag(h.date_completed) over w is null then 1
      when h.date_completed - lag(h.date_completed) over w > interval '5 minutes' then 1
      else 0
    end as new_session
  from public.user_workouts_hist h
  window w as (partition by h.user_id, h.workout_id order by h.date_completed, h.created_at, h.id)
),
sessions as (
  select
    o.*,
    sum(o.new_session) over (
      partition by o.user_id, o.workout_id
      order by o.date_completed, o.created_at, o.id
    ) as session_no
  from ordered o
),
numbered as (
  select
    s.id,
    greatest(
      sum(case when s.set_kind = 'drop' then 0 else 1 end) over (
        partition by s.user_id, s.workout_id, s.session_no
        order by s.date_completed, s.created_at, s.id
      ),
      1
    ) as n
  from sessions s
)
update public.user_workouts_hist h
   set series = least(n.n, 32767)::smallint
  from numbered n
 where h.id = n.id
   and h.series is null;

-- Leituras de "última sessão" e progressão ordenam por exercício + data.
create index if not exists user_workouts_hist_user_workout_date_idx
  on public.user_workouts_hist (user_id, workout_id, date_completed desc);
