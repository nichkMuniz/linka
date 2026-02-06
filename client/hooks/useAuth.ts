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

    getUserSafe()
      .then((u) => {
        if (isMounted) {
          setUser(u);
          setError(null);
        }
      })
      .catch((err) => {
        if (isMounted) {
          const errorMsg =
            err instanceof Error ? err.message : "Failed to authenticate";
          console.error("Auth error:", err);
          setUser(null);
          setError(errorMsg);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    // Only set up listener if we have a session
    const setupListener = async () => {
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

        unsubscribe = () => listener.subscription.unsubscribe();
      } catch (err) {
        console.error("Failed to set up auth listener:", err);
      }
    };

    setupListener();

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, []);

  return { user, loading, error };
}
