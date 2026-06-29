import * as React from "react";
import { Plus, Target } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import type { Routine, UserGoal } from "@/lib/ritmofit-db";

const COLLAPSED_COUNT = 3;

interface LifeGoalsSectionProps {
  userGoals: UserGoal[];
  routines: Routine[];
  onDeleteGoal: (goal: UserGoal) => Promise<void>;
  onCreateGoal: () => void;
  onOpenGoal?: (goal: UserGoal) => void;
}

export function LifeGoalsSection({
  userGoals,
  routines,
  onCreateGoal,
  onOpenGoal,
}: LifeGoalsSectionProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = React.useState(false);

  const routineCountByGoal = React.useMemo(() => {
    const map = new Map<string, number>();
    routines.forEach((r) => {
      if (r.goal_id) map.set(r.goal_id, (map.get(r.goal_id) ?? 0) + 1);
    });
    return map;
  }, [routines]);

  const active = userGoals.filter((g) => g.perc < 100);
  const completed = userGoals.filter((g) => g.perc >= 100);
  const visibleActive = expanded ? active : active.slice(0, COLLAPSED_COUNT);
  const hasMore = active.length > COLLAPSED_COUNT || completed.length > 0;

  const renderGoalCard = (goal: UserGoal, isCompleted: boolean) => {
    const linkedRoutines = routineCountByGoal.get(goal.goal_id) ?? 0;
    const perc = Math.min(100, Math.round(goal.perc));
    return (
      <div
        key={goal.id}
        className="cursor-pointer active:scale-[0.99] transition-all"
        style={{ borderRadius: "22px", padding: "16px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}
        onClick={() => onOpenGoal?.(goal)}
      >
        <div className="flex items-start gap-2.5 mb-3">
          <span className="text-xl shrink-0 mt-0.5">{isCompleted ? "🏆" : "🎯"}</span>
          <div className="flex-1 min-w-0">
            <p className="text-[14.5px] font-[680] text-white truncate">{goal.description}</p>
            <p className="text-[11.5px] mt-0.5" style={{ color: "rgba(255,255,255,.5)" }}>
              {goal.days_completed}/{goal.duration} {t("goals_streak_days")}
              {linkedRoutines > 0 &&
                ` · ${t("goals_linked_routines_count").replace("{n}", String(linkedRoutines))}`}
            </p>
          </div>
          <span className="text-[13px] font-bold text-white tabular-nums shrink-0">
            {perc}%
          </span>
        </div>

        <div
          className="h-[7px] rounded-[4px] overflow-hidden"
          style={{ background: "rgba(255,255,255,.1)" }}
        >
          <div
            className="h-full rounded-[4px] transition-all"
            style={{ width: `${perc}%`, background: "linear-gradient(90deg,#5b8cff,#9d6bff)" }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 px-1">
        <h2 className="text-[18px] font-bold" style={{ color: "#fff", letterSpacing: "-0.01em" }}>
          {t("goals_dash_life_goals")}
        </h2>
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-[9px]"
          style={{ background: "rgba(255,255,255,.07)", color: "rgba(255,255,255,.45)" }}
        >
          {t("goals_optional")}
        </span>
        <div className="flex-1" />
        {hasMore && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-semibold"
            style={{ color: "#9d6bff" }}
          >
            {expanded ? t("goals_dash_show_less") : t("goals_dash_view_all")}
          </button>
        )}
      </div>

      {userGoals.length === 0 ? (
        <div
          className="flex flex-col items-center gap-4 py-8 text-center px-4"
          style={{ borderRadius: "22px", border: "1px dashed rgba(255,255,255,.18)" }}
        >
          <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <Target className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">{t("goals_onboarding_title")}</p>
            <p className="text-xs max-w-xs" style={{ color: "rgba(255,255,255,.5)" }}>{t("goals_onboarding_desc")}</p>
          </div>
          <button
            onClick={onCreateGoal}
            className="inline-flex items-center gap-2 active:scale-[0.97] transition-transform"
            style={{
              padding: "12px 22px",
              borderRadius: "16px",
              background: "linear-gradient(135deg,rgba(91,140,255,.95),rgba(157,107,255,.95))",
              border: "1px solid rgba(255,255,255,.18)",
              color: "#fff",
              fontSize: "14px",
              fontWeight: 680,
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              boxShadow: "0 10px 28px rgba(120,90,240,.34), inset 0 1px 0 rgba(255,255,255,.28)",
            }}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            {t("goals_add")}
          </button>
        </div>
      ) : (
        <>
          {visibleActive.map((g) => renderGoalCard(g, false))}

          {expanded && completed.length > 0 && (
            <>
              <h3 className="text-sm font-semibold pt-1 px-1" style={{ color: "rgba(255,255,255,.5)" }}>
                {t("goals_completed_section")}
              </h3>
              {completed.map((g) => renderGoalCard(g, true))}
            </>
          )}

          {/* Glass CTA to create new goal */}
          <button
            onClick={onCreateGoal}
            className="w-full flex items-center justify-center gap-2 active:scale-[0.99] transition-all"
            style={{
              borderRadius: "18px",
              padding: "15px",
              background: "rgba(157,107,255,.1)",
              border: "1px solid rgba(157,107,255,.24)",
              color: "#b89bff",
              fontSize: "13.5px",
              fontWeight: 640,
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.08)",
            }}
          >
            <Plus className="h-4 w-4" strokeWidth={2.4} />
            {t("goals_add")}
          </button>
        </>
      )}
    </div>
  );
}
