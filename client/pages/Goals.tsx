import * as React from "react";
import { useAppRefresh } from "@/lib/app-refresh";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/lib/language-context";
import { useWorkout } from "@/lib/workout-context";
import { toast } from "@/components/ui/use-toast";
import { reportHandledError } from "@/lib/monitoring";
import { showRoutineCompleteToast } from "@/lib/routine-complete-toast";
import {
  getUserRoutinesDb,
  getUserWorkoutsDb,
  getUserDietsDb,
  getUserHabitsDb,
  getUserGoalsDb,
  getCheckInHistoryDb,
  getRoutineLastDatesBatchDb,
  getRoutineExecutionsDb,
  getLastWorkoutSessionSeriesDb,
  getWorkoutChallengeDb,
  getPendingWorkoutChallengesDb,
  respondWorkoutChallengeDb,
  submitWorkoutChallengeResultDb,
  type WorkoutChallenge,
  type WorkoutPartySnapshot,
  getUserBadgesDb,
  getAllBadgesDb,
  getBadgeDisplayDb,
  getWeightLogsDb,
  addWeightLogDb,
  deleteWeightLogDb,
  addFoodLogDb,
  deleteFoodLogForDietItemDb,
  createCustomDietDb,
  createUserDietsDb,
  backfillRoutineIdOnItemsDb,
  createCheckInDb,
  awardMyBadgesDb,
  incrementGoalProgressDb,
  unlinkCompletedGoalRoutinesDb,
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
  updateRoutineTechniquesDb,
  updateRoutineTrainingModeDb,
  updateRoutineTrainingModeByNameDb,
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
  type TechniqueAssignment,
  type TrainingMode,
  type WeightLog,
  type FoodLog,
  createWorkoutPartyDb,
  respondWorkoutPartyInviteDb,
  getWorkoutPartyMembersDb,
  type WorkoutPartyInvite,
  toWorkoutRunStats,
} from "@/lib/ritmofit-db";
import {
  buildRoutineCards,
  computeSequentialCycle,
  isRoutineDoneForRing,
  type RoutineExecution,
  computeStreak,
  computeWeekCheckins,
  getSuggestedSetsForCard,
  isCompletedToday,
  isRoutineCompleted,
  type RoutineCard,
  type RoutineItem,
  type WeekDayState,
} from "@/components/goals/goals-helpers";
import { SEQUENTIAL_OPEN_PARAM } from "@/hooks/use-routine-notifications";
import { GoalsSkeleton } from "@/components/shared/animated-loading";
import { ChallengeInviteDialog, ChallengeResultDialog } from "@/components/goals/workout-challenge";
import { buildChallengeResult, type WorkoutChallengeSnapshot } from "@/lib/workout-challenge";
import { QuickWorkoutButton } from "@/components/goals/quick-workout-button";
import { ScreenAura } from "@/components/shared/screen-aura";
import { addNetworkStatusListener, getNetworkStatus } from "@/lib/network-status";
import { OUTBOX_SYNCED_EVENT } from "@/lib/offline-outbox";
import { WifiOff } from "lucide-react";
import { StreakBadgesCard } from "@/components/goals/streak-badges-card";
import { TodayDashboard } from "@/components/goals/today-dashboard";
import { RoutineTypeCards, type RoutineTypeProgress } from "@/components/goals/routine-type-cards";
import { WeightTrackerCard } from "@/components/goals/weight-tracker-card";
import { MuscleCoverageCard } from "@/components/goals/muscle-coverage-card";
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
import { WorkoutPartyDrawer } from "@/components/goals/workout-party-drawer";
import {
  buildPartySnapshot,
  partySnapshotToSessionItems,
  partySnapshotToSeries,
} from "@/components/goals/workout-party-helpers";
import { BadgeUnlockedDialog } from "@/components/goals/badge-unlocked-dialog";
import { GoalCompletedDialog } from "@/components/shared/goal-completed-dialog";
import { InsigniasDrawer } from "@/components/profile/insignias-drawer";
import { badgeName, visibleBadges } from "@/lib/badges";
import { CheckInCalendarModal } from "@/components/goals/check-in-calendar-modal";
import { FEATURES } from "@/lib/feature-flags";

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

/**
 * `date_completed` vem de `user_workouts_hist`, coluna `timestamp` SEM fuso —
 * o Supabase devolve sem sufixo `Z`, mas os dígitos são UTC (gravados via
 * `toISOString()`; mesma pegadinha de `formatTimeAgo` em `client/lib/utils.ts`).
 * Sem apendar o `Z`, `new Date(...)` trata a string como hora LOCAL — os
 * mesmos dígitos, sem converter nada. Ver o mesmo helper em `goals-helpers.ts`
 * e `today-dashboard.tsx`.
 */
function localDateFromUtcNaive(raw: string): string {
  const iso = raw.endsWith("Z") || raw.includes("+") ? raw : `${raw}Z`;
  return localDateStr(new Date(iso));
}

/** última execução do card de treino = data mais recente entre seus itens */
function cardLastDate(card: RoutineCard, lastDates: Record<string, string>): string | null {
  const dates = card.items
    .map((i) => lastDates[i.id])
    .filter(Boolean)
    .map((d) => localDateFromUtcNaive(d))
    .sort();
  return dates.pop() ?? null;
}

// ─── Página Metas (glass "Hub do Hoje") ─────────────────────────────────────

/** O desafio no formato do snapshot do treinar junto — reaproveita os helpers de sessão. Reps 0: o desafiado nunca recebe os números. */
function challengeToPartySnapshot(snapshot: WorkoutChallengeSnapshot): WorkoutPartySnapshot {
  return {
    routineName: snapshot.routineName,
    trainingMode: "simple",
    items: snapshot.items.map((i) => ({
      workoutId: i.workoutId,
      name: i.name,
      muscleGroup: i.muscleGroup,
      photo: i.photo,
      series: i.series,
      reps: 0,
      restSecs: null,
    })),
  };
}

export default function Goals() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
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
    workoutPartyId,
    setWorkoutPartyId,
    workoutPartyRole,
    setWorkoutPartyRole,
    workoutPartySnapshot,
    setWorkoutPartySnapshot,
    workoutPartyHostName,
    setWorkoutPartyHostName,
    workoutQuickSession,
    setWorkoutQuickSession,
    workoutChallenge,
    setWorkoutChallenge,
    pendingPartyJoin,
    setPendingPartyJoin,
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
  // As datas chegam DEPOIS do primeiro render (busca separada). Mapa vazio é
  // ambíguo — "ainda carregando" ou "nunca treinou" —, então quem depende de
  // saber a diferença (o rodízio sequencial) olha esta flag.
  const [lastDatesLoaded, setLastDatesLoaded] = React.useState(false);
  // Histórico de execuções das rotinas de treino — o ciclo do rodízio
  // sequencial depende da ORDEM em que foram feitas (ver computeSequentialCycle).
  const [routineExecutions, setRoutineExecutions] = React.useState<RoutineExecution[]>([]);
  const [userBadges, setUserBadges] = React.useState<UserBadge[]>([]);
  const [allBadges, setAllBadges] = React.useState<Badge[]>([]);
  // Escolha persistida do usuário (profiles.selected_badge_id) — não muda no check-in
  const [selectedBadgeId, setSelectedBadgeId] = React.useState<string | null>(null);

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
  // "Ver" do toast de insígnia nova (BadgeCheckHost, em qualquer tela) chega
  // aqui com `state.openBadges` — abre o drawer e limpa o state, para o voltar
  // não reabrir.
  React.useEffect(() => {
    const st = location.state as { openBadges?: boolean } | null;
    if (!FEATURES.badges || !st?.openBadges) return;
    setBadgesOpen(true);
    navigate(location.pathname + location.search, { replace: true, state: null });
  }, [location.state, location.pathname, location.search, navigate]);
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const [checkInDates, setCheckInDates] = React.useState<string[]>([]);
  const [weightLogs, setWeightLogs] = React.useState<WeightLog[]>([]);
  // Histórico de peso: o drawer vive no WeightTrackerCard, mas quem abre é o
  // ícone ⚖️ do card de streak (acesso permanente, discreto) — por isso o
  // estado sobe para cá.
  const [weightHistoryOpen, setWeightHistoryOpen] = React.useState(false);
  // Bump força o FoodDiaryDrawer a recarregar quando o diário muda fora dele
  // (auto-log ao marcar/desmarcar um item da rotina de dieta).
  const [foodDiaryVersion, setFoodDiaryVersion] = React.useState(0);
  // Bump ao finalizar um treino: a cobertura muscular tem TTL de 15min, então
  // sem isto o card ficaria mostrando a semana anterior logo após o treino.
  const [muscleCoverageVersion, setMuscleCoverageVersion] = React.useState(0);
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
  // Rotina cujo botão "treinar junto" foi tocado — abre o seletor de quem
  // convidar ANTES de começar. `null` = seletor fechado (o caso normal: quem
  // toca em "Iniciar" nunca passa por aqui).
  const [partyInviteCard, setPartyInviteCard] = React.useState<RoutineCard | null>(null);
  // Compartilhar o resumo no feed navega para "/" imediatamente — mas isso
  // desmonta a página ANTES de badge/meta pendentes conseguirem aparecer. Só
  // navega depois que os diálogos de celebração (se houver) forem fechados.
  // Guarda o `state` da navegação adiada (refresh do feed ou abrir o criador
  // de flow com a mídia do resumo); `null` = nada pendente.
  const [navigateToFeedAfterCelebration, setNavigateToFeedAfterCelebration] =
    React.useState<Record<string, unknown> | null>(null);

  // ─── Recarga em FATIAS ────────────────────────────────────────────────────
  //
  // Antes existia só o `loadData()`: doze queries e a tela inteira reconstruída.
  // Ele era chamado em 21 lugares — renomear uma rotina, mudar um horário,
  // vincular uma meta, tudo disparava a carga completa, e o usuário esperava
  // por ela antes de ver o resultado da própria ação.
  //
  // Cada fatia abaixo recarrega só o que a ação mexeu. As demais continuam em
  // tela, com o dado que já estava correto — e o cache de `ritmofit-db` nem
  // chega a ser consultado para elas.

  /** Rotinas e seus itens (treinos, dietas, hábitos). */
  const reloadRoutines = React.useCallback(async () => {
    if (!user) return;
    const [rts, ws, ds, hs] = await Promise.all([
      getUserRoutinesDb(user.id),
      getUserWorkoutsDb(user.id),
      // Itens de dieta e hábito não têm onde aparecer no v1 — `cards` já os
      // filtra. Buscá-los seria pagar duas queries por carga da tela mais
      // pesada do app para alimentar uma lista que ninguém vê.
      FEATURES.dietAndHabitRoutines ? getUserDietsDb(user.id) : Promise.resolve([]),
      FEATURES.dietAndHabitRoutines ? getUserHabitsDb(user.id) : Promise.resolve([]),
    ]);
    setRoutines(rts);
    setWorkouts(ws);
    setDiets(ds);
    setHabits(hs);

    // Depende dos ids que acabaram de chegar, então é sequencial de verdade —
    // mas não bloqueia: a tela já pode desenhar as rotinas sem as datas.
    // As execuções vêm junto: o lembrete do rodízio (`openRoutine=seq`) espera
    // `lastDatesLoaded`, e a rotina devida agora sai do ciclo.
    Promise.all([
      getRoutineLastDatesBatchDb(user.id, ws.map((w) => w.id))
        .then(setRoutineLastDates)
        .catch(() => { /* datas ausentes só escondem o "último treino" */ }),
      getRoutineExecutionsDb(
        user.id,
        rts.filter((r) => Number(r.type) === 1).map((r) => String(r.id)),
        ws.map((w) => w.id),
      )
        .then(setRoutineExecutions)
        .catch(() => { /* sem histórico: o rodízio começa da primeira */ }),
    ]).finally(() => setLastDatesLoaded(true));
  }, [user]);

  /** Metas do usuário. */
  const reloadGoals = React.useCallback(async () => {
    setUserGoals(await getUserGoalsDb());
  }, []);

  /** Check-ins, sequência e insígnias — muda quando um treino é concluído. */
  const reloadProgress = React.useCallback(async () => {
    if (!user) return;
    const [hist, badges, allB, displayB] = await Promise.all([
      getCheckInHistoryDb(user.id, 60),
      // Streak e check-ins continuam (são o coração da tela); só o acervo de
      // insígnias sai, com FEATURES.badges desligada.
      FEATURES.badges ? getUserBadgesDb(user.id) : Promise.resolve([]),
      FEATURES.badges ? getAllBadgesDb() : Promise.resolve([]),
      // A ESCOLHIDA, mesmo escondida (show_badge): é o que o drawer marca.
      FEATURES.badges ? getBadgeDisplayDb(user.id).then((d) => d.badge) : Promise.resolve(null),
    ]);
    setStreak(computeStreak(hist));
    setRecordStreak(Math.max(computeRecordStreak(hist), computeStreak(hist)));
    setWeek(computeWeekCheckins(hist));
    setCheckInDates(Array.from(new Set(hist.map((h) => h.check_in_date))));
    setUserBadges(badges);
    setAllBadges(allB);
    setSelectedBadgeId(displayB?.id ?? null);
  }, [user]);

  /**
   * Carga completa. Fica reservada para o que realmente precisa de tudo: a
   * primeira montagem da tela e o retorno do modo offline (quando a fila de
   * escritas foi drenada e qualquer parte do estado pode ter mudado).
   */
  const loadData = React.useCallback(async () => {
    if (!user) return;
    // Metas que bateram 100% ONTEM ou antes soltam as rotinas vinculadas — dá
    // ao usuário o dia da conquista inteiro pra compartilhar antes de "soltar"
    // a rotina no dia seguinte (ver `unlinkCompletedGoalRoutinesDb`). Roda
    // ANTES de reloadRoutines()/reloadGoals() para os cards já nascerem sem o
    // vínculo velho; falhar aqui não pode travar o resto do carregamento.
    await unlinkCompletedGoalRoutinesDb(user.id).catch(() => {});
    try {
      await Promise.all([
        reloadRoutines(),
        reloadGoals(),
        reloadProgress(),
        FEATURES.weightTracking ? getWeightLogsDb(90).then(setWeightLogs) : Promise.resolve(),
      ]);
    } catch {
      toast({ title: t("goals_load_error"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, t, reloadRoutines, reloadGoals, reloadProgress]);

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
        await reloadRoutines();
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
  // Volta ao app depois de 5+ min fora: carga completa, a mesma do retorno do
  // modo offline (metas/rotinas/progresso podem ter mudado em outro aparelho).
  useAppRefresh(({ reason }) => {
    if (reason === "resume") loadData();
  });

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

  // Compartilhar o resumo no feed adiou a navegação para deixar a celebração de
  // badge/meta aparecer primeiro (ver `navigateToFeedAfterCelebration`); navega
  // assim que os dois diálogos estiverem fechados.
  React.useEffect(() => {
    if (
      navigateToFeedAfterCelebration &&
      unlockedBadges.length === 0 &&
      !completedGoal &&
      !goalToShare // "Compartilhar conquista" abre este drawer a partir do diálogo de meta
    ) {
      const state = navigateToFeedAfterCelebration;
      setNavigateToFeedAfterCelebration(null);
      navigate("/", { state });
    }
  }, [navigateToFeedAfterCelebration, unlockedBadges, completedGoal, goalToShare, navigate]);

  // Chegando de outra tela pedindo para já abrir o wizard: de meta (ex.: Novo
  // Post) ou de rotina de treino (ex.: "Vincular rotinas" do drawer de meta do feed)
  React.useEffect(() => {
    const action = searchParams.get("action");
    if (action === "create-goal" || action === "create-routine") {
      setCreateGoalFlow(action === "create-goal");
      setCreateType(action === "create-goal" ? null : 1);
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

  // ── Desafio de treino (2026-10-02) ───────────────────────────────────────
  // Convite (desafiado) e resultado (quem desafiou) abrem por aqui: o push/
  // notificação navega para /metas?challenge=<id> ou ?challengeResult=<id>.
  const [inviteChallenge, setInviteChallenge] = React.useState<WorkoutChallenge | null>(null);
  const [resultChallenge, setResultChallenge] = React.useState<WorkoutChallenge | null>(null);
  const [pendingChallenges, setPendingChallenges] = React.useState<WorkoutChallenge[]>([]);

  const reloadPendingChallenges = React.useCallback(() => {
    if (!FEATURES.workoutChallenge || !user) return;
    getPendingWorkoutChallengesDb()
      .then(setPendingChallenges)
      .catch(() => { /* faixa informativa */ });
  }, [user]);
  React.useEffect(() => { reloadPendingChallenges(); }, [reloadPendingChallenges]);

  React.useEffect(() => {
    if (!FEATURES.workoutChallenge || !user) return;
    const inviteId = searchParams.get("challenge");
    const resultId = searchParams.get("challengeResult");
    if (!inviteId && !resultId) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("challenge");
        next.delete("challengeResult");
        return next;
      },
      { replace: true },
    );
    void getWorkoutChallengeDb((inviteId ?? resultId)!).then((challenge) => {
      if (!challenge) {
        toast({ title: t("goals_challenge_unavailable"), variant: "destructive" });
        return;
      }
      if (resultId || challenge.status === "completed") {
        // Quem desafiou vê o placar; o desafiado que reabre um desafio já
        // concluído também cai no resultado (do ponto de vista de quem desafiou
        // não faz sentido para ele — então só abre se for o desafiante).
        if (challenge.challengerId === user.id) setResultChallenge(challenge);
        else toast({ title: t("goals_challenge_already_done") });
        return;
      }
      if (challenge.challengedId !== user.id) return;
      if (challenge.status === "declined" || Date.parse(challenge.expiresAt) < Date.now()) {
        toast({ title: t("goals_challenge_unavailable"), variant: "destructive" });
        return;
      }
      setInviteChallenge(challenge);
    });
  }, [searchParams, setSearchParams, user, t]);

  // Cards derivados
  // `cards` alimenta o Hoje, as listas por tipo, os detalhes e o progresso —
  // filtrar aqui, na fonte, é o que impede uma rotina de dieta/hábito criada
  // antes do recorte (ou por uma build antiga do TestFlight) de reaparecer em
  // qualquer uma dessas superfícies. Nada é apagado no banco.
  const cards = React.useMemo(
    () => {
      const all = buildRoutineCards(routines, workouts, diets, habits);
      return FEATURES.dietAndHabitRoutines ? all : all.filter((c) => c.type === 1);
    },
    [routines, workouts, diets, habits],
  );
  const workoutCards = React.useMemo(() => cards.filter((c) => c.type === 1), [cards]);

  // Rodízio SEQUENCIAL: quais rotinas já foram feitas no ciclo (anel 100%) e qual
  // é a próxima em 0% — a do "Treino de hoje".
  const seqCycle = React.useMemo(
    () => computeSequentialCycle(workoutCards, routineExecutions),
    [workoutCards, routineExecutions],
  );

  // Tocou numa notificação de rotina (ex.: dieta às 12h) → abrir o drawer de
  // detalhe já aberto, pronto para marcar como concluída. Espera `cards`
  // carregar antes de resolver a key, já que o param chega antes do loadData.
  React.useEffect(() => {
    const openRoutine = searchParams.get("openRoutine");
    if (!openRoutine || loading) return;
    // `seq` = lembrete do rodízio sequencial: a notificação não sabe qual
    // rotina está devida (o rodízio anda por conclusão, depois do agendamento),
    // então quem resolve é a tela, no momento do toque. Espera as datas de
    // conclusão chegarem — sem elas o rodízio cairia sempre na primeira rotina.
    if (openRoutine === SEQUENTIAL_OPEN_PARAM) {
      if (!lastDatesLoaded) return;
      if (seqCycle) setSelectedCardKey(seqCycle.due.key);
    } else {
      const match = cards.find((c) => c.key === openRoutine);
      if (match) setSelectedCardKey(match.key);
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("openRoutine");
        return next;
      },
      { replace: true },
    );
  }, [
    searchParams,
    setSearchParams,
    cards,
    seqCycle,
    lastDatesLoaded,
    loading,
  ]);

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
  /**
   * Sessão de CONVIDADO ("treinar junto"): um card montado na hora a partir do
   * snapshot do convite. Não existe em `cards` porque não existe rotina — o
   * convidado só decide se quer salvá-la no fim do treino.
   *
   * Derivado do contexto (que é persistido) em vez de estado próprio: assim
   * minimizar o treino, navegar para outra aba ou recarregar o app reconstrói o
   * card sozinho, sem nenhum passo extra.
   */
  const partyGuestCard = React.useMemo<RoutineCard | null>(() => {
    if (workoutPartyRole !== "guest" || !workoutPartySnapshot || !user) return null;
    return {
      key: `party::${workoutPartyId ?? "guest"}`,
      type: 1,
      name: workoutPartySnapshot.routineName || null,
      routineId: null,
      goalId: null,
      items: partySnapshotToSessionItems(workoutPartySnapshot, user.id),
      scheduledTime: null,
      scheduledDays: null,
      lastSummary: null,
      programMeta: null,
      trainingMode: workoutPartySnapshot.trainingMode ?? "simple",
    };
  }, [workoutPartyRole, workoutPartySnapshot, workoutPartyId, user]);

  /**
   * Sessão de TREINO RÁPIDO: card sintético e VAZIO — os exercícios que a
   * pessoa adiciona vivem em `workoutExtraItems` (contexto, persistido), como
   * os avulsos de qualquer sessão. Mesmo motivo do card do convidado para ser
   * derivado do contexto: minimizar/recarregar reconstrói o treino sozinho.
   */
  const quickWorkoutCard = React.useMemo<RoutineCard | null>(() => {
    if (!workoutQuickSession || !user) return null;
    return {
      key: "quick-workout",
      type: 1,
      name: t("goals_quick_workout_title"),
      routineId: null,
      goalId: null,
      items: [],
      scheduledTime: null,
      scheduledDays: null,
      lastSummary: null,
      programMeta: null,
      trainingMode: "simple",
    };
  }, [workoutQuickSession, user, t]);

  /**
   * Sessão de DESAFIO: card sintético com os exercícios do desafio (ids
   * `session_…`, sem rotina), derivado do contexto persistido — mesmo esquema
   * do convidado do treinar junto.
   */
  const challengeCard = React.useMemo<RoutineCard | null>(() => {
    if (!workoutChallenge || !user) return null;
    return {
      key: `challenge::${workoutChallenge.id}`,
      type: 1,
      name: workoutChallenge.snapshot.routineName || null,
      routineId: null,
      goalId: null,
      items: partySnapshotToSessionItems(challengeToPartySnapshot(workoutChallenge.snapshot), user.id),
      scheduledTime: null,
      scheduledDays: null,
      lastSummary: null,
      programMeta: null,
      trainingMode: "simple",
    };
  }, [workoutChallenge, user]);

  // O card do convidado tem PRIORIDADE: o casamento por nome logo abaixo poderia
  // encontrar uma rotina própria homônima ("Peito e Tríceps" é um nome comum) e
  // trocar o treino do amigo pela rotina dele no meio da sessão. O treino rápido
  // idem (uma rotina chamada "Treino rápido" não pode sequestrar a sessão).
  const activeWorkoutCard =
    partyGuestCard ??
    quickWorkoutCard ??
    challengeCard ??
    cards.find((c) => c.key === sessionCardKey) ??
    workoutCards.find((c) => (c.name ?? "__unnamed__") === selectedRoutineName) ??
    null;

  const activeWorkoutName =
    workoutModalOpen || workoutMinimized ? selectedRoutineName : null;

  // Insígnias no card de streak: as 2 conquistadas mais recentes (o acervo vem
  // por `earned_at` desc) e quantas do catálogo visível faltam.
  const visibleBadgeIds = new Set(visibleBadges(allBadges).map((b) => String(b.id)));
  const earnedVisible = userBadges.filter((ub) => visibleBadgeIds.has(String(ub.badge_id)));
  const earnedBadgeEmojis = earnedVisible.slice(0, 2).map((ub) => ub.badge.emoji);
  const lockedBadgeCount = Math.max(0, visibleBadgeIds.size - earnedVisible.length);

  // ── Progresso dos 3 cards "Suas rotinas" ──
  // Modelo único: rotinas concluídas ÷ total de rotinas do tipo.
  // Treino "concluída" = feita nesta semana; dieta/hábito = itens feitos hoje.
  const dietCards = cards.filter((c) => c.type === 2);
  const habitCards = cards.filter((c) => c.type === 3);

  const typeProgress = (typeCards: RoutineCard[]) => {
    const total = typeCards.length;
    const done = typeCards.filter((c) => isRoutineDoneForRing(c, routineLastDates, seqCycle)).length;
    return { total, done, perc: total > 0 ? (done / total) * 100 : 0 };
  };
  const wkP = typeProgress(workoutCards);
  const dietP = typeProgress(dietCards);
  const habitP = typeProgress(habitCards);

  const routineTypeItems: RoutineTypeProgress[] = ([
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
    // Dieta (2) e Hábito (3) saem do v1 — ver FEATURES.dietAndHabitRoutines.
    // O filtro fica no fim da lista, e não espalhado em condicionais dentro
    // dela, para que religar seja apagar uma linha só.
  ] as RoutineTypeProgress[]).filter(
    (item) => FEATURES.dietAndHabitRoutines || item.type === 1,
  );

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

  // ── Treinar junto ─────────────────────────────────────────────────────────

  /**
   * Convida (quantas pessoas quiserem) e começa o treino na mesma ação. O
   * convite é fire-and-forget: se a criação da party falhar, o treino começa
   * assim mesmo — não faz sentido bloquear quem já está na academia porque a
   * rede caiu.
   */
  const handleInviteAndStart = React.useCallback(
    async (card: RoutineCard, userIds: string[]) => {
      const snapshot = buildPartySnapshot({
        routineName: card.name ?? t("goals_rt_exercises"),
        trainingMode: card.trainingMode,
        items: card.items as UserWorkoutWithDetails[],
        suggested: getSuggestedSetsForCard(card),
      });
      try {
        const partyId = await createWorkoutPartyDb({
          snapshot,
          routineId: card.routineId,
          inviteeIds: userIds,
        });
        if (partyId) {
          setWorkoutPartyId(partyId);
          setWorkoutPartyRole("host");
          setWorkoutPartySnapshot(null);
          setWorkoutPartyHostName(null);
        }
        toast({
          title: t("goals_party_invites_sent"),
          description: t("goals_party_invites_sent_desc").replace("{n}", String(userIds.length)),
        });
      } catch (err: any) {
        reportHandledError(err, "goals:party-invite-and-start", { count: userIds.length });
        toast({
          title: t("goals_party_invite_error"),
          description: err?.message,
          variant: "destructive",
        });
      }
      setPartyInviteCard(null);
      await handleStartWorkout(card);
    },
    [t, handleStartWorkout, setWorkoutPartyId, setWorkoutPartyRole, setWorkoutPartySnapshot, setWorkoutPartyHostName],
  );

  /**
   * Entra no treino de quem convidou. Monta a sessão a partir do snapshot —
   * **sem criar rotina nenhuma**: a pergunta "salvar essa rotina?" só aparece
   * no resumo, depois de finalizar.
   *
   * O que vem do amigo é o plano (exercícios, nº de séries, reps). A CARGA é
   * pessoal: vem do histórico do próprio convidado, como em qualquer sessão
   * dele — herdar o peso do amigo colocaria alguém embaixo de uma barra que não
   * é sua.
   */
  const startPartyGuestSession = React.useCallback(
    async (invite: WorkoutPartyInvite) => {
      if (!user) return;
      setWorkoutPartyId(invite.partyId);
      setWorkoutPartyRole("guest");
      setWorkoutPartySnapshot(invite.snapshot);
      setWorkoutPartyHostName(invite.hostNickname);
      setSessionCardKey(null);
      setSelectedCardKey(null);
      setSelectedRoutineName(invite.snapshot.routineName || "__unnamed__");
      setCurrentWorkoutIndex(0);
      setWorkoutExerciseNotes({});

      const series = partySnapshotToSeries(invite.snapshot);
      try {
        const last = await getLastWorkoutSessionSeriesDb(
          user.id,
          invite.snapshot.items.map((i) => i.workoutId),
        );
        for (const [workoutId, entries] of Object.entries(last)) {
          const planned = series[workoutId];
          if (!planned || entries.length === 0) continue;
          series[workoutId] = planned.map((s, index) => {
            // Mais séries no plano do amigo do que histórico próprio → repete a
            // última carga conhecida, que é melhor referência do que zero.
            const prev = entries[Math.min(index, entries.length - 1)];
            return prev
              ? { ...s, kg: prev.kg, prevKg: prev.kg, prevReps: prev.reps }
              : s;
          });
        }
      } catch {
        /* sem histórico (ou offline): começa com carga zerada */
      }
      setWorkoutSeries(series);
      setWorkoutModalOpen(true);
    },
    [user, setWorkoutPartyId, setWorkoutPartyRole, setWorkoutPartySnapshot, setWorkoutPartyHostName, setSelectedRoutineName, setCurrentWorkoutIndex, setWorkoutExerciseNotes, setWorkoutSeries, setWorkoutModalOpen],
  );

  // ── Desafio: aceitar e treinar ────────────────────────────────────────────

  /**
   * Aceita o desafio e abre a sessão com os exercícios dele. Séries = as de quem
   * desafiou (só a QUANTIDADE — carga e reps nunca chegam aqui); a carga
   * pré-preenchida é a do HISTÓRICO do próprio desafiado, como no treinar junto.
   */
  const startChallengeSession = React.useCallback(
    async (challenge: WorkoutChallenge) => {
      if (!user) return;
      setInviteChallenge(null);
      if (challenge.status === "pending") {
        respondWorkoutChallengeDb(challenge.id, true).catch((err) =>
          reportHandledError(err, "goals:accept-challenge"),
        );
      }
      const partySnapshot = challengeToPartySnapshot(challenge.snapshot);
      resetWorkoutState();
      setWorkoutChallenge({
        id: challenge.id,
        challengerNickname: challenge.challengerNickname,
        challengerId: challenge.challengerId,
        challengerPhoto: challenge.challengerPhoto,
        snapshot: challenge.snapshot,
      });
      setSessionCardKey(null);
      setSelectedCardKey(null);
      setSelectedRoutineName(challenge.snapshot.routineName || "__unnamed__");
      setCurrentWorkoutIndex(0);
      setWorkoutExerciseNotes({});
      const series = partySnapshotToSeries(partySnapshot);
      try {
        const last = await getLastWorkoutSessionSeriesDb(
          user.id,
          partySnapshot.items.map((i) => i.workoutId),
        );
        for (const [workoutId, entries] of Object.entries(last)) {
          const planned = series[workoutId];
          if (!planned || entries.length === 0) continue;
          series[workoutId] = planned.map((s, index) => {
            const prev = entries[Math.min(index, entries.length - 1)];
            return prev ? { ...s, kg: prev.kg, prevKg: prev.kg, prevReps: prev.reps } : s;
          });
        }
      } catch {
        /* sem histórico: começa zerado */
      }
      setWorkoutSeries(series);
      setWorkoutModalOpen(true);
      setPendingChallenges((prev) => prev.filter((c) => c.id !== challenge.id));
    },
    [user, resetWorkoutState, setWorkoutChallenge, setSelectedRoutineName, setCurrentWorkoutIndex, setWorkoutExerciseNotes, setWorkoutSeries, setWorkoutModalOpen],
  );

  const declineChallenge = React.useCallback(async (challenge: WorkoutChallenge) => {
    setInviteChallenge(null);
    setPendingChallenges((prev) => prev.filter((c) => c.id !== challenge.id));
    try {
      await respondWorkoutChallengeDb(challenge.id, false);
      toast({ title: t("goals_challenge_declined_toast") });
    } catch (err) {
      reportHandledError(err, "goals:decline-challenge");
      toast({ title: t("goals_challenge_respond_error"), variant: "destructive" });
      reloadPendingChallenges();
    }
  }, [t, reloadPendingChallenges]);

  // ── Treino rápido ─────────────────────────────────────────────────────────

  /**
   * Abre a sessão VAZIA, sem rotina (o picker de exercícios abre sozinho lá
   * dentro). Ao finalizar, o resumo oferece transformar o treino em rotina.
   */
  const handleStartQuickWorkout = React.useCallback(() => {
    if (!user) return;
    // O botão some com treino em andamento; se ainda assim chegar aqui, só reabre.
    if (workoutStartTime !== null) {
      setWorkoutMinimized(false);
      setWorkoutModalOpen(true);
      return;
    }
    resetWorkoutState();
    setWorkoutQuickSession(true);
    setSessionCardKey(null);
    setSelectedCardKey(null);
    setSelectedRoutineName(t("goals_quick_workout_title"));
    setCurrentWorkoutIndex(0);
    setWorkoutExerciseNotes({});
    setWorkoutSeries({});
    setWorkoutModalOpen(true);
  }, [user, workoutStartTime, t, resetWorkoutState, setWorkoutQuickSession, setSelectedRoutineName, setCurrentWorkoutIndex, setWorkoutExerciseNotes, setWorkoutSeries, setWorkoutModalOpen, setWorkoutMinimized]);

  // Convite aceito em outra tela (o diálogo vive no AppLayout, para chegar em
  // qualquer lugar do app) — a sessão só pode nascer aqui, que é quem sabe
  // iniciar um treino. Mesmo padrão de `pendingReopen`.
  React.useEffect(() => {
    if (!pendingPartyJoin || !user) return;
    const invite = pendingPartyJoin;
    setPendingPartyJoin(null);
    void startPartyGuestSession(invite);
  }, [pendingPartyJoin, user, startPartyGuestSession, setPendingPartyJoin]);

  const handleWorkoutFinished = async (summary: WorkoutSessionSummary) => {
    const card = activeWorkoutCard;
    // Treinar junto: copiado ANTES do `resetWorkoutState()` abaixo, que limpa o
    // estado da party. É o que alimenta a pergunta "salvar essa rotina?" no
    // resumo — a única cópia do treino que o convidado tem.
    const partyId = workoutPartyId;
    const partyRole = workoutPartyRole;
    const partySnapshot = workoutPartySnapshot;
    const partyHostName = workoutPartyHostName;
    // Treino rápido: idem — a oferta de virar rotina depende desta cópia.
    const wasQuickWorkout = workoutQuickSession;
    // Desafio: idem — o placar sai daqui depois do reset.
    const finishedChallenge = workoutChallenge;
    // Mostra o resumo IMEDIATAMENTE com os dados síncronos que já temos, sem
    // esperar nenhuma chamada de rede — assim não há piscar da tela de baixo
    // (feed/metas) entre fechar o modal e abrir o resumo.
    setWorkoutModalOpen(false);
    resetWorkoutState();
    setSessionCardKey(null);
    setMuscleCoverageVersion((v) => v + 1);
    showRoutineCompleteToast({ type: 1, name: card?.name ?? null });
    // Meta vinculada à rotina → o resumo leva o user_goals.id para que, ao
    // compartilhar no feed, o post apareça com a barra de progresso da meta.
    const linkedUserGoal = card?.goalId
      ? userGoals.find((g) => g.goal_id === card.goalId)
      : undefined;
    // Um único instante para o resumo e o last_summary: é a chave com que o
    // mini frame do flow acha a sessão completa depois.
    const completedAt = new Date().toISOString();
    setSummaryData({
      completedAt,
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
      // Gasto calórico informado/estimado na sessão — segue para o card
      // gerado, o post do feed e o check-in de duelo.
      caloriesKcal: summary.caloriesKcal,
      // Só o CONVIDADO recebe a oferta: o host já tem a rotina salva. A lista
      // de quem treinou junto chega logo abaixo, junto do enriquecimento.
      // `summary.partyRoutineSnapshot` é o treino COMO EXECUTADO (com adições e
      // remoções da sessão) — é ele que a oferta grava. O snapshot do convite
      // só entra como rede de segurança.
      partySaveOffer:
        partyRole === "guest" && (summary.partyRoutineSnapshot ?? partySnapshot)
          ? {
              kind: "party",
              hostNickname: partyHostName ?? "",
              snapshot: (summary.partyRoutineSnapshot ?? partySnapshot)!,
            }
          // Treino rápido → "transformar em rotina?" com nome editável. Leva o
          // instante do histórico para a rotina já nascer com o treino de hoje.
          : wasQuickWorkout && summary.partyRoutineSnapshot && summary.partyRoutineSnapshot.items.length > 0
            ? {
                kind: "quick",
                hostNickname: "",
                snapshot: summary.partyRoutineSnapshot,
                historyBaseAt: summary.historyBaseAt ?? null,
              }
            : null,
      userGroups: [],
      // Treinar junto: o resumo lê os participantes ao vivo para o card
      // "Treino em conjunto" e o template de canvas do grupo.
      partyId: FEATURES.workoutParty ? partyId : null,
      // Desafio: o placar chega logo abaixo (precisa gravar meus números para a
      // RLS liberar os de quem desafiou). Treino de desafio não oferece
      // "Desafiar" de novo — o resumo é sobre o resultado.
      challengeResult: finishedChallenge
        ? {
            challengerNickname: finishedChallenge.challengerNickname,
            challengerId: finishedChallenge.challengerId,
            challengerPhoto: finishedChallenge.challengerPhoto ?? null,
            status: "loading",
          }
        : null,
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
        caloriesKcal: summary.caloriesKcal,
        completedAt,
        // Sem a party, reabrir o resumo pelo detalhe da rotina perdia o card
        // "Treino em conjunto". Só grava a chave quando houve party.
        ...(FEATURES.workoutParty && partyId ? { partyId } : {}),
        // Corrida GPS SEM o trajeto: distância + parciais por km para o mini
        // frame de treino do flow (o path segue fora — milhares de pontos).
        ...(summary.run ? { runStats: toWorkoutRunStats(summary.run) } : {}),
      }).catch(() => { /* resumo persistido é best-effort */ });
    };
    persistSummary([]);

    if (!user) return;

    if (finishedChallenge) {
      submitWorkoutChallengeResultDb(finishedChallenge.id, buildChallengeResult(summary.completedExercises))
        .then((res) => {
          setSummaryData((prev) =>
            prev
              ? {
                  ...prev,
                  challengeResult: res
                    ? {
                        challengerNickname: res.challenge.challengerNickname,
                        challengerId: res.challenge.challengerId,
                        challengedNickname: res.challenge.challengedNickname,
                        challengerPhoto: res.challenge.challengerPhoto,
                        challengedPhoto: res.challenge.challengedPhoto,
                        status: "ready",
                        outcome: res.outcome,
                      }
                    : {
                        challengerNickname: finishedChallenge.challengerNickname,
                        challengerId: finishedChallenge.challengerId,
                        challengerPhoto: finishedChallenge.challengerPhoto ?? null,
                        status: "error",
                      },
                }
              : prev,
          );
        })
        .catch((err) => {
          reportHandledError(err, "goals:submit-challenge");
          setSummaryData((prev) =>
            prev
              ? {
                  ...prev,
                  challengeResult: {
                    challengerNickname: finishedChallenge.challengerNickname,
                    challengerId: finishedChallenge.challengerId,
                    challengerPhoto: finishedChallenge.challengerPhoto ?? null,
                    status: "error",
                  },
                }
              : prev,
          );
        });
    }

    // Quem treinou junto — vira a linha "Treino em grupo com …" no topo do
    // resumo. Fora do caminho crítico: o resumo já está na tela, e uma falha
    // aqui só omite a linha.
    if (partyId) {
      getWorkoutPartyMembersDb(partyId, { fresh: true })
        .then((members) => {
          const names = members
            .filter((m) => m.status === "accepted" && m.userId !== user.id)
            .map((m) => m.nickname);
          if (names.length === 0) return;
          setSummaryData((prev) => (prev ? { ...prev, partyMemberNames: names } : prev));
        })
        .catch(() => { /* linha some, o resumo continua íntegro */ });
    }

    // Enriquecimento em segundo plano: check-in, badges e duelos. Quando
    // chegarem, atualizamos o resumo já aberto (badges + botão de duelo).
    try {
      await createCheckInDb(user.id);
      // Com FEATURES.badges desligada nada é premiado. Não é só cosmético: o
      // `pendingBadges` alimentado aqui fazia `hasCelebration` virar true no
      // "compartilhar no feed", e a navegação ficava esperando um diálogo de
      // insígnia que nunca renderiza — o usuário publicava e continuava parado
      // na tela de resumo.
      // Insígnias v2: avaliadas no servidor (o treino recém-gravado já conta).
      const awarded = FEATURES.badges ? (await awardMyBadgesDb()).awarded : [];
      if (awarded.length > 0) {
        const names = awarded.map((b) => badgeName(b, t));
        setSummaryData((prev) => (prev ? { ...prev, badges: names } : prev));
        persistSummary(names);
        // Adiado: as insígnias são Radix Dialog e ficariam atrás do resumo; só
        // exibimos quando o resumo for fechado (ver onClose do overlay).
        setPendingBadges(awarded);
      }
    } catch {
      /* segue mesmo se badges falharem */
    }

    // Duelos em que o usuário participa — habilitam o botão "Compartilhar no Duelo".
    // Com FEATURES.duels desligada o botão não existe: nem buscamos os grupos.
    try {
      const userGroups = FEATURES.duels
        ? (await getEnrichedDuelGroupsDb(user.id)).myGroups.map((g) => ({
            id: g.id,
            name: g.name,
          }))
        : [];
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
    // Fim de treino: progresso (check-in/insígnias), metas e o "último treino"
    // dos cards. O peso corporal não muda por concluir um treino.
    void Promise.all([reloadProgress(), reloadGoals(), reloadRoutines()]);
  };

  // Reabre o resumo do último treino finalizado desta rotina (ícone no
  // detalhe da rotina) — mesmo overlay do fluxo de "Finalizar", só que sem
  // disparar check-in/badges/progresso de meta de novo (já aconteceram na
  // época). userGroups é resolvido de novo para refletir os duelos atuais.
  /**
   * Sai do resumo do treino para o Feed (post publicado ou "Compartilhar no
   * Flow"). O flag refreshFeed faz o Index recarregar ignorando o cache, para
   * o post recém-criado aparecer no topo; createFlowSeed abre o criador de flow.
   *
   * Insígnia/meta pendentes NÃO podem ser só descartadas aqui: elas viviam
   * nesta página, e `navigate` desmonta o componente antes de qualquer diálogo
   * conseguir aparecer — o usuário batia a meta e nunca via a comemoração. Em
   * vez de descartar, promovemos ao mesmo estado que o fechamento normal do
   * resumo usa (`completedGoal`/`unlockedBadges`) e só navegamos depois que o
   * usuário fechar os diálogos (ver o efeito de `navigateToFeedAfterCelebration`).
   */
  const leaveSummaryToFeed = (state: Record<string, unknown>) => {
    setSummaryData(null);
    // Backstop: mesmo que algo volte a preencher `pendingBadges`, sem
    // FEATURES.badges não há diálogo para esperar — a navegação para o
    // feed não pode ficar refém dele.
    const hasCelebration =
      (FEATURES.badges && pendingBadges.length > 0) || !!pendingGoal;
    if (pendingBadges.length > 0) {
      setUnlockedBadges(pendingBadges);
      setPendingBadges([]);
    }
    if (pendingGoal) {
      setCompletedGoal(pendingGoal);
      setPendingGoal(null);
    }
    if (hasCelebration) {
      setNavigateToFeedAfterCelebration(state);
    } else {
      navigate("/", { state });
    }
  };

  const handleViewRoutineSummary = (card: RoutineCard) => {
    if (!card.lastSummary) return;
    // Resolve a meta vinculada AGORA (o snapshot persistido não guarda o vínculo,
    // que pode ter mudado) para que reabrir e compartilhar leve o progresso da meta.
    const linkedUserGoal = card.goalId
      ? userGoals.find((g) => g.goal_id === card.goalId)
      : undefined;
    const partyId = FEATURES.workoutParty ? card.lastSummary.partyId ?? null : null;
    setSummaryData({
      ...card.lastSummary,
      partyId,
      userId: user?.id ?? "",
      userGoalId: linkedUserGoal?.id ?? null,
      userGroups: [],
    });
    // Treino em conjunto: a linha "Treino em grupo com …" (o card/canvas do
    // grupo o overlay já lê sozinho pelo `partyId`). Mesmo filtro do Finalizar.
    if (user && partyId) {
      getWorkoutPartyMembersDb(partyId)
        .then((members) => {
          const names = members
            .filter((m) => m.status === "accepted" && m.userId !== user.id)
            .map((m) => m.nickname);
          if (names.length === 0) return;
          setSummaryData((prev) => (prev && prev.partyId === partyId ? { ...prev, partyMemberNames: names } : prev));
        })
        .catch(() => { /* linha some, o resumo continua íntegro */ });
    }
    if (!user || !FEATURES.duels) return;
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
      if (card.goalId) {
        const ug = userGoals.find((g) => g.goal_id === card.goalId);
        if (ug) {
          const updated = await incrementGoalProgressDb(ug.id);
          if (updated && updated.perc >= 100) {
            setCompletedGoal({ ...updated, description: updated.description || ug.description });
          }
        }
      }
      // Fechar a rotina do dia mexe em progresso (streak, semana, insígnias),
      // nas metas vinculadas e no estado dos itens — mas não no peso nem no
      // catálogo, que continuavam sendo relidos à toa pela carga completa.
      await Promise.all([reloadProgress(), reloadGoals(), reloadRoutines()]);
    } catch {
      toast({ title: t("goals_load_error"), variant: "destructive" });
    }
  };

  const handleDeleteItem = async (card: RoutineCard, item: RoutineItem) => {
    await deleteRoutineItemDb(card.type, item.id);

    // O histórico do item foi apagado junto: a cobertura muscular precisa
    // reler, senão segue mostrando o volume de um exercício que não existe mais.
    setMuscleCoverageVersion((v) => v + 1);
    await reloadRoutines();
  };

  const handleRename = async (card: RoutineCard, newName: string) => {
    if (!user) return;
    await updateRoutineNameDb(user.id, card.name, card.type, newName);
    setSelectedCardKey(`${card.type}::${newName}`);
    await reloadRoutines();
  };

  const handleSetTime = async (card: RoutineCard, time: string | null) => {
    if (!user) return;
    await updateRoutineItemsScheduledTimeDb(user.id, card.type, card.name, time);
    window.dispatchEvent(new CustomEvent("ritmofit-routines-changed"));
    await reloadRoutines();
  };

  const handleSetDays = async (card: RoutineCard, days: string | null) => {
    if (!user) return;
    await updateRoutineItemsScheduledDaysDb(user.id, card.type, card.name, days);
    window.dispatchEvent(new CustomEvent("ritmofit-routines-changed"));
    await reloadRoutines();
  };

  // Troca o modo de treino de uma rotina já criada. Prefere o id (FK sem
  // ambiguidade); cai no casamento por nome quando o card não resolveu a linha
  // em `routines` — mesmo fallback do resto da tela.
  const handleSetTrainingMode = async (card: RoutineCard, mode: TrainingMode) => {
    if (!user || card.type !== 1) return;
    if (card.routineId) {
      await updateRoutineTrainingModeDb(card.routineId, mode);
    } else {
      await updateRoutineTrainingModeByNameDb(user.id, card.type, card.name, mode);
    }
    await reloadRoutines();
  };

  // Plano de técnicas (bi-set, drop-set…) de uma rotina já criada.
  const handleSaveTechniques = async (
    card: RoutineCard,
    assignments: TechniqueAssignment[],
  ) => {
    if (!user || card.type !== 1) return;
    await updateRoutineTechniquesDb(user.id, assignments);
    await reloadRoutines();
  };

  const handleSetItemTime = async (item: RoutineItem, time: string | null) => {
    if (!user || !selectedCard) return;
    await updateRoutineItemScheduledTimeDb(user.id, selectedCard.type, item.id, time);
    window.dispatchEvent(new CustomEvent("ritmofit-routines-changed"));
    await reloadRoutines();
  };

  // Hora de fim do hábito (só user_habits tem a coluna — ver migração 20260716).
  const handleSetItemEndTime = async (item: RoutineItem, endTime: string | null) => {
    if (!user || selectedCard?.type !== 3) return;
    await updateHabitScheduledEndTimeDb(user.id, item.id, endTime);
    window.dispatchEvent(new CustomEvent("ritmofit-routines-changed"));
    await reloadRoutines();
  };

  // Vincular meta ↔ rotina mexe nos dois lados: a rotina passa a exibir a meta,
  // e a meta passa a listar a rotina. Daí as duas fatias — e nenhuma a mais.
  const handleLinkGoal = async (card: RoutineCard, goal: UserGoal | null) => {
    if (!card.routineId) return;
    await updateRoutineGoalDb(card.routineId, goal ? goal.goal_id : null);
    await Promise.all([reloadRoutines(), reloadGoals()]);
  };

  // Vincula/desvincula uma rotina à meta a partir do drawer de detalhe da meta.
  const handleToggleRoutineLink = async (routineId: string, goalId: string | null) => {
    await updateRoutineGoalDb(routineId, goalId);
    await Promise.all([reloadRoutines(), reloadGoals()]);
  };

  const handleDeleteCard = async (card: RoutineCard) => {
    if (!user) return;
    await deleteRoutineCardDb(user.id, card.type, card.name);
    setSelectedCardKey(null);
    // Idem: apagar a rotina apaga o histórico dela.
    setMuscleCoverageVersion((v) => v + 1);
    await reloadRoutines();
  };

  const handleEditGoal = async (goal: UserGoal, updates: { duration: number; quantity: number }) => {
    await updateUserGoalDb(goal.id, updates);
    await reloadGoals();
  };

  const handleDeleteGoal = async (goal: UserGoal) => {
    await deleteUserGoalDb(goal.id);
    setSelectedGoalId(null);
    await reloadGoals();
  };

  // Toque num card de tipo:
  // - Dieta → SEMPRE o Diário Alimentar (a rotina de dieta fica acessível por
  //   dentro dele: botão "Minha rotina" ou "Transformar diário em rotina")
  // - Já existe rotina(s) deste tipo → lista das rotinas (+ botão criar)
  // - Caso contrário → wizard de criação (sugestão/zero p/ treino; montagem p/ hábito)
  const openTypeRoutine = (type: RoutineTypeCode) => {
    // Backstop: sem os cards de dieta/hábito nada deveria chamar com 2 ou 3,
    // mas o wizard e os deep links compartilham este caminho.
    if (!FEATURES.dietAndHabitRoutines && type !== 1) return;
    if (type === 2) {
      if (!FEATURES.foodDiary) return;
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
      {/* Brilho de fundo — padrão único das telas (ScreenAura). Era `absolute`
          neste container, que começa abaixo do header: sobrava uma faixa preta
          em cima, com o brilho cortado numa linha reta. */}
      <ScreenAura variant="goals" />

      {/* Treino rápido — sempre à mão, com ou sem rotina (pedido de
          02/10/2026: no início aparecia só sem rotina). Nunca por cima de um
          treino em andamento (lá o canto é da barra do treino minimizado) nem
          do resumo. */}
      {FEATURES.quickWorkout &&
        workoutStartTime === null &&
        !workoutModalOpen &&
        !workoutMinimized &&
        !summaryData && (
          <QuickWorkoutButton onStart={handleStartQuickWorkout} />
        )}

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

        {/* Desafios recebidos em aberto — o push pode ter passado batido. */}
        {FEATURES.workoutChallenge && pendingChallenges.length > 0 && workoutStartTime === null && (
          <div className="space-y-2">
            {pendingChallenges.slice(0, 3).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setInviteChallenge(c)}
                className="w-full flex items-center gap-3 rounded-[18px] p-3 text-left active:scale-[0.985] transition-transform"
                style={{
                  background: "linear-gradient(rgba(239,68,68,.16),rgba(249,115,22,.06))",
                  border: "1px solid rgba(239,68,68,.35)",
                }}
              >
                <span className="text-xl">⚔️</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate">
                    {t("goals_challenge_strip_title").replace("{name}", c.challengerNickname)}
                  </p>
                  <p className="text-xs text-white/60 truncate">
                    {c.routineName} · {t("goals_challenge_strip_cta")}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        <StreakBadgesCard
          streakCount={streak}
          weekDone={week.doneCount}
          recordStreak={recordStreak}
          earnedEmojis={earnedBadgeEmojis}
          lockedCount={lockedBadgeCount}
          onOpenCalendar={() => setCalendarOpen(true)}
          onOpenBadges={() => setBadgesOpen(true)}
          onOpenWeight={() => setWeightHistoryOpen(true)}
          onOpenHistory={() => navigate("/metas/historico")}
        />

        <TodayDashboard
          cards={cards}
          userGoals={userGoals}
          routineLastDates={routineLastDates}
          seqCycle={seqCycle}
          activeWorkoutName={activeWorkoutName}
          onStartWorkout={handleStartWorkout}
          onOpenCard={(card) => setSelectedCardKey(card.key)}
          waterRefreshToken={waterVersion}
          // Registrou água no Hub → o diário relê ao abrir.
          onWaterLogged={() => setFoodDiaryVersion((v) => v + 1)}
        />

        <RoutineTypeCards
          items={routineTypeItems}
          onOpen={openTypeRoutine}
        />

        {/* Cobertura muscular da semana — some sozinho quando não há anatomia
            semeada ou nenhum treino no período (ver o componente). */}
        {FEATURES.muscleAnatomy && <MuscleCoverageCard
          refreshToken={muscleCoverageVersion}
          routines={routines}
          userWorkouts={workouts}
          onRoutinesChanged={reloadRoutines}
        />}

        {/* Peso — só o lembrete semanal aparece aqui; fora dessa janela o
            componente não renderiza nada e o acesso permanente é o ícone ⚖️ no
            canto do card de streak (que abre o drawer montado aqui dentro). */}
        {FEATURES.weightTracking && (
        <WeightTrackerCard
          logs={weightLogs}
          onAddWeight={handleAddWeight}
          onDeleteWeight={handleDeleteWeight}
          historyOpen={weightHistoryOpen}
          onHistoryOpenChange={setWeightHistoryOpen}
        />
        )}

        <LifeGoalsSection
          userGoals={userGoals}
          routines={routines}
          onDeleteGoal={handleDeleteGoal}
          onCreateGoal={openCreateGoal}
          onOpenGoal={(goal) => setSelectedGoalId(goal.id)}
        />
      </div>

      {/* ── Overlays e drawers ── */}
      {FEATURES.foodDiary && (
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
              // Só as insígnias/check-ins mudaram dentro do diário.
              void reloadProgress();
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
      />
      )}
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
          initialStep={
            createGoalFlow
              ? "goal-origin"
              : createType === 1
                // Treino entra pela escolha do modo (Simplificado × Expert) —
                // é a primeira decisão da rotina, antes até da origem.
                //
                // Este é o caminho do botão "+" — o mais usado de todos — e é
                // por ele que o Modo Expert continuava aparecendo mesmo depois
                // de o wizard já pular o passo internamente: aqui o wizard é
                // aberto DIRETO nele, sem passar pela bifurcação.
                ? (FEATURES.expertMode ? "routine-mode" : "routine-origin")
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
            // O wizard cria rotina, meta, ou as duas — daí as duas fatias.
            void Promise.all([reloadRoutines(), reloadGoals()]);
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
          seqCycle={seqCycle}
        activeWorkoutName={activeWorkoutName}
        onStartWorkout={(card) => { setListType(null); handleStartWorkout(card); }}
        // `onTrainTogether` é opcional, e routines-tab / routine-list-drawer /
        // routine-detail-drawer só desenham o botão "Treinar junto" quando ela
        // existe — passar undefined apaga o convite nos três de uma vez.
        onTrainTogether={FEATURES.workoutParty ? (card) => { setListType(null); setPartyInviteCard(card); } : undefined}
        onOpenCard={(card) => { setListType(null); setSelectedCardKey(card.key); }}
        onCreate={() => { const tp = listType ?? 1; setListType(null); setCreateGoalFlow(false); setCreateType(tp); setCreateOpen(true); }}
      />

      <RoutineDetailDrawer
        card={selectedCard}
        userGoals={userGoals}
        onClose={() => {
          setSelectedCardKey(null);
          // Insígnia ganha dentro do drawer (hábito marcado, rotina fechada) é
          // celebrada agora que ele saiu da frente — ver `celebrateBadges`.
          if (pendingBadges.length > 0) {
            setUnlockedBadges(pendingBadges);
            setPendingBadges([]);
          }
        }}
        onStartWorkout={handleStartWorkout}
        onTrainTogether={FEATURES.workoutParty ? (card) => setPartyInviteCard(card) : undefined}
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
        onSetTrainingMode={handleSetTrainingMode}
        onSaveTechniques={handleSaveTechniques}
        onDeleteCard={handleDeleteCard}
      />

      <GoalDetailDrawer
        goal={selectedGoal}
        routines={routines}
        onClose={() => setSelectedGoalId(null)}
        onEditGoal={handleEditGoal}
        onDeleteGoal={handleDeleteGoal}
        onToggleRoutineLink={handleToggleRoutineLink}
        onCreateRoutine={() => {
          // Fecha o detalhe e abre o wizard direto na rotina de treino (mesmo
          // caminho do deep link ?action=create-routine).
          setSelectedGoalId(null);
          setCreateGoalFlow(false);
          setCreateType(1);
          setCreateOpen(true);
        }}
      />

      {FEATURES.badges && (
      <InsigniasDrawer
        open={badgesOpen}
        onOpenChange={setBadgesOpen}
        userBadges={userBadges}
        allBadges={allBadges}
        profileUserId={user?.id}
        selectedBadgeId={selectedBadgeId}
        onChanged={reloadProgress}
      />
      )}

      <CheckInCalendarModal
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        checkInDates={checkInDates}
        streakCount={streak}
      />

      {/* Treinar junto — seleção de quem chamar ANTES de começar. Sem limite de
          convidados: o mesmo caminho serve para uma dupla e para um grupo. */}
      {FEATURES.workoutParty && (
      <WorkoutPartyDrawer
        open={partyInviteCard !== null}
        onClose={() => setPartyInviteCard(null)}
        routineName={partyInviteCard?.name ?? ""}
        exerciseCount={partyInviteCard?.items.length ?? 0}
        mode="start"
        onConfirm={(userIds) => {
          const card = partyInviteCard;
          if (!card) return;
          return handleInviteAndStart(card, userIds);
        }}
        onSkip={() => {
          const card = partyInviteCard;
          setPartyInviteCard(null);
          if (card) void handleStartWorkout(card);
        }}
      />
      )}

      {user && activeWorkoutCard && (
        <WorkoutSessionDialog
          open={workoutModalOpen}
          userId={user.id}
          routineLabel={activeWorkoutCard.name ?? t("goals_rt_exercises")}
          items={activeWorkoutCard.items as UserWorkoutWithDetails[]}
          trainingMode={activeWorkoutCard.trainingMode}
          routineId={activeWorkoutCard.routineId}
          routineName={activeWorkoutCard.name}
          onMinimize={() => {
            setWorkoutModalOpen(false);
            setWorkoutMinimized(true);
          }}
          onFinished={handleWorkoutFinished}
        />
      )}

      {inviteChallenge && (
        <ChallengeInviteDialog
          challenge={inviteChallenge}
          busyWithOtherWorkout={workoutStartTime !== null}
          onAccept={() => { void startChallengeSession(inviteChallenge); }}
          onDecline={() => { void declineChallenge(inviteChallenge); }}
          onDismiss={() => setInviteChallenge(null)}
        />
      )}
      {resultChallenge && (
        <ChallengeResultDialog
          challenge={resultChallenge}
          onClose={() => setResultChallenge(null)}
          // Publicou o resultado: vai ao Feed (aba Seguindo, onde o próprio post
          // aparece) recarregando sem cache — mesmo caminho do NewPost.
          onSharedToFeed={() => navigate("/", { state: { refreshFeed: true, showFollowing: true } })}
        />
      )}

      {summaryData && (
        <WorkoutSummaryOverlay
          data={summaryData}
          onPartyRoutineSaved={() => { void reloadRoutines(); }}
          onSharedToFeed={() => leaveSummaryToFeed({ refreshFeed: true })}
          // Não publica o flow aqui: o criador mora no Feed, que abre direto na
          // legenda com a mídia do resumo. Se o post do feed saiu junto ("Feed e
          // Flow"), o refreshFeed faz ele aparecer no topo por baixo do criador.
          onShareToFlow={(seed, opts) =>
            leaveSummaryToFeed(
              opts?.alsoPostedToFeed ? { createFlowSeed: seed, refreshFeed: true } : { createFlowSeed: seed },
            )
          }
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

      {FEATURES.badges && unlockedBadges.length > 0 && (
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
