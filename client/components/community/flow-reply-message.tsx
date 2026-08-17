import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ImageOff, Play } from "lucide-react";
import { getFlowByIdDb } from "@/lib/ritmofit-db";
import { useLanguage } from "@/lib/language-context";
import { videoPosterSrc } from "@/lib/video-thumb";
import { isFlowExpired } from "@/lib/flow-reply";

interface FlowReplyMessageProps {
  flowId: string;
  /** Texto que o remetente digitou no flow (já sem o prefixo do protocolo). */
  text: string;
  /** A bolha é do próprio usuário? Muda o rótulo ("você respondeu" x "respondeu ao seu"). */
  isOwn: boolean;
}

/**
 * Memo de sessão por flow id. `getFlowByIdDb` não é cacheado e faz duas idas ao
 * banco (flow + perfil); responder o mesmo flow três vezes renderiza três bolhas,
 * que sem isto disparariam seis queries para pintar a mesma miniatura.
 */
const flowPreviewCache = new Map<string, Promise<Awaited<ReturnType<typeof getFlowByIdDb>>>>();
const FLOW_CACHE_MAX = 50;

function fetchFlowCached(flowId: string) {
  const hit = flowPreviewCache.get(flowId);
  if (hit) return hit;
  const promise = getFlowByIdDb(flowId).catch((err) => {
    // Falha não fica grudada no cache — a próxima bolha (ou remontagem) tenta de novo.
    flowPreviewCache.delete(flowId);
    throw err;
  });
  if (flowPreviewCache.size >= FLOW_CACHE_MAX) {
    const oldest = flowPreviewCache.keys().next().value;
    if (oldest !== undefined) flowPreviewCache.delete(oldest);
  }
  flowPreviewCache.set(flowId, promise);
  return promise;
}

type PreviewState =
  | { status: "loading" }
  | { status: "unavailable" }
  | {
      status: "ready";
      image: string | null;
      /** O flow é um vídeo? Decide o selo de play, independente de como a capa é pintada. */
      isVideo: boolean;
      /** Precisa de um `<video>` para pintar a capa (vídeo sem `poster_url` no banco). */
      needsVideoElement: boolean;
      backgroundColor: string | null;
      description: string;
      expired: boolean;
    };

/**
 * Bolha de **resposta privada a um flow** (mensagens `[flowreply]:<id>|<texto>`).
 *
 * Estilo Instagram: uma miniatura vertical do flow respondido, com o rótulo de
 * contexto acima e o texto da resposta abaixo. Tocar na miniatura abre o flow
 * (`/flows/:id`) enquanto ele estiver no ar.
 *
 * O **texto é sempre renderizado**, mesmo quando a miniatura falha: o flow expira em
 * 24h e pode ser apagado pelo autor, mas a resposta é uma mensagem como outra
 * qualquer e não pode sumir da conversa junto com a mídia.
 */
export function FlowReplyMessage({ flowId, text, isOwn }: FlowReplyMessageProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [preview, setPreview] = React.useState<PreviewState>({ status: "loading" });

  React.useEffect(() => {
    let cancelled = false;
    setPreview({ status: "loading" });
    (async () => {
      try {
        const flow = await fetchFlowCached(flowId);
        if (cancelled) return;
        if (!flow) {
          setPreview({ status: "unavailable" });
          return;
        }
        const isVideo =
          !!flow.media_url &&
          (flow.media_url.includes(".mp4") ||
            flow.media_url.includes(".webm") ||
            flow.media_url.includes(".mov"));
        setPreview({
          status: "ready",
          // Vídeo com capa gravada no banco usa a capa (imagem leve); sem capa, o
          // fragment `#t=0.1` força o WebView a pintar o 1º frame.
          image: isVideo ? flow.poster_url || flow.media_url : flow.media_url || null,
          isVideo,
          needsVideoElement: isVideo && !flow.poster_url,
          backgroundColor: flow.background_color ?? null,
          description: flow.description ?? "",
          expired: isFlowExpired(flow.created_at),
        });
      } catch {
        if (!cancelled) setPreview({ status: "unavailable" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [flowId]);

  const canOpen = preview.status === "ready" && !preview.expired;

  const thumb = (() => {
    if (preview.status === "loading") {
      return (
        <div
          className="h-[104px] w-[68px] rounded-xl animate-pulse"
          style={{ background: "rgba(255,255,255,.12)" }}
        />
      );
    }
    if (preview.status === "unavailable") {
      return (
        <div
          className="h-[104px] w-[68px] rounded-xl flex flex-col items-center justify-center gap-1.5 px-1"
          style={{ background: "rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.12)" }}
        >
          <ImageOff className="h-4 w-4" style={{ color: "rgba(255,255,255,.4)" }} />
          <p className="text-[9px] leading-tight text-center" style={{ color: "rgba(255,255,255,.5)" }}>
            {t("community_shared_unavailable")}
          </p>
        </div>
      );
    }
    return (
      <div
        className="relative h-[104px] w-[68px] rounded-xl overflow-hidden"
        style={{
          background: preview.backgroundColor ?? "rgba(0,0,0,.3)",
          border: "1px solid rgba(255,255,255,.16)",
        }}
      >
        {preview.image ? (
          preview.needsVideoElement ? (
            <video
              src={videoPosterSrc(preview.image)}
              muted
              playsInline
              preload="metadata"
              className="h-full w-full object-cover pointer-events-none"
            />
          ) : (
            <img src={preview.image} alt="" loading="lazy" className="h-full w-full object-cover" />
          )
        ) : (
          preview.description && (
            <p className="absolute inset-0 flex items-center justify-center px-1 text-[9px] text-center text-white line-clamp-4">
              {preview.description}
            </p>
          )
        )}
        {preview.isVideo && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="h-6 w-6 rounded-full flex items-center justify-center"
              style={{ background: "rgba(0,0,0,.45)" }}
            >
              <Play className="h-3 w-3 text-white fill-white ml-0.5" />
            </div>
          </div>
        )}
        {preview.expired && <div className="absolute inset-0" style={{ background: "rgba(0,0,0,.45)" }} />}
      </div>
    );
  })();

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,.6)" }}>
        {isOwn ? t("community_flow_reply_outgoing") : t("community_flow_reply_incoming")}
      </p>

      {canOpen ? (
        <button
          type="button"
          onClick={() => navigate(`/flows/${flowId}`)}
          className="block active:scale-[0.97] transition-transform"
          aria-label={t("community_flow_reply_open")}
        >
          {thumb}
        </button>
      ) : (
        <div>
          {thumb}
          {preview.status === "ready" && preview.expired && (
            <p className="mt-1 text-[10px]" style={{ color: "rgba(255,255,255,.45)" }}>
              {t("community_flow_reply_expired")}
            </p>
          )}
        </div>
      )}

      {text.trim() && <p className="text-sm">{text}</p>}
    </div>
  );
}
