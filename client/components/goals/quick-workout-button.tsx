import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Dumbbell } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { hapticLight } from "@/lib/haptics";

/**
 * Botão "Treino rápido" da tela de Metas (2026-10-02) — sempre visível (com ou
 * sem rotina), menos durante um treino. Comportamento no estilo do botão
 * "Instants" do Instagram:
 *
 *  1. nasce ESCONDIDO no canto inferior direito, mostrando só uma fresta
 *     (`PEEK_FRACTION` da largura — 30%: com 10% o botão quase não era notado);
 *  2. pouco depois desliza até o CENTRO da tela com o rótulo à mostra;
 *  3. segura alguns segundos e volta a se esconder na fresta.
 *
 * Toque em qualquer fase → inicia o treino rápido. Os 30% de fresta (~69px)
 * já passam dos 44px de alvo mínimo da Apple — sem área de toque extra.
 *
 * Com "Reduzir movimento" ligado no iOS, fica parado no canto, inteiro à
 * mostra — sem a animação, a fresta sozinha não diria o que é.
 */

const PEEK_FRACTION = 0.2;
/** Piso para a fresta nunca ficar menor que um alvo de toque (44px). */
const MIN_PEEK_PX = 44;
const REVEAL_DELAY_MS = 700;
const HOLD_MS = 3200;
/** Acima da barra de navegação flutuante (14px + 66px) com folga. */
const BOTTOM = "calc(96px + env(safe-area-inset-bottom))";

const SPRING = { type: "spring" as const, stiffness: 240, damping: 26, mass: 0.9 };

export function QuickWorkoutButton({ onStart }: { onStart: () => void }) {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const pillRef = React.useRef<HTMLButtonElement>(null);

  // Largura do botão e da tela — as duas posições (fresta e centro) dependem delas.
  const [geom, setGeom] = React.useState<{ w: number; vw: number } | null>(null);
  // A 1ª colocação na fresta é instantânea; só depois disso as trocas animam.
  const [placed, setPlaced] = React.useState(false);
  const [phase, setPhase] = React.useState<"peek" | "center">("peek");

  React.useLayoutEffect(() => {
    const el = pillRef.current;
    if (!el) return;
    const measure = () => setGeom({ w: el.offsetWidth, vw: window.innerWidth });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  React.useEffect(() => {
    if (!geom || placed) return;
    const id = requestAnimationFrame(() => setPlaced(true));
    return () => cancelAnimationFrame(id);
  }, [geom, placed]);

  // Sai para o centro, segura, volta para a fresta — uma vez por entrada na tela.
  React.useEffect(() => {
    if (!placed || reduceMotion) return;
    const toCenter = setTimeout(() => setPhase("center"), REVEAL_DELAY_MS);
    const toPeek = setTimeout(() => setPhase("peek"), REVEAL_DELAY_MS + HOLD_MS);
    return () => {
      clearTimeout(toCenter);
      clearTimeout(toPeek);
    };
  }, [placed, reduceMotion]);

  const handleStart = () => {
    hapticLight();
    onStart();
  };

  if (reduceMotion) {
    return (
      <div className="fixed z-40" style={{ right: 16, bottom: BOTTOM }}>
        <Pill ref={pillRef} onClick={handleStart} label={t("goals_quick_button")} hint={t("goals_quick_button_hint")} ariaLabel={t("goals_quick_button_aria")} />
      </div>
    );
  }

  const peekX = geom ? geom.w - Math.max(geom.w * PEEK_FRACTION, MIN_PEEK_PX) : 0;
  const centerX = geom ? -(geom.vw / 2 - geom.w / 2) : 0;
  const isPeek = phase === "peek";

  return (
    <motion.div
      className="fixed z-40"
      style={{ right: 0, bottom: BOTTOM }}
      initial={false}
      animate={{ x: isPeek ? peekX : centerX, opacity: geom ? 1 : 0 }}
      transition={placed ? SPRING : { duration: 0 }}
    >
      <Pill
        ref={pillRef}
        onClick={handleStart}
        label={t("goals_quick_button")}
        hint={t("goals_quick_button_hint")}
        ariaLabel={t("goals_quick_button_aria")}
        glowing={isPeek && placed}
      />
    </motion.div>
  );
}

const Pill = React.forwardRef<
  HTMLButtonElement,
  { onClick: () => void; label: string; hint: string; ariaLabel: string; glowing?: boolean }
>(function Pill({ onClick, label, hint, ariaLabel, glowing = false }, ref) {
  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      whileTap={{ scale: 0.95 }}
      // Escondido na fresta, um "respiro" de brilho chama o olho sem mexer o
      // botão de lugar.
      animate={
        glowing
          ? {
              boxShadow: [
                "0 10px 28px -10px rgba(91,140,255,.55)",
                "0 10px 34px -6px rgba(157,107,255,.85)",
                "0 10px 28px -10px rgba(91,140,255,.55)",
              ],
            }
          : { boxShadow: "0 14px 34px -10px rgba(91,140,255,.65)" }
      }
      transition={glowing ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
      className="flex items-center gap-3 rounded-full text-left"
      style={{
        padding: "10px 20px 10px 10px",
        minHeight: 56,
        background: "linear-gradient(135deg,#5b8cff,#9d6bff)",
        border: "1px solid rgba(255,255,255,.22)",
        color: "#fff",
        whiteSpace: "nowrap",
      }}
    >
      <span
        className="flex shrink-0 items-center justify-center rounded-full"
        style={{ width: 36, height: 36, background: "rgba(255,255,255,.2)" }}
      >
        <Dumbbell className="h-[19px] w-[19px]" strokeWidth={2.4} />
      </span>
      <span className="flex flex-col leading-tight">
        <span style={{ fontSize: 15, fontWeight: 800 }}>{label}</span>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "rgba(255,255,255,.82)" }}>{hint}</span>
      </span>
    </motion.button>
  );
});
