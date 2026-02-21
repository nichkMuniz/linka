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
  const [finishWorkoutConfirmOpen, setFinishWorkoutConfirmOpen] = React.useState(false);

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
  const [badgesModalOpen, setBadgesModalOpen] = React.useState(false);

  // Available goals accordion state
  const [availableGoalsOpen, setAvailableGoalsOpen] = React.useState(false);

  // Workout history modal state
  const [workoutHistoryModalOpen, setWorkoutHistoryModalOpen] = React.useState(false);
  const [selectedWorkoutForHistory, setSelectedWorkoutForHistory] = React.useState<Workout | null>(null);
  const [workoutHistory, setWorkoutHistory] = React.useState<WorkoutHistoryRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(false);

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

          console.log("[Goals] Routines:", routinesData);
          console.log("[Goals] User workouts:", userWorkoutsData);
          console.log("[Goals] User diets:", userDietsData);
          console.log("[Goals] User habits:", userHabitsData);
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
      } catch (err) {
        console.error("Error loading check-in data:", err);
        // Gracefully fallback to empty state
        setDailyCheckInDone(false);
        setWeekCheckIns(new Set());
      }
    })();
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

    // Mark check-in as done for today
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
      console.error("Error during check-in:", err);
      toast({
        title: "Erro ao fazer check-in",
        description: err?.message || "Tente novamente.",
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

  // Rest timer effect
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (restTimerModalOpen && restTimerRemaining > 0) {
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
      const recordsToUpdate: Array<{
        id: string;
        volume?: number;
        reps?: number;
        time_rest?: number;
        duration?: number;
      }> = [];

      // Build update records from filled series
      for (const [workoutId, series] of Object.entries(workoutSeries)) {
        if (series.length > 0) {
          // Find the corresponding userWorkout record(s) for this exercise
          const workoutRecords = userWorkouts.filter(
            (w) => w.workout_id === workoutId,
          );

          // Update existing records with series data
          for (let i = 0; i < series.length && i < workoutRecords.length; i++) {
            const serie = series[i];
            recordsToUpdate.push({
              id: workoutRecords[i].id,
              volume: serie.kg || null,
              reps: serie.reps || null,
              time_rest: workoutExerciseRestTimes[workoutId] || 0,
              duration: workoutDuration,
            });
          }

          // If there are more series than existing records, create new ones
          if (series.length > workoutRecords.length) {
            const newSeriesRecords = series.slice(workoutRecords.length);
            const newRecordsToInsert: Array<{
              user_id: string;
              workout_id: string;
              volume?: number;
              reps?: number;
              time_rest?: number;
              duration?: number;
            }> = newSeriesRecords.map((s) => ({
              user_id: user.id,
              workout_id: workoutId,
              volume: s.kg || null,
              reps: s.reps || null,
              time_rest: workoutExerciseRestTimes[workoutId] || 0,
              duration: workoutDuration,
            }));

            // Insert new records only if there are any to insert
            if (newRecordsToInsert.length > 0) {
              const { error } = await supabase
                .from("user_workouts")
                .insert(newRecordsToInsert);

              if (error) throw error;
            }
          }
        }
      }

      if (recordsToUpdate.length === 0) {
        toast({
          title: "Nenhuma série registrada",
          description:
            "Adicione e preencha pelo menos uma série para salvar o treino.",
          variant: "destructive",
        });
        return;
      }

      // Update existing records
      await updateWorkoutSeriesDb(recordsToUpdate);

      // Save workout history for each exercise with completed series
      for (const [workoutId, series] of Object.entries(workoutSeries)) {
        const completedSeries = series.filter((s) => s.completed);
        if (completedSeries.length > 0) {
          const workoutRecords = userWorkouts.filter(
            (w) => w.workout_id === workoutId,
          );

          for (let i = 0; i < completedSeries.length && i < workoutRecords.length; i++) {
            const serie = completedSeries[i];
            try {
              await saveWorkoutHistoryDb(
                user.id,
                workoutRecords[i].id,
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
      setWorkoutSeries({});
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

      if (selectedRoutineType === 1) {
        // Save workouts
        await createUserWorkoutsDb(user.id, itemIds);
      } else if (selectedRoutineType === 2) {
        // Save diets
        await createUserDietsDb(user.id, itemIds);
      } else if (selectedRoutineType === 3) {
        // Save habits
        await createUserHabitsDb(user.id, itemIds);
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

      // Refresh routines data to show newly added items
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
          console.error("Error refreshing routines:", err);
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
      <div className="p-6 text-sm text-muted-foreground">
        Carregando dados...
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
        <TabsContent value="metas" className="space-y-6">
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

                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="w-full rounded-full mt-auto text-xs h-8"
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
        <TabsContent value="rotinas" className="space-y-4">
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
                  disabled={dailyCheckInDone || isProcessingCheckIn}
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
                  ) : (
                    "Fazer Check In"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {routines.length > 0 ? (
            <div className="space-y-4">
              {/* Show one card per type that has routines */}
              {[1, 2, 3].map((typeCode) => {
                const hasRoutinesOfType = routines.some(
                  (r) => r.type === typeCode,
                );
                if (!hasRoutinesOfType) return null;

                const typeLabel =
                  typeCode === 1
                    ? "Exercícios"
                    : typeCode === 2
                      ? "Dietas"
                      : "Hábitos";

                // Get items for this type
                const itemsForType =
                  typeCode === 1
                    ? userWorkouts
                    : typeCode === 2
                      ? userDiets
                      : userHabits;

                const isExpanded = expandedRoutineId === `type-${typeCode}`;

                return (
                  <Card
                    key={typeCode}
                    className="border-border/60 overflow-hidden"
                  >
                    <div className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors text-left">
                      <button
                        onClick={() =>
                          setExpandedRoutineId(
                            isExpanded ? null : `type-${typeCode}`,
                          )
                        }
                        className="flex-1 flex items-center justify-between"
                      >
                        <div className="flex flex-col justify-center items-center flex-1">
                          <p className="text-sm font-medium">{typeLabel}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {itemsForType.length > 0
                              ? `${itemsForType.length} item(ns)`
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
                          <DropdownMenuItem onClick={() => handleAddRoutineClick()}>
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
                      {typeCode === 1 && itemsForType.length > 0 && (
                        <button
                          onClick={() => setWorkoutModalOpen(true)}
                          className="ml-2 p-2 rounded-lg bg-brand/10 hover:bg-brand/20 transition-colors"
                        >
                          <Play className="h-5 w-5 text-brand" />
                        </button>
                      )}
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="border-t border-border/60 bg-muted/20 p-4 space-y-2">
                        {itemsForType.length > 0 ? (
                          itemsForType.map((item: any) => (
                            <div
                              key={item.id}
                              className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50"
                            >
                              {/* Image for exercises - only show if exists */}
                              {typeCode === 1 && item.workoutPhoto && (
                                <img
                                  src={item.workoutPhoto}
                                  alt={item.workoutName}
                                  className="h-16 w-16 rounded-lg object-cover flex-shrink-0"
                                />
                              )}

                              <div className="flex-1 min-w-0">
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

                              {/* Delete button */}
                              <button
                                onClick={() => handleDeleteExercise(item.id)}
                                className="p-2 hover:bg-red-500/10 rounded transition-colors flex-shrink-0"
                                title="Remover exercício"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </button>
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
              })}

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
        <DrawerContent className="max-h-[90dvh] flex flex-col">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>Adicionar Rotina</DrawerTitle>
          </DrawerHeader>

          <div className="flex flex-col flex-1 gap-4 overflow-hidden px-4 pb-4">
            {/* Type Selection */}
            {selectedRoutineType === null ? (
              <div className="space-y-3">
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
                      filteredWorkouts.map((workout) => (
                        <button
                          key={workout.id}
                          onClick={() => handleSelectItem(workout.id)}
                          className={`w-full p-3 rounded-lg border transition-all text-left flex gap-3 ${selectedItems.has(workout.id)
                              ? "border-brand bg-brand/10"
                              : "border-border/60 hover:border-border/80"
                            }`}
                        >
                          {/* Exercise Image */}
                          {workout.photo ? (
                            <img
                              src={workout.photo}
                              alt={workout.name}
                              className="h-20 w-20 rounded-lg object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="h-20 w-20 rounded-lg bg-muted flex-shrink-0" />
                          )}

                          {/* Exercise Info */}
                          <div className="flex-1 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium">
                                  {workout.name}
                                </span>
                                <input
                                  type="checkbox"
                                  checked={selectedItems.has(workout.id)}
                                  onChange={() => { }}
                                  className="h-4 w-4 flex-shrink-0"
                                />
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
                          </div>
                        </button>
                      ))}

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
      <Dialog open={workoutModalOpen} onOpenChange={setWorkoutModalOpen}>
        <DialogContent className="max-h-[90dvh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between">
            <DialogTitle>Registrar Treino</DialogTitle>
            <button
              onClick={handleFinishWorkout}
              className="rounded-full h-12 w-12 p-2 bg-destructive hover:bg-destructive/90 text-white flex items-center justify-center transition-colors flex-shrink-0"
              title="Encerrar treino"
            >
              <Pause className="h-5 w-5" />
            </button>
          </div>

          {/* Timer - Sticky at top */}
          <div className="mt-4 p-4 rounded-lg border border-brand/30 bg-brand/5">
            <p className="text-xs font-medium text-muted-foreground text-center mb-2">
              Duração
            </p>
            <p className="text-4xl font-bold text-brand text-center">
              {formatDuration(workoutDuration)}
            </p>
          </div>

          {/* Exercises List - Scrollable */}
          <div className="flex-1 overflow-y-auto mt-4 space-y-4 pr-2">
            {userWorkouts.length > 0 ? (
              userWorkouts.map((workout) => (
                <div
                  key={workout.id}
                  className="border border-border/60 rounded-lg overflow-hidden"
                >
                  {/* Exercise Header */}
                  <div className="flex items-start gap-3 p-3 bg-muted/30">
                    {workout.workoutPhoto && (
                      <img
                        src={workout.workoutPhoto}
                        alt={workout.workoutName}
                        className="h-14 w-14 rounded-lg object-cover flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => handleOpenWorkoutHistory({
                          id: workout.workout_id,
                          name: workout.workoutName,
                          description: workout.workoutDescription || undefined,
                          photo: workout.workoutPhoto || undefined,
                        })}
                        className="text-sm font-bold truncate hover:text-brand hover:underline text-left transition-colors"
                      >
                        {workout.workoutName}
                      </button>
                      {workout.workoutDescription && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {workout.workoutDescription}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Exercise Content */}
                  <div className="p-3 space-y-3">
                    {/* Rest Time */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground block">
                        Descanso entre séries
                      </label>
                      <select
                        value={workoutExerciseRestTimes[workout.workout_id] || ""}
                        onChange={(e) =>
                          handleSetExerciseRestTime(workout.workout_id, parseInt(e.target.value))
                        }
                        className="w-full px-2.5 py-1.5 border border-border/60 rounded text-sm bg-background"
                      >
                        <option value="">Selecione</option>
                        {REST_TIME_OPTIONS.map((time) => (
                          <option key={time} value={time}>
                            {time < 60 ? `${time}s` : `${Math.floor(time / 60)}m`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Series List */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Séries</p>
                      {(workoutSeries[workout.workout_id] || []).map((series, index) => (
                        <div
                          key={index}
                          className={`p-2.5 bg-muted/40 rounded-lg border border-border/40 flex items-center gap-2 transition-all ${
                            series.completed ? "opacity-60" : ""
                          }`}
                        >
                          {/* Series number */}
                          <div className="w-8 h-8 flex items-center justify-center rounded-full bg-brand/20 text-brand font-bold text-xs flex-shrink-0">
                            {series.series}
                          </div>

                          {/* Inputs */}
                          <div className="flex items-center gap-1.5 flex-1">
                            <input
                              type="number"
                              step="0.5"
                              value={series.kg === 0 ? "" : series.kg}
                              onChange={(e) =>
                                handleUpdateSerie(
                                  workout.workout_id,
                                  index,
                                  "kg",
                                  e.target.value,
                                )
                              }
                              placeholder="kg"
                              className="w-14 h-7 px-1.5 border border-border/60 rounded text-xs bg-background"
                            />
                            <span className="text-xs text-muted-foreground">×</span>
                            <input
                              type="number"
                              value={series.reps === 0 ? "" : series.reps}
                              onChange={(e) =>
                                handleUpdateSerie(
                                  workout.workout_id,
                                  index,
                                  "reps",
                                  e.target.value,
                                )
                              }
                              placeholder="reps"
                              className="w-14 h-7 px-1.5 border border-border/60 rounded text-xs bg-background"
                            />
                          </div>

                          {/* Completed toggle */}
                          <button
                            onClick={() =>
                              handleToggleSerieCompleted(
                                workout.workout_id,
                                index,
                              )
                            }
                            className="p-1 hover:bg-muted/60 rounded transition-colors flex-shrink-0"
                          >
                            {series.completed ? (
                              <CheckCircle2 className="h-5 w-5 text-brand" />
                            ) : (
                              <Circle className="h-5 w-5 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add Series Button */}
                    <Button
                      onClick={() => handleAddSerie(workout.workout_id)}
                      variant="outline"
                      size="sm"
                      className="w-full text-xs h-7"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Série
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">Nenhum exercício adicionado</p>
              </div>
            )}
          </div>

          {/* Bottom Actions - Sticky */}
          <div className="mt-4 space-y-2 border-t border-border/40 pt-3">
            <Button
              onClick={() => handleAddExerciseFromWorkout()}
              variant="outline"
              size="sm"
              className="w-full text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Adicionar Exercício
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
                onClick={() => setRestTimerModalOpen(false)}
                variant="outline"
                className="flex-1 rounded-full"
              >
                Pular
              </Button>
              <Button
                onClick={() => setRestTimerModalOpen(false)}
                className="flex-1 rounded-full"
              >
                {restTimerRemaining === 0 ? "Próxima" : "Pausar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Goal Drawer */}
      <Drawer open={editGoalModalOpen} onOpenChange={setEditGoalModalOpen}>
        <DrawerContent className="max-h-[90dvh] flex flex-col">
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
                        await updateUserGoalDb(
                          editingGoal.id,
                          editGoalDuration,
                          editGoalQuantity,
                        );

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
                        toast({
                          title: "Erro ao atualizar meta",
                          description: err?.message || "Tente novamente.",
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

      {/* Finish Workout Confirmation Dialog */}
      <Dialog open={finishWorkoutConfirmOpen} onOpenChange={setFinishWorkoutConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Encerramento do Treino</DialogTitle>
          </DialogHeader>
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
        </DialogContent>
      </Dialog>

      {/* Badges/Insignias Drawer Modal */}
      <Drawer open={badgesModalOpen} onOpenChange={setBadgesModalOpen}>
        <DrawerContent className="max-h-[90dvh] flex flex-col">
          <DrawerHeader className="shrink-0">
            <DrawerTitle className="flex items-center gap-2">
              <span className="text-2xl">🏆</span>
              Insignias
            </DrawerTitle>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4">
            <div className="space-y-4 pb-8">
              {/* 1 Day */}
              <div className={`p-4 rounded-lg border-2 transition-all ${
                weekCheckIns.size >= 1
                  ? "border-yellow-500 bg-yellow-500/10"
                  : "border-gray-300 bg-gray-100/50 opacity-50"
              }`}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">⭐</span>
                  <div className="flex-1">
                    <p className="font-medium text-sm">Iniciante</p>
                    <p className="text-xs text-muted-foreground">Complete check-in 1 dia</p>
                  </div>
                  {weekCheckIns.size >= 1 && <Check className="h-5 w-5 text-yellow-600" />}
                </div>
              </div>

              {/* 3 Days */}
              <div className={`p-4 rounded-lg border-2 transition-all ${
                weekCheckIns.size >= 3
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-gray-300 bg-gray-100/50 opacity-50"
              }`}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🔥</span>
                  <div className="flex-1">
                    <p className="font-medium text-sm">Sequência</p>
                    <p className="text-xs text-muted-foreground">Complete check-in 3 dias</p>
                  </div>
                  {weekCheckIns.size >= 3 && <Check className="h-5 w-5 text-blue-600" />}
                </div>
              </div>

              {/* 5 Days */}
              <div className={`p-4 rounded-lg border-2 transition-all ${
                weekCheckIns.size >= 5
                  ? "border-green-500 bg-green-500/10"
                  : "border-gray-300 bg-gray-100/50 opacity-50"
              }`}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">💪</span>
                  <div className="flex-1">
                    <p className="font-medium text-sm">Campeão</p>
                    <p className="text-xs text-muted-foreground">Complete check-in 5 dias</p>
                  </div>
                  {weekCheckIns.size >= 5 && <Check className="h-5 w-5 text-green-600" />}
                </div>
              </div>

              {/* 7 Days */}
              <div className={`p-4 rounded-lg border-2 transition-all ${
                weekCheckIns.size === 7
                  ? "border-purple-500 bg-purple-500/10"
                  : "border-gray-300 bg-gray-100/50 opacity-50"
              }`}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">👑</span>
                  <div className="flex-1">
                    <p className="font-medium text-sm">Lendário</p>
                    <p className="text-xs text-muted-foreground">Complete check-in 7 dias (semana completa)</p>
                  </div>
                  {weekCheckIns.size === 7 && <Check className="h-5 w-5 text-purple-600" />}
                </div>
              </div>
            </div>

            <div className="border-t border-border/60 pt-4 pb-4 text-center sticky bottom-0 bg-background">
              <p className="text-sm font-medium">Progresso: {weekCheckIns.size}/7 dias</p>
              <p className="text-xs text-muted-foreground mt-1">
                Complete check-ins para ganhar insignias!
              </p>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Workout History Drawer */}
      <Drawer open={workoutHistoryModalOpen} onOpenChange={setWorkoutHistoryModalOpen}>
        <DrawerContent className="max-h-[90dvh] flex flex-col">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>
              Histórico de {selectedWorkoutForHistory?.name || "Exercício"}
            </DrawerTitle>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-6">
            {isLoadingHistory ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Carregando histórico...
              </div>
            ) : workoutHistory.length > 0 ? (
              workoutHistory.map((record, index) => (
                <div
                  key={record.id}
                  className="p-4 border border-border/60 rounded-lg bg-muted/30 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">
                      #{workoutHistory.length - index}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(record.dateCompleted).toLocaleString("pt-BR")}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {record.kilos && (
                      <div className="p-2 bg-background/50 rounded text-center">
                        <p className="text-xs text-muted-foreground">Peso</p>
                        <p className="text-sm font-bold">{record.kilos} kg</p>
                      </div>
                    )}
                    {record.volume && (
                      <div className="p-2 bg-background/50 rounded text-center">
                        <p className="text-xs text-muted-foreground">Volume</p>
                        <p className="text-sm font-bold">{record.volume}</p>
                      </div>
                    )}
                    {record.calories && (
                      <div className="p-2 bg-background/50 rounded text-center">
                        <p className="text-xs text-muted-foreground">Calorias</p>
                        <p className="text-sm font-bold">{record.calories} kcal</p>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Nenhum registro de treino encontrado
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
