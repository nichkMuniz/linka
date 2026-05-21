import * as React from "react";
import { Clock, BellOff } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import {
  updateRoutineNameDb,
  updateRoutineItemsScheduledTimeDb,
  getUserRoutinesDb,
  getUserWorkoutsDb,
  getUserDietsDb,
  getUserHabitsDb,
  type Routine,
  type UserWorkoutWithDetails,
  type UserDietWithDetails,
  type UserHabitWithDetails,
} from "@/lib/ritmofit-db";

interface RenameRoutineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  routineData: { typeCode: number; oldName: string | null } | null;
  initialValue: string;
  initialScheduledTime: string | null;
  onRenamed: (data: {
    routines: Routine[];
    userWorkouts: UserWorkoutWithDetails[];
    userDiets: UserDietWithDetails[];
    userHabits: UserHabitWithDetails[];
  }) => void;
}

export function RenameRoutineDialog({
  open,
  onOpenChange,
  userId,
  routineData,
  initialValue,
  initialScheduledTime,
  onRenamed,
}: RenameRoutineDialogProps) {
  const { t } = useLanguage();
  const [value, setValue] = React.useState(initialValue);
  const [time, setTime] = React.useState(initialScheduledTime ?? "");
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setValue(initialValue);
      setTime(initialScheduledTime ?? "");
    }
  }, [open, initialValue, initialScheduledTime]);

  const handleSave = async () => {
    if (!routineData || !value.trim()) return;
    setIsSaving(true);
    try {
      const trimmedName = value.trim();
      const nameChanged = trimmedName !== (routineData.oldName ?? "");
      const newTime = time || null;
      const timeChanged = newTime !== (initialScheduledTime ?? null);

      if (nameChanged) {
        await updateRoutineNameDb(
          userId,
          routineData.oldName,
          routineData.typeCode,
          trimmedName,
        );
      }
      if (timeChanged) {
        await updateRoutineItemsScheduledTimeDb(
          userId,
          routineData.typeCode,
          nameChanged ? trimmedName : routineData.oldName,
          newTime,
        );
      }

      const [freshRoutines, freshWorkouts, freshDiets, freshHabits] = await Promise.all([
        getUserRoutinesDb(userId),
        getUserWorkoutsDb(userId),
        getUserDietsDb(userId),
        getUserHabitsDb(userId),
      ]);
      onRenamed({
        routines: freshRoutines,
        userWorkouts: freshWorkouts,
        userDiets: freshDiets,
        userHabits: freshHabits,
      });
      toast({ title: t("goals_edit_routine_updated") });
      onOpenChange(false);
    } catch {
      toast({ title: t("goals_edit_routine_error"), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{t("goals_edit_routine")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("goals_edit_routine_name_label")}</label>
            <Input
              placeholder={t("goals_edit_routine_name_placeholder")}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {t("goals_edit_routine_time_label")}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="flex-1 px-3 py-3 rounded-xl border border-border/60 bg-background text-foreground text-base focus:outline-none focus:ring-2 focus:ring-brand/40"
              />
              {time && (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl h-[50px] gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive shrink-0"
                  onClick={() => setTime("")}
                  disabled={isSaving}
                >
                  <BellOff className="h-4 w-4" />
                  {t("goals_edit_routine_disable_reminder")}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {time
                ? t("goals_edit_routine_time_set").replace("{time}", time)
                : t("goals_edit_routine_time_empty")}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 rounded-full"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              {t("goals_edit_routine_cancel")}
            </Button>
            <Button
              className="flex-1 rounded-full"
              disabled={!value.trim() || isSaving}
              onClick={handleSave}
            >
              {isSaving ? t("goals_edit_routine_saving") : t("goals_edit_routine_save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
