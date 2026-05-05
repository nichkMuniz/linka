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
import { CheckCircle2 } from "lucide-react";
import {
  updateUserGoalDb,
  deleteUserGoalDb,
  getUserGoalsDb,
  getUserSelectedGoalIdsDb,
  type UserGoal,
} from "@/lib/ritmofit-db";
import { useLanguage } from "@/lib/language-context";

interface EditGoalDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: UserGoal | null;
  onGoalUpdated: (updatedGoals: UserGoal[], selectedIds: string[]) => void;
  onGoalDeleted: (deletedGoalId: string, deletedGoalRowId: string) => void;
  onGoalCompleted?: (description: string) => void;
}

export function EditGoalDrawer({
  open,
  onOpenChange,
  goal,
  onGoalUpdated,
  onGoalDeleted,
  onGoalCompleted,
}: EditGoalDrawerProps) {
  const { t } = useLanguage();
  const [duration, setDuration] = React.useState(0);
  const [quantity, setQuantity] = React.useState(0);
  const [visibility, setVisibility] = React.useState<number>(1);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [showCompleteLabel, setShowCompleteLabel] = React.useState(false);

  React.useEffect(() => {
    if (goal) {
      setDuration(goal.duration ?? 0);
      setQuantity(goal.quantity ?? 0);
      setVisibility(goal.visibility ?? 1);
    }
  }, [goal]);

  React.useEffect(() => {
    if (!open) return;
    setShowCompleteLabel(true);
    const timer = setTimeout(() => setShowCompleteLabel(false), 3000);
    return () => clearTimeout(timer);
  }, [open]);

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

  const handleMarkComplete = async () => {
    if (!goal) return;
    if (!confirm(t("goals_mark_complete_confirm"))) return;
    setIsUpdating(true);
    try {
      await updateUserGoalDb(goal.id, {
        duration,
        quantity,
        days_completed: duration,
        perc: 100,
        visibility,
      });
      const [freshUserGoals, freshSelectedIds] = await Promise.all([
        getUserGoalsDb(),
        getUserSelectedGoalIdsDb(),
      ]);
      onGoalUpdated(freshUserGoals, freshSelectedIds);
      onOpenChange(false);
      onGoalCompleted?.(goal.description ?? "");
    } catch (err: any) {
      toast({ title: t("goals_mark_complete_error"), description: err?.message || "Tente novamente.", variant: "destructive" });
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
      <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DrawerHeader className="shrink-0">
          <DrawerTitle>Editar Meta</DrawerTitle>
        </DrawerHeader>

        {goal && (
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <div className="space-y-4">
              <div className="p-4 bg-muted/20 rounded-lg flex items-start justify-between gap-3">
                <p className="text-sm font-medium flex-1">{goal.description}</p>
                {(goal.perc ?? 0) < 100 && (
                  <button
                    onClick={handleMarkComplete}
                    disabled={isUpdating}
                    className="flex items-center gap-1 shrink-0 text-xs text-muted-foreground/60 hover:text-emerald-500 transition-colors disabled:opacity-30 disabled:pointer-events-none mt-0.5"
                  >
                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                    <span
                      className="overflow-hidden transition-all duration-500 ease-in-out whitespace-nowrap"
                      style={{ maxWidth: showCompleteLabel ? "200px" : "0px", opacity: showCompleteLabel ? 1 : 0 }}
                    >
                      {t("goals_mark_complete")}
                    </span>
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Duração (dias)</label>
                <input
                  type="number"
                  value={duration === 0 ? "" : duration}
                  onChange={(e) => {
                    const val = e.target.value === "" ? 0 : parseInt(e.target.value) || 0;
                    setDuration(val);
                    if (val > 0 && quantity > val) setQuantity(val);
                  }}
                  onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 300)}
                  placeholder="Digite a duração"
                  className="w-full h-10 px-3 border border-border/60 rounded-lg text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Frequência (dias)</label>
                <input
                  type="number"
                  value={quantity === 0 ? "" : quantity}
                  onChange={(e) => {
                    const val = e.target.value === "" ? 0 : parseInt(e.target.value) || 0;
                    setQuantity(duration > 0 ? Math.min(val, duration) : val);
                  }}
                  onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 300)}
                  placeholder="Digite a quantidade"
                  max={duration > 0 ? duration : undefined}
                  className="w-full h-10 px-3 border border-border/60 rounded-lg text-sm"
                />
                {duration > 0 && quantity > duration && (
                  <p className="text-xs text-destructive">A frequência não pode ser maior que a duração ({duration} dias).</p>
                )}
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
                  disabled={isUpdating || duration === 0 || quantity === 0 || quantity > duration}
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
