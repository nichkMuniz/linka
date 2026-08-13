-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-08-12 — Duração real do flow em vídeo (sincronia da barra de progresso)
--
-- Por que existe:
--   O MediaRecorder do iOS grava MP4 FRAGMENTADO, cujo cabeçalho não traz a
--   duração. No viewer, `video.duration` fica `Infinity` até o arquivo INTEIRO
--   ser baixado — então a barra de progresso ficava parada em 0 sempre que o
--   usuário pulava para o próximo flow antes de o clipe terminar de baixar
--   (o 1º flow "funcionava" só porque dava tempo de baixar enquanto era visto).
--
--   O truque de seek que resolvia isso (`currentTime = 1e101`) força justamente
--   o download completo — caro no viewer, barato no momento do post, onde o
--   arquivo ainda é local. Então a duração passa a ser medida no cliente ao
--   postar e guardada aqui; o viewer lê o valor e sincroniza a barra desde o
--   primeiro frame, sem depender do download.
--
-- Só se aplica a flows de vídeo — imagens e texto ficam com duration_ms null.
-- Flows JÁ POSTADOS continuam sem o valor e caem no caminho antigo (seek-trick);
-- como flows expiram em 24h, isso se resolve sozinho em um dia.
--
-- O app degrada sozinho se esta migração não tiver sido rodada (selectFlow cai
-- de DURATION para POSTER), então não há quebra — só não há sincronia.
--
-- Rodar no Supabase SQL Editor. Depende de 20260812-flow-poster.sql.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.flow
  add column if not exists duration_ms integer;

comment on column public.flow.duration_ms is
  'Duração real do vídeo em ms, medida no cliente ao postar. O viewer usa para sincronizar a barra de progresso sem esperar o clipe inteiro baixar (MP4 fragmentado reporta duration = Infinity).';
