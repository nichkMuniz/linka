import * as React from "react";

// Deterministic gradient from post id for posts without photos
const POST_GRADIENTS = [
  "radial-gradient(130% 110% at 30% 15%,#ffb27a 0%,#d8567a 38%,#5b2d8c 72%,#1a1438 100%)",
  "radial-gradient(130% 110% at 70% 25%,#7fe3ff 0%,#3f7fe6 45%,#2a3a8c 78%,#121a3a 100%)",
  "radial-gradient(130% 110% at 50% 10%,#b6f09a 0%,#4fb87a 40%,#1f6e5a 75%,#0a1a15 100%)",
  "radial-gradient(130% 110% at 20% 80%,#ffd07a 0%,#ff7a3c 45%,#9c3a2a 78%,#2a1410 100%)",
  "radial-gradient(130% 110% at 80% 20%,#e0b0ff 0%,#9d6bff 45%,#3a2a6a 78%,#0a0618 100%)",
];
export function getPostGradient(postId: string) {
  let hash = 0;
  for (let i = 0; i < postId.length; i++) hash = (hash * 31 + postId.charCodeAt(i)) >>> 0;
  return POST_GRADIENTS[hash % POST_GRADIENTS.length];
}

export const GLASS_TOP: React.CSSProperties = {
  background: "linear-gradient(rgba(255,255,255,.07),rgba(255,255,255,.02))",
  backdropFilter: "blur(10px) saturate(130%)",
  WebkitBackdropFilter: "blur(10px) saturate(130%)",
  border: "1px solid rgba(255,255,255,.10)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.14)",
};

export const GLASS_ACTION: React.CSSProperties = {
  background: "linear-gradient(rgba(255,255,255,.08),rgba(255,255,255,.03))",
  backdropFilter: "blur(12px) saturate(140%)",
  WebkitBackdropFilter: "blur(12px) saturate(140%)",
  border: "1px solid rgba(255,255,255,.12)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.16)",
};

// Caption description truncation — same limit used everywhere a post caption renders
export const DESC_MAX_CHARS = 80;

// Renderiza a legenda destacando hashtags em azul. Quando `onHashtagClick` é
// fornecido, cada hashtag vira clicável (navega para a página da hashtag). O token
// pode carregar pontuação no fim (ex.: "#fit,") — só a parte "#tag" fica clicável.
export function renderWithHashtags(
  text: string,
  onHashtagClick?: (tag: string) => void,
) {
  return text.split(/(\s+)/).map((token, i) => {
    if (!token.startsWith("#") || token.length <= 1) return token;
    const m = token.match(/^#([\p{L}\p{N}_]+)/u);
    if (!m) return token;
    const tag = m[1];
    if (!onHashtagClick) {
      return <span key={i} className="text-[#9db8ff] font-medium">{token}</span>;
    }
    const rest = token.slice(1 + tag.length);
    return (
      <React.Fragment key={i}>
        <span
          role="button"
          tabIndex={0}
          className="text-[#9db8ff] font-medium cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onHashtagClick(tag);
          }}
        >
          {"#" + tag}
        </span>
        {rest}
      </React.Fragment>
    );
  });
}
