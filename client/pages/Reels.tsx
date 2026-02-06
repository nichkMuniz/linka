import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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
  const [currentReelIndex, setCurrentReelIndex] = React.useState(0);
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
  const [quickCommentText, setQuickCommentText] = React.useState("");
  const [isAddingQuickComment, setIsAddingQuickComment] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = React.useRef<NodeJS.Timeout>();

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

  // Handle scroll to next reel
  const handleScroll = React.useCallback(
    (e: WheelEvent | TouchEvent) => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

      scrollTimeoutRef.current = setTimeout(() => {
        let direction = 0;

        if (e instanceof WheelEvent) {
          // deltaY > 0 = scrolling down (should go to previous/up)
          // deltaY < 0 = scrolling up (should go to next/down)
          direction = e.deltaY > 0 ? -1 : 1;
        } else if (e instanceof TouchEvent) {
          // Handle touch swipe - already handled in touchend
          return;
        }

        if (direction !== 0) {
          const nextIndex = Math.max(
            0,
            Math.min(currentReelIndex + direction, reels.length - 1),
          );
          setCurrentReelIndex(nextIndex);
        }
      }, 100);
    },
    [currentReelIndex, reels.length],
  );

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("wheel", handleScroll as EventListener, {
      passive: true,
    });

    let touchStartY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndY = e.touches[0]?.clientY || touchStartY;
      const delta = touchStartY - touchEndY;

      if (Math.abs(delta) > 50) {
        const nextIndex = Math.max(
          0,
          Math.min(currentReelIndex + (delta > 0 ? 1 : -1), reels.length - 1),
        );
        setCurrentReelIndex(nextIndex);
      }
    };

    container.addEventListener("touchstart", handleTouchStart, false);
    container.addEventListener("touchend", handleTouchEnd, false);

    return () => {
      container.removeEventListener("wheel", handleScroll as EventListener);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [currentReelIndex, reels.length, handleScroll]);

  const currentReel = reels[currentReelIndex];

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

  const handleAddQuickComment = React.useCallback(async () => {
    if (!quickCommentText.trim() || !currentReel) return;

    setIsAddingQuickComment(true);
    try {
      await addReelCommentDb(currentReel.id, quickCommentText);
      setQuickCommentText("");
      toast({
        title: "Comentário enviado!",
        description: "Seu comentário foi publicado.",
      });
    } catch (err: any) {
      console.error("Error adding comment:", err);
      toast({
        title: "Erro ao enviar comentário",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsAddingQuickComment(false);
    }
  }, [quickCommentText, currentReel]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-sm text-muted-foreground">Carregando clips...</p>
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-sm text-muted-foreground">
          Nenhum clip disponível no momento.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-[calc(100dvh-120px)] w-full bg-black overflow-hidden flex items-center justify-center"
    >
      {/* Videos Container */}
      <div className="relative h-full w-full max-w-2xl">
        {reels.map((reel, index) => {
          const isVisible = index === currentReelIndex;

          return (
            <div
              key={reel.id}
              className={`absolute inset-0 transition-opacity duration-300 ${
                isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              {/* Video */}
              <div className="relative h-full w-full overflow-hidden bg-black">
                {reel.video_url ? (
                  <video
                    src={reel.video_url}
                    autoPlay={isVisible}
                    muted={isVisible}
                    loop
                    playsInline
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Vídeo indisponível
                  </div>
                )}

                {/* Gradient Overlay for Better Text Visibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />

                {/* User Info - Top Left */}
                <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
                  {reel.userPhoto && (
                    <img
                      src={reel.userPhoto}
                      alt={reel.userNickname || "Usuário"}
                      className="h-12 w-12 rounded-full object-cover border-2 border-white/30 shadow-lg"
                    />
                  )}
                  <div>
                    <p className="text-sm font-bold text-white drop-shadow-md">
                      {reel.userNickname || "Usuário"}
                    </p>
                    <p className="text-xs text-white/70">Seguir</p>
                  </div>
                </div>

                {/* Description - Bottom Left */}
                <div className="absolute bottom-24 left-4 right-16 z-10">
                  {reel.description && (
                    <p className="text-sm text-white drop-shadow-md leading-relaxed">
                      {reel.description}
                    </p>
                  )}
                </div>

                {/* Incentive Buttons + Comments - Right Side */}
                <div className="absolute right-4 bottom-24 flex flex-col gap-4 z-20">
                  {/* Like/Incentive Buttons */}
                  <div className="flex flex-col gap-3">
                    {([1, 2, 3] as PostIncentiveType[]).map((type) => (
                      <PostIncentiveButton
                        key={type}
                        type={type}
                        isActive={(reel.userLikes || [])?.includes(type) ?? false}
                        onClick={() => handleIncentiveClick(reel, type)}
                        loading={togglingReelId === reel.id}
                      />
                    ))}
                  </div>

                  {/* Comments Button */}
                  <button
                    onClick={() => handleOpenComments(reel)}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-white/10 transition-colors group"
                  >
                    <MessageCircle className="h-7 w-7 text-white group-hover:scale-110 transition-transform" />
                    <span className="text-xs text-white/70 font-medium">
                      {(reel.commentCount || 0) > 0 ? reel.commentCount : ""}
                    </span>
                  </button>
                </div>

                {/* Bottom Left Comment Input */}
                {user && (
                  <div className="absolute bottom-4 left-4 right-16 z-10">
                    <div className="flex gap-2 bg-white/10 backdrop-blur-sm p-2 rounded-full border border-white/20">
                      <Input
                        placeholder="Comente..."
                        value={quickCommentText}
                        onChange={(e) => setQuickCommentText(e.target.value)}
                        disabled={isAddingQuickComment}
                        className="bg-transparent border-0 text-white placeholder:text-white/50 text-xs h-8 focus:ring-0 focus:outline-none"
                        onKeyPress={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleAddQuickComment();
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        onClick={handleAddQuickComment}
                        disabled={
                          !quickCommentText.trim() || isAddingQuickComment
                        }
                        className="h-8 w-8 p-0 rounded-full bg-white/20 hover:bg-white/30"
                      >
                        <Send className="h-3 w-3 text-white" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Dots - Bottom Center */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
        {reels.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentReelIndex(index)}
            className={`transition-all rounded-full ${
              index === currentReelIndex
                ? "w-8 h-1 bg-white"
                : "w-2 h-1 bg-white/40 hover:bg-white/60"
            }`}
          />
        ))}
      </div>

      {/* Comments Drawer */}
      <Drawer
        open={commentsOpen && selectedReel !== null}
        onOpenChange={setCommentsOpen}
      >
        <DrawerContent className="max-h-[70vh] flex flex-col">
          <DrawerHeader>
            <DrawerTitle>Comentários</DrawerTitle>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto space-y-4 px-4 py-4">
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
            <div className="flex gap-2 border-t border-border/60 px-4 py-4">
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
        </DrawerContent>
      </Drawer>
    </div>
  );
}
