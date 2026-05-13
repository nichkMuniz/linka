import { hasSupabaseConfig } from "@/lib/supabase";

type NetworkStatusListener = (status: NetworkStatus) => void;

export type NetworkStatus = {
  isOnline: boolean;
  isSupabaseReachable: boolean;
  lastChecked: Date;
};

let networkStatus: NetworkStatus = {
  isOnline: navigator.onLine,
  isSupabaseReachable: true,
  lastChecked: new Date(),
};

const listeners = new Set<NetworkStatusListener>();

// Monitor browser online/offline events
window.addEventListener("online", () => {
  networkStatus.isOnline = true;
  notifyListeners();
  // Recheck Supabase when coming back online
  checkSupabaseReachability();
});

window.addEventListener("offline", () => {
  networkStatus.isOnline = false;
  networkStatus.isSupabaseReachable = false;
  notifyListeners();
});

export function addNetworkStatusListener(
  listener: NetworkStatusListener,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener(networkStatus);
    } catch (err) {
      console.error("Error in network status listener:", err);
    }
  });
}

export function getNetworkStatus(): NetworkStatus {
  return { ...networkStatus };
}

function isTransientNetworkError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as any;
  const name = String(anyErr?.name ?? "").toLowerCase();
  const msg = String(anyErr?.message ?? anyErr ?? "").toLowerCase();
  if (name.includes("authretryablefetcherror") || name === "typeerror" || name === "aborterror") {
    return true;
  }
  return (
    msg.includes("fetch") ||
    msg.includes("network") ||
    msg.includes("failed to fetch") ||
    msg.includes("load failed") ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("connection") ||
    msg.includes("offline")
  );
}

// Wrap a Supabase call (or any async network op) with a one-shot retry for the
// iOS WKWebView cold-start race, where the first request after launch can fail
// before the network stack is ready. Detects both thrown errors and Supabase's
// `{ error }` return shape.
export async function withNetworkRetry<T>(
  op: () => Promise<T>,
  opts: { retries?: number; delayMs?: number } = {},
): Promise<T> {
  const retries = opts.retries ?? 1;
  const delayMs = opts.delayMs ?? 1500;

  let lastThrown: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await op();
      const errField = (result as any)?.error;
      if (errField && isTransientNetworkError(errField) && attempt < retries) {
        await checkSupabaseReachability().catch(() => false);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      return result;
    } catch (err) {
      lastThrown = err;
      if (attempt < retries && isTransientNetworkError(err)) {
        await checkSupabaseReachability().catch(() => false);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw lastThrown;
}

export async function checkSupabaseReachability(): Promise<boolean> {
  if (!hasSupabaseConfig) {
    return false;
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: "HEAD",
      signal: controller.signal,
      headers: supabaseAnonKey ? { apikey: supabaseAnonKey } : {},
    });

    clearTimeout(timeoutId);

    const isReachable = response.ok || response.status === 401;
    if (networkStatus.isSupabaseReachable !== isReachable) {
      networkStatus.isSupabaseReachable = isReachable;
      networkStatus.lastChecked = new Date();
      notifyListeners();
    }

    return isReachable;
  } catch (err) {
    if (networkStatus.isSupabaseReachable) {
      networkStatus.isSupabaseReachable = false;
      networkStatus.lastChecked = new Date();
      notifyListeners();
    }
    return false;
  }
}

// Initial check with retry — iOS WKWebView network stack may not be ready immediately on app launch
async function initialCheckWithRetry(attempts = 3, delayMs = 2000) {
  for (let i = 0; i < attempts; i++) {
    const reachable = await checkSupabaseReachability().catch(() => false);
    if (reachable) return;
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

if (navigator.onLine) {
  initialCheckWithRetry().catch((err) => {
    console.warn("[Network] Initial Supabase reachability check failed:", err);
  });
}

// Periodic recheck (every 10 seconds when unreachable, 60 seconds otherwise)
setInterval(() => {
  if (navigator.onLine && !networkStatus.isSupabaseReachable) {
    checkSupabaseReachability().catch((err) => {
      console.warn("[Network] Periodic Supabase reachability check failed:", err);
    });
  }
}, 10000);

setInterval(() => {
  if (navigator.onLine && networkStatus.isSupabaseReachable) {
    checkSupabaseReachability().catch(() => {});
  }
}, 60000);
