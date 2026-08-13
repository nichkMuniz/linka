/**
 * Sonda do vídeo do flow: capa (poster) + duração real, medidas NO MOMENTO DO POST.
 *
 * Duas coisas que o viewer não consegue obter sozinho a tempo:
 *
 * 1. **Capa** — um flow em vídeo pesa alguns MB; até o primeiro frame decodificar, o
 *    viewer mostraria tela preta. Um JPEG leve do 1º frame (atributo `poster` do
 *    <video>) aparece instantaneamente enquanto o clipe baixa.
 *
 * 2. **Duração** — o `MediaRecorder` do iOS grava MP4 **fragmentado**, cujo cabeçalho
 *    não traz a duração: `video.duration` fica `Infinity` até o arquivo INTEIRO ser
 *    baixado. No viewer isso significa barra de progresso parada em 0 por vários
 *    segundos (é o bug de "passar para o próximo flow e a barra não acompanhar").
 *    Aqui o arquivo é local, então forçar o cálculo custa milissegundos — e a duração
 *    vai para o banco (`flow.duration_ms`), de onde o viewer a lê na hora.
 *
 * Roda sobre a blob: URL que o usuário acabou de gravar/escolher — sem CORS, sem canvas
 * "tainted". Qualquer falha retorna vazio: são ganhos de percepção, nunca bloqueio para
 * publicar o flow.
 */

export type VideoProbe = {
  /** JPEG do 1º frame, ou `null` se não deu para extrair. */
  poster: Blob | null;
  /** Duração real em milissegundos, ou `null` se não deu para medir. */
  durationMs: number | null;
};

const EMPTY_PROBE: VideoProbe = { poster: null, durationMs: null };

/** Espera um evento do elemento com teto de tempo. Resolve `false` se estourar. */
function waitForEvent(el: HTMLElement, event: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      el.removeEventListener(event, onEvent);
      el.removeEventListener("error", onError);
      resolve(ok);
    };
    const onEvent = () => finish(true);
    const onError = () => finish(false);
    const timer = setTimeout(() => finish(false), timeoutMs);
    el.addEventListener(event, onEvent, { once: true });
    el.addEventListener("error", onError, { once: true });
  });
}

const hasFiniteDuration = (v: HTMLVideoElement) =>
  Number.isFinite(v.duration) && v.duration > 0;

/**
 * Força o cálculo da duração em vídeos fragmentados (duration = Infinity): um seek para
 * um tempo absurdo faz o WebKit varrer o arquivo e assumir a duração real. Como a fonte
 * é local (blob:), isso é praticamente instantâneo — no viewer, sobre HTTP, seria uma
 * espera de segundos, que é justamente o que estamos evitando.
 */
async function resolveDuration(v: HTMLVideoElement): Promise<number | null> {
  if (hasFiniteDuration(v)) return v.duration;

  try {
    v.currentTime = 1e101;
  } catch {
    return null;
  }

  // `durationchange` é o sinal direto; `seeked` cobre WebViews que só reposicionam.
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    const changed = await Promise.race([
      waitForEvent(v, "durationchange", 1000),
      waitForEvent(v, "seeked", 1000),
    ]);
    if (hasFiniteDuration(v)) return v.duration;
    if (!changed && Date.now() >= deadline) break;
  }

  return hasFiniteDuration(v) ? v.duration : null;
}

/**
 * Extrai capa + duração de um vídeo local.
 *
 * @param src blob:/data: URL do vídeo
 * @param maxWidth largura máxima do JPEG da capa (a altura acompanha a proporção)
 */
export async function probeFlowVideo(
  src: string,
  maxWidth = 720,
  quality = 0.72,
): Promise<VideoProbe> {
  if (typeof document === "undefined" || !src) return EMPTY_PROBE;

  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = src;

  try {
    // `loadeddata` = primeiro frame já decodificado e pronto para desenhar.
    const loaded = await waitForEvent(video, "loadeddata", 8000);
    if (!loaded) return EMPTY_PROBE;

    const durationSec = await resolveDuration(video);
    const durationMs = durationSec ? Math.round(durationSec * 1000) : null;

    // O frame exato do instante 0 costuma sair preto (fade-in do encoder), e o seek da
    // medição deixou o cursor no fim: volta para um ponto com conteúdo de verdade.
    try {
      video.currentTime = 0.1;
      await waitForEvent(video, "seeked", 1500);
    } catch {
      /* segue com o frame atual */
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return { poster: null, durationMs };

    const scale = Math.min(1, maxWidth / vw);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(vw * scale);
    canvas.height = Math.round(vh * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return { poster: null, durationMs };
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const poster = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
    });

    return { poster, durationMs };
  } catch {
    return EMPTY_PROBE;
  } finally {
    // Libera o decoder — sem isso o WebView do iOS segura o buffer do vídeo.
    video.removeAttribute("src");
    try {
      video.load();
    } catch {
      /* ignora */
    }
  }
}
