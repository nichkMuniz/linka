import * as React from "react";
import { Copy, Pencil, Share2, Trash2, Eye } from "lucide-react";
import { Link } from "react-router-dom";

import type { Routine } from "@/lib/ritmofit";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const categoryMeta: Record<
  Routine["category"],
  { label: string; className: string }
> = {
  Treino: { label: "Treino", className: "bg-brand text-white" },
  "Alimentação": { label: "Alimentação", className: "bg-brand-2 text-white" },
  "Hábito": { label: "Hábito", className: "bg-emerald-600 text-white" },
};

export function RoutineCard({
  routine,
  variant,
  onCopy,
  onEdit,
  onDelete,
  onShare,
  className,
}: {
  routine: Routine;
  variant: "mine" | "discover";
  onCopy?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  className?: string;
}) {
  const meta = categoryMeta[routine.category];

  return (
    <Card className={cn("border-border/60", className)}>
      <CardHeader className="space-y-2 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="line-clamp-1 text-base">
              {routine.title}
            </CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge className={cn("rounded-full", meta.className)}>
                {meta.label}
              </Badge>
              <span className="text-[11px] text-muted-foreground">
                {routine.steps.length} passo{routine.steps.length === 1 ? "" : "s"}
              </span>
              {routine.copiedFromRoutineId ? (
                <span className="text-[11px] text-muted-foreground">
                  (copiada)
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              asChild
              size="icon"
              variant="ghost"
              className="h-9 w-9 rounded-full"
              aria-label="Ver rotina"
            >
              <Link to={`/rotinas/${routine.id}`}>
                <Eye className="h-4 w-4" />
              </Link>
            </Button>

            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 rounded-full"
              aria-label="Compartilhar"
              onClick={onShare}
            >
              <Share2 className="h-4 w-4" />
            </Button>

            {variant === "discover" ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9 rounded-full"
                aria-label="Copiar rotina"
                onClick={onCopy}
              >
                <Copy className="h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 rounded-full"
                  aria-label="Editar rotina"
                  onClick={onEdit}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 rounded-full text-destructive hover:text-destructive"
                  aria-label="Excluir rotina"
                  onClick={onDelete}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {routine.description ? (
          <div className="line-clamp-2 text-sm text-muted-foreground">
            {routine.description}
          </div>
        ) : null}
      </CardHeader>

      {routine.steps.length ? (
        <CardContent className="pt-0">
          <div className="grid gap-2">
            {routine.steps.slice(0, 3).map((s, idx) => (
              <div
                key={s.id}
                className="flex items-start gap-2 rounded-2xl bg-muted/30 p-3"
              >
                <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-background ring-1 ring-border/60">
                  <span className="text-[11px] font-semibold">{idx + 1}</span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{s.title}</div>
                  {s.detail ? (
                    <div className="line-clamp-2 text-sm text-muted-foreground">
                      {s.detail}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {routine.steps.length > 3 ? (
              <div className="text-xs text-muted-foreground">
                +{routine.steps.length - 3} passo{routine.steps.length - 3 === 1 ? "" : "s"}
              </div>
            ) : null}
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}
