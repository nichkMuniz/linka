import * as React from "react";
import { createPortal } from "react-dom";
import { useWorkout } from "@/lib/workout-context";
import { useLanguage } from "@/lib/language-context";
import {
  subscribeRun, getRunState, startRun, pauseRun, resumeRun, stopRun,
  openLocationSettings,
  type RunState, type RunPoint, type StartRunLabels,
} from "@/lib/run-tracker";
import { RouteMap } from "@/components/shared/route-map";
import { ExerciseImage } from "@/components/shared/exercise-image";
import { toast } from "@/components/ui/use-toast";
import {
  saveWorkoutHistoryDb,
  getPreviousBestKgDb,
  getWorkoutsDb,
  createCustomWorkoutDb,
  createUserWorkoutsDb,
  updateUserWorkoutNotesDb,
  uploadCustomExercisePhotoDb,
  type UserWorkoutWithDetails,
  type Workout,
} from "@/lib/ritmofit-db";

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
    sets: Array<{ kg: number; reps: number }>;
  }>;
  prExercises: Array<{
    name: string;
    previousBestKg: number;
    newBestKg: number;
  }>;
  // PR where bestKg >= 100 — "zerando a máquina"
  machinedExercises: Array<{ name: string; kg: number }>;
};

interface WorkoutSessionDialogProps {
  open: boolean;
  userId: string;
  routineLabel: string;
  items: UserWorkoutWithDetails[];
  /** id da rotina (card.routineId) — autoritativo para vincular exercícios criados */
  routineId?: string | null;
  /** nome da rotina (card.name) — usado como `user_workouts.name` para agrupar no card certo */
  routineName?: string | null;
  onMinimize: () => void;
  onFinished: (summary: WorkoutSessionSummary) => void;
}

const REST_PRESETS = [0, 30, 60, 90, 120];
const SWIPE_REVEAL = 72; // px revelados ao deslizar para a esquerda

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

// ── Corrida ao ar livre (GPS) ───────────────────────────────────────────────
// Só o exercício "Corrida ao Ar Livre" do catálogo ganha o painel de GPS —
// o workoutName chega localizado (pickLocalized), então casamos PT e EN.
const OUTDOOR_RUN_NAMES = new Set(["corrida ao ar livre", "outdoor running"]);
const isOutdoorRun = (name?: string | null) =>
  !!name &&
  OUTDOOR_RUN_NAMES.has(
    name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim(),
  );

function fmtRunTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function fmtPace(secPerKm: number | null): string {
  if (secPerKm == null || !isFinite(secPerKm) || secPerKm > 3600) return "—";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

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
          { label: t("goals_run_time"), value: fmtRunTime(state.elapsedMs), unit: null },
          { label: t("goals_run_pace"), value: fmtPace(state.paceSecPerKm), unit: "/km" },
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
}: {
  photo: string | null;
  name: string;
  muscleGroup: string | null;
  description: string;
  zIndex: number;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div
      onClick={onClose}
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

      {/* Conteúdo rolável: foto + nome + descrição. Só rola se realmente exceder. */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: 1, overflowY: "auto", overflowX: "hidden",
          overscrollBehavior: "contain", WebkitOverflowScrolling: "touch",
          padding: "0 20px",
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
          {photo ? (
            <img
              src={photo}
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
      </div>
    </div>
  );
}

export function WorkoutSessionDialog({
  open, userId, routineLabel, items, routineId: routineIdProp, routineName, onMinimize, onFinished,
}: WorkoutSessionDialogProps) {
  const { t } = useLanguage();
  const {
    workoutSeries, setWorkoutSeries,
    workoutDuration,
    workoutExerciseRestTimes, setWorkoutExerciseRestTimes,
    workoutExerciseNotes, setWorkoutExerciseNotes,
    workoutExtraItems, setWorkoutExtraItems,
    workoutRemovedIds, setWorkoutRemovedIds,
    workoutExpandedId: expandedId, setWorkoutExpandedId: setExpandedId,
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

  // Lista completa de itens da sessão
  const allItems = React.useMemo(
    () => [...items, ...workoutExtraItems].filter((i) => !workoutRemovedIds.includes(i.workout_id)),
    [items, workoutExtraItems, workoutRemovedIds],
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

  // Live stats
  const stats = React.useMemo(() => {
    let volume = 0, totalDone = 0, doneEx = 0;
    allItems.forEach((item) => {
      const series = workoutSeries[item.workout_id] ?? [];
      const isCardio = (item.muscle_group ?? "").toLowerCase() === "cardio";
      let any = false;
      series.forEach((s) => {
        if (s.completed) {
          totalDone++;
          if (!isCardio) volume += (s.kg || 0) * (s.reps || 0);
          any = true;
        }
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

  // Modal de descanso (contador regressivo em destaque ao concluir uma série)
  const [restModalOpen, setRestModalOpen] = React.useState(false);
  const lastTimerKeyRef = React.useRef(globalRestTimerKey);

  // Séries cujo check foi tentado sem dados — destaca os campos faltantes
  const [invalidSeries, setInvalidSeries] = React.useState<Set<string>>(new Set());
  const seriesKey = (workoutId: string, index: number) => `${workoutId}:${index}`;

  // Swipe-to-delete: qual linha está com o botão de apagar revelado
  const [swipedSeriesKey, setSwipedSeriesKey] = React.useState<string | null>(null);
  const swipeStartX = React.useRef(0);
  const swipeStartY = React.useRef(0);
  const swipeHorizontal = React.useRef(false); // evita interferir no scroll vertical

  // Rest timer
  const startRestTimer = (workoutId: string) => {
    const secs = workoutExerciseRestTimes[workoutId] ?? 60;
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
    setRunSummary({
      distanceKm: result.distanceKm,
      elapsedMs: result.elapsedMs,
      paceSecPerKm: result.paceSecPerKm,
      path: result.path,
    });
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
    const newItems: UserWorkoutWithDetails[] = chosen.map((workout) => ({
      id: `session_${workout.id}`,
      workout_id: workout.id,
      user_id: userId,
      name: null,
      created_at: new Date().toISOString(),
      workoutName: workout.name,
      muscle_group: workout.muscle_group ?? null,
      workoutPhoto: workout.photo ?? null,
      routine_id: null,
    }));
    setWorkoutExtraItems((prev) => [...prev, ...newItems]);
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
  // força (kg E reps) / cardio (min OU km)
  const canCompleteSeries = (row: { kg: number; reps: number }, isCardio: boolean) =>
    isCardio
      ? (row.kg || 0) > 0 || (row.reps || 0) > 0
      : (row.kg || 0) > 0 && (row.reps || 0) > 0;

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
      startRestTimer(workoutId);

      // PR em tempo real — ao concluir uma série de força com peso acima do
      // melhor peso anterior, avisa que o usuário bateu o recorde.
      const kg = row?.kg || 0;
      if (!isCardio && kg > 0) {
        // Baseline: na primeira série concluída do exercício, parte do maior
        // "anterior" (prevKg da última sessão, o mesmo valor exibido na coluna
        // ANTERIOR). Nas próximas, usa o recorde corrente já elevado.
        let best = prevBestRef.current.get(workoutId);
        if (best == null) {
          best = (workoutSeries[workoutId] ?? []).reduce(
            (m, s) => Math.max(m, (s as any).prevKg || 0),
            0,
          );
          prevBestRef.current.set(workoutId, best);
        }
        if (best > 0 && kg > best) {
          const name = allItems.find((i) => i.workout_id === workoutId)?.workoutName ?? "";
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
    }
  };

  // ── Finalizar ───────────────────────────────────────────────

  const hasCompletedSeries = Object.values(workoutSeries).some((list) =>
    list.some((s) => s.completed),
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

      // Query previous bests before saving (so we compare against pre-session records)
      const prevBests = new Map<string, number>();
      await Promise.all(
        exerciseEntries.map(async ([workoutId]) => {
          const row = allItemsForSave.find((w) => w.workout_id === workoutId);
          const isCardio = (row?.muscle_group || "").toLowerCase() === "cardio";
          if (!isCardio) {
            const prev = await getPreviousBestKgDb(userId, workoutId).catch(() => 0);
            prevBests.set(workoutId, prev);
          }
        }),
      );

      for (const [workoutId, series] of exerciseEntries) {
        const completed = series.filter((s) => s.completed);

        const row = allItemsForSave.find((w) => w.workout_id === workoutId);
        const isCardio = (row?.muscle_group || "").toLowerCase() === "cardio";
        const isExtra = workoutExtraItems.some((e) => e.workout_id === workoutId);
        const rawId = isExtra ? null : (row?.id ?? null);
        const userWorkoutId: number | null = rawId && !isNaN(Number(rawId)) ? Number(rawId) : null;

        let bestKg = 0;
        for (const serie of completed) {
          totalSeries++;
          if (!isCardio) {
            totalVolume += (serie.kg || 0) * (serie.reps || 0);
            bestKg = Math.max(bestKg, serie.kg || 0);
          }
          await saveWorkoutHistoryDb(
            userId, userWorkoutId, workoutId,
            serie.kg || null,
            isCardio
              ? (serie.reps ? String(serie.reps) : null)
              : (serie.reps ? `${serie.reps} reps` : null),
            row?.routine_id ?? null,
            new Date(sessionBaseMs + seriesSaveIndex++).toISOString(),
          );
        }

        completedExercises.push({
          name: row?.workoutName ?? workoutId,
          totalSets: completed.length,
          bestKg,
          muscleGroup: row?.muscle_group ?? null,
          photo: row?.workoutPhoto ?? null,
          sets: completed.map((s) => ({ kg: s.kg || 0, reps: s.reps || 0 })),
        });

        if (!isCardio && bestKg > 0) {
          const prev = prevBests.get(workoutId) ?? 0;
          if (bestKg > prev) {
            const name = row?.workoutName ?? workoutId;
            prExercises.push({ name, previousBestKg: prev, newBestKg: bestKg });
            // "Zerando a máquina" = new PR where best kg reaches ≥ 100
            if (bestKg >= 100) {
              machinedExercises.push({ name, kg: bestKg });
            }
          }
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
      });
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
  const catalogFiltered = catalog.filter((w) => {
    if (pickerBrowseMode === "group" && pickerMuscleFilter && w.muscle_group !== pickerMuscleFilter) return false;
    if (pickerSearch && !w.name.toLowerCase().includes(pickerSearch.toLowerCase())) return false;
    return true;
  });

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
          flex: 1, textAlign: "center",
          fontWeight: 700, fontSize: 17, color: FG,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {routineLabel}
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
      <div style={{
        flex: 1, overflowY: "auto", overflowX: "hidden",
        padding: "12px 12px 96px",
      }}>
        {filteredItems.map((item) => {
          const series = workoutSeries[item.workout_id] ?? [];
          const isExpanded = expandedId === item.workout_id;
          const doneSeries = series.filter((s) => s.completed).length;
          const restSecs = workoutExerciseRestTimes[item.workout_id] ?? 60;
          const isCardio = (item.muscle_group ?? "").toLowerCase() === "cardio";
          // Corrida ao Ar Livre: modo GPS estilo Strava — a tabela de séries
          // (MIN×KM manual) fica oculta; quem registra é o painel de corrida.
          const isRunExercise = isOutdoorRun(item.workoutName);
          const noteOpen = noteOpenIds.has(item.workout_id);
          const note = workoutExerciseNotes[item.workout_id] ?? "";

          return (
            <div
              key={item.id}
              style={{
                background: CARD, borderRadius: 24, overflow: "hidden",
                marginBottom: 20, position: "relative",
                border: `1px solid ${BORDER}`,
                backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
                boxShadow: "0 8px 32px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.08)",
              }}
            >
              {/* ── EXERCISE HEADER ─────────────────────────── */}
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px 0",
              }}>
                <span style={{
                  fontSize: 13, fontWeight: 700, color: FG,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
                }}>
                  {item.workoutName}
                </span>
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
                      {doneSeries}/{series.length}
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
                      {doneSeries}/{series.length}
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
                    {/* Tendência (decorativo) */}
                    <svg width="18" height="14" viewBox="0 0 18 14" fill="none" opacity={0.45}>
                      <path d="M1 11L5.5 6.5l3.5 2.5L15 2" stroke={MUTED_FG} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 2h3v3" stroke={MUTED_FG} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>

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
                        const idx = REST_PRESETS.indexOf(restSecs);
                        const next = REST_PRESETS[(idx + 1) % REST_PRESETS.length];
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
                      const kgInvalid = rowInvalid && (row.kg || 0) <= 0;
                      const repsInvalid = rowInvalid && (row.reps || 0) <= 0;

                      const sKey = seriesKey(item.workout_id, idx);
                      const isSwipeOpen = swipedSeriesKey === sKey;

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
                          {/* # badge */}
                          <div style={{ display: "flex", justifyContent: "center" }}>
                            <div style={{
                              width: 30, height: 30, borderRadius: "50%",
                              background: row.completed ? PRIMARY : SURFACE,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 12, fontWeight: 800,
                              color: row.completed ? PRIMARY_FG : MUTED_FG,
                            }}>
                              {idx + 1}
                            </div>
                          </div>

                          {/* ANTERIOR */}
                          <div style={{
                            textAlign: "center", fontSize: 12, fontWeight: 600,
                            color: MUTED_FG, opacity: 0.75,
                          }}>
                            {anteriorText}
                          </div>

                          {/* KG */}
                          <input
                            type="number"
                            inputMode="decimal"
                            value={row.kg || ""}
                            placeholder={kgInvalid ? "!" : "—"}
                            onChange={(e) => updateSeries(item.workout_id, idx, "kg", Number(e.target.value), isCardio)}
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

                          {/* REPS */}
                          <input
                            type="number"
                            inputMode="numeric"
                            value={row.reps || ""}
                            placeholder={repsInvalid ? "!" : "—"}
                            onChange={(e) => updateSeries(item.workout_id, idx, "reps", Number(e.target.value), isCardio)}
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
                        </div>
                      );
                    })}

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
              <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
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
                              {w.name}
                            </div>
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
          />
        );
      })()}

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
                  { label: t("goals_run_time"), value: fmtRunTime(runSummary.elapsedMs), unit: null },
                  { label: t("goals_run_pace"), value: fmtPace(runSummary.paceSecPerKm), unit: "/km" },
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
