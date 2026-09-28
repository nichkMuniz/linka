import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/shared/VerifiedBadge";
import { useLanguage } from "@/lib/language-context";
import type { VerifiedTier } from "@/lib/verified-tier";

interface VerifiedCongratsDialogProps {
  tier: VerifiedTier;
  /** Fechar pelo X / fora do modal. */
  onClose: () => void;
  /** Botão principal ("Ver meu selo") — o pai leva ao perfil. */
  onConfirm: () => void;
}

/**
 * Parabéns exibido uma única vez quando o usuário ganha (ou sobe de) selo de
 * verificação. Quem decide quando abrir é o AppLayout, comparando
 * `verified_tier` com `verified_seen_tier`.
 */
export function VerifiedCongratsDialog({ tier, onClose, onConfirm }: VerifiedCongratsDialogProps) {
  const { t } = useLanguage();
  const official = tier === "official";

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-w-xs text-center"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex justify-center pt-2">
          <div className="animate-in zoom-in-50 fade-in duration-500">
            <VerifiedBadge tier={tier} className="w-20 h-20" />
          </div>
        </div>

        <DialogHeader>
          <DialogTitle className="text-center text-lg">
            {official ? t("verified_congrats_title_official") : t("verified_congrats_title")}
          </DialogTitle>
          <DialogDescription className="text-center">
            {official ? t("verified_congrats_desc_official") : t("verified_congrats_desc")}
          </DialogDescription>
        </DialogHeader>

        <Button className="w-full mt-2" onClick={onConfirm}>
          {t("verified_congrats_cta")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
