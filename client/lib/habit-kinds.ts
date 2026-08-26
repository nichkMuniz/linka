// Classificação de hábitos por NOME — usada pelas insígnias de hábito
// (Sono 7d, Meditação 5d, Sem álcool 7d, 10k passos 7d).
//
// Por que por nome e não por `habits.id`: o catálogo tem 25 hábitos, mas o
// usuário CRIA os seus (`habits.created_by_user`), e é justamente quem cria
// "Dormir 7h" ou "Meditação matinal" que espera a insígnia sair. Fixar IDs de
// catálogo deixaria esses de fora para sempre. Mesma decisão (e mesma forma) de
// `getCardioKind` em `cardio-exercises.ts`.
//
// As palavras-chave existem em PT e EN porque o nome chega localizado
// (`pickLocalized`) e o hábito custom é escrito no idioma da pessoa.

export type HabitKind = "sleep" | "meditation" | "no_alcohol" | "steps" | "other";

function normalizeHabitName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// A ORDEM importa: o primeiro grupo que casar define o tipo. `no_alcohol` vem
// antes porque "evitar bebidas alcoólicas" também contém "beber".
const HABIT_KIND_KEYWORDS: Array<[HabitKind, string[]]> = [
  ["no_alcohol", ["alcool", "alcoolica", "alcoolico", "alcohol", "alcoholic", "cerveja", "beer", "sobriedade", "sober"]],
  // Respiração guiada entra como meditação: é a mesma prática de atenção plena
  // ("Respirar profundamente por alguns minutos" é item do catálogo).
  ["meditation", ["meditar", "meditacao", "meditate", "meditation", "mindfulness", "respirar", "respiracao", "breath"]],
  // "Evitar dormir com celular na cama" casa aqui de propósito — higiene do
  // sono é hábito de sono.
  ["sleep", ["dormir", "sono", "sleep", "bedtime"]],
  ["steps", ["passos", "steps", "caminhar", "caminhada", "walk", "pedometro", "pedometer"]],
];

/**
 * Tipo de um hábito a partir do nome. Sempre devolve algo — o que não casar com
 * nenhuma palavra-chave é `other`, que nenhuma insígnia consome.
 */
export function getHabitKind(name?: string | null): HabitKind {
  const n = normalizeHabitName(name ?? "");
  if (!n) return "other";
  for (const [kind, words] of HABIT_KIND_KEYWORDS) {
    if (words.some((w) => n.includes(w))) return kind;
  }
  return "other";
}
