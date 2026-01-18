import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Info } from "lucide-react";

import { findWorkoutExerciseById } from "@/lib/ritmofit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function ExerciseDetails() {
  const { exerciseId } = useParams();

  const exercise = React.useMemo(() => {
    if (!exerciseId) return null;
    return findWorkoutExerciseById(exerciseId);
  }, [exerciseId]);

  if (!exercise) {
    return (
      <div className="mx-auto grid w-full max-w-3xl gap-4">
        <Button asChild variant="ghost" className="w-fit rounded-full">
          <Link to="/perfil">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>

        <Card className="border-border/60">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Exercício não encontrado.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <Button asChild variant="ghost" className="w-fit rounded-full">
        <Link to={-1 as any}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
      </Button>

      <Card className="border-border/60 overflow-hidden">
        <div className="relative">
          <img
            src={exercise.imageUrl}
            alt={exercise.name}
            className="h-64 w-full object-cover sm:h-80"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="h-4 w-4" />
              {exercise.muscleGroup}
            </div>
            <div className="mt-1 text-xl font-semibold tracking-tight text-foreground">
              {exercise.name}
            </div>
          </div>
        </div>

        <CardHeader className="pb-3">
          <CardTitle className="text-base">Como fazer corretamente</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          <ol className="grid gap-2 pl-5 text-sm text-foreground list-decimal">
            {exercise.howTo.map((step) => (
              <li key={step} className="leading-relaxed">
                {step}
              </li>
            ))}
          </ol>

          <Separator className="opacity-60" />

          <div className="grid gap-2">
            <div className="text-sm font-semibold">Dicas rápidas</div>
            <ul className="grid gap-2 pl-5 text-sm text-muted-foreground list-disc">
              {exercise.tips.map((t) => (
                <li key={t} className="leading-relaxed">
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <Separator className="opacity-60" />

          <div className="grid gap-2">
            <div className="text-sm font-semibold">Erros comuns</div>
            <ul className="grid gap-2 pl-5 text-sm text-muted-foreground list-disc">
              {exercise.mistakes.map((m) => (
                <li key={m} className="leading-relaxed">
                  {m}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground">
            Observação: isto é um guia simples para o MVP. Se sentir dor aguda, pare e procure orientação.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
