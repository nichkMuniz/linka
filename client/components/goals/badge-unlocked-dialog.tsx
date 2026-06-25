import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language-context";
import type { Badge } from "@/lib/ritmofit-db";

interface BadgeUnlockedDialogProps {
  badges: Badge[];
  onClose: () => void;
}

export function BadgeUnlockedDialog({ badges, onClose }: BadgeUnlockedDialogProps) {
  const { t } = useLanguage();
  const [index, setIndex] = React.useState(0);

  if (badges.length === 0) return null;

  const badge = badges[index];
  const isLast = index === badges.length - 1;

  const handleNext = () => {
    if (isLast) {
      onClose();
    } else {
      setIndex((i) => i + 1);
    }
  };

  const checkinsLabel =
    badge.required_checkins > 0
      ? t("badge_dialog_checkins")
          .replace("{n}", String(badge.required_checkins))
          .replace("{s}", badge.required_checkins !== 1 ? "s" : "")
      : null;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-w-xs text-center"
        style={{
          paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
        }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-center text-lg">
            {t("goals_badge_unlocked")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-4">
          <span
            className="text-7xl leading-none select-none"
            role="img"
            aria-label={badge.name}
          >
            {badge.emoji}
          </span>
          <p className="text-xl font-bold">{badge.name}</p>
          <p className="text-sm text-muted-foreground px-2">{badge.description}</p>
          {checkinsLabel && (
            <p className="text-xs text-primary font-medium">{checkinsLabel}</p>
          )}
        </div>

        {badges.length > 1 && (
          <p className="text-xs text-muted-foreground mb-2">
            {t("badge_dialog_progress")
              .replace("{current}", String(index + 1))
              .replace("{total}", String(badges.length))}
          </p>
        )}

        <Button className="w-full" onClick={handleNext}>
          {isLast ? t("badge_dialog_confirm") : t("badge_dialog_next")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
