import * as React from "react";
import * as React from "react";
import {
  Check,
  Dumbbell,
  Droplets,
  Eye,
  EyeOff,
  Image as ImageIcon,
  LayoutGrid,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings,
  Trash2,
  Utensils,
} from "lucide-react";
import { Link } from "react-router-dom";

import {
  copyRoutine,
  dayLabel,
  deleteGoal,
  deleteRoutine,
  getRitmoFitState,
  getRoutines,
  Goal,
  Routine,
  goalProgressPercent,
  updateGoal,
} from "@/lib/ritmofit";
import { cn } from "@/lib/utils";
import { CompleteTodayDialog } from "@/components/complete-today-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { RoutineCard } from "@/components/routine-card";
import { RoutineEditorDialog } from "@/components/routine-editor-dialog";

function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function Avatar({ src, initials }: { src?: string; initials: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt="Foto do perfil"
        className="h-16 w-16 rounded-full object-cover ring-2 ring-brand/20"
      />
    );
  }

  return (
    <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-brand-3 via-brand to-brand-2 text-lg font-semibold text-white shadow-sm ring-2 ring-brand/20">
      {initials}
    </div>
  );
}

function PostMini({
  goal,
  onChange,
}: {
  goal: Goal;
  onChange: (g: Goal) => void;
}) {
  const pct = goalProgressPercent(goal);
  const done = goal.completedDays >= goal.durationDays;
  const updatedToday = goal.myProgressToday === todayKey();
  const [open, setOpen] = React.useState(false);

  const quickProgressOnly = () => {
    if (done) return;

    const key = todayKey();

    const nextState = updateGoal(goal.id, (g) => {
      const already = g.myProgressToday === key;
      if (already) return g;

      return {
        ...g,
        completedDays: Math.min(g.completedDays + 1, g.durationDays),
        myProgressToday: key,
      };
    });

    const updated = nextState.goals.find((g) => g.id === goal.id);
    if (updated) onChange(updated);

    toast({
      title: "Rotina atualizada",
      description: "Marcamos +1 dia na sua rotina hoje.",
    });
  };

  const completeToday = (next: {
    caption?: string;
    imageDataUrl?: string;
    incrementDays: number;
  }) => {
    const key = todayKey();

    const nextState = updateGoal(goal.id, (g) => {
      const inc = Math.max(0, next.incrementDays);
      const completedDays = Math.min(g.completedDays + inc, g.durationDays);
      return {
        ...g,
        completedDays,
        myProgressToday: inc > 0 ? key : g.myProgressToday,
        caption: next.caption !== undefined ? next.caption : g.caption,
        imageDataUrl:
          next.imageDataUrl !== undefined ? next.imageDataUrl : g.imageDataUrl,
      };
    });

    const updated = nextState.goals.find((g) => g.id === goal.id);
    if (updated) onChange(updated);
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{goal.title}</CardTitle>
        <CardDescription className="line-clamp-2">
          {goal.caption}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-brand/10 via-background to-brand-2/10",
            goal.imageDataUrl && "bg-transparent",
          )}
        >
          {goal.imageDataUrl ? (
            <img
              src={goal.imageDataUrl}
              alt="Imagem da postagem"
              className="h-44 w-full object-cover"
            />
          ) : (
            <div className="grid h-44 place-items-center">
              <div className="flex items-center gap-2 rounded-full bg-background/80 px-4 py-2 text-xs text-muted-foreground ring-1 ring-border/60">
                <ImageIcon className="h-4 w-4" />
                Sem foto
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {goal.completedDays}/{goal.durationDays}{" "}
              {dayLabel(goal.durationDays)} · {pct}%
            </div>
            <div className="flex items-center gap-2">
              {!done ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn(
                    "h-9 w-9 rounded-full p-0",
                    updatedToday
                      ? "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-500/90"
                      : null,
                  )}
                  aria-label={
                    updatedToday
                      ? "Rotina já atualizada hoje"
                      : "Atualizar progresso"
                  }
                  onClick={() => {
                    if (updatedToday) {
                      toast({
                        title: "Já foi",
                        description: "Você já atualizou a rotina hoje.",
                      });
                      return;
                    }
                    quickProgressOnly();
                  }}
                >
                  <Check className="h-4 w-4" />
                </Button>
              ) : null}

              <Button
                type="button"
                size="sm"
                variant={done ? "secondary" : "default"}
                className={cn("rounded-full", done && "opacity-80")}
                onClick={() => setOpen(true)}
              >
                {done ? "Concluída" : "Atualizar rotina"}
              </Button>
              <CompleteTodayDialog
                goal={goal}
                open={open}
                onOpenChange={setOpen}
                onComplete={completeToday}
              />
            </div>
          </div>
          <Progress value={pct} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Profile() {
  const [posts, setPosts] = React.useState<Goal[]>([]);
  const [routines, setRoutines] = React.useState<Routine[]>([]);
  const [routineEditorOpen, setRoutineEditorOpen] = React.useState(false);
  const [editingRoutine, setEditingRoutine] = React.useState<Routine | null>(null);

  const refreshRoutines = React.useCallback(() => {
    setRoutines(getRoutines());
  }, []);

  const shareRoutine = React.useCallback(async (routine: Routine) => {
    const url = new URL(`/rotinas/${routine.id}`, window.location.origin).toString();

    const nav = navigator as any;
    if (nav.share) {
      try {
        await nav.share({ title: routine.title, url });
        toast({
          title: "Compartilhado",
          description: "Enviado para compartilhar.",
        });
        return;
      } catch {
        // fallthrough
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Link copiado",
        description: "Você já pode colar onde quiser.",
      });
    } catch {
      toast({
        title: "Não foi possível",
        description: "Seu navegador não permite compartilhar/copiar agora.",
      });
    }
  }, []);

  React.useEffect(() => {
    const state = getRitmoFitState();
    setPosts(
      state.goals.filter((g) => g.ownerHandle === "@voce" || g.ownerName === "Você"),
    );
    setRoutines(state.routines);
  }, []);

  const profile = {
    name: "Você",
    handle: "@voce",
    bio: "Não sou influencer fitness. Sou alguém que cansou de desistir e criou um sistema.",
    avatarUrl: "",
  };

  const stats = {
    posts: posts.length,
    followers: 128,
    following: 93,
  };

  const myRoutines = routines.filter((r) => r.ownerHandle === "@voce");
  const discoverRoutines = routines.filter((r) => r.ownerHandle !== "@voce");

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <div className="relative flex flex-col gap-4 rounded-3xl border border-border/60 bg-gradient-to-br from-brand/10 via-background to-brand-2/10 p-6 md:flex-row md:items-center md:justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4 h-11 w-11 rounded-full"
          aria-label="Configurações"
          onClick={() => {
            // MVP: configurações ainda não implementadas
          }}
        >
          <Settings className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar src={profile.avatarUrl} initials="V" />
            <Button
              asChild
              size="icon"
              className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full shadow-md"
              aria-label="Nova postagem"
            >
              <Link to="/postar">
                <Plus className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">
                {profile.name}
              </h1>
              <span className="text-sm text-muted-foreground">
                {profile.handle}
              </span>
            </div>
            <p className="max-w-xl text-sm text-muted-foreground">
              {profile.bio}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 md:max-w-sm md:gap-4 lg:gap-6">
          <div className="rounded-2xl bg-background/60 p-3 text-center ring-1 ring-border/60">
            <div className="text-sm font-semibold">{stats.posts}</div>
            <div className="text-[11px] text-muted-foreground">Posts</div>
          </div>
          <div className="rounded-2xl bg-background/60 p-3 text-center ring-1 ring-border/60">
            <div className="text-sm font-semibold">{stats.followers}</div>
            <div className="text-[11px] text-muted-foreground">Seguidores</div>
          </div>
          <div className="rounded-2xl bg-background/60 p-3 text-center ring-1 ring-border/60">
            <div className="text-sm font-semibold">{stats.following}</div>
            <div className="text-[11px] text-muted-foreground">Seguindo</div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="grid w-full grid-cols-2 rounded-full bg-muted/40 p-1 shadow-sm ring-1 ring-border/60">
          <TabsTrigger
            value="posts"
            className="rounded-full data-[state=active]:bg-brand data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-brand/30"
          >
            <LayoutGrid className="h-4 w-4" />
            Posts
          </TabsTrigger>
          <TabsTrigger
            value="routines"
            className="rounded-full data-[state=active]:bg-brand data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-brand/30"
          >
            <ListChecks className="h-4 w-4" />
            Rotinas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="mt-4">
          {posts.length ? (
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-4 rounded-full bg-muted/40 p-1 shadow-sm ring-1 ring-border/60">
                <TabsTrigger
                  value="all"
                  className="rounded-full data-[state=active]:bg-brand data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-brand/30"
                  aria-label="Todas"
                  title="Todas"
                >
                  <LayoutGrid className="h-4 w-4" />
                  <span className="sr-only">Todas</span>
                </TabsTrigger>
                <TabsTrigger
                  value="workouts"
                  className="rounded-full data-[state=active]:bg-brand data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-brand/30"
                  aria-label="Treinos"
                  title="Treinos"
                >
                  <Dumbbell className="h-4 w-4" />
                  <span className="sr-only">Treinos</span>
                </TabsTrigger>
                <TabsTrigger
                  value="diets"
                  className="rounded-full data-[state=active]:bg-brand data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-brand/30"
                  aria-label="Dietas"
                  title="Dietas"
                >
                  <Utensils className="h-4 w-4" />
                  <span className="sr-only">Dietas</span>
                </TabsTrigger>
                <TabsTrigger
                  value="habits"
                  className="rounded-full data-[state=active]:bg-brand data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-brand/30"
                  aria-label="Hábitos"
                  title="Hábitos"
                >
                  <Droplets className="h-4 w-4" />
                  <span className="sr-only">Hábitos</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {posts.map((p) => (
                    <PostMini
                      key={p.id}
                      goal={p}
                      onChange={(next) =>
                        setPosts((prev) =>
                          prev.map((g) => (g.id === next.id ? next : g)),
                        )
                      }
                    />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="workouts" className="mt-4">
                {posts.some((p) => p.category === "Treino") ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {posts
                      .filter((p) => p.category === "Treino")
                      .map((p) => (
                        <PostMini
                          key={p.id}
                          goal={p}
                          onChange={(next) =>
                            setPosts((prev) =>
                              prev.map((g) => (g.id === next.id ? next : g)),
                            )
                          }
                        />
                      ))}
                  </div>
                ) : (
                  <Card className="border-border/60">
                    <CardContent className="p-6 text-sm text-muted-foreground">
                      Nenhum treino publicado ainda.
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="diets" className="mt-4">
                {posts.some((p) => p.category === "Alimentação") ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {posts
                      .filter((p) => p.category === "Alimentação")
                      .map((p) => (
                        <PostMini
                          key={p.id}
                          goal={p}
                          onChange={(next) =>
                            setPosts((prev) =>
                              prev.map((g) => (g.id === next.id ? next : g)),
                            )
                          }
                        />
                      ))}
                  </div>
                ) : (
                  <Card className="border-border/60">
                    <CardContent className="p-6 text-sm text-muted-foreground">
                      Nenhuma dieta publicada ainda.
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="habits" className="mt-4">
                {posts.some((p) => p.category === "Hábito") ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {posts
                      .filter((p) => p.category === "Hábito")
                      .map((p) => (
                        <PostMini
                          key={p.id}
                          goal={p}
                          onChange={(next) =>
                            setPosts((prev) =>
                              prev.map((g) => (g.id === next.id ? next : g)),
                            )
                          }
                        />
                      ))}
                  </div>
                ) : (
                  <Card className="border-border/60">
                    <CardContent className="p-6 text-sm text-muted-foreground">
                      Nenhum hábito publicado ainda.
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <Card className="border-border/60">
              <CardContent className="space-y-3 p-6">
                <div className="text-sm font-medium">Você ainda não postou.</div>
                <p className="text-sm text-muted-foreground">
                  Poste sua rotina do dia para receber incentivo dos seus amigos e
                  criar constância.
                </p>
                <Button asChild className="rounded-full">
                  <Link to="/postar">Fazer primeira postagem</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="routines" className="mt-4">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ListChecks className="h-4 w-4 text-brand" />
                  Minhas rotinas
                </CardTitle>
                <CardDescription>
                  Crie rotinas de treino, alimentação ou hábitos para repetir e compartilhar.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="grid gap-4">
              <Tabs defaultValue="Treino" className="w-full">
                <TabsList className="grid w-full grid-cols-3 rounded-full bg-muted/40 p-1 shadow-sm ring-1 ring-border/60">
                  <TabsTrigger
                    value="Treino"
                    className="rounded-full data-[state=active]:bg-brand data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-brand/30"
                    aria-label="Treino"
                    title="Treino"
                  >
                    <Dumbbell className="h-4 w-4" />
                    <span className="sr-only">Treino</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="Alimentação"
                    className="rounded-full data-[state=active]:bg-brand data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-brand/30"
                    aria-label="Alimentação"
                    title="Alimentação"
                  >
                    <Utensils className="h-4 w-4" />
                    <span className="sr-only">Alimentação</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="Hábito"
                    className="rounded-full data-[state=active]:bg-brand data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-brand/30"
                    aria-label="Hábito"
                    title="Hábito"
                  >
                    <Droplets className="h-4 w-4" />
                    <span className="sr-only">Hábito</span>
                  </TabsTrigger>
                </TabsList>

                {(["Treino", "Alimentação", "Hábito"] as const).map((cat) => {
                  const mine = myRoutines.filter((r) => r.category === cat);
                  const discover = discoverRoutines.filter((r) => r.category === cat);

                  return (
                    <TabsContent key={cat} value={cat} className="mt-4">
                      <Tabs defaultValue="mine" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 rounded-full bg-muted/40 p-1 shadow-sm ring-1 ring-border/60">
                          <TabsTrigger
                            value="mine"
                            className="rounded-full data-[state=active]:bg-brand data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-brand/30"
                          >
                            Minhas
                          </TabsTrigger>
                          <TabsTrigger
                            value="discover"
                            className="rounded-full data-[state=active]:bg-brand data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-brand/30"
                          >
                            Réplicas
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="mine" className="mt-4 space-y-4">
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              className="w-full rounded-full sm:w-auto"
                              onClick={() => {
                                setEditingRoutine(null);
                                setRoutineEditorOpen(true);
                              }}
                            >
                              <Plus className="h-4 w-4" />
                              Nova rotina
                            </Button>
                          </div>

                          {mine.length ? (
                            <div className="grid gap-3">
                              {mine.map((r) => (
                                <RoutineCard
                                  key={r.id}
                                  routine={r}
                                  variant="mine"
                                  startHref={
                                    r.category === "Treino" &&
                                    r.steps.some((s) => Boolean(s.title.trim()))
                                      ? `/rotinas/${r.id}/iniciar`
                                      : undefined
                                  }
                                  onShare={() => shareRoutine(r)}
                                  onEdit={() => {
                                    setEditingRoutine(r);
                                    setRoutineEditorOpen(true);
                                  }}
                                  onDelete={() => {
                                    deleteRoutine(r.id);
                                    refreshRoutines();
                                    toast({
                                      title: "Rotina excluída",
                                      description: "Removemos essa rotina do seu perfil.",
                                    });
                                  }}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                              Você ainda não tem rotinas de {cat.toLowerCase()}.
                            </div>
                          )}
                        </TabsContent>

                        <TabsContent value="discover" className="mt-4">
                          {discover.length ? (
                            <div className="grid gap-3">
                              {discover.slice(0, 10).map((r) => (
                                <RoutineCard
                                  key={r.id}
                                  routine={r}
                                  variant="discover"
                                  onShare={() => shareRoutine(r)}
                                  onCopy={() => {
                                    copyRoutine(r.id);
                                    refreshRoutines();
                                    toast({
                                      title: "Rotina copiada",
                                      description: "Agora ela aparece em ‘Minhas’.",
                                    });
                                  }}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                              Ainda não há rotinas públicas de {cat.toLowerCase()} para copiar.
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>
                    </TabsContent>
                  );
                })}
              </Tabs>
            </CardContent>
          </Card>

          <RoutineEditorDialog
            open={routineEditorOpen}
            onOpenChange={setRoutineEditorOpen}
            routine={editingRoutine}
            onSaved={() => {
              refreshRoutines();
              toast({
                title: "Rotina salva",
                description: "Sua rotina já está no seu perfil.",
              });
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
