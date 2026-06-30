import * as React from "react";
import { Bell, Check, ChevronDown, Pencil, Play, Target, Trash2 } from "lucide-react";
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
import { useLanguage } from "@/lib/language-context";
import type { TranslationKey } from "@/lib/i18n";
import { formatScheduledTime } from "@/hooks/use-routine-notifications";
import { isCompletedToday, type RoutineCard, type RoutineItem } from "@/components/goals/goals-helpers";
import { getSuggestedSetsForRoutine } from "@/components/goals/suggested-routines-data";
import type { UserGoal } from "@/lib/ritmofit-db";

type EditorMode = null | "rename" | "time" | "goal";

const WEEKDAY_KEYS: TranslationKey[] = [
  "goals_weekday_mon", "goals_weekday_tue", "goals_weekday_wed",
  "goals_weekday_thu", "goals_weekday_fri", "goals_weekday_sat", "goals_weekday_sun",
];

interface RoutineDetailDrawerProps {
  card: RoutineCard | null;
  userGoals: UserGoal[];
  onClose: () => void;
  onStartWorkout: (card: RoutineCard) => void;
  onToggleItem: (card: RoutineCard, item: RoutineItem, completed: boolean) => void;
  onDeleteItem: (card: RoutineCard, item: RoutineItem) => Promise<void>;
  onRename: (card: RoutineCard, newName: string) => Promise<void>;
  onSetTime: (card: RoutineCard, time: string | null) => Promise<void>;
  onSetDays: (card: RoutineCard, days: string | null) => Promise<void>;
  onLinkGoal: (card: RoutineCard, goal: UserGoal | null) => Promise<void>;
  onDeleteCard: (card: RoutineCard) => Promise<void>;
}

export function RoutineDetailDrawer({
  card,
  userGoals,
  onClose,
  onStartWorkout,
  onToggleItem,
  onDeleteItem,
  onRename,
  onSetTime,
  onSetDays,
  onLinkGoal,
  onDeleteCard,
}: RoutineDetailDrawerProps) {
  const { t } = useLanguage();
  const [editor, setEditor] = React.useState<EditorMode>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [timeValue, setTimeValue] = React.useState("");
  // Set of Monday-first weekday indices (0=Mon … 6=Sun), empty = every day
  const [selectedDays, setSelectedDays] = React.useState<Set<number>>(new Set());
  const [isBusy, setIsBusy] = React.useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [expandedItem, setExpandedItem] = React.useState<string | null>(null);

  const toggleDay = (idx: number) =>
    setSelectedDays((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });

  // Séries × reps sugeridos pelo programa (casado pelo nome da rotina), os
  // mesmos exibidos no momento da criação. Rotina custom → mapa vazio.
  const suggestedSets = React.useMemo(
    () => getSuggestedSetsForRoutine(card?.name ?? ""),
    [card?.name],
  );

  React.useEffect(() => {
    if (card) {
      setEditor(null);
      setRenameValue(card.name ?? "");
      setTimeValue(card.scheduledTime ? card.scheduledTime.slice(0, 5) : "");
      const parsed = (card.scheduledDays ?? "")
        .split(",")
        .map(Number)
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
      setSelectedDays(new Set(parsed));
      setDeleteConfirmOpen(false);
      setExpandedItem(null);
    }
  }, [card?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!card) return null;

  const label =
    card.name ??
    (card.type === 1
      ? t("goals_rt_exercises")
      : card.type === 2
        ? t("goals_rt_diets")
        : t("goals_rt_habits"));
  const linkedGoal = card.goalId ? userGoals.find((g) => g.goal_id === card.goalId) : null;

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
    <Drawer open onOpenChange={(o) => !o && onClose()}>
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
          </DrawerTitle>
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
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

        <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-3">
          {/* Items */}
          <div className="space-y-1.5">
            {card.items.map((item) => {
              const itemName =
                item.kind === "workout"
                  ? item.workoutName
                  : item.kind === "diet"
                    ? item.dietName
                    : item.habitName;
              const completed = card.type !== 1 && isCompletedToday(item as any);
              const isWorkout = item.kind === "workout";
              const sug = isWorkout
                ? suggestedSets.get((item.workoutName || "").trim().toLowerCase())
                : undefined;
              const expanded = isWorkout && expandedItem === item.id;
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
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${completed ? "line-through" : ""}`} style={{ color: completed ? "rgba(255,255,255,.4)" : "#fff" }}>
                            {itemName}
                          </p>
                          <p className="text-xs truncate" style={{ color: "rgba(255,255,255,.5)" }}>
                            {subtitle}
                          </p>
                        </div>
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
                        <span className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
                          {t("goals_detail_series_reps_caption")}
                        </span>
                        {sug ? (
                          <span className="text-sm font-bold tabular-nums" style={{ color: "#fff" }}>
                            {sug.series} × {sug.reps}
                          </span>
                        ) : (
                          <span className="text-xs text-right max-w-[55%]" style={{ color: "rgba(255,255,255,.5)" }}>
                            {t("goals_detail_no_suggested_sets")}
                          </span>
                        )}
                      </div>
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
              <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
                {timeValue ? t("goals_edit_routine_time_set").replace("{time}", timeValue) : t("goals_edit_routine_time_empty")}
              </p>
              <input
                type="time"
                value={timeValue}
                onChange={(e) => setTimeValue(e.target.value)}
                className="w-full h-11 rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                style={{ fontSize: "16px", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }}
              />

              {/* Seleção de dias da semana */}
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
                      await onSetDays(card, null);
                    })}
                  >
                    {t("goals_edit_routine_disable_reminder")}
                  </Button>
                )}
                <Button
                  size="sm"
                  className="flex-1 rounded-full"
                  style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
                  disabled={!timeValue || isBusy}
                  onClick={() => {
                    const daysStr = Array.from(selectedDays).sort((a, b) => a - b).join(",");
                    runAction(async () => {
                      await onSetTime(card, timeValue);
                      await onSetDays(card, daysStr || null);
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
          <div className="grid grid-cols-3 gap-2 pt-1">
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
          </div>

          {card.type === 1 && (
            <Button
              className="w-full rounded-full h-12"
              style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
              onClick={() => {
                onClose();
                onStartWorkout(card);
              }}
            >
              <Play className="h-4 w-4 mr-1.5" />
              {t("goals_session_start")}
            </Button>
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
