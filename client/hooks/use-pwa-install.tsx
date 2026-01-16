import * as React from "react";

type InstallPlatform = "ios" | "android" | "other";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

const DISMISS_KEY = "ritmofit:pwa-install:dismissed:v1";

function safeLocalStorageGet(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function isIosDevice() {
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/i.test(ua);
}

function isAndroidDevice() {
  const ua = window.navigator.userAgent;
  return /Android/i.test(ua);
}

function isIosStandalone() {
  return Boolean((window.navigator as unknown as { standalone?: boolean }).standalone);
}

function isStandaloneDisplayMode() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
}

function isSafariOnIos() {
  // iOS browsers include Safari in UA; exclude common alternatives.
  const ua = window.navigator.userAgent;
  const iOS = isIosDevice();
  if (!iOS) return false;

  const isCriOS = /CriOS/i.test(ua);
  const isFxiOS = /FxiOS/i.test(ua);
  const isOPiOS = /OPiOS/i.test(ua);

  return !isCriOS && !isFxiOS && !isOPiOS;
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = React.useState(false);
  const [installed, setInstalled] = React.useState(false);

  const platform: InstallPlatform = React.useMemo(() => {
    if (typeof window === "undefined") return "other";
    if (isIosDevice()) return "ios";
    if (isAndroidDevice()) return "android";
    return "other";
  }, []);

  const isSafariIOS = React.useMemo(() => {
    if (typeof window === "undefined") return false;
    return isSafariOnIos();
  }, []);

  React.useEffect(() => {
    const initialDismissed = safeLocalStorageGet(DISMISS_KEY) === "1";
    setDismissed(initialDismissed);

    const computeInstalled = () => {
      const next = isStandaloneDisplayMode() || isIosStandalone();
      setInstalled(next);
      return next;
    };

    computeInstalled();

    const onBeforeInstallPrompt = (e: Event) => {
      // Chrome/Edge on Android/desktop.
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    const mql = window.matchMedia?.("(display-mode: standalone)");
    const onDisplayModeChange = () => computeInstalled();
    mql?.addEventListener?.("change", onDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      mql?.removeEventListener?.("change", onDisplayModeChange);
    };
  }, []);

  const isInstallable = Boolean(deferredPrompt);

  const promptInstall = React.useCallback(async () => {
    if (!deferredPrompt) return null;

    await deferredPrompt.prompt();

    try {
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setDeferredPrompt(null);
      }
      return choice;
    } catch {
      return null;
    }
  }, [deferredPrompt]);

  const dismiss = React.useCallback(() => {
    setDismissed(true);
    safeLocalStorageSet(DISMISS_KEY, "1");
  }, []);

  const resetDismissed = React.useCallback(() => {
    setDismissed(false);
    safeLocalStorageSet(DISMISS_KEY, "0");
  }, []);

  return {
    platform,
    isSafariIOS,
    installed,
    isInstallable,
    dismissed,
    dismiss,
    resetDismissed,
    promptInstall,
  };
}
