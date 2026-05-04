import * as React from "react";
import { motion, useAnimation } from "framer-motion";
import { Heart, Flame, Trophy, TrendingUp, Dumbbell, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PostIncentiveType } from "@/lib/ritmofit-db";

type IncentiveConfig = {
  label: string;
  emoji: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  iconClassName: string;
  activeClassName: string;
};

const incentiveConfig: Record<PostIncentiveType, IncentiveConfig> = {
  1: {
    label: "Amei",
    emoji: "❤️",
    Icon: Heart,
    iconClassName: "text-rose-400",
    activeClassName: "text-rose-500 fill-rose-500",
  },
  2: {
    label: "Pode mais 🔥",
    emoji: "🔥",
    Icon: Flame,
    iconClassName: "text-orange-400",
    activeClassName: "text-orange-500 fill-orange-500",
  },
  3: {
    label: "Vencedor! 🏆",
    emoji: "🏆",
    Icon: Trophy,
    iconClassName: "text-amber-400",
    activeClassName: "text-amber-500 fill-amber-500",
  },
  4: {
    label: "Evolução! 📈",
    emoji: "📈",
    Icon: TrendingUp,
    iconClassName: "text-emerald-400",
    activeClassName: "text-emerald-500",
  },
  5: {
    label: "Boa execução! 💪",
    emoji: "💪",
    Icon: Dumbbell,
    iconClassName: "text-blue-400",
    activeClassName: "text-blue-500 fill-blue-500",
  },
  6: {
    label: "Intensifique! ⚡",
    emoji: "⚡",
    Icon: Zap,
    iconClassName: "text-yellow-400",
    activeClassName: "text-yellow-500 fill-yellow-500",
  },
};

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
  const config = incentiveConfig[type];
  const Icon = config.Icon;
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

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.button
            type="button"
            disabled={loading}
            aria-label={config.label}
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
                isActive ? config.activeClassName : config.iconClassName,
              )}
            />
          </motion.button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs font-medium">
          {config.label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
