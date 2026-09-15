import { useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { LocalNotifications, type LocalNotificationSchema } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { getRoutineSchedulesDb, RoutineScheduleEntry } from "@/lib/ritmofit-db";
import { REST_NOTIF_ID } from "@/lib/workout-context";

// Mapeia o tipo textual da notificação para o código numérico usado em
// RoutineCard.key (`${RoutineTypeCode}::${name}`), permitindo abrir o drawer
// certo direto ao tocar na notificação (ver Goals.tsx, param `openRoutine`).
const ROUTINE_TYPE_CODE: Record<string, number> = { workout: 1, diet: 2, habit: 3 };

/**
 * Formats a "HH:MM" or "HH:MM:SS" time string as a display label (e.g. "07:30").
 */
export function formatScheduledTime(time: string): string {
  return time.slice(0, 5);
}

const TYPE_LABELS_PT: Record<string, string> = { workout: "Treino", diet: "Refeição", habit: "Hábito" };
const TYPE_LABELS_EN: Record<string, string> = { workout: "Workout", diet: "Meal", habit: "Habit" };
const TYPE_PLURAL_PT: Record<string, string> = { workout: "Treinos", diet: "Refeições", habit: "Hábitos" };
const TYPE_PLURAL_EN: Record<string, string> = { workout: "Workouts", diet: "Meals", habit: "Habits" };
// Como chamar os ITENS de uma rotina ("3 exercícios", não "3 Treino").
const ITEM_LABELS_PT: Record<string, string> = { workout: "exercícios", diet: "itens", habit: "hábitos" };
const ITEM_LABELS_EN: Record<string, string> = { workout: "exercises", diet: "items", habit: "habits" };
const TYPE_ICONS: Record<string, string> = { workout: "💪", diet: "🥗", habit: "✅" };

/**
 * Sentinela gravada em `scheduled_days` pelas rotinas de TREINO no modo
 * Sequencial (rodízio sem dias fixos). Duplicada aqui de propósito: importar
 * `SEQUENTIAL_MARKER` de `@/components/goals/goals-helpers` arrastaria o
 * catálogo de rotinas sugeridas para dentro do bundle do AppLayout, que monta
 * este hook em toda a aplicação. Se o valor mudar lá, muda aqui também.
 */
const SEQUENTIAL_MARKER = "seq";

/**
 * Valor de `?openRoutine=` usado pelo lembrete do rodízio sequencial. A tela de
 * Metas (Goals.tsx) troca isto pela rotina realmente devida no momento do toque
 * — a notificação foi agendada antes das conclusões que movem o rodízio.
 */
export const SEQUENTIAL_OPEN_PARAM = "seq";

// Textos do agendador. Ficam aqui (e não no i18n.ts) porque o agendador roda
// fora do React, sem acesso ao hook de idioma — lê o idioma do localStorage.
const TEXTS_PT = {
  /** rotina única, um item */
  single: "Hora da sua rotina: {type}",
  /** rotina única, vários itens no mesmo horário */
  items: "Hora da sua rotina ({n} {items})",
  /** rodízio sequencial: só uma rotina está devida, e qual depende das conclusões */
  sequential: "Hora do seu treino de hoje",
  /** 2+ rotinas diferentes no mesmo horário → um único lembrete */
  mixedTitle: "Suas rotinas",
  more: "{list} e mais {n}",
  /** fim da janela do hábito */
  endOne: "Hora de encerrar",
  endMany: "Hora de encerrar ({n} hábitos)",
};

const TEXTS_EN: typeof TEXTS_PT = {
  single: "Time for your routine: {type}",
  items: "Time for your routine ({n} {items})",
  sequential: "Time for today's workout",
  mixedTitle: "Your routines",
  more: "{list} and {n} more",
  endOne: "Time to wrap up",
  endMany: "Time to wrap up ({n} habits)",
};

type SchedulerLabels = {
  type: Record<string, string>;
  plural: Record<string, string>;
  item: Record<string, string>;
  texts: typeof TEXTS_PT;
};

function getSchedulerLabels(): SchedulerLabels {
  let isEn = false;
  try {
    isEn = (localStorage.getItem("ritmofit-language") || "pt") === "en";
  } catch {
    isEn = false;
  }
  return {
    type: isEn ? TYPE_LABELS_EN : TYPE_LABELS_PT,
    plural: isEn ? TYPE_PLURAL_EN : TYPE_PLURAL_PT,
    item: isEn ? ITEM_LABELS_EN : ITEM_LABELS_PT,
    texts: isEn ? TEXTS_EN : TEXTS_PT,
  };
}

/**
 * Requests notification permission using the native Capacitor plugin.
 * Returns "granted", "denied", or "unavailable".
 */
export async function requestNotificationPermission(): Promise<"granted" | "denied" | "unavailable"> {
  try {
    const { display } = await LocalNotifications.checkPermissions();
    if (display === "granted") return "granted";
    if (display === "denied") return "denied";
    const { display: result } = await LocalNotifications.requestPermissions();
    return result === "granted" ? "granted" : "denied";
  } catch {
    // Fallback for web/PWA context where plugin is not available
    if (!("Notification" in window)) return "unavailable";
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") return "denied";
    const result = await Notification.requestPermission();
    return result === "granted" ? "granted" : "denied";
  }
}

/**
 * Returns the next Date for a "HH:MM" or "HH:MM:SS" time string.
 * If that time already passed today, returns tomorrow's occurrence.
 */
function nextOccurrence(timeStr: string): Date {
  const [hh, mm] = timeStr.split(":").map(Number);
  const now = new Date();
  const target = new Date(now);
  target.setHours(hh, mm, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target;
}

/**
 * Parses a comma-separated list of Monday-first weekday indices (0=Mon…6=Sun)
 * into Capacitor LocalNotifications weekdays (1=Sun…7=Sat). Invalid/empty → [].
 */
function parseWeekdays(days: string): number[] {
  if (!days.trim()) return [];
  const result: number[] = [];
  for (const part of days.split(",")) {
    const mondayIdx = Number(part.trim());
    if (!Number.isInteger(mondayIdx) || mondayIdx < 0 || mondayIdx > 6) continue;
    // Monday-first idx → JS getDay (Sun=0) → Capacitor weekday (Sun=1)
    const jsDay = (mondayIdx + 1) % 7;
    result.push(jsDay + 1);
  }
  return result;
}

/**
 * Deterministic numeric ID from a routine schedule entry string ID.
 * LocalNotifications requires an integer id.
 */
function entryToNotifId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (Math.imul(31, hash) + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2_000_000;
}

/**
 * Uma rotina dentro de um horário. Vários itens da MESMA rotina (5 exercícios
 * do "Treino A") viram uma entrada só, com `count` = nº de itens.
 */
type SlotRoutine = {
  type: string;
  /** null = rodízio sequencial (não dá para nomear qual está devida) */
  name: string | null;
  count: number;
  sequential: boolean;
  url: string;
};

/** Um horário da agenda: mesma hora + mesmos dias + mesma borda da janela. */
type NotifSlot = {
  time: string;
  days: string;
  phase: "start" | "end";
  routines: Map<string, SlotRoutine>;
};

function routineUrl(type: string, name: string | null): string {
  const routineKey = `${ROUTINE_TYPE_CODE[type] ?? type}::${name ?? ""}`;
  return `/metas?openRoutine=${encodeURIComponent(routineKey)}`;
}

/**
 * Agrupa os agendamentos em horários. Duas fusões acontecem aqui:
 *
 * 1. **Itens da mesma rotina** → um lembrete só (N exercícios, 1 notificação).
 * 2. **Rotinas diferentes no mesmo horário** → um lembrete só, com os nomes no
 *    corpo. Sem isso, 3 rotinas às 07:00 disparavam 3 notificações simultâneas.
 *
 * O rodízio **sequencial** é caso especial: todas as rotinas do rodízio viram
 * UMA entrada (`__seq__`), porque só uma está devida por dia — e qual delas
 * depende das conclusões, que mudam depois do agendamento. Por isso o lembrete
 * é genérico e o toque abre a devida na hora (`openRoutine=seq`).
 */
function groupIntoSlots(schedules: RoutineScheduleEntry[]): NotifSlot[] {
  const slots = new Map<string, NotifSlot>();

  for (const e of schedules) {
    if (!e.scheduled_time) continue;
    const time = e.scheduled_time.slice(0, 5);
    const rawDays = (e.scheduled_days ?? "").trim();
    const sequential = e.type === "workout" && rawDays.toLowerCase() === SEQUENTIAL_MARKER;
    // Rodízio não tem dias fixos → todo dia (a sentinela nunca chega ao parse).
    const days = sequential ? "" : rawDays;
    const phase = e.phase ?? "start";

    // `phase` entra na chave: início e fim são lembretes distintos e não podem
    // se fundir num só, mesmo que caiam no mesmo horário.
    const slotKey = `${time}|${days}|${phase}`;
    let slot = slots.get(slotKey);
    if (!slot) {
      slot = { time, days, phase, routines: new Map() };
      slots.set(slotKey, slot);
    }

    const routineKey = sequential ? "__seq__" : `${e.type}|${e.name ?? ""}`;
    const existing = slot.routines.get(routineKey);
    if (existing) {
      existing.count += 1;
      continue;
    }
    slot.routines.set(routineKey, {
      type: e.type,
      name: sequential ? null : e.name,
      count: 1,
      sequential,
      url: sequential
        ? `/metas?openRoutine=${SEQUENTIAL_OPEN_PARAM}`
        : routineUrl(e.type, e.name),
    });
  }

  return Array.from(slots.values());
}

/** Título, corpo e destino do lembrete de um horário. */
function describeSlot(slot: NotifSlot, labels: SchedulerLabels): {
  title: string;
  body: string;
  url: string;
} {
  const { type: typeLabels, plural, item: itemLabels, texts } = labels;
  const routines = Array.from(slot.routines.values());
  const isEnd = slot.phase === "end";
  const totalItems = routines.reduce((sum, r) => sum + r.count, 0);

  // ── Um só lembrete nesse horário ──
  if (routines.length === 1) {
    const r = routines[0];
    const typeLabel = typeLabels[r.type] || "Rotina";
    const title = `${isEnd ? "🏁" : TYPE_ICONS[r.type] || "🔔"} ${r.name || typeLabel}`;
    if (isEnd) {
      return {
        title,
        body: r.count > 1 ? texts.endMany.replace("{n}", String(r.count)) : texts.endOne,
        url: r.url,
      };
    }
    if (r.sequential) {
      return { title: `${TYPE_ICONS.workout} ${typeLabel}`, body: texts.sequential, url: r.url };
    }
    return {
      title,
      body:
        r.count > 1
          ? texts.items
              .replace("{n}", String(r.count))
              .replace("{items}", itemLabels[r.type] || typeLabel)
          : texts.single.replace("{type}", typeLabel),
      url: r.url,
    };
  }

  // ── 2+ rotinas no mesmo horário → um único lembrete ──
  const types = new Set(routines.map((r) => r.type));
  const sameType = types.size === 1 ? routines[0].type : null;
  const icon = isEnd ? "🏁" : sameType ? TYPE_ICONS[sameType] || "🔔" : "🔔";
  const title = `${icon} ${
    sameType ? plural[sameType] || texts.mixedTitle : texts.mixedTitle
  }`;

  if (isEnd) {
    return { title, body: texts.endMany.replace("{n}", String(totalItems)), url: "/metas" };
  }

  // Corpo = nomes das rotinas (até 3; o resto vira "e mais N"). A entrada do
  // rodízio entra pelo rótulo do tipo, já que não se sabe qual está devida.
  const names = routines.map((r) => r.name || typeLabels[r.type] || "Rotina");
  const shown = names.slice(0, 3);
  const rest = names.length - shown.length;
  const body =
    rest > 0
      ? texts.more.replace("{list}", shown.join(", ")).replace("{n}", String(rest))
      : shown.join(", ");

  return { title, body, url: "/metas" };
}

/**
 * Schedules (or re-schedules) all routine notifications using the native plugin.
 * Cancels all previous ones first to avoid duplicates.
 * Throws if scheduling fails so the caller can surface the error.
 */
async function applySchedulesNative(schedules: RoutineScheduleEntry[]): Promise<void> {
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }
  } catch {
    // getPending/cancel may fail on first run — safe to continue
  }

  const labels = getSchedulerLabels();
  const toSchedule = groupIntoSlots(schedules).flatMap<LocalNotificationSchema>((slot) => {
    const { title, body, url } = describeSlot(slot, labels);
    const base = { title, body, extra: { url } };
    const slotKey = `${slot.time}|${slot.days}|${slot.phase}`;

    const weekdays = parseWeekdays(slot.days);
    // No weekday filter → daily repeat (backward-compatible).
    if (weekdays.length === 0) {
      return [{
        ...base,
        id: entryToNotifId(slotKey),
        schedule: { at: nextOccurrence(slot.time), repeats: true, every: "day" as const },
      }];
    }
    // One repeating notification per selected weekday.
    const [hh, mm] = slot.time.split(":").map(Number);
    return weekdays.map((capWeekday) => ({
      ...base,
      id: entryToNotifId(`${slotKey}|${capWeekday}`),
      schedule: { on: { weekday: capWeekday, hour: hh, minute: mm }, repeats: true },
    }));
  });

  if (toSchedule.length > 0) {
    await LocalNotifications.schedule({ notifications: toSchedule });
  }
}

/**
 * Hook that loads schedules for the current user and registers them
 * as native local notifications via @capacitor/local-notifications.
 * Replaces the previous Service Worker + Web Notifications approach.
 */
export function useRoutineNotifications(userId: string | null) {
  const navigate = useNavigate();
  // Tracks last sync to avoid redundant calls
  const lastSyncRef = useRef<number>(0);

  const syncAll = useCallback(async (force = false) => {
    if (!userId) return;
    // Debounce: skip if synced less than 5 seconds ago (unless forced, e.g.
    // right after the user creates/edits a routine schedule).
    const now = Date.now();
    if (!force && now - lastSyncRef.current < 5_000) return;
    lastSyncRef.current = now;

    // Respect user preference stored by settings-drawer
    try {
      const stored = localStorage.getItem("linka_notif_prefs");
      if (stored) {
        const prefs = JSON.parse(stored);
        if (prefs.workoutReminders === false) return;
      }
    } catch {}

    try {
      const permission = await requestNotificationPermission();
      if (permission !== "granted") return;
      const schedules = await getRoutineSchedulesDb(userId);
      await applySchedulesNative(schedules);
    } catch (err) {
      console.error("[notifications] sync failed:", err);
    }
  }, [userId]);

  // Sync on mount, when returning to the app (visibilitychange) and whenever a
  // routine schedule is created/edited (custom "ritmofit-routines-changed" event).
  useEffect(() => {
    syncAll();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") syncAll();
    };
    const handleRoutinesChanged = () => syncAll(true);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("ritmofit-routines-changed", handleRoutinesChanged);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("ritmofit-routines-changed", handleRoutinesChanged);
    };
  }, [syncAll]);

  // Handle notification tap → navigate to /metas (via SPA router, sem reload,
  // preservando o parâmetro `openRoutine` que abre o drawer certo).
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = LocalNotifications.addListener(
      "localNotificationActionPerformed",
      (action) => {
        // Notificação de fim de descanso tem tratamento próprio (workout-context)
        // que reabre a tela sem forçar reload — evita perder o estado do treino.
        if (action.notification.id === REST_NOTIF_ID) return;
        const url: string = action.notification.extra?.url || "/metas";
        navigate(url);
      }
    );
    return () => {
      listener.then((l) => l.remove());
    };
  }, [navigate]);

  return { syncAll };
}
