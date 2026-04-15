import { useEffect, useCallback } from "react";
import { LocalNotifications } from "@capacitor/local-notifications";
import { getRoutineSchedulesDb, RoutineScheduleEntry } from "@/lib/ritmofit-db";

/**
 * Formats a "HH:MM" or "HH:MM:SS" time string as a display label (e.g. "07:30").
 */
export function formatScheduledTime(time: string): string {
  return time.slice(0, 5);
}

const TYPE_LABELS: Record<string, string> = { workout: "Treino", diet: "Refeição", habit: "Hábito" };
const TYPE_ICONS: Record<string, string> = { workout: "💪", diet: "🥗", habit: "✅" };

/**
 * Requests notification permission using the native Capacitor plugin.
 * Returns true if permission is (or becomes) "granted".
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { display } = await LocalNotifications.checkPermissions();
    if (display === "granted") return true;
    if (display === "denied") return false;
    const { display: result } = await LocalNotifications.requestPermissions();
    return result === "granted";
  } catch {
    // Fallback for web/PWA context where plugin is not available
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const result = await Notification.requestPermission();
    return result === "granted";
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
 */
async function applySchedulesNative(schedules: RoutineScheduleEntry[]): Promise<void> {
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({ notifications: pending.notifications });
  }

  const toSchedule = schedules
    .filter((e) => !!e.scheduled_time)
    .map((e) => ({
      id: entryToNotifId(e.id),
      title: `${TYPE_ICONS[e.type] || "🔔"} ${e.name}`,
      body: `Hora do seu ${TYPE_LABELS[e.type] || "item"}: ${e.name}`,
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
  const syncAll = useCallback(async () => {
    if (!userId) return;
    try {
      const granted = await requestNotificationPermission();
      if (!granted) return;
      const schedules = await getRoutineSchedulesDb(userId);
      await applySchedulesNative(schedules);
    } catch {
      // non-critical — silent fail
    }
  }, [userId]);

  useEffect(() => {
    syncAll();
  }, [syncAll]);

  // Handle notification tap → navigate to /metas
  useEffect(() => {
    const listener = LocalNotifications.addListener(
      "localNotificationActionPerformed",
      (action) => {
        const url: string = action.notification.extra?.url || "/metas";
        if (typeof window !== "undefined") {
          window.location.hash = url.replace(/^\//, "#/") || "#/metas";
        }
      }
    );
    return () => {
      listener.then((l) => l.remove());
    };
  }, []);

  return { syncAll };
}
