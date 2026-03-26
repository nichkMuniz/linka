import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PostIncentiveButton } from "@/components/shared/post-incentive-button";
import { toast } from "@/components/ui/use-toast";
import {
  getShotsDb,
  toggleShotIncentiveDb,
  addShotCommentDb,
  getShotCommentsDb,
  deleteShotCommentDb,
  followUserDb,
  unfollowUserDb,
  getFollowingStatusBatchDb,
  updateShotDb,
  deleteShotDb,
  type ShotWithUser,
  type ShotComment,
  type PostIncentiveType,
} from "@/lib/ritmofit-db";
import { MessageCircle, Send, Trash2, UserPlus, UserCheck, VolumeX, Volume2, MoreVertical, Edit2, AlertTriangle } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { LoadingSpinner } from "@/components/shared/animated-loading";

export default function Shots({ footerHeight = 0, isDesktop = false }: { footerHeight?: number; isDesktop?: boolean }) {
  const { user } = useAuth();
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
  const [isFollowingLoading, setIsFollowingLoading] = React.useState<
    Record<string, boolean>
  >({});
  const [showSwipeHint, setShowSwipeHint] = React.useState(
    () => localStorage.getItem("shots_swipe_hint_seen") !== "1"
  );
  const [isMuted, setIsMuted] = React.useState(true);
  const [editShotOpen, setEditShotOpen] = React.useState(false);
  const [editingShot, setEditingShot] = React.useState<ShotWithUser | null>(null);
  const [editShotDescription, setEditShotDescription] = React.useState("");
  const [isSavingEditShot, setIsSavingEditShot] = React.useState(false);
  const [deleteShotDialogOpen, setDeleteShotDialogOpen] = React.useState(false);
  const [deletingShot, setDeletingShot] = React.useState<ShotWithUser | null>(null);
  const [isDeletingShot, setIsDeletingShot] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const videoRefsMap = React.useRef<Record<string, HTMLVideoElement>>({});

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
          title: "Erro ao carregar shots",
          description: err?.message || "Tente novamente.",
        });
        setShotsError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // Set up IntersectionObserver to detect visible shot and auto-play video
  React.useEffect(() => {
    let isMounted = true;
    const observerOptions = {
      root: containerRef.current,
      rootMargin: "0px",
      threshold: [0.5],
    };

    const observer = new IntersectionObserver((entries) => {
      if (!isMounted) return;
      entries.forEach((entry) => {
        const shotId = entry.target.getAttribute("data-shot-id");
        if (!shotId) return;

        if (entry.isIntersecting) {
          setVisibleShotId(shotId);
          const video = videoRefsMap.current[shotId];
          if (video) {
            // AbortError is expected when video is interrupted (e.g. scrolled away) — not a real error
            video.play().catch((err) => { if (err?.name !== "AbortError") console.error("Erro ao reproduzir vídeo:", err); });
          }
        } else {
          const video = videoRefsMap.current[shotId];
          if (video) {
            video.pause();
          }
        }
      });
    }, observerOptions);

    const container = containerRef.current;
    if (container) {
      const shotItems = container.querySelectorAll("[data-shot-id]");
      shotItems.forEach((item) => observer.observe(item));
    }

    return () => {
      isMounted = false;
      observer.disconnect();
    };
  }, [shots]);

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
          title: "Faça login",
          description: "Você precisa estar logado para usar incentivos.",
        });
        return;
      }

      const incentiveKey = `${shot.id}-${type}`;
      if (togglingIncentives.has(incentiveKey)) return;

      setTogglingIncentives((prev) => new Set(prev).add(incentiveKey));

      try {
        await toggleShotIncentiveDb(shot.id, type, shot.user_id);

        // Update local state (userLikes and likes counters)
        setShots((prev) =>
          prev.map((r) => {
            if (r.id !== shot.id) return r;

            const userLikes = r.userLikes || [];
            const isRemoving = userLikes.includes(type);
            const newUserLikes = isRemoving
              ? userLikes.filter((t) => t !== type)
              : [...userLikes, type];

            const delta = isRemoving ? -1 : 1;
            const typeKeyMap: Record<number, keyof typeof r.likes> = {
              1: "apoio",
              2: "continua",
              3: "ganhador",
              4: "consegueMais",
              5: "limiteMaior",
              6: "maisAlgum",
            };
            const key = typeKeyMap[type];
            const newLikes = key
              ? { ...r.likes, [key]: Math.max(0, (r.likes[key] ?? 0) + delta) }
              : r.likes;

            return { ...r, userLikes: newUserLikes, likes: newLikes };
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
    if (!commentText.trim() || !selectedShot) return;

    setIsAddingComment(true);
    try {
      await addShotCommentDb(selectedShot.id, commentText, selectedShot.user_id);

      const updatedComments = await getShotCommentsDb(selectedShot.id);
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
  }, [commentText, selectedShot]);

  const handleDeleteComment = React.useCallback(async (commentId: string) => {
    if (!confirm("Tem certeza que deseja deletar este comentário?")) return;

    try {
      await deleteShotCommentDb(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      toast({
        title: "Sucesso",
        description: "Comentário deletado com sucesso.",
      });
    } catch (err: any) {
      console.error("Error deleting comment:", err);
      toast({
        title: "Erro ao deletar comentário",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  }, []);

  const handleFollowUser = React.useCallback(
    async (userId: string) => {
      if (!user) {
        toast({
          title: "Faça login",
          description: "Você precisa estar logado para seguir usuários.",
        });
        return;
      }

      // Guard against double-click / concurrent requests for the same user
      if (isFollowingLoading[userId]) return;

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
    [user, followingStatus, isFollowingLoading]
  );

  const handleConfirmDeleteShot = React.useCallback(async () => {
    if (!deletingShot) return;
    setIsDeletingShot(true);
    try {
      const ok = await deleteShotDb(deletingShot.id);
      if (ok) {
        setShots((prev) => prev.filter((r) => r.id !== deletingShot.id));
        toast({ title: "Clip deletado com sucesso." });
      } else {
        toast({ title: "Erro ao deletar clip", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro ao deletar clip", description: err?.message, variant: "destructive" });
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
        <p className="text-sm text-muted-foreground">Carregando clips...</p>
      </div>
    );
  }

  if (!loading && shotsError) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-black">
        <p className="text-sm text-muted-foreground">
          Erro ao carregar clips. Tente novamente.
        </p>
      </div>
    );
  }

  if (!loading && shots.length === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-black">
        <p className="text-sm text-muted-foreground">
          Nenhum clip disponível ainda.
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
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Vídeo indisponível
                </div>
              )}

              {/* Gradient Overlay for Better Text Visibility */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />

              {/* Top-right controls */}
              <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
                <button
                  onClick={() => {
                    const newMuted = !isMuted;
                    setIsMuted(newMuted);
                    Object.values(videoRefsMap.current).forEach((v) => { v.muted = newMuted; });
                  }}
                  className="flex items-center gap-1.5 bg-black/40 hover:bg-black/60 text-white rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                  aria-label={isMuted ? "Ativar som" : "Silenciar"}
                >
                  {isMuted ? (
                    <><VolumeX className="h-4 w-4" /><span>Mudo</span></>
                  ) : (
                    <><Volume2 className="h-4 w-4" /><span>Som</span></>
                  )}
                </button>
                {user?.id === shot.user_id && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button aria-label="Opções do clipe" className="flex items-center justify-center h-8 w-8 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => {
                        setEditingShot(shot);
                        setEditShotDescription(shot.description || "");
                        setEditShotOpen(true);
                      }}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Editar descrição
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => {
                          setDeletingShot(shot);
                          setDeleteShotDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir clip
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {/* User Info - Top Left */}
              <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
                <button
                  onClick={() => navigate(`/usuario/${shot.user_id}`)}
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                >
                  {shot.userPhoto && (
                    <img
                      src={shot.userPhoto}
                      alt={shot.userNickname || "Usuário"}
                      className="h-12 w-12 rounded-full object-cover border-2 border-white/30 shadow-lg"
                    />
                  )}
                  <div>
                    <p className="text-sm font-bold text-white drop-shadow-md">
                      {shot.userNickname || "Usuário"}
                    </p>
                  </div>
                </button>
                {user && user.id !== shot.user_id && (
                  <button
                    onClick={() => handleFollowUser(shot.user_id)}
                    disabled={isFollowingLoading[shot.user_id]}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                      followingStatus[shot.user_id]
                        ? "bg-white/20 text-white hover:bg-white/30"
                        : "bg-white text-black hover:bg-white/90"
                    } disabled:opacity-50`}
                  >
                    {followingStatus[shot.user_id] ? (
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
                {shot.description && (
                  <p className="text-sm text-white drop-shadow-md leading-relaxed">
                    {shot.description}
                  </p>
                )}
              </div>

              {/* Incentive Buttons + Comments - Right Side */}
              <div className="absolute right-6 bottom-20 flex flex-col gap-3 z-20">
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
                    <MessageCircle className="h-7 w-7 text-white hover:scale-110 transition-transform" />
                    {(shot.commentCount || 0) > 0 && (
                      <span className="text-xs text-white/70 font-medium">
                        {shot.commentCount}
                      </span>
                    )}
                  </div>
                </button>
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
              Deslize para ver mais clips
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
            Entendi
          </button>
        </div>
      )}

      {/* Edit Shot Drawer */}
      <Drawer open={editShotOpen} onOpenChange={setEditShotOpen}>
        <DrawerContent className="max-h-[80dvh] flex flex-col z-[100]">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>Editar descrição</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
            <Textarea
              value={editShotDescription}
              onChange={(e) => setEditShotDescription(e.target.value)}
              placeholder="Descrição do clip..."
              className="min-h-28 resize-none"
              autoFocus
            />
            <Button
              className="w-full rounded-full"
              disabled={isSavingEditShot}
              onClick={async () => {
                if (!editingShot) return;
                setIsSavingEditShot(true);
                try {
                  const ok = await updateShotDb(editingShot.id, editShotDescription);
                  if (ok) {
                    setShots((prev) => prev.map((r) => r.id === editingShot.id ? { ...r, description: editShotDescription } : r));
                    toast({ title: "Clip atualizado!" });
                    setEditShotOpen(false);
                    setEditingShot(null);
                  } else {
                    toast({ title: "Erro ao salvar", variant: "destructive" });
                  }
                } catch (err: any) {
                  toast({ title: "Erro ao salvar", description: err?.message, variant: "destructive" });
                } finally {
                  setIsSavingEditShot(false);
                }
              }}
            >
              {isSavingEditShot ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Delete Shot Confirmation Dialog */}
      <AlertDialog open={deleteShotDialogOpen} onOpenChange={setDeleteShotDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Excluir clip
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este clip? Esta ação não pode ser desfeita. O vídeo, curtidas e comentários serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingShot}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteShot}
              disabled={isDeletingShot}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {isDeletingShot ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Comments Drawer */}
      <Drawer
        open={commentsOpen && selectedShot !== null}
        onOpenChange={setCommentsOpen}
      >
        <DrawerContent className="max-h-[80dvh] flex flex-col">
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
          {selectedShot && (
            <div className="flex gap-2 border-t border-border/60 px-4 py-4">
              <Input
                placeholder="Adicione um comentário..."
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
