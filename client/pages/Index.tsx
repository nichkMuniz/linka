import * as React from "react";
import {
  Flame,
  HeartHandshake,
  MessageCircle,
  MoreHorizontal,
  Share2,
  Trophy,
  Dumbbell,
  Utensils,
  Droplets,
} from "lucide-react";
import { Link } from "react-router-dom";

import {
  Goal,
  dayLabel,
  getRitmoFitState,
  goalProgressPercent,
  timeAgo,
  updateGoal,
} from "@/lib/ritmofit";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/use-toast";
import { CompleteTodayDialog } from "@/components/complete-today-dialog";

function initials(name: string) {
  const parts = name.trim().split(/\s+/g);
  return (
    (parts[0]?.[0] ?? "?").toUpperCase() +
    (parts[1]?.[0] ?? "").toUpperCase()
  );
}

function CategoryIcon({ category }: { category: Goal["category"] }) {
  if (category === "Treino") return <Dumbbell className="h-6 w-6" />;
  if (category === "Alimentação") return <Utensils className="h-6 w-6" />;
  return <Droplets className="h-6 w-6" />;
}

function PostCard({ goal, onChange }: { goal: Goal; onChange: (g: Goal) => void }) {
  const pct = goalProgressPercent(goal);
  const done = goal.completedDays >= goal.durationDays;
  const isMine = goal.ownerHandle === "@voce" || goal.ownerName === "Você";
  const [open, setOpen] = React.useState(false);

  const bumpIncentive = (key: keyof Goal["incentives"], label: string) => {
    const nextState = updateGoal(goal.id, (g) => ({
      ...g,
      incentives: { ...g.incentives, [key]: g.incentives[key] + 1 },
    }));
    const updated = nextState.goals.find((g) => g.id === goal.id);
    if (updated) onChange(updated);

    toast({
      title: "Incentivo enviado",
      description: `Você marcou “${label}” para ${goal.ownerHandle}.`,
    });
  };

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

    toast({
      title: "Atualizado",
      description:
        next.incrementDays > 0
          ? "Progresso e post atualizados com sucesso."
          : "Post atualizado com sucesso.",
    });
  };

  return (
    <Card className="overflow-hidden border-border/60">
      {/* header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-brand-3 via-brand to-brand-2 text-sm font-semibold text-white shadow-sm ring-1 ring-brand/20">
            {initials(goal.ownerName)}
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{goal.ownerName}</span>
              <span className="text-xs text-muted-foreground">{goal.ownerHandle}</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{timeAgo(goal.createdAt)}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {goal.category} · {goal.visibility}
            </div>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={() =>
            toast({
              title: "Opções",
              description: "No MVP, adicionamos salvar/denunciar/bloquear depois.",
            })
          }
        >
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </div>

      {/* media */}
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {goal.imageDataUrl ? (
          <img
            src={goal.imageDataUrl}
            alt="Imagem da postagem"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-brand/20 via-background to-brand-2/20">
            <div className="absolute inset-0 grid place-items-center">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-background/80 text-brand shadow-sm ring-1 ring-border/60">
                <CategoryIcon category={goal.category} />
              </div>
            </div>
          </div>
        )}
      </div>

      <CardContent className="space-y-4 p-4">
        {/* actions */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => bumpIncentive("apoio", "Te apoio")}
              className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition hover:bg-muted"
            >
              <HeartHandshake className="h-4 w-4 text-brand" />
              Te apoio
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {goal.incentives.apoio}
              </span>
            </button>
            <button
              type="button"
              onClick={() => bumpIncentive("continua", "Continua")}
              className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition hover:bg-muted"
            >
              <Flame className="h-4 w-4 text-orange-500" />
              Continua
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {goal.incentives.continua}
              </span>
            </button>
            <button
              type="button"
              onClick={() => bumpIncentive("orgulho", "Orgulho")}
              className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition hover:bg-muted"
            >
              <Trophy className="h-4 w-4 text-brand-2" />
              Orgulho
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {goal.incentives.orgulho}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() =>
                toast({
                  title: "Comentários",
                  description: "Na Fase 2: comentários + notificações.",
                })
              }
            >
              <MessageCircle className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() =>
                toast({
                  title: "Compartilhar",
                  description: "Na Fase 3: compartilhar no Instagram/WhatsApp.",
                })
              }
            >
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* text */}
        <div className="space-y-1">
          <div className="text-sm">
            <span className="font-semibold">{goal.ownerHandle}</span>{" "}
            <span className="font-semibold">{goal.title}</span>
          </div>
          {goal.caption ? (
            <div className="text-sm text-muted-foreground">{goal.caption}</div>
          ) : null}
        </div>

        {/* progress */}
        <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {goal.completedDays}/{goal.durationDays} {dayLabel(goal.durationDays)} · {pct}%
            </div>
            {isMine ? (
              <>
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
              </>
            ) : null}
          </div>
          <Progress value={pct} className="h-2" />
          <div className="text-[11px] text-muted-foreground">
            Frequência: {goal.frequency} · Duração: {goal.durationDays} {dayLabel(goal.durationDays)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Index() {
  const [goals, setGoals] = React.useState<Goal[]>([]);

  React.useEffect(() => {
    setGoals(getRitmoFitState().goals);
  }, []);

  const updateOne = (next: Goal) => {
    setGoals((prev) => prev.map((g) => (g.id === next.id ? next : g)));
  };

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Feed</h1>
        <Button asChild className="rounded-full">
          <Link to="/postar">Nova postagem</Link>
        </Button>
      </div>

      <section className="grid gap-4">
        {goals.map((goal) => (
          <PostCard key={goal.id} goal={goal} onChange={updateOne} />
        ))}
      </section>
    </div>
  );
}
