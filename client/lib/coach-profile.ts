/**
 * Perfil de treinador — a "anamnese" do usuário traduzida em modificadores de
 * prescrição.
 *
 * Este arquivo é a ponte entre os DADOS do usuário (sexo, idade, altura, peso e
 * restrições articulares) e as DECISÕES do gerador de programa
 * (`components/goals/program-generator.ts`): quantas séries, quanto descanso,
 * quais exercícios estão vetados, quanto impacto o corpo tolera.
 *
 * Ele é puro (nenhuma chamada de banco) e determinístico: mesmos dados → mesmos
 * modificadores. Quem busca os dados é o wizard (`getUserProfileDb` +
 * `getFitnessProfileDb`); quem os aplica é o gerador.
 *
 * A doutrina de prescrição que este arquivo implementa está escrita em
 * `skills/personal-trainer-agent.md` — mudou aqui, atualiza lá.
 */

// ── Entrada ─────────────────────────────────────────────────────────────────

/** `profiles.gender` grava exatamente estes valores (ver cadastro em Login.tsx). */
export type BiologicalSex = "male" | "female" | "other";

/**
 * Restrição articular declarada no quiz. **Veta** exercícios — nunca é só uma
 * penalidade de pontuação (ver `skills/personal-trainer-agent.md`, seção 2.6).
 */
export type JointRestriction = "knee" | "shoulder" | "lower_back" | "wrist";

export const JOINT_RESTRICTIONS: JointRestriction[] = [
  "knee",
  "shoulder",
  "lower_back",
  "wrist",
];

/** Dados corporais do usuário (todos opcionais — o perfil pode estar incompleto). */
export type BodyData = {
  sex?: BiologicalSex | null;
  /** anos */
  age?: number | null;
  /** centímetros */
  heightCm?: number | null;
  /** quilos */
  weightKg?: number | null;
  /** tendência do peso corporal nas últimas semanas (de `user_weight_logs`) */
  weightTrend?: WeightTrend | null;
};

export type WeightTrend = "losing" | "stable" | "gaining";

// ── Faixas derivadas ────────────────────────────────────────────────────────

/** Faixa de IMC — mede a carga que a articulação recebe em cada aterrissagem. */
export type BmiBand = "under" | "normal" | "over" | "obese";

/** Faixa etária — governa recuperação, impacto e teto de volume. */
export type AgeBand = "teen" | "adult" | "mature" | "senior";

/** Quanto impacto/pliometria o corpo tolera hoje. */
export type ImpactTolerance = "full" | "reduced" | "none";

export type CoachProfile = {
  sex: BiologicalSex | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  weightTrend: WeightTrend | null;
  /** kg/m² — null quando falta altura ou peso */
  bmi: number | null;
  bmiBand: BmiBand | null;
  ageBand: AgeBand | null;
  impact: ImpactTolerance;
  /** articulações a proteger — vetam exercícios na seleção */
  restrictions: JointRestriction[];
  /** alavancas longas (≥ 185 cm): muda os cues de execução, não a seleção */
  longLevers: boolean;
  /** ajuste no nº de séries por exercício (−1, 0 ou +0) */
  setsDelta: number;
  /** multiplicador do descanso entre séries (1 = padrão do objetivo) */
  restFactor: number;
  /** deslocamento na faixa de repetições (+2 = duas reps a mais) */
  repsDelta: number;
  /** peso extra dado a exercícios guiados/máquina na pontuação */
  machineBias: number;
  /** minutos somados (ou subtraídos) do finalizador de cardio */
  cardioMinutesDelta: number;
  /** true = há pelo menos um dado corporal real por trás dos modificadores */
  hasBodyData: boolean;
};

// ── Derivação ───────────────────────────────────────────────────────────────

function bandForBmi(bmi: number): BmiBand {
  if (bmi < 18.5) return "under";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "over";
  return "obese";
}

function bandForAge(age: number): AgeBand {
  if (age < 18) return "teen";
  if (age < 40) return "adult";
  if (age < 55) return "mature";
  return "senior";
}

/** Altura em cm, tolerando quem digitou em metros ("1.75") no cadastro. */
function normalizeHeightCm(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const cm = value < 3 ? value * 100 : value;
  // fora disso é digitação errada — melhor ignorar do que prescrever em cima
  return cm >= 120 && cm <= 230 ? cm : null;
}

function normalizeWeightKg(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  return value >= 30 && value <= 300 ? value : null;
}

function normalizeAge(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  return value >= 12 && value <= 100 ? Math.round(value) : null;
}

/**
 * Converte os dados brutos do perfil (strings vindas do Supabase) em números
 * confiáveis. Vale para `profiles.height / weight / age`, que são texto/número
 * conforme a origem do cadastro.
 */
export function parseBodyData(raw: {
  gender?: string | null;
  age?: string | number | null;
  height?: string | number | null;
  weight?: string | number | null;
  weightTrend?: WeightTrend | null;
}): BodyData {
  const num = (v: string | number | null | undefined): number | null => {
    if (v == null || v === "") return null;
    const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };
  const sex = raw.gender === "male" || raw.gender === "female" || raw.gender === "other"
    ? raw.gender
    : null;
  const height = num(raw.height);
  const weight = num(raw.weight);
  const age = num(raw.age);
  return {
    sex,
    age: age != null ? normalizeAge(age) : null,
    heightCm: height != null ? normalizeHeightCm(height) : null,
    weightKg: weight != null ? normalizeWeightKg(weight) : null,
    weightTrend: raw.weightTrend ?? null,
  };
}

/** Tendência do peso a partir do histórico (mais antigo → mais recente). */
export function weightTrendFromLogs(
  logs: Array<{ weight: number; logged_at: string }>,
): WeightTrend | null {
  if (logs.length < 3) return null;
  const recent = logs.slice(-6);
  const first = recent[0].weight;
  const last = recent[recent.length - 1].weight;
  if (!Number.isFinite(first) || !Number.isFinite(last) || first <= 0) return null;
  const deltaPct = ((last - first) / first) * 100;
  // 1,5% do peso corporal é o limiar em que a mudança deixa de ser variação de
  // água/horário e passa a ser tendência real
  if (deltaPct <= -1.5) return "losing";
  if (deltaPct >= 1.5) return "gaining";
  return "stable";
}

/**
 * Monta o perfil de treinador. Cada modificador abaixo tem uma justificativa
 * fisiológica registrada em `skills/personal-trainer-agent.md` — nenhum deles é
 * um número escolhido por estética.
 */
export function buildCoachProfile(
  body: BodyData,
  restrictions: JointRestriction[] = [],
): CoachProfile {
  const heightCm = body.heightCm ?? null;
  const weightKg = body.weightKg ?? null;
  const age = body.age ?? null;

  const bmi =
    heightCm && weightKg ? weightKg / Math.pow(heightCm / 100, 2) : null;
  const bmiBand = bmi != null ? bandForBmi(bmi) : null;
  const ageBand = age != null ? bandForAge(age) : null;

  // ── Tolerância a impacto ────────────────────────────────────────────────
  // Força de reação do solo escala com a massa corporal: pular com IMC 34 é
  // muito mais carga articular do que pular com IMC 22. Idade avançada some
  // recuperação tendínea reduzida ao mesmo problema.
  let impact: ImpactTolerance = "full";
  if (bmiBand === "obese" || ageBand === "senior") impact = "none";
  else if (bmiBand === "over" || ageBand === "mature") impact = "reduced";
  // joelho ou lombar em cuidado tira a pliometria de qualquer corpo
  if (restrictions.includes("knee") || restrictions.includes("lower_back")) {
    impact = "none";
  }

  // ── Volume ──────────────────────────────────────────────────────────────
  // 55+ perde uma série por exercício: a recuperação entre sessões é o gargalo,
  // não o estímulo. Adolescente também, por outro motivo — técnica antes de volume.
  let setsDelta = 0;
  if (ageBand === "senior" || ageBand === "teen") setsDelta = -1;

  // ── Descanso ────────────────────────────────────────────────────────────
  // Recuperação cardiovascular e neural desacelera com a idade; mulheres
  // recuperam um pouco mais rápido entre séries no mesmo % de 1RM.
  let restFactor = 1;
  if (ageBand === "mature") restFactor = 1.2;
  if (ageBand === "senior") restFactor = 1.35;
  if (body.sex === "female") restFactor *= 0.9;

  // ── Repetições ──────────────────────────────────────────────────────────
  // Maior resistência à fadiga em % do 1RM → a mesma intensidade relativa rende
  // mais repetições. Iniciante pesado ganha reps para trabalhar com menos carga.
  let repsDelta = 0;
  if (body.sex === "female") repsDelta += 2;
  if (bmiBand === "obese") repsDelta += 2;
  if (ageBand === "senior") repsDelta += 2;

  // ── Viés por exercício guiado ───────────────────────────────────────────
  // Máquina estabiliza a trajetória: é a porta de entrada para quem tem muita
  // massa a mover, idade avançada ou articulação em cuidado.
  let machineBias = 0;
  if (bmiBand === "obese") machineBias += 2;
  else if (bmiBand === "over") machineBias += 1;
  if (ageBand === "senior") machineBias += 2;
  else if (ageBand === "mature") machineBias += 1;
  if (restrictions.length > 0) machineBias += 1;

  // ── Cardio ──────────────────────────────────────────────────────────────
  // Sem impacto disponível, o gasto calórico vem da duração (bike/elíptico),
  // não da intensidade de salto.
  let cardioMinutesDelta = 0;
  if (impact === "none") cardioMinutesDelta += 5;
  if (body.weightTrend === "gaining") cardioMinutesDelta += 3;

  return {
    sex: body.sex ?? null,
    age,
    heightCm,
    weightKg,
    weightTrend: body.weightTrend ?? null,
    bmi,
    bmiBand,
    ageBand,
    impact,
    restrictions: Array.from(new Set(restrictions)),
    longLevers: heightCm != null && heightCm >= 185,
    setsDelta,
    restFactor,
    repsDelta,
    machineBias,
    cardioMinutesDelta,
    hasBodyData:
      body.sex != null || age != null || heightCm != null || weightKg != null,
  };
}

/** Perfil vazio — usuário sem nenhum dado corporal: prescrição neutra. */
export const NEUTRAL_COACH_PROFILE: CoachProfile = buildCoachProfile({}, []);

/** IMC formatado para exibição ("24,8" / "24.8"). */
export function formatBmi(bmi: number, language: "pt" | "en"): string {
  const value = bmi.toFixed(1);
  return language === "en" ? value : value.replace(".", ",");
}
