-- ============================================================
-- Migration: Badge Condition Types (2026-04-27)
-- Adiciona condition_type e condition_metadata à tabela badges
-- para que cada insígnia só seja concedida quando sua condição
-- específica for satisfeita (não apenas contagem de check-ins).
-- ============================================================

-- 1. Adicionar colunas
ALTER TABLE badges
  ADD COLUMN IF NOT EXISTS condition_type text NOT NULL DEFAULT 'checkin_total',
  ADD COLUMN IF NOT EXISTS condition_metadata jsonb;

-- 2. Mapear condition_type para cada badge existente

-- Grupo: check-ins na semana atual (Dom–Sáb)
UPDATE badges SET condition_type = 'checkin_week'
  WHERE key IN ('iniciante', 'sequencia', 'campeao', 'lendario');

-- Grupo: total acumulado de check-ins
UPDATE badges SET condition_type = 'checkin_total'
  WHERE key IN ('total_10', 'total_50', 'total_100', 'total_365', 'primeiro_checkin');

-- Grupo: dias consecutivos de check-in (streak)
UPDATE badges SET condition_type = 'checkin_streak'
  WHERE key IN ('streak_7', 'streak_15', 'streak_30', 'streak_90');

-- Grupo: check-in após meia-noite (00:00–05:59)
UPDATE badges SET condition_type = 'checkin_after_midnight'
  WHERE key = 'noturno';

-- Grupo: check-in antes de hora específica (Madrugador = antes das 9h)
UPDATE badges SET condition_type = 'checkin_before_time', condition_metadata = '{"hour": 9}'
  WHERE key = 'treino_manha';

-- Grupo: voltou após 7+ dias sem check-in
UPDATE badges SET condition_type = 'checkin_comeback'
  WHERE key = 'comeback';

-- Grupo: treinos na semana
UPDATE badges SET condition_type = 'workout_week'
  WHERE key = 'treino_3_semana';

-- Grupo: treinos por tipo
UPDATE badges SET condition_type = 'workout_type', condition_metadata = '{"type": "forca"}'
  WHERE key = 'treino_forca_10';

UPDATE badges SET condition_type = 'workout_type', condition_metadata = '{"type": "cardio"}'
  WHERE key = 'treino_cardio_10';

-- Grupo: nutrição (concedidas por awardNutritionBadgesDb)
UPDATE badges SET condition_type = 'nutrition_hydration'     WHERE key = 'hidratacao_7dias';
UPDATE badges SET condition_type = 'nutrition_week'          WHERE key = 'semana_nutritiva';
UPDATE badges SET condition_type = 'nutrition_no_ultra'      WHERE key = 'sem_ultraprocessado_7d';
UPDATE badges SET condition_type = 'nutrition_no_sugar'      WHERE key = 'sem_acucar_7d';
UPDATE badges SET condition_type = 'nutrition_protein'       WHERE key = 'proteina_7d';
UPDATE badges SET condition_type = 'nutrition_home_food'     WHERE key = 'comida_caseira_5d';
UPDATE badges SET condition_type = 'nutrition_fruits'        WHERE key = 'frutas_7d';

-- Grupo: hábitos (precisam de tracking dedicado — ainda não concedidas automaticamente)
UPDATE badges SET condition_type = 'habit_sleep'             WHERE key = 'sono_7d';
UPDATE badges SET condition_type = 'habit_no_alcohol'        WHERE key = 'sem_alcool_7d';
UPDATE badges SET condition_type = 'habit_meditation'        WHERE key = 'meditacao_5d';
UPDATE badges SET condition_type = 'habit_steps'             WHERE key = 'passos_10k_7d';
UPDATE badges SET condition_type = 'habit_perfect_week'      WHERE key = 'semana_perfeita';
UPDATE badges SET condition_type = 'habit_perfect_day'       WHERE key = 'super_dia';
UPDATE badges SET condition_type = 'habit_perfect_30d'       WHERE key = 'modo_monge';

-- Grupo: uso do app
UPDATE badges SET condition_type = 'app_usage'
  WHERE key IN ('app_7dias', 'app_30dias');

-- Grupo: desafios
UPDATE badges SET condition_type = 'challenge_count'
  WHERE key = 'desafio_3x';
