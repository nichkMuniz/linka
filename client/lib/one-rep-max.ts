/**
 * 1RM estimado (e1RM) — a carga máxima teórica para UMA repetição, calculada a
 * partir de uma série qualquer.
 *
 * Por que o app precisa disso: até 05/08/2026 o "recorde" de um exercício era
 * `max(kilos)` puro (`getPreviousBestKgDb`). Isso mede a coisa errada — uma
 * série de 100kg × 1 "vencia" 95kg × 10, que é um treino muito melhor. Com o
 * e1RM as duas viram números comparáveis (100,0 × 126,7) e a progressão passa a
 * refletir força real, não só o disco mais pesado que a pessoa conseguiu segurar
 * uma vez.
 *
 * Fórmula: **Epley** — `1RM ≈ kg × (1 + reps / 30)`.
 * Escolhida por ser a mais usada em apps de treino (Hevy/Strong), o que mantém
 * os números do usuário reconhecíveis se ele comparar com outro app. É uma
 * ESTIMATIVA: perde precisão acima de ~12 repetições, onde a resistência pesa
 * mais que a força máxima.
 */

/** Acima disso a estimativa de Epley perde sentido prático (vira resistência). */
const MAX_MEANINGFUL_REPS = 30;

/**
 * e1RM de uma série. Devolve 0 quando não há o que estimar (peso do corpo
 * registrado como 0kg, série sem repetições).
 *
 * `reps = 1` devolve o próprio peso — a fórmula já faz isso, mas o caso é
 * explícito para deixar claro que uma máxima real não é "estimada para cima".
 */
export function estimateOneRepMax(kg: number, reps: number): number {
  if (!(kg > 0) || !(reps > 0)) return 0;
  if (reps === 1) return kg;
  // Séries muito longas achatam no teto: sem isso, 20kg × 50 viraria 53kg de
  // "força máxima", competindo com séries pesadas de verdade.
  const effectiveReps = Math.min(reps, MAX_MEANINGFUL_REPS);
  return kg * (1 + effectiveReps / 30);
}

/**
 * Arredonda o e1RM para exibição (1 casa). O valor cru tem casas decimais que
 * não significam nada na prática — ninguém carrega 126,66666kg.
 */
export function roundE1rm(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Margem mínima para considerar um e1RM "superado". Sem ela, uma diferença de
 * 0,03kg — puro arredondamento da fórmula — anunciaria recorde toda sessão e o
 * aviso perderia o valor.
 */
const E1RM_PR_EPSILON = 0.5;

export function beatsE1rm(candidate: number, previous: number): boolean {
  return candidate > 0 && candidate >= previous + E1RM_PR_EPSILON;
}
