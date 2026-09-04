import * as React from "react";
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronRight,
  Dumbbell,
  Home,
  Loader2,
  Lock,
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
import { FEATURES } from "@/lib/feature-flags";
import { usePremium } from "@/lib/premium-context";
import { useLanguage } from "@/lib/language-context";
import type { TranslationKey } from "@/lib/i18n";
import { useKeyboardAwareHeight } from "@/hooks/use-keyboard-aware-height";
import { useKeyboardInputScroll } from "@/hooks/use-keyboard-input-scroll";
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
  getMusclesDb,
  getWorkoutsByMuscleDb,
  getProgrammedGoalsDb,
  getUserProfileDb,
  getUserRoutinesDb,
  getUserSelectedGoalIdsDb,
  getWeightLogsDb,
  getWorkoutNameIdIndexDb,
  getWorkoutsDb,
  matchesCatalogSearch,
  updateRoutineGoalDb,
  updateRoutineItemsScheduledTimeDb,
  updateRoutineItemsScheduledDaysDb,
  updateRoutineItemScheduledTimeDb,
  updateHabitScheduledEndTimeDb,
  updateRoutineProgramMetaDb,
  updateRoutineTechniquesDb,
  updateRoutineTrainingModeDb,
  updateRoutineTrainingModeByNameDb,
  updateUserPersonalDataDb,
  upsertFitnessProfileDb,
  type Diet,
  type Habit,
  type Muscle,
  type ProgrammedGoal,
  type RoutineProgramMeta,
  type RoutineTypeCode,
  type TrainingMode,
  type WorkoutTechnique,
  type UserGoal,
  type UserHabit,
  type Workout,
  type WorkoutGroup,
  getWorkoutGroupsDb,
} from "@/lib/ritmofit-db";
import {
  type FitnessLevel,
  type ProgramWorkout,
  type SuggestedExercise,
  type WeeklyProgram,
} from "@/components/goals/suggested-routines-data";
import {
  matchesExerciseLocation,
  type ExerciseLocationFilter,
} from "@/lib/exercise-location";
import { HabitTimeRow } from "@/components/goals/habit-time-row";
import {
  TechniquePlanner,
  emptyPlan,
  planToAssignments,
  type TechniquePlan,
  type TechniquePlanItem,
} from "@/components/goals/technique-planner";
import { SEQUENTIAL_MARKER } from "@/components/goals/goals-helpers";
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
import {
  buildCoachProfile,
  formatBmi,
  JOINT_RESTRICTIONS,
  parseBodyData,
  weightTrendFromLogs,
  type BiologicalSex,
  type JointRestriction,
  type WeightTrend,
} from "@/lib/coach-profile";
import { getExerciseShortCue } from "@/lib/exercise-coaching";

type WizardStep =
  | "what"
  | "routine-mode"
  | "routine-origin"
  | "quiz-goal"
  | "quiz-level"
  | "quiz-days"
  | "quiz-time"
  | "quiz-location"
  | "quiz-emphasis"
  | "quiz-body"
  | "suggested-program"
  | "suggested-goal"
  | "build-name"
  | "build"
  | "build-schedule"
  | "build-technique"
  | "edit-item-times"
  | "goal-origin"
  | "goal-catalog"
  | "goal-adjust"
  | "goal-adjust-edit"
  | "goal-custom";

/**
 * Chip de filtro do passo de montagem (porção muscular, local do exercício).
 * Mesmo visual da alternância Lista/Músculo, em tamanho de pílula.
 */
function ChipToggle({
  active,
  onClick,
  label,
  icon,
  className = "",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all active:scale-95 ${className}`}
      style={
        active
          ? { background: "linear-gradient(rgba(255,255,255,.95),rgba(255,255,255,.84))", color: "#0a0b12" }
          : { background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", color: "rgba(255,255,255,.65)" }
      }
    >
      {icon}
      {label}
    </button>
  );
}

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

/** Nº total de perguntas do quiz — usado no selo "Pergunta {i} de {n}". */
const QUIZ_STEP_COUNT = 7;

/** Campos do passo "Sobre você" que podem vir travados do perfil. */
type BodyField = "sex" | "age" | "height" | "weight";

const QUIZ_SEXES: Array<{ value: BiologicalSex; labelKey: TranslationKey }> = [
  { value: "female", labelKey: "goals_quiz_body_sex_female" },
  { value: "male", labelKey: "goals_quiz_body_sex_male" },
  { value: "other", labelKey: "goals_quiz_body_sex_other" },
];

const QUIZ_RESTRICTIONS: Array<{
  value: JointRestriction;
  emoji: string;
  labelKey: TranslationKey;
}> = [
  { value: "knee", emoji: "🦵", labelKey: "goals_quiz_restriction_knee" },
  { value: "shoulder", emoji: "💪", labelKey: "goals_quiz_restriction_shoulder" },
  { value: "lower_back", emoji: "🔙", labelKey: "goals_quiz_restriction_lower_back" },
  { value: "wrist", emoji: "🤚", labelKey: "goals_quiz_restriction_wrist" },
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
  // Nomes, buscas e campos numéricos (séries/reps/duração) espalhados pelos passos
  // ficam no meio deste scroll — mantê-los acima do teclado iOS.
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  useKeyboardInputScroll(scrollRef, open);

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
    routineGateBlocked &&
    (step === "routine-mode" || step === "routine-origin" || step === "build-name" || step === "build");
  React.useEffect(() => {
    if (open && paywallClosesWizard) setPaywallOpen(true);
  }, [open, paywallClosesWizard]);

  // routine state
  const [routineType, setRoutineType] = React.useState<RoutineTypeCode>(1);
  const [routineName, setRoutineName] = React.useState("");
  // Modo da experiência de treino desta rotina (passo "routine-mode").
  // Só rotinas de treino perguntam; dieta/hábito ficam no default.
  const [trainingMode, setTrainingMode] = React.useState<TrainingMode>("simple");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [scheduledTime, setScheduledTime] = React.useState("");
  // Horários individuais por hábito (chave = habit_id do catálogo) quando a rotina tem 2+ hábitos
  const [habitTimes, setHabitTimes] = React.useState<Record<string, string>>({});
  // Hora de FIM por hábito (opcional) — mesma chave (habit_id do catálogo).
  const [habitEndTimes, setHabitEndTimes] = React.useState<Record<string, string>>({});
  const [scheduledDays, setScheduledDays] = React.useState<Set<number>>(new Set());
  // Modo de agendamento do TREINO: "weekly" (dias fixos, padrão) ou "sequential"
  // (rodízio sem dias fixos). Ignorado por dieta/hábito.
  const [scheduleMode, setScheduleMode] = React.useState<"weekly" | "sequential">("weekly");
  const [linkGoalId, setLinkGoalId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [muscleFilter, setMuscleFilter] = React.useState<string | null>(null);
  // "list" = todos os itens · "group" = navegar por músculo/categoria.
  // A aba "Porção" (anatomia) foi absorvida pelo modo "group": era o mesmo
  // filtro em dois lugares — dentro do grupo escolhido, as porções daquele
  // músculo viram chips (ver `anatomyMuscleId`).
  const [browseMode, setBrowseMode] = React.useState<"list" | "group">("list");
  // Porção muscular escolhida dentro do grupo (Peito → Peitoral superior).
  const [anatomyMuscleId, setAnatomyMuscleId] = React.useState<string | null>(null);
  // Onde o exercício é feito: academia × casa (só treino). Ver exercise-location.ts.
  const [locationFilter, setLocationFilter] = React.useState<ExerciseLocationFilter>("all");
  const [muscles, setMuscles] = React.useState<Muscle[]>([]);
  const [muscleWorkouts, setMuscleWorkouts] = React.useState<Workout[]>([]);
  const [muscleWorkoutsLoading, setMuscleWorkoutsLoading] = React.useState(false);
  // Passo de técnicas (só rotina de treino no modo expert). Só existe DEPOIS de
  // salvar: a técnica é gravada em `user_workouts`, cujas linhas só nascem no
  // save — antes disso não há id em que pendurar a escolha.
  const [techniqueItems, setTechniqueItems] = React.useState<TechniquePlanItem[]>([]);
  const [techniquePlan, setTechniquePlan] = React.useState<TechniquePlan>({});
  // item aberto no drawer de detalhe (imagem ampliada + descrição)
  const [detailItem, setDetailItem] = React.useState<ItemDetailData | null>(null);
  const [showCustomForm, setShowCustomForm] = React.useState(false);
  const [customName, setCustomName] = React.useState("");
  const [customExtra, setCustomExtra] = React.useState("");
  const [isCreatingCustom, setIsCreatingCustom] = React.useState(false);

  // catalogs (lazy)
  const [workouts, setWorkouts] = React.useState<Workout[]>([]);
  // Grupos de movimento (Supino, Remada…) — colapsam as variações na lista.
  // Vazio quando a migração 20260812 não rodou: aí a lista é a de sempre.
  const [workoutGroups, setWorkoutGroups] = React.useState<WorkoutGroup[]>([]);
  const groupById = React.useMemo(
    () => new Map(workoutGroups.map((g) => [g.id, g])),
    [workoutGroups],
  );
  /** Grupo do exercício, só quando a lista está colapsada (fora da busca). */
  const itemGroup = (item: any): WorkoutGroup | undefined =>
    routineType === 1 && !searchQuery.trim() && item?.groupId
      ? groupById.get(item.groupId)
      : undefined;
  const groupVariationCount = (item: any): number =>
    workouts.filter((w) => w.groupId && w.groupId === item?.groupId).length;
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
  // ── Dados do corpo (passo "Sobre você") ────────────────────────────────────
  // Vêm do perfil (`profiles.gender/age/height/weight`) e podem ser corrigidos
  // aqui mesmo — quem corrige, grava de volta no perfil. É o que transforma a
  // sugestão em prescrição individual (ver client/lib/coach-profile.ts).
  const [bodySex, setBodySex] = React.useState<BiologicalSex | null>(null);
  const [bodyAge, setBodyAge] = React.useState("");
  const [bodyHeight, setBodyHeight] = React.useState("");
  const [bodyWeight, setBodyWeight] = React.useState("");
  // Campos que vieram preenchidos do perfil → exibidos como leitura. Editar
  // altura/peso é assunto do Perfil; aqui o dado só é consultado. Fica editável
  // apenas o que o perfil não tem (senão não haveria como personalizar).
  const [lockedBodyFields, setLockedBodyFields] = React.useState<Set<BodyField>>(new Set());
  const [restrictions, setRestrictions] = React.useState<Set<JointRestriction>>(new Set());
  // tendência do peso corporal (histórico) — não é editável, só informa o motor
  const [weightTrend, setWeightTrend] = React.useState<WeightTrend | null>(null);
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

  // Meta do catálogo escolhida, aguardando "manter original" ou "alterar".
  // Duração/frequência ficam em campos próprios (não reusam os do goal-custom)
  // para o passo poder voltar ao original sem perder o que o usuário digitou.
  const [catalogGoal, setCatalogGoal] = React.useState<ProgrammedGoal | null>(null);
  const [catalogDuration, setCatalogDuration] = React.useState("");
  const [catalogFrequency, setCatalogFrequency] = React.useState("");

  // Teto da frequência: dias por semana (7) e nunca mais que a duração — só
  // alcançável pela duração personalizada, já que os presets são 30/60/90.
  const goalDurationValue = useCustomDuration
    ? Math.max(1, Number(goalCustomDuration) || 1)
    : goalDuration;
  const maxGoalFrequency = Math.min(7, goalDurationValue);

  // Mesmo teto para o ajuste da meta de catálogo.
  const parsedCatalogDuration = parseInt(catalogDuration, 10);
  const maxCatalogFrequency = Math.min(
    7,
    Number.isFinite(parsedCatalogDuration) && parsedCatalogDuration > 0 ? parsedCatalogDuration : 7,
  );

  // reset on close
  React.useEffect(() => {
    if (!open) {
      setStep(initialStep);
      setHistory([]);
      setRoutineType(1);
      setRoutineName("");
      setTrainingMode("simple");
      setTechniqueItems([]);
      setTechniquePlan({});
      setSelectedIds(new Set());
      setScheduledTime("");
      setHabitTimes({});
      setHabitEndTimes({});
      setScheduledDays(new Set());
      setScheduleMode("weekly");
      setLinkGoalId(null);
      setSearchQuery("");
      setMuscleFilter(null);
      setBrowseMode("list");
      setAnatomyMuscleId(null);
      setLocationFilter("all");
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
      setCatalogGoal(null);
      setCatalogDuration("");
      setCatalogFrequency("");
    } else if (editRoutine) {
      setStep("build");
      setHistory([]);
      setRoutineType(editRoutine.type);
      setRoutineName(editRoutine.name ?? "");
      setSelectedIds(new Set(editRoutine.existingItemIds));
      setSearchQuery("");
      setMuscleFilter(null);
      setBrowseMode("list");
      setAnatomyMuscleId(null);
      setLocationFilter("all");
      setShowCustomForm(false);
      setCustomName("");
      setCustomExtra("");
      // Horários dos hábitos NOVOS começam em branco (o passo é justamente para
      // perguntar) — sem isso sobrariam valores de um uso anterior do wizard.
      setHabitTimes({});
      setHabitEndTimes({});
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
      routineType === 1 || step === "suggested-program"
        ? getWorkoutsDb().then(setWorkouts).then(() =>
            // Best-effort: sem os grupos a lista só não colapsa as variações.
            getWorkoutGroupsDb().then(setWorkoutGroups).catch(() => {}),
          )
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
  //
  // Carrega junto os DADOS DO CORPO (perfil + histórico de peso): eles chegam
  // no primeiro passo do quiz, muito antes do passo "Sobre você", para o campo
  // já aparecer preenchido quando o usuário chegar lá.
  React.useEffect(() => {
    if (!open || step !== "quiz-goal" || quizProfileLoaded) return;
    setQuizProfileLoaded(true);
    getUserProfileDb(userId)
      .then((profile) => {
        if (!profile) return;
        const body = parseBodyData({
          gender: profile.gender,
          age: profile.age,
          height: profile.height,
          weight: profile.weight,
        });
        // Campo que JÁ existe no perfil entra travado (só leitura): o lugar de
        // corrigir peso/altura é o perfil, não o meio da criação de rotina.
        // Só o que está vazio vira input — senão o quiz não teria como
        // personalizar quem nunca preencheu o cadastro físico.
        const locked = new Set<BodyField>();
        if (body.sex) {
          setBodySex((prev) => prev ?? body.sex!);
          locked.add("sex");
        }
        if (body.age != null) {
          setBodyAge((prev) => prev || String(body.age));
          locked.add("age");
        }
        if (body.heightCm != null) {
          setBodyHeight((prev) => prev || String(Math.round(body.heightCm!)));
          locked.add("height");
        }
        if (body.weightKg != null) {
          setBodyWeight((prev) => prev || String(body.weightKg));
          locked.add("weight");
        }
        setLockedBodyFields(locked);
      })
      .catch(() => {});
    // Tendência de peso: melhor sinal que o app tem sobre a direção do corpo.
    // Best-effort — sem histórico o gerador só não usa esse ajuste.
    getWeightLogsDb(30)
      .then((logs) => setWeightTrend(weightTrendFromLogs(logs)))
      .catch(() => {});
    getFitnessProfileDb(userId)
      .then((p) => {
        if (!p) return;
        const savedRestrictions = (p.restrictions ?? []).filter((r): r is JointRestriction =>
          JOINT_RESTRICTIONS.includes(r as JointRestriction),
        );
        if (savedRestrictions.length > 0) {
          setRestrictions((prev) => (prev.size > 0 ? prev : new Set(savedRestrictions)));
        }
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

  // Hábitos que estão sendo ADICIONADOS a uma rotina existente — só eles ganham
  // o passo de horário (os que já estavam mantêm o horário que têm).
  const newHabitsForSchedule = React.useMemo(
    () => habits.filter((h) => selectedIds.has(h.id) && !existingIdsSet.has(h.id)),
    [habits, selectedIds, existingIdsSet],
  );

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

  // Catálogo de músculos — carregado uma vez, junto do passo de montagem de
  // treino. Praticamente imutável (só muda por migração), com cache de 12h.
  React.useEffect(() => {
    if (routineType !== 1 || muscles.length > 0) return;
    getMusclesDb().then(setMuscles).catch(() => {});
  }, [routineType, muscles.length]);

  // Exercícios da porção muscular escolhida, já ordenados por ênfase
  // (consulta inversa em workout_muscles).
  React.useEffect(() => {
    if (!anatomyMuscleId) { setMuscleWorkouts([]); return; }
    let alive = true;
    setMuscleWorkoutsLoading(true);
    getWorkoutsByMuscleDb(anatomyMuscleId)
      .then((rows) => { if (alive) setMuscleWorkouts(rows); })
      .catch(() => { if (alive) setMuscleWorkouts([]); })
      .finally(() => { if (alive) setMuscleWorkoutsLoading(false); });
    return () => { alive = false; };
  }, [anatomyMuscleId]);

  /**
   * Porções do grupo muscular aberto (Peito → Peitoral superior/médio/…), na
   * ordem do banco. Vazio quando o grupo não tem anatomia semeada (Alongamento,
   * Core, Gluteos…) ou quando a migração de anatomia não rodou — aí a fileira
   * de chips simplesmente não aparece.
   */
  const groupMuscleParts = React.useMemo(
    () => (muscleFilter ? muscles.filter((m) => m.groupName === muscleFilter) : []),
    [muscles, muscleFilter],
  );

  const filteredItems = React.useMemo(() => {
    const q = searchQuery.trim();
    if (routineType === 1) {
      const byLocation = (list: Workout[]) =>
        list.filter((w) => matchesExerciseLocation(w, locationFilter));
      // Porção muscular escolhida: a lista JÁ vem do banco ordenada por ênfase
      // — o mais específico primeiro. Só busca e local se aplicam; reordenar
      // por nome aqui jogaria fora justamente o que se foi buscar.
      if (anatomyMuscleId) {
        return byLocation(muscleWorkouts.filter((w) => matchesCatalogSearch(w, q)));
      }
      const matches = byLocation(
        workouts.filter(
          (w) =>
            matchesCatalogSearch(w, q) &&
            (!muscleFilter || w.muscle_group === muscleFilter),
        ),
      );
      // Variações colapsadas: o catálogo tem 13 supinos, e escolher entre eles
      // ao MONTAR a rotina é uma decisão que o usuário só toma na academia.
      // Aqui ele escolhe o movimento; a variação é escolhida no treino (a rotina
      // nasce com a padrão do grupo). Buscando, não colapsa — quem digitou
      // "halteres" quer ver justamente a variação com halteres. Com filtro de
      // local, idem: colapsar mostraria a variação padrão do grupo (quase
      // sempre a de academia) no lugar da que casou com "em casa".
      if (q || locationFilter !== "all" || workoutGroups.length === 0) return matches;
      const seenGroups = new Set<string>();
      const out: Workout[] = [];
      for (const w of matches) {
        const g = w.groupId ? groupById.get(w.groupId) : undefined;
        if (!g) { out.push(w); continue; }
        if (seenGroups.has(g.id)) continue;
        seenGroups.add(g.id);
        out.push(matches.find((x) => x.id === g.defaultWorkoutId && x.groupId === g.id) ?? w);
      }
      return out;
    }
    if (routineType === 2) {
      return diets.filter(
        (d) =>
          matchesCatalogSearch(d, q) &&
          (!muscleFilter || d.category === muscleFilter),
      );
    }
    return habits.filter((h) => matchesCatalogSearch(h, q));
  }, [routineType, workouts, diets, habits, searchQuery, muscleFilter, anatomyMuscleId, muscleWorkouts, locationFilter, workoutGroups, groupById]);

  // TODA rotina de hábito agenda por item — inclusive com um único hábito, que
  // também tem janela início→fim (o input único não comporta o fim).
  const selectedHabitsForSchedule = React.useMemo(
    () => habits.filter((h) => selectedIds.has(h.id)),
    [habits, selectedIds],
  );
  const isHabitSchedule = routineType === 3 && selectedHabitsForSchedule.length > 0;

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
      // Guardado para o passo de técnicas (precisa do par id ↔ workout_id).
      let inserted1: Array<{ id: string; workout_id: string }> = [];
      if (routineType === 1) {
        const inserted = await createUserWorkoutsDb(userId, ids, { name: name || undefined });
        insertedIds = inserted.map((i) => i.id);
        inserted1 = inserted.map((i) => ({ id: i.id, workout_id: i.workout_id }));
      } else if (routineType === 2) {
        const inserted = await createUserDietsDb(userId, ids, { name: name || undefined });
        insertedIds = inserted.map((i) => i.id);
      } else {
        const inserted = await createUserHabitsDb(userId, ids, { name: name || undefined });
        insertedIds = inserted.map((i) => i.id);
        insertedHabits = inserted;
      }

      await backfillRoutineIdOnItemsDb(userId, routineType, name, insertedIds).catch(() => {});

      // Modo de treino escolhido no passo "routine-mode". A linha em `routines`
      // nasce de um trigger no banco (o cliente nunca vê o id), então casa por
      // (user_id, type, name) — mesma estratégia dos setters de horário/dias.
      // Só treino: dieta e hábito não têm sessão de registro.
      if (routineType === 1 && trainingMode !== "simple") {
        await updateRoutineTrainingModeByNameDb(userId, routineType, name, trainingMode)
          .catch(() => {});
      }

      // Rotina de hábito com 2+ itens: aplica um horário por item (casado por habit_id)
      // em vez do horário único de `scheduledTime`.
      const hasIndividualHabitTimes = isHabitSchedule && insertedHabits.length > 0;
      if (hasIndividualHabitTimes) {
        await Promise.all(
          insertedHabits.flatMap((row) => {
            const time = habitTimes[row.habit_id] || null;
            if (!time) return [];
            const end = habitEndTimes[row.habit_id] || null;
            return [
              updateRoutineItemScheduledTimeDb(userId, 3, row.id, time).catch(() => {}),
              // Fim é opcional — só grava quando o usuário definiu.
              ...(end ? [updateHabitScheduledEndTimeDb(userId, row.id, end).catch(() => {})] : []),
            ];
          }),
        );
      } else if (scheduledTime) {
        await updateRoutineItemsScheduledTimeDb(userId, routineType, name, scheduledTime).catch(() => {});
      }

      // Treino Sequencial: grava a sentinela 'seq' em scheduled_days (rodízio
      // sem dias fixos). Caso contrário, os índices dos dias escolhidos.
      const daysValue =
        routineType === 1 && scheduleMode === "sequential"
          ? SEQUENTIAL_MARKER
          : Array.from(scheduledDays).sort((a, b) => a - b).join(",");
      if (daysValue) {
        await updateRoutineItemsScheduledDaysDb(userId, routineType, name, daysValue).catch(() => {});
      }

      // Agenda as notificações locais da nova rotina (se tiver horário definido).
      if (scheduledTime || hasIndividualHabitTimes) {
        window.dispatchEvent(new CustomEvent("ritmofit-routines-changed"));
      }

      if (linkGoalId) {
        await linkNewRoutineToGoal(routineType, name, linkGoalId).catch(() => {});
      }

      // Modo expert: em vez de fechar, oferece o passo de técnicas com as
      // linhas recém-criadas (agora existem ids). O usuário pode pular.
      if (routineType === 1 && trainingMode === "expert" && insertedIds.length > 0) {
        const nameOf = new Map(workouts.map((w) => [w.id, w.name]));
        const planItems: TechniquePlanItem[] = inserted1.map((row) => ({
          id: row.id,
          name: nameOf.get(row.workout_id) ?? "",
        }));
        setTechniqueItems(planItems);
        setTechniquePlan(emptyPlan(planItems));
        // A rotina JÁ está criada e a tela de Metas precisa saber, senão o
        // gate de 1 rotina no plano grátis usaria uma contagem velha.
        onCreated("routine");
        toast({ title: t("goals_routine_created_toast"), description: name ?? undefined });
        goTo("build-technique");
        return;
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
      let insertedHabits: UserHabit[] = [];
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
        insertedHabits = inserted;
      }

      // legacy rows without a resolved routine_id: fall back to the name-matching
      // backfill used by the regular create flow
      if (!routineId) {
        await backfillRoutineIdOnItemsDb(userId, type, name, insertedIds).catch(() => {});
      }

      // Horário: SEMPRE só nos itens recém-inseridos (por id). Aplicar por nome
      // atinge a rotina inteira e, em hábitos, o horário é POR ITEM — como
      // `editRoutine.scheduledTime` é só o do PRIMEIRO item com horário
      // (`goals-helpers.ts`), o update por nome carimbava esse valor único em
      // todos, apagando o horário de cada hábito (Almoçar 13h virava 21h).
      let anyTimeSet = false;
      if (type === 3) {
        // Hábito: o horário de cada item novo veio do passo `edit-item-times`.
        // Em branco = sem lembrete para aquele hábito (escolha válida).
        await Promise.all(
          insertedHabits.flatMap((row) => {
            const time = habitTimes[row.habit_id] || null;
            if (!time) return [];
            anyTimeSet = true;
            const end = habitEndTimes[row.habit_id] || null;
            return [
              updateRoutineItemScheduledTimeDb(userId, 3, row.id, time).catch(() => {}),
              ...(end ? [updateHabitScheduledEndTimeDb(userId, row.id, end).catch(() => {})] : []),
            ];
          }),
        );
      } else if (scheduledTime) {
        // Treino/dieta: horário único da rotina, herdado pelos itens novos.
        anyTimeSet = true;
        await Promise.all(
          insertedIds.map((id) =>
            updateRoutineItemScheduledTimeDb(userId, type, id, scheduledTime).catch(() => {}),
          ),
        );
      }
      if (scheduledDays) {
        await updateRoutineItemsScheduledDaysDb(userId, type, name, scheduledDays).catch(() => {});
      }
      if (anyTimeSet) {
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
  // Corpo do usuário → modificadores de prescrição. É este objeto que faz o
  // mesmo quiz gerar programas diferentes para pessoas diferentes.
  const restrictionsKey = React.useMemo(
    () => Array.from(restrictions).sort().join(","),
    [restrictions],
  );
  const coachProfile = React.useMemo(
    () =>
      buildCoachProfile(
        parseBodyData({
          gender: bodySex,
          age: bodyAge,
          height: bodyHeight,
          weight: bodyWeight,
          weightTrend,
        }),
        restrictionsKey ? (restrictionsKey.split(",") as JointRestriction[]) : [],
      ),
    [bodySex, bodyAge, bodyHeight, bodyWeight, weightTrend, restrictionsKey],
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
      coach: coachProfile,
    });
  }, [quizGoal, level, quizTime, quizLocation, quizEmphasis, quizDaysKey, coachProfile]);

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
    const q = exerciseSearch.trim();
    const list = q ? workouts.filter((w) => matchesCatalogSearch(w, q)) : workouts;
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

      // O app NÃO insere no catálogo `workouts` (só criação MANUAL de exercício
      // pode). Exercícios do programa que não existem no catálogo são **pulados**
      // e reportados ao usuário — nunca criados aqui, para não poluir a tabela
      // central com duplicatas/dados não confiáveis.
      const created: Array<{ name: string; exercises: SuggestedExercise[]; daysStr: string }> = [];
      const missing = new Set<string>();
      for (const workout of program.workouts) {
        const workoutIds: string[] = [];
        const foundExercises: SuggestedExercise[] = [];
        for (const ex of workout.exercises) {
          const workoutId = nameIndex.get(ex.name.trim().toLowerCase());
          if (!workoutId) {
            missing.add(ex.name);
            continue; // fora do catálogo → não entra na rotina
          }
          workoutIds.push(workoutId);
          foundExercises.push(ex);
        }
        // Treino sem nenhum exercício do catálogo → não cria rotina vazia.
        if (workoutIds.length === 0) continue;

        const name = language === "en" ? workout.name.en : workout.name.pt;
        const inserted = await createUserWorkoutsDb(userId, workoutIds, { name });
        await backfillRoutineIdOnItemsDb(userId, 1, name, inserted.map((i) => i.id)).catch(() => {});

        // Técnicas sugeridas pelo gerador (bi-set antagonista, drop-set). Só no
        // modo expert — o simplificado não renderiza técnica, gravar ali seria
        // um dado invisível. Casa a linha criada com o exercício pelo
        // workout_id (a ordem do insert não é garantida).
        if (trainingMode === "expert") {
          const idByWorkout = new Map(inserted.map((i) => [i.workout_id, i.id]));
          const assignments = foundExercises
            .map((ex, index) => {
              const workoutId = nameIndex.get(ex.name.trim().toLowerCase());
              const userWorkoutId = workoutId ? idByWorkout.get(workoutId) : null;
              if (!userWorkoutId) return null;
              return {
                userWorkoutId,
                technique: (ex.technique ?? "straight") as WorkoutTechnique,
                techniqueGroup: ex.techniqueGroup ?? null,
                orderIndex: index,
              };
            })
            .filter((a): a is NonNullable<typeof a> => a !== null);
          if (assignments.some((a) => a.technique !== "straight")) {
            await updateRoutineTechniquesDb(userId, assignments).catch(() => {});
          }
        }
        // dias da semana deste treino no programa (escolhidos no quiz/preview)
        const days = program.week
          .map((k, i) => (k === workout.key ? i : -1))
          .filter((i) => i >= 0);
        created.push({ name, exercises: foundExercises, daysStr: days.join(",") });
      }

      // Nada casou com o catálogo → não criou rotina nenhuma. Avisa e sai.
      if (created.length === 0) {
        toast({
          title: t("goals_program_none_in_catalog"),
          description: Array.from(missing).join(", "),
          variant: "destructive",
        });
        return;
      }

      // scheduled_days + metadados do programa + vínculo de meta por rotina criada
      const routines = await getUserRoutinesDb(userId);
      const userGoal = linkGoalId ? (userGoals.find((g) => g.id === linkGoalId) ?? null) : null;
      for (const c of created) {
        // Sequencial: grava 'seq' em todas as rotinas do programa (rodízio, sem
        // dias fixos). A ordem de criação (= ordem de program.workouts, que é a
        // ordem da sequência gerada) vira a ordem do rodízio.
        const daysValue = scheduleMode === "sequential" ? SEQUENTIAL_MARKER : c.daysStr;
        if (daysValue) {
          await updateRoutineItemsScheduledDaysDb(userId, 1, c.name, daysValue).catch(() => {});
        }
        const match = routines.find((r) => r.type === 1 && r.name === c.name);
        if (!match) continue;
        const meta: RoutineProgramMeta = {
          origin: "quiz",
          exercises: c.exercises.map((ex) => ({
            name: ex.name,
            muscleGroup: ex.muscleGroup,
            series: ex.series,
            reps: ex.reps,
          })),
        };
        await updateRoutineProgramMetaDb(match.id, meta).catch(() => {});
        // Aqui o id já está resolvido (o quiz relê as rotinas para casar cada
        // treino do programa), então grava direto por id.
        if (trainingMode !== "simple") {
          await updateRoutineTrainingModeDb(match.id, trainingMode).catch(() => {});
        }
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
          restrictions: Array.from(restrictions).sort(),
        }).catch(() => {});
      }

      // Dados do corpo INFORMADOS no passo "Sobre você" completam o perfil —
      // só os campos que estavam vazios (os travados já vieram de `profiles`,
      // e reescrevê-los abriria caminho para o quiz sobrescrever o perfil sem
      // o usuário ter pedido).
      const bodyUpdates = {
        ...(!lockedBodyFields.has("sex") && bodySex ? { gender: bodySex } : {}),
        ...(!lockedBodyFields.has("age") && bodyAge ? { age: bodyAge } : {}),
        ...(!lockedBodyFields.has("height") && bodyHeight ? { height: bodyHeight } : {}),
        ...(!lockedBodyFields.has("weight") && bodyWeight ? { weight: bodyWeight } : {}),
      };
      if (Object.keys(bodyUpdates).length > 0) {
        await updateUserPersonalDataDb(userId, bodyUpdates).catch(() => {});
      }

      // Alguns exercícios ficaram de fora por não existir no catálogo → avisa,
      // para o usuário adicioná-los (inserção manual no catálogo é dele).
      if (missing.size > 0) {
        toast({
          title: t("goals_program_missing_title"),
          description: t("goals_program_missing_desc").replace("{list}", Array.from(missing).join(", ")),
        });
      } else {
        toast({
          title: t("goals_program_added_toast"),
          description: t("goals_program_added_desc").replace(
            "{n}",
            String(created.length),
          ),
        });
      }
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

  // Selecionar no catálogo não cria mais na hora: leva ao passo de ajuste, onde
  // o usuário mantém a duração/frequência originais ou define as suas.
  const handleSelectProgrammedGoal = (goal: ProgrammedGoal) => {
    setCatalogGoal(goal);
    setCatalogDuration(String(goal.duration));
    setCatalogFrequency(String(goal.quantity));
    goTo("goal-adjust");
  };

  const handleCreateProgrammedGoal = async (duration: number, quantity: number) => {
    if (!catalogGoal) return;
    setAddingGoalId(catalogGoal.id);
    try {
      await createUserGoalDb(catalogGoal.id, userId, catalogGoal.type, duration, quantity);
      toast({ title: t("goals_created_toast"), description: catalogGoal.description });
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

  const handleConfirmAdjustedGoal = () => {
    const duration = parseInt(catalogDuration, 10);
    const rawQuantity = parseInt(catalogFrequency, 10);
    if (!duration || duration < 1 || !rawQuantity || rawQuantity < 1) return;
    // Mesma invariante do resto das metas: frequência é 1–7 e nunca passa da duração.
    handleCreateProgrammedGoal(duration, Math.min(rawQuantity, Math.min(7, duration)));
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
      // Frequência = dias por semana (teto 7) e nunca mais dias do que a meta
      // dura — uma meta de 3 dias não pode ser executada 7x.
      const frequency = Math.min(
        Math.max(1, Number(goalFrequency) || 1),
        Math.min(7, duration),
      );
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
    "routine-mode": t("goals_wizard_mode_title"),
    "routine-origin": t("goals_wizard_origin_title"),
    "quiz-goal": t("goals_quiz_goal_title"),
    "quiz-level": t("goals_suggest_level_title"),
    "quiz-days": t("goals_quiz_days_title"),
    "quiz-time": t("goals_quiz_time_title"),
    "quiz-location": t("goals_quiz_location_title"),
    "quiz-emphasis": t("goals_quiz_emphasis_title"),
    "quiz-body": t("goals_quiz_body_title"),
    "suggested-program": t("goals_program_your_week"),
    "suggested-goal": t("goals_link_step_title"),
    "build-name": t("goals_wizard_name_title"),
    "build": t("goals_wizard_items_title"),
    "build-schedule": t("goals_wizard_schedule_title"),
    "build-technique": t("goals_technique_step_title"),
    "edit-item-times": t("goals_wizard_new_habit_times_title"),
    "goal-origin": t("goals_onboarding_title"),
    "goal-catalog": t("goals_available"),
    "goal-adjust": t("goals_adjust_title"),
    "goal-adjust-edit": t("goals_adjust_edit_title"),
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

  // Card do passo "modo de treino": diferente do optionCard porque a escolha
  // não navega — ela SELECIONA (o usuário compara os dois e confirma). Por isso
  // traz a lista do que cada modo entrega e um estado selecionado persistente.
  const modeCard = (
    mode: TrainingMode,
    icon: React.ReactNode,
    title: string,
    desc: string,
    features: string[],
  ) => {
    const selected = trainingMode === mode;
    return (
      <button
        onClick={() => setTrainingMode(mode)}
        className="w-full flex flex-col gap-2.5 rounded-2xl p-4 text-left active:scale-[0.99] transition-all"
        style={
          selected
            ? { background: "rgba(91,140,255,.12)", border: "1px solid #5b8cff" }
            : { background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }
        }
      >
        <div className="flex items-center gap-3">
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
            style={
              selected
                ? { background: "rgba(91,140,255,.22)", color: "#9dbaff" }
                : { background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.65)" }
            }
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: "#fff" }}>{title}</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>{desc}</p>
          </div>
          {/* Rádio: o passo tem botão de confirmar, então o card precisa
              mostrar qual está escolhido mesmo sem navegar. */}
          <div
            className="h-5 w-5 rounded-full shrink-0 flex items-center justify-center"
            style={{
              border: selected ? "1.5px solid #5b8cff" : "1.5px solid rgba(255,255,255,.28)",
              background: selected ? "#5b8cff" : "transparent",
            }}
          >
            {selected && <Check className="h-3 w-3" style={{ color: "#0a0b12" }} strokeWidth={3} />}
          </div>
        </div>

        <ul className="flex flex-col gap-1 pl-[3.5rem]">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-1.5">
              <span
                className="mt-[6px] h-1 w-1 rounded-full shrink-0"
                style={{ background: selected ? "#5b8cff" : "rgba(255,255,255,.32)" }}
              />
              <span className="text-xs leading-snug" style={{ color: "rgba(255,255,255,.62)" }}>
                {f}
              </span>
            </li>
          ))}
        </ul>
      </button>
    );
  };

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

  // "Pergunta {i} de 7" — progresso do quiz
  const quizStepBadge = (i: number) => (
    <p className="text-[11px] font-semibold uppercase tracking-wide -mt-1" style={{ color: "rgba(255,255,255,.35)" }}>
      {t("goals_quiz_step").replace("{i}", String(i)).replace("{n}", String(QUIZ_STEP_COUNT))}
    </p>
  );

  const toggleRestriction = (value: JointRestriction) => {
    setRestrictions((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

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

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 space-y-3"
          style={{ paddingBottom: "calc(2rem + var(--keyboard-height, 0px))" }}
        >
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
                  // Modo Expert guardado para um update futuro: sem ele não há
                  // escolha a fazer, e um passo de wizard com uma opção só é
                  // atrito puro. `trainingMode` permanece no default "simple".
                  goTo(FEATURES.expertMode ? "routine-mode" : "routine-origin");
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

          {/* ── Step: modo de treino (Simplificado × Expert) ────────
              Primeira decisão da rotina de treino: define como a tela de
              registrar treino vai se comportar. Fica ANTES da origem
              (sugerido × do zero) porque vale para os dois caminhos. */}
          {step === "routine-mode" && (
            <>
              <p className="text-sm -mt-1" style={{ color: "rgba(255,255,255,.5)" }}>
                {t("goals_wizard_mode_subtitle")}
              </p>

              {modeCard(
                "simple",
                <Dumbbell className="h-5 w-5" />,
                t("goals_mode_simple"),
                t("goals_mode_simple_desc"),
                [t("goals_mode_simple_f1"), t("goals_mode_simple_f2")],
              )}

              {modeCard(
                "expert",
                <Sparkles className="h-5 w-5" />,
                t("goals_mode_expert"),
                t("goals_mode_expert_desc"),
                [
                  t("goals_mode_expert_f1"),
                  t("goals_mode_expert_f2"),
                  t("goals_mode_expert_f3"),
                  t("goals_mode_expert_f4"),
                  t("goals_mode_expert_f5"),
                ],
              )}

              <p className="text-xs text-center" style={{ color: "rgba(255,255,255,.4)" }}>
                {t("goals_wizard_mode_hint")}
              </p>

              <Button
                onClick={() => goTo("routine-origin")}
                className="w-full h-12 rounded-2xl font-semibold"
              >
                {t("goals_continue")}
              </Button>
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

          {/* ── Quiz (6/7): ênfase muscular ──────────────────────── */}
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
                  goTo("quiz-body");
                }),
              )}
            </>
          )}

          {/* ── Quiz (7/7): corpo e articulações ─────────────────────
              O passo que transforma sugestão em prescrição: sexo, idade,
              altura, peso e articulações em cuidado alimentam o
              `CoachProfile`, que veta exercícios e ajusta séries, repetições
              e descanso. Vem preenchido do perfil — para a maioria é só
              conferir e seguir. */}
          {step === "quiz-body" && (
            <>
              {quizStepBadge(7)}
              <p className="text-sm -mt-1" style={{ color: "rgba(255,255,255,.5)" }}>
                {t("goals_quiz_body_subtitle")}
              </p>

              {/* Sexo — travado quando o perfil já tem: aqui é consulta, não
                  edição (o lugar de corrigir é o Perfil). */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold" style={{ color: "#fff" }}>
                  {t("goals_quiz_body_sex")}
                </Label>
                {lockedBodyFields.has("sex") ? (
                  <div
                    className="flex items-center gap-2 h-11 rounded-xl px-3.5 text-sm font-semibold"
                    style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", color: "rgba(255,255,255,.75)" }}
                  >
                    <Lock className="h-3.5 w-3.5 shrink-0" style={{ color: "rgba(255,255,255,.35)" }} />
                    {t(QUIZ_SEXES.find((o) => o.value === bodySex)?.labelKey ?? "goals_quiz_body_sex_other")}
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    {QUIZ_SEXES.map((o) => {
                      const active = bodySex === o.value;
                      return (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => setBodySex(active ? null : o.value)}
                          className="flex-1 h-11 rounded-xl text-xs font-semibold transition-all active:scale-95"
                          style={active
                            ? { background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff", border: "1px solid transparent" }
                            : { background: "rgba(255,255,255,.05)", color: "rgba(255,255,255,.6)", border: "1px solid rgba(255,255,255,.1)" }}
                        >
                          {t(o.labelKey)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Idade · altura · peso — cada um vira leitura se já existe no
                  perfil. Nos que sobram como input: type=text + inputMode
                  decimal (input numérico controlado descarta o separador
                  decimal no iOS). */}
              <div className="grid grid-cols-3 gap-2">
                {([
                  ["age", "goals_quiz_body_age", bodyAge, setBodyAge, "goals_quiz_body_age_unit"],
                  ["height", "goals_quiz_body_height", bodyHeight, setBodyHeight, "goals_quiz_body_height_unit"],
                  ["weight", "goals_quiz_body_weight", bodyWeight, setBodyWeight, "goals_quiz_body_weight_unit"],
                ] as const).map(([field, labelKey, value, setValue, unitKey]) => {
                  const locked = lockedBodyFields.has(field);
                  return (
                    <div key={field} className="space-y-1.5">
                      <Label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,.5)" }}>
                        {t(labelKey)}
                      </Label>
                      {locked ? (
                        <div
                          className="flex items-center gap-1 h-11 rounded-xl px-3 overflow-hidden"
                          style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}
                        >
                          <span className="text-base font-bold truncate" style={{ color: "rgba(255,255,255,.85)" }}>
                            {value}
                          </span>
                          <span className="text-[11px] font-semibold shrink-0" style={{ color: "rgba(255,255,255,.4)" }}>
                            {t(unitKey)}
                          </span>
                        </div>
                      ) : (
                        <div className="relative">
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={value}
                            onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ""))}
                            placeholder="—"
                            className="h-11 pr-9"
                            style={{ fontSize: "16px", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold pointer-events-none" style={{ color: "rgba(255,255,255,.4)" }}>
                            {t(unitKey)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Explica por que os campos travados não abrem para edição —
                  sem isso, campo cinza sem justificativa parece bug. */}
              {lockedBodyFields.size > 0 && (
                <p className="text-[11px] leading-relaxed -mt-1" style={{ color: "rgba(255,255,255,.4)" }}>
                  {t("goals_quiz_body_locked_hint")}
                </p>
              )}

              {/* IMC calculado — devolve na hora o que o app entendeu do corpo */}
              {coachProfile.bmi != null && (
                <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
                  {t("goals_quiz_body_bmi").replace("{bmi}", formatBmi(coachProfile.bmi, language === "en" ? "en" : "pt"))}
                </p>
              )}

              {/* Articulações em cuidado — vetam exercícios (não é preferência) */}
              <div className="space-y-2 pt-1">
                <Label className="text-sm font-semibold" style={{ color: "#fff" }}>
                  {t("goals_quiz_restrictions_label")}
                </Label>
                <p className="text-xs -mt-1" style={{ color: "rgba(255,255,255,.5)" }}>
                  {t("goals_quiz_restrictions_hint")}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {QUIZ_RESTRICTIONS.map((o) => {
                    const active = restrictions.has(o.value);
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => toggleRestriction(o.value)}
                        className="flex items-center gap-2 rounded-xl px-3 h-11 text-xs font-semibold text-left transition-all active:scale-95"
                        style={active
                          ? { background: "rgba(251,146,60,.14)", border: "1px solid #fb923c", color: "#fdba74" }
                          : { background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", color: "rgba(255,255,255,.6)" }}
                      >
                        <span className="text-base shrink-0">{o.emoji}</span>
                        <span className="truncate">{t(o.labelKey)}</span>
                      </button>
                    );
                  })}
                </div>
                {restrictions.size > 0 && (
                  <p className="text-[11px] leading-relaxed" style={{ color: "rgba(253,186,116,.85)" }}>
                    {t("goals_quiz_restrictions_disclaimer")}
                  </p>
                )}
              </div>

              <Button
                className="w-full rounded-full h-12"
                style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
                onClick={() => {
                  setExpandedDay(null);
                  goTo("suggested-program");
                }}
              >
                {t("goals_quiz_body_cta")}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setExpandedDay(null);
                  goTo("suggested-program");
                }}
                className="w-full text-xs font-semibold py-1"
                style={{ color: "rgba(255,255,255,.45)" }}
              >
                {t("goals_quiz_body_skip")}
              </button>
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
                const isSeqMode = scheduleMode === "sequential";
                return (
                  <>
                    {/* Como agendar: Dias da Semana × Sequencial (rodízio) */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold" style={{ color: "#fff" }}>{t("goals_wizard_sched_mode_label")}</Label>
                      <div className="flex gap-1.5 p-1 rounded-xl" style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)" }}>
                        {([["weekly", "goals_wizard_sched_weekly"], ["sequential", "goals_wizard_sched_sequential"]] as const).map(([mode, key]) => {
                          const active = scheduleMode === mode;
                          return (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setScheduleMode(mode)}
                              className="flex-1 h-9 rounded-lg text-xs font-semibold transition-all active:scale-95"
                              style={active
                                ? { background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }
                                : { background: "transparent", color: "rgba(255,255,255,.6)" }}
                            >
                              {t(key)}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
                        {isSeqMode ? t("goals_wizard_sched_sequential_hint") : t("goals_wizard_sched_weekly_hint")}
                      </p>
                    </div>

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
                          {isSeqMode
                            ? t("goals_seq_label")
                            : t("goals_program_days").replace("{n}", String(trainingDays))}
                        </span>
                      </div>
                      {/* tira da semana seg→dom (só no modo por dias) / aviso no sequencial */}
                      {isSeqMode ? (
                        <p className="text-[11px] pt-2" style={{ color: "rgba(255,255,255,.45)" }}>
                          {t("goals_program_seq_note")}
                        </p>
                      ) : (
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
                      )}
                    </div>

                    {/* ── "Por que este plano é seu" ──────────────────────
                        Cada nota corresponde a um ajuste que o gerador de fato
                        aplicou (ver buildCoachNotes em program-generator.ts).
                        É o que separa personalização de promessa de marketing. */}
                    {program.coachNotes && program.coachNotes.length > 0 && (
                      <div
                        className="rounded-2xl p-4 space-y-2.5"
                        style={{ background: "rgba(91,140,255,.08)", border: "1px solid rgba(91,140,255,.28)" }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">🎯</span>
                          <p className="text-sm font-bold tracking-tight" style={{ color: "#fff" }}>
                            {t("goals_coach_notes_title")}
                          </p>
                        </div>
                        <ul className="space-y-2">
                          {program.coachNotes.map((note, i) => (
                            <li key={i} className="flex gap-2 text-xs leading-relaxed">
                              <span className="shrink-0" style={{ color: "#5b8cff" }}>•</span>
                              <span style={{ color: "rgba(255,255,255,.72)" }}>
                                {language === "en" ? note.en : note.pt}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {!coachProfile.hasBodyData && (
                          <button
                            type="button"
                            onClick={() => goTo("quiz-body")}
                            className="text-[11px] font-semibold"
                            style={{ color: "#5b8cff" }}
                          >
                            {t("goals_coach_notes_add_body")}
                          </button>
                        )}
                      </div>
                    )}

                    {/* lista dos treinos distintos do programa */}
                    {program.workouts.map((workout, wIdx) => {
                      const wName = language === "en" ? workout.name.en : workout.name.pt;
                      const expanded = expandedDay === workout.key;
                      const editingThis = editingWorkoutKey === workout.key;
                      // dias da semana em que este treino aparece (modo por dias);
                      // no sequencial, a posição no rodízio (ordem de criação).
                      const days = program.week
                        .map((k, i) => (k === workout.key ? weekdayLetters[i] : null))
                        .filter(Boolean) as string[];
                      const scheduleLabel = isSeqMode
                        ? t("goals_program_seq_position").replace("{n}", String(wIdx + 1))
                        : days.length > 0
                          ? days.join(" · ")
                          : t("goals_program_rest_day");
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
                                  {scheduleLabel + " · " +
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
                                {workout.exercises.map((ex, i) => {
                                  // Dica de execução do movimento (base em
                                  // exercise-coaching.ts). Prescrever sem
                                  // ensinar a executar é entregar meia ficha.
                                  const cue = getExerciseShortCue(ex.name, language === "en" ? "en" : "pt");
                                  return (
                                  <li
                                    key={i}
                                    className="flex flex-col gap-0.5 text-xs py-1"
                                  >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium truncate mr-2 flex items-center gap-1.5" style={{ color: "#fff" }}>
                                      {/* Técnica sugerida pelo gerador. Só no
                                          expert: no simplificado ela não será
                                          gravada, então anunciá-la seria mentira. */}
                                      {trainingMode === "expert" && ex.technique && (
                                        <span
                                          className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide"
                                          style={{
                                            color: "#c084fc",
                                            background: "rgba(192,132,252,.14)",
                                            border: "1px solid rgba(192,132,252,.4)",
                                          }}
                                        >
                                          {ex.technique === "drop"
                                            ? t("goals_technique_drop")
                                            : ex.technique === "triset"
                                              ? t("goals_technique_triset")
                                              : ex.technique === "rest_pause"
                                                ? t("goals_technique_rest_pause")
                                                : t("goals_technique_biset")}
                                        </span>
                                      )}
                                      <span className="truncate">{ex.name}</span>
                                    </span>
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
                                  </div>
                                  {cue && (
                                    <p className="text-[11px] leading-snug pr-6" style={{ color: "rgba(255,255,255,.42)" }}>
                                      {cue}
                                    </p>
                                  )}
                                  </li>
                                  );
                                })}
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
                                        !workouts.some((w) =>
                                          [w.name, w.altName].some(
                                            (n) => n?.trim().toLowerCase() === exerciseSearch.trim().toLowerCase(),
                                          ),
                                        ) && (
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

                    {/* Aviso de saúde PERMANENTE (Guideline 1.4.1).
                        Antes só existia o aviso condicional do passo de
                        restrições — quem não marcasse nenhuma articulação
                        recebia uma prescrição de treino sem nenhuma ressalva na
                        tela. Esta é a tela onde a rotina sugerida aparece: é
                        aqui que o aviso precisa estar. */}
                    <p
                      className="text-[11px] leading-relaxed text-center px-2 pb-1"
                      style={{ color: "rgba(255,255,255,.45)" }}
                    >
                      {t("health_disclaimer")}
                    </p>
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

              {/* alternância: Lista · Músculo/Categoria. A antiga aba "Porção"
                  virou um nível dentro de "Músculo" — era o mesmo filtro. */}
              {(routineType === 1 ? muscleGroups.length : routineType === 2 ? dietCategories.length : 0) > 0 && (
                <div className="flex gap-1 p-1 rounded-2xl" style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}>
                  {([
                    ["list", t("goals_browse_list")] as const,
                    ["group", routineType === 1 ? t("goals_browse_muscle") : t("goals_browse_category")] as const,
                  ]).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setBrowseMode(mode);
                        setMuscleFilter(null);
                        setAnatomyMuscleId(null);
                        setSearchQuery("");
                      }}
                      className="flex-1 h-9 rounded-xl text-[12px] font-semibold transition-all active:scale-95"
                      style={browseMode === mode
                        ? { background: "linear-gradient(rgba(255,255,255,.95),rgba(255,255,255,.84))", color: "#0a0b12" }
                        : { color: "rgba(255,255,255,.6)" }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {/* Onde treinar: academia × em casa (só exercício). Fica acima dos
                  dois níveis do modo Músculo — o filtro vale para a lista, para
                  a navegação por grupo e para a contagem de cada grupo. */}
              {routineType === 1 && (
                <div className="flex gap-1.5">
                  {([
                    ["all", t("goals_browse_location_all")],
                    ["gym", t("goals_browse_location_gym")],
                    ["home", t("goals_browse_location_home")],
                  ] as const).map(([value, label]) => (
                    <ChipToggle
                      key={value}
                      active={locationFilter === value}
                      onClick={() => setLocationFilter(value)}
                      label={label}
                      icon={value === "gym" ? <Dumbbell className="h-3.5 w-3.5" /> : value === "home" ? <Home className="h-3.5 w-3.5" /> : undefined}
                      className="flex-1 justify-center"
                    />
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
                      // A contagem respeita o filtro de local — senão o card
                      // diria "31 itens" e a lista abriria com 4. Grupo que zera
                      // some da navegação.
                      const count = (routineType === 1
                        ? workouts.filter((w) => w.muscle_group === g && matchesExerciseLocation(w, locationFilter))
                        : diets.filter((d) => d.category === g)).length;
                      if (count === 0) return null;
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
                      onClick={() => {
                        setMuscleFilter(null);
                        setAnatomyMuscleId(null);
                      }}
                      className="flex items-center gap-1.5 text-sm font-semibold"
                      style={{ color: "#9d6bff" }}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span className="capitalize">{muscleFilter}</span>
                    </button>
                  )}

                  {/* Porções do grupo aberto (Peito → Peitoral superior/médio…).
                      Refina o mesmo filtro em vez de virar uma aba paralela:
                      escolher a porção troca a fonte da lista para a consulta
                      por ênfase em `workout_muscles`. */}
                  {browseMode === "group" && muscleFilter && groupMuscleParts.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,.4)" }}>
                        {t("goals_browse_parts_label")}
                      </p>
                      {/* Rolagem horizontal (nunca quebra linha): os nomes de
                          porção são longos ("Reto abdominal superior") e em 2–3
                          linhas a fileira empurrava a lista de exercícios para
                          fora da tela. `data-vaul-no-drag` protege o gesto
                          lateral do arraste do drawer. */}
                      <div
                        data-vaul-no-drag
                        className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 py-0.5"
                      >
                        <ChipToggle
                          active={!anatomyMuscleId}
                          onClick={() => setAnatomyMuscleId(null)}
                          label={t("goals_browse_parts_all")}
                          className="shrink-0"
                        />
                        {groupMuscleParts.map((m) => (
                          <ChipToggle
                            key={m.id}
                            active={anatomyMuscleId === m.id}
                            onClick={() => setAnatomyMuscleId(anatomyMuscleId === m.id ? null : m.id)}
                            label={m.name}
                            className="shrink-0"
                          />
                        ))}
                      </div>
                      {anatomyMuscleId && (
                        <p className="text-xs" style={{ color: "rgba(255,255,255,.4)" }}>
                          {t("goals_browse_anatomy_sorted")}
                        </p>
                      )}
                    </div>
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

              {catalogLoading || muscleWorkoutsLoading ? (
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
                                id: item.id,
                                // Só exercício criado pelo próprio usuário é editável
                                canEdit: routineType === 1 && !!(item as Workout).isCustom,
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
                            {/* Linha que representa um MOVIMENTO com variações
                                exibe o nome do grupo ("Supino") — a variação é
                                escolhida na hora do treino. */}
                            <p className="text-[15px] font-semibold truncate" style={{ color: locked ? "rgba(255,255,255,.6)" : "#fff" }}>
                              {itemGroup(item)?.name ?? item.name}
                            </p>
                            <p className="text-xs truncate" style={{ color: itemGroup(item) && !locked ? "#5b8cff" : "rgba(255,255,255,.5)" }}>
                              {locked
                                ? t("goals_wizard_already_added")
                                : routineType === 1
                                  ? (itemGroup(item)
                                      ? t("goals_variation_count").replace(
                                          "{n}",
                                          String(groupVariationCount(item)),
                                        )
                                      : item.muscle_group || "")
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

          {/* ── Step 4 (só expert): técnicas de treino ─────────────
              A rotina já foi criada quando este passo aparece — ele só
              acrescenta as técnicas. Fechar aqui NÃO desfaz nada, por isso a
              saída é "Pular" e não "Cancelar". */}
          {step === "build-technique" && (
            <>
              <TechniquePlanner
                items={techniqueItems}
                plan={techniquePlan}
                onChange={setTechniquePlan}
              />

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-full h-12"
                  style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.7)", border: "1px solid rgba(255,255,255,.12)" }}
                  disabled={isSaving}
                  onClick={() => onOpenChange(false)}
                >
                  {t("goals_skip")}
                </Button>
                <Button
                  className="flex-1 rounded-full h-12"
                  style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
                  disabled={isSaving}
                  onClick={async () => {
                    setIsSaving(true);
                    try {
                      await updateRoutineTechniquesDb(
                        userId,
                        planToAssignments(techniqueItems, techniquePlan),
                      );
                      toast({ title: t("goals_technique_saved") });
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
                  }}
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("goals_edit_routine_save")}
                </Button>
              </div>
            </>
          )}

          {/* ── Step 3: schedule (time + weekdays + goal) ─────────── */}
          {step === "build-schedule" && (
            <>
              {isHabitSchedule ? (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold" style={{ color: "#fff" }}>{t("goals_edit_routine_time_label")}</Label>
                  {/* "Cada hábito pode ter seu próprio horário" só faz sentido
                      quando há mais de um. */}
                  {selectedHabitsForSchedule.length > 1 && (
                    <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
                      {t("goals_wizard_habit_time_per_item_hint")}
                    </p>
                  )}
                  <div className="space-y-3">
                    {selectedHabitsForSchedule.map((h) => (
                      <HabitTimeRow
                        key={h.id}
                        name={h.name}
                        start={habitTimes[h.id] ?? ""}
                        end={habitEndTimes[h.id] ?? ""}
                        onStartChange={(v) => setHabitTimes((prev) => ({ ...prev, [h.id]: v }))}
                        onEndChange={(v) => setHabitEndTimes((prev) => ({ ...prev, [h.id]: v }))}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold" style={{ color: "#fff" }}>{t("goals_edit_routine_time_label")}</Label>
                    {/* Só aparece com horário preenchido: o <input type="time">
                        não oferece como limpar depois de tocado sem querer. */}
                    {scheduledTime && (
                      <button
                        type="button"
                        onClick={() => setScheduledTime("")}
                        className="flex items-center gap-1 text-xs font-medium active:scale-95 transition-transform"
                        style={{ color: "rgba(255,255,255,.55)" }}
                      >
                        <X className="h-3.5 w-3.5" />
                        {t("goals_clear_time")}
                      </button>
                    )}
                  </div>
                  <div
                    className="w-full h-11 rounded-xl overflow-hidden"
                    style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)" }}
                  >
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="block w-full h-full px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      // textAlign center: horário centralizado no campo (o iOS não
                      // centraliza o <input type="time"> sozinho).
                      style={{ fontSize: "16px", minWidth: 0, maxWidth: "100%", boxSizing: "border-box", background: "transparent", border: "none", color: "#fff", textAlign: "center" }}
                    />
                  </div>
                </div>
              )}

              {/* Modo de agendamento (só treino): Dias da Semana × Sequencial */}
              {routineType === 1 && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold" style={{ color: "#fff" }}>{t("goals_wizard_sched_mode_label")}</Label>
                  <div className="flex gap-1.5 p-1 rounded-xl" style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)" }}>
                    {([["weekly", "goals_wizard_sched_weekly"], ["sequential", "goals_wizard_sched_sequential"]] as const).map(([mode, key]) => {
                      const active = scheduleMode === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setScheduleMode(mode)}
                          className="flex-1 h-9 rounded-lg text-xs font-semibold transition-all active:scale-95"
                          style={active
                            ? { background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }
                            : { background: "transparent", color: "rgba(255,255,255,.6)" }}
                        >
                          {t(key)}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
                    {scheduleMode === "sequential" ? t("goals_wizard_sched_sequential_hint") : t("goals_wizard_sched_weekly_hint")}
                  </p>
                </div>
              )}

              {/* Dias da semana — oculto no modo Sequencial */}
              {!(routineType === 1 && scheduleMode === "sequential") && (
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
              )}

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

          {/* ── Step: horário dos hábitos NOVOS (modo adicionar itens) ── */}
          {step === "edit-item-times" && (
            <>
              <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
                {t("goals_wizard_new_habit_times_hint")}
              </p>
              <div className="space-y-3">
                {newHabitsForSchedule.map((h) => (
                  <HabitTimeRow
                    key={h.id}
                    name={h.name}
                    start={habitTimes[h.id] ?? ""}
                    end={habitEndTimes[h.id] ?? ""}
                    onStartChange={(v) => setHabitTimes((prev) => ({ ...prev, [h.id]: v }))}
                    onEndChange={(v) => setHabitEndTimes((prev) => ({ ...prev, [h.id]: v }))}
                  />
                ))}
              </div>
              <Button
                className="w-full rounded-full h-12"
                style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
                disabled={isSaving}
                onClick={handleAddItemsToRoutine}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t("goals_wizard_add_items_btn").replace("{n}", String(newSelectedCount))
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
                        onClick={() => handleSelectProgrammedGoal(g)}
                      >
                        {t("goals_select")}
                      </Button>
                    </div>
                  ))
              )}
              {!goalsLoading && programmedGoals.filter((g) => !selectedGoalIds.includes(g.id)).length === 0 && (
                <p className="text-sm text-center py-8" style={{ color: "rgba(255,255,255,.5)" }}>{t("goals_empty")}</p>
              )}
            </>
          )}

          {/* ── Step: adjust catalog goal ────────────────────────── */}
          {step === "goal-adjust" && catalogGoal && (
            <>
              <div className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
                <p className="text-sm font-semibold" style={{ color: "#fff" }}>{catalogGoal.description}</p>
                <div className="flex gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold">
                    <Calendar className="h-3.5 w-3.5" />
                    {catalogGoal.duration} {t("goals_catalog_days_label")}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 text-orange-400 text-xs font-semibold">
                    <Repeat2 className="h-3.5 w-3.5" />
                    {catalogGoal.quantity}{t("goals_catalog_per_week")}
                  </span>
                </div>
              </div>
              <p className="text-sm" style={{ color: "rgba(255,255,255,.6)" }}>
                {t("goals_adjust_question")}
              </p>
              {optionCard(
                () => handleCreateProgrammedGoal(catalogGoal.duration, catalogGoal.quantity),
                <Check className="h-5 w-5" />,
                t("goals_adjust_keep_title"),
                t("goals_adjust_keep_desc")
                  .replace("{d}", String(catalogGoal.duration))
                  .replace("{q}", String(catalogGoal.quantity)),
              )}
              {optionCard(
                () => {
                  // Volta os campos ao original a cada entrada — "alterar" parte
                  // sempre do valor de catálogo, não de uma edição abandonada.
                  setCatalogDuration(String(catalogGoal.duration));
                  setCatalogFrequency(String(catalogGoal.quantity));
                  goTo("goal-adjust-edit");
                },
                <Pencil className="h-5 w-5" />,
                t("goals_adjust_change_title"),
                t("goals_adjust_change_desc"),
              )}
              {addingGoalId !== null && (
                <div className="flex justify-center pt-2">
                  <Loader2 className="h-5 w-5 animate-spin" style={{ color: "rgba(255,255,255,.5)" }} />
                </div>
              )}
            </>
          )}

          {/* ── Step: adjust catalog goal — fields ───────────────── */}
          {step === "goal-adjust-edit" && catalogGoal && (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-semibold" style={{ color: "#fff" }}>{t("goals_gd_edit_duration")}</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={catalogDuration}
                  onChange={(e) => {
                    setCatalogDuration(e.target.value);
                    const d = parseInt(e.target.value, 10);
                    const f = parseInt(catalogFrequency, 10);
                    if (Number.isFinite(d) && d > 0 && Number.isFinite(f) && f > d) {
                      setCatalogFrequency(String(Math.min(7, d)));
                    }
                  }}
                  style={{ fontSize: "16px", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold" style={{ color: "#fff" }}>{t("goals_create_label_frequency")}</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={maxCatalogFrequency}
                  placeholder={t("goals_create_frequency_placeholder")}
                  value={catalogFrequency}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (e.target.value === "" || (v >= 1 && v <= maxCatalogFrequency)) {
                      setCatalogFrequency(e.target.value);
                    }
                  }}
                  style={{ fontSize: "16px", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }}
                />
                <p className="text-xs" style={{ color: "rgba(255,255,255,.45)" }}>
                  {t("goals_gd_edit_frequency_hint").replace("{max}", String(maxCatalogFrequency))}
                </p>
              </div>
              <Button
                className="w-full rounded-full h-12"
                style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
                disabled={addingGoalId !== null || !catalogDuration || !catalogFrequency}
                onClick={handleConfirmAdjustedGoal}
              >
                {addingGoalId !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : t("goals_adjust_confirm")}
              </Button>
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
                    onChange={(e) => {
                      setGoalCustomDuration(e.target.value);
                      // Duração menor que a frequência já digitada → acompanha
                      // o novo teto (senão o campo mostraria um valor inválido).
                      const d = parseInt(e.target.value, 10);
                      const f = parseInt(goalFrequency, 10);
                      if (Number.isFinite(d) && d > 0 && Number.isFinite(f) && f > d) {
                        setGoalFrequency(String(Math.min(7, d)));
                      }
                    }}
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
                  max={maxGoalFrequency}
                  placeholder={t("goals_create_frequency_placeholder")}
                  value={goalFrequency}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (e.target.value === "" || (v >= 1 && v <= maxGoalFrequency)) setGoalFrequency(e.target.value);
                  }}
                  style={{ fontSize: "16px", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }}
                />
                <p className="text-xs" style={{ color: "rgba(255,255,255,.45)" }}>
                  {t("goals_gd_edit_frequency_hint").replace("{max}", String(maxGoalFrequency))}
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
              onClick={() => {
                if (!editRoutine) return goTo("build-schedule");
                // Hábito: pergunta o horário de cada item novo antes de salvar.
                // Treino/dieta têm horário único, que os novos itens herdam —
                // não há o que perguntar.
                if (editRoutine.type === 3) return goTo("edit-item-times");
                return handleAddItemsToRoutine();
              }}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editRoutine && editRoutine.type !== 3 ? (
                t("goals_wizard_add_items_btn").replace("{n}", String(newSelectedCount))
              ) : (
                `${t("goals_continue")} · ${newSelectedCount}`
              )}
            </Button>
          </div>
        )}
      </DrawerContent>
    </Drawer>

    <ItemDetailDrawer
      item={detailItem}
      onClose={() => setDetailItem(null)}
      onSaved={(updated) => {
        // Reflete a edição na lista sem refetch (o cache do catálogo já foi
        // invalidado por updateCustomWorkoutDb para as próximas aberturas).
        setWorkouts((prev) =>
          prev.map((w) =>
            w.id === updated.id
              ? { ...w, name: updated.name, description: updated.description, photo: updated.photo }
              : w,
          ),
        );
        setDetailItem((prev) =>
          prev
            ? { ...prev, name: updated.name, description: updated.description, photo: updated.photo }
            : prev,
        );
      }}
      onDeleted={(id) => {
        // Remove o exercício apagado da lista e de qualquer seleção.
        setWorkouts((prev) => prev.filter((w) => w.id !== id));
        setSelectedIds((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }}
    />

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
