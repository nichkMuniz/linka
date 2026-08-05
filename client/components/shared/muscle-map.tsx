import * as React from "react";

/**
 * Mapa corporal — silhueta frente/costas com as regiões musculares acesas por
 * intensidade. Usado na ficha de anatomia do exercício (Fase 2 do plano de
 * treino profissional).
 *
 * **SVG inline, sem dependência.** Uma lib de anatomia obrigaria regenerar os
 * dois lockfiles (npm p/ Appflow, pnpm p/ Vercel) — mesma decisão do
 * `trend-chart.tsx`, que também desenha à mão.
 *
 * O desenho é ESQUEMÁTICO, não um atlas: formas simples e reconhecíveis num
 * quadro de ~110px de largura dentro de um drawer. O objetivo é responder
 * "onde isso pega?" em meio segundo, não ensinar anatomia.
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
  if (v >= 60) return "rgba(249,115,22,0.92)";  // laranja — alvo do exercício
  if (v >= 30) return "rgba(249,115,22,0.45)";  // laranja fraco — auxiliar
  if (v > 0) return "rgba(249,115,22,0.20)";    // quase apagado — estabilizador
  return "rgba(255,255,255,0.07)";              // inativo
}

// ── Geometria ───────────────────────────────────────────────────────────────
// viewBox 100×200. Cada região é um conjunto de formas (as pares/simétricas
// aparecem duas vezes, esquerda e direita). Manter as duas vistas com o mesmo
// esqueleto (cabeça, tronco, membros nas mesmas coordenadas) faz a troca
// frente↔costas parecer o mesmo corpo girando.

type Shape =
  | { t: "rect"; x: number; y: number; w: number; h: number; r?: number }
  | { t: "ellipse"; cx: number; cy: number; rx: number; ry: number };

const FRONT_REGIONS: Record<string, Shape[]> = {
  shoulders_front: [
    { t: "ellipse", cx: 30, cy: 47, rx: 8, ry: 7 },
    { t: "ellipse", cx: 70, cy: 47, rx: 8, ry: 7 },
  ],
  chest: [
    { t: "rect", x: 37, y: 45, w: 12, h: 16, r: 4 },
    { t: "rect", x: 51, y: 45, w: 12, h: 16, r: 4 },
  ],
  abs: [
    { t: "rect", x: 42, y: 63, w: 7, h: 22, r: 2 },
    { t: "rect", x: 51, y: 63, w: 7, h: 22, r: 2 },
  ],
  obliques: [
    { t: "rect", x: 35, y: 64, w: 5, h: 19, r: 2 },
    { t: "rect", x: 60, y: 64, w: 5, h: 19, r: 2 },
  ],
  biceps: [
    { t: "ellipse", cx: 26, cy: 62, rx: 5, ry: 9 },
    { t: "ellipse", cx: 74, cy: 62, rx: 5, ry: 9 },
  ],
  forearms: [
    { t: "ellipse", cx: 23, cy: 80, rx: 4.5, ry: 10 },
    { t: "ellipse", cx: 77, cy: 80, rx: 4.5, ry: 10 },
  ],
  quads: [
    { t: "ellipse", cx: 42, cy: 112, rx: 8, ry: 22 },
    { t: "ellipse", cx: 58, cy: 112, rx: 8, ry: 22 },
  ],
  adductors: [
    { t: "ellipse", cx: 46, cy: 105, rx: 3.5, ry: 14 },
    { t: "ellipse", cx: 54, cy: 105, rx: 3.5, ry: 14 },
  ],
  calves_front: [
    { t: "ellipse", cx: 43, cy: 155, rx: 5, ry: 17 },
    { t: "ellipse", cx: 57, cy: 155, rx: 5, ry: 17 },
  ],
  // Cardio não tem lugar no corpo — acende o tronco inteiro como "sistêmico".
  cardio: [{ t: "ellipse", cx: 50, cy: 62, rx: 15, ry: 20 }],
};

const BACK_REGIONS: Record<string, Shape[]> = {
  traps: [{ t: "rect", x: 38, y: 40, w: 24, h: 17, r: 6 }],
  shoulders_rear: [
    { t: "ellipse", cx: 30, cy: 47, rx: 8, ry: 7 },
    { t: "ellipse", cx: 70, cy: 47, rx: 8, ry: 7 },
  ],
  lats: [
    { t: "rect", x: 34, y: 57, w: 13, h: 21, r: 5 },
    { t: "rect", x: 53, y: 57, w: 13, h: 21, r: 5 },
  ],
  lower_back: [{ t: "rect", x: 42, y: 79, w: 16, h: 12, r: 4 }],
  triceps: [
    { t: "ellipse", cx: 26, cy: 62, rx: 5, ry: 9 },
    { t: "ellipse", cx: 74, cy: 62, rx: 5, ry: 9 },
  ],
  forearms: [
    { t: "ellipse", cx: 23, cy: 80, rx: 4.5, ry: 10 },
    { t: "ellipse", cx: 77, cy: 80, rx: 4.5, ry: 10 },
  ],
  glutes: [
    { t: "ellipse", cx: 43, cy: 96, rx: 8, ry: 8 },
    { t: "ellipse", cx: 57, cy: 96, rx: 8, ry: 8 },
  ],
  hamstrings: [
    { t: "ellipse", cx: 42, cy: 118, rx: 8, ry: 20 },
    { t: "ellipse", cx: 58, cy: 118, rx: 8, ry: 20 },
  ],
  calves: [
    { t: "ellipse", cx: 43, cy: 155, rx: 5.5, ry: 17 },
    { t: "ellipse", cx: 57, cy: 155, rx: 5.5, ry: 17 },
  ],
  cardio: [{ t: "ellipse", cx: 50, cy: 62, rx: 15, ry: 20 }],
};

/** Silhueta de fundo — desenhada sob as regiões para dar contorno de corpo. */
const SILHOUETTE: Shape[] = [
  { t: "ellipse", cx: 50, cy: 22, rx: 10, ry: 12 },          // cabeça
  { t: "rect", x: 46, y: 33, w: 8, h: 7, r: 2 },             // pescoço
  { t: "rect", x: 33, y: 40, w: 34, h: 52, r: 12 },          // tronco
  { t: "rect", x: 20, y: 44, w: 10, h: 46, r: 5 },           // braço esq
  { t: "rect", x: 70, y: 44, w: 10, h: 46, r: 5 },           // braço dir
  { t: "rect", x: 34, y: 88, w: 15, h: 88, r: 7 },           // perna esq
  { t: "rect", x: 51, y: 88, w: 15, h: 88, r: 7 },           // perna dir
];

function renderShapes(shapes: Shape[], fill: string, keyPrefix: string) {
  return shapes.map((s, i) =>
    s.t === "rect" ? (
      <rect
        key={`${keyPrefix}-${i}`}
        x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r ?? 3}
        fill={fill}
      />
    ) : (
      <ellipse
        key={`${keyPrefix}-${i}`}
        cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry}
        fill={fill}
      />
    ),
  );
}

export function MuscleMap({ intensity, view, width = 110, className }: MuscleMapProps) {
  const regions = view === "front" ? FRONT_REGIONS : BACK_REGIONS;

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
      {/* Silhueta — bem apagada, só para o olho reconhecer um corpo */}
      <g opacity={0.5}>
        {renderShapes(SILHOUETTE, "rgba(255,255,255,0.06)", "sil")}
      </g>

      {Object.entries(regions).map(([part, shapes]) => (
        <g key={part}>{renderShapes(shapes, regionFill(intensity[part]), part)}</g>
      ))}
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
