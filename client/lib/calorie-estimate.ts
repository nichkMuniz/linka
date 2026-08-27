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
 * Musculação: FAIXA de MET, não valor único.
 *
 * Antes era fixo em 5,0, e a consequência era contraintuitiva: registrar mais
 * carga e mais repetições não mudava nada no número — só o cronômetro mexia.
 * Duas pessoas na mesma hora de academia, uma encostada no aparelho e outra
 * fazendo 20 séries pesadas, recebiam a mesma estimativa.
 *
 * Os três valores são do Compendium (resistance training, light / moderate /
 * vigorous). O que escolhe entre eles é o RITMO DE TRABALHO da sessão —
 * volume (carga × reps) por minuto —, que é a única medida de intensidade que
 * o app tem sem sensor. O valor segue embutindo o descanso entre séries, então
 * a base de tempo continua sendo o cronômetro.
 */
const MET_STRENGTH_LIGHT = 3.5;
const MET_STRENGTH_MODERATE = 5.0;
const MET_STRENGTH_VIGOROUS = 6.0;

/**
 * Ritmos de referência, em kg×reps por minuto de musculação.
 *
 * Calibrados sobre uma sessão comum: ~10 séries de 10 reps a 40 kg em 30 min
 * dá ≈ 133 kg·rep/min, que deve cair perto do "moderado". O dobro disso já é
 * uma sessão claramente puxada.
 */
const WORK_RATE_MODERATE = 130;
const WORK_RATE_VIGOROUS = 320;

/**
 * Fração do peso corporal atribuída a exercícios sem carga externa (flexão,
 * barra, abdominal). Sem isto uma sessão inteira de peso do corpo teria volume
 * zero e cairia no MET leve, que é justamente o oposto da verdade.
 * É uma aproximação grosseira e assumida — nenhum valor exato existe, porque
 * depende do movimento.
 */
const BODYWEIGHT_LOAD_FRACTION = 0.4;

/**
 * MET da musculação a partir do ritmo de trabalho. Interpola entre leve e
 * vigoroso e satura nas pontas — nunca extrapola a faixa publicada.
 */
function strengthMetFromWorkRate(volume: number, minutes: number): number {
  if (minutes <= 0) return MET_STRENGTH_MODERATE;
  const rate = volume / minutes;
  if (rate <= 0) return MET_STRENGTH_LIGHT;
  if (rate <= WORK_RATE_MODERATE) {
    const t = rate / WORK_RATE_MODERATE;
    return MET_STRENGTH_LIGHT + t * (MET_STRENGTH_MODERATE - MET_STRENGTH_LIGHT);
  }
  const t = Math.min(
    1,
    (rate - WORK_RATE_MODERATE) / (WORK_RATE_VIGOROUS - WORK_RATE_MODERATE),
  );
  return MET_STRENGTH_MODERATE + t * (MET_STRENGTH_VIGOROUS - MET_STRENGTH_MODERATE);
}

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
  /**
   * Séries CONCLUÍDAS de musculação (carga em kg × repetições). É o que faz a
   * estimativa responder ao esforço, e não só ao relógio. Vazio/ausente para
   * cardio.
   */
  sets?: { kg: number; reps: number }[];
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
 *   creditado à musculação, que é onde o descanso entre séries mora — com o
 *   MET escolhido pelo RITMO DE TRABALHO (volume por minuto), e não fixo;
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

    // Volume total das séries concluídas. Exercício sem carga externa entra
    // com uma fração do peso corporal — do contrário treino de peso do corpo
    // pontuaria zero.
    let volume = 0;
    for (const ex of strength) {
      for (const set of ex.sets ?? []) {
        const reps = Math.max(0, set.reps);
        if (reps <= 0) continue;
        const load = set.kg > 0 ? set.kg : weightKg * BODYWEIGHT_LOAD_FRACTION;
        volume += load * reps;
      }
    }

    const met = onlyStretching
      ? MET_STRETCH
      : strengthMetFromWorkRate(volume, remaining);
    kcal += kcalFor(met, weightKg, remaining);
  }

  // Arredondar para 5 é deliberado: "≈ 315 kcal" passa uma precisão que a conta
  // não tem. Múltiplo de 5 se lê como estimativa.
  return { kcal: Math.round(kcal / 5) * 5, usedDefaultWeight };
}
