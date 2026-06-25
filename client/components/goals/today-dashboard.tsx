import { Check, CheckCircle2, Dumbbell, Moon, Play } from "lucide-react";
import { ImageWithFallback } from "@/components/shared/image-with-fallback";
import { useLanguage } from "@/lib/language-context";
import { formatScheduledTime } from "@/hooks/use-routine-notifications";
import type { RoutineCard } from "@/components/goals/goals-helpers";
import { buildRoutineWeekdayMap } from "@/components/goals/suggested-routines-data";
import type { UserGoal } from "@/lib/ritmofit-db";

interface TodayDashboardProps {
  cards: RoutineCard[];
  userGoals: UserGoal[];
  /** map user_workout_id → ISO date of last execution */
  routineLastDates: Record<string, string>;
  /** routine name of the workout in progress (null = none) */
  activeWorkoutName: string | null;
  onStartWorkout: (card: RoutineCard) => void;
  onOpenCard: (card: RoutineCard) => void;
}

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** última execução do card = data mais recente entre os itens */
function cardLastDate(card: RoutineCard, lastDates: Record<string, string>): string | null {
  const dates = card.items
    .map((i) => lastDates[i.id])
    .filter(Boolean)
    .map((d) => d.slice(0, 10))
    .sort();
  return dates.pop() ?? null;
}

/**
 * Dashboard "hoje": banner do treino em foco (com foto), linha-fantasma do
 * treino de ontem e cards de dieta/hábito com progresso do dia.
 */
export function TodayDashboard({
  cards,
  userGoals,
  routineLastDates,
  activeWorkoutName,
  onStartWorkout,
  onOpenCard,
}: TodayDashboardProps) {
  const { t } = useLanguage();

  const workoutCards = cards.filter((c) => c.type === 1);
  if (workoutCards.length === 0) return null;

  const today = localDateStr(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = localDateStr(yesterdayDate);

  // índice do dia de hoje no padrão seg(0)…dom(6)
  const todayIdx = (new Date().getDay() + 6) % 7;
  const weekdayMap = buildRoutineWeekdayMap();
  // rotina agendada para hoje (pelo nome casado com um programa)
  const scheduledToday =
    workoutCards.find((c) =>
      (weekdayMap.get((c.name ?? "").trim().toLowerCase()) ?? []).includes(todayIdx),
    ) ?? null;
  // o usuário segue um programa se ao menos uma rotina casa com o catálogo
  const hasSchedule = workoutCards.some((c) =>
    weekdayMap.has((c.name ?? "").trim().toLowerCase()),
  );

  // treino em foco: hoje agendado > (se sem programa) o mais "devido"
  let featured: RoutineCard | null;
  if (scheduledToday) {
    featured = scheduledToday;
  } else if (hasSchedule) {
    // segue um programa mas hoje é dia de descanso
    featured = null;
  } else {
    const pending = workoutCards
      .filter((c) => cardLastDate(c, routineLastDates) !== today)
      .sort((a, b) =>
        (cardLastDate(a, routineLastDates) ?? "").localeCompare(
          cardLastDate(b, routineLastDates) ?? "",
        ),
      );
    featured = pending[0] ?? workoutCards[0] ?? null;
  }
  const isRestDay = featured === null && hasSchedule;
  // o treino de hoje já foi concluído?
  const featuredDoneToday =
    featured !== null && cardLastDate(featured, routineLastDates) === today;

  const yesterdayCard =
    workoutCards.find((c) => cardLastDate(c, routineLastDates) === yesterday) ?? null;

  // estado de "treino de hoje concluído" — substitui o banner após finalizar
  const renderCompletedCard = (card: RoutineCard) => {
    const label = card.name ?? t("goals_rt_exercises");
    return (
      <button
        onClick={() => onOpenCard(card)}
        className="w-full text-left rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-5 flex items-center gap-4 active:scale-[0.99] transition-all"
      >
        <div className="h-14 w-14 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-emerald-400">{t("goals_dash_done_title")}</p>
          <p className="text-sm font-semibold truncate mt-0.5">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("goals_dash_done_subtitle")}
          </p>
        </div>
      </button>
    );
  };

  const renderWorkoutBanner = (card: RoutineCard) => {
    const label = card.name ?? t("goals_rt_exercises");
    const doneToday = cardLastDate(card, routineLastDates) === today;
    const isActive =
      activeWorkoutName !== null && (card.name ?? "__unnamed__") === activeWorkoutName;
    const photo =
      ((card.items.find((i) => (i as any).workoutPhoto) as any)?.workoutPhoto as string | null) ??
      null;
    const muscles = Array.from(
      new Set(
        card.items
          .map((i) => (i as any).muscle_group as string | null)
          .filter(Boolean) as string[],
      ),
    ).slice(0, 3);
    const linkedGoal = userGoals.find((g) => g.goal_id === card.goalId) ?? null;

    return (
      <div
        key={card.key}
        className="relative overflow-hidden cursor-pointer"
        style={{ borderRadius: "28px", height: "220px", boxShadow: "0 22px 46px -18px rgba(0,0,0,.6)" }}
        onClick={() => onOpenCard(card)}
      >
        {photo ? (
          <ImageWithFallback
            src={photo}
            alt={label}
            cdnWidth={640}
            className="absolute inset-0 h-full w-full object-cover"
            fallbackElement={<div className="absolute inset-0" style={{ background: "radial-gradient(130% 120% at 25% 20%,#ff9d6c,#d8567a 45%,#5b2d8c 80%,#1a1438)" }} />}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: "radial-gradient(130% 120% at 25% 20%,#ff9d6c,#d8567a 45%,#5b2d8c 80%,#1a1438)" }}
          />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top,rgba(0,0,0,.6),transparent 55%)" }} />

        {linkedGoal && (
          <span
            className="absolute top-3.5 left-3.5 text-[11px] font-semibold text-white px-3 py-1.5 backdrop-blur-sm"
            style={{ borderRadius: "14px", background: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.2)" }}
          >
            🎯 {linkedGoal.description} · {Math.min(100, Math.round(linkedGoal.perc))}%
          </span>
        )}

        <span
          className="absolute top-3.5 right-3.5 text-[11px] font-bold uppercase tracking-wider"
          style={{
            padding: "5px 11px",
            borderRadius: "12px",
            color: doneToday ? "#fff" : "#0a0b12",
            background: doneToday ? "rgba(52,211,153,.9)" : "#fff",
          }}
        >
          {doneToday ? t("goals_dash_done_badge") : t("goals_today_label")}
        </span>

        <div className="absolute left-4 right-4 bottom-3.5">
          <p className="text-[13px] font-semibold text-white/80 mb-0.5 truncate">
            {t("goals_rt_exercises")}
          </p>
          <p className="text-[22px] font-bold text-white tracking-tight leading-tight truncate mb-1">
            {label}
          </p>
          <p className="text-xs text-white/70 mb-3 truncate">
            {card.items.length} {t("goals_exercises").toLowerCase()}
            {muscles.length > 0 ? ` · ${muscles.join(", ")}` : ""}
            {card.scheduledTime ? ` · ${formatScheduledTime(card.scheduledTime)}` : ""}
          </p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStartWorkout(card);
            }}
            className="w-full flex items-center justify-center gap-2 text-sm font-bold transition-all active:scale-95"
            style={{
              height: "46px",
              borderRadius: "23px",
              color: isActive ? "#ffb15e" : "#0a0b12",
              background: isActive
                ? "rgba(255,177,94,.18)"
                : "linear-gradient(rgba(255,255,255,.96),rgba(255,255,255,.85))",
              border: isActive ? "1px solid rgba(255,177,94,.3)" : "none",
              boxShadow: isActive ? "none" : "0 6px 18px -6px rgba(0,0,0,.5)",
            }}
          >
            <Play className="h-4 w-4" />
            {isActive ? t("goals_session_resume") : t("goals_dash_start_workout")}
          </button>
        </div>
      </div>
    );
  };

  return (
    <section className="space-y-3">
      {featured && !featuredDoneToday && (
        <p
          className="px-1 text-[11px] font-bold uppercase tracking-[.06em]"
          style={{ color: "rgba(255,255,255,.45)" }}
        >
          {t("goals_today_focus_label")}
        </p>
      )}
      {featured &&
        (featuredDoneToday ? renderCompletedCard(featured) : renderWorkoutBanner(featured))}

      {/* dia de descanso (segue um programa e hoje não há treino agendado) */}
      {isRestDay && (
        <div className="rounded-2xl bg-card border border-border/40 p-5 flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Moon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold">{t("goals_dash_rest_title")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("goals_dash_rest_subtitle")}
            </p>
          </div>
        </div>
      )}

      {/* treino de ontem */}
      {yesterdayCard && (
        <button
          onClick={() => onOpenCard(yesterdayCard)}
          className="w-full flex items-center gap-2 rounded-2xl bg-card border border-border/40 px-3.5 py-3 text-left active:scale-[0.99] transition-all"
        >
          <Check className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="text-xs text-muted-foreground truncate">
            {t("goals_dash_yesterday")} ·{" "}
            <span className="text-foreground font-semibold">
              {yesterdayCard.name ?? t("goals_rt_exercises")}
            </span>
          </span>
          <span className="ml-auto text-xs font-semibold text-primary shrink-0">
            {t("goals_dash_view")}
          </span>
        </button>
      )}

    </section>
  );
}
