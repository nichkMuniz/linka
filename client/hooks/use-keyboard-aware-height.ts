import * as React from "react";
import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";

/**
 * Returns the height (px) of the visible area above the iOS software keyboard.
 *
 * With @capacitor/keyboard configured as `resize: 'native'`
 * (capacitor.config.ts), the WKWebView frame shrinks when the keyboard opens,
 * so `window.innerHeight` eventually becomes the area above the keyboard.
 * Drawers use this value (together with `dvh` caps) to size themselves:
 *
 *   maxHeight: `min(80dvh, ${viewportHeight - 8}px)`
 *
 * PROBLEM (the ~1s lag): inside WKWebView the `window`/`visualViewport`
 * "resize" event that reports the shrunk frame fires *late*, and `dvh`/`vh`
 * units stay frozen at their old value until then. So a drawer with a focused
 * input stayed at its full height for up to a second before snapping to fit
 * above the keyboard.
 *
 * FIX: drive the height from the native `keyboardWillShow` / `keyboardWillHide`
 * events, which fire at the *start* of the keyboard animation and already carry
 * `keyboardHeight`. We compute `fullHeight - keyboardHeight` immediately, in
 * sync with the keyboard animation, instead of waiting for the delayed resize.
 * The window/visualViewport listeners stay as a fallback for web and rotation.
 */
export function useKeyboardAwareHeight() {
  const [height, setHeight] = React.useState<number>(() =>
    typeof window !== "undefined" ? window.innerHeight : 800,
  );

  React.useEffect(() => {
    // Tallest innerHeight seen while the keyboard is hidden — our reference for
    // the keyboard-open computation (survives the delayed native frame resize).
    let fullHeight = window.innerHeight;

    const update = () => {
      const h = window.innerHeight;
      if (h > fullHeight) fullHeight = h;
      setHeight(h);
    };

    const onOrientation = () => {
      // After a rotation the full height changes; recapture on the next frame.
      requestAnimationFrame(() => {
        fullHeight = window.innerHeight;
        setHeight(window.innerHeight);
      });
    };

    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", onOrientation);
    window.visualViewport?.addEventListener("resize", update);

    // `cancelled` guards against a listener resolving *after* this effect has
    // already been torn down (these drawers mount/unmount often) — otherwise
    // the handle would be registered but never removed, leaking a listener.
    let cancelled = false;
    const listeners: Array<{ remove: () => void }> = [];
    const track = (p: Promise<{ remove: () => void }>) => {
      p.then((l) => (cancelled ? l.remove() : listeners.push(l)));
    };

    if (Capacitor.isNativePlatform()) {
      // Fire immediately when the keyboard begins to appear/disappear — no
      // waiting for the (delayed) native webview frame resize event.
      track(
        Keyboard.addListener("keyboardWillShow", (info) => {
          const kb = info?.keyboardHeight ?? 0;
          setHeight(kb > 0 ? Math.max(0, fullHeight - kb) : fullHeight);
        }),
      );
      track(
        Keyboard.addListener("keyboardWillHide", () => {
          setHeight(fullHeight);
        }),
      );
    }

    return () => {
      cancelled = true;
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", onOrientation);
      window.visualViewport?.removeEventListener("resize", update);
      listeners.forEach((l) => l.remove());
    };
  }, []);

  return height;
}
