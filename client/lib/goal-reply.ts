/**
 * Resposta PRIVADA a uma meta — codificação da mensagem.
 *
 * No perfil de outra pessoa, o detalhe da meta (`GoalDetailDrawer` em modo
 * leitura) tem um campo "Responder": o texto vira uma DM para o dono da meta,
 * carregando o id dela para a conversa mostrar QUAL meta foi respondida. Mesmo
 * protocolo de prefixo de `[flowreply]:` (ver `flow-reply.ts`), sem coluna nova.
 *
 * Formato: `[goalreply]:<userGoalId>|<texto>`
 *
 * O separador é o **primeiro** `|`: o id de `user_goals` é um bigint (nunca
 * contém `|`), então um `|` digitado pelo usuário sobrevive intacto.
 */
export const GOAL_REPLY_PREFIX = "[goalreply]:";

export type ParsedGoalReply = { goalId: string; text: string };

export function buildGoalReplyPayload(goalId: string, text: string): string {
  return `${GOAL_REPLY_PREFIX}${goalId}|${text.trim()}`;
}

/** `{ goalId, text }` quando é resposta a meta; `null` para qualquer outra mensagem. */
export function parseGoalReply(text: string | null | undefined): ParsedGoalReply | null {
  if (!text || !text.startsWith(GOAL_REPLY_PREFIX)) return null;
  const body = text.slice(GOAL_REPLY_PREFIX.length);
  const sep = body.indexOf("|");
  if (sep < 0) return null;
  const goalId = body.slice(0, sep).trim();
  if (!goalId) return null;
  return { goalId, text: body.slice(sep + 1) };
}
