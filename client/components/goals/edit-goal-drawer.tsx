import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import {
  updateUserGoalDb,
  deleteUserGoalDb,
  getUserGoalsDb,
  getUserSelectedGoalIdsDb,
  type UserGoal,
} from "@/lib/ritmofit-db";

interface EditGoalDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: UserGoal | null;
  onGoalUpdated: (updatedGoals: UserGoal[], selectedIds: string[]) => void;
  onGoalDeleted: (deletedGoalId: string, deletedGoalRowId: string) => void;
}

export function EditGoalDrawer({
  open,
  onOpenChange,
  goal,
  onGoalUpdated,
  onGoalDeleted,
}: EditGoalDrawerProps) {
  const [duration, setDuration] = React.useState(0);
  const [quantity, setQuantity] = React.useState(0);
  const [visibility, setVisibility] = React.useState<number>(1);
  const [isUpdating, setIsUpdating] = React.useState(false);

  React.useEffect(() => {
    if (goal) {
      setDuration(goal.duration ?? 0);
      setQuantity(goal.quantity ?? 0);
      setVisibility(goal.visibility ?? 1);
    }
  }, [goal]);

  const handleSave = async () => {
    if (!goal) return;
    setIsUpdating(true);
    try {
      const currentActualProgress = goal.days_completed ?? 0;
      const newPerc = duration > 0
        ? Math.min(100, Math.round((currentActualProgress / duration) * 100))
        : 0;

      await updateUserGoalDb(goal.id, {
        duration,
        quantity,
        days_completed: currentActualProgress,
        perc: newPerc,
        visibility,
      });

      const [freshUserGoals, freshSelectedIds] = await Promise.all([
        getUserGoalsDb(),
        getUserSelectedGoalIdsDb(),
      ]);
      onGoalUpdated(freshUserGoals, freshSelectedIds);

      toast({ title: "Meta atualizada!", description: "Suas alterações foram salvas." });
      onOpenChange(false);
    } catch (err: any) {
      const errorMsg = err?.message || "Tente novamente.";
      console.error("Error updating goal:", errorMsg);
      toast({ title: "Erro ao atualizar meta", description: errorMsg, variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!goal) return;
    if (!confirm("Tem certeza que deseja desistir desta meta? Esta ação não pode ser desfeita.")) return;
    setIsUpdating(true);
    try {
      await deleteUserGoalDb(goal.id);
      const updatedGoals = await getUserGoalsDb();
      onGoalDeleted(goal.goal_id, goal.id);
      // Also notify parent of updated goals list
      const freshSelectedIds = await getUserSelectedGoalIdsDb();
      onGoalUpdated(updatedGoals, freshSelectedIds);

      toast({ title: "Meta removida!", description: "Você desistiu da meta." });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao remover meta", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter">
        <DrawerHeader className="shrink-0">
          <DrawerTitle>Editar Meta</DrawerTitle>
        </DrawerHeader>

        {goal && (
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <div className="space-y-4">
              <div className="p-4 bg-muted/20 rounded-lg">
                <p className="text-sm font-medium">{goal.description}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Duração (dias)</label>
                <input
                  type="number"
                  value={duration === 0 ? "" : duration}
                  onChange={(e) => setDuration(e.target.value === "" ? 0 : parseInt(e.target.value) || 0)}
                  placeholder="Digite a duração"
                  className="w-full h-10 px-3 border border-border/60 rounded-lg text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Frequência (dias)</label>
                <input
                  type="number"
                  value={quantity === 0 ? "" : quantity}
                  onChange={(e) => setQuantity(e.target.value === "" ? 0 : parseInt(e.target.value) || 0)}
                  placeholder="Digite a quantidade"
                  className="w-full h-10 px-3 border border-border/60 rounded-lg text-sm"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/20 rounded-lg mb-2">
                <div className="space-y-0.5 pr-4">
                  <Label htmlFor="goal-visibility" className="text-sm font-medium">Deixar meta visível para outros</Label>
                  <p className="text-xs text-muted-foreground leading-relaxed">Se desativado, apenas você poderá ver esta meta em seu perfil.</p>
                </div>
                <Switch
                  id="goal-visibility"
                  checked={visibility === 1}
                  onCheckedChange={(checked) => setVisibility(checked ? 1 : 0)}
                />
              </div>

              <div className="space-y-2">
                <Button
                  onClick={handleSave}
                  disabled={isUpdating || duration === 0 || quantity === 0}
                  className="w-full rounded-full"
                >
                  {isUpdating ? "Atualizando..." : "Salvar Alterações"}
                </Button>

                <Button
                  onClick={handleDelete}
                  disabled={isUpdating}
                  variant="destructive"
                  className="w-full rounded-full"
                >
                  {isUpdating ? "Removendo..." : "Desistir da Meta"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
