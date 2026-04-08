import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { updateShotDb, type ShotWithUser } from "@/lib/ritmofit-db";

interface EditShotDescriptionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shot: ShotWithUser | null;
  onSaved: (shotId: string, newDescription: string) => void;
}

export function EditShotDescriptionDrawer({
  open,
  onOpenChange,
  shot,
  onSaved,
}: EditShotDescriptionDrawerProps) {
  const [description, setDescription] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (open && shot) {
      setDescription(shot.description || "");
    }
  }, [open, shot]);

  const handleSave = async () => {
    if (!shot) return;
    setIsSaving(true);
    try {
      const ok = await updateShotDb(shot.id, description);
      if (ok) {
        onSaved(shot.id, description);
        onOpenChange(false);
        toast({ title: "Clip atualizado!" });
      } else {
        toast({ title: "Erro ao salvar", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err?.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[80dvh] flex flex-col z-[100]" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DrawerHeader className="shrink-0">
          <DrawerTitle>Editar descrição</DrawerTitle>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição do clip..."
            className="min-h-28 resize-none"
          />
          <Button
            className="w-full rounded-full"
            disabled={isSaving}
            onClick={handleSave}
          >
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
