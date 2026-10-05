import * as React from "react";
import { Pin, Type } from "lucide-react";
import type { StoryWithUser } from "@/lib/ritmofit-db";
import { ImageWithFallback } from "@/components/shared/image-with-fallback";
import { videoPosterSrc } from "@/lib/video-thumb";
import { useLanguage } from "@/lib/language-context";

const VIDEO_RE = /\.(mp4|mov|webm|m4v)(\?|#|$)/i;
const BUBBLE = 64;

/**
 * Capa do flow fixado. Ordem de preferência: `poster_url` (JPEG do 1º frame,
 * leve) → a própria imagem → o vídeo com media fragment (pinta o 1º frame no
 * WKWebView) → flow só de texto, com o fundo dele.
 *
 * Exportada: também é o verso da "moeda" do avatar do perfil (`FlowCoinAvatar`).
 */
export function PinnedFlowCover({ flow, thumbSize = BUBBLE }: { flow: StoryWithUser; thumbSize?: number }) {
  const media = flow.media_url ?? null;
  const isVideo = !!media && VIDEO_RE.test(media);

  if (flow.poster_url || (media && !isVideo)) {
    return (
      <ImageWithFallback
        src={flow.poster_url || media!}
        alt=""
        thumbSize={thumbSize}
        className="w-full h-full object-cover"
      />
    );
  }
  if (isVideo) {
    return (
      <video
        src={videoPosterSrc(media)}
        className="w-full h-full object-cover pointer-events-none"
        muted
        playsInline
        preload="metadata"
      />
    );
  }
  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: flow.background_color || "linear-gradient(135deg,#5b8cff,#9d6bff)" }}
    >
      <Type className="h-5 w-5 text-white/85" />
    </div>
  );
}

/**
 * Faixa "Flows fixados" do perfil — os destaques do Instagram. Fica logo acima
 * das abas (Publicações/Treinos/Marcações). O flow fixado continua expirando
 * no feed em 24h; aqui ele fica até ser desafixado.
 */
export function PinnedFlowsStrip({
  flows,
  onOpen,
  onPrefetch,
}: {
  flows: StoryWithUser[];
  onOpen: (flow: StoryWithUser) => void;
  /** Chamado ao encostar o dedo — começa a baixar a mídia antes do viewer montar. */
  onPrefetch?: (flow: StoryWithUser) => void;
}) {
  const { t, language } = useLanguage();
  if (flows.length === 0) return null;

  const dateLabel = (iso: string) =>
    new Date(iso).toLocaleDateString(language === "en" ? "en-US" : "pt-BR", {
      day: "numeric",
      month: "short",
    }).replace(".", "");

  return (
    <div className="space-y-2 px-4">
      <div className="flex items-center gap-1.5">
        <Pin className="h-3.5 w-3.5 text-brand" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {t("profile_pinned_flows")}
        </span>
      </div>
      {/* overflow-y-hidden: overflow-x-auto sozinho vira scroller vertical
          também e prenderia o arrasto da página (mesmo cuidado da faixa de metas). */}
      <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-1 scrollbar-none -mx-4 px-4">
        {flows.map((flow) => {
          // Nome dado ao fixar; sem nome, a data do flow.
          const label = flow.pinned_title?.trim() || dateLabel(flow.created_at);
          return (
            <button
              key={flow.id}
              type="button"
              onPointerDown={() => onPrefetch?.(flow)}
              onClick={() => onOpen(flow)}
              aria-label={t("profile_pinned_flow_aria").replace("{date}", label)}
              className="flex-shrink-0 flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
              style={{ width: BUBBLE + 6 }}
            >
              {/* Mesmo anel cônico do avatar com flow ativo, mais discreto. */}
              <span
                className="block rounded-full"
                style={{
                  width: BUBBLE + 6,
                  height: BUBBLE + 6,
                  padding: 2,
                  background: "conic-gradient(from 200deg,#ff8a2a,#d8567a,#7b3ff2,#3a8dff,#ff8a2a)",
                }}
              >
                <span
                  className="block w-full h-full rounded-full overflow-hidden"
                  style={{ border: "2px solid #06070c", background: "rgba(255,255,255,.06)" }}
                >
                  <PinnedFlowCover flow={flow} />
                </span>
              </span>
              <span className="w-full truncate text-center" style={{ fontSize: "11px", color: "rgba(255,255,255,.7)" }}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
