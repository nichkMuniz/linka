import * as React from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { getPostByIdDb, getPostLikeUsersDb, getPostLikesDb, getUserPostLikesDb, togglePostIncentiveDb, getUserGoalByIdDb, deletePostDb, flushPendingIncentivesDb, type PostWithUser, type PostLikeStats, type PostIncentiveType, type UserGoal } from "@/lib/ritmofit-db";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/lib/language-context";
import { ArrowLeft, Edit2, Trash2, MoreVertical, UsersRound, Share2 } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { SendToFriendDrawer } from "@/components/shared/send-to-friend-drawer";
import { ShareDrawer } from "@/components/shared/share-drawer";
import { postShareUrl } from "@/lib/share-url";
import { FollowListDrawer } from "@/components/profile/follow-list-drawer";
import { VerifiedBadge } from "@/components/shared/VerifiedBadge";
import { PostCarousel } from "@/components/post/post-carousel";
import { WorkoutDetailButton } from "@/components/shared/workout-detail-dialog";
import { formatTimeAgo, cn } from "@/lib/utils";
import { PostIncentiveButton } from "@/components/shared/post-incentive-button";
import { PostCommentsDialog } from "@/components/modals/post-comments-dialog";
import { PostDetailSkeleton } from "@/components/shared/animated-loading";
import { PostLikesModal } from "@/components/modals/post-likes-modal";
import { EditPostDrawer } from "@/components/post/edit-post-drawer";
import { getPostGradient, GLASS_TOP, GLASS_ACTION, DESC_MAX_CHARS, renderWithHashtags } from "@/lib/post-visuals";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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
  const [postLikes, setPostLikes] = React.useState<Array<{ userId: string; userNickname: string; userPhoto: string | null; type: number }>>([]);
  const [likeStats, setLikeStats] = React.useState<PostLikeStats>({ apoio: 0, continua: 0, ganhador: 0, consegueMais: 0, limiteMaior: 0, maisAlgum: 0 });
  const [userLikes, setUserLikes] = React.useState<PostIncentiveType[]>([]);
  const [togglingIncentives, setTogglingIncentives] = React.useState<Set<number>>(new Set());
  const [descExpanded, setDescExpanded] = React.useState(false);
  const [carouselIndex, setCarouselIndex] = React.useState(0);
  const [taggedOpen, setTaggedOpen] = React.useState(false);
  const [sendToFriendOpen, setSendToFriendOpen] = React.useState(false);
  const [shareDrawerOpen, setShareDrawerOpen] = React.useState(false);

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

  const description = post?.description ?? "";
  const isDescTruncatable = description.includes("\n") || description.length > DESC_MAX_CHARS;
  const truncatedDescription = description.length > DESC_MAX_CHARS
    ? description.slice(0, DESC_MAX_CHARS).trimEnd()
    : description.split("\n")[0] ?? "";
  const photos = post?.photos && post.photos.length > 0
    ? post.photos
    : post?.photo ? [post.photo] : null;

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
    return <PostDetailSkeleton />;
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
    <div
      className="flex flex-col overflow-hidden bg-background"
      style={{
        // A tela sempre mostra exatamente 1 post — sem necessidade de scroll.
        // Reserva a mesma altura de chrome (header flutuante + bottom nav do AppLayout)
        // que já é aplicada via padding em <main> (client/components/layout/app-layout.tsx),
        // para que header próprio + card do post preencham o restante sem estourar a viewport.
        height: "calc(100dvh - max(14px, env(safe-area-inset-top) + 6px) - 52px - 12px - env(safe-area-inset-bottom) - 100px)",
      }}
    >
      {/* Header */}
      <div className="shrink-0 border-b border-border/60 px-4 py-3">
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
      <div className="flex-1 min-h-0 max-w-2xl mx-auto w-full px-4 py-4 flex">
        <div className="relative overflow-hidden fade-in w-full h-full" style={{ borderRadius: "28px", boxShadow: "0 20px 44px -16px rgba(0,0,0,.7)" }}>
          {photos ? (
            <PostCarousel
              photos={photos}
              alt="Post"
              objectFit="cover"
              hideDots
              fill
              onIndexChange={setCarouselIndex}
            />
          ) : (
            <div className="w-full h-full" style={{ background: getPostGradient(post.id) }} />
          )}

          {/* Dark gradient overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(to bottom,rgba(0,0,0,.1) 0%,transparent 28%,transparent 55%,rgba(0,0,0,.65) 100%)" }}
          />

          {/* Compact pill — user identity (top-left) */}
          <div
            className="absolute top-3 left-3 inline-flex items-center gap-2 pointer-events-auto z-10"
            style={{ height: "44px", borderRadius: "22px", padding: "0 12px 0 6px", ...GLASS_TOP }}
          >
            <button
              className="flex-shrink-0 active:opacity-70 transition-opacity"
              onClick={() => navigate(`/usuario/${post.user_id}`)}
            >
              <UserAvatar
                photo={post.userPhoto}
                nickname={post.userNickname}
                size="sm"
                className="border border-white/30"
              />
            </button>

            <button
              className="min-w-0 text-left active:opacity-70 transition-opacity"
              onClick={() => navigate(`/usuario/${post.user_id}`)}
            >
              <div className="text-[13px] font-semibold text-white flex items-center gap-1 leading-tight" style={{ maxWidth: "160px" }}>
                <span className="truncate">{post.userNickname}</span>
                {post.isVerified && <VerifiedBadge size="sm" />}
              </div>
              <div className="text-[10.5px] text-white/60 leading-tight">{formatTimeAgo(post.created_at)}</div>
            </button>

            {postGoal && (
              <span
                className="flex-shrink-0 text-[10.5px] font-semibold text-white px-2 py-0.5 rounded-full"
                style={{ background: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.18)" }}
              >
                🎯 {Math.round(Math.min(100, Math.max(0, postGoal.perc ?? 0)))}%
              </span>
            )}
          </div>

          {/* Context menu (top-right) — compartilhar para todos; editar/excluir só para o dono */}
          <div className="absolute top-3 right-3 z-10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center justify-center text-white active:scale-90 transition-transform"
                  style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,.28)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,.16)" }}
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onSelect={() => setShareDrawerOpen(true)}>
                  <Share2 className="h-4 w-4 mr-2" />
                  {t("share_title")}
                </DropdownMenuItem>
                {post.user_id === user?.id && (
                  <>
                    <DropdownMenuSeparator />
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
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Bottom: description + glass action bar */}
          <div className="absolute bottom-3 left-3 right-3 z-10 pointer-events-auto">
            {/* Pessoas marcadas — "com fulano" (1) navega ao perfil; 2+ abre a lista */}
            {(post.taggedUsers?.length ?? 0) > 0 && (
              <button
                type="button"
                className="flex items-center gap-1.5 mb-2 px-1 active:opacity-70 transition-opacity"
                style={{ textShadow: "0 1px 8px rgba(0,0,0,.5)" }}
                onClick={() => {
                  if (post.taggedUsers!.length === 1) navigate(`/usuario/${post.taggedUsers![0].id}`);
                  else setTaggedOpen(true);
                }}
              >
                <UsersRound className="h-3.5 w-3.5 text-white/70 flex-shrink-0" />
                <span className="text-[12px] text-white/85 truncate">
                  {post.taggedUsers!.length === 1
                    ? t("post_with_person").replace("{name}", post.taggedUsers![0].nickname)
                    : t("post_with_others")
                        .replace("{name}", post.taggedUsers![0].nickname)
                        .replace("{n}", String(post.taggedUsers!.length - 1))}
                </span>
              </button>
            )}

            {/* Description */}
            {description && (
              <p
                className={cn(
                  "text-[13px] text-white leading-snug mb-2.5 px-1",
                  isDescTruncatable && "cursor-pointer",
                  isDescTruncatable && descExpanded && "max-h-[40vh] overflow-y-auto",
                )}
                style={{
                  textShadow: "0 1px 8px rgba(0,0,0,.5)",
                  ...(isDescTruncatable && descExpanded ? {
                    background: "rgba(0,0,0,.45)",
                    backdropFilter: "blur(14px)",
                    WebkitBackdropFilter: "blur(14px)",
                    borderRadius: "14px",
                    padding: "8px 12px",
                    marginBottom: "10px",
                  } : {}),
                }}
                onClick={() => { if (isDescTruncatable) setDescExpanded((v) => !v); }}
              >
                {!isDescTruncatable || descExpanded ? (
                  <>
                    {renderWithHashtags(description, (tag) => navigate(`/tag/${encodeURIComponent(tag)}`))}
                    {isDescTruncatable && descExpanded && (
                      <> <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setDescExpanded(false); }}
                        className="text-white/50"
                      >
                        {t("feed_description_less")}
                      </button></>
                    )}
                  </>
                ) : (
                  <>
                    {renderWithHashtags(truncatedDescription, (tag) => navigate(`/tag/${encodeURIComponent(tag)}`))}
                    {"... "}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setDescExpanded(true); }}
                      className="text-white/50"
                    >
                      {t("feed_description_more")}
                    </button>
                  </>
                )}
              </p>
            )}

            {/* Workout summary — "Ver treino" abre o detalhe; os dados do autor
                habilitam o botão "Comparar" DENTRO do drawer. */}
            {post.workoutSummary && (
              <div className="mb-2.5 px-1">
                <WorkoutDetailButton
                  summary={post.workoutSummary}
                  authorId={post.user_id}
                  authorNickname={post.userNickname ?? null}
                  authorPhoto={post.userPhoto ?? null}
                />
              </div>
            )}

            {/* Carousel indicator — sits right above the incentive action bar */}
            {photos && photos.length > 1 && (
              <div className="flex justify-center gap-1 mb-2.5 pointer-events-none">
                {photos.map((_, index) => (
                  <div
                    key={index}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-200",
                      carouselIndex === index ? "w-4 bg-white" : "w-1.5 bg-white/50",
                    )}
                    style={{ boxShadow: "0 1px 4px rgba(0,0,0,.45)" }}
                  />
                ))}
              </div>
            )}

            {/* Glass action bar */}
            <div
              className="flex items-center justify-between px-1.5"
              style={{ height: "52px", borderRadius: "26px", ...GLASS_ACTION }}
            >
              <div className="flex gap-1.5">
                {([1, 2, 3, 4, 5, 6] as PostIncentiveType[]).map((type) => (
                  <PostIncentiveButton
                    key={type}
                    type={type}
                    isActive={userLikes.includes(type)}
                    onClick={() => handleToggleIncentive(type)}
                    loading={togglingIncentives.has(type)}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2 pr-1 text-white">
                {totalLikes > 0 && (
                  <button
                    onClick={handleOpenLikesModal}
                    className="text-[13px] font-semibold text-white"
                  >
                    {totalLikes}
                  </button>
                )}
                <span className="h-[18px] w-px" style={{ background: "rgba(255,255,255,.2)" }} />
                <div className="flex items-center gap-1 text-white">
                  <PostCommentsDialog
                    postId={post.id}
                    commentCount={0}
                    hasActivity={false}
                    isPostOwner={post.user_id === user?.id}
                    defaultOpen={navState?.openComments === true}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PostLikesModal
        open={likesModalOpen}
        onOpenChange={setLikesModalOpen}
        likes={postLikes}
      />

      <ShareDrawer
        open={shareDrawerOpen}
        onOpenChange={setShareDrawerOpen}
        text={description
          ? `${t("share_post_text").replace("{handle}", post.userNickname ?? "")}\n"${description}"`
          : t("share_post_text").replace("{handle}", post.userNickname ?? "")}
        url={postShareUrl(post.id)}
        title={t("feed_share_post_title")}
        onSendToFriend={() => setSendToFriendOpen(true)}
      />

      <SendToFriendDrawer
        open={sendToFriendOpen}
        onOpenChange={setSendToFriendOpen}
        content={{
          kind: "post",
          id: post.id,
          previewImage: post.photos?.length ? String(post.photos[0]) : post.photo || null,
          authorNickname: post.userNickname,
        }}
      />

      {/* Lista de pessoas marcadas (2+) */}
      {(post.taggedUsers?.length ?? 0) > 1 && (
        <FollowListDrawer
          open={taggedOpen}
          onOpenChange={setTaggedOpen}
          type="following"
          title={t("post_tagged_title")}
          emptyMessage={t("post_tagged_title")}
          users={post.taggedUsers!}
          isLoading={false}
        />
      )}

      <EditPostDrawer
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        post={post}
        onSaved={(newDescription, newTaggedUsers) => {
          if (newDescription !== undefined || newTaggedUsers !== undefined) {
            setPost((prev) => prev ? {
              ...prev,
              ...(newDescription !== undefined ? { description: newDescription } : {}),
              ...(newTaggedUsers !== undefined ? { taggedUsers: newTaggedUsers } : {}),
            } : prev);
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
