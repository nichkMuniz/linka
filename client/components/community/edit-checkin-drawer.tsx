import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { updateGroupCheckInDb, type GroupCheckIn } from "@/lib/ritmofit-db";

interface EditCheckInDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkIn: GroupCheckIn | null;
  onUpdated: (updated: Pick<GroupCheckIn, "id" | "workoutInfo" | "description">) => void;
}

export function EditCheckInDrawer({
  open,
  onOpenChange,
  checkIn,
  onUpdated,
}: EditCheckInDrawerProps) {
  const [workoutInfo, setWorkoutInfo] = React.useState("");
  const [description, setDescription] = React.useState("");

  React.useEffect(() => {
    if (open && checkIn) {
      setWorkoutInfo(checkIn.workoutInfo);
      setDescription(checkIn.description);
    }
  }, [open, checkIn]);

  const handleSave = async () => {
    if (!checkIn) return;
    if (!workoutInfo.trim()) {
      toast({ title: "Campo obrigatório", description: "Preencha o campo de exercício", variant: "destructive" });
      return;
    }
    try {
      await updateGroupCheckInDb(checkIn.id, workoutInfo, description);
      onUpdated({ id: checkIn.id, workoutInfo, description });
      onOpenChange(false);
      toast({ title: "Check-in atualizado!", description: "Suas alterações foram salvas com sucesso." });
    } catch (error: any) {
      toast({ title: "Erro ao atualizar check-in", description: error.message || "Tente novamente", variant: "destructive" });
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[80dvh] flex flex-col z-[100]" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DrawerHeader className="shrink-0">
          <DrawerTitle>Editar Check-in</DrawerTitle>
          <DrawerDescription className="sr-only">Edite as informações do seu check-in</DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {checkIn && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Exercício *</label>
                <Input
                  value={workoutInfo}
                  onChange={(e) => setWorkoutInfo(e.target.value)}
                  placeholder="Ex: Supino Reto..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Descrição</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Adicione detalhes sobre seu treino..."
                  className="min-h-24"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-3 rounded-lg bg-muted/20">
                  <div className="font-semibold text-brand text-lg">{checkIn.series}</div>
                  <div className="text-xs text-muted-foreground">Séries</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/20">
                  <div className="font-semibold text-brand text-lg">{checkIn.volume}</div>
                  <div className="text-xs text-muted-foreground">Volume (kg)</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/20">
                  <div className="font-semibold text-brand text-lg">✓</div>
                  <div className="text-xs text-muted-foreground">Concluído</div>
                </div>
              </div>

              <Button onClick={handleSave} className="w-full rounded-full">
                Salvar Alterações
              </Button>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
