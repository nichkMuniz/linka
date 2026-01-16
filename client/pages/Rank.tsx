import * as React from "react";
import { Crown, Medal, Sparkles, Zap } from "lucide-react";

import { Goal, getRitmoFitState } from "@/lib/ritmofit";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type RankEntry = {
  name: string;
  handle: string;
  days: number;
  goals: number;
  xp: number;
};

const XP_PER_DAY = 50;
const XP_PER_LEVEL = 500;

function initials(name: string) {
  const parts = name.trim().split(/\s+/g);
  return (
    (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase()
  );
}

function daysForGoals(goals: Goal[]) {
  // MVP: dias concluídos em todas as rotinas
  return goals.reduce((acc, g) => acc + (g.completedDays ?? 0), 0);
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

  React.useEffect(() => {
    const state = getRitmoFitState();

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
        return {
          handle,
          name: v.name,
          goals: v.goals.length,
          days,
          xp: days * XP_PER_DAY,
        };
      },
    );

    // garante que o usuário atual aparece
    const mine = state.goals.filter(
      (g) => g.ownerHandle === "@voce" || g.ownerName === "Você",
    );
    if (mine.length) {
      setMeHandle(mine[0].ownerHandle);
    }

    const sorted = all.sort((a, b) => b.xp - a.xp);

    setEntries(
      sorted.length
        ? sorted
        : [
            { name: "Você", handle: "@voce", xp: 0, days: 0, goals: 0 },
            { name: "Ana", handle: "@ana.fit", xp: 0, days: 0, goals: 0 },
            { name: "Bruno", handle: "@bruno.nutri", xp: 0, days: 0, goals: 0 },
          ],
    );
  }, []);

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Ranking</h1>
          <p className="text-sm text-muted-foreground">
            Cada dia concluído vale{" "}
            <span className="font-semibold">{XP_PER_DAY} XP</span>. Consistência
            vira nível.
          </p>
        </div>
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand text-white shadow-sm ring-1 ring-brand/30">
          <Sparkles className="h-6 w-6" />
        </div>
      </header>

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
                        {e.handle} · {e.goals} rotinas · {e.days} dias
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
