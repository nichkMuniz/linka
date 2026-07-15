-- ============================================================
-- 20260525-suggested-routines.sql
-- Rotinas de treino sugeridas por nível (Metas → aba Rotinas)
--
-- Modelo:
--   fitness_levels            -> tabela central de níveis (lookup)
--   user_fitness_levels       -> nível escolhido por cada usuário
--   suggested_routines        -> catálogo de treinos prontos (referencia o nível)
--   suggested_routine_exercises -> exercícios de cada treino (referencia workouts)
--
-- Rode este script inteiro no SQL Editor do painel do Supabase.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Níveis de treino — a tabela central que as demais referenciam
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fitness_levels (
  id          smallint PRIMARY KEY,
  key         text NOT NULL UNIQUE,            -- 'beginner' | 'intermediate' | 'advanced'
  name_pt     text NOT NULL,
  name_en     text NOT NULL,
  emoji       text NOT NULL DEFAULT '💪',
  sort_order  smallint NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.fitness_levels (id, key, name_pt, name_en, emoji, sort_order) VALUES
  (1, 'beginner',     'Iniciante',     'Beginner',     '🌱', 1),
  (2, 'intermediate', 'Intermediário', 'Intermediate', '💪', 2),
  (3, 'advanced',     'Avançado',      'Advanced',     '🔥', 3)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.fitness_levels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fitness_levels_select" ON public.fitness_levels;
CREATE POLICY "fitness_levels_select" ON public.fitness_levels
  FOR SELECT USING (true);

-- ------------------------------------------------------------
-- 2) Nível escolhido por cada usuário (1 registro por usuário)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_fitness_levels (
  user_id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  fitness_level_id  smallint NOT NULL REFERENCES public.fitness_levels(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_fitness_levels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ufl_select" ON public.user_fitness_levels;
DROP POLICY IF EXISTS "ufl_insert" ON public.user_fitness_levels;
DROP POLICY IF EXISTS "ufl_update" ON public.user_fitness_levels;
CREATE POLICY "ufl_select" ON public.user_fitness_levels
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ufl_insert" ON public.user_fitness_levels
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ufl_update" ON public.user_fitness_levels
  FOR UPDATE USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 3) Catálogo de rotinas sugeridas — referencia o nível
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.suggested_routines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fitness_level_id    smallint NOT NULL REFERENCES public.fitness_levels(id),
  name_pt             text NOT NULL,
  name_en             text NOT NULL,
  emoji               text NOT NULL DEFAULT '🏋️',
  muscle_focus        text,                    -- 'full_body' | 'push' | 'pull' | 'legs' | 'core' | ...
  frequency_per_week  smallint,                -- ex.: 3
  est_minutes         smallint,                -- ex.: 40
  technique_tags      text[] NOT NULL DEFAULT '{}',  -- ex.: {'superset','dropset'}
  is_featured         boolean NOT NULL DEFAULT false,
  sort_order          smallint NOT NULL DEFAULT 0,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.suggested_routines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_select" ON public.suggested_routines;
CREATE POLICY "sr_select" ON public.suggested_routines
  FOR SELECT USING (is_active = true);
CREATE INDEX IF NOT EXISTS suggested_routines_level_idx
  ON public.suggested_routines(fitness_level_id);

-- ------------------------------------------------------------
-- 4) Exercícios de cada rotina sugerida — referencia o catálogo workouts
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.suggested_routine_exercises (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggested_routine_id  uuid NOT NULL REFERENCES public.suggested_routines(id) ON DELETE CASCADE,
  workout_id            uuid NOT NULL REFERENCES public.workouts(id),
  position              smallint NOT NULL DEFAULT 0,
  sets                  smallint,              -- nº de séries
  reps                  text,                  -- '8-10', '12', 'falha'
  technique             text,                  -- 'superset' | 'dropset' | 'rest-pause' | 'piramide' | 'falha' | null
  superset_group        smallint,             -- agrupa exercícios em superset (mesmo nº = mesmo bloco)
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.suggested_routine_exercises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sre_select" ON public.suggested_routine_exercises;
CREATE POLICY "sre_select" ON public.suggested_routine_exercises
  FOR SELECT USING (true);
CREATE INDEX IF NOT EXISTS sre_routine_idx
  ON public.suggested_routine_exercises(suggested_routine_id);

-- ============================================================
-- SEED (exemplo) — cria 1 rotina de Iniciante (Full Body)
-- Os exercícios são ligados por NOME do catálogo `workouts`.
-- Ajuste os nomes ('Agachamento', etc.) para baterem com os
-- registros reais da sua tabela `workouts`. Linhas sem match
-- de nome são simplesmente ignoradas (INSERT ... SELECT).
-- ============================================================
DO $$
DECLARE
  v_routine uuid;
BEGIN
  INSERT INTO public.suggested_routines
    (fitness_level_id, name_pt, name_en, emoji, muscle_focus, frequency_per_week, est_minutes, is_featured, sort_order)
  VALUES
    (1, 'Full Body Iniciante', 'Beginner Full Body', '🏋️', 'full_body', 3, 40, true, 1)
  RETURNING id INTO v_routine;

  INSERT INTO public.suggested_routine_exercises (suggested_routine_id, workout_id, position, sets, reps)
  SELECT v_routine, w.id, x.position, x.sets, x.reps
  FROM (VALUES
    ('Agachamento',      1, 3, '12'),
    ('Supino máquina',   2, 3, '12'),
    ('Puxada',           3, 3, '12')
  ) AS x(name, position, sets, reps)
  JOIN public.workouts w ON w.name = x.name;
END $$;