import * as React from "react";
import { FEATURES } from "@/lib/feature-flags";

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

// Menção "@usuario" dentro de um token — mesmo conjunto de caracteres do handle
// (`MENTION_HANDLE_CHARS`). Ponto/hífen no FIM saem do handle ("@ana." é fim de
// frase), igual ao que o trigger de notificação faz.
function splitMention(token: string): { handle: string; rest: string } | null {
  const m = token.match(/^@([a-z0-9._-]+)/i);
  if (!m) return null;
  const handle = m[1].replace(/[.-]+$/, "");
  if (!handle) return null;
  return { handle, rest: token.slice(1 + handle.length) };
}

function renderMention(
  key: React.Key,
  handle: string,
  rest: string,
  onMentionClick?: (handle: string) => void,
) {
  return (
    <React.Fragment key={key}>
      <span
        role={onMentionClick ? "button" : undefined}
        tabIndex={onMentionClick ? 0 : undefined}
        className={`text-[#9db8ff] font-medium${onMentionClick ? " cursor-pointer" : ""}`}
        onClick={
          onMentionClick
            ? (e) => {
                e.stopPropagation();
                onMentionClick(handle);
              }
            : undefined
        }
      >
        {"@" + handle}
      </span>
      {rest}
    </React.Fragment>
  );
}

/**
 * Comentários: destaca só as menções "@usuario" (hashtag em comentário segue
 * texto puro). Com `onMentionClick`, a menção abre o perfil.
 */
export function renderWithMentions(
  text: string,
  onMentionClick?: (handle: string) => void,
) {
  return text.split(/(\s+)/).map((token, i) => {
    const mention = token.startsWith("@") ? splitMention(token) : null;
    return mention ? renderMention(i, mention.handle, mention.rest, onMentionClick) : token;
  });
}

// Renderiza a legenda destacando hashtags (e menções @usuario) em azul. Quando `onHashtagClick` é
// fornecido, cada hashtag vira clicável (navega para a página da hashtag). O token
// pode carregar pontuação no fim (ex.: "#fit,") — só a parte "#tag" fica clicável.
export function renderWithHashtags(
  text: string,
  onHashtagClick?: (tag: string) => void,
  /** Toque numa menção "@usuario" (abre o perfil). Sem ele a menção só fica destacada. */
  onMentionClick?: (handle: string) => void,
) {
  return text.split(/(\s+)/).map((token, i) => {
    if (token.startsWith("@")) {
      const mention = splitMention(token);
      return mention ? renderMention(i, mention.handle, mention.rest, onMentionClick) : token;
    }
    if (!token.startsWith("#") || token.length <= 1) return token;
    const m = token.match(/^#([\p{L}\p{N}_]+)/u);
    if (!m) return token;
    const tag = m[1];
    // Com FEATURES.hashtags desligada a rota /tag/:tag não existe, e o toque
    // cairia no catch-all que joga o usuário no feed. Ignorar o callback aqui
    // conserta TODOS os callsites de uma vez (feed, detalhe do post, shots,
    // flows) — a hashtag continua destacada, só não é mais tocável.
    if (!onHashtagClick || !FEATURES.hashtags) {
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
