import * as React from "react";
import { Heart, Flame, Trophy, TrendingUp, Dumbbell, Zap } from "lucide-react";
import type { PostIncentiveType } from "@/lib/ritmofit-db";

export type IncentiveConfig = {
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  emoji: string;
  /** Tailwind class for inactive state */
  iconClassName: string;
  /** Tailwind class for active state */
  activeClassName: string;
  /** Background color class used in overlays */
  bgColor: string;
  /** Solid color class (no fill) used in notification icons */
  color: string;
};

export const INCENTIVE_CONFIG: Record<PostIncentiveType, IncentiveConfig> = {
  1: {
    Icon: Heart,
    emoji: "❤️",
    iconClassName: "text-rose-400",
    activeClassName: "text-rose-500 fill-rose-500",
    bgColor: "bg-rose-500/20",
    color: "text-rose-500",
  },
  2: {
    Icon: Flame,
    emoji: "🔥",
    iconClassName: "text-orange-400",
    activeClassName: "text-orange-500 fill-orange-500",
    bgColor: "bg-orange-500/20",
    color: "text-orange-500",
  },
  3: {
    Icon: Trophy,
    emoji: "🏆",
    iconClassName: "text-amber-400",
    activeClassName: "text-amber-500 fill-amber-500",
    bgColor: "bg-amber-500/20",
    color: "text-amber-500",
  },
  4: {
    Icon: TrendingUp,
    emoji: "📈",
    iconClassName: "text-emerald-400",
    activeClassName: "text-emerald-500",
    bgColor: "bg-emerald-500/20",
    color: "text-emerald-500",
  },
  5: {
    Icon: Dumbbell,
    emoji: "💪",
    iconClassName: "text-blue-400",
    activeClassName: "text-blue-500 fill-blue-500",
    bgColor: "bg-blue-500/20",
    color: "text-blue-500",
  },
  6: {
    Icon: Zap,
    emoji: "⚡",
    iconClassName: "text-yellow-400",
    activeClassName: "text-yellow-500 fill-yellow-500",
    bgColor: "bg-yellow-500/20",
    color: "text-yellow-500",
  },
};

/** Returns the config for a given incentive type, or undefined for unknown types. */
export function getIncentiveConfig(type: number): IncentiveConfig | undefined {
  return INCENTIVE_CONFIG[type as PostIncentiveType];
}

/**
 * Renders the Lucide icon for a given incentive type as a React element.
 * @param sizeClassName  Tailwind size classes only, e.g. "h-3.5 w-3.5". The active color is always applied automatically.
 */
export function renderIncentiveIcon(
  type: number,
  sizeClassName?: string,
  key?: React.Key,
): React.ReactNode {
  const cfg = getIncentiveConfig(type);
  if (!cfg) return null;
  const { Icon, activeClassName } = cfg;
  return React.createElement(Icon, {
    key,
    className: `${sizeClassName ?? "h-4 w-4"} ${activeClassName}`,
  });
}

export const INCENTIVE_TYPES = [1, 2, 3, 4, 5, 6] as PostIncentiveType[];
