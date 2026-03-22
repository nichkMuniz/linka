import React from "react";
import { getWeekCheckInsDb, getCheckInHistoryDb, type CheckIn } from "@/lib/ritmofit-db";

interface UserInsigniasProps {
  userId: string;
  maxBadges?: number;
  /** When true, shows the streak day count next to the highest badge */
  showStreak?: boolean;
}

function calcStreak(history: CheckIn[]): number {
  if (history.length === 0) return 0;
  const sorted = [...history].sort((a, b) =>
    new Date(b.check_in_date).getTime() - new Date(a.check_in_date).getTime()
  );
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  // Start from today or yesterday (if today not checked in yet)
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

export function UserInsignias({ userId, maxBadges = 3, showStreak = false }: UserInsigniasProps) {
  const [weekCheckIns, setWeekCheckIns] = React.useState<number>(0);
  const [streakCount, setStreakCount] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadInsignias = async () => {
      try {
        const [days, history] = await Promise.all([
          getWeekCheckInsDb(userId),
          showStreak ? getCheckInHistoryDb(userId, 30) : Promise.resolve([] as CheckIn[]),
        ]);
        setWeekCheckIns(days.length);
        if (showStreak) setStreakCount(calcStreak(history));
      } catch (err) {
        console.error("Error loading insignias:", err);
        setWeekCheckIns(0);
      } finally {
        setLoading(false);
      }
    };

    loadInsignias();
  }, [userId, showStreak]);

  if (loading || weekCheckIns === 0) {
    return null;
  }

  const badgeDisplays = [];

  if (weekCheckIns >= 1) badgeDisplays.push({ emoji: "⭐", title: "Iniciante", count: 1 });
  if (weekCheckIns >= 3) badgeDisplays.push({ emoji: "🔥", title: "Sequência", count: 3 });
  if (weekCheckIns >= 5) badgeDisplays.push({ emoji: "💪", title: "Campeão", count: 5 });
  if (weekCheckIns === 7) badgeDisplays.push({ emoji: "👑", title: "Lendário", count: 7 });

  const displayedBadges = badgeDisplays.slice(0, maxBadges);
  const topBadge = badgeDisplays[badgeDisplays.length - 1];

  return (
    <div className="flex items-center gap-1">
      <div className="flex gap-0.5">
        {displayedBadges.map((badge) => (
          <span
            key={badge.title}
            className="text-xs"
            title={badge.title}
          >
            {badge.emoji}
          </span>
        ))}
      </div>
      {showStreak && topBadge && (
        <span className="text-xs font-semibold text-orange-400">
          {streakCount > 0 ? streakCount : weekCheckIns}d
        </span>
      )}
    </div>
  );
}
