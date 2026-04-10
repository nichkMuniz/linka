/* RitmoFit PWA service worker (simple, no Workbox) */

// ─── Routine Notification Scheduler ───────────────────────────────────────────

const SW_SCHEDULE_KEY = "ritmofit_routine_schedules";

// In-memory map: scheduleId → timeoutId
const _scheduledAlarms = new Map();

function clearAllAlarms() {
  for (const tid of _scheduledAlarms.values()) clearTimeout(tid);
  _scheduledAlarms.clear();
}

/**
 * Given a "HH:MM" or "HH:MM:SS" time string, returns the ms until the next
 * occurrence of that time today (or tomorrow if the time has already passed).
 */
function msUntilTime(timeStr) {
  const now = new Date();
  const [hh, mm] = timeStr.split(":").map(Number);
  const target = new Date(now);
  target.setHours(hh, mm, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target.getTime() - now.getTime();
}

const TYPE_LABELS = { workout: "Treino", diet: "Refeição", habit: "Hábito" };
const TYPE_ICONS = { workout: "💪", diet: "🥗", habit: "✅" };

function scheduleAlarm(entry) {
  const delay = msUntilTime(entry.scheduled_time);
  const tid = setTimeout(async () => {
    _scheduledAlarms.delete(entry.id);
    try {
      await self.registration.showNotification(
        `${TYPE_ICONS[entry.type] || "🔔"} ${entry.name}`,
        {
          body: `Hora do seu ${TYPE_LABELS[entry.type] || "item"}: ${entry.name}`,
          icon: "/pwa-192x192.png",
          badge: "/pwa-192x192.png",
          tag: `routine-${entry.id}`,
          renotify: true,
          data: { url: "/metas" },
        },
      );
    } catch (err) {
      console.warn("[SW] showNotification failed:", err);
    }
    // Re-schedule for the same time tomorrow
    scheduleAlarm(entry);
  }, delay);
  _scheduledAlarms.set(entry.id, tid);
}

function applySchedules(schedules) {
  clearAllAlarms();
  for (const entry of schedules) {
    if (entry.scheduled_time) scheduleAlarm(entry);
  }
}

// Restore schedules on SW activation (page might not re-register them)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
      );
      await self.clients.claim();

      // Try to restore schedules from the client that triggered activation
      const allClients = await self.clients.matchAll({ type: "window" });
      if (allClients.length > 0) {
        allClients[0].postMessage({ type: "REQUEST_ROUTINE_SCHEDULES" });
      }
    })(),
  );
});

// Listen for schedule syncs from the page
self.addEventListener("message", (event) => {
  if (!event.data) return;
  if (event.data.type === "SYNC_ROUTINE_SCHEDULES") {
    applySchedules(event.data.schedules || []);
  }
});

// Open /metas when user taps a routine notification
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/metas";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return self.clients.openWindow(targetUrl);
    }),
  );
});

// ─── End Notification Scheduler ───────────────────────────────────────────────

const CACHE_NAME = "ritmofit-pwa-v2";

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/pwa-512x512.png",
  "/pwa-192x192.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE_URLS);
      await self.skipWaiting();
    })(),
  );
});

// activate handled above (with schedule restore)

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Don't interfere with non-GET or cross-origin.
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // SPA navigation: try network first, fallback to cached shell.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(CACHE_NAME);
          return (
            (await cache.match("/")) ||
            (await cache.match("/index.html")) ||
            Response.error()
          );
        }
      })(),
    );
    return;
  }

  // Static assets:
  // - scripts/styles: network-first (avoid stale JS after deploy)
  // - images/fonts: cache-first

  if (req.destination === "script" || req.destination === "style") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const fresh = await fetch(req);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          return (await cache.match(req)) || Response.error();
        }
      })(),
    );
    return;
  }

  if (req.destination === "image" || req.destination === "font") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req);
        if (cached) return cached;

        const fresh = await fetch(req);
        cache.put(req, fresh.clone());
        return fresh;
      })(),
    );
    return;
  }

  // Default: network with cache fallback.
  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req);
        return fresh;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(req)) || Response.error();
      }
    })(),
  );
});
