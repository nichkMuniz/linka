-- ============================================================================
-- Migration: 20261001 — exercício "Caminhada ao Ar Livre" (GPS)
--
-- Cria a caminhada no catálogo `workouts`, irmã da "Corrida ao Ar Livre"
-- (451eea08-…): grupo Cardio, mesmo `type`, sem dono (catálogo global).
--
-- O modo GPS NÃO depende do id: o app reconhece a atividade pelo NOME
-- normalizado PT/EN (`isOutdoorGps` em workout-session-dialog.tsx), porque o
-- nome chega localizado via `pickLocalized`. Por isso `name`/`name_eng` têm
-- que ficar exatamente "Caminhada ao Ar Livre" / "Outdoor Walking" — renomear
-- aqui desliga o GPS do exercício.
--
-- Foto: fica NULL até subir a imagem em `exercises/manual/<id>.jpg` (mesmo
-- padrão da corrida — ver docs de imagens do catálogo). Sem foto o card usa o
-- fallback do app.
--
-- Reexecutável (`on conflict do nothing`).
-- Rodar no SQL Editor do Supabase.
-- ============================================================================

insert into public.workouts (
  id, name, name_eng, description, description_eng,
  photo, muscle_group, equipment, type, created_by_user, created_by
) values (
  '315e9a11-2a3d-413e-8a37-cbd0890847d9',
  'Caminhada ao Ar Livre',
  'Outdoor Walking',
  'Caminhada em ritmo contínuo na rua, no parque ou na pista. O GPS do celular registra distância, tempo, ritmo por km e o trajeto — mesmo com a tela bloqueada.',
  'Continuous-pace walk on the street, in the park or on a track. Your phone''s GPS records distance, time, pace per km and the route — even with the screen locked.',
  null,
  'Cardio',
  null,
  2,
  false,
  null
)
on conflict (id) do nothing;

-- ─── Conferência ────────────────────────────────────────────────────────────
--   select id, name, name_eng, muscle_group, type from public.workouts
--    where id in ('451eea08-8a29-4c8c-b7b3-5ce93bcca08f', '315e9a11-2a3d-413e-8a37-cbd0890847d9');
