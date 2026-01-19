import * as React from "react";
import { Link } from "react-router-dom";

import {
  ArrowUpRight,
  Check,
  Copy,
  Droplets,
  Dumbbell,
  Flame,
  HeartHandshake,
  MessageCircle,
  MoreHorizontal,
  Send,
  Trophy,
  Utensils,
} from "lucide-react";
import { motion } from "framer-motion";

import {
  addComment,
  blockUser,
  copyRoutine,
  Goal,
  dayLabel,
  getRitmoFitState,
  getRoutines,
  goalProgressPercent,
  isBlocked,
  Routine,
  timeAgo,
  updateGoal,
} from "@/lib/ritmofit";
import { StoriesBar } from "@/components/stories-bar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/use-toast";
import { CompleteTodayDialog } from "@/components/complete-today-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
    iconClassName: "text-rose-500",
    ringClassName: "ring-2 ring-rose-500/30",
    hoverClassName: "hover:bg-rose-500/10",
    activeClassName: "bg-rose-500/10 border-rose-500/30",
    badgeActiveClassName: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
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
    iconClassName: "text-emerald-500",
    ringClassName: "ring-2 ring-emerald-500/30",
    hoverClassName: "hover:bg-emerald-500/10",
    activeClassName: "bg-emerald-500/10 border-emerald-500/30",
    badgeActiveClassName:
      "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
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
            "inline-flex shrink-0 items-center gap-2 rounded-full border border-border/60 bg-background/90 px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm backdrop-blur transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
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
  onBlockUser,
}: {
  goal: Goal;
  onChange: (g: Goal) => void;
  onBlockUser: (ownerHandle: string) => void;
}) {
  const pct = goalProgressPercent(goal);
  const done = goal.completedDays >= goal.durationDays;
  const isMine = goal.ownerHandle === "@voce" || goal.ownerName === "Você";

  const imageUrls = React.useMemo(() => {
    const raw = (goal as any).imageDataUrls;
    const urls = Array.isArray(raw)
      ? raw.map((v) => String(v).trim()).filter(Boolean)
      : [];

    // Newest should appear on the left.
    if (urls.length) return urls.slice().reverse();

    const fallback = (goal.imageDataUrl ?? "").trim();
    return fallback ? [fallback] : [];
  }, [goal]);

  const attachedRoutineIds = React.useMemo(() => {
    const raw = (goal as any).attachedRoutineIds;
    if (Array.isArray(raw)) {
      return raw.map((v) => String(v).trim()).filter(Boolean);
    }

    const legacy = (goal.attachedRoutineId ?? "").trim();
    return legacy ? [legacy] : [];
  }, [goal]);

  const attachedRoutineTitles = React.useMemo(() => {
    const raw = (goal as any).attachedRoutineTitles;
    if (Array.isArray(raw)) {
      return raw.map((v) => String(v).trim()).filter(Boolean);
    }

    const legacy = (goal.attachedRoutineTitle ?? "").trim();
    return legacy ? [legacy] : [];
  }, [goal]);

  const attachedRoutinesById = React.useMemo(() => {
    const routines = getRoutines();
    const map = new Map<string, Routine>();
    routines.forEach((r) => map.set(r.id, r));
    return map;
  }, []);

  const attachedRoutineItems = React.useMemo(() => {
    return attachedRoutineIds.map((id, idx) => {
      const routine = attachedRoutinesById.get(id) ?? null;
      const fallbackTitle = attachedRoutineTitles[idx] ?? "";
      const title = (routine?.title ?? fallbackTitle).trim();
      return { id, routine, title };
    });
  }, [attachedRoutineIds, attachedRoutineTitles, attachedRoutinesById]);

  const visibleAttachedRoutines = React.useMemo(
    () => attachedRoutineItems.filter((it) => Boolean(it.title)),
    [attachedRoutineItems],
  );

  const latestAttachedRoutine =
    visibleAttachedRoutines.length > 0
      ? visibleAttachedRoutines[visibleAttachedRoutines.length - 1]
      : null;
  const extraAttachedRoutinesCount = Math.max(
    0,
    visibleAttachedRoutines.length - 1,
  );

  const updatedToday = goal.myProgressToday === todayKey();
  const [open, setOpen] = React.useState(false);
  const [attachedRoutinesOpen, setAttachedRoutinesOpen] = React.useState(false);
  const [pulse, setPulse] = React.useState<IncentiveKind | null>(null);
  const pulseTimer = React.useRef<number | null>(null);
  const [commentsOpen, setCommentsOpen] = React.useState(false);
  const [commentDraft, setCommentDraft] = React.useState("");

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

      if (alreadyGiven) {
        const nextMy = { ...(g.myIncentives ?? {}) };
        delete nextMy[key];
        return {
          ...g,
          incentives: {
            ...g.incentives,
            [key]: Math.max(0, g.incentives[key] - 1),
          },
          myIncentives: nextMy,
        };
      }

      return {
        ...g,
        incentives: { ...g.incentives, [key]: g.incentives[key] + 1 },
        myIncentives: { ...(g.myIncentives ?? {}), [key]: true },
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label="Opções"
            >
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              onClick={() =>
                toast({
                  title: "Denúncia enviada",
                  description:
                    "Obrigado! Vamos revisar este conteúdo (modo MVP).",
                })
              }
            >
              Denunciar post
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                toast({
                  title: "Denúncia enviada",
                  description:
                    "Obrigado! Vamos revisar este perfil (modo MVP).",
                })
              }
            >
              Denunciar perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => {
                blockUser(goal.ownerHandle);
                onBlockUser(goal.ownerHandle);
                toast({
                  title: "Usuário bloqueado",
                  description: `${goal.ownerHandle} não aparecerá mais no seu feed.`,
                });
              }}
            >
              Bloquear {goal.ownerHandle}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* media */}
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {imageUrls.length > 1 ? (
          <>
            <div className="flex h-full w-full snap-x snap-mandatory overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {imageUrls.map((src, idx) => (
                <div
                  key={`${goal.id}_img_${idx}`}
                  className="h-full w-full flex-none snap-start"
                >
                  <img
                    src={src}
                    alt={`Imagem da postagem (${idx + 1}/${imageUrls.length})`}
                    className="h-full w-full object-cover"
                    loading={idx === 0 ? "eager" : "lazy"}
                  />
                </div>
              ))}
            </div>

            <div className="absolute left-3 top-3 rounded-full bg-foreground/50 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
              {imageUrls.length} fotos
            </div>
          </>
        ) : imageUrls[0] ? (
          <img
            src={imageUrls[0]}
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
            <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
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
              aria-label="Abrir comentários"
              onClick={() => {
                setCommentDraft("");
                setCommentsOpen(true);
              }}
            >
              <MessageCircle className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <Dialog open={commentsOpen} onOpenChange={setCommentsOpen}>
          <DialogContent className="w-[calc(100%-2rem)] max-w-lg rounded-2xl p-0 overflow-hidden">
            <DialogHeader className="p-6 pb-3">
              <DialogTitle>Comentários</DialogTitle>
              <DialogDescription>
                {goal.ownerHandle} · {goal.title}
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 pb-4">
              <div className="max-h-[50vh] overflow-auto rounded-2xl border border-border/60 bg-muted/20 p-3">
                {(goal.comments ?? []).length ? (
                  <div className="grid gap-3">
                    {(goal.comments ?? []).map((c) => (
                      <div key={c.id} className="grid gap-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 truncate text-xs font-semibold">
                            {c.authorName}{" "}
                            <span className="font-normal text-muted-foreground">
                              {c.authorHandle}
                            </span>
                          </div>
                          <div className="shrink-0 text-[11px] text-muted-foreground">
                            {timeAgo(c.createdAt)}
                          </div>
                        </div>
                        <div className="text-sm text-foreground">{c.text}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Ainda não tem comentários.
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Input
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  placeholder="Escreva um comentário"
                  className="h-11 rounded-full"
                />
                <Button
                  type="button"
                  size="icon"
                  className="h-11 w-11 rounded-full"
                  aria-label="Enviar comentário"
                  onClick={() => {
                    const text = commentDraft.trim();
                    if (!text) return;

                    const next = addComment(goal.id, { text });
                    const updated = next.goals.find((g) => g.id === goal.id);
                    if (updated) onChange(updated);
                    setCommentDraft("");

                    toast({
                      title: "Comentário publicado",
                      description: "Seu comentário já aparece no post.",
                    });
                  }}
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

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

        {latestAttachedRoutine ? (
          <div className="grid gap-2 rounded-2xl border border-border/60 bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold text-muted-foreground">
                Rotina anexada
              </div>
              {extraAttachedRoutinesCount > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-full px-2 text-[11px] font-semibold text-muted-foreground"
                  onClick={() => setAttachedRoutinesOpen(true)}
                  aria-label={`Ver mais ${extraAttachedRoutinesCount} rotinas anexadas`}
                >
                  {extraAttachedRoutinesCount}+
                </Button>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-2 rounded-2xl bg-background/60 px-3 py-2 ring-1 ring-border/60">
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold">
                  {latestAttachedRoutine.title}
                </div>
                <div className="truncate text-[10px] text-muted-foreground">
                  {latestAttachedRoutine.routine
                    ? `${latestAttachedRoutine.routine.category} · ${latestAttachedRoutine.routine.ownerHandle}`
                    : "Rotina não disponível"}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {latestAttachedRoutine.routine &&
                latestAttachedRoutine.routine.ownerHandle !== "@voce" ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-full"
                    aria-label="Copiar rotina"
                    onClick={() => {
                      copyRoutine(latestAttachedRoutine.routine!.id);
                      toast({
                        title: "Rotina copiada",
                        description: "Agora ela aparece em ‘Minhas’.",
                      });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                ) : null}

                {latestAttachedRoutine.routine ? (
                  <Button
                    asChild
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-full"
                    aria-label="Ver rotina"
                  >
                    <Link to={`/rotinas/${latestAttachedRoutine.routine.id}`}>
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>

            <Dialog
              open={attachedRoutinesOpen}
              onOpenChange={setAttachedRoutinesOpen}
            >
              <DialogContent className="max-w-[min(92vw,560px)] rounded-3xl border-border/60">
                <DialogHeader>
                  <DialogTitle>Rotinas vinculadas</DialogTitle>
                  <DialogDescription>
                    Todas as rotinas anexadas neste post (mais recente
                    primeiro).
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-2">
                  {visibleAttachedRoutines
                    .slice()
                    .reverse()
                    .map((it) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between gap-2 rounded-2xl border border-border/60 bg-muted/10 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">
                            {it.title}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {it.routine
                              ? `${it.routine.category} · ${it.routine.ownerHandle}`
                              : "Rotina não disponível"}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          {it.routine && it.routine.ownerHandle !== "@voce" ? (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-9 w-9 rounded-full"
                              aria-label="Copiar rotina"
                              onClick={() => {
                                copyRoutine(it.routine!.id);
                                toast({
                                  title: "Rotina copiada",
                                  description: "Agora ela aparece em ‘Minhas’.",
                                });
                              }}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          ) : null}

                          {it.routine ? (
                            <Button
                              asChild
                              size="icon"
                              variant="ghost"
                              className="h-9 w-9 rounded-full"
                              aria-label="Ver rotina"
                            >
                              <Link to={`/rotinas/${it.routine.id}`}>
                                <ArrowUpRight className="h-4 w-4" />
                              </Link>
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        ) : null}

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
    const state = getRitmoFitState();
    setGoals(
      state.goals.filter(
        (g) =>
          !state.blockedHandles.includes(g.ownerHandle) && !(g as any).hidden,
      ),
    );
  }, []);

  const updateOne = (next: Goal) => {
    setGoals((prev) => prev.map((g) => (g.id === next.id ? next : g)));
  };

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <StoriesBar />
      <section className="grid gap-4">
        {goals
          .filter((g) => !isBlocked(g.ownerHandle) && !(g as any).hidden)
          .map((goal) => (
            <PostCard
              key={goal.id}
              goal={goal}
              onChange={updateOne}
              onBlockUser={(handle) =>
                setGoals((prev) => prev.filter((p) => p.ownerHandle !== handle))
              }
            />
          ))}
      </section>
    </div>
  );
}
