import React from "react";
import { Check, Star, Loader2 } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { type Badge, type UserBadge, setSelectedBadgeDb, getViewer } from "@/lib/ritmofit-db";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/language-context";

interface InsigniasDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userBadges: UserBadge[];
  allBadges: Badge[];
  /** Total de check-ins acumulados do usuário (todos os tempos) */
  totalCheckIns: number;
  /** ID do dono do perfil sendo visualizado */
  profileUserId?: string;
}

const BADGE_COLORS: Record<string, { active: string; check: string; bar: string; ring: string }> = {
  iniciante: { active: "from-yellow-500/20 to-yellow-500/5 border-yellow-500/40 shadow-yellow-500/10", check: "text-yellow-600", bar: "bg-yellow-500", ring: "ring-yellow-500/40" },
  sequencia: { active: "from-orange-500/20 to-orange-500/5 border-orange-500/40 shadow-orange-500/10", check: "text-orange-600", bar: "bg-orange-500", ring: "ring-orange-500/40" },
  campeao:   { active: "from-green-500/20 to-green-500/5 border-green-500/40 shadow-green-500/10", check: "text-green-600",  bar: "bg-green-500",  ring: "ring-green-500/40"  },
  lendario:  { active: "from-purple-500/20 to-purple-500/5 border-purple-500/40 shadow-purple-500/10", check: "text-purple-600", bar: "bg-purple-500", ring: "ring-purple-500/40" },
};

export function InsigniasDrawer({ open, onOpenChange, userBadges, allBadges, totalCheckIns, profileUserId }: InsigniasDrawerProps) {
  const { t } = useLanguage();
  const [isSelecting, setIsSelecting] = React.useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);

  // Get current user to check if we can select
  React.useEffect(() => {
    getViewer().then(u => setCurrentUserId(u?.id || null));
  }, []);

  // Se profileUserId foi passado e é diferente do viewer, é perfil alheio
  const isReadOnly = !!profileUserId && !!currentUserId && profileUserId !== currentUserId;

  const activeBadgeId = userBadges.length > 0 ? userBadges[0].badge_id : null;

  // Sort badges by required_checkins to ensure correct order
  const sortedBadges = [...allBadges].sort((a, b) => a.required_checkins - b.required_checkins);
  
  // Find the next badge to unlock
  const nextBadge = sortedBadges.find((b) => b.required_checkins > totalCheckIns);
  const targetRequired = nextBadge ? nextBadge.required_checkins : sortedBadges.length > 0 ? sortedBadges[sortedBadges.length - 1].required_checkins : 0;
  const isMaxed = !nextBadge && sortedBadges.length > 0;

  const handleSelect = async (badge: Badge) => {
    if (isReadOnly) return;
    if (isSelecting) return;
    if (totalCheckIns < badge.required_checkins) {
      toast.error(t("badges_not_reached"));
      return;
    }
    if (badge.id === activeBadgeId) return;

    try {
      setIsSelecting(badge.id);
      await setSelectedBadgeDb(badge.id);
      toast.success(t("badges_selected").replace("{name}", badge.name));
      // Simples refresh forçado (reload) ou o componente pai deve atualizar
      // Como o Drawer é controlado por props, idealmente o pai deveria ter um onSelect
      // Mas para manter simples e imediato:
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || t("badges_error"));
    } finally {
      setIsSelecting(null);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh] flex flex-col bg-gradient-to-b from-background via-background to-muted/30 pb-6" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DrawerHeader className="shrink-0 border-b border-border/60">
          <DrawerTitle className="flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            {t("badges_title")}
          </DrawerTitle>
          <DrawerDescription className="">
            {t("badges_desc")}
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-hide">
          {/* Progress Overview - Integrated logic for NEXT level */}
          <div className="mb-6 p-4 rounded-2xl bg-brand/10 border border-brand/20 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-brand animate-pulse" />
                <p className="font-semibold text-sm">{t("badges_next_level")}</p>
              </div>
              <p className="font-bold text-lg tabular-nums">
                {totalCheckIns}/{targetRequired}
              </p>
            </div>
            <div className="w-full bg-muted/50 rounded-full h-3 p-0.5 overflow-hidden ring-1 ring-border/50">
              <div
                className="bg-brand transition-all duration-1000 h-full rounded-full shadow-[0_0_10px_rgba(var(--brand),0.3)]"
                style={{ width: `${Math.min(100, (totalCheckIns / targetRequired) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-3 font-medium">
              {isMaxed
                ? t("badges_maxed")
                : nextBadge
                  ? t("badges_remaining").replace("{n}", String(nextBadge.required_checkins - totalCheckIns)).replace("{name}", nextBadge.name)
                  : t("badges_keep_training")}
            </p>
          </div>

          <div className="space-y-4 pb-4">
            {sortedBadges.map((badge) => {
              const unlocked = totalCheckIns >= badge.required_checkins;
              const isActive = activeBadgeId === badge.id;
              const color = BADGE_COLORS[badge.key] ?? BADGE_COLORS["iniciante"];
              const busy = isSelecting === badge.id;

              return (
                <button
                  key={badge.id}
                  disabled={isReadOnly || !unlocked || busy}
                  onClick={() => handleSelect(badge)}
                  className={cn(
                    "w-full text-left group relative overflow-hidden rounded-2xl transition-all duration-300 border",
                    isReadOnly
                      ? cn(
                          "bg-gradient-to-r cursor-default",
                          unlocked ? color.active : "bg-muted/30 border-border/20 opacity-60 grayscale",
                          isActive ? `ring-2 ${color.ring} border-transparent` : unlocked ? "border-border/60" : ""
                        )
                      : unlocked
                      ? cn(
                          "bg-gradient-to-r cursor-pointer hover:scale-[1.02] active:scale-95",
                          color.active,
                          isActive ? `ring-2 ${color.ring} border-transparent` : "border-border/60"
                        )
                      : "bg-muted/30 border-border/20 opacity-60 grayscale cursor-not-allowed"
                  )}
                >
                  <div className="p-4 flex items-center gap-4">
                    <div className={cn(
                      "text-4xl transition-all duration-500",
                      unlocked ? "scale-110 drop-shadow-md" : "scale-90",
                      isActive ? "animate-bounce-subtle" : ""
                    )}>
                      {badge.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm tracking-tight">{badge.name}</p>
                          {isActive && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand/20 text-brand font-bold uppercase tracking-wider">
                              {t("badges_active")}
                            </span>
                          )}
                        </div>
                        {unlocked && !isReadOnly && (
                          <div className={cn(
                            "h-5 w-5 rounded-full flex items-center justify-center transition-all",
                            isActive ? "bg-brand text-white" : "border border-border/60"
                          )}>
                            {busy ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : isActive ? (
                              <Check className="h-4 w-4 stroke-[3]" />
                            ) : null}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{badge.description}</p>
                      
                      {!unlocked && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                             <div 
                               className="bg-muted-foreground/30 h-full transition-all" 
                               style={{ width: `${(totalCheckIns / badge.required_checkins) * 100}%` }}
                             />
                          </div>
                          <p className="text-[10px] font-bold text-muted-foreground tabular-nums whitespace-nowrap">
                            {totalCheckIns}/{badge.required_checkins}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {isActive && (
                    <div className="absolute top-0 right-0 p-1 opacity-20 pointer-events-none">
                       <Check size={40} className="stroke-[10]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-border/60 p-5 bg-background/95 sticky bottom-0">
          <p className="text-xs font-medium text-muted-foreground text-center">
            {isMaxed
              ? t("badges_bottom_maxed")
              : t("badges_bottom_progress")
            }
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
