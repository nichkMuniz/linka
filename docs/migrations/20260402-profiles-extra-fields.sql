-- ============================================================
-- Migration: Profile Extra Fields + handle_new_user rewrite (2026-04-02)
-- Adds missing columns to profiles and rewrites the trigger
-- function so that bio, photo, objectives, gender, height,
-- weight, age and handle are populated on account creation.
-- ============================================================

-- 1. Add missing columns to profiles (idempotent)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS handle  text,
  ADD COLUMN IF NOT EXISTS gender  text,
  ADD COLUMN IF NOT EXISTS age     integer,
  ADD COLUMN IF NOT EXISTS height  numeric,
  ADD COLUMN IF NOT EXISTS weight  numeric;

-- 2. Rewrite handle_new_user
--    Reads every field from NEW.raw_user_meta_data so the
--    client only needs to pass them in the signUp options.data.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta        jsonb := NEW.raw_user_meta_data;
  v_email       text  := NEW.email;
  v_email_prefix text;
  v_nickname    text;
  v_handle      text;
  v_photo       text;
  v_bio         text;
  v_objectives  text[];
  v_gender      text;
  v_age         integer;
  v_height      numeric;
  v_weight      numeric;
BEGIN
  -- Derive display fields from metadata or email fallback
  v_email_prefix := split_part(v_email, '@', 1);

  v_nickname := COALESCE(
    NULLIF(trim(v_meta->>'full_name'), ''),
    v_email_prefix,
    'Você'
  );

  v_handle := COALESCE(
    NULLIF(trim(lower(
      regexp_replace(
        regexp_replace(v_meta->>'handle', '@', '', 'g'),
        '[^a-z0-9._-]', '', 'g'
      )
    )), ''),
    v_email_prefix
  );
  -- Prefix with @ if not already present
  IF v_handle IS NOT NULL AND left(v_handle, 1) <> '@' THEN
    v_handle := '@' || v_handle;
  END IF;

  v_photo := NULLIF(trim(COALESCE(v_meta->>'avatar_url', '')), '');
  v_bio   := NULLIF(trim(COALESCE(v_meta->>'bio', '')), '');

  -- objectives is stored as a JSON array in metadata: ["fitness","cardio"]
  IF v_meta ? 'objectives' AND jsonb_typeof(v_meta->'objectives') = 'array' THEN
    SELECT array_agg(el::text)
      INTO v_objectives
      FROM jsonb_array_elements_text(v_meta->'objectives') AS el;
  END IF;

  v_gender := NULLIF(trim(COALESCE(v_meta->>'gender', '')), '');

  IF v_meta ? 'age' THEN
    BEGIN v_age := (v_meta->>'age')::integer; EXCEPTION WHEN others THEN v_age := NULL; END;
  END IF;

  IF v_meta ? 'height' THEN
    BEGIN v_height := (v_meta->>'height')::numeric; EXCEPTION WHEN others THEN v_height := NULL; END;
  END IF;

  IF v_meta ? 'weight' THEN
    BEGIN v_weight := (v_meta->>'weight')::numeric; EXCEPTION WHEN others THEN v_weight := NULL; END;
  END IF;

  INSERT INTO public.profiles (
    user_id,
    nickname,
    handle,
    photo,
    bio,
    objectives,
    gender,
    age,
    height,
    weight,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    v_nickname,
    v_handle,
    v_photo,
    v_bio,
    v_objectives,
    v_gender,
    v_age,
    v_height,
    v_weight,
    now(),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    nickname   = COALESCE(EXCLUDED.nickname,   profiles.nickname),
    handle     = COALESCE(EXCLUDED.handle,     profiles.handle),
    photo      = COALESCE(EXCLUDED.photo,      profiles.photo),
    bio        = COALESCE(EXCLUDED.bio,        profiles.bio),
    objectives = COALESCE(EXCLUDED.objectives, profiles.objectives),
    gender     = COALESCE(EXCLUDED.gender,     profiles.gender),
    age        = COALESCE(EXCLUDED.age,        profiles.age),
    height     = COALESCE(EXCLUDED.height,     profiles.height),
    weight     = COALESCE(EXCLUDED.weight,     profiles.weight),
    updated_at = now();

  RETURN NEW;
END;
$$;

-- 3. Make sure the trigger is bound (recreate to be safe)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
