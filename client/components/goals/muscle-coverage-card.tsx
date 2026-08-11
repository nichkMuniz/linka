import * as React from "react";
import { Activity, ChevronRight } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { MuscleMap, type MuscleMapIntensity } from "@/components/shared/muscle-map";
import { PremiumGate } from "@/components/shared/premium-gate";
import { useLanguage } from "@/lib/language-context";
import { GLASS_SHEET_STYLE, GLASS_SHEET_PROPS } from "@/lib/glass-styles";
import { getMuscleCoverageDb, type MuscleCoverage } from "@/lib/ritmofit-db";

/**
 * Cobertura muscular da semana — Fase 4 do plano de treino profissional.
 *
 * Só LÊ o que as fases anteriores passaram a gravar (`set_kind` da Fase 1 tira
 * o aquecimento; `workout_muscles` da Fase 2 diz onde cada série pegou), então
 * não exigiu migração nova.
 *
 * A pergunta que responde não é "quanto você treinou", que o app já mostrava —
 * é **onde você NÃO treinou**. A lacuna é a informação mais valiosa da tela, por
 * isso ela aparece no card, não escondida no detalhe.
 *
 * Gate premium: vende profundidade sobre o dado que o usuário gera de graça —
 * o princípio do `docs/17-premium.md`. Registrar treino, ver volume e séries
 * continua livre.
 */

/** Faixa semanal de séries efetivas por músculo para hipertrofia. */
const WEEKLY_SETS_TARGET = 10;
/** Acima disso o alerta de lacuna aparece (dias sem estímulo relevante). */
const GAP_DAYS = 10;

interface MuscleCoverageCardProps {
  /** muda quando um treino é finalizado — força a releitura */
  refreshToken?: number;
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 86400_000);
}

export function MuscleCoverageCard({ refreshToken }: MuscleCoverageCardProps) {
  const { t } = useLanguage();
  const [rows, setRows] = React.useState<MuscleCoverage[] | null>(null);
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState<"front" | "back">("front");

  React.useEffect(() => {
    let alive = true;
    getMuscleCoverageDb()
      .then((r) => { if (alive) setRows(r); })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, [refreshToken]);

  // Intensidade do mapa = séries efetivas em relação ao alvo semanal, por
  // região. Região com várias porções fica com a que mais recebeu estímulo.
  const intensity = React.useMemo<MuscleMapIntensity>(() => {
    const out: MuscleMapIntensity = {};
    for (const r of rows ?? []) {
      const pct = Math.min(100, Math.round((r.effectiveSets / WEEKLY_SETS_TARGET) * 100));
      const part = r.muscle.bodyPart;
      if (pct > (out[part] ?? 0)) out[part] = pct;
    }
    return out;
  }, [rows]);

  const trained = React.useMemo(
    () => (rows ?? []).filter((r) => r.effectiveSets > 0).sort((a, b) => b.effectiveSets - a.effectiveSets),
    [rows],
  );

  const totalSets = React.useMemo(
    () => Math.round(trained.reduce((s, r) => s + r.effectiveSets, 0)),
    [trained],
  );

  /**
   * Lacunas: músculos sem estímulo na semana. Ordena os "há muito tempo"
   * primeiro e joga os "nunca" para o fim — quem nunca treinou panturrilha
   * provavelmente não quer, enquanto quem parou há 3 semanas esqueceu.
   */
  const gaps = React.useMemo(() => {
    return (rows ?? [])
      .filter((r) => r.effectiveSets === 0)
      .map((r) => ({ row: r, days: daysSince(r.lastTrainedAt) }))
      .filter(({ days }) => days === null || days >= GAP_DAYS)
      .sort((a, b) => {
        if (a.days === null && b.days === null) return 0;
        if (a.days === null) return 1;
        if (b.days === null) return -1;
        return b.days - a.days;
      });
  }, [rows]);

  // Sem catálogo de anatomia semeado (migração não rodou) ou sem nenhum treino
  // no período: o card não tem o que dizer e some — nada de card vazio no Hub.
  if (!rows || rows.length === 0 || (trained.length === 0 && gaps.length === 0)) return null;

  const topGap = gaps[0];

  const listRow = (r: MuscleCoverage) => {
    const pct = Math.min(100, (r.effectiveSets / WEEKLY_SETS_TARGET) * 100);
    return (
      <div key={r.muscle.id} className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[13px] font-medium truncate" style={{ color: "rgba(255,255,255,.88)" }}>
              {r.muscle.name}
            </p>
            <span className="text-[11px] font-bold shrink-0" style={{ color: "rgba(255,255,255,.55)" }}>
              {r.effectiveSets.toFixed(1)}
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.08)" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(3, pct)}%`,
                background: pct >= 100 ? "#22c55e" : pct >= 50 ? "#f97316" : "rgba(249,115,22,.5)",
              }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <PremiumGate feature="charts">
        <button
          onClick={() => setOpen(true)}
          className="w-full rounded-3xl p-4 text-left transition-all active:scale-[0.99]"
          style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4" style={{ color: "#f97316" }} />
            <p className="text-sm font-bold flex-1" style={{ color: "#fff" }}>
              {t("goals_coverage_title")}
            </p>
            <ChevronRight className="h-4 w-4" style={{ color: "rgba(255,255,255,.4)" }} />
          </div>

          <div className="flex items-center gap-3">
            {/* As duas vistas lado a lado: o card é um panorama, não um detalhe.
                Aqui não há alternador que diga qual é qual (como no drawer), então
                a legenda entra sob cada silhueta. */}
            <div className="flex gap-1.5 shrink-0">
              {(["front", "back"] as const).map((v) => (
                <div key={v} className="flex flex-col items-center gap-1">
                  <MuscleMap intensity={intensity} view={v} width={54} />
                  <span
                    className="text-[9px] font-semibold uppercase tracking-wide"
                    style={{ color: "rgba(255,255,255,.4)" }}
                  >
                    {t(v === "front" ? "goals_anatomy_front" : "goals_anatomy_back")}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <div>
                <p className="text-2xl font-black leading-none" style={{ color: "#fff" }}>
                  {totalSets}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,.5)" }}>
                  {t("goals_coverage_sets_week")}
                </p>
              </div>

              {topGap && (
                <div
                  className="rounded-xl px-2.5 py-1.5"
                  style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.28)" }}
                >
                  <p className="text-[11px] font-semibold leading-snug" style={{ color: "#fca5a5" }}>
                    {topGap.days === null
                      ? t("goals_coverage_gap_never").replace("{muscle}", topGap.row.muscle.name)
                      : t("goals_coverage_gap_days")
                          .replace("{muscle}", topGap.row.muscle.name)
                          .replace("{n}", String(topGap.days))}
                  </p>
                </div>
              )}
            </div>
          </div>
        </button>
      </PremiumGate>

      <Drawer open={open} onOpenChange={setOpen} {...GLASS_SHEET_PROPS}>
        <DrawerContent style={GLASS_SHEET_STYLE}>
          <DrawerHeader>
            <DrawerTitle className="text-left" style={{ color: "#fff" }}>
              {t("goals_coverage_title")}
            </DrawerTitle>
          </DrawerHeader>

          <div
            className="flex-1 overflow-y-auto px-4 space-y-4"
            style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-center justify-center gap-3">
              <MuscleMap intensity={intensity} view={view} width={120} />
              <div className="space-y-2">
                {(["front", "back"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className="block w-full px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all"
                    style={view === v
                      ? { background: "rgba(255,255,255,.9)", color: "#0a0b12" }
                      : { background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.55)" }}
                  >
                    {t(v === "front" ? "goals_anatomy_front" : "goals_anatomy_back")}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-center" style={{ color: "rgba(255,255,255,.4)" }}>
              {t("goals_coverage_explainer").replace("{target}", String(WEEKLY_SETS_TARGET))}
            </p>

            {trained.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-sm font-semibold" style={{ color: "#fff" }}>
                  {t("goals_coverage_trained")}
                </h3>
                {trained.map(listRow)}
              </div>
            )}

            {gaps.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold" style={{ color: "#fff" }}>
                  {t("goals_coverage_gaps")}
                </h3>
                {gaps.map(({ row, days }) => (
                  <div
                    key={row.muscle.id}
                    className="flex items-center justify-between gap-2 rounded-xl px-3 py-2"
                    style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}
                  >
                    <span className="text-[13px] truncate" style={{ color: "rgba(255,255,255,.8)" }}>
                      {row.muscle.name}
                    </span>
                    <span className="text-[11px] font-semibold shrink-0" style={{ color: "#fca5a5" }}>
                      {days === null
                        ? t("goals_coverage_never")
                        : t("goals_coverage_days_ago").replace("{n}", String(days))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
