import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  getProgrammedGoalsDb,
  createUserGoalDb,
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
  saveWorkoutHistoryDb,
  getWorkoutHistoryDb,
  toggleUserDietCompletionDb,
  toggleUserHabitCompletionDb,
  saveDietHistoryDb,
  saveHabitHistoryDb,
  updateRoutineGoalDb,
  hasCompletedRoutineToday,
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

export default function Goals() {
  const navigate = useNavigate();
  const { user } = useAuth();

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
  const [routineName, setRoutineName] = React.useState("");

  // Base data for lookups
  const [workouts, setWorkouts] = React.useState<Workout[]>([]);
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

  // Available goals accordion state
  const [availableGoalsOpen, setAvailableGoalsOpen] = React.useState(false);

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
  const [selectedGoalForRoutines, setSelectedGoalForRoutines] = React.useState<any>(null);
  const [goalRoutineSelection, setGoalRoutineSelection] = React.useState<Set<string>>(new Set());
  const [routineSearchQuery, setRoutineSearchQuery] = React.useState("");
  const [goalRoutineMuscleGroups, setGoalRoutineMuscleGroups] = React.useState<
    Set<string>
  >(new Set());

  // Completion tracking for Rotinas tab items
  const [completedDietIds, setCompletedDietIds] = React.useState<Set<string>>(new Set());
  const [completedHabitIds, setCompletedHabitIds] = React.useState<Set<string>>(new Set());

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

  // Load all data on mount
  React.useEffect(() => {
    (async () => {
      try {
        const [
          goalsData,
          selectedIds,
          workoutsBaseData,
          dietsBaseData,
          habitsBaseData,
        ] = await Promise.all([
          getProgrammedGoalsDb(),
          getUserSelectedGoalIdsDb(),
          getWorkoutsDb(),
          getDietsDb(),
          getHabitsDb(),
        ]);
        setGoals(goalsData);
        setSelectedGoalIds(selectedIds);
        setWorkouts(workoutsBaseData);
        setDiets(dietsBaseData);
        setHabits(habitsBaseData);

        // Load routines and linked items if user is logged in
        if (user) {
          const [
            routinesData,
            userWorkoutsData,
            userDietsData,
            userHabitsData,
            userGoalsData,
          ] = await Promise.all([
            getUserRoutinesDb(user.id),
            getUserWorkoutsDb(user.id),
            getUserDietsDb(user.id),
            getUserHabitsDb(user.id),
            getUserGoalsDb(user.id),
          ]);
          setRoutines(routinesData);
          setUserWorkouts(userWorkoutsData);
          setUserDiets(userDietsData);
          setUserHabits(userHabitsData);
          setUserGoals(userGoalsData);

          }
      } catch (err: any) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Erro ao carregar dados:", errorMessage);
        toast({
          title: "Erro ao carregar dados",
          description: errorMessage || "Tente novamente.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // Load today's check-in status and week check-ins from database
  React.useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        // Check if user has already done check-in today
        const todayCheckIn = await getTodayCheckInDb(user.id);
        setDailyCheckInDone(todayCheckIn !== null);

        // Load week check-ins
        const weekCheckInDays = await getWeekCheckInsDb(user.id);
        setWeekCheckIns(new Set(weekCheckInDays));

        // Check if user has completed any routine today
        const hasCompleted = await hasCompletedRoutineToday(user.id);
        setRoutineCompletedTodayStatus(hasCompleted);
      } catch (err) {
        console.error("Error loading check-in data:", err);
        // Gracefully fallback to empty state
        setDailyCheckInDone(false);
        setWeekCheckIns(new Set());
        setRoutineCompletedTodayStatus(false);
      }
    })();
  }, [user]);

  // Reload completed routine status when routines change
  React.useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        const hasCompleted = await hasCompletedRoutineToday(user.id);
        setRoutineCompletedTodayStatus(hasCompleted);
      } catch (err) {
        console.error("Error checking routine completion:", err);
        setRoutineCompletedTodayStatus(false);
      }
    })();
  }, [user, userWorkouts, userDiets, userHabits]);

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

      // Load workout histories for all exercises
      if (user) {
        (async () => {
          const historiesMap: Record<string, WorkoutHistoryRecord[]> = {};
          for (const workout of userWorkouts) {
            try {
              const history = await getWorkoutHistoryDb(user.id, workout.workout_id);
              historiesMap[workout.workout_id] = history;
            } catch (err) {
              historiesMap[workout.workout_id] = [];
            }
          }
          setWorkoutHistoriesMap(historiesMap);
        })();
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

  const handleAddRoutineClick = () => {
    setAddRoutineModalOpen(true);
    setSelectedRoutineType(null);
    setSelectedItems(new Set());
    setSearchQuery("");
    setSelectedMuscleGroups(new Set());
  };

  const handleAddExerciseFromWorkout = () => {
    // When called from workout modal, automatically select exercises type and pre-check existing items
    setAddRoutineModalOpen(true);
    setSelectedRoutineType(1); // 1 = Exercises
    const existingWorkoutIds = new Set(userWorkouts.map((w) => w.workout_id));
    setSelectedItems(existingWorkoutIds);
    setSearchQuery("");
    setSelectedMuscleGroups(new Set());
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

  const handleDeleteRoutineType = async (typeCode: number) => {
    try {
      if (!user) return;

      // Delete routines of this type from the routines table
      await deleteRoutinesOfTypeDb(user.id, typeCode as RoutineTypeCode);

      // Also delete from the corresponding user_* table
      let table = "";
      if (typeCode === 1) table = "user_workouts";
      else if (typeCode === 2) table = "user_diets";
      else if (typeCode === 3) table = "user_habits";

      if (table) {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq("user_id", user.id);

        if (error) throw error;
      }

      // Update local state
      if (typeCode === 1) setUserWorkouts([]);
      else if (typeCode === 2) setUserDiets([]);
      else if (typeCode === 3) setUserHabits([]);

      // Update routines list
      setRoutines((prev) => prev.filter((r) => r.type !== typeCode));

      toast({
        title: "Rotina removida",
        description: "Todos os itens foram removidos.",
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
        const newProgress = goal.actual_progress + 1;
        const newPercentage = Math.min(100, (newProgress / goal.quantity) * 100);

        await updateUserGoalDb(goal.id, {
          actual_progress: newProgress,
          perc: newPercentage,
        });

        // Refresh user goals
        const updatedGoals = await getUserGoalsDb(user.id);
        setUserGoals(updatedGoals);

        toast({
          title: "Check-in realizado!",
          description: `Parabéns! Você completou seu check-in de hoje e atualizou a meta "${goal.nameGoal}".`,
        });
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
      const newProgress = selectedCheckInGoal.actual_progress + 1;
      const newPercentage = Math.min(100, (newProgress / selectedCheckInGoal.quantity) * 100);

      await updateUserGoalDb(selectedCheckInGoal.id, {
        actual_progress: newProgress,
        perc: newPercentage,
      });

      // Refresh user goals
      const updatedGoals = await getUserGoalsDb(user.id);
      setUserGoals(updatedGoals);

      toast({
        title: "Check-in realizado!",
        description: `Parabéns! Você completou seu check-in de hoje e atualizou a meta "${selectedCheckInGoal.nameGoal}".`,
      });
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

  // Get unique muscle groups from workouts
  const uniqueMuscleGroups = React.useMemo(() => {
    const groups = new Set<string>();
    workouts.forEach((workout: any) => {
      if (workout.muscle_group) {
        groups.add(workout.muscle_group);
      }
    });
    return Array.from(groups).sort();
  }, [workouts]);

  // Filter workouts based on search and muscle groups
  const filteredWorkouts = React.useMemo(() => {
    return workouts.filter((workout: any) => {
      const matchesSearch = workout.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesMuscleGroup =
        selectedMuscleGroups.size === 0 ||
        selectedMuscleGroups.has(workout.muscle_group);
      return matchesSearch && matchesMuscleGroup;
    });
  }, [workouts, searchQuery, selectedMuscleGroups]);

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
          time_rest: 30,
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

      const minutes = Math.floor(workoutDuration / 60);
      const seconds = workoutDuration % 60;
      const durationText =
        minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

      toast({
        title: "Treino finalizado!",
        description: `Treino de ${durationText} registrado com sucesso.`,
      });

      // Reset and close
      setWorkoutModalOpen(false);
      setSelectedRoutineName(null);
      setWorkoutSeries({});
      setCurrentWorkoutIndex(0);
      setWorkoutDuration(0);
      setWorkoutStartTime(null);
      setFinishWorkoutConfirmOpen(false);

      // Refresh workout list to show updated data
      const [routinesData, userWorkoutsData, userDietsData, userHabitsData] =
        await Promise.all([
          getUserRoutinesDb(user.id),
          getUserWorkoutsDb(user.id),
          getUserDietsDb(user.id),
          getUserHabitsDb(user.id),
        ]);

      setRoutines(routinesData);
      setUserWorkouts(userWorkoutsData);
      setUserDiets(userDietsData);
      setUserHabits(userHabitsData);
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

      // Create a routine record if a name is provided
      if (routineName.trim()) {
        await createRoutineDb(user.id, selectedRoutineType, routineName.trim());
      }

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
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Metas e Rotinas
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie suas metas e rotinas.
          </p>
        </div>

        {/* Badges Icon */}
        <Button
          onClick={() => setBadgesModalOpen(true)}
          variant="outline"
          size="icon"
          className="rounded-full"
          title="Ver insignias"
        >
          <span className="text-lg">🏆</span>
        </Button>
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
                                  return (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="flex-1 rounded-full text-xs h-8"
                                      onClick={() => {
                                        setGoalRoutineModalOpen(true);
                                        setSelectedGoalForRoutines(goal);
                                        setGoalRoutineSelection(new Set());
                                      }}
                                    >
                                      {linkedRoutines.length > 0
                                        ? `Ver Rotinas (${linkedRoutines.length})`
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
                                      user_id: user?.id || "",
                                      description: goal.description,
                                      duration: duration,
                                      quantity: quantity,
                                      type: goal.type,
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
            </>
          ) : (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhuma meta disponível no momento.
              </p>
            </div>
          )}
        </TabsContent>

        {/* Rotinas Tab */}
        <TabsContent value="rotinas" className="space-y-4 fade-in">
          {/* Daily Check-in Block */}
          <Card className={`border-2 ${
            dailyCheckInDone
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

                {/* Days of Week */}
                <div className="flex justify-center gap-2">
                  {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"].map((day, index) => (
                    <div
                      key={index}
                      className={`flex flex-col items-center justify-center w-10 h-10 rounded-lg transition-all ${
                        weekCheckIns.has(index)
                          ? "bg-brand text-white font-bold"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <span className="text-xs font-medium">{day}</span>
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

          {routines.length > 0 ? (
            <div className="space-y-4">
              {/* Render named routines first, then group unnamed by type */}
              {(() => {
                const cards: any[] = [];

                // First, render routines with names
                const namedRoutines = routines.filter((r) => r.name);
                namedRoutines.forEach((routine) => {
                  const typeCode = routine.type;
                  const itemsForType =
                    typeCode === 1
                      ? userWorkouts
                      : typeCode === 2
                        ? userDiets
                        : userHabits;

                  const itemsForRoutine = itemsForType.filter(
                    (item: any) => item.name === routine.name
                  );

                  if (itemsForRoutine.length > 0) {
                    cards.push({
                      key: `routine-${routine.id}`,
                      typeCode,
                      displayLabel: routine.name,
                      itemsForRoutine,
                      isNamed: true,
                    });
                  }
                });

                // Then, render unnamed routines grouped by type
                [1, 2, 3].forEach((typeCode) => {
                  const unnamedRoutinesOfType = routines.filter(
                    (r) => r.type === typeCode && !r.name
                  );
                  if (unnamedRoutinesOfType.length === 0) return;

                  const typeLabel =
                    typeCode === 1
                      ? "Exercícios"
                      : typeCode === 2
                        ? "Dietas"
                        : "Hábitos";

                  const itemsForType =
                    typeCode === 1
                      ? userWorkouts
                      : typeCode === 2
                        ? userDiets
                        : userHabits;

                  const itemsForRoutine = itemsForType.filter(
                    (item: any) => !item.name
                  );

                  if (itemsForRoutine.length > 0) {
                    cards.push({
                      key: `type-${typeCode}`,
                      typeCode,
                      displayLabel: typeLabel,
                      itemsForRoutine,
                      isNamed: false,
                    });
                  }
                });

                return cards.map((card) => {
                  const { key, typeCode, displayLabel, itemsForRoutine, isNamed } = card;
                  const isExpanded = expandedRoutineId === key;

                  return (
                    <Card
                      key={key}
                      className="border-border/60 overflow-hidden"
                    >
                      <div className="w-full p-3 flex items-center justify-between hover:bg-muted/30 transition-colors text-left">
                        <button
                          onClick={() =>
                            setExpandedRoutineId(
                              isExpanded ? null : key,
                            )
                          }
                        className="flex-1 flex items-center justify-between"
                      >
                          <div className="flex flex-col justify-center items-center flex-1">
                            <p className="text-sm font-medium">{displayLabel}</p>
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
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              onClick={() => {
                                setAddRoutineModalOpen(true);
                                setSelectedRoutineType(1); // 1 = Exercises
                                setSelectedItems(new Set());
                                setSearchQuery("");
                                setSelectedMuscleGroups(new Set());
                              }}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Adicionar exercícios
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteRoutineType(typeCode)}
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
                                        }
                                        toast({
                                          title: isCompleting ? "Dieta concluída!" : "Dieta desmarcada",
                                        });
                                      } catch (err) {
                                        toast({
                                          title: "Erro ao atualizar status da dieta",
                                          variant: "destructive",
                                        });
                                      }
                                    }}
                                    className={`py-1 px-2 rounded text-xs font-semibold transition-all flex-shrink-0 ${
                                      completedDietIds.has(item.id)
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
                                        }
                                        toast({
                                          title: isCompleting ? "Hábito concluído!" : "Hábito desmarcado",
                                        });
                                      } catch (err) {
                                        toast({
                                          title: "Erro ao atualizar status do hábito",
                                          variant: "destructive",
                                        });
                                      }
                                    }}
                                    className={`py-1 px-2 rounded text-xs font-semibold transition-all flex-shrink-0 ${
                                      completedHabitIds.has(item.id)
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
                                  className={`flex-1 flex items-start p-2 rounded-lg transition-colors ${
                                    typeCode === 1 ? "hover:bg-muted/50 cursor-pointer" : ""
                                  }`}
                                  disabled={typeCode !== 1}
                                >
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
                  Nenhuma rotina adicionada ainda
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
      <Drawer open={addRoutineModalOpen} onOpenChange={setAddRoutineModalOpen}>
        <DrawerContent className="max-h-[90dvh] flex flex-col modal-enter">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>Adicionar Rotina</DrawerTitle>
          </DrawerHeader>

          <div className="flex flex-col flex-1 gap-4 overflow-hidden px-4 pb-4">
            {/* Type Selection */}
            {selectedRoutineType === null ? (
              <div className="space-y-3">
                <div className="grid gap-2">
                  <Label htmlFor="routine_name" className="text-sm font-medium">Nome da Rotina (Opcional)</Label>
                  <Input
                    id="routine_name"
                    type="text"
                    value={routineName}
                    onChange={(e) => setRoutineName(e.target.value)}
                    placeholder="Ex: Treino de Peito"
                    className="h-9"
                  />
                </div>
                <p className="text-sm font-medium">Selecione o tipo:</p>
                <div className="grid grid-cols-1 gap-2">
                  {[1, 2, 3].map((typeCode) => {
                    const typeLabel =
                      typeCode === 1
                        ? "Exercícios"
                        : typeCode === 2
                          ? "Dietas"
                          : "Hábitos";
                    return (
                      <button
                        key={typeCode}
                        onClick={() => setSelectedRoutineType(typeCode)}
                        className="p-4 border border-border/60 rounded-lg hover:bg-muted/50 transition-colors text-left"
                      >
                        <p className="font-semibold text-sm">{typeLabel}</p>
                      </button>
                    );
                  })}
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
                    <button
                      onClick={() => {
                        setSelectedRoutineType(null);
                        setSelectedItems(new Set());
                        setSearchQuery("");
                        setSelectedMuscleGroups(new Set());
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Voltar
                    </button>
                  </div>

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
                      filteredWorkouts.map((workout) => {
                        const isAlreadySelected = userWorkouts.some(
                          (uw) => uw.workout_id === workout.id
                        );
                        const isNewSelection = selectedItems.has(workout.id);

                        return (
                          <button
                            key={workout.id}
                            onClick={() => handleSelectItem(workout.id)}
                            className={`w-full p-3 rounded-lg border transition-all text-left ${
                              isNewSelection
                                ? "border-brand bg-brand/10"
                                : isAlreadySelected
                                  ? "border-green-500/40 bg-green-500/5"
                                  : "border-border/60 hover:border-border/80"
                            }`}
                          >
                            {/* Exercise Info */}
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">
                                    {workout.name}
                                  </span>
                                  {isAlreadySelected && !isNewSelection && (
                                    <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                                      ✓ Já adicionado
                                    </p>
                                  )}
                                </div>
                                {workout.description && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {workout.description}
                                  </p>
                                )}
                                {workout.muscle_group && (
                                  <p className="text-xs text-brand mt-1 font-medium">
                                    {workout.muscle_group}
                                  </p>
                                )}
                              </div>
                              <input
                                type="checkbox"
                                checked={isNewSelection}
                                onChange={() => { }}
                                className="h-4 w-4 flex-shrink-0 mt-0.5"
                              />
                            </div>
                          </button>
                        );
                      })}

                    {selectedRoutineType === 2 &&
                      diets.map((diet) => (
                        <button
                          key={diet.id}
                          onClick={() => handleSelectItem(diet.id)}
                          className={`w-full p-3 rounded-lg border transition-all text-left ${selectedItems.has(diet.id)
                              ? "border-brand bg-brand/10"
                              : "border-border/60 hover:border-border/80"
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {diet.name}
                            </span>
                            <input
                              type="checkbox"
                              checked={selectedItems.has(diet.id)}
                              onChange={() => { }}
                              className="h-4 w-4"
                            />
                          </div>
                          {diet.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {diet.description}
                            </p>
                          )}
                          {diet.calories && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {diet.calories} cal
                            </p>
                          )}
                        </button>
                      ))}

                    {selectedRoutineType === 3 &&
                      habits.map((habit) => (
                        <button
                          key={habit.id}
                          onClick={() => handleSelectItem(habit.id)}
                          className={`w-full p-3 rounded-lg border transition-all text-left ${selectedItems.has(habit.id)
                              ? "border-brand bg-brand/10"
                              : "border-border/60 hover:border-border/80"
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {habit.name}
                            </span>
                            <input
                              type="checkbox"
                              checked={selectedItems.has(habit.id)}
                              onChange={() => { }}
                              className="h-4 w-4"
                            />
                          </div>
                          {habit.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {habit.description}
                            </p>
                          )}
                        </button>
                      ))}
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
                  <X className="h-5 w-5" />
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
                        <option value="">Padrão</option>
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
                            className={`group relative grid grid-cols-[40px_1fr_60px_60px_44px] gap-3 items-center py-1.5 rounded hover:bg-muted/20 transition-colors ${
                              s.completed ? "opacity-50" : ""
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
                            <div className="relative flex items-center justify-center">
                              <button
                                onClick={() =>
                                  handleToggleSerieCompleted(
                                    workout.workout_id,
                                    index,
                                  )
                                }
                                className="h-6 w-6 rounded bg-muted/40 hover:bg-muted/60 flex items-center justify-center transition-colors"
                              >
                                {s.completed ? (
                                  <CheckCircle2 className="h-4 w-4 text-brand" />
                                ) : (
                                  <Circle className="h-4 w-4 text-muted-foreground" />
                                )}
                              </button>
                              <button
                                onClick={() => handleDeleteSerie(workout.workout_id, index)}
                                className="absolute opacity-0 group-hover:opacity-100 transition-opacity -right-2 h-6 w-6 rounded-full bg-destructive/80 hover:bg-destructive flex items-center justify-center flex-shrink-0"
                                title="Deletar série"
                                aria-label="Deletar série"
                              >
                                <Trash2 className="h-3 w-3 text-white" />
                              </button>
                            </div>
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
                  <label className="text-sm font-medium">Quantidade (qtd)</label>
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
                        await updateUserGoalDb(editingGoal.id, {
                          duration: editGoalDuration,
                          quantity: editGoalQuantity,
                        });

                        // Update local user goals state
                        const updatedUserGoals = userGoals.map((goal) =>
                          goal.id === editingGoal.id
                            ? {
                                ...goal,
                                duration: editGoalDuration,
                                quantity: editGoalQuantity,
                              }
                            : goal,
                        );
                        setUserGoals(updatedUserGoals);

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

                        // Remove from local user goals state
                        setUserGoals(userGoals.filter((goal) => goal.id !== editingGoal.id));

                        // Remove from selected goals
                        setSelectedGoalIds(
                          selectedGoalIds.filter((id) => {
                            const goal = userGoals.find((g) => g.id === id);
                            return goal?.goal_id !== editingGoal.goal_id;
                          })
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
                className={`group relative overflow-hidden rounded-xl transition-all duration-300 ${
                  weekCheckIns.size >= 1
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
                className={`group relative overflow-hidden rounded-xl transition-all duration-300 ${
                  weekCheckIns.size >= 3
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
                className={`group relative overflow-hidden rounded-xl transition-all duration-300 ${
                  weekCheckIns.size >= 5
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
                className={`group relative overflow-hidden rounded-xl transition-all duration-300 ${
                  weekCheckIns.size === 7
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
                  className={`w-full p-4 rounded-lg border-2 transition-all text-left space-y-3 ${
                    selectedCheckInGoal?.id === goal.id
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
                        {goal.actual_progress} de {goal.quantity}
                      </span>
                      <span className="font-medium text-foreground">
                        {goal.quantity - goal.actual_progress} para concluir
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
              Vincular Rotinas a "{selectedGoalForRoutines?.description}"
            </DrawerTitle>
          </DrawerHeader>

          {/* Search Input and Muscle Group Filter */}
          <div className="px-4 py-3 border-b border-border/60 space-y-3">
            <Input
              placeholder="Buscar rotina..."
              value={routineSearchQuery}
              onChange={(e) => setRoutineSearchQuery(e.target.value)}
              className="h-9 rounded-full text-sm"
            />

            {/* Muscle Group Filter */}
            {userWorkouts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs font-medium text-muted-foreground">
                    Grupo muscular:
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Array.from(new Set(userWorkouts.map((w) => w.muscle_group).filter(Boolean))).map(
                    (muscleGroup) => (
                      <button
                        key={muscleGroup}
                        onClick={() => {
                          const newSelection = new Set(goalRoutineMuscleGroups);
                          if (newSelection.has(muscleGroup)) {
                            newSelection.delete(muscleGroup);
                          } else {
                            newSelection.add(muscleGroup);
                          }
                          setGoalRoutineMuscleGroups(newSelection);
                        }}
                        className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                          goalRoutineMuscleGroups.has(muscleGroup)
                            ? "border-brand bg-brand/20 text-brand"
                            : "border-border/60 text-muted-foreground hover:border-border/80"
                        }`}
                      >
                        {muscleGroup}
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
            {/* Exercises Section */}
            {userWorkouts.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold">Exercícios ({userWorkouts.length})</p>
                <div className="space-y-2">
                  {userWorkouts
                    .filter((workout) => {
                      const matchesSearch = workout.workoutName
                        ?.toLowerCase()
                        .includes(routineSearchQuery.toLowerCase());
                      const matchesMuscleGroup =
                        goalRoutineMuscleGroups.size === 0 ||
                        goalRoutineMuscleGroups.has(workout.muscle_group || "");
                      return matchesSearch && matchesMuscleGroup;
                    })
                    .map((workout) => (
                      <button
                        key={workout.id}
                        onClick={() => {
                          const newSelection = new Set(goalRoutineSelection);
                          if (newSelection.has(workout.id)) {
                            newSelection.delete(workout.id);
                          } else {
                            newSelection.add(workout.id);
                          }
                          setGoalRoutineSelection(newSelection);
                        }}
                        className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                          goalRoutineSelection.has(workout.id)
                            ? "border-brand bg-brand/10"
                            : "border-border/60 hover:border-border/80"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium">{workout.workoutName}</span>
                            {workout.muscle_group && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {workout.muscle_group}
                              </p>
                            )}
                          </div>
                          <div className="shrink-0 mt-0.5">
                            {goalRoutineSelection.has(workout.id) ? (
                              <Check className="h-5 w-5 text-brand" />
                            ) : (
                              <div className="h-5 w-5 border-2 border-border rounded" />
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Diets Section */}
            {userDiets.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold">Dietas ({userDiets.length})</p>
                <div className="space-y-2">
                  {userDiets
                    .filter((diet) =>
                      diet.dietName?.toLowerCase().includes(routineSearchQuery.toLowerCase())
                    )
                    .map((diet) => (
                      <button
                        key={diet.id}
                        onClick={() => {
                          const newSelection = new Set(goalRoutineSelection);
                          if (newSelection.has(diet.id)) {
                            newSelection.delete(diet.id);
                          } else {
                            newSelection.add(diet.id);
                          }
                          setGoalRoutineSelection(newSelection);
                        }}
                        className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                          goalRoutineSelection.has(diet.id)
                            ? "border-brand bg-brand/10"
                            : "border-border/60 hover:border-border/80"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-sm font-medium flex-1">{diet.dietName}</span>
                          <div className="shrink-0 mt-0.5">
                            {goalRoutineSelection.has(diet.id) ? (
                              <Check className="h-5 w-5 text-brand" />
                            ) : (
                              <div className="h-5 w-5 border-2 border-border rounded" />
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Habits Section */}
            {userHabits.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold">Hábitos ({userHabits.length})</p>
                <div className="space-y-2">
                  {userHabits
                    .filter((habit) =>
                      habit.habitName?.toLowerCase().includes(routineSearchQuery.toLowerCase())
                    )
                    .map((habit) => (
                      <button
                        key={habit.id}
                        onClick={() => {
                          const newSelection = new Set(goalRoutineSelection);
                          if (newSelection.has(habit.id)) {
                            newSelection.delete(habit.id);
                          } else {
                            newSelection.add(habit.id);
                          }
                          setGoalRoutineSelection(newSelection);
                        }}
                        className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                          goalRoutineSelection.has(habit.id)
                            ? "border-brand bg-brand/10"
                            : "border-border/60 hover:border-border/80"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-sm font-medium flex-1">{habit.habitName}</span>
                          <div className="shrink-0 mt-0.5">
                            {goalRoutineSelection.has(habit.id) ? (
                              <Check className="h-5 w-5 text-brand" />
                            ) : (
                              <div className="h-5 w-5 border-2 border-border rounded" />
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {userWorkouts.length === 0 && userDiets.length === 0 && userHabits.length === 0 && (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Nenhuma rotina disponível para vincular
              </div>
            )}

            {/* Confirm Button */}
            {goalRoutineSelection.size > 0 && (
              <Button
                className="w-full rounded-full mt-4"
                onClick={async () => {
                  try {
                    if (selectedGoalForRoutines && user) {
                      for (const routineId of Array.from(goalRoutineSelection)) {
                        await updateRoutineGoalDb(routineId, String(selectedGoalForRoutines.id));
                      }
                    }
                    toast({
                      title: "Rotinas Vinculadas!",
                      description: `${goalRoutineSelection.size} rotina(s) vinculada(s) com sucesso.`,
                    });
                    setGoalRoutineModalOpen(false);
                    setGoalRoutineSelection(new Set());
                    setSelectedGoalForRoutines(null);
                    setRoutineSearchQuery("");
                    setGoalRoutineMuscleGroups(new Set());
                  } catch (err) {
                    toast({
                      title: "Erro ao vincular rotinas",
                      variant: "destructive",
                    });
                  }
                }}
              >
                Confirmar Seleção
              </Button>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
