import * as React from "react";
import type { User } from "@supabase/supabase-js";
import { getUserSafe, hasSupabaseConfig, supabase } from "@/lib/supabase";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
}

const AuthContext = React.createContext<AuthContextValue>({
  user: null,
  loading: true,
});

function getInitialUserFromStorage(): User | null {
  try {
    const keys = Object.keys(window.localStorage);
    const authKey = keys.find(
      (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
    );
    if (authKey) {
      const session = JSON.parse(window.localStorage.getItem(authKey) || "{}");
      return session?.user || null;
    }
  } catch {
    // ignore
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(getInitialUserFromStorage);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      setUser(null);
      setLoading(false);
      return;
    }

    let isMounted = true;

    // Verify session with server once on mount
    getUserSafe()
      .then((u) => {
        if (isMounted) setUser(u);
      })
      .catch(() => {
        // getUserSafe already handles errors, keep localStorage user
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    // Single listener for the entire app lifetime
    let unsubscribe: (() => void) | null = null;
    try {
      const { data: listener } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          if (isMounted) setUser(session?.user ?? null);
        },
      );
      unsubscribe = () => {
        try {
          listener.subscription.unsubscribe();
        } catch {
          // ignore
        }
      };
    } catch (err) {
      console.warn("[AuthProvider] Failed to set up auth listener:", err);
    }

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, []);

  const value = React.useMemo(() => ({ user, loading }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  return React.useContext(AuthContext);
}
