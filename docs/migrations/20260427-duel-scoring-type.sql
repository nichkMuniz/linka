-- Add scoring_type and meme_rule to duel_groups
ALTER TABLE duel_groups
  ADD COLUMN IF NOT EXISTS scoring_type text NOT NULL DEFAULT 'check_in_count';

ALTER TABLE duel_groups
  ADD COLUMN IF NOT EXISTS meme_rule text;

-- Add metric columns to duel_check_ins
ALTER TABLE duel_check_ins
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS distance_km numeric(8,2),
  ADD COLUMN IF NOT EXISTS steps integer,
  ADD COLUMN IF NOT EXISTS calories integer;

-- Votes table for "memes" scoring mode
CREATE TABLE IF NOT EXISTS duel_check_in_votes (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  check_in_id uuid NOT NULL REFERENCES duel_check_ins(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type   text NOT NULL CHECK (vote_type IN ('classify', 'disqualify')),
  created_at  timestamptz DEFAULT now(),
  UNIQUE (check_in_id, user_id)
);

ALTER TABLE duel_check_in_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage their own votes"
  ON duel_check_in_votes FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read votes"
  ON duel_check_in_votes FOR SELECT
  USING (true);
