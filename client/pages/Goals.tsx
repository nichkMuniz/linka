import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  getProgrammedGoalsDb,
  createUserGoalDb,
  getUserSelectedGoalIdsDb,
  getUserRoutinesDb,
  getRankingDb,
  getRoutineTypeName,
  type ProgrammedGoal,
  type Routine,
  type RankingUser,
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
import { Trophy, TrendingUp, ChevronDown } from "lucide-react";

export default function Goals() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Metas tab state
  const [goals, setGoals] = React.useState<ProgrammedGoal[]>([]);
  const [selectedGoalIds, setSelectedGoalIds] = React.useState<string[]>([]);

  // Rotinas tab state
  const [routines, setRoutines] = React.useState<Routine[]>([]);

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

  // Load all data on mount
  React.useEffect(() => {
    (async () => {
      try {
        const [goalsData, selectedIds, routinesData, rankingData] =
          await Promise.all([
            getProgrammedGoalsDb(),
            getUserSelectedGoalIdsDb(),
            user ? getUserRoutinesDb(user.id) : Promise.resolve([]),
            getRankingDb(),
          ]);
        setGoals(goalsData);
        setSelectedGoalIds(selectedIds);
        setRoutines(routinesData);
        setRanking(rankingData);
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
              {goals.map((goal) => (
                <Card
                  key={goal.id}
                  className="border-border/60 hover:border-border/80 transition-colors cursor-pointer"
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">
                      {goal.description}
                    </CardTitle>
                    <CardDescription className="capitalize">
                      {goal.type}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Duração</p>
                        <p className="text-sm font-medium">
                          {goal.duration} dias
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                          Quantidade
                        </p>
                        <p className="text-sm font-medium">{goal.quantity}</p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      className="w-full rounded-full"
                      disabled={
                        selectingGoalId === goal.id ||
                        selectedGoalIds.includes(goal.id)
                      }
                      onClick={() => handleSelectGoal(goal)}
                    >
                      {selectingGoalId === goal.id
                        ? "Salvando..."
                        : selectedGoalIds.includes(goal.id)
                          ? "Já selecionada"
                          : "Selecionar meta"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
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
                        {routinesOfType.map((routine) => (
                          <Card
                            key={routine.id}
                            className="border-border/60 bg-background hover:bg-muted/50 transition-colors"
                          >
                            <CardContent className="p-4">
                              <div className="space-y-2">
                                <p className="font-semibold text-sm">
                                  {routine.name || `Rotina ${typeName}`}
                                </p>
                                {routine.description && (
                                  <p className="text-xs text-muted-foreground">
                                    {routine.description}
                                  </p>
                                )}
                                <p className="text-xs text-brand">
                                  ID do Programa: {routine.program_id}
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
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
                const isCurrentUser = user.userId === user.userId; // Will be true for current user
                const medalEmoji =
                  index === 0
                    ? "🥇"
                    : index === 1
                      ? "🥈"
                      : index === 2
                        ? "🥉"
                        : "";

                return (
                  <Card
                    key={user.userId}
                    className={`border-border/60 ${
                      isCurrentUser ? "bg-brand/5 border-brand/30" : ""
                    }`}
                  >
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
    </div>
  );
}
