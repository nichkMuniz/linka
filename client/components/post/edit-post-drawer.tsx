import * as React from "react";
import { Target, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { updatePostDb, getUserGoalsDb, removePostPhotoDb } from "@/lib/ritmofit-db";
import { ImageWithFallback } from "@/components/shared/image-with-fallback";
import { useKeyboardAwareHeight } from "@/hooks/use-keyboard-aware-height";

interface EditPostTarget {
  id: string;
  description?: string | null;
  user_goal_id?: string | null;
  photo?: string | null;
  photos?: string[] | null;
}

interface EditPostDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: EditPostTarget | null;
  onSaved: (newDescription?: string) => void;
}

export function EditPostDrawer({ open, onOpenChange, post, onSaved }: EditPostDrawerProps) {
  const [description, setDescription] = React.useState("");
  const [goalId, setGoalId] = React.useState<string | null>(null);
  const viewportHeight = useKeyboardAwareHeight();
  const [userGoals, setUserGoals] = React.useState<Array<{ id: string; description: string }>>([]);
  const [isLoadingGoals, setIsLoadingGoals] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [photoIndex, setPhotoIndex] = React.useState(0);
  const [removingPhoto, setRemovingPhoto] = React.useState(false);

  React.useEffect(() => {
    if (open && post) {
      setDescription(post.description || "");
      setGoalId(post.user_goal_id || null);
      setPhotoIndex(0);

      const allPhotos = Array.isArray(post.photos) && post.photos.length > 0
        ? post.photos
        : post.photo ? [post.photo] : [];
      setPhotos(allPhotos);

      setIsLoadingGoals(true);
      getUserGoalsDb()
        .then((goals) => setUserGoals(goals.map((g) => ({ id: g.id, description: g.description }))))
        .catch(() => setUserGoals([]))
        .finally(() => setIsLoadingGoals(false));
    }
  }, [open, post]);

  const handleSave = async () => {
    if (!post) return;
    setIsSaving(true);
    try {
      await updatePostDb(post.id, description, goalId);
      toast({ title: "Post atualizado!" });
      onOpenChange(false);
      onSaved(description);
    } catch (err: any) {
      toast({ title: "Erro ao editar post", description: err?.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!post || photos.length <= 1) return;
    const photoToRemove = photos[photoIndex];
    setRemovingPhoto(true);
    try {
      const updated = await removePostPhotoDb(post.id, photoToRemove);
      setPhotos(updated);
      setPhotoIndex((prev) => Math.min(prev, updated.length - 1));
      toast({ title: "Foto removida!" });
      onSaved();
    } catch (err: any) {
      toast({ title: "Erro ao remover foto", description: err?.message, variant: "destructive" });
    } finally {
      setRemovingPhoto(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={(v) => { if (!v) onOpenChange(false); }} fixed>
      <DrawerContent
        handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
        className="flex flex-col !rounded-t-[32px] !border-0"
        style={{
          maxHeight: `min(85dvh, ${viewportHeight - 8}px)`,
          background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderTop: "1px solid rgba(255,255,255,.14)",
        }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DrawerHeader>
          <DrawerTitle style={{ color: "#fff" }}>Editar post</DrawerTitle>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">

          {photos.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium" style={{ color: "rgba(255,255,255,.7)" }}>Fotos do post</label>
              <div className="relative rounded-xl overflow-hidden bg-black/40 aspect-square">
                <ImageWithFallback
                  src={photos[photoIndex]}
                  alt={`Foto ${photoIndex + 1}`}
                  className="w-full h-full object-cover"
                />

                {photos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setPhotoIndex((i) => Math.max(0, i - 1))}
                      disabled={photoIndex === 0}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 rounded-full p-1 disabled:opacity-30"
                    >
                      <ChevronLeft className="h-4 w-4 text-white" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhotoIndex((i) => Math.min(photos.length - 1, i + 1))}
                      disabled={photoIndex === photos.length - 1}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 rounded-full p-1 disabled:opacity-30"
                    >
                      <ChevronRight className="h-4 w-4 text-white" />
                    </button>

                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                      {photoIndex + 1} / {photos.length}
                    </div>

                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      disabled={removingPhoto}
                      className="absolute top-2 right-2 bg-destructive/90 hover:bg-destructive text-white rounded-full p-1.5 transition-colors"
                      title="Remover esta foto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
              {photos.length <= 1 && (
                <p className="text-xs" style={{ color: "rgba(255,255,255,.4)" }}>
                  O post tem apenas uma foto e não pode ser removida.
                </p>
              )}
            </div>
          )}

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição do post..."
            rows={4}
            className="w-full px-3 py-2 rounded-2xl text-sm resize-none focus:outline-none"
            style={{
              background: "rgba(255,255,255,.07)",
              border: "1px solid rgba(255,255,255,.12)",
              color: "#fff",
            }}
          />

          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "rgba(255,255,255,.7)" }}>
              <Target className="h-4 w-4" style={{ color: "#5b8cff" }} />
              Meta vinculada
            </label>
            {isLoadingGoals ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-10 rounded-lg bg-white/10 animate-pulse" />
                ))}
              </div>
            ) : userGoals.length === 0 ? (
              <div className="text-xs" style={{ color: "rgba(255,255,255,.4)" }}>Nenhuma meta ativa encontrada.</div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setGoalId(null)}
                  className="w-full text-left px-3 py-2.5 rounded-2xl text-sm transition-colors"
                  style={!goalId
                    ? { border: "1px solid rgba(91,140,255,.5)", background: "rgba(91,140,255,.15)", color: "#5b8cff", fontWeight: 500 }
                    : { border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.5)" }
                  }
                >
                  Sem meta vinculada
                </button>
                {userGoals.map((goal) => (
                  <button
                    key={goal.id}
                    type="button"
                    onClick={() => setGoalId(goal.id)}
                    className="w-full text-left px-3 py-2.5 rounded-2xl text-sm transition-colors"
                    style={goalId === goal.id
                      ? { border: "1px solid rgba(91,140,255,.5)", background: "rgba(91,140,255,.15)", color: "#5b8cff", fontWeight: 500 }
                      : { border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.7)" }
                    }
                  >
                    <div className="flex items-center gap-2">
                      <Target className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{goal.description}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full rounded-full border-0"
            style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
          >
            {isSaving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
