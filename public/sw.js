/* RitmoFit PWA service worker (simple, no Workbox) */

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

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

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
