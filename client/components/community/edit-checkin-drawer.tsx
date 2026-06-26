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
import { X, Plus, ChevronLeft, ChevronRight, Image } from "lucide-react";
import { updateGroupCheckInDb, uploadCheckInPhotoDb, type GroupCheckIn } from "@/lib/ritmofit-db";
import { useKeyboardAwareHeight } from "@/hooks/use-keyboard-aware-height";

interface EditCheckInDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkIn: GroupCheckIn | null;
  onUpdated: (updated: Pick<GroupCheckIn, "id" | "workoutInfo" | "description" | "photo" | "photos">) => void;
}

export function EditCheckInDrawer({
  open,
  onOpenChange,
  checkIn,
  onUpdated,
}: EditCheckInDrawerProps) {
  const [workoutInfo, setWorkoutInfo] = React.useState("");
  const [description, setDescription] = React.useState("");
  // URLs das fotos já existentes que o usuário quer manter
  const [existingPhotos, setExistingPhotos] = React.useState<string[]>([]);
  // Novos arquivos que o usuário quer adicionar
  const [newPhotoFiles, setNewPhotoFiles] = React.useState<File[]>([]);
  const [newPhotoPreviewUrls, setNewPhotoPreviewUrls] = React.useState<string[]>([]);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [isSaving, setIsSaving] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const viewportHeight = useKeyboardAwareHeight();

  React.useEffect(() => {
    if (open && checkIn) {
      setWorkoutInfo(checkIn.workoutInfo);
      setDescription(checkIn.description);
      const photos = checkIn.photos && checkIn.photos.length > 0
        ? checkIn.photos
        : (checkIn.photo ? [checkIn.photo] : []);
      setExistingPhotos(photos.filter(Boolean));
      setNewPhotoFiles([]);
      setNewPhotoPreviewUrls([]);
      setActiveIndex(0);
    }
  }, [open, checkIn]);

  React.useEffect(() => {
    const urls = newPhotoFiles.map((f) => URL.createObjectURL(f));
    setNewPhotoPreviewUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [newPhotoFiles]);

  const allPreviewUrls = [...existingPhotos, ...newPhotoPreviewUrls];
  const totalCount = allPreviewUrls.length;
  const MAX_PHOTOS = 4;

  const handleAddPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const available = MAX_PHOTOS - existingPhotos.length - newPhotoFiles.length;
    const toAdd = files.slice(0, available);
    setNewPhotoFiles((prev) => [...prev, ...toAdd]);
    setActiveIndex(existingPhotos.length + newPhotoFiles.length + toAdd.length - 1);
    e.target.value = "";
  };

  const handleRemovePhoto = (index: number) => {
    if (index < existingPhotos.length) {
      setExistingPhotos((prev) => prev.filter((_, i) => i !== index));
    } else {
      const newIdx = index - existingPhotos.length;
      setNewPhotoFiles((prev) => prev.filter((_, i) => i !== newIdx));
    }
    setActiveIndex((prev) => Math.max(0, prev - 1));
  };

  const handleSave = async () => {
    if (!checkIn) return;
    if (!workoutInfo.trim()) {
      toast({ title: "Campo obrigatório", description: "Preencha o campo de exercício", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < newPhotoFiles.length; i++) {
        const url = await uploadCheckInPhotoDb(checkIn.userId, newPhotoFiles[i], i);
        uploadedUrls.push(url);
      }
      const finalPhotos = [...existingPhotos, ...uploadedUrls];
      const finalPhoto = finalPhotos[0] || "";

      const updated = await updateGroupCheckInDb(
        checkIn.id,
        workoutInfo,
        description,
        finalPhoto,
        finalPhotos,
      );

      onUpdated({
        id: updated.id,
        workoutInfo: updated.workoutInfo,
        description: updated.description,
        photo: updated.photo,
        photos: updated.photos,
      });
      onOpenChange(false);
      toast({ title: "Check-in atualizado!", description: "Suas alterações foram salvas com sucesso." });
    } catch (error: any) {
      toast({ title: "Erro ao atualizar check-in", description: error.message || "Tente novamente", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
        className="flex flex-col z-[100] !rounded-t-[32px] !border-0"
        style={{
          maxHeight: `min(90dvh, ${viewportHeight - 8}px)`,
          background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderTop: "1px solid rgba(255,255,255,.14)",
        }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DrawerHeader className="shrink-0">
          <DrawerTitle style={{ color: "#fff" }}>Editar Check-in</DrawerTitle>
          <DrawerDescription className="sr-only">Edite as informações do seu check-in</DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {checkIn && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" style={{ color: "rgba(255,255,255,.7)" }}>Exercício *</label>
                <Input
                  value={workoutInfo}
                  onChange={(e) => setWorkoutInfo(e.target.value)}
                  placeholder="Ex: Supino Reto..."
                  style={{
                    background: "rgba(255,255,255,.07)",
                    border: "1px solid rgba(255,255,255,.12)",
                    color: "#fff",
                  }}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" style={{ color: "rgba(255,255,255,.7)" }}>Descrição</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Adicione detalhes sobre seu treino..."
                  className="min-h-24"
                  style={{
                    background: "rgba(255,255,255,.07)",
                    border: "1px solid rgba(255,255,255,.12)",
                    color: "#fff",
                  }}
                />
              </div>

              {/* Fotos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium" style={{ color: "rgba(255,255,255,.7)" }}>Fotos do Treino ({totalCount}/{MAX_PHOTOS})</label>
                  {totalCount < MAX_PHOTOS && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      style={{ color: "#5b8cff", background: "rgba(255,255,255,.08)" }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleAddPhotos}
                />

                {totalCount > 0 ? (
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
                    <img
                      src={allPreviewUrls[activeIndex]}
                      alt="foto do treino"
                      className="w-full h-full object-cover"
                    />
                    {/* Remove button */}
                    <button
                      className="absolute top-2 right-2 bg-black/60 rounded-full p-1"
                      onClick={() => handleRemovePhoto(activeIndex)}
                    >
                      <X className="h-4 w-4 text-white" />
                    </button>
                    {/* Navigation arrows */}
                    {totalCount > 1 && (
                      <>
                        <button
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 rounded-full p-1"
                          onClick={() => setActiveIndex((i) => (i - 1 + totalCount) % totalCount)}
                        >
                          <ChevronLeft className="h-4 w-4 text-white" />
                        </button>
                        <button
                          className="absolute right-8 top-1/2 -translate-y-1/2 bg-black/60 rounded-full p-1"
                          onClick={() => setActiveIndex((i) => (i + 1) % totalCount)}
                        >
                          <ChevronRight className="h-4 w-4 text-white" />
                        </button>
                      </>
                    )}
                    {/* Dots indicator */}
                    {totalCount > 1 && (
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                        {allPreviewUrls.map((_, i) => (
                          <button
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full transition-colors ${i === activeIndex ? "bg-white" : "bg-white/40"}`}
                            onClick={() => setActiveIndex(i)}
                          />
                        ))}
                      </div>
                    )}
                    {/* Thumbnails strip */}
                    {totalCount > 1 && (
                      <div className="absolute bottom-6 left-0 right-0 flex gap-1 px-2 mt-2 overflow-x-auto">
                        {allPreviewUrls.map((url, i) => (
                          <button
                            key={i}
                            onClick={() => setActiveIndex(i)}
                            className={`shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-colors ${i === activeIndex ? "border-brand" : "border-transparent"}`}
                          >
                            <img src={url} alt="" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors"
                    style={{ borderColor: "rgba(255,255,255,.2)", color: "rgba(255,255,255,.5)" }}
                  >
                    <Image className="h-8 w-8" />
                    <span className="text-sm">Adicionar foto</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-3 rounded-lg" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)" }}>
                  <div className="font-semibold text-lg" style={{ color: "#5b8cff" }}>{checkIn.series}</div>
                  <div className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>Séries</div>
                </div>
                <div className="text-center p-3 rounded-lg" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)" }}>
                  <div className="font-semibold text-lg" style={{ color: "#5b8cff" }}>{checkIn.volume}</div>
                  <div className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>Volume (kg)</div>
                </div>
                <div className="text-center p-3 rounded-lg" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)" }}>
                  <div className="font-semibold text-lg" style={{ color: "#5b8cff" }}>✓</div>
                  <div className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>Concluído</div>
                </div>
              </div>

              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full rounded-full border-0"
                style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
              >
                {isSaving ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
