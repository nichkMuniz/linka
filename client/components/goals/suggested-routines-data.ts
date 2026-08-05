export type FitnessLevel = "beginner" | "intermediate" | "advanced";

export type SuggestedExercise = {
  /** matched against the workouts catalog by name (case-insensitive); created as custom when missing */
  name: string;
  muscleGroup: string;
  series: number;
  reps: string;
  /**
   * Técnica sugerida pelo gerador (bi-set, drop-set…). Ausente = série direta.
   * Só é gravada quando a rotina nasce no modo **expert** — o simplificado não
   * renderiza técnica nenhuma. Ver `assignTechniques` em `program-generator.ts`.
   */
  technique?: "biset" | "triset" | "drop" | "rest_pause";
  /** chave do bloco: exercícios com a mesma chave formam um bi-set/tri-set */
  techniqueGroup?: string;
};

/** Um treino distinto dentro de um programa semanal (vira uma rotina). */
export type ProgramWorkout = {
  /** chave interna única dentro do programa, usada no mapa da semana */
  key: string;
  name: { pt: string; en: string };
  exercises: SuggestedExercise[];
};

/**
 * Programa de treino semanal sugerido por nível.
 * `week` tem 7 posições (segunda→domingo); cada posição aponta para a `key`
 * de um treino em `workouts` ou `null` (dia de descanso).
 */
export type WeeklyProgram = {
  id: string;
  level: FitnessLevel;
  name: { pt: string; en: string };
  description: { pt: string; en: string };
  workouts: ProgramWorkout[];
  /** índice 0 = segunda … 6 = domingo */
  week: Array<string | null>;
};

export const WEEKLY_PROGRAMS: WeeklyProgram[] = [
  // ── Iniciante — Corpo Inteiro 3x (Seg / Qua / Sex) ──────────────────────
  {
    id: "beginner-fullbody-3x",
    level: "beginner",
    name: { pt: "Corpo Inteiro 3x", en: "Full Body 3x" },
    description: {
      pt: "Três sessões na semana alternando dois treinos completos. Ideal para começar com segurança.",
      en: "Three sessions a week alternating two full-body workouts. Ideal to start safely.",
    },
    workouts: [
      {
        key: "fb-a",
        name: { pt: "Corpo Inteiro A", en: "Full Body A" },
        exercises: [
          { name: "Agachamento livre", muscleGroup: "Pernas", series: 3, reps: "12" },
          { name: "Supino com Halteres", muscleGroup: "Peito", series: 3, reps: "12" },
          { name: "Remada curvada", muscleGroup: "Costas", series: 3, reps: "12" },
          { name: "Desenvolvimento com halteres", muscleGroup: "Ombros", series: 3, reps: "12" },
          { name: "Prancha", muscleGroup: "Abdômen", series: 3, reps: "30s" },
        ],
      },
      {
        key: "fb-b",
        name: { pt: "Corpo Inteiro B", en: "Full Body B" },
        exercises: [
          { name: "Leg press", muscleGroup: "Pernas", series: 3, reps: "12" },
          { name: "Puxada na frente", muscleGroup: "Costas", series: 3, reps: "12" },
          { name: "Crucifixo com halteres", muscleGroup: "Peito", series: 3, reps: "12" },
          { name: "Rosca Direta com Barra Reta", muscleGroup: "Bíceps", series: 3, reps: "12" },
          { name: "Abdominal Tradicional", muscleGroup: "Abdômen", series: 3, reps: "15" },
        ],
      },
    ],
    week: ["fb-a", null, "fb-b", null, "fb-a", null, null],
  },

  // ── Intermediário — ABC (Seg / Qua / Sex) ───────────────────────────────
  {
    id: "intermediate-abc-3x",
    level: "intermediate",
    name: { pt: "Treino ABC", en: "ABC Split" },
    description: {
      pt: "Divisão clássica em três dias: empurrar, puxar e pernas. Mais volume por grupo muscular.",
      en: "Classic three-day split: push, pull and legs. More volume per muscle group.",
    },
    workouts: [
      {
        key: "chest-tri",
        name: { pt: "A · Peito e Tríceps", en: "A · Chest & Triceps" },
        exercises: [
          { name: "Supino reto", muscleGroup: "Peito", series: 4, reps: "10" },
          { name: "Supino inclinado com halteres", muscleGroup: "Peito", series: 3, reps: "10" },
          { name: "Crucifixo na máquina", muscleGroup: "Peito", series: 3, reps: "12" },
          { name: "Tríceps na Polia com Corda", muscleGroup: "Tríceps", series: 3, reps: "12" },
          { name: "Tríceps francês", muscleGroup: "Tríceps", series: 3, reps: "12" },
        ],
      },
      {
        key: "back-bi",
        name: { pt: "B · Costas e Bíceps", en: "B · Back & Biceps" },
        exercises: [
          { name: "Puxada na frente", muscleGroup: "Costas", series: 4, reps: "10" },
          { name: "Remada baixa", muscleGroup: "Costas", series: 3, reps: "10" },
          { name: "Remada unilateral com halter", muscleGroup: "Costas", series: 3, reps: "10" },
          { name: "Rosca Direta com Barra Reta", muscleGroup: "Bíceps", series: 3, reps: "12" },
          { name: "Rosca martelo", muscleGroup: "Bíceps", series: 3, reps: "12" },
        ],
      },
      {
        key: "legs-sh",
        name: { pt: "C · Pernas e Ombros", en: "C · Legs & Shoulders" },
        exercises: [
          { name: "Agachamento livre", muscleGroup: "Pernas", series: 4, reps: "10" },
          { name: "Leg press", muscleGroup: "Pernas", series: 3, reps: "12" },
          { name: "Cadeira extensora", muscleGroup: "Pernas", series: 3, reps: "12" },
          { name: "Mesa flexora", muscleGroup: "Pernas", series: 3, reps: "12" },
          { name: "Desenvolvimento militar", muscleGroup: "Ombros", series: 3, reps: "10" },
          { name: "Elevação lateral", muscleGroup: "Ombros", series: 3, reps: "12" },
        ],
      },
    ],
    week: ["chest-tri", null, "back-bi", null, "legs-sh", null, null],
  },

  // ── Avançado — Push / Pull / Legs 6x (Seg→Sáb) ──────────────────────────
  {
    id: "advanced-ppl-6x",
    level: "advanced",
    name: { pt: "Push / Pull / Legs 6x", en: "Push / Pull / Legs 6x" },
    description: {
      pt: "Seis dias por semana repetindo empurrar, puxar e pernas. Alto volume para máximo estímulo.",
      en: "Six days a week repeating push, pull and legs. High volume for maximum stimulus.",
    },
    workouts: [
      {
        key: "push",
        name: { pt: "Push — Empurrar", en: "Push Day" },
        exercises: [
          { name: "Supino reto", muscleGroup: "Peito", series: 4, reps: "8" },
          { name: "Supino inclinado com halteres", muscleGroup: "Peito", series: 4, reps: "10" },
          { name: "Crossover no Cabo", muscleGroup: "Peito", series: 3, reps: "12" },
          { name: "Desenvolvimento militar", muscleGroup: "Ombros", series: 4, reps: "8" },
          { name: "Elevação lateral", muscleGroup: "Ombros", series: 4, reps: "12" },
          { name: "Tríceps na Polia com Corda", muscleGroup: "Tríceps", series: 4, reps: "12" },
          { name: "Tríceps testa", muscleGroup: "Tríceps", series: 3, reps: "10" },
        ],
      },
      {
        key: "pull",
        name: { pt: "Pull — Puxar", en: "Pull Day" },
        exercises: [
          { name: "Barra Fixa (Chin-up)", muscleGroup: "Costas", series: 4, reps: "8" },
          { name: "Remada curvada", muscleGroup: "Costas", series: 4, reps: "8" },
          { name: "Puxada na frente", muscleGroup: "Costas", series: 3, reps: "10" },
          { name: "Remada baixa", muscleGroup: "Costas", series: 3, reps: "10" },
          { name: "Rosca Direta com Barra Reta", muscleGroup: "Bíceps", series: 4, reps: "10" },
          { name: "Rosca martelo", muscleGroup: "Bíceps", series: 3, reps: "12" },
        ],
      },
      {
        key: "legs",
        name: { pt: "Legs — Pernas", en: "Leg Day" },
        exercises: [
          { name: "Agachamento livre", muscleGroup: "Pernas", series: 5, reps: "8" },
          { name: "Leg press", muscleGroup: "Pernas", series: 4, reps: "10" },
          { name: "Levantamento terra romeno", muscleGroup: "Pernas", series: 4, reps: "8" },
          { name: "Cadeira extensora", muscleGroup: "Pernas", series: 3, reps: "12" },
          { name: "Mesa flexora", muscleGroup: "Pernas", series: 3, reps: "12" },
          { name: "Elevação de Panturrilha em Pé", muscleGroup: "Panturrilha", series: 4, reps: "15" },
        ],
      },
    ],
    week: ["push", "pull", "legs", "push", "pull", "legs", null],
  },
];

/**
 * Mapa: nome da rotina (minúsculo, em PT e EN) → dias da semana em que ela
 * é treinada (0 = segunda … 6 = domingo). Permite ao dashboard saber qual
 * treino é o de hoje a partir do nome da rotina, sem coluna nova no banco.
 * Rotinas custom (sem correspondência) simplesmente não aparecem no mapa.
 */
export function buildRoutineWeekdayMap(): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const program of WEEKLY_PROGRAMS) {
    for (const workout of program.workouts) {
      const days: number[] = [];
      program.week.forEach((key, i) => {
        if (key === workout.key) days.push(i);
      });
      for (const name of [workout.name.pt, workout.name.en]) {
        map.set(name.trim().toLowerCase(), days);
      }
    }
  }
  return map;
}

/**
 * Nomes antigos usados pelos programas antes da unificação com o catálogo
 * `workouts` (2026-07-07) → nome atual. Rotinas criadas antes da mudança têm
 * itens custom com o nome antigo; os aliases mantêm o pré-preenchimento de
 * séries/reps funcionando para elas.
 */
const EXERCISE_ALIASES: Record<string, string> = {
  "supino reto com halteres": "supino com halteres",
  "rosca direta": "rosca direta com barra reta",
  "rosca direta na barra": "rosca direta com barra reta",
  "abdominal supra": "abdominal tradicional",
  "tríceps na polia": "tríceps na polia com corda",
  "crossover": "crossover no cabo",
  "barra fixa": "barra fixa (chin-up)",
  "panturrilha em pé": "elevação de panturrilha em pé",
};

/**
 * Dada uma rotina criada a partir de um programa (casada pelo nome), retorna o
 * mapa exercício (minúsculo) → série/reps sugeridos pelo app. Usado para
 * pré-preencher o drawer de registrar treino na primeira execução (quando ainda
 * não há histórico). Rotinas custom (sem correspondência) → mapa vazio.
 */
export function getSuggestedSetsForRoutine(
  routineName: string,
): Map<string, { series: number; reps: string }> {
  const result = new Map<string, { series: number; reps: string }>();
  const target = routineName.trim().toLowerCase();
  if (!target) return result;
  for (const program of WEEKLY_PROGRAMS) {
    for (const workout of program.workouts) {
      const names = [workout.name.pt, workout.name.en].map((n) => n.trim().toLowerCase());
      if (!names.includes(target)) continue;
      for (const ex of workout.exercises) {
        result.set(ex.name.trim().toLowerCase(), { series: ex.series, reps: ex.reps });
      }
    }
  }
  for (const [oldName, newName] of Object.entries(EXERCISE_ALIASES)) {
    const hit = result.get(newName);
    if (hit && !result.has(oldName)) result.set(oldName, hit);
  }
  return result;
}
