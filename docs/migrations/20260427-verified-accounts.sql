-- Migration: verified accounts badge
-- Adds is_verified flag to profiles for official/verified accounts

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

-- Only admins (service_role) can set is_verified — regular users cannot self-verify
CREATE POLICY "only_service_role_can_set_verified"
  ON profiles
  FOR UPDATE
  USING (true)
  WITH CHECK (
    -- if is_verified is being changed, reject from anon/authenticated roles
    (is_verified = (SELECT is_verified FROM profiles WHERE user_id = profiles.user_id))
    OR auth.role() = 'service_role'
  );

-- Allow all authenticated users to read is_verified (already covered by existing select policy)
