import React from "react";
import { getWeekCheckInsDb, getCheckInHistoryDb, getUserStatsDb, type CheckIn } from "@/lib/ritmofit-db";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { InsigniasDrawer } from "@/components/profile/insignias-drawer";

interface UserInsigniasProps {
  userId: string;
  maxBadges?: number;
  /** When true, shows the streak day count next to the badge */
  showStreak?: boolean;
}

function calcStreak(history: CheckIn[]): number {
  if (history.length === 0) return 0;
  const sorted = [...history].sort((a, b) =>
    new Date(b.check_in_date).getTime() - new Date(a.check_in_date).getTime()
  );
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  const mostRecent = sorted[0]?.check_in_date;
  if (mostRecent !== today && mostRecent !== yesterday) return 0;

  let streak = 0;
  let current = mostRecent;
  for (const ci of sorted) {
    if (ci.check_in_date === current) {
      streak++;
      const d = new Date(current + "T12:00:00Z");
      d.setDate(d.getDate() - 1);
      current = d.toISOString().split("T")[0];
    } else break;
  }
  return streak;
}

/** Returns only the single highest unlocked badge, or null */
function getTopBadge(weekCheckIns: number, level: number): { emoji: string; title: string; description: string } | null {
  // Check-in based (preferred, accurate)
  if (weekCheckIns === 7) return { emoji: "👑", title: "Lendário", description: "Check-in todos os 7 dias da semana!" };
  if (weekCheckIns >= 5) return { emoji: "💪", title: "Campeão", description: "5 ou mais check-ins esta semana" };
  if (weekCheckIns >= 3) return { emoji: "🔥", title: "Sequência", description: "3 ou mais check-ins esta semana" };
  if (weekCheckIns >= 1) return { emoji: "⭐", title: "Iniciante", description: "1 ou mais check-in esta semana" };

  // Level-based fallback (when RLS blocks check-in reads for non-followers)
  if (level >= 20) return { emoji: "👑", title: "Lendário", description: "Usuário experiente da plataforma" };
  if (level >= 10) return { emoji: "💪", title: "Campeão", description: "Usuário experiente da plataforma" };
  if (level >= 5) return { emoji: "🔥", title: "Sequência", description: "Usuário ativo da plataforma" };
  if (level >= 1) return { emoji: "⭐", title: "Iniciante", description: "Membro da comunidade" };

  return null;
}

export function UserInsignias({ userId, showStreak = false }: UserInsigniasProps) {
  const [weekCheckIns, setWeekCheckIns] = React.useState<number>(0);
  const [streakCount, setStreakCount] = React.useState<number>(0);
  const [level, setLevel] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);

  React.useEffect(() => {
    const loadInsignias = async () => {
      try {
        const [days, history, stats] = await Promise.all([
          getWeekCheckInsDb(userId).catch(() => [] as number[]),
          showStreak ? getCheckInHistoryDb(userId, 30).catch(() => [] as CheckIn[]) : Promise.resolve([] as CheckIn[]),
          getUserStatsDb(userId).catch(() => ({ level: 1, points: 0, postsCount: 0, followersCount: 0, followingCount: 0 })),
        ]);
        setWeekCheckIns(days.length);
        // Ensure at least level 1 so the badge fallback renders for any existing user
        setLevel(Math.max(stats.level ?? 1, 1));
        if (showStreak) setStreakCount(calcStreak(history));
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
    };

    loadInsignias();
  }, [userId, showStreak]);

  if (loading) return null;

  const badge = getTopBadge(weekCheckIns, level);
  if (!badge) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setModalOpen(true);
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleClick}
              className="inline-flex items-center gap-0.5 cursor-pointer focus:outline-none"
              aria-label={`Insígnia: ${badge.title}`}
            >
              <span className="text-xs leading-none">{badge.emoji}</span>
              {showStreak && (
                <span className="text-xs font-semibold text-orange-400 ml-0.5">
                  {streakCount > 0 ? streakCount : weekCheckIns}d
                </span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <p className="font-semibold">{badge.title}</p>
            <p className="text-muted-foreground">{badge.description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <InsigniasDrawer
        open={modalOpen}
        onOpenChange={setModalOpen}
        weekCheckIns={weekCheckIns}
        level={level}
      />
    </>
  );
}
