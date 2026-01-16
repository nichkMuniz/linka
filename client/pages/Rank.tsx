import * as React from "react";
import { Crown, Medal, Users } from "lucide-react";

import { Goal, getRitmoFitState } from "@/lib/ritmofit";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type RankEntry = {
  name: string;
  handle: string;
  points: number;
  goals: number;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/g);
  return (
    (parts[0]?.[0] ?? "?").toUpperCase() +
    (parts[1]?.[0] ?? "").toUpperCase()
  );
}

function scoreForGoals(goals: Goal[]) {
  // Pontuação simples para MVP: total de dias concluídos em todas as rotinas
  return goals.reduce((acc, g) => acc + (g.completedDays ?? 0), 0);
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

    const all: RankEntry[] = Array.from(byOwner.entries()).map(([handle, v]) => ({
      handle,
      name: v.name,
      goals: v.goals.length,
      points: scoreForGoals(v.goals),
    }));

    // garante que o usuário atual aparece
    const mine = state.goals.filter(
      (g) => g.ownerHandle === "@voce" || g.ownerName === "Você",
    );
    if (mine.length) {
      setMeHandle(mine[0].ownerHandle);
    }

    const sorted = all.sort((a, b) => b.points - a.points);

    // fallback: se ficou vazio por algum motivo
    setEntries(
      sorted.length
        ? sorted
        : [
            { name: "Você", handle: "@voce", points: 0, goals: 0 },
            { name: "Ana", handle: "@ana.fit", points: 0, goals: 0 },
            { name: "Bruno", handle: "@bruno.nutri", points: 0, goals: 0 },
          ],
    );
  }, []);

  const meIndex = entries.findIndex((e) => e.handle === meHandle);
  const myPos = meIndex >= 0 ? meIndex + 1 : null;
  const maxPoints = Math.max(1, ...entries.map((e) => e.points));

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <Card className="border-border/60">
        <CardContent className="flex items-start gap-4 p-5">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-3 via-brand to-brand-2 text-white shadow-sm ring-1 ring-brand/30">
            <Users className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <div className="text-base font-semibold tracking-tight">Ranking</div>
            <div className="text-sm text-muted-foreground">
              Sua classificação é atualizada pelo total de dias de rotina concluídos.
            </div>
            {myPos ? (
              <div className="pt-2 text-sm">
                Você está em <span className="font-semibold">#{myPos}</span>.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-3">
        {entries.map((e, idx) => {
          const rank = idx + 1;
          const pct = Math.round((e.points / maxPoints) * 100);
          const isMe = e.handle === meHandle;

          const TrophyIcon =
            rank === 1 ? Crown : rank <= 3 ? Medal : undefined;

          return (
            <Card key={e.handle} className="border-border/60">
              <CardContent className="flex items-center gap-4 p-4">
                <div
                  className={cn(
                    "grid h-11 w-11 place-items-center rounded-full text-sm font-semibold text-white ring-1",
                    isMe
                      ? "bg-foreground ring-foreground/20"
                      : "bg-gradient-to-br from-brand-3 via-brand to-brand-2 ring-brand/20",
                  )}
                >
                  {initials(e.name)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-sm font-semibold">
                          #{rank} {e.name}
                        </div>
                        {TrophyIcon ? (
                          <TrophyIcon
                            className={cn(
                              "h-4 w-4",
                              rank === 1
                                ? "text-orange-500"
                                : "text-muted-foreground",
                            )}
                          />
                        ) : null}
                        {isMe ? (
                          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">
                            Você
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {e.handle} · {e.goals} rotinas
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-semibold">{e.points}</div>
                      <div className="text-[11px] text-muted-foreground">dias</div>
                    </div>
                  </div>

                  <div className="mt-2">
                    <Progress value={pct} className="h-2" />
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
