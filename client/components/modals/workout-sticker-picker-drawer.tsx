import * as React from "react";
import { Dumbbell, Loader2 } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import {
  FlowWorkoutSticker,
  MAX_STICKER_EXERCISES,
} from "@/components/shared/flow-workout-sticker";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/lib/language-context";
import { GLASS_SHEET_STYLE, GLASS_SHEET_PROPS } from "@/lib/glass-styles";
import { hapticLight } from "@/lib/haptics";
import {
  getRecentWorkoutSessionsDb,
  type RecentWorkoutSession,
  type StoryWorkoutSticker,
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
  };
}

interface WorkoutStickerPickerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Escolha do usuário — o pai posiciona o mini frame sobre o flow. */
  onSelect: (sticker: StoryWorkoutSticker) => void;
}

/**
 * Drawer de escolha do treino a ser citado no flow (estilo "repost"). Lista as
 * últimas sessões finalizadas do usuário — o snapshot que cada rotina guarda em
 * `routines.last_summary` — já renderizadas como o mini frame que vai para o
 * flow, então a seleção é WYSIWYG.
 */
export function WorkoutStickerPickerDrawer({
  open,
  onOpenChange,
  onSelect,
}: WorkoutStickerPickerDrawerProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [sessions, setSessions] = React.useState<RecentWorkoutSession[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open || !user?.id) return;
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
  }, [open, user?.id]);

  const handlePick = (session: RecentWorkoutSession) => {
    hapticLight();
    onSelect(sessionToSticker(session));
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
          <DrawerTitle className="text-base font-semibold text-white text-left">
            {t("flow_workout_picker_title")}
          </DrawerTitle>
          <DrawerDescription className="text-xs text-white/60 text-left">
            {t("flow_workout_picker_desc")}
          </DrawerDescription>
        </DrawerHeader>

        <div
          className="flex-1 overflow-y-auto px-4"
          style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        >
          {isLoading ? (
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
