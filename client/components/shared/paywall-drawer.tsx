import React from "react";
import { Crown, TrendingUp, ListChecks, Utensils, Medal } from "lucide-react";
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

/**
 * Drawer de venda do LinKa Premium. Fase 1 (sem StoreKit): o CTA mostra um
 * toast "em breve". Na Fase 2 o CTA passa a abrir o fluxo de compra
 * (RevenueCat) — ver docs/17-premium.md.
 */
export function PaywallDrawer({ open, onOpenChange, feature }: PaywallDrawerProps) {
  const { t } = useLanguage();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        {...GLASS_SHEET_PROPS}
        className={cn(GLASS_SHEET_PROPS.className, "max-h-[85dvh]")}
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
        </div>

        <div
          className="shrink-0 space-y-2 p-5"
          style={{
            borderTop: "1px solid rgba(255,255,255,.08)",
            paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
          }}
        >
          <button
            type="button"
            className="w-full rounded-full py-3 text-sm font-bold active:scale-95 transition-transform"
            style={GLASS_PRIMARY_BTN_STYLE}
            onClick={() => toast.info(t("premium_coming_soon_toast"))}
          >
            {t("premium_cta_soon")}
          </button>
          <p className="text-center text-[11px]" style={{ color: "rgba(255,255,255,.45)" }}>
            {t("premium_price_placeholder")}
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
