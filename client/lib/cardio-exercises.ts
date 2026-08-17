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

// ── Leitura do campo MIN ─────────────────────────────────────────────────────
// Quem treina mais de uma hora não escreve "90" no campo MIN — escreve "1,30"
// ou "1,5" querendo dizer 1h30 / 1h50. Lido como número puro, um pedal de 1h30
// virava "1min" no resumo (e um ritmo absurdo). Aqui o valor digitado é
// convertido em MINUTOS REAIS antes de qualquer soma, exibição ou cálculo de
// ritmo/velocidade.
//
// A conversão é de LEITURA: o banco continua guardando exatamente o que a
// pessoa digitou (o campo do treino precisa reexibir o texto dela).

/**
 * Maior parte inteira que ainda é lida como HORAS. É o corte entre os dois
 * mundos: 1–5 h de cardio é plausível (pedal longo, maratona), enquanto
 * 1–5 min anotados com casa decimal não são — já "6,5" é bem mais provável ser
 * seis minutos e meio do que 6h50.
 */
const MAX_CARDIO_HOURS = 5;

/**
 * Minutos reais de um valor digitado no campo MIN de um cardio:
 * - **sem casas decimais** → já são minutos (`45` = 45min, `90` = 1h30);
 * - **parte inteira de 1 a 5 com decimais** → HORA,MINUTO, com as casas
 *   decimais lidas como o campo de minutos: `1,5` = 1h50, `1,45` = 1h45,
 *   `1,05` = 1h05 (e `1,8`, que não é minuto válido, cai para hora decimal =
 *   1h48);
 * - **qualquer outro caso** → minutos decimais, que é o que o GPS grava
 *   (`30,4` = 30,4 min ≈ 30min na exibição).
 */
export function cardioMinutesFromInput(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  const hours = Math.floor(raw);
  const frac = raw - hours;
  if (frac < 1e-9) return raw;
  if (hours < 1 || hours > MAX_CARDIO_HOURS) return raw;
  const minutes = Math.round(frac * 100);
  if (minutes >= 60) return hours * 60 + Math.round(frac * 60);
  return hours * 60 + minutes;
}

// ── Formatação ───────────────────────────────────────────────────────────────
// Formatadores puros do contrato de cardio (MIN × KM), fora do módulo de canvas
// para poderem ser usados também por telas comuns (ex.: o modal "Ver treino" do
// feed) sem arrastar junto o código de desenho dos cards.

/** "38min" ou "1h 50min" — recebe MINUTOS REAIS (ver cardioMinutesFromInput). */
export function formatCardioMinutes(minutes: number): string {
  const total = Math.round(minutes);
  if (total >= 60) {
    const h = Math.floor(total / 60);
    const m = total % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
  return `${total}min`;
}

/** "5,2" — distância sem zeros à toa, no formato decimal brasileiro. */
export function formatCardioKm(km: number): string {
  if (km >= 100) return String(Math.round(km));
  return km.toFixed(2).replace(/\.?0+$/, "").replace(".", ",");
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

// ── Elevação (inclinação da esteira) ─────────────────────────────────────────
// A esteira é a única modalidade do catálogo em que a INCLINAÇÃO é um número
// que a pessoa escolhe no aparelho e quer registrar (correr a 8 km/h com 6% não
// é o mesmo treino que a 8 km/h no plano). É um campo OPCIONAL do exercício —
// não da série —, então vive fora do contrato MIN × KM.
//
// A detecção é por NOME, como `getCardioKind`, porque é o que sobrevive nos
// snapshots persistidos (o `workout_id` não vai junto) e chega já localizado.
// Cobre os dois itens do catálogo: "Cardio na Esteira" e "Esteira".

const TREADMILL_KEYWORDS = ["esteira", "treadmill"];

/** true para "Esteira" / "Cardio na Esteira" / "Treadmill Cardio". */
export function isTreadmillExercise(name?: string | null): boolean {
  const n = normalizeName(name ?? "");
  if (!n) return false;
  return TREADMILL_KEYWORDS.some((w) => n.includes(w));
}

/** Teto de sanidade: nenhuma esteira comercial passa disso. */
export const MAX_ELEVATION_PCT = 40;

/**
 * Elevação válida a partir do que foi digitado, ou `null` quando o campo está
 * vazio/inválido — o campo é opcional, então "não informado" é um resultado
 * legítimo e nunca vira 0 (0% é uma informação diferente de "não anotei").
 * Aceita vírgula decimal (`"4,5"`) e guarda uma casa.
 */
export function parseElevationPct(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const num = typeof raw === "number" ? raw : Number(String(raw).replace(",", ".").trim());
  if (!Number.isFinite(num) || num <= 0 || num > MAX_ELEVATION_PCT) return null;
  return Math.round(num * 10) / 10;
}

/** "6%" / "4,5%" — formato decimal brasileiro, sem zeros à toa. */
export function formatElevationPct(pct: number): string {
  return `${pct.toFixed(1).replace(/\.0$/, "").replace(".", ",")}%`;
}
