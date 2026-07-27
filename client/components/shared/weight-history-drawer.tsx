import * as React from "react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { PremiumGate } from "@/components/shared/premium-gate";
import { TrendChart } from "@/components/shared/trend-chart";
import { useKeyboardInputScroll } from "@/hooks/use-keyboard-input-scroll";
import {
  GLASS_SHEET_PROPS,
  GLASS_SHEET_STYLE,
  GLASS_PANEL_STYLE,
  GLASS_PRIMARY_BTN_STYLE,
} from "@/lib/glass-styles";
import type { WeightLog } from "@/lib/ritmofit-db";

// Extraído do `weight-tracker-card.tsx` (lembrete semanal da tela de Metas) para
// ser reaproveitado pelo drawer de Configurações → Meu Perfil → Pessoal, onde o
// peso atual do usuário é editado. Uma única fonte de verdade para "histórico de
// peso": gráfico de tendência, registro e lista com exclusão.

const ACCENT = "#5b8cff";

const MONTHS: Record<string, string[]> = {
  pt: ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

export function fmtWeightDate(iso: string, lang: string): string {
  const [, m, d] = iso.split("-").map(Number);
  const months = MONTHS[lang] ?? MONTHS.pt;
  return `${d} ${months[(m ?? 1) - 1] ?? ""}`;
}

export function fmtWeight(v: number, lang: string): string {
  const s = v.toFixed(1);
  return lang === "pt" ? s.replace(".", ",") : s;
}

/** Pílula de variação: laranja quando subiu, verde quando desceu. */
export function WeightDelta({ delta, big }: { delta: number; big?: boolean }) {
  const { t, language } = useLanguage();
  if (Math.abs(delta) < 0.05) return null;
  const up = delta > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className="inline-flex items-center gap-1 tabular-nums"
      style={{ color: up ? "#ff8a2a" : "#3ddc84", fontSize: big ? "13px" : "11.5px", fontWeight: 600 }}
    >
      <Icon className={big ? "h-3.5 w-3.5" : "h-3 w-3"} />
      {up ? "+" : "−"}
      {fmtWeight(Math.abs(delta), language)} {t("goals_weight_unit")}
    </span>
  );
}

interface WeightHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** ordenados do mais antigo para o mais recente */
  logs: WeightLog[];
  onAddWeight: (weight: number) => Promise<void>;
  onDeleteWeight: (id: string) => Promise<void>;
  /** Chamado após registrar com sucesso (ex.: o card de Metas mostra a confirmação). */
  onLogged?: (weight: number) => void;
}

export function WeightHistoryDrawer({
  open,
  onOpenChange,
  logs,
  onAddWeight,
  onDeleteWeight,
  onLogged,
}: WeightHistoryDrawerProps) {
  const { t, language } = useLanguage();
  const [input, setInput] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // O input "registrar peso" fica no meio do scroll do drawer (gráfico acima,
  // histórico abaixo) — sem assistência ele some atrás do teclado no iOS.
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  useKeyboardInputScroll(scrollRef, open);

  const hasLogs = logs.length > 0;
  const current = hasLogs ? logs[logs.length - 1].weight : null;
  const first = hasLogs ? logs[0].weight : null;
  const deltaTotal = current != null && first != null ? current - first : 0;
  const points = logs.map((l) => ({ label: fmtWeightDate(l.logged_at, language), value: l.weight }));

  const submitWeight = async (raw: string) => {
    const parsed = parseFloat(raw.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 1000) return;
    setSaving(true);
    try {
      await onAddWeight(parsed);
      setInput("");
      onOpenChange(false);
      onLogged?.(parsed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent {...GLASS_SHEET_PROPS} style={GLASS_SHEET_STYLE}>
        <div
          ref={scrollRef}
          className="flex flex-col px-5 pt-2 overflow-y-auto"
          style={{ paddingBottom: "calc(1.5rem + var(--keyboard-height, 0px))" }}
        >
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
                  {logs.length > 1 && (
                    <div className="mt-1.5">
                      <WeightDelta delta={deltaTotal} big />
                    </div>
                  )}
                </div>
              </div>

              <PremiumGate feature="charts" className="mt-4">
                <div className="rounded-2xl p-3" style={GLASS_PANEL_STYLE}>
                  <TrendChart points={points} color={ACCENT} height={150} />
                  <div className="mt-1 flex justify-between px-1">
                    <span className="text-white/35" style={{ fontSize: "10.5px" }}>{points[0]?.label}</span>
                    <span className="text-white/35" style={{ fontSize: "10.5px" }}>{points[points.length - 1]?.label}</span>
                  </div>
                </div>
              </PremiumGate>
            </>
          ) : (
            <p className="mt-2 text-sm text-white/60">{t("goals_weight_empty_desc")}</p>
          )}

          {/* Registrar peso */}
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
                {[...logs].reverse().map((l, idx, arr) => {
                  // arr está do mais recente para o mais antigo, então o próximo
                  // item é o registro ANTERIOR no tempo — a variação entre eles.
                  const prev = arr[idx + 1];
                  return (
                    <div
                      key={l.id}
                      className="flex items-center justify-between rounded-xl px-3 py-2.5"
                      style={GLASS_PANEL_STYLE}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-white/70" style={{ fontSize: "13px" }}>
                          {fmtWeightDate(l.logged_at, language)}
                        </span>
                        {prev && <WeightDelta delta={l.weight - prev.weight} />}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
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
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
