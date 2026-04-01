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
import { Upload, X, Camera, Image } from "lucide-react";

interface FlowCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateStory: (mediaUrl: string, description: string) => Promise<void>;
  isLoading?: boolean;
}

export function FlowCreationDialog({
  open,
  onOpenChange,
  onCreateStory,
  isLoading = false,
}: FlowCreationDialogProps) {
  const [mediaPreview, setMediaPreview] = React.useState<string | null>(null);
  const [description, setDescription] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [useCamera, setUseCamera] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [cameraStream, setCameraStream] = React.useState<MediaStream | null>(null);

  const startCamera = React.useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraStream(stream);
        setUseCamera(true);
      }
    } catch (err: any) {
      console.error("Error accessing camera:", err);
      toast({
        title: "Erro ao acessar câmera",
        description:
          "Verifique as permissões de câmera do navegador",
        variant: "destructive",
      });
    }
  }, []);

  const stopCamera = React.useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
      setUseCamera(false);
    }
  }, [cameraStream]);

  const capturePhoto = React.useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const context = canvasRef.current.getContext("2d");
    if (!context) return;

    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;

    context.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvasRef.current.toDataURL("image/jpeg");

    setMediaPreview(dataUrl);
    stopCamera();
  }, [stopCamera]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "video/mp4",
      "video/webm",
    ];
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
        description: "Selecione uma mídia para seu flow",
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

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset state when closing
      setMediaPreview(null);
      setDescription("");
      setUseCamera(false);
      stopCamera();
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } else {
      // Auto-start camera when opening drawer
      startCamera();
    }
    onOpenChange(newOpen);
  };

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="max-h-[80dvh] flex flex-col">
        <DrawerHeader className="text-center">
          <DrawerTitle>Criar novo flow</DrawerTitle>
          <DrawerDescription>
            Compartilhe um momento com seus seguidores
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <div className="space-y-4">
          {/* Media Preview or Camera Feed */}
          {mediaPreview ? (
            <div className="relative">
              {mediaPreview.includes("data:video") ||
              mediaPreview.includes(".mp4") ? (
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
                  setUseCamera(true);
                  startCamera();
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
                className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : useCamera ? (
            <div className="relative rounded-lg overflow-hidden bg-black w-full aspect-video">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
                <Button
                  onClick={capturePhoto}
                  className="rounded-full w-16 h-16 bg-white hover:bg-gray-200"
                  variant="ghost"
                >
                  <div className="w-12 h-12 rounded-full bg-white border-2 border-gray-300" />
                </Button>
              </div>
              <button
                onClick={() => {
                  stopCamera();
                  setUseCamera(false);
                }}
                className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  stopCamera();
                  setUseCamera(false);
                }}
                className="absolute top-2 left-2 bg-gray-500 hover:bg-gray-600 text-white rounded-full p-2 flex items-center gap-1"
              >
                <Image className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted transition-colors"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">
                  Clique para selecionar mídia
                </p>
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

          <canvas ref={canvasRef} className="hidden" />

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
              {isSubmitting || isLoading ? "Enviando..." : "Compartilhar flow"}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
