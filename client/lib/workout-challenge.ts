/**
 * Desafio de treino (2026-10-02) — tipos e regras PURAS (sem banco).
 *
 * Quem desafia manda a LISTA de exercícios (snapshot sem carga nem reps) e
 * guarda os próprios números à parte (`workout_challenge_results`, que a RLS
 * esconde do adversário até ele gravar os dele). Quando o desafiado termina, os
 * dois resultados são comparados AQUI — a mesma regra no resumo, no canvas e na
 * tela de resultado de quem desafiou.
 */

export type WorkoutChallengeExercise = {
  workoutId: string;
  name: string;
  muscleGroup: string | null;
  photo: string | null;
  /** Nº de séries que quem desafiou fez — vira o nº de linhas da sessão. */
  series: number;
  isCardio: boolean;
};

/** O que o desafiado VÊ: só o treino, nunca os números. */
export type WorkoutChallengeSnapshot = {
  routineName: string;
  items: WorkoutChallengeExercise[];
};

export type WorkoutChallengeResultExercise = {
  workoutId: string;
  name: string;
  isCardio: boolean;
  sets: number;
  /** Maior carga numa série (força). */
  bestKg: number;
  /** Repetições somadas (força) — desempate da carga. */
  reps: number;
  volumeKg: number;
  /** Distância somada (cardio: no contrato da sessão, `reps` = km). */
  km: number;
};

export type WorkoutChallengeResult = {
  exercises: WorkoutChallengeResultExercise[];
  totalVolumeKg: number;
  totalSets: number;
};

export type ChallengeSide = "challenger" | "challenged";
export type ChallengeWinner = ChallengeSide | "tie";

export type ChallengeRow = {
  workoutId: string;
  name: string;
  isCardio: boolean;
  challenger: WorkoutChallengeResultExercise | null;
  challenged: WorkoutChallengeResultExercise | null;
  winner: ChallengeWinner;
};

export type ChallengeOutcome = {
  rows: ChallengeRow[];
  challengerScore: number;
  challengedScore: number;
  winner: ChallengeWinner;
};

/** Exercício concluído do resumo (o mesmo formato de `WorkoutSummaryData`). */
type SummaryExercise = {
  name: string;
  workoutId?: string;
  totalSets: number;
  bestKg: number;
  muscleGroup: string | null;
  photo?: string | null;
  sets?: Array<{ kg: number; reps: number }>;
  isCardio?: boolean;
};

/** Snapshot do desafio a partir do treino de quem desafia (só o que foi feito). */
export function buildChallengeSnapshot(
  routineName: string,
  exercises: SummaryExercise[],
): WorkoutChallengeSnapshot {
  return {
    routineName,
    items: exercises
      .filter((e) => !!e.workoutId)
      .map((e) => ({
        workoutId: e.workoutId as string,
        name: e.name,
        muscleGroup: e.muscleGroup ?? null,
        photo: e.photo ?? null,
        series: Math.min(Math.max(e.totalSets || (e.sets?.length ?? 0) || 1, 1), 12),
        isCardio: !!e.isCardio,
      })),
  };
}

/** Os números de um lado, a partir dos exercícios concluídos do resumo. */
export function buildChallengeResult(exercises: SummaryExercise[]): WorkoutChallengeResult {
  const out: WorkoutChallengeResultExercise[] = exercises
    .filter((e) => !!e.workoutId)
    .map((e) => {
      const sets = e.sets ?? [];
      const isCardio = !!e.isCardio;
      return {
        workoutId: e.workoutId as string,
        name: e.name,
        isCardio,
        sets: e.totalSets || sets.length,
        bestKg: isCardio ? 0 : Math.max(e.bestKg || 0, ...sets.map((s) => s.kg || 0), 0),
        reps: isCardio ? 0 : sets.reduce((sum, s) => sum + (s.reps || 0), 0),
        volumeKg: isCardio ? 0 : Math.round(sets.reduce((sum, s) => sum + (s.kg || 0) * (s.reps || 0), 0)),
        km: isCardio ? Math.round(sets.reduce((sum, s) => sum + (s.reps || 0), 0) * 100) / 100 : 0,
      };
    });
  return {
    exercises: out,
    totalVolumeKg: out.reduce((sum, e) => sum + e.volumeKg, 0),
    totalSets: out.reduce((sum, e) => sum + e.sets, 0),
  };
}

function cmp(a: number, b: number): -1 | 0 | 1 {
  return a > b ? 1 : a < b ? -1 : 0;
}

/**
 * Placar exercício a exercício, na ordem do desafio:
 *  - força: maior CARGA vence; empate na carga → mais REPETIÇÕES;
 *  - cardio: maior DISTÂNCIA;
 *  - quem não fez o exercício perde aquele exercício (os dois sem → empate).
 * Vence quem ganhou mais exercícios; empate no placar → maior VOLUME total;
 * ainda igual → empate.
 */
export function compareChallenge(
  snapshot: WorkoutChallengeSnapshot,
  challenger: WorkoutChallengeResult,
  challenged: WorkoutChallengeResult,
): ChallengeOutcome {
  const find = (result: WorkoutChallengeResult, workoutId: string) =>
    result.exercises.find((e) => e.workoutId === workoutId && (e.sets > 0 || e.bestKg > 0 || e.km > 0)) ?? null;

  const rows: ChallengeRow[] = snapshot.items.map((item) => {
    const a = find(challenger, item.workoutId);
    const b = find(challenged, item.workoutId);
    let result: -1 | 0 | 1;
    if (!a && !b) result = 0;
    else if (!b) result = 1;
    else if (!a) result = -1;
    else if (item.isCardio) result = cmp(a.km, b.km);
    else result = cmp(a.bestKg, b.bestKg) || cmp(a.reps, b.reps);
    return {
      workoutId: item.workoutId,
      name: item.name,
      isCardio: item.isCardio,
      challenger: a,
      challenged: b,
      winner: result > 0 ? "challenger" : result < 0 ? "challenged" : "tie",
    };
  });

  const challengerScore = rows.filter((r) => r.winner === "challenger").length;
  const challengedScore = rows.filter((r) => r.winner === "challenged").length;
  const byScore = cmp(challengerScore, challengedScore);
  const overall = byScore || cmp(challenger.totalVolumeKg, challenged.totalVolumeKg);
  return {
    rows,
    challengerScore,
    challengedScore,
    winner: overall > 0 ? "challenger" : overall < 0 ? "challenged" : "tie",
  };
}

export function parseChallengeSnapshot(raw: unknown): WorkoutChallengeSnapshot {
  const obj = (raw ?? {}) as any;
  const items = Array.isArray(obj.items) ? obj.items : [];
  return {
    routineName: String(obj.routineName ?? ""),
    items: items
      .map((i: any) => ({
        workoutId: String(i?.workoutId ?? ""),
        name: String(i?.name ?? ""),
        muscleGroup: i?.muscleGroup ? String(i.muscleGroup) : null,
        photo: i?.photo ? String(i.photo) : null,
        series: Math.min(Math.max(Number(i?.series ?? 1) || 1, 1), 12),
        isCardio: i?.isCardio === true,
      }))
      .filter((i: WorkoutChallengeExercise) => i.workoutId),
  };
}

export function parseChallengeResult(raw: unknown): WorkoutChallengeResult {
  const obj = (raw ?? {}) as any;
  const exercises = (Array.isArray(obj.exercises) ? obj.exercises : []).map((e: any) => ({
    workoutId: String(e?.workoutId ?? ""),
    name: String(e?.name ?? ""),
    isCardio: e?.isCardio === true,
    sets: Number(e?.sets ?? 0),
    bestKg: Number(e?.bestKg ?? 0),
    reps: Number(e?.reps ?? 0),
    volumeKg: Number(e?.volumeKg ?? 0),
    km: Number(e?.km ?? 0),
  }));
  return {
    exercises,
    totalVolumeKg: Number(obj.totalVolumeKg ?? 0),
    totalSets: Number(obj.totalSets ?? 0),
  };
}
