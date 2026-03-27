import React from "react";
import { Check } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

interface InsigniasDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekCheckIns: number; // number of check-ins this week (0-7)
  level?: number; // fallback when check-in data is not available
}

export function InsigniasDrawer({ open, onOpenChange, weekCheckIns, level = 0 }: InsigniasDrawerProps) {
  // When check-in data is blocked by RLS, show estimated progress from level
  const effectiveCheckIns = weekCheckIns > 0 ? weekCheckIns : 0;
  const showLevelFallback = weekCheckIns === 0 && level > 0;
  const badges = [
    {
      emoji: "⭐",
      title: "Iniciante",
      description: "Complete check-in 1 dia",
      threshold: 1,
      color: { active: "from-yellow-500/20 to-yellow-500/5 border-yellow-500/40 shadow-yellow-500/10", check: "text-yellow-600", bar: "bg-yellow-500" },
    },
    {
      emoji: "🔥",
      title: "Sequência",
      description: "Complete check-in 3 dias",
      threshold: 3,
      color: { active: "from-blue-500/20 to-blue-500/5 border-blue-500/40 shadow-blue-500/10", check: "text-blue-600", bar: "bg-blue-500" },
    },
    {
      emoji: "💪",
      title: "Campeão",
      description: "Complete check-in 5 dias",
      threshold: 5,
      color: { active: "from-green-500/20 to-green-500/5 border-green-500/40 shadow-green-500/10", check: "text-green-600", bar: "bg-green-500" },
    },
    {
      emoji: "👑",
      title: "Lendário",
      description: "Complete check-in 7 dias (semana completa)",
      threshold: 7,
      color: { active: "from-purple-500/20 to-purple-500/5 border-purple-500/40 shadow-purple-500/10", check: "text-purple-600", bar: "bg-purple-500" },
    },
  ];

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
            {showLevelFallback ? (
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">Nível</p>
                <p className="font-bold text-lg">{level}</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-sm">Progresso Semanal</p>
                  <p className="font-bold text-lg">{effectiveCheckIns}/7</p>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-brand transition-all duration-300 h-full rounded-full"
                    style={{ width: `${(effectiveCheckIns / 7) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {7 - effectiveCheckIns === 0
                    ? "Parabéns! Você completou a semana!"
                    : `Faltam ${7 - effectiveCheckIns} dia(s) para completar a semana`}
                </p>
              </>
            )}
          </div>

          <div className="space-y-3 pb-8">
            {badges.map((badge) => {
              const unlocked = badge.threshold === 7 ? effectiveCheckIns === 7 : effectiveCheckIns >= badge.threshold;
              return (
                <div
                  key={badge.title}
                  className={`group relative overflow-hidden rounded-xl transition-all duration-300 ${
                    unlocked
                      ? `bg-gradient-to-r ${badge.color.active} shadow-lg`
                      : "bg-muted/40 border border-border/40 opacity-60"
                  }`}
                >
                  <div className="p-4 flex items-start gap-4">
                    <div className={`text-4xl transition-transform ${unlocked ? "scale-110" : ""} ${badge.threshold === 7 && unlocked ? "animate-pulse" : ""}`}>
                      {badge.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm">{badge.title}</p>
                        {unlocked && (
                          <Check className={`h-5 w-5 flex-shrink-0 ${badge.color.check}`} />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{badge.description}</p>
                      {!unlocked && (
                        <div className="mt-2">
                          <p className="text-xs text-muted-foreground mb-1">
                            {Math.min(effectiveCheckIns, badge.threshold)}/{badge.threshold} dias
                          </p>
                          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`${badge.color.bar} h-full transition-all`}
                              style={{ width: `${(Math.min(effectiveCheckIns, badge.threshold) / badge.threshold) * 100}%` }}
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
