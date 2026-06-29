import * as React from "react";
import { Check, CheckCircle2, Moon, Play } from "lucide-react";
import { ImageWithFallback } from "@/components/shared/image-with-fallback";
import { useLanguage } from "@/lib/language-context";
import { formatScheduledTime } from "@/hooks/use-routine-notifications";
import { isCompletedToday, type RoutineCard } from "@/components/goals/goals-helpers";
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

/** Cada slide do carrossel troca a cada X segundos */
const AUTO_ADVANCE_MS = 5000;

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
 * Dashboard "hoje": apresenta o que o usuário precisa fazer no dia (treino,
 * dieta e hábitos agendados para hoje). Quando há mais de uma rotina pendente
 * no dia, vira um carrossel auto-rotativo na ordem treino → dieta → hábitos.
 * Rotinas sem dias selecionados (`scheduled_days` vazio) contam como "todo dia".
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

  const today = localDateStr(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = localDateStr(yesterdayDate);
  // índice do dia de hoje no padrão seg(0)…dom(6)
  const todayIdx = (new Date().getDay() + 6) % 7;
  const weekdayMap = React.useMemo(() => buildRoutineWeekdayMap(), []);

  const workoutCards = cards.filter((c) => c.type === 1);
  const dietCards = cards.filter((c) => c.type === 2);
  const habitCards = cards.filter((c) => c.type === 3);

  // Dias da semana de uma rotina (seg=0…dom=6). null = todo dia.
  // Prioriza os dias escolhidos pelo usuário (scheduled_days); para treino,
  // cai no calendário do programa (catálogo) quando não há dias explícitos.
  const cardWeekdays = React.useCallback(
    (card: RoutineCard): number[] | null => {
      const sd = (card.scheduledDays ?? "").trim();
      if (sd) {
        const parsed = sd
          .split(",")
          .map((p) => Number(p.trim()))
          .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
        return parsed.length > 0 ? parsed : null;
      }
      if (card.type === 1) {
        const mapped = weekdayMap.get((card.name ?? "").trim().toLowerCase());
        if (mapped && mapped.length > 0) return mapped;
      }
      return null;
    },
    [weekdayMap],
  );

  const isScheduledToday = React.useCallback(
    (card: RoutineCard): boolean => {
      const wd = cardWeekdays(card);
      return wd === null ? true : wd.includes(todayIdx);
    },
    [cardWeekdays, todayIdx],
  );

  // Tarefas de hoje, sempre na ordem treino → dieta → hábitos.
  const tasks = React.useMemo(
    () => [
      ...workoutCards.filter(isScheduledToday),
      ...dietCards.filter(isScheduledToday),
      ...habitCards.filter(isScheduledToday),
    ],
    [workoutCards, dietCards, habitCards, isScheduledToday],
  );

  // Dia de descanso: usuário segue um calendário de treino mas hoje não há treino.
  const workoutFollowsSchedule = workoutCards.some(
    (c) =>
      (c.scheduledDays ?? "").trim() ||
      weekdayMap.has((c.name ?? "").trim().toLowerCase()),
  );
  const isRestDay =
    workoutCards.length > 0 &&
    workoutCards.filter(isScheduledToday).length === 0 &&
    workoutFollowsSchedule;

  // ── Carrossel ──
  const total = tasks.length;
  const [active, setActive] = React.useState(0);
  React.useEffect(() => {
    if (total <= 1) return;
    const id = setTimeout(() => setActive((i) => (i + 1) % total), AUTO_ADVANCE_MS);
    return () => clearTimeout(id);
  }, [active, total]);
  const idx = total > 0 ? active % total : 0;
  const activeCard = tasks[idx] ?? null;

  const yesterdayCard =
    workoutCards.find((c) => cardLastDate(c, routineLastDates) === yesterday) ?? null;

  // Sem nenhuma rotina cadastrada → some a seção inteira.
  if (cards.length === 0) return null;

  // ── Render helpers ──

  const isCardDoneToday = (card: RoutineCard): boolean => {
    if (card.type === 1) return cardLastDate(card, routineLastDates) === today;
    return card.items.length > 0 && card.items.every((i) => isCompletedToday(i as never));
  };

  const typeTopLabel = (card: RoutineCard) =>
    card.type === 1
      ? t("goals_rt_exercises")
      : card.type === 2
        ? t("goals_rt_diets")
        : t("goals_rt_habits");

  const cardPhoto = (card: RoutineCard): string | null => {
    if (card.type === 1)
      return ((card.items.find((i) => (i as any).workoutPhoto) as any)?.workoutPhoto as string | null) ?? null;
    if (card.type === 2)
      return ((card.items.find((i) => (i as any).dietPhoto) as any)?.dietPhoto as string | null) ?? null;
    return null;
  };

  // Estado "concluído hoje" — card compacto emerald (mesmo design da v4).
  const renderCompletedCard = (card: RoutineCard) => {
    const label = card.name ?? typeTopLabel(card);
    const title =
      card.type === 1
        ? t("goals_dash_done_title")
        : card.type === 2
          ? t("goals_dash_done_diet")
          : t("goals_dash_done_habit");
    const subtitle =
      card.type === 1 ? t("goals_dash_done_subtitle") : t("goals_dash_done_subtitle_generic");
    return (
      <button
        onClick={() => onOpenCard(card)}
        className="w-full text-left rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-5 flex items-center gap-4 active:scale-[0.99] transition-all"
      >
        <div className="h-14 w-14 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-emerald-400">{title}</p>
          <p className="text-sm font-semibold truncate mt-0.5">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
      </button>
    );
  };

  const renderBanner = (card: RoutineCard) => {
    const isWorkout = card.type === 1;
    const label = card.name ?? typeTopLabel(card);
    const doneToday = isCardDoneToday(card);
    const isActive =
      isWorkout &&
      activeWorkoutName !== null &&
      (card.name ?? "__unnamed__") === activeWorkoutName;
    const photo = cardPhoto(card);
    const muscles = Array.from(
      new Set(
        card.items
          .map((i) => (i as any).muscle_group as string | null)
          .filter(Boolean) as string[],
      ),
    ).slice(0, 3);
    const linkedGoal = userGoals.find((g) => g.goal_id === card.goalId) ?? null;

    // subtítulo: treino = exercícios/músculos; dieta/hábito = progresso de itens
    let subtitle: string;
    if (isWorkout) {
      subtitle =
        `${card.items.length} ${t("goals_exercises").toLowerCase()}` +
        (muscles.length > 0 ? ` · ${muscles.join(", ")}` : "");
    } else {
      const done = card.items.filter((i) => isCompletedToday(i as never)).length;
      subtitle = t("goals_dash_items_progress")
        .replace("{done}", String(done))
        .replace("{total}", String(card.items.length));
    }
    if (card.scheduledTime) subtitle += ` · ${formatScheduledTime(card.scheduledTime)}`;

    return (
      <div
        key={card.key}
        className="relative overflow-hidden cursor-pointer"
        style={{ borderRadius: "28px", height: "220px", boxShadow: "0 22px 46px -18px rgba(0,0,0,.6)" }}
        onClick={() => onOpenCard(card)}
      >
        {photo ? (
          <>
            {/* Base preta — as ilustrações wger são linhas escuras sobre branco;
                invertendo a foto o fundo branco vira preto e as linhas ficam claras,
                deixando o texto/botão brancos legíveis sobre o frame. */}
            <div className="absolute inset-0" style={{ background: "#0a0b12" }} />
            <ImageWithFallback
              src={photo}
              alt={label}
              cdnWidth={640}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ filter: "invert(1)" }}
              fallbackElement={<div className="absolute inset-0" style={{ background: "radial-gradient(130% 120% at 25% 20%,#ff9d6c,#d8567a 45%,#5b2d8c 80%,#1a1438)" }} />}
            />
          </>
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
            {typeTopLabel(card)}
          </p>
          <p className="text-[22px] font-bold text-white tracking-tight leading-tight truncate mb-1">
            {label}
          </p>
          <p className="text-xs text-white/70 mb-3 truncate">{subtitle}</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isWorkout) onStartWorkout(card);
              else onOpenCard(card);
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
            {isWorkout
              ? isActive
                ? t("goals_session_resume")
                : t("goals_dash_start_workout")
              : t("goals_dash_open")}
          </button>
        </div>
      </div>
    );
  };

  const renderTask = (card: RoutineCard) =>
    isCardDoneToday(card) ? renderCompletedCard(card) : renderBanner(card);

  const hasPending = tasks.some((c) => !isCardDoneToday(c));

  return (
    <section className="space-y-3">
      {tasks.length > 0 && hasPending && (
        <p
          className="px-1 text-[11px] font-bold uppercase tracking-[.06em]"
          style={{ color: "rgba(255,255,255,.45)" }}
        >
          {t("goals_today_focus_generic")}
        </p>
      )}

      {/* Tarefa de hoje — única ou carrossel auto-rotativo */}
      {activeCard && (
        <div className="space-y-2.5">
          <div key={activeCard.key} className="animate-in fade-in-50 slide-in-from-right-2 duration-500">
            {renderTask(activeCard)}
          </div>
          {total > 1 && (
            <div className="flex items-center justify-center gap-1.5">
              {tasks.map((c, i) => (
                <button
                  key={c.key}
                  onClick={() => setActive(i)}
                  aria-label={c.name ?? typeTopLabel(c)}
                  className="rounded-full transition-all"
                  style={{
                    height: "6px",
                    width: i === idx ? "20px" : "6px",
                    background:
                      i === idx ? "rgba(255,255,255,.85)" : "rgba(255,255,255,.3)",
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* dia de descanso (segue um programa e hoje não há treino agendado) */}
      {tasks.length === 0 && isRestDay && (
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
