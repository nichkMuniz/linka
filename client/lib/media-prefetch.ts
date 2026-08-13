/**
 * Pré-aquecimento da mídia dos flows.
 *
 * Entre tocar no ring e o viewer montar o <video> passam algumas centenas de
 * milissegundos — tempo em que a rede está ociosa. Começar o download ANTES do toque
 * (ou logo que o ring aparece) faz o vídeo já ter bytes em cache quando o player pede,
 * e o flow abre praticamente instantâneo.
 *
 * `metadata` baixa só o cabeçalho + primeiro frame (dezenas de KB) — barato o bastante
 * para disparar por antecipação. `auto` baixa o clipe e só deve ser usado quando o toque
 * já aconteceu (ou é iminente).
 */

type PrefetchTarget = {
  media_url?: string | null;
  poster_url?: string | null;
} | null | undefined;

// Já aquecido nesta sessão (por URL + modo) — evita repetir download a cada render.
const warmed = new Set<string>();
// Mantém os elementos vivos por um tempo: se forem coletados na hora, o WebKit
// descarta o buffer junto e o aquecimento não serve para nada.
const keepAlive: HTMLVideoElement[] = [];
const KEEP_ALIVE_MS = 60_000;
const KEEP_ALIVE_MAX = 4;

function isVideoUrl(url: string): boolean {
  return url.includes(".mp4") || url.includes(".webm") || url.includes(".mov");
}

/**
 * Devolve ao sistema o player/decoder que um <video> segura.
 *
 * No WKWebView do iOS existe um TETO de players de vídeo simultâneos. Tirar o
 * elemento do DOM não basta: o recurso de mídia só é solto quando o WebKit
 * coleta o elemento, o que pode demorar segundos. Enquanto isso, o próximo
 * vídeo a tocar entra sem faixa de vídeo — sai o ÁUDIO, mas nenhum frame é
 * pintado (tela preta ou congelada no primeiro frame).
 *
 * Remover o `src` e chamar `load()` zera o `networkState` na hora e libera o
 * player imediatamente. Sempre chame isto ao desmontar um <video>.
 */
export function releaseVideoElement(v: HTMLVideoElement) {
  try {
    v.pause();
  } catch {
    /* ignora */
  }
  v.removeAttribute("src");
  try {
    v.load();
  } catch {
    /* ignora */
  }
}

function releaseVideo(v: HTMLVideoElement) {
  const idx = keepAlive.indexOf(v);
  if (idx >= 0) keepAlive.splice(idx, 1);
  releaseVideoElement(v);
}

/**
 * Aquece a mídia de um flow. Seguro para chamar várias vezes — repete no máximo uma vez
 * por URL/modo.
 */
export function prefetchFlowMedia(story: PrefetchTarget, mode: "metadata" | "auto" = "metadata") {
  if (typeof document === "undefined" || !story) return;

  // A capa é pequena e é o que aparece primeiro na tela: sempre vale a pena.
  const poster = story.poster_url;
  if (poster && !warmed.has(poster)) {
    warmed.add(poster);
    const img = new Image();
    img.decoding = "async";
    img.src = poster;
  }

  const url = story.media_url;
  if (!url) return;

  const key = `${mode}:${url}`;
  // "auto" depois de "metadata" continua valendo a pena (completa o download).
  if (warmed.has(key) || warmed.has(`auto:${url}`)) return;
  warmed.add(key);

  if (!isVideoUrl(url)) {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    return;
  }

  const v = document.createElement("video");
  v.preload = mode;
  v.muted = true;
  v.playsInline = true;
  v.src = url;

  keepAlive.push(v);
  while (keepAlive.length > KEEP_ALIVE_MAX) releaseVideo(keepAlive[0]);
  setTimeout(() => releaseVideo(v), KEEP_ALIVE_MS);
}
