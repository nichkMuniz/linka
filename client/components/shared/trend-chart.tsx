import * as React from "react";

export type TrendPoint = { label: string; value: number };

interface TrendChartProps {
  points: TrendPoint[];
  /** cor de acento (linha + pontos + área) */
  color?: string;
  /** altura em px do gráfico */
  height?: number;
  /** desenha a área preenchida sob a linha */
  showArea?: boolean;
  className?: string;
}

/**
 * Gráfico de linha (tendência) leve, 100% SVG inline — sem dependência de lib de
 * charts. A largura é medida via ResizeObserver e o desenho é feito em pixels
 * reais (não usa scaling de viewBox), então pontos e traços nunca distorcem.
 * Reutilizado no tracking de peso corporal e na progressão de carga por exercício.
 */
export function TrendChart({
  points,
  color = "#5b8cff",
  height = 140,
  showArea = true,
  className,
}: TrendChartProps) {
  const gradId = React.useId();
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [w, setW] = React.useState(0);

  React.useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const values = points.map((p) => p.value);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const range = max - min || 1;

  const padX = 8;
  const padTop = 12;
  const padBottom = 12;
  const innerW = Math.max(0, w - padX * 2);
  const innerH = Math.max(0, height - padTop - padBottom);

  const xFor = (i: number) =>
    points.length <= 1 ? w / 2 : padX + (i / (points.length - 1)) * innerW;
  const yFor = (v: number) => padTop + (1 - (v - min) / range) * innerH;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(p.value).toFixed(1)}`)
    .join(" ");
  const areaPath =
    points.length > 1
      ? `${linePath} L ${xFor(points.length - 1).toFixed(1)} ${(padTop + innerH).toFixed(1)} L ${xFor(0).toFixed(1)} ${(padTop + innerH).toFixed(1)} Z`
      : "";

  return (
    <div ref={wrapRef} className={className} style={{ width: "100%", height }}>
      {w > 0 && points.length > 0 && (
        <svg width={w} height={height} style={{ display: "block", overflow: "visible" }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {showArea && points.length > 1 && <path d={areaPath} fill={`url(#${gradId})`} />}
          {points.length > 1 && (
            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={xFor(i)}
              cy={yFor(p.value)}
              r={i === points.length - 1 ? 3.5 : points.length > 24 ? 0 : 2}
              fill={color}
            />
          ))}
        </svg>
      )}
    </div>
  );
}
