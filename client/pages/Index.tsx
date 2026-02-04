import * as React from "react";
import { getFeedPosts } from "../services/post.service";
import { Card, CardContent } from "@/components/ui/card";

type Post = {
  id: string;
  description: string;
  photo: string;
  created_at: string;
  user_id: string;
};

export default function Index() {
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const data = await getFeedPosts();
        setPosts(data);
      } catch (err: any) {
        console.error("Erro ao carregar feed:", err?.message || err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="mx-auto grid w-full max-w-md gap-4">
      {posts.length ? (
        posts.map((post) => (
          <Card key={post.id}>
            <CardContent className="space-y-2 p-4">
              <img
                src={post.photo}
                alt="Post"
                className="w-full rounded-lg object-cover"
              />
              {post.description && (
                <p className="text-sm text-muted-foreground">
                  {post.description}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {new Date(post.created_at).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ))
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          Nenhum post ainda.
        </p>
      )}
    </div>
  );
}
