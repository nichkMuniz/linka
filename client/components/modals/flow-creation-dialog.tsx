import * as React from "react";
import { createPortal } from "react-dom";
import { HighlightTextarea, SHADCN_TEXTAREA_CLASS } from "@/components/shared/highlight-textarea";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { TagPeopleDrawer, MAX_TAGGED_PEOPLE } from "@/components/shared/tag-people-drawer";
import { MentionSuggestions, addMentionToTagged } from "@/components/shared/mention-suggestions";
import {
  FlowPostCard,
  FlowWorkoutSticker,
  WORKOUT_STICKER_WIDTH,
  MIN_STICKER_SCALE,
  MAX_STICKER_SCALE,
  formatStickerDate,
  formatStickerDuration,
  formatStickerExercise,
  formatStickerVolume,
  isStickerFieldShown,
  applyStickerFields,
} from "@/components/shared/flow-workout-sticker";
import {
  WorkoutStickerPickerDrawer,
  type WorkoutStickerChoice,
} from "@/components/modals/workout-sticker-picker-drawer";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useLanguage } from "@/lib/language-context";
import { saveMediaToPhotos, SaveMediaError, compressVideoBlob, pickGalleryMedia } from "@/lib/native-media";
import { hapticLight } from "@/lib/haptics";
import { motion } from "framer-motion";
import type { SearchUser, StoryPostSticker, StoryTextElement, StoryWorkoutSticker } from "@/lib/ritmofit-db";
import { POST_FLOW_BACKGROUND } from "@/lib/post-to-flow";
import {
  X,
  Image as ImageIcon,
  Check,
  SwitchCamera,
  Camera as CameraIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Loader2,
  AtSign,
  Lock,
  Download,
  Dumbbell,
  SlidersHorizontal,
  ArrowLeft,
  ArrowUp,
  Trash2,
  Pin,
} from "lucide-react";
import { PinFlowDrawer } from "@/components/shared/pin-flow-drawer";
import { PhotoLibrary } from "@capgo/capacitor-photo-library";
import { Capacitor } from "@capacitor/core";
import { reportHandledError } from "@/lib/monitoring";
import { FEATURES } from "@/lib/feature-flags";
import type { TranslationKey } from "@/lib/i18n";

// `label` é chave de tradução — vira o aria-label de cada bolinha de fundo.
const CAMERA_ERROR_KEY: Record<"denied" | "unsupported" | "failed", TranslationKey> = {
  denied: "flow_camera_denied",
  unsupported: "flow_camera_unsupported",
  failed: "flow_camera_failed",
};

const GRADIENT_PRESETS: Array<{ id: string; value: string; label: TranslationKey }> = [
  { id: "pink-orange", value: "linear-gradient(135deg, #FF0080 0%, #FF8A2A 100%)", label: "flow_gradient_pink" },
  { id: "blue-purple", value: "linear-gradient(135deg, #3A8DFF 0%, #7B3FF2 100%)", label: "flow_gradient_blue" },
  { id: "green-teal", value: "linear-gradient(135deg, #00C853 0%, #00BCD4 100%)", label: "flow_gradient_green" },
  { id: "purple-pink", value: "linear-gradient(135deg, #7B3FF2 0%, #FF0080 100%)", label: "flow_gradient_purple" },
  { id: "orange-yellow", value: "linear-gradient(135deg, #FF8A2A 0%, #FFD600 100%)", label: "flow_gradient_orange" },
  { id: "dark-blue", value: "linear-gradient(135deg, #0D1B2A 0%, #1A3A5C 100%)", label: "flow_gradient_night" },
  { id: "brand", value: "linear-gradient(135deg, #3A8DFF 0%, #7B3FF2 50%, #FF8A2A 100%)", label: "flow_gradient_brand" },
  { id: "sunset", value: "linear-gradient(135deg, #FF512F 0%, #F09819 100%)", label: "flow_gradient_sunset" },
  { id: "ocean", value: "linear-gradient(135deg, #1A237E 0%, #00BCD4 100%)", label: "flow_gradient_ocean" },
  { id: "forest", value: "linear-gradient(135deg, #1B5E20 0%, #66BB6A 100%)", label: "flow_gradient_forest" },
];

// Fontes disponíveis para legendas. Todas são fontes de sistema pré-instaladas no
// iOS (ou keywords CSS `ui-*` suportadas no WKWebView) com fallback genérico, então
// renderizam sem carregar nenhum arquivo de fonte externo.
// Nome exibido traduzido (`labelKey`) desde 2026-09-30 — antes eram os nomes
// técnicos em inglês ("Bold", "Light"…) num app em português.
const FONT_OPTIONS = [
  { id: "bold",       labelKey: "flow_font_classic",    family: "system-ui, -apple-system, sans-serif",                 weight: 800 },
  { id: "light",      labelKey: "flow_font_light",      family: "system-ui, -apple-system, sans-serif",                 weight: 300 },
  { id: "rounded",    labelKey: "flow_font_rounded",    family: "ui-rounded, 'SF Pro Rounded', system-ui, sans-serif",  weight: 700 },
  { id: "condensed",  labelKey: "flow_font_impact",     family: "'Impact', 'Haettenschweiler', system-ui, sans-serif",  weight: 900 },
  { id: "serif",      labelKey: "flow_font_serif",      family: "Georgia, 'Times New Roman', serif",                    weight: 700 },
  { id: "elegant",    labelKey: "flow_font_elegant",    family: "'Didot', 'Hoefler Text', Georgia, serif",              weight: 600 },
  { id: "script",     labelKey: "flow_font_script",     family: "'Snell Roundhand', 'Zapfino', cursive",                weight: 700 },
  { id: "marker",     labelKey: "flow_font_marker",     family: "'Marker Felt', 'Chalkboard SE', 'Comic Sans MS', cursive", weight: 600 },
  { id: "typewriter", labelKey: "flow_font_typewriter", family: "'American Typewriter', 'Courier New', monospace",      weight: 600 },
  { id: "mono",       labelKey: "flow_font_mono",       family: "ui-monospace, 'Courier New', Courier, monospace",      weight: 500 },
] as const satisfies ReadonlyArray<{ id: string; labelKey: TranslationKey; family: string; weight: number }>;

const TEXT_COLORS = [
  "#ffffff", "#000000", "#8E8E93", "#FF3B30",
  "#FF2D55", "#FF0080", "#FF8A2A", "#FF9500",
  "#FFD600", "#FFE066", "#34C759", "#00C853",
  "#00BCD4", "#3A8DFF", "#5856D6", "#7B3FF2",
  "#AF52DE", "#A0522D",
];

type TextStyle = {
  fontFamily: string;
  fontWeight: number;
  align: "left" | "center" | "right";
  color: string;
  fontSize: number; // px
  backgroundColor: string | null; // realce estilo Instagram; null = sem fundo
};

// Tamanho da legenda (px). O padrão 30 equivale ao text-3xl usado antes; o usuário
// diminui para focar na mídia ou aumenta para focar no texto.
const MIN_CAPTION_FONT = 16;
const MAX_CAPTION_FONT = 64;
const DEFAULT_CAPTION_FONT = 30;

const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: FONT_OPTIONS[0].family,
  fontWeight: FONT_OPTIONS[0].weight,
  align: "center",
  color: "#ffffff",
  fontSize: DEFAULT_CAPTION_FONT,
  backgroundColor: null,
};

// Preto ou branco conforme a luminância do fundo — mantém a legenda legível
// quando há realce, como o Instagram faz automaticamente.
function contrastText(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return "#000000";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#000000" : "#ffffff";
}

// Quanto tempo segurando o obturador até começar a gravar vídeo (toque rápido = foto)
const LONG_PRESS_MS = 400;
// Quanto arrastar o obturador para cima (px) enquanto grava para TRAVAR a gravação
// (mãos livres — estilo Instagram/Snapchat): depois disso, soltar não para; para
// encerrar, toca-se no obturador de novo.
const LOCK_DRAG_THRESHOLD = 70;
// Duração máxima de gravação do flow em vídeo (1 min)
const MAX_RECORD_MS = 60000;
// Duração máxima aceita para vídeos (gravados ou da galeria) — mantém os flows curtos
const MAX_VIDEO_DURATION_S = 60;
// Tamanho máximo de arquivo de mídia (vídeos editados/da galeria costumam ser pesados)
const MAX_MEDIA_BYTES = 100 * 1024 * 1024;

// Ring de tempo restante desenhado em volta do obturador (SVG 80x80, traço de 4px).
const RING_RADIUS = 36;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// Enquadramento alvo da gravação: 9:16, até 1080x1920 — o formato de story, e
// exatamente o que o viewer mostra (`object-cover` numa tela em pé).
//
// Por que importa para a NITIDEZ: antes o canvas gravava o frame CRU da câmera.
// No iOS esse frame costuma vir 4:3 ou 16:9, então o viewer descartava boa parte
// da largura no `object-cover` — o bitrate era gasto codificando área que
// ninguém via, e a faixa visível ficava com uma fração dos bits. Gravar já
// recortado no 9:16 concentra todo o bitrate no que aparece na tela; é o ganho
// isolado maior de qualidade, antes mesmo de mexer no bitrate.
const RECORD_TARGET_ASPECT = 9 / 16;
const RECORD_TARGET_HEIGHT = 1920;
const RECORD_FPS = 30;

// Bitrate proporcional à área realmente gravada (~0,09 bit por pixel por frame),
// não um teto fixo. Em 1080x1920@30 dá ~5,6 Mbps.
//
// O valor anterior era fixo em 2 Mbps para encurtar o carregamento, mas 2 Mbps
// em 1080p com movimento (que é TODO o conteúdo do app: treino, corrida) estoura
// o orçamento de bits do H.264 e vira macrobloco — a "pixelação" reclamada. Com
// o teto de 1 min, 6 Mbps ≈ 45MB, ainda dentro de MAX_MEDIA_BYTES; e como o
// clipe agora é gravado no enquadramento final, o arquivo não cresce na mesma
// proporção do bitrate (o recorte já cortou os pixels invisíveis).
const RECORD_BITS_PER_PIXEL = 0.09;
const RECORD_MIN_BITRATE = 3_000_000;
const RECORD_MAX_BITRATE = 6_000_000;
const RECORD_AUDIO_BITRATE = 128_000;

function recorderBitrateFor(width: number, height: number) {
  const raw = width * height * RECORD_FPS * RECORD_BITS_PER_PIXEL;
  return {
    videoBitsPerSecond: Math.round(
      Math.min(RECORD_MAX_BITRATE, Math.max(RECORD_MIN_BITRATE, raw)),
    ),
    audioBitsPerSecond: RECORD_AUDIO_BITRATE,
  };
}

// Recorte central da fonte para o formato alvo, em coordenadas do <video>.
// Usado tanto para dimensionar o canvas quanto a cada frame (a fonte muda de
// tamanho quando o usuário troca de câmera no meio da gravação).
function centerCrop(srcW: number, srcH: number, zoom: number) {
  let w = srcW;
  let h = srcH;
  if (srcW / srcH > RECORD_TARGET_ASPECT) {
    w = srcH * RECORD_TARGET_ASPECT;
  } else {
    h = srcW / RECORD_TARGET_ASPECT;
  }
  if (zoom > 1) {
    w /= zoom;
    h /= zoom;
  }
  return { sx: (srcW - w) / 2, sy: (srcH - h) / 2, sw: w, sh: h };
}

// Teto do maior lado da FOTO de flow, em px, e qualidade JPEG do upload. Casa com
// o `maxDim` de `bakeTransformedCanvas`: sem isso a foto da câmera (o único
// caminho que não passa pela composição) subia na resolução crua do sensor.
// O flow é visto em tela cheia num celular — 1280 no maior lado já satura o
// display, e servir esse arquivo direto do Storage evita mandar a imagem pelo
// endpoint de transform da Supabase, que é cobrado por imagem de origem
// distinta por mês. Ver `client/lib/image-url.ts`.
const PHOTO_MAX_DIM = 1280;
const PHOTO_JPEG_QUALITY = 0.85;

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

// Resolve quando o <video> já pintou um frame real da câmera e o layout teve
// mais dois frames para assentar no tamanho final. Usa
// `requestVideoFrameCallback` (iOS 15.4+) e cai para polling de `videoWidth`
// onde não existir. O timeout garante que a prévia nunca fique presa invisível.
function waitForFirstVideoFrame(video: HTMLVideoElement, timeoutMs = 1500): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      resolve();
    };
    const settle = () => requestAnimationFrame(() => requestAnimationFrame(finish));
    const timer = window.setTimeout(finish, timeoutMs);
    const v = video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
    };
    if (typeof v.requestVideoFrameCallback === "function") {
      v.requestVideoFrameCallback(settle);
      return;
    }
    const poll = () => {
      if (done) return;
      if (video.videoWidth > 0 && video.readyState >= 2) settle();
      else requestAnimationFrame(poll);
    };
    poll();
  });
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

// Retângulo equivalente ao object-contain: cabe a imagem INTEIRA dentro de (fw x fh)
// preservando o aspecto (sobra vira letterbox, preenchido pelo fundo desfocado).
function containRect(iw: number, ih: number, fw: number, fh: number) {
  const ir = iw / ih;
  const fr = fw / fh;
  let dw: number, dh: number;
  if (ir > fr) {
    dw = fw;
    dh = fw / ir;
  } else {
    dh = fh;
    dw = fh * ir;
  }
  return { dx: (fw - dw) / 2, dy: (fh - dh) / 2, dw, dh };
}

// Compõe a imagem transformada num canvas (com fundo desfocado) para que o
// resultado compartilhado seja exatamente o que o usuário enxerga.
async function bakeTransformedCanvas(
  src: string,
  frameW: number,
  frameH: number,
  t: MediaTransform,
  fit: "cover" | "contain" = "cover",
): Promise<HTMLCanvasElement | null> {
  try {
    if (frameW <= 0 || frameH <= 0) return null;
    const img = await loadImageEl(src);
    const fr = frameW / frameH;
    const maxDim = PHOTO_MAX_DIM;
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
    // "contain" (imagem inteira, sem cortar → galeria) ou "cover" (full-bleed → câmera),
    // batendo com o object-fit usado no preview.
    const fc = (fit === "contain" ? containRect : coverRect)(img.width, img.height, outW, outH);
    ctx.drawImage(img, fc.dx, fc.dy, fc.dw, fc.dh);
    ctx.restore();

    return canvas;
  } catch {
    return null;
  }
}

async function bakeTransformedImage(
  src: string,
  frameW: number,
  frameH: number,
  t: MediaTransform,
  fit: "cover" | "contain" = "cover",
): Promise<string | null> {
  const canvas = await bakeTransformedCanvas(src, frameW, frameH, t, fit);
  return canvas ? canvas.toDataURL("image/jpeg", PHOTO_JPEG_QUALITY) : null;
}

/* -------------------------------------------------------------------------- */
/*  Composição do rascunho (o que vai para a galeria do celular)              */
/* -------------------------------------------------------------------------- */

// Frase posicionada, no formato mínimo que o desenho no canvas precisa.
type DrawableText = { text: string; x: number; y: number; style: TextStyle };

// Pinta um dos GRADIENT_PRESETS num canvas. Os presets são todos
// `linear-gradient(<n>deg, <cor> <pos>%, ...)`, então um parser pequeno resolve.
function paintCssGradient(
  ctx: CanvasRenderingContext2D,
  css: string,
  w: number,
  h: number,
): void {
  const match = /linear-gradient\(\s*([-\d.]+)deg\s*,\s*(.+)\)\s*$/i.exec(css.trim());
  if (!match) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    return;
  }
  const stops = match[2]
    .split(",")
    .map((raw) => {
      const parsed = /^\s*(#[0-9a-f]{3,8})\s*(?:([\d.]+)%)?\s*$/i.exec(raw);
      return parsed
        ? { color: parsed[1], pos: parsed[2] != null ? parseFloat(parsed[2]) / 100 : null }
        : null;
    })
    .filter((s): s is { color: string; pos: number | null } => s !== null);

  if (stops.length < 2) {
    ctx.fillStyle = stops[0]?.color ?? "#000";
    ctx.fillRect(0, 0, w, h);
    return;
  }

  // Linha do gradiente no sistema do CSS: 0deg aponta para cima, sentido horário.
  const rad = (parseFloat(match[1]) * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const length = Math.abs(w * dx) + Math.abs(h * dy);
  const cx = w / 2;
  const cy = h / 2;
  const gradient = ctx.createLinearGradient(
    cx - (dx * length) / 2,
    cy - (dy * length) / 2,
    cx + (dx * length) / 2,
    cy + (dy * length) / 2,
  );
  stops.forEach((stop, i) => {
    gradient.addColorStop(stop.pos ?? i / (stops.length - 1), stop.color);
  });
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

// `ctx.roundRect` só existe no Safari 16+; o app suporta iOS 15.
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

// Quebra igual ao `whitespace-pre-wrap` + `break-words` do preview: respeita as
// quebras digitadas, quebra por palavra e, se a palavra não couber, por letra.
function wrapCanvasLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let current = "";
    for (const word of paragraph.split(" ")) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && ctx.measureText(candidate).width > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
      // Palavra sozinha maior que a linha → quebra por letra.
      while (ctx.measureText(current).width > maxWidth && current.length > 1) {
        let cut = current.length - 1;
        while (cut > 1 && ctx.measureText(current.slice(0, cut)).width > maxWidth) cut--;
        lines.push(current.slice(0, cut));
        current = current.slice(cut);
      }
    }
    lines.push(current);
  }
  return lines;
}

/**
 * Desenha as frases no canvas na mesma posição/estilo do preview.
 *
 * `x`/`y` das frases são px de tela; `scale` converte para px do canvas. O bloco
 * é centrado em (x, y) — igual ao `translate(-50%, -50%)` do preview — e a
 * largura acompanha o `width: max-content; max-width: 80vw; padding: 0 0.5rem`.
 */
function drawTextsOnCanvas(
  ctx: CanvasRenderingContext2D,
  items: DrawableText[],
  frameW: number,
  scale: number,
): void {
  const LINE_HEIGHT_RATIO = 1.625; // leading-relaxed
  const maxWidth = Math.max(1, (frameW * 0.8 - 16) * scale); // 80vw menos o padding

  for (const item of items) {
    if (!item.text) continue;
    const fontSize = item.style.fontSize * scale;
    const lineHeight = fontSize * LINE_HEIGHT_RATIO;
    ctx.font = `${item.style.fontWeight} ${fontSize}px ${item.style.fontFamily}`;
    ctx.textBaseline = "middle";

    const lines = wrapCanvasLines(ctx, item.text, maxWidth);
    const widths = lines.map((line) => ctx.measureText(line).width);
    const blockWidth = Math.min(maxWidth, Math.max(...widths));
    const cx = item.x * scale;
    const cy = item.y * scale;
    const top = cy - (lines.length * lineHeight) / 2;
    const contentLeft = cx - blockWidth / 2;
    const hasBg = !!item.style.backgroundColor;

    lines.forEach((line, i) => {
      const width = widths[i];
      const midY = top + (i + 0.5) * lineHeight;
      const left =
        item.style.align === "left"
          ? contentLeft
          : item.style.align === "right"
            ? contentLeft + blockWidth - width
            : cx - width / 2;

      if (hasBg) {
        // Realce por linha (box-decoration-break: clone no preview)
        const padX = fontSize * 0.26;
        const padY = fontSize * 0.08;
        const boxH = fontSize * 1.2 + padY * 2;
        ctx.save();
        ctx.fillStyle = item.style.backgroundColor as string;
        roundRectPath(ctx, left - padX, midY - boxH / 2, width + padX * 2, boxH, fontSize * 0.28);
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      if (!hasBg) {
        // text-shadow: 0 1px 6px rgba(0,0,0,0.45)
        ctx.shadowColor = "rgba(0,0,0,0.45)";
        ctx.shadowBlur = 6 * scale;
        ctx.shadowOffsetY = 1 * scale;
      }
      ctx.fillStyle = item.style.color;
      ctx.fillText(line, left, midY);
      ctx.restore();
    });
  }
}

/* -------------------------------------------------------------------------- */
/*  Mini frame do treino (sticker) — desenho no canvas do rascunho            */
/* -------------------------------------------------------------------------- */

/**
 * Mini frame de treino posicionado, no formato mínimo que o desenho no canvas
 * precisa. Os textos traduzidos chegam prontos: esta função vive fora do
 * componente e não tem acesso ao `t()`.
 */
type DrawableSticker = {
  data: StoryWorkoutSticker;
  /** px de tela, centro do card (igual às frases) */
  x: number;
  y: number;
  scale: number;
  labels: { title: string; series: string; prs: string; more: string; date: string };
};

const STICKER_FONT = "-apple-system, system-ui, 'Segoe UI', sans-serif";
// Alturas em px de CSS — espelham o layout do <FlowWorkoutSticker>.
const STICKER_PAD = 12;
const STICKER_HEADER_H = 28;
const STICKER_CHIPS_H = 18;
const STICKER_ROW_H = 13;
const STICKER_ROW_GAP = 4;

/**
 * Chips de números da sessão, na MESMA ordem do `<FlowWorkoutSticker>` — é o
 * que mantém o rascunho no canvas idêntico ao preview em React.
 */
function stickerChips(
  data: StoryWorkoutSticker,
  labels: DrawableSticker["labels"],
): Array<{ text: string; accent: boolean }> {
  const chips: Array<{ text: string; accent: boolean }> = [];
  if (isStickerFieldShown(data, "series")) {
    chips.push({ text: `${data.totalSeries} ${labels.series}`, accent: false });
  }
  if (data.totalVolume > 0) chips.push({ text: formatStickerVolume(data.totalVolume), accent: false });
  if (data.durationSecs > 0) chips.push({ text: formatStickerDuration(data.durationSecs), accent: false });
  if (Number(data.caloriesKcal ?? 0) > 0) {
    chips.push({ text: `${Math.round(Number(data.caloriesKcal))} kcal`, accent: false });
  }
  if (Number(data.prCount ?? 0) > 0) chips.push({ text: `${data.prCount} ${labels.prs}`, accent: true });
  return chips;
}

/**
 * Em quantas linhas os chips cabem na largura do card. O componente React usa
 * `flex-wrap`, então o canvas precisa quebrar igual — senão o rascunho fica com
 * altura menor que o preview e os últimos chips somem do card gerado.
 */
function stickerChipLines(
  ctx: CanvasRenderingContext2D,
  chips: Array<{ text: string }>,
  contentW: number,
): number {
  // Sem chips (autor ocultou todos os números) = a linha inteira some do card.
  if (chips.length === 0) return 0;
  ctx.save();
  ctx.font = `700 9.5px ${STICKER_FONT}`;
  let lines = 1;
  let x = 0;
  for (const chip of chips) {
    const w = ctx.measureText(chip.text).width + 14;
    if (x > 0 && x + w > contentW) { lines++; x = 0; }
    x += w + 6;
  }
  ctx.restore();
  return lines;
}

function stickerCardHeight(data: StoryWorkoutSticker, chipLines = 1): number {
  const rows = data.exercises?.length ?? 0;
  let h = STICKER_PAD + STICKER_HEADER_H;
  if (chipLines > 0) h += 9 + STICKER_CHIPS_H + (chipLines - 1) * (STICKER_CHIPS_H + 6);
  if (rows > 0) {
    h += 9 + 1 + 8 + rows * STICKER_ROW_H + (rows - 1) * STICKER_ROW_GAP;
    if (data.extraCount) h += STICKER_ROW_GAP + 12;
  }
  return h + STICKER_PAD;
}

// Corta o texto com reticências quando não cabe na largura disponível.
function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text.length;
  while (cut > 1 && ctx.measureText(`${text.slice(0, cut)}…`).width > maxWidth) cut--;
  return `${text.slice(0, cut)}…`;
}

function drawStickerChip(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  accent: boolean,
): number {
  ctx.font = `700 9.5px ${STICKER_FONT}`;
  const w = ctx.measureText(text).width + 14;
  roundRectPath(ctx, x, y, w, STICKER_CHIPS_H, STICKER_CHIPS_H / 2);
  ctx.fillStyle = accent ? "rgba(255,196,60,.16)" : "rgba(255,255,255,.09)";
  ctx.fill();
  ctx.strokeStyle = accent ? "rgba(255,196,60,.3)" : "rgba(255,255,255,.12)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = accent ? "#ffc43c" : "rgba(255,255,255,.85)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, y + STICKER_CHIPS_H / 2 + 0.5);
  return w;
}

/**
 * Desenha o mini frame de treino no canvas do rascunho, no mesmo lugar e
 * tamanho do preview. `s` converte px de tela em px do canvas; o desenho em si
 * acontece no sistema de coordenadas do card (px de CSS, origem no canto
 * superior esquerdo), como no componente React.
 */
function drawWorkoutStickerOnCanvas(
  ctx: CanvasRenderingContext2D,
  item: DrawableSticker,
  s: number,
): void {
  const { data } = item;
  const W = WORKOUT_STICKER_WIDTH;
  const chips = stickerChips(data, item.labels);
  const chipLines = stickerChipLines(ctx, chips, W - STICKER_PAD * 2 - 2);
  const H = stickerCardHeight(data, chipLines);

  ctx.save();
  ctx.translate(item.x * s, item.y * s);
  ctx.scale(s * item.scale, s * item.scale);
  ctx.translate(-W / 2, -H / 2);

  // Fundo + borda
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "rgba(32,30,44,.95)");
  bg.addColorStop(1, "rgba(13,12,19,.97)");
  roundRectPath(ctx, 0, 0, W, H, 20);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.16)";
  ctx.lineWidth = 1;
  ctx.stroke();

  const contentW = W - STICKER_PAD * 2 - 2;
  const left = 13;

  // Ícone da marca (quadrado arredondado com um halter simplificado)
  const iconTop = STICKER_PAD;
  const icon = ctx.createLinearGradient(left, iconTop, left + 28, iconTop + 28);
  icon.addColorStop(0, "#5b8cff");
  icon.addColorStop(1, "#9d6bff");
  roundRectPath(ctx, left, iconTop, 28, 28, 10);
  ctx.fillStyle = icon;
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillRect(left + 8, iconTop + 11, 12, 2.4);
  ctx.fillRect(left + 6.5, iconTop + 8.5, 2.6, 7.5);
  ctx.fillRect(left + 18.9, iconTop + 8.5, 2.6, 7.5);

  // Data (à direita) — mede primeiro para o nome saber quanto espaço sobra
  ctx.textBaseline = "middle";
  ctx.font = `600 9.5px ${STICKER_FONT}`;
  const dateW = item.labels.date ? ctx.measureText(item.labels.date).width + 6 : 0;
  if (item.labels.date) {
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.fillText(item.labels.date, W - 13, iconTop + 14);
  }

  // Rótulo + nome da rotina
  const textLeft = left + 28 + 8;
  const textMaxW = W - 13 - textLeft - dateW;
  ctx.textAlign = "left";
  ctx.font = `700 8.5px ${STICKER_FONT}`;
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.fillText(ellipsize(ctx, item.labels.title.toUpperCase(), textMaxW), textLeft, iconTop + 6);
  ctx.font = `800 13px ${STICKER_FONT}`;
  ctx.fillStyle = "#fff";
  ctx.fillText(ellipsize(ctx, data.name, textMaxW), textLeft, iconTop + 20);

  // Chips com os números da sessão (quebram de linha como no preview React)
  let chipX = left;
  let chipY = iconTop + STICKER_HEADER_H + 9;
  ctx.font = `700 9.5px ${STICKER_FONT}`;
  for (const chip of chips) {
    const w = ctx.measureText(chip.text).width + 14;
    if (chipX > left && chipX + w > left + contentW) {
      chipX = left;
      chipY += STICKER_CHIPS_H + 6;
    }
    drawStickerChip(ctx, chip.text, chipX, chipY, chip.accent);
    chipX += w + 6;
  }

  // Exercícios da sessão
  const rows = data.exercises ?? [];
  if (rows.length > 0) {
    // Sem chips, a lista começa logo abaixo do cabeçalho (como no React).
    const lineY = (chips.length > 0 ? chipY + STICKER_CHIPS_H : iconTop + STICKER_HEADER_H) + 9;
    ctx.fillStyle = "rgba(255,255,255,.1)";
    ctx.fillRect(left, lineY, contentW, 1);
    let rowY = lineY + 1 + 8;
    for (const ex of rows) {
      const value = formatStickerExercise(ex);
      ctx.font = `700 10.5px ${STICKER_FONT}`;
      const valueW = ctx.measureText(value).width;
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(255,255,255,.6)";
      ctx.fillText(value, left + contentW, rowY + STICKER_ROW_H / 2);
      ctx.font = `600 10.5px ${STICKER_FONT}`;
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(255,255,255,.9)";
      ctx.fillText(
        ellipsize(ctx, ex.name, contentW - valueW - 8),
        left,
        rowY + STICKER_ROW_H / 2,
      );
      rowY += STICKER_ROW_H + STICKER_ROW_GAP;
    }
    if (data.extraCount) {
      ctx.font = `600 9.5px ${STICKER_FONT}`;
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(255,255,255,.45)";
      ctx.fillText(item.labels.more, left, rowY + 6);
    }
  }

  ctx.restore();
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao gerar a imagem"))),
      "image/jpeg",
      0.92,
    );
  });
}

/**
 * Conteúdo com que o criador abre já pronto, pulando a câmera — usado pelo
 * "Compartilhar no Flow" do resumo do treino e pelo "Editar antes de postar"
 * do "Seu flow" de um post. A mídia entra como imagem da galeria (inteira, com
 * fundo desfocado) e o mini frame, se vier, é colado como se o usuário o
 * tivesse escolhido no seletor de treino.
 */
export type FlowCreationSeed = {
  /** blob:/data: URL de uma imagem — o dialog passa a ser dono dela */
  mediaUrl?: string | null;
  workoutSticker?: StoryWorkoutSticker | null;
  /**
   * "Seu flow → Editar antes de postar" de um post do feed: sem mídia, abre o
   * modo texto (fundo gradiente) com a moldura do post já colada — o mesmo
   * flow que `sharePostToFlow` publica direto, só que editável.
   */
  postSticker?: StoryPostSticker | null;
};

interface FlowCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Abre direto na etapa de legenda com esta mídia. Cada objeto novo é aplicado uma vez. */
  seed?: FlowCreationSeed | null;
  onCreateStory: (
    mediaUrl: string,
    description: string,
    backgroundColor?: string | null,
    textPosition?: { x: number; y: number } | null,
    textElements?: StoryTextElement[] | null,
    mediaTransform?: { scale: number; x: number; y: number } | null,
    taggedUserIds?: string[],
    /** Fixar no perfil logo depois de publicar (escolhido na criação). */
    pin?: { title: string | null } | null,
  ) => Promise<void>;
  isLoading?: boolean;
}

type Step = "camera" | "caption" | "create";

export function FlowCreationDialog({
  open,
  onOpenChange,
  onCreateStory,
  isLoading = false,
  seed = null,
}: FlowCreationDialogProps) {
  const { t } = useLanguage();
  const [step, setStep] = React.useState<Step>("camera");
  // Confirmação antes de o "voltar" apagar o que foi feito: "media" = foto/vídeo
  // da legenda (+ textos, marcações, treino); "text" = frases do modo texto.
  const [discardAsk, setDiscardAsk] = React.useState<null | "media" | "text">(null);
  // Miniatura da última foto/vídeo do rolo no botão de galeria da câmera.
  const [galleryThumb, setGalleryThumb] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!open || galleryThumb) return;
    let cancelled = false;
    (async () => {
      try {
        // Só consulta com permissão JÁ concedida — abrir a câmera do flow não
        // deve disparar o pedido de acesso às fotos.
        const { state } = await PhotoLibrary.checkAuthorization();
        if (state !== "authorized" && state !== "limited") return;
        const { assets } = await PhotoLibrary.getLibrary({
          offset: 0,
          limit: 1,
          includeImages: true,
          includeVideos: true,
          thumbnailWidth: 120,
          thumbnailHeight: 120,
          thumbnailQuality: 0.7,
        });
        const src = assets[0]?.thumbnail?.webPath;
        if (!cancelled && src) setGalleryThumb(src);
      } catch {
        // web ou plugin indisponível: fica o ícone
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, galleryThumb]);
  // Última semente já aplicada. Enquanto a atual não foi aplicada, a câmera
  // NÃO liga — senão o flow pediria permissão/abriria o stream por um frame
  // antes de pular para a legenda.
  const [appliedSeed, setAppliedSeed] = React.useState<FlowCreationSeed | null>(null);
  const awaitingSeed = open && !!seed && appliedSeed !== seed;
  const [mediaPreview, setMediaPreview] = React.useState<string | null>(null);
  const [mediaIsVideo, setMediaIsVideo] = React.useState(false);
  // Imagem veio da galeria (vs. capturada pela câmera). A da galeria é exibida
  // inteira (object-contain + fundo desfocado) para não cortar o conteúdo; a da
  // câmera é full-bleed (object-cover), pois o viewfinder já é WYSIWYG.
  const [mediaFromGallery, setMediaFromGallery] = React.useState(false);
  const [description, setDescription] = React.useState("");
  // Pessoas marcadas no flow (estilo Instagram) + drawer de seleção.
  const [taggedUsers, setTaggedUsers] = React.useState<SearchUser[]>([]);
  const descriptionRef = React.useRef<HTMLTextAreaElement | null>(null);
  const [tagPeopleOpen, setTagPeopleOpen] = React.useState(false);
  // Fixar no perfil, escolhido ANTES de postar: só fica guardado aqui e vai junto
  // no onCreateStory — o flow ainda não existe para a RPC.
  const [pinOnPost, setPinOnPost] = React.useState<{ title: string | null } | null>(null);
  const [pinDrawerOpen, setPinDrawerOpen] = React.useState(false);
  // Mini frame do último treino citado no flow (estilo "repost"): um único
  // sticker por flow, arrastável e redimensionável como as frases. `null` = o
  // usuário não citou treino nenhum.
  const [workoutSticker, setWorkoutSticker] = React.useState<{
    /** o que é desenhado e publicado — `full` com os blocos ocultos zerados */
    data: StoryWorkoutSticker;
    /** snapshot completo, para o autor poder reexibir um bloco antes de publicar */
    full: StoryWorkoutSticker;
    x: number;
    y: number;
    scale: number;
  } | null>(null);
  // Moldura de um post do feed ("Seu flow → Editar antes de postar"). Só nasce
  // pela semente e só existe no modo texto — é um flow sem mídia própria.
  const [postSticker, setPostSticker] = React.useState<{
    data: StoryPostSticker;
    x: number;
    y: number;
    scale: number;
  } | null>(null);
  const [workoutPickerOpen, setWorkoutPickerOpen] = React.useState(false);
  // true = o drawer abre direto na personalização do sticker já colado.
  const [workoutPickerEditing, setWorkoutPickerEditing] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  // "Salvar rascunho": grava o flow como ele está na galeria do celular.
  const [isSavingDraft, setIsSavingDraft] = React.useState(false);
  // Verdadeiro entre selecionar um arquivo na galeria e o preview ficar pronto.
  // Vídeos grandes demoram para ter a metadata (duração) lida E para decodificar o
  // primeiro frame — sem isto a tela parece travada na galeria.
  const [isPreparingMedia, setIsPreparingMedia] = React.useState(false);
  // Rede de segurança final: garante que o indicador nunca fique preso, mesmo se o
  // vídeo do preview não disparar loadedData.
  const prepareSafetyRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedGradient, setSelectedGradient] = React.useState(GRADIENT_PRESETS[0].value);
  // Flow abre sempre na câmera frontal (selfie) por padrão; o usuário pode
  // alternar para a traseira com o botão de virar câmera.
  const [facingMode, setFacingMode] = React.useState<"user" | "environment">("user");
  // Tipo do erro de câmera (o texto sai do `t()` na exibição — assim o
  // `startStream` não depende do idioma e não reabre a câmera ao trocar de língua).
  const [cameraError, setCameraError] = React.useState<"denied" | "unsupported" | "failed" | null>(null);
  const [cameraReady, setCameraReady] = React.useState(false);
  // O <video> só aparece depois que o primeiro frame foi pintado já no tamanho
  // final. No WebKit do iOS, logo após receber o `srcObject`, a camada de vídeo
  // é desenhada por alguns frames no tamanho intrínseco provisório (um
  // quadradinho) e só então se expande para a tela — era o "quadrado que
  // cresce" ao abrir o flow. Mantê-lo invisível até lá e entrar com fade
  // esconde o salto (vale também para a troca de câmera).
  const [videoShown, setVideoShown] = React.useState(false);
  // Identifica a abertura de stream corrente: uma troca rápida de câmera não
  // pode deixar o `startStream` anterior revelar o vídeo fora de hora.
  const streamTokenRef = React.useRef(0);
  const [isRecording, setIsRecording] = React.useState(false);
  // Gravação "travada" (mãos livres, após arrastar o obturador para cima).
  const [isRecordingLocked, setIsRecordingLocked] = React.useState(false);
  const [recordSeconds, setRecordSeconds] = React.useState(0);
  const [zoom, setZoom] = React.useState(1);
  const [mediaTransform, setMediaTransformState] = React.useState<MediaTransform>(IDENTITY_TRANSFORM);

  type TextItem = { id: string; text: string; x: number; y: number; style: TextStyle };
  const [texts, setTexts] = React.useState<TextItem[]>([]);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingValue, setEditingValue] = React.useState("");
  const [editingStyle, setEditingStyle] = React.useState<TextStyle>(DEFAULT_TEXT_STYLE);
  const isEditingText = editingId !== null;

  // Espelha `facingMode` num ref para o loop de desenho do canvas (abaixo) ler o
  // lado ATUAL da câmera a cada frame, sem precisar recriar a gravação quando o
  // usuário troca de câmera no meio de um clipe.
  const facingModeRef = React.useRef(facingMode);
  React.useEffect(() => {
    facingModeRef.current = facingMode;
  }, [facingMode]);

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const audioStreamRef = React.useRef<MediaStream | null>(null);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const recordedChunksRef = React.useRef<Blob[]>([]);
  // Para a câmera frontal, gravamos a partir de um canvas espelhado; este ref
  // guarda a limpeza (cancelar o rAF e parar a track do canvas) para que ela
  // rode tanto no fim normal da gravação quanto se o diálogo for fechado antes.
  const recordCanvasCleanupRef = React.useRef<(() => void) | null>(null);
  const holdTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxDurationTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordTickRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingActiveRef = React.useRef(false);
  // Y do toque inicial no obturador (para medir o arraste para cima que trava).
  const shutterStartYRef = React.useRef<number | null>(null);
  const recordLockedRef = React.useRef(false);
  // Após tocar o obturador para PARAR uma gravação travada, ignora o pointerup
  // correspondente para ele não virar um "toque = foto".
  const ignoreNextShutterUpRef = React.useRef(false);
  // Verdadeiro enquanto o usuário mantém o obturador pressionado com intenção de gravar
  const wantRecordingRef = React.useRef(false);
  // O dedo ainda está sobre o obturador? Usado quando a gravação termina sozinha no
  // limite de 1 min: sem isso, ao soltar o dedo o pointerup cairia no ramo "toque = foto"
  // e a foto substituiria o vídeo recém-gravado.
  const shutterPointerDownRef = React.useRef(false);
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
  // ── Lixeira (estilo Instagram, 2026-09-30) ──
  // Enquanto uma frase ou um card (treino/post) é ARRASTADO com um dedo, aparece
  // uma lixeira embaixo, no centro; soltar em cima apaga o elemento. As barras
  // de cima e de baixo somem durante o arraste para a lixeira ficar à vista.
  const [isDraggingItem, setIsDraggingItem] = React.useState(false);
  const [overTrash, setOverTrash] = React.useState(false);
  const overTrashRef = React.useRef(false);
  const trashRef = React.useRef<HTMLDivElement>(null);
  /** Marca o arraste e diz se o dedo (x,y) está sobre a lixeira. */
  const trackTrash = (x: number, y: number) => {
    setIsDraggingItem(true);
    const el = trashRef.current;
    let over = false;
    if (el) {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      // Raio generoso: o dedo cobre o ícone, e mirar exato seria frustrante.
      over = Math.hypot(x - cx, y - cy) < 64;
    }
    if (over !== overTrashRef.current) {
      overTrashRef.current = over;
      setOverTrash(over);
      if (over) hapticLight();
    }
  };
  /** Fim do arraste — devolve true se o elemento foi solto na lixeira. */
  const endTrashDrag = () => {
    const wasOver = overTrashRef.current;
    overTrashRef.current = false;
    setOverTrash(false);
    setIsDraggingItem(false);
    return wasOver;
  };

  // Gesto sobre uma frase já posta: 1 dedo = arrastar, 2 dedos = pinça para
  // redimensionar (fontSize), toque curto = reeditar. Rastreia múltiplos ponteiros
  // no mesmo item, estilo sticker do Instagram.
  const textGestureRef = React.useRef<{
    id: string;
    pointers: Map<number, { x: number; y: number }>;
    // baseline do "sub-gesto" atual (re-ancorado quando o nº de dedos muda)
    anchorX: number;
    anchorY: number;
    origX: number;
    origY: number;
    startDist: number;
    origFontSize: number;
    moved: boolean;
    pinched: boolean;
  } | null>(null);
  // Detecta um "toque" na foto (down+up curto, sem arrastar/pinçar) para abrir
  // um novo texto — mesmo efeito do botão "+ Aa". Invalidado por multitoque ou
  // movimento acima do limite, para não disparar durante ajuste da mídia.
  const mediaTapRef = React.useRef<{ x: number; y: number; t: number } | null>(null);
  // Modo LEGENDA (foto/vídeo): a camada de gestos da mídia é a ÚNICA dona dos gestos.
  // Regra estilo Instagram: se há legenda, o gesto controla a legenda; senão, a mídia.
  // Assim a pinça não "escorrega" para a foto ao sair de cima do texto pequeno.
  const textElsRef = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const capGestureRef = React.useRef<{
    target: "media" | "text";
    textId: string | null;
    origX: number;
    origY: number;
    origFontSize: number;
    anchorX: number;
    anchorY: number;
    startDist: number;
    moved: boolean;
    pinched: boolean;
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
    // O onstop foi anulado acima, então a limpeza do canvas espelhado não roda
    // por aquele caminho — executamos aqui para não vazar o loop de rAF.
    recordCanvasCleanupRef.current?.();
    recordCanvasCleanupRef.current = null;
    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];
    recordingActiveRef.current = false;
    recordLockedRef.current = false;
    shutterStartYRef.current = null;
    setIsRecording(false);
    setIsRecordingLocked(false);
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
    setVideoShown(false);
  }, []);

  const startStream = React.useCallback(async (mode: "user" | "environment") => {
    stopStream();
    setCameraError(null);
    const token = ++streamTokenRef.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw Object.assign(new Error("camera-unsupported"), { name: "NotSupportedError" });
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          // NUNCA pedir enquadramento em retrato (1080x1920) nem `aspectRatio`
          // aqui. O WebKit do iOS não entrega um modo de sensor 9:16: ele pega o
          // preset mais próximo e RECORTA o centro do frame para satisfazer a
          // restrição, reescalando o pedaço de volta para o tamanho pedido. O
          // resultado é a câmera abrindo com um zoom enorme (e mais mole), que
          // foi exatamente o que apareceu quando estas linhas pediam 9:16.
          //
          // Pedimos então o preset landscape padrão (o WebKit já devolve com as
          // dimensões trocadas quando o aparelho está em pé) e deixamos o 9:16
          // para quem de fato precisa dele: `centerCrop`, que recorta o canvas
          // da gravação, e o `object-cover` do preview/viewer. O ganho de
          // nitidez continua valendo — o recorte só saiu do sensor para o
          // canvas.
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: RECORD_FPS },
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
        // O zoom da track não começa necessariamente em 1: em iPhones com
        // câmera virtual (dupla/tripla) o fator nativo de abertura é maior. Se
        // o estado da pinça assumisse 1, o primeiro gesto saltaria o
        // enquadramento para um valor que o usuário nunca escolheu. Lemos o
        // valor corrente da track em vez de forçar um.
        const current = track?.getSettings?.() as any;
        if (typeof current?.zoom === "number" && current.zoom > 0) {
          zoomRef.current = current.zoom;
          setZoom(current.zoom);
        }
      }
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      if (token !== streamTokenRef.current) return;
      setCameraReady(true);
      if (videoRef.current) await waitForFirstVideoFrame(videoRef.current);
      if (token === streamTokenRef.current) setVideoShown(true);
    } catch (err: any) {
      setCameraError(
        err?.name === "NotAllowedError"
          ? "denied"
          : err?.name === "NotSupportedError"
            ? "unsupported"
            : "failed",
      );
    }
  }, [stopStream]);

  // Cada vez que o dialog abre, volta para a câmera frontal — o instance do
  // componente persiste entre aberturas, então sem isto uma troca anterior para
  // a traseira ficaria "grudada" na próxima abertura. (setState com o mesmo valor
  // é no-op no React, então na primeira abertura não reinicia o stream.)
  React.useEffect(() => {
    if (open) setFacingMode("user");
  }, [open]);

  React.useEffect(() => {
    if (open && step === "camera" && !awaitingSeed) {
      startStream(facingMode);
    } else {
      stopStream();
    }
    return () => stopStream();
  }, [open, step, facingMode, startStream, stopStream, awaitingSeed]);

  // Semente (ex.: resumo do treino): abre já na legenda com a mídia pronta.
  React.useEffect(() => {
    if (!awaitingSeed || !seed) return;
    setAppliedSeed(seed);
    if (seed.postSticker) {
      setMediaPreview(null);
      setMediaIsVideo(false);
      setMediaFromGallery(false);
      setWorkoutSticker(null);
      setTexts([]);
      setSelectedGradient(POST_FLOW_BACKGROUND);
      // Mesma posição do flow publicado direto (x 50%, y 46%).
      setPostSticker({
        data: seed.postSticker,
        x: window.innerWidth / 2,
        y: window.innerHeight * 0.46,
        scale: 1,
      });
      setStep("create");
      return;
    }
    if (!seed.mediaUrl) return;
    setPostSticker(null);
    setMediaIsVideo(false);
    setMediaFromGallery(true);
    setMediaPreview(seed.mediaUrl);
    setWorkoutSticker(
      seed.workoutSticker
        ? {
            data: seed.workoutSticker,
            full: seed.workoutSticker,
            // Mais para baixo que o padrão do seletor: a mídia aqui costuma
            // ser uma foto da pessoa, e o card não deve cobrir o rosto.
            x: window.innerWidth / 2,
            y: window.innerHeight * 0.66,
            scale: 0.9,
          }
        : null,
    );
    setStep("caption");
  }, [awaitingSeed, seed]);

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
      // Deixa passar o próprio dialog e qualquer drawer (vaul) por cima dele — ex.:
      // o TagPeopleDrawer de marcação, cuja lista precisa rolar.
      if (!target.closest("[data-flow-dialog-root]") && !target.closest("[data-vaul-drawer]")) {
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
    // Reduz o frame do sensor para o teto de exibição já na captura: sem isso a
    // foto sem pinça/arraste (única que não passa por `bakeTransformedImage`)
    // subiria na resolução crua.
    const captureRatio = Math.min(
      1,
      PHOTO_MAX_DIM / Math.max(video.videoWidth, video.videoHeight),
    );
    canvas.width = Math.round(video.videoWidth * captureRatio);
    canvas.height = Math.round(video.videoHeight * captureRatio);
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
    const dataUrl = canvas.toDataURL("image/jpeg", PHOTO_JPEG_QUALITY);
    setMediaIsVideo(false);
    setMediaFromGallery(false);
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
    recordLockedRef.current = false;
    shutterStartYRef.current = null;
    setIsRecording(false);
    setIsRecordingLocked(false);
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

    // SEMPRE gravamos a partir de um canvas que redesenha o `<video>` a cada
    // frame — nunca a track bruta da câmera direto. Dois motivos:
    //
    // 1. Espelhamento: a câmera frontal mostra a pré-visualização espelhada
    //    (efeito selfie), mas a track bruta não é. Sem o canvas, o vídeo
    //    gravado sairia invertido em relação ao que o usuário viu.
    // 2. Troca de câmera em pleno voo: `handleFlipCamera` troca `facingMode`,
    //    o que reabre `getUserMedia` com um novo device e PÁRA as tracks do
    //    stream antigo (`stopStream`, no efeito que reage a `facingMode`). Se
    //    o MediaRecorder estivesse gravando a track bruta, ela morreria no
    //    meio da gravação e o clipe parava sozinho. O canvas desenha o que
    //    quer que o elemento `<video>` esteja mostrando A CADA MOMENTO — ao
    //    trocar de câmera, o `srcObject` é trocado por baixo, e o canvas
    //    simplesmente passa a desenhar o feed novo no frame seguinte, sem
    //    nunca soltar a track que o `MediaRecorder` está de fato gravando.
    //
    // O espelhamento também precisa reagir à troca: por isso usa
    // `facingModeRef` (lido a cada frame), não o `facingMode` capturado no
    // fechamento do início da gravação — senão um clipe iniciado na frontal
    // continuaria espelhando a traseira depois de trocar.
    recordCanvasCleanupRef.current?.();
    recordCanvasCleanupRef.current = null;
    // Dimensões do que será codificado — alimentam o bitrate lá embaixo.
    let recordWidth = 0;
    let recordHeight = 0;

    if (typeof video.videoWidth === "number" && video.videoWidth > 0) {
      // O canvas sai no enquadramento final (9:16), com a altura limitada pelo
      // MENOR entre 1920 e o recorte disponível na fonte: ampliar não cria
      // detalhe, só gasta bitrate codificando um borrão esticado.
      const baseCrop = centerCrop(video.videoWidth, video.videoHeight, 1);
      const outH = Math.min(RECORD_TARGET_HEIGHT, Math.round(baseCrop.sh));
      // H.264 exige dimensões pares.
      const canvasH = Math.max(2, outH - (outH % 2));
      const wRaw = Math.round(canvasH * RECORD_TARGET_ASPECT);
      const canvasW = Math.max(2, wRaw - (wRaw % 2));

      const canvas = document.createElement("canvas");
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        recordWidth = canvasW;
        recordHeight = canvasH;
        // Reduzir a fonte para o canvas é uma reamostragem — sem isto o WebKit
        // usa o filtro rápido e o resultado sai serrilhado.
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        let rafId = 0;
        const drawFrame = () => {
          if (video.readyState < 2) return;
          const digitalZoom = !nativeZoomRef.current ? zoomRef.current : 1;
          const mirror = facingModeRef.current === "user";
          // Recalculado a cada frame porque a fonte pode trocar de tamanho no
          // meio da gravação (troca de câmera reatribui o srcObject do <video>).
          const { sx, sy, sw, sh } = centerCrop(
            video.videoWidth || canvasW,
            video.videoHeight || canvasH,
            digitalZoom,
          );
          ctx.save();
          if (mirror) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
          }
          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
          ctx.restore();
        };

        // O rAF acompanha o REFRESH DA TELA (60Hz, 120Hz no ProMotion), mas o
        // canvas só é capturado a RECORD_FPS. Sem esta trava o app redesenhava
        // o frame até 4x para cada frame aproveitado — trabalho puro de CPU/GPU
        // que roubava tempo do encoder e da própria pré-visualização, e ajuda a
        // explicar o travamento durante a gravação.
        //
        // O teto é 2x RECORD_FPS, não 1x: o `captureStream` amostra o canvas no
        // relógio DELE, independente do nosso. Desenhando exatamente na mesma
        // taxa, as duas cadências entram em batimento de fase e uma amostragem
        // aqui e ali pega o frame repetido — movimento levemente irregular. Com
        // o dobro, toda amostragem encontra conteúdo novo, e ainda assim corta
        // metade do trabalho num ProMotion.
        const frameInterval = 1000 / (RECORD_FPS * 2);
        let lastDraw = -Infinity;
        const tick = (now: number) => {
          rafId = requestAnimationFrame(tick);
          if (now - lastDraw < frameInterval - 1) return;
          lastDraw = now;
          drawFrame();
        };
        drawFrame();
        rafId = requestAnimationFrame(tick);

        const canvasStream = canvas.captureStream(RECORD_FPS);
        canvasStream.getVideoTracks().forEach((t) => combined.addTrack(t));
        recordCanvasCleanupRef.current = () => {
          cancelAnimationFrame(rafId);
          canvasStream.getTracks().forEach((t) => t.stop());
        };
      }
    }

    // Fallback só para o caso raro de o canvas não ter ficado pronto (sem
    // dimensão do vídeo ainda, ou 2D context indisponível): grava a track
    // bruta. Como essa track morre se o usuário trocar de câmera no meio da
    // gravação (ver comentário acima), esse caminho não sobrevive à troca —
    // mas é essencialmente inatingível em uso normal.
    if (combined.getVideoTracks().length === 0) {
      videoTracks.forEach((t) => combined.addTrack(t));
      const raw = videoTracks[0]?.getSettings?.();
      recordWidth = raw?.width || video.videoWidth || 1080;
      recordHeight = raw?.height || video.videoHeight || RECORD_TARGET_HEIGHT;
    }
    audioStream?.getAudioTracks().forEach((t) => combined.addTrack(t));

    const mimeType = pickVideoMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(combined, {
        ...(mimeType ? { mimeType } : {}),
        ...recorderBitrateFor(recordWidth || 1080, recordHeight || RECORD_TARGET_HEIGHT),
      });
    } catch {
      try {
        recorder = new MediaRecorder(combined);
      } catch {
        recordCanvasCleanupRef.current?.();
        recordCanvasCleanupRef.current = null;
        return;
      }
    }

    recordedChunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      recordCanvasCleanupRef.current?.();
      recordCanvasCleanupRef.current = null;
      const chunks = recordedChunksRef.current;
      recordedChunksRef.current = [];
      if (chunks.length === 0) return;
      const blobType = recorder.mimeType || mimeType || "video/mp4";
      const blob = new Blob(chunks, { type: blobType });
      // Gravação pesada NÃO é descartada: o usuário perderia o que acabou de gravar, e
      // não há como refazer o momento. Com o bitrate por área + 1 min o arquivo fica em
      // até ~45MB (um flow típico, de poucos segundos, fica na casa dos MB); se algum
      // aparelho ignorar o bitrate, o vídeo segue assim mesmo e só avisamos que o envio
      // vai demorar mais.
      if (blob.size > MAX_MEDIA_BYTES) {
        toast({ title: t("flow_video_heavy"), description: t("flow_video_heavy_desc") });
      }
      // Blob URL evita o problema de tela preta que data: URLs causam no WebView do iOS
      const blobUrl = URL.createObjectURL(blob);
      setMediaIsVideo(true);
      setMediaFromGallery(false);
      setMediaPreview(blobUrl);
      setStep("caption");
    };

    mediaRecorderRef.current = recorder;
    try {
      // Timeslice garante emissão periódica de dados (evita blob vazio em gravações curtas)
      recorder.start(100);
    } catch {
      recordCanvasCleanupRef.current?.();
      recordCanvasCleanupRef.current = null;
      return;
    }
    recordingActiveRef.current = true;
    setIsRecording(true);
    setRecordSeconds(0);
    recordTickRef.current = setInterval(() => {
      setRecordSeconds((s) => s + 1);
    }, 1000);
    maxDurationTimerRef.current = setTimeout(() => {
      // Chegou no limite de 1 min: finaliza exatamente como se o usuário tivesse soltado
      // o obturador — o vídeo vai para a etapa de postagem. Nada é descartado.
      // Se o dedo ainda estiver no botão, o pointerup seguinte não pode virar "foto"
      // (isso substituiria o vídeo recém-gravado por uma imagem).
      if (shutterPointerDownRef.current) ignoreNextShutterUpRef.current = true;
      hapticLight();
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
    shutterPointerDownRef.current = true;
    // Um "ignorar" pendente de um ciclo anterior (ex.: a gravação fechou no limite de
    // 1 min e o dedo só saiu depois de a tela trocar) não pode engolir este toque.
    ignoreNextShutterUpRef.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    // Se já está gravando TRAVADO (mãos livres), este toque é para PARAR.
    if (recordLockedRef.current && recordingActiveRef.current) {
      stopRecording();
      ignoreNextShutterUpRef.current = true; // não deixar o up virar "foto"
      return;
    }
    shutterStartYRef.current = e.clientY;
    wantRecordingRef.current = false;
    // Após o limite de tempo segurando, inicia a gravação de vídeo
    if (typeof MediaRecorder !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      holdTimerRef.current = setTimeout(() => {
        wantRecordingRef.current = true;
        startRecording();
      }, LONG_PRESS_MS);
    }
  };

  const handleShutterPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Enquanto grava (e ainda não travou), arrastar para cima além do limite trava
    // a gravação — o usuário pode soltar o dedo que a gravação continua.
    if (!recordingActiveRef.current || recordLockedRef.current) return;
    const startY = shutterStartYRef.current;
    if (startY == null) return;
    if (startY - e.clientY > LOCK_DRAG_THRESHOLD) {
      recordLockedRef.current = true;
      setIsRecordingLocked(true);
    }
  };

  const handleShutterPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    shutterPointerDownRef.current = false;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    // Up correspondente ao toque que parou uma gravação travada → não faz nada.
    if (ignoreNextShutterUpRef.current) {
      ignoreNextShutterUpRef.current = false;
      return;
    }
    // Gravação travada: soltar o dedo NÃO para — continua mãos livres.
    if (recordLockedRef.current) {
      return;
    }
    if (recordingActiveRef.current) {
      // Estava gravando (sem travar) → soltar finaliza o vídeo
      stopRecording();
    } else if (wantRecordingRef.current) {
      // Passou do limite mas o gravador ainda estava iniciando → aborta
      wantRecordingRef.current = false;
    } else {
      // Toque rápido → foto
      handleCapture();
    }
  };

  // Encerra o estado "preparando" e cancela a rede de segurança.
  const finishPreparing = React.useCallback(() => {
    if (prepareSafetyRef.current) {
      clearTimeout(prepareSafetyRef.current);
      prepareSafetyRef.current = null;
    }
    setIsPreparingMedia(false);
  }, []);

  // Galeria do celular DIRETO (2026-09-30): no app nativo, o seletor da
  // Fototeca do iOS (PHPicker — não pede acesso à biblioteca inteira). O
  // `<input type="file">` abria antes uma folha com "Fototeca / Tirar foto /
  // Escolher arquivo"; ele fica só como reserva para o navegador de dev e para
  // build sem o plugin.
  //
  // 2026-10-01: o seletor agora é o do NOSSO plugin (`pickGalleryMedia`). O
  // `PhotoLibrary.pickMedia` do @capgo perdia todo VÍDEO (copiava o arquivo
  // temporário depois de o iOS apagá-lo) e devolvia lista vazia — o código abaixo
  // lia isso como "cancelou", e o vídeo nunca carregava. O do @capgo ficou só
  // como reserva para binário sem o método novo.
  const openGallery = async () => {
    if (!Capacitor.isNativePlatform()) {
      fileInputRef.current?.click();
      return;
    }
    try {
      const file = await pickGalleryMedia();
      if (file) processPickedFile(file);
      return;
    } catch (err: any) {
      if (/in progress/i.test(String(err?.message ?? ""))) return;
      if (err?.code !== "UNIMPLEMENTED") {
        reportHandledError(err, "flow-creation:pick-gallery-media");
        toast({ title: t("flow_pick_media_error"), description: t("retry"), variant: "destructive" });
        return;
      }
      // Binário sem `EditedMedia.pickMedia` → seletor do @capgo (abaixo).
    }
    let picked;
    try {
      picked = await PhotoLibrary.pickMedia({
        selectionLimit: 1,
        includeImages: true,
        includeVideos: true,
      });
    } catch (err: any) {
      // Plugin ausente no binário → cai no seletor do sistema de antes.
      if (err?.code === "UNIMPLEMENTED") {
        fileInputRef.current?.click();
        return;
      }
      // Cancelar resolve com lista vazia (tratado abaixo); "already in
      // progress" é toque duplo no botão com o seletor abrindo — nenhum é erro.
      if (/cancel|in progress/i.test(String(err?.message ?? ""))) return;
      reportHandledError(err, "flow-creation:pick-media");
      toast({ title: t("flow_pick_media_error"), description: t("retry"), variant: "destructive" });
      return;
    }
    const asset = picked?.assets?.[0];
    const src = asset?.file?.webPath;
    if (!asset || !src) return; // cancelou
    try {
      const blob = await (await fetch(src)).blob();
      // Tipo explícito: o Blob lido do arquivo nativo pode vir com `.type`
      // vazio no WKWebView, e sem ele o vídeo seria tratado como imagem (mesmo
      // bug já corrigido no upload — ver flow-gallery-video-mimetype-bug).
      const type =
        asset.mimeType || blob.type || (asset.type === "video" ? "video/mp4" : "image/jpeg");
      const name = asset.fileName || (asset.type === "video" ? "flow.mp4" : "flow.jpg");
      processPickedFile(new File([blob], name, { type }));
    } catch (err) {
      reportHandledError(err, "flow-creation:read-picked-media");
      toast({ title: t("flow_pick_media_error"), description: t("retry"), variant: "destructive" });
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    processPickedFile(file);
  };

  // Foto/vídeo escolhido (seletor nativo ou `<input>`) → etapa de legenda.
  const processPickedFile = (file: File) => {
    if (file.size > MAX_MEDIA_BYTES) {
      toast({
        title: t("flow_file_too_large"),
        description: t("flow_file_too_large_desc"),
        variant: "destructive",
      });
      return;
    }

    // Indicador de "preparando" — fica visível durante TODA a preparação (ler metadata
    // + decodificar o 1º frame), some quando o preview de fato aparece, é rejeitado ou
    // dá erro. Para vídeo, quem o encerra é o `onLoadedData` do <video> do preview.
    setIsPreparingMedia(true);
    if (prepareSafetyRef.current) clearTimeout(prepareSafetyRef.current);
    // Vídeo tem prazo bem maior: além de ler metadata, ele é reencodado para
    // 720p (`compressVideoBlob`), o que processa o clipe inteiro e pode passar
    // de um minuto. Com os 25s da foto, o indicador sumia no meio da conversão
    // e a tela parecia travada.
    prepareSafetyRef.current = setTimeout(
      () => {
        prepareSafetyRef.current = null;
        setIsPreparingMedia(false);
      },
      file.type.startsWith("video/") ? 180000 : 25000,
    );

    if (file.type.startsWith("video/")) {
      // Vídeo → Blob URL (não data URL): data URL de um vídeo grande vira uma string
      // base64 ~33% maior, estoura memória no WebView do iOS e causa tela preta. O
      // Blob URL é revogado em handleRetake/resetForm (que checam o prefixo blob:).
      const blobUrl = URL.createObjectURL(file);
      // Sonda a duração antes de aceitar — mantém o flow em até 1 min.
      const probe = document.createElement("video");
      probe.preload = "metadata";
      let settled = false;
      const accept = async () => {
        if (settled) return;
        settled = true;
        clearTimeout(safety);
        // Reencoda para 720p ANTES de virar preview: o vídeo GRAVADO no app já
        // sai no bitrate por área (`recorderBitrateFor`), mas o importado da galeria
        // subia cru — e virou o maior consumidor de Storage do app. Comprimir
        // aqui, e não no upload, também deixa o preview ser exatamente o
        // arquivo que será publicado. Devolve o original se não der para
        // comprimir, então nunca bloqueia a publicação.
        const compressed = await compressVideoBlob(file);
        // O Blob que volta de `compressVideoBlob` (via fetch do arquivo nativo
        // reencodado) não chega sempre com `.type` = "video/mp4" — no WKWebView
        // isso pode vir vazio dependendo da versão do iOS. Sem essa reembalagem,
        // `handleCreateStory` (Index.tsx) cai no fallback `blob.type || "image/jpeg"`
        // — pensado para posts sem foto — e sobe o vídeo com extensão/content-type
        // de IMAGEM: o flow publica, mas o viewer não reconhece a URL como vídeo e
        // não mostra nada. Mesma reembalagem já usada em NewPost.tsx para os dois
        // caminhos que passam por `compressVideoBlob`/`getCompressedVideoUrl`.
        const finalBlob =
          compressed === file
            ? file
            : new File([compressed], `${file.name.replace(/\.[^.]+$/, "")}.mp4`, {
                type: compressed.type || "video/mp4",
              });
        const previewUrl = finalBlob === file ? blobUrl : URL.createObjectURL(finalBlob);
        if (previewUrl !== blobUrl) URL.revokeObjectURL(blobUrl);
        // NÃO encerra o indicador aqui: mantém até o <video> do preview decodificar o
        // 1º frame (onLoadedData → finishPreparing), senão pisca um frame preto.
        setMediaIsVideo(true);
        setMediaFromGallery(true);
        setMediaPreview(previewUrl);
        setStep("caption");
      };
      const reject = (title: string, description: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(safety);
        finishPreparing();
        URL.revokeObjectURL(blobUrl);
        toast({ title, description, variant: "destructive" });
      };
      probe.onloadedmetadata = () => {
        if (Number.isFinite(probe.duration) && probe.duration > MAX_VIDEO_DURATION_S + 1) {
          reject(t("flow_video_too_long"), t("flow_video_too_long_desc"));
          return;
        }
        accept();
      };
      // Se o WebView não conseguir ler a metadata, segue mesmo assim (o limite de
      // tamanho já protege) em vez de travar o usuário.
      probe.onerror = () => accept();
      // Rede de segurança: se a metadata demorar demais (vídeo grande com moov no
      // fim), aceita mesmo assim para o indicador nunca ficar preso.
      const safety = setTimeout(() => accept(), 20000);
      probe.src = blobUrl;
      return;
    }

    // Imagem → data URL (leve; o pipeline de imagem compõe o enquadramento num canvas
    // a partir dessa URL).
    const reader = new FileReader();
    reader.onload = (e) => {
      // Imagem não tem "1º frame" a esperar → encerra o indicador direto.
      finishPreparing();
      setMediaIsVideo(false);
      setMediaFromGallery(true);
      setMediaPreview(e.target?.result as string);
      setStep("caption");
    };
    reader.onerror = () => {
      finishPreparing();
      toast({
        title: t("flow_image_open_error"),
        description: t("retry"),
        variant: "destructive",
      });
    };
    reader.readAsDataURL(file);
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
    capGestureRef.current = null;
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

  // Qual frase está sob o ponto (x,y) na tela — topmost primeiro (última renderizada).
  const hitTestCaptionText = (x: number, y: number): string | null => {
    for (let i = texts.length - 1; i >= 0; i--) {
      const el = textElsRef.current.get(texts[i].id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      // margem de 12px para facilitar acertar textos pequenos
      if (x >= r.left - 12 && x <= r.right + 12 && y >= r.top - 12 && y <= r.bottom + 12) {
        return texts[i].id;
      }
    }
    return null;
  };

  // (Re)ancora a baseline do sub-gesto atual — chamado quando o nº de dedos muda.
  const rebaseCaptionGesture = () => {
    const g = capGestureRef.current;
    if (!g) return;
    if (g.target === "media") {
      beginMediaGesture();
      return;
    }
    const item = texts.find((t) => t.id === g.textId);
    if (!item) return;
    const pts = Array.from(pointersRef.current.values());
    g.origX = item.x;
    g.origY = item.y;
    g.origFontSize = item.style.fontSize;
    if (pts.length >= 2) {
      g.startDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
    } else if (pts.length === 1) {
      g.anchorX = pts[0].x;
      g.anchorY = pts[0].y;
    }
  };

  const handleMediaPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Um card (treino/post) já está sendo tocado: este dedo, mesmo caindo na
    // foto, é o 2º dedo da pinça DO CARD. Sem isto a foto abria um gesto
    // próprio e pinçar o card mexia os dois (mesma regra da legenda: quem é
    // tocado primeiro é o dono do gesto).
    const sg = stickerGestureRef.current;
    if (sg) {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      sg.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      rebaseStickerGesture();
      return;
    }
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // No 1º dedo, decide o alvo do gesto (regra Instagram): há legenda → controla a
    // legenda (a que está sob o dedo, senão a última); sem legenda → controla a mídia.
    if (pointersRef.current.size === 1) {
      mediaTapRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
      if (texts.length > 0) {
        const overId = hitTestCaptionText(e.clientX, e.clientY);
        capGestureRef.current = {
          target: "text",
          textId: overId ?? texts[texts.length - 1].id,
          origX: 0, origY: 0, origFontSize: 0,
          anchorX: 0, anchorY: 0, startDist: 0,
          moved: false, pinched: false,
        };
      } else {
        capGestureRef.current = {
          target: "media", textId: null,
          origX: 0, origY: 0, origFontSize: 0,
          anchorX: 0, anchorY: 0, startDist: 0,
          moved: false, pinched: false,
        };
      }
    } else {
      // multitoque cancela o toque (vira pinça)
      mediaTapRef.current = null;
    }
    rebaseCaptionGesture();
  };

  const handleMediaPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickerGestureRef.current?.pointers.has(e.pointerId)) {
      handleStickerPointerMove(e);
      return;
    }
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // Movimento acima do limite deixa de ser toque e vira arraste/pinça.
    const tap = mediaTapRef.current;
    if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 8) {
      mediaTapRef.current = null;
    }
    const g = capGestureRef.current;
    if (!g) return;
    const pts = Array.from(pointersRef.current.values());

    if (g.target === "text") {
      const id = g.textId;
      if (pts.length >= 2) {
        // Pinça → só o fontSize da legenda muda (a foto fica parada).
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const ratio = g.startDist ? dist / g.startDist : 1;
        const newSize = Math.round(
          Math.min(MAX_CAPTION_FONT, Math.max(MIN_CAPTION_FONT, g.origFontSize * ratio)),
        );
        g.pinched = true;
        setTexts((prev) => prev.map((t) => (t.id === id ? { ...t, style: { ...t.style, fontSize: newSize } } : t)));
      } else {
        // Um dedo → move só a legenda.
        const dx = pts[0].x - g.anchorX;
        const dy = pts[0].y - g.anchorY;
        if (!g.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) g.moved = true;
        if (g.moved) {
          const nx = g.origX + dx;
          const ny = g.origY + dy;
          setTexts((prev) => prev.map((t) => (t.id === id ? { ...t, x: nx, y: ny } : t)));
          trackTrash(pts[0].x, pts[0].y);
        }
      }
      return;
    }

    // target === "media" — reenquadra a foto/vídeo (só quando não há legenda).
    const start = gestureStartRef.current;
    if (!start) return;
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
    if (stickerGestureRef.current?.pointers.has(e.pointerId)) {
      handleStickerPointerUp(e);
      return;
    }
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.delete(e.pointerId);
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    }
    if (pointersRef.current.size > 0) {
      // Ainda há dedo(s) — re-ancora para o próximo sub-gesto (ex.: 2→1).
      rebaseCaptionGesture();
      return;
    }
    // Solta na lixeira → apaga a legenda que estava sendo arrastada.
    const endedGesture = capGestureRef.current;
    if (endTrashDrag() && endedGesture?.target === "text" && endedGesture.textId) {
      const deadId = endedGesture.textId;
      setTexts((prev) => prev.filter((t) => t.id !== deadId));
      mediaTapRef.current = null;
      capGestureRef.current = null;
      gestureStartRef.current = null;
      return;
    }
    // Gesto encerrado. Toque curto sem arraste/pinça: sobre uma legenda → reedita;
    // em área vazia → abre um novo texto (igual ao "+ Aa").
    const tap = mediaTapRef.current;
    mediaTapRef.current = null;
    capGestureRef.current = null;
    gestureStartRef.current = null;
    if (tap && !isEditingText && Date.now() - tap.t < 300) {
      const hitId = hitTestCaptionText(tap.x, tap.y);
      if (hitId) {
        const item = texts.find((t) => t.id === hitId);
        if (item) beginEditText(item);
      } else {
        beginNewText();
      }
    }
  };

  const handleRetake = () => {
    setMediaPreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    setMediaIsVideo(false);
    setMediaFromGallery(false);
    setDescription("");
    setTaggedUsers([]);
    setPinOnPost(null);
    setWorkoutSticker(null);
    setPostSticker(null);
    setTexts([]);
    setEditingId(null);
    setEditingValue("");
    setStep("camera");
  };

  /**
   * Compõe o rascunho exatamente como aparece na tela: a mídia já enquadrada
   * (ou o gradiente do modo texto) com as frases desenhadas por cima.
   * Devolve `null` quando a composição falha — o chamador avisa o usuário.
   */
  const buildDraftCanvas = async (): Promise<HTMLCanvasElement | null> => {
    const drawables: DrawableText[] = texts.map((item) => ({
      text: item.text,
      x: item.x,
      y: item.y,
      style: item.style,
    }));
    // O mini frame de treino também entra no rascunho, no mesmo lugar/tamanho
    // do preview (os textos dele chegam prontos — o desenho não tem `t()`).
    const drawableSticker: DrawableSticker | null = workoutSticker
      ? {
          data: workoutSticker.data,
          x: workoutSticker.x,
          y: workoutSticker.y,
          scale: workoutSticker.scale,
          labels: {
            title: t("flow_workout_sticker_label"),
            series: t("flow_workout_series"),
            prs: t("flow_workout_prs"),
            more: t("flow_workout_more_exercises").replace(
              "{n}",
              String(workoutSticker.data.extraCount ?? 0),
            ),
            date: isStickerFieldShown(workoutSticker.data, "date")
              ? formatStickerDate(
                  workoutSticker.data.date,
                  t("flow_workout_today"),
                  t("flow_workout_yesterday"),
                )
              : "",
          },
        }
      : null;

    if (step === "create") {
      // Modo texto: o gradiente ocupa a tela toda, então o frame é a viewport.
      const fw = window.innerWidth;
      const fh = window.innerHeight;
      const maxDim = 1280;
      const canvas = document.createElement("canvas");
      canvas.width = fw >= fh ? maxDim : Math.round(maxDim * (fw / fh));
      canvas.height = fw >= fh ? Math.round(maxDim * (fh / fw)) : maxDim;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      paintCssGradient(ctx, selectedGradient, canvas.width, canvas.height);
      drawTextsOnCanvas(ctx, drawables, fw, canvas.width / fw);
      if (drawableSticker) drawWorkoutStickerOnCanvas(ctx, drawableSticker, canvas.width / fw);
      return canvas;
    }

    if (!mediaPreview || mediaIsVideo) return null;

    const frame = captionFrameRef.current;
    const fw = frame?.clientWidth || window.innerWidth;
    const fh = frame?.clientHeight || window.innerHeight;
    // Sempre recompõe (mesmo sem pinça/arraste): o rascunho precisa sair no
    // frame 9:16 com o fundo desfocado, como o usuário está vendo.
    const canvas = await bakeTransformedCanvas(
      mediaPreview,
      fw,
      fh,
      transformRef.current,
      mediaFromGallery ? "contain" : "cover",
    );
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      drawTextsOnCanvas(ctx, drawables, fw, canvas.width / fw);
      if (drawableSticker) drawWorkoutStickerOnCanvas(ctx, drawableSticker, canvas.width / fw);
    }
    return canvas;
  };

  const handleSaveDraft = async () => {
    if (isSavingDraft) return;
    setIsSavingDraft(true);
    try {
      if (step === "caption" && mediaIsVideo && mediaPreview) {
        // Vídeo não pode ser recomposto no cliente: salva o arquivo como está
        // (sem as frases sobrepostas — o toast avisa).
        const blob = await fetch(mediaPreview).then((r) => r.blob());
        await saveMediaToPhotos(blob, "video");
        toast({ title: t("flow_draft_saved"), description: t("flow_draft_saved_video") });
        return;
      }

      const canvas = await buildDraftCanvas();
      if (!canvas) throw new Error("compose-failed");
      await saveMediaToPhotos(await canvasToBlob(canvas), "image");
      toast({ title: t("flow_draft_saved"), description: t("flow_draft_saved_photo") });
    } catch (err) {
      const reason = err instanceof SaveMediaError ? err.reason : "unknown";
      toast({
        title:
          reason === "permission"
            ? t("flow_draft_permission")
            : reason === "unsupported"
              ? t("flow_draft_unsupported")
              : t("flow_draft_error"),
        description:
          reason === "permission"
            ? t("flow_draft_permission_desc")
            : reason === "unsupported"
              ? t("flow_draft_unsupported_desc")
              : t("flow_draft_error_desc"),
        variant: "destructive",
      });
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Botão de salvar rascunho — mesmo visual nas duas etapas de compartilhar.
  const saveDraftButton = (
    <button
      onClick={(e) => {
        e.stopPropagation();
        handleSaveDraft();
      }}
      disabled={isSavingDraft || isSubmitting || isLoading}
      // Ícone na barra de cima (2026-09-30); antes era um 2º botão largo no
      // rodapé, competindo com "Compartilhar flow".
      className="h-11 w-11 shrink-0 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white active:scale-95 transition-transform disabled:opacity-50"
      aria-label={isSavingDraft ? t("flow_save_draft_saving") : t("flow_save_draft")}
    >
      {isSavingDraft ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <Download className="h-5 w-5" />
      )}
    </button>
  );

  // Chip "Fixar no perfil" — mesmo componente nas duas telas de publicar (mídia
  // e texto). Ligado: âmbar com o nome escolhido (ou "Fixado no perfil").
  const pinChip = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setPinDrawerOpen(true);
      }}
      aria-pressed={!!pinOnPost}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 h-9 px-3.5 rounded-full border text-[13px] font-semibold backdrop-blur active:scale-95 transition-transform",
        pinOnPost
          ? "border-amber-300/60 bg-amber-400/20 text-amber-200"
          : "border-white/20 bg-black/40 text-white/85",
      )}
    >
      <Pin className="h-4 w-4 shrink-0" fill={pinOnPost ? "currentColor" : "none"} />
      <span className="truncate">
        {pinOnPost ? (pinOnPost.title || t("flow_pin_chip_on")) : t("flow_pin_action")}
      </span>
    </button>
  );

  /**
   * Elementos sobrepostos que vao para `flow.text_elements`: as frases e, se
   * houver, o mini frame do treino citado. Tudo em % da viewport, para o viewer
   * reposicionar em qualquer aparelho.
   */
  const buildElementsPayload = (): StoryTextElement[] | null => {
    const els: StoryTextElement[] = [];
    // Moldura do post primeiro: fica embaixo das frases e do treino no viewer.
    if (postSticker) {
      els.push({
        kind: "post",
        text: "",
        x: Math.round((postSticker.x / window.innerWidth) * 1000) / 10,
        y: Math.round((postSticker.y / window.innerHeight) * 1000) / 10,
        scale: Math.round(postSticker.scale * 100) / 100,
        post: postSticker.data,
      });
    }
    for (const item of texts) {
      els.push({
        text: item.text,
        x: Math.round((item.x / window.innerWidth) * 1000) / 10,
        y: Math.round((item.y / window.innerHeight) * 1000) / 10,
        style: item.style,
      });
    }
    if (workoutSticker) {
      els.push({
        kind: "workout",
        text: "",
        x: Math.round((workoutSticker.x / window.innerWidth) * 1000) / 10,
        y: Math.round((workoutSticker.y / window.innerHeight) * 1000) / 10,
        scale: Math.round(workoutSticker.scale * 100) / 100,
        workout: workoutSticker.data,
      });
    }
    return els.length > 0 ? els : null;
  };

  const handleSubmitMedia = async () => {
    if (!mediaPreview) return;
    setIsSubmitting(true);
    try {
      let mediaToShare = mediaPreview;
      let mediaTransformPayload: MediaTransform | null = null;
      const tf = transformRef.current;
      const frame = captionFrameRef.current;
      const fw = frame?.clientWidth || window.innerWidth;
      const fh = frame?.clientHeight || window.innerHeight;
      // Enquadramento em % (translate relativo ao tamanho do elemento → resolução-independente)
      const percentTransform: MediaTransform = {
        scale: Math.round(tf.scale * 1000) / 1000,
        x: Math.round((tf.x / fw) * 1000) / 10,
        y: Math.round((tf.y / fh) * 1000) / 10,
      };
      if (mediaIsVideo) {
        // Vídeo não pode ser recomposto no cliente → persiste o enquadramento (só
        // quando houve pinça/arraste; sem transform o viewer usa object-cover puro).
        if (isMediaTransformed(tf)) mediaTransformPayload = percentTransform;
      } else if (mediaFromGallery) {
        // Imagem da galeria: SEMPRE compõe no frame 9:16 (imagem inteira via "contain"
        // + fundo desfocado nas bordas), mesmo sem pinça/zoom. Assim o resultado postado
        // é idêntico ao preview e nada é cortado — o viewer só dá object-cover sobre um
        // frame que já tem o aspecto certo. Se a composição falhar, cai para o original.
        const baked = await bakeTransformedImage(mediaPreview, fw, fh, tf, "contain");
        if (baked) {
          mediaToShare = baked;
        } else if (isMediaTransformed(tf)) {
          mediaTransformPayload = percentTransform;
        }
      } else if (isMediaTransformed(tf)) {
        // Imagem da câmera: full-bleed (object-cover). Só recompõe se houve pinça/arraste;
        // sem transform o original já preenche a tela via object-cover no viewer.
        const baked = await bakeTransformedImage(mediaPreview, fw, fh, tf, "cover");
        if (baked) {
          mediaToShare = baked;
        } else {
          mediaTransformPayload = percentTransform;
        }
      }
      // Frases e mini frame de treino posicionados sobre a foto (renderizados ao
      // vivo no FlowViewer, mantendo tudo nítido — não são "queimados" na imagem)
      const elementsPercent = buildElementsPayload();
      await onCreateStory(mediaToShare, description, null, null, elementsPercent, mediaTransformPayload, taggedUsers.map((u) => u.id), pinOnPost);
      resetForm();
      onOpenChange(false);
      toast({
        title: t("flow_created"),
        description: t("flow_created_desc"),
      });
    } catch (err: any) {
      toast({
        title: t("flow_create_error"),
        description: err?.message || t("retry"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitCreate = async () => {
    if (texts.length === 0 && !workoutSticker && !postSticker) {
      toast({
        title: t("flow_add_phrase_required"),
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const elementsPercent = buildElementsPayload();
      const joinedDescription =
        texts.length > 0
          ? texts.map((t) => t.text).join("\n")
          : (workoutSticker?.data.name ?? "");
      await onCreateStory("", joinedDescription, selectedGradient, null, elementsPercent, null, taggedUsers.map((u) => u.id), pinOnPost);
      resetForm();
      onOpenChange(false);
      toast({
        title: t("flow_created"),
        description: t("flow_created_desc"),
      });
    } catch (err: any) {
      toast({
        title: t("flow_create_error"),
        description: err?.message || t("retry"),
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
    setMediaFromGallery(false);
    if (prepareSafetyRef.current) {
      clearTimeout(prepareSafetyRef.current);
      prepareSafetyRef.current = null;
    }
    setIsPreparingMedia(false);
    setIsSavingDraft(false);
    setDescription("");
    setTaggedUsers([]);
    setPinOnPost(null);
    setWorkoutSticker(null);
    setPostSticker(null);
    setSelectedGradient(GRADIENT_PRESETS[0].value);
    setTexts([]);
    setEditingId(null);
    setEditingValue("");
    setEditingStyle(DEFAULT_TEXT_STYLE);
    setIsRecording(false);
    setIsRecordingLocked(false);
    recordLockedRef.current = false;
    shutterStartYRef.current = null;
    ignoreNextShutterUpRef.current = false;
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

  // Re-ancora o sub-gesto quando o número de dedos muda (1↔2), usando a posição/
  // tamanho ATUAIS do item para não dar salto ao acrescentar/tirar um dedo.
  const rebaseTextGesture = (item: TextItem) => {
    const g = textGestureRef.current;
    if (!g) return;
    const pts = Array.from(g.pointers.values());
    g.origX = item.x;
    g.origY = item.y;
    g.origFontSize = item.style.fontSize;
    if (pts.length >= 2) {
      g.startDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
    } else if (pts.length === 1) {
      g.anchorX = pts[0].x;
      g.anchorY = pts[0].y;
    }
  };

  const handleTextPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    item: TextItem,
  ) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    let g = textGestureRef.current;
    if (!g || g.id !== item.id) {
      g = {
        id: item.id,
        pointers: new Map(),
        anchorX: 0,
        anchorY: 0,
        origX: item.x,
        origY: item.y,
        startDist: 0,
        origFontSize: item.style.fontSize,
        moved: false,
        pinched: false,
      };
      textGestureRef.current = g;
    }
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    rebaseTextGesture(item);
  };

  const handleTextPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = textGestureRef.current;
    if (!g || !g.pointers.has(e.pointerId)) return;
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = Array.from(g.pointers.values());
    if (pts.length >= 2) {
      // Pinça → escala o fontSize pela razão de distância entre os dois dedos.
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const ratio = g.startDist ? dist / g.startDist : 1;
      const newSize = Math.round(
        Math.min(MAX_CAPTION_FONT, Math.max(MIN_CAPTION_FONT, g.origFontSize * ratio)),
      );
      g.pinched = true;
      setTexts((prev) =>
        prev.map((t) =>
          t.id === g.id ? { ...t, style: { ...t.style, fontSize: newSize } } : t,
        ),
      );
    } else {
      // Um dedo → arrasta a posição.
      const dx = pts[0].x - g.anchorX;
      const dy = pts[0].y - g.anchorY;
      if (!g.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) g.moved = true;
      if (g.moved) {
        const newX = g.origX + dx;
        const newY = g.origY + dy;
        setTexts((prev) =>
          prev.map((t) => (t.id === g.id ? { ...t, x: newX, y: newY } : t)),
        );
        trackTrash(pts[0].x, pts[0].y);
      }
    }
  };

  const handleTextPointerUp = (
    e: React.PointerEvent<HTMLDivElement>,
    item: TextItem,
  ) => {
    const g = textGestureRef.current;
    if (!g || !g.pointers.has(e.pointerId)) return;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    g.pointers.delete(e.pointerId);
    if (g.pointers.size > 0) {
      // Ainda há dedo(s) na tela — re-ancora para o próximo sub-gesto (ex.: 2→1).
      rebaseTextGesture(item);
      return;
    }
    const wasTap = !g.moved && !g.pinched;
    textGestureRef.current = null;
    // Solta na lixeira → apaga a frase.
    if (endTrashDrag()) {
      setTexts((prev) => prev.filter((t) => t.id !== item.id));
      return;
    }
    if (wasTap) beginEditText(item);
  };

  /* ── Gestos do mini frame de treino ───────────────────────────────────────
     O sticker fica ACIMA da camada de gestos da mídia e trata os próprios
     ponteiros (1 dedo arrasta, 2 pinçam) — por isso arrastá-lo nunca reenquadra
     a foto nem cria uma frase nova. */
  type StickerTarget = "workout" | "post";
  const stickerGestureRef = React.useRef<{
    target: StickerTarget;
    pointers: Map<number, { x: number; y: number }>;
    origX: number;
    origY: number;
    origScale: number;
    anchorX: number;
    anchorY: number;
    startDist: number;
  } | null>(null);

  // A moldura do post segue as mesmas regras de gesto do mini frame de treino.
  const stickerOf = (target: StickerTarget) => (target === "post" ? postSticker : workoutSticker);
  const patchSticker = (target: StickerTarget, patch: { x?: number; y?: number; scale?: number }) => {
    if (target === "post") setPostSticker((prev) => (prev ? { ...prev, ...patch } : prev));
    else setWorkoutSticker((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const rebaseStickerGesture = () => {
    const g = stickerGestureRef.current;
    const current = g ? stickerOf(g.target) : null;
    if (!g || !current) return;
    const pts = Array.from(g.pointers.values());
    g.origX = current.x;
    g.origY = current.y;
    g.origScale = current.scale;
    if (pts.length >= 2) {
      g.startDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
    } else if (pts.length === 1) {
      g.anchorX = pts[0].x;
      g.anchorY = pts[0].y;
    }
  };

  const handleStickerPointerDown = (target: StickerTarget) => (e: React.PointerEvent<HTMLDivElement>) => {
    const current = stickerOf(target);
    if (!current) return;
    e.stopPropagation();
    // O inverso: a foto (ou uma legenda) já está sendo mexida e o 2º dedo
    // caiu no card — ele pertence ao gesto que já começou, não ao card.
    if (!stickerGestureRef.current && pointersRef.current.size > 0) {
      handleMediaPointerDown(e);
      return;
    }
    let g = stickerGestureRef.current;
    // Um dedo em cada card não vira pinça entre os dois: o gesto é de quem
    // foi tocado primeiro.
    if (g && g.target !== target) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    if (!g) {
      g = {
        target,
        pointers: new Map(),
        origX: current.x,
        origY: current.y,
        origScale: current.scale,
        anchorX: 0,
        anchorY: 0,
        startDist: 0,
      };
      stickerGestureRef.current = g;
    }
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    rebaseStickerGesture();
  };

  const handleStickerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = stickerGestureRef.current;
    if (!g || !g.pointers.has(e.pointerId)) {
      // Dedo que o card repassou para o gesto da foto/legenda.
      if (pointersRef.current.has(e.pointerId)) {
        e.stopPropagation();
        handleMediaPointerMove(e);
      }
      return;
    }
    e.stopPropagation();
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = Array.from(g.pointers.values());
    if (pts.length >= 2) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const ratio = g.startDist ? dist / g.startDist : 1;
      const nextScale = Math.min(
        MAX_STICKER_SCALE,
        Math.max(MIN_STICKER_SCALE, g.origScale * ratio),
      );
      patchSticker(g.target, { scale: nextScale });
    } else {
      const nx = g.origX + (pts[0].x - g.anchorX);
      const ny = g.origY + (pts[0].y - g.anchorY);
      patchSticker(g.target, { x: nx, y: ny });
      // Só depois de um arraste de verdade (> 4px): encostar no card para
      // tocar nos botões dele não deve mostrar a lixeira.
      if (Math.hypot(pts[0].x - g.anchorX, pts[0].y - g.anchorY) > 4 || isDraggingItem) {
        trackTrash(pts[0].x, pts[0].y);
      }
    }
  };

  const handleStickerPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = stickerGestureRef.current;
    if (!g || !g.pointers.has(e.pointerId)) {
      if (pointersRef.current.has(e.pointerId)) {
        e.stopPropagation();
        handleMediaPointerUp(e);
      }
      return;
    }
    e.stopPropagation();
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    g.pointers.delete(e.pointerId);
    if (g.pointers.size > 0) {
      rebaseStickerGesture();
      return;
    }
    stickerGestureRef.current = null;
    // Solta na lixeira → tira o card do flow.
    if (endTrashDrag()) {
      if (g.target === "post") setPostSticker(null);
      else setWorkoutSticker(null);
    }
  };

  // Escolha no drawer → o mini frame nasce um pouco abaixo do centro (onde não
  // cobre o rosto da selfie nem a descrição), pronto para ser arrastado.
  // Reedição (botão de ajustes no sticker) mantém posição e tamanho.
  const handlePickWorkout = ({ full, hidden }: WorkoutStickerChoice) => {
    const data = applyStickerFields(full, hidden);
    setWorkoutSticker((prev) =>
      prev && workoutPickerEditing
        ? { ...prev, data, full }
        : {
            data,
            full,
            x: window.innerWidth / 2,
            y: window.innerHeight * 0.45,
            scale: 1,
          },
    );
  };

  const openWorkoutPicker = (editing: boolean) => {
    hapticLight();
    setWorkoutPickerEditing(editing);
    setWorkoutPickerOpen(true);
  };

  const handleClose = () => {
    stopStream();
    resetForm();
    onOpenChange(false);
  };

  // Descrição do rodapé: começa numa linha e cresce com o texto até o max-h da
  // classe (o espelho do HighlightTextarea acompanha: é `absolute inset-0`).
  React.useLayoutEffect(() => {
    const el = descriptionRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [description, step]);

  // ── Botões redondos das barras (todos 44px — mínimo de toque da HIG) ──
  const ICON_BTN =
    "h-11 w-11 shrink-0 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white active:scale-95 transition-transform disabled:opacity-50";

  // Conteúdo que o "voltar" do modo texto apagaria.
  const hasTextContent = texts.length > 0 || !!workoutSticker || !!postSticker;

  // Sai do modo texto de verdade (depois da confirmação, se havia conteúdo).
  const leaveTextMode = () => {
    // Veio de um post ("Editar antes de postar"): voltar para a câmera não faz
    // sentido — desiste do flow.
    if (postSticker) {
      handleClose();
      return;
    }
    setStep("camera");
    setTexts([]);
    setWorkoutSticker(null);
    setEditingId(null);
    setEditingValue("");
  };

  const requestLeaveText = () => {
    if (hasTextContent) setDiscardAsk("text");
    else leaveTextMode();
  };

  // ── Controles de estilo de texto (compartilhados: modo texto e legenda) ──
  // Topo: alinhamento (um botão que alterna), fundo do texto e "Pronto".
  // Cores e fontes ficam em cima do teclado, onde o polegar já está.
  const AlignIcon = editingStyle.align === "left" ? AlignLeft : editingStyle.align === "right" ? AlignRight : AlignCenter;
  const bgActive = editingStyle.backgroundColor != null;

  const editingTopBar = (
    <div
      className="absolute inset-x-0 top-0 z-[22] flex items-center justify-between px-4"
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2">
        <button
          onClick={() =>
            setEditingStyle((s) => ({
              ...s,
              align: s.align === "left" ? "center" : s.align === "center" ? "right" : "left",
            }))
          }
          className={ICON_BTN}
          aria-label={t("flow_align_cycle")}
        >
          <AlignIcon className="h-5 w-5" />
        </button>
        {/* Fundo da legenda (realce estilo Instagram) — liga/desliga; a cor sai da paleta */}
        <button
          onClick={() =>
            setEditingStyle((s) =>
              s.backgroundColor != null
                ? { ...s, color: s.backgroundColor, backgroundColor: null }
                : { ...s, backgroundColor: s.color, color: contrastText(s.color) },
            )
          }
          className={ICON_BTN}
          style={bgActive ? { background: editingStyle.backgroundColor as string } : undefined}
          aria-label={t("flow_caption_background")}
          aria-pressed={bgActive}
        >
          <span
            className="rounded-md px-[5px] text-[15px] font-extrabold leading-5"
            style={{
              border: `2px solid ${bgActive ? contrastText(editingStyle.backgroundColor as string) : "#fff"}`,
              color: bgActive ? contrastText(editingStyle.backgroundColor as string) : "#fff",
            }}
          >
            A
          </span>
        </button>
      </div>
      <button
        onClick={commitEditing}
        className="h-11 px-5 rounded-full bg-white text-black text-[15px] font-semibold active:scale-95 transition-transform"
      >
        {t("flow_text_done")}
      </button>
    </div>
  );

  // Campo de edição do texto (modo texto e legenda sobre a foto). Com o
  // "fundo do texto" ligado, o realce é desenhado por uma camada ESPELHO
  // idêntica ao texto final (`renderTextInner`): um <span> por linha, colado
  // nas letras (box-decoration-break: clone), com o mesmo padding e raio.
  // Antes o fundo ia no <textarea> inteiro — 3 linhas, largura total — e o
  // usuário achava que o realce ficaria daquele tamanho (2026-09-30).
  // Espelho e campo ocupam a MESMA célula de grid com a mesma fonte, padding e
  // quebra de linha: a altura acompanha o texto e as letras coincidem; o
  // texto do campo fica transparente (só o cursor aparece) quando há realce.
  const editBg = editingStyle.backgroundColor;
  const editTextBox: React.CSSProperties = {
    gridArea: "1 / 1",
    fontFamily: editingStyle.fontFamily,
    fontWeight: editingStyle.fontWeight,
    fontSize: editingStyle.fontSize,
    textAlign: editingStyle.align,
    lineHeight: 1.625,
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    padding: "0 0.26em",
    margin: 0,
  };
  const editingField = (
    <div className="grid w-full pointer-events-auto" onClick={(e) => e.stopPropagation()}>
      <div
        aria-hidden
        style={{
          ...editTextBox,
          color: editingStyle.color,
          visibility: editBg ? "visible" : "hidden",
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            background: editBg ?? undefined,
            boxDecorationBreak: "clone",
            WebkitBoxDecorationBreak: "clone",
            padding: "0.08em 0.26em",
            margin: "0 -0.26em",
            borderRadius: "0.28em",
            opacity: editingValue ? 1 : 0.7,
          }}
        >
          {editingValue || t("flow_text_placeholder")}
        </span>
        {/* Quebra final vazia ainda ocupa uma linha no campo — no espelho também. */}
        {editingValue.endsWith("\n") ? "\u200b" : null}
      </div>
      <textarea
        ref={textareaRef}
        value={editingValue}
        onChange={(e) => setEditingValue(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        maxLength={200}
        placeholder={t("flow_text_placeholder")}
        className={cn(
          "w-full bg-transparent resize-none outline-none border-0 overflow-hidden",
          // Com realce, o placeholder já está desenhado no espelho.
          editBg ? "placeholder:text-transparent" : "placeholder:text-white/60",
        )}
        style={{
          ...editTextBox,
          color: editBg ? "transparent" : editingStyle.color,
          WebkitTextFillColor: editBg ? "transparent" : undefined,
          caretColor: editingStyle.color,
          textShadow: editBg ? "none" : "0 1px 6px rgba(0,0,0,0.45)",
        }}
        rows={1}
        autoFocus
      />
    </div>
  );

  const editingBottomControls = (
    <div
      className="absolute inset-x-0 z-[22] space-y-2"
      style={{
        bottom: "calc(var(--keyboard-height, 0px) + max(12px, env(safe-area-inset-bottom)))",
        transition: "bottom 0.25s ease-out",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Cores — com o realce ligado escolhem a cor do FUNDO (o texto vira
          preto/branco sozinho); senão, a cor do texto. Alvo de 44px, bolinha de 30. */}
      <div className="flex overflow-x-auto no-scrollbar px-2">
        {TEXT_COLORS.map((color, i) => {
          const activeColor = bgActive ? editingStyle.backgroundColor : editingStyle.color;
          const isSel = activeColor === color;
          return (
            <button
              key={color}
              onClick={() =>
                setEditingStyle((s) =>
                  s.backgroundColor != null
                    ? { ...s, backgroundColor: color, color: contrastText(color) }
                    : { ...s, color },
                )
              }
              className="h-11 w-11 shrink-0 flex items-center justify-center"
              aria-label={t("flow_color_aria").replace("{n}", String(i + 1))}
              aria-pressed={isSel}
            >
              <span
                className="h-[30px] w-[30px] rounded-full transition-transform"
                style={{
                  background: color,
                  border: `${isSel ? 3 : 2}px solid ${isSel ? "#fff" : "rgba(255,255,255,0.45)"}`,
                  transform: isSel ? "scale(1.12)" : "scale(1)",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                }}
              />
            </button>
          );
        })}
      </div>

      {/* Fontes — cada chip já desenhado na própria fonte */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-1">
        {FONT_OPTIONS.map((font) => {
          const isActive = editingStyle.fontFamily === font.family && editingStyle.fontWeight === font.weight;
          return (
            <button
              key={font.id}
              onClick={() => setEditingStyle((s) => ({ ...s, fontFamily: font.family, fontWeight: font.weight }))}
              className="h-9 px-3.5 rounded-full text-[15px] transition-all shrink-0 whitespace-nowrap"
              style={{
                fontFamily: font.family,
                fontWeight: font.weight,
                background: isActive ? "#fff" : "rgba(0,0,0,0.45)",
                color: isActive ? "#000" : "#fff",
              }}
            >
              {t(font.labelKey)}
            </button>
          );
        })}
      </div>
    </div>
  );

  // Pergunta antes de o "voltar" apagar o trabalho (sobre o criador inteiro —
  // o AlertDialog do app ficaria ATRÁS deste portal, que é z-[100]).
  const discardDialog = discardAsk ? (
    <div
      className="absolute inset-0 z-[140] flex items-center justify-center bg-black/60 px-8 animate-in fade-in duration-150"
      onClick={() => setDiscardAsk(null)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="flow-discard-title"
        className="w-full max-w-[320px] rounded-3xl border border-white/10 p-6 text-center shadow-2xl"
        style={{ background: "linear-gradient(rgba(40,40,50,.97),rgba(22,22,30,.98))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="flow-discard-title" className="text-[19px] font-bold text-white">{t("flow_discard_title")}</h2>
        <p className="mt-2 text-[15px] leading-snug text-white/60">
          {discardAsk === "media" ? t("flow_discard_desc_media") : t("flow_discard_desc_text")}
        </p>
        <div className="mt-5 grid gap-2.5">
          <button
            onClick={() => setDiscardAsk(null)}
            className="h-12 rounded-full bg-white text-[15px] font-semibold text-[#0a0b12] active:scale-[0.98] transition-transform"
          >
            {t("flow_discard_keep")}
          </button>
          <button
            onClick={() => {
              const what = discardAsk;
              setDiscardAsk(null);
              if (what === "media") handleRetake();
              else leaveTextMode();
            }}
            className="h-12 rounded-full bg-[rgba(255,90,78,.14)] text-[15px] font-semibold text-[#ff8a80] active:scale-[0.98] transition-transform"
          >
            {t("flow_discard_confirm")}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const renderTextInner = (item: TextItem) => {
    const hasBg = !!item.style.backgroundColor;
    return (
      <p
        className="leading-relaxed break-words whitespace-pre-wrap"
        style={{
          textShadow: hasBg ? "none" : "0 1px 6px rgba(0,0,0,0.45)",
          fontFamily: item.style.fontFamily,
          fontWeight: item.style.fontWeight,
          fontSize: item.style.fontSize,
          textAlign: item.style.align,
          color: item.style.color,
        }}
      >
        {hasBg ? (
          <span
            style={{
              background: item.style.backgroundColor as string,
              // box-decoration-break: clone → cada linha ganha sua própria caixa
              // arredondada, colada no texto (igual ao realce do Instagram).
              boxDecorationBreak: "clone",
              WebkitBoxDecorationBreak: "clone",
              padding: "0.08em 0.26em",
              borderRadius: "0.28em",
            }}
          >
            {item.text}
          </span>
        ) : (
          item.text
        )}
      </p>
    );
  };

  // Modo TEXTO (gradient): as frases têm handlers próprios (arrastar/pinçar/tocar),
  // pois não há camada de mídia embaixo para conflitar.
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
      {renderTextInner(item)}
    </div>
  ));

  // Modo LEGENDA sobre a foto: as frases são **pointer-events-none** e todos os
  // gestos passam para a camada única de gestos da mídia (handleMediaPointer*), que
  // decide o alvo (legenda vs foto). Registramos o elemento em textElsRef para o
  // hit-test (tocar/arrastar/pinçar sobre a frase certa).
  const captionTextItems = texts.map((item) => (
    <div
      key={item.id}
      ref={(el) => {
        if (el) textElsRef.current.set(item.id, el);
        else textElsRef.current.delete(item.id);
      }}
      data-caption-text-id={item.id}
      className="absolute z-[6] select-none pointer-events-none"
      style={{
        left: item.x,
        top: item.y,
        transform: "translate(-50%, -50%)",
        width: "max-content",
        maxWidth: "80vw",
        padding: "0 0.5rem",
      }}
    >
      {renderTextInner(item)}
    </div>
  ));

  // Mini frame do treino citado — mesma camada nas duas etapas de compartilhar
  // (legenda sobre a mídia e modo texto). Fica acima das frases e da camada de
  // gestos da mídia, com ponteiros próprios.
  const workoutStickerLayer = workoutSticker ? (
    <div
      className="absolute z-[8] touch-none select-none"
      style={{
        left: workoutSticker.x,
        top: workoutSticker.y,
        transform: `translate(-50%, -50%) scale(${workoutSticker.scale})`,
        transformOrigin: "center",
      }}
      onPointerDown={handleStickerPointerDown("workout")}
      onPointerMove={handleStickerPointerMove}
      onPointerUp={handleStickerPointerUp}
      onPointerCancel={handleStickerPointerUp}
    >
      <div className="relative">
        <FlowWorkoutSticker data={workoutSticker.data} />
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setWorkoutSticker(null);
          }}
          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-black/80 border border-white/25 flex items-center justify-center text-white active:opacity-70"
          aria-label={t("flow_workout_remove")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
        {/* Personalizar o que o card mostra — mesmo visual do X, no canto oposto. */}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            openWorkoutPicker(true);
          }}
          className="absolute -top-2 -left-2 h-6 w-6 rounded-full bg-black/80 border border-white/25 flex items-center justify-center text-white active:opacity-70"
          aria-label={t("flow_workout_customize")}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  ) : null;

  // Moldura do post do feed — só no modo texto (ver `postSticker`). Fica ABAIXO
  // das frases (z-[6]) e do mini frame do treino (z-[8]): é o "fundo" do flow,
  // o resto vai por cima dela.
  const postStickerLayer = postSticker ? (
    <div
      className="absolute z-[5] touch-none select-none"
      style={{
        left: postSticker.x,
        top: postSticker.y,
        transform: `translate(-50%, -50%) scale(${postSticker.scale})`,
        transformOrigin: "center",
      }}
      onPointerDown={handleStickerPointerDown("post")}
      onPointerMove={handleStickerPointerMove}
      onPointerUp={handleStickerPointerUp}
      onPointerCancel={handleStickerPointerUp}
    >
      <div className="relative">
        <FlowPostCard data={postSticker.data} />
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setPostSticker(null);
          }}
          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-black/80 border border-white/25 flex items-center justify-center text-white active:opacity-70"
          aria-label={t("flow_post_remove")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  ) : null;

  // Botão que abre o seletor de treino — mesmo visual nas duas etapas.
  // Anular a constante cobre os dois pontos de uso de uma vez (a barra da
  // captura e a da revisão), em vez de repetir a guarda em cada um.
  const workoutStickerButton = !FEATURES.workoutStickerOnFlow ? null : (
    <button
      onClick={(e) => {
        e.stopPropagation();
        openWorkoutPicker(false);
      }}
      className="h-11 w-11 shrink-0 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white active:scale-95 transition-transform"
      aria-label={t("flow_workout_button")}
    >
      <Dumbbell className="h-5 w-5" />
    </button>
  );

  if (!open) return null;

  const overlay = (
    <>
      <div
        data-flow-dialog-root
        /* Só opacidade na entrada: transform no root viraria containing block
           dos elementos `fixed` internos. */
        className="fixed inset-0 z-[100] bg-black flex flex-col overflow-hidden animate-in fade-in duration-200"
        style={{ height: "100dvh", width: "100vw" }}
        role="dialog"
        aria-modal="true"
        aria-label={t("flow_create_new")}
      >
        {/* Indicador enquanto a mídia da galeria é preparada (some ao abrir o preview).
            Cobre tudo para o usuário saber que o vídeo está carregando, e não parecer
            que a tela travou na galeria. */}
        {isPreparingMedia && (
          <div className="absolute inset-0 z-[120] flex flex-col items-center justify-center gap-4 bg-black/85 backdrop-blur-sm">
            <Loader2 className="h-10 w-10 text-white animate-spin" />
            <p className="text-white/90 text-sm font-medium">{t("flow_preparing_media")}</p>
          </div>
        )}

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
                  <p className="text-sm text-white/80 max-w-xs">{t(CAMERA_ERROR_KEY[cameraError])}</p>
                  <Button
                    variant="secondary"
                    onClick={() => void openGallery()}
                    className="rounded-full"
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    {t("flow_pick_gallery")}
                  </Button>
                </div>
              ) : (
                <>
                {!videoShown && (
                  // Aparece só se a câmera demorar (delay de 700ms); na abertura
                  // normal o vídeo entra antes e o spinner nunca chega a surgir.
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-in fade-in fill-mode-both duration-300 delay-700">
                    <Loader2 className="h-8 w-8 text-white/50 animate-spin" />
                  </div>
                )}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={cn(
                    "h-full w-full object-cover transition-opacity duration-300 ease-out",
                    videoShown ? "opacity-100" : "opacity-0",
                  )}
                  style={{
                    transform: `scaleX(${(facingMode === "user" ? -1 : 1) * (nativeZoomRef.current ? 1 : zoom)}) scaleY(${nativeZoomRef.current ? 1 : zoom})`,
                    transformOrigin: "center",
                  }}
                />
                </>
              )}
            </div>

            {/* Top bar */}
            <div
              className="relative z-10 flex items-center justify-between px-4 pt-2"
              style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
            >
              {/* Topo só com o fechar: o modo texto foi para o seletor
                  "Câmera · Texto" e o virar câmera para a direita do obturador. */}
              <button onClick={handleClose} className={ICON_BTN} aria-label={t("close")}>
                <X className="h-5 w-5" />
              </button>
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

            {/* Hint — muda conforme o estado da gravação */}
            {!cameraError && (
              <div className="relative z-10 flex items-center justify-center pb-3 px-6">
                <p className="text-white/70 text-xs text-center">
                  {!isRecording
                    ? t("flow_hint_idle")
                    : isRecordingLocked
                      ? t("flow_hint_locked")
                      : t("flow_hint_recording")}
                </p>
              </div>
            )}

            {/* Bottom controls: galeria | obturador | virar câmera */}
            <div className="relative z-10 grid grid-cols-3 items-center justify-items-center px-6">
              {/* Galeria — miniatura da última foto do rolo (ícone se não houver) */}
              <button
                onClick={() => void openGallery()}
                className={`h-12 w-12 overflow-hidden rounded-xl border-2 border-white bg-white/15 backdrop-blur flex items-center justify-center text-white shadow-lg transition-opacity ${
                  isRecording ? "opacity-0 pointer-events-none" : "opacity-100"
                }`}
                aria-label={t("flow_gallery")}
                disabled={isRecording}
              >
                {galleryThumb ? (
                  <img
                    src={galleryThumb}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={() => setGalleryThumb(null)}
                  />
                ) : (
                  <ImageIcon className="h-6 w-6" />
                )}
              </button>

              <button
                onPointerDown={handleShutterPointerDown}
                onPointerMove={handleShutterPointerMove}
                onPointerUp={handleShutterPointerUp}
                onPointerCancel={handleShutterPointerUp}
                onContextMenu={(e) => e.preventDefault()}
                disabled={!cameraReady}
                className="h-20 w-20 rounded-full bg-white/20 backdrop-blur flex items-center justify-center disabled:opacity-50 select-none touch-none"
                style={{ touchAction: "none" }}
                aria-label={t("flow_shutter_aria")}
              >
                {isRecording ? (
                  <span className="relative flex items-center justify-center h-20 w-20">
                    {/* Ring de tempo: esvazia ao longo do limite de 1 min, então o usuário
                        vê quanto ainda pode gravar sem precisar ler o cronômetro. Ao
                        fechar o ciclo a gravação é finalizada e segue para a postagem. */}
                    <svg
                      viewBox="0 0 80 80"
                      className="absolute inset-0 h-full w-full -rotate-90"
                      aria-hidden
                    >
                      <circle
                        cx="40"
                        cy="40"
                        r={RING_RADIUS}
                        fill="none"
                        stroke="rgba(255,255,255,.28)"
                        strokeWidth="4"
                      />
                      <motion.circle
                        cx="40"
                        cy="40"
                        r={RING_RADIUS}
                        fill="none"
                        stroke="#FF3B30"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={RING_CIRCUMFERENCE}
                        initial={{ strokeDashoffset: 0 }}
                        animate={{ strokeDashoffset: RING_CIRCUMFERENCE }}
                        transition={{ duration: MAX_RECORD_MS / 1000, ease: "linear" }}
                      />
                    </svg>
                    {isRecordingLocked ? (
                      <Lock className="h-7 w-7 text-red-500" strokeWidth={2.5} />
                    ) : (
                      <span className="h-7 w-7 rounded-md bg-red-500 animate-pulse" />
                    )}
                  </span>
                ) : (
                  <div className="h-16 w-16 rounded-full bg-white ring-4 ring-white/40" />
                )}
              </button>

              {/* Virar câmera — na zona do polegar (antes no topo). Funciona
                  também durante a gravação (a gravação passa pelo canvas). */}
              <button
                onClick={handleFlipCamera}
                className="h-12 w-12 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white active:scale-95 transition-transform disabled:opacity-50"
                aria-label={t("flow_flip_camera")}
                disabled={!!cameraError}
              >
                <SwitchCamera className="h-6 w-6" />
              </button>
            </div>

            {/* Seletor de modo — o modo texto deixou de ficar escondido no "Aa" do topo */}
            <div
              className={`relative z-10 flex justify-center gap-8 pt-4 transition-opacity ${
                isRecording ? "opacity-0 pointer-events-none" : "opacity-100"
              }`}
              style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
            >
              <span className="flex flex-col items-center gap-1.5 text-[13px] font-extrabold uppercase tracking-[.08em] text-white">
                {t("flow_mode_camera")}
                <span className="h-[5px] w-[5px] rounded-full bg-white" />
              </span>
              <button
                onClick={() => setStep("create")}
                className="flex flex-col items-center gap-1.5 text-[13px] font-bold uppercase tracking-[.08em] text-white/55 active:text-white"
                aria-label={t("flow_create_with_text")}
              >
                {t("flow_mode_text")}
                <span className="h-[5px] w-[5px]" />
              </button>
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

            {/* Mini frame do treino citado */}
            {!isEditingText && workoutStickerLayer}

            {/* Moldura do post do feed ("Editar antes de postar") */}
            {!isEditingText && postStickerLayer}

            {/* Hint when there is no text yet — some com um card na tela, que
                ocuparia o mesmo lugar */}
            {!isEditingText && texts.length === 0 && !workoutSticker && !postSticker && (
              <div
                className="absolute inset-x-0 z-[2] flex items-center justify-center px-6 pointer-events-none"
                style={{ top: "50%", transform: "translateY(-50%)" }}
              >
                <p className="text-white/70 text-center font-semibold text-2xl">
                  {t("flow_tap_to_type")}
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
                style={{
                  top: "52%",
                  // Sobe ~metade da altura do teclado iOS para o texto centralizado
                  // não ficar atrás dele ao digitar (var publicada por keyboard.ts).
                  transform: "translateY(calc(-50% - var(--keyboard-height, 0px) / 2))",
                  transition: "transform 0.25s ease-out",
                }}
              >
                {editingField}
                {/* "@" no texto do flow (T + Aa) → sugestões; a pessoa escolhida entra
                    nas marcações do flow (flow_tags → notificação type 16). */}
                <MentionSuggestions
                  inputRef={textareaRef}
                  value={editingValue}
                  onChange={setEditingValue}
                  onPick={
                    FEATURES.postTags
                      ? (u) => setTaggedUsers((prev) => addMentionToTagged(prev, u, MAX_TAGGED_PEOPLE))
                      : undefined
                  }
                  placement="below"
                  className="max-h-[168px] overflow-y-auto"
                />
              </div>
            )}

            {/* Top bar — editando: alinhamento/fundo/Pronto (sem o X, que apagava
                tudo ao lado do "Pronto"); fora da edição: voltar + ações. */}
            {isEditingText ? (
              editingTopBar
            ) : (
              <div
                className={cn(
                  "relative z-[10] flex items-center justify-between px-4 transition-opacity duration-150",
                  isDraggingItem && "opacity-0 pointer-events-none",
                )}
                style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
              >
                <button
                  onClick={requestLeaveText}
                  className={ICON_BTN}
                  aria-label={postSticker ? t("close") : t("back")}
                >
                  {postSticker ? <X className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
                </button>
                <div className="flex items-center gap-2">
                  {/* Sem rascunho com a moldura do post: a foto dela vem de outro
                      domínio e o canvas não a desenha (sairia sem o post). */}
                  {(texts.length > 0 || workoutSticker) && !postSticker && saveDraftButton}
                  {workoutStickerButton}
                  <button onClick={beginNewText} className={ICON_BTN} aria-label={t("flow_add_text")}>
                    <span className="text-[16px] font-extrabold tracking-[-0.01em]">Aa</span>
                  </button>
                </div>
              </div>
            )}

            {/* Cores e fontes em cima do teclado — só durante a edição */}
            {isEditingText && editingBottomControls}

            <div className="flex-1" />

            {/* Bottom: gradient strip + share (hidden when keyboard up) */}
            {!isEditingText && (
              <div
                className={cn(
                  "relative z-[10] px-4 space-y-3 transition-opacity duration-150",
                  isDraggingItem && "opacity-0 pointer-events-none",
                )}
                style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
              >
                <div
                  className="-mx-4 flex gap-2.5 overflow-x-auto no-scrollbar px-4 pb-1"
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
                      aria-label={t(preset.label)}
                    >
                      {selectedGradient === preset.value && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Check className="h-4 w-4 text-white drop-shadow" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex">{pinChip}</div>
                {/* Principal branco (padrão do app); o rascunho foi para a barra de cima. */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSubmitCreate();
                  }}
                  disabled={(texts.length === 0 && !workoutSticker && !postSticker) || isSubmitting || isLoading}
                  className="w-full h-[52px] rounded-full bg-white text-[#0a0b12] text-[16px] font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
                >
                  {isSubmitting || isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <ArrowUp className="h-5 w-5" strokeWidth={2.4} />
                  )}
                  {isSubmitting || isLoading ? t("sending") : t("flow_share_button")}
                </button>
              </div>
            )}
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
                    playsInline
                    // 1º frame decodificado → encerra o indicador "Preparando mídia…" e
                    // toca COM áudio (mesma dinâmica dos viewers): tenta com som e, se o
                    // iOS bloquear o autoplay-com-som, cai para mudo. Assim o preview já
                    // sai com áudio, batendo com o flow postado.
                    onLoadedData={(e) => {
                      finishPreparing();
                      const v = e.currentTarget;
                      v.muted = false;
                      v.play().catch(() => {
                        v.muted = true;
                        v.play().catch(() => {});
                      });
                    }}
                    onError={finishPreparing}
                  />
                ) : (
                  <img
                    src={mediaPreview}
                    alt="Preview"
                    draggable={false}
                    // Galeria → object-contain: mostra a imagem INTEIRA por padrão (nada
                    // cortado), com o fundo desfocado preenchendo as bordas; o usuário pode
                    // dar pinça/zoom/arraste para reenquadrar/cortar como preferir.
                    // Câmera → object-cover: full-bleed, pois o viewfinder já é WYSIWYG.
                    className={`h-full w-full select-none ${mediaFromGallery ? "object-contain" : "object-cover"}`}
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

              {/* Frases posicionadas sobre a foto — pointer-events-none: TODOS os gestos
                  passam para a camada de gestos da mídia, que decide legenda vs foto. */}
              {!isEditingText && captionTextItems}
              {!isEditingText && workoutStickerLayer}
            </div>

            {/* Camada de edição de texto (sobre a foto) */}
            {isEditingText && (
              <>
                <div className="absolute inset-0 z-[20] bg-black/40" onClick={commitEditing} />
                {editingTopBar}
                {editingBottomControls}
                <div
                  className="absolute inset-x-0 z-[22] flex items-center justify-center px-6 pointer-events-none"
                  style={{
                  top: "52%",
                  // Sobe ~metade da altura do teclado iOS para o texto centralizado
                  // não ficar atrás dele ao digitar (var publicada por keyboard.ts).
                  transform: "translateY(calc(-50% - var(--keyboard-height, 0px) / 2))",
                  transition: "transform 0.25s ease-out",
                }}
                >
                  {editingField}
                  {/* "@" no texto do flow (T + Aa) → sugestões; a pessoa escolhida entra
                      nas marcações do flow (flow_tags → notificação type 16). */}
                  <MentionSuggestions
                    inputRef={textareaRef}
                    value={editingValue}
                    onChange={setEditingValue}
                    onPick={
                      FEATURES.postTags
                        ? (u) => setTaggedUsers((prev) => addMentionToTagged(prev, u, MAX_TAGGED_PEOPLE))
                        : undefined
                    }
                    placement="below"
                    className="max-h-[168px] overflow-y-auto"
                  />
                </div>
              </>
            )}

            {!isEditingText && (
              <div
                className={cn(
                  "relative z-10 flex items-center justify-between px-4 transition-opacity duration-150",
                  isDraggingItem && "opacity-0 pointer-events-none",
                )}
                style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
              >
                {/* Voltar pergunta antes: descartaria foto, textos, marcações e treino */}
                <button
                  onClick={() => setDiscardAsk("media")}
                  className={ICON_BTN}
                  aria-label={t("flow_retake")}
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-2">
                  {/* Marcar pessoas no flow — mesma feature de FEATURES.postTags.
                      Sem esta guarda o flow era a última porta aberta: dava
                      para marcar alguém, gerando uma notificação tipo 16 que
                      agora é filtrada da lista e redirecionada no push. Ou
                      seja, a marcação existiria e ninguém seria avisado. */}
                  {FEATURES.postTags && (
                    <button
                      onClick={() => setTagPeopleOpen(true)}
                      className={cn(ICON_BTN, "relative")}
                      aria-label={t("flow_tag_people")}
                    >
                      <AtSign className="h-5 w-5" />
                      {taggedUsers.length > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-black">
                          {taggedUsers.length}
                        </span>
                      )}
                    </button>
                  )}
                  {workoutStickerButton}
                  <button onClick={beginNewText} className={ICON_BTN} aria-label={t("flow_add_text")}>
                    <span className="text-[16px] font-extrabold tracking-[-0.01em]">Aa</span>
                  </button>
                  {saveDraftButton}
                </div>
              </div>
            )}

            {/* Dica de manipulação (some assim que o usuário ajusta) */}
            {!isEditingText && !isMediaTransformed(mediaTransform) && texts.length === 0 && (
              <div className="relative z-10 flex justify-center pt-2 pointer-events-none">
                <span className="text-white/85 text-[12.5px] font-medium bg-black/35 backdrop-blur rounded-full px-3 py-1.5">
                  {t("flow_hint_caption_idle")}
                </span>
              </div>
            )}
            {/* Dica de gesto no texto (aparece quando há frase e não se está editando) */}
            {!isEditingText && texts.length > 0 && !isDraggingItem && (
              <div className="relative z-10 flex justify-center pt-2 pointer-events-none">
                <span className="text-white/85 text-[12.5px] font-medium bg-black/35 backdrop-blur rounded-full px-3 py-1.5">
                  {t("flow_hint_caption_text")}
                </span>
              </div>
            )}

            <div className="flex-1" />

            {!isEditingText && (
              <div
                className={cn(
                  "relative z-10 px-4 space-y-3 transition-opacity duration-150",
                  isDraggingItem && "opacity-0 pointer-events-none",
                )}
                style={{
                  paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
                  // Sobe junto com o teclado iOS para a descrição/CTA não ficarem
                  // atrás dele (var publicada por keyboard.ts; 0 no web/fechado).
                  transform: "translateY(calc(-1 * var(--keyboard-height, 0px)))",
                  transition: "transform 0.25s ease-out",
                }}
              >
                {FEATURES.postTags && taggedUsers.length > 0 && (
                  <button
                    onClick={() => setTagPeopleOpen(true)}
                    className="w-full flex items-center gap-2 rounded-2xl bg-black/40 backdrop-blur border border-white/15 px-3 py-2 active:opacity-70"
                  >
                    <AtSign className="h-4 w-4 text-white/70 shrink-0" />
                    <div className="flex -space-x-2 shrink-0">
                      {taggedUsers.slice(0, 5).map((u) => (
                        <UserAvatar key={u.id} photo={u.photo} nickname={u.nickname} size="sm" className="h-6 w-6 ring-2 ring-black/40" />
                      ))}
                    </div>
                    <span className="text-white/80 text-xs font-medium truncate">
                      {taggedUsers.length === 1
                        ? taggedUsers[0].nickname
                        : t("flow_tagged_count").replace("{n}", String(taggedUsers.length))}
                    </span>
                  </button>
                )}
                <div className="flex">{pinChip}</div>
                {/* Rodapé compacto: descrição numa linha (cresce até 4) + enviar.
                    Antes: caixa de 80px + "Compartilhar flow" + "Salvar rascunho". */}
                <div className="relative flex items-end gap-2.5">
                  {/* #hashtag e @menção ficam azuis enquanto digita. */}
                  <HighlightTextarea
                    ref={descriptionRef}
                    rows={1}
                    placeholder={t("flow_description_placeholder")}
                    placeholderColor="rgba(255,255,255,.6)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={200}
                    wrapperClassName="flex-1 min-w-0"
                    className={cn(
                      SHADCN_TEXTAREA_CLASS,
                      "resize-none min-h-[52px] max-h-[124px] rounded-[26px] px-5 py-[14px] leading-snug bg-black/45 backdrop-blur border-white/20 text-white",
                    )}
                  />
                  {/* "@" na descrição → sugestão; a escolhida entra nas marcações
                      do flow (flow_tags → notificação type 16). */}
                  <MentionSuggestions
                    inputRef={descriptionRef}
                    value={description}
                    onChange={setDescription}
                    onPick={
                      FEATURES.postTags
                        ? (u) => setTaggedUsers((prev) => addMentionToTagged(prev, u, MAX_TAGGED_PEOPLE))
                        : undefined
                    }
                    placement="above"
                  />
                  <button
                    onClick={handleSubmitMedia}
                    disabled={isSubmitting || isLoading}
                    className="h-[52px] w-[52px] shrink-0 rounded-full bg-white text-[#0a0b12] flex items-center justify-center active:scale-95 transition-transform disabled:opacity-60"
                    aria-label={isSubmitting || isLoading ? t("sending") : t("flow_share_button")}
                  >
                    {isSubmitting || isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <ArrowUp className="h-[22px] w-[22px]" strokeWidth={2.6} />
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Lixeira — só durante o arraste de uma frase ou card */}
        {isDraggingItem && (
          <div
            className="pointer-events-none absolute inset-x-0 z-[30] flex justify-center animate-in fade-in zoom-in-75 duration-150"
            style={{ bottom: "calc(max(1.5rem, env(safe-area-inset-bottom)) + 12px)" }}
          >
            <div
              ref={trashRef}
              role="img"
              aria-label={t("flow_trash_aria")}
              className="flex h-14 w-14 items-center justify-center rounded-full text-white transition-all duration-150"
              style={{
                transform: overTrash ? "scale(1.25)" : "scale(1)",
                background: overTrash ? "#ff3b30" : "rgba(0,0,0,.45)",
                border: overTrash ? "2px solid #ff3b30" : "2px solid rgba(255,255,255,.75)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                boxShadow: overTrash ? "0 0 0 8px rgba(255,59,48,.25)" : "0 6px 20px rgba(0,0,0,.35)",
              }}
            >
              <Trash2 className="h-6 w-6" strokeWidth={2.2} />
            </div>
          </div>
        )}

        {discardDialog}
      </div>

      {/* Fixar no perfil antes de postar: guarda a escolha (nome incluído). */}
      <PinFlowDrawer
        open={pinDrawerOpen}
        onOpenChange={setPinDrawerOpen}
        pinned={!!pinOnPost}
        initialTitle={pinOnPost?.title ?? null}
        onConfirm={(title) => setPinOnPost({ title })}
        onUnpin={() => setPinOnPost(null)}
      />

      {FEATURES.postTags && (
      <TagPeopleDrawer
        open={tagPeopleOpen}
        onOpenChange={setTagPeopleOpen}
        selected={taggedUsers}
        onChange={setTaggedUsers}
      />
      )}

      {FEATURES.workoutStickerOnFlow && (
        <WorkoutStickerPickerDrawer
          open={workoutPickerOpen}
          onOpenChange={setWorkoutPickerOpen}
          onSelect={handlePickWorkout}
          editing={
            workoutPickerEditing && workoutSticker
              ? { full: workoutSticker.full, hidden: workoutSticker.data.hidden ?? [] }
              : null
          }
        />
      )}
    </>
  );

  return typeof document !== "undefined"
    ? createPortal(overlay, document.body)
    : overlay;
}
