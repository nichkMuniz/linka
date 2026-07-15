import React from "react";
import { Lock } from "lucide-react";
import { usePremium } from "@/lib/premium-context";
import { PaywallDrawer, type PremiumFeature } from "@/components/shared/paywall-drawer";
import { GLASS_PRIMARY_BTN_STYLE } from "@/lib/glass-styles";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/language-context";

interface PremiumGateProps {
  feature: PremiumFeature;
  children: React.ReactNode;
  className?: string;
}

/**
 * Gate visual de conteúdo premium: assinante vê os children direto; usuário
 * grátis vê o conteúdo borrado (inclusive dados reais — é o "teaser") com um
 * cadeado e um CTA que abre o PaywallDrawer.
 *
 * O drawer só monta quando aberto (estado local), então vários gates na mesma
 * tela não custam nada. Bloqueios de AÇÃO (criar rotina/duelo) não usam este
 * componente — abrem o PaywallDrawer direto no handler.
 */
export function PremiumGate({ feature, children, className }: PremiumGateProps) {
  const { isPremium } = usePremium();
  const { t } = useLanguage();
  const [paywallOpen, setPaywallOpen] = React.useState(false);

  if (isPremium) return <>{children}</>;

  return (
    <div className={cn("relative overflow-hidden rounded-2xl", className)}>
      <div
        aria-hidden
        className="pointer-events-none select-none"
        style={{ filter: "blur(8px)" }}
      >
        {children}
      </div>
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 p-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: "rgba(14,13,20,.7)", border: "1px solid rgba(255,255,255,.18)" }}
        >
          <Lock className="h-4 w-4 text-amber-400" />
        </div>
        <p className="text-xs font-semibold text-center" style={{ color: "#fff", textShadow: "0 1px 8px rgba(0,0,0,.8)" }}>
          {t("premium_gate_title")}
        </p>
        <button
          type="button"
          className="rounded-full px-4 py-1.5 text-xs font-bold active:scale-95 transition-transform"
          style={GLASS_PRIMARY_BTN_STYLE}
          onClick={() => setPaywallOpen(true)}
        >
          {t("premium_gate_cta")}
        </button>
      </div>
      {paywallOpen && (
        <PaywallDrawer open={paywallOpen} onOpenChange={setPaywallOpen} feature={feature} />
      )}
    </div>
  );
}
