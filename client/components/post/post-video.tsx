import React from "react";
import { Play, Volume2, VolumeX } from "lucide-react";
import { releaseVideoElement } from "@/lib/media-prefetch";
import { useLanguage } from "@/lib/language-context";
import { hapticLight } from "@/lib/haptics";
import { reportHandledError } from "@/lib/monitoring";
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
 * 4. **Nunca fica travado (2026-10-08).** Um vigia no player ativo detecta a
 *    imagem congelada com áudio andando e o vídeo parado sem motivo, e troca o
 *    `<video>` por um novo no mesmo ponto. Ver "Vigia de travamento" abaixo.
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
 * — às vezes sem lançar erro, só deixando pausado —, toca mudo, e reflete no
 * botão. Mudo costuma ser sempre permitido; a exceção é o Modo de Pouca
 * Energia, que barra até o mudo (`NotAllowedError`) → "blocked", e o post
 * mostra o botão de play na hora (só um toque libera).
 */
async function playVideo(
  video: HTMLVideoElement,
  isCancelled: () => boolean,
): Promise<"ok" | "blocked" | "failed"> {
  // Recurso ainda não selecionado: play() direto às vezes traz só o áudio.
  if (video.readyState === 0 && video.networkState !== 2 /* NETWORK_LOADING */) {
    try {
      video.load();
    } catch {
      /* ignora */
    }
  }
  let error: unknown = null;
  try {
    await video.play();
  } catch (err) {
    /* pode rejeitar OU virar no-op silencioso — checado abaixo */
    error = err;
  }
  if (isCancelled() || !video.paused) return "ok";
  if (!video.muted) {
    video.muted = true;
    setMutedState(true);
    error = null;
    try {
      await video.play();
    } catch (err) {
      error = err;
    }
    if (isCancelled() || !video.paused) return "ok";
  }
  // Os demais (ex.: AbortError de um pause no meio) ficam com o vigia.
  return (error as { name?: string } | null)?.name === "NotAllowedError" ? "blocked" : "failed";
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

// ── Vigia de travamento (2026-10-08) ────────────────────────────────────────
// No iPhone o player do feed travava de dois jeitos, sem disparar evento:
//  (a) a imagem congelava e o áudio seguia — o WebKit perde a faixa de vídeo
//      do elemento;
//  (b) o vídeo parava e nenhum play() o tirava dali.
// O vigia roda 1×/s no player ATIVO e, quando detecta um deles, troca o
// <video> por um novo (remonta, `key`) no mesmo ponto do vídeo. Remontar é o
// único remédio confiável para (a): o elemento travado não volta a pintar com
// pause/play.
const WATCHDOG_MS = 1000;
/** Sem frame novo por este tempo, com o relógio do vídeo andando = imagem congelada. */
const FROZEN_FRAMES_MS = 2500;
/** Relógio parado com dados em buffer = travado. */
const TIME_STUCK_MS = 4000;
/** Relógio parado esperando rede, sem o buffer crescer = conexão morta. */
const NETWORK_STUCK_MS = 9000;
/** Ticks seguidos em pausa (sem ninguém ter pedido) antes de remontar. */
const PAUSED_TICKS_LIMIT = 3;
/** Durante a rolagem o WebKit pode atrasar timers e callbacks de frame: não julga. */
const SCROLL_GRACE_MS = 900;
/** Carência depois de (re)começar a tocar, antes de o vigia julgar. */
const SETTLE_MS = 2000;
/** Remontagens permitidas por janela; passou disso, mostra o botão de play. */
const MAX_RECOVERIES = 3;
const RECOVERY_WINDOW_MS = 60_000;

let lastScrollAt = 0;
if (typeof window !== "undefined") {
  window.addEventListener(
    "scroll",
    () => {
      lastScrollAt = performance.now();
    },
    { passive: true, capture: true },
  );
}

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

type StuckReason = "frozen-frames" | "time-stuck" | "network" | "paused" | "error" | "blocked";

function PostVideoElement({
  src,
  shouldPlay,
  muted,
  startAt,
  videoRef,
  onFirstFrame,
  onStuck,
}: {
  src: string;
  shouldPlay: boolean;
  muted: boolean;
  /** Segundo em que retoma (remontagem depois de travar). */
  startAt: number;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  onFirstFrame: () => void;
  onStuck: (reason: StuckReason, currentTime: number) => void;
}) {
  const ref = React.useRef<HTMLVideoElement | null>(null);
  const onStuckRef = React.useRef(onStuck);
  onStuckRef.current = onStuck;
  // Último frame pintado (requestVideoFrameCallback). 0 = nenhum ainda.
  const lastFrameAtRef = React.useRef(0);

  // O React nem sempre aplica `muted` no primeiro render — mantém imperativo.
  React.useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted]);

  // Retoma do ponto onde o player anterior travou.
  React.useEffect(() => {
    const video = ref.current;
    if (!video || startAt <= 0) return;
    const seek = () => {
      const d = video.duration;
      // Perto do fim: deixa começar do 0.
      if (Number.isFinite(d) && startAt >= d - 0.5) return;
      try {
        video.currentTime = startAt;
      } catch {
        /* ignora */
      }
    };
    if (video.readyState >= 1) seek();
    else video.addEventListener("loadedmetadata", seek, { once: true });
    return () => video.removeEventListener("loadedmetadata", seek);
  }, [startAt]);

  // Contador de frames pintados: é o que distingue "tocando" de "áudio tocando
  // com a imagem congelada" (o currentTime anda nos dois casos). Sem a API
  // (iOS < 15.4), o caso (a) não é detectado — os demais continuam valendo.
  React.useEffect(() => {
    const video = ref.current as VideoWithFrameCallback | null;
    if (!video || typeof video.requestVideoFrameCallback !== "function") return;
    let handle = 0;
    let alive = true;
    const onFrame = () => {
      if (!alive) return;
      lastFrameAtRef.current = performance.now();
      handle = video.requestVideoFrameCallback!(onFrame);
    };
    handle = video.requestVideoFrameCallback(onFrame);
    return () => {
      alive = false;
      try {
        video.cancelVideoFrameCallback?.(handle);
      } catch {
        /* ignora */
      }
    };
  }, []);

  React.useEffect(() => {
    const video = ref.current;
    if (!video || !shouldPlay) return;
    let cancelled = false;
    const start = () => {
      void playVideo(video, () => cancelled).then((outcome) => {
        if (outcome === "blocked" && !cancelled) onStuckRef.current("blocked", video.currentTime);
      });
    };
    requestPlay({ video, start });

    // Vigia — só julga enquanto este é o player da vez e o app está à frente.
    let lastTime = video.currentTime;
    let lastTimeChangeAt = performance.now();
    let lastBufferedEnd = 0;
    let lastBufferGrowthAt = performance.now();
    let pausedTicks = 0;
    let frozenTicks = 0;
    // Depois de (re)começar a tocar o relógio e os frames levam um instante para
    // andar: não julga até aqui. Sem isso, o post que recupera a vez (o de cima
    // saiu da tela) seria remontado pelo tempo em que ficou pausado.
    let settleUntil = performance.now() + SETTLE_MS;
    let wasActive = true;
    const settle = (now: number) => {
      settleUntil = now + SETTLE_MS;
      lastTimeChangeAt = now;
      lastBufferGrowthAt = now;
      frozenTicks = 0;
    };
    const bufferedEnd = () => {
      try {
        const b = video.buffered;
        return b.length > 0 ? b.end(b.length - 1) : 0;
      } catch {
        return 0;
      }
    };
    const tick = () => {
      if (cancelled) return;
      const now = performance.now();
      if (activeVideo() !== video || document.visibilityState !== "visible") {
        wasActive = false;
        return;
      }
      if (!wasActive) {
        wasActive = true;
        settle(now);
      }
      const t = video.currentTime;
      if (t !== lastTime) {
        lastTime = t;
        lastTimeChangeAt = now;
      }
      const be = bufferedEnd();
      if (be > lastBufferedEnd + 0.05) {
        lastBufferedEnd = be;
        lastBufferGrowthAt = now;
      }

      if (video.paused) {
        // Ninguém pediu pausa (este é o player da vez): o iOS largou o vídeo.
        // Tenta de novo; persistindo, troca o elemento.
        pausedTicks += 1;
        if (pausedTicks > PAUSED_TICKS_LIMIT) {
          onStuckRef.current("paused", t);
          return;
        }
        start();
        settle(now);
        return;
      }
      pausedTicks = 0;
      if (now < settleUntil || now - lastScrollAt < SCROLL_GRACE_MS) {
        frozenTicks = 0;
        return;
      }

      // (a) imagem congelada com o áudio andando.
      const lastFrameAt = lastFrameAtRef.current;
      const timeMoving = now - lastTimeChangeAt < WATCHDOG_MS * 1.5;
      if (lastFrameAt > 0 && timeMoving && now - lastFrameAt > FROZEN_FRAMES_MS) {
        frozenTicks += 1;
        // Dois ticks seguidos: um tick atrasado sozinho não remonta nada.
        if (frozenTicks >= 2) {
          onStuckRef.current("frozen-frames", t);
          return;
        }
      } else {
        frozenTicks = 0;
      }

      // (b) relógio parado sem pausa.
      const stuckFor = now - lastTimeChangeAt;
      if (video.readyState >= 3 /* HAVE_FUTURE_DATA */ && stuckFor > TIME_STUCK_MS) {
        onStuckRef.current("time-stuck", t);
      } else if (stuckFor > NETWORK_STUCK_MS && now - lastBufferGrowthAt > NETWORK_STUCK_MS) {
        onStuckRef.current("network", t);
      }
    };
    const timer = window.setInterval(tick, WATCHDOG_MS);

    // `loop` às vezes não volta ao início no WebKit e dispara `ended`: recomeça.
    const onEnded = () => {
      try {
        video.currentTime = 0;
      } catch {
        /* ignora */
      }
      start();
    };
    video.addEventListener("ended", onEnded);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      video.removeEventListener("ended", onEnded);
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
      if (videoRef.current === video) videoRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <video
      ref={(el) => {
        ref.current = el;
        if (el) videoRef.current = el;
      }}
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
      onError={() => onStuckRef.current("error", ref.current?.currentTime ?? 0)}
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
  const { t } = useLanguage();
  const boxRef = React.useRef<HTMLDivElement>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [near, setNear] = React.useState(false);
  const [inView, setInView] = React.useState(false);
  const [pageHidden, setPageHidden] = React.useState(
    () => typeof document !== "undefined" && document.visibilityState === "hidden",
  );
  const [painted, setPainted] = React.useState(false);
  // Cada travamento troca o <video> por um novo (`instance` é a key), que
  // retoma em `resumeAt`.
  const [instance, setInstance] = React.useState(0);
  const [resumeAt, setResumeAt] = React.useState(0);
  // Travou demais em pouco tempo: para de remontar e mostra o botão de play.
  const [gaveUp, setGaveUp] = React.useState(false);
  const recoveriesRef = React.useRef<number[]>([]);
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

  // Saiu de perto: o player é desmontado e a próxima aparição começa limpa —
  // do início e com as tentativas zeradas (um post que travou volta a tocar
  // sozinho quando o usuário rola até ele de novo).
  React.useEffect(() => {
    if (near) return;
    setPainted(false);
    setResumeAt(0);
    setGaveUp(false);
    recoveriesRef.current = [];
  }, [near]);

  const handleStuck = React.useCallback(
    (reason: StuckReason, currentTime: number) => {
      // Autoplay barrado pelo sistema: remontar não adianta, só um toque.
      if (reason === "blocked") {
        setGaveUp(true);
        return;
      }
      const now = Date.now();
      const recent = recoveriesRef.current.filter((at) => now - at < RECOVERY_WINDOW_MS);
      if (recent.length >= MAX_RECOVERIES) {
        recoveriesRef.current = recent;
        setGaveUp(true);
        reportHandledError(new Error(`post video gave up (${reason})`), "post-video:watchdog", { src, reason });
        return;
      }
      recoveriesRef.current = [...recent, now];
      setResumeAt(Number.isFinite(currentTime) && currentTime > 0 ? currentTime : 0);
      setPainted(false);
      setInstance((n) => n + 1);
    },
    [src],
  );

  // Toque no play depois de desistir: play() DENTRO do gesto (o iOS libera o
  // que estava barrado) e o vigia volta a valer do zero.
  const retryFromTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    hapticLight();
    recoveriesRef.current = [];
    setGaveUp(false);
    const video = videoRef.current;
    if (video) {
      video.muted = mutedState;
      video.play().catch(() => {
        /* o vigia remonta se continuar parado */
      });
    } else {
      setInstance((n) => n + 1);
    }
  };

  return (
    <div ref={boxRef} className={cn("relative h-full w-full overflow-hidden bg-black", className)}>
      {near && (
        <PostVideoElement
          key={instance}
          src={src}
          shouldPlay={inView && !paused && !pageHidden && !gaveUp}
          muted={muted}
          startAt={resumeAt}
          videoRef={videoRef}
          onFirstFrame={() => setPainted(true)}
          onStuck={handleStuck}
        />
      )}
      {/* A capa fica POR CIMA do vídeo até o 1º frame. Antes era o vídeo que
          ficava invisível (opacity 0) até pintar — mexer na opacidade da camada
          do <video> enquanto ele começa a tocar é um gatilho conhecido do
          WebKit para a imagem congelar com o áudio andando. */}
      {poster && (
        <img
          src={poster}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="absolute inset-0 block h-full w-full object-cover"
          style={{ opacity: painted && !gaveUp ? 0 : 1, transition: "opacity .15s ease-out", pointerEvents: "none" }}
        />
      )}
      {gaveUp && (
        <button
          type="button"
          data-no-hold
          onClick={retryFromTap}
          aria-label={t("post_video_play")}
          className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-white active:scale-90 transition-transform"
          style={{ background: "rgba(0,0,0,.5)", border: "1px solid rgba(255,255,255,.2)" }}
        >
          <Play className="h-7 w-7 translate-x-[2px]" fill="currentColor" />
        </button>
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
