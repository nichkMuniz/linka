// Cards compartilháveis (canvas) dedicados ao CARDIO do resumo do treino.
//
// Por que existe: os cards clássicos/criativos do resumo giram em torno de
// VOLUME (kg levantados) — grandeza que o cardio não tem (a sessão registra
// MIN × KM e o volume fica 0). Um treino de corrida ou bike acabava caindo no
// card genérico "Treino Concluído", sem distância, ritmo nem identidade. Como o
// catálogo tem poucas modalidades de cardio, cada uma ganha aqui um card
// próprio — emoji, cor, título, métrica em destaque e frase de conquista.
//
// O desenho reaproveita as primitivas de @/lib/canvas-card (mesmo shell, header
// com logo, painéis de stat e rodapé) para o card sair na mesma linguagem
// visual dos demais.

import {
  CANVAS_W,
  CANVAS_H,
  FONT,
  canvasSetup,
  drawCanvasDivider,
  drawCanvasFooter,
  drawCanvasHeader,
  drawCanvasStatPanels,
  fitFontSize,
  hexToRgb,
  truncateToWidth,
} from "@/lib/canvas-card";
import type { CardioKind } from "@/lib/cardio-exercises";
import {
  cardioMinutesFromInput,
  formatCardioKm,
  formatCardioMinutes,
  formatElevationPct,
  getCardioKind,
} from "@/lib/cardio-exercises";
import type { TranslationKey } from "@/lib/i18n";

// ─── Tipos ───────────────────────────────────────────────────────────────────

// Subconjunto do WorkoutSummaryData de que o card precisa — declarado aqui para
// este módulo não depender do componente de overlay (a dependência é só de ida).
export type CardioExerciseInput = {
  name: string;
  totalSets: number;
  /** Para cardio, cada série traz kg = MINUTOS e reps = KM. */
  sets?: Array<{ kg: number; reps: number; elev?: number }>;
  isCardio?: boolean;
  /** MAIOR inclinação (%) entre as séries da esteira. Ausente/null = nenhuma. */
  elevationPct?: number | null;
};

export type CardioSessionInfo = {
  routineName: string;
  durationSecs: number;
};

/** Agregado de uma modalidade de cardio feita na sessão. */
export type CardioGroup = {
  kind: CardioKind;
  /** Soma dos minutos de todas as séries da modalidade. */
  minutes: number;
  /** Soma dos km de todas as séries da modalidade (0 quando não informado). */
  km: number;
  sets: number;
  /** Nomes dos exercícios que compõem o grupo (ex.: Esteira + Corrida ao Ar Livre). */
  names: string[];
  /**
   * Maior inclinação (%) informada nas esteiras do grupo, ou `null` quando
   * ninguém anotou. É o MAIOR (e não a média) porque o grupo pode juntar uma
   * esteira inclinada com uma corrida ao ar livre, que não tem o campo — a
   * média diluiria o esforço declarado num número que não aconteceu.
   */
  elevationPct: number | null;
};

// ─── Metadados por modalidade ────────────────────────────────────────────────

type CardioKindMeta = {
  emoji: string;
  accent: string;
  /** Chave i18n do chip do seletor de estilo. */
  labelKey: TranslationKey;
  /** Título desenhado no card (PT, sem acentos — padrão dos cards em canvas). */
  headline: string;
  /** "pace" = min/km (correr, caminhar, nadar); "speed" = km/h (pedalar, remar). */
  speedMetric: "pace" | "speed";
  /** Frases por marca de distância, da mais alta para a mais baixa. */
  milestones: Array<{ km: number; text: string }>;
  /** Frase usada quando não houve distância registrada (só tempo). */
  timePhrase: string;
};

export const CARDIO_KIND_META: Record<CardioKind, CardioKindMeta> = {
  run: {
    emoji: "🏃",
    accent: "#f43f5e",
    labelKey: "goals_canvas_tpl_cardio_run",
    headline: "VOCE CORREU",
    speedMetric: "pace",
    milestones: [
      { km: 21.1, text: "Meia maratona no bolso. Surreal! 🤯" },
      { km: 10, text: "Dois dígitos de distância na conta 🔥" },
      { km: 5, text: "5K completo — e ainda sobrou gás 💨" },
      { km: 0, text: "Cada passo conta. Bora pro próximo 👟" },
    ],
    timePhrase: "Tempo de qualidade em movimento ⏱",
  },
  walk: {
    emoji: "🚶",
    accent: "#10b981",
    labelKey: "goals_canvas_tpl_cardio_walk",
    headline: "VOCE CAMINHOU",
    speedMetric: "pace",
    milestones: [
      { km: 10, text: "Dez quilômetros caminhando. Respeito! 👏" },
      { km: 5, text: "Passo firme, cabeça leve 🌿" },
      { km: 0, text: "Caminhar também é treinar 💚" },
    ],
    timePhrase: "Movimento constante, corpo agradecido 🌿",
  },
  bike: {
    emoji: "🚴",
    accent: "#06b6d4",
    labelKey: "goals_canvas_tpl_cardio_bike",
    headline: "VOCE PEDALOU",
    speedMetric: "speed",
    milestones: [
      { km: 40, text: "Pedalada de cicloturista 🚀" },
      { km: 20, text: "Pernas de ferro no pedal 🔩" },
      { km: 10, text: "Giro completo, coração a mil ❤️" },
      { km: 0, text: "Cada pedalada te leva mais longe 🚴" },
    ],
    timePhrase: "Giro constante do início ao fim 🔁",
  },
  elliptical: {
    emoji: "🌀",
    accent: "#d946ef",
    labelKey: "goals_canvas_tpl_cardio_elliptical",
    headline: "VOCE TREINOU",
    speedMetric: "speed",
    milestones: [
      { km: 10, text: "Impacto zero, esforço máximo ⚡" },
      { km: 5, text: "Ritmo constante, resultado certo 🔁" },
      { km: 0, text: "Corpo inteiro em movimento 💫" },
    ],
    timePhrase: "Impacto zero, esforço máximo ⚡",
  },
  rowing: {
    emoji: "🚣",
    accent: "#3b82f6",
    labelKey: "goals_canvas_tpl_cardio_rowing",
    headline: "VOCE REMOU",
    speedMetric: "speed",
    milestones: [
      { km: 10, text: "Remada de atleta ⚓" },
      { km: 5, text: "Corpo inteiro puxando junto 💪" },
      { km: 0, text: "Puxada após puxada, sem parar 🚣" },
    ],
    timePhrase: "Corpo inteiro puxando junto 💪",
  },
  jump_rope: {
    emoji: "🪢",
    accent: "#f59e0b",
    labelKey: "goals_canvas_tpl_cardio_jump_rope",
    headline: "VOCE PULOU",
    speedMetric: "speed",
    milestones: [{ km: 0, text: "Coração acelerado do início ao fim ❤️" }],
    timePhrase: "Coração acelerado do início ao fim ❤️",
  },
  stairs: {
    emoji: "🪜",
    accent: "#84cc16",
    labelKey: "goals_canvas_tpl_cardio_stairs",
    headline: "VOCE SUBIU",
    speedMetric: "speed",
    milestones: [
      { km: 5, text: "Degrau após degrau, sem parar 🧗" },
      { km: 0, text: "Subindo mais alto a cada treino 🪜" },
    ],
    timePhrase: "Subindo mais alto a cada treino 🪜",
  },
  swim: {
    emoji: "🏊",
    accent: "#0ea5e9",
    labelKey: "goals_canvas_tpl_cardio_swim",
    headline: "VOCE NADOU",
    speedMetric: "pace",
    milestones: [
      { km: 2, text: "Braçada após braçada, sem afundar 🌊" },
      { km: 0, text: "A água é o seu território 🏊" },
    ],
    timePhrase: "A água é o seu território 🏊",
  },
  generic: {
    emoji: "💓",
    accent: "#ec4899",
    labelKey: "goals_canvas_tpl_cardio_generic",
    headline: "VOCE FEZ CARDIO",
    speedMetric: "speed",
    milestones: [{ km: 0, text: "Coração treinado é vida mais longa ❤️" }],
    timePhrase: "Coração treinado é vida mais longa ❤️",
  },
};

// ─── Agregação ───────────────────────────────────────────────────────────────

/**
 * Soma minutos (kg) e km (reps) das séries de um exercício de cardio.
 *
 * O minuto de cada série passa por `cardioMinutesFromInput` **antes** da soma:
 * a pessoa pode ter escrito "1,30" (= 1h30) numa série e "20" na outra, e somar
 * os números crus daria 21,3 em vez de 110 minutos. Daqui para cima (cards,
 * listas, ritmo, velocidade) tudo já trabalha com minutos reais.
 */
export function sumCardioSets(sets?: Array<{ kg: number; reps: number }>): {
  minutes: number;
  km: number;
} {
  let minutes = 0;
  let km = 0;
  (sets ?? []).forEach((s) => {
    minutes += cardioMinutesFromInput(s.kg || 0);
    km += s.reps || 0;
  });
  return { minutes, km };
}

/**
 * Agrupa os exercícios de cardio da sessão por modalidade (corrida na esteira e
 * corrida ao ar livre caem no MESMO grupo, como pedido: o que importa é que a
 * pessoa correu). Ordena pela mais longa em tempo — a modalidade principal do
 * treino é a primeira. Só entram grupos com algum número registrado; sem isso
 * o card sairia zerado.
 */
export function getCardioBreakdown(exercises: CardioExerciseInput[]): CardioGroup[] {
  const byKind = new Map<CardioKind, CardioGroup>();
  exercises.forEach((ex) => {
    if (!ex.isCardio) return;
    const kind = getCardioKind(ex.name);
    const { minutes, km } = sumCardioSets(ex.sets);
    const group = byKind.get(kind)
      ?? { kind, minutes: 0, km: 0, sets: 0, names: [], elevationPct: null };
    group.minutes += minutes;
    group.km += km;
    group.sets += ex.sets?.length ?? ex.totalSets;
    if (ex.elevationPct && ex.elevationPct > (group.elevationPct ?? 0)) {
      group.elevationPct = ex.elevationPct;
    }
    if (!group.names.includes(ex.name)) group.names.push(ex.name);
    byKind.set(kind, group);
  });
  return [...byKind.values()]
    .filter((g) => g.minutes > 0 || g.km > 0)
    .sort((a, b) => b.minutes - a.minutes || b.km - a.km);
}

// ─── Formatação ──────────────────────────────────────────────────────────────
// `formatCardioMinutes`/`formatCardioKm` vivem em @/lib/cardio-exercises (junto
// da leitura do campo MIN) para telas comuns poderem usá-los sem importar este
// módulo de desenho.

/** Ritmo médio em min/km ("5:30"), ou null quando não dá para calcular. */
function formatPace(minutes: number, km: number): string | null {
  if (minutes <= 0 || km <= 0) return null;
  const secPerKm = (minutes * 60) / km;
  if (!isFinite(secPerKm) || secPerKm > 3600) return null;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Velocidade média em km/h ("24,5"), ou null quando não dá para calcular. */
function formatSpeed(minutes: number, km: number): string | null {
  if (minutes <= 0 || km <= 0) return null;
  const kmh = km / (minutes / 60);
  if (!isFinite(kmh)) return null;
  return kmh.toFixed(1).replace(".", ",");
}

/** Linha "🏃 5,20 km • 32min • 6:09/km" — usada na descrição automática do post. */
export function formatCardioLine(group: CardioGroup): string {
  const meta = CARDIO_KIND_META[group.kind];
  const parts: string[] = [];
  if (group.km > 0) parts.push(`${formatCardioKm(group.km)} km`);
  if (group.minutes > 0) parts.push(formatCardioMinutes(group.minutes));
  const pace = meta.speedMetric === "pace" ? formatPace(group.minutes, group.km) : null;
  const speed = meta.speedMetric === "speed" ? formatSpeed(group.minutes, group.km) : null;
  if (pace) parts.push(`${pace}/km`);
  else if (speed) parts.push(`${speed} km/h`);
  if (group.elevationPct) parts.push(`⛰ ${formatElevationPct(group.elevationPct)}`);
  return `${meta.emoji} ${parts.join(" • ")}`;
}

function milestonePhrase(group: CardioGroup): string {
  const meta = CARDIO_KIND_META[group.kind];
  if (group.km <= 0) return meta.timePhrase;
  return meta.milestones.find((m) => group.km >= m.km)?.text ?? meta.timePhrase;
}

// ─── Desenho ─────────────────────────────────────────────────────────────────

/** Linha de batimento cardíaco (ECG) que esmaece nas pontas — assinatura do card. */
function drawPulseLine(
  ctx: CanvasRenderingContext2D, W: number, y: number, accent: string,
) {
  const [r, g, b] = hexToRgb(accent);
  const x0 = 44, x1 = W - 44, cx = W / 2;
  const grad = ctx.createLinearGradient(x0, 0, x1, 0);
  grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
  grad.addColorStop(0.5, `rgba(${r},${g},${b},0.75)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(cx - 62, y);
  ctx.lineTo(cx - 48, y - 7);
  ctx.lineTo(cx - 34, y + 15);
  ctx.lineTo(cx - 18, y - 28);
  ctx.lineTo(cx - 2, y + 12);
  ctx.lineTo(cx + 12, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
}

/**
 * Card de uma modalidade de cardio. Distância é a métrica em destaque; quando
 * ela não foi registrada (ex.: pular corda, ou esteira anotada só em minutos),
 * o card promove o TEMPO a protagonista em vez de mostrar "0 km".
 */
export function drawCardioCanvas(
  canvas: HTMLCanvasElement,
  info: CardioSessionInfo,
  logo: HTMLImageElement | null,
  group: CardioGroup,
) {
  const meta = CARDIO_KIND_META[group.kind];
  const ACCENT = meta.accent;
  const [ar, ag, ab] = hexToRgb(ACCENT);
  const ctx = canvasSetup(canvas, "#141320", "#08070d", ACCENT, 0.22);
  if (!ctx) return;
  const W = CANVAS_W, H = CANVAS_H;

  ctx.save();
  drawCanvasHeader(ctx, W, ACCENT, logo);
  drawCanvasDivider(ctx, W, 62);

  // Medalhão com o emoji da modalidade + halo de acento
  const halo = ctx.createRadialGradient(W / 2, 128, 0, W / 2, 128, 82);
  halo.addColorStop(0, `rgba(${ar},${ag},${ab},0.30)`);
  halo.addColorStop(1, `rgba(${ar},${ag},${ab},0)`);
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(W / 2, 128, 82, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `54px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(meta.emoji, W / 2, 147);

  ctx.fillStyle = `rgba(${ar},${ag},${ab},0.80)`;
  ctx.font = `700 12px ${FONT}`;
  ctx.fillText(meta.headline, W / 2, 196);

  // Métrica principal: distância quando existe, senão tempo
  const hasDistance = group.km > 0;
  const bigRaw = hasDistance
    ? `${formatCardioKm(group.km)} km`
    : formatCardioMinutes(group.minutes) || formatCardioMinutes(info.durationSecs / 60);
  const big = fitFontSize(ctx, bigRaw, W - 90, 60);
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = `rgba(${ar},${ag},${ab},0.50)`;
  ctx.shadowBlur = 28;
  ctx.fillText(big, W / 2, 254);
  ctx.shadowBlur = 0;

  // Exercícios que compõem o grupo (ex.: "Esteira • Corrida ao Ar Livre")
  ctx.fillStyle = "rgba(255,255,255,0.40)";
  ctx.font = `500 12px ${FONT}`;
  ctx.fillText(truncateToWidth(ctx, group.names.join("  •  "), W - 70), W / 2, 284);

  drawPulseLine(ctx, W, 312, ACCENT);

  // Painéis de stat — o conteúdo muda conforme a métrica em destaque
  const pace = meta.speedMetric === "pace" ? formatPace(group.minutes, group.km) : null;
  const speed = meta.speedMetric === "speed" ? formatSpeed(group.minutes, group.km) : null;
  const panels: Array<{ l: string; v: string }> = [];
  if (hasDistance && group.minutes > 0) {
    panels.push({ l: "TEMPO", v: formatCardioMinutes(group.minutes) });
    if (pace) panels.push({ l: "RITMO", v: `${pace}/km` });
    else if (speed) panels.push({ l: "VELOCIDADE", v: `${speed} km/h` });
  } else {
    panels.push({ l: "SERIES", v: String(group.sets) });
  }
  // Elevação da esteira: só aparece quando a pessoa informou. Toma o lugar do
  // painel da SESSAO (o cronômetro já é o número menos específico do card) para
  // a fileira não passar de três painéis e espremer os valores.
  if (group.elevationPct) {
    panels.push({ l: "ELEVACAO", v: formatElevationPct(group.elevationPct) });
  } else {
    panels.push({ l: "SESSAO", v: formatCardioMinutes(info.durationSecs / 60) });
  }
  drawCanvasStatPanels(ctx, W, 332, panels, ACCENT);

  // Frase de conquista conforme a marca atingida
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.font = `600 13px ${FONT}`;
  ctx.fillText(truncateToWidth(ctx, milestonePhrase(group), W - 70), W / 2, 424);

  drawCanvasDivider(ctx, W, 452);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = `500 12px ${FONT}`;
  ctx.fillText(truncateToWidth(ctx, info.routineName, W - 80), W / 2, 478);

  drawCanvasFooter(ctx, W, H);
  ctx.restore();
}
