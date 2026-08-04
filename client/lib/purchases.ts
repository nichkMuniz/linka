/**
 * Compras dentro do app (In-App Purchase) via RevenueCat.
 *
 * O RevenueCat é a camada entre o app e a StoreKit da Apple: ele valida o
 * recibo no servidor dele, mantém o estado da assinatura e dispara um webhook
 * para a nossa edge function, que grava em `subscriptions`. Ver `docs/17-premium.md`.
 *
 * TUDO AQUI É NO-OP FORA DO APP NATIVO. No navegador (`pnpm dev`) não existe
 * StoreKit; as funções devolvem vazio/false em vez de estourar, para a tela de
 * paywall continuar renderizável durante o desenvolvimento.
 *
 * NADA aqui concede acesso sozinho. Quem decide se o usuário é premium é o
 * `PremiumProvider`, que combina o status do banco (que cobre a liberação
 * manual do admin) com o entitlement do RevenueCat.
 */

import { Capacitor } from "@capacitor/core";
import { Purchases, LOG_LEVEL } from "@revenuecat/purchases-capacitor";
import type {
  CustomerInfo,
  PurchasesPackage,
} from "@revenuecat/purchases-capacitor";

/**
 * Identificador do entitlement no painel do RevenueCat.
 * Precisa bater EXATAMENTE com o configurado lá — se não bater, a compra é
 * aprovada pela Apple e o app segue achando que o usuário não é assinante.
 */
export const PREMIUM_ENTITLEMENT = "premium";

/**
 * Chave pública do SDK para iOS (RevenueCat → Project Settings → API keys →
 * "App Store" public SDK key). É pública por natureza: nasce para ser embutida
 * no binário. Injetada no build (Appflow/Vercel) como `VITE_REVENUECAT_IOS_KEY`.
 */
const API_KEY = import.meta.env.VITE_REVENUECAT_IOS_KEY as string | undefined;

const isNative = () => Capacitor.isNativePlatform();

/** SDK disponível de verdade (nativo + chave configurada no build)? */
export function isPurchasesAvailable(): boolean {
  return isNative() && !!API_KEY;
}

let configuredForUser: string | null = null;
let configurePromise: Promise<boolean> | null = null;

/**
 * Configura o SDK e associa a sessão ao usuário do Supabase.
 *
 * O `appUserID` é o `user.id` do Supabase Auth — é ele que chega no webhook e
 * permite casar o evento do RevenueCat com a linha certa de `subscriptions`.
 * Deixar o RevenueCat gerar um ID anônimo quebraria esse elo.
 *
 * Idempotente: `configure` roda uma vez por processo; trocar de usuário emite
 * um `logIn`, que é o caminho suportado pelo SDK (reconfigurar não é).
 */
export async function configurePurchases(userId: string): Promise<boolean> {
  if (!isPurchasesAvailable()) return false;

  if (configuredForUser === userId) return true;

  // Primeira configuração do processo.
  if (!configurePromise) {
    configurePromise = (async () => {
      try {
        if (import.meta.env.DEV) {
          await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
        }
        await Purchases.configure({ apiKey: API_KEY!, appUserID: userId });
        configuredForUser = userId;
        return true;
      } catch (error) {
        console.error("[purchases] configure falhou", error);
        configurePromise = null;
        return false;
      }
    })();
    return configurePromise;
  }

  const ready = await configurePromise;
  if (!ready) return false;

  // Já configurado, mas para outro usuário (troca de conta sem matar o app).
  if (configuredForUser !== userId) {
    try {
      await Purchases.logIn({ appUserID: userId });
      configuredForUser = userId;
    } catch (error) {
      console.error("[purchases] logIn falhou", error);
      return false;
    }
  }
  return true;
}

/**
 * Desassocia o usuário no logout. Sem isso, a próxima conta a entrar no mesmo
 * aparelho herdaria o cache de entitlements da anterior.
 */
export async function logOutPurchases(): Promise<void> {
  if (!isPurchasesAvailable() || !configuredForUser) return;
  try {
    await Purchases.logOut();
  } catch {
    // logOut estoura se o usuário atual já é anônimo — irrelevante aqui.
  }
  configuredForUser = null;
}

function hasPremium(info: CustomerInfo | undefined | null): boolean {
  return !!info?.entitlements?.active?.[PREMIUM_ENTITLEMENT];
}

/**
 * O entitlement está ativo segundo o RevenueCat?
 *
 * Consultado no boot como **rede de segurança**: se o webhook falhar ou
 * atrasar, o app não deixa um assinante pagante sem acesso. O SDK responde do
 * cache local quando está offline.
 */
export async function hasActiveEntitlement(): Promise<boolean> {
  if (!isPurchasesAvailable() || !configuredForUser) return false;
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return hasPremium(customerInfo);
  } catch (error) {
    console.error("[purchases] getCustomerInfo falhou", error);
    return false;
  }
}

/**
 * Pacotes da oferta atual (RevenueCat → Offerings → "current").
 *
 * Devolve o que estiver configurado lá — mensal, anual, o que for. O paywall
 * renderiza a lista como vier, então mudar de plano é mexer no painel do
 * RevenueCat, sem release novo. Preço e moeda vêm formatados pela Apple em
 * `product.priceString`, já no idioma/região do aparelho.
 */
export async function getPremiumPackages(): Promise<PurchasesPackage[]> {
  if (!isPurchasesAvailable()) return [];
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages ?? [];
  } catch (error) {
    console.error("[purchases] getOfferings falhou", error);
    return [];
  }
}

export type PurchaseOutcome =
  | { status: "purchased" }
  /** Usuário fechou a folha de pagamento da Apple — não é erro, não avisar. */
  | { status: "cancelled" }
  /** Compra concluída mas sem o entitlement: configuração errada no RevenueCat. */
  | { status: "no_entitlement" }
  | { status: "error"; message?: string };

/** Código da Apple/RevenueCat para "usuário cancelou". */
const CANCELLED_CODE = "1";

export async function purchasePremium(
  pkg: PurchasesPackage,
): Promise<PurchaseOutcome> {
  if (!isPurchasesAvailable()) return { status: "error" };

  try {
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    return hasPremium(customerInfo)
      ? { status: "purchased" }
      : { status: "no_entitlement" };
  } catch (error) {
    const err = error as { code?: string; userCancelled?: boolean; message?: string };
    if (err?.userCancelled || String(err?.code) === CANCELLED_CODE) {
      return { status: "cancelled" };
    }
    console.error("[purchases] purchasePackage falhou", error);
    return { status: "error", message: err?.message };
  }
}

/**
 * Restaurar compras — **obrigatório** pela App Store Review Guideline 3.1.1
 * em qualquer app com IAP. É o caminho de quem trocou de aparelho ou
 * reinstalou o app.
 *
 * @returns true se o entitlement premium voltou ativo.
 */
export async function restorePremiumPurchases(): Promise<boolean> {
  if (!isPurchasesAvailable()) return false;
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    return hasPremium(customerInfo);
  } catch (error) {
    console.error("[purchases] restorePurchases falhou", error);
    return false;
  }
}

export type { PurchasesPackage };
