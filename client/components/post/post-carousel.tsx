import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PostCarouselProps {
  photos: string[];
  alt: string;
}

export function PostCarousel({ photos, alt }: PostCarouselProps) {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const touchStartX = React.useRef<number | null>(null);
  const touchStartY = React.useRef<number | null>(null);

  // Final safety check for non-array photos
  if (!Array.isArray(photos)) {
    return photos ? (
      <div className="relative w-full aspect-square md:aspect-auto md:h-[450px] bg-slate-900/10 flex items-center justify-center overflow-hidden rounded-lg">
        <img src={String(photos)} alt={alt} className="max-w-full max-h-full w-auto h-auto object-contain" />
      </div>
    ) : null;
  }

  // Single photo — no carousel needed
  if (photos.length === 1) {
    return (
      <div className="relative w-full aspect-square md:aspect-auto md:h-[450px] bg-slate-900/10 flex items-center justify-center overflow-hidden rounded-lg">
        <img
          src={photos[0]}
          alt={alt}
          className="max-w-full max-h-full w-auto h-auto object-contain"
          loading="lazy"
        />
      </div>
    );
  }

  const goTo = (index: number) => {
    setCurrentIndex((index + photos.length) % photos.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    // Only swipe if horizontal movement dominates
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      goTo(dx < 0 ? currentIndex + 1 : currentIndex - 1);
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  return (
    <div
      className="relative group overflow-hidden rounded-lg bg-slate-900/10"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* All images rendered side-by-side; CSS translate moves them instantly */}
      <div
        className="flex transition-transform duration-200 ease-out will-change-transform"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {photos.map((src, i) => (
          <div key={i} className="w-full aspect-square md:aspect-auto md:h-[450px] flex-shrink-0 flex items-center justify-center overflow-hidden" style={{ minWidth: "100%" }}>
            <img
              src={src}
              alt={`${alt} - ${i + 1}`}
              className="max-w-full max-h-full w-auto h-auto object-contain"
              loading={i === 0 ? "eager" : "lazy"}
              decoding="async"
            />
          </div>
        ))}
      </div>

      {/* Navigation Buttons */}
      {currentIndex > 0 && (
        <button
          onClick={() => goTo(currentIndex - 1)}
          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 p-2 rounded-full transition-colors opacity-0 group-hover:opacity-100"
          aria-label="Foto anterior"
        >
          <ChevronLeft className="h-5 w-5 text-white" />
        </button>
      )}
      {currentIndex < photos.length - 1 && (
        <button
          onClick={() => goTo(currentIndex + 1)}
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 p-2 rounded-full transition-colors opacity-0 group-hover:opacity-100"
          aria-label="Próxima foto"
        >
          <ChevronRight className="h-5 w-5 text-white" />
        </button>
      )}

      {/* Dots + Counter */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none">
        <div className="flex gap-1">
          {photos.map((_, index) => (
            <div
              key={index}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                currentIndex === index ? "w-4 bg-white" : "w-1.5 bg-white/50"
              }`}
            />
          ))}
        </div>
        <p className="text-white text-xs font-medium bg-black/40 px-2 py-0.5 rounded-full">
          {currentIndex + 1}/{photos.length}
        </p>
      </div>
    </div>
  );
}
