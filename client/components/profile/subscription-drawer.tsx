import * as React from "react";
import { ArrowLeft, Crown, ExternalLink } from "lucide-react";
import { Browser } from "@capacitor/browser";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLanguage } from "@/lib/language-context";
import { getSubscriptionDb, type Subscription } from "@/lib/ritmofit-db";

// Única forma de cancelar uma assinatura de IAP no iOS — a Apple não expõe API
// de cancelamento ao app (App Store Review Guidelines 3.1.2). Abrir esta URL no
// iOS cai direto na tela de assinaturas do Apple ID.
const APPLE_SUBSCRIPTIONS_URL = "https://apps.apple.com/account/subscriptions";

interface SubscriptionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Altura do viewport (mesmo cálculo do settings-drawer, teclado/safe area). */
  viewportHeight: number;
}

export function SubscriptionDrawer({
  open,
  onOpenChange,
  viewportHeight,
}: SubscriptionDrawerProps) {
  const { t, language } = useLanguage();
  const [subscription, setSubscription] = React.useState<Subscription | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setSubscription(await getSubscriptionDb());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Recarrega a cada abertura — status/datas são escritos por um terceiro
  // (service role/webhook), então o valor da abertura anterior pode estar velho.
  React.useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(language === "en" ? "en-US" : "pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

  const statusLabel = (status: string) => {
    if (status === "active") return t("settings_subscription_status_active");
    if (status === "cancelled") return t("settings_subscription_status_cancelled");
    if (status === "expired") return t("settings_subscription_status_expired");
    return t("settings_subscription_status_inactive");
  };

  const statusColor = (status: string) => {
    if (status === "active") return { bg: "rgba(34,197,94,.15)", fg: "#4ade80" };
    if (status === "cancelled" || status === "expired")
      return { bg: "rgba(249,115,22,.15)", fg: "#fb923c" };
    return { bg: "rgba(255,255,255,.08)", fg: "rgba(255,255,255,.6)" };
  };

  // Fase 1: acesso liberado via SQL (store/product 'manual'). Não há cobrança,
  // então não existe assinatura na Apple para gerenciar nem cancelar.
  const isManual = !subscription?.store || subscription.store === "manual";
  const isAppStore = subscription?.store === "app_store";

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-center justify-between gap-3 py-3">
      <span className="text-sm" style={{ color: "rgba(255,255,255,.5)" }}>{label}</span>
      <span className="text-sm font-medium text-right" style={{ color: "#fff" }}>{value}</span>
    </div>
  );

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
          className="flex flex-col modal-enter !rounded-t-[32px] !border-0"
          style={{
            maxHeight: `min(80dvh, ${viewportHeight - 8}px)`,
            background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
            backdropFilter: "blur(40px) saturate(180%)",
            WebkitBackdropFilter: "blur(40px) saturate(180%)",
            borderTop: "1px solid rgba(255,255,255,.14)",
          }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DrawerHeader className="shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenChange(false)}
                className="p-1 rounded-full transition-colors"
                style={{ color: "rgba(255,255,255,.7)" }}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <DrawerTitle style={{ color: "#fff" }}>{t("settings_subscription_title")}</DrawerTitle>
            </div>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
            {loading ? (
              <p className="text-sm text-center py-8" style={{ color: "rgba(255,255,255,.5)" }}>
                {t("settings_subscription_loading")}
              </p>
            ) : error ? (
              <div className="py-8 space-y-3 text-center">
                <p className="text-sm" style={{ color: "rgba(255,255,255,.5)" }}>
                  {t("settings_subscription_error")}
                </p>
                <Button
                  variant="outline"
                  className="rounded-full"
                  style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.7)", border: "1px solid rgba(255,255,255,.12)" }}
                  onClick={() => void load()}
                >
                  {t("settings_subscription_retry")}
                </Button>
              </div>
            ) : !subscription ? (
              <p className="text-sm text-center py-8" style={{ color: "rgba(255,255,255,.5)" }}>
                {t("settings_subscription_none")}
              </p>
            ) : (
              <>
                {/* Cabeçalho do plano */}
                <div
                  className="rounded-2xl p-4 flex items-center gap-3"
                  style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}
                >
                  <div
                    className="h-11 w-11 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "rgba(245,158,11,.15)" }}
                  >
                    <Crown className="h-5 w-5" style={{ color: "#f59e0b" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold" style={{ color: "#fff" }}>
                      {t("settings_subscription_plan_name")}
                    </p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
                      {isAppStore
                        ? t("settings_subscription_store_app_store")
                        : t("settings_subscription_store_manual")}
                    </p>
                  </div>
                  <span
                    className="shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{
                      background: statusColor(subscription.status).bg,
                      color: statusColor(subscription.status).fg,
                    }}
                  >
                    {statusLabel(subscription.status)}
                  </span>
                </div>

                {/* Detalhes */}
                {/* divide-white/10 explícito: sem isso os separadores herdam a
                    cor de borda do tema, que não é legível neste drawer escuro */}
                <div
                  className="rounded-2xl px-4 divide-y divide-white/10"
                  style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}
                >
                  <Row
                    label={t("settings_subscription_status")}
                    value={statusLabel(subscription.status)}
                  />
                  <Row
                    label={t("settings_subscription_started")}
                    value={formatDate(subscription.created_at)}
                  />
                  <Row
                    label={t("settings_subscription_billing")}
                    value={
                      isAppStore
                        ? t("settings_subscription_store_app_store")
                        : t("settings_subscription_store_manual")
                    }
                  />
                  {/* Assinatura cancelada ainda vale até o fim do período pago —
                      a mesma data muda de "próxima cobrança" para "acesso até". */}
                  <Row
                    label={
                      subscription.status === "cancelled" || subscription.status === "expired"
                        ? t("settings_subscription_access_until")
                        : t("settings_subscription_next_charge")
                    }
                    value={
                      subscription.current_period_end
                        ? formatDate(subscription.current_period_end)
                        : t("settings_subscription_no_expiry")
                    }
                  />
                </div>

                {isManual ? (
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,.45)" }}>
                    {t("settings_subscription_manual_note")}
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    <Button
                      variant="outline"
                      className="w-full rounded-full gap-2 justify-between"
                      style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.7)", border: "1px solid rgba(255,255,255,.12)" }}
                      onClick={() => void Browser.open({ url: APPLE_SUBSCRIPTIONS_URL })}
                    >
                      <span>{t("settings_subscription_manage_apple")}</span>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    {subscription.status === "active" && (
                      <Button
                        variant="ghost"
                        className="w-full rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setCancelConfirmOpen(true)}
                      >
                        {t("settings_subscription_cancel")}
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings_subscription_cancel_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings_subscription_cancel_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("settings_subscription_cancel_back")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setCancelConfirmOpen(false);
                void Browser.open({ url: APPLE_SUBSCRIPTIONS_URL });
              }}
            >
              {t("settings_subscription_cancel_open")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
