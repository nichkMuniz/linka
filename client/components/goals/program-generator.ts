import type {
  FitnessLevel,
  ProgramWorkout,
  SuggestedExercise,
  WeeklyProgram,
} from "@/components/goals/suggested-routines-data";

/**
 * Gerador de programas de treino personalizados (quiz "Sugerido pelo app").
 *
 * Recebe as respostas do quiz de personalização e monta um `WeeklyProgram`
 * no MESMO formato do catálogo estático (`suggested-routines-data.ts`), então
 * todo o fluxo existente (preview, edição, `handleAddWeeklyProgram`, casamento
 * com o catálogo `workouts` por nome via `getWorkoutNameIdIndexDb`) continua
 * funcionando sem mudanças.
 *
 * A escolha de cada exercício é feita por PONTUAÇÃO (não por ordem fixa):
 * afinidade com o objetivo + bônus de composto por objetivo + preferência por
 * nível (máquinas para iniciantes, pesos livres para avançados) + penalidade
 * de repetição entre treinos do mesmo programa (dias A/B não repetem os mesmos
 * exercícios). 100% determinístico e client-side: mesmas respostas → mesmo
 * programa. Os nomes dos exercícios são os nomes brutos PT do catálogo
 * `workouts` (confirmados em produção), para preservar fotos e descrições.
 */

export type TrainingGoal = "hypertrophy" | "fat_loss" | "strength" | "conditioning";
export type MuscleEmphasis = "balanced" | "lower" | "upper";
export type TrainingLocation = "gym" | "home";
export type SessionMinutes = 30 | 45 | 60 | 75;

export const TRAINING_GOALS: TrainingGoal[] = [
  "hypertrophy",
  "fat_loss",
  "strength",
  "conditioning",
];
export const MUSCLE_EMPHASES: MuscleEmphasis[] = ["balanced", "lower", "upper"];
export const TRAINING_LOCATIONS: TrainingLocation[] = ["gym", "home"];
export const SESSION_MINUTES_OPTIONS: SessionMinutes[] = [30, 45, 60, 75];

export type QuizAnswers = {
  goal: TrainingGoal;
  level: FitnessLevel;
  /** dias escolhidos para treinar, índices Monday-first (0=Seg … 6=Dom), 1–6 dias */
  days: number[];
  minutes: SessionMinutes;
  emphasis: MuscleEmphasis;
  location: TrainingLocation;
};

// ── Pools de exercícios por categoria ────────────────────────────────────────
// `minLevel` gateia por nível; `gym`/`home` filtram pelo equipamento.
// `goals` = afinidade 0–3 com cada objetivo (ausente = 1): é o principal fator
// da pontuação — força puxa exercícios de barra, hipertrofia halteres/máquinas,
// emagrecimento/condicionamento movimentos circuitáveis e de peso do corpo.
// `machine` = exercício guiado: bônus para iniciante, desconto para avançado.

type SlotCategory =
  | "chest"
  | "back"
  | "quads"
  | "posterior"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "calves"
  | "core"
  | "cardio";

const LOWER_CATS: SlotCategory[] = ["quads", "posterior", "calves"];
const UPPER_CATS: SlotCategory[] = ["chest", "back", "shoulders", "biceps", "triceps"];

type PoolExercise = {
  /** nome bruto PT do catálogo `workouts` (casado case-insensitive) */
  name: string;
  muscleGroup: string;
  minLevel: 1 | 2 | 3;
  gym: boolean;
  home: boolean;
  compound?: boolean;
  /** exercício em máquina/guiado — amigável p/ iniciante, preterido p/ avançado */
  machine?: boolean;
  /** afinidade 0–3 por objetivo (ausente = 1) */
  goals?: Partial<Record<TrainingGoal, number>>;
};

const POOLS: Record<SlotCategory, PoolExercise[]> = {
  chest: [
    { name: "Supino com Halteres", muscleGroup: "Peito", minLevel: 1, gym: true, home: true, compound: true, goals: { hypertrophy: 3, strength: 2, fat_loss: 2, conditioning: 2 } },
    { name: "Supino reto", muscleGroup: "Peito", minLevel: 1, gym: true, home: false, compound: true, goals: { strength: 3, hypertrophy: 2 } },
    { name: "Supino inclinado com halteres", muscleGroup: "Peito", minLevel: 2, gym: true, home: false, compound: true, goals: { hypertrophy: 3, strength: 2 } },
    { name: "Flexão de Braço", muscleGroup: "Peito", minLevel: 1, gym: false, home: true, compound: true, goals: { fat_loss: 3, conditioning: 3 } },
    { name: "Supino na Máquina", muscleGroup: "Peito", minLevel: 1, gym: true, home: false, compound: true, machine: true, goals: { hypertrophy: 2, fat_loss: 2, conditioning: 2 } },
    { name: "Crucifixo com halteres", muscleGroup: "Peito", minLevel: 2, gym: true, home: false, goals: { hypertrophy: 2, strength: 0 } },
    { name: "Flexão Declinada", muscleGroup: "Peito", minLevel: 2, gym: false, home: true, compound: true, goals: { fat_loss: 2, conditioning: 3 } },
    { name: "Crucifixo na máquina", muscleGroup: "Peito", minLevel: 2, gym: true, home: false, machine: true, goals: { hypertrophy: 2, fat_loss: 2, strength: 0 } },
    { name: "Crossover no Cabo", muscleGroup: "Peito", minLevel: 3, gym: true, home: false, goals: { hypertrophy: 3, strength: 0 } },
  ],
  back: [
    { name: "Puxada na frente", muscleGroup: "Costas", minLevel: 1, gym: true, home: false, compound: true, machine: true, goals: { hypertrophy: 3, fat_loss: 2, conditioning: 2 } },
    { name: "Remada baixa", muscleGroup: "Costas", minLevel: 1, gym: true, home: false, compound: true, machine: true, goals: { hypertrophy: 2, fat_loss: 2, conditioning: 2 } },
    { name: "Remada curvada", muscleGroup: "Costas", minLevel: 2, gym: true, home: false, compound: true, goals: { strength: 3, hypertrophy: 2 } },
    { name: "Remada unilateral com halter", muscleGroup: "Costas", minLevel: 1, gym: true, home: true, compound: true, goals: { hypertrophy: 2, fat_loss: 2, conditioning: 2 } },
    { name: "Remada Curvada com Halteres", muscleGroup: "Costas", minLevel: 1, gym: false, home: true, compound: true, goals: { strength: 2, hypertrophy: 2, fat_loss: 2, conditioning: 2 } },
    { name: "Puxada no Pulley Pegada Fechada", muscleGroup: "Costas", minLevel: 2, gym: true, home: false, compound: true, machine: true, goals: { hypertrophy: 2 } },
    { name: "Remada na Máquina", muscleGroup: "Costas", minLevel: 1, gym: true, home: false, compound: true, machine: true, goals: { hypertrophy: 2, fat_loss: 2, conditioning: 2 } },
    { name: "Barra Fixa (Chin-up)", muscleGroup: "Costas", minLevel: 3, gym: true, home: true, compound: true, goals: { strength: 3, hypertrophy: 2, conditioning: 2 } },
    { name: "Remada Sentada no Cabo", muscleGroup: "Costas", minLevel: 2, gym: true, home: false, compound: true, machine: true, goals: { hypertrophy: 2 } },
  ],
  quads: [
    { name: "Agachamento livre", muscleGroup: "Pernas", minLevel: 1, gym: true, home: true, compound: true, goals: { strength: 3, hypertrophy: 2, fat_loss: 3, conditioning: 3 } },
    { name: "Leg press", muscleGroup: "Pernas", minLevel: 1, gym: true, home: false, compound: true, machine: true, goals: { hypertrophy: 3, fat_loss: 2, conditioning: 2 } },
    { name: "Cadeira extensora", muscleGroup: "Pernas", minLevel: 1, gym: true, home: false, machine: true, goals: { hypertrophy: 2, strength: 0 } },
    { name: "Agachamento Goblet", muscleGroup: "Pernas", minLevel: 1, gym: true, home: true, compound: true, goals: { hypertrophy: 2, fat_loss: 2, conditioning: 2 } },
    { name: "Avanço com Halteres", muscleGroup: "Pernas", minLevel: 1, gym: true, home: true, compound: true, goals: { hypertrophy: 2, fat_loss: 2, conditioning: 2 } },
    { name: "Agachamento com Barra", muscleGroup: "Pernas", minLevel: 2, gym: true, home: false, compound: true, goals: { strength: 3, hypertrophy: 3 } },
    { name: "Agachamento Búlgaro", muscleGroup: "Pernas", minLevel: 2, gym: true, home: true, compound: true, goals: { hypertrophy: 3, fat_loss: 2, conditioning: 2 } },
    { name: "Agachamento Sumô", muscleGroup: "Pernas", minLevel: 1, gym: false, home: true, compound: true, goals: { fat_loss: 2, conditioning: 2 } },
    { name: "Agachamento Split na Máquina Smith", muscleGroup: "Pernas", minLevel: 3, gym: true, home: false, compound: true, machine: true, goals: { hypertrophy: 3 } },
  ],
  posterior: [
    { name: "Mesa flexora", muscleGroup: "Pernas", minLevel: 1, gym: true, home: false, machine: true, goals: { hypertrophy: 2 } },
    { name: "Elevação de Quadril com Halter", muscleGroup: "Pernas", minLevel: 1, gym: true, home: true, compound: true, goals: { hypertrophy: 2, strength: 2, fat_loss: 2, conditioning: 2 } },
    { name: "Levantamento terra romeno", muscleGroup: "Pernas", minLevel: 2, gym: true, home: false, compound: true, goals: { strength: 3, hypertrophy: 2 } },
    { name: "Levantamento Terra Romeno com Halteres", muscleGroup: "Pernas", minLevel: 1, gym: false, home: true, compound: true, goals: { strength: 2, hypertrophy: 2, fat_loss: 2, conditioning: 2 } },
    { name: "Ponte Glúteo", muscleGroup: "Pernas", minLevel: 1, gym: false, home: true, compound: true, goals: { fat_loss: 2, conditioning: 2 } },
  ],
  shoulders: [
    { name: "Desenvolvimento com halteres", muscleGroup: "Ombros", minLevel: 1, gym: true, home: true, compound: true, goals: { hypertrophy: 2, strength: 2, fat_loss: 2, conditioning: 2 } },
    { name: "Elevação lateral", muscleGroup: "Ombros", minLevel: 1, gym: true, home: true, goals: { hypertrophy: 3, strength: 0 } },
    { name: "Desenvolvimento militar", muscleGroup: "Ombros", minLevel: 2, gym: true, home: false, compound: true, goals: { strength: 3, hypertrophy: 2 } },
    { name: "Elevação lateral na máquina", muscleGroup: "Ombros", minLevel: 2, gym: true, home: false, machine: true, goals: { hypertrophy: 2, strength: 0 } },
    { name: "Remada Alta com Halteres", muscleGroup: "Ombros", minLevel: 2, gym: true, home: true, compound: true, goals: { conditioning: 2, fat_loss: 2 } },
    { name: "Encolhimento com Halteres", muscleGroup: "Ombros", minLevel: 3, gym: true, home: true, goals: { hypertrophy: 2 } },
  ],
  biceps: [
    { name: "Rosca Direta com Barra Reta", muscleGroup: "Bíceps", minLevel: 1, gym: true, home: false, goals: { strength: 2, hypertrophy: 2 } },
    { name: "Rosca martelo", muscleGroup: "Bíceps", minLevel: 1, gym: true, home: true, goals: { hypertrophy: 2, fat_loss: 2, conditioning: 2 } },
    { name: "Rosca Martelo no Cabo", muscleGroup: "Bíceps", minLevel: 2, gym: true, home: false, machine: true, goals: { hypertrophy: 2 } },
  ],
  triceps: [
    { name: "Tríceps na Polia com Corda", muscleGroup: "Tríceps", minLevel: 1, gym: true, home: false, machine: true, goals: { hypertrophy: 2, fat_loss: 2, conditioning: 2 } },
    { name: "Tríceps francês", muscleGroup: "Tríceps", minLevel: 1, gym: true, home: true, goals: { hypertrophy: 2 } },
    { name: "Tríceps testa", muscleGroup: "Tríceps", minLevel: 2, gym: true, home: false, goals: { hypertrophy: 2 } },
    { name: "Flexão Diamante", muscleGroup: "Tríceps", minLevel: 1, gym: false, home: true, compound: true, goals: { fat_loss: 2, conditioning: 3 } },
    { name: "Supino Pegada Fechada", muscleGroup: "Tríceps", minLevel: 3, gym: true, home: false, compound: true, goals: { strength: 3, hypertrophy: 2 } },
  ],
  calves: [
    { name: "Elevação de Panturrilha em Pé", muscleGroup: "Panturrilha", minLevel: 1, gym: true, home: true, goals: { conditioning: 2 } },
  ],
  core: [
    { name: "Prancha", muscleGroup: "Abdômen", minLevel: 1, gym: true, home: true, goals: { conditioning: 3, fat_loss: 2 } },
    { name: "Abdominal Tradicional", muscleGroup: "Abdômen", minLevel: 1, gym: true, home: true, goals: { fat_loss: 2, conditioning: 2 } },
    { name: "Encolhimento Abdominal Sentado", muscleGroup: "Abdômen", minLevel: 2, gym: true, home: false, machine: true, goals: { hypertrophy: 2 } },
  ],
  // Cardio: usado APENAS como finalizador nos objetivos de queima de gordura e
  // condicionamento (último exercício de cada treino, alvo por tempo). O grupo
  // "Cardio" faz a sessão de treino registrar MIN × KM em vez de KG × REPS.
  // Nomes do seed wger (scripts/seed-exercises.mjs, categoria 15 = Cardio).
  cardio: [
    { name: "Esteira", muscleGroup: "Cardio", minLevel: 1, gym: true, home: false, machine: true, goals: { fat_loss: 3, conditioning: 3 } },
    { name: "Bicicleta Ergométrica", muscleGroup: "Cardio", minLevel: 1, gym: true, home: false, machine: true, goals: { fat_loss: 3, conditioning: 2 } },
    { name: "Elíptico", muscleGroup: "Cardio", minLevel: 1, gym: true, home: false, machine: true, goals: { fat_loss: 2, conditioning: 2 } },
    { name: "Remo Ergométrico", muscleGroup: "Cardio", minLevel: 2, gym: true, home: false, machine: true, goals: { fat_loss: 2, conditioning: 3 } },
    { name: "Corda", muscleGroup: "Cardio", minLevel: 2, gym: true, home: true, goals: { fat_loss: 2, conditioning: 3 } },
    { name: "Polichinelo", muscleGroup: "Cardio", minLevel: 1, gym: false, home: true, goals: { fat_loss: 3, conditioning: 2 } },
    { name: "Corrida com Joelhos Altos", muscleGroup: "Cardio", minLevel: 1, gym: false, home: true, goals: { fat_loss: 2, conditioning: 3 } },
    { name: "Burpee", muscleGroup: "Cardio", minLevel: 2, gym: true, home: true, goals: { fat_loss: 2, conditioning: 3 } },
  ],
};

// ── Esquema de séries/reps/descanso por objetivo ─────────────────────────────
// Reps são contagens puras (string) para o pré-preenchimento das séries
// funcionar (ver parseSuggestedReps em Goals.tsx); exceção: Prancha usa "Xs".

type Scheme = {
  series: Record<1 | 2 | 3, number>;
  compoundReps: string;
  isolationReps: string;
  coreReps: string;
  /** duração do finalizador de cardio ("Xmin") — só usado em fat_loss/conditioning */
  cardioReps: string;
  /** true = todo treino termina com um exercício de cardio */
  cardioFinisher: boolean;
  rest: { pt: string; en: string };
};

const SCHEMES: Record<TrainingGoal, Scheme> = {
  hypertrophy: {
    series: { 1: 3, 2: 4, 3: 4 },
    compoundReps: "10",
    isolationReps: "12",
    coreReps: "15",
    cardioReps: "10min",
    cardioFinisher: false,
    rest: { pt: "60–90s", en: "60–90s" },
  },
  strength: {
    series: { 1: 3, 2: 4, 3: 5 },
    compoundReps: "5",
    isolationReps: "8",
    coreReps: "15",
    cardioReps: "10min",
    cardioFinisher: false,
    rest: { pt: "2–3 min", en: "2–3 min" },
  },
  fat_loss: {
    series: { 1: 3, 2: 3, 3: 4 },
    compoundReps: "15",
    isolationReps: "15",
    coreReps: "20",
    cardioReps: "15min",
    cardioFinisher: true,
    rest: { pt: "30–60s", en: "30–60s" },
  },
  conditioning: {
    series: { 1: 3, 2: 3, 3: 4 },
    compoundReps: "12",
    isolationReps: "15",
    coreReps: "20",
    cardioReps: "12min",
    cardioFinisher: true,
    rest: { pt: "45–60s", en: "45–60s" },
  },
};

const LEVEL_NUM: Record<FitnessLevel, 1 | 2 | 3> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

const EXERCISES_BY_MINUTES: Record<SessionMinutes, number> = {
  30: 4,
  45: 5,
  60: 6,
  75: 7,
};

// ── Divisões de treino por nº de dias ────────────────────────────────────────
// Cada dia é um template com slots ordenados por prioridade (lista mais longa
// que o nº de exercícios; o corte vem do tempo por sessão).

type DayTemplate = {
  key: string;
  name: { pt: string; en: string };
  slots: SlotCategory[];
};

const FULL_SLOTS: SlotCategory[] = [
  "quads", "chest", "back", "posterior", "shoulders", "core", "biceps", "triceps", "calves",
];
const UPPER_SLOTS: SlotCategory[] = [
  "chest", "back", "shoulders", "biceps", "triceps", "chest", "core", "back",
];
const LOWER_SLOTS: SlotCategory[] = [
  "quads", "posterior", "quads", "posterior", "calves", "core", "quads", "posterior",
];
const PUSH_SLOTS: SlotCategory[] = [
  "chest", "shoulders", "chest", "triceps", "shoulders", "triceps", "core", "chest",
];
const PULL_SLOTS: SlotCategory[] = [
  "back", "back", "biceps", "back", "biceps", "core", "back", "biceps",
];
const ABC_A_SLOTS: SlotCategory[] = [
  "chest", "chest", "triceps", "chest", "triceps", "core", "chest", "triceps",
];
const ABC_C_SLOTS: SlotCategory[] = [
  "quads", "posterior", "shoulders", "quads", "shoulders", "calves", "core", "posterior",
];

const DAY_DEFS = {
  fullA: { key: "gen-full-a", name: { pt: "Treino A · Corpo Inteiro", en: "Workout A · Full Body" }, slots: FULL_SLOTS },
  fullB: { key: "gen-full-b", name: { pt: "Treino B · Corpo Inteiro", en: "Workout B · Full Body" }, slots: FULL_SLOTS },
  abcA: { key: "gen-abc-a", name: { pt: "A · Peito e Tríceps", en: "A · Chest & Triceps" }, slots: ABC_A_SLOTS },
  abcB: { key: "gen-abc-b", name: { pt: "B · Costas e Bíceps", en: "B · Back & Biceps" }, slots: PULL_SLOTS },
  abcC: { key: "gen-abc-c", name: { pt: "C · Pernas e Ombros", en: "C · Legs & Shoulders" }, slots: ABC_C_SLOTS },
  upperA: { key: "gen-upper-a", name: { pt: "Superior A", en: "Upper A" }, slots: UPPER_SLOTS },
  upperB: { key: "gen-upper-b", name: { pt: "Superior B", en: "Upper B" }, slots: UPPER_SLOTS },
  upperC: { key: "gen-upper-c", name: { pt: "Superior C", en: "Upper C" }, slots: UPPER_SLOTS },
  lowerA: { key: "gen-lower-a", name: { pt: "Inferior A", en: "Lower A" }, slots: LOWER_SLOTS },
  lowerB: { key: "gen-lower-b", name: { pt: "Inferior B", en: "Lower B" }, slots: LOWER_SLOTS },
  lowerC: { key: "gen-lower-c", name: { pt: "Inferior C", en: "Lower C" }, slots: LOWER_SLOTS },
  push: { key: "gen-push", name: { pt: "Push — Empurrar", en: "Push Day" }, slots: PUSH_SLOTS },
  pull: { key: "gen-pull", name: { pt: "Pull — Puxar", en: "Pull Day" }, slots: PULL_SLOTS },
  legs: { key: "gen-legs", name: { pt: "Legs — Pernas", en: "Leg Day" }, slots: LOWER_SLOTS },
  upper: { key: "gen-upper", name: { pt: "Superior", en: "Upper Body" }, slots: UPPER_SLOTS },
  lower: { key: "gen-lower", name: { pt: "Inferior", en: "Lower Body" }, slots: LOWER_SLOTS },
} satisfies Record<string, DayTemplate>;

/**
 * Sequência de treinos da semana (pode repetir a mesma key em dias diferentes).
 *
 * Com ênfase muscular (≥2 dias), a PRÓPRIA DIVISÃO muda: a maioria dos dias
 * vira dedicada à região em foco, alternando com dias da outra região — em vez
 * de só ganhar um exercício extra. Ex.: foco inferior com 3 dias =
 * Inferior A / Superior A / Inferior B; com 4 dias = 3 inferiores + 1 superior.
 */
function buildDaySequence(
  dayCount: number,
  level: FitnessLevel,
  emphasis: MuscleEmphasis,
): DayTemplate[] {
  const d = DAY_DEFS;
  const count = Math.min(Math.max(dayCount, 1), 6);

  if (emphasis !== "balanced" && count >= 2) {
    const focus = emphasis === "lower"
      ? [d.lowerA, d.lowerB, d.lowerC]
      : [d.upperA, d.upperB, d.upperC];
    const other = emphasis === "lower"
      ? [d.upperA, d.upperB, d.upperC]
      : [d.lowerA, d.lowerB, d.lowerC];
    // posição i → dia em foco (F), da outra região (O) ou corpo inteiro (FULL).
    // A região em foco é sempre MAIORIA da semana; com 2 dias, o segundo dia é
    // corpo inteiro (que também recebe o viés de slots da ênfase) para não
    // abandonar o resto do corpo.
    const patterns: Record<number, Array<"F" | "O" | "FULL">> = {
      2: ["F", "FULL"],
      3: ["F", "O", "F"],
      4: ["F", "O", "F", "F"],
      5: ["F", "O", "F", "O", "F"],
      6: ["F", "O", "F", "F", "O", "F"],
    };
    let f = 0;
    let o = 0;
    return patterns[count].map((slot) =>
      slot === "F" ? focus[f++ % focus.length]
      : slot === "O" ? other[o++ % other.length]
      : d.fullA,
    );
  }

  switch (count) {
    case 1:
      return [d.fullA];
    case 2:
      return [d.fullA, d.fullB];
    case 3:
      // Iniciante alterna dois treinos de corpo inteiro (frequência 2x por músculo);
      // intermediário/avançado usa a divisão ABC clássica.
      return level === "beginner" ? [d.fullA, d.fullB, d.fullA] : [d.abcA, d.abcB, d.abcC];
    case 4:
      return [d.upperA, d.lowerA, d.upperB, d.lowerB];
    case 5:
      return [d.push, d.pull, d.legs, d.upper, d.lower];
    default:
      return [d.push, d.pull, d.legs, d.push, d.pull, d.legs];
  }
}

/**
 * Ênfase muscular: move a primeira categoria em foco para o início do dia e
 * injeta uma vaga extra da região, sem zerar o restante do corpo. Dias que não
 * trabalham a região em foco (ex.: Push com ênfase inferior) ficam intactos.
 */
function applyEmphasis(slots: SlotCategory[], emphasis: MuscleEmphasis): SlotCategory[] {
  if (emphasis === "balanced") return slots;
  const focus = emphasis === "lower" ? LOWER_CATS : UPPER_CATS;
  const focusInDay = slots.filter((s) => focus.includes(s));
  if (focusInDay.length === 0) return slots;
  const out = [...slots];
  const firstIdx = out.findIndex((s) => focus.includes(s));
  const [first] = out.splice(firstIdx, 1);
  out.unshift(first);
  // vaga extra: segunda categoria em foco do dia (ou a primeira, se só há uma)
  out.splice(2, 0, focusInDay[Math.min(1, focusInDay.length - 1)]);
  return out;
}

/**
 * Pontuação de um exercício para as respostas do quiz. Quanto maior, melhor o
 * encaixe. `programUseCount` = quantas vezes o exercício já entrou em OUTROS
 * treinos deste programa (penalizado para os dias A/B variarem os estímulos).
 */
function scoreExercise(
  ex: PoolExercise,
  answers: QuizAnswers,
  programUseCount: number,
): number {
  let score = (ex.goals?.[answers.goal] ?? 1) * 3;
  // compostos valem mais — especialmente para força (base do treino) e para
  // circuitos de emagrecimento/condicionamento (mais músculos por movimento)
  if (ex.compound) {
    score += answers.goal === "strength" ? 2 : answers.goal === "hypertrophy" ? 1 : 1.5;
  }
  // máquinas: mais seguras/simples para iniciantes; avançados preferem pesos livres
  if (ex.machine) {
    score += answers.level === "beginner" ? 1.5 : answers.level === "advanced" ? -1 : 0;
  }
  // diversidade dentro do programa: já usado em outro treino → escolhe o próximo
  // melhor (os levantamentos-base de força ainda repetem entre A/B, como nos
  // programas clássicos de progressão linear — a afinidade 3 supera a penalidade)
  score -= programUseCount * 3;
  return score;
}

/** Escolhe o melhor exercício do pool para as respostas, ainda não usado no treino. */
function pickBest(
  pool: PoolExercise[],
  answers: QuizAnswers,
  usedInWorkout: Set<string>,
  programUse: Map<string, number>,
): PoolExercise | null {
  let best: PoolExercise | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < pool.length; i++) {
    const ex = pool[i];
    if (usedInWorkout.has(ex.name)) continue;
    // desempate estável: posição no pool (curadoria) vale uma fração mínima
    const score =
      scoreExercise(ex, answers, programUse.get(ex.name) ?? 0) + (pool.length - i) * 0.01;
    if (score > bestScore) {
      bestScore = score;
      best = ex;
    }
  }
  return best;
}

function repsFor(ex: PoolExercise, cat: SlotCategory, scheme: Scheme, level: FitnessLevel): string {
  if (cat === "cardio") return scheme.cardioReps;
  if (ex.name === "Prancha") return level === "beginner" ? "30s" : "45s";
  if (cat === "core") return scheme.coreReps;
  return ex.compound ? scheme.compoundReps : scheme.isolationReps;
}

function buildExercises(
  tpl: DayTemplate,
  answers: QuizAnswers,
  programUse: Map<string, number>,
): SuggestedExercise[] {
  const levelNum = LEVEL_NUM[answers.level];
  const target = EXERCISES_BY_MINUTES[answers.minutes];
  const scheme = SCHEMES[answers.goal];
  const slots = applyEmphasis(tpl.slots, answers.emphasis);
  const usedInWorkout = new Set<string>();
  const out: SuggestedExercise[] = [];

  const poolFor = (cat: SlotCategory) =>
    POOLS[cat].filter(
      (e) => (answers.location === "gym" ? e.gym : e.home) && e.minLevel <= levelNum,
    );

  // queima de gordura/condicionamento: a última vaga do treino é RESERVADA
  // para um finalizador de cardio (alvo por tempo, série única)
  const strengthTarget = scheme.cardioFinisher ? Math.max(target - 1, 3) : target;

  for (const cat of slots) {
    if (out.length >= strengthTarget) break;
    const pick = pickBest(poolFor(cat), answers, usedInWorkout, programUse);
    if (!pick) continue;
    usedInWorkout.add(pick.name);
    out.push({
      name: pick.name,
      muscleGroup: pick.muscleGroup,
      series: scheme.series[levelNum],
      reps: repsFor(pick, cat, scheme, answers.level),
    });
  }

  if (scheme.cardioFinisher) {
    const pick = pickBest(poolFor("cardio"), answers, usedInWorkout, programUse);
    if (pick) {
      usedInWorkout.add(pick.name);
      out.push({
        name: pick.name,
        muscleGroup: pick.muscleGroup,
        series: 1,
        reps: repsFor(pick, "cardio", scheme, answers.level),
      });
    }
  }

  // registra o uso no programa só ao fim do treino, para a penalidade valer
  // entre treinos (A vs B) e não dentro do próprio treino
  for (const ex of out) {
    programUse.set(ex.name, (programUse.get(ex.name) ?? 0) + 1);
  }
  return out;
}

// ── Nome e descrição do programa ─────────────────────────────────────────────

const GOAL_LABELS: Record<TrainingGoal, { pt: string; en: string }> = {
  hypertrophy: { pt: "Hipertrofia", en: "Muscle Building" },
  fat_loss: { pt: "Queima de Gordura", en: "Fat Loss" },
  strength: { pt: "Força", en: "Strength" },
  conditioning: { pt: "Condicionamento", en: "Conditioning" },
};

function splitLabel(
  dayCount: number,
  level: FitnessLevel,
  emphasis: MuscleEmphasis,
): { pt: string; en: string } {
  // com ênfase, a divisão da semana é reorganizada em torno da região em foco
  if (emphasis !== "balanced" && dayCount >= 2) {
    return emphasis === "lower"
      ? { pt: "Foco Inferior", en: "Lower Focus" }
      : { pt: "Foco Superior", en: "Upper Focus" };
  }
  switch (Math.min(Math.max(dayCount, 1), 6)) {
    case 1:
    case 2:
      return { pt: "Corpo Inteiro", en: "Full Body" };
    case 3:
      return level === "beginner"
        ? { pt: "Corpo Inteiro", en: "Full Body" }
        : { pt: "ABC", en: "ABC Split" };
    case 4:
      return { pt: "Superior/Inferior", en: "Upper/Lower" };
    case 5:
      return { pt: "Híbrido PPL", en: "PPL Hybrid" };
    default:
      return { pt: "Push/Pull/Legs", en: "Push/Pull/Legs" };
  }
}

const EMPHASIS_NOTE: Record<Exclude<MuscleEmphasis, "balanced">, { pt: string; en: string }> = {
  lower: { pt: " Ênfase em membros inferiores.", en: " Lower-body emphasis." },
  upper: { pt: " Ênfase em membros superiores.", en: " Upper-body emphasis." },
};

/** Gera o programa semanal personalizado a partir das respostas do quiz. */
export function generateProgram(answers: QuizAnswers): WeeklyProgram {
  const days = Array.from(new Set(answers.days))
    .filter((day) => day >= 0 && day <= 6)
    .sort((a, b) => a - b)
    .slice(0, 6);
  const dayCount = Math.max(days.length, 1);
  const sequence = buildDaySequence(dayCount, answers.level, answers.emphasis);

  // treinos distintos (a sequência pode repetir a mesma key, ex.: A/B/A)
  const distinct = new Map<string, DayTemplate>();
  for (const tpl of sequence) {
    if (!distinct.has(tpl.key)) distinct.set(tpl.key, tpl);
  }
  // uso de exercícios ao longo do programa — treinos posteriores evitam
  // repetir os já escolhidos (dias A/B ganham variações)
  const programUse = new Map<string, number>();
  const workouts: ProgramWorkout[] = Array.from(distinct.values()).map((tpl) => ({
    key: tpl.key,
    name: tpl.name,
    exercises: buildExercises(tpl, answers, programUse),
  }));

  const week: Array<string | null> = Array(7).fill(null);
  days.forEach((day, i) => {
    week[day] = sequence[i]?.key ?? null;
  });

  const goalLabel = GOAL_LABELS[answers.goal];
  const split = splitLabel(dayCount, answers.level, answers.emphasis);
  const rest = SCHEMES[answers.goal].rest;
  const emphasisNote =
    answers.emphasis === "balanced" ? { pt: "", en: "" } : EMPHASIS_NOTE[answers.emphasis];
  const locationNote =
    answers.location === "home"
      ? { pt: " Exercícios para treinar em casa.", en: " Home-friendly exercises." }
      : { pt: "", en: "" };

  return {
    id: `quiz-${answers.goal}-${dayCount}x-${answers.level}`,
    level: answers.level,
    name: {
      pt: `${goalLabel.pt} · ${split.pt} ${dayCount}x`,
      en: `${goalLabel.en} · ${split.en} ${dayCount}x`,
    },
    description: {
      pt: `Feito para você: ${dayCount} treino(s)/semana de ~${answers.minutes} min. Descanso entre séries: ${rest.pt}.${emphasisNote.pt}${locationNote.pt}`,
      en: `Made for you: ${dayCount} workout(s)/week, ~${answers.minutes} min each. Rest between sets: ${rest.en}.${emphasisNote.en}${locationNote.en}`,
    },
    workouts,
    week,
  };
}
