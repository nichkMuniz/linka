import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { translations } from "./i18n";

/**
 * Idioma da interface lido do mesmo localStorage do language-context — as
 * funções daqui não são componentes e não podem usar o hook.
 */
function uiLang(): "pt" | "en" {
  try {
    return localStorage.getItem("ritmofit-language") === "en" ? "en" : "pt";
  } catch {
    return "pt";
  }
}

export function formatTimeAgo(dateString: string): string {
  const tr = translations[uiLang()];
  const now = new Date();
  // Supabase timestamps come without 'Z' suffix — append it so they're parsed as UTC
  const normalized = dateString.endsWith("Z") || dateString.includes("+") ? dateString : dateString + "Z";
  const date = new Date(normalized);
  const diffMs = now.getTime() - date.getTime();

  // Clock skew or future timestamp — treat as "agora"
  if (diffMs < 0) return tr.notif_time_now;

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // Same day
  if (diffDays === 0) {
    if (diffMins < 1) return tr.notif_time_now;
    if (diffMins < 60) return tr.time_ago_min.replace("{n}", String(diffMins));
    if (diffHours < 24) return tr.time_ago_hours.replace("{n}", String(diffHours));
  }

  // Different day - dd/mm/yy (pt) or mm/dd/yy (en)
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return uiLang() === "en" ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
}
