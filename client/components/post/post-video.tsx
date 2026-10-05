import React from "react";
import { Volume2, VolumeX } from "lucide-react";
import { releaseVideoElement } from "@/lib/media-prefetch";
import { useLanguage } from "@/lib/language-context";
import { hapticLight } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/**
 * Vídeo de um post do feed (2026-10-05) — o post em vídeo é um post comum, com
 * `photo` = capa (1º frame, 1:1) e `video_url` = o arquivo.
 *
 * Regras, nesta ordem de importância:
 *
 * 1. **Teto de players do WKWebView.** Manter um `<video>` vivo por post do
 *    feed derruba a faixa de vídeo dos players seguintes (sai áudio, nenhum
 *    frame). Por isso o elemento só existe enquanto o post está PERTO da tela
 *    (`MOUNT_MARGIN`) e é liberado com `releaseVideoElement` ao sair. Fora
 *    disso o frame mostra só a capa.
 * 2. **Um tocando por vez.** Dois posts meio visíveis não tocam juntos: quem
 *    começa pausa o anterior, e a vez volta a ele quando o novo sai
 *    (`wantsToPlay`).
 * 3. **Autoplay mudo.** O iOS sempre permite tocar mudo; com som pode ser
 *    barrado em silêncio. O som é um estado único para todos os posts (padrão
 *    Instagram): ligou num, segue ligado no próximo.
 */

// ── Som: um estado só para todos os posts em vídeo ──────────────────────────
let mutedState = true;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
function setMutedState(next: boolean) {
  if (mutedState === next) return;
  mutedState = next;
  listeners.forEach((l) => l());
}
export function usePostVideoMuted(): boolean {
  return React.useSyncExternalStore(subscribe, () => mutedState, () => true);
}

// ── Um tocando por vez ──────────────────────────────────────────────────────
// Pilha de quem QUER tocar (visível o bastante). Só o topo toca. Quando o topo
// sai, a vez volta ao anterior — sem isso, com dois posts na tela, o que foi
// pausado pelo mais novo ficaria parado depois que esse rolasse para fora.
type PlayRequest = { video: HTMLVideoElement; start: () => void };
const wantsToPlay: PlayRequest[] = [];

const activeVideo = () => wantsToPlay[wantsToPlay.length - 1]?.video ?? null;

function pauseQuietly(video: HTMLVideoElement) {
  try {
    video.pause();
  } catch {
    /* ignora */
  }
}

function dropRequest(video: HTMLVideoElement) {
  const idx = wantsToPlay.findIndex((r) => r.video === video);
  if (idx >= 0) wantsToPlay.splice(idx, 1);
}

function requestPlay(request: PlayRequest) {
  dropRequest(request.video);
  wantsToPlay.push(request);
  for (const r of wantsToPlay) if (r.video !== request.video) pauseQuietly(r.video);
  request.start();
}

function releasePlay(video: HTMLVideoElement) {
  const wasActive = activeVideo() === video;
  dropRequest(video);
  pauseQuietly(video);
  if (wasActive) wantsToPlay[wantsToPlay.length - 1]?.start();
}

/**
 * Autoplay resiliente: tenta como está (mudo ou com som); se o iOS barrar o som
 * — às vezes sem lançar erro, só deixando pausado —, toca mudo, que é sempre
 * permitido, e reflete no botão.
 */
async function playVideo(video: HTMLVideoElement, isCancelled: () => boolean) {
  // Recurso ainda não selecionado: play() direto às vezes traz só o áudio.
  if (video.readyState === 0 && video.networkState !== 2 /* NETWORK_LOADING */) {
    try {
      video.load();
    } catch {
      /* ignora */
    }
  }
  try {
    await video.play();
  } catch {
    /* pode rejeitar OU virar no-op silencioso — checado abaixo */
  }
  if (isCancelled() || !video.paused || video.muted) return;
  video.muted = true;
  setMutedState(true);
  try {
    await video.play();
  } catch {
    /* resta a capa */
  }
}

/**
 * Liga/desliga o som. Aplica no player atual DENTRO do toque — tirar o mudo
 * fora de um gesto do usuário pode fazer o WebKit pausar o vídeo.
 */
export function togglePostVideoMuted() {
  const next = !mutedState;
  const video = activeVideo();
  if (video) video.muted = next;
  setMutedState(next);
}

/** Monta o player um pouco antes de o post entrar na tela. */
const MOUNT_MARGIN = "300px 0px";
/** Fração visível do frame para tocar. */
const PLAY_RATIO = 0.6;

function PostVideoElement({
  src,
  shouldPlay,
  muted,
  onFirstFrame,
  onError,
}: {
  src: string;
  shouldPlay: boolean;
  muted: boolean;
  onFirstFrame: () => void;
  onError: () => void;
}) {
  const ref = React.useRef<HTMLVideoElement | null>(null);

  // O React nem sempre aplica `muted` no primeiro render — mantém imperativo.
  React.useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted]);

  React.useEffect(() => {
    const video = ref.current;
    if (!video || !shouldPlay) return;
    let cancelled = false;
    requestPlay({ video, start: () => void playVideo(video, () => cancelled) });
    return () => {
      cancelled = true;
      releasePlay(video);
    };
  }, [shouldPlay]);

  // Desmonte libera o player na hora (não espera a coleta de lixo do WebKit).
  // Declarado DEPOIS do efeito de play: a limpeza dele (sair da pilha) roda
  // antes desta, e o próximo da pilha assume já com este elemento solto.
  React.useEffect(() => {
    const video = ref.current;
    return () => {
      if (video) releaseVideoElement(video);
    };
  }, []);

  return (
    <video
      ref={ref}
      src={src}
      muted={muted}
      loop
      playsInline
      preload="metadata"
      // webkit-playsinline: inline no WKWebView; airplay negado para o iOS não
      // sequestrar o player.
      {...({ "webkit-playsinline": "true", "x-webkit-airplay": "deny" } as React.VideoHTMLAttributes<HTMLVideoElement>)}
      className="absolute inset-0 h-full w-full object-cover"
      // Toques atravessam: o card decide (abrir o post, toque duplo, segurar).
      style={{ pointerEvents: "none" }}
      onPlaying={onFirstFrame}
      onError={onError}
    />
  );
}

interface PostVideoProps {
  src: string;
  /** Capa (o `photo` do post), já na URL que o frame deve pedir. */
  poster?: string | null;
  alt: string;
  /** Pausa à força — ex.: "segurar" o post para esconder a interface. */
  paused?: boolean;
  className?: string;
}

export function PostVideo({ src, poster, alt, paused = false, className }: PostVideoProps) {
  const boxRef = React.useRef<HTMLDivElement>(null);
  const [near, setNear] = React.useState(false);
  const [inView, setInView] = React.useState(false);
  const [pageHidden, setPageHidden] = React.useState(
    () => typeof document !== "undefined" && document.visibilityState === "hidden",
  );
  const [painted, setPainted] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const muted = usePostVideoMuted();

  React.useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      setInView(true);
      return;
    }
    const nearObs = new IntersectionObserver(([e]) => setNear(e.isIntersecting), {
      rootMargin: MOUNT_MARGIN,
    });
    const viewObs = new IntersectionObserver(
      ([e]) => setInView(e.isIntersecting && e.intersectionRatio >= PLAY_RATIO),
      { threshold: [0, PLAY_RATIO, 1] },
    );
    nearObs.observe(el);
    viewObs.observe(el);
    return () => {
      nearObs.disconnect();
      viewObs.disconnect();
    };
  }, []);

  // App em segundo plano: o iOS pausa sozinho, mas sem este estado o vídeo não
  // voltaria a tocar ao reabrir (nada mais mudaria para refazer o play).
  React.useEffect(() => {
    const onVisibility = () => setPageHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Saiu de perto: o player é desmontado; ao voltar, a capa cobre até pintar.
  React.useEffect(() => {
    if (!near) setPainted(false);
  }, [near]);

  const mountVideo = near && !failed;

  return (
    <div ref={boxRef} className={cn("relative h-full w-full overflow-hidden bg-black", className)}>
      {poster && (
        <img
          src={poster}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="absolute inset-0 block h-full w-full object-cover"
        />
      )}
      {mountVideo && (
        <div
          className="absolute inset-0"
          // Some por opacidade até o 1º frame: sem isso o <video> recém-montado
          // pintaria preto por cima da capa.
          style={{ opacity: painted ? 1 : 0, transition: "opacity .15s ease-out" }}
        >
          <PostVideoElement
            src={src}
            shouldPlay={inView && !paused && !pageHidden}
            muted={muted}
            onFirstFrame={() => setPainted(true)}
            onError={() => setFailed(true)}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Botão de som do post em vídeo. Fica FORA do frame (no canto das ações do
 * card) porque o rodapé do frame já é da legenda e da barra de incentivos.
 */
export function PostVideoMuteButton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const { t } = useLanguage();
  const muted = usePostVideoMuted();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        hapticLight();
        togglePostVideoMuted();
      }}
      aria-label={muted ? t("post_video_unmute") : t("post_video_mute")}
      className={cn("flex items-center justify-center text-white active:scale-90 transition-transform", className)}
      // Mesmo visual do botão ⋮ ao lado (fundo sólido, sem blur — ver post-card).
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: "rgba(0,0,0,.4)",
        border: "1px solid rgba(255,255,255,.16)",
        ...style,
      }}
    >
      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
    </button>
  );
}
