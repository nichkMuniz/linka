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
import { X, ChevronLeft, ChevronRight, Send, Trash2, Eye, Pause, Play, Heart, Flame, Trophy, TrendingUp, Dumbbell, Zap, MoreHorizontal } from "lucide-react";
import { CommentReactions } from "@/components/shared/comment-reactions";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { PostIncentiveButton } from "@/components/shared/post-incentive-button";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { EmojiPicker } from "@/components/shared/emoji-picker";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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

const formatTimeAgo = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return "agora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
};

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
  const [direction, setDirection] = React.useState(0);
  const [prevStoryId, setPrevStoryId] = React.useState<string | null>(null);

  const timerIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = React.useRef(false);
  const isPausedRef = React.useRef(false);
  const onNextStoryRef = React.useRef(onNextStory);

  React.useEffect(() => {
    isTypingRef.current = isTyping;
  }, [isTyping]);

  React.useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Keep handleNext wrap for direction tracking
  const handleNext = React.useCallback(() => {
    setDirection(1);
    onNextStory();
  }, [onNextStory]);

  const handlePrev = React.useCallback(() => {
    setDirection(-1);
    onPrevStory?.();
  }, [onPrevStory]);

  React.useEffect(() => {
    onNextStoryRef.current = handleNext;
  }, [handleNext]);

  React.useEffect(() => {
    if (story?.id !== prevStoryId) {
      setPrevStoryId(story?.id || null);
    }
  }, [story?.id, prevStoryId]);

  React.useEffect(() => {
    if (!open || !story) return;

    const loadStoryData = async () => {
      try {
        const [userLikesData, commentsData] = await Promise.all([
          getUserStoryLikesDb(story.id),
          getStoryCommentsDb(story.id),
        ]);

        setUserLikes(userLikesData);
        setComments(commentsData);
      } catch (err) {
        console.error("Error loading story data:", err);
      }
    };

    loadStoryData();

    recordFlowViewDb(story.id, story.user_id).catch((err) =>
      console.error("Error recording flow view:", err),
    );

    setTimerProgress(100);
    setIsPaused(false);
    isPausedRef.current = false;

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    const STORY_DURATION = 8000;
    const TIMER_INTERVAL = 50;
    let elapsedTime = 0;

    const updateTimer = () => {
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
    setIsPaused(true);
    isPausedRef.current = true;
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
        setUserLikes(prev => wasActive ? prev.filter(t => t !== incentiveType) : [...prev, incentiveType]);
      } catch (err: any) {
        console.error("Error toggling like:", err);
        toast({ title: "Erro ao reagir", description: err?.message || "Tente novamente." });
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
      toast({ title: "Erro ao comentar", description: err?.message || "Tente novamente." });
    } finally {
      setIsAddingComment(false);
    }
  }, [story, user, newComment]);

  const handleDeleteComment = React.useCallback(async (commentId: string) => {
    try {
      const success = await deleteStoryCommentDb(commentId);
      if (success) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        setCommentToDelete(null);
      }
    } catch (err: any) {
      console.error("Error deleting comment:", err);
    }
  }, []);

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
      toast({ title: "Erro ao deletar", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setIsDeletingStory(false);
    }
  }, [story, onOpenChange, onDeleted]);

  const isVideo = React.useMemo(() => {
    if (!story?.media_url) return false;
    return story.media_url.includes(".mp4") || story.media_url.includes(".webm") || story.media_url.includes(".mov") || (story.media_url.startsWith("data:") && story.media_url.includes("video"));
  }, [story?.media_url]);

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
    userLatests.sort((a, b) => b.latest - a.latest);
    const result: StoryWithUser[] = [];
    userLatests.forEach(({ uid }) => {
      const userGroup = [...groups[uid]].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      result.push(...userGroup);
    });
    return result;
  }, [stories]);

  const currentIndex = story ? sortedStories.findIndex((s) => s.id === story.id) : -1;
  const hasNextStory = currentIndex < sortedStories.length - 1;
  const hasPrevStory = currentIndex > 0;
  const isOwner = story ? user?.id === story.user_id : false;
  const userStories = story ? sortedStories.filter((s) => s.user_id === story.user_id) : [];
  const storyIndexInUser = story ? userStories.findIndex((s) => s.id === story.id) : -1;

  const upcomingUsersFirstStories = React.useMemo(() => {
    if (!story) return [];
    const users: StoryWithUser[] = [];
    const seen = new Set<string>();
    seen.add(story.user_id);
    for (let i = currentIndex + 1; i < sortedStories.length; i++) {
      const s = sortedStories[i];
      if (!seen.has(s.user_id)) {
        seen.add(s.user_id);
        users.push(s);
      }
      if (users.length >= 2) break;
    }
    return users;
  }, [sortedStories, currentIndex, story?.user_id]);

  if (!story) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-screen h-screen max-w-none p-0 border-0 bg-black md:bg-black/95 rounded-none overflow-hidden [&>button]:hidden flex items-center justify-center">
          <DialogTitle className="sr-only">Flow viewer</DialogTitle>
          <DialogDescription className="sr-only">Visualizando flow</DialogDescription>

          <div className="relative h-full w-full flex items-center justify-center overflow-hidden">
            {hasPrevStory && (
              <button
                onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                className="hidden md:flex absolute left-8 lg:left-16 z-[100] items-center justify-center h-14 w-14 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-md border border-white/5"
              >
                <ChevronLeft className="h-8 w-8" />
              </button>
            )}

            {hasNextStory && (
              <button
                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                className="hidden md:flex absolute right-8 lg:right-16 z-[100] items-center justify-center h-14 w-14 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-md border border-white/5"
              >
                <ChevronRight className="h-8 w-8" />
              </button>
            )}

            <div className="flex items-center gap-10 lg:gap-14 md:pt-4 md:pb-4 w-full h-full md:w-auto md:h-[95vh]">
              {/* Main Card */}
              <div className="relative w-full h-full md:aspect-[3/4] md:h-[95vh] md:w-auto bg-black md:rounded-2xl overflow-hidden flex flex-col shadow-2xl border-0 md:border md:border-white/10">
                <main className="relative w-full h-full flex flex-col">
                  {/* Header Overlay */}
                  <div className="absolute top-0 left-0 right-0 z-[60] pt-3 pb-12 px-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
                    {/* Progress Bar */}
                    <div className="flex gap-1.5 mb-5 px-1">
                      {userStories.map((s, idx) => (
                        <div key={s.id} className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                          <motion.div
                            initial={false}
                            animate={{
                              width: idx < storyIndexInUser ? "100%" : idx === storyIndexInUser ? `${100 - timerProgress}%` : "0%"
                            }}
                            transition={{ duration: idx === storyIndexInUser ? 0.05 : 0.3, ease: "linear" }}
                            className="h-full bg-white"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.div
                          key={story.user_id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className="flex items-center gap-3"
                        >
                          <Avatar className="h-10 w-10 border-2 border-white/20 shadow-lg">
                            <AvatarImage src={story.userPhoto} />
                            <AvatarFallback>{story.userNickname?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="text-white text-sm font-bold drop-shadow-md">{story.userNickname}</span>
                            <span className="text-white/70 text-[10px] drop-shadow-md">{formatTimeAgo(story.created_at)}</span>
                          </div>
                        </motion.div>
                      </AnimatePresence>

                      <div className="flex items-center gap-1">
                        <button onClick={handleTogglePause} className="text-white/90 hover:text-white p-2">
                          {isPaused ? <Play className="h-6 w-6 fill-white/20" /> : <Pause className="h-6 w-6 fill-white/20" />}
                        </button>
                        {isOwner && (
                          <>
                            <button onClick={handleOpenViewers} className="text-white/90 hover:text-white p-2">
                              <Eye className="h-6 w-6" />
                            </button>
                            <button onClick={handleDeleteStory} className="text-white/90 hover:text-red-400 p-2">
                              <Trash2 className="h-6 w-6" />
                            </button>
                          </>
                        )}
                        <button onClick={() => onOpenChange(false)} className="text-white/70 hover:text-white p-2 ml-1">
                          <X className="h-6 w-6" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Media Content */}
                  <div className="flex-1 flex items-center justify-center relative bg-black overflow-hidden">
                    <AnimatePresence custom={direction} initial={false} mode="popLayout">
                      <motion.div
                        key={story.id}
                        custom={direction}
                        variants={{
                          enter: (d: number) => ({ x: d > 0 ? "100%" : "-100%", opacity: 0, scale: 0.95, filter: "blur(4px)" }),
                          center: { x: 0, opacity: 1, scale: 1, filter: "blur(0px)", zIndex: 1 },
                          exit: (d: number) => ({ x: d > 0 ? "-30%" : "30%", opacity: 0, scale: 1.05, filter: "blur(4px)", zIndex: 0 })
                        }}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ 
                          x: { type: "spring", stiffness: 350, damping: 35 },
                          opacity: { duration: 0.2 },
                          scale: { duration: 0.3 }
                        }}
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        {isVideo ? (
                          <video src={story.media_url} className="w-full h-full object-contain" autoPlay loop muted playsInline preload="auto" />
                        ) : (
                          <img src={story.media_url} alt="Flow" className="w-full h-full object-contain" />
                        )}
                      </motion.div>
                    </AnimatePresence>

                    {/* Navigation Tap Overlay */}
                    <div className="absolute inset-0 flex z-[55]">
                      <div className="flex-1 cursor-pointer" onClick={(e) => { e.stopPropagation(); handlePrev(); }} />
                      <div className="flex-[2] cursor-pointer" onClick={handleTogglePause} />
                      <div className="flex-1 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleNext(); }} />
                    </div>

                    {/* Paused Icon */}
                    {isPaused && (
                      <div className="absolute inset-0 flex items-center justify-center z-[56] pointer-events-none">
                        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-black/40 p-5 rounded-full backdrop-blur-md border border-white/10">
                          <Play className="h-12 w-12 text-white fill-white/20" />
                        </motion.div>
                      </div>
                    )}

                    {/* Description Overlay */}
                    {story.description && (
                      <div className="absolute bottom-[100px] left-0 right-16 p-4 bg-gradient-to-t from-black/80 to-transparent z-[56] pointer-events-none">
                        <p className="text-sm text-white drop-shadow-md leading-relaxed">{story.description}</p>
                      </div>
                    )}

                    {/* Side Actions (Like Icons) */}
                    {user && (
                      <motion.div className="absolute right-3 bottom-32 flex flex-col gap-4 z-[57]">
                        {([1, 2, 3, 4, 5, 6] as PostIncentiveType[]).map((type) => {
                          const isLiked = userLikes.includes(type);
                          return (
                            <motion.div key={type} whileTap={{ scale: 1.4 }} animate={isLiked ? { scale: [1, 1.2, 1] } : {}}>
                              <PostIncentiveButton type={type} isActive={isLiked} loading={togglingLikeId === story.id} onClick={() => handleToggleLike(type)} />
                            </motion.div>
                          );
                        })}
                      </motion.div>
                    )}
                  </div>

                  {/* Bottom Comment Section */}
                  <div className="shrink-0 pt-2 pb-6 px-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-[60]">
                    {comments.length > 0 && (
                      <div className="overflow-y-auto max-h-32 mb-4 scrollbar-hide space-y-4">
                        {comments.map((comment) => (
                          <div key={comment.id} className="flex flex-col gap-1.5">
                            <div className="flex items-start justify-between group">
                              <div className="flex items-start gap-2.5">
                                <span className="text-[10px] font-bold text-white shrink-0">{comment.userName}</span>
                                <span className="text-[10px] text-white/90 leading-normal">{comment.text}</span>
                              </div>
                              {user?.id === comment.userId && (
                                <button onClick={() => setCommentToDelete(comment.id)} className="text-white/30 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                            <CommentReactions commentType="flow" commentId={comment.id} commentOwnerId={comment.userId} sourceId={story.id} dark isOwnComment={user?.id === comment.userId} />
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-3 items-center">
                      <div className="flex-1 flex gap-2 items-center bg-white/5 border border-white/20 rounded-full px-4 py-3 focus-within:border-white/50 transition-all backdrop-blur-sm">
                        <Input
                          placeholder={isOwner ? "Seu flow..." : `Responder a ${story.userNickname}...`}
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          onFocus={() => setIsTyping(true)}
                          onBlur={() => setIsTyping(false)}
                          onKeyPress={(e) => e.key === "Enter" && newComment.trim() && handleAddComment()}
                          className="flex-1 bg-transparent border-0 text-xs text-white placeholder-white/50 focus-visible:ring-0 h-auto p-0"
                          disabled={isAddingComment}
                        />
                        <EmojiPicker onSelect={(emoji) => setNewComment(prev => prev + emoji)} triggerClassName="text-white/40 hover:text-white" />
                      </div>
                      <motion.button onClick={handleAddComment} disabled={!newComment.trim() || isAddingComment} className="bg-brand text-white p-3 rounded-full shadow-lg disabled:opacity-40">
                        <Send className="h-5 w-5" />
                      </motion.button>
                    </div>
                  </div>
                </main>
              </div>

              {/* Side Previews */}
              {upcomingUsersFirstStories.length > 0 && (
                <div className="hidden lg:flex flex-col gap-6 pr-10">
                  {upcomingUsersFirstStories.map((nextStory, idx) => (
                    <motion.div
                      key={nextStory.user_id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: idx === 0 ? 0.7 : 0.4, x: 0 }}
                      whileHover={{ scale: 1.05, opacity: 1 }}
                      className="relative aspect-[3/4] h-[400px] bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl cursor-pointer group"
                      onClick={() => onSelectStory?.(nextStory)}
                    >
                      <div className="absolute inset-0 bg-black/40 group-hover:bg-transparent transition-colors z-10" />
                      {nextStory.media_url?.includes(".mp4") ? (
                        <video src={nextStory.media_url} className="w-full h-full object-cover grayscale-[30%] brightness-[0.6] group-hover:grayscale-0 group-hover:brightness-100 transition-all" muted playsInline />
                      ) : (
                        <img src={nextStory.media_url} className="w-full h-full object-cover grayscale-[30%] brightness-[0.6] group-hover:grayscale-0 group-hover:brightness-100 transition-all" alt="" />
                      )}
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 z-20">
                        <Avatar className="h-14 w-14 border-2 border-brand p-0.5 bg-black">
                          <AvatarImage src={nextStory.userPhoto} />
                          <AvatarFallback>{nextStory.userNickname?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <p className="mt-2 text-white text-[10px] font-bold truncate w-full text-center drop-shadow-md">{nextStory.userNickname}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Viewers Drawer */}
      <Drawer open={viewersModalOpen} onOpenChange={setViewersModalOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2 pt-2">
              <Eye className="h-5 w-5" />
              Visualizações ({viewers.length})
            </DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-12 space-y-3">
            {isLoadingViewers ? (
              <div className="py-10 flex justify-center"><div className="animate-spin rounded-full h-7 w-7 border-t-2 border-brand" /></div>
            ) : viewers.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">Nenhuma visualização</p>
            ) : (
              viewers.map(viewer => (
                <div key={viewer.followerId} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={viewer.userPhoto} />
                    <AvatarFallback>{viewer.userNickname?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{viewer.userNickname}</p>
                    <p className="text-[10px] text-muted-foreground">{formatTimeAgo(viewer.viewedAt)}</p>
                  </div>
                  {viewer.incentiveTypes.length > 0 && (
                    <div className="flex gap-0.5">
                      {viewer.incentiveTypes.map((t, i) => <Zap key={i} className="h-3 w-3 text-brand fill-brand/20" />)}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Delete Comment Dialog */}
      <AlertDialog open={!!commentToDelete} onOpenChange={o => !o && setCommentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover comentário?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => commentToDelete && handleDeleteComment(commentToDelete)} className="bg-red-500 hover:bg-red-600">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
