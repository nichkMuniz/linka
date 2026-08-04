/**
 * Configuração de compartilhamento — FONTE ÚNICA DA VERDADE.
 *
 * Todo link que sai do app (WhatsApp, Instagram, copiar link), todo Universal
 * Link que entra, o rodapé desenhado nos cards de imagem e a allowlist de CORS
 * derivam daqui. Trocar de domínio = mudar `SHARE_DOMAIN` nesta linha.
 *
 * ATENÇÃO — dois lugares NÃO conseguem importar deste arquivo e precisam ser
 * atualizados à mão na mesma troca:
 *   1. `ios/App/App/App.entitlements` → `applinks:<domínio>` (apex e www)
 *   2. `public/.well-known/apple-app-site-association` → `appIDs` (Team ID)
 * Sem os dois, o Universal Link não abre o app.
 *
 * Importável de client/, server/ e das funções serverless (`api/`): este módulo
 * é TypeScript puro, sem nenhuma dependência de browser ou de Node.
 */

/** Domínio público, sem protocolo. Também é o texto impresso nos cards. */
export const SHARE_DOMAIN = "linkafit.com.br";

/** Hosts aceitos como origem de um Universal Link nosso. */
export const SHARE_HOSTS: readonly string[] = [
  SHARE_DOMAIN,
  `www.${SHARE_DOMAIN}`,
];

/** Base de todo link compartilhado. */
export const SHARE_BASE_URL = `https://${SHARE_DOMAIN}`;

/** Origens https dos nossos hosts — usado na allowlist de CORS da API. */
export const SHARE_ORIGINS: readonly string[] = SHARE_HOSTS.map(
  (host) => `https://${host}`,
);

/**
 * Custom URL scheme registrado em `Info.plist` (CFBundleURLSchemes).
 * É o plano B do Universal Link: navegadores embutidos (o do WhatsApp, o do
 * Instagram) frequentemente engolem Universal Links, mas respeitam o scheme.
 */
export const APP_URL_SCHEME = "com.linka.meuapp";

/** ID do app na App Store Connect. */
export const APP_STORE_ID = "6761916728";

export const APP_STORE_URL = `https://apps.apple.com/app/id${APP_STORE_ID}`;

/**
 * Páginas legais servidas no domínio (`public/termos.html` e
 * `public/privacidade.html`, com rewrites das URLs limpas em `vercel.json`).
 *
 * A App Store Review Guideline 3.1.2 exige que a tela de compra da assinatura
 * tenha links FUNCIONAIS para os dois documentos dentro do próprio binário —
 * é uma das causas mais comuns de rejeição em apps com assinatura.
 */
export const TERMS_URL = `${SHARE_BASE_URL}/termos`;
export const PRIVACY_URL = `${SHARE_BASE_URL}/privacidade`;

// ─── Construtores de link ───────────────────────────────────────────────────
// Mantidos alinhados com as rotas do React Router em `client/App.tsx` e com os
// `components` do arquivo AASA. Rota nova compartilhável = mexer nos três.

export function postSharePath(postId: string): string {
  return `/post/${encodeURIComponent(postId)}`;
}

export function profileSharePath(userId: string): string {
  return `/usuario/${encodeURIComponent(userId)}`;
}

export function postShareUrl(postId: string): string {
  return `${SHARE_BASE_URL}${postSharePath(postId)}`;
}

export function profileShareUrl(userId: string): string {
  return `${SHARE_BASE_URL}${profileSharePath(userId)}`;
}

/** O host pertence ao nosso domínio de compartilhamento? */
export function isShareHost(hostname: string): boolean {
  return SHARE_HOSTS.includes(hostname.toLowerCase());
}

// ─── Parser de deep link ────────────────────────────────────────────────────

export type DeepLinkTarget =
  /** Navegar para esta rota do React Router (já com search/hash preservados). */
  | { kind: "route"; path: string }
  /** Link de recuperação de senha do Supabase. */
  | { kind: "recovery" }
  /** Não é nosso, ou é tratado em outro lugar. */
  | { kind: "ignore" };

/**
 * Normaliza o caminho de uma URL de deep link.
 *
 * Colapsa barras repetidas e força um único `/` inicial — `//evil.com` vira
 * `/evil.com`, então nunca escapa para fora do roteador.
 */
function normalizeDeepLinkPath(raw: string): string {
  const collapsed = `/${raw.replace(/^\/+/, "").replace(/\/{2,}/g, "/")}`;
  return collapsed.length > 1 ? collapsed.replace(/\/+$/, "") : collapsed;
}

/**
 * Traduz a URL recebida no evento `appUrlOpen` para um destino do app.
 *
 * Trata as duas formas de deep link, que têm formatos de URL DIFERENTES:
 *
 *   Universal Link  `https://linkafit.com.br/post/123`
 *                   → host "linkafit.com.br" · pathname "/post/123"
 *   Custom scheme   `com.linka.meuapp://post/123`
 *                   → host "post"            · pathname "/123"
 *
 * No custom scheme o primeiro segmento do caminho vira o HOST da URL — usar
 * `pathname` direto (como era feito antes) navegava para "/123" e caía no
 * NotFound. Por isso o host é reconcatenado ao caminho nesse caso.
 */
export function parseDeepLinkUrl(rawUrl: string): DeepLinkTarget {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { kind: "ignore" };
  }

  const scheme = parsed.protocol.replace(/:$/, "").toLowerCase();
  const isHttp = scheme === "http" || scheme === "https";
  const isAppScheme = scheme === APP_URL_SCHEME.toLowerCase();

  if (!isHttp && !isAppScheme) return { kind: "ignore" };

  // Um Universal Link de outro domínio não deveria chegar até aqui (o iOS só
  // entrega os que casam com o entitlement), mas se chegar não pode virar
  // navegação: seria um redirect controlado por terceiro dentro do app.
  if (isHttp && !isShareHost(parsed.hostname)) return { kind: "ignore" };

  const rawPath = isAppScheme
    ? `/${parsed.host}${parsed.pathname}`
    : parsed.pathname;

  // Recuperação de senha: o Supabase devolve os tokens no fragmento.
  // Checado ANTES do login-callback de propósito — o link de recovery chega
  // justamente por esse caminho, e a ordem anterior o descartava antes de
  // chegar aqui, deixando o usuário sem a tela de nova senha.
  if (parsed.hash.includes("type=recovery")) return { kind: "recovery" };

  // Callback de OAuth / magic link: quem trata é a tela de Login.
  if (rawPath.includes("login-callback")) return { kind: "ignore" };

  const path = normalizeDeepLinkPath(rawPath);

  return { kind: "route", path: `${path}${parsed.search}${parsed.hash}` };
}
