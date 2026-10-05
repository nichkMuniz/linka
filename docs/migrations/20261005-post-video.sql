-- ============================================================================
-- Migration: 20261005 — post em vídeo no feed
--
-- Enquanto Shots está guardado (FEATURES.shots = false), o vídeo entra no feed
-- como um POST comum: mesmas curtidas/incentivos, comentários, marcações, meta
-- vinculada e repost. Um post é até 5 fotos OU 1 vídeo (até 60 s).
--
-- Colunas:
--   * `video_url` (NOVA) — URL pública do vídeo no bucket `posts`, em
--     `{uid}/videos/{timestamp}.{ext}` (1080p, comprimido no aparelho).
--   * `photo` (já existia) — num post em vídeo guarda a CAPA: o 1º frame
--     recortado em 1:1, `{uid}/{timestamp}-poster.jpg`. É o que a grade do
--     perfil, as notificações, o compartilhamento e os BUILDS ANTIGOS (que não
--     pedem `video_url`) mostram — para eles o post aparece como foto.
--
-- Sem policy nova: `posts` já tem RLS por linha, e a coluna herda.
--
-- ORDEM: rodar esta migração ANTES de distribuir o build novo. O app tolera a
-- coluna ausente na LEITURA (cai para as colunas antigas), mas publicar um
-- post em vídeo sem ela falha com "column video_url does not exist".
--
-- Reexecutável.
-- ============================================================================

alter table public.posts
  add column if not exists video_url text;

comment on column public.posts.video_url is
  'Post em vídeo (2026-10-05): URL do arquivo no bucket posts. Quando preenchida, `photo` é a capa (1º frame, 1:1).';

-- Conferência:
--   select count(*) filter (where video_url is not null) as posts_em_video,
--          count(*) as posts
--     from public.posts;
