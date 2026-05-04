import * as React from "react";
import { QuickIncentiveOverlay } from "@/components/shared/quick-incentive-overlay";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PostIncentiveButton } from "@/components/shared/post-incentive-button";
import { FollowButton } from "@/components/shared/follow-button";
import { toast } from "@/components/ui/use-toast";
import {
  getShotsDb,
  toggleShotIncentiveDb,
  addShotCommentDb,
  getShotCommentsDb,
  deleteShotCommentDb,
  updateShotCommentDb,
  getFollowingStatusBatchDb,
  deleteShotDb,
  type ShotWithUser,
  type ShotComment,
  type PostIncentiveType,
} from "@/lib/ritmofit-db";
import { MessageCircle, Send, Trash2, VolumeX, Volume2, MoreVertical, Edit2, AlertTriangle, Pencil, Check, X, ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";
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
import { EditShotDescriptionDrawer } from "@/components/profile/edit-shot-description-drawer";
import { CommentReactions } from "@/components/shared/comment-reactions";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { LoadingSpinner } from "@/components/shared/animated-loading";
import { ImageWithFallback } from "@/components/shared/image-with-fallback";
import { UserAvatar } from "@/components/shared/user-avatar";
import { VerifiedBadge } from "@/components/shared/VerifiedBadge";
import { useLanguage } from "@/lib/language-context";

export default function Shots({ footerHeight = 0, isDesktop = false }: { footerHeight?: number; isDesktop?: boolean }) {
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
  const [commentsOpen, setCommentsOpen] = React.useState(false);
  const [selectedShot, setSelectedShot] = React.useState<ShotWithUser | null>(
    null,
  );
  const [comments, setComments] = React.useState<ShotComment[]>([]);
  const [commentText, setCommentText] = React.useState("");
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
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isPaused, setIsPaused] = React.useState(false);
  const [showPauseIcon, setShowPauseIcon] = React.useState(false);
  const pauseIconTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [quickOverlayShotId, setQuickOverlayShotId] = React.useState<string | null>(null);
  const [burstMap, setBurstMap] = React.useState<Record<string, PostIncentiveType | null>>({});
  const lastTapRef = React.useRef<{ shotId: string; time: number } | null>(null);
  const singleTapTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setShowPauseIcon(true);
      if (pauseIconTimerRef.current) clearTimeout(pauseIconTimerRef.current);
      pauseIconTimerRef.current = setTimeout(() => setShowPauseIcon(false), 800);
    }, 300);
  }, []);

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
          video.play().catch((err) => { if (err?.name !== "AbortError") console.error("Erro ao reproduzir vídeo:", err); });
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
          title: "Erro ao enviar incentivo",
          description: err?.message || "Tente novamente.",
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
    [user, togglingIncentives]
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
    []
  );

  const handleAddComment = React.useCallback(async () => {
    if (!commentText.trim() || !selectedShot) return;

    setIsAddingComment(true);
    try {
      await addShotCommentDb(selectedShot.id, commentText, selectedShot.user_id);

      const updatedComments = await getShotCommentsDb(selectedShot.id);
      setComments(updatedComments);
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
  }, [commentText, selectedShot]);

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
      setComments((prev) =>
        prev.map((c) => c.id === commentId ? { ...c, text: editCommentDraft.trim() } : c)
      );
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
      <div className="flex flex-col items-center justify-center h-full w-full bg-black gap-4">
        <LoadingSpinner className="h-12 w-12" />
        <p className="text-sm text-muted-foreground">{t("shots_loading")}</p>
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

  return (
    <div
      className={isDesktop ? "bg-black w-full h-full flex flex-col overflow-hidden" : "bg-black fixed inset-0 flex flex-col overflow-hidden"}
      style={isDesktop ? { overflow: "hidden" } : {
        top: 0,
        left: 0,
        right: 0,
        bottom: `${footerHeight}px`,
        width: "100vw",
        overflow: "hidden",
        paddingTop: "env(safe-area-inset-top)",
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

        {shots.map((shot) => {
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
                <div className="h-full w-full relative" onClick={() => handleVideoTap(shot.id)}>
                  <QuickIncentiveOverlay
                    visible={quickOverlayShotId === shot.id}
                    userLikes={shot.userLikes}
                    onSelect={(type) => {
                      setQuickOverlayShotId(null);
                      setBurstMap((prev) => ({ ...prev, [shot.id]: type }));
                      setTimeout(() => setBurstMap((prev) => ({ ...prev, [shot.id]: null })), 600);
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
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                  {/* Tap feedback icon */}
                  {showPauseIcon && visibleShotId === shot.id && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-black/50 rounded-full p-4 animate-fade-in">
                        {isPaused
                          ? <Pause className="h-10 w-10 text-white" />
                          : <Play className="h-10 w-10 text-white" />
                        }
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
              <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
                <button
                  onClick={() => {
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
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => {
                        setEditingShot(shot);
                        setEditShotOpen(true);
                      }}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        {t("shots_edit_desc")}
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
              <div className="absolute top-4 left-4 z-10 flex items-center gap-3 max-w-[55%]">
                <button
                  onClick={() => navigate(`/usuario/${shot.user_id}`)}
                  className="shrink-0 hover:opacity-80 transition-opacity"
                >
                  <UserAvatar
                    photo={shot.userPhoto}
                    gender={shot.userGender}
                    nickname={shot.userNickname || "Usuário"}
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
                      {shot.userNickname || "Usuário"}
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
                  bottom: isDesktop
                    ? "1rem"
                    : `calc(${footerHeight}px + env(safe-area-inset-bottom) + 0.25rem)`,
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
                    onClick={() => handleOpenComments(shot)}
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

      {/* Comments Drawer */}
      <Drawer
        open={commentsOpen && selectedShot !== null}
        onOpenChange={setCommentsOpen}
      >
        <DrawerContent className="max-h-[80dvh] flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DrawerHeader>
            <DrawerTitle>{t("comments_title")}</DrawerTitle>
            <DrawerDescription className="sr-only">{t("shots_comments_desc")}</DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto space-y-4 px-4 py-4">
            {isLoadingComments ? (
              <p className="text-sm text-muted-foreground text-center">
                {t("comments_loading")}
              </p>
            ) : comments && comments.length > 0 ? (
              comments.map((comment) => (
                <div
                  key={comment.id}
                  className="flex items-start gap-3 pb-3 border-b border-border/60"
                >
                  <UserAvatar
                    photo={comment.userPhoto}
                    gender={comment.userGender}
                    nickname={comment.userName}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {comment.userName || "Usuário"}
                      <span className="ml-1 text-xs text-muted-foreground">
                        {comment.userHandle ? (comment.userHandle.startsWith("@") ? comment.userHandle : `@${comment.userHandle}`) : "@user"}
                      </span>
                    </p>
                    {editingCommentId === comment.id ? (
                      <div className="mt-1 flex flex-col gap-1.5">
                        <textarea
                          value={editCommentDraft}
                          onChange={(e) => setEditCommentDraft(e.target.value)}
                          className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-h-16"
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
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <Check className="h-3 w-3" />
                            {t("comments_edit_save")}
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEditComment}
                            disabled={isSavingEditComment}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50 transition-colors"
                          >
                            <X className="h-3 w-3" />
                            {t("comments_edit_cancel")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-foreground mt-1">
                        {comment.text}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(comment.createdAt).toLocaleString("pt-BR")}
                    </p>
                    <CommentReactions commentType="shot" commentId={comment.id} commentOwnerId={comment.userId} sourceId={selectedShot?.id} isOwnComment={!!(user?.id === comment.userId)} />
                  </div>
                  {user?.id === comment.userId && editingCommentId !== comment.id && (
                    <div className="flex shrink-0 gap-0.5">
                      <button
                        onClick={() => handleStartEditComment(comment)}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1"
                        aria-label={t("comments_edit_label")}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                {t("shots_comments_empty")}
              </p>
            )}
          </div>

          {/* Comment Input */}
          {selectedShot && (
            <div className="flex gap-2 border-t border-border/60 px-4 py-4 items-center">
              <Input
                placeholder={t("comments_placeholder")}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
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
