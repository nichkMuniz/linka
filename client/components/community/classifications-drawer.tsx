import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { type GroupCheckIn, type DuelScoringType, type DuelCheckInVote } from "@/lib/ritmofit-db";

interface ClassificationsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupCheckIns: GroupCheckIn[];
  scoringType?: DuelScoringType;
  checkInVotes?: DuelCheckInVote[];
  memeRule?: string | null;
}

const SCORING_META: Record<DuelScoringType, { label: string; unit: string; format: (v: number) => string }> = {
  active_days:   { label: "Dias ativos",           unit: "dias",    format: (v) => `${v} dia${v !== 1 ? "s" : ""}` },
  hustle_points: { label: "Pontos de hustle",       unit: "pts",     format: (v) => `${v.toLocaleString("pt-BR")} pts` },
  check_in_count:{ label: "Check-ins",              unit: "check-ins", format: (v) => `${v} check-in${v !== 1 ? "s" : ""}` },
  duration:      { label: "Duração total",          unit: "min",     format: (v) => v >= 60 ? `${Math.floor(v / 60)}h ${v % 60}min` : `${v} min` },
  distance:      { label: "Distância total",        unit: "km",      format: (v) => `${v.toFixed(1)} km` },
  steps:         { label: "Total de passos",        unit: "passos",  format: (v) => `${v.toLocaleString("pt-BR")} passos` },
  calories:      { label: "Calorias queimadas",     unit: "kcal",    format: (v) => `${v.toLocaleString("pt-BR")} kcal` },
  memes:         { label: "Check-ins aprovados",    unit: "aprovados", format: (v) => `${v} aprovado${v !== 1 ? "s" : ""}` },
};

function isDisqualified(checkInId: string, votes: DuelCheckInVote[]): boolean {
  const relevant = votes.filter((v) => v.checkInId === checkInId);
  const disqualify = relevant.filter((v) => v.voteType === "disqualify").length;
  const classify = relevant.filter((v) => v.voteType === "classify").length;
  return disqualify > classify;
}

function computeScore(
  checkIns: GroupCheckIn[],
  scoringType: DuelScoringType,
  votes: DuelCheckInVote[]
): Record<string, { userName: string; score: number }> {
  const acc: Record<string, { userName: string; score: number; dates?: Set<string> }> = {};

  for (const c of checkIns) {
    if (!acc[c.userId]) {
      acc[c.userId] = { userName: c.userName, score: 0, dates: new Set() };
    }
    const entry = acc[c.userId];

    // For memes: skip disqualified check-ins
    if (scoringType === "memes" && isDisqualified(c.id, votes)) continue;

    switch (scoringType) {
      case "check_in_count":
      case "memes":
        entry.score += 1;
        break;
      case "active_days": {
        const day = c.createdAt.slice(0, 10);
        entry.dates!.add(day);
        entry.score = entry.dates!.size;
        break;
      }
      case "hustle_points":
        entry.score += c.volume || 0;
        break;
      case "duration":
        entry.score += c.durationMinutes || 0;
        break;
      case "distance":
        entry.score += c.distanceKm || 0;
        break;
      case "steps":
        entry.score += c.steps || 0;
        break;
      case "calories":
        entry.score += c.calories || 0;
        break;
    }
  }

  return acc;
}

export function ClassificationsDrawer({
  open,
  onOpenChange,
  groupCheckIns,
  scoringType = "check_in_count",
  checkInVotes = [],
  memeRule,
}: ClassificationsDrawerProps) {
  const meta = SCORING_META[scoringType];

  const rankingEntries = React.useMemo(() => {
    const scores = computeScore(groupCheckIns, scoringType, checkInVotes);
    return Object.entries(scores)
      .sort((a, b) => b[1].score - a[1].score);
  }, [groupCheckIns, scoringType, checkInVotes]);

  // For memes: show disqualified counts
  const disqualifiedPerUser = React.useMemo(() => {
    if (scoringType !== "memes") return {};
    const map: Record<string, number> = {};
    for (const c of groupCheckIns) {
      if (isDisqualified(c.id, checkInVotes)) {
        map[c.userId] = (map[c.userId] || 0) + 1;
      }
    }
    return map;
  }, [groupCheckIns, checkInVotes, scoringType]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent
        handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
        overlayClassName="bg-transparent"
        className="max-h-[80dvh] flex flex-col z-[100] !rounded-t-[32px] !border-0"
        style={{
          background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderTop: "1px solid rgba(255,255,255,.14)",
        }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DrawerHeader className="shrink-0">
          <DrawerTitle style={{ color: "#fff" }}>Classificações</DrawerTitle>
          <DrawerDescription className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
            {scoringType === "memes" && memeRule
              ? `🎭 Regra: ${memeRule}`
              : `Critério: ${meta.label}`}
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="space-y-2">
            {rankingEntries.length > 0 ? (
              rankingEntries.map(([userId, data], index) => (
                <div
                  key={userId}
                  className="flex items-center gap-3 p-3 rounded-2xl"
                  style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}
                >
                  <div className="text-lg font-bold w-8 text-center shrink-0" style={{ color: "#5b8cff" }}>
                    {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "#fff" }}>{data.userName}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>{meta.format(data.score)}</p>
                      {scoringType === "memes" && (disqualifiedPerUser[userId] || 0) > 0 && (
                        <span className="text-[10px] text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full leading-none">
                          {disqualifiedPerUser[userId]} desclassif.
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm font-bold shrink-0" style={{ color: "#5b8cff" }}>
                    {scoringType === "distance"
                      ? data.score.toFixed(1)
                      : Math.round(data.score).toLocaleString("pt-BR")}
                    <span className="text-xs font-normal ml-1" style={{ color: "rgba(255,255,255,.5)" }}>{meta.unit}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-center py-8" style={{ color: "rgba(255,255,255,.5)" }}>Nenhum dado ainda</p>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
