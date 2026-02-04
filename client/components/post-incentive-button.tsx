import * as React from "react";
import { motion } from "framer-motion";
import { HeartHandshake, Flame, Trophy } from "lucide-react";
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
};

export function PostIncentiveButton({
  type,
  count,
  isActive,
  onClick,
  loading,
  hasActivity,
}: {
  type: PostIncentiveType;
  count: number;
  isActive: boolean;
  onClick: () => void;
  loading?: boolean;
  hasActivity?: boolean;
}) {
  const config = incentiveConfig[type];
  const Icon = config.Icon;
  const shouldHighlight = isActive || (hasActivity && count > 0);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.button
            type="button"
            disabled={loading}
            aria-label={config.label}
            onClick={onClick}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            className={cn(
              "relative inline-flex shrink-0 items-center justify-center rounded-lg p-2 transition-colors",
              "border border-border/50 bg-background/80 backdrop-blur",
              "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
              shouldHighlight && "border-current bg-muted/80",
              loading && "opacity-50 cursor-not-allowed",
            )}
          >
            <Icon
              className={cn(
                "h-5 w-5 transition-colors",
                shouldHighlight ? config.iconClassName : "text-muted-foreground",
                shouldHighlight && "fill-current",
              )}
            />
            {count > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={cn(
                  "absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold",
                  shouldHighlight && cn("bg-current text-background", config.iconClassName),
                )}
              >
                {count > 99 ? "99+" : count}
              </motion.span>
            )}
          </motion.button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {config.label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
