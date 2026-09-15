/**
 * Faixas aceitas para os dados físicos do perfil (idade, altura, peso) e os
 * helpers de digitação correspondentes.
 *
 * Por que num módulo próprio: os mesmos três campos são editados no cadastro
 * (`Login.tsx`, etapa 2.8), no drawer de configurações (aba "Dados pessoais") e
 * o peso ainda é registrado pelo histórico (`weight-history-drawer.tsx`). Com a
 * faixa escrita em cada tela, elas divergiram — as configurações aceitavam
 * 30–300 kg e 10–120 anos enquanto o cadastro barrava fora de 20–200 kg e
 * 1–100 anos, e o histórico de peso aceitava qualquer coisa abaixo de 1000 kg.
 * Todas as telas passam a ler daqui.
 *
 * Os limites são de sanidade, não clínicos: só barram o que é claramente erro
 * de digitação (175 kg de altura, 1200 anos de idade).
 */

export const PHYSICAL_LIMITS = {
  age: { min: 1, max: 100 },
  height: { min: 100, max: 300 },
  weight: { min: 20, max: 200 },
} as const;

/**
 * `true` quando o valor digitado está preenchido E fora da faixa. Campo vazio
 * nunca é erro — os três dados são opcionais em todas as telas.
 */
function outOfRange(raw: string, { min, max }: { min: number; max: number }, parse: (v: string) => number): boolean {
  const trimmed = raw.trim();
  if (trimmed === "") return false;
  const n = parse(trimmed.replace(",", "."));
  if (!Number.isFinite(n)) return true;
  return n < min || n > max;
}

export const isAgeOutOfRange = (raw: string) =>
  outOfRange(raw, PHYSICAL_LIMITS.age, (v) => parseInt(v, 10));

export const isHeightOutOfRange = (raw: string) =>
  outOfRange(raw, PHYSICAL_LIMITS.height, (v) => parseInt(v, 10));

export const isWeightOutOfRange = (raw: string) =>
  outOfRange(raw, PHYSICAL_LIMITS.weight, parseFloat);

/** Só dígitos — para idade e altura, que são inteiros. */
export const sanitizeIntInput = (raw: string) => raw.replace(/[^0-9]/g, "");

/**
 * Peso aceita decimal. Vírgula vira ponto e sobra no máximo um separador — o
 * texto cru é preservado enquanto a pessoa digita ("70." continua "70."), que é
 * o que um input controlado por número quebra no iOS (ver a memória
 * `decimal-number-inputs-ios`).
 */
export function sanitizeDecimalInput(raw: string): string {
  const onlyValid = raw.replace(",", ".").replace(/[^0-9.]/g, "");
  const firstDot = onlyValid.indexOf(".");
  if (firstDot === -1) return onlyValid;
  return onlyValid.slice(0, firstDot + 1) + onlyValid.slice(firstDot + 1).replace(/\./g, "");
}
