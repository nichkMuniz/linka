import * as React from "react";
import { Dumbbell, Utensils, Droplets } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { PostGoalInfo, Routine } from "@/lib/ritmofit-db";

function CategoryIcon({ category }: { category: PostGoalInfo["category"] }) {
  if (category === "Treino") return <Dumbbell className="h-5 w-5" />;
  if (category === "Alimentação") return <Utensils className="h-5 w-5" />;
  return <Droplets className="h-5 w-5" />;
}

function dayLabel(days: 7 | 21 | 30) {
  return days === 7 ? "dias" : days === 21 ? "semanas" : "mês";
}

function goalProgressPercent(goal: PostGoalInfo): number {
  const pct = Math.round(
    (goal.completedDays / goal.durationDays) * 100,
  );
  return Math.min(100, Math.max(0, pct));
}

export function GoalDetailsModal({
  goalInfo,
  linkedRoutines,
  children,
}: {
  goalInfo: PostGoalInfo;
  linkedRoutines?: Routine[];
  children?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const pct = goalProgressPercent(goalInfo);
  const done = goalInfo.completedDays >= goalInfo.durationDays;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="rounded-lg bg-muted p-2">
              <CategoryIcon category={goalInfo.category} />
            </div>
            {goalInfo.title}
          </DialogTitle>
          <DialogDescription>
            {goalInfo.caption}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress section */}
          <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-sm font-medium">Progresso</div>
                <div className="text-xs text-muted-foreground">
                  {goalInfo.completedDays}/{goalInfo.durationDays}{" "}
                  {dayLabel(goalInfo.durationDays)} · {pct}%
                </div>
              </div>
              {done && (
                <div className="rounded-lg bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Concluída
                </div>
              )}
            </div>
            <Progress value={pct} className="h-3" />
            <div className="text-[11px] text-muted-foreground">
              Frequência: {goalInfo.frequency} · Duração: {goalInfo.durationDays}{" "}
              {dayLabel(goalInfo.durationDays)}
            </div>
          </div>

          {/* Goal details grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">
                Categoria
              </div>
              <div className="text-sm font-medium">{goalInfo.category}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">
                Visibilidade
              </div>
              <div className="text-sm font-medium">{goalInfo.visibility}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">
                Frequência
              </div>
              <div className="text-sm font-medium">{goalInfo.frequency}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">
                Duração
              </div>
              <div className="text-sm font-medium">
                {goalInfo.durationDays} {dayLabel(goalInfo.durationDays)}
              </div>
            </div>
          </div>

          {/* Linked routines section */}
          {linkedRoutines && linkedRoutines.length > 0 ? (
            <div className="space-y-3">
              <div className="text-sm font-semibold">
                Rotinas Vinculadas ({linkedRoutines.length})
              </div>
              <div className="space-y-3">
                {linkedRoutines.map((routine) => (
                  <div
                    key={routine.id}
                    className="rounded-lg border border-border/60 bg-muted/20 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="font-medium">{routine.title}</div>
                        {routine.description && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {routine.description}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 rounded-lg bg-muted px-2.5 py-1 text-xs font-semibold">
                        {routine.steps.length} passo{routine.steps.length !== 1 ? "s" : ""}
                      </div>
                    </div>

                    {/* Routine steps */}
                    {routine.steps.length > 0 && (
                      <div className="mt-3 space-y-2 border-t border-border/30 pt-3">
                        {routine.steps.map((step, idx) => (
                          <div key={step.id} className="text-sm">
                            <div className="flex gap-2">
                              <div className="shrink-0 font-semibold text-muted-foreground">
                                {idx + 1}.
                              </div>
                              <div className="flex-1">
                                <div className="font-medium">{step.title}</div>
                                {step.detail && (
                                  <div className="text-xs text-muted-foreground">
                                    {step.detail}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border/50 bg-muted/20 p-4 text-center text-sm text-muted-foreground">
              Nenhuma rotina vinculada.
            </div>
          )}

          <Button onClick={() => setOpen(false)} className="w-full rounded-lg">
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
