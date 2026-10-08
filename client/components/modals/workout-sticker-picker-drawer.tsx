import * as React from "react";
import { ArrowLeft, Check, Dumbbell, Loader2 } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import {
  FlowWorkoutSticker,
  MAX_STICKER_EXERCISES,
  WORKOUT_STICKER_FIELDS,
  applyStickerFields,
} from "@/components/shared/flow-workout-sticker";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/lib/language-context";
import { GLASS_SHEET_STYLE, GLASS_SHEET_PROPS } from "@/lib/glass-styles";
import { hapticLight } from "@/lib/haptics";
import type { TranslationKey } from "@/lib/i18n";
import {
  getRecentWorkoutSessionsDb,
  type RecentWorkoutSession,
  type StoryWorkoutSticker,
  type WorkoutStickerField,
} from "@/lib/ritmofit-db";

/**
 * Converte a sessão de treino no snapshot enxuto que vai dentro do flow —
 * cortando a lista de exercícios no que cabe no card.
 */
export function sessionToSticker(session: RecentWorkoutSession): StoryWorkoutSticker {
  const shown = session.exercises.slice(0, MAX_STICKER_EXERCISES);
  return {
    name: session.routineName,
    date: session.completedAt,
    totalSeries: session.totalSeries,
    totalVolume: session.totalVolume,
    durationSecs: session.durationSecs,
    prCount: session.prCount || undefined,
    caloriesKcal: session.caloriesKcal || undefined,
    exercises: shown,
    extraCount: session.exercises.length - shown.length || undefined,
    // O card corta em 8; o "Ver treino" do flow mostra todos.
    allExercises: session.exercises.length > shown.length ? session.exercises : undefined,
  };
}

/** O que o drawer devolve: o snapshot completo + os blocos que o autor ocultou. */
export type WorkoutStickerChoice = {
  full: StoryWorkoutSticker;
  hidden: WorkoutStickerField[];
};

const FIELD_LABEL: Record<WorkoutStickerField, TranslationKey> = {
  date: "flow_workout_field_date",
  series: "flow_workout_field_series",
  volume: "flow_workout_field_volume",
  duration: "flow_workout_field_duration",
  calories: "flow_workout_field_calories",
  prs: "flow_workout_field_prs",
  exercises: "flow_workout_field_exercises",
};

/** Atalhos de apresentação — cada um é só uma lista de blocos ocultos. */
const PRESETS: Array<{ key: TranslationKey; hidden: WorkoutStickerField[] }> = [
  { key: "flow_workout_preset_full", hidden: [] },
  { key: "flow_workout_preset_numbers", hidden: ["exercises"] },
  { key: "flow_workout_preset_minimal", hidden: ["volume", "calories", "prs", "exercises"] },
];

// Última escolha do usuário — conveniência por aparelho (a do flow publicado
// vive no próprio snapshot). Leitura/escrita toleram storage indisponível.
const HIDDEN_STORAGE_KEY = "lk:flow-workout-hidden";

function loadLastHidden(): WorkoutStickerField[] {
  try {
    const raw = JSON.parse(localStorage.getItem(HIDDEN_STORAGE_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((f): f is WorkoutStickerField => WORKOUT_STICKER_FIELDS.includes(f)) : [];
  } catch {
    return [];
  }
}

function saveLastHidden(hidden: WorkoutStickerField[]) {
  try {
    localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify(hidden));
  } catch {
    /* storage indisponível — só não lembra a escolha */
  }
}

/** Blocos que existem nesta sessão (não faz sentido oferecer "calorias" sem calorias). */
function availableFields(full: StoryWorkoutSticker): WorkoutStickerField[] {
  return WORKOUT_STICKER_FIELDS.filter((f) => {
    switch (f) {
      case "volume": return full.totalVolume > 0;
      case "duration": return full.durationSecs > 0;
      case "calories": return Number(full.caloriesKcal ?? 0) > 0;
      case "prs": return Number(full.prCount ?? 0) > 0;
      case "exercises": return (full.exercises?.length ?? 0) > 0;
      default: return true;
    }
  });
}

const sameSet = (a: WorkoutStickerField[], b: WorkoutStickerField[]) =>
  a.length === b.length && a.every((f) => b.includes(f));

interface WorkoutStickerPickerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Escolha do usuário — o pai posiciona o mini frame sobre o flow. */
  onSelect: (choice: WorkoutStickerChoice) => void;
  /**
   * Sticker já colado no flow: o drawer abre direto na personalização dele
   * (botão de ajustes no card). null = escolher um treino.
   */
  editing?: WorkoutStickerChoice | null;
}

/**
 * Drawer do treino citado no flow (estilo "repost"), em duas etapas:
 * 1. lista as últimas sessões finalizadas (`routines.last_summary`), já como o
 *    mini frame que vai para o flow;
 * 2. personalização: o autor escolhe quais blocos o card mostra, com prévia ao
 *    vivo e atalhos ("Completo", "Só números", "Mínimo").
 */
export function WorkoutStickerPickerDrawer({
  open,
  onOpenChange,
  onSelect,
  editing = null,
}: WorkoutStickerPickerDrawerProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [sessions, setSessions] = React.useState<RecentWorkoutSession[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  // Etapa 2: snapshot em personalização (null = etapa 1, lista de treinos).
  const [draft, setDraft] = React.useState<StoryWorkoutSticker | null>(null);
  const [hidden, setHidden] = React.useState<WorkoutStickerField[]>([]);

  // A cada abertura: reedição cai direto na etapa 2; seleção nova, na 1.
  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setDraft(editing.full);
      setHidden(editing.hidden);
    } else {
      setDraft(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (!open || editing || !user?.id) return;
    let cancelled = false;
    setIsLoading(true);
    getRecentWorkoutSessionsDb(user.id)
      .then((rows) => {
        if (!cancelled) setSessions(rows);
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePick = (session: RecentWorkoutSession) => {
    hapticLight();
    setDraft(sessionToSticker(session));
    setHidden(loadLastHidden());
  };

  const fields = draft ? availableFields(draft) : [];
  // Só conta o que existe nesta sessão: ocultar "calorias" num treino sem
  // calorias não muda nada e não deve desmarcar o atalho ativo.
  const effectiveHidden = hidden.filter((f) => fields.includes(f));

  const toggleField = (field: WorkoutStickerField) => {
    hapticLight();
    setHidden((prev) => (prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]));
  };

  const handleConfirm = () => {
    if (!draft) return;
    hapticLight();
    saveLastHidden(hidden);
    onSelect({ full: draft, hidden: effectiveHidden });
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} noBodyStyles shouldScaleBackground={false}>
      <DrawerContent
        {...GLASS_SHEET_PROPS}
        onOpenAutoFocus={(e) => e.preventDefault()}
        style={GLASS_SHEET_STYLE}
      >
        <DrawerHeader className="pb-2">
          <div className="flex items-center gap-2">
            {draft && !editing && (
              <button
                onClick={() => setDraft(null)}
                className="-ml-1 p-1 rounded-full text-white/70 active:opacity-60"
                aria-label={t("flow_workout_change")}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <DrawerTitle className="text-base font-semibold text-white text-left">
              {draft ? t("flow_workout_customize_title") : t("flow_workout_picker_title")}
            </DrawerTitle>
          </div>
          <DrawerDescription className="text-xs text-white/60 text-left">
            {draft ? t("flow_workout_customize_desc") : t("flow_workout_picker_desc")}
          </DrawerDescription>
        </DrawerHeader>

        <div
          className="flex-1 overflow-y-auto px-4"
          style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        >
          {draft ? (
            <div className="flex flex-col gap-4 pb-2">
              {/* Prévia ao vivo — o mesmo componente que vai para o flow */}
              <div className="flex justify-center py-2">
                <FlowWorkoutSticker data={applyStickerFields(draft, effectiveHidden)} />
              </div>

              {/* Atalhos */}
              <div className="grid grid-cols-3 gap-2">
                {PRESETS.map((preset) => {
                  const presetHidden = preset.hidden.filter((f) => fields.includes(f));
                  const active = sameSet(presetHidden, effectiveHidden);
                  return (
                    <button
                      key={preset.key}
                      onClick={() => {
                        hapticLight();
                        setHidden(preset.hidden);
                      }}
                      className="rounded-full px-3 py-2 text-xs font-semibold transition-colors"
                      style={{
                        background: active ? "rgba(91,140,255,.22)" : "rgba(255,255,255,.07)",
                        border: `1px solid ${active ? "rgba(91,140,255,.55)" : "rgba(255,255,255,.12)"}`,
                        color: active ? "#fff" : "rgba(255,255,255,.75)",
                      }}
                    >
                      {t(preset.key)}
                    </button>
                  );
                })}
              </div>

              {/* Blocos individuais */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-white/60">{t("flow_workout_fields_label")}</p>
                <div className="flex flex-wrap gap-2">
                  {fields.map((field) => {
                    const shown = !effectiveHidden.includes(field);
                    return (
                      <button
                        key={field}
                        onClick={() => toggleField(field)}
                        aria-pressed={shown}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
                        style={{
                          background: shown ? "rgba(255,255,255,.14)" : "transparent",
                          border: `1px solid ${shown ? "rgba(255,255,255,.3)" : "rgba(255,255,255,.14)"}`,
                          color: shown ? "#fff" : "rgba(255,255,255,.45)",
                        }}
                      >
                        {shown && <Check className="h-3 w-3" />}
                        {t(FIELD_LABEL[field])}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button
                onClick={handleConfirm}
                className="w-full rounded-full border-0"
                style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
              >
                {editing ? t("flow_workout_customize_save") : t("flow_workout_customize_add")}
              </Button>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-white/70" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center text-center gap-2 py-10 px-6">
              <div
                className="h-12 w-12 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)" }}
              >
                <Dumbbell className="h-5 w-5 text-white/70" />
              </div>
              <p className="text-sm font-semibold text-white">{t("flow_workout_empty")}</p>
              <p className="text-xs text-white/60">{t("flow_workout_empty_desc")}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 pb-2">
              {sessions.map((session) => (
                <button
                  key={session.routineId}
                  onClick={() => handlePick(session)}
                  className="active:opacity-70 transition-opacity"
                  aria-label={session.routineName}
                >
                  <FlowWorkoutSticker data={sessionToSticker(session)} />
                </button>
              ))}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
