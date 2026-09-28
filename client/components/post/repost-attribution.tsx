import { Repeat2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { UserAvatar } from "@/components/shared/user-avatar";
import { VerifiedBadge } from "@/components/shared/VerifiedBadge";
import { useLanguage } from "@/lib/language-context";
import { hapticLight } from "@/lib/haptics";
import type { RepostOrigin } from "@/lib/ritmofit-db";

/**
 * Crédito de um repost: "Repost de @autor", com avatar e selo. O toque abre o
 * post ORIGINAL — é lá que ficam as curtidas, os comentários e as marcações
 * do autor. Usado no card do feed, no detalhe do post e no viewer do perfil.
 */
export function RepostAttribution({
  origin,
  className,
  onNavigate,
}: {
  origin: RepostOrigin;
  className?: string;
  /** Chamado antes de navegar — ex.: o drawer do perfil precisa fechar. */
  onNavigate?: () => void;
}) {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        hapticLight();
        onNavigate?.();
        navigate(`/post/${origin.postId}`);
      }}
      className={`inline-flex items-center gap-1.5 max-w-full rounded-full pl-1.5 pr-2.5 py-1 active:opacity-70 transition-opacity ${className ?? ""}`}
      style={{ background: "rgba(0,0,0,.35)", border: "1px solid rgba(255,255,255,.14)" }}
    >
      <Repeat2 className="h-3.5 w-3.5 shrink-0 text-white/80" />
      <UserAvatar photo={origin.photo} nickname={origin.nickname} className="h-4 w-4 shrink-0" />
      <span className="text-[11.5px] font-semibold text-white/90 truncate">
        {t("repost_from").replace("{name}", origin.nickname)}
      </span>
      {origin.verifiedTier && <VerifiedBadge size="sm" tier={origin.verifiedTier} />}
    </button>
  );
}

/**
 * Legenda exibida: a do próprio post; num repost sem legenda própria, a do
 * original (quem repostou pode escrever a sua pela edição do post).
 */
export function displayedPostDescription(post: {
  description?: string | null;
  repostOf?: RepostOrigin | null;
}): string {
  const own = post.description ?? "";
  if (post.repostOf && !own.trim()) return post.repostOf.description ?? "";
  return own;
}
