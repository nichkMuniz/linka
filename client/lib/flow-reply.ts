/**
 * Resposta PRIVADA a um flow — codificação da mensagem.
 *
 * Responder um flow pelo botão de mensagem não cria um comentário público (bolha
 * flutuante no flow): grava uma linha em `messages` para o autor, como qualquer DM.
 * Para que o autor entenda o contexto ("respondeu ao MEU flow", com a miniatura da
 * mídia), a mensagem carrega o id do flow junto do texto — no mesmo protocolo de
 * prefixo de `[audio]:`/`[image]:`/`[post]:`/`[shot]:`, sem coluna nova na tabela.
 *
 * Formato: `[flowreply]:<flowId>|<texto>`
 *
 * O separador é o **primeiro** `|`: o id do flow é um bigint (nunca contém `|`),
 * então um `|` digitado pelo usuário no texto sobrevive intacto.
 */
export const FLOW_REPLY_PREFIX = "[flowreply]:";

export type ParsedFlowReply = { flowId: string; text: string };

export function buildFlowReplyPayload(flowId: string, text: string): string {
  return `${FLOW_REPLY_PREFIX}${flowId}|${text.trim()}`;
}

/**
 * Devolve `{ flowId, text }` quando a mensagem é uma resposta a flow, ou `null`
 * para qualquer outra coisa. Mensagem sem separador (ou sem id) volta `null` de
 * propósito: a bolha cai no render de texto puro em vez de mostrar um card quebrado.
 */
export function parseFlowReply(
  text: string | null | undefined,
): ParsedFlowReply | null {
  if (!text || !text.startsWith(FLOW_REPLY_PREFIX)) return null;
  const body = text.slice(FLOW_REPLY_PREFIX.length);
  const sep = body.indexOf("|");
  if (sep < 0) return null;
  const flowId = body.slice(0, sep).trim();
  if (!flowId) return null;
  return { flowId, text: body.slice(sep + 1) };
}

/** Um flow vive 24h; depois disso a mídia continua no banco, mas o ring já não o abre. */
export const FLOW_LIFETIME_MS = 24 * 60 * 60 * 1000;

export function isFlowExpired(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() > FLOW_LIFETIME_MS;
}
