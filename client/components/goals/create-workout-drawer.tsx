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
import { createCustomWorkoutDb, type Workout } from "@/lib/ritmofit-db";

interface CreateWorkoutDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  muscleGroups: string[];
  onCreated: (workout: Workout) => void;
  initialName?: string;
}

export function CreateWorkoutDrawer({
  open,
  onOpenChange,
  muscleGroups,
  onCreated,
  initialName = "",
}: CreateWorkoutDrawerProps) {
  const [name, setName] = React.useState(initialName);
  const [description, setDescription] = React.useState("");
  const [muscleGroup, setMuscleGroup] = React.useState("");
  const [isCreating, setIsCreating] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName(initialName);
      setDescription("");
      setMuscleGroup("");
    }
  }, [open, initialName]);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: "Nome obrigatório", description: "Informe o nome do exercício.", variant: "destructive" });
      return;
    }
    setIsCreating(true);
    try {
      const newWorkout = await createCustomWorkoutDb(name.trim(), description.trim(), muscleGroup.trim());
      onCreated(newWorkout);
      toast({ title: "Exercício criado!", description: name.trim() });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao criar exercício", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter">
        <DrawerHeader className="shrink-0">
          <DrawerTitle>Criar Exercício Personalizado</DrawerTitle>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Exercício *</Label>
              <Input
                placeholder="Ex: Agachamento livre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label>Grupo Muscular</Label>
              <select
                value={muscleGroup}
                onChange={(e) => setMuscleGroup(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-foreground text-sm"
              >
                <option value="">Selecione um grupo muscular</option>
                {muscleGroups.map((group) => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                placeholder="Como executar o exercício..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={200}
              />
            </div>

            <Button
              onClick={handleCreate}
              disabled={isCreating || !name.trim()}
              className="w-full rounded-full"
            >
              {isCreating ? "Criando..." : "Criar e Adicionar Exercício"}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
