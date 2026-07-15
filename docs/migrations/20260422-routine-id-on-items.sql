-- Migration: add routine_id FK to user_workouts, user_diets, user_habits
-- Purpose: link each item directly to its routine row instead of relying on name-matching.
-- Run in Supabase SQL Editor.

ALTER TABLE user_workouts
  ADD COLUMN IF NOT EXISTS routine_id bigint REFERENCES routines(id) ON DELETE SET NULL;

ALTER TABLE user_diets
  ADD COLUMN IF NOT EXISTS routine_id bigint REFERENCES routines(id) ON DELETE SET NULL;

ALTER TABLE user_habits
  ADD COLUMN IF NOT EXISTS routine_id bigint REFERENCES routines(id) ON DELETE SET NULL;

-- Optional: index for fast lookup by routine
CREATE INDEX IF NOT EXISTS idx_user_workouts_routine_id ON user_workouts(routine_id);
CREATE INDEX IF NOT EXISTS idx_user_diets_routine_id    ON user_diets(routine_id);
CREATE INDEX IF NOT EXISTS idx_user_habits_routine_id   ON user_habits(routine_id);

-- Backfill existing rows: match items to routines by user_id + type + name.
-- user_workouts (type = 1)
UPDATE user_workouts uw
SET routine_id = r.id
FROM routines r
WHERE r.user_id = uw.user_id
  AND r.type = 1
  AND (
    (uw.name IS NULL AND r.name IS NULL) OR
    (uw.name IS NOT NULL AND r.name = uw.name)
  )
  AND uw.routine_id IS NULL;

-- user_diets (type = 2)
UPDATE user_diets ud
SET routine_id = r.id
FROM routines r
WHERE r.user_id = ud.user_id
  AND r.type = 2
  AND (
    (ud.name IS NULL AND r.name IS NULL) OR
    (ud.name IS NOT NULL AND r.name = ud.name)
  )
  AND ud.routine_id IS NULL;

-- user_habits (type = 3)
UPDATE user_habits uh
SET routine_id = r.id
FROM routines r
WHERE r.user_id = uh.user_id
  AND r.type = 3
  AND (
    (uh.name IS NULL AND r.name IS NULL) OR
    (uh.name IS NOT NULL AND r.name = uh.name)
  )
  AND uh.routine_id IS NULL;
