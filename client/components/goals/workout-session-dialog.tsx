import * as React from "react";
import { createPortal } from "react-dom";
import { useWorkout } from "@/lib/workout-context";
import { useLanguage } from "@/lib/language-context";
import type { TranslationKey } from "@/lib/i18n";
import {
  subscribeRun, getRunState, startRun, pauseRun, resumeRun, stopRun,
  openLocationSettings, formatRunTime, formatRunPace,
  type RunState, type RunPoint, type StartRunLabels,
} from "@/lib/run-tracker";
import { RouteMap } from "@/components/shared/route-map";
import { ExerciseImage } from "@/components/shared/exercise-image";
import { ExerciseAnatomy } from "@/components/shared/exercise-anatomy";
import { TechniqueInfoOverlay } from "@/components/goals/technique-info-overlay";
import { getNetworkStatus } from "@/lib/network-status";
import { subscribeKeyboardHeight, getKeyboardHeight } from "@/lib/keyboard";
import { useKeyboardInputScroll } from "@/hooks/use-keyboard-input-scroll";
import { isCardioExercise } from "@/lib/cardio-exercises";
import { beatsE1rm, estimateOneRepMax, roundE1rm } from "@/lib/one-rep-max";
import { toast } from "@/components/ui/use-toast";
import {
  saveWorkoutHistoryDb,
  getPreviousBestKgDb,
  getWorkoutsDb,
  getWorkoutGroupsDb,
  updateUserWorkoutExerciseDb,
  getLastWorkoutSessionSeriesDb,
  type WorkoutGroup,
  createCustomWorkoutDb,
  createUserWorkoutsDb,
  updateUserWorkoutNotesDb,
  updateUserWorkoutRestDb,
  uploadCustomExercisePhotoDb,
  updateCustomWorkoutDb,
  deleteCustomWorkoutDb,
  matchesCatalogSearch,
  isWorkingSet,
  isBlockTechnique,
  getExercisePersonalRecordsDb,
  type ExercisePersonalRecords,
  type SetKind,
  type TrainingMode,
  type WorkoutTechnique,
  type UserWorkoutWithDetails,
  type Workout,
} from "@/lib/ritmofit-db";

/**
 * Tipos de recorde reconhecidos no modo **expert** (convenção Hevy/Strong):
 *
 * - `weight`: carga máxima — o único que existia antes de 05/08/2026.
 * - `reps`:   mesma carga, mais repetições. O progresso mais comum de todos e o
 *             que o app ignorava por completo (quem faz 60kg × 12 depois de
 *             60kg × 8 evoluiu e não recebia nada).
 * - `e1rm`:   1RM estimado — compara séries de faixas diferentes de repetição.
 *
 * O modo simplificado só emite `weight`, mantendo a tela exatamente como era.
 */
export type PrKind = "weight" | "reps" | "e1rm";

export type WorkoutSessionSummary = {
  totalSeries: number;
  totalVolume: number;
  durationSecs: number;
  completedExercises: Array<{
    name: string;
    totalSets: number;
    bestKg: number;
    muscleGroup: string | null;
    // Foto do exercício (miniatura ao lado do nome no detalhe do feed).
    photo: string | null;
    // Uma entrada por série concluída, em ordem — carga (kg) e repetições de cada
    // série. Alimenta o detalhe "kg × reps" do resumo compartilhado no feed.
    // Para cardio (isCardio), kg = MINUTOS e reps = KM.
    sets: Array<{ kg: number; reps: number }>;
    // Cardio (corrida/bike) → o detalhe deve mostrar min×km, não kg×reps.
    isCardio: boolean;
  }>;
  prExercises: Array<{
    name: string;
    previousBestKg: number;
    newBestKg: number;
    /**
     * Tipo do recorde (modo expert). **Ausente = `"weight"`** — é o que os
     * resumos gravados antes de 05/08/2026 (em `posts` e
     * `routines.last_summary`) representam, e o único tipo que o modo
     * simplificado produz.
     */
    kind?: PrKind;
    /** `kind = "reps"`: repetições na MESMA carga (`newBestKg`). */
    previousReps?: number;
    newReps?: number;
    /** `kind = "e1rm"`: 1RM estimado, já arredondado para exibição. */
    previousE1rm?: number;
    newE1rm?: number;
  }>;
  // PR where bestKg >= 100 — "zerando a máquina"
  machinedExercises: Array<{ name: string; kg: number }>;
  // Corrida GPS concluída nesta sessão (Corrida ao Ar Livre) — alimenta o
  // slide de mapa compartilhável no resumo do treino. null quando não correu.
  run: {
    distanceKm: number;
    elapsedMs: number;
    paceSecPerKm: number | null;
    path: RunPoint[][];
  } | null;
};

interface WorkoutSessionDialogProps {
  open: boolean;
  userId: string;
  routineLabel: string;
  items: UserWorkoutWithDetails[];
  /**
   * Modo da rotina (`routines.training_mode` via `RoutineCard.trainingMode`).
   * `simple` = tela clássica; `expert` = série tipada + métricas sem
   * aquecimento. Ausente = `simple`, para qualquer caller que ainda não passe.
   */
  trainingMode?: TrainingMode;
  /** id da rotina (card.routineId) — autoritativo para vincular exercícios criados */
  routineId?: string | null;
  /** nome da rotina (card.name) — usado como `user_workouts.name` para agrupar no card certo */
  routineName?: string | null;
  onMinimize: () => void;
  onFinished: (summary: WorkoutSessionSummary) => void;
}

const REST_PRESETS = [0, 30, 60, 90, 120];
const SWIPE_REVEAL = 72; // px revelados ao deslizar para a esquerda

// "Máquina zerada" — ao concluir uma série (não-cardio) ACIMA deste peso, o app
// pergunta se o usuário zerou a máquina naquele exercício. Se confirmar, o card
// ganha borda dourada e o exercício entra no machinedExercises do resumo (card
// dourado + variante "machine"). É uma conquista confirmada pelo usuário, não
// automática.
const MACHINE_MAXED_KG = 120;

// ── Tokens — design "liquid glass" (vidro escuro translúcido) ──────────────
// Mesma linguagem visual dos drawers glass (ver client/lib/glass-styles.ts):
// shell escuro com auras borradas, painéis translúcidos brancos e blur.
const PRIMARY    = "#5b8cff";                  // azul glass (acento)
const PRIMARY_FG = "#fff";
const ORANGE     = "hsl(var(--brand-2))";      // laranja de destaque (pausar/finalizar/PR)
const FG         = "#fff";
const MUTED_FG   = "rgba(255,255,255,0.55)";
const BORDER     = "rgba(255,255,255,0.12)";
const CARD       = "rgba(255,255,255,0.06)";   // painel de vidro
const SURFACE    = "rgba(255,255,255,0.10)";   // campo / realce translúcido
// Shell escuro do overlay + barras flutuantes (recebem blur quando aplicável)
const GLASS_ROOT_BG  = "linear-gradient(165deg,#1b1828 0%,#100e18 55%,#0a0910 100%)";
const GLASS_BAR_BG   = "rgba(14,13,20,0.72)";
const GLASS_GRADIENT = "linear-gradient(135deg,#5b8cff,#9d6bff)";
const GLASS_BLUR     = "blur(24px) saturate(180%)";

function fmtDur(totalSecs: number): string {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

function fmtRest(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

// ── Tipos de série (modo expert) ────────────────────────────────────────────
// A série deixa de ser um número anônimo e passa a declarar o que é. Isso é o
// que permite dar descanso curto ao aquecimento e mantê-lo fora do PR e da
// progressão (ele conta no volume e na contagem como qualquer série) — no modo
// simplificado nada disso existe e toda série é tratada como 'normal'.

/** Descanso após uma série de aquecimento: a rampa não pede pausa cheia. */
const WARMUP_REST_SECS = 30;

/**
 * Teto de descanso do rest-pause. A técnica É a micro-pausa: 15s é o que separa
 * um rest-pause de duas séries normais, então o preset do exercício é limitado
 * aqui em vez de depender de o usuário lembrar de baixar o cronômetro.
 */
const REST_PAUSE_MAX_SECS = 15;

/** Presets de descanso oferecidos num exercício de rest-pause (todos ≤ teto). */
const REST_PAUSE_PRESETS = [0, 10, 15];

/**
 * Rampa de aquecimento sugerida, em % da carga de trabalho. É a progressão
 * clássica de preparação para uma série pesada: sobe a carga e desce as
 * repetições, chegando na série válida com o movimento pronto e sem fadiga.
 *
 * Não é prescrição — o usuário edita ou apaga qualquer linha. O valor de ter
 * isso num botão é não precisar fazer a conta de cabeça na academia.
 */
const WARMUP_RAMP: Array<{ pct: number; reps: number }> = [
  { pct: 0.5, reps: 8 },
  { pct: 0.7, reps: 5 },
  { pct: 0.85, reps: 3 },
];

/** Menor incremento real de uma barra: um par de anilhas de 1,25kg. */
const PLATE_STEP = 2.5;

/**
 * Monta as séries de aquecimento para uma carga de trabalho. Descarta degraus
 * que arredondam para o mesmo peso (carga leve faz 50% e 70% colidirem — duas
 * séries idênticas de aquecimento não aquecem nada) e os que zeram.
 */
function buildWarmupSets(targetKg: number): Array<{ kg: number; reps: number }> {
  const out: Array<{ kg: number; reps: number }> = [];
  for (const step of WARMUP_RAMP) {
    const kg = Math.round((targetKg * step.pct) / PLATE_STEP) * PLATE_STEP;
    if (kg <= 0) continue;
    if (kg >= targetKg) continue;             // já é a carga de trabalho
    if (out.some((s) => s.kg === kg)) continue;
    out.push({ kg, reps: step.reps });
  }
  return out;
}

// `drop` fica FORA do seletor manual: uma série de drop nasce do botão "+ drop"
// da série anterior (é a continuação dela), não de alguém marcar uma linha
// solta como drop.
const SET_KIND_ORDER: SetKind[] = ["warmup", "normal", "failure"];

const SET_KIND_LABEL_KEYS: Record<SetKind, TranslationKey> = {
  warmup: "goals_set_kind_warmup",
  normal: "goals_set_kind_normal",
  failure: "goals_set_kind_failure",
  drop: "goals_set_kind_drop",
};

// Cor do selo da coluna "#" por tipo de série. `label` só é usado pelo DROP,
// que não numera (é a continuação da série de cima) — as demais, aquecimento
// incluído, mantêm o número da contagem e se distinguem pela cor.
const SET_KIND_STYLE: Record<SetKind, { label: string; fg: string; bg: string; border: string }> = {
  warmup: { label: "A", fg: "#f0b429", bg: "rgba(240,180,41,0.14)", border: "rgba(240,180,41,0.42)" },
  normal: { label: "", fg: "rgba(255,255,255,.72)", bg: "transparent", border: "transparent" },
  failure: { label: "F", fg: "#ff6b6b", bg: "rgba(255,107,107,0.14)", border: "rgba(255,107,107,0.42)" },
  drop: { label: "D", fg: "#c084fc", bg: "rgba(192,132,252,0.14)", border: "rgba(192,132,252,0.42)" },
};

/** Tipo efetivo de uma série (ausente = 'normal'). */
function setKindOf(row: { kind?: SetKind } | undefined | null): SetKind {
  return row?.kind ?? "normal";
}

/**
 * Séries que entram na CONTAGEM ("3 séries de supino").
 *
 * O **aquecimento conta**: ele foi executado e o peso foi levantado, então
 * aparece no contador e no volume da sessão como qualquer outra série. O que o
 * aquecimento continua não fazendo é valer como MARCA — fica fora do PR, do
 * e1RM, da tendência de carga e do gráfico de progressão (ver `isWorkingSet`),
 * porque uma rampa leve não é desempenho.
 *
 * Só o **drop** fica fora da contagem: ele é a continuação da série anterior —
 * quem faz 3×10 com drop na última diz "fiz 3 séries", não 4. O volume
 * levantado no drop, porém, é real e entra normalmente.
 */
function countsAsSeries(kind: SetKind): boolean {
  return kind !== "drop";
}

/**
 * Numeração VISÍVEL das séries contadas. Segue `countsAsSeries`: o aquecimento
 * é numerado junto (2 de aquecimento + 3 normais = "1 2 3 4 5"), senão o
 * cabeçalho diria "5 séries" e o cartão mostraria linhas numeradas até 3.
 * Quem identifica o aquecimento é a cor âmbar do selo, não o rótulo.
 * Devolve o rótulo por índice do array.
 */
function workingSetLabels(series: Array<{ kind?: SetKind }>): string[] {
  let n = 0;
  return series.map((row) => {
    const kind = setKindOf(row);
    // Drop não numera: é a continuação da série de cima, não a próxima série.
    if (kind === "drop") return SET_KIND_STYLE.drop.label;
    n += 1;
    // Falha é uma série válida numerada — a letra vai no realce da cor, não no
    // lugar do número, senão o usuário perde a conta das séries de trabalho.
    return String(n);
  });
}

// Indicador de progressão de carga (kg) por exercício, recalculado a cada série
// concluída. Reflete a ÚLTIMA série concluída comparada à sua referência:
//  - se já há uma série concluída antes dela nesta sessão → compara com o kg
//    dessa série anterior (mesmo que 0 / peso do corpo);
//  - se é a 1ª série concluída → compara com o histórico (`prevKg` da série);
//  - sem série anterior e sem histórico → neutro (cinza).
// `up` = progrediu (verde), `down` = regrediu (vermelho), `neutral` = igual/sem base.
type WeightTrend = "up" | "down" | "neutral";
function computeWeightTrend(
  series: Array<{ kg: number; completed: boolean; prevKg?: number; kind?: SetKind }>,
): WeightTrend {
  // Aquecimento fora: a rampa é sempre mais leve que a série anterior, então
  // sem este filtro toda série de trabalho depois de um aquecimento apareceria
  // como "progrediu" e o primeiro aquecimento como "regrediu".
  const completed = series.filter((s) => s.completed && isWorkingSet(s.kind));
  if (completed.length === 0) return "neutral";
  const latest = completed[completed.length - 1];
  const latestKg = latest.kg || 0;
  let baseline: number;
  if (completed.length >= 2) {
    // Série concluída anterior nesta sessão (0 é referência válida — peso do corpo).
    baseline = completed[completed.length - 2].kg || 0;
  } else {
    // 1ª série concluída → compara com o histórico da própria série.
    const prev = latest.prevKg || 0;
    if (prev <= 0) return "neutral";
    baseline = prev;
  }
  if (latestKg > baseline) return "up";
  if (latestKg < baseline) return "down";
  return "neutral";
}

// ── Corrida ao ar livre (GPS) ───────────────────────────────────────────────
// Só o exercício "Corrida ao Ar Livre" do catálogo ganha o painel de GPS —
// o workoutName chega localizado (pickLocalized), então casamos PT e EN.
const OUTDOOR_RUN_NAMES = new Set(["corrida ao ar livre", "outdoor running"]);
const isOutdoorRun = (name?: string | null) =>
  !!name &&
  OUTDOOR_RUN_NAMES.has(
    name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim(),
  );

// Painel de corrida GPS — renderizado no card expandido do exercício
// "Corrida ao Ar Livre". Estados: parado (CTA iniciar) → buscando sinal →
// correndo/pausado (stats ao vivo). Ao concluir, o dono (dialog) preenche a
// série com MIN×KM via onFinish.
function RunTrackerPanel({
  workoutId, state, onFinish,
}: {
  workoutId: string;
  state: RunState;
  onFinish: () => void;
}) {
  const { t } = useLanguage();
  const isThisRun = state.workoutId === workoutId && state.status !== "idle";
  const acquiring = isThisRun && state.status === "acquiring";
  const paused = isThisRun && state.status === "paused";
  const otherRunActive = !isThisRun && state.status !== "idle";

  // Strings da notificação Android; no iOS a presença do backgroundMessage é
  // o que liga o rastreamento com a tela bloqueada (run-tracker.ts).
  const labels: StartRunLabels = {
    backgroundTitle: t("goals_run_bg_notif_title"),
    backgroundMessage: t("goals_run_bg_notif_body"),
  };

  if (!isThisRun) {
    return (
      <div style={{ padding: "12px 16px 14px", borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 12, color: MUTED_FG, lineHeight: 1.45, marginBottom: 10 }}>
          {t("goals_run_gps_hint")}
        </div>
        {state.error && (
          <div style={{
            background: "hsl(var(--destructive) / 0.12)",
            border: "1px solid hsl(var(--destructive) / 0.4)",
            borderRadius: 10, padding: "8px 12px", marginBottom: 10,
            fontSize: 12, color: "hsl(var(--destructive))", lineHeight: 1.45,
          }}>
            {t(state.error === "denied" ? "goals_run_denied" : "goals_run_unavailable")}
            {state.error === "denied" && (
              <button
                onClick={() => { void openLocationSettings(); }}
                style={{
                  display: "block", marginTop: 6, padding: 0,
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 700, color: PRIMARY,
                  textDecoration: "underline",
                }}
              >
                {t("goals_run_open_settings")}
              </button>
            )}
          </div>
        )}
        <button
          onClick={() => { void startRun(workoutId, labels); }}
          disabled={otherRunActive}
          style={{
            width: "100%", height: 46, borderRadius: 999, border: "none",
            background: GLASS_GRADIENT, color: "#fff",
            fontSize: 14, fontWeight: 700,
            cursor: otherRunActive ? "not-allowed" : "pointer",
            opacity: otherRunActive ? 0.45 : 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            boxShadow: "0 6px 18px rgba(91,140,255,0.35)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z" stroke="#fff" strokeWidth="2" strokeLinejoin="round"/>
            <circle cx="12" cy="9" r="2.5" fill="#fff"/>
          </svg>
          {t("goals_run_start")}
        </button>
      </div>
    );
  }

  const statusColor = paused ? MUTED_FG : acquiring ? ORANGE : PRIMARY;
  const statusLabel = paused
    ? t("goals_run_paused_label")
    : acquiring
      ? t("goals_run_acquiring")
      : state.accuracy != null
        ? `${t("goals_run_active")} · ±${Math.round(state.accuracy)}m`
        : t("goals_run_active");

  return (
    <div style={{ padding: "14px 16px", borderBottom: `1px solid ${BORDER}` }}>
      {/* Stats ao vivo: distância / tempo / ritmo médio */}
      <div style={{ display: "flex", marginBottom: 12 }}>
        {[
          { label: t("goals_run_distance"), value: state.distanceKm.toFixed(2), unit: "km" },
          { label: t("goals_run_time"), value: formatRunTime(state.elapsedMs), unit: null },
          { label: t("goals_run_pace"), value: formatRunPace(state.paceSecPerKm), unit: "/km" },
        ].map(({ label, value, unit }) => (
          <div key={label} style={{ flex: 1, textAlign: "center" }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 0.7,
              textTransform: "uppercase", color: MUTED_FG, opacity: 0.8, marginBottom: 4,
            }}>
              {label}
            </div>
            <div style={{
              fontSize: 22, fontWeight: 800, color: FG,
              fontVariantNumeric: "tabular-nums", lineHeight: 1,
            }}>
              {value}
              {unit && (
                <span style={{ fontSize: 12, fontWeight: 600, color: MUTED_FG, marginLeft: 3 }}>
                  {unit}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Status do GPS */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 6, marginBottom: 12,
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%", background: statusColor,
          boxShadow: paused ? "none" : `0 0 8px ${statusColor}`,
        }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: MUTED_FG }}>
          {statusLabel}
        </span>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={() => { void (paused ? resumeRun(labels) : pauseRun()); }}
          style={{
            flex: 1, height: 44, borderRadius: 12, border: "none",
            background: SURFACE, color: FG,
            fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}
        >
          {paused ? t("goals_session_resume") : t("goals_rest_pause")}
        </button>
        <button
          onClick={onFinish}
          style={{
            flex: 1, height: 44, borderRadius: 12, border: "none",
            background: ORANGE, color: "#fff",
            fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}
        >
          {t("goals_run_finish")}
        </button>
      </div>

      <div style={{
        fontSize: 11, color: MUTED_FG, opacity: 0.75,
        textAlign: "center", marginTop: 10, lineHeight: 1.4,
      }}>
        {t("goals_run_bg_hint")}
      </div>
    </div>
  );
}

// Overlay de detalhe do exercício (foto ampliada + "como executar"), reusado
// pelo picker (catálogo) e pelo botão ⓘ da sessão — fonte única de verdade.
function ExerciseDetailOverlay({
  photo, name, muscleGroup, description, zIndex, onClose,
  workoutId, canEdit, onSaved, onDeleted,
}: {
  photo: string | null;
  name: string;
  muscleGroup: string | null;
  description: string;
  zIndex: number;
  onClose: () => void;
  /** id do exercício no catálogo — necessário para editar */
  workoutId?: string;
  /** true = exercício criado pelo próprio usuário → mostra a ação "Editar" */
  canEdit?: boolean;
  onSaved?: (updated: { id: string; name: string; description: string; photo: string | null }) => void;
  /** Chamado após apagar o exercício custom — remove das listas e fecha. */
  onDeleted?: (id: string) => void;
}) {
  const { t } = useLanguage();

  // ── Edição (só para exercícios criados pelo usuário) ────────────────────
  const [editing, setEditing] = React.useState(false);
  const [editName, setEditName] = React.useState("");
  const [editDesc, setEditDesc] = React.useState("");
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);
  const [photoRemoved, setPhotoRemoved] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Inputs vivem na área rolável do overlay — mantém o campo em foco acima do
  // teclado do iOS (par obrigatório com o padding-bottom da CSS var, abaixo).
  useKeyboardInputScroll(scrollRef, editing);

  const editable = !!canEdit && !!workoutId;

  const clearDraftPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPhotoRemoved(false);
  };

  const photoPreviewRef = React.useRef<string | null>(null);
  photoPreviewRef.current = photoPreview;
  React.useEffect(
    () => () => { if (photoPreviewRef.current) URL.revokeObjectURL(photoPreviewRef.current); },
    [],
  );

  const startEditing = () => {
    setEditName(name);
    setEditDesc(description ?? "");
    clearDraftPhoto();
    setConfirmDelete(false);
    setEditing(true);
  };

  const handleDelete = async () => {
    if (!workoutId || deleting) return;
    setDeleting(true);
    try {
      await deleteCustomWorkoutDb(workoutId);
      toast({ title: t("goals_item_deleted") });
      onDeleted?.(workoutId);
      onClose();
    } catch (err: any) {
      toast({
        title: t("goals_item_delete_error"),
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handlePhotoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: t("newpost_invalid_type"), variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: t("newpost_file_too_large"), variant: "destructive" });
      return;
    }
    setPhotoFile(file);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setPhotoRemoved(false);
  };

  const handleSave = async () => {
    if (!workoutId || saving) return;
    const newName = editName.trim();
    if (!newName) return;
    setSaving(true);
    try {
      // `undefined` = não mexe na foto; `null` = remover.
      let newPhoto: string | null | undefined;
      if (photoFile) newPhoto = await uploadCustomExercisePhotoDb(photoFile);
      else if (photoRemoved) newPhoto = null;

      const newDesc = editDesc.trim();
      await updateCustomWorkoutDb(workoutId, {
        name: newName,
        description: newDesc,
        ...(newPhoto !== undefined ? { photo: newPhoto } : {}),
      });

      toast({ title: t("goals_item_edit_saved") });
      onSaved?.({
        id: workoutId,
        name: newName,
        description: newDesc,
        photo: newPhoto !== undefined ? newPhoto : photo,
      });
      clearDraftPhoto();
      setEditing(false);
    } catch (err: any) {
      toast({
        title: t("goals_item_edit_error"),
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Foto exibida: preview do rascunho > removida > a atual.
  const shownPhoto = editing
    ? (photoPreview ?? (photoRemoved ? null : photo))
    : photo;

  const fieldStyle: React.CSSProperties = {
    width: "100%", borderRadius: 12, padding: "10px 12px",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.18)",
    color: "#fff", fontSize: 15, outline: "none",
    fontFamily: "'Inter', system-ui", boxSizing: "border-box",
  };

  return (
    <div
      // Enquanto edita, tocar no fundo não fecha (não perde o rascunho).
      onClick={() => { if (!editing) onClose(); }}
      style={{
        position: "absolute", inset: 0, zIndex,
        background: "rgba(0,0,0,0.92)",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        display: "flex", flexDirection: "column",
        // Reserva espaço para o botão de fechar no topo (acima do conteúdo).
        paddingTop: "max(64px, calc(env(safe-area-inset-top) + 44px))",
        paddingBottom: "max(20px, env(safe-area-inset-bottom))",
      }}
    >
      {/* Fechar — círculo escuro sólido para ficar visível mesmo sobre a foto branca */}
      <button
        onClick={onClose}
        aria-label={t("goals_cancel")}
        style={{
          position: "absolute", top: "max(12px, env(safe-area-inset-top))", right: 16,
          width: 40, height: 40, borderRadius: "50%",
          background: "rgba(18,17,26,0.78)",
          border: "1px solid rgba(255,255,255,0.22)",
          backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.45)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 2,
        }}
      >
        <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
          <path d="M2 2l10 10M12 2L2 12" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Editar — só para exercícios criados pelo próprio usuário */}
      {editable && !editing && (
        <button
          onClick={(e) => { e.stopPropagation(); startEditing(); }}
          style={{
            position: "absolute", top: "max(12px, env(safe-area-inset-top))", left: 16,
            height: 40, borderRadius: 20, padding: "0 16px",
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(18,17,26,0.78)",
            border: "1px solid rgba(255,255,255,0.22)",
            backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.45)",
            cursor: "pointer", zIndex: 2,
            color: "#fff", fontSize: 13, fontWeight: 700,
            fontFamily: "'Inter', system-ui",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          {t("goals_item_edit")}
        </button>
      )}

      {/* Conteúdo rolável: foto + nome + descrição. Só rola se realmente exceder. */}
      <div
        ref={scrollRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: 1, overflowY: "auto", overflowX: "hidden",
          overscrollBehavior: "contain", WebkitOverflowScrolling: "touch",
          padding: "0 20px",
          // Espaço para rolar o campo em foco acima do teclado do iOS.
          paddingBottom: "var(--keyboard-height, 0px)",
          display: "flex", flexDirection: "column", alignItems: "center",
        }}
      >
        {/* Foto — fundo claro para que ilustrações em linha escura fiquem visíveis */}
        <div style={{
          width: "100%",
          background: "#fff", borderRadius: 16,
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden", flexShrink: 0,
        }}>
          {shownPhoto ? (
            <img
              src={shownPhoto}
              alt={name}
              style={{ width: "100%", maxHeight: "38vh", objectFit: "contain", display: "block" }}
            />
          ) : (
            <svg width="64" height="36" viewBox="0 0 36 20" fill="none" opacity={0.18} style={{ margin: "44px 0" }}>
              <rect x="0.5" y="7" width="7" height="6" rx="2" fill="#000"/>
              <rect x="3" y="4.5" width="3" height="11" rx="1.5" fill="#000"/>
              <rect x="6.5" y="9" width="23" height="2" rx="1" fill="#000"/>
              <rect x="28.5" y="7" width="7" height="6" rx="2" fill="#000"/>
              <rect x="30" y="4.5" width="3" height="11" rx="1.5" fill="#000"/>
            </svg>
          )}
        </div>

        {editing ? (
          /* ── Modo de edição (exercício criado pelo usuário) ── */
          <div style={{ width: "100%", padding: "16px 0 8px", display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Foto: adicionar / trocar / remover */}
            <div style={{ display: "flex", gap: 8 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handlePhotoPick}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  flex: 1, padding: "10px 12px", borderRadius: 12, cursor: "pointer",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  color: "#fff", fontSize: 13, fontWeight: 700,
                  fontFamily: "'Inter', system-ui",
                }}
              >
                {shownPhoto ? t("goals_item_edit_photo_change") : t("goals_create_exercise_photo_cta")}
              </button>
              {shownPhoto && (
                <button
                  onClick={() => {
                    setPhotoFile(null);
                    setPhotoPreview((prev) => {
                      if (prev) URL.revokeObjectURL(prev);
                      return null;
                    });
                    setPhotoRemoved(true);
                  }}
                  style={{
                    padding: "10px 14px", borderRadius: 12, cursor: "pointer",
                    background: "rgba(239,68,68,0.14)",
                    border: "1px solid rgba(239,68,68,0.4)",
                    color: "#fca5a5", fontSize: 13, fontWeight: 700,
                    fontFamily: "'Inter', system-ui",
                  }}
                >
                  {t("goals_create_exercise_photo_remove")}
                </button>
              )}
            </div>

            {/* Nome */}
            <div>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: 0.7,
                textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 8,
              }}>
                {t("goals_create_exercise_name")}
              </div>
              <input
                type="text"
                value={editName}
                maxLength={120}
                onChange={(e) => setEditName(e.target.value)}
                style={fieldStyle}
              />
            </div>

            {/* Como executar */}
            <div>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: 0.7,
                textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 8,
              }}>
                {t("goals_exercise_how_to")}
              </div>
              <textarea
                value={editDesc}
                rows={5}
                placeholder={t("goals_create_exercise_howto_placeholder")}
                onChange={(e) => setEditDesc(e.target.value)}
                style={{ ...fieldStyle, resize: "none", lineHeight: 1.5 }}
              />
            </div>

            {/* Ações */}
            <div style={{ display: "flex", gap: 8, paddingTop: 2 }}>
              <button
                onClick={() => { clearDraftPhoto(); setEditing(false); }}
                disabled={saving}
                style={{
                  flex: 1, padding: "12px", borderRadius: 12, cursor: "pointer",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  color: "#fff", fontSize: 14, fontWeight: 700,
                  opacity: saving ? 0.5 : 1, fontFamily: "'Inter', system-ui",
                }}
              >
                {t("goals_cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editName.trim()}
                style={{
                  flex: 1, padding: "12px", borderRadius: 12, border: "none",
                  cursor: saving || !editName.trim() ? "default" : "pointer",
                  background: "linear-gradient(135deg,#5b8cff,#9d6bff)",
                  color: "#fff", fontSize: 14, fontWeight: 800,
                  opacity: saving || !editName.trim() ? 0.5 : 1,
                  fontFamily: "'Inter', system-ui",
                }}
              >
                {saving ? t("goals_picker_loading") : t("goals_item_edit_save")}
              </button>
            </div>

            {/* Apagar exercício — destrutivo, com confirmação inline */}
            {confirmDelete ? (
              <div style={{
                borderRadius: 12, padding: 12,
                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                display: "flex", flexDirection: "column", gap: 10,
              }}>
                <p style={{
                  margin: 0, fontSize: 12, lineHeight: 1.5, color: "rgba(255,255,255,0.82)",
                }}>
                  {t("goals_item_delete_confirm")}
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                    style={{
                      flex: 1, padding: "10px", borderRadius: 10, cursor: "pointer",
                      background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)",
                      color: "#fff", fontSize: 13, fontWeight: 700,
                      opacity: deleting ? 0.5 : 1, fontFamily: "'Inter', system-ui",
                    }}
                  >
                    {t("goals_cancel")}
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    style={{
                      flex: 1, padding: "10px", borderRadius: 10, border: "none", cursor: "pointer",
                      background: "#ef4444", color: "#fff", fontSize: 13, fontWeight: 800,
                      opacity: deleting ? 0.5 : 1, fontFamily: "'Inter', system-ui",
                    }}
                  >
                    {deleting ? t("goals_picker_loading") : t("goals_item_delete_yes")}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                style={{
                  width: "100%", padding: "11px", borderRadius: 12, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                  color: "#fca5a5", fontSize: 13, fontWeight: 700, fontFamily: "'Inter', system-ui",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
                {t("goals_item_delete")}
              </button>
            )}
          </div>
        ) : (
        <>
        {/* Nome + grupo muscular */}
        <div style={{ padding: "16px 4px 0", textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 10 }}>
            {name}
          </div>
          {muscleGroup && (
            <span style={{
              display: "inline-block",
              background: "rgba(255,255,255,0.15)", borderRadius: 20,
              padding: "4px 16px", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)",
            }}>
              {muscleGroup}
            </span>
          )}
        </div>

        {/* Descrição / como executar */}
        <div style={{ width: "100%", padding: "16px 0 8px" }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 0.7,
            textTransform: "uppercase", color: "rgba(255,255,255,0.5)",
            marginBottom: 8,
          }}>
            {t("goals_exercise_how_to")}
          </div>
          <p style={{
            fontSize: 14, lineHeight: 1.6, margin: 0,
            color: description ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.45)",
            fontStyle: description ? "normal" : "italic",
            whiteSpace: "pre-wrap",
          }}>
            {description || t("goals_exercise_no_description")}
          </p>
        </div>

        {/* Anatomia — mesma ficha do catálogo. É AQUI que o usuário olha o
            exercício com mais frequência (o "i" no card, durante o treino),
            então deixá-la só no wizard escondia a feature. */}
        <div style={{ width: "100%", paddingBottom: 8 }}>
          <ExerciseAnatomy workoutId={workoutId} />
        </div>
        </>
        )}
      </div>
    </div>
  );
}

export function WorkoutSessionDialog({
  open, userId, routineLabel, items, trainingMode = "simple",
  routineId: routineIdProp, routineName, onMinimize, onFinished,
}: WorkoutSessionDialogProps) {
  const { t } = useLanguage();
  // Chave única de ramificação da tela. Tudo que o modo expert acrescenta é
  // gateado por ela — no simplificado o componente renderiza exatamente o que
  // renderizava antes de 05/08/2026.
  const isExpert = trainingMode === "expert";
  const {
    workoutSeries, setWorkoutSeries,
    workoutDuration,
    workoutExerciseRestTimes, setWorkoutExerciseRestTimes,
    workoutExerciseNotes, setWorkoutExerciseNotes,
    workoutExtraItems, setWorkoutExtraItems,
    workoutRemovedIds, setWorkoutRemovedIds,
    workoutExpandedId: expandedId, setWorkoutExpandedId: setExpandedId,
    maxedExerciseIds, setMaxedExerciseIds,
    dismissedWarmupIds, setDismissedWarmupIds,
    globalRestTimerRemaining, setGlobalRestTimerRemaining,
    globalRestTimerActive, setGlobalRestTimerActive,
    globalRestTimerPaused, setGlobalRestTimerPaused,
    globalRestTimerTotal, setGlobalRestTimerTotal,
    globalRestTimerKey, setGlobalRestTimerKey,
    resetWorkoutState,
  } = useWorkout();

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [muscleFilter, setMuscleFilter] = React.useState<string | null>(null);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [itemSearch, setItemSearch] = React.useState("");
  const [infoExerciseId, setInfoExerciseId] = React.useState<string | null>(null);
  // Técnica cujo verbete está aberto (tocou no selo Bi-set / A1 / Drop-set).
  const [techniqueInfo, setTechniqueInfo] = React.useState<
    { technique: WorkoutTechnique; members: string[] } | null
  >(null);

  // Corrida GPS (Corrida ao Ar Livre) — o rastreador é um singleton em
  // run-tracker.ts, então a corrida continua com o treino minimizado; aqui
  // só espelhamos o estado para renderizar o painel.
  const [runState, setRunState] = React.useState<RunState>(getRunState);
  React.useEffect(() => subscribeRun(setRunState), []);
  // Resumo pós-corrida (stats + mapa do trajeto) — overlay estilo Strava
  const [runSummary, setRunSummary] = React.useState<{
    distanceKm: number;
    elapsedMs: number;
    paceSecPerKm: number | null;
    path: RunPoint[][];
  } | null>(null);
  // Última corrida concluída na sessão — sobrevive ao fechar do overlay de
  // resumo da corrida e segue no WorkoutSessionSummary ao finalizar o treino
  // (vira o slide de mapa compartilhável no resumo do treino).
  const lastRunRef = React.useRef<WorkoutSessionSummary["run"]>(null);

  // Menu de contexto (⋯) — qual exercício está aberto
  const [menuId, setMenuId] = React.useState<string | null>(null);
  // Quais exercícios têm nota aberta (lápis)
  const [noteOpenIds, setNoteOpenIds] = React.useState<Set<string>>(new Set());
  // Picker de exercícios
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerSearch, setPickerSearch] = React.useState("");
  const [catalog, setCatalog] = React.useState<Workout[]>([]);
  const [catalogLoading, setCatalogLoading] = React.useState(false);
  // Navegação do picker: lista x grupo muscular + seleção múltipla
  const [pickerBrowseMode, setPickerBrowseMode] = React.useState<"list" | "group">("list");
  const [pickerMuscleFilter, setPickerMuscleFilter] = React.useState<string | null>(null);
  const [pickerSelected, setPickerSelected] = React.useState<Set<string>>(new Set());
  // Detalhe (foto ampliada + "como executar") de um exercício do catálogo
  const [pickerInfo, setPickerInfo] = React.useState<Workout | null>(null);
  // Formulário "Criar novo exercício" (quando o usuário não acha na lista)
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createName, setCreateName] = React.useState("");
  const [createMuscle, setCreateMuscle] = React.useState("");
  const [createEquipment, setCreateEquipment] = React.useState("");
  const [createHowTo, setCreateHowTo] = React.useState("");
  const [createPhotoFile, setCreatePhotoFile] = React.useState<File | null>(null);
  const [createPhotoPreview, setCreatePhotoPreview] = React.useState<string | null>(null);
  const [createSaving, setCreateSaving] = React.useState(false);
  const createPhotoInputRef = React.useRef<HTMLInputElement>(null);

  const resetPicker = React.useCallback(() => {
    setPickerOpen(false);
    setPickerSearch("");
    setPickerBrowseMode("list");
    setPickerMuscleFilter(null);
    setPickerSelected(new Set());
    setPickerInfo(null);
    setCreateOpen(false);
    setCreateName("");
    setCreateMuscle("");
    setCreateEquipment("");
    setCreateHowTo("");
    setCreatePhotoFile(null);
    setCreatePhotoPreview(null);
  }, []);

  // Edições de exercícios custom feitas DENTRO da sessão (nome/descrição/foto).
  // O prop `items` só é recarregado pelo Goals num `loadData()`, então guardamos
  // o resultado aqui para a tela refletir a edição na hora.
  const [editedExercises, setEditedExercises] = React.useState<
    Record<string, { name: string; description: string; photo: string | null }>
  >({});
  // Trocas de variação feitas nesta sessão: `user_workouts.id` → exercício novo.
  // Mesmo papel de `editedExercises` — o prop `items` só recarrega num
  // loadData() do Goals, e a troca precisa aparecer no ato (ver swapVariation).
  const [swappedVariations, setSwappedVariations] = React.useState<
    Record<string, { workout_id: string; workoutName: string; workoutPhoto: string | null; workoutDescription?: string; muscle_group?: string | null }>
  >({});
  const applyExerciseEdit = React.useCallback(
    (u: { id: string; name: string; description: string; photo: string | null }) => {
      setEditedExercises((prev) => ({
        ...prev,
        [u.id]: { name: u.name, description: u.description, photo: u.photo },
      }));
    },
    [],
  );
  // Exercício custom apagado durante a sessão → some do card (marca como
  // removido, já que `items` é prop), do picker e da lista de extras.
  const applyExerciseDelete = React.useCallback(
    (workoutId: string) => {
      setWorkoutRemovedIds((prev) => (prev.includes(workoutId) ? prev : [...prev, workoutId]));
      setWorkoutExtraItems((prev) => prev.filter((i) => i.workout_id !== workoutId));
      setCatalog((prev) => prev.filter((w) => w.id !== workoutId));
      setPickerSelected((prev) => {
        if (!prev.has(workoutId)) return prev;
        const next = new Set(prev);
        next.delete(workoutId);
        return next;
      });
      // Descarta as séries desse exercício — o workout_id foi apagado do banco,
      // então gravar histórico para ele ao finalizar quebraria a FK.
      setWorkoutSeries((prev) => {
        if (!prev[workoutId]) return prev;
        const next = { ...prev };
        delete next[workoutId];
        return next;
      });
    },
    [setWorkoutRemovedIds, setWorkoutExtraItems, setWorkoutSeries],
  );

  // Lista completa de itens da sessão.
  // Dedup por workout_id: um exercício criado/adicionado durante a sessão entra
  // em `workoutExtraItems` E é vinculado à rotina (`createUserWorkoutsDb`); quando
  // um `loadData()` roda (ex.: evento `ritmofit-routines-changed`), ele passa a vir
  // também em `items`, aparecendo duplicado na tela. Mantém a 1ª ocorrência —
  // `items` (item real da rotina) vem primeiro, então prevalece sobre o extra.
  const allItems = React.useMemo(() => {
    const seen = new Set<string>();
    return [...items, ...workoutExtraItems]
      .filter((i) => {
        if (workoutRemovedIds.includes(i.workout_id)) return false;
        if (seen.has(i.workout_id)) return false;
        seen.add(i.workout_id);
        return true;
      })
      .map((i) => {
        // Variação trocada nesta sessão manda sobre o que veio no prop.
        const swapped = swappedVariations[i.id];
        const base = swapped ? { ...i, ...swapped } : i;
        const edited = editedExercises[base.workout_id];
        return edited
          ? {
              ...base,
              workoutName: edited.name,
              workoutDescription: edited.description,
              workoutPhoto: edited.photo,
            }
          : base;
      })
      // Ordem explícita da rotina (definida ao montar blocos de bi-set) tem
      // prioridade; sem ela, mantém a ordem de chegada de sempre. Sem isto os
      // membros de um bloco poderiam aparecer separados na tela.
      .sort((a, b) => {
        const ai = a.order_index, bi = b.order_index;
        if (ai == null && bi == null) return 0;
        if (ai == null) return 1;
        if (bi == null) return -1;
        return ai - bi;
      });
  }, [items, workoutExtraItems, workoutRemovedIds, editedExercises, swappedVariations]);

  /**
   * Blocos de bi-set/tri-set desta sessão: `technique_group` → workout_ids na
   * ordem de execução (A1 → A2 → A3). Só grupos com 2+ membros presentes viram
   * bloco — se o usuário removeu o par durante o treino, o que sobrou volta a
   * ser um exercício comum.
   */
  const blocks = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const i of allItems) {
      const g = i.technique_group;
      if (!g || !isBlockTechnique(i.technique)) continue;
      map.set(g, [...(map.get(g) ?? []), i.workout_id]);
    }
    for (const [g, ids] of map) if (ids.length < 2) map.delete(g);
    return map;
  }, [allItems]);

  /** workout_id → { groupKey, posição (0-based), total } */
  const blockInfo = React.useMemo(() => {
    const out = new Map<string, { group: string; index: number; size: number }>();
    for (const [group, ids] of blocks) {
      ids.forEach((id, index) => out.set(id, { group, index, size: ids.length }));
    }
    return out;
  }, [blocks]);

  /** Técnica configurada para este exercício NESTA rotina. */
  const techniqueOf = React.useCallback(
    (workoutId: string): WorkoutTechnique =>
      allItems.find((i) => i.workout_id === workoutId)?.technique ?? "straight",
    [allItems],
  );

  /**
   * Descanso que vale de fato para o exercício. O preset escolhido pelo usuário
   * manda, com uma exceção: no **rest-pause** o descanso é limitado a
   * {@link REST_PAUSE_MAX_SECS} — pausa longa ali descaracteriza a técnica.
   * "Sem descanso" (0) continua valendo como escolha explícita.
   */
  const restSecsFor = React.useCallback((workoutId: string): number => {
    const configured = workoutExerciseRestTimes[workoutId] ?? 60;
    if (configured <= 0) return 0;
    // Técnica é coisa do modo expert: uma rotina que voltou para o simplificado
    // mantém as colunas gravadas, mas a sessão dela não executa técnica nenhuma.
    return isExpert && techniqueOf(workoutId) === "rest_pause"
      ? Math.min(configured, REST_PAUSE_MAX_SECS)
      : configured;
  }, [workoutExerciseRestTimes, techniqueOf, isExpert]);

  /**
   * true = a rodada `index` do bloco ainda tem exercício por fazer (contando
   * `justCompletedId` como já concluído, porque o estado só muda no próximo
   * render). É o que segura o descanso no meio de um bi-set: a pausa é UMA, no
   * fim da rodada. Independe da ordem em que o usuário marcou os exercícios —
   * na grade lado a lado ele pode marcar A2 antes de A1.
   */
  const blockRoundPending = React.useCallback(
    (justCompletedId: string, index: number): boolean => {
      const info = blockInfo.get(justCompletedId);
      if (!info) return false;
      const ids = blocks.get(info.group) ?? [];
      return ids.some(
        (id) => id !== justCompletedId && !(workoutSeries[id]?.[index]?.completed ?? false),
      );
    },
    [blockInfo, blocks, workoutSeries],
  );

  // Rotina atual (para vincular exercícios criados/adicionados aos itens persistidos).
  // O id/nome autoritativos vêm do card (props); os itens podem ter routine_id nulo
  // (legado), então usamos o prop e só caímos no item como último recurso.
  const routineId = routineIdProp ?? items.find((i) => i.routine_id)?.routine_id ?? null;

  // O campo de nota só deve abrir por clique no lápis — nunca reaparecer sozinho.
  // Ao recolher/trocar de exercício, fechamos as notas abertas (a nota digitada
  // continua salva em workoutExerciseNotes; só a visibilidade é resetada).
  React.useEffect(() => {
    setNoteOpenIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set([...prev].filter((id) => id === expandedId));
      return next.size === prev.size ? prev : next;
    });
  }, [expandedId]);

  // Auto-expand first exercise on open (if nothing is already open); reset UI-only state on close
  React.useEffect(() => {
    if (open && allItems.length > 0) {
      setExpandedId((prev) => prev ?? allItems[0].workout_id);
    }
    if (!open) {
      setMuscleFilter(null);
      setSearchOpen(false);
      setItemSearch("");
      setNoteOpenIds(new Set());
      setMenuId(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Seed at least one series per exercise when opening
  React.useEffect(() => {
    if (!open || items.length === 0) return;
    setWorkoutSeries((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const item of items) {
        if (!next[item.workout_id] || next[item.workout_id].length === 0) {
          next[item.workout_id] = [{ series: 1, kg: 0, reps: 0, completed: false }];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [open, items, setWorkoutSeries]);

  // Bloco = rodadas pareadas. Todos os membros precisam ter o mesmo número de
  // séries, senão a grade lado a lado renderiza uma coluna mais curta que a
  // outra. Iguala pelo maior — só acrescenta linhas vazias, nunca apaga.
  React.useEffect(() => {
    if (!open || blocks.size === 0) return;
    setWorkoutSeries((prev) => {
      let next = prev;
      let changed = false;
      for (const ids of blocks.values()) {
        const rounds = Math.max(1, ...ids.map((id) => (prev[id] ?? []).length));
        for (const id of ids) {
          const list = prev[id] ?? [];
          if (list.length >= rounds) continue;
          if (!changed) { next = { ...prev }; changed = true; }
          next[id] = [
            ...list,
            ...Array.from({ length: rounds - list.length }, (_, k) => ({
              series: list.length + k + 1, kg: 0, reps: 0, completed: false,
            })),
          ];
        }
      }
      return changed ? next : prev;
    });
  }, [open, blocks, setWorkoutSeries]);

  // Melhor peso "anterior" por exercício — referência para avisar em tempo real
  // quando o usuário bate um recorde ao concluir uma série. O baseline inicial
  // vem do campo "anterior" (prevKg da última sessão, já carregado e visível);
  // depois é elevado ao maior peso concluído nesta sessão, para não repetir o
  // aviso em séries iguais/menores. Mapa: workout_id → melhor kg conhecido.
  const prevBestRef = React.useRef<Map<string, number>>(new Map());

  React.useEffect(() => {
    if (!open) prevBestRef.current = new Map();
  }, [open]);

  // Carrega catálogo quando picker é aberto
  React.useEffect(() => {
    if (!pickerOpen || catalog.length > 0) return;
    setCatalogLoading(true);
    getWorkoutsDb()
      .then((d) => { setCatalog(d); setCatalogLoading(false); })
      .catch(() => setCatalogLoading(false));
  }, [pickerOpen, catalog.length]);

  // ── Variações do exercício (grupos) ──────────────────────────────────────
  // O catálogo tem 13 supinos; o grupo diz que todos são "Supino". A rotina
  // guarda a variação escolhida por último (`user_workouts.workout_id`) e aqui
  // o usuário troca — na academia, olhando o que está livre.
  //
  // O grupo NÃO vem no item da rotina: é resolvido pelo catálogo, que é
  // cacheado e degrada sozinho quando a migração 20260812 não foi rodada
  // (sem `group_id`, nenhum exercício tem irmão e a UI de variação some).
  const [groups, setGroups] = React.useState<WorkoutGroup[]>([]);
  // Exercício com o seletor de variação aberto (workout_id) — `null` = fechado.
  const [variationPickerId, setVariationPickerId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    void getWorkoutGroupsDb().then((g) => { if (alive) setGroups(g); }).catch(() => {});
    // O catálogo é a fonte do `group_id` de cada exercício; sem ele não dá para
    // saber que "Supino Inclinado com Halteres" tem irmãos.
    if (catalog.length === 0) {
      void getWorkoutsDb().then((d) => { if (alive) setCatalog(d); }).catch(() => {});
    }
    return () => { alive = false; };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const groupById = React.useMemo(
    () => new Map(groups.map((g) => [g.id, g])),
    [groups],
  );
  /** workout_id → grupo a que ele pertence (undefined = exercício sem irmãos). */
  const groupOfWorkout = React.useCallback(
    (workoutId: string): WorkoutGroup | undefined => {
      const gid = catalog.find((w) => w.id === workoutId)?.groupId;
      return gid ? groupById.get(gid) : undefined;
    },
    [catalog, groupById],
  );
  /** Irmãos de um grupo, em ordem alfabética — é a lista do seletor. */
  const variationsOf = React.useCallback(
    (groupId: string): Workout[] =>
      catalog
        .filter((w) => w.groupId === groupId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [catalog],
  );

  /**
   * Troca a variação de um exercício no meio do treino ("o supino de hoje é com
   * halteres").
   *
   * O que acontece com o que já foi registrado: as séries **concluídas ficam na
   * variação em que foram feitas** — elas aconteceram, e o histórico tem que ser
   * fiel. Só as séries pendentes (e o descanso, a nota e o estado da rampa)
   * migram para a variação nova. Se sobrar alguma série concluída, o exercício
   * antigo continua na sessão como um card próprio, com o que foi feito nele.
   */
  const swapVariation = async (item: UserWorkoutWithDetails, target: Workout) => {
    const oldId = item.workout_id;
    if (oldId === target.id) { setVariationPickerId(null); return; }
    setVariationPickerId(null);

    const doneSets = (workoutSeries[oldId] ?? []).filter((s) => s.completed);
    const pendingSets = (workoutSeries[oldId] ?? []).filter((s) => !s.completed);

    // A coluna ANTERIOR tem que passar a falar da variação nova — o peso do
    // supino com halteres não é o da barra. Falha de rede aqui só custa a
    // referência: a troca acontece do mesmo jeito.
    let prev: Array<{ kg: number; reps: number }> = [];
    try {
      const last = await getLastWorkoutSessionSeriesDb(userId, [target.id]);
      prev = last[target.id] ?? [];
    } catch { /* sem rede: segue sem a coluna ANTERIOR */ }

    setWorkoutSeries((prevState) => {
      const next = { ...prevState };
      // Séries pendentes viram as séries da variação nova, com o ANTERIOR dela.
      const seeded = (pendingSets.length > 0
        ? pendingSets
        : [{ series: 1, kg: 0, reps: 0, completed: false }]
      ).map((s, i) => ({
        ...s,
        series: i + 1,
        // Carga vem zerada: manter o peso da barra num halter é sugerir um
        // número errado, e errado para MAIS (o usuário levanta menos por lado).
        kg: 0,
        prevKg: prev[i]?.kg ?? 0,
        prevReps: prev[i]?.reps ?? 0,
      })) as typeof pendingSets;
      next[target.id] = seeded;
      if (doneSets.length > 0) next[oldId] = doneSets.map((s, i) => ({ ...s, series: i + 1 }));
      else delete next[oldId];
      return next;
    });

    // Descanso, nota e "aquecimento dispensado" acompanham o exercício.
    setWorkoutExerciseRestTimes((p) => (p[oldId] == null ? p : { ...p, [target.id]: p[oldId] }));
    setWorkoutExerciseNotes((p) => (p[oldId] ? { ...p, [target.id]: p[oldId] } : p));
    setDismissedWarmupIds((p) => (p.includes(oldId) ? [...p, target.id] : p));
    prevBestRef.current.delete(oldId);

    // Card mostra a variação nova na hora…
    setSwappedVariations((p) => ({
      ...p,
      [item.id]: {
        workout_id: target.id,
        workoutName: target.name,
        workoutPhoto: target.photo,
        workoutDescription: target.description,
        muscle_group: target.muscle_group,
      },
    }));
    if (expandedId === oldId) setExpandedId(target.id);
    // …e o exercício antigo, se ainda tem série concluída, continua na lista
    // como um item extra (senão o trabalho feito sumiria da tela).
    if (doneSets.length > 0) {
      setWorkoutExtraItems((p) =>
        p.some((e) => e.workout_id === oldId) ? p : [...p, { ...item, id: `swapped:${item.id}:${oldId}` }],
      );
    }

    // Persiste a escolha: a próxima sessão abre já com esta variação.
    try {
      await updateUserWorkoutExerciseDb(userId, item.id, target.id);
    } catch {
      showNotice({ kind: "warn", title: t("goals_variation_saved_error"), desc: "" });
    }
  };

  // Muscle group filter chips
  const muscleGroups = React.useMemo(
    () => [...new Set(allItems.map((i) => i.muscle_group).filter(Boolean) as string[])],
    [allItems],
  );
  // Normaliza para busca: remove acentos e caixa, para "maquina" achar "máquina".
  const normalize = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const filteredItems = allItems.filter((i) => {
    if (muscleFilter && i.muscle_group !== muscleFilter) return false;
    const q = normalize(itemSearch.trim());
    if (q && !normalize(i.workoutName ?? "").includes(q)) return false;
    return true;
  });

  /**
   * A lista de cards da sessão. Um exercício comum vira um card; um bloco de
   * bi-set/tri-set vira UM card com os membros lado a lado, ancorado na posição
   * do primeiro membro.
   *
   * Filtro/busca é por bloco inteiro: casar um membro basta para o bloco
   * aparecer, porque meio bi-set na tela não é a técnica que o usuário montou.
   */
  type RenderUnit =
    | { kind: "single"; item: UserWorkoutWithDetails }
    | { kind: "block"; group: string; members: UserWorkoutWithDetails[] };

  const visibleIds = new Set(filteredItems.map((i) => i.workout_id));
  const renderUnits: RenderUnit[] = [];
  {
    const placed = new Set<string>();
    for (const item of allItems) {
      if (placed.has(item.workout_id)) continue;
      // Bloco só existe no expert. Rotina que voltou ao simplificado mantém as
      // colunas gravadas, mas a sessão dela é a clássica: um card por exercício.
      const info = isExpert ? blockInfo.get(item.workout_id) : undefined;
      if (info) {
        const members = (blocks.get(info.group) ?? [])
          .map((id) => allItems.find((i) => i.workout_id === id))
          .filter((m): m is UserWorkoutWithDetails => !!m);
        for (const m of members) placed.add(m.workout_id);
        if (members.some((m) => visibleIds.has(m.workout_id))) {
          renderUnits.push({ kind: "block", group: info.group, members });
        }
        continue;
      }
      placed.add(item.workout_id);
      if (visibleIds.has(item.workout_id)) renderUnits.push({ kind: "single", item });
    }
  }

  // Live stats
  const stats = React.useMemo(() => {
    let volume = 0, totalDone = 0, doneEx = 0;
    allItems.forEach((item) => {
      const series = workoutSeries[item.workout_id] ?? [];
      const isCardio = isCardioExercise(item.muscle_group, item.workout_id);
      let any = false;
      series.forEach((s) => {
        if (!s.completed) return;
        // Mesma regra da finalização, para a barra ao vivo nunca mostrar número
        // diferente do que o resumo grava no fim:
        //  - VOLUME = tudo que foi levantado, incluindo aquecimento e drop;
        //  - CONTAGEM = séries contadas (o drop pertence à série de cima).
        if (!isCardio) volume += (s.kg || 0) * (s.reps || 0);
        if (countsAsSeries(setKindOf(s))) totalDone++;
        any = true;
      });
      if (any) doneEx++;
    });
    return { volume: Math.round(volume), totalDone, doneEx };
  }, [workoutSeries, allItems]);

  // Avisos da sessão (PR/recorde e validações) — renderizados DENTRO do overlay
  // porque o overlay é `position:fixed z-9999` portado ao body; um toast global
  // (mesmo z-index, porém antes no DOM) ficaria atrás desta tela e nunca apareceria.
  type SessionNotice =
    | { kind: "pr"; title: string; desc: string }
    | { kind: "warn"; title: string; desc: string };
  const [notice, setNotice] = React.useState<SessionNotice | null>(null);
  const noticeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const showNotice = (n: SessionNotice, ms = 3800) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(n);
    noticeTimer.current = setTimeout(() => setNotice(null), ms);
  };
  React.useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);

  // "Zerou a máquina?" — prompt interativo que aparece ao concluir uma série
  // acima de MACHINE_MAXED_KG (120kg). Diferente do `notice` (só informativo),
  // este pede uma decisão: confirmar marca o exercício como máquina zerada
  // (borda dourada no card + entra no machinedExercises do resumo). Fica só um
  // exercício por vez; auto-some após um tempo maior, mas re-pergunta a cada
  // série pesada enquanto não for marcado (dá margem para dispensar sem querer).
  const [machinePrompt, setMachinePrompt] = React.useState<
    { workoutId: string; name: string; kg: number } | null
  >(null);
  const machinePromptTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const showMachinePrompt = (p: { workoutId: string; name: string; kg: number }) => {
    if (machinePromptTimer.current) clearTimeout(machinePromptTimer.current);
    setMachinePrompt(p);
    machinePromptTimer.current = setTimeout(() => setMachinePrompt(null), 7000);
  };
  const dismissMachinePrompt = () => {
    if (machinePromptTimer.current) clearTimeout(machinePromptTimer.current);
    setMachinePrompt(null);
  };
  React.useEffect(() => () => { if (machinePromptTimer.current) clearTimeout(machinePromptTimer.current); }, []);
  const confirmMachineMaxed = () => {
    if (!machinePrompt) return;
    const id = machinePrompt.workoutId;
    setMaxedExerciseIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    dismissMachinePrompt();
  };
  // O selo "Máquina zerada" no card é só um indicador (não é tocável). Para
  // removê-lo, o usuário desmarca o exercício como concluído — quando ele fica
  // sem nenhuma série concluída, a marca é removida (ver toggleCompleted).

  // Modal de descanso (contador regressivo em destaque ao concluir uma série)
  const [restModalOpen, setRestModalOpen] = React.useState(false);
  const lastTimerKeyRef = React.useRef(globalRestTimerKey);

  // Séries cujo check foi tentado sem dados — destaca os campos faltantes
  const [invalidSeries, setInvalidSeries] = React.useState<Set<string>>(new Set());
  const seriesKey = (workoutId: string, index: number) => `${workoutId}:${index}`;

  // Modo expert: linha cujo seletor de tipo de série está aberto (a folha de
  // vidro com Aquecimento / Válida / Falha). `null` = fechado.
  const [kindPickerKey, setKindPickerKey] = React.useState<string | null>(null);

  /**
   * Emenda um drop-set logo abaixo da série `index`: mesma repetição-alvo, carga
   * reduzida em 20% (arredondada a 2,5kg, o menor par de anilhas). É um palpite
   * editável — o ponto é não obrigar a digitar do zero no meio da série, que é
   * exatamente quando não dá para digitar nada.
   */
  const addDropSet = (workoutId: string, index: number) => {
    setWorkoutSeries((prev) => {
      const list = prev[workoutId] ?? [];
      const parent = list[index];
      if (!parent) return prev;
      // Fim da corrente de quedas que já pende desta série. Sem isso, pedir a 2ª
      // queda a partir da mesma série de trabalho inseriria a nova ANTES da
      // anterior, e a corrente sairia fora de ordem (12 → 8 → 10 em vez de
      // 12 → 10 → 8).
      let tail = index;
      while (setKindOf(list[tail + 1]) === "drop") tail += 1;
      const from = list[tail];
      const dropped = Math.max(0, Math.round(((from.kg || 0) * 0.8) / 2.5) * 2.5);
      const next = [...list];
      next.splice(tail + 1, 0, {
        series: 0, // renumerado abaixo
        // Cada queda parte da carga da ANTERIOR (não da série de trabalho), que
        // é o que faz a corrente descer de verdade a cada degrau.
        kg: dropped,
        reps: from.reps || 0,
        completed: false,
        kind: "drop",
      });
      return { ...prev, [workoutId]: next.map((s, i) => ({ ...s, series: i + 1 })) };
    });
    setKindPickerKey(null);
  };

  /**
   * Carga de trabalho de referência de um exercício, para montar a rampa:
   * o maior peso entre as séries de trabalho já preenchidas; se nenhuma tem
   * carga ainda, cai no histórico (coluna ANTERIOR). 0 = não dá para sugerir.
   */
  const workingTargetKg = React.useCallback((workoutId: string): number => {
    const list = workoutSeries[workoutId] ?? [];
    let best = 0;
    for (const s of list) {
      if (setKindOf(s) === "warmup") continue;
      best = Math.max(best, s.kg || 0);
    }
    if (best > 0) return best;
    return list.reduce((m, s) => Math.max(m, (s as any).prevKg || 0), 0);
  }, [workoutSeries]);

  /**
   * Insere a rampa de aquecimento ANTES das séries de trabalho. Não substitui
   * nada: as séries válidas continuam onde estavam, só empurradas para baixo.
   */
  const addWarmupRamp = (workoutId: string) => {
    const target = workingTargetKg(workoutId);
    const ramp = buildWarmupSets(target);
    if (ramp.length === 0) return;
    setWorkoutSeries((prev) => {
      const list = prev[workoutId] ?? [];
      const warmups = ramp.map((r) => ({
        series: 0, // renumerado abaixo
        kg: r.kg,
        reps: r.reps,
        completed: false,
        kind: "warmup" as SetKind,
      }));
      return {
        ...prev,
        [workoutId]: [...warmups, ...list].map((s, i) => ({ ...s, series: i + 1 })),
      };
    });
  };

  // Muda o tipo de uma série. Trocar para aquecimento uma série JÁ concluída é
  // legítimo (o usuário percebe depois que aquilo foi rampa) — o valor sai do
  // volume/PR na finalização, então não há nada a desfazer aqui.
  const setSeriesKind = (workoutId: string, index: number, kind: SetKind) => {
    setWorkoutSeries((prev) => ({
      ...prev,
      [workoutId]: (prev[workoutId] ?? []).map((s, i) => (i === index ? { ...s, kind } : s)),
    }));
    setKindPickerKey(null);
  };

  // Swipe-to-delete: qual linha está com o botão de apagar revelado
  const [swipedSeriesKey, setSwipedSeriesKey] = React.useState<string | null>(null);
  const swipeStartX = React.useRef(0);
  const swipeStartY = React.useRef(0);
  const swipeHorizontal = React.useRef(false); // evita interferir no scroll vertical

  // Célula (kg/reps/min/km) sendo digitada — guarda o TEXTO cru enquanto o campo
  // tem foco. Sem isso, um input controlado por número descartaria o "." no meio
  // da digitação ("1." vira 1 e o ponto some), impossibilitando casas decimais —
  // crítico para o KM do cardio. Só uma célula é editada por vez (foco único).
  // No blur, o texto cru é descartado e o valor numérico canônico volta a mandar.
  const [editingCell, setEditingCell] = React.useState<{ key: string; text: string } | null>(null);
  // Normaliza a digitação: vírgula→ponto, só dígitos e um único ponto decimal.
  const sanitizeDecimalInput = (raw: string) =>
    raw.replace(",", ".").replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
  const handleSeriesInput = (
    workoutId: string, index: number, field: "kg" | "reps", raw: string, isCardio: boolean,
  ) => {
    const cleaned = sanitizeDecimalInput(raw);
    setEditingCell({ key: `${workoutId}:${index}:${field}`, text: cleaned });
    const num = cleaned === "" || cleaned === "." ? 0 : parseFloat(cleaned);
    updateSeries(workoutId, index, field, Number.isNaN(num) ? 0 : num, isCardio);
  };

  // ── Teclado iOS: manter o input de kg/reps visível acima do teclado ──────
  // Este overlay é `position:fixed; overflow:hidden` e rola numa área interna
  // (`cardsScrollRef`), então o scroll-assist de página do keyboard.ts (que usa
  // window.scrollBy) não alcança estes inputs — no último exercício eles ficam
  // atrás do teclado. Aqui: (1) a área de cards ganha padding-bottom igual à
  // altura do teclado (via CSS var, dá espaço para rolar) e (2) ao focar um
  // input / abrir o teclado, rolamos ESTE container até o campo ficar visível.
  const cardsScrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const scrollActiveInputIntoView = () => {
      const kb = getKeyboardHeight();
      if (kb <= 0) return;
      const el = document.activeElement as HTMLElement | null;
      if (!el || (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA")) return;
      const container = cardsScrollRef.current;
      if (!container || !container.contains(el)) return;
      const rect = el.getBoundingClientRect();
      const visibleBottom = window.innerHeight - kb - 16;
      if (rect.bottom > visibleBottom) {
        container.scrollBy({ top: rect.bottom - visibleBottom, behavior: "smooth" });
      }
    };
    // Abrir o teclado (altura passa a > 0) rola o campo em foco para a vista.
    const unsub = subscribeKeyboardHeight((h) => {
      if (h > 0) requestAnimationFrame(scrollActiveInputIntoView);
    });
    // Trocar de input com o teclado já aberto não muda a altura (o subscriber
    // não dispara), então também reagimos ao foco. 2 rAF: espera o keyboardWillShow
    // publicar a altura quando o foco é o que abriu o teclado.
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA") return;
      requestAnimationFrame(() => requestAnimationFrame(scrollActiveInputIntoView));
    };
    document.addEventListener("focusin", onFocusIn);
    return () => {
      unsub();
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [open]);

  // Semeia o tempo de descanso salvo (user_workouts.time_to_rest) por exercício
  // ao abrir o treino. Padrão = 60s (1 min). Só preenche o que ainda não tem
  // valor no estado, para não sobrescrever uma mudança feita na sessão (o estado
  // é persistido no contexto e sobrevive a minimizar/reload).
  React.useEffect(() => {
    if (!open) return;
    setWorkoutExerciseRestTimes((prev) => {
      let next = prev;
      for (const it of items) {
        if (next[it.workout_id] == null) {
          // null/undefined = nunca definido → padrão 60s (1 min). Um 0 salvo é
          // uma escolha válida ("sem descanso") e deve ser preservado.
          const saved = it.time_to_rest;
          if (next === prev) next = { ...prev };
          next[it.workout_id] = typeof saved === "number" ? saved : 60;
        }
      }
      return next;
    });
  }, [open, items, setWorkoutExerciseRestTimes]);

  // Rest timer
  // `overrideSecs` = descanso desta série específica, ignorando a preferência do
  // exercício (usado pelo aquecimento no modo expert). Respeita "sem descanso":
  // quem zerou o descanso do exercício não ganha timer nem no aquecimento.
  const startRestTimer = (workoutId: string, overrideSecs?: number) => {
    // Já vem com o teto do rest-pause aplicado (ver restSecsFor).
    const configured = restSecsFor(workoutId);
    const secs = overrideSecs != null ? Math.min(overrideSecs, configured) : configured;
    if (secs === 0) return; // sem descanso — não abre modal
    setGlobalRestTimerTotal(secs);
    setGlobalRestTimerRemaining(secs);
    setGlobalRestTimerPaused(false);
    setGlobalRestTimerActive(true);
    setGlobalRestTimerKey((k) => k + 1);
  };

  // Abre o modal sempre que um novo descanso começa (nova chave de timer)
  React.useEffect(() => {
    if (globalRestTimerKey !== lastTimerKeyRef.current) {
      lastTimerKeyRef.current = globalRestTimerKey;
      if (globalRestTimerActive) setRestModalOpen(true);
    }
  }, [globalRestTimerKey, globalRestTimerActive]);

  // Fecha o modal quando o descanso termina ou é pulado
  React.useEffect(() => {
    if (!globalRestTimerActive || globalRestTimerRemaining <= 0) setRestModalOpen(false);
  }, [globalRestTimerActive, globalRestTimerRemaining]);

  const restPct = globalRestTimerTotal > 0
    ? (globalRestTimerRemaining / globalRestTimerTotal) * 100
    : 0;

  const skipRest = () => {
    setGlobalRestTimerActive(false);
    setGlobalRestTimerPaused(false);
    setGlobalRestTimerRemaining(0);
    // Bump da key garante que o clearInterval no contexto rode imediatamente,
    // sem esperar o próximo tick do setInterval.
    setGlobalRestTimerKey((k) => k + 1);
    setRestModalOpen(false);
  };

  // ── Handlers de ação ────────────────────────────────────────

  const toggleNote = (workoutId: string) => {
    setNoteOpenIds((prev) => {
      const s = new Set(prev);
      s.has(workoutId) ? s.delete(workoutId) : s.add(workoutId);
      return s;
    });
    setMenuId(null);
  };

  // Concluir a corrida GPS: preenche a próxima série livre do exercício com os
  // valores medidos e marca como concluída — cardio usa kg=MIN e reps=KM, o
  // mesmo contrato da tabela de séries (oculta para este exercício), então o
  // save/histórico/resumo seguem inalterados. Depois abre o resumo com o mapa.
  const handleRunFinish = async (workoutId: string) => {
    const result = await stopRun();
    const min = Math.round((result.elapsedMs / 60000) * 10) / 10;
    const km = Math.round(result.distanceKm * 100) / 100;
    setWorkoutSeries((prev) => {
      const list = prev[workoutId] ?? [];
      const idx = list.findIndex((s) => !s.completed);
      const filled = { kg: min, reps: km, completed: min > 0 || km > 0 };
      if (idx === -1) {
        return {
          ...prev,
          [workoutId]: [...list, { series: list.length + 1, ...filled }],
        };
      }
      return {
        ...prev,
        [workoutId]: list.map((s, i) => (i === idx ? { ...s, ...filled } : s)),
      };
    });
    const summary = {
      distanceKm: result.distanceKm,
      elapsedMs: result.elapsedMs,
      paceSecPerKm: result.paceSecPerKm,
      path: result.path,
    };
    setRunSummary(summary);
    lastRunRef.current = summary;
  };

  const removeFromSession = (workoutId: string) => {
    // Se a corrida GPS ativa pertence a este exercício, encerra o watch junto
    if (getRunState().workoutId === workoutId) void stopRun();
    setWorkoutRemovedIds((prev) => [...new Set([...prev, workoutId])]);
    setMenuId(null);
    if (expandedId === workoutId) setExpandedId(null);
    setWorkoutSeries((prev) => {
      const next = { ...prev };
      delete next[workoutId];
      return next;
    });
  };

  // Toca num exercício do picker → alterna a seleção (itens já na sessão ficam travados)
  const handlePickExercise = (workout: Workout) => {
    if (allItems.some((i) => i.workout_id === workout.id)) return;
    setPickerSelected((prev) => {
      const next = new Set(prev);
      if (next.has(workout.id)) next.delete(workout.id);
      else next.add(workout.id);
      return next;
    });
  };

  // Lê a foto escolhida (câmera ou galeria no iOS) e gera um preview local.
  const handleCreatePhotoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite reescolher o mesmo arquivo
    if (!file) return;
    setCreatePhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setCreatePhotoPreview(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  };

  // Criar um exercício próprio quando o usuário não acha na lista.
  // Persiste no catálogo (created_by_user), insere na lista do picker e já o seleciona.
  const handleCreateExercise = async () => {
    const name = createName.trim();
    const muscle = createMuscle.trim();
    if (!name || !muscle || createSaving) return;
    setCreateSaving(true);
    try {
      let photoUrl: string | null = null;
      if (createPhotoFile) {
        photoUrl = await uploadCustomExercisePhotoDb(createPhotoFile);
      }
      const created = await createCustomWorkoutDb(
        name,
        createHowTo.trim(),
        muscle,
        photoUrl,
        createEquipment.trim() || null,
      );
      // Vincula à rotina do usuário (user_workouts) para persistir entre sessões —
      // sem isto o exercício só existiria no estado local e sumiria ao reabrir.
      // `name` = nome da rotina (mesmo agrupador usado por buildRoutineCards/groupByName),
      // para o exercício cair no card correto (ex.: rotina "Peitos").
      await createUserWorkoutsDb(userId, [created.id], {
        routine_id: routineId,
        name: routineName ?? undefined,
      });
      setCatalog((prev) => [created, ...prev]);
      setPickerSelected((prev) => new Set(prev).add(created.id));
      setCreateOpen(false);
      setCreateName("");
      setCreateMuscle("");
      setCreateEquipment("");
      setCreateHowTo("");
      setCreatePhotoFile(null);
      setCreatePhotoPreview(null);
      setPickerSearch("");
    } catch (err: any) {
      toast({
        title: t("goals_add_exercise_error"),
        description: err?.message || t("goals_create_error_retry"),
        variant: "destructive",
      });
    } finally {
      setCreateSaving(false);
    }
  };

  // Confirmar → adiciona todos os exercícios selecionados de uma vez
  const handleConfirmPicker = () => {
    const chosen = catalog.filter((w) => pickerSelected.has(w.id));
    if (chosen.length === 0) return;
    // Reinsere quem tinha sido removido da sessão: `allItems` filtra por
    // `workoutRemovedIds`, então sem limpar essa marca o exercício adicionado de
    // novo continuaria escondido — o picker fecha como se tivesse dado certo e
    // nada aparece na lista.
    const chosenIds = new Set(chosen.map((w) => w.id));
    setWorkoutRemovedIds((prev) => {
      const next = prev.filter((id) => !chosenIds.has(id));
      return next.length === prev.length ? prev : next;
    });
    // Só vira item extra quem ainda não existe na sessão. Quem já vem de `items`
    // (ou de um extra anterior) volta apenas com a limpeza acima — criar outra
    // entrada aqui empilharia extras órfãos no estado persistido.
    const existingIds = new Set([...items, ...workoutExtraItems].map((i) => i.workout_id));
    const newItems: UserWorkoutWithDetails[] = chosen
      .filter((workout) => !existingIds.has(workout.id))
      .map((workout) => ({
        id: `session_${workout.id}`,
        workout_id: workout.id,
        user_id: userId,
        name: null,
        created_at: new Date().toISOString(),
        workoutName: workout.name,
        workoutDescription: workout.description || undefined,
        muscle_group: workout.muscle_group ?? null,
        workoutPhoto: workout.photo ?? null,
        routine_id: null,
        isCustom: workout.isCustom,
      }));
    if (newItems.length > 0) setWorkoutExtraItems((prev) => [...prev, ...newItems]);
    setWorkoutSeries((prev) => {
      const next = { ...prev };
      for (const workout of chosen) {
        if ((next[workout.id]?.length ?? 0) === 0) {
          next[workout.id] = [{ series: 1, kg: 0, reps: 0, completed: false }];
        }
      }
      return next;
    });
    setExpandedId(chosen[chosen.length - 1].id);
    resetPicker();
  };

  // ── Operações de séries ─────────────────────────────────────

  const addSeries = (workoutId: string) => {
    setWorkoutSeries((prev) => {
      const list = prev[workoutId] ?? [];
      const last = list[list.length - 1];
      return {
        ...prev,
        [workoutId]: [
          ...list,
          { series: list.length + 1, kg: last?.kg ?? 0, reps: last?.reps ?? 0, completed: false },
        ],
      };
    });
  };

  // ── Operações de BLOCO (bi-set / tri-set) ───────────────────
  // No bloco a unidade não é a série de um exercício, é a RODADA: A1 e A2 são
  // feitos em seguida e só então vem o descanso. Por isso as três operações
  // abaixo agem sobre todos os membros de uma vez — deixar as listas com
  // tamanhos diferentes abriria buracos na grade lado a lado.

  const addBlockRound = (ids: string[]) => {
    for (const id of ids) addSeries(id);
  };

  const removeBlockRound = (ids: string[], index: number) => {
    for (const id of ids) deleteSeries(id, index);
  };

  /** Descanso do bloco: um valor só, espelhado em todos os membros. */
  const setBlockRest = (ids: string[], secs: number) => {
    setWorkoutExerciseRestTimes((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = secs;
      return next;
    });
  };

  const deleteSeries = (workoutId: string, index: number) => {
    setWorkoutSeries((prev) => ({
      ...prev,
      [workoutId]: (prev[workoutId] ?? [])
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, series: i + 1 })),
    }));
    setInvalidSeries((prev) => {
      const next = new Set(prev);
      next.delete(seriesKey(workoutId, index));
      return next;
    });
    setSwipedSeriesKey(null);
    // Apagar uma linha renumera as seguintes — um seletor aberto passaria a
    // apontar para outra série. Fecha.
    setKindPickerKey(null);
  };

  // Touch handlers para o swipe-to-delete de cada linha de série
  const onSeriesTouchStart = (e: React.TouchEvent, key: string) => {
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
    swipeHorizontal.current = false;
    // Fecha outra linha aberta
    if (swipedSeriesKey && swipedSeriesKey !== key) setSwipedSeriesKey(null);
  };

  const onSeriesTouchMove = (e: React.TouchEvent) => {
    if (swipeHorizontal.current) return;
    const dx = Math.abs(e.touches[0].clientX - swipeStartX.current);
    const dy = Math.abs(e.touches[0].clientY - swipeStartY.current);
    if (dx > 6 || dy > 6) swipeHorizontal.current = dx > dy;
  };

  const onSeriesTouchEnd = (e: React.TouchEvent, key: string) => {
    if (!swipeHorizontal.current) return;
    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    if (dx < -50) setSwipedSeriesKey(key);            // swipe esquerda → abre
    else if (dx > 20 && swipedSeriesKey === key) setSwipedSeriesKey(null); // swipe direita → fecha
  };

  // ── Swipe para dispensar o convite de aquecimento ────────────────────────
  // Quem não usa a rampa não deveria ter que conviver com o convite: arrastar
  // para a ESQUERDA some com ele naquele exercício (mesma direção do swipe-to-
  // delete das séries, para o gesto ser um só no app inteiro). Estado no
  // contexto → não volta ao minimizar/recarregar o treino.
  const warmupSwipeStartX = React.useRef(0);
  const warmupSwipeStartY = React.useRef(0);
  const warmupSwipeHorizontal = React.useRef(false);
  // Arraste em andamento: o botão acompanha o dedo (feedback de que o gesto
  // existe). `null` = nenhum. Só um por vez — não dá para arrastar dois.
  const [warmupDrag, setWarmupDrag] = React.useState<{ id: string; dx: number } | null>(null);

  const dismissWarmupRamp = (workoutId: string) => {
    setWarmupDrag(null);
    setDismissedWarmupIds((prev) => (prev.includes(workoutId) ? prev : [...prev, workoutId]));
  };

  const onWarmupTouchStart = (e: React.TouchEvent, workoutId: string) => {
    warmupSwipeStartX.current = e.touches[0].clientX;
    warmupSwipeStartY.current = e.touches[0].clientY;
    warmupSwipeHorizontal.current = false;
    setWarmupDrag({ id: workoutId, dx: 0 });
  };

  const onWarmupTouchMove = (e: React.TouchEvent, workoutId: string) => {
    const dx = e.touches[0].clientX - warmupSwipeStartX.current;
    const dy = e.touches[0].clientY - warmupSwipeStartY.current;
    // Decide uma vez se o gesto é horizontal, para não roubar o scroll vertical
    // da lista de exercícios (mesma heurística das linhas de série).
    if (!warmupSwipeHorizontal.current) {
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        warmupSwipeHorizontal.current = Math.abs(dx) > Math.abs(dy);
      }
      if (!warmupSwipeHorizontal.current) return;
    }
    // Só para a esquerda: puxar para a direita não faz nada, então não move.
    setWarmupDrag({ id: workoutId, dx: Math.min(0, dx) });
  };

  const onWarmupTouchEnd = (e: React.TouchEvent, workoutId: string) => {
    const dx = e.changedTouches[0].clientX - warmupSwipeStartX.current;
    if (warmupSwipeHorizontal.current && dx < -60) dismissWarmupRamp(workoutId);
    else setWarmupDrag(null); // volta ao lugar
  };

  const updateSeries = (
    workoutId: string, index: number, field: "kg" | "reps", value: number, isCardio: boolean,
  ) => {
    setWorkoutSeries((prev) => ({
      ...prev,
      [workoutId]: (prev[workoutId] ?? []).map((s, i) =>
        i === index ? { ...s, [field]: value } : s,
      ),
    }));
    // Limpa o destaque de erro assim que a série passa a ter os dados necessários
    setInvalidSeries((prev) => {
      const key = seriesKey(workoutId, index);
      if (!prev.has(key)) return prev;
      const current = workoutSeries[workoutId]?.[index];
      const updated = { kg: current?.kg ?? 0, reps: current?.reps ?? 0, [field]: value };
      if (!canCompleteSeries(updated, isCardio)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  // Uma série só pode ser concluída com os dados preenchidos:
  // força → só REPS (o kg é opcional: peso do corpo/máquina = 0 é válido)
  // cardio → min OU km
  const canCompleteSeries = (row: { kg: number; reps: number }, isCardio: boolean) =>
    isCardio
      ? (row.kg || 0) > 0 || (row.reps || 0) > 0
      : (row.reps || 0) > 0;

  const toggleCompleted = (workoutId: string, index: number, isCardio: boolean) => {
    // Lê o estado atual de forma síncrona — o updater do setState só roda na
    // fase de render, então não dá para decidir o "acabou de concluir" lá dentro.
    const row = workoutSeries[workoutId]?.[index];
    const wasCompleted = row?.completed ?? false;

    // Trava: ao tentar concluir, exige kg/reps preenchidos
    if (!wasCompleted && row && !canCompleteSeries(row, isCardio)) {
      setInvalidSeries((prev) => new Set(prev).add(seriesKey(workoutId, index)));
      showNotice({
        kind: "warn",
        title: t("goals_series_incomplete_title"),
        desc: isCardio
          ? t("goals_series_incomplete_cardio")
          : t("goals_series_incomplete_desc"),
      });
      return;
    }

    setWorkoutSeries((prev) => ({
      ...prev,
      [workoutId]: (prev[workoutId] ?? []).map((s, i) =>
        i === index ? { ...s, completed: !s.completed } : s,
      ),
    }));
    if (!wasCompleted) {
      const kind = setKindOf(row);
      // Descanso depende do que vem A SEGUIR, não só do que acabou:
      //  - próxima linha é um drop  → emenda, sem descanso nenhum;
      //  - a série atual é aquecimento → descanso curto (a rampa não pede pausa cheia);
      //  - bloco de bi-set/tri-set com a rodada incompleta → sem descanso, o
      //    usuário vai direto para o outro exercício do bloco. A pausa é uma só,
      //    quando a rodada inteira fecha.
      const nextIsDrop = setKindOf(workoutSeries[workoutId]?.[index + 1]) === "drop";
      const holdsRest = nextIsDrop || blockRoundPending(workoutId, index);
      if (!holdsRest) {
        // Num bloco o descanso é do BLOCO, não de quem calhou de ser marcado por
        // último: ancora sempre no primeiro membro, que é onde o preset
        // compartilhado é editado.
        const bInfo = blockInfo.get(workoutId);
        const restAnchor = bInfo ? (blocks.get(bInfo.group) ?? [workoutId])[0] : workoutId;
        startRestTimer(restAnchor, kind === "warmup" ? WARMUP_REST_SECS : undefined);
      }

      // PR em tempo real — ao concluir uma série de força com peso acima do
      // melhor peso anterior, avisa que o usuário bateu o recorde.
      const kg = row?.kg || 0;
      if (!isCardio && kg > 0 && isWorkingSet(kind)) {
        // Baseline: na primeira série concluída do exercício, parte do maior
        // "anterior" (prevKg da última sessão, o mesmo valor exibido na coluna
        // ANTERIOR). Nas próximas, usa o recorde corrente já elevado.
        let best = prevBestRef.current.get(workoutId);
        if (best == null) {
          best = (workoutSeries[workoutId] ?? [])
            .filter((s) => isWorkingSet(s.kind))
            .reduce((m, s) => Math.max(m, (s as any).prevKg || 0), 0);
          prevBestRef.current.set(workoutId, best);
        }
        const name = allItems.find((i) => i.workout_id === workoutId)?.workoutName ?? "";
        // "Zerou a máquina?" — série completa acima de 120kg convida a marcar o
        // exercício como máquina zerada. Tem prioridade sobre o aviso de PR (é o
        // flex maior) e não reaparece depois de o exercício já estar marcado.
        if (kg > MACHINE_MAXED_KG && !maxedExerciseIds.includes(workoutId)) {
          showMachinePrompt({ workoutId, name, kg });
        } else if (best > 0 && kg > best) {
          showNotice({
            kind: "pr",
            title: t("goals_pr_toast_title"),
            desc: t("goals_pr_toast_desc")
              .replace("{exercise}", name)
              .replace("{kg}", String(kg))
              .replace("{prev}", String(best)),
          });
        }
        // Sobe o recorde corrente para não repetir o aviso em séries
        // iguais/menores; só dispara de novo se superar este novo valor.
        if (kg > best) prevBestRef.current.set(workoutId, kg);
      }
    } else {
      // Desmarcou uma série concluída. Se o exercício ficou SEM nenhuma série
      // concluída, ele deixa de estar "concluído" e perde o selo de máquina
      // zerada (a única forma de remover a marca, já que o selo não é tocável).
      if (maxedExerciseIds.includes(workoutId)) {
        const stillCompleted = (workoutSeries[workoutId] ?? []).some(
          (s, i) => i !== index && s.completed && isWorkingSet(s.kind),
        );
        if (!stillCompleted) {
          setMaxedExerciseIds((prev) => prev.filter((x) => x !== workoutId));
        }
      }
    }
  };

  // ── Finalizar ───────────────────────────────────────────────

  // Sem nenhuma série concluída o resumo nasceria zerado (volume 0, nenhum
  // exercício), então o botão de finalizar continua desabilitado. O aquecimento
  // concluído já habilita: ele conta como série feita em todo o resto da tela.
  const hasCompletedSeries = Object.values(workoutSeries).some((list) =>
    list.some((s) => s.completed && countsAsSeries(setKindOf(s))),
  );

  const handleFinishClick = () => {
    setSaveError(null);
    setConfirmOpen(true);
  };

  const handleConfirmFinish = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      let totalSeries = 0;
      let totalVolume = 0;
      const allItemsForSave = [...items, ...workoutExtraItems];
      // Rotina desta sessão. Exercícios AVULSOS (adicionados durante o treino)
      // não têm linha em user_workouts, então gravam `user_workout_id` nulo —
      // sem este fallback o `routine_id` também ficaria nulo e a série viraria
      // histórico sem vínculo nenhum, que apagar a rotina nunca alcança.
      const sessionRoutineId = items.find((i) => i.routine_id)?.routine_id ?? null;
      const completedExercises: WorkoutSessionSummary["completedExercises"] = [];
      const prExercises: WorkoutSessionSummary["prExercises"] = [];
      const machinedExercises: WorkoutSessionSummary["machinedExercises"] = [];

      // Collect exercises with completed series
      const exerciseEntries = Object.entries(workoutSeries).filter(
        ([, series]) => series.some((s) => s.completed),
      );

      // Carimbo desta finalização: todas as séries gravadas agora recebem um
      // date_completed na mesma rajada (base + índice em ms), formando UMA
      // sessão bem agrupada. Mantém a ordem das séries (timestamps crescentes)
      // e permite que getLastWorkoutSessionSeriesDb isole exatamente a contagem
      // de séries desta execução — nunca a soma de execuções anteriores.
      const sessionBaseMs = Date.now();
      let seriesSaveIndex = 0;

      // Query previous bests before saving (so we compare against pre-session records).
      // Offline, getPreviousBestKgDb devolveria 0 e TODO exercício com carga
      // viraria um falso PR — sem rede, a detecção de PR all-time é pulada
      // (o aviso de PR em tempo real, baseado na coluna ANTERIOR, segue normal).
      const netStatus = getNetworkStatus();
      const canDetectAllTimePR = netStatus.isOnline && netStatus.isSupabaseReachable;
      const prevBests = new Map<string, number>();
      // Modo expert: além da carga máxima, precisa do 1RM estimado e do melhor
      // nº de reps por carga, então lê o histórico do exercício (uma consulta).
      // O simplificado continua com a consulta barata de 1 linha.
      const prevRecords = new Map<string, ExercisePersonalRecords>();
      if (canDetectAllTimePR) {
        await Promise.all(
          exerciseEntries.map(async ([workoutId]) => {
            const row = allItemsForSave.find((w) => w.workout_id === workoutId);
            const isCardio = isCardioExercise(row?.muscle_group, workoutId);
            if (isCardio) return;
            if (isExpert) {
              const rec = await getExercisePersonalRecordsDb(userId, workoutId).catch(
                () => ({ bestKg: 0, bestE1rm: 0, repsByKg: {} } as ExercisePersonalRecords),
              );
              prevRecords.set(workoutId, rec);
              prevBests.set(workoutId, rec.bestKg);
            } else {
              const prev = await getPreviousBestKgDb(userId, workoutId).catch(() => 0);
              prevBests.set(workoutId, prev);
            }
          }),
        );
      }

      for (const [workoutId, series] of exerciseEntries) {
        const completed = series.filter((s) => s.completed);

        const row = allItemsForSave.find((w) => w.workout_id === workoutId);
        const isCardio = isCardioExercise(row?.muscle_group, workoutId);
        const isExtra = workoutExtraItems.some((e) => e.workout_id === workoutId);
        const rawId = isExtra ? null : (row?.id ?? null);
        const userWorkoutId: number | null = rawId && !isNaN(Number(rawId)) ? Number(rawId) : null;

        // Séries de MARCA: as que podem virar recorde. O aquecimento fica fora
        // daqui (uma rampa leve não é desempenho) — mas entra normalmente em
        // volume, contagem e resumo, como qualquer série executada.
        const workingSets = completed.filter((s) => isWorkingSet(s.kind));

        // Carga máxima exibida no resumo — sobre TUDO que foi levantado, para o
        // exercício que só teve aquecimento não aparecer com 0kg.
        let bestKg = 0;
        // Carga máxima para efeito de RECORDE — só séries de trabalho, senão um
        // treino só de aquecimento poderia registrar um PR falso.
        let bestWorkingKg = 0;
        for (const serie of completed) {
          const kind = setKindOf(serie);
          // Volume e carga máxima incluem aquecimento e drop — é peso levantado
          // de verdade.
          if (!isCardio) {
            totalVolume += (serie.kg || 0) * (serie.reps || 0);
            bestKg = Math.max(bestKg, serie.kg || 0);
            if (isWorkingSet(kind)) bestWorkingKg = Math.max(bestWorkingKg, serie.kg || 0);
          }
          // Já a CONTAGEM de séries não conta o drop: ele pertence à série de cima.
          if (countsAsSeries(kind)) totalSeries++;
          await saveWorkoutHistoryDb(
            userId, userWorkoutId, workoutId,
            serie.kg || null,
            isCardio
              ? (serie.reps ? String(serie.reps) : null)
              : (serie.reps ? `${serie.reps} reps` : null),
            row?.routine_id ?? sessionRoutineId,
            new Date(sessionBaseMs + seriesSaveIndex++).toISOString(),
            // Só o modo expert classifica séries; no simplificado vai NULL e a
            // leitura trata como 'normal'.
            isExpert ? kind : null,
          );
        }

        // Sem nenhuma série concluída não há o que reportar. O exercício que só
        // teve aquecimento ENTRA no resumo: a série foi feita e já está contada
        // no cabeçalho, então sumir daqui abriria um buraco entre os dois.
        if (completed.length === 0) continue;

        completedExercises.push({
          name: row?.workoutName ?? workoutId,
          // "4 séries" no resumo = séries contadas (aquecimento incluído, drops
          // fora — o peso deles já está no volume e nos `sets` abaixo).
          totalSets: completed.filter((s) => countsAsSeries(setKindOf(s))).length,
          bestKg,
          muscleGroup: row?.muscle_group ?? null,
          photo: row?.workoutPhoto ?? null,
          sets: completed.map((s) => ({ kg: s.kg || 0, reps: s.reps || 0 })),
          isCardio,
        });

        const exerciseName = row?.workoutName ?? workoutId;

        // PR all-time — exige rede (compara com o histórico do banco). Usa a
        // carga das séries de TRABALHO: o histórico do banco também é lido sem
        // aquecimento (WORKING_SETS_FILTER), então comparar com `bestKg` (que
        // inclui a rampa) misturaria duas réguas diferentes.
        if (!isCardio && bestWorkingKg > 0 && canDetectAllTimePR) {
          const prev = prevBests.get(workoutId) ?? 0;
          const beatWeight = bestWorkingKg > prev;

          if (!isExpert) {
            // Simplificado: só carga máxima, exatamente como antes.
            if (beatWeight) {
              prExercises.push({ name: exerciseName, previousBestKg: prev, newBestKg: bestWorkingKg });
            }
          } else {
            // Expert: UM recorde por exercício, o mais expressivo. Emitir os
            // três juntos encheria o banner com a mesma conquista repetida —
            // bater carga quase sempre bate o e1RM também.
            const rec = prevRecords.get(workoutId) ?? { bestKg: 0, bestE1rm: 0, repsByKg: {} };
            const bestE1rm = workingSets.reduce(
              (m, s) => Math.max(m, estimateOneRepMax(s.kg || 0, s.reps || 0)),
              0,
            );
            // Melhor série de hoje EM CADA carga, para o recorde de repetições.
            const todayRepsByKg = new Map<number, number>();
            for (const s of workingSets) {
              const kg = s.kg || 0;
              const reps = s.reps || 0;
              if (kg > 0 && reps > 0 && reps > (todayRepsByKg.get(kg) ?? 0)) {
                todayRepsByKg.set(kg, reps);
              }
            }
            // Só conta como recorde de reps quando JÁ existe marca naquela
            // carga: a primeira vez em um peso novo não é "mais repetições",
            // é estreia (e o recorde de carga/e1RM já cobre esse caso).
            let repsPr: { kg: number; prevReps: number; newReps: number } | null = null;
            for (const [kg, reps] of todayRepsByKg) {
              const prevReps = rec.repsByKg[String(kg)] ?? 0;
              if (prevReps > 0 && reps > prevReps) {
                if (!repsPr || kg > repsPr.kg) repsPr = { kg, prevReps, newReps: reps };
              }
            }

            if (beatWeight) {
              prExercises.push({
                name: exerciseName, kind: "weight",
                previousBestKg: prev, newBestKg: bestWorkingKg,
              });
            } else if (beatsE1rm(bestE1rm, rec.bestE1rm)) {
              prExercises.push({
                name: exerciseName, kind: "e1rm",
                // previousBestKg = 0 esconde o riscado de carga (que não mudou)
                // e mantém este PR fora do cálculo de "% de superação" do card
                // compartilhável, que só faz sentido para carga.
                previousBestKg: 0, newBestKg: bestWorkingKg,
                previousE1rm: roundE1rm(rec.bestE1rm), newE1rm: roundE1rm(bestE1rm),
              });
            } else if (repsPr) {
              prExercises.push({
                name: exerciseName, kind: "reps",
                previousBestKg: 0, newBestKg: repsPr.kg,
                previousReps: repsPr.prevReps, newReps: repsPr.newReps,
              });
            }
          }
        }

        // "Máquina zerada" — o usuário confirmou (via prompt ao levantar >120kg)
        // que zerou a máquina neste exercício. Entra no resumo com a maior carga
        // registrada. Marcação em maxedExerciseIds (contexto, persistido).
        if (!isCardio && bestKg > 0 && maxedExerciseIds.includes(workoutId)) {
          machinedExercises.push({ name: exerciseName, kg: bestKg });
        }
      }

      // Persiste as notas dos exercícios (user_workouts.notes) antes de limpar o
      // estado — sem isto a nota digitada na sessão era perdida ao finalizar.
      const sessionWorkoutIds = new Set(allItemsForSave.map((w) => w.workout_id));
      await Promise.all(
        Object.entries(workoutExerciseNotes)
          .filter(([workoutId]) => sessionWorkoutIds.has(workoutId))
          .map(([workoutId, noteVal]) =>
            updateUserWorkoutNotesDb(userId, workoutId, routineId, (noteVal ?? "").trim() || null)
              .catch((e) => console.error("note save failed", e)),
          ),
      );

      // Persiste o tempo de descanso por exercício (user_workouts.time_to_rest):
      // se o usuário aumentou/alterou o descanso via o ícone, a preferência passa
      // a valer nos próximos treinos. Best-effort — não derruba a finalização.
      await Promise.all(
        Object.entries(workoutExerciseRestTimes)
          .filter(([workoutId]) => sessionWorkoutIds.has(workoutId))
          .map(([workoutId, secs]) =>
            updateUserWorkoutRestDb(userId, workoutId, routineId, secs)
              .catch((e) => console.error("rest save failed", e)),
          ),
      );

      setConfirmOpen(false);
      // Corrida GPS ainda ativa não pode sobreviver ao fim do treino (o watch
      // de localização vazaria) — encerra sem registrar, no-op quando idle.
      void stopRun();
      resetWorkoutState();
      onFinished({
        totalSeries,
        totalVolume: Math.round(totalVolume * 10) / 10,
        durationSecs: workoutDuration,
        completedExercises,
        prExercises,
        machinedExercises,
        run: lastRunRef.current,
      });
      lastRunRef.current = null;
    } catch (err: any) {
      setSaveError(err?.message || t("goals_create_error_retry"));
    } finally {
      setIsSaving(false);
    }
  };

  if (!open) return null;

  // ── Catálogo filtrado para o picker ────────────────────────
  // Grupos musculares do catálogo (para a aba "Músculo")
  const pickerMuscleGroups = [
    ...new Set(catalog.map((w) => w.muscle_group).filter(Boolean) as string[]),
  ].sort((a, b) => a.localeCompare(b));
  const catalogMatches = catalog.filter((w) => {
    if (pickerBrowseMode === "group" && pickerMuscleFilter && w.muscle_group !== pickerMuscleFilter) return false;
    if (!matchesCatalogSearch(w, pickerSearch)) return false;
    return true;
  });
  /**
   * Lista do picker com as variações COLAPSADAS: 13 supinos viram uma linha
   * "Supino". A variação é decisão da academia, não do momento de montar a
   * rotina — quem escolhe o grupo leva a variação padrão e troca no treino.
   *
   * Durante uma BUSCA não colapsa: quem digitou "halteres" está sendo
   * específico, e esconder o resultado exato atrás do nome do movimento seria
   * responder outra pergunta.
   */
  const isSearching = pickerSearch.trim().length > 0;
  const catalogFiltered = isSearching
    ? catalogMatches
    : (() => {
        const seenGroups = new Set<string>();
        const out: Workout[] = [];
        for (const w of catalogMatches) {
          if (!w.groupId || !groupById.has(w.groupId)) { out.push(w); continue; }
          if (seenGroups.has(w.groupId)) continue;
          seenGroups.add(w.groupId);
          // Representante do grupo: a variação padrão, se ela sobreviveu ao
          // filtro; senão a primeira que apareceu.
          const def = groupById.get(w.groupId)!.defaultWorkoutId;
          out.push(catalogMatches.find((x) => x.id === def && x.groupId === w.groupId) ?? w);
        }
        return out;
      })();
  /** Quantas variações o grupo deste exercício tem (0 = não é grupo). */
  const variationCountOf = (w: Workout): number =>
    !isSearching && w.groupId && groupById.has(w.groupId) ? variationsOf(w.groupId).length : 0;

  /**
   * Card de um bloco de bi-set/tri-set — os exercícios LADO A LADO.
   *
   * Por que não são os cards normais empilhados: num bi-set os exercícios são
   * executados em seguida, sem descanso no meio, e o usuário anota os dois na
   * mesma ida ao aparelho. Com um card embaixo do outro ele preenche A1, rola a
   * tela, preenche A2 e perde a noção da rodada. Aqui a linha é a RODADA e cada
   * coluna é um exercício, que é como o bloco acontece de verdade.
   *
   * A grade rola na horizontal quando não cabe (tri-set em tela estreita) — a
   * coluna do número da rodada fica fixa fora da área rolável, para o usuário
   * nunca perder a referência de qual rodada está preenchendo.
   */
  const renderBlockCard = (group: string, members: UserWorkoutWithDetails[]) => {
    const ids = members.map((m) => m.workout_id);
    const letter = String.fromCharCode(65 + [...blocks.keys()].indexOf(group));
    // Rodadas = maior lista entre os membros (o efeito de padding já igualou;
    // isto cobre o frame anterior à igualação).
    const rounds = Math.max(1, ...ids.map((id) => (workoutSeries[id] ?? []).length));
    // O bloco está aberto se QUALQUER membro é o exercício expandido.
    const isExpanded = ids.some((id) => id === expandedId);
    const restSecs = restSecsFor(ids[0]);
    const doneRounds = Array.from({ length: rounds }, (_, r) =>
      ids.every((id) => workoutSeries[id]?.[r]?.completed),
    ).filter(Boolean).length;
    const isTriset = members.some((m) => m.technique === "triset");
    // Larguras: 2 colunas cabem numa tela de iPhone; 3 estouram e a grade rola.
    const colWidth = isTriset ? 132 : 150;

    return (
      <div
        key={`block:${group}`}
        style={{
          background: CARD, borderRadius: 24, overflow: "hidden",
          marginBottom: 20, position: "relative",
          borderLeft: "3px solid #c084fc",
          border: `1px solid ${BORDER}`,
          backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
          boxShadow: "0 8px 32px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        {/* ── CABEÇALHO DO BLOCO ───────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px 0" }}>
          <button
            onClick={() => setTechniqueInfo({
              technique: isTriset ? "triset" : "biset",
              members: members.map((m) => m.workoutName ?? "").filter(Boolean),
            })}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              fontSize: 11, fontWeight: 800, color: "#c084fc",
              background: "rgba(192,132,252,0.14)",
              border: "1px solid rgba(192,132,252,0.45)",
              borderRadius: 20, padding: "3px 10px", flexShrink: 0,
              whiteSpace: "nowrap", cursor: "pointer", fontFamily: "'Inter', system-ui",
            }}
          >
            {letter} · {t(isTriset ? "goals_technique_triset" : "goals_technique_biset")}
            <span style={{ opacity: 0.75, fontWeight: 700 }}>?</span>
          </button>
          <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 600, color: MUTED_FG }}>
            {doneRounds}/{rounds}
          </span>
        </div>

        {/* Barra abrir/fechar — mesma gramática dos cards normais */}
        <button
          onClick={() => setExpandedId(isExpanded ? null : ids[0])}
          style={{
            width: "100%", background: "none", border: "none",
            borderTop: `1px solid ${BORDER}`, borderBottom: isExpanded ? `1px solid ${BORDER}` : "none",
            cursor: "pointer", marginTop: 10,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "11px 16px",
          }}
        >
          <span style={{
            fontWeight: 700, fontSize: 13, color: isExpanded ? PRIMARY : FG,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            textAlign: "left", flex: 1, marginRight: 8,
          }}>
            {members.map((m) => m.workoutName).filter(Boolean).join("  +  ")}
          </span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
            style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>
            <path d="M3 5l4 4 4-4" stroke={isExpanded ? PRIMARY : MUTED_FG} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {isExpanded && (
          <>
            {/* Descanso compartilhado — um preset só, espelhado nos membros */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 16px", borderBottom: `1px solid ${BORDER}`,
            }}>
              <button
                onClick={() => {
                  const idx = REST_PRESETS.indexOf(restSecs);
                  setBlockRest(ids, REST_PRESETS[(idx + 1) % REST_PRESETS.length]);
                }}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 5, padding: 0, opacity: 0.75,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5.5" stroke={MUTED_FG} strokeWidth="1.3"/>
                  <path d="M7 4v3.5l2 1.5" stroke={MUTED_FG} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: MUTED_FG }}>
                  {t("goals_block_shared_rest")}: {fmtRest(restSecs)}
                </span>
              </button>
              <button
                onClick={() => { for (const id of ids) removeFromSession(id); }}
                style={{
                  marginLeft: "auto", background: "none", border: "none", cursor: "pointer",
                  padding: 0, fontSize: 12, fontWeight: 600, color: "hsl(var(--destructive))",
                  opacity: 0.8, fontFamily: "'Inter', system-ui",
                }}
              >
                {t("goals_block_remove_exercises")}
              </button>
            </div>

            <p style={{
              margin: 0, padding: "8px 16px 0",
              fontSize: 11, color: MUTED_FG, opacity: 0.75, lineHeight: 1.35,
            }}>
              {t("goals_block_hint")}
            </p>

            {/* ── GRADE: linha = rodada, coluna = exercício ── */}
            <div style={{ display: "flex", padding: "8px 12px 4px", gap: 6 }}>
              {/* Coluna fixa do número da rodada (fora do scroll horizontal) */}
              <div style={{ flexShrink: 0, width: 30 }}>
                <div style={{ height: 34 }} />
                {Array.from({ length: rounds }, (_, r) => (
                  <div key={r} style={{
                    height: 40, marginBottom: 7,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: "50%",
                      background: ids.every((id) => workoutSeries[id]?.[r]?.completed) ? PRIMARY : SURFACE,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 800,
                      color: ids.every((id) => workoutSeries[id]?.[r]?.completed) ? PRIMARY_FG : MUTED_FG,
                    }}>
                      {r + 1}
                    </div>
                  </div>
                ))}
              </div>

              {/* Colunas dos exercícios — rolam juntas quando não cabem */}
              <div style={{ flex: 1, overflowX: "auto", overflowY: "hidden" }}>
                <div style={{ display: "flex", gap: 6, minWidth: "min-content" }}>
                  {members.map((m, mi) => {
                    const list = workoutSeries[m.workout_id] ?? [];
                    const isCardio = isCardioExercise(m.muscle_group, m.workout_id);
                    return (
                      <div key={m.workout_id} style={{ width: colWidth, flexShrink: 0 }}>
                        {/* Cabeçalho da coluna: A1/A2 + nome + ⓘ */}
                        <button
                          onClick={() => setInfoExerciseId(m.workout_id)}
                          style={{
                            width: "100%", height: 34, background: "none", border: "none",
                            padding: 0, cursor: "pointer", display: "flex",
                            alignItems: "center", gap: 4, overflow: "hidden",
                          }}
                        >
                          <span style={{
                            fontSize: 10, fontWeight: 800, color: "#c084fc",
                            background: "rgba(192,132,252,0.14)", borderRadius: 6,
                            padding: "1px 5px", flexShrink: 0,
                          }}>
                            {letter}{mi + 1}
                          </span>
                          <span style={{
                            fontSize: 11, fontWeight: 700, color: FG,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            textAlign: "left",
                          }}>
                            {m.workoutName}
                          </span>
                        </button>

                        {Array.from({ length: rounds }, (_, r) => {
                          const row = list[r] ?? { kg: 0, reps: 0, completed: false };
                          const prevKg = (row as any).prevKg ?? 0;
                          const locked = !row.completed && !canCompleteSeries(row, isCardio);
                          const invalid = invalidSeries.has(seriesKey(m.workout_id, r));
                          return (
                            <div key={r} style={{
                              display: "flex", alignItems: "center", gap: 4,
                              height: 40, marginBottom: 7,
                              background: "rgba(255,255,255,0.04)", borderRadius: 10,
                              padding: "0 4px",
                            }}>
                              <input
                                type="text"
                                inputMode="decimal"
                                aria-label={`${m.workoutName} — ${isCardio ? "MIN" : "KG"}`}
                                value={
                                  editingCell?.key === `${m.workout_id}:${r}:kg`
                                    ? editingCell.text
                                    : (row.kg || "")
                                }
                                // O "anterior" vira placeholder: não há espaço para
                                // uma coluna própria aqui, mas a referência da última
                                // sessão é o que o usuário consulta antes de digitar.
                                placeholder={prevKg > 0 ? String(prevKg) : "—"}
                                onChange={(e) => handleSeriesInput(m.workout_id, r, "kg", e.target.value, isCardio)}
                                onBlur={() => setEditingCell(null)}
                                style={{
                                  flex: 1, minWidth: 0, background: SURFACE,
                                  border: "1.5px solid transparent", borderRadius: 8,
                                  height: 32, textAlign: "center",
                                  fontWeight: 700, fontSize: 14, color: FG,
                                  padding: "0 2px", boxSizing: "border-box" as const,
                                  WebkitAppearance: "none" as any,
                                  fontFamily: "'Inter', system-ui",
                                }}
                              />
                              <input
                                type="text"
                                inputMode={isCardio ? "decimal" : "numeric"}
                                aria-label={`${m.workoutName} — ${isCardio ? "KM" : "REPS"}`}
                                value={
                                  editingCell?.key === `${m.workout_id}:${r}:reps`
                                    ? editingCell.text
                                    : (row.reps || "")
                                }
                                placeholder={invalid ? "!" : "—"}
                                onChange={(e) => handleSeriesInput(m.workout_id, r, "reps", e.target.value, isCardio)}
                                onBlur={() => setEditingCell(null)}
                                style={{
                                  flex: 1, minWidth: 0,
                                  background: invalid ? "hsl(var(--destructive) / 0.12)" : SURFACE,
                                  border: invalid ? "1.5px solid hsl(var(--destructive))" : "1.5px solid transparent",
                                  borderRadius: 8, height: 32, textAlign: "center",
                                  fontWeight: 700, fontSize: 14, color: FG,
                                  padding: "0 2px", boxSizing: "border-box" as const,
                                  WebkitAppearance: "none" as any,
                                  fontFamily: "'Inter', system-ui",
                                }}
                              />
                              <button
                                onClick={() => toggleCompleted(m.workout_id, r, isCardio)}
                                aria-label={t("goals_session_mark_done")}
                                aria-disabled={locked}
                                style={{
                                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                                  background: row.completed ? PRIMARY : SURFACE,
                                  border: row.completed ? "none" : `2px solid ${locked ? MUTED_FG : PRIMARY}`,
                                  cursor: locked ? "not-allowed" : "pointer",
                                  opacity: locked ? 0.45 : 1,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  transition: "background 0.15s, border-color 0.15s",
                                }}
                              >
                                {row.completed && (
                                  <svg width="11" height="9" viewBox="0 0 13 10" fill="none">
                                    <path d="M1.5 5L5 8.5L11.5 1.5" stroke={PRIMARY_FG} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Rodada entra e sai para o bloco inteiro */}
            <div style={{ display: "flex", gap: 8, padding: "0 12px 12px" }}>
              <button
                onClick={() => addBlockRound(ids)}
                style={{
                  flex: 1, background: "transparent",
                  border: `2px dashed ${BORDER}`, borderRadius: 12, padding: "10px 0",
                  cursor: "pointer", fontWeight: 600, fontSize: 13, color: MUTED_FG,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                <span style={{ fontSize: 16, lineHeight: 1, opacity: 0.6 }}>+</span>
                {t("goals_block_add_round")}
              </button>
              {rounds > 1 && (
                <button
                  onClick={() => removeBlockRound(ids, rounds - 1)}
                  aria-label={t("goals_block_remove_round")}
                  style={{
                    width: 44, background: "transparent",
                    border: `2px dashed ${BORDER}`, borderRadius: 12,
                    cursor: "pointer", color: MUTED_FG,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M5 12h14"/>
                  </svg>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  const content = (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", flexDirection: "column",
        background: GLASS_ROOT_BG, fontFamily: "'Inter', system-ui, sans-serif",
        color: FG, overflow: "hidden",
      }}
      onClick={() => { if (menuId) setMenuId(null); }}
    >

      {/* ── AURAS DE FUNDO (liquid glass) ────────────────────── */}
      <div style={{
        pointerEvents: "none", position: "absolute", zIndex: -1,
        width: 340, height: 340, left: -60, top: 40, borderRadius: "50%",
        background: "radial-gradient(circle,#ff7a3c,transparent 70%)",
        filter: "blur(80px)", opacity: 0.28,
      }} />
      <div style={{
        pointerEvents: "none", position: "absolute", zIndex: -1,
        width: 320, height: 320, right: -80, top: 360, borderRadius: "50%",
        background: "radial-gradient(circle,#3f7fe6,transparent 70%)",
        filter: "blur(80px)", opacity: 0.26,
      }} />
      <div style={{
        pointerEvents: "none", position: "absolute", zIndex: -1,
        width: 300, height: 300, left: "30%", bottom: -120, borderRadius: "50%",
        background: "radial-gradient(circle,#9d6bff,transparent 70%)",
        filter: "blur(80px)", opacity: 0.22,
      }} />

      <style>{`@keyframes prToastIn{from{opacity:0;transform:translateY(-12px) scale(0.96)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>

      {/* ── AVISO DA SESSÃO (PR/recorde ou validação) ────────── */}
      {notice && (() => {
        const isPr = notice.kind === "pr";
        const accent = isPr ? ORANGE : "hsl(var(--destructive))";
        const tintBg = isPr ? "rgba(30,22,14,0.82)" : "rgba(34,16,16,0.82)";
        return (
          <div
            style={{
              position: "absolute", zIndex: 60,
              top: "max(56px, calc(env(safe-area-inset-top) + 8px))",
              left: 12, right: 12,
              display: "flex", justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <div
              onClick={() => setNotice(null)}
              style={{
                pointerEvents: "auto", cursor: "pointer",
                maxWidth: 420, width: "100%",
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px", borderRadius: 18,
                background: tintBg,
                border: `1px solid ${accent}66`,
                backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
                boxShadow: `0 12px 36px rgba(0,0,0,0.45), 0 0 0 1px ${accent}22, inset 0 1px 0 rgba(255,255,255,0.08)`,
                animation: "prToastIn 0.3s cubic-bezier(0.2,0.8,0.2,1)",
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                background: `${accent}26`, display: "flex",
                alignItems: "center", justifyContent: "center", fontSize: 20,
              }}>
                {isPr ? "🏆" : "⚠️"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: accent, lineHeight: 1.2 }}>
                  {notice.title}
                </div>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.82)",
                  marginTop: 2, lineHeight: 1.3,
                }}>
                  {notice.desc}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── "Zerou a máquina?" — prompt interativo (série > 120kg) ─── */}
      {machinePrompt && (
        <div
          style={{
            position: "absolute", zIndex: 61,
            top: "max(56px, calc(env(safe-area-inset-top) + 8px))",
            left: 12, right: 12,
            display: "flex", justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              pointerEvents: "auto",
              maxWidth: 420, width: "100%",
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 14px", borderRadius: 18,
              background: "rgba(30,24,6,0.9)",
              border: "1px solid rgba(234,179,8,0.5)",
              backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
              boxShadow: "0 12px 36px rgba(0,0,0,0.45), 0 0 0 1px rgba(234,179,8,0.18), inset 0 1px 0 rgba(255,255,255,0.08)",
              animation: "prToastIn 0.3s cubic-bezier(0.2,0.8,0.2,1)",
            }}
          >
            <div style={{
              width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
              background: "rgba(234,179,8,0.22)", display: "flex",
              alignItems: "center", justifyContent: "center", fontSize: 20,
            }}>
              ⚡
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#eab308", lineHeight: 1.2 }}>
                {t("goals_machine_prompt_title")}
              </div>
              <div style={{
                fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.82)",
                marginTop: 2, lineHeight: 1.3,
              }}>
                {t("goals_machine_prompt_desc")
                  .replace("{exercise}", machinePrompt.name)
                  .replace("{kg}", String(machinePrompt.kg))}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
              <button
                onClick={confirmMachineMaxed}
                style={{
                  padding: "8px 14px", borderRadius: 12, border: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: 800, color: "#000", background: "#eab308",
                  whiteSpace: "nowrap",
                }}
              >
                {t("goals_machine_prompt_confirm")}
              </button>
              <button
                onClick={dismissMachinePrompt}
                style={{
                  padding: "3px 10px", borderRadius: 10, border: "none", cursor: "pointer",
                  fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.6)",
                  background: "transparent", whiteSpace: "nowrap",
                }}
              >
                {t("goals_machine_prompt_dismiss")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ───────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        paddingTop: "max(48px, env(safe-area-inset-top))",
        paddingLeft: "max(16px, env(safe-area-inset-left))",
        paddingRight: "max(16px, env(safe-area-inset-right))",
        paddingBottom: 6,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <button
          onClick={onMinimize}
          aria-label={t("goals_minimize")}
          style={{
            width: 36, height: 36, borderRadius: "50%",
            background: SURFACE,
            border: "none", cursor: "pointer", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 6l5 5 5-5" stroke={FG} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div style={{
          flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
          alignItems: "center", gap: 2,
        }}>
          <div style={{
            maxWidth: "100%",
            fontWeight: 700, fontSize: 17, color: FG,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {routineLabel}
          </div>
          {/* Selo do modo: a rotina expert se comporta de forma diferente
              (séries tipadas, aquecimento fora do PR/progressão), então o
              usuário precisa saber em qual tela está. */}
          {isExpert && (
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: 0.8,
              textTransform: "uppercase",
              color: "#9dbaff", background: "rgba(91,140,255,0.16)",
              border: "1px solid rgba(91,140,255,0.4)",
              borderRadius: 20, padding: "1px 8px", lineHeight: 1.6,
            }}>
              {t("goals_mode_expert")}
            </span>
          )}
        </div>

        <button
          onClick={handleFinishClick}
          aria-label={t("goals_session_finish")}
          style={{
            width: 36, height: 36, borderRadius: "50%",
            background: ORANGE, border: "none", cursor: "pointer", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <rect x="1" y="1" width="4" height="11" rx="1.5" fill="white"/>
            <rect x="8" y="1" width="4" height="11" rx="1.5" fill="white"/>
          </svg>
        </button>
      </div>

      {/* ── STATS ROW ────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        padding: "4px 16px 12px",
        display: "flex", alignItems: "flex-start",
        borderBottom: `1px solid ${BORDER}`,
      }}>
        {[
          { label: "Duração",    value: fmtDur(workoutDuration), color: PRIMARY },
          { label: "Volume",     value: `${stats.volume} kg`,    color: FG },
          { label: "Séries",     value: String(stats.totalDone), color: FG },
          { label: "Exercícios", value: String(stats.doneEx),    color: FG },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: MUTED_FG, fontWeight: 500, marginBottom: 3 }}>
              {label}
            </div>
            <div style={{
              fontSize: 17, fontWeight: 800, color,
              fontVariantNumeric: "tabular-nums", lineHeight: 1,
            }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* ── MUSCLE FILTER CHIPS ──────────────────────────────── */}
      {muscleGroups.length > 0 && (
        <div style={{
          flexShrink: 0,
          padding: "10px 12px",
          display: "flex", alignItems: "center", gap: 8,
          // Chips quebram para a próxima linha em vez de rolar lateralmente —
          // a tela só deve ter scroll vertical (no iPhone o scroll horizontal aqui
          // competia com o scroll vertical da lista de exercícios).
          flexWrap: "wrap", overflowX: "hidden", borderBottom: `1px solid ${BORDER}`,
        }}>
          <button
            onClick={() => {
              setSearchOpen((v) => {
                const next = !v;
                if (!next) setItemSearch("");
                return next;
              });
            }}
            aria-label={t("goals_search_exercise")}
            style={{
              width: 32, height: 32, borderRadius: "50%",
              border: `1.5px solid ${searchOpen ? PRIMARY : BORDER}`,
              background: searchOpen ? PRIMARY : "transparent",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="5.5" cy="5.5" r="4" stroke={searchOpen ? PRIMARY_FG : MUTED_FG} strokeWidth="1.5"/>
              <path d="m8.5 8.5 2.5 2.5" stroke={searchOpen ? PRIMARY_FG : MUTED_FG} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>

          {searchOpen ? (
            <input
              type="text"
              autoFocus
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              placeholder={t("goals_search_exercise")}
              style={{
                flex: 1, minWidth: 0, height: 32,
                background: SURFACE, border: `1px solid ${BORDER}`,
                borderRadius: 20, padding: "0 14px",
                fontSize: 13, fontWeight: 600, color: FG,
                outline: "none", fontFamily: "'Inter', system-ui",
              }}
            />
          ) : (
            <>
              <button
                onClick={() => setMuscleFilter(null)}
                style={{
                  background: muscleFilter === null ? PRIMARY : SURFACE,
                  border: "none", borderRadius: 20,
                  padding: "6px 14px", fontSize: 13, fontWeight: 600,
                  color: muscleFilter === null ? PRIMARY_FG : MUTED_FG,
                  cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                }}
              >
                Todos
              </button>

              {muscleGroups.map((group) => (
                <button
                  key={group}
                  onClick={() => setMuscleFilter(group)}
                  style={{
                    background: muscleFilter === group ? PRIMARY : SURFACE,
                    border: "none", borderRadius: 20,
                    padding: "6px 14px", fontSize: 13, fontWeight: 600,
                    color: muscleFilter === group ? PRIMARY_FG : MUTED_FG,
                    cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                  }}
                >
                  {group}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── EXERCISE CARDS ───────────────────────────────────── */}
      <div
        ref={cardsScrollRef}
        style={{
          flex: 1, overflowY: "auto", overflowX: "hidden",
          paddingTop: 12, paddingLeft: 12, paddingRight: 12,
          // Espaço para rolar o último exercício acima do teclado iOS (a var é
          // publicada pelo keyboard.ts; 0px no web/quando fechado). Os 96px são
          // a folga fixa do rodapé "Adicionar exercício".
          paddingBottom: "calc(96px + var(--keyboard-height, 0px))",
        }}
      >
        {renderUnits.map((unit) => {
          // Bi-set/tri-set não é uma sequência de cards, é UM card com os
          // exercícios lado a lado — ver renderBlockCard.
          if (unit.kind === "block") return renderBlockCard(unit.group, unit.members);
          const item = unit.item;
          const series = workoutSeries[item.workout_id] ?? [];
          const isExpanded = expandedId === item.workout_id;
          // "3 de 5 séries" segue `countsAsSeries` — a mesma regra do cabeçalho
          // e da finalização, para o card somar com a barra do topo. Aquecimento
          // entra; drop não (é a continuação da série de cima).
          const countedSeries = series.filter((s) => countsAsSeries(setKindOf(s)));
          const doneSeries = countedSeries.filter((s) => s.completed).length;
          const totalSeriesCount = countedSeries.length;
          // Rótulo por linha: numeração contínua 1,2,3… (drop vira "D")
          const seriesLabels = isExpert ? workingSetLabels(series) : null;
          // Exercício de técnica individual (drop-set / rest-pause) declarada na
          // rotina — o selo lembra o que fazer, o "+ drop" faz acontecer.
          const soloTechnique =
            item.technique === "drop" || item.technique === "rest_pause" ? item.technique : null;
          // Já com o teto do rest-pause aplicado — o que o relógio mostra é o
          // que o cronômetro vai usar.
          const restSecs = restSecsFor(item.workout_id);
          const isRestPause = isExpert && item.technique === "rest_pause";
          const isDropExercise = isExpert && item.technique === "drop";
          // Movimento a que este exercício pertence (Supino, Remada…). Só existe
          // quando o catálogo tem irmãos dele — ver migração 20260812.
          const exerciseGroup = groupOfWorkout(item.workout_id);
          const isCardio = isCardioExercise(item.muscle_group, item.workout_id);
          // Corrida ao Ar Livre: modo GPS estilo Strava — a tabela de séries
          // (MIN×KM manual) fica oculta; quem registra é o painel de corrida.
          const isRunExercise = isOutdoorRun(item.workoutName);
          const noteOpen = noteOpenIds.has(item.workout_id);
          const note = workoutExerciseNotes[item.workout_id] ?? "";
          // Exercício marcado como "máquina zerada" → borda/realce dourado.
          const isMaxed = maxedExerciseIds.includes(item.workout_id);
          // Indicador de progressão de carga (não se aplica a cardio min/km).
          const weightTrend: WeightTrend = isCardio ? "neutral" : computeWeightTrend(series);
          // Rampa de aquecimento: só quando ainda não há aquecimento no
          // exercício e existe carga de trabalho de onde derivar a progressão.
          const hasWarmup = series.some((s) => setKindOf(s) === "warmup");
          // …e só ENQUANTO o exercício não começou. Aquecer é decisão da 1ª
          // série: depois de concluir uma série de trabalho, a rampa deixou de
          // fazer sentido (ela entra ANTES das válidas) e o botão vira ruído
          // repetido a cada série. Cada exercício tem sua própria 1ª série,
          // então a oferta reaparece no exercício seguinte da rotina.
          const exerciseStarted = series.some((s) => s.completed);
          // Dispensado com swipe para a esquerda neste exercício.
          const warmupDismissed = dismissedWarmupIds.includes(item.workout_id);
          const rampPreview =
            isExpert && !isCardio && !isRunExercise && !hasWarmup && !exerciseStarted && !warmupDismissed
              ? buildWarmupSets(workingTargetKg(item.workout_id))
              : [];
          const canRampWarmup = rampPreview.length > 0;

          return (
            <div
              key={item.id}
              style={{
                background: CARD, borderRadius: 24, overflow: "hidden",
                marginBottom: 20,
                position: "relative",
                border: isMaxed ? "1.5px solid #eab308" : `1px solid ${BORDER}`,
                backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
                boxShadow: isMaxed
                  ? "0 8px 32px rgba(0,0,0,0.32), 0 0 0 1px rgba(234,179,8,0.45), 0 0 24px rgba(234,179,8,0.28), inset 0 1px 0 rgba(255,255,255,0.10)"
                  : "0 8px 32px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.08)",
              }}
            >
              {/* ── EXERCISE HEADER ─────────────────────────── */}
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px 0",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Com grupo, o título é o MOVIMENTO ("Supino") e a variação
                      vira um chip tocável logo abaixo — é a variação que muda
                      de treino para treino, não o movimento. */}
                  <span style={{
                    display: "block",
                    fontSize: 13, fontWeight: 700, color: FG,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {exerciseGroup ? exerciseGroup.name : item.workoutName}
                  </span>
                  {exerciseGroup && (
                    <button
                      onClick={() => setVariationPickerId(
                        variationPickerId === item.workout_id ? null : item.workout_id,
                      )}
                      style={{
                        display: "flex", alignItems: "center", gap: 4, marginTop: 2,
                        maxWidth: "100%", background: "none", border: "none", padding: 0,
                        cursor: "pointer", fontFamily: "'Inter', system-ui",
                        fontSize: 11.5, fontWeight: 600, color: PRIMARY,
                      }}
                    >
                      <span style={{
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {item.workoutName}
                      </span>
                      <svg width="10" height="10" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                        <path d="M3 5l4 4 4-4" stroke={PRIMARY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  )}
                </div>
                {/* Bi-set/tri-set não passa por aqui: bloco tem card próprio
                    (renderBlockCard), com os exercícios lado a lado. */}
                {soloTechnique && (
                  <button
                    onClick={() => setTechniqueInfo({ technique: soloTechnique, members: [] })}
                    style={{
                      display: "flex", alignItems: "center", gap: 4,
                      fontSize: 11, fontWeight: 800, color: "#c084fc",
                      background: "rgba(192,132,252,0.14)",
                      border: "1px solid rgba(192,132,252,0.45)",
                      borderRadius: 20, padding: "2px 10px", flexShrink: 0,
                      whiteSpace: "nowrap", cursor: "pointer",
                      fontFamily: "'Inter', system-ui",
                    }}
                  >
                    {t(soloTechnique === "drop" ? "goals_technique_drop" : "goals_technique_rest_pause")}
                    <span style={{ opacity: 0.75, fontWeight: 700 }}>?</span>
                  </button>
                )}
                {isMaxed && (
                  <span
                    style={{
                      display: "flex", alignItems: "center", gap: 4,
                      fontSize: 11, fontWeight: 800, color: "#eab308",
                      background: "rgba(234,179,8,0.14)",
                      border: "1px solid rgba(234,179,8,0.45)",
                      borderRadius: 20, padding: "2px 10px", flexShrink: 0,
                      whiteSpace: "nowrap",
                    }}
                  >
                    ⚡ {t("goals_machine_badge")}
                  </span>
                )}
                {item.muscle_group && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: MUTED_FG,
                    background: SURFACE, borderRadius: 20,
                    padding: "2px 10px", flexShrink: 0,
                  }}>
                    {item.muscle_group}
                  </span>
                )}
              </div>

              {/* ── VARIAÇÕES DO MOVIMENTO ──────────────────
                  "Qual supino você vai fazer hoje?". A escolha é gravada em
                  user_workouts.workout_id, então o próximo treino já abre nela
                  — o app aprende o hábito em vez de perguntar toda vez. */}
              {exerciseGroup && variationPickerId === item.workout_id && (
                <div style={{
                  display: "flex", flexWrap: "wrap", gap: 6,
                  padding: "10px 14px 2px",
                }}>
                  <p style={{
                    width: "100%", margin: 0, fontSize: 11, fontWeight: 700,
                    letterSpacing: 0.5, textTransform: "uppercase",
                    color: MUTED_FG, opacity: 0.8,
                  }}>
                    {t("goals_variation_pick")}
                  </p>
                  {variationsOf(exerciseGroup.id).map((v) => {
                    const active = v.id === item.workout_id;
                    return (
                      <button
                        key={v.id}
                        onClick={() => { void swapVariation(item, v); }}
                        style={{
                          background: active ? "rgba(91,140,255,0.16)" : SURFACE,
                          border: `1px solid ${active ? PRIMARY : BORDER}`,
                          borderRadius: 12, padding: "7px 12px",
                          fontSize: 12, fontWeight: 600,
                          color: active ? PRIMARY : FG,
                          cursor: "pointer", textAlign: "left",
                          fontFamily: "'Inter', system-ui",
                        }}
                      >
                        {v.name}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ── IMAGE AREA ─────────────────────────────── */}
              <div
                onClick={() => { setMenuId(null); setExpandedId(isExpanded ? null : item.workout_id); }}
                style={{
                  position: "relative", width: "100%", height: 150,
                  // Fundo branco quando há foto — as ilustrações em linha escura
                  // (wger) ficam invisíveis sobre superfície escura.
                  background: item.workoutPhoto ? "#fff" : SURFACE, overflow: "hidden",
                  flexShrink: 0, marginTop: 10, cursor: "pointer",
                }}
              >
                {item.workoutPhoto ? (
                  <img
                    src={item.workoutPhoto}
                    alt={item.workoutName || ""}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }}
                  />
                ) : (
                  <>
                    <div style={{
                      position: "absolute", inset: 0,
                      backgroundImage: "repeating-linear-gradient(135deg,rgba(0,0,0,0.04) 0 9px,transparent 9px 18px)",
                    }} />
                    <div style={{
                      position: "absolute", inset: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="42" height="24" viewBox="0 0 36 20" fill="none" opacity={0.3}>
                        <rect x="0.5" y="7" width="7" height="6" rx="2" fill={MUTED_FG}/>
                        <rect x="3" y="4.5" width="3" height="11" rx="1.5" fill={MUTED_FG}/>
                        <rect x="6.5" y="9" width="23" height="2" rx="1" fill={MUTED_FG}/>
                        <rect x="28.5" y="7" width="7" height="6" rx="2" fill={MUTED_FG}/>
                        <rect x="30" y="4.5" width="3" height="11" rx="1.5" fill={MUTED_FG}/>
                      </svg>
                    </div>
                  </>
                )}

                {/* ⓘ button — top-left: abre overlay de info/foto */}
                <button
                  onClick={(e) => { e.stopPropagation(); setInfoExerciseId(item.workout_id); }}
                  aria-label={t("goals_exercise_info")}
                  style={{
                    position: "absolute", top: 10, left: 10,
                    width: 34, height: 34, borderRadius: "50%",
                    background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)",
                    border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6.5" stroke="rgba(255,255,255,0.85)" strokeWidth="1.4"/>
                    <path d="M8 7v4.5" stroke="rgba(255,255,255,0.85)" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="8" cy="4.5" r="0.85" fill="rgba(255,255,255,0.85)"/>
                  </svg>
                </button>

                {/* Badge top-right: séries concluídas (sem sentido no modo corrida GPS) */}
                {!isRunExercise && (
                  <div style={{
                    position: "absolute", top: 10, right: 10,
                    background: "rgba(0,0,0,0.45)", borderRadius: 8,
                    padding: "3px 9px", backdropFilter: "blur(6px)",
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
                      {doneSeries}/{totalSeriesCount}
                    </span>
                  </div>
                )}
              </div>

              {/* ── VER / FECHAR SÉRIES BAR (sempre visível) ── */}
              <button
                onClick={() => { setMenuId(null); setExpandedId(isExpanded ? null : item.workout_id); }}
                style={{
                  width: "100%", background: "none",
                  border: "none", borderTop: `1px solid ${BORDER}`,
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "11px 16px",
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 13, color: isExpanded ? PRIMARY : FG }}>
                  {isRunExercise
                    ? (isExpanded ? t("goals_run_close") : t("goals_run_view"))
                    : (isExpanded ? t("goals_close_series") : t("goals_view_series"))}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {!isRunExercise && (
                    <span style={{ fontSize: 13, fontWeight: 600, color: MUTED_FG }}>
                      {doneSeries}/{totalSeriesCount}
                    </span>
                  )}
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                    style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                    <path d="M3 5l4 4 4-4" stroke={isExpanded ? PRIMARY : MUTED_FG} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </button>

              {/* ── EXPANDED CONTENT ───────────────────────── */}
              {isExpanded && (
                <>

                  {/* Icons row */}
                  <div style={{
                    display: "flex", alignItems: "center",
                    padding: "10px 16px", gap: 20,
                    borderBottom: `1px solid ${BORDER}`,
                    position: "relative",
                  }}>
                    {/* Indicador de progressão de carga — verde (progrediu) /
                        vermelho seta p/ baixo (regrediu) / cinza (igual ou sem
                        base). Atualiza a cada série concluída. */}
                    {(() => {
                      const trendColor =
                        weightTrend === "up" ? "#22c55e"
                        : weightTrend === "down" ? "#ef4444"
                        : MUTED_FG;
                      const trendTitle =
                        weightTrend === "up" ? t("goals_weight_trend_up")
                        : weightTrend === "down" ? t("goals_weight_trend_down")
                        : t("goals_weight_trend_same");
                      return (
                        <svg
                          width="18" height="14" viewBox="0 0 18 14" fill="none"
                          opacity={weightTrend === "neutral" ? 0.45 : 1}
                          aria-label={trendTitle}
                        >
                          <title>{trendTitle}</title>
                          {weightTrend === "down" ? (
                            <>
                              <path d="M1 3L5.5 7.5l3.5-2.5L15 12" stroke={trendColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M12 12h3v-3" stroke={trendColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </>
                          ) : (
                            <>
                              <path d="M1 11L5.5 6.5l3.5 2.5L15 2" stroke={trendColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M12 2h3v3" stroke={trendColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </>
                          )}
                        </svg>
                      );
                    })()}

                    {/* Lápis — abre/fecha nota */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleNote(item.workout_id); }}
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        padding: 0, display: "flex", alignItems: "center",
                        opacity: noteOpen ? 1 : 0.45,
                        color: noteOpen ? PRIMARY : MUTED_FG,
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                        <path d="M10.5 1.5l3 3-8 8H2.5v-3l8-8z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>

                    {/* Relógio + preset de descanso (sem sentido no modo corrida GPS) */}
                    {!isRunExercise && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // No rest-pause a roda de presets é a curta (≤15s): oferecer
                        // 90s num exercício cuja técnica é a micro-pausa seria
                        // oferecer o que o cronômetro vai recusar.
                        const presets = isRestPause ? REST_PAUSE_PRESETS : REST_PRESETS;
                        const idx = presets.indexOf(restSecs);
                        const next = presets[(idx + 1) % presets.length];
                        setWorkoutExerciseRestTimes((prev) => ({ ...prev, [item.workout_id]: next }));
                      }}
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 5, padding: 0,
                        opacity: 0.65,
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="7" r="5.5" stroke={MUTED_FG} strokeWidth="1.3"/>
                        <path d="M7 4v3.5l2 1.5" stroke={MUTED_FG} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span style={{ fontSize: 13, fontWeight: 600, color: MUTED_FG }}>
                        {fmtRest(restSecs)}
                      </span>
                    </button>
                    )}

                    {/* ⋯ Menu de contexto */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuId(menuId === item.workout_id ? null : item.workout_id);
                      }}
                      style={{
                        marginLeft: "auto", background: "none", border: "none",
                        cursor: "pointer", padding: "4px 6px",
                        fontSize: 20, color: MUTED_FG, lineHeight: 1,
                        opacity: 0.65,
                      }}
                    >
                      ⋯
                    </button>

                    {/* Dropdown do menu ⋯ */}
                    {menuId === item.workout_id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: "absolute", top: "100%", right: 12,
                          background: "rgba(30,28,42,0.82)", borderRadius: 16,
                          border: `1px solid ${BORDER}`,
                          backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
                          boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
                          zIndex: 20, minWidth: 180, overflow: "hidden",
                        }}
                      >
                        <button
                          onClick={() => { toggleNote(item.workout_id); setMenuId(null); }}
                          style={{
                            width: "100%", background: "none", border: "none",
                            padding: "12px 16px", textAlign: "left", cursor: "pointer",
                            fontSize: 14, fontWeight: 500, color: FG,
                            display: "flex", alignItems: "center", gap: 10,
                            borderBottom: `1px solid ${BORDER}`,
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
                            <path d="M10.5 1.5l3 3-8 8H2.5v-3l8-8z" stroke={FG} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          {noteOpen ? t("goals_note_close") : t("goals_note_add")}
                        </button>
                        <button
                          onClick={() => removeFromSession(item.workout_id)}
                          style={{
                            width: "100%", background: "none", border: "none",
                            padding: "12px 16px", textAlign: "left", cursor: "pointer",
                            fontSize: 14, fontWeight: 500, color: "hsl(var(--destructive))",
                            display: "flex", alignItems: "center", gap: 10,
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2 3.5h10M5.5 3.5V2.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M6 6.5v4M8 6.5v4M3 3.5l.5 8a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1l.5-8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Remover exercício
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Rest-pause: o teto de 15s não é preferência, é a técnica —
                      dizer isso evita que o usuário ache que o preset quebrou. */}
                  {isRestPause && (
                    <p style={{
                      margin: 0, padding: "8px 16px 0",
                      fontSize: 11, color: "#c084fc", opacity: 0.85, lineHeight: 1.35,
                    }}>
                      {t("goals_rest_pause_capped").replace("{secs}", String(REST_PAUSE_MAX_SECS))}
                    </p>
                  )}
                  {isDropExercise && !isCardio && !isRunExercise && (
                    <p style={{
                      margin: 0, padding: "8px 16px 0",
                      fontSize: 11, color: "#c084fc", opacity: 0.85, lineHeight: 1.35,
                    }}>
                      {t("goals_drop_stage_hint")}
                    </p>
                  )}

                  {/* Campo de nota (lápis) */}
                  {noteOpen && (
                    <div style={{
                      padding: "10px 16px",
                      borderBottom: `1px solid ${BORDER}`,
                    }}>
                      <input
                        autoFocus
                        value={note}
                        onChange={(e) =>
                          setWorkoutExerciseNotes((prev) => ({ ...prev, [item.workout_id]: e.target.value }))
                        }
                        placeholder={t("goals_note_placeholder")}
                        style={{
                          background: "transparent", border: "none",
                          fontSize: 14, color: note ? FG : MUTED_FG,
                          fontStyle: note ? "normal" : "italic",
                          width: "100%", padding: 0, outline: "none",
                          fontFamily: "'Inter', system-ui",
                        }}
                      />
                    </div>
                  )}

                  {/* Corrida ao Ar Livre — painel GPS (km, tempo e ritmo ao vivo).
                      A tabela de séries fica oculta neste modo: quem registra
                      MIN×KM (invisível, mesmo contrato de cardio) é o painel. */}
                  {isRunExercise && (
                    <RunTrackerPanel
                      workoutId={item.workout_id}
                      state={runState}
                      onFinish={() => { void handleRunFinish(item.workout_id); }}
                    />
                  )}

                  {!isRunExercise && (
                  <>
                  {/* Column headers */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "40px 1fr 68px 68px 44px",
                    padding: "8px 12px 4px", gap: 4,
                  }}>
                    {["#", "ANTERIOR", isCardio ? "MIN" : "KG", isCardio ? "KM" : "REPS", ""].map((h, i) => (
                      <div key={i} style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: 0.7,
                        color: MUTED_FG, textAlign: "center",
                        textTransform: "uppercase", opacity: 0.7,
                      }}>
                        {h}
                      </div>
                    ))}
                  </div>

                  {/* Series rows */}
                  <div style={{ padding: "0 12px 4px" }}>
                    {series.map((row, idx) => {
                      const anteriorText =
                        ((row as any).prevKg > 0 || (row as any).prevReps > 0)
                          ? `${(row as any).prevKg ?? 0}×${(row as any).prevReps ?? 0}`
                          : "—";

                      const rowInvalid = invalidSeries.has(seriesKey(item.workout_id, idx));
                      // Força: kg é opcional (peso do corpo/máquina = 0), então o
                      // campo kg nunca fica inválido — só reps. Cardio: exige MIN OU
                      // KM, então destaca os dois campos quando ambos vazios.
                      const kgInvalid = rowInvalid && isCardio && (row.kg || 0) <= 0;
                      const repsInvalid = rowInvalid && (row.reps || 0) <= 0;

                      const sKey = seriesKey(item.workout_id, idx);
                      const isSwipeOpen = swipedSeriesKey === sKey;
                      const isKindPickerOpen = kindPickerKey === sKey;

                      return (
                        <div
                          key={idx}
                          style={{ position: "relative", overflow: "hidden", marginBottom: 7 }}
                        >
                          {/* Botão de apagar — só visível durante o swipe, para que
                              a linha possa ter fundo translúcido (vidro) sem o
                              vermelho vazar no estado normal. */}
                          <div style={{
                            position: "absolute", right: 0, top: 0, bottom: 0, width: SWIPE_REVEAL,
                            background: "hsl(var(--destructive))",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            borderRadius: 10,
                            opacity: isSwipeOpen ? 1 : 0,
                            pointerEvents: isSwipeOpen ? "auto" : "none",
                            transition: "opacity 0.18s ease",
                          }}>
                            <button
                              onClick={() => deleteSeries(item.workout_id, idx)}
                              style={{
                                background: "none", border: "none", cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                width: "100%", height: "100%", padding: 0,
                              }}
                            >
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                <path d="M10 11v6M14 11v6"/>
                                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                              </svg>
                            </button>
                          </div>

                          {/* Conteúdo da linha — desliza para revelar o botão */}
                        <div
                          onTouchStart={(e) => onSeriesTouchStart(e, sKey)}
                          onTouchMove={onSeriesTouchMove}
                          onTouchEnd={(e) => onSeriesTouchEnd(e, sKey)}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "40px 1fr 68px 68px 44px",
                            alignItems: "center", gap: 4,
                            // Vidro translúcido — o botão de apagar atrás só aparece
                            // durante o swipe (opacity gated), então nada vaza aqui.
                            background: "rgba(255,255,255,0.04)",
                            transform: isSwipeOpen ? `translateX(-${SWIPE_REVEAL}px)` : "translateX(0)",
                            transition: "transform 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                          }}
                        >
                          {/* # badge — no modo expert vira o seletor de tipo de
                              série (toque abre Aquecimento/Válida/Falha). No
                              simplificado é o mesmo número inerte de sempre. */}
                          <div style={{ display: "flex", justifyContent: "center" }}>
                            {(() => {
                              const kind = setKindOf(row);
                              const style = SET_KIND_STYLE[kind];
                              const isTyped = isExpert && kind !== "normal";
                              const label = seriesLabels ? seriesLabels[idx] : String(idx + 1);
                              const badge = (
                                <div style={{
                                  width: 30, height: 30, borderRadius: "50%",
                                  background: row.completed
                                    ? (isTyped ? style.bg : PRIMARY)
                                    : (isTyped ? style.bg : SURFACE),
                                  border: isTyped ? `1.5px solid ${style.border}` : "1.5px solid transparent",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: 12, fontWeight: 800,
                                  color: isTyped
                                    ? style.fg
                                    : (row.completed ? PRIMARY_FG : MUTED_FG),
                                }}>
                                  {label}
                                </div>
                              );
                              if (!isExpert) return badge;
                              return (
                                <button
                                  onClick={() => setKindPickerKey(isKindPickerOpen ? null : sKey)}
                                  aria-label={t("goals_set_kind_change")}
                                  style={{
                                    background: "none", border: "none", padding: 0,
                                    cursor: "pointer", display: "flex",
                                  }}
                                >
                                  {badge}
                                </button>
                              );
                            })()}
                          </div>

                          {/* ANTERIOR */}
                          <div style={{
                            textAlign: "center", fontSize: 12, fontWeight: 600,
                            color: MUTED_FG, opacity: 0.75,
                          }}>
                            {anteriorText}
                          </div>

                          {/* KG (cardio: MIN) */}
                          <input
                            type="text"
                            inputMode="decimal"
                            value={
                              editingCell?.key === `${item.workout_id}:${idx}:kg`
                                ? editingCell.text
                                : (row.kg || "")
                            }
                            placeholder={kgInvalid ? "!" : "—"}
                            onChange={(e) => handleSeriesInput(item.workout_id, idx, "kg", e.target.value, isCardio)}
                            onBlur={() => setEditingCell(null)}
                            style={{
                              background: kgInvalid ? "hsl(var(--destructive) / 0.12)" : SURFACE,
                              border: kgInvalid ? `1.5px solid hsl(var(--destructive))` : "1.5px solid transparent",
                              borderRadius: 10,
                              height: 40, textAlign: "center",
                              fontWeight: 700, fontSize: 16,
                              color: FG, width: "100%", padding: "0 4px",
                              boxSizing: "border-box" as const,
                              WebkitAppearance: "none" as any,
                              fontFamily: "'Inter', system-ui",
                            }}
                          />

                          {/* REPS (cardio: KM — precisa de casas decimais) */}
                          <input
                            type="text"
                            inputMode={isCardio ? "decimal" : "numeric"}
                            value={
                              editingCell?.key === `${item.workout_id}:${idx}:reps`
                                ? editingCell.text
                                : (row.reps || "")
                            }
                            placeholder={repsInvalid ? "!" : "—"}
                            onChange={(e) => handleSeriesInput(item.workout_id, idx, "reps", e.target.value, isCardio)}
                            onBlur={() => setEditingCell(null)}
                            style={{
                              background: repsInvalid ? "hsl(var(--destructive) / 0.12)" : SURFACE,
                              border: repsInvalid ? `1.5px solid hsl(var(--destructive))` : "1.5px solid transparent",
                              borderRadius: 10,
                              height: 40, textAlign: "center",
                              fontWeight: 700, fontSize: 16,
                              color: FG, width: "100%", padding: "0 4px",
                              boxSizing: "border-box" as const,
                              WebkitAppearance: "none" as any,
                              fontFamily: "'Inter', system-ui",
                            }}
                          />

                          {/* Check */}
                          <div style={{ display: "flex", justifyContent: "center" }}>
                            {(() => {
                              const locked = !row.completed && !canCompleteSeries(row, isCardio);
                              return (
                            <button
                              onClick={() => toggleCompleted(item.workout_id, idx, isCardio)}
                              aria-label={t("goals_session_mark_done")}
                              aria-disabled={locked}
                              style={{
                                width: 34, height: 34, borderRadius: "50%",
                                // Não concluída: preenchimento muted + anel visível —
                                // azul quando pronta para marcar, cinza quando travada.
                                background: row.completed ? PRIMARY : SURFACE,
                                border: row.completed ? "none" : `2px solid ${locked ? MUTED_FG : PRIMARY}`,
                                cursor: locked ? "not-allowed" : "pointer",
                                opacity: locked ? 0.45 : 1,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                transition: "background 0.15s, border-color 0.15s",
                              }}
                            >
                              {row.completed && (
                                <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
                                  <path d="M1.5 5L5 8.5L11.5 1.5" stroke={PRIMARY_FG} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </button>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Seletor de tipo de série (modo expert) — abre logo
                            abaixo da própria linha, para o usuário ver o que
                            está classificando. Fora da div que sofre o
                            translateX do swipe, senão deslizaria junto. */}
                        {isExpert && isKindPickerOpen && (
                          <div style={{
                            display: "flex", gap: 6, padding: "8px 4px 2px",
                          }}>
                            {SET_KIND_ORDER.map((k) => {
                              const active = setKindOf(row) === k;
                              const style = SET_KIND_STYLE[k];
                              return (
                                <button
                                  key={k}
                                  onClick={() => setSeriesKind(item.workout_id, idx, k)}
                                  style={{
                                    flex: 1, height: 34, borderRadius: 10,
                                    background: active ? style.bg : "rgba(255,255,255,0.04)",
                                    border: `1px solid ${active ? style.border : BORDER}`,
                                    color: active ? style.fg : MUTED_FG,
                                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                                    fontFamily: "'Inter', system-ui",
                                  }}
                                >
                                  {t(SET_KIND_LABEL_KEYS[k])}
                                </button>
                              );
                            })}
                            {/* "+ drop" emenda uma série de carga reduzida logo
                                abaixo. Só faz sentido a partir de uma série de
                                trabalho — não se emenda drop em aquecimento. */}
                            {setKindOf(row) !== "warmup" && (
                              <button
                                onClick={() => addDropSet(item.workout_id, idx)}
                                style={{
                                  flex: 1, height: 34, borderRadius: 10,
                                  background: SET_KIND_STYLE.drop.bg,
                                  border: `1px solid ${SET_KIND_STYLE.drop.border}`,
                                  color: SET_KIND_STYLE.drop.fg,
                                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                                  fontFamily: "'Inter', system-ui",
                                }}
                              >
                                + {t("goals_set_kind_drop")}
                              </button>
                            )}
                          </div>
                        )}

                        {/* Drop-set declarado na rotina: a corrente de quedas se
                            monta aqui, sem passar pelo seletor de tipo. Cada
                            queda entra como uma LINHA própria, com seus próprios
                            campos de KG e REPS — é assim que o usuário registra
                            "12kg, depois 10kg, depois 8kg" com as repetições de
                            cada degrau. O convite fica no fim da corrente, então
                            tocar de novo aprofunda a queda em vez de duplicar. */}
                        {isDropExercise && !isCardio && !isRunExercise
                          && setKindOf(row) !== "warmup"
                          && setKindOf(series[idx + 1]) !== "drop" && (
                          <button
                            onClick={() => addDropSet(item.workout_id, idx)}
                            style={{
                              display: "flex", alignItems: "center", gap: 5,
                              marginLeft: 44, marginTop: -2, marginBottom: 2,
                              background: SET_KIND_STYLE.drop.bg,
                              border: `1px solid ${SET_KIND_STYLE.drop.border}`,
                              borderRadius: 8, padding: "3px 10px",
                              fontSize: 11, fontWeight: 700,
                              color: SET_KIND_STYLE.drop.fg, cursor: "pointer",
                              fontFamily: "'Inter', system-ui",
                            }}
                          >
                            ↳ + {t("goals_drop_add_stage")}
                          </button>
                        )}
                        </div>
                      );
                    })}

                    {/* Aquecimento automático — só faz sentido no expert (é ele
                        que tem série tipada), fora do cardio, quando ainda não
                        há rampa e há uma carga de trabalho de onde partir. */}
                    {canRampWarmup && (() => {
                      // Arraste ativo desta linha: o botão segue o dedo e some
                      // ao passar do limiar (dismissWarmupRamp). Sem arraste,
                      // dx = 0 e a transição devolve o botão ao lugar.
                      const dragDx = warmupDrag?.id === item.workout_id ? warmupDrag.dx : 0;
                      return (
                        <button
                          onClick={() => {
                            // O toque que dispensou (ou tentou dispensar) também
                            // dispara click no iOS — arrastar não pode inserir a
                            // rampa. A flag guarda o último gesto e só é zerada
                            // no próximo touchstart, então ainda vale aqui.
                            if (warmupSwipeHorizontal.current) return;
                            addWarmupRamp(item.workout_id);
                          }}
                          onTouchStart={(e) => onWarmupTouchStart(e, item.workout_id)}
                          onTouchMove={(e) => onWarmupTouchMove(e, item.workout_id)}
                          onTouchEnd={(e) => onWarmupTouchEnd(e, item.workout_id)}
                          onTouchCancel={() => setWarmupDrag(null)}
                          style={{
                            width: "100%", background: SET_KIND_STYLE.warmup.bg,
                            border: `1px solid ${SET_KIND_STYLE.warmup.border}`,
                            borderRadius: 12, padding: "9px 0",
                            cursor: "pointer", fontWeight: 700,
                            fontSize: 12.5, color: SET_KIND_STYLE.warmup.fg,
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                            marginTop: 4, fontFamily: "'Inter', system-ui",
                            // Feedback do swipe-to-dismiss: acompanha o dedo e
                            // vai sumindo. Sem transição durante o arraste (ela
                            // atrasaria o dedo); com ela na volta ao lugar.
                            transform: `translateX(${dragDx}px)`,
                            opacity: Math.max(0.25, 1 - Math.abs(dragDx) / 140),
                            transition: dragDx === 0 ? "transform 0.18s ease, opacity 0.18s ease" : "none",
                            // O gesto é horizontal; o vertical continua rolando
                            // a lista de exercícios.
                            touchAction: "pan-y",
                          }}
                        >
                          ⚡ {t("goals_warmup_ramp_cta").replace(
                            "{list}",
                            rampPreview.map((r) => `${r.kg}×${r.reps}`).join(" · "),
                          )}
                        </button>
                      );
                    })()}

                    {/* Dashed add series */}
                    <button
                      onClick={() => addSeries(item.workout_id)}
                      style={{
                        width: "100%", background: "transparent",
                        border: `2px dashed ${BORDER}`,
                        borderRadius: 12, padding: "10px 0",
                        cursor: "pointer", fontWeight: 600,
                        fontSize: 13, color: MUTED_FG,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        marginTop: 4, marginBottom: 12,
                      }}
                    >
                      <span style={{ fontSize: 16, lineHeight: 1, opacity: 0.6 }}>+</span>
                      {t("goals_add_series")}
                    </button>
                  </div>
                  </>
                  )}
                </>
              )}
            </div>
          );
        })}

        {filteredItems.length === 0 && (
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", padding: "48px 16px", textAlign: "center",
          }}>
            <p style={{ color: MUTED_FG, fontSize: 14 }}>
              {itemSearch.trim() ? t("goals_session_no_search_results") : t("goals_no_exercises_added")}
            </p>
          </div>
        )}
      </div>

      {/* ── REST TIMER ───────────────────────────────────────── */}
      {globalRestTimerActive && globalRestTimerRemaining > 0 && (
        <div style={{
          flexShrink: 0,
          padding: "8px 20px",
          display: "flex", alignItems: "center", gap: 12,
          background: GLASS_BAR_BG,
          backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
          borderTop: `1px solid ${BORDER}`,
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: MUTED_FG, whiteSpace: "nowrap" }}>
            {t("goals_rest_time")}
          </span>
          <div style={{
            flex: 1, height: 3, borderRadius: 2,
            background: SURFACE, overflow: "hidden",
          }}>
            <div style={{
              height: "100%", borderRadius: 2, background: PRIMARY,
              transition: "width 1s linear", width: `${restPct}%`,
            }} />
          </div>
          <span style={{
            fontWeight: 800, fontSize: 15, color: FG,
            fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
          }}>
            {fmtDur(globalRestTimerRemaining)}
          </span>
          <button
            onClick={skipRest}
            style={{
              background: SURFACE, border: "none", cursor: "pointer",
              color: FG, fontSize: 12, fontWeight: 700,
              padding: "8px 14px", whiteSpace: "nowrap",
              borderRadius: 20, minHeight: 36,
            }}
          >
            {t("goals_skip")}
          </button>
        </div>
      )}

      {/* ── BOTTOM BAR ───────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        padding: "12px 16px",
        paddingBottom: "max(16px, env(safe-area-inset-bottom))",
        background: GLASS_BAR_BG,
        backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
        borderTop: `1px solid ${BORDER}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <button
          onClick={() => setPickerOpen(true)}
          style={{
            background: SURFACE, border: `1px solid ${BORDER}`, cursor: "pointer",
            fontWeight: 700, fontSize: 14, color: "#fff",
            display: "flex", alignItems: "center", gap: 6,
            padding: "11px 22px", borderRadius: 999,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
          {t("goals_add_exercise") || "Adicionar Exercício"}
        </button>
      </div>

      {/* ── EXERCISE PICKER OVERLAY ──────────────────────────── */}
      {pickerOpen && (
        <div style={{
          position: "absolute", inset: 0,
          background: GLASS_ROOT_BG, display: "flex", flexDirection: "column",
          zIndex: 10,
        }}>
          {/* Picker header */}
          <div style={{
            flexShrink: 0,
            paddingTop: "max(48px, env(safe-area-inset-top))",
            paddingLeft: "max(16px, env(safe-area-inset-left))",
            paddingRight: "max(16px, env(safe-area-inset-right))",
            paddingBottom: 12,
            display: "flex", alignItems: "center", gap: 12,
            borderBottom: `1px solid ${BORDER}`,
          }}>
            <button
              onClick={resetPicker}
              style={{
                background: SURFACE, border: "none",
                borderRadius: "50%", width: 36, height: 36, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 3L5 8l5 5" stroke={FG} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <span style={{ flex: 1, fontWeight: 700, fontSize: 17 }}>{t("goals_add_exercise")}</span>
          </div>

          {/* Toggle: Lista x Músculo (mesma alternância do drawer "selecionar itens") */}
          {pickerMuscleGroups.length > 0 && (
            <div style={{ flexShrink: 0, padding: "12px 16px 0" }}>
              <div style={{
                display: "flex", gap: 4, padding: 4, borderRadius: 16,
                background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)",
              }}>
                {([["list", t("goals_browse_list")], ["group", t("goals_browse_muscle")]] as const).map(([mode, label]) => {
                  const active = pickerBrowseMode === mode;
                  return (
                    <button
                      key={mode}
                      onClick={() => { setPickerBrowseMode(mode); setPickerMuscleFilter(null); setPickerSearch(""); }}
                      style={{
                        flex: 1, height: 36, borderRadius: 12, border: "none", cursor: "pointer",
                        fontSize: 13, fontWeight: 600, transition: "all .15s",
                        background: active ? "linear-gradient(rgba(255,255,255,.95),rgba(255,255,255,.84))" : "transparent",
                        color: active ? "#0a0b12" : "rgba(255,255,255,.6)",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {pickerBrowseMode === "group" && !pickerMuscleFilter ? (
            /* ── Lista de grupos musculares ─────────────────────── */
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
              {catalogLoading ? (
                <div style={{ textAlign: "center", padding: "48px 16px", color: MUTED_FG }}>
                  {t("goals_picker_loading")}
                </div>
              ) : (
                pickerMuscleGroups.map((g) => {
                  const count = catalog.filter((w) => w.muscle_group === g).length;
                  const selectedInGroup = catalog.filter((w) => w.muscle_group === g && pickerSelected.has(w.id)).length;
                  return (
                    <button
                      key={g}
                      onClick={() => setPickerMuscleFilter(g)}
                      style={{
                        width: "100%", cursor: "pointer", textAlign: "left",
                        display: "flex", alignItems: "center", gap: 12,
                        padding: 12, borderRadius: 16,
                        border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)",
                      }}
                    >
                      <div style={{
                        width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: "linear-gradient(135deg,#ff9d6c,#d8567a)",
                      }}>
                        <svg width="22" height="14" viewBox="0 0 36 20" fill="none">
                          <rect x="0.5" y="7" width="7" height="6" rx="2" fill="#fff"/>
                          <rect x="3" y="4.5" width="3" height="11" rx="1.5" fill="#fff"/>
                          <rect x="6.5" y="9" width="23" height="2" rx="1" fill="#fff"/>
                          <rect x="28.5" y="7" width="7" height="6" rx="2" fill="#fff"/>
                          <rect x="30" y="4.5" width="3" height="11" rx="1.5" fill="#fff"/>
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 15, color: FG, textTransform: "capitalize", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g}</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 2 }}>
                          {t("goals_browse_count").replace("{n}", String(count))}
                          {selectedInGroup > 0 && ` · ${selectedInGroup} ✓`}
                        </div>
                      </div>
                      <svg width="8" height="14" viewBox="0 0 8 14" fill="none" style={{ flexShrink: 0 }}>
                        <path d="M1 1l5.5 6L1 13" stroke="rgba(255,255,255,.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            <>
              {/* Search input (+ voltar quando há grupo selecionado) */}
              <div style={{ flexShrink: 0, padding: "12px 16px", borderBottom: `1px solid ${BORDER}` }}>
                {pickerBrowseMode === "group" && pickerMuscleFilter && (
                  <button
                    onClick={() => { setPickerMuscleFilter(null); setPickerSearch(""); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, marginBottom: 10,
                      background: "none", border: "none", cursor: "pointer", padding: 0,
                      color: "#9d6bff", fontSize: 14, fontWeight: 600, textTransform: "capitalize",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M10 3L5 8l5 5" stroke="#9d6bff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {pickerMuscleFilter}
                  </button>
                )}
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  background: SURFACE, borderRadius: 12, padding: "10px 14px",
                }}>
                  <svg width="14" height="14" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
                    <circle cx="5.5" cy="5.5" r="4" stroke={MUTED_FG} strokeWidth="1.5"/>
                    <path d="m8.5 8.5 2.5 2.5" stroke={MUTED_FG} strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <input
                    type="text"
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder={t("goals_search_exercise")}
                    style={{
                      background: "transparent", border: "none", outline: "none",
                      fontSize: 15, color: FG, flex: 1,
                      fontFamily: "'Inter', system-ui",
                    }}
                  />
                  {pickerSearch && (
                    <button
                      onClick={() => setPickerSearch("")}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: MUTED_FG }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Exercise list — mesmo padrão visual do drawer "selecionar itens" */}
              {/* O padding-bottom cresce com o teclado do iOS (var publicada pelo
                  keyboard.ts; 0px no web/fechado) para a lista rolar acima dele —
                  senão os últimos resultados ficam atrás do teclado. */}
              <div style={{
                flex: 1, overflowY: "auto",
                paddingTop: 12, paddingLeft: 16, paddingRight: 16,
                paddingBottom: "calc(32px + var(--keyboard-height, 0px))",
                display: "flex", flexDirection: "column", gap: 8,
              }}>
                {catalogLoading ? (
                  <div style={{ textAlign: "center", padding: "48px 16px", color: MUTED_FG }}>
                    {t("goals_picker_loading")}
                  </div>
                ) : catalogFiltered.length === 0 ? (
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    gap: 14, padding: "48px 16px", textAlign: "center",
                  }}>
                    <span style={{ color: MUTED_FG, fontSize: 14 }}>{t("goals_picker_empty")}</span>
                    <button
                      onClick={() => {
                        setCreateName(pickerSearch.trim());
                        setCreateMuscle(pickerMuscleFilter ?? "");
                        setCreateOpen(true);
                      }}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "11px 22px", borderRadius: 999, border: "none", cursor: "pointer",
                        fontSize: 14, fontWeight: 700, color: "#fff", background: GLASS_GRADIENT,
                      }}
                    >
                      <span style={{ fontSize: 17, lineHeight: 1 }}>+</span>
                      {t("goals_create_exercise")}
                    </button>
                  </div>
                ) : (
                  catalogFiltered.map((w) => {
                    const alreadyAdded = allItems.some((i) => i.workout_id === w.id);
                    const selected = pickerSelected.has(w.id);
                    const active = alreadyAdded || selected;
                    return (
                      <div
                        key={w.id}
                        style={{
                          width: "100%",
                          display: "flex", alignItems: "center", gap: 12,
                          padding: 12, borderRadius: 16,
                          transition: "all .15s",
                          opacity: alreadyAdded ? 0.6 : 1,
                          border: active ? "1px solid #5b8cff" : "1px solid rgba(255,255,255,.1)",
                          background: active ? "rgba(91,140,255,.1)" : "rgba(255,255,255,.04)",
                        }}
                      >
                        {/* Thumbnail → abre detalhe (foto + como executar) */}
                        <button
                          onClick={() => setPickerInfo(w)}
                          aria-label={t("goals_item_view_detail")}
                          style={{
                            background: "none", border: "none", padding: 0, cursor: "pointer",
                            flexShrink: 0, lineHeight: 0,
                          }}
                        >
                          <ExerciseImage
                            photo={w.photo ?? null}
                            name={w.name}
                            muscleGroup={w.muscle_group}
                            className="h-16 w-16 rounded-xl"
                          />
                        </button>

                        {/* Info + indicador → alterna a seleção */}
                        <button
                          onClick={() => handlePickExercise(w)}
                          disabled={alreadyAdded}
                          style={{
                            flex: 1, minWidth: 0, background: "none", border: "none", padding: 0,
                            cursor: alreadyAdded ? "default" : "pointer", textAlign: "left",
                            display: "flex", alignItems: "center", gap: 12,
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontWeight: 600, fontSize: 15, color: FG,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>
                              {/* Linha colapsada mostra o MOVIMENTO; a variação
                                  vem depois, no treino. */}
                              {variationCountOf(w) > 1 && w.groupId
                                ? (groupById.get(w.groupId)?.name ?? w.name)
                                : w.name}
                            </div>
                            {variationCountOf(w) > 1 && (
                              <div style={{ fontSize: 12, color: PRIMARY, marginTop: 2 }}>
                                {t("goals_variation_count").replace("{n}", String(variationCountOf(w)))}
                              </div>
                            )}
                            {w.muscle_group && (
                              <div style={{
                                fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 2,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              }}>
                                {w.muscle_group}
                              </div>
                            )}
                          </div>

                          {/* indicador: selecionado/adicionado (check azul) ou adicionar (+) */}
                          <div style={{
                            width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                            background: active ? PRIMARY : "rgba(255,255,255,.08)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            {active ? (
                              <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
                                <path d="M1.5 5L5 8.5L11.5 1.5" stroke={PRIMARY_FG} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path d="M6 1v10M1 6h10" stroke={MUTED_FG} strokeWidth="2" strokeLinecap="round"/>
                              </svg>
                            )}
                          </div>
                        </button>
                      </div>
                    );
                  })
                )}

                {/* Criar exercício próprio — sempre acessível ao fim da lista */}
                {!catalogLoading && catalogFiltered.length > 0 && (
                  <button
                    onClick={() => {
                      setCreateName(pickerSearch.trim());
                      setCreateMuscle(pickerMuscleFilter ?? "");
                      setCreateOpen(true);
                    }}
                    style={{
                      width: "100%", marginTop: 4,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      padding: "12px 0", borderRadius: 16,
                      border: `2px dashed ${BORDER}`, background: "transparent",
                      cursor: "pointer", fontSize: 14, fontWeight: 600, color: MUTED_FG,
                    }}
                  >
                    <span style={{ fontSize: 16, lineHeight: 1, opacity: 0.7 }}>+</span>
                    {t("goals_create_exercise")}
                  </button>
                )}
              </div>
            </>
          )}

          {/* ── CRIAR NOVO EXERCÍCIO (sub-overlay do picker) ─────── */}
          {createOpen && (
            <div style={{
              position: "absolute", inset: 0, zIndex: 20,
              background: GLASS_ROOT_BG, display: "flex", flexDirection: "column",
            }}>
              <div style={{
                flexShrink: 0,
                paddingTop: "max(48px, env(safe-area-inset-top))",
                paddingLeft: "max(16px, env(safe-area-inset-left))",
                paddingRight: "max(16px, env(safe-area-inset-right))",
                paddingBottom: 12,
                display: "flex", alignItems: "center", gap: 12,
                borderBottom: `1px solid ${BORDER}`,
              }}>
                <button
                  onClick={() => setCreateOpen(false)}
                  style={{
                    background: SURFACE, border: "none",
                    borderRadius: "50%", width: 36, height: 36, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M10 3L5 8l5 5" stroke={FG} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <span style={{ flex: 1, fontWeight: 700, fontSize: 17 }}>{t("goals_create_exercise")}</span>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: MUTED_FG }}>
                    {t("goals_create_exercise_name")}
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder={t("goals_create_exercise_name")}
                    style={{
                      height: 48, background: SURFACE, border: `1px solid ${BORDER}`,
                      borderRadius: 12, padding: "0 14px", fontSize: 15, color: FG,
                      outline: "none", fontFamily: "'Inter', system-ui",
                    }}
                  />
                </div>
                {/* Grupo muscular — obrigatório, select com os grupos do catálogo */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: MUTED_FG }}>
                    {t("goals_create_exercise_muscle")} <span style={{ color: "#ff6b6b" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <select
                      value={createMuscle}
                      onChange={(e) => setCreateMuscle(e.target.value)}
                      style={{
                        width: "100%", height: 48, background: SURFACE, border: `1px solid ${BORDER}`,
                        borderRadius: 12, padding: "0 38px 0 14px", fontSize: 15,
                        color: createMuscle ? FG : MUTED_FG,
                        outline: "none", fontFamily: "'Inter', system-ui",
                        appearance: "none", WebkitAppearance: "none" as any, MozAppearance: "none" as any,
                      }}
                    >
                      <option value="" disabled style={{ color: "#000" }}>
                        {t("goals_create_exercise_muscle_placeholder")}
                      </option>
                      {createMuscle && !pickerMuscleGroups.includes(createMuscle) && (
                        <option value={createMuscle} style={{ color: "#000" }}>{createMuscle}</option>
                      )}
                      {pickerMuscleGroups.map((g) => (
                        <option key={g} value={g} style={{ color: "#000" }}>{g}</option>
                      ))}
                    </select>
                    <svg
                      width="12" height="12" viewBox="0 0 12 12" fill="none"
                      style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                    >
                      <path d="M2 4l4 4 4-4" stroke={MUTED_FG} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>

                {/* Tipo de máquina / equipamento */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: MUTED_FG }}>
                    {t("goals_create_exercise_equipment")}
                  </label>
                  <input
                    type="text"
                    value={createEquipment}
                    onChange={(e) => setCreateEquipment(e.target.value)}
                    placeholder={t("goals_create_exercise_equipment_placeholder")}
                    style={{
                      height: 48, background: SURFACE, border: `1px solid ${BORDER}`,
                      borderRadius: 12, padding: "0 14px", fontSize: 15, color: FG,
                      outline: "none", fontFamily: "'Inter', system-ui",
                    }}
                  />
                </div>

                {/* Como executar */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: MUTED_FG }}>
                    {t("goals_create_exercise_howto")}
                  </label>
                  <textarea
                    value={createHowTo}
                    onChange={(e) => setCreateHowTo(e.target.value)}
                    placeholder={t("goals_create_exercise_howto_placeholder")}
                    rows={4}
                    style={{
                      background: SURFACE, border: `1px solid ${BORDER}`,
                      borderRadius: 12, padding: "12px 14px", fontSize: 15, color: FG,
                      outline: "none", fontFamily: "'Inter', system-ui",
                      resize: "none", lineHeight: 1.5,
                    }}
                  />
                </div>

                {/* Foto do exercício (câmera ou galeria) */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: MUTED_FG }}>
                    {t("goals_create_exercise_photo")}
                  </label>
                  <input
                    ref={createPhotoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCreatePhotoPick}
                    style={{ display: "none" }}
                  />
                  {createPhotoPreview ? (
                    <div style={{
                      position: "relative", width: "100%", height: 180, borderRadius: 16,
                      overflow: "hidden", background: "#fff", border: `1px solid ${BORDER}`,
                    }}>
                      <img
                        src={createPhotoPreview}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                      />
                      <button
                        onClick={() => { setCreatePhotoFile(null); setCreatePhotoPreview(null); }}
                        aria-label={t("goals_create_exercise_photo_remove")}
                        style={{
                          position: "absolute", top: 8, right: 8,
                          width: 32, height: 32, borderRadius: "50%",
                          background: "rgba(0,0,0,0.6)", border: "none", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#fff", fontSize: 16, fontWeight: 700,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => createPhotoInputRef.current?.click()}
                      style={{
                        width: "100%", height: 110, borderRadius: 16,
                        border: `2px dashed ${BORDER}`, background: "transparent",
                        cursor: "pointer", display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center", gap: 6,
                        color: MUTED_FG, fontSize: 14, fontWeight: 600,
                      }}
                    >
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                        <path d="M3 8.5A1.5 1.5 0 014.5 7h2l1-2h9l1 2h2A1.5 1.5 0 0121 8.5v9A1.5 1.5 0 0119.5 19h-15A1.5 1.5 0 013 17.5v-9z" stroke={MUTED_FG} strokeWidth="1.6" strokeLinejoin="round"/>
                        <circle cx="12" cy="12.5" r="3.2" stroke={MUTED_FG} strokeWidth="1.6"/>
                      </svg>
                      {t("goals_create_exercise_photo_cta")}
                    </button>
                  )}
                </div>
              </div>

              <div style={{
                flexShrink: 0,
                padding: "12px 16px",
                paddingBottom: "max(12px, env(safe-area-inset-bottom))",
                borderTop: `1px solid ${BORDER}`,
                background: GLASS_BAR_BG, backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
              }}>
                {(() => {
                  const disabled = !createName.trim() || !createMuscle.trim() || createSaving;
                  return (
                    <button
                      onClick={handleCreateExercise}
                      disabled={disabled}
                      style={{
                        width: "100%", height: 48, borderRadius: 999, border: "none",
                        fontSize: 15, fontWeight: 700, color: "#fff",
                        cursor: disabled ? "default" : "pointer",
                        opacity: disabled ? 0.45 : 1,
                        background: GLASS_GRADIENT,
                      }}
                    >
                      {createSaving ? t("goals_picker_loading") : t("goals_create_exercise_save")}
                    </button>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Footer: confirmar seleção */}
          <div style={{
            flexShrink: 0,
            padding: "12px 16px",
            paddingBottom: "max(12px, env(safe-area-inset-bottom))",
            borderTop: `1px solid ${BORDER}`,
            background: GLASS_BAR_BG, backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
          }}>
            <button
              onClick={handleConfirmPicker}
              disabled={pickerSelected.size === 0}
              style={{
                width: "100%", height: 48, borderRadius: 999, border: "none",
                fontSize: 15, fontWeight: 700, color: "#fff",
                cursor: pickerSelected.size === 0 ? "default" : "pointer",
                opacity: pickerSelected.size === 0 ? 0.45 : 1,
                background: GLASS_GRADIENT,
              }}
            >
              {pickerSelected.size > 0
                ? t("goals_picker_confirm").replace("{n}", String(pickerSelected.size))
                : t("goals_picker_confirm_empty")}
            </button>
          </div>
        </div>
      )}

      {/* ── PICKER EXERCISE DETAIL OVERLAY ──────────────────── */}
      {/* Detalhe (foto ampliada + "como executar") de um item do catálogo no picker */}
      {pickerInfo && (
        <ExerciseDetailOverlay
          photo={pickerInfo.photo ?? null}
          name={pickerInfo.name}
          muscleGroup={pickerInfo.muscle_group ?? null}
          description={pickerInfo.description || ""}
          zIndex={80}
          onClose={() => setPickerInfo(null)}
          workoutId={pickerInfo.id}
          canEdit={!!pickerInfo.isCustom}
          onSaved={(u) => {
            setCatalog((prev) =>
              prev.map((w) =>
                w.id === u.id ? { ...w, name: u.name, description: u.description, photo: u.photo } : w,
              ),
            );
            setPickerInfo((prev) =>
              prev && prev.id === u.id
                ? { ...prev, name: u.name, description: u.description, photo: u.photo }
                : prev,
            );
            applyExerciseEdit(u);
          }}
          onDeleted={(id) => { applyExerciseDelete(id); setPickerInfo(null); }}
        />
      )}

      {/* ── EXERCISE INFO OVERLAY ───────────────────────────── */}
      {infoExerciseId && (() => {
        const infoItem = allItems.find((i) => i.workout_id === infoExerciseId);
        if (!infoItem) return null;
        return (
          <ExerciseDetailOverlay
            photo={infoItem.workoutPhoto ?? null}
            name={infoItem.workoutName || ""}
            muscleGroup={infoItem.muscle_group ?? null}
            description={infoItem.workoutDescription || ""}
            zIndex={70}
            onClose={() => setInfoExerciseId(null)}
            workoutId={infoItem.workout_id}
            canEdit={!!infoItem.isCustom}
            onSaved={applyExerciseEdit}
            onDeleted={(id) => { applyExerciseDelete(id); setInfoExerciseId(null); }}
          />
        );
      })()}

      {/* Verbete da técnica — z acima do detalhe do exercício (70), porque
          pode ser aberto por cima dele no futuro e nunca deve ficar atrás. */}
      {techniqueInfo && (
        <TechniqueInfoOverlay
          technique={techniqueInfo.technique}
          blockMembers={techniqueInfo.members}
          zIndex={75}
          onClose={() => setTechniqueInfo(null)}
        />
      )}

      {/* ── RESUMO DA CORRIDA GPS (stats + mapa do trajeto) ──── */}
      {runSummary && (() => {
        const min = Math.round((runSummary.elapsedMs / 60000) * 10) / 10;
        return (
          <div style={{
            position: "absolute", inset: 0, zIndex: 85,
            background: GLASS_ROOT_BG,
            display: "flex", flexDirection: "column",
            paddingTop: "max(48px, env(safe-area-inset-top))",
            paddingBottom: "max(16px, env(safe-area-inset-bottom))",
            paddingLeft: "max(16px, env(safe-area-inset-left))",
            paddingRight: "max(16px, env(safe-area-inset-right))",
          }}>
            <div style={{
              flex: 1, overflowY: "auto", overscrollBehavior: "contain",
              display: "flex", flexDirection: "column",
              maxWidth: 420, width: "100%", margin: "0 auto",
            }}>
              {/* Título */}
              <div style={{ textAlign: "center", marginBottom: 18 }}>
                <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 10 }}>🏃</div>
                <div style={{ fontSize: 21, fontWeight: 800, color: FG }}>
                  {t("goals_run_done_title")}
                </div>
                <div style={{ fontSize: 13, color: MUTED_FG, marginTop: 6, lineHeight: 1.45 }}>
                  {t("goals_run_done_desc")
                    .replace("{km}", runSummary.distanceKm.toFixed(2))
                    .replace("{min}", String(min))}
                </div>
              </div>

              {/* Stats finais */}
              <div style={{
                display: "flex", padding: "14px 8px", marginBottom: 14,
                background: CARD, borderRadius: 20, border: `1px solid ${BORDER}`,
                backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
              }}>
                {[
                  { label: t("goals_run_distance"), value: runSummary.distanceKm.toFixed(2), unit: "km" },
                  { label: t("goals_run_time"), value: formatRunTime(runSummary.elapsedMs), unit: null },
                  { label: t("goals_run_pace"), value: formatRunPace(runSummary.paceSecPerKm), unit: "/km" },
                ].map(({ label, value, unit }) => (
                  <div key={label} style={{ flex: 1, textAlign: "center" }}>
                    <div style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: 0.7,
                      textTransform: "uppercase", color: MUTED_FG, opacity: 0.8, marginBottom: 5,
                    }}>
                      {label}
                    </div>
                    <div style={{
                      fontSize: 22, fontWeight: 800, color: FG,
                      fontVariantNumeric: "tabular-nums", lineHeight: 1,
                    }}>
                      {value}
                      {unit && (
                        <span style={{ fontSize: 12, fontWeight: 600, color: MUTED_FG, marginLeft: 3 }}>
                          {unit}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Mapa do trajeto */}
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: 0.7,
                textTransform: "uppercase", color: MUTED_FG, marginBottom: 8,
              }}>
                {t("goals_run_map_title")}
              </div>
              <RouteMap
                path={runSummary.path}
                height={260}
                emptyLabel={t("goals_run_no_route")}
              />
            </div>

            {/* Fechar */}
            <div style={{ maxWidth: 420, width: "100%", margin: "0 auto", paddingTop: 14 }}>
              <button
                onClick={() => setRunSummary(null)}
                style={{
                  width: "100%", height: 50, borderRadius: 999, border: "none",
                  background: GLASS_GRADIENT, color: "#fff",
                  fontSize: 15, fontWeight: 700, cursor: "pointer",
                  boxShadow: "0 6px 18px rgba(91,140,255,0.35)",
                }}
              >
                {t("goals_run_summary_close")}
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── REST TIMER MODAL ─────────────────────────────────── */}
      {restModalOpen && globalRestTimerActive && (() => {
        const R = 54;
        const CIRC = 2 * Math.PI * R;
        const offset = CIRC * (1 - Math.min(100, Math.max(0, restPct)) / 100);
        const mm = Math.floor(globalRestTimerRemaining / 60);
        const ss = globalRestTimerRemaining % 60;
        const timeLabel = `${mm}:${String(ss).padStart(2, "0")}`;
        const ringColor = globalRestTimerPaused ? MUTED_FG : PRIMARY;

        return (
          <div
            onClick={() => setRestModalOpen(false)}
            style={{
              position: "absolute", inset: 0, zIndex: 60,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
              paddingTop: "max(1rem, env(safe-area-inset-top))",
              paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
              paddingLeft: "max(1rem, env(safe-area-inset-left))",
              paddingRight: "max(1rem, env(safe-area-inset-right))",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "relative",
                width: "100%", maxWidth: 340,
                background: "linear-gradient(rgba(40,38,54,0.92),rgba(18,16,28,0.96))",
                backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
                border: `1px solid ${BORDER}`,
                borderRadius: 28,
                padding: "28px 24px 24px",
                display: "flex", flexDirection: "column", alignItems: "center",
                boxShadow: "0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
              }}
            >
              {/* Fechar (mantém o timer ativo na barra inferior) */}
              <button
                onClick={() => setRestModalOpen(false)}
                aria-label={t("goals_cancel")}
                style={{
                  position: "absolute", top: 14, right: 14,
                  width: 32, height: 32, borderRadius: "50%",
                  background: SURFACE, border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M2 2l9 9M11 2l-9 9" stroke={MUTED_FG} strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>

              <div style={{ fontSize: 15, fontWeight: 700, color: FG }}>
                {t("goals_rest_time")}
              </div>
              <div style={{ fontSize: 12, color: MUTED_FG, marginTop: 4, textAlign: "center" }}>
                {globalRestTimerPaused ? t("goals_rest_paused") : t("goals_rest_subtitle")}
              </div>

              {/* Anel de progresso + contador */}
              <div style={{ position: "relative", width: 132, height: 132, margin: "20px 0 22px" }}>
                <svg width="132" height="132" viewBox="0 0 132 132" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="66" cy="66" r={R} fill="none" stroke={SURFACE} strokeWidth="9" />
                  <circle
                    cx="66" cy="66" r={R} fill="none"
                    stroke={ringColor} strokeWidth="9" strokeLinecap="round"
                    strokeDasharray={CIRC} strokeDashoffset={offset}
                    style={{ transition: "stroke-dashoffset 1s linear, stroke 0.2s" }}
                  />
                </svg>
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 32, fontWeight: 800, color: FG,
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {timeLabel}
                </div>
              </div>

              {/* Ações principais: Pausar/Retomar + Minimizar */}
              <div style={{ display: "flex", gap: 10, width: "100%" }}>
                <button
                  onClick={() => setGlobalRestTimerPaused((p) => !p)}
                  style={{
                    flex: 1, background: GLASS_GRADIENT, color: "#fff",
                    border: "none", borderRadius: 16, height: 50,
                    fontSize: 14, fontWeight: 700, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    boxShadow: "0 6px 18px rgba(91,140,255,0.35)",
                  }}
                >
                  {globalRestTimerPaused ? (
                    <svg width="14" height="15" viewBox="0 0 14 15" fill="none">
                      <path d="M2 2l10 5.5L2 13V2z" fill="currentColor"/>
                    </svg>
                  ) : (
                    <svg width="13" height="14" viewBox="0 0 13 14" fill="none">
                      <rect x="1" y="1" width="4" height="12" rx="1.5" fill="currentColor"/>
                      <rect x="8" y="1" width="4" height="12" rx="1.5" fill="currentColor"/>
                    </svg>
                  )}
                  {globalRestTimerPaused ? t("goals_session_resume") : t("goals_rest_pause")}
                </button>

                <button
                  onClick={() => { setRestModalOpen(false); onMinimize(); }}
                  style={{
                    flex: 1, background: SURFACE, color: FG,
                    border: "none", borderRadius: 14, height: 50,
                    fontSize: 14, fontWeight: 700, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 10h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M4 5l3 3 3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {t("goals_minimize")}
                </button>
              </div>

              {/* Pular descanso */}
              <button
                onClick={skipRest}
                style={{
                  marginTop: 14, background: "none", border: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: 600, color: MUTED_FG, padding: "4px 8px",
                }}
              >
                {t("goals_skip")}
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── CONFIRM FINISH ───────────────────────────────────── */}
      {/* Overlay inline (z-index acima do dialog) porque AlertDialog/Radix
          porta para body com z-index 50, ficando escondido atrás deste overlay 9999. */}
      {confirmOpen && (
        <div
          style={{
            position: "absolute", inset: 0, zIndex: 80,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
            paddingTop: "max(1rem, env(safe-area-inset-top))",
            paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
            paddingLeft: "max(1rem, env(safe-area-inset-left))",
            paddingRight: "max(1rem, env(safe-area-inset-right))",
          }}
        >
          <div style={{
            width: "100%", maxWidth: 320,
            background: "linear-gradient(rgba(40,38,54,0.92),rgba(18,16,28,0.96))",
            backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
            border: `1px solid ${BORDER}`,
            borderRadius: 24,
            padding: "24px 20px 20px",
            boxShadow: "0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
          }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: FG, marginBottom: 8 }}>
              {t("goals_confirm_end_workout")}
            </div>
            <div style={{ fontSize: 14, color: MUTED_FG, marginBottom: hasCompletedSeries ? 24 : 12, lineHeight: 1.5 }}>
              {t("goals_confirm_end_workout_desc")}
            </div>
            {/* Aviso inline quando nenhuma série foi concluída */}
            {!hasCompletedSeries && (
              <div style={{
                background: "hsl(var(--destructive) / 0.12)",
                border: "1px solid hsl(var(--destructive) / 0.4)",
                borderRadius: 10, padding: "10px 14px", marginBottom: 20,
                fontSize: 13, color: "hsl(var(--destructive))", lineHeight: 1.5,
              }}>
                {t("goals_session_complete_one")}
              </div>
            )}
            {/* Erro de save — mostrado inline pois toast() é invisível atrás do z-index 9999 */}
            {saveError && (
              <div style={{
                background: "hsl(var(--destructive) / 0.12)",
                border: "1px solid hsl(var(--destructive) / 0.4)",
                borderRadius: 10, padding: "10px 14px", marginBottom: 16,
                fontSize: 12, color: "hsl(var(--destructive))", lineHeight: 1.5,
                wordBreak: "break-word",
              }}>
                {saveError}
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { setSaveError(null); setConfirmOpen(false); }}
                style={{
                  flex: 1, height: 46, borderRadius: 12,
                  background: SURFACE, border: "none",
                  fontSize: 14, fontWeight: 700, color: FG, cursor: "pointer",
                }}
              >
                {t("goals_cancel")}
              </button>
              <button
                onClick={handleConfirmFinish}
                disabled={isSaving || !hasCompletedSeries}
                style={{
                  flex: 1, height: 46, borderRadius: 12,
                  background: ORANGE, border: "none",
                  fontSize: 14, fontWeight: 700, color: "#fff",
                  cursor: (isSaving || !hasCompletedSeries) ? "not-allowed" : "pointer",
                  opacity: (isSaving || !hasCompletedSeries) ? 0.4 : 1,
                }}
              >
                {isSaving ? t("goals_saving") : t("goals_end_workout")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(content, document.body);
}
