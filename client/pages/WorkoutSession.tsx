import * as React from "react";

import { ArrowLeft, Pause, Play, Plus, Trash2, Search, ImagePlus } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import type { MuscleGroup, Routine, WorkoutExercise } from "@/lib/ritmofit";
import {
  addStoryItem,
  createGoal,
  getRoutines,
  uid,
  WORKOUT_EXERCISES,
  WORKOUT_MUSCLE_GROUPS,
} from "@/lib/ritmofit";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

type SetDraft = {
  id: string;
  reps: string;
  weight: string;
  completed: boolean;
  previous?: string;
  restSeconds: number;
};

type StepLog = {
  stepId: string;
  completed: boolean;
  restSeconds: number;
  sets: SetDraft[];
};

type SessionStep = {
  id: string;
  title: string;
  muscleGroup?: string;
  imageUrl?: string;
  exerciseId?: string;
  origin: "routine" | "added";
};

const REST_OPTIONS_SECONDS = [5, 10, 15, 20, 30, 45, 60, 75, 90] as const;

function createEmptySet(restSeconds: number): SetDraft {
  return {
    id: uid("set"),
    reps: "",
    weight: "",
    completed: false,
    previous: "",
    restSeconds,
  };
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatRest(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "00:00";
  return formatTime(totalSeconds);
}

function numberOrZero(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function calcSetVolume(s: SetDraft) {
  if (!s.completed) return 0;
  const reps = numberOrZero(s.reps);
  const weight = numberOrZero(s.weight);
  if (reps <= 0 || weight <= 0) return 0;
  return reps * weight;
}

function calcStepVolume(step: StepLog) {
  return step.sets.reduce((acc, s) => acc + calcSetVolume(s), 0);
}

function norm(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function exerciseMatches(ex: WorkoutExercise, query: string) {
  const q = norm(query.trim());
  if (!q) return true;
  return norm(ex.name).includes(q) || norm(ex.muscleGroup).includes(q);
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
  const navigate = useNavigate();

  const [routine, setRoutine] = React.useState<Routine | null>(null);
  const baseSteps = React.useMemo(() => {
    return (routine?.steps ?? [])
      .map((s) => ({
        id: s.id,
        title: s.title.trim(),
        muscleGroup: (s.muscleGroup ?? "").trim() || undefined,
        imageUrl: (s.imageUrl ?? "").trim() || undefined,
        exerciseId: (s.exerciseId ?? "").trim() || undefined,
        origin: "routine" as const,
      }))
      .filter((s) => Boolean(s.title));
  }, [routine]);

  const stopwatch = useStopwatch();

  const [sessionSteps, setSessionSteps] = React.useState<SessionStep[]>([]);
  const [logs, setLogs] = React.useState<StepLog[]>([]);
  const [activeStepId, setActiveStepId] = React.useState<string | null>(null);

  const [summaryOpen, setSummaryOpen] = React.useState(false);
  const [postToFeed, setPostToFeed] = React.useState(true);
  const [postToStories, setPostToStories] = React.useState(true);

  const [addExerciseOpen, setAddExerciseOpen] = React.useState(false);
  const [addQuery, setAddQuery] = React.useState("");
  const [addMuscleFilter, setAddMuscleFilter] = React.useState<MuscleGroup | "Todos">(
    "Todos",
  );

  const [restRunning, setRestRunning] = React.useState(false);
  const [restSecondsLeft, setRestSecondsLeft] = React.useState(0);
  const [restLabel, setRestLabel] = React.useState("");
  const [restModalOpen, setRestModalOpen] = React.useState(false);

  const [summaryImageDataUrl, setSummaryImageDataUrl] = React.useState<string>("");
  const summaryFileInputRef = React.useRef<HTMLInputElement | null>(null);

  const stepRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  React.useEffect(() => {
    const found = getRoutines().find((r) => r.id === routineId) ?? null;
    setRoutine(found);
  }, [routineId]);

  const formatPrevious = React.useCallback((weight: string, reps: string) => {
    const w = weight.trim();
    const r = reps.trim();
    if (!w || !r) return "";
    const repLabel = Number(r) === 1 ? "rep" : "reps";
    return `${w}kg x ${r} ${repLabel}`;
  }, []);

  const recomputeStepCompletion = React.useCallback((log: StepLog): StepLog => {
    const hasAnySet = log.sets.length > 0;
    const allSetsChecked = hasAnySet && log.sets.every((s) => s.completed);
    return { ...log, completed: allSetsChecked };
  }, []);

  const startRest = React.useCallback((seconds: number, label: string) => {
    const safe = Math.max(0, Math.min(90, Math.floor(seconds)));
    if (safe < 5) return;

    setRestLabel(label);
    setRestSecondsLeft(safe);
    setRestRunning(true);
    setRestModalOpen(true);
  }, []);

  const stopRest = React.useCallback(() => {
    setRestRunning(false);
    setRestSecondsLeft(0);
    setRestLabel("");
    setRestModalOpen(false);
  }, []);

  React.useEffect(() => {
    if (!restRunning) return;
    if (restSecondsLeft <= 0) return;

    const id = window.setInterval(() => {
      setRestSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearInterval(id);
  }, [restRunning, restSecondsLeft]);

  React.useEffect(() => {
    if (!restRunning) return;
    if (restSecondsLeft > 0) return;

    setRestRunning(false);
    setRestLabel("");
    setRestModalOpen(false);
    toast({ title: "Descanso finalizado", description: "Bora pra próxima série." });
  }, [restRunning, restSecondsLeft]);

  React.useEffect(() => {
    if (!routine) return;

    setSessionSteps(baseSteps);

    const nextLogs: StepLog[] = baseSteps.map((s) => ({
      stepId: s.id,
      completed: false,
      restSeconds: 60,
      sets: [createEmptySet(60)],
    }));

    setLogs(nextLogs);
    setActiveStepId(nextLogs[0]?.stepId ?? null);
    setSummaryOpen(false);
    setAddExerciseOpen(false);
    setSummaryImageDataUrl("");
    stopRest();
    stopwatch.reset();
    stopwatch.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routine?.id]);

  React.useEffect(() => {
    if (!activeStepId) return;
    const el = stepRefs.current[activeStepId];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeStepId]);

  const completedCount = logs.filter((s) => s.completed).length;
  const totalCount = logs.length;

  const totalVolume = logs.reduce((acc, s) => acc + calcStepVolume(s), 0);

  const allDone = logs.length > 0 && logs.every((s) => s.completed);
  const coverImage = sessionSteps.find((s) => Boolean(s.imageUrl))?.imageUrl ?? "";

  const estimatedCalories = React.useMemo(() => {
    const minutes = stopwatch.elapsedSeconds / 60;
    if (minutes <= 0) return 0;

    // Estimativa simples (sem peso do usuário): assume 70kg e MET ~ 6 (treino moderado).
    const assumedWeightKg = 70;
    const met = 6;
    return Math.max(0, Math.round((met * 3.5 * assumedWeightKg * minutes) / 200));
  }, [stopwatch.elapsedSeconds]);

  const addExerciseFiltered = React.useMemo(() => {
    return WORKOUT_EXERCISES.filter((ex) => {
      if (addMuscleFilter !== "Todos" && ex.muscleGroup !== addMuscleFilter) return false;
      return exerciseMatches(ex, addQuery);
    });
  }, [addMuscleFilter, addQuery]);

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

      {restSecondsLeft > 0 ? (
        <Card className="border-border/60">
          <CardContent className="flex flex-wrap items-center gap-2 p-4">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-muted-foreground">Descanso</div>
              <div className="truncate text-sm font-semibold">
                {restLabel || "Próxima série"}
              </div>
            </div>

            <div className="text-lg font-semibold tabular-nums">
              {formatRest(restSecondsLeft)}
            </div>

            <div className="flex items-center gap-2">
              {restRunning ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => setRestRunning(false)}
                >
                  <Pause className="h-4 w-4" />
                  Pausar
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setRestRunning(true)}
                >
                  <Play className="h-4 w-4" />
                  Continuar
                </Button>
              )}

              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="rounded-full"
                onClick={stopRest}
              >
                Pular
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

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
              variant="secondary"
              className="ml-auto rounded-full"
              onClick={() => {
                if (!allDone) {
                  toast({
                    title: "Ainda falta",
                    description:
                      "Finalize todas as séries (marque o checkbox de cada série) para encerrar.",
                  });
                  return;
                }

                stopwatch.pause();
                stopRest();
                setSummaryOpen(true);
              }}
            >
              Encerrar
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            Dica: ao marcar uma série como concluída, o descanso inicia automaticamente.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {sessionSteps.map((step) => {
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
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
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
                          {step.origin === "added" ? (
                            <>
                              {" "}· <span className="font-semibold">adicionado</span>
                            </>
                          ) : null}
                        </div>
                      </button>

                      <div className="flex items-start gap-2">
                        <div className="grid gap-1">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Descanso
                          </div>
                          <Select
                            value={String(log.restSeconds)}
                            onValueChange={(v) => {
                              const nextSeconds = Number(v);
                              setLogs((prev) =>
                                prev.map((p) => {
                                  if (p.stepId !== step.id) return p;

                                  return recomputeStepCompletion({
                                    ...p,
                                    restSeconds: nextSeconds,
                                    sets: p.sets.map((set) => ({
                                      ...set,
                                      restSeconds: nextSeconds,
                                    })),
                                  });
                                }),
                              );
                            }}
                          >
                            <SelectTrigger className="h-9 w-[92px] rounded-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {REST_OPTIONS_SECONDS.map((sec) => (
                                <SelectItem key={sec} value={String(sec)}>
                                  {sec}s
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 shrink-0 rounded-full text-destructive hover:text-destructive"
                          aria-label="Remover exercício"
                          onClick={() => {
                            setSessionSteps((prev) => {
                              const idx = prev.findIndex((p) => p.id === step.id);
                              const next = prev.filter((p) => p.id !== step.id);

                              if (activeStepId === step.id) {
                                const nextActive = next[idx] ?? next[idx - 1] ?? null;
                                setActiveStepId(nextActive ? nextActive.id : null);
                              }

                              return next;
                            });

                            setLogs((prev) => prev.filter((p) => p.stepId !== step.id));
                            stopRest();
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2">
                      {log.sets.length ? (
                        <div className="grid gap-2">
                          {log.sets.map((s, idx) => (
                            <div
                              key={s.id}
                              className="rounded-2xl border border-border/60 bg-muted/20 p-3 sm:p-4"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    checked={s.completed}
                                    onCheckedChange={(v) => {
                                      const checked = Boolean(v);

                                      setLogs((prev) => {
                                        const next = prev.map((p) => {
                                          if (p.stepId !== step.id) return p;

                                          const nextSets = p.sets.map((set) => {
                                            if (set.id !== s.id) return set;

                                            const nextPrevious = checked
                                              ? formatPrevious(set.weight, set.reps) || set.previous
                                              : set.previous;

                                            return {
                                              ...set,
                                              completed: checked,
                                              previous: nextPrevious,
                                            };
                                          });

                                          return recomputeStepCompletion({ ...p, sets: nextSets });
                                        });

                                        const updated = next.find((p) => p.stepId === step.id);
                                        if (checked) {
                                          startRest(
                                            s.restSeconds,
                                            `${step.title} · Série ${idx + 1}`,
                                          );
                                        }

                                        if (
                                          checked &&
                                          updated?.completed &&
                                          activeStepId === step.id
                                        ) {
                                          const idxStep = next.findIndex(
                                            (p) => p.stepId === step.id,
                                          );
                                          const nextActive = next
                                            .slice(idxStep + 1)
                                            .find((p) => !p.completed)?.stepId;
                                          setActiveStepId(nextActive ?? null);
                                        }

                                        return next;
                                      });
                                    }}
                                    aria-label={`Marcar série ${idx + 1} como concluída`}
                                  />
                                  <div className="text-sm font-semibold">Série {idx + 1}</div>
                                </div>

                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-10 w-10 rounded-full text-destructive hover:text-destructive"
                                  aria-label="Remover série"
                                  onClick={() => {
                                    setLogs((prev) =>
                                      prev.map((p) => {
                                        if (p.stepId !== step.id) return p;
                                        const nextStep = {
                                          ...p,
                                          sets: p.sets.filter((set) => set.id !== s.id),
                                        };
                                        return recomputeStepCompletion(nextStep);
                                      }),
                                    );
                                    stopRest();
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>

                              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                                <div className="grid gap-1">
                                  <div className="text-xs font-semibold text-muted-foreground">
                                    Reps
                                  </div>
                                  <Input
                                    value={s.reps}
                                    inputMode="numeric"
                                    placeholder="10"
                                    onChange={(e) => {
                                      const nextReps = e.target.value;
                                      setLogs((prev) =>
                                        prev.map((p) => {
                                          if (p.stepId !== step.id) return p;

                                          const nextSets = p.sets.map((set) => {
                                            if (set.id !== s.id) return set;

                                            const next: SetDraft = {
                                              ...set,
                                              reps: nextReps,
                                            };
                                            if (next.completed) {
                                              next.previous =
                                                formatPrevious(next.weight, next.reps) ||
                                                next.previous;
                                            }
                                            return next;
                                          });

                                          return recomputeStepCompletion({
                                            ...p,
                                            sets: nextSets,
                                          });
                                        }),
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
                                        prev.map((p) => {
                                          if (p.stepId !== step.id) return p;

                                          const nextSets = p.sets.map((set) => {
                                            if (set.id !== s.id) return set;

                                            const next: SetDraft = {
                                              ...set,
                                              weight: nextWeight,
                                            };
                                            if (next.completed) {
                                              next.previous =
                                                formatPrevious(next.weight, next.reps) ||
                                                next.previous;
                                            }
                                            return next;
                                          });

                                          return recomputeStepCompletion({
                                            ...p,
                                            sets: nextSets,
                                          });
                                        }),
                                      );
                                    }}
                                  />
                                </div>

                                <div className="grid gap-1 col-span-2 sm:col-span-1">
                                  <div className="text-xs font-semibold text-muted-foreground">
                                    Anterior
                                  </div>
                                  <div
                                    className={cn(
                                      "h-10 rounded-md border border-border bg-background px-3 text-sm leading-10",
                                      !s.previous ? "text-muted-foreground" : null,
                                    )}
                                  >
                                    {s.previous ? s.previous : "-"}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">
                          Ainda sem séries registradas.
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2">
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
                                        createEmptySet(p.restSeconds),
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
                          <Button asChild size="sm" variant="ghost" className="rounded-full">
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

      {/* Add exercise dialog */}
      <Dialog open={addExerciseOpen} onOpenChange={setAddExerciseOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar exercício</DialogTitle>
            <DialogDescription>
              Adicione um exercício extra sem alterar sua rotina salva.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-2">
              <div className="text-sm font-medium">Buscar</div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={addQuery}
                  onChange={(e) => setAddQuery(e.target.value)}
                  placeholder="Ex: supino, costas, bíceps..."
                  className="pl-9"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-medium">Músculos</div>
              <Select
                value={addMuscleFilter}
                onValueChange={(v) => setAddMuscleFilter(v as MuscleGroup | "Todos")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todos</SelectItem>
                  {WORKOUT_MUSCLE_GROUPS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {addExerciseFiltered.length ? (
              <div className="grid gap-2">
                {addExerciseFiltered.slice(0, 40).map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 p-3 text-left hover:bg-muted/30"
                    onClick={() => {
                      const stepId = uid("ws");
                      const nextStep: SessionStep = {
                        id: stepId,
                        title: ex.name,
                        muscleGroup: ex.muscleGroup,
                        imageUrl: ex.imageUrl,
                        exerciseId: ex.id,
                        origin: "added",
                      };

                      setSessionSteps((prev) => [...prev, nextStep]);
                      setLogs((prev) => [
                        ...prev,
                        {
                          stepId,
                          completed: false,
                          restSeconds: 60,
                          sets: [createEmptySet(60)],
                        },
                      ]);

                      setActiveStepId(stepId);
                      setAddExerciseOpen(false);
                      setAddQuery("");
                      setAddMuscleFilter("Todos");

                      toast({
                        title: "Exercício adicionado",
                        description: `${ex.name} entrou na lista do treino atual.`,
                      });
                    }}
                  >
                    <img
                      src={ex.imageUrl}
                      alt={ex.name}
                      className="h-12 w-12 shrink-0 rounded-2xl object-cover ring-1 ring-border/60"
                      loading="lazy"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{ex.name}</div>
                      <div className="text-xs text-muted-foreground">{ex.muscleGroup}</div>
                    </div>
                    <div className="text-xs font-semibold text-brand">Adicionar</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                Nenhum exercício encontrado.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="rounded-full"
              onClick={() => setAddExerciseOpen(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Summary dialog */}
      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resumo do treino</DialogTitle>
            <DialogDescription>
              Revise os resultados e, se quiser, publique no feed e/ou stories.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-1 rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div className="text-sm">
                Tempo:{" "}
                <span className="font-semibold">
                  {formatTime(stopwatch.elapsedSeconds)}
                </span>
              </div>
              <div className="text-sm">
                Exercícios:{" "}
                <span className="font-semibold">
                  {completedCount}/{totalCount}
                </span>
              </div>
              <div className="text-sm">
                Volume total:{" "}
                <span className="font-semibold">{Math.round(totalVolume)} kg</span>
              </div>
              <div className="text-sm">
                Calorias:{" "}
                <span className="font-semibold">~{estimatedCalories} kcal</span>{" "}
                <span className="text-xs text-muted-foreground">(estimativa)</span>
              </div>
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-semibold">Exercícios</div>
              <div className="grid gap-2">
                {sessionSteps.map((s) => {
                  const log = logs.find((l) => l.stepId === s.id);
                  if (!log) return null;

                  const doneSets = log.sets.filter((set) => set.completed);
                  const summarySets = doneSets
                    .map((set) => set.previous || formatPrevious(set.weight, set.reps))
                    .map((t) => t.trim())
                    .filter(Boolean);

                  const preview = summarySets.slice(0, 4).join(" · ");
                  const extra = summarySets.length - 4;

                  return (
                    <div
                      key={s.id}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-background p-4"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{s.title}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {s.muscleGroup ?? "Exercício"} · {doneSets.length}/{log.sets.length} séries
                          {preview ? (
                            <>
                              {" "}· <span className="text-foreground">{preview}</span>
                              {extra > 0 ? (
                                <span className="text-muted-foreground"> · +{extra}</span>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="text-xs font-semibold text-muted-foreground">
                        {Math.round(calcStepVolume(log))} kg
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-2 rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={postToFeed}
                  onCheckedChange={(v) => setPostToFeed(Boolean(v))}
                  aria-label="Publicar no feed"
                />
                <div className="text-sm">Publicar no feed</div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={postToStories}
                  onCheckedChange={(v) => setPostToStories(Boolean(v))}
                  aria-label="Publicar nos stories"
                />
                <div className="text-sm">Publicar nos stories</div>
              </div>
              <div className="text-xs text-muted-foreground">
                O texto do post vai com tempo, volume e calorias (estimativa).
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="rounded-full"
              onClick={() => setSummaryOpen(false)}
            >
              Fechar
            </Button>

            <Button
              type="button"
              className="rounded-full"
              onClick={() => {
                if (!postToFeed && !postToStories) {
                  toast({
                    title: "Selecione onde postar",
                    description: "Marque Feed e/ou Stories para publicar.",
                  });
                  return;
                }

                const summary = `Tempo: ${formatTime(stopwatch.elapsedSeconds)} · Volume: ${Math.round(
                  totalVolume,
                )} kg · Calorias: ~${estimatedCalories} kcal`;

                if (postToFeed) {
                  createGoal({
                    title: `Treino concluído: ${routine.title}`,
                    caption: summary,
                    imageDataUrl: coverImage,
                    category: "Treino",
                    frequency: "Hoje",
                    durationDays: 7,
                    visibility: "Seguidores",
                    attachedRoutineId: routine.id,
                    attachedRoutineTitle: routine.title,
                  });
                }

                if (postToStories) {
                  addStoryItem({
                    imageDataUrl: coverImage,
                    text: `✅ ${routine.title}\n${summary}`,
                  });
                }

                toast({
                  title: "Publicado!",
                  description: "Seu resumo já foi enviado.",
                });

                setSummaryOpen(false);
                navigate("/");
              }}
            >
              Postar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
