// Estimativa de gasto calórico de uma sessão de treino.
//
// É uma ESTIMATIVA, não uma medição: o app não tem sensor de frequência
// cardíaca nem acesso ao HealthKit, então o número sai de uma fórmula pública a
// partir do que já está na tela (tempo, tipo de exercício, peso corporal). Toda
// superfície que mostra o valor sem o usuário ter confirmado deve deixar isso
// claro (prefixo "~"), e o valor é sempre EDITÁVEL — quem tem relógio ou lê o
// número no aparelho manda mais que a conta.
//
// Fórmula (ACSM): kcal/min = MET × 3,5 × peso(kg) / 200
// Os METs vêm do Compendium of Physical Activities (Ainsworth et al.),
// arredondados para a granularidade que faz sentido aqui.

import { getCardioKind, type CardioKind } from "@/lib/cardio-exercises";

/**
 * Peso usado quando o perfil não tem peso corporal. É a única forma de ainda
 * oferecer uma estimativa a quem nunca preencheu o corpo — a UI avisa que a
 * precisão melhora com o peso cadastrado (ver `usedDefaultWeight`).
 */
export const DEFAULT_ESTIMATE_WEIGHT_KG = 70;

/** MET por modalidade de cardio, quando não dá para derivar da velocidade. */
const MET_BY_CARDIO_KIND: Record<CardioKind, number> = {
  run: 9.8,        // corrida ~9,7 km/h
  walk: 3.8,       // caminhada moderada
  bike: 7.0,       // bicicleta / spinning, esforço moderado
  elliptical: 5.0,
  rowing: 7.0,
  jump_rope: 11.0,
  stairs: 9.0,
  swim: 7.0,
  generic: 6.0,
};

/**
 * Musculação com séries e descanso, esforço moderado a vigoroso. O valor já
 * embute o descanso entre séries — é por isso que a base de tempo pode ser o
 * cronômetro da sessão, e não a soma dos segundos "debaixo da barra".
 */
const MET_STRENGTH = 5.0;

/** Alongamento/mobilidade — sessão inteira dedicada a isso gasta bem menos. */
const MET_STRETCH = 2.5;

/** Grupos musculares que contam como alongamento/mobilidade (PT e EN). */
const STRETCH_GROUPS = ["alongamento", "flexibilidade", "stretching", "flexibility", "mobilidade", "mobility"];

/**
 * MET a partir da velocidade média, quando a pessoa registrou MIN **e** KM.
 * Correr 12 km/h não gasta o mesmo que trotar 8 km/h, e essa é a única
 * informação de intensidade que o app tem. Fora das faixas plausíveis (dado
 * digitado errado, km de elíptico) cai no valor da tabela.
 */
function metFromSpeed(kind: CardioKind, kmh: number): number | null {
  if (!Number.isFinite(kmh) || kmh <= 0) return null;
  if (kind === "run") {
    if (kmh < 4 || kmh > 25) return null;
    return clamp(kmh * 0.95 + 0.5, 5, 16);
  }
  if (kind === "walk") {
    if (kmh < 1.5 || kmh > 8) return null;
    return clamp(kmh * 0.85 - 0.7, 2, 7);
  }
  if (kind === "bike") {
    if (kmh < 8 || kmh > 50) return null;
    return clamp(kmh * 0.35 + 1.2, 4, 14);
  }
  return null;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** kcal de um bloco de esforço: MET × 3,5 × peso / 200 × minutos. */
function kcalFor(met: number, weightKg: number, minutes: number): number {
  if (minutes <= 0) return 0;
  return (met * 3.5 * weightKg / 200) * minutes;
}

/**
 * Um exercício da sessão, no formato que o estimador precisa. `minutes`/`km`
 * são os totais **já somados** das séries concluídas (via `sumCardioSets`, que
 * converte "1,30" em 90 minutos) — a conversão fica no chamador para este
 * módulo não depender da camada de canvas.
 */
export type CalorieEstimateExercise = {
  name: string;
  muscleGroup: string | null;
  isCardio: boolean;
  /** minutos REAIS registrados no cardio (0 para musculação) */
  minutes: number;
  /** km registrados no cardio (0 para musculação) */
  km: number;
};

export type CalorieEstimate = {
  /** kcal estimadas, arredondadas para múltiplo de 5 (0 = sem base para estimar) */
  kcal: number;
  /** true = usou {@link DEFAULT_ESTIMATE_WEIGHT_KG} por falta de peso no perfil */
  usedDefaultWeight: boolean;
};

/**
 * Gasto estimado da sessão inteira.
 *
 * Como o tempo é repartido:
 * - cada cardio gasta pelos **minutos que a pessoa registrou** no campo MIN,
 *   com o MET da modalidade (ajustado pela velocidade quando há km);
 * - o restante do cronômetro (`durationSecs` menos os minutos de cardio) é
 *   creditado à musculação, que é onde o descanso entre séries mora;
 * - numa sessão **só de cardio** o restante é descartado: são os minutos de
 *   preparação/vestiário com o treino aberto, não esforço.
 */
export function estimateWorkoutCalories(input: {
  durationSecs: number;
  weightKg: number | null | undefined;
  exercises: CalorieEstimateExercise[];
}): CalorieEstimate {
  const usedDefaultWeight = !input.weightKg || input.weightKg <= 0;
  const weightKg = usedDefaultWeight ? DEFAULT_ESTIMATE_WEIGHT_KG : Number(input.weightKg);

  const cardio = input.exercises.filter((e) => e.isCardio);
  const strength = input.exercises.filter((e) => !e.isCardio);

  let kcal = 0;
  let cardioMinutes = 0;
  for (const ex of cardio) {
    const minutes = Math.max(0, ex.minutes);
    if (minutes <= 0) continue;
    cardioMinutes += minutes;
    const kind = getCardioKind(ex.name);
    const kmh = ex.km > 0 ? ex.km / (minutes / 60) : 0;
    const met = metFromSpeed(kind, kmh) ?? MET_BY_CARDIO_KIND[kind];
    kcal += kcalFor(met, weightKg, minutes);
  }

  // Tempo que sobra do cronômetro depois do cardio registrado.
  const sessionMinutes = Math.max(0, input.durationSecs) / 60;
  const remaining = sessionMinutes - cardioMinutes;
  if (strength.length > 0 && remaining > 0) {
    const onlyStretching =
      strength.every((e) => STRETCH_GROUPS.includes((e.muscleGroup ?? "").toLowerCase()));
    kcal += kcalFor(onlyStretching ? MET_STRETCH : MET_STRENGTH, weightKg, remaining);
  }

  // Arredondar para 5 é deliberado: "≈ 315 kcal" passa uma precisão que a conta
  // não tem. Múltiplo de 5 se lê como estimativa.
  return { kcal: Math.round(kcal / 5) * 5, usedDefaultWeight };
}
