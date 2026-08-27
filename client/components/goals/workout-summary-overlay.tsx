import * as React from "react";
import { ChevronLeft, ChevronRight, UserRoundPlus, X } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { toast } from "@/components/ui/use-toast";
import {
  createPostDb,
  addGroupCheckInDb,
  uploadWorkoutImageDb,
  saveRoutineFromWorkoutPartyDb,
  type SearchUser,
  type WorkoutPartySnapshot,
} from "@/lib/ritmofit-db";
import { TagPeopleDrawer } from "@/components/shared/tag-people-drawer";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  InlineCropPreview,
  type CropTransform,
  DEFAULT_TRANSFORM,
  applyTransformToBlob,
} from "@/components/shared/inline-crop-preview";
import { renderRouteMapImage } from "@/components/shared/route-map";
import { RunSplitsList } from "@/components/shared/run-splits";
import { useKeyboardInputScroll } from "@/hooks/use-keyboard-input-scroll";
import { addNetworkStatusListener, getNetworkStatus } from "@/lib/network-status";
import { reportHandledError } from "@/lib/monitoring";
import { formatRunTime, formatRunPace, type RunPoint, type RunSplit } from "@/lib/run-tracker";
import type { PostWorkoutSummary } from "@/lib/workout-summary-types";
import {
  formatCardioKm,
  formatCardioMinutes,
  formatElevationPct,
  type CardioKind,
} from "@/lib/cardio-exercises";
import {
  CARDIO_KIND_META,
  drawCardioCanvas,
  formatCardioLine,
  getCardioBreakdown,
  sumCardioSets,
  type CardioGroup,
} from "./cardio-canvas";
import {
  CANVAS_W,
  CANVAS_H,
  FONT,
  roundRectPath,
  hexToRgb,
  fitFontSize,
  loadLogo,
  createCardCanvas,
  cardCanvasToBlob,
  cardCanvasPreviewUrl,
  canvasSetup,
  drawCanvasHeader,
  drawCanvasDivider,
  drawCanvasFooter,
  drawCanvasStatPanels,
} from "@/lib/canvas-card";
import { FEATURES } from "@/lib/feature-flags";

// ─── Types ──────────────────────────────────────────────────────────────────

export type WorkoutSummaryData = {
  routineName: string;
  /**
   * Treinar junto: apelidos de quem estava na mesma sessão. Rende a linha
   * "Treino em grupo com …" no topo do resumo. Ausente = treino solo.
   */
  partyMemberNames?: string[];
  /**
   * Só no CONVIDADO: a oferta de salvar a rotina do amigo como rotina própria.
   * É a única vez em que essa pergunta aparece — aceitar o convite NÃO cria
   * rotina nenhuma, de propósito (ver `docs/migrations/20260826-workout-party.sql`).
   * `null`/ausente no host e em todo treino solo.
   */
  partySaveOffer?: {
    hostNickname: string;
    snapshot: WorkoutPartySnapshot;
  } | null;
  totalSeries: number;
  totalVolume: number;
  durationSecs: number;
  badges: string[];
  userId: string;
  // Meta vinculada à rotina (user_goals.id). Quando presente, o post gerado ao
  // compartilhar no feed é vinculado a essa meta (posts.user_goal_id) e o feed
  // exibe a barra de progresso da meta — igual a um post criado pelo NewPost com
  // meta selecionada. Opcional: rotina sem meta, snapshots antigos e duelo (que
  // é check-in, não post) não preenchem. NÃO incrementa o progresso da meta — o
  // check-in do treino já fez isso ao finalizar (evita contar 2x).
  userGoalId?: string | null;
  completedExercises: Array<{
    name: string;
    // ID no catálogo `workouts`, usado pela comparação de treino para casar o
    // mesmo exercício entre duas pessoas. Opcional: o fluxo de duelo e os
    // snapshots anteriores a 26/08/2026 não preenchem.
    workoutId?: string;
    totalSets: number;
    bestKg: number;
    muscleGroup: string | null;
    // Foto do exercício (miniatura no detalhe do feed). Opcional: snapshots antigos
    // e o fluxo de duelo não preenchem este campo.
    photo?: string | null;
    // Carga (kg) e repetições de cada série concluída, em ordem. Opcional: resumos
    // persistidos antes desta feature (routines.last_summary) não têm este campo.
    // Para cardio (isCardio), kg = MINUTOS e reps = KM.
    // `elev` = inclinação (%) da esteira naquela série; só vem quando informada.
    sets?: Array<{ kg: number; reps: number; elev?: number }>;
    // Cardio (corrida/bike) → detalhe deve mostrar min×km. Ausente = não-cardio.
    isCardio?: boolean;
    // MAIOR inclinação entre as séries — o número único do card e das listas,
    // que não têm espaço para detalhar série a série. Ausente/null = nenhuma.
    elevationPct?: number | null;
  }>;
  prExercises: Array<{
    name: string;
    previousBestKg: number;
    newBestKg: number;
    /**
     * Tipo do recorde — ver `PrKind` em `workout-session-dialog.tsx`. **Ausente
     * = recorde de carga**: é o que representam os resumos já persistidos em
     * `posts`/`routines.last_summary` e tudo que o modo simplificado produz.
     */
    kind?: "weight" | "reps" | "e1rm";
    previousReps?: number;
    newReps?: number;
    previousE1rm?: number;
    newE1rm?: number;
  }>;
  machinedExercises: Array<{ name: string; kg: number }>;
  /**
   * Gasto calórico da sessão (kcal) — estimado pelo app e ajustável pela pessoa
   * na tela de treino. Opcional: snapshots persistidos antes de 21/08/2026,
   * sessões sem base para estimar e o fluxo de duelo não preenchem.
   */
  caloriesKcal?: number | null;
  userGroups: Array<{ id: string; name: string }>;
  // Corrida GPS da sessão (Corrida ao Ar Livre) — quando presente e com
  // trajeto, o resumo ganha um slide de MAPA compartilhável (renderizado em
  // imagem) entre as fotos do usuário e o card gerado. Opcional: resumos
  // persistidos (routines.last_summary) e o fluxo de duelo não têm este campo.
  run?: {
    distanceKm: number;
    elapsedMs: number;
    paceSecPerKm: number | null;
    path: RunPoint[][];
    /**
     * Tempo e ritmo de cada km percorrido (o último pode ser parcial) — vira a
     * seção "Parciais por km" do resumo. Opcional: corridas registradas antes
     * desta feature e o fluxo de duelo não têm este campo.
     */
    splits?: RunSplit[];
  } | null;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatSummaryDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${secs}s`;
}

function formatVolumeKg(kg: number): string {
  if (kg >= 1000) {
    return `${(kg / 1000).toFixed(1).replace(".", ",")} t`;
  }
  return `${kg}kg`;
}

/**
 * Soma do que a pessoa REGISTROU nos exercícios de cardio da sessão: minutos
 * (campo MIN) e km (campo KM). São números digitados por ela — diferentes do
 * `durationSecs`, que é o cronômetro da sessão inteira e inclui preparação,
 * descanso e qualquer tempo com o treino aberto sem estar treinando.
 */
function getSessionCardioTotals(
  exercises: WorkoutSummaryData["completedExercises"],
): { minutes: number; km: number } {
  return exercises.reduce(
    (acc, ex) => {
      if (!ex.isCardio) return acc;
      const { minutes, km } = sumCardioSets(ex.sets);
      return { minutes: acc.minutes + minutes, km: acc.km + km };
    },
    { minutes: 0, km: 0 },
  );
}

/**
 * Sessão 100% cardio. Importa porque "séries" não é um dado que a pessoa
 * informa em cardio — ela registra MINUTOS e KM —, então o número de séries não
 * deve ocupar um painel do card quando não há mais nada de força na sessão.
 * Resumos persistidos antes do campo `isCardio` caem no `false` (comportamento
 * antigo preservado).
 */
function isCardioOnlySession(exercises: WorkoutSummaryData["completedExercises"]): boolean {
  return exercises.length > 0 && exercises.every((ex) => ex.isCardio);
}

// ─── Auto-generated description ─────────────────────────────────────────────

// Same "most frequent muscle group" logic used by getRecentCompletedRoutinesDb,
// so a check-in shared from here shows the same tag as one added via the
// duel screen's own check-in drawer.
function getPrimaryMuscleGroup(exercises: Array<{ muscleGroup: string | null }>): string | null {
  const counts: Record<string, number> = {};
  exercises.forEach((ex) => {
    if (ex.muscleGroup) counts[ex.muscleGroup] = (counts[ex.muscleGroup] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/**
 * Texto de um recorde para os cards/descrições compartilháveis.
 *
 * Existe porque esses caminhos foram escritos quando TODO PR era de carga e
 * liam `newBestKg` direto. Com os recordes de repetição e de 1RM estimado
 * (modo expert), `newBestKg` passa a ser só o peso da série envolvida — sem
 * este formatador, um recorde de reps seria publicado como se a pessoa tivesse
 * batido carga máxima.
 *
 * `withPrevious` acrescenta a marca anterior quando existe.
 */
function formatPrValue(
  pr: WorkoutSummaryData["prExercises"][number],
  withPrevious: boolean,
): string {
  if (pr.kind === "reps") {
    const now = `${pr.newBestKg}kg × ${pr.newReps} reps`;
    return withPrevious && (pr.previousReps ?? 0) > 0
      ? `${pr.newBestKg}kg × ${pr.previousReps} → ${pr.newReps} reps`
      : now;
  }
  if (pr.kind === "e1rm") {
    const now = `${pr.newE1rm}kg (1RM est.)`;
    return withPrevious && (pr.previousE1rm ?? 0) > 0
      ? `${pr.previousE1rm}kg → ${pr.newE1rm}kg (1RM est.)`
      : now;
  }
  return withPrevious && pr.previousBestKg > 0
    ? `${pr.previousBestKg}kg → ${pr.newBestKg}kg`
    : `${pr.newBestKg}kg`;
}

/** Recorde de CARGA — o único que admite "% de superação" no card gerado. */
function isWeightPr(pr: WorkoutSummaryData["prExercises"][number]): boolean {
  return !pr.kind || pr.kind === "weight";
}

function generateDefaultDescription(data: WorkoutSummaryData): string {
  const duration = formatSummaryDuration(data.durationSecs);
  const volumeStr = data.totalVolume > 0 ? ` • ${data.totalVolume}kg` : "";
  const kcalStr = (data.caloriesKcal ?? 0) > 0 ? ` • ${Math.round(data.caloriesKcal!)} kcal` : "";
  const baseStats = `${duration} • ${data.totalSeries} séries${volumeStr}${kcalStr}`;

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
      .map((p) => `🏆 ${p.name}: ${formatPrValue(p, true)}`)
      .join("\n");
    return `${prLines}\n\nTreino de ${data.routineName} concluído em ${baseStats}\n\n#pr #recordepessoal #fitness #linka`;
  }

  const exNames = data.completedExercises.slice(0, 3).map((e) => e.name).join(", ");
  const exMore = data.completedExercises.length > 3 ? ` +${data.completedExercises.length - 3}` : "";
  const exLine = exNames ? `\n\n${exNames}${exMore}` : "";
  // Corrida GPS da sessão → linha própria com km/tempo/ritmo (estilo Strava)
  const runLine = data.run && data.run.distanceKm > 0
    ? `\n\n🏃 ${data.run.distanceKm.toFixed(2)} km • ${formatRunTime(data.run.elapsedMs)}${data.run.paceSecPerKm ? ` • ${formatRunPace(data.run.paceSecPerKm)}/km` : ""}`
    : "";
  // Cardio da sessão (esteira, bike, remo...) — uma linha por modalidade, com
  // distância/tempo/ritmo. A corrida GPS é pulada quando já tem a linha própria
  // acima, para o texto não repetir os mesmos números.
  const cardioLine = getCardioBreakdown(data.completedExercises)
    .filter((g) => !(runLine && g.kind === "run"))
    .map((g) => `\n${formatCardioLine(g)}`)
    .join("");
  return `Treino de ${data.routineName} concluído! ✅\n\n⏱ ${duration} | 💪 ${data.totalSeries} séries${data.totalVolume > 0 ? ` | 🏋️ ${data.totalVolume}kg` : ""}${kcalStr ? ` | 🔥 ${Math.round(data.caloriesKcal!)} kcal` : ""}${runLine}${cardioLine ? `\n${cardioLine}` : ""}${exLine}\n\n#treino #fitness #linka`;
}

// ─── Persisted payload (posts.workout_summary) ──────────────────────────────

// Converte o WorkoutSummaryData (rico, com dados só-de-UI como userGroups) no
// payload compacto e serializável gravado no post, permitindo que o feed exiba o
// pill "Ver treino" + o modal de detalhe com exercícios/kg×reps. `canvasUrl` é a
// imagem gerada do card, usada como miniatura no modal.
function buildPostWorkoutSummary(
  data: WorkoutSummaryData,
  canvasUrl: string,
  userPhotoCount: number,
): PostWorkoutSummary {
  return {
    // Quantas fotos da galeria/câmera a pessoa anexou — decide se o post vai
    // para a aba "Treinos" (0) ou "Publicações" do perfil. Ver
    // `isWorkoutCanvasPost` em @/lib/workout-summary-types.
    userPhotoCount,
    routineName: data.routineName,
    durationSecs: data.durationSecs,
    totalSeries: data.totalSeries,
    totalVolume: data.totalVolume,
    imageUrl: canvasUrl,
    exercises: data.completedExercises.map((ex) => ({
      name: ex.name,
      // Só vai ao jsonb quando existe — snapshot antigo/duelo continua idêntico.
      ...(ex.workoutId ? { workoutId: ex.workoutId } : {}),
      muscleGroup: ex.muscleGroup,
      bestKg: ex.bestKg,
      photo: ex.photo ?? null,
      // `elev` só é anexado quando existe, para não engordar o jsonb de todo
      // treino de força com um campo nulo por série.
      sets: (ex.sets ?? []).map((s) => {
        const base = { kg: s.kg || 0, reps: s.reps || 0 };
        return s.elev ? { ...base, elev: s.elev } : base;
      }),
      isCardio: ex.isCardio ?? false,
      elevationPct: ex.elevationPct ?? null,
    })),
    prExercises: data.prExercises.length > 0 ? data.prExercises : undefined,
    machinedExercises: data.machinedExercises.length > 0 ? data.machinedExercises : undefined,
    badges: data.badges.length > 0 ? data.badges : undefined,
    caloriesKcal: (data.caloriesKcal ?? 0) > 0 ? Math.round(data.caloriesKcal!) : undefined,
  };
}

// ─── Canvas constants ────────────────────────────────────────────────────────

// CANVAS_W/H/SCALE, FONT e as primitivas de desenho (shell, header, divisores,
// rodapé, painéis de stat) vivem em @/lib/canvas-card — compartilhados com o
// card de meta concluída (goal-share-drawer).
// Mesmo limite usado em NewPost.tsx (MAX_POST_PHOTOS) para manter consistência.
const MAX_SUMMARY_PHOTOS = 5;

// ── Shell "liquid glass" (mesma linguagem do workout-session-dialog) ──────────
const GLASS_ROOT_BG = "linear-gradient(165deg,#1b1828 0%,#100e18 55%,#0a0910 100%)";
const GLASS_BAR_BG  = "rgba(14,13,20,0.72)";
const GLASS_BLUR    = "blur(24px) saturate(180%)";

type CanvasVariant = "standard" | "pr" | "machine";

function getCanvasVariant(data: WorkoutSummaryData): CanvasVariant {
  if (data.machinedExercises.length > 0) return "machine";
  if (data.prExercises.length > 0) return "pr";
  return "standard";
}

// Templates escolhíveis pelo usuário no seletor de estilo. "auto" mantém o
// comportamento clássico (variante padrão/PR/máquina decidida pelos dados);
// os demais são cards "pôster" criativos pensados para gerar empolgação no feed.
// `cardio:{modalidade}` é gerado dinamicamente a partir do que a pessoa fez de
// cardio na sessão (corrida, bike, remo...) — ver cardio-canvas.ts.
type BaseTemplate = "auto" | "comparison" | "impact" | "evolution" | "numbers";
type CanvasTemplate = BaseTemplate | `cardio:${CardioKind}`;

// Acento de cada template (null = usa o acento da variante automática).
const TEMPLATE_ACCENTS: Record<BaseTemplate, string | null> = {
  auto: null,
  comparison: "#38bdf8",
  impact: "#ef4444",
  evolution: "#a78bfa",
  numbers: "#2dd4bf",
};

/** Modalidade de um template de cardio, ou null se for um template clássico. */
function cardioTemplateKind(template: CanvasTemplate): CardioKind | null {
  return template.startsWith("cardio:")
    ? (template.slice("cardio:".length) as CardioKind)
    : null;
}

function templateAccent(template: CanvasTemplate): string | null {
  const kind = cardioTemplateKind(template);
  if (kind) return CARDIO_KIND_META[kind].accent;
  return TEMPLATE_ACCENTS[template as BaseTemplate];
}

// ─── Canvas shared helpers ───────────────────────────────────────────────────

function drawCanvasStats(
  ctx: CanvasRenderingContext2D, W: number, y: number, data: WorkoutSummaryData,
  accent: string,
): number {
  const { minutes: cardioMin, km: cardioKm } = getSessionCardioTotals(data.completedExercises);
  const cardioOnly = isCardioOnlySession(data.completedExercises);
  // Treino só de cardio: o tempo em destaque é o que a pessoa registrou no
  // campo MIN, não o cronômetro da sessão (que conta desde "iniciar treino" e
  // inclui preparação e pausas). Num treino misto a duração da sessão continua
  // valendo — o tempo de cada cardio aparece na lista de exercícios.
  const showCardioTime = cardioOnly && cardioMin > 0;
  // Com distância registrada num treino só de cardio, o painel de séries dá
  // lugar ao de distância: km é o que a pessoa digitou, série não. Cardio sem
  // km (pular corda, esteira anotada só em minutos) mantém séries — senão o
  // card ficaria com um painel solitário.
  const hideSeries = cardioOnly && cardioKm > 0;
  return drawCanvasStatPanels(ctx, W, y, [
    showCardioTime
      ? { l: "TEMPO", v: formatCardioMinutes(cardioMin) }
      : { l: "DURACAO", v: formatSummaryDuration(data.durationSecs) },
    ...(cardioKm > 0 ? [{ l: "DISTANCIA", v: `${formatCardioKm(cardioKm)} km` }] : []),
    ...(hideSeries ? [] : [{ l: "SERIES", v: String(data.totalSeries) }]),
    ...(data.totalVolume > 0 ? [{ l: "VOLUME", v: formatVolumeKg(data.totalVolume) }] : []),
    // Calorias entram como mais um painel quando a sessão registrou o dado.
    // Rótulo sem acento, como os demais deste card (fonte do canvas).
    ...((data.caloriesKcal ?? 0) > 0
      ? [{ l: "CALORIAS", v: `${Math.round(data.caloriesKcal!)} kcal` }]
      : []),
  ], accent);
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
    // Cardio não tem carga: a linha mostra tempo/distância (kg = MIN, reps = KM)
    // em vez de sair só com "1x", sem informação nenhuma.
    const cardio = ex.isCardio ? sumCardioSets(ex.sets) : null;
    const cardioText = cardio
      ? [
          cardio.minutes > 0 ? formatCardioMinutes(cardio.minutes) : null,
          cardio.km > 0 ? `${formatCardioKm(cardio.km)}km` : null,
          // Inclinação da esteira, quando informada.
          ex.elevationPct ? `⛰ ${formatElevationPct(ex.elevationPct)}` : null,
        ].filter(Boolean).join("  ·  ")
      : "";
    const suffix = cardioText
      ? `  ·  ${cardioText}`
      : ex.bestKg > 0
        ? `  ·  ${ex.totalSets}x  ${ex.bestKg}kg`
        : `  ·  ${ex.totalSets}x`;
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

// ─── Canvas: Standard (green accent) ────────────────────────────────────────

function drawStandardCanvas(
  canvas: HTMLCanvasElement, data: WorkoutSummaryData, logo: HTMLImageElement | null,
) {
  const ctx = canvasSetup(canvas, "#1a1726", "#0c0a12", "#22c55e", 0.16);
  if (!ctx) return;
  const W = CANVAS_W, H = CANVAS_H;
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
  const W = CANVAS_W, H = CANVAS_H;
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
    ? `NOVO RECORDE: ${data.prExercises[0].name} — ${formatPrValue(data.prExercises[0], false)}`
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
    let txt = `${pr.name}  ${formatPrValue(pr, true)}`;
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
  const W = CANVAS_W, H = CANVAS_H;
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

// ─── Creative template helpers ───────────────────────────────────────────────

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("pt-BR");
}

// Objetos de comparação do card "Equivalência" — ordenados do mais pesado ao
// mais leve; a seleção pega o mais pesado cuja contagem fica >= ~1 (punchline
// tipo "≈ 2 elefantes" em vez de "≈ 340 melancias").
const COMPARISON_ITEMS: Array<{
  kg: number; emoji: string; singular: string; plural: string;
}> = [
  { kg: 140000, emoji: "🐳", singular: "baleia-azul", plural: "baleias-azuis" },
  { kg: 42000, emoji: "✈️", singular: "avião de passageiros", plural: "aviões de passageiros" },
  { kg: 30000, emoji: "🐋", singular: "baleia-jubarte", plural: "baleias-jubarte" },
  { kg: 13000, emoji: "🚌", singular: "ônibus", plural: "ônibus" },
  { kg: 9000, emoji: "🚚", singular: "caminhão", plural: "caminhões" },
  { kg: 5000, emoji: "🐘", singular: "elefante", plural: "elefantes" },
  { kg: 2500, emoji: "🛻", singular: "caminhonete", plural: "caminhonetes" },
  { kg: 1500, emoji: "🦛", singular: "hipopótamo", plural: "hipopótamos" },
  { kg: 1100, emoji: "🚗", singular: "carro popular", plural: "carros populares" },
  { kg: 700, emoji: "🐄", singular: "vaca", plural: "vacas" },
  { kg: 400, emoji: "🎹", singular: "piano de cauda", plural: "pianos de cauda" },
  { kg: 190, emoji: "🦁", singular: "leão", plural: "leões" },
  { kg: 90, emoji: "🧊", singular: "geladeira", plural: "geladeiras" },
  { kg: 70, emoji: "🧍", singular: "pessoa adulta", plural: "pessoas adultas" },
  { kg: 8, emoji: "🍉", singular: "melancia", plural: "melancias" },
];

// Comparações válidas para o volume (contagem >= ~1), da mais "pesada" para a
// mais leve. O usuário pode alternar entre elas tocando de novo no chip.
function getComparisonOptions(volumeKg: number) {
  const valid = COMPARISON_ITEMS.filter((it) => volumeKg / it.kg >= 0.95);
  if (valid.length === 0) return [COMPARISON_ITEMS[COMPARISON_ITEMS.length - 1]];
  return valid.slice(0, 6);
}

function formatComparisonCount(n: number): string {
  const r = Math.round(n);
  if (n >= 10 || Math.abs(n - r) <= 0.12) return String(Math.max(1, r));
  return n.toFixed(1).replace(".", ",");
}

function impactTier(volumeKg: number): string {
  if (volumeKg >= 15000) return "FORCA SOBRE-HUMANA";
  if (volumeKg >= 8000) return "MODO TITA";
  if (volumeKg >= 3000) return "MODO MONSTRO";
  if (volumeKg >= 1000) return "FORCA BRUTA";
  return "PESO PESADO";
}

// Nome da rotina centralizado no rodapé dos cards pôster (acima do domínio).
function drawRoutineNameLine(
  ctx: CanvasRenderingContext2D, W: number, y: number, routineName: string,
) {
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = `500 12px ${FONT}`;
  ctx.textAlign = "center";
  let label = routineName;
  while (ctx.measureText(label).width > W - 80 && label.length > 3) {
    label = label.slice(0, -2) + "…";
  }
  ctx.fillText(label, W / 2, y);
}

// ─── Canvas: Equivalência (sky accent) — "isso equivale a 2 elefantes" ───────

function drawComparisonCanvas(
  canvas: HTMLCanvasElement, data: WorkoutSummaryData, logo: HTMLImageElement | null,
  optionIndex: number,
) {
  const ctx = canvasSetup(canvas, "#0d1a26", "#070d14", "#38bdf8", 0.20);
  if (!ctx) return;
  const W = CANVAS_W, H = CANVAS_H;
  const ACCENT = "#38bdf8";

  ctx.save();
  drawCanvasHeader(ctx, W, ACCENT, logo);
  drawCanvasDivider(ctx, W, 62);

  const options = getComparisonOptions(data.totalVolume);
  const item = options[optionIndex % options.length];
  const count = data.totalVolume / item.kg;
  const countText = formatComparisonCount(count);

  // "VOCE MOVEU"
  ctx.fillStyle = "rgba(56,189,248,0.70)";
  ctx.font = `700 11px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("VOCE MOVEU", W / 2, 106);

  // Volume gigante com brilho
  const volText = fitFontSize(ctx, `${fmtInt(data.totalVolume)} kg`, W - 90, 54);
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(56,189,248,0.45)";
  ctx.shadowBlur = 26;
  ctx.fillText(volText, W / 2, 168);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = `700 11px ${FONT}`;
  ctx.fillText("ISSO EQUIVALE A", W / 2, 206);

  // Fileira de emojis (até 5 repetidos; acima disso, 1 emoji + multiplicador)
  const rounded = Math.max(1, Math.round(count));
  const emojiRow = rounded > 5
    ? `${item.emoji} ×${fmtInt(rounded)}`
    : Array(Math.min(5, rounded)).fill(item.emoji).join("  ");
  ctx.font = `44px ${FONT}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(emojiRow, W / 2, 272);

  // "≈ 2 elefantes"
  const label = fitFontSize(
    ctx, `≈ ${countText} ${countText === "1" ? item.singular : item.plural}`, W - 70, 24, 800,
  );
  ctx.fillStyle = "#ffffff";
  ctx.fillText(label, W / 2, 318);

  ctx.fillStyle = "rgba(255,255,255,0.40)";
  ctx.font = `500 12px ${FONT}`;
  ctx.fillText("Tudo isso movido pelos seus músculos hoje. 💪", W / 2, 346);

  drawCanvasStats(ctx, W, 380, data, ACCENT);
  drawCanvasDivider(ctx, W, 458);
  drawRoutineNameLine(ctx, W, 484, data.routineName);
  drawCanvasFooter(ctx, W, H);
  ctx.restore();
}

// ─── Canvas: Impacto (red accent) — número gigante + intensidade ─────────────

function drawImpactCanvas(
  canvas: HTMLCanvasElement, data: WorkoutSummaryData, logo: HTMLImageElement | null,
) {
  const ctx = canvasSetup(canvas, "#1c0a0a", "#0d0505", "#ef4444", 0.24);
  if (!ctx) return;
  const W = CANVAS_W, H = CANVAS_H;
  const ACCENT = "#ef4444";

  // Brilho central extra (mesma técnica do card máquina zerada)
  const glow2 = ctx.createRadialGradient(W / 2, H * 0.38, 0, W / 2, H * 0.38, 150);
  glow2.addColorStop(0, "rgba(239,68,68,0.14)");
  glow2.addColorStop(1, "rgba(239,68,68,0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  drawCanvasHeader(ctx, W, ACCENT, logo);
  drawCanvasDivider(ctx, W, 62);

  // Banner do "tier" de força
  const bY = 82, bH = 40;
  roundRectPath(ctx, 20, bY, W - 40, bH, 12);
  ctx.fillStyle = "rgba(239,68,68,0.16)";
  ctx.fill();
  ctx.strokeStyle = "rgba(239,68,68,0.45)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = ACCENT;
  ctx.font = `900 15px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(`🔥 ${impactTier(data.totalVolume)}`, W / 2, bY + 26);

  ctx.fillStyle = "rgba(239,68,68,0.70)";
  ctx.font = `700 11px ${FONT}`;
  ctx.fillText("VOCE MOVEU", W / 2, 158);

  // Número gigante com brilho vermelho
  const volText = fitFontSize(ctx, `${fmtInt(data.totalVolume)} kg`, W - 80, 64);
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(239,68,68,0.55)";
  ctx.shadowBlur = 28;
  ctx.fillText(volText, W / 2, 228);
  ctx.shadowBlur = 0;

  // Intensidade: kg movidos por minuto
  let y = 262;
  if (data.durationSecs >= 60) {
    const kgPerMin = data.totalVolume / (data.durationSecs / 60);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = `700 14px ${FONT}`;
    ctx.fillText(`⚡ ${fmtInt(kgPerMin)} kg por minuto`, W / 2, y);
    y += 26;
  }

  // Maior carga do dia
  const heaviest = data.completedExercises
    .filter((e) => e.bestKg > 0)
    .sort((a, b) => b.bestKg - a.bestKg)[0];
  if (heaviest) {
    ctx.fillStyle = "rgba(255,255,255,0.40)";
    const line = fitFontSize(
      ctx, `Maior carga: ${heaviest.name} — ${heaviest.bestKg}kg`, W - 70, 12, 500,
    );
    ctx.fillText(line, W / 2, y);
  }

  drawCanvasStats(ctx, W, 322, data, ACCENT);
  drawCanvasDivider(ctx, W, 400);
  drawRoutineNameLine(ctx, W, 426, data.routineName);
  drawCanvasFooter(ctx, W, H);
  ctx.restore();
}

// ─── Canvas: Superação (violet accent) — % de evolução / carga máxima ────────

function drawEvolutionCanvas(
  canvas: HTMLCanvasElement, data: WorkoutSummaryData, logo: HTMLImageElement | null,
) {
  const ctx = canvasSetup(canvas, "#171226", "#0b0813", "#a78bfa", 0.22);
  if (!ctx) return;
  const W = CANVAS_W, H = CANVAS_H;
  const ACCENT = "#a78bfa";

  ctx.save();
  drawCanvasHeader(ctx, W, ACCENT, logo);
  drawCanvasDivider(ctx, W, 62);

  // Três modos: PR com base anterior (% de ganho) → PR novo (primeira marca)
  // → sem PR (maior carga do dia), para o card nunca sair vazio.
  // "% de superação" só existe para recorde de CARGA: comparar o peso de hoje
  // com o peso anterior num recorde de repetições daria um ganho de 0%.
  const prsWithPct = data.prExercises
    .filter((p) => isWeightPr(p) && p.previousBestKg > 0)
    .map((p) => ({ ...p, pct: ((p.newBestKg - p.previousBestKg) / p.previousBestKg) * 100 }))
    .sort((a, b) => b.pct - a.pct);

  let label: string, big: string, sub: string;
  let rows: string[];
  if (prsWithPct.length > 0) {
    const top = prsWithPct[0];
    label = "SUPERACAO DO DIA";
    big = `+${top.pct >= 10 ? String(Math.round(top.pct)) : top.pct.toFixed(1).replace(".", ",")}%`;
    sub = `mais forte em ${top.name}`;
    rows = data.prExercises.slice(0, 3).map((p) =>
      isWeightPr(p) && p.previousBestKg <= 0
        ? `${p.name}  ·  ${formatPrValue(p, false)} (primeira marca)`
        : `${p.name}  ·  ${formatPrValue(p, true)}`,
    );
  } else if (data.prExercises.length > 0) {
    const top = data.prExercises[0];
    label = "NOVO RECORDE";
    big = formatPrValue(top, false);
    sub = `em ${top.name}`;
    rows = data.prExercises.slice(0, 3).map((p) => `${p.name}  ·  ${formatPrValue(p, false)}`);
  } else {
    const best = data.completedExercises
      .filter((e) => e.bestKg > 0)
      .sort((a, b) => b.bestKg - a.bestKg);
    label = "CARGA MAXIMA DO DIA";
    big = best[0] ? `${best[0].bestKg}kg` : formatSummaryDuration(data.durationSecs);
    sub = best[0] ? `em ${best[0].name}` : "constância também é superação";
    rows = best.slice(0, 3).map((e) => `${e.name}  ·  ${e.bestKg}kg`);
  }

  ctx.fillStyle = "rgba(167,139,250,0.75)";
  ctx.font = `700 11px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(`📈 ${label}`, W / 2, 108);

  big = fitFontSize(ctx, big, W - 90, 58);
  ctx.fillStyle = ACCENT;
  ctx.shadowColor = "rgba(167,139,250,0.50)";
  ctx.shadowBlur = 26;
  ctx.fillText(big, W / 2, 182);
  ctx.shadowBlur = 0;

  sub = fitFontSize(ctx, sub, W - 70, 13, 500);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText(sub, W / 2, 214);

  let y = 250;
  rows.forEach((row) => {
    let txt = row;
    ctx.font = `600 13px ${FONT}`;
    while (ctx.measureText(txt).width > W - 56 && txt.length > 3) txt = txt.slice(0, -2) + "…";
    ctx.fillStyle = "rgba(255,255,255,0.80)";
    ctx.fillText(txt, W / 2, y);
    y += 24;
  });

  drawCanvasStats(ctx, W, 336, data, ACCENT);
  drawCanvasDivider(ctx, W, 414);
  drawRoutineNameLine(ctx, W, 440, data.routineName);
  drawCanvasFooter(ctx, W, H);
  ctx.restore();
}

// ─── Canvas: Em números (teal accent) — raio-X da sessão em grid 2x2 ─────────

function drawNumbersCanvas(
  canvas: HTMLCanvasElement, data: WorkoutSummaryData, logo: HTMLImageElement | null,
) {
  const ctx = canvasSetup(canvas, "#0a1f1c", "#060f0d", "#2dd4bf", 0.18);
  if (!ctx) return;
  const W = CANVAS_W, H = CANVAS_H;
  const ACCENT = "#2dd4bf";

  ctx.save();
  drawCanvasHeader(ctx, W, ACCENT, logo);
  drawCanvasDivider(ctx, W, 62);

  ctx.fillStyle = "#ffffff";
  ctx.font = `900 18px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("SEU TREINO EM NUMEROS", W / 2, 104);

  // Cardio fica de fora da contagem de repetições: nesses exercícios `reps` é a
  // DISTÂNCIA em km (contrato kg=min/reps=km), e somá-la aqui estampava os km
  // percorridos no tile de "REPETICOES".
  const totalReps = data.completedExercises.reduce(
    (sum, ex) =>
      sum + (ex.isCardio ? 0 : (ex.sets ?? []).reduce((s, st) => s + (st.reps || 0), 0)),
    0,
  );
  const { minutes: cardioMin, km: cardioKm } = getSessionCardioTotals(data.completedExercises);
  const cardioOnly = isCardioOnlySession(data.completedExercises);
  const tiles: Array<{ emoji: string; value: string; label: string }> = [
    // Mesma regra de cardio dos painéis de stat (ver drawCanvasStats): tempo
    // registrado no lugar do cronômetro da sessão, distância no lugar de séries.
    cardioOnly && cardioMin > 0
      ? { emoji: "⏱", value: formatCardioMinutes(cardioMin), label: "TEMPO" }
      : { emoji: "⏱", value: formatSummaryDuration(data.durationSecs), label: "TEMPO ATIVO" },
    cardioOnly && cardioKm > 0
      ? { emoji: "📍", value: `${formatCardioKm(cardioKm)} km`, label: "DISTANCIA" }
      : { emoji: "💪", value: String(data.totalSeries), label: "SERIES" },
    totalReps > 0
      ? { emoji: "💥", value: fmtInt(totalReps), label: "REPETICOES" }
      : { emoji: "🎯", value: String(data.completedExercises.length), label: "EXERCICIOS" },
    data.totalVolume > 0
      ? { emoji: "🏋️", value: formatVolumeKg(data.totalVolume), label: "VOLUME" }
      : { emoji: "✅", value: "100%", label: "CONCLUIDO" },
  ];

  const gap = 10, tileW = (W - 40 - gap) / 2, tileH = 96;
  const [ar, ag, ab] = hexToRgb(ACCENT);
  tiles.forEach((tile, i) => {
    const x = 20 + (i % 2) * (tileW + gap);
    const y = 128 + Math.floor(i / 2) * (tileH + gap);
    const fill = ctx.createLinearGradient(0, y, 0, y + tileH);
    fill.addColorStop(0, "rgba(255,255,255,0.09)");
    fill.addColorStop(1, "rgba(255,255,255,0.04)");
    roundRectPath(ctx, x, y, tileW, tileH, 16);
    ctx.fillStyle = fill;
    ctx.fill();
    roundRectPath(ctx, x + 0.5, y + 0.5, tileW - 1, tileH - 1, 15.5);
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    ctx.stroke();
    const cX = x + tileW / 2;
    ctx.font = `22px ${FONT}`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(tile.emoji, cX, y + 34);
    ctx.font = `900 23px ${FONT}`;
    ctx.fillText(tile.value, cX, y + 64);
    ctx.fillStyle = `rgba(${ar},${ag},${ab},0.65)`;
    ctx.font = `700 9px ${FONT}`;
    ctx.fillText(tile.label, cX, y + 82);
  });

  // Contexto da sessão: nº de exercícios + grupo muscular predominante
  const primary = getPrimaryMuscleGroup(data.completedExercises);
  const exCount = data.completedExercises.length;
  const context = `${exCount} exercício${exCount === 1 ? "" : "s"}${primary ? ` • foco em ${primary}` : ""}`;
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = `600 13px ${FONT}`;
  ctx.fillText(context, W / 2, 372);

  drawCanvasDivider(ctx, W, 400);
  drawRoutineNameLine(ctx, W, 426, data.routineName);

  // Melhores cargas do dia (até 3), estilo lista compacta
  const best = data.completedExercises
    .filter((e) => e.bestKg > 0)
    .sort((a, b) => b.bestKg - a.bestKg)
    .slice(0, 3);
  let y = 456;
  best.forEach((ex) => {
    ctx.fillStyle = "rgba(255,255,255,0.60)";
    ctx.font = `500 12px ${FONT}`;
    ctx.textAlign = "center";
    let txt = `${ex.name}  ·  ${ex.bestKg}kg`;
    while (ctx.measureText(txt).width > W - 70 && txt.length > 3) txt = txt.slice(0, -2) + "…";
    ctx.fillText(txt, W / 2, y);
    y += 19;
  });

  drawCanvasFooter(ctx, W, H);
  ctx.restore();
}

function drawCanvas(
  canvas: HTMLCanvasElement, data: WorkoutSummaryData, logo: HTMLImageElement | null,
  template: CanvasTemplate = "auto", comparisonIndex = 0, cardioGroups: CardioGroup[] = [],
) {
  const cardioKind = cardioTemplateKind(template);
  if (cardioKind) {
    const group = cardioGroups.find((g) => g.kind === cardioKind);
    // Sem o grupo (dado sumiu numa re-renderização) cai no card clássico em vez
    // de desenhar um card zerado.
    if (group) return drawCardioCanvas(canvas, data, logo, group);
  }
  if (template === "comparison" && data.totalVolume > 0) {
    return drawComparisonCanvas(canvas, data, logo, comparisonIndex);
  }
  if (template === "impact" && data.totalVolume > 0) {
    return drawImpactCanvas(canvas, data, logo);
  }
  if (template === "evolution") return drawEvolutionCanvas(canvas, data, logo);
  if (template === "numbers") return drawNumbersCanvas(canvas, data, logo);
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
  /**
   * O convidado salvou a rotina do amigo (ver `partySaveOffer`). A tela de
   * Metas recarrega a lista para o card novo aparecer sem refresh manual.
   */
  onPartyRoutineSaved?: () => void;
}

export function WorkoutSummaryOverlay({ data, onClose, onSharedToFeed, onPartyRoutineSaved }: WorkoutSummaryOverlayProps) {
  const { t } = useLanguage();

  // ── Treinar junto: salvar a rotina do amigo ────────────────────────────────
  // `idle` → o card com as duas opções; `saving` → botão travado; `done`/
  // `skipped` → o card se recolhe numa linha, sem sumir (o usuário precisa ver
  // o que decidiu, e "sumiu do nada" lê como bug).
  const [partySaveState, setPartySaveState] =
    React.useState<"idle" | "saving" | "done" | "skipped">("idle");

  const handleSavePartyRoutine = async () => {
    const offer = data.partySaveOffer;
    if (!offer || partySaveState === "saving") return;
    setPartySaveState("saving");
    try {
      await saveRoutineFromWorkoutPartyDb(
        data.userId,
        offer.snapshot,
        offer.snapshot.routineName || data.routineName,
      );
      setPartySaveState("done");
      toast({
        title: t("goals_party_saved_toast"),
        description: t("goals_party_saved_desc").replace(
          "{name}",
          offer.snapshot.routineName || data.routineName,
        ),
      });
      onPartyRoutineSaved?.();
    } catch (err: any) {
      setPartySaveState("idle");
      // Só o toast não chega ao Sentry (erro tratado): reportar explicitamente é
      // o que mantém visível uma falha que o usuário não tem como contornar.
      reportHandledError(err, "workout-summary:save-party-routine");
      toast({
        title: t("goals_party_save_error"),
        description: err?.message,
        variant: "destructive",
      });
    }
  };

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cropContainerWidthRef = React.useRef<number>(0);
  // A legenda editável fica no fim da área rolável deste overlay (position:fixed)
  // — o scroll-assist de página (window.scrollBy) não rola um overlay fixo, então
  // usamos o hook apontando para o container que de fato rola (scrollRef, não a
  // raiz, que é overflow:hidden). Ver use-keyboard-input-scroll.
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  useKeyboardInputScroll(scrollRef);

  // Trava o scroll do documento enquanto o resumo está aberto. Sem isso existem
  // DOIS scrollers verticais na tela (este overlay + a página de Metas atrás
  // dele): ao chegar no fim do overlay o gesto encadeia para o documento e o
  // usuário fica preso, sem conseguir voltar para cima. Mesmo padrão do
  // flow-viewer-modal; a posição da página é restaurada ao fechar.
  React.useEffect(() => {
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
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      document.documentElement.style.overflow = prev.htmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, []);

  const [description, setDescription] = React.useState(() => generateDefaultDescription(data));
  const [userPhotos, setUserPhotos] = React.useState<File[]>([]);
  const [userPhotoPreviews, setUserPhotoPreviews] = React.useState<string[]>([]);
  const [cropTransforms, setCropTransforms] = React.useState<Record<number, CropTransform>>({});
  const [currentSlide, setCurrentSlide] = React.useState(0);
  const [canvasPreviewUrl, setCanvasPreviewUrl] = React.useState<string | null>(null);
  const [isSharing, setIsSharing] = React.useState(false);
  const [shareTarget, setShareTarget] = React.useState<"feed" | "duel" | null>(null);
  // Compartilhar exige internet (upload de imagem + insert do post/check-in).
  // Offline, os botões ficam desabilitados com um aviso — o treino em si já
  // foi salvo na fila offline e sincroniza sozinho.
  const [isOffline, setIsOffline] = React.useState(() => {
    const s = getNetworkStatus();
    return !s.isOnline || !s.isSupabaseReachable;
  });
  React.useEffect(
    () =>
      addNetworkStatusListener((s) =>
        setIsOffline(!s.isOnline || !s.isSupabaseReachable),
      ),
    [],
  );
  const [showGroupPicker, setShowGroupPicker] = React.useState(false);
  const [showAllExercises, setShowAllExercises] = React.useState(false);
  // Marcação de pessoas — mesmo drawer do NewPost (quem treinou junto costuma
  // aparecer na foto). Vale para o post do FEED; o check-in de duelo não tem
  // marcação (é check-in, não post).
  const [taggedUsers, setTaggedUsers] = React.useState<SearchUser[]>([]);
  const [tagPeopleOpen, setTagPeopleOpen] = React.useState(false);
  // Modalidades de cardio feitas na sessão (corrida na esteira e ao ar livre
  // caem no mesmo grupo), ordenadas da mais longa para a mais curta. Cada uma
  // vira um chip e um card compartilhável próprio.
  const cardioGroups = React.useMemo(
    () => getCardioBreakdown(data.completedExercises),
    [data.completedExercises],
  );
  // Minutos/km registrados no cardio da sessão + regras de exibição — a fileira
  // de stats da tela segue exatamente o mesmo critério do card gerado
  // (drawCanvasStats), para os dois nunca discordarem.
  const sessionCardio = getSessionCardioTotals(data.completedExercises);
  const cardioOnlySession = isCardioOnlySession(data.completedExercises);
  const showCardioTimeStat = cardioOnlySession && sessionCardio.minutes > 0;
  const hideSeriesStat = cardioOnlySession && sessionCardio.km > 0;
  // Template do card gerado, escolhido no seletor de estilo. "auto" = variante
  // clássica (padrão/PR/máquina). comparisonIndex alterna entre as equivalências
  // válidas (elefante, caminhonete...) ao tocar de novo no chip de Equivalência.
  const [selectedTemplate, setSelectedTemplate] = React.useState<CanvasTemplate>(() => {
    // Treino só de cardio: o card clássico não tem volume nem carga para
    // mostrar, então já abre no card da modalidade principal da sessão.
    const top = cardioGroups[0];
    return data.totalVolume <= 0 && top ? `cardio:${top.kind}` : "auto";
  });
  const [comparisonIndex, setComparisonIndex] = React.useState(0);
  // Mapa do trajeto (corrida GPS) renderizado em imagem — vira um slide
  // compartilhável entre as fotos do usuário e o card gerado.
  const [mapPreviewUrl, setMapPreviewUrl] = React.useState<string | null>(null);
  const mapBlobRef = React.useRef<Blob | null>(null);

  const variant = getCanvasVariant(data);
  const hasPRs = data.prExercises.length > 0;
  const hasMachined = data.machinedExercises.length > 0;
  // Ordem dos slides: fotos do usuário → mapa da corrida (se houver) → canvas
  const hasMapSlide = mapPreviewUrl !== null;
  const mapSlideIndex = hasMapSlide ? userPhotoPreviews.length : -1;
  const totalSlides = userPhotoPreviews.length + (hasMapSlide ? 1 : 0) + 1;

  // Tokens "liquid glass" — tons brancos translúcidos sobre o shell escuro
  const CARD    = "rgba(255,255,255,0.06)";   // painel de vidro
  const FG      = "#fff";
  const MUTED   = "rgba(255,255,255,0.55)";
  const ORANGE  = "hsl(var(--brand-2))";
  const BORDER  = "rgba(255,255,255,0.12)";
  const SURFACE = "rgba(255,255,255,0.10)";

  // Accent colors per variant (non-CSS-var, for inline button styles).
  // Segue o template selecionado; "auto" cai na cor da variante clássica.
  const variantAccent = variant === "machine" ? "#eab308" : variant === "pr" ? "#f97316" : "#22c55e";
  const accentHex = templateAccent(selectedTemplate) ?? variantAccent;
  // Texto preto só no dourado da máquina zerada (contraste); demais acentos usam branco.
  const accentFg = selectedTemplate === "auto" && variant === "machine" ? "#000" : "#fff";
  const headerTitle = hasMachined
    ? "Máquina zerada! 🔥"
    : hasPRs
    ? "Novo recorde! 🏆"
    : "Treino concluído! 💪";

  // Draw off-screen canvas — recriado a cada troca de template/comparação para
  // não acumular clip/scale do desenho anterior (a criação é barata e rara).
  React.useEffect(() => {
    // Backing store 3x maior que o layout lógico (540x540) para não pixelar
    // ao ser exibido em telas Retina.
    const canvas = createCardCanvas();
    canvasRef.current = canvas;
    let cancelled = false;
    // Aguarda as fontes E o logo antes de desenhar, para o card sair completo.
    Promise.all([document.fonts.ready, loadLogo()]).then(([, logo]) => {
      if (cancelled) return;
      drawCanvas(canvas, data, logo, selectedTemplate, comparisonIndex, cardioGroups);
      setCanvasPreviewUrl(cardCanvasPreviewUrl(canvas));
    });
    return () => { cancelled = true; };
  }, [data, selectedTemplate, comparisonIndex, cardioGroups]);

  // Renderiza o mapa do trajeto em imagem (assíncrono: baixa tiles + desenha).
  // Blob fica no ref para o upload; a object URL alimenta o slide de preview.
  React.useEffect(() => {
    const run = data.run;
    if (!run || run.path.flat().length < 2) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    renderRouteMapImage(run.path, {
      distanceKm: run.distanceKm,
      elapsedMs: run.elapsedMs,
      paceSecPerKm: run.paceSecPerKm,
      labels: {
        distance: t("goals_run_distance"),
        time: t("goals_run_time"),
        pace: t("goals_run_pace"),
      },
      timeText: formatRunTime(run.elapsedMs),
      paceText: formatRunPace(run.paceSecPerKm),
    }).then((blob) => {
      if (cancelled || !blob) return;
      mapBlobRef.current = blob;
      objectUrl = URL.createObjectURL(blob);
      setMapPreviewUrl(objectUrl);
    }).catch(() => { /* sem mapa — resumo segue normal */ });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.run]);

  // Cleanup photo preview URLs on unmount (revokes are also done inline on
  // add/remove; ref keeps the latest list available to the unmount cleanup).
  const userPhotoPreviewsRef = React.useRef<string[]>([]);
  userPhotoPreviewsRef.current = userPhotoPreviews;
  React.useEffect(() => {
    return () => { userPhotoPreviewsRef.current.forEach((url) => URL.revokeObjectURL(url)); };
  }, []);

  const handlePhotoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;

    const previousCount = userPhotos.length;
    let remainingSlots = MAX_SUMMARY_PHOTOS - previousCount;
    let skippedForLimit = 0;
    const newFiles: File[] = [];
    const newPreviews: string[] = [];

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        toast({
          title: t("newpost_invalid_type"),
          description: `${file.name} ${t("newpost_invalid_image")}`,
          variant: "destructive",
        });
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: t("newpost_file_too_large"),
          description: `${file.name} ${t("newpost_image_max_size")}`,
          variant: "destructive",
        });
        continue;
      }
      if (remainingSlots <= 0) {
        skippedForLimit++;
        continue;
      }
      newFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
      remainingSlots--;
    }

    if (skippedForLimit > 0) {
      toast({
        title: t("newpost_max_photos_title"),
        description: t("newpost_max_photos_desc").replace("{n}", String(MAX_SUMMARY_PHOTOS)),
        variant: "destructive",
      });
    }

    if (newFiles.length === 0) return;

    setUserPhotos((prev) => [...prev, ...newFiles]);
    setUserPhotoPreviews((prev) => [...prev, ...newPreviews]);
    // Vai direto para o slide da primeira foto recém-adicionada, já pronta para zoom/pan
    setCurrentSlide(previousCount);
  };

  const removePhotoAt = (index: number) => {
    setUserPhotoPreviews((prev) => {
      const url = prev[index];
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== index);
    });
    setUserPhotos((prev) => prev.filter((_, i) => i !== index));
    setCropTransforms((prev) => {
      const next: Record<number, CropTransform> = {};
      for (const [k, v] of Object.entries(prev)) {
        const ki = Number(k);
        if (ki < index) next[ki] = v;
        else if (ki > index) next[ki - 1] = v;
      }
      return next;
    });
    setCurrentSlide((prev) => (prev > index ? prev - 1 : prev));
  };

  const getCanvasBlob = (): Promise<Blob> => {
    const canvas = canvasRef.current;
    if (!canvas) return Promise.reject(new Error("Canvas não pronto"));
    return cardCanvasToBlob(canvas);
  };

  // Aplica o zoom/pan (cropTransforms) escolhido pelo usuário em cada foto antes
  // do upload — mesma lógica de recorte do NewPost (applyTransformToBlob).
  const getCroppedUserPhotoBlobs = async (): Promise<Blob[]> => {
    const containerWidth = cropContainerWidthRef.current;
    const blobs: Blob[] = [];
    for (let i = 0; i < userPhotoPreviews.length; i++) {
      const transform = cropTransforms[i] || DEFAULT_TRANSFORM;
      blobs.push(await applyTransformToBlob(userPhotoPreviews[i], transform, containerWidth));
    }
    return blobs;
  };

  const handleShareFeed = async () => {
    setIsSharing(true);
    setShareTarget("feed");
    try {
      const urls: string[] = [];
      // User photos first (if any), já com o zoom/pan escolhido aplicado
      const croppedPhotos = await getCroppedUserPhotoBlobs();
      for (const photoBlob of croppedPhotos) {
        urls.push(await uploadWorkoutImageDb(data.userId, photoBlob));
      }
      // Mapa do trajeto (corrida GPS) — mesmo slide/ordem exibidos no carrossel
      if (mapBlobRef.current) {
        urls.push(await uploadWorkoutImageDb(data.userId, mapBlobRef.current));
      }
      // Canvas always included (last) — its URL vira a miniatura do modal de detalhe
      const blob = await getCanvasBlob();
      const canvasUrl = await uploadWorkoutImageDb(data.userId, blob);
      urls.push(canvasUrl);

      await createPostDb(
        urls,
        description.trim() || t("goals_summary_share_default_desc"),
        data.userGoalId ?? null,
        buildPostWorkoutSummary(data, canvasUrl, croppedPhotos.length),
        taggedUsers.map((u) => u.id),
      );
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
      const croppedPhotos = await getCroppedUserPhotoBlobs();
      for (const photoBlob of croppedPhotos) {
        extraPhotos.push(await uploadWorkoutImageDb(data.userId, photoBlob));
      }
      // Mapa do trajeto (corrida GPS) entra junto das fotos extras do check-in
      if (mapBlobRef.current) {
        extraPhotos.push(await uploadWorkoutImageDb(data.userId, mapBlobRef.current));
      }

      const exercises = data.completedExercises.map((ex) => ({
        workoutId: "", workoutName: ex.name, muscleGroup: ex.muscleGroup,
        kilos: ex.bestKg || null,
        volume: ex.totalSets > 0 ? `${ex.totalSets} séries` : null,
      }));
      const primaryMuscleGroup = getPrimaryMuscleGroup(data.completedExercises);

      const desc = description.trim() || t("goals_summary_share_default_desc");

      await Promise.all(
        data.userGroups.map((g) =>
          addGroupCheckInDb(
            g.id, data.userId, canvasUrl, desc,
            data.routineName, data.totalSeries, data.totalVolume,
            primaryMuscleGroup, exercises, extraPhotos,
            // Duelo pontuado por CALORIAS lia null aqui e o treino valia 0 —
            // agora o número da sessão vai junto do check-in.
            Math.round(data.durationSecs / 60), null, null,
            (data.caloriesKcal ?? 0) > 0 ? Math.round(data.caloriesKcal!) : null,
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
      const croppedPhotos = await getCroppedUserPhotoBlobs();
      for (const photoBlob of croppedPhotos) {
        extraPhotos.push(await uploadWorkoutImageDb(data.userId, photoBlob));
      }
      // Mapa do trajeto (corrida GPS) entra junto das fotos extras do check-in
      if (mapBlobRef.current) {
        extraPhotos.push(await uploadWorkoutImageDb(data.userId, mapBlobRef.current));
      }

      const exercises = data.completedExercises.map((ex) => ({
        workoutId: "", workoutName: ex.name, muscleGroup: ex.muscleGroup,
        kilos: ex.bestKg || null,
        volume: ex.totalSets > 0 ? `${ex.totalSets} séries` : null,
      }));
      const primaryMuscleGroup = getPrimaryMuscleGroup(data.completedExercises);

      await addGroupCheckInDb(
        groupId, data.userId, canvasUrl,
        description.trim() || t("goals_summary_share_default_desc"),
        data.routineName, data.totalSeries, data.totalVolume,
        primaryMuscleGroup, exercises, extraPhotos,
        Math.round(data.durationSecs / 60), null, null,
        (data.caloriesKcal ?? 0) > 0 ? Math.round(data.caloriesKcal!) : null,
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

  // ── Seletor de estilo do card gerado ────────────────────────────────────────
  // Só oferece templates que fazem sentido para os dados da sessão (ex.: sem
  // volume não há Equivalência/Impacto). O slide do canvas é sempre o último.
  const anyBestKg = data.completedExercises.some((e) => e.bestKg > 0);
  const canvasSlideIndex = totalSlides - 1;
  const comparisonOptionsCount =
    data.totalVolume > 0 ? getComparisonOptions(data.totalVolume).length : 0;
  const templateOptions: Array<{ id: CanvasTemplate; emoji: string; label: string }> = [
    {
      id: "auto",
      emoji: variant === "machine" ? "⚡" : variant === "pr" ? "🏆" : "✅",
      label: t("goals_canvas_tpl_auto"),
    },
    // Um chip por modalidade de cardio da sessão, logo após o clássico — é o
    // card com mais informação quando a pessoa correu/pedalou.
    ...cardioGroups.map((g) => ({
      id: `cardio:${g.kind}` as CanvasTemplate,
      emoji: CARDIO_KIND_META[g.kind].emoji,
      label: t(CARDIO_KIND_META[g.kind].labelKey),
    })),
    ...(data.totalVolume > 0
      ? [
          { id: "comparison" as const, emoji: "🐘", label: t("goals_canvas_tpl_comparison") },
          { id: "impact" as const, emoji: "🔥", label: t("goals_canvas_tpl_impact") },
        ]
      : []),
    ...(hasPRs || anyBestKg
      ? [{ id: "evolution" as const, emoji: "📈", label: t("goals_canvas_tpl_evolution") }]
      : []),
    { id: "numbers", emoji: "🧮", label: t("goals_canvas_tpl_numbers") },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9500,
        background: GLASS_ROOT_BG,
        display: "flex", flexDirection: "column",
        // A raiz NÃO rola — quem rola é o container interno abaixo do header.
        // Dois scrollers empilhados faziam o gesto encadear para a página atrás
        // do overlay ao chegar no fim do conteúdo.
        overflow: "hidden",
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
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: FG }}>{headerTitle}</div>
          {/* Treinar junto: quem estava na mesma sessão. Linha, não card — é
              contexto do treino, não uma ação. */}
          {data.partyMemberNames && data.partyMemberNames.length > 0 && (
            <div style={{
              fontSize: 12, color: MUTED, marginTop: 2,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {t("goals_party_with").replace("{names}", data.partyMemberNames.join(", "))}
            </div>
          )}
        </div>
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

      {/* ── Conteúdo rolável (único scroller da tela) ── */}
      <div
        ref={scrollRef}
        style={{
          flex: 1, minHeight: 0,
          overflowY: "auto", overflowX: "hidden",
          // Impede que o gesto encadeie para o documento ao chegar no fim.
          overscrollBehavior: "contain", WebkitOverflowScrolling: "touch",
          // Espaço extra ao abrir o teclado iOS para rolar a legenda acima dele
          // (precisa estar no MESMO container que o useKeyboardInputScroll rola).
          paddingBottom: "var(--keyboard-height, 0px)",
        }}
      >
      {/* ── Carousel ── */}
      <div style={{ position: "relative" }}>
        {/* Frame — foto atual permite zoom/pan direto (pinch + drag), sem tela de crop separada */}
        <div style={{
          margin: "12px 16px 4px", aspectRatio: `${CANVAS_W}/${CANVAS_H}`,
          borderRadius: 20, overflow: "hidden", position: "relative",
          boxShadow: "0 8px 28px rgba(0,0,0,0.35)", background: CARD,
        }}>
          {currentSlide < userPhotoPreviews.length ? (
            <>
              <InlineCropPreview
                imageSrc={userPhotoPreviews[currentSlide]}
                transform={cropTransforms[currentSlide] || DEFAULT_TRANSFORM}
                onTransformChange={(tr) =>
                  setCropTransforms((prev) => ({ ...prev, [currentSlide]: tr }))
                }
                containerWidthRef={cropContainerWidthRef}
              />
              {/* "Editar" pill hint — mesmo padrão do NewPost */}
              <span style={{
                position: "absolute", top: 12, left: 12, padding: "6px 12px", borderRadius: 14,
                fontSize: 12, fontWeight: 600, color: "#fff",
                background: "rgba(0,0,0,0.35)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                pointerEvents: "none",
              }}>
                {t("newpost_edit_photo")}
              </span>
            </>
          ) : hasMapSlide && currentSlide === mapSlideIndex ? (
            /* Mapa do trajeto da corrida GPS — imagem já renderizada, compartilhada como slide do post */
            <img
              src={mapPreviewUrl!}
              alt={t("goals_run_map_title")}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : canvasPreviewUrl ? (
            <img
              src={canvasPreviewUrl}
              alt="Resumo do treino"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <div style={{
              width: "100%", height: "100%",
              animation: "pulse 1.5s ease-in-out infinite",
            }} />
          )}
        </div>

        {/* Camera icon — always visible bottom-right of carousel */}
        <button
          onClick={() => {
            if (userPhotos.length >= MAX_SUMMARY_PHOTOS) {
              toast({
                title: t("newpost_max_photos_title"),
                description: t("newpost_max_photos_desc").replace("{n}", String(MAX_SUMMARY_PHOTOS)),
                variant: "destructive",
              });
              return;
            }
            fileInputRef.current?.click();
          }}
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

        {/* Remove photo button — top-right, only while a photo slide is active */}
        {currentSlide < userPhotoPreviews.length && (
          <button
            onClick={() => removePhotoAt(currentSlide)}
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

        {/* Prev/next nav — necessário pois o frame captura o gesto de arrastar para pan */}
        {totalSlides > 1 && (
          <>
            <button
              onClick={() => setCurrentSlide((i) => (i - 1 + totalSlides) % totalSlides)}
              aria-label={t("goals_summary_prev_slide")}
              style={{
                position: "absolute", left: 26, top: "50%", transform: "translateY(-50%)",
                width: 32, height: 32, borderRadius: "50%",
                background: "rgba(0,0,0,0.5)", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2,
              }}
            >
              <ChevronLeft className="h-4 w-4" color="#fff" />
            </button>
            <button
              onClick={() => setCurrentSlide((i) => (i + 1) % totalSlides)}
              aria-label={t("goals_summary_next_slide")}
              style={{
                position: "absolute", right: 26, top: "50%", transform: "translateY(-50%)",
                width: 32, height: 32, borderRadius: "50%",
                background: "rgba(0,0,0,0.5)", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2,
              }}
            >
              <ChevronRight className="h-4 w-4" color="#fff" />
            </button>
          </>
        )}

        {/* Dots indicator — tocável para ir direto a um slide */}
        {totalSlides > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 6, padding: "6px 0 2px" }}>
            {Array.from({ length: totalSlides }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                aria-label={`Slide ${i + 1}`}
                style={{
                  height: 6, borderRadius: 3, border: "none", padding: 0, cursor: "pointer",
                  width: currentSlide === i ? 18 : 6,
                  background: currentSlide === i ? accentHex : "rgba(255,255,255,0.25)",
                  transition: "width 0.2s, background 0.2s",
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Seletor de estilo do card gerado ── */}
      <div style={{ margin: "12px 16px 0" }}>
        <div style={{
          fontSize: 12, fontWeight: 700, color: MUTED,
          textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8,
        }}>
          {t("goals_canvas_style_label")}
        </div>
        <div
          className="summary-tpl-row"
          style={{
            display: "flex", gap: 8, overflowX: "auto",
            WebkitOverflowScrolling: "touch", paddingBottom: 2,
          }}
        >
          {templateOptions.map((tp) => {
            const isSelected = selectedTemplate === tp.id;
            const tplAccent = templateAccent(tp.id) ?? variantAccent;
            const canShuffle = tp.id === "comparison" && comparisonOptionsCount > 1;
            return (
              <button
                key={tp.id}
                onClick={() => {
                  // Tocar de novo no chip de Equivalência sorteia outra comparação
                  // (elefante → caminhonete → ...); nos demais só re-seleciona.
                  if (isSelected) {
                    if (canShuffle) setComparisonIndex((i) => i + 1);
                  } else {
                    setSelectedTemplate(tp.id);
                  }
                  setCurrentSlide(canvasSlideIndex);
                }}
                style={{
                  flexShrink: 0, padding: "9px 14px", borderRadius: 20, cursor: "pointer",
                  whiteSpace: "nowrap", fontSize: 13, fontWeight: 700,
                  background: isSelected ? `${tplAccent}22` : CARD,
                  border: `1.5px solid ${isSelected ? `${tplAccent}66` : BORDER}`,
                  color: isSelected ? tplAccent : MUTED,
                  display: "flex", alignItems: "center", gap: 6,
                  transition: "background 0.2s, border-color 0.2s, color 0.2s",
                }}
              >
                <span aria-hidden>{tp.emoji}</span>
                {tp.label}
                {isSelected && canShuffle && (
                  <span aria-label={t("goals_canvas_shuffle")}>🔀</span>
                )}
              </button>
            );
          })}
        </div>
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
                  {/* Valor antigo riscado — cada tipo de recorde compara uma
                      grandeza diferente. Sem `kind` (resumos antigos e modo
                      simplificado) cai no ramo de carga, como sempre foi. */}
                  {pr.kind === "reps" ? (
                    (pr.previousReps ?? 0) > 0 && (
                      <span style={{ fontSize: 12, color: MUTED, textDecoration: "line-through", whiteSpace: "nowrap" }}>
                        {pr.previousReps} reps
                      </span>
                    )
                  ) : pr.kind === "e1rm" ? (
                    (pr.previousE1rm ?? 0) > 0 && (
                      <span style={{ fontSize: 12, color: MUTED, textDecoration: "line-through", whiteSpace: "nowrap" }}>
                        {pr.previousE1rm}kg
                      </span>
                    )
                  ) : (
                    pr.previousBestKg > 0 && (
                      <span style={{ fontSize: 12, color: MUTED, textDecoration: "line-through", whiteSpace: "nowrap" }}>
                        {pr.previousBestKg}kg
                      </span>
                    )
                  )}
                  <span style={{
                    background: ORANGE, color: "#fff",
                    borderRadius: 20, padding: "2px 10px",
                    fontSize: 13, fontWeight: 800, whiteSpace: "nowrap",
                  }}>
                    {pr.kind === "reps"
                      ? `${pr.newBestKg}kg × ${pr.newReps}`
                      : pr.kind === "e1rm"
                        ? `${pr.newE1rm}kg`
                        : `${pr.newBestKg}kg`}
                  </span>
                  <span style={{
                    background: `${ORANGE}33`, color: ORANGE,
                    borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}>
                    {pr.kind === "reps"
                      ? t("goals_summary_pr_badge_reps")
                      : pr.kind === "e1rm"
                        ? t("goals_summary_pr_badge_e1rm")
                        : t("goals_summary_pr_badge")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Stats row ── (mesma regra de cardio do card gerado: ver drawCanvasStats) */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "12px 16px 4px" }}>
        {[
          showCardioTimeStat
            ? { label: t("goals_run_time"), value: formatCardioMinutes(sessionCardio.minutes) }
            : { label: t("goals_summary_duration"), value: formatSummaryDuration(data.durationSecs) },
          ...(sessionCardio.km > 0
            ? [{ label: t("goals_run_distance"), value: `${formatCardioKm(sessionCardio.km)} km` }]
            : []),
          ...(hideSeriesStat ? [] : [{ label: t("goals_summary_sets"), value: String(data.totalSeries) }]),
          ...(data.totalVolume > 0 ? [{ label: t("goals_summary_volume"), value: formatVolumeKg(data.totalVolume) }] : []),
          ...((data.caloriesKcal ?? 0) > 0
            ? [{ label: t("goals_summary_calories"), value: `${Math.round(data.caloriesKcal!)}` }]
            : []),
        ].map(({ label, value }) => (
          <div key={label} style={{
            // `wrap` + base de 84px: com cardio + distância + séries + volume +
            // calorias são 5 painéis, e espremer todos numa linha de iPhone
            // cortaria os números. Quebra para uma segunda linha em vez disso.
            flex: "1 1 84px", minWidth: 84,
            background: CARD, borderRadius: 16, padding: "12px 8px", textAlign: "center",
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

      {/* ── Corrida GPS: stats + parciais por km ── */}
      {data.run && data.run.distanceKm > 0 && (
        <div style={{ padding: "12px 16px 0" }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: MUTED,
            textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10,
          }}>
            🏃 {t("goals_run_section_title")}
          </div>

          {/* Distância / tempo / ritmo médio da corrida */}
          <div style={{
            display: "flex", padding: "12px 8px",
            background: CARD, borderRadius: 18, border: `1px solid ${BORDER}`,
            backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
          }}>
            {[
              { label: t("goals_run_distance"), value: data.run.distanceKm.toFixed(2), unit: "km" },
              { label: t("goals_run_time"), value: formatRunTime(data.run.elapsedMs), unit: null },
              { label: t("goals_run_pace"), value: formatRunPace(data.run.paceSecPerKm), unit: "/km" },
            ].map(({ label, value, unit }) => (
              <div key={label} style={{ flex: 1, textAlign: "center" }}>
                <div style={{
                  fontSize: 20, fontWeight: 800, color: FG,
                  fontVariantNumeric: "tabular-nums", lineHeight: 1.1,
                }}>
                  {value}
                  {unit && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, marginLeft: 3 }}>
                      {unit}
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: 10, color: MUTED, marginTop: 4,
                  textTransform: "uppercase", letterSpacing: 0.5,
                }}>
                  {label}
                </div>
              </div>
            ))}
          </div>

          {/* Tempo e ritmo de cada km — o parcial final aparece marcado */}
          {(data.run.splits?.length ?? 0) > 0 && (
            <>
              <div style={{
                fontSize: 12, fontWeight: 700, color: MUTED,
                textTransform: "uppercase", letterSpacing: 0.5,
                margin: "14px 0 10px",
              }}>
                {t("goals_run_splits_title")}
              </div>
              <RunSplitsList splits={data.run.splits!} accent={accentHex} maxRows={6} />
            </>
          )}
        </div>
      )}

      {/* ── Badges ── */}
      {FEATURES.badges && data.badges.length > 0 && (
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
            {displayedExercises.map((ex, idx) => {
              // Cardio registra MIN × KM, então a linha mostra tempo/distância
              // no lugar da carga (que é sempre 0 nesses exercícios).
              const cardio = ex.isCardio ? sumCardioSets(ex.sets) : null;
              return (
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
                  {cardio && (cardio.minutes > 0 || cardio.km > 0) ? (
                    <span style={{
                      background: `${accentHex}22`, color: accentHex,
                      borderRadius: 20, padding: "2px 10px", fontSize: 13, fontWeight: 700,
                    }}>
                      {[
                        cardio.minutes > 0 ? formatCardioMinutes(cardio.minutes) : null,
                        cardio.km > 0 ? `${formatCardioKm(cardio.km)}km` : null,
                        // Inclinação da esteira, quando informada.
                        ex.elevationPct ? `⛰ ${formatElevationPct(ex.elevationPct)}` : null,
                      ].filter(Boolean).join(" · ")}
                    </span>
                  ) : ex.bestKg > 0 ? (
                    <span style={{
                      background: `${accentHex}22`, color: accentHex,
                      borderRadius: 20, padding: "2px 10px", fontSize: 13, fontWeight: 700,
                    }}>
                      {ex.bestKg}kg
                    </span>
                  ) : null}
                </div>
              </div>
              );
            })}
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
                ? t("goals_summary_show_less")
                : `${t("goals_summary_show_all")} (+${data.completedExercises.length - 4})`}
            </button>
          )}
        </div>
      )}

      {/* ── Treinar junto: salvar a rotina do amigo ── */}
      {/* A pergunta só existe para quem foi CONVIDADO: aceitar o convite não
          criou rotina nenhuma, e este é o momento em que ele já sabe se o
          treino valeu a pena. Fica acima de "Compartilhar" porque é uma decisão
          sobre o próprio app, não sobre publicar. */}
      {data.partySaveOffer && (
        <div style={{
          margin: "16px 16px 0",
          background: CARD,
          border: `1px solid ${BORDER}`,
          backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
          borderRadius: 20, padding: 16,
        }}>
          {partySaveState === "done" || partySaveState === "skipped" ? (
            <div style={{ fontSize: 13, color: MUTED, textAlign: "center" }}>
              {partySaveState === "done"
                ? t("goals_party_save_done")
                : t("goals_party_save_skipped")}
            </div>
          ) : (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: FG, marginBottom: 4 }}>
                {t("goals_party_save_title")}
              </div>
              <div style={{ fontSize: 13, color: MUTED, marginBottom: 10 }}>
                {t("goals_party_save_desc")
                  .replace("{name}", data.partySaveOffer.snapshot.routineName || data.routineName)
                  .replace("{host}", data.partySaveOffer.hostNickname || t("notif_sender_fallback"))}
              </div>
              <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 14, lineHeight: 1.5 }}>
                {data.partySaveOffer.snapshot.items.slice(0, 3).map((i) => i.name).join(" · ")}
                {data.partySaveOffer.snapshot.items.length > 3
                  ? ` · +${data.partySaveOffer.snapshot.items.length - 3}`
                  : ""}
              </div>
              <button
                onClick={handleSavePartyRoutine}
                disabled={partySaveState === "saving"}
                style={{
                  width: "100%", height: 46, borderRadius: 999, border: "none",
                  background: "linear-gradient(135deg,#5b8cff,#9d6bff)",
                  color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
                  opacity: partySaveState === "saving" ? 0.6 : 1,
                }}
              >
                {partySaveState === "saving"
                  ? t("goals_party_saving")
                  : t("goals_party_save_cta")}
              </button>
              <button
                onClick={() => setPartySaveState("skipped")}
                style={{
                  width: "100%", height: 40, marginTop: 6, background: "none",
                  border: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: 600, color: MUTED,
                }}
              >
                {t("goals_party_save_skip")}
              </button>
            </>
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

        {/* Marcar pessoas — quem treinou junto (só entra no post do feed).
            Era a superfície de FEATURES.postTags mais alcançável que sobrava:
            está no loop principal, todo mundo que termina um treino passa
            por aqui. */}
        {FEATURES.postTags && (
        <>
        <div style={{
          fontSize: 12, fontWeight: 700, color: MUTED,
          textTransform: "uppercase", letterSpacing: 0.5, margin: "16px 0 10px",
        }}>
          {t("newpost_tag_people_section")}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {taggedUsers.map((u) => (
            <span
              key={u.id}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 10px 6px 6px", borderRadius: 18,
                background: `${accentHex}1F`,
                border: `1px solid ${accentHex}66`,
              }}
            >
              <UserAvatar photo={u.photo} nickname={u.nickname} size="sm" />
              <span style={{
                fontSize: 13, fontWeight: 600, color: FG, maxWidth: 110,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {u.nickname}
              </span>
              <button
                onClick={() => setTaggedUsers((prev) => prev.filter((s) => s.id !== u.id))}
                aria-label={t("tag_people_remove").replace("{name}", u.nickname)}
                style={{
                  display: "flex", alignItems: "center", background: "none",
                  border: "none", padding: 0, cursor: "pointer", color: MUTED,
                }}
              >
                <X width={14} height={14} />
              </button>
            </span>
          ))}
          <button
            onClick={() => setTagPeopleOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "12px 18px", borderRadius: 18, cursor: "pointer",
              background: "none", border: `1px dashed ${BORDER}`,
              color: MUTED, fontSize: 13, fontWeight: 600,
            }}
          >
            <UserRoundPlus width={15} height={15} strokeWidth={2.2} />
            {t("newpost_tag_people_add")}
          </button>
        </div>
        </>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handlePhotoPick}
        style={{ display: "none" }}
      />

      {/* ── Action buttons ── */}
      <div style={{
        padding: "14px 16px",
        paddingBottom: "max(24px, env(safe-area-inset-bottom))",
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        {/* Aviso: compartilhar precisa de internet */}
        {isOffline && (
          <div style={{
            fontSize: 12, color: MUTED, textAlign: "center",
            padding: "0 8px", lineHeight: 1.4,
          }}>
            {t("goals_summary_offline_share")}
          </div>
        )}

        {/* Share to Feed */}
        <button
          onClick={handleShareFeed}
          disabled={isSharing || isOffline}
          style={{
            height: 52, borderRadius: 16, border: "none",
            background: isSharing && shareTarget === "feed" ? `${accentHex}99` : accentHex,
            color: accentFg,
            fontSize: 15, fontWeight: 700,
            cursor: isSharing || isOffline ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            opacity: isOffline ? 0.4 : isSharing && shareTarget !== "feed" ? 0.45 : 1,
            transition: "opacity 0.2s",
          }}
        >
          {isSharing && shareTarget === "feed" ? (
            <SpinnerIcon color={accentFg} />
          ) : (
            <ShareIcon color={accentFg} />
          )}
          {isSharing && shareTarget === "feed"
            ? t("goals_summary_sharing_feed")
            : t("goals_summary_share_feed")}
        </button>

        {/* Share to Duel */}
        {data.userGroups.length > 0 && (
          <button
            onClick={() => {
              if (isSharing || isOffline) return;
              data.userGroups.length === 1
                ? handleShareDuel(data.userGroups[0].id)
                : setShowGroupPicker(true);
            }}
            disabled={isSharing || isOffline}
            style={{
              height: 52, borderRadius: 16,
              background: CARD, border: `1px solid ${BORDER}`,
              backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
              color: FG, fontSize: 15, fontWeight: 700,
              cursor: isSharing || isOffline ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              opacity: isOffline ? 0.4 : isSharing && shareTarget !== "duel" ? 0.45 : 1,
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

      {/* Drawer de marcação — o portal do vaul nasce no body com z-[310] e o
          transform do lift wrapper o torna um stacking context, então sem
          elevar o WRAPPER ele ficaria atrás deste overlay (zIndex 9500). */}
      {FEATURES.postTags && (
      <TagPeopleDrawer
        open={tagPeopleOpen}
        onOpenChange={setTagPeopleOpen}
        selected={taggedUsers}
        onChange={setTaggedUsers}
        wrapperClassName="z-[9600]"
      />
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .summary-tpl-row::-webkit-scrollbar { display: none }
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
