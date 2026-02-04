import * as React from "react";
import { getFeedPosts } from "../services/posts.service";
import { Card, CardContent } from "@/components/ui/card";

type Post = {
  id: string;
  content: string;
  image_url?: string;
  created_at: string;
  user: {
    id: string;
    username: string;
    avatar_url?: string;
  };
  likes?: { count: number }[];
  comments?: { count: number }[];
};

export default function Index() {
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const data = await getFeedPosts();
        setPosts(data ?? []);
      } catch (err) {
        console.error("Erro ao carregar feed:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Carregando feed...
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-xl gap-4">
      {posts.length ? (
        posts.map((post) => (
          <Card key={post.id} className="overflow-hidden border-border/60">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-muted font-semibold text-sm">
                {post.user.username?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div>
                <div className="text-sm font-semibold">
                  @{post.user.username}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(post.created_at).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Imagem */}
            {post.image_url && (
              <img
                src={post.image_url}
                alt="Post"
                className="aspect-square w-full object-cover"
              />
            )}

            {/* Conteúdo */}
            <CardContent className="space-y-2 p-4">
              <div className="text-sm">{post.content}</div>

              <div className="text-xs text-muted-foreground flex gap-4">
                <span>❤️ {post.likes?.[0]?.count ?? 0}</span>
                <span>💬 {post.comments?.[0]?.count ?? 0}</span>
              </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <Card className="border-border/60">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Ainda não há postagens.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
