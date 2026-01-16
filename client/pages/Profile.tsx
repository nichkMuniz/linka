import * as React from "react";
import { Edit3, Image as ImageIcon, Settings } from "lucide-react";
import { Link } from "react-router-dom";

import {
  dayLabel,
  getRitmoFitState,
  Goal,
  goalProgressPercent,
  updateGoal,
} from "@/lib/ritmofit";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CompleteTodayDialog } from "@/components/complete-today-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const [open, setOpen] = React.useState(false);

  const completeToday = (next: {
    caption?: string;
    imageDataUrl?: string;
    incrementDays: number;
  }) => {
    const nextState = updateGoal(goal.id, (g) => {
      const inc = Math.max(0, next.incrementDays);
      const completedDays = Math.min(g.completedDays + inc, g.durationDays);
      return {
        ...g,
        completedDays,
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
        <CardDescription className="line-clamp-2">{goal.caption}</CardDescription>
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
              {goal.completedDays}/{goal.durationDays} {dayLabel(goal.durationDays)} · {pct}%
            </div>
            <Button
              type="button"
              size="sm"
              variant={done ? "secondary" : "default"}
              className={cn("rounded-full", done && "opacity-80")}
              onClick={() => setOpen(true)}
            >
              {done ? "Concluída" : "Concluir hoje"}
            </Button>
            <CompleteTodayDialog
              goal={goal}
              open={open}
              onOpenChange={setOpen}
              onComplete={completeToday}
            />
          </div>
          <Progress value={pct} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Profile() {
  const [posts, setPosts] = React.useState<Goal[]>([]);

  React.useEffect(() => {
    const all = getRitmoFitState().goals;
    setPosts(all.filter((g) => g.ownerHandle === "@voce" || g.ownerName === "Você"));
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

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 rounded-full"
          aria-label="Configurações"
          onClick={() => {
            // MVP: configurações ainda não implementadas
          }}
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex flex-col gap-4 rounded-3xl border border-border/60 bg-gradient-to-br from-brand/10 via-background to-brand-2/10 p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Avatar src={profile.avatarUrl} initials="V" />
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">
                {profile.name}
              </h1>
              <span className="text-sm text-muted-foreground">{profile.handle}</span>
            </div>
            <p className="max-w-xl text-sm text-muted-foreground">{profile.bio}</p>

            <div className="mt-3 grid max-w-sm grid-cols-3 gap-2">
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
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild className="rounded-full gap-2">
            <Link to="/postar">
              <Edit3 className="h-4 w-4" />
              Nova postagem
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">Postagens recentes</h2>
            <p className="text-sm text-muted-foreground">
              Suas rotinas diárias e metas em andamento.
            </p>
          </div>
        </div>

        {posts.length ? (
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-3 rounded-full">
              <TabsTrigger value="all" className="rounded-full">
                Todas
              </TabsTrigger>
              <TabsTrigger value="workouts" className="rounded-full">
                Treinos
              </TabsTrigger>
              <TabsTrigger value="diets" className="rounded-full">
                Dietas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                {posts.map((p) => (
                  <PostMini
                    key={p.id}
                    goal={p}
                    onChange={(next) =>
                      setPosts((prev) => prev.map((g) => (g.id === next.id ? next : g)))
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
          </Tabs>
        ) : (
          <Card className="border-border/60">
            <CardContent className="space-y-3 p-6">
              <div className="text-sm font-medium">Você ainda não postou.</div>
              <p className="text-sm text-muted-foreground">
                Poste sua rotina do dia para receber incentivo dos seus amigos e criar constância.
              </p>
              <Button asChild className="rounded-full">
                <Link to="/postar">Fazer primeira postagem</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
