import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PostIncentiveButton } from "@/components/post-incentive-button";
import { toast } from "@/components/ui/use-toast";
import {
  getReelsDb,
  toggleReelIncentiveDb,
  addReelCommentDb,
  getReelCommentsDb,
  deleteReelCommentDb,
  type ReelWithUser,
  type ReelComment,
  type PostIncentiveType,
} from "@/lib/ritmofit-db";
import { MessageCircle, Send, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

export default function Reels() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reels, setReels] = React.useState<ReelWithUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [togglingReelId, setTogglingReelId] = React.useState<string | null>(
    null,
  );
  const [commentsOpen, setCommentsOpen] = React.useState(false);
  const [selectedReel, setSelectedReel] = React.useState<ReelWithUser | null>(
    null,
  );
  const [comments, setComments] = React.useState<ReelComment[]>([]);
  const [commentText, setCommentText] = React.useState("");
  const [isLoadingComments, setIsLoadingComments] = React.useState(false);
  const [isAddingComment, setIsAddingComment] = React.useState(false);

  // Load reels on mount
  React.useEffect(() => {
    (async () => {
      try {
        const reelsData = await getReelsDb();
        setReels(reelsData);
      } catch (err: any) {
        console.error("Erro ao carregar reels:", err?.message || err);
        toast({
          title: "Erro ao carregar reels",
          description: err?.message || "Tente novamente.",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleIncentiveClick = React.useCallback(
    async (reel: ReelWithUser, incentiveType: PostIncentiveType) => {
      setTogglingReelId(reel.id);
      try {
        await toggleReelIncentiveDb(reel.id, incentiveType);

        // Update the reel's likes
        setReels((prev) =>
          prev.map((r) => {
            if (r.id === reel.id) {
              const currentUserLikes = r.userLikes || [];
              const userLiked = currentUserLikes.includes(incentiveType);
              const currentLikes = r.likes || {
                apoio: 0,
                continua: 0,
                ganhador: 0,
              };

              return {
                ...r,
                userLikes: userLiked
                  ? currentUserLikes.filter((t) => t !== incentiveType)
                  : [...currentUserLikes, incentiveType],
                likes: {
                  apoio:
                    incentiveType === 1
                      ? currentLikes.apoio + (userLiked ? -1 : 1)
                      : currentLikes.apoio,
                  continua:
                    incentiveType === 2
                      ? currentLikes.continua + (userLiked ? -1 : 1)
                      : currentLikes.continua,
                  ganhador:
                    incentiveType === 3
                      ? currentLikes.ganhador + (userLiked ? -1 : 1)
                      : currentLikes.ganhador,
                },
              };
            }
            return r;
          }),
        );
      } catch (err: any) {
        console.error("Error toggling incentive:", err);
        toast({
          title: "Erro ao registrar incentivo",
          description: err?.message || "Tente novamente.",
          variant: "destructive",
        });
      } finally {
        setTogglingReelId(null);
      }
    },
    [],
  );

  const handleOpenComments = React.useCallback(async (reel: ReelWithUser) => {
    setSelectedReel(reel);
    setCommentsOpen(true);
    setIsLoadingComments(true);
    try {
      const commentsData = await getReelCommentsDb(reel.id);
      setComments(commentsData || []);
    } catch (err: any) {
      console.error("Error loading comments:", err);
      setComments([]);
      toast({
        title: "Erro ao carregar comentários",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingComments(false);
    }
  }, []);

  const handleAddComment = React.useCallback(async () => {
    if (!commentText.trim() || !selectedReel) return;

    setIsAddingComment(true);
    try {
      await addReelCommentDb(selectedReel.id, commentText);

      // Reload comments
      const updatedComments = await getReelCommentsDb(selectedReel.id);
      setComments(updatedComments);
      setCommentText("");
    } catch (err: any) {
      console.error("Error adding comment:", err);
      toast({
        title: "Erro ao enviar comentário",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsAddingComment(false);
    }
  }, [commentText, selectedReel]);

  const handleDeleteComment = React.useCallback(async (commentId: string) => {
    try {
      await deleteReelCommentDb(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err: any) {
      console.error("Error deleting comment:", err);
      toast({
        title: "Erro ao deletar comentário",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  }, []);

  if (loading) {
    return (
      <div className="mx-auto grid w-full max-w-2xl gap-4 p-4">
        <p className="text-sm text-muted-foreground">Carregando reels...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4 p-4">
      <h1 className="text-2xl font-bold tracking-tight">Reels</h1>

      {reels.length > 0 ? (
        <div className="space-y-4">
          {reels.map((reel) => {
            if (!reel || !reel.id) return null;
            return (
              <Card
                key={reel.id}
                className="overflow-hidden border-border/60 hover:bg-muted/30 transition-colors"
              >
                <CardContent className="p-0">
                  {/* Video */}
                  <div className="relative aspect-square overflow-hidden bg-muted">
                    {reel.video_url ? (
                      <video
                        src={reel.video_url}
                        controls
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        Vídeo indisponível
                      </div>
                    )}
                  </div>

                  {/* User Info and Description */}
                  <div className="p-4 space-y-3">
                    {/* User */}
                    <div className="flex items-center gap-3">
                      {reel.userPhoto && (
                        <img
                          src={reel.userPhoto}
                          alt={reel.userNickname || "Usuário"}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {reel.userNickname || "Usuário"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {reel.created_at
                            ? new Date(reel.created_at).toLocaleDateString(
                                "pt-BR",
                              )
                            : ""}
                        </p>
                      </div>
                    </div>

                    {/* Description */}
                    {reel.description && (
                      <p className="text-sm text-foreground">
                        {reel.description}
                      </p>
                    )}

                    {/* Incentives and Actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <div className="flex flex-wrap gap-2">
                        {([1, 2, 3] as PostIncentiveType[]).map((type) => (
                          <PostIncentiveButton
                            key={type}
                            type={type}
                            count={
                              (reel.likes || {
                                apoio: 0,
                                continua: 0,
                                ganhador: 0,
                              })[
                                type === 1
                                  ? "apoio"
                                  : type === 2
                                    ? "continua"
                                    : "ganhador"
                              ] || 0
                            }
                            isActive={
                              (reel.userLikes || [])?.includes(type) ?? false
                            }
                            onClick={() => handleIncentiveClick(reel, type)}
                            loading={togglingReelId === reel.id}
                          />
                        ))}
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="rounded-full"
                        onClick={() => handleOpenComments(reel)}
                      >
                        <MessageCircle className="h-4 w-4" />
                        <span className="ml-1 text-xs">
                          {selectedReel?.id === reel.id && comments?.length
                            ? comments.length
                            : ""}
                        </span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-border/60 bg-muted/30 p-8 text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Nenhum reel disponível no momento.
          </p>
        </div>
      )}

      {/* Comments Dialog */}
      <Dialog
        open={commentsOpen && selectedReel !== null}
        onOpenChange={setCommentsOpen}
      >
        <DialogContent className="max-h-[80dvh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Comentários</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {isLoadingComments ? (
              <p className="text-sm text-muted-foreground text-center">
                Carregando comentários...
              </p>
            ) : comments && comments.length > 0 ? (
              comments.map((comment) => (
                <div
                  key={comment.id}
                  className="flex items-start gap-3 pb-3 border-b border-border/60"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {comment.userName || "Usuário"}
                      <span className="ml-1 text-xs text-muted-foreground">
                        {comment.userHandle || "@user"}
                      </span>
                    </p>
                    <p className="text-sm text-foreground mt-1">
                      {comment.text}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(comment.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  {user?.id === comment.userId && (
                    <button
                      onClick={() => handleDeleteComment(comment.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                Sem comentários ainda. Seja o primeiro a comentar!
              </p>
            )}
          </div>

          {/* Comment Input */}
          {selectedReel && (
            <div className="flex gap-2 border-t border-border/60 pt-4">
              <Input
                placeholder="Adicione um comentário..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAddComment();
                  }
                }}
                disabled={isAddingComment}
                className="rounded-full"
              />
              <Button
                onClick={handleAddComment}
                disabled={!commentText.trim() || isAddingComment}
                size="sm"
                className="rounded-full"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
