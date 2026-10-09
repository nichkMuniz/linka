import * as React from "react";
import type { RunPoint } from "@/lib/run-tracker";

// ── Mapa do trajeto (corrida GPS) ───────────────────────────────────────────
// Mini-renderizador de "slippy map" sem dependências: calcula o zoom que
// enquadra o trajeto, monta a grade de tiles (Esri Dark Gray Canvas — sem
// chave de API e com CORS; atribuição Esri/OSM obrigatória no canto),
// escurece o fundo e desenha a polyline do percurso por cima, no estilo
// Strava (rota laranja com contorno, largada verde, chegada quadriculada).
// CARTO (basemaps.cartocdn.com) foi abandonado: passou a exigir API key e
// devolve um tile "API KEY REQUIRED" com HTTP 200. Duas saídas com a MESMA
// matemática:
//   - <RouteMap/>            → DOM (tiles em <img> + SVG), para exibição
//   - renderRouteMapImage()  → canvas → Blob JPEG, para compartilhar/postar
// Estático de propósito (sem pan/zoom): é um resumo pós-corrida.

const TILE = 256;
const MIN_ZOOM = 3;
const MAX_ZOOM = 17;
/** zoom máximo servido pelo Dark Gray Canvas — acima disso vem "Map data not yet available" */
const TILE_MAX_ZOOM = 16;
/** margem interna (px) entre o trajeto e a borda do mapa no componente DOM */
const FIT_PADDING = 28;
const MAP_BG = "#16181f";
/** véu sobre os tiles: o cinza do Esri vira o quase-preto do mapa escuro do Strava */
const MAP_SHADE = "rgba(8,10,16,0.42)";
const ROUTE_COLOR = "#fc5200";
const ROUTE_CASING = "rgba(0,0,0,0.6)";
const START_COLOR = "#22c55e";
const ATTRIBUTION = "Esri, HERE, Garmin, © OpenStreetMap";

// Projeção Web Mercator normalizada [0..1]
function mercX(lng: number): number {
  return (lng + 180) / 360;
}
function mercY(lat: number): number {
  const rad = (Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180;
  return (1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2;
}

// Esri usa a ordem z/y/x na URL
function tileUrl(z: number, x: number, y: number): string {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/${z}/${y}/${x}`;
}

interface RouteLayout {
  /** zoom em que os tiles são buscados (pode diferir do zoom de exibição) */
  tileZoom: number;
  /** lado de cada tile em px de exibição (128 no Retina, 256 normal, 512 se ampliado) */
  tileSize: number;
  tiles: Array<{ x: number; y: number; left: number; top: number }>;
  toLocal: (p: RunPoint) => { x: number; y: number };
}

// Enquadramento: maior zoom inteiro em que o bbox do trajeto cabe com folga,
// centro no meio do bbox, e a grade de tiles que cobre o viewport width×height.
// `hiDpi`: o Esri não tem tiles @2x, então no DOM (tela Retina) busca um zoom
// acima e desenha cada tile com metade do tamanho — mesma área, o dobro de pixels.
function computeRouteLayout(
  points: RunPoint[], width: number, height: number, padding: number, hiDpi: boolean,
): RouteLayout {
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
          Math.log2((width - padding * 2) / (TILE * spanX)),
          Math.log2((height - padding * 2) / (TILE * spanY)),
        ),
      ),
    ),
  );

  const worldSize = TILE * Math.pow(2, zoom);
  // canto superior esquerdo do viewport em pixels-mundo
  const tlX = ((minX + maxX) / 2) * worldSize - width / 2;
  const tlY = ((minY + maxY) / 2) * worldSize - height / 2;

  const tileZoom = Math.min(TILE_MAX_ZOOM, zoom + (hiDpi ? 1 : 0));
  const tileSize = TILE * Math.pow(2, zoom - tileZoom);
  const maxTile = Math.pow(2, tileZoom) - 1;
  const txMin = Math.floor(tlX / tileSize);
  const txMax = Math.floor((tlX + width) / tileSize);
  const tyMin = Math.max(0, Math.floor(tlY / tileSize));
  const tyMax = Math.min(maxTile, Math.floor((tlY + height) / tileSize));
  const tiles: RouteLayout["tiles"] = [];
  for (let tx = txMin; tx <= txMax; tx++) {
    for (let ty = tyMin; ty <= tyMax; ty++) {
      tiles.push({
        x: ((tx % (maxTile + 1)) + maxTile + 1) % (maxTile + 1),
        y: ty,
        left: tx * tileSize - tlX,
        top: ty * tileSize - tlY,
      });
    }
  }

  return {
    tileZoom,
    tileSize,
    tiles,
    toLocal: (p) => ({
      x: mercX(p.lng) * worldSize - tlX,
      y: mercY(p.lat) * worldSize - tlY,
    }),
  };
}

// ── Componente DOM (exibição) ───────────────────────────────────────────────

interface RouteMapProps {
  /** trajeto em segmentos (quebra a cada pausa→retomada) */
  path: RunPoint[][];
  height?: number;
  /** texto exibido quando não há pontos suficientes para desenhar */
  emptyLabel: string;
}

export function RouteMap({ path, height = 220, emptyLabel }: RouteMapProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);
  const checkerId = `route-finish-${React.useId().replace(/:/g, "")}`;

  React.useLayoutEffect(() => {
    if (containerRef.current) setWidth(containerRef.current.clientWidth);
  }, []);

  const points = path.flat();

  if (points.length < 2) {
    return (
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
  }

  // 1º render: só mede a largura do container (width=0), depois desenha
  if (width === 0) {
    return <div ref={containerRef} style={{ width: "100%", height }} />;
  }

  const layout = computeRouteLayout(points, width, height, FIT_PADDING, true);
  const segments = path
    .filter((seg) => seg.length > 1)
    .map((seg) => seg.map(layout.toLocal).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "));
  const start = layout.toLocal(points[0]);
  const end = layout.toLocal(points[points.length - 1]);
  const dotR = 6;
  const sq = dotR / 2;

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative", width: "100%", height,
        borderRadius: 16, overflow: "hidden",
        background: MAP_BG,
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {layout.tiles.map((tile) => {
        // bordas arredondadas a partir da posição absoluta: tiles vizinhos
        // encostam sem a linha fina que aparece com coordenadas fracionárias
        const left = Math.round(tile.left);
        const top = Math.round(tile.top);
        return (
          <img
            key={`${tile.x}-${tile.y}`}
            src={tileUrl(layout.tileZoom, tile.x, tile.y)}
            alt=""
            draggable={false}
            onLoad={(e) => { e.currentTarget.style.opacity = "1"; }}
            style={{
              position: "absolute", left, top,
              width: Math.round(tile.left + layout.tileSize) - left,
              height: Math.round(tile.top + layout.tileSize) - top,
              opacity: 0, transition: "opacity 0.25s ease-out",
              pointerEvents: "none", userSelect: "none",
            }}
          />
        );
      })}

      <div style={{ position: "absolute", inset: 0, background: MAP_SHADE, pointerEvents: "none" }} />

      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          {/* bandeira quadriculada da chegada */}
          <pattern
            id={checkerId}
            patternUnits="userSpaceOnUse"
            x={end.x - dotR} y={end.y - dotR}
            width={sq * 2} height={sq * 2}
          >
            <rect width={sq * 2} height={sq * 2} fill="#fff" />
            <rect width={sq} height={sq} fill="#111" />
            <rect x={sq} y={sq} width={sq} height={sq} fill="#111" />
          </pattern>
        </defs>
        {/* contorno escuro por baixo — destaca a rota sobre as ruas, como no Strava */}
        {segments.map((pts, i) => (
          <polyline
            key={`c${i}`}
            points={pts}
            fill="none"
            stroke={ROUTE_CASING}
            strokeWidth={6.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {segments.map((pts, i) => (
          <polyline
            key={`r${i}`}
            points={pts}
            fill="none"
            stroke={ROUTE_COLOR}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {/* largada (verde) e chegada (quadriculada) */}
        <circle cx={start.x} cy={start.y} r={dotR} fill={START_COLOR} stroke="#fff" strokeWidth={2} />
        <circle cx={end.x} cy={end.y} r={dotR} fill={`url(#${checkerId})`} stroke="#fff" strokeWidth={2} />
      </svg>

      {/* Atribuição obrigatória dos tiles */}
      <span style={{
        position: "absolute", right: 6, bottom: 4,
        fontSize: 8.5, color: "rgba(255,255,255,0.45)",
        textShadow: "0 1px 2px rgba(0,0,0,0.8)", pointerEvents: "none",
      }}>
        {ATTRIBUTION}
      </span>
    </div>
  );
}

// ── Renderização em imagem (compartilhar/postar) ────────────────────────────

export interface RouteMapImageStats {
  distanceKm: number;
  elapsedMs: number;
  paceSecPerKm: number | null;
  /** rótulos localizados das colunas (Distância/Tempo/Ritmo) */
  labels: { distance: string; time: string; pace: string };
  /** valores já formatados (formatRunTime/formatRunPace de run-tracker) */
  timeText: string;
  paceText: string;
}

function loadTile(z: number, x: number, y: number): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    // CORS anônimo: sem isso o canvas fica "tainted" e o toBlob falha. Se o
    // tile não vier com os headers, onerror dispara e o tile é pulado.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = tileUrl(z, x, y);
  });
}

/**
 * Desenha o mapa do trajeto num canvas quadrado e devolve um Blob JPEG pronto
 * para upload (slide compartilhável do resumo do treino). Retorna null quando
 * não há pontos suficientes. Se os tiles falharem (offline/CORS), desenha só
 * a rota sobre o fundo escuro — a imagem continua válida.
 */
export async function renderRouteMapImage(
  path: RunPoint[][],
  stats: RouteMapImageStats,
  size = 1080,
): Promise<Blob | null> {
  const points = path.flat();
  if (points.length < 2) return null;

  // Reserva o rodapé de stats fora da área útil do trajeto
  const statsBarH = Math.round(size * 0.16);
  const layout = computeRouteLayout(points, size, size - statsBarH, Math.round(size * 0.1), false);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const draw = (tiles: Array<{ img: HTMLImageElement; left: number; top: number }>) => {
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = MAP_BG;
    ctx.fillRect(0, 0, size, size);
    for (const t of tiles) {
      // mesmo arredondamento do DOM: sem frestas entre tiles vizinhos
      const left = Math.round(t.left);
      const top = Math.round(t.top);
      ctx.drawImage(
        t.img, left, top,
        Math.round(t.left + layout.tileSize) - left,
        Math.round(t.top + layout.tileSize) - top,
      );
    }
    ctx.fillStyle = MAP_SHADE;
    ctx.fillRect(0, 0, size, size);

    // Rota: contorno escuro por baixo + linha laranja por cima (estilo Strava)
    const lineW = Math.max(6, size / 110);
    const tracePath = () => {
      for (const seg of path) {
        if (seg.length < 2) continue;
        ctx.beginPath();
        seg.forEach((p, i) => {
          const { x, y } = layout.toLocal(p);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
    };
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = ROUTE_CASING;
    ctx.lineWidth = lineW * 1.85;
    tracePath();
    ctx.strokeStyle = ROUTE_COLOR;
    ctx.lineWidth = lineW;
    tracePath();
    ctx.restore();

    // Largada (verde) e chegada (quadriculada)
    const dotR = Math.max(8, size / 90);
    const start = layout.toLocal(points[0]);
    const end = layout.toLocal(points[points.length - 1]);
    ctx.beginPath();
    ctx.arc(start.x, start.y, dotR, 0, Math.PI * 2);
    ctx.fillStyle = START_COLOR;
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(end.x, end.y, dotR, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#fff";
    ctx.fillRect(end.x - dotR, end.y - dotR, dotR * 2, dotR * 2);
    ctx.fillStyle = "#111";
    const sq = dotR / 2;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if ((r + c) % 2 === 0) ctx.fillRect(end.x - dotR + c * sq, end.y - dotR + r * sq, sq, sq);
      }
    }
    ctx.restore();

    for (const pt of [start, end]) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, dotR, 0, Math.PI * 2);
      ctx.lineWidth = dotR * 0.45;
      ctx.strokeStyle = "#fff";
      ctx.stroke();
    }

    // Rodapé de stats sobre gradiente escuro (estilo card de compartilhamento)
    const gradTop = size - statsBarH * 1.6;
    const grad = ctx.createLinearGradient(0, gradTop, 0, size);
    grad.addColorStop(0, "rgba(10,9,16,0)");
    grad.addColorStop(0.45, "rgba(10,9,16,0.72)");
    grad.addColorStop(1, "rgba(10,9,16,0.92)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, gradTop, size, size - gradTop);

    const font = "'Inter', system-ui, sans-serif";
    const cols = [
      { label: stats.labels.distance, value: `${stats.distanceKm.toFixed(2)} km` },
      { label: stats.labels.time, value: stats.timeText },
      { label: stats.labels.pace, value: `${stats.paceText} /km` },
    ];
    const colW = size / 3;
    const labelY = size - statsBarH * 0.62;
    const valueY = size - statsBarH * 0.22;
    ctx.textAlign = "center";
    for (let i = 0; i < cols.length; i++) {
      const cx = colW * i + colW / 2;
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = `700 ${Math.round(size * 0.02)}px ${font}`;
      ctx.fillText(cols[i].label.toUpperCase(), cx, labelY);
      ctx.fillStyle = "#fff";
      ctx.font = `800 ${Math.round(size * 0.042)}px ${font}`;
      ctx.fillText(cols[i].value, cx, valueY);
    }

    // Atribuição obrigatória dos tiles
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `500 ${Math.round(size * 0.016)}px ${font}`;
    ctx.fillText(ATTRIBUTION, size - 12, size - 10);
  };

  const toBlob = (): Promise<Blob | null> =>
    new Promise((resolve) => {
      try {
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.88);
      } catch {
        // Canvas "tainted" (tile sem CORS escapou) — o chamador redesenha sem tiles
        resolve(null);
      }
    });

  const loaded = await Promise.all(
    layout.tiles.map(async (t) => ({ ...t, img: await loadTile(layout.tileZoom, t.x, t.y) })),
  );
  const okTiles = loaded.filter((t): t is typeof t & { img: HTMLImageElement } => t.img !== null);

  await document.fonts.ready.catch(() => {});
  draw(okTiles);
  let blob = await toBlob();
  if (!blob) {
    draw([]);
    blob = await toBlob();
  }
  return blob;
}
