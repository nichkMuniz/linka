import * as React from "react";
import { videoPosterSrc } from "@/lib/video-thumb";
import { releaseVideoElement } from "@/lib/media-prefetch";

/**
 * Miniatura de um shot nas grades (perfil, busca, hashtag).
 *
 * Um `<video preload="metadata" src="...#t=0.1">` por célula parece inofensivo,
 * mas no WKWebView do iOS **cada um desses elementos ocupa um player de vídeo** —
 * e o sistema tem um teto de players simultâneos. Uma grade com dezenas de shots
 * estoura esse teto e, ao abrir o shot em tela cheia, o player da tela de Shots
 * entra SEM faixa de vídeo: toca o áudio e a tela fica preta (ou congelada no
 * primeiro frame). Era o bug de "abrir um shot pela aba Shots do perfil".
 *
 * Duas travas, as duas necessárias:
 *
 * 1. **Só a parte visível da grade carrega.** O `src` é anexado quando a célula
 *    entra na viewport (com folga) e removido pouco depois de sair — assim o
 *    número de players vivos acompanha o que está na tela, não o total de shots.
 * 2. **Libera ao desmontar.** Ao navegar para `/shots`, o `useEffect` de limpeza
 *    solta o player de cada miniatura ANTES de o vídeo em tela cheia pedir o
 *    dele. Sem isso o WebKit só devolveria o recurso na coleta de lixo, tarde
 *    demais.
 *
 * O `#t=0.1` (via `videoPosterSrc`) continua sendo o que faz o WebView pintar um
 * frame como preview sem precisar de coluna de thumbnail no banco.
 */

/** Folga em volta da viewport para começar a carregar antes de a célula aparecer. */
const ATTACH_MARGIN = "400px";
/** Carência antes de soltar uma célula que saiu da tela (evita thrash no scroll). */
const RELEASE_DELAY_MS = 2000;

type ShotThumbProps = {
  videoUrl: string | null | undefined;
  className?: string;
};

export function ShotThumb({ videoUrl, className }: ShotThumbProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const releaseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const src = videoPosterSrc(videoUrl);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    const cancelRelease = () => {
      if (releaseTimerRef.current) {
        clearTimeout(releaseTimerRef.current);
        releaseTimerRef.current = null;
      }
    };

    const attach = () => {
      cancelRelease();
      if (video.getAttribute("src") === src) return;
      video.setAttribute("src", src);
      try {
        video.load();
      } catch {
        /* ignora */
      }
    };

    const release = () => {
      if (!video.getAttribute("src")) return;
      releaseVideoElement(video);
    };

    // Sem IntersectionObserver (ambiente de teste/SSR): carrega direto — a
    // liberação no desmonte, que é a trava principal, continua valendo.
    if (typeof IntersectionObserver === "undefined") {
      attach();
      return () => {
        cancelRelease();
        release();
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            attach();
          } else if (!releaseTimerRef.current) {
            releaseTimerRef.current = setTimeout(() => {
              releaseTimerRef.current = null;
              release();
            }, RELEASE_DELAY_MS);
          }
        }
      },
      { rootMargin: ATTACH_MARGIN },
    );
    observer.observe(video);

    return () => {
      observer.disconnect();
      cancelRelease();
      release();
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      playsInline
      muted
      preload="metadata"
      // webkit-playsinline evita que o iOS abra o player nativo em tela cheia
      {...({ "webkit-playsinline": "true" } as React.VideoHTMLAttributes<HTMLVideoElement>)}
      className={className}
    />
  );
}
