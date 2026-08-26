/**
 * Aba **Mensagens** da Comunidade.
 *
 * - `useMessages` — dono de todo o estado: lista de conversas, conversa aberta,
 *   envio de texto/foto/áudio, realtime, reações e exclusão.
 * - `ConversationView` — a conversa em tela cheia (portal para o `body`).
 * - `MessagesTab` — a lista de conversas dentro do corpo da Comunidade.
 * - `MessagesOverlays` — drawer de nova conversa e confirmação de exclusão.
 */
export { useMessages, QUICK_EMOJIS, type MessagesController } from "./use-messages";
export { ConversationView } from "./conversation-view";
export { MessagesTab, MessagesOverlays } from "./messages-tab";
