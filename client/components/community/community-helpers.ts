import type { TranslationKey } from "@/lib/i18n";
import type { DuelScoringType } from "@/lib/ritmofit-db";

// Helpers e constantes puros da tela de Comunidade, extraídos de `Community.tsx`
// para reduzir o tamanho do arquivo monolítico. Nenhum estado/efeito aqui — só
// funções puras e dados estáticos.

export type ViewMode = "conversations" | "conversation";

// Mensagens especiais são codificadas com prefixo no texto ([audio]:, [image]:,
// [post]:, [shot]:). Em previews (lista de conversas, quote de reply, banner de
// resposta) exibimos um rótulo curto em vez do texto bruto.
export function specialMessageLabel(
  text: string | null | undefined,
  t: (key: TranslationKey) => string,
): string | null {
  if (!text) return null;
  if (text.startsWith("[audio]:")) return `🎤 ${t("community_msg_audio_label")}`;
  if (text.startsWith("[image]:")) return `🖼️ ${t("community_msg_image_label")}`;
  if (text.startsWith("[post]:")) return `📤 ${t("community_msg_post_label")}`;
  if (text.startsWith("[shot]:")) return `🎬 ${t("community_msg_shot_label")}`;
  return null;
}

// Fallback photo for check-ins posted without a photo, so the card/detail
// never renders with an empty image slot.
export const DEFAULT_CHECKIN_PHOTO = "/Monstrinho_segurando_pesinho_202603301834.jpeg";

export const DUEL_SCORING_TYPE_OPTIONS: { value: DuelScoringType; icon: string; titleKey: TranslationKey; descKey: TranslationKey }[] = [
  { value: "check_in_count", icon: "#", titleKey: "duels_scoring_check_in_count", descKey: "duels_scoring_check_in_count_desc" },
  { value: "active_days", icon: "📅", titleKey: "duels_scoring_active_days", descKey: "duels_scoring_active_days_desc" },
  { value: "hustle_points", icon: "⭐", titleKey: "duels_scoring_hustle_points", descKey: "duels_scoring_hustle_points_desc" },
  { value: "duration", icon: "⏱", titleKey: "duels_scoring_duration", descKey: "duels_scoring_duration_desc" },
  { value: "distance", icon: "🗺", titleKey: "duels_scoring_distance", descKey: "duels_scoring_distance_desc" },
  { value: "steps", icon: "👟", titleKey: "duels_scoring_steps", descKey: "duels_scoring_steps_desc" },
  { value: "calories", icon: "🔥", titleKey: "duels_scoring_calories", descKey: "duels_scoring_calories_desc" },
  { value: "memes", icon: "🎭", titleKey: "duels_scoring_memes", descKey: "duels_scoring_memes_desc" },
];

export function formatTimeAgo(date: string): string {
  const now = new Date();
  const msgTime = new Date(date);
  const diffMs = now.getTime() - msgTime.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "agora";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return msgTime.toLocaleDateString("pt-BR", {
    month: "short",
    day: "numeric",
  });
}
