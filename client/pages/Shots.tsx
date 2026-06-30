import * as React from "react";
import { QuickIncentiveOverlay } from "@/components/shared/quick-incentive-overlay";
import { showIncentiveToast } from "@/lib/incentive-toast";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { PostIncentiveButton } from "@/components/shared/post-incentive-button";
import { FollowButton } from "@/components/shared/follow-button";
import { toast } from "@/components/ui/use-toast";
import {
  getShotsDb,
  toggleShotIncentiveDb,
  getShotLikeUsersDb,
  addShotCommentDb,
  getShotCommentsDb,
  deleteShotCommentDb,
  updateShotCommentDb,
  getFollowingStatusBatchDb,
  deleteShotDb,
  getUserProfileDb,
  type ShotWithUser,
  type ShotComment,
  type PostIncentiveType,
} from "@/lib/ritmofit-db";
import { PostLikesModal } from "@/components/modals/post-likes-modal";
import { MessageCircle, Send, Trash2, VolumeX, Volume2, MoreVertical, Edit2, AlertTriangle, Pencil, Check, X, Play, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { EditShotDescriptionDrawer } from "@/components/shots/edit-shot-description-drawer";
import { CommentReactions } from "@/components/shared/comment-reactions";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { UserAvatar } from "@/components/shared/user-avatar";
import { VerifiedBadge } from "@/components/shared/VerifiedBadge";
import { useLanguage } from "@/lib/language-context";
import { useKeyboardAwareHeight } from "@/hooks/use-keyboard-aware-height";
import { hapticLight, hapticMedium } from "@/lib/haptics";

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function Shots() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const openCommentsFromNotifRef = React.useRef(false);
  const [shots, setShots] = React.useState<ShotWithUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [shotsError, setShotsError] = React.useState(false);
  const [visibleShotId, setVisibleShotId] = React.useState<string | null>(null);
  const [togglingIncentives, setTogglingIncentives] = React.useState<Set<string>>(new Set());
  const commentsListRef = React.useRef<HTMLDivElement>(null);
  const [commentsOpen, setCommentsOpen] = React.useState(false);
  const [selectedShot, setSelectedShot] = React.useState<ShotWithUser | null>(
    null,
  );
  const [comments, setComments] = React.useState<ShotComment[]>([]);
  const [commentText, setCommentText] = React.useState("");
  const [currentUserPhoto, setCurrentUserPhoto] = React.useState<string | null>(null);
  const viewportHeight = useKeyboardAwareHeight();
  const [isLoadingComments, setIsLoadingComments] = React.useState(false);
  const [isAddingComment, setIsAddingComment] = React.useState(false);
  const [followingStatus, setFollowingStatus] = React.useState<
    Record<string, boolean>
  >({});
  const [showSwipeHint, setShowSwipeHint] = React.useState(
    () => localStorage.getItem("shots_swipe_hint_seen") !== "1"
  );
  const [isMuted, setIsMuted] = React.useState(false);
  const [editShotOpen, setEditShotOpen] = React.useState(false);
  const [editingShot, setEditingShot] = React.useState<ShotWithUser | null>(null);
  const [deleteShotDialogOpen, setDeleteShotDialogOpen] = React.useState(false);
  const [deletingShot, setDeletingShot] = React.useState<ShotWithUser | null>(null);
  const [isDeletingShot, setIsDeletingShot] = React.useState(false);
  const [deleteCommentDialogOpen, setDeleteCommentDialogOpen] = React.useState(false);
  const [deletingCommentId, setDeletingCommentId] = React.useState<string | null>(null);
  const [isDeletingComment, setIsDeletingComment] = React.useState(false);
  const [editingCommentId, setEditingCommentId] = React.useState<string | null>(null);
  const [editCommentDraft, setEditCommentDraft] = React.useState("");
  const [isSavingEditComment, setIsSavingEditComment] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const videoRefsMap = React.useRef<Record<string, HTMLVideoElement>>({});
  const [isPaused, setIsPaused] = React.useState(false);
  const [quickOverlayShotId, setQuickOverlayShotId] = React.useState<string | null>(null);
  const [burstMap, setBurstMap] = React.useState<Record<string, PostIncentiveType | null>>({});
  const lastTapRef = React.useRef<{ shotId: string; time: number } | null>(null);
  const singleTapTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Pressionar e segurar para pausar (mesmo sistema do FlowViewer)
  const holdTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdPointerStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const isHoldPausingRef = React.useRef(false);
  const holdFiredRef = React.useRef(false);
  const visibleShotIdRef = React.useRef<string | null>(null);
  const [shotLikesModalOpen, setShotLikesModalOpen] = React.useState(false);
  const [shotLikes, setShotLikes] = React.useState<Array<{ userId: string; userNickname: string; userPhoto: string | null; type: number }>>([]);
  const [shotLikesLoading, setShotLikesLoading] = React.useState(false);

  const handleOpenShotLikes = React.useCallback(async (shotId: string) => {
    if (shotLikesLoading) return;
    setShotLikesLoading(true);
    try {
      const likes = await getShotLikeUsersDb(shotId);
      setShotLikes(likes);
      setShotLikesModalOpen(true);
    } catch (err) {
      console.error("Error loading shot likes:", err);
      toast({ title: t("error"), description: t("post_incentives_load_error"), variant: "destructive" });
    } finally {
      setShotLikesLoading(false);
    }
  }, [shotLikesLoading, t]);

  const handleVideoTap = React.useCallback((shotId: string) => {
    const now = Date.now();
    const last = lastTapRef.current;

    if (last && last.shotId === shotId && now - last.time < 300) {
      // Double tap — show quick incentive overlay
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
      lastTapRef.current = null;
      setQuickOverlayShotId(shotId);
      return;
    }

    lastTapRef.current = { shotId, time: now };

    // Delay single-tap action to allow double-tap detection
    if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    singleTapTimerRef.current = setTimeout(() => {
      lastTapRef.current = null;
      const video = videoRefsMap.current[shotId];
      if (!video) return;
      if (video.paused) {
        video.play().catch(() => {});
        setIsPaused(false);
      } else {
        video.pause();
        setIsPaused(true);
      }
    }, 300);
  }, []);

  // Keep a ref of the currently visible shot so hold-to-pause can resume safely
  React.useEffect(() => {
    visibleShotIdRef.current = visibleShotId;
  }, [visibleShotId]);

  // Press-and-hold to pause the video while held; release to resume
  const handleShotPointerDown = React.useCallback((e: React.PointerEvent, shotId: string) => {
    holdPointerStartRef.current = { x: e.clientX, y: e.clientY };
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      const video = videoRefsMap.current[shotId];
      if (!video) return;
      isHoldPausingRef.current = true;
      holdFiredRef.current = true;
      video.pause();
      setIsPaused(true);
    }, 200);
  }, []);

  const handleShotPointerMove = React.useCallback((e: React.PointerEvent) => {
    if (!holdPointerStartRef.current || !holdTimerRef.current) return;
    const dx = e.clientX - holdPointerStartRef.current.x;
    const dy = e.clientY - holdPointerStartRef.current.y;
    // Movimento = scroll/swipe; cancela o hold antes de pausar
    if (Math.sqrt(dx * dx + dy * dy) > 10) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const resumeFromHold = React.useCallback((shotId: string) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    holdPointerStartRef.current = null;
    if (isHoldPausingRef.current) {
      isHoldPausingRef.current = false;
      // Só retoma se o shot ainda estiver visível (evita áudio sobreposto após swipe)
      if (shotId === visibleShotIdRef.current) {
        const video = videoRefsMap.current[shotId];
        if (video) video.play().catch(() => {});
        setIsPaused(false);
      }
      return true;
    }
    return false;
  }, []);

  const handleShotPointerUp = React.useCallback((shotId: string) => {
    // Mantém holdFiredRef para o onClick subsequente ignorar o tap
    resumeFromHold(shotId);
  }, [resumeFromHold]);

  const handleShotPointerCancel = React.useCallback((shotId: string) => {
    resumeFromHold(shotId);
    // pointercancel não dispara click, então libera o flag aqui
    holdFiredRef.current = false;
  }, [resumeFromHold]);

  // Load current user avatar once when the comments drawer opens
  React.useEffect(() => {
    if (!commentsOpen || !user) return;
    getUserProfileDb(user.id)
      .then((profile) => setCurrentUserPhoto(profile?.photo ?? null))
      .catch(() => {});
  }, [commentsOpen, user?.id]);

  // Auto-dismiss swipe hint after 4s to prevent blocking interaction
  React.useEffect(() => {
    if (!showSwipeHint) return;
    const timer = setTimeout(() => {
      localStorage.setItem("shots_swipe_hint_seen", "1");
      setShowSwipeHint(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, [showSwipeHint]);

  // Open comments drawer when navigating from a notification
  React.useEffect(() => {
    const state = location.state as { openComments?: boolean; shotId?: string } | null;
    if (!state?.shotId || !state?.openComments || openCommentsFromNotifRef.current) return;
    if (shots.length === 0) return; // wait for shots to load

    const targetShot = shots.find((s) => s.id === state.shotId);
    if (targetShot) {
      openCommentsFromNotifRef.current = true;
      handleOpenComments(targetShot);
    }
  }, [shots, location.state]);

  // Scroll to a specific shot when navigating from profile
  const scrolledToShotRef = React.useRef(false);
  React.useEffect(() => {
    const state = location.state as { shotId?: string } | null;
    if (!state?.shotId || scrolledToShotRef.current || shots.length === 0) return;

    const container = containerRef.current;
    if (!container) return;

    const el = container.querySelector(`[data-shot-id="${state.shotId}"]`);
    if (el) {
      scrolledToShotRef.current = true;
      el.scrollIntoView({ behavior: "instant" });
    }
  }, [shots, location.state]);

  // Load shots on mount
  React.useEffect(() => {
    (async () => {
      try {
        const shotsData = await getShotsDb();
        setShots(shotsData);

        // Load follow status for all shot creators in a single batch query
        if (user && shotsData.length > 0) {
          const uniqueUserIds = [...new Set(shotsData.map((r) => r.user_id))];
          getFollowingStatusBatchDb(uniqueUserIds)
            .then(setFollowingStatus)
            .catch((err) => console.error("Error loading follow statuses:", err));
        }
      } catch (err: any) {
        console.error("Erro ao carregar shots:", err?.message || err);
        toast({
          title: t("shots_load_error"),
          description: err?.message || t("retry"),
        });
        setShotsError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  // Set up IntersectionObserver to detect visible shot and auto-play video
  React.useEffect(() => {
    let isMounted = true;
    const container = containerRef.current;
    if (!container) return;

    const observerOptions = {
      root: container,
      rootMargin: "0px",
      threshold: [0.5],
    };

    const observer = new IntersectionObserver((entries) => {
      if (!isMounted) return;
      // Pause outgoing videos first to avoid audio overlap
      entries.forEach((entry) => {
        if (entry.isIntersecting) return;
        const shotId = entry.target.getAttribute("data-shot-id");
        if (!shotId) return;
        const video = videoRefsMap.current[shotId];
        if (video) video.pause();
      });
      // Then play incoming video
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const shotId = entry.target.getAttribute("data-shot-id");
        if (!shotId) return;
        setVisibleShotId(shotId);
        const video = videoRefsMap.current[shotId];
        if (video) {
          video.play().catch((err) => { if (err?.name !== "AbortError" && err?.name !== "NotSupportedError") console.error("Erro ao reproduzir vídeo:", err); });
        }
      });
    }, observerOptions);

    // Observe existing elements
    container.querySelectorAll("[data-shot-id]").forEach((item) => observer.observe(item));

    // MutationObserver ensures newly added/removed DOM elements are observed without recreating everything
    const mutationObserver = new MutationObserver((mutations) => {
      if (!isMounted) return;
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            if (node.hasAttribute("data-shot-id")) observer.observe(node);
            node.querySelectorAll("[data-shot-id]").forEach((el) => observer.observe(el));
          }
        });
      });
    });
    mutationObserver.observe(container, { childList: true, subtree: true });

    return () => {
      isMounted = false;
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, [shots]); // re-run when shots load so containerRef is populated

  // Auto-play first video when shots load
  React.useEffect(() => {
    if (shots.length > 0 && !visibleShotId) {
      const firstShotId = shots[0].id;
      const firstVideo = videoRefsMap.current[firstShotId];
      if (firstVideo) {
        firstVideo.play().catch((err) => { if (err?.name !== "AbortError") console.error("Erro ao reproduzir primeiro vídeo:", err); });
      }
    }
  }, [shots, visibleShotId]);

  const handleIncentiveClick = React.useCallback(
    async (shot: ShotWithUser, type: PostIncentiveType) => {
      if (!user) {
        toast({
          title: t("shots_login_required"),
          description: t("shots_login_desc"),
        });
        return;
      }

      const incentiveKey = `${shot.id}-${type}`;
      if (togglingIncentives.has(incentiveKey)) return;

      hapticMedium();
      setTogglingIncentives((prev) => new Set(prev).add(incentiveKey));

      const typeKeyMap: Record<number, keyof ShotWithUser["likes"]> = {
        1: "apoio",
        2: "continua",
        3: "ganhador",
        4: "consegueMais",
        5: "limiteMaior",
        6: "maisAlgum",
      };

      let previousShots: ShotWithUser[] = [];
      const currentShot = shots.find((r) => r.id === shot.id);
      const wasActive = (currentShot?.userLikes || []).includes(type);
      if (!wasActive) showIncentiveToast(type);
      try {
        // Optimistic update — apply immediately before server responds
        setShots((prev) => {
          previousShots = prev.map((r) => ({ ...r, likes: { ...r.likes }, userLikes: [...(r.userLikes || [])] }));
          return prev.map((r) => {
            if (r.id !== shot.id) return r;
            const userLikes = r.userLikes || [];
            const isRemoving = userLikes.includes(type);
            const newUserLikes = isRemoving ? userLikes.filter((t) => t !== type) : [...userLikes, type];
            const delta = isRemoving ? -1 : 1;
            const key = typeKeyMap[type];
            const newLikes = key
              ? { ...r.likes, [key]: Math.max(0, (r.likes[key] ?? 0) + delta) }
              : r.likes;
            return { ...r, userLikes: newUserLikes, likes: newLikes };
          });
        });

        await toggleShotIncentiveDb(shot.id, type, shot.user_id);
      } catch (err: any) {
        console.error("Error toggling incentive:", err);
        // Revert optimistic update on failure
        if (previousShots.length > 0) setShots(previousShots);
        toast({
          title: t("shots_incentive_error"),
          description: err?.message || t("shots_retry"),
          variant: "destructive",
        });
      } finally {
        setTogglingIncentives((prev) => {
          const next = new Set(prev);
          next.delete(incentiveKey);
          return next;
        });
      }
    },
    [user, togglingIncentives, t, shots]
  );

  const handleOpenComments = React.useCallback(
    async (shot: ShotWithUser) => {
      setSelectedShot(shot);
      setCommentsOpen(true);
      setIsLoadingComments(true);

      try {
        const commentsData = await getShotCommentsDb(shot.id);
        setComments(commentsData);
      } catch (err: any) {
        console.error("Error loading comments:", err);
        toast({
          title: t("comments_load_error"),
          description: err?.message || t("retry"),
          variant: "destructive",
        });
      } finally {
        setIsLoadingComments(false);
      }
    },
    [t]
  );

  const handleAddComment = React.useCallback(async () => {
    if (!commentText.trim() || !selectedShot) return;

    setIsAddingComment(true);
    try {
      await addShotCommentDb(selectedShot.id, commentText, selectedShot.user_id);

      const updatedComments = await getShotCommentsDb(selectedShot.id);
      setComments(updatedComments);
      requestAnimationFrame(() => {
        if (commentsListRef.current) commentsListRef.current.scrollTop = 0;
      });
      setCommentText("");
      // Bug 5 fix: increment commentCount in shots state
      setShots((prev) =>
        prev.map((s) =>
          s.id === selectedShot.id
            ? { ...s, commentCount: (s.commentCount || 0) + 1 }
            : s
        )
      );
    } catch (err: any) {
      console.error("Error adding comment:", err);
      toast({
        title: t("comments_send_error"),
        description: err?.message || t("retry"),
        variant: "destructive",
      });
    } finally {
      setIsAddingComment(false);
    }
  }, [commentText, selectedShot, t]);

  const handleDeleteComment = React.useCallback((commentId: string) => {
    setDeletingCommentId(commentId);
    setDeleteCommentDialogOpen(true);
  }, []);

  const handleStartEditComment = React.useCallback((comment: ShotComment) => {
    setEditingCommentId(comment.id);
    setEditCommentDraft(comment.text);
  }, []);

  const handleCancelEditComment = React.useCallback(() => {
    setEditingCommentId(null);
    setEditCommentDraft("");
  }, []);

  const handleSaveEditComment = React.useCallback(async (commentId: string) => {
    if (!editCommentDraft.trim()) return;
    setIsSavingEditComment(true);
    try {
      await updateShotCommentDb(commentId, editCommentDraft);
      setComments((prev) => {
        const updated = prev.map((c) => c.id === commentId ? { ...c, text: editCommentDraft.trim() } : c);
        const idx = updated.findIndex((c) => c.id === commentId);
        if (idx > 0) { const [item] = updated.splice(idx, 1); updated.unshift(item); }
        return [...updated];
      });
      requestAnimationFrame(() => {
        if (commentsListRef.current) commentsListRef.current.scrollTop = 0;
      });
      setEditingCommentId(null);
      setEditCommentDraft("");
      toast({ title: t("comments_edited") });
    } catch (err: any) {
      console.error("Error editing comment:", err);
      toast({ title: t("comments_edit_error"), description: err?.message || t("retry") });
    } finally {
      setIsSavingEditComment(false);
    }
  }, [editCommentDraft, t]);

  const handleConfirmDeleteComment = React.useCallback(async () => {
    if (!deletingCommentId) return;
    setIsDeletingComment(true);
    try {
      await deleteShotCommentDb(deletingCommentId);
      setComments((prev) => prev.filter((c) => c.id !== deletingCommentId));
      // Bug 5 fix: decrement commentCount in shots state
      setShots((prev) =>
        prev.map((s) =>
          selectedShot && s.id === selectedShot.id
            ? { ...s, commentCount: Math.max(0, (s.commentCount || 0) - 1) }
            : s
        )
      );
      toast({ title: t("shots_comment_deleted") });
    } catch (err: any) {
      console.error("Error deleting comment:", err);
      toast({
        title: t("shots_comment_delete_error"),
        description: err?.message || t("retry"),
        variant: "destructive",
      });
    } finally {
      setIsDeletingComment(false);
      setDeleteCommentDialogOpen(false);
      setDeletingCommentId(null);
    }
  }, [deletingCommentId, selectedShot]);


  const handleConfirmDeleteShot = React.useCallback(async () => {
    if (!deletingShot) return;
    setIsDeletingShot(true);
    try {
      const ok = await deleteShotDb(deletingShot.id);
      if (ok) {
        setShots((prev) => prev.filter((r) => r.id !== deletingShot.id));
        toast({ title: t("shots_delete_success") });
      } else {
        toast({ title: t("shots_delete_error"), variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: t("shots_delete_error"), description: err?.message, variant: "destructive" });
    } finally {
      setIsDeletingShot(false);
      setDeleteShotDialogOpen(false);
      setDeletingShot(null);
    }
  }, [deletingShot]);

  if (loading) {
    return (
      <div
        className="bg-black w-full flex flex-col overflow-hidden relative h-[calc(100dvh-4.25rem-env(safe-area-inset-bottom))] md:h-dvh"
        style={{
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        {/* Shimmer sweep — one vertical pass over the whole frame */}
        <style>{`
          @keyframes shots-shimmer {
            0%   { transform: translateY(-100%); }
            100% { transform: translateY(200%); }
          }
          .shots-shimmer { animation: shots-shimmer 2s ease-in-out infinite; }
        `}</style>

        {/* Fundo escuro com gradiente inferior simulando vídeo */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/50 pointer-events-none z-10" />

        {/* Barra de shimmer que percorre verticalmente */}
        <div className="absolute inset-0 overflow-hidden z-20 pointer-events-none">
          <div
            className="shots-shimmer absolute inset-x-0 h-1/3"
            style={{
              background: "linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)",
            }}
          />
        </div>

        {/* Topo esquerdo — avatar + nome skeleton */}
        <div
          className="absolute left-4 z-30 flex items-center gap-3"
          style={{ top: "calc(1rem + env(safe-area-inset-top))" }}
        >
          <div className="h-12 w-12 rounded-full bg-white/10 animate-pulse flex-shrink-0" />
          <div className="flex flex-col gap-2">
            <div className="h-3 w-28 rounded-full bg-white/10 animate-pulse" />
            <div className="h-2.5 w-20 rounded-full bg-white/[0.07] animate-pulse" />
          </div>
        </div>

        {/* Topo direito — botão de som skeleton */}
        <div
          className="absolute right-4 z-30"
          style={{ top: "calc(1rem + env(safe-area-inset-top))" }}
        >
          <div className="h-8 w-20 rounded-full bg-white/10 animate-pulse" />
        </div>

        {/* Centro — ícone de play pulsando */}
        <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              {/* Anel de pulso */}
              <div className="absolute inset-0 rounded-full bg-white/10 animate-ping" style={{ animationDuration: "1.6s" }} />
              <div className="relative h-16 w-16 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm">
                <svg className="h-7 w-7 text-white/50 ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Lado direito — botões de incentivo skeleton */}
        <div
          className="absolute right-4 z-30 flex flex-col gap-4"
          style={{ bottom: "4rem" }}
        >
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1.5" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="h-8 w-8 rounded-full bg-white/10 animate-pulse" style={{ animationDelay: `${i * 120}ms` }} />
              <div className="h-2 w-4 rounded-full bg-white/[0.07] animate-pulse" />
            </div>
          ))}
          {/* Comentários */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="h-8 w-8 rounded-full bg-white/10 animate-pulse" />
          </div>
        </div>

        {/* Rodapé esquerdo — descrição skeleton */}
        <div
          className="absolute left-4 z-30 flex flex-col gap-2"
          style={{ bottom: "4rem", right: "4.5rem" }}
        >
          <div className="h-3 w-48 rounded-full bg-white/10 animate-pulse" />
          <div className="h-3 w-32 rounded-full bg-white/[0.07] animate-pulse" />
        </div>
      </div>
    );
  }

  if (shotsError) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-black">
        <p className="text-sm text-muted-foreground">
          {t("shots_error")}
        </p>
      </div>
    );
  }

  if (shots.length === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-black">
        <p className="text-sm text-muted-foreground">
          {t("shots_empty")}
        </p>
      </div>
    );
  }

  // Only preload videos near the visible shot. Mounting 50 <video> elements all
  // with preload="metadata" saturates the iOS WebView network on first paint and
  // delays the first video. Visible shot buffers ("auto"), neighbours fetch just
  // metadata, the rest load lazily when scrolled into view.
  const visibleIndex = visibleShotId
    ? Math.max(0, shots.findIndex((s) => s.id === visibleShotId))
    : 0;

  return (
    <div
      className="bg-black w-full flex flex-col overflow-hidden relative h-[calc(100dvh-4.25rem-env(safe-area-inset-bottom))] md:h-dvh"
      style={{
        // Header é ocultado em /shots — div começa em y=0 (atrás do notch), paddingTop empurra o conteúdo para baixo do notch
        paddingTop: "env(safe-area-inset-top)",
        overflow: "hidden",
      }}
    >
      {/* Shots Container - Scroll Snap com overflow-y-scroll */}
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

        {shots.map((shot, index) => {
          const distance = Math.abs(index - visibleIndex);
          const videoPreload = distance === 0 ? "auto" : distance === 1 ? "metadata" : "none";
          return (
            <div
              key={shot.id}
              data-shot-id={shot.id}
              className="flex items-center justify-center bg-black relative"
              style={{
                width: "100%",
                height: "100%",
                overflow: "hidden",
                scrollSnapAlign: "start",
                minHeight: "100%",
              }}
            >
              {/* Video */}
              {shot.video_url ? (
                <div
                  className="h-full w-full relative cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onPointerDown={(e) => handleShotPointerDown(e, shot.id)}
                  onPointerMove={handleShotPointerMove}
                  onPointerUp={() => handleShotPointerUp(shot.id)}
                  onPointerCancel={() => handleShotPointerCancel(shot.id)}
                  onClick={() => {
                    if (holdFiredRef.current) {
                      holdFiredRef.current = false;
                      return;
                    }
                    handleVideoTap(shot.id);
                  }}
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  <QuickIncentiveOverlay
                    visible={quickOverlayShotId === shot.id}
                    userLikes={shot.userLikes}
                    onSelect={(type) => {
                      setQuickOverlayShotId(null);
                      setBurstMap((prev) => ({ ...prev, [shot.id]: type }));
                      setTimeout(() => setBurstMap((prev) => ({ ...prev, [shot.id]: null })), 600);
                      showIncentiveToast(type);
                      handleIncentiveClick(shot, type);
                    }}
                    onDismiss={() => setQuickOverlayShotId(null)}
                  />
                  <video
                    ref={(el) => {
                      if (el) {
                        videoRefsMap.current[shot.id] = el;
                        el.muted = isMuted;
                      }
                    }}
                    src={shot.video_url}
                    muted={isMuted}
                    loop
                    playsInline
                    // webkit-playsinline garante reprodução inline no WKWebView iOS
                    // x-webkit-airplay="deny" evita que o iOS sequestre o player nativo
                    {...({ "webkit-playsinline": "true", "x-webkit-airplay": "deny" } as React.VideoHTMLAttributes<HTMLVideoElement>)}
                    preload={videoPreload}
                    className="h-full w-full object-cover"
                    style={{ pointerEvents: "none" }}
                    onError={() => { delete videoRefsMap.current[shot.id]; }}
                  />
                  {/* Pause state indicator — visível enquanto pausado, igual ao FlowViewer */}
                  {isPaused && visibleShotId === shot.id && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-black/40 rounded-full p-5 backdrop-blur-md border border-white/10 animate-fade-in">
                        <Play className="h-12 w-12 text-white" style={{ fill: "rgba(255,255,255,0.2)" }} />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  {t("shots_video_unavailable")}
                </div>
              )}

              {/* Gradient Overlay for Better Text Visibility */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/40 pointer-events-none" />

              {/* Top-right controls */}
              <div
                className="absolute right-4 z-20 flex items-center gap-2"
                style={{ top: "1rem" }}
              >
                <button
                  onClick={() => {
                    hapticLight();
                    const newMuted = !isMuted;
                    setIsMuted(newMuted);
                    Object.values(videoRefsMap.current).forEach((v) => { v.muted = newMuted; });
                  }}
                  className="flex items-center gap-1.5 bg-black/40 hover:bg-black/60 text-white rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                  aria-label={isMuted ? t("shots_unmute_label") : t("shots_mute_label")}
                >
                  {isMuted ? (
                    <><VolumeX className="h-4 w-4" /><span>{t("shots_muted")}</span></>
                  ) : (
                    <><Volume2 className="h-4 w-4" /><span>{t("shots_sound")}</span></>
                  )}
                </button>
                {user?.id === shot.user_id && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button aria-label={t("shots_options_label")} className="flex items-center justify-center h-8 w-8 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => {
                        setEditingShot(shot);
                        setEditShotOpen(true);
                      }}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        {t("shots_edit_desc")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleOpenShotLikes(shot.id)} disabled={shotLikesLoading}>
                        <Users className="h-4 w-4 mr-2" />
                        {t("shots_see_incentives")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => {
                          setDeletingShot(shot);
                          setDeleteShotDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t("shots_delete_clip")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {/* User Info - Top Left */}
              <div
                className="absolute left-4 z-10 flex items-center gap-3 max-w-[55%]"
                style={{ top: "1rem" }}
              >
                <button
                  onClick={() => navigate(`/usuario/${shot.user_id}`)}
                  className="shrink-0 hover:opacity-80 transition-opacity"
                >
                  <UserAvatar
                    photo={shot.userPhoto}
                    nickname={shot.userNickname || t("shots_user_fallback")}
                    size="lg"
                    className="border-2 border-white/30 shadow-lg"
                  />
                </button>
                <div className="min-w-0 flex flex-col gap-1">
                  <button
                    onClick={() => navigate(`/usuario/${shot.user_id}`)}
                    className="flex items-center gap-1 min-w-0 hover:opacity-80 transition-opacity text-left"
                  >
                    {shot.isVerified && <VerifiedBadge size="sm" className="shrink-0" />}
                    <p className="text-sm font-bold text-white drop-shadow-md truncate">
                      {shot.userNickname || t("shots_user_fallback")}
                    </p>
                  </button>
                  {shot.userHandle && (
                    <p className="text-xs text-white/70 drop-shadow-md">
                      {shot.userHandle.startsWith("@") ? shot.userHandle : `@${shot.userHandle}`}
                    </p>
                  )}
                  {user && user.id !== shot.user_id && (
                    <FollowButton
                      targetUserId={shot.user_id}
                      initialIsFollowing={followingStatus[shot.user_id]}
                      variant="overlay"
                    />
                  )}
                </div>
              </div>

              {/* Bottom Area: Description + Incentive Buttons aligned together */}
              <div
                className="absolute left-0 right-0 z-10 flex items-end px-4 gap-3"
                style={{
                  bottom: "1.75rem",
                }}
              >
                {/* Description - Bottom Left */}
                <div className="flex-1 min-w-0 flex flex-col justify-end">
                  {shot.description && (
                    <p className="text-sm text-white drop-shadow-md leading-relaxed">
                      {shot.description}
                    </p>
                  )}
                </div>

                {/* Incentive Buttons + Comments - Right Side */}
                <div className="flex-shrink-0 flex flex-col gap-3 z-20">
                  {([1, 2, 3, 4, 5, 6] as PostIncentiveType[]).map((type) => {
                    const likeKeyMap: Record<number, keyof typeof shot.likes> = {
                      1: "apoio", 2: "continua", 3: "ganhador",
                      4: "consegueMais", 5: "limiteMaior", 6: "maisAlgum",
                    };
                    const count = shot.likes?.[likeKeyMap[type]] ?? 0;
                    return (
                      <div key={type} className="flex flex-col items-center gap-0.5">
                        <PostIncentiveButton
                          type={type}
                          isActive={(shot.userLikes || [])?.includes(type) ?? false}
                          onClick={() => handleIncentiveClick(shot, type)}
                          loading={togglingIncentives.has(`${shot.id}-${type}`)}
                          burst={burstMap[shot.id] === type}
                        />
                        {count > 0 && (
                          <span className="text-xs text-white/70 font-medium leading-none">
                            {count}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {/* Comments Button */}
                  <button
                    onClick={() => { hapticLight(); handleOpenComments(shot); }}
                    aria-label={`Comentários (${shot.commentCount || 0})`}
                    className="inline-flex shrink-0 items-center gap-1 transition-opacity hover:opacity-80 min-h-[44px] min-w-[44px] justify-center"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <MessageCircle className="h-[18px] w-[18px] text-white hover:scale-110 transition-transform" />
                      {(shot.commentCount || 0) > 0 && (
                        <span className="text-xs text-white/70 font-medium">
                          {shot.commentCount}
                        </span>
                      )}
                    </div>
                  </button>
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {/* Swipe Hint Overlay */}
      {showSwipeHint && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50 pointer-events-none">
          <style>{`
            @keyframes swipeAnimation {
              0% { transform: translateY(-20px); opacity: 1; }
              50% { opacity: 1; }
              100% { transform: translateY(40px); opacity: 0; }
            }
            .swipe-finger { animation: swipeAnimation 2s ease-in-out infinite; }
          `}</style>
          <div className="flex flex-col items-center gap-4">
            <p className="text-white text-lg font-semibold drop-shadow-lg">
              {t("shots_swipe_hint")}
            </p>
            <div className="text-4xl swipe-finger">☝️</div>
          </div>
          <button
            onClick={() => {
              localStorage.setItem("shots_swipe_hint_seen", "1");
              setShowSwipeHint(false);
            }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-2 bg-white/20 hover:bg-white/30 text-white rounded-full text-sm font-medium transition-colors pointer-events-auto"
          >
            {t("shots_swipe_ok")}
          </button>
        </div>
      )}

      {/* Edit Shot Drawer */}
      <EditShotDescriptionDrawer
        open={editShotOpen}
        onOpenChange={setEditShotOpen}
        shot={editingShot}
        onSaved={(shotId, newDescription) => {
          setShots((prev) => prev.map((s) => s.id === shotId ? { ...s, description: newDescription } : s));
          setEditingShot(null);
        }}
      />

      {/* Delete Shot Confirmation Dialog */}
      <AlertDialog open={deleteShotDialogOpen} onOpenChange={setDeleteShotDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t("shots_delete_title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("shots_delete_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingShot}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteShot}
              disabled={isDeletingShot}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {isDeletingShot ? t("shots_delete_deleting") : t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Comment Confirmation Dialog */}
      <AlertDialog open={deleteCommentDialogOpen} onOpenChange={setDeleteCommentDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("shots_comment_delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("shots_comment_delete_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingComment}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteComment}
              disabled={isDeletingComment}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {isDeletingComment ? t("shots_comment_deleting") : t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Shot Incentives Modal — owner only */}
      <PostLikesModal
        open={shotLikesModalOpen}
        onOpenChange={setShotLikesModalOpen}
        likes={shotLikes}
      />

      {/* Comments Drawer */}
      <Drawer
        open={commentsOpen && selectedShot !== null}
        onOpenChange={setCommentsOpen}
        noBodyStyles
        shouldScaleBackground={false}
      >
        <DrawerContent
          handleClassName="mt-[10px] h-1 w-[38px] bg-white/25"
          className="flex flex-col !rounded-t-[32px] !border-0"
          style={{
            maxHeight: `min(82dvh, ${viewportHeight - 8}px)`,
            background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
            backdropFilter: "blur(40px) saturate(180%)",
            WebkitBackdropFilter: "blur(40px) saturate(180%)",
            borderTop: "1px solid rgba(255,255,255,.14)",
          }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DrawerDescription className="sr-only">{t("shots_comments_desc")}</DrawerDescription>

          {/* Title */}
          <DrawerTitle
            className="flex-shrink-0 px-[18px] pb-[14px] text-[18px] leading-none"
            style={{ fontWeight: 740, color: "#fff" }}
          >
            {t("comments_title")} · {selectedShot?.commentCount ?? comments.length}
          </DrawerTitle>

          {/* Comments list */}
          <div
            ref={commentsListRef}
            className="flex-1 overflow-y-auto px-[18px] pb-3"
            style={{ display: "flex", flexDirection: "column", gap: "18px" }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {isLoadingComments ? (
              <div className="text-sm py-6 text-center" style={{ color: "rgba(255,255,255,.5)" }}>
                {t("comments_loading")}
              </div>
            ) : comments && comments.length > 0 ? (
              comments.map((comment) => (
                <div key={comment.id} className="flex gap-[11px]">
                  {/* Avatar */}
                  <UserAvatar
                    photo={comment.userPhoto}
                    nickname={comment.userName}
                    size="sm"
                    className="flex-shrink-0 mt-0.5"
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Name + time */}
                    <div className="text-[13.5px]" style={{ color: "rgba(255,255,255,.95)" }}>
                      <span className="font-semibold" style={{ color: "#fff" }}>
                        {comment.userName}
                      </span>
                      {" "}
                      <span style={{ color: "rgba(255,255,255,.4)", fontSize: "11.5px" }}>
                        · {formatRelativeTime(comment.createdAt)}
                      </span>
                    </div>

                    {/* Text or edit form */}
                    {editingCommentId === comment.id ? (
                      <div className="mt-1 flex flex-col gap-1.5">
                        <textarea
                          value={editCommentDraft}
                          onChange={(e) => setEditCommentDraft(e.target.value)}
                          className="w-full rounded-2xl px-3 py-2 text-sm resize-none"
                          style={{
                            background: "rgba(255,255,255,.07)",
                            border: "1px solid rgba(255,255,255,.12)",
                            color: "#fff",
                            minHeight: "64px",
                            outline: "none",
                          }}
                          disabled={isSavingEditComment}
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
                            disabled={!editCommentDraft.trim() || isSavingEditComment}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium disabled:opacity-50 transition-colors"
                            style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
                          >
                            <Check className="h-3 w-3" />
                            {t("comments_edit_save")}
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEditComment}
                            disabled={isSavingEditComment}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium disabled:opacity-50 transition-colors"
                            style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.7)" }}
                          >
                            <X className="h-3 w-3" />
                            {t("comments_edit_cancel")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p
                        className="break-words"
                        style={{ margin: "3px 0 7px", fontSize: "13.5px", lineHeight: "1.45", color: "rgba(255,255,255,.82)" }}
                      >
                        {comment.text}
                      </p>
                    )}

                    <CommentReactions
                      commentType="shot"
                      commentId={comment.id}
                      commentOwnerId={comment.userId}
                      sourceId={selectedShot?.id}
                      isOwnComment={!!(user?.id === comment.userId)}
                    />
                  </div>

                  {/* Edit/Delete for own comments */}
                  {user?.id === comment.userId && editingCommentId !== comment.id && (
                    <div className="flex gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEditComment(comment)}
                        className="rounded-lg p-1.5 transition-colors active:opacity-70"
                        style={{ color: "rgba(255,255,255,.4)" }}
                        aria-label={t("comments_edit_label")}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteComment(comment.id)}
                        className="rounded-lg p-1.5 transition-colors active:opacity-70"
                        style={{ color: "rgba(255,255,255,.4)" }}
                        aria-label={t("comments_delete_label")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-sm" style={{ color: "rgba(255,255,255,.5)" }}>
                {t("shots_comments_empty")}
              </div>
            )}
          </div>

          {/* Input bar */}
          {selectedShot && (
            <div
              className="flex-shrink-0 flex items-center gap-[10px] px-[16px]"
              style={{
                paddingTop: "12px",
                paddingBottom: "max(28px, env(safe-area-inset-bottom))",
                borderTop: "1px solid rgba(255,255,255,.08)",
              }}
            >
              {/* User avatar */}
              <UserAvatar
                photo={currentUserPhoto}
                nickname={user?.email}
                size="sm"
                className="flex-shrink-0"
              />

              {/* Input field */}
              <input
                type="text"
                placeholder={t("comments_placeholder")}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !isAddingComment && commentText.trim()) {
                    e.preventDefault();
                    handleAddComment();
                  }
                }}
                disabled={isAddingComment}
                className="flex-1 text-[13.5px] outline-none bg-transparent"
                style={{
                  height: "42px",
                  borderRadius: "21px",
                  padding: "0 16px",
                  background: "rgba(255,255,255,.07)",
                  border: "1px solid rgba(255,255,255,.12)",
                  color: "rgba(255,255,255,.95)",
                }}
              />

              {/* Send button */}
              <button
                type="button"
                onClick={handleAddComment}
                disabled={!commentText.trim() || isAddingComment}
                className="flex-shrink-0 flex items-center justify-center transition-all active:scale-90 disabled:opacity-40"
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg,#5b8cff,#9d6bff)",
                  color: "#fff",
                  boxShadow: "0 6px 18px -6px rgba(91,140,255,.5)",
                }}
                aria-label={t("comments_submit")}
              >
                <Send className="h-[17px] w-[17px]" />
              </button>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
