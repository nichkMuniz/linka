/**
 * Saneamento de URLs vindas de outros usuários (site do perfil comercial, link
 * da promoção, link da oferta).
 *
 * Sem isso, o valor ia cru para `Browser.open()` / `href`: um usuário podia
 * salvar `javascript:...` no campo de site e transformar o botão "Visitar site"
 * do próprio perfil numa armadilha para quem tocasse nele. Aqui só http(s)
 * passa — qualquer outro esquema vira `null` e o link não é renderizado.
 */

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Normaliza uma URL enviada por usuário. Aceita "loja.com.br" (sem esquema) e
 * completa com https. Devolve `null` se não for um link http(s) válido.
 */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Campo digitado sem esquema ("loja.com.br") — assume https.
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return null;
  if (!parsed.hostname || !parsed.hostname.includes(".")) return null;

  return parsed.href;
}

/** `true` se o valor puder virar um link seguro — para esconder o botão. */
export function isSafeExternalUrl(raw: string | null | undefined): boolean {
  return safeExternalUrl(raw) !== null;
}

/** Abre um link externo apenas se ele for http(s). Retorna `false` se recusou. */
export function openExternalUrl(
  raw: string | null | undefined,
  open: (options: { url: string }) => unknown,
): boolean {
  const url = safeExternalUrl(raw);
  if (!url) return false;
  open({ url });
  return true;
}
