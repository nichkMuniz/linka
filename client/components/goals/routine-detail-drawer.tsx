import * as React from "react";
import { Bell, Check, Pencil, Play, Target, Trash2 } from "lucide-react";
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
import { formatScheduledTime } from "@/hooks/use-routine-notifications";
import { isCompletedToday, type RoutineCard, type RoutineItem } from "@/components/goals/goals-helpers";
import type { UserGoal } from "@/lib/ritmofit-db";

type EditorMode = null | "rename" | "time" | "goal";

interface RoutineDetailDrawerProps {
  card: RoutineCard | null;
  userGoals: UserGoal[];
  onClose: () => void;
  onStartWorkout: (card: RoutineCard) => void;
  onToggleItem: (card: RoutineCard, item: RoutineItem, completed: boolean) => void;
  onDeleteItem: (card: RoutineCard, item: RoutineItem) => Promise<void>;
  onRename: (card: RoutineCard, newName: string) => Promise<void>;
  onSetTime: (card: RoutineCard, time: string | null) => Promise<void>;
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
  onLinkGoal,
  onDeleteCard,
}: RoutineDetailDrawerProps) {
  const { t } = useLanguage();
  const [editor, setEditor] = React.useState<EditorMode>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [timeValue, setTimeValue] = React.useState("");
  const [isBusy, setIsBusy] = React.useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);

  React.useEffect(() => {
    if (card) {
      setEditor(null);
      setRenameValue(card.name ?? "");
      setTimeValue(card.scheduledTime ? card.scheduledTime.slice(0, 5) : "");
      setDeleteConfirmOpen(false);
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
      <DrawerContent className="flex flex-col" style={{ maxHeight: "90dvh" }} onOpenAutoFocus={(e) => e.preventDefault()}>
        <DrawerHeader className="shrink-0 pb-2">
          <DrawerTitle className="flex items-center gap-2 text-left">
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
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 bg-card border border-border/40 rounded-xl p-2.5"
                >
                  {item.kind === "workout" ? (
                    <ExerciseImage
                      photo={item.workoutPhoto ?? null}
                      name={item.workoutName || ""}
                      muscleGroup={item.muscle_group}
                      className="h-10 w-10 rounded-lg"
                    />
                  ) : (
                    <button
                      onClick={() => onToggleItem(card, item, !completed)}
                      className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 transition-all active:scale-95 ${
                        completed ? "bg-emerald-500 text-white" : "bg-muted/50 text-muted-foreground"
                      }`}
                      aria-label={itemName}
                    >
                      <Check className="h-5 w-5" />
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${completed ? "line-through text-muted-foreground" : ""}`}>
                      {itemName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.kind === "workout"
                        ? item.muscle_group || ""
                        : item.kind === "diet"
                          ? [item.dietCategory, item.dietCalories ? `${item.dietCalories} kcal` : null].filter(Boolean).join(" · ")
                          : item.habitDescription || ""}
                    </p>
                  </div>
                  <button
                    onClick={() => onDeleteItem(card, item)}
                    className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground/60 shrink-0"
                    aria-label={t("goals_remove_from_routine")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Inline editors */}
          {editor === "rename" && (
            <div className="bg-card border border-border/40 rounded-xl p-3 space-y-2">
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder={t("goals_edit_routine_name_placeholder")}
                maxLength={60}
                style={{ fontSize: "16px" }}
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 rounded-full" onClick={() => setEditor(null)}>
                  {t("goals_cancel")}
                </Button>
                <Button
                  size="sm"
                  className="flex-1 rounded-full"
                  disabled={!renameValue.trim() || isBusy}
                  onClick={() => runAction(() => onRename(card, renameValue.trim()))}
                >
                  {isBusy ? t("goals_saving") : t("goals_edit_routine_save")}
                </Button>
              </div>
            </div>
          )}

          {editor === "time" && (
            <div className="bg-card border border-border/40 rounded-xl p-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                {timeValue ? t("goals_edit_routine_time_set").replace("{time}", timeValue) : t("goals_edit_routine_time_empty")}
              </p>
              <input
                type="time"
                value={timeValue}
                onChange={(e) => setTimeValue(e.target.value)}
                className="w-full h-11 rounded-xl bg-muted/40 border border-border/40 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                style={{ fontSize: "16px" }}
              />
              <div className="flex gap-2">
                {card.scheduledTime && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 rounded-full"
                    disabled={isBusy}
                    onClick={() => runAction(() => onSetTime(card, null))}
                  >
                    {t("goals_edit_routine_disable_reminder")}
                  </Button>
                )}
                <Button
                  size="sm"
                  className="flex-1 rounded-full"
                  disabled={!timeValue || isBusy}
                  onClick={() => runAction(() => onSetTime(card, timeValue))}
                >
                  {isBusy ? t("goals_saving") : t("goals_edit_routine_save")}
                </Button>
              </div>
            </div>
          )}

          {editor === "goal" && (
            <div className="bg-card border border-border/40 rounded-xl p-3 space-y-1.5">
              {userGoals.filter((g) => g.perc < 100).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
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
                    className={`w-full flex items-center gap-2 rounded-xl border p-2.5 text-left text-sm transition-all ${
                      card.goalId === g.goal_id ? "border-primary bg-primary/5" : "border-border/40"
                    }`}
                  >
                    <Target className="h-4 w-4 text-primary shrink-0" />
                    <span className="flex-1 truncate font-medium">{g.description}</span>
                    {card.goalId === g.goal_id && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                ))}
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <button
              onClick={() => setEditor(editor === "rename" ? null : "rename")}
              className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium transition-all ${
                editor === "rename" ? "border-primary bg-primary/5" : "border-border/40 bg-card"
              }`}
            >
              <Pencil className="h-4 w-4" />
              {t("goals_detail_rename")}
            </button>
            <button
              onClick={() => setEditor(editor === "time" ? null : "time")}
              className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium transition-all ${
                editor === "time" ? "border-primary bg-primary/5" : "border-border/40 bg-card"
              }`}
            >
              <Bell className="h-4 w-4" />
              {t("goals_detail_reminder")}
            </button>
            <button
              onClick={() => setEditor(editor === "goal" ? null : "goal")}
              className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium transition-all ${
                editor === "goal" ? "border-primary bg-primary/5" : "border-border/40 bg-card"
              }`}
            >
              <Target className="h-4 w-4" />
              {t("goals_detail_goal")}
            </button>
          </div>

          {card.type === 1 && (
            <Button
              className="w-full rounded-full h-12"
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
            className="w-full rounded-full h-11 text-destructive border-destructive/30"
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
