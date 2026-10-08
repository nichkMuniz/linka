import type { Badge, BadgeConditionType } from "@/lib/ritmofit-db";
import type { TranslationKey } from "@/lib/i18n";
import { FEATURES } from "@/lib/feature-flags";

/**
 * Insígnias v2 (2026-10-06) — o que é só de apresentação e de orquestração.
 * Quem conta e concede é o servidor (`awardMyBadgesDb` → RPC `award_my_badges`).
 */

type T = (key: TranslationKey) => string;

// ─── Texto ──────────────────────────────────────────────────────────────────
//
// O banco guarda nome/descrição só em PT. O app traduz pela CHAVE da insígnia
// (`badge_<key>_name` / `badge_<key>_desc`); insígnia sem tradução cai no texto
// do banco — uma linha nova cadastrada pelo painel aparece, mesmo que em PT.

function translated(t: T, key: string, fallback: string): string {
  const value = t(key as TranslationKey);
  return value && value !== key ? value : fallback;
}

export function badgeName(badge: Pick<Badge, "key" | "name">, t: T): string {
  return translated(t, `badge_${badge.key}_name`, badge.name);
}

export function badgeDescription(badge: Pick<Badge, "key" | "description">, t: T): string {
  return translated(t, `badge_${badge.key}_desc`, badge.description);
}

// ─── Catálogo visível ───────────────────────────────────────────────────────

export type BadgeGroup = "training" | "content" | "together" | "community";

const GROUP_OF: Record<BadgeConditionType, BadgeGroup> = {
  workouts_total: "training",
  routines_total: "training",
  posts_total: "content",
  workouts_shared: "content",
  flows_total: "content",
  party_workouts: "together",
  challenges_total: "together",
  incentives_given: "community",
  incentives_received: "community",
  comments_given: "community",
  followers_total: "community",
  following_total: "community",
};

export const BADGE_GROUPS: Array<{ id: BadgeGroup; labelKey: TranslationKey }> = [
  { id: "training", labelKey: "badges_group_training" },
  { id: "content", labelKey: "badges_group_content" },
  { id: "together", labelKey: "badges_group_together" },
  { id: "community", labelKey: "badges_group_community" },
];

export function badgeGroup(badge: Badge): BadgeGroup | null {
  return GROUP_OF[badge.condition_type] ?? null;
}

/** Feature desligada = insígnia impossível de ganhar: nem aparece. */
function conditionAvailable(condition: BadgeConditionType): boolean {
  if (condition === "party_workouts") return FEATURES.workoutParty;
  if (condition === "challenges_total") return FEATURES.workoutChallenge;
  return true;
}

/**
 * Catálogo que o app mostra: só tipos que esta versão conhece (uma cópia
 * offline antiga do catálogo v1 ainda pode trazer `checkin_*`, `nutrition_*`…)
 * e cuja feature está ligada, em ordem.
 */
export function visibleBadges(all: Badge[]): Badge[] {
  return all
    .filter((b) => b.condition_type in GROUP_OF && conditionAvailable(b.condition_type))
    .sort((a, b) => a.sort_order - b.sort_order);
}

// ─── Pedido de checagem ─────────────────────────────────────────────────────
//
// Ações que podem render insígnia (publicar post/flow, criar rotina, mandar
// incentivo, desafiar) só AVISAM que algo mudou. Quem avalia e celebra é o
// `BadgeCheckHost` do AppLayout, com debounce — assim a camada de dados não
// importa UI e uma rajada de incentivos vira uma chamada só.
//
// O fim de treino NÃO passa por aqui: Metas avalia na hora e celebra com o
// diálogo grande depois do resumo (ver `handleWorkoutFinished`).

const listeners = new Set<() => void>();

export function requestBadgeCheck(): void {
  if (!FEATURES.badges) return;
  listeners.forEach((listener) => listener());
}

export function subscribeBadgeCheckRequests(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ─── Anúncio ────────────────────────────────────────────────────────────────
//
// Insígnias recém-conquistadas para o pop up de conquista
// (`BadgeCelebrationBanner`, montado pelo `BadgeCheckHost`). Quem avaliou fora
// do host — o drawer, ao abrir — anuncia por aqui para usar o mesmo pop up.

const announceListeners = new Set<(badges: Badge[]) => void>();

export function announceBadges(badges: Badge[]): void {
  if (badges.length === 0) return;
  announceListeners.forEach((listener) => listener(badges));
}

export function subscribeBadgeAnnouncements(listener: (badges: Badge[]) => void): () => void {
  announceListeners.add(listener);
  return () => {
    announceListeners.delete(listener);
  };
}
