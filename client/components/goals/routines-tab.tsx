import * as React from "react";
import { Bell, CalendarDays, ChevronRight, Dumbbell, Play, Shield, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language-context";
import { formatScheduledTime } from "@/hooks/use-routine-notifications";
import { isRoutineCompleted, isSequentialCard, type RoutineCard } from "@/components/goals/goals-helpers";
import { buildRoutineWeekdayMap } from "@/components/goals/suggested-routines-data";
import type { RoutineTypeCode, UserGoal } from "@/lib/ritmofit-db";

const WEEKDAY_KEYS = [
  "goals_weekday_mon",
  "goals_weekday_tue",
  "goals_weekday_wed",
  "goals_weekday_thu",
  "goals_weekday_fri",
  "goals_weekday_sat",
  "goals_weekday_sun",
] as const;

interface RoutinesTabProps {
  cards: RoutineCard[];
  userGoals: UserGoal[];
  /** map user_workout_id → ISO date of last execution */
  routineLastDates: Record<string, string>;
  activeWorkoutName: string | null;
  onStartWorkout: (card: RoutineCard) => void;
  onOpenCard: (card: RoutineCard) => void;
  onCreateRoutine: () => void;
  onOpenSuggestions: () => void;
  /** tipo de rotina a listar (1=treino, 2=dieta, 3=hábito). Default 1. */
  filterType?: RoutineTypeCode;
}

function formatLastDate(iso: string, locale: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(locale === "en" ? "en-US" : "pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

const ROUTINE_COLORS = {
  1: { from: "#ff9d6c", to: "#d8567a", glow: "rgba(255,122,60,.4)" },
  2: { from: "#5fd6a0", to: "#1f8a5b", glow: "rgba(31,138,91,.4)" },
  3: { from: "#b08cff", to: "#7b3ff2", glow: "rgba(123,63,242,.4)" },
} as const;

const RING_COLORS = {
  1: "#ff8a2a",
  2: "#5fd6a0",
  3: "#b08cff",
} as const;

function CircularProgress({ perc, type }: { perc: number; type: 1 | 2 | 3 }) {
  const clamped = Math.min(100, Math.max(0, perc));
  const deg = (clamped / 100) * 360;
  const ringColor = RING_COLORS[type];
  return (
    <div
      className="flex-shrink-0 flex items-center justify-center"
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: `conic-gradient(${ringColor} 0deg ${deg}deg, rgba(255,255,255,.12) ${deg}deg 360deg)`,
      }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          width: 31,
          height: 31,
          borderRadius: "50%",
          background: "var(--background, #0c0d12)",
          fontSize: "10px",
          fontWeight: 700,
          color: "#fff",
        }}
      >
        {clamped}%
      </div>
    </div>
  );
}

function RoutineIcon({ type }: { type: 1 | 2 | 3 }) {
  const colors = ROUTINE_COLORS[type];
  return (
    <div
      className="flex-shrink-0 flex items-center justify-center text-white"
      style={{
        width: 48,
        height: 48,
        borderRadius: "15px",
        background: `linear-gradient(135deg,${colors.from},${colors.to})`,
        boxShadow: `0 6px 16px -4px ${colors.glow}`,
      }}
    >
      {type === 1 ? (
        <Dumbbell className="h-5 w-5" />
      ) : type === 2 ? (
        <Shield className="h-5 w-5" />
      ) : (
        <Target className="h-5 w-5" />
      )}
    </div>
  );
}

export function RoutinesTab({
  cards,
  userGoals,
  routineLastDates,
  activeWorkoutName,
  onStartWorkout,
  onOpenCard,
  onCreateRoutine,
  onOpenSuggestions,
  filterType = 1,
}: RoutinesTabProps) {
  const { t, language } = useLanguage();

  const goalById = React.useMemo(() => {
    const map = new Map<string, UserGoal>();
    userGoals.forEach((g) => map.set(g.goal_id, g));
    return map;
  }, [userGoals]);

  const weekdayMap = React.useMemo(() => buildRoutineWeekdayMap(), []);

  // Dias da semana em que a rotina deve ser executada (seg=0…dom=6).
  // Prioriza os dias escolhidos pelo usuário (scheduledDays); para treino sem
  // dias explícitos, cai no calendário do programa sugerido. null = todo dia.
  const cardWeekdays = React.useCallback(
    (card: RoutineCard): number[] | null => {
      const sd = (card.scheduledDays ?? "").trim();
      if (sd) {
        const parsed = sd
          .split(",")
          .map((p) => Number(p.trim()))
          .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
        return parsed.length > 0 ? Array.from(new Set(parsed)).sort((a, b) => a - b) : null;
      }
      if (card.type === 1) {
        const mapped = weekdayMap.get((card.name ?? "").trim().toLowerCase());
        if (mapped && mapped.length > 0) return Array.from(new Set(mapped)).sort((a, b) => a - b);
      }
      return null;
    },
    [weekdayMap],
  );

  const formatWeekdays = React.useCallback(
    (days: number[] | null): string =>
      days === null
        ? t("goals_rt_days_every")
        : days.map((d) => t(WEEKDAY_KEYS[d])).join(" · "),
    [t],
  );

  const workoutCards = cards.filter((c) => c.type === filterType);

  if (workoutCards.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center px-4">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <Dumbbell className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold">{t("goals_no_routines_guide_title")}</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            {t("goals_no_routines_guide_subtitle")}
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <Button className="rounded-full h-11" onClick={onOpenSuggestions}>
            <Sparkles className="h-4 w-4 mr-1.5" />
            {t("goals_wizard_suggested")}
          </Button>
          <Button variant="outline" className="rounded-full h-11" onClick={onCreateRoutine}>
            {t("goals_create_routine")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {workoutCards.map((card) => {
        const label =
          card.name ??
          (card.type === 1
            ? t("goals_rt_exercises")
            : card.type === 2
              ? t("goals_rt_diets")
              : t("goals_rt_habits"));
        const linkedGoal = card.goalId ? goalById.get(card.goalId) : null;
        // Anel = conclusão da rotina: 100% se concluída, senão 0% (binário).
        const completionPerc = isRoutineCompleted(card, routineLastDates) ? 100 : 0;
        const isActive =
          card.type === 1 &&
          activeWorkoutName !== null &&
          (card.name ?? "__unnamed__") === activeWorkoutName;
        const lastDate =
          card.type === 1
            ? card.items.map((i) => routineLastDates[i.id]).filter(Boolean).sort().pop()
            : undefined;

        const routineType = (card.type === 1 || card.type === 2 || card.type === 3 ? card.type : 1) as 1 | 2 | 3;
        const borderColor = linkedGoal
          ? routineType === 1
            ? "rgba(255,138,42,.28)"
            : routineType === 2
              ? "rgba(95,214,160,.28)"
              : "rgba(176,140,255,.28)"
          : "rgba(255,255,255,.08)";
        const bgGradient = linkedGoal
          ? routineType === 1
            ? "linear-gradient(rgba(255,138,42,.1),rgba(255,255,255,.03))"
            : routineType === 2
              ? "linear-gradient(rgba(95,214,160,.1),rgba(255,255,255,.03))"
              : "linear-gradient(rgba(176,140,255,.1),rgba(255,255,255,.03))"
          : "rgba(255,255,255,.05)";

        return (
          <div
            key={card.key}
            className="rounded-[22px] p-4"
            style={{
              background: bgGradient,
              border: `1px solid ${borderColor}`,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.1)",
            }}
          >
            <button
              className="w-full flex items-center gap-3 text-left"
              onClick={() => onOpenCard(card)}
            >
              <RoutineIcon type={routineType} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[15px] font-bold text-foreground truncate">{label}</p>
                  {isActive && (
                    <span
                      className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded-[5px] shrink-0"
                      style={{ background: "rgba(255,177,94,.18)", color: "#ffb15e" }}
                    >
                      {t("goals_session_resume").toUpperCase().slice(0, 6)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {card.items.length}{" "}
                  {card.type === 1
                    ? t("goals_exercises").toLowerCase()
                    : t("goals_items_label")}
                  {lastDate ? ` · ${t("goals_last_done")} ${formatLastDate(lastDate, language)}` : ""}
                </p>
                {/* chips */}
                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 text-[11px] font-medium">
                      <CalendarDays className="h-3 w-3 shrink-0" />
                      {isSequentialCard(card) ? t("goals_seq_label") : formatWeekdays(cardWeekdays(card))}
                    </span>
                    {card.scheduledTime && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[11px] font-medium">
                        <Bell className="h-3 w-3" />
                        {formatScheduledTime(card.scheduledTime)}
                      </span>
                    )}
                    {linkedGoal && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-medium max-w-[160px]">
                        <Target className="h-3 w-3 shrink-0" />
                        <span className="truncate">{linkedGoal.description}</span>
                      </span>
                    )}
                </div>
              </div>

              <CircularProgress perc={completionPerc} type={routineType} />
            </button>

            {card.type === 1 && (
              <Button
                size="sm"
                variant={isActive ? "outline" : "default"}
                className="w-full rounded-full mt-3"
                onClick={() => onStartWorkout(card)}
              >
                <Play className="h-4 w-4 mr-1" />
                {isActive ? t("goals_session_resume") : t("goals_session_start")}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
