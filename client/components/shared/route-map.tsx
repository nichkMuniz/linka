import * as React from "react";
import type { RunPoint } from "@/lib/run-tracker";

// ── Mapa estático do trajeto (corrida GPS) ──────────────────────────────────
// Mini-renderizador de "slippy map" sem dependências: calcula o zoom que
// enquadra o trajeto, monta a grade de tiles (CARTO dark — combina com o tema
// glass escuro da sessão de treino; atribuição OSM/CARTO obrigatória no canto)
// e desenha a polyline do percurso numa camada SVG por cima. Estático de
// propósito (sem pan/zoom): é um resumo pós-corrida, não um mapa navegável.

interface RouteMapProps {
  /** trajeto em segmentos (quebra a cada pausa→retomada) */
  path: RunPoint[][];
  height?: number;
  /** texto exibido quando não há pontos suficientes para desenhar */
  emptyLabel: string;
}

const TILE = 256;
const MIN_ZOOM = 3;
const MAX_ZOOM = 17;
/** margem interna (px) entre o trajeto e a borda do mapa */
const FIT_PADDING = 28;

// Projeção Web Mercator normalizada [0..1]
function mercX(lng: number): number {
  return (lng + 180) / 360;
}
function mercY(lat: number): number {
  const rad = (Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180;
  return (1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2;
}

export function RouteMap({ path, height = 220, emptyLabel }: RouteMapProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);

  React.useLayoutEffect(() => {
    if (containerRef.current) setWidth(containerRef.current.clientWidth);
  }, []);

  const points = path.flat();

  const empty = (
    <div
      ref={containerRef}
      style={{
        width: "100%", height, borderRadius: 16,
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.1)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "0 24px", textAlign: "center",
      }}
    >
      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
        {emptyLabel}
      </span>
    </div>
  );

  if (points.length < 2) return empty;

  // 1º render: só mede a largura do container (width=0), depois desenha
  if (width === 0) {
    return <div ref={containerRef} style={{ width: "100%", height }} />;
  }

  // Enquadramento: maior zoom inteiro em que o bbox do trajeto cabe com folga
  const xs = points.map((p) => mercX(p.lng));
  const ys = points.map((p) => mercY(p.lat));
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1e-9);
  const spanY = Math.max(maxY - minY, 1e-9);
  const zoom = Math.max(
    MIN_ZOOM,
    Math.min(
      MAX_ZOOM,
      Math.floor(
        Math.min(
          Math.log2((width - FIT_PADDING * 2) / (TILE * spanX)),
          Math.log2((height - FIT_PADDING * 2) / (TILE * spanY)),
        ),
      ),
    ),
  );

  const worldSize = TILE * Math.pow(2, zoom);
  const centerPxX = ((minX + maxX) / 2) * worldSize;
  const centerPxY = ((minY + maxY) / 2) * worldSize;
  // canto superior esquerdo do viewport em pixels-mundo
  const tlX = centerPxX - width / 2;
  const tlY = centerPxY - height / 2;

  // Grade de tiles que cobre o viewport
  const maxTile = Math.pow(2, zoom) - 1;
  const txMin = Math.floor(tlX / TILE);
  const txMax = Math.floor((tlX + width) / TILE);
  const tyMin = Math.max(0, Math.floor(tlY / TILE));
  const tyMax = Math.min(maxTile, Math.floor((tlY + height) / TILE));
  const tiles: Array<{ x: number; y: number; left: number; top: number }> = [];
  for (let tx = txMin; tx <= txMax; tx++) {
    for (let ty = tyMin; ty <= tyMax; ty++) {
      tiles.push({
        x: ((tx % (maxTile + 1)) + maxTile + 1) % (maxTile + 1),
        y: ty,
        left: tx * TILE - tlX,
        top: ty * TILE - tlY,
      });
    }
  }

  const toLocal = (p: RunPoint) => ({
    x: mercX(p.lng) * worldSize - tlX,
    y: mercY(p.lat) * worldSize - tlY,
  });
  const segments = path
    .filter((seg) => seg.length > 1)
    .map((seg) => seg.map(toLocal));
  const start = toLocal(points[0]);
  const end = toLocal(points[points.length - 1]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative", width: "100%", height,
        borderRadius: 16, overflow: "hidden",
        background: "#12141c",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {tiles.map((tile) => (
        <img
          key={`${tile.x}-${tile.y}`}
          src={`https://${"abcd"[(tile.x + tile.y) % 4]}.basemaps.cartocdn.com/dark_all/${zoom}/${tile.x}/${tile.y}@2x.png`}
          alt=""
          draggable={false}
          style={{
            position: "absolute", left: tile.left, top: tile.top,
            width: TILE, height: TILE, pointerEvents: "none", userSelect: "none",
          }}
        />
      ))}

      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", inset: 0 }}
      >
        {segments.map((seg, i) => (
          <polyline
            key={i}
            points={seg.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
            fill="none"
            stroke="#5b8cff"
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: "drop-shadow(0 0 4px rgba(91,140,255,0.6))" }}
          />
        ))}
        {/* início (verde) e fim (laranja) */}
        <circle cx={start.x} cy={start.y} r={6} fill="#34d399" stroke="#fff" strokeWidth={2} />
        <circle cx={end.x} cy={end.y} r={6} fill="hsl(24, 95%, 55%)" stroke="#fff" strokeWidth={2} />
      </svg>

      {/* Atribuição obrigatória dos tiles */}
      <span style={{
        position: "absolute", right: 6, bottom: 4,
        fontSize: 8.5, color: "rgba(255,255,255,0.45)",
        textShadow: "0 1px 2px rgba(0,0,0,0.8)", pointerEvents: "none",
      }}>
        © OpenStreetMap © CARTO
      </span>
    </div>
  );
}
