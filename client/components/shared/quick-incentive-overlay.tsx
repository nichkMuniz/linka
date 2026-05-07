import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { PostIncentiveType } from "@/lib/ritmofit-db";
import { INCENTIVE_CONFIG, INCENTIVE_TYPES } from "@/lib/incentive-config";
import { useLanguage } from "@/lib/language-context";
import { showIncentiveToast } from "@/lib/incentive-toast";

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

  // Auto-dismiss picker after 3 seconds
  React.useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [visible, onDismiss]);

  function handleSelect(type: PostIncentiveType) {
    showIncentiveToast(type);
    onSelect(type);
  }

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop tap to dismiss */}
          <div
            className="absolute inset-0 z-20"
            onClick={onDismiss}
          />

          {/* Icons pill */}
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
              {INCENTIVE_TYPES.map((type) => {
                const { Icon, activeClassName, bgColor } = INCENTIVE_CONFIG[type];
                const isActive = userLikes.includes(type);
                return (
                  <motion.button
                    key={type}
                    type="button"
                    aria-label={t(`incentive_${type}` as Parameters<typeof t>[0])}
                    onClick={() => handleSelect(type)}
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
                        style={{ color: type === 1 ? "#f43f5e" : undefined }}
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
