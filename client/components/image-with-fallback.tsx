import * as React from "react";
import { cn } from "@/lib/utils";

interface ImageWithFallbackProps
  extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallback?: string;
  fallbackElement?: React.ReactNode;
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
      ...props
    },
    ref,
  ) => {
    const [imageSrc, setImageSrc] = React.useState<string | undefined>(src);
    const [hasError, setHasError] = React.useState(false);

    React.useEffect(() => {
      setImageSrc(src);
      setHasError(false);
    }, [src]);

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
