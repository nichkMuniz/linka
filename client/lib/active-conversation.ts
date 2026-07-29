/**
 * Registro global da conversa privada aberta no momento.
 *
 * Serve para o handler de notificações em primeiro plano (`AppLayout`) decidir
 * NÃO mostrar o banner de uma mensagem nova quando o usuário já está justamente
 * dentro daquela conversa, vendo a mensagem chegar em tempo real — nesse caso o
 * celular só vibra. Em qualquer outra tela (feed, perfil…) o banner aparece
 * normalmente.
 *
 * É um módulo simples (não um contexto React) porque quem lê é um callback de
 * evento nativo, fora da árvore de componentes, que precisa do valor de forma
 * síncrona no instante em que a notificação chega.
 *
 * Guarda o `userId` do OUTRO participante (o remetente). A `Community` grava ao
 * entrar numa conversa e limpa ao sair; a notificação de mensagem (type 10) traz
 * o remetente em `follower_id`, então a comparação é direta.
 */

let activeConversationUserId: string | null = null;

export function setActiveConversationUserId(userId: string | null): void {
  activeConversationUserId = userId;
}

export function getActiveConversationUserId(): string | null {
  return activeConversationUserId;
}
