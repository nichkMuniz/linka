import * as React from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { getPostByIdDb, getPostLikeUsersDb, getUserGoalByIdDb, deletePostDb, updatePostDb, type PostWithUser, type UserGoal } from "@/lib/ritmofit-db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ImageWithFallback } from "@/components/shared/image-with-fallback";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Edit2, Trash2, MoreVertical, Rocket } from "lucide-react";
import { PostIncentiveButton } from "@/components/shared/post-incentive-button";
import { PostCommentsDialog } from "@/components/modals/post-comments-dialog";
import { PostLikesModal } from "@/components/modals/post-likes-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// Module-level flag: survives StrictMode remount cycles, resets on navigation
let _likesAutoOpenConsumed = false;

export default function PostDetail() {
  const { postId } = useParams<{ postId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [post, setPost] = React.useState<PostWithUser | null>(null);
  const [postGoal, setPostGoal] = React.useState<UserGoal | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [likesModalOpen, setLikesModalOpen] = React.useState(false);
  const [postLikes, setPostLikes] = React.useState<Array<{ userId: string; userNickname: string; userPhoto: string | null; type: number }>>([]);

  // Edit post state
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [editDescription, setEditDescription] = React.useState("");
  const [isSavingEdit, setIsSavingEdit] = React.useState(false);

  // Delete post state
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Consume nav state synchronously before any render — clear history so back-navigation doesn't re-trigger
  const navState = React.useRef((() => {
    const state = location.state as { openComments?: boolean; openLikes?: boolean } | null;
    if (state?.openLikes || state?.openComments) {
      window.history.replaceState({}, "");
    }
    return state;
  })()).current;

  // Reset the module-level flag whenever we arrive at a new postId
  React.useEffect(() => {
    _likesAutoOpenConsumed = false;
  }, [postId]);

  React.useEffect(() => {
    (async () => {
      try {
        if (!postId) return;

        const foundPost = await getPostByIdDb(postId);

        if (foundPost) {
          setPost(foundPost);
          // Load linked goal if present
          if (foundPost.user_goal_id) {
            getUserGoalByIdDb(String(foundPost.user_goal_id)).then(setPostGoal).catch(() => {});
          }
          // Open likes modal only once — module-level flag survives StrictMode remounts
          if (navState?.openLikes && !_likesAutoOpenConsumed) {
            _likesAutoOpenConsumed = true;
            const likes = await getPostLikeUsersDb(postId);
            setPostLikes(likes);
            setLikesModalOpen(true);
          }
        } else {
          toast({
            title: "Post não encontrado",
            variant: "destructive",
          });
          navigate(-1);
        }
      } catch (err: any) {
        console.error("Error loading post:", err);
        toast({
          title: "Erro ao carregar post",
          description: err?.message || "Tente novamente.",
        });
        navigate(-1);
      } finally {
        setLoading(false);
      }
    })();
  }, [postId]);

  const handleEditOpen = () => {
    if (!post) return;
    setEditDescription(post.description ?? "");
    setEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!post) return;
    setIsSavingEdit(true);
    try {
      await updatePostDb(post.id, editDescription, post.user_goal_id ? String(post.user_goal_id) : null);
      setPost((prev) => prev ? { ...prev, description: editDescription } : prev);
      setEditDialogOpen(false);
      toast({ title: "Post atualizado com sucesso" });
    } catch (err: any) {
      toast({ title: "Erro ao editar post", description: err?.message, variant: "destructive" });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeletePost = async () => {
    if (!post) return;
    setIsDeleting(true);
    try {
      await deletePostDb(post.id);
      toast({ title: "Post excluído" });
      navigate(-1);
    } catch (err: any) {
      toast({ title: "Erro ao excluir post", description: err?.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 p-6 text-center">
        <p className="text-lg font-semibold">Post não encontrado</p>
        <p className="text-sm text-muted-foreground">Este post pode ter sido removido ou você não tem permissão para visualizá-lo.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 py-3">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
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
            {/* Image with Settings Menu */}
            <div className="relative">
              <ImageWithFallback
                src={post.photo}
                alt="Post"
                fallback="/placeholder.svg"
                className="w-full max-h-96 object-cover"
              />

              {/* Settings Menu Icon - Top Right (only for post owner) */}
              {post.user_id === user?.id && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="absolute top-3 right-3 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full transition-colors z-10"
                      aria-label="Configurações do post"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onSelect={handleEditOpen}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => setDeleteDialogOpen(true)}
                      className="text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Description */}
              {post.description && (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {post.description}
                </p>
              )}

              {/* Linked Goal */}
              {postGoal && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/10 border border-violet-400/20">
                  <Rocket className="h-4 w-4 text-violet-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-violet-400/80 font-medium">Meta vinculada</p>
                    <p className="text-sm text-violet-300 font-semibold truncate">{postGoal.description}</p>
                  </div>
                </div>
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
                  isPostOwner={post.user_id === user?.id}
                  hasUnreadComments={false}
                  defaultOpen={navState?.openComments === true}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <PostLikesModal
        open={likesModalOpen}
        onOpenChange={setLikesModalOpen}
        likes={postLikes}
      />

      {/* Edit Post Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar post</DialogTitle>
          </DialogHeader>
          <Textarea
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="Descrição do post..."
            className="min-h-[120px]"
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isSavingEdit}>
              Cancelar
            </Button>
            <Button onClick={handleEditSave} disabled={isSavingEdit}>
              {isSavingEdit ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Post Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir post</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este post? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePost}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
