import * as React from "react";
import { getFeedPosts } from "../services/post.service";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, Send } from "lucide-react";

type Post = {
  id: string;
  description: string | null;
  photo: string;
  created_at: string;
  user: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
  likes: { count: number }[];
  comments: { count: number }[];
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

export default function Index() {
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const data = await getFeedPosts();
        setPosts(data ?? []);
      } catch (err) {
        console.error("Erro ao carregar feed:", err?.message ?? err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-muted-foreground">
        Carregando feed...
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      {posts.length ? (
        posts.map((post) => (
          <Card key={post.id} className="overflow-hidden border-border/60">
            {/* Header */}
            <CardHeader className="flex flex-row items-center gap-3 p-4">
              <Avatar className="h-10 w-10">
                <AvatarImage src={post.user.avatar_url ?? undefined} />
                <AvatarFallback>
                  {post.user.username?.[0]?.toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
              <div className="leading-tight">
                <div className="text-sm font-semibold">
                  {post.user.username}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(post.created_at)}
                </div>
              </div>
            </CardHeader>

            {/* Image */}
            <div className="relative aspect-square w-full overflow-hidden bg-muted">
              <img
                src={post.photo}
                alt="Imagem da postagem"
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>

            <CardContent className="space-y-3 p-4">
              {/* Actions */}
              <div className="flex items-center gap-3">
                <Button size="icon" variant="ghost" className="rounded-full">
                  <Heart className="h-5 w-5" />
                </Button>
                <Button size="icon" variant="ghost" className="rounded-full">
                  <MessageCircle className="h-5 w-5" />
                </Button>
                <Button size="icon" variant="ghost" className="rounded-full">
                  <Send className="h-5 w-5" />
                </Button>
              </div>

              {/* Likes */}
              <div className="text-sm font-semibold">
                {post.likes?.[0]?.count ?? 0} curtidas
              </div>

              {/* Caption */}
              {post.description && (
                <div className="text-sm">
                  <span className="font-semibold">{post.user.username}</span>{" "}
                  {post.description}
                </div>
              )}

              {/* Comments */}
              <div className="text-xs text-muted-foreground">
                {post.comments?.[0]?.count ?? 0} comentários
              </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <Card className="border-border/60">
          <CardContent className="p-6 text-center text-muted-foreground">
            Ainda não há postagens.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
