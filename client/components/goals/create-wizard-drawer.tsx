import * as React from "react";
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronRight,
  Dumbbell,
  Loader2,
  Pencil,
  Plus,
  Repeat2,
  RotateCcw,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { ExerciseImage } from "@/components/shared/exercise-image";
import { DietImage } from "@/components/shared/diet-image";
import { ItemDetailDrawer, type ItemDetailData } from "@/components/goals/item-detail-drawer";
import { PaywallDrawer } from "@/components/shared/paywall-drawer";
import { usePremium } from "@/lib/premium-context";
import { useLanguage } from "@/lib/language-context";
import type { TranslationKey } from "@/lib/i18n";
import { useKeyboardAwareHeight } from "@/hooks/use-keyboard-aware-height";
import {
  backfillRoutineIdOnItemsDb,
  createCustomDietDb,
  createCustomGoalAndSelectDb,
  createCustomHabitDb,
  createCustomWorkoutDb,
  createUserDietsDb,
  createUserGoalDb,
  createUserHabitsDb,
  createUserWorkoutsDb,
  getDietsDb,
  getFitnessProfileDb,
  getHabitsDb,
  getProgrammedGoalsDb,
  getUserRoutinesDb,
  getUserSelectedGoalIdsDb,
  getWorkoutNameIdIndexDb,
  getWorkoutsDb,
  updateRoutineGoalDb,
  updateRoutineItemsScheduledTimeDb,
  updateRoutineItemsScheduledDaysDb,
  updateRoutineItemScheduledTimeDb,
  updateRoutineProgramMetaDb,
  upsertFitnessProfileDb,
  type Diet,
  type Habit,
  type ProgrammedGoal,
  type RoutineProgramMeta,
  type RoutineTypeCode,
  type UserGoal,
  type UserHabit,
  type Workout,
} from "@/lib/ritmofit-db";
import {
  type FitnessLevel,
  type ProgramWorkout,
  type SuggestedExercise,
  type WeeklyProgram,
} from "@/components/goals/suggested-routines-data";
import {
  generateProgram,
  MUSCLE_EMPHASES,
  SESSION_MINUTES_OPTIONS,
  TRAINING_GOALS,
  TRAINING_LOCATIONS,
  type MuscleEmphasis,
  type SessionMinutes,
  type TrainingGoal,
  type TrainingLocation,
} from "@/components/goals/program-generator";

type WizardStep =
  | "what"
  | "routine-origin"
  | "quiz-goal"
  | "quiz-level"
  | "quiz-days"
  | "quiz-time"
  | "quiz-location"
  | "quiz-emphasis"
  | "suggested-program"
  | "suggested-goal"
  | "build-name"
  | "build"
  | "build-schedule"
  | "goal-origin"
  | "goal-catalog"
  | "goal-custom";

// Dias da semana (seg→dom), índices 0–6 — convenção Monday-first do app.
const WEEKDAY_KEYS: TranslationKey[] = [
  "goals_weekday_mon",
  "goals_weekday_tue",
  "goals_weekday_wed",
  "goals_weekday_thu",
  "goals_weekday_fri",
  "goals_weekday_sat",
  "goals_weekday_sun",
];

/** Target routine when the wizard opens in "add items" mode (see {@link CreateWizardDrawerProps.editRoutine}). */
export interface EditRoutineTarget {
  type: RoutineTypeCode;
  /** null = unnamed group of this type */
  name: string | null;
  /** routines.id when resolved — lets new items be linked without relying on name-matching */
  routineId: string | null;
  /** catalog ids (workout_id/diet_id/habit_id) already in the routine — pre-selected and locked */
  existingItemIds: string[];
  scheduledTime: string | null;
  scheduledDays: string | null;
}

interface CreateWizardDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userGoals: UserGoal[];
  /** nº de rotinas ativas do usuário — grátis cria só 1 (gate premium) */
  activeRoutineCount: number;
  /** opens directly on a given step (e.g. empty states) */
  initialStep?: WizardStep;
  /** pre-selects the routine type when opening at the "build" step */
  initialRoutineType?: RoutineTypeCode;
  /** when set, the wizard opens straight into "build" to add more items to this existing routine instead of creating a new one */
  editRoutine?: EditRoutineTarget | null;
  onCreated: (kind: "routine" | "goal") => void;
}

const GOAL_TYPES: Array<{ value: 1 | 2 | 3; emoji: string; labelKey: TranslationKey }> = [
  { value: 1, emoji: "💪", labelKey: "goals_type_fitness" },
  { value: 2, emoji: "🏥", labelKey: "goals_type_health" },
  { value: 3, emoji: "✨", labelKey: "goals_type_habits" },
];

const DURATION_PRESETS = [30, 60, 90];

const LEVELS: Array<{
  value: FitnessLevel;
  emoji: string;
  labelKey: TranslationKey;
  descKey: TranslationKey;
}> = [
  { value: "beginner", emoji: "🌱", labelKey: "goals_level_beginner", descKey: "goals_level_beginner_desc" },
  { value: "intermediate", emoji: "🔥", labelKey: "goals_level_intermediate", descKey: "goals_level_intermediate_desc" },
  { value: "advanced", emoji: "⚡", labelKey: "goals_level_advanced", descKey: "goals_level_advanced_desc" },
];

// ── Opções do quiz de personalização ("Sugerido pelo app") ──────────────────

const QUIZ_GOALS: Array<{
  value: TrainingGoal;
  emoji: string;
  labelKey: TranslationKey;
  descKey: TranslationKey;
}> = [
  { value: "hypertrophy", emoji: "💪", labelKey: "goals_quiz_goal_hypertrophy", descKey: "goals_quiz_goal_hypertrophy_desc" },
  { value: "fat_loss", emoji: "🔥", labelKey: "goals_quiz_goal_fat_loss", descKey: "goals_quiz_goal_fat_loss_desc" },
  { value: "strength", emoji: "🏋️", labelKey: "goals_quiz_goal_strength", descKey: "goals_quiz_goal_strength_desc" },
  { value: "conditioning", emoji: "⚡", labelKey: "goals_quiz_goal_conditioning", descKey: "goals_quiz_goal_conditioning_desc" },
];

const QUIZ_TIMES: Array<{
  value: SessionMinutes;
  emoji: string;
  labelKey: TranslationKey;
  descKey: TranslationKey;
}> = [
  { value: 30, emoji: "⚡", labelKey: "goals_quiz_time_30", descKey: "goals_quiz_time_30_desc" },
  { value: 45, emoji: "⏱️", labelKey: "goals_quiz_time_45", descKey: "goals_quiz_time_45_desc" },
  { value: 60, emoji: "💪", labelKey: "goals_quiz_time_60", descKey: "goals_quiz_time_60_desc" },
  { value: 75, emoji: "🔥", labelKey: "goals_quiz_time_75", descKey: "goals_quiz_time_75_desc" },
];

const QUIZ_LOCATIONS: Array<{
  value: TrainingLocation;
  emoji: string;
  labelKey: TranslationKey;
  descKey: TranslationKey;
}> = [
  { value: "gym", emoji: "🏋️", labelKey: "goals_quiz_location_gym", descKey: "goals_quiz_location_gym_desc" },
  { value: "home", emoji: "🏠", labelKey: "goals_quiz_location_home", descKey: "goals_quiz_location_home_desc" },
];

const QUIZ_EMPHASES: Array<{
  value: MuscleEmphasis;
  emoji: string;
  labelKey: TranslationKey;
  descKey: TranslationKey;
}> = [
  { value: "balanced", emoji: "⚖️", labelKey: "goals_quiz_emphasis_balanced", descKey: "goals_quiz_emphasis_balanced_desc" },
  { value: "lower", emoji: "🦵", labelKey: "goals_quiz_emphasis_lower", descKey: "goals_quiz_emphasis_lower_desc" },
  { value: "upper", emoji: "💪", labelKey: "goals_quiz_emphasis_upper", descKey: "goals_quiz_emphasis_upper_desc" },
];

export function CreateWizardDrawer({
  open,
  onOpenChange,
  userId,
  userGoals,
  activeRoutineCount,
  initialStep = "what",
  initialRoutineType = 1,
  editRoutine = null,
  onCreated,
}: CreateWizardDrawerProps) {
  const { t, language } = useLanguage();
  const { isPremium } = usePremium();
  const viewportHeight = useKeyboardAwareHeight();

  const [step, setStep] = React.useState<WizardStep>(initialStep);
  const [history, setHistory] = React.useState<WizardStep[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);

  // ── Gate premium: grátis mantém 1 rotina ativa ─────────────────────────────
  // Bloqueia CRIAR nova rotina (nunca "adicionar itens" a uma existente, nem
  // metas). Backstops nos handlers de salvar cobrem qualquer caminho de UI.
  const routineGateBlocked = !isPremium && !editRoutine && activeRoutineCount >= 1;
  const [paywallOpen, setPaywallOpen] = React.useState(false);
  // Abertura direta já no fluxo de rotina (ex: botão "+" da lista de rotinas):
  // mostra o paywall por cima; ao dispensá-lo, fecha o wizard junto.
  const paywallClosesWizard =
    routineGateBlocked && (step === "routine-origin" || step === "build-name" || step === "build");
  React.useEffect(() => {
    if (open && paywallClosesWizard) setPaywallOpen(true);
  }, [open, paywallClosesWizard]);

  // routine state
  const [routineType, setRoutineType] = React.useState<RoutineTypeCode>(1);
  const [routineName, setRoutineName] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [scheduledTime, setScheduledTime] = React.useState("");
  // Horários individuais por hábito (chave = habit_id do catálogo) quando a rotina tem 2+ hábitos
  const [habitTimes, setHabitTimes] = React.useState<Record<string, string>>({});
  const [scheduledDays, setScheduledDays] = React.useState<Set<number>>(new Set());
  const [linkGoalId, setLinkGoalId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [muscleFilter, setMuscleFilter] = React.useState<string | null>(null);
  // "list" = todos os itens; "group" = navegar por músculo/categoria
  const [browseMode, setBrowseMode] = React.useState<"list" | "group">("list");
  // item aberto no drawer de detalhe (imagem ampliada + descrição)
  const [detailItem, setDetailItem] = React.useState<ItemDetailData | null>(null);
  const [showCustomForm, setShowCustomForm] = React.useState(false);
  const [customName, setCustomName] = React.useState("");
  const [customExtra, setCustomExtra] = React.useState("");
  const [isCreatingCustom, setIsCreatingCustom] = React.useState(false);

  // catalogs (lazy)
  const [workouts, setWorkouts] = React.useState<Workout[]>([]);
  const [diets, setDiets] = React.useState<Diet[]>([]);
  const [habits, setHabits] = React.useState<Habit[]>([]);
  const [catalogLoading, setCatalogLoading] = React.useState(false);

  // suggested weekly program — quiz de personalização (respostas → generateProgram)
  const [level, setLevel] = React.useState<FitnessLevel | null>(null);
  const [quizGoal, setQuizGoal] = React.useState<TrainingGoal | null>(null);
  const [quizDays, setQuizDays] = React.useState<Set<number>>(new Set());
  const [quizTime, setQuizTime] = React.useState<SessionMinutes | null>(null);
  const [quizLocation, setQuizLocation] = React.useState<TrainingLocation | null>(null);
  const [quizEmphasis, setQuizEmphasis] = React.useState<MuscleEmphasis | null>(null);
  // perfil fitness salvo (última criação) carregado uma vez para pré-preencher o quiz
  const [quizProfileLoaded, setQuizProfileLoaded] = React.useState(false);
  const [expandedDay, setExpandedDay] = React.useState<string | null>(null);
  const [addingProgram, setAddingProgram] = React.useState(false);
  // editable copy of the suggested program (exercises + days can be customized before adding)
  const [programDraft, setProgramDraft] = React.useState<WeeklyProgram | null>(null);
  const [editingWorkoutKey, setEditingWorkoutKey] = React.useState<string | null>(null);
  const [addExerciseFor, setAddExerciseFor] = React.useState<string | null>(null);
  const [exerciseSearch, setExerciseSearch] = React.useState("");

  // goal state
  const [programmedGoals, setProgrammedGoals] = React.useState<ProgrammedGoal[]>([]);
  const [selectedGoalIds, setSelectedGoalIds] = React.useState<string[]>([]);
  const [goalsLoading, setGoalsLoading] = React.useState(false);
  const [goalDescription, setGoalDescription] = React.useState("");
  const [goalType, setGoalType] = React.useState<1 | 2 | 3>(1);
  const [goalDuration, setGoalDuration] = React.useState(30);
  const [goalCustomDuration, setGoalCustomDuration] = React.useState("");
  const [useCustomDuration, setUseCustomDuration] = React.useState(false);
  // Frequência = nº de dias de execução para concluir a meta (quantity / denominador do progresso)
  const [goalFrequency, setGoalFrequency] = React.useState("");
  const [addingGoalId, setAddingGoalId] = React.useState<string | null>(null);

  // reset on close
  React.useEffect(() => {
    if (!open) {
      setStep(initialStep);
      setHistory([]);
      setRoutineType(1);
      setRoutineName("");
      setSelectedIds(new Set());
      setScheduledTime("");
      setHabitTimes({});
      setScheduledDays(new Set());
      setLinkGoalId(null);
      setSearchQuery("");
      setMuscleFilter(null);
      setBrowseMode("list");
      setShowCustomForm(false);
      setCustomName("");
      setCustomExtra("");
      setLevel(null);
      setQuizGoal(null);
      setQuizDays(new Set());
      setQuizTime(null);
      setQuizLocation(null);
      setQuizEmphasis(null);
      setQuizProfileLoaded(false);
      setExpandedDay(null);
      setProgramDraft(null);
      setEditingWorkoutKey(null);
      setAddExerciseFor(null);
      setExerciseSearch("");
      setGoalDescription("");
      setGoalType(1);
      setGoalDuration(30);
      setGoalCustomDuration("");
      setUseCustomDuration(false);
      setGoalFrequency("");
    } else if (editRoutine) {
      setStep("build");
      setHistory([]);
      setRoutineType(editRoutine.type);
      setRoutineName(editRoutine.name ?? "");
      setSelectedIds(new Set(editRoutine.existingItemIds));
      setSearchQuery("");
      setMuscleFilter(null);
      setBrowseMode("list");
      setShowCustomForm(false);
      setCustomName("");
      setCustomExtra("");
    } else {
      setStep(initialStep);
      setRoutineType(initialRoutineType);
    }
  }, [open, initialStep, initialRoutineType, editRoutine]);

  const goTo = (next: WizardStep) => {
    setHistory((prev) => [...prev, step]);
    setStep(next);
  };

  const goBack = () => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      setStep(next.pop()!);
      return next;
    });
  };

  // lazy-load catalog when entering build step (also needed to search exercises while editing the suggested program)
  React.useEffect(() => {
    if (!open || (step !== "build" && step !== "suggested-program")) return;
    setCatalogLoading(true);
    const load =
      routineType === 1 || step === "suggested-program" ? getWorkoutsDb().then(setWorkouts)
      : routineType === 2 ? getDietsDb().then(setDiets)
      : getHabitsDb().then(setHabits);
    load
      .catch(() => toast({ title: t("goals_load_error"), variant: "destructive" }))
      .finally(() => setCatalogLoading(false));
  }, [open, step, routineType]); // eslint-disable-line react-hooks/exhaustive-deps

  // lazy-load programmed goals when entering goal catalog
  React.useEffect(() => {
    if (!open || step !== "goal-catalog") return;
    setGoalsLoading(true);
    Promise.all([getProgrammedGoalsDb(), getUserSelectedGoalIdsDb()])
      .then(([goals, ids]) => {
        setProgrammedGoals(goals);
        setSelectedGoalIds(ids);
      })
      .catch(() => toast({ title: t("goals_load_error"), variant: "destructive" }))
      .finally(() => setGoalsLoading(false));
  }, [open, step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pré-preenche o quiz com o perfil fitness salvo na última criação de
  // programa (só preenche o que o usuário ainda não respondeu nesta sessão).
  React.useEffect(() => {
    if (!open || step !== "quiz-goal" || quizProfileLoaded) return;
    setQuizProfileLoaded(true);
    getFitnessProfileDb(userId)
      .then((p) => {
        if (!p) return;
        if (TRAINING_GOALS.includes(p.goal as TrainingGoal)) {
          setQuizGoal((prev) => prev ?? (p.goal as TrainingGoal));
        }
        if (LEVELS.some((l) => l.value === p.level)) {
          setLevel((prev) => prev ?? (p.level as FitnessLevel));
        }
        setQuizDays((prev) => (prev.size > 0 ? prev : new Set(p.trainingDays)));
        if (SESSION_MINUTES_OPTIONS.includes(p.sessionMinutes as SessionMinutes)) {
          setQuizTime((prev) => prev ?? (p.sessionMinutes as SessionMinutes));
        }
        if (TRAINING_LOCATIONS.includes(p.location as TrainingLocation)) {
          setQuizLocation((prev) => prev ?? (p.location as TrainingLocation));
        }
        if (MUSCLE_EMPHASES.includes(p.emphasis as MuscleEmphasis)) {
          setQuizEmphasis((prev) => prev ?? (p.emphasis as MuscleEmphasis));
        }
      })
      .catch(() => {});
  }, [open, step, quizProfileLoaded, userId]);

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // "add items" mode: items already in the routine come pre-selected and locked
  const existingIdsSet = React.useMemo(
    () => new Set(editRoutine?.existingItemIds ?? []),
    [editRoutine],
  );
  const newSelectedCount = editRoutine
    ? Array.from(selectedIds).filter((id) => !existingIdsSet.has(id)).length
    : selectedIds.size;

  const muscleGroups = React.useMemo(() => {
    const set = new Set<string>();
    workouts.forEach((w) => w.muscle_group && set.add(w.muscle_group));
    return Array.from(set).sort();
  }, [workouts]);

  const dietCategories = React.useMemo(() => {
    const set = new Set<string>();
    diets.forEach((d) => d.category && set.add(d.category));
    return Array.from(set).sort();
  }, [diets]);

  const filteredItems = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (routineType === 1) {
      return workouts.filter(
        (w) =>
          (!q || w.name.toLowerCase().includes(q)) &&
          (!muscleFilter || w.muscle_group === muscleFilter),
      );
    }
    if (routineType === 2) {
      return diets.filter(
        (d) =>
          (!q || d.name.toLowerCase().includes(q)) &&
          (!muscleFilter || d.category === muscleFilter),
      );
    }
    return habits.filter((h) => !q || h.name.toLowerCase().includes(q));
  }, [routineType, workouts, diets, habits, searchQuery, muscleFilter]);

  // Rotinas de hábito com 2+ itens ganham um horário por item no passo de agendamento,
  // em vez de um único horário aplicado a todos.
  const selectedHabitsForSchedule = React.useMemo(
    () => habits.filter((h) => selectedIds.has(h.id)),
    [habits, selectedIds],
  );
  const isMultiHabitSchedule = routineType === 3 && selectedHabitsForSchedule.length > 1;

  /** find the just-created routines row (type+name) and link it to a goal */
  const linkNewRoutineToGoal = async (type: RoutineTypeCode, name: string | null, goalUserGoal: string) => {
    const userGoal = userGoals.find((g) => g.id === goalUserGoal);
    if (!userGoal) return;
    const routines = await getUserRoutinesDb(userId);
    const match = routines.find(
      (r) => r.type === type && (name ? r.name === name : !r.name),
    );
    if (match) await updateRoutineGoalDb(match.id, userGoal.goal_id);
  };

  const handleSaveRoutine = async () => {
    if (routineGateBlocked) {
      setPaywallOpen(true);
      return;
    }
    if (selectedIds.size === 0) {
      toast({
        title: t("goals_select_at_least_one"),
        description: t("goals_select_at_least_one_desc"),
        variant: "destructive",
      });
      return;
    }
    setIsSaving(true);
    try {
      const name = routineName.trim() || null;
      const ids = Array.from(selectedIds);

      let insertedIds: string[] = [];
      let insertedHabits: UserHabit[] = [];
      if (routineType === 1) {
        const inserted = await createUserWorkoutsDb(userId, ids, { name: name || undefined });
        insertedIds = inserted.map((i) => i.id);
      } else if (routineType === 2) {
        const inserted = await createUserDietsDb(userId, ids, { name: name || undefined });
        insertedIds = inserted.map((i) => i.id);
      } else {
        const inserted = await createUserHabitsDb(userId, ids, { name: name || undefined });
        insertedIds = inserted.map((i) => i.id);
        insertedHabits = inserted;
      }

      await backfillRoutineIdOnItemsDb(userId, routineType, name, insertedIds).catch(() => {});

      // Rotina de hábito com 2+ itens: aplica um horário por item (casado por habit_id)
      // em vez do horário único de `scheduledTime`.
      const hasIndividualHabitTimes = isMultiHabitSchedule && insertedHabits.length > 1;
      if (hasIndividualHabitTimes) {
        await Promise.all(
          insertedHabits.map((row) => {
            const time = habitTimes[row.habit_id] || null;
            if (!time) return Promise.resolve();
            return updateRoutineItemScheduledTimeDb(userId, 3, row.id, time).catch(() => {});
          }),
        );
      } else if (scheduledTime) {
        await updateRoutineItemsScheduledTimeDb(userId, routineType, name, scheduledTime).catch(() => {});
      }

      const daysStr = Array.from(scheduledDays).sort((a, b) => a - b).join(",");
      if (daysStr) {
        await updateRoutineItemsScheduledDaysDb(userId, routineType, name, daysStr).catch(() => {});
      }

      // Agenda as notificações locais da nova rotina (se tiver horário definido).
      if (scheduledTime || hasIndividualHabitTimes) {
        window.dispatchEvent(new CustomEvent("ritmofit-routines-changed"));
      }

      if (linkGoalId) {
        await linkNewRoutineToGoal(routineType, name, linkGoalId).catch(() => {});
      }

      toast({ title: t("goals_routine_created_toast"), description: name ?? undefined });
      onOpenChange(false);
      onCreated("routine");
    } catch (err: any) {
      toast({
        title: t("goals_add_routines_error"),
        description: err?.message || t("goals_create_error_retry"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddItemsToRoutine = async () => {
    if (!editRoutine) return;
    const newIds = Array.from(selectedIds).filter((id) => !existingIdsSet.has(id));
    if (newIds.length === 0) return;
    setIsSaving(true);
    try {
      const { type, name, routineId, scheduledTime, scheduledDays } = editRoutine;
      let insertedIds: string[] = [];
      if (type === 1) {
        const inserted = await createUserWorkoutsDb(userId, newIds, {
          name: name || undefined,
          routine_id: routineId,
        });
        insertedIds = inserted.map((i) => i.id);
      } else if (type === 2) {
        const inserted = await createUserDietsDb(userId, newIds, {
          name: name || undefined,
          routine_id: routineId,
        });
        insertedIds = inserted.map((i) => i.id);
      } else {
        const inserted = await createUserHabitsDb(userId, newIds, {
          name: name || undefined,
          routine_id: routineId,
        });
        insertedIds = inserted.map((i) => i.id);
      }

      // legacy rows without a resolved routine_id: fall back to the name-matching
      // backfill used by the regular create flow
      if (!routineId) {
        await backfillRoutineIdOnItemsDb(userId, type, name, insertedIds).catch(() => {});
      }

      // keep the new items in sync with the routine's existing reminder/days
      if (scheduledTime) {
        await updateRoutineItemsScheduledTimeDb(userId, type, name, scheduledTime).catch(() => {});
      }
      if (scheduledDays) {
        await updateRoutineItemsScheduledDaysDb(userId, type, name, scheduledDays).catch(() => {});
      }
      if (scheduledTime) {
        window.dispatchEvent(new CustomEvent("ritmofit-routines-changed"));
      }

      toast({ title: t("goals_items_added_toast") });
      onOpenChange(false);
      onCreated("routine");
    } catch (err: any) {
      toast({
        title: t("goals_add_routines_error"),
        description: err?.message || t("goals_create_error_retry"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateCustomItem = async () => {
    if (!customName.trim()) return;
    setIsCreatingCustom(true);
    try {
      if (routineType === 1) {
        const created = await createCustomWorkoutDb(customName.trim(), "", customExtra.trim() || "Outros");
        setWorkouts((prev) => [created, ...prev]);
        setSelectedIds((prev) => new Set(prev).add(created.id));
      } else if (routineType === 2) {
        const calories = customExtra.trim() ? Number(customExtra) : null;
        const created = await createCustomDietDb(customName.trim(), "", null, calories);
        setDiets((prev) => [created, ...prev]);
        setSelectedIds((prev) => new Set(prev).add(created.id));
        toast({ title: t("goals_diet_created") });
      } else {
        const created = await createCustomHabitDb(customName.trim(), customExtra.trim());
        setHabits((prev) => [created, ...prev]);
        setSelectedIds((prev) => new Set(prev).add(created.id));
        toast({ title: t("goals_habit_created") });
      }
      setShowCustomForm(false);
      setCustomName("");
      setCustomExtra("");
    } catch (err: any) {
      toast({
        title: routineType === 2 ? t("goals_error_add_diet") : routineType === 3 ? t("goals_error_add_habit") : t("goals_add_exercise_error"),
        description: err?.message || t("goals_create_error_retry"),
        variant: "destructive",
      });
    } finally {
      setIsCreatingCustom(false);
    }
  };

  // letras dos dias da semana (seg→dom), localizadas
  const weekdayLetters = React.useMemo(() => {
    const fmt = new Intl.DateTimeFormat(language === "en" ? "en-US" : "pt-BR", {
      weekday: "narrow",
    });
    // 2024-01-01 é uma segunda-feira
    return Array.from({ length: 7 }, (_, i) =>
      fmt.format(new Date(2024, 0, 1 + i)).toUpperCase(),
    );
  }, [language]);

  // Programa gerado a partir das respostas do quiz — determinístico (mesmas
  // respostas → mesmo programa). Substitui o catálogo estático por nível.
  const quizDaysKey = React.useMemo(
    () => Array.from(quizDays).sort((a, b) => a - b).join(","),
    [quizDays],
  );
  const selectedProgram = React.useMemo(() => {
    if (!quizGoal || !level || !quizTime || !quizLocation || !quizEmphasis || !quizDaysKey) {
      return null;
    }
    return generateProgram({
      goal: quizGoal,
      level,
      days: quizDaysKey.split(",").map(Number),
      minutes: quizTime,
      emphasis: quizEmphasis,
      location: quizLocation,
    });
  }, [quizGoal, level, quizTime, quizLocation, quizEmphasis, quizDaysKey]);

  // gera uma cópia editável do programa sugerido sempre que o nível muda
  // (o usuário pode alterar exercícios e dias antes de adicionar)
  React.useEffect(() => {
    if (!selectedProgram) {
      setProgramDraft(null);
      return;
    }
    setProgramDraft(JSON.parse(JSON.stringify(selectedProgram)) as WeeklyProgram);
    setEditingWorkoutKey(null);
    setAddExerciseFor(null);
    setExerciseSearch("");
  }, [selectedProgram]);

  const resetProgramDraft = () => {
    if (!selectedProgram) return;
    setProgramDraft(JSON.parse(JSON.stringify(selectedProgram)) as WeeklyProgram);
    setEditingWorkoutKey(null);
    setAddExerciseFor(null);
    setExerciseSearch("");
  };

  const toggleWorkoutDay = (workoutKey: string, dayIndex: number) => {
    setProgramDraft((prev) => {
      if (!prev) return prev;
      const week = [...prev.week];
      week[dayIndex] = week[dayIndex] === workoutKey ? null : workoutKey;
      return { ...prev, week };
    });
  };

  const addExerciseToWorkout = (workoutKey: string, exercise: SuggestedExercise) => {
    setProgramDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        workouts: prev.workouts.map((w) =>
          w.key !== workoutKey
            ? w
            : w.exercises.some((e) => e.name.trim().toLowerCase() === exercise.name.trim().toLowerCase())
              ? w
              : { ...w, exercises: [...w.exercises, exercise] },
        ),
      };
    });
  };

  const removeExerciseFromWorkout = (workoutKey: string, exerciseIndex: number) => {
    const workout = programDraft?.workouts.find((w) => w.key === workoutKey);
    if (workout && workout.exercises.length <= 1) {
      toast({
        title: t("goals_program_min_exercise_title"),
        description: t("goals_program_min_exercise_desc"),
        variant: "destructive",
      });
      return;
    }
    setProgramDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        workouts: prev.workouts.map((w) =>
          w.key === workoutKey ? { ...w, exercises: w.exercises.filter((_, i) => i !== exerciseIndex) } : w,
        ),
      };
    });
  };

  const exercisePickerResults = React.useMemo(() => {
    const q = exerciseSearch.trim().toLowerCase();
    const list = q ? workouts.filter((w) => w.name.toLowerCase().includes(q)) : workouts;
    return list.slice(0, 20);
  }, [workouts, exerciseSearch]);

  /** cria todas as rotinas de um programa semanal de uma vez */
  const handleAddWeeklyProgram = async (program: WeeklyProgram) => {
    if (routineGateBlocked) {
      setPaywallOpen(true);
      return;
    }
    setAddingProgram(true);
    try {
      // casa pelo nome bruto do banco (PT e EN) — independe do idioma da UI,
      // senão usuários em inglês criam customs duplicados sem foto
      const nameIndex = await getWorkoutNameIdIndexDb();

      const created: Array<{ name: string; workout: ProgramWorkout; daysStr: string }> = [];
      for (const workout of program.workouts) {
        const workoutIds: string[] = [];
        for (const ex of workout.exercises) {
          const key = ex.name.trim().toLowerCase();
          let workoutId = nameIndex.get(key);
          if (!workoutId) {
            const createdWorkout = await createCustomWorkoutDb(
              ex.name,
              `${ex.series}x${ex.reps}`,
              ex.muscleGroup,
            );
            nameIndex.set(key, createdWorkout.id); // reaproveita entre dias do mesmo programa
            workoutId = createdWorkout.id;
          }
          workoutIds.push(workoutId);
        }

        const name = language === "en" ? workout.name.en : workout.name.pt;
        const inserted = await createUserWorkoutsDb(userId, workoutIds, { name });
        await backfillRoutineIdOnItemsDb(userId, 1, name, inserted.map((i) => i.id)).catch(() => {});
        // dias da semana deste treino no programa (escolhidos no quiz/preview)
        const days = program.week
          .map((k, i) => (k === workout.key ? i : -1))
          .filter((i) => i >= 0);
        created.push({ name, workout, daysStr: days.join(",") });
      }

      // scheduled_days + metadados do programa + vínculo de meta por rotina criada
      const routines = await getUserRoutinesDb(userId);
      const userGoal = linkGoalId ? (userGoals.find((g) => g.id === linkGoalId) ?? null) : null;
      for (const c of created) {
        if (c.daysStr) {
          await updateRoutineItemsScheduledDaysDb(userId, 1, c.name, c.daysStr).catch(() => {});
        }
        const match = routines.find((r) => r.type === 1 && r.name === c.name);
        if (!match) continue;
        const meta: RoutineProgramMeta = {
          origin: "quiz",
          exercises: c.workout.exercises.map((ex) => ({
            name: ex.name,
            muscleGroup: ex.muscleGroup,
            series: ex.series,
            reps: ex.reps,
          })),
        };
        await updateRoutineProgramMetaDb(match.id, meta).catch(() => {});
        if (userGoal) await updateRoutineGoalDb(match.id, userGoal.goal_id).catch(() => {});
      }

      // salva o perfil fitness — pré-preenche o quiz na próxima criação
      if (quizGoal && level && quizTime && quizLocation && quizEmphasis && quizDays.size > 0) {
        await upsertFitnessProfileDb(userId, {
          goal: quizGoal,
          level,
          trainingDays: Array.from(quizDays).sort((a, b) => a - b),
          sessionMinutes: quizTime,
          emphasis: quizEmphasis,
          location: quizLocation,
        }).catch(() => {});
      }

      toast({
        title: t("goals_program_added_toast"),
        description: t("goals_program_added_desc").replace(
          "{n}",
          String(program.workouts.length),
        ),
      });
      onOpenChange(false);
      onCreated("routine");
    } catch (err: any) {
      toast({
        title: t("goals_add_routines_error"),
        description: err?.message || t("goals_create_error_retry"),
        variant: "destructive",
      });
    } finally {
      setAddingProgram(false);
    }
  };

  const handleSelectProgrammedGoal = async (goal: ProgrammedGoal) => {
    setAddingGoalId(goal.id);
    try {
      await createUserGoalDb(goal.id, userId, goal.type, goal.duration, goal.quantity);
      toast({ title: t("goals_created_toast"), description: goal.description });
      onOpenChange(false);
      onCreated("goal");
    } catch (err: any) {
      toast({
        title: t("goals_create_error"),
        description: err?.message || t("goals_create_error_retry"),
        variant: "destructive",
      });
    } finally {
      setAddingGoalId(null);
    }
  };

  const handleCreateCustomGoal = async () => {
    if (!goalDescription.trim()) {
      toast({
        title: t("goals_create_desc_required"),
        description: t("goals_create_desc_required_desc"),
        variant: "destructive",
      });
      return;
    }
    setIsSaving(true);
    try {
      const duration = useCustomDuration
        ? Math.max(1, Number(goalCustomDuration) || 1)
        : goalDuration;
      const frequency = Math.max(1, Number(goalFrequency) || 1);
      await createCustomGoalAndSelectDb(userId, goalDescription.trim(), goalType, duration, frequency);
      toast({ title: t("goals_created_toast"), description: goalDescription.trim() });
      onOpenChange(false);
      onCreated("goal");
    } catch (err: any) {
      toast({
        title: t("goals_create_error"),
        description: err?.message || t("goals_create_error_retry"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const stepTitle: Record<WizardStep, string> = {
    "what": t("goals_wizard_what_title"),
    "routine-origin": t("goals_wizard_origin_title"),
    "quiz-goal": t("goals_quiz_goal_title"),
    "quiz-level": t("goals_suggest_level_title"),
    "quiz-days": t("goals_quiz_days_title"),
    "quiz-time": t("goals_quiz_time_title"),
    "quiz-location": t("goals_quiz_location_title"),
    "quiz-emphasis": t("goals_quiz_emphasis_title"),
    "suggested-program": t("goals_program_your_week"),
    "suggested-goal": t("goals_link_step_title"),
    "build-name": t("goals_wizard_name_title"),
    "build": t("goals_wizard_items_title"),
    "build-schedule": t("goals_wizard_schedule_title"),
    "goal-origin": t("goals_onboarding_title"),
    "goal-catalog": t("goals_available"),
    "goal-custom": t("goals_create_title"),
  };

  const optionCard = (
    onClick: () => void,
    icon: React.ReactNode,
    title: string,
    desc: string,
  ) => (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-2xl p-4 text-left active:scale-[0.99] transition-all"
      style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}
    >
      <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: "#fff" }}>{title}</p>
        <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>{desc}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "rgba(255,255,255,.4)" }} />
    </button>
  );

  // card de opção do quiz (emoji + label + descrição, com estado selecionado
  // visível quando o usuário volta a um passo já respondido)
  const quizOptionCard = (
    key: string,
    selected: boolean,
    emoji: string,
    title: string,
    desc: string,
    onClick: () => void,
  ) => (
    <button
      key={key}
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-2xl p-4 text-left active:scale-[0.99] transition-all"
      style={selected
        ? { background: "rgba(91,140,255,.1)", border: "1px solid #5b8cff" }
        : { background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}
    >
      <span className="text-2xl shrink-0">{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: "#fff" }}>{title}</p>
        <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>{desc}</p>
      </div>
      {selected ? (
        <Check className="h-4 w-4 shrink-0 text-primary" />
      ) : (
        <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "rgba(255,255,255,.4)" }} />
      )}
    </button>
  );

  // "Pergunta {i} de 6" — progresso do quiz
  const quizStepBadge = (i: number) => (
    <p className="text-[11px] font-semibold uppercase tracking-wide -mt-1" style={{ color: "rgba(255,255,255,.35)" }}>
      {t("goals_quiz_step").replace("{i}", String(i)).replace("{n}", "6")}
    </p>
  );

  // máx. 6 dias de treino — sempre sobra ao menos 1 dia de descanso
  const toggleQuizDay = (idx: number) => {
    setQuizDays((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        if (next.size >= 6) {
          toast({
            title: t("goals_quiz_days_max_title"),
            description: t("goals_quiz_days_max_desc"),
          });
          return prev;
        }
        next.add(idx);
      }
      return next;
    });
  };

  return (
    <>
    <Drawer open={open} onOpenChange={onOpenChange} fixed>
      <DrawerContent
        handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
        className="flex flex-col !rounded-t-[32px] !border-0"
        style={{
          maxHeight: `min(92dvh, ${viewportHeight - 8}px)`,
          background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderTop: "1px solid rgba(255,255,255,.14)",
        }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DrawerHeader className="shrink-0 pb-2">
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={goBack}
                className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "rgba(255,255,255,.1)" }}
                aria-label={t("goals_back")}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <DrawerTitle className="flex-1 text-left" style={{ color: "#fff" }}>
              {step === "build" && editRoutine ? t("goals_wizard_add_items_title") : stepTitle[step]}
            </DrawerTitle>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-3">
          {/* ── Step: what to create ─────────────────────────────── */}
          {step === "what" && (
            <>
              {optionCard(
                () => {
                  if (routineGateBlocked) {
                    setPaywallOpen(true);
                    return;
                  }
                  setRoutineType(1);
                  goTo("routine-origin");
                },
                <Dumbbell className="h-5 w-5" />,
                t("goals_wizard_routine"),
                t("goals_wizard_routine_desc"),
              )}
              {optionCard(
                () => goTo("goal-origin"),
                <Target className="h-5 w-5" />,
                t("goals_wizard_goal"),
                t("goals_wizard_goal_desc"),
              )}
            </>
          )}

          {/* ── Step: routine origin (workouts only) ─────────────── */}
          {step === "routine-origin" && (
            <>
              {optionCard(
                () => goTo("quiz-goal"),
                <Sparkles className="h-5 w-5" />,
                t("goals_wizard_suggested"),
                t("goals_wizard_suggested_desc"),
              )}
              {optionCard(
                () => goTo("build-name"),
                <Pencil className="h-5 w-5" />,
                t("goals_wizard_scratch"),
                t("goals_wizard_scratch_desc"),
              )}
            </>
          )}

          {/* ── Quiz de personalização (1/6): objetivo ───────────── */}
          {step === "quiz-goal" && (
            <>
              {quizStepBadge(1)}
              <p className="text-sm -mt-1" style={{ color: "rgba(255,255,255,.5)" }}>
                {t("goals_quiz_goal_subtitle")}
              </p>
              {QUIZ_GOALS.map((g) =>
                quizOptionCard(g.value, quizGoal === g.value, g.emoji, t(g.labelKey), t(g.descKey), () => {
                  setQuizGoal(g.value);
                  goTo("quiz-level");
                }),
              )}
            </>
          )}

          {/* ── Quiz (2/6): nível ────────────────────────────────── */}
          {step === "quiz-level" && (
            <>
              {quizStepBadge(2)}
              <p className="text-sm -mt-1" style={{ color: "rgba(255,255,255,.5)" }}>
                {t("goals_suggest_level_subtitle")}
              </p>
              {LEVELS.map((l) =>
                quizOptionCard(l.value, level === l.value, l.emoji, t(l.labelKey), t(l.descKey), () => {
                  setLevel(l.value);
                  goTo("quiz-days");
                }),
              )}
            </>
          )}

          {/* ── Quiz (3/6): dias da semana ───────────────────────── */}
          {step === "quiz-days" && (
            <>
              {quizStepBadge(3)}
              <p className="text-sm -mt-1" style={{ color: "rgba(255,255,255,.5)" }}>
                {t("goals_quiz_days_subtitle")}
              </p>
              <div className="flex gap-1.5">
                {WEEKDAY_KEYS.map((key, idx) => {
                  const active = quizDays.has(idx);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleQuizDay(idx)}
                      className="flex-1 h-10 rounded-xl text-xs font-semibold transition-all active:scale-95"
                      style={active
                        ? { background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff", border: "1px solid transparent" }
                        : { background: "rgba(255,255,255,.05)", color: "rgba(255,255,255,.6)", border: "1px solid rgba(255,255,255,.1)" }}
                    >
                      {t(key)}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
                {t("goals_quiz_days_count").replace("{n}", String(quizDays.size))}
              </p>
              <Button
                className="w-full rounded-full h-12"
                style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
                disabled={quizDays.size === 0}
                onClick={() => goTo("quiz-time")}
              >
                {t("goals_continue")}
              </Button>
            </>
          )}

          {/* ── Quiz (4/6): tempo por sessão ─────────────────────── */}
          {step === "quiz-time" && (
            <>
              {quizStepBadge(4)}
              {QUIZ_TIMES.map((o) =>
                quizOptionCard(String(o.value), quizTime === o.value, o.emoji, t(o.labelKey), t(o.descKey), () => {
                  setQuizTime(o.value);
                  goTo("quiz-location");
                }),
              )}
            </>
          )}

          {/* ── Quiz (5/6): local de treino ──────────────────────── */}
          {step === "quiz-location" && (
            <>
              {quizStepBadge(5)}
              {QUIZ_LOCATIONS.map((o) =>
                quizOptionCard(o.value, quizLocation === o.value, o.emoji, t(o.labelKey), t(o.descKey), () => {
                  setQuizLocation(o.value);
                  goTo("quiz-emphasis");
                }),
              )}
            </>
          )}

          {/* ── Quiz (6/6): ênfase muscular ──────────────────────── */}
          {step === "quiz-emphasis" && (
            <>
              {quizStepBadge(6)}
              <p className="text-sm -mt-1" style={{ color: "rgba(255,255,255,.5)" }}>
                {t("goals_quiz_emphasis_subtitle")}
              </p>
              {QUIZ_EMPHASES.map((o) =>
                quizOptionCard(o.value, quizEmphasis === o.value, o.emoji, t(o.labelKey), t(o.descKey), () => {
                  setQuizEmphasis(o.value);
                  setExpandedDay(null);
                  goTo("suggested-program");
                }),
              )}
            </>
          )}

          {/* ── Step: weekly program preview ─────────────────────── */}
          {step === "suggested-program" && programDraft && (
            <>
              {(() => {
                const program = programDraft;
                const progName = language === "en" ? program.name.en : program.name.pt;
                const progDesc =
                  language === "en" ? program.description.en : program.description.pt;
                const trainingDays = program.week.filter(Boolean).length;
                const isCustomized = JSON.stringify(program) !== JSON.stringify(selectedProgram);
                return (
                  <>
                    <div className="rounded-2xl p-4 space-y-2" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-base font-bold tracking-tight" style={{ color: "#fff" }}>{progName}</p>
                          <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>{progDesc}</p>
                        </div>
                        {isCustomized && (
                          <button
                            type="button"
                            onClick={resetProgramDraft}
                            className="flex items-center gap-1 shrink-0 text-[11px] font-semibold px-2 py-1 rounded-full"
                            style={{ color: "rgba(255,255,255,.6)", background: "rgba(255,255,255,.06)" }}
                          >
                            <RotateCcw className="h-3 w-3" />
                            {t("goals_program_reset")}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 pt-1 text-[11px] font-semibold text-muted-foreground">
                        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {t("goals_program_workouts").replace("{n}", String(program.workouts.length))}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-muted/60">
                          {t("goals_program_days").replace("{n}", String(trainingDays))}
                        </span>
                      </div>
                      {/* tira da semana seg→dom */}
                      <div className="flex justify-between gap-1 pt-2">
                        {program.week.map((wk, i) => (
                          <div key={i} className="flex flex-col items-center gap-1 flex-1">
                            <span className="text-[10px] font-semibold text-muted-foreground">
                              {weekdayLetters[i]}
                            </span>
                            <span
                              className={`h-2 w-2 rounded-full ${
                                wk ? "bg-primary" : "bg-muted-foreground/25"
                              }`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* lista dos treinos distintos do programa */}
                    {program.workouts.map((workout) => {
                      const wName = language === "en" ? workout.name.en : workout.name.pt;
                      const expanded = expandedDay === workout.key;
                      const editingThis = editingWorkoutKey === workout.key;
                      // dias da semana em que este treino aparece
                      const days = program.week
                        .map((k, i) => (k === workout.key ? weekdayLetters[i] : null))
                        .filter(Boolean) as string[];
                      return (
                        <div
                          key={workout.key}
                          className="rounded-2xl p-4 space-y-2"
                          style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}
                        >
                          <div className="flex items-center gap-2">
                            <button
                              className="flex-1 flex items-center gap-2 text-left min-w-0"
                              onClick={() => setExpandedDay(expanded ? null : workout.key)}
                            >
                              <span className="text-lg shrink-0">🏋️</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate" style={{ color: "#fff" }}>{wName}</p>
                                <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
                                  {(days.length > 0 ? days.join(" · ") : t("goals_program_rest_day")) + " · " +
                                    t("goals_suggest_n_exercises").replace(
                                      "{n}",
                                      String(workout.exercises.length),
                                    )}
                                </p>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const next = editingThis ? null : workout.key;
                                setEditingWorkoutKey(next);
                                setAddExerciseFor(null);
                                setExerciseSearch("");
                                if (next) setExpandedDay(workout.key);
                              }}
                              className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-all"
                              style={editingThis
                                ? { background: "rgba(91,140,255,.18)", color: "#5b8cff" }
                                : { background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.6)" }}
                              aria-label={t("goals_program_edit_workout")}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setExpandedDay(expanded ? null : workout.key)}
                              className="shrink-0"
                              aria-label={t("goals_edit")}
                            >
                              <ChevronRight
                                className={`h-4 w-4 text-muted-foreground transition-transform ${
                                  expanded ? "rotate-90" : ""
                                }`}
                              />
                            </button>
                          </div>

                          {expanded && (
                            <div className="space-y-2 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
                              {editingThis && (
                                <div className="space-y-1.5 pt-1">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,.4)" }}>
                                    {t("goals_program_days_label")}
                                  </p>
                                  <div className="flex gap-1.5">
                                    {WEEKDAY_KEYS.map((key, idx) => {
                                      const active = program.week[idx] === workout.key;
                                      return (
                                        <button
                                          key={idx}
                                          type="button"
                                          onClick={() => toggleWorkoutDay(workout.key, idx)}
                                          className="flex-1 h-9 rounded-xl text-[11px] font-semibold transition-all active:scale-95"
                                          style={active
                                            ? { background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff", border: "1px solid transparent" }
                                            : { background: "rgba(255,255,255,.05)", color: "rgba(255,255,255,.6)", border: "1px solid rgba(255,255,255,.1)" }}
                                        >
                                          {t(key)}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              <ul className="space-y-1 pt-1">
                                {workout.exercises.map((ex, i) => (
                                  <li
                                    key={i}
                                    className="flex items-center justify-between gap-2 text-xs py-1"
                                  >
                                    <span className="font-medium truncate mr-2" style={{ color: "#fff" }}>{ex.name}</span>
                                    <span className="flex items-center gap-2 shrink-0">
                                      <span style={{ color: "rgba(255,255,255,.5)" }}>
                                        {ex.series}×{ex.reps} · {ex.muscleGroup}
                                      </span>
                                      {editingThis && (
                                        <button
                                          type="button"
                                          onClick={() => removeExerciseFromWorkout(workout.key, i)}
                                          aria-label={t("goals_program_remove_exercise")}
                                          className="h-6 w-6 rounded-full flex items-center justify-center active:scale-95 transition-all"
                                          style={{ background: "rgba(239,68,68,.14)", color: "#f87171" }}
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      )}
                                    </span>
                                  </li>
                                ))}
                              </ul>

                              {editingThis && (
                                addExerciseFor === workout.key ? (
                                  <div className="space-y-2 pt-1">
                                    <Input
                                      autoFocus
                                      placeholder={t("goals_search_exercise")}
                                      value={exerciseSearch}
                                      onChange={(e) => setExerciseSearch(e.target.value)}
                                      style={{ fontSize: "16px", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }}
                                    />
                                    <div className="space-y-1 max-h-48 overflow-y-auto">
                                      {catalogLoading ? (
                                        <div className="flex justify-center py-4">
                                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                        </div>
                                      ) : (
                                        exercisePickerResults.map((w) => (
                                          <button
                                            key={w.id}
                                            type="button"
                                            onClick={() => {
                                              addExerciseToWorkout(workout.key, {
                                                name: w.name,
                                                muscleGroup: w.muscle_group || "",
                                                series: 3,
                                                reps: "12",
                                              });
                                              setExerciseSearch("");
                                            }}
                                            className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs text-left active:scale-[0.99] transition-all"
                                            style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}
                                          >
                                            <span className="truncate mr-2" style={{ color: "#fff" }}>{w.name}</span>
                                            <Plus className="h-3.5 w-3.5 shrink-0" style={{ color: "rgba(255,255,255,.5)" }} />
                                          </button>
                                        ))
                                      )}
                                      {exerciseSearch.trim() &&
                                        !workouts.some((w) => w.name.trim().toLowerCase() === exerciseSearch.trim().toLowerCase()) && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              addExerciseToWorkout(workout.key, {
                                                name: exerciseSearch.trim(),
                                                muscleGroup: "",
                                                series: 3,
                                                reps: "12",
                                              });
                                              setExerciseSearch("");
                                            }}
                                            className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-left active:scale-[0.99] transition-all"
                                            style={{ background: "rgba(91,140,255,.1)", border: "1px solid #5b8cff", color: "#5b8cff" }}
                                          >
                                            <Plus className="h-3.5 w-3.5 shrink-0" />
                                            {t("goals_program_create_exercise").replace("{name}", exerciseSearch.trim())}
                                          </button>
                                        )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => { setAddExerciseFor(null); setExerciseSearch(""); }}
                                      className="text-xs font-semibold"
                                      style={{ color: "rgba(255,255,255,.5)" }}
                                    >
                                      {t("goals_cancel")}
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setAddExerciseFor(workout.key)}
                                    className="w-full flex items-center justify-center gap-1.5 rounded-xl h-9 text-xs font-semibold active:scale-[0.99] transition-all"
                                    style={{ background: "rgba(255,255,255,.05)", border: "1px dashed rgba(255,255,255,.2)", color: "rgba(255,255,255,.7)" }}
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                    {t("goals_program_add_exercise")}
                                  </button>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <Button
                      className="w-full rounded-full h-12"
                      style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
                      onClick={() => {
                        setLinkGoalId(null);
                        goTo("suggested-goal");
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      {t("goals_program_add")}
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full rounded-full h-11 text-muted-foreground"
                      onClick={() => goTo("build-name")}
                    >
                      <Pencil className="h-4 w-4 mr-1.5" />
                      {t("goals_wizard_scratch")}
                    </Button>
                  </>
                );
              })()}
            </>
          )}

          {/* ── Step: link program to a goal (last step) ─────────── */}
          {step === "suggested-goal" && programDraft && (
            <>
              <p className="text-sm -mt-1" style={{ color: "rgba(255,255,255,.5)" }}>
                {t("goals_program_link_subtitle")}
              </p>

              {(() => {
                const activeGoals = userGoals.filter((g) => g.perc < 100);
                if (activeGoals.length === 0) {
                  return (
                    <p className="text-sm text-center py-6" style={{ color: "rgba(255,255,255,.5)" }}>
                      {t("goals_program_link_none")}
                    </p>
                  );
                }
                return (
                  <div className="space-y-1.5">
                    {/* opção: não vincular */}
                    <button
                      onClick={() => setLinkGoalId(null)}
                      className="w-full flex items-center gap-2 rounded-xl p-3 text-left text-sm transition-all"
                      style={linkGoalId === null ? { border: "1px solid #5b8cff", background: "rgba(91,140,255,.1)" } : { border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)" }}
                    >
                      <span className="flex-1 font-medium" style={{ color: "rgba(255,255,255,.6)" }}>
                        {t("goals_program_link_skip")}
                      </span>
                      {linkGoalId === null && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </button>
                    {activeGoals.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => setLinkGoalId(g.id)}
                        className="w-full flex items-center gap-2 rounded-xl p-3 text-left text-sm transition-all"
                        style={linkGoalId === g.id ? { border: "1px solid #5b8cff", background: "rgba(91,140,255,.1)" } : { border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)" }}
                      >
                        <Target className="h-4 w-4 text-primary shrink-0" />
                        <span className="flex-1 truncate font-medium" style={{ color: "#fff" }}>{g.description}</span>
                        {linkGoalId === g.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                    ))}
                  </div>
                );
              })()}

              <Button
                className="w-full rounded-full h-12"
                style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
                disabled={addingProgram}
                onClick={() => handleAddWeeklyProgram(programDraft)}
              >
                {addingProgram ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-1" />
                    {t("goals_program_finish")}
                  </>
                )}
              </Button>
            </>
          )}

          {/* ── Step: build routine ──────────────────────────────── */}
          {/* ── Step 1: routine name ─────────────────────────────── */}
          {step === "build-name" && (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-semibold" style={{ color: "#fff" }}>{t("goals_routine_name_label")}</Label>
                <Input
                  placeholder={
                    routineType === 1
                      ? t("goals_routine_name_placeholder_exercises")
                      : routineType === 2
                        ? t("goals_routine_name_placeholder_diets")
                        : t("goals_routine_name_placeholder_habits")
                  }
                  value={routineName}
                  onChange={(e) => setRoutineName(e.target.value)}
                  maxLength={60}
                  style={{ fontSize: "16px", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }}
                />
                <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>{t("goals_wizard_name_hint")}</p>
              </div>

              <Button
                className="w-full rounded-full h-12"
                style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
                onClick={() => goTo("build")}
              >
                {t("goals_continue")}
              </Button>
            </>
          )}

          {/* ── Step 2: select items ─────────────────────────────── */}
          {step === "build" && (
            <>
              <Label className="text-sm font-semibold" style={{ color: "#fff" }}>
                {editRoutine ? t("goals_wizard_add_items_hint") : t("goals_select_items_hint")}
              </Label>

              {/* alternância: Lista vs Músculo/Categoria */}
              {(routineType === 1 ? muscleGroups.length : routineType === 2 ? dietCategories.length : 0) > 0 && (
                <div className="flex gap-1 p-1 rounded-2xl" style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}>
                  {([["list", t("goals_browse_list")], ["group", routineType === 1 ? t("goals_browse_muscle") : t("goals_browse_category")]] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => { setBrowseMode(mode); setMuscleFilter(null); setSearchQuery(""); }}
                      className="flex-1 h-9 rounded-xl text-[13px] font-semibold transition-all active:scale-95"
                      style={browseMode === mode
                        ? { background: "linear-gradient(rgba(255,255,255,.95),rgba(255,255,255,.84))", color: "#0a0b12" }
                        : { color: "rgba(255,255,255,.6)" }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {browseMode === "group" && !muscleFilter ? (
                catalogLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(routineType === 1 ? muscleGroups : dietCategories).map((g) => {
                      const count = (routineType === 1
                        ? workouts.filter((w) => w.muscle_group === g)
                        : diets.filter((d) => d.category === g)).length;
                      return (
                        <button
                          key={g}
                          onClick={() => setMuscleFilter(g)}
                          className="w-full flex items-center gap-3 rounded-2xl p-3 text-left transition-all active:scale-[0.99]"
                          style={{ border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)" }}
                        >
                          <div
                            className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 text-white"
                            style={{ background: routineType === 1 ? "linear-gradient(135deg,#ff9d6c,#d8567a)" : "linear-gradient(135deg,#5fd6a0,#1f8a5b)" }}
                          >
                            {routineType === 1 ? <Dumbbell className="h-5 w-5" /> : <span className="text-xl">🥗</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[15px] font-semibold capitalize truncate" style={{ color: "#fff" }}>{g}</p>
                            <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
                              {t("goals_browse_count").replace("{n}", String(count))}
                            </p>
                          </div>
                          <ChevronRight className="h-5 w-5 shrink-0" style={{ color: "rgba(255,255,255,.4)" }} />
                        </button>
                      );
                    })}
                  </div>
                )
              ) : (
                <>
                  {browseMode === "group" && muscleFilter && (
                    <button
                      onClick={() => setMuscleFilter(null)}
                      className="flex items-center gap-1.5 text-sm font-semibold"
                      style={{ color: "#9d6bff" }}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span className="capitalize">{muscleFilter}</span>
                    </button>
                  )}

                  <Input
                    placeholder={
                      routineType === 1
                        ? t("goals_search_exercise")
                        : routineType === 2
                          ? t("goals_search_diet")
                          : t("goals_search_habit")
                    }
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ fontSize: "16px", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }}
                  />

              {catalogLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredItems.map((item: any) => {
                    const selected = selectedIds.has(item.id);
                    const locked = !!editRoutine && existingIdsSet.has(item.id);
                    return (
                      <div
                        key={item.id}
                        className="w-full flex items-center gap-3 rounded-2xl p-3 transition-all"
                        style={
                          locked
                            ? { border: "1px solid rgba(16,185,129,.25)", background: "rgba(16,185,129,.05)" }
                            : selected
                              ? { border: "1px solid #5b8cff", background: "rgba(91,140,255,.1)" }
                              : { border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)" }
                        }
                      >
                        {routineType === 3 ? (
                          <div className="h-16 w-16 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
                            <Repeat2 className="h-7 w-7 text-muted-foreground" />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setDetailItem({
                                type: routineType === 1 ? 1 : 2,
                                name: item.name,
                                photo: item.photo ?? null,
                                description: item.description,
                                meta:
                                  routineType === 1
                                    ? item.muscle_group || null
                                    : [item.category, item.calories ? `${item.calories} kcal` : null]
                                        .filter(Boolean)
                                        .join(" · ") || null,
                              })
                            }
                            className="shrink-0 active:scale-95 transition-transform"
                            aria-label={t("goals_item_view_detail")}
                          >
                            {routineType === 1 ? (
                              <ExerciseImage
                                photo={item.photo}
                                name={item.name}
                                muscleGroup={item.muscle_group}
                                className="h-16 w-16 rounded-xl"
                              />
                            ) : (
                              <DietImage
                                photo={item.photo}
                                name={item.name}
                                category={item.category}
                                className="h-16 w-16 rounded-xl"
                              />
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => !locked && toggleItem(item.id)}
                          disabled={locked}
                          className="flex-1 min-w-0 flex items-center gap-3 text-left"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-[15px] font-semibold truncate" style={{ color: locked ? "rgba(255,255,255,.6)" : "#fff" }}>{item.name}</p>
                            <p className="text-xs truncate" style={{ color: "rgba(255,255,255,.5)" }}>
                              {locked
                                ? t("goals_wizard_already_added")
                                : routineType === 1
                                  ? item.muscle_group || ""
                                  : routineType === 2
                                    ? [item.category, item.calories ? `${item.calories} kcal` : null].filter(Boolean).join(" · ")
                                    : item.description || ""}
                            </p>
                          </div>
                          <div
                            className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                              locked
                                ? "bg-emerald-500/20 text-emerald-400"
                                : selected
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted/50 text-muted-foreground"
                            }`}
                          >
                            {locked ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Plus className={`h-4 w-4 transition-transform ${selected ? "rotate-45" : ""}`} />
                            )}
                          </div>
                        </button>
                      </div>
                    );
                  })}

                  {/* custom item inline form */}
                  {!showCustomForm ? (
                    <button
                      onClick={() => setShowCustomForm(true)}
                      className="w-full h-11 rounded-xl text-xs font-medium flex items-center justify-center gap-1"
                      style={{ border: "1px dashed rgba(255,255,255,.2)", color: "rgba(255,255,255,.5)" }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {routineType === 1
                        ? t("goals_not_found_exercise")
                        : routineType === 2
                          ? t("goals_not_found_diet")
                          : t("goals_not_found_habit")}
                    </button>
                  ) : (
                    <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
                      <Input
                        placeholder={
                          routineType === 1
                            ? t("goals_search_exercise")
                            : routineType === 2
                              ? t("goals_create_diet_name_placeholder")
                              : t("goals_create_habit_name_placeholder")
                        }
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        maxLength={80}
                        style={{ fontSize: "16px", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }}
                      />
                      <Input
                        placeholder={
                          routineType === 1
                            ? t("goals_muscle_group")
                            : routineType === 2
                              ? t("goals_create_calories_placeholder")
                              : t("goals_create_description_placeholder")
                        }
                        value={customExtra}
                        onChange={(e) => setCustomExtra(e.target.value)}
                        inputMode={routineType === 2 ? "numeric" : undefined}
                        maxLength={80}
                        style={{ fontSize: "16px", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }}
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 rounded-full"
                          style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.7)", border: "1px solid rgba(255,255,255,.12)" }}
                          onClick={() => setShowCustomForm(false)}
                        >
                          {t("goals_cancel")}
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 rounded-full"
                          style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
                          disabled={!customName.trim() || isCreatingCustom}
                          onClick={handleCreateCustomItem}
                        >
                          {isCreatingCustom ? <Loader2 className="h-4 w-4 animate-spin" /> : t("goals_confirm")}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
                </>
              )}

            </>
          )}

          {/* ── Step 3: schedule (time + weekdays + goal) ─────────── */}
          {step === "build-schedule" && (
            <>
              {isMultiHabitSchedule ? (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold" style={{ color: "#fff" }}>{t("goals_edit_routine_time_label")}</Label>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
                    {t("goals_wizard_habit_time_per_item_hint")}
                  </p>
                  <div className="space-y-2">
                    {selectedHabitsForSchedule.map((h) => (
                      <div key={h.id} className="flex items-center gap-2">
                        <span className="flex-1 min-w-0 truncate text-sm" style={{ color: "#fff" }}>
                          {h.name}
                        </span>
                        <div
                          className="w-[128px] h-11 rounded-xl overflow-hidden shrink-0"
                          style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)" }}
                        >
                          <input
                            type="time"
                            value={habitTimes[h.id] ?? ""}
                            onChange={(e) =>
                              setHabitTimes((prev) => ({ ...prev, [h.id]: e.target.value }))
                            }
                            className="block w-full h-full px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            style={{ fontSize: "16px", minWidth: 0, maxWidth: "100%", boxSizing: "border-box", background: "transparent", border: "none", color: "#fff" }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold" style={{ color: "#fff" }}>{t("goals_edit_routine_time_label")}</Label>
                  <div
                    className="w-full h-11 rounded-xl overflow-hidden"
                    style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)" }}
                  >
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="block w-full h-full px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      style={{ fontSize: "16px", minWidth: 0, maxWidth: "100%", boxSizing: "border-box", background: "transparent", border: "none", color: "#fff" }}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm font-semibold" style={{ color: "#fff" }}>{t("goals_wizard_days_label")}</Label>
                <div className="flex gap-1.5">
                  {WEEKDAY_KEYS.map((key, idx) => {
                    const active = scheduledDays.has(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() =>
                          setScheduledDays((prev) => {
                            const next = new Set(prev);
                            if (next.has(idx)) next.delete(idx);
                            else next.add(idx);
                            return next;
                          })
                        }
                        className="flex-1 h-10 rounded-xl text-xs font-semibold transition-all active:scale-95"
                        style={active
                          ? { background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff", border: "1px solid transparent" }
                          : { background: "rgba(255,255,255,.05)", color: "rgba(255,255,255,.6)", border: "1px solid rgba(255,255,255,.1)" }}
                      >
                        {t(key)}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
                  {scheduledDays.size === 0 ? t("goals_wizard_days_all") : t("goals_wizard_days_hint")}
                </p>
              </div>

              {userGoals.filter((g) => g.perc < 100).length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold" style={{ color: "#fff" }}>{t("goals_link_step_title")}</Label>
                  <div className="space-y-1.5">
                    {userGoals
                      .filter((g) => g.perc < 100)
                      .map((g) => (
                        <button
                          key={g.id}
                          onClick={() => setLinkGoalId(linkGoalId === g.id ? null : g.id)}
                          className="w-full flex items-center gap-2 rounded-xl p-2.5 text-left text-sm transition-all"
                          style={linkGoalId === g.id ? { border: "1px solid #5b8cff", background: "rgba(91,140,255,.1)" } : { border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)" }}
                        >
                          <Target className="h-4 w-4 text-primary shrink-0" />
                          <span className="flex-1 truncate font-medium" style={{ color: "#fff" }}>{g.description}</span>
                          {linkGoalId === g.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              <Button
                className="w-full rounded-full h-12"
                style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
                disabled={isSaving || selectedIds.size === 0}
                onClick={handleSaveRoutine}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t("goals_save_n").replace("{n}", String(selectedIds.size))
                )}
              </Button>
            </>
          )}

          {/* ── Step: goal origin ────────────────────────────────── */}
          {step === "goal-origin" && (
            <>
              {optionCard(
                () => goTo("goal-catalog"),
                <Sparkles className="h-5 w-5" />,
                t("goals_onboarding_pick_title"),
                t("goals_onboarding_pick_desc"),
              )}
              {optionCard(
                () => goTo("goal-custom"),
                <Pencil className="h-5 w-5" />,
                t("goals_onboarding_create_title"),
                t("goals_onboarding_create_desc"),
              )}
              <p className="text-xs text-center pt-2" style={{ color: "rgba(255,255,255,.4)" }}>
                {t("goals_onboarding_footer")}
              </p>
            </>
          )}

          {/* ── Step: goal catalog ───────────────────────────────── */}
          {step === "goal-catalog" && (
            <>
              {goalsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                programmedGoals
                  .filter((g) => !selectedGoalIds.includes(g.id))
                  .map((g) => (
                    <div key={g.id} className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
                      <p className="text-sm font-semibold" style={{ color: "#fff" }}>{g.description}</p>
                      <div className="flex gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold">
                          <Calendar className="h-3.5 w-3.5" />
                          {g.duration} {t("goals_catalog_days_label")}
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 text-orange-400 text-xs font-semibold">
                          <Repeat2 className="h-3.5 w-3.5" />
                          {g.quantity}{t("goals_catalog_per_week")}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        className="w-full rounded-full"
                        disabled={addingGoalId !== null}
                        onClick={() => handleSelectProgrammedGoal(g)}
                      >
                        {addingGoalId === g.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          t("goals_select")
                        )}
                      </Button>
                    </div>
                  ))
              )}
              {!goalsLoading && programmedGoals.filter((g) => !selectedGoalIds.includes(g.id)).length === 0 && (
                <p className="text-sm text-center py-8" style={{ color: "rgba(255,255,255,.5)" }}>{t("goals_empty")}</p>
              )}
            </>
          )}

          {/* ── Step: custom goal ────────────────────────────────── */}
          {step === "goal-custom" && (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-semibold" style={{ color: "#fff" }}>{t("goals_create_label_desc")}</Label>
                <Input
                  placeholder={t("goals_create_placeholder")}
                  value={goalDescription}
                  onChange={(e) => setGoalDescription(e.target.value)}
                  maxLength={120}
                  style={{ fontSize: "16px", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold" style={{ color: "#fff" }}>{t("goals_create_label_type")}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {GOAL_TYPES.map((gt) => (
                    <button
                      key={gt.value}
                      onClick={() => setGoalType(gt.value)}
                      className="rounded-2xl p-3 text-center transition-all"
                      style={goalType === gt.value ? { border: "1px solid #5b8cff", background: "rgba(91,140,255,.1)" } : { border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)" }}
                    >
                      <span className="text-xl block">{gt.emoji}</span>
                      <span className="text-xs font-semibold block mt-1" style={{ color: "#fff" }}>{t(gt.labelKey)}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold" style={{ color: "#fff" }}>{t("goals_create_label_duration")}</Label>
                <div className="flex gap-2 flex-wrap">
                  {DURATION_PRESETS.map((d) => (
                    <button
                      key={d}
                      onClick={() => { setGoalDuration(d); setUseCustomDuration(false); }}
                      className="px-4 py-2 rounded-full text-sm font-medium"
                      style={!useCustomDuration && goalDuration === d ? { background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" } : { background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.6)" }}
                    >
                      {d} {t("goals_streak_days")}
                    </button>
                  ))}
                  <button
                    onClick={() => setUseCustomDuration(true)}
                    className="px-4 py-2 rounded-full text-sm font-medium"
                    style={useCustomDuration ? { background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" } : { background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.6)" }}
                  >
                    {t("goals_create_custom_days")}
                  </button>
                </div>
                {useCustomDuration && (
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder={t("goals_duration_days")}
                    value={goalCustomDuration}
                    onChange={(e) => setGoalCustomDuration(e.target.value)}
                    style={{ fontSize: "16px", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }}
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold" style={{ color: "#fff" }}>{t("goals_create_label_frequency")}</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={7}
                  placeholder={t("goals_create_frequency_placeholder")}
                  value={goalFrequency}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (e.target.value === "" || (v >= 1 && v <= 7)) setGoalFrequency(e.target.value);
                  }}
                  style={{ fontSize: "16px", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }}
                />
                <p className="text-xs" style={{ color: "rgba(255,255,255,.45)" }}>
                  {t("goals_create_frequency_hint")}
                </p>
              </div>
              <Button
                className="w-full rounded-full h-12"
                style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
                disabled={isSaving || !goalDescription.trim()}
                onClick={handleCreateCustomGoal}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("goals_create_btn")}
              </Button>
            </>
          )}
        </div>

        {/* Rodapé fixo: aparece assim que há item selecionado, sem precisar rolar */}
        {step === "build" && newSelectedCount > 0 && (
          <div
            className="shrink-0 px-4 pt-3"
            style={{
              paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
              borderTop: "1px solid rgba(255,255,255,.1)",
              background: "linear-gradient(rgba(20,19,28,.2),rgba(14,13,20,.92))",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <Button
              className="w-full rounded-full h-12"
              style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
              disabled={isSaving}
              onClick={() => (editRoutine ? handleAddItemsToRoutine() : goTo("build-schedule"))}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editRoutine ? (
                t("goals_wizard_add_items_btn").replace("{n}", String(newSelectedCount))
              ) : (
                `${t("goals_continue")} · ${selectedIds.size}`
              )}
            </Button>
          </div>
        )}
      </DrawerContent>
    </Drawer>

    <ItemDetailDrawer item={detailItem} onClose={() => setDetailItem(null)} />

    <PaywallDrawer
      open={paywallOpen}
      onOpenChange={(o) => {
        setPaywallOpen(o);
        // Se o wizard abriu direto no fluxo de rotina bloqueado, dispensar o
        // paywall fecha o wizard também — não há passo válido pra voltar.
        if (!o && paywallClosesWizard) onOpenChange(false);
      }}
      feature="routines"
    />
    </>
  );
}
