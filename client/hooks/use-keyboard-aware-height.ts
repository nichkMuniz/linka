import * as React from "react";

/**
 * Returns the full window height, ignoring the iOS software keyboard.
 *
 * Drawers/modals using this value get a stable max-height that ignores the iOS
 * software keyboard. When the keyboard opens, `DrawerContent` lifts the entire
 * sheet above it and caps its height to the visible area, so the content keeps
 * the same size and just slides up (no need for consumers to lift input bars).
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
