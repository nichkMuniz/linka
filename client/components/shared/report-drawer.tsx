import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { useLanguage } from "@/lib/language-context";
import { Check } from "lucide-react";

interface ReportTarget {
  id: string;
  userId: string;
  userName: string;
  description?: string | null;
}

interface ReportDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "user" | "post" | "shot" | null;
  target: ReportTarget | null;
}

// `value` é gravado no banco (sempre em PT, para o painel de admin ficar
// consistente entre usuários de idiomas diferentes); `key` é o que aparece na tela.
const REPORT_REASONS = [
  { key: "report_reason_inappropriate", value: "Conteúdo inadequado" },
  { key: "report_reason_spam", value: "Spam" },
  { key: "report_reason_harassment", value: "Assédio ou bullying" },
  { key: "report_reason_copyright", value: "Violação de direitos autorais" },
  { key: "report_reason_other", value: "Outro" },
] as const;

export function ReportDrawer({ open, onOpenChange, type, target }: ReportDrawerProps) {
  const { t } = useLanguage();
  const [reason, setReason] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  const handleSubmit = async () => {
    if (!type || !target || !reason.trim()) {
      toast({ title: t("error"), description: t("report_select_reason"), variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      if (type === "user") {
        const { reportUserDb } = await import("@/lib/ritmofit-db");
        await reportUserDb(target.userId, reason);
      } else if (type === "shot") {
        const { reportShotDb } = await import("@/lib/ritmofit-db");
        await reportShotDb(target.id, reason);
      } else {
        const { reportPostDb } = await import("@/lib/ritmofit-db");
        await reportPostDb(target.id, reason);
      }
      toast({
        title: t("report_sent_title"),
        description:
          type === "user"
            ? t("report_sent_user_desc")
            : type === "shot"
              ? t("report_sent_shot_desc")
              : t("report_sent_post_desc"),
      });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: t("report_error_title"), description: err?.message || t("report_error_desc"), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
        className="!rounded-t-[32px] !border-0"
        style={{
          background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderTop: "1px solid rgba(255,255,255,.14)",
        }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DrawerHeader>
          <DrawerTitle style={{ color: "#fff" }}>
            {type === "user" ? t("report_user") : type === "shot" ? t("report_shot") : t("report_post")}
          </DrawerTitle>
          {target && (
            <p className="text-sm" style={{ color: "rgba(255,255,255,.5)" }}>
              {(type === "user"
                ? t("report_target_user")
                : type === "shot"
                  ? t("report_target_shot")
                  : t("report_target_post")
              ).replace("{name}", target.userName)}
              {type !== "user" && target.description && (
                <span className="block mt-0.5 text-xs line-clamp-1">"{target.description}"</span>
              )}
            </p>
          )}
        </DrawerHeader>

        {target && (
          <div className="px-4 pb-6 space-y-3">
            <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,.5)" }}>{t("report_reason_title")}</p>

            {REPORT_REASONS.map((r) => (
              <button
                key={r.key}
                onClick={() => setReason(r.value)}
                className="w-full flex items-center gap-3 rounded-2xl p-4 text-left active:scale-[0.99] transition-all"
                style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}
              >
                <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${reason === r.value ? "bg-primary border-primary" : ""}`} style={reason !== r.value ? { borderColor: "rgba(255,255,255,.3)" } : undefined}>
                  {reason === r.value && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                <span className="text-sm font-medium flex-1" style={{ color: "#fff" }}>{t(r.key)}</span>
              </button>
            ))}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 rounded-full"
                style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.7)", border: "1px solid rgba(255,255,255,.12)" }}
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                {t("cancel")}
              </Button>
              <Button
                className="flex-1 rounded-full"
                style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
                onClick={handleSubmit}
                disabled={isSubmitting || !reason.trim()}
              >
                {isSubmitting ? t("report_submitting") : t("report_submit")}
              </Button>
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
