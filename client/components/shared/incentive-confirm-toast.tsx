import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { PostIncentiveType } from "@/lib/ritmofit-db";
import { INCENTIVE_CONFIG } from "@/lib/incentive-config";
import { useLanguage } from "@/lib/language-context";
import { subscribeIncentiveToast } from "@/lib/incentive-toast";

/**
 * Global confirmation toast that appears when any incentive is given anywhere in the app.
 * Mounted once in AppLayout — listens to the incentive-toast pub/sub.
 */
export function IncentiveConfirmToast() {
  const { t } = useLanguage();
  const [activeType, setActiveType] = React.useState<PostIncentiveType | null>(null);
  const [tick, setTick] = React.useState(0);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return subscribeIncentiveToast((type) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setActiveType(type);
      setTick((n) => n + 1);
      timerRef.current = setTimeout(() => setActiveType(null), 3000);
    });
  }, []);

  React.useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const cfg = activeType ? INCENTIVE_CONFIG[activeType] : null;
  const label = activeType
    ? t(`incentive_${activeType}` as Parameters<typeof t>[0])
    : null;

  return (
    <div
      className="fixed inset-x-0 z-[9999] flex items-center justify-center pointer-events-none"
      style={{
        bottom: "calc(6rem + env(safe-area-inset-bottom))",
      }}
    >
      <AnimatePresence mode="wait">
        {activeType && cfg && (
          <motion.div
            key={`incentive-toast-${tick}`}
            initial={{ opacity: 0, scale: 0.7, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -12 }}
            transition={{
              opacity: { duration: 0.55, ease: "easeInOut" },
              scale: { type: "spring", stiffness: 420, damping: 24 },
              y: { type: "spring", stiffness: 420, damping: 24 },
            }}
            className={cn(
              "flex items-center gap-2.5 rounded-full px-5 py-3 shadow-2xl border border-white/15",
              "bg-black/80 backdrop-blur-md",
            )}
          >
            <cfg.Icon className={cn("h-5 w-5 flex-shrink-0", cfg.activeClassName)} />
            <span className="text-sm font-semibold text-white tracking-wide">
              {label}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
