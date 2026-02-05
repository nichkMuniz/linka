import * as React from "react";
import { MessageCircle, Trash2 } from "lucide-react";
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
  type PostComment,
} from "@/lib/ritmofit-db";
import { useAuth } from "@/hooks/useAuth";

export function PostCommentsDialog({
  postId,
  commentCount,
  hasActivity,
}: {
  postId: string;
  commentCount: number;
  hasActivity?: boolean;
}) {
  const { user } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [comments, setComments] = React.useState<PostComment[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;

    setLoading(true);
    getPostCommentsDb(postId)
      .then((data) => setComments(data))
      .catch((err) => {
        console.error("Error loading comments:", err);
        toast({
          title: "Erro ao carregar comentários",
          description: "Tente novamente.",
        });
      })
      .finally(() => setLoading(false));
  }, [open, postId]);

  const handleSubmit = React.useCallback(async () => {
    if (!draft.trim()) {
      toast({
        title: "Comentário vazio",
        description: "Digite uma mensagem antes de enviar.",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Faça login",
        description: "Você precisa estar logado para comentar.",
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
        title: "Comentário enviado!",
        description: "Sua mensagem foi publicada.",
      });
    } catch (err: any) {
      console.error("Error submitting comment:", err);
      toast({
        title: "Erro ao enviar comentário",
        description: err?.message || "Tente novamente.",
      });
    } finally {
      setSubmitting(false);
    }
  }, [draft, postId, user]);

  const handleDelete = React.useCallback(async (commentId: string) => {
    if (!confirm("Tem certeza que deseja deletar este comentário?")) return;

    try {
      setDeletingId(commentId);
      await deletePostCommentDb(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      toast({
        title: "Comentário deletado",
      });
    } catch (err: any) {
      console.error("Error deleting comment:", err);
      toast({
        title: "Erro ao deletar comentário",
        description: err?.message || "Tente novamente.",
      });
    } finally {
      setDeletingId(null);
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <motion.button
          type="button"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          className={cn(
            "relative inline-flex shrink-0 items-center justify-center rounded-lg p-2 transition-colors",
            "border border-border/50 bg-background/80 backdrop-blur",
            "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
            hasActivity &&
              commentCount > 0 &&
              "border-blue-500/50 bg-blue-500/10",
          )}
          aria-label={`Ver ${commentCount} comentários`}
        >
          <MessageCircle
            className={cn(
              "h-5 w-5 transition-colors",
              hasActivity && commentCount > 0
                ? "text-blue-500"
                : "text-muted-foreground",
            )}
          />
          {commentCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={cn(
                "absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
                hasActivity && commentCount > 0
                  ? "bg-blue-500 text-white"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {commentCount > 99 ? "99+" : commentCount}
            </motion.span>
          )}
        </motion.button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Comentários</DialogTitle>
          <DialogDescription>
            {commentCount} {commentCount === 1 ? "comentário" : "comentários"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {/* Comments list */}
          <div className="max-h-80 space-y-3 overflow-y-auto rounded-lg border border-border/50 bg-muted/20 p-3">
            {loading ? (
              <div className="text-sm text-muted-foreground">
                Carregando comentários...
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
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-xs font-medium truncate">
                          {comment.userName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {comment.userHandle}
                        </div>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed break-words">
                        {comment.text}
                      </p>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {new Date(comment.createdAt).toLocaleString("pt-BR")}
                      </div>
                    </div>

                    {user && user.id === comment.userId && (
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleDelete(comment.id)}
                        disabled={deletingId === comment.id}
                        className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Deletar comentário"
                      >
                        <Trash2 className="h-4 w-4" />
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Nenhum comentário ainda.
              </div>
            )}
          </div>

          {/* Comment input */}
          {user ? (
            <div className="space-y-2">
              <Textarea
                placeholder="Adicione um comentário..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
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
            <div className="rounded-lg border border-border/50 bg-muted/20 p-3 text-center text-sm text-muted-foreground">
              Faça login para comentar.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
