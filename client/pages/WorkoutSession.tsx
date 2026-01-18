import * as React from "react";

import { ArrowLeft, Pause, Play, RotateCcw, Plus, Trash2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import type { Routine } from "@/lib/ritmofit";
import { getRoutines, uid } from "@/lib/ritmofit";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";

type SetDraft = {
  id: string;
  reps: string;
  weight: string;
};

type StepLog = {
  stepId: string;
  completed: boolean;
  sets: SetDraft[];
};

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function numberOrZero(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function calcSetVolume(s: SetDraft) {
  const reps = numberOrZero(s.reps);
  const weight = numberOrZero(s.weight);
  if (reps <= 0 || weight <= 0) return 0;
  return reps * weight;
}

function calcStepVolume(step: StepLog) {
  return step.sets.reduce((acc, s) => acc + calcSetVolume(s), 0);
}

function useStopwatch() {
  const [running, setRunning] = React.useState(false);
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);

  React.useEffect(() => {
    if (!running) return;

    const id = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(id);
  }, [running]);

  return {
    running,
    elapsedSeconds,
    start: () => setRunning(true),
    pause: () => setRunning(false),
    reset: () => {
      setRunning(false);
      setElapsedSeconds(0);
    },
  };
}

export default function WorkoutSession() {
  const { routineId } = useParams();

  const [routine, setRoutine] = React.useState<Routine | null>(null);
  const steps = React.useMemo(() => {
    return (routine?.steps ?? [])
      .map((s) => ({
        ...s,
        title: s.title.trim(),
        muscleGroup: (s.muscleGroup ?? "").trim() || undefined,
        imageUrl: (s.imageUrl ?? "").trim() || undefined,
        exerciseId: (s.exerciseId ?? "").trim() || undefined,
      }))
      .filter((s) => Boolean(s.title));
  }, [routine]);

  const stopwatch = useStopwatch();

  const [logs, setLogs] = React.useState<StepLog[]>([]);
  const [activeStepId, setActiveStepId] = React.useState<string | null>(null);

  const stepRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  React.useEffect(() => {
    const found = getRoutines().find((r) => r.id === routineId) ?? null;
    setRoutine(found);
  }, [routineId]);

  React.useEffect(() => {
    if (!routine) return;

    const nextLogs: StepLog[] = steps.map((s) => ({
      stepId: s.id,
      completed: false,
      sets: [],
    }));

    setLogs(nextLogs);
    setActiveStepId(nextLogs[0]?.stepId ?? null);
    stopwatch.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routine?.id]);

  React.useEffect(() => {
    if (!activeStepId) return;
    const el = stepRefs.current[activeStepId];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeStepId]);

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

  if (routine.category !== "Treino") {
    return (
      <div className="mx-auto grid w-full max-w-3xl gap-4">
        <Button asChild variant="ghost" className="w-fit rounded-full">
          <Link to={`/rotinas/${routine.id}`}>
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">{routine.title}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No MVP, o modo “iniciar rotina” (timer + séries/carga) está disponível
            apenas para rotinas do tipo <span className="font-semibold">Treino</span>.
          </CardContent>
        </Card>
      </div>
    );
  }

  const completedCount = logs.filter((s) => s.completed).length;
  const totalCount = logs.length;

  const totalVolume = logs.reduce((acc, s) => acc + calcStepVolume(s), 0);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" className="rounded-full">
          <Link to={`/rotinas/${routine.id}`}>
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>

        <div className="text-right">
          <div className="text-xs text-muted-foreground">Progresso</div>
          <div className="text-sm font-semibold">
            {completedCount}/{totalCount} exercícios
          </div>
        </div>
      </div>

      <Card className="border-border/60">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">{routine.title}</CardTitle>
          <div className="text-xs text-muted-foreground">
            Tempo: <span className="font-semibold">{formatTime(stopwatch.elapsedSeconds)}</span>
            {totalVolume > 0 ? (
              <>
                {" "}· Volume: <span className="font-semibold">{Math.round(totalVolume)} kg</span>
              </>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {stopwatch.running ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={stopwatch.pause}
              >
                <Pause className="h-4 w-4" />
                Pausar
              </Button>
            ) : (
              <Button type="button" className="rounded-full" onClick={stopwatch.start}>
                <Play className="h-4 w-4" />
                Iniciar
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              className="rounded-full"
              onClick={stopwatch.reset}
            >
              <RotateCcw className="h-4 w-4" />
              Zerar
            </Button>

            <Button
              type="button"
              variant="secondary"
              className="ml-auto rounded-full"
              onClick={() => {
                stopwatch.pause();
                toast({
                  title: "Treino encerrado",
                  description: "Seu registro ficou nessa tela. Você pode iniciar de novo quando quiser.",
                });
              }}
            >
              Encerrar
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            Dica: marque o checkbox quando finalizar um exercício — o foco vai para o próximo.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {steps.map((step) => {
          const log = logs.find((l) => l.stepId === step.id);
          if (!log) return null;

          const isActive = activeStepId === step.id;
          const stepVolume = calcStepVolume(log);

          return (
            <Card
              key={step.id}
              ref={(el) => {
                stepRefs.current[step.id] = el;
              }}
              className={cn(
                "border-border/60 transition-colors",
                isActive ? "ring-2 ring-brand/30" : null,
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={log.completed}
                    onCheckedChange={(v) => {
                      const checked = Boolean(v);

                      setLogs((prev) => {
                        const next = prev.map((p) =>
                          p.stepId === step.id ? { ...p, completed: checked } : p,
                        );

                        if (checked && activeStepId === step.id) {
                          const idx = next.findIndex((p) => p.stepId === step.id);
                          const nextActive = next
                            .slice(idx + 1)
                            .find((p) => !p.completed)?.stepId;
                          setActiveStepId(nextActive ?? null);
                        }

                        return next;
                      });
                    }}
                    className="mt-1"
                    aria-label={`Marcar ${step.title} como concluído`}
                  />

                  {step.imageUrl ? (
                    <img
                      src={step.imageUrl}
                      alt={step.title}
                      className="h-14 w-14 shrink-0 rounded-2xl object-cover ring-1 ring-border/60"
                      loading="lazy"
                      onClick={() => setActiveStepId(step.id)}
                    />
                  ) : null}

                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => setActiveStepId(step.id)}
                    >
                      <div
                        className={cn(
                          "truncate text-sm font-semibold",
                          log.completed ? "line-through text-muted-foreground" : null,
                        )}
                      >
                        {step.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {step.muscleGroup ?? "Exercício"}
                        {stepVolume > 0 ? (
                          <>
                            {" "}· Volume: {Math.round(stepVolume)} kg
                          </>
                        ) : null}
                      </div>
                    </button>

                    <div className="mt-3 grid gap-2">
                      {log.sets.length ? (
                        <div className="grid gap-2">
                          {log.sets.map((s, idx) => (
                            <div
                              key={s.id}
                              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2 rounded-2xl border border-border/60 bg-muted/20 p-3"
                            >
                              <div className="grid gap-1">
                                <div className="text-xs font-semibold text-muted-foreground">
                                  Série {idx + 1} · Reps
                                </div>
                                <Input
                                  value={s.reps}
                                  inputMode="numeric"
                                  placeholder="10"
                                  onChange={(e) => {
                                    const nextReps = e.target.value;
                                    setLogs((prev) =>
                                      prev.map((p) =>
                                        p.stepId === step.id
                                          ? {
                                              ...p,
                                              sets: p.sets.map((set) =>
                                                set.id === s.id
                                                  ? { ...set, reps: nextReps }
                                                  : set,
                                              ),
                                            }
                                          : p,
                                      ),
                                    );
                                  }}
                                />
                              </div>

                              <div className="grid gap-1">
                                <div className="text-xs font-semibold text-muted-foreground">
                                  Carga (kg)
                                </div>
                                <Input
                                  value={s.weight}
                                  inputMode="decimal"
                                  placeholder="20"
                                  onChange={(e) => {
                                    const nextWeight = e.target.value;
                                    setLogs((prev) =>
                                      prev.map((p) =>
                                        p.stepId === step.id
                                          ? {
                                              ...p,
                                              sets: p.sets.map((set) =>
                                                set.id === s.id
                                                  ? { ...set, weight: nextWeight }
                                                  : set,
                                              ),
                                            }
                                          : p,
                                      ),
                                    );
                                  }}
                                />
                              </div>

                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-10 w-10 rounded-full text-destructive hover:text-destructive"
                                aria-label="Remover série"
                                onClick={() => {
                                  setLogs((prev) =>
                                    prev.map((p) =>
                                      p.stepId === step.id
                                        ? {
                                            ...p,
                                            sets: p.sets.filter((set) => set.id !== s.id),
                                          }
                                        : p,
                                    ),
                                  );
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">
                          Ainda sem séries registradas.
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          onClick={() => {
                            setLogs((prev) =>
                              prev.map((p) =>
                                p.stepId === step.id
                                  ? {
                                      ...p,
                                      sets: [
                                        ...p.sets,
                                        { id: uid("set"), reps: "", weight: "" },
                                      ],
                                    }
                                  : p,
                              ),
                            );
                          }}
                        >
                          <Plus className="h-4 w-4" />
                          Adicionar série
                        </Button>

                        {step.exerciseId ? (
                          <Button
                            asChild
                            size="sm"
                            variant="ghost"
                            className="rounded-full"
                          >
                            <Link to={`/exercicios/${step.exerciseId}`}>Ver detalhes</Link>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
