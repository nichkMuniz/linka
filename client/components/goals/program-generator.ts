import type {
  CoachNote,
  FitnessLevel,
  ProgramWorkout,
  SuggestedExercise,
  WeeklyProgram,
} from "@/components/goals/suggested-routines-data";
import {
  NEUTRAL_COACH_PROFILE,
  type CoachProfile,
  type JointRestriction,
} from "@/lib/coach-profile";

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
 *
 * ## O corpo do usuário entra na conta (`CoachProfile`)
 *
 * As respostas do quiz dizem o que a pessoa QUER; o `CoachProfile`
 * (`client/lib/coach-profile.ts`) diz o que o corpo dela SUPORTA — sexo, idade,
 * IMC, tendência de peso e restrições articulares. Ele age em quatro frentes:
 *
 *  1. **Veto** — restrição articular remove o exercício do pool. Veto é
 *     absoluto: nenhuma pontuação alta reabilita um exercício contraindicado.
 *  2. **Pontuação** — máquina ganha peso para quem tem muita massa a mover,
 *     idade avançada ou articulação em cuidado; impacto perde peso.
 *  3. **Dose** — séries, repetições e descanso saem do esquema do objetivo e
 *     são ajustados por idade/sexo/IMC.
 *  4. **Explicação** — cada ajuste que REALMENTE aconteceu vira uma nota em
 *     `coachNotes`, exibida no preview. Nota sem decisão por trás é proibida.
 *
 * A doutrina completa está em `skills/personal-trainer-agent.md`.
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
  /**
   * Corpo do usuário traduzido em modificadores de prescrição. Ausente = perfil
   * neutro (usuário sem dados físicos) — o gerador continua funcionando
   * exatamente como antes de 13/08/2026.
   */
  coach?: CoachProfile;
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
  /**
   * Articulações que este exercício exige de forma que **contraindica** o
   * movimento para quem declarou cuidado com elas. Não é "usa o joelho" (todo
   * agachamento usa) — é "sob dor articular, este é o que sai da ficha".
   * Quem tem a restrição nunca recebe o exercício: veto, não desconto.
   */
  joints?: JointRestriction[];
  /**
   * Pliométrico/impacto repetitivo (salto, corrida no lugar, burpee). A força de
   * reação do solo escala com a massa corporal — é o primeiro item a sair para
   * IMC alto, 55+ ou joelho/lombar em cuidado.
   */
  impact?: boolean;
};

// `home: true` = pode ser feito EM CASA sem peso/máquina de academia (peso do
// corpo, ou no máximo barra fixa/TRX/elástico — equipamento doméstico). NÃO
// depende da coluna `workouts.type`, que está poluída com alongamento/mobilidade
// e não cobre puxada (ver decisão de 20/07/2026). Exercícios com halter, barra
// carregada, cabo ou máquina têm `home: false`. Cada categoria mantém ao menos
// uma opção `home` de `minLevel: 1`, para o programa em casa fechar todos os
// grupos em qualquer nível. Nomes novos preferem o catálogo (foto); quando não
// há equivalente caseiro no catálogo, o gerador cria custom sem foto.
const POOLS: Record<SlotCategory, PoolExercise[]> = {
  chest: [
    { name: "Supino com Halteres", muscleGroup: "Peito", minLevel: 1, gym: true, home: false, compound: true, goals: { hypertrophy: 3, strength: 2, fat_loss: 2, conditioning: 2 } },
    { name: "Supino reto", muscleGroup: "Peito", minLevel: 1, gym: true, home: false, compound: true, goals: { strength: 3, hypertrophy: 2 }, joints: ["shoulder", "wrist"] },
    { name: "Supino inclinado com halteres", muscleGroup: "Peito", minLevel: 2, gym: true, home: false, compound: true, goals: { hypertrophy: 3, strength: 2 } },
    { name: "Flexão de Braço", muscleGroup: "Peito", minLevel: 1, gym: false, home: true, compound: true, goals: { fat_loss: 3, conditioning: 3, hypertrophy: 2 }, joints: ["wrist"] },
    { name: "Supino na Máquina", muscleGroup: "Peito", minLevel: 1, gym: true, home: false, compound: true, machine: true, goals: { hypertrophy: 2, fat_loss: 2, conditioning: 2 } },
    { name: "Crucifixo com halteres", muscleGroup: "Peito", minLevel: 2, gym: true, home: false, goals: { hypertrophy: 2, strength: 0 }, joints: ["shoulder"] },
    { name: "Flexão Declinada", muscleGroup: "Peito", minLevel: 2, gym: false, home: true, compound: true, goals: { fat_loss: 2, conditioning: 3, hypertrophy: 2 }, joints: ["wrist", "shoulder"] },
    { name: "Flexão Inclinada", muscleGroup: "Peito", minLevel: 1, gym: false, home: true, compound: true, goals: { fat_loss: 2, conditioning: 2, hypertrophy: 1 }, joints: ["wrist"] },
    { name: "Crucifixo na máquina", muscleGroup: "Peito", minLevel: 2, gym: true, home: false, machine: true, goals: { hypertrophy: 2, fat_loss: 2, strength: 0 } },
    { name: "Crossover no Cabo", muscleGroup: "Peito", minLevel: 3, gym: true, home: false, goals: { hypertrophy: 3, strength: 0 }, joints: ["shoulder"] },
  ],
  back: [
    { name: "Puxada na frente", muscleGroup: "Costas", minLevel: 1, gym: true, home: false, compound: true, machine: true, goals: { hypertrophy: 3, fat_loss: 2, conditioning: 2 } },
    { name: "Remada baixa", muscleGroup: "Costas", minLevel: 1, gym: true, home: false, compound: true, machine: true, goals: { hypertrophy: 2, fat_loss: 2, conditioning: 2 } },
    { name: "Remada curvada", muscleGroup: "Costas", minLevel: 2, gym: true, home: false, compound: true, goals: { strength: 3, hypertrophy: 2 }, joints: ["lower_back"] },
    { name: "Remada unilateral com halter", muscleGroup: "Costas", minLevel: 1, gym: true, home: false, compound: true, goals: { hypertrophy: 2, fat_loss: 2, conditioning: 2 } },
    { name: "Remada Curvada com Halteres", muscleGroup: "Costas", minLevel: 1, gym: false, home: false, compound: true, goals: { strength: 2, hypertrophy: 2, fat_loss: 2, conditioning: 2 }, joints: ["lower_back"] },
    { name: "Puxada no Pulley Pegada Fechada", muscleGroup: "Costas", minLevel: 2, gym: true, home: false, compound: true, machine: true, goals: { hypertrophy: 2 } },
    { name: "Remada na Máquina", muscleGroup: "Costas", minLevel: 1, gym: true, home: false, compound: true, machine: true, goals: { hypertrophy: 2, fat_loss: 2, conditioning: 2 } },
    { name: "Barra Fixa (Chin-up)", muscleGroup: "Costas", minLevel: 3, gym: true, home: true, compound: true, goals: { strength: 3, hypertrophy: 2, conditioning: 2 }, joints: ["shoulder"] },
    { name: "Remada Sentada no Cabo", muscleGroup: "Costas", minLevel: 2, gym: true, home: false, compound: true, machine: true, goals: { hypertrophy: 2 } },
    // Caseiros (peso do corpo / barra ou TRX de casa):
    { name: "Remada Invertida", muscleGroup: "Costas", minLevel: 1, gym: false, home: true, compound: true, goals: { strength: 2, hypertrophy: 2, fat_loss: 2, conditioning: 2 } },
    { name: "Superman", muscleGroup: "Costas", minLevel: 1, gym: false, home: true, goals: { conditioning: 2, fat_loss: 1 }, joints: ["lower_back"] },
  ],
  quads: [
    { name: "Agachamento livre", muscleGroup: "Pernas", minLevel: 1, gym: true, home: true, compound: true, goals: { strength: 3, hypertrophy: 2, fat_loss: 3, conditioning: 3 }, joints: ["knee", "lower_back"] },
    { name: "Leg press", muscleGroup: "Pernas", minLevel: 1, gym: true, home: false, compound: true, machine: true, goals: { hypertrophy: 3, fat_loss: 2, conditioning: 2 } },
    { name: "Cadeira extensora", muscleGroup: "Pernas", minLevel: 1, gym: true, home: false, machine: true, goals: { hypertrophy: 2, strength: 0 }, joints: ["knee"] },
    { name: "Agachamento Goblet", muscleGroup: "Pernas", minLevel: 1, gym: true, home: false, compound: true, goals: { hypertrophy: 2, fat_loss: 2, conditioning: 2 } },
    { name: "Avanço com Halteres", muscleGroup: "Pernas", minLevel: 1, gym: true, home: false, compound: true, goals: { hypertrophy: 2, fat_loss: 2, conditioning: 2 }, joints: ["knee"] },
    { name: "Agachamento com Barra", muscleGroup: "Pernas", minLevel: 2, gym: true, home: false, compound: true, goals: { strength: 3, hypertrophy: 3 }, joints: ["knee", "lower_back"] },
    { name: "Agachamento Búlgaro", muscleGroup: "Pernas", minLevel: 2, gym: true, home: true, compound: true, goals: { hypertrophy: 3, fat_loss: 2, conditioning: 2 }, joints: ["knee"] },
    { name: "Agachamento Sumô", muscleGroup: "Pernas", minLevel: 1, gym: false, home: true, compound: true, goals: { fat_loss: 2, conditioning: 2 }, joints: ["knee"] },
    { name: "Avanço", muscleGroup: "Pernas", minLevel: 1, gym: false, home: true, compound: true, goals: { fat_loss: 2, conditioning: 2, hypertrophy: 1 }, joints: ["knee"] },
    { name: "Agachamento Split na Máquina Smith", muscleGroup: "Pernas", minLevel: 3, gym: true, home: false, compound: true, machine: true, goals: { hypertrophy: 3 }, joints: ["knee"] },
    // Isométrico: a opção que SOBREVIVE ao veto de joelho (academia e casa).
    // Sem ele, quem marca cuidado com o joelho fica sem nenhum estímulo de
    // quadríceps em casa — isometria de meio agachamento é justamente o que se
    // usa quando a articulação não tolera amplitude sob carga.
    { name: "Agachamento Isométrico", muscleGroup: "Pernas", minLevel: 1, gym: true, home: true, goals: { conditioning: 2, fat_loss: 2, hypertrophy: 1 } },
  ],
  posterior: [
    { name: "Mesa flexora", muscleGroup: "Pernas", minLevel: 1, gym: true, home: false, machine: true, goals: { hypertrophy: 2 } },
    { name: "Elevação de Quadril com Halter", muscleGroup: "Pernas", minLevel: 1, gym: true, home: false, compound: true, goals: { hypertrophy: 2, strength: 2, fat_loss: 2, conditioning: 2 } },
    { name: "Levantamento terra romeno", muscleGroup: "Pernas", minLevel: 2, gym: true, home: false, compound: true, goals: { strength: 3, hypertrophy: 2 }, joints: ["lower_back"] },
    { name: "Levantamento Terra Romeno com Halteres", muscleGroup: "Pernas", minLevel: 1, gym: false, home: false, compound: true, goals: { strength: 2, hypertrophy: 2, fat_loss: 2, conditioning: 2 }, joints: ["lower_back"] },
    { name: "Ponte de Glúteo", muscleGroup: "Pernas", minLevel: 1, gym: false, home: true, compound: true, goals: { fat_loss: 2, conditioning: 2, hypertrophy: 1 } },
    { name: "Avanço Reverso", muscleGroup: "Pernas", minLevel: 1, gym: false, home: true, compound: true, goals: { fat_loss: 2, conditioning: 2, hypertrophy: 1 }, joints: ["knee"] },
  ],
  shoulders: [
    { name: "Desenvolvimento com halteres", muscleGroup: "Ombros", minLevel: 1, gym: true, home: false, compound: true, goals: { hypertrophy: 2, strength: 2, fat_loss: 2, conditioning: 2 } },
    { name: "Elevação lateral", muscleGroup: "Ombros", minLevel: 1, gym: true, home: false, goals: { hypertrophy: 3, strength: 0 } },
    { name: "Desenvolvimento militar", muscleGroup: "Ombros", minLevel: 2, gym: true, home: false, compound: true, goals: { strength: 3, hypertrophy: 2 }, joints: ["shoulder", "lower_back"] },
    { name: "Elevação lateral na máquina", muscleGroup: "Ombros", minLevel: 2, gym: true, home: false, machine: true, goals: { hypertrophy: 2, strength: 0 } },
    { name: "Remada Alta com Halteres", muscleGroup: "Ombros", minLevel: 2, gym: true, home: false, compound: true, goals: { conditioning: 2, fat_loss: 2 }, joints: ["shoulder"] },
    { name: "Encolhimento com Halteres", muscleGroup: "Ombros", minLevel: 3, gym: true, home: false, goals: { hypertrophy: 2 } },
    // Caseiros (peso do corpo):
    { name: "Flexão Hindu", muscleGroup: "Ombros", minLevel: 1, gym: false, home: true, compound: true, goals: { conditioning: 2, fat_loss: 2, hypertrophy: 1 }, joints: ["shoulder", "wrist"] },
    { name: "Tuck Planche", muscleGroup: "Ombros", minLevel: 3, gym: false, home: true, goals: { conditioning: 2, hypertrophy: 1 }, joints: ["shoulder", "wrist"] },
  ],
  biceps: [
    { name: "Rosca Direta com Barra Reta", muscleGroup: "Bíceps", minLevel: 1, gym: true, home: false, goals: { strength: 2, hypertrophy: 2 }, joints: ["wrist"] },
    { name: "Rosca martelo", muscleGroup: "Bíceps", minLevel: 1, gym: true, home: false, goals: { hypertrophy: 2, fat_loss: 2, conditioning: 2 } },
    { name: "Rosca Martelo no Cabo", muscleGroup: "Bíceps", minLevel: 2, gym: true, home: false, machine: true, goals: { hypertrophy: 2 } },
    // Caseiro (TRX/elástico de casa):
    { name: "Rosca Bíceps no TRX", muscleGroup: "Bíceps", minLevel: 1, gym: false, home: true, goals: { hypertrophy: 2, conditioning: 1 } },
  ],
  triceps: [
    { name: "Tríceps na Polia com Corda", muscleGroup: "Tríceps", minLevel: 1, gym: true, home: false, machine: true, goals: { hypertrophy: 2, fat_loss: 2, conditioning: 2 } },
    { name: "Tríceps francês", muscleGroup: "Tríceps", minLevel: 1, gym: true, home: false, goals: { hypertrophy: 2 }, joints: ["shoulder"] },
    { name: "Tríceps testa", muscleGroup: "Tríceps", minLevel: 2, gym: true, home: false, goals: { hypertrophy: 2 } },
    { name: "Flexão Diamante", muscleGroup: "Tríceps", minLevel: 1, gym: false, home: true, compound: true, goals: { fat_loss: 2, conditioning: 3, hypertrophy: 2 }, joints: ["wrist"] },
    { name: "Tríceps no Banco", muscleGroup: "Tríceps", minLevel: 1, gym: false, home: true, goals: { fat_loss: 2, conditioning: 2, hypertrophy: 1 }, joints: ["wrist", "shoulder"] },
    { name: "Supino Pegada Fechada", muscleGroup: "Tríceps", minLevel: 3, gym: true, home: false, compound: true, goals: { strength: 3, hypertrophy: 2 }, joints: ["wrist"] },
  ],
  calves: [
    { name: "Elevação de Panturrilha em Pé", muscleGroup: "Panturrilha", minLevel: 1, gym: true, home: true, goals: { conditioning: 2 } },
  ],
  core: [
    // Prancha e prancha lateral são as sobreviventes do veto de lombar de
    // propósito: sob cuidado lombar, isometria antissegmentar é exatamente o
    // que substitui a flexão repetida de coluna.
    { name: "Prancha", muscleGroup: "Abdômen", minLevel: 1, gym: true, home: true, goals: { conditioning: 3, fat_loss: 2 } },
    { name: "Abdominal Tradicional", muscleGroup: "Abdômen", minLevel: 1, gym: true, home: true, goals: { fat_loss: 2, conditioning: 2 }, joints: ["lower_back"] },
    { name: "Prancha Lateral", muscleGroup: "Abdômen", minLevel: 1, gym: false, home: true, goals: { conditioning: 2 } },
    { name: "Abdominal Bicicleta", muscleGroup: "Abdômen", minLevel: 1, gym: false, home: true, goals: { fat_loss: 2, conditioning: 2 }, joints: ["lower_back"] },
    { name: "Encolhimento Abdominal Sentado", muscleGroup: "Abdômen", minLevel: 2, gym: true, home: false, machine: true, goals: { hypertrophy: 2 }, joints: ["lower_back"] },
  ],
  // Cardio: usado APENAS como finalizador nos objetivos de queima de gordura e
  // condicionamento (último exercício de cada treino, alvo por tempo). O grupo
  // "Cardio" faz a sessão de treino registrar MIN × KM em vez de KG × REPS.
  // Nomes do seed wger (scripts/seed-exercises.mjs, categoria 15 = Cardio).
  cardio: [
    { name: "Esteira", muscleGroup: "Cardio", minLevel: 1, gym: true, home: false, machine: true, goals: { fat_loss: 3, conditioning: 3 } },
    { name: "Bicicleta Ergométrica", muscleGroup: "Cardio", minLevel: 1, gym: true, home: false, machine: true, goals: { fat_loss: 3, conditioning: 2 } },
    { name: "Elíptico", muscleGroup: "Cardio", minLevel: 1, gym: true, home: false, machine: true, goals: { fat_loss: 2, conditioning: 2 } },
    { name: "Remo Ergométrico", muscleGroup: "Cardio", minLevel: 2, gym: true, home: false, machine: true, goals: { fat_loss: 2, conditioning: 3 }, joints: ["lower_back"] },
    { name: "Corda", muscleGroup: "Cardio", minLevel: 2, gym: true, home: true, goals: { fat_loss: 2, conditioning: 3 }, impact: true },
    { name: "Polichinelo", muscleGroup: "Cardio", minLevel: 1, gym: false, home: true, goals: { fat_loss: 3, conditioning: 2 }, impact: true },
    { name: "Corrida com Joelhos Altos", muscleGroup: "Cardio", minLevel: 1, gym: false, home: true, goals: { fat_loss: 2, conditioning: 3 }, impact: true },
    { name: "Burpee", muscleGroup: "Cardio", minLevel: 2, gym: true, home: true, goals: { fat_loss: 2, conditioning: 3 }, impact: true },
    // Cardio caseiro SEM impacto: é a única opção que sobra em casa quando o
    // corpo não tolera salto (IMC alto, 55+, joelho/lombar em cuidado) — sem
    // ela, justamente quem mais precisa do finalizador ficaria sem nenhum.
    { name: "Dança", muscleGroup: "Cardio", minLevel: 1, gym: false, home: true, goals: { fat_loss: 2, conditioning: 2 } },
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
  /** descanso entre séries em segundos [mínimo, máximo] — formatado ao exibir */
  restSeconds: [number, number];
  /**
   * Janela de repetições que ainda serve ao objetivo. O ajuste individual
   * (sexo/IMC/idade) desloca as reps DENTRO desta janela — nunca para fora:
   * somar reps num treino de força até virar série de 9 destruiria o objetivo
   * que o usuário escolheu.
   */
  repWindow: [number, number];
};

const SCHEMES: Record<TrainingGoal, Scheme> = {
  hypertrophy: {
    series: { 1: 3, 2: 4, 3: 4 },
    compoundReps: "10",
    isolationReps: "12",
    coreReps: "15",
    cardioReps: "10min",
    cardioFinisher: false,
    restSeconds: [60, 90],
    repWindow: [8, 15],
  },
  strength: {
    series: { 1: 3, 2: 4, 3: 5 },
    compoundReps: "5",
    isolationReps: "8",
    coreReps: "15",
    cardioReps: "10min",
    cardioFinisher: false,
    restSeconds: [120, 180],
    repWindow: [4, 8],
  },
  fat_loss: {
    series: { 1: 3, 2: 3, 3: 4 },
    compoundReps: "15",
    isolationReps: "15",
    coreReps: "20",
    cardioReps: "15min",
    cardioFinisher: true,
    restSeconds: [30, 60],
    repWindow: [12, 25],
  },
  conditioning: {
    series: { 1: 3, 2: 3, 3: 4 },
    compoundReps: "12",
    isolationReps: "15",
    coreReps: "20",
    cardioReps: "12min",
    cardioFinisher: true,
    restSeconds: [45, 60],
    repWindow: [12, 20],
  },
};

/**
 * Descanso do objetivo ajustado pelo corpo do usuário (`restFactor`) e
 * formatado para leitura. Segundos até 90s; acima disso, minutos — ninguém
 * pensa "descanse 162 segundos".
 */
function formatRest(
  scheme: Scheme,
  coach: CoachProfile,
  language: "pt" | "en",
): string {
  // Piso de 30s: abaixo disso não é descanso, é a pausa de trocar de posição.
  const round5 = (n: number) => Math.max(30, Math.round(n / 5) * 5);
  const min = round5(scheme.restSeconds[0] * coach.restFactor);
  const max = round5(scheme.restSeconds[1] * coach.restFactor);
  if (max <= 90) return `${min}–${max}s`;
  const toMin = (s: number) => {
    const halves = Math.round((s / 60) * 2) / 2;
    return language === "en" ? String(halves) : String(halves).replace(".", ",");
  };
  return `${toMin(min)}–${toMin(max)} min`;
}

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
  coach: CoachProfile,
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
    // …e ganham peso extra para quem tem muita massa a mover, idade avançada ou
    // articulação em cuidado: a máquina estabiliza a trajetória
    score += coach.machineBias;
  }
  // impacto tolerado só parcialmente → o exercício continua elegível, mas perde
  // para qualquer alternativa de baixo impacto (o veto total vem em `poolFor`)
  if (ex.impact && coach.impact === "reduced") score -= 4;
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
  coach: CoachProfile,
): PoolExercise | null {
  let best: PoolExercise | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < pool.length; i++) {
    const ex = pool[i];
    if (usedInWorkout.has(ex.name)) continue;
    // desempate estável: posição no pool (curadoria) vale uma fração mínima
    const score =
      scoreExercise(ex, answers, programUse.get(ex.name) ?? 0, coach) +
      (pool.length - i) * 0.01;
    if (score > bestScore) {
      bestScore = score;
      best = ex;
    }
  }
  return best;
}

/**
 * Repetições do exercício: a base do objetivo deslocada pelo `repsDelta` do
 * usuário, sempre presa à janela do objetivo (`repWindow`).
 *
 * Alvos por tempo (prancha, cardio) ficam de fora — somar "2 repetições" a uma
 * isometria não significa nada.
 */
function repsFor(
  ex: PoolExercise,
  cat: SlotCategory,
  scheme: Scheme,
  level: FitnessLevel,
  coach: CoachProfile,
): string {
  if (cat === "cardio") {
    const base = parseInt(scheme.cardioReps, 10);
    const minutes = Math.max(5, base + coach.cardioMinutesDelta);
    return `${minutes}min`;
  }
  if (ex.name === "Prancha") {
    const base = level === "beginner" ? 30 : 45;
    // 55+ e IMC alto sustentam menos tempo de prancha com a lombar protegida
    const seconds = coach.ageBand === "senior" || coach.bmiBand === "obese" ? base - 10 : base;
    return `${seconds}s`;
  }
  const baseText = cat === "core"
    ? scheme.coreReps
    : ex.compound
      ? scheme.compoundReps
      : scheme.isolationReps;
  const base = parseInt(baseText, 10);
  if (!Number.isFinite(base)) return baseText;
  // core tem janela própria (mais alta) — a do objetivo travaria as 20 reps
  const [lo, hi] = cat === "core"
    ? [Math.max(10, scheme.repWindow[0]), Math.max(25, scheme.repWindow[1])]
    : scheme.repWindow;
  // Anda pela escala de repetições em vez de somar reps cruas: ninguém
  // prescreve "3×17". Cada +2 de `repsDelta` vale um degrau da escala.
  const steps = REP_STEPS.filter((n) => n >= lo && n <= hi);
  if (steps.length === 0) return String(Math.min(hi, Math.max(lo, base)));
  const nearest = steps.reduce((best, n) =>
    Math.abs(n - base) < Math.abs(best - base) ? n : best,
  );
  const index = steps.indexOf(nearest) + Math.round(coach.repsDelta / 2);
  return String(steps[Math.min(steps.length - 1, Math.max(0, index))]);
}

/** Escala de repetições usada na prescrição — os números que se escreve numa ficha. */
const REP_STEPS = [4, 5, 6, 8, 10, 12, 15, 18, 20, 25];

/**
 * Pool elegível para a resposta do usuário: filtra por local e nível como
 * sempre, e aplica os **vetos** do corpo — restrição articular e impacto.
 *
 * Veto é absoluto por decisão de prescrição: um exercício contraindicado não
 * volta por ter pontuação alta (ver `skills/personal-trainer-agent.md`, §2.6).
 */
function eligiblePool(
  cat: SlotCategory,
  answers: QuizAnswers,
  levelNum: 1 | 2 | 3,
  coach: CoachProfile,
): PoolExercise[] {
  return POOLS[cat].filter((e) => {
    if (answers.location === "gym" ? !e.gym : !e.home) return false;
    if (e.minLevel > levelNum) return false;
    if (e.joints?.some((j) => coach.restrictions.includes(j))) return false;
    if (e.impact && coach.impact === "none") return false;
    return true;
  });
}

// ── Técnicas de treino sugeridas (bi-set, drop-set) ──────────────────────────
// O gerador não distribui técnica por enfeite: cada regra abaixo existe por um
// motivo de treino. Continua 100% determinístico — mesmas respostas, mesmo
// programa, mesmas técnicas.

/**
 * Pares ANTAGONISTAS — a única forma de bi-set que o gerador monta sozinho.
 * Enquanto um grupo trabalha, o oposto descansa, então o bloco poupa tempo sem
 * roubar performance. É o caso clássico bíceps + tríceps.
 *
 * O que NÃO entra aqui, de propósito:
 *  - agonista + sinergista (peito + tríceps): o tríceps chega ao segundo
 *    exercício já fatigado pelo primeiro — o bloco só piora as duas séries;
 *  - dois exercícios do MESMO grupo: isso é pré-exaustão, técnica avançada que
 *    depende de intenção, não de sugestão automática;
 *  - ombro/panturrilha/core/cardio: sem antagonista prático na academia.
 */
const ANTAGONIST: Partial<Record<SlotCategory, SlotCategory>> = {
  chest: "back",
  back: "chest",
  biceps: "triceps",
  triceps: "biceps",
  quads: "posterior",
  posterior: "quads",
};

/**
 * Quantas técnicas cabem numa sessão, por objetivo e nível.
 *
 *  - **Iniciante nunca recebe técnica.** Antes de intensificar, é preciso
 *    aprender o movimento e construir uma base de execução.
 *  - **Força não recebe técnica.** Treino de força vive de série pesada com
 *    descanso completo; bi-set e drop-set trabalham contra isso.
 *  - **Emagrecimento/condicionamento** ganham bi-set (densidade, mais trabalho
 *    no mesmo tempo) mas **nenhum drop-set**: o objetivo é volume sustentável,
 *    não falha muscular.
 *  - **Hipertrofia** ganha os dois.
 */
function techniqueBudget(
  answers: QuizAnswers,
  coach: CoachProfile,
): { biset: number; drop: number } {
  if (answers.level === "beginner" || answers.goal === "strength") {
    return { biset: 0, drop: 0 };
  }
  // 55+ e adolescente não recebem intensificação: no primeiro caso a
  // recuperação articular é o gargalo, no segundo a prioridade é técnica.
  if (coach.ageBand === "senior" || coach.ageBand === "teen") {
    return { biset: 0, drop: 0 };
  }
  const advanced = answers.level === "advanced";
  if (answers.goal === "fat_loss" || answers.goal === "conditioning") {
    return { biset: advanced ? 2 : 1, drop: 0 };
  }
  return { biset: advanced ? 2 : 1, drop: 1 };
}

type PickedExercise = {
  exercise: SuggestedExercise;
  category: SlotCategory;
  pool: PoolExercise;
};

/**
 * Distribui as técnicas sobre os exercícios já escolhidos do treino. Muta os
 * `SuggestedExercise` no lugar (acrescenta `technique`/`techniqueGroup`).
 */
function assignTechniques(
  picked: PickedExercise[],
  answers: QuizAnswers,
  workoutKey: string,
  coach: CoachProfile,
) {
  const budget = techniqueBudget(answers, coach);
  if (budget.biset === 0 && budget.drop === 0) return;

  const taken = new Set<number>();

  // ── Bi-sets antagonistas ──────────────────────────────────────────────────
  let madeBisets = 0;
  for (let i = 0; i < picked.length && madeBisets < budget.biset; i++) {
    if (taken.has(i)) continue;
    const a = picked[i];
    const wanted = ANTAGONIST[a.category];
    if (!wanted) continue;

    for (let j = i + 1; j < picked.length; j++) {
      if (taken.has(j)) continue;
      const b = picked[j];
      if (b.category !== wanted) continue;
      // Na ACADEMIA, dois compostos de peso livre ocupariam duas barras/racks
      // ao mesmo tempo — inviável numa academia cheia. Um dos dois precisa ser
      // máquina ou isolador para o bloco ser executável de verdade.
      //
      // EM CASA a regra não vale: flexão + remada invertida é peso do corpo,
      // não disputa equipamento com ninguém. Aplicar o mesmo filtro ali
      // eliminava todos os bi-sets do treino caseiro (que é justo onde eles
      // mais rendem, por falta de carga).
      if (answers.location === "gym") {
        const bothFreeCompounds =
          a.pool.compound && !a.pool.machine && b.pool.compound && !b.pool.machine;
        if (bothFreeCompounds) continue;
      }

      const group = `${workoutKey}-bs${madeBisets + 1}`;
      a.exercise.technique = "biset";
      a.exercise.techniqueGroup = group;
      b.exercise.technique = "biset";
      b.exercise.techniqueGroup = group;
      taken.add(i);
      taken.add(j);
      madeBisets++;
      break;
    }
  }

  // ── Bi-set "de densidade" (só emagrecimento/condicionamento) ──────────────
  // Um split como "Peito e Tríceps" não tem par antagonista por construção — os
  // dois grupos trabalham juntos. Para HIPERTROFIA isso encerra o assunto: sem
  // par bom, sem bi-set. Mas quando o objetivo é gasto calórico/densidade, é
  // prática corrente emendar o exercício principal com um NEUTRO (core,
  // panturrilha) — eles não dividem musculatura com nada do treino, então o
  // bloco só adiciona trabalho sem prejudicar as séries.
  if (
    madeBisets < budget.biset &&
    (answers.goal === "fat_loss" || answers.goal === "conditioning")
  ) {
    const NEUTRAL: SlotCategory[] = ["core", "calves"];
    for (let i = 0; i < picked.length && madeBisets < budget.biset; i++) {
      if (taken.has(i) || picked[i].category === "cardio") continue;
      if (NEUTRAL.includes(picked[i].category)) continue;
      const j = picked.findIndex(
        (p, idx) => !taken.has(idx) && idx !== i && NEUTRAL.includes(p.category),
      );
      if (j === -1) break;
      const group = `${workoutKey}-bs${madeBisets + 1}`;
      picked[i].exercise.technique = "biset";
      picked[i].exercise.techniqueGroup = group;
      picked[j].exercise.technique = "biset";
      picked[j].exercise.techniqueGroup = group;
      taken.add(i);
      taken.add(j);
      madeBisets++;
    }
  }

  // ── Drop-set ──────────────────────────────────────────────────────────────
  // Um só, e no ÚLTIMO exercício elegível: drop-set é finalizador. Colocá-lo no
  // começo comprometeria todo o resto da sessão.
  if (budget.drop > 0) {
    for (let i = picked.length - 1; i >= 0; i--) {
      if (taken.has(i)) continue;
      const p = picked[i];
      if (p.category === "cardio" || p.category === "core") continue;
      // Só onde baixar a carga é rápido e seguro: máquina, cabo ou isolador.
      // Num agachamento com barra, trocar anilhas no meio da série não é
      // drop-set — é pausa.
      if (!p.pool.machine && p.pool.compound) continue;
      p.exercise.technique = "drop";
      taken.add(i);
      break;
    }
  }
}

function buildExercises(
  tpl: DayTemplate,
  answers: QuizAnswers,
  programUse: Map<string, number>,
  coach: CoachProfile,
): SuggestedExercise[] {
  const levelNum = LEVEL_NUM[answers.level];
  const target = EXERCISES_BY_MINUTES[answers.minutes];
  const scheme = SCHEMES[answers.goal];
  const slots = applyEmphasis(tpl.slots, answers.emphasis);
  const usedInWorkout = new Set<string>();
  const out: SuggestedExercise[] = [];
  // Categoria e entrada do pool de cada escolha — o `SuggestedExercise` não as
  // carrega, e são elas que dizem se um bi-set é antagonista e se um drop-set é
  // executável (máquina × barra livre).
  const picked: PickedExercise[] = [];

  const poolFor = (cat: SlotCategory) => eligiblePool(cat, answers, levelNum, coach);

  // séries do objetivo ajustadas pelo corpo (55+ e adolescente perdem uma;
  // nunca menos de 2, senão a sessão deixa de gerar estímulo)
  const seriesCount = Math.max(2, scheme.series[levelNum] + coach.setsDelta);

  // queima de gordura/condicionamento: a última vaga do treino é RESERVADA
  // para um finalizador de cardio (alvo por tempo, série única)
  const strengthTarget = scheme.cardioFinisher ? Math.max(target - 1, 3) : target;

  for (const cat of slots) {
    if (out.length >= strengthTarget) break;
    const pick = pickBest(poolFor(cat), answers, usedInWorkout, programUse, coach);
    if (!pick) continue;
    usedInWorkout.add(pick.name);
    const exercise: SuggestedExercise = {
      name: pick.name,
      muscleGroup: pick.muscleGroup,
      series: seriesCount,
      reps: repsFor(pick, cat, scheme, answers.level, coach),
    };
    out.push(exercise);
    picked.push({ exercise, category: cat, pool: pick });
  }

  // Técnicas entram DEPOIS da escolha: elas dependem de quais exercícios o
  // treino acabou tendo (não dá para saber o antagonista antes de escolher).
  // O finalizador de cardio abaixo fica de fora de propósito.
  assignTechniques(picked, answers, tpl.key, coach);

  if (scheme.cardioFinisher) {
    const pick = pickBest(poolFor("cardio"), answers, usedInWorkout, programUse, coach);
    if (pick) {
      usedInWorkout.add(pick.name);
      out.push({
        name: pick.name,
        muscleGroup: pick.muscleGroup,
        series: 1,
        reps: repsFor(pick, "cardio", scheme, answers.level, coach),
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

// ── "Por que este plano é seu" ───────────────────────────────────────────────

const RESTRICTION_LABEL: Record<JointRestriction, { pt: string; en: string }> = {
  knee: { pt: "joelho", en: "knee" },
  shoulder: { pt: "ombro", en: "shoulder" },
  lower_back: { pt: "lombar", en: "lower back" },
  wrist: { pt: "punho", en: "wrist" },
};

/**
 * Monta as notas exibidas no preview. **Cada nota só entra se o ajuste
 * correspondente realmente aconteceu** neste programa — é a regra de
 * rastreabilidade do `personal-trainer-agent`: explicação sem decisão por trás
 * é teatro de personalização.
 */
function buildCoachNotes(
  answers: QuizAnswers,
  coach: CoachProfile,
  scheme: Scheme,
): CoachNote[] {
  const notes: CoachNote[] = [];
  const restPt = formatRest(scheme, coach, "pt");
  const restEn = formatRest(scheme, coach, "en");

  // 1. Restrições — o ajuste mais forte, então vem primeiro
  if (coach.restrictions.length > 0) {
    const pt = coach.restrictions.map((r) => RESTRICTION_LABEL[r].pt).join(", ");
    const en = coach.restrictions.map((r) => RESTRICTION_LABEL[r].en).join(", ");
    notes.push({
      kind: "restriction",
      pt: `Você marcou cuidado com ${pt}: os exercícios contraindicados para essa articulação ficaram de fora e foram substituídos por opções que poupam a região.`,
      en: `You flagged ${en} care: exercises contraindicated for that joint were left out and replaced with options that spare the area.`,
    });
  }

  // 2. Composição corporal — só quando há IMC calculado E ele mudou algo
  if (coach.bmi != null && coach.bmiBand) {
    const bmiPt = coach.bmi.toFixed(1).replace(".", ",");
    const bmiEn = coach.bmi.toFixed(1);
    if (coach.bmiBand === "obese") {
      notes.push({
        kind: "body",
        pt: `Com ${coach.weightKg} kg e ${coach.heightCm} cm (IMC ${bmiPt}), tirei os exercícios de salto e impacto — a carga sobre joelho e tornozelo em cada aterrissagem seria alta demais. O cardio ficou de baixo impacto e mais longo.`,
        en: `At ${coach.weightKg} kg and ${coach.heightCm} cm (BMI ${bmiEn}), jumping and high-impact work is out — the load on knees and ankles on each landing would be too high. Cardio is low-impact and longer instead.`,
      });
    } else if (coach.bmiBand === "over") {
      notes.push({
        kind: "body",
        pt: `Seu IMC é ${bmiPt}: preferi exercícios guiados e reduzi o impacto repetitivo, mantendo o gasto calórico pela duração e não pelo salto.`,
        en: `Your BMI is ${bmiEn}: I favoured guided exercises and cut repetitive impact, keeping the calorie burn in the duration rather than in jumping.`,
      });
    } else if (coach.bmiBand === "under" && answers.goal !== "hypertrophy") {
      notes.push({
        kind: "body",
        pt: `Seu IMC é ${bmiPt}, abaixo da faixa de referência: mantive o volume de musculação alto e o cardio contido, para você não gastar o que precisa construir.`,
        en: `Your BMI is ${bmiEn}, below the reference range: I kept resistance volume high and cardio contained, so you don't spend what you need to build.`,
      });
    }
  }

  // 3. Idade — só quando ela mexeu em descanso, série ou técnica
  if (coach.ageBand === "senior") {
    notes.push({
      kind: "age",
      pt: `Aos ${coach.age} anos, o gargalo é a recuperação: uma série a menos por exercício, descanso de ${restPt} e nenhuma técnica de intensificação. Progresso vem da constância, não da exaustão.`,
      en: `At ${coach.age}, recovery is the bottleneck: one set fewer per exercise, ${restEn} of rest and no intensification techniques. Progress comes from consistency, not exhaustion.`,
    });
  } else if (coach.ageBand === "mature") {
    notes.push({
      kind: "age",
      pt: `Aos ${coach.age} anos, aumentei o descanso entre séries para ${restPt} e priorizei exercícios guiados — a articulação pede mais preparo do que aos 20.`,
      en: `At ${coach.age}, I extended rest between sets to ${restEn} and prioritised guided exercises — joints ask for more preparation than at 20.`,
    });
  } else if (coach.ageBand === "teen") {
    notes.push({
      kind: "age",
      pt: `Como você ainda está em fase de crescimento, o foco é técnica: uma série a menos, sem técnicas avançadas e sem treinar até a falha.`,
      en: `Since you're still growing, the focus is technique: one set fewer, no advanced techniques and no training to failure.`,
    });
  }

  // 4. Sexo — só quando os modificadores de fato mudaram reps/descanso
  if (coach.sex === "female") {
    notes.push({
      kind: "body",
      pt: `Ajustei a faixa de repetições para cima e o descanso para ${restPt}: mulheres sustentam mais repetições na mesma intensidade relativa e recuperam mais rápido entre séries.`,
      en: `I nudged the rep range up and set rest at ${restEn}: women sustain more reps at the same relative intensity and recover faster between sets.`,
    });
  }

  // 5. Tendência de peso — só quando há histórico suficiente
  if (coach.weightTrend === "losing" && answers.goal === "hypertrophy") {
    notes.push({
      kind: "trend",
      pt: `Seu peso vem caindo nas últimas semanas. Para ganhar massa isso joga contra: mantenha o treino, mas confira se a alimentação acompanha o objetivo.`,
      en: `Your weight has been dropping over the past weeks. That works against muscle gain: keep the training, but check that your eating matches the goal.`,
    });
  } else if (coach.weightTrend === "gaining" && answers.goal === "fat_loss") {
    notes.push({
      kind: "trend",
      pt: `Seu peso vem subindo: aumentei a duração do cardio final e mantive o descanso curto, para elevar o gasto sem estender a sessão.`,
      en: `Your weight has been trending up: I extended the final cardio and kept rest short, raising the burn without stretching the session.`,
    });
  }

  // 6. Nível e objetivo — a base da prescrição, sempre verdadeira
  notes.push({
    kind: "goal",
    pt: `Objetivo ${GOAL_LABELS[answers.goal].pt.toLowerCase()}: ${scheme.series[LEVEL_NUM[answers.level]] + coach.setsDelta} séries por exercício, descanso de ${restPt} e seleção puxada para os exercícios que mais rendem nesse objetivo.`,
    en: `${GOAL_LABELS[answers.goal].en} goal: ${scheme.series[LEVEL_NUM[answers.level]] + coach.setsDelta} sets per exercise, ${restEn} of rest and a selection pulled toward what pays off most for it.`,
  });

  if (answers.level === "beginner") {
    notes.push({
      kind: "level",
      pt: `Como iniciante, você recebe exercícios guiados e nenhuma técnica avançada: primeiro o movimento, depois a intensidade.`,
      en: `As a beginner you get guided exercises and no advanced techniques: movement first, intensity later.`,
    });
  }

  return notes;
}

/** Gera o programa semanal personalizado a partir das respostas do quiz. */
export function generateProgram(answers: QuizAnswers): WeeklyProgram {
  const coach = answers.coach ?? NEUTRAL_COACH_PROFILE;
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
    exercises: buildExercises(tpl, answers, programUse, coach),
  }));

  const week: Array<string | null> = Array(7).fill(null);
  days.forEach((day, i) => {
    week[day] = sequence[i]?.key ?? null;
  });

  const goalLabel = GOAL_LABELS[answers.goal];
  const split = splitLabel(dayCount, answers.level, answers.emphasis);
  const scheme = SCHEMES[answers.goal];
  const rest = { pt: formatRest(scheme, coach, "pt"), en: formatRest(scheme, coach, "en") };
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
    coachNotes: buildCoachNotes(answers, coach, scheme),
  };
}
