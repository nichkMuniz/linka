-- Migration: Remove trigger that awards badges on check_in insert (2026-04-22)
--
-- The trigger "award_badges_on_checkin" was inserting into user_badges without
-- ON CONFLICT DO NOTHING, causing a 23505 unique constraint violation whenever
-- a user already owned the badge. This rolled back the check_in insert entirely.
--
-- The badge awarding logic already lives in the client (awardBadgesForCheckInsDb),
-- so the trigger is redundant and harmful. We drop it here.

DROP TRIGGER IF EXISTS award_badges_on_checkin ON check_ins;
DROP FUNCTION IF EXISTS award_badges_on_checkin_fn();

-- If the trigger had a different name, cover common variants:
DROP TRIGGER IF EXISTS on_checkin_award_badges ON check_ins;
DROP TRIGGER IF EXISTS checkin_award_badges ON check_ins;
DROP FUNCTION IF EXISTS on_checkin_award_badges_fn();
DROP FUNCTION IF EXISTS checkin_award_badges_fn();
