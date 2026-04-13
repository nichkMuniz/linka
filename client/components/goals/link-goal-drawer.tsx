import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { toast } from "@/components/ui/use-toast";
import { updateRoutineGoalDb, type UserGoal, type Routine } from "@/lib/ritmofit-db";

interface LinkGoalDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userGoals: UserGoal[];
  routines: Routine[];
  routineKey: { typeCode: number; name: string | null } | null;
  onLinked: (updatedRoutineIds: string[], goalId: string) => void;
}

export function LinkGoalDrawer({
  open,
  onOpenChange,
  userGoals,
  routines,
  routineKey,
  onLinked,
}: LinkGoalDrawerProps) {
  const activeGoals = userGoals.filter((g) => g.perc < 100);

  const handleSelect = async (goal: UserGoal) => {
    if (!routineKey) return;
    try {
      const matchingRoutines = routines.filter(
        (r) =>
          r.type === routineKey.typeCode &&
          (routineKey.name ? r.name === routineKey.name : !r.name)
      );
      for (const r of matchingRoutines) {
        await updateRoutineGoalDb(r.id, String(goal.goal_id));
      }
      onLinked(matchingRoutines.map((r) => r.id), String(goal.goal_id));
      toast({ title: "Meta vinculada!", description: `"${goal.description}" vinculada à rotina.` });
      onOpenChange(false);
    } catch {
      toast({ title: "Erro ao vincular meta", variant: "destructive" });
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DrawerHeader className="shrink-0">
          <DrawerTitle>Vincular Meta</DrawerTitle>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3 pt-4">
          {activeGoals.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              Nenhuma meta ativa. Adicione uma meta primeiro.
            </div>
          ) : (
            activeGoals.map((goal) => (
              <button
                key={goal.id}
                className="w-full p-4 rounded-xl border border-border/60 hover:border-brand/50 hover:bg-brand/5 transition-all text-left space-y-2"
                onClick={() => handleSelect(goal)}
              >
                <p className="text-sm font-semibold">{goal.description}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                    <div className="bg-brand h-full rounded-full" style={{ width: `${goal.perc}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{Math.round(goal.perc)}%</span>
                </div>
              </button>
            ))
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
