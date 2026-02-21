import * as React from "react";
import {
  getUserProfileDb,
  getUserPostsDb,
  getUserStatsDb,
  updateUserProfileDb,
  getUserRoutinesDb,
  createRoutineDb,
  createUserWorkoutsDb,
  getUserWorkoutsDb,
  getWorkoutsDb,
  getDietsDb,
  createUserDietsDb,
  getUserDietsDb,
  getHabitsDb,
  createUserHabitsDb,
  getUserHabitsDb,
  ROUTINE_TYPES,
  getRoutineTypeName,
  getGoalByIdDb,
  updateRoutineGoalDb,
  getUserGoalsDb,
  getFollowersDb,
  getFollowingDb,
  getUserReelsDb,
  deletePostDb,
  updatePostDb,
  deleteReelDb,
  updateReelDb,
  getPostLikeUsersDb,
  getPostCommentsDb,
  followUserDb,
  unfollowUserDb,
  isFollowingDb,
  getCommercialProfileDb,
  createOrUpdateCommercialProfileDb,
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
  type ReelWithUser,
  type CommercialProfile,
} from "@/lib/ritmofit-db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageWithFallback } from "@/components/image-with-fallback";
import { PostLikesModal } from "@/components/post-likes-modal";
import { PostCommentsDialog } from "@/components/post-comments-dialog";
import { UserInsignias } from "@/components/user-insignias";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
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
import { useLayoutMode } from "@/hooks/useLayoutMode";
import {
  Users,
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
  MessageCircle,
  UserPlus,
  MessageSquare,
} from "lucide-react";
import { hasSupabaseConfig, supabase, resetSupabaseAuth } from "@/lib/supabase";
import { useNavigate, useParams } from "react-router-dom";
import { useTheme } from "next-themes";

export default function Profile() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { userId } = useParams<{ userId?: string }>();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isDark = (resolvedTheme ?? theme) === "dark";
  const { layoutMode, toggleLayoutMode } = useLayoutMode();
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);

  // Determine if we're viewing another user's profile
  const isViewingOtherProfile = !!userId && userId !== user?.id;
  const profileUserId = userId || user?.id;

  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [posts, setPosts] = React.useState<PostWithUser[]>([]);
  const [reels, setReels] = React.useState<ReelWithUser[]>([]);
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
  const [selectedReel, setSelectedReel] = React.useState<ReelWithUser | null>(null);
  const [isReelEditorOpen, setIsReelEditorOpen] = React.useState(false);
  const [isEditingReel, setIsEditingReel] = React.useState(false);
  const [editReelDescription, setEditReelDescription] = React.useState("");
  const [isUpdatingReel, setIsUpdatingReel] = React.useState(false);
  const [isFollowing, setIsFollowing] = React.useState(false);
  const [isFollowingLoading, setIsFollowingLoading] = React.useState(false);
  const [stats, setStats] = React.useState<UserStats>({
    postsCount: 0,
    followersCount: 0,
    followingCount: 0,
  });
  const [loading, setLoading] = React.useState(true);
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
  const [userWorkouts, setUserWorkouts] = React.useState<
    UserWorkoutWithDetails[]
  >([]);
  const [diets, setDiets] = React.useState<Diet[]>([]);
  const [dietsLoading, setDietsLoading] = React.useState(false);
  const [selectedDietIds, setSelectedDietIds] = React.useState<Set<string>>(
    new Set(),
  );
  const [isSavingDiets, setIsSavingDiets] = React.useState(false);
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
  const [goalIndicatorRoutine, setGoalIndicatorRoutine] =
    React.useState<Routine | null>(null);
  const [linkedGoal, setLinkedGoal] = React.useState<UserGoal | null>(null);
  const [userGoals, setUserGoals] = React.useState<UserGoal[]>([]);
  const [isUpdatingGoal, setIsUpdatingGoal] = React.useState(false);
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

  // Delete account state
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("");

  const loadProfile = React.useCallback(async () => {
    if (!profileUserId) return;

    try {
      const [
        profileData,
        postsData,
        statsData,
        routinesData,
        userWorkoutsData,
        userDietsData,
        userHabitsData,
        userGoalsData,
        reelsData,
      ] = await Promise.all([
        getUserProfileDb(profileUserId),
        getUserPostsDb(profileUserId),
        getUserStatsDb(profileUserId),
        getUserRoutinesDb(profileUserId),
        getUserWorkoutsDb(profileUserId),
        getUserDietsDb(profileUserId),
        getUserHabitsDb(profileUserId),
        getUserGoalsDb(),
        getUserReelsDb(profileUserId),
      ]);

      setProfile(profileData);
      setPosts(postsData);
      setStats(statsData);
      setRoutines(routinesData);
      setUserWorkouts(userWorkoutsData);
      setUserDiets(userDietsData);
      setUserHabits(userHabitsData);
      setUserGoals(userGoalsData);
      setReels(reelsData);
    } catch (err: any) {
      console.error("Error loading profile:", err);
      toast({
        title: "Erro ao carregar perfil",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
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

  const handleDeletePost = React.useCallback(async () => {
    if (!selectedPost) return;

    if (!confirm("Tem certeza que deseja deletar este post?")) return;

    setIsUpdatingPost(true);
    try {
      await deletePostDb(selectedPost.id);

      // Update local posts list
      setPosts((prevPosts) => prevPosts.filter((p) => p.id !== selectedPost.id));

      setIsPostViewerOpen(false);
      setSelectedPost(null);

      toast({
        title: "Sucesso!",
        description: "Post deletado com sucesso.",
      });
    } catch (err: any) {
      console.error("Error deleting post:", err);
      toast({
        title: "Erro ao deletar",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingPost(false);
    }
  }, [selectedPost]);

  const handleUpdateReel = React.useCallback(async () => {
    if (!selectedReel) return;

    setIsUpdatingReel(true);
    try {
      const success = await updateReelDb(selectedReel.id, editReelDescription);

      if (success) {
        // Update local reels list
        setReels((prevReels) =>
          prevReels.map((r) =>
            r.id === selectedReel.id
              ? { ...r, description: editReelDescription }
              : r
          )
        );

        setIsReelEditorOpen(false);
        setSelectedReel(null);

        toast({
          title: "Sucesso!",
          description: "Reel atualizado com sucesso.",
        });
      } else {
        toast({
          title: "Erro ao atualizar",
          description: "Tente novamente.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("Error updating reel:", err);
      toast({
        title: "Erro ao atualizar",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingReel(false);
    }
  }, [selectedReel, editReelDescription]);

  const handleDeleteReel = React.useCallback(async () => {
    if (!selectedReel) return;

    if (!confirm("Tem certeza que deseja deletar este reel?")) return;

    setIsUpdatingReel(true);
    try {
      await deleteReelDb(selectedReel.id);

      // Update local reels list
      setReels((prevReels) => prevReels.filter((r) => r.id !== selectedReel.id));

      setIsReelEditorOpen(false);
      setSelectedReel(null);

      toast({
        title: "Sucesso!",
        description: "Reel deletado com sucesso.",
      });
    } catch (err: any) {
      console.error("Error deleting reel:", err);
      toast({
        title: "Erro ao deletar",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingReel(false);
    }
  }, [selectedReel]);

  // Define callback functions first
  const loadFollowersData = React.useCallback(async () => {
    setIsLoadingFollowers(true);
    try {
      const data = await getFollowersDb();
      setFollowers(data);

      // Load follow status for each follower
      const statusMap: Record<string, boolean> = {};
      for (const follower of data) {
        try {
          const isFollowingThisUser = await isFollowingDb(follower.id);
          statusMap[follower.id] = isFollowingThisUser;
        } catch (err) {
          console.error(`Error checking follow status for ${follower.id}:`, err);
          statusMap[follower.id] = false;
        }
      }
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
  }, []);

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

  const handleFollowUnfollow = React.useCallback(async () => {
    if (!profileUserId) return;

    if (isFollowing) {
      // Unfollow
      if (!confirm("Tem certeza que deseja parar de seguir este usuário?")) return;
    }

    setIsFollowingLoading(true);
    try {
      const success = isFollowing
        ? await unfollowUserDb(profileUserId)
        : await followUserDb(profileUserId);

      if (success) {
        setIsFollowing(!isFollowing);
        toast({
          title: "Sucesso!",
          description: isFollowing
            ? "Você deixou de seguir este usuário."
            : "Você está seguindo este usuário.",
        });
      } else {
        toast({
          title: "Erro",
          description: "Tente novamente.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("Error toggling follow:", err);
      toast({
        title: "Erro",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsFollowingLoading(false);
    }
  }, [profileUserId, isFollowing]);

  const handleToggleFollowInModal = React.useCallback(async (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const isCurrentlyFollowing = followerFollowStatus[userId] || false;

    if (isCurrentlyFollowing) {
      if (!confirm("Tem certeza que deseja parar de seguir este usuário?")) return;
    }

    setIsTogglingFollow((prev) => ({ ...prev, [userId]: true }));
    try {
      const success = isCurrentlyFollowing
        ? await unfollowUserDb(userId)
        : await followUserDb(userId);

      if (success) {
        setFollowerFollowStatus((prev) => ({
          ...prev,
          [userId]: !isCurrentlyFollowing,
        }));
        toast({
          title: "Sucesso!",
          description: isCurrentlyFollowing
            ? "Você deixou de seguir este usuário."
            : "Você está seguindo este usuário.",
        });
      } else {
        toast({
          title: "Erro",
          description: "Tente novamente.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("Error toggling follow:", err);
      toast({
        title: "Erro",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsTogglingFollow((prev) => ({ ...prev, [userId]: false }));
    }
  }, [followerFollowStatus]);

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
    setGoalIndicatorRoutine(routine);

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
          .upload(filePath, new Blob([file], { type: file.type }), {
            contentType: file.type,
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

    // If Exercicios is selected, load workouts
    if (type === 1) {
      setWorkoutsLoading(true);
      try {
        const workoutsData = await getWorkoutsDb();
        setWorkouts(workoutsData);
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
      // If Dietas is selected, load diets
      setDietsLoading(true);
      try {
        const dietsData = await getDietsDb();
        setDiets(dietsData);
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

  const handleCreateRoutine = async (workoutId?: string) => {
    if (!user || selectedRoutineType === null) return;

    setIsCreatingRoutine(true);
    try {
      const newRoutine = await createRoutineDb(
        user.id,
        selectedRoutineType,
        workoutId,
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
      <div className="p-6 text-sm text-muted-foreground">
        Carregando perfil...
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
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-4 flex-1 min-w-0">
              {/* Avatar */}
              <div className="shrink-0 relative">
                {profile.photo ? (
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
              <div className="space-y-3 flex-1 min-w-0">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-semibold tracking-tight truncate">
                      {profile.nickname}
                    </h1>
                    <UserInsignias userId={profileUserId || ""} />
                  </div>
                  {profile.bio && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {profile.bio}
                    </p>
                  )}
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

                <DrawerContent className="max-h-[90dvh] flex flex-col">
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
                        className="w-full rounded-full gap-2"
                      >
                        <Edit2 className="h-4 w-4" />
                        Editar Perfil
                      </Button>

                      <DrawerContent className="max-h-[90dvh] flex flex-col">
                        <DrawerHeader className="shrink-0">
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

                    <Drawer
                      open={isCommercialProfileOpen}
                      onOpenChange={setIsCommercialProfileOpen}
                    >
                        <Button
                          onClick={handleOpenCommercialProfile}
                          variant="outline"
                          className="w-full rounded-full gap-2"
                        >
                          <span className="text-lg">🏪</span>
                          Perfil Comercial
                        </Button>

                      <DrawerContent className="max-h-[90dvh] flex flex-col">
                        <DrawerHeader className="shrink-0">
                          <DrawerTitle>Configurar Perfil Comercial</DrawerTitle>
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

                    <Button
                      onClick={() => {
                        toggleLayoutMode();
                        window.location.reload();
                      }}
                      variant="outline"
                      className="w-full rounded-full gap-2"
                    >
                      <span>🎨</span>
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

                    <Button
                      onClick={handleLogout}
                      variant="destructive"
                      className="w-full rounded-full gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      Desconectar
                    </Button>

                    <Dialog
                      open={isDeleteAccountOpen}
                      onOpenChange={setIsDeleteAccountOpen}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="destructive"
                          className="w-full rounded-full gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          Encerrar Conta
                        </Button>
                      </DialogTrigger>

                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle className="text-red-600">Encerrar Conta</DialogTitle>
                          <DialogDescription>
                            Esta ação não pode ser desfeita. Todos os seus dados serão permanentemente deletados.
                          </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                          <p className="text-sm text-muted-foreground">
                            Para confirmar a exclusão da sua conta, digite "DELETAR CONTA" no campo abaixo:
                          </p>
                          <Input
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            placeholder="DELETAR CONTA"
                            className="uppercase"
                          />
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={() => setIsDeleteAccountOpen(false)}
                            variant="outline"
                            className="w-full rounded-full"
                          >
                            Cancelar
                          </Button>
                          <Button
                            onClick={handleDeleteAccount}
                            disabled={isDeleting || deleteConfirmText !== "DELETAR CONTA"}
                            variant="destructive"
                            className="w-full rounded-full"
                          >
                            {isDeleting ? "Deletando..." : "Confirmar Exclusão"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </DrawerContent>
              </Drawer>
            )}
          </div>

          {/* Stats Row - Centered */}
          <div className="flex gap-3 sm:gap-6 justify-center">
            <div className="flex flex-col items-center space-y-0.5">
              <div className="text-base sm:text-lg font-semibold">
                {stats.postsCount}
              </div>
              <div className="text-xs text-muted-foreground whitespace-nowrap">Posts</div>
            </div>
            <button
              onClick={() => {
                setShowFollowersModal(true);
                loadFollowersData();
              }}
              className="flex flex-col items-center space-y-0.5 hover:opacity-80 transition-opacity"
            >
              <div className="text-base sm:text-lg font-semibold">
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
              className="flex flex-col items-center space-y-0.5 hover:opacity-80 transition-opacity"
            >
              <div className="text-base sm:text-lg font-semibold">
                {stats.followingCount}
              </div>
              <div className="text-xs text-muted-foreground whitespace-nowrap">
                Seguindo
              </div>
            </button>
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Posts, Reels and Routines Tabs */}
      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="posts">Posts ({stats.postsCount})</TabsTrigger>
          <TabsTrigger value="reels">Reels ({reels.length})</TabsTrigger>
          <TabsTrigger value="routines">Rotinas</TabsTrigger>
        </TabsList>

        {/* Posts Tab */}
        <TabsContent value="posts" className="space-y-4">
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

        {/* Reels Tab */}
        <TabsContent value="reels" className="space-y-4">
          {reels.length > 0 ? (
            <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {reels.map((reel) => (
                <div
                  key={reel.id}
                  className="group relative aspect-square overflow-hidden rounded-lg bg-black border border-border/60 hover:border-border/80 transition-all"
                >
                  <button
                    onClick={() => navigate(`/reels`)}
                    className="w-full h-full cursor-pointer"
                  >
                    <video
                      src={reel.video_url}
                      className="h-full w-full object-cover group-hover:scale-110 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  </button>

                  {!isViewingOtherProfile && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedReel(reel);
                        setEditReelDescription(reel.description);
                        setIsReelEditorOpen(true);
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
                Nenhum reel ainda.
              </p>
            </div>
          )}
        </TabsContent>

        {/* Routines Tab */}
        <TabsContent value="routines" className="space-y-4">
          <Drawer
            open={isCreateRoutineOpen}
            onOpenChange={(open) => {
              setIsCreateRoutineOpen(open);
              if (!open) {
                setSelectedRoutineType(null);
                setWorkouts([]);
                setSelectedWorkoutIds(new Set());
                setDiets([]);
                setSelectedDietIds(new Set());
                setHabits([]);
                setSelectedHabitIds(new Set());
              }
            }}
          >
            <DrawerContent className="max-h-[90dvh] flex flex-col">
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
                    onChange={(e) => {
                      const query = e.target.value.toLowerCase();
                      if (query.trim() === "") {
                        handleSelectRoutineType(1);
                      } else {
                        setWorkouts(
                          workouts.filter(
                            (w) =>
                              w.name.toLowerCase().includes(query) ||
                              (w.description &&
                                w.description.toLowerCase().includes(query))
                          )
                        );
                      }
                    }}
                    className="mb-4"
                  />

                  {workoutsLoading ? (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                      Carregando exercícios...
                    </div>
                  ) : workouts.length > 0 ? (
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                      {workouts.map((workout) => {
                        const isSelected = selectedWorkoutIds.has(workout.id);
                        return (
                          <button
                            key={workout.id}
                            onClick={() => {
                              const newSelected = new Set(selectedWorkoutIds);
                              if (isSelected) {
                                newSelected.delete(workout.id);
                              } else {
                                newSelected.add(workout.id);
                              }
                              setSelectedWorkoutIds(newSelected);
                            }}
                            className={`w-full p-4 border-2 rounded-lg transition-all text-left space-y-2 group ${
                              isSelected
                                ? "border-brand bg-brand/5"
                                : "border-border/60 hover:border-border/80 hover:bg-muted/50"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {workout.photo ? (
                                <img
                                  src={workout.photo}
                                  alt={workout.name}
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
                                  {workout.name}
                                </p>
                                {workout.description && (
                                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                    {workout.description}
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
                      Nenhum exercício disponível.
                    </div>
                  )}

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
                  ) : diets.length > 0 ? (
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                      {diets.map((diet) => {
                        const isSelected = selectedDietIds.has(diet.id);
                        return (
                          <button
                            key={diet.id}
                            onClick={() => {
                              const newSelected = new Set(selectedDietIds);
                              if (isSelected) {
                                newSelected.delete(diet.id);
                              } else {
                                newSelected.add(diet.id);
                              }
                              setSelectedDietIds(newSelected);
                            }}
                            className={`w-full p-4 border-2 rounded-lg transition-all text-left space-y-2 group ${
                              isSelected
                                ? "border-brand bg-brand/5"
                                : "border-border/60 hover:border-border/80 hover:bg-muted/50"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {diet.photo ? (
                                <img
                                  src={diet.photo}
                                  alt={diet.name}
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
                                  {diet.name}
                                </p>
                                <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                  {diet.description && (
                                    <p className="line-clamp-2">
                                      {diet.description}
                                    </p>
                                  )}
                                  <p className="font-medium text-brand/80">
                                    {diet.calories} cal
                                  </p>
                                </div>
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
                  )}

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
                const typeName = getRoutineTypeName(typeCode);

                if (typeCode === 1) {
                  // Exercises
                  itemsOfType = userWorkouts.filter((uw) =>
                    routinesOfType.some((r) => String(r.program_id) === uw.id),
                  );
                } else if (typeCode === 2) {
                  // Diets
                  itemsOfType = userDiets.filter((ud) =>
                    routinesOfType.some((r) => String(r.program_id) === ud.id),
                  );
                } else if (typeCode === 3) {
                  // Habits
                  itemsOfType = userHabits.filter((uh) =>
                    routinesOfType.some((r) => String(r.program_id) === uh.id),
                  );
                }

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
                            setGoalIndicatorRoutine(null);
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

                        <DrawerContent className="max-h-[90dvh] flex flex-col">
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
                          toast({
                            title: "Editar Rotina",
                            description: "Funcionalidade em desenvolvimento.",
                          });
                        }}
                        className="shrink-0 p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                        title="Editar rotina"
                      >
                        <Edit2 className="h-5 w-5" />
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
                                className="border-border/60 bg-background"
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-start gap-3">
                                    {typeCode === 1 && item.workoutPhoto ? (
                                      <img
                                        src={item.workoutPhoto}
                                        alt={item.workoutName}
                                        className="h-12 w-12 rounded object-cover flex-shrink-0"
                                      />
                                    ) : typeCode === 2 && item.dietPhoto ? (
                                      <img
                                        src={item.dietPhoto}
                                        alt={item.dietName}
                                        className="h-12 w-12 rounded object-cover flex-shrink-0"
                                      />
                                    ) : typeCode === 3 && item.habitPhoto ? (
                                      <img
                                        src={item.habitPhoto}
                                        alt={item.habitName}
                                        className="h-12 w-12 rounded object-cover flex-shrink-0"
                                      />
                                    ) : (
                                      <div className="h-12 w-12 rounded bg-muted flex-shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
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
                                    </div>
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
        </TabsContent>
      </Tabs>

      {/* Post Viewer Drawer */}
      <Drawer open={isPostViewerOpen} onOpenChange={setIsPostViewerOpen}>
        <DrawerContent className="max-h-[90dvh] flex flex-col">
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
        <DrawerContent className="max-h-[90dvh] flex flex-col">
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
        <DrawerContent className="max-h-[90dvh] flex flex-col">
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

      {/* Reel Editor Drawer */}
      <Drawer open={isReelEditorOpen} onOpenChange={setIsReelEditorOpen}>
        <DrawerContent className="max-h-[90dvh] flex flex-col">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>
              {isEditingReel ? "Editar Reel" : "Opções do Reel"}
            </DrawerTitle>
          </DrawerHeader>

          {selectedReel && (
            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
              {/* Reel Video Preview */}
              <div className="relative aspect-square overflow-hidden rounded-lg bg-black border border-border/60">
                <video
                  src={selectedReel.video_url}
                  className="w-full h-full object-cover"
                  controls
                />
              </div>

              {/* Description */}
              {isEditingReel ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Descrição</label>
                  <Textarea
                    value={editReelDescription}
                    onChange={(e) => setEditReelDescription(e.target.value)}
                    className="resize-none"
                    rows={4}
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Descrição
                  </label>
                  <p className="text-sm mt-1">{selectedReel.description}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                {!isEditingReel ? (
                  <>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setIsEditingReel(true)}
                    >
                      <Edit2 className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={handleDeleteReel}
                      disabled={isUpdatingReel}
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
                        setIsEditingReel(false);
                        setEditReelDescription(selectedReel.description);
                      }}
                      disabled={isUpdatingReel}
                    >
                      Cancelar
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleUpdateReel}
                      disabled={isUpdatingReel}
                    >
                      {isUpdatingReel ? "Salvando..." : "Salvar"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
