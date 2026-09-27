import {
  createStoryDb,
  invalidateQueryCache,
  type Story,
  type StoryPostSticker,
} from "@/lib/ritmofit-db";

/**
 * "Seu flow" a partir de um post do feed (estilo Instagram "adicionar ao story").
 *
 * O flow NÃO copia a foto nem gera imagem: é um flow de fundo (gradiente da
 * marca, sem `media_url`) com um único elemento `kind: "post"` em
 * `text_elements`. O viewer desenha a moldura do post ao vivo (`FlowPostCard`:
 * chip do autor + foto) e o toque nela abre `/post/:id`.
 *
 * Por que referência e não cópia:
 *  - a moldura mostra de onde o flow veio e leva à postagem;
 *  - sem mídia própria, apagar o flow não mexe no Storage — `deleteStoryDb`
 *    só remove arquivos de `media_url`/`poster_url`, e aqui não há nenhum.
 *    (Reaproveitar o arquivo do post em `media_url` faria apagar o flow apagar a
 *    foto do post.)
 */

/** Mesmo gradiente da moldura de repost (docs/15-design-system.md §12.6). */
export const POST_FLOW_BACKGROUND = "linear-gradient(160deg,#1c2340 0%,#241a3a 55%,#0e0d14 100%)";

export async function sharePostToFlow(post: StoryPostSticker): Promise<Story> {
  const story = await createStoryDb(
    "",
    "",
    POST_FLOW_BACKGROUND,
    null,
    [{ kind: "post", text: "", x: 50, y: 46, post }],
    null,
  );
  if (!story) throw new Error("Não foi possível criar o flow");
  invalidateQueryCache("activeStories");
  invalidateQueryCache("userActiveStories");
  return story;
}
