import * as React from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/use-toast";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Play,
  CheckCircle2,
  Check,
  Plus,
  MoreVertical,
  Trash2,
  Edit2,
  Tag,
  Droplets,
  Minus,
  Salad,
  Apple,
  AlertCircle,
  Bell,
  BellOff,
  BarChart2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExerciseImage } from "@/components/shared/exercise-image";
import { DietImage } from "@/components/shared/diet-image";
import { useLanguage } from "@/lib/language-context";
import type {
  UserWorkoutWithDetails,
  UserDietWithDetails,
  UserHabitWithDetails,
  Routine,
} from "@/lib/ritmofit-db";


interface RoutinesTabProps {
  // Auth
  user: { id: string } | null;

  // Data
  userWorkouts: UserWorkoutWithDetails[];
  userDiets: UserDietWithDetails[];
  userHabits: UserHabitWithDetails[];
  routines: Routine[];
  routineLastDates: Record<string, string>;

  // Check-in display
  dailyCheckInDone: boolean;
  weekCheckIns: Set<number>;
  streakCount: number;
  checkInHistory: { check_in_date: string }[];
  checkInWeekOffset: number;
  onCheckInWeekOffsetChange: (fn: (prev: number) => number) => void;

  // Hydration
  hydrationMl: number;
  hydrationGoalMl: number;
  isAddingHydration: boolean;
  onAddHydration: (ml: number) => Promise<void>;
  onUndoHydration: () => Promise<void>;

  // Macro
  todayMacro: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    quality_counts: { in_natura: number; processado: number; ultraprocessado: number };
  } | null;

  // Completion tracking
  completedDietIds: Set<string>;
  completedHabitIds: Set<string>;
  onToggleDiet: (item: UserDietWithDetails, isCompleting: boolean) => Promise<void>;
  onToggleHabit: (item: UserHabitWithDetails, isCompleting: boolean) => Promise<void>;

  showCompletedForRoutine: Set<string>;
  onSetShowCompletedForRoutine: (fn: (prev: Set<string>) => Set<string>) => void;

  // Section collapse
  collapsedSections: Set<number>;
  onToggleSection: (sType: number) => void;

  // Expand/collapse routine cards
  expandedRoutineId: string | null;
  onSetExpandedRoutineId: (id: string | null) => void;

  // Actions / modal triggers
  onAddRoutineClick: () => void;
  onAddToRoutineCard: (typeCode: number, displayLabel: string, isNamed: boolean) => void;
  onStartWorkout: (routineName: string) => void;
  onScheduleNotification: (target: { id: string; type: "workout" | "diet" | "habit"; name: string; currentTime: string | null }) => void;
  onRenameRoutine: (data: { typeCode: number; oldName: string | null }, value: string) => void;
  onLinkGoal: (key: { typeCode: number; name: string | null }) => void;
  onDeleteRoutineType: (typeCode: number, routineCardName: string | null) => void;
  onDeleteItem: (itemId: string, typeCode: number) => Promise<void>;
  onOpenWorkoutHistory: (workout: { id: string; name: string; description?: string; photo?: string }) => void;
  onShowRoutineSummary: (key: { typeCode: number; name: string | null }) => void;
  onImageZoom: (item: import("@/components/shared/image-zoom-drawer").ImageZoomItem) => void;

  formatScheduledTime: (time: string) => string;
}

export function RoutinesTab({
  user,
  userWorkouts,
  userDiets,
  userHabits,
  routines,
  routineLastDates,
  dailyCheckInDone,
  weekCheckIns,
  streakCount,
  checkInHistory,
  checkInWeekOffset,
  onCheckInWeekOffsetChange,
  hydrationMl,
  hydrationGoalMl,
  isAddingHydration,
  onAddHydration,
  onUndoHydration,
  todayMacro,
  completedDietIds,
  completedHabitIds,
  onToggleDiet,
  onToggleHabit,
  showCompletedForRoutine,
  onSetShowCompletedForRoutine,
  collapsedSections,
  onToggleSection,
  expandedRoutineId,
  onSetExpandedRoutineId,
  onAddRoutineClick,
  onAddToRoutineCard,
  onStartWorkout,
  onScheduleNotification,
  onRenameRoutine,
  onLinkGoal,
  onDeleteRoutineType,
  onDeleteItem,
  onOpenWorkoutHistory,
  onShowRoutineSummary,
  onImageZoom,
  formatScheduledTime,
}: RoutinesTabProps) {
  const { t } = useLanguage();
  const [hydrationCollapsed, setHydrationCollapsed] = React.useState(false);

  const hasWaterHabit = userHabits.some((h) => String((h as any).habit_id) === "1");

  return (
    <>
      {/* Daily Check-in Block */}
      <Card className={`border-2 ${dailyCheckInDone
        ? "border-green-500/50 bg-green-500/5"
        : "border-brand/30 bg-brand/5"
        }`}>
        <CardContent className="pt-6 pb-6">
          <div className="space-y-4">
            {/* Title and Description */}
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                {dailyCheckInDone ? t("goals_checkin_done") : t("goals_checkin_daily")}
              </p>
              <p className="text-xs text-muted-foreground">
                {dailyCheckInDone
                  ? t("goals_checkin_tomorrow")
                  : t("goals_checkin_prompt")}
              </p>
            </div>

            {/* Days of Week with week navigation */}
            {(() => {
              const today = new Date();
              const displayedSunday = new Date(today);
              displayedSunday.setDate(today.getDate() - today.getDay() + checkInWeekOffset * 7);
              displayedSunday.setHours(0, 0, 0, 0);
              const displayedWeekStart = displayedSunday.toISOString().split("T")[0];
              const displayedWeekEnd = new Date(displayedSunday);
              displayedWeekEnd.setDate(displayedSunday.getDate() + 6);
              const displayedWeekEndStr = displayedWeekEnd.toISOString().split("T")[0];

              const displayedDays = new Set<number>(
                checkInHistory
                  .filter((ci) => ci.check_in_date >= displayedWeekStart && ci.check_in_date <= displayedWeekEndStr)
                  .map((ci) => new Date(ci.check_in_date + "T12:00:00").getDay())
              );
              const daysToShow = checkInWeekOffset === 0 ? weekCheckIns : displayedDays;

              const isCurrentWeek = checkInWeekOffset === 0;
              const weekLabel = isCurrentWeek ? t("goals_this_week") : (() => {
                const end = new Date(displayedWeekEnd);
                return `${displayedSunday.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} – ${end.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
              })();

              return (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <button
                      onClick={() => onCheckInWeekOffsetChange((o) => o - 1)}
                      className="p-1.5 rounded-full hover:bg-muted transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <span className="text-[11px] text-muted-foreground font-medium">{weekLabel}</span>
                    <button
                      onClick={() => onCheckInWeekOffsetChange((o) => Math.min(0, o + 1))}
                      className={`p-1.5 rounded-full transition-colors ${isCurrentWeek ? "opacity-30 cursor-default" : "hover:bg-muted"}`}
                      disabled={isCurrentWeek}
                    >
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                  <div className="flex w-full">
                    {[t("goals_day_sun"), t("goals_day_mon"), t("goals_day_tue"), t("goals_day_wed"), t("goals_day_thu"), t("goals_day_fri"), t("goals_day_sat")].map((day, index) => {
                      const cellDate = new Date(displayedSunday);
                      cellDate.setDate(displayedSunday.getDate() + index);
                      const dayNum = cellDate.getDate();
                      const isToday = checkInWeekOffset === 0 && index === today.getDay();
                      const isChecked = daysToShow.has(index);
                      const prevChecked = index > 0 && daysToShow.has(index - 1);
                      const nextChecked = index < 6 && daysToShow.has(index + 1);
                      const isGroupFirst = isChecked && !prevChecked;
                      const isGroupLast = isChecked && !nextChecked;
                      const isSingle = isGroupFirst && isGroupLast;

                      return (
                        <div key={index} className="flex-1 flex flex-col items-center gap-1.5">
                          <span className={`text-[10px] font-medium leading-none ${isToday ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                            {isToday ? "Hoje" : day}
                          </span>

                          {isChecked ? (
                            <div
                              className={`w-full h-9 flex items-center justify-center border-2 border-brand bg-brand/10 transition-all
                                ${isSingle ? "rounded-full px-1" : ""}
                                ${isGroupFirst && !isGroupLast ? "rounded-l-full border-r-0 pl-1 pr-0" : ""}
                                ${isGroupLast && !isGroupFirst ? "rounded-r-full border-l-0 pl-0 pr-1" : ""}
                                ${!isGroupFirst && !isGroupLast ? "border-l-0 border-r-0" : ""}
                              `}
                            >
                              <Check className="h-4 w-4 text-brand" strokeWidth={2.5} />
                            </div>
                          ) : (
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center
                              ${isToday
                                ? "bg-muted-foreground/20 border border-muted-foreground/40"
                                : "bg-muted/60"
                              }`}
                            >
                              <span className={`text-xs font-bold ${isToday ? "text-foreground" : "text-muted-foreground"}`}>
                                {dayNum}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}

            {/* Streak inside check-in card */}
            {streakCount > 0 && (
              <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 mt-1 ${!dailyCheckInDone
                ? "bg-muted/40 border border-muted-foreground/20"
                : streakCount >= 30
                  ? "bg-purple-500/10 border border-purple-500/30"
                  : streakCount >= 7
                    ? "bg-orange-500/10 border border-orange-500/30"
                    : "bg-brand/10 border border-brand/20"
                }`}>
                <span className={`text-2xl leading-none ${!dailyCheckInDone ? "grayscale opacity-40" : ""}`}>
                  {streakCount >= 30 ? "👑" : streakCount >= 7 ? "🔥" : "⭐"}
                </span>
                <div className={`flex-1 min-w-0 ${!dailyCheckInDone ? "opacity-50" : ""}`}>
                  <p className="text-xs font-bold leading-tight">
                    {streakCount} {streakCount === 1 ? t("goals_streak_day") : t("goals_streak_days")} {t("goals_streak_consecutive")}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {!dailyCheckInDone
                      ? t("goals_streak_keep")
                      : streakCount >= 30
                        ? t("goals_streak_legendary")
                        : streakCount >= 7
                          ? t("goals_streak_week")
                          : t("goals_streak_continue")}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── Card de Hidratação ──────────────────────────────────────── */}
      {hasWaterHabit && (
        <Card className="border border-blue-500/30 bg-blue-500/5">
          <CardContent className="pt-4 pb-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-semibold">{t("goals_hydration")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {hydrationMl}ml / {hydrationGoalMl}ml
                  </span>
                  <button
                    onClick={() => setHydrationCollapsed((v) => !v)}
                    className="p-1 rounded hover:bg-blue-500/10 transition-colors"
                    aria-label={hydrationCollapsed ? "Expandir hidratação" : "Minimizar hidratação"}
                  >
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${hydrationCollapsed ? "rotate-180" : ""}`}
                    />
                  </button>
                </div>
              </div>

              {!hydrationCollapsed && (
                <>
                  <Progress value={Math.min(100, (hydrationMl / hydrationGoalMl) * 100)} className="h-2" />

                  <div className="flex items-center gap-2">
                    {[250, 350, 500].map((ml) => (
                      <Button
                        key={ml}
                        size="sm"
                        variant="outline"
                        disabled={isAddingHydration}
                        className="flex-1 h-8 text-xs border-blue-500/30 hover:bg-blue-500/10"
                        onClick={() => onAddHydration(ml)}
                      >
                        +{ml}ml
                      </Button>
                    ))}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isAddingHydration}
                      className="h-8 px-2"
                      title="Desfazer"
                      onClick={onUndoHydration}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                  </div>

                  {hydrationMl >= hydrationGoalMl && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium text-center">
                      {t("goals_hydration_today_done")}
                    </p>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Card de Macro do Dia ─────────────────────────────────────── */}
      {todayMacro && (todayMacro.calories > 0 || todayMacro.protein_g > 0) && (
        <Card className="border border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="pt-4 pb-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Salad className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-semibold">{t("goals_macro_today")}</span>
                </div>
                {todayMacro.calories > 0 && (
                  <span className="text-xs text-muted-foreground">{Math.round(todayMacro.calories)} kcal</span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-blue-500/10 p-2 text-center">
                  <p className="text-xs text-muted-foreground">{t("goals_macro_protein")}</p>
                  <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{Math.round(todayMacro.protein_g)}g</p>
                </div>
                <div className="rounded-lg bg-amber-500/10 p-2 text-center">
                  <p className="text-xs text-muted-foreground">{t("goals_macro_carb")}</p>
                  <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{Math.round(todayMacro.carbs_g)}g</p>
                </div>
                <div className="rounded-lg bg-red-500/10 p-2 text-center">
                  <p className="text-xs text-muted-foreground">{t("goals_macro_fat")}</p>
                  <p className="text-sm font-bold text-red-600 dark:text-red-400">{Math.round(todayMacro.fat_g)}g</p>
                </div>
              </div>

              {(todayMacro.quality_counts.in_natura + todayMacro.quality_counts.processado + todayMacro.quality_counts.ultraprocessado) > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">{t("goals_diet_quality")}</p>
                  <div className="flex gap-2 flex-wrap">
                    {todayMacro.quality_counts.in_natura > 0 && (
                      <span className="text-xs bg-green-500/10 text-green-700 dark:text-green-400 px-2 py-1 rounded-full flex items-center gap-1">
                        <Apple className="h-3 w-3" /> {todayMacro.quality_counts.in_natura}x {t("goals_food_natural")}
                      </span>
                    )}
                    {todayMacro.quality_counts.processado > 0 && (
                      <span className="text-xs bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 px-2 py-1 rounded-full">
                        {todayMacro.quality_counts.processado}x {t("goals_food_processed")}
                      </span>
                    )}
                    {todayMacro.quality_counts.ultraprocessado > 0 && (
                      <span className="text-xs bg-orange-500/10 text-orange-700 dark:text-orange-400 px-2 py-1 rounded-full flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {todayMacro.quality_counts.ultraprocessado}x {t("goals_food_ultra")}
                      </span>
                    )}
                  </div>
                  {todayMacro.quality_counts.ultraprocessado === 0 && (todayMacro.quality_counts.in_natura + todayMacro.quality_counts.processado) > 0 && (
                    <p className="text-xs text-green-600 dark:text-green-400">{t("goals_no_ultra_today")}</p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {(userWorkouts.length > 0 || userDiets.length > 0 || userHabits.length > 0) ? (
        <div className="space-y-4">
          {(() => {
            const cards: any[] = [];

            const groupItemsByName = (items: any[], typeCode: number, defaultLabel: string) => {
              const namedGroups = new Map<string, any[]>();
              const unnamedItems: any[] = [];

              items.forEach((item) => {
                if (item.name) {
                  const existing = namedGroups.get(item.name) || [];
                  existing.push(item);
                  namedGroups.set(item.name, existing);
                } else {
                  unnamedItems.push(item);
                }
              });

              const namedEntries = Array.from(namedGroups.entries());
              if (typeCode === 1) {
                namedEntries.sort(([, aItems], [, bItems]) => {
                  const aDate = aItems.reduce((max: string, i: any) => i.created_at > max ? i.created_at : max, "");
                  const bDate = bItems.reduce((max: string, i: any) => i.created_at > max ? i.created_at : max, "");
                  return bDate.localeCompare(aDate);
                });
              }
              namedEntries.forEach(([name, groupItems]) => {
                const lastDate = typeCode === 1
                  ? groupItems.reduce((max: string, i: any) => {
                    const d = routineLastDates[i.id] || "";
                    return d > max ? d : max;
                  }, "")
                  : null;
                cards.push({
                  key: `named-${typeCode}-${name}`,
                  typeCode,
                  displayLabel: name,
                  itemsForRoutine: groupItems,
                  isNamed: true,
                  lastDate: lastDate || null,
                });
              });

              if (unnamedItems.length > 0) {
                const lastDate = typeCode === 1
                  ? unnamedItems.reduce((max: string, i: any) => {
                    const d = routineLastDates[i.id] || "";
                    return d > max ? d : max;
                  }, "")
                  : null;
                cards.push({
                  key: `unnamed-${typeCode}`,
                  typeCode,
                  displayLabel: defaultLabel,
                  itemsForRoutine: unnamedItems,
                  isNamed: false,
                  lastDate: lastDate || null,
                });
              }
            };

            groupItemsByName(userWorkouts, 1, t("goals_rt_exercises"));
            groupItemsByName(userDiets, 2, t("goals_rt_diets"));
            groupItemsByName(userHabits, 3, t("goals_rt_habits"));

            const sectionConfigs = [
              { sType: 1, sLabel: `🏋️ ${t("goals_rt_exercises")}`, sColor: "text-blue-600" },
              { sType: 2, sLabel: `🥗 ${t("goals_rt_diets")}`, sColor: "text-emerald-600" },
              { sType: 3, sLabel: `🌱 ${t("goals_rt_habits")}`, sColor: "text-orange-600" },
            ];

            return sectionConfigs.flatMap(({ sType, sLabel, sColor }) => {
              const sectionCards = cards.filter((c) => c.typeCode === sType);
              if (sectionCards.length === 0) return [];

              const isCollapsed = collapsedSections.has(sType);

              const sectionHeader = (
                <button
                  key={`section-header-${sType}`}
                  onClick={() => onToggleSection(sType)}
                  className={`w-full flex items-center justify-between px-1 pt-2 pb-0.5 ${sColor} group`}
                >
                  <span className="text-xs font-semibold uppercase tracking-wider">{sLabel}</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${isCollapsed ? "rotate-180" : ""}`}
                  />
                </button>
              );

              if (isCollapsed) return [sectionHeader];

              const cardElements = sectionCards.map((card) => {
                const { key, typeCode, displayLabel, itemsForRoutine, isNamed, lastDate } = card;
                const isExpanded = expandedRoutineId === key;
                const lastDateLabel = typeCode === 1 && lastDate
                  ? (() => {
                    const d = new Date(lastDate);
                    const today = new Date();
                    const diffMs = today.getTime() - d.getTime();
                    const diffDays = Math.floor(diffMs / 86400000);
                    if (diffDays === 0) return "Hoje";
                    if (diffDays === 1) return "Ontem";
                    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
                  })()
                  : null;

                const isAllCompleted = (typeCode === 2 || typeCode === 3) &&
                  itemsForRoutine.length > 0 &&
                  itemsForRoutine.every((item: any) =>
                    typeCode === 2 ? completedDietIds.has(item.id) : completedHabitIds.has(item.id)
                  );

                return (
                  <Card
                    key={key}
                    className={`overflow-hidden min-w-0 transition-colors ${isAllCompleted ? "border-emerald-500/50 bg-emerald-500/5" : "border-border/60"}`}
                  >
                    <div className="w-full p-3 flex items-center gap-1 hover:bg-muted/30 transition-colors text-left min-w-0">
                      <button
                        onClick={() => onSetExpandedRoutineId(isExpanded ? null : key)}
                        className="flex-1 flex flex-col justify-center min-w-0 text-left"
                      >
                        <p className={`text-sm font-medium truncate w-full ${isAllCompleted ? "text-emerald-500" : ""}`}>{displayLabel}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {isAllCompleted ? (
                            <span className="text-emerald-500 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3 inline" /> Todas concluídas
                            </span>
                          ) : (
                            <>
                              {itemsForRoutine.length > 0 ? `${itemsForRoutine.length} item(ns)` : "Sem itens"}
                              {lastDateLabel && (
                                <span className="ml-1.5 text-[10px] text-brand/70">· {lastDateLabel}</span>
                              )}
                            </>
                          )}
                        </p>
                      </button>

                      {typeCode === 1 && itemsForRoutine.length > 0 && (
                        <>
                          {(() => {
                            try {
                              const routineKey = isNamed ? displayLabel : "__unnamed__";
                              const storageKey = `lastWorkoutSummary_${user?.id}_${routineKey}`;
                              return localStorage.getItem(storageKey) !== null;
                            } catch (_) { return false; }
                          })() && (
                            <button
                              onClick={() => onShowRoutineSummary({ typeCode, name: isNamed ? displayLabel : null })}
                              className="p-2 rounded-lg hover:bg-muted/50 transition-colors flex-shrink-0"
                              title="Resumo da rotina"
                            >
                              <BarChart2 className="h-5 w-5 text-muted-foreground" />
                            </button>
                          )}
                          <button
                            onClick={() => onStartWorkout(isNamed ? displayLabel : "__unnamed__")}
                            className="p-2 rounded-lg bg-brand/10 hover:bg-brand/20 transition-colors flex-shrink-0"
                          >
                            <Play className="h-5 w-5 text-brand" />
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => onSetExpandedRoutineId(isExpanded ? null : key)}
                        className="p-1.5 hover:bg-muted/50 rounded transition-colors flex-shrink-0"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-2 hover:bg-muted/50 rounded transition-colors flex-shrink-0">
                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => onAddToRoutineCard(typeCode, displayLabel, isNamed)}>
                            <Plus className="h-4 w-4 mr-2" />
                            {typeCode === 1 ? "Adicionar exercícios" : typeCode === 2 ? "Adicionar dietas" : "Adicionar hábito"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onRenameRoutine({ typeCode, oldName: isNamed ? displayLabel : null }, isNamed ? displayLabel : "")}
                          >
                            <Edit2 className="h-4 w-4 mr-2" />
                            Editar rotina
                          </DropdownMenuItem>
                          {!routines.some(
                            (r) => r.type === typeCode && (isNamed ? r.name === displayLabel : !r.name) && r.goal_id
                          ) && (
                              <DropdownMenuItem
                                onClick={() => onLinkGoal({ typeCode, name: isNamed ? displayLabel : null })}
                              >
                                <Tag className="h-4 w-4 mr-2" />
                                Vincular Meta
                              </DropdownMenuItem>
                            )}
                          {(typeCode === 2 || typeCode === 3) && (() => {
                            const completedIds = typeCode === 2 ? completedDietIds : completedHabitIds;
                            const hasCompleted = itemsForRoutine.some((item: any) => completedIds.has(item.id));
                            if (!hasCompleted) return null;
                            const isShowing = showCompletedForRoutine.has(key);
                            return (
                              <DropdownMenuItem
                                onClick={() => {
                                  onSetShowCompletedForRoutine((prev) => {
                                    const next = new Set(prev);
                                    if (isShowing) next.delete(key);
                                    else next.add(key);
                                    return next;
                                  });
                                }}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                {isShowing ? "Ocultar Concluídas" : "Mostrar Concluídas"}
                              </DropdownMenuItem>
                            );
                          })()}
                          <DropdownMenuItem
                            onClick={() => onDeleteRoutineType(typeCode, isNamed ? displayLabel : null)}
                            className="text-red-500"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir rotina
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-border/60 bg-muted/20 p-2.5 space-y-1.5 overflow-hidden w-full max-w-full">
                        {(() => {
                          const showCompleted = showCompletedForRoutine.has(key);
                          const visibleItems = itemsForRoutine.filter((item: any) => {
                            if (typeCode === 2) return showCompleted || !completedDietIds.has(item.id);
                            if (typeCode === 3) return showCompleted || !completedHabitIds.has(item.id);
                            return true;
                          });
                          const allCompleted = visibleItems.length === 0 && itemsForRoutine.length > 0 && (typeCode === 2 || typeCode === 3);
                          return visibleItems.length > 0 ? (
                            visibleItems.map((item: any) => (
                              <div key={item.id} className="space-y-1.5">
                                <div className="flex items-center gap-1.5 rounded-lg min-w-0 overflow-hidden w-full">
                                  {typeCode === 2 && (
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        await onToggleDiet(item, !completedDietIds.has(item.id));
                                      }}
                                      className={`py-1 px-2 rounded text-xs font-semibold transition-all flex-shrink-0 ${completedDietIds.has(item.id)
                                        ? "bg-green-500/20 text-green-700"
                                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                                        }`}
                                    >
                                      {completedDietIds.has(item.id) ? "✓" : "○"}
                                    </button>
                                  )}

                                  {typeCode === 3 && (
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        await onToggleHabit(item, !completedHabitIds.has(item.id));
                                      }}
                                      className={`py-1 px-2 rounded text-xs font-semibold transition-all flex-shrink-0 ${completedHabitIds.has(item.id)
                                        ? "bg-green-500/20 text-green-700"
                                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                                        }`}
                                    >
                                      {completedHabitIds.has(item.id) ? "✓" : "○"}
                                    </button>
                                  )}

                                  <div className="flex-1 flex items-start gap-2 rounded-lg min-w-0 overflow-hidden">
                                    {typeCode === 1 && (
                                      <button
                                        type="button"
                                        className="flex-shrink-0 rounded overflow-hidden"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onImageZoom({ src: item.workoutPhoto || null, name: item.workoutName || "", description: item.workoutDescription || undefined, muscleGroup: item.muscle_group });
                                        }}
                                      >
                                        <ExerciseImage
                                          photo={item.workoutPhoto || null}
                                          name={item.workoutName || ""}
                                          muscleGroup={item.muscle_group || null}
                                          className="h-10 w-10"
                                        />
                                      </button>
                                    )}
                                    {typeCode === 2 && (
                                      <button
                                        type="button"
                                        className="flex-shrink-0 rounded overflow-hidden"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onImageZoom({ src: item.dietPhoto || null, name: item.dietName || "", description: item.dietDescription || undefined, category: item.dietCategory });
                                        }}
                                      >
                                        <DietImage
                                          photo={item.dietPhoto || null}
                                          name={item.dietName || ""}
                                          category={item.dietCategory}
                                          className="h-10 w-10"
                                        />
                                      </button>
                                    )}
                                    <div className="flex-1 min-w-0 overflow-hidden text-left">
                                      {typeCode === 1 ? (
                                        <button
                                          className="text-sm font-medium truncate block w-full text-left hover:opacity-80 transition-opacity"
                                          onClick={() => onOpenWorkoutHistory({
                                            id: item.workout_id,
                                            name: item.workoutName,
                                            description: item.workoutDescription || undefined,
                                            photo: item.workoutPhoto || undefined,
                                          })}
                                        >
                                          {item.workoutName?.length > 18 ? item.workoutName.slice(0, 18) + "…" : item.workoutName}
                                        </button>
                                      ) : (
                                        <p className="text-sm font-medium truncate w-full">
                                          {(typeCode === 2 ? item.dietName : item.habitName)?.length > 18
                                            ? (typeCode === 2 ? item.dietName : item.habitName).slice(0, 18) + "…"
                                            : (typeCode === 2 ? item.dietName : item.habitName)}
                                        </p>
                                      )}
                                      {(item.workoutDescription || item.dietDescription || item.habitDescription) && (
                                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                          {typeCode === 1 ? item.workoutDescription : typeCode === 2 ? item.dietDescription : item.habitDescription}
                                        </p>
                                      )}
                                      {typeCode === 2 && (
                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                          {item.dietCalories != null && (
                                            <span className="text-xs text-muted-foreground">{item.dietCalories} cal</span>
                                          )}
                                          {item.dietProtein != null && (
                                            <span className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">P {item.dietProtein}g</span>
                                          )}
                                          {item.dietCarbs != null && (
                                            <span className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded">C {item.dietCarbs}g</span>
                                          )}
                                          {item.dietFat != null && (
                                            <span className="text-xs bg-red-500/10 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded">G {item.dietFat}g</span>
                                          )}
                                          {item.dietFoodQuality === "ultraprocessado" && (
                                            <span className="text-xs bg-orange-500/10 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                              <AlertCircle className="h-2.5 w-2.5" /> Ultra
                                            </span>
                                          )}
                                          {item.dietFoodQuality === "in_natura" && (
                                            <span className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                              <Apple className="h-2.5 w-2.5" /> Natural
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Notification bell */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const routineType = (typeCode === 1 ? "workout" : typeCode === 2 ? "diet" : "habit") as "workout" | "diet" | "habit";
                                      const itemName = typeCode === 1 ? item.workoutName : typeCode === 2 ? item.dietName : item.habitName;
                                      onScheduleNotification({
                                        id: item.id,
                                        type: routineType,
                                        name: itemName || "Item",
                                        currentTime: item.scheduled_time ?? null,
                                      });
                                    }}
                                    className={`p-1.5 hover:bg-brand/10 rounded transition-colors flex-shrink-0 ${item.scheduled_time ? "text-brand" : "text-muted-foreground"}`}
                                    title={item.scheduled_time ? `Lembrete: ${formatScheduledTime(item.scheduled_time)}` : "Definir lembrete"}
                                  >
                                    {item.scheduled_time ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                                  </button>

                                  {/* Delete item */}
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (typeCode === 1) {
                                        // For exercises, use the parent's delete exercise handler via onDeleteItem
                                        await onDeleteItem(item.id, typeCode);
                                      } else {
                                        await onDeleteItem(item.id, typeCode);
                                      }
                                    }}
                                    className="p-1.5 hover:bg-red-500/10 rounded transition-colors flex-shrink-0"
                                    title="Remover item"
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </button>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground text-center py-2">
                              {allCompleted ? "Todas as tarefas concluídas ✓" : "Nenhum item adicionado"}
                            </p>
                          );
                        })()}
                      </div>
                    )}
                  </Card>
                );
              });

              return [sectionHeader, ...cardElements];
            });
          })()}

          {/* Add more button */}
          <div className="flex justify-center pt-4 pb-4">
            <Button onClick={onAddRoutineClick} className="rounded-full gap-2" variant="outline">
              <Plus className="h-5 w-5" />
              Nova Rotina
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-center pt-12 pb-12">
          <div className="text-center space-y-4 max-w-xs">
            <p className="text-2xl">🏋️</p>
            <p className="text-sm font-medium">{t("goals_no_routines")}</p>
            <p className="text-xs text-muted-foreground">{t("goals_no_routines_desc")}</p>
            <Button onClick={onAddRoutineClick} className="rounded-full gap-2" size="lg">
              <Plus className="h-5 w-5" />
              {t("goals_create_routine")}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
