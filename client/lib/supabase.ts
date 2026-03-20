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

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = hasSupabaseConfig
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  : null;


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
    const { data } = await supabase.auth.getUser();
    return data.user ?? null;
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
