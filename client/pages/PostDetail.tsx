import * as React from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { getPostByIdDb, getPostLikeUsersDb, getPostLikesDb, getUserPostLikesDb, togglePostIncentiveDb, getUserGoalByIdDb, deletePostDb, flushPendingIncentivesDb, type PostWithUser, type PostLikeStats, type PostIncentiveType, type UserGoal } from "@/lib/ritmofit-db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageWithFallback } from "@/components/shared/image-with-fallback";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/lib/language-context";
import { ArrowLeft, Edit2, Trash2, MoreVertical, Target } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { VerifiedBadge } from "@/components/shared/VerifiedBadge";
import { PostCarousel } from "@/components/post/post-carousel";
import { formatTimeAgo } from "@/lib/utils";
import { PostIncentiveButton } from "@/components/shared/post-incentive-button";
import { PostCommentsDialog } from "@/components/modals/post-comments-dialog";
import { PostLikesModal } from "@/components/modals/post-likes-modal";
import { EditPostDrawer } from "@/components/post/edit-post-drawer";
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

export default function PostDetail() {
  const { postId } = useParams<{ postId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [post, setPost] = React.useState<PostWithUser | null>(null);
  const [postGoal, setPostGoal] = React.useState<UserGoal | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [likesModalOpen, setLikesModalOpen] = React.useState(false);
  const [postLikes, setPostLikes] = React.useState<Array<{ userId: string; userNickname: string; userPhoto: string | null; userGender: string | null; type: number }>>([]);
  const [likeStats, setLikeStats] = React.useState<PostLikeStats>({ apoio: 0, continua: 0, ganhador: 0, consegueMais: 0, limiteMaior: 0, maisAlgum: 0 });
  const [userLikes, setUserLikes] = React.useState<PostIncentiveType[]>([]);
  const [togglingIncentives, setTogglingIncentives] = React.useState<Set<number>>(new Set());

  // Edit post state
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);

  // Delete post state
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Capture nav state once — use a ref so it survives re-renders without re-reading location
  const navStateRef = React.useRef(location.state as { openComments?: boolean; openLikes?: boolean } | null);
  const navState = navStateRef.current;

  // Track whether we've already consumed the openLikes intent for this mount
  const openLikesConsumedRef = React.useRef(false);

  // Reset consumption flag when postId changes (new navigation)
  React.useEffect(() => {
    openLikesConsumedRef.current = false;
    navStateRef.current = location.state as { openComments?: boolean; openLikes?: boolean } | null;
  }, [postId]);

  React.useEffect(() => {
    (async () => {
      try {
        if (!postId) return;

        const foundPost = await getPostByIdDb(postId);

        if (foundPost) {
          setPost(foundPost);
          // Load likes data in parallel
          const [stats, myLikes] = await Promise.all([
            getPostLikesDb(postId),
            getUserPostLikesDb(postId),
          ]);
          setLikeStats(stats);
          setUserLikes(myLikes);
          // Load linked goal if present
          if (foundPost.user_goal_id) {
            getUserGoalByIdDb(String(foundPost.user_goal_id)).then(setPostGoal).catch(() => {});
          }
          // Auto-open likes modal when coming from incentive notification
          if (navStateRef.current?.openLikes && !openLikesConsumedRef.current) {
            openLikesConsumedRef.current = true;
            // Clear nav state so back-navigation doesn't re-trigger
            navigate(location.pathname, { replace: true, state: {} });
            await flushPendingIncentivesDb(postId);
            const likes = await getPostLikeUsersDb(postId);
            setPostLikes(likes);
            setLikesModalOpen(true);
          }
        } else {
          toast({
            title: t("post_not_found"),
            variant: "destructive",
          });
          navigate(-1);
        }
      } catch (err: any) {
        console.error("Error loading post:", err);
        toast({
          title: t("post_load_error_single"),
          description: err?.message || "Tente novamente.",
        });
        navigate(-1);
      } finally {
        setLoading(false);
      }
    })();
  }, [postId]);

  const totalLikes = likeStats.apoio + likeStats.continua + likeStats.ganhador + likeStats.consegueMais + likeStats.limiteMaior + likeStats.maisAlgum;

  const handleOpenLikesModal = async () => {
    await flushPendingIncentivesDb(post!.id);
    const likes = await getPostLikeUsersDb(post!.id);
    setPostLikes(likes);
    setLikesModalOpen(true);
  };

  const handleToggleIncentive = (type: PostIncentiveType) => {
    if (!post) return;
    const wasActive = userLikes.includes(type);
    setUserLikes((prev) => wasActive ? prev.filter((t) => t !== type) : [...prev, type]);
    setLikeStats((prev) => {
      const key = (["apoio", "continua", "ganhador", "consegueMais", "limiteMaior", "maisAlgum"] as const)[type - 1];
      return { ...prev, [key]: prev[key] + (wasActive ? -1 : 1) };
    });
    togglePostIncentiveDb(post.id, type, !wasActive);
    setTogglingIncentives((prev) => new Set(prev).add(type));
    setTimeout(() => {
      setTogglingIncentives((prev) => { const s = new Set(prev); s.delete(type); return s; });
    }, 300);
  };

  const handleEditOpen = () => {
    if (!post) return;
    setEditDialogOpen(true);
  };

  const handleDeletePost = async () => {
    if (!post) return;
    setIsDeleting(true);
    try {
      await deletePostDb(post.id);
      toast({ title: t("post_deleted") });
      navigate(-1);
    } catch (err: any) {
      toast({ title: t("post_delete_single_error"), description: err?.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 p-6 text-center">
        <p className="text-lg font-semibold">{t("post_not_found")}</p>
        <p className="text-sm text-muted-foreground">{t("post_not_found_desc")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 py-3" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
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
        <Card className="border-border/60 relative overflow-hidden">
          <CardContent className="space-y-3 p-0">
            {/* Image + overlay */}
            <div className="relative">
              {post.photos && post.photos.length > 0 ? (
                <PostCarousel photos={post.photos} alt="Post" />
              ) : post.photo ? (
                <div className="relative aspect-square md:aspect-auto md:h-[450px] bg-slate-900/20 flex items-center justify-center overflow-hidden rounded-lg">
                  <ImageWithFallback
                    src={post.photo}
                    alt="Post"
                    fallback="/placeholder.svg"
                    className="max-w-full max-h-full w-auto h-auto object-contain"
                  />
                </div>
              ) : (
                <div className="relative w-full min-h-[56px] bg-muted/30 rounded-lg" />
              )}

              {/* User info overlay */}
              <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-2 p-3 bg-gradient-to-t from-black/60 via-black/30 to-transparent">
                <button
                  onClick={() => navigate(`/usuario/${post.user_id}`)}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0 flex-1"
                >
                  <UserAvatar
                    photo={post.userPhoto}
                    gender={post.userGender ?? null}
                    nickname={post.userNickname}
                    size="sm"
                    className="border border-white/30 shrink-0"
                  />
                  <div className="flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5 min-w-0">
                    {post.isVerified && <VerifiedBadge size="sm" />}
                    <span className="text-xs font-medium text-white leading-none truncate">
                      {post.userNickname}
                    </span>
                  </div>
                </button>

                {/* Context menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-white hover:bg-white/20"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    {post.user_id === user?.id ? (
                      <>
                        <DropdownMenuItem onSelect={handleEditOpen}>
                          <Edit2 className="h-4 w-4 mr-2" />
                          {t("post_edit_label")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => setDeleteDialogOpen(true)}
                          className="text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t("post_delete_label")}
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Incentive buttons + comments */}
            <div className="flex items-center px-2 pt-1 pb-0.5">
              {([1, 2, 3, 4, 5, 6] as PostIncentiveType[]).map((type) => (
                <PostIncentiveButton
                  key={type}
                  type={type}
                  isActive={userLikes.includes(type)}
                  onClick={() => handleToggleIncentive(type)}
                  loading={togglingIncentives.has(type)}
                />
              ))}
              <div className="ml-auto">
                <PostCommentsDialog
                  postId={post.id}
                  commentCount={0}
                  hasActivity={false}
                  isPostOwner={post.user_id === user?.id}
                  defaultOpen={navState?.openComments === true}
                />
              </div>
            </div>

            {/* Like count + timestamp */}
            <div className="flex items-center gap-2 px-3 pb-1">
              {totalLikes > 0 && (
                <button
                  onClick={handleOpenLikesModal}
                  className="text-xs font-semibold text-foreground hover:text-brand transition-colors"
                >
                  {t("post_incentives_count").replace("{n}", String(totalLikes))}
                </button>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {formatTimeAgo(post.created_at)}
              </span>
            </div>

            {/* Description + goal */}
            <div className="px-3 pb-3 space-y-2">
              {post.description && (
                <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                  {post.description}
                </p>
              )}

              {postGoal && (
                <div className="w-full text-left">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Target className="h-3 w-3 text-brand flex-shrink-0" />
                    <span className="text-xs font-medium text-foreground truncate flex-1">
                      {postGoal.description}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-brand h-full rounded-full"
                      style={{ width: `${Math.min(100, Math.max(0, postGoal.perc ?? 0))}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <PostLikesModal
        open={likesModalOpen}
        onOpenChange={setLikesModalOpen}
        likes={postLikes}
      />

      <EditPostDrawer
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        post={post}
        onSaved={(newDescription) => {
          if (newDescription !== undefined) {
            setPost((prev) => prev ? { ...prev, description: newDescription } : prev);
          }
        }}
      />

      {/* Delete Post Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("post_delete_label")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("post_delete_confirm_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePost}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? t("post_deleting") : t("post_delete_confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
