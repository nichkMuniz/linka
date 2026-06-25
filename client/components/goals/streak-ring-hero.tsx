import * as React from "react";
import { useLanguage } from "@/lib/language-context";
import type { WeekDayState } from "@/components/goals/goals-helpers";

interface StreakRingHeroProps {
  streakCount: number;
  /** 7 entries, Monday first */
  week: WeekDayState[];
  weekDone: number;
  earnedBadgeCount?: number;
  onOpenBadges?: () => void;
}

const RING = 168; // expanded ring size (px)
const R = 62; // svg circle radius (viewBox 160)
const SEG = 40; // arc length of each day segment
const CIRC = 2 * Math.PI * R;
const STEP = CIRC / 7;
const EXPANDED = 224; // hero height fully expanded
const COLLAPSED = 78; // hero height fully collapsed
const RANGE = 150; // scroll px to complete the collapse
const END_SCALE = 0.42;

const SEGMENT_CLASS: Record<WeekDayState, string> = {
  done: "stroke-orange-500",
  "today-done": "stroke-orange-500",
  missed: "stroke-red-400/40",
  today: "stroke-primary",
  future: "stroke-foreground/10",
};

const DOT_CLASS: Record<WeekDayState, string> = {
  done: "bg-orange-500",
  "today-done": "bg-orange-500 ring-2 ring-primary/60",
  missed: "bg-red-400/50",
  today: "border-2 border-primary bg-transparent",
  future: "bg-foreground/10",
};

const LETTER_CLASS: Record<WeekDayState, string> = {
  done: "text-muted-foreground",
  "today-done": "text-primary font-bold",
  missed: "text-muted-foreground",
  today: "text-primary font-bold",
  future: "text-muted-foreground/50",
};

function smoothstep(p: number): number {
  return p * p * (3 - 2 * p);
}

/**
 * Anel de streak da semana que recolhe ao rolar a página: encolhe, ancora à
 * esquerda e vira um cabeçalho compacto sticky com blur. Animado por scroll
 * via refs + rAF (transform/opacity), sem re-render.
 */
export function StreakRingHero({ streakCount, week, weekDone, earnedBadgeCount = 0, onOpenBadges }: StreakRingHeroProps) {
  const { t, language } = useLanguage();

  const barRef = React.useRef<HTMLDivElement>(null);
  const bgRef = React.useRef<HTMLDivElement>(null);
  const ringRef = React.useRef<HTMLDivElement>(null);
  const dotsRef = React.useRef<HTMLDivElement>(null);
  const capRef = React.useRef<HTMLSpanElement>(null);
  const collapsedRef = React.useRef<HTMLDivElement>(null);

  const dayLetters = React.useMemo(() => {
    const fmt = new Intl.DateTimeFormat(language === "en" ? "en-US" : "pt-BR", {
      weekday: "narrow",
    });
    // 2024-01-01 é uma segunda-feira — base para a semana seg→dom
    return Array.from({ length: 7 }, (_, i) =>
      fmt.format(new Date(2024, 0, 1 + i)).toUpperCase(),
    );
  }, [language]);

  React.useEffect(() => {
    let ticking = false;

    const update = () => {
      const bar = barRef.current;
      if (!bar) return;
      const p = Math.min(Math.max(window.scrollY / RANGE, 0), 1);
      const e = smoothstep(p);
      const w = bar.clientWidth;

      const scale = 1 - (1 - END_SCALE) * e;
      // ancora a borda esquerda do anel encolhido a 16px da borda do bar
      const txEnd = (RING / 2) * END_SCALE + 16 - w / 2;
      const tx = txEnd * e;
      const ty = -3 * e;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
      }

      const fade = Math.max(0, 1 - e * 1.9);
      if (dotsRef.current) {
        dotsRef.current.style.opacity = String(fade);
        dotsRef.current.style.transform = `translateY(${-12 * e}px)`;
      }
      if (capRef.current) capRef.current.style.opacity = String(fade);
      if (bgRef.current) bgRef.current.style.opacity = String(e);
      if (collapsedRef.current) {
        collapsedRef.current.style.opacity = String(Math.max(0, (e - 0.6) / 0.4));
      }
      bar.style.height = `${EXPANDED - (EXPANDED - COLLAPSED) * e}px`;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        update();
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const caption =
    streakCount === 1 ? t("goals_dash_streak_caption_one") : t("goals_dash_streak_caption");

  return (
    <>
      {/* âncora sticky de altura zero — o bar visual desenha abaixo dela */}
      <div className="sticky z-30 h-0 -mx-4 md:mx-0 top-[calc(4rem+env(safe-area-inset-top))] md:top-0">
        <div ref={barRef} className="relative overflow-hidden" style={{ height: EXPANDED }}>
          <div
            ref={bgRef}
            className="absolute inset-0 bg-background/85 backdrop-blur-md border-b border-border/60"
            style={{ opacity: 0 }}
          />

          <div className="relative flex flex-col items-center pt-2">
            <div
              ref={ringRef}
              className="relative will-change-transform"
              style={{ width: RING, height: RING, transformOrigin: "center top" }}
            >
              <svg width={RING} height={RING} viewBox="0 0 160 160">
                <g transform="rotate(-90 80 80)" fill="none" strokeWidth={10} strokeLinecap="round">
                  {week.map((state, i) => (
                    <circle
                      key={i}
                      cx={80}
                      cy={80}
                      r={R}
                      className={SEGMENT_CLASS[state]}
                      strokeDasharray={`${SEG} ${CIRC - SEG}`}
                      strokeDashoffset={-i * STEP}
                    />
                  ))}
                </g>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl leading-none mb-0.5">🔥</span>
                <span className="text-[42px] font-bold leading-none tracking-tight tabular-nums">
                  {streakCount}
                </span>
                <span
                  ref={capRef}
                  className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mt-1"
                >
                  {caption}
                </span>
              </div>
            </div>

            <div ref={dotsRef} className="flex flex-col items-center gap-3 mt-3">
              <div className="flex gap-3.5">
                {week.map((state, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    <span className={`text-[10px] font-semibold ${LETTER_CLASS[state]}`}>
                      {dayLetters[i]}
                    </span>
                    <span className={`h-2 w-2 rounded-full ${DOT_CLASS[state]}`} />
                  </div>
                ))}
              </div>
              {onOpenBadges && (
                <button
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold active:scale-95 transition-transform"
                  style={{ background: "rgba(255,177,94,.12)", color: "#ffb15e", border: "1px solid rgba(255,177,94,.2)" }}
                  onClick={onOpenBadges}
                >
                  🏅 {earnedBadgeCount > 0 ? `${earnedBadgeCount} ${t("goals_badges_label")}` : t("goals_badges_see")}
                </button>
              )}
            </div>
          </div>

          {/* label do estado recolhido (aparece ao lado do anel ancorado) */}
          <div
            ref={collapsedRef}
            className="absolute inset-y-0 left-0 right-0 flex items-center justify-between pl-[98px] pr-4 pointer-events-none"
            style={{ opacity: 0 }}
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold tracking-tight">
                {t("goals_dash_collapsed_title").replace("{n}", String(streakCount))}
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                {t("goals_dash_collapsed_sub").replace("{done}", String(weekDone))}
              </span>
            </div>
            {onOpenBadges && earnedBadgeCount > 0 && (
              <button
                className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold active:scale-95 transition-transform"
                style={{ background: "rgba(255,177,94,.15)", color: "#ffb15e", border: "1px solid rgba(255,177,94,.25)" }}
                onClick={onOpenBadges}
              >
                🏅 {earnedBadgeCount}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* espaçador em fluxo — reserva a altura do hero expandido */}
      <div style={{ height: EXPANDED }} />
    </>
  );
}
