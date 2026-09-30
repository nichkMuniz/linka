import * as React from "react";
import { createPortal } from "react-dom";
import { ArrowLeft } from "lucide-react";
import { PostCard } from "@/components/feed/post-card";
import { ScreenAura } from "@/components/shared/screen-aura";
import { PostLikesModal } from "@/components/modals/post-likes-modal";
import { ReportDrawer } from "@/components/shared/report-drawer";
import { BlockUserDialog } from "@/components/shared/block-user-dialog";
import { EditPostDrawer } from "@/components/post/edit-post-drawer";
import { GoalDetailDrawer } from "@/components/goals/goal-detail-drawer";
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
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/lib/language-context";
import { hapticLight } from "@/lib/haptics";
import { reportHandledError } from "@/lib/monitoring";
import {
  deletePostDb,
  flushPendingIncentivesDb,
  getPostLikeUsersDb,
  getUserGoalByIdDb,
  type PostIncentiveType,
  type PostUserGoal,
  type PostWithUser,
  type SearchUser,
  type UserGoal,
} from "@/lib/ritmofit-db";
import { togglePostLike, withPostStats, type PostWithStats } from "@/services/post.service";

interface ProfilePostsViewerProps {
  open: boolean;
  onClose: () => void;
  /** Posts da aba aberta (Publicações, Treinos ou Marcações), na ordem da grade. */
  posts: PostWithUser[];
  /** Post tocado na grade — a lista abre rolada até ele. */
  initialPostId: string | null;
  title: string;
  /** @ do dono do perfil, no subtítulo da barra. */
  handle: string | null;
  /**
   * Metas do dono do perfil (só no PRÓPRIO perfil). O `userGoal` embutido no
   * post só vem para metas públicas; com esta lista, a meta privada do próprio
   * dono também aparece no selo do card.
   */
  ownerGoals?: UserGoal[];
  /** Compartilhar — usa o ShareDrawer/usePostReshare do Perfil. */
  onShare: (post: PostWithStats) => void;
  onPostDeleted: (postId: string) => void;
  onPostEdited: (postId: string, description?: string, taggedUsers?: SearchUser[]) => void;
  onBlocked?: () => void;
}

const EMPTY_LIKES = { apoio: 0, continua: 0, ganhador: 0, consegueMais: 0, limiteMaior: 0, maisAlgum: 0 };

function toGoalRef(g: UserGoal): PostUserGoal {
  return {
    id: g.id,
    goal_id: g.goal_id,
    is_custom: g.is_custom,
    description: g.description,
    perc: g.perc,
    duration: g.duration,
    quantity: g.quantity,
    type_goal: g.type_goal,
    actual_progress: Math.round((g.perc / 100) * g.quantity),
    visibility: g.visibility,
  };
}

/**
 * Publicações do Perfil em tela cheia, com o MESMO `PostCard` do feed
 * (2026-09-30). Substitui o drawer próprio do Perfil, que tinha outro layout
 * (título "Post", foto encaixada, legenda cortada em 30 caracteres, botões
 * Editar/Deletar sempre à vista). Abre rolada até o post tocado e segue com os
 * próximos da mesma aba, como no Instagram.
 *
 * Fica em `z-[45]`: acima da página e ABAIXO dos drawers/diálogos do app
 * (`z-50`) que os cards abrem (comentários, compartilhar, editar). O header e o
 * menu do AppLayout somem via `data-fullscreen-step` enquanto está aberta.
 */
export function ProfilePostsViewer({
  open,
  onClose,
  posts,
  initialPostId,
  title,
  handle,
  ownerGoals,
  onShare,
  onPostDeleted,
  onPostEdited,
  onBlocked,
}: ProfilePostsViewerProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [items, setItems] = React.useState<PostWithStats[]>([]);
  const itemsRef = React.useRef<PostWithStats[]>([]);
  itemsRef.current = items;
  const [togglingIncentives, setTogglingIncentives] = React.useState<Set<string>>(new Set());
  const togglingRef = React.useRef<Set<string>>(new Set());
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const scrolledToRef = React.useRef<string | null>(null);

  const [likesOpen, setLikesOpen] = React.useState(false);
  const [likes, setLikes] = React.useState<any[]>([]);
  const [likesLoading, setLikesLoading] = React.useState(false);
  const [goal, setGoal] = React.useState<UserGoal | null>(null);
  const [goalPost, setGoalPost] = React.useState<PostWithStats | null>(null);
  const [report, setReport] = React.useState<{ post: PostWithStats; type: "user" | "post" } | null>(null);
  const [blockTarget, setBlockTarget] = React.useState<{ id: string; name: string } | null>(null);
  const [editing, setEditing] = React.useState<PostWithStats | null>(null);
  const [deleting, setDeleting] = React.useState<PostWithStats | null>(null);

  // ── Abrir: monta na hora com os dados embutidos e completa as estatísticas ──
  React.useEffect(() => {
    if (!open) return;
    const goalsById = new Map((ownerGoals ?? []).map((g) => [String(g.id), g]));
    const withGoal = (p: PostWithUser): PostWithUser =>
      !p.userGoal && p.user_goal_id != null && goalsById.has(String(p.user_goal_id))
        ? { ...p, userGoal: toGoalRef(goalsById.get(String(p.user_goal_id))!) }
        : p;
    const base = posts.map(withGoal);
    // Primeiro render sem contadores (a lista já pode rolar até o post tocado);
    // incentivos e comentários chegam em seguida, em lote.
    setItems(base.map((p) => ({
      ...p,
      likes: { ...EMPTY_LIKES },
      userLikes: [],
      commentCount: 0,
      hasActivity: false,
      userNickname: p.userNickname || "Usuário",
      userPhoto: p.userPhoto ?? null,
    })));
    let cancelled = false;
    withPostStats(base)
      .then((full) => { if (!cancelled) setItems(full); })
      .catch((err) => reportHandledError(err, "profile-posts-viewer:stats"));
    return () => { cancelled = true; };
    // `posts` só é lido na abertura: depois a lista local é a fonte (curtir,
    // editar e excluir atualizam aqui e avisam o Perfil).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPostId]);

  // Rola até o post tocado (uma vez por abertura).
  React.useLayoutEffect(() => {
    if (!open) { scrolledToRef.current = null; return; }
    if (!initialPostId || scrolledToRef.current === initialPostId || items.length === 0) return;
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-post-id="${CSS.escape(initialPostId)}"]`);
    if (el) {
      el.scrollIntoView({ block: "start" });
      scrolledToRef.current = initialPostId;
    }
  }, [open, initialPostId, items.length]);

  // Esconde header/menu do AppLayout e trava a rolagem da página por trás.
  React.useEffect(() => {
    if (!open) return;
    document.body.dataset.fullscreenStep = "true";
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      delete document.body.dataset.fullscreenStep;
      html.style.overflow = prevOverflow;
    };
  }, [open]);

  // ── Incentivo: otimista, mesmo modelo do feed ──
  const applyOptimisticLike = (list: PostWithStats[], postId: string, type: PostIncentiveType) =>
    list.map((post) => {
      if (post.id !== postId) return post;
      const wasActive = post.userLikes.includes(type);
      const userLikes = wasActive ? post.userLikes.filter((x) => x !== type) : [...post.userLikes, type];
      const l = { ...post.likes };
      const delta = wasActive ? -1 : 1;
      if (type === 1) l.apoio += delta;
      else if (type === 2) l.continua += delta;
      else if (type === 3) l.ganhador += delta;
      else if (type === 4) l.consegueMais += delta;
      else if (type === 5) l.limiteMaior += delta;
      else if (type === 6) l.maisAlgum += delta;
      return { ...post, likes: l, userLikes };
    });

  const handleToggleLike = React.useCallback((postId: string, type: PostIncentiveType) => {
    const key = `${postId}-${type}`;
    if (togglingRef.current.has(key)) return;
    const wasActive = itemsRef.current.find((p) => p.id === postId)?.userLikes.includes(type) ?? false;
    togglingRef.current.add(key);
    setTogglingIncentives(new Set(togglingRef.current));
    setItems((prev) => applyOptimisticLike(prev, postId, type));
    togglePostLike(postId, type, !wasActive)
      .catch((err) => {
        setItems((prev) => applyOptimisticLike(prev, postId, type));
        reportHandledError(err, "profile-posts-viewer:incentive", { postId });
        toast({ title: t("feed_incentive_save_error"), description: t("retry"), variant: "destructive" });
      })
      .finally(() => {
        togglingRef.current.delete(key);
        setTogglingIncentives(new Set(togglingRef.current));
      });
  }, [t]);

  const handleOpenLikes = React.useCallback(async (post: PostWithStats) => {
    if (likesLoading) return;
    setLikesLoading(true);
    try {
      await flushPendingIncentivesDb(post.id);
      setLikes(await getPostLikeUsersDb(post.id));
      setLikesOpen(true);
    } catch (err) {
      reportHandledError(err, "profile-posts-viewer:likes", { postId: post.id });
      toast({ title: t("error"), description: t("post_incentives_load_error"), variant: "destructive" });
    } finally {
      setLikesLoading(false);
    }
  }, [likesLoading, t]);

  // Meta vinculada — somente leitura, igual ao PostDetail.
  const handleOpenGoal = React.useCallback(async (post: PostWithStats) => {
    const goalId = post.userGoal?.id ?? (post.user_goal_id != null ? String(post.user_goal_id) : null);
    if (!goalId) return;
    try {
      const g = await getUserGoalByIdDb(goalId);
      if (g) {
        setGoalPost(post);
        setGoal(g);
      }
    } catch (err) {
      reportHandledError(err, "profile-posts-viewer:goal", { goalId });
      toast({ title: t("error"), description: t("retry"), variant: "destructive" });
    }
  }, [t]);

  const handleReportUser = React.useCallback((post: PostWithStats) => setReport({ post, type: "user" }), []);
  const handleReportPost = React.useCallback((post: PostWithStats) => setReport({ post, type: "post" }), []);
  const handleBlockUser = React.useCallback(
    (post: PostWithStats) => setBlockTarget({ id: post.user_id, name: post.userNickname }),
    [],
  );
  const handleEdit = React.useCallback((post: PostWithStats) => setEditing(post), []);
  const handleDelete = React.useCallback((post: PostWithStats) => setDeleting(post), []);

  const confirmDelete = async () => {
    const post = deleting;
    setDeleting(null);
    if (!post) return;
    try {
      await deletePostDb(post.id);
      const rest = itemsRef.current.filter((p) => p.id !== post.id);
      setItems(rest);
      onPostDeleted(post.id);
      toast({ title: t("newpost_success"), description: t("post_deleted_success") });
      if (rest.length === 0) onClose();
    } catch (err: any) {
      reportHandledError(err, "profile-posts-viewer:delete", { postId: post.id });
      toast({ title: t("post_delete_error"), description: err?.message || t("retry"), variant: "destructive" });
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[45] isolate bg-background animate-in fade-in slide-in-from-right-4 duration-200"
    >
      <ScreenAura variant="feed" />

      {/* Barra própria: voltar + "Publicações · @handle" (o header global some).
          z-20 + lista em camada própria (z-0, abaixo): os selos do PostCard
          (pílula do autor, ⋮, barra de incentivos) usam z-10 e, sem isso,
          passavam POR CIMA da barra ao rolar. */}
      <header
        className="absolute z-20 flex items-center justify-between"
        style={{
          top: "max(14px, calc(env(safe-area-inset-top) + 6px))",
          left: 14,
          right: 14,
          height: 52,
          borderRadius: 26,
          padding: "0 4px",
          background: "linear-gradient(rgba(255,255,255,.13),rgba(255,255,255,.05))",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          border: "1px solid rgba(255,255,255,.14)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.22), 0 8px 24px -8px rgba(0,0,0,.5)",
        }}
      >
        <button
          onClick={() => { hapticLight(); onClose(); }}
          aria-label={t("back")}
          className="flex h-11 w-11 items-center justify-center rounded-full text-white active:scale-95 transition-transform"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 text-center">
          <div className="truncate text-[16px] font-bold leading-tight text-white">{title}</div>
          {handle && (
            <div className="truncate text-[12px] font-medium leading-tight text-white/55">@{handle.replace(/^@/, "")}</div>
          )}
        </div>
        <span aria-hidden className="h-11 w-11" />
      </header>

      <div
        ref={scrollRef}
        className="relative z-0 h-full overflow-y-auto overscroll-contain"
        style={{
          paddingTop: "var(--app-header-offset)",
          paddingBottom: "max(24px, env(safe-area-inset-bottom))",
        }}
      >
        {items.map((post) => (
          <div key={post.id} data-post-id={post.id} style={{ scrollMarginTop: "var(--app-header-offset)" }}>
            <PostCard
              post={post}
              currentUserId={user?.id}
              togglingIncentives={togglingIncentives}
              likesLoading={likesLoading}
              onToggleLike={handleToggleLike}
              onOpenLikes={handleOpenLikes}
              onOpenGoal={handleOpenGoal}
              onShare={onShare}
              onReportUser={handleReportUser}
              onReportPost={handleReportPost}
              onBlockUser={handleBlockUser}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </div>
        ))}
      </div>

      <PostLikesModal open={likesOpen} onOpenChange={setLikesOpen} likes={likes} />

      <GoalDetailDrawer
        goal={goal}
        routines={[]}
        onClose={() => { setGoal(null); setGoalPost(null); }}
        onEditGoal={async () => {}}
        onDeleteGoal={async () => {}}
        onToggleRoutineLink={async () => {}}
        readOnly
        replyTo={
          goalPost && user && goalPost.user_id !== user.id
            ? { userId: goalPost.user_id, nickname: goalPost.userNickname ?? "" }
            : null
        }
      />

      <ReportDrawer
        open={!!report}
        onOpenChange={(o) => { if (!o) setReport(null); }}
        type={report?.type ?? null}
        target={
          report
            ? {
                id: report.post.id,
                userId: report.post.user_id,
                userName: report.post.userNickname,
                description: report.post.description,
              }
            : null
        }
      />

      <BlockUserDialog
        open={!!blockTarget}
        onOpenChange={(o) => { if (!o) setBlockTarget(null); }}
        userId={blockTarget?.id ?? null}
        userName={blockTarget?.name ?? ""}
        onDone={() => {
          setBlockTarget(null);
          onClose();
          onBlocked?.();
        }}
      />

      <EditPostDrawer
        open={!!editing}
        onOpenChange={(v) => { if (!v) setEditing(null); }}
        post={editing}
        onSaved={(newDescription, newTaggedUsers) => {
          const id = editing?.id;
          if (!id) return;
          setItems((prev) =>
            prev.map((p) =>
              p.id === id
                ? {
                    ...p,
                    ...(newDescription !== undefined ? { description: newDescription } : {}),
                    ...(newTaggedUsers !== undefined ? { taggedUsers: newTaggedUsers } : {}),
                  }
                : p,
            ),
          );
          onPostEdited(id, newDescription, newTaggedUsers);
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("post_delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("post_delete_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>,
    document.body,
  );
}
