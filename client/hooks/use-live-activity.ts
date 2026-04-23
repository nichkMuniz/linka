import { registerPlugin, Capacitor } from "@capacitor/core";

interface WorkoutActivityPlugin {
  start(options: {
    routineName: string;
    exerciseName: string;
    seriesLabel: string;
    /** Unix epoch in milliseconds (Date.now()) — drives the auto-advancing timer on lock screen. */
    startTimeMs: number;
  }): Promise<{ id?: string; supported: boolean }>;

  update(options: {
    exerciseName: string;
    seriesLabel: string;
    /** Elapsed seconds frozen at the moment of pause — shown only when isPaused is true. */
    pausedElapsedSeconds: number;
    isPaused: boolean;
  }): Promise<{ updated: boolean }>;

  stop(): Promise<{ stopped: boolean }>;
}

// Lazily register the native plugin — safe to call even when not on iOS
const WorkoutActivity = registerPlugin<WorkoutActivityPlugin>("WorkoutActivityPlugin");

const isSupported = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

/**
 * Starts a Live Activity on the iOS lock screen / Dynamic Island showing
 * the workout in progress. No-op on Android or web.
 */
export async function startWorkoutLiveActivity(options: {
  routineName: string;
  exerciseName: string;
  seriesLabel: string;
  startTimeMs: number;
}): Promise<void> {
  if (!isSupported()) return;
  try {
    await WorkoutActivity.start(options);
  } catch (err) {
    // iOS < 16.1 or Live Activities disabled by user — fail silently
    console.warn("[LiveActivity] start failed:", err);
  }
}

/**
 * Updates the Live Activity content (exercise name, series).
 * The timer advances automatically on the lock screen — no need to call every second.
 * Only call on meaningful state changes (exercise change, series completion, pause toggle).
 */
export async function updateWorkoutLiveActivity(options: {
  exerciseName: string;
  seriesLabel: string;
  pausedElapsedSeconds: number;
  isPaused: boolean;
}): Promise<void> {
  if (!isSupported()) return;
  try {
    await WorkoutActivity.update(options);
  } catch {
    // ignore update failures
  }
}

/**
 * Ends and dismisses the Live Activity. Call when workout finishes or is cancelled.
 */
export async function stopWorkoutLiveActivity(): Promise<void> {
  if (!isSupported()) return;
  try {
    await WorkoutActivity.stop();
  } catch {
    // ignore
  }
}
