import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  getProgrammedGoalsDb,
  createUserGoalDb,
  getUserSelectedGoalIdsDb,
  getRankingDb,
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
  type ProgrammedGoal,
  type RankingUser,
  type Workout,
  type Diet,
  type Habit,
  type Routine,
  type UserWorkoutWithDetails,
  type UserDietWithDetails,
  type UserHabitWithDetails,
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
  ChevronUp,
  Search,
  Filter,
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

export default function Goals() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Metas tab state
  const [goals, setGoals] = React.useState<ProgrammedGoal[]>([]);
  const [selectedGoalIds, setSelectedGoalIds] = React.useState<string[]>([]);

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
  const [userWorkouts, setUserWorkouts] = React.useState<UserWorkoutWithDetails[]>([]);
  const [userDiets, setUserDiets] = React.useState<UserDietWithDetails[]>([]);
  const [userHabits, setUserHabits] = React.useState<UserHabitWithDetails[]>([]);
  const [expandedRoutineId, setExpandedRoutineId] = React.useState<string | null>(null);

  // Ranking tab state
  const [ranking, setRanking] = React.useState<RankingUser[]>([]);

  // General state
  const [loading, setLoading] = React.useState(true);
  const [selectingGoalId, setSelectingGoalId] = React.useState<string | null>(
    null,
  );

  // Load all data on mount
  React.useEffect(() => {
    (async () => {
      try {
        const [
          goalsData,
          selectedIds,
          rankingData,
          workoutsBaseData,
          dietsBaseData,
          habitsBaseData,
        ] = await Promise.all([
          getProgrammedGoalsDb(),
          getUserSelectedGoalIdsDb(),
          getRankingDb(),
          getWorkoutsDb(),
          getDietsDb(),
          getHabitsDb(),
        ]);
        setGoals(goalsData);
        setSelectedGoalIds(selectedIds);
        setRanking(rankingData);
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

  const handleAddRoutineClick = () => {
    setAddRoutineModalOpen(true);
    setSelectedRoutineType(null);
    setSelectedItems(new Set());
    setSearchQuery("");
    setSelectedMuscleGroups(new Set());
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
            <div className="space-y-4">
              {/* Show one card per type that has routines */}
              {[1, 2, 3].map((typeCode) => {
                const hasRoutinesOfType = routines.some((r) => r.type === typeCode);
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
                    <button
                      onClick={() =>
                        setExpandedRoutineId(
                          isExpanded ? null : `type-${typeCode}`,
                        )
                      }
                      className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors text-left"
                    >
                      <div className="flex-1">
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

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="border-t border-border/60 bg-muted/20 p-4 space-y-2">
                        {itemsForType.length > 0 ? (
                          itemsForType.map((item: any) => (
                            <div
                              key={item.id}
                              className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50"
                            >
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
                  Adicionar Mais
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
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Voltar
                    </button>
                  </div>

                  {/* Items List */}
                  <div className="space-y-2">
                    {selectedRoutineType === 1 &&
                      workouts.map((workout) => (
                        <button
                          key={workout.id}
                          onClick={() => handleSelectItem(workout.id)}
                          className={`w-full p-3 rounded-lg border transition-all text-left ${
                            selectedItems.has(workout.id)
                              ? "border-brand bg-brand/10"
                              : "border-border/60 hover:border-border/80"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {workout.name}
                            </span>
                            <input
                              type="checkbox"
                              checked={selectedItems.has(workout.id)}
                              onChange={() => {}}
                              className="h-4 w-4"
                            />
                          </div>
                          {workout.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {workout.description}
                            </p>
                          )}
                        </button>
                      ))}

                    {selectedRoutineType === 2 &&
                      diets.map((diet) => (
                        <button
                          key={diet.id}
                          onClick={() => handleSelectItem(diet.id)}
                          className={`w-full p-3 rounded-lg border transition-all text-left ${
                            selectedItems.has(diet.id)
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
                              onChange={() => {}}
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
                          className={`w-full p-3 rounded-lg border transition-all text-left ${
                            selectedItems.has(habit.id)
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
                              onChange={() => {}}
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
    </div>
  );
}
