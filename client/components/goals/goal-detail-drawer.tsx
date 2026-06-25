import * as React from "react";
import { CheckCircle2, Pencil, Trash2, X } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import { useLanguage } from "@/lib/language-context";
import type { Routine, UserGoal } from "@/lib/ritmofit-db";

interface GoalDetailDrawerProps {
  goal: UserGoal | null;
  routines: Routine[];
  onClose: () => void;
  onEditGoal: (goal: UserGoal, updates: { duration: number; quantity: number }) => Promise<void>;
  onDeleteGoal: (goal: UserGoal) => Promise<void>;
}

export function GoalDetailDrawer({
  goal,
  routines,
  onClose,
  onEditGoal,
  onDeleteGoal,
}: GoalDetailDrawerProps) {
  const { t } = useLanguage();
  const [editing, setEditing] = React.useState(false);
  const [durationValue, setDurationValue] = React.useState("");
  const [frequencyValue, setFrequencyValue] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Reset state when a different goal is opened
  React.useEffect(() => {
    if (goal) {
      setEditing(false);
      setDurationValue(String(goal.duration));
      setFrequencyValue(String(goal.quantity));
      setDeleteConfirmOpen(false);
    }
  }, [goal?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!goal) return null;

  const isCompleted = goal.perc >= 100;
  const perc = Math.min(100, Math.round(goal.perc));
  const daysRemaining = Math.max(0, goal.duration - goal.days_completed);
  const linkedRoutines = routines.filter((r) => r.goal_id === goal.goal_id);

  const handleSave = async () => {
    const duration = parseInt(durationValue, 10);
    const quantity = parseInt(frequencyValue, 10);
    if (!duration || duration < 1 || !quantity || quantity < 1) return;
    setIsSaving(true);
    try {
      await onEditGoal(goal, { duration, quantity });
      setEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Drawer open={!!goal} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent>
          <DrawerHeader className="pb-0">
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5 shrink-0">{isCompleted ? "🏆" : "🎯"}</span>
              <DrawerTitle className="text-left text-base font-bold leading-snug flex-1">
                {goal.description}
              </DrawerTitle>
              {isCompleted && (
                <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t("goals_gd_completed_badge")}
                </span>
              )}
            </div>
          </DrawerHeader>

          <div
            className="px-4 pt-5 pb-4 space-y-5 overflow-y-auto"
            style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
          >
            {/* Progress */}
            <div className="space-y-2">
              <div className="flex items-end justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  {t("goals_gd_progress")}
                </span>
                <span className="text-3xl font-bold text-emerald-400 tabular-nums leading-none">
                  {perc}%
                </span>
              </div>
              <Progress value={perc} className="h-3 rounded-full" />
            </div>

            {editing ? (
              /* ── Edit form ── */
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="gd-duration">{t("goals_gd_edit_duration")}</Label>
                  <Input
                    id="gd-duration"
                    type="number"
                    min={1}
                    value={durationValue}
                    onChange={(e) => setDurationValue(e.target.value)}
                    className="rounded-md"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gd-frequency">{t("goals_gd_edit_frequency")}</Label>
                  <Input
                    id="gd-frequency"
                    type="number"
                    min={1}
                    value={frequencyValue}
                    onChange={(e) => setFrequencyValue(e.target.value)}
                    className="rounded-md"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <Button
                    variant="outline"
                    className="rounded-full gap-2"
                    disabled={isSaving}
                    onClick={() => {
                      setDurationValue(String(goal.duration));
                      setFrequencyValue(String(goal.quantity));
                      setEditing(false);
                    }}
                  >
                    <X className="h-4 w-4" />
                    {t("goals_gd_edit_cancel")}
                  </Button>
                  <Button
                    className="rounded-full"
                    disabled={isSaving}
                    onClick={handleSave}
                  >
                    {isSaving ? t("goals_saving") : t("goals_gd_edit_save")}
                  </Button>
                </div>
              </div>
            ) : (
              /* ── View mode ── */
              <>
                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-card border border-border/40 rounded-xl p-4 text-center space-y-1">
                    <p className="text-3xl font-bold tabular-nums">{goal.days_completed}</p>
                    <p className="text-xs text-muted-foreground">{t("goals_gd_days_done")}</p>
                  </div>
                  <div className="bg-card border border-border/40 rounded-xl p-4 text-center space-y-1">
                    <p className="text-3xl font-bold tabular-nums">
                      {isCompleted ? "—" : daysRemaining}
                    </p>
                    <p className="text-xs text-muted-foreground">{t("goals_gd_days_remaining")}</p>
                  </div>
                </div>

                {/* Linked routines */}
                <div className="space-y-2.5">
                  <p className="text-sm font-semibold">{t("goals_gd_linked_routines")}</p>
                  {linkedRoutines.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("goals_gd_no_routines")}</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {linkedRoutines.map((r) => (
                        <span
                          key={r.id}
                          className="inline-flex items-center px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
                        >
                          {r.name ?? t("goals_rt_exercises")}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-2.5 pt-1">
                  {!isCompleted && (
                    <Button
                      variant="outline"
                      className="w-full rounded-full gap-2"
                      onClick={() => setEditing(true)}
                    >
                      <Pencil className="h-4 w-4" />
                      {t("goals_gd_edit")}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="w-full rounded-full text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
                    onClick={() => setDeleteConfirmOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t("goals_gd_delete")}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <AlertDialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => !open && setDeleteConfirmOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("goals_delete_goal")}</AlertDialogTitle>
            <AlertDialogDescription>{t("goals_delete_goal_confirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("goals_cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={async (e) => {
                e.preventDefault();
                setIsDeleting(true);
                try {
                  await onDeleteGoal(goal);
                  setDeleteConfirmOpen(false);
                  onClose();
                } finally {
                  setIsDeleting(false);
                }
              }}
            >
              {isDeleting ? t("goals_saving") : t("goals_delete_goal")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
