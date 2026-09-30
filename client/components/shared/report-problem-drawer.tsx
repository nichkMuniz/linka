import * as React from "react";
import { useLocation } from "react-router-dom";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Bug, ChevronDown, Send } from "lucide-react";

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
import type { TranslationKey } from "@/lib/i18n";
import { FEATURES } from "@/lib/feature-flags";
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

/**
 * Telas/áreas que o usuário pode apontar (2026-09-30). Só o que existe HOJE no
 * app: áreas guardadas atrás de feature flag entram quando a flag liga. Os ids
 * são estáveis e em inglês — viram a tag `report_area` no Sentry.
 * Fluxos que não têm rota própria (registro de treino, criação de flow) são
 * listados à parte porque é assim que o usuário os enxerga.
 */
const REPORT_AREAS: { id: string; label: TranslationKey; enabled?: boolean }[] = [
  { id: "feed", label: "report_area_feed" },
  { id: "flows", label: "report_area_flows" },
  { id: "new_post", label: "report_area_new_post" },
  { id: "post", label: "report_area_post" },
  { id: "goals", label: "report_area_goals" },
  { id: "workout", label: "report_area_workout" },
  { id: "routines", label: "report_area_routines" },
  { id: "food_diary", label: "report_area_food_diary", enabled: FEATURES.foodDiary },
  { id: "search", label: "report_area_search" },
  { id: "hashtags", label: "report_area_hashtags", enabled: FEATURES.hashtags },
  { id: "community", label: "report_area_community" },
  { id: "duels", label: "report_area_duels", enabled: FEATURES.duels },
  { id: "messages", label: "report_area_messages" },
  { id: "notifications", label: "report_area_notifications" },
  { id: "shots", label: "report_area_shots", enabled: FEATURES.shots },
  { id: "store", label: "report_area_store", enabled: FEATURES.store },
  { id: "profile", label: "report_area_profile" },
  { id: "settings", label: "report_area_settings" },
  { id: "login", label: "report_area_login" },
  { id: "other", label: "report_area_other" },
];

/** Motivos prontos — um toque resolve a maioria dos relatos. */
const REPORT_REASONS: { id: string; label: TranslationKey }[] = [
  { id: "not_loading", label: "problem_reason_not_loading" },
  { id: "crash", label: "problem_reason_crash" },
  { id: "action_broken", label: "problem_reason_action" },
  { id: "not_saved", label: "problem_reason_not_saved" },
  { id: "wrong_data", label: "problem_reason_wrong_data" },
  { id: "media", label: "problem_reason_media" },
  { id: "notification", label: "problem_reason_notification" },
  { id: "slow", label: "problem_reason_slow" },
  { id: "layout", label: "problem_reason_layout" },
  { id: "other", label: "problem_reason_other" },
];

const FIELD_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,.07)",
  border: "1px solid rgba(255,255,255,.12)",
  color: "#fff",
};

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

  const [area, setArea] = React.useState("");
  const [reason, setReason] = React.useState("");
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
      setArea("");
      setReason("");
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

  const areas = REPORT_AREAS.filter((a) => a.enabled !== false);
  // "Outro" é o único motivo que não diz nada sozinho — aí o texto é obrigatório.
  const detailsRequired = reason === "other";

  const handleSubmit = async () => {
    const trimmed = message.trim();
    if (!area) {
      toast({
        title: t("report_problem_area_required"),
        description: t("report_problem_area_required_desc"),
        variant: "destructive",
      });
      return;
    }
    if (!reason) {
      toast({
        title: t("report_problem_reason_required"),
        description: t("report_problem_reason_required_desc"),
        variant: "destructive",
      });
      return;
    }
    if (detailsRequired && trimmed.length < MIN_MESSAGE_LENGTH) {
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
      const areaDef = REPORT_AREAS.find((a) => a.id === area)!;
      const reasonDef = REPORT_REASONS.find((r) => r.id === reason)!;
      const eventId = sendProblemReport({
        message: trimmed,
        email: email.trim() || undefined,
        context: buildContext(),
        area: { id: areaDef.id, label: t(areaDef.label) },
        reason: { id: reasonDef.id, label: t(reasonDef.label) },
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

          {/* Tela — <select> nativo: no iPhone abre a roleta do sistema e,
              por não ser portal, não briga com o z-index do drawer (mesmo
              padrão do registro de treino). */}
          <div className="space-y-2">
            <label htmlFor="report-area" className="text-sm font-medium" style={{ color: "#fff" }}>
              {t("report_problem_area_label")}
            </label>
            <div className="relative">
              <select
                id="report-area"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="h-12 w-full rounded-xl pl-3.5 pr-10 text-[15px] outline-none"
                style={{
                  ...FIELD_STYLE,
                  color: area ? "#fff" : "rgba(255,255,255,.45)",
                  appearance: "none",
                  WebkitAppearance: "none",
                }}
              >
                <option value="" disabled style={{ color: "#000" }}>
                  {t("report_problem_area_placeholder")}
                </option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id} style={{ color: "#000" }}>
                    {t(a.label)}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: "rgba(255,255,255,.5)" }}
              />
            </div>
          </div>

          {/* Motivo — chips de um toque */}
          <div className="space-y-2">
            <p className="text-sm font-medium" style={{ color: "#fff" }}>
              {t("report_problem_reason_label")}
            </p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("report_problem_reason_label")}>
              {REPORT_REASONS.map((r) => {
                const selected = reason === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setReason(r.id)}
                    className="rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors active:scale-[0.97]"
                    style={
                      selected
                        ? { background: "rgba(91,140,255,.22)", border: "1px solid rgba(110,168,255,.65)", color: "#fff" }
                        : { background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", color: "rgba(255,255,255,.75)" }
                    }
                  >
                    {t(r.label)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: "#fff" }}>
              {detailsRequired ? t("report_problem_what_happened") : t("report_problem_details_label")}
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("report_problem_placeholder")}
              className="min-h-24"
              maxLength={1000}
              style={FIELD_STYLE}
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
              placeholder={t("report_problem_email_placeholder")}
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
