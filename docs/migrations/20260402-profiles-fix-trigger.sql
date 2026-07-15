-- ============================================================
-- Fix: handle_new_user crash (2026-04-02)
-- ON CONFLICT (user_id) requires a unique constraint.
-- Add it if missing, then simplify the trigger to plain INSERT.
-- ============================================================

-- 1. Add unique constraint on user_id (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'u'
      AND conname = 'profiles_user_id_key'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
  END IF;
END;
$$;

-- 2. Rewrite handle_new_user with correct ON CONFLICT target
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta        jsonb    := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_email       text     := COALESCE(NEW.email, '');
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
  v_email_prefix := split_part(v_email, '@', 1);

  v_nickname := COALESCE(
    NULLIF(trim(v_meta->>'full_name'), ''),
    NULLIF(v_email_prefix, ''),
    'Você'
  );

  v_handle := COALESCE(
    NULLIF(trim(lower(
      regexp_replace(
        regexp_replace(COALESCE(v_meta->>'handle', ''), '@', '', 'g'),
        '[^a-z0-9._-]', '', 'g'
      )
    )), ''),
    NULLIF(v_email_prefix, '')
  );
  IF v_handle IS NOT NULL AND left(v_handle, 1) <> '@' THEN
    v_handle := '@' || v_handle;
  END IF;

  v_photo := NULLIF(trim(COALESCE(v_meta->>'avatar_url', '')), '');
  v_bio   := NULLIF(trim(COALESCE(v_meta->>'bio', '')), '');

  IF jsonb_typeof(v_meta->'objectives') = 'array' THEN
    SELECT array_agg(el::text)
      INTO v_objectives
      FROM jsonb_array_elements_text(v_meta->'objectives') AS el;
  END IF;

  v_gender := NULLIF(trim(COALESCE(v_meta->>'gender', '')), '');

  BEGIN v_age    := (v_meta->>'age')::integer;    EXCEPTION WHEN others THEN v_age    := NULL; END;
  BEGIN v_height := (v_meta->>'height')::numeric;  EXCEPTION WHEN others THEN v_height := NULL; END;
  BEGIN v_weight := (v_meta->>'weight')::numeric;  EXCEPTION WHEN others THEN v_weight := NULL; END;

  INSERT INTO public.profiles (
    user_id, nickname, handle, photo, bio,
    objectives, gender, age, height, weight,
    created_at, updated_at
  ) VALUES (
    NEW.id, v_nickname, v_handle, v_photo, v_bio,
    v_objectives, v_gender, v_age, v_height, v_weight,
    now(), now()
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

-- 3. Recreate trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
