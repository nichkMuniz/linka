import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { TrendingUp } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import type { WorkoutHistoryRecord, Workout, CompletedRoutineExercise } from "@/lib/ritmofit-db";
import { getEnrichedDuelGroupsDb } from "@/lib/ritmofit-db";

interface WorkoutHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedWorkout: Workout | null;
  history: WorkoutHistoryRecord[];
  isLoading: boolean;
  userId: string | undefined;
  onOpenSummaryFromHistory: (data: {
    summaryData: {
      duration: number;
      totalVolume: number;
      totalSeries: number;
      exerciseNames: string[];
      exercises: CompletedRoutineExercise[];
      routineName: string | null;
      prs: Array<{ exerciseName: string; kg: number; reps: number }>;
      isAllCardio: boolean;
      totalKm: number;
      totalCardioTimeSecs: number;
    };
    postDescription: string;
    duelGroups: Array<{ id: string; name: string; goal: string }>;
  }) => void;
}

export function WorkoutHistoryDrawer({
  open,
  onOpenChange,
  selectedWorkout,
  history,
  isLoading,
  userId,
  onOpenSummaryFromHistory,
}: WorkoutHistoryDrawerProps) {
  const { t } = useLanguage();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DrawerHeader className="shrink-0">
          <DrawerTitle>
            {t("goals_history_of").replace("{name}", selectedWorkout?.name || t("goals_exercise_default"))}
          </DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {isLoading ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              {t("goals_history_loading")}
            </div>
          ) : history.length > 0 ? (
            (() => {
              const allKilos = history.map((r) => r.kilos || 0).filter((k) => k > 0);
              const prKg = allKilos.length > 0 ? Math.max(...allKilos) : null;
              const prRecord = prKg ? history.find((r) => r.kilos === prKg) : null;
              const prReps = prRecord?.volume ? parseInt(prRecord.volume) || 1 : 1;
              const estimated1RM = prKg && prReps > 0 ? Math.round(prKg * (1 + prReps / 30) * 10) / 10 : null;
              const totalSessions = new Set(
                history.map((r) => new Date(r.dateCompleted).toLocaleDateString("pt-BR"))
              ).size;

              const groupedByDay: Record<string, typeof history> = {};
              history.forEach((record) => {
                const date = new Date(record.dateCompleted);
                const dateKey = date.toLocaleDateString("pt-BR");
                if (!groupedByDay[dateKey]) {
                  groupedByDay[dateKey] = [];
                }
                groupedByDay[dateKey].push(record);
              });

              const sortedDates = Object.keys(groupedByDay).sort((a, b) => {
                const dateA = new Date(a.split("/").reverse().join("-"));
                const dateB = new Date(b.split("/").reverse().join("-"));
                return dateB.getTime() - dateA.getTime();
              });

              return (
                <>
                  <div className="grid grid-cols-3 gap-2 mb-5">
                    <div className="flex flex-col items-center gap-0.5 rounded-xl bg-brand/10 border border-brand/20 p-3">
                      <span className="text-lg">🏆</span>
                      <p className="text-xs text-muted-foreground">{t("goals_record_label")}</p>
                      <p className="text-sm font-bold">{prKg ? `${prKg} kg` : "—"}</p>
                    </div>
                    <div className="flex flex-col items-center gap-0.5 rounded-xl bg-muted/40 border border-border/40 p-3">
                      <span className="text-lg">💡</span>
                      <p className="text-xs text-muted-foreground">{t("goals_1rm_est")}</p>
                      <p className="text-sm font-bold">{estimated1RM ? `${estimated1RM} kg` : "—"}</p>
                    </div>
                    <div className="flex flex-col items-center gap-0.5 rounded-xl bg-muted/40 border border-border/40 p-3">
                      <span className="text-lg">📅</span>
                      <p className="text-xs text-muted-foreground">{t("goals_sessions_label")}</p>
                      <p className="text-sm font-bold">{totalSessions}</p>
                    </div>
                  </div>

                  {(() => {
                    const chartData = sortedDates.slice().reverse().map((dateKey) => {
                      const dayKilos = groupedByDay[dateKey]
                        .map((r) => r.kilos || 0)
                        .filter((k) => k > 0);
                      const maxKg = dayKilos.length > 0 ? Math.max(...dayKilos) : 0;
                      const parts = dateKey.split("/");
                      const label = `${parts[0]}/${parts[1]}`;
                      return { date: label, kg: maxKg };
                    }).filter((d) => d.kg > 0);

                    if (chartData.length < 2) return null;

                    return (
                      <div className="mb-5 rounded-xl bg-muted/30 border border-border/40 p-3">
                        <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                          <TrendingUp className="h-3.5 w-3.5" />
                          Progressão de carga (kg)
                        </p>
                        <ResponsiveContainer width="100%" height={120}>
                          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                            <XAxis
                              dataKey="date"
                              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis
                              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                              tickLine={false}
                              axisLine={false}
                              domain={["auto", "auto"]}
                            />
                            <Tooltip
                              contentStyle={{
                                background: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: 8,
                                fontSize: 12,
                              }}
                              formatter={(value: number) => [`${value} kg`, "Carga"]}
                              labelStyle={{ color: "hsl(var(--muted-foreground))", marginBottom: 2 }}
                            />
                            {prKg && (
                              <ReferenceLine
                                y={prKg}
                                stroke="hsl(var(--brand))"
                                strokeDasharray="4 3"
                                label={{ value: "PR", position: "insideTopRight", fontSize: 9, fill: "hsl(var(--brand))" }}
                              />
                            )}
                            <Line
                              type="monotone"
                              dataKey="kg"
                              stroke="hsl(var(--brand))"
                              strokeWidth={2}
                              dot={{ r: 3, fill: "hsl(var(--brand))", strokeWidth: 0 }}
                              activeDot={{ r: 5 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  })()}

                  {sortedDates.map((dateKey) => {
                    const dayRecords = groupedByDay[dateKey];
                    const totalKilos = dayRecords.reduce((sum, r) => sum + (r.kilos || 0), 0);
                    const totalReps = dayRecords.length;

                    return (
                      <div key={dateKey} className="mb-6">
                        <div className="sticky top-0 bg-background/95 py-2 mb-2">
                          <button
                            className="text-xs font-semibold text-muted-foreground uppercase hover:text-brand transition-colors flex items-center gap-1"
                            onClick={async () => {
                              const totalVolume = dayRecords.reduce((sum, r) => sum + (r.kilos || 0), 0);
                              const totalSeries = dayRecords.length;
                              const kgValues = dayRecords.map((r) => r.kilos || 0).filter((k) => k > 0);
                              const bestKg = kgValues.length > 0 ? Math.max(...kgValues) : 0;
                              const prHistorical = history
                                .filter((r) => new Date(r.dateCompleted).toLocaleDateString("pt-BR") !== dateKey)
                                .map((r) => r.kilos || 0);
                              const bestHistorical = prHistorical.length > 0 ? Math.max(...prHistorical) : 0;
                              const prs = bestKg > bestHistorical && selectedWorkout?.name
                                ? [{ exerciseName: selectedWorkout.name, kg: bestKg, reps: (() => { const rec = dayRecords.find((r) => r.kilos === bestKg); return rec?.volume ? parseInt(rec.volume) || 0 : 0; })() }]
                                : [];

                              let duelGroups: Array<{ id: string; name: string; goal: string }> = [];
                              if (userId) {
                                try {
                                  const { myGroups } = await getEnrichedDuelGroupsDb(userId);
                                  duelGroups = myGroups.map((g) => ({ id: g.id, name: g.name, goal: g.goal }));
                                } catch { duelGroups = []; }
                              }

                              const hName = selectedWorkout?.name || null;
                              const hStr = hName ? `Treino de ${hName}` : "Treino concluído";

                              onOpenSummaryFromHistory({
                                summaryData: {
                                  duration: 0,
                                  totalVolume,
                                  totalSeries,
                                  exerciseNames: selectedWorkout?.name ? [selectedWorkout.name] : [],
                                  exercises: dayRecords.map((r) => ({
                                    workoutId: selectedWorkout?.id || "",
                                    workoutName: selectedWorkout?.name || "",
                                    muscleGroup: (selectedWorkout as any)?.muscle_group || null,
                                    kilos: r.kilos || null,
                                    volume: r.volume || null,
                                  })),
                                  routineName: selectedWorkout?.name || null,
                                  prs,
                                  isAllCardio: ((selectedWorkout as any)?.muscle_group || "").toLowerCase() === "cardio",
                                  totalKm: ((selectedWorkout as any)?.muscle_group || "").toLowerCase() === "cardio" ? totalVolume : 0,
                                  totalCardioTimeSecs: ((selectedWorkout as any)?.muscle_group || "").toLowerCase() === "cardio"
                                    ? dayRecords.reduce((sum, r) => sum + (Number(r.volume) || 0), 0)
                                    : 0,
                                },
                                postDescription: `💪 ${hStr}!\n✅ ${dayRecords.length} séries\n\n#Linka #Fitness #Treino`,
                                duelGroups,
                              });
                            }}
                          >
                            {dateKey} <span className="text-brand/60 font-normal ml-1">· ver resumo</span>
                          </button>
                          <div className="flex gap-4 mt-1">
                            <div>
                              <p className="text-xs text-muted-foreground">
                                {totalReps} série(s)
                              </p>
                            </div>
                            {totalKilos > 0 && (
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  {totalKilos} kg total
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1">
                          {dayRecords.map((record) => {
                            const time = new Date(record.dateCompleted).toLocaleTimeString(
                              "pt-BR",
                              { hour: "2-digit", minute: "2-digit" }
                            );
                            return (
                              <div
                                key={record.id}
                                className="flex items-center justify-between p-2 rounded hover:bg-muted/40 transition-colors"
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <p className="text-xs text-muted-foreground w-10">
                                    {time}
                                  </p>
                                  <div className="flex gap-2 flex-1 min-w-0 overflow-x-auto">
                                    {record.kilos && (
                                      <span className="text-xs font-medium px-2 py-1 bg-muted/50 rounded whitespace-nowrap">
                                        {record.kilos} kg
                                      </span>
                                    )}
                                    {record.volume && (
                                      <span className="text-xs font-medium px-2 py-1 bg-muted/50 rounded whitespace-nowrap">
                                        {record.volume}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </>
              );
            })()
          ) : (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Nenhum registro de treino encontrado
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
