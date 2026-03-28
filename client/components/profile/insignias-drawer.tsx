import React from "react";
import { Check } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { Badge, UserBadge } from "@/lib/ritmofit-db";

interface InsigniasDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userBadges: UserBadge[];
  allBadges: Badge[];
  /** Total de check-ins acumulados do usuário (todos os tempos) */
  totalCheckIns: number;
}

const BADGE_COLORS: Record<string, { active: string; check: string; bar: string }> = {
  iniciante: { active: "from-yellow-500/20 to-yellow-500/5 border-yellow-500/40 shadow-yellow-500/10", check: "text-yellow-600", bar: "bg-yellow-500" },
  sequencia: { active: "from-blue-500/20 to-blue-500/5 border-blue-500/40 shadow-blue-500/10",   check: "text-blue-600",   bar: "bg-blue-500"   },
  campeao:   { active: "from-green-500/20 to-green-500/5 border-green-500/40 shadow-green-500/10", check: "text-green-600",  bar: "bg-green-500"  },
  lendario:  { active: "from-purple-500/20 to-purple-500/5 border-purple-500/40 shadow-purple-500/10", check: "text-purple-600", bar: "bg-purple-500" },
};

export function InsigniasDrawer({ open, onOpenChange, userBadges, allBadges, totalCheckIns }: InsigniasDrawerProps) {
  const earnedIds = new Set(userBadges.map((ub) => ub.badge_id));

  // Próximo badge ainda não conquistado (para mostrar meta no overview)
  const maxRequired = allBadges.length > 0 ? allBadges[allBadges.length - 1].required_checkins : 7;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[80dvh] flex flex-col bg-gradient-to-b from-background via-background to-muted/30">
        <DrawerHeader className="shrink-0 border-b border-border/60">
          <DrawerTitle className="flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            Insígnias
          </DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* Progress Overview */}
          <div className="mb-6 p-4 rounded-lg bg-brand/10 border border-brand/20">
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium text-sm">Check-ins totais</p>
              <p className="font-bold text-lg">{totalCheckIns}/{maxRequired}</p>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-brand transition-all duration-300 h-full rounded-full"
                style={{ width: `${Math.min(100, (totalCheckIns / maxRequired) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {totalCheckIns >= maxRequired
                ? "Parabéns! Você conquistou todas as insígnias!"
                : `Faltam ${maxRequired - totalCheckIns} check-in(s) para a insígnia máxima`}
            </p>
          </div>

          <div className="space-y-3 pb-8">
            {allBadges.map((badge) => {
              const unlocked = earnedIds.has(badge.id);
              const color = BADGE_COLORS[badge.key] ?? BADGE_COLORS["iniciante"];
              return (
                <div
                  key={badge.id}
                  className={`group relative overflow-hidden rounded-xl transition-all duration-300 ${
                    unlocked
                      ? `bg-gradient-to-r ${color.active} shadow-lg`
                      : "bg-muted/40 border border-border/40 opacity-60"
                  }`}
                >
                  <div className="p-4 flex items-start gap-4">
                    <div className={`text-4xl transition-transform ${unlocked ? "scale-110" : ""} ${badge.required_checkins === maxRequired && unlocked ? "animate-pulse" : ""}`}>
                      {badge.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm">{badge.name}</p>
                        {unlocked && (
                          <Check className={`h-5 w-5 flex-shrink-0 ${color.check}`} />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{badge.description}</p>
                      {!unlocked && (
                        <div className="mt-2">
                          <p className="text-xs text-muted-foreground mb-1">
                            {Math.min(totalCheckIns, badge.required_checkins)}/{badge.required_checkins} check-ins
                          </p>
                          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`${color.bar} h-full transition-all`}
                              style={{ width: `${(Math.min(totalCheckIns, badge.required_checkins) / badge.required_checkins) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-border/60 p-4 bg-background/95 sticky bottom-0">
          <p className="text-xs text-muted-foreground text-center">
            Complete check-ins diários para ganhar insígnias!
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
