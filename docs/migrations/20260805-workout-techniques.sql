-- ============================================================
-- Migration: técnicas de treino — bi-set, tri-set, drop-set, rest-pause (2026-08-05)
-- ============================================================
-- Fase 3 do plano de treino profissional. Até aqui toda série era "série
-- direta": faz, descansa, repete. Quem treina sério estrutura o treino em
-- técnicas, e o app não tinha onde guardar isso.
--
-- A escolha é POR EXERCÍCIO DENTRO DA ROTINA (`user_workouts`), não no catálogo
-- `workouts`: "supino reto" não é bi-set — é bi-set *na SUA rotina de peito*,
-- pareado com um exercício específico seu. O mesmo exercício pode ser direto em
-- outra rotina.
--
-- Duas famílias de técnica, e é por isso que são duas colunas:
--
--   INDIVIDUAIS (só `technique`)     — drop-set, rest-pause. A técnica acontece
--                                       dentro do próprio exercício.
--   EM BLOCO   (+ `technique_group`) — bi-set, tri-set. A técnica é a LIGAÇÃO
--                                       entre 2–3 exercícios; sem uma chave que
--                                       os agrupe não dá para saber quem faz par
--                                       com quem.
--
-- `order_index` existe porque um bloco só faz sentido com os exercícios
-- adjacentes e na ordem certa (A1 → A2). Até hoje a ordem dos exercícios da
-- rotina era a de `created_at`, o que nunca foi controlável pelo usuário.
--
-- Rodar no Supabase (SQL Editor). Idempotente.
-- ============================================================

-- ── 1. Técnica por exercício da rotina ──────────────────────────────────────

ALTER TABLE user_workouts
  ADD COLUMN IF NOT EXISTS technique text NOT NULL DEFAULT 'straight';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_workouts_technique_check'
  ) THEN
    ALTER TABLE user_workouts
      ADD CONSTRAINT user_workouts_technique_check
      CHECK (technique IN ('straight', 'biset', 'triset', 'drop', 'rest_pause'));
  END IF;
END $$;

COMMENT ON COLUMN user_workouts.technique IS
  'Técnica deste exercício NESTA rotina: straight (série direta, o padrão), drop (drop-set), rest_pause, biset/triset (exigem technique_group). Escolhida na criação/edição da rotina, só no modo expert.';

-- ── 2. Agrupamento dos blocos (bi-set / tri-set) ────────────────────────────

ALTER TABLE user_workouts
  ADD COLUMN IF NOT EXISTS technique_group text;

COMMENT ON COLUMN user_workouts.technique_group IS
  'Chave que liga os exercícios de um mesmo bloco de bi-set/tri-set. Mesmo valor = mesmo bloco, executados sem descanso entre eles. NULL para técnicas individuais e séries diretas.';

-- Um bloco tem sentido só com 2+ membros; o app garante isso na escrita (ao
-- desfazer um par, os dois voltam a straight). Aqui fica o índice que o
-- agrupamento na sessão de treino usa.
CREATE INDEX IF NOT EXISTS user_workouts_technique_group_idx
  ON user_workouts (user_id, technique_group)
  WHERE technique_group IS NOT NULL;

-- ── 3. Ordem dos exercícios na rotina ───────────────────────────────────────
-- NULL = sem ordem explícita → a leitura cai no created_at de sempre, então
-- rotinas antigas não mudam de ordem sozinhas.

ALTER TABLE user_workouts
  ADD COLUMN IF NOT EXISTS order_index int;

COMMENT ON COLUMN user_workouts.order_index IS
  'Ordem do exercício dentro da rotina (0-based). Gravada quando o usuário monta blocos de bi-set — os membros precisam ficar adjacentes e na ordem A1→A2. NULL = ordem legada por created_at.';

-- ── 4. `set_kind` passa a aceitar 'drop' ────────────────────────────────────
-- A série de drop é trabalho real (conta em volume e PR, ao contrário do
-- aquecimento) mas precisa ser distinguível: ela não tem descanso antes e é a
-- continuação da série anterior, não uma série nova.

ALTER TABLE user_workouts_hist
  DROP CONSTRAINT IF EXISTS user_workouts_hist_set_kind_check;

ALTER TABLE user_workouts_hist
  ADD CONSTRAINT user_workouts_hist_set_kind_check
  CHECK (set_kind IS NULL OR set_kind IN ('warmup', 'normal', 'failure', 'drop'));

COMMENT ON COLUMN user_workouts_hist.set_kind IS
  'Tipo da série executada (modo expert): warmup = aquecimento (NÃO conta em volume, contagem, PR nem progressão), normal = série válida, failure = levada à falha, drop = queda de carga emendada na série anterior (CONTA como trabalho). NULL = série do modo simplificado ou anterior a 05/08/2026 — lida como normal.';

-- ── Conferência ─────────────────────────────────────────────────────────────
-- SELECT technique, count(*) FROM user_workouts GROUP BY 1;   -- tudo 'straight'
-- SELECT count(*) FROM user_workouts WHERE technique_group IS NOT NULL;  -- 0
