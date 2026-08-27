import * as React from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { TagPeopleDrawer } from "@/components/shared/tag-people-drawer";
import {
  FlowWorkoutSticker,
  WORKOUT_STICKER_WIDTH,
  MIN_STICKER_SCALE,
  MAX_STICKER_SCALE,
  formatStickerDate,
  formatStickerDuration,
  formatStickerVolume,
} from "@/components/shared/flow-workout-sticker";
import { WorkoutStickerPickerDrawer } from "@/components/modals/workout-sticker-picker-drawer";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useLanguage } from "@/lib/language-context";
import { saveMediaToPhotos, SaveMediaError, compressVideoBlob } from "@/lib/native-media";
import { hapticLight } from "@/lib/haptics";
import { motion } from "framer-motion";
import type { SearchUser, StoryTextElement, StoryWorkoutSticker } from "@/lib/ritmofit-db";
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
  Loader2,
  AtSign,
  Lock,
  Download,
  Dumbbell,
} from "lucide-react";
import { FEATURES } from "@/lib/feature-flags";

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

// Fontes disponíveis para legendas. Todas são fontes de sistema pré-instaladas no
// iOS (ou keywords CSS `ui-*` suportadas no WKWebView) com fallback genérico, então
// renderizam sem carregar nenhum arquivo de fonte externo.
const FONT_OPTIONS = [
  { id: "bold",       label: "Bold",    family: "system-ui, -apple-system, sans-serif",                 weight: 800 },
  { id: "light",      label: "Light",   family: "system-ui, -apple-system, sans-serif",                 weight: 300 },
  { id: "rounded",    label: "Rounded", family: "ui-rounded, 'SF Pro Rounded', system-ui, sans-serif",  weight: 700 },
  { id: "condensed",  label: "Impact",  family: "'Impact', 'Haettenschweiler', system-ui, sans-serif",  weight: 900 },
  { id: "serif",      label: "Serif",   family: "Georgia, 'Times New Roman', serif",                    weight: 700 },
  { id: "elegant",    label: "Elegant", family: "'Didot', 'Hoefler Text', Georgia, serif",              weight: 600 },
  { id: "script",     label: "Script",  family: "'Snell Roundhand', 'Zapfino', cursive",                weight: 700 },
  { id: "marker",     label: "Marker",  family: "'Marker Felt', 'Chalkboard SE', 'Comic Sans MS', cursive", weight: 600 },
  { id: "typewriter", label: "Type",    family: "'American Typewriter', 'Courier New', monospace",      weight: 600 },
  { id: "mono",       label: "Mono",    family: "ui-monospace, 'Courier New', Courier, monospace",      weight: 500 },
] as const;

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
  const chips: Array<{ text: string; accent: boolean }> = [
    { text: `${data.totalSeries} ${labels.series}`, accent: false },
  ];
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
  let h = STICKER_PAD + STICKER_HEADER_H + 9 + STICKER_CHIPS_H
    + (chipLines - 1) * (STICKER_CHIPS_H + 6);
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
    const lineY = chipY + STICKER_CHIPS_H + 9;
    ctx.fillStyle = "rgba(255,255,255,.1)";
    ctx.fillRect(left, lineY, contentW, 1);
    let rowY = lineY + 1 + 8;
    for (const ex of rows) {
      const value = ex.isCardio
        ? `${ex.kg} min`
        : ex.kg > 0
          ? `${ex.sets}× ${ex.kg}kg`
          : `${ex.sets}×`;
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

interface FlowCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateStory: (
    mediaUrl: string,
    description: string,
    backgroundColor?: string | null,
    textPosition?: { x: number; y: number } | null,
    textElements?: StoryTextElement[] | null,
    mediaTransform?: { scale: number; x: number; y: number } | null,
    taggedUserIds?: string[],
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
  const { t } = useLanguage();
  const [step, setStep] = React.useState<Step>("camera");
  const [mediaPreview, setMediaPreview] = React.useState<string | null>(null);
  const [mediaIsVideo, setMediaIsVideo] = React.useState(false);
  // Imagem veio da galeria (vs. capturada pela câmera). A da galeria é exibida
  // inteira (object-contain + fundo desfocado) para não cortar o conteúdo; a da
  // câmera é full-bleed (object-cover), pois o viewfinder já é WYSIWYG.
  const [mediaFromGallery, setMediaFromGallery] = React.useState(false);
  const [description, setDescription] = React.useState("");
  // Pessoas marcadas no flow (estilo Instagram) + drawer de seleção.
  const [taggedUsers, setTaggedUsers] = React.useState<SearchUser[]>([]);
  const [tagPeopleOpen, setTagPeopleOpen] = React.useState(false);
  // Mini frame do último treino citado no flow (estilo "repost"): um único
  // sticker por flow, arrastável e redimensionável como as frases. `null` = o
  // usuário não citou treino nenhum.
  const [workoutSticker, setWorkoutSticker] = React.useState<{
    data: StoryWorkoutSticker;
    x: number;
    y: number;
    scale: number;
  } | null>(null);
  const [workoutPickerOpen, setWorkoutPickerOpen] = React.useState(false);
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
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [cameraReady, setCameraReady] = React.useState(false);
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
          // Retrato explícito. Pedir 1920x1080 num aparelho EM PÉ fazia o WebKit
          // procurar o modo de sensor mais próximo de 1920 de largura — podia
          // entregar um modo bem maior que o necessário (canvas gigante para
          // redesenhar a cada frame, preview engasgando) ou um 4:3 do qual o
          // flow só aproveita uma faixa. Pedindo 1080x1920 em 9:16 a câmera
          // entrega direto o formato que vai ser gravado.
          width: { ideal: 1080 },
          height: { ideal: RECORD_TARGET_HEIGHT },
          aspectRatio: { ideal: RECORD_TARGET_ASPECT },
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

  // Cada vez que o dialog abre, volta para a câmera frontal — o instance do
  // componente persiste entre aberturas, então sem isto uma troca anterior para
  // a traseira ficaria "grudada" na próxima abertura. (setState com o mesmo valor
  // é no-op no React, então na primeira abertura não reinicia o stream.)
  React.useEffect(() => {
    if (open) setFacingMode("user");
  }, [open]);

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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > MAX_MEDIA_BYTES) {
      toast({
        title: "Arquivo muito grande",
        description: "Máximo de 100MB",
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
          reject("Vídeo muito longo", "O flow aceita vídeos de até 1 minuto");
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
        title: "Erro ao abrir a imagem",
        description: "Tente novamente",
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
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.delete(e.pointerId);
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    }
    if (pointersRef.current.size > 0) {
      // Ainda há dedo(s) — re-ancora para o próximo sub-gesto (ex.: 2→1).
      rebaseCaptionGesture();
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
    setWorkoutSticker(null);
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
            date: formatStickerDate(
              workoutSticker.data.date,
              t("flow_workout_today"),
              t("flow_workout_yesterday"),
            ),
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
      className="w-full h-10 rounded-full bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center gap-2 text-white text-sm font-semibold disabled:opacity-50 active:opacity-70"
    >
      {isSavingDraft ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {isSavingDraft ? t("flow_save_draft_saving") : t("flow_save_draft")}
    </button>
  );

  /**
   * Elementos sobrepostos que vao para `flow.text_elements`: as frases e, se
   * houver, o mini frame do treino citado. Tudo em % da viewport, para o viewer
   * reposicionar em qualquer aparelho.
   */
  const buildElementsPayload = (): StoryTextElement[] | null => {
    const els: StoryTextElement[] = texts.map((item) => ({
      text: item.text,
      x: Math.round((item.x / window.innerWidth) * 1000) / 10,
      y: Math.round((item.y / window.innerHeight) * 1000) / 10,
      style: item.style,
    }));
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
      const t = transformRef.current;
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
        // Vídeo não pode ser recomposto no cliente → persiste o enquadramento (só
        // quando houve pinça/arraste; sem transform o viewer usa object-cover puro).
        if (isMediaTransformed(t)) mediaTransformPayload = percentTransform;
      } else if (mediaFromGallery) {
        // Imagem da galeria: SEMPRE compõe no frame 9:16 (imagem inteira via "contain"
        // + fundo desfocado nas bordas), mesmo sem pinça/zoom. Assim o resultado postado
        // é idêntico ao preview e nada é cortado — o viewer só dá object-cover sobre um
        // frame que já tem o aspecto certo. Se a composição falhar, cai para o original.
        const baked = await bakeTransformedImage(mediaPreview, fw, fh, t, "contain");
        if (baked) {
          mediaToShare = baked;
        } else if (isMediaTransformed(t)) {
          mediaTransformPayload = percentTransform;
        }
      } else if (isMediaTransformed(t)) {
        // Imagem da câmera: full-bleed (object-cover). Só recompõe se houve pinça/arraste;
        // sem transform o original já preenche a tela via object-cover no viewer.
        const baked = await bakeTransformedImage(mediaPreview, fw, fh, t, "cover");
        if (baked) {
          mediaToShare = baked;
        } else {
          mediaTransformPayload = percentTransform;
        }
      }
      // Frases e mini frame de treino posicionados sobre a foto (renderizados ao
      // vivo no FlowViewer, mantendo tudo nítido — não são "queimados" na imagem)
      const elementsPercent = buildElementsPayload();
      await onCreateStory(mediaToShare, description, null, null, elementsPercent, mediaTransformPayload, taggedUsers.map((u) => u.id));
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
    if (texts.length === 0 && !workoutSticker) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos uma frase ao seu flow",
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
      await onCreateStory("", joinedDescription, selectedGradient, null, elementsPercent, null, taggedUsers.map((u) => u.id));
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
    setMediaFromGallery(false);
    if (prepareSafetyRef.current) {
      clearTimeout(prepareSafetyRef.current);
      prepareSafetyRef.current = null;
    }
    setIsPreparingMedia(false);
    setIsSavingDraft(false);
    setDescription("");
    setTaggedUsers([]);
    setWorkoutSticker(null);
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
    if (wasTap) beginEditText(item);
  };

  /* ── Gestos do mini frame de treino ───────────────────────────────────────
     O sticker fica ACIMA da camada de gestos da mídia e trata os próprios
     ponteiros (1 dedo arrasta, 2 pinçam) — por isso arrastá-lo nunca reenquadra
     a foto nem cria uma frase nova. */
  const stickerGestureRef = React.useRef<{
    pointers: Map<number, { x: number; y: number }>;
    origX: number;
    origY: number;
    origScale: number;
    anchorX: number;
    anchorY: number;
    startDist: number;
  } | null>(null);

  const rebaseStickerGesture = () => {
    const g = stickerGestureRef.current;
    if (!g || !workoutSticker) return;
    const pts = Array.from(g.pointers.values());
    g.origX = workoutSticker.x;
    g.origY = workoutSticker.y;
    g.origScale = workoutSticker.scale;
    if (pts.length >= 2) {
      g.startDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
    } else if (pts.length === 1) {
      g.anchorX = pts[0].x;
      g.anchorY = pts[0].y;
    }
  };

  const handleStickerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!workoutSticker) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    let g = stickerGestureRef.current;
    if (!g) {
      g = {
        pointers: new Map(),
        origX: workoutSticker.x,
        origY: workoutSticker.y,
        origScale: workoutSticker.scale,
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
    if (!g || !g.pointers.has(e.pointerId)) return;
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
      setWorkoutSticker((prev) => (prev ? { ...prev, scale: nextScale } : prev));
    } else {
      const nx = g.origX + (pts[0].x - g.anchorX);
      const ny = g.origY + (pts[0].y - g.anchorY);
      setWorkoutSticker((prev) => (prev ? { ...prev, x: nx, y: ny } : prev));
    }
  };

  const handleStickerPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = stickerGestureRef.current;
    if (!g || !g.pointers.has(e.pointerId)) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    g.pointers.delete(e.pointerId);
    if (g.pointers.size > 0) {
      rebaseStickerGesture();
      return;
    }
    stickerGestureRef.current = null;
  };

  // Escolha no drawer → o mini frame nasce um pouco abaixo do centro (onde não
  // cobre o rosto da selfie nem a descrição), pronto para ser arrastado.
  const handlePickWorkout = (data: StoryWorkoutSticker) => {
    setWorkoutSticker({
      data,
      x: window.innerWidth / 2,
      y: window.innerHeight * 0.45,
      scale: 1,
    });
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
      {/* Cores — quando o realce está ligado, escolhem a cor do FUNDO (e o texto
          vira preto/branco automaticamente); senão, escolhem a cor do texto. */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar px-1 py-1">
        {TEXT_COLORS.map((color) => {
          const bgActive = editingStyle.backgroundColor != null;
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
              className="h-7 w-7 rounded-full border-2 shrink-0 transition-transform"
              style={{
                background: color,
                borderColor: isSel ? "white" : "rgba(255,255,255,0.25)",
                transform: isSel ? "scale(1.25)" : "scale(1)",
                boxShadow: color === "#ffffff" ? "inset 0 0 0 1px rgba(0,0,0,0.2)" : undefined,
              }}
              aria-label={`Cor ${color}`}
            />
          );
        })}
      </div>

      {/* Fontes */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-1 py-1">
        {FONT_OPTIONS.map((font) => {
          const isActive = editingStyle.fontFamily === font.family && editingStyle.fontWeight === font.weight;
          return (
            <button
              key={font.id}
              onClick={() => setEditingStyle((s) => ({ ...s, fontFamily: font.family, fontWeight: font.weight }))}
              className="px-3 py-0.5 rounded-full text-sm transition-all shrink-0 whitespace-nowrap"
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

      {/* Alinhamento + realce de fundo (estilo Instagram) */}
      <div className="flex gap-2 justify-center items-center">
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
        {/* Toggle do fundo da legenda — liga/desliga o realce; a cor sai da paleta acima */}
        <button
          onClick={() =>
            setEditingStyle((s) =>
              s.backgroundColor != null
                ? { ...s, color: s.backgroundColor, backgroundColor: null }
                : { ...s, backgroundColor: s.color, color: contrastText(s.color) },
            )
          }
          className="h-8 min-w-8 px-2.5 rounded-full flex items-center justify-center transition-all font-extrabold text-sm"
          style={{
            background:
              editingStyle.backgroundColor != null
                ? editingStyle.backgroundColor
                : "rgba(0,0,0,0.45)",
            color:
              editingStyle.backgroundColor != null
                ? contrastText(editingStyle.backgroundColor)
                : "#fff",
            border: "1px solid rgba(255,255,255,0.3)",
          }}
          aria-label="Fundo da legenda"
        >
          A
        </button>
      </div>

    </>
  );

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
      onPointerDown={handleStickerPointerDown}
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
        hapticLight();
        setWorkoutPickerOpen(true);
      }}
      className="h-10 px-3 rounded-full bg-black/40 backdrop-blur flex items-center text-white text-sm font-semibold gap-1"
      aria-label={t("flow_workout_button")}
    >
      <Dumbbell className="h-4 w-4" />
    </button>
  );

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
        {/* Indicador enquanto a mídia da galeria é preparada (some ao abrir o preview).
            Cobre tudo para o usuário saber que o vídeo está carregando, e não parecer
            que a tela travou na galeria. */}
        {isPreparingMedia && (
          <div className="absolute inset-0 z-[120] flex flex-col items-center justify-center gap-4 bg-black/85 backdrop-blur-sm">
            <Loader2 className="h-10 w-10 text-white animate-spin" />
            <p className="text-white/90 text-sm font-medium">Preparando mídia…</p>
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

            {/* Hint — muda conforme o estado da gravação */}
            {!cameraError && (
              <div className="relative z-10 flex items-center justify-center pb-3 px-6">
                <p className="text-white/70 text-xs text-center">
                  {!isRecording
                    ? "Toque para foto • Segure para gravar vídeo"
                    : isRecordingLocked
                      ? "Gravando sem as mãos • toque no botão para parar"
                      : "Arraste para cima 🔒 para gravar sem segurar"}
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
                onPointerMove={handleShutterPointerMove}
                onPointerUp={handleShutterPointerUp}
                onPointerCancel={handleShutterPointerUp}
                onContextMenu={(e) => e.preventDefault()}
                disabled={!cameraReady}
                className="h-20 w-20 rounded-full bg-white/20 backdrop-blur flex items-center justify-center disabled:opacity-50 select-none touch-none"
                style={{ touchAction: "none" }}
                aria-label="Toque para foto, segure ou arraste para cima para gravar vídeo"
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

            {/* Mini frame do treino citado */}
            {!isEditingText && workoutStickerLayer}

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
                style={{
                  top: "52%",
                  // Sobe ~metade da altura do teclado iOS para o texto centralizado
                  // não ficar atrás dele ao digitar (var publicada por keyboard.ts).
                  transform: "translateY(calc(-50% - var(--keyboard-height, 0px) / 2))",
                  transition: "transform 0.25s ease-out",
                }}
              >
                <textarea
                  ref={textareaRef}
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  maxLength={200}
                  placeholder="Digite aqui..."
                  className="w-full bg-transparent leading-relaxed placeholder:text-white/60 resize-none outline-none border-0 pointer-events-auto"
                  style={{
                    textShadow: editingStyle.backgroundColor ? "none" : "0 1px 6px rgba(0,0,0,0.45)",
                    fontFamily: editingStyle.fontFamily,
                    fontWeight: editingStyle.fontWeight,
                    fontSize: editingStyle.fontSize,
                    textAlign: editingStyle.align,
                    color: editingStyle.color,
                    background: editingStyle.backgroundColor ?? undefined,
                    borderRadius: editingStyle.backgroundColor ? "0.4em" : undefined,
                    padding: editingStyle.backgroundColor ? "0.1em 0.35em" : undefined,
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
                <div className="flex items-center gap-2">
                  {workoutStickerButton}
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
                  disabled={(texts.length === 0 && !workoutSticker) || isSubmitting || isLoading}
                  className="w-full rounded-full"
                >
                  {isSubmitting || isLoading ? "Enviando..." : "Compartilhar flow"}
                </Button>
                {(texts.length > 0 || workoutSticker) && saveDraftButton}
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
                  style={{
                  top: "52%",
                  // Sobe ~metade da altura do teclado iOS para o texto centralizado
                  // não ficar atrás dele ao digitar (var publicada por keyboard.ts).
                  transform: "translateY(calc(-50% - var(--keyboard-height, 0px) / 2))",
                  transition: "transform 0.25s ease-out",
                }}
                >
                  <textarea
                    ref={textareaRef}
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    maxLength={200}
                    placeholder="Digite aqui..."
                    className="w-full bg-transparent leading-relaxed placeholder:text-white/60 resize-none outline-none border-0 pointer-events-auto"
                    style={{
                      textShadow: editingStyle.backgroundColor ? "none" : "0 1px 6px rgba(0,0,0,0.45)",
                      fontFamily: editingStyle.fontFamily,
                      fontWeight: editingStyle.fontWeight,
                      fontSize: editingStyle.fontSize,
                      textAlign: editingStyle.align,
                      color: editingStyle.color,
                      background: editingStyle.backgroundColor ?? undefined,
                      borderRadius: editingStyle.backgroundColor ? "0.4em" : undefined,
                      padding: editingStyle.backgroundColor ? "0.1em 0.35em" : undefined,
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
                <div className="flex items-center gap-2">
                  {/* Marcar pessoas no flow — mesma feature de FEATURES.postTags.
                      Sem esta guarda o flow era a última porta aberta: dava
                      para marcar alguém, gerando uma notificação tipo 16 que
                      agora é filtrada da lista e redirecionada no push. Ou
                      seja, a marcação existiria e ninguém seria avisado. */}
                  {FEATURES.postTags && (
                    <button
                      onClick={() => setTagPeopleOpen(true)}
                      className="h-10 px-3 rounded-full bg-black/40 backdrop-blur flex items-center text-white text-sm font-semibold gap-1"
                      aria-label="Marcar pessoas"
                    >
                      <AtSign className="h-4 w-4" />
                      {taggedUsers.length > 0 ? taggedUsers.length : ""}
                    </button>
                  )}
                  {workoutStickerButton}
                  <button
                    onClick={beginNewText}
                    className="h-10 px-3 rounded-full bg-black/40 backdrop-blur flex items-center text-white text-sm font-semibold gap-1"
                    aria-label="Adicionar texto"
                  >
                    <Type className="h-4 w-4" />
                    + Aa
                  </button>
                </div>
              </div>
            )}

            {/* Dica de manipulação (some assim que o usuário ajusta) */}
            {!isEditingText && !isMediaTransformed(mediaTransform) && texts.length === 0 && (
              <div className="relative z-10 flex justify-center pt-2 pointer-events-none">
                <span className="text-white/80 text-xs bg-black/35 backdrop-blur rounded-full px-3 py-1">
                  Toque na foto para escrever • belisque para ajustar
                </span>
              </div>
            )}
            {/* Dica de gesto no texto (aparece quando há frase e não se está editando) */}
            {!isEditingText && texts.length > 0 && (
              <div className="relative z-10 flex justify-center pt-2 pointer-events-none">
                <span className="text-white/80 text-xs bg-black/35 backdrop-blur rounded-full px-3 py-1">
                  Pinça no texto para redimensionar • arraste para mover
                </span>
              </div>
            )}

            <div className="flex-1" />

            {!isEditingText && (
              <div
                className="relative z-10 px-4 space-y-3"
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
                        : `${taggedUsers.length} pessoas marcadas`}
                    </span>
                  </button>
                )}
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
                {saveDraftButton}
              </div>
            )}
          </>
        )}
      </div>

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
        />
      )}
    </>
  );

  return typeof document !== "undefined"
    ? createPortal(overlay, document.body)
    : overlay;
}
