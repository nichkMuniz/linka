-- ============================================================
-- Migration: workout_summary on posts (2026-07-06)
-- ============================================================
-- Stores a structured JSON snapshot of the finished workout when a "resumo do
-- treino" is shared to the feed (routine name, duration, series, volume, and the
-- exercise list with per-set kg × reps). Until now this data was only "baked"
-- into the generated canvas image + auto-generated caption and was therefore
-- impossible to display precisely. With this column, a workout-summary post
-- becomes clickable ("Ver treino" pill) and opens a detail modal listing the
-- exact exercises / loads / reps.
--
-- Shape matches PostWorkoutSummary (client/lib/workout-summary-types.ts).
-- Nullable — regular image/text posts leave it NULL (no pill shown). Inherits
-- the existing RLS policies of the posts table (no policy change needed).

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS workout_summary jsonb;
