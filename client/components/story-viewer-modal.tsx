import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
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
import { X, ChevronLeft, Send, Trash2, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { PostIncentiveButton } from "@/components/post-incentive-button";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";

interface StoryViewerModalProps {
  story: StoryWithUser | null;
  stories: StoryWithUser[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNextStory: () => void;
  onPrevStory?: () => void;
}

export function StoryViewerModal({
  story,
  stories,
  open,
  onOpenChange,
  onNextStory,
  onPrevStory,
}: StoryViewerModalProps) {
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
  const [viewersModalOpen, setViewersModalOpen] = React.useState(false);
  const [viewers, setViewers] = React.useState<FlowViewer[]>([]);
  const [isLoadingViewers, setIsLoadingViewers] = React.useState(false);
  const timerIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = React.useRef(false);

  // Keep isTypingRef in sync with isTyping state
  React.useEffect(() => {
    isTypingRef.current = isTyping;
  }, [isTyping]);

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

    // Record view for non-owners
    if (user && user.id !== story.user_id) {
      recordFlowViewDb(story.id, story.user_id).catch((err) =>
        console.error("Error recording flow view:", err),
      );
    }

    // Reset timer when story changes
    setTimerProgress(100);

    // Clear existing timers
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    const STORY_DURATION = 8000;
    const TIMER_INTERVAL = 50;
    let elapsedTime = 0;

    const updateTimer = () => {
      // Pause timer when user is typing
      if (isTypingRef.current) return;

      elapsedTime += TIMER_INTERVAL;
      const progress = Math.max(0, 100 - (elapsedTime / STORY_DURATION) * 100);
      setTimerProgress(progress);

      if (elapsedTime >= STORY_DURATION) {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        onNextStory();
      }
    };

    timerIntervalRef.current = setInterval(updateTimer, TIMER_INTERVAL);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [open, story, user, onNextStory]);

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
        <DialogContent className="w-screen h-screen max-w-none max-h-none p-0 border-0 bg-black">
          <DialogTitle className="sr-only">Flow viewer</DialogTitle>
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
                            ? `${timerProgress}%`
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
                  {isOwner && (
                    <button
                      onClick={handleOpenViewers}
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

            {/* Media - Full Screen (tap anywhere to go next) */}
            <div
              className="flex-1 flex items-center justify-center relative cursor-pointer"
              onClick={hasNextStory ? onNextStory : undefined}
            >
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

              {/* Incentive Buttons - Right Side (visible to all viewers) */}
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

              {/* Description Overlay */}
              {story.description && (
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10">
                  <p className="text-sm text-white">{story.description}</p>
                </div>
              )}
            </div>

            {/* Bottom Section - Comments */}
            <div className="shrink-0 bg-black/90 border-t border-white/10 p-3 space-y-3 max-h-32 flex flex-col z-20">
              {comments.length > 0 && (
                <div className="overflow-y-auto flex-1 space-y-2 max-h-20">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex items-start gap-2 text-xs">
                      <div className="flex-1">
                        <span className="font-semibold text-white">{comment.userName}</span>
                        <span className="text-white/70 ml-2">{comment.text}</span>
                      </div>
                      {user?.id === comment.userId && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
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
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
            {isLoadingViewers ? (
              <p className="text-sm text-muted-foreground text-center py-6">Carregando...</p>
            ) : viewers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma visualização ainda
              </p>
            ) : (
              viewers.map((viewer) => (
                <div key={viewer.followerId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors">
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
                  {viewer.hasIncentive && (
                    <span className="text-xs text-brand font-medium shrink-0">Incentivou ✨</span>
                  )}
                </div>
              ))
            )}
          </div>
        </DrawerContent>
      </Drawer>
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
