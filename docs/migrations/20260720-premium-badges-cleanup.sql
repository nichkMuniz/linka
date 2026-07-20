-- ============================================================
-- Limpeza: insígnias premium concedidas indevidamente (2026-07-20)
-- ============================================================
-- BUG: `awardBadgesForCheckInsDb`/`awardNutritionBadgesDb` inseriam em
-- `user_badges` SEM checar `badges.premium`. As 2 insígnias premium
-- (`premium_diamante`, `premium_coroa`) são `checkin_total` com
-- `required_checkins = 0`, então QUALQUER check-in as liberava para todo mundo.
-- O código foi corrigido (gate por `is_premium`); isto remove o que já vazou.
--
-- Em 20/07/2026 havia 8 linhas (4 usuários) com essas insígnias.
--
-- Remove só de quem NÃO é assinante ativo — a mesma condição de `is_premium`.
-- Um assinante que legitimamente exibe a insígnia mantém a linha.
--
-- ⚠️ Apaga dado de user_badges (o acervo). Rode o SELECT primeiro.
-- Idempotente.
-- ============================================================

-- ── 1. CONFERIR (não apaga) — linhas premium de quem não é assinante ativo ──
SELECT ub.user_id, b.key, b.name
FROM user_badges ub
JOIN badges b ON b.id = ub.badge_id
WHERE b.premium = true
  AND NOT is_premium(ub.user_id)
ORDER BY ub.user_id;

-- ── 2. APAGAR (descomente para executar) ──
-- Também limpa profiles.selected_badge_id de quem exibia uma premium indevida,
-- senão a coluna apontaria para uma insígnia que saiu do acervo.

-- UPDATE profiles p
-- SET selected_badge_id = NULL
-- WHERE p.selected_badge_id IN (SELECT id FROM badges WHERE premium = true)
--   AND NOT is_premium(p.user_id);

-- DELETE FROM user_badges ub
-- USING badges b
-- WHERE b.id = ub.badge_id
--   AND b.premium = true
--   AND NOT is_premium(ub.user_id);

-- ── 3. Conferir de novo (o SELECT do passo 1 deve voltar 0 linhas) ──
