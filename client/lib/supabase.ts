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
      },
      global: {
        headers: {
          "Content-Type": "application/json",
        },
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
