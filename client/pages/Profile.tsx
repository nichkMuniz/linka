import * as React from "react";
import { getUserProfileDb, getUserPostsDb, getUserStatsDb, updateUserProfileDb, type UserProfile, type PostWithUser, type UserStats } from "@/lib/ritmofit-db";
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
import { Users, Edit2, Upload } from "lucide-react";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

export default function Profile() {
  const { user, loading: authLoading } = useAuth();

  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [posts, setPosts] = React.useState<PostWithUser[]>([]);
  const [stats, setStats] = React.useState<UserStats>({
    postsCount: 0,
    followersCount: 0,
    followingCount: 0,
  });
  const [loading, setLoading] = React.useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  // Edit form state
  const [editNickname, setEditNickname] = React.useState("");
  const [editBio, setEditBio] = React.useState("");
  const [editPhotoFile, setEditPhotoFile] = React.useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        const [profileData, postsData, statsData] = await Promise.all([
          getUserProfileDb(user.id),
          getUserPostsDb(user.id),
          getUserStatsDb(user.id),
        ]);

        setProfile(profileData);
        setPosts(postsData);
        setStats(statsData);
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
    })();
  }, [user]);

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

      // Upload photo if changed
      if (editPhotoFile) {
        const filePath = `${user.id}/profile-${Date.now()}`;
        const { error: uploadError } = await supabase.storage
          .from("posts")
          .upload(filePath, editPhotoFile);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("posts").getPublicUrl(filePath);
        photoUrl = data.publicUrl;
      }

      // Update profile
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
          <div className="flex items-start justify-between gap-6">
            <div className="flex gap-4 flex-1">
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
                  <h1 className="text-xl font-semibold tracking-tight">{profile.nickname}</h1>
                  {profile.bio && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{profile.bio}</p>
                  )}
                </div>

                {/* Stats Inline */}
                <div className="flex gap-6">
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

            {/* Edit Button */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 rounded-full"
                  onClick={openEditDialog}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Editar
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <Card
                  key={post.id}
                  className="border-border/60 overflow-hidden hover:border-border/80 transition-colors cursor-pointer"
                >
                  <div className="aspect-square overflow-hidden bg-muted">
                    <img
                      src={post.photo}
                      alt={post.description}
                      className="h-full w-full object-cover hover:scale-105 transition-transform"
                    />
                  </div>
                  {post.description && (
                    <CardContent className="pt-4 pb-4">
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {post.description}
                      </p>
                    </CardContent>
                  )}
                </Card>
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
          <div className="rounded-lg border border-border/60 bg-muted/30 p-6 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma rotina registrada ainda.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
