import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  getProgrammedGoalsDb,
  createUserGoalDb,
  getUserSelectedGoalIdsDb,
  getUserRoutinesDb,
  getRankingDb,
  getRoutineTypeName,
  getUserWorkoutsDb,
  getUserDietsDb,
  getUserHabitsDb,
  toggleUserDietCompletionDb,
  toggleUserHabitCompletionDb,
  updateUserWorkoutDb,
  getDietsDb,
  getHabitsDb,
  type ProgrammedGoal,
  type Routine,
  type RankingUser,
  type UserWorkoutWithDetails,
  type UserDietWithDetails,
  type UserHabitWithDetails,
  type Diet,
  type Habit,
} from "@/lib/ritmofit-db";
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
  Trophy,
  TrendingUp,
  ChevronDown,
  Play,
  CheckCircle2,
  Circle,
  Plus,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function Goals() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Metas tab state
  const [goals, setGoals] = React.useState<ProgrammedGoal[]>([]);
  const [selectedGoalIds, setSelectedGoalIds] = React.useState<string[]>([]);

  // Rotinas tab state
  const [routines, setRoutines] = React.useState<Routine[]>([]);
  const [userWorkouts, setUserWorkouts] = React.useState<
    UserWorkoutWithDetails[]
  >([]);
  const [userDiets, setUserDiets] = React.useState<UserDietWithDetails[]>([]);
  const [userHabits, setUserHabits] = React.useState<UserHabitWithDetails[]>(
    [],
  );

  // Base data for lookups
  const [diets, setDiets] = React.useState<Diet[]>([]);
  const [habits, setHabits] = React.useState<Habit[]>([]);

  // Ranking tab state
  const [ranking, setRanking] = React.useState<RankingUser[]>([]);

  // General state
  const [loading, setLoading] = React.useState(true);
  const [selectingGoalId, setSelectingGoalId] = React.useState<string | null>(
    null,
  );
  const [expandedRoutineType, setExpandedRoutineType] = React.useState<
    number | null
  >(null);

  // Exercise modal state
  const [exerciseModalOpen, setExerciseModalOpen] = React.useState(false);
  const [selectedRoutineForExercise, setSelectedRoutineForExercise] =
    React.useState<Routine | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  const [exerciseFormData, setExerciseFormData] = React.useState<{
    [workoutId: string]: { series: string; weight: string };
  }>({});

  // Completion tracking state
  const [completedDiets, setCompletedDiets] = React.useState<Set<string>>(
    new Set(),
  );
  const [completedHabits, setCompletedHabits] = React.useState<Set<string>>(
    new Set(),
  );

  // Load all data on mount
  React.useEffect(() => {
    (async () => {
      try {
        const [
          goalsData,
          selectedIds,
          routinesData,
          rankingData,
          workoutsData,
          dietsData,
          habitsData,
        ] = await Promise.all([
          getProgrammedGoalsDb(),
          getUserSelectedGoalIdsDb(),
          user ? getUserRoutinesDb(user.id) : Promise.resolve([]),
          getRankingDb(),
          user ? getUserWorkoutsDb(user.id) : Promise.resolve([]),
          user ? getUserDietsDb(user.id) : Promise.resolve([]),
          user ? getUserHabitsDb(user.id) : Promise.resolve([]),
        ]);
        setGoals(goalsData);
        setSelectedGoalIds(selectedIds);
        setRoutines(routinesData);
        setRanking(rankingData);
        setUserWorkouts(workoutsData);
        setUserDiets(dietsData);
        setUserHabits(habitsData);

        // Debug logging
        console.log("[Goals] Routines loaded:", routinesData);
        console.log("[Goals] User workouts:", workoutsData);
        console.log("[Goals] User diets:", dietsData);
        console.log("[Goals] User habits:", habitsData);
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

  // Timer effect for exercise modal
  React.useEffect(() => {
    if (!exerciseModalOpen) return;

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [exerciseModalOpen]);

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

      // Redirect to home after a short delay
      setTimeout(() => {
        navigate("/");
      }, 1500);
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

  const handleOpenExerciseModal = (routine: Routine) => {
    setSelectedRoutineForExercise(routine);
    setElapsedSeconds(0);
    setExerciseFormData({});
    setExerciseModalOpen(true);
  };

  const handleSaveExerciseData = async () => {
    if (!selectedRoutineForExercise) return;

    try {
      // Get the workout linked to this routine
      const linkedWorkouts = userWorkouts.filter(
        (w) => String(w.id) === selectedRoutineForExercise.program_id,
      );

      for (const workout of linkedWorkouts) {
        const formData = exerciseFormData[workout.id];
        if (formData) {
          await updateUserWorkoutDb(
            workout.id,
            parseInt(formData.series) || 0,
            parseInt(formData.weight) || 0,
            0,
          );
        }
      }

      toast({
        title: "Exercício registrado!",
        description: `Tempo: ${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s`,
      });

      setExerciseModalOpen(false);
    } catch (err: any) {
      console.error("Error saving exercise data:", err);
      toast({
        title: "Erro ao salvar dados",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleToggleDiet = async (userDietId: string) => {
    const newCompleted = new Set(completedDiets);
    if (newCompleted.has(userDietId)) {
      newCompleted.delete(userDietId);
    } else {
      newCompleted.add(userDietId);
    }
    setCompletedDiets(newCompleted);

    try {
      await toggleUserDietCompletionDb(
        userDietId,
        newCompleted.has(userDietId),
      );
    } catch (err) {
      console.error("Error toggling diet:", err);
    }
  };

  const handleToggleHabit = async (userHabitId: string) => {
    const newCompleted = new Set(completedHabits);
    if (newCompleted.has(userHabitId)) {
      newCompleted.delete(userHabitId);
    } else {
      newCompleted.add(userHabitId);
    }
    setCompletedHabits(newCompleted);

    try {
      await toggleUserHabitCompletionDb(
        userHabitId,
        newCompleted.has(userHabitId),
      );
    } catch (err) {
      console.error("Error toggling habit:", err);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
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
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Metas e Ranking
        </h1>
        <p className="text-sm text-muted-foreground">
          Gerencie suas metas, rotinas e acompanhe seu ranking.
        </p>
      </div>

      <Tabs defaultValue="metas" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="metas">Metas</TabsTrigger>
          <TabsTrigger value="rotinas">Rotinas</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
        </TabsList>

        {/* Metas Tab */}
        <TabsContent value="metas" className="space-y-4">
          {goals.length ? (
            <div className="grid gap-4 md:grid-cols-3">
              {goals.map((goal) => {
                const goalTypeLabel =
                  goal.type === 1
                    ? "1 - Fitness"
                    : goal.type === 2
                      ? "2 - Saúde"
                      : "3 - Hábitos";
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
                    <div
                      className={`px-3 py-1.5 ${goalTypeColor} text-xs font-semibold`}
                    >
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
                        disabled={
                          selectingGoalId === goal.id ||
                          selectedGoalIds.includes(goal.id)
                        }
                        onClick={() => handleSelectGoal(goal)}
                      >
                        {selectingGoalId === goal.id
                          ? "Salvando..."
                          : selectedGoalIds.includes(goal.id)
                            ? "Selecionada"
                            : "Selecionar"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
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
          {routines.length > 0 ? (
            <div className="space-y-2">
              {[1, 2, 3].map((typeCode) => {
                const routinesOfType = routines.filter(
                  (r) => r.type === typeCode,
                );
                if (routinesOfType.length === 0) return null;

                const typeName = getRoutineTypeName(typeCode);
                const isExpanded = expandedRoutineType === typeCode;

                return (
                  <div
                    key={typeCode}
                    className="border border-border/60 rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() =>
                        setExpandedRoutineType(isExpanded ? null : typeCode)
                      }
                      className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 text-left">
                        <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-brand/10">
                          <span className="text-xs font-semibold text-brand">
                            {typeCode}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{typeName}</p>
                          <p className="text-xs text-muted-foreground">
                            {routinesOfType.length} rotina
                            {routinesOfType.length > 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`transform transition-transform flex-shrink-0 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      >
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-border/60 bg-muted/30 p-4 space-y-3">
                        {routinesOfType.map((routine) => {
                          // Get items linked to this routine
                          let items: any[] = [];
                          if (typeCode === 1) {
                            items = userWorkouts.filter(
                              (w) => String(w.workout_id) === routine.program_id,
                            );
                          } else if (typeCode === 2) {
                            items = userDiets.filter(
                              (d) => String(d.diet_id) === routine.program_id,
                            );
                          } else if (typeCode === 3) {
                            items = userHabits.filter(
                              (h) => String(h.habit_id) === routine.program_id,
                            );
                          }

                          return (
                            <Card
                              key={routine.id}
                              className="border-border/60 bg-background"
                            >
                              {/* Exercises Type (1) */}
                              {typeCode === 1 && (
                                <CardContent className="p-4 space-y-3">
                                  {items.length > 0 ? (
                                    <>
                                      <div>
                                        <p className="font-semibold text-sm mb-2">
                                          Exercícios ({items.length})
                                        </p>
                                        <div className="space-y-2">
                                          {items.map((workout) => (
                                            <div
                                              key={workout.id}
                                              className="text-xs bg-muted/30 p-2 rounded"
                                            >
                                              <p className="font-medium">
                                                {(workout.workouts as any)
                                                  ?.name ||
                                                  workout.workoutName ||
                                                  "Exercício"}
                                              </p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                      <Button
                                        onClick={() =>
                                          handleOpenExerciseModal(routine)
                                        }
                                        className="w-full rounded-full gap-2 text-sm"
                                      >
                                        <Play className="h-4 w-4" />
                                        Iniciar
                                      </Button>
                                    </>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">
                                      Nenhum exercício vinculado
                                    </p>
                                  )}
                                </CardContent>
                              )}

                              {/* Diet Type (2) */}
                              {typeCode === 2 && (
                                <CardContent className="p-4 space-y-2">
                                  {items.length > 0 ? (
                                    items.map((diet) => (
                                      <button
                                        key={diet.id}
                                        onClick={() =>
                                          handleToggleDiet(diet.id)
                                        }
                                        className="w-full flex items-center gap-3 p-2 rounded hover:bg-muted/30 transition-colors text-left"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={completedDiets.has(diet.id)}
                                          onChange={() => {}}
                                          className="h-4 w-4"
                                        />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium truncate">
                                            {(diet.diets as any)?.name ||
                                              diet.dietName ||
                                              "Dieta"}
                                          </p>
                                          {((diet.diets as any)?.calories ||
                                            diet.dietCalories) && (
                                            <p className="text-xs text-muted-foreground">
                                              {(diet.diets as any)?.calories ||
                                                diet.dietCalories}{" "}
                                              cal
                                            </p>
                                          )}
                                        </div>
                                      </button>
                                    ))
                                  ) : (
                                    <p className="text-xs text-muted-foreground">
                                      Nenhuma dieta vinculada
                                    </p>
                                  )}
                                </CardContent>
                              )}

                              {/* Habit Type (3) */}
                              {typeCode === 3 && (
                                <CardContent className="p-4 space-y-2">
                                  {items.length > 0 ? (
                                    items.map((habit) => (
                                      <button
                                        key={habit.id}
                                        onClick={() =>
                                          handleToggleHabit(habit.id)
                                        }
                                        className="w-full flex items-center gap-3 p-2 rounded hover:bg-muted/30 transition-colors text-left"
                                      >
                                        {completedHabits.has(habit.id) ? (
                                          <CheckCircle2 className="h-5 w-5 text-brand flex-shrink-0" />
                                        ) : (
                                          <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                        )}
                                        <p className="text-sm font-medium flex-1">
                                          {(habit.habits as any)?.name ||
                                            habit.habitName ||
                                            "Hábito"}
                                        </p>
                                      </button>
                                    ))
                                  ) : (
                                    <p className="text-xs text-muted-foreground">
                                      Nenhum hábito vinculado
                                    </p>
                                  )}
                                </CardContent>
                              )}
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhuma rotina criada ainda. Vá para o perfil para criar uma.
              </p>
              <Button
                className="mt-4 rounded-full"
                onClick={() => navigate("/perfil")}
              >
                Ir para Perfil
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Ranking Tab */}
        <TabsContent value="ranking" className="space-y-4">
          {ranking.length > 0 ? (
            <div className="space-y-2">
              {ranking.map((user, index) => {
                const medalEmoji =
                  index === 0
                    ? "🥇"
                    : index === 1
                      ? "🥈"
                      : index === 2
                        ? "🥉"
                        : "";

                return (
                  <Card key={user.userId} className="border-border/60">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0 w-12 text-center">
                          {medalEmoji ? (
                            <span className="text-2xl">{medalEmoji}</span>
                          ) : (
                            <span className="text-lg font-bold text-muted-foreground">
                              #{index + 1}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 flex-1">
                          {user.userPhoto ? (
                            <img
                              src={user.userPhoto}
                              alt={user.userNickname}
                              className="h-12 w-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-full bg-muted" />
                          )}

                          <div className="flex-1">
                            <p className="font-semibold text-sm">
                              {user.userNickname}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Nível {user.level}
                            </p>
                          </div>
                        </div>

                        <div className="flex-shrink-0 text-right">
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-4 w-4 text-brand" />
                            <span className="font-bold text-brand">
                              {user.points}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            pontos
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-6 text-center">
              <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Nenhum ranking disponível no momento. Comece a ganhar pontos
                interagindo no app!
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Exercise Modal */}
      <Dialog open={exerciseModalOpen} onOpenChange={setExerciseModalOpen}>
        <DialogContent className="max-h-[90dvh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Registrar Exercício</DialogTitle>
          </DialogHeader>

          {selectedRoutineForExercise && (
            <div className="space-y-4 overflow-y-auto flex-1">
              {/* Timer */}
              <div className="bg-brand/10 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground mb-2">Tempo</p>
                <p className="text-4xl font-bold font-mono">
                  {formatTime(elapsedSeconds)}
                </p>
              </div>

              {/* Exercises Form */}
              <div className="space-y-3">
                <p className="text-sm font-semibold">Exercícios</p>
                {userWorkouts
                  .filter(
                    (w) =>
                      String(w.workout_id) === selectedRoutineForExercise.program_id,
                  )
                  .map((workout) => (
                    <div
                      key={workout.id}
                      className="border border-border/60 rounded-lg p-3 space-y-2"
                    >
                      <p className="text-sm font-medium">
                        {(workout.workouts as any)?.name ||
                          workout.workoutName ||
                          "Exercício"}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-muted-foreground block mb-1">
                            Série
                          </label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={exerciseFormData[workout.id]?.series || ""}
                            onChange={(e) =>
                              setExerciseFormData({
                                ...exerciseFormData,
                                [workout.id]: {
                                  ...exerciseFormData[workout.id],
                                  series: e.target.value,
                                },
                              })
                            }
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground block mb-1">
                            Peso (KG)
                          </label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={exerciseFormData[workout.id]?.weight || ""}
                            onChange={(e) =>
                              setExerciseFormData({
                                ...exerciseFormData,
                                [workout.id]: {
                                  ...exerciseFormData[workout.id],
                                  weight: e.target.value,
                                },
                              })
                            }
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t border-border/60">
            <Button
              variant="outline"
              className="flex-1 rounded-full"
              onClick={() => setExerciseModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 rounded-full"
              onClick={handleSaveExerciseData}
            >
              Salvar Exercício
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
