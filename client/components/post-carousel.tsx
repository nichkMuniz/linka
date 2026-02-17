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

      {/* Photo Counter */}
      <div className="absolute bottom-2 right-2 bg-black/50 px-3 py-1 rounded-full text-xs text-white">
        {currentIndex + 1}/{photos.length}
      </div>

      {/* Thumbnail Strip */}
      {photos.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
          {photos.map((photo, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`flex-shrink-0 h-12 w-12 rounded-md overflow-hidden border-2 transition-colors ${
                currentIndex === index
                  ? "border-primary"
                  : "border-border/40 hover:border-border"
              }`}
              aria-label={`View photo ${index + 1}`}
            >
              <img
                src={photo}
                alt={`Thumbnail ${index + 1}`}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
