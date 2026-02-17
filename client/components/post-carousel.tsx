import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PostCarouselProps {
  photos: string[];
  alt: string;
}

export function PostCarousel({ photos, alt }: PostCarouselProps) {
  const [currentIndex, setCurrentIndex] = React.useState(0);

  // If only one photo, display it without carousel
  if (photos.length === 1) {
    return (
      <img
        src={photos[0]}
        alt={alt}
        className="w-full max-h-96 object-cover rounded-lg"
      />
    );
  }

  const navigateCarousel = (direction: "next" | "prev") => {
    if (direction === "next") {
      setCurrentIndex((prev) => (prev + 1) % photos.length);
    } else {
      setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
    }
  };

  // Handle keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") navigateCarousel("next");
      if (e.key === "ArrowLeft") navigateCarousel("prev");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="relative group">
      <img
        src={photos[currentIndex]}
        alt={`${alt} - ${currentIndex + 1}`}
        className="w-full max-h-96 object-cover rounded-lg"
      />

      {/* Navigation Buttons */}
      <button
        onClick={() => navigateCarousel("prev")}
        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 p-2 rounded-full transition-colors opacity-0 group-hover:opacity-100"
        aria-label="Previous photo"
      >
        <ChevronLeft className="h-5 w-5 text-white" />
      </button>
      <button
        onClick={() => navigateCarousel("next")}
        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 p-2 rounded-full transition-colors opacity-0 group-hover:opacity-100"
        aria-label="Next photo"
      >
        <ChevronRight className="h-5 w-5 text-white" />
      </button>

      {/* Centered Photo Indicator */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 pointer-events-none">
        <div className="flex gap-1">
          {photos.map((_, index) => (
            <div
              key={index}
              className={`h-2 rounded-full transition-all ${
                currentIndex === index
                  ? "w-6 bg-white"
                  : "w-2 bg-white/50"
              }`}
            />
          ))}
        </div>
        <p className="text-white text-xs font-medium bg-black/40 px-2 py-1 rounded-full">
          {currentIndex + 1}/{photos.length}
        </p>
      </div>
    </div>
  );
}
