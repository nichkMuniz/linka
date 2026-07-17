import { X } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { CheckInCalendarGrid } from "@/components/shared/check-in-calendar-grid";

interface CheckInCalendarModalProps {
  open: boolean;
  onClose: () => void;
  checkInDates: string[];
  streakCount: number;
}

export function CheckInCalendarModal({
  open,
  onClose,
  checkInDates,
  streakCount,
}: CheckInCalendarModalProps) {
  const { t } = useLanguage();

  // Desmontar ao fechar zera o mês visível da grade — reabre sempre em hoje.
  if (!open) return null;

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

        <CheckInCalendarGrid
          checkInDates={checkInDates}
          footer={(checkInsThisMonth) => (
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
          )}
        />
      </div>
    </div>
  );
}
