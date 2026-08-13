import * as React from "react";
import { getFeedPosts, getDiscoverPosts, togglePostLike, FEED_PAGE_SIZE, DISCOVER_PAGE_SIZE } from "../services/post.service";
import { withNetworkRetry, checkSupabaseReachability } from "@/lib/network-status";
import { probeFlowVideo } from "@/lib/video-poster";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import {
  getRoutinesByGoalIdDb,
  getRoutineItemsForViewDb,
  getActiveStoriesDb,
  getFlowByIdDb,
  getUserProfileDb,
  createStoryDb,
  deleteOldStoriesDb,
  getMyViewedFlowUserIdsDb,
  createUserGoalDb,
  updateUserGoalDb,
  deletePostDb,
  getPostLikeUsersDb,
  flushPendingIncentivesDb,
  copyRoutineToUserDb,
  getAllUsersDb,
  type SearchUser,
  type PostIncentiveType,
  type StoryWithUser,
  invalidateProfileCache,
  invalidateQueryCache,
} from "@/lib/ritmofit-db";
import { UserAvatar } from "@/components/shared/user-avatar";
import { FollowButton } from "@/components/shared/follow-button";
import { PostLikesModal } from "@/components/modals/post-likes-modal";
import { ReportDrawer } from "@/components/shared/report-drawer";
import { GoalCompletedDialog } from "@/components/shared/goal-completed-dialog";
import { ShareDrawer } from "@/components/shared/share-drawer";
import { SendToFriendDrawer, type SendableContent } from "@/components/shared/send-to-friend-drawer";
import { postShareUrl } from "@/lib/share-url";
import { EditPostDrawer } from "@/components/post/edit-post-drawer";
import { PostCard } from "@/components/feed/post-card";
import { LazyMount } from "@/components/shared/lazy-mount";
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
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { PostSkeleton } from "@/components/shared/animated-loading";
import type { PostWithStats } from "../services/post.service";
import { FlowCarousel } from "@/components/feed/flow-carousel";
import { FlowCreationDialog } from "@/components/modals/flow-creation-dialog";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/lib/language-context";
import { hapticLight } from "@/lib/haptics";
import { GLASS_SHEET_STYLE, GLASS_SHEET_PROPS, GLASS_PANEL_STYLE, GLASS_PRIMARY_BTN_STYLE } from "@/lib/glass-styles";

// ─────────────────────────────────────────────────────────────────────────
// Cache persistente do feed (singleton em nível de módulo).
// Mantém a tela de feed "estática" entre navegações: ao sair do feed e voltar,
// o estado anterior (posts, stories, rings, aba e scroll) é restaurado na hora,
// sem refetch — eliminando o flash de rings desatualizados que acontecia no
// remount. Um refresh real só ocorre na primeira carga, ao tocar no ícone home
// (evento `ritmofit-refresh-feed`) ou no gesto de pull-to-refresh.
// ─────────────────────────────────────────────────────────────────────────
interface FeedCache {
  hydrated: boolean;
  userId: string | null;
  posts: PostWithStats[];
  discoverPosts: PostWithStats[];
  stories: StoryWithUser[];
  viewedStoryIds: Set<string>;
  currentUserPhoto: string | null;
  currentUserNickname: string | null;
  feedTab: "following" | "discover";
  discoverLoaded: boolean;
  hasMoreFeed: boolean;
  hasMoreDiscover: boolean;
  scrollY: number;
}

const feedCache: FeedCache = {
  hydrated: false,
  userId: null,
  posts: [],
  discoverPosts: [],
  stories: [],
  viewedStoryIds: new Set<string>(),
  currentUserPhoto: null,
  currentUserNickname: null,
  feedTab: "following",
  discoverLoaded: false,
  hasMoreFeed: true,
  hasMoreDiscover: true,
  scrollY: 0,
};

export default function Index() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  // O cache só é válido se já foi hidratado pelo mesmo usuário logado.
  const cacheValid = feedCache.hydrated && feedCache.userId === (user?.id ?? null);

  const [posts, setPosts] = React.useState<PostWithStats[]>(() => (cacheValid ? feedCache.posts : []));
  const [discoverPosts, setDiscoverPosts] = React.useState<PostWithStats[]>(() => (cacheValid ? feedCache.discoverPosts : []));
  const postsRef = React.useRef<PostWithStats[]>([]);
  const discoverPostsRef = React.useRef<PostWithStats[]>([]);
  postsRef.current = posts;
  discoverPostsRef.current = discoverPosts;
  const [stories, setStories] = React.useState<StoryWithUser[]>(() => (cacheValid ? feedCache.stories : []));
  const [loading, setLoading] = React.useState(() => !cacheValid);
  const [discoverLoading, setDiscoverLoading] = React.useState(false);
  const [discoverLoaded, setDiscoverLoaded] = React.useState(() => (cacheValid ? feedCache.discoverLoaded : false));
  const [hasMoreFeed, setHasMoreFeed] = React.useState(() => (cacheValid ? feedCache.hasMoreFeed : true));
  const [loadingMoreFeed, setLoadingMoreFeed] = React.useState(false);
  const [hasMoreDiscover, setHasMoreDiscover] = React.useState(() => (cacheValid ? feedCache.hasMoreDiscover : true));
  const [loadingMoreDiscover, setLoadingMoreDiscover] = React.useState(false);
  const [feedTab, setFeedTab] = React.useState<"following" | "discover">(() => (cacheValid ? feedCache.feedTab : "following"));

  // Dica de "puxe para atualizar" — aparece quando o app volta ao foreground
  // depois de ≥5min em background (pode haver novas publicações).
  const [showRefreshHint, setShowRefreshHint] = React.useState(false);

  const togglingIncentivesRef = React.useRef<Set<string>>(new Set());
  const [togglingIncentives, setTogglingIncentives] = React.useState<Set<string>>(new Set());

  const [goalModalOpen, setGoalModalOpen] = React.useState(false);
  const [goalRoutinesLoading, setGoalRoutinesLoading] = React.useState(false);
  const [selectedGoalPost, setSelectedGoalPost] = React.useState<PostWithStats | null>(null);
  const [linkedRoutines, setLinkedRoutines] = React.useState<any[]>([]);
  const [expandedLinkedRoutine, setExpandedLinkedRoutine] = React.useState<string | null>(null);
  const [linkedRoutineItems, setLinkedRoutineItems] = React.useState<Record<string, any[]>>({});
  const [expandedRoutines, setExpandedRoutines] = React.useState(false);

  const [storyCreationOpen, setStoryCreationOpen] = React.useState(false);
  const [isCreatingStory, setIsCreatingStory] = React.useState(false);
  const [currentUserPhoto, setCurrentUserPhoto] = React.useState<string | null>(() => (cacheValid ? feedCache.currentUserPhoto : null));
  const [currentUserNickname, setCurrentUserNickname] = React.useState<string | null>(() => (cacheValid ? feedCache.currentUserNickname : null));
  const [viewedStoryIds, setViewedStoryIds] = React.useState<Set<string>>(() => (cacheValid ? feedCache.viewedStoryIds : new Set()));

  const [shareDrawerOpen, setShareDrawerOpen] = React.useState(false);
  const [shareDrawerText, setShareDrawerText] = React.useState("");
  const [shareDrawerUrl, setShareDrawerUrl] = React.useState<string | undefined>(undefined);
  const [sendToFriendOpen, setSendToFriendOpen] = React.useState(false);
  const [sendToFriendContent, setSendToFriendContent] = React.useState<SendableContent | null>(null);

  const [reportDialogOpen, setReportDialogOpen] = React.useState(false);
  const [reportType, setReportType] = React.useState<"user" | "post" | null>(null);
  const [reportedPost, setReportedPost] = React.useState<PostWithStats | null>(null);

  const [isCopyingGoal, setIsCopyingGoal] = React.useState(false);
  const [hasAlreadyCopiedGoal, setHasAlreadyCopiedGoal] = React.useState(false);
  const [isMarkingGoalComplete, setIsMarkingGoalComplete] = React.useState(false);
  const [completedGoalDescription, setCompletedGoalDescription] = React.useState<string | null>(null);
  const [copyingRoutineKeys, setCopyingRoutineKeys] = React.useState<Set<string>>(new Set());
  const [copiedRoutineKeys, setCopiedRoutineKeys] = React.useState<Set<string>>(new Set());

  // Perfis sugeridos do empty state do feed — só carregados quando o usuário
  // realmente cai nele (não segue ninguém ainda).
  const [suggestedUsers, setSuggestedUsers] = React.useState<SearchUser[]>([]);
  React.useEffect(() => {
    if (loading || posts.length > 0 || !user?.id || suggestedUsers.length > 0) return;
    getAllUsersDb(user.id)
      .then((users) => setSuggestedUsers(users.slice(0, 5)))
      .catch((err) => console.error("Erro ao carregar perfis sugeridos:", err));
  }, [loading, posts.length, user?.id, suggestedUsers.length]);

  const [likesModalOpen, setLikesModalOpen] = React.useState(false);
  const [likesLoading, setLikesLoading] = React.useState(false);
  const [postLikes, setPostLikes] = React.useState<Array<{
    userId: string;
    userNickname: string;
    userPhoto: string | null;
    type: number;
  }>>([]);

  const [editPostOpen, setEditPostOpen] = React.useState(false);
  const [editingPost, setEditingPost] = React.useState<PostWithStats | null>(null);

  const [confirmDialog, setConfirmDialog] = React.useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: "", description: "", onConfirm: () => {} });

  const showConfirm = React.useCallback(
    (title: string, description: string, onConfirm: () => void) => {
      setConfirmDialog({ open: true, title, description, onConfirm });
    },
    [],
  );

  const loadFeed = React.useCallback(async (showLoading = true, force = false) => {
    if (showLoading) setLoading(true);
    try {
      // Os flows/stories têm cache interno (stale-while-revalidate, TTL de 60s) em
      // `getActiveStoriesDb`. Sem invalidar, um refresh manual (pull-to-refresh,
      // tocar no logo, etc.) podia devolver a mesma lista antiga por até 2 ciclos de
      // TTL — exigindo vários refreshs seguidos até o flow novo de um seguidor aparecer.
      //
      // Só invalida quando o refresh é EXPLÍCITO do usuário: na carga inicial isso
      // descartava um cache ainda válido e forçava uma query a cada abertura do app.
      if (force) invalidateQueryCache("activeStories");
      const [postsData, storiesData] = await Promise.all([
        getFeedPosts(),
        getActiveStoriesDb(),
      ]);
      setPosts(postsData);
      setStories(storiesData);
      setHasMoreFeed(postsData.length >= FEED_PAGE_SIZE);
      setLoadingMoreFeed(false);
      setLoading(false);
      feedCache.hydrated = true;
      feedCache.userId = user?.id ?? null;

      const userStory = storiesData.find((s: StoryWithUser) => s.user_id === user?.id);
      if (userStory?.userPhoto) setCurrentUserPhoto((prev) => prev || userStory.userPhoto);

      const activeFlowIds = storiesData.map((s: StoryWithUser) => s.id);
      Promise.all([
        getMyViewedFlowUserIdsDb(activeFlowIds),
        deleteOldStoriesDb().catch((err) => console.error("Error cleaning old stories:", err)),
      ]).then(([viewedUserIds]) => {
        setViewedStoryIds(viewedUserIds as Set<string>);
      }).catch(console.error);
    } catch (err: any) {
      console.error("Erro ao carregar feed:", err?.message || err);
      setLoading(false);
      toast({
        title: t("post_load_error"),
        description: err?.message || t("retry"),
      });
    }
  }, [user?.id, t]);

  // Carga inicial apenas — pulada quando o cache do feed já está hidratado para
  // o usuário atual, para que voltar ao feed restaure o estado anterior na hora,
  // sem reload de rede (sem flash de rings desatualizados).
  React.useEffect(() => {
    if (feedCache.hydrated && feedCache.userId === (user?.id ?? null)) return;
    loadFeed();
  }, [loadFeed, user?.id]);

  // Ao VOLTAR ao feed (cache hidratado → sem reload), ressincroniza quais flows já
  // foram vistos. O viewer grava as visualizações uma a uma enquanto o usuário assiste;
  // sem esta consulta o feed continuaria com a foto antiga do que foi visto, e o anel
  // (e o ponto de entrada do ring) ficariam errados até o próximo reload completo.
  React.useEffect(() => {
    if (!feedCache.hydrated || feedCache.userId !== (user?.id ?? null)) return;
    const activeFlowIds = feedCache.stories.map((s) => s.id);
    if (activeFlowIds.length === 0) return;
    getMyViewedFlowUserIdsDb(activeFlowIds)
      .then(setViewedStoryIds)
      .catch((err) => console.error("Erro ao sincronizar flows vistos:", err));
    // Só no mount (voltar ao feed) — durante a sessão o clique já marca localmente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Persiste o estado vivo do feed no cache de módulo para sobreviver ao unmount.
  React.useEffect(() => {
    feedCache.posts = posts;
    feedCache.discoverPosts = discoverPosts;
    feedCache.stories = stories;
    feedCache.viewedStoryIds = viewedStoryIds;
    feedCache.currentUserPhoto = currentUserPhoto;
    feedCache.currentUserNickname = currentUserNickname;
    feedCache.feedTab = feedTab;
    feedCache.discoverLoaded = discoverLoaded;
    feedCache.hasMoreFeed = hasMoreFeed;
    feedCache.hasMoreDiscover = hasMoreDiscover;
  }, [posts, discoverPosts, stories, viewedStoryIds, currentUserPhoto, currentUserNickname, feedTab, discoverLoaded, hasMoreFeed, hasMoreDiscover]);

  // Restaura (no mount) e salva (no unmount) a posição de scroll entre navegações.
  React.useEffect(() => {
    if (cacheValid && feedCache.scrollY > 0) {
      const y = feedCache.scrollY;
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
    }
    return () => {
      feedCache.scrollY = window.scrollY;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Marca um flow como visto otimisticamente ao abri-lo pelo carrossel, para
  // que o ring acinzente imediatamente sem precisar recarregar o feed.
  const handleStoryViewed = React.useCallback((storyId: string) => {
    setViewedStoryIds((prev) => (prev.has(storyId) ? prev : new Set(prev).add(storyId)));
  }, []);

  // Open a specific flow when navigating from a notification. If it's no longer
  // in the active ring (expired >24h), redirect to the flow archive (own flow)
  // showing that exact media, instead of silently doing nothing.
  React.useEffect(() => {
    const state = location.state as { openFlow?: string } | null;
    if (!state?.openFlow || loading) return;
    const flowId = state.openFlow;
    navigate(location.pathname, { replace: true, state: {} });

    const targetStory = stories.find((s) => String(s.id) === String(flowId));
    if (targetStory) {
      navigate(`/flows/${targetStory.id}`);
      return;
    }

    (async () => {
      try {
        const flow = await getFlowByIdDb(flowId);
        if (flow && flow.user_id === user?.id) {
          navigate("/perfil", { state: { openFlowArchive: flow } });
        } else {
          toast({ title: t("feed_flow_unavailable") });
        }
      } catch (err) {
        console.error("Error checking expired flow:", err);
      }
    })();
  }, [stories, loading, location.state?.openFlow]);

  React.useEffect(() => {
    const handler = () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      feedCache.scrollY = 0;
      setShowRefreshHint(false);
      setDiscoverLoaded(false);
      setHasMoreDiscover(true);
      loadFeed(false, true);
    };
    window.addEventListener("ritmofit-refresh-feed", handler);
    return () => window.removeEventListener("ritmofit-refresh-feed", handler);
  }, [loadFeed]);

  // Dica de atualização ao voltar ao app depois de ≥5min em background: o feed é
  // um cache estático entre navegações (não recarrega sozinho), então avisamos o
  // usuário que pode haver novas publicações e que basta puxar para baixo. Usa o
  // appStateChange do Capacitor (nativo) ou visibilitychange (web) para medir
  // quanto tempo o app ficou fora do foreground.
  const backgroundedAtRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    const STALE_MS = 5 * 60 * 1000;
    const onHide = () => {
      backgroundedAtRef.current = Date.now();
    };
    const onShow = () => {
      const since = backgroundedAtRef.current;
      backgroundedAtRef.current = null;
      if (since !== null && Date.now() - since >= STALE_MS) {
        setShowRefreshHint(true);
      }
    };

    if (Capacitor.isNativePlatform()) {
      let listener: { remove: () => void } | null = null;
      CapApp.addListener("appStateChange", ({ isActive }) => {
        if (isActive) onShow();
        else onHide();
      }).then((l) => {
        listener = l;
      });
      return () => listener?.remove();
    }

    const onVisibility = () => {
      if (document.hidden) onHide();
      else onShow();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Some sozinha depois de alguns segundos — é só uma dica, não bloqueia nada.
  React.useEffect(() => {
    if (!showRefreshHint) return;
    const id = setTimeout(() => setShowRefreshHint(false), 9000);
    return () => clearTimeout(id);
  }, [showRefreshHint]);

  // Recarrega o feed ao chegar com refreshFeed (ex.: após compartilhar um treino),
  // ignorando o cache para que a publicação recém-criada apareça no topo na hora.
  React.useEffect(() => {
    const state = location.state as { refreshFeed?: boolean } | null;
    if (!state?.refreshFeed) return;
    navigate(location.pathname, { replace: true, state: {} });
    window.scrollTo({ top: 0, behavior: "auto" });
    feedCache.scrollY = 0;
    loadFeed(false, true);
  }, [location.state?.refreshFeed, loadFeed, navigate, location.pathname]);

  // Infinite scroll: load more following-feed posts as the user approaches the
  // end of the current page. Cursor is the created_at of the oldest post.
  const feedBottomSentinelRef = React.useRef<HTMLDivElement | null>(null);
  const loadMoreFeed = React.useCallback(async () => {
    if (loadingMoreFeed || !hasMoreFeed) return;
    const oldest = postsRef.current[postsRef.current.length - 1];
    if (!oldest) return;
    setLoadingMoreFeed(true);
    try {
      const more = await getFeedPosts({ before: oldest.created_at });
      if (more.length === 0) {
        setHasMoreFeed(false);
      } else {
        setPosts((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const merged = [...prev];
          for (const p of more) if (!seen.has(p.id)) merged.push(p);
          return merged;
        });
        if (more.length < FEED_PAGE_SIZE) setHasMoreFeed(false);
      }
    } catch (err) {
      console.error("Erro ao carregar mais posts:", err);
    } finally {
      setLoadingMoreFeed(false);
    }
  }, [loadingMoreFeed, hasMoreFeed]);

  React.useEffect(() => {
    if (loading || !hasMoreFeed) return;
    const node = feedBottomSentinelRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMoreFeed();
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loading, hasMoreFeed, loadMoreFeed]);

  // Discover posts are loaded lazily — only when the user scrolls close to
  // the divider, or right after onboarding for new users. This saves the
  // initial render from paying for an extra ~30-post enrichment query that
  // most users never see on first visit.
  const discoverSentinelRef = React.useRef<HTMLDivElement | null>(null);
  const discoverBottomSentinelRef = React.useRef<HTMLDivElement | null>(null);
  const loadDiscover = React.useCallback(() => {
    if (discoverLoaded || discoverLoading) return;
    setDiscoverLoading(true);
    getDiscoverPosts()
      .then((data) => {
        setDiscoverPosts(data);
        setDiscoverLoaded(true);
        setHasMoreDiscover(data.length >= DISCOVER_PAGE_SIZE);
      })
      .catch((err) => console.error("Erro ao carregar posts populares:", err))
      .finally(() => setDiscoverLoading(false));
  }, [discoverLoaded, discoverLoading]);

  // Scroll infinito do Discover: carrega a próxima página (posts mais antigos) usando o
  // created_at do último post já exibido como cursor, mesclando com dedup por id.
  const loadMoreDiscover = React.useCallback(async () => {
    if (loadingMoreDiscover || !hasMoreDiscover || !discoverLoaded) return;
    // O Discover é ranqueado (não cronológico), então o cursor de paginação é o
    // created_at MÍNIMO já carregado — não o último item exibido. Strings ISO 8601
    // comparam corretamente por ordem lexicográfica.
    let oldestCreatedAt: string | undefined;
    for (const p of discoverPostsRef.current) {
      if (!oldestCreatedAt || p.created_at < oldestCreatedAt) oldestCreatedAt = p.created_at;
    }
    if (!oldestCreatedAt) return;
    setLoadingMoreDiscover(true);
    try {
      const more = await getDiscoverPosts({ before: oldestCreatedAt });
      if (more.length === 0) {
        setHasMoreDiscover(false);
      } else {
        setDiscoverPosts((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const merged = [...prev];
          for (const p of more) if (!seen.has(p.id)) merged.push(p);
          return merged;
        });
        if (more.length < DISCOVER_PAGE_SIZE) setHasMoreDiscover(false);
      }
    } catch (err) {
      console.error("Erro ao carregar mais posts populares:", err);
    } finally {
      setLoadingMoreDiscover(false);
    }
  }, [loadingMoreDiscover, hasMoreDiscover, discoverLoaded]);

  React.useEffect(() => {
    if (feedTab !== "discover" || !discoverLoaded || !hasMoreDiscover) return;
    const node = discoverBottomSentinelRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMoreDiscover();
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [feedTab, discoverLoaded, hasMoreDiscover, loadMoreDiscover]);

  React.useEffect(() => {
    if (loading || discoverLoaded) return;
    const node = discoverSentinelRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      if (feedTab === "discover") {
        loadDiscover();
      }
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          loadDiscover();
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loading, discoverLoaded, loadDiscover, feedTab]);

  // Load current user's profile photo
  React.useEffect(() => {
    if (!user?.id) return;
    if (localStorage.getItem("force_profile_reload") === "1") {
      localStorage.removeItem("force_profile_reload");
      invalidateProfileCache(user.id);
    }
    getUserProfileDb(user.id)
      .then((profile) => {
        if (profile?.photo) setCurrentUserPhoto(profile.photo);
        if (profile?.nickname) setCurrentUserNickname(profile.nickname);
      })
      .catch((err) => console.error("Erro ao carregar foto do perfil:", err));
  }, [user?.id]);

  React.useEffect(() => {
    const flag = localStorage.getItem("new_user_open_discover");
    if (flag === "1" && user?.id) {
      localStorage.removeItem("new_user_open_discover");
      loadDiscover();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleCreateStory = React.useCallback(
    async (
      mediaDataUrl: string,
      description: string,
      backgroundColor?: string | null,
      textPosition?: { x: number; y: number } | null,
      textElements?: { text: string; x: number; y: number }[] | null,
      mediaTransform?: { scale: number; x: number; y: number } | null,
      taggedUserIds?: string[],
    ) => {
      setIsCreatingStory(true);
      try {
        if (!user || !supabase) throw new Error("User not authenticated");

        let publicUrl = "";
        let posterUrl = "";
        let durationMs: number | null = null;

        if (mediaDataUrl) {
          // Pre-warm network stack on iOS WKWebView to prevent "Load failed" on first attempt
          await checkSupabaseReachability().catch(() => {});

          const response = await fetch(mediaDataUrl);
          const blob = await response.blob();

          const mimeType = blob.type || "image/jpeg";
          const rawExtension = mimeType.split("/")[1] || "jpg";
          const extension = rawExtension === "quicktime" ? "mov" : rawExtension;
          const stamp = Date.now();
          const filePath = `${user.id}/stories/${stamp}-story.${extension}`;

          // Sonda o vídeo enquanto o arquivo ainda é local (barato): capa de ~40KB com o
          // 1º frame + duração real. A capa evita a tela preta ao abrir; a duração é o
          // que mantém a barra de progresso sincronizada desde o primeiro frame, sem
          // depender do clipe inteiro ter baixado.
          const probe = mimeType.startsWith("video/")
            ? await probeFlowVideo(mediaDataUrl).catch(() => null)
            : null;
          const posterBlob = probe?.poster ?? null;
          durationMs = probe?.durationMs ?? null;

          const uploadPoster = async (): Promise<string> => {
            if (!posterBlob) return "";
            try {
              const posterPath = `${user.id}/stories/${stamp}-poster.jpg`;
              const { error } = await supabase!.storage
                .from("posts")
                .upload(posterPath, posterBlob, {
                  contentType: "image/jpeg",
                  cacheControl: "86400",
                });
              if (error) return "";
              return supabase!.storage.from("posts").getPublicUrl(posterPath).data.publicUrl;
            } catch {
              // Capa é ganho de percepção — nunca impede a publicação do flow.
              return "";
            }
          };

          // Vídeo e capa sobem em paralelo (a capa é minúscula e chega bem antes).
          const [{ error: uploadError }, uploadedPosterUrl] = await Promise.all([
            withNetworkRetry(
              () =>
                supabase!.storage.from("posts").upload(filePath, blob, {
                  contentType: mimeType,
                  // Flow vive 24h: cache longo deixa o arquivo na borda do CDN durante
                  // toda a vida útil dele, então o 2º espectador em diante nem vai à origem.
                  cacheControl: "86400",
                }),
              { retries: 2, delayMs: 2000 },
            ),
            uploadPoster(),
          ]);

          if (uploadError) throw uploadError;

          const { data: { publicUrl: url } } = supabase.storage.from("posts").getPublicUrl(filePath);
          publicUrl = url;
          posterUrl = uploadedPosterUrl;
        }

        const newStory = await createStoryDb(description, publicUrl, backgroundColor, textPosition, textElements, mediaTransform, taggedUserIds, null, { posterUrl, durationMs });
        if (newStory && user) {
          const enrichedStory: StoryWithUser = {
            ...newStory,
            id: String(newStory.id),
            userNickname: currentUserNickname || user.email?.split("@")[0] || t("nav_you"),
            userPhoto: currentUserPhoto,
          };

          setStories((prev) => [enrichedStory, ...prev]);
          setStoryCreationOpen(false);
          navigate(`/flows/${enrichedStory.id}`);
        }
      } catch (err) {
        console.error("Error creating story:", err);
        throw err;
      } finally {
        setIsCreatingStory(false);
      }
    },
    [user, currentUserNickname, currentUserPhoto, stories],
  );


  const handleAddStoryClick = React.useCallback(() => {
    setStoryCreationOpen(true);
  }, []);

  const openGoalModal = React.useCallback(async (post: PostWithStats) => {
    setSelectedGoalPost(post);
    setGoalModalOpen(true);
    setExpandedRoutines(false);
    setHasAlreadyCopiedGoal(false);
    setExpandedLinkedRoutine(null);
    setLinkedRoutineItems({});
    setCopyingRoutineKeys(new Set());
    setCopiedRoutineKeys(new Set());
    setLinkedRoutines([]);

    if (post.userGoal) {
      setGoalRoutinesLoading(true);
      try {
        const routines = await getRoutinesByGoalIdDb(post.userGoal.goal_id, post.user_id);
        setLinkedRoutines(routines);
      } catch (err) {
        console.error("Error fetching routines:", err);
        setLinkedRoutines([]);
      } finally {
        setGoalRoutinesLoading(false);
      }
    }
  }, []);

  const handleToggleLinkedRoutine = React.useCallback(
    async (groupKey: string, type: number, name: string | undefined, targetUserId: string) => {
      setExpandedLinkedRoutine((prev) => (prev === groupKey ? null : groupKey));
      setLinkedRoutineItems((prev) => {
        if (prev[groupKey] !== undefined) return prev;
        getRoutineItemsForViewDb(targetUserId, type, name)
          .then((items) => setLinkedRoutineItems((p) => ({ ...p, [groupKey]: items })))
          .catch(() => setLinkedRoutineItems((p) => ({ ...p, [groupKey]: [] })));
        return prev;
      });
    },
    [],
  );

  const handleCopyGoal = React.useCallback(async () => {
    if (!selectedGoalPost?.userGoal || !user) return;

    setIsCopyingGoal(true);
    try {
      await createUserGoalDb(
        selectedGoalPost.userGoal.goal_id,
        user.id,
        selectedGoalPost.userGoal.type_goal,
        selectedGoalPost.userGoal.duration,
        selectedGoalPost.userGoal.quantity,
      );

      if (linkedRoutines.length > 0) {
        const seen = new Set<string>();
        const groups = linkedRoutines.reduce<{ type: number; name?: string }[]>((acc, r) => {
          const k = `${r.type}__${r.name ?? ""}`;
          if (!seen.has(k)) {
            seen.add(k);
            acc.push({ type: r.type, name: r.name });
          }
          return acc;
        }, []);

        const routineResults = await Promise.allSettled(
          groups.map(({ type, name }) =>
            copyRoutineToUserDb(
              selectedGoalPost.user_id,
              user.id,
              type as 1 | 2 | 3,
              name ?? null,
            ),
          ),
        );
        const failedCount = routineResults.filter((r) => r.status === "rejected").length;
        if (failedCount > 0) {
          toast({
            title: t("feed_goal_copied_warning"),
            description: t("feed_goal_copied_warning_desc").replace("{n}", String(failedCount)),
            variant: "destructive",
          });
          setHasAlreadyCopiedGoal(true);
          setGoalModalOpen(false);
          return;
        }
      }

      toast({
        title: t("feed_goal_copied"),
        description: t("feed_goal_copied_desc"),
      });
      setHasAlreadyCopiedGoal(true);
      setGoalModalOpen(false);
    } catch (err: any) {
      console.error("Error copying goal:", err);
      toast({
        title: t("feed_goal_copy_error"),
        description: err?.message || t("retry"),
      });
    } finally {
      setIsCopyingGoal(false);
    }
  }, [selectedGoalPost?.userGoal, selectedGoalPost?.user_id, user, linkedRoutines, t]);

  const handleMarkGoalComplete = React.useCallback(() => {
    if (!selectedGoalPost?.userGoal) return;
    showConfirm(
      t("feed_goal_complete_title"),
      t("feed_goal_complete_desc"),
      async () => {
        setIsMarkingGoalComplete(true);
        try {
          const ug = selectedGoalPost.userGoal!;
          await updateUserGoalDb(ug.id, {
            duration: ug.duration,
            quantity: ug.quantity,
            days_completed: ug.duration,
            perc: 100,
            visibility: ug.visibility ?? 1,
          });
          setGoalModalOpen(false);
          setCompletedGoalDescription(ug.description ?? "");
        } catch (err: any) {
          toast({ title: t("error"), description: err?.message || t("retry"), variant: "destructive" });
        } finally {
          setIsMarkingGoalComplete(false);
        }
      },
    );
  }, [selectedGoalPost?.userGoal, showConfirm, t]);

  const handleCopyRoutine = React.useCallback(
    async (sourceUserId: string, routineType: number, routineName: string | undefined) => {
      if (!user) return;
      const key = `${sourceUserId}::${routineType}::${routineName ?? ""}`;
      if (copyingRoutineKeys.has(key) || copiedRoutineKeys.has(key)) return;

      setCopyingRoutineKeys((prev) => new Set(prev).add(key));
      try {
        await copyRoutineToUserDb(sourceUserId, user.id, routineType as 1 | 2 | 3, routineName ?? null);
        setCopiedRoutineKeys((prev) => new Set(prev).add(key));
        toast({
          title: routineType === 1 ? t("feed_workout_copied") : routineType === 2 ? t("feed_diet_copied") : t("feed_habit_copied"),
          description: t("feed_routine_copied_desc").replace("{name}", routineName ?? "Rotina"),
        });
      } catch (err: any) {
        toast({ title: t("feed_copy_error"), description: err?.message || t("retry"), variant: "destructive" });
      } finally {
        setCopyingRoutineKeys((prev) => { const s = new Set(prev); s.delete(key); return s; });
      }
    },
    [user, copyingRoutineKeys, copiedRoutineKeys, t],
  );

  const applyOptimisticLike = (
    list: PostWithStats[],
    postId: string,
    incentiveType: PostIncentiveType,
  ): PostWithStats[] =>
    list.map((post) => {
      if (post.id !== postId) return post;
      const wasActive = post.userLikes.includes(incentiveType);
      const newUserLikes = wasActive
        ? post.userLikes.filter((t) => t !== incentiveType)
        : [...post.userLikes, incentiveType];
      const likesMap = {
        apoio: post.likes.apoio,
        continua: post.likes.continua,
        ganhador: post.likes.ganhador,
        consegueMais: post.likes.consegueMais,
        limiteMaior: post.likes.limiteMaior,
        maisAlgum: post.likes.maisAlgum,
      };
      if (incentiveType === 1) likesMap.apoio += wasActive ? -1 : 1;
      else if (incentiveType === 2) likesMap.continua += wasActive ? -1 : 1;
      else if (incentiveType === 3) likesMap.ganhador += wasActive ? -1 : 1;
      else if (incentiveType === 4) likesMap.consegueMais += wasActive ? -1 : 1;
      else if (incentiveType === 5) likesMap.limiteMaior += wasActive ? -1 : 1;
      else if (incentiveType === 6) likesMap.maisAlgum += wasActive ? -1 : 1;
      return { ...post, likes: likesMap, userLikes: newUserLikes };
    });

  const handleToggleLike = React.useCallback(
    (postId: string, incentiveType: PostIncentiveType) => {
      const key = `${postId}-${incentiveType}`;
      if (togglingIncentivesRef.current.has(key)) return;

      // Determine desired state from current post list before optimistic update
      const currentPost =
        postsRef.current.find((p) => p.id === postId) ??
        discoverPostsRef.current.find((p) => p.id === postId);
      const wasActive = currentPost?.userLikes.includes(incentiveType) ?? false;
      const wantActive = !wasActive;

      togglingIncentivesRef.current.add(key);
      setTogglingIncentives((prev) => new Set(prev).add(key));

      setPosts((prev) => applyOptimisticLike(prev, postId, incentiveType));
      setDiscoverPosts((prev) => applyOptimisticLike(prev, postId, incentiveType));

      togglePostLike(postId, incentiveType, wantActive).catch(() => {
        // Revert optimistic update on failure
        setPosts((prev) => applyOptimisticLike(prev, postId, incentiveType));
        setDiscoverPosts((prev) => applyOptimisticLike(prev, postId, incentiveType));
        toast({ title: t("feed_incentive_save_error"), description: t("retry"), variant: "destructive" });
      }).finally(() => {
        togglingIncentivesRef.current.delete(key);
        setTogglingIncentives((prev) => { const next = new Set(prev); next.delete(key); return next; });
      });
    },
    [t],
  );

  const handleSharePost = React.useCallback((post: PostWithStats) => {
    const base = t("share_post_text").replace("{handle}", post.userNickname ?? "");
    const text = post.description ? `${base}\n"${post.description}"` : base;
    setShareDrawerText(text);
    setShareDrawerUrl(postShareUrl(post.id));
    setSendToFriendContent({
      kind: "post",
      id: post.id,
      previewImage: post.photos?.length ? String(post.photos[0]) : post.photo || null,
      authorNickname: post.userNickname,
    });
    setShareDrawerOpen(true);
  }, [t]);

  const handleReportUser = React.useCallback((post: PostWithStats) => {
    setReportedPost(post);
    setReportType("user");
    setReportDialogOpen(true);
  }, []);

  const handleReportPost = React.useCallback((post: PostWithStats) => {
    setReportedPost(post);
    setReportType("post");
    setReportDialogOpen(true);
  }, []);

  // A trava de reentrada mora numa ref, não no estado: dependendo de
  // `likesLoading`, este callback trocava de identidade a cada abertura e
  // levava junto o `sharedCardProps` — re-renderizando todos os cards do feed
  // por causa de um guard que nem precisa disparar render.
  const likesLoadingRef = React.useRef(false);
  const handleOpenLikesModal = React.useCallback(async (post: PostWithStats) => {
    if (likesLoadingRef.current) return;
    likesLoadingRef.current = true;
    setLikesLoading(true);
    try {
      await flushPendingIncentivesDb(post.id);
      const likes = await getPostLikeUsersDb(post.id);
      setPostLikes(likes);
      setLikesModalOpen(true);
    } catch (err) {
      console.error("Error loading post likes:", err);
      toast({ title: t("error"), description: t("post_incentives_load_error"), variant: "destructive" });
    } finally {
      likesLoadingRef.current = false;
      setLikesLoading(false);
    }
  }, [t]);

  const handleDeletePost = React.useCallback(
    (post: PostWithStats) => {
      if (!user) {
        toast({ title: t("error"), description: t("post_login_required"), variant: "destructive" });
        return;
      }
      showConfirm(
        t("post_delete_title"),
        t("post_delete_desc"),
        async () => {
          try {
            await deletePostDb(post.id);
            setPosts((prev) => prev.filter((p) => p.id !== post.id));
            setDiscoverPosts((prev) => prev.filter((p) => p.id !== post.id));
            toast({ title: t("confirm"), description: t("post_deleted_success") });
          } catch (err: any) {
            console.error("Error deleting post:", err);
            toast({ title: t("post_delete_error"), description: err?.message || t("post_delete_error_desc"), variant: "destructive" });
          }
        },
      );
    },
    [user, showConfirm, t],
  );

  const handleEditPost = React.useCallback((post: PostWithStats) => {
    setEditingPost(post);
    setEditPostOpen(true);
  }, []);

  const handlePostSaved = React.useCallback(async () => {
    await loadFeed(false, true);
    // Also refresh discover so edited post description updates there too
    getDiscoverPosts()
      .then((data) => {
        setDiscoverPosts(data);
        setHasMoreDiscover(data.length >= DISCOVER_PAGE_SIZE);
      })
      .catch(console.error);
  }, [loadFeed]);

  // Shared PostCard props factory
  // Memoizado porque é espalhado em TODO PostCard: como objeto literal, cada
  // render desta tela (46 estados, qualquer drawer abre um) entregava props
  // novas aos quarenta cards e anulava o `memo` deles. Os oito handlers já são
  // `useCallback` estáveis, então este objeto só muda quando algo real muda.
  const sharedCardProps = React.useMemo(
    () => ({
      currentUserId: user?.id,
      togglingIncentives,
      likesLoading,
      onToggleLike: handleToggleLike,
      onOpenLikes: handleOpenLikesModal,
      onOpenGoal: openGoalModal,
      onShare: handleSharePost,
      onReportUser: handleReportUser,
      onReportPost: handleReportPost,
      onEdit: handleEditPost,
      onDelete: handleDeletePost,
    }),
    [
      user?.id,
      togglingIncentives,
      likesLoading,
      handleToggleLike,
      handleOpenLikesModal,
      openGoalModal,
      handleSharePost,
      handleReportUser,
      handleReportPost,
      handleEditPost,
      handleDeletePost,
    ],
  );

  const feedScrollRef = React.useRef<HTMLDivElement>(null);

  // Pull-to-refresh — conduzido por refs + estilo imperativo no DOM. Um setState
  // por touchmove re-renderizava a lista inteira de posts a ~60fps durante o
  // arrasto, que é justamente o momento em que o frame não pode cair.
  const pullStartY = React.useRef(0);
  const isPullingRef = React.useRef(false);
  const pullDistanceRef = React.useRef(0);
  const pullIndicatorRef = React.useRef<HTMLDivElement>(null);
  const pullSpinnerRef = React.useRef<HTMLDivElement>(null);
  const PULL_THRESHOLD = 72;

  const onTouchStart = React.useCallback((e: React.TouchEvent) => {
    // Com um drawer/dialog aberto por cima, o swipe de cima para baixo é do
    // gesto de fechar o próprio drawer (vaul) — ele NÃO deve também disparar o
    // pull-to-refresh do feed. Só começamos o pull quando não há overlay aberto.
    // Mesmo detector usado em use-edge-swipe-back.ts, para manter consistência.
    if (document.querySelector('[role="dialog"],[role="alertdialog"],[vaul-drawer]')) return;
    const scrollEl = feedScrollRef.current?.closest("[data-feed-scroll]") as HTMLElement | null;
    const scrollTop = scrollEl ? scrollEl.scrollTop : window.scrollY;
    if (scrollTop > 0) return;
    pullStartY.current = e.touches[0].clientY;
    isPullingRef.current = true;
    pullDistanceRef.current = 0;
    if (pullIndicatorRef.current) pullIndicatorRef.current.style.transition = "none";
  }, []);

  const onTouchMove = React.useCallback((e: React.TouchEvent) => {
    if (!isPullingRef.current) return;
    const delta = e.touches[0].clientY - pullStartY.current;
    const dist = delta > 0 ? Math.min(delta * 0.4, PULL_THRESHOLD + 20) : 0;
    pullDistanceRef.current = dist;
    if (pullIndicatorRef.current) pullIndicatorRef.current.style.height = `${dist}px`;
    if (pullSpinnerRef.current) {
      pullSpinnerRef.current.style.transform = `rotate(${(dist / PULL_THRESHOLD) * 360}deg)`;
      pullSpinnerRef.current.style.opacity = String(Math.min(dist / PULL_THRESHOLD, 1));
    }
  }, []);

  const onTouchEnd = React.useCallback(() => {
    if (!isPullingRef.current) return;
    isPullingRef.current = false;
    if (pullDistanceRef.current >= PULL_THRESHOLD) {
      hapticLight();
      setShowRefreshHint(false);
      setDiscoverLoaded(false);
      setHasMoreDiscover(true);
      loadFeed(true, true);
      // Refresh de badges (mensagens/notificações) — o AppLayout escuta este
      // evento para refazer o fetch, cobrindo o caso da subscription realtime
      // ter caído silenciosamente.
      window.dispatchEvent(new CustomEvent("ritmofit-refresh-badges"));
    }
    pullDistanceRef.current = 0;
    if (pullIndicatorRef.current) {
      pullIndicatorRef.current.style.transition = "height .2s ease";
      pullIndicatorRef.current.style.height = "0px";
    }
    if (pullSpinnerRef.current) pullSpinnerRef.current.style.opacity = "0";
  }, [loadFeed]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-2xl flex flex-col">
        {/* Stories skeleton — evita layout shift quando o carrossel aparece */}
        <div className="bg-background border-b border-border/60 px-3 py-3">
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1 shrink-0">
                <div className="w-14 h-14 rounded-full bg-muted animate-pulse" />
                <div className="w-10 h-2 rounded bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        </div>
        <div className="grid w-full gap-3 py-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <PostSkeleton key={i} tall />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={feedScrollRef}
      className="mx-auto w-full max-w-2xl flex flex-col relative"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Ambient glow — um único elemento com gradientes pintados diretamente.
          Antes eram 3 divs com filter: blur(65px), que o WebKit precisa
          re-compor a cada frame de scroll junto com todos os backdrop-filter
          da tela. radial-gradient já entrega o mesmo visual sem filtro. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(340px 340px at 10% 14%, rgba(216,86,122,.34), transparent 70%)," +
            "radial-gradient(300px 300px at 92% 42%, rgba(63,127,230,.30), transparent 70%)," +
            "radial-gradient(280px 280px at 26% 74%, rgba(123,63,242,.26), transparent 70%)",
        }}
      />

      {/* Dica "puxe para atualizar" — flutua logo abaixo do header ao voltar de
          ≥5min em background. Tocar dispara o mesmo refresh do logo/home. */}
      <div
        className="fixed inset-x-0 z-40 flex justify-center px-4 pointer-events-none"
        style={{ top: "calc(max(14px, env(safe-area-inset-top) + 6px) + 52px + 10px)" }}
      >
        <AnimatePresence>
          {showRefreshHint && (
            <motion.button
              key="feed-refresh-hint"
              initial={{ opacity: 0, y: -12, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.94 }}
              transition={{ type: "spring", stiffness: 420, damping: 26 }}
              onClick={() => {
                hapticLight();
                window.dispatchEvent(new CustomEvent("ritmofit-refresh-feed"));
              }}
              className="pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2.5 max-w-[calc(100vw-2rem)] active:scale-95 transition-transform"
              style={{
                background: "linear-gradient(rgba(255,255,255,.16),rgba(255,255,255,.06))",
                backdropFilter: "blur(24px) saturate(180%)",
                WebkitBackdropFilter: "blur(24px) saturate(180%)",
                border: "1px solid rgba(255,255,255,.16)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,.28), 0 8px 24px -8px rgba(0,0,0,.5)",
              }}
            >
              <motion.span
                animate={{ y: [0, 4, 0] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                className="flex-shrink-0"
              >
                <ChevronDown className="h-4 w-4 text-white" />
              </motion.span>
              <span className="text-[13px] font-medium text-white leading-tight text-left">
                {t("feed_refresh_hint")}
              </span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Pull-to-refresh indicator — altura/rotação escritas direto no DOM pelos handlers */}
      <div
        ref={pullIndicatorRef}
        className="flex items-center justify-center overflow-hidden"
        style={{ height: 0 }}
      >
        <div
          ref={pullSpinnerRef}
          className="h-6 w-6 rounded-full border-2 border-brand border-t-transparent"
          style={{ opacity: 0 }}
        />
      </div>

      {/* Stories Carousel — no border wrapper in glass design */}
      <div className="pb-1">
        <FlowCarousel
          stories={stories}
          onAddStoryClick={handleAddStoryClick}
          currentUserId={user?.id || ""}
          currentUserPhoto={currentUserPhoto}
          currentUserNickname={currentUserNickname}
          viewedStoryIds={viewedStoryIds}
          onStoryView={handleStoryViewed}
        />
      </div>

      {/* Seguindo / Descobrir segment control */}
      <div
        className="mx-3 mb-3"
        style={{
          height: "44px",
          borderRadius: "22px",
          background: "linear-gradient(rgba(255,255,255,.09),rgba(255,255,255,.03))",
          backdropFilter: "blur(20px) saturate(170%)",
          WebkitBackdropFilter: "blur(20px) saturate(170%)",
          border: "1px solid rgba(255,255,255,.1)",
          display: "flex",
          padding: "4px",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.18)",
        }}
      >
        <button
          className="flex-1 transition-all duration-200 active:scale-95"
          style={{
            borderRadius: "18px",
            fontSize: "14px",
            fontWeight: feedTab === "following" ? 700 : 500,
            color: feedTab === "following" ? "#0a0b12" : "rgba(255,255,255,.75)",
            background: feedTab === "following" ? "#fff" : "transparent",
          }}
          onClick={() => setFeedTab("following")}
        >
          {t("feed_segment_following")}
        </button>
        <button
          className="flex-1 transition-all duration-200 active:scale-95"
          style={{
            borderRadius: "18px",
            fontSize: "14px",
            fontWeight: feedTab === "discover" ? 700 : 500,
            color: feedTab === "discover" ? "#0a0b12" : "rgba(255,255,255,.75)",
            background: feedTab === "discover" ? "#fff" : "transparent",
          }}
          onClick={() => {
            setFeedTab("discover");
            loadDiscover();
          }}
        >
          {t("feed_segment_discover")}
        </button>
      </div>

      {/* Feed Content */}
      <div className="flex flex-col w-full">
        {feedTab === "following" ? (
          <>
            {posts.map((post) => (
              <LazyMount key={post.id}>
                <PostCard post={post} {...sharedCardProps} />
              </LazyMount>
            ))}

            {/* Feed vazio = primeira tela de todo usuário novo. Em vez de um link
                para outra tela, as pessoas sugeridas são seguíveis aqui mesmo. */}
            {posts.length === 0 && (
              <div className="mx-3 mb-4 p-4 rounded-2xl" style={GLASS_PANEL_STYLE}>
                <p className="text-base font-semibold text-white">{t("feed_empty_title")}</p>
                <p className="text-sm text-white/60 mt-1 mb-4">{t("feed_follow_cta")}</p>

                {suggestedUsers.length === 0 ? (
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 py-1.5">
                        <div className="h-10 w-10 rounded-full bg-white/10 animate-pulse" />
                        <div className="h-3 w-28 rounded bg-white/10 animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col divide-y divide-white/10">
                    {suggestedUsers.map((u) => (
                      <div key={u.id} className="flex items-center gap-3 py-2.5">
                        <button
                          className="flex items-center gap-3 flex-1 min-w-0 text-left active:opacity-70"
                          onClick={() => navigate(`/usuario/${u.id}`)}
                        >
                          <UserAvatar photo={u.photo} nickname={u.nickname} className="h-10 w-10 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{u.nickname}</p>
                            {u.bio && <p className="text-xs text-white/50 truncate">{u.bio}</p>}
                          </div>
                        </button>
                        <FollowButton targetUserId={u.id} />
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-full mt-4 bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white"
                  onClick={() => navigate("/buscar")}
                >
                  {t("feed_find_people")}
                </Button>
              </div>
            )}

            {hasMoreFeed && posts.length > 0 && (
              <div ref={feedBottomSentinelRef}>
                {loadingMoreFeed && (
                  <div className="flex flex-col">
                    {[1, 2].map((i) => <PostSkeleton key={`more-${i}`} tall />)}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Sentinel kept in DOM so IntersectionObserver can trigger on mount */}
            <div ref={discoverSentinelRef} />
            {discoverLoading ? (
              <>{[1, 2].map((i) => <PostSkeleton key={i} tall />)}</>
            ) : discoverPosts.length === 0 ? (
              <div className="flex flex-col items-center py-8 gap-3 text-center">
                <p className="text-sm text-muted-foreground">
                  {t("feed_discover_empty")}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full text-xs h-7 px-3"
                  onClick={() => navigate("/buscar")}
                >
                  {t("feed_find_people_follow")}
                </Button>
              </div>
            ) : (
              <>
                {discoverPosts.map((post) => (
                  <LazyMount key={`seed-${post.id}`}>
                    <PostCard
                      post={post}
                      {...sharedCardProps}
                      showFollowButton
                    />
                  </LazyMount>
                ))}
                {hasMoreDiscover && discoverPosts.length > 0 && (
                  <div ref={discoverBottomSentinelRef}>
                    {loadingMoreDiscover && (
                      <div className="flex flex-col">
                        {[1, 2].map((i) => <PostSkeleton key={`more-disc-${i}`} tall />)}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Flow Creation Dialog */}
      <FlowCreationDialog
        open={storyCreationOpen}
        onOpenChange={setStoryCreationOpen}
        onCreateStory={handleCreateStory}
        isLoading={isCreatingStory}
      />


      {/* Goal Progress Drawer */}
      <Drawer open={goalModalOpen} onOpenChange={setGoalModalOpen} noBodyStyles shouldScaleBackground={false}>
        <DrawerContent {...GLASS_SHEET_PROPS} style={GLASS_SHEET_STYLE} onOpenAutoFocus={(e) => e.preventDefault()}>
          <DrawerHeader className="shrink-0">
            <DrawerTitle className="text-white">{t("feed_goal_drawer_title")}</DrawerTitle>
          </DrawerHeader>
          <div
            className="flex flex-col flex-1 min-h-0 gap-4 overflow-y-auto px-4"
            style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
          >
            {selectedGoalPost?.userGoal && (
              <div className="space-y-4 flex-1">
                {/* Goal Info */}
                <div className="p-4 rounded-2xl space-y-3" style={GLASS_PANEL_STYLE}>
                  <p className="text-lg font-bold text-white">{selectedGoalPost.userGoal.description}</p>

                  {/* Progress Bar — Bug 9 fix: clamp to 100 */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-white/85">{t("feed_goal_progress_label")}</span>
                      <span className="text-lg font-bold text-white">
                        {Math.round(Math.min(100, selectedGoalPost.userGoal.perc))}%
                      </span>
                    </div>
                    <div className="w-full rounded-full h-5 overflow-hidden" style={{ background: "rgba(255,255,255,.1)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, selectedGoalPost.userGoal.perc)}%`, background: "linear-gradient(90deg,#5b8cff,#9d6bff)" }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div className="p-2 rounded-xl text-center" style={{ background: "rgba(255,255,255,.05)" }}>
                      <p className="text-xs text-white/50">{t("feed_goal_duration")}</p>
                      <p className="text-sm font-bold text-white">{selectedGoalPost.userGoal.duration}d</p>
                    </div>
                    <div className="p-2 rounded-xl text-center" style={{ background: "rgba(255,255,255,.05)" }}>
                      <p className="text-xs text-white/50">{t("feed_goal_quantity")}</p>
                      <p className="text-sm font-bold text-white">{selectedGoalPost.userGoal.quantity}</p>
                    </div>
                    <div className="p-2 rounded-xl text-center" style={{ background: "rgba(255,255,255,.05)" }}>
                      <p className="text-xs text-white/50">{t("feed_goal_type_label")}</p>
                      <p className="text-sm font-bold text-white">
                        {selectedGoalPost.userGoal.type_goal === 1
                          ? t("feed_goal_type_fitness")
                          : selectedGoalPost.userGoal.type_goal === 2
                            ? t("feed_goal_type_health")
                            : t("feed_goal_type_habits")}
                      </p>
                    </div>
                  </div>
                </div>

                {goalRoutinesLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <p className="text-sm text-white/50">{t("feed_routine_loading")}</p>
                  </div>
                ) : (
                  <>
                    {/* Own post — show linked routines (view only) */}
                    {selectedGoalPost.user_id === user?.id && (
                      <>
                        {linkedRoutines.length > 0 ? (
                          <RoutineAccordion
                            linkedRoutines={linkedRoutines}
                            expandedRoutines={expandedRoutines}
                            setExpandedRoutines={setExpandedRoutines}
                            expandedLinkedRoutine={expandedLinkedRoutine}
                            linkedRoutineItems={linkedRoutineItems}
                            targetUserId={selectedGoalPost.user_id}
                            onToggleRoutine={handleToggleLinkedRoutine}
                            showCopyButtons={false}
                            copyingRoutineKeys={copyingRoutineKeys}
                            copiedRoutineKeys={copiedRoutineKeys}
                            onCopyRoutine={handleCopyRoutine}
                            postUserId={selectedGoalPost.user_id}
                          />
                        ) : (
                          <div className="rounded-2xl p-4 text-center space-y-3" style={GLASS_PANEL_STYLE}>
                            <p className="text-sm text-white/60">
                              {t("feed_routines_no_linked")}
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full rounded-full bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white"
                              onClick={() => navigate("/metas?tab=rotinas")}
                            >
                              {t("feed_routines_link_btn")}
                            </Button>
                          </div>
                        )}
                      </>
                    )}

                    {/* Other user's post — show routines with copy buttons */}
                    {selectedGoalPost.user_id !== user?.id && linkedRoutines.length > 0 && (
                      <RoutineAccordion
                        linkedRoutines={linkedRoutines}
                        expandedRoutines={expandedRoutines}
                        setExpandedRoutines={setExpandedRoutines}
                        expandedLinkedRoutine={expandedLinkedRoutine}
                        linkedRoutineItems={linkedRoutineItems}
                        targetUserId={selectedGoalPost.user_id}
                        onToggleRoutine={handleToggleLinkedRoutine}
                        showCopyButtons
                        copyingRoutineKeys={copyingRoutineKeys}
                        copiedRoutineKeys={copiedRoutineKeys}
                        onCopyRoutine={handleCopyRoutine}
                        postUserId={selectedGoalPost.user_id}
                      />
                    )}
                  </>
                )}

                {/* Mark complete button — own post only */}
                {selectedGoalPost.user_id === user?.id && (selectedGoalPost.userGoal.perc ?? 0) < 100 && (
                  <button
                    onClick={handleMarkGoalComplete}
                    disabled={isMarkingGoalComplete}
                    className="w-full flex items-center justify-center gap-1.5 text-xs text-white/50 hover:text-emerald-400 transition-colors py-1 disabled:opacity-50"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    {isMarkingGoalComplete ? t("feed_goal_marking") : t("feed_goal_mark_complete_btn")}
                  </button>
                )}

                {/* Copy Goal button */}
                {selectedGoalPost.user_id !== user?.id && (
                  <div className="flex gap-2">
                    <Button
                      onClick={handleCopyGoal}
                      disabled={isCopyingGoal || hasAlreadyCopiedGoal}
                      className="flex-1 rounded-full gap-2 shrink-0 border-0"
                      style={GLASS_PRIMARY_BTN_STYLE}
                    >
                      {isCopyingGoal ? t("feed_goal_copying") : hasAlreadyCopiedGoal ? t("feed_goal_already_copied") : t("feed_goal_copy_btn")}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Goal Completed Dialog */}
      {completedGoalDescription !== null && (
        <GoalCompletedDialog
          goalDescription={completedGoalDescription}
          onClose={() => setCompletedGoalDescription(null)}
        />
      )}

      {/* Report Dialog */}
      <ReportDrawer
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        type={reportType}
        target={
          reportedPost
            ? {
                id: reportedPost.id,
                userId: reportedPost.user_id,
                userName: reportedPost.userNickname,
                description: reportedPost.description,
              }
            : null
        }
      />

      <ShareDrawer
        open={shareDrawerOpen}
        onOpenChange={setShareDrawerOpen}
        text={shareDrawerText}
        url={shareDrawerUrl}
        title={t("feed_share_post_title")}
        onSendToFriend={() => setSendToFriendOpen(true)}
      />

      <SendToFriendDrawer
        open={sendToFriendOpen}
        onOpenChange={setSendToFriendOpen}
        content={sendToFriendContent}
      />

      <PostLikesModal
        open={likesModalOpen}
        onOpenChange={setLikesModalOpen}
        likes={postLikes}
      />

      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDialog.onConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditPostDrawer
        open={editPostOpen}
        onOpenChange={(v) => { if (!v) { setEditPostOpen(false); setEditingPost(null); } }}
        post={editingPost}
        onSaved={handlePostSaved}
      />
    </div>
  );
}

// ─── Extracted sub-component to eliminate duplication in the Goal Drawer ───

interface RoutineAccordionProps {
  linkedRoutines: any[];
  expandedRoutines: boolean;
  setExpandedRoutines: (v: boolean) => void;
  expandedLinkedRoutine: string | null;
  linkedRoutineItems: Record<string, any[]>;
  targetUserId: string;
  onToggleRoutine: (key: string, type: number, name: string | undefined, userId: string) => void;
  showCopyButtons: boolean;
  copyingRoutineKeys: Set<string>;
  copiedRoutineKeys: Set<string>;
  onCopyRoutine: (sourceUserId: string, routineType: number, routineName: string | undefined) => void;
  postUserId: string;
}

function RoutineAccordion({
  linkedRoutines,
  expandedRoutines,
  setExpandedRoutines,
  expandedLinkedRoutine,
  linkedRoutineItems,
  targetUserId,
  onToggleRoutine,
  showCopyButtons,
  copyingRoutineKeys,
  copiedRoutineKeys,
  onCopyRoutine,
  postUserId,
}: RoutineAccordionProps) {
  const { t } = useLanguage();
  const seen = new Set<string>();
  const groups = linkedRoutines.reduce<{ key: string; type: number; name?: string }[]>((acc, r) => {
    const k = `${r.type}__${r.name ?? ""}`;
    if (!seen.has(k)) { seen.add(k); acc.push({ key: k, type: r.type, name: r.name }); }
    return acc;
  }, []);

  return (
    <div className="rounded-lg overflow-hidden" style={GLASS_PANEL_STYLE}>
      <button
        onClick={() => setExpandedRoutines(!expandedRoutines)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <h3 className="text-sm font-medium text-white">
          {t("feed_goal_linked_routines").replace("{n}", String(groups.length))}
        </h3>

        <ChevronDown
          className={`h-5 w-5 text-white/60 transform transition-transform ${expandedRoutines ? "rotate-180" : ""}`}
        />
      </button>

      {expandedRoutines && (
        <div className="divide-y divide-white/10 border-t border-white/10">
          {groups.map(({ key, type, name }) => {
            const typeIcon = type === 1 ? "🏋️" : type === 2 ? "🍽️" : "✅";
            const typeLabel = type === 1 ? t("feed_routines_exercises") : type === 2 ? t("feed_routines_diets") : t("feed_goal_type_habits");
            const label = name || typeLabel;
            const isOpen = expandedLinkedRoutine === key;
            const items = linkedRoutineItems[key];
            const copyKey = `${postUserId}::${type}::${name ?? ""}`;
            const isCopyingThis = copyingRoutineKeys.has(copyKey);
            const isCopiedThis = copiedRoutineKeys.has(copyKey);

            return (
              <div key={key}>
                <button
                  onClick={() => onToggleRoutine(key, type, name, targetUserId)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                >
                  <span className="text-base">{typeIcon}</span>
                  <span className="flex-1 text-sm font-medium truncate text-white">{label}</span>
                  <ChevronDown className={`h-4 w-4 text-white/50 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {isOpen && (
                  <div className="px-4 pb-3 pt-1 space-y-1.5" style={{ background: "rgba(255,255,255,.03)" }}>
                    {!items ? (
                      <p className="text-xs text-white/50 py-2">{t("feed_routine_loading")}</p>
                    ) : items.length === 0 ? (
                      <p className="text-xs text-white/50 py-2">{t("feed_routine_empty_items")}</p>
                    ) : (
                      <>
                        {items.map((item: any) => {
                          const itemName = item.workoutName || item.dietName || item.habitName || "—";
                          return (
                            <div key={item.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg" style={{ background: "rgba(255,255,255,.05)" }}>
                              <span className="text-xs text-white/50">•</span>
                              <span className="text-sm truncate text-white">{itemName}</span>
                            </div>
                          );
                        })}
                        {showCopyButtons && (
                          <Button
                            size="sm"
                            variant={isCopiedThis ? "outline" : "default"}
                            className={`w-full rounded-full mt-2 ${isCopiedThis ? "bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white" : "border-0"}`}
                            style={isCopiedThis ? undefined : GLASS_PRIMARY_BTN_STYLE}
                            disabled={isCopyingThis || isCopiedThis}
                            onClick={(e) => {
                              e.stopPropagation();
                              onCopyRoutine(postUserId, type, name);
                            }}
                          >
                            {isCopyingThis
                              ? t("feed_goal_copying")
                              : isCopiedThis
                                ? t("feed_copied_btn")
                                : type === 1
                                  ? t("feed_copy_workout_btn")
                                  : type === 2
                                    ? t("feed_copy_diet_btn")
                                    : t("feed_copy_habit_btn")}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}