import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ImageOff, Play } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { getPostByIdDb, getShotByIdDb } from "@/lib/ritmofit-db";
import { useLanguage } from "@/lib/language-context";

interface SharedContentMessageProps {
  kind: "post" | "shot";
  contentId: string;
}

type PreviewState =
  | { status: "loading" }
  | { status: "unavailable" }
  | {
      status: "ready";
      image: string | null;
      isVideo: boolean;
      description: string;
      authorNickname: string;
      authorPhoto: string | null;
    };

/**
 * Card rico exibido no chat quando alguém compartilha um post ou shot
 * (mensagens "[post]:<id>" / "[shot]:<id>"). Tocar no card navega para o
 * conteúdo; conteúdo apagado exibe estado "indisponível" (estilo Instagram).
 */
export function SharedContentMessage({ kind, contentId }: SharedContentMessageProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [preview, setPreview] = React.useState<PreviewState>({ status: "loading" });

  React.useEffect(() => {
    let cancelled = false;
    setPreview({ status: "loading" });
    (async () => {
      try {
        if (kind === "post") {
          const post = await getPostByIdDb(contentId);
          if (cancelled) return;
          if (!post) {
            setPreview({ status: "unavailable" });
            return;
          }
          const image = post.photos?.length ? String(post.photos[0]) : post.photo || null;
          setPreview({
            status: "ready",
            image,
            isVideo: false,
            description: post.description,
            authorNickname: post.userNickname,
            authorPhoto: post.userPhoto,
          });
        } else {
          const shot = await getShotByIdDb(contentId);
          if (cancelled) return;
          if (!shot) {
            setPreview({ status: "unavailable" });
            return;
          }
          setPreview({
            status: "ready",
            image: shot.video_url,
            isVideo: true,
            description: shot.description,
            authorNickname: shot.userNickname,
            authorPhoto: shot.userPhoto,
          });
        }
      } catch {
        if (!cancelled) setPreview({ status: "unavailable" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, contentId]);

  if (preview.status === "loading") {
    return (
      <div className="w-[220px] rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,.06)" }}>
        <div className="flex items-center gap-2 p-2.5">
          <div className="h-7 w-7 rounded-full animate-pulse" style={{ background: "rgba(255,255,255,.12)" }} />
          <div className="h-3 w-24 rounded animate-pulse" style={{ background: "rgba(255,255,255,.12)" }} />
        </div>
        <div className="h-[180px] animate-pulse" style={{ background: "rgba(255,255,255,.08)" }} />
      </div>
    );
  }

  if (preview.status === "unavailable") {
    return (
      <div
        className="w-[220px] rounded-xl flex flex-col items-center gap-2 py-6 px-4"
        style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)" }}
      >
        <ImageOff className="h-6 w-6" style={{ color: "rgba(255,255,255,.4)" }} />
        <p className="text-xs text-center" style={{ color: "rgba(255,255,255,.55)" }}>
          {t("community_shared_unavailable")}
        </p>
      </div>
    );
  }

  const handleOpen = () => {
    if (kind === "post") navigate(`/post/${contentId}`);
    else navigate("/shots", { state: { shotId: contentId } });
  };

  return (
    <button
      onClick={handleOpen}
      className="w-[220px] rounded-xl overflow-hidden text-left active:scale-[0.98] transition-transform"
      style={{ background: "rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.1)" }}
    >
      <div className="flex items-center gap-2 p-2.5">
        <UserAvatar photo={preview.authorPhoto} nickname={preview.authorNickname} size="sm" className="h-7 w-7 shrink-0" />
        <p className="text-xs font-semibold truncate text-white">{preview.authorNickname}</p>
      </div>
      {preview.image && (
        <div className="relative">
          {preview.isVideo ? (
            <video
              src={preview.image}
              muted
              playsInline
              preload="metadata"
              className="w-full h-[240px] object-cover pointer-events-none"
            />
          ) : (
            <img src={preview.image} alt="" className="w-full h-[220px] object-cover" loading="lazy" />
          )}
          {preview.isVideo && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,.45)" }}>
                <Play className="h-5 w-5 text-white fill-white ml-0.5" />
              </div>
            </div>
          )}
        </div>
      )}
      {preview.description && (
        <p className="text-xs px-2.5 py-2 line-clamp-2" style={{ color: "rgba(255,255,255,.75)" }}>
          {preview.description}
        </p>
      )}
      <p className="text-[11px] px-2.5 pb-2 font-medium" style={{ color: "rgba(255,255,255,.5)" }}>
        {kind === "post" ? t("community_shared_view_post") : t("community_shared_view_shot")}
      </p>
    </button>
  );
}
