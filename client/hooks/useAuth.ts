import { useEffect, useState } from "react";

import { getUserSafe, hasSupabaseConfig, supabase } from "@/lib/supabase";

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      setUser(null);
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | null = null;
    let isMounted = true;
    let listenerSetupAttempted = false;

    // Try to get user from localStorage first (faster and doesn't require network)
    const getInitialUser = () => {
      try {
        // Supabase stores session in localStorage
        const keys = Object.keys(window.localStorage);
        const authKey = keys.find(
          (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
        );
        if (authKey) {
          const session = JSON.parse(window.localStorage.getItem(authKey) || "{}");
          return session?.user || null;
        }
      } catch {
        // Ignore localStorage errors
      }
      return null;
    };

    // Set initial user from localStorage to avoid waiting for network
    const initialUser = getInitialUser();
    if (initialUser) {
      setUser(initialUser);
    }

    // Then verify with server (may fail due to network)
    getUserSafe()
      .then((u) => {
        if (isMounted) {
          if (u !== initialUser) {
            setUser(u);
          }
          setError(null);
        }
      })
      .catch((err) => {
        if (isMounted) {
          // Don't log errors - getUserSafe already handles them and returns null on failure
          // We may have a valid user from localStorage
          setError(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    // Set up auth state change listener
    const setupListener = () => {
      if (listenerSetupAttempted || !supabase) return;
      listenerSetupAttempted = true;

      try {
        const { data: listener } = supabase.auth.onAuthStateChange(
          (_event, session) => {
            if (isMounted) {
              setUser(session?.user ?? null);
              if (session?.user) {
                setError(null);
              }
            }
          },
        );

        unsubscribe = () => {
          try {
            listener.subscription.unsubscribe();
          } catch {
            // Ignore unsubscribe errors
          }
        };
      } catch (err) {
        console.warn("[useAuth] Failed to set up auth listener:", err);
        // This is non-fatal, user might still be logged in from localStorage
      }
    };

    // Setup listener with a small delay to ensure Supabase is ready
    const listenerId = setTimeout(setupListener, 100);

    return () => {
      isMounted = false;
      clearTimeout(listenerId);
      unsubscribe?.();
    };
  }, []);

  return { user, loading, error };
}
