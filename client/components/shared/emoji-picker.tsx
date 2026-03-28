import * as React from "react";
import { Smile } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const EMOJI_CATEGORIES = [
  {
    label: "Fitness",
    emojis: ["💪", "🏋️", "🏃", "🚴", "🧘", "🤸", "⛹️", "🏊", "🥊", "🎯", "🏆", "🥇", "🔥", "⚡", "📈", "🚀", "💥", "🎽", "👟", "🥗"],
  },
  {
    label: "Emoções",
    emojis: ["😀", "😃", "😄", "😁", "😆", "🤣", "😂", "🥹", "😊", "😇", "🥰", "😍", "🤩", "😎", "🤗", "🙌", "👏", "🤜", "✊", "👊"],
  },
  {
    label: "Gestos",
    emojis: ["👍", "👎", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💯", "✅", "⭐", "🌟", "✨", "🎉", "🎊", "🏅", "🎖️", "🥳"],
  },
  {
    label: "Comida",
    emojis: ["🥑", "🥦", "🥕", "🍗", "🥚", "🍳", "🥜", "🫐", "🍎", "🍌", "🥤", "💧", "🫗", "🧃", "🍵", "☕", "🫙", "🥛", "🧇", "🥞"],
  },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  /** Posição do popover: 'top' (padrão) ou 'bottom' */
  placement?: "top" | "bottom";
  /** Classe extra no botão trigger */
  triggerClassName?: string;
}

export function EmojiPicker({ onSelect, placement = "top", triggerClassName }: EmojiPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [activeCategory, setActiveCategory] = React.useState(0);
  const ref = React.useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center justify-center rounded-full p-1.5 text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/60",
          open && "text-foreground bg-muted/60",
          triggerClassName,
        )}
        aria-label="Escolher emoji"
      >
        <Smile className="h-4 w-4" />
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-[200] w-64 rounded-xl border border-border/60 bg-popover shadow-xl",
            placement === "top" ? "bottom-full mb-2" : "top-full mt-2",
            // Tenta manter dentro da viewport horizontalmente
            "right-0",
          )}
        >
          {/* Category tabs */}
          <div className="flex border-b border-border/40 px-1 pt-1">
            {EMOJI_CATEGORIES.map((cat, i) => (
              <button
                key={cat.label}
                type="button"
                onClick={() => setActiveCategory(i)}
                className={cn(
                  "flex-1 rounded-t-lg px-1 py-1.5 text-[10px] font-medium transition-colors",
                  activeCategory === i
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Emoji grid */}
          <div className="grid grid-cols-8 gap-0.5 p-2">
            {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleSelect(emoji)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-lg transition-colors hover:bg-muted"
                aria-label={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
