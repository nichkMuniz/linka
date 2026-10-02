import * as React from "react";
import { Trash2, Pencil, Check, X, Send, MoreVertical, CornerDownRight } from "lucide-react";
import { CommentReactions } from "@/components/shared/comment-reactions";
import { UserSafetyDrawer } from "@/components/shared/user-safety-drawer";
import { hasObjectionableContent } from "@/lib/content-filter";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  getPostCommentsDb,
  addPostCommentDb,
  deletePostCommentDb,
  updatePostCommentDb,
  markPostCommentsAsReadDb,
  getUserProfileDb,
  type PostComment,
} from "@/lib/ritmofit-db";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { hapticLight } from "@/lib/haptics";
import { UserAvatar } from "@/components/shared/user-avatar";
import { VerifiedBadge } from "@/components/shared/VerifiedBadge";
import { useLanguage } from "@/lib/language-context";
import { useKeyboardAwareHeight } from "@/hooks/use-keyboard-aware-height";
import { useKeyboardInputScroll } from "@/hooks/use-keyboard-input-scroll";
import { MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { MentionSuggestions } from "@/components/shared/mention-suggestions";
import { renderWithMentions } from "@/lib/post-visuals";
import { useOpenProfileByHandle } from "@/hooks/use-open-profile-by-handle";

// Module-level flag: survives StrictMode remount cycles, resets when postId changes
let _commentsAutoOpenConsumed = false;
let _commentsAutoOpenPostId = "";

function formatRelativeTime(dateStr: string, nowLabel: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return nowLabel;
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function PostCommentsDialog({
  postId,
  commentCount,
  hasActivity,
  isPostOwner = false,
  hasUnreadComments = false,
  defaultOpen = false,
  onCountChange,
}: {
  postId: string;
  commentCount: number;
  hasActivity?: boolean;
  isPostOwner?: boolean;
  hasUnreadComments?: boolean;
  defaultOpen?: boolean;
  /** Notifica o pai quando a contagem real de comentários muda (carregar/adicionar/excluir) */
  onCountChange?: (count: number) => void;
}) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [open, setOpen] = React.useState(false);
  const viewportHeight = useKeyboardAwareHeight();
  const savedScrollY = React.useRef(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  // Campo de edição de um comentário (só um editado por vez) — "@" também sugere aqui.
  const editTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const openProfileByHandle = useOpenProfileByHandle();
  // Menção no comentário abre o perfil — fecha o drawer antes de sair da tela.
  const handleMentionClick = React.useCallback(
    (handle: string) => {
      setOpen(false);
      openProfileByHandle(handle);
    },
    [openProfileByHandle],
  );
  // Toque na foto ou no nome de quem comentou → perfil dele (o próprio vai
  // para /perfil). Mesmo padrão da menção: fecha o drawer antes de sair.
  const navigate = useNavigate();
  const handleAuthorClick = React.useCallback(
    (authorId: string) => {
      if (!authorId) return;
      hapticLight();
      setOpen(false);
      navigate(authorId === user?.id ? "/perfil" : `/usuario/${authorId}`);
    },
    [navigate, user?.id],
  );

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      savedScrollY.current = window.scrollY;
    }
    setOpen(nextOpen);
  }, []);

  // Manually pin the page in place while the drawer is open so iOS WebView
  // doesn't reset scroll to the top. We use position:fixed on the body with
  // a negative top offset, then restore the exact scroll position on close.
  React.useEffect(() => {
    if (!open) return;
    const scrollY = savedScrollY.current;
    const body = document.body;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  // Open automatically once when defaultOpen=true (e.g. navigated from notification)
  React.useEffect(() => {
    if (!defaultOpen) return;
    if (_commentsAutoOpenPostId !== postId) {
      _commentsAutoOpenConsumed = false;
      _commentsAutoOpenPostId = postId;
    }
    if (!_commentsAutoOpenConsumed) {
      _commentsAutoOpenConsumed = true;
      setOpen(true);
    }
  }, [defaultOpen, postId]);

  const [comments, setComments] = React.useState<PostComment[]>([]);
  // Só reporta a contagem ao pai depois do primeiro load real — senão o []
  // inicial zeraria o contador exibido no trigger antes dos dados chegarem
  const hasLoadedCommentsRef = React.useRef(false);
  React.useEffect(() => { hasLoadedCommentsRef.current = false; }, [postId]);
  React.useEffect(() => {
    if (hasLoadedCommentsRef.current) onCountChange?.(comments.length);
  }, [comments, onCountChange]);
  const [loading, setLoading] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const commentsListRef = React.useRef<HTMLDivElement>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [deleteCommentDialogOpen, setDeleteCommentDialogOpen] = React.useState(false);
  /**
   * Autor do comentário em foco no menu de segurança (Guideline 1.2).
   * Comentário é superfície clássica de assédio e não tinha nenhuma ação aqui.
   * Bloquear o autor também some com os comentários dele — a lista já é
   * filtrada por `user_blocks` no servidor.
   */
  const [safetyTarget, setSafetyTarget] = React.useState<{ userId: string; userName: string } | null>(null);
  const [deletingCommentId, setDeletingCommentId] = React.useState<string | null>(null);
  const [isDeletingComment, setIsDeletingComment] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState("");
  const [savingEditId, setSavingEditId] = React.useState<string | null>(null);
  const [currentUserPhoto, setCurrentUserPhoto] = React.useState<string | null>(null);
  /**
   * Comentário sendo respondido. Enquanto existe, a barra de escrever mostra
   * "Respondendo a {nome}" com um trecho do comentário, e ele fica destacado na
   * lista — a pessoa precisa ver que a resposta vai SÓ para aquele comentário.
   */
  const [replyTarget, setReplyTarget] = React.useState<PostComment | null>(null);
  /** Conversas (id do comentário raiz) com todas as respostas à mostra. */
  const [expandedThreads, setExpandedThreads] = React.useState<Set<string>>(() => new Set());
  // O input de escrever comentário é rodapé fixo (já acima do teclado). Este hook
  // cobre a textarea de EDIÇÃO inline, que fica no meio da lista rolável.
  useKeyboardInputScroll();

  // Fix for iOS WebView (Capacitor): vaul can leave scroll-lock attributes/styles stuck
  React.useEffect(() => {
    if (!open) {
      document.body.removeAttribute("data-scroll-locked");
      document.body.style.overflow = "";
      document.body.style.pointerEvents = "";
      setDraft("");
      setEditingId(null);
      setEditDraft("");
      setReplyTarget(null);
      setExpandedThreads(new Set());
    }
  }, [open]);

  // Conversas: cada resposta fica embaixo do comentário RAIZ da conversa (um
  // nível de recuo, mesmo respondendo a outra resposta — quem foi respondido
  // aparece no "em resposta a"). Raízes seguem a ordem da lista (mais novo
  // primeiro); respostas, em ordem cronológica. Resposta cujo pai não veio
  // (bloqueado, fora do limite) vira raiz — some o contexto, não o conteúdo.
  const commentById = React.useMemo(
    () => new Map(comments.map((c) => [c.id, c])),
    [comments],
  );
  const rootIdOf = React.useCallback(
    (comment: PostComment): string => {
      let current = comment;
      const seen = new Set<string>();
      while (current.parentId && commentById.has(current.parentId) && !seen.has(current.id)) {
        seen.add(current.id);
        current = commentById.get(current.parentId)!;
      }
      return current.id;
    },
    [commentById],
  );
  const { rootComments, repliesByRoot } = React.useMemo(() => {
    const roots: PostComment[] = [];
    const replies = new Map<string, PostComment[]>();
    for (const c of comments) {
      const rootId = rootIdOf(c);
      if (rootId === c.id) {
        roots.push(c);
      } else {
        const list = replies.get(rootId) ?? [];
        list.push(c);
        replies.set(rootId, list);
      }
    }
    for (const list of replies.values()) {
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    return { rootComments: roots, repliesByRoot: replies };
  }, [comments, rootIdOf]);

  /** O comentário e todas as respostas abaixo dele (o banco apaga em cascata). */
  const collectWithDescendants = React.useCallback(
    (commentId: string): Set<string> => {
      const ids = new Set([commentId]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const c of comments) {
          if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
            ids.add(c.id);
            grew = true;
          }
        }
      }
      return ids;
    },
    [comments],
  );

  const handleStartReply = React.useCallback((comment: PostComment) => {
    hapticLight();
    setEditingId(null);
    setEditDraft("");
    setReplyTarget(comment);
    // Foco no mesmo toque: o iOS só abre o teclado com foco síncrono ao gesto.
    inputRef.current?.focus();
  }, []);

  React.useEffect(() => {
    if (!open) return;

    setLoading(true);

    if (isPostOwner && hasUnreadComments) {
      markPostCommentsAsReadDb(postId).catch((err) =>
        console.error("Error marking comments as read:", err),
      );
    }

    getPostCommentsDb(postId)
      .then((data) => {
        hasLoadedCommentsRef.current = true;
        setComments(data);
      })
      .catch((err) => {
        console.error("Error loading comments:", err);
        toast({
          title: t("comments_load_error"),
          description: t("retry"),
        });
      })
      .finally(() => setLoading(false));
  }, [open, postId, isPostOwner, hasUnreadComments]);

  // Load current user avatar once when drawer opens
  React.useEffect(() => {
    if (!open || !user) return;
    getUserProfileDb(user.id)
      .then((profile) => setCurrentUserPhoto(profile?.photo ?? null))
      .catch(() => {});
  }, [open, user?.id]);

  const handleSubmit = React.useCallback(async () => {
    if (!draft.trim()) {
      toast({
        title: t("comments_empty_input"),
        description: t("comments_empty_input_desc"),
      });
      return;
    }

    if (!user) {
      toast({
        title: t("comments_login_required"),
        description: t("comments_login_desc"),
      });
      return;
    }

    // Guideline 1.2(a): filtrar conteúdo censurável ANTES de publicar.
    if (hasObjectionableContent(draft)) {
      toast({
        title: t("content_filter_title"),
        description: t("content_filter_desc"),
        variant: "destructive",
      });
      return;
    }

    try {
      const active = document.activeElement as HTMLElement | null;
      if (active && (active.tagName === "TEXTAREA" || active.tagName === "INPUT")) {
        active.blur();
      }
      setSubmitting(true);
      const commentText = draft.trim();
      const target = replyTarget;
      await addPostCommentDb(postId, commentText, target?.id ?? null);
      setDraft("");
      setReplyTarget(null);

      const profile = await getUserProfileDb(user.id);
      const optimisticComment: PostComment = {
        id: `optimistic-${Date.now()}`,
        postId,
        userId: user.id,
        userName: profile?.nickname || t("comments_you"),
        userHandle: profile?.handle || "",
        userPhoto: profile?.photo || null,
        text: commentText,
        createdAt: new Date().toISOString(),
        isVerified: profile?.is_verified || false,
        verifiedTier: profile?.verified_tier ?? null,
        parentId: target?.id ?? null,
      };
      // Resposta: abre a conversa inteira e rola até ela (a raiz não muda de id
      // quando a lista recarrega). Comentário comum: topo, onde ele entra.
      const threadRootId = target ? rootIdOf(target) : null;
      if (threadRootId) {
        setExpandedThreads((prev) => new Set(prev).add(threadRootId));
      }
      const revealNew = () =>
        requestAnimationFrame(() => {
          const list = commentsListRef.current;
          if (!list) return;
          if (!threadRootId) {
            list.scrollTop = 0;
            return;
          }
          list
            .querySelector(`[data-thread-id="${threadRootId}"]`)
            ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        });
      setComments((prev) => [optimisticComment, ...prev]);
      revealNew();

      getPostCommentsDb(postId).then((data) => {
        setComments(data);
        revealNew();
      }).catch(() => {});

      toast(
        target
          ? {
              title: t("comments_reply_sent"),
              description: t("comments_reply_sent_desc").replace("{name}", target.userName),
            }
          : {
              title: t("comments_sent"),
              description: t("comments_sent_desc"),
            },
      );
    } catch (err: any) {
      console.error("Error submitting comment:", err);
      toast({
        title: t("comments_send_error"),
        description: err?.message || t("retry"),
      });
    } finally {
      setSubmitting(false);
    }
  }, [draft, postId, user, t, replyTarget, rootIdOf]);

  const handleStartEdit = React.useCallback((comment: PostComment) => {
    setEditingId(comment.id);
    setEditDraft(comment.text);
  }, []);

  const handleCancelEdit = React.useCallback(() => {
    setEditingId(null);
    setEditDraft("");
  }, []);

  const handleSaveEdit = React.useCallback(async (commentId: string) => {
    if (!editDraft.trim()) return;
    try {
      setSavingEditId(commentId);
      await updatePostCommentDb(commentId, editDraft);
      setComments((prev) => {
        const updated = prev.map((c) =>
          c.id === commentId ? { ...c, text: editDraft.trim() } : c,
        );
        const idx = updated.findIndex((c) => c.id === commentId);
        if (idx > 0) {
          const [item] = updated.splice(idx, 1);
          updated.unshift(item);
        }
        return [...updated];
      });
      setEditingId(null);
      setEditDraft("");
      toast({ title: t("comments_edited") });
    } catch (err: any) {
      console.error("Error editing comment:", err);
      toast({ title: t("comments_edit_error"), description: err?.message || t("retry") });
    } finally {
      setSavingEditId(null);
    }
  }, [editDraft, t]);

  const handleDelete = React.useCallback((commentId: string) => {
    setDeletingCommentId(commentId);
    setDeleteCommentDialogOpen(true);
  }, []);

  const handleConfirmDelete = React.useCallback(async () => {
    if (!deletingCommentId) return;
    setIsDeletingComment(true);
    try {
      await deletePostCommentDb(deletingCommentId);
      const removed = collectWithDescendants(deletingCommentId);
      setComments((prev) => prev.filter((c) => !removed.has(c.id)));
      setReplyTarget((prev) => (prev && removed.has(prev.id) ? null : prev));
      toast({ title: t("comments_deleted") });
    } catch (err: any) {
      console.error("Error deleting comment:", err);
      toast({
        title: t("comments_delete_error"),
        description: err?.message || t("retry"),
      });
    } finally {
      setIsDeletingComment(false);
      setDeleteCommentDialogOpen(false);
      setDeletingCommentId(null);
    }
  }, [deletingCommentId, t, collectWithDescendants]);

  // Três estados do ícone, do mais forte para o mais fraco:
  //  1. dono com comentário NÃO LIDO → azul, preenchido;
  //  2. post com comentários → preenchido em branco — sem isto não havia como
  //     saber se o post tinha comentários sem abrir o drawer;
  //  3. sem comentários → contorno apagado.
  // SEM o número ao lado (29/09/2026): a contagem alargava o botão e deixava os
  // ícones da barra colados — o toque caía no ícone vizinho. O preenchimento já
  // sinaliza "tem comentários"; a contagem segue no aria-label.
  const hasComments = commentCount > 0;
  const unread = isPostOwner && hasUnreadComments;
  const triggerIcon = (
    <>
      <MessageCircle
        className={cn(
          "h-5 w-5 transition-colors",
          unread ? "text-blue-500" : hasComments ? "text-white" : "text-muted-foreground",
        )}
        fill={unread || hasComments ? "currentColor" : "none"}
        fillOpacity={unread ? 0.9 : hasComments ? 0.85 : 0}
      />
    </>
  );
  const triggerLabel = hasComments
    ? `${t("comments_view_label")} (${commentCount})`
    : t("comments_view_label");

  const triggerButton = (
    <motion.button
      type="button"
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      className="inline-flex shrink-0 items-center justify-center transition-colors"
      aria-label={triggerLabel}
    >
      {triggerIcon}
    </motion.button>
  );

  // Uma linha de comentário. Respostas usam avatar menor e dizem a quem
  // respondem; o comentário em resposta fica destacado na lista.
  const renderComment = (comment: PostComment, isReply: boolean) => {
    const parent = isReply && comment.parentId ? commentById.get(comment.parentId) ?? null : null;
    const isReplyTarget = replyTarget?.id === comment.id;
    return (
      <div
        key={comment.id}
        className="-mx-2 flex gap-[11px] rounded-2xl px-2 py-1.5 transition-colors"
        style={
          isReplyTarget
            ? { background: "rgba(91,140,255,.12)", boxShadow: "inset 0 0 0 1px rgba(91,140,255,.35)" }
            : undefined
        }
      >
        {/* Avatar — abre o perfil de quem comentou */}
        <button
          type="button"
          onClick={() => handleAuthorClick(comment.userId)}
          className="flex-shrink-0 mt-0.5 self-start rounded-full active:opacity-70 transition-opacity"
          aria-label={t("comments_open_profile").replace("{name}", comment.userName)}
        >
          <UserAvatar
            photo={comment.userPhoto}
            nickname={comment.userName}
            size="sm"
            className={isReply ? "h-6 w-6" : undefined}
          />
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Name + time */}
          <div className="text-[13.5px]" style={{ color: "rgba(255,255,255,.95)" }}>
            <button
              type="button"
              onClick={() => handleAuthorClick(comment.userId)}
              className="font-semibold active:opacity-70 transition-opacity"
              style={{ color: "#fff" }}
            >
              {comment.userName}
            </button>
            {comment.isVerified && (
              <VerifiedBadge size="sm" tier={comment.verifiedTier} className="ml-1 align-[-2px]" />
            )}
            {" "}
            <span style={{ color: "rgba(255,255,255,.4)", fontSize: "11.5px" }}>
              · {formatRelativeTime(comment.createdAt, t("comments_time_now"))}
            </span>
            {/* Comentário otimista ainda não tem id do banco — sem "Responder" até recarregar. */}
            {user && editingId !== comment.id && !comment.id.startsWith("optimistic-") && (
              <>
                <span style={{ color: "rgba(255,255,255,.4)", fontSize: "11.5px" }}> · </span>
                <button
                  type="button"
                  onClick={() => handleStartReply(comment)}
                  className="font-semibold active:opacity-70 transition-opacity"
                  style={{ color: isReplyTarget ? "#8fb0ff" : "rgba(255,255,255,.6)", fontSize: "11.5px" }}
                  aria-label={t("comments_reply_label").replace("{name}", comment.userName)}
                >
                  {t("comments_reply")}
                </button>
              </>
            )}
          </div>

          {/* Resposta: quem foi respondido, explícito (inclusive resposta a resposta). */}
          {parent && (
            <div
              className="mt-0.5 flex items-center gap-1 text-[11.5px]"
              style={{ color: "rgba(255,255,255,.45)" }}
            >
              <CornerDownRight className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {t("comments_in_reply_to").replace("{name}", parent.userName)}
              </span>
            </div>
          )}

          {/* Text or edit form */}
          {editingId === comment.id ? (
            <div className="mt-1 flex flex-col gap-1.5">
              <div className="relative">
              <textarea
                ref={editTextareaRef}
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                className="w-full rounded-2xl px-3 py-2 text-sm resize-none"
                style={{
                  background: "rgba(255,255,255,.07)",
                  border: "1px solid rgba(255,255,255,.12)",
                  color: "#fff",
                  minHeight: "64px",
                  outline: "none",
                }}
                disabled={savingEditId === comment.id}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && editDraft.trim()) {
                    e.preventDefault();
                    handleSaveEdit(comment.id);
                  }
                  if (e.key === "Escape") handleCancelEdit();
                }}
              />
              {/* "@" na edição → sugestões logo abaixo do campo. Editar não
                  renotifica (o trigger do type 20 é só no INSERT). */}
              <MentionSuggestions
                inputRef={editTextareaRef}
                value={editDraft}
                onChange={setEditDraft}
                placement="below"
              />
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSaveEdit(comment.id)}
                  disabled={!editDraft.trim() || savingEditId === comment.id}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium disabled:opacity-50 transition-colors"
                  style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
                >
                  <Check className="h-3 w-3" />
                  {t("comments_edit_save")}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={savingEditId === comment.id}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium disabled:opacity-50 transition-colors"
                  style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.7)" }}
                >
                  <X className="h-3 w-3" />
                  {t("comments_edit_cancel")}
                </button>
              </div>
            </div>
          ) : (
            <p
              className="break-words"
              style={{ margin: "3px 0 7px", fontSize: "13.5px", lineHeight: "1.45", color: "rgba(255,255,255,.82)" }}
            >
              {renderWithMentions(comment.text, handleMentionClick)}
            </p>
          )}

          <CommentReactions
            commentType="post"
            commentId={comment.id}
            commentOwnerId={comment.userId}
            sourceId={postId}
            isOwnComment={!!(user && user.id === comment.userId)}
          />
        </div>

        {/* Edit/Delete for own comments */}
        {user && user.id === comment.userId && editingId !== comment.id && (
          <div className="flex gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => handleStartEdit(comment)}
              className="rounded-lg p-1.5 transition-colors active:opacity-70"
              style={{ color: "rgba(255,255,255,.4)" }}
              aria-label={t("comments_edit_label")}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleDelete(comment.id)}
              disabled={isDeletingComment && deletingCommentId === comment.id}
              className="rounded-lg p-1.5 transition-colors active:opacity-70 disabled:opacity-50"
              style={{ color: "rgba(255,255,255,.4)" }}
              aria-label={t("comments_delete_label")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Denunciar/bloquear o autor de um comentário alheio. */}
        {user && user.id !== comment.userId && (
          <div className="flex shrink-0">
            <button
              type="button"
              onClick={() =>
                setSafetyTarget({ userId: comment.userId, userName: comment.userName })
              }
              className="rounded-lg p-1.5 transition-colors active:opacity-70"
              style={{ color: "rgba(255,255,255,.4)" }}
              aria-label={t("user_safety_title")}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  };

  // Comentário raiz + respostas recuadas. Até 2 respostas à mostra; o resto
  // abre em "Ver mais N respostas" (a conversa em que você respondeu já abre).
  const VISIBLE_REPLIES = 2;
  const renderThread = (root: PostComment) => {
    const replies = repliesByRoot.get(root.id) ?? [];
    const expanded = expandedThreads.has(root.id);
    const hasHiddenTarget =
      !!replyTarget && replies.slice(VISIBLE_REPLIES).some((r) => r.id === replyTarget.id);
    const shown = expanded || hasHiddenTarget ? replies : replies.slice(0, VISIBLE_REPLIES);
    const hiddenCount = replies.length - shown.length;
    return (
      <div key={root.id} data-thread-id={root.id} className="flex flex-col gap-2">
        {renderComment(root, false)}
        {replies.length > 0 && (
          <div className="ml-[43px] flex flex-col gap-2">
            {shown.map((reply) => renderComment(reply, true))}
            {hiddenCount > 0 ? (
              <button
                type="button"
                onClick={() => setExpandedThreads((prev) => new Set(prev).add(root.id))}
                className="self-start flex items-center gap-2 py-1 text-[12px] font-semibold active:opacity-70"
                style={{ color: "rgba(255,255,255,.55)" }}
              >
                <span className="h-px w-6" style={{ background: "rgba(255,255,255,.25)" }} />
                {hiddenCount === 1
                  ? t("comments_view_replies_one")
                  : t("comments_view_replies_many").replace("{n}", String(hiddenCount))}
              </button>
            ) : expanded && replies.length > VISIBLE_REPLIES ? (
              <button
                type="button"
                onClick={() =>
                  setExpandedThreads((prev) => {
                    const next = new Set(prev);
                    next.delete(root.id);
                    return next;
                  })
                }
                className="self-start flex items-center gap-2 py-1 text-[12px] font-semibold active:opacity-70"
                style={{ color: "rgba(255,255,255,.55)" }}
              >
                <span className="h-px w-6" style={{ background: "rgba(255,255,255,.25)" }} />
                {t("comments_hide_replies")}
              </button>
            ) : null}
          </div>
        )}
      </div>
    );
  };

  const drawerContent = (
    <DrawerContent
      handleClassName="mt-[10px] h-1 w-[38px] bg-white/25"
      className="flex flex-col !rounded-t-[32px] !border-0"
      style={{
        height: `min(60dvh, ${viewportHeight - 8}px)`,
        maxHeight: `min(60dvh, ${viewportHeight - 8}px)`,
        background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
        backdropFilter: "blur(40px) saturate(180%)",
        WebkitBackdropFilter: "blur(40px) saturate(180%)",
        borderTop: "1px solid rgba(255,255,255,.14)",
      }}
      onOpenAutoFocus={(e) => e.preventDefault()}
    >
      <DrawerDescription className="sr-only">{t("comments_list_desc")}</DrawerDescription>

      {/* Title */}
      <DrawerTitle
        className="flex-shrink-0 px-[18px] pb-[14px] text-[18px] leading-none"
        style={{ fontWeight: 740, color: "#fff" }}
      >
        {t("comments_title")} · {commentCount}
      </DrawerTitle>

      {/* Comments list */}
      <div
        ref={commentsListRef}
        className="flex-1 overflow-y-auto px-[18px] pb-3"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          justifyContent: loading || !comments.length ? "center" : "flex-start",
        }}
      >
        {loading ? (
          <div className="text-sm py-6 text-center" style={{ color: "rgba(255,255,255,.5)" }}>
            {t("comments_loading")}
          </div>
        ) : comments.length ? (
          rootComments.map(renderThread)
        ) : (
          <div className="py-6 text-center text-sm" style={{ color: "rgba(255,255,255,.5)" }}>
            {t("comments_empty")}
          </div>
        )}
      </div>

      {/* Respondendo a um comentário: diz para quem vai e mostra um trecho
          dele, com X para voltar a comentar no post. */}
      {user && replyTarget && (
        <div
          className="flex-shrink-0 flex items-center gap-2.5 px-[16px] py-2"
          style={{
            borderTop: "1px solid rgba(255,255,255,.08)",
            background: "rgba(91,140,255,.08)",
          }}
        >
          <CornerDownRight className="h-4 w-4 shrink-0" style={{ color: "#8fb0ff" }} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-semibold" style={{ color: "#fff" }}>
              {t("comments_replying_to").replace("{name}", replyTarget.userName)}
            </div>
            <div className="truncate text-[12px]" style={{ color: "rgba(255,255,255,.55)" }}>
              {replyTarget.text}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReplyTarget(null)}
            className="shrink-0 flex items-center justify-center rounded-full active:opacity-70"
            style={{ width: 28, height: 28, background: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.8)" }}
            aria-label={t("comments_reply_cancel")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Input bar */}
      <div
        className="relative flex-shrink-0 flex items-center gap-[10px] px-[16px]"
        style={{
          paddingTop: "12px",
          paddingBottom: "max(28px, env(safe-area-inset-bottom))",
          borderTop: user && replyTarget ? "none" : "1px solid rgba(255,255,255,.08)",
        }}
      >
        {/* User avatar */}
        <UserAvatar
          photo={currentUserPhoto}
          nickname={user?.email}
          size="sm"
          className="flex-shrink-0"
        />

        {/* Input field */}
        {user ? (
          <input
            ref={inputRef}
            type="text"
            placeholder={
              replyTarget
                ? t("comments_reply_placeholder").replace("{name}", replyTarget.userName)
                : t("comments_placeholder")
            }
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !submitting && draft.trim()) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            disabled={submitting}
            className="flex-1 text-[13.5px] outline-none bg-transparent"
            style={{
              height: "42px",
              borderRadius: "21px",
              padding: "0 16px",
              background: "rgba(255,255,255,.07)",
              border: "1px solid rgba(255,255,255,.12)",
              color: "rgba(255,255,255,.95)",
            }}
          />
        ) : (
          <div
            className="flex-1 flex items-center px-[16px] text-[13.5px]"
            style={{
              height: "42px",
              borderRadius: "21px",
              background: "rgba(255,255,255,.07)",
              border: "1px solid rgba(255,255,255,.12)",
              color: "rgba(255,255,255,.45)",
            }}
          >
            {t("comments_login_view")}
          </div>
        )}

        {/* "@" no comentário → sugestões acima da barra (a notificação de
            menção sai do trigger do banco, type 20) */}
        {user && (
          <MentionSuggestions
            inputRef={inputRef}
            value={draft}
            onChange={setDraft}
            className="mx-4"
          />
        )}

        {/* Send button */}
        {user && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!draft.trim() || submitting}
            className="flex-shrink-0 flex items-center justify-center transition-all active:scale-90 disabled:opacity-40"
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "linear-gradient(135deg,#5b8cff,#9d6bff)",
              color: "#fff",
              boxShadow: "0 6px 18px -6px rgba(91,140,255,.5)",
            }}
            aria-label={t("comments_submit")}
          >
            <Send className="h-[17px] w-[17px]" />
          </button>
        )}
      </div>
    </DrawerContent>
  );

  const deleteCommentDialog = (
    <AlertDialog open={deleteCommentDialogOpen} onOpenChange={setDeleteCommentDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("comments_delete_title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {deletingCommentId && comments.some((c) => c.parentId === deletingCommentId)
              ? t("comments_delete_desc_with_replies")
              : t("comments_delete_desc")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeletingComment}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmDelete}
            disabled={isDeletingComment}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            {isDeletingComment ? t("comments_deleting") : t("delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  // Irmão do drawer de comentários, não filho — mesmo padrão do
  // `deleteCommentDialog` acima. Bloquear recarrega a lista: os comentários do
  // bloqueado somem pelo filtro de `user_blocks` no servidor.
  const commentSafetyDrawer = (
    <UserSafetyDrawer
      open={!!safetyTarget}
      onOpenChange={(next) => { if (!next) setSafetyTarget(null); }}
      userId={safetyTarget?.userId ?? null}
      userName={safetyTarget?.userName ?? ""}
      onBlocked={() => {
        setSafetyTarget(null);
        setReplyTarget(null);
        getPostCommentsDb(postId).then(setComments).catch(() => {});
      }}
    />
  );

  if (defaultOpen) {
    return (
      <>
        <button
          type="button"
          onClick={() => handleOpenChange(true)}
          className="inline-flex shrink-0 items-center justify-center transition-colors"
          aria-label={triggerLabel}
        >
          {triggerIcon}
        </button>
        <Drawer open={open} onOpenChange={handleOpenChange} noBodyStyles shouldScaleBackground={false}>
          {drawerContent}
        </Drawer>
        {deleteCommentDialog}
        {commentSafetyDrawer}
      </>
    );
  }

  return (
    <>
      <Drawer open={open} onOpenChange={handleOpenChange} noBodyStyles shouldScaleBackground={false}>
        <DrawerTrigger asChild>
          {triggerButton}
        </DrawerTrigger>
        {drawerContent}
      </Drawer>
      {deleteCommentDialog}
      {commentSafetyDrawer}
    </>
  );
}
