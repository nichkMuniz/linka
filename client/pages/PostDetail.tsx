import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getUserPostsDb, getUserProfileDb, type PostWithUser } from "@/lib/ritmofit-db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageWithFallback } from "@/components/image-with-fallback";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Edit2, Trash2 } from "lucide-react";
import { PostIncentiveButton } from "@/components/post-incentive-button";
import { PostCommentsDialog } from "@/components/post-comments-dialog";

export default function PostDetail() {
  const { postId } = useParams<{ postId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [post, setPost] = React.useState<PostWithUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        if (!postId || !user) return;

        // Fetch all user posts and find the one matching postId
        const allPosts = await getUserPostsDb(user.id);
        const foundPost = allPosts.find((p) => p.id === postId);

        if (foundPost) {
          setPost(foundPost);
        } else {
          toast({
            title: "Post não encontrado",
            variant: "destructive",
          });
          navigate("/perfil");
        }
      } catch (err: any) {
        console.error("Error loading post:", err);
        toast({
          title: "Erro ao carregar post",
          description: err?.message || "Tente novamente.",
        });
        navigate("/perfil");
      } finally {
        setLoading(false);
      }
    })();
  }, [postId, user, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!post) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 py-3">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/perfil")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Post</h1>
        </div>
      </div>

      {/* Post Detail */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Card className="border-border/60 overflow-hidden">
          <CardContent className="space-y-3 p-0">
            {/* Image */}
            <ImageWithFallback
              src={post.photo}
              alt="Post"
              fallback="/placeholder.svg"
              className="w-full max-h-96 object-cover"
            />

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Description */}
              {post.description && (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {post.description}
                </p>
              )}

              {/* Incentive Buttons and Comments */}
              <div className="flex items-center justify-between gap-4 pt-3 border-t border-border/60">
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {[1, 2, 3, 4, 5, 6].map((type) => (
                    <PostIncentiveButton
                      key={type}
                      type={type as any}
                      isActive={false}
                      onClick={() => {}}
                      loading={false}
                    />
                  ))}
                </div>
                <PostCommentsDialog
                  postId={post.id}
                  commentCount={0}
                  hasActivity={false}
                  isPostOwner={true}
                  hasUnreadComments={false}
                />
              </div>

              {/* Edit and Delete Buttons */}
              <div className="flex gap-2 pt-3 border-t border-border/60">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-full gap-2"
                >
                  <Edit2 className="h-4 w-4" />
                  Editar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1 rounded-full gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
