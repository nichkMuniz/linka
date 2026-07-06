import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

// Lazy import to avoid circular dependency — called only at sign-out time
let _invalidateViewerCache: (() => void) | null = null;
export function registerViewerCacheInvalidator(fn: () => void) {
  _invalidateViewerCache = fn;
}

// Called with the user id whenever a session becomes available (SIGNED_IN /
// INITIAL_SESSION / TOKEN_REFRESHED). ritmofit-db uses it to drop the viewer
// cache and, if the account changed since the last session, purge the query
// cache — sem isso, um viewer `null` cacheado antes do login continuava sendo
// servido por até 30s depois de logar.
let _handleAuthUserReady: ((userId: string) => void) | null = null;
export function registerAuthUserReadyHandler(fn: (userId: string) => void) {
  _handleAuthUserReady = fn;
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

// Retryable fetch: on transient network failures (common on iOS when switching
// between WiFi and cellular, or when the app returns from background), retry
// the request up to MAX_RETRIES times with exponential back-off before giving up.
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 300;

function isRetryableError(err: unknown): boolean {
  if (err instanceof TypeError && err.message.includes("Failed to fetch")) return true;
  if (err instanceof DOMException && err.name === "AbortError") return false; // don't retry intentional aborts
  if (err instanceof DOMException && err.name === "NetworkError") return true;
  return false;
}

async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(input, init);
      return response;
    } catch (err) {
      lastError = err;
      const retryable = isRetryableError(err);
      if (!retryable || attempt === MAX_RETRIES) break;

      const delay = BASE_DELAY_MS * 2 ** attempt; // 300ms, 600ms, 1200ms
      console.warn(
        `[supabase] Network error on attempt ${attempt + 1}/${MAX_RETRIES + 1}. Retrying in ${delay}ms…`,
        err instanceof Error ? err.message : err,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}

export const supabase: SupabaseClient | null = hasSupabaseConfig
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
    global: {
      fetch: fetchWithRetry,
    },
  })
  : null;

// Invalidate viewer + query cache whenever auth session is lost (logout, token
// revocation, expiry) — and notify the db layer when a session becomes
// available, so caches poisoned before/during login are refreshed.
supabase?.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") {
    _invalidateViewerCache?.();
  } else if (session?.user?.id) {
    _handleAuthUserReady?.(session.user.id);
  }
});


function isInvalidRefreshTokenError(err: unknown) {
  const message =
    typeof err === "object" && err && "message" in err
      ? String((err as any).message)
      : "";

  return (
    message.toLowerCase().includes("invalid refresh token") ||
    message.toLowerCase().includes("refresh token not found")
  );
}

function clearSupabaseAuthStorage() {
  try {
    const keys = Object.keys(window.localStorage);
    keys.forEach((k) => {
      // supabase-js stores session in keys like: sb-<project-ref>-auth-token
      if (k.startsWith("sb-") && k.endsWith("-auth-token")) {
        window.localStorage.removeItem(k);
      }
    });
  } catch {
    // ignore
  }
}

export async function resetSupabaseAuth() {
  if (!supabase) return;

  try {
    await supabase.auth.signOut();
  } catch {
    // ignore
  } finally {
    clearSupabaseAuthStorage();
    _invalidateViewerCache?.();
  }
}

export async function getUserSafe(): Promise<User | null> {
  if (!supabase) return null;

  try {
    // getSession() reads from localStorage — no network round-trip.
    // getUser() validates with the server on every call; reserve it for
    // security-sensitive paths (e.g. after a suspected token compromise).
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.user ?? null;
  } catch (err) {
    // Handle AbortError (request was cancelled/aborted)
    if (err instanceof DOMException && err.name === "AbortError") {
      console.warn("[getUserSafe] Auth request was aborted. Using cached session if available.");
      return null;
    }

    // Handle network-level errors (fetch failures)
    if (err instanceof TypeError && err.message.includes("Failed to fetch")) {
      console.warn(
        "[getUserSafe] Network error reaching Supabase. Using cached session if available.",
      );
      return null;
    }

    if (isInvalidRefreshTokenError(err)) {
      await resetSupabaseAuth();
      return null;
    }

    // For any other auth error, log it but return null to allow graceful degradation
    // The app can still function with cached session from localStorage
    console.warn("[getUserSafe] Auth verification failed:", err instanceof Error ? err.message : String(err));
    return null;
  }
}
