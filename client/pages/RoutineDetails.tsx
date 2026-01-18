import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Copy, Share2 } from "lucide-react";

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

function RoutineStepRow({ idx, title, detail }: { idx: number; title: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-background ring-1 ring-border/60">
        <span className="text-xs font-semibold">{idx}</span>
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title || `Passo ${idx}`}</div>
        {detail ? (
          <div className="mt-1 text-sm text-muted-foreground">{detail}</div>
        ) : null}
      </div>
    </div>
  );
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
          {routine.description ? (
            <div className="text-sm text-muted-foreground">{routine.description}</div>
          ) : null}

          <div className="grid gap-3">
            {routine.steps.length ? (
              routine.steps.map((s, idx) => (
                <RoutineStepRow
                  key={s.id}
                  idx={idx + 1}
                  title={s.title}
                  detail={s.detail}
                />
              ))
            ) : (
              <div className="text-sm text-muted-foreground">
                Essa rotina ainda não tem passos.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
