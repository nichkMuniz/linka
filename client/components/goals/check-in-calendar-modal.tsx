import * as React from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useLanguage } from "@/lib/language-context";

interface CheckInCalendarModalProps {
  open: boolean;
  onClose: () => void;
  checkInDates: string[];
  streakCount: number;
}

const WEEKDAYS_PT = ["D", "S", "T", "Q", "Q", "S", "S"];
const WEEKDAYS_EN = ["S", "M", "T", "W", "T", "F", "S"];

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function CheckInCalendarModal({
  open,
  onClose,
  checkInDates,
  streakCount,
}: CheckInCalendarModalProps) {
  const { t, language } = useLanguage();
  const today = new Date();

  const [viewYear, setViewYear] = React.useState(today.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(today.getMonth());

  // Reset to current month when opened
  React.useEffect(() => {
    if (open) {
      setViewYear(today.getFullYear());
      setViewMonth(today.getMonth());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const dateSet = new Set(checkInDates);
  const todayStr = localDateStr(today);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun

  // Build grid cells: nulls for padding + day numbers
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

  // Nav: allow up to 2 months back, no forward past current month
  const minYear = today.getFullYear();
  const minMonth = today.getMonth() - 2;
  const canGoBack =
    viewYear > minYear || (viewYear === minYear && viewMonth > minMonth);
  const canGoForward =
    viewYear < today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth < today.getMonth());

  const goBack = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goForward = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const weekdayLabels = language === "pt" ? WEEKDAYS_PT : WEEKDAYS_EN;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
      }}
    >
      {/* backdrop */}
      <div
        className="absolute inset-0 pointer-events-auto"
        style={{ background: "rgba(0,0,0,.6)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
        onClick={onClose}
      />

      {/* card */}
      <div
        className="relative pointer-events-auto w-full max-w-[360px]"
        style={{
          borderRadius: "28px",
          background: "linear-gradient(160deg, rgba(255,255,255,.13) 0%, rgba(255,255,255,.05) 100%)",
          backdropFilter: "blur(32px) saturate(180%)",
          WebkitBackdropFilter: "blur(32px) saturate(180%)",
          border: "1px solid rgba(255,255,255,.15)",
          boxShadow: "0 24px 80px -12px rgba(0,0,0,.65), inset 0 1px 0 rgba(255,255,255,.2)",
          padding: "24px",
        }}
      >
        {/* header */}
        <div className="flex items-center justify-between" style={{ marginBottom: "20px" }}>
          <span className="text-white font-bold" style={{ fontSize: "17px" }}>
            {t("goals_checkin_modal_title")}
          </span>
          <button
            onClick={onClose}
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "10px",
              background: "rgba(255,255,255,.1)",
              border: "1px solid rgba(255,255,255,.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(255,255,255,.7)",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* month navigation */}
        <div className="flex items-center justify-between" style={{ marginBottom: "16px" }}>
          <button
            onClick={goBack}
            disabled={!canGoBack}
            style={{
              padding: "6px",
              color: "rgba(255,255,255,.7)",
              opacity: canGoBack ? 1 : 0.25,
              transition: "opacity .2s",
            }}
          >
            <ChevronLeft size={20} />
          </button>
          <span
            className="text-white font-semibold capitalize"
            style={{ fontSize: "14px" }}
          >
            {monthLabel}
          </span>
          <button
            onClick={goForward}
            disabled={!canGoForward}
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

        {/* weekday header */}
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

        {/* day grid */}
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            if (day === null) {
              return <div key={`empty-${i}`} style={{ height: "40px" }} />;
            }

            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isCheckedIn = dateSet.has(dateStr);
            const isToday = dateStr === todayStr;

            return (
              <div
                key={dateStr}
                className="flex items-center justify-center"
                style={{ height: "40px" }}
              >
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
                    border:
                      isToday && !isCheckedIn
                        ? "1.5px solid rgba(255,138,42,.55)"
                        : "none",
                    color: isCheckedIn
                      ? "#fff"
                      : isToday
                        ? "rgba(255,138,42,.9)"
                        : "rgba(255,255,255,.6)",
                    boxShadow: isCheckedIn
                      ? "0 2px 10px -2px rgba(255,122,60,.55)"
                      : "none",
                  }}
                >
                  {day}
                </div>
              </div>
            );
          })}
        </div>

        {/* footer */}
        <div
          style={{
            marginTop: "20px",
            paddingTop: "16px",
            borderTop: "1px solid rgba(255,255,255,.1)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span style={{ fontSize: "22px" }}>🔥</span>
          <div>
            <div style={{ fontSize: "13px", color: "rgba(255,255,255,.85)", fontWeight: 600 }}>
              {streakCount} {t("goals_dash_streak_caption")}
            </div>
            <div style={{ fontSize: "11.5px", color: "rgba(255,255,255,.45)", marginTop: "1px" }}>
              {t("goals_checkin_modal_month").replace("{n}", String(checkInsThisMonth))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
