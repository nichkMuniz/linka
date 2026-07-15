-- ============================================================================
-- Migration: 20260714 — Insígnia selecionada persistente
--
-- PROBLEMA
-- A tabela `user_badges` estava servindo a dois propósitos conflitantes:
--   1. acervo de insígnias CONQUISTADAS (awardBadgesForCheckInsDb insere linhas);
--   2. insígnia SELECIONADA (setSelectedBadgeDb apagava TODAS as linhas do
--      usuário e inseria só a escolhida).
-- Como a insígnia exibida era "a de maior sort_order entre as linhas", escolher
-- uma insígnia mais baixa apagava o acervo, e no check-in seguinte o awarding
-- reconquistava tudo que o usuário ainda satisfazia — a insígnia de maior
-- sort_order voltava e a escolha do usuário era sobrescrita sozinha
-- ("a badge muda quando vira o dia").
--
-- SOLUÇÃO
-- Separar os dois conceitos:
--   • user_badges          → acervo. Só cresce. Nunca é apagado.
--   • profiles.selected_badge_id → escolha do usuário. Só muda quando ELE troca.
-- A insígnia exibida passa a ser selected_badge_id (se conquistada), com
-- fallback para a de maior sort_order do acervo quando nunca houve escolha.
--
-- Rodar no SQL Editor do Supabase.
-- ============================================================================

-- ─── 1. profiles.selected_badge_id ──────────────────────────────────────────

alter table public.profiles
  add column if not exists selected_badge_id uuid
  references public.badges(id) on delete set null;

-- ─── 2. Backfill da escolha ─────────────────────────────────────────────────
--
-- IMPORTANTE: roda ANTES do backfill do acervo (passo 3). A insígnia exibida
-- hoje é a de maior sort_order entre as linhas atuais de user_badges — para
-- quem já tinha escolhido manualmente, o delete deixou só a escolhida, então
-- ela é o max. Congelar esse valor agora preserva exatamente o que cada usuário
-- vê na tela hoje. Se o passo 3 rodasse antes, ele reintroduziria insígnias mais
-- altas e a escolha do usuário seria perdida de novo.

update public.profiles p
set selected_badge_id = sub.badge_id
from (
  select
    ub.user_id,
    ub.badge_id,
    row_number() over (
      partition by ub.user_id
      order by b.sort_order desc, ub.earned_at desc
    ) as rn
  from public.user_badges ub
  join public.badges b on b.id = ub.badge_id
) sub
where sub.user_id = p.user_id
  and sub.rn = 1
  and p.selected_badge_id is null;

-- ─── 3. Backfill do acervo (insígnias de check-in acumulado) ────────────────
--
-- Reconstrói as insígnias 'checkin_total' que o delete de setSelectedBadgeDb
-- apagou ao longo do tempo. As de outros tipos (streak, workout_*, …) dependem
-- de estado que não dá para recalcular em SQL puro — elas voltam sozinhas no
-- próximo check-in, quando awardBadgesForCheckInsDb reavalia as condições.
-- Agora isso é inofensivo: reconquistar não mexe mais na insígnia selecionada.

insert into public.user_badges (user_id, badge_id)
select p.user_id, b.id
from public.profiles p
join lateral (
  select count(*)::int as total
  from public.check_ins ci
  where ci.user_id = p.user_id
) c on true
join public.badges b
  on b.condition_type = 'checkin_total'
 and b.required_checkins <= c.total
on conflict (user_id, badge_id) do nothing;
