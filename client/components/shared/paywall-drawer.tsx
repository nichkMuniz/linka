import React from "react";
import { Crown, TrendingUp, ListChecks, Utensils, Medal, Check } from "lucide-react";
import { Browser } from "@capacitor/browser";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  GLASS_PANEL_STYLE,
  GLASS_PRIMARY_BTN_STYLE,
  GLASS_SHEET_PROPS,
  GLASS_SHEET_STYLE,
} from "@/lib/glass-styles";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/language-context";
import { usePremium } from "@/lib/premium-context";
import { PRIVACY_URL, TERMS_URL } from "@/lib/share-url";
import {
  getPremiumPackages,
  isPurchasesAvailable,
  purchasePremium,
  restorePremiumPurchases,
  type PurchasesPackage,
} from "@/lib/purchases";

/** Recurso que motivou a abertura do paywall (destaca o benefício na lista). */
export type PremiumFeature =
  | "charts"
  | "routines"
  | "macros"
  | "badges"
  | "duels";

interface PaywallDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature?: PremiumFeature;
}

const BENEFITS: Array<{
  features: PremiumFeature[];
  icon: React.ElementType;
  titleKey: string;
  descKey: string;
}> = [
  { features: ["charts"], icon: TrendingUp, titleKey: "premium_benefit_charts", descKey: "premium_benefit_charts_desc" },
  { features: ["routines"], icon: ListChecks, titleKey: "premium_benefit_routines", descKey: "premium_benefit_routines_desc" },
  { features: ["macros"], icon: Utensils, titleKey: "premium_benefit_macros", descKey: "premium_benefit_macros_desc" },
  { features: ["badges", "duels"], icon: Medal, titleKey: "premium_benefit_badges_duels", descKey: "premium_benefit_badges_duels_desc" },
];

/** Rótulo e sufixo de período a partir do tipo de pacote do RevenueCat. */
function planLabelKeys(packageType: string): { title: string; period: string | null } {
  switch (packageType) {
    case "ANNUAL":
      return { title: "premium_plan_annual", period: "premium_plan_period_year" };
    case "MONTHLY":
      return { title: "premium_plan_monthly", period: "premium_plan_period_month" };
    case "WEEKLY":
      return { title: "premium_plan_weekly", period: "premium_plan_period_week" };
    case "LIFETIME":
      return { title: "premium_plan_lifetime", period: null };
    default:
      return { title: "premium_title", period: null };
  }
}

/** "P7D"/"P1W" → 7 dias. Usado só para anunciar o período gratuito. */
function trialDays(period: string | null | undefined): number | null {
  if (!period) return null;
  const match = /^P(\d+)([DWMY])$/.exec(period);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2];
  if (unit === "D") return value;
  if (unit === "W") return value * 7;
  if (unit === "M") return value * 30;
  if (unit === "Y") return value * 365;
  return null;
}

/**
 * Drawer de venda do LinKa Premium.
 *
 * Os planos NÃO são hardcoded: vêm da oferta "current" configurada no painel do
 * RevenueCat, e o preço vem formatado pela Apple na moeda do aparelho. Mudar de
 * plano ou de preço é mexer no painel, sem release novo.
 *
 * A seção legal do rodapé é requisito da App Store Review Guideline 3.1.2 —
 * termos de renovação automática + links funcionais para Termos de Uso e
 * Política de Privacidade. Não remover.
 */
export function PaywallDrawer({ open, onOpenChange, feature }: PaywallDrawerProps) {
  const { t } = useLanguage();
  const { applyPurchase } = usePremium();

  const [packages, setPackages] = React.useState<PurchasesPackage[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [loadingPlans, setLoadingPlans] = React.useState(false);
  const [purchasing, setPurchasing] = React.useState(false);
  const [restoring, setRestoring] = React.useState(false);

  const available = isPurchasesAvailable();

  // Carrega a oferta a cada abertura: preço e disponibilidade são definidos na
  // App Store e podem mudar sem o app saber.
  React.useEffect(() => {
    if (!open || !available) return;
    let cancelled = false;

    setLoadingPlans(true);
    void (async () => {
      const result = await getPremiumPackages();
      if (cancelled) return;
      setPackages(result);
      // Pré-seleciona o anual quando existir (melhor valor por período), senão o primeiro.
      const preferred =
        result.find((p) => p.packageType === "ANNUAL") ?? result[0] ?? null;
      setSelectedId(preferred?.identifier ?? null);
      setLoadingPlans(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, available]);

  const selected = packages.find((p) => p.identifier === selectedId) ?? null;

  const handlePurchase = async () => {
    if (!selected || purchasing) return;
    setPurchasing(true);
    const outcome = await purchasePremium(selected);
    setPurchasing(false);

    switch (outcome.status) {
      case "purchased":
        applyPurchase();
        toast.success(t("premium_purchase_success_title"), {
          description: t("premium_purchase_success_desc"),
        });
        onOpenChange(false);
        break;
      case "cancelled":
        // Usuário fechou a folha de pagamento da Apple. Não é erro — silêncio.
        break;
      case "no_entitlement":
        toast.error(t("premium_purchase_no_entitlement"));
        break;
      default:
        toast.error(t("premium_purchase_error"));
    }
  };

  const handleRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    const restored = await restorePremiumPurchases();
    setRestoring(false);

    if (restored) {
      applyPurchase();
      toast.success(t("premium_restore_success"));
      onOpenChange(false);
    } else {
      toast.info(t("premium_restore_none"));
    }
  };

  const openLegal = (url: string) => {
    // Browser do Capacitor: a Apple exige que o link seja funcional dentro do
    // app. `window.open` abriria fora do controle do app (ver CLAUDE.md §0).
    void Browser.open({ url });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        {...GLASS_SHEET_PROPS}
        className={cn(GLASS_SHEET_PROPS.className, "max-h-[92dvh]")}
        style={GLASS_SHEET_STYLE}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DrawerHeader className="shrink-0 items-center text-center">
          <div
            className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: "linear-gradient(135deg,rgba(91,140,255,.25),rgba(157,107,255,.25))", border: "1px solid rgba(255,255,255,.18)" }}
          >
            <Crown className="h-7 w-7 text-amber-400" />
          </div>
          <DrawerTitle style={{ color: "#fff" }}>{t("premium_title")}</DrawerTitle>
          <DrawerDescription style={{ color: "rgba(255,255,255,.5)" }}>
            {t("premium_subtitle")}
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 py-2 scrollbar-hide">
          <div className="space-y-3 pb-2">
            {BENEFITS.map((benefit) => {
              const Icon = benefit.icon;
              const highlighted = !!feature && benefit.features.includes(feature);
              return (
                <div
                  key={benefit.titleKey}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl p-4",
                    highlighted && "ring-2 ring-[#9d6bff]/60",
                  )}
                  style={GLASS_PANEL_STYLE}
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: "rgba(255,255,255,.08)" }}
                  >
                    <Icon className="h-5 w-5 text-[#9d6bff]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "#fff" }}>
                      {t(benefit.titleKey as any)}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,.5)" }}>
                      {t(benefit.descKey as any)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Seletor de plano */}
          {available && packages.length > 0 && (
            <div className="mt-4 space-y-2 pb-2">
              {packages.map((pkg) => {
                const keys = planLabelKeys(String(pkg.packageType));
                const isSelected = pkg.identifier === selectedId;
                const trial = trialDays(pkg.product.introPrice?.period);
                return (
                  <button
                    key={pkg.identifier}
                    type="button"
                    onClick={() => setSelectedId(pkg.identifier)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-all active:scale-[.98]",
                      isSelected && "ring-2 ring-[#9d6bff]",
                    )}
                    style={GLASS_PANEL_STYLE}
                  >
                    <div
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                      style={{
                        background: isSelected ? "#9d6bff" : "transparent",
                        border: isSelected ? "none" : "1px solid rgba(255,255,255,.3)",
                      }}
                    >
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold" style={{ color: "#fff" }}>
                        {t(keys.title as any)}
                      </p>
                      {trial !== null && (
                        <p className="text-xs mt-0.5 text-[#9d6bff]">
                          {t("premium_plan_free_trial").replace("{n}", String(trial))}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-sm font-bold" style={{ color: "#fff" }}>
                        {pkg.product.priceString}
                      </span>
                      {keys.period && (
                        <span className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
                          {t(keys.period as any)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div
          className="shrink-0 space-y-2 p-5"
          style={{
            borderTop: "1px solid rgba(255,255,255,.08)",
            paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
          }}
        >
          {/* Sem SDK (navegador em dev) ou sem oferta configurada: nada de CTA
              de compra, que levaria a um erro sem explicação. */}
          {!available || (!loadingPlans && packages.length === 0) ? (
            <p className="text-center text-xs py-2" style={{ color: "rgba(255,255,255,.5)" }}>
              {t("premium_unavailable")}
            </p>
          ) : (
            <>
              <button
                type="button"
                disabled={loadingPlans || purchasing || !selected}
                className="w-full rounded-full py-3 text-sm font-bold active:scale-95 transition-transform disabled:opacity-50"
                style={GLASS_PRIMARY_BTN_STYLE}
                onClick={() => void handlePurchase()}
              >
                {loadingPlans
                  ? t("premium_loading_plans")
                  : purchasing
                    ? t("premium_cta_purchasing")
                    : t("premium_cta_subscribe")}
              </button>

              {/* Restaurar compras — obrigatório pela Guideline 3.1.1. */}
              <button
                type="button"
                disabled={restoring}
                className="w-full rounded-full py-2 text-xs font-medium disabled:opacity-50"
                style={{ color: "rgba(255,255,255,.7)" }}
                onClick={() => void handleRestore()}
              >
                {restoring ? t("premium_restoring") : t("premium_restore")}
              </button>
            </>
          )}

          {/* Requisito da Guideline 3.1.2: condições de renovação + links. */}
          <p className="text-center text-[10px] leading-relaxed pt-1" style={{ color: "rgba(255,255,255,.4)" }}>
            {t("premium_legal_intro")}
          </p>
          <div className="flex items-center justify-center gap-3 text-[11px]">
            <button
              type="button"
              className="underline"
              style={{ color: "rgba(255,255,255,.55)" }}
              onClick={() => openLegal(TERMS_URL)}
            >
              {t("premium_terms")}
            </button>
            <span style={{ color: "rgba(255,255,255,.25)" }}>·</span>
            <button
              type="button"
              className="underline"
              style={{ color: "rgba(255,255,255,.55)" }}
              onClick={() => openLegal(PRIVACY_URL)}
            >
              {t("premium_privacy")}
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
