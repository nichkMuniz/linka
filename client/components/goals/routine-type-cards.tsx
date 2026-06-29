import { Dumbbell, Salad, Target } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import type { RoutineTypeCode } from "@/lib/ritmofit-db";

export interface RoutineTypeProgress {
  type: RoutineTypeCode;
  title: string;
  subtitle: string;
  /** 0–100 */
  perc: number;
  focus?: boolean;
  hasRoutine: boolean;
}

interface RoutineTypeCardsProps {
  items: RoutineTypeProgress[];
  onOpen: (type: RoutineTypeCode) => void;
}

const TYPE_STYLE: Record<RoutineTypeCode, { from: string; to: string; ring: string }> = {
  1: { from: "#ff9d6c", to: "#d8567a", ring: "#ff8a2a" },
  2: { from: "#5fd6a0", to: "#1f8a5b", ring: "#5fd6a0" },
  3: { from: "#b08cff", to: "#7b3ff2", ring: "#b08cff" },
};

function TypeIcon({ type }: { type: RoutineTypeCode }) {
  const cls = "h-6 w-6";
  if (type === 1) return <Dumbbell className={cls} />;
  if (type === 2) return <Salad className={cls} />;
  return <Target className={cls} />;
}

/**
 * "Suas rotinas" — fileira de 3 cards (Exercícios / Dieta / Hábitos) com anel
 * de progresso do dia, no estilo glass do protótipo Direção A.
 */
export function RoutineTypeCards({ items, onOpen }: RoutineTypeCardsProps) {
  const { t } = useLanguage();

  return (
    <div className="space-y-3">
      <div className="flex items-center px-1">
        <h2 className="text-white" style={{ fontSize: "18px", fontWeight: 740, letterSpacing: "-0.01em" }}>
          {t("goals_dash_your_routines")}
        </h2>
      </div>

      <div className="flex flex-col gap-2.5">
        {items.map((item) => {
          const c = TYPE_STYLE[item.type];
          const perc = Math.max(0, Math.min(100, Math.round(item.perc)));
          const deg = Math.round((perc / 100) * 360);
          return (
            <button
              key={item.type}
              onClick={() => onOpen(item.type)}
              className="w-full text-left flex items-center gap-3 active:scale-[0.99] transition-transform"
              style={{
                borderRadius: "22px",
                padding: "14px",
                background: item.focus
                  ? "linear-gradient(rgba(255,138,42,.12),rgba(255,255,255,.03))"
                  : "rgba(255,255,255,.05)",
                border: item.focus
                  ? "1px solid rgba(255,138,42,.28)"
                  : "1px solid rgba(255,255,255,.08)",
                boxShadow: item.focus ? "inset 0 1px 0 rgba(255,255,255,.12)" : "none",
                opacity: item.hasRoutine ? 1 : 0.85,
              }}
            >
              <div
                className="shrink-0 flex items-center justify-center text-white"
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "15px",
                  background: `linear-gradient(135deg,${c.from},${c.to})`,
                }}
              >
                <TypeIcon type={item.type} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-white truncate" style={{ fontSize: "15px", fontWeight: 700 }}>
                    {item.title}
                  </span>
                  {item.focus && (
                    <span
                      style={{
                        fontSize: "9px",
                        fontWeight: 700,
                        letterSpacing: ".05em",
                        color: "#ffb15e",
                        background: "rgba(255,177,94,.18)",
                        padding: "2px 7px",
                        borderRadius: "7px",
                      }}
                    >
                      {t("goals_focus_badge")}
                    </span>
                  )}
                </div>
                <div className="truncate" style={{ fontSize: "11.5px", color: "rgba(255,255,255,.55)", marginTop: "3px" }}>
                  {item.subtitle}
                </div>
              </div>

              <div
                className="shrink-0 flex items-center justify-center"
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: `conic-gradient(${c.ring} 0 ${deg}deg, rgba(255,255,255,.12) ${deg}deg 360deg)`,
                }}
              >
                <div
                  className="flex items-center justify-center text-white tabular-nums"
                  style={{ width: "31px", height: "31px", borderRadius: "50%", background: "#0c0d12", fontSize: "10px", fontWeight: 700 }}
                >
                  {perc}%
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
