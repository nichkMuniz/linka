-- ============================================================
-- Migration: modo de treino Simplificado × Expert (2026-08-05)
-- ============================================================
-- Cria a base para as DUAS VISÕES da experiência de treino. A rotina passa a
-- carregar o modo escolhido na criação, e a tela de registrar treino se adapta
-- a ele:
--
--   'simple'  → exatamente o que o app já fazia (tabela KG × REPS pura).
--               É o DEFAULT, então toda rotina que já existe continua igual.
--   'expert'  → série tipada (aquecimento / válida / falha), métricas corretas
--               (aquecimento fora do volume e do PR) e, nas fases seguintes,
--               anatomia por porção muscular e técnicas (bi-set, drop-set).
--
-- Duas colunas, duas responsabilidades:
--
--  1. `routines.training_mode`  — a escolha do usuário, por rotina (não por
--     conta). O mesmo usuário pode ter "Peito/Tríceps" no modo expert e
--     "Corrida de domingo" no simplificado.
--
--  2. `user_workouts_hist.set_kind` — o tipo da série JÁ EXECUTADA. Precisa
--     viver no histórico (e não só no estado da sessão) porque é o que permite
--     excluir aquecimento de volume, PR e progressão DEPOIS do treino salvo.
--     Sem isso, uma série de aquecimento de 40kg fica indistinguível de uma
--     série válida de 40kg para sempre.
--
-- NULL em `set_kind` = série gravada antes desta migração (ou no modo
-- simplificado, que não tipa séries) → tratada como 'normal' em toda leitura.
-- Por isso a coluna é anulável e SEM default: 'normal' explícito só aparece
-- quando o modo expert realmente classificou a série.
--
-- Rodar no Supabase (SQL Editor). Idempotente.
-- ============================================================

-- ── 1. Modo de treino da rotina ─────────────────────────────────────────────

ALTER TABLE routines
  ADD COLUMN IF NOT EXISTS training_mode text NOT NULL DEFAULT 'simple';

-- Constraint separada do ADD COLUMN para a migração continuar idempotente
-- (ADD CONSTRAINT não aceita IF NOT EXISTS no Postgres).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'routines_training_mode_check'
  ) THEN
    ALTER TABLE routines
      ADD CONSTRAINT routines_training_mode_check
      CHECK (training_mode IN ('simple', 'expert'));
  END IF;
END $$;

COMMENT ON COLUMN routines.training_mode IS
  'Modo da experiência de treino desta rotina: simple = tela clássica (KG × REPS); expert = série tipada, métricas sem aquecimento e recursos avançados. Default simple — rotinas antigas não mudam de comportamento.';

-- ── 2. Tipo da série no histórico ───────────────────────────────────────────

ALTER TABLE user_workouts_hist
  ADD COLUMN IF NOT EXISTS set_kind text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_workouts_hist_set_kind_check'
  ) THEN
    ALTER TABLE user_workouts_hist
      ADD CONSTRAINT user_workouts_hist_set_kind_check
      CHECK (set_kind IS NULL OR set_kind IN ('warmup', 'normal', 'failure'));
  END IF;
END $$;

COMMENT ON COLUMN user_workouts_hist.set_kind IS
  'Tipo da série executada (modo expert): warmup = aquecimento (NÃO conta em volume, contagem de séries, PR nem progressão), normal = série válida, failure = série levada à falha. NULL = série do modo simplificado ou anterior a 05/08/2026 — lida como normal.';

-- Índice parcial: toda leitura de carga/progressão filtra fora o aquecimento
-- (getPreviousBestKgDb, getExerciseProgressionDb). O índice cobre exatamente
-- as linhas que essas consultas mantêm.
CREATE INDEX IF NOT EXISTS user_workouts_hist_working_sets_idx
  ON user_workouts_hist (user_id, workout_id, date_completed DESC)
  WHERE set_kind IS DISTINCT FROM 'warmup';

-- ── Conferência ─────────────────────────────────────────────────────────────
-- SELECT training_mode, count(*) FROM routines GROUP BY 1;        -- tudo 'simple'
-- SELECT set_kind, count(*) FROM user_workouts_hist GROUP BY 1;   -- tudo NULL
