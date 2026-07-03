import * as React from "react";

/**
 * Returns the current webview height (`window.innerHeight`).
 *
 * With @capacitor/keyboard configured as `resize: 'native'`
 * (capacitor.config.ts), the WKWebView frame shrinks when the iOS software
 * keyboard opens — so this value IS the visible area above the keyboard.
 * Drawers use it (together with `dvh` caps) to size themselves:
 *
 *   maxHeight: `min(80dvh, ${viewportHeight - 8}px)`
 *
 * When the keyboard opens the whole viewport shrinks, the bottom-fixed sheet
 * stays glued right above the keyboard and its content compresses — no JS
 * repositioning involved (vaul's `repositionInputs` is disabled in
 * components/ui/drawer.tsx).
 */
export function useKeyboardAwareHeight() {
  const [height, setHeight] = React.useState<number>(() =>
    typeof window !== "undefined" ? window.innerHeight : 800,
  );

  React.useEffect(() => {
    const update = () => setHeight(window.innerHeight);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    // Redundância: em alguns iOS o visualViewport dispara antes do resize da
    // window quando o frame do webview muda (resize: 'native').
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);

  return height;
}
