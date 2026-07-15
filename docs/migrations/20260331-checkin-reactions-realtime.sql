-- ============================================================
-- Migration: Enable Realtime for duel_check_in_reactions
-- Needed so all group members see reactions in real time
-- ============================================================

-- Allow Supabase Realtime to broadcast full row data on changes
ALTER TABLE duel_check_in_reactions REPLICA IDENTITY FULL;

-- Add table to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE duel_check_in_reactions;
