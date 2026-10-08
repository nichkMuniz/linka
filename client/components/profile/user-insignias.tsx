import React from "react";
import { useLanguage } from "@/lib/language-context";
import {
  getBadgeDisplayDb,
  getUserBadgesDb,
  getAllBadgesDb,
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
import { FEATURES } from "@/lib/feature-flags";
import { badgeDescription, badgeName } from "@/lib/badges";

interface UserInsigniasProps {
  userId: string;
  /** When true, shows the badge tier label next to the emoji */
  showStreak?: boolean;
}

export function UserInsignias({ userId, showStreak = false }: UserInsigniasProps) {
  const { t } = useLanguage();
  // Fonte única do recorte: em vez de guardar os três callsites (perfil, post
  // viewer e card do feed), a própria insígnia some. Ao religar FEATURES.badges
  // os três voltam juntos, sem risco de esquecer um.
  if (!FEATURES.badges) return null;

  // Insígnia exibida = a escolhida pelo usuário (persistida), não a "mais alta".
  // `visible` = o dono não escondeu (profiles.show_badge, 2026-10-08).
  const [chosenBadge, setChosenBadge] = React.useState<Badge | null>(null);
  const [visible, setVisible] = React.useState(true);
  const [userBadges, setUserBadges] = React.useState<UserBadge[]>([]);
  const [allBadges, setAllBadges] = React.useState<Badge[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const [display, earned, all] = await Promise.all([
        getBadgeDisplayDb(userId),
        getUserBadgesDb(userId),
        getAllBadgesDb(),
      ]);
      setChosenBadge(display.badge);
      setVisible(display.visible);
      setUserBadges(earned);
      setAllBadges(all);
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  }, [userId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const displayBadge = visible ? chosenBadge : null;
  // O drawer continua montado enquanto aberto: o dono pode esconder a insígnia
  // por ele mesmo, e o emoji sumir não pode fechá-lo no meio.
  if (loading) return null;
  if (!displayBadge && !modalOpen) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setModalOpen(true);
  };

  const name = displayBadge ? badgeName(displayBadge, t) : "";

  return (
    <>
      {displayBadge && (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              role="button"
              tabIndex={0}
              onClick={handleClick}
              onKeyDown={(e) => e.key === "Enter" && handleClick(e as unknown as React.MouseEvent)}
              className="inline-flex items-center gap-0.5 cursor-pointer focus:outline-none"
              aria-label={t("profile_badge_aria").replace("{name}", name)}
            >
              <span className="text-xs leading-none align-middle">{displayBadge.emoji}</span>
              {showStreak && (
                <span className="text-xs font-semibold text-orange-400 ml-0.5">
                  {name}
                </span>
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <p className="font-semibold">{name}</p>
            <p className="text-muted-foreground">{badgeDescription(displayBadge, t)}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      )}

      <InsigniasDrawer
        open={modalOpen}
        onOpenChange={setModalOpen}
        userBadges={userBadges}
        allBadges={allBadges}
        profileUserId={userId}
        selectedBadgeId={chosenBadge?.id}
        onChanged={load}
      />
    </>
  );
}
