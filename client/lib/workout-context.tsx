import * as React from "react";

type WorkoutSeriesEntry = {
  series: number;
  kg: number;
  reps: number;
  completed: boolean;
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
  currentWorkoutIndex: number;
  setCurrentWorkoutIndex: (v: number) => void;
  // Reset all workout state
  resetWorkoutState: () => void;
  // Rest timer (shared so FAB can display it)
  globalRestTimerRemaining: number;
  setGlobalRestTimerRemaining: React.Dispatch<React.SetStateAction<number>>;
  globalRestTimerActive: boolean;
  setGlobalRestTimerActive: (v: boolean) => void;
  globalRestTimerTotal: number;
  setGlobalRestTimerTotal: (v: number) => void;
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
  currentWorkoutIndex: 0,
  setCurrentWorkoutIndex: () => {},
  resetWorkoutState: () => {},
  globalRestTimerRemaining: 0,
  setGlobalRestTimerRemaining: () => {},
  globalRestTimerActive: false,
  setGlobalRestTimerActive: () => {},
  globalRestTimerTotal: 0,
  setGlobalRestTimerTotal: () => {},
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
  const [currentWorkoutIndex, setCurrentWorkoutIndex] = React.useState(0);
  const [globalRestTimerRemaining, setGlobalRestTimerRemaining] = React.useState(0);
  const [globalRestTimerActive, setGlobalRestTimerActive] = React.useState(false);
  const [globalRestTimerTotal, setGlobalRestTimerTotal] = React.useState(0);

  // Persiste estado crítico no localStorage enquanto treino estiver ativo
  React.useEffect(() => {
    if (workoutStartTime !== null && (workoutModalOpen || workoutMinimized)) {
      localStorage.setItem(WORKOUT_STORAGE_KEY, JSON.stringify({
        workoutSeries,
        workoutStartTime,
        selectedRoutineName,
        workoutExerciseRestTimes,
      }));
    }
  }, [workoutSeries, workoutStartTime, selectedRoutineName, workoutExerciseRestTimes, workoutModalOpen, workoutMinimized]);

  // Workout duration timer — keeps running even when modal is minimized
  React.useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    const isActive = workoutModalOpen || workoutMinimized;
    if (isActive && workoutStartTime === null) {
      setWorkoutStartTime(Date.now());
    }
    if (isActive && workoutStartTime !== null) {
      interval = setInterval(() => {
        setWorkoutDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [workoutModalOpen, workoutMinimized, workoutStartTime]);

  // Rest timer countdown — always runs in context so it persists when dialog is closed/minimized
  const restTimerFinishedRef = React.useRef(false);
  React.useEffect(() => {
    if (!globalRestTimerActive || globalRestTimerRemaining <= 0) return;
    restTimerFinishedRef.current = false;
    const interval = setInterval(() => {
      setGlobalRestTimerRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setGlobalRestTimerActive(false);
          restTimerFinishedRef.current = true;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [globalRestTimerActive, globalRestTimerTotal]); // re-run when a new timer starts

  const resetWorkoutState = React.useCallback(() => {
    localStorage.removeItem(WORKOUT_STORAGE_KEY);
    setWorkoutSeries({});
    setWorkoutDuration(0);
    setWorkoutStartTime(null);
    setSelectedRoutineName(null);
    setWorkoutExerciseRestTimes({});
    setCurrentWorkoutIndex(0);
    setWorkoutMinimized(false);
    setWorkoutModalOpen(false);
    setGlobalRestTimerRemaining(0);
    setGlobalRestTimerActive(false);
    setGlobalRestTimerTotal(0);
  }, []);

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
      currentWorkoutIndex, setCurrentWorkoutIndex,
      resetWorkoutState,
      globalRestTimerRemaining, setGlobalRestTimerRemaining,
      globalRestTimerActive, setGlobalRestTimerActive,
      globalRestTimerTotal, setGlobalRestTimerTotal,
    }}>
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkout() {
  return React.useContext(WorkoutContext);
}
