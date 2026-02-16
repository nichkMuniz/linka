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
  followUserDb,
  unfollowUserDb,
  isFollowingDb,
  type ReelWithUser,
  type ReelComment,
  type PostIncentiveType,
} from "@/lib/ritmofit-db";
import { MessageCircle, Send, Trash2, UserPlus, UserCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

export default function Reels({ footerHeight = 0 }: { footerHeight?: number }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reels, setReels] = React.useState<ReelWithUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [visibleReelId, setVisibleReelId] = React.useState<string | null>(null);
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
  const [followingStatus, setFollowingStatus] = React.useState<
    Record<string, boolean>
  >({});
  const [isFollowingLoading, setIsFollowingLoading] = React.useState<
    Record<string, boolean>
  >({});
  const containerRef = React.useRef<HTMLDivElement>(null);
  const videoRefsMap = React.useRef<Record<string, HTMLVideoElement>>({});

  // Load reels on mount
  React.useEffect(() => {
    (async () => {
      try {
        const reelsData = await getReelsDb();
        setReels(reelsData);

        // Load follow status for each reel creator
        if (user) {
          const statuses: Record<string, boolean> = {};
          for (const reel of reelsData) {
            try {
              const isFollowing = await isFollowingDb(reel.user_id);
              statuses[reel.user_id] = isFollowing;
            } catch (err) {
              console.error(`Error checking follow status for ${reel.user_id}:`, err);
            }
          }
          setFollowingStatus(statuses);
        }
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
  }, [user]);

  // Set up IntersectionObserver to detect visible reel and auto-play video
  React.useEffect(() => {
    const observerOptions = {
      root: containerRef.current,
      rootMargin: "0px",
      threshold: [0.5],
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const reelId = entry.target.getAttribute("data-reel-id");
        if (!reelId) return;

        if (entry.isIntersecting) {
          setVisibleReelId(reelId);
          const video = videoRefsMap.current[reelId];
          if (video) {
            video.play().catch(() => {});
          }
        } else {
          const video = videoRefsMap.current[reelId];
          if (video) {
            video.pause();
          }
        }
      });
    }, observerOptions);

    const container = containerRef.current;
    if (container) {
      const reelItems = container.querySelectorAll("[data-reel-id]");
      reelItems.forEach((item) => observer.observe(item));
    }

    return () => {
      observer.disconnect();
    };
  }, [reels]);

  const handleIncentiveClick = React.useCallback(
    async (reel: ReelWithUser, type: PostIncentiveType) => {
      if (!user) {
        toast({
          title: "Faça login",
          description: "Você precisa estar logado para usar incentivos.",
        });
        return;
      }

      setTogglingReelId(reel.id);

      try {
        await toggleReelIncentiveDb(reel.id, type);

        // Update local state
        setReels((prev) =>
          prev.map((r) => {
            if (r.id !== reel.id) return r;

            const userLikes = r.userLikes || [];
            const newLikes = userLikes.includes(type)
              ? userLikes.filter((t) => t !== type)
              : [...userLikes, type];

            return { ...r, userLikes: newLikes };
          })
        );
      } catch (err: any) {
        console.error("Error toggling incentive:", err);
        toast({
          title: "Erro ao enviar incentivo",
          description: err?.message || "Tente novamente.",
          variant: "destructive",
        });
      } finally {
        setTogglingReelId(null);
      }
    },
    [user]
  );

  const handleOpenComments = React.useCallback(
    async (reel: ReelWithUser) => {
      setSelectedReel(reel);
      setCommentsOpen(true);
      setIsLoadingComments(true);

      try {
        const commentsData = await getReelCommentsDb(reel.id);
        setComments(commentsData);
      } catch (err: any) {
        console.error("Error loading comments:", err);
        toast({
          title: "Erro ao carregar comentários",
          description: err?.message || "Tente novamente.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingComments(false);
      }
    },
    []
  );

  const handleAddComment = React.useCallback(async () => {
    if (!commentText.trim() || !selectedReel) return;

    setIsAddingComment(true);
    try {
      await addReelCommentDb(selectedReel.id, commentText);

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
    if (!quickCommentText.trim() || !visibleReelId) return;

    const visibleReel = reels.find((r) => r.id === visibleReelId);
    if (!visibleReel) return;

    setIsAddingQuickComment(true);
    try {
      await addReelCommentDb(visibleReel.id, quickCommentText);
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
  }, [quickCommentText, visibleReelId, reels]);

  const handleFollowUser = React.useCallback(
    async (userId: string) => {
      if (!user) {
        toast({
          title: "Faça login",
          description: "Você precisa estar logado para seguir usuários.",
        });
        return;
      }

      setIsFollowingLoading((prev) => ({ ...prev, [userId]: true }));

      try {
        const isCurrentlyFollowing = followingStatus[userId];

        if (isCurrentlyFollowing) {
          const success = await unfollowUserDb(userId);
          if (success) {
            setFollowingStatus((prev) => ({ ...prev, [userId]: false }));
            toast({
              title: "Deixado de seguir",
              description: "Você deixou de seguir este usuário.",
            });
          }
        } else {
          const success = await followUserDb(userId);
          if (success) {
            setFollowingStatus((prev) => ({ ...prev, [userId]: true }));
            toast({
              title: "Seguindo",
              description: "Você começou a seguir este usuário.",
            });
          }
        }
      } catch (err: any) {
        console.error("Error toggling follow:", err);
        toast({
          title: "Erro",
          description: err?.message || "Não foi possível atualizar o seguimento.",
          variant: "destructive",
        });
      } finally {
        setIsFollowingLoading((prev) => ({ ...prev, [userId]: false }));
      }
    },
    [user, followingStatus]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-black">
        <p className="text-sm text-muted-foreground">Carregando clips...</p>
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-black">
        <p className="text-sm text-muted-foreground">
          Nenhum clip disponível no momento.
        </p>
      </div>
    );
  }

  return (
    <div
      className="bg-black fixed inset-0 flex flex-col overflow-hidden"
      style={{
        top: 0,
        left: 0,
        right: 0,
        bottom: `${footerHeight}px`,
        width: "100vw",
        overflow: "hidden",
      }}
    >
      {/* Reels Container - Scroll Snap com overflow-y-scroll */}
      <div
        ref={containerRef}
        className="flex-1 w-full"
        style={{
          overflowY: "auto",
          overflowX: "hidden",
          scrollSnapType: "y mandatory",
          height: "100%",
        }}
      >

        {reels.map((reel) => {
          const isVisible = reel.id === visibleReelId;

          return (
            <div
              key={reel.id}
              data-reel-id={reel.id}
              className="flex items-center justify-center bg-black relative"
              style={{
                width: "100%",
                height: "100%",
                maxWidth: "100vw",
                overflow: "hidden",
                scrollSnapAlign: "start",
                minHeight: "100%",
              }}
            >
              {/* Video */}
              {reel.video_url ? (
                <video
                  ref={(el) => {
                    if (el) videoRefsMap.current[reel.id] = el;
                  }}
                  src={reel.video_url}
                  muted
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
                <button
                  onClick={() => navigate(`/usuario/${reel.user_id}`)}
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                >
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
                  </div>
                </button>
                {user && user.id !== reel.user_id && (
                  <button
                    onClick={() => handleFollowUser(reel.user_id)}
                    disabled={isFollowingLoading[reel.user_id]}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                      followingStatus[reel.user_id]
                        ? "bg-white/20 text-white hover:bg-white/30"
                        : "bg-white text-black hover:bg-white/90"
                    } disabled:opacity-50`}
                  >
                    {followingStatus[reel.user_id] ? (
                      <>
                        <UserCheck className="h-3 w-3" />
                        Seguindo
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-3 w-3" />
                        Seguir
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Description - Bottom Left */}
              <div className="absolute bottom-20 left-4 right-20 z-10">
                {reel.description && (
                  <p className="text-sm text-white drop-shadow-md leading-relaxed">
                    {reel.description}
                  </p>
                )}
              </div>

              {/* Incentive Buttons + Comments - Right Side */}
              <div className="absolute right-6 bottom-20 flex flex-col gap-3 z-20">
                {([1, 2, 3, 4, 5, 6] as PostIncentiveType[]).map((type) => (
                  <PostIncentiveButton
                    key={type}
                    type={type}
                    isActive={(reel.userLikes || [])?.includes(type) ?? false}
                    onClick={() => handleIncentiveClick(reel, type)}
                    loading={togglingReelId === reel.id}
                  />
                ))}
                {/* Comments Button */}
                <button
                  onClick={() => handleOpenComments(reel)}
                  className="inline-flex shrink-0 items-center gap-1 transition-opacity hover:opacity-80"
                >
                  <div className="flex flex-col items-center gap-1">
                    <MessageCircle className="h-7 w-7 text-white hover:scale-110 transition-transform" />
                    {(reel.commentCount || 0) > 0 && (
                      <span className="text-xs text-white/70 font-medium">
                        {reel.commentCount}
                      </span>
                    )}
                  </div>
                </button>
              </div>

              {/* Bottom Comment Input - Above Footer */}
              {user && (
                <div
                  className="absolute left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-4"
                  style={{
                    bottom: `${footerHeight + 10}px`,
                  }}
                >
                  <div className="flex gap-2 bg-white/10 backdrop-blur-sm p-3 rounded-full border border-white/20">
                    <Input
                      placeholder="Comente..."
                      value={quickCommentText}
                      onChange={(e) => setQuickCommentText(e.target.value)}
                      disabled={isAddingQuickComment}
                      className="bg-transparent border-0 text-white placeholder:text-white/50 text-sm h-9 focus:ring-0 focus:outline-none flex-1"
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
                      className="h-9 w-9 p-0 rounded-full bg-white/20 hover:bg-white/30 flex-shrink-0"
                    >
                      <Send className="h-4 w-4 text-white" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
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
