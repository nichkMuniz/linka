import * as React from "react";
import { getFeedPosts, getDiscoverPosts, togglePostLike } from "../services/post.service";
import { Card, CardContent } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PostIncentiveButton } from "@/components/post-incentive-button";
import { PostCommentsDialog } from "@/components/post-comments-dialog";
import { ImageWithFallback } from "@/components/image-with-fallback";
import { toast } from "@/components/ui/use-toast";
import {
  getRoutinesByGoalIdDb,
  getActiveStoriesDb,
  getUserProfileDb,
  createStoryDb,
  deleteOldStoriesDb,
  getFlowViewersDb,
  createUserGoalDb,
  getUserGoalsDb,
  deletePostDb,
  getPostLikeUsersDb,
  type PostIncentiveType,
  type StoryWithUser,
} from "@/lib/ritmofit-db";
import { PostLikesModal } from "@/components/post-likes-modal";
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
import { ChevronDown, MoreVertical, Flag, Trash2, Share2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { formatTimeAgo } from "@/lib/utils";
import { LoadingSpinner, PostSkeleton } from "@/components/animated-loading";
import type { PostWithStats } from "../services/post.service";
import { StoriesCarousel } from "@/components/stories-carousel";
import { StoryCreationDialog } from "@/components/story-creation-dialog";
import { StoryViewerModal } from "@/components/story-viewer-modal";
import { PostCarousel } from "@/components/post-carousel";
import { UserInsignias } from "@/components/user-insignias";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export default function Index() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = React.useState<PostWithStats[]>([]);
  const [stories, setStories] = React.useState<StoryWithUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [togglingPostId, setTogglingPostId] = React.useState<string | null>(
    null,
  );
  const [goalModalOpen, setGoalModalOpen] = React.useState(false);
  const [selectedGoalPost, setSelectedGoalPost] =
    React.useState<PostWithStats | null>(null);
  const [linkedRoutines, setLinkedRoutines] = React.useState<any[]>([]);

  const [expandedRoutines, setExpandedRoutines] = React.useState(false);
  const [storyCreationOpen, setStoryCreationOpen] = React.useState(false);
  const [selectedStory, setSelectedStory] =
    React.useState<StoryWithUser | null>(null);
  const [storyViewerOpen, setStoryViewerOpen] = React.useState(false);
  const [isCreatingStory, setIsCreatingStory] = React.useState(false);
  const [currentUserPhoto, setCurrentUserPhoto] = React.useState<string | null>(null);
  const [ownerHasViewedFlow, setOwnerHasViewedFlow] = React.useState(false);
  const [flowViewCount, setFlowViewCount] = React.useState<number | undefined>(undefined);
  const [reportDialogOpen, setReportDialogOpen] = React.useState(false);
  const [reportType, setReportType] = React.useState<"user" | "post" | null>(
    null,
  );
  const [reportedPost, setReportedPost] = React.useState<PostWithStats | null>(
    null,
  );
  const [reportReason, setReportReason] = React.useState<string>("");
  const [isSubmittingReport, setIsSubmittingReport] = React.useState(false);
  const [unreadCommentsByPost] = React.useState<Record<string, number>>({});
  const [isCopyingGoal, setIsCopyingGoal] = React.useState(false);
  const [hasAlreadyCopiedGoal, setHasAlreadyCopiedGoal] = React.useState(false);
  const [feedMode, setFeedMode] = React.useState<"following" | "discover">("following");
  const [discoverPosts, setDiscoverPosts] = React.useState<PostWithStats[]>([]);
  const [discoverLoading, setDiscoverLoading] = React.useState(false);
  const [discoverLoaded, setDiscoverLoaded] = React.useState(false);
  const [tabBarHidden, setTabBarHidden] = React.useState(false);
  const [likesModalOpen, setLikesModalOpen] = React.useState(false);
  const [selectedPostForLikes, setSelectedPostForLikes] = React.useState<PostWithStats | null>(null);
  const [postLikes, setPostLikes] = React.useState<Array<{
    userId: string;
    userNickname: string;
    userPhoto: string | null;
    type: number;
  }>>([]);
  const [confirmDialog, setConfirmDialog] = React.useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: "", description: "", onConfirm: () => {} });

  const showConfirm = React.useCallback(
    (title: string, description: string, onConfirm: () => void) => {
      setConfirmDialog({ open: true, title, description, onConfirm });
    },
    [],
  );

  React.useEffect(() => {
    (async () => {
      try {
        const [postsData, storiesData] = await Promise.all([
          getFeedPosts(),
          getActiveStoriesDb(),
        ]);
        setPosts(postsData);
        setStories(storiesData);

        // Get current user's story for flow viewer count (photo is loaded separately in the useEffect below)
        const userStory = storiesData.find((s: StoryWithUser) => s.user_id === user?.id);
        // Fallback: if profile photo not yet loaded, use story photo
        if (userStory?.userPhoto) setCurrentUserPhoto((prev) => prev || userStory.userPhoto);
        if (userStory) {
          getFlowViewersDb(userStory.id)
            .then((viewers) => setFlowViewCount(viewers.length))
            .catch((err) => console.error("Erro ao carregar visualizações do flow:", err));
        }

        // Clean up old stories in background
        deleteOldStoriesDb().catch((err) =>
          console.error("Error cleaning old stories:", err),
        );
      } catch (err: any) {
        console.error("Erro ao carregar feed:", err?.message || err);
        toast({
          title: "Erro ao carregar feed",
          description: err?.message || "Tente novamente.",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load current user's profile photo whenever user becomes available
  React.useEffect(() => {
    if (!user?.id) return;
    getUserProfileDb(user.id)
      .then((profile) => {
        if (profile?.photo) setCurrentUserPhoto(profile.photo);
      })
      .catch((err) => console.error("Erro ao carregar foto do perfil:", err));
  }, [user?.id]);

  // Sync tab bar visibility with header scroll behavior
  React.useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY;
        // 96px = header height; hide tab bar only after user scrolled past it
        // delta > 30 / < -30 = ignore micro-movements to avoid jitter
        if (y > 96 && delta > 30) setTabBarHidden(true);
        if (delta < -30) setTabBarHidden(false);
        lastY = y;
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);


  const handleCreateStory = React.useCallback(
    async (mediaDataUrl: string, description: string) => {
      setIsCreatingStory(true);
      try {
        if (!user || !supabase) throw new Error("User not authenticated");

        // Convert data URL to Blob - preserves original MIME type
        const response = await fetch(mediaDataUrl);
        const blob = await response.blob();

        // Extract extension from blob MIME type
        const mimeType = blob.type || "image/jpeg";
        const extension = mimeType.split("/")[1] || "jpg";
        const fileName = `${Date.now()}-story.${extension}`;
        const filePath = `${user.id}/stories/${fileName}`;

        // Upload to Supabase storage
        const { error: uploadError } = await supabase.storage
          .from("posts")
          .upload(filePath, blob);

        if (uploadError) throw uploadError;

        // Get public URL
        const {
          data: { publicUrl },
        } = supabase.storage.from("posts").getPublicUrl(filePath);
        const publicMediaUrl = publicUrl;

        // Create story with public URL
        const newStory = await createStoryDb(description, publicMediaUrl);
        if (newStory && user) {
          // Add the new story to the list
          const enrichedStory: StoryWithUser = {
            ...newStory,
            userNickname: user.email?.split("@")[0] || "Você",
            userPhoto: null,
          };
          setStories((prev) => [enrichedStory, ...prev]);
          setOwnerHasViewedFlow(false);
          setFlowViewCount(0);
        }
      } catch (err: any) {
        console.error("Error creating story:", err);
        throw err;
      } finally {
        setIsCreatingStory(false);
      }
    },
    [user],
  );

  const handleStoryClick = React.useCallback((story: StoryWithUser) => {
    setSelectedStory(story);
    setStoryViewerOpen(true);
    // Mark as viewed so the green dot turns gray for the owner
    if (story.user_id === user?.id) {
      setOwnerHasViewedFlow(true);
    }
  }, [user?.id]);

  // Use refs to avoid stale closures without making stories/selectedStory deps
  const storiesRef = React.useRef(stories);
  const selectedStoryRef = React.useRef(selectedStory);
  React.useEffect(() => { storiesRef.current = stories; }, [stories]);
  React.useEffect(() => { selectedStoryRef.current = selectedStory; }, [selectedStory]);

  const handleSkipStory = React.useCallback(() => {
    const current = selectedStoryRef.current;
    if (!current) return;
    const sortedStories = [...storiesRef.current].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const currentIndex = sortedStories.findIndex((s) => s.id === current.id);
    if (currentIndex < sortedStories.length - 1) {
      setSelectedStory(sortedStories[currentIndex + 1]);
    } else {
      setStoryViewerOpen(false);
    }
  }, []);

  const handlePrevStory = React.useCallback(() => {
    const current = selectedStoryRef.current;
    if (!current) return;
    const sortedStories = [...storiesRef.current].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const currentIndex = sortedStories.findIndex((s) => s.id === current.id);
    if (currentIndex > 0) {
      setSelectedStory(sortedStories[currentIndex - 1]);
    }
  }, []);

  const handleAddStoryClick = React.useCallback(() => {
    setStoryCreationOpen(true);
  }, []);

  const openGoalModal = React.useCallback(async (post: PostWithStats) => {
    setSelectedGoalPost(post);
    setGoalModalOpen(true);
    setExpandedRoutines(false);
    setHasAlreadyCopiedGoal(false);

    // Fetch routines and user goals in parallel
    if (post.userGoal) {
      try {
        const shouldCheckCopy = user && post.user_id !== user.id;
        const [routines, userGoalsData] = await Promise.all([
          getRoutinesByGoalIdDb(post.userGoal.goal_id),
          shouldCheckCopy ? getUserGoalsDb() : Promise.resolve(null),
        ]);
        setLinkedRoutines(routines);

        if (shouldCheckCopy && userGoalsData) {
          const alreadyCopied = userGoalsData.some(
            (goal) => goal.goal_id === post.userGoal!.goal_id
          );
          setHasAlreadyCopiedGoal(alreadyCopied);
        }
      } catch (err) {
        console.error("Error fetching routines:", err);
        setLinkedRoutines([]);
      }
    }
  }, [user]);

  const handleCopyGoal = React.useCallback(async () => {
    if (!selectedGoalPost?.userGoal || !user) return;

    setIsCopyingGoal(true);
    try {
      await createUserGoalDb(
        selectedGoalPost.userGoal.goal_id,
        user.id,
        selectedGoalPost.userGoal.type_goal,
        selectedGoalPost.userGoal.duration,
        selectedGoalPost.userGoal.quantity,
      );

      toast({
        title: "Meta copiada com sucesso!",
        description: "Você agora tem a mesma meta que este usuário.",
      });

      setGoalModalOpen(false);
    } catch (err: any) {
      console.error("Error copying goal:", err);
      toast({
        title: "Erro ao copiar meta",
        description: err?.message || "Tente novamente.",
      });
    } finally {
      setIsCopyingGoal(false);
    }
  }, [selectedGoalPost?.userGoal, user]);

  const handleToggleLike = React.useCallback(
    async (postId: string, incentiveType: PostIncentiveType) => {
      try {
        setTogglingPostId(postId);

        // Update UI optimistically
        setPosts((prev) =>
          prev.map((post) => {
            if (post.id !== postId) return post;

            const wasActive = post.userLikes.includes(incentiveType);
            const newUserLikes = wasActive
              ? post.userLikes.filter((t) => t !== incentiveType)
              : [...post.userLikes, incentiveType];

            const likesMap = {
              apoio: post.likes.apoio,
              continua: post.likes.continua,
              ganhador: post.likes.ganhador,
              consegueMais: post.likes.consegueMais,
              limiteMaior: post.likes.limiteMaior,
              maisAlgum: post.likes.maisAlgum,
            };
            if (incentiveType === 1) likesMap.apoio += wasActive ? -1 : 1;
            else if (incentiveType === 2)
              likesMap.continua += wasActive ? -1 : 1;
            else if (incentiveType === 3)
              likesMap.ganhador += wasActive ? -1 : 1;
            else if (incentiveType === 4)
              likesMap.consegueMais += wasActive ? -1 : 1;
            else if (incentiveType === 5)
              likesMap.limiteMaior += wasActive ? -1 : 1;
            else if (incentiveType === 6)
              likesMap.maisAlgum += wasActive ? -1 : 1;

            return {
              ...post,
              likes: likesMap,
              userLikes: newUserLikes,
            };
          }),
        );

        await togglePostLike(postId, incentiveType);
      } catch (err: any) {
        console.error("Erro ao toggle like:", err);
        toast({
          title: "Erro ao reagir",
          description: err?.message || "Tente novamente.",
        });
        // Refetch to restore correct state
        const data = await getFeedPosts();
        setPosts(data);
      } finally {
        setTogglingPostId(null);
      }
    },
    [],
  );

  const handleSharePost = React.useCallback((post: PostWithStats) => {
    const text = `Confira o post de @${post.userNickname} no Linka! 💪${post.description ? `\n"${post.description}"` : ""}`;
    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).catch(() => {});
      toast({ title: "Copiado!", description: "Link copiado para a área de transferência." });
    }
  }, []);

  const handleReportUser = React.useCallback((post: PostWithStats) => {
    setReportedPost(post);
    setReportType("user");
    setReportReason("");
    setReportDialogOpen(true);
  }, []);

  const handleReportPost = React.useCallback((post: PostWithStats) => {
    setReportedPost(post);
    setReportType("post");
    setReportReason("");
    setReportDialogOpen(true);
  }, []);

  const handleOpenLikesModal = React.useCallback(async (post: PostWithStats) => {
    try {
      const likes = await getPostLikeUsersDb(post.id);
      setPostLikes(likes);
      setSelectedPostForLikes(post);
      setLikesModalOpen(true);
    } catch (err) {
      console.error("Error loading post likes:", err);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os incentivos.",
        variant: "destructive",
      });
    }
  }, []);

  const handleDeletePost = React.useCallback(
    (post: PostWithStats) => {
      if (!user) {
        toast({
          title: "Erro",
          description: "Você precisa estar logado para deletar um post.",
          variant: "destructive",
        });
        return;
      }

      showConfirm(
        "Excluir post",
        "Tem certeza que deseja excluir este post? Esta ação não pode ser desfeita.",
        async () => {
          try {
            await deletePostDb(post.id);
            setPosts((prev) => prev.filter((p) => p.id !== post.id));
            toast({ title: "Sucesso", description: "Post deletado com sucesso." });
          } catch (err: any) {
            console.error("Error deleting post:", err);
            toast({
              title: "Erro ao deletar post",
              description: err?.message || "Não foi possível deletar o post. Tente novamente.",
              variant: "destructive",
            });
          }
        },
      );
    },
    [user, showConfirm],
  );

  const submitReport = React.useCallback(async () => {
    if (!reportType || !reportedPost || !reportReason.trim()) {
      toast({
        title: "Erro",
        description: "Selecione um motivo para continuar.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingReport(true);

    try {
      if (reportType === "user") {
        const { reportUserDb } = await import("@/lib/ritmofit-db");
        await reportUserDb(reportedPost.user_id, reportReason);
      } else {
        const { reportPostDb } = await import("@/lib/ritmofit-db");
        await reportPostDb(reportedPost.id, reportReason);
      }

      toast({
        title: "Denúncia enviada",
        description: `Obrigado por denunciar este ${reportType === "user" ? "usuário" : "post"}. Nós analisaremos em breve.`,
      });

      setReportDialogOpen(false);
      setReportType(null);
      setReportedPost(null);
      setReportReason("");
    } catch (err: any) {
      console.error("Error submitting report:", err);
      toast({
        title: "Erro ao enviar denúncia",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingReport(false);
    }
  }, [reportType, reportedPost, reportReason]);

  const handleSwitchToDiscover = React.useCallback(async () => {
    setFeedMode("discover");
    if (discoverLoaded) return;
    setDiscoverLoading(true);
    try {
      const data = await getDiscoverPosts();
      setDiscoverPosts(data);
      setDiscoverLoaded(true);
    } catch (err: any) {
      console.error("Erro ao carregar posts de descoberta:", err);
      toast({
        title: "Erro ao carregar posts",
        description: err?.message || "Tente novamente.",
      });
    } finally {
      setDiscoverLoading(false);
    }
  }, [discoverLoaded]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-2xl flex flex-col">
        {/* Placeholder para o carrossel de stories durante carregamento */}
        <div className="h-24 bg-background border-b border-border/60 animate-pulse" />
        <div className="grid w-full gap-3 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <PostSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex flex-col">
      {/* Stories Carousel */}
      <div className="bg-background border-b border-border/60">
        <StoriesCarousel
          stories={stories}
          onAddStoryClick={handleAddStoryClick}
          onStoryClick={handleStoryClick}
          currentUserId={user?.id || ""}
          currentUserPhoto={currentUserPhoto}
          isOwnerViewing={ownerHasViewedFlow}
          viewCount={flowViewCount}
        />
      </div>

      {/* Feed Mode Toggle */}
      <div className={`sticky top-16 z-40 bg-background/90 backdrop-blur border-b border-border/60 px-4 py-2 flex gap-2 transition-transform duration-200 ${tabBarHidden ? "-translate-y-[calc(100%+4rem)] pointer-events-none" : "translate-y-0"}`}>
        <button
          onClick={() => setFeedMode("following")}
          className={`flex-1 rounded-full py-1.5 text-sm font-medium transition-colors ${
            feedMode === "following"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Seguindo
        </button>
        <button
          onClick={handleSwitchToDiscover}
          className={`flex-1 rounded-full py-1.5 text-sm font-medium transition-colors ${
            feedMode === "discover"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Descobrir
        </button>
      </div>

      {/* Feed Content */}
      <div>
        <div className="grid w-full gap-3 p-4">
          {feedMode === "discover" ? (
            discoverLoading ? (
              <>
                {[1, 2, 3].map((i) => (
                  <PostSkeleton key={i} />
                ))}
              </>
            ) : discoverPosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                <p className="text-sm font-medium">Nenhum post novo por aqui</p>
                <p className="text-xs text-muted-foreground">Siga mais pessoas para ver posts aqui ou volte depois.</p>
              </div>
            ) : (
              discoverPosts.map((post) => (
              <Card
                key={`discover-${post.id}`}
                className="border-border/60 relative overflow-hidden fade-in"
              >
                <CardContent className="space-y-3 p-0">
                  {/* Image Container with User Info Overlay */}
                  <div className="relative">
                    {post.photos && post.photos.length > 0 ? (
                      <PostCarousel photos={post.photos} alt="Post" />
                    ) : (
                      <ImageWithFallback
                        src={post.photo}
                        alt="Post"
                        fallback="/placeholder.svg"
                        className="w-full object-cover rounded-lg"
                      />
                    )}

                    {/* User Info Overlay - Bottom Left */}
                    <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-3 p-3 bg-gradient-to-t from-black/60 via-black/30 to-transparent">
                      <button
                        onClick={() => navigate(`/usuario/${post.user_id}`)}
                        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                      >
                        {post.userPhoto ? (
                          <ImageWithFallback
                            src={post.userPhoto}
                            alt={post.userNickname}
                            fallback="/placeholder.svg"
                            className="h-8 w-8 rounded-full object-cover border border-white/30"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-white/30" />
                        )}
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-medium text-white drop-shadow-sm">
                            {post.userNickname}
                          </span>
                          <UserInsignias userId={post.user_id} maxBadges={2} />
                        </div>
                      </button>
                      {/* Menu Button */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-white hover:bg-white/20"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => handleSharePost(post)}>
                            <Share2 className="h-4 w-4 mr-2" />
                            Compartilhar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {user?.id === post.user_id ? (
                            <DropdownMenuItem
                              onClick={() => handleDeletePost(post)}
                              className="text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir post
                            </DropdownMenuItem>
                          ) : (
                            <>
                              <DropdownMenuItem
                                onClick={() => handleReportUser(post)}
                              >
                                <Flag className="h-4 w-4 mr-2" />
                                Denunciar usuário
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleReportPost(post)}
                              >
                                <Flag className="h-4 w-4 mr-2" />
                                Denunciar post
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Incentive Icons - Below User Info, Above Description */}
                  <div className="flex items-center justify-between px-2 pt-2 border-t border-border/60">
                    <div className="flex items-center gap-0.5">
                      {([1, 2, 3, 4, 5, 6] as PostIncentiveType[]).map((type) => (
                        <PostIncentiveButton
                          key={type}
                          type={type}
                          isActive={post.userLikes.includes(type)}
                          onClick={() => handleToggleLike(post.id, type)}
                          loading={togglingPostId === post.id}
                        />
                      ))}
                    </div>
                    <PostCommentsDialog
                      postId={post.id}
                      commentCount={post.commentCount}
                      hasActivity={post.hasActivity}
                      isPostOwner={post.user_id === user?.id}
                      hasUnreadComments={
                        (unreadCommentsByPost[post.id] ?? 0) > 0
                      }
                    />
                  </div>

                  {/* Likes Label */}
                  {Object.values(post.likes).reduce((sum: number, val: number) => sum + val, 0) > 0 && (
                    <button
                      onClick={() => handleOpenLikesModal(post)}
                      className="px-4 py-1 text-left text-sm text-foreground/70 hover:text-foreground transition-colors"
                    >
                      <span className="font-medium">
                        {Object.values(post.likes).reduce((sum: number, val: number) => sum + val, 0)} Incentivos
                      </span>
                    </button>
                  )}

                  {/* Post Content */}
                  <div className="px-4 pt-1 pb-4 space-y-3">
                    {post.description && (
                      <p className="text-sm leading-relaxed">
                        {post.description}
                      </p>
                    )}

                    {/* Goal Progress Bar */}
                    {post.userGoal && (
                      <button
                        onClick={() => openGoalModal(post)}
                        className="w-full space-y-3 pt-3 text-left hover:opacity-80 transition-opacity rounded-lg p-3 bg-muted/30 hover:bg-muted/50"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-foreground">
                            {post.userGoal.description}
                          </span>
                          <span className="text-sm font-bold text-brand">
                            {Math.round(post.userGoal.perc)}%
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-4 overflow-hidden">
                          <div
                            className="bg-brand h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${post.userGoal.perc}%`,
                            }}
                          />
                        </div>
                      </button>
                    )}

                    <p className="text-xs text-muted-foreground pt-1">
                      {formatTimeAgo(post.created_at)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))
            )
          ) : (
            /* Following mode */
            posts.length ? (
              posts.map((post) => (
                <Card
                  key={post.id}
                  className="border-border/60 relative overflow-hidden fade-in"
                >
                  <CardContent className="space-y-3 p-0">
                    {/* Image Container with User Info Overlay */}
                    <div className="relative">
                      {post.photos && post.photos.length > 0 ? (
                        <PostCarousel photos={post.photos} alt="Post" />
                      ) : (
                        <ImageWithFallback
                          src={post.photo}
                          alt="Post"
                          fallback="/placeholder.svg"
                          className="w-full object-cover rounded-lg"
                        />
                      )}

                      {/* User Info Overlay - Bottom Left */}
                      <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-3 p-3 bg-gradient-to-t from-black/60 via-black/30 to-transparent">
                        <button
                          onClick={() => navigate(`/usuario/${post.user_id}`)}
                          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                        >
                          {post.userPhoto ? (
                            <ImageWithFallback
                              src={post.userPhoto}
                              alt={post.userNickname}
                              fallback="/placeholder.svg"
                              className="h-8 w-8 rounded-full object-cover border border-white/30"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-white/30" />
                          )}
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-medium text-white drop-shadow-sm">
                              {post.userNickname}
                            </span>
                            <UserInsignias userId={post.user_id} maxBadges={2} />
                          </div>
                        </button>
                        {/* Menu Button */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-white hover:bg-white/20"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => handleSharePost(post)}>
                              <ChevronDown className="h-4 w-4 mr-2 rotate-[-90deg]" />
                              Compartilhar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {user?.id === post.user_id ? (
                              <DropdownMenuItem
                                onClick={() => handleDeletePost(post)}
                                className="text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir post
                              </DropdownMenuItem>
                            ) : (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleReportUser(post)}
                                >
                                  <Flag className="h-4 w-4 mr-2" />
                                  Denunciar usuário
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleReportPost(post)}
                                >
                                  <Flag className="h-4 w-4 mr-2" />
                                  Denunciar post
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Incentive Icons - Below User Info, Above Description */}
                    <div className="flex items-center px-2 pt-2 border-t border-border/60">
                      <div className="flex flex-1 items-center justify-between">
                        {([1, 2, 3, 4, 5, 6] as PostIncentiveType[]).map((type) => (
                          <PostIncentiveButton
                            key={type}
                            type={type}
                            isActive={post.userLikes.includes(type)}
                            onClick={() => handleToggleLike(post.id, type)}
                            loading={togglingPostId === post.id}
                          />
                        ))}
                      </div>
                      <PostCommentsDialog
                        postId={post.id}
                        commentCount={post.commentCount}
                        hasActivity={post.hasActivity}
                        isPostOwner={post.user_id === user?.id}
                        hasUnreadComments={
                          (unreadCommentsByPost[post.id] ?? 0) > 0
                        }
                      />
                    </div>

                    {/* Likes Label */}
                    {Object.values(post.likes).reduce((sum: number, val: number) => sum + val, 0) > 0 && (
                      <button
                        onClick={() => handleOpenLikesModal(post)}
                        className="px-4 py-1 text-left text-sm text-foreground/70 hover:text-foreground transition-colors"
                      >
                        <span className="font-medium">
                          {Object.values(post.likes).reduce((sum: number, val: number) => sum + val, 0)} Incentivos
                        </span>
                      </button>
                    )}

                    {/* Post Content */}
                    <div className="px-4 pt-1 pb-4 space-y-3">
                      {post.description && (
                        <p className="text-sm leading-relaxed">
                          {post.description}
                        </p>
                      )}

                      {/* Goal Progress Bar */}
                      {post.userGoal && (
                        <button
                          onClick={() => openGoalModal(post)}
                          className="w-full space-y-3 pt-3 text-left hover:opacity-80 transition-opacity rounded-lg p-3 bg-muted/30 hover:bg-muted/50"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-foreground">
                              {post.userGoal.description}
                            </span>
                            <span className="text-sm font-bold text-brand">
                              {Math.round(post.userGoal.perc)}%
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-4 overflow-hidden">
                            <div
                              className="bg-brand h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${post.userGoal.perc}%`,
                              }}
                            />
                          </div>
                        </button>
                      )}

                      <p className="text-xs text-muted-foreground pt-1">
                        {formatTimeAgo(post.created_at)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="flex flex-col items-center py-16 gap-6 text-center px-4">
                <div className="w-16 h-16 rounded-full bg-brand/10 flex items-center justify-center">
                  <span className="text-3xl">🏋️</span>
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold">Seu feed está vazio</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Siga pessoas para ver os treinos delas aqui, ou explore o que está acontecendo na comunidade.
                  </p>
                </div>
                <div className="flex flex-col gap-2 w-full max-w-xs">
                  <Button className="rounded-full w-full" onClick={() => navigate("/buscar")}>
                    Buscar pessoas
                  </Button>
                  <Button variant="outline" className="rounded-full w-full" onClick={() => setFeedMode("discover")}>
                    Explorar posts
                  </Button>
                  <Button variant="ghost" className="rounded-full w-full text-sm" onClick={() => navigate("/metas")}>
                    Configurar minha primeira rotina
                  </Button>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* Story Creation Dialog */}
      <StoryCreationDialog
        open={storyCreationOpen}
        onOpenChange={setStoryCreationOpen}
        onCreateStory={handleCreateStory}
        isLoading={isCreatingStory}
      />

      {/* Story Viewer Modal */}
      <StoryViewerModal
        story={selectedStory}
        stories={stories}
        open={storyViewerOpen}
        onOpenChange={setStoryViewerOpen}
        onNextStory={handleSkipStory}
        onPrevStory={handlePrevStory}
      />

      {/* Goal Progress Modal */}
      <Drawer open={goalModalOpen} onOpenChange={setGoalModalOpen}>
        <DrawerContent className="max-h-[70vh] flex flex-col">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>Progresso da Meta</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col flex-1 gap-4 overflow-hidden px-4 pb-4">
            {selectedGoalPost?.userGoal && (
              <div className="space-y-4 flex-1">
                {/* Goal Info */}
                <div className="p-4 border border-border/60 rounded-lg bg-muted/30 space-y-3">
                  <div>
                    <p className="text-lg font-bold">
                      {selectedGoalPost.userGoal.description}
                    </p>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-foreground">
                        Progresso
                      </span>
                      <span className="text-lg font-bold text-brand">
                        {Math.round(selectedGoalPost.userGoal.perc)}%
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-5 overflow-hidden">
                      <div
                        className="bg-brand h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${selectedGoalPost.userGoal.perc}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Goal Details */}
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div className="p-2 bg-background/50 rounded text-center">
                      <p className="text-xs text-muted-foreground">Duração</p>
                      <p className="text-sm font-bold">
                        {selectedGoalPost.userGoal.duration}d
                      </p>
                    </div>
                    <div className="p-2 bg-background/50 rounded text-center">
                      <p className="text-xs text-muted-foreground">
                        Quantidade
                      </p>
                      <p className="text-sm font-bold">
                        {selectedGoalPost.userGoal.quantity}
                      </p>
                    </div>
                    <div className="p-2 bg-background/50 rounded text-center">
                      <p className="text-xs text-muted-foreground">Tipo</p>
                      <p className="text-sm font-bold">
                        {selectedGoalPost.userGoal.type_goal === 1
                          ? "Fitness"
                          : selectedGoalPost.userGoal.type_goal === 2
                            ? "Saúde"
                            : "Hábitos"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Linked Routines Dropdown or Link Option */}
                {selectedGoalPost.user_id === user?.id && (
                  <>
                    {linkedRoutines.length > 0 ? (
                      <div className="border border-border/60 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setExpandedRoutines(!expandedRoutines)}
                          className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                        >
                          <h3 className="text-sm font-medium">
                            Rotinas Vinculadas ({linkedRoutines.length})
                          </h3>
                          <ChevronDown
                            className={`h-5 w-5 transform transition-transform ${
                              expandedRoutines ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        {expandedRoutines && (
                          <div className="border-t border-border/60 bg-muted/20 p-4 space-y-3">
                            {linkedRoutines.map((routine) => (
                              <div
                                key={routine.id}
                                className="p-3 border border-border/60 rounded-lg bg-background"
                              >
                                <p className="font-medium text-sm">
                                  {routine.type === 1
                                    ? "🏋️ Exercicios"
                                    : routine.type === 2
                                      ? "🍽️ Dietas"
                                      : "✅ Habitos"}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="border border-border/60 rounded-lg p-4 bg-muted/20 text-center space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Nenhuma rotina vinculada a esta meta
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full rounded-full"
                          onClick={() => navigate("/metas")}
                        >
                          Vincular Rotinas
                        </Button>
                      </div>
                    )}
                  </>
                )}
                {selectedGoalPost.user_id !== user?.id && linkedRoutines.length > 0 && (
                  <div className="border border-border/60 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedRoutines(!expandedRoutines)}
                      className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                    >
                      <h3 className="text-sm font-medium">
                        Rotinas Vinculadas ({linkedRoutines.length})
                      </h3>
                      <ChevronDown
                        className={`h-5 w-5 transform transition-transform ${
                          expandedRoutines ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {expandedRoutines && (
                      <div className="border-t border-border/60 bg-muted/20 p-4 space-y-3">
                        {linkedRoutines.map((routine) => (
                          <div
                            key={routine.id}
                            className="p-3 border border-border/60 rounded-lg bg-background"
                          >
                            <p className="font-medium text-sm">
                              {routine.type === 1
                                ? "🏋️ Exercicios"
                                : routine.type === 2
                                  ? "🍽️ Dietas"
                                  : "✅ Habitos"}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-2">
                  {/* Copy Goal Button - Only show for other users' goals */}
                  {selectedGoalPost.user_id !== user?.id && (
                    <Button
                      onClick={handleCopyGoal}
                      disabled={isCopyingGoal || hasAlreadyCopiedGoal}
                      className="flex-1 rounded-full gap-2 shrink-0"
                    >
                      {isCopyingGoal
                        ? "Copiando..."
                        : hasAlreadyCopiedGoal
                          ? "Já copiado"
                          : "Copiar Meta"}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Report Dialog */}
      <Drawer open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>
              {reportType === "user" ? "Denunciar usuário" : "Denunciar post"}
            </DrawerTitle>
          </DrawerHeader>
          {reportedPost && (
            <div className="space-y-4 px-4 pb-6">
              <div className="p-4 border border-border/60 rounded-lg bg-muted/30">
                <p className="text-sm mb-3">
                  {reportType === "user"
                    ? `Você está denunciando o usuário: ${reportedPost.userNickname}`
                    : `Você está denunciando o post de ${reportedPost.userNickname}`}
                </p>
                {reportType === "post" && reportedPost.description && (
                  <p className="text-xs text-muted-foreground">
                    "{reportedPost.description.substring(0, 100)}..."
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Motivo da denúncia
                </label>
                <Select value={reportReason} onValueChange={setReportReason}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder="Selecione um motivo" />
                  </SelectTrigger>
                  <SelectContent side="top" align="center">
                    <SelectItem value="Conteúdo inadequado">Conteúdo inadequado</SelectItem>
                    <SelectItem value="Spam">Spam</SelectItem>
                    <SelectItem value="Assédio ou bullying">Assédio ou bullying</SelectItem>
                    <SelectItem value="Violação de direitos autorais">Violação de direitos autorais</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1 rounded-full"
                  onClick={() => setReportDialogOpen(false)}
                  disabled={isSubmittingReport}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 rounded-full"
                  onClick={submitReport}
                  disabled={isSubmittingReport || !reportReason.trim()}
                >
                  {isSubmittingReport ? "Enviando..." : "Enviar denúncia"}
                </Button>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* Post Likes Modal */}
      <PostLikesModal
        open={likesModalOpen}
        onOpenChange={setLikesModalOpen}
        likes={postLikes}
      />

      {/* Centralized Confirm Dialog */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDialog.onConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
