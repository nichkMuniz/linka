import { useEffect, useCallback, useRef } from "react";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { getRoutineSchedulesDb, RoutineScheduleEntry } from "@/lib/ritmofit-db";

/**
 * Formats a "HH:MM" or "HH:MM:SS" time string as a display label (e.g. "07:30").
 */
export function formatScheduledTime(time: string): string {
  return time.slice(0, 5);
}

const TYPE_LABELS_PT: Record<string, string> = { workout: "Treino", diet: "Refeição", habit: "Hábito" };
const TYPE_LABELS_EN: Record<string, string> = { workout: "Workout", diet: "Meal", habit: "Habit" };
const TYPE_ICONS: Record<string, string> = { workout: "💪", diet: "🥗", habit: "✅" };

function getTypeLabels(): Record<string, string> {
  try {
    const lang = localStorage.getItem("ritmofit-language") || "pt";
    return lang === "en" ? TYPE_LABELS_EN : TYPE_LABELS_PT;
  } catch {
    return TYPE_LABELS_PT;
  }
}

/**
 * Requests notification permission using the native Capacitor plugin.
 * Returns "granted", "denied", or "unavailable".
 */
export async function requestNotificationPermission(): Promise<"granted" | "denied" | "unavailable"> {
  try {
    const { display } = await LocalNotifications.checkPermissions();
    if (display === "granted") return "granted";
    if (display === "denied") return "denied";
    const { display: result } = await LocalNotifications.requestPermissions();
    return result === "granted" ? "granted" : "denied";
  } catch {
    // Fallback for web/PWA context where plugin is not available
    if (!("Notification" in window)) return "unavailable";
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") return "denied";
    const result = await Notification.requestPermission();
    return result === "granted" ? "granted" : "denied";
  }
}

/**
 * Returns the next Date for a "HH:MM" or "HH:MM:SS" time string.
 * If that time already passed today, returns tomorrow's occurrence.
 */
function nextOccurrence(timeStr: string): Date {
  const [hh, mm] = timeStr.split(":").map(Number);
  const now = new Date();
  const target = new Date(now);
  target.setHours(hh, mm, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target;
}

/**
 * Deterministic numeric ID from a routine schedule entry string ID.
 * LocalNotifications requires an integer id.
 */
function entryToNotifId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (Math.imul(31, hash) + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2_000_000;
}

/**
 * Schedules (or re-schedules) all routine notifications using the native plugin.
 * Cancels all previous ones first to avoid duplicates.
 * Throws if scheduling fails so the caller can surface the error.
 */
async function applySchedulesNative(schedules: RoutineScheduleEntry[]): Promise<void> {
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }
  } catch {
    // getPending/cancel may fail on first run — safe to continue
  }

  const toSchedule = schedules
    .filter((e) => !!e.scheduled_time)
    .map((e) => ({
      id: entryToNotifId(e.id),
      title: `${TYPE_ICONS[e.type] || "🔔"} ${e.name}`,
      body: `${getTypeLabels()[e.type] || "item"}: ${e.name}`,
      schedule: {
        at: nextOccurrence(e.scheduled_time!),
        repeats: true,
        every: "day" as const,
      },
      extra: { url: "/metas" },
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#f97316",
    }));

  if (toSchedule.length > 0) {
    await LocalNotifications.schedule({ notifications: toSchedule });
  }
}

/**
 * Hook that loads schedules for the current user and registers them
 * as native local notifications via @capacitor/local-notifications.
 * Replaces the previous Service Worker + Web Notifications approach.
 */
export function useRoutineNotifications(userId: string | null) {
  // Tracks last sync to avoid redundant calls
  const lastSyncRef = useRef<number>(0);

  const syncAll = useCallback(async () => {
    if (!userId) return;
    // Debounce: skip if synced less than 5 seconds ago
    const now = Date.now();
    if (now - lastSyncRef.current < 5_000) return;
    lastSyncRef.current = now;

    try {
      const permission = await requestNotificationPermission();
      if (permission !== "granted") return;
      const schedules = await getRoutineSchedulesDb(userId);
      await applySchedulesNative(schedules);
    } catch (err) {
      console.error("[notifications] sync failed:", err);
    }
  }, [userId]);

  // Sync on mount and when returning to the app (visibilitychange)
  useEffect(() => {
    syncAll();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") syncAll();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [syncAll]);

  // Handle notification tap → navigate to /metas
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = LocalNotifications.addListener(
      "localNotificationActionPerformed",
      (action) => {
        const url: string = action.notification.extra?.url || "/metas";
        if (typeof window !== "undefined") {
          window.location.pathname = url;
        }
      }
    );
    return () => {
      listener.then((l) => l.remove());
    };
  }, []);

  return { syncAll };
}
