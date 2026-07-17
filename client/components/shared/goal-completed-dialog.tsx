import { Share2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language-context";

interface GoalCompletedDialogProps {
  goalDescription: string;
  /**
   * Quando presente, exibe "Compartilhar conquista" como ação primária. O pai
   * é quem fecha este diálogo e abre o GoalShareDrawer: ambos vivem em z-300/310
   * e o diálogo Radix trava o body com pointer-events:none — abrir o drawer por
   * cima o deixaria visível porém congelado.
   */
  onShare?: () => void;
  onClose: () => void;
}

export function GoalCompletedDialog({ goalDescription, onShare, onClose }: GoalCompletedDialogProps) {
  const { t } = useLanguage();

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-w-xs text-center"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-center text-lg">
            {t("goals_completed_dialog_title")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-4">
          <span className="text-7xl leading-none select-none" role="img" aria-label={t("goals_completed_dialog_trophy_alt")}>
            🏆
          </span>
          <p className="text-sm font-semibold px-2">{goalDescription}</p>
          <p className="text-sm text-muted-foreground px-2">
            {t("goals_completed_dialog_desc")}
          </p>
        </div>

        <div className="space-y-2">
          {onShare && (
            <Button
              className="w-full gap-2"
              style={{ background: "#22c55e", color: "#fff" }}
              onClick={onShare}
            >
              <Share2 className="h-4 w-4" />
              {t("goals_gd_share")}
            </Button>
          )}
          <Button
            variant={onShare ? "outline" : "default"}
            className="w-full"
            onClick={onClose}
          >
            {t("goals_completed_dialog_cta")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
