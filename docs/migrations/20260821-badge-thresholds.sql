-- ============================================================
-- Migration: Limiares das insígnias ativadas em 21/08/2026
--
-- Contexto: as insígnias de hábito, comida e desafio foram cadastradas direto
-- no painel do Supabase (não há migração de seed para elas) e ficaram com
-- `required_checkins` no default 0. Elas nunca eram concedidas — o avaliador
-- devolvia `false` no `default:` do switch —, então o valor nunca importou.
--
-- Agora que `_evaluateBadgeCondition` sabe avaliar esses tipos, o limiar passa
-- a ser lido de verdade: com 0 no banco, `Math.max(1, required_checkins)` daria
-- "Sono 7 dias" na PRIMEIRA noite marcada. O cliente tem um piso de segurança
-- (`CONDITION_MIN_THRESHOLD` em `client/lib/ritmofit-db.ts`), mas o banco é a
-- fonte de verdade — esta migração alinha os dois.
--
-- O número de cada linha é o que o próprio `key` da insígnia promete.
-- Idempotente: só escreve onde o valor ainda não está correto.
-- ============================================================

UPDATE badges SET required_checkins = 7  WHERE key = 'sono_7d'               AND required_checkins <> 7;
UPDATE badges SET required_checkins = 5  WHERE key = 'meditacao_5d'          AND required_checkins <> 5;
UPDATE badges SET required_checkins = 7  WHERE key = 'sem_alcool_7d'         AND required_checkins <> 7;
UPDATE badges SET required_checkins = 7  WHERE key = 'passos_10k_7d'         AND required_checkins <> 7;
UPDATE badges SET required_checkins = 7  WHERE key = 'semana_perfeita'       AND required_checkins <> 7;
UPDATE badges SET required_checkins = 30 WHERE key = 'modo_monge'            AND required_checkins <> 30;
UPDATE badges SET required_checkins = 1  WHERE key = 'super_dia'             AND required_checkins <> 1;
UPDATE badges SET required_checkins = 7  WHERE key = 'frutas_7d'             AND required_checkins <> 7;
UPDATE badges SET required_checkins = 5  WHERE key = 'comida_caseira_5d'     AND required_checkins <> 5;
UPDATE badges SET required_checkins = 3  WHERE key = 'desafio_3x'            AND required_checkins <> 3;

-- Conferência (roda sozinha, não altera nada):
--   select key, name, condition_type, required_checkins
--   from badges
--   where condition_type in (
--     'habit_sleep','habit_meditation','habit_no_alcohol','habit_steps',
--     'habit_perfect_week','habit_perfect_day','habit_perfect_30d',
--     'nutrition_fruits','nutrition_home_food','challenge_count'
--   )
--   order by key;
