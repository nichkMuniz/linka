import * as React from "react";
import { MessageCircle, Trash2, Pencil, Check, X } from "lucide-react";
import { EmojiPicker } from "@/components/shared/emoji-picker";
import { CommentReactions } from "@/components/shared/comment-reactions";
import { motion } from "framer-motion";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  getPostCommentsDb,
  addPostCommentDb,
  deletePostCommentDb,
  updatePostCommentDb,
  markPostCommentsAsReadDb,
  type PostComment,
} from "@/lib/ritmofit-db";
import { useAuth } from "@/hooks/useAuth";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useLanguage } from "@/lib/language-context";

// Module-level flag: survives StrictMode remount cycles, resets when postId changes
let _commentsAutoOpenConsumed = false;
let _commentsAutoOpenPostId = "";

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

  // Open automatically once when defaultOpen=true (e.g. navigated from notification)
  // Module-level flag survives StrictMode remounts; resets on different postId
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
  const [submitting, setSubmitting] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState("");
  const [savingEditId, setSavingEditId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;

    setLoading(true);

    // Mark comments as read if user is the post owner
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
      setSubmitting(true);
      await addPostCommentDb(postId, draft);

      setDraft("");

      // Refresh comments
      const updated = await getPostCommentsDb(postId);
      setComments(updated);

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
  }, [draft, postId, user]);

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
      setComments((prev) =>
        prev.map((c) => c.id === commentId ? { ...c, text: editDraft.trim() } : c)
      );
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

  const handleDelete = React.useCallback(async (commentId: string) => {
    if (!confirm(t("comments_delete_confirm"))) return;

    try {
      setDeletingId(commentId);
      await deletePostCommentDb(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      toast({
        title: t("comments_deleted"),
      });
    } catch (err: any) {
      console.error("Error deleting comment:", err);
      toast({
        title: t("comments_delete_error"),
        description: err?.message || t("retry"),
      });
    } finally {
      setDeletingId(null);
    }
  }, []);

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
    <DrawerContent className="max-h-[80dvh] flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
      <DrawerHeader className="shrink-0">
        <DrawerTitle>{t("comments_title")}</DrawerTitle>
        <DrawerDescription className="sr-only">{t("comments_list_desc")}</DrawerDescription>
      </DrawerHeader>

      <div className="flex flex-col flex-1 gap-4 overflow-hidden px-4 pb-4">
        {/* Comments list */}
        <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border border-border/50 bg-muted/20 p-3">
          {loading ? (
            <div className="text-sm text-muted-foreground">
              {t("comments_loading")}
            </div>
          ) : comments.length ? (
            comments.map((comment) => (
              <motion.div
                key={comment.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-border/30 bg-background/50 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <UserAvatar
                      photo={comment.userPhoto}
                      gender={comment.userGender}
                      nickname={comment.userName}
                      size="sm"
                    />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-xs font-medium">
                        {comment.userName}{comment.userHandle ? <span className="font-normal text-muted-foreground"> | @{comment.userHandle.replace(/^@/, "")}</span> : null}
                      </div>
                    </div>
                    {editingId === comment.id ? (
                      <div className="mt-1 flex flex-col gap-1.5">
                        <Textarea
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          className="min-h-16 resize-none text-sm"
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
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <Check className="h-3 w-3" />
                            {t("comments_edit_save")}
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            disabled={savingEditId === comment.id}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50 transition-colors"
                          >
                            <X className="h-3 w-3" />
                            {t("comments_edit_cancel")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm leading-relaxed break-words">
                        {comment.text}
                      </p>
                    )}
                    <div className="mt-1 text-xs text-muted-foreground">
                      {new Date(comment.createdAt).toLocaleString("pt-BR")}
                    </div>
                    <CommentReactions commentType="post" commentId={comment.id} commentOwnerId={comment.userId} sourceId={postId} isOwnComment={!!(user && user.id === comment.userId)} />
                  </div>
                  </div>

                  {user && user.id === comment.userId && editingId !== comment.id && (
                    <div className="flex shrink-0 gap-0.5">
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleStartEdit(comment)}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label={t("comments_edit_label")}
                      >
                        <Pencil className="h-4 w-4" />
                      </motion.button>
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleDelete(comment.id)}
                        disabled={deletingId === comment.id}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={t("comments_delete_label")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </motion.button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          ) : (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {t("comments_empty")}
            </div>
          )}
        </div>

        {/* Comment input */}
        {user ? (
          <div className="space-y-2 shrink-0">
            <div className="relative">
              <Textarea
                placeholder={t("comments_placeholder")}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !submitting && draft.trim()) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                className="min-h-20 resize-none pr-10"
                disabled={submitting}
              />
              <div className="absolute bottom-2 right-2">
                <EmojiPicker
                  placement="top"
                  onSelect={(emoji) => setDraft((prev) => prev + emoji)}
                />
              </div>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={!draft.trim() || submitting}
              className="w-full rounded-lg"
            >
              {submitting ? t("comments_submitting") : t("comments_submit")}
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-border/50 bg-muted/20 p-3 text-center text-sm text-muted-foreground shrink-0">
            {t("comments_login_view")}
          </div>
        )}
      </div>
    </DrawerContent>
  );

  // When defaultOpen=true (opened from notification), render the trigger button separately
  // from the Drawer to prevent vaul from firing the open event twice (controlled state +
  // DrawerTrigger internal click handler both firing on mount).
  if (defaultOpen) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
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
        <Drawer open={open} onOpenChange={setOpen} noBodyStyles shouldScaleBackground={false}>
          {drawerContent}
        </Drawer>
      </>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen} noBodyStyles shouldScaleBackground={false}>
      <DrawerTrigger asChild>
        {triggerButton}
      </DrawerTrigger>
      {drawerContent}
    </Drawer>
  );
}
