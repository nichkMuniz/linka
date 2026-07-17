import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/lib/language-context";

const WEEKDAYS_PT = ["D", "S", "T", "Q", "Q", "S", "S"];
const WEEKDAYS_EN = ["S", "M", "T", "W", "T", "F", "S"];

/** Dia LOCAL no formato `YYYY-MM-DD` — nunca usar `toISOString().slice(0,10)`,
 *  que devolve o dia em UTC e erra a data para quem está a oeste de Greenwich. */
export function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface CheckInCalendarGridProps {
  /** Dias com check-in em `YYYY-MM-DD` local (use `localDateStr`). */
  checkInDates: string[];
  /** Quantos meses para trás a navegação permite. */
  monthsBack?: number;
  /** Rodapé opcional; recebe quantos check-ins caem no mês visível. */
  footer?: (checkInsInVisibleMonth: number) => React.ReactNode;
}

/**
 * Grade mensal de check-ins: navegação de mês, cabeçalho de dias da semana e os
 * dias marcados. Só apresentação — quem usa decide a moldura (modal em Metas,
 * drawer na Comunidade) e o rodapé.
 */
export function CheckInCalendarGrid({
  checkInDates,
  monthsBack = 2,
  footer,
}: CheckInCalendarGridProps) {
  const { language } = useLanguage();
  const today = new Date();

  const [viewYear, setViewYear] = React.useState(today.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(today.getMonth());

  const dateSet = new Set(checkInDates);
  const todayStr = localDateStr(today);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0=Dom

  const cells: (number | null)[] = Array(firstDayOfWeek).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthLabel = new Intl.DateTimeFormat(language === "pt" ? "pt-BR" : "en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(viewYear, viewMonth, 1));

  const checkInsThisMonth = checkInDates.filter((d) => {
    const [y, m] = d.split("-").map(Number);
    return y === viewYear && m === viewMonth + 1;
  }).length;

  // Datas âncora em vez de aritmética de mês solta: `new Date(ano, mês - n, 1)`
  // já normaliza a virada de ano, então janeiro consegue voltar para novembro.
  const viewDate = new Date(viewYear, viewMonth, 1);
  const minDate = new Date(today.getFullYear(), today.getMonth() - monthsBack, 1);
  const maxDate = new Date(today.getFullYear(), today.getMonth(), 1);
  const canGoBack = viewDate > minDate;
  const canGoForward = viewDate < maxDate;

  const step = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const weekdayLabels = language === "pt" ? WEEKDAYS_PT : WEEKDAYS_EN;

  return (
    <>
      {/* navegação de mês */}
      <div className="flex items-center justify-between" style={{ marginBottom: "16px" }}>
        <button
          onClick={() => step(-1)}
          disabled={!canGoBack}
          aria-label={language === "pt" ? "Mês anterior" : "Previous month"}
          style={{
            padding: "6px",
            color: "rgba(255,255,255,.7)",
            opacity: canGoBack ? 1 : 0.25,
            transition: "opacity .2s",
          }}
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-white font-semibold capitalize" style={{ fontSize: "14px" }}>
          {monthLabel}
        </span>
        <button
          onClick={() => step(1)}
          disabled={!canGoForward}
          aria-label={language === "pt" ? "Próximo mês" : "Next month"}
          style={{
            padding: "6px",
            color: "rgba(255,255,255,.7)",
            opacity: canGoForward ? 1 : 0.25,
            transition: "opacity .2s",
          }}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* dias da semana */}
      <div className="grid grid-cols-7" style={{ marginBottom: "4px" }}>
        {weekdayLabels.map((label, i) => (
          <div
            key={i}
            className="text-center"
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "rgba(255,255,255,.38)",
              paddingBottom: "8px",
            }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* grade de dias */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} style={{ height: "40px" }} />;
          }

          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isCheckedIn = dateSet.has(dateStr);
          const isToday = dateStr === todayStr;

          return (
            <div key={dateStr} className="flex items-center justify-center" style={{ height: "40px" }}>
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "13px",
                  fontWeight: isCheckedIn ? 700 : 400,
                  background: isCheckedIn
                    ? "linear-gradient(135deg, #ff8a2a, #ff5c1a)"
                    : "transparent",
                  border: isToday && !isCheckedIn ? "1.5px solid rgba(255,138,42,.55)" : "none",
                  color: isCheckedIn
                    ? "#fff"
                    : isToday
                      ? "rgba(255,138,42,.9)"
                      : "rgba(255,255,255,.6)",
                  boxShadow: isCheckedIn ? "0 2px 10px -2px rgba(255,122,60,.55)" : "none",
                }}
              >
                {day}
              </div>
            </div>
          );
        })}
      </div>

      {footer?.(checkInsThisMonth)}
    </>
  );
}
