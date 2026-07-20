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
import { useKeyboardInputScroll } from "@/hooks/use-keyboard-input-scroll";
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
  Play,
  Pencil,
  Check,
  ChevronUp,
} from "lucide-react";
import {
  renderIncentiveIcon,
  INCENTIVE_CONFIG,
  INCENTIVE_TYPES,
} from "@/lib/incentive-config";
import { CommentReactions } from "@/components/shared/comment-reactions";
import { useAuth } from "@/hooks/useAuth";
import { hapticLight } from "@/lib/haptics";
import { showIncentiveToast } from "@/lib/incentive-toast";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/shared/user-avatar";
import { cdnImg } from "@/lib/image-url";

function sortStoriesInstagram(storiesList: StoryWithUser[], currentUserId?: string): StoryWithUser[] {
  const groups: Record<string, StoryWithUser[]> = {};
  storiesList.forEach((s) => {
    if (!groups[s.user_id]) groups[s.user_id] = [];
    groups[s.user_id].push(s);
  });
  const userLatests = Object.keys(groups).map((uid) => ({
    uid,
    latest: Math.max(...groups[uid].map((s) => new Date(s.created_at).getTime())),
  }));
  // O próprio flow do usuário sempre vem primeiro (mesmo comportamento do FlowCarousel);
  // os demais seguem ordenados pelo flow mais recente primeiro, para que "avançar"
  // a partir do próprio flow leve sempre ao flow mais recentemente postado.
  userLatests.sort((a, b) => {
    if (a.uid === currentUserId) return -1;
    if (b.uid === currentUserId) return 1;
    return b.latest - a.latest;
  });
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
  const [restartKey, setRestartKey] = React.useState(0);
  // Responder o flow já sobe com o teclado (doca com transform próprio). Este hook
  // cobre a textarea de EDIÇÃO inline dentro da lista de comentários.
  useKeyboardInputScroll();

  const timerIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const videoRafRef = React.useRef<number | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const swipeTouchStartRef = React.useRef<{ x: number; y: number } | null>(null);
  // Marca que o toque atual foi consumido por um swipe (horizontal/vertical),
  // para que o clique de compatibilidade nas zonas de toque não dispare também.
  const swipeHandledRef = React.useRef(false);
  const holdTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const isPausedByHoldRef = React.useRef(false);
  const holdFiredRef = React.useRef(false);
  const holdPointerStartRef = React.useRef<{ x: number; y: number } | null>(null);

  const isTypingRef = React.useRef(false);
  const isPausedRef = React.useRef(false);

  React.useEffect(() => {
    getActiveStoriesDb()
      .then(setAllStories)
      .catch(() => toast({ title: "Erro ao carregar flows", variant: "destructive" }))
      .finally(() => setLoadingStories(false));
  }, []);

  const sortedStories = React.useMemo(
    () => sortStoriesInstagram(allStories, user?.id),
    [allStories, user?.id],
  );
  const story = React.useMemo(
    () => sortedStories.find((s) => s.id === storyId) ?? null,
    [sortedStories, storyId],
  );

  const isVideo = React.useMemo(() => {
    if (!story?.media_url) return false;
    return (
      story.media_url.includes(".mp4") ||
      story.media_url.includes(".webm") ||
      story.media_url.includes(".mov") ||
      (story.media_url.startsWith("data:") && story.media_url.includes("video"))
    );
  }, [story?.media_url]);

  React.useEffect(() => {
    if (!loadingStories && !story) {
      navigate("/", { replace: true });
    }
  }, [loadingStories, story, navigate]);

  const currentIndex = story ? sortedStories.findIndex((s) => s.id === story.id) : -1;
  const isOwner = story ? user?.id === story.user_id : false;
  const viewingOwnStories = story ? story.user_id === user?.id : false;
  const userStories = story ? sortedStories.filter((s) => s.user_id === story.user_id) : [];
  const storyIndexInUser = story ? userStories.findIndex((s) => s.id === story.id) : -1;

  const nextStory = React.useMemo(() => {
    if (currentIndex < 0) return null;
    let nextIdx = currentIndex + 1;
    if (!viewingOwnStories) {
      while (nextIdx < sortedStories.length && sortedStories[nextIdx].user_id === user?.id) nextIdx++;
    }
    return nextIdx < sortedStories.length ? sortedStories[nextIdx] : null;
  }, [currentIndex, sortedStories, viewingOwnStories, user]);

  const prevStory = React.useMemo(() => {
    if (currentIndex <= 0) return null;
    let prevIdx = currentIndex - 1;
    if (!viewingOwnStories) {
      while (prevIdx >= 0 && sortedStories[prevIdx].user_id === user?.id) prevIdx--;
    }
    return prevIdx >= 0 ? sortedStories[prevIdx] : null;
  }, [currentIndex, sortedStories, viewingOwnStories, user]);

  const hasNextStory = nextStory !== null;
  const hasPrevStory = prevStory !== null;

  const handleNext = React.useCallback(() => {
    setDirection(1);
    if (currentIndex < 0) { navigate("/"); return; }
    const viewingOwnStories = story?.user_id === user?.id;
    let nextIdx = currentIndex + 1;
    if (!viewingOwnStories) {
      while (nextIdx < sortedStories.length && sortedStories[nextIdx].user_id === user?.id) {
        nextIdx++;
      }
    }
    if (nextIdx < sortedStories.length) {
      navigate(`/flows/${sortedStories[nextIdx].id}`, { replace: true });
    } else {
      navigate("/");
    }
  }, [currentIndex, sortedStories, navigate, story, user]);

  const handlePrev = React.useCallback(() => {
    setDirection(-1);
    if (currentIndex <= 0) return;
    const viewingOwnStories = story?.user_id === user?.id;
    let prevIdx = currentIndex - 1;
    if (!viewingOwnStories) {
      while (prevIdx >= 0 && sortedStories[prevIdx].user_id === user?.id) {
        prevIdx--;
      }
    }
    if (prevIdx >= 0) {
      navigate(`/flows/${sortedStories[prevIdx].id}`, { replace: true });
    }
  }, [currentIndex, sortedStories, navigate, story, user]);

  // Swipe (direita → esquerda): pula direto para o PRÓXIMO usuário, descartando
  // os flows restantes do usuário atual — estilo Instagram. Diferente do toque na
  // zona direita (`handleNext`), que avança flow a flow dentro do mesmo usuário.
  const handleNextUser = React.useCallback(() => {
    setDirection(1);
    if (currentIndex < 0) { navigate("/"); return; }
    const curUserId = story?.user_id;
    let idx = currentIndex + 1;
    // pula todos os flows restantes do usuário atual
    while (idx < sortedStories.length && sortedStories[idx].user_id === curUserId) idx++;
    // ao ver flow de outro usuário, o próprio flow do logado fica sempre no início
    // da lista e nunca reaparece adiante — checagem defensiva, consistente com handleNext
    if (curUserId !== user?.id) {
      while (idx < sortedStories.length && sortedStories[idx].user_id === user?.id) idx++;
    }
    if (idx < sortedStories.length) {
      navigate(`/flows/${sortedStories[idx].id}`, { replace: true });
    } else {
      navigate("/");
    }
  }, [currentIndex, sortedStories, navigate, story, user]);

  // Swipe (esquerda → direita): volta para o PRIMEIRO flow do usuário anterior.
  const handlePrevUser = React.useCallback(() => {
    setDirection(-1);
    if (currentIndex < 0) return;
    const curUserId = story?.user_id;
    let idx = currentIndex - 1;
    // sai do grupo do usuário atual
    while (idx >= 0 && sortedStories[idx].user_id === curUserId) idx--;
    // pula flows do próprio usuário logado ao voltar (consistente com handlePrev)
    if (curUserId !== user?.id) {
      while (idx >= 0 && sortedStories[idx].user_id === user?.id) idx--;
    }
    if (idx < 0) {
      // não há usuário anterior — reinicia o usuário atual a partir do primeiro flow
      let firstIdx = currentIndex;
      while (firstIdx - 1 >= 0 && sortedStories[firstIdx - 1].user_id === curUserId) firstIdx--;
      if (firstIdx !== currentIndex) {
        navigate(`/flows/${sortedStories[firstIdx].id}`, { replace: true });
      }
      return;
    }
    // idx aponta para o último flow do usuário anterior; recua até o primeiro flow dele
    const prevUserId = sortedStories[idx].user_id;
    while (idx - 1 >= 0 && sortedStories[idx - 1].user_id === prevUserId) idx--;
    navigate(`/flows/${sortedStories[idx].id}`, { replace: true });
  }, [currentIndex, sortedStories, navigate, story, user]);

  const handleClose = React.useCallback(() => {
    navigate("/");
  }, [navigate]);

  const handleNextRef = React.useRef(handleNext);
  React.useEffect(() => { handleNextRef.current = handleNext; }, [handleNext]);

  React.useEffect(() => {
    setFloatingBubbles([]);
    if (commentCycleRef.current) clearInterval(commentCycleRef.current);
    if (comments.length > 0) {
      const firstKey = ++bubbleKeyRef.current;
      const firstComment = comments[0];
      setFloatingBubbles([{ id: `${firstComment.id}-${firstKey}`, comment: firstComment }]);
      if (comments.length > 1) {
        let idx = 1;
        commentCycleRef.current = setInterval(() => {
          const comment = comments[idx % comments.length];
          const key = ++bubbleKeyRef.current;
          // Substitui pelo próximo comentário; sem timeout de remoção — fica sempre visível
          setFloatingBubbles([{ id: `${comment.id}-${key}`, comment }]);
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
    if (isVideo && videoRef.current) {
      if (isTyping) {
        videoRef.current.pause();
      } else if (!isPausedRef.current) {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [isTyping, isVideo]);

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

  // Carrega dados (likes/comentários) e registra view apenas ao trocar de story
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
  }, [story?.id, isOwner]);

  // Timer separado — roda ao trocar de story OU ao reiniciar (restartKey)
  React.useEffect(() => {
    if (!story) return;

    setTimerProgress(100);
    setIsPaused(false);
    isPausedRef.current = false;

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    // Vídeos dirigem o próprio progresso e o avanço automático pelos eventos
    // timeupdate/ended do elemento <video>, de modo que a barra de progresso
    // corresponde exatamente à duração real do vídeo.
    if (isVideo) return;

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
  }, [story?.id, restartKey, isVideo]);

  const handleTogglePause = React.useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  // Mantém a barra de progresso fluindo de forma contínua junto com o vídeo.
  // Em vez de depender do evento `timeupdate` (que dispara só ~4x/s e faz a
  // barra dar "saltos"), amostramos `currentTime` a cada frame via
  // requestAnimationFrame, produzindo um preenchimento suave a ~60fps.
  React.useEffect(() => {
    if (!isVideo || !story) return;

    const tick = () => {
      const video = videoRef.current;
      if (video && video.duration && isFinite(video.duration)) {
        const remaining = Math.max(0, 100 - (video.currentTime / video.duration) * 100);
        setTimerProgress(remaining);
      }
      videoRafRef.current = requestAnimationFrame(tick);
    };

    videoRafRef.current = requestAnimationFrame(tick);

    return () => {
      if (videoRafRef.current) cancelAnimationFrame(videoRafRef.current);
      videoRafRef.current = null;
    };
  }, [isVideo, story?.id, restartKey]);

  // Quando o vídeo termina, avança para o próximo flow.
  const handleVideoEnded = React.useCallback(() => {
    setTimerProgress(0);
    handleNextRef.current();
  }, []);

  const handleRestart = React.useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
    setRestartKey((k) => k + 1);
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

  const handleSwipeTouchStart = React.useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    swipeTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
    swipeHandledRef.current = false;
  }, []);

  const handleSwipeTouchEnd = React.useCallback((e: React.TouchEvent) => {
    if (!swipeTouchStartRef.current) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - swipeTouchStartRef.current.x;
    const deltaY = touch.clientY - swipeTouchStartRef.current.y;
    swipeTouchStartRef.current = null;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Swipe horizontal (predominantemente horizontal, mínimo 60px): pula de usuário
    // inteiro — estilo Instagram. Direita→esquerda vai para o próximo usuário
    // (descartando os flows restantes do atual); esquerda→direita volta ao anterior.
    if (absX > absY && absX > 60) {
      swipeHandledRef.current = true;
      if (deltaX < 0) handleNextUser();
      else handlePrevUser();
      return;
    }

    // Swipe para baixo: vertical, mínimo 80px, predominantemente vertical — fecha o flow e volta ao feed
    if (deltaY > 80 && absY > absX) {
      swipeHandledRef.current = true;
      handleClose();
      return;
    }

    // Swipe para cima (apenas dono): vertical, mínimo 60px, predominantemente vertical — abre lista de visualizadores
    if (isOwner && deltaY < -60 && absY > absX) {
      swipeHandledRef.current = true;
      handleOpenViewers();
    }
  }, [isOwner, handleOpenViewers, handleClose, handleNextUser, handlePrevUser]);

  const handleTapZonePointerDown = React.useCallback((e: React.PointerEvent) => {
    holdPointerStartRef.current = { x: e.clientX, y: e.clientY };
    holdTimerRef.current = setTimeout(() => {
      isPausedByHoldRef.current = true;
      holdFiredRef.current = true;
      setIsPaused(true);
      isPausedRef.current = true;
    }, 150);
  }, []);

  const handleTapZonePointerMove = React.useCallback((e: React.PointerEvent) => {
    if (!holdPointerStartRef.current || !holdTimerRef.current) return;
    const dx = e.clientX - holdPointerStartRef.current.x;
    const dy = e.clientY - holdPointerStartRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > 10) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const handleTapZonePointerUp = React.useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    holdPointerStartRef.current = null;
    if (isPausedByHoldRef.current) {
      isPausedByHoldRef.current = false;
      setIsPaused(false);
      isPausedRef.current = false;
    }
  }, []);

  const handleTapZonePointerCancel = React.useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    holdPointerStartRef.current = null;
    if (isPausedByHoldRef.current) {
      isPausedByHoldRef.current = false;
      holdFiredRef.current = false;
      setIsPaused(false);
      isPausedRef.current = false;
    }
  }, []);

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
        // Remove o flow deletado do estado local para que ele suma imediatamente
        // das barras de progresso e da navegação, sem precisar sair e voltar.
        setAllStories((prev) => prev.filter((s) => s.id !== story.id));
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

  if (loadingStories) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white/60" />
      </div>
    );
  }

  if (!story) return null;

  const HEADER_GLASS_BTN_STYLE: React.CSSProperties = {
    background: "linear-gradient(rgba(255,255,255,.12),rgba(255,255,255,.03))",
    backdropFilter: "blur(18px) saturate(160%)",
    WebkitBackdropFilter: "blur(18px) saturate(160%)",
    border: "1px solid rgba(255,255,255,.18)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.25), 0 8px 18px -8px rgba(0,0,0,.55)",
  };

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
              <video src={prevStory.media_url} muted loop playsInline preload="metadata" className="w-full h-full object-cover" />
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
          <main
            className="relative w-full h-full flex flex-col select-none"
            style={{
              WebkitTouchCallout: "none",
              WebkitUserSelect: "none",
              userSelect: "none",
            }}
            onTouchStart={handleSwipeTouchStart}
            onTouchEnd={handleSwipeTouchEnd}
            onContextMenu={(e) => e.preventDefault()}
          >
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
                            ? {
                                background: "linear-gradient(to right, #3A8DFF, #7B3FF2, #FF8A2A)",
                                boxShadow: "0 0 6px rgba(123,63,242,.55)",
                              }
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

                <div className="flex items-center gap-2">
                  {isOwner && (
                    <motion.button
                      onClick={handleDeleteStory}
                      disabled={isDeletingStory}
                      whileTap={{ scale: 0.88 }}
                      style={HEADER_GLASS_BTN_STYLE}
                      className="h-9 w-9 rounded-full flex items-center justify-center text-white/90 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="h-[18px] w-[18px]" />
                    </motion.button>
                  )}
                  <motion.button
                    onClick={handleClose}
                    whileTap={{ scale: 0.88 }}
                    style={HEADER_GLASS_BTN_STYLE}
                    className="h-9 w-9 rounded-full flex items-center justify-center text-white/90 hover:text-white transition-colors"
                  >
                    <X className="h-[18px] w-[18px]" />
                  </motion.button>
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
                            className="absolute"
                            style={{
                              left: `${el.x}%`,
                              top: `${el.y}%`,
                              transform: "translate(-50%, -50%)",
                              width: "max-content",
                              maxWidth: "80vw",
                              padding: "0 0.5rem",
                            }}
                          >
                            <p
                              className="text-3xl leading-tight break-words whitespace-pre-wrap"
                              style={{
                                textShadow: "0 1px 6px rgba(0,0,0,0.5)",
                                fontFamily: el.style?.fontFamily ?? "system-ui, sans-serif",
                                fontWeight: el.style?.fontWeight ?? 800,
                                textAlign: el.style?.align ?? "center",
                                color: el.style?.color ?? "#ffffff",
                              }}
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
                      style={
                        story.media_transform
                          ? {
                              transform: `translate(${story.media_transform.x}%, ${story.media_transform.y}%) scale(${story.media_transform.scale})`,
                              transformOrigin: "center",
                            }
                          : undefined
                      }
                      autoPlay
                      muted
                      playsInline
                      preload="auto"
                      onEnded={handleVideoEnded}
                    />
                  ) : (
                    <img
                      src={cdnImg(story.media_url, { width: 1920, quality: 90 }) ?? story.media_url}
                      alt="Flow"
                      draggable={false}
                      className="w-full h-full object-cover select-none pointer-events-none"
                      style={
                        story.media_transform
                          ? {
                              transform: `translate(${story.media_transform.x}%, ${story.media_transform.y}%) scale(${story.media_transform.scale})`,
                              transformOrigin: "center",
                            }
                          : undefined
                      }
                    />
                  )}

                  {/* Frases posicionadas sobre a mídia (renderizadas ao vivo) */}
                  {story.media_url &&
                    Array.isArray(story.text_elements) &&
                    story.text_elements.length > 0 && (
                      <div className="absolute inset-0 pointer-events-none z-[5]">
                        {story.text_elements.map((el, idx) => (
                          <div
                            key={idx}
                            className="absolute"
                            style={{
                              left: `${el.x}%`,
                              top: `${el.y}%`,
                              transform: "translate(-50%, -50%)",
                              width: "max-content",
                              maxWidth: "80vw",
                              padding: "0 0.5rem",
                            }}
                          >
                            <p
                              className="text-3xl leading-tight break-words whitespace-pre-wrap"
                              style={{
                                textShadow: "0 1px 6px rgba(0,0,0,0.5)",
                                fontFamily: el.style?.fontFamily ?? "system-ui, sans-serif",
                                fontWeight: el.style?.fontWeight ?? 800,
                                textAlign: el.style?.align ?? "center",
                                color: el.style?.color ?? "#ffffff",
                              }}
                            >
                              {el.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                </motion.div>
              </AnimatePresence>

              {/* Navigation tap zones */}
              <div
                className="absolute inset-0 flex z-[55]"
                onPointerDown={handleTapZonePointerDown}
                onPointerMove={handleTapZonePointerMove}
                onPointerUp={handleTapZonePointerUp}
                onPointerCancel={handleTapZonePointerCancel}
              >
                <div className="flex-1 cursor-pointer" onClick={(e) => { if (swipeHandledRef.current) { swipeHandledRef.current = false; return; } if (holdFiredRef.current) { holdFiredRef.current = false; return; } e.stopPropagation(); if (hasPrevStory) { handlePrev(); } else { handleRestart(); } }} />
                <div className="flex-[2] cursor-pointer" onClick={() => { if (swipeHandledRef.current) { swipeHandledRef.current = false; return; } if (holdFiredRef.current) { holdFiredRef.current = false; return; } handleTogglePause(); }} />
                <div className="flex-1 cursor-pointer" onClick={(e) => { if (swipeHandledRef.current) { swipeHandledRef.current = false; return; } if (holdFiredRef.current) { holdFiredRef.current = false; return; } e.stopPropagation(); handleNext(); }} />
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

            </div>

            {/* Bottom section — Direção B: doca de vidro flutuando sobre a mídia.
                Sobe junto com o teclado do iOS via --keyboard-height (resize:'none' não
                encolhe o viewport no device, então erguemos a doca nós mesmos, como
                drawers/dialogs fazem). Fora do nativo a var fica 0 → sem movimento. */}
            <div
              className="absolute bottom-0 left-0 right-0 pt-14 px-3.5 bg-gradient-to-t from-black/55 via-black/15 to-transparent z-[60] pointer-events-none"
              style={{
                paddingBottom: "calc(env(safe-area-inset-bottom) + 0.85rem)",
                transform: "translateY(calc(-1 * var(--keyboard-height, 0px)))",
                transition: "transform 0.25s ease-out",
              }}
            >
              {/* Floating comment bubbles (acima da doca) */}
              <div className="flex flex-col gap-2 items-start max-w-[80%] mb-2 px-1.5">
                <AnimatePresence>
                  {floatingBubbles.map(({ id, comment }) => (
                    <motion.button
                      key={id}
                      className="pointer-events-auto flex items-center gap-2 bg-black/45 backdrop-blur-md rounded-2xl px-3 py-2 border border-white/15 shadow-lg text-left active:scale-95 transition-transform"
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

              {/* Legenda do flow (acima da doca) */}
              {story.description && !(story.background_color && !story.media_url) && (
                <p
                  className="px-1.5 mb-2.5 text-sm font-medium text-white leading-relaxed"
                  style={{ textShadow: "0 1px 8px rgba(0,0,0,.65)" }}
                >
                  {story.description}
                </p>
              )}

              {isOwner && (
                <motion.button
                  className="pointer-events-auto flex items-center justify-center gap-1.5 w-full mb-2.5 py-1 active:opacity-60 transition-opacity"
                  onClick={handleOpenViewers}
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                >
                  <ChevronUp className="h-3.5 w-3.5 text-white/45" />
                  <span className="text-[10px] text-white/45 font-medium tracking-wide">visualizações</span>
                </motion.button>
              )}

              {/* Glass dock */}
              <div
                className="pointer-events-auto rounded-[28px] p-3.5"
                style={{
                  background: "linear-gradient(rgba(255,255,255,.08),rgba(255,255,255,.03))",
                  backdropFilter: "blur(22px) saturate(170%)",
                  WebkitBackdropFilter: "blur(22px) saturate(170%)",
                  border: "1px solid rgba(255,255,255,.14)",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,.22), 0 16px 36px -14px rgba(0,0,0,.5)",
                }}
              >
                {user && (
                  <div className="flex items-center justify-between mb-3 px-1">
                    {INCENTIVE_TYPES.map((type) => {
                      const isLiked = userLikes.includes(type);
                      const cfg = INCENTIVE_CONFIG[type];
                      const Icon = cfg.Icon;
                      return (
                        <motion.button
                          key={type}
                          type="button"
                          disabled={togglingLikeId === story.id}
                          aria-pressed={isLiked}
                          whileTap={{ scale: 0.82 }}
                          animate={isLiked ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                          onClick={() => {
                            hapticLight();
                            handleToggleLike(type);
                          }}
                          className={`relative h-[42px] w-[42px] rounded-full flex items-center justify-center transition-all disabled:opacity-50 ${
                            isLiked ? `${cfg.bgColor} ring-1 ring-white/20` : ""
                          }`}
                        >
                          <Icon
                            className={`h-5 w-5 transition-all duration-150 ${
                              isLiked ? cfg.activeClassName : cfg.iconClassName
                            }`}
                          />
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                <div
                  className="h-[46px] rounded-[23px] flex items-center gap-2.5 pl-[18px] pr-1.5 focus-within:border-white/30 transition-colors"
                  style={{
                    background: "rgba(0,0,0,.18)",
                    border: "1px solid rgba(255,255,255,.12)",
                  }}
                >
                  <Input
                    placeholder={isOwner ? "Seu flow..." : `Responder a ${story.userNickname}...`}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onFocus={() => setIsTyping(true)}
                    onBlur={() => setIsTyping(false)}
                    onKeyPress={(e) => e.key === "Enter" && newComment.trim() && handleAddComment()}
                    className="flex-1 bg-transparent border-0 text-[13.5px] text-white placeholder:text-white/55 focus-visible:ring-0 h-auto p-0"
                    disabled={isAddingComment}
                  />
                  <motion.button
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || isAddingComment}
                    whileTap={{ scale: 0.9 }}
                    className="shrink-0 h-[34px] w-[34px] rounded-full flex items-center justify-center text-white shadow-lg disabled:opacity-40 transition-opacity"
                    style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)" }}
                  >
                    <Send className="h-4 w-4" />
                  </motion.button>
                </div>
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
              <video src={nextStory.media_url} muted loop playsInline preload="metadata" className="w-full h-full object-cover" />
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
          handleClassName="mt-[10px] h-1 w-[38px] bg-white/25"
          className="flex flex-col !rounded-t-[32px] !border-0"
          style={{
            maxHeight: "88dvh",
            background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
            backdropFilter: "blur(40px) saturate(180%)",
            WebkitBackdropFilter: "blur(40px) saturate(180%)",
            borderTop: "1px solid rgba(255,255,255,.14)",
          }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DrawerTitle
            className="flex-shrink-0 px-[18px] pb-[14px] pt-2 text-[18px] leading-none"
            style={{ fontWeight: 740, color: "#fff" }}
          >
            Comentários · {comments.length}
          </DrawerTitle>
          <DrawerDescription className="sr-only">Lista de comentários do flow</DrawerDescription>
          <div
            className="flex-1 overflow-y-auto overscroll-contain px-[18px] space-y-4"
            style={{ paddingBottom: "max(3rem, env(safe-area-inset-bottom))" }}
          >
            {comments.length === 0 ? (
              <p className="text-center py-10 text-sm" style={{ color: "rgba(255,255,255,.5)" }}>Nenhum comentário ainda</p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="flex flex-col gap-1.5">
                  <div className="flex items-start justify-between group">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div className="shrink-0 h-8 w-8 rounded-full overflow-hidden">
                        <UserAvatar photo={comment.userPhoto} nickname={comment.userName} className="h-full w-full" />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm font-bold leading-tight" style={{ color: "#fff" }}>
                          {comment.userName}
                          {comment.userHandle && (
                            <span className="font-normal" style={{ color: "rgba(255,255,255,.5)" }}>
                              {" "}@{comment.userHandle.replace(/^@/, "")}
                            </span>
                          )}
                        </span>
                        {editingCommentId === comment.id ? (
                          <div className="mt-1 flex flex-col gap-1.5">
                            <textarea
                              value={editCommentDraft}
                              onChange={(e) => setEditCommentDraft(e.target.value)}
                              className="w-full resize-none rounded-2xl px-3 py-2 text-sm focus:outline-none min-h-16"
                              style={{
                                background: "rgba(255,255,255,.07)",
                                border: "1px solid rgba(255,255,255,.12)",
                                color: "#fff",
                              }}
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
                                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
                              >
                                <Check className="h-3 w-3" />
                                Salvar
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEditComment}
                                disabled={savingEditCommentId === comment.id}
                                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium disabled:opacity-50 transition-colors"
                                style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.7)" }}
                              >
                                <X className="h-3 w-3" />
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm leading-normal break-words" style={{ color: "rgba(255,255,255,.82)" }}>{comment.text}</span>
                        )}
                      </div>
                    </div>
                    {user?.id === comment.userId && editingCommentId !== comment.id && (
                      <div className="flex shrink-0 gap-0.5 ml-2">
                        <button
                          onClick={() => handleStartEditComment(comment)}
                          className="rounded-lg p-1.5 transition-colors active:opacity-70"
                          style={{ color: "rgba(255,255,255,.4)" }}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setCommentToDelete(comment.id)}
                          className="rounded-lg p-1.5 transition-colors active:opacity-70 hover:text-red-400"
                          style={{ color: "rgba(255,255,255,.4)" }}
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
                <button
                  key={viewer.followerId}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 w-full text-left active:opacity-70 transition-opacity hover:bg-muted/50"
                  onClick={() => {
                    setViewersDrawerOpen(false);
                    navigate(`/usuario/${viewer.followerId}`);
                  }}
                >
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
                </button>
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
