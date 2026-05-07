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
import { supabase } from "@/lib/supabase";
import { Camera, X } from "lucide-react";
import { useKeyboardAwareHeight } from "@/hooks/use-keyboard-aware-height";

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
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const viewportHeight = useKeyboardAwareHeight();

  React.useEffect(() => {
    if (open) {
      setName(initialName);
      setDescription("");
      setMuscleGroup("");
      setPhotoFile(null);
      setPhotoPreview(null);
    }
  }, [open, initialName]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: "Nome obrigatório", description: "Informe o nome do exercício.", variant: "destructive" });
      return;
    }
    setIsCreating(true);
    try {
      let photoUrl: string | null = null;
      if (photoFile && supabase) {
        const ext = photoFile.name.split(".").pop() || "jpg";
        const filePath = `custom-workouts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("posts")
          .upload(filePath, photoFile, { contentType: photoFile.type, upsert: false });
        if (uploadError) {
          toast({ title: "Erro ao enviar foto", description: uploadError.message, variant: "destructive" });
          setIsCreating(false);
          return;
        }
        const { data: urlData } = supabase.storage.from("posts").getPublicUrl(filePath);
        photoUrl = urlData.publicUrl;
      }
      const newWorkout = await createCustomWorkoutDb(name.trim(), description.trim(), muscleGroup.trim(), photoUrl);
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
      <DrawerContent className="flex flex-col modal-enter" style={{ maxHeight: `min(80dvh, ${viewportHeight - 8}px)` }} onOpenAutoFocus={(e) => e.preventDefault()}>
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

            <div className="space-y-2">
              <Label>Foto do Exercício</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoChange}
              />
              {photoPreview ? (
                <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border/60">
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="absolute top-2 right-2 bg-black/60 rounded-full p-1"
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border/60 rounded-lg py-6 text-muted-foreground hover:border-primary/50 transition-colors"
                >
                  <Camera className="h-6 w-6" />
                  <span className="text-sm">Adicionar foto</span>
                </button>
              )}
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
