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
  AlignLeft,
  AlignCenter,
  AlignRight,
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

const FONT_OPTIONS = [
  { id: "bold",  label: "Bold",  family: "system-ui, -apple-system, sans-serif", weight: 800 },
  { id: "light", label: "Light", family: "system-ui, -apple-system, sans-serif", weight: 300 },
  { id: "serif", label: "Serif", family: "Georgia, 'Times New Roman', serif",    weight: 700 },
  { id: "mono",  label: "Mono",  family: "'Courier New', Courier, monospace",    weight: 400 },
] as const;

const TEXT_COLORS = [
  "#ffffff", "#000000", "#FF0080", "#3A8DFF",
  "#FFD600", "#00C853", "#FF8A2A", "#7B3FF2",
];

type TextStyle = {
  fontFamily: string;
  fontWeight: number;
  align: "left" | "center" | "right";
  color: string;
};

const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: FONT_OPTIONS[0].family,
  fontWeight: FONT_OPTIONS[0].weight,
  align: "center",
  color: "#ffffff",
};

// Quanto tempo segurando o obturador até começar a gravar vídeo (toque rápido = foto)
const LONG_PRESS_MS = 400;
// Duração máxima de gravação do flow em vídeo
const MAX_RECORD_MS = 30000;

function pickVideoMimeType(): string {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return "";
  const candidates = [
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c;
    } catch {
      /* ignora */
    }
  }
  return "";
}

// Transformação aplicada à mídia na tela de compartilhar (estilo story do Instagram)
type MediaTransform = { scale: number; x: number; y: number };
const IDENTITY_TRANSFORM: MediaTransform = { scale: 1, x: 0, y: 0 };
const MIN_MEDIA_SCALE = 0.3;
const MAX_MEDIA_SCALE = 5;

function isMediaTransformed(t: MediaTransform): boolean {
  return Math.abs(t.scale - 1) > 0.01 || Math.abs(t.x) > 1 || Math.abs(t.y) > 1;
}

function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Retângulo equivalente ao object-cover: preenche (fw x fh) preservando o aspecto da imagem
function coverRect(iw: number, ih: number, fw: number, fh: number) {
  const ir = iw / ih;
  const fr = fw / fh;
  let dw: number, dh: number;
  if (ir > fr) {
    dh = fh;
    dw = fh * ir;
  } else {
    dw = fw;
    dh = fw / ir;
  }
  return { dx: (fw - dw) / 2, dy: (fh - dh) / 2, dw, dh };
}

// Compõe a imagem transformada num canvas (com fundo desfocado) para que o
// resultado compartilhado seja exatamente o que o usuário enxerga.
async function bakeTransformedImage(
  src: string,
  frameW: number,
  frameH: number,
  t: MediaTransform,
): Promise<string | null> {
  try {
    if (frameW <= 0 || frameH <= 0) return null;
    const img = await loadImageEl(src);
    const fr = frameW / frameH;
    const maxDim = 1280;
    let outW: number, outH: number;
    if (frameW >= frameH) {
      outW = maxDim;
      outH = Math.round(maxDim / fr);
    } else {
      outH = maxDim;
      outW = Math.round(maxDim * fr);
    }
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const sx = outW / frameW; // converte px da tela para px do canvas

    // Fundo desfocado (truque de downscale → upscale, funciona em qualquer WebView)
    const small = document.createElement("canvas");
    const smw = 28;
    const smh = Math.max(1, Math.round(28 / fr));
    small.width = smw;
    small.height = smh;
    const sctx = small.getContext("2d");
    if (sctx) {
      const bgc = coverRect(img.width, img.height, smw, smh);
      sctx.drawImage(img, bgc.dx, bgc.dy, bgc.dw, bgc.dh);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(small, 0, 0, smw, smh, 0, 0, outW, outH);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, 0, outW, outH);
    } else {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, outW, outH);
    }

    // Primeiro plano: mesma transformação do CSS (translate → scale em torno do centro)
    const cx = outW / 2;
    const cy = outH / 2;
    ctx.save();
    ctx.translate(cx + t.x * sx, cy + t.y * sx);
    ctx.scale(t.scale, t.scale);
    ctx.translate(-cx, -cy);
    const fc = coverRect(img.width, img.height, outW, outH);
    ctx.drawImage(img, fc.dx, fc.dy, fc.dw, fc.dh);
    ctx.restore();

    return canvas.toDataURL("image/jpeg", 0.92);
  } catch {
    return null;
  }
}

interface FlowCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateStory: (
    mediaUrl: string,
    description: string,
    backgroundColor?: string | null,
    textPosition?: { x: number; y: number } | null,
    textElements?: { text: string; x: number; y: number }[] | null,
    mediaTransform?: { scale: number; x: number; y: number } | null,
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
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordSeconds, setRecordSeconds] = React.useState(0);
  const [zoom, setZoom] = React.useState(1);
  const [mediaTransform, setMediaTransformState] = React.useState<MediaTransform>(IDENTITY_TRANSFORM);

  type TextItem = { id: string; text: string; x: number; y: number; style: TextStyle };
  const [texts, setTexts] = React.useState<TextItem[]>([]);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingValue, setEditingValue] = React.useState("");
  const [editingStyle, setEditingStyle] = React.useState<TextStyle>(DEFAULT_TEXT_STYLE);
  const isEditingText = editingId !== null;

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const audioStreamRef = React.useRef<MediaStream | null>(null);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const recordedChunksRef = React.useRef<Blob[]>([]);
  const holdTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxDurationTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordTickRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingActiveRef = React.useRef(false);
  // Verdadeiro enquanto o usuário mantém o obturador pressionado com intenção de gravar
  const wantRecordingRef = React.useRef(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  // Zoom da câmera: usa zoom nativo do sensor quando suportado; senão, zoom
  // digital via CSS (com recorte equivalente na captura de foto).
  const zoomRef = React.useRef(1);
  const nativeZoomRef = React.useRef<{ min: number; max: number; step: number } | null>(null);
  const pinchRef = React.useRef<{ startDist: number; startZoom: number } | null>(null);
  const MAX_DIGITAL_ZOOM = 5;
  const captionFrameRef = React.useRef<HTMLDivElement>(null);
  const transformRef = React.useRef<MediaTransform>(IDENTITY_TRANSFORM);
  const pointersRef = React.useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureStartRef = React.useRef<{
    scale: number;
    x: number;
    y: number;
    dist: number;
    midX: number;
    midY: number;
  } | null>(null);
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
    wantRecordingRef.current = false;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
    if (recordTickRef.current) {
      clearInterval(recordTickRef.current);
      recordTickRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        /* ignora */
      }
    }
    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];
    recordingActiveRef.current = false;
    setIsRecording(false);
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
    }
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
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      // Reseta o zoom e detecta suporte a zoom nativo do sensor (quando houver)
      zoomRef.current = 1;
      pinchRef.current = null;
      setZoom(1);
      nativeZoomRef.current = null;
      const track = stream.getVideoTracks()[0];
      const caps: any = track?.getCapabilities?.();
      if (caps && typeof caps.zoom === "object" && "max" in caps.zoom) {
        nativeZoomRef.current = {
          min: caps.zoom.min ?? 1,
          max: caps.zoom.max ?? 1,
          step: caps.zoom.step ?? 0.1,
        };
      }
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

  // Detecção de duplo toque na pré-visualização para virar a câmera
  const lastTapRef = React.useRef(0);
  const handlePreviewTap = () => {
    if (cameraError) return;
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0;
      handleFlipCamera();
    } else {
      lastTapRef.current = now;
    }
  };

  // Aplica o nível de zoom: usa o sensor (nativo) quando disponível, caso
  // contrário recorre ao zoom digital via CSS (refletido na captura de foto).
  const applyZoom = React.useCallback((value: number) => {
    const native = nativeZoomRef.current;
    if (native) {
      const clamped = Math.min(native.max, Math.max(native.min, value));
      zoomRef.current = clamped;
      setZoom(clamped);
      const track = streamRef.current?.getVideoTracks()[0];
      track?.applyConstraints({ advanced: [{ zoom: clamped } as any] }).catch(() => {});
    } else {
      const clamped = Math.min(MAX_DIGITAL_ZOOM, Math.max(1, value));
      zoomRef.current = clamped;
      setZoom(clamped);
    }
  }, []);

  const dist2 = (a: React.Touch, b: React.Touch) =>
    Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

  const handlePreviewTouchStart = (e: React.TouchEvent) => {
    if (cameraError || e.touches.length < 2) return;
    pinchRef.current = {
      startDist: dist2(e.touches[0], e.touches[1]),
      startZoom: zoomRef.current,
    };
  };

  const handlePreviewTouchMove = (e: React.TouchEvent) => {
    const pinch = pinchRef.current;
    if (!pinch || e.touches.length < 2) return;
    e.preventDefault();
    const ratio = dist2(e.touches[0], e.touches[1]) / pinch.startDist;
    applyZoom(pinch.startZoom * ratio);
  };

  const handlePreviewTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchRef.current = null;
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
    // Zoom digital (fallback sem suporte nativo): recorta a região central
    // equivalente ao nível de zoom para que a foto reflita a pré-visualização.
    const digitalZoom = !nativeZoomRef.current ? zoomRef.current : 1;
    if (digitalZoom > 1) {
      const sw = video.videoWidth / digitalZoom;
      const sh = video.videoHeight / digitalZoom;
      const sx = (video.videoWidth - sw) / 2;
      const sy = (video.videoHeight - sh) / 2;
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setMediaIsVideo(false);
    setMediaPreview(dataUrl);
    setStep("caption");
  };

  // Obtém (e reutiliza) um stream de áudio para gravar vídeo com som.
  // Falha graciosamente: se o microfone for negado, grava sem áudio.
  const ensureAudioStream = React.useCallback(async (): Promise<MediaStream | null> => {
    if (audioStreamRef.current && audioStreamRef.current.getAudioTracks().some((t) => t.readyState === "live")) {
      return audioStreamRef.current;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia) return null;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      audioStreamRef.current = stream;
      return stream;
    } catch {
      return null;
    }
  }, []);

  const clearRecordTimers = React.useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
    if (recordTickRef.current) {
      clearInterval(recordTickRef.current);
      recordTickRef.current = null;
    }
  }, []);

  const stopRecording = React.useCallback(() => {
    wantRecordingRef.current = false;
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
    if (recordTickRef.current) {
      clearInterval(recordTickRef.current);
      recordTickRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        /* ignora */
      }
    }
    recordingActiveRef.current = false;
    setIsRecording(false);
  }, []);

  const startRecording = React.useCallback(async () => {
    const video = videoRef.current;
    if (!video || !cameraReady || !streamRef.current) return;
    if (typeof MediaRecorder === "undefined") return;
    const videoTracks = streamRef.current.getVideoTracks();
    if (videoTracks.length === 0) return;

    // Pré-aquece o microfone (pode exibir prompt na primeira vez)
    const audioStream = await ensureAudioStream();
    // Usuário soltou o obturador antes da gravação iniciar de fato
    if (!wantRecordingRef.current) return;

    const combined = new MediaStream();
    videoTracks.forEach((t) => combined.addTrack(t));
    audioStream?.getAudioTracks().forEach((t) => combined.addTrack(t));

    const mimeType = pickVideoMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(combined, { mimeType })
        : new MediaRecorder(combined);
    } catch {
      try {
        recorder = new MediaRecorder(combined);
      } catch {
        return;
      }
    }

    recordedChunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const chunks = recordedChunksRef.current;
      recordedChunksRef.current = [];
      if (chunks.length === 0) return;
      const blobType = recorder.mimeType || mimeType || "video/mp4";
      const blob = new Blob(chunks, { type: blobType });
      if (blob.size > 50 * 1024 * 1024) {
        toast({
          title: "Vídeo muito longo",
          description: "Grave um vídeo mais curto (máximo de 50MB)",
          variant: "destructive",
        });
        return;
      }
      // Blob URL evita o problema de tela preta que data: URLs causam no WebView do iOS
      const blobUrl = URL.createObjectURL(blob);
      setMediaIsVideo(true);
      setMediaPreview(blobUrl);
      setStep("caption");
    };

    mediaRecorderRef.current = recorder;
    try {
      // Timeslice garante emissão periódica de dados (evita blob vazio em gravações curtas)
      recorder.start(100);
    } catch {
      return;
    }
    recordingActiveRef.current = true;
    setIsRecording(true);
    setRecordSeconds(0);
    recordTickRef.current = setInterval(() => {
      setRecordSeconds((s) => s + 1);
    }, 1000);
    maxDurationTimerRef.current = setTimeout(() => {
      stopRecording();
    }, MAX_RECORD_MS);

    // Caso o usuário tenha soltado o obturador enquanto o gravador iniciava
    if (!wantRecordingRef.current) {
      stopRecording();
    }
  }, [cameraReady, ensureAudioStream, stopRecording]);

  const handleShutterPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!cameraReady) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    wantRecordingRef.current = false;
    // Após o limite de tempo segurando, inicia a gravação de vídeo
    if (typeof MediaRecorder !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      holdTimerRef.current = setTimeout(() => {
        wantRecordingRef.current = true;
        startRecording();
      }, LONG_PRESS_MS);
    }
  };

  const handleShutterPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (recordingActiveRef.current) {
      // Estava gravando → finaliza o vídeo
      stopRecording();
    } else if (wantRecordingRef.current) {
      // Passou do limite mas o gravador ainda estava iniciando → aborta
      wantRecordingRef.current = false;
    } else {
      // Toque rápido → foto
      handleCapture();
    }
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

  const setMediaTransform = React.useCallback((t: MediaTransform) => {
    transformRef.current = t;
    setMediaTransformState(t);
  }, []);

  // Reseta o enquadramento sempre que uma nova mídia é carregada
  React.useEffect(() => {
    transformRef.current = IDENTITY_TRANSFORM;
    setMediaTransformState(IDENTITY_TRANSFORM);
    pointersRef.current.clear();
    gestureStartRef.current = null;
  }, [mediaPreview]);

  const beginMediaGesture = React.useCallback(() => {
    const pts = Array.from(pointersRef.current.values());
    const cur = transformRef.current;
    if (pts.length === 1) {
      gestureStartRef.current = {
        scale: cur.scale,
        x: cur.x,
        y: cur.y,
        dist: 0,
        midX: pts[0].x,
        midY: pts[0].y,
      };
    } else if (pts.length >= 2) {
      const [a, b] = pts;
      gestureStartRef.current = {
        scale: cur.scale,
        x: cur.x,
        y: cur.y,
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        midX: (a.x + b.x) / 2,
        midY: (a.y + b.y) / 2,
      };
    }
  }, []);

  const handleMediaPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    beginMediaGesture();
  };

  const handleMediaPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const start = gestureStartRef.current;
    if (!start) return;
    const pts = Array.from(pointersRef.current.values());
    if (pts.length === 1) {
      setMediaTransform({
        scale: start.scale,
        x: start.x + (pts[0].x - start.midX),
        y: start.y + (pts[0].y - start.midY),
      });
    } else if (pts.length >= 2) {
      const [a, b] = pts;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const ratio = start.dist ? dist / start.dist : 1;
      const scale = Math.min(MAX_MEDIA_SCALE, Math.max(MIN_MEDIA_SCALE, start.scale * ratio));
      setMediaTransform({
        scale,
        x: start.x + (mid.x - start.midX),
        y: start.y + (mid.y - start.midY),
      });
    }
  };

  const handleMediaPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.delete(e.pointerId);
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    }
    if (pointersRef.current.size > 0) {
      beginMediaGesture();
    } else {
      gestureStartRef.current = null;
    }
  };

  const handleRetake = () => {
    setMediaPreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    setMediaIsVideo(false);
    setDescription("");
    setTexts([]);
    setEditingId(null);
    setEditingValue("");
    setStep("camera");
  };

  const handleSubmitMedia = async () => {
    if (!mediaPreview) return;
    setIsSubmitting(true);
    try {
      let mediaToShare = mediaPreview;
      let mediaTransformPayload: MediaTransform | null = null;
      const t = transformRef.current;
      if (isMediaTransformed(t)) {
        const frame = captionFrameRef.current;
        const fw = frame?.clientWidth || window.innerWidth;
        const fh = frame?.clientHeight || window.innerHeight;
        // Enquadramento em % (translate relativo ao tamanho do elemento → resolução-independente)
        const percentTransform: MediaTransform = {
          scale: Math.round(t.scale * 1000) / 1000,
          x: Math.round((t.x / fw) * 1000) / 10,
          y: Math.round((t.y / fh) * 1000) / 10,
        };
        if (mediaIsVideo) {
          // Vídeo não pode ser recomposto no cliente → persiste o enquadramento
          mediaTransformPayload = percentTransform;
        } else {
          // Imagem: compõe num canvas (enquadramento "queimado" na imagem final)
          const baked = await bakeTransformedImage(mediaPreview, fw, fh, t);
          if (baked) {
            mediaToShare = baked;
          } else {
            // Fallback: se a composição falhar, mantém o original e persiste o enquadramento
            mediaTransformPayload = percentTransform;
          }
        }
      }
      // Frases posicionadas sobre a foto (renderizadas ao vivo no FlowViewer,
      // mantendo o texto nítido — não são "queimadas" na imagem)
      const elementsPercent =
        texts.length > 0
          ? texts.map((t) => ({
              text: t.text,
              x: Math.round((t.x / window.innerWidth) * 1000) / 10,
              y: Math.round((t.y / window.innerHeight) * 1000) / 10,
              style: t.style,
            }))
          : null;
      await onCreateStory(mediaToShare, description, null, null, elementsPercent, mediaTransformPayload);
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
        style: t.style,
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
    // Revoga blob URL de vídeo gravado para liberar memória
    setMediaPreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    setMediaIsVideo(false);
    setDescription("");
    setPendingCropSrc(null);
    setSelectedGradient(GRADIENT_PRESETS[0].value);
    setTexts([]);
    setEditingId(null);
    setEditingValue("");
    setEditingStyle(DEFAULT_TEXT_STYLE);
    setIsRecording(false);
    setRecordSeconds(0);
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
    setEditingStyle(item.style);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const commitEditing = () => {
    if (!editingId) return;
    const trimmed = editingValue.trim();
    const style = editingStyle;
    setTexts((prev) => {
      const existing = prev.find((t) => t.id === editingId);
      if (!trimmed) {
        return existing ? prev.filter((t) => t.id !== editingId) : prev;
      }
      if (existing) {
        return prev.map((t) => (t.id === editingId ? { ...t, text: trimmed, style } : t));
      }
      return [
        ...prev,
        {
          id: editingId,
          text: trimmed,
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
          style,
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
      const newX = d.origX + dx;
      const newY = d.origY + dy;
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

  // Controles de estilo de texto (cor, fonte, alinhamento) — compartilhados
  // entre o modo de texto ("create") e a legenda sobre a foto ("caption")
  const textStyleControls = (
    <>
      {/* Cores da fonte */}
      <div className="flex gap-2 justify-center">
        {TEXT_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => setEditingStyle((s) => ({ ...s, color }))}
            className="h-7 w-7 rounded-full border-2 shrink-0 transition-transform"
            style={{
              background: color,
              borderColor: editingStyle.color === color ? "white" : "rgba(255,255,255,0.25)",
              transform: editingStyle.color === color ? "scale(1.25)" : "scale(1)",
              boxShadow: color === "#ffffff" ? "inset 0 0 0 1px rgba(0,0,0,0.2)" : undefined,
            }}
            aria-label={`Cor ${color}`}
          />
        ))}
      </div>

      {/* Fontes */}
      <div className="flex gap-1.5 justify-center">
        {FONT_OPTIONS.map((font) => {
          const isActive = editingStyle.fontFamily === font.family && editingStyle.fontWeight === font.weight;
          return (
            <button
              key={font.id}
              onClick={() => setEditingStyle((s) => ({ ...s, fontFamily: font.family, fontWeight: font.weight }))}
              className="px-3 py-0.5 rounded-full text-sm transition-all"
              style={{
                fontFamily: font.family,
                fontWeight: font.weight,
                background: isActive ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.45)",
                color: isActive ? "#000" : "#fff",
              }}
            >
              {font.label}
            </button>
          );
        })}
      </div>

      {/* Alinhamento */}
      <div className="flex gap-2 justify-center">
        {(["left", "center", "right"] as const).map((align) => {
          const Icon = align === "left" ? AlignLeft : align === "center" ? AlignCenter : AlignRight;
          const isActive = editingStyle.align === align;
          return (
            <button
              key={align}
              onClick={() => setEditingStyle((s) => ({ ...s, align }))}
              className="h-8 w-8 rounded-full flex items-center justify-center transition-all"
              style={{ background: isActive ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.45)" }}
              aria-label={`Alinhar ${align}`}
            >
              <Icon className="h-4 w-4" style={{ color: isActive ? "#000" : "#fff" }} />
            </button>
          );
        })}
      </div>
    </>
  );

  // Frases já posicionadas (arrastáveis, toque para reeditar) — compartilhadas
  // entre o modo de texto e a legenda sobre a foto
  const committedTextItems = texts.map((item) => (
    <div
      key={item.id}
      className="absolute z-[6] select-none touch-none"
      style={{
        left: item.x,
        top: item.y,
        transform: "translate(-50%, -50%)",
        cursor: "move",
        width: "max-content",
        maxWidth: "80vw",
        padding: "0 0.5rem",
      }}
      onPointerDown={(e) => handleTextPointerDown(e, item)}
      onPointerMove={handleTextPointerMove}
      onPointerUp={(e) => handleTextPointerUp(e, item)}
      onPointerCancel={(e) => handleTextPointerUp(e, item)}
    >
      <p
        className="text-3xl leading-tight break-words whitespace-pre-wrap"
        style={{
          textShadow: "0 1px 6px rgba(0,0,0,0.45)",
          fontFamily: item.style.fontFamily,
          fontWeight: item.style.fontWeight,
          textAlign: item.style.align,
          color: item.style.color,
        }}
      >
        {item.text}
      </p>
    </div>
  ));

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
            <div
              className="absolute inset-0 touch-none"
              onClick={handlePreviewTap}
              onTouchStart={handlePreviewTouchStart}
              onTouchMove={handlePreviewTouchMove}
              onTouchEnd={handlePreviewTouchEnd}
              role="presentation"
            >
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
                  style={{
                    transform: `scaleX(${(facingMode === "user" ? -1 : 1) * (nativeZoomRef.current ? 1 : zoom)}) scaleY(${nativeZoomRef.current ? 1 : zoom})`,
                    transformOrigin: "center",
                  }}
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

            {/* Recording timer */}
            {isRecording && (
              <div className="relative z-10 flex items-center justify-center pb-3">
                <div className="flex items-center gap-2 rounded-full bg-red-500/90 backdrop-blur px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                  <span className="text-white text-sm font-semibold tabular-nums">
                    {Math.floor(recordSeconds / 60)}:
                    {String(recordSeconds % 60).padStart(2, "0")}
                  </span>
                </div>
              </div>
            )}

            {/* Zoom indicator */}
            {!cameraError && zoom > 1.05 && (
              <div className="relative z-10 flex items-center justify-center pb-3 pointer-events-none">
                <div className="rounded-full bg-black/40 backdrop-blur px-3 py-1">
                  <span className="text-white text-sm font-semibold tabular-nums">
                    {zoom.toFixed(1)}x
                  </span>
                </div>
              </div>
            )}

            <div className="flex-1" />

            {/* Hint */}
            {!isRecording && !cameraError && (
              <div className="relative z-10 flex items-center justify-center pb-3 px-6">
                <p className="text-white/70 text-xs text-center">
                  Toque para foto • Segure para gravar vídeo
                </p>
              </div>
            )}

            {/* Bottom controls */}
            <div
              className="relative z-10 flex items-center justify-around px-6"
              style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
            >
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`h-12 w-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center text-white transition-opacity ${
                  isRecording ? "opacity-0 pointer-events-none" : "opacity-100"
                }`}
                aria-label="Galeria"
                disabled={isRecording}
              >
                <ImageIcon className="h-6 w-6" />
              </button>

              <button
                onPointerDown={handleShutterPointerDown}
                onPointerUp={handleShutterPointerUp}
                onPointerCancel={handleShutterPointerUp}
                onContextMenu={(e) => e.preventDefault()}
                disabled={!cameraReady}
                className="h-20 w-20 rounded-full bg-white/20 backdrop-blur flex items-center justify-center disabled:opacity-50 select-none touch-none"
                style={{ touchAction: "none" }}
                aria-label="Toque para foto, segure para gravar vídeo"
              >
                {isRecording ? (
                  <span className="relative flex items-center justify-center h-20 w-20">
                    <span className="absolute inset-0 rounded-full ring-4 ring-red-500 animate-pulse" />
                    <span className="h-7 w-7 rounded-md bg-red-500" />
                  </span>
                ) : (
                  <div className="h-16 w-16 rounded-full bg-white ring-4 ring-white/40" />
                )}
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
            {!isEditingText && committedTextItems}

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

            {/* Dim overlay while editing */}
            {isEditingText && (
              <div className="absolute inset-0 z-[3] bg-black/30" onClick={commitEditing} />
            )}

            {/* Textarea de edição */}
            {isEditingText && (
              <div
                className="absolute inset-x-0 z-[5] flex items-center justify-center px-6 pointer-events-none"
                style={{ top: "52%", transform: "translateY(-50%)" }}
              >
                <textarea
                  ref={textareaRef}
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  maxLength={200}
                  placeholder="Digite aqui..."
                  className="w-full bg-transparent text-3xl leading-tight placeholder:text-white/60 resize-none outline-none border-0 pointer-events-auto"
                  style={{
                    textShadow: "0 1px 6px rgba(0,0,0,0.45)",
                    fontFamily: editingStyle.fontFamily,
                    fontWeight: editingStyle.fontWeight,
                    textAlign: editingStyle.align,
                    color: editingStyle.color,
                  }}
                  rows={3}
                  autoFocus
                />
              </div>
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

            {/* Toolbar de estilo — visível apenas durante a edição de texto */}
            {isEditingText && (
              <div
                className="relative z-[10] px-4 pt-2 pb-1 space-y-2"
                onClick={(e) => e.stopPropagation()}
              >
                {textStyleControls}
              </div>
            )}

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
            <div ref={captionFrameRef} className="absolute inset-0 overflow-hidden bg-black">
              {/* Fundo desfocado revelado ao redimensionar/mover (apenas imagem) */}
              {!mediaIsVideo && (
                <img
                  src={mediaPreview}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 h-full w-full object-cover scale-110 blur-2xl brightness-[0.55]"
                />
              )}
              {/* Mídia ajustável (pinça para redimensionar, arraste para mover) */}
              <div
                className="absolute inset-0 will-change-transform"
                style={{
                  transform: `translate(${mediaTransform.x}px, ${mediaTransform.y}px) scale(${mediaTransform.scale})`,
                  transformOrigin: "center",
                }}
              >
                {mediaIsVideo ? (
                  <video
                    src={mediaPreview}
                    className="h-full w-full object-cover"
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                ) : (
                  <img
                    src={mediaPreview}
                    alt="Preview"
                    draggable={false}
                    className="h-full w-full object-cover select-none"
                  />
                )}
              </div>
              {/* Camada de gestos (cobre a mídia → também impede gestos nativos sobre o vídeo) */}
              <div
                className="absolute inset-0 z-[4] touch-none"
                style={{ touchAction: "none" }}
                onPointerDown={handleMediaPointerDown}
                onPointerMove={handleMediaPointerMove}
                onPointerUp={handleMediaPointerUp}
                onPointerCancel={handleMediaPointerUp}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40 pointer-events-none z-[5]" />

              {/* Frases posicionadas sobre a foto (arrastáveis, toque para reeditar) */}
              {!isEditingText && committedTextItems}
            </div>

            {/* Camada de edição de texto (sobre a foto) */}
            {isEditingText && (
              <>
                <div className="absolute inset-0 z-[20] bg-black/40" onClick={commitEditing} />
                <div
                  className="absolute inset-x-0 z-[22] flex items-center justify-end px-4"
                  style={{ top: 0, paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
                >
                  <button
                    onClick={commitEditing}
                    className="h-10 px-4 rounded-full bg-white text-black text-sm font-semibold"
                  >
                    Pronto
                  </button>
                </div>
                <div
                  className="absolute inset-x-0 z-[22] px-4 space-y-2"
                  style={{ top: "calc(max(0.5rem, env(safe-area-inset-top)) + 3.25rem)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {textStyleControls}
                </div>
                <div
                  className="absolute inset-x-0 z-[22] flex items-center justify-center px-6 pointer-events-none"
                  style={{ top: "52%", transform: "translateY(-50%)" }}
                >
                  <textarea
                    ref={textareaRef}
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    maxLength={200}
                    placeholder="Digite aqui..."
                    className="w-full bg-transparent text-3xl leading-tight placeholder:text-white/60 resize-none outline-none border-0 pointer-events-auto"
                    style={{
                      textShadow: "0 1px 6px rgba(0,0,0,0.45)",
                      fontFamily: editingStyle.fontFamily,
                      fontWeight: editingStyle.fontWeight,
                      textAlign: editingStyle.align,
                      color: editingStyle.color,
                    }}
                    rows={3}
                    autoFocus
                  />
                </div>
              </>
            )}

            {!isEditingText && (
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
                  onClick={beginNewText}
                  className="h-10 px-3 rounded-full bg-black/40 backdrop-blur flex items-center text-white text-sm font-semibold gap-1"
                  aria-label="Adicionar texto"
                >
                  <Type className="h-4 w-4" />
                  + Aa
                </button>
              </div>
            )}

            {/* Dica de manipulação (some assim que o usuário ajusta) */}
            {!isEditingText && !isMediaTransformed(mediaTransform) && texts.length === 0 && (
              <div className="relative z-10 flex justify-center pt-2 pointer-events-none">
                <span className="text-white/80 text-xs bg-black/35 backdrop-blur rounded-full px-3 py-1">
                  Belisque para ajustar • toque em “+ Aa” para escrever
                </span>
              </div>
            )}

            <div className="flex-1" />

            {!isEditingText && (
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
            )}
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
