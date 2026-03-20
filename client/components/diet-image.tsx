import * as React from "react";
import { UtensilsCrossed } from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  "Carne Bovina": "from-red-500/20 to-red-600/10",
  "Frango": "from-yellow-500/20 to-yellow-600/10",
  "Sobremesa": "from-pink-500/20 to-pink-600/10",
  "Cordeiro": "from-orange-500/20 to-orange-600/10",
  "Diversos": "from-gray-500/20 to-gray-600/10",
  "Massas": "from-amber-500/20 to-amber-600/10",
  "Porco": "from-rose-500/20 to-rose-600/10",
  "Frutos do Mar": "from-blue-500/20 to-blue-600/10",
  "Acompanhamento": "from-lime-500/20 to-lime-600/10",
  "Entrada": "from-teal-500/20 to-teal-600/10",
  "Vegano": "from-green-500/20 to-green-600/10",
  "Vegetariano": "from-emerald-500/20 to-emerald-600/10",
  "Café da Manhã": "from-cyan-500/20 to-cyan-600/10",
  "Cabrito": "from-stone-500/20 to-stone-600/10",
};

const CATEGORY_ICONS: Record<string, string> = {
  "Carne Bovina": "🥩",
  "Frango": "🍗",
  "Sobremesa": "🍰",
  "Cordeiro": "🐑",
  "Diversos": "🍽️",
  "Massas": "🍝",
  "Porco": "🥓",
  "Frutos do Mar": "🦐",
  "Acompanhamento": "🥗",
  "Entrada": "🥄",
  "Vegano": "🌱",
  "Vegetariano": "🥬",
  "Café da Manhã": "☕",
  "Cabrito": "🍖",
};

interface DietImageProps {
  photo: string | null;
  name: string;
  category?: string | null;
  className?: string;
}

export function DietImage({ photo, name, category, className = "h-14 w-14" }: DietImageProps) {
  const [imgError, setImgError] = React.useState(false);

  if (photo && !imgError) {
    return (
      <img
        src={photo}
        alt={name}
        className={`${className} rounded-lg object-cover flex-shrink-0 bg-muted`}
        onError={() => setImgError(true)}
        loading="lazy"
      />
    );
  }

  const gradient = (category && CATEGORY_COLORS[category]) || "from-muted to-muted/50";
  const emoji = category && CATEGORY_ICONS[category];

  return (
    <div className={`${className} rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 border border-border/30`}>
      {emoji ? (
        <span className="text-xl" role="img" aria-label={category || name}>
          {emoji}
        </span>
      ) : (
        <UtensilsCrossed className="h-5 w-5 text-muted-foreground/60" />
      )}
    </div>
  );
}
