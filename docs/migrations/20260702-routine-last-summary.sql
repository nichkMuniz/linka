-- ============================================================
-- Migration: last_summary on routines (2026-07-02)
-- ============================================================
-- Stores a JSON snapshot of the most recently finished workout for a routine
-- (stats + exercises, same shape as WorkoutSummaryData minus userId/userGroups,
-- which are re-resolved at view time). Overwritten on every "Finalizar" —
-- there is only ever one snapshot per routine, always the latest. Used to gate
-- and populate the "resumo do treino" icon in the routine detail drawer: the
-- icon only shows when this column is non-null.

ALTER TABLE routines
  ADD COLUMN IF NOT EXISTS last_summary jsonb;
