-- ============================================================
-- Limpeza: histórico órfão deixado pelo bug do DELETE (2026-07-16)
-- ============================================================
-- Rodar DEPOIS de `20260716-hist-delete-rls.sql` (que corrige a causa).
--
-- O QUE SÃO ESSAS LINHAS: registros de rotinas que o usuário JÁ apagou. O delete
-- do histórico virava no-op silencioso (RLS sem política de DELETE) e, quando o
-- item/rotina saíam, as FKs ON DELETE SET NULL zeravam os vínculos. Sobrou
-- histórico sem `user_workout_id` e sem `routine_id` — invisível para qualquer
-- delete futuro, porque não dá mais para saber a que rotina pertencia.
--
-- ⚠️ APAGA DADO DO USUÁRIO, E NÃO DÁ PARA DESFAZER. Rode o SELECT primeiro.
-- ⚠️ Em 16/07/2026 isto atingia 66 linhas de `user_workouts_hist` (7 sessões);
--    `user_diets_hist` e `user_habits_hist` estavam limpos (0 linhas afetadas).
--
-- Estas linhas ainda aparecem no histórico/gráficos de progressão do usuário.
-- Se preferir MANTER o histórico de rotinas apagadas, NÃO rode este arquivo —
-- ele existe porque o pedido foi "apagar a rotina apaga os registros".
-- ============================================================

-- ── 1. CONFERIR ANTES (não apaga nada) ──
SELECT 'user_workouts_hist' AS tabela, count(*) AS orfaos
FROM user_workouts_hist
WHERE user_workout_id IS NULL AND routine_id IS NULL
UNION ALL
SELECT 'user_diets_hist', count(*)
FROM user_diets_hist
WHERE user_diet_id IS NULL
UNION ALL
SELECT 'user_habits_hist', count(*)
FROM user_habits_hist
WHERE user_habit_id IS NULL;

-- ── 2. APAGAR (descomente para executar) ──
-- Só linhas SEM QUALQUER vínculo: as que ainda apontam para um item vivo são
-- histórico legítimo de rotina existente e não podem ser tocadas.

-- DELETE FROM user_workouts_hist
-- WHERE user_workout_id IS NULL AND routine_id IS NULL;

-- DELETE FROM user_diets_hist
-- WHERE user_diet_id IS NULL;

-- DELETE FROM user_habits_hist
-- WHERE user_habit_id IS NULL;

-- ── 3. Conferir de novo (o SELECT do passo 1 deve voltar 0 em tudo) ──
