import * as React from "react";
import { Smile } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center justify-center rounded-full p-1.5 text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/60",
            triggerClassName,
          )}
          aria-label="Escolher emoji"
        >
          <Smile className="h-4 w-4" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        side={placement}
        align="end"
        sideOffset={8}
        className="w-64 p-0 overflow-hidden border-border/60"
      >
        {/* Category tabs */}
        <div className="flex border-b border-border/40 px-1 pt-1 bg-popover">
          {EMOJI_CATEGORIES.map((cat, i) => (
            <button
              key={cat.label}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveCategory(i);
              }}
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
        <div className="grid grid-cols-8 gap-0.5 p-2 bg-popover">
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
      </PopoverContent>
    </Popover>
  );
}
