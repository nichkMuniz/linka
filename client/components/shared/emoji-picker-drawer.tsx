import * as React from "react";
import {
  Apple,
  Car,
  Clock,
  Flag,
  Hash,
  Lightbulb,
  Loader2,
  PawPrint,
  Search,
  Smile,
  Trophy,
  X,
} from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/language-context";
import { GLASS_SHEET_PROPS, GLASS_SHEET_STYLE, GLASS_FIELD_STYLE } from "@/lib/glass-styles";
import { hapticLight } from "@/lib/haptics";
import type { TranslationKey } from "@/lib/i18n";

/**
 * Seletor com TODOS os emojis, no formato do teclado do iPhone (busca,
 * recentes, categorias com abas no rodapé). Um componente só para o app:
 * legenda do Novo Post (insere vários, fica aberto) e reação a comentário
 * (`closeOnSelect`, uma reação por toque).
 *
 * Por que não o teclado de emojis do sistema: o iOS não deixa um app abrir o
 * teclado direto na aba de emojis — dá para focar um campo, mas o teclado
 * abre no idioma que estava por último, e o usuário teria que achar o 🌐.
 * Como o WebView desenha os emojis com a fonte do sistema (Apple Color Emoji),
 * o visual aqui é idêntico ao do teclado.
 *
 * Dados: `client/lib/emoji-data.json`, gerado do emojibase 16 (CLDR) — os
 * emojis até a versão 15.0 (iOS 16.4+; os mais novos viram quadrado em aparelho
 * antigo), na ordem oficial, com palavras de busca em PT e EN sem acento. É
 * importado sob demanda: os ~170 KB só baixam na primeira abertura.
 *
 * Tons de pele ficam de fora (emoji base amarelo) para a grade não dobrar.
 */

type CategoryKey =
  | "smileys"
  | "animals"
  | "food"
  | "activities"
  | "travel"
  | "objects"
  | "symbols"
  | "flags";

type EmojiEntry = [emoji: string, keywords: string];
type EmojiData = { order: CategoryKey[]; groups: Record<CategoryKey, EmojiEntry[]> };

const CATEGORY_META: Record<CategoryKey | "recent", { icon: React.ComponentType<{ className?: string }>; label: TranslationKey }> = {
  recent: { icon: Clock, label: "emoji_cat_recent" },
  smileys: { icon: Smile, label: "emoji_cat_smileys" },
  animals: { icon: PawPrint, label: "emoji_cat_animals" },
  food: { icon: Apple, label: "emoji_cat_food" },
  activities: { icon: Trophy, label: "emoji_cat_activities" },
  travel: { icon: Car, label: "emoji_cat_travel" },
  objects: { icon: Lightbulb, label: "emoji_cat_objects" },
  symbols: { icon: Hash, label: "emoji_cat_symbols" },
  flags: { icon: Flag, label: "emoji_cat_flags" },
};

// ── Recentes (por aparelho, como no iPhone) ─────────────────────────────────
const RECENTS_KEY = "lk:emoji-recents";
const MAX_RECENTS = 24;

export function readRecentEmojis(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((e): e is string => typeof e === "string").slice(0, MAX_RECENTS) : [];
  } catch {
    return [];
  }
}

/** Registra um emoji usado (vai para o início da lista). */
export function pushRecentEmoji(emoji: string) {
  try {
    const next = [emoji, ...readRecentEmojis().filter((e) => e !== emoji)].slice(0, MAX_RECENTS);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* storage indisponível — só não lembra */
  }
}

// Carregamento único, compartilhado por todas as instâncias do drawer.
let dataPromise: Promise<EmojiData> | null = null;
function loadEmojiData(): Promise<EmojiData> {
  if (!dataPromise) {
    dataPromise = import("@/lib/emoji-data.json")
      .then((m) => (m.default ?? m) as unknown as EmojiData)
      .catch((err) => {
        dataPromise = null; // permite tentar de novo na próxima abertura
        throw err;
      });
  }
  return dataPromise;
}

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

interface EmojiPickerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (emoji: string) => void;
  /**
   * Fecha ao escolher. Padrão `false` (Novo Post: o usuário insere vários
   * emojis seguidos na legenda); as reações passam `true`.
   */
  closeOnSelect?: boolean;
  /** Emojis já escolhidos (ex.: reações do usuário) — aparecem destacados. */
  selected?: string[];
}

export function EmojiPickerDrawer({
  open,
  onOpenChange,
  onSelect,
  closeOnSelect = false,
  selected = [],
}: EmojiPickerDrawerProps) {
  const { t } = useLanguage();
  const [data, setData] = React.useState<EmojiData | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [recents, setRecents] = React.useState<string[]>([]);
  const [activeCat, setActiveCat] = React.useState<CategoryKey | "recent">("smileys");
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const sectionRefs = React.useRef<Partial<Record<CategoryKey | "recent", HTMLElement | null>>>({});
  const selectedSet = React.useMemo(() => new Set(selected), [selected]);

  React.useEffect(() => {
    if (!open) return;
    setQuery("");
    setRecents(readRecentEmojis());
    setFailed(false);
    let alive = true;
    loadEmojiData()
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [open]);

  const sections = React.useMemo(() => {
    if (!data) return [];
    const list: Array<{ key: CategoryKey | "recent"; emojis: string[] }> = [];
    if (recents.length > 0) list.push({ key: "recent", emojis: recents });
    for (const key of data.order) list.push({ key, emojis: data.groups[key].map(([e]) => e) });
    return list;
  }, [data, recents]);

  const results = React.useMemo(() => {
    const q = normalize(query);
    if (!data || !q) return null;
    const terms = q.split(/\s+/);
    const out: string[] = [];
    for (const key of data.order) {
      for (const [emoji, keywords] of data.groups[key]) {
        if (terms.every((term) => keywords.includes(term))) out.push(emoji);
      }
    }
    return out;
  }, [data, query]);

  const handlePick = (emoji: string) => {
    hapticLight();
    pushRecentEmoji(emoji);
    onSelect(emoji);
    if (closeOnSelect) onOpenChange(false);
  };

  // Aba ativa acompanha a rolagem (a seção cujo topo passou do topo da área).
  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container || results) return;
    const top = container.getBoundingClientRect().top + 8;
    let current: CategoryKey | "recent" = sections[0]?.key ?? "smileys";
    for (const s of sections) {
      const el = sectionRefs.current[s.key];
      if (el && el.getBoundingClientRect().top <= top) current = s.key;
    }
    if (current !== activeCat) setActiveCat(current);
  };

  const jumpTo = (key: CategoryKey | "recent") => {
    hapticLight();
    setQuery("");
    setActiveCat(key);
    // Espera o re-render (a busca pode estar escondendo as seções).
    requestAnimationFrame(() => {
      const el = sectionRefs.current[key];
      const container = scrollRef.current;
      if (el && container) container.scrollTo({ top: el.offsetTop - 4, behavior: "smooth" });
    });
  };

  const renderGrid = (emojis: string[], keyPrefix: string) => (
    <div className="grid grid-cols-8 gap-0.5">
      {emojis.map((emoji, i) => (
        <button
          key={`${keyPrefix}-${emoji}-${i}`}
          type="button"
          onClick={() => handlePick(emoji)}
          className="aspect-square flex items-center justify-center rounded-xl active:scale-90 transition-transform"
          style={{
            fontSize: 28,
            lineHeight: 1,
            background: selectedSet.has(emoji) ? "rgba(91,140,255,.25)" : "transparent",
          }}
          aria-label={emoji}
        >
          {emoji}
        </button>
      ))}
    </div>
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange} {...GLASS_SHEET_PROPS}>
      <DrawerContent
        style={{ ...GLASS_SHEET_STYLE, height: "72dvh" }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DrawerHeader className="pb-2">
          <DrawerTitle className="sr-only">{t("emoji_picker_title")}</DrawerTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "rgba(255,255,255,.45)" }} />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("emoji_search_placeholder")}
              className="rounded-full pl-9 pr-9 h-10 border-0 placeholder:text-white/40"
              style={GLASS_FIELD_STYLE}
              enterKeyHint="search"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,.15)", color: "#fff" }}
                aria-label={t("emoji_search_clear")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </DrawerHeader>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          /* `relative`: o `offsetTop` das seções (usado pelas abas) passa a
             ser medido a partir desta área de rolagem. */
          className="relative flex-1 min-h-0 overflow-y-auto px-3"
        >
          {failed ? (
            <p className="text-sm text-center py-10" style={{ color: "rgba(255,255,255,.55)" }}>
              {t("emoji_load_error")}
            </p>
          ) : !data ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: "rgba(255,255,255,.6)" }} />
            </div>
          ) : results ? (
            results.length === 0 ? (
              <p className="text-sm text-center py-10" style={{ color: "rgba(255,255,255,.55)" }}>
                {t("emoji_search_empty")}
              </p>
            ) : (
              <div className="pb-4">{renderGrid(results, "search")}</div>
            )
          ) : (
            sections.map((section) => (
              <section
                key={section.key}
                ref={(el) => { sectionRefs.current[section.key] = el; }}
                className="pb-3"
                /* Seções fora da tela não são desenhadas até chegarem perto —
                   são ~1.900 botões no total. */
                style={{ contentVisibility: "auto", containIntrinsicSize: "auto 600px" } as React.CSSProperties}
              >
                <p
                  className="text-[11px] font-semibold uppercase tracking-wide px-1 pt-1 pb-1.5"
                  style={{ color: "rgba(255,255,255,.45)" }}
                >
                  {t(CATEGORY_META[section.key].label)}
                </p>
                {renderGrid(section.emojis, section.key)}
              </section>
            ))
          )}
        </div>

        {/* Abas de categoria — no rodapé, como no teclado do iPhone */}
        {data && !results && (
          <div
            className="shrink-0 flex items-center justify-between px-3 pt-1.5"
            style={{
              borderTop: "1px solid rgba(255,255,255,.08)",
              paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
            }}
          >
            {sections.map((section) => {
              const Icon = CATEGORY_META[section.key].icon;
              const active = activeCat === section.key;
              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => jumpTo(section.key)}
                  className="h-9 w-9 rounded-full flex items-center justify-center transition-colors"
                  style={{
                    background: active ? "rgba(255,255,255,.14)" : "transparent",
                    color: active ? "#fff" : "rgba(255,255,255,.45)",
                  }}
                  aria-label={t(CATEGORY_META[section.key].label)}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </button>
              );
            })}
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
