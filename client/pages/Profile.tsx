import * as React from "react";
import {
  getUserProfileDb,
  getUserPostsDb,
  getUserStatsDb,
  getUserRoutinesDb,
  createRoutineDb,
  createUserWorkoutsDb,
  createCustomWorkoutDb,
  createCustomDietDb,
  getWorkoutsDb,
  getDietsDb,
  createUserDietsDb,
  getHabitsDb,
  createUserHabitsDb,
  getRoutineTypeName,
  getGoalByIdDb,
  updateRoutineGoalDb,
  getFollowersDb,
  getFollowingDb,
  getFollowingStatusBatchDb,
  isFollowingDb,
  getUserShotsDb,
  getUserGoalsByUserIdDb,
  deletePostDb,
  updatePostDb,
  updateUserProfileDb,
  removePostPhotoDb,
  deleteRoutineDb,
  getPostLikeUsersDb,
  flushPendingIncentivesDb,
  getPostCommentsDb,
  getCommercialProfileDb,
  getCommercialOffersByUserIdDb,
  incrementOfferClickDb,
  type CommercialOffer,
  getWorkoutHistoryDb,
  getUserActiveStoriesDb,
  getUserPostLikesDb,
  deleteAllUserDataDb,
  type UserProfile,
  type PostWithUser,
  type UserStats,
  type Routine,
  type Workout,
  type Diet,
  type Habit,
  type UserGoal,
  type ShotWithUser,
  type CommercialProfile,
  type ServicePlan,
  getCommercialPlansDb,
  type StoryWithUser,
  type PostIncentiveType,
  getRoutinesByGoalIdDb,
  getRoutineItemsForViewDb,
  copyRoutineToUserDb,
} from "@/lib/ritmofit-db";
import { formatTimeAgo } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageWithFallback } from "@/components/shared/image-with-fallback";
import { UserAvatar } from "@/components/shared/user-avatar";
import { PostLikesModal } from "@/components/modals/post-likes-modal";
import { PostCommentsDialog } from "@/components/modals/post-comments-dialog";
import { UserInsignias } from "@/components/profile/user-insignias";
import { VerifiedBadge } from "@/components/shared/VerifiedBadge";
import { PostCarousel } from "@/components/post/post-carousel";
import { FlowViewerModal } from "@/components/modals/flow-viewer-modal";
import { PostIncentiveButton } from "@/components/shared/post-incentive-button";
import { FollowButton } from "@/components/shared/follow-button";
import { FollowListDrawer } from "@/components/profile/follow-list-drawer";
import { SettingsDrawer } from "@/components/profile/settings-drawer";
import { ShotEditorDrawer } from "@/components/profile/shot-editor-drawer";
import { WorkoutHistoryDrawer } from "@/components/profile/workout-history-drawer";
import { togglePostLike } from "../services/post.service";
import { ExerciseImage } from "@/components/shared/exercise-image";
import { fetchExerciseCatalog, type CatalogExercise } from "@/lib/exercise-catalog";
import { fetchMealCatalog, type CatalogMeal } from "@/lib/diet-catalog";
import { DietImage } from "@/components/shared/diet-image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ProfileSkeleton } from "@/components/shared/animated-loading";
import { ShareDrawer } from "@/components/shared/share-drawer";
import { ImageCropperDrawer } from "@/components/shared/image-cropper-drawer";
import { profileShareUrl } from "@/lib/share-url";
import {
  Edit2,
  Plus,
  ArrowLeft,
  Check,
  Tag,
  Settings,
  Trash2,
  MessageSquare,
  Filter,
  Search,
  Share2,
  ArrowRight,
  ExternalLink,
  Phone,
  ListChecks,
  Target,
  ShieldCheck,
  ImagePlus,
  Lock,
} from "lucide-react";
import { resetSupabaseAuth, supabase } from "@/lib/supabase";
import { useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "@/lib/language-context";
import { Browser } from "@capacitor/browser";
import { hapticLight } from "@/lib/haptics";

export default function Profile() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { userId } = useParams<{ userId?: string }>();
  const { t } = useLanguage();

  // Pull-to-refresh state (handlers declared after loadProfile)
  const pullStartY = React.useRef(0);
  const [pullDistance, setPullDistance] = React.useState(0);
  const [isPulling, setIsPulling] = React.useState(false);
  const PULL_THRESHOLD = 72;

  // Centralized confirmation dialog state (replaces native confirm())
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
    []
  );

  // Determine if we're viewing another user's profile
  const isViewingOtherProfile = !!userId && userId !== user?.id;
  const profileUserId = userId || user?.id;

  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [shareDrawerOpen, setShareDrawerOpen] = React.useState(false);
  const [shareDrawerText, setShareDrawerText] = React.useState("");
  const [shareDrawerUrl, setShareDrawerUrl] = React.useState<string | undefined>(undefined);
  const [posts, setPosts] = React.useState<PostWithUser[]>([]);
  const [shots, setShots] = React.useState<ShotWithUser[]>([]);
  const [routines, setRoutines] = React.useState<Routine[]>([]);
  const [selectedPost, setSelectedPost] = React.useState<PostWithUser | null>(null);
  const [postDescExpanded, setPostDescExpanded] = React.useState(false);
  const [isPostViewerOpen, setIsPostViewerOpen] = React.useState(false);
  const [isEditingPost, setIsEditingPost] = React.useState(false);
  const [editPostDescription, setEditPostDescription] = React.useState("");
  const [editPostGoalId, setEditPostGoalId] = React.useState<string>("");
  const [isUpdatingPost, setIsUpdatingPost] = React.useState(false);
  const [removingPhoto, setRemovingPhoto] = React.useState(false);
  const [postLikes, setPostLikes] = React.useState<any[]>([]);
  const [postComments, setPostComments] = React.useState<any[]>([]);
  const [postUserLikes, setPostUserLikes] = React.useState<PostIncentiveType[]>([]);
  const postUserLikesRef = React.useRef<PostIncentiveType[]>([]);
  const [isTogglingPostLike, setIsTogglingPostLike] = React.useState(false);
  const [isLoadingPostData, setIsLoadingPostData] = React.useState(false);
  const [isLikesModalOpen, setIsLikesModalOpen] = React.useState(false);
  const [selectedShot, setSelectedShot] = React.useState<ShotWithUser | null>(null);
  const [isShotEditorOpen, setIsShotEditorOpen] = React.useState(false);
  const [stats, setStats] = React.useState<UserStats>({
    postsCount: 0,
    followersCount: 0,
    followingCount: 0,
    points: 0,
    level: 1,
  });
  const [loading, setLoading] = React.useState(true);
  const [profileError, setProfileError] = React.useState(false);
  const [isCreateRoutineOpen, setIsCreateRoutineOpen] = React.useState(false);
  const [isCreatingRoutine, setIsCreatingRoutine] = React.useState(false);
  const [selectedRoutineType, setSelectedRoutineType] = React.useState<
    1 | 2 | 3 | null
  >(null);
  const [workouts, setWorkouts] = React.useState<Workout[]>([]);
  const [workoutsLoading, setWorkoutsLoading] = React.useState(false);
  const [selectedWorkoutIds, setSelectedWorkoutIds] = React.useState<
    Set<string>
  >(new Set());
  const [isSavingWorkouts, setIsSavingWorkouts] = React.useState(false);
  const [searchQueryWorkouts, setSearchQueryWorkouts] = React.useState("");
  const [catalogExercises, setCatalogExercises] = React.useState<CatalogExercise[]>([]);
  const [catalogMeals, setCatalogMeals] = React.useState<CatalogMeal[]>([]);
  const [selectedMuscleGroups, setSelectedMuscleGroups] = React.useState<
    Set<string>
  >(new Set());
  const [diets, setDiets] = React.useState<Diet[]>([]);
  const [dietsLoading, setDietsLoading] = React.useState(false);
  const [selectedDietIds, setSelectedDietIds] = React.useState<Set<string>>(
    new Set(),
  );
  const [isSavingDiets, setIsSavingDiets] = React.useState(false);
  const [searchQueryDiets, setSearchQueryDiets] = React.useState("");
  const [habits, setHabits] = React.useState<Habit[]>([]);
  const [habitsLoading, setHabitsLoading] = React.useState(false);
  const [selectedHabitIds, setSelectedHabitIds] = React.useState<Set<string>>(
    new Set(),
  );
  const [isSavingHabits, setIsSavingHabits] = React.useState(false);
  const [expandedRoutineType, setExpandedRoutineType] = React.useState<
    number | null
  >(null);
  const [goalIndicatorRoutineId, setGoalIndicatorRoutineId] = React.useState<
    string | null
  >(null);
  const [linkedGoal, setLinkedGoal] = React.useState<UserGoal | null>(null);
  const [userGoals, setUserGoals] = React.useState<UserGoal[]>([]);
  const [profileStories, setProfileStories] = React.useState<StoryWithUser[]>([]);
  const [isStoryViewerOpen, setIsStoryViewerOpen] = React.useState(false);
  const [selectedProfileStory, setSelectedProfileStory] = React.useState<StoryWithUser | null>(null);
  const [isUpdatingGoal, setIsUpdatingGoal] = React.useState(false);
  const [workoutHistoryModalOpen, setWorkoutHistoryModalOpen] = React.useState(false);
  const [selectedWorkoutForHistory, setSelectedWorkoutForHistory] = React.useState<Workout | null>(null);
  const [workoutHistory, setWorkoutHistory] = React.useState<any[]>([]);
  const [isLoadingWorkoutHistory, setIsLoadingWorkoutHistory] = React.useState(false);
  const [deleteRoutineId, setDeleteRoutineId] = React.useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = React.useState(false);
  const [isDeletingRoutine, setIsDeletingRoutine] = React.useState(false);
  const [showFollowersModal, setShowFollowersModal] = React.useState(false);
  const [showFollowingModal, setShowFollowingModal] = React.useState(false);
  // Indica se o usuário logado segue o dono do perfil (para regras de privacidade)
  const [viewerFollowsProfile, setViewerFollowsProfile] = React.useState(false);
  const [followers, setFollowers] = React.useState<any[]>([]);
  const [following, setFollowing] = React.useState<any[]>([]);
  const [isLoadingFollowers, setIsLoadingFollowers] = React.useState(false);
  const [followerFollowStatus, setFollowerFollowStatus] = React.useState<Record<string, boolean>>({});
  const [followingFollowStatus, setFollowingFollowStatus] = React.useState<Record<string, boolean>>({});

  // Goal detail drawer state
  const [goalDrawerOpen, setGoalDrawerOpen] = React.useState(false);
  const [selectedGoalForDrawer, setSelectedGoalForDrawer] = React.useState<UserGoal | null>(null);
  const [goalDrawerRoutines, setGoalDrawerRoutines] = React.useState<Array<{ routine: Routine; items: Array<{ id: string; workoutName?: string; dietName?: string; habitName?: string }> }>>([]);
  const [isLoadingGoalDrawer, setIsLoadingGoalDrawer] = React.useState(false);
  const [copyingRoutineId, setCopyingRoutineId] = React.useState<string | null>(null);

  // Edit form state

  const [profileOffers, setProfileOffers] = React.useState<CommercialOffer[]>([]);

  // Commercial profile state
  const [isPlansModalOpen, setIsPlansModalOpen] = React.useState(false);
  const [commercialProfile, setCommercialProfile] = React.useState<CommercialProfile | null>(null);
  const [servicePlans, setServicePlans] = React.useState<ServicePlan[]>([]);

  // Settings drawer (controlled externally so the trigger can be styled per design)
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  // Cover photo (banner) — own profile can replace the gradient with a photo
  const coverFileInputRef = React.useRef<HTMLInputElement>(null);
  const [coverCropSrc, setCoverCropSrc] = React.useState<string | null>(null);
  const [isSavingCover, setIsSavingCover] = React.useState(false);

  // Delete account state (UI trigger not yet implemented)
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("");

  // Edit account state

  // Notifications state

  // Personalization state

  const loadProfile = React.useCallback(async () => {
    if (!profileUserId) return;

    // Reset profile-specific state so stale data from the previous user is never shown
    setProfile(null);
    setPosts([]);
    setShots([]);
    setRoutines([]);
    setLoading(true);

    try {
      // Batch 1 — critical above-the-fold data: show immediately
      const [profileData, statsData, postsData] = await Promise.all([
        getUserProfileDb(profileUserId),
        getUserStatsDb(profileUserId),
        getUserPostsDb(profileUserId),
      ]);
      setProfile(profileData);
      setStats(statsData);
      setPosts(postsData);
      setLoading(false); // unblock UI as soon as critical data arrives

      // Batch 2 — below-the-fold tabs: load in background without blocking render
      const [
        routinesData,
        userGoalsData,
        shotsData,
        commercialProfileData,
        offersData,
        commercialPlansData,
      ] = await Promise.all([
        getUserRoutinesDb(profileUserId),
        getUserGoalsByUserIdDb(profileUserId),
        getUserShotsDb(profileUserId),
        getCommercialProfileDb(profileUserId),
        getCommercialOffersByUserIdDb(profileUserId),
        getCommercialPlansDb(profileUserId),
      ]);
      setRoutines(routinesData);
      setUserGoals(isViewingOtherProfile ? userGoalsData.filter((g) => g.visibility === 1) : userGoalsData);
      setShots(shotsData);
      setCommercialProfile(commercialProfileData);
      setProfileOffers(offersData.filter((o) => o.is_active));
      setServicePlans(commercialPlansData.map((p) => ({ name: p.name, price: p.price, description: p.description ?? undefined })));

      // Batch 3 — stories: fire-and-forget
      getUserActiveStoriesDb(profileUserId).then(setProfileStories).catch((err) => console.error("Erro ao carregar stories do perfil:", err));

      // Status de seguimento do visitante (usado nas regras de privacidade)
      if (isViewingOtherProfile) {
        isFollowingDb(profileUserId).then(setViewerFollowsProfile).catch(() => setViewerFollowsProfile(false));
      } else {
        setViewerFollowsProfile(false);
      }
    } catch (err: any) {
      console.error("Error loading profile:", err);
      toast({
        title: t("profile_toast_load_error"),
        description: t("retry"),
        variant: "destructive",
      });
      setProfileError(true);
      setLoading(false);
    }
  }, [profileUserId]);

  // Pull-to-refresh handlers (declared after loadProfile to avoid forward reference)
  const onTouchStart = React.useCallback((e: React.TouchEvent) => {
    if (window.scrollY > 0) return;
    pullStartY.current = e.touches[0].clientY;
    setIsPulling(true);
  }, []);

  const onTouchMove = React.useCallback((e: React.TouchEvent) => {
    if (!isPulling) return;
    const delta = e.touches[0].clientY - pullStartY.current;
    if (delta > 0) setPullDistance(Math.min(delta * 0.4, PULL_THRESHOLD + 20));
  }, [isPulling]);

  const onTouchEnd = React.useCallback(() => {
    if (!isPulling) return;
    if (pullDistance >= PULL_THRESHOLD) {
      hapticLight();
      loadProfile();
    }
    setPullDistance(0);
    setIsPulling(false);
  }, [isPulling, pullDistance, loadProfile]);

  const handleViewPost = React.useCallback(async (post: PostWithUser) => {
    setSelectedPost(post);
    setPostDescExpanded(false);
    setEditPostDescription(post.description);
    setEditPostGoalId(post.user_goal_id || "");
    setIsPostViewerOpen(true);
    setIsEditingPost(false);
    setIsLoadingPostData(true);

    try {
      await flushPendingIncentivesDb(post.id);
      const [likes, comments, userLikes] = await Promise.all([
        getPostLikeUsersDb(post.id),
        getPostCommentsDb(post.id),
        getUserPostLikesDb(post.id),
      ]);
      setPostLikes(likes);
      setPostComments(comments);
      setPostUserLikes(userLikes);
    } catch (err) {
      console.error("Error loading post data:", err);
      toast({ title: t("profile_toast_post_data_error"), description: t("retry"), variant: "destructive" });
    } finally {
      setIsLoadingPostData(false);
    }
  }, []);

  const handleUpdatePost = React.useCallback(async () => {
    if (!selectedPost) return;

    setIsUpdatingPost(true);
    try {
      await updatePostDb(selectedPost.id, editPostDescription, editPostGoalId || null);

      // Update local posts list
      setPosts((prevPosts) =>
        prevPosts.map((p) =>
          p.id === selectedPost.id
            ? { ...p, description: editPostDescription, user_goal_id: editPostGoalId || null }
            : p,
        ),
      );

      setIsEditingPost(false);
      toast({
        title: t("newpost_success"),
        description: t("profile_toast_post_updated"),
      });
    } catch (err: any) {
      console.error("Error updating post:", err);
      toast({
        title: t("profile_toast_post_update_error"),
        description: err?.message || t("retry"),
        variant: "destructive",
      });
    } finally {
      setIsUpdatingPost(false);
    }
  }, [selectedPost, editPostDescription, editPostGoalId]);

  const handleRemoveCarouselPhoto = React.useCallback(async (photoUrl: string) => {
    if (!selectedPost) return;
    setRemovingPhoto(true);
    try {
      const updatedPhotos = await removePostPhotoDb(selectedPost.id, photoUrl);
      const updatedPost = { ...selectedPost, photos: updatedPhotos };
      setSelectedPost(updatedPost);
      setPosts((prev) => prev.map((p) => p.id === selectedPost.id ? updatedPost : p));
      toast({ title: t("profile_toast_photo_removed") });
    } catch (err: any) {
      toast({ title: t("profile_toast_photo_remove_error"), description: err?.message, variant: "destructive" });
    } finally {
      setRemovingPhoto(false);
    }
  }, [selectedPost]);

  // Keep ref always in sync so handleTogglePostIncentive can read current value without closure staleness
  React.useEffect(() => { postUserLikesRef.current = postUserLikes; }, [postUserLikes]);

  const handleTogglePostIncentive = React.useCallback(async (type: PostIncentiveType) => {
    if (!selectedPost || isTogglingPostLike) return;
    setIsTogglingPostLike(true);
    const previousLikes = postUserLikesRef.current;
    const wasActive = previousLikes.includes(type);
    setPostUserLikes(wasActive ? previousLikes.filter((t) => t !== type) : [...previousLikes, type]);
    try {
      togglePostLike(selectedPost.id, type, !wasActive);
      await flushPendingIncentivesDb(selectedPost.id);
      const updatedLikes = await getPostLikeUsersDb(selectedPost.id);
      setPostLikes(updatedLikes);
    } catch (err) {
      setPostUserLikes(previousLikes);
      toast({ title: t("profile_toast_incentive_error"), description: t("retry"), variant: "destructive" });
    } finally {
      setIsTogglingPostLike(false);
    }
  }, [selectedPost, isTogglingPostLike]);

  const handleDeletePost = React.useCallback(() => {
    if (!selectedPost) return;
    showConfirm(
      t("post_delete_title"),
      t("post_delete_desc"),
      async () => {
        setIsUpdatingPost(true);
        try {
          await deletePostDb(selectedPost.id);
          setPosts((prevPosts) => prevPosts.filter((p) => p.id !== selectedPost.id));
          setIsPostViewerOpen(false);
          setSelectedPost(null);
          toast({ title: t("newpost_success"), description: t("post_deleted_success") });
        } catch (err: any) {
          console.error("Error deleting post:", err);
          toast({ title: t("post_delete_error"), description: err?.message || t("retry"), variant: "destructive" });
        } finally {
          setIsUpdatingPost(false);
        }
      }
    );
  }, [selectedPost, showConfirm]);


  // Define callback functions first
  const loadFollowersData = React.useCallback(async () => {
    setIsLoadingFollowers(true);
    try {
      const data = await getFollowersDb(profileUserId);
      setFollowers(data);

      // Batch-check follow status for all followers in one query instead of N individual queries
      const followerIds = data.map((f: any) => f.id).filter(Boolean);
      const statusMap = await getFollowingStatusBatchDb(followerIds);
      setFollowerFollowStatus(statusMap);
    } catch (err: any) {
      console.error("Error loading followers:", err);
      toast({
        title: t("profile_toast_followers_error"),
        description: err?.message || t("retry"),
      });
    } finally {
      setIsLoadingFollowers(false);
    }
  }, [profileUserId]);

  const loadFollowingData = React.useCallback(async () => {
    setIsLoadingFollowers(true);
    try {
      const data = await getFollowingDb(profileUserId);
      setFollowing(data);

      // All users in the "following" list are already followed by definition
      const statusMap: Record<string, boolean> = {};
      data.forEach((u: any) => { if (u.id) statusMap[u.id] = true; });
      setFollowingFollowStatus(statusMap);
    } catch (err: any) {
      console.error("Error loading following:", err);
      toast({
        title: t("profile_toast_following_error"),
        description: err?.message || t("retry"),
      });
    } finally {
      setIsLoadingFollowers(false);
    }
  }, [profileUserId]);



  React.useEffect(() => {
    loadProfile();
  }, [profileUserId, loadProfile]);

  // Refresh stats when page becomes visible (cooldown: at most once per 60s)
  const lastStatsRefreshRef = React.useRef(0);
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && profileUserId) {
        const now = Date.now();
        if (now - lastStatsRefreshRef.current < 60_000) return; // 60s cooldown
        lastStatsRefreshRef.current = now;
        getUserStatsDb(profileUserId).then((newStats) => {
          setStats(newStats);
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [profileUserId]);

  // Load followers when modal opens
  React.useEffect(() => {
    if (showFollowersModal) {
      loadFollowersData();
    }
  }, [showFollowersModal, loadFollowersData]);

  // Load following when modal opens
  React.useEffect(() => {
    if (showFollowingModal) {
      loadFollowingData();
    }
  }, [showFollowingModal, loadFollowingData]);

  const openGoalIndicatorModal = async (routine: Routine) => {
    setGoalIndicatorRoutineId(routine.id);

    if (routine.goal_id) {
      try {
        const goal = await getGoalByIdDb(routine.goal_id);
        setLinkedGoal(goal);
      } catch (err) {
        console.error("Error loading linked goal:", err);
      }
    } else {
      setLinkedGoal(null);
    }
  };

  const handleLinkGoal = async (goalId: string) => {
    if (!goalIndicatorRoutineId || !user) return;

    setIsUpdatingGoal(true);
    try {
      const updatedRoutine = await updateRoutineGoalDb(
        goalIndicatorRoutineId,
        goalId,
      );
      if (updatedRoutine) {
        // Update the routines list
        setRoutines(
          routines.map((r) =>
            r.id === goalIndicatorRoutineId ? updatedRoutine : r,
          ),
        );

        // Update the linked goal display
        const goal = await getGoalByIdDb(goalId);
        setLinkedGoal(goal);

        toast({
          title: t("profile_toast_goal_linked"),
          description: t("profile_toast_goal_linked_desc"),
        });
      }
    } catch (err: any) {
      console.error("Error linking goal:", err);
      toast({
        title: t("profile_toast_goal_link_error"),
        description: err.message || t("retry"),
        variant: "destructive",
      });
    } finally {
      setIsUpdatingGoal(false);
    }
  };

  const handleUnlinkGoal = async () => {
    if (!goalIndicatorRoutineId || !user) return;

    setIsUpdatingGoal(true);
    try {
      const updatedRoutine = await updateRoutineGoalDb(
        goalIndicatorRoutineId,
        null,
      );
      if (updatedRoutine) {
        // Update the routines list
        setRoutines(
          routines.map((r) =>
            r.id === goalIndicatorRoutineId ? updatedRoutine : r,
          ),
        );
        setLinkedGoal(null);

        toast({
          title: t("profile_toast_goal_unlinked"),
          description: t("profile_toast_goal_unlinked_desc"),
        });
      }
    } catch (err: any) {
      console.error("Error unlinking goal:", err);
      toast({
        title: t("profile_toast_goal_unlink_error"),
        description: err.message || t("retry"),
        variant: "destructive",
      });
    } finally {
      setIsUpdatingGoal(false);
    }
  };

  const handleOpenGoalDrawer = async (goal: UserGoal) => {
    setSelectedGoalForDrawer(goal);
    setGoalDrawerOpen(true);
    setGoalDrawerRoutines([]);
    setIsLoadingGoalDrawer(true);
    try {
      const routines = await getRoutinesByGoalIdDb(goal.goal_id);
      const withItems = await Promise.all(
        routines.map(async (routine) => {
          const items = await getRoutineItemsForViewDb(routine.user_id, routine.type, routine.name, routine.id);
          return { routine, items };
        })
      );
      setGoalDrawerRoutines(withItems.filter((r) => r.items.length > 0));
    } catch (err) {
      console.error("Error loading goal routines:", err);
    } finally {
      setIsLoadingGoalDrawer(false);
    }
  };

  const handleCopyRoutine = async (routine: Routine) => {
    if (!user || !profileUserId) return;
    setCopyingRoutineId(routine.id);
    try {
      await copyRoutineToUserDb(profileUserId, user.id, routine.type as 1 | 2 | 3, routine.name ?? null);
      toast({ title: t("profile_toast_routine_copied"), description: t("profile_toast_routine_copied_desc") });
    } catch (err: any) {
      toast({ title: t("profile_toast_routine_copy_error"), description: err.message || t("retry"), variant: "destructive" });
    } finally {
      setCopyingRoutineId(null);
    }
  };

  const handleOpenWorkoutHistory = async (workout: Workout) => {
    setSelectedWorkoutForHistory(workout);
    setWorkoutHistoryModalOpen(true);

    // Fetch workout history
    setIsLoadingWorkoutHistory(true);
    try {
      if (!user) {
        throw new Error("Usuário não autenticado");
      }
      const history = await getWorkoutHistoryDb(user.id, workout.id);
      setWorkoutHistory(history || []);
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      console.error("Error loading workout history:", errorMsg);
      toast({
        title: t("profile_toast_history_error"),
        description: errorMsg || t("retry"),
        variant: "destructive",
      });
      setWorkoutHistory([]);
    } finally {
      setIsLoadingWorkoutHistory(false);
    }
  };

  const handleDeleteRoutine = async () => {
    if (!deleteRoutineId || !user) return;

    setIsDeletingRoutine(true);
    try {
      await deleteRoutineDb(deleteRoutineId, user.id);

      setRoutines(routines.filter((r) => r.id !== deleteRoutineId));
      setIsDeleteConfirmOpen(false);
      setDeleteRoutineId(null);

      toast({
        title: t("profile_toast_routine_removed"),
        description: t("profile_toast_routine_removed_desc"),
      });
    } catch (err: any) {
      const errorMsg = err?.message || t("retry");
      console.error("Error deleting routine:", errorMsg);
      toast({
        title: t("profile_toast_routine_delete_error"),
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsDeletingRoutine(false);
    }
  };

  const handleSelectRoutineType = async (type: 1 | 2 | 3) => {
    setSelectedRoutineType(type);

    // If Exercicios is selected, load workouts + catalog
    if (type === 1) {
      setWorkoutsLoading(true);
      try {
        const [workoutsData, catalogData] = await Promise.all([
          getWorkoutsDb(),
          fetchExerciseCatalog().catch(() => [] as CatalogExercise[]),
        ]);
        setWorkouts(workoutsData);
        setCatalogExercises(catalogData);
      } catch (err: any) {
        console.error("Error loading workouts:", err);
        toast({
          title: t("profile_toast_exercises_load_error"),
          description: t("retry"),
          variant: "destructive",
        });
        setSelectedRoutineType(null);
      } finally {
        setWorkoutsLoading(false);
      }
    } else if (type === 2) {
      // If Dietas is selected, load diets + meal catalog
      setDietsLoading(true);
      try {
        const [dietsData, mealCatalogData] = await Promise.all([
          getDietsDb(),
          fetchMealCatalog().catch(() => [] as CatalogMeal[]),
        ]);
        setDiets(dietsData);
        setCatalogMeals(mealCatalogData);
      } catch (err: any) {
        console.error("Error loading diets:", err);
        toast({
          title: t("profile_toast_diets_load_error"),
          description: t("retry"),
          variant: "destructive",
        });
        setSelectedRoutineType(null);
      } finally {
        setDietsLoading(false);
      }
    } else if (type === 3) {
      // If Habitos is selected, load habits
      setHabitsLoading(true);
      try {
        const habitsData = await getHabitsDb();
        setHabits(habitsData);
      } catch (err: any) {
        console.error("Error loading habits:", err);
        toast({
          title: t("profile_toast_habits_load_error"),
          description: t("retry"),
          variant: "destructive",
        });
        setSelectedRoutineType(null);
      } finally {
        setHabitsLoading(false);
      }
    }
  };

  const handleToggleMuscleGroup = (muscleGroup: string) => {
    const newSelected = new Set(selectedMuscleGroups);
    if (newSelected.has(muscleGroup)) {
      newSelected.delete(muscleGroup);
    } else {
      newSelected.add(muscleGroup);
    }
    setSelectedMuscleGroups(newSelected);
  };

  const handleCreateRoutine = async () => {
    if (!user || selectedRoutineType === null) return;

    setIsCreatingRoutine(true);
    try {
      const newRoutine = await createRoutineDb(
        user.id,
        selectedRoutineType,
      );
      if (newRoutine) {
        setRoutines([newRoutine, ...routines]);
        toast({
          title: t("profile_toast_routine_created"),
          description: `"${getRoutineTypeName(selectedRoutineType)}"`,
        });
        setIsCreateRoutineOpen(false);
        setSelectedRoutineType(null);
        setWorkouts([]);
      }
    } catch (err: any) {
      console.error("Error creating routine:", err);
      toast({
        title: t("profile_toast_routine_create_error"),
        description: err.message || t("retry"),
        variant: "destructive",
      });
    } finally {
      setIsCreatingRoutine(false);
    }
  };

  const handleSaveWorkouts = async () => {
    if (!user || selectedWorkoutIds.size === 0) return;

    setIsSavingWorkouts(true);
    try {
      const workoutIdsArray = Array.from(selectedWorkoutIds);
      await createUserWorkoutsDb(user.id, workoutIdsArray);

      toast({
        title: t("profile_toast_exercises_saved"),
      });

      setIsCreateRoutineOpen(false);
      setSelectedRoutineType(null);
      setWorkouts([]);
      setSelectedWorkoutIds(new Set());

      // Reload routines
      if (user) {
        setRoutines(await getUserRoutinesDb(user.id));
      }
    } catch (err: any) {
      console.error("Error saving workouts:", err);
      toast({
        title: t("profile_toast_exercises_save_error"),
        description: err.message || t("retry"),
        variant: "destructive",
      });
    } finally {
      setIsSavingWorkouts(false);
    }
  };

  const handleSaveDiets = async () => {
    if (!user || selectedDietIds.size === 0) return;

    setIsSavingDiets(true);
    try {
      const dietIdsArray = Array.from(selectedDietIds);
      await createUserDietsDb(user.id, dietIdsArray);

      toast({
        title: t("profile_toast_diets_saved"),
      });

      setIsCreateRoutineOpen(false);
      setSelectedRoutineType(null);
      setDiets([]);
      setSelectedDietIds(new Set());

      // Reload routines
      if (user) {
        setRoutines(await getUserRoutinesDb(user.id));
      }
    } catch (err: any) {
      console.error("Error saving diets:", err);
      toast({
        title: t("profile_toast_diets_save_error"),
        description: err.message || t("retry"),
        variant: "destructive",
      });
    } finally {
      setIsSavingDiets(false);
    }
  };

  const handleSaveHabits = async () => {
    if (!user || selectedHabitIds.size === 0) return;

    setIsSavingHabits(true);
    try {
      const habitIdsArray = Array.from(selectedHabitIds);
      await createUserHabitsDb(user.id, habitIdsArray);

      toast({
        title: t("profile_toast_habits_saved"),
      });

      setIsCreateRoutineOpen(false);
      setSelectedRoutineType(null);
      setHabits([]);
      setSelectedHabitIds(new Set());

      // Reload routines
      if (user) {
        setRoutines(await getUserRoutinesDb(user.id));
      }
    } catch (err: any) {
      console.error("Error saving habits:", err);
      toast({
        title: t("profile_toast_habits_save_error"),
        description: err.message || t("retry"),
        variant: "destructive",
      });
    } finally {
      setIsSavingHabits(false);
    }
  };

  // Phone formatting function for Brazilian format (XX) XXXXX-XXXX

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (deleteConfirmText !== t("profile_close_account_confirm_word")) {
      toast({
        title: t("profile_toast_delete_confirm_error"),
        description: t("profile_toast_delete_confirm_error_desc"),
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    try {
      // Delete all user data across every table, then sign out
      await deleteAllUserDataDb(user.id);
      await resetSupabaseAuth();

      setIsDeleteAccountOpen(false);
      setDeleteConfirmText("");

      toast({
        title: t("profile_toast_account_deleted"),
        description: t("profile_toast_account_deleted_desc"),
      });

      // Redirect to login after a short delay
      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (err: any) {
      console.error("Error deleting account:", err);
      toast({
        title: t("profile_toast_account_delete_error"),
        description: err?.message || t("retry"),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCoverCropSrc(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = ""; // allow re-selecting the same file
  };

  const handleCoverCropConfirm = async (_dataUrl: string, blob: Blob) => {
    setCoverCropSrc(null);
    if (!user || !supabase) return;
    setIsSavingCover(true);
    try {
      const filePath = `covers/${user.id}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("posts")
        .upload(filePath, blob, { contentType: "image/jpeg" });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("posts").getPublicUrl(filePath);
      const updated = await updateUserProfileDb(user.id, { cover_photo: publicUrl });
      if (updated) setProfile(updated);
      toast({ title: t("profile_cover_updated") });
    } catch (err: any) {
      console.error("Error updating cover photo:", err);
      toast({ title: t("profile_cover_update_error"), description: err?.message || t("retry"), variant: "destructive" });
    } finally {
      setIsSavingCover(false);
    }
  };

  const handleRemoveCover = () => {
    if (!user) return;
    showConfirm(
      t("profile_remove_cover"),
      t("profile_remove_cover"),
      async () => {
        setIsSavingCover(true);
        try {
          const updated = await updateUserProfileDb(user.id, { cover_photo: null });
          if (updated) setProfile(updated);
          toast({ title: t("profile_cover_removed") });
        } catch (err: any) {
          console.error("Error removing cover photo:", err);
          toast({ title: t("profile_cover_remove_error"), description: err?.message || t("retry"), variant: "destructive" });
        } finally {
          setIsSavingCover(false);
        }
      }
    );
  };

  if (authLoading || loading) {
    return <ProfileSkeleton />;
  }

  if (!loading && profileError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-muted-foreground text-sm">{t("profile_load_error")}</p>
        <Button variant="outline" size="sm" onClick={() => { setProfileError(false); loadProfile(); }}>
          {t("profile_retry")}
        </Button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {t("profile_not_found")}
      </div>
    );
  }

  return (
    <div
      className="space-y-6"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {pullDistance > 0 && (
        <div
          className="flex items-center justify-center overflow-hidden transition-all"
          style={{ height: `${pullDistance}px` }}
        >
          <div
            className="h-6 w-6 rounded-full border-2 border-brand border-t-transparent transition-transform"
            style={{
              transform: `rotate(${(pullDistance / PULL_THRESHOLD) * 360}deg)`,
              opacity: pullDistance / PULL_THRESHOLD,
            }}
          />
        </div>
      )}

      {/* Profile Header with banner */}
      <div className="relative">
        {/* Banner — user cover photo when set, gradient otherwise */}
        {profile.cover_photo ? (
          <div
            aria-hidden
            className="absolute top-0 left-0 right-0 overflow-hidden pointer-events-none"
            style={{ height: "210px" }}
          >
            <ImageWithFallback
              src={profile.cover_photo}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div
            aria-hidden
            className="absolute top-0 left-0 right-0 pointer-events-none"
            style={{ height: "210px", background: "radial-gradient(120% 100% at 60% 0%,#d8567a,#7b3ff2 55%,#1a1438 90%)" }}
          />
        )}
        <div
          aria-hidden
          className="absolute top-0 left-0 right-0 pointer-events-none"
          style={{ height: "270px", background: "linear-gradient(to bottom,transparent 30%,#06070c 100%)" }}
        />

        {/* Cover photo controls — own profile only */}
        {!isViewingOtherProfile && (
          <div className="absolute z-30 flex gap-2" style={{ top: "8px", right: "12px" }}>
            {profile.cover_photo && (
              <button
                onClick={handleRemoveCover}
                disabled={isSavingCover}
                aria-label={t("profile_remove_cover")}
                className="flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
                style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,.3)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,.18)", color: "#fff" }}
              >
                <Trash2 className="h-[18px] w-[18px]" />
              </button>
            )}
            <button
              onClick={() => { hapticLight(); coverFileInputRef.current?.click(); }}
              disabled={isSavingCover}
              aria-label={t("profile_edit_cover")}
              className="flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
              style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,.3)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,.18)", color: "#fff" }}
            >
              {isSavingCover ? (
                <span className="h-[18px] w-[18px] rounded-full border-2 border-white/40 border-t-transparent animate-spin" />
              ) : (
                <ImagePlus className="h-[18px] w-[18px]" />
              )}
            </button>
          </div>
        )}

        {/* Hidden file input + cropper for the cover photo */}
        <input
          ref={coverFileInputRef}
          type="file"
          accept="image/*"
          onChange={handleCoverFileChange}
          className="hidden"
        />
        <ImageCropperDrawer
          imageSrc={coverCropSrc}
          aspectRatio={16 / 9}
          onConfirm={handleCoverCropConfirm}
          onCancel={() => setCoverCropSrc(null)}
        />

        {/* Back chip — only when viewing another user's profile */}
        {isViewingOtherProfile && (
          <button
            onClick={() => navigate(-1)}
            aria-label="Voltar"
            className="absolute z-30 flex items-center justify-center active:scale-95 transition-transform"
            style={{ top: "8px", left: "12px", width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,.3)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,.18)", color: "#fff" }}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}

        <div className="relative px-4" style={{ paddingTop: "80px" }}>
          {/* Avatar + actions row */}
          <div className="flex items-end justify-between mb-3.5">
            {/* Avatar with conic ring */}
            {(() => {
              const ring = (
                <div style={{ width: 88, height: 88, borderRadius: "50%", padding: "3px", background: "conic-gradient(from 200deg,#ff8a2a,#d8567a,#7b3ff2,#3a8dff,#ff8a2a)" }}>
                  <div className="w-full h-full rounded-full overflow-hidden" style={{ border: "3px solid #06070c" }}>
                    <UserAvatar photo={profile.photo} nickname={profile.nickname} className="!h-full !w-full" />
                  </div>
                </div>
              );
              return profileStories.length > 0 ? (
                <button
                  onClick={() => { setSelectedProfileStory(profileStories[0]); setIsStoryViewerOpen(true); }}
                  className="shrink-0 active:scale-95 transition-transform"
                  title={t("profile_view_flow")}
                >
                  {ring}
                </button>
              ) : (
                <div className="shrink-0">{ring}</div>
              );
            })()}

            {/* Actions */}
            {!isViewingOtherProfile ? (
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => setSettingsOpen(true)}
                  aria-label={t("settings_title")}
                  className="flex items-center justify-center active:scale-95 transition-transform"
                  style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }}
                >
                  <Settings className="h-[19px] w-[19px]" />
                </button>
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="active:scale-95 transition-transform"
                  style={{ height: 42, padding: "0 18px", borderRadius: "21px", display: "flex", alignItems: "center", fontSize: "13.5px", fontWeight: 640, color: "#0a0b12", background: "linear-gradient(rgba(255,255,255,.95),rgba(255,255,255,.82))" }}
                >
                  {t("profile_edit_btn")}
                </button>
              </div>
            ) : (
              <div className="flex gap-2 items-center">
                <FollowButton
                  targetUserId={profileUserId!}
                  onFollowChange={() => { getUserStatsDb(profileUserId!).then(setStats); }}
                />
                <button
                  onClick={() => navigate(`/comunidade?user=${profileUserId}`)}
                  aria-label={t("profile_message_btn")}
                  className="flex items-center justify-center active:scale-95 transition-transform"
                  style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }}
                >
                  <MessageSquare className="h-[18px] w-[18px]" />
                </button>
                <button
                  onClick={() => {
                    const text = t("profile_share_other").replace("{handle}", profile?.nickname ?? "");
                    const profileUrl = profileShareUrl(profileUserId);
                    setShareDrawerText(text);
                    setShareDrawerUrl(profileUrl);
                    setShareDrawerOpen(true);
                  }}
                  aria-label={t("profile_share")}
                  className="flex items-center justify-center active:scale-95 transition-transform"
                  style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }}
                >
                  <Share2 className="h-[18px] w-[18px]" />
                </button>
              </div>
            )}
          </div>

          {/* Controlled settings drawer (own profile) */}
          {!isViewingOtherProfile && (
            <SettingsDrawer
              profile={profile}
              userId={user!.id}
              userEmail={user?.email ?? ""}
              stats={stats}
              onProfileUpdated={(updated) => setProfile(updated)}
              onRequestDeleteAccount={() => setIsDeleteAccountOpen(true)}
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
              hideTrigger
            />
          )}

          {/* Name + verified + insignias */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <h1 className="text-white" style={{ fontSize: "21px", fontWeight: 740, letterSpacing: "-0.01em" }}>
              {profile.nickname}
            </h1>
            {profile.is_verified && <VerifiedBadge size="md" />}
            <UserInsignias userId={profileUserId || ""} showStreak />
          </div>

          {/* Botão Admin — visível apenas para o próprio usuário verificado */}
          {!isViewingOtherProfile && profile.is_verified && (
            <button
              onClick={() => navigate("/admin")}
              className="mt-2 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-brand/10 text-brand hover:bg-brand/20 transition-colors border border-brand/20"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Admin
            </button>
          )}

          {/* Handle */}
          {profile.handle && (
            <p className="mt-1" style={{ fontSize: "13px", color: "rgba(255,255,255,.5)" }}>@{profile.handle.replace(/^@/, "")}</p>
          )}

            {/* Bio and Commercial Profile */}
            <div className="space-y-3 mt-3">
              {profile.bio && (
                <p style={{ fontSize: "13.5px", lineHeight: 1.5, color: "rgba(255,255,255,.82)" }}>
                  {profile.bio}
                </p>
              )}

              {/* Stats cards */}
              <div className="flex gap-2">
                <div
                  className="flex-1 text-center"
                  style={{ borderRadius: "18px", padding: "12px 8px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}
                >
                  <div style={{ fontSize: "17px", fontWeight: 740, color: "#fff" }}>{stats.postsCount}</div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,.5)" }}>{t("profile_posts")}</div>
                </div>
                <button
                  onClick={() => {
                    if (isViewingOtherProfile && profile?.hide_follow_lists) {
                      toast({ title: t("profile_follows_private") });
                      return;
                    }
                    setShowFollowersModal(true);
                  }}
                  className="flex-1 text-center active:scale-95 transition-transform"
                  style={{ borderRadius: "18px", padding: "12px 8px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}
                >
                  <div className="flex items-center justify-center gap-1" style={{ fontSize: "17px", fontWeight: 740, color: "#fff" }}>
                    {isViewingOtherProfile && profile?.hide_follow_lists && <Lock className="h-3 w-3" style={{ color: "rgba(255,255,255,.5)" }} />}
                    {stats.followersCount}
                  </div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,.5)" }}>{t("profile_stat_followers")}</div>
                </button>
                <button
                  onClick={() => {
                    if (isViewingOtherProfile && profile?.hide_follow_lists) {
                      toast({ title: t("profile_follows_private") });
                      return;
                    }
                    setShowFollowingModal(true);
                  }}
                  className="flex-1 text-center active:scale-95 transition-transform"
                  style={{ borderRadius: "18px", padding: "12px 8px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}
                >
                  <div className="flex items-center justify-center gap-1" style={{ fontSize: "17px", fontWeight: 740, color: "#fff" }}>
                    {isViewingOtherProfile && profile?.hide_follow_lists && <Lock className="h-3 w-3" style={{ color: "rgba(255,255,255,.5)" }} />}
                    {stats.followingCount}
                  </div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,.5)" }}>{t("profile_stat_following")}</div>
                </button>
              </div>

              {/* Commercial Profile Info */}
              {commercialProfile && (
                <div className="flex flex-col gap-1 p-2 rounded-lg bg-muted/20 border border-brand/20">
                  <div className="flex items-center gap-2">
                    {commercialProfile.business_phone ? (
                      <button
                        onClick={() => Browser.open({ url: `https://wa.me/55${commercialProfile.business_phone!.replace(/\D/g, "")}` })}
                        className="text-sm font-medium text-brand hover:underline flex items-center gap-1"
                        title={t("profile_contact_btn")}
                      >
                        <span>💬</span>
                        {commercialProfile.business_name}
                      </button>
                    ) : (
                      <div className="text-sm font-medium text-brand">
                        🏪 {commercialProfile.business_name}
                      </div>
                    )}
                    {commercialProfile.business_segment && (
                      <div className="text-xs px-2 py-0.5 rounded bg-brand/20 text-brand font-medium">
                        {commercialProfile.business_segment === "academia" && t("seg_academia")}
                        {commercialProfile.business_segment === "personal_trainer" && t("seg_personal_trainer")}
                        {commercialProfile.business_segment === "nutricionista" && t("seg_nutricionista")}
                        {commercialProfile.business_segment === "psicologo" && t("seg_psicologo")}
                        {commercialProfile.business_segment === "fisioterapeuta" && t("seg_fisioterapeuta")}
                        {commercialProfile.business_segment === "coach" && t("seg_coach")}
                        {commercialProfile.business_segment === "outros" && t("seg_outros")}
                      </div>
                    )}
                    {servicePlans.length > 0 && (
                      <button
                        onClick={() => setIsPlansModalOpen(true)}
                        className="ml-auto flex items-center gap-1 text-xs text-brand hover:text-brand/80 transition-colors"
                        title="Ver planos e preços"
                      >
                        <ListChecks className="h-3.5 w-3.5" />
                        <span>{servicePlans.length} {servicePlans.length === 1 ? t("profile_plan_singular") : t("profile_plan_plural")}</span>
                      </button>
                    )}
                  </div>
                  {commercialProfile.business_website && (
                    <button
                      onClick={() => Browser.open({ url: commercialProfile.business_website! })}
                      className="text-xs text-brand hover:underline flex items-center gap-1"
                    >
                      <span>🔗</span>
                      {commercialProfile.business_website.replace(/^https?:\/\//, "")}
                    </button>
                  )}
                </div>
              )}
            </div>

          {/* Plans Modal */}
          <Dialog open={isPlansModalOpen} onOpenChange={setIsPlansModalOpen}>
            <DialogContent className="max-w-sm rounded-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-brand" />
                  {t("profile_plans_title")}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-1">
                {commercialProfile && (
                  <p className="text-sm text-muted-foreground">{commercialProfile.business_name}</p>
                )}
                {servicePlans.map((plan, idx) => (
                  <div key={idx} className="rounded-xl px-4 py-3 space-y-1" style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)" }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{plan.name}</span>
                      {plan.price && (
                        <span className="text-sm font-bold text-brand">R$ {plan.price}</span>
                      )}
                    </div>
                    {plan.description && (
                      <p className="text-xs text-muted-foreground leading-snug">{plan.description}</p>
                    )}
                  </div>
                ))}
                {servicePlans.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">{t("profile_no_plans")}</p>
                )}
              </div>
            </DialogContent>
          </Dialog>

        </div>
      </div>

      {/* Public Goals Strip */}
      {userGoals.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 px-1">
            <Target className="h-3.5 w-3.5 text-brand" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("profile_goals_section")}
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {userGoals.map((goal) => (
              <button
                key={goal.id}
                onClick={() => handleOpenGoalDrawer(goal)}
                className="flex-shrink-0 w-44 rounded-xl p-3 space-y-2 text-left active:scale-95 transition-transform"
                style={{
                  background: "linear-gradient(rgba(255,255,255,.09),rgba(255,255,255,.03))",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  border: "1px solid rgba(255,255,255,.10)",
                }}
              >
                <p className="text-xs font-medium leading-snug line-clamp-2">
                  {goal.description}
                </p>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{t("goals_progress")}</span>
                    <span className="text-xs font-semibold text-brand">{goal.perc}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand transition-all"
                      style={{ width: `${Math.min(goal.perc, 100)}%` }}
                    />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Goal Detail Drawer */}
      <Drawer open={goalDrawerOpen} onOpenChange={setGoalDrawerOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-brand shrink-0" />
              <DrawerTitle className="text-base leading-snug text-left">
                {selectedGoalForDrawer?.description}
              </DrawerTitle>
            </div>
            {selectedGoalForDrawer && (
              <DrawerDescription className="text-left">
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${Math.min(selectedGoalForDrawer.perc, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-brand shrink-0">
                    {selectedGoalForDrawer.perc}%
                  </span>
                </div>
              </DrawerDescription>
            )}
          </DrawerHeader>

          <div className="px-4 pb-6 overflow-y-auto space-y-4" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
            {isLoadingGoalDrawer ? (
              <div className="space-y-3 pt-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />
                ))}
              </div>
            ) : goalDrawerRoutines.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <span className="text-2xl">📋</span>
                <p className="text-sm text-muted-foreground">{t("goals_no_linked_routines")}</p>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                {goalDrawerRoutines.map(({ routine, items }) => (
                  <div key={routine.id} className="rounded-xl p-4 space-y-3" style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.10)" }}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">
                          {routine.name || (routine.type === 1 ? t("profile_routine_workout") : routine.type === 2 ? t("profile_routine_diet") : t("profile_routine_habit"))}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {routine.type === 1 ? t("profile_routine_workout") : routine.type === 2 ? t("profile_routine_diet") : t("profile_routine_habit")} · {items.length} {items.length === 1 ? t("profile_item_singular") : t("profile_items_plural")}
                        </p>
                      </div>
                      {isViewingOtherProfile && routine.type !== 3 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full shrink-0 text-xs h-8 gap-1.5"
                          disabled={copyingRoutineId === routine.id}
                          onClick={() => handleCopyRoutine(routine)}
                        >
                          {copyingRoutineId === routine.id ? t("profile_copying_routine") : t("profile_copy_routine")}
                        </Button>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {items.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="h-1.5 w-1.5 rounded-full bg-brand/60 shrink-0" />
                          <span>{item.workoutName || item.dietName || item.habitName || "Item"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Posts, Shots, Routines and Store Tabs */}
      <Tabs defaultValue="posts" className="w-full px-4">
        <TabsList className="w-full justify-start gap-7 !h-auto !bg-transparent !rounded-none !p-0 border-b border-white/10">
          <TabsTrigger
            value="posts"
            className="!rounded-none !bg-transparent !shadow-none !px-0 pb-3 -mb-px border-b-2 border-transparent !text-white/45 data-[state=active]:!border-white data-[state=active]:!text-white text-[14px] font-[640]"
          >
            {t("profile_posts")} ({stats.postsCount})
          </TabsTrigger>
          <TabsTrigger
            value="shots"
            className="!rounded-none !bg-transparent !shadow-none !px-0 pb-3 -mb-px border-b-2 border-transparent !text-white/45 data-[state=active]:!border-white data-[state=active]:!text-white text-[14px] font-[640]"
          >
            {t("nav_clips")} ({shots.length})
          </TabsTrigger>
          {profileOffers.length > 0 && (
            <TabsTrigger
              value="vitrine"
              className="!rounded-none !bg-transparent !shadow-none !px-0 pb-3 -mb-px border-b-2 border-transparent !text-white/45 data-[state=active]:!border-white data-[state=active]:!text-white text-[14px] font-[640]"
            >
              {commercialProfile ? `${t("settings_section_business")} (${profileOffers.length})` : `${t("nav_store")} (${profileOffers.length})`}
            </TabsTrigger>
          )}
        </TabsList>

        {/* Posts Tab */}
        <TabsContent value="posts" className="space-y-4">
          {isViewingOtherProfile && profile?.hide_posts_from_non_followers && !viewerFollowsProfile ? (
            <div className="rounded-xl p-8 text-center flex flex-col items-center gap-2" style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}>
              <Lock className="h-6 w-6" style={{ color: "rgba(255,255,255,.5)" }} />
              <p className="text-sm font-medium text-white">{t("profile_posts_private")}</p>
              <p className="text-xs text-white/50">{t("profile_posts_private_desc")}</p>
            </div>
          ) : posts.length > 0 ? (
            <div className="grid gap-[5px] grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {posts.map((post) => (
                <button
                  key={post.id}
                  onClick={() => handleViewPost(post)}
                  className="group relative aspect-square overflow-hidden rounded-[14px] bg-muted transition-all cursor-pointer"
                >
                  <img
                    src={post.photo}
                    alt={post.description}
                    className="h-full w-full object-cover group-hover:scale-110 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  {/* Multi-photo indicator */}
                  {post.photos && post.photos.length > 1 && (
                    <div className="absolute top-2 right-2 bg-white/90 rounded-md px-1.5 py-0.5 flex items-center gap-0.5">
                      <span className="text-xs font-semibold text-black">📷</span>
                      <span className="text-xs font-semibold text-black">{post.photos.length}</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl p-6 text-center" style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}>
              <p className="text-sm text-white/50">
                {t("profile_no_posts")}
              </p>
            </div>
          )}
        </TabsContent>

        {/* Shots Tab */}
        <TabsContent value="shots" className="space-y-4">
          {shots.length > 0 ? (
            <div className="grid gap-[5px] grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {shots.map((shot) => (
                <div
                  key={shot.id}
                  className="group relative aspect-square overflow-hidden rounded-[14px] bg-black transition-all"
                >
                  <button
                    onClick={() => navigate(`/shots`, { state: { shotId: shot.id } })}
                    className="w-full h-full cursor-pointer"
                  >
                    <video
                      src={shot.video_url}
                      playsInline
                      muted
                      className="h-full w-full object-cover group-hover:scale-110 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  </button>

                  {!isViewingOtherProfile && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedShot(shot);
                        setIsShotEditorOpen(true);
                      }}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg bg-black/50 hover:bg-black/70"
                    >
                      <Settings className="h-4 w-4 text-white" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl p-6 text-center" style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}>
              <p className="text-sm text-white/50">
                {t("profile_no_shots")}
              </p>
            </div>
          )}
        </TabsContent>

        {/* Routines Tab - removed */}
        {false && <TabsContent value="routines_disabled" className="space-y-4 fade-in">
          <Drawer
            open={isCreateRoutineOpen}
            onOpenChange={(open) => {
              setIsCreateRoutineOpen(open);
              if (!open) {
                setSelectedRoutineType(null);
                setWorkouts([]);
                setSelectedWorkoutIds(new Set());
                setSearchQueryWorkouts("");
                setSelectedMuscleGroups(new Set());
                setDiets([]);
                setSelectedDietIds(new Set());
                setHabits([]);
                setSelectedHabitIds(new Set());
              }
            }}
          >
            <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter" onOpenAutoFocus={(e) => e.preventDefault()}>
              <DrawerHeader className="shrink-0">
                <DrawerTitle>Nova Rotina</DrawerTitle>
              </DrawerHeader>
              <div className="flex-1 overflow-y-auto px-4 pb-24">
                {selectedRoutineType === null ? (
                  <>
                    <DialogHeader>
                      <DialogTitle>Nova Rotina</DialogTitle>
                      <DialogDescription>
                        Escolha o tipo de rotina que deseja criar
                      </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 gap-3">
                      {[1, 2, 3].map((typeCode) => (
                        <Button
                          key={typeCode}
                          variant="outline"
                          className="h-auto p-4 justify-start text-base rounded-lg"
                          onClick={() =>
                            handleSelectRoutineType(typeCode as 1 | 2 | 3)
                          }
                          disabled={isCreatingRoutine}
                        >
                          {getRoutineTypeName(typeCode)}
                        </Button>
                      ))}
                    </div>
                  </>
                ) : selectedRoutineType === 1 ? (
                  <>
                    <DialogHeader>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-fit"
                        onClick={() => setSelectedRoutineType(null)}
                      >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Voltar
                      </Button>
                      <DialogTitle>Selecione um ou mais Exercícios</DialogTitle>
                    </DialogHeader>

                    <Input
                      placeholder="Buscar exercício por nome..."
                      value={searchQueryWorkouts}
                      onChange={(e) => setSearchQueryWorkouts(e.target.value)}
                      className="mb-4"
                    />

                    {/* Muscle Group Filter */}
                    {(() => {
                      // Merge local workouts + catalog into a unified list
                      const localWorkoutNames = new Set(workouts.map((w) => w.name.toLowerCase()));
                      const catalogFiltered = catalogExercises.filter(
                        (c) => !localWorkoutNames.has(c.name.toLowerCase()),
                      );

                      const unified = [
                        ...workouts.filter((w) => w.photo).map((w) => ({
                          key: `local-${w.id}`,
                          id: w.id,
                          name: w.name,
                          description: w.description,
                          photo: w.photo,
                          muscleGroup: w.muscle_group || null,
                          isLocal: true,
                        })),
                        ...catalogFiltered.map((c) => ({
                          key: `catalog-${c.id}`,
                          id: `catalog-${c.id}`,
                          name: c.name,
                          description: c.description,
                          photo: c.image,
                          muscleGroup: c.category || null,
                          isLocal: false,
                          catalogId: c.id,
                          catalogImage: c.image,
                        })),
                      ];

                      const allMuscleGroups = Array.from(
                        new Set(unified.map((u) => u.muscleGroup).filter(Boolean)),
                      ) as string[];

                      const query = searchQueryWorkouts.toLowerCase();
                      const filtered = unified.filter(
                        (u) =>
                          (u.name.toLowerCase().includes(query) ||
                            (u.description && u.description.toLowerCase().includes(query))) &&
                          (selectedMuscleGroups.size === 0 ||
                            selectedMuscleGroups.has(u.muscleGroup || "")),
                      );

                      return (
                        <>
                          {allMuscleGroups.length > 0 && (
                            <div className="space-y-2 mb-4">
                              <div className="flex items-center gap-2">
                                <Filter className="h-4 w-4 text-muted-foreground" />
                                <p className="text-xs font-medium text-muted-foreground">
                                  Filtrar por grupo muscular:
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {allMuscleGroups.map((muscleGroup) => (
                                  <button
                                    key={muscleGroup}
                                    onClick={() => handleToggleMuscleGroup(muscleGroup)}
                                    className={`px-3 py-1.5 text-xs rounded-full border transition-all ${selectedMuscleGroups.has(muscleGroup)
                                      ? "border-brand bg-brand/20 text-brand"
                                      : "border-border/60 text-muted-foreground hover:border-border/80"
                                      }`}
                                  >
                                    {muscleGroup}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {workoutsLoading ? (
                            <div className="space-y-3">
                              {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
                              ))}
                            </div>
                          ) : filtered.length > 0 ? (
                            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                              {filtered.map((exercise) => {
                                const isSelected = selectedWorkoutIds.has(exercise.id);
                                return (
                                  <button
                                    key={exercise.key}
                                    onClick={async () => {
                                      if (!exercise.isLocal && !selectedWorkoutIds.has(exercise.id)) {
                                        // Create the catalog exercise in the local DB first
                                        try {
                                          const created = await createCustomWorkoutDb(
                                            exercise.name,
                                            exercise.description,
                                            exercise.muscleGroup || "",
                                            exercise.photo,
                                          );
                                          // Update unified list to use the new local ID
                                          exercise.id = created.id;
                                          exercise.isLocal = true;
                                          const newSelected = new Set(selectedWorkoutIds);
                                          newSelected.add(created.id);
                                          setSelectedWorkoutIds(newSelected);
                                        } catch (err: any) {
                                          console.error("Error creating catalog exercise:", err);
                                          toast({
                                            title: "Erro ao adicionar exercício",
                                            description: err?.message || "Tente novamente.",
                                            variant: "destructive",
                                          });
                                        }
                                      } else {
                                        const newSelected = new Set(selectedWorkoutIds);
                                        if (isSelected) {
                                          newSelected.delete(exercise.id);
                                        } else {
                                          newSelected.add(exercise.id);
                                        }
                                        setSelectedWorkoutIds(newSelected);
                                      }
                                    }}
                                    className={`w-full p-3 border-2 rounded-lg transition-all text-left group ${isSelected
                                      ? "border-brand bg-brand/5"
                                      : "border-border/60 hover:border-border/80 hover:bg-muted/50"
                                      }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <ExerciseImage
                                        photo={exercise.photo}
                                        name={exercise.name}
                                        muscleGroup={exercise.muscleGroup}
                                      />
                                      <div className="flex-1 min-w-0">
                                        <p
                                          className={`font-medium text-sm transition-colors ${isSelected
                                            ? "text-brand"
                                            : "group-hover:text-brand"
                                            }`}
                                        >
                                          {exercise.name}
                                        </p>
                                        {exercise.description && (
                                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                            {exercise.description}
                                          </p>
                                        )}
                                        {exercise.muscleGroup && (
                                          <span className="inline-block text-[10px] font-medium text-brand bg-brand/10 px-2 py-0.5 rounded-full mt-1">
                                            {exercise.muscleGroup}
                                          </span>
                                        )}
                                      </div>
                                      <div className="shrink-0">
                                        {isSelected ? (
                                          <Check className="h-5 w-5 text-brand" />
                                        ) : (
                                          <div className="h-5 w-5 rounded border border-border/60" />
                                        )}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-center py-6 text-sm text-muted-foreground">
                              Nenhum exercício encontrado.
                            </div>
                          )}
                        </>
                      );
                    })()}

                    {/* Floating Save Button */}
                    {selectedWorkoutIds.size > 0 && (
                      <div className="sticky bottom-0 left-0 right-0 pt-4 border-t border-border/60 bg-background" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
                        <Button
                          onClick={handleSaveWorkouts}
                          disabled={isSavingWorkouts}
                          className="w-full rounded-full"
                        >
                          {isSavingWorkouts
                            ? "Salvando..."
                            : `Salvar ${selectedWorkoutIds.size} Exercício${selectedWorkoutIds.size > 1 ? "s" : ""}`}
                        </Button>
                      </div>
                    )}
                  </>
                ) : selectedRoutineType === 2 ? (
                  <>
                    <DialogHeader>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-fit"
                        onClick={() => setSelectedRoutineType(null)}
                      >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Voltar
                      </Button>
                      <DialogTitle>Selecione uma ou mais Dietas</DialogTitle>
                    </DialogHeader>

                    {dietsLoading ? (
                      <div className="space-y-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
                        ))}
                      </div>
                    ) : (() => {
                      const localNames = new Set(diets.map((d) => d.name.toLowerCase()));
                      const catalogFiltered = catalogMeals.filter((c) => !localNames.has(c.name.toLowerCase()));
                      const allDiets = [
                        ...diets.filter((d) => d.photo).map((d) => ({
                          key: `local-${d.id}`, id: d.id, name: d.name, description: d.description,
                          photo: d.photo, category: null as string | null, calories: d.calories, isLocal: true,
                        })),
                        ...catalogFiltered.map((c) => ({
                          key: `catalog-${c.id}`, id: `catalog-${c.id}`, name: c.name, description: c.description,
                          photo: c.image, category: c.category || null, calories: 0, isLocal: false, catalogId: c.id,
                        })),
                      ];
                      const filtered = searchQueryDiets
                        ? allDiets.filter((d) => d.name.toLowerCase().includes(searchQueryDiets.toLowerCase()))
                        : allDiets;

                      return filtered.length > 0 ? (
                        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                          <div className="relative shrink-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="text"
                              placeholder="Buscar dieta..."
                              value={searchQueryDiets}
                              onChange={(e) => setSearchQueryDiets(e.target.value)}
                              className="pl-10 h-9"
                            />
                          </div>
                          {filtered.map((diet) => {
                            const isSelected = selectedDietIds.has(diet.id);
                            return (
                              <button
                                key={diet.key}
                                onClick={async () => {
                                  if (!diet.isLocal && !selectedDietIds.has(diet.id)) {
                                    try {
                                      const created = await createCustomDietDb(
                                        diet.name, diet.description, diet.photo, diet.calories,
                                      );
                                      diet.id = created.id;
                                      diet.isLocal = true;
                                      const newSelected = new Set(selectedDietIds);
                                      newSelected.add(created.id);
                                      setSelectedDietIds(newSelected);
                                    } catch (err: any) {
                                      toast({ title: "Erro ao adicionar dieta", description: err?.message || "Tente novamente.", variant: "destructive" });
                                    }
                                  } else {
                                    const newSelected = new Set(selectedDietIds);
                                    if (isSelected) newSelected.delete(diet.id);
                                    else newSelected.add(diet.id);
                                    setSelectedDietIds(newSelected);
                                  }
                                }}
                                className={`w-full p-4 border-2 rounded-lg transition-all text-left group ${isSelected ? "border-brand bg-brand/5" : "border-border/60 hover:border-border/80 hover:bg-muted/50"
                                  }`}
                              >
                                <div className="flex items-start gap-3">
                                  <DietImage photo={diet.photo} name={diet.name} category={diet.category} className="h-14 w-14" />
                                  <div className="flex-1 min-w-0">
                                    <p className={`font-medium transition-colors ${isSelected ? "text-brand" : "group-hover:text-brand"}`}>
                                      {diet.name}
                                    </p>
                                    {diet.category && (
                                      <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground mt-1">
                                        {diet.category}
                                      </span>
                                    )}
                                    {diet.calories > 0 && (
                                      <p className="text-xs font-medium text-brand/80 mt-1">{diet.calories} cal</p>
                                    )}
                                  </div>
                                  {isSelected && (
                                    <div className="shrink-0 mt-1">
                                      <Check className="h-5 w-5 text-brand" />
                                    </div>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-sm text-muted-foreground">
                          Nenhuma dieta disponível.
                        </div>
                      );
                    })()}

                    {/* Floating Save Button */}
                    {selectedDietIds.size > 0 && (
                      <div className="sticky bottom-0 left-0 right-0 pt-4 border-t border-border/60 bg-background" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
                        <Button
                          onClick={handleSaveDiets}
                          disabled={isSavingDiets}
                          className="w-full rounded-full"
                        >
                          {isSavingDiets
                            ? "Salvando..."
                            : `Salvar ${selectedDietIds.size} Dieta${selectedDietIds.size > 1 ? "s" : ""}`}
                        </Button>
                      </div>
                    )}
                  </>
                ) : selectedRoutineType === 3 ? (
                  <>
                    <DialogHeader>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-fit"
                        onClick={() => setSelectedRoutineType(null)}
                      >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Voltar
                      </Button>
                      <DialogTitle>Selecione um ou mais Hábitos</DialogTitle>
                    </DialogHeader>

                    {habitsLoading ? (
                      <div className="space-y-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
                        ))}
                      </div>
                    ) : habits.length > 0 ? (
                      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                        {habits.map((habit) => {
                          const isSelected = selectedHabitIds.has(habit.id);
                          return (
                            <button
                              key={habit.id}
                              onClick={() => {
                                const newSelected = new Set(selectedHabitIds);
                                if (isSelected) {
                                  newSelected.delete(habit.id);
                                } else {
                                  newSelected.add(habit.id);
                                }
                                setSelectedHabitIds(newSelected);
                              }}
                              className={`w-full p-4 border-2 rounded-lg transition-all text-left space-y-2 group ${isSelected
                                ? "border-brand bg-brand/5"
                                : "border-border/60 hover:border-border/80 hover:bg-muted/50"
                                }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="h-16 w-16 rounded bg-muted flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p
                                    className={`font-medium transition-colors ${isSelected
                                      ? "text-brand"
                                      : "group-hover:text-brand"
                                      }`}
                                  >
                                    {habit.name}
                                  </p>
                                  {habit.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                      {habit.description}
                                    </p>
                                  )}
                                </div>
                                {isSelected && (
                                  <div className="shrink-0 mt-1">
                                    <Check className="h-5 w-5 text-brand" />
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-sm text-muted-foreground">
                        Nenhum hábito disponível.
                      </div>
                    )}

                    {/* Floating Save Button */}
                    {selectedHabitIds.size > 0 && (
                      <div className="sticky bottom-0 left-0 right-0 pt-4 border-t border-border/60 bg-background" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
                        <Button
                          onClick={handleSaveHabits}
                          disabled={isSavingHabits}
                          className="w-full rounded-full"
                        >
                          {isSavingHabits
                            ? "Salvando..."
                            : `Salvar ${selectedHabitIds.size} Hábito${selectedHabitIds.size > 1 ? "s" : ""}`}
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <DialogHeader>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-fit"
                        onClick={() => setSelectedRoutineType(null)}
                      >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Voltar
                      </Button>
                      <DialogTitle>
                        {getRoutineTypeName(selectedRoutineType)}
                      </DialogTitle>
                    </DialogHeader>

                    <div className="text-center py-6">
                      <Button
                        onClick={() => handleCreateRoutine()}
                        disabled={isCreatingRoutine}
                        className="rounded-full"
                      >
                        {isCreatingRoutine ? "Criando..." : "Criar Rotina"}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </DrawerContent>
          </Drawer>

          {routines.length > 0 ? (
            <div className="space-y-4">
              {[1, 2, 3].map((typeCode) => {
                const routinesOfType = routines.filter(
                  (r) => r.type === typeCode,
                );
                if (routinesOfType.length === 0) return null;

                const isExpanded = expandedRoutineType === typeCode;

                // Get items based on routine type
                let itemsOfType: any[] = [];

                return (
                  <div
                    key={typeCode}
                    className="border border-border/60 rounded-lg overflow-hidden"
                  >
                    <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                      <button
                        onClick={() =>
                          setExpandedRoutineType(isExpanded ? null : typeCode)
                        }
                        className="flex-1 flex items-center gap-3"
                      >
                        <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-brand/10">
                          <span className="text-xs font-semibold text-brand">
                            {typeCode}
                          </span>
                        </div>
                        <div className="text-left">
                          <p className="font-semibold">
                            {getRoutineTypeName(typeCode)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {itemsOfType.length}{" "}
                            {typeCode === 1
                              ? "exercício"
                              : typeCode === 2
                                ? "alimento"
                                : "hábito"}
                            {itemsOfType.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </button>

                      {/* Goal Indicator */}
                      <Drawer
                        open={goalIndicatorRoutineId === routinesOfType[0]?.id}
                        onOpenChange={(open) => {
                          if (!open) {
                            setGoalIndicatorRoutineId(null);
                            setLinkedGoal(null);
                          }
                        }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openGoalIndicatorModal(routinesOfType[0]);
                          }}
                          className={`shrink-0 p-2 rounded-lg transition-all ${routinesOfType[0]?.goal_id
                            ? "bg-brand/10 text-brand hover:bg-brand/20"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                          title={
                            routinesOfType[0]?.goal_id
                              ? t("profile_linked_goal_label")
                              : t("goals_link_goal")
                          }
                        >
                          <Tag className="h-5 w-5" />
                        </button>

                        <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter" onOpenAutoFocus={(e) => e.preventDefault()}>
                          <DrawerHeader className="shrink-0">
                            <DrawerTitle>
                              {linkedGoal ? t("profile_linked_goal_label") : t("goals_link_goal")}
                            </DrawerTitle>
                          </DrawerHeader>

                          <div className="flex-1 overflow-y-auto px-4 pb-6">
                            {linkedGoal ? (
                              <div className="space-y-4">
                                <div className="p-4 border border-border/60 rounded-lg bg-muted/30">
                                  <p className="text-sm font-medium mb-2">
                                    {linkedGoal.description}
                                  </p>
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                      <span className="text-muted-foreground">
                                        {t("goals_duration")}:
                                      </span>
                                      <p className="font-medium">
                                        {linkedGoal.duration} {t("goals_streak_days")}
                                      </p>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">
                                        {t("goals_quantity")}:
                                      </span>
                                      <p className="font-medium">
                                        {linkedGoal.quantity}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                <Button
                                  onClick={handleUnlinkGoal}
                                  disabled={isUpdatingGoal}
                                  variant="outline"
                                  className="w-full rounded-full"
                                >
                                  {isUpdatingGoal
                                    ? t("profile_unlinking_goal")
                                    : t("profile_unlink_goal_btn")}
                                </Button>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {userGoals.length > 0 ? (
                                  userGoals.map((goal) => (
                                    <button
                                      key={goal.id}
                                      onClick={() => handleLinkGoal(goal.goal_id)}
                                      disabled={isUpdatingGoal}
                                      className="w-full p-3 border border-border/60 rounded-lg hover:border-brand/60 hover:bg-brand/5 transition-all text-left"
                                    >
                                      <p className="font-medium text-sm">
                                        {goal.description}
                                      </p>
                                      <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                                        <span>{t("goals_duration")}: {goal.duration} {t("goals_streak_days")}</span>
                                        <span>{t("goals_quantity")}: {goal.quantity}</span>
                                      </div>
                                    </button>
                                  ))
                                ) : (
                                  <p className="text-sm text-muted-foreground text-center py-6">
                                    {t("profile_no_linked_goals")}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </DrawerContent>
                      </Drawer>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteRoutineId(routinesOfType[0]?.id || null);
                          setIsDeleteConfirmOpen(true);
                        }}
                        className="shrink-0 p-2 rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-all"
                        title="Deletar rotina"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>

                      <div
                        className={`transform transition-transform ${isExpanded ? "rotate-180" : ""
                          }`}
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 14l-7 7m0 0l-7-7m7 7V3"
                          />
                        </svg>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-border/60 p-4 space-y-3 bg-muted/20">
                        {itemsOfType.length > 0 ? (
                          <div className="space-y-3">
                            {itemsOfType.map((item) => (
                              <Card
                                key={item.id}
                                className="border-border/60 bg-background cursor-pointer hover:bg-muted/30 transition-colors"
                                onClick={() => {
                                  if (typeCode === 1) {
                                    handleOpenWorkoutHistory({
                                      id: item.workout_id,
                                      name: item.workoutName,
                                      description: item.workoutDescription || undefined,
                                      photo: item.workoutPhoto || undefined,
                                    } as any);
                                  }
                                }}
                              >
                                <CardContent className="p-4">
                                  <p className="font-medium text-sm">
                                    {typeCode === 1
                                      ? item.workoutName
                                      : typeCode === 2
                                        ? item.dietName
                                        : item.habitName}
                                  </p>
                                  {typeCode === 1 &&
                                    item.workoutDescription && (
                                      <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                                        {item.workoutDescription}
                                      </p>
                                    )}
                                  {typeCode === 2 &&
                                    item.dietDescription && (
                                      <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                                        {item.dietDescription}
                                      </p>
                                    )}
                                  {typeCode === 3 &&
                                    item.habitDescription && (
                                      <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                                        {item.habitDescription}
                                      </p>
                                    )}
                                  <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                                    {typeCode === 1 && (
                                      <>
                                        {item.series && (
                                          <span>Séries: {item.series}</span>
                                        )}
                                        {item.duration && (
                                          <span>
                                            Duração: {item.duration}min
                                          </span>
                                        )}
                                        {item.volume && (
                                          <span>
                                            Volume: {item.volume}kg
                                          </span>
                                        )}
                                      </>
                                    )}
                                    {typeCode === 2 && (
                                      <>
                                        {item.dietCalories && (
                                          <span>
                                            {item.dietCalories} cal
                                          </span>
                                        )}
                                        {item.calories && (
                                          <span>
                                            Total: {item.calories} cal
                                          </span>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Nenhum{" "}
                            {typeCode === 1
                              ? "exercício"
                              : typeCode === 2
                                ? "alimento"
                                : "hábito"}{" "}
                            vinculado
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-muted/30 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Nenhuma rotina criada ainda.
                </p>
              </div>
              <div className="flex justify-center">
                <Button
                  onClick={() => setIsCreateRoutineOpen(true)}
                  className="rounded-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Rotina
                </Button>
              </div>
            </div>
          )}

          {/* Add routine button when routines exist */}
          {routines.length > 0 && (
            <div className="flex justify-center pt-4">
              <Button
                onClick={() => setIsCreateRoutineOpen(true)}
                className="rounded-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Rotina
              </Button>
            </div>
          )}
        </TabsContent>}

        {/* Serviços / Vitrine Tab */}
        {profileOffers.length > 0 && (
          <TabsContent value="vitrine" className="space-y-4">
            {/* Cabeçalho do negócio */}
            {commercialProfile && (
              <div className="rounded-2xl bg-card border border-border/50 overflow-hidden">
                {commercialProfile.business_banner_url && (
                  <div className="h-24 w-full overflow-hidden">
                    <img src={commercialProfile.business_banner_url} alt="Banner" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex items-center gap-3 p-4">
                  <ImageWithFallback
                    src={commercialProfile.business_logo_url ?? undefined}
                    alt={commercialProfile.business_name ?? ""}
                    className="h-12 w-12 rounded-2xl object-cover border-2 border-background shadow-md shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-black tracking-tight">{commercialProfile.business_name}</p>
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20">{t("profile_partner")}</span>
                    </div>
                    {commercialProfile.business_segment && (
                      <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">{commercialProfile.business_segment}</p>
                    )}
                    {commercialProfile.business_description && (
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-snug">{commercialProfile.business_description}</p>
                    )}
                  </div>
                  {commercialProfile.business_website && (
                    <button onClick={() => Browser.open({ url: commercialProfile.business_website! })} className="shrink-0 text-muted-foreground hover:text-brand transition-colors">
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Cards de serviço */}
            <div className="flex flex-col gap-3">
              {profileOffers.map((offer) => {
                const segment = offer.additional_info?.match(/^\[(.+?)\]/)?.[1] ?? null;
                const plansText = offer.additional_info
                  ? offer.additional_info.replace(/^\[.+?\]\n?/, "")
                  : null;
                const plansLines = plansText
                  ? plansText.split("\n").filter(Boolean).slice(0, 3)
                  : [];
                const isService = !!commercialProfile;

                return (
                  <div
                    key={offer.id}
                    className="bg-card group rounded-2xl border border-border/50 overflow-hidden hover:shadow-lg transition-all duration-300"
                  >
                    <div className="flex gap-0">
                      {/* Foto lateral */}
                      <div className="w-28 sm:w-36 shrink-0 overflow-hidden bg-muted/30">
                        <img
                          src={offer.image_url}
                          alt={offer.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                      {/* Conteúdo */}
                      <div className="flex-1 p-4 flex flex-col gap-2 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {segment && (
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20">{segment}</span>
                          )}
                        </div>

                        <h4 className="text-sm font-black leading-tight tracking-tight">{offer.title}</h4>

                        {isService && plansLines.length > 0 && (
                          <ul className="space-y-0.5">
                            {plansLines.map((line, idx) => (
                              <li key={idx} className="text-[11px] text-muted-foreground leading-snug line-clamp-1 flex items-start gap-1">
                                <span className="text-brand shrink-0 mt-0.5">•</span> {line}
                              </li>
                            ))}
                          </ul>
                        )}

                        {!isService && offer.coupon_code && (
                          <div className="flex items-center gap-1">
                            <Tag className="h-3 w-3 text-brand" />
                            <span className="text-[10px] font-black text-brand font-mono uppercase">{offer.coupon_code}</span>
                          </div>
                        )}

                        <div className="mt-auto pt-1 flex items-center justify-between gap-2 flex-wrap">
                          {offer.price && (
                            <span className="text-xs text-muted-foreground font-medium">
                              {isService ? t("profile_from_price") : ""}
                              <span className="text-base font-black text-foreground tracking-tighter">R$ {offer.price}</span>
                            </span>
                          )}
                          <button
                            onClick={() => {
                              incrementOfferClickDb(offer.id, offer.user_id);
                              if (offer.link_url) Browser.open({ url: offer.link_url });
                            }}
                            className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand/90 transition-colors shrink-0"
                          >
                            {isService
                              ? <><Phone className="h-3.5 w-3.5" /> {t("profile_contact_btn")}</>
                              : <><ArrowRight className="h-3.5 w-3.5" /> {t("profile_view_offer")}</>
                            }
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Post Viewer Drawer */}
      <Drawer
        open={isPostViewerOpen}
        onOpenChange={(open) => {
          if (!open && isEditingPost && editPostDescription !== (selectedPost?.description ?? "")) {
            showConfirm(
              t("profile_discard_title"),
              t("profile_discard_desc"),
              () => { setIsPostViewerOpen(false); setIsEditingPost(false); }
            );
          } else {
            setIsPostViewerOpen(open);
          }
        }}
      >
        <DrawerContent className="max-h-[95dvh] flex flex-col modal-enter" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Header compacto com autor inline */}
          <DrawerHeader className="shrink-0 pb-2">
            <div className="flex items-center justify-between">
              <DrawerTitle className="text-base">
                {isEditingPost ? t("profile_edit_post") : t("profile_post_label")}
              </DrawerTitle>
              {selectedPost && (
                <div className="flex items-center gap-2">
                  <UserAvatar
                    photo={selectedPost.userPhoto}
                    nickname={selectedPost.userNickname}
                    size="sm"
                    className="h-7 w-7 border border-border/60"
                  />
                  <span className="text-sm font-medium">{selectedPost.userNickname}</span>
                  <UserInsignias userId={selectedPost.user_id} />
                </div>
              )}
            </div>
          </DrawerHeader>

          {selectedPost && (
            <>
              {/* Layout: imagem + conteúdo lado a lado no md, empilhado no mobile */}
              <div className="flex-1 overflow-y-auto">
                <div className="md:flex md:gap-0 md:h-full">
                  {/* Imagem — no mobile ocupa altura limitada, no desktop fica à esquerda */}
                  <div className="md:w-[55%] md:shrink-0 md:sticky md:top-0">
                    {selectedPost.photos && selectedPost.photos.length > 0 ? (
                      <div className="md:h-full">
                        <PostCarousel
                          photos={selectedPost.photos}
                          alt={selectedPost.description}
                          editMode={isEditingPost}
                          onRemovePhoto={handleRemoveCarouselPhoto}
                          removingPhoto={removingPhoto}
                          objectFit="contain"
                        />
                      </div>
                    ) : (
                      <div className="w-full bg-black rounded-lg overflow-hidden border-b border-border/40 md:border-b-0">
                        <img
                          src={selectedPost.photo}
                          alt={selectedPost.description}
                          className="w-full h-auto block"
                        />
                      </div>
                    )}
                  </div>

                  {/* Conteúdo — scroll apenas nesta área no desktop */}
                  <div className="md:flex-1 md:overflow-y-auto px-4 pb-4 pt-3 space-y-3">
                    {/* Description (com timestamp à direita) */}
                    {isEditingPost ? (
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">{t("profile_description_label")}</label>
                        <Textarea
                          value={editPostDescription}
                          onChange={(e) => setEditPostDescription(e.target.value)}
                          className="resize-none"
                          rows={3}
                        />
                      </div>
                    ) : (
                      (() => {
                        const desc = selectedPost.description ?? "";
                        const DESC_MAX = 30;
                        const firstLine = desc.split("\n")[0] ?? "";
                        const truncatable = desc.includes("\n") || desc.length > DESC_MAX;
                        const truncated = firstLine.length > DESC_MAX
                          ? firstLine.slice(0, DESC_MAX).trimEnd()
                          : firstLine;
                        return (
                          <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap flex-1 min-w-0">
                            {!truncatable || postDescExpanded ? (
                              <>
                                {desc}
                                {truncatable && postDescExpanded && (
                                  <>
                                    {" "}
                                    <button
                                      type="button"
                                      onClick={() => setPostDescExpanded(false)}
                                      className="text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                      {t("feed_description_less")}
                                    </button>
                                  </>
                                )}
                              </>
                            ) : (
                              <>
                                {truncated}
                                {"... "}
                                <button
                                  type="button"
                                  onClick={() => setPostDescExpanded(true)}
                                  className="text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  {t("feed_description_more")}
                                </button>
                              </>
                            )}
                          </p>
                            <span className="text-xs text-muted-foreground font-mono shrink-0">
                              {formatTimeAgo(selectedPost.created_at)}
                            </span>
                          </div>
                        );
                      })()
                    )}

                    {/* Goal */}
                    {isEditingPost ? (
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">{t("profile_linked_goal_label")}</label>
                        {userGoals.length > 0 ? (
                          <div className="space-y-2">
                            <Select value={editPostGoalId} onValueChange={setEditPostGoalId}>
                              <SelectTrigger className="rounded-lg">
                                <SelectValue placeholder={t("profile_select_goal_ph")} />
                              </SelectTrigger>
                              <SelectContent className="z-[200]">
                                {userGoals.map((goal) => (
                                  <SelectItem key={goal.id} value={goal.id}>
                                    {goal.description}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {editPostGoalId && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditPostGoalId("")}
                                className="h-8 text-xs"
                              >
                                {t("profile_remove_goal_btn")}
                              </Button>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">{t("profile_no_goals_created")}</p>
                        )}
                      </div>
                    ) : selectedPost.user_goal_id ? (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/40">
                        <span className="text-xs text-muted-foreground">{t("profile_goal_label")}</span>
                        <span className="text-xs font-medium truncate">
                          {userGoals.find((g) => g.id === selectedPost.user_goal_id)?.description || t("profile_goal_removed_label")}
                        </span>
                      </div>
                    ) : null}

                    {/* Incentives + Comments */}
                    {isLoadingPostData && !isEditingPost && (
                      <div className="flex items-center gap-2 pt-1">
                        {[...Array(6)].map((_, i) => (
                          <div key={i} className="h-8 w-12 rounded-full bg-muted animate-pulse" />
                        ))}
                      </div>
                    )}
                    {!isLoadingPostData && !isEditingPost && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center gap-1 flex-wrap">
                          {([1, 2, 3, 4, 5, 6] as PostIncentiveType[]).map((type) => (
                            <PostIncentiveButton
                              key={type}
                              type={type}
                              isActive={postUserLikes.includes(type)}
                              onClick={() => handleTogglePostIncentive(type)}
                              loading={isTogglingPostLike}
                            />
                          ))}
                          {!isEditingPost && selectedPost && (
                            <div className="ml-auto">
                              <PostCommentsDialog
                                postId={selectedPost.id}
                                commentCount={postComments.length}
                                isPostOwner={!isViewingOtherProfile}
                              />
                            </div>
                          )}
                        </div>
                        {postLikes.length > 0 && (
                          <button
                            onClick={() => setIsLikesModalOpen(true)}
                            className="text-xs font-semibold text-foreground hover:text-primary transition-colors px-1"
                          >
                            {t("profile_incentives_label").replace("{n}", String(postLikes.length))}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    {!isViewingOtherProfile && (
                      <div className="flex gap-2 pt-2">
                        {!isEditingPost ? (
                          <>
                            <Button
                              variant="outline"
                              className="flex-1 rounded-full"
                              onClick={() => setIsEditingPost(true)}
                            >
                              <Edit2 className="h-4 w-4 mr-2" />
                              {t("edit")}
                            </Button>
                            <Button
                              variant="destructive"
                              className="flex-1 rounded-full"
                              onClick={handleDeletePost}
                              disabled={isUpdatingPost}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t("delete")}
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              className="flex-1 rounded-full"
                              onClick={() => setIsEditingPost(false)}
                              disabled={isUpdatingPost}
                            >
                              {t("cancel")}
                            </Button>
                            <Button
                              className="flex-1 rounded-full"
                              onClick={handleUpdatePost}
                              disabled={isUpdatingPost}
                            >
                              {isUpdatingPost ? t("saving") : t("save")}
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>

      {/* Post Likes Modal */}
      <PostLikesModal
        open={isLikesModalOpen}
        onOpenChange={setIsLikesModalOpen}
        likes={postLikes}
      />

      {/* Followers Drawer */}
      <FollowListDrawer
        open={showFollowersModal}
        onOpenChange={setShowFollowersModal}
        type="followers"
        users={followers}
        isLoading={isLoadingFollowers}
        followStatus={followerFollowStatus}
      />

      {/* Following Drawer */}
      <FollowListDrawer
        open={showFollowingModal}
        onOpenChange={setShowFollowingModal}
        type="following"
        users={following}
        isLoading={isLoadingFollowers}
        followStatus={followingFollowStatus}
      />

      {/* Shot Editor Drawer */}
      <ShotEditorDrawer
        open={isShotEditorOpen}
        onOpenChange={setIsShotEditorOpen}
        shot={selectedShot}
        onSaved={(updatedDescription) => {
          setShots((prev) =>
            prev.map((s) => s.id === selectedShot?.id ? { ...s, description: updatedDescription } : s)
          );
          setSelectedShot(null);
        }}
        onDeleted={(shotId) => {
          setShots((prev) => prev.filter((s) => s.id !== shotId));
          setSelectedShot(null);
        }}
      />

      <ShareDrawer
        open={shareDrawerOpen}
        onOpenChange={setShareDrawerOpen}
        text={shareDrawerText}
        url={shareDrawerUrl}
        title={t("profile_share_title")}
      />

      {/* Delete Routine Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="max-w-sm" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{t("profile_delete_routine_title")}</DialogTitle>
            <DialogDescription>
              {t("profile_delete_routine_desc")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setIsDeleteConfirmOpen(false)}
              disabled={isDeletingRoutine}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleDeleteRoutine}
              disabled={isDeletingRoutine}
            >
              {isDeletingRoutine ? t("profile_deleting") : t("delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Workout History Modal */}
      <WorkoutHistoryDrawer
        open={workoutHistoryModalOpen}
        onOpenChange={setWorkoutHistoryModalOpen}
        workout={selectedWorkoutForHistory}
        history={workoutHistory}
        isLoading={isLoadingWorkoutHistory}
      />

      {/* Flow Viewer Modal */}
      <FlowViewerModal
        story={selectedProfileStory}
        stories={profileStories}
        open={isStoryViewerOpen}
        onOpenChange={(open) => {
          setIsStoryViewerOpen(open);
          if (!open) setSelectedProfileStory(null);
        }}
        onNextStory={() => {
          if (!selectedProfileStory) return;
          const idx = profileStories.findIndex((s) => s.id === selectedProfileStory.id);
          if (idx < profileStories.length - 1) {
            setSelectedProfileStory(profileStories[idx + 1]);
          } else {
            setIsStoryViewerOpen(false);
          }
        }}
        onPrevStory={() => {
          if (!selectedProfileStory) return;
          const idx = profileStories.findIndex((s) => s.id === selectedProfileStory.id);
          if (idx > 0) setSelectedProfileStory(profileStories[idx - 1]);
        }}
        onSelectStory={setSelectedProfileStory}
      />

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={isDeleteAccountOpen} onOpenChange={(open) => { setIsDeleteAccountOpen(open); if (!open) setDeleteConfirmText(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">{t("profile_close_account_title")}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">{t("profile_close_account_desc1")}</span>
              <span className="block">{t("profile_close_account_desc2")}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            type="text"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder={t("profile_close_account_placeholder")}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-destructive focus:outline-none bg-background"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteAccount}
              disabled={isDeleting || deleteConfirmText !== t("profile_close_account_confirm_word")}
            >
              {isDeleting ? t("profile_deleting") : t("profile_close_account_action")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Centralized confirmation drawer — replaces all native confirm() calls */}
      <Drawer
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
      >
        <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DrawerHeader>
            <DrawerTitle>{confirmDialog.title}</DrawerTitle>
            <p className="text-sm text-muted-foreground mt-1">{confirmDialog.description}</p>
          </DrawerHeader>
          <div className="flex flex-col gap-3 px-4 pb-6">
            <Button
              className="w-full rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                confirmDialog.onConfirm();
                setConfirmDialog((prev) => ({ ...prev, open: false }));
              }}
            >
              {t("confirm")}
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-full"
              onClick={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
            >
              {t("cancel")}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Commercial Dashboard Drawer */}
    </div>
  );
}
