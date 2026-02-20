import React from "react";
import { getWeekCheckInsDb } from "@/lib/ritmofit-db";

interface UserInsigniasProps {
  userId: string;
  maxBadges?: number;
}

export function UserInsignias({ userId, maxBadges = 3 }: UserInsigniasProps) {
  const [weekCheckIns, setWeekCheckIns] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadInsignias = async () => {
      try {
        const days = await getWeekCheckInsDb(userId);
        setWeekCheckIns(days.length);
      } catch (err) {
        console.error("Error loading insignias:", err);
        setWeekCheckIns(0);
      } finally {
        setLoading(false);
      }
    };

    loadInsignias();
  }, [userId]);

  if (loading || weekCheckIns === 0) {
    return null;
  }

  const badgeDisplays = [];

  if (weekCheckIns >= 1) badgeDisplays.push({ emoji: "⭐", title: "Iniciante", count: 1 });
  if (weekCheckIns >= 3) badgeDisplays.push({ emoji: "🔥", title: "Sequência", count: 3 });
  if (weekCheckIns >= 5) badgeDisplays.push({ emoji: "💪", title: "Campeão", count: 5 });
  if (weekCheckIns === 7) badgeDisplays.push({ emoji: "👑", title: "Lendário", count: 7 });

  const displayedBadges = badgeDisplays.slice(0, maxBadges);

  return (
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
  );
}
