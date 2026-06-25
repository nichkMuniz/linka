import { cn } from "@/lib/utils";

interface VerifiedBadgeProps {
  /** Size variant: "sm" (12px), "md" (16px, default), "lg" (20px) */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: { outer: "w-3.5 h-3.5", inner: "w-2 h-2" },
  md: { outer: "w-4 h-4", inner: "w-2.5 h-2.5" },
  lg: { outer: "w-5 h-5", inner: "w-3 h-3" },
};

/**
 * Golden verified badge shown beside nicknames of official/verified accounts.
 * Renders nothing when `show` is false — callers gate on `isVerified`.
 */
export function VerifiedBadge({ size = "md", className }: VerifiedBadgeProps) {
  const s = sizeMap[size];

  return (
    <span
      title="Conta oficial verificada"
      aria-label="Conta verificada"
      className={cn("inline-flex items-center justify-center shrink-0", s.outer, className)}
    >
      {/* Golden circle with checkmark */}
      <svg
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        aria-hidden="true"
      >
        {/* Outer golden circle */}
        <circle cx="10" cy="10" r="10" fill="url(#gold-gradient)" />
        {/* Inner white/dark checkmark */}
        <path
          d="M6 10.5L8.5 13L14 7.5"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="gold-gradient" x1="0" y1="0" x2="20" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFB800" />
            <stop offset="100%" stopColor="#FF8A2A" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  );
}
