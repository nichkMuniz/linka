import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { Upload, X, Image, Type, Check } from "lucide-react";
import { ImageCropperDrawer } from "@/components/shared/image-cropper-drawer";
import { useKeyboardAwareHeight } from "@/hooks/use-keyboard-aware-height";

const GRADIENT_PRESETS = [
  { id: "pink-orange", value: "linear-gradient(135deg, #FF0080 0%, #FF8A2A 100%)", label: "Rosa" },
  { id: "blue-purple", value: "linear-gradient(135deg, #3A8DFF 0%, #7B3FF2 100%)", label: "Azul" },
  { id: "green-teal", value: "linear-gradient(135deg, #00C853 0%, #00BCD4 100%)", label: "Verde" },
  { id: "purple-pink", value: "linear-gradient(135deg, #7B3FF2 0%, #FF0080 100%)", label: "Roxo" },
  { id: "orange-yellow", value: "linear-gradient(135deg, #FF8A2A 0%, #FFD600 100%)", label: "Laranja" },
  { id: "dark-blue", value: "linear-gradient(135deg, #0D1B2A 0%, #1A3A5C 100%)", label: "Noite" },
  { id: "brand", value: "linear-gradient(135deg, #3A8DFF 0%, #7B3FF2 50%, #FF8A2A 100%)", label: "Marca" },
  { id: "sunset", value: "linear-gradient(135deg, #FF512F 0%, #F09819 100%)", label: "Pôr do sol" },
  { id: "ocean", value: "linear-gradient(135deg, #1A237E 0%, #00BCD4 100%)", label: "Oceano" },
  { id: "forest", value: "linear-gradient(135deg, #1B5E20 0%, #66BB6A 100%)", label: "Floresta" },
];

interface FlowCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateStory: (mediaUrl: string, description: string, backgroundColor?: string | null) => Promise<void>;
  isLoading?: boolean;
}

export function FlowCreationDialog({
  open,
  onOpenChange,
  onCreateStory,
  isLoading = false,
}: FlowCreationDialogProps) {
  const [mode, setMode] = React.useState<"media" | "create">("media");
  const [mediaPreview, setMediaPreview] = React.useState<string | null>(null);
  const [description, setDescription] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [pendingCropSrc, setPendingCropSrc] = React.useState<string | null>(null);
  const [selectedGradient, setSelectedGradient] = React.useState(GRADIENT_PRESETS[0].value);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const viewportHeight = useKeyboardAwareHeight();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "video/mov",
      "video/x-m4v",
    ];
    if (!validTypes.includes(file.type) && !file.type.startsWith("video/")) {
      toast({
        title: "Tipo de arquivo inválido",
        description: "Use imagens (JPG, PNG, GIF, WebP) ou vídeos (MP4, MOV, WebM)",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "Máximo de 50MB",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (file.type.startsWith("image/")) {
        setPendingCropSrc(result);
      } else {
        setMediaPreview(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitMedia = async () => {
    if (!mediaPreview) {
      toast({
        title: "Erro",
        description: "Selecione uma mídia para seu flow",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateStory(mediaPreview, description, null);
      resetForm();
      onOpenChange(false);
      toast({
        title: "Flow criado!",
        description: "Seu flow foi compartilhado com seus seguidores",
      });
    } catch (err: any) {
      toast({
        title: "Erro ao criar flow",
        description: err?.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitCreate = async () => {
    if (!description.trim()) {
      toast({
        title: "Erro",
        description: "Adicione uma legenda para seu flow",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateStory("", description, selectedGradient);
      resetForm();
      onOpenChange(false);
      toast({
        title: "Flow criado!",
        description: "Seu flow foi compartilhado com seus seguidores",
      });
    } catch (err: any) {
      toast({
        title: "Erro ao criar flow",
        description: err?.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setMediaPreview(null);
    setDescription("");
    setPendingCropSrc(null);
    setMode("media");
    setSelectedGradient(GRADIENT_PRESETS[0].value);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) resetForm();
    onOpenChange(newOpen);
  };

  return (
    <>
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent
        className="flex flex-col"
        style={{ maxHeight: Math.min(viewportHeight * 0.9, viewportHeight - 60) }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DrawerHeader className="text-center pb-2">
          <DrawerTitle>Criar novo flow</DrawerTitle>
          <DrawerDescription>
            Compartilhe um momento com seus seguidores
          </DrawerDescription>
        </DrawerHeader>

        {/* Mode toggle */}
        <div className="flex gap-2 px-4 pb-3">
          <button
            onClick={() => setMode("media")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-all ${
              mode === "media"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <Image className="h-4 w-4" />
            Mídia
          </button>
          <button
            onClick={() => setMode("create")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-all ${
              mode === "create"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <Type className="h-4 w-4" />
            Criar
          </button>
        </div>

        <div
          className="flex-1 overflow-y-auto overscroll-contain px-4"
          style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {mode === "media" ? (
            <div className="space-y-4">
              {/* Media Preview */}
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
                      if (fileInputRef.current) fileInputRef.current.value = "";
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
                    <p className="text-xs text-muted-foreground">Foto ou vídeo (máx. 50MB)</p>
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
              <canvas ref={canvasRef} className="hidden" />

              <div>
                <label className="text-sm font-medium mb-2 block">Descrição (opcional)</label>
                <Textarea
                  placeholder="Adicione uma descrição..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={200}
                  className="resize-none h-20"
                />
                <p className="text-xs text-muted-foreground mt-1">{description.length}/200 caracteres</p>
              </div>

              <Button
                onClick={handleSubmitMedia}
                disabled={!mediaPreview || isSubmitting || isLoading}
                className="w-full rounded-full"
              >
                {isSubmitting || isLoading ? "Enviando..." : "Compartilhar flow"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Live preview */}
              <div
                className="w-full aspect-[9/16] rounded-2xl flex items-center justify-center p-6 relative overflow-hidden"
                style={{ background: selectedGradient }}
              >
                <p
                  className="text-white text-center font-semibold text-lg leading-snug break-words"
                  style={{ textShadow: "0 1px 4px rgba(0,0,0,0.4)", maxWidth: "100%" }}
                >
                  {description.trim() || "Sua legenda aparece aqui..."}
                </p>
              </div>

              {/* Gradient presets */}
              <div>
                <label className="text-sm font-medium mb-2 block">Fundo</label>
                <div className="grid grid-cols-5 gap-2">
                  {GRADIENT_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setSelectedGradient(preset.value)}
                      className="relative aspect-square rounded-xl overflow-hidden border-2 transition-all"
                      style={{
                        background: preset.value,
                        borderColor: selectedGradient === preset.value ? "white" : "transparent",
                        boxShadow: selectedGradient === preset.value ? "0 0 0 2px hsl(var(--primary))" : undefined,
                      }}
                      title={preset.label}
                    >
                      {selectedGradient === preset.value && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Check className="h-4 w-4 text-white drop-shadow" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Caption */}
              <div>
                <label className="text-sm font-medium mb-2 block">Legenda</label>
                <Textarea
                  placeholder="O que você quer compartilhar?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={200}
                  className="resize-none h-24"
                />
                <p className="text-xs text-muted-foreground mt-1">{description.length}/200 caracteres</p>
              </div>

              <Button
                onClick={handleSubmitCreate}
                disabled={!description.trim() || isSubmitting || isLoading}
                className="w-full rounded-full"
              >
                {isSubmitting || isLoading ? "Enviando..." : "Compartilhar flow"}
              </Button>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>

    <ImageCropperDrawer
      imageSrc={pendingCropSrc}
      aspectRatio={9 / 16}
      onConfirm={(dataUrl) => {
        setMediaPreview(dataUrl);
        setPendingCropSrc(null);
      }}
      onCancel={() => {
        setPendingCropSrc(null);
      }}
    />
    </>
  );
}
