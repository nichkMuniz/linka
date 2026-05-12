import * as React from "react";
import { Clock } from "lucide-react";
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
      toast({ title: "Rotina atualizada!" });
      onOpenChange(false);
    } catch {
      toast({ title: "Erro ao atualizar rotina", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Editar rotina</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nome da rotina</label>
            <Input
              placeholder="Nome da rotina"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              Horário de execução
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3 py-3 rounded-xl border border-border/60 bg-background text-foreground text-base focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
            <p className="text-xs text-muted-foreground">
              {time
                ? `Lembrete diário às ${time} para todos os itens desta rotina.`
                : "Deixe em branco para remover o lembrete dos itens desta rotina."}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 rounded-full"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 rounded-full"
              disabled={!value.trim() || isSaving}
              onClick={handleSave}
            >
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
