-- Create the exercises bucket for storing exercise images locally
-- This avoids dependency on the external wger.de API for images

INSERT INTO storage.buckets (id, name, public)
VALUES ('exercises', 'exercises', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public read access for exercises"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'exercises');

-- Allow authenticated users to upload (needed during catalog sync)
CREATE POLICY "Authenticated upload for exercises"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'exercises');

-- Allow authenticated users to update/upsert
CREATE POLICY "Authenticated update for exercises"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'exercises');
