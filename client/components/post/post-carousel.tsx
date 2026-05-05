import React from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";

interface PostCarouselProps {
  photos: string[];
  alt: string;
  editMode?: boolean;
  onRemovePhoto?: (photoUrl: string, index: number) => void;
  removingPhoto?: boolean;
  objectFit?: "cover" | "contain";
}

function getPinchDist(touches: React.TouchList | TouchList) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function getPinchOrigin(touches: React.TouchList | TouchList, rect: DOMRect) {
  const mx = (touches[0].clientX + touches[1].clientX) / 2;
  const my = (touches[0].clientY + touches[1].clientY) / 2;
  return {
    x: ((mx - rect.left) / rect.width) * 100,
    y: ((my - rect.top) / rect.height) * 100,
  };
}

function ZoomableImage({
  src,
  alt,
  className,
  loading,
}: {
  src: string;
  alt: string;
  className: string;
  loading?: "eager" | "lazy";
}) {
  const [scale, setScale] = React.useState(1);
  const [origin, setOrigin] = React.useState({ x: 50, y: 50 });
  const [isPinching, setIsPinching] = React.useState(false);
  const pinch = React.useRef({ active: false, startDist: 0, baseScale: 1 });
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Non-passive touchmove so we can preventDefault during pinch only
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = (e: TouchEvent) => {
      if (pinch.current.active && e.touches.length === 2) {
        e.preventDefault();
        const newDist = getPinchDist(e.touches as unknown as React.TouchList);
        const newScale = Math.min(
          5,
          Math.max(1, pinch.current.baseScale * (newDist / pinch.current.startDist))
        );
        setScale(newScale);
      }
    };
    el.addEventListener("touchmove", onMove, { passive: false });
    return () => el.removeEventListener("touchmove", onMove);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      pinch.current = {
        active: true,
        startDist: getPinchDist(e.touches),
        baseScale: scale,
      };
      setOrigin(getPinchOrigin(e.touches, rect));
      setIsPinching(true);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (pinch.current.active && e.touches.length < 2) {
      pinch.current.active = false;
      setIsPinching(false);
      setScale(1);
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <img
        src={src}
        alt={alt}
        className={className}
        loading={loading}
        decoding="async"
        draggable={false}
        style={{
          transform: `scale(${scale})`,
          transformOrigin: `${origin.x}% ${origin.y}%`,
          transition: scale === 1 ? "transform 0.25s ease-out" : "none",
          userSelect: "none",
          // "pan-y" permite scroll vertical livre; apenas durante pinch bloqueamos tudo
          touchAction: isPinching ? "none" : "pan-y",
          willChange: "transform",
        }}
      />
    </div>
  );
}

export function PostCarousel({
  photos,
  alt,
  editMode,
  onRemovePhoto,
  removingPhoto,
  objectFit = "cover",
}: PostCarouselProps) {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const touchStartX = React.useRef<number | null>(null);
  const touchStartY = React.useRef<number | null>(null);
  const touchCount = React.useRef(0);

  const isContain = objectFit === "contain";
  const imgClass = isContain ? "w-full h-auto block" : "w-full h-full object-cover";
  const coverBox =
    "relative w-full aspect-square md:aspect-auto md:h-[450px] bg-slate-900/10 overflow-hidden rounded-lg";

  if (!Array.isArray(photos)) {
    return photos ? (
      isContain ? (
        <div className="w-full bg-black rounded-lg overflow-hidden">
          <ZoomableImage src={String(photos)} alt={alt} className={imgClass} loading="eager" />
        </div>
      ) : (
        <div className={coverBox}>
          <ZoomableImage src={String(photos)} alt={alt} className={imgClass} loading="eager" />
        </div>
      )
    ) : null;
  }

  if (photos.length === 1) {
    return isContain ? (
      <div className="w-full bg-black rounded-lg overflow-hidden">
        <ZoomableImage src={photos[0]} alt={alt} className={imgClass} loading="lazy" />
      </div>
    ) : (
      <div className={coverBox}>
        <ZoomableImage src={photos[0]} alt={alt} className={imgClass} loading="lazy" />
      </div>
    );
  }

  const containerRef = React.useRef<HTMLDivElement>(null);
  const isHorizontalSwipe = React.useRef<boolean | null>(null);

  const goTo = (index: number) => {
    setCurrentIndex((index + photos.length) % photos.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchCount.current = e.touches.length;
    isHorizontalSwipe.current = null;
    if (e.touches.length === 1) {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    } else {
      touchStartX.current = null;
      touchStartY.current = null;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchCount.current >= 2) {
      touchCount.current = 0;
      isHorizontalSwipe.current = null;
      return;
    }
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      goTo(dx < 0 ? currentIndex + 1 : currentIndex - 1);
    }
    touchStartX.current = null;
    touchStartY.current = null;
    touchCount.current = 0;
    isHorizontalSwipe.current = null;
  };

  // Adiciona listener não-passivo para bloquear scroll apenas em swipe horizontal
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = (e: TouchEvent) => {
      if (touchCount.current >= 2) return;
      if (touchStartX.current === null || touchStartY.current === null) return;
      const dx = e.touches[0].clientX - touchStartX.current;
      const dy = e.touches[0].clientY - touchStartY.current;
      // Determina direção do swipe na primeira leitura com deslocamento suficiente
      if (isHorizontalSwipe.current === null && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
        isHorizontalSwipe.current = Math.abs(dx) > Math.abs(dy);
      }
      // Só bloqueia o scroll padrão se for swipe horizontal
      if (isHorizontalSwipe.current === true) {
        e.preventDefault();
      }
    };
    el.addEventListener("touchmove", onMove, { passive: false });
    return () => el.removeEventListener("touchmove", onMove);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative group overflow-hidden rounded-lg ${isContain ? "bg-black" : "bg-slate-900/10"}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="flex transition-transform duration-200 ease-out will-change-transform"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {photos.map((src, i) => (
          <div
            key={i}
            className={`flex-shrink-0 ${isContain ? "w-full" : "w-full aspect-square md:aspect-auto md:h-[450px] overflow-hidden"}`}
            style={{ minWidth: "100%" }}
          >
            <ZoomableImage
              src={src}
              alt={`${alt} - ${i + 1}`}
              className={imgClass}
              loading={i === 0 ? "eager" : "lazy"}
            />
          </div>
        ))}
      </div>

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

      {editMode && onRemovePhoto && photos.length > 1 && (
        <button
          type="button"
          onClick={() => onRemovePhoto(photos[currentIndex], currentIndex)}
          disabled={removingPhoto}
          className="absolute top-2 right-2 bg-destructive/90 hover:bg-destructive text-white rounded-full p-1.5 transition-colors disabled:opacity-50"
          title="Remover esta foto"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}

      {/* Pill counter — top-right, never overlaps user info */}
      <div className="absolute top-3 right-3 pointer-events-none">
        <span className="text-white text-xs font-semibold bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-full">
          {currentIndex + 1}/{photos.length}
        </span>
      </div>

      {/* Dots — top-center */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-1 pointer-events-none">
        {photos.map((_, index) => (
          <div
            key={index}
            className={`h-1.5 rounded-full transition-all duration-200 ${
              currentIndex === index ? "w-4 bg-white" : "w-1.5 bg-white/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
