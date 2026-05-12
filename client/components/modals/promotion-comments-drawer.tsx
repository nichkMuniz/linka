import * as React from "react";
import { MessageCircle, Trash2, Pencil, Check, X } from "lucide-react";
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
import {
  getPromotionCommentsDb,
  addPromotionCommentDb,
  deletePromotionCommentDb,
  updatePromotionCommentDb,
  type PromotionComment,
} from "@/lib/ritmofit-db";
import { useAuth } from "@/hooks/useAuth";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useKeyboardAwareHeight } from "@/hooks/use-keyboard-aware-height";

export function PromotionCommentsDrawer({
  promotionId,
  commentsCount,
}: {
  promotionId: string;
  commentsCount: number;
}) {
  const { user } = useAuth();
  const [open, setOpen] = React.useState(false);
  const viewportHeight = useKeyboardAwareHeight();
  const [comments, setComments] = React.useState<PromotionComment[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState("");
  const [savingEditId, setSavingEditId] = React.useState<string | null>(null);

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
    getPromotionCommentsDb(promotionId)
      .then((data) => setComments(data))
      .catch((err) => {
        console.error("Error loading promotion comments:", err);
        toast({ title: "Erro ao carregar comentários", description: "Tente novamente." });
      })
      .finally(() => setLoading(false));
  }, [open, promotionId]);

  const handleSubmit = React.useCallback(async () => {
    if (!draft.trim()) {
      toast({ title: "Comentário vazio", description: "Escreva algo antes de enviar." });
      return;
    }
    if (!user) {
      toast({ title: "Entre para comentar", description: "Você precisa estar logado." });
      return;
    }
    try {
      setSubmitting(true);
      await addPromotionCommentDb(promotionId, draft);
      setDraft("");
      const updated = await getPromotionCommentsDb(promotionId);
      setComments(updated);
      toast({ title: "Comentário enviado!" });
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err?.message || "Tente novamente." });
    } finally {
      setSubmitting(false);
    }
  }, [draft, promotionId, user]);

  const handleStartEdit = React.useCallback((comment: PromotionComment) => {
    setEditingId(comment.id);
    setEditDraft(comment.text);
  }, []);

  const handleCancelEdit = React.useCallback(() => {
    setEditingId(null);
    setEditDraft("");
  }, []);

  const handleSaveEdit = React.useCallback(
    async (commentId: string) => {
      if (!editDraft.trim()) return;
      try {
        setSavingEditId(commentId);
        await updatePromotionCommentDb(commentId, editDraft);
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? { ...c, text: editDraft.trim() } : c)),
        );
        setEditingId(null);
        setEditDraft("");
        toast({ title: "Comentário editado." });
      } catch (err: any) {
        toast({ title: "Erro ao editar", description: err?.message || "Tente novamente." });
      } finally {
        setSavingEditId(null);
      }
    },
    [editDraft],
  );

  const handleDelete = React.useCallback(async (commentId: string) => {
    if (!confirm("Excluir este comentário?")) return;
    try {
      setDeletingId(commentId);
      await deletePromotionCommentDb(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      toast({ title: "Comentário excluído." });
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err?.message || "Tente novamente." });
    } finally {
      setDeletingId(null);
    }
  }, []);

  const triggerButton = (
    <motion.button
      type="button"
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      className="flex items-center gap-1 px-1.5 py-1 text-xs text-muted-foreground hover:text-brand transition-colors"
      aria-label="Ver comentários da promoção"
    >
      <MessageCircle className="h-3.5 w-3.5" />
      {commentsCount > 0 && <span>{commentsCount}</span>}
    </motion.button>
  );

  return (
    <Drawer open={open} onOpenChange={setOpen} noBodyStyles shouldScaleBackground={false}>
      <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>
      <DrawerContent
        className="flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
        style={{ maxHeight: `min(85dvh, ${viewportHeight - 8}px)`, paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <DrawerHeader className="shrink-0 pb-2">
          <DrawerTitle className="text-base">Comentários da promoção</DrawerTitle>
          <DrawerDescription className="text-xs text-muted-foreground">
            Compartilhe sua opinião — a promoção vale? Expirou? Já aproveite e ajude a comunidade!
          </DrawerDescription>
        </DrawerHeader>

        {/* stopPropagation prevents vaul from starting a drag gesture when tapping inside the content */}
        <div className="flex flex-col flex-1 gap-3 overflow-hidden px-4 pb-4" onPointerDown={(e) => e.stopPropagation()}>
          {/* Comments list */}
          <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border border-border/50 bg-muted/20 p-3">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-lg border border-border/30 bg-background/50 p-3 space-y-2">
                    <div className="h-3 w-1/3 rounded bg-muted animate-pulse" />
                    <div className="h-2 w-full rounded bg-muted animate-pulse" />
                    <div className="h-2 w-4/5 rounded bg-muted animate-pulse" />
                  </div>
                ))}
              </div>
            ) : comments.length > 0 ? (
              comments.map((comment) => (
                <motion.div
                  key={comment.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border border-border/30 bg-background/50 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <UserAvatar
                        photo={comment.userPhoto}
                        nickname={comment.userName}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium">
                          {comment.userName}
                          {comment.userHandle ? (
                            <span className="font-normal text-muted-foreground">
                              {" "}
                              | @{comment.userHandle.replace(/^@/, "")}
                            </span>
                          ) : null}
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
                                Salvar
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                disabled={savingEditId === comment.id}
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50 transition-colors"
                              >
                                <X className="h-3 w-3" />
                                Cancelar
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
                          aria-label="Editar comentário"
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
                          aria-label="Excluir comentário"
                        >
                          <Trash2 className="h-4 w-4" />
                        </motion.button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="py-8 text-center">
                <MessageCircle className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm font-medium text-muted-foreground">Nenhum comentário ainda</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Seja o primeiro a opinar sobre essa promoção!
                </p>
              </div>
            )}
          </div>

          {/* Input */}
          {user ? (
            <div className="space-y-2 shrink-0">
              <Textarea
                placeholder="A promoção tá boa? Já expirou? Compartilhe com a galera..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !submitting && draft.trim()) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                className="min-h-20 resize-none"
                disabled={submitting}
              />
              <Button
                onClick={handleSubmit}
                disabled={!draft.trim() || submitting}
                className="w-full rounded-lg"
              >
                {submitting ? "Enviando..." : "Comentar"}
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-border/50 bg-muted/20 p-3 text-center text-sm text-muted-foreground shrink-0">
              Entre para comentar e ajudar a comunidade
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
