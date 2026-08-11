import * as React from "react";

/**
 * Mapa corporal — silhueta frente/costas com as regiões musculares acesas por
 * intensidade. Usado na ficha de anatomia do exercício e no card de cobertura
 * muscular (plano de treino profissional).
 *
 * **SVG inline, sem dependência.** Uma lib de anatomia obrigaria regenerar os
 * dois lockfiles (npm p/ Appflow, pnpm p/ Vercel) — mesma decisão do
 * `trend-chart.tsx`, que também desenha à mão.
 *
 * O desenho é ANATÔMICO, não geométrico: o contorno sai de listas de pontos
 * suavizadas por Catmull-Rom, não de círculos e retângulos. O motivo é que o
 * usuário precisa reconhecer o corpo — e, principalmente, saber **de que lado
 * está olhando** — em meio segundo, num quadro de 54–120px.
 *
 * A orientação nunca depende só do contorno (que é quase simétrico entre as
 * duas vistas). Ela é dita por marcas que só existem de um lado:
 *   - FRENTE: rosto, clavículas, esterno, linha alba com as divisões do
 *     abdômen, umbigo e rótulas.
 *   - COSTAS: sem rosto (só a linha do cabelo na nuca), coluna descendo o
 *     tronco inteiro, prega glútea, dobra atrás do joelho e tendão de aquiles.
 *
 * A pintura é por REGIÃO (`bodyPart`), não por músculo: vários músculos caem na
 * mesma região do desenho (as 3 porções do peito → `chest`) e a região acende
 * com a MAIOR ênfase entre eles. Quem quer o detalhe por porção lê a lista ao
 * lado — o mapa é a visão geral.
 */

export type MuscleMapView = "front" | "back";

/** `bodyPart` → intensidade 0–100. Regiões ausentes ficam apagadas. */
export type MuscleMapIntensity = Record<string, number>;

interface MuscleMapProps {
  intensity: MuscleMapIntensity;
  view: MuscleMapView;
  /** largura em px (a altura acompanha a proporção 1:2 do viewBox) */
  width?: number;
  className?: string;
}

// Cor de uma região: quanto maior a ênfase, mais quente e opaca. Os cortes
// são os mesmos do rótulo textual (primário ≥ 60, secundário ≥ 30).
function regionFill(value: number | undefined): string {
  const v = value ?? 0;
  if (v >= 60) return "rgba(249,115,22,0.95)";  // laranja — alvo do exercício
  if (v >= 30) return "rgba(249,115,22,0.50)";  // laranja fraco — auxiliar
  if (v > 0) return "rgba(249,115,22,0.22)";    // quase apagado — estabilizador
  return "rgba(255,255,255,0.05)";              // inativo — só marca o relevo
}

// ── Geometria ───────────────────────────────────────────────────────────────
// viewBox 100×200, figura centrada em x=50. Toda forma é uma lista de pontos
// fechada; a curva sai do suavizador abaixo. Editar o desenho = mexer em
// números, nunca em strings de path.

type Pt = readonly [number, number];

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Catmull-Rom uniforme → cubic Bézier, contorno fechado. Passa exatamente por
 * todos os pontos, o que deixa o ajuste fino previsível: mover um ponto move
 * aquele trecho do corpo, e só ele.
 */
function smooth(pts: Pt[]): string {
  const n = pts.length;
  if (n < 3) return "";
  let d = `M${r2(pts[0][0])},${r2(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${r2(c1x)},${r2(c1y)} ${r2(c2x)},${r2(c2y)} ${r2(p2[0])},${r2(p2[1])}`;
  }
  return `${d}Z`;
}

/** Espelha no eixo do corpo — usado para o membro do outro lado. */
const mirror = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [100 - x, y] as Pt);

/**
 * Fecha um contorno simétrico a partir da metade DIREITA, de cima para baixo.
 * O primeiro e o último ponto devem estar em x=50 (eixo), senão a costura
 * aparece.
 */
function sym(rightHalf: Pt[]): Pt[] {
  return [...rightHalf, ...mirror(rightHalf).reverse().slice(1, -1)];
}

/** Região bilateral: mesma forma dos dois lados. */
const pair = (right: Pt[]): Pt[][] => [right, mirror(right)];

// ── Esqueleto do corpo (idêntico nas duas vistas) ───────────────────────────
// Manter o mesmo contorno nas duas vistas faz a troca frente↔costas parecer o
// mesmo corpo girando, não dois desenhos diferentes.

const HEAD = sym([
  [50, 9], [55.5, 10.5], [58.5, 15], [58.5, 21.5], [57, 26.5], [54, 30.5], [50, 33.5],
]);

const TORSO = sym([
  [50, 30],
  [55, 33],      // lateral do pescoço
  [56.5, 38.5],  // base do pescoço
  [62, 41],      // inclinação do trapézio
  [68.5, 44.5],  // topo do ombro
  [72, 50],      // deltoide — ponto mais largo do corpo
  [70.5, 56],
  [66, 61],      // axila
  [64.5, 69],    // caixa torácica
  [62, 79],      // cintura
  [62, 86],
  [64.5, 94],    // quadril
  [64, 101],
  [57.5, 106],   // virilha
  [50, 104],
]);

const ARM_R: Pt[] = [
  [68, 44.5],
  [72, 49], [74, 57], [74.5, 65], [74.5, 72],   // braço, face externa
  [76, 81], [77, 92], [77.5, 101],              // antebraço
  [79, 109], [78, 117],                         // mão
  [74.5, 118], [73, 109],
  [72.5, 101], [71, 92], [69.2, 81],
  [68.3, 72], [67.8, 63], [67, 56],             // face interna, subindo
];

const LEG_R: Pt[] = [
  [64.5, 94],
  [66, 103], [65.5, 113], [63, 126],            // coxa, face externa
  [61.5, 136], [60.5, 143],                     // joelho
  [62, 152], [59.5, 164], [57.5, 174],          // panturrilha e tornozelo
  [59, 181], [55.5, 185], [51.8, 183.5],        // pé
  [52.6, 176], [53.2, 166], [53, 155],
  [53, 143], [53.2, 130], [53.2, 116], [54, 107], [57, 104],
];

const HEAD_D = smooth(HEAD);

const BODY_PARTS: string[] = [
  HEAD_D,
  smooth(TORSO),
  smooth(ARM_R),
  smooth(mirror(ARM_R)),
  smooth(LEG_R),
  smooth(mirror(LEG_R)),
];

// ── Regiões musculares ──────────────────────────────────────────────────────
// Desenhadas para NÃO se sobrepor: fills translúcidos empilhados criariam
// manchas mais escuras que seriam lidas como "mais intenso" sem ser.

/** Sistêmico — cardio não tem lugar no corpo, acende o tronco inteiro. */
const CARDIO: Pt[][] = [sym([[50, 42.5], [61, 45.5], [65.5, 55], [64.5, 71], [61, 86], [50, 89]])];

/** Deltoide: a tampa do ombro é a mesma forma nas duas vistas. */
const DELTOID: Pt[] = [[65.5, 44], [70, 46.5], [73, 52], [72.5, 58.5], [69, 60.5], [66, 56.5], [65, 49]];
/** Antebraço: visível de frente e de costas no mesmo lugar. */
const FOREARM: Pt[] = [[69.2, 78], [75, 80], [77, 91], [77, 100], [73.8, 102], [70.5, 94], [69, 84]];

const FRONT_REGIONS: Record<string, Pt[][]> = {
  shoulders_front: pair(DELTOID),
  chest: pair([[51, 46.5], [60.5, 46], [65.5, 49.5], [66, 55], [63, 61], [55, 62], [51, 61]]),
  abs: pair([[51, 64.5], [57, 65], [58.5, 72], [58.5, 82], [57, 88], [51, 88.5]]),
  obliques: pair([[59, 65.5], [62.8, 67.5], [63, 78], [61, 85.5], [59.3, 83.5], [58.8, 73.5]]),
  biceps: pair([[68.5, 57], [72.5, 59], [73.7, 67], [72, 73], [68.8, 72], [67.9, 63]]),
  forearms: pair(FOREARM),
  quads: pair([[54.5, 105], [61.5, 104], [65, 112], [64, 126], [61, 136], [57, 136.5], [55, 127], [54.3, 115]]),
  adductors: pair([[51.3, 106], [54, 106.5], [54.5, 119], [53.2, 130], [51.5, 130], [51, 117]]),
  calves_front: pair([[54.5, 146], [59, 147], [59.5, 158], [57.5, 170], [55, 170.5], [54, 158]]),
  cardio: CARDIO,
};

const BACK_REGIONS: Record<string, Pt[][]> = {
  traps: [sym([[50, 32], [54, 35], [59.5, 40.5], [64, 46], [58.5, 53], [55, 60], [50, 64]])],
  shoulders_rear: pair(DELTOID),
  lats: pair([[57.5, 56], [63.5, 58], [66, 65], [63.5, 74], [58.5, 83], [56.2, 79], [55.8, 69], [56.5, 60]]),
  lower_back: [sym([[50, 73], [54, 75], [55, 82.5], [53.5, 90.5], [50, 92]])],
  triceps: pair([[68, 56], [73, 58], [74.5, 67], [72.5, 75], [68.8, 73], [67.9, 62]]),
  forearms: pair(FOREARM),
  glutes: pair([[51, 91], [58.5, 90], [64, 94.5], [64, 102], [59, 106], [52.5, 104.5], [51, 98]]),
  hamstrings: pair([[53.3, 109], [61.5, 108], [64, 116], [62.7, 128], [59.8, 136.5], [56, 136.5], [54.2, 127], [53.2, 116]]),
  calves: pair([[54, 143], [59, 142], [61.8, 150], [60.5, 161], [57.5, 171], [55, 170], [53.5, 158], [53.2, 149]]),
  cardio: CARDIO,
};

// Paths pré-calculados: a suavização roda uma vez por módulo, não por render.
function compile(src: Record<string, Pt[][]>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [part, contours] of Object.entries(src)) out[part] = contours.map(smooth);
  return out;
}

const FRONT_PATHS = compile(FRONT_REGIONS);
const BACK_PATHS = compile(BACK_REGIONS);

// ── Marcas de orientação ────────────────────────────────────────────────────
// O que responde "estou vendo a frente ou as costas?". Sulcos escuros funcionam
// como sombra e continuam legíveis por cima de qualquer cor de intensidade.

const GROOVE = "rgba(0,0,0,0.28)";
const HINT = "rgba(255,255,255,0.32)";

function FrontMarks() {
  return (
    <g fill="none" strokeLinecap="round">
      {/* Rosto — a marca mais forte de todas: se tem rosto, é a frente. */}
      <ellipse cx={50} cy={22} rx={5.8} ry={7.7} fill="rgba(255,255,255,0.12)" />
      <circle cx={47.4} cy={20.5} r={1} fill={HINT} />
      <circle cx={52.6} cy={20.5} r={1} fill={HINT} />
      <path d="M47.8,26.8 Q50,28.1 52.2,26.8" stroke={GROOVE} strokeWidth={0.8} />

      {/* Clavículas */}
      <path d="M50,44.2 C55,44 60,45 64.5,47.5" stroke={GROOVE} strokeWidth={0.9} />
      <path d="M50,44.2 C45,44 40,45 35.5,47.5" stroke={GROOVE} strokeWidth={0.9} />

      {/* Esterno + linha alba: um sulco central contínuo do peito ao umbigo */}
      <path d="M50,46.5 V63" stroke={GROOVE} strokeWidth={1} />
      <path d="M50,65 V87" stroke={GROOVE} strokeWidth={1} />

      {/* Divisões do reto abdominal — o "tanquinho" que só aparece de frente */}
      <path d="M42.6,71.5 H57.4" stroke={GROOVE} strokeWidth={0.8} />
      <path d="M42.8,77.5 H57.2" stroke={GROOVE} strokeWidth={0.8} />
      <path d="M43.4,83.5 H56.6" stroke={GROOVE} strokeWidth={0.8} />
      <circle cx={50} cy={87.5} r={1} fill={GROOVE} />

      {/* Dobra do cotovelo (fossa cubital) */}
      <path d="M68.4,73.5 C70.4,74.6 72.6,74.6 74.2,73.5" stroke={GROOVE} strokeWidth={0.7} />
      <path d="M31.6,73.5 C29.6,74.6 27.4,74.6 25.8,73.5" stroke={GROOVE} strokeWidth={0.7} />

      {/* Rótulas */}
      <ellipse cx={56.9} cy={139.5} rx={2.9} ry={3.8} fill="none" stroke={GROOVE} strokeWidth={0.8} />
      <ellipse cx={43.1} cy={139.5} rx={2.9} ry={3.8} fill="none" stroke={GROOVE} strokeWidth={0.8} />
    </g>
  );
}

function BackMarks() {
  return (
    <g fill="none" strokeLinecap="round">
      {/* Sem rosto: a cabeça vira um bloco escuro de cabelo, o oposto exato da
          face clara da vista frontal. É esse contraste que resolve a orientação
          nos mapas de 54px, onde nenhum traço fino sobrevive. */}
      <path d={HEAD_D} fill="rgba(0,0,0,0.17)" />
      <path d="M43.6,25.5 C46,29.5 54,29.5 56.4,25.5" stroke={GROOVE} strokeWidth={1.1} />

      {/* Coluna: sulco único do pescoço ao sacro, a assinatura das costas */}
      <path d="M50,38 V93" stroke={GROOVE} strokeWidth={1.1} />

      {/* Escápulas */}
      <path d="M45.8,49.5 C42.8,54 42.8,59 45,62.5" stroke={GROOVE} strokeWidth={0.7} />
      <path d="M54.2,49.5 C57.2,54 57.2,59 55,62.5" stroke={GROOVE} strokeWidth={0.7} />

      {/* Prega glútea */}
      <path d="M50,93 V104.5" stroke={GROOVE} strokeWidth={1} />
      <path d="M52.6,104.4 C55.4,106.8 59.4,106.8 62.6,104.6" stroke={GROOVE} strokeWidth={0.9} />
      <path d="M47.4,104.4 C44.6,106.8 40.6,106.8 37.4,104.6" stroke={GROOVE} strokeWidth={0.9} />

      {/* Ponta do cotovelo (olécrano) */}
      <path d="M68.4,73 C70.4,71.9 72.6,71.9 74.2,73" stroke={GROOVE} strokeWidth={0.7} />
      <path d="M31.6,73 C29.6,71.9 27.4,71.9 25.8,73" stroke={GROOVE} strokeWidth={0.7} />

      {/* Dobra atrás do joelho */}
      <path d="M53.4,139.5 H60.6" stroke={GROOVE} strokeWidth={0.8} />
      <path d="M46.6,139.5 H39.4" stroke={GROOVE} strokeWidth={0.8} />

      {/* Tendão de aquiles */}
      <path d="M56,164.5 V176" stroke={GROOVE} strokeWidth={0.8} />
      <path d="M44,164.5 V176" stroke={GROOVE} strokeWidth={0.8} />
    </g>
  );
}

export function MuscleMap({ intensity, view, width = 110, className }: MuscleMapProps) {
  // Vários mapas convivem na mesma tela (o card mostra frente e costas lado a
  // lado): os ids de clip/gradiente precisam ser únicos por instância.
  const uid = React.useId().replace(/:/g, "");
  const paths = view === "front" ? FRONT_PATHS : BACK_PATHS;

  return (
    <svg
      viewBox="0 0 100 200"
      width={width}
      height={width * 2}
      className={className}
      role="img"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <defs>
        <clipPath id={`${uid}-body`}>
          {BODY_PARTS.map((d, i) => <path key={i} d={d} />)}
        </clipPath>
        {/* Luz vindo de cima à esquerda: dá volume e tira o ar de adesivo */}
        <linearGradient id={`${uid}-vol`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0.10" />
          <stop offset="0.42" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.24" />
        </linearGradient>
      </defs>

      {/* Corpo — a base que existe mesmo sem nenhum treino registrado */}
      <g fill="rgba(255,255,255,0.09)">
        {BODY_PARTS.map((d, i) => <path key={i} d={d} />)}
      </g>

      {/* Regiões e sombreamento, recortados no corpo para nada vazar do contorno */}
      <g clipPath={`url(#${uid}-body)`}>
        {Object.entries(paths).map(([part, ds]) => {
          // `cardio` cobre o tronco inteiro e é a única região que se sobrepõe
          // às outras. Apagada, ela lavaria o peito e o abdômen acesos por
          // baixo — então só entra em cena quando o exercício é cardio.
          if (part === "cardio" && !intensity.cardio) return null;
          return (
            <g key={part} fill={regionFill(intensity[part])}>
              {ds.map((d, i) => <path key={i} d={d} />)}
            </g>
          );
        })}
        <rect x="0" y="0" width="100" height="200" fill={`url(#${uid}-vol)`} />
        {view === "front" ? <FrontMarks /> : <BackMarks />}
      </g>

      {/* Contorno por último: fecha a figura por cima das regiões */}
      <g
        fill="none"
        stroke="rgba(255,255,255,0.24)"
        strokeWidth={0.9}
        strokeLinejoin="round"
      >
        {BODY_PARTS.map((d, i) => <path key={i} d={d} />)}
      </g>
    </svg>
  );
}

/**
 * Reduz uma lista de músculos recrutados ao mapa de intensidade por região.
 * Quando vários músculos caem na mesma região (as 3 porções do peito), vence a
 * MAIOR ênfase — a região representa "o quanto este exercício pega aqui".
 */
export function buildMuscleIntensity(
  muscles: Array<{ bodyPart: string; emphasis: number }>,
): MuscleMapIntensity {
  const out: MuscleMapIntensity = {};
  for (const m of muscles) {
    if (!m.bodyPart) continue;
    if (m.emphasis > (out[m.bodyPart] ?? 0)) out[m.bodyPart] = m.emphasis;
  }
  return out;
}
