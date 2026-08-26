/** Constantes compartilhadas da aba Duelos. */

// Histórico do grupo — paginação de renderização (o fetch traz tudo).
export const CHECKINS_INITIAL_COUNT = 50;
export const CHECKINS_PAGE_SIZE = 10;
/** Distância do fim da rolagem que dispara a revelação do próximo lote. */
export const CHECKINS_LOAD_MORE_OFFSET = 320;

/** Grupo do banco → card do carrossel de duelos. */
export const toGroupCard = (group: any) => ({
  ...group,
  icon: "⚔️",
  description: group.goal,
  city: group.location,
  isOfficial: false,
});
