import * as React from "react";
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
  onRenamed,
}: RenameRoutineDialogProps) {
  const [value, setValue] = React.useState(initialValue);

  React.useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  const handleSave = async () => {
    if (!routineData || !value.trim()) return;
    try {
      await updateRoutineNameDb(
        userId,
        routineData.oldName,
        routineData.typeCode,
        value.trim(),
      );
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
      toast({ title: "Rotina renomeada!", description: `Nome atualizado para "${value.trim()}".` });
      onOpenChange(false);
    } catch {
      toast({ title: "Erro ao renomear rotina", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Editar nome da rotina</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <Input
            placeholder="Nome da rotina"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 rounded-full"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 rounded-full"
              disabled={!value.trim()}
              onClick={handleSave}
            >
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
