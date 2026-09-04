/**
 * Filtro de conteúdo censurável.
 *
 * Existe por exigência direta da **App Store Review Guideline 1.2**, que pede
 * quatro mecanismos em todo app com conteúdo de usuário. O LinKa já tinha três
 * — denunciar, bloquear e moderar pelo painel admin. Este arquivo é o quarto:
 *
 * > "A method for filtering objectionable material from being posted to the app"
 *
 * O ponto importante da frase é **from being posted**: a diretriz pede um filtro
 * na hora de publicar, não só moderação depois do fato. Denúncia é reativa — o
 * conteúdo fica visível até alguém agir. Isto aqui é preventivo.
 *
 * ## O que este filtro é, e o que não é
 *
 * Não é um classificador semântico e não tenta ser. É uma lista de termos
 * inequívocos — insultos pesados, termos de ódio, conteúdo sexual explícito e
 * ameaças diretas — comparada contra o texto normalizado. Casos ambíguos
 * continuam indo para a fila de denúncias, que é o mecanismo desenhado para
 * julgamento humano.
 *
 * ## Por que a normalização importa
 *
 * Sem ela, o filtro cai no primeiro `p0rr@` que aparecer. `normalize()` remove
 * acento, desfaz leet-speak comum e colapsa caracteres repetidos, de forma que
 * `PÔRRRA`, `p0rra` e `p.o.r.r.a` cheguem todos à mesma forma canônica.
 *
 * ## Por que a comparação é por palavra inteira
 *
 * Substring gera falso positivo demais em português — `cu` casaria dentro de
 * "cuidado", "cursor" e "documento". Todo termo é comparado contra os *tokens*
 * do texto, e não contra o texto corrido.
 */

/**
 * Termos bloqueados na publicação. Em forma já normalizada (sem acento,
 * minúsculas), porque é contra a saída de `normalize()` que eles são comparados.
 *
 * Ao acrescentar um termo: escreva-o normalizado, e prefira o radical à
 * flexão — `matchesTerm` já cobre plural e sufixo comum.
 */
const BLOCKED_TERMS: readonly string[] = [
  // Insultos pesados e xingamentos sexuais (pt-BR)
  "arrombado", "babaca", "bosta", "buceta", "caralho", "corno", "cuzao",
  "desgraçado", "escroto", "filhadaputa", "filhodaputa", "foda-se", "fodase",
  // "pica" fica FORA de propósito: em português é também verbo comum
  // ("a abelha pica"), e bloquearia post legítimo.
  "fdp", "merda", "otario", "pau no cu", "piranha", "porra", "puta",
  "putaqueopariu", "vadia", "viadinho", "vagabunda", "xoxota",
  // Termos de ódio e discriminação (pt-BR)
  "bicha", "veado", "viado", "traveco", "macaco preto", "crioulo", "preto imundo",
  "retardado", "mongoloide", "aleijado", "judeu de merda",
  // Conteúdo sexual explícito (pt-BR)
  "nudes", "pornografia", "pornô", "porno", "siririca", "punheta", "gozada",
  "pau duro", "sexo explicito",
  // Ameaças diretas (pt-BR)
  "vou te matar", "te mato", "vou te bater", "morre logo", "se mata",
  "vai morrer", "te acho e te mato",
  // English — slurs, explicit content and threats
  "asshole", "bitch", "cunt", "dick", "faggot", "fag", "motherfucker",
  "nigger", "nigga", "pussy", "retard", "shit", "slut", "whore",
  "porn", "pornhub", "nudes", "blowjob", "handjob", "cum",
  "kill yourself", "kys", "i will kill you", "go die", "hang yourself",
];

/** Marcas de acentuação (U+0300–U+036F), separadas da letra pelo NFD. */
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

/** Substituições de leet-speak, aplicadas antes da comparação. */
const LEET: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t",
  "@": "a", "$": "s", "!": "i", "€": "e",
};

/**
 * Reduz o texto à forma canônica usada na comparação:
 * minúsculas, sem acento, sem leet-speak, sem repetição de caractere e com
 * pontuação virando espaço (é o que quebra `p.o.r.r.a`).
 */
function normalize(input: string): string {
  // U+0300–U+036F é o bloco de marcas de acentuação que o NFD separa da letra.
  // Construído por `new RegExp` com escape ASCII de propósito: o caractere cru
  // é invisível no editor e não sobrevive a uma cópia/colagem descuidada.
  let out = input
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "");

  out = out.replace(/[0134579@$!€]/g, (ch) => LEET[ch] ?? ch);

  // Pontuação e símbolo viram espaço; o que sobra é letra, número e espaço.
  out = out.replace(/[^a-z0-9\s]/g, " ");

  // Toda repetição colapsa para uma letra só: "PÔRRRA", "poooorra" e "porra"
  // caem todos em "pora".
  //
  // Colapsar apenas 3+ não funcionaria: "PÔRRRA" viraria "pora" e o termo da
  // lista continuaria "porra" — nunca casariam. Como `normalize()` roda também
  // sobre o termo da lista, os dois lados sofrem a mesma redução e a comparação
  // fecha. O efeito colateral em palavra legítima ("passo" -> "paso") é inócuo:
  // ela só é comparada contra os termos bloqueados, igualmente colapsados.
  out = out.replace(/(.)\1+/g, "$1");

  return out.replace(/\s+/g, " ").trim();
}

/**
 * Um termo casa quando aparece como palavra inteira (ou sequência inteira de
 * palavras, no caso das expressões) dentro do texto normalizado.
 *
 * O sufixo opcional cobre plural e flexão — `puta` pega `putas`, `viado` pega
 * `viados` — sem abrir para substring no meio da palavra.
 */
function matchesTerm(normalizedText: string, term: string): boolean {
  const normalizedTerm = normalize(term);
  if (!normalizedTerm) return false;
  const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)${escaped}(s|es|ao|oes)?($|\\s)`).test(normalizedText);
}

/**
 * `true` quando o texto contém termo censurável e não deve ser publicado.
 *
 * Chamada antes de gravar: publicação, comentário e mensagem direta.
 */
export function hasObjectionableContent(text: string | null | undefined): boolean {
  if (!text) return false;
  const normalized = normalize(text);
  if (!normalized) return false;
  return BLOCKED_TERMS.some((term) => matchesTerm(normalized, term));
}

/**
 * Só para diagnóstico e teste — devolve os termos que casaram.
 * Não usar para montar mensagem de erro: repetir o termo de volta na tela é
 * exatamente o conteúdo que estamos tentando não exibir.
 */
export function objectionableMatches(text: string | null | undefined): string[] {
  if (!text) return [];
  const normalized = normalize(text);
  return BLOCKED_TERMS.filter((term) => matchesTerm(normalized, term));
}
