import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useLanguage } from "@/lib/language-context";

interface EmojiCategory {
  key: string;
  icon: string;
  emojis: string[];
}

// Emojis unicode padrão — renderizados com o glyph nativo da Apple dentro do
// WebView do iOS (sem precisar embutir nenhuma fonte).
const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    key: "smileys",
    icon: "😀",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😙",
      "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥",
      "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🤧", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "😎", "🤓",
      "🧐", "😕", "😟", "🙁", "😮", "😯", "😲", "😳", "🥺", "😦", "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞",
      "😓", "😩", "😫", "🥱", "😤", "😡", "😠", "🤬", "😈", "💀", "🤡", "👻", "👽", "🤖",
    ],
  },
  {
    key: "people",
    icon: "🙌",
    emojis: [
      "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍",
      "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🙏", "✍️", "💪", "🦵", "🦶", "👀", "🧠", "👶", "🧒", "👦", "👧",
      "🧑", "👨", "🧔", "👩", "🧓", "👴", "👵", "🙍", "🙎", "🙅", "🙆", "💁", "🚶", "🏃", "💃", "🕺",
    ],
  },
  {
    key: "animals",
    icon: "🐶",
    emojis: [
      "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐽", "🐸", "🐵", "🙈", "🙉", "🙊", "🐒",
      "🐔", "🐧", "🐦", "🐤", "🐥", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🐛", "🦋", "🐌", "🐞", "🐢", "🐍",
      "🦎", "🐙", "🦑", "🦐", "🦀", "🐡", "🐠", "🐟", "🐬", "🐳", "🐋", "🦈", "🐊", "🐅", "🐆", "🦓", "🦍", "🐘", "🦒", "🐪",
    ],
  },
  {
    key: "food",
    icon: "🍔",
    emojis: [
      "🍏", "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🥑", "🥦",
      "🥒", "🌶️", "🌽", "🥕", "🥐", "🍞", "🧀", "🍳", "🥞", "🥓", "🍗", "🍖", "🌭", "🍔", "🍟", "🍕", "🌮", "🌯", "🥗", "🍝",
      "🍜", "🍣", "🍱", "🍤", "🍚", "🍦", "🍰", "🎂", "🧁", "🍭", "🍫", "🍿", "🥤", "☕", "🍵", "🍺", "🍷", "🥂", "🍹",
    ],
  },
  {
    key: "activities",
    icon: "⚽",
    emojis: [
      "⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🎱", "🏓", "🏸", "🏒", "🏑", "🥍", "🏏", "⛳", "🏹", "🎣", "🥊", "🥋",
      "🎽", "🛹", "🛼", "⛸️", "🎿", "⛷️", "🏂", "🏋️", "🤼", "🤸", "⛹️", "🤺", "🤾", "🏌️", "🏇", "🧘", "🏄", "🏊", "🚣", "🧗",
      "🚵", "🚴", "🏆", "🥇", "🥈", "🥉", "🏅", "🎖️", "🎫", "🎟️", "🎯", "🎮", "🎧", "🎵", "🎶",
    ],
  },
  {
    key: "travel",
    icon: "✈️",
    emojis: [
      "🚗", "🚕", "🚙", "🚌", "🏎️", "🚓", "🚑", "🚒", "🚚", "🛵", "🏍️", "🚲", "🛴", "🚨", "🚆", "🚇", "✈️", "🛫", "🛬", "🚀",
      "🛸", "🚁", "⛵", "🚤", "🛳️", "⚓", "🗺️", "🗽", "🗼", "🏰", "🎡", "🎢", "⛲", "🏖️", "🏝️", "🏜️", "🌋", "⛰️", "🏔️", "🏕️",
      "🏠", "🏡", "🏢", "🏟️", "🏛️", "⛪", "🕌", "🌆", "🌃", "🌉", "🌌",
    ],
  },
  {
    key: "symbols",
    icon: "❤️",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💯", "💢",
      "💥", "💫", "💦", "💨", "🕳️", "💣", "💬", "👁️‍🗨️", "🗨️", "🗯️", "💭", "💤", "✅", "❌", "❗", "❓", "‼️", "⁉️", "⭐", "🌟",
      "✨", "⚡", "🔥", "💧", "🌈", "☀️", "🌙", "📍", "🔥",
    ],
  },
];

interface EmojiPickerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (emoji: string) => void;
}

export function EmojiPickerDrawer({ open, onOpenChange, onSelect }: EmojiPickerDrawerProps) {
  const { t } = useLanguage();
  const [activeCategory, setActiveCategory] = React.useState(0);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
        className="max-h-[70vh] !rounded-t-[32px] !border-0 flex flex-col"
        style={{
          background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderTop: "1px solid rgba(255,255,255,.14)",
        }}
      >
        <DrawerHeader className="pb-2">
          <DrawerTitle style={{ color: "#fff" }}>{t("newpost_emoji_picker_title")}</DrawerTitle>
        </DrawerHeader>

        {/* Category tabs */}
        <div className="flex gap-1.5 px-4 pb-2 overflow-x-auto flex-shrink-0" style={{ scrollbarWidth: "none" }}>
          {EMOJI_CATEGORIES.map((cat, i) => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(i)}
              style={{
                fontSize: 19, width: 38, height: 38, borderRadius: 13, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: activeCategory === i ? "rgba(255,255,255,.14)" : "transparent",
                border: activeCategory === i ? "1px solid rgba(255,255,255,.22)" : "1px solid transparent",
                transition: "background .15s ease",
              }}
            >
              {cat.icon}
            </button>
          ))}
        </div>

        {/* Emoji grid */}
        <div
          className="overflow-y-auto px-3 flex-1"
          style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
            {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji, idx) => (
              <button
                key={`${emoji}-${idx}`}
                onClick={() => onSelect(emoji)}
                className="active:bg-white/10"
                style={{
                  fontSize: 25, aspectRatio: "1/1", display: "flex",
                  alignItems: "center", justifyContent: "center", borderRadius: 12,
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
