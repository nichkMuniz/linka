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
import { X, ChevronLeft, ChevronRight, Send, Trash2, Eye, Pause, Play, Heart } from "lucide-react";
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
  onSelectStory?: (story: StoryWithUser) => void;
}

export function FlowViewerModal({
  story,
  stories,
  open,
  onOpenChange,
  onNextStory,
  onPrevStory,
  onDeleted,
  onSelectStory,
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

  const isVideo =
    story?.media_url?.includes(".mp4") ||
    story?.media_url?.includes(".webm") ||
    story?.media_url?.includes(".mov") ||
    (story?.media_url?.startsWith("data:") && story?.media_url?.includes("video"));

  // Sort stories: Group by user, sort users by most recent story (DESC), then flatten (ASC within user)
  const sortedStories = React.useMemo(() => {
    const groups: Record<string, StoryWithUser[]> = {};
    stories.forEach((s) => {
      if (!groups[s.user_id]) groups[s.user_id] = [];
      groups[s.user_id].push(s);
    });

    const userLatests = Object.keys(groups).map((uid) => {
      const group = groups[uid];
      const latest = Math.max(...group.map((s) => new Date(s.created_at).getTime()));
      return { uid, latest };
    });

    // Sort users: Most recent activity first
    userLatests.sort((a, b) => b.latest - a.latest);

    const result: StoryWithUser[] = [];
    userLatests.forEach(({ uid }) => {
      // Within each user, sort oldest to newest
      const userGroup = [...groups[uid]].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      result.push(...userGroup);
    });
    return result;
  }, [stories]);

  const currentIndex = story ? sortedStories.findIndex((s) => s.id === story.id) : -1;
  const hasNextStory = currentIndex < sortedStories.length - 1;
  const hasPrevStory = currentIndex > 0;
  const isOwner = story ? user?.id === story.user_id : false;

  // User stories grouping & identification
  const userStories = story ? sortedStories.filter((s) => s.user_id === story.user_id) : [];
  const storyIndexInUser = story ? userStories.findIndex((s) => s.id === story.id) : -1;

  // Previews: Find the first story of each subsequent user in the list
  const upcomingUsersFirstStories = React.useMemo(() => {
    if (!story) return [];
    const users: StoryWithUser[] = [];
    const seen = new Set<string>();
    seen.add(story.user_id); // Exclude current user

    // Start looking from the story after the current index
    for (let i = currentIndex + 1; i < sortedStories.length; i++) {
      const s = sortedStories[i];
      if (!seen.has(s.user_id)) {
        seen.add(s.user_id);
        users.push(s);
      }
      if (users.length >= 2) break; // Only show next 2 users like Instagram
    }
    return users;
  }, [sortedStories, currentIndex, story?.user_id]);

  if (!story) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="w-screen h-screen max-w-none p-0 border-0 bg-black md:bg-black/95 rounded-none overflow-hidden [&>button]:hidden flex items-center justify-center md:top-0 md:left-0 md:translate-x-0 md:translate-y-0 md:ml-0"
        >
          <DialogTitle className="sr-only">Flow viewer</DialogTitle>
          <DialogDescription className="sr-only">Visualizando flow</DialogDescription>

          <div className="relative h-full w-full flex items-center justify-center">
            {/* Close Button - Viewport Top Right */}
            <button
              onClick={() => onOpenChange(false)}
              className="absolute top-6 right-6 z-[70] text-gray-400 hover:text-white transition-colors p-2"
              aria-label="Fechar"
            >
              <X className="h-8 w-8" />
            </button>

            {/* Navigation Arrows (Desktop Only) */}
            {hasPrevStory && (
              <button
                onClick={(e) => { e.stopPropagation(); onPrevStory?.(); }}
                className="hidden md:flex absolute left-8 lg:left-16 z-50 items-center justify-center h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-sm"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}

            {hasNextStory && (
              <button
                onClick={(e) => { e.stopPropagation(); onNextStory(); }}
                className="hidden md:flex absolute right-8 lg:right-16 z-50 items-center justify-center h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-sm"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}

            {/* Layout Wrapper for Previews */}
            <div className="flex items-center gap-10 lg:gap-14">
              {/* Main Story Card */}
              <div className="relative aspect-[9/16] h-full max-h-screen md:max-h-[94vh] w-full md:w-auto bg-black md:rounded-xl overflow-hidden flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/5">
              <div className="relative w-full h-full flex flex-col">
                {/* Header Overlay */}
                <div className="absolute top-0 left-0 right-0 z-40 bg-gradient-to-b from-black/60 to-transparent pt-2 pb-8 px-2 space-y-2">
                  {/* Progress Bar segments */}
                  <div className="flex gap-1">
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
                  <div className="flex items-center justify-between px-2">
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
                          className="h-8 w-8 rounded-full object-cover border border-white/20"
                        />
                      )}
                      <div className="text-left">
                        <p className="text-sm font-semibold text-white drop-shadow-md">{story.userNickname}</p>
                        <p className="text-[10px] text-gray-300 drop-shadow-md">{formatTimeAgo(story.created_at)}</p>
                      </div>
                    </button>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Pause/Play button */}
                      <button
                        onClick={handleTogglePause}
                        className="text-white/90 hover:text-white transition-colors"
                        title={isPaused ? "Retomar" : "Pausar"}
                      >
                        {isPaused ? <Play className="h-5 w-5 fill-white/20" /> : <Pause className="h-5 w-5 fill-white/20" />}
                      </button>
                      {isOwner && (
                        <button
                          onClick={() => { setIsPaused(true); handleOpenViewers(); }}
                          className="text-white/90 hover:text-white transition-colors"
                          title="Ver quem visualizou"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                      )}
                      {isOwner && (
                        <button
                          onClick={handleDeleteStory}
                          disabled={isDeletingStory}
                          className="text-white/90 hover:text-red-400 transition-colors disabled:opacity-50"
                          title="Deletar flow"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Media Container */}
                <div className="flex-1 flex items-center justify-center relative bg-black">
                  {isVideo ? (
                    <video src={story.media_url} className="w-full h-full object-contain" autoPlay loop muted playsInline />
                  ) : (
                    <img src={story.media_url} alt="Flow" className="w-full h-full object-contain" />
                  )}

                  {/* Tap Areas for Navigation (Mobile/Card interaction) */}
                  <div className="absolute inset-0 flex z-30">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); onPrevStory?.(); }}
                    />
                    <div
                      className="flex-[2] cursor-pointer"
                      onClick={handleTogglePause}
                    />
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); onNextStory(); }}
                    />
                  </div>

                  {/* Paused indicator Overlay */}
                  {isPaused && (
                    <div className="absolute inset-0 flex items-center justify-center z-[41] pointer-events-none">
                      <div className="bg-black/40 rounded-full p-4 backdrop-blur-sm">
                        <Play className="h-10 w-10 text-white fill-white/20" />
                      </div>
                    </div>
                  )}

                  {/* Description Overlay */}
                  {story.description && (
                    <div className="absolute bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent z-[42] pointer-events-none">
                      <p className="text-sm text-white drop-shadow-md">{story.description}</p>
                    </div>
                  )}
                </div>

                {/* Bottom Section - Pill Style Input */}
                {showCommentInput && (
                  <div className="shrink-0 pt-2 pb-6 px-4 bg-gradient-to-t from-black/90 to-transparent z-[45]">
                    {/* Compact Comments scroll (if any) */}
                    {comments.length > 0 && (
                      <div className="overflow-y-auto max-h-16 mb-3 scrollbar-hide space-y-1">
                        {comments.slice(-2).map((comment) => (
                          <div key={comment.id} className="flex items-start gap-2 text-[10px]">
                            <span className="font-bold text-white">{comment.userName}</span>
                            <span className="text-white/80 line-clamp-1">{comment.text}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-3 items-center">
                      <div className="flex-1 flex gap-2 items-center bg-transparent border border-white/40 rounded-full px-4 py-2.5 focus-within:border-white transition-colors">
                        <Input
                          type="text"
                          placeholder={isOwner ? "Seu flow..." : `Responder a ${story.userNickname}...`}
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          onFocus={() => setIsTyping(true)}
                          onBlur={() => setIsTyping(false)}
                          onKeyPress={(e) => {
                            if (e.key === "Enter" && newComment.trim()) {
                              handleAddComment();
                            }
                          }}
                          className="flex-1 bg-transparent border-0 text-xs text-white placeholder-white/60 focus:outline-none focus-visible:ring-0 h-auto p-0"
                          disabled={isAddingComment}
                        />

                        {user && (
                          <div className="flex items-center gap-2">
                             <EmojiPicker
                              placement="top"
                              onSelect={(emoji) => setNewComment((prev) => prev + emoji)}
                              triggerClassName="text-white/60 hover:text-white"
                            />
                            {newComment.trim() && (
                              <button
                                onClick={handleAddComment}
                                disabled={isAddingComment}
                                className="text-white font-semibold text-xs transition-opacity hover:opacity-80"
                              >
                                Enviar
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Side Icons like Instagram */}
                      {!isOwner && (
                        <div className="flex items-center gap-4">
                          <button
                             onClick={() => handleToggleLike(1)}
                             className={`transition-transform active:scale-125 ${userLikes.length > 0 ? "text-red-500" : "text-white hover:text-white/80"}`}
                          >
                            <Heart className={`h-6 w-6 ${userLikes.length > 0 ? "fill-current" : ""}`} />
                          </button>
                          <button
                             onClick={() => {}}
                             className="text-white hover:text-white/80 transition-colors"
                          >
                            <Send className="h-6 w-6" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Previews (Desktop Only) */}
            {upcomingUsersFirstStories.length > 0 && (
              <div className="hidden lg:flex items-center gap-6 pr-10">
                {upcomingUsersFirstStories.map((nextStory, idx) => (
                  <div
                    key={nextStory.user_id}
                    className={`relative aspect-[9/16] h-[280px] bg-black rounded-lg overflow-hidden border border-white/10 shadow-lg cursor-pointer group transition-all duration-300 hover:scale-[1.02] hover:opacity-100 ${idx === 0 ? "opacity-70" : "opacity-40"}`}
                    onClick={() => onSelectStory?.(nextStory)}
                  >
                    {/* Media Preview (blurred/darker) */}
                    {nextStory.media_url?.includes(".mp4") ? (
                      <video src={nextStory.media_url} className="w-full h-full object-cover filter brightness-[0.4]" muted playsInline />
                    ) : (
                      <img src={nextStory.media_url} className="w-full h-full object-cover filter brightness-[0.4]" alt="" />
                    )}

                    {/* Profile Overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                      <div className="h-14 w-14 rounded-full border-2 border-brand p-0.5 bg-black transition-transform group-hover:scale-110">
                        {nextStory.userPhoto ? (
                          <img
                            src={nextStory.userPhoto}
                            className="h-full w-full rounded-full object-cover"
                            alt={nextStory.userNickname}
                          />
                        ) : (
                          <div className="h-full w-full rounded-full bg-muted flex items-center justify-center">
                            <span className="text-white text-lg">{nextStory.userNickname?.charAt(0).toUpperCase() || "?"}</span>
                          </div>
                        )}
                      </div>
                      <p className="mt-2 text-white text-[10px] font-bold text-center drop-shadow-md truncate w-full px-2">
                        {nextStory.userNickname}
                      </p>
                    </div>
                  </div>
                ))}
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
