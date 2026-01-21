import * as React from "react";
import { CheckCircle2, Circle, Crown, Medal, Zap } from "lucide-react";

import { Goal, type Routine } from "@/lib/ritmofit";
import { getMyProfileDb, getRitmoFitStateDb } from "@/lib/ritmofit-db";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

type RankEntry = {
  name: string;
  handle: string;
  days: number;
  goals: number;
  routines: number;
  commentsWritten: number;
  incentivesReceived: number;
  incentivesGiven: number;
  streakDays: number;
  xp: number;
};

const XP_PER_DAY = 50;
const XP_PER_POST = 200;
const XP_PER_ROUTINE_CREATED = 300;
const XP_PER_ROUTINE_COPIED = 120;
const XP_PER_COMMENT = 10;
const XP_PER_INCENTIVE_GIVEN = 2;
const XP_PER_INCENTIVE_RECEIVED = 1;

const XP_PER_LEVEL = 500;

function initials(name: string) {
  const parts = name.trim().split(/\s+/g);
  return (
    (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase()
  );
}

function dayKeyFromIso(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysForGoals(goals: Goal[]) {
  // MVP: dias concluídos em todas as rotinas
  return goals.reduce((acc, g) => acc + (g.completedDays ?? 0), 0);
}

function streakFromDayKeys(dayKeys: string[]) {
  const unique = Array.from(new Set(dayKeys.filter(Boolean)));
  unique.sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));

  const today = todayKey();
  let streak = 0;

  for (let i = 0; i < unique.length; i++) {
    const expected = new Date();
    expected.setDate(expected.getDate() - i);
    const expectedKey = todayKey(expected);
    if (unique[i] !== expectedKey) break;
    streak += 1;
  }

  // only count as streak if the user did something today
  if (unique[0] !== today) return 0;
  return streak;
}

function rankBadgeMeta(rank: number) {
  if (rank === 1) {
    return {
      className: "bg-amber-500 ring-amber-500/25",
      Icon: Crown,
      iconClassName: "h-6 w-6",
      label: "#1",
    } as const;
  }

  if (rank === 2) {
    return {
      className: "bg-slate-400 ring-slate-400/25",
      Icon: Medal,
      iconClassName: "h-6 w-6",
      label: "#2",
    } as const;
  }

  if (rank === 3) {
    return {
      className: "bg-orange-700 ring-orange-700/25",
      Icon: Medal,
      iconClassName: "h-6 w-6",
      label: "#3",
    } as const;
  }

  return {
    className: "bg-muted text-foreground ring-border/60",
    Icon: undefined,
    iconClassName: "",
    label: `#${rank}`,
  } as const;
}

export default function Rank() {
  const [entries, setEntries] = React.useState<RankEntry[]>([]);
  const [meHandle, setMeHandle] = React.useState("@voce");
  const [missionsOpen, setMissionsOpen] = React.useState(false);
  const [ritmo, setRitmo] = React.useState<{
    goals: Goal[];
    routines: Routine[];
    blockedHandles: string[];
  } | null>(null);

  React.useEffect(() => {
    let canceled = false;

    (async () => {
      const [state, profile] = await Promise.all([
        getRitmoFitStateDb(),
        getMyProfileDb(),
      ]);

      if (canceled) return;

      setRitmo(state as any);

      const myHandle = profile?.handle ?? "@voce";
      const myName = profile?.displayName ?? "Você";
      setMeHandle(myHandle);

      const byOwner = new Map<string, { name: string; goals: Goal[] }>();
      for (const g of state.goals) {
        if (state.blockedHandles.includes(g.ownerHandle)) continue;
        const prev = byOwner.get(g.ownerHandle);
        if (!prev) {
          byOwner.set(g.ownerHandle, { name: g.ownerName, goals: [g] });
        } else {
          prev.goals.push(g);
        }
      }

      const all: RankEntry[] = Array.from(byOwner.entries()).map(
        ([handle, v]) => {
          const days = daysForGoals(v.goals);
          const posts = v.goals.length;

          const routines = state.routines.filter((r) => r.ownerHandle === handle);
          const routinesCreated = routines.filter((r) => !r.copiedFromRoutineId).length;
          const routinesCopied = routines.filter((r) => Boolean(r.copiedFromRoutineId)).length;

          const commentsWritten = state.goals.reduce((acc, g) => {
            const count = (g.comments ?? []).filter((c) => c.authorHandle === handle).length;
            return acc + count;
          }, 0);

          const incentivesReceived = v.goals.reduce((acc, g) => {
            const inc = g.incentives;
            const total = (inc?.apoio ?? 0) + (inc?.continua ?? 0) + (inc?.orgulho ?? 0);
            return acc + total;
          }, 0);

          // MVP: só conseguimos medir "incentivos dados" para o usuário atual.
          const incentivesGiven =
            handle === myHandle
              ? state.goals.reduce((acc, g) => {
                  const mine = g.myIncentives ?? {};
                  return acc + (Object.values(mine).filter(Boolean).length ?? 0);
                }, 0)
              : 0;

          const activityDays = [
            ...v.goals.map((g) => dayKeyFromIso(g.createdAt)),
            ...routines.map((r) => dayKeyFromIso(r.createdAt)),
            ...state.goals
              .flatMap((g) => g.comments ?? [])
              .filter((c) => c.authorHandle === handle)
              .map((c) => dayKeyFromIso(c.createdAt)),
          ];

          const streakDays = streakFromDayKeys(activityDays);

          const xp =
            days * XP_PER_DAY +
            posts * XP_PER_POST +
            routinesCreated * XP_PER_ROUTINE_CREATED +
            routinesCopied * XP_PER_ROUTINE_COPIED +
            commentsWritten * XP_PER_COMMENT +
            incentivesGiven * XP_PER_INCENTIVE_GIVEN +
            incentivesReceived * XP_PER_INCENTIVE_RECEIVED;

          return {
            handle,
            name: v.name,
            goals: posts,
            days,
            routines: routines.length,
            commentsWritten,
            incentivesReceived,
            incentivesGiven,
            streakDays,
            xp,
          };
        },
      );

      const sorted = all.sort((a, b) => b.xp - a.xp);

      setEntries(
        sorted.length
          ? sorted
          : [
              {
                name: myName,
                handle: myHandle,
                xp: 0,
                days: 0,
                goals: 0,
                routines: 0,
                commentsWritten: 0,
                incentivesReceived: 0,
                incentivesGiven: 0,
                streakDays: 0,
              },
              {
                name: "Ana",
                handle: "@ana.fit",
                xp: 0,
                days: 0,
                goals: 0,
                routines: 0,
                commentsWritten: 0,
                incentivesReceived: 0,
                incentivesGiven: 0,
                streakDays: 0,
              },
              {
                name: "Bruno",
                handle: "@bruno.nutri",
                xp: 0,
                days: 0,
                goals: 0,
                routines: 0,
                commentsWritten: 0,
                incentivesReceived: 0,
                incentivesGiven: 0,
                streakDays: 0,
              },
            ],
      );
    })();

    return () => {
      canceled = true;
    };
  }, []);

  const missions = React.useMemo(() => {
    const me = entries.find((e) => e.handle === meHandle) ?? null;
    if (!ritmo) return { me, tasks: [], activeCount: 0 };

    const meGoals = ritmo.goals.filter((g) => g.ownerHandle === meHandle);
    const meRoutines = ritmo.routines.filter((r) => r.ownerHandle === meHandle);
    const meComments = ritmo.goals
      .flatMap((g) => g.comments ?? [])
      .filter((c) => c.authorHandle === meHandle);

    const didPostToday = meGoals.some(
      (g) => dayKeyFromIso(g.createdAt) === todayKey(),
    );
    const didRoutineToday = meRoutines.some(
      (r) => dayKeyFromIso(r.createdAt) === todayKey(),
    );
    const didCommentToday = meComments.some(
      (c) => dayKeyFromIso(c.createdAt) === todayKey(),
    );

    const tasks = [
      { label: "Faça 1 post hoje", done: didPostToday, xp: XP_PER_POST },
      {
        label: "Crie 1 rotina",
        done: didRoutineToday,
        xp: XP_PER_ROUTINE_CREATED,
      },
      {
        label: "Escreva 1 comentário",
        done: didCommentToday,
        xp: XP_PER_COMMENT,
      },
    ];

    const activeCount = tasks.filter((t) => !t.done).length;

    return { me, tasks, activeCount };
  }, [entries, meHandle, ritmo]);

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Ranking</h1>
          <p className="text-sm text-muted-foreground">
            Pontos vêm de consistência e interação: posts, rotinas, comentários
            e incentivos.
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative h-12 w-12 rounded-full bg-gradient-to-br from-brand-3 via-brand to-brand-2 text-sm font-semibold text-white shadow-sm ring-1 ring-brand/30 hover:bg-brand"
          onClick={() => setMissionsOpen(true)}
          aria-label="Abrir missões de hoje"
        >
          {initials(missions.me?.name ?? "Você")}
          <span
            className={cn(
              "absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full px-1 text-[11px] font-semibold text-white ring-2 ring-background",
              missions.activeCount === 0 ? "bg-emerald-500" : "bg-brand",
            )}
            aria-label={`${missions.activeCount} missões ativas`}
            title={`${missions.activeCount} missões ativas`}
          >
            {missions.activeCount}
          </span>
        </Button>
      </header>

      <Dialog open={missionsOpen} onOpenChange={setMissionsOpen}>
        <DialogContent className="max-w-[min(92vw,520px)] rounded-3xl border-border/60">
          <DialogHeader>
            <DialogTitle>Missões de hoje</DialogTitle>
            <DialogDescription>
              Complete ações simples para ganhar XP e manter consistência.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            {missions.me ? (
              <div className="text-sm text-muted-foreground">
                Seu streak atual:{" "}
                <span className="font-semibold">
                  {missions.me.streakDays} dias
                </span>
              </div>
            ) : null}

            <div className="grid gap-2">
              {missions.tasks.map((t) => (
                <div
                  key={t.label}
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-muted/10 p-3",
                    t.done ? "ring-1 ring-emerald-500/15" : null,
                  )}
                >
                  <div className="flex min-w-0 items-start gap-2">
                    {t.done ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      <div
                        className={cn(
                          "text-sm font-medium",
                          t.done ? "text-emerald-700" : null,
                        )}
                      >
                        {t.label}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t.done ? "Concluída hoje" : "Ativa"}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 text-xs font-semibold text-muted-foreground">
                    +{t.xp} XP
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <section className="grid gap-3">
        {entries.map((e, idx) => {
          const rank = idx + 1;
          const isMe = e.handle === meHandle;
          const meta = rankBadgeMeta(rank);

          const level = Math.max(1, Math.floor(e.xp / XP_PER_LEVEL) + 1);
          const xpIntoLevel = e.xp % XP_PER_LEVEL;
          const levelPct = Math.round((xpIntoLevel / XP_PER_LEVEL) * 100);

          return (
            <Card
              key={e.handle}
              className={cn(
                "border-border/60",
                isMe ? "ring-2 ring-brand/20" : "",
              )}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div
                  className={cn(
                    "grid h-12 w-12 place-items-center rounded-2xl text-white shadow-sm ring-1",
                    meta.className,
                  )}
                  aria-label={meta.label}
                  title={meta.label}
                >
                  {meta.Icon ? (
                    <meta.Icon className={meta.iconClassName} />
                  ) : (
                    <span className="text-sm font-semibold">{meta.label}</span>
                  )}
                </div>

                <div
                  className={cn(
                    "grid h-11 w-11 place-items-center rounded-full text-sm font-semibold text-white ring-1",
                    isMe
                      ? "bg-foreground ring-foreground/20"
                      : "bg-brand ring-brand/25",
                  )}
                >
                  {initials(e.name)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-sm font-semibold">
                          {e.name}
                        </div>
                        {isMe ? (
                          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">
                            Você
                          </span>
                        ) : null}
                        <span className="rounded-full border border-border/60 bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          Nível {level}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {e.handle} · {e.goals} posts · {e.routines} rotinas ·{" "}
                        {e.days} dias
                        {e.streakDays > 0 ? (
                          <>
                            {" "}
                            ·{" "}
                            <span className="font-semibold">
                              streak {e.streakDays}d
                            </span>
                          </>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        <span className="rounded-full bg-muted px-2 py-0.5 ring-1 ring-border/60">
                          {e.commentsWritten} comentários
                        </span>
                        <span className="rounded-full bg-muted px-2 py-0.5 ring-1 ring-border/60">
                          {e.incentivesReceived} incentivos recebidos
                        </span>
                        {e.incentivesGiven > 0 ? (
                          <span className="rounded-full bg-muted px-2 py-0.5 ring-1 ring-border/60">
                            {e.incentivesGiven} incentivos dados
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1 text-sm font-semibold">
                        <Zap
                          className={cn(
                            "h-4 w-4",
                            rank === 1 ? "text-amber-500" : "text-brand-2",
                          )}
                        />
                        {e.xp} XP
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {xpIntoLevel}/{XP_PER_LEVEL} XP no nível
                      </div>
                    </div>
                  </div>

                  <div className="mt-2">
                    <Progress value={levelPct} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
