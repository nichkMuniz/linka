import type {
  Routine,
  RoutineLastSummary,
  RoutineProgramMeta,
  RoutineTypeCode,
  TrainingMode,
  UserDietWithDetails,
  UserHabitWithDetails,
  UserWorkoutWithDetails,
} from "@/lib/ritmofit-db";
import { toTrainingMode } from "@/lib/ritmofit-db";
import { getSuggestedSetsForRoutine } from "@/components/goals/suggested-routines-data";

export type RoutineItem =
  | (UserWorkoutWithDetails & { kind: "workout" })
  | (UserDietWithDetails & { kind: "diet" })
  | (UserHabitWithDetails & { kind: "habit" });

/**
 * Sentinela gravada em `scheduled_days` para marcar uma rotina de treino no
 * modo **Sequencial** (rodízio sem dias fixos). As demais rotinas usam
 * `scheduled_days` com índices seg→dom (ou vazio = todo dia), então este valor
 * não-numérico convive com o parse existente — mas TODO leitor de dias deve
 * checar `isSequentialCard` ANTES de interpretar como dias da semana, senão a
 * sentinela cai no fallback "todo dia". Só treino (`type === 1`) usa isto.
 */
export const SEQUENTIAL_MARKER = "seq";

/** Rotina de treino em modo sequencial (rodízio, sem dias fixos). */
export function isSequentialCard(
  card: Pick<RoutineCard, "type" | "scheduledDays">,
): boolean {
  return (
    card.type === 1 &&
    (card.scheduledDays ?? "").trim().toLowerCase() === SEQUENTIAL_MARKER
  );
}

/** Uma execução de rotina de treino (sessão finalizada), vinda do histórico. */
export type RoutineExecution = {
  /** `routines.id` gravado no histórico (preferido — sobrevive à troca de itens). */
  routineId: string | null;
  /** `user_workouts.id` — vínculo das linhas antigas, sem `routine_id`. */
  userWorkoutId: string | null;
  /** `date_completed` (UTC naive, como o resto do histórico). */
  at: string;
};

/**
 * Estado do rodízio SEQUENCIAL (2026-10-02).
 *  - `doneKeys`: rotinas já feitas no ciclo atual → anel 100%; as demais, 0%.
 *  - `due`: a próxima do rodízio que está em 0% — é ela que o "Treino de hoje"
 *    mostra, sempre.
 * `null` quando não há rotina sequencial.
 */
export type SequentialCycle = {
  doneKeys: Set<string>;
  due: RoutineCard;
  /** Última rotina executada do rodízio (null = nenhuma ainda). */
  lastKey: string | null;
} | null;

// Ordem do rodízio = ordem de criação. `routines.id` é bigint identity, logo
// crescente com a criação; sem routineId (linha da trigger ausente) vai ao fim.
function seqOrder(card: RoutineCard): number {
  const n = card.routineId != null ? Number(card.routineId) : NaN;
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

/**
 * Ciclo do rodízio sequencial, a partir do HISTÓRICO de execuções (não só da
 * última data de cada rotina — com só ela, "Peito, Perna, Braço, Peito" e
 * "Perna, Braço, Peito" seriam iguais, e os anéis não).
 *
 * Regra (pedido do usuário, 02/10/2026): percorre as execuções em ordem,
 * juntando as rotinas feitas no ciclo. Quando o conjunto chega a TODAS as
 * rotinas, o ciclo fecha: só a que acabou de ser feita fica em 100% (marca de
 * "ciclo completo") e a próxima execução abre um ciclo novo do zero:
 *   Peito → {Peito} · Perna → {Peito, Perna} · Braço → {Braço} (Peito e Perna
 *   voltam a 0%) · Peito → {Peito} · Perna → {Peito, Perna} · Braço → {Braço} …
 *
 * A próxima (`due`) é a primeira em 0% no rodízio, a partir da que vem depois
 * da última executada. Sem execução nenhuma → a primeira criada. Com UMA
 * rotina sequencial só, ela é sempre a próxima.
 */
export function computeSequentialCycle(
  cards: RoutineCard[],
  executions: RoutineExecution[],
): SequentialCycle {
  const seq = cards.filter(isSequentialCard).sort((a, b) => seqOrder(a) - seqOrder(b));
  if (seq.length === 0) return null;

  const byRoutineId = new Map<string, string>();
  const byItemId = new Map<string, string>();
  for (const card of seq) {
    if (card.routineId) byRoutineId.set(String(card.routineId), card.key);
    for (const item of card.items) byItemId.set(String(item.id), card.key);
  }

  const events = executions
    .map((e) => ({
      key: (e.routineId && byRoutineId.get(String(e.routineId))) || (e.userWorkoutId && byItemId.get(String(e.userWorkoutId))) || null,
      at: e.at,
    }))
    .filter((e): e is { key: string; at: string } => !!e.key && !!e.at)
    .sort((a, b) => a.at.localeCompare(b.at));

  const done = new Set<string>();
  let lastKey: string | null = null;
  // O ciclo FECHOU na última execução: a que fechou fica em 100% só como marca
  // de "ciclo completo" — a próxima execução abre um ciclo NOVO do zero. Sem
  // isso a que fechou contaria também no ciclo seguinte, que fecharia com uma
  // rotina a menos e o rodízio sairia de fase (dia 5 do exemplo: só "Perna").
  let cycleClosed = false;
  for (const event of events) {
    if (event.key === lastKey) continue; // várias séries da mesma sessão
    lastKey = event.key;
    if (cycleClosed) {
      done.clear();
      cycleClosed = false;
    }
    done.add(event.key);
    if (done.size >= seq.length) {
      done.clear();
      done.add(event.key);
      cycleClosed = true;
    }
  }

  if (seq.length === 1) return { doneKeys: done, due: seq[0], lastKey };

  const lastIdx = lastKey ? seq.findIndex((c) => c.key === lastKey) : -1;
  for (let step = 1; step <= seq.length; step++) {
    const card = seq[(lastIdx + step + seq.length) % seq.length];
    if (!done.has(card.key)) return { doneKeys: done, due: card, lastKey };
  }
  return { doneKeys: done, due: seq[0], lastKey };
}

/**
 * Anel de conclusão de uma rotina: SEQUENCIAL segue o ciclo do rodízio
 * (`computeSequentialCycle`); as demais, a regra semanal de `isRoutineCompleted`.
 */
export function isRoutineDoneForRing(
  card: RoutineCard,
  routineLastDates: Record<string, string>,
  seqCycle: SequentialCycle,
): boolean {
  if (seqCycle && isSequentialCard(card)) return seqCycle.doneKeys.has(card.key);
  return isRoutineCompleted(card, routineLastDates);
}

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
  /**
   * Modo da experiência de treino escolhido na criação (`routines.training_mode`).
   * Só faz efeito em rotinas de treino (`type === 1`); dieta/hábito carregam o
   * default. Card sem linha resolvida em `routines` (`routineId === null`) cai
   * em `simple` — o comportamento clássico.
   */
  trainingMode: TrainingMode;
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
      // Deduplica por id de catálogo (workout_id/diet_id/habit_id): uma rotina
      // nunca lista o mesmo exercício/dieta/hábito duas vezes. Linhas duplicadas
      // em user_workouts (mesmo item inserido mais de uma vez) inflavam a
      // contagem — "aparecem mais exercícios do que criei". Mantém a 1ª
      // ocorrência (os itens já vêm ordenados por created_at desc).
      const seenCatalogIds = new Set<string>();
      const uniqueItems = items.filter((i: any) => {
        const cid = String(i.workout_id ?? i.diet_id ?? i.habit_id ?? i.id ?? "");
        if (!cid) return true;
        if (seenCatalogIds.has(cid)) return false;
        seenCatalogIds.add(cid);
        return true;
      });
      cards.push({
        key,
        type,
        name,
        routineId: routine?.id ?? null,
        goalId: routine?.goal_id ?? null,
        items: uniqueItems.map((i) => ({ ...i, kind }) as RoutineItem),
        scheduledTime: items.find((i: any) => i.scheduled_time)?.scheduled_time ?? null,
        scheduledDays:
          items.find((i: any) => i.scheduled_days && String(i.scheduled_days).trim())
            ?.scheduled_days ?? null,
        lastSummary: routine?.last_summary ?? null,
        programMeta: routine?.program_meta ?? null,
        trainingMode: toTrainingMode(routine?.training_mode),
      });
    }
  };

  pushCards(1, "workout", groupByName(workouts));
  pushCards(2, "diet", groupByName(diets));
  pushCards(3, "habit", groupByName(habits));

  return cards;
}

/**
 * `date_completed`/`routineLastDates` vêm de `user_workouts_hist`, coluna
 * `timestamp` SEM fuso — o Supabase devolve sem sufixo `Z`, mas os dígitos são
 * UTC (gravados via `toISOString()` ao finalizar o treino; mesma pegadinha de
 * `formatTimeAgo` em `client/lib/utils.ts`). Sem apendar o `Z`, `new Date(...)`
 * trata a string como hora LOCAL — os mesmos dígitos, sem converter nada — e
 * comparar com uma data local de verdade (`today`/`weekStartStr()`) erra
 * sempre que o treino termina à noite num fuso atrás de UTC.
 */
function localDateFromUtcNaive(raw: string): string {
  const iso = raw.endsWith("Z") || raw.includes("+") ? raw : `${raw}Z`;
  return localDateStr(new Date(iso));
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
      .map((d) => localDateFromUtcNaive(d))
      .sort()
      .pop();
    return !!lastDate && lastDate >= weekStartStr();
  }
  return card.items.length > 0 && card.items.every((i) => isCompletedToday(i as never));
}
