import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Edit2, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { updateShotDb, deleteShotDb, type ShotWithUser } from "@/lib/ritmofit-db";
import { useKeyboardAwareHeight } from "@/hooks/use-keyboard-aware-height";

interface ShotEditorDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shot: ShotWithUser | null;
  onSaved: (updatedDescription: string) => void;
  onDeleted: (shotId: string) => void;
}

export function ShotEditorDrawer({
  open,
  onOpenChange,
  shot,
  onSaved,
  onDeleted,
}: ShotEditorDrawerProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [description, setDescription] = React.useState("");
  const viewportHeight = useKeyboardAwareHeight();
  const [isSaving, setIsSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    if (open && shot) {
      setDescription(shot.description || "");
      setIsEditing(false);
      setConfirmDelete(false);
    }
  }, [open, shot]);

  const handleSave = async () => {
    if (!shot) return;
    setIsSaving(true);
    try {
      const success = await updateShotDb(shot.id, description);
      if (success) {
        onSaved(description);
        onOpenChange(false);
        toast({ title: "Sucesso!", description: "Shot atualizado com sucesso." });
      } else {
        toast({ title: "Erro ao atualizar", description: "Tente novamente.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro ao atualizar", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!shot) return;
    setIsSaving(true);
    try {
      await deleteShotDb(shot.id);
      onDeleted(shot.id);
      onOpenChange(false);
      toast({ title: "Sucesso!", description: "Shot deletado com sucesso." });
    } catch (err: any) {
      toast({ title: "Erro ao deletar", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex flex-col modal-enter" style={{ maxHeight: `min(80dvh, ${viewportHeight - 8}px)` }} onOpenAutoFocus={(e) => e.preventDefault()}>
        <DrawerHeader className="shrink-0">
          <DrawerTitle>{isEditing ? "Editar Shot" : "Opções do Shot"}</DrawerTitle>
        </DrawerHeader>

        {shot && (
          <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
            <div className="relative aspect-square overflow-hidden rounded-lg bg-black border border-border/60">
              <video
                src={shot.video_url}
                className="w-full h-full object-cover"
                controls
              />
            </div>

            {isEditing ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">Descrição</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="resize-none"
                  rows={4}
                />
              </div>
            ) : (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Descrição</label>
                <p className="text-sm mt-1">{shot.description}</p>
              </div>
            )}

            {confirmDelete && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 space-y-3">
                <p className="text-sm text-destructive font-medium">Tem certeza que deseja deletar este shot?</p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)} disabled={isSaving}>
                    Cancelar
                  </Button>
                  <Button variant="destructive" className="flex-1" onClick={handleDelete} disabled={isSaving}>
                    {isSaving ? "Deletando..." : "Deletar"}
                  </Button>
                </div>
              </div>
            )}

            {!confirmDelete && (
              <div className="flex gap-2 pt-4">
                {!isEditing ? (
                  <>
                    <Button variant="outline" className="flex-1" onClick={() => setIsEditing(true)}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                    <Button variant="destructive" className="flex-1" onClick={() => setConfirmDelete(true)} disabled={isSaving}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Deletar
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => { setIsEditing(false); setDescription(shot.description || ""); }}
                      disabled={isSaving}
                    >
                      Cancelar
                    </Button>
                    <Button className="flex-1" onClick={handleSave} disabled={isSaving}>
                      {isSaving ? "Salvando..." : "Salvar"}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
