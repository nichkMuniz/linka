import { useEffect, useState } from "react";

import { getUserSafe, hasSupabaseConfig, supabase } from "@/lib/supabase";

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      setUser(null);
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | null = null;

    getUserSafe()
      .then((u) => {
        setUser(u);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      },
    );

    unsubscribe = () => listener.subscription.unsubscribe();

    return () => {
      unsubscribe?.();
    };
  }, []);

  return { user, loading };
}
