import * as React from "react";
import { getFeedPosts, togglePostLike } from "../services/post.service";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PostIncentiveButton } from "@/components/post-incentive-button";
import { PostCommentsDialog } from "@/components/post-comments-dialog";
import { GoalDetailsModal } from "@/components/goal-details-modal";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import type { PostIncentiveType } from "@/lib/ritmofit-db";
import type { PostWithStats } from "../services/post.service";

function dayLabel(days: 7 | 21 | 30) {
  return days === 7 ? "dias" : days === 21 ? "semanas" : "mês";
}

function goalProgressPercent(completedDays: number, durationDays: number): number {
  const pct = Math.round((completedDays / durationDays) * 100);
  return Math.min(100, Math.max(0, pct));
}

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
        posts.map((post) => {
          const pct = post.goalInfo
            ? goalProgressPercent(post.goalInfo.completedDays, post.goalInfo.durationDays)
            : 0;
          const done = post.goalInfo ? post.goalInfo.completedDays >= post.goalInfo.durationDays : false;

          return (
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

                {/* Goal progress bar section */}
                {post.goalInfo && (
                  <GoalDetailsModal goalInfo={post.goalInfo} linkedRoutines={post.linkedRoutines}>
                    <button
                      type="button"
                      className="w-full space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-medium text-muted-foreground">
                          {post.goalInfo.completedDays}/{post.goalInfo.durationDays}{" "}
                          {dayLabel(post.goalInfo.durationDays)} · {pct}%
                        </div>
                        {done && (
                          <div className="rounded-lg bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            Concluída
                          </div>
                        )}
                      </div>
                      <Progress value={pct} className="h-1.5" />
                      <div className="text-[10px] text-muted-foreground">
                        {post.goalInfo.title} · {post.goalInfo.frequency}
                      </div>
                    </button>
                  </GoalDetailsModal>
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
                        hasActivity={post.hasActivity}
                      />
                    ))}
                  </div>
                  <PostCommentsDialog postId={post.id} commentCount={post.commentCount} hasActivity={post.hasActivity} />
                </div>

                <p className="text-xs text-muted-foreground pt-1">
                  {new Date(post.created_at).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          );
        })
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          Nenhum post ainda.
        </p>
      )}
    </div>
  );
}
