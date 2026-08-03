/**
 * Exclusão da conta em `auth.users` — última etapa de "Excluir minha conta".
 *
 * Precisa existir no servidor porque apagar um usuário do Supabase Auth exige a
 * **service role key**, que nunca pode viajar para o app. O cliente já apagou
 * todas as linhas dele nas tabelas (`deleteAllUserDataDb`) e chama esta função
 * no fim para encerrar o registro de autenticação.
 *
 * Porta da antiga `netlify/functions/delete-auth-user.ts` (ver `docs/19`).
 *
 * AUTORIZAÇÃO — a chave aqui é irrestrita, então a porta é estreita de
 * propósito. São três checagens em sequência, e todas precisam passar:
 *   1. o header Authorization traz um access token válido;
 *   2. o Supabase confirma a identidade desse token;
 *   3. o `userId` do corpo é EXATAMENTE o dono do token.
 * Sem a checagem 3, um usuário autenticado qualquer apagaria a conta de outro.
 *
 * CORS — a requisição sai do WebView, cuja origem é `capacitor://localhost`, e
 * é cross-origin de verdade: sem os headers abaixo (e sem responder ao
 * preflight OPTIONS) o WKWebView bloqueia antes de sair do aparelho.
 *
 * Runtime Edge: sem dependências, só `fetch` na REST do Supabase Auth.
 */

import { SHARE_ORIGINS } from "../shared/share-config";

export const config = { runtime: "edge" };

const ALLOWED_ORIGINS: readonly string[] = [
  ...SHARE_ORIGINS,
  // WebView do Capacitor (iOS e Android).
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost",
];

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // `pnpm dev` escolhe a porta livre (5173, 8080…), que muda a cada execução.
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function corsHeaders(origin: string): Record<string, string> {
  const headers: Record<string, string> = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Max-Age": "86400",
  };
  // Origem não permitida responde SEM o header — quem bloqueia é o WebView.
  if (origin && isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function json(
  status: number,
  body: Record<string, unknown>,
  origin: string,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export default async function handler(request: Request): Promise<Response> {
  const origin = request.headers.get("origin") ?? "";

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (request.method !== "POST") {
    return json(405, { error: "Method not allowed" }, origin);
  }

  const supabaseUrl = (
    process.env.SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    ""
  ).replace(/\/+$/, "");
  const anonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(
      503,
      { error: "Servidor sem SUPABASE_SERVICE_ROLE_KEY configurada" },
      origin,
    );
  }

  // ── 1. Token presente ─────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return json(401, { error: "Não autorizado" }, origin);
  }

  // ── 2. Token válido — o Supabase resolve quem é o portador ────────────────
  let callerId: string;
  try {
    const meResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    if (!meResponse.ok) {
      return json(401, { error: "Token inválido" }, origin);
    }
    const me = (await meResponse.json()) as { id?: string };
    if (!me.id) {
      return json(401, { error: "Token inválido" }, origin);
    }
    callerId = me.id;
  } catch {
    return json(502, { error: "Falha ao validar a sessão" }, origin);
  }

  // ── 3. O alvo é o próprio portador do token ───────────────────────────────
  let body: { userId?: string };
  try {
    body = (await request.json()) as { userId?: string };
  } catch {
    return json(400, { error: "Body inválido" }, origin);
  }

  if (!body.userId || body.userId !== callerId) {
    return json(
      403,
      { error: "Proibido: userId não corresponde ao token" },
      origin,
    );
  }

  // ── 4. Exclusão definitiva com a service role ─────────────────────────────
  try {
    const deleteResponse = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(callerId)}`,
      {
        method: "DELETE",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      },
    );

    if (!deleteResponse.ok) {
      const detail = await deleteResponse.text().catch(() => "");
      console.error("[delete-auth-user]", deleteResponse.status, detail);
      return json(500, { error: "Falha ao encerrar a conta" }, origin);
    }
  } catch {
    return json(502, { error: "Falha ao encerrar a conta" }, origin);
  }

  return json(200, { success: true }, origin);
}
