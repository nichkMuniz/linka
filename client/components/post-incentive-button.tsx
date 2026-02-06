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
            aria-label={`${config.label} (${count})`}
            onClick={onClick}
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.9 }}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 transition-opacity",
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
            {count > 0 && (
              <span className="text-xs text-muted-foreground font-medium">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </motion.button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {config.label} ({count})
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
