import * as React from "react";
import { CalendarClock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { formatDeletionDate } from "@/components/profile/delete-account-drawer";
import { requestAppRefresh } from "@/lib/app-refresh";
import { useLanguage } from "@/lib/language-context";
import { reportHandledError } from "@/lib/monitoring";
import { resetSupabaseAuth } from "@/lib/supabase";

interface PendingDeletionScreenProps {
  /** Data (ISO) da exclusão definitiva. */
  scheduledFor: string;
  /** Chamado depois de cancelar o pedido no servidor. */
  onReactivated: () => void;
}

/**
 * Mostrada quando a pessoa entra numa conta com exclusão agendada (dentro dos
 * 30 dias). Enquanto o pedido existe, a conta fica escondida de todos no banco
 * — usar o app assim seria falar sozinho. Ou reativa, ou sai.
 */
export function PendingDeletionScreen({ scheduledFor, onReactivated }: PendingDeletionScreenProps) {
  const { t, language } = useLanguage();
  const [busy, setBusy] = React.useState<"reactivate" | "leave" | null>(null);

  async function handleReactivate() {
    setBusy("reactivate");
    try {
      const { cancelAccountDeletionDb } = await import("@/lib/ritmofit-db");
      await cancelAccountDeletionDb();
      // O que foi carregado durante a quarentena (contadores, listas) pode ter
      // vindo sem a própria conta — derruba o cache antes de mostrar o app.
      requestAppRefresh("resume", "pending-deletion");
      toast({ title: t("account_deletion_reactivated_toast"), description: t("account_deletion_reactivated_toast_desc") });
      onReactivated();
    } catch (err: any) {
      reportHandledError(err, "pending-deletion:reactivate");
      toast({ title: t("account_deletion_reactivate_error"), description: err?.message || t("retry"), variant: "destructive" });
      setBusy(null);
    }
  }

  async function handleLeave() {
    setBusy("leave");
    await resetSupabaseAuth();
    // O listener do AuthProvider zera o user e o RequireAuth manda para /login.
  }

  return (
    <div
      className="min-h-dvh bg-background flex flex-col items-center justify-center gap-6 px-8 text-center"
      style={{
        paddingTop: "max(2rem, env(safe-area-inset-top))",
        paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(2rem, env(safe-area-inset-left))",
        paddingRight: "max(2rem, env(safe-area-inset-right))",
      }}
    >
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: "rgba(251,191,36,.12)", border: "1px solid rgba(251,191,36,.25)" }}
      >
        <CalendarClock className="w-8 h-8" style={{ color: "#fbbf24" }} />
      </div>

      <div className="space-y-2">
        <h1 className="text-xl font-bold text-foreground">{t("account_deletion_pending_title")}</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t("account_deletion_pending_desc").replace("{date}", formatDeletionDate(scheduledFor, language))}
        </p>
      </div>

      <div className="w-full max-w-xs space-y-3">
        <Button
          onClick={handleReactivate}
          disabled={busy !== null}
          className="w-full rounded-full"
          style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
        >
          {busy === "reactivate" ? t("account_deletion_reactivating") : t("account_deletion_reactivate")}
        </Button>
        <Button variant="outline" onClick={handleLeave} disabled={busy !== null} className="w-full rounded-full">
          {t("settings_logout")}
        </Button>
      </div>
    </div>
  );
}
