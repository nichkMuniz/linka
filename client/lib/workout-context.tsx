import * as React from "react";
import { LocalNotifications } from "@capacitor/local-notifications";

type WorkoutSeriesEntry = {
  series: number;
  kg: number;
  reps: number;
  completed: boolean;
  type?: 'W' | 'N' | 'F';
  prevKg?: number;
  prevReps?: number;
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
      }));
    }
  }, [workoutSeries, workoutStartTime, selectedRoutineName, workoutExerciseRestTimes, workoutExerciseNotes, workoutModalOpen, workoutMinimized]);

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

  const REST_NOTIF_ID = 91823;
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
