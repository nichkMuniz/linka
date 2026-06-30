import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/lib/language-context";
import { useWorkout } from "@/lib/workout-context";
import { toast } from "@/components/ui/use-toast";
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
  getTotalCheckInsDb,
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
  updateRoutineGoalDb,
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
} from "@/lib/ritmofit-db";
import {
  buildRoutineCards,
  computeStreak,
  computeWeekCheckins,
  isCompletedToday,
  isRoutineCompleted,
  type RoutineCard,
  type RoutineItem,
  type WeekDayState,
} from "@/components/goals/goals-helpers";
import { GoalsSkeleton } from "@/components/shared/animated-loading";
import { StreakBadgesCard } from "@/components/goals/streak-badges-card";
import { TodayDashboard } from "@/components/goals/today-dashboard";
import { RoutineTypeCards, type RoutineTypeProgress } from "@/components/goals/routine-type-cards";
import { LifeGoalsSection } from "@/components/goals/life-goals-section";
import { CreateWizardDrawer } from "@/components/goals/create-wizard-drawer";
import { RoutineListDrawer } from "@/components/goals/routine-list-drawer";
import { RoutineDetailDrawer } from "@/components/goals/routine-detail-drawer";
import { GoalDetailDrawer } from "@/components/goals/goal-detail-drawer";
import {
  WorkoutSessionDialog,
  type WorkoutSessionSummary,
} from "@/components/goals/workout-session-dialog";
import {
  WorkoutSummaryOverlay,
  type WorkoutSummaryData,
} from "@/components/goals/workout-summary-overlay";
import { getSuggestedSetsForRoutine } from "@/components/goals/suggested-routines-data";
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
  const [badgesOpen, setBadgesOpen] = React.useState(false);
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const [checkInDates, setCheckInDates] = React.useState<string[]>([]);
  const [summaryData, setSummaryData] = React.useState<WorkoutSummaryData | null>(null);
  const [unlockedBadges, setUnlockedBadges] = React.useState<Badge[]>([]);
  const [completedGoalDesc, setCompletedGoalDesc] = React.useState<string | null>(null);
  // Diálogos (insígnia/meta) ficam pendentes enquanto o resumo do treino está
  // aberto. São diálogos Radix (z-300/310) que abririam ATRÁS do resumo (z-9500)
  // e, sendo modais, travariam o body com pointer-events:none — deixando o resumo
  // visível porém congelado. Por isso só os exibimos após fechar o resumo.
  const [pendingBadges, setPendingBadges] = React.useState<Badge[]>([]);
  const [pendingGoalDesc, setPendingGoalDesc] = React.useState<string | null>(null);
  const [sessionCardKey, setSessionCardKey] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    if (!user) return;
    try {
      const [rts, ws, ds, hs, gs, hist, badges, allB, totalCi] = await Promise.all([
        getUserRoutinesDb(user.id),
        getUserWorkoutsDb(user.id),
        getUserDietsDb(user.id),
        getUserHabitsDb(user.id),
        getUserGoalsDb(),
        getCheckInHistoryDb(user.id, 60),
        getUserBadgesDb(user.id),
        getAllBadgesDb(),
        getTotalCheckInsDb(user.id),
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
      setTotalCheckIns(totalCi);
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

  // Reabrir o modal de treino quando a barra global disparar pendingReopen
  React.useEffect(() => {
    if (pendingReopen) {
      setPendingReopen(false);
      setWorkoutModalOpen(true);
    }
  }, [pendingReopen, setPendingReopen, setWorkoutModalOpen]);

  // Cards derivados
  const cards = React.useMemo(
    () => buildRoutineCards(routines, workouts, diets, habits),
    [routines, workouts, diets, habits],
  );
  const workoutCards = React.useMemo(() => cards.filter((c) => c.type === 1), [cards]);

  const selectedCard = cards.find((c) => c.key === selectedCardKey) ?? null;
  const selectedGoal = userGoals.find((g) => g.id === selectedGoalId) ?? null;
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
      subtitle: dietP.total === 0
        ? t("goals_rt_tap_create")
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
          // para a rotina, casando exercício pelo nome. Assim o usuário já vê a
          // quantidade certa de séries e só precisa informar a carga (kg).
          const suggested = getSuggestedSetsForRoutine(card.name ?? "");
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
    setSummaryData({
      routineName: card?.name ?? t("goals_rt_exercises"),
      totalSeries: summary.totalSeries,
      totalVolume: summary.totalVolume,
      durationSecs: summary.durationSecs,
      badges: [],
      userId: user?.id ?? "",
      completedExercises: summary.completedExercises,
      prExercises: summary.prExercises,
      machinedExercises: summary.machinedExercises,
      userGroups: [],
    });

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
          if (updated && updated.perc >= 100) setPendingGoalDesc(updated.description);
        } catch {
          /* ignore */
        }
      }
    }
    loadData();
  };

  const handleToggleItem = async (card: RoutineCard, item: RoutineItem, completed: boolean) => {
    if (!user) return;
    try {
      if (item.kind === "diet") {
        await toggleUserDietCompletionDb(item.id, completed);
        if (completed) await saveDietHistoryDb(user.id, item.id, Number(item.diet_id));
      } else if (item.kind === "habit") {
        await toggleUserHabitCompletionDb(item.id, completed);
        if (completed) await saveHabitHistoryDb(user.id, item.id, Number(item.habit_id));
      }
      // Concluir todos os itens da rotina hoje → check-in + progresso de meta
      if (completed) {
        const others = card.items.filter((i) => i.id !== item.id);
        const allDone = others.every((i) => isCompletedToday(i as never));
        if (allDone) {
          await createCheckInDb(user.id);
          const awarded = await awardBadgesForCheckInsDb(user.id, new Date());
          if (awarded.length > 0) setUnlockedBadges(awarded);
          if (card.goalId) {
            const ug = userGoals.find((g) => g.goal_id === card.goalId);
            if (ug) {
              const updated = await incrementGoalProgressDb(ug.id);
              if (updated && updated.perc >= 100) setCompletedGoalDesc(updated.description);
            }
          }
        }
      }
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
  // - Já existe rotina(s) deste tipo → lista das rotinas (+ botão criar)
  // - Caso contrário → wizard de criação (sugestão/zero p/ treino; montagem p/ dieta/hábito)
  const openTypeRoutine = (type: RoutineTypeCode) => {
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
      {/* auras de fundo — container clipped para evitar scroll horizontal */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute"
          style={{
            width: "320px",
            height: "320px",
            left: "-40px",
            top: "60px",
            borderRadius: "50%",
            background: "radial-gradient(circle,#ff7a3c,transparent 70%)",
            filter: "blur(70px)",
            opacity: 0.32,
          }}
        />
        <div
          className="absolute"
          style={{
            width: "300px",
            height: "300px",
            right: "-70px",
            top: "520px",
            borderRadius: "50%",
            background: "radial-gradient(circle,#3f7fe6,transparent 70%)",
            filter: "blur(70px)",
            opacity: 0.32,
          }}
        />
      </div>

      <div className="relative px-4 pb-4 space-y-5">
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
        />

        <RoutineTypeCards
          items={routineTypeItems}
          onOpen={openTypeRoutine}
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
      {user && (
        <CreateWizardDrawer
          open={createOpen}
          onOpenChange={setCreateOpen}
          userId={user.id}
          userGoals={userGoals}
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
          onCreated={() => {
            setCreateOpen(false);
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
        onCreate={() => { const tp = listType ?? 1; setListType(null); setCreateType(tp); setCreateOpen(true); }}
      />

      <RoutineDetailDrawer
        card={selectedCard}
        userGoals={userGoals}
        onClose={() => setSelectedCardKey(null)}
        onStartWorkout={handleStartWorkout}
        onToggleItem={handleToggleItem}
        onDeleteItem={handleDeleteItem}
        onRename={handleRename}
        onSetTime={handleSetTime}
        onSetDays={handleSetDays}
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
            setPendingGoalDesc(null);
            navigate("/", { state: { refreshFeed: true } });
          }}
          onClose={() => {
            setSummaryData(null);
            // Agora que o resumo saiu, exibe os diálogos que estavam pendentes.
            if (pendingBadges.length > 0) {
              setUnlockedBadges(pendingBadges);
              setPendingBadges([]);
            }
            if (pendingGoalDesc) {
              setCompletedGoalDesc(pendingGoalDesc);
              setPendingGoalDesc(null);
            }
          }}
        />
      )}

      {unlockedBadges.length > 0 && (
        <BadgeUnlockedDialog badges={unlockedBadges} onClose={() => setUnlockedBadges([])} />
      )}

      {completedGoalDesc && (
        <GoalCompletedDialog
          goalDescription={completedGoalDesc}
          onClose={() => setCompletedGoalDesc(null)}
        />
      )}
    </div>
  );
}
