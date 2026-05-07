import * as React from "react";
import { motion, useAnimation } from "framer-motion";
import { cn } from "@/lib/utils";
import type { PostIncentiveType } from "@/lib/ritmofit-db";
import { INCENTIVE_CONFIG } from "@/lib/incentive-config";
import { useLanguage } from "@/lib/language-context";

export function PostIncentiveButton({
  type,
  isActive,
  onClick,
  loading,
  burst,
}: {
  type: PostIncentiveType;
  isActive: boolean;
  onClick: () => void;
  loading?: boolean;
  burst?: boolean;
}) {
  const { t } = useLanguage();
  const cfg = INCENTIVE_CONFIG[type];
  const Icon = cfg.Icon;
  const controls = useAnimation();
  const prevBurst = React.useRef(false);

  React.useEffect(() => {
    if (burst && !prevBurst.current) {
      controls.start({
        scale: [1, 1.7, 0.8, 1.2, 1],
        transition: { duration: 0.5, ease: "easeOut" },
      });
    }
    prevBurst.current = !!burst;
  }, [burst, controls]);

  const label = t(`incentive_${type}` as Parameters<typeof t>[0]);

  return (
    <motion.button
      type="button"
      disabled={loading}
      aria-label={label}
      onClick={onClick}
      animate={controls}
      whileHover={{ scale: 1.18 }}
      whileTap={{ scale: 0.85 }}
      className={cn(
        "inline-flex items-center justify-center p-1.5 rounded-full transition-all",
        loading && "opacity-50 cursor-not-allowed",
        isActive && "scale-110",
      )}
    >
      <Icon
        className={cn(
          "h-[18px] w-[18px] transition-all duration-150",
          isActive ? cfg.activeClassName : cfg.iconClassName,
        )}
      />
    </motion.button>
  );
}
