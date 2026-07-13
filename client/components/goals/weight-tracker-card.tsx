import * as React from "react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Scale, Trash2, TrendingUp, TrendingDown, Check, ChevronRight } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { TrendChart } from "@/components/shared/trend-chart";
import {
  GLASS_SHEET_PROPS,
  GLASS_SHEET_STYLE,
  GLASS_PANEL_STYLE,
  GLASS_PRIMARY_BTN_STYLE,
} from "@/lib/glass-styles";
import type { WeightLog } from "@/lib/ritmofit-db";

const ACCENT = "#5b8cff";

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

const MONTHS: Record<string, string[]> = {
  pt: ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

function fmtDate(iso: string, lang: string): string {
  const [, m, d] = iso.split("-").map(Number);
  const months = MONTHS[lang] ?? MONTHS.pt;
  return `${d} ${months[(m ?? 1) - 1] ?? ""}`;
}

function fmtWeight(v: number, lang: string): string {
  const s = v.toFixed(1);
  return lang === "pt" ? s.replace(".", ",") : s;
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
  const [input, setInput] = React.useState("");
  const [inlineInput, setInlineInput] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  // Fluxo "registrou → confirma → some"
  const [confirmedValue, setConfirmedValue] = React.useState<number | null>(null);
  const [dismissed, setDismissed] = React.useState(false);
  const [exiting, setExiting] = React.useState(false);

  const hasLogs = logs.length > 0;
  const current = hasLogs ? logs[logs.length - 1].weight : null;
  const previous = logs.length > 1 ? logs[logs.length - 2].weight : null;
  const deltaPrev = current != null && previous != null ? current - previous : 0;
  const first = hasLogs ? logs[0].weight : null;
  const deltaTotal = current != null && first != null ? current - first : 0;

  const lastLoggedAt = hasLogs ? logs[logs.length - 1].logged_at : null;
  const loggedRecently = lastLoggedAt ? daysSinceISODate(lastLoggedAt) < LOG_INTERVAL_DAYS : false;

  const points = logs.map((l) => ({ label: fmtDate(l.logged_at, language), value: l.weight }));

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
      setInput("");
      setInlineInput("");
      setOpen(false);
      setConfirmedValue(parsed);
    } finally {
      setSaving(false);
    }
  };

  const renderDelta = (delta: number, big?: boolean) => {
    if (Math.abs(delta) < 0.05) return null;
    const up = delta > 0;
    const color = up ? "#ff8a2a" : "#3ddc84";
    const Icon = up ? TrendingUp : TrendingDown;
    return (
      <span
        className="inline-flex items-center gap-1 tabular-nums"
        style={{ color, fontSize: big ? "13px" : "11.5px", fontWeight: 600 }}
      >
        <Icon className={big ? "h-3.5 w-3.5" : "h-3 w-3"} />
        {up ? "+" : "−"}
        {fmtWeight(Math.abs(delta), language)} {t("goals_weight_unit")}
      </span>
    );
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

      {/* Drawer de histórico + gráfico (aberto pelo link "Histórico") */}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent {...GLASS_SHEET_PROPS} style={GLASS_SHEET_STYLE}>
          <div className="flex flex-col px-5 pb-6 pt-2 overflow-y-auto">
            <h2 className="text-white text-lg font-bold">{t("goals_weight_title")}</h2>

            {hasLogs ? (
              <>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-white tabular-nums" style={{ fontSize: "34px", fontWeight: 780, lineHeight: 1 }}>
                        {fmtWeight(current as number, language)}
                      </span>
                      <span className="text-white/50" style={{ fontSize: "15px" }}>{t("goals_weight_unit")}</span>
                    </div>
                    {logs.length > 1 && <div className="mt-1.5">{renderDelta(deltaTotal, true)}</div>}
                  </div>
                </div>

                <div className="mt-4 rounded-2xl p-3" style={GLASS_PANEL_STYLE}>
                  <TrendChart points={points} color={ACCENT} height={150} />
                  <div className="mt-1 flex justify-between px-1">
                    <span className="text-white/35" style={{ fontSize: "10.5px" }}>{points[0]?.label}</span>
                    <span className="text-white/35" style={{ fontSize: "10.5px" }}>{points[points.length - 1]?.label}</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-white/60">{t("goals_weight_empty_desc")}</p>
            )}

            {/* Registrar peso (também disponível aqui dentro) */}
            <div className="mt-4 flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitWeight(input);
                  }}
                  placeholder={t("goals_weight_input_placeholder")}
                  className="w-full rounded-xl px-3 py-3 text-white placeholder:text-white/35 outline-none"
                  style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)" }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40" style={{ fontSize: "13px" }}>
                  {t("goals_weight_unit")}
                </span>
              </div>
              <button
                onClick={() => submitWeight(input)}
                disabled={saving || !input.trim()}
                className="rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
                style={GLASS_PRIMARY_BTN_STYLE}
              >
                {t("goals_weight_log_cta")}
              </button>
            </div>

            {/* Histórico (mais recente primeiro) */}
            {hasLogs && (
              <div className="mt-5">
                <div className="text-white/50 mb-2" style={{ fontSize: "12px", fontWeight: 600 }}>
                  {t("goals_weight_history")}
                </div>
                <div className="flex flex-col gap-1.5">
                  {[...logs].reverse().map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center justify-between rounded-xl px-3 py-2.5"
                      style={GLASS_PANEL_STYLE}
                    >
                      <span className="text-white/70" style={{ fontSize: "13px" }}>
                        {fmtDate(l.logged_at, language)}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-white tabular-nums font-semibold" style={{ fontSize: "14px" }}>
                          {fmtWeight(l.weight, language)} {t("goals_weight_unit")}
                        </span>
                        <button
                          onClick={() => onDeleteWeight(l.id)}
                          className="text-white/40 hover:text-red-400 transition-colors"
                          aria-label={t("goals_weight_delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
