import * as React from "react";
import {
  getUserProfileDb,
  getUserPostsDb,
  getUserStatsDb,
  updateUserProfileDb,
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
  deleteShotDb,
  updateShotDb,
  getPostLikeUsersDb,
  getPostCommentsDb,
  followUserDb,
  unfollowUserDb,
  isFollowingDb,
  getCommercialProfileDb,
  createOrUpdateCommercialProfileDb,
  getWorkoutHistoryDb,
  getUserActiveStoriesDb,
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
  type StoryWithUser,
} from "@/lib/ritmofit-db";
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
import { PostLikesModal } from "@/components/modals/post-likes-modal";
import { PostCommentsDialog } from "@/components/modals/post-comments-dialog";
import { UserInsignias } from "@/components/profile/user-insignias";
import { PostCarousel } from "@/components/post/post-carousel";
import { FlowViewerModal } from "@/components/modals/flow-viewer-modal";
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
import { useLayoutMode } from "@/hooks/useLayoutMode";
import { LoadingSpinner } from "@/components/shared/animated-loading";
import {
  Edit2,
  Upload,
  Plus,
  ArrowLeft,
  Check,
  Tag,
  Settings,
  LogOut,
  Moon,
  Sun,
  Trash2,
  Heart,
  UserPlus,
  MessageSquare,
  Filter,
  Bell,
  Globe,
  BarChart3,
  Grid3X3,
  Film,
  ChevronDown,
  Search,
  Share2,
} from "lucide-react";
import { supabase, resetSupabaseAuth } from "@/lib/supabase";
import { useNavigate, useParams } from "react-router-dom";
import { useTheme } from "next-themes";
import { useLanguage } from "@/lib/language-context";

export default function Profile() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { userId } = useParams<{ userId?: string }>();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isDark = (resolvedTheme ?? theme) === "dark";
  const { layoutMode, toggleLayoutMode } = useLayoutMode();
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);

  // Centralized confirmation dialog state (replaces native confirm())
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
    []
  );

  // Determine if we're viewing another user's profile
  const isViewingOtherProfile = !!userId && userId !== user?.id;
  const profileUserId = userId || user?.id;

  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [posts, setPosts] = React.useState<PostWithUser[]>([]);
  const [shots, setShots] = React.useState<ShotWithUser[]>([]);
  const [routines, setRoutines] = React.useState<Routine[]>([]);
  const [selectedPost, setSelectedPost] = React.useState<PostWithUser | null>(null);
  const [isPostViewerOpen, setIsPostViewerOpen] = React.useState(false);
  const [isEditingPost, setIsEditingPost] = React.useState(false);
  const [editPostDescription, setEditPostDescription] = React.useState("");
  const [editPostGoalId, setEditPostGoalId] = React.useState<string>("");
  const [isUpdatingPost, setIsUpdatingPost] = React.useState(false);
  const [postLikes, setPostLikes] = React.useState<any[]>([]);
  const [postComments, setPostComments] = React.useState<any[]>([]);
  const [isLoadingPostData, setIsLoadingPostData] = React.useState(false);
  const [isLikesModalOpen, setIsLikesModalOpen] = React.useState(false);
  const [selectedShot, setSelectedShot] = React.useState<ShotWithUser | null>(null);
  const [isShotEditorOpen, setIsShotEditorOpen] = React.useState(false);
  const [isEditingShot, setIsEditingShot] = React.useState(false);
  const [editShotDescription, setEditShotDescription] = React.useState("");
  const [isUpdatingShot, setIsUpdatingShot] = React.useState(false);
  const [isFollowing, setIsFollowing] = React.useState(false);
  const [isFollowingLoading, setIsFollowingLoading] = React.useState(false);
  const [stats, setStats] = React.useState<UserStats>({
    postsCount: 0,
    followersCount: 0,
    followingCount: 0,
    points: 0,
    level: 1,
  });
  const [loading, setLoading] = React.useState(true);
  const [profileError, setProfileError] = React.useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
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
  const [isTogglingFollow, setIsTogglingFollow] = React.useState<Record<string, boolean>>({});

  // Edit form state
  const [editNickname, setEditNickname] = React.useState("");
  const [editBio, setEditBio] = React.useState("");
  const [editPhotoFile, setEditPhotoFile] = React.useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = React.useState<string | null>(
    null,
  );

  // Commercial profile state
  const [isCommercialProfileOpen, setIsCommercialProfileOpen] = React.useState(false);
  const [isCommercialDashboardOpen, setIsCommercialDashboardOpen] = React.useState(false);
  const [commercialProfile, setCommercialProfile] = React.useState<CommercialProfile | null>(null);
  const [commercialFormData, setCommercialFormData] = React.useState({
    business_segment: "",
    business_name: "",
    business_description: "",
    business_phone: "",
    business_email: "",
    business_website: "",
  });
  const [isSavingCommercial, setIsSavingCommercial] = React.useState(false);

  // Delete account state (UI trigger not yet implemented)
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("");

  // Edit account state
  const [isResettingPassword, setIsResettingPassword] = React.useState(false);
  const [isDangerZoneOpen, setIsDangerZoneOpen] = React.useState(false);

  // Language state (backed by global context)
  const [isLanguageOpen, setIsLanguageOpen] = React.useState(false);
  const { language: currentLanguage, setLanguage: setCurrentLanguage } = useLanguage();

  // Notifications state
  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState({
    workoutReminders: true,
    achievementAlerts: true,
    friendActivity: true,
    messages: true,
    sound: true,
  });

  // Time Management state
  const [isTimeManagementOpen, setIsTimeManagementOpen] = React.useState(false);
  const [dailyUsageLimit, setDailyUsageLimit] = React.useState(() => {
    const stored = localStorage.getItem("ritmofit_daily_limit_minutes");
    return stored ? parseInt(stored, 10) : 0;
  });
  const [usageDataLast7Days] = React.useState([
    { day: "Seg", minutes: 45 },
    { day: "Ter", minutes: 60 },
    { day: "Qua", minutes: 55 },
    { day: "Qui", minutes: 70 },
    { day: "Sex", minutes: 80 },
    { day: "Sab", minutes: 90 },
    { day: "Dom", minutes: 75 },
  ]);

  // Personalization state
  const [isPersonalizationOpen, setIsPersonalizationOpen] = React.useState(false);

  const loadProfile = React.useCallback(async () => {
    if (!profileUserId) return;

    // Reset profile-specific state so stale data from the previous user is never shown
    setProfile(null);
    setPosts([]);
    setShots([]);
    setRoutines([]);
    setIsFollowing(false);
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
      ] = await Promise.all([
        getUserRoutinesDb(profileUserId),
        getUserWorkoutsDb(profileUserId),
        getUserDietsDb(profileUserId),
        getUserHabitsDb(profileUserId),
        getUserGoalsByUserIdDb(profileUserId),
        getUserShotsDb(profileUserId),
        getCommercialProfileDb(profileUserId),
      ]);
      setRoutines(routinesData);
      setUserWorkouts(userWorkoutsData);
      setUserDiets(userDietsData);
      setUserHabits(userHabitsData);
      setUserGoals(userGoalsData);
      setShots(shotsData);
      setCommercialProfile(commercialProfileData);
      if (commercialProfileData) {
        setCommercialFormData({
          business_segment: commercialProfileData.business_segment || "",
          business_name: commercialProfileData.business_name || "",
          business_description: commercialProfileData.business_description || "",
          business_phone: commercialProfileData.business_phone || "",
          business_email: commercialProfileData.business_email || "",
          business_website: commercialProfileData.business_website || "",
        });
      }

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
      const [likes, comments] = await Promise.all([
        getPostLikeUsersDb(post.id),
        getPostCommentsDb(post.id),
      ]);
      setPostLikes(likes);
      setPostComments(comments);
    } catch (err) {
      console.error("Error loading post data:", err);
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

  const handleUpdateShot = React.useCallback(async () => {
    if (!selectedShot) return;

    setIsUpdatingShot(true);
    try {
      const success = await updateShotDb(selectedShot.id, editShotDescription);

      if (success) {
        // Update local shots list
        setShots((prevShots) =>
          prevShots.map((r) =>
            r.id === selectedShot.id
              ? { ...r, description: editShotDescription }
              : r
          )
        );

        setIsShotEditorOpen(false);
        setSelectedShot(null);

        toast({
          title: "Sucesso!",
          description: "Shot atualizado com sucesso.",
        });
      } else {
        toast({
          title: "Erro ao atualizar",
          description: "Tente novamente.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("Error updating shot:", err);
      toast({
        title: "Erro ao atualizar",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingShot(false);
    }
  }, [selectedShot, editShotDescription]);

  const handleDeleteShot = React.useCallback(() => {
    if (!selectedShot) return;
    showConfirm(
      "Deletar shot",
      "Tem certeza que deseja deletar este shot? Esta ação não pode ser desfeita.",
      async () => {
        setIsUpdatingShot(true);
        try {
          await deleteShotDb(selectedShot.id);
          setShots((prevShots) => prevShots.filter((r) => r.id !== selectedShot.id));
          setIsShotEditorOpen(false);
          setSelectedShot(null);
          toast({ title: "Sucesso!", description: "Shot deletado com sucesso." });
        } catch (err: any) {
          console.error("Error deleting shot:", err);
          toast({ title: "Erro ao deletar", description: err?.message || "Tente novamente.", variant: "destructive" });
        } finally {
          setIsUpdatingShot(false);
        }
      }
    );
  }, [selectedShot, showConfirm]);

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

  const checkFollowingStatus = React.useCallback(async () => {
    if (isViewingOtherProfile && profileUserId) {
      try {
        const following = await isFollowingDb(profileUserId);
        setIsFollowing(following);
      } catch (err: any) {
        console.error("Error checking follow status:", err);
      }
    }
  }, [isViewingOtherProfile, profileUserId]);

  const doFollowUnfollow = React.useCallback(async () => {
    if (!profileUserId) return;
    setIsFollowingLoading(true);
    try {
      const success = isFollowing
        ? await unfollowUserDb(profileUserId)
        : await followUserDb(profileUserId);
      if (success) {
        setIsFollowing(!isFollowing);
        toast({
          title: "Sucesso!",
          description: isFollowing ? "Você deixou de seguir este usuário." : "Você está seguindo este usuário.",
        });
      } else {
        toast({ title: "Erro", description: "Tente novamente.", variant: "destructive" });
      }
    } catch (err: any) {
      console.error("Error toggling follow:", err);
      toast({ title: "Erro", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setIsFollowingLoading(false);
    }
  }, [profileUserId, isFollowing]);

  const handleFollowUnfollow = React.useCallback(() => {
    if (!profileUserId) return;
    if (isFollowing) {
      showConfirm(
        "Deixar de seguir",
        "Tem certeza que deseja parar de seguir este usuário?",
        doFollowUnfollow
      );
    } else {
      doFollowUnfollow();
    }
  }, [profileUserId, isFollowing, doFollowUnfollow, showConfirm]);

  const handleToggleFollowInModal = React.useCallback((userId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const isCurrentlyFollowing = followerFollowStatus[userId] || false;

    const doToggle = async () => {
      setIsTogglingFollow((prev) => ({ ...prev, [userId]: true }));
      try {
        const success = isCurrentlyFollowing
          ? await unfollowUserDb(userId)
          : await followUserDb(userId);
        if (success) {
          setFollowerFollowStatus((prev) => ({ ...prev, [userId]: !isCurrentlyFollowing }));
          toast({
            title: "Sucesso!",
            description: isCurrentlyFollowing ? "Você deixou de seguir este usuário." : "Você está seguindo este usuário.",
          });
        } else {
          toast({ title: "Erro", description: "Tente novamente.", variant: "destructive" });
        }
      } catch (err: any) {
        console.error("Error toggling follow:", err);
        toast({ title: "Erro", description: err?.message || "Tente novamente.", variant: "destructive" });
      } finally {
        setIsTogglingFollow((prev) => ({ ...prev, [userId]: false }));
      }
    };

    if (isCurrentlyFollowing) {
      showConfirm(
        "Deixar de seguir",
        "Tem certeza que deseja parar de seguir este usuário?",
        doToggle
      );
    } else {
      doToggle();
    }
  }, [followerFollowStatus, showConfirm]);

  const loadCommercialProfile = React.useCallback(async () => {
    if (!user) return;

    try {
      const profile = await getCommercialProfileDb(user.id);
      if (profile) {
        setCommercialProfile(profile);
        setCommercialFormData({
          business_segment: profile.business_segment || "",
          business_name: profile.business_name || "",
          business_description: profile.business_description || "",
          business_phone: profile.business_phone || "",
          business_email: profile.business_email || "",
          business_website: profile.business_website || "",
        });
      }
    } catch (err: any) {
      console.error("Error loading commercial profile:", err);
    }
  }, [user]);

  const handleOpenCommercialProfile = React.useCallback(() => {
    setIsCommercialProfileOpen(true);
    loadCommercialProfile();
  }, [loadCommercialProfile]);

  const handleSaveCommercialProfile = React.useCallback(async () => {
    if (!user) return;

    setIsSavingCommercial(true);
    try {
      const updated = await createOrUpdateCommercialProfileDb(user.id, commercialFormData);
      setCommercialProfile(updated);

      toast({
        title: "Sucesso!",
        description: "Perfil comercial atualizado com sucesso.",
      });

      setIsCommercialProfileOpen(false);
    } catch (err: any) {
      console.error("Error saving commercial profile:", err);
      toast({
        title: "Erro ao salvar",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSavingCommercial(false);
    }
  }, [user, commercialFormData]);

  React.useEffect(() => {
    checkFollowingStatus();
  }, [profileUserId, checkFollowingStatus]);

  React.useEffect(() => {
    loadProfile();
  }, [profileUserId, loadProfile]);

  // Refresh stats when page becomes visible (user returns from another tab/page)
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && profileUserId) {
        // Page became visible, refresh stats
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

  const openEditDialog = () => {
    if (profile) {
      setEditNickname(profile.nickname);
      setEditBio(profile.bio);
      setEditPhotoPreview(profile.photo);
      setEditPhotoFile(null);
      setIsEditDialogOpen(true);
    }
  };

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

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setEditPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setEditPhotoPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
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
      const routineToDelete = routines.find((r) => r.id === deleteRoutineId);
      if (!routineToDelete) return;

      // Delete the specific routine from the database
      const { error } = await supabase
        .from("routines")
        .delete()
        .eq("id", deleteRoutineId)
        .eq("user_id", user.id);

      if (error) throw error;

      // Update routines list
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

  const handleSaveProfile = async () => {
    if (!user || !profile) return;

    setIsSaving(true);
    try {
      let photoUrl = profile.photo;

      if (editPhotoFile) {
        // Send original file without any modifications
        const extension = editPhotoFile.name.split(".").pop() || "jpg";
        const filePath = `${user.id}/profile-${Date.now()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("posts")
          .upload(filePath, editPhotoFile, {
            contentType: editPhotoFile.type,
          });


        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("posts").getPublicUrl(filePath);
        photoUrl = publicUrl;
      }

      const updatedProfile = await updateUserProfileDb(user.id, {
        nickname: editNickname,
        bio: editBio,
        photo: photoUrl,
      });

      if (updatedProfile) {
        setProfile(updatedProfile);
        toast({
          title: "Perfil atualizado!",
          description: "Suas alterações foram salvas com sucesso.",
        });
        setIsEditDialogOpen(false);
      }
    } catch (err: any) {
      console.error("Error updating profile:", err);
      toast({
        title: "Erro ao atualizar perfil",
        description: err.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
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

  const handleLogout = async () => {
    try {
      await resetSupabaseAuth();
      setIsSettingsOpen(false);
      navigate("/");
      toast({
        title: "Desconectado com sucesso!",
        description: "Você foi desconectado da sua conta.",
      });
    } catch (err: any) {
      console.error("Error logging out:", err);
      toast({
        title: "Erro ao desconectar",
        description: err.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    }
  };

  // Phone formatting function for Brazilian format (XX) XXXXX-XXXX
  const formatPhoneNumber = (value: string): string => {
    // Remove all non-digits
    const cleaned = value.replace(/\D/g, "");

    // Limit to 11 digits (DDD + 9 digit number)
    const limited = cleaned.slice(0, 11);

    // Format: (XX) XXXXX-XXXX
    if (limited.length <= 2) {
      return limited.length > 0 ? `(${limited}` : "";
    } else if (limited.length <= 7) {
      return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
    } else {
      return `(${limited.slice(0, 2)}) ${limited.slice(2, 7)}-${limited.slice(7)}`;
    }
  };

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
      // Delete user profile which should cascade delete related data via RLS
      if (supabase) {
        const { error: deleteError } = await supabase
          .from("profiles")
          .delete()
          .eq("user_id", user.id);

        if (deleteError) throw deleteError;

        // Sign out the user
        await resetSupabaseAuth();
      }

      setIsDeleteAccountOpen(false);
      setIsSettingsOpen(false);
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
          {/* Top row: Avatar and Info with Settings button for own profile */}
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
            <div className="flex gap-4 flex-1 min-w-0">
              {/* Avatar */}
              <div className="shrink-0 relative">
                {profileStories.length > 0 ? (
                  <button
                    onClick={() => {
                      setSelectedProfileStory(profileStories[0]);
                      setIsStoryViewerOpen(true);
                    }}
                    className="rounded-full p-[3px] bg-brand-gradient ring-0 cursor-pointer hover:opacity-90 transition-opacity"
                    title="Ver flow"
                  >
                    {profile.photo ? (
                      <ImageWithFallback
                        src={profile.photo}
                        alt={profile.nickname}
                        fallback="/placeholder.svg"
                        className="h-20 w-20 rounded-full object-cover ring-2 ring-background"
                      />
                    ) : (
                      <div className="h-20 w-20 rounded-full bg-muted ring-2 ring-background" />
                    )}
                  </button>
                ) : profile.photo ? (
                  <ImageWithFallback
                    src={profile.photo}
                    alt={profile.nickname}
                    fallback="/placeholder.svg"
                    className="h-20 w-20 rounded-full object-cover ring-2 ring-border/60"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-muted ring-2 ring-border/60" />
                )}
              </div>

              {/* Info */}
              <div className="space-y-2 flex-1 min-w-0">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-semibold tracking-tight truncate">
                      {profile.nickname}
                    </h1>
                    <UserInsignias userId={profileUserId || ""} showStreak />
                  </div>

                  {/* Level + Points badge */}
                  {stats.points > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      {(() => {
                        const tier =
                          stats.points >= 1000
                            ? { label: "Elite", icon: "💎", bg: "bg-cyan-500/20", text: "text-cyan-300", border: "border-cyan-500/40" }
                            : stats.points >= 500
                            ? { label: "Ouro", icon: "🥇", bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/40" }
                            : stats.points >= 200
                            ? { label: "Prata", icon: "🥈", bg: "bg-slate-400/20", text: "text-slate-300", border: "border-slate-400/40" }
                            : { label: "Bronze", icon: "🥉", bg: "bg-orange-700/20", text: "text-orange-400", border: "border-orange-700/40" };
                        return (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${tier.bg} ${tier.text} ${tier.border}`}>
                            {tier.icon} Nível {stats.level} · {tier.label}
                          </span>
                        );
                      })()}
                      <span className="text-xs text-muted-foreground">{stats.points} pts</span>
                    </div>
                  )}

                  {/* Stats Row - Horizontal inline */}
                  <div className="flex gap-4 mt-2">
                    <div className="flex flex-col items-center">
                      <div className="text-base font-semibold">
                        {stats.postsCount}
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">Posts</div>
                    </div>
                    <button
                      onClick={() => {
                        setShowFollowersModal(true);
                        loadFollowersData();
                      }}
                      className="flex flex-col hover:opacity-80 transition-opacity items-center"
                    >
                      <div className="text-base font-semibold">
                        {stats.followersCount}
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        Seguidores
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setShowFollowingModal(true);
                        loadFollowingData();
                      }}
                      className="flex flex-col hover:opacity-80 transition-opacity items-center"
                    >
                      <div className="text-base font-semibold">
                        {stats.followingCount}
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        Seguindo
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Settings Button - Only show for own profile */}
            {!isViewingOtherProfile && (
              <Drawer open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <Button
                  onClick={() => setIsSettingsOpen(true)}
                  variant="outline"
                  size="sm"
                  className="shrink-0 rounded-full"
                >
                  <Settings className="h-4 w-4" />
                </Button>

                <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter">
                  <DrawerHeader className="shrink-0">
                    <DrawerTitle>Configurações</DrawerTitle>
                  </DrawerHeader>

                  <div className="flex flex-col flex-1 gap-3 overflow-hidden px-4 pb-4">
                    <Drawer
                      open={isEditDialogOpen}
                      onOpenChange={setIsEditDialogOpen}
                    >
                      <Button
                        onClick={openEditDialog}
                        variant="outline"
                        className="gap-2 justify-between"
                      >
                        <span>Editar Perfil</span>
                        <Edit2 className="h-4 w-4" />
                      </Button>

                      <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter">
                        <DrawerHeader className="shrink-0 flex items-center gap-2">
                          <button onClick={() => setIsEditDialogOpen(false)} className="p-1 rounded-full hover:bg-muted transition-colors">
                            <ArrowLeft className="h-5 w-5" />
                          </button>
                          <DrawerTitle>Editar Perfil</DrawerTitle>
                        </DrawerHeader>

                        <div className="flex-1 overflow-y-auto px-4 pb-4">
                          <div className="space-y-4">
                          {/* Photo Preview and Upload */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium">
                              Foto do Perfil
                            </label>
                            <div className="flex items-center gap-4">
                              <div className="h-16 w-16 rounded-full overflow-hidden bg-muted shrink-0">
                                {editPhotoPreview ? (
                                  <img
                                    src={editPhotoPreview}
                                    alt="preview"
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="h-full w-full bg-muted" />
                                )}
                              </div>
                              <label className="flex-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  asChild
                                >
                                  <span>
                                    <Upload className="h-4 w-4 mr-2" />
                                    Alterar foto
                                  </span>
                                </Button>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handlePhotoChange}
                                  className="hidden"
                                />
                              </label>
                            </div>
                          </div>

                          {/* Nickname */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Nome</label>
                            <Input
                              value={editNickname}
                              onChange={(e) => setEditNickname(e.target.value)}
                              placeholder="Seu nome"
                            />
                          </div>

                          {/* Bio */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Bio</label>
                            <Textarea
                              value={editBio}
                              onChange={(e) => setEditBio(e.target.value)}
                              placeholder="Sua bio"
                              className="min-h-24"
                            />
                          </div>

                          {/* Email */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Email</label>
                            <Input
                              type="email"
                              value={user?.email || ""}
                              disabled
                              className="opacity-70"
                            />
                            <p className="text-xs text-muted-foreground">Email não pode ser alterado aqui</p>
                          </div>

                          {/* Password Reset Section */}
                          <div className="border-t pt-4 space-y-2">
                            <label className="text-sm font-medium">Redefinir Senha</label>
                            <Button
                              onClick={async () => {
                                setIsResettingPassword(true);
                                try {
                                  await supabase.auth.resetPasswordForEmail(user?.email || "", {
                                    redirectTo: `${window.location.origin}/reset-password`,
                                  });
                                  toast({
                                    title: "Email enviado",
                                    description: "Verifique seu email para redefinir a senha",
                                  });
                                } catch (error) {
                                  toast({
                                    title: "Erro",
                                    description: "Falha ao enviar email de redefinição",
                                    variant: "destructive",
                                  });
                                } finally {
                                  setIsResettingPassword(false);
                                }
                              }}
                              disabled={isResettingPassword}
                              variant="outline"
                              className="w-full rounded-full"
                            >
                              {isResettingPassword ? "Enviando..." : "Redefinir Senha"}
                            </Button>
                            <p className="text-xs text-muted-foreground">Você receberá um link para redefinir sua senha</p>
                          </div>

                          {/* Restrição de Conta */}
                          <div className="border-t pt-4">
                            <Collapsible open={isDangerZoneOpen} onOpenChange={setIsDangerZoneOpen}>
                              <CollapsibleTrigger asChild>
                                <button className="flex items-center justify-between w-full text-left">
                                  <h3 className="text-sm font-semibold">Restrição de Conta</h3>
                                  <ChevronDown className={`h-4 w-4 transition-transform ${isDangerZoneOpen ? "rotate-180" : ""}`} />
                                </button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="pt-3 space-y-2">
                                <Button
                                  onClick={() => {
                                    setIsEditDialogOpen(false);
                                    setIsDeleteAccountOpen(true);
                                  }}
                                  variant="destructive"
                                  className="w-full rounded-full gap-2"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Encerrar Conta
                                </Button>
                                <p className="text-xs text-muted-foreground">Esta ação é permanente e não pode ser desfeita</p>
                              </CollapsibleContent>
                            </Collapsible>
                          </div>

                          {/* Save Button */}
                          <Button
                            onClick={handleSaveProfile}
                            disabled={isSaving}
                            className="w-full rounded-full"
                          >
                            {isSaving ? "Salvando..." : "Salvar Alterações"}
                          </Button>
                          </div>
                        </div>
                      </DrawerContent>
                    </Drawer>

                    {commercialProfile && (
                      <Button
                        onClick={() => setIsCommercialDashboardOpen(true)}
                        variant="outline"
                        className="gap-2 justify-between"
                      >
                        <span>Gerenciar Perfil Comercial</span>
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                    )}

                    <Drawer
                      open={isCommercialProfileOpen}
                      onOpenChange={setIsCommercialProfileOpen}
                    >
                        <Button
                          onClick={handleOpenCommercialProfile}
                          variant="outline"
                          className="gap-2 justify-between"
                        >
                          <span>Perfil Comercial</span>
                          <span className="text-lg">🏪</span>
                        </Button>

                      <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter">
                        <DrawerHeader className="shrink-0">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setIsCommercialProfileOpen(false)} className="p-1 rounded-full hover:bg-muted transition-colors">
                              <ArrowLeft className="h-5 w-5" />
                            </button>
                            <DrawerTitle>Configurar Perfil Comercial</DrawerTitle>
                          </div>
                        </DrawerHeader>

                        <div className="flex-1 overflow-y-auto px-4 pb-4">
                          <div className="space-y-4">
                          {/* Business Segment */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Segmento *</label>
                            <Select
                              value={commercialFormData.business_segment}
                              onValueChange={(value) =>
                                setCommercialFormData({
                                  ...commercialFormData,
                                  business_segment: value,
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione um segmento" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="academia">Academia / Fitness</SelectItem>
                                <SelectItem value="personal_trainer">Personal Trainer</SelectItem>
                                <SelectItem value="nutricao">Nutrição / Nutricionista</SelectItem>
                                <SelectItem value="psicologia">Psicologia / Coaching</SelectItem>
                                <SelectItem value="outros">Outros</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Business Name */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Nome da Loja / Negócio *</label>
                            <Input
                              value={commercialFormData.business_name}
                              onChange={(e) =>
                                setCommercialFormData({
                                  ...commercialFormData,
                                  business_name: e.target.value,
                                })
                              }
                              placeholder="Ex: Academia Força Total"
                            />
                          </div>

                          {/* Business Description */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Descrição</label>
                            <Textarea
                              value={commercialFormData.business_description}
                              onChange={(e) =>
                                setCommercialFormData({
                                  ...commercialFormData,
                                  business_description: e.target.value,
                                })
                              }
                              placeholder="Descreva seu negócio..."
                              className="min-h-24"
                            />
                          </div>

                          {/* Business Phone */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Telefone</label>
                            <Input
                              type="tel"
                              value={commercialFormData.business_phone}
                              onChange={(e) =>
                                setCommercialFormData({
                                  ...commercialFormData,
                                  business_phone: formatPhoneNumber(e.target.value),
                                })
                              }
                              placeholder="(11) 99999-9999"
                              maxLength={14}
                            />
                          </div>

                          {/* Business Email */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Email</label>
                            <Input
                              type="email"
                              value={commercialFormData.business_email}
                              onChange={(e) =>
                                setCommercialFormData({
                                  ...commercialFormData,
                                  business_email: e.target.value,
                                })
                              }
                              placeholder="contato@negocio.com"
                            />
                          </div>

                          {/* Business Website */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Site / Portfolio</label>
                            <Input
                              type="url"
                              value={commercialFormData.business_website}
                              onChange={(e) =>
                                setCommercialFormData({
                                  ...commercialFormData,
                                  business_website: e.target.value,
                                })
                              }
                              placeholder="https://seu-site.com"
                            />
                          </div>

                          {/* Save Button */}
                          <Button
                            onClick={handleSaveCommercialProfile}
                            disabled={isSavingCommercial || !commercialFormData.business_name}
                            className="w-full rounded-full"
                          >
                            {isSavingCommercial ? "Salvando..." : "Salvar Perfil Comercial"}
                          </Button>
                          </div>
                        </div>
                      </DrawerContent>
                    </Drawer>

                    {/* Languages Drawer */}
                    <Drawer
                      open={isLanguageOpen}
                      onOpenChange={setIsLanguageOpen}
                    >
                      <Button
                        onClick={() => setIsLanguageOpen(true)}
                        variant="outline"
                        className="gap-2 justify-between"
                      >
                        <span>Idioma</span>
                        <Globe className="h-4 w-4" />
                      </Button>

                      <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter">
                        <DrawerHeader className="shrink-0">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setIsLanguageOpen(false)} className="p-1 rounded-full hover:bg-muted transition-colors">
                              <ArrowLeft className="h-5 w-5" />
                            </button>
                            <DrawerTitle>Selecione o Idioma</DrawerTitle>
                          </div>
                        </DrawerHeader>

                        <div className="flex-1 overflow-y-auto px-4 pb-4">
                          <div className="space-y-2">
                          {(["pt", "en"] as const).map((lang) => (
                            <button
                              key={lang}
                              onClick={() => {
                                setCurrentLanguage(lang);
                                setIsLanguageOpen(false);
                                setTimeout(() => window.location.reload(), 300);
                              }}
                              className={`w-full p-3 rounded-lg border text-left transition-colors ${
                                currentLanguage === lang
                                  ? "border-brand bg-brand/10"
                                  : "border-border hover:border-brand/50"
                              }`}
                            >
                              <div className="font-medium">
                                {lang === "pt" ? "Português (Brasil)" : "English"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {lang === "pt" ? "pt-BR" : "en-US"}
                              </div>
                            </button>
                          ))}
                          </div>
                        </div>
                      </DrawerContent>
                    </Drawer>

                    {/* Notifications Drawer */}
                    <Drawer
                      open={isNotificationsOpen}
                      onOpenChange={setIsNotificationsOpen}
                    >
                      <Button
                        onClick={() => setIsNotificationsOpen(true)}
                        variant="outline"
                        className="gap-2 justify-between"
                      >
                        <span>Notificações</span>
                        <Bell className="h-4 w-4" />
                      </Button>

                      <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter">
                        <DrawerHeader className="shrink-0">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setIsNotificationsOpen(false)} className="p-1 rounded-full hover:bg-muted transition-colors">
                              <ArrowLeft className="h-5 w-5" />
                            </button>
                            <DrawerTitle>Configurar Notificações</DrawerTitle>
                          </div>
                        </DrawerHeader>

                        <div className="flex-1 overflow-y-auto px-4 pb-4">
                          <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-border transition-colors">
                            <div>
                              <div className="text-sm font-medium">Lembretes de Treino</div>
                              <div className="text-xs text-muted-foreground">Notificações sobre seus treinos</div>
                            </div>
                            <button
                              onClick={() => setNotifications({...notifications, workoutReminders: !notifications.workoutReminders})}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                notifications.workoutReminders ? "bg-brand" : "bg-muted"
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  notifications.workoutReminders ? "translate-x-6" : "translate-x-1"
                                }`}
                              />
                            </button>
                          </div>

                          <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-border transition-colors">
                            <div>
                              <div className="text-sm font-medium">Alertas de Conquistas</div>
                              <div className="text-xs text-muted-foreground">Notificações sobre suas metas atingidas</div>
                            </div>
                            <button
                              onClick={() => setNotifications({...notifications, achievementAlerts: !notifications.achievementAlerts})}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                notifications.achievementAlerts ? "bg-brand" : "bg-muted"
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  notifications.achievementAlerts ? "translate-x-6" : "translate-x-1"
                                }`}
                              />
                            </button>
                          </div>

                          <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-border transition-colors">
                            <div>
                              <div className="text-sm font-medium">Atividade de Amigos</div>
                              <div className="text-xs text-muted-foreground">Atividades de pessoas que você segue</div>
                            </div>
                            <button
                              onClick={() => setNotifications({...notifications, friendActivity: !notifications.friendActivity})}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                notifications.friendActivity ? "bg-brand" : "bg-muted"
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  notifications.friendActivity ? "translate-x-6" : "translate-x-1"
                                }`}
                              />
                            </button>
                          </div>

                          <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-border transition-colors">
                            <div>
                              <div className="text-sm font-medium">Mensagens</div>
                              <div className="text-xs text-muted-foreground">Notificações de mensagens diretas</div>
                            </div>
                            <button
                              onClick={() => setNotifications({...notifications, messages: !notifications.messages})}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                notifications.messages ? "bg-brand" : "bg-muted"
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  notifications.messages ? "translate-x-6" : "translate-x-1"
                                }`}
                              />
                            </button>
                          </div>

                          <div className="border-t pt-4 mt-4">
                            <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-border transition-colors">
                              <div>
                                <div className="text-sm font-medium">Sons</div>
                                <div className="text-xs text-muted-foreground">Ativar som das notificações</div>
                              </div>
                              <button
                                onClick={() => setNotifications({...notifications, sound: !notifications.sound})}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                  notifications.sound ? "bg-brand" : "bg-muted"
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    notifications.sound ? "translate-x-6" : "translate-x-1"
                                  }`}
                                />
                              </button>
                            </div>
                          </div>
                          </div>
                        </div>
                      </DrawerContent>
                    </Drawer>

                    {/* Time Management Drawer */}
                    <Drawer
                      open={isTimeManagementOpen}
                      onOpenChange={setIsTimeManagementOpen}
                    >
                      <Button
                        onClick={() => setIsTimeManagementOpen(true)}
                        variant="outline"
                        className="gap-2 justify-between"
                      >
                        <span>Gerenciamento de Tempo</span>
                        <BarChart3 className="h-4 w-4" />
                      </Button>

                      <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter">
                        <DrawerHeader className="shrink-0">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setIsTimeManagementOpen(false)} className="p-1 rounded-full hover:bg-muted transition-colors">
                              <ArrowLeft className="h-5 w-5" />
                            </button>
                            <DrawerTitle>Gerenciamento de Tempo</DrawerTitle>
                          </div>
                        </DrawerHeader>

                        <div className="flex-1 overflow-y-auto px-4 pb-4">
                          <div className="space-y-4">
                          {/* Usage Chart */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Uso nos Últimos 7 Dias</label>
                            <div className="p-4 rounded-lg border border-border/50 bg-muted/20">
                              <div className="flex items-end justify-between gap-2 h-32">
                                {usageDataLast7Days.map((data, idx) => {
                                  const maxMinutes = Math.max(...usageDataLast7Days.map(d => d.minutes));
                                  const heightPercent = (data.minutes / maxMinutes) * 100;
                                  return (
                                    <div key={idx} className="flex flex-col items-center gap-1 flex-1">
                                      <div className="w-full bg-brand rounded-t" style={{height: `${heightPercent}%`}} />
                                      <div className="text-xs text-muted-foreground">{data.day}</div>
                                      <div className="text-xs font-semibold">{data.minutes}m</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          {/* Daily Limit */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Limite Diário de Uso</label>
                            <div className="flex gap-2">
                              <Input
                                type="number"
                                min="0"
                                value={dailyUsageLimit}
                                onChange={(e) => setDailyUsageLimit(parseInt(e.target.value) || 0)}
                                placeholder="Minutos por dia (0 = sem limite)"
                                className="flex-1"
                              />
                              <span className="text-sm text-muted-foreground py-2">min</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {dailyUsageLimit === 0 ? "Sem limite estabelecido" : `Você poderá usar ${dailyUsageLimit} minutos por dia`}
                            </p>
                          </div>

                          <Button
                            onClick={() => {
                              if (dailyUsageLimit > 0) {
                                localStorage.setItem("ritmofit_daily_limit_minutes", String(dailyUsageLimit));
                                localStorage.setItem("ritmofit_daily_limit_date", new Date().toDateString());
                              } else {
                                localStorage.removeItem("ritmofit_daily_limit_minutes");
                                localStorage.removeItem("ritmofit_daily_limit_date");
                              }
                              toast({
                                title: "Limite salvo",
                                description: dailyUsageLimit > 0 ? `Limite de ${dailyUsageLimit} min/dia ativado` : "Limite removido",
                              });
                              setIsTimeManagementOpen(false);
                            }}
                            className="w-full rounded-full"
                          >
                            Salvar Limite
                          </Button>
                          </div>
                        </div>
                      </DrawerContent>
                    </Drawer>

                    {/* Personalization Drawer */}
                    <Drawer
                      open={isPersonalizationOpen}
                      onOpenChange={setIsPersonalizationOpen}
                    >
                      <Button
                        onClick={() => setIsPersonalizationOpen(true)}
                        variant="outline"
                        className="gap-2 justify-between"
                      >
                        <span>Personalização</span>
                        <span>🎨</span>
                      </Button>

                      <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter">
                        <DrawerHeader className="shrink-0">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setIsPersonalizationOpen(false)} className="p-1 rounded-full hover:bg-muted transition-colors">
                              <ArrowLeft className="h-5 w-5" />
                            </button>
                            <DrawerTitle>Personalização</DrawerTitle>
                          </div>
                        </DrawerHeader>

                        <div className="flex-1 overflow-y-auto px-4 pb-4">
                          <div className="space-y-2">
                          <Button
                            onClick={() => {
                              toggleLayoutMode();
                              window.location.reload();
                            }}
                            variant="outline"
                            className="w-full rounded-full gap-2"
                          >
                            <span>📐</span>
                            {layoutMode === "novo" ? "Layout Antigo" : "Novo Layout"}
                          </Button>

                          <Button
                            onClick={() => setTheme(isDark ? "light" : "dark")}
                            variant="outline"
                            className="w-full rounded-full gap-2"
                          >
                            {isDark ? (
                              <Sun className="h-4 w-4" />
                            ) : (
                              <Moon className="h-4 w-4" />
                            )}
                            {isDark ? "Modo Claro" : "Modo Noturno"}
                          </Button>
                          </div>
                        </div>
                      </DrawerContent>
                    </Drawer>

                    <Button
                      onClick={handleLogout}
                      variant="destructive"
                      className="gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      Desconectar
                    </Button>
                  </div>
                </DrawerContent>
              </Drawer>
            )}
            </div>

            {/* Bio and Commercial Profile - Below avatar, left-aligned */}
            <div className="space-y-2">
              {profile.bio && (
                <p className="text-sm text-muted-foreground">
                  {profile.bio}
                </p>
              )}

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
                        {commercialProfile.business_segment === "nutricao" && "Nutrição / Nutricionista"}
                        {commercialProfile.business_segment === "psicologia" && "Psicologia / Coaching"}
                        {commercialProfile.business_segment === "outros" && "Outros"}
                      </div>
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
          </div>


          {/* Action Buttons - Below stats, centered */}
          {isViewingOtherProfile && (
            <div className="flex gap-2 justify-center">
              {/* Follow/Unfollow Button */}
              <Button
                onClick={handleFollowUnfollow}
                disabled={isFollowingLoading}
                variant={isFollowing ? "outline" : "default"}
                size="sm"
                className="rounded-full gap-2"
              >
                {isFollowing ? (
                  <>
                    <Check className="h-4 w-4" />
                    Seguindo
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Seguir
                  </>
                )}
              </Button>

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
                  if (navigator.share) {
                    navigator.share({ text }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(text).catch(() => {});
                    toast({ title: "Copiado!", description: "Link copiado para a área de transferência." });
                  }
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
                  if (navigator.share) {
                    navigator.share({ text }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(text).catch(() => {});
                    toast({ title: "Copiado!", description: "Texto copiado para a área de transferência." });
                  }
                }}
              >
                <Share2 className="h-3.5 w-3.5" />
                Compartilhar perfil
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Posts, Shots and Routines Tabs */}
      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="posts" className="flex items-center gap-1.5">
            <Grid3X3 className="h-4 w-4" />
            Posts ({stats.postsCount})
          </TabsTrigger>
          <TabsTrigger value="shots" className="flex items-center gap-1.5">
            <Film className="h-4 w-4" />
            Shots ({shots.length})
          </TabsTrigger>
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
                    onClick={() => navigate(`/shots`)}
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
                        setEditShotDescription(shot.description);
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
            <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter">
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
                                  className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                                    selectedMuscleGroups.has(muscleGroup)
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
                                  className={`w-full p-3 border-2 rounded-lg transition-all text-left group ${
                                    isSelected
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
                                        className={`font-medium text-sm transition-colors ${
                                          isSelected
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
                    <div className="sticky bottom-0 left-0 right-0 pt-4 border-t border-border/60 bg-background">
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
                              className={`w-full p-4 border-2 rounded-lg transition-all text-left group ${
                                isSelected ? "border-brand bg-brand/5" : "border-border/60 hover:border-border/80 hover:bg-muted/50"
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
                    <div className="sticky bottom-0 left-0 right-0 pt-4 border-t border-border/60 bg-background">
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
                            className={`w-full p-4 border-2 rounded-lg transition-all text-left space-y-2 group ${
                              isSelected
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
                                  className={`font-medium transition-colors ${
                                    isSelected
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
                    <div className="sticky bottom-0 left-0 right-0 pt-4 border-t border-border/60 bg-background">
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
                          className={`shrink-0 p-2 rounded-lg transition-all ${
                            routinesOfType[0]?.goal_id
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

                        <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter">
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
                        className={`transform transition-transform ${
                          isExpanded ? "rotate-180" : ""
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
      </Tabs>

      {/* Post Viewer Drawer */}
      <Drawer open={isPostViewerOpen} onOpenChange={setIsPostViewerOpen}>
        <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>
              {isEditingPost ? "Editar Post" : "Visualizar Post"}
            </DrawerTitle>
          </DrawerHeader>

          {selectedPost && (
            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
              {/* Post Images Carousel */}
              {selectedPost.photos && selectedPost.photos.length > 0 ? (
                <PostCarousel photos={selectedPost.photos} alt={selectedPost.description} />
              ) : (
                <div className="relative aspect-square overflow-hidden rounded-lg bg-muted border border-border/60">
                  <img
                    src={selectedPost.photo}
                    alt={selectedPost.description}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Post author with insignias */}
              <div className="flex items-center gap-2">
                {selectedPost.userPhoto ? (
                  <ImageWithFallback
                    src={selectedPost.userPhoto}
                    alt={selectedPost.userNickname}
                    fallback="/placeholder.svg"
                    className="h-8 w-8 rounded-full object-cover border border-border/60"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-muted" />
                )}
                <span className="text-sm font-medium">{selectedPost.userNickname}</span>
                <UserInsignias userId={selectedPost.user_id} maxBadges={3} />
              </div>

              {/* Description */}
              {isEditingPost ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Descrição</label>
                  <Textarea
                    value={editPostDescription}
                    onChange={(e) => setEditPostDescription(e.target.value)}
                    className="resize-none"
                    rows={4}
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Descrição
                  </label>
                  <p className="text-sm mt-1">{selectedPost.description}</p>
                </div>
              )}

              {/* Goal Selection */}
              {isEditingPost ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Meta Vinculada</label>
                  {userGoals.length > 0 ? (
                    <div className="space-y-2">
                      <Select value={editPostGoalId} onValueChange={setEditPostGoalId}>
                        <SelectTrigger className="rounded-lg">
                          <SelectValue placeholder="Selecione uma meta ou deixe em branco" />
                        </SelectTrigger>
                        <SelectContent>
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
                    <p className="text-sm text-muted-foreground">
                      Nenhuma meta criada
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Meta Vinculada
                  </label>
                  <p className="text-sm mt-1">
                    {selectedPost.user_goal_id
                      ? userGoals.find((g) => g.id === selectedPost.user_goal_id)
                          ?.description || "Meta removida"
                      : "Nenhuma meta"}
                  </p>
                </div>
              )}

              {/* Incentives and Comments */}
              {!isLoadingPostData && (
                <div className="flex gap-4 pt-2">
                  {postLikes.length > 0 && (
                    <button
                      onClick={() => setIsLikesModalOpen(true)}
                      className="flex items-center gap-2 text-sm hover:opacity-70 transition-opacity"
                    >
                      <Heart className="h-5 w-5 text-red-500 fill-red-500" />
                      <span className="font-medium">{postLikes.length} incentivos</span>
                    </button>
                  )}
                  {selectedPost && (
                    <PostCommentsDialog
                      postId={selectedPost.id}
                      commentCount={postComments.length}
                      isPostOwner={!isViewingOtherProfile}
                    />
                  )}
                </div>
              )}

              {/* Action Buttons */}
              {!isViewingOtherProfile && (
                <div className="flex gap-2 pt-4">
                  {!isEditingPost ? (
                    <>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setIsEditingPost(true)}
                      >
                        <Edit2 className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
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
                        className="flex-1"
                        onClick={() => setIsEditingPost(false)}
                        disabled={isUpdatingPost}
                      >
                        Cancelar
                      </Button>
                      <Button
                        className="flex-1"
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
      <Drawer open={showFollowersModal} onOpenChange={setShowFollowersModal}>
        <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>Seguidores</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-6">
            {isLoadingFollowers ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Carregando...
              </div>
            ) : followers.length > 0 ? (
              followers.map((follower) => (
                <div
                  key={follower.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <button
                    onClick={() => {
                      setShowFollowersModal(false);
                      navigate(`/usuario/${follower.id}`);
                    }}
                    className="flex items-center gap-3 flex-1 text-left hover:opacity-80 transition-opacity"
                  >
                    {follower.photo ? (
                      <img
                        src={follower.photo}
                        alt={follower.nickname}
                        className="h-10 w-10 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-muted flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{follower.nickname}</p>
                    </div>
                  </button>
                  {follower.id !== user?.id && (
                    <Button
                      onClick={(e) => handleToggleFollowInModal(follower.id, e)}
                      disabled={isTogglingFollow[follower.id] || false}
                      variant={followerFollowStatus[follower.id] ? "outline" : "default"}
                      size="sm"
                      className="flex-shrink-0"
                    >
                      {isTogglingFollow[follower.id] ? (
                        "..."
                      ) : followerFollowStatus[follower.id] ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Seguindo
                        </>
                      ) : (
                        "Seguir"
                      )}
                    </Button>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Nenhum seguidor ainda
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Following Drawer */}
      <Drawer open={showFollowingModal} onOpenChange={setShowFollowingModal}>
        <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>Seguindo</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-6">
            {isLoadingFollowers ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Carregando...
              </div>
            ) : following.length > 0 ? (
              following.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <button
                    onClick={() => {
                      setShowFollowingModal(false);
                      navigate(`/usuario/${user.id}`);
                    }}
                    className="flex items-center gap-3 flex-1 text-left hover:opacity-80 transition-opacity"
                  >
                    {user.photo ? (
                      <img
                        src={user.photo}
                        alt={user.nickname}
                        className="h-10 w-10 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-muted flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{user.nickname}</p>
                    </div>
                  </button>
                  <Button
                    onClick={(e) => handleToggleFollowInModal(user.id, e)}
                    disabled={isTogglingFollow[user.id] || false}
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0"
                  >
                    {isTogglingFollow[user.id] ? (
                      "..."
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Seguindo
                      </>
                    )}
                  </Button>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Não está seguindo ninguém
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Shot Editor Drawer */}
      <Drawer open={isShotEditorOpen} onOpenChange={setIsShotEditorOpen}>
        <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>
              {isEditingShot ? "Editar Shot" : "Opções do Shot"}
            </DrawerTitle>
          </DrawerHeader>

          {selectedShot && (
            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
              {/* Shot Video Preview */}
              <div className="relative aspect-square overflow-hidden rounded-lg bg-black border border-border/60">
                <video
                  src={selectedShot.video_url}
                  className="w-full h-full object-cover"
                  controls
                />
              </div>

              {/* Description */}
              {isEditingShot ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Descrição</label>
                  <Textarea
                    value={editShotDescription}
                    onChange={(e) => setEditShotDescription(e.target.value)}
                    className="resize-none"
                    rows={4}
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Descrição
                  </label>
                  <p className="text-sm mt-1">{selectedShot.description}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                {!isEditingShot ? (
                  <>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setIsEditingShot(true)}
                    >
                      <Edit2 className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={handleDeleteShot}
                      disabled={isUpdatingShot}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Deletar
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setIsEditingShot(false);
                        setEditShotDescription(selectedShot.description);
                      }}
                      disabled={isUpdatingShot}
                    >
                      Cancelar
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleUpdateShot}
                      disabled={isUpdatingShot}
                    >
                      {isUpdatingShot ? "Salvando..." : "Salvar"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* Delete Routine Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="max-w-sm">
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
      {selectedWorkoutForHistory && (
        <Drawer open={workoutHistoryModalOpen} onOpenChange={setWorkoutHistoryModalOpen}>
          <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter">
            <DrawerHeader className="shrink-0">
              <DrawerTitle>
                Histórico de {selectedWorkoutForHistory?.name || "Exercício"}
              </DrawerTitle>
            </DrawerHeader>

            <div className="flex-1 overflow-y-auto px-4 pb-6">
              {isLoadingWorkoutHistory ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  Carregando histórico...
                </div>
              ) : workoutHistory.length > 0 ? (
                (() => {
                  // Group records by day
                  const groupedByDay: Record<string, typeof workoutHistory> = {};
                  workoutHistory.forEach((record) => {
                    const date = new Date(record.createdAt);
                    const dateKey = date.toLocaleDateString("pt-BR");
                    if (!groupedByDay[dateKey]) {
                      groupedByDay[dateKey] = [];
                    }
                    groupedByDay[dateKey].push(record);
                  });

                  // Sort days in descending order (newest first)
                  const sortedDates = Object.keys(groupedByDay).sort((a, b) => {
                    const dateA = new Date(a.split("/").reverse().join("-"));
                    const dateB = new Date(b.split("/").reverse().join("-"));
                    return dateB.getTime() - dateA.getTime();
                  });

                  return sortedDates.map((dateKey) => {
                    const dayRecords = groupedByDay[dateKey];
                    const totalKilos = dayRecords
                      .reduce((sum, r) => sum + (r.kilos || 0), 0);
                    const totalReps = dayRecords.length;

                    return (
                      <div key={dateKey} className="mb-6">
                        {/* Date Header */}
                        <div className="sticky top-0 bg-background/95 py-2 mb-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase">
                            {dateKey}
                          </p>
                          <div className="flex gap-4 mt-1">
                            <div>
                              <p className="text-xs text-muted-foreground">
                                {totalReps} série(s)
                              </p>
                            </div>
                            {totalKilos > 0 && (
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  {totalKilos} kg total
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Records for this day */}
                        <div className="space-y-1">
                          {dayRecords.map((record) => {
                            const time = new Date(record.createdAt).toLocaleTimeString(
                              "pt-BR",
                              { hour: "2-digit", minute: "2-digit" }
                            );
                            return (
                              <div
                                key={record.id || `${record.createdAt}-${record.kilos}`}
                                className="flex items-center justify-between p-2 rounded hover:bg-muted/40 transition-colors"
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <p className="text-xs text-muted-foreground w-10">
                                    {time}
                                  </p>
                                  <div className="flex gap-2 flex-1 min-w-0 overflow-x-auto">
                                    {record.kilos && (
                                      <span className="text-xs font-medium px-2 py-1 bg-muted/50 rounded whitespace-nowrap">
                                        {record.kilos} kg
                                      </span>
                                    )}
                                    {record.volume && (
                                      <span className="text-xs font-medium px-2 py-1 bg-muted/50 rounded whitespace-nowrap">
                                        {record.volume}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()
              ) : (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  Nenhum registro de treino encontrado
                </div>
              )}
            </div>
          </DrawerContent>
        </Drawer>
      )}

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
        <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter">
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
      <Drawer open={isCommercialDashboardOpen} onOpenChange={setIsCommercialDashboardOpen}>
        <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>🏪 {commercialProfile?.business_name || "Perfil Comercial"}</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-5">
            {/* Segment badge */}
            {commercialProfile?.business_segment && (
              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-1 rounded-full bg-brand/20 text-brand font-medium">
                  {commercialProfile.business_segment === "academia" && "Academia / Fitness"}
                  {commercialProfile.business_segment === "personal_trainer" && "Personal Trainer"}
                  {commercialProfile.business_segment === "nutricao" && "Nutrição / Nutricionista"}
                  {commercialProfile.business_segment === "psicologia" && "Psicologia / Coaching"}
                  {commercialProfile.business_segment === "outros" && "Outros"}
                </span>
              </div>
            )}

            {/* Key metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 flex flex-col items-center gap-1">
                <p className="text-2xl font-bold text-foreground">{stats.followersCount}</p>
                <p className="text-xs text-muted-foreground text-center">Seguidores</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 flex flex-col items-center gap-1">
                <p className="text-2xl font-bold text-foreground">{stats.postsCount}</p>
                <p className="text-xs text-muted-foreground text-center">Posts</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 flex flex-col items-center gap-1">
                <p className="text-2xl font-bold text-foreground">{stats.followingCount}</p>
                <p className="text-xs text-muted-foreground text-center">Seguindo</p>
              </div>
            </div>

            {/* Engagement */}
            <div>
              <p className="text-sm font-semibold mb-2">Engajamento</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
                  <span className="text-sm text-muted-foreground">Nível da conta</span>
                  <span className="text-sm font-medium">Nível {stats.level}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
                  <span className="text-sm text-muted-foreground">Pontos totais</span>
                  <span className="text-sm font-medium">{stats.points} pts</span>
                </div>
                {stats.postsCount > 0 && (
                  <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
                    <span className="text-sm text-muted-foreground">Média seguidores/post</span>
                    <span className="text-sm font-medium">
                      {(stats.followersCount / stats.postsCount).toFixed(1)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Contact info */}
            {(commercialProfile?.business_phone || commercialProfile?.business_email || commercialProfile?.business_website) && (
              <div>
                <p className="text-sm font-semibold mb-2">Informações de Contato</p>
                <div className="space-y-2">
                  {commercialProfile?.business_phone && (
                    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
                      <span className="text-sm text-muted-foreground">Telefone</span>
                      <span className="text-sm font-medium">{commercialProfile.business_phone}</span>
                    </div>
                  )}
                  {commercialProfile?.business_email && (
                    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
                      <span className="text-sm text-muted-foreground">E-mail</span>
                      <span className="text-sm font-medium">{commercialProfile.business_email}</span>
                    </div>
                  )}
                  {commercialProfile?.business_website && (
                    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
                      <span className="text-sm text-muted-foreground">Website</span>
                      <a href={commercialProfile.business_website} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-brand hover:underline">
                        {commercialProfile.business_website.replace(/^https?:\/\//, "")}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {commercialProfile?.business_description && (
              <div>
                <p className="text-sm font-semibold mb-2">Descrição do Negócio</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{commercialProfile.business_description}</p>
              </div>
            )}

            <div className="pt-2">
              <p className="text-xs text-muted-foreground text-center">
                Perfil ativo desde {new Date(commercialProfile?.created_at || "").toLocaleDateString("pt-BR")}
              </p>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
