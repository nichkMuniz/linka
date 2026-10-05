import * as React from "react";
import type { StoryWithUser } from "@/lib/ritmofit-db";
import { PinnedFlowCover } from "@/components/profile/pinned-flows-strip";

const VIDEO_RE = /\.(mp4|mov|webm|m4v)(\?|#|$)/i;

/** Espera antes do 1º giro: a tela termina de entrar e o olho chega no avatar. */
const START_DELAY_MS = 650;
/** Teto de espera pela capa — rede ruim não pode segurar a animação para sempre. */
const COVER_WAIT_MS = 1500;
const FLIP_DURATION_MS = 3400;

/** Capa que o verso vai pintar — a mesma ordem de preferência do `PinnedFlowCover`. */
function coverImageUrl(flow: StoryWithUser): string | null {
  if (flow.poster_url) return flow.poster_url;
  const media = flow.media_url ?? null;
  return media && !VIDEO_RE.test(media) ? media : null;
}

/** Resolve quando a capa está decodificada (ou no teto) — o verso nunca aparece vazio. */
function waitForCover(url: string | null): Promise<void> {
  if (!url) return Promise.resolve();
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(resolve, COVER_WAIT_MS);
    img.onload = img.onerror = () => {
      clearTimeout(timer);
      resolve();
    };
    img.decoding = "async";
    img.src = url;
  });
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

interface FlowCoinAvatarProps {
  /** Frente da moeda — a foto de perfil. */
  front: React.ReactNode;
  /** Flow que o verso mostra. `null` = sem flow ativo: só a frente, sem giro. */
  flow: StoryWithUser | null;
  /**
   * Gira uma vez por valor desta chave (o id do perfil). Pull-to-refresh e a
   * troca do flow de entrada depois que os "já vistos" chegam NÃO giram de novo.
   */
  flipKey: string | undefined;
}

/**
 * Avatar do perfil que gira como uma **moeda** quando o dono tem flow ativo:
 * mostra a capa do flow por ~1,7s e gira de volta para a foto. Só o disco gira;
 * o anel em volta fica parado (é ele que diz "tem flow").
 *
 * Os dois lados são faces 3D com `backface-visibility: hidden`. O
 * `overflow-hidden` fica em cada FACE, nunca no elemento que gira: no WebKit,
 * `overflow` num elemento `preserve-3d` achata o 3D e as duas faces se
 * sobrepõem.
 */
export function FlowCoinAvatar({ front, flow, flipKey }: FlowCoinAvatarProps) {
  const coinRef = React.useRef<HTMLDivElement>(null);
  const flippedForRef = React.useRef<string | undefined>(undefined);
  // O verso congela no flow do momento do giro — se a lista mudar no meio, a
  // moeda não troca de imagem em pleno ar.
  const [backFlow, setBackFlow] = React.useState<StoryWithUser | null>(null);
  const flowRef = React.useRef(flow);
  flowRef.current = flow;

  const hasFlow = !!flow;

  React.useEffect(() => {
    if (!hasFlow || !flipKey || flippedForRef.current === flipKey) return;
    if (prefersReducedMotion()) {
      flippedForRef.current = flipKey;
      return;
    }

    let cancelled = false;
    let animation: Animation | null = null;
    const startTimer = setTimeout(async () => {
      const target = flowRef.current;
      if (cancelled || !target) return;
      await waitForCover(coverImageUrl(target));
      const el = coinRef.current;
      if (cancelled || !el || typeof el.animate !== "function") return;
      flippedForRef.current = flipKey;
      setBackFlow(target);
      const ease = "cubic-bezier(.45,.05,.25,1)";
      animation = el.animate(
        [
          { transform: "rotateY(0deg) scale(1)", easing: ease },
          { transform: "rotateY(90deg) scale(1.08)", offset: 0.1, easing: ease },
          { transform: "rotateY(180deg) scale(1)", offset: 0.2 },
          { transform: "rotateY(180deg) scale(1)", offset: 0.7, easing: ease },
          { transform: "rotateY(270deg) scale(1.08)", offset: 0.8, easing: ease },
          { transform: "rotateY(360deg) scale(1)" },
        ],
        { duration: FLIP_DURATION_MS, fill: "none" },
      );
      animation.onfinish = () => {
        if (!cancelled) setBackFlow(null);
      };
    }, START_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(startTimer);
      animation?.cancel();
    };
  }, [hasFlow, flipKey]);

  const faceStyle: React.CSSProperties = {
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
  };

  return (
    <div className="w-full h-full rounded-full" style={{ perspective: 420 }}>
      <div
        ref={coinRef}
        className="relative w-full h-full"
        style={{ transformStyle: "preserve-3d", WebkitTransformStyle: "preserve-3d" } as React.CSSProperties}
      >
        <div className="absolute inset-0 rounded-full overflow-hidden" style={faceStyle}>
          {front}
        </div>
        {backFlow && (
          <div
            className="absolute inset-0 rounded-full overflow-hidden"
            style={{ ...faceStyle, transform: "rotateY(180deg)" }}
            aria-hidden
          >
            <PinnedFlowCover flow={backFlow} thumbSize={88} />
          </div>
        )}
      </div>
    </div>
  );
}
