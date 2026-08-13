-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-08-12 — Capa (poster) dos flows em vídeo
--
-- Um flow em vídeo pesa alguns MB; até o primeiro frame decodificar, o viewer
-- mostrava tela preta com spinner. Agora o app extrai o 1º frame no momento do
-- post (JPEG ~720px, algumas dezenas de KB), sobe junto com o clipe e guarda a
-- URL aqui. O viewer pinta essa imagem instantaneamente (atributo `poster` do
-- <video>) enquanto o clipe ainda baixa.
--
-- Só se aplica a flows de vídeo — imagens continuam com poster_url null.
-- O app degrada sozinho se esta migração não tiver sido rodada (selectFlow cai
-- para o conjunto de colunas sem poster_url), então não há pressa/quebra.
--
-- Rodar no Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.flow
  add column if not exists poster_url text;

comment on column public.flow.poster_url is
  'Capa do flow em vídeo: JPEG do 1º frame (~720px). Exibida enquanto o clipe carrega.';
