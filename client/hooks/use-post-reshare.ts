import * as React from "react";
import type { VerifiedTier } from "@/lib/verified-tier";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/lib/language-context";
import { reportHandledError } from "@/lib/monitoring";
import { sharePostToFlow } from "@/lib/post-to-flow";
import {
  getRepostedPostIdsDb,
  repostPostDb,
  type RepostOrigin,
  type SearchUser,
  type StoryPostSticker,
} from "@/lib/ritmofit-db";

/** O mínimo de um post para decidir e executar o recompartilhamento. */
/** Teto da legenda copiada para o flow: a moldura mostra 3 linhas, o resto é só peso no jsonb. */
const FLOW_POST_CAPTION_MAX = 300;

export type ResharablePost = {
  id: string;
  user_id: string;
  photo?: string | null;
  photos?: string[] | null;
  userNickname?: string | null;
  userPhoto?: string | null;
  /** Selo do autor — vai junto na moldura do post no flow. */
  isVerified?: boolean;
  verifiedTier?: VerifiedTier | null;
  /** Legenda — vai junto na moldura do post no flow. */
  description?: string | null;
  taggedUsers?: SearchUser[];
  repostOf?: RepostOrigin | null;
};

/**
 * Recompartilhar um post: "Seu flow" (dono OU marcado) e "Seu feed" (só
 * marcado). Um hook único para feed, detalhe do post e perfil — as três telas
 * abrem o mesmo `ShareDrawer`.
 *
 * Repost não se recompartilha: o crédito já aponta para o original, e o banco
 * recusaria repost de repost.
 *
 * `prepare(post)` na hora de abrir o drawer; as ações ficam `undefined` quando
 * não se aplicam, e o drawer esconde o botão correspondente.
 */
export function usePostReshare(options: {
  /** Tag do Sentry ("feed", "post-detail", "profile"). */
  context: string;
  onFlowShared?: () => void;
  onReposted?: () => void;
}) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [post, setPost] = React.useState<ResharablePost | null>(null);
  const [reposted, setReposted] = React.useState(false);
  const { onFlowShared, onReposted, context } = options;

  const viewerId = user?.id ?? null;
  const isOwner = !!post && post.user_id === viewerId;
  const isTagged = !!post && !!viewerId && (post.taggedUsers ?? []).some((u) => u.id === viewerId);
  const firstPhoto = post ? (post.photos?.length ? String(post.photos[0]) : post.photo || null) : null;
  const canReshare = !!post && !post.repostOf && !!firstPhoto;

  const prepare = React.useCallback((next: ResharablePost | null) => {
    setPost(next);
    setReposted(false);
    const tagged = !!next && !!viewerId && (next.taggedUsers ?? []).some((u) => u.id === viewerId);
    if (next && tagged && !next.repostOf) {
      getRepostedPostIdsDb([next.id])
        .then((ids) => setReposted(ids.has(next.id)))
        .catch(() => {});
    }
  }, [viewerId]);

  const canShareToFlow = canReshare && (isOwner || isTagged);
  const buildPostSticker = (): StoryPostSticker => ({
    postId: post!.id,
    photo: firstPhoto!,
    authorId: post!.user_id,
    authorNickname: post!.userNickname ?? "",
    authorPhoto: post!.userPhoto ?? null,
    authorVerifiedTier: post!.isVerified ? (post!.verifiedTier ?? "notable") : null,
    caption: post!.description?.trim() ? post!.description.trim().slice(0, FLOW_POST_CAPTION_MAX) : null,
  });

  const shareToFlow = canShareToFlow
    ? async () => {
        try {
          await sharePostToFlow(buildPostSticker());
          toast({ title: t("share_flow_success"), description: t("share_flow_success_desc") });
          onFlowShared?.();
        } catch (err) {
          reportHandledError(err, `${context}:share-post-to-flow`);
          toast({ title: t("share_flow_error"), description: t("retry"), variant: "destructive" });
          throw err;
        }
      }
    : undefined;

  // "Editar antes de postar": o criador de flow mora no Feed, que abre direto
  // no modo texto com a moldura do post colada (FlowCreationSeed.postSticker).
  const editFlow = canShareToFlow
    ? () => {
        navigate("/", { state: { createFlowSeed: { postSticker: buildPostSticker() } } });
      }
    : undefined;

  const repostToFeed = canReshare && isTagged && !isOwner
    ? async () => {
        try {
          await repostPostDb(post!.id);
          setReposted(true);
          toast({ title: t("repost_success"), description: t("repost_success_desc") });
          onReposted?.();
        } catch (err: any) {
          const code = err?.code as string | null | undefined;
          // Já repostado (outro aparelho) não é erro para o usuário: só sincroniza.
          if (code === "REPOST_DUPLICATE") {
            setReposted(true);
            toast({ title: t("repost_already") });
            return;
          }
          if (code !== "REPOST_PRIVATE_AUTHOR" && code !== "REPOST_NOT_TAGGED") {
            reportHandledError(err, `${context}:repost-post`);
          }
          toast({
            title: t("repost_error"),
            description:
              code === "REPOST_PRIVATE_AUTHOR" ? t("repost_error_private")
              : code === "REPOST_NOT_TAGGED" ? t("repost_error_not_tagged")
              : t("retry"),
            variant: "destructive",
          });
          throw err;
        }
      }
    : undefined;

  return { prepare, shareToFlow, editFlow, repostToFeed, repostedToFeed: reposted };
}
