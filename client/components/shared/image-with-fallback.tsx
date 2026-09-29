import * as React from "react";
import { cn } from "@/lib/utils";
import { cdnImg } from "@/lib/image-url";
import { useThumbSrc } from "@/lib/thumb-cache";

interface ImageWithFallbackProps
  extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallback?: string;
  fallbackElement?: React.ReactNode;
  /** Target render width in CSS px (DPR is applied automatically). */
  cdnWidth?: number;
  /** Target render height in CSS px (DPR is applied automatically). */
  cdnHeight?: number;
  /** JPEG/WebP quality 20..100. Defaults to 70 when any cdn dim is set. */
  cdnQuality?: number;
  /** Resize mode when both width and height are set. */
  cdnResize?: "cover" | "contain" | "fill";
  /**
   * Maior lado exibido, em px CSS. Com ele a imagem vira uma MINIATURA gerada e
   * guardada no aparelho (`@/lib/thumb-cache`) em vez do arquivo original de
   * centenas de KB. Sem a prop, vale `cdnWidth`/`cdnHeight` — que já descrevem
   * o tamanho de exibição — enquanto as transformações da Supabase estiverem
   * desligadas. Use em miniaturas (avatar, grade, lista), nunca em foto que
   * ocupa a tela inteira.
   */
  thumbSize?: number;
}

/**
 * Image component with built-in error handling and fallback support
 * Handles broken/missing images gracefully and optionally shows a placeholder
 */
export const ImageWithFallback = React.forwardRef<
  HTMLImageElement,
  ImageWithFallbackProps
>(
  (
    {
      src,
      alt,
      fallback = "/placeholder.svg",
      fallbackElement,
      className,
      onError,
      cdnWidth,
      cdnHeight,
      cdnQuality,
      cdnResize,
      thumbSize,
      ...props
    },
    ref,
  ) => {
    const transformedSrc = React.useMemo(() => {
      if (!src) return src;
      if (cdnWidth || cdnHeight) {
        return cdnImg(src, {
          width: cdnWidth,
          height: cdnHeight,
          quality: cdnQuality ?? 70,
          resize: cdnResize ?? (cdnWidth && cdnHeight ? "cover" : undefined),
        });
      }
      return src;
    }, [src, cdnWidth, cdnHeight, cdnQuality, cdnResize]);

    // Miniatura só quando a URL não foi transformada pela CDN (transformação
    // ligada já entrega o tamanho certo).
    const thumbPx =
      thumbSize ??
      (transformedSrc === src && (cdnWidth || cdnHeight)
        ? Math.max(cdnWidth ?? 0, cdnHeight ?? 0)
        : undefined);
    const displaySrc = useThumbSrc(transformedSrc, thumbPx);

    const [hasError, setHasError] = React.useState(false);

    React.useEffect(() => {
      setHasError(false);
    }, [transformedSrc]);

    const imageSrc = hasError ? fallback : displaySrc;
    // Miniatura ainda sendo resolvida: sem `src`, e sem `alt` para o WebKit não
    // desenhar o texto alternativo no lugar da imagem nesse instante.
    const resolving = !hasError && !!transformedSrc && displaySrc === undefined;

    const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
      if (!hasError) {
        console.warn(`[ImageWithFallback] Failed to load image: ${src}`);
        setHasError(true);
      }
      onError?.(e);
    };

    // Don't render if no src and no fallback
    if (!imageSrc && !fallback && !fallbackElement) {
      return fallbackElement || null;
    }

    return (
      <img
        ref={ref}
        src={imageSrc}
        alt={resolving ? "" : alt}
        onError={handleError}
        loading="lazy"
        // Decodifica fora da thread principal: com várias fotos entrando juntas
        // (grade do perfil, lista de exercícios) a troca de tela não engasga.
        decoding="async"
        className={cn(className)}
        {...props}
      />
    );
  },
);

ImageWithFallback.displayName = "ImageWithFallback";
