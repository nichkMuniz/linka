import { ChevronRight, Flame, History, Scale } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { FEATURES } from "@/lib/feature-flags";

interface StreakBadgesCardProps {
  streakCount: number;
  /** check-ins done this week (0–7) — controls the ring fill */
  weekDone: number;
  recordStreak: number;
  /** emojis das insígnias conquistadas mais recentes (até 2) */
  earnedEmojis: string[];
  /** insígnias do catálogo ainda não conquistadas */
  lockedCount: number;
  /** opens the check-in calendar modal */
  onOpenCalendar: () => void;
  /** opens the badges/insignias drawer — triggered by tapping badge chips */
  onOpenBadges: () => void;
  /** opens the body-weight history drawer — the ⚖️ icon in the top-right corner */
  onOpenWeight: () => void;
  /** abre a tela de histórico de treinos — botão com o ícone de relógio no canto superior direito */
  onOpenHistory: () => void;
}

/**
 * Card de streak no estilo "LinKa Glass" (Direção A): anel conic com a
 * contagem, título com o fogo ("🔥 12 dias seguidos"), recorde e mini-fileira
 * de badges.
 * - Tocar no card principal abre o calendário de check-ins.
 * - Tocar nos ícones de badge abre o sheet de insígnias.
 * - Tocar no ⚖️ do canto superior direito abre o histórico de peso.
 * - Tocar no botão de relógio (canto superior direito) abre o histórico de
 *   treinos (`/metas/historico`) — 2026-10-05. Só ícone, sem rótulo: o card é o
 *   bloco "do que já fiz" da tela, e o relógio lê como "histórico" ali.
 */
export function StreakBadgesCard({
  streakCount,
  weekDone,
  recordStreak,
  earnedEmojis,
  lockedCount,
  onOpenCalendar,
  onOpenBadges,
  onOpenWeight,
  onOpenHistory,
}: StreakBadgesCardProps) {
  const { t } = useLanguage();

  const frac = Math.max(0.05, Math.min(1, weekDone / 7));
  const ringDeg = Math.round(frac * 360);

  const hasBadges = FEATURES.badges && (earnedEmojis.length > 0 || lockedCount > 0);

  return (
    <button
      onClick={onOpenCalendar}
      className="w-full text-left flex items-center gap-4 active:scale-[0.99] transition-transform"
      style={{
        borderRadius: "26px",
        padding: "16px",
        background: "linear-gradient(rgba(255,255,255,.08),rgba(255,255,255,.03))",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,.1)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.16)",
      }}
    >
      {/* anel conic */}
      <div
        className="shrink-0 flex items-center justify-center"
        style={{
          width: "74px",
          height: "74px",
          borderRadius: "50%",
          background: `conic-gradient(#ff8a2a 0deg ${ringDeg}deg, rgba(255,255,255,.12) ${ringDeg}deg 360deg)`,
          boxShadow: "0 0 30px -6px rgba(255,138,42,.5)",
        }}
      >
        {/* Só o número no centro — o fogo mora no título (2026-09-30). */}
        <div
          className="flex flex-col items-center justify-center"
          style={{ width: "60px", height: "60px", borderRadius: "50%", background: "#0c0d12" }}
        >
          <span className="text-white tabular-nums" style={{ fontSize: "22px", fontWeight: 800, lineHeight: 1 }}>
            {streakCount}
          </span>
        </div>
      </div>

      {/* texto + badges */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-white" style={{ fontSize: "16px", fontWeight: 700 }}>
          <Flame className="h-[18px] w-[18px] shrink-0" style={{ color: "#ff8a2a", fill: "rgba(255,138,42,.35)" }} strokeWidth={2.2} />
          <span className="truncate">{streakCount} {t("goals_dash_streak_caption")}</span>
        </div>
        <div style={{ fontSize: "11.5px", color: "rgba(255,255,255,.5)", marginTop: "1px" }}>
          {t("goals_streak_record").replace("{n}", String(recordStreak))}
        </div>

        {/* badges — toque abre o drawer de insígnias, não o calendário */}
        {hasBadges && (
          <div
            role="button"
            tabIndex={0}
            className="flex gap-1.5"
            style={{ marginTop: "9px" }}
            onClick={(e) => {
              e.stopPropagation();
              onOpenBadges();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                onOpenBadges();
              }
            }}
          >
            {earnedEmojis.slice(0, 2).map((emoji, i) => (
              <span
                key={i}
                style={chipStyle(i === 0 ? "linear-gradient(135deg,#ffb15e,#ff7a3c)" : "linear-gradient(135deg,#9d6bff,#5b8cff)")}
              >
                {emoji}
              </span>
            ))}
            {lockedCount > 0 && (
              <span
                className="flex items-center justify-center"
                style={{
                  width: "26px",
                  height: "26px",
                  borderRadius: "9px",
                  background: "rgba(255,255,255,.06)",
                  border: "1px dashed rgba(255,255,255,.18)",
                  fontSize: "11px",
                  color: "rgba(255,255,255,.4)",
                }}
              >
                +{lockedCount}
              </span>
            )}
          </div>
        )}
      </div>

      {/* canto superior direito: ⚖️ peso (discreto, de propósito) + chevron do card */}
      <div className="self-start shrink-0 flex items-center gap-1.5">
        {FEATURES.weightTracking && (
        <div
          role="button"
          tabIndex={0}
          aria-label={t("goals_weight_title")}
          // Área de toque de ~42px (o quadrado visível tem 30px) sem mexer no
          // layout: o padding é compensado pela margem negativa.
          style={{ margin: "-6px", padding: "6px" }}
          onClick={(e) => {
            e.stopPropagation();
            onOpenWeight();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              onOpenWeight();
            }
          }}
        >
          <div
            className="flex items-center justify-center active:scale-95 transition-transform"
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "10px",
              background: "rgba(255,255,255,.07)",
              border: "1px solid rgba(255,255,255,.1)",
            }}
          >
            <Scale className="h-4 w-4" style={{ color: "rgba(255,255,255,.55)" }} />
          </div>
        </div>
        )}

        {/* Histórico de treinos. `div role="button"` pelo mesmo motivo do ⚖️ (o
            card já é um <button>); área de toque de 44px via padding/margin. */}
        <div
          role="button"
          tabIndex={0}
          aria-label={t("goals_history_title")}
          style={{ margin: "-5px", padding: "5px" }}
          onClick={(e) => {
            e.stopPropagation();
            onOpenHistory();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              onOpenHistory();
            }
          }}
        >
          <div
            className="flex items-center justify-center active:scale-95 transition-transform"
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "11px",
              background: "rgba(91,140,255,.2)",
              border: "1px solid rgba(147,180,255,.38)",
            }}
          >
            <History className="h-[18px] w-[18px]" style={{ color: "#b9cfff" }} strokeWidth={2.2} />
          </div>
        </div>

        <ChevronRight className="h-5 w-5" style={{ color: "rgba(255,255,255,.4)" }} />
      </div>
    </button>
  );
}

function chipStyle(background: string): React.CSSProperties {
  return {
    width: "26px",
    height: "26px",
    borderRadius: "9px",
    background,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "13px",
    boxShadow: "0 3px 8px -2px rgba(255,122,60,.5)",
  };
}
