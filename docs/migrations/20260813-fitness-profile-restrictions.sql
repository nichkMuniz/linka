-- ═══════════════════════════════════════════════════════════════════════════
-- Restrições articulares no perfil fitness (13/08/2026)
--
-- O quiz de "Sugerido pelo app" passou a perguntar quais articulações estão em
-- cuidado (joelho, ombro, lombar, punho). Elas VETAM exercícios no gerador de
-- programa (client/lib/coach-profile.ts + program-generator.ts), então precisam
-- persistir junto com o resto das respostas para pré-preencher a próxima
-- criação de rotina.
--
-- Formato: CSV de códigos ("knee,lower_back"), igual ao já usado em
-- `training_days`. Não vira tabela própria porque não há consulta por restrição
-- — o dado só é lido inteiro, junto com o perfil.
--
-- O app degrada graciosamente enquanto esta migração não roda (detecta 42703 e
-- reenvia sem a coluna), mas as restrições só passam a persistir depois dela.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.user_fitness_profile
  add column if not exists restrictions text;

comment on column public.user_fitness_profile.restrictions is
  'Articulações em cuidado, CSV: knee, shoulder, lower_back, wrist. Vetam exercícios no gerador de rotina sugerida.';
