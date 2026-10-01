// "Zerou a máquina?" — a partir de que carga o modo treino faz o convite.
//
// O peso que "zera" uma máquina depende da região: o pino de leg press, cadeira
// extensora ou panturrilha vai bem além de 120kg, enquanto peck deck, puxada ou
// máquina de ombro costumam terminar perto de 80kg. Com um limite só (120kg),
// quem zerava uma máquina de membros superiores nunca era convidado.
//
// A classificação usa `workouts.muscle_group` (rótulo grosso, ~15 valores no
// catálogo). O banco grava "Gluteos" SEM acento — por isso a comparação
// normaliza acentos e caixa.

/** Membros inferiores: convite com MAIS de 120kg (regra original). */
export const MACHINE_MAXED_LOWER_KG = 120;
/** Membros superiores (e core): convite A PARTIR de 80kg. */
export const MACHINE_MAXED_UPPER_KG = 80;

const LOWER_BODY_GROUPS = new Set([
  "pernas",
  "gluteos",
  "panturrilha",
  "quadriceps",
  "posterior",
  "posterior de coxa",
  "adutores",
  "abdutores",
]);

const UPPER_BODY_GROUPS = new Set([
  "peito",
  "costas",
  "ombros",
  "biceps",
  "triceps",
  "antebraco",
  "trapezio",
  // Máquinas de abdominal/core terminam na mesma faixa das de tronco.
  "abdomen",
  "core",
]);

function normalizeGroup(group: string | null | undefined): string {
  return (group ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

export type MachineRegion = "lower" | "upper";

/**
 * Região da máquina pelo grupo muscular. Grupo desconhecido, vazio ou "Full
 * body" conta como INFERIOR — mantém o limite antigo (120kg), o mais
 * conservador: na dúvida, o convite não aparece cedo demais.
 */
export function machineRegion(muscleGroup: string | null | undefined): MachineRegion {
  return UPPER_BODY_GROUPS.has(normalizeGroup(muscleGroup)) ? "upper" : "lower";
}

/**
 * A carga da série é suficiente para convidar a marcar "máquina zerada"?
 * Inferiores: > 120kg ("mais de 120"). Superiores: >= 80kg ("a partir de 80").
 */
export function isMachineMaxedLoad(kg: number, muscleGroup: string | null | undefined): boolean {
  if (!(kg > 0)) return false;
  return machineRegion(muscleGroup) === "upper"
    ? kg >= MACHINE_MAXED_UPPER_KG
    : kg > MACHINE_MAXED_LOWER_KG;
}
