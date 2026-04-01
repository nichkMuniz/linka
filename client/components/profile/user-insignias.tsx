import React from "react";
import {
  getTopUserBadgeDb,
  getUserBadgesDb,
  getAllBadgesDb,
  getTotalCheckInsDb,
  type Badge,
  type UserBadge,
} from "@/lib/ritmofit-db";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { InsigniasDrawer } from "@/components/profile/insignias-drawer";

interface UserInsigniasProps {
  userId: string;
  /** When true, shows the badge tier label next to the emoji */
  showStreak?: boolean;
}

export function UserInsignias({ userId, showStreak = false }: UserInsigniasProps) {
  const [topBadge, setTopBadge] = React.useState<Badge | null>(null);
  const [userBadges, setUserBadges] = React.useState<UserBadge[]>([]);
  const [allBadges, setAllBadges] = React.useState<Badge[]>([]);
  const [totalCheckIns, setTotalCheckIns] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);

  React.useEffect(() => {
    const load = async () => {
      try {
        const [top, earned, all, total] = await Promise.all([
          getTopUserBadgeDb(userId),
          getUserBadgesDb(userId),
          getAllBadgesDb(),
          getTotalCheckInsDb(userId),
        ]);
        setTopBadge(top);
        setUserBadges(earned);
        setAllBadges(all);
        setTotalCheckIns(total);
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  if (loading) return null;
  if (!topBadge) return null;

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
              aria-label={`Insígnia: ${topBadge.name}`}
            >
              <span className="text-xs leading-none">{topBadge.emoji}</span>
              {showStreak && (
                <span className="text-xs font-semibold text-orange-400 ml-0.5">
                  {topBadge.name}
                </span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <p className="font-semibold">{topBadge.name}</p>
            <p className="text-muted-foreground">{topBadge.description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <InsigniasDrawer
        open={modalOpen}
        onOpenChange={setModalOpen}
        userBadges={userBadges}
        allBadges={allBadges}
        totalCheckIns={totalCheckIns}
      />
    </>
  );
}
