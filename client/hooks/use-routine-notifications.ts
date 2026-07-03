import { useEffect, useCallback, useRef } from "react";
import { LocalNotifications, type LocalNotificationSchema } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { getRoutineSchedulesDb, RoutineScheduleEntry } from "@/lib/ritmofit-db";
import { REST_NOTIF_ID } from "@/lib/workout-context";

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
 * Parses a comma-separated list of Monday-first weekday indices (0=Mon…6=Sun)
 * into Capacitor LocalNotifications weekdays (1=Sun…7=Sat). Invalid/empty → [].
 */
function parseWeekdays(days: string): number[] {
  if (!days.trim()) return [];
  const result: number[] = [];
  for (const part of days.split(",")) {
    const mondayIdx = Number(part.trim());
    if (!Number.isInteger(mondayIdx) || mondayIdx < 0 || mondayIdx > 6) continue;
    // Monday-first idx → JS getDay (Sun=0) → Capacitor weekday (Sun=1)
    const jsDay = (mondayIdx + 1) % 7;
    result.push(jsDay + 1);
  }
  return result;
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

  // Group by routine (type + name + time + days) so N items of the same routine
  // produce a single notification instead of N.
  const groups = new Map<
    string,
    { type: string; name: string; time: string; days: string; count: number }
  >();
  for (const e of schedules) {
    if (!e.scheduled_time) continue;
    const time = e.scheduled_time.slice(0, 5);
    const days = (e.scheduled_days ?? "").trim();
    const key = `${e.type}|${e.name ?? ""}|${time}|${days}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(key, { type: e.type, name: e.name, time, days, count: 1 });
    }
  }

  const labels = getTypeLabels();
  const toSchedule = Array.from(groups.values()).flatMap<LocalNotificationSchema>((g) => {
    const title = `${TYPE_ICONS[g.type] || "🔔"} ${g.name || labels[g.type] || "Rotina"}`;
    const body =
      g.count > 1
        ? `Hora da sua rotina (${g.count} ${labels[g.type] || "itens"})`
        : `Hora da sua rotina: ${labels[g.type] || "item"}`;
    const base = {
      title,
      body,
      extra: { url: "/metas" },
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#f97316",
    };

    const weekdays = parseWeekdays(g.days);
    // No weekday filter → daily repeat (backward-compatible).
    if (weekdays.length === 0) {
      return [{
        ...base,
        id: entryToNotifId(`${g.type}|${g.name}|${g.time}`),
        schedule: { at: nextOccurrence(g.time), repeats: true, every: "day" as const },
      }];
    }
    // One repeating notification per selected weekday.
    const [hh, mm] = g.time.split(":").map(Number);
    return weekdays.map((capWeekday) => ({
      ...base,
      id: entryToNotifId(`${g.type}|${g.name}|${g.time}|${capWeekday}`),
      schedule: { on: { weekday: capWeekday, hour: hh, minute: mm }, repeats: true },
    }));
  });

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

  const syncAll = useCallback(async (force = false) => {
    if (!userId) return;
    // Debounce: skip if synced less than 5 seconds ago (unless forced, e.g.
    // right after the user creates/edits a routine schedule).
    const now = Date.now();
    if (!force && now - lastSyncRef.current < 5_000) return;
    lastSyncRef.current = now;

    // Respect user preference stored by settings-drawer
    try {
      const stored = localStorage.getItem("linka_notif_prefs");
      if (stored) {
        const prefs = JSON.parse(stored);
        if (prefs.workoutReminders === false) return;
      }
    } catch {}

    try {
      const permission = await requestNotificationPermission();
      if (permission !== "granted") return;
      const schedules = await getRoutineSchedulesDb(userId);
      await applySchedulesNative(schedules);
    } catch (err) {
      console.error("[notifications] sync failed:", err);
    }
  }, [userId]);

  // Sync on mount, when returning to the app (visibilitychange) and whenever a
  // routine schedule is created/edited (custom "ritmofit-routines-changed" event).
  useEffect(() => {
    syncAll();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") syncAll();
    };
    const handleRoutinesChanged = () => syncAll(true);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("ritmofit-routines-changed", handleRoutinesChanged);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("ritmofit-routines-changed", handleRoutinesChanged);
    };
  }, [syncAll]);

  // Handle notification tap → navigate to /metas
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = LocalNotifications.addListener(
      "localNotificationActionPerformed",
      (action) => {
        // Notificação de fim de descanso tem tratamento próprio (workout-context)
        // que reabre a tela sem forçar reload — evita perder o estado do treino.
        if (action.notification.id === REST_NOTIF_ID) return;
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
