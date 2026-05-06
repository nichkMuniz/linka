import * as React from "react";
import { getFeedPosts, getDiscoverPosts, togglePostLike } from "../services/post.service";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
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
  updateUserGoalDb,
  deletePostDb,
  getPostLikeUsersDb,
  copyRoutineToUserDb,
  type PostIncentiveType,
  type StoryWithUser,
  invalidateProfileCache,
} from "@/lib/ritmofit-db";
import { PostLikesModal } from "@/components/modals/post-likes-modal";
import { ReportDrawer } from "@/components/shared/report-drawer";
import { GoalCompletedDialog } from "@/components/goals/goal-completed-dialog";
import { ShareDrawer } from "@/components/shared/share-drawer";
import { EditPostDrawer } from "@/components/post/edit-post-drawer";
import { PostCard } from "@/components/feed/post-card";
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
import { ChevronDown } from "lucide-react";
import { PostSkeleton } from "@/components/shared/animated-loading";
import type { PostWithStats } from "../services/post.service";
import { FlowCarousel } from "@/components/feed/flow-carousel";
import { FlowCreationDialog } from "@/components/modals/flow-creation-dialog";
import { FlowViewerModal } from "@/components/modals/flow-viewer-modal";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/lib/language-context";

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

export default function Index() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [posts, setPosts] = React.useState<PostWithStats[]>([]);
  const [discoverPosts, setDiscoverPosts] = React.useState<PostWithStats[]>([]);
  const postsRef = React.useRef<PostWithStats[]>([]);
  const discoverPostsRef = React.useRef<PostWithStats[]>([]);
  postsRef.current = posts;
  discoverPostsRef.current = discoverPosts;
  const [stories, setStories] = React.useState<StoryWithUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [discoverLoading, setDiscoverLoading] = React.useState(false);
  const [discoverLoaded, setDiscoverLoaded] = React.useState(false);

  const togglingIncentivesRef = React.useRef<Set<string>>(new Set());
  const [togglingIncentives, setTogglingIncentives] = React.useState<Set<string>>(new Set());

  const [goalModalOpen, setGoalModalOpen] = React.useState(false);
  const [goalRoutinesLoading, setGoalRoutinesLoading] = React.useState(false);
  const [selectedGoalPost, setSelectedGoalPost] = React.useState<PostWithStats | null>(null);
  const [linkedRoutines, setLinkedRoutines] = React.useState<any[]>([]);
  const [expandedLinkedRoutine, setExpandedLinkedRoutine] = React.useState<string | null>(null);
  const [linkedRoutineItems, setLinkedRoutineItems] = React.useState<Record<string, any[]>>({});
  const [expandedRoutines, setExpandedRoutines] = React.useState(false);

  const [storyCreationOpen, setStoryCreationOpen] = React.useState(false);
  const [selectedStory, setSelectedStory] = React.useState<StoryWithUser | null>(null);
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
  const [reportType, setReportType] = React.useState<"user" | "post" | null>(null);
  const [reportedPost, setReportedPost] = React.useState<PostWithStats | null>(null);

  const [isCopyingGoal, setIsCopyingGoal] = React.useState(false);
  const [hasAlreadyCopiedGoal, setHasAlreadyCopiedGoal] = React.useState(false);
  const [isMarkingGoalComplete, setIsMarkingGoalComplete] = React.useState(false);
  const [completedGoalDescription, setCompletedGoalDescription] = React.useState<string | null>(null);
  const [copyingRoutineKeys, setCopyingRoutineKeys] = React.useState<Set<string>>(new Set());
  const [copiedRoutineKeys, setCopiedRoutineKeys] = React.useState<Set<string>>(new Set());

  const [likesModalOpen, setLikesModalOpen] = React.useState(false);
  const [likesLoading, setLikesLoading] = React.useState(false);
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
  }>({ open: false, title: "", description: "", onConfirm: () => {} });

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
      setLoading(false);

      const userStory = storiesData.find((s: StoryWithUser) => s.user_id === user?.id);
      if (userStory?.userPhoto) setCurrentUserPhoto((prev) => prev || userStory.userPhoto);

      const activeFlowIds = storiesData.map((s: StoryWithUser) => s.id);
      Promise.all([
        getMyViewedFlowUserIdsDb(activeFlowIds),
        deleteOldStoriesDb().catch((err) => console.error("Error cleaning old stories:", err)),
      ]).then(([viewedUserIds]) => {
        setViewedStoryIds(viewedUserIds as string[]);
      }).catch(console.error);
    } catch (err: any) {
      console.error("Erro ao carregar feed:", err?.message || err);
      setLoading(false);
      toast({
        title: t("post_load_error"),
        description: err?.message || t("retry"),
      });
    }
  }, [user?.id, t]);

  React.useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  // Open a specific flow when navigating from a notification
  React.useEffect(() => {
    const state = location.state as { openFlow?: string } | null;
    if (!state?.openFlow || stories.length === 0) return;
    navigate(location.pathname, { replace: true, state: {} });
    const targetStory = stories.find((s) => String(s.id) === String(state.openFlow));
    if (targetStory) {
      setSelectedStory(targetStory);
      setStoryViewerOpen(true);
    }
  }, [stories, location.state]);

  React.useEffect(() => {
    const handler = () => {
      feedScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      setDiscoverLoaded(false);
      loadFeed(true);
    };
    window.addEventListener("ritmofit-refresh-feed", handler);
    return () => window.removeEventListener("ritmofit-refresh-feed", handler);
  }, [loadFeed]);

  // Pre-load discover posts in the background once the following feed is loaded
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

  // Load current user's profile photo
  React.useEffect(() => {
    if (!user?.id) return;
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

  React.useEffect(() => {
    const flag = localStorage.getItem("new_user_open_discover");
    if (flag === "1" && user?.id) {
      localStorage.removeItem("new_user_open_discover");
      // Trigger immediate discover pre-load if not yet done
      if (!discoverLoaded) {
        setDiscoverLoading(true);
        getDiscoverPosts()
          .then((data) => { setDiscoverPosts(data); setDiscoverLoaded(true); })
          .catch(console.error)
          .finally(() => setDiscoverLoading(false));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleCreateStory = React.useCallback(
    async (mediaDataUrl: string, description: string, backgroundColor?: string | null) => {
      setIsCreatingStory(true);
      try {
        if (!user || !supabase) throw new Error("User not authenticated");

        let publicUrl = "";

        if (mediaDataUrl) {
          const response = await fetch(mediaDataUrl);
          const blob = await response.blob();

          const mimeType = blob.type || "image/jpeg";
          const rawExtension = mimeType.split("/")[1] || "jpg";
          const extension = rawExtension === "quicktime" ? "mov" : rawExtension;
          const fileName = `${Date.now()}-story.${extension}`;
          const filePath = `${user.id}/stories/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from("posts")
            .upload(filePath, blob);

          if (uploadError) throw uploadError;

          const { data: { publicUrl: url } } = supabase.storage.from("posts").getPublicUrl(filePath);
          publicUrl = url;
        }

        const newStory = await createStoryDb(description, publicUrl, backgroundColor);
        if (newStory && user) {
          const enrichedStory: StoryWithUser = {
            ...newStory,
            id: String(newStory.id),
            userNickname: currentUserNickname || user.email?.split("@")[0] || "Você",
            userPhoto: currentUserPhoto,
          };

          const currentStories = stories;
          setStories((prev) => [enrichedStory, ...prev]);
          setOwnerHasViewedFlow(false);
          setStoryCreationOpen(false);

          const ownerStories = [enrichedStory, ...currentStories.filter((s) => s.user_id === user.id)];
          setActiveViewerStories(ownerStories);
          setSelectedStory(enrichedStory);
          setStoryViewerOpen(true);
        }
      } catch (err) {
        console.error("Error creating story:", err);
        throw err;
      } finally {
        setIsCreatingStory(false);
      }
    },
    [user, currentUserNickname, currentUserPhoto, stories],
  );

  const handleStoryClick = React.useCallback((story: StoryWithUser) => {
    setSelectedStory(story);

    const isOwner = story.user_id === user?.id;
    // When viewing own stories: show only own stories.
    // When viewing another user's stories: show only that user's stories.
    const storiesList = stories.filter((s) => s.user_id === story.user_id);

    setActiveViewerStories(storiesList.length > 0 ? storiesList : [story]);
    setStoryViewerOpen(true);

    if (isOwner) {
      setOwnerHasViewedFlow(true);
    } else {
      setViewedStoryIds((prev) => new Set(prev).add(story.id));
      recordFlowViewDb(story.id, story.user_id).catch((err) => {
        console.error("Error recording flow view:", err);
        // Revert optimistic viewed state so the ring reappears on next load
        setViewedStoryIds((prev) => { const next = new Set(prev); next.delete(story.id); return next; });
      });
    }
  }, [stories, user?.id]);

  const viewerStoriesRef = React.useRef(activeViewerStories);
  const selectedStoryRef = React.useRef(selectedStory);
  React.useEffect(() => { viewerStoriesRef.current = activeViewerStories; }, [activeViewerStories]);
  React.useEffect(() => { selectedStoryRef.current = selectedStory; }, [selectedStory]);

  const handleSkipStory = React.useCallback(() => {
    const current = selectedStoryRef.current;
    if (!current) return;
    const sortedStories = sortStoriesInstagram(viewerStoriesRef.current);
    const currentIndex = sortedStories.findIndex((s) => s.id === current.id);
    if (currentIndex === -1) { setStoryViewerOpen(false); return; }
    if (currentIndex < sortedStories.length - 1) {
      const next = sortedStories[currentIndex + 1];
      setSelectedStory(next);
      // Record view for the story we're navigating to (if not already viewed)
      if (next.user_id !== user?.id) {
        setViewedStoryIds((prev) => new Set(prev).add(next.id));
        recordFlowViewDb(next.id, next.user_id).catch((err) => {
          console.error("Error recording flow view:", err);
          setViewedStoryIds((prev) => { const s = new Set(prev); s.delete(next.id); return s; });
        });
      }
    } else {
      setStoryViewerOpen(false);
    }
  }, [user?.id]);

  const handlePrevStory = React.useCallback(() => {
    const current = selectedStoryRef.current;
    if (!current) return;
    const sortedStories = sortStoriesInstagram(viewerStoriesRef.current);
    const currentIndex = sortedStories.findIndex((s) => s.id === current.id);
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
    setLinkedRoutines([]);

    if (post.userGoal) {
      setGoalRoutinesLoading(true);
      try {
        const routines = await getRoutinesByGoalIdDb(post.userGoal.goal_id);
        setLinkedRoutines(routines);
      } catch (err) {
        console.error("Error fetching routines:", err);
        setLinkedRoutines([]);
      } finally {
        setGoalRoutinesLoading(false);
      }
    }
  }, []);

  const handleToggleLinkedRoutine = React.useCallback(
    async (groupKey: string, type: number, name: string | undefined, targetUserId: string) => {
      setExpandedLinkedRoutine((prev) => (prev === groupKey ? null : groupKey));
      setLinkedRoutineItems((prev) => {
        if (prev[groupKey] !== undefined) return prev;
        getRoutineItemsForViewDb(targetUserId, type, name)
          .then((items) => setLinkedRoutineItems((p) => ({ ...p, [groupKey]: items })))
          .catch(() => setLinkedRoutineItems((p) => ({ ...p, [groupKey]: [] })));
        return prev;
      });
    },
    [],
  );

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

      if (linkedRoutines.length > 0) {
        const seen = new Set<string>();
        const groups = linkedRoutines.reduce<{ type: number; name?: string }[]>((acc, r) => {
          const k = `${r.type}__${r.name ?? ""}`;
          if (!seen.has(k)) {
            seen.add(k);
            acc.push({ type: r.type, name: r.name });
          }
          return acc;
        }, []);

        const routineResults = await Promise.allSettled(
          groups.map(({ type, name }) =>
            copyRoutineToUserDb(
              selectedGoalPost.user_id,
              user.id,
              type as 1 | 2 | 3,
              name ?? null,
            ),
          ),
        );
        const failedCount = routineResults.filter((r) => r.status === "rejected").length;
        if (failedCount > 0) {
          toast({
            title: t("feed_goal_copied_warning"),
            description: t("feed_goal_copied_warning_desc").replace("{n}", String(failedCount)),
            variant: "destructive",
          });
          setHasAlreadyCopiedGoal(true);
          setGoalModalOpen(false);
          return;
        }
      }

      toast({
        title: t("feed_goal_copied"),
        description: t("feed_goal_copied_desc"),
      });
      setHasAlreadyCopiedGoal(true);
      setGoalModalOpen(false);
    } catch (err: any) {
      console.error("Error copying goal:", err);
      toast({
        title: t("feed_goal_copy_error"),
        description: err?.message || t("retry"),
      });
    } finally {
      setIsCopyingGoal(false);
    }
  }, [selectedGoalPost?.userGoal, selectedGoalPost?.user_id, user, linkedRoutines, t]);

  const handleMarkGoalComplete = React.useCallback(() => {
    if (!selectedGoalPost?.userGoal) return;
    showConfirm(
      t("feed_goal_complete_title"),
      t("feed_goal_complete_desc"),
      async () => {
        setIsMarkingGoalComplete(true);
        try {
          const ug = selectedGoalPost.userGoal!;
          await updateUserGoalDb(ug.id, {
            duration: ug.duration,
            quantity: ug.quantity,
            days_completed: ug.duration,
            perc: 100,
            visibility: ug.visibility ?? 1,
          });
          setGoalModalOpen(false);
          setCompletedGoalDescription(ug.description ?? "");
        } catch (err: any) {
          toast({ title: t("error"), description: err?.message || t("retry"), variant: "destructive" });
        } finally {
          setIsMarkingGoalComplete(false);
        }
      },
    );
  }, [selectedGoalPost?.userGoal, showConfirm, t]);

  const handleCopyRoutine = React.useCallback(
    async (sourceUserId: string, routineType: number, routineName: string | undefined) => {
      if (!user) return;
      const key = `${sourceUserId}::${routineType}::${routineName ?? ""}`;
      if (copyingRoutineKeys.has(key) || copiedRoutineKeys.has(key)) return;

      setCopyingRoutineKeys((prev) => new Set(prev).add(key));
      try {
        await copyRoutineToUserDb(sourceUserId, user.id, routineType as 1 | 2 | 3, routineName ?? null);
        setCopiedRoutineKeys((prev) => new Set(prev).add(key));
        toast({
          title: routineType === 1 ? t("feed_workout_copied") : routineType === 2 ? t("feed_diet_copied") : t("feed_habit_copied"),
          description: t("feed_routine_copied_desc").replace("{name}", routineName ?? "Rotina"),
        });
      } catch (err: any) {
        toast({ title: t("feed_copy_error"), description: err?.message || t("retry"), variant: "destructive" });
      } finally {
        setCopyingRoutineKeys((prev) => { const s = new Set(prev); s.delete(key); return s; });
      }
    },
    [user, copyingRoutineKeys, copiedRoutineKeys, t],
  );

  const applyOptimisticLike = (
    list: PostWithStats[],
    postId: string,
    incentiveType: PostIncentiveType,
  ): PostWithStats[] =>
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
    (postId: string, incentiveType: PostIncentiveType) => {
      const key = `${postId}-${incentiveType}`;
      if (togglingIncentivesRef.current.has(key)) return;

      // Determine desired state from current post list before optimistic update
      const currentPost =
        postsRef.current.find((p) => p.id === postId) ??
        discoverPostsRef.current.find((p) => p.id === postId);
      const wasActive = currentPost?.userLikes.includes(incentiveType) ?? false;
      const wantActive = !wasActive;

      togglingIncentivesRef.current.add(key);
      setTogglingIncentives((prev) => new Set(prev).add(key));

      setPosts((prev) => applyOptimisticLike(prev, postId, incentiveType));
      setDiscoverPosts((prev) => applyOptimisticLike(prev, postId, incentiveType));

      togglePostLike(postId, incentiveType, wantActive).catch(() => {
        // Revert optimistic update on failure
        setPosts((prev) => applyOptimisticLike(prev, postId, incentiveType));
        setDiscoverPosts((prev) => applyOptimisticLike(prev, postId, incentiveType));
        toast({ title: t("feed_incentive_save_error"), description: t("retry"), variant: "destructive" });
      }).finally(() => {
        togglingIncentivesRef.current.delete(key);
        setTogglingIncentives((prev) => { const next = new Set(prev); next.delete(key); return next; });
      });
    },
    [t],
  );

  const handleSharePost = React.useCallback((post: PostWithStats) => {
    const text = `Confira o post de @${post.userNickname} no Linka! 💪${post.description ? `\n"${post.description}"` : ""}`;
    const appOrigin = import.meta.env.VITE_APP_URL || "https://linka.app";
    setShareDrawerText(text);
    setShareDrawerUrl(`${appOrigin}/post/${post.id}`);
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
    if (likesLoading) return;
    setLikesLoading(true);
    try {
      const likes = await getPostLikeUsersDb(post.id);
      setPostLikes(likes);
      setLikesModalOpen(true);
    } catch (err) {
      console.error("Error loading post likes:", err);
      toast({ title: t("error"), description: t("post_incentives_load_error"), variant: "destructive" });
    } finally {
      setLikesLoading(false);
    }
  }, [likesLoading, t]);

  const handleDeletePost = React.useCallback(
    (post: PostWithStats) => {
      if (!user) {
        toast({ title: t("error"), description: t("post_login_required"), variant: "destructive" });
        return;
      }
      showConfirm(
        t("post_delete_title"),
        t("post_delete_desc"),
        async () => {
          try {
            await deletePostDb(post.id);
            setPosts((prev) => prev.filter((p) => p.id !== post.id));
            setDiscoverPosts((prev) => prev.filter((p) => p.id !== post.id));
            toast({ title: t("confirm"), description: t("post_deleted_success") });
          } catch (err: any) {
            console.error("Error deleting post:", err);
            toast({ title: t("post_delete_error"), description: err?.message || t("post_delete_error_desc"), variant: "destructive" });
          }
        },
      );
    },
    [user, showConfirm, t],
  );

  const handleEditPost = React.useCallback((post: PostWithStats) => {
    setEditingPost(post);
    setEditPostOpen(true);
  }, []);

  const handlePostSaved = React.useCallback(async () => {
    await loadFeed(false);
    // Also refresh discover so edited post description updates there too
    getDiscoverPosts()
      .then(setDiscoverPosts)
      .catch(console.error);
  }, [loadFeed]);

  // Shared PostCard props factory
  const sharedCardProps = {
    currentUserId: user?.id,
    togglingIncentives,
    likesLoading,
    onToggleLike: handleToggleLike,
    onOpenLikes: handleOpenLikesModal,
    onOpenGoal: openGoalModal,
    onShare: handleSharePost,
    onReportUser: handleReportUser,
    onReportPost: handleReportPost,
    onEdit: handleEditPost,
    onDelete: handleDeletePost,
  };

  const feedScrollRef = React.useRef<HTMLDivElement>(null);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-2xl flex flex-col">
        {/* Stories skeleton — evita layout shift quando o carrossel aparece */}
        <div className="bg-background border-b border-border/60 px-3 py-3">
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1 shrink-0">
                <div className="w-14 h-14 rounded-full bg-muted animate-pulse" />
                <div className="w-10 h-2 rounded bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        </div>
        <div className="grid w-full gap-3 py-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <PostSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={feedScrollRef} className="mx-auto w-full max-w-2xl flex flex-col">
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

      {/* Feed Content — Following + Discover inline */}
      <div className="grid w-full gap-3 py-4">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} {...sharedCardProps} />
        ))}

        {posts.length === 0 && (
          <div className="flex flex-col items-center gap-2 text-center pt-4 pb-1">
            <p className="text-xs text-muted-foreground">
              {t("feed_follow_cta")}
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full text-xs h-7 px-3"
              onClick={() => navigate("/buscar")}
            >
              {t("feed_find_people")}
            </Button>
          </div>
        )}

        {/* Discover section divider */}
        <div className="flex items-center gap-3 py-2">
          <div className="flex-1 h-px bg-border/60" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1">
            {t("feed_discover_label")}
          </span>
          <div className="flex-1 h-px bg-border/60" />
        </div>
        {posts.length > 0 && (
          <p className="text-xs text-muted-foreground text-center -mt-1 mb-1">
            {t("feed_discover_end")}
          </p>
        )}

        {discoverLoading ? (
          <>{[1, 2, 3].map((i) => <PostSkeleton key={i} />)}</>
        ) : discoverPosts.length === 0 ? (
          <div className="flex flex-col items-center py-8 gap-3 text-center">
            <p className="text-sm text-muted-foreground">
              {t("feed_discover_empty")}
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full text-xs h-7 px-3"
              onClick={() => navigate("/buscar")}
            >
              {t("feed_find_people_follow")}
            </Button>
          </div>
        ) : (
          discoverPosts.map((post) => (
            <PostCard
              key={`seed-${post.id}`}
              post={post}
              {...sharedCardProps}
              showFollowButton
            />
          ))
        )}
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
          const storiesList = stories.filter((st) => st.user_id === s.user_id);
          setActiveViewerStories(storiesList.length > 0 ? storiesList : [s]);
        }}
        onDeleted={() => {
          const deletedId = selectedStory?.id;
          setStoryViewerOpen(false);
          setSelectedStory(null);
          setActiveViewerStories([]);
          // Remove otimisticamente antes do reload para evitar flash visual
          if (deletedId) setStories((prev) => prev.filter((s) => s.id !== deletedId));
          getActiveStoriesDb()
            .then(setStories)
            .catch(() => {
              toast({ title: t("error"), description: t("retry"), variant: "destructive" });
            });
        }}
      />

      {/* Goal Progress Drawer */}
      <Drawer open={goalModalOpen} onOpenChange={setGoalModalOpen}>
        <DrawerContent className="max-h-[80dvh] flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DrawerHeader className="shrink-0">
            <DrawerTitle>{t("feed_goal_drawer_title")}</DrawerTitle>
          </DrawerHeader>
          <div
            className="flex flex-col flex-1 gap-4 overflow-y-auto px-4"
            style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
          >
            {selectedGoalPost?.userGoal && (
              <div className="space-y-4 flex-1">
                {/* Goal Info */}
                <div className="p-4 border border-border/60 rounded-lg bg-muted/30 space-y-3">
                  <p className="text-lg font-bold">{selectedGoalPost.userGoal.description}</p>

                  {/* Progress Bar — Bug 9 fix: clamp to 100 */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-foreground">{t("feed_goal_progress_label")}</span>
                      <span className="text-lg font-bold text-brand">
                        {Math.round(Math.min(100, selectedGoalPost.userGoal.perc))}%
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-5 overflow-hidden">
                      <div
                        className="bg-brand h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, selectedGoalPost.userGoal.perc)}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div className="p-2 bg-background/50 rounded text-center">
                      <p className="text-xs text-muted-foreground">{t("feed_goal_duration")}</p>
                      <p className="text-sm font-bold">{selectedGoalPost.userGoal.duration}d</p>
                    </div>
                    <div className="p-2 bg-background/50 rounded text-center">
                      <p className="text-xs text-muted-foreground">{t("feed_goal_quantity")}</p>
                      <p className="text-sm font-bold">{selectedGoalPost.userGoal.quantity}</p>
                    </div>
                    <div className="p-2 bg-background/50 rounded text-center">
                      <p className="text-xs text-muted-foreground">{t("feed_goal_type_label")}</p>
                      <p className="text-sm font-bold">
                        {selectedGoalPost.userGoal.type_goal === 1
                          ? t("feed_goal_type_fitness")
                          : selectedGoalPost.userGoal.type_goal === 2
                            ? t("feed_goal_type_health")
                            : t("feed_goal_type_habits")}
                      </p>
                    </div>
                  </div>
                </div>

                {goalRoutinesLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <p className="text-sm text-muted-foreground">{t("feed_routine_loading")}</p>
                  </div>
                ) : (
                  <>
                    {/* Own post — show linked routines (view only) */}
                    {selectedGoalPost.user_id === user?.id && (
                      <>
                        {linkedRoutines.length > 0 ? (
                          <RoutineAccordion
                            linkedRoutines={linkedRoutines}
                            expandedRoutines={expandedRoutines}
                            setExpandedRoutines={setExpandedRoutines}
                            expandedLinkedRoutine={expandedLinkedRoutine}
                            linkedRoutineItems={linkedRoutineItems}
                            targetUserId={selectedGoalPost.user_id}
                            onToggleRoutine={handleToggleLinkedRoutine}
                            showCopyButtons={false}
                            copyingRoutineKeys={copyingRoutineKeys}
                            copiedRoutineKeys={copiedRoutineKeys}
                            onCopyRoutine={handleCopyRoutine}
                            postUserId={selectedGoalPost.user_id}
                          />
                        ) : (
                          <div className="border border-border/60 rounded-lg p-4 bg-muted/20 text-center space-y-3">
                            <p className="text-sm text-muted-foreground">
                              {t("feed_routines_no_linked")}
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full rounded-full"
                              onClick={() => navigate("/metas?tab=rotinas")}
                            >
                              {t("feed_routines_link_btn")}
                            </Button>
                          </div>
                        )}
                      </>
                    )}

                    {/* Other user's post — show routines with copy buttons */}
                    {selectedGoalPost.user_id !== user?.id && linkedRoutines.length > 0 && (
                      <RoutineAccordion
                        linkedRoutines={linkedRoutines}
                        expandedRoutines={expandedRoutines}
                        setExpandedRoutines={setExpandedRoutines}
                        expandedLinkedRoutine={expandedLinkedRoutine}
                        linkedRoutineItems={linkedRoutineItems}
                        targetUserId={selectedGoalPost.user_id}
                        onToggleRoutine={handleToggleLinkedRoutine}
                        showCopyButtons
                        copyingRoutineKeys={copyingRoutineKeys}
                        copiedRoutineKeys={copiedRoutineKeys}
                        onCopyRoutine={handleCopyRoutine}
                        postUserId={selectedGoalPost.user_id}
                      />
                    )}
                  </>
                )}

                {/* Mark complete button — own post only */}
                {selectedGoalPost.user_id === user?.id && (selectedGoalPost.userGoal.perc ?? 0) < 100 && (
                  <button
                    onClick={handleMarkGoalComplete}
                    disabled={isMarkingGoalComplete}
                    className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-emerald-500 transition-colors py-1 disabled:opacity-50"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    {isMarkingGoalComplete ? t("feed_goal_marking") : t("feed_goal_mark_complete_btn")}
                  </button>
                )}

                {/* Copy Goal button */}
                {selectedGoalPost.user_id !== user?.id && (
                  <div className="flex gap-2">
                    <Button
                      onClick={handleCopyGoal}
                      disabled={isCopyingGoal || hasAlreadyCopiedGoal}
                      className="flex-1 rounded-full gap-2 shrink-0"
                    >
                      {isCopyingGoal ? t("feed_goal_copying") : hasAlreadyCopiedGoal ? t("feed_goal_already_copied") : t("feed_goal_copy_btn")}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Goal Completed Dialog */}
      {completedGoalDescription !== null && (
        <GoalCompletedDialog
          goalDescription={completedGoalDescription}
          onClose={() => setCompletedGoalDescription(null)}
        />
      )}

      {/* Report Dialog */}
      <ReportDrawer
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        type={reportType}
        target={
          reportedPost
            ? {
                id: reportedPost.id,
                userId: reportedPost.user_id,
                userName: reportedPost.userNickname,
                description: reportedPost.description,
              }
            : null
        }
      />

      <ShareDrawer
        open={shareDrawerOpen}
        onOpenChange={setShareDrawerOpen}
        text={shareDrawerText}
        url={shareDrawerUrl}
        title={t("feed_share_post_title")}
      />

      <PostLikesModal
        open={likesModalOpen}
        onOpenChange={setLikesModalOpen}
        likes={postLikes}
      />

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
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDialog.onConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditPostDrawer
        open={editPostOpen}
        onOpenChange={(v) => { if (!v) { setEditPostOpen(false); setEditingPost(null); } }}
        post={editingPost}
        onSaved={handlePostSaved}
      />
    </div>
  );
}

// ─── Extracted sub-component to eliminate duplication in the Goal Drawer ───

interface RoutineAccordionProps {
  linkedRoutines: any[];
  expandedRoutines: boolean;
  setExpandedRoutines: (v: boolean) => void;
  expandedLinkedRoutine: string | null;
  linkedRoutineItems: Record<string, any[]>;
  targetUserId: string;
  onToggleRoutine: (key: string, type: number, name: string | undefined, userId: string) => void;
  showCopyButtons: boolean;
  copyingRoutineKeys: Set<string>;
  copiedRoutineKeys: Set<string>;
  onCopyRoutine: (sourceUserId: string, routineType: number, routineName: string | undefined) => void;
  postUserId: string;
}

function RoutineAccordion({
  linkedRoutines,
  expandedRoutines,
  setExpandedRoutines,
  expandedLinkedRoutine,
  linkedRoutineItems,
  targetUserId,
  onToggleRoutine,
  showCopyButtons,
  copyingRoutineKeys,
  copiedRoutineKeys,
  onCopyRoutine,
  postUserId,
}: RoutineAccordionProps) {
  const { t } = useLanguage();
  const seen = new Set<string>();
  const groups = linkedRoutines.reduce<{ key: string; type: number; name?: string }[]>((acc, r) => {
    const k = `${r.type}__${r.name ?? ""}`;
    if (!seen.has(k)) { seen.add(k); acc.push({ key: k, type: r.type, name: r.name }); }
    return acc;
  }, []);

  return (
    <div className="border border-border/60 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpandedRoutines(!expandedRoutines)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <h3 className="text-sm font-medium">
          {t("feed_goal_linked_routines").replace("{n}", String(groups.length))}
        </h3>

        <ChevronDown
          className={`h-5 w-5 transform transition-transform ${expandedRoutines ? "rotate-180" : ""}`}
        />
      </button>

      {expandedRoutines && (
        <div className="border-t border-border/60 divide-y divide-border/40">
          {groups.map(({ key, type, name }) => {
            const typeIcon = type === 1 ? "🏋️" : type === 2 ? "🍽️" : "✅";
            const typeLabel = type === 1 ? t("feed_routines_exercises") : type === 2 ? t("feed_routines_diets") : t("feed_goal_type_habits");
            const label = name || typeLabel;
            const isOpen = expandedLinkedRoutine === key;
            const items = linkedRoutineItems[key];
            const copyKey = `${postUserId}::${type}::${name ?? ""}`;
            const isCopyingThis = copyingRoutineKeys.has(copyKey);
            const isCopiedThis = copiedRoutineKeys.has(copyKey);

            return (
              <div key={key}>
                <button
                  onClick={() => onToggleRoutine(key, type, name, targetUserId)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                >
                  <span className="text-base">{typeIcon}</span>
                  <span className="flex-1 text-sm font-medium truncate">{label}</span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {isOpen && (
                  <div className="bg-muted/20 px-4 pb-3 pt-1 space-y-1.5">
                    {!items ? (
                      <p className="text-xs text-muted-foreground py-2">{t("feed_routine_loading")}</p>
                    ) : items.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">{t("feed_routine_empty_items")}</p>
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
                        {showCopyButtons && (
                          <Button
                            size="sm"
                            variant={isCopiedThis ? "outline" : "default"}
                            className="w-full rounded-full mt-2"
                            disabled={isCopyingThis || isCopiedThis}
                            onClick={(e) => {
                              e.stopPropagation();
                              onCopyRoutine(postUserId, type, name);
                            }}
                          >
                            {isCopyingThis
                              ? t("feed_goal_copying")
                              : isCopiedThis
                                ? t("feed_copied_btn")
                                : type === 1
                                  ? t("feed_copy_workout_btn")
                                  : type === 2
                                    ? t("feed_copy_diet_btn")
                                    : t("feed_copy_habit_btn")}
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
      )}
    </div>
  );
}