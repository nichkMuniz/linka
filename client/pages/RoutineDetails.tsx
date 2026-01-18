import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Copy, Share2, CheckCircle2 } from "lucide-react";

import type { Routine } from "@/lib/ritmofit";
import { copyRoutine, getRoutines } from "@/lib/ritmofit";
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

  React.useEffect(() => {
    const found = getRoutines().find((r) => r.id === routineId) ?? null;
    setRoutine(found);
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

  const isMine = routine.ownerHandle === "@voce";
  const label = itemsLabel(routine.category);

  const items = routine.steps
    .map((s) => s.title.trim())
    .filter(Boolean);

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
              onClick={() => {
                copyRoutine(routine.id);
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

          {items.length ? (
            <div className="grid gap-2">
              {items.map((name) => (
                <div
                  key={name}
                  className="flex items-center gap-2 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <div className="text-sm">{name}</div>
                </div>
              ))}
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
