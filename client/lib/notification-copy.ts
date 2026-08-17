/**
 * Texto das notificações sociais — fonte única do título, do corpo e do deep link.
 *
 * Usado pelo banner local que o app dispara quando a notificação chega com o
 * app EM PRIMEIRO PLANO (`AppLayout`). Antes esse banner só conhecia os tipos
 * 1–7 e, pior, o corpo era genérico ("Alguém reagiu à sua postagem") — os tipos
 * novos (promoção, mensagem, check-in de duelo…) caíam todos em "Você tem uma
 * nova notificação", obrigando o usuário a abrir o app para descobrir o que era.
 *
 * ⚠️ O push que chega com o app fechado/em background é montado na edge function
 * `supabase/functions/send-push-notification/index.ts` (Deno, sem acesso ao
 * i18n). Ao mexer nos textos aqui, espelhe lá em `TITLE_BY_TYPE` / `buildBody` /
 * `deepLinkFor` — e faça o redeploy da função, senão o push continua com o texto
 * antigo.
 */

import { supabase } from "@/lib/supabase";
import type { TranslationKey } from "@/lib/i18n";

/** Linha de `notifications` como ela chega no payload do Realtime. */
export type NotificationRow = {
  type?: number | null;
  follower_id?: string | null;
  post_id?: string | null;
  shots_id?: string | null;
  flow_id?: number | string | null;
  duel_check_in_id?: string | null;
  incentive_type?: number | null;
};

type Translate = (key: TranslationKey) => string;

const TITLE_KEY_BY_TYPE: Record<number, TranslationKey> = {
  1: "notif_title_1",
  2: "notif_title_2",
  3: "notif_title_3",
  4: "notif_title_4",
  5: "notif_title_5",
  6: "notif_title_6",
  7: "notif_title_7",
  8: "notif_title_8",
  9: "notif_title_9",
  10: "notif_title_10",
  11: "notif_title_11",
  12: "notif_title_12",
  13: "notif_title_13",
  14: "notif_title_14",
  15: "notif_title_15",
  16: "notif_title_16",
  17: "notif_title_17",
};

const INCENTIVE_KEY_BY_TYPE: Record<number, TranslationKey> = {
  1: "incentive_1",
  2: "incentive_2",
  3: "incentive_3",
  4: "incentive_4",
  5: "incentive_5",
  6: "incentive_6",
};

/** Encurta nome livre (apelido, grupo) para o banner não virar um parágrafo. */
function short(value: string, max = 24): string {
  const v = value.trim();
  return v.length > max ? `${v.slice(0, max - 1)}…` : v;
}

/**
 * Onde a interação aconteceu. `shots_id` carrega prefixos legados (`flow:`,
 * `checkin:`) — a mesma convenção que `getNotificationsDb` desembrulha.
 */
function contextKey(row: NotificationRow): TranslationKey {
  const shotsId = row.shots_id ?? "";
  if (row.duel_check_in_id || shotsId.startsWith("checkin:")) return "notif_context_checkin";
  if (shotsId.startsWith("flow:") || row.flow_id) return "notif_context_flow";
  if (shotsId) return "notif_context_shot";
  return "notif_context_post";
}

/** Dados de exibição que só existem em outras tabelas (apelido, nome do grupo). */
export type NotificationCopyData = {
  name: string;
  groupName?: string | null;
};

/**
 * Busca o mínimo necessário para o texto: o apelido de quem originou e, nos
 * tipos de duelo, o nome do grupo (`post_id` guarda o id do grupo nos tipos
 * 4/5/11). Uma linha por tabela — bem mais barato que recarregar a lista toda.
 * Qualquer falha cai no genérico "Alguém", nunca derruba o banner.
 */
export async function fetchNotificationCopyData(
  row: NotificationRow,
  fallbackName: string,
): Promise<NotificationCopyData> {
  const type = Number(row.type ?? 0);
  const needsGroup = type === 4 || type === 5 || type === 11;

  let name = fallbackName;
  let groupName: string | null = null;

  try {
    if (supabase && row.follower_id) {
      const { data } = await supabase
        .from("profiles")
        .select("nickname")
        .eq("user_id", row.follower_id)
        .maybeSingle();
      if (data?.nickname) name = short(String(data.nickname));
    }
    if (supabase && needsGroup && row.post_id) {
      const { data } = await supabase
        .from("duel_groups")
        .select("name")
        .eq("id", row.post_id)
        .maybeSingle();
      if (data?.name) groupName = short(String(data.name), 40);
    }
  } catch (err) {
    console.error("Error fetching notification copy data:", err);
  }

  return { name, groupName };
}

export function notificationTitle(t: Translate, type: number): string {
  const key = TITLE_KEY_BY_TYPE[type];
  return key ? t(key) : t("notif_title_default");
}

/**
 * Corpo da notificação com os dados reais — mesmas chaves que a lista da tela
 * de Notificações usa, para o banner e o card dizerem exatamente a mesma coisa.
 */
export function notificationBody(
  t: Translate,
  row: NotificationRow,
  data: NotificationCopyData,
): string {
  const type = Number(row.type ?? 0);
  const name = data.name;
  const context = t(contextKey(row));
  const group = data.groupName ?? t("notif_group_fallback");

  switch (type) {
    case 1:
      return t("notif_desc_follow").replace("{name}", name);
    case 2: {
      const incentiveKey = INCENTIVE_KEY_BY_TYPE[Number(row.incentive_type ?? 0)];
      const incentive = incentiveKey ? t(incentiveKey) : t("incentive_default");
      return t("notif_desc_incentive_single")
        .replace("{name}", name)
        .replace("{incentive}", incentive)
        .replace("{context}", context);
    }
    case 3:
      return t("notif_desc_comment").replace("{name}", name).replace("{context}", context);
    case 4:
      return t("notif_desc_duel_invite").replace("{name}", name).replace("{group}", group);
    case 5:
      return t("notif_desc_duel_join").replace("{name}", name).replace("{group}", group);
    case 6:
      return t("notif_desc_reaction_comment").replace("{name}", name);
    case 7:
      return t("notif_desc_reaction_checkin").replace("{name}", name);
    case 8:
      return t("notif_desc_promo_comment").replace("{name}", name);
    case 9:
      return t("notif_desc_post_tag").replace("{name}", name);
    case 10:
      return t("notif_desc_message").replace("{name}", name);
    case 11:
      return t("notif_desc_duel_checkin").replace("{name}", name).replace("{group}", group);
    case 12:
      return t("notif_desc_promo_like").replace("{name}", name);
    case 13:
      return t("notif_desc_promo_expired").replace("{name}", name);
    case 14:
      return t("notif_desc_checkin_classified").replace("{name}", name);
    case 15:
      return t("notif_desc_checkin_disqualified").replace("{name}", name);
    case 16:
      return t("notif_desc_flow_tag").replace("{name}", name);
    case 17:
      return t("notif_desc_flow_reply").replace("{name}", name);
    default:
      return t("notif_body_default");
  }
}

/**
 * Tela que o app abre no toque do banner. Espelha `deepLinkFor` da edge function:
 * `post_id` guarda o id do grupo de duelo (tipo 11) ou da promoção (8, 12, 13).
 */
export function notificationDeepLink(row: NotificationRow): string {
  const type = Number(row.type ?? 0);
  // Comentário (3), reação no comentário (6), reação no check-in (7), check-in
  // de um membro do duelo (11) e avaliação do check-in (14/15) abrem o próprio
  // check-in — mesmo destino que o card na tela de Notificações usa via
  // `state.openCheckIn`.
  if (
    row.duel_check_in_id &&
    (type === 3 || type === 6 || type === 7 || type === 11 || type === 14 || type === 15)
  ) {
    return `/comunidade?checkin=${row.duel_check_in_id}`;
  }
  switch (type) {
    // 10 = mensagem privada, 17 = resposta a um flow — as duas vivem no chat.
    case 10:
    case 17:
      return row.follower_id ? `/comunidade?user=${row.follower_id}` : "/comunidade";
    case 11:
      return row.post_id ? `/comunidade?group=${row.post_id}` : "/comunidade?tab=duels";
    case 8:
    case 12:
    case 13:
      return "/vitrine";
    default:
      return "/notificacoes";
  }
}
