import React from "react";

/** Recurso que um dia foi pago. Mantido só para não reescrever os call sites. */
export type PremiumFeature =
  | "charts"
  | "routines"
  | "macros"
  | "badges"
  | "duels";

interface PremiumGateProps {
  feature: PremiumFeature;
  children: React.ReactNode;
  className?: string;
}

/**
 * Passa o conteúdo adiante, sempre.
 *
 * O app NÃO vende nada: não existe assinatura, plano (mensal, anual ou
 * qualquer outro) nem paywall. Este componente já era um no-op na prática —
 * todo usuário sempre teve acesso a tudo —, e o bloqueio visual (borrão +
 * cadeado + CTA de compra) foi removido junto com o paywall em 07/09/2026,
 * para que nada no binário referencie recurso pago.
 *
 * Continua existindo, e não foi apagado dos call sites, porque marca onde a
 * cobrança viveria se um dia voltar. Recuperar o gate real é `git show` no
 * commit anterior — nada foi reescrito, só apagado.
 */
export function PremiumGate({ children }: PremiumGateProps) {
  return <>{children}</>;
}
