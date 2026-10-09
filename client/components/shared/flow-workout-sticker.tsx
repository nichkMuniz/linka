import * as React from "react";
import { VerifiedBadge } from "@/components/shared/VerifiedBadge";
import { Dumbbell, Flame, ImageOff, Timer, Trophy } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { UserAvatar } from "@/components/shared/user-avatar";
import { formatCardioKm } from "@/lib/cardio-exercises";
import { formatRunPace, formatRunTime, type RunSplit } from "@/lib/run-tracker";
import type {
  StoryPostSticker,
  StoryTextElement,
  StoryWorkoutSticker,
  WorkoutRunStats,
  WorkoutStickerField,
} from "@/lib/ritmofit-db";

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

/** Ordem em que os blocos aparecem no card (e nos toggles de personalização). */
export const WORKOUT_STICKER_FIELDS: WorkoutStickerField[] = [
  "date",
  "series",
  "volume",
  "duration",
  "calories",
  "prs",
  "splits",
  "exercises",
];

/** O bloco aparece no card? (`hidden` ausente = flow antigo, mostra tudo.) */
export function isStickerFieldShown(data: StoryWorkoutSticker, field: WorkoutStickerField): boolean {
  return !data.hidden?.includes(field);
}

/**
 * Snapshot que vai para o flow: o COMPLETO + a lista do que o autor ocultou.
 * Desde 2026-10-08 os valores ocultos são publicados — o "Ver treino" do flow
 * mostra sempre o treino inteiro; ocultar só muda o que o card desenha
 * (`stickerCardView`). O composer guarda o completo à parte, para o autor
 * poder reexibir um bloco antes de publicar.
 */
export function applyStickerFields(
  full: StoryWorkoutSticker,
  hidden: WorkoutStickerField[],
): StoryWorkoutSticker {
  const off = new Set(hidden);
  return {
    ...full,
    hidden: hidden.length > 0 ? WORKOUT_STICKER_FIELDS.filter((f) => off.has(f)) : undefined,
  };
}

/**
 * O que o CARD desenha: zera os blocos ocultos (o card e o rascunho em canvas
 * escondem número 0 / lista vazia). Só para desenhar — o detalhe ("Ver treino")
 * lê o snapshot inteiro.
 */
export function stickerCardView(data: StoryWorkoutSticker): StoryWorkoutSticker {
  if (!data.hidden?.length) return data;
  const off = new Set(data.hidden);
  return {
    ...data,
    totalVolume: off.has("volume") ? 0 : data.totalVolume,
    durationSecs: off.has("duration") ? 0 : data.durationSecs,
    caloriesKcal: off.has("calories") ? undefined : data.caloriesKcal,
    prCount: off.has("prs") ? undefined : data.prCount,
    // Parciais ocultas: distância/tempo/ritmo da corrida continuam no card.
    run: off.has("splits") && data.run ? { ...data.run, splits: undefined } : data.run,
    exercises: off.has("exercises") ? [] : data.exercises,
    extraCount: off.has("exercises") ? undefined : data.extraCount,
  };
}

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
 * Valor à direita de cada exercício do frame: cardio = tempo ("39 min",
 * "1h 10m"); musculação = "3× 80kg". Fonte única para o frame (React), o
 * rascunho desenhado em canvas e o drawer "Ver treino" do flow.
 *
 * Cardio com 0 minutos só existe em flows postados antes da correção de
 * 2026-09-30 (o frame levava o bestKg, sempre 0 no cardio): mostra as séries
 * em vez de um "0 min" falso.
 */
export function formatStickerExercise(ex: StoryWorkoutSticker["exercises"][number]): string {
  if (ex.isCardio) {
    // Distância primeiro (corrida/caminhada GPS, esteira...) — "5,23 km · 28 min".
    const parts = [
      Number(ex.km ?? 0) > 0 ? `${formatCardioKm(Number(ex.km))} km` : null,
      ex.kg > 0 ? formatStickerDuration(ex.kg * 60) : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : `${ex.sets}×`;
  }
  return ex.kg > 0 ? `${ex.sets}× ${ex.kg}kg` : `${ex.sets}×`;
}

// ── Bloco da corrida GPS no card ─────────────────────────────────────────────
// Distância · tempo · ritmo + até STICKER_SPLITS_MAX parciais por km (barra
// proporcional à velocidade, como o RunSplitsList). Alturas em px de CSS — o
// rascunho em canvas (flow-creation-dialog) usa as MESMAS constantes.

/** cor da corrida no card — a mesma da rota no mapa (route-map.tsx) */
export const STICKER_RUN_ACCENT = "#fc5200";
export const STICKER_RUN_BAR = "rgba(252,82,0,.45)";
/** acima disso o card mostra STICKER_SPLITS_MAX - 1 linhas + "+N km" */
export const STICKER_SPLITS_MAX = 6;
export const STICKER_RUN_STATS_H = 28; // rótulo 10 + 2 + valor 16
export const STICKER_SPLIT_ROW_H = 12;
export const STICKER_SPLIT_GAP = 3;
export const STICKER_SPLITS_TOP = 7;
export const STICKER_SPLIT_LABEL_W = 22;
export const STICKER_SPLIT_PACE_W = 34;
/** menor fração da barra, para o km mais lento ainda aparecer */
const STICKER_SPLIT_MIN_BAR = 0.28;

/** "0,45" — distância do trecho parcial final */
function formatSplitKm(km: number): string {
  return km.toFixed(2).replace(/0+$/, "").replace(/[.,]$/, "").replace(".", ",");
}

/** Linhas de parciais que o card desenha (React e canvas leem daqui). */
export function stickerSplitRows(run: WorkoutRunStats | undefined): {
  rows: Array<{ label: string; pace: string; ratio: number; fastest: boolean }>;
  extra: number;
} {
  const splits: RunSplit[] = run?.splits ?? [];
  if (splits.length === 0) return { rows: [], extra: 0 };
  const shown = splits.length > STICKER_SPLITS_MAX ? splits.slice(0, STICKER_SPLITS_MAX - 1) : splits;
  const paces = splits.map((sp) => sp.paceSecPerKm).filter((v) => v > 0);
  const fastestPace = paces.length > 0 ? Math.min(...paces) : 0;
  // "mais rápido" só entre km fechados (igual ao RunSplitsList)
  const full = splits.filter((sp) => !sp.partial);
  const fastestIndex =
    full.length > 1 ? full.reduce((b, sp) => (sp.paceSecPerKm < b.paceSecPerKm ? sp : b)).index : null;
  return {
    rows: shown.map((sp) => ({
      label: sp.partial ? formatSplitKm(sp.distanceKm) : String(sp.index),
      pace: formatRunPace(sp.paceSecPerKm),
      ratio:
        fastestPace > 0 && sp.paceSecPerKm > 0
          ? Math.max(STICKER_SPLIT_MIN_BAR, Math.min(1, fastestPace / sp.paceSecPerKm))
          : STICKER_SPLIT_MIN_BAR,
      fastest: sp.index === fastestIndex,
    })),
    extra: splits.length - shown.length,
  };
}

/** Distância / tempo / ritmo da corrida, já formatados. */
export function stickerRunStats(run: WorkoutRunStats): { distance: string; time: string; pace: string } {
  return {
    distance: `${formatCardioKm(run.distanceKm)} km`,
    time: formatRunTime(run.elapsedMs),
    pace: run.paceSecPerKm ? `${formatRunPace(run.paceSecPerKm)} /km` : "—",
  };
}

/** Altura do bloco da corrida (sem a margem/divisor de cima). */
export function stickerRunBlockHeight(run: WorkoutRunStats | undefined): number {
  if (!run) return 0;
  const { rows, extra } = stickerSplitRows(run);
  let h = STICKER_RUN_STATS_H;
  if (rows.length > 0) {
    h += STICKER_SPLITS_TOP + rows.length * STICKER_SPLIT_ROW_H + (rows.length - 1) * STICKER_SPLIT_GAP;
    if (extra > 0) h += STICKER_SPLIT_GAP + STICKER_SPLIT_ROW_H;
  }
  return h;
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
  /** No viewer o sticker abre o detalhe do treino — mostra a dica de toque. */
  interactive?: boolean;
  /** origem do `scale` — o autor arrasta pelo centro, o viewer também centraliza */
  className?: string;
}

export function FlowWorkoutSticker({ data: raw, scale = 1, className, interactive = false }: FlowWorkoutStickerProps) {
  const { t } = useLanguage();
  const data = stickerCardView(raw);

  const exercises = isStickerFieldShown(data, "exercises") && Array.isArray(data.exercises) ? data.exercises : [];
  const extra = isStickerFieldShown(data, "exercises") ? Number(data.extraCount ?? 0) : 0;
  const dateLabel = isStickerFieldShown(data, "date")
    ? formatStickerDate(data.date, t("flow_workout_today"), t("flow_workout_yesterday"))
    : "";
  const showSeries = isStickerFieldShown(data, "series");
  const hasChips =
    showSeries ||
    data.totalVolume > 0 ||
    data.durationSecs > 0 ||
    Number(data.caloriesKcal ?? 0) > 0 ||
    Number(data.prCount ?? 0) > 0;

  return (
    <div
      // Alvo de toque no viewer: as zonas de navegação ficam por cima, então elas
      // testam o retângulo DESTE elemento (já com scale/moldura de repost).
      data-flow-workout-sticker=""
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
      {hasChips && (
      <div className="flex items-center gap-1.5 flex-wrap" style={{ marginTop: 9 }}>
        {showSeries && <StickerChip>{`${data.totalSeries} ${t("flow_workout_series")}`}</StickerChip>}
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
      )}

      {/* Corrida/caminhada GPS — distância, tempo, ritmo e parciais por km */}
      {data.run && <StickerRunBlock run={data.run} />}

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
                {formatStickerExercise(ex)}
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

      {interactive && (
        <p
          className="text-center"
          style={{ marginTop: 8, fontSize: 9.5, fontWeight: 700, color: "#9db8ff" }}
        >
          {t("flow_workout_tap_hint")}
        </p>
      )}
    </div>
  );
}

function StickerRunBlock({ run }: { run: WorkoutRunStats }) {
  const { t } = useLanguage();
  const stats = stickerRunStats(run);
  const { rows, extra } = stickerSplitRows(run);
  const cols = [
    { label: t("goals_run_distance"), value: stats.distance },
    { label: t("goals_run_time"), value: stats.time },
    { label: t("goals_run_pace"), value: stats.pace },
  ];
  return (
    <div style={{ marginTop: 9, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,.1)" }}>
      <div className="flex" style={{ height: STICKER_RUN_STATS_H }}>
        {cols.map((c) => (
          <div key={c.label} className="min-w-0 flex-1">
            <p
              className="truncate"
              style={{ fontSize: 8, lineHeight: "10px", fontWeight: 700, letterSpacing: ".06em", color: "rgba(255,255,255,.5)" }}
            >
              {c.label.toUpperCase()}
            </p>
            <p
              className="truncate"
              style={{ marginTop: 2, fontSize: 13, lineHeight: "16px", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}
            >
              {c.value}
            </p>
          </div>
        ))}
      </div>

      {rows.length > 0 && (
        <div style={{ marginTop: STICKER_SPLITS_TOP, display: "flex", flexDirection: "column", gap: STICKER_SPLIT_GAP }}>
          {rows.map((r, i) => (
            <div key={i} className="flex items-center" style={{ height: STICKER_SPLIT_ROW_H, gap: 6 }}>
              <span
                className="shrink-0"
                style={{
                  width: STICKER_SPLIT_LABEL_W, fontSize: 9.5, lineHeight: "12px", fontWeight: 800,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {r.label}
              </span>
              <span className="flex-1" style={{ position: "relative", height: 4 }}>
                <span
                  style={{
                    position: "absolute", left: 0, top: 0, height: 4, borderRadius: 2,
                    width: `${r.ratio * 100}%`,
                    background: r.fastest ? STICKER_RUN_ACCENT : STICKER_RUN_BAR,
                  }}
                />
              </span>
              <span
                className="shrink-0 text-right"
                style={{
                  width: STICKER_SPLIT_PACE_W, fontSize: 10, lineHeight: "12px", fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  color: r.fastest ? STICKER_RUN_ACCENT : "rgba(255,255,255,.75)",
                }}
              >
                {r.pace}
              </span>
            </div>
          ))}
          {extra > 0 && (
            <span style={{ fontSize: 9.5, lineHeight: "12px", fontWeight: 600, color: "rgba(255,255,255,.45)" }}>
              {`+${extra} km`}
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
 * Moldura de um post do feed compartilhado no flow — mesma linguagem visual da
 * moldura de repost (card arredondado, borda clara, sombra, chip do autor).
 * A foto é a do post, referenciada (não copiada): se o post sumir, o card cai
 * num aviso de "post indisponível" em vez de quebrar.
 *
 * `data-flow-post-sticker` é o alvo de toque do viewer (as zonas de navegação
 * ficam por cima) — o toque abre `/post/:id`.
 */
export function FlowPostCard({ data, interactive = false }: { data: StoryPostSticker; interactive?: boolean }) {
  const { t } = useLanguage();
  const [broken, setBroken] = React.useState(false);

  return (
    <div
      data-flow-post-sticker=""
      style={{
        width: "min(80vw, 380px)",
        borderRadius: 26,
        overflow: "hidden",
        background: "linear-gradient(rgba(32,30,44,.96),rgba(13,12,19,.98))",
        border: "1px solid rgba(255,255,255,.16)",
        boxShadow: "0 24px 60px -18px rgba(0,0,0,.8)",
        color: "#fff",
      }}
    >
      {/* Autor do post — como no Instagram */}
      <div className="flex items-center gap-2" style={{ padding: "10px 12px" }}>
        <UserAvatar photo={data.authorPhoto ?? null} nickname={data.authorNickname} className="h-7 w-7 shrink-0" />
        <span className="truncate" style={{ fontSize: 13, fontWeight: 700 }}>{data.authorNickname}</span>
        {data.authorVerifiedTier && <VerifiedBadge size="sm" tier={data.authorVerifiedTier} />}
      </div>

      {broken ? (
        <div
          className="flex flex-col items-center justify-center gap-2"
          style={{ aspectRatio: "1 / 1", background: "rgba(255,255,255,.04)" }}
        >
          <ImageOff className="h-6 w-6" style={{ color: "rgba(255,255,255,.4)" }} />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,.5)" }}>{t("flow_post_unavailable")}</span>
        </div>
      ) : (
        <img
          src={data.photo}
          alt=""
          draggable={false}
          onError={() => setBroken(true)}
          className="block w-full select-none pointer-events-none"
          style={{ maxHeight: "56dvh", objectFit: "cover" }}
        />
      )}

      {/* Legenda do post, como no Instagram: autor em negrito + texto, até 3
          linhas (o resto fica no post, a um toque). */}
      {data.caption && (
        <p
          className="break-words"
          style={{
            // Sem a dica de toque embaixo (prévia no criador), fecha o card.
            padding: interactive ? "9px 12px 0" : "9px 12px 11px",
            fontSize: 13,
            lineHeight: 1.4,
            color: "rgba(255,255,255,.88)",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          <span style={{ fontWeight: 700, color: "#fff" }}>{data.authorNickname}</span>{" "}
          {data.caption}
        </p>
      )}

      {interactive && (
        <p className="text-center" style={{ padding: "9px 12px", fontSize: 12, fontWeight: 700, color: "#9db8ff" }}>
          {t("flow_post_tap_hint")}
        </p>
      )}
    </div>
  );
}

/**
 * Um elemento sobreposto ao flow, já posicionado (x/y em %). Frase ou mini
 * frame de treino — usado pelo `FlowViewer` (rota do feed e modo embutido do
 * perfil — é um viewer só).
 */
export function FlowElementView({ el, interactive = false }: { el: StoryTextElement; interactive?: boolean }) {
  const isWorkout = el.kind === "workout" && !!el.workout;
  const isPost = el.kind === "post" && !!el.post;
  const hasBg = !isWorkout && !isPost && !!el.style?.backgroundColor;

  return (
    <div
      className="absolute"
      style={{
        left: `${el.x}%`,
        top: `${el.y}%`,
        // A moldura do post ganhou pinça no criador ("Editar antes de postar");
        // o mini frame de treino aplica a própria escala por dentro.
        transform: isPost && el.scale && el.scale !== 1
          ? `translate(-50%, -50%) scale(${el.scale})`
          : "translate(-50%, -50%)",
        width: "max-content",
        maxWidth: isWorkout || isPost ? "92vw" : "80vw",
        padding: isWorkout || isPost ? 0 : "0 0.5rem",
        // Moldura do post fica sempre embaixo de frases e do treino, mesmo nos
        // flows já publicados (que gravaram o post por último no array).
        zIndex: isPost ? 1 : 2,
      }}
    >
      {isPost ? (
        <FlowPostCard data={el.post as StoryPostSticker} interactive={interactive} />
      ) : isWorkout ? (
        <FlowWorkoutSticker data={el.workout as StoryWorkoutSticker} scale={el.scale ?? 1} interactive={interactive} />
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
