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
    if (isInvalidRefreshTokenError(err)) {
      await resetSupabaseAuth();
      return null;
    }

    throw err;
  }
}
