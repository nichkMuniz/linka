import * as React from "react";
import { CalendarDays, Plus } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { RoutinesTab } from "@/components/goals/routines-tab";
import { RoutineScheduleModal } from "@/components/goals/routine-schedule-modal";
import { useLanguage } from "@/lib/language-context";
import { GLASS_SHEET_STYLE, GLASS_SHEET_PROPS } from "@/lib/glass-styles";
import type { RoutineCard } from "@/components/goals/goals-helpers";
import type { RoutineTypeCode, UserGoal } from "@/lib/ritmofit-db";

interface RoutineListDrawerProps {
  /** 1=treino, 2=dieta, 3=hábito */
  type: RoutineTypeCode;
  open: boolean;
  onClose: () => void;
  /** todos os cards (o RoutinesTab filtra pelo tipo) */
  cards: RoutineCard[];
  userGoals: UserGoal[];
  routineLastDates: Record<string, string>;
  activeWorkoutName: string | null;
  onStartWorkout: (card: RoutineCard) => void;
  onOpenCard: (card: RoutineCard) => void;
  /** botão "+" — criar nova rotina deste tipo */
  onCreate: () => void;
}

const TITLE_KEY = {
  1: "goals_exercise_routines_title",
  2: "goals_diet_routines_title",
  3: "goals_habit_routines_title",
} as const;

/**
 * Drawer glass que lista as rotinas já cadastradas de um tipo (treino/dieta/
 * hábito), com um botão "+" no cabeçalho para criar mais uma. Reaproveita o
 * `RoutinesTab` (filtrado pelo tipo) para renderizar os cards.
 */
export function RoutineListDrawer({
  type,
  open,
  onClose,
  cards,
  userGoals,
  routineLastDates,
  activeWorkoutName,
  onStartWorkout,
  onOpenCard,
  onCreate,
}: RoutineListDrawerProps) {
  const { t } = useLanguage();
  const [scheduleOpen, setScheduleOpen] = React.useState(false);

  // Só as rotinas deste tipo entram na agenda (o drawer é por tipo).
  const typeCards = React.useMemo(
    () => cards.filter((c) => c.type === type),
    [cards, type],
  );

  return (
    <Drawer
      open={open}
      onOpenChange={(v) => { if (!v) onClose(); }}
      noBodyStyles
      shouldScaleBackground={false}
    >
      <DrawerContent
        {...GLASS_SHEET_PROPS}
        onOpenAutoFocus={(e) => e.preventDefault()}
        style={GLASS_SHEET_STYLE}
      >
        <DrawerHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <DrawerTitle className="text-base font-semibold text-white">
              {t(TITLE_KEY[type])}
            </DrawerTitle>
            <div className="flex items-center gap-2 shrink-0">
              {/* Agenda semanal — só faz sentido com rotina(s) cadastrada(s). */}
              {typeCards.length > 0 && (
                <button
                  onClick={() => setScheduleOpen(true)}
                  aria-label={t("goals_schedule_open")}
                  className="h-9 w-9 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
                  style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.16)" }}
                >
                  <CalendarDays className="h-5 w-5" />
                </button>
              )}
              <button
                onClick={onCreate}
                aria-label={t("goals_create_routine")}
                className="h-9 w-9 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
                style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)" }}
              >
                <Plus className="h-5 w-5" strokeWidth={2.4} />
              </button>
            </div>
          </div>
        </DrawerHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-6">
          <RoutinesTab
            cards={cards}
            userGoals={userGoals}
            routineLastDates={routineLastDates}
            activeWorkoutName={activeWorkoutName}
            onStartWorkout={onStartWorkout}
            onOpenCard={onOpenCard}
            onCreateRoutine={onCreate}
            onOpenSuggestions={onCreate}
            filterType={type}
          />
        </div>

        {/* Agenda semanal (renderizada dentro do drawer para herdar seu
            stacking context — z acima do conteúdo do próprio drawer). */}
        <RoutineScheduleModal
          open={scheduleOpen}
          onClose={() => setScheduleOpen(false)}
          cards={typeCards}
          type={type}
          onOpenCard={onOpenCard}
        />
      </DrawerContent>
    </Drawer>
  );
}
