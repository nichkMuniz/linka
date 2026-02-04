import * as React from "react";
import { getFeedPosts, togglePostLike } from "../services/post.service";
import { Card, CardContent } from "@/components/ui/card";
import { PostIncentiveButton } from "@/components/post-incentive-button";
import { PostCommentsDialog } from "@/components/post-comments-dialog";
import { toast } from "@/components/ui/use-toast";
import type { PostIncentiveType } from "@/lib/ritmofit-db";
import type { PostWithStats } from "../services/post.service";

export default function Index() {
  const [posts, setPosts] = React.useState<PostWithStats[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [togglingPostId, setTogglingPostId] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const data = await getFeedPosts();
        setPosts(data);
      } catch (err: any) {
        console.error("Erro ao carregar feed:", err?.message || err);
        toast({
          title: "Erro ao carregar feed",
          description: err?.message || "Tente novamente.",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleToggleLike = React.useCallback(
    async (postId: string, incentiveType: PostIncentiveType) => {
      try {
        setTogglingPostId(postId);

        // Update UI optimistically
        setPosts((prev) =>
          prev.map((post) => {
            if (post.id !== postId) return post;

            const wasActive = post.userLikes.includes(incentiveType);
            const newUserLikes = wasActive
              ? post.userLikes.filter((t) => t !== incentiveType)
              : [...post.userLikes, incentiveType];

            const likesMap = { apoio: post.likes.apoio, continua: post.likes.continua, ganhador: post.likes.ganhador };
            if (incentiveType === 1) likesMap.apoio += wasActive ? -1 : 1;
            else if (incentiveType === 2) likesMap.continua += wasActive ? -1 : 1;
            else if (incentiveType === 3) likesMap.ganhador += wasActive ? -1 : 1;

            return {
              ...post,
              likes: likesMap,
              userLikes: newUserLikes,
            };
          }),
        );

        await togglePostLike(postId, incentiveType);
      } catch (err: any) {
        console.error("Erro ao toggle like:", err);
        toast({
          title: "Erro ao reagir",
          description: err?.message || "Tente novamente.",
        });
        // Refetch to restore correct state
        const data = await getFeedPosts();
        setPosts(data);
      } finally {
        setTogglingPostId(null);
      }
    },
    [],
  );

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      {posts.length ? (
        posts.map((post) => (
          <Card key={post.id} className="border-border/60">
            <CardContent className="space-y-3 p-4">
              <img
                src={post.photo}
                alt="Post"
                className="w-full rounded-lg object-cover"
              />
              {post.description && (
                <p className="text-sm leading-relaxed">{post.description}</p>
              )}

              {/* Incentive buttons and comments */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <div className="flex flex-wrap gap-2">
                  {([1, 2, 3] as PostIncentiveType[]).map((type) => (
                    <PostIncentiveButton
                      key={type}
                      type={type}
                      count={post.likes[type === 1 ? "apoio" : type === 2 ? "continua" : "ganhador"]}
                      isActive={post.userLikes.includes(type)}
                      onClick={() => handleToggleLike(post.id, type)}
                      loading={togglingPostId === post.id}
                    />
                  ))}
                </div>
                <PostCommentsDialog postId={post.id} commentCount={post.commentCount} />
              </div>

              <p className="text-xs text-muted-foreground pt-1">
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
