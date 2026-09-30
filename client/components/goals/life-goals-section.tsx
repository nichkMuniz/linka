import * as React from "react";
import { Link2, Plus, Target, Trophy } from "lucide-react";
import { SectionHeader } from "@/components/shared/section-header";
import { useLanguage } from "@/lib/language-context";
import { FEATURES } from "@/lib/feature-flags";
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

  // Rotinas vinculadas a cada meta, pelo NOME distinto: linhas de `routines`
  // com o mesmo nome viram um card só na tela, e rotinas de dieta/hábito não
  // aparecem no v1 (FEATURES.dietAndHabitRoutines) — contá-las prometeria um
  // vínculo que o usuário não consegue ver.
  const routinesByGoal = React.useMemo(() => {
    const map = new Map<string, string[]>();
    routines.forEach((r) => {
      if (!r.goal_id) return;
      if (!FEATURES.dietAndHabitRoutines && r.type !== 1) return;
      const names = map.get(r.goal_id) ?? [];
      const name = r.name ?? "";
      if (!names.includes(name)) names.push(name);
      map.set(r.goal_id, names);
    });
    return map;
  }, [routines]);

  const active = userGoals.filter((g) => g.perc < 100);
  const completed = userGoals.filter((g) => g.perc >= 100);
  const visibleActive = expanded ? active : active.slice(0, COLLAPSED_COUNT);
  const hasMore = active.length > COLLAPSED_COUNT || completed.length > 0;

  const renderGoalCard = (goal: UserGoal, isCompleted: boolean) => {
    const linkedNames = routinesByGoal.get(goal.goal_id) ?? [];
    const linkedRoutines = linkedNames.length;
    const perc = Math.min(100, Math.round(goal.perc));
    return (
      <div
        key={goal.id}
        className="cursor-pointer active:scale-[0.99] transition-all"
        style={{ borderRadius: "22px", padding: "16px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}
        onClick={() => onOpenGoal?.(goal)}
      >
        <div className="flex items-start gap-2.5 mb-3">
          {/* Ícone do mesmo conjunto (Lucide) do resto do app — antes era emoji. */}
          <span
            className="shrink-0 flex items-center justify-center"
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "12px",
              background: isCompleted ? "rgba(251,191,36,.16)" : "rgba(224,69,123,.16)",
              color: isCompleted ? "#fbbf24" : "#ff7aa2",
            }}
          >
            {isCompleted ? <Trophy className="h-5 w-5" /> : <Target className="h-5 w-5" />}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[16px] font-semibold text-white truncate">{goal.description}</p>
            <p className="text-[13px] mt-0.5" style={{ color: "rgba(255,255,255,.52)" }}>
              {goal.days_completed}/{goal.duration} {t("goals_streak_days")}
            </p>
            {/* Vínculo com rotina. É o check-in de uma rotina vinculada que soma
                progresso automaticamente (fora dele, só um post ligado à meta
                soma) — por isso, sem vínculo, aparece o link "Vincular a uma
                rotina": o toque cai no card, que abre o drawer da meta com a
                lista para vincular. Meta concluída não mostra: o app solta as
                rotinas dela. */}
            {!isCompleted && linkedRoutines > 0 && (
              <span
                className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ background: "rgba(34,197,94,.14)", border: "1px solid rgba(34,197,94,.32)", color: "#4ade80" }}
              >
                <Link2 className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {linkedRoutines === 1 && linkedNames[0]
                    ? t("goals_linked_routine_one").replace("{name}", linkedNames[0])
                    : t("goals_linked_routines_count").replace("{n}", String(linkedRoutines))}
                </span>
              </span>
            )}
            {!isCompleted && linkedRoutines === 0 && (
              <span className="mt-2 inline-flex max-w-full items-center gap-1.5 text-[13px] font-semibold text-primary">
                <Link2 className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
                <span className="truncate">{t("goals_link_routine_cta")}</span>
              </span>
            )}
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
      {/* "Nova meta" mora no título (antes: botão grande no fim da lista +
          etiqueta "opcional"). Sem metas, o estado vazio já tem o CTA. */}
      <SectionHeader
        title={t("goals_dash_life_goals")}
        action={userGoals.length > 0 ? { label: t("goals_add"), onClick: onCreateGoal, icon: Plus } : undefined}
      />

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

          {/* "Ver todas" saiu do título (que agora só tem "Nova meta") e virou
              um link no pé da lista. */}
          {hasMore && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="w-full h-10 text-sm font-semibold text-primary active:opacity-60 transition-opacity"
            >
              {expanded ? t("goals_dash_show_less") : t("goals_dash_view_all")}
            </button>
          )}
        </>
      )}
    </div>
  );
}
