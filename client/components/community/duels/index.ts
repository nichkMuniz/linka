/**
 * Aba **Duelos** da Comunidade — o maior domínio da tela.
 *
 * - `useDuels` — dono do estado: grupos, vista do grupo, check-ins, votos,
 *   comentários, reações, participantes, convites e solicitações.
 * - `DuelsTab` — a lista de duelos (seus e disponíveis).
 * - `DuelGroupView` — a vista de um duelo em tela cheia (portal).
 * - `DuelsOverlays` — todos os drawers, modais e confirmações.
 */
export { useDuels, type DuelsController } from "./use-duels";
export { DuelsTab } from "./duels-tab";
export { DuelGroupView } from "./duel-group-view";
export { DuelsOverlays } from "./duels-overlays";
