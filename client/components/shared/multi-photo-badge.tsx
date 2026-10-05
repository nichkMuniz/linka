import { GalleryHorizontalEnd, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/language-context";

/**
 * Selo "post com várias fotos" nas grades de miniaturas (Perfil › Posts e
 * Marcações, página de Hashtag). Pílula de vidro escuro com o ícone de
 * carrossel e a quantidade — substitui o quadradinho branco com emoji 📷, que
 * destoava do resto do app (2026-09-30).
 *
 * Sem `backdrop-filter` de propósito: a grade monta dezenas destes de uma vez,
 * e blur por tile pesa no scroll do WKWebView (docs/15 §0.3). O fundo escuro
 * translúcido + borda clara dão o mesmo efeito sobre qualquer foto.
 */
export function MultiPhotoBadge({ count, className }: { count: number; className?: string }) {
  const { t } = useLanguage();
  return (
    <span
      role="img"
      aria-label={t("post_photo_count_aria").replace("{n}", String(count))}
      className={cn(
        "pointer-events-none absolute right-2 top-2 inline-flex h-[22px] items-center gap-1 rounded-full pl-1.5 pr-2 text-[11px] font-semibold leading-none tabular-nums text-white",
        className,
      )}
      style={{
        background: "rgba(10,11,18,.55)",
        border: "1px solid rgba(255,255,255,.18)",
        boxShadow: "0 2px 8px rgba(0,0,0,.35)",
      }}
    >
      <GalleryHorizontalEnd className="h-3 w-3" strokeWidth={2.4} aria-hidden />
      {count}
    </span>
  );
}

/**
 * Selo "post em vídeo" nas mesmas grades (2026-10-05). A miniatura é a capa
 * (`posts.photo`), então sem o selo o vídeo se passaria por foto. Mesmo vidro
 * escuro e mesmo canto do `MultiPhotoBadge` — um post nunca tem os dois (vídeo
 * é sempre um arquivo só).
 */
export function VideoPostBadge({ className }: { className?: string }) {
  const { t } = useLanguage();
  return (
    <span
      role="img"
      aria-label={t("post_video_badge_aria")}
      className={cn(
        "pointer-events-none absolute right-2 top-2 inline-flex h-[22px] w-[22px] items-center justify-center rounded-full text-white",
        className,
      )}
      style={{
        background: "rgba(10,11,18,.55)",
        border: "1px solid rgba(255,255,255,.18)",
        boxShadow: "0 2px 8px rgba(0,0,0,.35)",
      }}
    >
      <Play className="h-2.5 w-2.5 translate-x-[0.5px]" fill="currentColor" strokeWidth={0} aria-hidden />
    </span>
  );
}
