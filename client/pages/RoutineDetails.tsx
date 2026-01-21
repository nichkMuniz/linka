import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Copy, Share2, CheckCircle2 } from "lucide-react";

import type { Routine } from "@/lib/ritmofit";
import { copyRoutineDb, getMyProfileDb, getRoutinesDb } from "@/lib/ritmofit-db";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";

async function shareOrCopyUrl(title: string, url: string) {
  const nav = navigator as any;

  if (nav.share) {
    try {
      await nav.share({ title, url });
      return { ok: true, kind: "share" as const };
    } catch {
      // fallthrough
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return { ok: true, kind: "copy" as const };
  }

  return { ok: false, kind: "none" as const };
}

function itemsLabel(category: Routine["category"]) {
  if (category === "Treino") return "Exercícios";
  if (category === "Alimentação") return "Comidas";
  return "Hábitos";
}

export default function RoutineDetails() {
  const { routineId } = useParams();
  const [routine, setRoutine] = React.useState<Routine | null>(null);
  const [myHandle, setMyHandle] = React.useState("@voce");

  React.useEffect(() => {
    let canceled = false;

    (async () => {
      const [routines, profile] = await Promise.all([
        getRoutinesDb(),
        getMyProfileDb(),
      ]);

      if (canceled) return;

      if (profile?.handle) setMyHandle(profile.handle);
      const found = routines.find((r) => r.id === routineId) ?? null;
      setRoutine(found);
    })();

    return () => {
      canceled = true;
    };
  }, [routineId]);

  if (!routine) {
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
            Rotina não encontrada.
          </CardContent>
        </Card>
      </div>
    );
  }

  const isMine = routine.ownerHandle === myHandle;
  const label = itemsLabel(routine.category);

  const steps = routine.steps
    .map((s) => ({
      ...s,
      title: s.title.trim(),
      muscleGroup: (s.muscleGroup ?? "").trim() || undefined,
      imageUrl: (s.imageUrl ?? "").trim() || undefined,
      exerciseId: (s.exerciseId ?? "").trim() || undefined,
    }))
    .filter((s) => Boolean(s.title));

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" className="rounded-full">
          <Link to="/perfil">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={async () => {
              const url = window.location.href;
              const res = await shareOrCopyUrl(routine.title, url);
              toast({
                title: res.ok
                  ? res.kind === "share"
                    ? "Compartilhado"
                    : "Link copiado"
                  : "Não foi possível",
                description: res.ok
                  ? res.kind === "share"
                    ? "Enviado para compartilhar."
                    : "Você já pode colar onde quiser."
                  : "Seu navegador não permite compartilhar/copiar agora.",
              });
            }}
          >
            <Share2 className="h-4 w-4" />
            Compartilhar
          </Button>

          {!isMine ? (
            <Button
              type="button"
              className="rounded-full"
              onClick={async () => {
                await copyRoutineDb(routine.id);
                toast({
                  title: "Copiada",
                  description: "A rotina foi adicionada no seu perfil.",
                });
              }}
            >
              <Copy className="h-4 w-4" />
              Copiar
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-xl">{routine.title}</CardTitle>
          <CardDescription>
            Por {routine.ownerName} ({routine.ownerHandle})
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="text-sm font-semibold">{label}</div>

          {steps.length ? (
            <div className="grid gap-2">
              {steps.map((step) => {
                const hasImage = routine.category === "Treino" && Boolean(step.imageUrl);

                return (
                  <div
                    key={step.id}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3",
                      hasImage ? "items-start" : null,
                    )}
                  >
                    {hasImage ? (
                      step.exerciseId ? (
                        <Link
                          to={`/exercicios/${step.exerciseId}`}
                          className="h-16 w-16 shrink-0"
                          aria-label={`Ver detalhes de ${step.title}`}
                        >
                          <img
                            src={step.imageUrl}
                            alt={step.title}
                            className="h-16 w-16 rounded-2xl object-cover ring-1 ring-border/60"
                            loading="lazy"
                          />
                        </Link>
                      ) : (
                        <img
                          src={step.imageUrl}
                          alt={step.title}
                          className="h-16 w-16 rounded-2xl object-cover ring-1 ring-border/60"
                          loading="lazy"
                        />
                      )
                    ) : (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    )}

                    <div className="min-w-0">
                      <div className="text-sm font-medium">{step.title}</div>
                      {routine.category === "Treino" ? (
                        <div className="text-xs text-muted-foreground">
                          {step.muscleGroup ?? "Exercício"}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
              Essa rotina ainda não tem itens.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
