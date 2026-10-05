import * as React from "react";
import { useAppRefreshTick } from "@/lib/app-refresh";
import { useOpenProfileByHandle } from "@/hooks/use-open-profile-by-handle";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { getPostByIdDb, getCommentCountsBatchDb, getPostLikeUsersDb, getPostLikesDb, getUserPostLikesDb, togglePostIncentiveDb, getUserGoalByIdDb, deletePostDb, flushPendingIncentivesDb, type PostWithUser, type PostLikeStats, type PostIncentiveType, type UserGoal } from "@/lib/ritmofit-db";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { usePostReshare } from "@/hooks/use-post-reshare";
import { useHoldToHide } from "@/hooks/use-hold-to-hide";
import { RepostedBy } from "@/components/post/reposted-by";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/lib/language-context";
import { ArrowLeft, Edit2, Trash2, MoreVertical, UsersRound, Share2, Ban } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { SendToFriendDrawer } from "@/components/shared/send-to-friend-drawer";
import { ShareDrawer } from "@/components/shared/share-drawer";
import { UserSafetyDrawer } from "@/components/shared/user-safety-drawer";
import { FEATURES } from "@/lib/feature-flags";
import { postShareUrl } from "@/lib/share-url";
import { FollowListDrawer } from "@/components/profile/follow-list-drawer";
import { VerifiedBadge } from "@/components/shared/VerifiedBadge";
import { PostCarousel } from "@/components/post/post-carousel";
import { PostVideoMuteButton } from "@/components/post/post-video";
import { WorkoutDetailButton } from "@/components/shared/workout-detail-dialog";
import { formatTimeAgo, cn } from "@/lib/utils";
import { PostIncentiveButton } from "@/components/shared/post-incentive-button";
import { PostCommentsDialog } from "@/components/modals/post-comments-dialog";
import { GoalDetailDrawer } from "@/components/goals/goal-detail-drawer";
import { PostDetailSkeleton } from "@/components/shared/animated-loading";
import { PostLikesModal } from "@/components/modals/post-likes-modal";
import { EditPostDrawer } from "@/components/post/edit-post-drawer";
import { getPostGradient, GLASS_TOP, GLASS_ACTION, GLASS_TEXT_SHADOW, renderWithHashtags, isCaptionTruncatable, collapsedCaption } from "@/lib/post-visuals";
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
  const openProfileByHandle = useOpenProfileByHandle();
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [post, setPost] = React.useState<PostWithUser | null>(null);
  const postReshare = usePostReshare({
    context: "post-detail",
    // Atualiza o "fulano repostou" depois de repostar/desfazer.
    onRepostChanged: () => {
      if (!postId) return;
      getPostByIdDb(postId).then((fresh) => { if (fresh) setPost(fresh); }).catch(() => {});
    },
  });
  // Segurar a foto esconde a interface por cima — mesmo gesto do flow e do feed.
  const { hidden: holdHidden, consumeHoldClick, holdHandlers } = useHoldToHide();
  const holdHiddenStyle: React.CSSProperties = {
    opacity: holdHidden ? 0 : 1,
    transition: "opacity .2s ease",
    pointerEvents: holdHidden ? "none" : undefined,
  };
  const prepareReshare = postReshare.prepare;
  React.useEffect(() => { prepareReshare(post); }, [post, prepareReshare]);
  const [postGoal, setPostGoal] = React.useState<UserGoal | null>(null);
  // Drawer da meta vinculada (a pílula "🎯 %" do topo). Antes a pílula era só um
  // <span>: parecia botão e não fazia nada.
  const [goalDrawerOpen, setGoalDrawerOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [likesModalOpen, setLikesModalOpen] = React.useState(false);
  const [postLikes, setPostLikes] = React.useState<Array<{ userId: string; userNickname: string; userPhoto: string | null; type: number }>>([]);
  // Contagem real — o ícone de comentários fica preenchido quando há algum.
  const [commentCount, setCommentCount] = React.useState(0);
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
  // Denunciar/bloquear a partir do post. Esta tela é o destino dos deep links:
  // um link compartilhado de post abusivo abria aqui sem NENHUMA ação de
  // segurança disponível — só "Compartilhar".
  const [safetyOpen, setSafetyOpen] = React.useState(false);
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

  // ── Card quadrado (2026-10-02) ───────────────────────────────────────────
  // Toda foto de post nasce 1:1. O card ocupava TODA a área livre (h-full):
  // num iPhone isso é um retrato alto, e o `object-cover` cortava as laterais
  // da foto. Agora o card é o MAIOR QUADRADO que cabe na área — mesmo frame
  // 1:1 do feed. Medido (ResizeObserver) porque o CSS puro não consegue
  // "min(largura, altura)" sem container queries (iOS 16+).
  const [stageEl, setStageEl] = React.useState<HTMLDivElement | null>(null);
  const [cardSide, setCardSide] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (!stageEl) return;
    const measure = () => {
      const side = Math.floor(Math.min(stageEl.clientWidth, stageEl.clientHeight));
      setCardSide(side > 0 ? side : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stageEl);
    return () => ro.disconnect();
  }, [stageEl]);

  // Volta ao app depois de 5+ min fora: relê o post, incentivos e comentários.
  const refreshTick = useAppRefreshTick();

  React.useEffect(() => {
    (async () => {
      try {
        if (!postId) return;

        const foundPost = await getPostByIdDb(postId);

        if (foundPost) {
          setPost(foundPost);
          // Load likes data in parallel
          const [stats, myLikes, counts] = await Promise.all([
            getPostLikesDb(postId),
            getUserPostLikesDb(postId),
            getCommentCountsBatchDb([postId]).catch(() => new Map<string, number>()),
          ]);
          setLikeStats(stats);
          setUserLikes(myLikes);
          setCommentCount(counts.get(postId) ?? 0);
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
          description: err?.message || t("retry"),
        });
        navigate(-1);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, refreshTick]);

  const totalLikes = likeStats.apoio + likeStats.continua + likeStats.ganhador + likeStats.consegueMais + likeStats.limiteMaior + likeStats.maisAlgum;

  const description = post?.description ?? "";
  const isDescTruncatable = isCaptionTruncatable(description);
  const truncatedDescription = collapsedCaption(description);
  const photos = post?.photos && post.photos.length > 0
    ? post.photos
    : post?.photo ? [post.photo] : null;
  // Post em vídeo: `photo` é a capa (ver PostCard).
  const videoUrl = post?.video_url || null;

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
        <div ref={setStageEl} className="flex-1 min-w-0 min-h-0 flex items-center justify-center">
        <div
          className="relative overflow-hidden fade-in select-none"
          style={{
            // Antes da 1ª medição: quadrado pela largura (o caso comum no iPhone).
            ...(cardSide ? { width: cardSide, height: cardSide } : { width: "100%", aspectRatio: "1 / 1" }),
            flexShrink: 0,
            borderRadius: "28px", boxShadow: "0 20px 44px -16px rgba(0,0,0,.7)", WebkitTouchCallout: "none",
          }}
          {...holdHandlers}
          /* O clique que encerra um "segurar" não chega aos filhos (ex.: a
             legenda, que expandiria ao toque). */
          onClickCapture={(e) => {
            if (consumeHoldClick()) {
              e.stopPropagation();
              e.preventDefault();
            }
          }}
        >
          {photos || videoUrl ? (
            <PostCarousel
              photos={photos ?? []}
              alt="Post"
              hideDots
              // O contador "1/N" ficava atrás do menu "⋮" — a posição já é
              // mostrada pelos dots próprios da tela, no rodapé do card.
              hideCounter
              fill
              onIndexChange={setCarouselIndex}
              videoUrl={videoUrl}
              videoPaused={holdHidden}
            />
          ) : (
            <div className="w-full h-full" style={{ background: getPostGradient(post.id) }} />
          )}

          {/* Dark gradient overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(to bottom,rgba(0,0,0,.1) 0%,transparent 28%,transparent 55%,rgba(0,0,0,.65) 100%)", ...holdHiddenStyle }}
          />

          {/* Compact pill — user identity (top-left). Meta e treino (halter, só
              ícone) são selos DENTRO da pílula — mesmo layout do PostCard. */}
          <div
            className="absolute top-3 left-3 inline-flex items-center gap-2 pointer-events-auto z-10"
            style={{ height: "44px", borderRadius: "22px", padding: "0 12px 0 6px", ...GLASS_TOP, ...holdHiddenStyle }}
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
              <div className="text-[13px] font-semibold text-white flex items-center gap-1 leading-tight" style={{ maxWidth: "160px", textShadow: GLASS_TEXT_SHADOW }}>
                <span className="truncate min-w-0">{post.userNickname}</span>
                {post.isVerified && <VerifiedBadge size="sm" tier={post.verifiedTier} />}
              </div>
              <div className="text-[10.5px] text-white/75 leading-tight" style={{ textShadow: GLASS_TEXT_SHADOW }}>{formatTimeAgo(post.created_at)}</div>
            </button>

            {postGoal && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setGoalDrawerOpen(true);
                }}
                className="flex-shrink-0 text-[10.5px] font-semibold text-white px-2 py-0.5 rounded-full active:scale-95 transition-transform"
                style={{ background: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.18)" }}
                aria-label={postGoal.description}
              >
                🎯 {Math.round(Math.min(100, Math.max(0, postGoal.perc ?? 0)))}%
              </button>
            )}

            {/* "Ver treino" — os dados do autor habilitam o "Comparar" DENTRO do drawer. */}
            {FEATURES.workoutDetailOnPost && post.workoutSummary && (
              <WorkoutDetailButton
                summary={post.workoutSummary}
                authorId={post.user_id}
                authorNickname={post.userNickname ?? null}
                authorPhoto={post.userPhoto ?? null}
                variant="icon"
              />
            )}
          </div>

          {/* Context menu (top-right) — compartilhar para todos; editar/excluir só para o dono */}
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5" style={holdHiddenStyle}>
            {videoUrl && <PostVideoMuteButton />}
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
                {post.user_id !== user?.id && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => setSafetyOpen(true)}
                      className="text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950"
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      {t("user_safety_title")}
                    </DropdownMenuItem>
                  </>
                )}
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
          <div className="absolute bottom-3 left-3 right-3 z-10 pointer-events-auto" style={holdHiddenStyle}>
            {/* Carousel indicator — ACIMA da legenda (2026-09-30) */}
            {!videoUrl && photos && photos.length > 1 && (
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

            {/* Quem repostou — o post é um só, também no perfil dessas pessoas */}
            {(post.repostedBy?.length ?? 0) > 0 && (
              <div className="mb-2">
                <RepostedBy users={post.repostedBy!} />
              </div>
            )}

            {/* Pessoas marcadas — "com fulano" (1) navega ao perfil; 2+ abre a lista */}
            {FEATURES.postTags && (post.taggedUsers?.length ?? 0) > 0 && (
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
                  // pre-wrap: respeita as quebras de linha que a pessoa digitou.
                  "text-[13px] text-white leading-snug mb-2.5 px-1 whitespace-pre-wrap break-words",
                  isDescTruncatable && "cursor-pointer",
                  isDescTruncatable && descExpanded && "overflow-y-auto",
                )}
                style={{
                  textShadow: "0 1px 8px rgba(0,0,0,.5)",
                  // Teto proporcional ao card quadrado (40vh cobria o card
                  // inteiro num iPhone pequeno); rola por dentro.
                  ...(isDescTruncatable && descExpanded
                    ? { maxHeight: cardSide ? Math.round(cardSide * 0.42) : "40vh" }
                    : {}),
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
                    {renderWithHashtags(description, (tag) => navigate(`/tag/${encodeURIComponent(tag)}`), openProfileByHandle)}
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
                    {renderWithHashtags(truncatedDescription, (tag) => navigate(`/tag/${encodeURIComponent(tag)}`), openProfileByHandle)}
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
                    commentCount={commentCount}
                    hasActivity={false}
                    onCountChange={setCommentCount}
                    isPostOwner={post.user_id === user?.id}
                    defaultOpen={navState?.openComments === true}
                  />
                </div>
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

      {/* Meta vinculada ao post — somente leitura, como no perfil de outra
        pessoa (editar/excluir/vincular rotinas vivem na tela de Metas). */}
      <GoalDetailDrawer
        goal={goalDrawerOpen ? postGoal : null}
        routines={[]}
        onClose={() => setGoalDrawerOpen(false)}
        onEditGoal={async () => {}}
        onDeleteGoal={async () => {}}
        onToggleRoutineLink={async () => {}}
        readOnly
        replyTo={
          post && user && post.user_id !== user.id
            ? { userId: post.user_id, nickname: post.userNickname ?? "" }
            : null
        }
      />

      {post.user_id !== user?.id && (
        <UserSafetyDrawer
          open={safetyOpen}
          onOpenChange={setSafetyOpen}
          userId={post.user_id}
          userName={post.userNickname ?? ""}
          // Esta tela é o destino de todo deep link compartilhado: quem chega
          // por um link abusivo precisa poder denunciar a PUBLICAÇÃO, não só o
          // autor. Sem isto, a única denúncia possível aqui era a do usuário.
          content={{ type: "post", id: post.id, label: t("report_post") }}
          // Depois de bloquear, o post deste usuário não deveria mais estar
          // visível — voltamos para a tela anterior em vez de deixá-lo aberto.
          onBlocked={() => navigate(-1)}
        />
      )}

      <ShareDrawer
        open={shareDrawerOpen}
        onOpenChange={setShareDrawerOpen}
        text={description
          ? `${t("share_post_text").replace("{handle}", post.userNickname ?? "")}\n"${description}"`
          : t("share_post_text").replace("{handle}", post.userNickname ?? "")}
        url={postShareUrl(post.id)}
        title={t("feed_share_post_title")}
        onSendToFriend={() => setSendToFriendOpen(true)}
        // "Seu flow" (dono ou marcado) e "Seu feed" (marcado) — ver usePostReshare.
        onShareToFlow={postReshare.shareToFlow}
        onEditFlow={postReshare.editFlow}
        onRepostToFeed={postReshare.repostToFeed}
        repostedToFeed={postReshare.repostedToFeed}
        onUndoRepostToFeed={postReshare.undoRepostToFeed}
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
