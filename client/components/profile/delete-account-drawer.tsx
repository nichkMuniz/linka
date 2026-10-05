import * as React from "react";
import { Check, ChevronLeft, LogOut, Trash2, Undo2 } from "lucide-react";

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { useKeyboardAwareHeight } from "@/hooks/use-keyboard-aware-height";
import { useKeyboardInputScroll } from "@/hooks/use-keyboard-input-scroll";
import { useLanguage } from "@/lib/language-context";
import type { TranslationKey } from "@/lib/i18n";
import { reportHandledError } from "@/lib/monitoring";
import { resetSupabaseAuth } from "@/lib/supabase";
import type { AccountDeletionReason } from "@/lib/ritmofit-db";

/** Prazo até a exclusão definitiva — o servidor usa o mesmo (`request_account_deletion`). */
const GRACE_DAYS = 30;

const REASONS: { value: AccountDeletionReason; key: TranslationKey }[] = [
  { value: "no_longer_use", key: "account_deletion_reason_no_longer_use" },
  { value: "other_app", key: "account_deletion_reason_other_app" },
  { value: "missing_features", key: "account_deletion_reason_missing_features" },
  { value: "bugs", key: "account_deletion_reason_bugs" },
  { value: "too_many_notifications", key: "account_deletion_reason_too_many_notifications" },
  { value: "privacy", key: "account_deletion_reason_privacy" },
  { value: "new_account", key: "account_deletion_reason_new_account" },
  { value: "other", key: "account_deletion_reason_other" },
];

export function formatDeletionDate(iso: string | Date, language: string): string {
  return new Date(iso).toLocaleDateString(language === "en" ? "en-US" : "pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface DeleteAccountDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

/**
 * "Encerrar conta" em dois passos: o motivo (justificativa) e a explicação do
 * prazo de 30 dias antes de confirmar. Confirmar NÃO apaga nada na hora —
 * agenda a exclusão, a conta some para todos e a pessoa sai do app. Entrar de
 * novo dentro do prazo mostra a `PendingDeletionScreen`, que reativa.
 */
export function DeleteAccountDrawer({ open, onOpenChange, userId }: DeleteAccountDrawerProps) {
  const { t, language } = useLanguage();
  const [step, setStep] = React.useState<"reason" | "confirm">("reason");
  const [reason, setReason] = React.useState<AccountDeletionReason | null>(null);
  const [details, setDetails] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const viewportHeight = useKeyboardAwareHeight();
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  useKeyboardInputScroll(scrollRef, open);

  React.useEffect(() => {
    if (!open) {
      setStep("reason");
      setReason(null);
      setDetails("");
    }
  }, [open]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [step]);

  const detailsRequired = reason === "other";
  const canContinue = !!reason && (!detailsRequired || details.trim().length > 0);
  const previewDate = formatDeletionDate(new Date(Date.now() + GRACE_DAYS * 864e5), language);

  const handleConfirm = async () => {
    if (!reason) return;
    setSubmitting(true);
    try {
      const { requestAccountDeletionDb, revokeAppleSignInDb } = await import("@/lib/ritmofit-db");
      const scheduledFor = await requestAccountDeletionDb(reason, details);
      // Apple exige revogar o Sign in with Apple na exclusão (5.1.1(v)). Feito
      // no pedido, com a sessão ainda viva; nunca lança. Reativar entrando com
      // a Apple de novo autoriza outra vez.
      await revokeAppleSignInDb();
      onOpenChange(false);
      toast({
        title: t("account_deletion_scheduled_toast"),
        description: t("account_deletion_scheduled_toast_desc").replace(
          "{date}",
          formatDeletionDate(scheduledFor, language),
        ),
      });
      // O listener do AuthProvider zera o user e o RequireAuth manda para /login.
      await resetSupabaseAuth();
    } catch (err: any) {
      reportHandledError(err, "profile:request-account-deletion", { userId, reason });
      toast({
        title: t("account_deletion_error"),
        description: err?.message || t("retry"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const timeline = [
    { icon: LogOut, title: t("account_deletion_now_title"), desc: t("account_deletion_now_desc"), tone: "#fbbf24" },
    { icon: Undo2, title: t("account_deletion_grace_title"), desc: t("account_deletion_grace_desc"), tone: "#7dd3a8" },
    {
      icon: Trash2,
      title: t("account_deletion_final_title").replace("{date}", previewDate),
      desc: t("account_deletion_final_desc"),
      tone: "#f87171",
    },
  ];

  return (
    <Drawer open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DrawerContent
        handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
        className="flex flex-col !rounded-t-[32px] !border-0"
        style={{
          maxHeight: `min(90dvh, ${viewportHeight - 8}px)`,
          background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderTop: "1px solid rgba(255,255,255,.14)",
        }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DrawerHeader className="shrink-0">
          <DrawerTitle style={{ color: "#fff" }}>
            {step === "reason" ? t("account_deletion_reason_title") : t("account_deletion_confirm_title")}
          </DrawerTitle>
          <DrawerDescription style={{ color: "rgba(255,255,255,.5)" }}>
            {step === "reason" ? t("account_deletion_reason_subtitle") : t("account_deletion_title")}
          </DrawerDescription>
        </DrawerHeader>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4"
          style={{ paddingBottom: "calc(1.5rem + var(--keyboard-height, 0px))" }}
        >
          {step === "reason" ? (
            <div className="space-y-2.5">
              {REASONS.map((r) => {
                const selected = reason === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setReason(r.value)}
                    className="w-full flex items-center gap-3 rounded-2xl p-4 text-left active:scale-[0.99] transition-all"
                    style={{
                      background: selected ? "rgba(91,140,255,.14)" : "rgba(255,255,255,.06)",
                      border: `1px solid ${selected ? "rgba(91,140,255,.45)" : "rgba(255,255,255,.1)"}`,
                    }}
                  >
                    <div
                      className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? "bg-primary border-primary" : ""}`}
                      style={!selected ? { borderColor: "rgba(255,255,255,.3)" } : undefined}
                    >
                      {selected && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <span className="text-sm font-medium flex-1" style={{ color: "#fff" }}>{t(r.key)}</span>
                  </button>
                );
              })}

              {reason && (
                <div className="space-y-2 pt-2">
                  <label className="text-sm font-medium" style={{ color: "rgba(255,255,255,.7)" }}>
                    {detailsRequired ? t("account_deletion_details_required") : t("account_deletion_details_optional")}
                  </label>
                  <Textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value.slice(0, 1000))}
                    placeholder={t("account_deletion_details_placeholder")}
                    maxLength={1000}
                    className="min-h-24"
                    style={{
                      background: "rgba(255,255,255,.07)",
                      border: "1px solid rgba(255,255,255,.12)",
                      color: "#fff",
                    }}
                  />
                </div>
              )}

              <div className="flex gap-2 pt-3">
                <Button
                  variant="outline"
                  className="flex-1 rounded-full"
                  style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.7)", border: "1px solid rgba(255,255,255,.12)" }}
                  onClick={() => onOpenChange(false)}
                >
                  {t("cancel")}
                </Button>
                <Button
                  className="flex-1 rounded-full"
                  style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
                  onClick={() => setStep("confirm")}
                  disabled={!canContinue}
                >
                  {t("account_deletion_continue")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {timeline.map(({ icon: Icon, title, desc, tone }) => (
                <div
                  key={title}
                  className="flex gap-3 rounded-2xl p-4"
                  style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}
                >
                  <div
                    className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center"
                    style={{ background: `${tone}22`, color: tone }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold" style={{ color: "#fff" }}>{title}</p>
                    <p className="text-[13px] leading-snug" style={{ color: "rgba(255,255,255,.6)" }}>{desc}</p>
                  </div>
                </div>
              ))}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="rounded-full px-4"
                  style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.7)", border: "1px solid rgba(255,255,255,.12)" }}
                  onClick={() => setStep("reason")}
                  disabled={submitting}
                  aria-label={t("back")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 rounded-full gap-2"
                  onClick={handleConfirm}
                  disabled={submitting}
                >
                  <Trash2 className="h-4 w-4" />
                  {submitting ? t("account_deletion_submitting") : t("account_deletion_confirm_action")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
