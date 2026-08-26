import type {
  TrainingMode,
  UserWorkoutWithDetails,
  WorkoutPartySnapshot,
  WorkoutPartySnapshotItem,
} from "@/lib/ritmofit-db";

/**
 * Helpers de "treinar junto" (workout party) — a conversão nos dois sentidos
 * entre a rotina de quem convida e a sessão espelho de quem aceita.
 *
 * O que atravessa é o **plano** (exercícios, séries, reps sugeridas), nunca a
 * **execução**: as cargas de quem convidou não fazem sentido para quem aceitou,
 * e a coluna "ANTERIOR" do convidado continua vindo do histórico dele.
 */

/** Prefixo dos itens que só existem na sessão (sem linha em `user_workouts`). */
export const PARTY_ITEM_ID_PREFIX = "session_";

const DEFAULT_SERIES = 3;
const DEFAULT_REPS = 10;

/**
 * Converte a faixa de repetições sugerida (texto) em número. Ex.: '12'→12,
 * '8-12'→12 (limite superior). Alvos por tempo ('30s') ou até a falha não são
 * repetições contáveis → cai no padrão.
 *
 * Espelha `parseSuggestedReps` da tela de Metas — aqui de novo para o helper
 * não depender da página.
 */
function parseReps(reps: string | undefined): number {
  if (!reps) return DEFAULT_REPS;
  const s = reps.trim().toLowerCase();
  if (s.includes("s") || s.includes("min") || s.includes("fal") || s.includes("max")) {
    return DEFAULT_REPS;
  }
  const nums = s.match(/\d+/g);
  if (!nums || nums.length === 0) return DEFAULT_REPS;
  return Number(nums[nums.length - 1]);
}

/**
 * Congela o treino que será replicado. Três fontes de séries×reps, nesta ordem:
 *
 *  1. `seriesByWorkout` — as linhas que já estão na tela do host (é o caso do
 *     convite feito NO MEIO do treino: o que ele montou é o que vai);
 *  2. `suggested` — o plano da rotina (program_meta do quiz ou catálogo);
 *  3. o padrão 3×10.
 */
export function buildPartySnapshot(params: {
  routineName: string;
  trainingMode: TrainingMode;
  items: UserWorkoutWithDetails[];
  seriesByWorkout?: Record<string, Array<{ reps: number }>>;
  suggested?: Map<string, { series: number; reps: string }>;
}): WorkoutPartySnapshot {
  const { routineName, trainingMode, items, seriesByWorkout, suggested } = params;

  const snapshotItems: WorkoutPartySnapshotItem[] = items.map((item) => {
    const live = seriesByWorkout?.[item.workout_id];
    const plan = suggested?.get((item.workoutName ?? "").trim().toLowerCase());

    const series = live && live.length > 0
      ? live.length
      : plan?.series ?? DEFAULT_SERIES;
    const reps = live && live.length > 0 && live[0].reps > 0
      ? live[0].reps
      : parseReps(plan?.reps);

    return {
      workoutId: item.workout_id,
      name: item.workoutName ?? "",
      muscleGroup: item.muscle_group ?? null,
      photo: item.workoutPhoto ?? null,
      series: Math.min(Math.max(series, 1), 12),
      reps,
      restSecs: item.time_to_rest ?? null,
      technique: item.technique,
      techniqueGroup: item.technique_group ?? null,
    };
  });

  return { routineName, trainingMode, items: snapshotItems };
}

/**
 * Monta os itens da sessão do CONVIDADO a partir do snapshot.
 *
 * Os ids são sintéticos (`session_<workout_id>`) porque não existe linha em
 * `user_workouts` — o convidado não ganhou rotina nenhuma ao aceitar. É o
 * mesmo formato dos exercícios avulsos, com uma diferença tratada na sessão:
 * ao finalizar, estes **não** viram itens de rotina (ver `isPartyGuest` em
 * `WorkoutSessionDialog`). Salvar a rotina é a escolha que aparece no resumo.
 */
export function partySnapshotToSessionItems(
  snapshot: WorkoutPartySnapshot,
  userId: string,
): Array<UserWorkoutWithDetails & { kind: "workout" }> {
  return snapshot.items.map((item, index) => ({
    kind: "workout" as const,
    id: `${PARTY_ITEM_ID_PREFIX}${item.workoutId}`,
    workout_id: item.workoutId,
    user_id: userId,
    name: snapshot.routineName,
    workoutName: item.name,
    workoutPhoto: item.photo,
    muscle_group: item.muscleGroup,
    routine_id: null,
    time_to_rest: item.restSecs,
    technique: item.technique,
    technique_group: item.techniqueGroup ?? null,
    order_index: index,
  }));
}

/**
 * Séries pré-preenchidas para o convidado: a QUANTIDADE e as REPS do plano do
 * amigo, com carga zerada. A carga é pessoal — herdar a do host colocaria o
 * convidado embaixo de um peso que não é dele. A coluna "ANTERIOR" é
 * preenchida depois, pelo histórico do próprio convidado.
 */
export function partySnapshotToSeries(
  snapshot: WorkoutPartySnapshot,
): Record<string, Array<{ series: number; kg: number; reps: number; completed: boolean }>> {
  const out: Record<string, Array<{ series: number; kg: number; reps: number; completed: boolean }>> = {};
  for (const item of snapshot.items) {
    out[item.workoutId] = Array.from({ length: item.series }, (_, i) => ({
      series: i + 1,
      kg: 0,
      reps: item.reps,
      completed: false,
    }));
  }
  return out;
}
