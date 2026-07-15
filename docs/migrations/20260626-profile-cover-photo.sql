-- ============================================================
-- Migration: Profile Cover Photo (2026-06-26)
-- Adds an optional cover/banner photo to the profile header.
-- When set, it replaces the default colored gradient banner on
-- the Profile screen. Nullable — null means "use the gradient".
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cover_photo text;
