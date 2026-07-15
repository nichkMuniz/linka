import React from "react";
import { Check, Crown, Star, Loader2 } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { type Badge, type UserBadge, setSelectedBadgeDb, getViewer, isBadgeUnlocked } from "@/lib/ritmofit-db";
import { PaywallDrawer } from "@/components/shared/paywall-drawer";
import { usePremium } from "@/lib/premium-context";
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
  /** ID da insígnia escolhida pelo usuário (persistida em profiles.selected_badge_id) */
  selectedBadgeId?: string | null;
  /** Callback opcional para o pai recarregar dados após troca de insígnia */
  onSelected?: () => void | Promise<void>;
}

const BADGE_COLORS: Record<string, { active: string; check: string; bar: string; ring: string }> = {
  iniciante: { active: "from-yellow-500/20 to-yellow-500/5 border-yellow-500/40 shadow-yellow-500/10", check: "text-yellow-600", bar: "bg-yellow-500", ring: "ring-yellow-500/40" },
  sequencia: { active: "from-orange-500/20 to-orange-500/5 border-orange-500/40 shadow-orange-500/10", check: "text-orange-600", bar: "bg-orange-500", ring: "ring-orange-500/40" },
  campeao:   { active: "from-green-500/20 to-green-500/5 border-green-500/40 shadow-green-500/10", check: "text-green-600",  bar: "bg-green-500",  ring: "ring-green-500/40"  },
  lendario:  { active: "from-purple-500/20 to-purple-500/5 border-purple-500/40 shadow-purple-500/10", check: "text-purple-600", bar: "bg-purple-500", ring: "ring-purple-500/40" },
  premium_coroa:    { active: "from-amber-500/20 to-amber-500/5 border-amber-500/40 shadow-amber-500/10", check: "text-amber-600", bar: "bg-amber-500", ring: "ring-amber-500/40" },
  premium_diamante: { active: "from-cyan-400/20 to-cyan-400/5 border-cyan-400/40 shadow-cyan-400/10", check: "text-cyan-500", bar: "bg-cyan-400", ring: "ring-cyan-400/40" },
};

export function InsigniasDrawer({ open, onOpenChange, userBadges, allBadges, totalCheckIns, profileUserId, selectedBadgeId, onSelected }: InsigniasDrawerProps) {
  const { t } = useLanguage();
  const { isPremium } = usePremium();
  const [isSelecting, setIsSelecting] = React.useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [overrideActiveId, setOverrideActiveId] = React.useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = React.useState(false);

  // Get current user to check if we can select
  React.useEffect(() => {
    getViewer().then(u => setCurrentUserId(u?.id || null));
  }, []);

  // Se profileUserId foi passado e é diferente do viewer, é perfil alheio
  const isReadOnly = !!profileUserId && !!currentUserId && profileUserId !== currentUserId;

  const activeBadgeId = overrideActiveId ?? selectedBadgeId ?? null;

  // Acervo conquistado — é ele que libera a seleção, não o total de check-ins.
  const earnedIds = React.useMemo(
    () => new Set(userBadges.map((ub) => String(ub.badge_id))),
    [userBadges]
  );

  // Reseta override quando o pai atualiza userBadges (ou ao fechar o drawer)
  React.useEffect(() => {
    if (!open) setOverrideActiveId(null);
  }, [open]);
  React.useEffect(() => {
    setOverrideActiveId(null);
  }, [userBadges]);

  // Sort badges by required_checkins to ensure correct order
  const sortedBadges = [...allBadges].sort((a, b) => a.required_checkins - b.required_checkins);

  // Barra de progresso "próximo nível": só as insígnias de `checkin_total` medem
  // o total de check-ins. Nas outras (streak, madrugador, treino por tipo…),
  // `required_checkins` é o limiar de OUTRA métrica — usá-lo aqui exibiria um
  // progresso falso ("5/7 check-ins" para uma insígnia que pede 7 dias seguidos).
  // Insígnias premium ficam fora do cálculo: required_checkins = 0 nelas é só
  // o "desbloqueio por status", não um marco de check-ins.
  const checkinTotalBadges = sortedBadges.filter((b) => b.condition_type === "checkin_total" && !b.premium);
  const nextBadge = checkinTotalBadges.find((b) => b.required_checkins > totalCheckIns);
  const targetRequired = nextBadge
    ? nextBadge.required_checkins
    : checkinTotalBadges.length > 0
      ? checkinTotalBadges[checkinTotalBadges.length - 1].required_checkins
      : 0;
  const isMaxed = !nextBadge && checkinTotalBadges.length > 0;

  const handleSelect = async (badge: Badge) => {
    if (isReadOnly) return;
    if (isSelecting) return;
    // Insígnia premium: visível pra todos (gera desejo), selecionável só por
    // assinante — o toque de usuário grátis abre o paywall.
    if (badge.premium && !isPremium) {
      setPaywallOpen(true);
      return;
    }
    if (!isBadgeUnlocked(badge, earnedIds, totalCheckIns)) {
      toast.error(t("badges_not_reached"));
      return;
    }
    if (badge.id === activeBadgeId) return;

    try {
      setIsSelecting(badge.id);
      // Atualização otimista: marca como ativa imediatamente para feedback instantâneo
      setOverrideActiveId(badge.id);
      await setSelectedBadgeDb(badge.id);
      toast.success(t("badges_selected").replace("{name}", badge.name));
      // Pede ao pai para recarregar dados em segundo plano (sem reload da tela)
      try {
        await onSelected?.();
      } catch {
        // ignore
      }
    } catch (err: any) {
      // Reverte estado otimista em caso de erro
      setOverrideActiveId(null);
      if (err?.message === "BADGE_PREMIUM_LOCKED") {
        toast.error(t("premium_badge_locked"));
        setPaywallOpen(true);
      } else {
        toast.error(
          err?.message === "BADGE_NOT_UNLOCKED" ? t("badges_not_reached") : t("badges_error")
        );
      }
    } finally {
      setIsSelecting(null);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
        className="max-h-[85dvh] flex flex-col pb-6 !rounded-t-[32px] !border-0"
        style={{
          background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderTop: "1px solid rgba(255,255,255,.14)",
        }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DrawerHeader className="shrink-0">
          <DrawerTitle className="flex items-center gap-2" style={{ color: "#fff" }}>
            <span className="text-2xl">🏆</span>
            {t("badges_title")}
          </DrawerTitle>
          <DrawerDescription className="" style={{ color: "rgba(255,255,255,.5)" }}>
            {t("badges_desc")}
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-hide">
          {/* Progress Overview - Integrated logic for NEXT level */}
          <div className="mb-6 p-4 rounded-2xl shadow-sm" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-brand animate-pulse" />
                <p className="font-semibold text-sm" style={{ color: "#fff" }}>{t("badges_next_level")}</p>
              </div>
              <p className="font-bold text-lg tabular-nums" style={{ color: "#fff" }}>
                {totalCheckIns}/{targetRequired}
              </p>
            </div>
            <div className="w-full bg-muted/50 rounded-full h-3 p-0.5 overflow-hidden ring-1 ring-border/50">
              <div
                className="bg-brand transition-all duration-1000 h-full rounded-full shadow-[0_0_10px_rgba(var(--brand),0.3)]"
                style={{ width: `${Math.min(100, (totalCheckIns / targetRequired) * 100)}%` }}
              />
            </div>
            <p className="text-xs mt-3 font-medium" style={{ color: "rgba(255,255,255,.5)" }}>
              {isMaxed
                ? t("badges_maxed")
                : nextBadge
                  ? t("badges_remaining").replace("{n}", String(nextBadge.required_checkins - totalCheckIns)).replace("{name}", nextBadge.name)
                  : t("badges_keep_training")}
            </p>
          </div>

          <div className="space-y-4 pb-4">
            {sortedBadges.map((badge) => {
              const unlocked = isBadgeUnlocked(badge, earnedIds, totalCheckIns);
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
                          {badge.premium && (
                            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-500 font-bold uppercase tracking-wider">
                              <Crown className="h-3 w-3" />
                              {t("premium_badge_tag")}
                            </span>
                          )}
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
                      <p className="text-xs mt-1 line-clamp-1" style={{ color: "rgba(255,255,255,.5)" }}>{badge.description}</p>
                      
                      {/* Progresso só faz sentido quando a métrica É o total de
                          check-ins. Nos outros tipos a condição está na descrição. */}
                      {!unlocked && badge.condition_type === "checkin_total" && badge.required_checkins > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                             <div
                               className="bg-muted-foreground/30 h-full transition-all"
                               style={{ width: `${Math.min(100, (totalCheckIns / badge.required_checkins) * 100)}%` }}
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

        <div className="p-5 sticky bottom-0" style={{ borderTop: "1px solid rgba(255,255,255,.08)", background: "rgba(14,13,20,.95)" }}>
          <p className="text-xs font-medium text-center" style={{ color: "rgba(255,255,255,.5)" }}>
            {isMaxed
              ? t("badges_bottom_maxed")
              : t("badges_bottom_progress")
            }
          </p>
        </div>
      </DrawerContent>

      <PaywallDrawer open={paywallOpen} onOpenChange={setPaywallOpen} feature="badges" />
    </Drawer>
  );
}
