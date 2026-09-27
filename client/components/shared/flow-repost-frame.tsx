import React from "react";
import { Repeat2 } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useLanguage } from "@/lib/language-context";
import type { StoryWithUser } from "@/lib/ritmofit-db";

/**
 * Escala do "palco" original dentro da moldura. O flow original (mídia + frases)
 * é desenhado em tela cheia e reduzido como um bloco só: as frases ficam
 * exatamente onde o autor as colocou, sem recalcular posição nem tamanho de fonte.
 */
const FRAME_SCALE = 0.8;

interface FlowRepostFrameProps {
  story: Pick<StoryWithUser, "reposted_from" | "repostedFromNickname" | "repostedFromPhoto">;
  children: React.ReactNode;
}

/**
 * Repost de flow estilo Instagram: o flow original aparece como um card
 * arredondado sobre um fundo gradiente, com o autor original no topo do card.
 * Flow que não é repost → renderiza os filhos sem moldura nenhuma.
 *
 * Os filhos são as mesmas camadas que o viewer desenha para um flow comum
 * (mídia `w-full h-full`, spinner e frases `absolute inset-0`) — o card é um
 * `absolute inset-0` escalado, então nada dentro deles precisa mudar.
 */
export function FlowRepostFrame({ story, children }: FlowRepostFrameProps) {
  const { t } = useLanguage();
  if (!story.reposted_from) return <>{children}</>;

  return (
    <div
      className="absolute inset-0"
      style={{ background: "linear-gradient(160deg,#1c2340 0%,#241a3a 55%,#0e0d14 100%)" }}
    >
      <div
        className="absolute inset-0 flex items-center justify-center overflow-hidden"
        style={{
          transform: `scale(${FRAME_SCALE})`,
          borderRadius: 28,
          boxShadow: "0 24px 60px -18px rgba(0,0,0,.8)",
          border: "1px solid rgba(255,255,255,.14)",
        }}
      >
        {children}

        {/* Autor original — dentro do card, como no Instagram. Acima das frases
            (z-[5]) e sem capturar toque: as zonas de navegação ficam por cima. */}
        <div
          className="absolute top-3 left-3 z-[6] flex items-center gap-2 rounded-full pl-1 pr-3 py-1 pointer-events-none"
          style={{
            background: "rgba(0,0,0,.45)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,.14)",
          }}
        >
          {story.repostedFromNickname ? (
            <UserAvatar
              photo={story.repostedFromPhoto}
              nickname={story.repostedFromNickname}
              className="h-7 w-7"
            />
          ) : (
            <span className="h-7 w-7 rounded-full flex items-center justify-center bg-white/10">
              <Repeat2 className="h-4 w-4 text-white" />
            </span>
          )}
          <span className="text-[13px] font-semibold text-white max-w-[160px] truncate">
            {story.repostedFromNickname ?? t("flow_repost_badge")}
          </span>
        </div>
      </div>
    </div>
  );
}
