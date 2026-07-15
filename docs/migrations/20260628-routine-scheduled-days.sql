-- ============================================================
-- Migration: Add scheduled_days to routine item tables (2026-06-28)
-- ============================================================
-- scheduled_days stores the weekdays a routine should run/notify, as a
-- comma-separated list of Monday-first indices (0=Mon … 6=Sun), e.g. "0,2,4".
-- NULL or empty = every day (daily reminder, backward-compatible default).

ALTER TABLE user_workouts
  ADD COLUMN IF NOT EXISTS scheduled_days text;

ALTER TABLE user_diets
  ADD COLUMN IF NOT EXISTS scheduled_days text;

ALTER TABLE user_habits
  ADD COLUMN IF NOT EXISTS scheduled_days text;
