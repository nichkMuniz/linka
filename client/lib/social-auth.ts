// Login com Google e Apple (religado em 2026-09-29).
//
// · Apple (iOS): folha nativa do sistema via `@capacitor-community/apple-sign-in`
//   → `identityToken` → `supabase.auth.signInWithIdToken`. Sem navegador.
// · Google (iOS): plugin nativo LOCAL `GoogleAuth` (ios/App/App/GoogleAuthPlugin.swift)
//   com o Client ID do tipo iOS → `id_token` → `signInWithIdToken`. O retorno é
//   o próprio app, então a tela do Google mostra o nome do app em vez de
//   "Prosseguir para <projeto>.supabase.co".
//   Fallback (sem Client ID iOS ou binário antigo sem o plugin): OAuth do
//   Supabase no `Browser` → `com.linka.meuapp://login-callback?code=…` → o
//   `Login.tsx` troca o code pela sessão (PKCE, ver `flowType` em `supabase.ts`).
// · Web (`pnpm dev`): os dois usam o redirect do Supabase de volta para /login.
//
// "Cadastro por provedor terminou?" mora em `social-signup-state.ts` (leve, lido
// pelo RequireAuth do App.tsx sem puxar os plugins deste arquivo).

import { Capacitor, registerPlugin } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { SignInWithApple } from "@capacitor-community/apple-sign-in";
import { APP_URL_SCHEME } from "@shared/share-config";
import { supabase } from "@/lib/supabase";
import { reportHandledError } from "@/lib/monitoring";

/** Destino do OAuth no app nativo. Precisa estar em Auth → URL Configuration → Redirect URLs. */
export const OAUTH_NATIVE_REDIRECT = `${APP_URL_SCHEME}://login-callback`;

/**
 * Client ID do Google do tipo **iOS** (Google Cloud → Credentials, bundle
 * `com.linka.meuapp`). Não é segredo — fica embutido em todo app com login do
 * Google —, por isso mora no código: o build do Appflow não depende de variável
 * extra. Também precisa estar em Supabase → Providers → Google → Client IDs
 * (junto do Client ID Web), senão o `signInWithIdToken` recusa a audiência.
 * Vazio = login do Google pelo navegador (fallback).
 */
const GOOGLE_IOS_CLIENT_ID: string =
  (import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID as string | undefined) ??
  "740332550721-82n4d71tg3qg1prd75otkpe46mvmbvcq.apps.googleusercontent.com";

interface GoogleAuthPlugin {
  signIn(options: { clientId: string; nonce?: string }): Promise<{ idToken: string; accessToken?: string }>;
}
const GoogleAuth = registerPlugin<GoogleAuthPlugin>("GoogleAuth");

/** Plugin local ausente no binário (build antigo) → cai para o navegador. */
function isPluginMissing(err: unknown): boolean {
  const e = err as { code?: unknown; message?: unknown } | null;
  return String(e?.code ?? "") === "UNIMPLEMENTED" || String(e?.message ?? "").toLowerCase().includes("not implemented");
}

/**
 * Login do Google.
 * - `"session"`: a sessão já está pronta (fluxo nativo).
 * - `"redirect"`: a sessão chega depois, pelo `login-callback` (navegador).
 */
export async function startGoogleSignIn(): Promise<"session" | "redirect"> {
  if (!supabase) throw new Error("Supabase indisponível");
  const native = Capacitor.isNativePlatform();

  if (native && GOOGLE_IOS_CLIENT_ID) {
    const rawNonce = randomNonce();
    try {
      const { idToken, accessToken } = await GoogleAuth.signIn({
        clientId: GOOGLE_IOS_CLIENT_ID,
        nonce: await sha256Hex(rawNonce),
      });
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
        access_token: accessToken,
        nonce: rawNonce,
      });
      if (error) throw error;
      return "session";
    } catch (err) {
      if (!isPluginMissing(err)) throw err;
      // segue para o navegador
    }
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: native ? OAUTH_NATIVE_REDIRECT : `${window.location.origin}/login`,
      skipBrowserRedirect: native,
      // Sempre mostra o seletor de conta — sem isso quem tem várias contas
      // Google no aparelho entra direto na última usada.
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw error;
  if (native) {
    if (!data?.url) throw new Error("URL de autenticação não gerada.");
    await Browser.open({ url: data.url, presentationStyle: "popover" });
  }
  return "redirect";
}

/** Troca o `code` do retorno do OAuth pela sessão. Devolve false se a URL não é um callback. */
export async function completeOAuthCallback(url: string): Promise<boolean> {
  if (!supabase) return false;
  const parsed = new URL(url);
  const code = parsed.searchParams.get("code");
  const oauthError = parsed.searchParams.get("error_description") ?? parsed.searchParams.get("error");
  if (oauthError) throw new Error(oauthError);
  if (!code) return false;
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
  return true;
}

export interface AppleSignInResult {
  /** Nome só vem na PRIMEIRA autorização da Apple — depois volta null. */
  fullName: string | null;
}

/** true quando o usuário fechou a folha da Apple (não é erro para mostrar). */
export function isSocialSignInCancelled(err: unknown): boolean {
  const e = err as { code?: unknown; message?: unknown } | null;
  const code = String(e?.code ?? "");
  const message = String(e?.message ?? "").toLowerCase();
  // 1001 = ASAuthorizationError.canceled
  return code === "1001" || message.includes("1001") || message.includes("cancel");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Sign in with Apple. No iOS a sessão já volta pronta; na web o navegador é
 * redirecionado e a sessão chega pelo retorno em /login (resultado null).
 */
export async function signInWithApple(): Promise<AppleSignInResult | null> {
  if (!supabase) throw new Error("Supabase indisponível");

  if (!Capacitor.isNativePlatform()) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: { redirectTo: `${window.location.origin}/login` },
    });
    if (error) throw error;
    return null;
  }

  // A Apple assina o HASH do nonce no token; o Supabase confere com o nonce cru.
  const rawNonce = randomNonce();
  const { response } = await SignInWithApple.authorize({
    clientId: APP_URL_SCHEME, // bundle id — no fluxo nativo o clientId é o app
    redirectURI: OAUTH_NATIVE_REDIRECT, // exigido pela assinatura; não usado no nativo
    scopes: "name email",
    nonce: await sha256Hex(rawNonce),
  });

  if (!response?.identityToken) throw new Error("Token da Apple não retornado.");

  const { error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: response.identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;

  // Guarda o token da Apple para poder REVOGAR a autorização se a conta for
  // excluída (exigência da Apple, 5.1.1(v)). O code vale 5 min e é de uso
  // único — tem que ir agora. Não segura o login: falhar aqui só significa
  // que a revogação não vai acontecer para esta sessão.
  if (response.authorizationCode) {
    void storeAppleAuthorizationCode(response.authorizationCode);
  }

  const fullName = [response.givenName, response.familyName].filter(Boolean).join(" ").trim();
  return { fullName: fullName || null };
}

/** Troca o code da Apple pelo refresh_token no servidor (edge function `apple-auth`). */
async function storeAppleAuthorizationCode(authorizationCode: string): Promise<void> {
  if (!supabase) return;
  try {
    const { data, error } = await supabase.functions.invoke("apple-auth", {
      body: { action: "store", authorizationCode },
    });
    if (error) throw error;
    if (data && (data as { stored?: boolean }).stored === false) {
      console.warn("[apple-auth] token não guardado:", (data as { reason?: string }).reason);
    }
  } catch (err) {
    reportHandledError(err, "social-auth:store-apple-code");
  }
}
