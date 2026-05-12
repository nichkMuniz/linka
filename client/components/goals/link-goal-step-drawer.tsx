import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Target, ChevronRight } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import type { UserGoal, ProgrammedGoal } from "@/lib/ritmofit-db";

interface LinkGoalStepDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userGoals: UserGoal[];
  goals: ProgrammedGoal[];
  isSaving: boolean;
  onConfirm: (goalId: string | null) => void;
}

export function LinkGoalStepDrawer({
  open,
  onOpenChange,
  userGoals,
  goals,
  isSaving,
  onConfirm,
}: LinkGoalStepDrawerProps) {
  const { t } = useLanguage();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) setSelectedId(null);
  }, [open]);

  const activeGoals = userGoals.filter((g) => (g.perc ?? 0) < 100);

  const goalMeta = (goalId: string | number) => {
    const g = goals.find((x) => String(x.id) === String(goalId));
    if (!g) return null;
    const label =
      g.type === 1
        ? t("goals_type_fitness")
        : g.type === 2
          ? t("goals_type_health")
          : t("goals_type_habits");
    const color =
      g.type === 1
        ? "bg-blue-500/10 text-blue-600 ring-blue-500/20"
        : g.type === 2
          ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20"
          : "bg-orange-500/10 text-orange-600 ring-orange-500/20";
    return { label, color };
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="max-h-[85dvh] flex flex-col modal-enter"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DrawerHeader className="shrink-0 pb-2">
          <div className="text-center space-y-2 pt-1">
            <span className="inline-block text-[10px] font-bold uppercase tracking-[0.12em] text-brand bg-brand/10 px-3 py-1 rounded-full">
              {t("goals_link_step_eyebrow")}
            </span>
            <DrawerTitle className="text-xl font-bold leading-tight">
              {t("goals_link_step_title")}
            </DrawerTitle>
            <p className="text-xs text-muted-foreground max-w-[280px] mx-auto leading-relaxed">
              {t("goals_link_step_subtitle")}
            </p>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pt-2 pb-3 space-y-2.5">
          {activeGoals.map((goal) => {
            const meta = goalMeta(goal.goal_id);
            const isSelected = selectedId === String(goal.goal_id);
            return (
              <button
                key={goal.id}
                type="button"
                onClick={() =>
                  setSelectedId(isSelected ? null : String(goal.goal_id))
                }
                className={`group w-full flex items-center gap-3 rounded-2xl border p-3.5 text-left shadow-sm transition-all duration-200 ${
                  isSelected
                    ? "border-brand bg-brand/5 ring-2 ring-brand/30"
                    : "border-border/60 bg-card hover:border-brand/40 hover:shadow-md"
                }`}
              >
                <div
                  className={`flex items-center justify-center h-11 w-11 rounded-xl flex-shrink-0 ring-1 ${
                    meta?.color ?? "bg-muted text-muted-foreground ring-border/60"
                  }`}
                >
                  <Target className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold leading-tight line-clamp-2">
                    {goal.description}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-brand h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, goal.perc ?? 0)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
                      {Math.round(goal.perc ?? 0)}%
                    </span>
                  </div>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                    isSelected
                      ? "border-brand bg-brand"
                      : "border-border/60 group-hover:border-brand/50"
                  }`}
                >
                  {isSelected && (
                    <span className="text-white text-[10px] font-bold leading-none">
                      ✓
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div
          className="shrink-0 px-4 pt-3 border-t border-border/30 bg-background/95 backdrop-blur-sm space-y-2"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <Button
            onClick={() => onConfirm(selectedId)}
            disabled={isSaving}
            className="w-full rounded-full h-12 text-base font-semibold gap-2"
          >
            {selectedId
              ? t("goals_link_step_confirm")
              : t("goals_link_step_skip_and_finish")}
            <ChevronRight className="h-4 w-4" />
          </Button>
          <p className="text-center text-[11px] text-muted-foreground/70 leading-relaxed">
            {t("goals_link_step_footer")}
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
