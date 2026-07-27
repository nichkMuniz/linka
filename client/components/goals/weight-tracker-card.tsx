import * as React from "react";
import { Scale, Check, ChevronRight } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import {
  WeightHistoryDrawer,
  fmtWeight,
} from "@/components/shared/weight-history-drawer";
import { GLASS_PRIMARY_BTN_STYLE } from "@/lib/glass-styles";
import type { WeightLog } from "@/lib/ritmofit-db";

// Cadência do lembrete de peso. SEMANAL (7) é o recomendado por profissionais de
// saúde: o peso oscila 1–2 kg por dia (água/comida/treino) e pesagens diárias
// tendem a gerar ansiedade/compulsão com o número, enquanto a semanal captura a
// tendência real sem o ruído. Trocar para 1 volta a pedir diariamente.
const LOG_INTERVAL_DAYS = 7;
// Tempo que o card de confirmação fica na tela antes de sumir.
const CONFIRM_MS = 4000;

const CARD_SHELL: React.CSSProperties = {
  borderRadius: "26px",
  padding: "16px",
  background: "linear-gradient(rgba(255,255,255,.08),rgba(255,255,255,.03))",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,.1)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.16)",
};

interface WeightTrackerCardProps {
  /** ordenados do mais antigo para o mais recente */
  logs: WeightLog[];
  onAddWeight: (weight: number) => Promise<void>;
  onDeleteWeight: (id: string) => Promise<void>;
}

// Dias inteiros entre a data (YYYY-MM-DD) e hoje.
function daysSinceISODate(iso: string): number {
  const last = Date.parse(iso + "T00:00:00");
  const today = Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00");
  if (Number.isNaN(last) || Number.isNaN(today)) return Infinity;
  return Math.round((today - last) / 86400000);
}

export function WeightTrackerCard({ logs, onAddWeight, onDeleteWeight }: WeightTrackerCardProps) {
  const { t, language } = useLanguage();
  const [open, setOpen] = React.useState(false);
  const [inlineInput, setInlineInput] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  // Fluxo "registrou → confirma → some"
  const [confirmedValue, setConfirmedValue] = React.useState<number | null>(null);
  const [dismissed, setDismissed] = React.useState(false);
  const [exiting, setExiting] = React.useState(false);

  const hasLogs = logs.length > 0;
  const current = hasLogs ? logs[logs.length - 1].weight : null;

  const lastLoggedAt = hasLogs ? logs[logs.length - 1].logged_at : null;
  const loggedRecently = lastLoggedAt ? daysSinceISODate(lastLoggedAt) < LOG_INTERVAL_DAYS : false;

  // Após confirmar, o card some sozinho depois de alguns segundos (com fade).
  React.useEffect(() => {
    if (confirmedValue == null) return;
    const t1 = setTimeout(() => setExiting(true), CONFIRM_MS - 450);
    const t2 = setTimeout(() => setDismissed(true), CONFIRM_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [confirmedValue]);

  const submitWeight = async (raw: string) => {
    const parsed = parseFloat(raw.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 1000) return;
    setSaving(true);
    try {
      await onAddWeight(parsed);
      setInlineInput("");
      setConfirmedValue(parsed);
    } finally {
      setSaving(false);
    }
  };

  // ── Renderização por estado ──
  if (dismissed) return null;

  // 1) Acabou de registrar → confirmação, some sozinha
  if (confirmedValue != null) {
    return (
      <div
        style={{
          opacity: exiting ? 0 : 1,
          transform: exiting ? "translateY(-4px)" : "none",
          transition: "opacity .45s ease, transform .45s ease",
        }}
      >
        <div className="flex items-center gap-4" style={{ ...CARD_SHELL, border: "1px solid rgba(61,220,132,.32)" }}>
          <div
            className="shrink-0 flex items-center justify-center"
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "16px",
              background: "linear-gradient(135deg,#2fbf71,#3ddc84)",
              boxShadow: "0 6px 16px -6px rgba(61,220,132,.6)",
            }}
          >
            <Check className="h-6 w-6 text-white" strokeWidth={2.6} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-semibold" style={{ fontSize: "15px" }}>
              {t("goals_weight_confirm_title")}{" "}
              <span className="tabular-nums">
                {fmtWeight(confirmedValue, language)} {t("goals_weight_unit")}
              </span>
            </div>
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,.5)", marginTop: "1px" }}>
              {t("goals_weight_confirm_sub")}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2) Já registrou dentro do intervalo (semana) → não mostra nada (anti-compulsão)
  if (loggedRecently) return null;

  // 3) Lembrete da semana — input inline no próprio card
  return (
    <>
      <div className="flex items-center gap-3" style={CARD_SHELL}>
        <div
          className="shrink-0 flex items-center justify-center"
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "16px",
            background: "linear-gradient(135deg,#5b8cff,#9d6bff)",
            boxShadow: "0 6px 16px -6px rgba(91,140,255,.6)",
          }}
        >
          <Scale className="h-6 w-6 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span style={{ fontSize: "11.5px", color: "rgba(255,255,255,.55)", letterSpacing: ".02em" }}>
              {t("goals_weight_prompt")}
            </span>
            {hasLogs && (
              <button
                onClick={() => setOpen(true)}
                className="flex items-center gap-0.5 shrink-0"
                style={{ fontSize: "11.5px", color: "rgba(255,255,255,.55)" }}
              >
                {t("goals_weight_history_link")}
                <ChevronRight className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="mt-1.5 flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={inlineInput}
                onChange={(e) => setInlineInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitWeight(inlineInput);
                }}
                placeholder={hasLogs ? fmtWeight(current as number, language) : t("goals_weight_input_placeholder")}
                className="w-full rounded-xl px-3 py-2.5 text-white placeholder:text-white/35 outline-none"
                style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)" }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40" style={{ fontSize: "13px" }}>
                {t("goals_weight_unit")}
              </span>
            </div>
            <button
              onClick={() => submitWeight(inlineInput)}
              disabled={saving || !inlineInput.trim()}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 shrink-0"
              style={GLASS_PRIMARY_BTN_STYLE}
            >
              {t("goals_weight_log_cta")}
            </button>
          </div>
        </div>
      </div>

      {/* Histórico + gráfico — componente compartilhado com Configurações */}
      <WeightHistoryDrawer
        open={open}
        onOpenChange={setOpen}
        logs={logs}
        onAddWeight={onAddWeight}
        onDeleteWeight={onDeleteWeight}
        onLogged={(w) => setConfirmedValue(w)}
      />
    </>
  );
}
