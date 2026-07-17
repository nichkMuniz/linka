import * as React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/lib/language-context";
import { useWorkout } from "@/lib/workout-context";
import { toast } from "@/components/ui/use-toast";
import { showRoutineCompleteToast } from "@/lib/routine-complete-toast";
import {
  getUserRoutinesDb,
  getUserWorkoutsDb,
  getUserDietsDb,
  getUserHabitsDb,
  getUserGoalsDb,
  getCheckInHistoryDb,
  getRoutineLastDatesBatchDb,
  getLastWorkoutSessionSeriesDb,
  getUserBadgesDb,
  getAllBadgesDb,
  getDisplayBadgeDb,
  getTotalCheckInsDb,
  getWeightLogsDb,
  addWeightLogDb,
  deleteWeightLogDb,
  addFoodLogDb,
  deleteFoodLogForDietItemDb,
  createCustomDietDb,
  createUserDietsDb,
  backfillRoutineIdOnItemsDb,
  createCheckInDb,
  awardBadgesForCheckInsDb,
  incrementGoalProgressDb,
  toggleUserDietCompletionDb,
  toggleUserHabitCompletionDb,
  saveDietHistoryDb,
  saveHabitHistoryDb,
  deleteRoutineCardDb,
  deleteRoutineItemDb,
  updateRoutineNameDb,
  updateRoutineItemsScheduledTimeDb,
  updateRoutineItemsScheduledDaysDb,
  updateRoutineItemScheduledTimeDb,
  updateHabitScheduledEndTimeDb,
  updateRoutineGoalDb,
  updateRoutineLastSummaryDb,
  updateUserGoalDb,
  deleteUserGoalDb,
  getEnrichedDuelGroupsDb,
  type Routine,
  type UserGoal,
  type UserWorkoutWithDetails,
  type UserDietWithDetails,
  type UserHabitWithDetails,
  type Badge,
  type UserBadge,
  type RoutineTypeCode,
  type WeightLog,
  type FoodLog,
} from "@/lib/ritmofit-db";
import {
  buildRoutineCards,
  computeStreak,
  computeWeekCheckins,
  getSuggestedSetsForCard,
  isCompletedToday,
  isRoutineCompleted,
  type RoutineCard,
  type RoutineItem,
  type WeekDayState,
} from "@/components/goals/goals-helpers";
import { GoalsSkeleton } from "@/components/shared/animated-loading";
import { addNetworkStatusListener, getNetworkStatus } from "@/lib/network-status";
import { OUTBOX_SYNCED_EVENT } from "@/lib/offline-outbox";
import { WifiOff } from "lucide-react";
import { StreakBadgesCard } from "@/components/goals/streak-badges-card";
import { TodayDashboard } from "@/components/goals/today-dashboard";
import { RoutineTypeCards, type RoutineTypeProgress } from "@/components/goals/routine-type-cards";
import { WeightTrackerCard } from "@/components/goals/weight-tracker-card";
import { FoodDiaryDrawer, inferMealType, localDateISO } from "@/components/goals/food-diary-card";
import { LifeGoalsSection } from "@/components/goals/life-goals-section";
import { CreateWizardDrawer } from "@/components/goals/create-wizard-drawer";
import { RoutineListDrawer } from "@/components/goals/routine-list-drawer";
import { RoutineDetailDrawer } from "@/components/goals/routine-detail-drawer";
import { GoalDetailDrawer } from "@/components/goals/goal-detail-drawer";
import { GoalShareDrawer } from "@/components/goals/goal-share-drawer";
import {
  WorkoutSessionDialog,
  type WorkoutSessionSummary,
} from "@/components/goals/workout-session-dialog";
import {
  WorkoutSummaryOverlay,
  type WorkoutSummaryData,
} from "@/components/goals/workout-summary-overlay";
import { BadgeUnlockedDialog } from "@/components/goals/badge-unlocked-dialog";
import { GoalCompletedDialog } from "@/components/shared/goal-completed-dialog";
import { InsigniasDrawer } from "@/components/profile/insignias-drawer";
import { CheckInCalendarModal } from "@/components/goals/check-in-calendar-modal";

/**
 * Converte a faixa de repetições sugerida (texto) em um número para
 * pré-preencher a série. Ex: '12'→12, '8-12'→12 (limite superior).
 * Alvos por tempo ('30s', '20min') ou até a falha ('falha') não são
 * repetições contáveis → retorna 0 (usuário define manualmente).
 */
function parseSuggestedReps(reps: string): number {
  const s = reps.trim().toLowerCase();
  if (s.includes("s") || s.includes("min") || s.includes("fal") || s.includes("max")) return 0;
  const nums = s.match(/\d+/g);
  if (!nums || nums.length === 0) return 0;
  return Number(nums[nums.length - 1]); // limite superior de um range
}

// ─── Date helpers (local time, "YYYY-MM-DD") ────────────────────────────────

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Longest consecutive-day run ever, from the check-in history. */
function computeRecordStreak(history: Array<{ check_in_date: string }>): number {
  const days = Array.from(new Set(history.map((h) => h.check_in_date))).sort();
  let best = 0;
  let cur = 0;
  let prev: string | null = null;
  for (const d of days) {
    if (prev) {
      const pd = new Date(prev + "T12:00:00");
      pd.setDate(pd.getDate() + 1);
      cur = d === localDateStr(pd) ? cur + 1 : 1;
    } else {
      cur = 1;
    }
    best = Math.max(best, cur);
    prev = d;
  }
  return best;
}

/** última execução do card de treino = data mais recente entre seus itens */
function cardLastDate(card: RoutineCard, lastDates: Record<string, string>): string | null {
  const dates = card.items
    .map((i) => lastDates[i.id])
    .filter(Boolean)
    .map((d) => d.slice(0, 10))
    .sort();
  return dates.pop() ?? null;
}

// ─── Página Metas (glass "Hub do Hoje") ─────────────────────────────────────

export default function Goals() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    workoutModalOpen,
    setWorkoutModalOpen,
    workoutMinimized,
    setWorkoutMinimized,
    selectedRoutineName,
    setSelectedRoutineName,
    workoutStartTime,
    setWorkoutSeries,
    setWorkoutExerciseNotes,
    setCurrentWorkoutIndex,
    resetWorkoutState,
    pendingReopen,
    setPendingReopen,
  } = useWorkout();

  const [loading, setLoading] = React.useState(true);
  const [routines, setRoutines] = React.useState<Routine[]>([]);
  const [workouts, setWorkouts] = React.useState<UserWorkoutWithDetails[]>([]);
  const [diets, setDiets] = React.useState<UserDietWithDetails[]>([]);
  const [habits, setHabits] = React.useState<UserHabitWithDetails[]>([]);
  const [userGoals, setUserGoals] = React.useState<UserGoal[]>([]);
  const [streak, setStreak] = React.useState(0);
  const [recordStreak, setRecordStreak] = React.useState(0);
  const [week, setWeek] = React.useState<{ days: WeekDayState[]; doneCount: number }>({
    days: [],
    doneCount: 0,
  });
  const [routineLastDates, setRoutineLastDates] = React.useState<Record<string, string>>({});
  const [userBadges, setUserBadges] = React.useState<UserBadge[]>([]);
  const [allBadges, setAllBadges] = React.useState<Badge[]>([]);
  // Escolha persistida do usuário (profiles.selected_badge_id) — não muda no check-in
  const [selectedBadgeId, setSelectedBadgeId] = React.useState<string | null>(null);
  const [totalCheckIns, setTotalCheckIns] = React.useState(0);

  // UI state — drawers/overlays identified by stable keys so they stay fresh
  const [selectedCardKey, setSelectedCardKey] = React.useState<string | null>(null);
  const [selectedGoalId, setSelectedGoalId] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  // null = fluxo genérico ("O que criar?"); 1/2/3 = abre direto na lista do tipo
  const [createType, setCreateType] = React.useState<RoutineTypeCode | null>(null);
  // true = abre o wizard direto no fluxo de criação de meta (sem oferecer rotina)
  const [createGoalFlow, setCreateGoalFlow] = React.useState(false);
  // tipo cuja lista de rotinas está aberta (null = fechado)
  const [listType, setListType] = React.useState<RoutineTypeCode | null>(null);
  // rotina sendo editada (adicionar itens) via CreateWizardDrawer em modo "add items"
  const [editRoutineCard, setEditRoutineCard] = React.useState<RoutineCard | null>(null);
  const [badgesOpen, setBadgesOpen] = React.useState(false);
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const [checkInDates, setCheckInDates] = React.useState<string[]>([]);
  const [weightLogs, setWeightLogs] = React.useState<WeightLog[]>([]);
  // Bump força o FoodDiaryDrawer a recarregar quando o diário muda fora dele
  // (auto-log ao marcar/desmarcar um item da rotina de dieta).
  const [foodDiaryVersion, setFoodDiaryVersion] = React.useState(0);
  // Água é registrada em dois lugares (slide do Hub e diário) — cada bump faz o
  // outro reler, para os dois nunca mostrarem valores diferentes.
  const [waterVersion, setWaterVersion] = React.useState(0);
  // Diário alimentar — aberto pelo card de tipo "Dieta" em "Suas rotinas".
  const [foodDiaryOpen, setFoodDiaryOpen] = React.useState(false);
  const [summaryData, setSummaryData] = React.useState<WorkoutSummaryData | null>(null);
  const [unlockedBadges, setUnlockedBadges] = React.useState<Badge[]>([]);
  // Meta recém-concluída (100%) — alimenta o diálogo de celebração e, se o
  // usuário tocar em "Compartilhar conquista", o GoalShareDrawer.
  const [completedGoal, setCompletedGoal] = React.useState<UserGoal | null>(null);
  const [goalToShare, setGoalToShare] = React.useState<UserGoal | null>(null);
  // Diálogos (insígnia/meta) ficam pendentes enquanto o resumo do treino está
  // aberto. São diálogos Radix (z-300/310) que abririam ATRÁS do resumo (z-9500)
  // e, sendo modais, travariam o body com pointer-events:none — deixando o resumo
  // visível porém congelado. Por isso só os exibimos após fechar o resumo.
  const [pendingBadges, setPendingBadges] = React.useState<Badge[]>([]);
  const [pendingGoal, setPendingGoal] = React.useState<UserGoal | null>(null);
  const [sessionCardKey, setSessionCardKey] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    if (!user) return;
    try {
      const [rts, ws, ds, hs, gs, hist, badges, allB, totalCi, wl, displayB] = await Promise.all([
        getUserRoutinesDb(user.id),
        getUserWorkoutsDb(user.id),
        getUserDietsDb(user.id),
        getUserHabitsDb(user.id),
        getUserGoalsDb(),
        getCheckInHistoryDb(user.id, 60),
        getUserBadgesDb(user.id),
        getAllBadgesDb(),
        getTotalCheckInsDb(user.id),
        getWeightLogsDb(90),
        getDisplayBadgeDb(user.id),
      ]);
      setRoutines(rts);
      setWorkouts(ws);
      setDiets(ds);
      setHabits(hs);
      setUserGoals(gs);
      setStreak(computeStreak(hist));
      setRecordStreak(Math.max(computeRecordStreak(hist), computeStreak(hist)));
      setWeek(computeWeekCheckins(hist));
      setCheckInDates(Array.from(new Set(hist.map((h) => h.check_in_date))));
      setUserBadges(badges);
      setAllBadges(allB);
      setSelectedBadgeId(displayB?.id ?? null);
      setTotalCheckIns(totalCi);
      setWeightLogs(wl);
      const lastDates = await getRoutineLastDatesBatchDb(user.id, ws.map((w) => w.id));
      setRoutineLastDates(lastDates);
    } catch {
      toast({ title: t("goals_load_error"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddWeight = React.useCallback(async (weight: number) => {
    try {
      await addWeightLogDb(weight);
      const wl = await getWeightLogsDb(90);
      setWeightLogs(wl);
      // Sucesso é confirmado visualmente pelo próprio card (estado "Peso registrado!").
    } catch {
      toast({ title: t("goals_weight_error"), variant: "destructive" });
    }
  }, [t]);

  const handleDeleteWeight = React.useCallback(async (id: string) => {
    try {
      await deleteWeightLogDb(id);
      setWeightLogs((prev) => prev.filter((l) => l.id !== id));
    } catch {
      toast({ title: t("goals_weight_error"), variant: "destructive" });
    }
  }, [t]);

  /**
   * Transforma as entradas de HOJE do diário alimentar numa rotina de dieta
   * diária (sem scheduled_days = todo dia). Entradas manuais (sem diet_id)
   * viram itens custom no catálogo `diets` antes de entrar na rotina; os
   * valores por porção são recuperados dividindo pelo `quantity` da entrada.
   */
  const handleTransformDiaryToRoutine = React.useCallback(
    async (todayFoodLogs: FoodLog[]): Promise<boolean> => {
      if (!user || todayFoodLogs.length === 0) return false;
      try {
        const routineName = t("nutrition_routine_name");
        const dietIds: string[] = [];
        const seen = new Set<string>();
        for (const log of todayFoodLogs) {
          let dietId = log.diet_id;
          if (!dietId) {
            const qty = log.quantity > 0 ? log.quantity : 1;
            const createdDiet = await createCustomDietDb(
              log.name,
              log.name,
              null,
              log.calories != null ? log.calories / qty : null,
              log.protein_g != null ? log.protein_g / qty : null,
              log.carbs_g != null ? log.carbs_g / qty : null,
              log.fat_g != null ? log.fat_g / qty : null,
            );
            dietId = createdDiet.id;
          }
          if (seen.has(dietId)) continue;
          seen.add(dietId);
          dietIds.push(dietId);
        }
        if (dietIds.length === 0) return false;
        const inserted = await createUserDietsDb(user.id, dietIds, { name: routineName });
        await backfillRoutineIdOnItemsDb(user.id, 2, routineName, inserted.map((i) => i.id)).catch(() => {});
        toast({ title: t("nutrition_routine_created"), description: t("nutrition_routine_created_desc") });
        await loadData();
        return true;
      } catch {
        toast({ title: t("nutrition_error"), variant: "destructive" });
        return false;
      }
    },
    [user, t, loadData],
  );

  // ── Modo offline ──
  // Banner quando sem internet/Supabase inalcançável; ao sincronizar a fila
  // offline (evento global do outbox), recarrega para refletir o estado real.
  const [isOffline, setIsOffline] = React.useState(() => {
    const s = getNetworkStatus();
    return !s.isOnline || !s.isSupabaseReachable;
  });
  React.useEffect(
    () =>
      addNetworkStatusListener((s) =>
        setIsOffline(!s.isOnline || !s.isSupabaseReachable),
      ),
    [],
  );
  React.useEffect(() => {
    const onSynced = () => loadData();
    window.addEventListener(OUTBOX_SYNCED_EVENT, onSynced);
    return () => window.removeEventListener(OUTBOX_SYNCED_EVENT, onSynced);
  }, [loadData]);

  // Reabrir o modal de treino quando a barra global disparar pendingReopen
  React.useEffect(() => {
    if (pendingReopen) {
      setPendingReopen(false);
      setWorkoutModalOpen(true);
    }
  }, [pendingReopen, setPendingReopen, setWorkoutModalOpen]);

  // Chegando de outra tela (ex.: Novo Post) pedindo para já abrir o wizard de criação de meta
  React.useEffect(() => {
    if (searchParams.get("action") === "create-goal") {
      setCreateGoalFlow(true);
      setCreateType(null);
      setCreateOpen(true);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("action");
          return next;
        },
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams]);

  // Cards derivados
  const cards = React.useMemo(
    () => buildRoutineCards(routines, workouts, diets, habits),
    [routines, workouts, diets, habits],
  );
  const workoutCards = React.useMemo(() => cards.filter((c) => c.type === 1), [cards]);

  // Tocou numa notificação de rotina (ex.: dieta às 12h) → abrir o drawer de
  // detalhe já aberto, pronto para marcar como concluída. Espera `cards`
  // carregar antes de resolver a key, já que o param chega antes do loadData.
  React.useEffect(() => {
    const openRoutine = searchParams.get("openRoutine");
    if (!openRoutine || loading) return;
    const match = cards.find((c) => c.key === openRoutine);
    if (match) setSelectedCardKey(match.key);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("openRoutine");
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams, cards, loading]);

  const selectedCard = cards.find((c) => c.key === selectedCardKey) ?? null;
  const selectedGoal = userGoals.find((g) => g.id === selectedGoalId) ?? null;
  // Alvo do CreateWizardDrawer em modo "adicionar itens" — memoizado pelo card
  // para não resetar a seleção do usuário a cada re-render enquanto o drawer está aberto.
  const editRoutineTarget = React.useMemo(
    () =>
      editRoutineCard
        ? {
            type: editRoutineCard.type,
            name: editRoutineCard.name,
            routineId: editRoutineCard.routineId,
            existingItemIds: editRoutineCard.items.map((i) =>
              i.kind === "workout" ? i.workout_id : i.kind === "diet" ? i.diet_id : i.habit_id,
            ),
            scheduledTime: editRoutineCard.scheduledTime,
            scheduledDays: editRoutineCard.scheduledDays,
          }
        : null,
    [editRoutineCard],
  );
  const activeWorkoutCard =
    cards.find((c) => c.key === sessionCardKey) ??
    workoutCards.find((c) => (c.name ?? "__unnamed__") === selectedRoutineName) ??
    null;

  const activeWorkoutName =
    workoutModalOpen || workoutMinimized ? selectedRoutineName : null;

  // ── Progresso dos 3 cards "Suas rotinas" ──
  // Modelo único: rotinas concluídas ÷ total de rotinas do tipo.
  // Treino "concluída" = feita nesta semana; dieta/hábito = itens feitos hoje.
  const dietCards = cards.filter((c) => c.type === 2);
  const habitCards = cards.filter((c) => c.type === 3);

  const typeProgress = (typeCards: RoutineCard[]) => {
    const total = typeCards.length;
    const done = typeCards.filter((c) => isRoutineCompleted(c, routineLastDates)).length;
    return { total, done, perc: total > 0 ? (done / total) * 100 : 0 };
  };
  const wkP = typeProgress(workoutCards);
  const dietP = typeProgress(dietCards);
  const habitP = typeProgress(habitCards);

  const routineTypeItems: RoutineTypeProgress[] = [
    {
      type: 1,
      title: t("goals_rt_exercises"),
      subtitle: wkP.total === 0
        ? t("goals_rt_tap_create")
        : t("goals_rt_workouts_week").replace("{done}", String(wkP.done)).replace("{total}", String(wkP.total)),
      perc: wkP.perc,
      focus: true,
      hasRoutine: wkP.total > 0,
    },
    {
      type: 2,
      title: t("goals_rt_diets"),
      // Sem rotina de dieta o card abre o Diário Alimentar — o convite é
      // registrar o que comeu, não criar rotina.
      subtitle: dietP.total === 0
        ? t("goals_rt_diet_tap_log")
        : t("goals_rt_routines_done").replace("{done}", String(dietP.done)).replace("{total}", String(dietP.total)),
      perc: dietP.perc,
      hasRoutine: dietP.total > 0,
    },
    {
      type: 3,
      title: t("goals_rt_habits"),
      subtitle: habitP.total === 0
        ? t("goals_rt_tap_create")
        : t("goals_rt_routines_done").replace("{done}", String(habitP.done)).replace("{total}", String(habitP.total)),
      perc: habitP.perc,
      hasRoutine: habitP.total > 0,
    },
  ];

  // ── Handlers ──

  const handleStartWorkout = React.useCallback(
    async (card: RoutineCard) => {
      if (!user) return;
      setSessionCardKey(card.key);
      setSelectedCardKey(null);
      setSelectedRoutineName(card.name ?? "__unnamed__");
      if (workoutStartTime === null) {
        const items = card.items as UserWorkoutWithDetails[];
        const notes: Record<string, string> = {};
        items.forEach((w) => {
          if (w.notes) notes[w.workout_id] = w.notes;
        });
        setWorkoutExerciseNotes(notes);
        setCurrentWorkoutIndex(0);
        try {
          const last = await getLastWorkoutSessionSeriesDb(
            user.id,
            items.map((w) => w.workout_id),
          );
          const series: Record<string, Array<{ series: number; kg: number; reps: number; completed: boolean; prevKg?: number; prevReps?: number }>> = {};
          for (const [wid, entries] of Object.entries(last)) {
            if (entries.length > 0) {
              series[wid] = entries.map((e, i) => ({
                series: i + 1,
                kg: e.kg,
                reps: e.reps,
                completed: false,
                // Coluna "ANTERIOR" — referência da última execução deste exercício
                prevKg: e.kg,
                prevReps: e.reps,
              }));
            }
          }
          // Sem histórico → usa o plano sugerido pelo app (séries + reps recomendadas)
          // para a rotina: program_meta da rotina (programas do quiz) ou catálogo
          // estático casado pelo nome. Assim o usuário já vê a quantidade certa
          // de séries e só precisa informar a carga (kg).
          const suggested = getSuggestedSetsForCard(card);
          if (suggested.size > 0) {
            for (const item of items) {
              if (series[item.workout_id]) continue; // histórico tem prioridade
              const plan = suggested.get((item.workoutName ?? "").trim().toLowerCase());
              if (!plan) continue;
              const setCount = Math.min(Math.max(plan.series, 1), 12);
              const reps = parseSuggestedReps(plan.reps);
              series[item.workout_id] = Array.from({ length: setCount }, (_, i) => ({
                series: i + 1,
                kg: 0,
                reps,
                completed: false,
              }));
            }
          }
          if (Object.keys(series).length > 0) setWorkoutSeries(series);
        } catch {
          /* começa com séries vazias */
        }
      }
      setWorkoutModalOpen(true);
    },
    [user, workoutStartTime, setSelectedRoutineName, setWorkoutExerciseNotes, setCurrentWorkoutIndex, setWorkoutSeries, setWorkoutModalOpen],
  );

  const handleWorkoutFinished = async (summary: WorkoutSessionSummary) => {
    const card = activeWorkoutCard;
    // Mostra o resumo IMEDIATAMENTE com os dados síncronos que já temos, sem
    // esperar nenhuma chamada de rede — assim não há piscar da tela de baixo
    // (feed/metas) entre fechar o modal e abrir o resumo.
    setWorkoutModalOpen(false);
    resetWorkoutState();
    setSessionCardKey(null);
    showRoutineCompleteToast({ type: 1, name: card?.name ?? null });
    // Meta vinculada à rotina → o resumo leva o user_goals.id para que, ao
    // compartilhar no feed, o post apareça com a barra de progresso da meta.
    const linkedUserGoal = card?.goalId
      ? userGoals.find((g) => g.goal_id === card.goalId)
      : undefined;
    setSummaryData({
      routineName: card?.name ?? t("goals_rt_exercises"),
      totalSeries: summary.totalSeries,
      totalVolume: summary.totalVolume,
      durationSecs: summary.durationSecs,
      badges: [],
      userId: user?.id ?? "",
      userGoalId: linkedUserGoal?.id ?? null,
      completedExercises: summary.completedExercises,
      prExercises: summary.prExercises,
      machinedExercises: summary.machinedExercises,
      userGroups: [],
      // Corrida GPS da sessão (se houve) — vira o slide de mapa compartilhável
      // no resumo. Não entra no snapshot persistido (updateRoutineLastSummaryDb):
      // o path pode ter milhares de pontos e o resumo salvo não renderiza mapa.
      run: summary.run,
    });

    // Snapshot persistido na rotina — sobrescreve o resumo anterior (sempre o
    // mais recente) para alimentar o ícone de "resumo do treino" no detalhe da
    // rotina. Disparado sem bloquear a UI; badges chegam depois (ver abaixo).
    const persistSummary = (badges: string[]) => {
      if (!card?.routineId) return;
      updateRoutineLastSummaryDb(card.routineId, {
        routineName: card.name ?? t("goals_rt_exercises"),
        totalSeries: summary.totalSeries,
        totalVolume: summary.totalVolume,
        durationSecs: summary.durationSecs,
        badges,
        completedExercises: summary.completedExercises,
        prExercises: summary.prExercises,
        machinedExercises: summary.machinedExercises,
        completedAt: new Date().toISOString(),
      }).catch(() => { /* resumo persistido é best-effort */ });
    };
    persistSummary([]);

    if (!user) return;

    // Enriquecimento em segundo plano: check-in, badges e duelos. Quando
    // chegarem, atualizamos o resumo já aberto (badges + botão de duelo).
    try {
      await createCheckInDb(user.id);
      const awarded = await awardBadgesForCheckInsDb(user.id, new Date());
      if (awarded.length > 0) {
        setSummaryData((prev) =>
          prev ? { ...prev, badges: awarded.map((b) => b.name) } : prev,
        );
        persistSummary(awarded.map((b) => b.name));
        // Adiado: as insígnias são Radix Dialog e ficariam atrás do resumo; só
        // exibimos quando o resumo for fechado (ver onClose do overlay).
        setPendingBadges(awarded);
      }
    } catch {
      /* segue mesmo se badges falharem */
    }

    // Duelos em que o usuário participa — habilitam o botão "Compartilhar no Duelo".
    try {
      const { myGroups } = await getEnrichedDuelGroupsDb(user.id);
      const userGroups = myGroups.map((g) => ({ id: g.id, name: g.name }));
      if (userGroups.length > 0) {
        setSummaryData((prev) => (prev ? { ...prev, userGroups } : prev));
      }
    } catch {
      /* sem duelos — botão simplesmente não aparece */
    }

    if (card?.goalId) {
      const ug = userGoals.find((g) => g.goal_id === card.goalId);
      if (ug) {
        try {
          const updated = await incrementGoalProgressDb(ug.id);
          // Adiado: só mostra o diálogo de meta após o resumo fechar.
          // `ug` (de userGoals) já tem a descrição vinda do join — usada como
          // rede de segurança caso o retorno do update venha sem ela.
          if (updated && updated.perc >= 100) {
            setPendingGoal({ ...updated, description: updated.description || ug.description });
          }
        } catch {
          /* ignore */
        }
      }
    }
    loadData();
  };

  // Reabre o resumo do último treino finalizado desta rotina (ícone no
  // detalhe da rotina) — mesmo overlay do fluxo de "Finalizar", só que sem
  // disparar check-in/badges/progresso de meta de novo (já aconteceram na
  // época). userGroups é resolvido de novo para refletir os duelos atuais.
  const handleViewRoutineSummary = (card: RoutineCard) => {
    if (!card.lastSummary) return;
    // Resolve a meta vinculada AGORA (o snapshot persistido não guarda o vínculo,
    // que pode ter mudado) para que reabrir e compartilhar leve o progresso da meta.
    const linkedUserGoal = card.goalId
      ? userGoals.find((g) => g.goal_id === card.goalId)
      : undefined;
    setSummaryData({
      ...card.lastSummary,
      userId: user?.id ?? "",
      userGoalId: linkedUserGoal?.id ?? null,
      userGroups: [],
    });
    if (!user) return;
    getEnrichedDuelGroupsDb(user.id)
      .then(({ myGroups }) => {
        const userGroups = myGroups.map((g) => ({ id: g.id, name: g.name }));
        if (userGroups.length > 0) {
          setSummaryData((prev) => (prev ? { ...prev, userGroups } : prev));
        }
      })
      .catch(() => { /* sem duelos — botão simplesmente não aparece */ });
  };

  /**
   * Marca/desmarca um item de dieta ou hábito.
   *
   * O check é aplicado na hora, no estado local — antes era um `await` de rede
   * seguido de `loadData()` (dez queries + re-render da tela inteira) só para
   * pintar um checkbox, o que colocava latência de rede na ação mais repetida da
   * tela. A recarga completa agora só acontece quando ela de fato traz algo novo:
   * ao fechar a rotina do dia (check-in, insígnias e progresso de meta).
   */
  const handleToggleItem = async (card: RoutineCard, item: RoutineItem, completed: boolean) => {
    if (!user) return;

    const completedAt = completed ? new Date().toISOString() : null;
    const patch = <T extends { id: string }>(list: T[]) =>
      list.map((i) => (i.id === item.id ? { ...i, is_completed: completed, completed_at: completedAt } : i));

    if (item.kind === "diet") setDiets((prev) => patch(prev) as UserDietWithDetails[]);
    else if (item.kind === "habit") setHabits((prev) => patch(prev) as UserHabitWithDetails[]);

    try {
      if (item.kind === "diet") {
        await toggleUserDietCompletionDb(item.id, completed);
        if (completed) await saveDietHistoryDb(user.id, item.id, Number(item.diet_id));
        // Diário alimentar: concluir o item lança a comida no diário de hoje
        // (refeição inferida do horário da rotina); desmarcar remove só a
        // entrada automática (vinculada por user_diet_id). Falha aqui não
        // reverte o check — o diário é um complemento, não parte do toggle.
        try {
          const foodDate = localDateISO();
          if (completed) {
            await addFoodLogDb({
              log_date: foodDate,
              meal_type: inferMealType(item.scheduled_time),
              name: item.dietName || "",
              quantity: 1,
              calories: item.dietCalories ?? null,
              protein_g: item.dietProtein ?? null,
              carbs_g: item.dietCarbs ?? null,
              fat_g: item.dietFat ?? null,
              diet_id: item.diet_id || null,
              user_diet_id: item.id,
            });
          } else {
            await deleteFoodLogForDietItemDb(item.id, foodDate);
          }
          setFoodDiaryVersion((v) => v + 1);
        } catch {
          /* diário indisponível (ex.: migração não rodada) — check continua válido */
        }
      } else if (item.kind === "habit") {
        await toggleUserHabitCompletionDb(item.id, completed);
        if (completed) await saveHabitHistoryDb(user.id, item.id, Number(item.habit_id));
      }
    } catch {
      // Reverte o check otimista — o item volta ao estado anterior.
      const revert = <T extends { id: string }>(list: T[]) =>
        list.map((i) =>
          i.id === item.id
            ? { ...i, is_completed: !completed, completed_at: !completed ? new Date().toISOString() : null }
            : i,
        );
      if (item.kind === "diet") setDiets((prev) => revert(prev) as UserDietWithDetails[]);
      else if (item.kind === "habit") setHabits((prev) => revert(prev) as UserHabitWithDetails[]);
      toast({ title: t("goals_load_error"), variant: "destructive" });
      return;
    }

    // Concluir todos os itens da rotina hoje → check-in + progresso de meta
    if (!completed) return;
    const others = card.items.filter((i) => i.id !== item.id);
    const allDone = others.every((i) => isCompletedToday(i as never));
    if (!allDone) return;

    try {
      showRoutineCompleteToast({ type: card.type, name: card.name });
      await createCheckInDb(user.id);
      const awarded = await awardBadgesForCheckInsDb(user.id, new Date());
      if (awarded.length > 0) setUnlockedBadges(awarded);
      if (card.goalId) {
        const ug = userGoals.find((g) => g.goal_id === card.goalId);
        if (ug) {
          const updated = await incrementGoalProgressDb(ug.id);
          if (updated && updated.perc >= 100) {
            setCompletedGoal({ ...updated, description: updated.description || ug.description });
          }
        }
      }
      // Só aqui vale pagar a recarga: streak, semana, insígnias e metas mudaram.
      await loadData();
    } catch {
      toast({ title: t("goals_load_error"), variant: "destructive" });
    }
  };

  const handleDeleteItem = async (card: RoutineCard, item: RoutineItem) => {
    await deleteRoutineItemDb(card.type, item.id);
    await loadData();
  };

  const handleRename = async (card: RoutineCard, newName: string) => {
    if (!user) return;
    await updateRoutineNameDb(user.id, card.name, card.type, newName);
    setSelectedCardKey(`${card.type}::${newName}`);
    await loadData();
  };

  const handleSetTime = async (card: RoutineCard, time: string | null) => {
    if (!user) return;
    await updateRoutineItemsScheduledTimeDb(user.id, card.type, card.name, time);
    window.dispatchEvent(new CustomEvent("ritmofit-routines-changed"));
    await loadData();
  };

  const handleSetDays = async (card: RoutineCard, days: string | null) => {
    if (!user) return;
    await updateRoutineItemsScheduledDaysDb(user.id, card.type, card.name, days);
    window.dispatchEvent(new CustomEvent("ritmofit-routines-changed"));
    await loadData();
  };

  const handleSetItemTime = async (item: RoutineItem, time: string | null) => {
    if (!user || !selectedCard) return;
    await updateRoutineItemScheduledTimeDb(user.id, selectedCard.type, item.id, time);
    window.dispatchEvent(new CustomEvent("ritmofit-routines-changed"));
    await loadData();
  };

  // Hora de fim do hábito (só user_habits tem a coluna — ver migração 20260716).
  const handleSetItemEndTime = async (item: RoutineItem, endTime: string | null) => {
    if (!user || selectedCard?.type !== 3) return;
    await updateHabitScheduledEndTimeDb(user.id, item.id, endTime);
    window.dispatchEvent(new CustomEvent("ritmofit-routines-changed"));
    await loadData();
  };

  const handleLinkGoal = async (card: RoutineCard, goal: UserGoal | null) => {
    if (!card.routineId) return;
    await updateRoutineGoalDb(card.routineId, goal ? goal.goal_id : null);
    await loadData();
  };

  // Vincula/desvincula uma rotina à meta a partir do drawer de detalhe da meta.
  const handleToggleRoutineLink = async (routineId: string, goalId: string | null) => {
    await updateRoutineGoalDb(routineId, goalId);
    await loadData();
  };

  const handleDeleteCard = async (card: RoutineCard) => {
    if (!user) return;
    await deleteRoutineCardDb(user.id, card.type, card.name);
    setSelectedCardKey(null);
    await loadData();
  };

  const handleEditGoal = async (goal: UserGoal, updates: { duration: number; quantity: number }) => {
    await updateUserGoalDb(goal.id, updates);
    await loadData();
  };

  const handleDeleteGoal = async (goal: UserGoal) => {
    await deleteUserGoalDb(goal.id);
    setSelectedGoalId(null);
    await loadData();
  };

  // Toque num card de tipo:
  // - Dieta → SEMPRE o Diário Alimentar (a rotina de dieta fica acessível por
  //   dentro dele: botão "Minha rotina" ou "Transformar diário em rotina")
  // - Já existe rotina(s) deste tipo → lista das rotinas (+ botão criar)
  // - Caso contrário → wizard de criação (sugestão/zero p/ treino; montagem p/ hábito)
  const openTypeRoutine = (type: RoutineTypeCode) => {
    if (type === 2) {
      setFoodDiaryOpen(true);
      return;
    }
    const hasRoutines = cards.some((c) => c.type === type);
    if (hasRoutines) {
      setListType(type);
      return;
    }
    setCreateGoalFlow(false);
    setCreateType(type);
    setCreateOpen(true);
  };

  // Abre o wizard direto no fluxo de criação de meta
  const openCreateGoal = () => {
    setCreateGoalFlow(true);
    setCreateType(null);
    setCreateOpen(true);
  };

  if (loading) {
    return (
      <div className="px-4">
        <GoalsSkeleton />
      </div>
    );
  }

  return (
    <div className="relative min-h-[60vh]">
      {/* auras de fundo — gradientes pintados direto (sem filter: blur), que o
          WebKit não precisa re-compor a cada frame de scroll */}
      <div
        aria-hidden
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{
          background:
            "radial-gradient(320px 320px at 8% 12%, rgba(255,122,60,.28), transparent 70%)," +
            "radial-gradient(300px 300px at 96% 48%, rgba(63,127,230,.28), transparent 70%)",
        }}
      />

      <div className="relative px-4 pb-4 space-y-5">
        {isOffline && (
          <div
            className="flex items-center gap-3"
            style={{
              borderRadius: "18px",
              padding: "12px 16px",
              background: "linear-gradient(rgba(255,138,42,.14),rgba(255,138,42,.06))",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid rgba(255,138,42,.28)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.12)",
            }}
          >
            <WifiOff className="h-4 w-4 shrink-0" style={{ color: "#ff8a2a" }} />
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">
                {t("goals_offline_banner")}
              </p>
              <p className="text-xs text-muted-foreground leading-snug">
                {t("goals_offline_banner_desc")}
              </p>
            </div>
          </div>
        )}

        <StreakBadgesCard
          streakCount={streak}
          weekDone={week.doneCount}
          recordStreak={recordStreak}
          earnedCount={userBadges.length}
          lockedCount={Math.max(0, allBadges.length - userBadges.length)}
          onOpenCalendar={() => setCalendarOpen(true)}
          onOpenBadges={() => setBadgesOpen(true)}
        />

        <TodayDashboard
          cards={cards}
          userGoals={userGoals}
          routineLastDates={routineLastDates}
          activeWorkoutName={activeWorkoutName}
          onStartWorkout={handleStartWorkout}
          onOpenCard={(card) => setSelectedCardKey(card.key)}
          waterRefreshToken={waterVersion}
          // Registrou água no Hub → o diário relê ao abrir.
          onWaterLogged={() => setFoodDiaryVersion((v) => v + 1)}
          // Aqui não há drawer por cima, então a insígnia pode celebrar na hora.
          onBadgesUnlocked={setUnlockedBadges}
        />

        <RoutineTypeCards
          items={routineTypeItems}
          onOpen={openTypeRoutine}
        />

        <WeightTrackerCard
          logs={weightLogs}
          onAddWeight={handleAddWeight}
          onDeleteWeight={handleDeleteWeight}
        />

        <LifeGoalsSection
          userGoals={userGoals}
          routines={routines}
          onDeleteGoal={handleDeleteGoal}
          onCreateGoal={openCreateGoal}
          onOpenGoal={(goal) => setSelectedGoalId(goal.id)}
        />
      </div>

      {/* ── Overlays e drawers ── */}
      <FoodDiaryDrawer
        open={foodDiaryOpen}
        onOpenChange={(o) => {
          setFoodDiaryOpen(o);
          if (!o) {
            // O diário pode ter mexido na água — o slide do Hub precisa reler.
            setWaterVersion((v) => v + 1);
            // Insígnia conquistada dentro do diário só é celebrada ao fechá-lo —
            // o BadgeUnlockedDialog (Radix) abriria atrás do drawer.
            if (pendingBadges.length > 0) {
              setUnlockedBadges(pendingBadges);
              setPendingBadges([]);
              loadData();
            }
          }
        }}
        refreshToken={foodDiaryVersion}
        hasDietRoutines={dietCards.length > 0}
        onOpenRoutines={() => {
          setFoodDiaryOpen(false);
          setListType(2);
        }}
        onTransform={handleTransformDiaryToRoutine}
        onBadgesUnlocked={setPendingBadges}
      />
      {user && (
        <CreateWizardDrawer
          open={createOpen || editRoutineCard !== null}
          onOpenChange={(o) => {
            if (!o) {
              setCreateOpen(false);
              setEditRoutineCard(null);
              // Fecha = fim do fluxo de meta. Sem isso o flag vaza para a
              // próxima abertura e o wizard cai em "goal-origin" mesmo quando
              // pedimos criação/edição de ROTINA (só openCreateGoal o liga).
              setCreateGoalFlow(false);
            }
          }}
          userId={user.id}
          userGoals={userGoals}
          activeRoutineCount={routines.length}
          initialStep={
            createGoalFlow
              ? "goal-origin"
              : createType === 1
                ? "routine-origin"
                : createType
                  ? "build-name"
                  : "what"
          }
          initialRoutineType={createType ?? 1}
          editRoutine={editRoutineTarget}
          onCreated={() => {
            setCreateOpen(false);
            setEditRoutineCard(null);
            setCreateGoalFlow(false);
            loadData();
          }}
        />
      )}

      <RoutineListDrawer
        type={listType ?? 1}
        open={listType !== null}
        onClose={() => setListType(null)}
        cards={cards}
        userGoals={userGoals}
        routineLastDates={routineLastDates}
        activeWorkoutName={activeWorkoutName}
        onStartWorkout={(card) => { setListType(null); handleStartWorkout(card); }}
        onOpenCard={(card) => { setListType(null); setSelectedCardKey(card.key); }}
        onCreate={() => { const tp = listType ?? 1; setListType(null); setCreateGoalFlow(false); setCreateType(tp); setCreateOpen(true); }}
      />

      <RoutineDetailDrawer
        card={selectedCard}
        userGoals={userGoals}
        onClose={() => setSelectedCardKey(null)}
        onStartWorkout={handleStartWorkout}
        onViewSummary={handleViewRoutineSummary}
        onAddItems={(card) => { setCreateGoalFlow(false); setEditRoutineCard(card); }}
        onToggleItem={handleToggleItem}
        onDeleteItem={handleDeleteItem}
        onRename={handleRename}
        onSetTime={handleSetTime}
        onSetDays={handleSetDays}
        onSetItemTime={handleSetItemTime}
        onSetItemEndTime={handleSetItemEndTime}
        onLinkGoal={handleLinkGoal}
        onDeleteCard={handleDeleteCard}
      />

      <GoalDetailDrawer
        goal={selectedGoal}
        routines={routines}
        onClose={() => setSelectedGoalId(null)}
        onEditGoal={handleEditGoal}
        onDeleteGoal={handleDeleteGoal}
        onToggleRoutineLink={handleToggleRoutineLink}
      />

      <InsigniasDrawer
        open={badgesOpen}
        onOpenChange={setBadgesOpen}
        userBadges={userBadges}
        allBadges={allBadges}
        totalCheckIns={totalCheckIns}
        profileUserId={user?.id}
        selectedBadgeId={selectedBadgeId}
        onSelected={loadData}
      />

      <CheckInCalendarModal
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        checkInDates={checkInDates}
        streakCount={streak}
      />

      {user && activeWorkoutCard && (
        <WorkoutSessionDialog
          open={workoutModalOpen}
          userId={user.id}
          routineLabel={activeWorkoutCard.name ?? t("goals_rt_exercises")}
          items={activeWorkoutCard.items as UserWorkoutWithDetails[]}
          routineId={activeWorkoutCard.routineId}
          routineName={activeWorkoutCard.name}
          onMinimize={() => {
            setWorkoutModalOpen(false);
            setWorkoutMinimized(true);
          }}
          onFinished={handleWorkoutFinished}
        />
      )}

      {summaryData && (
        <WorkoutSummaryOverlay
          data={summaryData}
          onSharedToFeed={() => {
            // Publicou no feed → fecha o resumo e leva direto ao feed para ver o post.
            // O flag refreshFeed faz o Index recarregar ao montar, ignorando o cache,
            // para que a publicação recém-criada já apareça no topo.
            setSummaryData(null);
            setPendingBadges([]);
            setPendingGoal(null);
            navigate("/", { state: { refreshFeed: true } });
          }}
          onClose={() => {
            setSummaryData(null);
            // Agora que o resumo saiu, exibe os diálogos que estavam pendentes.
            if (pendingBadges.length > 0) {
              setUnlockedBadges(pendingBadges);
              setPendingBadges([]);
            }
            if (pendingGoal) {
              setCompletedGoal(pendingGoal);
              setPendingGoal(null);
            }
          }}
        />
      )}

      {unlockedBadges.length > 0 && (
        <BadgeUnlockedDialog badges={unlockedBadges} onClose={() => setUnlockedBadges([])} />
      )}

      {completedGoal && (
        <GoalCompletedDialog
          goalDescription={completedGoal.description}
          onShare={() => {
            // Fecha a celebração ANTES de abrir o drawer: o diálogo Radix e o
            // drawer dividem z-300/310, e o body fica com pointer-events:none
            // enquanto o diálogo estiver montado.
            setGoalToShare(completedGoal);
            setCompletedGoal(null);
          }}
          onClose={() => setCompletedGoal(null)}
        />
      )}

      <GoalShareDrawer goal={goalToShare} onClose={() => setGoalToShare(null)} />
    </div>
  );
}
