import * as React from "react";
import { getUserProfileDb, getUserPostsDb, getUserStatsDb, updateUserProfileDb, getUserRoutinesDb, createRoutineDb, createUserWorkoutsDb, getWorkoutsDb, ROUTINE_TYPES, getRoutineTypeName, type UserProfile, type PostWithUser, type UserStats, type Routine, type Workout } from "@/lib/ritmofit-db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Users, Edit2, Upload, Plus, ArrowLeft, Check } from "lucide-react";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

export default function Profile() {
  const { user, loading: authLoading } = useAuth();

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
  const [expandedPost, setExpandedPost] = React.useState<PostWithUser | null>(null);
  const [isCreateRoutineOpen, setIsCreateRoutineOpen] = React.useState(false);
  const [isCreatingRoutine, setIsCreatingRoutine] = React.useState(false);
  const [selectedRoutineType, setSelectedRoutineType] = React.useState<1 | 2 | 3 | null>(null);
  const [workouts, setWorkouts] = React.useState<Workout[]>([]);
  const [workoutsLoading, setWorkoutsLoading] = React.useState(false);

  // Edit form state
  const [editNickname, setEditNickname] = React.useState("");
  const [editBio, setEditBio] = React.useState("");
  const [editPhotoFile, setEditPhotoFile] = React.useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = React.useState<string | null>(null);

  const loadProfile = React.useCallback(async () => {
    if (!user) return;

    try {
      const [profileData, postsData, statsData, routinesData] = await Promise.all([
        getUserProfileDb(user.id),
        getUserPostsDb(user.id),
        getUserStatsDb(user.id),
        getUserRoutinesDb(user.id),
      ]);

      setProfile(profileData);
      setPosts(postsData);
      setStats(statsData);
      setRoutines(routinesData);
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
  }, [user]);

  React.useEffect(() => {
    loadProfile();
  }, [user, loadProfile]);

  const openEditDialog = () => {
    if (profile) {
      setEditNickname(profile.nickname);
      setEditBio(profile.bio);
      setEditPhotoPreview(profile.photo);
      setEditPhotoFile(null);
      setIsEditDialogOpen(true);
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

  const handleSaveProfile = async () => {
    if (!user || !profile) return;

    setIsSaving(true);
    try {
      let photoUrl = profile.photo;

      if (editPhotoFile) {
        const filePath = `${user.id}/profile-${Date.now()}`;
        const { error: uploadError } = await supabase.storage
          .from("posts")
          .upload(filePath, editPhotoFile);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("posts").getPublicUrl(filePath);
        photoUrl = data.publicUrl;
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
    }
  };

  const handleCreateRoutine = async (workoutId?: string) => {
    if (!user || selectedRoutineType === null) return;

    setIsCreatingRoutine(true);
    try {
      const newRoutine = await createRoutineDb(user.id, selectedRoutineType, workoutId);
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

  if (authLoading || loading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando perfil...</div>;
  }

  if (!profile) {
    return <div className="p-6 text-sm text-muted-foreground">Perfil não encontrado.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Profile Header Card */}
      <Card className="border-border/60">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-4 flex-1 min-w-0">
              {/* Avatar */}
              <div className="shrink-0">
                {profile.photo ? (
                  <img
                    src={profile.photo}
                    alt={profile.nickname}
                    className="h-20 w-20 rounded-full object-cover ring-2 ring-border/60"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-muted ring-2 ring-border/60" />
                )}
              </div>

              {/* Info */}
              <div className="space-y-3 flex-1 min-w-0">
                <div>
                  <h1 className="text-xl font-semibold tracking-tight truncate">{profile.nickname}</h1>
                  {profile.bio && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{profile.bio}</p>
                  )}
                </div>

                {/* Stats Inline */}
                <div className="flex gap-4 sm:gap-6">
                  <div className="space-y-1">
                    <div className="text-lg font-semibold">{stats.postsCount}</div>
                    <div className="text-xs text-muted-foreground">Posts</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-lg font-semibold flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {stats.followersCount}
                    </div>
                    <div className="text-xs text-muted-foreground">Seguidores</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-lg font-semibold flex items-center gap-1">
                      {stats.followingCount}
                      <Users className="h-3 w-3" />
                    </div>
                    <div className="text-xs text-muted-foreground">Seguindo</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Edit Button - Responsive */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 rounded-full"
                  onClick={openEditDialog}
                >
                  <Edit2 className="h-4 w-4" />
                  <span className="hidden sm:inline ml-2">Editar</span>
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
                    <label className="text-sm font-medium">Foto do Perfil</label>
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
                <Dialog key={post.id} open={expandedPost?.id === post.id} onOpenChange={(open) => !open && setExpandedPost(null)}>
                  <DialogTrigger asChild>
                    <button
                      onClick={() => setExpandedPost(post)}
                      className="group relative aspect-square overflow-hidden rounded-lg bg-muted border border-border/60 hover:border-border/80 transition-all cursor-pointer"
                    >
                      <img
                        src={post.photo}
                        alt={post.description}
                        className="h-full w-full object-cover group-hover:scale-110 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    </button>
                  </DialogTrigger>

                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Post Image */}
                      <div className="aspect-square overflow-hidden rounded-lg bg-muted">
                        <img
                          src={post.photo}
                          alt={post.description}
                          className="h-full w-full object-cover"
                        />
                      </div>

                      {/* Post Info */}
                      <div className="space-y-4">
                        <div>
                          <h2 className="text-xl font-semibold">Post</h2>
                          {post.description && (
                            <p className="text-sm text-muted-foreground mt-2">{post.description}</p>
                          )}
                        </div>

                        {/* Interactions placeholder */}
                        <div className="space-y-2 pt-4 border-t border-border/60">
                          <div className="text-sm font-medium">Interações</div>
                          <div className="text-xs text-muted-foreground">Nenhuma interação ainda.</div>
                        </div>

                        {/* Comments placeholder */}
                        <div className="space-y-2 pt-4 border-t border-border/60">
                          <div className="text-sm font-medium">Comentários</div>
                          <div className="text-xs text-muted-foreground">Nenhum comentário ainda.</div>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-6 text-center">
              <p className="text-sm text-muted-foreground">Nenhum post ainda.</p>
            </div>
          )}
        </TabsContent>

        {/* Routines Tab */}
        <TabsContent value="routines" className="space-y-4">
          <Dialog open={isCreateRoutineOpen} onOpenChange={(open) => {
            setIsCreateRoutineOpen(open);
            if (!open) {
              setSelectedRoutineType(null);
              setWorkouts([]);
            }
          }}>
            <DialogTrigger asChild>
              <Button className="rounded-full">
                <Plus className="h-4 w-4 mr-2" />
                Rotina
              </Button>
            </DialogTrigger>

            <DialogContent>
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
                        onClick={() => handleSelectRoutineType(typeCode as 1 | 2 | 3)}
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
                    <DialogTitle>Selecione um Exercício</DialogTitle>
                  </DialogHeader>

                  {workoutsLoading ? (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                      Carregando exercícios...
                    </div>
                  ) : workouts.length > 0 ? (
                    <div className="grid gap-3 max-h-[60vh] overflow-y-auto">
                      {workouts.map((workout) => (
                        <button
                          key={workout.id}
                          onClick={() => handleCreateRoutine(workout.id)}
                          disabled={isCreatingRoutine}
                          className="p-4 border border-border/60 rounded-lg hover:bg-muted/50 transition-colors text-left space-y-2 group disabled:opacity-50"
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
                              <p className="font-medium group-hover:text-brand transition-colors">{workout.name}</p>
                              {workout.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                  {workout.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                      Nenhum exercício disponível.
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
                    <DialogTitle>{getRoutineTypeName(selectedRoutineType)}</DialogTitle>
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
            </DialogContent>
          </Dialog>

          {routines.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {routines.map((routine) => (
                <Card key={routine.id} className="border-border/60 hover:border-border/80 transition-colors cursor-pointer">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-lg">{getRoutineTypeName(routine.type)}</p>
                        <p className="text-xs text-muted-foreground mt-2">ID: {routine.id}</p>
                      </div>
                      <div className="text-right">
                        <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-brand/10">
                          <span className="text-xs font-semibold text-brand">{routine.type}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-6 text-center">
              <p className="text-sm text-muted-foreground">Nenhuma rotina criada ainda.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
