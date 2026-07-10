import * as React from "react";
import { getKeyboardHeight, subscribeKeyboardHeight } from "@/lib/keyboard";

/**
 * Returns the height (px) of the area visible above the iOS software keyboard.
 *
 * With @capacitor/keyboard configured as `resize: 'none'`
 * (capacitor.config.ts) the WKWebView frame never changes, so
 * `window.innerHeight` is constant — the keyboard just overlays the webview.
 * The keyboard height comes from the global tracker in `client/lib/keyboard.ts`
 * (fed by the native `keyboardWillShow`/`keyboardWillHide` events, which fire
 * at the START of the keyboard animation), so this value updates in sync with
 * the keyboard — no delayed webview resize, no flicker.
 *
 * Drawers use it (together with `dvh` caps) to size themselves:
 *
 *   maxHeight: `min(80dvh, ${viewportHeight - 8}px)`
 *
 * The actual lifting of the sheet above the keyboard is done in CSS by
 * `components/ui/drawer.tsx` / `dialog.tsx` via the `--keyboard-height` var —
 * this hook only provides the height cap so content compresses to fit.
 */
export function useKeyboardAwareHeight() {
  const [height, setHeight] = React.useState<number>(() =>
    typeof window !== "undefined" ? window.innerHeight - getKeyboardHeight() : 800,
  );

  React.useEffect(() => {
    const update = () => setHeight(window.innerHeight - getKeyboardHeight());
    const unsubscribe = subscribeKeyboardHeight(update);
    // Web fallback + rotação: fora do nativo o tracker é no-op, então os
    // eventos de resize continuam mantendo o valor correto no navegador.
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      unsubscribe();
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);

  return height;
}
