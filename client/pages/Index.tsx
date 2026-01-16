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
  Check,
} from "lucide-react";
import { motion } from "framer-motion";

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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/g);
  return (
    (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase()
  );
}

function CategoryIcon({ category }: { category: Goal["category"] }) {
  if (category === "Treino") return <Dumbbell className="h-6 w-6" />;
  if (category === "Alimentação") return <Utensils className="h-6 w-6" />;
  return <Droplets className="h-6 w-6" />;
}

type IncentiveKind = keyof Goal["incentives"];

const incentiveMeta: Record<
  IncentiveKind,
  {
    label: string;
    Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    iconClassName: string;
    ringClassName: string;
    hoverClassName: string;
    activeClassName: string;
    badgeActiveClassName: string;
  }
> = {
  apoio: {
    label: "Te apoio",
    Icon: HeartHandshake,
    iconClassName: "text-brand",
    ringClassName: "ring-2 ring-brand/35",
    hoverClassName: "hover:bg-brand/10",
    activeClassName: "bg-brand/10 border-brand/30",
    badgeActiveClassName: "bg-brand/15 text-brand",
  },
  continua: {
    label: "Continua",
    Icon: Flame,
    iconClassName: "text-orange-500",
    ringClassName: "ring-2 ring-orange-500/30",
    hoverClassName: "hover:bg-orange-500/10",
    activeClassName: "bg-orange-500/10 border-orange-500/30",
    badgeActiveClassName:
      "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  },
  orgulho: {
    label: "Orgulho",
    Icon: Trophy,
    iconClassName: "text-brand-2",
    ringClassName: "ring-2 ring-brand-2/30",
    hoverClassName: "hover:bg-brand-2/10",
    activeClassName: "bg-brand-2/10 border-brand-2/30",
    badgeActiveClassName: "bg-brand-2/15 text-brand-2",
  },
};

function IncentiveButton({
  kind,
  count,
  active,
  pulsing,
  onClick,
}: {
  kind: IncentiveKind;
  count: number;
  active: boolean;
  pulsing: boolean;
  onClick: () => void;
}) {
  const meta = incentiveMeta[kind];
  const Icon = meta.Icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          type="button"
          aria-label={meta.label}
          onClick={onClick}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.92 }}
          animate={pulsing ? { scale: [1, 1.08, 1] } : { scale: 1 }}
          transition={{ duration: 0.28 }}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/90 px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm backdrop-blur transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            meta.hoverClassName,
            active ? cn(meta.activeClassName, meta.ringClassName) : null,
          )}
        >
          <Icon
            className={cn(
              "h-4 w-4 transition-colors",
              active ? meta.iconClassName : "text-muted-foreground",
            )}
            fill={active ? "currentColor" : "none"}
          />
          <span
            className={cn(
              "rounded-full bg-muted/60 px-2 py-0.5 text-[11px]",
              active ? meta.badgeActiveClassName : "text-muted-foreground",
            )}
          >
            {count}
          </span>
        </motion.button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {meta.label}
      </TooltipContent>
    </Tooltip>
  );
}

function PostCard({
  goal,
  onChange,
}: {
  goal: Goal;
  onChange: (g: Goal) => void;
}) {
  const pct = goalProgressPercent(goal);
  const done = goal.completedDays >= goal.durationDays;
  const isMine = goal.ownerHandle === "@voce" || goal.ownerName === "Você";
  const updatedToday = goal.myProgressToday === todayKey();
  const [open, setOpen] = React.useState(false);
  const [pulse, setPulse] = React.useState<IncentiveKind | null>(null);
  const pulseTimer = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
    };
  }, []);

  const bumpIncentive = (key: IncentiveKind) => {
    setPulse(key);
    if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
    pulseTimer.current = window.setTimeout(() => setPulse(null), 450);

    const nextState = updateGoal(goal.id, (g) => {
      const alreadyGiven = Boolean(g.myIncentives?.[key]);
      if (alreadyGiven) return g;

      return {
        ...g,
        incentives: { ...g.incentives, [key]: g.incentives[key] + 1 },
        myIncentives: { ...g.myIncentives, [key]: true },
      };
    });

    const updated = nextState.goals.find((g) => g.id === goal.id);
    if (updated) onChange(updated);
  };

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
              <span className="text-xs text-muted-foreground">
                {goal.ownerHandle}
              </span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">
                {timeAgo(goal.createdAt)}
              </span>
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
              description:
                "No MVP, adicionamos salvar/denunciar/bloquear depois.",
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
          <TooltipProvider delayDuration={150}>
            <div className="flex flex-wrap gap-2">
              <IncentiveButton
                kind="apoio"
                count={goal.incentives.apoio}
                active={Boolean(goal.myIncentives?.apoio)}
                pulsing={pulse === "apoio"}
                onClick={() => bumpIncentive("apoio")}
              />
              <IncentiveButton
                kind="continua"
                count={goal.incentives.continua}
                active={Boolean(goal.myIncentives?.continua)}
                pulsing={pulse === "continua"}
                onClick={() => bumpIncentive("continua")}
              />
              <IncentiveButton
                kind="orgulho"
                count={goal.incentives.orgulho}
                active={Boolean(goal.myIncentives?.orgulho)}
                pulsing={pulse === "orgulho"}
                onClick={() => bumpIncentive("orgulho")}
              />
            </div>
          </TooltipProvider>

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
              {goal.completedDays}/{goal.durationDays}{" "}
              {dayLabel(goal.durationDays)} · {pct}%
            </div>
            {isMine ? (
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
            ) : null}
          </div>
          <Progress value={pct} className="h-2" />
          <div className="text-[11px] text-muted-foreground">
            Frequência: {goal.frequency} · Duração: {goal.durationDays}{" "}
            {dayLabel(goal.durationDays)}
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
      <section className="grid gap-4">
        {goals.map((goal) => (
          <PostCard key={goal.id} goal={goal} onChange={updateOne} />
        ))}
      </section>
    </div>
  );
}
