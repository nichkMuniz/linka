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
import { useKeyboardInputScroll } from "@/hooks/use-keyboard-input-scroll";
import { cn } from "@/lib/utils";

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
  // Compor comentário é rodapé fixo (já acima do teclado). Este hook cobre a
  // textarea de EDIÇÃO inline, no meio da lista rolável.
  useKeyboardInputScroll();

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
      const active = document.activeElement as HTMLElement | null;
      if (active && (active.tagName === "TEXTAREA" || active.tagName === "INPUT")) {
        active.blur();
      }
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
        handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
        className="flex flex-col !rounded-t-[32px] !border-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
        style={{
          height: `min(60dvh, ${viewportHeight - 8}px)`,
          maxHeight: `min(60dvh, ${viewportHeight - 8}px)`,
          paddingBottom: "env(safe-area-inset-bottom)",
          background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderTop: "1px solid rgba(255,255,255,.14)",
        }}
      >
        <DrawerHeader className="shrink-0 pb-2">
          <DrawerTitle className="text-base" style={{ color: "#fff" }}>Comentários da promoção</DrawerTitle>
          <DrawerDescription className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
            Compartilhe sua opinião — a promoção vale? Expirou? Já aproveite e ajude a comunidade!
          </DrawerDescription>
        </DrawerHeader>

        {/* stopPropagation prevents vaul from starting a drag gesture when tapping inside the content */}
        <div className="flex flex-col flex-1 gap-3 overflow-hidden px-4 pb-4" onPointerDown={(e) => e.stopPropagation()}>
          {/* Comments list */}
          <div
            className={cn(
              "flex-1 space-y-3 overflow-y-auto rounded-2xl p-3",
              !loading && comments.length === 0 && "flex flex-col items-center justify-center",
            )}
            style={{ border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)" }}
          >
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-2xl p-3 space-y-2" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)" }}>
                    <div className="h-3 w-1/3 rounded bg-white/10 animate-pulse" />
                    <div className="h-2 w-full rounded bg-white/10 animate-pulse" />
                    <div className="h-2 w-4/5 rounded bg-white/10 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : comments.length > 0 ? (
              comments.map((comment) => (
                <motion.div
                  key={comment.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl p-3"
                  style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <UserAvatar
                        photo={comment.userPhoto}
                        nickname={comment.userName}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium" style={{ color: "#fff" }}>
                          {comment.userName}
                          {comment.userHandle ? (
                            <span className="font-normal" style={{ color: "rgba(255,255,255,.5)" }}>
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
                              style={{
                                background: "rgba(255,255,255,.07)",
                                border: "1px solid rgba(255,255,255,.12)",
                                color: "#fff",
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
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
                              >
                                <Check className="h-3 w-3" />
                                Salvar
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                disabled={savingEditId === comment.id}
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium disabled:opacity-50 transition-colors"
                                style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.7)" }}
                              >
                                <X className="h-3 w-3" />
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-1 text-sm leading-relaxed break-words" style={{ color: "rgba(255,255,255,.85)" }}>
                            {comment.text}
                          </p>
                        )}

                        <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,.4)" }}>
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
                          className="rounded-lg p-1.5 transition-colors"
                          style={{ color: "rgba(255,255,255,.5)" }}
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
                          className="rounded-lg p-1.5 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ color: "rgba(255,255,255,.5)" }}
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
                <MessageCircle className="mx-auto h-8 w-8 mb-2" style={{ color: "rgba(255,255,255,.2)" }} />
                <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,.5)" }}>Nenhum comentário ainda</p>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,.3)" }}>
                  Seja o primeiro a opinar sobre essa promoção!
                </p>
              </div>
            )}
          </div>

          {/* Input — the lift wrapper in ui/drawer.tsx (--keyboard-height) keeps the sheet above the iOS keyboard */}
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
                style={{
                  background: "rgba(255,255,255,.07)",
                  border: "1px solid rgba(255,255,255,.12)",
                  color: "#fff",
                }}
                disabled={submitting}
              />
              <Button
                onClick={handleSubmit}
                disabled={!draft.trim() || submitting}
                className="w-full rounded-lg border-0"
                style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
              >
                {submitting ? "Enviando..." : "Comentar"}
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl p-3 text-center text-sm shrink-0" style={{ border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.04)", color: "rgba(255,255,255,.5)" }}>
              Entre para comentar e ajudar a comunidade
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
