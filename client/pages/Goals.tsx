import * as React from "react";
import { useNavigate } from "react-router-dom";
import { getProgrammedGoalsDb, createUserGoalDb, getUserSelectedGoalIdsDb, type ProgrammedGoal } from "@/lib/ritmofit-db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";

export default function Goals() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [goals, setGoals] = React.useState<ProgrammedGoal[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectingGoalId, setSelectingGoalId] = React.useState<string | null>(null);
  const [selectedGoalIds, setSelectedGoalIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    (async () => {
      try {
        const [goalsData, selectedIds] = await Promise.all([
          getProgrammedGoalsDb(),
          getUserSelectedGoalIdsDb(),
        ]);
        setGoals(goalsData);
        setSelectedGoalIds(selectedIds);
      } catch (err: any) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Erro ao carregar metas:", errorMessage);
        toast({
          title: "Erro ao carregar metas",
          description: errorMessage || "Tente novamente.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
      await createUserGoalDb(goal.id, user.id, goal.type, goal.duration, goal.quantity);

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
    return <div className="p-6 text-sm text-muted-foreground">Carregando metas...</div>;
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Metas</h1>
        <p className="text-sm text-muted-foreground">
          Escolha uma meta pré-programada para começar sua jornada.
        </p>
      </div>

      {goals.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((goal) => (
            <Card key={goal.id} className="border-border/60 hover:border-border/80 transition-colors cursor-pointer">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{goal.description}</CardTitle>
                <CardDescription className="capitalize">{goal.type}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Duração</p>
                    <p className="text-sm font-medium">{goal.duration} dias</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Quantidade</p>
                    <p className="text-sm font-medium">{goal.quantity}</p>
                  </div>
                </div>

                <Button
                  type="button"
                  className="w-full rounded-full"
                  disabled={selectingGoalId === goal.id || selectedGoalIds.includes(goal.id)}
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
          <p className="text-sm text-muted-foreground">Nenhuma meta disponível no momento.</p>
        </div>
      )}
    </div>
  );
}
