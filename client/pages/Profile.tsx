import * as React from "react";
import { getUserProfileDb, getUserPostsDb, getUserStatsDb, type UserProfile, type PostWithUser, type UserStats } from "@/lib/ritmofit-db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Users, Heart } from "lucide-react";

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

  if (authLoading || loading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando perfil...</div>;
  }

  if (!profile) {
    return <div className="p-6 text-sm text-muted-foreground">Perfil não encontrado.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="flex gap-6">
        <div className="shrink-0">
          {profile.photo ? (
            <img
              src={profile.photo}
              alt={profile.nickname}
              className="h-24 w-24 rounded-full object-cover ring-2 ring-border/60"
            />
          ) : (
            <div className="h-24 w-24 rounded-full bg-muted ring-2 ring-border/60" />
          )}
        </div>

        <div className="space-y-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{profile.nickname}</h1>
            {profile.bio && <p className="text-sm text-muted-foreground">{profile.bio}</p>}
          </div>
        </div>
      </div>

      {/* Stats Card */}
      <Card className="border-border/60">
        <CardContent className="grid grid-cols-3 gap-4 pt-6">
          <div className="text-center space-y-1">
            <div className="text-2xl font-semibold">{stats.postsCount}</div>
            <div className="text-xs text-muted-foreground">Posts</div>
          </div>
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-1">
              <Users className="h-4 w-4" />
              <span className="text-2xl font-semibold">{stats.followersCount}</span>
            </div>
            <div className="text-xs text-muted-foreground">Seguidores</div>
          </div>
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-1">
              <span className="text-2xl font-semibold">{stats.followingCount}</span>
              <Users className="h-4 w-4" />
            </div>
            <div className="text-xs text-muted-foreground">Seguindo</div>
          </div>
        </CardContent>
      </Card>

      {/* Posts Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Posts</h2>

        {posts.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Card key={post.id} className="border-border/60 overflow-hidden hover:border-border/80 transition-colors cursor-pointer">
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
      </div>
    </div>
  );
}
