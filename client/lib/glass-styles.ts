import type { CSSProperties } from "react";

// ─── Glass drawer (novo design) — estilos compartilhados ─────────────────────
// Shell escuro com blur, handle branco e bordas translúcidas. Fonte única de
// verdade para os drawers no padrão "vidro escuro" (promoções, duelos, etc.).
// Mesmo visual do PromotionCommentsDrawer.

/** Shell do DrawerContent: gradiente escuro + blur + borda translúcida. */
export const GLASS_SHEET_STYLE: CSSProperties = {
  maxHeight: "90dvh",
  background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
  backdropFilter: "blur(40px) saturate(180%)",
  WebkitBackdropFilter: "blur(40px) saturate(180%)",
  borderTop: "1px solid rgba(255,255,255,.14)",
};

/** Inputs / textareas / select triggers dentro do sheet glass. */
export const GLASS_FIELD_STYLE: CSSProperties = {
  background: "rgba(255,255,255,.07)",
  border: "1px solid rgba(255,255,255,.12)",
  color: "#fff",
};

/** Botão de ação principal — gradiente azul → roxo. */
export const GLASS_PRIMARY_BTN_STYLE: CSSProperties = {
  background: "linear-gradient(135deg,#5b8cff,#9d6bff)",
  color: "#fff",
};

/** Card / container translúcido dentro do sheet. */
export const GLASS_PANEL_STYLE: CSSProperties = {
  background: "rgba(255,255,255,.06)",
  border: "1px solid rgba(255,255,255,.1)",
};

/**
 * Card / superfície de vidro **sobre a página** (fora de um sheet) — usado em
 * listas e cards de conteúdo, ex.: a tela do grupo de duelos. Diferente do
 * `GLASS_PANEL_STYLE` (que vive dentro de um sheet já borrado), este precisa do
 * `backdrop-filter` próprio para captar o fundo da página. Blur moderado de
 * propósito: `backdrop-filter` é reavaliado a cada frame de scroll no WKWebView
 * (ver docs/15-design-system.md §0.3).
 */
export const GLASS_CARD_STYLE: CSSProperties = {
  background: "linear-gradient(rgba(255,255,255,.09),rgba(255,255,255,.03))",
  backdropFilter: "blur(14px) saturate(150%)",
  WebkitBackdropFilter: "blur(14px) saturate(150%)",
  border: "1px solid rgba(255,255,255,.10)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.12)",
};

/** Props padrão do DrawerContent glass (handle branco + cantos arredondados). */
export const GLASS_SHEET_PROPS = {
  handleClassName: "mt-[6px] h-1 w-[38px] bg-white/25",
  className: "flex flex-col !rounded-t-[32px] !border-0",
} as const;

/** Classe para labels de formulário no sheet glass. */
export const GLASS_LABEL_CLASS = "text-sm font-medium text-white/85";

/** Classe para inputs/textareas — remove a borda do shadcn e clareia o texto. */
export const GLASS_FIELD_CLASS = "border-0 text-white placeholder:text-white/35";
