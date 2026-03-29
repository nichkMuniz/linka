import * as React from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  getStoryLikesDb,
  getUserStoryLikesDb,
  toggleStoryLikeDb,
  getStoryCommentsDb,
  addStoryCommentDb,
  deleteStoryCommentDb,
  deleteStoryDb,
  recordFlowViewDb,
  getFlowViewersDb,
  type StoryWithUser,
  type PostIncentiveType,
  type StoryComment,
  type FlowViewer,
} from "@/lib/ritmofit-db";
import { X, ChevronLeft, Send, Trash2, Eye, Pause, Play } from "lucide-react";
import { CommentReactions } from "@/components/shared/comment-reactions";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { PostIncentiveButton } from "@/components/shared/post-incentive-button";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { EmojiPicker } from "@/components/shared/emoji-picker";

interface FlowViewerModalProps {
  story: StoryWithUser | null;
  stories: StoryWithUser[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNextStory: () => void;
  onPrevStory?: () => void;
  onDeleted?: () => void;
}

export function FlowViewerModal({
  story,
  stories,
  open,
  onOpenChange,
  onNextStory,
  onPrevStory,
  onDeleted,
}: FlowViewerModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [likes, setLikes] = React.useState<Record<string, any>>({});
  const [userLikes, setUserLikes] = React.useState<PostIncentiveType[]>([]);
  const [comments, setComments] = React.useState<StoryComment[]>([]);
  const [newComment, setNewComment] = React.useState("");
  const [isAddingComment, setIsAddingComment] = React.useState(false);
  const [togglingLikeId, setTogglingLikeId] = React.useState<string | null>(null);
  const [timerProgress, setTimerProgress] = React.useState(100);
  const [isTyping, setIsTyping] = React.useState(false);
  const [isDeletingStory, setIsDeletingStory] = React.useState(false);
  const [commentToDelete, setCommentToDelete] = React.useState<string | null>(null);
  const [viewersModalOpen, setViewersModalOpen] = React.useState(false);
  const [viewers, setViewers] = React.useState<FlowViewer[]>([]);
  const [isLoadingViewers, setIsLoadingViewers] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);
  const showCommentInput = true;
  const timerIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = React.useRef(false);
  const isPausedRef = React.useRef(false);
  const onNextStoryRef = React.useRef(onNextStory);

  // Keep refs in sync
  React.useEffect(() => {
    isTypingRef.current = isTyping;
  }, [isTyping]);

  React.useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  React.useEffect(() => {
    onNextStoryRef.current = onNextStory;
  }, [onNextStory]);

  React.useEffect(() => {
    if (!open || !story) return;

    const loadStoryData = async () => {
      try {
        const [likesData, userLikesData, commentsData] = await Promise.all([
          getStoryLikesDb(story.id),
          getUserStoryLikesDb(story.id),
          getStoryCommentsDb(story.id),
        ]);

        setLikes(likesData);
        setUserLikes(userLikesData);
        setComments(commentsData);
      } catch (err) {
        console.error("Error loading story data:", err);
      }
    };

    loadStoryData();

    // Record view for non-owners (recordFlowViewDb internally checks viewer identity)
    recordFlowViewDb(story.id, story.user_id).catch((err) =>
      console.error("Error recording flow view:", err),
    );

    // Reset timer & pause state when story changes
    setTimerProgress(100);
    setIsPaused(false);
    isPausedRef.current = false;

    // Clear existing timers
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    const STORY_DURATION = 8000;
    const TIMER_INTERVAL = 50;
    let elapsedTime = 0;

    const updateTimer = () => {
      // Pause timer when user is typing or paused
      if (isTypingRef.current || isPausedRef.current) return;

      elapsedTime += TIMER_INTERVAL;
      const progress = Math.max(0, 100 - (elapsedTime / STORY_DURATION) * 100);
      setTimerProgress(progress);

      if (elapsedTime >= STORY_DURATION) {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        onNextStoryRef.current();
      }
    };

    timerIntervalRef.current = setInterval(updateTimer, TIMER_INTERVAL);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [open, story?.id, user]);

  const handleTogglePause = React.useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  const handleOpenViewers = React.useCallback(async () => {
    if (!story) return;
    setViewersModalOpen(true);
    setIsLoadingViewers(true);
    try {
      const data = await getFlowViewersDb(story.id);
      setViewers(data);
    } catch (err) {
      console.error("Error loading viewers:", err);
    } finally {
      setIsLoadingViewers(false);
    }
  }, [story]);

  const handleToggleLike = React.useCallback(
    async (incentiveType: PostIncentiveType) => {
      if (!story || !user) return;

      setTogglingLikeId(story.id);
      try {
        await toggleStoryLikeDb(story.id, incentiveType);

        const wasActive = userLikes.includes(incentiveType);
        setUserLikes(
          wasActive
            ? userLikes.filter((t) => t !== incentiveType)
            : [...userLikes, incentiveType],
        );

        setLikes((prev) => {
          const updated = { ...prev };
          const fieldMap: Record<PostIncentiveType, string> = {
            1: "apoio",
            2: "continua",
            3: "ganhador",
            4: "consegueMais",
            5: "limiteMaior",
            6: "maisAlgum",
          };
          const field = fieldMap[incentiveType];
          if (field) {
            updated[field] = (updated[field] || 0) + (wasActive ? -1 : 1);
          }
          return updated;
        });
      } catch (err: any) {
        console.error("Error toggling story like:", err);
        toast({
          title: "Erro ao reagir",
          description: err?.message || "Tente novamente.",
        });
      } finally {
        setTogglingLikeId(null);
      }
    },
    [story, user, userLikes],
  );

  const handleAddComment = React.useCallback(async () => {
    if (!story || !user || !newComment.trim()) return;

    setIsAddingComment(true);
    try {
      const comment = await addStoryCommentDb(story.id, newComment);
      if (comment) {
        setComments((prev) => [...prev, comment]);
        setNewComment("");
      }
    } catch (err: any) {
      console.error("Error adding comment:", err);
      toast({
        title: "Erro ao adicionar comentário",
        description: err?.message || "Tente novamente.",
      });
    } finally {
      setIsAddingComment(false);
    }
  }, [story, user, newComment]);

  const handleDeleteComment = React.useCallback(
    async (commentId: string) => {
      try {
        const success = await deleteStoryCommentDb(commentId);
        if (success) {
          setComments((prev) => prev.filter((c) => c.id !== commentId));
        }
      } catch (err: any) {
        console.error("Error deleting comment:", err);
      }
    },
    [],
  );

  const handleDeleteStory = React.useCallback(async () => {
    if (!story) return;
    if (!confirm("Tem certeza que deseja deletar este flow?")) return;

    setIsDeletingStory(true);
    try {
      const success = await deleteStoryDb(story.id);
      if (success) {
        onOpenChange(false);
        toast({ title: "Flow deletado", description: "Seu flow foi removido." });
        onDeleted?.();
      }
    } catch (err: any) {
      toast({
        title: "Erro ao deletar flow",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingStory(false);
    }
  }, [story, onOpenChange]);

  if (!story) return null;

  const isVideo =
    story.media_url?.includes(".mp4") ||
    story.media_url?.includes(".webm") ||
    story.media_url?.includes(".mov") ||
    (story.media_url?.startsWith("data:") && story.media_url?.includes("video"));

  // Sort stories ascending for in-viewer navigation (oldest first = first posted)
  const sortedStories = [...stories].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const currentIndex = sortedStories.findIndex((s) => s.id === story.id);
  const hasNextStory = currentIndex < sortedStories.length - 1;
  const hasPrevStory = currentIndex > 0;
  const isOwner = user?.id === story.user_id;

  // Progress bar segments: one per story in the sorted list
  const userStories = sortedStories.filter((s) => s.user_id === story.user_id);
  const storyIndexInUser = userStories.findIndex((s) => s.id === story.id);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="w-screen h-screen md:w-[680px] md:h-[calc(100dvh-48px)] max-w-none md:max-w-[680px] max-h-none p-0 border-0 bg-black rounded-none md:rounded-xl [&>button]:hidden"
        >
          <DialogTitle className="sr-only">Flow viewer</DialogTitle>
          <DialogDescription className="sr-only">Visualizando flow</DialogDescription>
          <div className="relative w-full h-full flex flex-col">
            {/* Header */}
            <div className="space-y-2 z-10">
              {/* Progress Bar segments */}
              <div className="flex gap-1 px-2 pt-2">
                {userStories.map((s, idx) => (
                  <div key={s.id} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white transition-none"
                      style={{
                        width:
                          idx < storyIndexInUser
                            ? "100%"
                            : idx === storyIndexInUser
                            ? `${100 - timerProgress}%`
                            : "0%",
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Header Content */}
              <div className="flex items-center justify-between px-4 pb-2">
                <button
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/usuario/${story.user_id}`);
                  }}
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity flex-1"
                >
                  {story.userPhoto && (
                    <img
                      src={story.userPhoto}
                      alt={story.userNickname}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-white">{story.userNickname}</p>
                    <p className="text-xs text-gray-400">{formatTimeAgo(story.created_at)}</p>
                  </div>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Pause/Play button */}
                  <button
                    onClick={handleTogglePause}
                    className="text-white hover:text-brand transition-colors"
                    title={isPaused ? "Retomar" : "Pausar"}
                  >
                    {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                  </button>
                  {isOwner && (
                    <button
                      onClick={() => { setIsPaused(true); handleOpenViewers(); }}
                      className="text-white hover:text-brand transition-colors"
                      title="Ver quem visualizou"
                    >
                      <Eye className="h-5 w-5" />
                    </button>
                  )}
                  {isOwner && (
                    <button
                      onClick={handleDeleteStory}
                      disabled={isDeletingStory}
                      className="text-white hover:text-red-400 transition-colors disabled:opacity-50"
                      title="Deletar flow"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  )}
                  <button
                    onClick={() => onOpenChange(false)}
                    className="text-white hover:text-gray-300 transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>
            </div>

            {/* Media - Full Screen */}
            <div className="flex-1 flex items-center justify-center relative">
              {isVideo ? (
                <video src={story.media_url} className="w-full h-full object-cover" autoPlay />
              ) : (
                <img src={story.media_url} alt="Flow" className="w-full h-full object-cover" />
              )}

              {/* Left tap zone - previous story */}
              {hasPrevStory && (
                <button
                  onClick={(e) => { e.stopPropagation(); onPrevStory?.(); }}
                  className="absolute left-0 top-0 bottom-0 w-1/4 z-20"
                  aria-label="Story anterior"
                />
              )}

              {/* Center tap zone - pause/resume */}
              <button
                className="absolute left-1/4 right-1/4 top-0 bottom-0 z-20"
                onClick={handleTogglePause}
                aria-label={isPaused ? "Retomar" : "Pausar"}
              />

              {/* Right tap zone - next story */}
              {hasNextStory && (
                <button
                  onClick={(e) => { e.stopPropagation(); onNextStory(); }}
                  className="absolute right-0 top-0 bottom-0 w-1/4 z-20"
                  aria-label="Próximo story"
                />
              )}

              {/* Paused indicator */}
              {isPaused && (
                <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                  <div className="bg-black/40 rounded-full p-4">
                    <Play className="h-10 w-10 text-white" />
                  </div>
                </div>
              )}

              {/* Incentive Buttons — only shown to non-owners */}
              {!isOwner && (
                <div
                  className="absolute right-4 bottom-20 flex flex-col gap-2 z-30"
                  onClick={(e) => e.stopPropagation()}
                >
                  {([1, 2, 3, 4, 5, 6] as PostIncentiveType[]).map((type) => (
                    <PostIncentiveButton
                      key={type}
                      type={type}
                      isActive={userLikes.includes(type)}
                      onClick={() => handleToggleLike(type)}
                      loading={togglingLikeId === story.id}
                    />
                  ))}
                </div>
              )}

              {/* Description Overlay */}
              {story.description && (
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10 pointer-events-none">
                  <p className="text-sm text-white">{story.description}</p>
                </div>
              )}
            </div>

            {/* Bottom Section - Comments */}
            {showCommentInput && (
              <div className="shrink-0 bg-black/90 border-t border-white/10 p-3 space-y-3 max-h-40 flex flex-col z-20">
                {comments.length > 0 && (
                  <div className="overflow-y-auto flex-1 space-y-2 max-h-24">
                    {comments.map((comment) => (
                      <div key={comment.id} className="flex items-start gap-2 text-xs">
                        <div className="flex-1">
                          <span className="font-semibold text-white">{comment.userName}</span>
                          <span className="text-white/70 ml-2">{comment.text}</span>
                          <CommentReactions commentType="flow" commentId={comment.id} dark />
                        </div>
                        {user?.id === comment.userId && (
                          <button
                            onClick={() => setCommentToDelete(comment.id)}
                            className="text-red-400 hover:text-red-500 shrink-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {user && (
                  <div className="flex gap-2 items-center bg-white/10 rounded-full px-3 py-1.5">
                    <Input
                      type="text"
                      placeholder="Comentário..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onFocus={() => setIsTyping(true)}
                      onBlur={() => setIsTyping(false)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && newComment.trim()) {
                          handleAddComment();
                        }
                      }}
                      className="flex-1 bg-transparent border-0 text-xs text-white placeholder-white/50 focus:outline-none focus-visible:ring-0 h-6"
                      disabled={isAddingComment}
                    />
                    <EmojiPicker
                      placement="top"
                      onSelect={(emoji) => setNewComment((prev) => prev + emoji)}
                      triggerClassName="text-white/70 hover:text-white hover:bg-white/10"
                    />
                    <button
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || isAddingComment}
                      className="text-white hover:text-brand disabled:opacity-50 shrink-0"
                    >
                      <Send className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Viewers Drawer */}
      <Drawer open={viewersModalOpen} onOpenChange={setViewersModalOpen}>
        <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter">
          <DrawerHeader className="shrink-0">
            <DrawerTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Visualizações ({viewers.length})
            </DrawerTitle>
            <DrawerDescription className="sr-only">Lista de pessoas que visualizaram este flow</DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2">
            {isLoadingViewers ? (
              <p className="text-sm text-muted-foreground text-center py-6">Carregando...</p>
            ) : viewers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma visualização ainda
              </p>
            ) : (
              viewers.map((viewer) => {
                const INCENTIVE_ICONS: Record<number, string> = { 1: "👏", 2: "🔥", 3: "🏆", 4: "🚀", 5: "🎯", 6: "⚡" };
                const hasIncentive = viewer.incentiveTypes.length > 0;
                return (
                  <div key={viewer.followerId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    {viewer.userPhoto ? (
                      <img
                        src={viewer.userPhoto}
                        alt={viewer.userNickname}
                        className="h-10 w-10 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-muted flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{viewer.userNickname}</p>
                      <p className="text-xs text-muted-foreground">{formatTimeAgo(viewer.viewedAt)}</p>
                    </div>
                    <div className="shrink-0">
                      {hasIncentive ? (
                        <div className="flex items-center gap-0.5">
                          {viewer.incentiveTypes.map((type, i) => (
                            <span key={i} className="text-base leading-none">{INCENTIVE_ICONS[type] ?? "👍"}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">sem incentivo</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Comment delete confirmation */}
      <AlertDialog open={!!commentToDelete} onOpenChange={(open) => { if (!open) setCommentToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar comentário</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja apagar este comentário?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                const id = commentToDelete!;
                setCommentToDelete(null);
                await handleDeleteComment(id);
              }}
            >
              Sim, apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function formatTimeAgo(date: string): string {
  const now = new Date();
  const storyTime = new Date(date);
  const diffMs = now.getTime() - storyTime.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return "agora";
  if (diffMins < 60) return `${diffMins}m atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;

  return storyTime.toLocaleDateString("pt-BR");
}
