import * as React from "react";
import { useLocation } from "react-router-dom";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Bug, Send } from "lucide-react";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { useLanguage } from "@/lib/language-context";
import { useKeyboardAwareHeight } from "@/hooks/use-keyboard-aware-height";
import { useKeyboardInputScroll } from "@/hooks/use-keyboard-input-scroll";
import {
  APP_VERSION,
  flushMonitoring,
  sendProblemReport,
  type ProblemReportContext,
} from "@/lib/monitoring";

/** Abaixo disto o relato não diz nada acionável ("não funciona"). */
const MIN_MESSAGE_LENGTH = 10;

interface ReportProblemDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pré-preenche o campo de contato — o usuário pode apagar ou trocar. */
  defaultEmail?: string;
}

/**
 * Relato manual de problema.
 *
 * **Por que existe além do Sentry automático:** captura automática só pega erro
 * que ESTOURA. Boa parte dos bugs não estoura — o treino não salvou, a foto
 * subiu girada, o contador veio errado. Para o usuário "está bugado"; para o
 * SDK, nunca aconteceu nada. Este drawer é o único caminho para essa classe de
 * problema, e anexa sozinho o contexto técnico que o usuário não saberia
 * informar (versão, build, tela, plataforma).
 *
 * O relato vai para o mesmo painel dos erros automáticos, com a tag
 * `report_source: in_app`.
 */
export function ReportProblemDrawer({
  open,
  onOpenChange,
  defaultEmail,
}: ReportProblemDrawerProps) {
  const { t, language } = useLanguage();
  const location = useLocation();
  const viewportHeight = useKeyboardAwareHeight();
  useKeyboardInputScroll();

  const [message, setMessage] = React.useState("");
  const [email, setEmail] = React.useState(defaultEmail ?? "");
  const [isSending, setIsSending] = React.useState(false);
  const [build, setBuild] = React.useState("—");

  // Número de build (CFBundleVersion) só existe no nativo; no navegador o
  // plugin rejeita, e "—" é a resposta honesta.
  React.useEffect(() => {
    if (!open || !Capacitor.isNativePlatform()) return;
    CapApp.getInfo()
      .then((info) => setBuild(info.build))
      .catch(() => {});
  }, [open]);

  // Limpa ao reabrir — um relato já enviado não deve reaparecer no campo.
  React.useEffect(() => {
    if (open) {
      setMessage("");
      setEmail(defaultEmail ?? "");
    }
  }, [open, defaultEmail]);

  const buildContext = (): ProblemReportContext => ({
    appVersion: APP_VERSION,
    build,
    platform: Capacitor.getPlatform(),
    screen: location.pathname,
    language,
    online: navigator.onLine,
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
  });

  const handleSubmit = async () => {
    const trimmed = message.trim();
    if (trimmed.length < MIN_MESSAGE_LENGTH) {
      toast({
        title: t("report_problem_too_short"),
        description: t("report_problem_too_short_desc"),
        variant: "destructive",
      });
      return;
    }

    // O relato viaja por rede como qualquer outra coisa: sem conexão ele se
    // perderia em silêncio, e o usuário acharia que enviou.
    if (!navigator.onLine) {
      toast({
        title: t("report_problem_offline"),
        description: t("report_problem_offline_desc"),
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const eventId = sendProblemReport({
        message: trimmed,
        email: email.trim() || undefined,
        context: buildContext(),
      });
      if (!eventId) throw new Error("monitoring disabled");

      // Fecha só depois de o evento sair de fato.
      await flushMonitoring();
      toast({
        title: t("report_problem_sent"),
        description: t("report_problem_sent_desc"),
      });
      onOpenChange(false);
    } catch {
      toast({
        title: t("report_problem_error"),
        description: t("report_problem_error_desc"),
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const infoRow = (label: string, value: string) => (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span style={{ color: "rgba(255,255,255,.45)" }}>{label}</span>
      <span className="truncate font-mono" style={{ color: "rgba(255,255,255,.65)" }}>
        {value}
      </span>
    </div>
  );

  return (
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
        <DrawerHeader className="shrink-0 flex items-center gap-2">
          <Bug className="h-5 w-5" style={{ color: "#6ea8ff" }} />
          <DrawerTitle style={{ color: "#fff" }}>{t("report_problem_title")}</DrawerTitle>
        </DrawerHeader>

        {/* O padding-bottom com --keyboard-height é o que dá espaço para o
            useKeyboardInputScroll erguer o campo acima do teclado. */}
        <div
          className="flex-1 overflow-y-auto px-4 space-y-4"
          style={{ paddingBottom: "calc(1rem + var(--keyboard-height, 0px))" }}
        >
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,.6)" }}>
            {t("report_problem_intro")}
          </p>

          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: "#fff" }}>
              {t("report_problem_what_happened")}
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("report_problem_placeholder")}
              className="min-h-32"
              maxLength={1000}
              style={{
                background: "rgba(255,255,255,.07)",
                border: "1px solid rgba(255,255,255,.12)",
                color: "#fff",
              }}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: "#fff" }}>
              {t("report_problem_email_label")}
            </label>
            <Input
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              style={{
                background: "rgba(255,255,255,.07)",
                border: "1px solid rgba(255,255,255,.12)",
                color: "#fff",
              }}
            />
            <p className="text-xs" style={{ color: "rgba(255,255,255,.4)" }}>
              {t("report_problem_email_hint")}
            </p>
          </div>

          {/* Transparência sobre o que sai junto do texto — o usuário vê a
              lista inteira antes de enviar. */}
          <div
            className="rounded-xl p-3 space-y-1.5"
            style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}
          >
            <p className="text-xs font-semibold pb-0.5" style={{ color: "rgba(255,255,255,.55)" }}>
              {t("report_problem_context_title")}
            </p>
            {infoRow(t("report_problem_context_version"), `${APP_VERSION} (${build})`)}
            {infoRow(t("report_problem_context_screen"), location.pathname)}
            {infoRow(t("report_problem_context_platform"), Capacitor.getPlatform())}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={isSending}
            className="w-full rounded-full gap-2"
            style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
          >
            <Send className="h-4 w-4" />
            {isSending ? t("sending") : t("report_problem_send")}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
