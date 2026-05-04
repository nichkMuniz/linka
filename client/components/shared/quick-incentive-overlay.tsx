import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Flame, Trophy, TrendingUp, Dumbbell, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PostIncentiveType } from "@/lib/ritmofit-db";
import { useLanguage } from "@/lib/language-context";

const incentiveConfig = {
  1: { Icon: Heart, activeClassName: "text-rose-500 fill-rose-500", bgColor: "bg-rose-500/20" },
  2: { Icon: Flame, activeClassName: "text-orange-500 fill-orange-500", bgColor: "bg-orange-500/20" },
  3: { Icon: Trophy, activeClassName: "text-amber-500 fill-amber-500", bgColor: "bg-amber-500/20" },
  4: { Icon: TrendingUp, activeClassName: "text-emerald-500", bgColor: "bg-emerald-500/20" },
  5: { Icon: Dumbbell, activeClassName: "text-blue-500 fill-blue-500", bgColor: "bg-blue-500/20" },
  6: { Icon: Zap, activeClassName: "text-yellow-500 fill-yellow-500", bgColor: "bg-yellow-500/20" },
} as const;

interface QuickIncentiveOverlayProps {
  visible: boolean;
  userLikes: PostIncentiveType[];
  onSelect: (type: PostIncentiveType) => void;
  onDismiss: () => void;
}

export function QuickIncentiveOverlay({
  visible,
  userLikes,
  onSelect,
  onDismiss,
}: QuickIncentiveOverlayProps) {
  const { t } = useLanguage();

  // Auto-dismiss after 3 seconds
  React.useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [visible, onDismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop tap to dismiss */}
          <div
            className="absolute inset-0 z-20"
            onClick={onDismiss}
          />

          {/* Overlay pill */}
          <motion.div
            className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <motion.div
              className="pointer-events-auto flex items-center gap-1 bg-black/75 backdrop-blur-md rounded-full px-3 py-3 shadow-2xl border border-white/10"
              initial={{ scale: 0.6, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.6, y: 20 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              {(Object.keys(incentiveConfig) as unknown as PostIncentiveType[]).map((type) => {
                const { Icon, activeClassName, bgColor } = incentiveConfig[type];
                const isActive = userLikes.includes(type);
                return (
                  <motion.button
                    key={type}
                    type="button"
                    aria-label={t(`incentive_${type as number}` as Parameters<typeof t>[0])}
                    onClick={() => onSelect(type)}
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.8 }}
                    className={cn(
                      "relative flex items-center justify-center w-11 h-11 rounded-full transition-all duration-150",
                      isActive ? bgColor : "hover:bg-white/10",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-6 w-6 transition-all duration-150",
                        isActive ? activeClassName : "text-white/80",
                      )}
                    />
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-current opacity-60"
                        layoutId={`active-ring-${type}`}
                        style={{ color: Icon === Heart ? "#f43f5e" : undefined }}
                      />
                    )}
                  </motion.button>
                );
              })}
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
