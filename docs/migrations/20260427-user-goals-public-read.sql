-- Allow any authenticated user to read public goals (visibility = 1)
-- Without this policy, RLS blocks reading other users' goals from the client.

CREATE POLICY "Anyone can read public goals"
  ON user_goals FOR SELECT
  USING (visibility = 1 OR auth.uid() = user_id);
