import * as React from "react";
import { X } from "lucide-react";
import { useLanguage } from "@/lib/language-context";

const FIELD_WRAP_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,.07)",
  border: "1px solid rgba(255,255,255,.12)",
};

// fontSize 16px evita o zoom automático do Safari ao focar o campo no iPhone.
// textAlign center: o valor do horário fica centralizado no campo, alinhado com
// a label centralizada acima dele.
const INPUT_STYLE: React.CSSProperties = {
  fontSize: "16px",
  minWidth: 0,
  maxWidth: "100%",
  boxSizing: "border-box",
  background: "transparent",
  border: "none",
  color: "#fff",
  textAlign: "center",
};

interface HabitTimeRowProps {
  name: string;
  /** "HH:MM" ou "" */
  start: string;
  /** "HH:MM" ou "" (opcional — hábito pode não ter fim) */
  end: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}

/**
 * Linha de agendamento de um hábito: nome + janela de execução (início → fim).
 *
 * Compartilhada pelos três pontos que editam horário de hábito — criação
 * (`build-schedule`), adicionar itens (`edit-item-times`) e o editor "Lembrete"
 * do `RoutineDetailDrawer` — para os três não divergirem.
 *
 * Sem validação de "fim depois do início" de propósito: hábitos que **viram a
 * noite** são legítimos (Dormir 23:00 → 07:00).
 */
export function HabitTimeRow({
  name,
  start,
  end,
  onStartChange,
  onEndChange,
}: HabitTimeRowProps) {
  const { t } = useLanguage();

  return (
    <div className="space-y-1.5">
      <span className="block truncate text-sm" style={{ color: "#fff" }}>
        {name}
      </span>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex items-center justify-center gap-1.5">
            <span className="text-center text-[10.5px]" style={{ color: "rgba(255,255,255,.45)" }}>
              {t("goals_habit_start_label")}
            </span>
            {/* Limpar aparece só com valor: o <input type="time"> não deixa
                apagar depois de tocado sem querer. Limpar o início limpa o fim. */}
            {start && (
              <button
                type="button"
                onClick={() => {
                  onStartChange("");
                  if (end) onEndChange("");
                }}
                aria-label={t("goals_clear_time")}
                className="flex items-center active:scale-90 transition-transform"
                style={{ color: "rgba(255,255,255,.5)" }}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="h-11 rounded-xl overflow-hidden" style={FIELD_WRAP_STYLE}>
            <input
              type="time"
              value={start}
              onChange={(e) => {
                const v = e.target.value;
                onStartChange(v);
                // Sem início não existe janela — limpar o início limpa o fim,
                // senão sobraria um "— até 18:00" sem sentido.
                if (!v && end) onEndChange("");
              }}
              className="block w-full h-full px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              style={INPUT_STYLE}
            />
          </div>
        </div>
        <span className="shrink-0 pt-5 text-sm" style={{ color: "rgba(255,255,255,.35)" }}>
          –
        </span>
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex items-center justify-center gap-1.5">
            <span className="text-center text-[10.5px]" style={{ color: "rgba(255,255,255,.45)" }}>
              {t("goals_habit_end_label")}
            </span>
            {end && (
              <button
                type="button"
                onClick={() => onEndChange("")}
                aria-label={t("goals_clear_time")}
                className="flex items-center active:scale-90 transition-transform"
                style={{ color: "rgba(255,255,255,.5)" }}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="h-11 rounded-xl overflow-hidden" style={FIELD_WRAP_STYLE}>
            <input
              type="time"
              value={end}
              // O fim só faz sentido depois de existir um início.
              disabled={!start}
              onChange={(e) => onEndChange(e.target.value)}
              className="block w-full h-full px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-40"
              style={INPUT_STYLE}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
