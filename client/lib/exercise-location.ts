/**
 * Onde dá para fazer o exercício: **academia** (precisa de equipamento) ou
 * **em casa** (peso do corpo, elástico, barra fixa, TRX).
 *
 * Por que é heurística e não uma coluna: o catálogo não tem um campo confiável.
 * `workouts.equipment` está preenchida em **17 de 273** linhas (ver o cabeçalho
 * de `docs/migrations/20260812-workout-groups.sql`) e `workouts.type` — que
 * separa 1 = academia / 2 = sem equipamento — erra em alguns casos e deixa 13
 * linhas em `null`. O `type` é bom o bastante como **base**, então a regra é:
 * palavra-chave de equipamento no nome tem a palavra final; sem palavra-chave,
 * vale o `type`.
 *
 * A definição de "em casa" é a mesma que o gerador de programas usa nas flags
 * `home` do `POOLS` (`program-generator.ts`): sem peso ou máquina de academia —
 * no máximo barra fixa, TRX ou elástico, que são equipamento doméstico. Manter
 * as duas coerentes importa: o quiz "em casa" e este filtro respondem à mesma
 * pergunta do usuário.
 *
 * Validado contra as 273 linhas de catálogo em 13/08/2026: 100 "em casa", 173
 * "academia". Erra pouco e o erro é barato (o exercício aparece na aba errada;
 * "Todos" sempre mostra tudo). A correção definitiva é popular `equipment`.
 */

export type ExerciseLocation = "gym" | "home";
export type ExerciseLocationFilter = ExerciseLocation | "all";

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Equipamento que só existe (ou que na prática só se acha) em academia.
 * Vence o `type` e as palavras de casa — "Avanço com Halteres" é academia
 * mesmo com "avanço" na lista de casa.
 *
 * Cuidados de curadoria já pagos: `crossover` sozinho pegava "Hip Crossover"
 * (mobilidade de solo) — os crossovers de verdade têm "cabo" no nome; "barra"
 * sozinho pegava "Barra Fixa", por isso só as formas com complemento
 * ("com barra", "barra w"…).
 */
const GYM_MARKERS = [
  "maquina", "machine", "smith", "hammer strength", "multi press", "trap press",
  "cabo", "cable", "polia", "pulley", "graviton", "peck deck",
  "voador", "butterfly", "leg press", "hack", "cadeira ", "mesa flexora",
  "com barra", "na barra", "barra w", "barra reta", "barra curta", "barbell",
  "halter", "dumbbell", "anilha", "kettlebell", "handgrip", "landmine", "t-bar",
  "scott", "em rack", "ergometric", "esteira", "treadmill", "eliptico",
  "elliptical", "wall ball", "com peso",
  "weighted", "banco declinado", "banco inclinado", "leg curl", "aducao",
  "abducao", "hiperextensao", "extensao de lombar",
];

/** Movimentos de peso do corpo / equipamento doméstico (elástico, TRX, barra fixa). */
const HOME_MARKERS = [
  "flexao", "flexoes", "push-up", "push up", "pushup", "prancha", "plank",
  "abdominal", "crunch", "sit up", "sit-up", "barra fixa", "pull-up", "pull up",
  "chin-up", "chin up", "polichinelo", "jumping jack", "burpee",
  "mountain climber", "escalador", "ponte de gluteo", "glute bridge",
  "superman", "corrida", "running", "caminhada", "alongamento", "stretch",
  "rolo de espuma", "foam roll", "mobilidade", "elastico", "band", "trx",
  "peso do corpo", "bodyweight", "salto", "jump", "agachamento livre",
  "agachamento sumo", "agachamento isometrico", "avanco", "lunge", "afundo",
  "danca", "dance", "aerobica", "tuck planche", "remada invertida",
  "inverted row", "fundos", "dips", "paralelas", "mergulho no chao",
  "rotacao russa", "russian twist", "bird dog", "pistol", "corda",
  "postura da crianca", "joelho ao peito", "rotacao de tronco",
  "rotacao de tornozelo", "circulos", "palmas", "coice de gluteo",
  "elevacao de perna", "elevacao de pernas", "chute", "calcanhar",
];

/**
 * Classifica o exercício. Recebe o item do catálogo; `altName` (nome no outro
 * idioma) entra na conta para o filtro funcionar igual em PT e EN, já que o
 * catálogo chega localizado.
 */
export function getExerciseLocation(w: {
  name?: string | null;
  altName?: string | null;
  type?: number | null;
}): ExerciseLocation {
  const hay = normalize(`${w.name ?? ""} ${w.altName ?? ""}`);
  if (GYM_MARKERS.some((m) => hay.includes(m))) return "gym";
  if (HOME_MARKERS.some((m) => hay.includes(m))) return "home";
  return w.type === 2 ? "home" : "gym";
}

export function matchesExerciseLocation(
  w: { name?: string | null; altName?: string | null; type?: number | null },
  filter: ExerciseLocationFilter,
): boolean {
  return filter === "all" || getExerciseLocation(w) === filter;
}
