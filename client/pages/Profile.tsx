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
  getUserWorkoutsDb,
  getWorkoutsDb,
  getDietsDb,
  createUserDietsDb,
  getUserDietsDb,
  getHabitsDb,
  createUserHabitsDb,
  getUserHabitsDb,
  getRoutineTypeName,
  getGoalByIdDb,
  updateRoutineGoalDb,
  getFollowersDb,
  getFollowingDb,
  getFollowingStatusBatchDb,
  getUserShotsDb,
  getUserGoalsByUserIdDb,
  deletePostDb,
  updatePostDb,
  removePostPhotoDb,
  deleteRoutineDb,
  getPostLikeUsersDb,
  getPostCommentsDb,
  getCommercialProfileDb,
  createOrUpdateCommercialProfileDb,
  deleteCommercialProfileDb,
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
  type UserWorkoutWithDetails,
  type UserDietWithDetails,
  type UserHabitWithDetails,
  type UserGoal,
  type ShotWithUser,
  type CommercialProfile,
  type ServicePlan,
  getCommercialPlansDb,
  saveCommercialPlansDb,
  type StoryWithUser,
  type PostIncentiveType,
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
} from "@/components/ui/drawer";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { LoadingSpinner } from "@/components/shared/animated-loading";
import { ShareDrawer } from "@/components/shared/share-drawer";
import {
  Edit2,
  Plus,
  ArrowLeft,
  Check,
  Tag,
  Settings,
  LogOut,
  Trash2,
  Heart,
  MessageSquare,
  Filter,
  Grid3X3,
  Film,
  Search,
  Share2,
  ShoppingBag,
  ArrowRight,
  ExternalLink,
  Phone,
  Briefcase,
  ListChecks,
} from "lucide-react";
import { supabase, resetSupabaseAuth } from "@/lib/supabase";
import { useNavigate, useParams } from "react-router-dom";

export default function Profile() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { userId } = useParams<{ userId?: string }>();


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
  const [userWorkouts, setUserWorkouts] = React.useState<
    UserWorkoutWithDetails[]
  >([]);
  const [diets, setDiets] = React.useState<Diet[]>([]);
  const [dietsLoading, setDietsLoading] = React.useState(false);
  const [selectedDietIds, setSelectedDietIds] = React.useState<Set<string>>(
    new Set(),
  );
  const [isSavingDiets, setIsSavingDiets] = React.useState(false);
  const [searchQueryDiets, setSearchQueryDiets] = React.useState("");
  const [userDiets, setUserDiets] = React.useState<UserDietWithDetails[]>([]);
  const [habits, setHabits] = React.useState<Habit[]>([]);
  const [habitsLoading, setHabitsLoading] = React.useState(false);
  const [selectedHabitIds, setSelectedHabitIds] = React.useState<Set<string>>(
    new Set(),
  );
  const [isSavingHabits, setIsSavingHabits] = React.useState(false);
  const [userHabits, setUserHabits] = React.useState<UserHabitWithDetails[]>(
    [],
  );
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
  const [followers, setFollowers] = React.useState<any[]>([]);
  const [following, setFollowing] = React.useState<any[]>([]);
  const [isLoadingFollowers, setIsLoadingFollowers] = React.useState(false);
  const [followerFollowStatus, setFollowerFollowStatus] = React.useState<Record<string, boolean>>({});
  const [followingFollowStatus, setFollowingFollowStatus] = React.useState<Record<string, boolean>>({});

  // Edit form state

  const [profileOffers, setProfileOffers] = React.useState<CommercialOffer[]>([]);

  // Commercial profile state
  const [isPlansModalOpen, setIsPlansModalOpen] = React.useState(false);
  const [commercialProfile, setCommercialProfile] = React.useState<CommercialProfile | null>(null);
  const [servicePlans, setServicePlans] = React.useState<ServicePlan[]>([]);

  // Delete account state (UI trigger not yet implemented)
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("");

  // Edit account state

  // Notifications state
  const [dailyUsageLimit, setDailyUsageLimit] = React.useState(() => {
    const stored = localStorage.getItem("ritmofit_daily_limit_minutes");
    return stored ? parseInt(stored, 10) : 0;
  });
  const [usageDataLast7Days] = React.useState<{ day: string; minutes: number }[]>([]);

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
        userWorkoutsData,
        userDietsData,
        userHabitsData,
        userGoalsData,
        shotsData,
        commercialProfileData,
        offersData,
        commercialPlansData,
      ] = await Promise.all([
        getUserRoutinesDb(profileUserId),
        getUserWorkoutsDb(profileUserId),
        getUserDietsDb(profileUserId),
        getUserHabitsDb(profileUserId),
        getUserGoalsByUserIdDb(profileUserId),
        getUserShotsDb(profileUserId),
        getCommercialProfileDb(profileUserId),
        getCommercialOffersByUserIdDb(profileUserId),
        getCommercialPlansDb(profileUserId),
      ]);
      setRoutines(routinesData);
      setUserWorkouts(userWorkoutsData);
      setUserDiets(userDietsData);
      setUserHabits(userHabitsData);
      setUserGoals(isViewingOtherProfile ? userGoalsData.filter((g) => g.visibility === 1) : userGoalsData);
      setShots(shotsData);
      setCommercialProfile(commercialProfileData);
      setProfileOffers(offersData.filter((o) => o.is_active));
      setServicePlans(commercialPlansData.map((p) => ({ name: p.name, price: p.price, description: p.description ?? undefined })));

      // Batch 3 — stories: fire-and-forget
      getUserActiveStoriesDb(profileUserId).then(setProfileStories).catch((err) => console.error("Erro ao carregar stories do perfil:", err));
    } catch (err: any) {
      console.error("Error loading profile:", err);
      toast({
        title: "Erro ao carregar perfil",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
      setProfileError(true);
      setLoading(false);
    }
  }, [profileUserId]);

  const handleViewPost = React.useCallback(async (post: PostWithUser) => {
    setSelectedPost(post);
    setEditPostDescription(post.description);
    setEditPostGoalId(post.user_goal_id || "");
    setIsPostViewerOpen(true);
    setIsEditingPost(false);
    setIsLoadingPostData(true);

    try {
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
      toast({ title: "Erro ao carregar dados do post", description: "Tente novamente.", variant: "destructive" });
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
        title: "Sucesso!",
        description: "Post atualizado com sucesso.",
      });
    } catch (err: any) {
      console.error("Error updating post:", err);
      toast({
        title: "Erro ao atualizar",
        description: err?.message || "Tente novamente.",
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
      toast({ title: "Foto removida!" });
    } catch (err: any) {
      toast({ title: "Erro ao remover foto", description: err?.message, variant: "destructive" });
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
      await togglePostLike(selectedPost.id, type);
      const updatedLikes = await getPostLikeUsersDb(selectedPost.id);
      setPostLikes(updatedLikes);
    } catch (err) {
      setPostUserLikes(previousLikes);
      toast({ title: "Erro ao registrar incentivo", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setIsTogglingPostLike(false);
    }
  }, [selectedPost, isTogglingPostLike]);

  const handleDeletePost = React.useCallback(() => {
    if (!selectedPost) return;
    showConfirm(
      "Deletar post",
      "Tem certeza que deseja deletar este post? Esta ação não pode ser desfeita.",
      async () => {
        setIsUpdatingPost(true);
        try {
          await deletePostDb(selectedPost.id);
          setPosts((prevPosts) => prevPosts.filter((p) => p.id !== selectedPost.id));
          setIsPostViewerOpen(false);
          setSelectedPost(null);
          toast({ title: "Sucesso!", description: "Post deletado com sucesso." });
        } catch (err: any) {
          console.error("Error deleting post:", err);
          toast({ title: "Erro ao deletar", description: err?.message || "Tente novamente.", variant: "destructive" });
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
        title: "Erro ao carregar seguidores",
        description: err?.message || "Tente novamente.",
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
        title: "Erro ao carregar seguindo",
        description: err?.message || "Tente novamente.",
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
          title: "Meta vinculada!",
          description: "A meta foi vinculada à rotina com sucesso.",
        });
      }
    } catch (err: any) {
      console.error("Error linking goal:", err);
      toast({
        title: "Erro ao vincular meta",
        description: err.message || "Tente novamente mais tarde.",
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
          title: "Meta desvinculada!",
          description: "A meta foi desvinculada da rotina.",
        });
      }
    } catch (err: any) {
      console.error("Error unlinking goal:", err);
      toast({
        title: "Erro ao desvincular meta",
        description: err.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingGoal(false);
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
        title: "Erro ao carregar histórico",
        description: errorMsg || "Não foi possível carregar o histórico do exercício.",
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
        title: "Rotina removida!",
        description: "A rotina foi deletada com sucesso.",
      });
    } catch (err: any) {
      const errorMsg = err?.message || "Tente novamente mais tarde.";
      console.error("Error deleting routine:", errorMsg);
      toast({
        title: "Erro ao deletar rotina",
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
          title: "Erro ao carregar exercícios",
          description: "Tente novamente mais tarde.",
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
          title: "Erro ao carregar dietas",
          description: "Tente novamente mais tarde.",
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
          title: "Erro ao carregar hábitos",
          description: "Tente novamente mais tarde.",
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
          title: "Rotina criada!",
          description: `Nova rotina de "${getRoutineTypeName(selectedRoutineType)}" foi criada.`,
        });
        setIsCreateRoutineOpen(false);
        setSelectedRoutineType(null);
        setWorkouts([]);
      }
    } catch (err: any) {
      console.error("Error creating routine:", err);
      toast({
        title: "Erro ao criar rotina",
        description: err.message || "Tente novamente mais tarde.",
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
        title: "Exercícios salvos!",
        description: `${workoutIdsArray.length} exercício${workoutIdsArray.length > 1 ? "s" : ""} foi${workoutIdsArray.length > 1 ? "ram" : ""} adicionado${workoutIdsArray.length > 1 ? "s" : ""} com sucesso.`,
      });

      setIsCreateRoutineOpen(false);
      setSelectedRoutineType(null);
      setWorkouts([]);
      setSelectedWorkoutIds(new Set());

      // Reload routines and user workouts
      if (user) {
        const [routinesData, userWorkoutsData] = await Promise.all([
          getUserRoutinesDb(user.id),
          getUserWorkoutsDb(user.id),
        ]);
        setRoutines(routinesData);
        setUserWorkouts(userWorkoutsData);
      }
    } catch (err: any) {
      console.error("Error saving workouts:", err);
      toast({
        title: "Erro ao salvar exercícios",
        description: err.message || "Tente novamente mais tarde.",
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
        title: "Dietas salvas!",
        description: `${dietIdsArray.length} dieta${dietIdsArray.length > 1 ? "s" : ""} foi${dietIdsArray.length > 1 ? "ram" : ""} adicionada${dietIdsArray.length > 1 ? "s" : ""} com sucesso.`,
      });

      setIsCreateRoutineOpen(false);
      setSelectedRoutineType(null);
      setDiets([]);
      setSelectedDietIds(new Set());

      // Reload routines and user diets
      if (user) {
        const [routinesData, userDietsData] = await Promise.all([
          getUserRoutinesDb(user.id),
          getUserDietsDb(user.id),
        ]);
        setRoutines(routinesData);
        setUserDiets(userDietsData);
      }
    } catch (err: any) {
      console.error("Error saving diets:", err);
      toast({
        title: "Erro ao salvar dietas",
        description: err.message || "Tente novamente mais tarde.",
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
        title: "Hábitos salvos!",
        description: `${habitIdsArray.length} hábito${habitIdsArray.length > 1 ? "s" : ""} foi${habitIdsArray.length > 1 ? "ram" : ""} adicionado${habitIdsArray.length > 1 ? "s" : ""} com sucesso.`,
      });

      setIsCreateRoutineOpen(false);
      setSelectedRoutineType(null);
      setHabits([]);
      setSelectedHabitIds(new Set());

      // Reload routines and user habits
      if (user) {
        const [routinesData, userHabitsData] = await Promise.all([
          getUserRoutinesDb(user.id),
          getUserHabitsDb(user.id),
        ]);
        setRoutines(routinesData);
        setUserHabits(userHabitsData);
      }
    } catch (err: any) {
      console.error("Error saving habits:", err);
      toast({
        title: "Erro ao salvar hábitos",
        description: err.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsSavingHabits(false);
    }
  };

  // Phone formatting function for Brazilian format (XX) XXXXX-XXXX

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (deleteConfirmText !== "DELETAR CONTA") {
      toast({
        title: "Confirmação incorreta",
        description: "Digite 'DELETAR CONTA' para confirmar a exclusão.",
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
        title: "Conta deletada",
        description: "Sua conta foi permanentemente removida.",
      });

      // Redirect to login after a short delay
      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (err: any) {
      console.error("Error deleting account:", err);
      toast({
        title: "Erro ao deletar conta",
        description: err?.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <LoadingSpinner className="h-12 w-12" />
        <p className="text-sm text-muted-foreground">Carregando perfil...</p>
      </div>
    );
  }

  if (!loading && profileError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-muted-foreground text-sm">Não foi possível carregar o perfil</p>
        <Button variant="outline" size="sm" onClick={() => { setProfileError(false); loadProfile(); }}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Perfil não encontrado.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Header Card */}
      <Card className="border-border/60">
        <CardContent className="pt-6">
          {/* Profile Header — Avatar centralizado + info abaixo */}
          <div className="flex flex-col gap-5">
            {/* Settings button no topo direito */}
            {!isViewingOtherProfile && (
              <div className="flex justify-end -mt-2 -mr-2">
                <SettingsDrawer
                  profile={profile}
                  userId={user!.id}
                  userEmail={user?.email ?? ""}
                  stats={stats}
                  onProfileUpdated={(updated) => setProfile(updated)}
                  onRequestDeleteAccount={() => setIsDeleteAccountOpen(true)}
                />
              </div>
            )}

            {/* Avatar + identidade centralizado */}
            <div className="flex flex-col items-center gap-3">
              {/* Avatar */}
              <div className="shrink-0">
                {profileStories.length > 0 ? (
                  <button
                    onClick={() => {
                      setSelectedProfileStory(profileStories[0]);
                      setIsStoryViewerOpen(true);
                    }}
                    className="rounded-full p-[3px] bg-brand-gradient ring-0 cursor-pointer hover:opacity-90 transition-opacity block"
                    title="Ver flow"
                  >
                    <UserAvatar
                      photo={profile.photo}
                      gender={profile.gender}
                      nickname={profile.nickname}
                      className="h-24 w-24 ring-2 ring-background"
                    />
                  </button>
                ) : (
                  <UserAvatar
                    photo={profile.photo}
                    gender={profile.gender}
                    nickname={profile.nickname}
                    className="h-24 w-24 ring-2 ring-border/60"
                  />
                )}
              </div>

              {/* Nome + insignias */}
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <h1 className="text-xl font-bold tracking-tight">
                  {profile.nickname}
                </h1>
                <UserInsignias userId={profileUserId || ""} showStreak />
              </div>

              {/* Handle */}
              {profile.handle && (
                <p className="text-sm text-muted-foreground -mt-2">@{profile.handle.replace(/^@/, "")}</p>
              )}

            </div>
          </div>

            {/* Bio and Commercial Profile */}
            <div className="space-y-2">
              {profile.bio && (
                <p className="text-sm text-muted-foreground text-center">
                  {profile.bio}
                </p>
              )}

              {/* Stats inline minimalista */}
              <div className="flex items-center justify-center gap-1.5 text-sm pt-2">
                <span className="font-semibold">{stats.postsCount}</span>
                <span className="text-muted-foreground">posts</span>
                <span className="text-muted-foreground/40">·</span>
                <button onClick={() => setShowFollowersModal(true)} className="flex items-center gap-1.5 hover:opacity-70 transition-opacity">
                  <span className="font-semibold">{stats.followersCount}</span>
                  <span className="text-muted-foreground">seguidores</span>
                </button>
                <span className="text-muted-foreground/40">·</span>
                <button onClick={() => setShowFollowingModal(true)} className="flex items-center gap-1.5 hover:opacity-70 transition-opacity">
                  <span className="font-semibold">{stats.followingCount}</span>
                  <span className="text-muted-foreground">seguindo</span>
                </button>
              </div>

              {/* Commercial Profile Info */}
              {commercialProfile && (
                <div className="flex flex-col gap-1 p-2 rounded-lg bg-muted/20 border border-brand/20">
                  <div className="flex items-center gap-2">
                    {commercialProfile.business_phone ? (
                      <a
                        href={`https://wa.me/55${commercialProfile.business_phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-brand hover:underline flex items-center gap-1"
                        title="Entrar em contato via WhatsApp"
                      >
                        <span>💬</span>
                        {commercialProfile.business_name}
                      </a>
                    ) : (
                      <div className="text-sm font-medium text-brand">
                        🏪 {commercialProfile.business_name}
                      </div>
                    )}
                    {commercialProfile.business_segment && (
                      <div className="text-xs px-2 py-0.5 rounded bg-brand/20 text-brand font-medium">
                        {commercialProfile.business_segment === "academia" && "Academia / Fitness"}
                        {commercialProfile.business_segment === "personal_trainer" && "Personal Trainer"}
                        {commercialProfile.business_segment === "nutricionista" && "Nutricionista"}
                        {commercialProfile.business_segment === "psicologo" && "Psicólogo"}
                        {commercialProfile.business_segment === "fisioterapeuta" && "Fisioterapeuta"}
                        {commercialProfile.business_segment === "coach" && "Coach"}
                        {commercialProfile.business_segment === "outros" && "Outros"}
                      </div>
                    )}
                    {servicePlans.length > 0 && (
                      <button
                        onClick={() => setIsPlansModalOpen(true)}
                        className="ml-auto flex items-center gap-1 text-xs text-brand hover:text-brand/80 transition-colors"
                        title="Ver planos e preços"
                      >
                        <ListChecks className="h-3.5 w-3.5" />
                        <span>{servicePlans.length} {servicePlans.length === 1 ? "plano" : "planos"}</span>
                      </button>
                    )}
                  </div>
                  {commercialProfile.business_website && (
                    <a
                      href={commercialProfile.business_website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand hover:underline flex items-center gap-1"
                    >
                      <span>🔗</span>
                      {commercialProfile.business_website.replace(/^https?:\/\//, "")}
                    </a>
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
                  Planos e Preços
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-1">
                {commercialProfile && (
                  <p className="text-sm text-muted-foreground">{commercialProfile.business_name}</p>
                )}
                {servicePlans.map((plan, idx) => (
                  <div key={idx} className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 space-y-1">
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
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum plano cadastrado.</p>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Action Buttons - Below stats, centered */}
          {isViewingOtherProfile && (
            <div className="flex gap-2 justify-center mt-3">
              {/* Follow/Unfollow Button */}
              <FollowButton
                targetUserId={profileUserId!}
                onFollowChange={() => {
                  getUserStatsDb(profileUserId!).then(setStats);
                }}
              />

              {/* Message Button */}
              <Button
                onClick={() => navigate(`/comunidade?user=${profileUserId}`)}
                variant="outline"
                size="sm"
                className="rounded-full gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Mensagem
              </Button>

              {/* Share Profile Button */}
              <Button
                variant="outline"
                size="sm"
                className="rounded-full gap-2"
                onClick={() => {
                  const text = `Confira o perfil de @${profile?.nickname} no Linka! 💪`;
                  const profileUrl = `${window.location.origin}/usuario/${profileUserId}`;
                  setShareDrawerText(text);
                  setShareDrawerUrl(profileUrl);
                  setShareDrawerOpen(true);
                }}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Share own profile */}
          {!isViewingOtherProfile && profile && stats.points > 0 && (
            <div className="flex justify-center mt-1">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full gap-2 text-muted-foreground text-xs h-8"
                onClick={() => {
                  const tier = stats.points >= 1000 ? "Elite" : stats.points >= 500 ? "Ouro" : stats.points >= 200 ? "Prata" : "Bronze";
                  const text = `Estou no Linka no nível ${stats.level} (${tier}) com ${stats.points} pontos! 🏋️ Junte-se a mim: @${profile.nickname}`;
                  const profileUrl = `${window.location.origin}/usuario/${profileUserId}`;
                  setShareDrawerText(text);
                  setShareDrawerUrl(profileUrl);
                  setShareDrawerOpen(true);
                }}
              >
                <Share2 className="h-3.5 w-3.5" />
                Compartilhar perfil
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Posts, Shots, Routines and Store Tabs */}
      <Tabs defaultValue="posts" className="w-full">
        <TabsList className={`grid w-full ${profileOffers.length > 0 ? "grid-cols-3" : "grid-cols-2"}`}>
          <TabsTrigger value="posts" className="flex items-center gap-1.5">
            <Grid3X3 className="h-4 w-4" />
            Posts ({stats.postsCount})
          </TabsTrigger>
          <TabsTrigger value="shots" className="flex items-center gap-1.5">
            <Film className="h-4 w-4" />
            Shots ({shots.length})
          </TabsTrigger>
          {profileOffers.length > 0 && (
            <TabsTrigger value="vitrine" className="flex items-center gap-1.5">
              {commercialProfile ? <Briefcase className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
              {commercialProfile ? `Serviços (${profileOffers.length})` : `Vitrine (${profileOffers.length})`}
            </TabsTrigger>
          )}
        </TabsList>

        {/* Posts Tab */}
        <TabsContent value="posts" className="space-y-4 fade-in">
          {posts.length > 0 ? (
            <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {posts.map((post) => (
                <button
                  key={post.id}
                  onClick={() => handleViewPost(post)}
                  className="group relative aspect-square overflow-hidden rounded-lg bg-muted border border-border/60 hover:border-border/80 transition-all cursor-pointer"
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
            <div className="rounded-lg border border-border/60 bg-muted/30 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhum post ainda.
              </p>
            </div>
          )}
        </TabsContent>

        {/* Shots Tab */}
        <TabsContent value="shots" className="space-y-4 fade-in">
          {shots.length > 0 ? (
            <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {shots.map((shot) => (
                <div
                  key={shot.id}
                  className="group relative aspect-square overflow-hidden rounded-lg bg-black border border-border/60 hover:border-border/80 transition-all"
                >
                  <button
                    onClick={() => navigate(`/shots`, { state: { shotId: shot.id } })}
                    className="w-full h-full cursor-pointer"
                  >
                    <video
                      src={shot.video_url}
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
            <div className="rounded-lg border border-border/60 bg-muted/30 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhum shot ainda.
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
                            <div className="text-center py-6 text-sm text-muted-foreground">
                              Carregando exercícios...
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
                      <div className="text-center py-6 text-sm text-muted-foreground">
                        Carregando dietas...
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
                      <div className="text-center py-6 text-sm text-muted-foreground">
                        Carregando hábitos...
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
                                {habit.photo ? (
                                  <img
                                    src={habit.photo}
                                    alt={habit.name}
                                    className="h-16 w-16 rounded object-cover flex-shrink-0"
                                  />
                                ) : (
                                  <div className="h-16 w-16 rounded bg-muted flex-shrink-0" />
                                )}
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
                              ? "Meta vinculada"
                              : "Vincular meta"
                          }
                        >
                          <Tag className="h-5 w-5" />
                        </button>

                        <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter" onOpenAutoFocus={(e) => e.preventDefault()}>
                          <DrawerHeader className="shrink-0">
                            <DrawerTitle>
                              {linkedGoal ? "Meta Vinculada" : "Vincular Meta"}
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
                                        Duração:
                                      </span>
                                      <p className="font-medium">
                                        {linkedGoal.duration} dias
                                      </p>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">
                                        Quantidade:
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
                                    ? "Desvinculando..."
                                    : "Desvincular Meta"}
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
                                        <span>Duração: {goal.duration} dias</span>
                                        <span>Quantidade: {goal.quantity}</span>
                                      </div>
                                    </button>
                                  ))
                                ) : (
                                  <p className="text-sm text-muted-foreground text-center py-6">
                                    Você ainda não tem metas vinculadas.
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
          <TabsContent value="vitrine" className="space-y-4 fade-in">
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
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20">Parceiro</span>
                    </div>
                    {commercialProfile.business_segment && (
                      <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">{commercialProfile.business_segment}</p>
                    )}
                    {commercialProfile.business_description && (
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-snug">{commercialProfile.business_description}</p>
                    )}
                  </div>
                  {commercialProfile.business_website && (
                    <a href={commercialProfile.business_website} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-brand transition-colors">
                      <ExternalLink className="h-4 w-4" />
                    </a>
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
                              {isService ? "A partir de " : ""}
                              <span className="text-base font-black text-foreground tracking-tighter">R$ {offer.price}</span>
                            </span>
                          )}
                          <a
                            href={offer.link_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => incrementOfferClickDb(offer.id, offer.user_id)}
                            className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand/90 transition-colors shrink-0"
                          >
                            {isService
                              ? <><Phone className="h-3.5 w-3.5" /> Entrar em contato</>
                              : <><ArrowRight className="h-3.5 w-3.5" /> Ver oferta</>
                            }
                          </a>
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
              "Descartar alterações?",
              "Você tem alterações não salvas. Deseja sair sem salvar?",
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
                {isEditingPost ? "Editar Post" : "Post"}
              </DrawerTitle>
              {selectedPost && (
                <div className="flex items-center gap-2">
                  <UserAvatar
                    photo={selectedPost.userPhoto}
                    gender={selectedPost.userGender}
                    nickname={selectedPost.userNickname}
                    size="sm"
                    className="h-7 w-7 border border-border/60"
                  />
                  <span className="text-sm font-medium">{selectedPost.userNickname}</span>
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
                    {/* Insignias separadas do header no mobile */}
                    <div className="flex items-center gap-2">
                      <UserInsignias userId={selectedPost.user_id} />
                      <span className="text-xs text-muted-foreground ml-auto font-mono">
                        {formatTimeAgo(selectedPost.created_at)}
                      </span>
                    </div>

                    {/* Description */}
                    {isEditingPost ? (
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Descrição</label>
                        <Textarea
                          value={editPostDescription}
                          onChange={(e) => setEditPostDescription(e.target.value)}
                          className="resize-none"
                          rows={3}
                        />
                      </div>
                    ) : (
                      selectedPost.description && (
                        <p className="text-sm text-foreground leading-relaxed">
                          {selectedPost.description}
                        </p>
                      )
                    )}

                    {/* Goal */}
                    {isEditingPost ? (
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Meta Vinculada</label>
                        {userGoals.length > 0 ? (
                          <div className="space-y-2">
                            <Select value={editPostGoalId} onValueChange={setEditPostGoalId}>
                              <SelectTrigger className="rounded-lg">
                                <SelectValue placeholder="Selecione uma meta ou deixe em branco" />
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
                                Remover meta
                              </Button>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Nenhuma meta criada</p>
                        )}
                      </div>
                    ) : selectedPost.user_goal_id ? (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/40">
                        <span className="text-xs text-muted-foreground">Meta:</span>
                        <span className="text-xs font-medium truncate">
                          {userGoals.find((g) => g.id === selectedPost.user_goal_id)?.description || "Meta removida"}
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
                            {postLikes.length} incentivos
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
                              Editar
                            </Button>
                            <Button
                              variant="destructive"
                              className="flex-1 rounded-full"
                              onClick={handleDeletePost}
                              disabled={isUpdatingPost}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Deletar
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
                              Cancelar
                            </Button>
                            <Button
                              className="flex-1 rounded-full"
                              onClick={handleUpdatePost}
                              disabled={isUpdatingPost}
                            >
                              {isUpdatingPost ? "Salvando..." : "Salvar"}
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
        title="Compartilhar perfil"
      />

      {/* Delete Routine Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="max-w-sm" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Deletar Rotina</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja deletar esta rotina? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setIsDeleteConfirmOpen(false)}
              disabled={isDeletingRoutine}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleDeleteRoutine}
              disabled={isDeletingRoutine}
            >
              {isDeletingRoutine ? "Deletando..." : "Deletar"}
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
            <AlertDialogTitle className="text-destructive">⚠️ Encerrar Conta</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">Esta ação é <strong>permanente e irreversível</strong>. Todos os seus dados, treinos, histórico e publicações serão deletados.</span>
              <span className="block">Para confirmar, digite <strong>DELETAR CONTA</strong> no campo abaixo:</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            type="text"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="DELETAR CONTA"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-destructive focus:outline-none bg-background"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteAccount}
              disabled={isDeleting || deleteConfirmText !== "DELETAR CONTA"}
            >
              {isDeleting ? "Deletando..." : "Encerrar Conta"}
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
              Confirmar
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-full"
              onClick={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
            >
              Cancelar
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Commercial Dashboard Drawer */}
    </div>
  );
}
