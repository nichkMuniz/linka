import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import {
  createCustomGoalAndSelectDb,
  getUserGoalsDb,
  type ProgrammedGoal,
  type UserGoal,
} from "@/lib/ritmofit-db";

const GOAL_TYPES = [
  { value: 1 as const, label: "Fitness", color: "bg-blue-500/10 text-blue-600 border-blue-300" },
  { value: 2 as const, label: "Saúde", color: "bg-emerald-500/10 text-emerald-600 border-emerald-300" },
  { value: 3 as const, label: "Hábitos", color: "bg-orange-500/10 text-orange-600 border-orange-300" },
];

interface CreateGoalDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onCreated: (data: {
    goalId: string;
    freshUserGoals: UserGoal[];
    newGoal: ProgrammedGoal;
  }) => void;
}

export function CreateGoalDrawer({
  open,
  onOpenChange,
  userId,
  onCreated,
}: CreateGoalDrawerProps) {
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState<1 | 2 | 3>(1);
  const [duration, setDuration] = React.useState(30);
  const [quantity, setQuantity] = React.useState(1);
  const [isCreating, setIsCreating] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setDescription("");
      setType(1);
      setDuration(30);
      setQuantity(1);
    }
  }, [open]);

  const handleCreate = async () => {
    if (!description.trim()) {
      toast({ title: "Descrição obrigatória", description: "Informe uma descrição para a meta.", variant: "destructive" });
      return;
    }
    setIsCreating(true);
    try {
      const goalId = await createCustomGoalAndSelectDb(userId, description.trim(), type, duration, quantity);
      const freshUserGoals = await getUserGoalsDb();
      onCreated({
        goalId,
        freshUserGoals,
        newGoal: {
          id: goalId,
          description: description.trim(),
          duration,
          quantity,
          type,
          created_by_user: 1,
        },
      });
      toast({ title: "Meta criada!", description: description.trim() });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao criar meta", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DrawerHeader className="shrink-0">
          <DrawerTitle>Criar Meta Personalizada</DrawerTitle>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input
                placeholder="Ex: Correr 5km por dia"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={120}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <div className="grid grid-cols-3 gap-2">
                {GOAL_TYPES.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    className={`rounded-lg border-2 px-3 py-2 text-xs font-semibold transition-all ${
                      type === opt.value
                        ? opt.color + " border-current"
                        : "border-border/60 text-muted-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duração (dias)</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={duration}
                  onChange={(e) => setDuration(Math.max(1, Number(e.target.value)))}
                />
              </div>
              <div className="space-y-2">
                <Label>Frequência (em dias)</Label>
                <Input
                  type="number"
                  min={1}
                  max={9999}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                />
              </div>
            </div>

            <Button
              onClick={handleCreate}
              disabled={isCreating || !description.trim()}
              className="w-full rounded-full"
            >
              {isCreating ? "Criando..." : "Criar e Selecionar Meta"}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
