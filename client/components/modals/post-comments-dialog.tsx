import * as React from "react";
import { Trash2, Pencil, Check, X, Send } from "lucide-react";
import { CommentReactions } from "@/components/shared/comment-reactions";
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
import { UserAvatar } from "@/components/shared/user-avatar";
import { VerifiedBadge } from "@/components/shared/VerifiedBadge";
import { useLanguage } from "@/lib/language-context";
import { useKeyboardAwareHeight } from "@/hooks/use-keyboard-aware-height";
import { MessageCircle } from "lucide-react";
import { motion } from "framer-motion";

// Module-level flag: survives StrictMode remount cycles, resets when postId changes
let _commentsAutoOpenConsumed = false;
let _commentsAutoOpenPostId = "";

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
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
}: {
  postId: string;
  commentCount: number;
  hasActivity?: boolean;
  isPostOwner?: boolean;
  hasUnreadComments?: boolean;
  defaultOpen?: boolean;
}) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [open, setOpen] = React.useState(false);
  const viewportHeight = useKeyboardAwareHeight();
  const savedScrollY = React.useRef(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

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
  const [loading, setLoading] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const commentsListRef = React.useRef<HTMLDivElement>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [deleteCommentDialogOpen, setDeleteCommentDialogOpen] = React.useState(false);
  const [deletingCommentId, setDeletingCommentId] = React.useState<string | null>(null);
  const [isDeletingComment, setIsDeletingComment] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState("");
  const [savingEditId, setSavingEditId] = React.useState<string | null>(null);
  const [currentUserPhoto, setCurrentUserPhoto] = React.useState<string | null>(null);

  // Fix for iOS WebView (Capacitor): vaul can leave scroll-lock attributes/styles stuck
  React.useEffect(() => {
    if (!open) {
      document.body.removeAttribute("data-scroll-locked");
      document.body.style.overflow = "";
      document.body.style.pointerEvents = "";
      setDraft("");
      setEditingId(null);
      setEditDraft("");
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;

    setLoading(true);

    if (isPostOwner && hasUnreadComments) {
      markPostCommentsAsReadDb(postId).catch((err) =>
        console.error("Error marking comments as read:", err),
      );
    }

    getPostCommentsDb(postId)
      .then((data) => setComments(data))
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

    try {
      const active = document.activeElement as HTMLElement | null;
      if (active && (active.tagName === "TEXTAREA" || active.tagName === "INPUT")) {
        active.blur();
      }
      setSubmitting(true);
      const commentText = draft.trim();
      await addPostCommentDb(postId, commentText);
      setDraft("");

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
      };
      setComments((prev) => [optimisticComment, ...prev]);
      requestAnimationFrame(() => {
        if (commentsListRef.current) commentsListRef.current.scrollTop = 0;
      });

      getPostCommentsDb(postId).then((data) => {
        setComments(data);
        requestAnimationFrame(() => {
          if (commentsListRef.current) commentsListRef.current.scrollTop = 0;
        });
      }).catch(() => {});

      toast({
        title: t("comments_sent"),
        description: t("comments_sent_desc"),
      });
    } catch (err: any) {
      console.error("Error submitting comment:", err);
      toast({
        title: t("comments_send_error"),
        description: err?.message || t("retry"),
      });
    } finally {
      setSubmitting(false);
    }
  }, [draft, postId, user, t]);

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
      setComments((prev) => prev.filter((c) => c.id !== deletingCommentId));
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
  }, [deletingCommentId, t]);

  const triggerButton = (
    <motion.button
      type="button"
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center transition-colors",
        isPostOwner && hasUnreadComments && "text-blue-500",
      )}
      aria-label={t("comments_view_label")}
    >
      <MessageCircle
        className={cn(
          "h-5 w-5 transition-colors",
          isPostOwner && hasUnreadComments
            ? "text-blue-500"
            : "text-muted-foreground",
        )}
      />
    </motion.button>
  );

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
          gap: "18px",
          justifyContent: loading || !comments.length ? "center" : "flex-start",
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="text-sm py-6 text-center" style={{ color: "rgba(255,255,255,.5)" }}>
            {t("comments_loading")}
          </div>
        ) : comments.length ? (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-[11px]">
              {/* Avatar */}
              <UserAvatar
                photo={comment.userPhoto}
                nickname={comment.userName}
                size="sm"
                className="flex-shrink-0 mt-0.5"
              />

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Name + time */}
                <div className="text-[13.5px]" style={{ color: "rgba(255,255,255,.95)" }}>
                  <span className="font-semibold" style={{ color: "#fff" }}>
                    {comment.userName}
                  </span>
                  {comment.isVerified && <VerifiedBadge size="sm" />}
                  {" "}
                  <span style={{ color: "rgba(255,255,255,.4)", fontSize: "11.5px" }}>
                    · {formatRelativeTime(comment.createdAt)}
                  </span>
                </div>

                {/* Text or edit form */}
                {editingId === comment.id ? (
                  <div className="mt-1 flex flex-col gap-1.5">
                    <textarea
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
                    {comment.text}
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
            </div>
          ))
        ) : (
          <div className="py-6 text-center text-sm" style={{ color: "rgba(255,255,255,.5)" }}>
            {t("comments_empty")}
          </div>
        )}
      </div>

      {/* Input bar */}
      <div
        className="flex-shrink-0 flex items-center gap-[10px] px-[16px]"
        style={{
          paddingTop: "12px",
          paddingBottom: "max(28px, env(safe-area-inset-bottom))",
          borderTop: "1px solid rgba(255,255,255,.08)",
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
            placeholder={t("comments_placeholder")}
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
            {t("comments_delete_desc")}
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

  if (defaultOpen) {
    return (
      <>
        <button
          type="button"
          onClick={() => handleOpenChange(true)}
          className={cn(
            "inline-flex shrink-0 items-center justify-center transition-colors",
            isPostOwner && hasUnreadComments && "text-blue-500",
          )}
          aria-label={t("comments_view_label")}
        >
          <MessageCircle
            className={cn(
              "h-5 w-5 transition-colors",
              isPostOwner && hasUnreadComments
                ? "text-blue-500"
                : "text-muted-foreground",
            )}
          />
        </button>
        <Drawer open={open} onOpenChange={handleOpenChange} noBodyStyles shouldScaleBackground={false}>
          {drawerContent}
        </Drawer>
        {deleteCommentDialog}
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
    </>
  );
}
