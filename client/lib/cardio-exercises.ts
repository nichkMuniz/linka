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
