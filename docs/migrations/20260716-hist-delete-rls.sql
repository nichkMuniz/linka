-- ============================================================
-- Migration: permitir DELETE do próprio histórico (2026-07-16)
-- ============================================================
-- BUG: apagar uma rotina NÃO apagava os registros históricos.
--
-- DIAGNÓSTICO (verificado no banco em 16/07/2026):
--   `deleteRoutineCardDb` já apagava o histórico ANTES dos itens, mas as três
--   tabelas `*_hist` têm RLS ligada e (aparentemente) sem política de DELETE.
--   Sob RLS, um DELETE que não casa com nenhuma linha permitida **não é erro**:
--   volta 200 com 0 linhas afetadas. Ou seja, o delete virava um no-op SILENCIOSO
--   (o código ainda por cima só fazia console.error).
--
--   Em seguida o delete dos itens rodava e, como a FK do histórico é
--   ON DELETE SET NULL (não CASCADE), `user_workout_id` — e `routine_id`, ao
--   apagar a linha em `routines` — viravam NULL. Resultado: o histórico
--   SOBREVIVIA, agora sem vínculo nenhum e impossível de apagar depois.
--
-- EVIDÊNCIA: em `user_workouts_hist`, 66 de 91 linhas estavam com
--   `user_workout_id` E `routine_id` NULL — e o agrupamento por sessão deu
--   **7 sessões inteiras** sem vínculo e **0 sessões mistas**. Se a causa fossem
--   exercícios avulsos, haveria sessões mistas (item da rotina vinculado +
--   avulso sem vínculo). Sessões inteiras = a rotina foi apagada depois.
--
-- Rodar no Supabase (SQL Editor). Idempotente.
-- ============================================================

-- ── user_workouts_hist ──
ALTER TABLE public.user_workouts_hist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workouts_hist_delete_own" ON public.user_workouts_hist;
CREATE POLICY "workouts_hist_delete_own" ON public.user_workouts_hist
  FOR DELETE USING (auth.uid() = user_id);

-- ── user_diets_hist ──
ALTER TABLE public.user_diets_hist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "diets_hist_delete_own" ON public.user_diets_hist;
CREATE POLICY "diets_hist_delete_own" ON public.user_diets_hist
  FOR DELETE USING (auth.uid() = user_id);

-- ── user_habits_hist ──
ALTER TABLE public.user_habits_hist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "habits_hist_delete_own" ON public.user_habits_hist;
CREATE POLICY "habits_hist_delete_own" ON public.user_habits_hist
  FOR DELETE USING (auth.uid() = user_id);

-- ── Conferência: as políticas de DELETE existem? ──
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE tablename IN ('user_workouts_hist','user_diets_hist','user_habits_hist')
-- ORDER BY tablename, cmd;

-- ── Conferência: as FKs são SET NULL ou CASCADE? ──
-- (Se forem CASCADE, o histórico já sairia junto com o item e este bug não
--  existiria. O comportamento observado indica SET NULL.)
-- SELECT tc.table_name, kcu.column_name, rc.delete_rule
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
-- JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND tc.table_name IN ('user_workouts_hist','user_diets_hist','user_habits_hist');
