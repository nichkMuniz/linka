import { Copy, Pencil, Share2, Trash2, Eye } from "lucide-react";
import { Link } from "react-router-dom";

import type { Routine } from "@/lib/ritmofit";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const categoryMeta: Record<
  Routine["category"],
  { label: string; className: string; itemsLabel: string }
> = {
  Treino: { label: "Treino", className: "bg-brand text-white", itemsLabel: "Exercícios" },
  "Alimentação": {
    label: "Alimentação",
    className: "bg-brand-2 text-white",
    itemsLabel: "Comidas",
  },
  "Hábito": {
    label: "Hábito",
    className: "bg-emerald-600 text-white",
    itemsLabel: "Hábitos",
  },
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
  const items = routine.steps
    .map((s) => s.title.trim())
    .filter(Boolean);

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
                {items.length} {meta.itemsLabel.toLowerCase()}
              </span>
              {routine.copiedFromRoutineId ? (
                <span className="text-[11px] text-muted-foreground">(copiada)</span>
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
      </CardHeader>

      <CardContent className="pt-0">
        {items.length ? (
          <div className="grid gap-2">
            <div className="text-xs font-semibold text-muted-foreground">
              {meta.itemsLabel}
            </div>
            <div className="flex flex-wrap gap-2">
              {items.slice(0, 6).map((name) => (
                <span
                  key={name}
                  className="rounded-full bg-muted/40 px-3 py-1 text-xs text-foreground ring-1 ring-border/60"
                >
                  {name}
                </span>
              ))}
              {items.length > 6 ? (
                <span className="rounded-full bg-muted/20 px-3 py-1 text-xs text-muted-foreground ring-1 ring-border/60">
                  +{items.length - 6}
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
            Sem itens ainda. Edite para adicionar.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
