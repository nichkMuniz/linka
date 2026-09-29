import * as React from "react";
import { Dumbbell } from "lucide-react";
import { useThumbSrc } from "@/lib/thumb-cache";

const MUSCLE_GROUP_COLORS: Record<string, string> = {
  "Peito": "from-red-500/20 to-red-600/10",
  "Costas": "from-blue-500/20 to-blue-600/10",
  "Bíceps": "from-orange-500/20 to-orange-600/10",
  "Braços": "from-orange-500/20 to-orange-600/10",
  "Tríceps": "from-purple-500/20 to-purple-600/10",
  "Ombros": "from-yellow-500/20 to-yellow-600/10",
  "Pernas": "from-green-500/20 to-green-600/10",
  "Panturrilha": "from-emerald-500/20 to-emerald-600/10",
  "Abdômen": "from-cyan-500/20 to-cyan-600/10",
  "Cardio": "from-pink-500/20 to-pink-600/10",
};

const MUSCLE_GROUP_ICONS: Record<string, string> = {
  "Peito": "🏋️",
  "Bíceps": "💪",
  "Braços": "💪",
  "Tríceps": "💪",
  "Ombros": "🤸",
  "Pernas": "🦵",
  "Panturrilha": "🦵",
  "Abdômen": "🧘",
  "Cardio": "🏃",
};

interface ExerciseImageProps {
  photo: string | null;
  name: string;
  muscleGroup?: string | null;
  className?: string;
  /**
   * Maior lado exibido (px CSS) — a foto vira miniatura guardada no aparelho
   * (ver `@/lib/thumb-cache`). O padrão cobre as listas; quem mostra a foto
   * grande (detalhe do item) passa o tamanho real.
   */
  thumbSize?: number;
}

export function ExerciseImage({ photo, name, muscleGroup, className = "h-14 w-14 rounded-lg", thumbSize = 64 }: ExerciseImageProps) {
  const [imgError, setImgError] = React.useState(false);
  const shownSrc = useThumbSrc(photo, thumbSize);
  React.useEffect(() => setImgError(false), [photo]);

  if (photo && !imgError) {
    return (
      <img
        src={shownSrc}
        alt={shownSrc ? name : ""}
        className={`${className} object-cover flex-shrink-0 bg-muted`}
        onError={() => setImgError(true)}
        loading="lazy"
      />
    );
  }

  const gradient = (muscleGroup && MUSCLE_GROUP_COLORS[muscleGroup]) || "from-muted to-muted/50";
  const emoji = muscleGroup && MUSCLE_GROUP_ICONS[muscleGroup];

  return (
    <div className={`${className} bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 border border-border/30`}>
      {emoji ? (
        <span className="text-xl" role="img" aria-label={muscleGroup || name}>
          {emoji}
        </span>
      ) : (
        <Dumbbell className="h-5 w-5 text-muted-foreground/60" />
      )}
    </div>
  );
}
