// Classificação de cardio para o modo treino.
//
// Por padrão, um exercício é "cardio" (registrado em MIN × KM) quando o grupo
// muscular é "Cardio". Alguns exercícios de cardio, porém, são feitos **no lugar**
// (estacionários — ex.: polichinelo, burpee, joelhos altos): não há deslocamento
// nem tempo a informar, então devem ser registrados como os demais exercícios
// (KG × REPS). Estes ficam nesta lista de exceção por ID de catálogo.
export const STATIONARY_CARDIO_WORKOUT_IDS = new Set<string>([
  "4fb857f2-add3-424e-ae98-763498ae1751",
  "6c08159b-8a6e-4833-ac5d-c81e02f2ecc6",
  "726e2a29-b6e5-449b-8349-f18b8d0c2722",
  "afb8964b-0e99-4998-8647-eac8cdb41b39",
]);

/**
 * Um exercício conta como cardio (MIN × KM) quando o grupo muscular é "Cardio"
 * E o exercício não está na lista de cardio estacionário. Passar o `workoutId`
 * é o que permite a exceção; sem ele, decide só pelo grupo muscular.
 */
export function isCardioExercise(
  muscleGroup: string | null | undefined,
  workoutId?: string | null,
): boolean {
  const isCardioGroup = (muscleGroup ?? "").toLowerCase() === "cardio";
  if (!isCardioGroup) return false;
  if (workoutId && STATIONARY_CARDIO_WORKOUT_IDS.has(workoutId)) return false;
  return true;
}

// ── Modalidade do cardio ─────────────────────────────────────────────────────
// O catálogo tem poucos exercícios de cardio, e cada modalidade tem uma leitura
// própria (correr tem RITMO min/km, pedalar tem VELOCIDADE km/h, corda só tem
// tempo). Classificar por nome permite que o resumo do treino gere um card
// compartilhável dedicado a cada uma — ver `cardio-canvas.ts`.
//
// A classificação é por NOME porque é o que sobrevive em todos os caminhos:
// o `workout_id` não vem nos snapshots persistidos e o nome chega localizado
// (pickLocalized), então casamos palavras-chave em PT e EN.
export type CardioKind =
  | "run"
  | "walk"
  | "bike"
  | "elliptical"
  | "rowing"
  | "jump_rope"
  | "stairs"
  | "swim"
  | "generic";

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// A ORDEM importa: "remo ergometrico" contém "ergometrico", que também é
// palavra da bicicleta — por isso remo é testado antes.
const CARDIO_KIND_KEYWORDS: Array<[CardioKind, string[]]> = [
  ["rowing", ["remo", "row", "remada ergometrica"]],
  ["jump_rope", ["corda", "rope", "skipping"]],
  ["swim", ["natacao", "nado", "swim"]],
  ["elliptical", ["eliptico", "elliptical", "cross trainer", "transport"]],
  ["bike", ["bicicleta", "bike", "ciclismo", "cycling", "spinning", "ergometrica", "ergometrico"]],
  ["stairs", ["escada", "stair", "step mill", "degrau"]],
  ["walk", ["caminhada", "caminhar", "walk", "hiking", "trilha"]],
  ["run", ["corrida", "correr", "run", "esteira", "treadmill", "trote", "jog", "sprint"]],
];

/**
 * Modalidade de um exercício de cardio a partir do nome. Sempre devolve algo —
 * o que não casar com nenhuma palavra-chave (exercício personalizado com nome
 * criativo) cai em `generic`, que tem card próprio genérico de cardio.
 *
 * Não decide se o exercício É cardio: para isso use `isCardioExercise`.
 */
export function getCardioKind(name?: string | null): CardioKind {
  const n = normalizeName(name ?? "");
  if (!n) return "generic";
  for (const [kind, words] of CARDIO_KIND_KEYWORDS) {
    if (words.some((w) => n.includes(w))) return kind;
  }
  return "generic";
}
