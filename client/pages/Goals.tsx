import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  getProgrammedGoalsDb,
  createUserGoalDb,
  createCustomGoalAndSelectDb,
  createCustomWorkoutDb,
  createCustomDietDb,
  updateUserGoalDb,
  deleteUserGoalDb,
  getUserSelectedGoalIdsDb,
  getWorkoutsDb,
  getDietsDb,
  getHabitsDb,
  createUserWorkoutsDb,
  createUserDietsDb,
  createUserHabitsDb,
  createRoutineDb,
  getUserRoutinesDb,
  getUserWorkoutsDb,
  getUserDietsDb,
  getUserHabitsDb,
  updateWorkoutSeriesDb,
  getUserGoalsDb,
  deleteRoutinesOfTypeDb,
  createCheckInDb,
  getTodayCheckInDb,
  getWeekCheckInsDb,
  getWorkoutHistoriesBatchDb,
  saveWorkoutHistoryDb,
  getWorkoutHistoryDb,
  toggleUserDietCompletionDb,
  toggleUserHabitCompletionDb,
  saveDietHistoryDb,
  saveHabitHistoryDb,
  updateRoutineGoalDb,
  hasCompletedRoutineToday,
  getRoutineTypeName,
  createPostDb,
  type ProgrammedGoal,
  type Workout,
  type Diet,
  type Habit,
  type Routine,
  type UserWorkoutWithDetails,
  type UserDietWithDetails,
  type UserHabitWithDetails,
  type UserGoal,
  type RoutineTypeCode,
  type WorkoutHistoryRecord,
} from "@/lib/ritmofit-db";
import { supabase } from "@/lib/supabase";
import { fetchExerciseCatalog, type CatalogExercise } from "@/lib/exercise-catalog";
import { ExerciseImage } from "@/components/exercise-image";
import { fetchMealCatalog, type CatalogMeal } from "@/lib/diet-catalog";
import { DietImage } from "@/components/diet-image";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  ChevronDown,
  Play,
  CheckCircle2,
  Circle,
  Plus,
  X,
  ChevronUp,
  Search,
  Filter,
  Pause,
  MoreVertical,
  Trash2,
  Edit2,
  Check,
  Clock,
  Share2,
  Flame,
  Dumbbell,
  Timer,
  TrendingUp,
  Camera,
  ImageIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { LoadingSpinner } from "@/components/animated-loading";
import { useLanguage } from "@/lib/language-context";

export default function Goals() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();

  // Metas tab state
  const [goals, setGoals] = React.useState<ProgrammedGoal[]>([]);
  const [selectedGoalIds, setSelectedGoalIds] = React.useState<string[]>([]);
  const [userGoals, setUserGoals] = React.useState<UserGoal[]>([]);

  // Add routine modal state
  const [addRoutineModalOpen, setAddRoutineModalOpen] = React.useState(false);
  const [selectedRoutineType, setSelectedRoutineType] = React.useState<
    number | null
  >(null);
  const [selectedItems, setSelectedItems] = React.useState<Set<string>>(
    new Set(),
  );
  const [isAddingRoutine, setIsAddingRoutine] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedMuscleGroups, setSelectedMuscleGroups] = React.useState<
    Set<string>
  >(new Set());
  const [selectedDietCategories, setSelectedDietCategories] = React.useState<Set<string>>(new Set());
  const [routineName, setRoutineName] = React.useState("");

  // Base data for lookups
  const [workouts, setWorkouts] = React.useState<Workout[]>([]);
  const [catalogExercises, setCatalogExercises] = React.useState<CatalogExercise[]>([]);
  const [catalogMeals, setCatalogMeals] = React.useState<CatalogMeal[]>([]);
  const [diets, setDiets] = React.useState<Diet[]>([]);
  const [habits, setHabits] = React.useState<Habit[]>([]);

  // Routines data
  const [routines, setRoutines] = React.useState<Routine[]>([]);
  const [userWorkouts, setUserWorkouts] = React.useState<
    UserWorkoutWithDetails[]
  >([]);
  const [userDiets, setUserDiets] = React.useState<UserDietWithDetails[]>([]);
  const [userHabits, setUserHabits] = React.useState<UserHabitWithDetails[]>(
    [],
  );
  const [expandedRoutineId, setExpandedRoutineId] = React.useState<
    string | null
  >(null); // Start with all routines closed

  // Workout modal state
  const [workoutModalOpen, setWorkoutModalOpen] = React.useState(false);
  const [selectedRoutineName, setSelectedRoutineName] = React.useState<string | null>(null);
  const [workoutSeries, setWorkoutSeries] = React.useState<
    Record<
      string,
      Array<{
        series: number;
        kg: number;
        reps: number;
        completed: boolean;
      }>
    >
  >({});
  const [workoutExerciseRestTimes, setWorkoutExerciseRestTimes] = React.useState<
    Record<string, number>
  >({}); // Rest time per exercise, not per series
  const [workoutDuration, setWorkoutDuration] = React.useState(0);
  const [workoutStartTime, setWorkoutStartTime] = React.useState<number | null>(
    null,
  );
  const [restTimerModalOpen, setRestTimerModalOpen] = React.useState(false);
  const [restTimerExerciseId, setRestTimerExerciseId] = React.useState<
    string | null
  >(null);
  const [restTimerRemaining, setRestTimerRemaining] = React.useState(0);
  const [restTimerPaused, setRestTimerPaused] = React.useState(false);
  const [swipedSeriesId, setSwipedSeriesId] = React.useState<string | null>(null);
  const [finishWorkoutConfirmOpen, setFinishWorkoutConfirmOpen] = React.useState(false);
  const [currentWorkoutIndex, setCurrentWorkoutIndex] = React.useState(0);
  const [workoutSummaryOpen, setWorkoutSummaryOpen] = React.useState(false);
  const [workoutSummaryData, setWorkoutSummaryData] = React.useState<{
    duration: number;
    totalVolume: number;
    totalSeries: number;
    exerciseNames: string[];
    routineName: string | null;
  } | null>(null);
  const [isSharingWorkout, setIsSharingWorkout] = React.useState(false);
  const [workoutCoverFile, setWorkoutCoverFile] = React.useState<File | null>(null);
  const [workoutCoverPreview, setWorkoutCoverPreview] = React.useState<string | null>(null);
  const workoutCanvasRef = React.useRef<HTMLCanvasElement>(null);

  // Edit goal modal state
  const [editGoalModalOpen, setEditGoalModalOpen] = React.useState(false);
  const [editingGoal, setEditingGoal] = React.useState<UserGoal | null>(null);
  const [editGoalDuration, setEditGoalDuration] = React.useState(0);
  const [editGoalQuantity, setEditGoalQuantity] = React.useState(0);
  const [isUpdatingGoal, setIsUpdatingGoal] = React.useState(false);

  // Check-in system state
  const [dailyCheckInDone, setDailyCheckInDone] = React.useState(false);
  const [isProcessingCheckIn, setIsProcessingCheckIn] = React.useState(false);
  const [weekCheckIns, setWeekCheckIns] = React.useState<Set<number>>(new Set()); // 0=dom, 1=seg, etc
  const [routineCompletedTodayStatus, setRoutineCompletedTodayStatus] = React.useState(false);
  const [badgesModalOpen, setBadgesModalOpen] = React.useState(false);
  const [hasNewBadge, setHasNewBadge] = React.useState(false);
  const lastSeenBadgeCountRef = React.useRef<number | null>(null);

  const getBadgeCount = (size: number) =>
    [1, 3, 5, 7].filter((t) => size >= t).length;

  React.useEffect(() => {
    if (!user) return;
    const storageKey = `ritmofit_badges_seen_${user.id}`;
    const currentBadgeCount = getBadgeCount(weekCheckIns.size);

    if (lastSeenBadgeCountRef.current === null) {
      const stored = localStorage.getItem(storageKey);
      const storedCount = stored ? parseInt(stored, 10) : 0;
      lastSeenBadgeCountRef.current = currentBadgeCount;
      if (currentBadgeCount > storedCount) {
        setHasNewBadge(true);
      }
    } else if (currentBadgeCount > lastSeenBadgeCountRef.current) {
      setHasNewBadge(true);
      lastSeenBadgeCountRef.current = currentBadgeCount;
    }
  }, [weekCheckIns.size, user?.id]);

  // Available goals accordion state
  const [availableGoalsOpen, setAvailableGoalsOpen] = React.useState(false);

  // Create custom workout drawer state
  const [createWorkoutDrawerOpen, setCreateWorkoutDrawerOpen] = React.useState(false);
  const [newWorkoutName, setNewWorkoutName] = React.useState("");
  const [newWorkoutDescription, setNewWorkoutDescription] = React.useState("");
  const [newWorkoutMuscleGroup, setNewWorkoutMuscleGroup] = React.useState("");
  const [isCreatingWorkout, setIsCreatingWorkout] = React.useState(false);

  // Create custom goal drawer state
  const [createGoalDrawerOpen, setCreateGoalDrawerOpen] = React.useState(false);
  const [newGoalDescription, setNewGoalDescription] = React.useState("");
  const [newGoalType, setNewGoalType] = React.useState<1 | 2 | 3>(1);
  const [newGoalDuration, setNewGoalDuration] = React.useState(30);
  const [newGoalQuantity, setNewGoalQuantity] = React.useState(1);
  const [isCreatingGoal, setIsCreatingGoal] = React.useState(false);

  // Goal completion celebration modal state
  const [celebrationGoal, setCelebrationGoal] = React.useState<UserGoal | null>(null);

  // Workout history modal state
  const [workoutHistoryModalOpen, setWorkoutHistoryModalOpen] = React.useState(false);
  const [selectedWorkoutForHistory, setSelectedWorkoutForHistory] = React.useState<Workout | null>(null);
  const [workoutHistory, setWorkoutHistory] = React.useState<WorkoutHistoryRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(false);

  // Workout history for displaying in series (during registration)
  const [workoutHistoriesMap, setWorkoutHistoriesMap] = React.useState<Record<string, WorkoutHistoryRecord[]>>({});

  // Goal selection for check-in state
  const [checkInGoalSelectionOpen, setCheckInGoalSelectionOpen] = React.useState(false);
  const [selectedCheckInGoal, setSelectedCheckInGoal] = React.useState<UserGoal | null>(null);

  // Routine selection for goal card state
  const [goalRoutineModalOpen, setGoalRoutineModalOpen] = React.useState(false);
  const [goalRoutineModalMode, setGoalRoutineModalMode] = React.useState<"link" | "view">("link");
  const [selectedGoalForRoutines, setSelectedGoalForRoutines] = React.useState<any>(null);
  const [goalRoutineSelection, setGoalRoutineSelection] = React.useState<Set<string>>(new Set());
  const [routineSearchQuery, setRoutineSearchQuery] = React.useState("");
  const [goalRoutineMuscleGroups, setGoalRoutineMuscleGroups] = React.useState<
    Set<string>
  >(new Set());
  const [openRoutineTypes, setOpenRoutineTypes] = React.useState<Set<number>>(new Set());
  const [openRoutineItems, setOpenRoutineItems] = React.useState<Set<string>>(new Set());

  // Completion tracking for Rotinas tab items
  const [completedDietIds, setCompletedDietIds] = React.useState<Set<string>>(new Set());
  const [completedHabitIds, setCompletedHabitIds] = React.useState<Set<string>>(new Set());

  // Collapsed section state for Rotinas tab (stores type codes of collapsed sections)
  const [collapsedSections, setCollapsedSections] = React.useState<Set<number>>(new Set());

  // Tracks which existing routine card we're adding items to (for pre-fill name context)
  const [addToRoutineCardName, setAddToRoutineCardName] = React.useState<string | null>(null);

  const handleToggleSection = React.useCallback((sType: number) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sType)) {
        next.delete(sType);
      } else {
        next.add(sType);
      }
      return next;
    });
  }, []);

  const REST_TIME_OPTIONS = [10, 20, 30, 40, 50, 60, 90, 120]; // in seconds

  // General state
  const [loading, setLoading] = React.useState(true);
  const [selectingGoalId, setSelectingGoalId] = React.useState<string | null>(
    null,
  );

  // Timer effect for workout duration
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (workoutModalOpen && workoutStartTime === null) {
      setWorkoutStartTime(Date.now());
    }
    if (workoutModalOpen && workoutStartTime !== null) {
      interval = setInterval(() => {
        setWorkoutDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [workoutModalOpen, workoutStartTime]);

  // Draw workout cover on canvas when summary opens
  React.useEffect(() => {
    if (!workoutSummaryOpen || !workoutSummaryData) return;
    const canvas = workoutCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { duration, totalVolume, totalSeries, exerciseNames, routineName } = workoutSummaryData;
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    const durationStr = mins > 0 ? `${mins}m ${secs > 0 ? `${secs}s` : ""}`.trim() : `${secs}s`;
    // Background
    const grad = ctx.createLinearGradient(0, 0, 800, 800);
    grad.addColorStop(0, "#0f172a");
    grad.addColorStop(1, "#1e3a2f");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 800);
    // Accent circles
    ctx.beginPath(); ctx.arc(700, 100, 220, 0, Math.PI * 2); ctx.fillStyle = "rgba(34,197,94,0.08)"; ctx.fill();
    ctx.beginPath(); ctx.arc(100, 700, 180, 0, Math.PI * 2); ctx.fillStyle = "rgba(34,197,94,0.06)"; ctx.fill();
    // Emoji
    ctx.font = "120px serif"; ctx.textAlign = "center";
    ctx.fillText("💪", 400, 220);
    // Title
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 52px system-ui, sans-serif";
    ctx.fillText("Treino Concluído!", 400, 320);
    // Routine name
    if (routineName) { ctx.fillStyle = "#86efac"; ctx.font = "32px system-ui, sans-serif"; ctx.fillText(routineName, 400, 375); }
    // Divider
    ctx.strokeStyle = "rgba(34,197,94,0.3)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(100, 420); ctx.lineTo(700, 420); ctx.stroke();
    // Stats
    const statsData = [
      { label: "Duração", value: durationStr },
      { label: "Volume", value: totalVolume > 0 ? `${totalVolume} kg` : "—" },
      { label: "Séries", value: String(totalSeries) },
    ];
    statsData.forEach((s, i) => {
      const x = 170 + i * 230;
      ctx.fillStyle = "#86efac"; ctx.font = "bold 44px system-ui, sans-serif"; ctx.fillText(s.value, x, 510);
      ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "24px system-ui, sans-serif"; ctx.fillText(s.label, x, 548);
    });
    // Exercises
    if (exerciseNames.length > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.font = "26px system-ui, sans-serif";
      ctx.fillText(exerciseNames.slice(0, 4).join("  ·  "), 400, 630);
    }
    // Branding
    ctx.fillStyle = "rgba(134,239,172,0.6)"; ctx.font = "bold 28px system-ui, sans-serif"; ctx.fillText("Linka", 400, 720);
    ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.font = "22px system-ui, sans-serif"; ctx.fillText("#Fitness #Treino", 400, 758);
  }, [workoutSummaryOpen, workoutSummaryData]);

  // Load all data on mount
  React.useEffect(() => {
    (async () => {
      try {
        // Batch 1 — user's goals and routines: critical, show first
        const criticalFetches: Promise<any>[] = [getProgrammedGoalsDb(), getUserSelectedGoalIdsDb()];
        if (user) {
          criticalFetches.push(
            getUserRoutinesDb(user.id),
            getUserWorkoutsDb(user.id),
            getUserDietsDb(user.id),
            getUserHabitsDb(user.id),
            getUserGoalsDb(),
          );
        }
        const criticalResults = await Promise.all(criticalFetches);

        setGoals(criticalResults[0]);
        setSelectedGoalIds(criticalResults[1]);
        if (user) {
          setRoutines(criticalResults[2]);
          setUserWorkouts(criticalResults[3]);
          setUserDiets(criticalResults[4]);
          setUserHabits(criticalResults[5]);
          setUserGoals(criticalResults[6]);
        }
        setLoading(false); // unblock UI immediately after critical data

        // Batch 2 — catalog data (workouts/diets/habits base lists + external APIs): load in background
        const [workoutsBaseData, dietsBaseData, habitsBaseData, catalogData, mealCatalogData] =
          await Promise.all([
            getWorkoutsDb(),
            getDietsDb(),
            getHabitsDb(),
            fetchExerciseCatalog().catch(() => [] as CatalogExercise[]),
            fetchMealCatalog().catch(() => [] as CatalogMeal[]),
          ]);
        setWorkouts(workoutsBaseData);
        setDiets(dietsBaseData);
        setHabits(habitsBaseData);
        setCatalogExercises(catalogData);
        setCatalogMeals(mealCatalogData);
      } catch (err: any) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Erro ao carregar dados:", errorMessage);
        toast({
          title: "Erro ao carregar dados",
          description: errorMessage || "Tente novamente.",
          variant: "destructive",
        });
        setLoading(false);
      }
    })();
  }, [user]);

  // Load today's check-in status and week check-ins from database (all in parallel)
  React.useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        const [todayCheckIn, weekCheckInDays, hasCompleted] = await Promise.all([
          getTodayCheckInDb(user.id),
          getWeekCheckInsDb(user.id),
          hasCompletedRoutineToday(user.id),
        ]);
        setDailyCheckInDone(todayCheckIn !== null);
        setWeekCheckIns(new Set(weekCheckInDays));
        setRoutineCompletedTodayStatus(hasCompleted);
      } catch (err) {
        console.error("Error loading check-in data:", err);
        setDailyCheckInDone(false);
        setWeekCheckIns(new Set());
        setRoutineCompletedTodayStatus(false);
      }
    })();
  }, [user]);

  // Reload completed routine status only when the user changes (not on every routine data update)
  // Completion status is updated optimistically after handleConfirmFinishWorkout/Diet/Habit
  React.useEffect(() => {
    if (!user) return;

    hasCompletedRoutineToday(user.id)
      .then(setRoutineCompletedTodayStatus)
      .catch(() => setRoutineCompletedTodayStatus(false));
  }, [user]);

  // Initialize workoutSeries with one series for each exercise when modal opens
  React.useEffect(() => {
    if (workoutModalOpen && userWorkouts.length > 0) {
      const initialSeries: Record<string, Array<{ series: number; kg: number; reps: number; completed: boolean }>> = {};
      userWorkouts.forEach((workout) => {
        if (!workoutSeries[workout.workout_id] || workoutSeries[workout.workout_id].length === 0) {
          initialSeries[workout.workout_id] = [
            {
              series: 1,
              kg: 0,
              reps: 0,
              completed: false,
            },
          ];
        }
      });
      if (Object.keys(initialSeries).length > 0) {
        setWorkoutSeries((prev) => ({
          ...prev,
          ...initialSeries,
        }));
      }

      // Load workout histories for all exercises in a single batch query
      if (user) {
        const workoutIds = userWorkouts.map((w) => w.workout_id).filter(Boolean);
        getWorkoutHistoriesBatchDb(user.id, workoutIds)
          .then(setWorkoutHistoriesMap)
          .catch((err) => console.error("Error loading workout histories:", err));
      }
    }
  }, [workoutModalOpen, userWorkouts]);

  const handleSelectGoal = async (goal: ProgrammedGoal) => {
    if (!user) {
      toast({
        title: "Faça login",
        description: "Você precisa estar logado para selecionar uma meta.",
        variant: "destructive",
      });
      return;
    }

    if (selectedGoalIds.includes(goal.id)) {
      toast({
        title: "Meta já selecionada",
        description: "Você já escolheu esta meta.",
        variant: "default",
      });
      return;
    }

    setSelectingGoalId(goal.id);

    try {
      await createUserGoalDb(
        goal.id,
        user.id,
        goal.type,
        goal.duration,
        goal.quantity,
      );

      toast({
        title: "Meta selecionada!",
        description: goal.description,
      });

      setSelectedGoalIds([...selectedGoalIds, goal.id]);
    } catch (err: any) {
      console.error("Erro ao selecionar meta:", err);
      toast({
        title: "Erro ao selecionar meta",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSelectingGoalId(null);
    }
  };

  const handleCreateCustomWorkout = async () => {
    if (!newWorkoutName.trim()) {
      toast({ title: "Nome obrigatório", description: "Informe o nome do exercício.", variant: "destructive" });
      return;
    }

    setIsCreatingWorkout(true);
    try {
      const newWorkout = await createCustomWorkoutDb(
        newWorkoutName.trim(),
        newWorkoutDescription.trim(),
        newWorkoutMuscleGroup.trim(),
      );

      // Add to local workouts list and auto-select it
      setWorkouts((prev) => [newWorkout, ...prev]);
      setSelectedItems((prev) => new Set([...prev, newWorkout.id]));

      toast({ title: "Exercício criado!", description: newWorkoutName.trim() });
      setCreateWorkoutDrawerOpen(false);
      setNewWorkoutName("");
      setNewWorkoutDescription("");
      setNewWorkoutMuscleGroup("");
    } catch (err: any) {
      toast({ title: "Erro ao criar exercício", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setIsCreatingWorkout(false);
    }
  };

  const handleCreateCustomGoal = async () => {
    if (!user) return;
    if (!newGoalDescription.trim()) {
      toast({ title: "Descrição obrigatória", description: "Informe uma descrição para a meta.", variant: "destructive" });
      return;
    }

    setIsCreatingGoal(true);
    try {
      const goalId = await createCustomGoalAndSelectDb(
        user.id,
        newGoalDescription.trim(),
        newGoalType,
        newGoalDuration,
        newGoalQuantity,
      );

      // Add to local goals list and selected ids
      const newGoal: ProgrammedGoal = {
        id: goalId,
        description: newGoalDescription.trim(),
        type: newGoalType,
        duration: newGoalDuration,
        quantity: newGoalQuantity,
      };
      setGoals((prev) => [newGoal, ...prev]);
      setSelectedGoalIds((prev) => [...prev, goalId]);

      toast({ title: "Meta criada!", description: newGoalDescription.trim() });
      setCreateGoalDrawerOpen(false);
      setNewGoalDescription("");
      setNewGoalType(1);
      setNewGoalDuration(30);
      setNewGoalQuantity(1);
    } catch (err: any) {
      toast({ title: "Erro ao criar meta", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setIsCreatingGoal(false);
    }
  };

  const handleAddRoutineClick = () => {
    setAddRoutineModalOpen(true);
    setSelectedRoutineType(null);
    setSelectedItems(new Set());
    setSearchQuery("");
    setSelectedMuscleGroups(new Set());
    setSelectedDietCategories(new Set());
  };

  const [isAddingFromWorkout, setIsAddingFromWorkout] = React.useState(false);

  const handleAddExerciseFromWorkout = () => {
    // When called from workout modal, automatically select exercises type and pre-check existing items
    setIsAddingFromWorkout(true);
    setAddRoutineModalOpen(true);
    setSelectedRoutineType(1); // 1 = Exercises
    const existingWorkoutIds = new Set(userWorkouts.map((w) => w.workout_id));
    setSelectedItems(existingWorkoutIds);
    setSearchQuery("");
    setSelectedMuscleGroups(new Set());
    setSelectedDietCategories(new Set());
  };

  const handleDeleteExercise = async (userWorkoutId: string) => {
    try {
      const { error } = await supabase
        .from("user_workouts")
        .delete()
        .eq("id", userWorkoutId);

      if (error) throw error;

      // Update local state
      setUserWorkouts((prev) => prev.filter((w) => w.id !== userWorkoutId));

      toast({
        title: "Exercício removido",
        description: "O exercício foi removido da sua lista.",
      });
    } catch (err: any) {
      console.error("Error deleting exercise:", err);
      toast({
        title: "Erro ao remover exercício",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  // routineCardName = the card's display label if named, null if it's the unnamed group
  const handleDeleteRoutineType = async (typeCode: number, routineCardName: string | null) => {
    try {
      if (!user || !supabase) return;

      const table =
        typeCode === 1 ? "user_workouts" : typeCode === 2 ? "user_diets" : "user_habits";

      // Delete matching items from user_* table
      if (routineCardName) {
        // Named routine: delete only items with this name
        const { error } = await supabase
          .from(table)
          .delete()
          .eq("user_id", user.id)
          .eq("name", routineCardName);
        if (error) throw error;
      } else {
        // Unnamed routine group: delete items with no name
        const { error } = await supabase
          .from(table)
          .delete()
          .eq("user_id", user.id)
          .is("name", null);
        if (error) throw error;
      }

      // Delete matching entry from routines table
      if (routineCardName) {
        const { error } = await supabase
          .from("routines")
          .delete()
          .eq("user_id", user.id)
          .eq("type", typeCode)
          .eq("name", routineCardName);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("routines")
          .delete()
          .eq("user_id", user.id)
          .eq("type", typeCode)
          .is("name", null);
        if (error) throw error;
      }

      // Update local state — remove only matching items
      if (typeCode === 1) {
        setUserWorkouts((prev) =>
          prev.filter((w) =>
            routineCardName ? w.name !== routineCardName : Boolean(w.name),
          ),
        );
      } else if (typeCode === 2) {
        setUserDiets((prev) =>
          prev.filter((d) =>
            routineCardName ? d.name !== routineCardName : Boolean(d.name),
          ),
        );
      } else if (typeCode === 3) {
        setUserHabits((prev) =>
          prev.filter((h) =>
            routineCardName ? h.name !== routineCardName : Boolean(h.name),
          ),
        );
      }

      // Remove matching entries from routines list
      setRoutines((prev) =>
        prev.filter((r) => {
          if (r.type !== typeCode) return true;
          if (routineCardName) return r.name !== routineCardName;
          return Boolean(r.name); // keep named, remove unnamed
        }),
      );

      toast({
        title: "Rotina removida",
        description: routineCardName
          ? `"${routineCardName}" foi removida.`
          : "Rotina sem nome removida.",
      });
    } catch (err: any) {
      console.error("Error deleting routine:", err);
      toast({
        title: "Erro ao remover rotina",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleDailyCheckIn = async () => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado.",
        variant: "destructive",
      });
      return;
    }

    // Check if user has completed any routine item
    const hasCompletedRoutines = userWorkouts.length > 0 || userDiets.length > 0 || userHabits.length > 0;

    if (!hasCompletedRoutines) {
      toast({
        title: "Nenhuma rotina completada",
        description: "Você precisa completar pelo menos uma rotina para fazer o check-in.",
        variant: "destructive",
      });
      return;
    }

    // If user has multiple goals, show modal for selection
    if (userGoals.length > 1) {
      const incompleteGoals = userGoals.filter((g) => g.perc < 100);
      if (incompleteGoals.length === 0) {
        toast({
          title: "Todas as metas completadas!",
          description: "Parabéns! Você completou todas as suas metas.",
        });
        return;
      }
      // Open goal selection modal
      setCheckInGoalSelectionOpen(true);
      return;
    }

    // Single goal - update it directly
    if (userGoals.length === 1) {
      // Single goal - update it directly
      const goal = userGoals[0];

      setIsProcessingCheckIn(true);
      try {
        // Create check-in in database
        await createCheckInDb(user.id);
        setDailyCheckInDone(true);

        // Update week check-ins
        const dayOfWeek = new Date().getDay();
        const newWeekCheckIns = new Set(weekCheckIns);
        newWeekCheckIns.add(dayOfWeek);
        setWeekCheckIns(newWeekCheckIns);

        // Update goal progress - increment by 1 and recalculate percentage
        const newProgress = goal.days_completed + 1;
        const newPercentage = Math.min(100, (newProgress / goal.quantity) * 100);

        await updateUserGoalDb(goal.id, {
          days_completed: newProgress,
          perc: newPercentage,
        });

        // Refresh user goals
        const updatedGoals = await getUserGoalsDb();
        setUserGoals(updatedGoals);

        // Check if this check-in completed the goal
        if (newPercentage >= 100) {
          setCelebrationGoal({ ...goal, days_completed: newProgress, perc: 100 });
        } else {
          toast({
            title: "Check-in realizado!",
            description: `Parabéns! Você completou seu check-in de hoje e atualizou a meta "${goal.description}".`,
          });
        }
      } catch (err: any) {
        const errorMsg = err?.message || "Tente novamente.";
        console.error("Error during check-in with goal:", errorMsg);
        toast({
          title: "Erro ao fazer check-in",
          description: errorMsg,
          variant: "destructive",
        });
      } finally {
        setIsProcessingCheckIn(false);
      }
    } else {
      // No goals - just do check-in without goal update
      setIsProcessingCheckIn(true);
      try {
        // Create check-in in database
        const checkIn = await createCheckInDb(user.id);
        setDailyCheckInDone(true);

        // Update week check-ins
        const dayOfWeek = new Date().getDay();
        const newWeekCheckIns = new Set(weekCheckIns);
        newWeekCheckIns.add(dayOfWeek);
        setWeekCheckIns(newWeekCheckIns);

        toast({
          title: "Check-in realizado!",
          description: "Parabéns! Você completou seu check-in de hoje.",
        });
      } catch (err: any) {
        const errorMsg = err?.message || "Tente novamente.";
        console.error("Error during check-in (no goal):", errorMsg);
        toast({
          title: "Erro ao fazer check-in",
          description: errorMsg,
          variant: "destructive",
        });
      } finally {
        setIsProcessingCheckIn(false);
      }
    }
  };

  const handleConfirmCheckInGoal = async () => {
    if (!selectedCheckInGoal || !user) return;

    setCheckInGoalSelectionOpen(false);
    setIsProcessingCheckIn(true);

    try {
      // Create check-in in database
      await createCheckInDb(user.id);
      setDailyCheckInDone(true);

      // Update week check-ins
      const dayOfWeek = new Date().getDay();
      const newWeekCheckIns = new Set(weekCheckIns);
      newWeekCheckIns.add(dayOfWeek);
      setWeekCheckIns(newWeekCheckIns);

      // Update goal progress - increment by 1 and recalculate percentage
      const newProgress = selectedCheckInGoal.days_completed + 1;
      const newPercentage = Math.min(100, (newProgress / selectedCheckInGoal.quantity) * 100);

      await updateUserGoalDb(selectedCheckInGoal.id, {
        days_completed: newProgress,
        perc: newPercentage,
      });

      // Refresh user goals
      const updatedGoals = await getUserGoalsDb();
      setUserGoals(updatedGoals);

      // Check if this check-in completed the goal
      if (newPercentage >= 100) {
        setCelebrationGoal({ ...selectedCheckInGoal, days_completed: newProgress, perc: 100 });
      } else {
        toast({
          title: "Check-in realizado!",
          description: `Parabéns! Você completou seu check-in de hoje e atualizou a meta "${selectedCheckInGoal.description}".`,
        });
      }
    } catch (err: any) {
      const errorMsg = err?.message || "Tente novamente.";
      console.error("Error during check-in (selected goal):", errorMsg);
      toast({
        title: "Erro ao fazer check-in",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsProcessingCheckIn(false);
    }
  };

  // Unified exercise list: local workouts + catalog (deduped by name)
  type UnifiedExercise = {
    key: string;
    id: string;
    name: string;
    description: string;
    photo: string | null;
    muscleGroup: string | null;
    isLocal: boolean;
    catalogId?: number;
    catalogImage?: string | null;
  };

  const unifiedExercises = React.useMemo<UnifiedExercise[]>(() => {
    const localNames = new Set(workouts.map((w) => w.name.toLowerCase()));
    const catalogFiltered = catalogExercises.filter(
      (c) => !localNames.has(c.name.toLowerCase())
    );
    return [
      ...workouts.filter((w) => w.photo).map((w) => ({
        key: `local-${w.id}`,
        id: w.id,
        name: w.name,
        description: w.description,
        photo: w.photo,
        muscleGroup: w.muscle_group || null,
        isLocal: true,
      })),
      ...catalogFiltered.map((c) => ({
        key: `catalog-${c.id}`,
        id: `catalog-${c.id}`,
        name: c.name,
        description: c.description,
        photo: c.image,
        muscleGroup: c.category || null,
        isLocal: false,
        catalogId: c.id,
        catalogImage: c.image,
      })),
    ];
  }, [workouts, catalogExercises]);

  // Get unique muscle groups from workouts
  const uniqueMuscleGroups = React.useMemo(() => {
    const groups = new Set<string>();
    unifiedExercises.forEach((ex) => {
      if (ex.muscleGroup) groups.add(ex.muscleGroup);
    });
    return Array.from(groups).sort();
  }, [unifiedExercises]);

  // Filter workouts based on search and muscle groups
  const filteredWorkouts = React.useMemo(() => {
    return unifiedExercises.filter((ex) => {
      const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ex.description && ex.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesMuscleGroup =
        selectedMuscleGroups.size === 0 ||
        selectedMuscleGroups.has(ex.muscleGroup || "");
      return matchesSearch && matchesMuscleGroup;
    });
  }, [unifiedExercises, searchQuery, selectedMuscleGroups]);

  // Unified diet list: local diets + catalog meals
  type UnifiedDiet = {
    key: string;
    id: string;
    name: string;
    description: string;
    photo: string | null;
    category: string | null;
    calories: number;
    isLocal: boolean;
    catalogId?: number;
  };

  const unifiedDiets = React.useMemo<UnifiedDiet[]>(() => {
    const localNames = new Set(diets.map((d) => d.name.toLowerCase()));
    const catalogFiltered = catalogMeals.filter(
      (c) => !localNames.has(c.name.toLowerCase())
    );
    return [
      ...diets.filter((d) => d.photo).map((d) => ({
        key: `local-${d.id}`,
        id: d.id,
        name: d.name,
        description: d.description,
        photo: d.photo,
        category: null as string | null,
        calories: d.calories,
        isLocal: true,
      })),
      ...catalogFiltered.map((c) => ({
        key: `catalog-${c.id}`,
        id: `catalog-${c.id}`,
        name: c.name,
        description: c.description,
        photo: c.image,
        category: c.category || null,
        calories: 0,
        isLocal: false,
        catalogId: c.id,
      })),
    ];
  }, [diets, catalogMeals]);

  const uniqueDietCategories = React.useMemo(() => {
    const cats = new Set<string>();
    unifiedDiets.forEach((d) => { if (d.category) cats.add(d.category); });
    return Array.from(cats).sort();
  }, [unifiedDiets]);

  const filteredDiets = React.useMemo(() => {
    return unifiedDiets.filter((d) => {
      const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedDietCategories.size === 0 ||
        selectedDietCategories.has(d.category || "");
      return matchesSearch && matchesCategory;
    });
  }, [unifiedDiets, searchQuery, selectedDietCategories]);

  const handleSelectItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleToggleMuscleGroup = (muscleGroup: string) => {
    const newSelected = new Set(selectedMuscleGroups);
    if (newSelected.has(muscleGroup)) {
      newSelected.delete(muscleGroup);
    } else {
      newSelected.add(muscleGroup);
    }
    setSelectedMuscleGroups(newSelected);
  };

  const handleToggleDietCategory = (category: string) => {
    const newSelected = new Set(selectedDietCategories);
    if (newSelected.has(category)) {
      newSelected.delete(category);
    } else {
      newSelected.add(category);
    }
    setSelectedDietCategories(newSelected);
  };

  const handleAddSerie = (workoutId: string) => {
    const currentSeries = workoutSeries[workoutId] || [];
    const nextSeriesNumber = currentSeries.length + 1;
    setWorkoutSeries({
      ...workoutSeries,
      [workoutId]: [
        ...currentSeries,
        {
          series: nextSeriesNumber,
          kg: 0,
          reps: 0,
          completed: false,
        },
      ],
    });
  };

  const handleUpdateSerie = (
    workoutId: string,
    seriesIndex: number,
    field: "kg" | "reps",
    value: number | string,
  ) => {
    const currentSeries = workoutSeries[workoutId] || [];
    const updated = [...currentSeries];

    // Handle empty values for numeric fields
    let numValue: number;
    if (value === "" || value === null) {
      numValue = 0;
    } else {
      numValue = typeof value === "string" ? parseFloat(value) || 0 : value;
    }

    updated[seriesIndex] = {
      ...updated[seriesIndex],
      [field]: numValue,
    };
    setWorkoutSeries({
      ...workoutSeries,
      [workoutId]: updated,
    });
  };

  const handleSetExerciseRestTime = (workoutId: string, seconds: number) => {
    setWorkoutExerciseRestTimes({
      ...workoutExerciseRestTimes,
      [workoutId]: seconds,
    });
  };

  const handleToggleSerieCompleted = (
    workoutId: string,
    seriesIndex: number,
  ) => {
    const currentSeries = workoutSeries[workoutId] || [];
    const updated = [...currentSeries];
    const isMarking = !updated[seriesIndex].completed;

    updated[seriesIndex] = {
      ...updated[seriesIndex],
      completed: isMarking,
    };
    setWorkoutSeries({
      ...workoutSeries,
      [workoutId]: updated,
    });

    // If marking as completed and rest time is set, open rest timer modal
    if (isMarking && workoutExerciseRestTimes[workoutId]) {
      setRestTimerExerciseId(workoutId);
      setRestTimerRemaining(workoutExerciseRestTimes[workoutId]);
      setRestTimerModalOpen(true);
    }
  };

  const handleDeleteSerie = (workoutId: string, seriesIndex: number) => {
    const currentSeries = workoutSeries[workoutId] || [];
    const updated = currentSeries.filter((_, idx) => idx !== seriesIndex);

    // Renumber the series
    const renumbered = updated.map((serie, idx) => ({
      ...serie,
      series: idx + 1,
    }));

    setWorkoutSeries({
      ...workoutSeries,
      [workoutId]: renumbered,
    });
  };

  const handleReorderExercises = (draggedIndex: number, targetIndex: number) => {
    const reordered = [...userWorkouts];
    const [dragged] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, dragged);
    setUserWorkouts(reordered);
  };

  // Rest timer effect
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (restTimerModalOpen && restTimerRemaining > 0 && !restTimerPaused) {
      interval = setInterval(() => {
        setRestTimerRemaining((prev) => {
          if (prev <= 1) {
            // Timer finished - play sound or show notification
            toast({
              title: "Tempo de descanso terminou!",
              description: "Pronto para a próxima série?",
            });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [restTimerModalOpen, restTimerRemaining]);

  const handleFinishWorkout = () => {
    if (!user) return;

    // Check if any exercises have completed series
    const hasCompletedSeries = userWorkouts.some((workout) => {
      const series = workoutSeries[workout.workout_id] || [];
      return series.some((s) => s.completed);
    });

    if (!hasCompletedSeries) {
      toast({
        title: "Nenhum exercício marcado como feito",
        description: "Marque pelo menos um exercício como concluído antes de finalizar.",
        variant: "destructive",
      });
      return;
    }

    // Show confirmation dialog
    setFinishWorkoutConfirmOpen(true);
  };

  const performAutoCheckIn = async () => {
    if (!user || dailyCheckInDone) return;
    try {
      await createCheckInDb(user.id);
      setDailyCheckInDone(true);
      setRoutineCompletedTodayStatus(true);
      const dayOfWeek = new Date().getDay();
      setWeekCheckIns((prev) => new Set(prev).add(dayOfWeek));
      toast({
        title: "Check-in automático realizado! ✓",
        description: "Sua rotina foi concluída e o check-in do dia foi registrado.",
      });
    } catch (err) {
      console.error("Auto check-in failed:", err);
    }
  };

  const handleConfirmFinishWorkout = async () => {
    if (!user) return;

    try {
      // Check if at least one series is completed
      let hasCompletedSeries = false;
      for (const series of Object.values(workoutSeries)) {
        if (series.some((s) => s.completed)) {
          hasCompletedSeries = true;
          break;
        }
      }

      if (!hasCompletedSeries) {
        toast({
          title: "Nenhuma série registrada",
          description:
            "Adicione e preencha pelo menos uma série para salvar o treino.",
          variant: "destructive",
        });
        return;
      }

      // Save workout history for each exercise with completed series
      for (const [workoutId, series] of Object.entries(workoutSeries)) {
        const completedSeries = series.filter((s) => s.completed);
        if (completedSeries.length > 0) {
          for (let i = 0; i < completedSeries.length; i++) {
            const serie = completedSeries[i];
            try {
              await saveWorkoutHistoryDb(
                user.id,
                null,
                workoutId,
                serie.kg || null,
                serie.reps ? `${serie.reps} reps` : null,
                null // calories not tracked in this form
              );
            } catch (historyErr) {
              console.error("Error saving workout history:", historyErr);
              // Continue even if history save fails
            }
          }
        }
      }

      // Calculate summary stats from completed series
      let totalVolume = 0;
      let totalSeries = 0;
      const exerciseNames: string[] = [];
      for (const [workoutId, series] of Object.entries(workoutSeries)) {
        const completed = series.filter((s) => s.completed);
        if (completed.length > 0) {
          totalSeries += completed.length;
          for (const s of completed) {
            totalVolume += (s.kg || 0) * (s.reps || 0);
          }
          const match = userWorkouts.find((w) => w.workout_id === workoutId);
          if (match?.workoutName) exerciseNames.push(match.workoutName);
        }
      }

      // Show summary screen instead of closing immediately
      setWorkoutSummaryData({
        duration: workoutDuration,
        totalVolume: Math.round(totalVolume * 10) / 10,
        totalSeries,
        exerciseNames,
        routineName: selectedRoutineName === "__unnamed__" ? null : selectedRoutineName,
      });
      setFinishWorkoutConfirmOpen(false);
      setWorkoutModalOpen(false);
      setWorkoutSummaryOpen(true);

      // Reset workout state
      setWorkoutSeries({});
      setCurrentWorkoutIndex(0);
      setWorkoutDuration(0);
      setWorkoutStartTime(null);

      // Refresh data in background
      Promise.all([
        getUserRoutinesDb(user.id),
        getUserWorkoutsDb(user.id),
        getUserDietsDb(user.id),
        getUserHabitsDb(user.id),
      ]).then(([routinesData, userWorkoutsData, userDietsData, userHabitsData]) => {
        setRoutines(routinesData);
        setUserWorkouts(userWorkoutsData);
        setUserDiets(userDietsData);
        setUserHabits(userHabitsData);
      });

      await performAutoCheckIn();
    } catch (err: any) {
      console.error("Error finishing workout:", err);
      toast({
        title: "Erro ao finalizar treino",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  const handleOpenWorkoutHistory = async (workout: Workout) => {
    if (!user) return;

    setSelectedWorkoutForHistory(workout);
    setWorkoutHistoryModalOpen(true);
    setIsLoadingHistory(true);

    try {
      const history = await getWorkoutHistoryDb(user.id, workout.id);
      setWorkoutHistory(history);
    } catch (err: any) {
      console.error("Error loading workout history:", err);
      toast({
        title: "Erro ao carregar histórico",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
      setWorkoutHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSaveRoutines = async () => {
    if (!user || selectedRoutineType === null || selectedItems.size === 0) {
      toast({
        title: "Selecione pelo menos um item",
        description: "Escolha um ou mais itens para adicionar.",
        variant: "destructive",
      });
      return;
    }

    setIsAddingRoutine(true);
    try {
      const itemIds = Array.from(selectedItems);

      // Always create a routine record so items appear in the routines tab
      await createRoutineDb(user.id, selectedRoutineType as RoutineTypeCode, routineName.trim() || undefined);

      if (selectedRoutineType === 1) {
        // Save workouts
        await createUserWorkoutsDb(user.id, itemIds, {
          name: routineName.trim() || undefined,
        });
      } else if (selectedRoutineType === 2) {
        // Save diets
        await createUserDietsDb(user.id, itemIds, {
          name: routineName.trim() || undefined,
        });
      } else if (selectedRoutineType === 3) {
        // Save habits
        await createUserHabitsDb(user.id, itemIds, {
          name: routineName.trim() || undefined,
        });
      }

      const typeLabel =
        selectedRoutineType === 1
          ? "Exercício(s)"
          : selectedRoutineType === 2
            ? "Dieta(s)"
            : "Hábito(s)";

      toast({
        title: "Rotinas adicionadas!",
        description: `${selectedItems.size} ${typeLabel} adicionado(s) com sucesso.`,
      });
      setAddRoutineModalOpen(false);
      setSelectedRoutineType(null);
      setSelectedItems(new Set());
      setRoutineName("");
      setSearchQuery("");
      setAddToRoutineCardName(null);

      // Refresh routines and items data to show newly added items
      if (user) {
        try {
          const [
            routinesData,
            userWorkoutsData,
            userDietsData,
            userHabitsData,
          ] = await Promise.all([
            getUserRoutinesDb(user.id),
            getUserWorkoutsDb(user.id),
            getUserDietsDb(user.id),
            getUserHabitsDb(user.id),
          ]);
          setRoutines(routinesData);
          setUserWorkouts(userWorkoutsData);
          setUserDiets(userDietsData);
          setUserHabits(userHabitsData);
        } catch (err) {
          console.error("Error refreshing routines and items:", err);
        }
      }
    } catch (err: any) {
      console.error("Error adding routines:", err);
      toast({
        title: "Erro ao adicionar rotinas",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsAddingRoutine(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <LoadingSpinner className="h-12 w-12" />
        <p className="text-sm text-muted-foreground">Carregando dados...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 overflow-x-hidden">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("goals_title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie suas metas e rotinas.
          </p>
        </div>

        {/* Badges Icon */}
        <div className="relative">
          <Button
            onClick={() => {
              setBadgesModalOpen(true);
              setHasNewBadge(false);
              if (user) {
                localStorage.setItem(
                  `ritmofit_badges_seen_${user.id}`,
                  String(getBadgeCount(weekCheckIns.size)),
                );
              }
            }}
            variant="outline"
            size="icon"
            className={`rounded-full transition-all ${hasNewBadge ? "animate-pulse border-yellow-500 shadow-md shadow-yellow-500/30" : ""}`}
            title="Ver insignias"
          >
            <span className="text-lg">🏆</span>
          </Button>
          {hasNewBadge && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
          )}
        </div>
      </div>

      <Tabs defaultValue="rotinas" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="metas">Metas</TabsTrigger>
          <TabsTrigger value="rotinas">Rotinas</TabsTrigger>
        </TabsList>

        {/* Metas Tab */}
        <TabsContent value="metas" className="space-y-6 fade-in">
          {goals.length ? (
            <>
              {/* Selected Goals Section */}
              {selectedGoalIds.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Minhas Metas Ativas</h3>
                    <span className="text-xs text-muted-foreground">
                      {selectedGoalIds.length} meta{selectedGoalIds.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {goals
                      .filter((goal) => selectedGoalIds.includes(goal.id))
                      .map((goal) => {
                        // Find the user goal data to get actual duration/quantity
                        const userGoal = userGoals.find(ug => ug.goal_id === goal.id);
                        const duration = userGoal?.duration || goal.duration;
                        const quantity = userGoal?.quantity || goal.quantity;

                        const goalTypeLabel =
                          goal.type === 1
                            ? "Fitness"
                            : goal.type === 2
                              ? "Saúde"
                              : "Hábitos";
                        const goalTypeColor =
                          goal.type === 1
                            ? "bg-blue-500/10 text-blue-600"
                            : goal.type === 2
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-orange-500/10 text-orange-600";

                        return (
                          <Card
                            key={goal.id}
                            className="border-brand/40 bg-brand/5 overflow-hidden flex flex-col"
                          >
                            <div className={`px-3 py-1.5 ${goalTypeColor} text-xs font-semibold`}>
                              ✓ {goalTypeLabel}
                            </div>
                            <CardHeader className="pb-2 pt-2">
                              <CardTitle className="text-sm line-clamp-2">
                                {goal.description}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 flex-1 flex flex-col">
                              <div className="grid grid-cols-2 gap-1.5 text-center text-xs">
                                <div className="bg-muted rounded p-1.5">
                                  <p className="text-muted-foreground">Duração</p>
                                  <p className="font-bold">{duration}d</p>
                                </div>
                                <div className="bg-muted rounded p-1.5">
                                  <p className="text-muted-foreground">Qtd</p>
                                  <p className="font-bold">{quantity}</p>
                                </div>
                              </div>

                              <div className="flex gap-2 mt-auto">
                                {(() => {
                                  const linkedRoutines = routines.filter(
                                    (r) => r.goal_id && String(r.goal_id) === String(goal.id)
                                  );
                                  const linkedGroupCount = new Set(
                                    linkedRoutines.map((r) => `${r.type}::${r.name || r.type}`)
                                  ).size;
                                  return (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="flex-1 rounded-full text-xs h-8"
                                      onClick={() => {
                                        const mode = linkedRoutines.length > 0 ? "view" : "link";
                                        setGoalRoutineModalMode(mode);
                                        setGoalRoutineModalOpen(true);
                                        setSelectedGoalForRoutines(goal);
                                        setGoalRoutineSelection(new Set());
                                        setOpenRoutineTypes(new Set());
                                        setOpenRoutineItems(new Set());
                                      }}
                                    >
                                      {linkedGroupCount > 0
                                        ? `Ver Rotinas (${linkedGroupCount})`
                                        : "Vincular Rotina"}
                                    </Button>
                                  );
                                })()}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 rounded-full text-xs h-8"
                                  onClick={() => {
                                    setEditingGoal({
                                      id: userGoal?.id || goal.id,
                                      goal_id: goal.id,
                                      description: goal.description,
                                      duration: duration,
                                      quantity: quantity,
                                      type_goal: goal.type ?? 0,
                                      perc: userGoal?.perc ?? 0,
                                      days_completed: userGoal?.days_completed ?? 0,
                                    });
                                    setEditGoalDuration(duration);
                                    setEditGoalQuantity(quantity);
                                    setEditGoalModalOpen(true);
                                  }}
                                >
                                  Editar
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Available Goals Section - Accordion */}
              {goals.filter((g) => !selectedGoalIds.includes(g.id)).length > 0 && (
                <Accordion type="single" collapsible defaultValue="">
                  <AccordionItem value="available-goals" className="border-border/60">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <h3 className="text-sm font-semibold">Metas Disponíveis</h3>
                        <span className="text-xs text-muted-foreground">
                          {goals.filter((g) => !selectedGoalIds.includes(g.id)).length} meta{
                            goals.filter((g) => !selectedGoalIds.includes(g.id)).length > 1 ? "s" : ""
                          }
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 pt-4">
                        {goals
                          .filter((g) => !selectedGoalIds.includes(g.id))
                          .map((goal) => {
                            const goalTypeLabel =
                              goal.type === 1
                                ? "Fitness"
                                : goal.type === 2
                                  ? "Saúde"
                                  : "Hábitos";
                            const goalTypeColor =
                              goal.type === 1
                                ? "bg-blue-500/10 text-blue-600"
                                : goal.type === 2
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : "bg-orange-500/10 text-orange-600";

                            return (
                              <Card
                                key={goal.id}
                                className="border-border/60 hover:border-border/80 transition-all cursor-pointer flex flex-col overflow-hidden"
                              >
                                <div className={`px-3 py-1.5 ${goalTypeColor} text-xs font-semibold`}>
                                  {goalTypeLabel}
                                </div>
                                <CardHeader className="pb-2 pt-2">
                                  <CardTitle className="text-sm line-clamp-2">
                                    {goal.description}
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 flex-1 flex flex-col">
                                  <div className="grid grid-cols-2 gap-1.5 text-center text-xs">
                                    <div className="bg-muted rounded p-1.5">
                                      <p className="text-muted-foreground">Duração</p>
                                      <p className="font-bold">{goal.duration}d</p>
                                    </div>
                                    <div className="bg-muted rounded p-1.5">
                                      <p className="text-muted-foreground">Qtd</p>
                                      <p className="font-bold">{goal.quantity}</p>
                                    </div>
                                  </div>

                                  <Button
                                    type="button"
                                    size="sm"
                                    className="w-full rounded-full mt-auto text-xs h-8"
                                    disabled={selectingGoalId === goal.id}
                                    onClick={() => handleSelectGoal(goal)}
                                  >
                                    {selectingGoalId === goal.id ? "Salvando..." : "Selecionar"}
                                  </Button>
                                </CardContent>
                              </Card>
                            );
                          })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
              {/* Create custom goal button */}
              <div className="flex justify-center pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full gap-2 text-sm"
                  onClick={() => setCreateGoalDrawerOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Não encontrei minha meta
                </Button>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhuma meta disponível no momento.
              </p>
              <Button
                type="button"
                variant="outline"
                className="rounded-full gap-2 text-sm mt-4"
                onClick={() => setCreateGoalDrawerOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Criar Meta Personalizada
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Rotinas Tab */}
        <TabsContent value="rotinas" className="space-y-4 fade-in px-2">
          {/* Daily Check-in Block */}
          <Card className={`border-2 ${dailyCheckInDone
              ? "border-green-500/50 bg-green-500/5"
              : "border-brand/30 bg-brand/5"
            }`}>
            <CardContent className="pt-6 pb-6">
              <div className="space-y-4">
                {/* Title and Description */}
                <div className="text-center">
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    {dailyCheckInDone ? "Check-in realizado hoje! ✓" : "Check-in Diário"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {dailyCheckInDone
                      ? "Volte amanhã para fazer novo check-in"
                      : "Conclua uma rotina e faça seu check-in"}
                  </p>
                </div>

                {/* Days of Week - grid layout adapts to screen width */}
                <div className="grid grid-cols-7 gap-1 w-full">
                  {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"].map((day, index) => (
                    <div
                      key={index}
                      className={`flex flex-col items-center justify-center aspect-square rounded-lg transition-all ${weekCheckIns.has(index)
                          ? "bg-brand text-white font-bold"
                          : "bg-muted text-muted-foreground"
                        }`}
                    >
                      <span className="text-[10px] font-medium">{day}</span>
                    </div>
                  ))}
                </div>

                {/* Check-in Button */}
                <Button
                  onClick={handleDailyCheckIn}
                  disabled={dailyCheckInDone || isProcessingCheckIn || !routineCompletedTodayStatus}
                  className="w-full rounded-full"
                  variant={dailyCheckInDone ? "outline" : "default"}
                >
                  {isProcessingCheckIn ? (
                    "Processando..."
                  ) : dailyCheckInDone ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Check-in Feito
                    </>
                  ) : !routineCompletedTodayStatus ? (
                    "Conclua uma rotina para fazer check-in"
                  ) : (
                    "Fazer Check In"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {(userWorkouts.length > 0 || userDiets.length > 0 || userHabits.length > 0) ? (
            <div className="space-y-4">
              {/* Group items by name directly from user items (no dependency on routines table) */}
              {(() => {
                const cards: any[] = [];

                // Helper: group items of a type by name
                const groupItemsByName = (items: any[], typeCode: number, defaultLabel: string) => {
                  const namedGroups = new Map<string, any[]>();
                  const unnamedItems: any[] = [];

                  items.forEach((item) => {
                    if (item.name) {
                      const existing = namedGroups.get(item.name) || [];
                      existing.push(item);
                      namedGroups.set(item.name, existing);
                    } else {
                      unnamedItems.push(item);
                    }
                  });

                  // Named groups (each distinct name = one card)
                  namedGroups.forEach((groupItems, name) => {
                    cards.push({
                      key: `named-${typeCode}-${name}`,
                      typeCode,
                      displayLabel: name,
                      itemsForRoutine: groupItems,
                      isNamed: true,
                    });
                  });

                  // Unnamed items grouped into one card
                  if (unnamedItems.length > 0) {
                    cards.push({
                      key: `unnamed-${typeCode}`,
                      typeCode,
                      displayLabel: defaultLabel,
                      itemsForRoutine: unnamedItems,
                      isNamed: false,
                    });
                  }
                };

                groupItemsByName(userWorkouts, 1, "Exercícios");
                groupItemsByName(userDiets, 2, "Dietas");
                groupItemsByName(userHabits, 3, "Hábitos");

                // Group cards by section (type)
                const sectionConfigs = [
                  { sType: 1, sLabel: "🏋️ Exercícios", sColor: "text-blue-600" },
                  { sType: 2, sLabel: "🥗 Dietas", sColor: "text-emerald-600" },
                  { sType: 3, sLabel: "🌱 Hábitos", sColor: "text-orange-600" },
                ];

                return sectionConfigs.flatMap(({ sType, sLabel, sColor }) => {
                  const sectionCards = cards.filter((c) => c.typeCode === sType);
                  if (sectionCards.length === 0) return [];

                  const isCollapsed = collapsedSections.has(sType);

                  const sectionHeader = (
                    <button
                      key={`section-header-${sType}`}
                      onClick={() => handleToggleSection(sType)}
                      className={`w-full flex items-center justify-between px-1 pt-2 pb-0.5 ${sColor} group`}
                    >
                      <span className="text-xs font-semibold uppercase tracking-wider">{sLabel}</span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform duration-200 ${isCollapsed ? "rotate-180" : ""
                          }`}
                      />
                    </button>
                  );

                  if (isCollapsed) return [sectionHeader];

                  const cardElements = sectionCards.map((card) => {
                    const { key, typeCode, displayLabel, itemsForRoutine, isNamed } = card;
                    const isExpanded = expandedRoutineId === key;

                    return (
                      <Card
                        key={key}
                        className="border-border/60 overflow-hidden min-w-0"
                      >
                        <div className="w-full p-3 flex items-center justify-between hover:bg-muted/30 transition-colors text-left min-w-0">
                          <button
                            onClick={() =>
                              setExpandedRoutineId(
                                isExpanded ? null : key,
                              )
                            }
                            className="flex-1 flex items-center justify-between min-w-0"
                          >
                            <div className="flex flex-col justify-center items-center flex-1 min-w-0 px-1">
                              <p className="text-sm font-medium truncate w-full text-center">{displayLabel}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {itemsForRoutine.length > 0
                                  ? `${itemsForRoutine.length} item(ns)`
                                  : "Sem itens"}
                              </p>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            )}
                          </button>

                          {/* Dropdown menu for routine actions */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="ml-2 p-2 hover:bg-muted/50 rounded transition-colors flex-shrink-0">
                                <MoreVertical className="h-4 w-4 text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem
                                onClick={() => {
                                  setAddRoutineModalOpen(true);
                                  setSelectedRoutineType(typeCode);
                                  setSelectedItems(new Set());
                                  setSearchQuery("");
                                  setSelectedMuscleGroups(new Set());
                                  setSelectedDietCategories(new Set());
                                  // Pre-fill routine name when adding to an existing named routine
                                  setRoutineName(isNamed ? displayLabel : "");
                                  setAddToRoutineCardName(isNamed ? displayLabel : null);
                                }}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                {typeCode === 1
                                  ? "Adicionar exercícios"
                                  : typeCode === 2
                                    ? "Adicionar dietas"
                                    : "Adicionar hábito"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteRoutineType(typeCode, isNamed ? displayLabel : null)}
                                className="text-red-500"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir rotina
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>

                          {/* Play button for exercises */}
                          {typeCode === 1 && itemsForRoutine.length > 0 && (
                            <button
                              onClick={() => {
                                // Use "__unnamed__" for routines without a name
                                setSelectedRoutineName(isNamed ? displayLabel : "__unnamed__");
                                setWorkoutModalOpen(true);
                              }}
                              className="ml-2 p-2 rounded-lg bg-brand/10 hover:bg-brand/20 transition-colors"
                            >
                              <Play className="h-5 w-5 text-brand" />
                            </button>
                          )}
                        </div>

                        {/* Expanded content */}
                        {isExpanded && (
                          <div className="border-t border-border/60 bg-muted/20 p-2.5 space-y-1.5">
                            {itemsForRoutine.length > 0 ? (
                              itemsForRoutine.map((item: any) => (
                                <div
                                  key={item.id}
                                  className="space-y-1.5"
                                >
                                  <div className="flex items-start gap-2.5 rounded-lg">
                                    {/* Mark as completed checkbox for diets (left side) */}
                                    {typeCode === 2 && (
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          const isCompleting = !completedDietIds.has(item.id);
                                          const newCompletedIds = new Set(completedDietIds);
                                          if (isCompleting) {
                                            newCompletedIds.add(item.id);
                                          } else {
                                            newCompletedIds.delete(item.id);
                                          }
                                          setCompletedDietIds(newCompletedIds);
                                          try {
                                            await toggleUserDietCompletionDb(item.id, isCompleting);
                                            if (isCompleting && user) {
                                              await saveDietHistoryDb(
                                                user.id,
                                                Number(item.diet_id),
                                                item.quantity ?? null,
                                                item.calories ?? null
                                              );
                                              await performAutoCheckIn();
                                            }
                                            if (!isCompleting) {
                                              toast({
                                                title: "Dieta desmarcada",
                                              });
                                            }
                                          } catch (err) {
                                            // Rollback optimistic update
                                            setCompletedDietIds(completedDietIds);
                                            toast({
                                              title: "Erro ao atualizar status da dieta",
                                              variant: "destructive",
                                            });
                                          }
                                        }}
                                        className={`py-1 px-2 rounded text-xs font-semibold transition-all flex-shrink-0 ${completedDietIds.has(item.id)
                                            ? "bg-green-500/20 text-green-700"
                                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                                          }`}
                                      >
                                        {completedDietIds.has(item.id) ? "✓" : "○"}
                                      </button>
                                    )}

                                    {typeCode === 3 && (
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          const isCompleting = !completedHabitIds.has(item.id);
                                          const newCompletedIds = new Set(completedHabitIds);
                                          if (isCompleting) {
                                            newCompletedIds.add(item.id);
                                          } else {
                                            newCompletedIds.delete(item.id);
                                          }
                                          setCompletedHabitIds(newCompletedIds);
                                          try {
                                            await toggleUserHabitCompletionDb(item.id, isCompleting);
                                            if (isCompleting && user) {
                                              await saveHabitHistoryDb(
                                                user.id,
                                                Number(item.habit_id),
                                                item.quantity ?? null,
                                                item.frequency ?? null
                                              );
                                              await performAutoCheckIn();
                                            }
                                            if (!isCompleting) {
                                              toast({
                                                title: "Hábito desmarcado",
                                              });
                                            }
                                          } catch (err) {
                                            // Rollback optimistic update
                                            setCompletedHabitIds(completedHabitIds);
                                            toast({
                                              title: "Erro ao atualizar status do hábito",
                                              variant: "destructive",
                                            });
                                          }
                                        }}
                                        className={`py-1 px-2 rounded text-xs font-semibold transition-all flex-shrink-0 ${completedHabitIds.has(item.id)
                                            ? "bg-green-500/20 text-green-700"
                                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                                          }`}
                                      >
                                        {completedHabitIds.has(item.id) ? "✓" : "○"}
                                      </button>
                                    )}

                                    {/* Clickable item - only for exercises (typeCode === 1) */}
                                    <button
                                      onClick={() => {
                                        if (typeCode === 1) {
                                          handleOpenWorkoutHistory({
                                            id: item.workout_id,
                                            name: item.workoutName,
                                            description: item.workoutDescription || undefined,
                                            photo: item.workoutPhoto || undefined,
                                          } as any);
                                        }
                                      }}
                                      className={`flex-1 flex items-start gap-3 p-2 rounded-lg transition-colors ${typeCode === 1 ? "hover:bg-muted/50 cursor-pointer" : ""
                                        }`}
                                      disabled={typeCode !== 1}
                                    >
                                      {/* Image thumbnail */}
                                      {typeCode === 1 && (
                                        <ExerciseImage
                                          photo={item.workoutPhoto || null}
                                          name={item.workoutName || ""}
                                          muscleGroup={item.muscle_group || null}
                                          className="h-10 w-10 flex-shrink-0"
                                        />
                                      )}
                                      {typeCode === 2 && (
                                        <DietImage
                                          photo={item.dietPhoto || null}
                                          name={item.dietName || ""}
                                          className="h-10 w-10 flex-shrink-0"
                                        />
                                      )}
                                      <div className="flex-1 min-w-0 text-left">
                                        <p className="text-sm font-medium truncate">
                                          {typeCode === 1
                                            ? item.workoutName
                                            : typeCode === 2
                                              ? item.dietName
                                              : item.habitName}
                                        </p>
                                        {(item.workoutDescription ||
                                          item.dietDescription ||
                                          item.habitDescription) && (
                                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                              {typeCode === 1
                                                ? item.workoutDescription
                                                : typeCode === 2
                                                  ? item.dietDescription
                                                  : item.habitDescription}
                                            </p>
                                          )}
                                        {typeCode === 2 && item.dietCalories && (
                                          <p className="text-xs text-muted-foreground mt-1">
                                            {item.dietCalories} cal
                                          </p>
                                        )}
                                      </div>
                                    </button>

                                    {/* Delete button */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteExercise(item.id);
                                      }}
                                      className="p-2 hover:bg-red-500/10 rounded transition-colors flex-shrink-0"
                                      title="Remover exercício"
                                    >
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-muted-foreground text-center py-2">
                                Nenhum item adicionado
                              </p>
                            )}
                          </div>
                        )}
                      </Card>
                    );
                  });

                  return [sectionHeader, ...cardElements];
                });
              })()}

              {/* Add more button */}
              <div className="flex justify-center pt-4 pb-4">
                <Button
                  onClick={handleAddRoutineClick}
                  className="rounded-full gap-2"
                  variant="outline"
                >
                  <Plus className="h-5 w-5" />
                  Nova Rotina
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-center pt-12 pb-12">
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  Crie uma nova Rotina
                </p>
                <Button
                  onClick={handleAddRoutineClick}
                  className="rounded-full gap-2"
                  size="lg"
                >
                  <Plus className="h-5 w-5" />
                  Adicionar
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Routine Drawer Modal */}
      <Drawer open={addRoutineModalOpen} onOpenChange={(open) => { setAddRoutineModalOpen(open); if (!open) setIsAddingFromWorkout(false); }}>
        <DrawerContent className="max-h-[90dvh] flex flex-col modal-enter">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>Adicionar Rotina</DrawerTitle>
          </DrawerHeader>

          <div className="flex flex-col flex-1 gap-4 overflow-hidden px-4 pb-4">
            {/* Context banner when adding to an existing named routine */}
            {addToRoutineCardName && selectedRoutineType !== null && (
              <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-brand/10 border border-brand/20 rounded-lg">
                <span className="text-xs text-brand">Adicionando à rotina:</span>
                <span className="text-xs font-semibold text-brand">{addToRoutineCardName}</span>
              </div>
            )}

            {/* Type Selection */}
            {selectedRoutineType === null ? (
              <div className="space-y-5">
                {/* Nome da rotina — destacado */}
                <div className="rounded-xl border-2 border-brand/40 bg-brand/5 p-4 space-y-2">
                  <Label htmlFor="routine_name" className="text-sm font-semibold text-brand">
                    Nome da Rotina (opcional)
                  </Label>
                  <Input
                    id="routine_name"
                    type="text"
                    value={routineName}
                    onChange={(e) => setRoutineName(e.target.value)}
                    className="h-10 border-brand/30 focus:border-brand bg-background"
                  />
                  <p className="text-xs text-muted-foreground">
                    Dê um nome para identificar sua rotina, ex: "Treino de Peito"
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Selecione o tipo:</p>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { code: 1, label: "Exercícios", emoji: "🏋️", desc: "Treinos e séries de musculação" },
                      { code: 2, label: "Dietas", emoji: "🥗", desc: "Planos alimentares e refeições" },
                      { code: 3, label: "Hábitos", emoji: "✅", desc: "Rotinas diárias e objetivos" },
                    ].map(({ code, label, emoji, desc }) => (
                      <button
                        key={code}
                        onClick={() => { setSelectedRoutineType(code); setSearchQuery(""); }}
                        className="p-4 border border-border/60 rounded-lg hover:bg-muted/50 hover:border-border transition-colors text-left flex items-center gap-3"
                      >
                        <span className="text-2xl">{emoji}</span>
                        <div>
                          <p className="font-semibold text-sm">{label}</p>
                          <p className="text-xs text-muted-foreground">{desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Item Selection */}
                <div className="space-y-3 flex-1 overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {selectedRoutineType === 1
                        ? "Exercícios"
                        : selectedRoutineType === 2
                          ? "Dietas"
                          : "Hábitos"}
                    </p>
                    {!isAddingFromWorkout && (
                      <button
                        onClick={() => {
                          setSelectedRoutineType(null);
                          setSelectedItems(new Set());
                          setSearchQuery("");
                          setSelectedMuscleGroups(new Set());
                          setSelectedDietCategories(new Set());
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Voltar
                      </button>
                    )}
                  </div>

                  {/* Search for Habits */}
                  {selectedRoutineType === 3 && (
                    <div className="relative shrink-0">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Buscar hábito..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-9"
                      />
                    </div>
                  )}

                  {/* Search and Filter for Diets */}
                  {selectedRoutineType === 2 && (
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder="Buscar dieta..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 h-9"
                        />
                      </div>
                      {uniqueDietCategories.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <p className="text-xs font-medium text-muted-foreground">
                              Filtrar por categoria:
                            </p>
                            {selectedDietCategories.size > 0 && (
                              <button
                                onClick={() => setSelectedDietCategories(new Set())}
                                className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
                              >
                                Limpar
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {uniqueDietCategories.map((cat) => (
                              <button
                                key={cat}
                                onClick={() => handleToggleDietCategory(cat)}
                                className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                                  selectedDietCategories.has(cat)
                                    ? "border-brand bg-brand/20 text-brand"
                                    : "border-border/60 text-muted-foreground hover:border-border/80"
                                }`}
                              >
                                {cat}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Search and Filter for Exercises */}
                  {selectedRoutineType === 1 && (
                    <div className="space-y-3">
                      {/* Search Bar */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder="Buscar exercício..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 h-9"
                        />
                      </div>

                      {/* Muscle Group Filter */}
                      {uniqueMuscleGroups.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <p className="text-xs font-medium text-muted-foreground">
                              Filtrar por grupo muscular:
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {uniqueMuscleGroups.map((muscleGroup) => (
                              <button
                                key={muscleGroup}
                                onClick={() =>
                                  handleToggleMuscleGroup(muscleGroup)
                                }
                                className={`px-3 py-1.5 text-xs rounded-full border transition-all ${selectedMuscleGroups.has(muscleGroup)
                                  ? "border-brand bg-brand/20 text-brand"
                                  : "border-border/60 text-muted-foreground hover:border-border/80"
                                  }`}
                              >
                                {muscleGroup}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Items List */}
                  <div className="space-y-2">
                    {selectedRoutineType === 1 &&
                      filteredWorkouts.map((exercise) => {
                        const isAlreadySelected = userWorkouts.some(
                          (uw) => uw.workout_id === exercise.id
                        );
                        const isNewSelection = selectedItems.has(exercise.id);

                        return (
                          <button
                            key={exercise.key}
                            onClick={async () => {
                              if (!exercise.isLocal && !selectedItems.has(exercise.id)) {
                                // Create catalog exercise in DB first
                                try {
                                  const created = await createCustomWorkoutDb(
                                    exercise.name,
                                    exercise.description,
                                    exercise.muscleGroup || "",
                                    exercise.catalogImage,
                                  );
                                  exercise.id = created.id;
                                  exercise.isLocal = true;
                                  handleSelectItem(created.id);
                                } catch (err: any) {
                                  toast({
                                    title: "Erro ao adicionar exercício",
                                    description: err?.message || "Tente novamente.",
                                    variant: "destructive",
                                  });
                                }
                              } else {
                                handleSelectItem(exercise.id);
                              }
                            }}
                            className={`w-full p-3 rounded-lg border transition-all text-left ${isNewSelection
                                ? "border-brand bg-brand/10"
                                : isAlreadySelected
                                  ? "border-green-500/40 bg-green-500/5"
                                  : "border-border/60 hover:border-border/80"
                              }`}
                          >
                            <div className="flex items-center gap-3">
                              <ExerciseImage
                                photo={exercise.photo}
                                name={exercise.name}
                                muscleGroup={exercise.muscleGroup}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium">
                                    {exercise.name}
                                  </span>
                                  {isAlreadySelected && !isNewSelection && (
                                    <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                                      ✓ Já adicionado
                                    </p>
                                  )}
                                </div>
                                {exercise.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                    {exercise.description}
                                  </p>
                                )}
                                {exercise.muscleGroup && (
                                  <span className="inline-block text-[10px] font-medium text-brand bg-brand/10 px-2 py-0.5 rounded-full mt-1">
                                    {exercise.muscleGroup}
                                  </span>
                                )}
                              </div>
                              <input
                                type="checkbox"
                                checked={isNewSelection}
                                onChange={() => { }}
                                className="h-4 w-4 flex-shrink-0"
                              />
                            </div>
                          </button>
                        );
                      })}

                    {selectedRoutineType === 1 && (
                      <div className="flex justify-center pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-full gap-2 text-xs"
                          onClick={() => setCreateWorkoutDrawerOpen(true)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Não encontrei meu exercício
                        </Button>
                      </div>
                    )}

                    {selectedRoutineType === 2 &&
                      filteredDiets.map((diet) => {
                        const isAlreadyInRoutine = userDiets.some(
                          (ud) =>
                            ud.diet_id === diet.id &&
                            (addToRoutineCardName
                              ? ud.name === addToRoutineCardName
                              : !ud.name),
                        );
                        const isNewSelection = selectedItems.has(diet.id);
                        return (
                          <button
                            key={diet.key}
                            onClick={async () => {
                              if (!diet.isLocal && !selectedItems.has(diet.id)) {
                                try {
                                  const created = await createCustomDietDb(
                                    diet.name,
                                    diet.description,
                                    diet.photo,
                                    diet.calories,
                                  );
                                  diet.id = created.id;
                                  diet.isLocal = true;
                                  handleSelectItem(created.id);
                                } catch (err: any) {
                                  toast({
                                    title: "Erro ao adicionar dieta",
                                    description: err?.message || "Tente novamente.",
                                    variant: "destructive",
                                  });
                                }
                              } else {
                                handleSelectItem(diet.id);
                              }
                            }}
                            className={`w-full p-3 rounded-lg border transition-all text-left ${isNewSelection
                                ? "border-brand bg-brand/10"
                                : isAlreadyInRoutine
                                  ? "border-green-500/40 bg-green-500/5"
                                  : "border-border/60 hover:border-border/80"
                              }`}
                          >
                            <div className="flex items-center gap-3">
                              <DietImage
                                photo={diet.photo}
                                name={diet.name}
                                category={diet.category}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-medium truncate">{diet.name}</span>
                                  <input
                                    type="checkbox"
                                    checked={isNewSelection}
                                    onChange={() => { }}
                                    className="h-4 w-4 flex-shrink-0"
                                  />
                                </div>
                                {diet.category && (
                                  <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground mt-1">
                                    {diet.category}
                                  </span>
                                )}
                                {isAlreadyInRoutine && !isNewSelection && (
                                  <span className="text-xs text-green-600 dark:text-green-400 font-medium block mt-1">
                                    ✓ Já adicionado
                                  </span>
                                )}
                                {diet.calories > 0 && (
                                  <p className="text-xs text-muted-foreground mt-1">{diet.calories} cal</p>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}

                    {selectedRoutineType === 3 &&
                      habits.filter((h) => h.name.toLowerCase().includes(searchQuery.toLowerCase())).map((habit) => {
                        const isAlreadyInRoutine = userHabits.some(
                          (uh) =>
                            uh.habit_id === habit.id &&
                            (addToRoutineCardName
                              ? uh.name === addToRoutineCardName
                              : !uh.name),
                        );
                        const isNewSelection = selectedItems.has(habit.id);
                        return (
                          <button
                            key={habit.id}
                            onClick={() => handleSelectItem(habit.id)}
                            className={`w-full p-3 rounded-lg border transition-all text-left ${isNewSelection
                                ? "border-brand bg-brand/10"
                                : isAlreadyInRoutine
                                  ? "border-green-500/40 bg-green-500/5"
                                  : "border-border/60 hover:border-border/80"
                              }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-sm font-medium truncate">{habit.name}</span>
                                {isAlreadyInRoutine && !isNewSelection && (
                                  <span className="text-xs text-green-600 dark:text-green-400 font-medium flex-shrink-0">
                                    ✓ Já adicionado
                                  </span>
                                )}
                              </div>
                              <input
                                type="checkbox"
                                checked={isNewSelection}
                                onChange={() => { }}
                                className="h-4 w-4 flex-shrink-0"
                              />
                            </div>
                            {habit.description && (
                              <p className="text-xs text-muted-foreground mt-1">{habit.description}</p>
                            )}
                          </button>
                        );
                      })}
                  </div>
                </div>

                {/* Save Button */}
                {selectedItems.size > 0 && (
                  <Button
                    onClick={handleSaveRoutines}
                    disabled={isAddingRoutine}
                    className="w-full rounded-full"
                  >
                    {isAddingRoutine
                      ? "Salvando..."
                      : `Salvar (${selectedItems.size})`}
                  </Button>
                )}
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Workout Modal */}
      <Drawer open={workoutModalOpen} onOpenChange={setWorkoutModalOpen}>
        <DrawerContent className="max-h-[90dvh] overflow-hidden flex flex-col modal-enter">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>Registrar Treino</DrawerTitle>
          </DrawerHeader>

          {/* Header and Stats */}
          {userWorkouts.length > 0 && (
            <div className="shrink-0 border-b border-border/40 px-4 py-4">
              <div className="flex items-center justify-between gap-4 mb-3">
                <button className="flex items-center gap-2">
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  <span className="text-base font-semibold">Treinamento</span>
                </button>
                <button
                  onClick={handleFinishWorkout}
                  className="p-2 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors"
                  title="Finalizar treino"
                  aria-label="Finalizar treino"
                >
                  <Pause className="h-5 w-5" />
                </button>
              </div>

              {/* Stats Row */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <p className="text-xs text-muted-foreground mb-0.5">Duração</p>
                  <p className="text-base font-bold text-brand">
                    {formatDuration(workoutDuration)}
                  </p>
                </div>
                <div className="flex flex-col">
                  <p className="text-xs text-muted-foreground mb-0.5">Volume</p>
                  <p className="text-base font-bold text-foreground">
                    {Math.round(
                      userWorkouts.reduce((total, workout) => {
                        const series = workoutSeries[workout.workout_id] || [];
                        return total + series.reduce((sum, s) => sum + (s.kg || 0), 0);
                      }, 0) * 10
                    ) / 10} kg
                  </p>
                </div>
                <div className="flex flex-col">
                  <p className="text-xs text-muted-foreground mb-0.5">Séries</p>
                  <p className="text-base font-bold text-foreground">
                    {userWorkouts.reduce((total, workout) => total + (workoutSeries[workout.workout_id] || []).filter((s) => s.completed).length, 0)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {Array.from(
                    new Set(
                      userWorkouts
                        .filter((w) => w.muscle_group)
                        .map((w) => w.muscle_group)
                    )
                  )
                    .slice(0, 3)
                    .map((muscleGroup) => {
                      const muscleIcons: Record<string, React.ReactNode> = {
                        "Peito": <span className="text-sm">🏋️</span>,
                        "Costas": <span className="text-sm">🔙</span>,
                        "Pernas": <span className="text-sm">🦵</span>,
                        "Ombros": <span className="text-sm">💪</span>,
                        "Braços": <span className="text-sm">💪</span>,
                        "Abdômen": <span className="text-sm">⚡</span>,
                        "Glúteos": <span className="text-sm">🍑</span>,
                      };
                      return (
                        <span key={muscleGroup} title={muscleGroup}>
                          {muscleIcons[muscleGroup] || <span className="text-sm">💪</span>}
                        </span>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {/* Exercises List - Scrollable */}
          {userWorkouts.length > 0 ? (
            <div className="flex-1 overflow-y-auto">
              {userWorkouts
                .filter((workout) => {
                  // If no routine selected, show all workouts
                  if (!selectedRoutineName) return true;
                  // If showing unnamed routines, show only workouts without a name
                  if (selectedRoutineName === "__unnamed__") {
                    return !workout.name;
                  }
                  // If routine selected, show only workouts with matching name
                  return workout.name === selectedRoutineName;
                })
                .map((workout) => {
                  const series = workoutSeries[workout.workout_id] || [];
                  return (
                    <div key={workout.id} className="px-4 py-3">
                      <div className="bg-card border border-brand/20 rounded-lg p-3 mb-3">
                        {/* Exercise Header */}
                        <button
                          onClick={() => handleOpenWorkoutHistory({
                            id: workout.workout_id,
                            name: workout.workoutName,
                            description: workout.workoutDescription || undefined,
                            photo: workout.workoutPhoto || undefined,
                          })}
                          className="flex items-center gap-3 mb-2 hover:opacity-80 transition-opacity w-full"
                        >
                          <h3 className="text-sm font-semibold text-brand">
                            {workout.workoutName}
                          </h3>
                          <MoreVertical className="h-4 w-4 text-muted-foreground ml-auto flex-shrink-0" />
                        </button>

                        {/* Notes */}
                        <div className="mb-2">
                          <input
                            type="text"
                            placeholder="Adicionar notas aqui..."
                            className="w-full text-xs text-muted-foreground bg-transparent border-0 placeholder:text-muted-foreground/60 focus:outline-none"
                          />
                        </div>

                        {/* Rest Time Selector */}
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="h-4 w-4 text-brand flex-shrink-0" />
                          <span className="text-xs font-medium text-brand">Descanso:</span>
                          <select
                            value={workoutExerciseRestTimes[workout.workout_id] || ""}
                            onChange={(e) =>
                              handleSetExerciseRestTime(workout.workout_id, parseInt(e.target.value))
                            }
                            className="text-xs font-medium text-foreground bg-background border border-brand/40 rounded px-2 py-1 focus:border-brand focus:outline-none cursor-pointer hover:border-brand/60 transition-colors"
                          >
                            <option value="">Desativado</option>
                            {REST_TIME_OPTIONS.map((time) => (
                              <option key={time} value={time}>
                                {time < 60 ? `${time}s` : `${Math.floor(time / 60)}m`}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Table Header */}
                        <div className="grid grid-cols-[40px_1fr_60px_60px_44px] gap-3 mb-1 py-1 text-xs font-semibold text-muted-foreground border-b border-border/20">
                          <div>SÉRIE</div>
                          <div>ANTERIOR</div>
                          <div className="text-center">KG</div>
                          <div className="text-center">REPS</div>
                          <div className="text-center">✓</div>
                        </div>

                        {/* Series Rows */}
                        <div className="space-y-0">
                          {series.map((s, index) => {
                            const previousRecord = workoutHistoriesMap[workout.workout_id]?.[index];
                            return (
                              <div
                                key={index}
                                className={`group relative grid grid-cols-[40px_1fr_60px_60px_32px_28px] gap-2 items-center py-1.5 rounded hover:bg-muted/20 transition-colors ${s.completed ? "opacity-50" : ""
                                  }`}
                              >
                                {/* Series Number */}
                                <div className="font-bold text-center text-xs">
                                  {index + 1}
                                </div>

                                {/* Previous Record */}
                                <div className="text-xs text-muted-foreground">
                                  {previousRecord
                                    ? `${Math.round((previousRecord.kilos || 0) * 10) / 10}kg × ${previousRecord.volume || 0}`
                                    : "—"}
                                </div>

                                {/* KG Input */}
                                <input
                                  type="number"
                                  step="0.5"
                                  value={s.kg === 0 ? "" : s.kg}
                                  onChange={(e) =>
                                    handleUpdateSerie(
                                      workout.workout_id,
                                      index,
                                      "kg",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="0"
                                  className="w-full h-7 px-1.5 border border-border/60 rounded text-xs font-semibold bg-background text-center focus:border-brand focus:outline-none"
                                />

                                {/* REPS Input */}
                                <input
                                  type="number"
                                  value={s.reps === 0 ? "" : s.reps}
                                  onChange={(e) =>
                                    handleUpdateSerie(
                                      workout.workout_id,
                                      index,
                                      "reps",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="0"
                                  className="w-full h-7 px-1.5 border border-border/60 rounded text-xs font-semibold bg-background text-center focus:border-brand focus:outline-none"
                                />

                                {/* Checkbox */}
                                <button
                                  onClick={() =>
                                    handleToggleSerieCompleted(
                                      workout.workout_id,
                                      index,
                                    )
                                  }
                                  className="h-6 w-6 rounded bg-muted/40 hover:bg-muted/60 flex items-center justify-center transition-colors mx-auto"
                                >
                                  {s.completed ? (
                                    <CheckCircle2 className="h-4 w-4 text-brand" />
                                  ) : (
                                    <Circle className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </button>

                                {/* Delete Serie */}
                                <button
                                  onClick={() => handleDeleteSerie(workout.workout_id, index)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 rounded-full bg-destructive/80 hover:bg-destructive flex items-center justify-center mx-auto"
                                  title="Deletar série"
                                  aria-label="Deletar série"
                                >
                                  <Trash2 className="h-3 w-3 text-white" />
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        {/* Add Series Button */}
                        <button
                          onClick={() => handleAddSerie(workout.workout_id)}
                          className="w-full mt-2 py-2 text-xs font-semibold text-white bg-brand hover:bg-brand/90 transition-colors rounded flex items-center justify-center gap-2"
                        >
                          <Plus className="h-3 w-3" />
                          Adicionar Série
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Nenhum exercício adicionado</p>
            </div>
          )}

          {/* Bottom Actions - Sticky */}
          <div className="mt-2 border-t border-border/40 pt-2">
            <button
              onClick={() => handleAddExerciseFromWorkout()}
              className="w-full py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border border-dashed border-border/40 rounded hover:border-border/60"
            >
              <Plus className="h-3 w-3 inline mr-1" />
              Adicionar Exercício
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Rest Timer Modal */}
      <Dialog open={restTimerModalOpen} onOpenChange={setRestTimerModalOpen}>
        <DialogContent className="w-full max-w-xs rounded-2xl">
          <DialogHeader className="text-center">
            <DialogTitle>Tempo de Descanso</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center gap-6 py-8">
            <div className="relative flex items-center justify-center w-48 h-48">
              <svg className="absolute w-full h-full" viewBox="0 0 200 200">
                <circle
                  cx="100"
                  cy="100"
                  r="90"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-border/60"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="90"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-brand"
                  strokeDasharray={`${(565 * (1 - restTimerRemaining / (workoutExerciseRestTimes[restTimerExerciseId || ""] || 0))) || 0} 565`}
                  strokeLinecap="round"
                  style={{ transform: "rotate(-90deg)", transformOrigin: "100px 100px" }}
                />
              </svg>
              <div className="absolute text-center">
                <p className="text-4xl font-bold text-brand">
                  {restTimerRemaining}
                </p>
                <p className="text-xs text-muted-foreground mt-1">segundos</p>
              </div>
            </div>

            <div className="flex gap-3 w-full">
              <Button
                onClick={() => {
                  setRestTimerModalOpen(false);
                  setRestTimerPaused(false);
                }}
                variant="outline"
                className="flex-1 rounded-full"
              >
                Pular
              </Button>
              <Button
                onClick={() => {
                  if (restTimerRemaining === 0) {
                    setRestTimerModalOpen(false);
                    setRestTimerPaused(false);
                  } else {
                    setRestTimerPaused(!restTimerPaused);
                  }
                }}
                className="flex-1 rounded-full"
              >
                {restTimerRemaining === 0 ? "Próxima" : (restTimerPaused ? "Retomar" : "Pausar")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Goal Drawer */}
      <Drawer open={editGoalModalOpen} onOpenChange={setEditGoalModalOpen}>
        <DrawerContent className="max-h-[90dvh] flex flex-col modal-enter">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>Editar Meta</DrawerTitle>
          </DrawerHeader>

          {editingGoal && (
            <div className="flex-1 overflow-y-auto px-4 pb-6">
              <div className="space-y-4">
                <div className="p-4 bg-muted/20 rounded-lg">
                  <p className="text-sm font-medium">{editingGoal.description}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Duração (dias)</label>
                  <input
                    type="number"
                    value={editGoalDuration === 0 ? "" : editGoalDuration}
                    onChange={(e) => setEditGoalDuration(e.target.value === "" ? 0 : parseInt(e.target.value) || 0)}
                    placeholder="Digite a duração"
                    className="w-full h-10 px-3 border border-border/60 rounded-lg text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Frequência (dias)</label>
                  <input
                    type="number"
                    value={editGoalQuantity === 0 ? "" : editGoalQuantity}
                    onChange={(e) => setEditGoalQuantity(e.target.value === "" ? 0 : parseInt(e.target.value) || 0)}
                    placeholder="Digite a quantidade"
                    className="w-full h-10 px-3 border border-border/60 rounded-lg text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Button
                    onClick={async () => {
                      if (!user || !editingGoal) return;
                      setIsUpdatingGoal(true);
                      try {
                        const currentActualProgress = editingGoal.days_completed ?? 0;
                        const newPerc = editGoalQuantity > 0
                          ? Math.min(100, Math.round((currentActualProgress / editGoalQuantity) * 100))
                          : 0;

                        await updateUserGoalDb(editingGoal.id, {
                          duration: editGoalDuration,
                          quantity: editGoalQuantity,
                          days_completed: currentActualProgress,
                          perc: newPerc,
                        });

                        // Re-fetch from DB to confirm changes were persisted
                        const freshUserGoals = await getUserGoalsDb();
                        setUserGoals(freshUserGoals);

                        toast({
                          title: "Meta atualizada!",
                          description: "Suas alterações foram salvas.",
                        });
                        setEditGoalModalOpen(false);
                      } catch (err: any) {
                        const errorMsg = err?.message || "Tente novamente.";
                        console.error("Error updating goal:", errorMsg);
                        toast({
                          title: "Erro ao atualizar meta",
                          description: errorMsg,
                          variant: "destructive",
                        });
                      } finally {
                        setIsUpdatingGoal(false);
                      }
                    }}
                    disabled={isUpdatingGoal || editGoalDuration === 0 || editGoalQuantity === 0}
                    className="w-full rounded-full"
                  >
                    {isUpdatingGoal ? "Atualizando..." : "Salvar Alterações"}
                  </Button>

                  <Button
                    onClick={async () => {
                      if (!editingGoal) return;
                      if (!confirm("Tem certeza que deseja desistir desta meta? Esta ação não pode ser desfeita.")) {
                        return;
                      }
                      setIsUpdatingGoal(true);
                      try {
                        await deleteUserGoalDb(editingGoal.id);

                        // Re-fetch goals from DB to ensure UI reflects the deletion
                        const updatedGoals = await getUserGoalsDb();
                        setUserGoals(updatedGoals);

                        // Remove from selected goals
                        setSelectedGoalIds(
                          selectedGoalIds.filter((id) => id !== editingGoal.id)
                        );

                        toast({
                          title: "Meta removida!",
                          description: "Você desistiu da meta.",
                        });
                        setEditGoalModalOpen(false);
                      } catch (err: any) {
                        toast({
                          title: "Erro ao remover meta",
                          description: err?.message || "Tente novamente.",
                          variant: "destructive",
                        });
                      } finally {
                        setIsUpdatingGoal(false);
                      }
                    }}
                    disabled={isUpdatingGoal}
                    variant="destructive"
                    className="w-full rounded-full"
                  >
                    {isUpdatingGoal ? "Removendo..." : "Desistir da Meta"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* Finish Workout Confirmation Drawer */}
      <Drawer open={finishWorkoutConfirmOpen} onOpenChange={setFinishWorkoutConfirmOpen}>
        <DrawerContent className="max-h-[90dvh] flex flex-col modal-enter">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>Confirmar Encerramento do Treino</DrawerTitle>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Tem certeza que deseja encerrar o treino? Todos os dados registrados serão salvos.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-full"
                  onClick={() => setFinishWorkoutConfirmOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 rounded-full bg-destructive hover:bg-destructive/90"
                  onClick={handleConfirmFinishWorkout}
                >
                  Encerrar Treino
                </Button>
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Workout Summary Screen */}
      {workoutSummaryOpen && workoutSummaryData && (() => {
        const mins = Math.floor(workoutSummaryData.duration / 60);
        const secs = workoutSummaryData.duration % 60;
        const durationStr = mins > 0 ? `${mins}m ${secs > 0 ? `${secs}s` : ""}`.trim() : `${secs}s`;
        const routineStr = workoutSummaryData.routineName
          ? `Treino de ${workoutSummaryData.routineName}`
          : "Treino concluído";

        const closeSummary = () => {
          setWorkoutSummaryOpen(false);
          setWorkoutSummaryData(null);
          setSelectedRoutineName(null);
          setWorkoutCoverFile(null);
          setWorkoutCoverPreview(null);
        };

        const handlePickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (!file.type.startsWith("image/")) {
            toast({ title: "Selecione uma imagem válida", variant: "destructive" });
            return;
          }
          if (file.size > 10 * 1024 * 1024) {
            toast({ title: "Imagem muito grande (máx 10MB)", variant: "destructive" });
            return;
          }
          setWorkoutCoverFile(file);
          const reader = new FileReader();
          reader.onloadend = () => setWorkoutCoverPreview(reader.result as string);
          reader.readAsDataURL(file);
        };

        const handleShare = async () => {
          if (!workoutSummaryData || !supabase || !user) return;
          setIsSharingWorkout(true);
          try {
            const exerciseList = workoutSummaryData.exerciseNames.length > 0
              ? `\n🏋️ ${workoutSummaryData.exerciseNames.join(" · ")}`
              : "";
            const volumeStr = workoutSummaryData.totalVolume > 0
              ? `\n📦 Volume: ${workoutSummaryData.totalVolume} kg`
              : "";
            const description = `💪 ${routineStr}!\n⏱️ ${durationStr}${volumeStr}\n✅ ${workoutSummaryData.totalSeries} séries${exerciseList}\n\n#Linka #Fitness #Treino`;

            let photoUrl: string | null = null;

            // If user picked a custom photo, upload it
            if (workoutCoverFile) {
              const ext = workoutCoverFile.name.split(".").pop() || "jpg";
              const filePath = `${user.id}/${Date.now()}-workout.${ext}`;
              const { error: uploadError } = await supabase.storage
                .from("posts")
                .upload(filePath, workoutCoverFile, { contentType: workoutCoverFile.type, upsert: false });
              if (uploadError) throw uploadError;
              const { data: urlData } = supabase.storage.from("posts").getPublicUrl(filePath);
              photoUrl = urlData.publicUrl;
            } else {
              // Generate cover image from canvas
              const canvas = workoutCanvasRef.current;
              if (canvas) {
                const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
                if (blob) {
                  const filePath = `${user.id}/${Date.now()}-workout-cover.png`;
                  const { error: uploadError } = await supabase.storage
                    .from("posts")
                    .upload(filePath, blob, { contentType: "image/png", upsert: false });
                  if (!uploadError) {
                    const { data: urlData } = supabase.storage.from("posts").getPublicUrl(filePath);
                    photoUrl = urlData.publicUrl;
                  }
                }
              }
            }

            await createPostDb(photoUrl, description);

            toast({ title: "Postado no feed! 🎉", description: "Seu treino foi compartilhado." });
            closeSummary();
          } catch (err: any) {
            toast({ title: "Erro ao compartilhar", description: err?.message || "Tente novamente.", variant: "destructive" });
          } finally {
            setIsSharingWorkout(false);
          }
        };

        return (
          <div className="fixed inset-0 z-[200] flex flex-col bg-background overflow-y-auto">
            {/* Hidden canvas for cover generation — drawn via useEffect below */}
            <canvas ref={workoutCanvasRef} width={800} height={800} className="hidden" />

            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-12 pb-4 flex-shrink-0">
              <button onClick={closeSummary} className="p-2 rounded-full hover:bg-muted transition-colors" aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
              <h1 className="text-base font-bold">Resumo do Treino</h1>
              <div className="w-9" />
            </div>

            {/* Cover image preview */}
            <div className="mx-4 mb-4 relative rounded-2xl overflow-hidden aspect-square bg-gradient-to-br from-slate-900 to-emerald-950 border border-brand/20 flex-shrink-0">
              {workoutCoverPreview ? (
                <img src={workoutCoverPreview} alt="Capa do treino" className="w-full h-full object-cover" />
              ) : (
                /* Generated cover preview (mirrors canvas) */
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-center select-none">
                  <div className="text-6xl">💪</div>
                  <p className="text-xl font-bold text-white">Treino Concluído!</p>
                  {workoutSummaryData.routineName && (
                    <p className="text-sm text-emerald-400">{workoutSummaryData.routineName}</p>
                  )}
                  <div className="w-full h-px bg-emerald-500/30 my-1" />
                  <div className="flex gap-6 text-center">
                    <div>
                      <p className="text-lg font-bold text-emerald-400">{durationStr}</p>
                      <p className="text-xs text-white/50">Duração</p>
                    </div>
                    {workoutSummaryData.totalVolume > 0 && (
                      <div>
                        <p className="text-lg font-bold text-emerald-400">{workoutSummaryData.totalVolume} kg</p>
                        <p className="text-xs text-white/50">Volume</p>
                      </div>
                    )}
                    <div>
                      <p className="text-lg font-bold text-emerald-400">{workoutSummaryData.totalSeries}</p>
                      <p className="text-xs text-white/50">Séries</p>
                    </div>
                  </div>
                  {workoutSummaryData.exerciseNames.length > 0 && (
                    <p className="text-xs text-white/60 mt-1">{workoutSummaryData.exerciseNames.slice(0, 3).join("  ·  ")}</p>
                  )}
                  <p className="text-xs text-emerald-400/60 mt-2 font-semibold">Linka</p>
                </div>
              )}

              {/* Change photo button overlay */}
              <label className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/60 hover:bg-black/80 text-white text-xs font-medium px-3 py-1.5 rounded-full cursor-pointer transition-colors">
                <Camera className="h-3.5 w-3.5" />
                {workoutCoverPreview ? "Trocar foto" : "Adicionar foto"}
                <input type="file" accept="image/*" className="hidden" onChange={handlePickPhoto} />
              </label>
            </div>

            {/* Stats row */}
            <div className="mx-4 grid grid-cols-3 gap-2 mb-4">
              <div className="flex flex-col items-center gap-1 rounded-xl bg-card border border-border/50 p-3">
                <Timer className="h-4 w-4 text-brand" />
                <p className="text-[11px] text-muted-foreground">Duração</p>
                <p className="text-sm font-bold">{durationStr}</p>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-xl bg-card border border-border/50 p-3">
                <TrendingUp className="h-4 w-4 text-brand" />
                <p className="text-[11px] text-muted-foreground">Volume</p>
                <p className="text-sm font-bold">{workoutSummaryData.totalVolume > 0 ? `${workoutSummaryData.totalVolume} kg` : "—"}</p>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-xl bg-card border border-border/50 p-3">
                <Flame className="h-4 w-4 text-brand" />
                <p className="text-[11px] text-muted-foreground">Séries</p>
                <p className="text-sm font-bold">{workoutSummaryData.totalSeries}</p>
              </div>
            </div>

            {/* Exercises */}
            {workoutSummaryData.exerciseNames.length > 0 && (
              <div className="mx-4 mb-4 rounded-xl bg-card border border-border/50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Dumbbell className="h-4 w-4 text-brand" />
                  <p className="text-sm font-semibold">Exercícios realizados</p>
                </div>
                <div className="space-y-1">
                  {workoutSummaryData.exerciseNames.map((name, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-3.5 w-3.5 text-brand flex-shrink-0" />
                      <span>{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mx-4 pb-10 space-y-3 mt-2">
              <Button className="w-full rounded-full gap-2 h-12 text-base" disabled={isSharingWorkout} onClick={handleShare}>
                {isSharingWorkout
                  ? "Compartilhando..."
                  : <><Share2 className="h-5 w-5" /> Compartilhar no Feed</>
                }
              </Button>
              <Button variant="ghost" className="w-full rounded-full h-12 text-base text-muted-foreground" onClick={closeSummary}>
                Fechar
              </Button>
            </div>
          </div>
        );
      })()}

      {/* Badges/Insignias Drawer Modal */}
      <Drawer open={badgesModalOpen} onOpenChange={setBadgesModalOpen}>
        <DrawerContent className="max-h-[90dvh] flex flex-col bg-gradient-to-b from-background via-background to-muted/30">
          <DrawerHeader className="shrink-0 border-b border-border/60">
            <DrawerTitle className="flex items-center gap-2">
              <span className="text-2xl">🏆</span>
              Insignias
            </DrawerTitle>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {/* Progress Overview */}
            <div className="mb-6 p-4 rounded-lg bg-brand/10 border border-brand/20">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-sm">Progresso Semanal</p>
                <p className="font-bold text-lg">{weekCheckIns.size}/7</p>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-brand transition-all duration-300 h-full rounded-full"
                  style={{ width: `${(weekCheckIns.size / 7) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {7 - weekCheckIns.size === 0
                  ? "Parabéns! Você completou a semana!"
                  : `Faltam ${7 - weekCheckIns.size} dia(s) para completar a semana`}
              </p>
            </div>

            <div className="space-y-3 pb-8">
              {/* 1 Day - Iniciante */}
              <div
                className={`group relative overflow-hidden rounded-xl transition-all duration-300 ${weekCheckIns.size >= 1
                    ? "bg-gradient-to-r from-yellow-500/20 to-yellow-500/5 border border-yellow-500/40 shadow-lg shadow-yellow-500/10"
                    : "bg-muted/40 border border-border/40 opacity-60"
                  }`}
              >
                <div className="p-4 flex items-start gap-4">
                  <div className={`text-4xl transition-transform ${weekCheckIns.size >= 1 ? "scale-110" : ""}`}>
                    ⭐
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm">Iniciante</p>
                      {weekCheckIns.size >= 1 && (
                        <Check className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Complete check-in 1 dia</p>
                    {weekCheckIns.size < 1 && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground mb-1">{weekCheckIns.size}/1 dias</p>
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-yellow-500 h-full transition-all"
                            style={{ width: `${(weekCheckIns.size / 1) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 3 Days - Sequência */}
              <div
                className={`group relative overflow-hidden rounded-xl transition-all duration-300 ${weekCheckIns.size >= 3
                    ? "bg-gradient-to-r from-blue-500/20 to-blue-500/5 border border-blue-500/40 shadow-lg shadow-blue-500/10"
                    : "bg-muted/40 border border-border/40 opacity-60"
                  }`}
              >
                <div className="p-4 flex items-start gap-4">
                  <div className={`text-4xl transition-transform ${weekCheckIns.size >= 3 ? "scale-110" : ""}`}>
                    🔥
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm">Sequência</p>
                      {weekCheckIns.size >= 3 && (
                        <Check className="h-5 w-5 text-blue-600 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Complete check-in 3 dias</p>
                    {weekCheckIns.size < 3 && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground mb-1">{Math.min(weekCheckIns.size, 3)}/3 dias</p>
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-blue-500 h-full transition-all"
                            style={{ width: `${(Math.min(weekCheckIns.size, 3) / 3) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 5 Days - Campeão */}
              <div
                className={`group relative overflow-hidden rounded-xl transition-all duration-300 ${weekCheckIns.size >= 5
                    ? "bg-gradient-to-r from-green-500/20 to-green-500/5 border border-green-500/40 shadow-lg shadow-green-500/10"
                    : "bg-muted/40 border border-border/40 opacity-60"
                  }`}
              >
                <div className="p-4 flex items-start gap-4">
                  <div className={`text-4xl transition-transform ${weekCheckIns.size >= 5 ? "scale-110" : ""}`}>
                    💪
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm">Campeão</p>
                      {weekCheckIns.size >= 5 && (
                        <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Complete check-in 5 dias</p>
                    {weekCheckIns.size < 5 && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground mb-1">{Math.min(weekCheckIns.size, 5)}/5 dias</p>
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-green-500 h-full transition-all"
                            style={{ width: `${(Math.min(weekCheckIns.size, 5) / 5) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 7 Days - Lendário */}
              <div
                className={`group relative overflow-hidden rounded-xl transition-all duration-300 ${weekCheckIns.size === 7
                    ? "bg-gradient-to-r from-purple-500/20 to-purple-500/5 border border-purple-500/40 shadow-lg shadow-purple-500/10"
                    : "bg-muted/40 border border-border/40 opacity-60"
                  }`}
              >
                <div className="p-4 flex items-start gap-4">
                  <div className={`text-4xl transition-transform ${weekCheckIns.size === 7 ? "scale-110 animate-pulse" : ""}`}>
                    👑
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm">Lendário</p>
                      {weekCheckIns.size === 7 && (
                        <Check className="h-5 w-5 text-purple-600 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Complete check-in 7 dias (semana completa)</p>
                    {weekCheckIns.size < 7 && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground mb-1">{weekCheckIns.size}/7 dias</p>
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-purple-500 h-full transition-all"
                            style={{ width: `${(weekCheckIns.size / 7) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border/60 p-4 bg-background/95 sticky bottom-0">
            <p className="text-xs text-muted-foreground text-center">
              Complete check-ins diários para ganhar insignias e desbloquear novos níveis!
            </p>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Workout History Drawer */}
      <Drawer open={workoutHistoryModalOpen} onOpenChange={setWorkoutHistoryModalOpen}>
        <DrawerContent className="max-h-[90dvh] flex flex-col modal-enter">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>
              Histórico de {selectedWorkoutForHistory?.name || "Exercício"}
            </DrawerTitle>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-6">
            {isLoadingHistory ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Carregando histórico...
              </div>
            ) : workoutHistory.length > 0 ? (
              (() => {
                // Group records by day
                const groupedByDay: Record<string, typeof workoutHistory> = {};
                workoutHistory.forEach((record) => {
                  const date = new Date(record.dateCompleted);
                  const dateKey = date.toLocaleDateString("pt-BR");
                  if (!groupedByDay[dateKey]) {
                    groupedByDay[dateKey] = [];
                  }
                  groupedByDay[dateKey].push(record);
                });

                // Sort days in descending order (newest first)
                const sortedDates = Object.keys(groupedByDay).sort((a, b) => {
                  const dateA = new Date(a.split("/").reverse().join("-"));
                  const dateB = new Date(b.split("/").reverse().join("-"));
                  return dateB.getTime() - dateA.getTime();
                });

                return sortedDates.map((dateKey) => {
                  const dayRecords = groupedByDay[dateKey];
                  const totalKilos = dayRecords
                    .reduce((sum, r) => sum + (r.kilos || 0), 0);
                  const totalReps = dayRecords.length;

                  return (
                    <div key={dateKey} className="mb-6">
                      {/* Date Header */}
                      <div className="sticky top-0 bg-background/95 py-2 mb-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase">
                          {dateKey}
                        </p>
                        <div className="flex gap-4 mt-1">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              {totalReps} série(s)
                            </p>
                          </div>
                          {totalKilos > 0 && (
                            <div>
                              <p className="text-xs text-muted-foreground">
                                {totalKilos} kg total
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Records for this day */}
                      <div className="space-y-1">
                        {dayRecords.map((record) => {
                          const time = new Date(record.dateCompleted).toLocaleTimeString(
                            "pt-BR",
                            { hour: "2-digit", minute: "2-digit" }
                          );
                          return (
                            <div
                              key={record.id}
                              className="flex items-center justify-between p-2 rounded hover:bg-muted/40 transition-colors"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground w-10">
                                  {time}
                                </p>
                                <div className="flex gap-2 flex-1 min-w-0 overflow-x-auto">
                                  {record.kilos && (
                                    <span className="text-xs font-medium px-2 py-1 bg-muted/50 rounded whitespace-nowrap">
                                      {record.kilos} kg
                                    </span>
                                  )}
                                  {record.volume && (
                                    <span className="text-xs font-medium px-2 py-1 bg-muted/50 rounded whitespace-nowrap">
                                      {record.volume}
                                    </span>
                                  )}
                                  {record.calories && (
                                    <span className="text-xs font-medium px-2 py-1 bg-muted/50 rounded whitespace-nowrap">
                                      {record.calories} cal
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Nenhum registro de treino encontrado
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Goal Selection Modal for Check-in */}
      <Drawer open={checkInGoalSelectionOpen} onOpenChange={setCheckInGoalSelectionOpen}>
        <DrawerContent className="max-h-[90dvh] flex flex-col modal-enter">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>Selecione uma Meta para o Check-in</DrawerTitle>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
            {userGoals
              .filter((g) => g.perc < 100)
              .map((goal) => (
                <button
                  key={goal.id}
                  onClick={() => {
                    setSelectedCheckInGoal(goal);
                    handleConfirmCheckInGoal();
                  }}
                  className={`w-full p-4 rounded-lg border-2 transition-all text-left space-y-3 ${selectedCheckInGoal?.id === goal.id
                      ? "border-brand bg-brand/10"
                      : "border-border/60 hover:border-border/80 hover:bg-muted/30"
                    }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-semibold text-sm line-clamp-2">{goal.description}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold text-brand">
                        {Math.round(goal.perc)}%
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Progress value={goal.perc} className="h-2" />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {goal.days_completed} de {goal.quantity}
                      </span>
                      <span className="font-medium text-foreground">
                        {goal.quantity - goal.days_completed} para concluir
                      </span>
                    </div>
                  </div>
                </button>
              ))}

            {userGoals.filter((g) => g.perc < 100).length === 0 && (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Todas as metas foram completadas!
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Routine Selection Modal for Goal Cards */}
      <Drawer open={goalRoutineModalOpen} onOpenChange={setGoalRoutineModalOpen}>
        <DrawerContent className="max-h-[90dvh] flex flex-col modal-enter">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>
              {goalRoutineModalMode === "view"
                ? `Rotinas Vinculadas — "${selectedGoalForRoutines?.description}"`
                : `Vincular Rotinas — "${selectedGoalForRoutines?.description}"`}
            </DrawerTitle>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3 pt-4">
            {(() => {
              const TYPES = [
                { code: 1, label: "Exercícios", emoji: "🏋️" },
                { code: 2, label: "Dietas", emoji: "🥗" },
                { code: 3, label: "Hábitos", emoji: "✅" },
              ];

              const goalId = selectedGoalForRoutines
                ? String(selectedGoalForRoutines.id)
                : null;

              const displayRoutines =
                goalRoutineModalMode === "view"
                  ? routines.filter(
                    (r) => r.goal_id && goalId && String(r.goal_id) === goalId,
                  )
                  : routines;

              if (displayRoutines.length === 0) {
                return (
                  <div className="text-center py-10 text-sm text-muted-foreground">
                    {goalRoutineModalMode === "view"
                      ? "Nenhuma rotina vinculada a esta meta."
                      : "Nenhuma rotina disponível para vincular."}
                  </div>
                );
              }

              return TYPES.map(({ code, label, emoji }) => {
                const typeRoutines = displayRoutines.filter((r) => r.type === code);
                if (typeRoutines.length === 0) return null;

                // Group routines by name — deduplicate, show one row per unique name
                const nameGroupMap = typeRoutines.reduce(
                  (acc, r) => {
                    const key = r.name || label;
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(r);
                    return acc;
                  },
                  {} as Record<string, typeof typeRoutines>,
                );
                const nameGroups = Object.entries(nameGroupMap);

                const isTypeOpen = openRoutineTypes.has(code);

                return (
                  <div key={code} className="rounded-xl border border-border/60 overflow-hidden">
                    {/* Type Header (dropdown trigger) */}
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        const next = new Set(openRoutineTypes);
                        if (next.has(code)) next.delete(code);
                        else next.add(code);
                        setOpenRoutineTypes(next);
                      }}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <span>{emoji}</span>
                        {label}
                        <span className="text-xs font-normal text-muted-foreground">
                          ({nameGroups.length})
                        </span>
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform ${isTypeOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    {/* Grouped routines list */}
                    {isTypeOpen && (
                      <div className="divide-y divide-border/40">
                        {nameGroups.map(([groupName, groupRoutines]) => {
                          const groupKey = `${code}::${groupName}`;
                          const groupIds = groupRoutines.map((r) => r.id);
                          const isGroupOpen = openRoutineItems.has(groupKey);
                          const isSelected = groupIds.some((id) =>
                            goalRoutineSelection.has(id),
                          );

                          // Sub-items from related table filtered by group name
                          const subItems =
                            code === 1
                              ? userWorkouts.filter(
                                (w) => w.name && w.name === groupName,
                              )
                              : code === 2
                                ? userDiets.filter(
                                  (d) => d.name && d.name === groupName,
                                )
                                : userHabits.filter(
                                  (h) => h.name && h.name === groupName,
                                );

                          return (
                            <div key={groupKey}>
                              {/* Group row */}
                              <div className="flex items-center px-4 py-3 gap-3">
                                {goalRoutineModalMode === "link" && (
                                  <button
                                    onClick={() => {
                                      const next = new Set(goalRoutineSelection);
                                      if (isSelected) {
                                        groupIds.forEach((id) => next.delete(id));
                                      } else {
                                        groupIds.forEach((id) => next.add(id));
                                      }
                                      setGoalRoutineSelection(next);
                                    }}
                                    className={`shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${isSelected
                                        ? "border-brand bg-brand"
                                        : "border-border"
                                      }`}
                                  >
                                    {isSelected && (
                                      <Check className="h-3 w-3 text-white" />
                                    )}
                                  </button>
                                )}
                                <button
                                  className="flex-1 flex items-center justify-between text-left"
                                  onClick={() => {
                                    const next = new Set(openRoutineItems);
                                    if (next.has(groupKey)) next.delete(groupKey);
                                    else next.add(groupKey);
                                    setOpenRoutineItems(next);
                                  }}
                                >
                                  <div>
                                    <p className="text-sm font-medium">{groupName}</p>
                                    {subItems.length > 0 && (
                                      <p className="text-xs text-muted-foreground">
                                        {subItems.length} item(s)
                                      </p>
                                    )}
                                  </div>
                                  {subItems.length > 0 && (
                                    <ChevronDown
                                      className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${isGroupOpen ? "rotate-180" : ""}`}
                                    />
                                  )}
                                </button>
                                {goalRoutineModalMode === "view" && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        for (const id of groupIds) {
                                          await updateRoutineGoalDb(id, null);
                                        }
                                        setRoutines((prev) =>
                                          prev.map((r) =>
                                            groupIds.includes(r.id)
                                              ? { ...r, goal_id: null }
                                              : r,
                                          ),
                                        );
                                        toast({
                                          title: "Rotina desvinculada",
                                          description: `"${groupName}" foi desvinculada da meta.`,
                                        });
                                      } catch {
                                        toast({
                                          title: "Erro ao desvincular rotina",
                                          variant: "destructive",
                                        });
                                      }
                                    }}
                                    className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                    title="Desvincular rotina"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>

                              {/* Sub-items dropdown */}
                              {isGroupOpen && subItems.length > 0 && (
                                <div className="bg-muted/20 border-t border-border/40 px-4 py-2 space-y-1">
                                  {subItems.map((item) => {
                                    const itemName =
                                      code === 1
                                        ? (item as typeof userWorkouts[0]).workoutName
                                        : code === 2
                                          ? (item as typeof userDiets[0]).dietName
                                          : (item as typeof userHabits[0]).habitName;
                                    return (
                                      <div
                                        key={item.id}
                                        className="flex items-center gap-2 py-1.5 text-sm text-muted-foreground"
                                      >
                                        <span className="h-1.5 w-1.5 rounded-full bg-brand shrink-0" />
                                        {itemName}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              });
            })()}

            {/* Link mode: "Vincular" button + option to switch to link mode from view */}
            {goalRoutineModalMode === "view" && (
              <Button
                variant="outline"
                className="w-full rounded-full mt-2"
                onClick={() => {
                  setGoalRoutineModalMode("link");
                  setGoalRoutineSelection(new Set());
                  setOpenRoutineTypes(new Set());
                  setOpenRoutineItems(new Set());
                }}
              >
                + Vincular mais rotinas
              </Button>
            )}

            {goalRoutineModalMode === "link" && goalRoutineSelection.size > 0 && (() => {
              // Count unique group names selected (not individual IDs)
              const selectedNames = new Set(
                routines
                  .filter((r) => goalRoutineSelection.has(r.id))
                  .map((r) => `${r.type}::${r.name || getRoutineTypeName(r.type)}`),
              );
              const groupCount = selectedNames.size;
              return (
                <Button
                  className="w-full rounded-full mt-2"
                  onClick={async () => {
                    try {
                      if (selectedGoalForRoutines && user) {
                        const goalId = String(selectedGoalForRoutines.id);
                        for (const routineId of Array.from(goalRoutineSelection)) {
                          await updateRoutineGoalDb(routineId, goalId);
                        }
                        setRoutines((prev) =>
                          prev.map((r) =>
                            goalRoutineSelection.has(r.id) ? { ...r, goal_id: goalId } : r,
                          ),
                        );
                      }
                      toast({
                        title: "Rotinas Vinculadas!",
                        description: `${goalRoutineSelection.size} rotina(s) vinculada(s) com sucesso.`,
                      });
                      setGoalRoutineModalOpen(false);
                      setGoalRoutineSelection(new Set());
                      setSelectedGoalForRoutines(null);
                      setGoalRoutineMuscleGroups(new Set());
                      setOpenRoutineTypes(new Set());
                      setOpenRoutineItems(new Set());
                    } catch (err) {
                      toast({
                        title: "Erro ao vincular rotinas",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  Confirmar Seleção ({groupCount} rotina{groupCount !== 1 ? "s" : ""})
                </Button>
              );
            })()}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Create Custom Workout Drawer */}
      <Drawer open={createWorkoutDrawerOpen} onOpenChange={setCreateWorkoutDrawerOpen}>
        <DrawerContent className="max-h-[90dvh] flex flex-col modal-enter">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>Criar Exercício Personalizado</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Exercício *</Label>
                <Input
                  placeholder="Ex: Agachamento livre"
                  value={newWorkoutName}
                  onChange={(e) => setNewWorkoutName(e.target.value)}
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <Label>Grupo Muscular</Label>
                <select
                  value={newWorkoutMuscleGroup}
                  onChange={(e) => setNewWorkoutMuscleGroup(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-foreground text-sm"
                >
                  <option value="">Selecione um grupo muscular</option>
                  {uniqueMuscleGroups.map((group) => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  placeholder="Como executar o exercício..."
                  value={newWorkoutDescription}
                  onChange={(e) => setNewWorkoutDescription(e.target.value)}
                  maxLength={200}
                />
              </div>

              <Button
                onClick={handleCreateCustomWorkout}
                disabled={isCreatingWorkout || !newWorkoutName.trim()}
                className="w-full rounded-full"
              >
                {isCreatingWorkout ? "Criando..." : "Criar e Adicionar Exercício"}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Create Custom Goal Drawer */}
      <Drawer open={createGoalDrawerOpen} onOpenChange={setCreateGoalDrawerOpen}>
        <DrawerContent className="max-h-[90dvh] flex flex-col modal-enter">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>Criar Meta Personalizada</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Descrição *</Label>
                <Input
                  placeholder="Ex: Correr 5km por dia"
                  value={newGoalDescription}
                  onChange={(e) => setNewGoalDescription(e.target.value)}
                  maxLength={120}
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 1, label: "Fitness", color: "bg-blue-500/10 text-blue-600 border-blue-300" },
                    { value: 2, label: "Saúde", color: "bg-emerald-500/10 text-emerald-600 border-emerald-300" },
                    { value: 3, label: "Hábitos", color: "bg-orange-500/10 text-orange-600 border-orange-300" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setNewGoalType(opt.value)}
                      className={`rounded-lg border-2 px-3 py-2 text-xs font-semibold transition-all ${
                        newGoalType === opt.value
                          ? opt.color + " border-current"
                          : "border-border/60 text-muted-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Duração (dias)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={newGoalDuration}
                    onChange={(e) => setNewGoalDuration(Math.max(1, Number(e.target.value)))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Frequência (qtd)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={9999}
                    value={newGoalQuantity}
                    onChange={(e) => setNewGoalQuantity(Math.max(1, Number(e.target.value)))}
                  />
                </div>
              </div>

              <Button
                onClick={handleCreateCustomGoal}
                disabled={isCreatingGoal || !newGoalDescription.trim()}
                className="w-full rounded-full"
              >
                {isCreatingGoal ? "Criando..." : "Criar e Selecionar Meta"}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Goal Completion Celebration Modal */}
      {celebrationGoal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 space-y-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            {/* Confetti emoji header */}
            <div className="text-center space-y-2">
              <div className="text-5xl animate-bounce">🏆</div>
              <h2 className="text-xl font-bold">Meta concluída!</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Você completou a meta{" "}
                <span className="font-semibold text-foreground">
                  "{celebrationGoal.description}"
                </span>
                . Incrível conquista!
              </p>
            </div>

            {/* Progress bar at 100% */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{celebrationGoal.quantity} de {celebrationGoal.quantity} dias</span>
                <span className="font-bold text-brand">100%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div className="bg-brand h-full rounded-full w-full transition-all duration-700" />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <Button
                className="w-full rounded-full gap-2"
                onClick={() => {
                  const text = `🏆 Completei minha meta no Linka: "${celebrationGoal.description}"! ${celebrationGoal.quantity} dias de dedicação. Baixe o app e junte-se a mim! 💪`;
                  if (navigator.share) {
                    navigator.share({ text }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(text).then(() => {
                      toast({ title: "Copiado!", description: "Texto da conquista copiado para a área de transferência." });
                    }).catch(() => {});
                  }
                  setCelebrationGoal(null);
                }}
              >
                🎉 Compartilhar conquista
              </Button>
              <Button
                variant="ghost"
                className="w-full rounded-full text-muted-foreground"
                onClick={() => setCelebrationGoal(null)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
