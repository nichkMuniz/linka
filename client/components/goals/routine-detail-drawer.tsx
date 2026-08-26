import * as React from "react";
import { BarChart3, Bell, CalendarDays, Check, ChevronDown, Flame, Link2, ListPlus, Pencil, Play, Sparkles, Target, Trash2, UserPlus } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ExerciseImage } from "@/components/shared/exercise-image";
import { ExerciseAnatomy } from "@/components/shared/exercise-anatomy";
import { PremiumGate } from "@/components/shared/premium-gate";
import { TrendChart } from "@/components/shared/trend-chart";
import { useLanguage } from "@/lib/language-context";
import { useKeyboardInputScroll } from "@/hooks/use-keyboard-input-scroll";
import { HabitTimeRow } from "@/components/goals/habit-time-row";
import type { TranslationKey } from "@/lib/i18n";
import { formatScheduledTime } from "@/hooks/use-routine-notifications";
import { getSuggestedSetsForCard, isCompletedToday, isSequentialCard, SEQUENTIAL_MARKER, type RoutineCard, type RoutineItem } from "@/components/goals/goals-helpers";
import { getExerciseProgressionDb, toWorkoutTechnique, type ExerciseProgressPoint, type TechniqueAssignment, type TrainingMode, type UserGoal } from "@/lib/ritmofit-db";
import {
  TechniquePlanner,
  planToAssignments,
  type TechniquePlan,
  type TechniquePlanItem,
} from "@/components/goals/technique-planner";

type EditorMode = null | "rename" | "time" | "goal" | "technique";

const WEEKDAY_KEYS: TranslationKey[] = [
  "goals_weekday_mon", "goals_weekday_tue", "goals_weekday_wed",
  "goals_weekday_thu", "goals_weekday_fri", "goals_weekday_sat", "goals_weekday_sun",
];

interface RoutineDetailDrawerProps {
  card: RoutineCard | null;
  userGoals: UserGoal[];
  onClose: () => void;
  onStartWorkout: (card: RoutineCard) => void;
  /**
   * "Treinar junto" — abre o seletor de quem chamar (sem limite de pessoas) e
   * só então começa. Botão satélite ao lado do "Iniciar": nunca uma etapa a
   * mais para quem vai treinar sozinho.
   */
  onTrainTogether?: (card: RoutineCard) => void;
  onViewSummary: (card: RoutineCard) => void;
  onAddItems: (card: RoutineCard) => void;
  onToggleItem: (card: RoutineCard, item: RoutineItem, completed: boolean) => void;
  onDeleteItem: (card: RoutineCard, item: RoutineItem) => Promise<void>;
  onRename: (card: RoutineCard, newName: string) => Promise<void>;
  onSetTime: (card: RoutineCard, time: string | null) => Promise<void>;
  onSetDays: (card: RoutineCard, days: string | null) => Promise<void>;
  onSetItemTime: (item: RoutineItem, time: string | null) => Promise<void>;
  /** Hora de fim de um hábito (janela de execução). null limpa. */
  onSetItemEndTime: (item: RoutineItem, endTime: string | null) => Promise<void>;
  onLinkGoal: (card: RoutineCard, goal: UserGoal | null) => Promise<void>;
  /** Troca o modo de treino da rotina (só `type === 1`). */
  onSetTrainingMode: (card: RoutineCard, mode: TrainingMode) => Promise<void>;
  /** Salva o plano de técnicas (bi-set, drop-set…) da rotina. */
  onSaveTechniques: (card: RoutineCard, assignments: TechniqueAssignment[]) => Promise<void>;
  onDeleteCard: (card: RoutineCard) => Promise<void>;
}

export function RoutineDetailDrawer({
  card,
  userGoals,
  onClose,
  onStartWorkout,
  onTrainTogether,
  onViewSummary,
  onAddItems,
  onToggleItem,
  onDeleteItem,
  onRename,
  onSetTime,
  onSetDays,
  onSetItemTime,
  onSetItemEndTime,
  onLinkGoal,
  onSetTrainingMode,
  onSaveTechniques,
  onDeleteCard,
}: RoutineDetailDrawerProps) {
  const { t } = useLanguage();
  const [editor, setEditor] = React.useState<EditorMode>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [timeValue, setTimeValue] = React.useState("");
  // Per-item reminder times for habit routines with 2+ items (item.id → "HH:MM")
  const [itemTimes, setItemTimes] = React.useState<Record<string, string>>({});
  // Hora de fim por hábito (item.id → "HH:MM"); "" = sem fim
  const [itemEndTimes, setItemEndTimes] = React.useState<Record<string, string>>({});
  // Set of Monday-first weekday indices (0=Mon … 6=Sun), empty = every day
  const [selectedDays, setSelectedDays] = React.useState<Set<number>>(new Set());
  const [isBusy, setIsBusy] = React.useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [expandedItem, setExpandedItem] = React.useState<string | null>(null);
  // Progressão de carga por exercício (lazy: carrega ao expandir a linha)
  const [progressByItem, setProgressByItem] = React.useState<Record<string, ExerciseProgressPoint[]>>({});
  // O editor "renomear" abre um input no meio do scroll — mantê-lo acima do teclado.
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  useKeyboardInputScroll(scrollRef, !!card);

  // Reset da progressão ao trocar de rotina (ids de item podem colidir entre cards)
  React.useEffect(() => {
    setProgressByItem({});
  }, [card?.key]);

  // Carrega a progressão do exercício expandido (uma vez por item; ignora cardio)
  React.useEffect(() => {
    if (!expandedItem || !card) return;
    if (progressByItem[expandedItem] !== undefined) return;
    const item = card.items.find((i) => i.id === expandedItem);
    if (!item || item.kind !== "workout") return;
    const isCardio = (item.muscle_group || "").toLowerCase().includes("cardio");
    if (isCardio || !item.workout_id) return;
    let cancelled = false;
    getExerciseProgressionDb(item.workout_id)
      .then((pts) => { if (!cancelled) setProgressByItem((m) => ({ ...m, [expandedItem]: pts })); })
      .catch(() => { if (!cancelled) setProgressByItem((m) => ({ ...m, [expandedItem]: [] })); });
    return () => { cancelled = true; };
  }, [expandedItem, card, progressByItem]);

  const toggleDay = (idx: number) =>
    setSelectedDays((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });

  // Séries × reps sugeridos pelo programa: program_meta da rotina (programas
  // gerados pelo quiz) ou catálogo estático casado pelo nome, os mesmos
  // exibidos no momento da criação. Rotina custom → mapa vazio.
  const suggestedSets = React.useMemo(
    () => getSuggestedSetsForCard(card),
    [card],
  );

  // Hábitos são exibidos na ORDEM DE EXECUÇÃO (por horário) — a lista vira a
  // agenda do dia. Sem horário vai para o fim (nada a agendar). Só hábito:
  // em TREINO a ordem dos exercícios é a da sessão e não pode ser mexida, e
  // DIETA usa horário único compartilhado (ordenar não mudaria nada).
  // `sort` é estável, então itens no mesmo horário mantêm a ordem de criação.
  const orderedItems = React.useMemo(() => {
    const items = card?.items ?? [];
    if (card?.type !== 3) return items;
    return [...items].sort((a, b) => {
      const ta = a.scheduled_time ?? "";
      const tb = b.scheduled_time ?? "";
      if (!ta && !tb) return 0;
      if (!ta) return 1;
      if (!tb) return -1;
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    });
  }, [card]);

  React.useEffect(() => {
    if (card) {
      setEditor(null);
      setRenameValue(card.name ?? "");
      setTimeValue(card.scheduledTime ? card.scheduledTime.slice(0, 5) : "");
      const times: Record<string, string> = {};
      const endTimes: Record<string, string> = {};
      card.items.forEach((i) => {
        times[i.id] = i.scheduled_time ? i.scheduled_time.slice(0, 5) : "";
        // Só hábito tem hora de fim (a coluna existe apenas em user_habits).
        endTimes[i.id] =
          i.kind === "habit" && i.scheduled_end_time ? i.scheduled_end_time.slice(0, 5) : "";
      });
      setItemTimes(times);
      setItemEndTimes(endTimes);
      const parsed = (card.scheduledDays ?? "")
        .split(",")
        .map(Number)
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
      setSelectedDays(new Set(parsed));
      setDeleteConfirmOpen(false);
      setExpandedItem(null);
    }
  }, [card?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Plano de técnicas, derivado dos itens da rotina ─────────────────────
  // ATENÇÃO: fica ACIMA do `if (!card) return null` abaixo. Hook depois de um
  // early return roda condicionalmente e quebra o componente com "Rendered more
  // hooks than during the previous render" ao abrir uma rotina (o drawer
  // renderiza uma vez com card=null antes de receber o card).
  const techniqueItems = React.useMemo<TechniquePlanItem[]>(
    () =>
      (card?.items ?? [])
        .filter((i) => i.kind === "workout")
        .map((i) => ({
          id: i.id,
          name: (i as any).workoutName ?? "",
          muscleGroup: (i as any).muscle_group ?? null,
        })),
    [card?.items],
  );

  const [techniquePlan, setTechniquePlan] = React.useState<TechniquePlan>({});
  // Recarrega o plano ao abrir outra rotina (ou quando os itens mudam) para o
  // editor sempre partir do que está gravado, nunca do plano da rotina anterior.
  React.useEffect(() => {
    const initial: TechniquePlan = {};
    for (const i of card?.items ?? []) {
      if (i.kind !== "workout") continue;
      initial[i.id] = {
        technique: toWorkoutTechnique((i as any).technique),
        group: (i as any).technique_group ?? null,
      };
    }
    setTechniquePlan(initial);
  }, [card?.key, card?.items]);

  /** Resumo curto ao lado do botão "Técnicas": quantos exercícios saíram do padrão. */
  const techniqueSummary = React.useMemo(() => {
    const n = Object.values(techniquePlan).filter((v) => v.technique !== "straight").length;
    return n === 0 ? t("goals_technique_none_selected") : `${n}`;
  }, [techniquePlan, t]);

  if (!card) return null;

  const label =
    card.name ??
    (card.type === 1
      ? t("goals_rt_exercises")
      : card.type === 2
        ? t("goals_rt_diets")
        : t("goals_rt_habits"));
  const linkedGoal = card.goalId ? userGoals.find((g) => g.goal_id === card.goalId) : null;
  // TODA rotina de hábito edita por item — inclusive com um único hábito, que
  // também tem janela início→fim (o input único não comporta o fim, e o fim
  // ficaria salvo porém invisível/inatingível aqui).
  const isHabitRoutine = card.type === 3;
  // Treino sequencial: sem dias fixos. Ao editar o lembrete, preserva o 'seq'
  // em vez de sobrescrever com dias/null (o que tiraria o modo sequencial).
  const isSeq = isSequentialCard(card);

  const runAction = async (fn: () => Promise<void>) => {
    setIsBusy(true);
    try {
      await fn();
      setEditor(null);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} fixed>
      <DrawerContent
        handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
        className="flex flex-col !rounded-t-[32px] !border-0"
        style={{
          maxHeight: "90dvh",
          background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderTop: "1px solid rgba(255,255,255,.14)",
        }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DrawerHeader className="shrink-0 pb-2">
          <DrawerTitle className="flex items-center gap-2 text-left" style={{ color: "#fff" }}>
            <span>{card.type === 1 ? "🏋️" : card.type === 2 ? "🥗" : "✅"}</span>
            <span className="flex-1 truncate">{label}</span>
            {card.type === 1 && card.lastSummary && (
              <button
                onClick={() => {
                  onClose();
                  onViewSummary(card);
                }}
                aria-label={t("goals_detail_view_summary")}
                className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                style={{ background: "rgba(91,140,255,.14)", border: "1px solid rgba(91,140,255,.3)" }}
              >
                <BarChart3 className="h-4 w-4" style={{ color: "#5b8cff" }} />
              </button>
            )}
          </DrawerTitle>
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            {/* Modo expert: sem este selo, a única pista de que a rotina se
                comporta diferente (aquecimento fora do volume/PR) apareceria
                só dentro da sessão de treino já iniciada. */}
            {card.type === 1 && card.trainingMode === "expert" && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 text-[11px] font-semibold">
                <Sparkles className="h-3 w-3" />
                {t("goals_mode_expert")}
              </span>
            )}
            {card.scheduledTime && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[11px] font-medium">
                <Bell className="h-3 w-3" />
                {formatScheduledTime(card.scheduledTime)}
              </span>
            )}
            {linkedGoal && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-medium max-w-full">
                <Target className="h-3 w-3 shrink-0" />
                <span className="truncate">{linkedGoal.description}</span>
              </span>
            )}
          </div>
        </DrawerHeader>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 space-y-3"
          style={{ paddingBottom: "calc(2rem + var(--keyboard-height, 0px))" }}
        >
          {/* Items */}
          <div className="space-y-1.5">
            {orderedItems.map((item) => {
              const itemName =
                item.kind === "workout"
                  ? item.workoutName
                  : item.kind === "diet"
                    ? item.dietName
                    : item.habitName;
              const completed = card.type !== 1 && isCompletedToday(item as any);
              const isWorkout = item.kind === "workout";
              // Hábito tem horário POR ITEM (o chip do header mostra só o do
              // primeiro), então a linha expande para revelar o horário dele.
              const isHabit = item.kind === "habit";
              // Dieta expande para mostrar a informação nutricional do alimento.
              const isDiet = item.kind === "diet";
              const sug = isWorkout
                ? suggestedSets.get((item.workoutName || "").trim().toLowerCase())
                : undefined;
              const expanded = expandedItem === item.id;
              const isCardio = item.kind === "workout" && (item.muscle_group || "").toLowerCase().includes("cardio");
              const progressPts = isWorkout ? progressByItem[item.id] : undefined;
              const subtitle =
                item.kind === "workout"
                  ? item.muscle_group || ""
                  : item.kind === "diet"
                    ? [item.dietCategory, item.dietCalories ? `${item.dietCalories} kcal` : null].filter(Boolean).join(" · ")
                    : item.habitDescription || "";
              return (
                <div
                  key={item.id}
                  className="rounded-2xl overflow-hidden"
                  style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}
                >
                  <div className="flex items-center gap-3 p-2.5">
                    {isWorkout ? (
                      <button
                        onClick={() => setExpandedItem(expanded ? null : item.id)}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                        aria-expanded={expanded}
                      >
                        <ExerciseImage
                          photo={item.workoutPhoto ?? null}
                          name={item.workoutName || ""}
                          muscleGroup={item.muscle_group}
                          className="h-10 w-10 rounded-lg shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: "#fff" }}>
                            {itemName}
                          </p>
                          <p className="text-xs truncate" style={{ color: "rgba(255,255,255,.5)" }}>
                            {subtitle}
                          </p>
                        </div>
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
                          style={{ color: "rgba(255,255,255,.5)" }}
                        />
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => onToggleItem(card, item, !completed)}
                          className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 transition-all active:scale-95 ${
                            completed ? "bg-emerald-500 text-white" : "bg-muted/50 text-muted-foreground"
                          }`}
                          aria-label={itemName}
                        >
                          <Check className="h-5 w-5" />
                        </button>
                        {isHabit || isDiet ? (
                          <button
                            onClick={() => setExpandedItem(expanded ? null : item.id)}
                            className="flex items-center gap-2 flex-1 min-w-0 text-left"
                            aria-expanded={expanded}
                          >
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium truncate ${completed ? "line-through" : ""}`} style={{ color: completed ? "rgba(255,255,255,.4)" : "#fff" }}>
                                {itemName}
                              </p>
                              <p className="text-xs truncate" style={{ color: "rgba(255,255,255,.5)" }}>
                                {subtitle}
                              </p>
                            </div>
                            <ChevronDown
                              className={`h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
                              style={{ color: "rgba(255,255,255,.5)" }}
                            />
                          </button>
                        ) : (
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${completed ? "line-through" : ""}`} style={{ color: completed ? "rgba(255,255,255,.4)" : "#fff" }}>
                              {itemName}
                            </p>
                            <p className="text-xs truncate" style={{ color: "rgba(255,255,255,.5)" }}>
                              {subtitle}
                            </p>
                          </div>
                        )}
                      </>
                    )}
                    <button
                      onClick={() => onDeleteItem(card, item)}
                      className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground/60 shrink-0"
                      aria-label={t("goals_remove_from_routine")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {expanded && (
                    <div className="px-2.5 pb-2.5">
                      <div
                        className="flex items-center justify-between rounded-xl px-3 py-2.5"
                        style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}
                      >
                        <span className="text-xs flex items-center gap-1.5" style={{ color: "rgba(255,255,255,.5)" }}>
                          {isHabit && <Bell className="h-3 w-3" />}
                          {isDiet && <Flame className="h-3 w-3" />}
                          {isHabit
                            ? t("goals_detail_item_time_caption")
                            : isDiet
                              ? t("goals_detail_item_calories_caption")
                              : t("goals_detail_series_reps_caption")}
                        </span>
                        {isDiet ? (
                          item.dietCalories != null ? (
                            <span className="text-sm font-bold tabular-nums" style={{ color: "#3ddc84" }}>
                              {Math.round(item.dietCalories)} {t("nutrition_kcal")}
                            </span>
                          ) : (
                            // O catálogo de alimentos foi semeado sem dado
                            // nutricional — sem isso a linha ficaria em branco.
                            <span className="text-xs text-right max-w-[55%]" style={{ color: "rgba(255,255,255,.5)" }}>
                              {t("goals_detail_item_no_calories")}
                            </span>
                          )
                        ) : isHabit ? (
                          item.scheduled_time ? (
                            <span className="text-sm font-bold tabular-nums" style={{ color: "#5b8cff" }}>
                              {formatScheduledTime(item.scheduled_time)}
                              {item.kind === "habit" && item.scheduled_end_time
                                ? ` – ${formatScheduledTime(item.scheduled_end_time)}`
                                : ""}
                            </span>
                          ) : (
                            <span className="text-xs text-right max-w-[55%]" style={{ color: "rgba(255,255,255,.5)" }}>
                              {t("goals_detail_item_no_time")}
                            </span>
                          )
                        ) : sug ? (
                          <span className="text-sm font-bold tabular-nums" style={{ color: "#fff" }}>
                            {sug.series} × {sug.reps}
                          </span>
                        ) : (
                          <span className="text-xs text-right max-w-[55%]" style={{ color: "rgba(255,255,255,.5)" }}>
                            {t("goals_detail_no_suggested_sets")}
                          </span>
                        )}
                      </div>

                      {/* Macros — só quando o alimento tem algum valor. */}
                      {isDiet &&
                        (item.dietProtein != null || item.dietCarbs != null || item.dietFat != null) && (
                          <div className="mt-2 grid grid-cols-3 gap-2">
                            {[
                              { l: t("nutrition_protein_short"), v: item.dietProtein },
                              { l: t("nutrition_carbs_short"), v: item.dietCarbs },
                              { l: t("nutrition_fat_short"), v: item.dietFat },
                            ].map((m) => (
                              <div
                                key={m.l}
                                className="rounded-xl px-2 py-2 text-center"
                                style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}
                              >
                                <div className="text-white tabular-nums font-semibold" style={{ fontSize: "13px" }}>
                                  {m.v != null ? `${Math.round(m.v)}g` : "—"}
                                </div>
                                <div style={{ fontSize: "10.5px", color: "rgba(255,255,255,.45)" }}>{m.l}</div>
                              </div>
                            ))}
                          </div>
                        )}

                      {!isCardio && progressPts && progressPts.length >= 2 && (
                        <PremiumGate feature="charts" className="mt-2">
                          <div
                            className="rounded-xl px-3 py-2.5"
                            style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
                                {t("goals_progress_title")}
                              </span>
                              <span className="text-xs tabular-nums" style={{ color: "rgba(255,255,255,.7)" }}>
                                {t("goals_progress_best").replace("{n}", String(Math.max(...progressPts.map((p) => p.maxKg))))}
                              </span>
                            </div>
                            <TrendChart
                              points={progressPts.map((p) => ({ label: p.date, value: p.maxKg }))}
                              color="#3ddc84"
                              height={72}
                            />
                          </div>
                        </PremiumGate>
                      )}

                      {/* Anatomia do exercício expandido — mesma ficha do
                          catálogo e da sessão. Não renderiza nada quando o
                          exercício não tem músculos mapeados. */}
                      {isWorkout && (
                        <div className="mt-2">
                          <ExerciseAnatomy workoutId={(item as any).workout_id} workoutName={itemName} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Inline editors */}
          {editor === "rename" && (
            <div className="rounded-2xl p-3 space-y-2" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder={t("goals_edit_routine_name_placeholder")}
                maxLength={60}
                style={{ fontSize: "16px", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }}
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 rounded-full" style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.7)", border: "1px solid rgba(255,255,255,.12)" }} onClick={() => setEditor(null)}>
                  {t("goals_cancel")}
                </Button>
                <Button
                  size="sm"
                  className="flex-1 rounded-full"
                  style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
                  disabled={!renameValue.trim() || isBusy}
                  onClick={() => runAction(() => onRename(card, renameValue.trim()))}
                >
                  {isBusy ? t("goals_saving") : t("goals_edit_routine_save")}
                </Button>
              </div>
            </div>
          )}

          {editor === "time" && (
            <div className="rounded-2xl p-3 space-y-3" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
              {isHabitRoutine ? (
                <>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
                    {t("goals_edit_habit_time_per_item_hint")}
                  </p>
                  {/* Mesma ordem da lista de cima (por horário) — as duas listas
                      são os mesmos hábitos; ordens diferentes confundiriam. Só
                      reordena quando o card recarrega, nunca enquanto digita. */}
                  <div className="space-y-3">
                    {orderedItems.map((item) => (
                      <HabitTimeRow
                        key={item.id}
                        name={item.kind === "habit" ? item.habitName ?? "" : ""}
                        start={itemTimes[item.id] ?? ""}
                        end={itemEndTimes[item.id] ?? ""}
                        onStartChange={(v) => setItemTimes((prev) => ({ ...prev, [item.id]: v }))}
                        onEndChange={(v) => setItemEndTimes((prev) => ({ ...prev, [item.id]: v }))}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
                    {timeValue ? t("goals_edit_routine_time_set").replace("{time}", timeValue) : t("goals_edit_routine_time_empty")}
                  </p>
                  <div
                    className="w-full h-11 rounded-xl overflow-hidden"
                    style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)" }}
                  >
                    <input
                      type="time"
                      value={timeValue}
                      onChange={(e) => setTimeValue(e.target.value)}
                      className="block w-full h-full px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      // textAlign center: o horário selecionado fica centralizado
                      // no campo (o iOS não centraliza o <input type="time"> sozinho).
                      style={{ fontSize: "16px", minWidth: 0, maxWidth: "100%", boxSizing: "border-box", background: "transparent", border: "none", color: "#fff", textAlign: "center" }}
                    />
                  </div>
                </>
              )}

              {/* Sequencial não tem dias fixos — mostra só um aviso. */}
              {isSeq && (
                <div
                  className="rounded-xl px-3 py-2 text-xs flex items-center gap-2"
                  style={{ background: "rgba(93,140,255,.1)", border: "1px solid rgba(93,140,255,.28)", color: "#a9c0ff" }}
                >
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  <span>{t("goals_seq_label")} · {t("goals_schedule_seq_hint")}</span>
                </div>
              )}

              {/* Seleção de dias da semana — oculta no modo sequencial */}
              {!isSeq && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,.7)" }}>
                  {t("goals_edit_routine_days_label")}
                </p>
                <div className="flex gap-1.5">
                  {WEEKDAY_KEYS.map((key, idx) => {
                    const active = selectedDays.has(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleDay(idx)}
                        className="flex-1 rounded-xl py-2 text-[11px] font-bold transition-all active:scale-95"
                        style={
                          active
                            ? { background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }
                            : { background: "rgba(255,255,255,.07)", color: "rgba(255,255,255,.45)", border: "1px solid rgba(255,255,255,.1)" }
                        }
                      >
                        {t(key)}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px]" style={{ color: "rgba(255,255,255,.35)" }}>
                  {t("goals_edit_routine_days_hint")}
                </p>
              </div>
              )}

              <div className="flex gap-2">
                {card.scheduledTime && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 rounded-full"
                    style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.7)", border: "1px solid rgba(255,255,255,.12)" }}
                    disabled={isBusy}
                    onClick={() => runAction(async () => {
                      await onSetTime(card, null);
                      // Desligar tudo inclui a hora de fim — sem isso o fim
                      // ficaria no banco sem um início, órfão e invisível.
                      if (isHabitRoutine) {
                        await Promise.all(card.items.map((item) => onSetItemEndTime(item, null)));
                      }
                      // Desligar o lembrete de uma rotina sequencial mantém o
                      // modo (só zera o horário), senão viraria "dias: todo dia".
                      await onSetDays(card, isSeq ? SEQUENTIAL_MARKER : null);
                    })}
                  >
                    {t("goals_edit_routine_disable_reminder")}
                  </Button>
                )}
                <Button
                  size="sm"
                  className="flex-1 rounded-full"
                  style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
                  disabled={(!isHabitRoutine && !timeValue) || isBusy}
                  onClick={() => {
                    const daysStr = Array.from(selectedDays).sort((a, b) => a - b).join(",");
                    runAction(async () => {
                      if (isHabitRoutine) {
                        await Promise.all(
                          card.items.flatMap((item) => [
                            onSetItemTime(item, itemTimes[item.id] || null),
                            // Sem início não há janela: garante que o fim não
                            // fique órfão quando o horário é limpo.
                            onSetItemEndTime(
                              item,
                              itemTimes[item.id] ? itemEndTimes[item.id] || null : null,
                            ),
                          ]),
                        );
                      } else {
                        await onSetTime(card, timeValue);
                      }
                      await onSetDays(card, isSeq ? SEQUENTIAL_MARKER : daysStr || null);
                    });
                  }}
                >
                  {isBusy ? t("goals_saving") : t("goals_edit_routine_save")}
                </Button>
              </div>
            </div>
          )}

          {editor === "goal" && (
            <div className="rounded-2xl p-3 space-y-1.5" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
              {userGoals.filter((g) => g.perc < 100).length === 0 && (
                <p className="text-xs text-center py-2" style={{ color: "rgba(255,255,255,.5)" }}>
                  {t("goals_no_available_routines")}
                </p>
              )}
              {userGoals
                .filter((g) => g.perc < 100)
                .map((g) => (
                  <button
                    key={g.id}
                    disabled={isBusy}
                    onClick={() =>
                      runAction(() => onLinkGoal(card, card.goalId === g.goal_id ? null : g))
                    }
                    className="w-full flex items-center gap-2 rounded-2xl p-3 text-left text-sm transition-all"
                  style={card.goalId === g.goal_id ? { border: "1px solid #5b8cff", background: "rgba(91,140,255,.1)" } : { border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)" }}
                  >
                    <Target className="h-4 w-4 text-primary shrink-0" />
                    <span className="flex-1 truncate font-medium" style={{ color: "#fff" }}>{g.description}</span>
                    {card.goalId === g.goal_id && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                ))}
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-4 gap-2 pt-1">
            <button
              onClick={() => setEditor(editor === "rename" ? null : "rename")}
              className="flex flex-col items-center gap-1 rounded-2xl p-3 text-xs font-medium transition-all"
              style={editor === "rename" ? { border: "1px solid #5b8cff", background: "rgba(91,140,255,.1)", color: "#fff" } : { border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.7)" }}
            >
              <Pencil className="h-4 w-4" />
              {t("goals_detail_rename")}
            </button>
            <button
              onClick={() => setEditor(editor === "time" ? null : "time")}
              className="flex flex-col items-center gap-1 rounded-2xl p-3 text-xs font-medium transition-all"
              style={editor === "time" ? { border: "1px solid #5b8cff", background: "rgba(91,140,255,.1)", color: "#fff" } : { border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.7)" }}
            >
              <Bell className="h-4 w-4" />
              {t("goals_detail_reminder")}
            </button>
            <button
              onClick={() => setEditor(editor === "goal" ? null : "goal")}
              className="flex flex-col items-center gap-1 rounded-2xl p-3 text-xs font-medium transition-all"
              style={editor === "goal" ? { border: "1px solid #5b8cff", background: "rgba(91,140,255,.1)", color: "#fff" } : { border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.7)" }}
            >
              <Target className="h-4 w-4" />
              {t("goals_detail_goal")}
            </button>
            <button
              onClick={() => {
                onClose();
                onAddItems(card);
              }}
              className="flex flex-col items-center gap-1 rounded-2xl p-3 text-xs font-medium transition-all"
              style={{ border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.7)" }}
            >
              <ListPlus className="h-4 w-4" />
              {t("goals_detail_edit_items")}
            </button>
          </div>

          {/* Modo de treino — faixa própria, não um 5º ícone na grade: a escolha
              muda a tela de registro inteira, então precisa do rótulo por
              extenso. Trocar vale da PRÓXIMA sessão em diante; o histórico já
              gravado mantém o `set_kind` com que foi salvo. */}
          {card.type === 1 && (
            <div className="rounded-2xl p-3 space-y-2" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
              <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,.7)" }}>
                {t("goals_detail_training_mode")}
              </p>
              <div className="flex gap-1 p-1 rounded-2xl" style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}>
                {(["simple", "expert"] as const).map((mode) => {
                  const active = card.trainingMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      disabled={isBusy || active}
                      onClick={() => runAction(() => onSetTrainingMode(card, mode))}
                      className="flex-1 h-9 rounded-xl text-[13px] font-semibold transition-all active:scale-95 disabled:active:scale-100"
                      style={active
                        ? { background: "linear-gradient(rgba(255,255,255,.95),rgba(255,255,255,.84))", color: "#0a0b12" }
                        : { color: "rgba(255,255,255,.6)" }}
                    >
                      {mode === "simple" ? t("goals_mode_simple") : t("goals_mode_expert")}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,.35)" }}>
                {card.trainingMode === "expert"
                  ? t("goals_detail_training_mode_expert_hint")
                  : t("goals_detail_training_mode_simple_hint")}
              </p>

              {/* Técnicas — só no expert: bi-set/drop-set são o miolo do modo
                  detalhado, e no simplificado a sessão não os renderiza. */}
              {card.trainingMode === "expert" && card.items.length > 0 && (
                <button
                  type="button"
                  onClick={() => setEditor(editor === "technique" ? null : "technique")}
                  className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5 mt-1 transition-all active:scale-[0.99]"
                  style={editor === "technique"
                    ? { border: "1px solid #c084fc", background: "rgba(192,132,252,.12)" }
                    : { border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)" }}
                >
                  <Link2 className="h-4 w-4 shrink-0" style={{ color: "#c084fc" }} />
                  <span className="flex-1 text-left text-[13px] font-semibold" style={{ color: "#fff" }}>
                    {t("goals_technique_edit")}
                  </span>
                  <span className="text-[11px]" style={{ color: "rgba(255,255,255,.45)" }}>
                    {techniqueSummary}
                  </span>
                </button>
              )}

              {editor === "technique" && (
                <div className="space-y-2 pt-1">
                  <TechniquePlanner
                    items={techniqueItems}
                    plan={techniquePlan}
                    onChange={setTechniquePlan}
                  />
                  <Button
                    size="sm"
                    className="w-full rounded-full"
                    style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
                    disabled={isBusy}
                    onClick={() => runAction(async () => {
                      await onSaveTechniques(card, planToAssignments(techniqueItems, techniquePlan));
                    })}
                  >
                    {isBusy ? t("goals_saving") : t("goals_edit_routine_save")}
                  </Button>
                </div>
              )}
            </div>
          )}

          {card.type === 1 && (
            <div className="flex items-center gap-2">
              <Button
                className="flex-1 rounded-full h-12"
                style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
                onClick={() => {
                  onClose();
                  onStartWorkout(card);
                }}
              >
                <Play className="h-4 w-4 mr-1.5" />
                {t("goals_session_start")}
              </Button>
              {onTrainTogether && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onTrainTogether(card);
                  }}
                  aria-label={t("goals_party_invite_cta")}
                  className="h-12 w-12 shrink-0 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
                  style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.18)" }}
                >
                  <UserPlus className="h-5 w-5" />
                </button>
              )}
            </div>
          )}

          <Button
            variant="outline"
            className="w-full rounded-full h-11"
            style={{ background: "rgba(239,68,68,.1)", color: "#f87171", border: "1px solid rgba(239,68,68,.3)" }}
            onClick={() => setDeleteConfirmOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            {t("goals_delete_routine")}
          </Button>
        </div>

        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("goals_delete_routine")}</AlertDialogTitle>
              <AlertDialogDescription>{t("goals_delete_routine_confirm")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("goals_cancel")}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={isBusy}
                onClick={async (e) => {
                  e.preventDefault();
                  setIsBusy(true);
                  try {
                    await onDeleteCard(card);
                    setDeleteConfirmOpen(false);
                    onClose();
                  } finally {
                    setIsBusy(false);
                  }
                }}
              >
                {isBusy ? t("goals_saving") : t("goals_delete_routine")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DrawerContent>
    </Drawer>
  );
}
