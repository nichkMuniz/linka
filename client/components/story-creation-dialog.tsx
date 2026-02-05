import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { Upload, X } from "lucide-react";

interface StoryCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateStory: (mediaUrl: string, description: string) => Promise<void>;
  isLoading?: boolean;
}

export function StoryCreationDialog({
  open,
  onOpenChange,
  onCreateStory,
  isLoading = false,
}: StoryCreationDialogProps) {
  const [mediaPreview, setMediaPreview] = React.useState<string | null>(null);
  const [description, setDescription] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "video/webm"];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Tipo de arquivo inválido",
        description: "Use imagens (JPG, PNG, GIF, WebP) ou vídeos (MP4, WebM)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "Máximo de 50MB",
        variant: "destructive",
      });
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setMediaPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!mediaPreview) {
      toast({
        title: "Erro",
        description: "Selecione uma mídia para sua story",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateStory(mediaPreview, description);
      // Reset form
      setMediaPreview(null);
      setDescription("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onOpenChange(false);
      toast({
        title: "Story criada!",
        description: "Sua story foi compartilhada com seus seguidores",
      });
    } catch (err: any) {
      toast({
        title: "Erro ao criar story",
        description: err?.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset state when closing
      setMediaPreview(null);
      setDescription("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar nova story</DialogTitle>
          <DialogDescription>
            Compartilhe um momento com seus seguidores
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Media Preview or Upload Area */}
          {mediaPreview ? (
            <div className="relative">
              {mediaPreview.includes("data:video") || mediaPreview.includes(".mp4") ? (
                <video
                  src={mediaPreview}
                  className="w-full rounded-lg max-h-64 object-contain bg-muted"
                />
              ) : (
                <img
                  src={mediaPreview}
                  alt="Preview"
                  className="w-full rounded-lg max-h-64 object-contain bg-muted"
                />
              )}
              <button
                onClick={() => {
                  setMediaPreview(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
                className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted transition-colors"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">Clique para selecionar mídia</p>
                <p className="text-xs text-muted-foreground">
                  Foto ou vídeo (máx. 50MB)
                </p>
              </div>
            </label>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Description */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Descrição (opcional)
            </label>
            <Textarea
              placeholder="Adicione uma descrição..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              className="resize-none h-20"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {description.length}/200 caracteres
            </p>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={!mediaPreview || isSubmitting || isLoading}
            className="w-full rounded-full"
          >
            {isSubmitting || isLoading ? "Enviando..." : "Compartilhar story"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
