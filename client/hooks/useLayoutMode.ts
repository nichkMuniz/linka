import { useState, useEffect } from "react";

type LayoutMode = "default" | "novo";

export function useLayoutMode() {
  const [layoutMode, setLayoutModeState] = useState<LayoutMode>("default");
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Load from localStorage on mount
    const saved = localStorage.getItem("ritmofit-layout-mode") as LayoutMode | null;
    if (saved) {
      setLayoutModeState(saved);
    }
    setIsInitialized(true);
  }, []);

  const setLayoutMode = (mode: LayoutMode) => {
    setLayoutModeState(mode);
    localStorage.setItem("ritmofit-layout-mode", mode);
  };

  const toggleLayoutMode = () => {
    const newMode = layoutMode === "default" ? "novo" : "default";
    setLayoutMode(newMode);
    return newMode;
  };

  return {
    layoutMode,
    setLayoutMode,
    toggleLayoutMode,
    isInitialized,
  };
}
