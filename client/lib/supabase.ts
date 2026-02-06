import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = hasSupabaseConfig
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Disable automatic session refresh on init to avoid network errors
        flowType: "implicit",
      },
      global: {
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        fetch: createNetworkAwareFetch(),
      },
    })
  : null;

// Custom fetch wrapper to handle network failures gracefully
function createNetworkAwareFetch() {
  return async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    try {
      // Add timeout to fetch requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        const response = await fetch(input, {
          ...init,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    } catch (err) {
      // Log network errors but don't re-throw to allow graceful degradation
      if (
        err instanceof TypeError &&
        (err.message.includes("Failed to fetch") ||
          err.message.includes("Network request failed") ||
          err.message.includes("AbortError"))
      ) {
        console.warn(
          "[Supabase Network] Request failed - returning offline response",
          {
            url: String(input),
            error: err.message,
          },
        );
        // Return a 503 Service Unavailable response to indicate offline state
        return new Response(JSON.stringify({ error: "Network unavailable" }), {
          status: 503,
          statusText: "Service Unavailable",
          headers: { "Content-Type": "application/json" },
        });
      }
      throw err;
    }
  };
}

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
  }
}

export async function getUserSafe(): Promise<User | null> {
  if (!supabase) return null;

  try {
    const { data } = await supabase.auth.getUser();
    return data.user ?? null;
  } catch (err) {
    // Handle network-level errors (fetch failures)
    if (err instanceof TypeError && err.message.includes("Failed to fetch")) {
      console.error(
        "[getUserSafe] Network error reaching Supabase. This may be a CORS issue or network connectivity problem.",
        err,
      );
      // Return null instead of throwing to allow the app to load
      // The session might be in localStorage and can be used
      return null;
    }

    if (isInvalidRefreshTokenError(err)) {
      await resetSupabaseAuth();
      return null;
    }

    console.error("[getUserSafe] Auth error:", err);
    throw err;
  }
}
