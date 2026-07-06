import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/language-context";
import {
  subscribeRoutineCompleteToast,
  type RoutineCompletePayload,
} from "@/lib/routine-complete-toast";
import { hapticSuccess } from "@/lib/haptics";

const TYPE_NAME_KEY = {
  1: "goals_rt_exercises",
  2: "goals_rt_diets",
  3: "goals_rt_habits",
} as const;

/**
 * Global "routine completed" celebration — appears when the user finishes a
 * workout session or completes every item of a diet/habit routine for the
 * day. Mounted once in AppLayout, driven by the routine-complete-toast pub/sub
 * (same pattern as IncentiveConfirmToast) so any screen can trigger it
 * without prop drilling.
 */
export function RoutineCompletedToast() {
  const { t } = useLanguage();
  const [payload, setPayload] = React.useState<RoutineCompletePayload | null>(null);
  const [tick, setTick] = React.useState(0);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return subscribeRoutineCompleteToast((p) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setPayload(p);
      setTick((n) => n + 1);
      hapticSuccess();
      timerRef.current = setTimeout(() => setPayload(null), 3200);
    });
  }, []);

  React.useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const name = payload
    ? (payload.name ?? t(TYPE_NAME_KEY[payload.type] as Parameters<typeof t>[0]))
    : "";
  const desc = payload
    ? t("goals_routine_complete_desc").replace("{name}", name)
    : null;

  return (
    <div
      className="fixed inset-x-0 z-[9999] flex items-center justify-center pointer-events-none px-4"
      style={{ top: "max(1rem, env(safe-area-inset-top))" }}
    >
      <AnimatePresence>
        {payload && (
          <motion.div
            key={`routine-complete-toast-${tick}`}
            initial={{ opacity: 0, scale: 0.85, y: -16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -12 }}
            transition={{
              opacity: { duration: 0.4, ease: "easeInOut" },
              scale: { type: "spring", stiffness: 420, damping: 24 },
              y: { type: "spring", stiffness: 420, damping: 24 },
            }}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-4 py-3.5 shadow-2xl border border-emerald-500/30 max-w-[calc(100vw-2rem)]",
              "bg-black/80 backdrop-blur-md",
            )}
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
              <PartyPopper className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-400 leading-tight">
                {t("goals_routine_complete_title")}
              </p>
              <p className="text-xs text-white/70 leading-tight truncate">{desc}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
