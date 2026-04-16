import * as React from "react";
import { X, Dumbbell, UtensilsCrossed, CheckSquare } from "lucide-react";
import {
  Drawer,
  DrawerContent,
} from "@/components/ui/drawer";

const MUSCLE_GROUP_COLORS: Record<string, string> = {
  "Peito": "from-red-500/30 to-red-600/20",
  "Costas": "from-blue-500/30 to-blue-600/20",
  "Bíceps": "from-orange-500/30 to-orange-600/20",
  "Braços": "from-orange-500/30 to-orange-600/20",
  "Tríceps": "from-purple-500/30 to-purple-600/20",
  "Ombros": "from-yellow-500/30 to-yellow-600/20",
  "Pernas": "from-green-500/30 to-green-600/20",
  "Panturrilha": "from-emerald-500/30 to-emerald-600/20",
  "Abdômen": "from-cyan-500/30 to-cyan-600/20",
  "Cardio": "from-pink-500/30 to-pink-600/20",
};

const MUSCLE_GROUP_ICONS: Record<string, string> = {
  "Peito": "🏋️",
  "Costas": "🔙",
  "Bíceps": "💪",
  "Braços": "💪",
  "Tríceps": "💪",
  "Ombros": "🤸",
  "Pernas": "🦵",
  "Panturrilha": "🦵",
  "Abdômen": "🧘",
  "Cardio": "🏃",
};

const CATEGORY_COLORS: Record<string, string> = {
  "Carne Bovina": "from-red-500/30 to-red-600/20",
  "Frango": "from-yellow-500/30 to-yellow-600/20",
  "Sobremesa": "from-pink-500/30 to-pink-600/20",
  "Cordeiro": "from-orange-500/30 to-orange-600/20",
  "Diversos": "from-gray-500/30 to-gray-600/20",
  "Massas": "from-amber-500/30 to-amber-600/20",
  "Porco": "from-rose-500/30 to-rose-600/20",
  "Frutos do Mar": "from-blue-500/30 to-blue-600/20",
  "Acompanhamento": "from-lime-500/30 to-lime-600/20",
  "Entrada": "from-teal-500/30 to-teal-600/20",
  "Vegano": "from-green-500/30 to-green-600/20",
  "Vegetariano": "from-emerald-500/30 to-emerald-600/20",
  "Café da Manhã": "from-cyan-500/30 to-cyan-600/20",
  "Cabrito": "from-stone-500/30 to-stone-600/20",
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

export interface ImageZoomItem {
  src: string | null;
  name: string;
  description?: string;
  muscleGroup?: string | null;
  category?: string | null;
  isHabit?: boolean;
}

interface ImageZoomDrawerProps {
  item: ImageZoomItem | null;
  onClose: () => void;
}

export function ImageZoomDrawer({ item, onClose }: ImageZoomDrawerProps) {
  const [imgError, setImgError] = React.useState(false);

  React.useEffect(() => {
    setImgError(false);
  }, [item?.src]);

  return (
    <Drawer open={!!item} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DrawerContent className={`flex flex-col modal-enter !z-[150] ${item?.description ? "h-[100dvh] mt-0 rounded-none" : "max-h-[70dvh]"}`} overlayClassName="!z-[140]" onOpenAutoFocus={(e) => e.preventDefault()}>
        {item && (
          <>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 h-8 w-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            {item.src && !imgError ? (
              <img
                src={item.src}
                alt={item.name}
                className="w-full flex-shrink-0 object-cover"
                style={{ height: item.description ? "60dvh" : "55dvh" }}
                onError={() => setImgError(true)}
              />
            ) : (() => {
              // Determine avatar config based on type
              const isExercise = !!item.muscleGroup || (!item.category && !item.isHabit);
              const isDiet = !!item.category;
              const isHabit = item.isHabit;

              let gradient = "from-muted to-muted/50";
              let emoji: string | null = null;
              let FallbackIcon = Dumbbell;

              if (isDiet) {
                gradient = (item.category && CATEGORY_COLORS[item.category]) || "from-muted to-muted/50";
                emoji = (item.category && CATEGORY_ICONS[item.category]) || null;
                FallbackIcon = UtensilsCrossed;
              } else if (isHabit) {
                gradient = "from-violet-500/30 to-violet-600/20";
                emoji = "✅";
                FallbackIcon = CheckSquare;
              } else {
                gradient = (item.muscleGroup && MUSCLE_GROUP_COLORS[item.muscleGroup]) || "from-muted to-muted/50";
                emoji = (item.muscleGroup && MUSCLE_GROUP_ICONS[item.muscleGroup]) || null;
                FallbackIcon = Dumbbell;
              }

              return (
                <div
                  className={`w-full flex-shrink-0 bg-gradient-to-br ${gradient} flex flex-col items-center justify-center gap-4`}
                  style={{ height: item.description ? "40dvh" : "55dvh" }}
                >
                  {emoji ? (
                    <span className="text-8xl" role="img" aria-label={item.category || item.muscleGroup || item.name}>
                      {emoji}
                    </span>
                  ) : (
                    <FallbackIcon className="h-20 w-20 text-muted-foreground/40" />
                  )}
                  {(item.category || item.muscleGroup) && (
                    <span className="text-sm font-medium text-foreground/60 px-4 py-1.5 rounded-full bg-background/30 backdrop-blur-sm">
                      {item.category || item.muscleGroup}
                    </span>
                  )}
                </div>
              );
            })()}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <p className="font-semibold text-lg">{item.name}</p>
              {item.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              )}
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
