import React from "react";
import {
  getDisplayBadgeDb,
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
  // Insígnia exibida = a escolhida pelo usuário (persistida), não a "mais alta".
  const [displayBadge, setDisplayBadge] = React.useState<Badge | null>(null);
  const [userBadges, setUserBadges] = React.useState<UserBadge[]>([]);
  const [allBadges, setAllBadges] = React.useState<Badge[]>([]);
  const [totalCheckIns, setTotalCheckIns] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const [display, earned, all, total] = await Promise.all([
        getDisplayBadgeDb(userId),
        getUserBadgesDb(userId),
        getAllBadgesDb(),
        getTotalCheckInsDb(userId),
      ]);
      setDisplayBadge(display);
      setUserBadges(earned);
      setAllBadges(all);
      setTotalCheckIns(total);
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  }, [userId]);

  React.useEffect(() => {
    load();
  }, [load]);

  if (loading) return null;
  if (!displayBadge) return null;

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
            <span
              role="button"
              tabIndex={0}
              onClick={handleClick}
              onKeyDown={(e) => e.key === "Enter" && handleClick(e as unknown as React.MouseEvent)}
              className="inline-flex items-center gap-0.5 cursor-pointer focus:outline-none"
              aria-label={`Insígnia: ${displayBadge.name}`}
            >
              <span className="text-xs leading-none align-middle">{displayBadge.emoji}</span>
              {showStreak && (
                <span className="text-xs font-semibold text-orange-400 ml-0.5">
                  {displayBadge.name}
                </span>
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <p className="font-semibold">{displayBadge.name}</p>
            <p className="text-muted-foreground">{displayBadge.description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <InsigniasDrawer
        open={modalOpen}
        onOpenChange={setModalOpen}
        userBadges={userBadges}
        allBadges={allBadges}
        totalCheckIns={totalCheckIns}
        profileUserId={userId}
        selectedBadgeId={displayBadge?.id}
        onSelected={load}
      />
    </>
  );
}
