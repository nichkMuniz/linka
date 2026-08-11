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
  // Uma leitura só do disco: serve de estado inicial E decide se a árvore
  // precisa esperar. Ler duas vezes daria dois JSON.parse no caminho crítico.
  const bootUserRef = React.useRef<User | null | undefined>(undefined);
  if (bootUserRef.current === undefined) bootUserRef.current = getInitialUserFromStorage();

  const [user, setUser] = React.useState<User | null>(() => bootUserRef.current ?? null);
  // `loading` só bloqueia a árvore quando NÃO sabemos quem é o usuário.
  //
  // Antes começava sempre `true`, e o app inteiro ficava atrás da tela vazia do
  // `AuthLoadingScreen` até `getUserSafe()` resolver. Só que `getSession()` não
  // é local quando o access token venceu (vive 1h — ou seja, quase todo cold
  // start): com `autoRefreshToken`, ele espera o refresh na rede, e esse fetch
  // ainda passa pelo `fetchWithRetry` (até 4 tentativas, ~2,1s de backoff em
  // rede ruim). O usuário olhava para uma tela em branco durante todo esse
  // tempo — com a sessão já lida do localStorage duas linhas acima.
  //
  // Com sessão em disco, renderizamos na hora e deixamos a verificação
  // assíncrona corrigir depois. Se o token estiver de fato inválido, o
  // `onAuthStateChange` derruba o user e o RequireAuth manda para o login; e
  // quem realmente barra conta banida é o `banned_until` do GoTrue, não isto.
  const [loading, setLoading] = React.useState(() => bootUserRef.current === null);

  React.useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      setUser(null);
      setLoading(false);
      return;
    }

    let isMounted = true;

    // Troca a identidade do objeto `user` só quando a PESSOA muda.
    //
    // Cada refresh de token entrega um objeto `user` novo com o mesmo id. Como
    // o `value` do contexto é memoizado por `[user, loading]`, essa identidade
    // nova invalidava todo `useCallback`/`useMemo` que depende de `user` nas
    // telas — e, como esses callbacks são dependência dos `useEffect` de carga,
    // um simples refresh de token disparava refetch em cascata pelo app inteiro.
    const setUserIfChanged = (next: User | null) => {
      if (!isMounted) return;
      setUser((prev) => (prev?.id === next?.id ? prev : next));
    };

    // Verify session with server once on mount.
    //
    // Este `null` NÃO desloga: `getUserSafe()` devolve null também quando a rede
    // falhou ("Failed to fetch" é tratado lá dentro). Antes isso era inofensivo
    // porque a tela ainda estava bloqueada por `loading`; agora que já
    // renderizamos a partir do disco, aceitar esse null jogaria no login quem
    // abriu o app sem internet — justamente o cenário que o modo offline existe
    // para atender. Quem desloga de verdade é o `onAuthStateChange` (SIGNED_OUT),
    // e o `resetSupabaseAuth()` do próprio `getUserSafe` quando o refresh token
    // é inválido — esse caminho emite SIGNED_OUT e cai no listener abaixo.
    getUserSafe()
      .then((u) => {
        if (u) setUserIfChanged(u);
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
          setUserIfChanged(session?.user ?? null);
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
