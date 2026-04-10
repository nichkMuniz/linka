import { useEffect, useCallback } from "react";
import { getRoutineSchedulesDb, RoutineScheduleEntry } from "@/lib/ritmofit-db";

const SW_SCHEDULE_KEY = "ritmofit_routine_schedules";

/**
 * Formats a "HH:MM" or "HH:MM:SS" time string as a display label (e.g. "07:30").
 */
export function formatScheduledTime(time: string): string {
  return time.slice(0, 5);
}

/**
 * Requests notification permission if not yet granted.
 * Returns true if permission is (or becomes) "granted".
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

/**
 * Sends the full list of schedules to the service worker so it can
 * (re)schedule all alarms. Called after any add/remove.
 */
function syncSchedulesToSW(schedules: RoutineScheduleEntry[]) {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready.then((reg) => {
    reg.active?.postMessage({
      type: "SYNC_ROUTINE_SCHEDULES",
      schedules,
    });
  });
  // Also persist in localStorage as fallback for SW activation
  try {
    localStorage.setItem(SW_SCHEDULE_KEY, JSON.stringify(schedules));
  } catch {
    // ignore quota errors
  }
}

/**
 * Hook that loads schedules for the current user and syncs them to the SW.
 * Call once on the Goals page mount.
 */
export function useRoutineNotifications(userId: string | null) {
  const syncAll = useCallback(async () => {
    if (!userId) return;
    try {
      const schedules = await getRoutineSchedulesDb(userId);
      syncSchedulesToSW(schedules);
    } catch {
      // non-critical — silent fail
    }
  }, [userId]);

  useEffect(() => {
    syncAll();
  }, [syncAll]);

  // Respond to the SW requesting a re-sync after activation
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "REQUEST_ROUTINE_SCHEDULES") {
        syncAll();
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [syncAll]);

  return { syncAll };
}
