import * as React from "react";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
// `import type` explícito: garante que o bundler ELIMINE a aresta para
// `ritmofit-db`. Este provider é montado no App.tsx, então uma importação de
// valor aqui prenderia o módulo inteiro no chunk de entrada — e daqui só saem
// tipos, que não existem em runtime.
import type {
  SetKind,
  UserWorkoutWithDetails,
  WorkoutPartyInvite,
  WorkoutPartySnapshot,
} from "@/lib/ritmofit-db";

// ID da notificação local de "tempo de descanso terminou". Exportado para que
// o listener genérico de notificações (use-routine-notifications) saiba
// ignorá-la — ela tem tratamento próprio de tap para reabrir o treino.
export const REST_NOTIF_ID = 91823;

export type WorkoutSeriesEntry = {
  series: number;
  kg: number;
  reps: number;
  completed: boolean;
  /**
   * Tipo da série — só o modo **expert** classifica (ver `TrainingMode`).
   * Ausente = série do modo simplificado, tratada como 'normal' em toda parte.
   *
   * Substitui o antigo campo `type?: 'W' | 'N' | 'F'`, que existia no tipo
   * desde a v1 mas nunca chegou a ser escrito nem lido em lugar nenhum — o
   * aquecimento entrava no volume e no PR como qualquer outra série.
   */
  kind?: SetKind;
  prevKg?: number;
  prevReps?: number;
  /**
   * Inclinação da ESTEIRA (%) desta série — terceira coluna da tabela, à direita
   * do KM, e só nos exercícios de esteira (ver `isTreadmillExercise`). É por
   * série porque a inclinação muda no meio do treino (10min a 3%, 10min a 6%),
   * exatamente como MIN e KM.
   *
   * **Opcional de verdade**: ausente ou 0 = "não anotei", que é diferente de
   * "0% de inclinação" — em nenhum dos dois casos o resumo estampa um número.
   * Nunca participa de `canCompleteSeries`: a série fecha sem ela.
   */
  elev?: number;
};

interface WorkoutContextValue {
  // Modal open/minimized
  workoutModalOpen: boolean;
  setWorkoutModalOpen: (v: boolean) => void;
  workoutMinimized: boolean;
  setWorkoutMinimized: (v: boolean) => void;
  // Pending reopen flag (set by FAB, consumed by Goals on mount)
  pendingReopen: boolean;
  setPendingReopen: (v: boolean) => void;
  // Persistent workout state
  workoutSeries: Record<string, WorkoutSeriesEntry[]>;
  setWorkoutSeries: React.Dispatch<React.SetStateAction<Record<string, WorkoutSeriesEntry[]>>>;
  workoutDuration: number;
  setWorkoutDuration: React.Dispatch<React.SetStateAction<number>>;
  workoutStartTime: number | null;
  setWorkoutStartTime: (v: number | null) => void;
  selectedRoutineName: string | null;
  setSelectedRoutineName: (v: string | null) => void;
  workoutExerciseRestTimes: Record<string, number>;
  setWorkoutExerciseRestTimes: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  workoutExerciseNotes: Record<string, string>;
  setWorkoutExerciseNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  currentWorkoutIndex: number;
  setCurrentWorkoutIndex: (v: number) => void;
  // Extra exercises added / removed during the session (persisted so they survive minimize + navigation)
  workoutExtraItems: UserWorkoutWithDetails[];
  setWorkoutExtraItems: React.Dispatch<React.SetStateAction<UserWorkoutWithDetails[]>>;
  workoutRemovedIds: string[];
  setWorkoutRemovedIds: React.Dispatch<React.SetStateAction<string[]>>;
  // Currently expanded exercise card (persisted so it survives minimize + navigation)
  workoutExpandedId: string | null;
  setWorkoutExpandedId: React.Dispatch<React.SetStateAction<string | null>>;
  // Exercícios marcados como "máquina zerada" nesta sessão (workout_id) — o
  // usuário confirma via prompt ao concluir uma série pesada. Persistido para
  // sobreviver a minimizar/reload; alimenta a borda dourada do card e o
  // machinedExercises do resumo. Array (não Set) para serializar no localStorage.
  maxedExerciseIds: string[];
  setMaxedExerciseIds: React.Dispatch<React.SetStateAction<string[]>>;
  // Exercícios (workout_id) onde o usuário dispensou o convite de aquecimento
  // por rampa com um swipe para a esquerda. Escopo = exercício: dispensar no
  // supino não esconde no bíceps. Persistido para o convite não voltar ao
  // minimizar/recarregar — o swipe seria em vão. Array para serializar.
  dismissedWarmupIds: string[];
  setDismissedWarmupIds: React.Dispatch<React.SetStateAction<string[]>>;
  // Ordem escolhida na tela de reordenar (workout_id, na sequência em que os
  // exercícios devem aparecer). Vazio = ordem natural da rotina
  // (`user_workouts.order_index`, com fallback na ordem de chegada). Existe
  // separado do banco porque a sessão precisa refletir o arraste NA HORA: o
  // prop `items` só é recarregado num loadData() da tela de Metas, e o avulso
  // adicionado durante o treino nem tem linha em `user_workouts` ainda.
  workoutOrder: string[];
  setWorkoutOrder: React.Dispatch<React.SetStateAction<string[]>>;
  // Calorias gastas na sessão, em kcal, QUANDO O USUÁRIO CONFIRMOU um valor.
  // `null` = ainda não mexeu, e a tela mostra a estimativa viva (ver
  // `client/lib/calorie-estimate.ts`) — é o que distingue "não informado" de
  // "informou 0". Persistido para sobreviver a minimizar/recarregar: o número
  // costuma ser lido no aparelho no meio do treino.
  workoutCaloriesKcal: number | null;
  setWorkoutCaloriesKcal: React.Dispatch<React.SetStateAction<number | null>>;
  // ── Treinar junto (workout party) ──────────────────────────────────────────
  // Party desta sessão (`workout_parties.id`) e o papel do usuário nela. Null =
  // treino solo, que é o caso da esmagadora maioria das sessões. Persistidos
  // com o resto do estado para sobreviver a minimizar/recarregar: sem isso o
  // header perderia os parceiros e o convidado perderia a chance de salvar a
  // rotina no fim.
  workoutPartyId: string | null;
  setWorkoutPartyId: (v: string | null) => void;
  workoutPartyRole: "host" | "guest" | null;
  setWorkoutPartyRole: (v: "host" | "guest" | null) => void;
  /**
   * Cópia do treino recebida no convite. Só o CONVIDADO carrega — é a única
   * fonte do treino dele (não existe rotina salva) e é o que a pergunta
   * "salvar essa rotina?" grava no fim. `null` no host e no treino solo.
   */
  workoutPartySnapshot: WorkoutPartySnapshot | null;
  setWorkoutPartySnapshot: (v: WorkoutPartySnapshot | null) => void;
  /** Apelido de quem convidou — o "de {host}" da oferta de salvar a rotina. */
  workoutPartyHostName: string | null;
  setWorkoutPartyHostName: (v: string | null) => void;
  /**
   * Convite JÁ ACEITO, esperando a tela de Metas montar para virar sessão. O
   * diálogo de convite vive no AppLayout (chega em qualquer tela), mas quem
   * sabe iniciar um treino é a tela de Metas — mesmo padrão de `pendingReopen`.
   */
  pendingPartyJoin: WorkoutPartyInvite | null;
  setPendingPartyJoin: (v: WorkoutPartyInvite | null) => void;
  // Reset all workout state
  resetWorkoutState: () => void;
  // Rest timer (shared so FAB can display it)
  globalRestTimerRemaining: number;
  setGlobalRestTimerRemaining: React.Dispatch<React.SetStateAction<number>>;
  globalRestTimerActive: boolean;
  setGlobalRestTimerActive: (v: boolean) => void;
  globalRestTimerPaused: boolean;
  setGlobalRestTimerPaused: React.Dispatch<React.SetStateAction<boolean>>;
  globalRestTimerTotal: number;
  setGlobalRestTimerTotal: (v: number) => void;
  globalRestTimerKey: number;
  setGlobalRestTimerKey: React.Dispatch<React.SetStateAction<number>>;
}

const WorkoutContext = React.createContext<WorkoutContextValue>({
  workoutModalOpen: false,
  setWorkoutModalOpen: () => {},
  workoutMinimized: false,
  setWorkoutMinimized: () => {},
  pendingReopen: false,
  setPendingReopen: () => {},
  workoutSeries: {},
  setWorkoutSeries: () => {},
  workoutDuration: 0,
  setWorkoutDuration: () => {},
  workoutStartTime: null,
  setWorkoutStartTime: () => {},
  selectedRoutineName: null,
  setSelectedRoutineName: () => {},
  workoutExerciseRestTimes: {},
  setWorkoutExerciseRestTimes: () => {},
  workoutExerciseNotes: {},
  setWorkoutExerciseNotes: () => {},
  currentWorkoutIndex: 0,
  setCurrentWorkoutIndex: () => {},
  workoutExtraItems: [],
  setWorkoutExtraItems: () => {},
  workoutRemovedIds: [],
  setWorkoutRemovedIds: () => {},
  workoutExpandedId: null,
  setWorkoutExpandedId: () => {},
  maxedExerciseIds: [],
  setMaxedExerciseIds: () => {},
  dismissedWarmupIds: [],
  setDismissedWarmupIds: () => {},
  workoutOrder: [],
  setWorkoutOrder: () => {},
  workoutCaloriesKcal: null,
  setWorkoutCaloriesKcal: () => {},
  workoutPartyId: null,
  setWorkoutPartyId: () => {},
  workoutPartyRole: null,
  setWorkoutPartyRole: () => {},
  workoutPartySnapshot: null,
  setWorkoutPartySnapshot: () => {},
  workoutPartyHostName: null,
  setWorkoutPartyHostName: () => {},
  pendingPartyJoin: null,
  setPendingPartyJoin: () => {},
  resetWorkoutState: () => {},
  globalRestTimerRemaining: 0,
  setGlobalRestTimerRemaining: () => {},
  globalRestTimerActive: false,
  setGlobalRestTimerActive: () => {},
  globalRestTimerPaused: false,
  setGlobalRestTimerPaused: () => {},
  globalRestTimerTotal: 0,
  setGlobalRestTimerTotal: () => {},
  globalRestTimerKey: 0,
  setGlobalRestTimerKey: () => {},
});

const WORKOUT_STORAGE_KEY = "linka_active_workout";

function loadPersistedWorkout() {
  try {
    const raw = localStorage.getItem(WORKOUT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as {
      workoutSeries: Record<string, WorkoutSeriesEntry[]>;
      workoutStartTime: number;
      selectedRoutineName: string | null;
      workoutExerciseRestTimes: Record<string, number>;
      workoutExerciseNotes: Record<string, string>;
      workoutExtraItems?: UserWorkoutWithDetails[];
      workoutRemovedIds?: string[];
      workoutExpandedId?: string | null;
      maxedExerciseIds?: string[];
      dismissedWarmupIds?: string[];
      workoutOrder?: string[];
      workoutCaloriesKcal?: number | null;
      workoutPartyId?: string | null;
      workoutPartyRole?: "host" | "guest" | null;
      workoutPartySnapshot?: WorkoutPartySnapshot | null;
      workoutPartyHostName?: string | null;
    };
  } catch {
    return null;
  }
}

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const persisted = React.useMemo(() => loadPersistedWorkout(), []);

  const [workoutModalOpen, setWorkoutModalOpen] = React.useState(false);
  const [workoutMinimized, setWorkoutMinimized] = React.useState(() => persisted !== null);
  const [pendingReopen, setPendingReopen] = React.useState(false);
  const [workoutSeries, setWorkoutSeries] = React.useState<Record<string, WorkoutSeriesEntry[]>>(
    () => persisted?.workoutSeries ?? {}
  );
  const [workoutDuration, setWorkoutDuration] = React.useState(() => {
    if (!persisted) return 0;
    return Math.floor((Date.now() - persisted.workoutStartTime) / 1000);
  });
  const [workoutStartTime, setWorkoutStartTime] = React.useState<number | null>(
    () => persisted?.workoutStartTime ?? null
  );
  const [selectedRoutineName, setSelectedRoutineName] = React.useState<string | null>(
    () => persisted?.selectedRoutineName ?? null
  );
  const [workoutExerciseRestTimes, setWorkoutExerciseRestTimes] = React.useState<Record<string, number>>(
    () => persisted?.workoutExerciseRestTimes ?? {}
  );
  const [workoutExerciseNotes, setWorkoutExerciseNotes] = React.useState<Record<string, string>>(
    () => persisted?.workoutExerciseNotes ?? {}
  );
  const [currentWorkoutIndex, setCurrentWorkoutIndex] = React.useState(0);
  const [workoutExtraItems, setWorkoutExtraItems] = React.useState<UserWorkoutWithDetails[]>(
    () => persisted?.workoutExtraItems ?? []
  );
  const [workoutRemovedIds, setWorkoutRemovedIds] = React.useState<string[]>(
    () => persisted?.workoutRemovedIds ?? []
  );
  const [workoutExpandedId, setWorkoutExpandedId] = React.useState<string | null>(
    () => persisted?.workoutExpandedId ?? null
  );
  const [maxedExerciseIds, setMaxedExerciseIds] = React.useState<string[]>(
    () => persisted?.maxedExerciseIds ?? []
  );
  const [dismissedWarmupIds, setDismissedWarmupIds] = React.useState<string[]>(
    () => persisted?.dismissedWarmupIds ?? []
  );
  const [workoutOrder, setWorkoutOrder] = React.useState<string[]>(
    () => persisted?.workoutOrder ?? []
  );
  const [workoutCaloriesKcal, setWorkoutCaloriesKcal] = React.useState<number | null>(
    () => persisted?.workoutCaloriesKcal ?? null
  );
  const [workoutPartyId, setWorkoutPartyId] = React.useState<string | null>(
    () => persisted?.workoutPartyId ?? null
  );
  const [workoutPartyRole, setWorkoutPartyRole] = React.useState<"host" | "guest" | null>(
    () => persisted?.workoutPartyRole ?? null
  );
  const [workoutPartySnapshot, setWorkoutPartySnapshot] = React.useState<WorkoutPartySnapshot | null>(
    () => persisted?.workoutPartySnapshot ?? null
  );
  const [workoutPartyHostName, setWorkoutPartyHostName] = React.useState<string | null>(
    () => persisted?.workoutPartyHostName ?? null
  );
  // Fora do localStorage de propósito: é um repasse de segundos entre o
  // AppLayout (onde o convite é aceito) e a tela de Metas (que inicia a sessão).
  const [pendingPartyJoin, setPendingPartyJoin] = React.useState<WorkoutPartyInvite | null>(null);
  const [globalRestTimerRemaining, setGlobalRestTimerRemaining] = React.useState(0);
  const [globalRestTimerActive, setGlobalRestTimerActive] = React.useState(false);
  const [globalRestTimerPaused, setGlobalRestTimerPaused] = React.useState(false);
  const [globalRestTimerTotal, setGlobalRestTimerTotal] = React.useState(0);
  const [globalRestTimerKey, setGlobalRestTimerKey] = React.useState(0);

  // Persiste estado crítico no localStorage enquanto treino estiver ativo
  React.useEffect(() => {
    if (workoutStartTime !== null && (workoutModalOpen || workoutMinimized)) {
      localStorage.setItem(WORKOUT_STORAGE_KEY, JSON.stringify({
        workoutSeries,
        workoutStartTime,
        selectedRoutineName,
        workoutExerciseRestTimes,
        workoutExerciseNotes,
        workoutExtraItems,
        workoutRemovedIds,
        workoutExpandedId,
        maxedExerciseIds,
        dismissedWarmupIds,
        workoutOrder,
        workoutCaloriesKcal,
        workoutPartyId,
        workoutPartyRole,
        workoutPartySnapshot,
        workoutPartyHostName,
      }));
    }
  }, [workoutSeries, workoutStartTime, selectedRoutineName, workoutExerciseRestTimes, workoutExerciseNotes, workoutExtraItems, workoutRemovedIds, workoutExpandedId, maxedExerciseIds, dismissedWarmupIds, workoutOrder, workoutCaloriesKcal, workoutPartyId, workoutPartyRole, workoutPartySnapshot, workoutPartyHostName, workoutModalOpen, workoutMinimized]);

  // Workout duration timer — calculates from startTime so background/lock doesn't break it
  React.useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    const isActive = workoutModalOpen || workoutMinimized;
    if (isActive && workoutStartTime === null) {
      setWorkoutStartTime(Date.now());
    }
    if (isActive && workoutStartTime !== null) {
      // Calculate elapsed time from startTime so lock/background doesn't cause drift
      interval = setInterval(() => {
        setWorkoutDuration(Math.floor((Date.now() - workoutStartTime) / 1000));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [workoutModalOpen, workoutMinimized, workoutStartTime]);

  // Sync workout duration when app returns from background/lock screen
  React.useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (workoutStartTime !== null && (workoutModalOpen || workoutMinimized)) {
        setWorkoutDuration(Math.floor((Date.now() - workoutStartTime) / 1000));
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [workoutStartTime, workoutModalOpen, workoutMinimized]);

  const REST_TIMER_END_KEY = "rest_timer_end_at";

  // Schedule / cancel the local notification for rest timer
  const scheduleRestNotification = React.useCallback(async (secondsRemaining: number) => {
    try {
      await LocalNotifications.requestPermissions();
      await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIF_ID }] });
      if (secondsRemaining <= 0) return;
      await LocalNotifications.schedule({
        notifications: [{
          id: REST_NOTIF_ID,
          title: "Tempo de descanso terminou! 💪",
          body: "Pronto para a próxima série?",
          schedule: { at: new Date(Date.now() + secondsRemaining * 1000) },
          smallIcon: "ic_stat_icon_config_sample",
          sound: "default",
        }],
      });
    } catch (_) { /* notifications not available on web */ }
  }, []);

  const cancelRestNotification = React.useCallback(async () => {
    try {
      await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIF_ID }] });
    } catch (_) {}
    localStorage.removeItem(REST_TIMER_END_KEY);
  }, []);

  // Ao tocar na notificação de "descanso terminou" (tela bloqueada ou app em
  // background/morto), reabre a tela de registrar treino automaticamente.
  // Usa apenas estado do contexto (sem navegação aqui, pois o Provider fica
  // fora do Router) — AppLayout observa `pendingReopen` e navega até /metas.
  React.useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listenerPromise = LocalNotifications.addListener(
      "localNotificationActionPerformed",
      (action) => {
        if (action.notification.id !== REST_NOTIF_ID) return;
        setWorkoutMinimized(false);
        setPendingReopen(true);
      }
    );
    return () => {
      listenerPromise.then((l) => l.remove());
    };
  }, []);

  // Persist end timestamp when timer starts so background sync works.
  // When paused, cancel the scheduled notification and clear the end key —
  // the countdown is frozen, so there is no fixed end time anymore.
  React.useEffect(() => {
    if (globalRestTimerActive && !globalRestTimerPaused && globalRestTimerRemaining > 0) {
      const endAt = Date.now() + globalRestTimerRemaining * 1000;
      localStorage.setItem(REST_TIMER_END_KEY, String(endAt));
      scheduleRestNotification(globalRestTimerRemaining);
    } else {
      cancelRestNotification();
    }
  }, [globalRestTimerKey, globalRestTimerActive, globalRestTimerPaused]); // trigger on start/stop/restart/pause/resume

  // Sync timer when app returns to foreground
  React.useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      const endAtStr = localStorage.getItem(REST_TIMER_END_KEY);
      if (!endAtStr) return;
      const endAt = Number(endAtStr);
      const remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000));
      if (remaining <= 0) {
        localStorage.removeItem(REST_TIMER_END_KEY);
        setGlobalRestTimerRemaining(0);
        setGlobalRestTimerActive(false);
      } else {
        setGlobalRestTimerRemaining(remaining);
        if (!globalRestTimerActive) setGlobalRestTimerActive(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [globalRestTimerActive]);

  // Rest timer countdown — always runs in context so it persists when dialog is closed/minimized.
  // Frozen while paused.
  React.useEffect(() => {
    if (!globalRestTimerActive || globalRestTimerPaused || globalRestTimerRemaining <= 0) return;
    const interval = setInterval(() => {
      setGlobalRestTimerRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setGlobalRestTimerActive(false);
          localStorage.removeItem(REST_TIMER_END_KEY);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [globalRestTimerKey, globalRestTimerActive, globalRestTimerPaused]); // also re-run when paused/resumed so interval is cleared

  const resetWorkoutState = React.useCallback(() => {
    localStorage.removeItem(WORKOUT_STORAGE_KEY);
    cancelRestNotification();
    setWorkoutSeries({});
    setWorkoutDuration(0);
    setWorkoutStartTime(null);
    setSelectedRoutineName(null);
    setWorkoutExerciseRestTimes({});
    setWorkoutExerciseNotes({});
    setCurrentWorkoutIndex(0);
    setWorkoutExtraItems([]);
    setWorkoutRemovedIds([]);
    setWorkoutExpandedId(null);
    setMaxedExerciseIds([]);
    setDismissedWarmupIds([]);
    setWorkoutOrder([]);
    setWorkoutCaloriesKcal(null);
    // A party morre junto com a sessão. Quem precisa do snapshot depois do fim
    // (a pergunta "salvar essa rotina?") já o copiou para o resumo ANTES de
    // chamar este reset — ver `handleWorkoutFinished` em Goals.tsx.
    setWorkoutPartyId(null);
    setWorkoutPartyRole(null);
    setWorkoutPartySnapshot(null);
    setWorkoutPartyHostName(null);
    setWorkoutMinimized(false);
    setWorkoutModalOpen(false);
    setGlobalRestTimerRemaining(0);
    setGlobalRestTimerActive(false);
    setGlobalRestTimerPaused(false);
    setGlobalRestTimerTotal(0);
  }, [cancelRestNotification]);

  return (
    <WorkoutContext.Provider value={{
      workoutModalOpen, setWorkoutModalOpen,
      workoutMinimized, setWorkoutMinimized,
      pendingReopen, setPendingReopen,
      workoutSeries, setWorkoutSeries,
      workoutDuration, setWorkoutDuration,
      workoutStartTime, setWorkoutStartTime,
      selectedRoutineName, setSelectedRoutineName,
      workoutExerciseRestTimes, setWorkoutExerciseRestTimes,
      workoutExerciseNotes, setWorkoutExerciseNotes,
      currentWorkoutIndex, setCurrentWorkoutIndex,
      workoutExtraItems, setWorkoutExtraItems,
      workoutRemovedIds, setWorkoutRemovedIds,
      workoutExpandedId, setWorkoutExpandedId,
      maxedExerciseIds, setMaxedExerciseIds,
      dismissedWarmupIds, setDismissedWarmupIds,
      workoutOrder, setWorkoutOrder,
      workoutCaloriesKcal, setWorkoutCaloriesKcal,
      workoutPartyId, setWorkoutPartyId,
      workoutPartyRole, setWorkoutPartyRole,
      workoutPartySnapshot, setWorkoutPartySnapshot,
      workoutPartyHostName, setWorkoutPartyHostName,
      pendingPartyJoin, setPendingPartyJoin,
      resetWorkoutState,
      globalRestTimerRemaining, setGlobalRestTimerRemaining,
      globalRestTimerActive, setGlobalRestTimerActive,
      globalRestTimerPaused, setGlobalRestTimerPaused,
      globalRestTimerTotal, setGlobalRestTimerTotal,
      globalRestTimerKey, setGlobalRestTimerKey,
    }}>
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkout() {
  return React.useContext(WorkoutContext);
}
