import { cn } from "@/lib/utils";
import { ImageWithFallback } from "@/components/shared/image-with-fallback";

interface UserAvatarProps {
  photo?: string | null;
  nickname?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
};

const sizePx = {
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
};

const DEFAULT_AVATAR = "/avatar-neutral.svg";

export function UserAvatar({ photo, nickname, className, size = "md" }: UserAvatarProps) {
  const sizeClass = sizeClasses[size];
  const px = sizePx[size];

  return (
    <ImageWithFallback
      src={photo ?? DEFAULT_AVATAR}
      alt={nickname ?? "Avatar"}
      fallback={DEFAULT_AVATAR}
      cdnWidth={px}
      cdnHeight={px}
      className={cn(sizeClass, "rounded-full object-cover flex-shrink-0", className)}
    />
  );
}
