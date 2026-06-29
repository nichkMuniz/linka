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
  Sparkles,
  Target,
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
  getHabitsDb,
  getProgrammedGoalsDb,
  getUserRoutinesDb,
  getUserSelectedGoalIdsDb,
  getWorkoutsDb,
  updateRoutineGoalDb,
  updateRoutineItemsScheduledTimeDb,
  updateRoutineItemsScheduledDaysDb,
  type Diet,
  type Habit,
  type ProgrammedGoal,
  type RoutineTypeCode,
  type UserGoal,
  type Workout,
} from "@/lib/ritmofit-db";
import {
  WEEKLY_PROGRAMS,
  type FitnessLevel,
  type WeeklyProgram,
} from "@/components/goals/suggested-routines-data";

type WizardStep =
  | "what"
  | "routine-origin"
  | "suggested"
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

interface CreateWizardDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userGoals: UserGoal[];
  /** opens directly on a given step (e.g. empty states) */
  initialStep?: WizardStep;
  /** pre-selects the routine type when opening at the "build" step */
  initialRoutineType?: RoutineTypeCode;
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

export function CreateWizardDrawer({
  open,
  onOpenChange,
  userId,
  userGoals,
  initialStep = "what",
  initialRoutineType = 1,
  onCreated,
}: CreateWizardDrawerProps) {
  const { t, language } = useLanguage();
  const viewportHeight = useKeyboardAwareHeight();

  const [step, setStep] = React.useState<WizardStep>(initialStep);
  const [history, setHistory] = React.useState<WizardStep[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);

  // routine state
  const [routineType, setRoutineType] = React.useState<RoutineTypeCode>(1);
  const [routineName, setRoutineName] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [scheduledTime, setScheduledTime] = React.useState("");
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

  // suggested weekly program
  const [level, setLevel] = React.useState<FitnessLevel | null>(null);
  const [expandedDay, setExpandedDay] = React.useState<string | null>(null);
  const [addingProgram, setAddingProgram] = React.useState(false);

  // goal state
  const [programmedGoals, setProgrammedGoals] = React.useState<ProgrammedGoal[]>([]);
  const [selectedGoalIds, setSelectedGoalIds] = React.useState<string[]>([]);
  const [goalsLoading, setGoalsLoading] = React.useState(false);
  const [goalDescription, setGoalDescription] = React.useState("");
  const [goalType, setGoalType] = React.useState<1 | 2 | 3>(1);
  const [goalDuration, setGoalDuration] = React.useState(30);
  const [goalCustomDuration, setGoalCustomDuration] = React.useState("");
  const [useCustomDuration, setUseCustomDuration] = React.useState(false);
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
      setScheduledDays(new Set());
      setLinkGoalId(null);
      setSearchQuery("");
      setMuscleFilter(null);
      setBrowseMode("list");
      setShowCustomForm(false);
      setCustomName("");
      setCustomExtra("");
      setLevel(null);
      setExpandedDay(null);
      setGoalDescription("");
      setGoalType(1);
      setGoalDuration(30);
      setGoalCustomDuration("");
      setUseCustomDuration(false);
    } else {
      setStep(initialStep);
      setRoutineType(initialRoutineType);
    }
  }, [open, initialStep, initialRoutineType]);

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

  // lazy-load catalog when entering build step
  React.useEffect(() => {
    if (!open || step !== "build") return;
    setCatalogLoading(true);
    const load =
      routineType === 1 ? getWorkoutsDb().then(setWorkouts)
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

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
      if (routineType === 1) {
        const inserted = await createUserWorkoutsDb(userId, ids, { name: name || undefined });
        insertedIds = inserted.map((i) => i.id);
      } else if (routineType === 2) {
        const inserted = await createUserDietsDb(userId, ids, { name: name || undefined });
        insertedIds = inserted.map((i) => i.id);
      } else {
        const inserted = await createUserHabitsDb(userId, ids, { name: name || undefined });
        insertedIds = inserted.map((i) => i.id);
      }

      await backfillRoutineIdOnItemsDb(userId, routineType, name, insertedIds).catch(() => {});

      if (scheduledTime) {
        await updateRoutineItemsScheduledTimeDb(userId, routineType, name, scheduledTime).catch(() => {});
      }

      const daysStr = Array.from(scheduledDays).sort((a, b) => a - b).join(",");
      if (daysStr) {
        await updateRoutineItemsScheduledDaysDb(userId, routineType, name, daysStr).catch(() => {});
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

  const selectedProgram = React.useMemo(
    () => (level ? WEEKLY_PROGRAMS.find((p) => p.level === level) ?? null : null),
    [level],
  );

  /** cria todas as rotinas de um programa semanal de uma vez */
  const handleAddWeeklyProgram = async (program: WeeklyProgram) => {
    setAddingProgram(true);
    try {
      const catalog = await getWorkoutsDb();
      const byName = new Map(catalog.map((w) => [w.name.trim().toLowerCase(), w]));

      const createdNames: string[] = [];
      for (const workout of program.workouts) {
        const workoutIds: string[] = [];
        for (const ex of workout.exercises) {
          const key = ex.name.trim().toLowerCase();
          const match = byName.get(key);
          if (match) {
            workoutIds.push(match.id);
          } else {
            const created = await createCustomWorkoutDb(
              ex.name,
              `${ex.series}x${ex.reps}`,
              ex.muscleGroup,
            );
            byName.set(key, created); // reaproveita entre dias do mesmo programa
            workoutIds.push(created.id);
          }
        }

        const name = language === "en" ? workout.name.en : workout.name.pt;
        const inserted = await createUserWorkoutsDb(userId, workoutIds, { name });
        await backfillRoutineIdOnItemsDb(userId, 1, name, inserted.map((i) => i.id)).catch(() => {});
        createdNames.push(name);
      }

      // vincular cada rotina criada à meta escolhida (opcional)
      if (linkGoalId) {
        const userGoal = userGoals.find((g) => g.id === linkGoalId);
        if (userGoal) {
          const routines = await getUserRoutinesDb(userId);
          for (const name of createdNames) {
            const match = routines.find((r) => r.type === 1 && r.name === name);
            if (match) await updateRoutineGoalDb(match.id, userGoal.goal_id).catch(() => {});
          }
        }
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
      await createCustomGoalAndSelectDb(userId, goalDescription.trim(), goalType, duration, 1);
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
    "suggested": t("goals_suggest_level_title"),
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

  return (
    <>
    <Drawer open={open} onOpenChange={onOpenChange}>
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
            <DrawerTitle className="flex-1 text-left" style={{ color: "#fff" }}>{stepTitle[step]}</DrawerTitle>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-3">
          {/* ── Step: what to create ─────────────────────────────── */}
          {step === "what" && (
            <>
              {optionCard(
                () => { setRoutineType(1); goTo("routine-origin"); },
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
                () => goTo("suggested"),
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

          {/* ── Step: pick fitness level ─────────────────────────── */}
          {step === "suggested" && (
            <>
              <p className="text-sm -mt-1" style={{ color: "rgba(255,255,255,.5)" }}>
                {t("goals_suggest_level_subtitle")}
              </p>
              {LEVELS.map((l) => (
                <button
                  key={l.value}
                  onClick={() => {
                    setLevel(l.value);
                    setExpandedDay(null);
                    goTo("suggested-program");
                  }}
                  className="w-full flex items-center gap-3 rounded-2xl p-4 text-left active:scale-[0.99] transition-all"
                  style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}
                >
                  <span className="text-2xl shrink-0">{l.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "#fff" }}>{t(l.labelKey)}</p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>{t(l.descKey)}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "rgba(255,255,255,.4)" }} />
                </button>
              ))}
            </>
          )}

          {/* ── Step: weekly program preview ─────────────────────── */}
          {step === "suggested-program" && selectedProgram && (
            <>
              {(() => {
                const program = selectedProgram;
                const progName = language === "en" ? program.name.en : program.name.pt;
                const progDesc =
                  language === "en" ? program.description.en : program.description.pt;
                const trainingDays = program.week.filter(Boolean).length;
                const workoutByKey = new Map(program.workouts.map((w) => [w.key, w]));
                return (
                  <>
                    <div className="rounded-2xl p-4 space-y-2" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
                      <p className="text-base font-bold tracking-tight" style={{ color: "#fff" }}>{progName}</p>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>{progDesc}</p>
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
                          <button
                            className="w-full flex items-center gap-2 text-left"
                            onClick={() => setExpandedDay(expanded ? null : workout.key)}
                          >
                            <span className="text-lg shrink-0">🏋️</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate" style={{ color: "#fff" }}>{wName}</p>
                              <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
                                {days.join(" · ")} ·{" "}
                                {t("goals_suggest_n_exercises").replace(
                                  "{n}",
                                  String(workout.exercises.length),
                                )}
                              </p>
                            </div>
                            <ChevronRight
                              className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${
                                expanded ? "rotate-90" : ""
                              }`}
                            />
                          </button>
                          {expanded && (
                            <ul className="space-y-1 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
                              {workout.exercises.map((ex, i) => (
                                <li
                                  key={i}
                                  className="flex items-center justify-between text-xs py-1"
                                >
                                  <span className="font-medium truncate mr-2" style={{ color: "#fff" }}>{ex.name}</span>
                                  <span className="shrink-0" style={{ color: "rgba(255,255,255,.5)" }}>
                                    {ex.series}×{ex.reps} · {ex.muscleGroup}
                                  </span>
                                </li>
                              ))}
                            </ul>
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
          {step === "suggested-goal" && selectedProgram && (
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
                onClick={() => handleAddWeeklyProgram(selectedProgram)}
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
              <Label className="text-sm font-semibold" style={{ color: "#fff" }}>{t("goals_select_items_hint")}</Label>

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
                    return (
                      <div
                        key={item.id}
                        className="w-full flex items-center gap-3 rounded-2xl p-3 transition-all"
                        style={selected ? { border: "1px solid #5b8cff", background: "rgba(91,140,255,.1)" } : { border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)" }}
                      >
                        {routineType === 3 ? (
                          <div className="h-16 w-16 rounded-xl bg-muted/50 flex items-center justify-center text-2xl shrink-0">
                            ✅
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
                          onClick={() => toggleItem(item.id)}
                          className="flex-1 min-w-0 flex items-center gap-3 text-left"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-[15px] font-semibold truncate" style={{ color: "#fff" }}>{item.name}</p>
                            <p className="text-xs truncate" style={{ color: "rgba(255,255,255,.5)" }}>
                              {routineType === 1
                                ? item.muscle_group || ""
                                : routineType === 2
                                  ? [item.category, item.calories ? `${item.calories} kcal` : null].filter(Boolean).join(" · ")
                                  : item.description || ""}
                            </p>
                          </div>
                          <div
                            className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                              selected ? "bg-primary text-primary-foreground" : "bg-muted/50"
                            }`}
                          >
                            {selected && <Check className="h-4 w-4" />}
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
              <div className="space-y-2">
                <Label className="text-sm font-semibold" style={{ color: "#fff" }}>{t("goals_edit_routine_time_label")}</Label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full h-11 rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  style={{ fontSize: "16px", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }}
                />
              </div>

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
        {step === "build" && selectedIds.size > 0 && (
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
              onClick={() => goTo("build-schedule")}
            >
              {t("goals_continue")} · {selectedIds.size}
            </Button>
          </div>
        )}
      </DrawerContent>
    </Drawer>

    <ItemDetailDrawer item={detailItem} onClose={() => setDetailItem(null)} />
    </>
  );
}
