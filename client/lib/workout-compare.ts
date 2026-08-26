// Comparação de treino: casa os exercícios de um resumo publicado no feed
// (`posts.workout_summary`) com a ÚLTIMA execução que o próprio usuário fez do
// MESMO exercício, e decide quem fez mais em cada um.
//
// Regra de ouro: comparação é sempre exercício ↔ exercício. Um supino reto só
// compara com supino reto — nunca com leg press. O casamento acontece por
// `workoutId` (catálogo `workouts`), com fallback por NOME normalizado para os
// resumos publicados antes de 26/08/2026, que não carregavam o id. O nome do
// catálogo existe em pt e en (`getWorkoutNameIdIndexDb` indexa os dois), então
// o fallback funciona mesmo quando as duas pessoas usam o app em idiomas
// diferentes.
//
// Este módulo é PURO (sem rede nem React): o drawer entrega os dois lados já
// lidos e recebe as linhas prontas.

import { sumCardioSets } from "@/lib/cardio-exercises";
import type { PostWorkoutSummary, WorkoutSummaryExercise } from "@/lib/workout-summary-types";

export type CompareSet = { kg: number; reps: number };

/** Números de UM lado (autor do post ou eu) para UM exercício. */
export type CompareSideStats = {
  /** Nº de séries registradas na sessão. */
  sets: number;
  /** Série mais pesada (empate de carga desempatado por repetições). Só força. */
  bestSet: CompareSet | null;
  /** Maior carga da sessão, em kg. Só força. */
  bestKg: number;
  /** Soma de kg × reps de todas as séries. Só força. */
  volume: number;
  /** Total de repetições da sessão. Só força. */
  reps: number;
  /** Minutos totais (cardio). Já convertidos de "1,30" = 1h30 pelo helper de cardio. */
  minutes: number;
  /** Distância total em km (cardio). */
  km: number;
};

/** Quem fez mais neste exercício. */
export type CompareWinner = "me" | "them" | "tie";

export type CompareRow = {
  /** ID do exercício no catálogo — a chave que casou os dois lados. */
  workoutId: string;
  /** Nome como aparece no post (idioma de quem treinou). */
  name: string;
  muscleGroup: string | null;
  photo: string | null;
  isCardio: boolean;
  them: CompareSideStats;
  /** `null` = eu nunca registrei este exercício → linha vai para "sem comparação". */
  me: CompareSideStats | null;
  /** Data ISO da minha última execução deste exercício. `null` quando `me` é null. */
  myDate: string | null;
  winner: CompareWinner;
  /**
   * Diferença absoluta na métrica que decidiu o vencedor — em kg (força) ou km
   * (cardio). `0` em empate ou quando quem decidiu foi um critério de
   * desempate. É o número do chip "+10kg".
   */
  delta: number;
};

export type CompareResult = {
  /** Exercícios do post que eu também já fiz, do mais pesado ao mais leve. */
  rows: CompareRow[];
  /** Exercícios do post que eu nunca registrei (listados sem confronto). */
  unmatched: CompareRow[];
  /** Quantos exercícios eu venci. */
  myWins: number;
  /** Quantos exercícios o autor do post venceu. */
  theirWins: number;
  /** Quantos terminaram empatados. */
  ties: number;
};

/**
 * Normalização do nome para o fallback de casamento: minúsculas, sem acentos e
 * sem espaço duplicado. "Supino Reto " e "supino reto" viram a mesma chave, e
 * "Elevação lateral" casa com "elevacao lateral".
 */
export function normalizeExerciseName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Re-chaveia o índice `nome → id` do catálogo com a normalização acima. */
export function buildNormalizedNameIndex(index: Map<string, string>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [name, id] of index) {
    const key = normalizeExerciseName(name);
    if (key && !out.has(key)) out.set(key, id);
  }
  return out;
}

/**
 * Descobre o id de catálogo de um exercício do resumo. Preferimos o `workoutId`
 * gravado no post; sem ele (resumo antigo) caímos no índice de nomes.
 */
export function resolveExerciseWorkoutId(
  ex: WorkoutSummaryExercise,
  normalizedNameIndex: Map<string, string>,
): string | null {
  if (ex.workoutId) return String(ex.workoutId);
  return normalizedNameIndex.get(normalizeExerciseName(ex.name)) ?? null;
}

/**
 * Resume um conjunto de séries. Cardio codifica kg = MINUTOS e reps = KM (mesma
 * convenção do resto do app — ver `isCardioExercise`), então os campos de carga
 * ficam zerados e o que vale é minutes/km.
 */
export function summarizeSets(sets: CompareSet[], isCardio: boolean): CompareSideStats {
  const stats: CompareSideStats = {
    sets: sets.length,
    bestSet: null,
    bestKg: 0,
    volume: 0,
    reps: 0,
    minutes: 0,
    km: 0,
  };
  if (isCardio) {
    const totals = sumCardioSets(sets);
    stats.minutes = totals.minutes;
    stats.km = totals.km;
    return stats;
  }
  for (const s of sets) {
    const kg = s.kg || 0;
    const reps = s.reps || 0;
    stats.volume += kg * reps;
    stats.reps += reps;
    if (kg > stats.bestKg) stats.bestKg = kg;
    // Melhor série = a mais pesada; entre séries de mesma carga, a de mais
    // repetições. É o número que as pessoas comparam de fato.
    if (
      !stats.bestSet ||
      kg > stats.bestSet.kg ||
      (kg === stats.bestSet.kg && reps > stats.bestSet.reps)
    ) {
      stats.bestSet = { kg, reps };
    }
  }
  return stats;
}

/**
 * Decide quem fez mais. Força: maior carga manda; empatou na carga, decide o
 * volume; empatou de novo, decide o total de repetições. Cardio: distância
 * manda, tempo desempata.
 *
 * Comparar por CARGA primeiro (e não por volume) é proposital: é assim que a
 * conversa acontece na academia — "quanto você pega no supino?".
 */
export function decideWinner(
  them: CompareSideStats,
  me: CompareSideStats,
  isCardio: boolean,
): { winner: CompareWinner; delta: number } {
  const pairs: Array<[number, number]> = isCardio
    ? [
        [them.km, me.km],
        [them.minutes, me.minutes],
      ]
    : [
        [them.bestKg, me.bestKg],
        [them.volume, me.volume],
        [them.reps, me.reps],
      ];

  for (let i = 0; i < pairs.length; i++) {
    const [t, m] = pairs[i];
    if (t === m) continue;
    // O delta só vira chip quando a PRIMEIRA métrica (carga / distância) decide;
    // um desempate por volume não deve aparecer como "+Xkg".
    const delta = i === 0 ? Math.abs(t - m) : 0;
    return { winner: m > t ? "me" : "them", delta };
  }
  return { winner: "tie", delta: 0 };
}

/**
 * Monta a comparação inteira: para cada exercício do post, o lado dele (as
 * séries do próprio resumo) contra o meu (minha última execução do mesmo id).
 *
 * `mySessions` vem de `getLastExerciseSessionsDb`, chaveado por workout_id.
 * Exercícios repetidos no mesmo resumo (a pessoa colocou supino duas vezes)
 * viram uma linha só — senão a MINHA sessão apareceria duas vezes e o placar
 * contaria o mesmo exercício em dobro.
 */
export function buildWorkoutComparison(
  summary: PostWorkoutSummary,
  normalizedNameIndex: Map<string, string>,
  mySessions: Record<string, { sets: CompareSet[]; date: string }>,
): CompareResult {
  type Bucket = {
    workoutId: string;
    name: string;
    muscleGroup: string | null;
    photo: string | null;
    isCardio: boolean;
    sets: CompareSet[];
  };
  const buckets = new Map<string, Bucket>();

  for (const ex of summary.exercises ?? []) {
    const workoutId = resolveExerciseWorkoutId(ex, normalizedNameIndex);
    // Sem id não há como garantir que é o MESMO exercício — e comparar por
    // aproximação é justamente o que esta feature não pode fazer.
    if (!workoutId) continue;
    const sets = (ex.sets ?? []).map((s) => ({ kg: s.kg || 0, reps: s.reps || 0 }));
    const existing = buckets.get(workoutId);
    if (existing) {
      existing.sets.push(...sets);
      continue;
    }
    buckets.set(workoutId, {
      workoutId,
      name: ex.name,
      muscleGroup: ex.muscleGroup,
      photo: ex.photo ?? null,
      isCardio: !!ex.isCardio,
      sets,
    });
  }

  const rows: CompareRow[] = [];
  const unmatched: CompareRow[] = [];
  let myWins = 0;
  let theirWins = 0;
  let ties = 0;

  for (const { sets, ...ex } of buckets.values()) {
    const them = summarizeSets(sets, ex.isCardio);
    const mine = mySessions[ex.workoutId];
    if (!mine || mine.sets.length === 0) {
      unmatched.push({ ...ex, them, me: null, myDate: null, winner: "tie", delta: 0 });
      continue;
    }
    const me = summarizeSets(mine.sets, ex.isCardio);
    const { winner, delta } = decideWinner(them, me, ex.isCardio);
    if (winner === "me") myWins++;
    else if (winner === "them") theirWins++;
    else ties++;
    rows.push({ ...ex, them, me, myDate: mine.date, winner, delta });
  }

  // Exercício mais pesado primeiro (cardio: maior distância) — a lista abre
  // pelo confronto que a pessoa mais quer ver.
  rows.sort((a, b) => {
    const av = a.isCardio
      ? Math.max(a.them.km, a.me?.km ?? 0)
      : Math.max(a.them.bestKg, a.me?.bestKg ?? 0);
    const bv = b.isCardio
      ? Math.max(b.them.km, b.me?.km ?? 0)
      : Math.max(b.them.bestKg, b.me?.bestKg ?? 0);
    return bv - av;
  });

  return { rows, unmatched, myWins, theirWins, ties };
}
