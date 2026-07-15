-- ============================================================
-- Migration: duel_check_ins.muscle_groups (2026-07-02)
-- ============================================================
-- Motivo: o check-in de duelo só guardava UM grupo muscular
-- (muscle_group), o mais frequente entre os exercícios da sessão.
-- Um treino de Perna + Ombro, por exemplo, aparecia sem nenhuma tag
-- de Ombro no histórico. `muscle_groups` guarda todos os grupos
-- distintos trabalhados na sessão; `muscle_group` é mantido como
-- está (grupo principal / mais frequente) para compatibilidade.
--
-- Rodar no Supabase (SQL Editor) de uma vez. Idempotente.

ALTER TABLE duel_check_ins
  ADD COLUMN IF NOT EXISTS muscle_groups text[];

-- Backfill: deriva a lista a partir do JSON já salvo em `exercises`
-- (cada exercício tem seu próprio `muscleGroup`); se `exercises` estiver
-- vazio/nulo, cai para o `muscle_group` legado como array de 1 item.
UPDATE duel_check_ins
SET muscle_groups = COALESCE(
  (
    SELECT array_agg(DISTINCT elem->>'muscleGroup')
    FROM jsonb_array_elements(
      CASE
        WHEN exercises IS NULL OR exercises = '' THEN '[]'::jsonb
        ELSE exercises::jsonb
      END
    ) AS elem
    WHERE elem->>'muscleGroup' IS NOT NULL AND elem->>'muscleGroup' <> ''
  ),
  CASE WHEN muscle_group IS NOT NULL THEN ARRAY[muscle_group] ELSE NULL END
)
WHERE muscle_groups IS NULL;
