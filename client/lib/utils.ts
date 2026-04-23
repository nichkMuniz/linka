import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimeAgo(dateString: string): string {
  const now = new Date();
  // Supabase timestamps come without 'Z' suffix — append it so they're parsed as UTC
  const normalized = dateString.endsWith("Z") || dateString.includes("+") ? dateString : dateString + "Z";
  const date = new Date(normalized);
  const diffMs = now.getTime() - date.getTime();

  // Clock skew or future timestamp — treat as "agora"
  if (diffMs < 0) return "agora";

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // Same day
  if (diffDays === 0) {
    if (diffMins < 1) return "agora";
    if (diffMins < 60) return `há ${diffMins} min`;
    if (diffHours < 24) return `há ${diffHours}h`;
  }

  // Different day - show date in dd/mm/yy format
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}
