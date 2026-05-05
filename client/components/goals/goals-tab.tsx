import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Edit2, Plus, Search } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import type {
  ProgrammedGoal,
  UserGoal,
  Routine,
} from "@/lib/ritmofit-db";

interface GoalsTabProps {
  goals: ProgrammedGoal[];
  selectedGoalIds: string[];
  userGoals: UserGoal[];
  routines: Routine[];
  selectingGoalId: string | null;
  editingAvailableGoalId: string | null;
  editAvailableGoalDuration: number;
  editAvailableGoalQuantity: number;
  onSelectGoal: (goal: ProgrammedGoal) => void;
  onSetEditingAvailableGoalId: (id: string | null) => void;
  onSetEditAvailableGoalDuration: (v: number) => void;
  onSetEditAvailableGoalQuantity: (v: number) => void;
  onOpenEditGoal: (goal: UserGoal) => void;
  onOpenGoalRoutineModal: (goal: ProgrammedGoal, mode: "link" | "view") => void;
  onCreateGoalDrawerOpen: () => void;
}

export function GoalsTab({
  goals,
  selectedGoalIds,
  userGoals,
  routines,
  selectingGoalId,
  editingAvailableGoalId,
  editAvailableGoalDuration,
  editAvailableGoalQuantity,
  onSelectGoal,
  onSetEditingAvailableGoalId,
  onSetEditAvailableGoalDuration,
  onSetEditAvailableGoalQuantity,
  onOpenEditGoal,
  onOpenGoalRoutineModal,
  onCreateGoalDrawerOpen,
}: GoalsTabProps) {
  const { t } = useLanguage();
  const [availableGoalSearch, setAvailableGoalSearch] = React.useState("");

  const selectedGoals = goals.filter((goal) => selectedGoalIds.includes(goal.id));
  const activeGoals = selectedGoals.filter((goal) => {
    const userGoal = userGoals.find((ug) => ug.goal_id === goal.id);
    return (userGoal?.perc ?? 0) < 100;
  });
  const completedGoals = selectedGoals.filter((goal) => {
    const userGoal = userGoals.find((ug) => ug.goal_id === goal.id);
    return (userGoal?.perc ?? 0) >= 100;
  });

  return (
    <>
      {goals.length ? (
        <>
          {/* Onboarding banner — shown only when user has no active goals yet */}
          {activeGoals.length === 0 && completedGoals.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-5 text-center space-y-2">
              <p className="text-2xl">🎯</p>
              <p className="text-sm font-bold">{t("goals_onboarding_title")}</p>
              <p className="text-xs text-muted-foreground">{t("goals_onboarding_desc")}</p>
              <button
                type="button"
                onClick={onCreateGoalDrawerOpen}
                className="inline-flex items-center gap-1.5 mt-1 text-xs font-semibold text-primary hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("goals_create_own")}
              </button>
            </div>
          )}

          {/* Active Goals Section */}
          {activeGoals.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{t("goals_my_active")}</h3>
                <span className="text-xs text-muted-foreground">
                  {activeGoals.length} meta{activeGoals.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {activeGoals
                  .map((goal) => {
                    const userGoal = userGoals.find(ug => ug.goal_id === goal.id);
                    const duration = userGoal?.duration || goal.duration;
                    const quantity = userGoal?.quantity || goal.quantity;

                    const goalTypeLabel =
                      goal.type === 1
                        ? t("goals_type_fitness")
                        : goal.type === 2
                          ? t("goals_type_health")
                          : t("goals_type_habits");
                    const goalTypeColor =
                      goal.type === 1
                        ? "bg-blue-500/10 text-blue-600"
                        : goal.type === 2
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-orange-500/10 text-orange-600";

                    return (
                      <Card
                        key={goal.id}
                        className="border-brand/40 bg-brand/5 overflow-hidden flex flex-col"
                      >
                        <div className={`px-3 py-1.5 ${goalTypeColor} text-xs font-semibold flex items-center justify-between`}>
                          <span>✓ {goalTypeLabel}</span>
                          {goal.created_by_user === 1 ? (
                            <span className="text-[10px] font-medium bg-orange-500/15 text-orange-600 px-1.5 py-0.5 rounded-full">{t("goals_custom")}</span>
                          ) : (
                            <span className="text-[10px] font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{t("goals_default")}</span>
                          )}
                        </div>
                        <CardHeader className="pb-2 pt-2">
                          <CardTitle className="text-sm line-clamp-2">
                            {goal.description}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 flex-1 flex flex-col">
                          <div className="grid grid-cols-2 gap-1.5 text-center text-xs">
                            <div className="bg-muted rounded p-1.5">
                              <p className="text-muted-foreground">{t("goals_duration")}</p>
                              <p className="font-bold">{duration}d</p>
                            </div>
                            <div className="bg-muted rounded p-1.5">
                              <p className="text-muted-foreground">{t("goals_frequency")}</p>
                              <p className="font-bold">{quantity}</p>
                            </div>
                          </div>

                          {userGoal && (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">{t("goals_progress")}</span>
                                <span className="font-bold text-brand">{Math.round(userGoal.perc)}%</span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-brand h-full rounded-full transition-all duration-500"
                                  style={{ width: `${userGoal.perc}%` }}
                                />
                              </div>
                            </div>
                          )}

                          <div className="flex gap-2 mt-auto">
                            {(() => {
                              const linkedRoutines = routines.filter(
                                (r) => r.goal_id && String(r.goal_id) === String(goal.id)
                              );
                              const linkedGroupCount = new Set(
                                linkedRoutines.map((r) => `${r.type}::${r.name || r.type}`)
                              ).size;
                              return (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 rounded-full text-xs h-8"
                                  onClick={() => {
                                    const mode = linkedRoutines.length > 0 ? "view" : "link";
                                    onOpenGoalRoutineModal(goal, mode);
                                  }}
                                >
                                  {linkedGroupCount > 0
                                    ? t("goals_view_routines").replace("{n}", String(linkedGroupCount))
                                    : t("goals_link_routine")}
                                </Button>
                              );
                            })()}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="flex-1 rounded-full text-xs h-8"
                              onClick={() => {
                                if (userGoal) {
                                  onOpenEditGoal({
                                    id: userGoal.id || goal.id,
                                    goal_id: goal.id,
                                    description: goal.description,
                                    duration: duration,
                                    quantity: quantity,
                                    type_goal: goal.type ?? 0,
                                    perc: userGoal.perc ?? 0,
                                    days_completed: userGoal.days_completed ?? 0,
                                    visibility: userGoal.visibility ?? 1,
                                  });
                                }
                              }}
                            >
                              {t("goals_edit")}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Available Goals Section - Accordion */}
          {goals.filter((g) => !selectedGoalIds.includes(g.id)).length > 0 && (
            <Accordion type="single" collapsible defaultValue={activeGoals.length === 0 && completedGoals.length === 0 ? "available-goals" : ""}>
              <AccordionItem value="available-goals" className="border-border/60">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <h3 className="text-sm font-semibold">{t("goals_available")}</h3>
                    <span className="text-xs text-muted-foreground">
                      {goals.filter((g) => !selectedGoalIds.includes(g.id)).length} meta{
                        goals.filter((g) => !selectedGoalIds.includes(g.id)).length > 1 ? "s" : ""
                      }
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="relative pt-4 pb-2">
                    <Search className="absolute left-3 top-1/2 translate-y-[2px] h-4 w-4 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Buscar meta..."
                      value={availableGoalSearch}
                      onChange={(e) => setAvailableGoalSearch(e.target.value)}
                      className="w-full h-9 pl-9 pr-3 border border-border/60 rounded-lg text-sm bg-background focus:border-brand focus:outline-none"
                      style={{ fontSize: "16px" }}
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 pt-2">
                    {goals
                      .filter((g) => !selectedGoalIds.includes(g.id))
                      .filter((g) =>
                        availableGoalSearch.trim() === "" ||
                        g.description.toLowerCase().includes(availableGoalSearch.toLowerCase())
                      )
                      .map((goal) => {
                        const goalTypeLabel =
                          goal.type === 1
                            ? t("goals_type_fitness")
                            : goal.type === 2
                              ? t("goals_type_health")
                              : t("goals_type_habits");
                        const goalTypeColor =
                          goal.type === 1
                            ? "bg-blue-500/10 text-blue-600"
                            : goal.type === 2
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-orange-500/10 text-orange-600";

                        const isEditingThis = editingAvailableGoalId === goal.id;
                        return (
                          <Card
                            key={goal.id}
                            className="border-border/60 hover:border-border/80 transition-all flex flex-col overflow-hidden"
                          >
                            <div className={`flex items-center justify-between px-3 py-1.5 ${goalTypeColor} text-xs font-semibold`}>
                              <span className="flex items-center gap-1.5">
                                {goalTypeLabel}
                                {goal.created_by_user === 1 ? (
                                  <span className="text-[10px] font-medium bg-orange-500/15 text-orange-600 px-1.5 py-0.5 rounded-full">{t("goals_custom")}</span>
                                ) : (
                                  <span className="text-[10px] font-medium bg-black/10 text-current px-1.5 py-0.5 rounded-full">{t("goals_default")}</span>
                                )}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (isEditingThis) {
                                    onSetEditingAvailableGoalId(null);
                                  } else {
                                    onSetEditingAvailableGoalId(goal.id);
                                    onSetEditAvailableGoalDuration(goal.duration);
                                    onSetEditAvailableGoalQuantity(goal.quantity);
                                  }
                                }}
                                className="opacity-70 hover:opacity-100 transition-opacity"
                                aria-label="Editar meta"
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                            </div>
                            <CardHeader className="pb-2 pt-2">
                              <CardTitle className="text-sm line-clamp-2">
                                {goal.description}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 flex-1 flex flex-col">
                              {isEditingThis ? (
                                <div className="space-y-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1">{t("goals_duration_days")}</p>
                                      <input
                                        type="number"
                                        min={1}
                                        value={editAvailableGoalDuration}
                                        onChange={(e) => onSetEditAvailableGoalDuration(parseInt(e.target.value) || 1)}
                                        className="w-full h-8 px-2 border border-border/60 rounded text-xs font-semibold bg-background text-center focus:border-brand focus:outline-none"
                                        style={{ fontSize: '16px' }}
                                      />
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1">{t("goals_quantity")}</p>
                                      <input
                                        type="number"
                                        min={1}
                                        value={editAvailableGoalQuantity}
                                        onChange={(e) => onSetEditAvailableGoalQuantity(parseInt(e.target.value) || 1)}
                                        className="w-full h-8 px-2 border border-border/60 rounded text-xs font-semibold bg-background text-center focus:border-brand focus:outline-none"
                                        style={{ fontSize: '16px' }}
                                      />
                                    </div>
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="w-full rounded-full text-xs h-8"
                                    disabled={selectingGoalId === goal.id}
                                    onClick={() => {
                                      const customGoal = { ...goal, duration: editAvailableGoalDuration, quantity: editAvailableGoalQuantity };
                                      onSetEditingAvailableGoalId(null);
                                      onSelectGoal(customGoal);
                                    }}
                                  >
                                    {selectingGoalId === goal.id ? t("goals_saving") : t("goals_confirm")}
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <div className="grid grid-cols-2 gap-1.5 text-center text-xs">
                                    <div className="bg-muted rounded p-1.5">
                                      <p className="text-muted-foreground">{t("goals_duration")}</p>
                                      <p className="font-bold">{goal.duration}d</p>
                                    </div>
                                    <div className="bg-muted rounded p-1.5">
                                      <p className="text-muted-foreground">{t("goals_qty")}</p>
                                      <p className="font-bold">{goal.quantity}</p>
                                    </div>
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="w-full rounded-full mt-auto text-xs h-8"
                                    disabled={selectingGoalId === goal.id}
                                    onClick={() => onSelectGoal(goal)}
                                  >
                                    {selectingGoalId === goal.id ? t("goals_saving") : t("goals_select")}
                                  </Button>
                                </>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                  </div>
                  {goals
                    .filter((g) => !selectedGoalIds.includes(g.id))
                    .filter((g) =>
                      availableGoalSearch.trim() === "" ||
                      g.description.toLowerCase().includes(availableGoalSearch.toLowerCase())
                    ).length === 0 && availableGoalSearch.trim() !== "" && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Nenhuma meta encontrada para "{availableGoalSearch}"
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
          {/* Completed Goals Section - Accordion (starts closed) */}
          {completedGoals.length > 0 && (
            <Accordion type="single" collapsible defaultValue="">
              <AccordionItem value="completed-goals" className="border-border/60">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <h3 className="text-sm font-semibold">{t("goals_completed_section")}</h3>
                    <span className="text-xs text-muted-foreground">
                      {completedGoals.length} meta{completedGoals.length > 1 ? "s" : ""}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 pt-2">
                    {completedGoals.map((goal) => {
                      const userGoal = userGoals.find((ug) => ug.goal_id === goal.id);
                      const duration = userGoal?.duration || goal.duration;
                      const quantity = userGoal?.quantity || goal.quantity;
                      const goalTypeLabel =
                        goal.type === 1
                          ? t("goals_type_fitness")
                          : goal.type === 2
                            ? t("goals_type_health")
                            : t("goals_type_habits");
                      const goalTypeColor =
                        goal.type === 1
                          ? "bg-blue-500/10 text-blue-600"
                          : goal.type === 2
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-orange-500/10 text-orange-600";
                      return (
                        <Card
                          key={goal.id}
                          className="border-emerald-500/30 bg-emerald-500/5 overflow-hidden flex flex-col"
                        >
                          <div className={`px-3 py-1.5 ${goalTypeColor} text-xs font-semibold flex items-center justify-between`}>
                            <span>✓ {goalTypeLabel}</span>
                            <span className="text-[10px] font-medium bg-emerald-500/15 text-emerald-600 px-1.5 py-0.5 rounded-full">100%</span>
                          </div>
                          <CardHeader className="pb-2 pt-2">
                            <CardTitle className="text-sm line-clamp-2">{goal.description}</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2 flex-1 flex flex-col">
                            <div className="grid grid-cols-2 gap-1.5 text-center text-xs">
                              <div className="bg-muted rounded p-1.5">
                                <p className="text-muted-foreground">{t("goals_duration")}</p>
                                <p className="font-bold">{duration}d</p>
                              </div>
                              <div className="bg-muted rounded p-1.5">
                                <p className="text-muted-foreground">{t("goals_frequency")}</p>
                                <p className="font-bold">{quantity}</p>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">{t("goals_progress")}</span>
                                <span className="font-bold text-emerald-600">100%</span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                <div className="bg-emerald-500 h-full rounded-full w-full" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {/* Create custom goal button */}
          <div className="flex justify-center pt-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-full gap-2 text-sm"
              onClick={onCreateGoalDrawerOpen}
            >
              <Plus className="h-4 w-4" />
              {t("goals_create_own")}
            </Button>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-border/60 bg-muted/30 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma meta disponível no momento.
          </p>
          <Button
            type="button"
            variant="outline"
            className="rounded-full gap-2 text-sm mt-4"
            onClick={onCreateGoalDrawerOpen}
          >
            <Plus className="h-4 w-4" />
            {t("goals_create_custom")}
          </Button>
        </div>
      )}
    </>
  );
}
