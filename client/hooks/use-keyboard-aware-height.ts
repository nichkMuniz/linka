import * as React from "react";

/**
 * Returns the full window height, ignoring the iOS software keyboard.
 *
 * Drawers/modals using this value keep their size constant when the keyboard
 * opens — matching native iOS behavior where the keyboard overlays the sheet.
 * Inner input bars that need to stay visible should lift themselves above the
 * keyboard via `marginBottom: var(--keyboard-offset)` (set by `DrawerContent`).
 */
export function useKeyboardAwareHeight() {
  const [height, setHeight] = React.useState<number>(() =>
    typeof window !== "undefined" ? window.innerHeight : 800,
  );

  React.useEffect(() => {
    const update = () => setHeight(window.innerHeight);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return height;
}
