-- ============================================================
-- Migration: Add is_completed / completed_at to user_diets and user_habits (2026-03-28)
-- ============================================================

-- user_diets
ALTER TABLE user_diets
  ADD COLUMN IF NOT EXISTS is_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- user_habits
ALTER TABLE user_habits
  ADD COLUMN IF NOT EXISTS is_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;
