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
} from "@/lib/ritmofit-db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageWithFallback } from "@/components/image-with-fallback";
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
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
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
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);

  // Determine if we're viewing another user's profile
  const isViewingOtherProfile = !!userId && userId !== user?.id;
  const profileUserId = userId || user?.id;

  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [posts, setPosts] = React.useState<PostWithUser[]>([]);
  const [routines, setRoutines] = React.useState<Routine[]>([]);
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

  // Edit form state
  const [editNickname, setEditNickname] = React.useState("");
  const [editBio, setEditBio] = React.useState("");
  const [editPhotoFile, setEditPhotoFile] = React.useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = React.useState<string | null>(
    null,
  );

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
      ] = await Promise.all([
        getUserProfileDb(profileUserId),
        getUserPostsDb(profileUserId),
        getUserStatsDb(profileUserId),
        getUserRoutinesDb(profileUserId),
        getUserWorkoutsDb(profileUserId),
        getUserDietsDb(profileUserId),
        getUserHabitsDb(profileUserId),
        getUserGoalsDb(),
      ]);

      setProfile(profileData);
      setPosts(postsData);
      setStats(statsData);
      setRoutines(routinesData);
      setUserWorkouts(userWorkoutsData);
      setUserDiets(userDietsData);
      setUserHabits(userHabitsData);
      setUserGoals(userGoalsData);
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

  const loadFollowersData = React.useCallback(async () => {
    setIsLoadingFollowers(true);
    try {
      const data = await getFollowersDb();
      setFollowers(data);
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
                {/* Add Story Button */}
                <button
                  onClick={() => {
                    toast({
                      title: "Criar Story",
                      description: "Funcionalidade em desenvolvimento.",
                    });
                  }}
                  className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-brand text-white flex items-center justify-center ring-2 ring-background hover:bg-brand/90 transition-colors shadow-md"
                  title="Adicionar novo story"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>

              {/* Info */}
              <div className="space-y-3 flex-1 min-w-0">
                <div>
                  <h1 className="text-xl font-semibold tracking-tight truncate">
                    {profile.nickname}
                  </h1>
                  {profile.bio && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {profile.bio}
                    </p>
                  )}
                </div>

                {/* Stats Inline - Centered */}
                <div className="flex gap-6 sm:gap-8 justify-center">
                  <div className="flex flex-col items-center space-y-1">
                    <div className="text-lg font-semibold">
                      {stats.postsCount}
                    </div>
                    <div className="text-xs text-muted-foreground">Posts</div>
                  </div>
                  <button
                    onClick={() => setShowFollowersModal(true)}
                    className="flex flex-col items-center space-y-1 hover:opacity-80 transition-opacity"
                  >
                    <div className="text-lg font-semibold">
                      {stats.followersCount}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Seguidores
                    </div>
                  </button>
                  <button
                    onClick={() => setShowFollowingModal(true)}
                    className="flex flex-col items-center space-y-1 hover:opacity-80 transition-opacity"
                  >
                    <div className="text-lg font-semibold">
                      {stats.followingCount}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Seguindo
                    </div>
                  </button>
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
                    <Dialog
                      open={isEditDialogOpen}
                      onOpenChange={setIsEditDialogOpen}
                    >
                      <DialogTrigger asChild>
                        <Button
                          onClick={openEditDialog}
                          variant="outline"
                          className="w-full rounded-full gap-2"
                        >
                          <Edit2 className="h-4 w-4" />
                          Editar Perfil
                        </Button>
                      </DialogTrigger>

                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Editar Perfil</DialogTitle>
                          <DialogDescription>
                            Atualize suas informações de perfil
                          </DialogDescription>
                        </DialogHeader>

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
                      </DialogContent>
                    </Dialog>

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
                  </div>
                </DrawerContent>
              </Drawer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Posts and Routines Tabs */}
      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="posts">Posts ({stats.postsCount})</TabsTrigger>
          <TabsTrigger value="routines">Rotinas</TabsTrigger>
        </TabsList>

        {/* Posts Tab */}
        <TabsContent value="posts" className="space-y-4">
          {posts.length > 0 ? (
            <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {posts.map((post) => (
                <button
                  key={post.id}
                  onClick={() => navigate(`/post/${post.id}`)}
                  className="group relative aspect-square overflow-hidden rounded-lg bg-muted border border-border/60 hover:border-border/80 transition-all cursor-pointer"
                >
                  <img
                    src={post.photo}
                    alt={post.description}
                    className="h-full w-full object-cover group-hover:scale-110 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
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
                            {routinesOfType.length} rotina
                            {routinesOfType.length > 1 ? "s" : ""} ·{" "}
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
                      <Dialog
                        open={goalIndicatorRoutineId === routinesOfType[0]?.id}
                        onOpenChange={(open) => {
                          if (!open) {
                            setGoalIndicatorRoutineId(null);
                            setGoalIndicatorRoutine(null);
                            setLinkedGoal(null);
                          }
                        }}
                      >
                        <DialogTrigger asChild>
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
                        </DialogTrigger>

                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>
                              {linkedGoal ? "Meta Vinculada" : "Vincular Meta"}
                            </DialogTitle>
                          </DialogHeader>

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
                                className="w-full"
                              >
                                {isUpdatingGoal
                                  ? "Desvinculando..."
                                  : "Desvincular Meta"}
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
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
                        </DialogContent>
                      </Dialog>

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

      {/* Followers Modal */}
      <Dialog open={showFollowersModal} onOpenChange={setShowFollowersModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Seguidores</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {isLoadingFollowers ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Carregando...
              </div>
            ) : followers.length > 0 ? (
              followers.map((follower) => (
                <button
                  key={follower.id}
                  onClick={() => {
                    setShowFollowersModal(false);
                    navigate(`/usuario/${follower.id}`);
                  }}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors w-full text-left"
                >
                  {follower.photo ? (
                    <img
                      src={follower.photo}
                      alt={follower.nickname}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-muted" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{follower.nickname}</p>
                    {follower.bio && (
                      <p className="text-xs text-muted-foreground truncate">
                        {follower.bio}
                      </p>
                    )}
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Nenhum seguidor ainda
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Following Modal */}
      <Dialog open={showFollowingModal} onOpenChange={setShowFollowingModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Seguindo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {isLoadingFollowers ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Carregando...
              </div>
            ) : following.length > 0 ? (
              following.map((user) => (
                <button
                  key={user.id}
                  onClick={() => {
                    setShowFollowingModal(false);
                    navigate(`/usuario/${user.id}`);
                  }}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors w-full text-left"
                >
                  {user.photo ? (
                    <img
                      src={user.photo}
                      alt={user.nickname}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-muted" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{user.nickname}</p>
                    {user.bio && (
                      <p className="text-xs text-muted-foreground truncate">
                        {user.bio}
                      </p>
                    )}
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Não está seguindo ninguém
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
