import type { TranslationKey } from "@/lib/i18n";
import type { DuelScoringType, MessageWithUser } from "@/lib/ritmofit-db";
import { parseFlowReply } from "@/lib/flow-reply";

// Helpers e constantes puros da tela de Comunidade, extraídos de `Community.tsx`
// para reduzir o tamanho do arquivo monolítico. Nenhum estado/efeito aqui — só
// funções puras e dados estáticos.

export type ViewMode = "conversations" | "conversation";

// Duas listas de mensagens representam a mesma tela? Compara só o que a bolha
// desenha (id, texto, lido, emoji). Serve para descartar a resposta da rede que
// apenas confirma o que já está renderizado — sem novo array, o React não
// remonta a lista inteira.
export function sameMessageList(a: MessageWithUser[], b: MessageWithUser[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((msg, i) => {
    const other = b[i];
    return (
      msg.id === other.id &&
      msg.text === other.text &&
      msg.read === other.read &&
      msg.emoji === other.emoji
    );
  });
}

// Mensagens especiais são codificadas com prefixo no texto ([audio]:, [image]:,
// [post]:, [shot]:, [flowreply]:). Em previews (lista de conversas, quote de reply,
// banner de resposta) exibimos um rótulo curto em vez do texto bruto.
export function specialMessageLabel(
  text: string | null | undefined,
  t: (key: TranslationKey) => string,
): string | null {
  if (!text) return null;
  // Resposta a flow: o preview mostra o TEXTO digitado (é o que interessa na lista
  // de conversas), com o ícone sinalizando de onde veio. Só cai no rótulo genérico
  // se a resposta vier vazia.
  const flowReply = parseFlowReply(text);
  if (flowReply) {
    const body = flowReply.text.trim();
    return `🎞️ ${body || t("community_msg_flow_reply_label")}`;
  }
  if (text.startsWith("[audio]:")) return `🎤 ${t("community_msg_audio_label")}`;
  if (text.startsWith("[image]:")) return `🖼️ ${t("community_msg_image_label")}`;
  if (text.startsWith("[post]:")) return `📤 ${t("community_msg_post_label")}`;
  if (text.startsWith("[shot]:")) return `🎬 ${t("community_msg_shot_label")}`;
  return null;
}

/**
 * Descrição do toast quando um envio (texto, foto ou áudio) falha.
 *
 * Existe por causa de um caso só, mas o caso importa: quando há bloqueio entre
 * as duas pontas, a policy `messages_insert_not_blocked` (migração 20260826)
 * recusa o INSERT e o Postgres devolve "new row violates row-level security
 * policy for table messages" — texto que não diz nada a quem está na conversa.
 * A UI normalmente nem chega aqui (a barra de escrever some quando a conversa
 * está marcada como bloqueada), mas a marcação vem de um cache de TTL médio: se
 * a outra pessoa bloqueia enquanto esta tela está aberta, o envio ainda parte.
 *
 * Qualquer outro erro continua mostrando a mensagem original — ela costuma ser
 * a informação mais útil (rede, arquivo grande, etc.).
 */
export function sendErrorDescription(
  err: any,
  t: (key: TranslationKey) => string,
): string {
  const code = String(err?.code ?? "");
  const message = String(err?.message ?? "");
  if (code === "42501" || /row-level security/i.test(message)) {
    return t("community_send_blocked_desc");
  }
  return message || t("retry");
}

/**
 * Prefixo de citação de uma resposta: `↩ <original>\n\n`. Usado por TODOS os
 * envios (texto, foto e áudio) para que a mídia enviada em cima de uma mensagem
 * marcada também apareça como resposta àquela mensagem.
 *
 * Se a mensagem citada já for ela mesma uma resposta, cita apenas o conteúdo
 * próprio dela (o texto novo), nunca a citação aninhada: o parser da bolha corta
 * no primeiro `\n\n`, então empilhar `↩` embaralharia quote e corpo.
 *
 * Retorna string vazia quando não há resposta marcada — aí o texto segue puro.
 */
export function buildReplyPrefix(replyTo: { text: string } | null | undefined): string {
  if (!replyTo) return "";
  const quoted = replyTo.text.replace(/^↩ .+?\n\n/, "").trim();
  if (!quoted) return "";
  return `↩ ${quoted}\n\n`;
}

/**
 * Texto do preview de uma conversa (última mensagem na lista). Trata dois casos
 * que o `specialMessageLabel` sozinho não cobria:
 *
 * - **Respostas** (`↩ <original>\n\n<nova>`): o texto começa com `↩ `, então o
 *   `specialMessageLabel` não casava o prefixo `[audio]:`/`[image]:`… e caía no
 *   fallback cru — a lista mostrava `↩ [audio]:https://…supabase.co/…`. Agora o
 *   preview mostra a **resposta** (o texto novo que o usuário digitou), com um
 *   `↩` na frente para sinalizar que é uma resposta; se a resposta em si for
 *   especial, usa o rótulo curto.
 * - **Mensagens especiais soltas**: delega ao `specialMessageLabel` (🎤 Áudio…).
 *
 * Retorna `null` só quando não há texto (o chamador cai no "iniciar conversa").
 */
export function conversationPreviewText(
  text: string | null | undefined,
  t: (key: TranslationKey) => string,
): string | null {
  if (!text) return null;
  const replyMatch = text.match(/^↩ .+?\n\n([\s\S]*)$/);
  if (replyMatch) {
    const body = replyMatch[1].trim();
    if (!body) return null;
    return `↩ ${specialMessageLabel(body, t) ?? body}`;
  }
  return specialMessageLabel(text, t) ?? text;
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
