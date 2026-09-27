/**
 * Pop up de mensagem privada recebida com o app ABERTO.
 *
 * Quem emite é o canal realtime de `messages` no `AppLayout` (única assinatura
 * da tabela no app); quem exibe é o `IncomingMessageToast`, montado uma vez no
 * mesmo layout — o mesmo par emissor/exibidor de [[routine-complete-toast]] e do
 * IncentiveConfirmToast.
 *
 * Por que o gatilho é a linha de `messages` e não a notificação tipo 10: só a
 * mensagem carrega o TEXTO, então o banner consegue mostrar o preview real
 * ("🎤 Áudio", "bora treinar?") em vez de "Fulano te enviou uma mensagem". Em
 * primeiro plano, portanto, o tipo 10 é ignorado no handler de `notifications`
 * (senão o usuário levaria dois avisos da mesma mensagem).
 */

export type IncomingMessagePayload = {
  /** Remetente (`messages.user_id`) — usado no deep link `/comunidade?user=`. */
  senderId: string;
  /** Texto cru, ainda com os prefixos do protocolo (`[audio]:`, `↩ …`). */
  text: string;
};

type Listener = (payload: IncomingMessagePayload) => void;
const listeners = new Set<Listener>();

export function showIncomingMessageToast(payload: IncomingMessagePayload): void {
  listeners.forEach((l) => l(payload));
}

export function subscribeIncomingMessageToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Notificação social recebida com o app ABERTO (incentivo, comentário, seguidor,
 * marcação…) — mesmo pop up in-app da mensagem. Antes o AppLayout agendava uma
 * notificação LOCAL nativa, que o iOS não exibe com o app em primeiro plano:
 * o usuário só descobria pelo sino. O texto chega pronto (notification-copy.ts),
 * então este canal não depende do tipo.
 */
export type IncomingNotificationPayload = {
  /** Quem originou (`notifications.follower_id`) — foto no avatar do banner. */
  actorId: string | null;
  title: string;
  body: string;
  /** Destino do toque — o mesmo deep link do push (`notificationDeepLink`). */
  url: string;
};

type NotificationListener = (payload: IncomingNotificationPayload) => void;
const notificationListeners = new Set<NotificationListener>();

export function showIncomingNotificationToast(payload: IncomingNotificationPayload): void {
  notificationListeners.forEach((l) => l(payload));
}

export function subscribeIncomingNotificationToast(listener: NotificationListener): () => void {
  notificationListeners.add(listener);
  return () => {
    notificationListeners.delete(listener);
  };
}
