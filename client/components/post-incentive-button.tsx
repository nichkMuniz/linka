import * as React from "react";
import { motion } from "framer-motion";
import { HeartHandshake, Flame, Trophy, Rocket, Target, Zap } from "lucide-react";
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
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  iconClassName: string;
};

const incentiveConfig: Record<PostIncentiveType, IncentiveConfig> = {
  1: {
    label: "Te apoio",
    Icon: HeartHandshake,
    iconClassName: "text-rose-500",
  },
  2: {
    label: "Continua",
    Icon: Flame,
    iconClassName: "text-orange-500",
  },
  3: {
    label: "Ganhador",
    Icon: Trophy,
    iconClassName: "text-emerald-500",
  },
  4: {
    label: "Você consegue mais",
    Icon: Rocket,
    iconClassName: "text-blue-500",
  },
  5: {
    label: "Seu limite é maior do que imagina",
    Icon: Target,
    iconClassName: "text-purple-500",
  },
  6: {
    label: "Aguentava mais 10",
    Icon: Zap,
    iconClassName: "text-yellow-500",
  },
};

export function PostIncentiveButton({
  type,
  isActive,
  onClick,
  loading,
}: {
  type: PostIncentiveType;
  isActive: boolean;
  onClick: () => void;
  loading?: boolean;
}) {
  const config = incentiveConfig[type];
  const Icon = config.Icon;
  const shouldHighlight = isActive;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.button
            type="button"
            disabled={loading}
            aria-label={config.label}
            onClick={onClick}
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.9 }}
            className={cn(
              "inline-flex shrink-0 items-center justify-center min-h-[44px] min-w-[44px] transition-opacity",
              loading && "opacity-50 cursor-not-allowed",
              "hover:opacity-80",
            )}
          >
            <Icon
              className={cn(
                "h-7 w-7 transition-colors",
                shouldHighlight
                  ? config.iconClassName
                  : "text-muted-foreground",
                shouldHighlight && "fill-current",
              )}
            />
          </motion.button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {config.label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
