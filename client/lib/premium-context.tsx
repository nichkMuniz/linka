import * as React from "react";
import { useAuthContext } from "@/lib/auth-context";
import {
  getPremiumStatusDb,
  invalidatePremiumStatus,
} from "@/lib/ritmofit-db";

interface PremiumContextValue {
  /** true = assinante ativo. Enquanto carrega, false (gates fecham por padrão). */
  isPremium: boolean;
  loading: boolean;
  /** Invalida o cache e relê o status (ex: após restaurar compra na Fase 2). */
  refresh: () => Promise<void>;
}

const PremiumContext = React.createContext<PremiumContextValue>({
  isPremium: false,
  loading: false,
  refresh: async () => {},
});

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthContext();
  const [isPremium, setIsPremium] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const userId = user?.id ?? null;

  const load = React.useCallback(async () => {
    if (!userId) {
      setIsPremium(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setIsPremium(await getPremiumStatusDb());
    } catch {
      setIsPremium(false);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const refresh = React.useCallback(async () => {
    await invalidatePremiumStatus();
    await load();
  }, [load]);

  const value = React.useMemo(
    () => ({ isPremium, loading, refresh }),
    [isPremium, loading, refresh],
  );

  return (
    <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>
  );
}

export function usePremium(): PremiumContextValue {
  return React.useContext(PremiumContext);
}
