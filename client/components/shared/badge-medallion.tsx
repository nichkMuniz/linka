import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A "cara" de uma insígnia (2026-10-06): o emoji dentro de um disco escuro com
 * aro em degradê âmbar → laranja (a cor de conquista do app — a mesma do card
 * de streak). Bloqueada = aro e emoji apagados.
 *
 * Usada no pop up de conquista, no diálogo do fim do treino e no drawer de
 * insígnias, para a insígnia ter a mesma cara em todo lugar.
 */

const SIZES = {
  sm: { box: 36, ring: 2, emoji: 18 },
  md: { box: 46, ring: 2.5, emoji: 23 },
  lg: { box: 104, ring: 4, emoji: 54 },
} as const;

export const BADGE_ACCENT_GRADIENT = "linear-gradient(135deg,#ffd27a 0%,#ff9a3c 55%,#ff6a3d 100%)";

export function BadgeMedallion({
  emoji,
  size = "md",
  locked = false,
  glow = false,
  className,
  style,
}: {
  emoji: string;
  size?: keyof typeof SIZES;
  locked?: boolean;
  /** Halo laranja em volta — para o momento da conquista. */
  glow?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const s = SIZES[size];
  return (
    <span
      aria-hidden
      className={cn("relative inline-flex shrink-0 items-center justify-center rounded-full", className)}
      style={{
        width: s.box,
        height: s.box,
        padding: s.ring,
        background: locked ? "rgba(255,255,255,.14)" : BADGE_ACCENT_GRADIENT,
        boxShadow: glow && !locked ? "0 0 0 1px rgba(255,170,90,.25), 0 8px 28px -6px rgba(255,138,42,.65)" : undefined,
        ...style,
      }}
    >
      <span
        className={cn("flex h-full w-full items-center justify-center rounded-full leading-none", locked && "grayscale opacity-60")}
        style={{
          fontSize: s.emoji,
          background: locked
            ? "#15141c"
            : "radial-gradient(circle at 50% 30%, #2b2433 0%, #15121b 70%)",
        }}
      >
        {emoji}
      </span>
    </span>
  );
}
