import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { BadgeMedallion, BADGE_ACCENT_GRADIENT } from "@/components/shared/badge-medallion";
import { useLanguage } from "@/lib/language-context";
import type { Badge } from "@/lib/ritmofit-db";
import { badgeDescription, badgeName } from "@/lib/badges";

interface BadgeUnlockedDialogProps {
  badges: Badge[];
  onClose: () => void;
}

/**
 * Celebração do fim do treino — uma insígnia por vez, "Próxima" até a última.
 * Mesmo medalhão do pop up de conquista e do drawer (`BadgeMedallion`), sobre
 * um card escuro com o brilho âmbar da conquista (2026-10-06).
 */
export function BadgeUnlockedDialog({ badges, onClose }: BadgeUnlockedDialogProps) {
  const { t } = useLanguage();
  const [index, setIndex] = React.useState(0);

  if (badges.length === 0) return null;

  const badge = badges[index];
  const isLast = index === badges.length - 1;
  const name = badgeName(badge, t);

  const handleNext = () => {
    if (isLast) onClose();
    else setIndex((i) => i + 1);
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-w-[330px] gap-0 overflow-hidden rounded-[28px] border-0 p-0 text-center text-white"
        style={{
          background: "linear-gradient(180deg,#2a1f22 0%,#15121b 62%)",
          boxShadow: "0 0 0 1px rgba(255,180,110,.22), 0 30px 70px -20px rgba(0,0,0,.85)",
        }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Brilho atrás do medalhão */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-56"
          style={{ background: "radial-gradient(circle at 50% 42%, rgba(255,150,60,.38), transparent 62%)" }}
        />

        <div className="relative px-6 pt-8" style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
          <p
            className="text-[12px] font-extrabold uppercase tracking-[0.1em] bg-clip-text text-transparent"
            style={{ backgroundImage: BADGE_ACCENT_GRADIENT }}
          >
            {t("badge_banner_kicker_one")}
          </p>

          <AnimatePresence mode="wait">
            <motion.div
              key={badge.id}
              className="flex flex-col items-center"
              initial={{ opacity: 0, scale: 0.6, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -6 }}
              transition={{ type: "spring", stiffness: 340, damping: 20 }}
            >
              <BadgeMedallion emoji={badge.emoji} size="lg" glow className="mt-5" />
              <DialogTitle className="mt-5 text-[22px] font-extrabold leading-tight text-white">{name}</DialogTitle>
              <DialogDescription className="mt-1.5 px-2 text-[14px] leading-snug text-white/65">
                {badgeDescription(badge, t)}
              </DialogDescription>
            </motion.div>
          </AnimatePresence>

          {badges.length > 1 && (
            <div
              className="mt-5 flex items-center justify-center gap-1.5"
              aria-label={t("badge_dialog_progress")
                .replace("{current}", String(index + 1))
                .replace("{total}", String(badges.length))}
            >
              {badges.map((b, i) => (
                <span
                  key={b.id}
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: i === index ? 18 : 6,
                    background: i <= index ? BADGE_ACCENT_GRADIENT : "rgba(255,255,255,.2)",
                  }}
                />
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleNext}
            className="mt-6 h-12 w-full rounded-full text-[15px] font-bold text-[#1a1208] active:scale-[0.98] transition-transform"
            style={{ background: BADGE_ACCENT_GRADIENT, boxShadow: "0 10px 24px -10px rgba(255,138,42,.8)" }}
          >
            {isLast ? t("badge_dialog_confirm") : t("badge_dialog_next")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
