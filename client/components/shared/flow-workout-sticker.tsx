import * as React from "react";
import { Dumbbell, Flame, Timer, Trophy } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import type { StoryTextElement, StoryWorkoutSticker } from "@/lib/ritmofit-db";

/**
 * Mini frame do treino citado no flow (estilo "repost" do Instagram).
 *
 * O card é desenhado numa largura FIXA em px e escalado por `transform: scale()`
 * — assim o autor o vê exatamente do mesmo tamanho que quem assiste, em
 * qualquer aparelho, e a posição salva em % continua válida.
 *
 * Sem `backdrop-filter` de propósito: o sticker fica por cima de vídeo em
 * reprodução e o WKWebView reavaliaria o blur a cada frame
 * (ver docs/15-design-system.md §0.3). O fundo é quase opaco no lugar disso.
 */
export const WORKOUT_STICKER_WIDTH = 232;
/** Quantos exercícios cabem no card antes de virar "+N exercícios". */
export const MAX_STICKER_EXERCISES = 8;
/** Limites de pinça do sticker. */
export const MIN_STICKER_SCALE = 0.6;
export const MAX_STICKER_SCALE = 1.8;

export function formatStickerVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1).replace(".", ",")} t`;
  return `${Math.round(kg)} kg`;
}

export function formatStickerDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m} min`;
  return `${Math.max(secs, 0)}s`;
}

/**
 * "Hoje" / "Ontem" / dd/mm. `date` é ISO com `Z` (gravado por `toISOString()`
 * ao finalizar o treino), então a comparação é feita em dia LOCAL.
 */
export function formatStickerDate(iso: string, todayLabel: string, yesterdayLabel: string): string {
  const d = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return "";
  const dayKey = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000);
  if (dayKey(d) === dayKey(now)) return todayLabel;
  if (dayKey(d) === dayKey(yesterday)) return yesterdayLabel;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface FlowWorkoutStickerProps {
  data: StoryWorkoutSticker;
  /** 1 = tamanho base (WORKOUT_STICKER_WIDTH) */
  scale?: number;
  /** origem do `scale` — o autor arrasta pelo centro, o viewer também centraliza */
  className?: string;
}

export function FlowWorkoutSticker({ data, scale = 1, className }: FlowWorkoutStickerProps) {
  const { t } = useLanguage();

  const exercises = Array.isArray(data.exercises) ? data.exercises : [];
  const extra = Number(data.extraCount ?? 0);
  const dateLabel = formatStickerDate(
    data.date,
    t("flow_workout_today"),
    t("flow_workout_yesterday"),
  );

  return (
    <div
      className={className}
      style={{
        width: WORKOUT_STICKER_WIDTH,
        transform: `scale(${scale})`,
        transformOrigin: "center",
        borderRadius: 20,
        padding: "12px 13px",
        background: "linear-gradient(rgba(32,30,44,.95),rgba(13,12,19,.97))",
        border: "1px solid rgba(255,255,255,.16)",
        boxShadow: "0 10px 30px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.12)",
        color: "#fff",
      }}
    >
      {/* Cabeçalho — ícone da marca + rotina + dia */}
      <div className="flex items-center gap-2">
        <div
          className="shrink-0 flex items-center justify-center"
          style={{
            height: 28,
            width: 28,
            borderRadius: 10,
            background: "linear-gradient(135deg,#5b8cff,#9d6bff)",
          }}
        >
          <Dumbbell className="h-4 w-4" style={{ color: "#fff" }} />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="truncate"
            style={{ fontSize: 8.5, letterSpacing: ".09em", fontWeight: 700, color: "rgba(255,255,255,.55)" }}
          >
            {t("flow_workout_sticker_label").toUpperCase()}
          </p>
          <p className="truncate" style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.25 }}>
            {data.name}
          </p>
        </div>
        {dateLabel && (
          <span
            className="shrink-0"
            style={{ fontSize: 9.5, fontWeight: 600, color: "rgba(255,255,255,.55)" }}
          >
            {dateLabel}
          </span>
        )}
      </div>

      {/* Números da sessão */}
      <div className="flex items-center gap-1.5 flex-wrap" style={{ marginTop: 9 }}>
        <StickerChip>{`${data.totalSeries} ${t("flow_workout_series")}`}</StickerChip>
        {data.totalVolume > 0 && <StickerChip>{formatStickerVolume(data.totalVolume)}</StickerChip>}
        {data.durationSecs > 0 && (
          <StickerChip icon={<Timer className="h-2.5 w-2.5" />}>
            {formatStickerDuration(data.durationSecs)}
          </StickerChip>
        )}
        {Number(data.caloriesKcal ?? 0) > 0 && (
          <StickerChip icon={<Flame className="h-2.5 w-2.5" />}>
            {`${Math.round(Number(data.caloriesKcal))} kcal`}
          </StickerChip>
        )}
        {Number(data.prCount ?? 0) > 0 && (
          <StickerChip icon={<Trophy className="h-2.5 w-2.5" />} accent>
            {`${data.prCount} ${t("flow_workout_prs")}`}
          </StickerChip>
        )}
      </div>

      {/* Exercícios feitos */}
      {exercises.length > 0 && (
        <div
          style={{
            marginTop: 9,
            paddingTop: 8,
            borderTop: "1px solid rgba(255,255,255,.1)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {exercises.map((ex, i) => (
            <div key={`${ex.name}-${i}`} className="flex items-center gap-2">
              <span
                className="truncate flex-1"
                style={{ fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,.9)" }}
              >
                {ex.name}
              </span>
              <span
                className="shrink-0"
                style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,.6)" }}
              >
                {ex.isCardio
                  ? `${ex.kg} min`
                  : ex.kg > 0
                    ? `${ex.sets}× ${ex.kg}kg`
                    : `${ex.sets}×`}
              </span>
            </div>
          ))}
          {extra > 0 && (
            <span style={{ fontSize: 9.5, fontWeight: 600, color: "rgba(255,255,255,.45)" }}>
              {t("flow_workout_more_exercises").replace("{n}", String(extra))}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function StickerChip({
  children,
  icon,
  accent,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <span
      className="flex items-center gap-1"
      style={{
        fontSize: 9.5,
        fontWeight: 700,
        padding: "2.5px 7px",
        borderRadius: 999,
        background: accent ? "rgba(255,196,60,.16)" : "rgba(255,255,255,.09)",
        border: `1px solid ${accent ? "rgba(255,196,60,.3)" : "rgba(255,255,255,.12)"}`,
        color: accent ? "#ffc43c" : "rgba(255,255,255,.85)",
      }}
    >
      {icon}
      {children}
    </span>
  );
}

/**
 * Um elemento sobreposto ao flow, já posicionado (x/y em %). Frase ou mini
 * frame de treino — fonte única usada pelo `FlowViewer` e pelo
 * `FlowViewerModal`, para os dois renderizarem exatamente o mesmo resultado.
 */
export function FlowElementView({ el }: { el: StoryTextElement }) {
  const isWorkout = el.kind === "workout" && !!el.workout;
  const hasBg = !isWorkout && !!el.style?.backgroundColor;

  return (
    <div
      className="absolute"
      style={{
        left: `${el.x}%`,
        top: `${el.y}%`,
        transform: "translate(-50%, -50%)",
        width: "max-content",
        maxWidth: isWorkout ? "92vw" : "80vw",
        padding: isWorkout ? 0 : "0 0.5rem",
      }}
    >
      {isWorkout ? (
        <FlowWorkoutSticker data={el.workout as StoryWorkoutSticker} scale={el.scale ?? 1} />
      ) : (
        <p
          className="leading-relaxed break-words whitespace-pre-wrap"
          style={{
            textShadow: hasBg ? "none" : "0 1px 6px rgba(0,0,0,0.5)",
            fontFamily: el.style?.fontFamily ?? "system-ui, sans-serif",
            fontWeight: el.style?.fontWeight ?? 800,
            fontSize: el.style?.fontSize ?? 30,
            textAlign: el.style?.align ?? "center",
            color: el.style?.color ?? "#ffffff",
          }}
        >
          {hasBg ? (
            <span
              style={{
                background: el.style?.backgroundColor as string,
                boxDecorationBreak: "clone",
                WebkitBoxDecorationBreak: "clone",
                padding: "0.08em 0.26em",
                borderRadius: "0.28em",
              }}
            >
              {el.text}
            </span>
          ) : (
            el.text
          )}
        </p>
      )}
    </div>
  );
}
