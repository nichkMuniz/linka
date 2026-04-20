import * as React from "react";
import { getFeedPosts, getDiscoverPosts, togglePostLike } from "../services/post.service";
import { Card, CardContent } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { PostIncentiveButton } from "@/components/shared/post-incentive-button";
import { PostCommentsDialog } from "@/components/modals/post-comments-dialog";
import { ImageWithFallback } from "@/components/shared/image-with-fallback";
import { toast } from "@/components/ui/use-toast";
import {
  getRoutinesByGoalIdDb,
  getRoutineItemsForViewDb,
  getActiveStoriesDb,
  getUserProfileDb,
  createStoryDb,
  deleteOldStoriesDb,
  getMyViewedFlowUserIdsDb,
  recordFlowViewDb,
  createUserGoalDb,
  deletePostDb,
  getPostLikeUsersDb,
  copyRoutineToUserDb,
  type PostIncentiveType,
  type StoryWithUser,
  invalidateProfileCache,
} from "@/lib/ritmofit-db";
import { PostLikesModal } from "@/components/modals/post-likes-modal";
import { ReportDrawer } from "@/components/shared/report-drawer";
import { ShareDrawer } from "@/components/shared/share-drawer";
import { EditPostDrawer } from "@/components/post/edit-post-drawer";
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
import { ChevronDown, MoreVertical, Flag, Trash2, Share2, Edit2, Target } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { formatTimeAgo } from "@/lib/utils";
import { LoadingSpinner, PostSkeleton } from "@/components/shared/animated-loading";
import type { PostWithStats } from "../services/post.service";
import { FlowCarousel } from "@/components/shots/flow-carousel";
import { FlowCreationDialog } from "@/components/modals/flow-creation-dialog";
import { FlowViewerModal } from "@/components/modals/flow-viewer-modal";
import { PostCarousel } from "@/components/post/post-carousel";
import { UserInsignias } from "@/components/profile/user-insignias";
import { UserAvatar } from "@/components/shared/user-avatar";
import { FollowButton } from "@/components/shared/follow-button";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export default function Index() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [posts, setPosts] = React.useState<PostWithStats[]>([]);
  const [stories, setStories] = React.useState<StoryWithUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [togglingIncentives, setTogglingIncentives] = React.useState<Set<string>>(new Set());
  const [goalModalOpen, setGoalModalOpen] = React.useState(false);
  const [selectedGoalPost, setSelectedGoalPost] =
    React.useState<PostWithStats | null>(null);
  const [linkedRoutines, setLinkedRoutines] = React.useState<any[]>([]);
  const [expandedLinkedRoutine, setExpandedLinkedRoutine] = React.useState<string | null>(null);
  const [linkedRoutineItems, setLinkedRoutineItems] = React.useState<Record<string, any[]>>({});

  const [expandedRoutines, setExpandedRoutines] = React.useState(false);
  const [storyCreationOpen, setStoryCreationOpen] = React.useState(false);
  const [selectedStory, setSelectedStory] =
    React.useState<StoryWithUser | null>(null);
  const [storyViewerOpen, setStoryViewerOpen] = React.useState(false);
  const [isCreatingStory, setIsCreatingStory] = React.useState(false);
  const [currentUserPhoto, setCurrentUserPhoto] = React.useState<string | null>(null);
  const [currentUserNickname, setCurrentUserNickname] = React.useState<string | null>(null);
  const [currentUserGender, setCurrentUserGender] = React.useState<string | null>(null);
  const [ownerHasViewedFlow, setOwnerHasViewedFlow] = React.useState(false);
  const [viewedStoryIds, setViewedStoryIds] = React.useState<Set<string>>(new Set());
  const [activeViewerStories, setActiveViewerStories] = React.useState<StoryWithUser[]>([]);
  const [shareDrawerOpen, setShareDrawerOpen] = React.useState(false);
  const [shareDrawerText, setShareDrawerText] = React.useState("");
  const [shareDrawerUrl, setShareDrawerUrl] = React.useState<string | undefined>(undefined);
  const [reportDialogOpen, setReportDialogOpen] = React.useState(false);
  const [reportType, setReportType] = React.useState<"user" | "post" | null>(
    null,
  );
  const [reportedPost, setReportedPost] = React.useState<PostWithStats | null>(
    null,
  );
  const [isCopyingGoal, setIsCopyingGoal] = React.useState(false);
  const [hasAlreadyCopiedGoal, setHasAlreadyCopiedGoal] = React.useState(false);
  const [copyingRoutineKeys, setCopyingRoutineKeys] = React.useState<Set<string>>(new Set());
  const [copiedRoutineKeys, setCopiedRoutineKeys] = React.useState<Set<string>>(new Set());
  const [feedMode, setFeedMode] = React.useState<"following" | "discover">(() => {
    if (localStorage.getItem("new_user_open_discover") === "1") {
      localStorage.removeItem("new_user_open_discover");
      return "discover";
    }
    return "following";
  });
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
    userGender: string | null;
    type: number;
  }>>([]);
  const [editPostOpen, setEditPostOpen] = React.useState(false);
  const [editingPost, setEditingPost] = React.useState<PostWithStats | null>(null);

  const [confirmDialog, setConfirmDialog] = React.useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: "", description: "", onConfirm: () => { } });

  const showConfirm = React.useCallback(
    (title: string, description: string, onConfirm: () => void) => {
      setConfirmDialog({ open: true, title, description, onConfirm });
    },
    [],
  );

  const loadFeed = React.useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [postsData, storiesData] = await Promise.all([
        getFeedPosts(),
        getActiveStoriesDb(),
      ]);
      setPosts(postsData);
      setStories(storiesData);
      const activeFlowIds = storiesData.map((s: StoryWithUser) => s.id);
      const viewedUserIds = await getMyViewedFlowUserIdsDb(activeFlowIds);
      setViewedStoryIds(viewedUserIds);

      // Get current user's story for flow viewer count (photo is loaded separately in the useEffect below)
      const userStory = storiesData.find((s: StoryWithUser) => s.user_id === user?.id);
      // Fallback: if profile photo not yet loaded, use story photo
      if (userStory?.userPhoto) setCurrentUserPhoto((prev) => prev || userStory.userPhoto);
      if (userStory) {
        // userStory logic here if needed, but the count is gone
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
  }, [user?.id]);

  React.useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  // Open a specific flow when navigating from a notification (state.openFlow = flowId)
  React.useEffect(() => {
    const state = location.state as { openFlow?: string } | null;
    if (!state?.openFlow || stories.length === 0) return;
    window.history.replaceState({}, "");
    const targetStory = stories.find((s) => String(s.id) === String(state.openFlow));
    if (targetStory) {
      setSelectedStory(targetStory);
      setStoryViewerOpen(true);
    }
  }, [stories, location.state]);

  React.useEffect(() => {
    const handler = () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      setDiscoverLoaded(false);
      loadFeed(true);
    };
    window.addEventListener("ritmofit-refresh-feed", handler);
    return () => window.removeEventListener("ritmofit-refresh-feed", handler);
  }, [loadFeed]);

  // Pre-load discover posts in the background once the following feed is loaded
  // (so the inline "Descobrir" section at the bottom of the following feed is ready)
  React.useEffect(() => {
    if (!loading && !discoverLoaded) {
      setDiscoverLoading(true);
      getDiscoverPosts()
        .then((data) => {
          setDiscoverPosts(data);
          setDiscoverLoaded(true);
        })
        .catch((err) => console.error("Erro ao pré-carregar posts populares:", err))
        .finally(() => setDiscoverLoading(false));
    }
  }, [loading, discoverLoaded]);

  // Load current user's profile photo (also handles force_profile_reload for new signups)
  React.useEffect(() => {
    if (!user?.id) return;
    // Clear force flag if set (newly registered users with photo uploaded during signup)
    if (localStorage.getItem("force_profile_reload") === "1") {
      localStorage.removeItem("force_profile_reload");
      invalidateProfileCache(user.id);
    }
    getUserProfileDb(user.id)
      .then((profile) => {
        if (profile?.photo) setCurrentUserPhoto(profile.photo);
        if (profile?.nickname) setCurrentUserNickname(profile.nickname);
        if (profile?.gender) setCurrentUserGender(profile.gender);
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
        const rawExtension = mimeType.split("/")[1] || "jpg";
        // Normalize iPhone/QuickTime format to mp4 for broad compatibility
        const extension = rawExtension === "quicktime" ? "mov" : rawExtension;
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
            id: String(newStory.id),
            userNickname: currentUserNickname || user.email?.split("@")[0] || "Você",
            userPhoto: currentUserPhoto,
          };
          setStories((prev) => [enrichedStory, ...prev]);
          setOwnerHasViewedFlow(false);
          // Open viewer immediately on the newly created flow
          setStoryCreationOpen(false);
          setSelectedStory(enrichedStory);
          setActiveViewerStories([enrichedStory, ...stories.filter(s => s.user_id === user.id)]);
          setStoryViewerOpen(true);
        }
      } catch (err) {
        console.error("Error creating story:", err);
        throw err;
      } finally {
        setIsCreatingStory(false);
      }
    },
    [user, currentUserNickname, currentUserPhoto],
  );

  const handleStoryClick = React.useCallback((story: StoryWithUser) => {
    setSelectedStory(story);

    // Filter stories based on ownership to separate personal flow from community flow
    const isOwner = story.user_id === user?.id;
    const storiesList = isOwner
      ? stories.filter(s => s.user_id === user?.id)
      : stories.filter(s => s.user_id !== user?.id);

    setActiveViewerStories(storiesList);
    setStoryViewerOpen(true);

    if (isOwner) {
      // Mark as viewed so the green dot turns gray for the owner
      setOwnerHasViewedFlow(true);
    } else {
      // Optimistically mark as viewed and persist to DB
      setViewedStoryIds((prev) => new Set(prev).add(story.id));
      recordFlowViewDb(story.id, story.user_id).catch((err) =>
        console.error("Error recording flow view:", err),
      );
    }
  }, [stories, user?.id]);

  // Use refs to avoid stale closures without making stories/selectedStory deps
  const viewerStoriesRef = React.useRef(activeViewerStories);
  const selectedStoryRef = React.useRef(selectedStory);
  React.useEffect(() => { viewerStoriesRef.current = activeViewerStories; }, [activeViewerStories]);
  React.useEffect(() => { selectedStoryRef.current = selectedStory; }, [selectedStory]);

  const handleSkipStory = React.useCallback(() => {
    const current = selectedStoryRef.current;
    if (!current) return;

    // Use the same Instagram-like sorting logic as the modal
    const groups: Record<string, StoryWithUser[]> = {};
    viewerStoriesRef.current.forEach((s) => {
      if (!groups[s.user_id]) groups[s.user_id] = [];
      groups[s.user_id].push(s);
    });

    const userLatests = Object.keys(groups).map((uid) => {
      const group = groups[uid];
      const latest = Math.max(...group.map((s) => new Date(s.created_at).getTime()));
      return { uid, latest };
    });
    userLatests.sort((a, b) => b.latest - a.latest);

    const sortedStories: StoryWithUser[] = [];
    userLatests.forEach(({ uid }) => {
      const userGroup = [...groups[uid]].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      sortedStories.push(...userGroup);
    });

    const currentIndex = sortedStories.findIndex((s) => s.id === current.id);
    // Guard: if story not found in list (e.g. activeViewerStories out of sync), close safely
    if (currentIndex === -1) {
      setStoryViewerOpen(false);
      return;
    }
    if (currentIndex < sortedStories.length - 1) {
      setSelectedStory(sortedStories[currentIndex + 1]);
    } else {
      setStoryViewerOpen(false);
    }
  }, []);

  const handlePrevStory = React.useCallback(() => {
    const current = selectedStoryRef.current;
    if (!current) return;

    // Use the same Instagram-like sorting logic
    const groups: Record<string, StoryWithUser[]> = {};
    viewerStoriesRef.current.forEach((s) => {
      if (!groups[s.user_id]) groups[s.user_id] = [];
      groups[s.user_id].push(s);
    });

    const userLatests = Object.keys(groups).map((uid) => {
      const group = groups[uid];
      const latest = Math.max(...group.map((s) => new Date(s.created_at).getTime()));
      return { uid, latest };
    });
    userLatests.sort((a, b) => b.latest - a.latest);

    const sortedStories: StoryWithUser[] = [];
    userLatests.forEach(({ uid }) => {
      const userGroup = [...groups[uid]].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      sortedStories.push(...userGroup);
    });

    const currentIndex = sortedStories.findIndex((s) => s.id === current.id);
    // Guard: if story not found in list, do nothing
    if (currentIndex <= 0) return;
    setSelectedStory(sortedStories[currentIndex - 1]);
  }, []);

  const handleAddStoryClick = React.useCallback(() => {
    setStoryCreationOpen(true);
  }, []);

  const openGoalModal = React.useCallback(async (post: PostWithStats) => {
    setSelectedGoalPost(post);
    setGoalModalOpen(true);
    setExpandedRoutines(false);
    setHasAlreadyCopiedGoal(false);
    setExpandedLinkedRoutine(null);
    setLinkedRoutineItems({});
    setCopyingRoutineKeys(new Set());
    setCopiedRoutineKeys(new Set());

    // Fetch routines
    if (post.userGoal) {
      try {
        const routines = await getRoutinesByGoalIdDb(post.userGoal.goal_id);
        setLinkedRoutines(routines);
      } catch (err) {
        console.error("Error fetching routines:", err);
        setLinkedRoutines([]);
      }
    }
  }, [user]);

  const handleToggleLinkedRoutine = React.useCallback(async (groupKey: string, type: number, name: string | undefined, targetUserId: string) => {
    setExpandedLinkedRoutine((prev) => (prev === groupKey ? null : groupKey));
    setLinkedRoutineItems((prev) => {
      if (prev[groupKey] !== undefined) return prev; // already loaded, no re-render
      getRoutineItemsForViewDb(targetUserId, type, name)
        .then((items) => setLinkedRoutineItems((p) => ({ ...p, [groupKey]: items })))
        .catch(() => setLinkedRoutineItems((p) => ({ ...p, [groupKey]: [] })));
      return prev;
    });
  }, []);

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

      // Copy linked routines (workout type=1 and diet type=2 only)
      if (linkedRoutines.length > 0) {
        const seen = new Set<string>();
        const groups = linkedRoutines.reduce<{ type: number; name?: string }[]>((acc, r) => {
          const k = `${r.type}__${r.name ?? ""}`;
          if (!seen.has(k) && (r.type === 1 || r.type === 2)) {
            seen.add(k);
            acc.push({ type: r.type, name: r.name });
          }
          return acc;
        }, []);

        await Promise.allSettled(
          groups.map(({ type, name }) =>
            copyRoutineToUserDb(selectedGoalPost.user_id, user.id, type as 1 | 2, name ?? null)
          )
        );
      }

      toast({
        title: "Meta copiada com sucesso!",
        description: "Você agora tem a mesma meta e rotinas que este usuário.",
      });

      setHasAlreadyCopiedGoal(true);
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
  }, [selectedGoalPost?.userGoal, selectedGoalPost?.user_id, user, linkedRoutines]);

  const handleCopyRoutine = React.useCallback(async (sourceUserId: string, routineType: number, routineName: string | undefined) => {
    if (!user) return;
    const key = `${sourceUserId}::${routineName ?? ""}`;
    if (copyingRoutineKeys.has(key) || copiedRoutineKeys.has(key)) return;

    setCopyingRoutineKeys((prev) => new Set(prev).add(key));
    try {
      await copyRoutineToUserDb(sourceUserId, user.id, routineType as 1 | 2, routineName ?? null);
      setCopiedRoutineKeys((prev) => new Set(prev).add(key));
      toast({
        title: routineType === 1 ? "Treino copiado!" : "Dieta copiada!",
        description: `"${routineName ?? "Rotina"}" foi adicionada à sua conta.`,
      });
    } catch (err: any) {
      toast({ title: "Erro ao copiar", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setCopyingRoutineKeys((prev) => { const s = new Set(prev); s.delete(key); return s; });
    }
  }, [user, copyingRoutineKeys, copiedRoutineKeys]);

  const applyOptimisticLike = (list: PostWithStats[], postId: string, incentiveType: PostIncentiveType): PostWithStats[] =>
    list.map((post) => {
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
      else if (incentiveType === 2) likesMap.continua += wasActive ? -1 : 1;
      else if (incentiveType === 3) likesMap.ganhador += wasActive ? -1 : 1;
      else if (incentiveType === 4) likesMap.consegueMais += wasActive ? -1 : 1;
      else if (incentiveType === 5) likesMap.limiteMaior += wasActive ? -1 : 1;
      else if (incentiveType === 6) likesMap.maisAlgum += wasActive ? -1 : 1;
      return { ...post, likes: likesMap, userLikes: newUserLikes };
    });

  const handleToggleLike = React.useCallback(
    async (postId: string, incentiveType: PostIncentiveType) => {
      const key = `${postId}-${incentiveType}`;
      if (togglingIncentives.has(key)) return;
      let previousPosts: PostWithStats[] = [];
      let previousDiscoverPosts: PostWithStats[] = [];
      try {
        setTogglingIncentives((prev) => new Set(prev).add(key));

        // Update UI optimistically for both feeds, capturing deep copies for rollback
        setPosts((prev) => {
          previousPosts = prev.map((p) => ({ ...p, likes: { ...p.likes }, userLikes: [...p.userLikes] }));
          return applyOptimisticLike(prev, postId, incentiveType);
        });
        setDiscoverPosts((prev) => {
          previousDiscoverPosts = prev.map((p) => ({ ...p, likes: { ...p.likes }, userLikes: [...p.userLikes] }));
          return applyOptimisticLike(prev, postId, incentiveType);
        });

        await togglePostLike(postId, incentiveType);
      } catch (err: any) {
        console.error("Erro ao toggle like:", err);
        toast({
          title: "Erro ao reagir",
          description: err?.message || "Tente novamente.",
        });
        // Revert optimistic update on failure for both feeds
        if (previousPosts.length > 0) setPosts(previousPosts);
        if (previousDiscoverPosts.length > 0) setDiscoverPosts(previousDiscoverPosts);
      } finally {
        setTogglingIncentives((prev) => { const next = new Set(prev); next.delete(key); return next; });
      }
    },
    [togglingIncentives],
  );

  const handleSharePost = React.useCallback((post: PostWithStats) => {
    const text = `Confira o post de @${post.userNickname} no Linka! 💪${post.description ? `\n"${post.description}"` : ""}`;
    const postUrl = `${window.location.origin}/post/${post.id}`;
    setShareDrawerText(text);
    setShareDrawerUrl(postUrl);
    setShareDrawerOpen(true);
  }, []);

  const handleReportUser = React.useCallback((post: PostWithStats) => {
    setReportedPost(post);
    setReportType("user");
    setReportDialogOpen(true);
  }, []);

  const handleReportPost = React.useCallback((post: PostWithStats) => {
    setReportedPost(post);
    setReportType("post");
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

  const handleEditPost = React.useCallback((post: PostWithStats) => {
    setEditingPost(post);
    setEditPostOpen(true);
  }, []);


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
        <FlowCarousel
          stories={stories}
          onAddStoryClick={handleAddStoryClick}
          onStoryClick={handleStoryClick}
          currentUserId={user?.id || ""}
          currentUserPhoto={currentUserPhoto}
          currentUserGender={currentUserGender}
          currentUserNickname={currentUserNickname}
          isOwnerViewing={ownerHasViewedFlow}
          viewedStoryIds={viewedStoryIds}
        />
      </div>

      {/* Feed Mode Toggle */}

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
                          <UserAvatar
                            photo={post.userPhoto}
                            gender={post.userGender}
                            nickname={post.userNickname}
                            size="sm"
                            className="border border-white/30"
                          />
                          <div className="flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5">
                            <span className="text-xs font-medium text-white leading-none">
                              {post.userNickname}
                            </span>
                            <span className="inline-flex items-center" onClick={(e) => e.stopPropagation()}>
                              <UserInsignias userId={post.user_id} />
                            </span>
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
                              <>
                                <DropdownMenuItem onClick={() => handleEditPost(post)}>
                                  <Edit2 className="h-4 w-4 mr-2" />
                                  Editar post
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDeletePost(post)}
                                  className="text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Excluir post
                                </DropdownMenuItem>
                              </>
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

                    {/* Actions row: incentivos + comentários */}
                    <div className="flex items-center px-2 pt-1 pb-0.5">
                      {([1, 2, 3, 4, 5, 6] as PostIncentiveType[]).map((type) => (
                        <PostIncentiveButton
                          key={type}
                          type={type}
                          isActive={post.userLikes.includes(type)}
                          onClick={() => handleToggleLike(post.id, type)}
                          loading={togglingIncentives.has(`${post.id}-${type}`)}
                        />
                      ))}
                      <div className="ml-auto">
                        <PostCommentsDialog
                          postId={post.id}
                          commentCount={post.commentCount}
                          hasActivity={post.hasActivity}
                          isPostOwner={post.user_id === user?.id}
                        />
                      </div>
                    </div>

                    {/* Contador de incentivos + timestamp numa linha só */}
                    <div className="flex items-center gap-2 px-3 pb-1">
                      {Object.values(post.likes).reduce((sum: number, val: number) => sum + val, 0) > 0 ? (
                        <button
                          onClick={() => handleOpenLikesModal(post)}
                          className="text-xs font-semibold text-foreground hover:text-brand transition-colors"
                        >
                          {Object.values(post.likes).reduce((sum: number, val: number) => sum + val, 0)} incentivos
                        </button>
                      ) : null}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatTimeAgo(post.created_at)}
                      </span>
                    </div>

                    {/* Descrição + Meta */}
                    <div className="px-3 pb-3 space-y-2">
                      {post.description && (
                        <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                          {post.description}
                        </p>
                      )}

                      {/* Goal Progress */}
                      {post.userGoal && (
                        <button
                          onClick={() => openGoalModal(post)}
                          className="w-full text-left group"
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <Target className="h-3 w-3 text-brand flex-shrink-0" />
                            <span className="text-xs font-medium text-foreground truncate flex-1">
                              {post.userGoal.description}
                            </span>
                            <span className="text-xs font-bold text-brand flex-shrink-0">
                              {Math.round(post.userGoal.perc)}%
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-brand h-full rounded-full transition-all duration-500"
                              style={{ width: `${post.userGoal.perc}%` }}
                            />
                          </div>
                        </button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )
          ) : (
            /* Following mode — posts dos seguidos + discover inline no final */
            <>
              {posts.map((post) => (
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
                        <div className="relative aspect-square md:aspect-auto md:h-[450px] bg-slate-900/20 flex items-center justify-center overflow-hidden rounded-lg">
                          <ImageWithFallback
                            src={post.photo}
                            alt="Post"
                            fallback="/placeholder.svg"
                            className="max-w-full max-h-full w-auto h-auto object-contain"
                          />
                        </div>
                      )}

                      {/* User Info Overlay - Bottom Left */}
                      <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-3 p-3 bg-gradient-to-t from-black/60 via-black/30 to-transparent">
                        <button
                          onClick={() => navigate(`/usuario/${post.user_id}`)}
                          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                        >
                          <UserAvatar
                            photo={post.userPhoto}
                            gender={post.userGender}
                            nickname={post.userNickname}
                            size="sm"
                            className="border border-white/30"
                          />
                          <div className="flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5">
                            <span className="text-xs font-medium text-white leading-none">
                              {post.userNickname}
                            </span>
                            <span className="inline-flex items-center" onClick={(e) => e.stopPropagation()}>
                              <UserInsignias userId={post.user_id} />
                            </span>
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
                              <>
                                <DropdownMenuItem onClick={() => handleEditPost(post)}>
                                  <Edit2 className="h-4 w-4 mr-2" />
                                  Editar post
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDeletePost(post)}
                                  className="text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Excluir post
                                </DropdownMenuItem>
                              </>
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

                    {/* Actions row: incentivos + comentários */}
                    <div className="flex items-center px-2 pt-1 pb-0.5">
                      {([1, 2, 3, 4, 5, 6] as PostIncentiveType[]).map((type) => (
                        <PostIncentiveButton
                          key={type}
                          type={type}
                          isActive={post.userLikes.includes(type)}
                          onClick={() => handleToggleLike(post.id, type)}
                          loading={togglingIncentives.has(`${post.id}-${type}`)}
                        />
                      ))}
                      <div className="ml-auto">
                        <PostCommentsDialog
                          postId={post.id}
                          commentCount={post.commentCount}
                          hasActivity={post.hasActivity}
                          isPostOwner={post.user_id === user?.id}
                        />
                      </div>
                    </div>

                    {/* Contador de incentivos + timestamp numa linha só */}
                    <div className="flex items-center gap-2 px-3 pb-1">
                      {Object.values(post.likes).reduce((sum: number, val: number) => sum + val, 0) > 0 ? (
                        <button
                          onClick={() => handleOpenLikesModal(post)}
                          className="text-xs font-semibold text-foreground hover:text-brand transition-colors"
                        >
                          {Object.values(post.likes).reduce((sum: number, val: number) => sum + val, 0)} incentivos
                        </button>
                      ) : null}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatTimeAgo(post.created_at)}
                      </span>
                    </div>

                    {/* Descrição + Meta */}
                    <div className="px-3 pb-3 space-y-2">
                      {post.description && (
                        <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                          {post.description}
                        </p>
                      )}

                      {/* Goal Progress */}
                      {post.userGoal && (
                        <button
                          onClick={() => openGoalModal(post)}
                          className="w-full text-left group"
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <Target className="h-3 w-3 text-brand flex-shrink-0" />
                            <span className="text-xs font-medium text-foreground truncate flex-1">
                              {post.userGoal.description}
                            </span>
                            <span className="text-xs font-bold text-brand flex-shrink-0">
                              {Math.round(post.userGoal.perc)}%
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-brand h-full rounded-full transition-all duration-500"
                              style={{ width: `${post.userGoal.perc}%` }}
                            />
                          </div>
                        </button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* ── Divisor Descobrir ── aparece após posts dos seguidos (ou logo no topo se não houver) */}
              {posts.length === 0 && (
                <div className="flex flex-col items-center gap-2 text-center pt-4 pb-1">
                  <p className="text-xs text-muted-foreground">
                    Siga pessoas para ver o feed delas.
                  </p>
                  <Button size="sm" variant="ghost" className="rounded-full text-xs h-7 px-3" onClick={() => navigate("/buscar")}>
                    Encontrar pessoas
                  </Button>
                </div>
              )}

              {/* Divisor visual de transição Seguindo → Descobrir */}
              <div className="flex items-center gap-3 py-2">
                <div className="flex-1 h-px bg-border/60" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1">
                  Descobrir
                </span>
                <div className="flex-1 h-px bg-border/60" />
              </div>
              {posts.length > 0 && (
                <p className="text-xs text-muted-foreground text-center -mt-1 mb-1">
                  Você chegou ao fim — veja o que está acontecendo na comunidade
                </p>
              )}

              {/* Posts do Descobrir inline */}
              {discoverLoading ? (
                <>{[1, 2, 3].map((i) => <PostSkeleton key={i} />)}</>
              ) : discoverPosts.length === 0 ? (
                <div className="flex flex-col items-center py-8 gap-2 text-center">
                  <p className="text-sm text-muted-foreground">Nenhum post novo por aqui.</p>
                </div>
              ) : (
                discoverPosts.map((post) => (
                  <Card key={`seed-${post.id}`} className="border-border/60 relative overflow-hidden fade-in">
                    <CardContent className="space-y-3 p-0">
                      <div className="relative">
                        {post.photos && post.photos.length > 0 ? (
                          <PostCarousel photos={post.photos} alt="Post" />
                        ) : post.photo ? (
                          <div className="relative aspect-square md:aspect-auto md:h-[450px] bg-slate-900/20 flex items-center justify-center overflow-hidden rounded-lg">
                            <ImageWithFallback src={post.photo} alt="Post" fallback="/placeholder.svg" className="max-w-full max-h-full w-auto h-auto object-contain" />
                          </div>
                        ) : null}
                        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-3 p-3 bg-gradient-to-t from-black/60 via-black/30 to-transparent">
                          <button onClick={() => navigate(`/usuario/${post.user_id}`)} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                            <UserAvatar
                              photo={post.userPhoto}
                              gender={post.userGender}
                              nickname={post.userNickname}
                              size="sm"
                              className="border border-white/30"
                            />
                            <div className="flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5">
                              <span className="text-xs font-medium text-white leading-none">{post.userNickname}</span>
                              <span className="inline-flex items-center" onClick={(e) => e.stopPropagation()}>
                                <UserInsignias userId={post.user_id} />
                              </span>
                            </div>
                          </button>
                          {post.user_id !== user?.id && (
                            <FollowButton targetUserId={post.user_id} variant="overlay" />
                          )}
                        </div>
                      </div>
                      {/* Actions row: incentivos + comentários */}
                      <div className="flex items-center px-2 pt-1 pb-0.5">
                        {([1, 2, 3, 4, 5, 6] as PostIncentiveType[]).map((type) => (
                          <PostIncentiveButton
                            key={type}
                            type={type}
                            isActive={post.userLikes.includes(type)}
                            onClick={() => handleToggleLike(post.id, type)}
                            loading={togglingIncentives.has(`${post.id}-${type}`)}
                          />
                        ))}
                        <div className="ml-auto">
                          <PostCommentsDialog postId={post.id} commentCount={post.commentCount} hasActivity={post.hasActivity} isPostOwner={post.user_id === user?.id} />
                        </div>
                      </div>

                      {/* Contador de incentivos + timestamp */}
                      <div className="flex items-center gap-2 px-3 pb-1">
                        {Object.values(post.likes).reduce((sum: number, val: number) => sum + val, 0) > 0 ? (
                          <button
                            onClick={() => handleOpenLikesModal(post)}
                            className="text-xs font-semibold text-foreground hover:text-brand transition-colors"
                          >
                            {Object.values(post.likes).reduce((sum: number, val: number) => sum + val, 0)} incentivos
                          </button>
                        ) : null}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {formatTimeAgo(post.created_at)}
                        </span>
                      </div>

                      {/* Descrição + Meta */}
                      <div className="px-3 pb-3 space-y-2">
                        {post.description && (
                          <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap line-clamp-2">{post.description}</p>
                        )}
                        {post.userGoal && (
                          <button onClick={() => openGoalModal(post)} className="w-full text-left">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Target className="h-3 w-3 text-brand flex-shrink-0" />
                              <span className="text-xs font-medium text-foreground truncate flex-1">
                                {post.userGoal.description}
                              </span>
                              <span className="text-xs font-bold text-brand flex-shrink-0">
                                {Math.round(post.userGoal.perc)}%
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-brand h-full rounded-full transition-all duration-500"
                                style={{ width: `${post.userGoal.perc}%` }}
                              />
                            </div>
                          </button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </>
          )}
        </div>
      </div>

      {/* Flow Creation Dialog */}
      <FlowCreationDialog
        open={storyCreationOpen}
        onOpenChange={setStoryCreationOpen}
        onCreateStory={handleCreateStory}
        isLoading={isCreatingStory}
      />

      {/* Flow Viewer Modal */}
      <FlowViewerModal
        story={selectedStory}
        stories={activeViewerStories}
        open={storyViewerOpen}
        onOpenChange={setStoryViewerOpen}
        onNextStory={handleSkipStory}
        onPrevStory={handlePrevStory}
        onSelectStory={(s) => {
          setSelectedStory(s);
          // Rebuild activeViewerStories around the selected story so the modal
          // stays in sync – otherwise the timer/navigation logic sees currentIndex=-1
          // and can jump to the wrong story (or crash with a black screen).
          const isOwner = s.user_id === user?.id;
          const storiesList = isOwner
            ? stories.filter((st) => st.user_id === user?.id)
            : stories.filter((st) => st.user_id !== user?.id);
          setActiveViewerStories(storiesList.length > 0 ? storiesList : [s]);
        }}
        onDeleted={() => {
          setStoryViewerOpen(false);
          getActiveStoriesDb().then(setStories).catch(console.error);
        }}
      />

      {/* Goal Progress Modal */}
      <Drawer open={goalModalOpen} onOpenChange={setGoalModalOpen}>
        <DrawerContent className="max-h-[80dvh] flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DrawerHeader className="shrink-0">
            <DrawerTitle>Progresso da Meta</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col flex-1 gap-4 overflow-y-auto px-4 pb-6">
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
                            Rotinas Vinculadas ({new Set(linkedRoutines.map((r: any) => `${r.type}__${r.name ?? ""}`)).size})
                          </h3>
                          <ChevronDown
                            className={`h-5 w-5 transform transition-transform ${expandedRoutines ? "rotate-180" : ""
                              }`}
                          />
                        </button>

                        {expandedRoutines && (() => {
                          // Deduplicate: group by (type + name), keep one representative per group
                          const seen = new Set<string>();
                          const groups = linkedRoutines.reduce<{ key: string; type: number; name?: string }[]>((acc, r) => {
                            const k = `${r.type}__${r.name ?? ""}`;
                            if (!seen.has(k)) { seen.add(k); acc.push({ key: k, type: r.type, name: r.name }); }
                            return acc;
                          }, []);
                          return (
                            <div className="border-t border-border/60 divide-y divide-border/40">
                              {groups.map(({ key, type, name }) => {
                                const typeIcon = type === 1 ? "🏋️" : type === 2 ? "🍽️" : "✅";
                                const typeLabel = type === 1 ? "Exercícios" : type === 2 ? "Dietas" : "Hábitos";
                                const label = name || typeLabel;
                                const isOpen = expandedLinkedRoutine === key;
                                const items = linkedRoutineItems[key];
                                return (
                                  <div key={key}>
                                    <button
                                      onClick={() => handleToggleLinkedRoutine(key, type, name, selectedGoalPost!.user_id)}
                                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                                    >
                                      <span className="text-base">{typeIcon}</span>
                                      <span className="flex-1 text-sm font-medium truncate">{label}</span>
                                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                                    </button>
                                    {isOpen && (
                                      <div className="bg-muted/20 px-4 pb-3 pt-1 space-y-1.5">
                                        {!items ? (
                                          <p className="text-xs text-muted-foreground py-2">Carregando...</p>
                                        ) : items.length === 0 ? (
                                          <p className="text-xs text-muted-foreground py-2">Nenhum item nesta rotina.</p>
                                        ) : (
                                          items.map((item: any) => {
                                            const itemName = item.workoutName || item.dietName || item.habitName || "—";
                                            return (
                                              <div key={item.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-background/60">
                                                <span className="text-xs text-muted-foreground">•</span>
                                                <span className="text-sm truncate">{itemName}</span>
                                              </div>
                                            );
                                          })
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
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
                          onClick={() => navigate("/metas?tab=rotinas")}
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
                        Rotinas Vinculadas ({new Set(linkedRoutines.map((r: any) => `${r.type}__${r.name ?? ""}`)).size})
                      </h3>
                      <ChevronDown
                        className={`h-5 w-5 transform transition-transform ${expandedRoutines ? "rotate-180" : ""
                          }`}
                      />
                    </button>

                    {expandedRoutines && (() => {
                      const seen = new Set<string>();
                      const groups = linkedRoutines.reduce<{ key: string; type: number; name?: string }[]>((acc, r) => {
                        const k = `${r.type}__${r.name ?? ""}`;
                        if (!seen.has(k)) { seen.add(k); acc.push({ key: k, type: r.type, name: r.name }); }
                        return acc;
                      }, []);
                      return (
                        <div className="border-t border-border/60 divide-y divide-border/40">
                          {groups.map(({ key, type, name }) => {
                            const typeIcon = type === 1 ? "🏋️" : type === 2 ? "🍽️" : "✅";
                            const typeLabel = type === 1 ? "Exercícios" : type === 2 ? "Dietas" : "Hábitos";
                            const label = name || typeLabel;
                            const isOpen = expandedLinkedRoutine === key;
                            const items = linkedRoutineItems[key];
                            const copyKey = `${selectedGoalPost!.user_id}::${name ?? ""}`;
                            const isCopyingThis = copyingRoutineKeys.has(copyKey);
                            const isCopiedThis = copiedRoutineKeys.has(copyKey);
                            // Only show copy for workout (type 1) and diet (type 2)
                            const canCopy = type === 1 || type === 2;
                            return (
                              <div key={key}>
                                <button
                                  onClick={() => handleToggleLinkedRoutine(key, type, name, selectedGoalPost!.user_id)}
                                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                                >
                                  <span className="text-base">{typeIcon}</span>
                                  <span className="flex-1 text-sm font-medium truncate">{label}</span>
                                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                                </button>
                                {isOpen && (
                                  <div className="bg-muted/20 px-4 pb-3 pt-1 space-y-1.5">
                                    {!items ? (
                                      <p className="text-xs text-muted-foreground py-2">Carregando...</p>
                                    ) : items.length === 0 ? (
                                      <p className="text-xs text-muted-foreground py-2">Nenhum item nesta rotina.</p>
                                    ) : (
                                      <>
                                        {items.map((item: any) => {
                                          const itemName = item.workoutName || item.dietName || item.habitName || "—";
                                          return (
                                            <div key={item.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-background/60">
                                              <span className="text-xs text-muted-foreground">•</span>
                                              <span className="text-sm truncate">{itemName}</span>
                                            </div>
                                          );
                                        })}
                                        {canCopy && (
                                          <Button
                                            size="sm"
                                            variant={isCopiedThis ? "outline" : "default"}
                                            className="w-full rounded-full mt-2"
                                            disabled={isCopyingThis || isCopiedThis}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleCopyRoutine(selectedGoalPost!.user_id, type, name);
                                            }}
                                          >
                                            {isCopyingThis ? "Copiando..." : isCopiedThis ? "✓ Copiado" : `Copiar ${type === 1 ? "Treino" : "Dieta"}`}
                                          </Button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
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
      <ReportDrawer
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        type={reportType}
        target={reportedPost ? {
          id: reportedPost.id,
          userId: reportedPost.user_id,
          userName: reportedPost.userNickname,
          description: reportedPost.description,
        } : null}
      />

      <ShareDrawer
        open={shareDrawerOpen}
        onOpenChange={setShareDrawerOpen}
        text={shareDrawerText}
        url={shareDrawerUrl}
        title="Compartilhar post"
      />

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

      <EditPostDrawer
        open={editPostOpen}
        onOpenChange={(v) => { if (!v) { setEditPostOpen(false); setEditingPost(null); } }}
        post={editingPost}
        onSaved={() => loadFeed(false)}
      />
    </div>
  );
}
