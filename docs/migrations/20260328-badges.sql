-- ============================================================
-- Migration: Badges / Insígnias (2026-03-28)
-- Tables: badges (catálogo), user_badges (conquistas por usuário)
-- ============================================================

-- 1. Catálogo de insígnias
CREATE TABLE IF NOT EXISTS badges (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key           text NOT NULL UNIQUE,          -- ex: 'iniciante', 'sequencia', 'campeao', 'lendario'
  name          text NOT NULL,                 -- ex: 'Iniciante'
  emoji         text NOT NULL,                 -- ex: '⭐'
  description   text NOT NULL,
  required_checkins int NOT NULL DEFAULT 0,    -- total de check-ins acumulados necessários para ganhar
  sort_order    int NOT NULL DEFAULT 0,        -- menor = mais básico
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 2. Insígnias conquistadas por usuário
CREATE TABLE IF NOT EXISTS user_badges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  badge_id    uuid NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS user_badges_user_id ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS user_badges_badge_id ON user_badges(badge_id);

-- 3. RLS
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- badges: todos autenticados podem ler o catálogo
CREATE POLICY "read_badges" ON badges
  FOR SELECT USING (auth.role() = 'authenticated');

-- user_badges: qualquer autenticado pode ver as insígnias de qualquer usuário
-- (necessário para exibir no feed sem restrição de seguimento)
CREATE POLICY "read_user_badges" ON user_badges
  FOR SELECT USING (auth.role() = 'authenticated');

-- user_badges: apenas o próprio usuário ou service role pode inserir/deletar
CREATE POLICY "insert_own_user_badges" ON user_badges
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_user_badges" ON user_badges
  FOR DELETE USING (auth.uid() = user_id);

-- 4. Seed: insígnias padrão (idempotente)
INSERT INTO badges (key, name, emoji, description, required_checkins, sort_order)
VALUES
  ('iniciante', 'Iniciante',  '⭐', '1º check-in realizado',                  1, 1),
  ('sequencia', 'Sequência',  '🔥', '3 check-ins acumulados',                 3, 2),
  ('campeao',   'Campeão',    '💪', '5 check-ins acumulados',                 5, 3),
  ('lendario',  'Lendário',   '👑', '7 check-ins acumulados',                 7, 4)
ON CONFLICT (key) DO UPDATE SET
  name              = EXCLUDED.name,
  emoji             = EXCLUDED.emoji,
  description       = EXCLUDED.description,
  required_checkins = EXCLUDED.required_checkins,
  sort_order        = EXCLUDED.sort_order;
