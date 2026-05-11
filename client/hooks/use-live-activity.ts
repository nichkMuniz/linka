import { registerPlugin, Capacitor } from "@capacitor/core";

interface StartOptions {
  routineName: string;
  exerciseName: string;
  seriesLabel: string;
  /** Unix epoch in milliseconds (Date.now()) — drives the elapsed timer on lock screen. */
  startTimeMs: number;
}

interface UpdateOptions {
  exerciseName?: string;
  seriesLabel?: string;
  /** "working" while the user is exercising, "resting" during the rest interval */
  phase?: "working" | "resting";
  pausedElapsedSeconds?: number;
  isPaused?: boolean;
  /**
   * Absolute epoch ms when the rest interval ends. Required when phase = "resting".
   * Pass `null` (not undefined) to explicitly clear the countdown.
   */
  restEndsAtMs?: number | null;
  /** Total length of the rest interval in seconds (drives the progress bar). */
  restTotalSeconds?: number;
  /** Preview of the upcoming series shown during rest, e.g. "A seguir: série 2 de 3 (68 kg x 10 rep)" */
  nextSeriesLabel?: string;
}

interface WorkoutActivityPlugin {
  start(options: StartOptions): Promise<{ id?: string; supported: boolean }>;
  update(options: UpdateOptions): Promise<{ updated: boolean }>;
  stop(): Promise<{ stopped: boolean }>;
}

const WorkoutActivity = registerPlugin<WorkoutActivityPlugin>("WorkoutActivityPlugin");

const isSupported = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

/**
 * Starts a Live Activity on the iOS lock screen / Dynamic Island showing
 * the workout in progress. No-op on Android or web.
 */
export async function startWorkoutLiveActivity(options: StartOptions): Promise<void> {
  if (!isSupported()) return;
  try {
    await WorkoutActivity.start(options);
  } catch (err) {
    // iOS < 16.2 or Live Activities disabled by user — fail silently
    console.warn("[LiveActivity] start failed:", err);
  }
}

/**
 * Updates the Live Activity content. The timer/countdown advance automatically
 * on the lock screen — only call on meaningful state changes (series completion,
 * rest start/end, exercise change, pause toggle).
 */
export async function updateWorkoutLiveActivity(options: UpdateOptions): Promise<void> {
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
