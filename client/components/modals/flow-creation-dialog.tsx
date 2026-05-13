import * as React from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import {
  X,
  Image as ImageIcon,
  Check,
  SwitchCamera,
  Type,
  Camera as CameraIcon,
} from "lucide-react";
import { ImageCropperDrawer } from "@/components/shared/image-cropper-drawer";

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
  onCreateStory: (
    mediaUrl: string,
    description: string,
    backgroundColor?: string | null,
    textPosition?: { x: number; y: number } | null,
    textElements?: { text: string; x: number; y: number }[] | null,
  ) => Promise<void>;
  isLoading?: boolean;
}

type Step = "camera" | "preview" | "caption" | "create";

export function FlowCreationDialog({
  open,
  onOpenChange,
  onCreateStory,
  isLoading = false,
}: FlowCreationDialogProps) {
  const [step, setStep] = React.useState<Step>("camera");
  const [mediaPreview, setMediaPreview] = React.useState<string | null>(null);
  const [mediaIsVideo, setMediaIsVideo] = React.useState(false);
  const [description, setDescription] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [pendingCropSrc, setPendingCropSrc] = React.useState<string | null>(null);
  const [selectedGradient, setSelectedGradient] = React.useState(GRADIENT_PRESETS[0].value);
  const [facingMode, setFacingMode] = React.useState<"user" | "environment">("environment");
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [cameraReady, setCameraReady] = React.useState(false);

  type TextItem = { id: string; text: string; x: number; y: number };
  const [texts, setTexts] = React.useState<TextItem[]>([]);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingValue, setEditingValue] = React.useState("");
  const isEditingText = editingId !== null;

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const dragRef = React.useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);

  const stopStream = React.useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  const startStream = React.useCallback(async (mode: "user" | "environment") => {
    stopStream();
    setCameraError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Câmera não suportada neste dispositivo");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraReady(true);
    } catch (err: any) {
      setCameraError(
        err?.name === "NotAllowedError"
          ? "Permissão de câmera negada. Habilite em Ajustes."
          : err?.message || "Não foi possível acessar a câmera",
      );
    }
  }, [stopStream]);

  React.useEffect(() => {
    if (open && step === "camera") {
      startStream(facingMode);
    } else {
      stopStream();
    }
    return () => stopStream();
  }, [open, step, facingMode, startStream, stopStream]);

  React.useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      htmlOverflow: document.documentElement.style.overflow,
      touchAction: body.style.touchAction,
      overscroll: body.style.overscrollBehavior,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    body.style.touchAction = "none";
    body.style.overscrollBehavior = "none";
    document.documentElement.style.overflow = "hidden";

    const preventTouchMove = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest("[data-flow-dialog-root]")) {
        e.preventDefault();
      }
    };
    document.addEventListener("touchmove", preventTouchMove, { passive: false });

    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      body.style.touchAction = prev.touchAction;
      body.style.overscrollBehavior = prev.overscroll;
      document.documentElement.style.overflow = prev.htmlOverflow;
      document.removeEventListener("touchmove", preventTouchMove);
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  const handleFlipCamera = () => {
    setFacingMode((m) => (m === "user" ? "environment" : "user"));
  };

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !cameraReady) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setMediaIsVideo(false);
    setMediaPreview(dataUrl);
    setStep("caption");
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

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
      if (file.type.startsWith("video/")) {
        setMediaIsVideo(true);
        setMediaPreview(result);
        setStep("preview");
      } else {
        setMediaIsVideo(false);
        setPendingCropSrc(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCropConfirm = (dataUrl: string) => {
    setMediaIsVideo(false);
    setMediaPreview(dataUrl);
    setPendingCropSrc(null);
    setStep("preview");
  };

  const handleRetake = () => {
    setMediaPreview(null);
    setMediaIsVideo(false);
    setDescription("");
    setStep("camera");
  };

  const handleSubmitMedia = async () => {
    if (!mediaPreview) return;
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
    if (texts.length === 0) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos uma frase ao seu flow",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const elementsPercent = texts.map((t) => ({
        text: t.text,
        x: Math.round((t.x / window.innerWidth) * 1000) / 10,
        y: Math.round((t.y / window.innerHeight) * 1000) / 10,
      }));
      const joinedDescription = texts.map((t) => t.text).join("\n");
      await onCreateStory("", joinedDescription, selectedGradient, null, elementsPercent);
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
    setMediaIsVideo(false);
    setDescription("");
    setPendingCropSrc(null);
    setSelectedGradient(GRADIENT_PRESETS[0].value);
    setTexts([]);
    setEditingId(null);
    setEditingValue("");
    setStep("camera");
  };

  const beginNewText = () => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setEditingValue("");
    setEditingId(id);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const beginEditText = (item: TextItem) => {
    setEditingValue(item.text);
    setEditingId(item.id);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const commitEditing = () => {
    if (!editingId) return;
    const trimmed = editingValue.trim();
    setTexts((prev) => {
      const existing = prev.find((t) => t.id === editingId);
      if (!trimmed) {
        return existing ? prev.filter((t) => t.id !== editingId) : prev;
      }
      if (existing) {
        return prev.map((t) => (t.id === editingId ? { ...t, text: trimmed } : t));
      }
      return [
        ...prev,
        {
          id: editingId,
          text: trimmed,
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        },
      ];
    });
    setEditingId(null);
    setEditingValue("");
  };

  const handleTextPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    item: TextItem,
  ) => {
    e.stopPropagation();
    dragRef.current = {
      id: item.id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: item.x,
      origY: item.y,
      moved: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleTextPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) d.moved = true;
    if (d.moved) {
      const newX = Math.max(40, Math.min(window.innerWidth - 40, d.origX + dx));
      const newY = Math.max(80, Math.min(window.innerHeight - 80, d.origY + dy));
      setTexts((prev) =>
        prev.map((t) => (t.id === d.id ? { ...t, x: newX, y: newY } : t)),
      );
    }
  };

  const handleTextPointerUp = (
    e: React.PointerEvent<HTMLDivElement>,
    item: TextItem,
  ) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const wasTap = !d.moved;
    dragRef.current = null;
    if (wasTap) beginEditText(item);
  };

  const handleClose = () => {
    stopStream();
    resetForm();
    onOpenChange(false);
  };

  if (!open) return null;

  const overlay = (
    <>
      <div
        data-flow-dialog-root
        className="fixed inset-0 z-[100] bg-black flex flex-col overflow-hidden"
        style={{ height: "100dvh", width: "100vw" }}
        role="dialog"
        aria-modal="true"
        aria-label="Criar novo flow"
      >
        {/* Camera step */}
        {step === "camera" && (
          <>
            <div className="absolute inset-0">
              {cameraError ? (
                <div className="h-full w-full flex flex-col items-center justify-center text-white text-center px-6 gap-4">
                  <CameraIcon className="h-12 w-12 text-white/60" />
                  <p className="text-sm text-white/80 max-w-xs">{cameraError}</p>
                  <Button
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-full"
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Escolher da galeria
                  </Button>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                  style={{ transform: facingMode === "user" ? "scaleX(-1)" : undefined }}
                />
              )}
            </div>

            {/* Top bar */}
            <div
              className="relative z-10 flex items-center justify-between px-4 pt-2"
              style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
            >
              <button
                onClick={handleClose}
                className="h-10 w-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStep("create")}
                  className="h-10 px-3 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white text-sm font-semibold"
                  aria-label="Criar com texto"
                >
                  <Type className="h-4 w-4 mr-1" />
                  Aa
                </button>
                <button
                  onClick={handleFlipCamera}
                  className="h-10 w-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white"
                  aria-label="Trocar câmera"
                  disabled={!!cameraError}
                >
                  <SwitchCamera className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1" />

            {/* Bottom controls */}
            <div
              className="relative z-10 flex items-center justify-around px-6"
              style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
            >
              <button
                onClick={() => fileInputRef.current?.click()}
                className="h-12 w-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center text-white"
                aria-label="Galeria"
              >
                <ImageIcon className="h-6 w-6" />
              </button>

              <button
                onClick={handleCapture}
                disabled={!cameraReady}
                className="h-20 w-20 rounded-full bg-white/20 backdrop-blur flex items-center justify-center disabled:opacity-50"
                aria-label="Capturar"
              >
                <div className="h-16 w-16 rounded-full bg-white ring-4 ring-white/40" />
              </button>

              <div className="h-12 w-12" aria-hidden />
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </>
        )}

        {/* Text-only / gradient creation step */}
        {step === "create" && (
          <>
            {/* Background gradient */}
            <div className="absolute inset-0" style={{ background: selectedGradient }} />

            {/* Tap-anywhere catcher → opens a new text editor (only when not already editing) */}
            {!isEditingText && (
              <div
                className="absolute inset-0 z-[1]"
                onClick={() => {
                  if (texts.length === 0) {
                    beginNewText();
                  } else {
                    beginNewText();
                  }
                }}
              />
            )}

            {/* Committed text items (draggable, tappable to re-edit) */}
            {!isEditingText &&
              texts.map((item) => (
                <div
                  key={item.id}
                  className="absolute z-[5] select-none px-6 max-w-[90vw] touch-none"
                  style={{
                    left: item.x,
                    top: item.y,
                    transform: "translate(-50%, -50%)",
                    cursor: "move",
                  }}
                  onPointerDown={(e) => handleTextPointerDown(e, item)}
                  onPointerMove={handleTextPointerMove}
                  onPointerUp={(e) => handleTextPointerUp(e, item)}
                  onPointerCancel={(e) => handleTextPointerUp(e, item)}
                >
                  <p
                    className="text-white text-center font-bold text-3xl leading-tight break-words whitespace-pre-wrap"
                    style={{ textShadow: "0 1px 6px rgba(0,0,0,0.45)" }}
                  >
                    {item.text}
                  </p>
                </div>
              ))}

            {/* Hint when there is no text yet */}
            {!isEditingText && texts.length === 0 && (
              <div
                className="absolute inset-x-0 z-[2] flex items-center justify-center px-6 pointer-events-none"
                style={{ top: "50%", transform: "translateY(-50%)" }}
              >
                <p className="text-white/70 text-center font-semibold text-2xl">
                  Toque em qualquer lugar para digitar
                </p>
              </div>
            )}

            {/* Editing overlay */}
            {isEditingText && (
              <>
                {/* dim background while editing */}
                <div
                  className="absolute inset-0 z-[3] bg-black/30"
                  onClick={commitEditing}
                />
                <div
                  className="absolute inset-x-0 z-[5] flex items-center justify-center px-6 pointer-events-none"
                  style={{ top: "40%", transform: "translateY(-50%)" }}
                >
                  <textarea
                    ref={textareaRef}
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    maxLength={200}
                    placeholder="Digite aqui..."
                    className="w-full bg-transparent text-white text-center font-bold text-3xl leading-tight placeholder:text-white/60 resize-none outline-none border-0 pointer-events-auto"
                    style={{ textShadow: "0 1px 6px rgba(0,0,0,0.45)" }}
                    rows={3}
                    autoFocus
                  />
                </div>
              </>
            )}

            {/* Top bar */}
            <div
              className="relative z-[10] flex items-center justify-between px-4"
              style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
            >
              <button
                onClick={() => {
                  setStep("camera");
                  setTexts([]);
                  setEditingId(null);
                  setEditingValue("");
                }}
                className="h-10 w-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white"
                aria-label="Voltar"
              >
                <X className="h-5 w-5" />
              </button>
              {isEditingText ? (
                <button
                  onClick={commitEditing}
                  className="h-10 px-4 rounded-full bg-white text-black text-sm font-semibold"
                >
                  Pronto
                </button>
              ) : (
                <button
                  onClick={beginNewText}
                  className="h-10 px-3 rounded-full bg-black/40 backdrop-blur flex items-center text-white text-sm font-semibold gap-1"
                  aria-label="Adicionar texto"
                >
                  <Type className="h-4 w-4" />
                  + Aa
                </button>
              )}
            </div>

            <div className="flex-1" />

            {/* Bottom: gradient strip + share (hidden when keyboard up) */}
            {!isEditingText && (
              <div
                className="relative z-[10] px-4 space-y-3"
                style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
              >
                <div
                  className="flex gap-2 overflow-x-auto pb-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {GRADIENT_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setSelectedGradient(preset.value)}
                      className="relative shrink-0 h-10 w-10 rounded-full border-2 transition-all"
                      style={{
                        background: preset.value,
                        borderColor: selectedGradient === preset.value ? "white" : "rgba(255,255,255,0.4)",
                      }}
                      aria-label={preset.label}
                    >
                      {selectedGradient === preset.value && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Check className="h-4 w-4 text-white drop-shadow" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSubmitCreate();
                  }}
                  disabled={texts.length === 0 || isSubmitting || isLoading}
                  className="w-full rounded-full"
                >
                  {isSubmitting || isLoading ? "Enviando..." : "Compartilhar flow"}
                </Button>
              </div>
            )}
          </>
        )}

        {/* Preview step (after capture or gallery pick) */}
        {step === "preview" && mediaPreview && (
          <>
            <div className="absolute inset-0">
              {mediaIsVideo ? (
                <video src={mediaPreview} className="h-full w-full object-cover bg-black" autoPlay loop muted playsInline />
              ) : (
                <img src={mediaPreview} alt="Preview" className="h-full w-full object-cover bg-black" />
              )}
            </div>

            <div
              className="relative z-10 flex items-center justify-between px-4"
              style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
            >
              <button
                onClick={handleRetake}
                className="h-10 w-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white"
                aria-label="Refazer"
              >
                <X className="h-5 w-5" />
              </button>
              <button
                onClick={() => setStep("caption")}
                className="h-10 px-4 rounded-full bg-white text-black font-semibold text-sm"
              >
                Avançar
              </button>
            </div>

            <div className="flex-1" />
          </>
        )}

        {/* Caption step */}
        {step === "caption" && mediaPreview && (
          <>
            <div className="absolute inset-0">
              {mediaIsVideo ? (
                <video src={mediaPreview} className="h-full w-full object-cover bg-black" autoPlay loop muted playsInline />
              ) : (
                <img src={mediaPreview} alt="Preview" className="h-full w-full object-cover bg-black" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40" />
            </div>

            <div
              className="relative z-10 flex items-center justify-between px-4"
              style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
            >
              <button
                onClick={handleRetake}
                className="h-10 w-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white"
                aria-label="Refazer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1" />

            <div
              className="relative z-10 px-4 space-y-3"
              style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
            >
              <Textarea
                placeholder="Adicione uma descrição..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={200}
                className="resize-none h-20 bg-black/40 backdrop-blur border-white/20 text-white placeholder:text-white/60"
              />
              <Button
                onClick={handleSubmitMedia}
                disabled={isSubmitting || isLoading}
                className="w-full rounded-full"
              >
                {isSubmitting || isLoading ? "Enviando..." : "Compartilhar flow"}
              </Button>
            </div>
          </>
        )}
      </div>

      <ImageCropperDrawer
        imageSrc={pendingCropSrc}
        aspectRatio={9 / 16}
        onConfirm={handleCropConfirm}
        onCancel={() => setPendingCropSrc(null)}
      />
    </>
  );

  return typeof document !== "undefined"
    ? createPortal(overlay, document.body)
    : overlay;
}
