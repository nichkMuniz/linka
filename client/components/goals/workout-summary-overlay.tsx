import * as React from "react";
import { useLanguage } from "@/lib/language-context";
import { toast } from "@/components/ui/use-toast";
import {
  createPostDb,
  addGroupCheckInDb,
  uploadWorkoutImageDb,
} from "@/lib/ritmofit-db";

// ─── Types ──────────────────────────────────────────────────────────────────

export type WorkoutSummaryData = {
  routineName: string;
  totalSeries: number;
  totalVolume: number;
  durationSecs: number;
  badges: string[];
  userId: string;
  completedExercises: Array<{
    name: string;
    totalSets: number;
    bestKg: number;
    muscleGroup: string | null;
  }>;
  prExercises: Array<{
    name: string;
    previousBestKg: number;
    newBestKg: number;
  }>;
  machinedExercises: Array<{ name: string; kg: number }>;
  userGroups: Array<{ id: string; name: string }>;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatSummaryDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${secs}s`;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "").match(/.{2}/g)!;
  return [parseInt(m[0], 16), parseInt(m[1], 16), parseInt(m[2], 16)];
}

// ─── Auto-generated description ─────────────────────────────────────────────

function generateDefaultDescription(data: WorkoutSummaryData): string {
  const duration = formatSummaryDuration(data.durationSecs);
  const volumeStr = data.totalVolume > 0 ? ` • ${data.totalVolume}kg` : "";
  const baseStats = `${duration} • ${data.totalSeries} séries${volumeStr}`;

  if (data.machinedExercises.length > 0) {
    const top = data.machinedExercises[0];
    const extras = data.machinedExercises.slice(1).map((m) => `${m.name}: ${m.kg}kg`).join(" • ");
    let text = `🔥 MÁQUINA ZERADA! ${top.kg}kg no ${top.name}!`;
    if (extras) text += `\n${extras}`;
    text += `\n\nTreino de ${data.routineName} finalizado em ${baseStats}\n\n#maquinazerada #fitness #linka`;
    return text;
  }

  if (data.prExercises.length > 0) {
    const prLines = data.prExercises
      .map((p) =>
        `🏆 ${p.name}: ${p.newBestKg}kg${p.previousBestKg > 0 ? ` (antes: ${p.previousBestKg}kg)` : ""}`,
      )
      .join("\n");
    return `${prLines}\n\nTreino de ${data.routineName} concluído em ${baseStats}\n\n#pr #recordepessoal #fitness #linka`;
  }

  const exNames = data.completedExercises.slice(0, 3).map((e) => e.name).join(", ");
  const exMore = data.completedExercises.length > 3 ? ` +${data.completedExercises.length - 3}` : "";
  const exLine = exNames ? `\n\n${exNames}${exMore}` : "";
  return `Treino de ${data.routineName} concluído! ✅\n\n⏱ ${duration} | 💪 ${data.totalSeries} séries${data.totalVolume > 0 ? ` | 🏋️ ${data.totalVolume}kg` : ""}${exLine}\n\n#treino #fitness #linka`;
}

// ─── Canvas constants ────────────────────────────────────────────────────────

const CANVAS_W = 540;
const CANVAS_H = 540;
const FONT = `"Inter", -apple-system, system-ui, sans-serif`;

// ── Shell "liquid glass" (mesma linguagem do workout-session-dialog) ──────────
const GLASS_ROOT_BG = "linear-gradient(165deg,#1b1828 0%,#100e18 55%,#0a0910 100%)";
const GLASS_BAR_BG  = "rgba(14,13,20,0.72)";
const GLASS_BLUR    = "blur(24px) saturate(180%)";

// Logo oficial (branco) desenhado no header do card gerado. Carregado uma vez e
// cacheado; mesma origem do app, então não tinge o canvas (toBlob continua ok).
let logoImgPromise: Promise<HTMLImageElement | null> | null = null;
function loadLogo(): Promise<HTMLImageElement | null> {
  if (logoImgPromise) return logoImgPromise;
  logoImgPromise = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = "/linka-copa-5a.png";
  });
  return logoImgPromise;
}

type CanvasVariant = "standard" | "pr" | "machine";

function getCanvasVariant(data: WorkoutSummaryData): CanvasVariant {
  if (data.machinedExercises.length > 0) return "machine";
  if (data.prExercises.length > 0) return "pr";
  return "standard";
}

// ─── Canvas shared helpers ───────────────────────────────────────────────────

function canvasSetup(
  canvas: HTMLCanvasElement,
  bgTop: string, bgBot: string,
  accent: string, glowStrength: number,
): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const W = canvas.width, H = canvas.height;

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, bgTop);
  bg.addColorStop(1, bgBot);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Rounded clip
  roundRectPath(ctx, 0, 0, W, H, 20);
  ctx.clip();

  const [r, g, b] = hexToRgb(accent);
  const glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, H * 0.5);
  glow.addColorStop(0, `rgba(${r},${g},${b},${glowStrength})`);
  glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  return ctx;
}

function drawCanvasHeader(
  ctx: CanvasRenderingContext2D, W: number, accent: string,
  logo: HTMLImageElement | null,
) {
  // Logo oficial branco (ou fallback ao wordmark em texto se não carregar)
  if (logo && logo.width > 0 && logo.height > 0) {
    const h = 26;
    const w = (logo.width / logo.height) * h;
    ctx.drawImage(logo, 28, 24, w, h);
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 18px ${FONT}`;
    ctx.textAlign = "left";
    ctx.fillText("LinKa", 28, 44);
  }

  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  ctx.fillStyle = "rgba(255,255,255,0.32)";
  ctx.font = `500 11px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(today, W - 28, 41);
}

function drawCanvasDivider(ctx: CanvasRenderingContext2D, W: number, y: number) {
  // Linha que esmaece nas pontas — mais elegante que um traço chapado.
  const grad = ctx.createLinearGradient(28, 0, W - 28, 0);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.14)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.strokeStyle = grad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(28, y); ctx.lineTo(W - 28, y);
  ctx.stroke();
}

function drawCanvasStats(
  ctx: CanvasRenderingContext2D, W: number, y: number, data: WorkoutSummaryData,
  accent: string,
): number {
  const items: { l: string; v: string }[] = [
    { l: "DURACAO", v: formatSummaryDuration(data.durationSecs) },
    { l: "SERIES", v: String(data.totalSeries) },
    ...(data.totalVolume > 0 ? [{ l: "VOLUME", v: `${data.totalVolume}kg` }] : []),
  ];
  const cols = items.length;
  const colW = (W - 40 - (cols - 1) * 8) / cols;
  const h = 58;
  const [ar, ag, ab] = hexToRgb(accent);
  items.forEach(({ l, v }, i) => {
    const x = 20 + i * (colW + 8), xC = x + colW / 2;
    // Painel de "vidro" com leve realce superior + borda translúcida
    const fill = ctx.createLinearGradient(0, y, 0, y + h);
    fill.addColorStop(0, "rgba(255,255,255,0.09)");
    fill.addColorStop(1, "rgba(255,255,255,0.04)");
    roundRectPath(ctx, x, y, colW, h, 14);
    ctx.fillStyle = fill;
    ctx.fill();
    roundRectPath(ctx, x + 0.5, y + 0.5, colW - 1, h - 1, 13.5);
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 19px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(v, xC, y + 26);
    ctx.fillStyle = `rgba(${ar},${ag},${ab},0.65)`;
    ctx.font = `700 9px ${FONT}`;
    ctx.fillText(l, xC, y + 43);
  });
  return y + h;
}

function drawCanvasExercises(
  ctx: CanvasRenderingContext2D, W: number, y: number,
  data: WorkoutSummaryData, accent: string,
): number {
  if (data.completedExercises.length === 0) return y;
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.font = `600 9px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText("EXERCICIOS", 28, y);
  y += 15;

  const max = Math.min(4, data.completedExercises.length);
  data.completedExercises.slice(0, max).forEach((ex) => {
    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.font = `500 12px ${FONT}`;
    ctx.textAlign = "left";
    let name = ex.name;
    const suffix = ex.bestKg > 0 ? `  ·  ${ex.totalSets}x  ${ex.bestKg}kg` : `  ·  ${ex.totalSets}x`;
    while (ctx.measureText(name + suffix).width > W - 60 && name.length > 3) {
      name = name.slice(0, -2) + "…";
    }
    ctx.fillText(name + suffix, 28, y);
    if (ex.bestKg > 0) {
      ctx.fillStyle = accent;
      ctx.font = `700 11px ${FONT}`;
      ctx.textAlign = "right";
      ctx.fillText(`${ex.bestKg}kg`, W - 28, y);
    }
    y += 21;
  });

  if (data.completedExercises.length > max) {
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.font = `500 11px ${FONT}`;
    ctx.textAlign = "left";
    ctx.fillText(`+${data.completedExercises.length - max} mais`, 28, y);
    y += 18;
  }
  return y;
}

function drawCanvasFooter(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.font = `500 11px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("linka.app", W / 2, H - 18);
}

// ─── Canvas: Standard (green accent) ────────────────────────────────────────

function drawStandardCanvas(
  canvas: HTMLCanvasElement, data: WorkoutSummaryData, logo: HTMLImageElement | null,
) {
  const ctx = canvasSetup(canvas, "#1a1726", "#0c0a12", "#22c55e", 0.16);
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  const ACCENT = "#22c55e";

  ctx.save();
  drawCanvasHeader(ctx, W, ACCENT, logo);

  let y = 62;
  drawCanvasDivider(ctx, W, y);
  y += 24;

  // Check circle — com halo de acento ao redor
  const R = 28;
  const halo = ctx.createRadialGradient(W / 2, y + R, R, W / 2, y + R, R + 26);
  halo.addColorStop(0, "rgba(34,197,94,0.22)");
  halo.addColorStop(1, "rgba(34,197,94,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(W / 2, y + R, R + 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W / 2, y + R, R, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(34,197,94,0.16)";
  ctx.fill();
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(W / 2 - 10, y + R + 1);
  ctx.lineTo(W / 2 - 2, y + R + 9);
  ctx.lineTo(W / 2 + 12, y + R - 9);
  ctx.stroke();
  y += R * 2 + 22;

  ctx.fillStyle = "#ffffff";
  ctx.font = `900 22px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("Treino Concluido!", W / 2, y);
  y += 28;

  ctx.fillStyle = "rgba(255,255,255,0.40)";
  ctx.font = `500 13px ${FONT}`;
  let label = data.routineName;
  while (ctx.measureText(label).width > W - 60 && label.length > 3) label = label.slice(0, -2) + "…";
  ctx.fillText(label, W / 2, y);
  y += 28;

  y = drawCanvasStats(ctx, W, y, data, ACCENT) + 18;
  drawCanvasDivider(ctx, W, y);
  y += 14;
  drawCanvasExercises(ctx, W, y, data, ACCENT);
  drawCanvasFooter(ctx, W, H);
  ctx.restore();
}

// ─── Canvas: PR (orange accent) ─────────────────────────────────────────────

function drawPRCanvas(
  canvas: HTMLCanvasElement, data: WorkoutSummaryData, logo: HTMLImageElement | null,
) {
  const ctx = canvasSetup(canvas, "#1a1109", "#0a0603", "#f97316", 0.24);
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  const ACCENT = "#f97316";

  ctx.save();
  drawCanvasHeader(ctx, W, ACCENT, logo);

  let y = 62;
  drawCanvasDivider(ctx, W, y);
  y += 18;

  // PR banner
  const bH = 38;
  roundRectPath(ctx, 20, y, W - 40, bH, 12);
  ctx.fillStyle = "rgba(249,115,22,0.18)";
  ctx.fill();
  ctx.strokeStyle = "rgba(249,115,22,0.40)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = ACCENT;
  ctx.font = `800 13px ${FONT}`;
  ctx.textAlign = "center";
  ctx.save();
  roundRectPath(ctx, 20, y, W - 40, bH, 12);
  ctx.clip();
  const pBannerTxt = data.prExercises.length === 1
    ? `NOVO RECORDE: ${data.prExercises[0].name} — ${data.prExercises[0].newBestKg}kg`
    : `${data.prExercises.length} NOVOS RECORDES PESSOAIS`;
  ctx.fillText(pBannerTxt, W / 2, y + 25);
  ctx.restore();
  y += bH + 18;

  // Trophy (drawn)
  const tX = W / 2, tY = y + 22;
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Cup
  ctx.beginPath();
  ctx.moveTo(tX - 14, tY - 16);
  ctx.lineTo(tX + 14, tY - 16);
  ctx.quadraticCurveTo(tX + 16, tY - 2, tX, tY + 6);
  ctx.quadraticCurveTo(tX - 16, tY - 2, tX - 14, tY - 16);
  ctx.stroke();
  // Handles
  ctx.beginPath();
  ctx.moveTo(tX - 14, tY - 12);
  ctx.quadraticCurveTo(tX - 22, tY - 6, tX - 14, tY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(tX + 14, tY - 12);
  ctx.quadraticCurveTo(tX + 22, tY - 6, tX + 14, tY);
  ctx.stroke();
  // Stem + base
  ctx.beginPath();
  ctx.moveTo(tX, tY + 6);
  ctx.lineTo(tX, tY + 16);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(tX - 10, tY + 16);
  ctx.lineTo(tX + 10, tY + 16);
  ctx.stroke();
  y += 56;

  // PR rows
  const maxPR = Math.min(2, data.prExercises.length);
  data.prExercises.slice(0, maxPR).forEach((pr) => {
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 13px ${FONT}`;
    ctx.textAlign = "center";
    let txt = pr.previousBestKg > 0
      ? `${pr.name}  ${pr.previousBestKg}kg → ${pr.newBestKg}kg`
      : `${pr.name}  ${pr.newBestKg}kg`;
    while (ctx.measureText(txt).width > W - 48 && txt.length > 3) txt = txt.slice(0, -2) + "…";
    ctx.fillText(txt, W / 2, y);
    y += 22;
  });
  if (data.prExercises.length > maxPR) {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = `500 11px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(`+${data.prExercises.length - maxPR} mais`, W / 2, y);
    y += 18;
  }
  y += 8;

  y = drawCanvasStats(ctx, W, y, data, ACCENT) + 16;
  drawCanvasDivider(ctx, W, y);
  y += 14;
  drawCanvasExercises(ctx, W, y, data, ACCENT);
  drawCanvasFooter(ctx, W, H);
  ctx.restore();
}

// ─── Canvas: Machine Max (gold accent) ──────────────────────────────────────

function drawMachineMaxCanvas(
  canvas: HTMLCanvasElement, data: WorkoutSummaryData, logo: HTMLImageElement | null,
) {
  const ctx = canvasSetup(canvas, "#1a1200", "#0c0900", "#eab308", 0.26);
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  const ACCENT = "#eab308";

  // Extra center glow
  const glow2 = ctx.createRadialGradient(W / 2, H * 0.38, 0, W / 2, H * 0.38, 140);
  glow2.addColorStop(0, "rgba(234,179,8,0.14)");
  glow2.addColorStop(1, "rgba(234,179,8,0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  drawCanvasHeader(ctx, W, ACCENT, logo);

  let y = 62;
  drawCanvasDivider(ctx, W, y);
  y += 18;

  // "MÁQUINA ZERADA!" banner
  const bH = 46;
  const bGrad = ctx.createLinearGradient(20, y, W - 20, y);
  bGrad.addColorStop(0, "rgba(234,179,8,0.28)");
  bGrad.addColorStop(0.5, "rgba(234,179,8,0.15)");
  bGrad.addColorStop(1, "rgba(234,179,8,0.28)");
  roundRectPath(ctx, 20, y, W - 40, bH, 14);
  ctx.fillStyle = bGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(234,179,8,0.55)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = ACCENT;
  ctx.font = `900 15px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("MAQUINA ZERADA", W / 2, y + 29);
  y += bH + 18;

  // Big kg number
  const top = data.machinedExercises[0];
  ctx.fillStyle = ACCENT;
  ctx.font = `900 52px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(`${top.kg}kg`, W / 2, y + 44);
  y += 58;

  // Exercise name
  ctx.fillStyle = "rgba(255,255,255,0.50)";
  ctx.font = `500 13px ${FONT}`;
  ctx.textAlign = "center";
  let topName = top.name;
  while (ctx.measureText(topName).width > W - 60 && topName.length > 3) {
    topName = topName.slice(0, -2) + "…";
  }
  ctx.fillText(topName, W / 2, y);
  y += 24;

  // Other machined (if any)
  if (data.machinedExercises.length > 1) {
    ctx.fillStyle = ACCENT;
    ctx.font = `600 12px ${FONT}`;
    ctx.textAlign = "center";
    const others = data.machinedExercises.slice(1, 3).map((m) => `${m.name}: ${m.kg}kg`).join("  •  ");
    ctx.fillText(others, W / 2, y);
    y += 20;
  }
  y += 8;

  y = drawCanvasStats(ctx, W, y, data, ACCENT) + 16;
  drawCanvasDivider(ctx, W, y);
  y += 14;
  drawCanvasExercises(ctx, W, y, data, ACCENT);
  drawCanvasFooter(ctx, W, H);
  ctx.restore();
}

function drawCanvas(
  canvas: HTMLCanvasElement, data: WorkoutSummaryData, logo: HTMLImageElement | null,
) {
  const v = getCanvasVariant(data);
  if (v === "machine") return drawMachineMaxCanvas(canvas, data, logo);
  if (v === "pr") return drawPRCanvas(canvas, data, logo);
  return drawStandardCanvas(canvas, data, logo);
}

// ─── Component ──────────────────────────────────────────────────────────────

interface WorkoutSummaryOverlayProps {
  data: WorkoutSummaryData;
  onClose: () => void;
  /** Chamado após publicar no feed com sucesso — usado para navegar até o feed. */
  onSharedToFeed?: () => void;
}

export function WorkoutSummaryOverlay({ data, onClose, onSharedToFeed }: WorkoutSummaryOverlayProps) {
  const { t } = useLanguage();

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const carouselRef = React.useRef<HTMLDivElement>(null);

  const [description, setDescription] = React.useState(() => generateDefaultDescription(data));
  const [userPhoto, setUserPhoto] = React.useState<File | null>(null);
  const [userPhotoPreview, setUserPhotoPreview] = React.useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = React.useState(0);
  const [canvasPreviewUrl, setCanvasPreviewUrl] = React.useState<string | null>(null);
  const [isSharing, setIsSharing] = React.useState(false);
  const [shareTarget, setShareTarget] = React.useState<"feed" | "duel" | null>(null);
  const [showGroupPicker, setShowGroupPicker] = React.useState(false);
  const [showAllExercises, setShowAllExercises] = React.useState(false);

  const variant = getCanvasVariant(data);
  const hasPRs = data.prExercises.length > 0;
  const hasMachined = data.machinedExercises.length > 0;
  const totalSlides = userPhotoPreview ? 2 : 1;

  // Tokens "liquid glass" — tons brancos translúcidos sobre o shell escuro
  const CARD    = "rgba(255,255,255,0.06)";   // painel de vidro
  const FG      = "#fff";
  const MUTED   = "rgba(255,255,255,0.55)";
  const ORANGE  = "hsl(var(--brand-2))";
  const BORDER  = "rgba(255,255,255,0.12)";
  const SURFACE = "rgba(255,255,255,0.10)";

  // Accent colors per variant (non-CSS-var, for inline button styles)
  const accentHex = variant === "machine" ? "#eab308" : variant === "pr" ? "#f97316" : "#22c55e";
  const headerTitle = hasMachined
    ? "Máquina zerada! 🔥"
    : hasPRs
    ? "Novo recorde! 🏆"
    : "Treino concluído! 💪";

  // Draw off-screen canvas
  React.useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    canvasRef.current = canvas;
    // Aguarda as fontes E o logo antes de desenhar, para o card sair completo.
    Promise.all([document.fonts.ready, loadLogo()]).then(([, logo]) => {
      drawCanvas(canvas, data, logo);
      setCanvasPreviewUrl(canvas.toDataURL("image/png"));
    });
  }, [data]);

  // Cleanup photo preview URL
  React.useEffect(() => {
    return () => { if (userPhotoPreview) URL.revokeObjectURL(userPhotoPreview); };
  }, [userPhotoPreview]);

  // Track carousel scroll position
  const handleCarouselScroll = () => {
    const el = carouselRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.offsetWidth);
    setCurrentSlide(Math.max(0, Math.min(idx, totalSlides - 1)));
  };

  const handlePhotoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (userPhotoPreview) URL.revokeObjectURL(userPhotoPreview);
    setUserPhoto(file);
    setUserPhotoPreview(URL.createObjectURL(file));
    // Scroll to photo slide (first)
    setTimeout(() => {
      const el = carouselRef.current;
      if (el) el.scrollTo({ left: 0, behavior: "smooth" });
      setCurrentSlide(0);
    }, 50);
    e.target.value = "";
  };

  const removePhoto = () => {
    if (userPhotoPreview) URL.revokeObjectURL(userPhotoPreview);
    setUserPhoto(null);
    setUserPhotoPreview(null);
    setTimeout(() => {
      const el = carouselRef.current;
      if (el) el.scrollTo({ left: 0, behavior: "smooth" });
      setCurrentSlide(0);
    }, 50);
  };

  const getCanvasBlob = (): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const canvas = canvasRef.current;
      if (!canvas) return reject(new Error("Canvas não pronto"));
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao gerar imagem"))),
        "image/png",
      );
    });

  const handleShareFeed = async () => {
    setIsSharing(true);
    setShareTarget("feed");
    try {
      const urls: string[] = [];
      // Photo first (if any)
      if (userPhoto) {
        const url = await uploadWorkoutImageDb(data.userId, userPhoto);
        urls.push(url);
      }
      // Canvas always included
      const blob = await getCanvasBlob();
      urls.push(await uploadWorkoutImageDb(data.userId, blob));

      await createPostDb(urls, description.trim() || t("goals_summary_share_default_desc"));
      toast({ title: t("goals_summary_shared_feed"), description: t("goals_summary_shared_feed_desc") });
      // Leva o usuário ao feed para ver a publicação recém-criada (fallback: só fecha).
      if (onSharedToFeed) onSharedToFeed();
      else onClose();
    } catch (err: any) {
      toast({ title: t("goals_summary_share_error"), description: err?.message, variant: "destructive" });
    } finally {
      setIsSharing(false);
      setShareTarget(null);
    }
  };

  const handleShareAllDuels = async () => {
    setIsSharing(true);
    setShareTarget("duel");
    setShowGroupPicker(false);
    try {
      const blob = await getCanvasBlob();
      const canvasUrl = await uploadWorkoutImageDb(data.userId, blob);
      const extraPhotos: string[] = [];
      if (userPhoto) extraPhotos.push(await uploadWorkoutImageDb(data.userId, userPhoto));

      const exercises = data.completedExercises.map((ex) => ({
        workoutId: "", workoutName: ex.name, muscleGroup: ex.muscleGroup,
        kilos: ex.bestKg || null,
        volume: ex.totalSets > 0 ? `${ex.totalSets} séries` : null,
      }));

      const desc = description.trim() || t("goals_summary_share_default_desc");

      await Promise.all(
        data.userGroups.map((g) =>
          addGroupCheckInDb(
            g.id, data.userId, canvasUrl, desc,
            data.routineName, data.totalSeries, data.totalVolume,
            null, exercises, extraPhotos,
            Math.round(data.durationSecs / 60), null, null, null,
          ),
        ),
      );
      toast({ title: t("goals_summary_shared_duel"), description: t("goals_summary_shared_duel_desc") });
      onClose();
    } catch (err: any) {
      toast({ title: t("goals_summary_share_error"), description: err?.message, variant: "destructive" });
    } finally {
      setIsSharing(false);
      setShareTarget(null);
    }
  };

  const handleShareDuel = async (groupId: string) => {
    setIsSharing(true);
    setShareTarget("duel");
    setShowGroupPicker(false);
    try {
      const blob = await getCanvasBlob();
      const canvasUrl = await uploadWorkoutImageDb(data.userId, blob);
      const extraPhotos: string[] = [];
      if (userPhoto) extraPhotos.push(await uploadWorkoutImageDb(data.userId, userPhoto));

      const exercises = data.completedExercises.map((ex) => ({
        workoutId: "", workoutName: ex.name, muscleGroup: ex.muscleGroup,
        kilos: ex.bestKg || null,
        volume: ex.totalSets > 0 ? `${ex.totalSets} séries` : null,
      }));

      await addGroupCheckInDb(
        groupId, data.userId, canvasUrl,
        description.trim() || t("goals_summary_share_default_desc"),
        data.routineName, data.totalSeries, data.totalVolume,
        null, exercises, extraPhotos,
        Math.round(data.durationSecs / 60), null, null, null,
      );
      toast({ title: t("goals_summary_shared_duel"), description: t("goals_summary_shared_duel_desc") });
      onClose();
    } catch (err: any) {
      toast({ title: t("goals_summary_share_error"), description: err?.message, variant: "destructive" });
    } finally {
      setIsSharing(false);
      setShareTarget(null);
    }
  };

  const displayedExercises = showAllExercises
    ? data.completedExercises
    : data.completedExercises.slice(0, 4);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9500,
        background: GLASS_ROOT_BG,
        display: "flex", flexDirection: "column",
        overflowY: "auto",
        // Mantém o resumo interativo mesmo se um modal Radix tiver deixado
        // pointer-events:none no body — este overlay é a camada de topo.
        pointerEvents: "auto",
        paddingTop: "max(0px, env(safe-area-inset-top))",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* ── Auras de fundo (liquid glass) — fixas para não rolarem ── */}
      <div style={{
        pointerEvents: "none", position: "fixed", zIndex: -1,
        width: 340, height: 340, left: -60, top: 30, borderRadius: "50%",
        background: "radial-gradient(circle,#ff7a3c,transparent 70%)",
        filter: "blur(80px)", opacity: 0.26,
      }} />
      <div style={{
        pointerEvents: "none", position: "fixed", zIndex: -1,
        width: 320, height: 320, right: -80, top: "42%", borderRadius: "50%",
        background: "radial-gradient(circle,#3f7fe6,transparent 70%)",
        filter: "blur(80px)", opacity: 0.24,
      }} />
      <div style={{
        pointerEvents: "none", position: "fixed", zIndex: -1,
        width: 300, height: 300, left: "25%", bottom: -130, borderRadius: "50%",
        background: "radial-gradient(circle,#9d6bff,transparent 70%)",
        filter: "blur(80px)", opacity: 0.2,
      }} />

      {/* ── Header ── */}
      <div style={{
        position: "relative", zIndex: 10,
        background: GLASS_BAR_BG,
        backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
        paddingTop: "max(12px, env(safe-area-inset-top))",
        paddingLeft: "max(16px, env(safe-area-inset-left))",
        paddingRight: "max(16px, env(safe-area-inset-right))",
        paddingBottom: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: FG }}>{headerTitle}</div>
        <button
          onClick={onClose}
          aria-label={t("goals_summary_close")}
          style={{
            width: 34, height: 34, borderRadius: "50%",
            background: SURFACE, border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2l10 10M12 2l-10 10" stroke={FG} strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* ── Carousel ── */}
      <div style={{ position: "relative" }}>
        <div
          ref={carouselRef}
          onScroll={handleCarouselScroll}
          style={{
            display: "flex",
            overflowX: "auto",
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch" as any,
            scrollbarWidth: "none" as any,
            msOverflowStyle: "none" as any,
          }}
        >
          {/* User photo slide (shown first when available) */}
          {userPhotoPreview && (
            <div style={{ flex: "0 0 100%", scrollSnapAlign: "start", padding: "12px 16px 4px" }}>
              <img
                src={userPhotoPreview}
                alt="Sua foto"
                style={{
                  width: "100%", borderRadius: 20, objectFit: "cover",
                  aspectRatio: `${CANVAS_W}/${CANVAS_H}`, display: "block",
                  boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
                }}
              />
            </div>
          )}

          {/* Canvas slide */}
          <div style={{ flex: "0 0 100%", scrollSnapAlign: "start", padding: "12px 16px 4px" }}>
            {canvasPreviewUrl ? (
              <img
                src={canvasPreviewUrl}
                alt="Resumo do treino"
                style={{
                  width: "100%", borderRadius: 20, display: "block",
                  boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
                }}
              />
            ) : (
              <div style={{
                width: "100%", aspectRatio: `${CANVAS_W}/${CANVAS_H}`,
                borderRadius: 20, background: CARD,
                animation: "pulse 1.5s ease-in-out infinite",
              }} />
            )}
          </div>
        </div>

        {/* Camera icon — always visible bottom-right of carousel */}
        <button
          onClick={() => fileInputRef.current?.click()}
          aria-label={t("goals_summary_add_photo")}
          style={{
            position: "absolute",
            bottom: totalSlides > 1 ? 38 : 22,
            right: 26,
            width: 40, height: 40, borderRadius: "50%",
            background: "rgba(0,0,0,0.58)", backdropFilter: "blur(6px)",
            border: "1.5px solid rgba(255,255,255,0.25)",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 2,
          }}
        >
          <svg width="18" height="16" viewBox="0 0 18 16" fill="none">
            <path d="M6.5 1H11.5L13 3H16C16.55 3 17 3.45 17 4V13C17 13.55 16.55 14 16 14H2C1.45 14 1 13.55 1 13V4C1 3.45 1.45 3 2 3H5L6.5 1Z"
              stroke="white" strokeWidth="1.4" strokeLinejoin="round"/>
            <circle cx="9" cy="8.5" r="2.5" stroke="white" strokeWidth="1.4"/>
          </svg>
        </button>

        {/* Remove photo button — top-right, only on photo slide */}
        {userPhotoPreview && currentSlide === 0 && (
          <button
            onClick={removePhoto}
            aria-label={t("goals_summary_remove_photo")}
            style={{
              position: "absolute", top: 22, right: 26,
              width: 32, height: 32, borderRadius: "50%",
              background: "rgba(0,0,0,0.58)", backdropFilter: "blur(6px)",
              border: "1.5px solid rgba(255,255,255,0.25)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 2,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        )}

        {/* Dots indicator */}
        {totalSlides > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 6, padding: "6px 0 2px" }}>
            {Array.from({ length: totalSlides }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: 6, borderRadius: 3,
                  width: currentSlide === i ? 18 : 6,
                  background: currentSlide === i ? accentHex : "rgba(255,255,255,0.25)",
                  transition: "width 0.2s, background 0.2s",
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Machine Max Banner ── */}
      {hasMachined && (
        <div style={{ margin: "10px 16px 0" }}>
          <div style={{
            background: "rgba(234,179,8,0.12)",
            border: "1px solid rgba(234,179,8,0.40)",
            borderRadius: 16, padding: "14px 16px",
          }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#eab308", marginBottom: 10 }}>
              ⚡ Máquina zerada!
            </div>
            {data.machinedExercises.map((m) => (
              <div
                key={m.name}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: 10,
                  paddingTop: 6, borderTop: "1px solid rgba(234,179,8,0.18)",
                }}
              >
                <div style={{
                  fontSize: 14, fontWeight: 600, color: FG,
                  flex: 1, minWidth: 0,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {m.name}
                </div>
                <span style={{
                  background: "#eab308", color: "#000",
                  borderRadius: 20, padding: "2px 12px",
                  fontSize: 14, fontWeight: 900, whiteSpace: "nowrap", flexShrink: 0,
                }}>
                  {m.kg}kg
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PR Banner ── */}
      {hasPRs && !hasMachined && (
        <div style={{ margin: "10px 16px 0" }}>
          <div style={{
            background: `${ORANGE}1A`,
            border: `1px solid ${ORANGE}4D`,
            borderRadius: 16, padding: "14px 16px",
          }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: ORANGE, marginBottom: 10 }}>
              🏆 {t("goals_summary_pr_title")}
            </div>
            {data.prExercises.map((pr) => (
              <div
                key={pr.name}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: 10,
                  paddingTop: 6, borderTop: `1px solid ${ORANGE}22`,
                }}
              >
                <div style={{
                  fontSize: 14, fontWeight: 600, color: FG,
                  flex: 1, minWidth: 0,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {pr.name}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  {pr.previousBestKg > 0 && (
                    <span style={{ fontSize: 12, color: MUTED, textDecoration: "line-through", whiteSpace: "nowrap" }}>
                      {pr.previousBestKg}kg
                    </span>
                  )}
                  <span style={{
                    background: ORANGE, color: "#fff",
                    borderRadius: 20, padding: "2px 10px",
                    fontSize: 13, fontWeight: 800, whiteSpace: "nowrap",
                  }}>
                    {pr.newBestKg}kg
                  </span>
                  <span style={{
                    background: `${ORANGE}33`, color: ORANGE,
                    borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}>
                    {t("goals_summary_pr_badge")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Stats row ── */}
      <div style={{ display: "flex", gap: 8, padding: "12px 16px 4px" }}>
        {[
          { label: t("goals_summary_duration"), value: formatSummaryDuration(data.durationSecs) },
          { label: t("goals_summary_sets"), value: String(data.totalSeries) },
          ...(data.totalVolume > 0 ? [{ label: t("goals_summary_volume"), value: `${data.totalVolume} kg` }] : []),
        ].map(({ label, value }) => (
          <div key={label} style={{
            flex: 1, background: CARD, borderRadius: 16, padding: "12px 8px", textAlign: "center",
            border: `1px solid ${BORDER}`,
            backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
          }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: FG }}>{value}</div>
            <div style={{
              fontSize: 10, color: MUTED, marginTop: 3,
              textTransform: "uppercase", letterSpacing: 0.5,
            }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Badges ── */}
      {data.badges.length > 0 && (
        <div style={{
          margin: "4px 16px 0",
          background: `${ORANGE}1A`, border: `1px solid ${ORANGE}4D`,
          borderRadius: 14, padding: "12px 14px",
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: ORANGE, marginBottom: 8 }}>
            🏆 {t("goals_summary_badges")}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {data.badges.map((b) => (
              <span key={b} style={{
                background: `${ORANGE}33`, color: ORANGE,
                borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600,
              }}>
                {b}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Exercise list ── */}
      {data.completedExercises.length > 0 && (
        <div style={{ padding: "16px 16px 0" }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: MUTED,
            textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10,
          }}>
            {t("goals_summary_exercises_done")}
          </div>
          <div style={{
            background: CARD, borderRadius: 18, overflow: "hidden",
            border: `1px solid ${BORDER}`,
            backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
          }}>
            {displayedExercises.map((ex, idx) => (
              <div
                key={ex.name + idx}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "11px 14px",
                  borderBottom: idx < displayedExercises.length - 1 ? `1px solid ${BORDER}` : "none",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 600, color: FG,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {ex.name}
                  </div>
                  {ex.muscleGroup && (
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{ex.muscleGroup}</div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: MUTED }}>
                    {ex.totalSets}×
                  </span>
                  {ex.bestKg > 0 && (
                    <span style={{
                      background: `${accentHex}22`, color: accentHex,
                      borderRadius: 20, padding: "2px 10px", fontSize: 13, fontWeight: 700,
                    }}>
                      {ex.bestKg}kg
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {data.completedExercises.length > 4 && (
            <button
              onClick={() => setShowAllExercises((v) => !v)}
              style={{
                marginTop: 8, width: "100%", background: "none", border: "none",
                cursor: "pointer", fontSize: 13, fontWeight: 600, color: accentHex,
                padding: "6px 0", textAlign: "center",
              }}
            >
              {showAllExercises
                ? "Mostrar menos"
                : `${t("goals_summary_show_all")} (+${data.completedExercises.length - 4})`}
            </button>
          )}
        </div>
      )}

      {/* ── Share section ── */}
      <div style={{
        margin: "16px 16px 0",
        borderTop: `1px solid ${BORDER}`,
        paddingTop: 16,
      }}>
        <div style={{
          fontSize: 12, fontWeight: 700, color: MUTED,
          textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12,
        }}>
          {t("goals_summary_share_section")}
        </div>

        {/* Auto-generated description (editable) */}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          style={{
            width: "100%", background: CARD,
            border: `1px solid ${BORDER}`,
            backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
            borderRadius: 16, padding: "12px 14px",
            fontSize: 14, color: FG, lineHeight: 1.5,
            resize: "none", fontFamily: "'Inter', system-ui, sans-serif",
            outline: "none", boxSizing: "border-box",
          }}
        />
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoPick}
        style={{ display: "none" }}
      />

      {/* ── Action buttons ── */}
      <div style={{
        padding: "14px 16px",
        paddingBottom: "max(24px, env(safe-area-inset-bottom))",
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        {/* Share to Feed */}
        <button
          onClick={handleShareFeed}
          disabled={isSharing}
          style={{
            height: 52, borderRadius: 16, border: "none",
            background: isSharing && shareTarget === "feed" ? `${accentHex}99` : accentHex,
            color: variant === "machine" ? "#000" : "#fff",
            fontSize: 15, fontWeight: 700,
            cursor: isSharing ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            opacity: isSharing && shareTarget !== "feed" ? 0.45 : 1,
            transition: "opacity 0.2s",
          }}
        >
          {isSharing && shareTarget === "feed" ? (
            <SpinnerIcon color={variant === "machine" ? "#000" : "#fff"} />
          ) : (
            <ShareIcon color={variant === "machine" ? "#000" : "#fff"} />
          )}
          {isSharing && shareTarget === "feed"
            ? t("goals_summary_sharing_feed")
            : t("goals_summary_share_feed")}
        </button>

        {/* Share to Duel */}
        {data.userGroups.length > 0 && (
          <button
            onClick={() => {
              if (isSharing) return;
              data.userGroups.length === 1
                ? handleShareDuel(data.userGroups[0].id)
                : setShowGroupPicker(true);
            }}
            disabled={isSharing}
            style={{
              height: 52, borderRadius: 16,
              background: CARD, border: `1px solid ${BORDER}`,
              backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
              color: FG, fontSize: 15, fontWeight: 700,
              cursor: isSharing ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              opacity: isSharing && shareTarget !== "duel" ? 0.45 : 1,
              transition: "opacity 0.2s",
            }}
          >
            {isSharing && shareTarget === "duel" ? (
              <SpinnerIcon color={FG} />
            ) : (
              <DuelIcon color={FG} />
            )}
            {isSharing && shareTarget === "duel"
              ? t("goals_summary_sharing_duel")
              : t("goals_summary_share_duel")}
            {data.userGroups.length > 1 && !isSharing && (
              <span style={{
                background: SURFACE, borderRadius: 20,
                padding: "1px 8px", fontSize: 11, fontWeight: 600, color: MUTED,
              }}>
                {data.userGroups.length}
              </span>
            )}
          </button>
        )}

        {/* Close */}
        <button
          onClick={onClose}
          style={{
            height: 46, borderRadius: 16, border: "none",
            background: "none", color: MUTED, fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}
        >
          {t("goals_summary_close")}
        </button>
      </div>

      {/* ── Group picker sheet ── */}
      {showGroupPicker && (
        <div
          onClick={() => setShowGroupPicker(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 10000,
            background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "flex-end",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              background: "linear-gradient(rgba(40,38,54,0.92),rgba(18,16,28,0.96))",
              backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
              borderTop: `1px solid ${BORDER}`,
              borderRadius: "28px 28px 0 0",
              padding: "20px 16px",
              paddingBottom: "max(24px, env(safe-area-inset-bottom))",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color: FG, marginBottom: 16, textAlign: "center" }}>
              {t("goals_summary_choose_group")}
            </div>

            {/* Share to all groups */}
            <button
              onClick={handleShareAllDuels}
              style={{
                width: "100%",
                background: `${accentHex}18`,
                border: `1.5px solid ${accentHex}55`,
                borderRadius: 14, padding: "14px 16px", marginBottom: 14,
                cursor: "pointer", textAlign: "left",
                fontSize: 14, fontWeight: 700, color: accentHex,
                display: "flex", alignItems: "center", gap: 10,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="5" cy="9" r="2.5" stroke={accentHex} strokeWidth="1.5"/>
                <circle cx="13" cy="5" r="2.5" stroke={accentHex} strokeWidth="1.5"/>
                <circle cx="13" cy="13" r="2.5" stroke={accentHex} strokeWidth="1.5"/>
                <path d="M7.5 8L10.5 6M7.5 10l3 2" stroke={accentHex} strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              {t("goals_summary_share_all_groups")}
              <span style={{
                marginLeft: "auto",
                background: `${accentHex}33`, color: accentHex,
                borderRadius: 20, padding: "2px 10px",
                fontSize: 12, fontWeight: 700,
              }}>
                {data.userGroups.length}
              </span>
            </button>

            {/* Divider */}
            <div style={{
              borderTop: `1px solid ${BORDER}`,
              marginBottom: 12,
            }} />

            {data.userGroups.map((g) => (
              <button
                key={g.id}
                onClick={() => handleShareDuel(g.id)}
                style={{
                  width: "100%", background: SURFACE, border: "none",
                  borderRadius: 14, padding: "14px 16px", marginBottom: 8,
                  cursor: "pointer", textAlign: "left",
                  fontSize: 14, fontWeight: 600, color: FG,
                  display: "flex", alignItems: "center", gap: 10,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="7" r="3.5" stroke={accentHex} strokeWidth="1.5"/>
                  <path d="M2 16c0-3.31 3.13-6 7-6s7 2.69 7 6" stroke={accentHex} strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                {g.name}
              </button>
            ))}
            <button
              onClick={() => setShowGroupPicker(false)}
              style={{
                width: "100%", background: "none", border: "none",
                padding: "12px 0", cursor: "pointer",
                fontSize: 14, fontWeight: 600, color: MUTED,
              }}
            >
              {t("goals_cancel")}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        div[style*="scrollSnapType"]::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

// ─── Small icon components ────────────────────────────────────────────────────

function SpinnerIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
      style={{ animation: "spin 1s linear infinite", flexShrink: 0 }}>
      <circle cx="8" cy="8" r="6.5" stroke={`${color}44`} strokeWidth="2"/>
      <path d="M8 1.5a6.5 6.5 0 0 1 6.5 6.5" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function ShareIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="4" r="2.5" stroke={color} strokeWidth="1.5"/>
      <circle cx="4" cy="8" r="2.5" stroke={color} strokeWidth="1.5"/>
      <circle cx="12" cy="12" r="2.5" stroke={color} strokeWidth="1.5"/>
      <path d="M6.5 7L9.5 5M6.5 9l3 2" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function DuelIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M5 4h6M5 8h6M5 12h3" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <rect x="1.5" y="1.5" width="13" height="13" rx="3" stroke={color} strokeWidth="1.5"/>
    </svg>
  );
}
