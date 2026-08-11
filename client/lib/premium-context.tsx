import * as React from "react";
import { useAuthContext } from "@/lib/auth-context";
import {
  configurePurchases,
  hasActiveEntitlement,
  isPurchasesAvailable,
  logOutPurchases,
} from "@/lib/purchases";

interface PremiumContextValue {
  /** true = assinante ativo. Enquanto carrega, false (gates fecham por padrão). */
  isPremium: boolean;
  loading: boolean;
  /** Invalida o cache e relê o status (banco + entitlement da loja). */
  refresh: () => Promise<void>;
  /**
   * Libera o acesso na hora, sem esperar o banco.
   *
   * Usado logo após uma compra ou restauração bem-sucedida: o entitlement da
   * Apple já é definitivo naquele instante, mas a linha em `subscriptions` só
   * aparece quando o webhook do RevenueCat chegar (segundos) e o cache do
   * status vencer (60s). Sem isto o usuário paga e continua vendo cadeado.
   */
  applyPurchase: () => void;
}

/**
 * `ritmofit-db` só é tocado dentro de callbacks assíncronos, nunca no render.
 * Importar estaticamente aqui arrastava o módulo inteiro (12k linhas, 328
 * funções) para o chunk de ENTRADA — este provider é montado direto no App.tsx,
 * então tudo que ele importa entra no caminho crítico do primeiro frame.
 * Duas funções não justificam esse custo; o import dinâmico é resolvido no
 * mesmo tick em que a carga do status acontece, que já é assíncrona.
 */
const db = () => import("@/lib/ritmofit-db");

const PremiumContext = React.createContext<PremiumContextValue>({
  isPremium: false,
  loading: false,
  refresh: async () => {},
  applyPurchase: () => {},
});

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthContext();
  const [dbPremium, setDbPremium] = React.useState(false);
  /**
   * Entitlement segundo a loja (RevenueCat). Mantido SEPARADO do status do
   * banco e combinado por OR — as duas fontes cobrem casos diferentes:
   *   • banco  → liberação manual do admin (não existe na loja);
   *   • loja   → assinatura recém-comprada, ou webhook que falhou/atrasou.
   * Se dependêssemos só do banco, uma falha no webhook deixaria um assinante
   * pagante sem acesso — o pior desfecho possível.
   */
  const [storePremium, setStorePremium] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const userId = user?.id ?? null;

  const load = React.useCallback(async () => {
    if (!userId) {
      setDbPremium(false);
      setStorePremium(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setDbPremium(await (await db()).getPremiumStatusDb());
    } catch {
      setDbPremium(false);
    }

    if (isPurchasesAvailable()) {
      try {
        const ready = await configurePurchases(userId);
        if (ready) setStorePremium(await hasActiveEntitlement());
      } catch {
        // Falha de SDK nunca derruba o status vindo do banco.
      }
    }

    setLoading(false);
  }, [userId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Encerra a sessão da loja junto com a do app: sem isto, a próxima conta a
  // entrar neste aparelho herdaria o cache de entitlements da anterior.
  React.useEffect(() => {
    if (userId) return;
    void logOutPurchases();
  }, [userId]);

  const refresh = React.useCallback(async () => {
    await (await db()).invalidatePremiumStatus();
    await load();
  }, [load]);

  const applyPurchase = React.useCallback(() => {
    setStorePremium(true);
    // Reconcilia com o banco em background — quando o webhook gravar, o status
    // passa a vir das duas fontes. Um erro aqui não retira o acesso concedido.
    void (async () => {
      const { invalidatePremiumStatus, getPremiumStatusDb } = await db();
      await invalidatePremiumStatus();
      try {
        setDbPremium(await getPremiumStatusDb());
      } catch {
        /* mantém o acesso concedido pela loja */
      }
    })();
  }, []);

  const value = React.useMemo(
    () => ({
      isPremium: dbPremium || storePremium,
      loading,
      refresh,
      applyPurchase,
    }),
    [dbPremium, storePremium, loading, refresh, applyPurchase],
  );

  return (
    <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>
  );
}

export function usePremium(): PremiumContextValue {
  return React.useContext(PremiumContext);
}
