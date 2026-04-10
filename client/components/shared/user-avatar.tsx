import * as React from "react";
import { cn } from "@/lib/utils";
import { ImageWithFallback } from "@/components/shared/image-with-fallback";

interface UserAvatarProps {
  photo?: string | null;
  gender?: string | null;
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

function getGenderAvatar(gender: string | null | undefined): string {
  if (!gender) return "/avatar-neutral.svg";
  const normalized = gender.toLowerCase().trim();
  if (normalized === "male" || normalized === "masculino" || normalized === "homem" || normalized === "m") return "/avatar-male.svg";
  if (normalized === "female" || normalized === "feminino" || normalized === "mulher" || normalized === "f") return "/avatar-female.svg";
  return "/avatar-neutral.svg";
}

/**
 * Avatar component that shows the user's photo, or a gender-based generic avatar
 * when no photo is available. Falls back to a neutral placeholder if gender is unknown.
 */
export function UserAvatar({ photo, gender, nickname, className, size = "md" }: UserAvatarProps) {
  const sizeClass = sizeClasses[size];
  const fallbackSrc = getGenderAvatar(gender);

  return (
    <ImageWithFallback
      src={photo ?? fallbackSrc}
      alt={nickname ?? "Avatar"}
      fallback={fallbackSrc}
      className={cn(sizeClass, "rounded-full object-cover flex-shrink-0", className)}
    />
  );
}
