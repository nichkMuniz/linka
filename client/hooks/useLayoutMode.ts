import { useState, useEffect } from "react";

type LayoutMode = "default" | "novo";

interface FABPosition {
  x: number;
  y: number;
}

const DEFAULT_FAB_POSITION: FABPosition = {
  x: 24,
  y: 24,
};

export function useLayoutMode() {
  const [layoutMode, setLayoutModeState] = useState<LayoutMode>("default");
  const [fabPosition, setFabPositionState] = useState<FABPosition>(DEFAULT_FAB_POSITION);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Load from localStorage on mount
    const savedMode = localStorage.getItem("ritmofit-layout-mode") as LayoutMode | null;
    const savedPosition = localStorage.getItem("ritmofit-fab-position");

    if (savedMode) {
      setLayoutModeState(savedMode);
    }

    if (savedPosition) {
      try {
        const position = JSON.parse(savedPosition) as FABPosition;
        setFabPositionState(position);
      } catch (e) {
        console.error("Error parsing FAB position:", e);
        setFabPositionState(DEFAULT_FAB_POSITION);
      }
    }

    setIsInitialized(true);
  }, []);

  const setLayoutMode = (mode: LayoutMode) => {
    setLayoutModeState(mode);
    localStorage.setItem("ritmofit-layout-mode", mode);
  };

  const setFabPosition = (position: FABPosition) => {
    setFabPositionState(position);
    localStorage.setItem("ritmofit-fab-position", JSON.stringify(position));
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
    fabPosition,
    setFabPosition,
    isInitialized,
  };
}
