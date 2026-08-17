import * as React from "react";
import { useLanguage } from "@/lib/language-context";
import { formatRunPace, formatRunTime, type RunSplit } from "@/lib/run-tracker";

// ── Parciais por km da corrida GPS ──────────────────────────────────────────
// Lista "km · tempo · ritmo" (linguagem dos apps de corrida) alimentada pelos
// splits medidos em run-tracker.ts. Usada em DUAS telas: o resumo pós-corrida
// do WorkoutSessionDialog e o resumo do treino (workout-summary-overlay) —
// ambas shells escuros "liquid glass", por isso os tokens são fixos em branco
// translúcido em vez de virem do tema.
//
// A barra de cada linha é proporcional à VELOCIDADE do trecho (mais rápido =
// barra mais longa), o que deixa o perfil da corrida legível de relance sem
// precisar ler os números.

const FG = "#fff";
const MUTED = "rgba(255,255,255,0.55)";
const BORDER = "rgba(255,255,255,0.12)";
const CARD = "rgba(255,255,255,0.06)";

/** menor fração da barra, para o km mais lento ainda ser visível */
const MIN_BAR = 0.28;

interface RunSplitsListProps {
  splits: RunSplit[];
  /** cor de destaque (barra + km mais rápido) */
  accent: string;
  /** linhas exibidas antes do "ver todos" (0 = todas) */
  maxRows?: number;
}

export function RunSplitsList({ splits, accent, maxRows = 0 }: RunSplitsListProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = React.useState(false);

  if (splits.length === 0) return null;

  // Escala da barra: o trecho mais rápido enche a linha. O parcial final entra
  // na escala como qualquer outro — ele é um ritmo real, só que de um trecho
  // curto (abaixo de 50m o run-tracker nem o gera).
  const paces = splits.map((s) => s.paceSecPerKm).filter((p) => p > 0);
  const fastestPace = paces.length > 0 ? Math.min(...paces) : 0;
  // O "mais rápido" premia só km fechados — um repique de 80m no fim não é
  // comparável a um quilômetro inteiro.
  const fullSplits = splits.filter((s) => !s.partial);
  const fastestFullIndex =
    fullSplits.length > 1
      ? fullSplits.reduce((best, s) => (s.paceSecPerKm < best.paceSecPerKm ? s : best)).index
      : null;

  const limited = maxRows > 0 && !expanded && splits.length > maxRows;
  const rows = limited ? splits.slice(0, maxRows) : splits;

  return (
    <div>
      <div style={{
        background: CARD, borderRadius: 18, overflow: "hidden",
        border: `1px solid ${BORDER}`,
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
      }}>
        {/* Cabeçalho das colunas */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "9px 14px", borderBottom: `1px solid ${BORDER}`,
          fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
          textTransform: "uppercase", color: MUTED,
        }}>
          <span style={{ width: 46, flexShrink: 0 }}>{t("goals_run_splits_km")}</span>
          <span style={{ flex: 1 }} />
          <span style={{ width: 62, textAlign: "right", flexShrink: 0 }}>
            {t("goals_run_time")}
          </span>
          <span style={{ width: 76, textAlign: "right", flexShrink: 0 }}>
            {t("goals_run_pace")}
          </span>
        </div>

        {rows.map((split, idx) => {
          const isFastest = split.index === fastestFullIndex;
          const ratio =
            fastestPace > 0 && split.paceSecPerKm > 0
              ? Math.max(MIN_BAR, Math.min(1, fastestPace / split.paceSecPerKm))
              : MIN_BAR;
          return (
            <div
              key={split.index}
              style={{
                position: "relative",
                display: "flex", alignItems: "center", gap: 10,
                padding: "11px 14px 13px",
                borderBottom: idx < rows.length - 1 ? `1px solid ${BORDER}` : "none",
              }}
            >
              {/* Barra proporcional à velocidade do trecho */}
              <span style={{
                position: "absolute", left: 14, bottom: 6,
                height: 3, borderRadius: 2,
                width: `calc((100% - 28px) * ${ratio})`,
                background: isFastest ? accent : `${accent}55`,
                pointerEvents: "none",
              }} />

              <span style={{
                width: 46, flexShrink: 0,
                fontSize: 15, fontWeight: 800, color: FG,
                fontVariantNumeric: "tabular-nums",
              }}>
                {split.partial ? formatSplitKm(split.distanceKm) : split.index}
              </span>

              <span style={{ flex: 1, minWidth: 0, display: "flex", gap: 6 }}>
                {split.partial && (
                  <span style={{
                    background: "rgba(255,255,255,0.10)", color: MUTED,
                    borderRadius: 20, padding: "2px 8px",
                    fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
                  }}>
                    {t("goals_run_splits_partial")}
                  </span>
                )}
                {isFastest && (
                  <span style={{
                    background: `${accent}22`, color: accent,
                    borderRadius: 20, padding: "2px 8px",
                    fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
                  }}>
                    ⚡ {t("goals_run_splits_fastest")}
                  </span>
                )}
              </span>

              <span style={{
                width: 62, textAlign: "right", flexShrink: 0,
                fontSize: 14, fontWeight: 700, color: FG,
                fontVariantNumeric: "tabular-nums",
              }}>
                {formatRunTime(split.durationMs)}
              </span>

              <span style={{
                width: 76, textAlign: "right", flexShrink: 0,
                fontSize: 13, fontWeight: 700,
                color: isFastest ? accent : MUTED,
                fontVariantNumeric: "tabular-nums",
              }}>
                {formatRunPace(split.paceSecPerKm)}
                <span style={{ fontSize: 10, fontWeight: 600, marginLeft: 2 }}>/km</span>
              </span>
            </div>
          );
        })}
      </div>

      {maxRows > 0 && splits.length > maxRows && (
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            marginTop: 8, width: "100%", background: "none", border: "none",
            cursor: "pointer", fontSize: 13, fontWeight: 600, color: accent,
            padding: "6px 0", textAlign: "center",
          }}
        >
          {expanded
            ? t("goals_summary_show_less")
            : `${t("goals_summary_show_all")} (+${splits.length - maxRows})`}
        </button>
      )}
    </div>
  );
}

/** "0,4" — distância do trecho parcial final (mesmo estilo de formatCardioKm) */
function formatSplitKm(km: number): string {
  return km.toFixed(2).replace(/0+$/, "").replace(/[.,]$/, "").replace(".", ",");
}
