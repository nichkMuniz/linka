import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
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
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  getActiveStoriesDb,
  getUserStoryLikesDb,
  toggleStoryLikeDb,
  getStoryCommentsDb,
  addStoryCommentDb,
  deleteStoryCommentDb,
  updateStoryCommentDb,
  deleteStoryDb,
  recordFlowViewDb,
  getFlowViewersDb,
  type StoryWithUser,
  type PostIncentiveType,
  type StoryComment,
  type FlowViewer,
} from "@/lib/ritmofit-db";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Send,
  Trash2,
  Eye,
  Pause,
  Play,
  Pencil,
  Check,
} from "lucide-react";
import { renderIncentiveIcon } from "@/lib/incentive-config";
import { CommentReactions } from "@/components/shared/comment-reactions";
import { useAuth } from "@/hooks/useAuth";
import { PostIncentiveButton } from "@/components/shared/post-incentive-button";
import { showIncentiveToast } from "@/lib/incentive-toast";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/shared/user-avatar";
import { cdnImg } from "@/lib/image-url";

function sortStoriesInstagram(storiesList: StoryWithUser[]): StoryWithUser[] {
  const groups: Record<string, StoryWithUser[]> = {};
  storiesList.forEach((s) => {
    if (!groups[s.user_id]) groups[s.user_id] = [];
    groups[s.user_id].push(s);
  });
  const userLatests = Object.keys(groups).map((uid) => ({
    uid,
    latest: Math.max(...groups[uid].map((s) => new Date(s.created_at).getTime())),
  }));
  userLatests.sort((a, b) => b.latest - a.latest);
  const sorted: StoryWithUser[] = [];
  userLatests.forEach(({ uid }) => {
    const userGroup = [...groups[uid]].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    sorted.push(...userGroup);
  });
  return sorted;
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
  return date.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
};

export default function FlowViewer() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [allStories, setAllStories] = React.useState<StoryWithUser[]>([]);
  const [loadingStories, setLoadingStories] = React.useState(true);

  const [userLikes, setUserLikes] = React.useState<PostIncentiveType[]>([]);
  const [comments, setComments] = React.useState<StoryComment[]>([]);
  const [newComment, setNewComment] = React.useState("");
  const [isAddingComment, setIsAddingComment] = React.useState(false);
  const [togglingLikeId, setTogglingLikeId] = React.useState<string | null>(null);
  const [timerProgress, setTimerProgress] = React.useState(100);
  const [isTyping, setIsTyping] = React.useState(false);
  const [isDeletingStory, setIsDeletingStory] = React.useState(false);
  const [commentToDelete, setCommentToDelete] = React.useState<string | null>(null);
  const [viewersDrawerOpen, setViewersDrawerOpen] = React.useState(false);
  const [viewers, setViewers] = React.useState<FlowViewer[]>([]);
  const [isLoadingViewers, setIsLoadingViewers] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);
  const [direction, setDirection] = React.useState(0);
  const commentCycleRef = React.useRef<NodeJS.Timeout | null>(null);
  const [floatingBubbles, setFloatingBubbles] = React.useState<Array<{ id: string; comment: StoryComment }>>([]);
  const bubbleKeyRef = React.useRef(0);
  const [commentsDrawerOpen, setCommentsDrawerOpen] = React.useState(false);
  const [editingCommentId, setEditingCommentId] = React.useState<string | null>(null);
  const [editCommentDraft, setEditCommentDraft] = React.useState("");
  const [savingEditCommentId, setSavingEditCommentId] = React.useState<string | null>(null);

  const timerIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  const isTypingRef = React.useRef(false);
  const isPausedRef = React.useRef(false);

  React.useEffect(() => {
    getActiveStoriesDb()
      .then(setAllStories)
      .catch(() => toast({ title: "Erro ao carregar flows", variant: "destructive" }))
      .finally(() => setLoadingStories(false));
  }, []);

  const sortedStories = React.useMemo(() => sortStoriesInstagram(allStories), [allStories]);
  const story = React.useMemo(
    () => sortedStories.find((s) => s.id === storyId) ?? null,
    [sortedStories, storyId],
  );

  React.useEffect(() => {
    if (!loadingStories && !story) {
      navigate("/", { replace: true });
    }
  }, [loadingStories, story, navigate]);

  const currentIndex = story ? sortedStories.findIndex((s) => s.id === story.id) : -1;
  const hasNextStory = currentIndex >= 0 && currentIndex < sortedStories.length - 1;
  const hasPrevStory = currentIndex > 0;
  const isOwner = story ? user?.id === story.user_id : false;
  const userStories = story ? sortedStories.filter((s) => s.user_id === story.user_id) : [];
  const storyIndexInUser = story ? userStories.findIndex((s) => s.id === story.id) : -1;
  const prevStory = hasPrevStory ? sortedStories[currentIndex - 1] : null;
  const nextStory = hasNextStory ? sortedStories[currentIndex + 1] : null;

  const handleNext = React.useCallback(() => {
    setDirection(1);
    if (currentIndex >= 0 && currentIndex < sortedStories.length - 1) {
      navigate(`/flows/${sortedStories[currentIndex + 1].id}`, { replace: true });
    } else {
      navigate("/");
    }
  }, [currentIndex, sortedStories, navigate]);

  const handlePrev = React.useCallback(() => {
    setDirection(-1);
    if (currentIndex > 0) {
      navigate(`/flows/${sortedStories[currentIndex - 1].id}`, { replace: true });
    }
  }, [currentIndex, sortedStories, navigate]);

  const handleClose = React.useCallback(() => {
    navigate("/");
  }, [navigate]);

  const handleNextRef = React.useRef(handleNext);
  React.useEffect(() => { handleNextRef.current = handleNext; }, [handleNext]);

  React.useEffect(() => {
    setFloatingBubbles([]);
    if (commentCycleRef.current) clearInterval(commentCycleRef.current);
    if (comments.length > 0) {
      let idx = 0;
      const firstComment = comments[0];
      const firstKey = ++bubbleKeyRef.current;
      const firstBubbleId = `${firstComment.id}-${firstKey}`;
      setFloatingBubbles([{ id: firstBubbleId, comment: firstComment }]);
      setTimeout(() => {
        setFloatingBubbles((prev) => prev.filter((b) => b.id !== firstBubbleId));
      }, 3500);
      if (comments.length > 1) {
        idx = 1;
        commentCycleRef.current = setInterval(() => {
          const comment = comments[idx % comments.length];
          const key = ++bubbleKeyRef.current;
          const bubbleId = `${comment.id}-${key}`;
          setFloatingBubbles((prev) => [...prev.slice(-2), { id: bubbleId, comment }]);
          setTimeout(() => {
            setFloatingBubbles((prev) => prev.filter((b) => b.id !== bubbleId));
          }, 3500);
          idx++;
        }, 2800);
      }
    }
    return () => {
      if (commentCycleRef.current) clearInterval(commentCycleRef.current);
    };
  }, [comments]);

  React.useEffect(() => {
    isTypingRef.current = isTyping;
  }, [isTyping]);

  React.useEffect(() => {
    isPausedRef.current = isPaused;
    if (videoRef.current) {
      if (isPaused) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [isPaused]);

  React.useEffect(() => {
    if (!story) return;

    setComments([]);
    setUserLikes([]);

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

    if (!isOwner) {
      recordFlowViewDb(story.id, story.user_id).catch((err) =>
        console.error("Error recording flow view:", err),
      );
    }

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
        handleNextRef.current();
      }
    };

    timerIntervalRef.current = setInterval(updateTimer, TIMER_INTERVAL);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [story?.id, isOwner]);

  const handleTogglePause = React.useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  const handleOpenViewers = React.useCallback(async () => {
    if (!story) return;
    setIsPaused(true);
    isPausedRef.current = true;
    setViewersDrawerOpen(true);
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
        setUserLikes((prev) =>
          wasActive ? prev.filter((t) => t !== incentiveType) : [...prev, incentiveType],
        );
        if (!wasActive) showIncentiveToast(incentiveType);
      } catch (err: any) {
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

  const handleStartEditComment = React.useCallback((comment: StoryComment) => {
    setEditingCommentId(comment.id);
    setEditCommentDraft(comment.text);
  }, []);

  const handleCancelEditComment = React.useCallback(() => {
    setEditingCommentId(null);
    setEditCommentDraft("");
  }, []);

  const handleSaveEditComment = React.useCallback(
    async (commentId: string) => {
      if (!editCommentDraft.trim()) return;
      try {
        setSavingEditCommentId(commentId);
        const success = await updateStoryCommentDb(commentId, editCommentDraft);
        if (success) {
          setComments((prev) =>
            prev.map((c) => (c.id === commentId ? { ...c, text: editCommentDraft.trim() } : c)),
          );
          setEditingCommentId(null);
          setEditCommentDraft("");
          toast({ title: "Comentário editado!" });
        }
      } catch (err: any) {
        toast({ title: "Erro ao editar comentário", description: err?.message || "Tente novamente." });
      } finally {
        setSavingEditCommentId(null);
      }
    },
    [editCommentDraft],
  );

  const handleDeleteStory = React.useCallback(async () => {
    if (!story) return;
    if (!confirm("Tem certeza que deseja deletar este flow?")) return;
    setIsDeletingStory(true);
    try {
      const success = await deleteStoryDb(story.id);
      if (success) {
        toast({ title: "Flow deletado", description: "Seu flow foi removido." });
        if (nextStory) {
          navigate(`/flows/${nextStory.id}`, { replace: true });
        } else if (prevStory) {
          navigate(`/flows/${prevStory.id}`, { replace: true });
        } else {
          navigate("/");
        }
      }
    } catch (err: any) {
      toast({ title: "Erro ao deletar", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setIsDeletingStory(false);
    }
  }, [story, navigate, nextStory, prevStory]);

  const isVideo = React.useMemo(() => {
    if (!story?.media_url) return false;
    return (
      story.media_url.includes(".mp4") ||
      story.media_url.includes(".webm") ||
      story.media_url.includes(".mov") ||
      (story.media_url.startsWith("data:") && story.media_url.includes("video"))
    );
  }, [story?.media_url]);

  if (loadingStories) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white/60" />
      </div>
    );
  }

  if (!story) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black z-0 flex items-center justify-center overflow-hidden">
        {/* Desktop: prev card */}
        {prevStory && (
          <div
            className="hidden md:block absolute z-10 rounded-2xl overflow-hidden cursor-pointer transition-opacity duration-200 hover:opacity-90"
            style={{
              height: "92dvh",
              aspectRatio: "9/16",
              right: "calc(50% + 92dvh * 9 / 32 + 12px)",
              top: "50%",
              transform: "translateY(-50%)",
              opacity: 0.6,
              filter: "blur(1px) brightness(0.5)",
            }}
            onClick={handlePrev}
          >
            {prevStory.background_color && !prevStory.media_url ? (
              <div className="w-full h-full" style={{ background: prevStory.background_color }} />
            ) : prevStory.media_url?.includes(".mp4") || prevStory.media_url?.includes(".webm") ? (
              <video src={prevStory.media_url} muted loop playsInline className="w-full h-full object-cover" />
            ) : (
              <img
                src={cdnImg(prevStory.media_url, { width: 800, quality: 70 }) ?? prevStory.media_url}
                className="w-full h-full object-cover"
                alt=""
              />
            )}
            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2">
              <ChevronLeft className="h-8 w-8 text-white/80" />
              <Avatar className="h-12 w-12 border-2 border-white/30">
                <AvatarImage src={prevStory.userPhoto} />
                <AvatarFallback>{prevStory.userNickname?.charAt(0)}</AvatarFallback>
              </Avatar>
              <p className="text-white text-xs font-bold drop-shadow">{prevStory.userNickname}</p>
            </div>
          </div>
        )}

        {/* Main card — mobile: fullscreen, desktop: centered 9:16 */}
        <div className="relative w-full h-full md:w-auto md:h-full md:max-h-[92dvh] md:aspect-[9/16] bg-black md:rounded-2xl overflow-hidden flex flex-col shadow-2xl border-0 md:border md:border-white/10">
          <main className="relative w-full h-full flex flex-col">
            {/* Header overlay */}
            <div
              className="absolute top-0 left-0 right-0 z-[60] pb-12 px-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent"
              style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
            >
              {/* Progress bars */}
              <div className="flex gap-1.5 mb-5 px-1">
                {userStories.map((s, idx) => {
                  const isActive = idx === storyIndexInUser;
                  const isDone = idx < storyIndexInUser;
                  const fillPercent = isDone ? 100 : isActive ? 100 - timerProgress : 0;
                  return (
                    <div key={s.id} className="flex-1 h-[3px] bg-white/15 rounded-full overflow-hidden relative">
                      <motion.div
                        initial={false}
                        animate={{ width: `${fillPercent}%` }}
                        transition={{ duration: isActive ? 0.05 : 0.3, ease: "linear" }}
                        style={
                          isDone || isActive
                            ? { background: "linear-gradient(to right, #3A8DFF, #7B3FF2, #FF8A2A)" }
                            : undefined
                        }
                        className={`h-full rounded-full relative overflow-hidden ${!isDone && !isActive ? "bg-white/40" : ""}`}
                      >
                        {isActive && !isPaused && (
                          <motion.div
                            className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent skew-x-12"
                            animate={{ x: ["-100%", "400%"] }}
                            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.6 }}
                          />
                        )}
                        {isActive && isPaused && (
                          <motion.div
                            className="absolute inset-0 bg-white/30 rounded-full"
                            animate={{ opacity: [0.3, 0.8, 0.3] }}
                            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                          />
                        )}
                      </motion.div>
                    </div>
                  );
                })}
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
                    <button
                      onClick={() => { handleClose(); navigate(`/usuario/${story.user_id}`); }}
                      className="flex items-center gap-3 text-left active:opacity-70 transition-opacity"
                    >
                      <Avatar className="h-10 w-10 border-2 border-white/20 shadow-lg">
                        <AvatarImage src={story.userPhoto} />
                        <AvatarFallback>{story.userNickname?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-white text-sm font-bold drop-shadow-md">{story.userNickname}</span>
                        <span className="text-white/70 text-[10px] drop-shadow-md">{formatTimeAgo(story.created_at)}</span>
                      </div>
                    </button>
                  </motion.div>
                </AnimatePresence>

                <div className="flex items-center gap-1">
                  <button onClick={handleTogglePause} className="text-white/90 hover:text-white p-2">
                    {isPaused ? (
                      <Play className="h-6 w-6 fill-white/20" />
                    ) : (
                      <Pause className="h-6 w-6 fill-white/20" />
                    )}
                  </button>
                  {isOwner && (
                    <>
                      <button onClick={handleOpenViewers} className="text-white/90 hover:text-white p-2">
                        <Eye className="h-6 w-6" />
                      </button>
                      <button
                        onClick={handleDeleteStory}
                        disabled={isDeletingStory}
                        className="text-white/90 hover:text-red-400 p-2 disabled:opacity-50"
                      >
                        <Trash2 className="h-6 w-6" />
                      </button>
                    </>
                  )}
                  <button onClick={handleClose} className="text-white/70 hover:text-white p-2 ml-1">
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>
            </div>

            {/* Media */}
            <div className="flex-1 flex items-center justify-center relative bg-black overflow-hidden">
              <AnimatePresence custom={direction} initial={false} mode="popLayout">
                <motion.div
                  key={story.id}
                  custom={direction}
                  variants={{
                    enter: (d: number) => ({ x: d > 0 ? "100%" : "-100%", opacity: 0, scale: 0.95, filter: "blur(4px)" }),
                    center: { x: 0, opacity: 1, scale: 1, filter: "blur(0px)", zIndex: 1 },
                    exit: (d: number) => ({ x: d > 0 ? "-30%" : "30%", opacity: 0, scale: 1.05, filter: "blur(4px)", zIndex: 0 }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    x: { type: "spring", stiffness: 350, damping: 35 },
                    opacity: { duration: 0.2 },
                    scale: { duration: 0.3 },
                  }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  {story.background_color && !story.media_url ? (
                    <div className="relative w-full h-full" style={{ background: story.background_color }}>
                      {Array.isArray(story.text_elements) && story.text_elements.length > 0 ? (
                        story.text_elements.map((el, idx) => (
                          <div
                            key={idx}
                            className="absolute px-6 max-w-[90%]"
                            style={{ left: `${el.x}%`, top: `${el.y}%`, transform: "translate(-50%, -50%)" }}
                          >
                            <p
                              className="text-white text-center font-bold text-3xl leading-tight break-words whitespace-pre-wrap"
                              style={{ textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}
                            >
                              {el.text}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div
                          className="absolute px-6 max-w-[90%]"
                          style={
                            story.text_position
                              ? { left: `${story.text_position.x}%`, top: `${story.text_position.y}%`, transform: "translate(-50%, -50%)" }
                              : { left: "50%", top: "50%", transform: "translate(-50%, -50%)" }
                          }
                        >
                          <p
                            className="text-white text-center font-bold text-3xl leading-tight break-words"
                            style={{ textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}
                          >
                            {story.description}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : isVideo ? (
                    <video
                      ref={videoRef}
                      src={story.media_url}
                      className="w-full h-full object-cover"
                      autoPlay
                      loop
                      muted
                      playsInline
                      preload="auto"
                    />
                  ) : (
                    <img
                      src={cdnImg(story.media_url, { width: 1920, quality: 90 }) ?? story.media_url}
                      alt="Flow"
                      className="w-full h-full object-cover"
                    />
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Navigation tap zones */}
              <div className="absolute inset-0 flex z-[55]">
                <div className="flex-1 cursor-pointer" onClick={(e) => { e.stopPropagation(); handlePrev(); }} />
                <div className="flex-[2] cursor-pointer" onClick={handleTogglePause} />
                <div className="flex-1 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleNext(); }} />
              </div>

              {isPaused && (
                <div className="absolute inset-0 flex items-center justify-center z-[56] pointer-events-none">
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-black/40 p-5 rounded-full backdrop-blur-md border border-white/10"
                  >
                    <Play className="h-12 w-12 text-white fill-white/20" />
                  </motion.div>
                </div>
              )}

              {story.description && !(story.background_color && !story.media_url) && (
                <div className="absolute bottom-0 left-0 right-0 px-4 pt-8 pb-3 bg-gradient-to-t from-black/80 to-transparent z-[56] pointer-events-none">
                  <p className="text-sm text-white drop-shadow-md leading-relaxed">{story.description}</p>
                </div>
              )}

              {/* Floating comment bubbles */}
              <div className="absolute left-3 bottom-20 z-[57] flex flex-col gap-2 items-start max-w-[80%] pointer-events-none">
                <AnimatePresence>
                  {floatingBubbles.map(({ id, comment }) => (
                    <motion.button
                      key={id}
                      className="pointer-events-auto flex items-center gap-2 bg-black/50 backdrop-blur-md rounded-2xl px-3 py-2 border border-white/15 shadow-lg text-left active:scale-95 transition-transform"
                      initial={{ opacity: 0, x: -24, scale: 0.9 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -16, scale: 0.92 }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                      onClick={() => {
                        setIsPaused(true);
                        isPausedRef.current = true;
                        setCommentsDrawerOpen(true);
                      }}
                    >
                      <div className="shrink-0 h-6 w-6 rounded-full overflow-hidden ring-1 ring-white/30">
                        <UserAvatar photo={comment.userPhoto} nickname={comment.userName} className="h-full w-full" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-bold text-white leading-tight drop-shadow">
                          {comment.userName}
                          {comment.userHandle && (
                            <span className="font-normal text-white/60"> @{comment.userHandle.replace(/^@/, "")}</span>
                          )}
                        </span>
                        <span className="text-[11px] text-white/90 leading-snug drop-shadow line-clamp-2">
                          {comment.text}
                        </span>
                      </div>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            {/* Bottom section */}
            <div
              className="shrink-0 pt-2 px-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-[60]"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
            >
              {user && (
                <motion.div className="flex justify-around items-center mb-3">
                  {([1, 2, 3, 4, 5, 6] as PostIncentiveType[]).map((type) => {
                    const isLiked = userLikes.includes(type);
                    return (
                      <motion.div key={type} whileTap={{ scale: 1.4 }} animate={isLiked ? { scale: [1, 1.2, 1] } : {}}>
                        <PostIncentiveButton
                          type={type}
                          isActive={isLiked}
                          loading={togglingLikeId === story.id}
                          onClick={() => handleToggleLike(type)}
                        />
                      </motion.div>
                    );
                  })}
                </motion.div>
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
                </div>
                <motion.button
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || isAddingComment}
                  className="bg-brand text-white p-3 rounded-full shadow-lg disabled:opacity-40"
                >
                  <Send className="h-5 w-5" />
                </motion.button>
              </div>
            </div>
          </main>
        </div>

        {/* Desktop: next card */}
        {nextStory && (
          <div
            className="hidden md:block absolute z-10 rounded-2xl overflow-hidden cursor-pointer transition-opacity duration-200 hover:opacity-90"
            style={{
              height: "92dvh",
              aspectRatio: "9/16",
              left: "calc(50% + 92dvh * 9 / 32 + 12px)",
              top: "50%",
              transform: "translateY(-50%)",
              opacity: 0.6,
              filter: "blur(1px) brightness(0.5)",
            }}
            onClick={handleNext}
          >
            {nextStory.background_color && !nextStory.media_url ? (
              <div className="w-full h-full" style={{ background: nextStory.background_color }} />
            ) : nextStory.media_url?.includes(".mp4") || nextStory.media_url?.includes(".webm") ? (
              <video src={nextStory.media_url} muted loop playsInline className="w-full h-full object-cover" />
            ) : (
              <img src={nextStory.media_url} className="w-full h-full object-cover" alt="" />
            )}
            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2">
              <ChevronRight className="h-8 w-8 text-white/80" />
              <Avatar className="h-12 w-12 border-2 border-white/30">
                <AvatarImage src={nextStory.userPhoto} />
                <AvatarFallback>{nextStory.userNickname?.charAt(0)}</AvatarFallback>
              </Avatar>
              <p className="text-white text-xs font-bold drop-shadow">{nextStory.userNickname}</p>
            </div>
          </div>
        )}
      </div>

      {/* Comments Drawer */}
      <Drawer
        open={commentsDrawerOpen}
        onOpenChange={(o) => {
          setCommentsDrawerOpen(o);
          if (!o) {
            setIsPaused(false);
            isPausedRef.current = false;
          }
        }}
        noBodyStyles
        shouldScaleBackground={false}
      >
        <DrawerContent
          className="flex flex-col"
          style={{ maxHeight: "88dvh" }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2 pt-2">
              Comentários ({comments.length})
            </DrawerTitle>
            <DrawerDescription className="sr-only">Lista de comentários do flow</DrawerDescription>
          </DrawerHeader>
          <div
            className="flex-1 overflow-y-auto overscroll-contain px-4 space-y-4"
            style={{ paddingBottom: "max(3rem, env(safe-area-inset-bottom))" }}
          >
            {comments.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">Nenhum comentário ainda</p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="flex flex-col gap-1.5">
                  <div className="flex items-start justify-between group">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div className="shrink-0 h-8 w-8 rounded-full overflow-hidden">
                        <UserAvatar photo={comment.userPhoto} nickname={comment.userName} className="h-full w-full" />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm font-bold leading-tight">
                          {comment.userName}
                          {comment.userHandle && (
                            <span className="font-normal text-muted-foreground">
                              {" "}@{comment.userHandle.replace(/^@/, "")}
                            </span>
                          )}
                        </span>
                        {editingCommentId === comment.id ? (
                          <div className="mt-1 flex flex-col gap-1.5">
                            <textarea
                              value={editCommentDraft}
                              onChange={(e) => setEditCommentDraft(e.target.value)}
                              className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-h-16"
                              disabled={savingEditCommentId === comment.id}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey && editCommentDraft.trim()) {
                                  e.preventDefault();
                                  handleSaveEditComment(comment.id);
                                }
                                if (e.key === "Escape") handleCancelEditComment();
                              }}
                            />
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleSaveEditComment(comment.id)}
                                disabled={!editCommentDraft.trim() || savingEditCommentId === comment.id}
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                <Check className="h-3 w-3" />
                                Salvar
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEditComment}
                                disabled={savingEditCommentId === comment.id}
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50 transition-colors"
                              >
                                <X className="h-3 w-3" />
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm leading-normal break-words">{comment.text}</span>
                        )}
                      </div>
                    </div>
                    {user?.id === comment.userId && editingCommentId !== comment.id && (
                      <div className="flex shrink-0 gap-0.5 ml-2">
                        <button
                          onClick={() => handleStartEditComment(comment)}
                          className="text-muted-foreground hover:text-foreground p-1"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setCommentToDelete(comment.id)}
                          className="text-muted-foreground hover:text-red-400 p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  <CommentReactions
                    commentType="flow"
                    commentId={comment.id}
                    commentOwnerId={comment.userId}
                    sourceId={story.id}
                    isOwnComment={user?.id === comment.userId}
                  />
                </div>
              ))
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Viewers Drawer */}
      <Drawer open={viewersDrawerOpen} onOpenChange={setViewersDrawerOpen}>
        <DrawerContent className="max-h-[85vh]" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2 pt-2">
              <Eye className="h-5 w-5" />
              Visualizações ({viewers.length})
            </DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-12 space-y-3">
            {isLoadingViewers ? (
              <div className="py-10 flex justify-center">
                <div className="animate-spin rounded-full h-7 w-7 border-t-2 border-brand" />
              </div>
            ) : viewers.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">Nenhuma visualização</p>
            ) : (
              viewers.map((viewer) => (
                <div key={viewer.followerId} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                  <div className="h-10 w-10 rounded-full overflow-hidden shrink-0">
                    <UserAvatar photo={viewer.userPhoto} nickname={viewer.userNickname} className="h-full w-full" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{viewer.userNickname}</p>
                    <p className="text-[10px] text-muted-foreground">{formatTimeAgo(viewer.viewedAt)}</p>
                  </div>
                  {viewer.incentiveTypes.length > 0 && (
                    <div className="flex gap-0.5">
                      {viewer.incentiveTypes.map((t, i) => renderIncentiveIcon(t, "h-3.5 w-3.5", i))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Delete Comment Dialog */}
      <AlertDialog open={!!commentToDelete} onOpenChange={(o) => !o && setCommentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover comentário?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => commentToDelete && handleDeleteComment(commentToDelete)}
              className="bg-red-500 hover:bg-red-600"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
