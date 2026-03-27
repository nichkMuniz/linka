-- ============================================================
-- Migration: Community Features (2026-03-27)
-- Tables needed for: check-in comments, check-in emoji reactions
-- ============================================================

-- 1. Comments on group check-ins
CREATE TABLE IF NOT EXISTS duel_check_in_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_in_id uuid NOT NULL REFERENCES duel_check_ins(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  text        text NOT NULL CHECK (char_length(text) <= 500),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS duel_check_in_comments_check_in_id ON duel_check_in_comments(check_in_id);
CREATE INDEX IF NOT EXISTS duel_check_in_comments_user_id ON duel_check_in_comments(user_id);

-- RLS
ALTER TABLE duel_check_in_comments ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read comments
CREATE POLICY "read_check_in_comments" ON duel_check_in_comments
  FOR SELECT USING (auth.role() = 'authenticated');

-- Authenticated users can insert their own comments
CREATE POLICY "insert_check_in_comments" ON duel_check_in_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "delete_own_check_in_comments" ON duel_check_in_comments
  FOR DELETE USING (auth.uid() = user_id);

-- 2. Emoji reactions on group check-ins (one emoji per user per check-in)
CREATE TABLE IF NOT EXISTS duel_check_in_reactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_in_id uuid NOT NULL REFERENCES duel_check_ins(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  emoji       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (check_in_id, user_id)
);

CREATE INDEX IF NOT EXISTS duel_check_in_reactions_check_in_id ON duel_check_in_reactions(check_in_id);

ALTER TABLE duel_check_in_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_check_in_reactions" ON duel_check_in_reactions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "upsert_check_in_reactions" ON duel_check_in_reactions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
