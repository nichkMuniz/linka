import * as React from "react";
import { cn } from "@/lib/utils";
import { cdnImg } from "@/lib/image-url";

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

    const [imageSrc, setImageSrc] = React.useState<string | undefined>(transformedSrc);
    const [hasError, setHasError] = React.useState(false);

    React.useEffect(() => {
      setImageSrc(transformedSrc);
      setHasError(false);
    }, [transformedSrc]);

    const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
      if (!hasError) {
        console.warn(`[ImageWithFallback] Failed to load image: ${src}`);
        setHasError(true);
        setImageSrc(fallback);
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
        alt={alt}
        onError={handleError}
        loading="lazy"
        className={cn(className)}
        {...props}
      />
    );
  },
);

ImageWithFallback.displayName = "ImageWithFallback";
