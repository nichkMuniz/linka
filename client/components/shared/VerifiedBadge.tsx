import * as React from "react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/language-context";
import type { VerifiedTier } from "@/lib/verified-tier";

interface VerifiedBadgeProps {
  /** Size variant: "sm" (14px), "md" (16px, default), "lg" (20px) */
  size?: "sm" | "md" | "lg";
  /**
   * Nível do selo. `official` = equipe LinKa (roseta dourada);
   * `notable` = usuário importante (círculo azul). Padrão: `notable`.
   */
  tier?: VerifiedTier | null;
  className?: string;
}

const sizeMap = {
  sm: "w-3.5 h-3.5",
  md: "w-4 h-4",
  lg: "w-5 h-5",
};

// Roseta de 8 pontas (viewBox 20x20), gerada alternando raio externo/interno.
// Forma diferente do círculo do `notable` para o selo oficial ser reconhecível
// mesmo para quem não distingue as cores.
const ROSETTE_PATH = (() => {
  const points = 16;
  const outer = 10;
  const inner = 8.4;
  let d = "";
  for (let i = 0; i < points; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * 2 * i) / points - Math.PI / 2;
    const x = (10 + r * Math.cos(a)).toFixed(2);
    const y = (10 + r * Math.sin(a)).toFixed(2);
    d += `${i === 0 ? "M" : "L"}${x} ${y}`;
  }
  return `${d}Z`;
})();

const TIER_STYLE: Record<VerifiedTier, { from: string; to: string }> = {
  official: { from: "#FFB800", to: "#FF8A2A" },
  notable: { from: "#3B9BFF", to: "#1D6FE8" },
};

/**
 * Selo de verificação exibido ao lado do nome. Quem chama decide se mostra
 * (via `verifiedTier`); aqui só se escolhe cor e forma pelo nível.
 */
export function VerifiedBadge({ size = "md", tier, className }: VerifiedBadgeProps) {
  const { t } = useLanguage();
  const uid = React.useId();
  const gradientId = `vbg${uid.replace(/:/g, "")}`;
  const level: VerifiedTier = tier === "official" ? "official" : "notable";
  const style = TIER_STYLE[level];
  const label = level === "official" ? t("verified_official_label") : t("verified_notable_label");

  return (
    <span
      title={label}
      aria-label={label}
      className={cn("inline-flex items-center justify-center shrink-0", sizeMap[size], className)}
    >
      <svg
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        aria-hidden="true"
      >
        {level === "official" ? (
          <path d={ROSETTE_PATH} fill={`url(#${gradientId})`} />
        ) : (
          <circle cx="10" cy="10" r="10" fill={`url(#${gradientId})`} />
        )}
        <path
          d="M6 10.5L8.5 13L14 7.5"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="20" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={style.from} />
            <stop offset="100%" stopColor={style.to} />
          </linearGradient>
        </defs>
      </svg>
    </span>
  );
}
