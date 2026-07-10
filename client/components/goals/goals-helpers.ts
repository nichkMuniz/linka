import type {
  Routine,
  RoutineLastSummary,
  RoutineProgramMeta,
  RoutineTypeCode,
  UserDietWithDetails,
  UserHabitWithDetails,
  UserWorkoutWithDetails,
} from "@/lib/ritmofit-db";
import { getSuggestedSetsForRoutine } from "@/components/goals/suggested-routines-data";

export type RoutineItem =
  | (UserWorkoutWithDetails & { kind: "workout" })
  | (UserDietWithDetails & { kind: "diet" })
  | (UserHabitWithDetails & { kind: "habit" });

export type RoutineCard = {
  /** `${type}::${name ?? ""}` — stable identity of the card */
  key: string;
  type: RoutineTypeCode;
  /** null = unnamed group of this type */
  name: string | null;
  /** routines.id — resolved via the items' own routine_id FK when present, else by (type, name); null when the trigger row is missing */
  routineId: string | null;
  goalId: string | null;
  items: RoutineItem[];
  /** first non-null scheduled_time among items */
  scheduledTime: string | null;
  /** first non-empty scheduled_days among items: Monday-first weekday indices "0,2,4" (null/empty = every day) */
  scheduledDays: string | null;
  /** snapshot of the most recently finished workout for this routine; null = never executed */
  lastSummary: RoutineLastSummary | null;
  /** program metadata when the routine was created by the personalization quiz; null otherwise */
  programMeta: RoutineProgramMeta | null;
};

/**
 * Séries × reps sugeridas para os exercícios de uma rotina. Prioriza o
 * `program_meta` gravado na rotina (programas gerados pelo quiz — únicos por
 * usuário); rotinas antigas caem no catálogo estático casado pelo nome
 * (`getSuggestedSetsForRoutine`). Chaves = nome do exercício em minúsculas.
 */
export function getSuggestedSetsForCard(
  card: Pick<RoutineCard, "name" | "programMeta"> | null,
): Map<string, { series: number; reps: string }> {
  const metaExercises = card?.programMeta?.exercises;
  if (metaExercises && metaExercises.length > 0) {
    const map = new Map<string, { series: number; reps: string }>();
    for (const ex of metaExercises) {
      map.set(ex.name.trim().toLowerCase(), { series: ex.series, reps: ex.reps });
    }
    return map;
  }
  return getSuggestedSetsForRoutine(card?.name ?? "");
}

function groupByName<T extends { name?: string | null }>(items: T[]): Map<string | null, T[]> {
  const map = new Map<string | null, T[]>();
  for (const item of items) {
    const key = item.name ?? null;
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return map;
}

export function buildRoutineCards(
  routines: Routine[],
  workouts: UserWorkoutWithDetails[],
  diets: UserDietWithDetails[],
  habits: UserHabitWithDetails[],
): RoutineCard[] {
  const cards: RoutineCard[] = [];

  const routineById = new Map<string, Routine>();
  const routineByTypeName = new Map<string, Routine>();
  for (const r of routines) {
    routineById.set(r.id, r);
    routineByTypeName.set(`${r.type}::${r.name ?? ""}`, r);
  }

  const pushCards = (
    type: RoutineTypeCode,
    kind: RoutineItem["kind"],
    grouped: Map<string | null, Array<UserWorkoutWithDetails | UserDietWithDetails | UserHabitWithDetails>>,
  ) => {
    for (const [name, items] of grouped) {
      const key = `${type}::${name ?? ""}`;
      // Prefer the routine_id already stamped on the items (unambiguous FK) over
      // matching by (type, name) — name-matching can resolve to the wrong row when
      // duplicate `routines` rows share the same type+name (see
      // docs/migrations/20260422-routine-id-on-items.sql), which was silently
      // pointing linked-goal routines at an unlinked duplicate.
      const itemRoutineId = (items.find((i: any) => i.routine_id) as any)?.routine_id ?? null;
      const routine =
        (itemRoutineId ? routineById.get(String(itemRoutineId)) : null) ??
        routineByTypeName.get(key) ??
        null;
      cards.push({
        key,
        type,
        name,
        routineId: routine?.id ?? null,
        goalId: routine?.goal_id ?? null,
        items: items.map((i) => ({ ...i, kind }) as RoutineItem),
        scheduledTime: items.find((i: any) => i.scheduled_time)?.scheduled_time ?? null,
        scheduledDays:
          items.find((i: any) => i.scheduled_days && String(i.scheduled_days).trim())
            ?.scheduled_days ?? null,
        lastSummary: routine?.last_summary ?? null,
        programMeta: routine?.program_meta ?? null,
      });
    }
  };

  pushCards(1, "workout", groupByName(workouts));
  pushCards(2, "diet", groupByName(diets));
  pushCards(3, "habit", groupByName(habits));

  return cards;
}

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Consecutive-day streak ending today or yesterday, from check-in history. */
export function computeStreak(history: Array<{ check_in_date: string }>): number {
  if (history.length === 0) return 0;
  const sorted = [...history].sort(
    (a, b) => new Date(b.check_in_date).getTime() - new Date(a.check_in_date).getTime(),
  );
  const today = localDateStr(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = localDateStr(yesterdayDate);

  const mostRecent = sorted[0]?.check_in_date;
  if (mostRecent !== today && mostRecent !== yesterday) return 0;

  let streak = 0;
  let current = mostRecent;
  for (const ci of sorted) {
    if (ci.check_in_date === current) {
      streak++;
      const d = new Date(current + "T12:00:00");
      d.setDate(d.getDate() - 1);
      current = localDateStr(d);
    } else break;
  }
  return streak;
}

export type WeekDayState = "done" | "missed" | "today" | "today-done" | "future";

/** Current week (Monday-first) check-in states for the streak ring. */
export function computeWeekCheckins(history: Array<{ check_in_date: string }>): {
  days: WeekDayState[];
  doneCount: number;
} {
  const checked = new Set(history.map((h) => h.check_in_date));
  const now = new Date();
  const todayStr = localDateStr(now);
  const dow = (now.getDay() + 6) % 7; // Monday = 0
  const days: WeekDayState[] = [];
  let doneCount = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - dow + i);
    const ds = localDateStr(d);
    let state: WeekDayState;
    if (ds === todayStr) state = checked.has(ds) ? "today-done" : "today";
    else if (i < dow) state = checked.has(ds) ? "done" : "missed";
    else state = "future";
    if (state === "done" || state === "today-done") doneCount++;
    days.push(state);
  }
  return { days, doneCount };
}

/** is_completed only counts when completed_at is today (local time). */
export function isCompletedToday(item: { is_completed?: boolean | null; completed_at?: string | null }): boolean {
  if (!item.is_completed || !item.completed_at) return false;
  return localDateStr(new Date(item.completed_at)) === localDateStr(new Date());
}

/** Início (segunda-feira) da semana atual, "YYYY-MM-DD". */
export function weekStartStr(now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localDateStr(d);
}

/**
 * Uma rotina conta como "concluída" para fins de progresso:
 * - treino (type 1): executado em algum dia desta semana (última execução ≥ segunda);
 * - dieta/hábito (type 2/3): todos os itens concluídos hoje.
 */
export function isRoutineCompleted(
  card: RoutineCard,
  routineLastDates: Record<string, string>,
): boolean {
  if (card.type === 1) {
    const lastDate = card.items
      .map((i) => routineLastDates[i.id])
      .filter(Boolean)
      .map((d) => d.slice(0, 10))
      .sort()
      .pop();
    return !!lastDate && lastDate >= weekStartStr();
  }
  return card.items.length > 0 && card.items.every((i) => isCompletedToday(i as never));
}
