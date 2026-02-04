import * as React from "react";
import { getProgrammedGoalsDb, type ProgrammedGoal } from "@/lib/ritmofit-db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

export default function Goals() {
  const [goals, setGoals] = React.useState<ProgrammedGoal[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const data = await getProgrammedGoalsDb();
        setGoals(data);
      } catch (err: any) {
        console.error("Erro ao carregar metas:", err);
        toast({
          title: "Erro ao carregar metas",
          description: err?.message || "Tente novamente.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSelectGoal = (goal: ProgrammedGoal) => {
    toast({
      title: "Meta selecionada!",
      description: goal.description,
    });
    // TODO: Handle goal selection (navigate or store selection)
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
                  onClick={() => handleSelectGoal(goal)}
                >
                  Selecionar meta
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
