-- ============================================================
-- Migration: Profile Privacy (2026-06-26)
-- Adiciona preferências de privacidade ao perfil:
--   * hide_follow_lists: oculta as listas de seguidores/seguindo
--     de outros usuários (ainda visíveis para o próprio dono).
--   * hide_posts_from_non_followers: oculta os posts do perfil
--     para usuários que não seguem o dono.
-- Ambos default false (comportamento atual = tudo público).
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hide_follow_lists boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_posts_from_non_followers boolean NOT NULL DEFAULT false;

-- Observação: a aplicação faz o gating no cliente (Profile.tsx), de
-- forma consistente com o filtro de visibilidade das metas. Para um
-- reforço a nível de banco, considere políticas RLS que validem o
-- relacionamento de follow antes de retornar os posts.
