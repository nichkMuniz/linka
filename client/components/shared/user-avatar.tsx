import { cn } from "@/lib/utils";
import { ImageWithFallback } from "@/components/shared/image-with-fallback";

interface UserAvatarProps {
  photo?: string | null;
  nickname?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  /** Override CDN JPEG/WebP quality (20..100). Defaults to 70. */
  quality?: number;
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
  "2xl": "h-24 w-24",
};

const sizePx = {
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
  "2xl": 96,
};

const DEFAULT_AVATAR = "/avatar-neutral.svg";

export function UserAvatar({ photo, nickname, className, size = "md", quality }: UserAvatarProps) {
  const sizeClass = sizeClasses[size];
  const px = sizePx[size];

  return (
    <ImageWithFallback
      src={photo ?? DEFAULT_AVATAR}
      alt={nickname ?? "Avatar"}
      fallback={DEFAULT_AVATAR}
      cdnWidth={px}
      cdnHeight={px}
      cdnQuality={quality}
      className={cn(sizeClass, "rounded-full object-cover flex-shrink-0", className)}
    />
  );
}
