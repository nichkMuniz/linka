import * as React from "react";
import { IMMUTABLE_CACHE_CONTROL } from "@/lib/storage-cache";
import {
  getUserProfileDb,
  getUserPostsDb,
  getUserStatsDb,
  getUserRoutinesDb,
  updateRoutineGoalDb,
  getFollowersDb,
  getFollowingDb,
  getMostFollowedProfilesDb,
  type MostFollowedProfile,
  getFollowingStatusBatchDb,
  isFollowingDb,
  getBlockedIdsDb,
  getBlockedByMeIdsDb,
  getUserShotsDb,
  getTaggedPostsDb,
  getUserGoalsByUserIdDb,
  updateUserProfileDb,
  getCommercialProfileDb,
  getCommercialOffersByUserIdDb,
  incrementOfferClickDb,
  type CommercialOffer,
  getUserActiveStoriesDb,
  getUserPinnedFlowsDb,
  FLOW_PINNED_EVENT,
  getMyViewedFlowUserIdsDb,
  FLOW_CREATED_EVENT,
  type UserProfile,
  type PostWithUser,
  type UserStats,
  type Routine,
  type UserGoal,
  type ShotWithUser,
  type CommercialProfile,
  type ServicePlan,
  getCommercialPlansDb,
  type StoryWithUser,
  updateUserGoalDb,
  deleteUserGoalDb,
  getHiddenProfileGoalIdsDb,
  setGoalHiddenOnProfileDb,
  invalidateQueryCache,
  invalidateProfileCache,
} from "@/lib/ritmofit-db";
import { cn } from "@/lib/utils";
import { reportHandledError } from "@/lib/monitoring";
import { GLASS_SHEET_PROPS, GLASS_SHEET_STYLE } from "@/lib/glass-styles";
import { openExternalUrl, isSafeExternalUrl } from "@/lib/safe-url";
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ImageWithFallback } from "@/components/shared/image-with-fallback";
import { PinnedFlowsStrip } from "@/components/profile/pinned-flows-strip";
import { FlowCoinAvatar } from "@/components/profile/flow-coin-avatar";
import { UserAvatar } from "@/components/shared/user-avatar";
import { UserInsignias } from "@/components/profile/user-insignias";
import { VerifiedBadge } from "@/components/shared/VerifiedBadge";
import { isWorkoutCanvasPost } from "@/lib/workout-summary-types";
// O MESMO viewer da rota /flows/:id (modo embutido) — um componente só para
// feed e perfil. Lazy: é o mesmo chunk que a rota já carrega.
const FlowViewer = React.lazy(() => import("@/pages/FlowViewer"));
import { FollowButton } from "@/components/shared/follow-button";
import { FollowListDrawer } from "@/components/profile/follow-list-drawer";
import { SettingsDrawer } from "@/components/profile/settings-drawer";
import { DeleteAccountDrawer } from "@/components/profile/delete-account-drawer";
import { ShotEditorDrawer } from "@/components/profile/shot-editor-drawer";
import { GoalDetailDrawer } from "@/components/goals/goal-detail-drawer";
import { ProfilePostsViewer } from "@/components/profile/profile-posts-viewer";
import { MultiPhotoBadge, VideoPostBadge } from "@/components/shared/multi-photo-badge";
import type { PostWithStats } from "@/services/post.service";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useKeyboardInputScroll } from "@/hooks/use-keyboard-input-scroll";
import { ProfileSkeleton } from "@/components/shared/animated-loading";
import { ShareDrawer } from "@/components/shared/share-drawer";
import { UserSafetyDrawer } from "@/components/shared/user-safety-drawer";
import { BlockUserDialog } from "@/components/shared/block-user-dialog";
import { FEATURES } from "@/lib/feature-flags";
import {
  InlineCropPreview,
  applyTransformToBlob,
  DEFAULT_TRANSFORM,
  type CropTransform,
} from "@/components/shared/inline-crop-preview";
import { profileShareUrl, postShareUrl } from "@/lib/share-url";
import { requestAppRefresh, useAppRefresh } from "@/lib/app-refresh";
import { usePostReshare } from "@/hooks/use-post-reshare";
import { ShotThumb } from "@/components/shared/shot-thumb";
import {
  ArrowLeft,
  Check,
  Tag,
  Settings,
  Trash2,
  MessageSquare,
  Share2,
  MoreHorizontal,
  ArrowRight,
  ExternalLink,
  Phone,
  ListChecks,
  Target,
  CheckCircle2,
  ShieldCheck,
  ImagePlus,
  X,
  Lock,
  Play,
  Ban,
  Eye,
  EyeOff,
  Repeat2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useLanguage } from "@/lib/language-context";
import { Browser } from "@capacitor/browser";
import { hapticLight } from "@/lib/haptics";
import { prefetchFlowMedia } from "@/lib/media-prefetch";
import { pickFlowEntry } from "@/lib/flow-entry";

// Lado da miniatura na grade do perfil (px CSS). 3 colunas num iPhone ≈ 120px
// por célula; com folga para as larguras maiores (sm/md usam 4–5 colunas).
const GRID_THUMB_PX = 160;

// Capa do perfil: 210px visíveis ABAIXO do header flutuante + a faixa que o
// header ocupa (a capa começa no topo da tela, por trás do vidro). O mesmo
// valor dimensiona o frame de ajuste, então o recorte salvo bate com a exibição.
const COVER_HEIGHT = "calc(210px + var(--app-header-offset))";
// Botões sobre a capa (trocar/remover, voltar) ficam logo abaixo do header.
const COVER_CONTROLS_TOP = "calc(var(--app-header-offset) + 8px)";

// Último perfil exibido (dados do "batch 1"), por visitante + perfil. Reabrir um
// perfil já visto nasce preenchido e atualiza por trás (recarga soft), em vez
// de passar pelo esqueleto a cada navegação. A chave inclui QUEM está vendo:
// trocar de conta no aparelho não pode mostrar a visão do dono a outra pessoa.
type ProfileSnapshot = { profile: UserProfile | null; stats: UserStats; posts: PostWithUser[] };
const profileSnapshots = new Map<string, ProfileSnapshot>();

// Leitura principal do perfil travada (rede do iPhone logo após o login ou a
// volta do background) deixava o skeleton para sempre. Estourou → tela de erro
// com "Tentar novamente", e o evento vai ao Sentry.
const PROFILE_LOAD_TIMEOUT_MS = 15_000;
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("profile load timeout")), ms);
    p.then(
      (v) => { clearTimeout(id); resolve(v); },
      (e) => { clearTimeout(id); reject(e); },
    );
  });
}
const MAX_PROFILE_SNAPSHOTS = 12;

function saveProfileSnapshot(key: string, snap: ProfileSnapshot) {
  profileSnapshots.delete(key);
  profileSnapshots.set(key, snap);
  if (profileSnapshots.size > MAX_PROFILE_SNAPSHOTS) {
    const oldest = profileSnapshots.keys().next().value;
    if (oldest !== undefined) profileSnapshots.delete(oldest);
  }
}

export default function Profile() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { userId } = useParams<{ userId?: string }>();
  const { t } = useLanguage();
  // Drawer de editar post (legenda mid-scroll) — mantém o campo acima do teclado.
  useKeyboardInputScroll();

  // Pull-to-refresh (handlers declared after loadProfile). Todo o gesto é
  // controlado por refs + estilo imperativo no DOM: um setState por touchmove
  // re-renderizava a árvore inteira do perfil a ~60fps durante o gesto.
  const pullStartY = React.useRef(0);
  const isPullingRef = React.useRef(false);
  const pullDistanceRef = React.useRef(0);
  const pullIndicatorRef = React.useRef<HTMLDivElement>(null);
  const pullSpinnerRef = React.useRef<HTMLDivElement>(null);
  const PULL_THRESHOLD = 72;

  // Centralized confirmation dialog state (replaces native confirm())
  const [confirmDialog, setConfirmDialog] = React.useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: "", description: "", onConfirm: () => { } });

  const showConfirm = React.useCallback(
    (title: string, description: string, onConfirm: () => void) => {
      setConfirmDialog({ open: true, title, description, onConfirm });
    },
    []
  );

  // Determine if we're viewing another user's profile
  const isViewingOtherProfile = !!userId && userId !== user?.id;
  const profileUserId = userId || user?.id;
  const snapshotKey = profileUserId && user?.id ? `${user.id}:${profileUserId}` : null;
  const initialSnapshot = snapshotKey ? profileSnapshots.get(snapshotKey) : undefined;

  const [profile, setProfile] = React.useState<UserProfile | null>(() => initialSnapshot?.profile ?? null);
  const [shareDrawerOpen, setShareDrawerOpen] = React.useState(false);
  const [shareDrawerText, setShareDrawerText] = React.useState("");
  const [shareDrawerUrl, setShareDrawerUrl] = React.useState<string | undefined>(undefined);
  // O drawer serve ao perfil e ao post aberto no viewer (recompartilhar).
  const [shareDrawerTitle, setShareDrawerTitle] = React.useState("");
  const [posts, setPosts] = React.useState<PostWithUser[]>(() => initialSnapshot?.posts ?? []);
  const [shots, setShots] = React.useState<ShotWithUser[]>([]);
  // Posts de OUTRAS pessoas em que este perfil foi marcado (aba "Marcações")
  const [taggedPosts, setTaggedPosts] = React.useState<PostWithUser[]>([]);
  const [routines, setRoutines] = React.useState<Routine[]>([]);
  // Publicações em tela cheia (mesmo PostCard do feed) — substitui o drawer
  // próprio que o Perfil tinha. `tab` decide a lista; `postId`, onde abre.
  const [postsViewer, setPostsViewer] = React.useState<{ tab: "posts" | "treinos" | "marcacoes"; postId: string } | null>(null);
  const [selectedShot, setSelectedShot] = React.useState<ShotWithUser | null>(null);
  const [isShotEditorOpen, setIsShotEditorOpen] = React.useState(false);
  const [stats, setStats] = React.useState<UserStats>(() => initialSnapshot?.stats ?? {
    postsCount: 0,
    followersCount: 0,
    followingCount: 0,
    points: 0,
    level: 1,
  });
  const [loading, setLoading] = React.useState(() => !initialSnapshot);
  const [profileError, setProfileError] = React.useState(false);
  /**
   * Bloqueio entre o visitante e o dono deste perfil. Com bloqueio o perfil não
   * mostra conteúdo nenhum — nem posts, nem abas, nem seguir/mensagem —, então
   * a checagem roda ANTES das queries de conteúdo (ver `loadProfile`).
   *
   * `blockedByMe` separa as direções: só quem bloqueou pode ler o que
   * aconteceu e desfazer. Ver `getBlockedByMeIdsDb`.
   */
  const [blockRelation, setBlockRelation] = React.useState<{
    isBlocked: boolean;
    blockedByMe: boolean;
  }>({ isBlocked: false, blockedByMe: false });
  const [unblockOpen, setUnblockOpen] = React.useState(false);
  // Batch 2 concluído — evita mostrar "(0)" nas tabs antes dos dados chegarem
  const [tabsDataLoaded, setTabsDataLoaded] = React.useState(false);
  const [userGoals, setUserGoals] = React.useState<UserGoal[]>([]);
  const [profileStories, setProfileStories] = React.useState<StoryWithUser[]>([]);
  // Flows deste perfil que o visitante já viu — usado só para escolher por qual o ring abre.
  const [viewedFlowIds, setViewedFlowIds] = React.useState<Set<string>>(() => new Set());
  const [isStoryViewerOpen, setIsStoryViewerOpen] = React.useState(false);
  const [selectedProfileStory, setSelectedProfileStory] = React.useState<StoryWithUser | null>(null);
  // Flows fixados (faixa acima das abas). Ficam aqui mesmo depois das 24h.
  const [pinnedFlows, setPinnedFlows] = React.useState<StoryWithUser[]>([]);
  // De qual lista o viewer embutido navega: o ring (flows de 24h) ou os fixados.
  const [viewerSource, setViewerSource] = React.useState<"ring" | "pinned">("ring");
  const viewerStories = viewerSource === "pinned" ? pinnedFlows : profileStories;
  const isStoryViewerOpenRef = React.useRef(false);
  isStoryViewerOpenRef.current = isStoryViewerOpen;
  const [showFollowersModal, setShowFollowersModal] = React.useState(false);
  const [showFollowingModal, setShowFollowingModal] = React.useState(false);
  // Indica se o usuário logado segue o dono do perfil (para regras de privacidade)
  const [viewerFollowsProfile, setViewerFollowsProfile] = React.useState(false);
  const [followers, setFollowers] = React.useState<any[]>([]);
  const [following, setFollowing] = React.useState<any[]>([]);
  // Perfis mais seguidos — só na lista "Seguindo" vazia do próprio perfil.
  const [suggestedProfiles, setSuggestedProfiles] = React.useState<MostFollowedProfile[]>([]);
  const [isLoadingSuggested, setIsLoadingSuggested] = React.useState(false);
  const [isLoadingFollowers, setIsLoadingFollowers] = React.useState(false);
  const [followerFollowStatus, setFollowerFollowStatus] = React.useState<Record<string, boolean>>({});
  const [followingFollowStatus, setFollowingFollowStatus] = React.useState<Record<string, boolean>>({});

  // Goal detail drawer state
  const [selectedGoalForDrawer, setSelectedGoalForDrawer] = React.useState<UserGoal | null>(null);

  // Metas concluídas que o dono ocultou do perfil (`hidden_on_profile`).
  const [hiddenGoalIds, setHiddenGoalIds] = React.useState<Set<string>>(new Set());
  // Dono: revela as ocultas (esmaecidas) para poder voltar a mostrá-las.
  const [showHiddenGoals, setShowHiddenGoals] = React.useState(false);
  // Meta concluída cujo menu "⋯" está aberto / aguardando confirmar exclusão.
  const [goalMenuTarget, setGoalMenuTarget] = React.useState<UserGoal | null>(null);
  const [goalToDelete, setGoalToDelete] = React.useState<UserGoal | null>(null);
  const [goalActionBusy, setGoalActionBusy] = React.useState(false);

  // Metas pendentes primeiro; as concluídas (perc >= 100) vão para o fim da strip.
  // Ocultas saem da strip, a menos que o dono peça para vê-las.
  const sortedUserGoals = React.useMemo(
    () =>
      [...userGoals]
        .filter((g) => showHiddenGoals || !hiddenGoalIds.has(g.id))
        .sort((a, b) => Number(a.perc >= 100) - Number(b.perc >= 100)),
    [userGoals, hiddenGoalIds, showHiddenGoals],
  );
  const hiddenGoalsCount = React.useMemo(
    () => userGoals.filter((g) => hiddenGoalIds.has(g.id)).length,
    [userGoals, hiddenGoalIds],
  );

  // A aba "Treinos" recebe os posts que são só o CARD de resumo gerado pelo app
  // (canvas puro); assim que a pessoa anexa uma foto da galeria/câmera, o post
  // volta a ser uma publicação comum. Split derivado da mesma lista carregada
  // por `getUserPostsDb` — nenhuma query extra, e apagar/editar um post segue
  // atualizando as duas abas de uma vez (ver `setPosts`).
  //
  // ⚠️ O split SÓ faz sentido com a aba "Treinos" visível. Com
  // `FEATURES.profileWorkoutsTab` desligada não existe aba para recebê-los, e
  // manter o filtro faria os posts de canvas sumirem do perfil inteiro — o
  // usuário publicou e o post simplesmente não aparece em lugar nenhum. Sem a
  // aba, "Publicações" volta a ser o que sempre foi: tudo.
  //
  // Post REPOSTADO não está nesta lista (ver getUserPostsDb): ele aparece só
  // na aba Marcações, com o selo de repost.
  const isOwnWorkoutCanvas = React.useCallback(
    (p: PostWithUser) => p.user_id === profileUserId && isWorkoutCanvasPost(p),
    [profileUserId],
  );
  const workoutPosts = React.useMemo(
    () => (FEATURES.profileWorkoutsTab ? posts.filter(isOwnWorkoutCanvas) : []),
    [posts, isOwnWorkoutCanvas],
  );
  const feedPosts = React.useMemo(
    () => (FEATURES.profileWorkoutsTab ? posts.filter((p) => !isOwnWorkoutCanvas(p)) : posts),
    [posts, isOwnWorkoutCanvas],
  );

  // Edit form state

  const [profileOffers, setProfileOffers] = React.useState<CommercialOffer[]>([]);

  // Commercial profile state
  const [isPlansModalOpen, setIsPlansModalOpen] = React.useState(false);
  const [commercialProfile, setCommercialProfile] = React.useState<CommercialProfile | null>(null);
  const [servicePlans, setServicePlans] = React.useState<ServicePlan[]>([]);

  // Settings drawer (controlled externally so the trigger can be styled per design)
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [safetyOpen, setSafetyOpen] = React.useState(false);
  const [settingsOpenToProfile, setSettingsOpenToProfile] = React.useState(false);
  // Flow expirado vindo de uma notificação (reação/comentário) — abre o Settings
  // direto no Arquivo de Flows com esse flow expandido (ver client/pages/Index.tsx)
  const [archivedFlowFromNotif, setArchivedFlowFromNotif] = React.useState<StoryWithUser | null>(null);

  React.useEffect(() => {
    const state = location.state as { openFlowArchive?: StoryWithUser } | null;
    if (state?.openFlowArchive) {
      navigate(location.pathname, { replace: true, state: {} });
      setArchivedFlowFromNotif(state.openFlowArchive);
      setSettingsOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Cover photo (banner) — own profile can replace the gradient with a photo
  const coverFileInputRef = React.useRef<HTMLInputElement>(null);
  // Enquadramento da capa direto no frame do banner (zoom/pan), sem tela de
  // crop separada. `coverEditSrc` != null = modo de ajuste ativo.
  const [coverEditSrc, setCoverEditSrc] = React.useState<string | null>(null);
  const [coverTransform, setCoverTransform] = React.useState<CropTransform>(DEFAULT_TRANSFORM);
  const coverFrameWRef = React.useRef(0);
  const coverFrameHRef = React.useRef(0);
  const [isSavingCover, setIsSavingCover] = React.useState(false);

  // Delete account state (UI trigger not yet implemented)
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = React.useState(false);

  // Edit account state

  // Notifications state

  // Personalization state

  // Guard contra respostas fora de ordem: /perfil e /usuario/:id renderizam o
  // mesmo componente montado, então navegar rápido de um perfil para outro
  // dispara loads concorrentes — só o mais recente pode gravar estado.
  const loadSeqRef = React.useRef(0);

  const loadProfile = React.useCallback(async (opts?: { soft?: boolean }) => {
    if (!profileUserId) return;
    const seq = ++loadSeqRef.current;
    const isStale = () => seq !== loadSeqRef.current;

    setProfileError(false);
    if (!opts?.soft) {
      // Reset profile-specific state so stale data from the previous user is never shown.
      // No refresh manual (soft) o conteúdo atual fica na tela enquanto os dados chegam.
      setProfile(null);
      setPosts([]);
      setShots([]);
      setTaggedPosts([]);
      setRoutines([]);
      setTabsDataLoaded(false);
      setLoading(true);
    }

    // Batch 0 — bloqueio. Vem ANTES de tudo porque decide se existe conteúdo a
    // buscar: com bloqueio entre as pontas o perfil vira uma tela de aviso, e
    // disparar os ~12 selects dos batches 1–3 seria pagar por dados que ninguém
    // vai ver — além de deixá-los no estado do componente, de onde vazariam
    // para a tela ao menor descuido em algum render futuro.
    //
    // O `catch(() => [])` mantém a regra da casa: falha de rede aqui não pode
    // transformar um perfil normal numa tela de bloqueio.
    // Batch 1 já sai JUNTO com a checagem de bloqueio (antes esperava por ela:
    // duas idas ao servidor antes de pintar o perfil de outra pessoa). Com
    // bloqueio o resultado é descartado sem nunca chegar ao estado da tela — o
    // custo é só a consulta, a regra de privacidade continua a mesma.
    const batch1 = Promise.all([
      getUserProfileDb(profileUserId),
      getUserStatsDb(profileUserId),
      getUserPostsDb(profileUserId),
    ]);
    batch1.catch(() => { /* tratado no await abaixo */ });

    if (isViewingOtherProfile) {
      const [blockedIds, blockedByMeIds] = await Promise.all([
        getBlockedIdsDb().catch(() => [] as string[]),
        getBlockedByMeIdsDb().catch(() => [] as string[]),
      ]);
      if (isStale()) return;
      const isBlocked = blockedIds.includes(profileUserId);
      setBlockRelation({
        isBlocked,
        blockedByMe: blockedByMeIds.includes(profileUserId),
      });
      if (isBlocked) {
        // Nome e foto continuam sendo buscados: são o que permite reconhecer de
        // quem é o perfil na hora de desbloquear, e já são públicos em qualquer
        // lista do app. Conteúdo, contagens e abas não.
        const profileData = await getUserProfileDb(profileUserId).catch(() => null);
        if (isStale()) return;
        // Na recarga soft o conteúdo anterior ainda estava na tela.
        if (snapshotKey) profileSnapshots.delete(snapshotKey);
        setPosts([]);
        setShots([]);
        setTaggedPosts([]);
        setRoutines([]);
        setProfile(profileData);
        setLoading(false);
        return;
      }
    } else {
      setBlockRelation({ isBlocked: false, blockedByMe: false });
    }

    try {
      // Batch 1 — critical above-the-fold data: show immediately
      let [profileData, statsData, postsData] = await withTimeout(batch1, PROFILE_LOAD_TIMEOUT_MS);
      if (isStale()) return;
      // O PRÓPRIO perfil sempre existe (o cadastro cria a linha): vazio aqui é
      // leitura que falhou no instante do login. Antes a tela ficava em "Perfil
      // não encontrado" até alguém puxar o feed para atualizar (2026-09-30).
      // Tenta de novo sozinho, lendo do banco; se ainda assim não vier, cai na
      // tela de erro com "Tentar novamente".
      if (!profileData && !isViewingOtherProfile) {
        for (const delay of [700, 1800]) {
          await new Promise((r) => setTimeout(r, delay));
          if (isStale()) return;
          invalidateProfileCache(profileUserId);
          invalidateQueryCache(`userStats:${profileUserId}`);
          invalidateQueryCache(`userPosts:${profileUserId}`);
          [profileData, statsData, postsData] = await withTimeout(
            Promise.all([
              getUserProfileDb(profileUserId),
              getUserStatsDb(profileUserId),
              getUserPostsDb(profileUserId),
            ]),
            PROFILE_LOAD_TIMEOUT_MS,
          );
          if (isStale()) return;
          if (profileData) break;
        }
        if (!profileData) throw new Error("own profile unavailable after retries");
      }
      setProfile(profileData);
      setStats(statsData);
      setPosts(postsData);
      setLoading(false); // unblock UI as soon as critical data arrives
      // Snapshot sem perfil faria a próxima abertura pintar "não encontrado".
      if (snapshotKey && profileData) saveProfileSnapshot(snapshotKey, { profile: profileData, stats: statsData, posts: postsData });
    } catch (err: any) {
      if (isStale()) return;
      console.error("Error loading profile:", err);
      // catch + toast não chega ao Sentry sozinho.
      reportHandledError(err, "Profile.loadProfile", { own: !isViewingOtherProfile });
      toast({
        title: t("profile_toast_load_error"),
        description: t("retry"),
        variant: "destructive",
      });
      setProfileError(true);
      setLoading(false);
      return;
    }

    try {
      // Batch 2 — below-the-fold tabs: load in background without blocking render.
      // Uma falha aqui não pode derrubar o perfil já exibido pelo batch 1 —
      // só avisa via toast e mantém a tela.
      const [
        routinesData,
        userGoalsData,
        shotsData,
        commercialProfileData,
        offersData,
        commercialPlansData,
        taggedPostsData,
        hiddenGoalIdsData,
      ] = await Promise.all([
        getUserRoutinesDb(profileUserId),
        getUserGoalsByUserIdDb(profileUserId),
        // Quatro queries que só existiam para abas e frames guardados atrás de
        // flag. Sem a guarda, cada abertura de perfil — a própria e a de
        // qualquer outra pessoa — pagava por dados que ninguém consegue ver.
        FEATURES.shots ? getUserShotsDb(profileUserId) : Promise.resolve([]),
        FEATURES.store ? getCommercialProfileDb(profileUserId) : Promise.resolve(null),
        FEATURES.store ? getCommercialOffersByUserIdDb(profileUserId) : Promise.resolve([]),
        FEATURES.store ? getCommercialPlansDb(profileUserId) : Promise.resolve([]),
        FEATURES.profileTaggedTab && FEATURES.postTags ? getTaggedPostsDb(profileUserId) : Promise.resolve([]),
        // Tolerante: sem a migração 20260928 volta vazio e nada fica oculto.
        getHiddenProfileGoalIdsDb(profileUserId),
      ]);
      if (isStale()) return;
      setRoutines(routinesData);
      setHiddenGoalIds(hiddenGoalIdsData);
      // Visitante não vê meta privada nem meta que o dono ocultou do perfil.
      // O dono recebe todas — as ocultas ficam atrás do "Mostrar ocultas".
      setUserGoals(
        isViewingOtherProfile
          ? userGoalsData.filter((g) => g.visibility === 1 && !hiddenGoalIdsData.has(g.id))
          : userGoalsData,
      );
      setShots(shotsData);
      setTaggedPosts(taggedPostsData);
      setCommercialProfile(commercialProfileData);
      setProfileOffers(offersData.filter((o) => o.is_active));
      setServicePlans(commercialPlansData.map((p) => ({ name: p.name, price: p.price, description: p.description ?? undefined })));
      setTabsDataLoaded(true);
    } catch (err: any) {
      if (isStale()) return;
      console.error("Error loading profile tabs:", err);
      toast({
        title: t("profile_toast_load_error"),
        description: t("retry"),
        variant: "destructive",
      });
    }

    // Batch 3 — flows fixados e stories: fire-and-forget
    getUserPinnedFlowsDb(profileUserId).then((flows) => {
      if (!isStale()) setPinnedFlows(flows);
    });
    getUserActiveStoriesDb(profileUserId)
      .then(async (stories) => {
        if (isStale()) return;
        setProfileStories(stories);
        // Quais desses flows já foram vistos — define por qual o ring abre (o 1º não
        // visto) em vez de recomeçar sempre do mais antigo.
        const viewed = await getMyViewedFlowUserIdsDb(stories.map((s) => s.id)).catch(
          () => new Set<string>(),
        );
        if (isStale()) return;
        setViewedFlowIds(viewed);
        // Aquece o flow que o ring vai abrir: a capa vem inteira e do vídeo só o
        // cabeçalho, então tocar no ring já encontra o player com bytes em mãos.
        const entry = pickFlowEntry(stories, viewed);
        if (entry) prefetchFlowMedia(entry, "metadata");
      })
      .catch((err) => console.error("Erro ao carregar stories do perfil:", err));

    // Status de seguimento do visitante (usado nas regras de privacidade)
    if (isViewingOtherProfile) {
      isFollowingDb(profileUserId)
        .then((follows) => { if (!isStale()) setViewerFollowsProfile(follows); })
        .catch(() => { if (!isStale()) setViewerFollowsProfile(false); });
    } else {
      setViewerFollowsProfile(false);
    }
  }, [profileUserId, isViewingOtherProfile, snapshotKey]);

  // Pull-to-refresh handlers (declared after loadProfile to avoid forward reference).
  // Atualizam o indicador direto no DOM — nenhum re-render React durante o gesto.
  const onTouchStart = React.useCallback((e: React.TouchEvent) => {
    if (window.scrollY > 0) return;
    // Ignora gestos nascidos dentro de um drawer/dialog/modal. Eles são portados
    // para fora da árvore DOM do perfil (DrawerPortal → document.body), mas
    // continuam FILHOS na árvore React — então um swipe para fechar o drawer
    // borbulha pelos eventos sintéticos até estes handlers e disparava o
    // pull-to-refresh. Como o alvo real do toque está no portal (fora do
    // container raiz do perfil), `contains` é false e o gesto é ignorado aqui.
    // Cobre vaul, Radix (dialog/alert) e overlays via createPortal, sem depender
    // de atributos internos de cada biblioteca.
    if (!e.currentTarget.contains(e.target as Node)) return;
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
      // Profile data is cached (long TTL) so it doesn't refetch on every screen
      // entry — a manual pull-to-refresh explicitly asks for fresh data, so bust
      // the cache first instead of just re-serving the cached values.
      if (profileUserId) {
        invalidateProfileCache(profileUserId);
        invalidateQueryCache(`userStats:${profileUserId}`);
        invalidateQueryCache(`userPosts:${profileUserId}`);
        invalidateQueryCache(`userShots:${profileUserId}`);
        invalidateQueryCache(`taggedPosts:${profileUserId}`);
        invalidateQueryCache(`commercialProfile:${profileUserId}`);
        invalidateQueryCache(`userActiveStories:${profileUserId}`);
        if (user?.id) invalidateQueryCache(`isFollowing:${user.id}:${profileUserId}`);
      }
      // Refresh global: header/footer (notificações, mensagens) e o resto do
      // app também saem do banco — ver @/lib/app-refresh.
      requestAppRefresh("pull", "profile");
      // soft: mantém o conteúdo atual na tela em vez de voltar ao skeleton
      loadProfile({ soft: true });
    }
    pullDistanceRef.current = 0;
    if (pullIndicatorRef.current) {
      pullIndicatorRef.current.style.transition = "height .2s ease";
      pullIndicatorRef.current.style.height = "0px";
    }
    if (pullSpinnerRef.current) pullSpinnerRef.current.style.opacity = "0";
  }, [loadProfile, profileUserId, user?.id]);

  const postReshare = usePostReshare({
    context: "profile",
    // O repost entra (ou sai) da aba Posts do PRÓPRIO perfil e muda o
    // "fulano repostou" dos cards — recarrega o perfil aberto.
    onRepostChanged: () => { loadProfile(); },
  });

  // Compartilhar a partir do card (⋮ → Compartilhar) — mesmo ShareDrawer do
  // Perfil; o usePostReshare decide "Seu flow"/"Seu feed" (dono ou marcado).
  const handleSharePostFromViewer = React.useCallback((post: PostWithStats) => {
    const base = t("share_post_text").replace("{handle}", post.userNickname ?? "");
    setShareDrawerText(post.description ? `${base}\n"${post.description}"` : base);
    setShareDrawerUrl(postShareUrl(post.id));
    setShareDrawerTitle(t("feed_share_post_title"));
    postReshare.prepare(post);
    setShareDrawerOpen(true);
  }, [t, postReshare.prepare]);

  // Define callback functions first
  const loadFollowersData = React.useCallback(async () => {
    setIsLoadingFollowers(true);
    try {
      const data = await getFollowersDb(profileUserId);
      setFollowers(data);

      // Batch-check follow status for all followers in one query instead of N individual queries
      const followerIds = data.map((f: any) => f.id).filter(Boolean);
      const statusMap = await getFollowingStatusBatchDb(followerIds);
      setFollowerFollowStatus(statusMap);
    } catch (err: any) {
      console.error("Error loading followers:", err);
      toast({
        title: t("profile_toast_followers_error"),
        description: err?.message || t("retry"),
      });
    } finally {
      setIsLoadingFollowers(false);
    }
  }, [profileUserId]);

  const loadFollowingData = React.useCallback(async () => {
    setIsLoadingFollowers(true);
    try {
      const data = await getFollowingDb(profileUserId);
      setFollowing(data);

      // Próprio perfil sem seguir ninguém → sugere os perfis mais seguidos no
      // lugar da lista vazia. No perfil de outra pessoa a lista vazia fica vazia.
      if (!isViewingOtherProfile && data.length === 0) {
        setIsLoadingSuggested(true);
        getMostFollowedProfilesDb()
          .then(setSuggestedProfiles)
          .finally(() => setIsLoadingSuggested(false));
      } else {
        setSuggestedProfiles([]);
      }

      // All users in the "following" list are already followed by definition
      const statusMap: Record<string, boolean> = {};
      data.forEach((u: any) => { if (u.id) statusMap[u.id] = true; });
      setFollowingFollowStatus(statusMap);
    } catch (err: any) {
      console.error("Error loading following:", err);
      toast({
        title: t("profile_toast_following_error"),
        description: err?.message || t("retry"),
      });
    } finally {
      setIsLoadingFollowers(false);
    }
  }, [profileUserId, isViewingOtherProfile]);



  // Mantém o snapshot igual ao que está na tela — edição do próprio perfil,
  // seguir/deixar de seguir e post apagado mudam o estado sem passar pelo load.
  React.useEffect(() => {
    if (loading || !snapshotKey || !profile || blockRelation.isBlocked) return;
    saveProfileSnapshot(snapshotKey, { profile, stats, posts });
  }, [loading, snapshotKey, profile, stats, posts, blockRelation.isBlocked]);

  React.useEffect(() => {
    // Perfil já visto (snapshot) → mostra na hora e atualiza por trás.
    const snap = snapshotKey ? profileSnapshots.get(snapshotKey) : undefined;
    if (snap) {
      setProfile(snap.profile);
      setStats(snap.stats);
      setPosts(snap.posts);
      setLoading(false);
      loadProfile({ soft: true });
    } else {
      loadProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileUserId, loadProfile]);

  // Flow publicado (criador, "Seu flow" de um post, repost): o ring do PRÓPRIO
  // perfil aparece na hora. Com o perfil desmontado não precisa — o
  // createStoryDb já derrubou o cache de `userActiveStories`.
  React.useEffect(() => {
    if (!profileUserId || isViewingOtherProfile) return;
    const onFlowCreated = () => {
      getUserActiveStoriesDb(profileUserId)
        .then(async (stories) => {
          setProfileStories(stories);
          const viewed = await getMyViewedFlowUserIdsDb(stories.map((s) => s.id)).catch(
            () => new Set<string>(),
          );
          setViewedFlowIds(viewed);
        })
        .catch((err) => console.error("Erro ao atualizar flows do perfil:", err));
    };
    window.addEventListener(FLOW_CREATED_EVENT, onFlowCreated);
    return () => window.removeEventListener(FLOW_CREATED_EVENT, onFlowCreated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileUserId, isViewingOtherProfile]);

  // Fixou/desafixou (no viewer ou no Arquivo): atualiza a faixa. Com o viewer
  // aberto só corrige a marca nas listas — tirar da lista o flow que está na
  // tela faria o viewer perder o flow atual; a faixa é relida ao fechar.
  React.useEffect(() => {
    if (!profileUserId || isViewingOtherProfile) return;
    const onPinned = (e: Event) => {
      const { flowId, pinned, title } =
        (e as CustomEvent<{ flowId: string; pinned: boolean; title: string | null }>).detail ?? {};
      const mark = (list: StoryWithUser[]) =>
        list.map((s) =>
          s.id === flowId
            ? {
                ...s,
                // Renomear não mexe no pinned_at (a ordem da faixa não muda).
                pinned_at: pinned ? (s.pinned_at ?? new Date().toISOString()) : null,
                pinned_title: pinned ? (title ?? null) : null,
              }
            : s,
        );
      setProfileStories(mark);
      setPinnedFlows(mark);
      if (!isStoryViewerOpenRef.current) {
        getUserPinnedFlowsDb(profileUserId).then(setPinnedFlows);
      }
    };
    window.addEventListener(FLOW_PINNED_EVENT, onPinned);
    return () => window.removeEventListener(FLOW_PINNED_EVENT, onPinned);
  }, [profileUserId, isViewingOtherProfile]);

  // Refresh vindo de fora (pull no feed, toque no logo, volta do background):
  // o cache já chega derrubado, então a recarga soft lê tudo do banco sem
  // voltar ao skeleton.
  useAppRefresh(({ source }) => {
    if (source === "profile") return;
    loadProfile({ soft: true });
  });

  // When navigating from one profile to another (e.g. tapping a name inside an
  // open post's comments/incentives), Profile.tsx stays mounted since "/perfil"
  // and "/usuario/:userId" render the same component — any drawer/modal left
  // open from the previous profile would otherwise keep showing stale content
  // over the newly loaded profile. Skip on first mount (prev === undefined) so
  // the notification-driven "openFlowArchive" settings drawer above still works.
  const prevProfileUserIdRef = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    const prev = prevProfileUserIdRef.current;
    prevProfileUserIdRef.current = profileUserId;
    if (prev === undefined || prev === profileUserId) return;

    setPostsViewer(null);
    setSelectedShot(null);
    setIsShotEditorOpen(false);
    setIsStoryViewerOpen(false);
    setSelectedProfileStory(null);
    setPinnedFlows([]);
    setViewerSource("ring");
    setShowFollowersModal(false);
    setShowFollowingModal(false);
    setSelectedGoalForDrawer(null);
    setIsPlansModalOpen(false);
    setSettingsOpen(false);
    setShareDrawerOpen(false);
  }, [profileUserId]);

  // Refresh stats when page becomes visible (cooldown: at most once per 60s)
  const lastStatsRefreshRef = React.useRef(0);
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && profileUserId) {
        const now = Date.now();
        if (now - lastStatsRefreshRef.current < 60_000) return; // 60s cooldown
        lastStatsRefreshRef.current = now;
        getUserStatsDb(profileUserId).then((newStats) => {
          setStats(newStats);
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [profileUserId]);

  // Load followers when modal opens
  React.useEffect(() => {
    if (showFollowersModal) {
      loadFollowersData();
    }
  }, [showFollowersModal, loadFollowersData]);

  // Load following when modal opens
  React.useEffect(() => {
    if (showFollowingModal) {
      loadFollowingData();
    }
  }, [showFollowingModal, loadFollowingData]);

  const handleProfileEditGoal = async (goal: UserGoal, updates: { duration: number; quantity: number }) => {
    await updateUserGoalDb(goal.id, updates);
    const updated = await getUserGoalsByUserIdDb(profileUserId!);
    setUserGoals(updated);
  };

  const handleProfileDeleteGoal = async (goal: UserGoal) => {
    await deleteUserGoalDb(goal.id);
    setUserGoals((prev) => prev.filter((g) => g.id !== goal.id));
    setSelectedGoalForDrawer(null);
  };

  // Menu "⋯" da meta concluída no perfil: ocultar/mostrar e excluir.
  const handleToggleGoalHidden = async (goal: UserGoal) => {
    const hide = !hiddenGoalIds.has(goal.id);
    setGoalActionBusy(true);
    try {
      await setGoalHiddenOnProfileDb(goal.id, hide);
      setHiddenGoalIds((prev) => {
        const next = new Set(prev);
        if (hide) next.add(goal.id); else next.delete(goal.id);
        return next;
      });
      setGoalMenuTarget(null);
      toast({ title: hide ? t("profile_goal_hidden_toast") : t("profile_goal_shown_toast") });
    } catch (err) {
      reportHandledError(err, "profile:toggle-goal-hidden");
      toast({ title: t("profile_goal_action_error"), description: t("retry"), variant: "destructive" });
    } finally {
      setGoalActionBusy(false);
    }
  };

  const handleConfirmDeleteGoal = async () => {
    if (!goalToDelete) return;
    setGoalActionBusy(true);
    try {
      await handleProfileDeleteGoal(goalToDelete);
      setGoalToDelete(null);
      toast({ title: t("profile_goal_deleted_toast") });
    } catch (err) {
      reportHandledError(err, "profile:delete-goal");
      toast({ title: t("profile_goal_action_error"), description: t("retry"), variant: "destructive" });
    } finally {
      setGoalActionBusy(false);
    }
  };

  const handleProfileToggleRoutineLink = async (routineId: string, goalId: string | null) => {
    await updateRoutineGoalDb(routineId, goalId);
    const [updatedRoutines, updatedGoals] = await Promise.all([
      getUserRoutinesDb(profileUserId!),
      getUserGoalsByUserIdDb(profileUserId!),
    ]);
    setRoutines(updatedRoutines);
    setUserGoals(updatedGoals);
  };

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCoverTransform(DEFAULT_TRANSFORM);
      setCoverEditSrc(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = ""; // allow re-selecting the same file
  };

  const handleCoverEditCancel = () => {
    setCoverEditSrc(null);
    setCoverTransform(DEFAULT_TRANSFORM);
  };

  const handleCoverEditSave = async () => {
    if (!user || !supabase || !coverEditSrc) return;
    const frameW = coverFrameWRef.current;
    const frameH = coverFrameHRef.current;
    if (frameW === 0 || frameH === 0) return;
    hapticLight();
    setIsSavingCover(true);
    try {
      // Recorta com as medidas do próprio banner: o que o usuário enquadrou é
      // exatamente o que aparece depois (object-cover no mesmo frame).
      const blob = await applyTransformToBlob(coverEditSrc, coverTransform, frameW, frameH);
      const filePath = `covers/${user.id}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("posts")
        .upload(filePath, blob, { cacheControl: IMMUTABLE_CACHE_CONTROL, contentType: "image/jpeg" });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("posts").getPublicUrl(filePath);
      const updated = await updateUserProfileDb(user.id, { cover_photo: publicUrl });
      if (updated) setProfile(updated);
      setCoverEditSrc(null);
      setCoverTransform(DEFAULT_TRANSFORM);
      toast({ title: t("profile_cover_updated") });
    } catch (err: any) {
      console.error("Error updating cover photo:", err);
      reportHandledError(err, "profile:update-cover", { userId: user.id });
      toast({ title: t("profile_cover_update_error"), description: err?.message || t("retry"), variant: "destructive" });
    } finally {
      setIsSavingCover(false);
    }
  };

  const handleRemoveCover = () => {
    if (!user) return;
    showConfirm(
      t("profile_remove_cover"),
      t("profile_remove_cover_desc"),
      async () => {
        setIsSavingCover(true);
        try {
          const updated = await updateUserProfileDb(user.id, { cover_photo: null });
          if (updated) setProfile(updated);
          toast({ title: t("profile_cover_removed") });
        } catch (err: any) {
          console.error("Error removing cover photo:", err);
          toast({ title: t("profile_cover_remove_error"), description: err?.message || t("retry"), variant: "destructive" });
        } finally {
          setIsSavingCover(false);
        }
      }
    );
  };

  if (authLoading || loading) {
    return <ProfileSkeleton />;
  }

  if (!loading && profileError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-muted-foreground text-sm">{t("profile_load_error")}</p>
        <Button variant="outline" size="sm" onClick={() => { setProfileError(false); loadProfile(); }}>
          {t("profile_retry")}
        </Button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {t("profile_not_found")}
      </div>
    );
  }

  /**
   * Perfil de alguém em relação de bloqueio.
   *
   * É um `return` próprio, e não um punhado de condicionais espalhados pelo
   * corpo do perfil, por dois motivos. O primeiro é garantia: com uma tela
   * separada é impossível um frame de conteúdo sobreviver por esquecimento — e
   * o `loadProfile` nem chega a buscar posts, abas ou contagens. O segundo é
   * que praticamente nada do perfil normal faz sentido aqui: seguir, mandar
   * mensagem, compartilhar e ver os flows são todos contato com quem foi
   * bloqueado.
   *
   * A frase depende da direção. Se fui eu que bloqueei, a tela nomeia o que
   * aconteceu e oferece o "Desbloquear" — é a minha decisão, e preciso poder
   * desfazê-la. Se foi a outra pessoa, a frase é neutra ("Perfil
   * indisponível"): confirmar "fulano te bloqueou" entregaria uma decisão que o
   * app não revela em nenhuma outra tela. O "..." continua acessível nos dois
   * casos — denunciar quem me bloqueou é legítimo, e bloquear de volta é a
   * única ponta que eu controlo.
   */
  if (isViewingOtherProfile && blockRelation.isBlocked) {
    const blockedByMe = blockRelation.blockedByMe;
    return (
      <div className="relative min-h-[70vh] flex flex-col items-center justify-center px-8 text-center">
        <button
          onClick={() => navigate(-1)}
          aria-label={t("goals_back")}
          className="absolute z-30 flex items-center justify-center active:scale-95 transition-transform"
          style={{ top: "8px", left: "12px", width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button
          onClick={() => setSafetyOpen(true)}
          aria-label={t("user_safety_title")}
          className="absolute z-30 flex items-center justify-center active:scale-95 transition-transform"
          style={{ top: "8px", right: "12px", width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }}
        >
          <MoreHorizontal className="h-[18px] w-[18px]" />
        </button>

        {/* Sem anel cônico: o ring abre os flows, que é conteúdo. */}
        <div style={{ opacity: 0.55 }}>
          <UserAvatar photo={profile.photo} nickname={profile.nickname} size="2xl" />
        </div>

        <h1 className="mt-4 text-white" style={{ fontSize: "19px", fontWeight: 740, letterSpacing: "-0.01em" }}>
          {profile.nickname}
        </h1>

        <div
          className="mt-5 flex flex-col items-center gap-2 w-full max-w-sm"
          style={{ borderRadius: "22px", padding: "22px 20px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}
        >
          <Ban className="h-6 w-6" style={{ color: "rgba(255,255,255,.45)" }} strokeWidth={1.6} />
          <p style={{ fontSize: "15px", fontWeight: 620, color: "#fff" }}>
            {blockedByMe
              ? t("profile_blocked_by_me_title").replace("{name}", profile.nickname)
              : t("profile_blocked_unavailable_title")}
          </p>
          <p style={{ fontSize: "13px", lineHeight: 1.5, color: "rgba(255,255,255,.5)" }}>
            {blockedByMe
              ? t("profile_blocked_by_me_desc")
              : t("profile_blocked_unavailable_desc")}
          </p>
          {blockedByMe && (
            <button
              onClick={() => setUnblockOpen(true)}
              className="mt-2 active:scale-95 transition-transform"
              style={{ height: 42, padding: "0 22px", borderRadius: "21px", fontSize: "13.5px", fontWeight: 640, color: "#0a0b12", background: "linear-gradient(rgba(255,255,255,.95),rgba(255,255,255,.82))" }}
            >
              {t("unblock_user")}
            </button>
          )}
        </div>

        <UserSafetyDrawer
          open={safetyOpen}
          onOpenChange={setSafetyOpen}
          userId={profileUserId ?? null}
          userName={profile.nickname}
          blockedByMe={blockedByMe}
          onBlocked={() => loadProfile()}
        />

        <BlockUserDialog
          open={unblockOpen}
          onOpenChange={setUnblockOpen}
          userId={profileUserId ?? null}
          userName={profile.nickname}
          mode="unblock"
          // Recarrega no lugar: o perfil inteiro volta a aparecer, que é a
          // confirmação mais direta de que o desbloqueio pegou.
          onDone={() => loadProfile()}
        />
      </div>
    );
  }

  // Quantas abas realmente vão para a tela. Decide se a linha precisa rolar —
  // ver o comentário no `TabsList`. Mantido ao lado da lista de abas em
  // condição: cada aba nova entra nos dois lugares.
  const visibleTabCount =
    1 + // Publicações, sempre presente
    (FEATURES.profileWorkoutsTab ? 1 : 0) +
    (FEATURES.profileExtraTabs && FEATURES.shots ? 1 : 0) +
    (FEATURES.profileTaggedTab && FEATURES.postTags ? 1 : 0) +
    (FEATURES.store && profileOffers.length > 0 ? 1 : 0);

  return (
    <div
      className="space-y-6"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Pull-to-refresh indicator — altura/rotação aplicadas via ref (onTouchMove) */}
      <div
        ref={pullIndicatorRef}
        className="flex items-center justify-center overflow-hidden"
        style={{ height: 0 }}
      >
        <div
          className="h-6 w-6 shrink-0 rounded-full border-2 border-brand border-t-transparent"
          ref={pullSpinnerRef}
          style={{ opacity: 0 }}
        />
      </div>

      {/* Profile Header with banner — sobe para trás do header flutuante
          (margem negativa = a faixa que o AppLayout reserva no topo): a capa
          começa no topo da tela, sem a faixa preta entre header e capa. O
          inline também anula o mt-6 do space-y-6 do container. */}
      <div className="relative" style={{ marginTop: "calc(-1 * var(--app-header-offset))" }}>
        {/* Banner — modo de ajuste (foto nova sendo enquadrada), foto de capa
            salva, ou gradiente padrão. No ajuste o frame é o PRÓPRIO banner:
            arrastar reposiciona, pinça dá zoom, e o recorte usa estas medidas. */}
        {coverEditSrc ? (
          <div
            className="absolute top-0 left-0 right-0 overflow-hidden"
            style={{ height: COVER_HEIGHT }}
          >
            <InlineCropPreview
              imageSrc={coverEditSrc}
              transform={coverTransform}
              onTransformChange={setCoverTransform}
              containerWidthRef={coverFrameWRef}
              containerHeightRef={coverFrameHRef}
            />
            {/* Grade de terços — só guia visual do enquadramento */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)",
                backgroundSize: "33.33% 33.33%",
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,.35)",
              }}
            />
          </div>
        ) : profile.cover_photo ? (
          <div
            aria-hidden
            className="absolute top-0 left-0 right-0 overflow-hidden pointer-events-none"
            style={{ height: COVER_HEIGHT }}
          >
            <ImageWithFallback
              src={profile.cover_photo}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div
            aria-hidden
            className="absolute top-0 left-0 right-0 pointer-events-none"
            style={{ height: COVER_HEIGHT, background: "radial-gradient(120% 100% at 60% 0%,#d8567a,#7b3ff2 55%,#1a1438 90%)" }}
          />
        )}
        <div
          aria-hidden
          className="absolute top-0 left-0 right-0 pointer-events-none"
          // Esmaece até a cor EXATA do fundo na mesma altura da capa — antes o
          // degradê (270px) passava da capa (210px) e ela terminava num corte seco.
          style={{ height: COVER_HEIGHT, background: "linear-gradient(to bottom,transparent 35%,#06070c 100%)" }}
        />

        {/* Cover photo controls — own profile only */}
        {!isViewingOtherProfile && coverEditSrc && (
          <>
            <div
              className="absolute z-30 flex items-center pointer-events-none"
              style={{ top: COVER_CONTROLS_TOP, left: "12px", height: 40, padding: "0 14px", whiteSpace: "nowrap", borderRadius: 20, background: "rgba(0,0,0,.3)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,.18)", color: "#fff", fontSize: 12.5, fontWeight: 600 }}
            >
              {t("profile_cover_adjust_hint")}
            </div>
            <div className="absolute z-30 flex gap-2" style={{ top: COVER_CONTROLS_TOP, right: "12px" }}>
              <button
                onClick={handleCoverEditCancel}
                disabled={isSavingCover}
                aria-label={t("cancel")}
                className="flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
                style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,.3)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,.18)", color: "#fff" }}
              >
                <X className="h-[18px] w-[18px]" />
              </button>
              <button
                onClick={handleCoverEditSave}
                disabled={isSavingCover}
                className="flex items-center justify-center gap-1.5 active:scale-95 transition-transform disabled:opacity-60"
                style={{ height: 40, padding: "0 16px", borderRadius: 20, fontSize: 13.5, fontWeight: 640, color: "#0a0b12", background: "linear-gradient(rgba(255,255,255,.95),rgba(255,255,255,.82))" }}
              >
                {isSavingCover ? (
                  <span className="h-4 w-4 rounded-full border-2 border-black/30 border-t-transparent animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {t("save")}
              </button>
            </div>
          </>
        )}
        {!isViewingOtherProfile && !coverEditSrc && (
          <div className="absolute z-30 flex gap-2" style={{ top: COVER_CONTROLS_TOP, right: "12px" }}>
            {/* Com capa: um botão só ("…") com Trocar e Remover dentro — antes
                eram dois círculos lado a lado. Sem capa: o de adicionar direto. */}
            {profile.cover_photo ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    disabled={isSavingCover}
                    aria-label={t("profile_cover_options")}
                    className="flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
                    style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,.3)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,.18)", color: "#fff" }}
                  >
                    {isSavingCover ? (
                      <span className="h-[18px] w-[18px] rounded-full border-2 border-white/40 border-t-transparent animate-spin" />
                    ) : (
                      <MoreHorizontal className="h-[18px] w-[18px]" />
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => { hapticLight(); coverFileInputRef.current?.click(); }}>
                    <ImagePlus className="h-4 w-4 mr-2" />
                    {t("profile_change_cover")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleRemoveCover}
                    className="text-red-500 focus:text-red-500"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t("profile_remove_cover")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                onClick={() => { hapticLight(); coverFileInputRef.current?.click(); }}
                disabled={isSavingCover}
                aria-label={t("profile_edit_cover")}
                className="flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
                style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,.3)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,.18)", color: "#fff" }}
              >
                {isSavingCover ? (
                  <span className="h-[18px] w-[18px] rounded-full border-2 border-white/40 border-t-transparent animate-spin" />
                ) : (
                  <ImagePlus className="h-[18px] w-[18px]" />
                )}
              </button>
            )}
          </div>
        )}

        {/* Hidden file input for the cover photo (o ajuste é no próprio banner) */}
        <input
          ref={coverFileInputRef}
          type="file"
          accept="image/*"
          onChange={handleCoverFileChange}
          className="hidden"
        />

        {/* Back chip — only when viewing another user's profile */}
        {isViewingOtherProfile && (
          <button
            onClick={() => navigate(-1)}
            aria-label={t("goals_back")}
            className="absolute z-30 flex items-center justify-center active:scale-95 transition-transform"
            style={{ top: COVER_CONTROLS_TOP, left: "12px", width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,.3)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,.18)", color: "#fff" }}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}

        {/* No ajuste da capa o cabeçalho fica "transparente ao toque": o avatar
            continua visível sobre a foto (prévia fiel), mas o gesto chega ao
            banner que está por baixo. */}
        <div
          className={cn("relative px-4", coverEditSrc && "pointer-events-none")}
          style={{ paddingTop: "calc(80px + var(--app-header-offset))" }}
        >
          {/* Avatar + actions row */}
          <div className="flex items-end justify-between mb-3.5">
            {/* Avatar: anel cônico laranja→azul SÓ com flow ativo (é o sinal de
                "tem flow para ver", igual ao feed); sem flow, anel neutro. */}
            {(() => {
              // Abre no 1º flow ainda não visto (se todos foram vistos, no mais antigo).
              const entryStory = pickFlowEntry(profileStories, viewedFlowIds);
              const ring = (
                <div
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: "50%",
                    padding: "3px",
                    background: entryStory
                      ? "conic-gradient(from 200deg,#ff8a2a,#d8567a,#7b3ff2,#3a8dff,#ff8a2a)"
                      : "linear-gradient(160deg,rgba(255,255,255,.32),rgba(255,255,255,.08))",
                  }}
                >
                  <div className="w-full h-full rounded-full" style={{ border: "3px solid #06070c", background: "#06070c" }}>
                    <FlowCoinAvatar
                      flow={entryStory ?? null}
                      flipKey={profileUserId}
                      front={<UserAvatar photo={profile.photo} nickname={profile.nickname} size="2xl" quality={90} className="!h-full !w-full" />}
                    />
                  </div>
                </div>
              );
              return entryStory ? (
                <button
                  // O dedo encostou → começa a baixar o clipe antes do modal montar.
                  // São ~200ms de vantagem, e é o que faz o flow abrir já rodando.
                  onPointerDown={() => prefetchFlowMedia(entryStory, "auto")}
                  onClick={() => { setViewerSource("ring"); setSelectedProfileStory(entryStory); setIsStoryViewerOpen(true); }}
                  className="shrink-0 active:scale-95 transition-transform"
                  title={t("profile_view_flow")}
                >
                  {ring}
                </button>
              ) : (
                <div className="shrink-0">{ring}</div>
              );
            })()}

            {/* Actions */}
            {!isViewingOtherProfile ? (
              // Só as configurações ficam ao lado do avatar; "Editar perfil" e
              // "Compartilhar perfil" descem para uma linha própria abaixo da bio.
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => setSettingsOpen(true)}
                  aria-label={t("settings_title")}
                  className="flex items-center justify-center active:scale-95 transition-transform"
                  style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }}
                >
                  <Settings className="h-[19px] w-[19px]" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2 items-center">
                <FollowButton
                  targetUserId={profileUserId!}
                  targetName={profile?.nickname}
                  onFollowChange={(isNowFollowing) => {
                    // Reflete na hora nas regras de privacidade (posts ocultos
                    // para não-seguidores) — sem esperar recarregar o perfil
                    setViewerFollowsProfile(isNowFollowing);
                    getUserStatsDb(profileUserId!).then(setStats);
                  }}
                />
                <button
                  onClick={() => navigate(`/comunidade?user=${profileUserId}`)}
                  aria-label={t("profile_message_btn")}
                  className="flex items-center justify-center active:scale-95 transition-transform"
                  style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }}
                >
                  <MessageSquare className="h-[18px] w-[18px]" />
                </button>
                <button
                  onClick={() => {
                    const text = t("profile_share_other").replace("{handle}", profile?.nickname ?? "");
                    const profileUrl = profileShareUrl(profileUserId);
                    setShareDrawerText(text);
                    setShareDrawerUrl(profileUrl);
                    setShareDrawerTitle(t("profile_share_title"));
                    postReshare.prepare(null);
                    setShareDrawerOpen(true);
                  }}
                  aria-label={t("profile_share")}
                  className="flex items-center justify-center active:scale-95 transition-transform"
                  style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }}
                >
                  <Share2 className="h-[18px] w-[18px]" />
                </button>
                {/* Denunciar / bloquear — Guideline 1.2. O perfil é onde o
                    revisor da Apple procura essas ações, e até hoje era a
                    única superfície do app sem nenhuma delas. */}
                <button
                  onClick={() => setSafetyOpen(true)}
                  aria-label={t("user_safety_title")}
                  className="flex items-center justify-center active:scale-95 transition-transform"
                  style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }}
                >
                  <MoreHorizontal className="h-[18px] w-[18px]" />
                </button>
              </div>
            )}
          </div>

          {isViewingOtherProfile && (
            <UserSafetyDrawer
              open={safetyOpen}
              onOpenChange={setSafetyOpen}
              userId={profileUserId ?? null}
              userName={profile?.nickname ?? ""}
              // Depois de bloquear, ficar no perfil de quem você acabou de
              // bloquear é contraditório — e a próxima leitura já o esconderia
              // do feed e da busca. Voltamos para a tela anterior.
              onBlocked={() => navigate(-1)}
            />
          )}

          {/* Controlled settings drawer (own profile) */}
          {!isViewingOtherProfile && (
            <SettingsDrawer
              profile={profile}
              userId={user!.id}
              userEmail={user?.email ?? ""}
              stats={stats}
              onProfileUpdated={(updated) => setProfile(updated)}
              onRequestDeleteAccount={() => setIsDeleteAccountOpen(true)}
              open={settingsOpen}
              onOpenChange={(open) => { setSettingsOpen(open); if (!open) { setSettingsOpenToProfile(false); setArchivedFlowFromNotif(null); } }}
              hideTrigger
              directToProfileEdit={settingsOpenToProfile}
              initialArchivedFlow={archivedFlowFromNotif}
            />
          )}

          {/* Name + verified + insignias */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <h1 className="text-white" style={{ fontSize: "21px", fontWeight: 740, letterSpacing: "-0.01em" }}>
              {profile.nickname}
            </h1>
            {profile.is_verified && <VerifiedBadge size="md" tier={profile.verified_tier} />}
            <UserInsignias userId={profileUserId || ""} showStreak />
          </div>

          {/* Botão Admin — só no próprio perfil de conta oficial (selo dourado).
              Conta "notable" (selo azul) é verificada mas não é da equipe. A
              autorização real continua no servidor (app_admins). */}
          {!isViewingOtherProfile && profile.verified_tier === "official" && (
            <button
              onClick={() => navigate("/admin")}
              className="mt-2 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-brand/10 text-brand hover:bg-brand/20 transition-colors border border-brand/20"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Admin
            </button>
          )}

          {/* Handle */}
          {profile.handle && (
            <p className="mt-1" style={{ fontSize: "13px", color: "rgba(255,255,255,.5)" }}>@{profile.handle.replace(/^@/, "")}</p>
          )}

            {/* Bio and Commercial Profile */}
            <div className="space-y-3 mt-3">
              {profile.bio && (
                <p style={{ fontSize: "13.5px", lineHeight: 1.5, color: "rgba(255,255,255,.82)" }}>
                  {profile.bio}
                </p>
              )}

              {/* Próprio perfil: Editar e Compartilhar lado a lado, MESMO peso
                  (os dois secundários, mesma largura) — nenhum grita mais que o
                  outro. */}
              {!isViewingOtherProfile && (
                <div className="flex gap-2">
                  <button
                    onClick={() => { hapticLight(); setSettingsOpenToProfile(true); setSettingsOpen(true); }}
                    className="flex-1 h-10 rounded-full text-sm font-semibold text-white active:scale-[0.98] transition-transform"
                    style={{ background: "rgba(255,255,255,.09)" }}
                  >
                    {t("profile_edit_btn")}
                  </button>
                  <button
                    onClick={() => {
                      hapticLight();
                      const handle = (profile.handle ?? profile.nickname ?? "").replace(/^@/, "");
                      setShareDrawerText(t("profile_share_own").replace("{handle}", handle));
                      setShareDrawerUrl(profileShareUrl(user!.id));
                      setShareDrawerTitle(t("profile_share_title"));
                      postReshare.prepare(null);
                      setShareDrawerOpen(true);
                    }}
                    className="flex-1 h-10 rounded-full text-sm font-semibold text-white active:scale-[0.98] transition-transform"
                    style={{ background: "rgba(255,255,255,.09)" }}
                  >
                    {t("profile_share")}
                  </button>
                </div>
              )}

              {/* Stats cards */}
              <div className="flex gap-2">
                <div
                  className="flex-1 text-center"
                  style={{ borderRadius: "18px", padding: "12px 8px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}
                >
                  <div style={{ fontSize: "17px", fontWeight: 740, color: "#fff" }}>{stats.postsCount}</div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,.5)" }}>{t("profile_posts")}</div>
                </div>
                <button
                  onClick={() => {
                    if (isViewingOtherProfile && profile?.hide_follow_lists) {
                      toast({ title: t("profile_follows_private") });
                      return;
                    }
                    setShowFollowersModal(true);
                  }}
                  className="flex-1 text-center active:scale-95 transition-transform"
                  style={{ borderRadius: "18px", padding: "12px 8px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}
                >
                  <div className="flex items-center justify-center gap-1" style={{ fontSize: "17px", fontWeight: 740, color: "#fff" }}>
                    {isViewingOtherProfile && profile?.hide_follow_lists && <Lock className="h-3 w-3" style={{ color: "rgba(255,255,255,.5)" }} />}
                    {stats.followersCount}
                  </div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,.5)" }}>{t("profile_stat_followers")}</div>
                </button>
                <button
                  onClick={() => {
                    if (isViewingOtherProfile && profile?.hide_follow_lists) {
                      toast({ title: t("profile_follows_private") });
                      return;
                    }
                    setShowFollowingModal(true);
                  }}
                  className="flex-1 text-center active:scale-95 transition-transform"
                  style={{ borderRadius: "18px", padding: "12px 8px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}
                >
                  <div className="flex items-center justify-center gap-1" style={{ fontSize: "17px", fontWeight: 740, color: "#fff" }}>
                    {isViewingOtherProfile && profile?.hide_follow_lists && <Lock className="h-3 w-3" style={{ color: "rgba(255,255,255,.5)" }} />}
                    {stats.followingCount}
                  </div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,.5)" }}>{t("profile_stat_following")}</div>
                </button>
              </div>

              {/* Commercial Profile Info — parte da Vitrine (FEATURES.store).
                  Sem a tela, este frame anuncia um negócio que não tem para
                  onde levar. */}
              {FEATURES.store && commercialProfile && (
                <div className="flex flex-col gap-1 p-2 rounded-lg bg-muted/20 border border-brand/20">
                  <div className="flex items-center gap-2">
                    {commercialProfile.business_phone ? (
                      <button
                        onClick={() => Browser.open({ url: `https://wa.me/55${commercialProfile.business_phone!.replace(/\D/g, "")}` })}
                        className="text-sm font-medium text-brand hover:underline flex items-center gap-1"
                        title={t("profile_contact_btn")}
                      >
                        <span>💬</span>
                        {commercialProfile.business_name}
                      </button>
                    ) : (
                      <div className="text-sm font-medium text-brand">
                        🏪 {commercialProfile.business_name}
                      </div>
                    )}
                    {commercialProfile.business_segment && (
                      <div className="text-xs px-2 py-0.5 rounded bg-brand/20 text-brand font-medium">
                        {commercialProfile.business_segment === "academia" && t("seg_academia")}
                        {commercialProfile.business_segment === "personal_trainer" && t("seg_personal_trainer")}
                        {commercialProfile.business_segment === "nutricionista" && t("seg_nutricionista")}
                        {commercialProfile.business_segment === "psicologo" && t("seg_psicologo")}
                        {commercialProfile.business_segment === "fisioterapeuta" && t("seg_fisioterapeuta")}
                        {commercialProfile.business_segment === "coach" && t("seg_coach")}
                        {commercialProfile.business_segment === "outros" && t("seg_outros")}
                      </div>
                    )}
                    {servicePlans.length > 0 && (
                      <button
                        onClick={() => setIsPlansModalOpen(true)}
                        className="ml-auto flex items-center gap-1 text-xs text-brand hover:text-brand/80 transition-colors"
                        title={t("profile_plans_tooltip")}
                      >
                        <ListChecks className="h-3.5 w-3.5" />
                        <span>{servicePlans.length} {servicePlans.length === 1 ? t("profile_plan_singular") : t("profile_plan_plural")}</span>
                      </button>
                    )}
                  </div>
                  {isSafeExternalUrl(commercialProfile.business_website) && (
                    <button
                      onClick={() => openExternalUrl(commercialProfile.business_website, Browser.open)}
                      className="text-xs text-brand hover:underline flex items-center gap-1"
                    >
                      <span>🔗</span>
                      {commercialProfile.business_website!.replace(/^https?:\/\//, "")}
                    </button>
                  )}
                </div>
              )}
            </div>

          {/* Plans Modal */}
          <Dialog open={isPlansModalOpen} onOpenChange={setIsPlansModalOpen}>
            <DialogContent className="max-w-sm rounded-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-brand" />
                  {t("profile_plans_title")}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-1">
                {commercialProfile && (
                  <p className="text-sm text-muted-foreground">{commercialProfile.business_name}</p>
                )}
                {servicePlans.map((plan, idx) => (
                  <div key={idx} className="rounded-xl px-4 py-3 space-y-1" style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)" }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{plan.name}</span>
                      {plan.price && (
                        <span className="text-sm font-bold text-brand">R$ {plan.price}</span>
                      )}
                    </div>
                    {plan.description && (
                      <p className="text-xs text-muted-foreground leading-snug">{plan.description}</p>
                    )}
                  </div>
                ))}
                {servicePlans.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">{t("profile_no_plans")}</p>
                )}
              </div>
            </DialogContent>
          </Dialog>

        </div>
      </div>

      {/* Public Goals Strip */}
      {userGoals.length > 0 && (
        <div className="space-y-2 px-4">
          <div className="flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-brand" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("profile_goals_section")}
            </span>
            {/* Dono com metas ocultas: alterna para revelá-las (esmaecidas). */}
            {!isViewingOtherProfile && hiddenGoalsCount > 0 && (
              <button
                type="button"
                onClick={() => setShowHiddenGoals((v) => !v)}
                className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold active:opacity-70"
                style={{ color: "rgba(255,255,255,.55)" }}
              >
                {showHiddenGoals ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {showHiddenGoals
                  ? t("profile_goals_hide_hidden")
                  : t("profile_goals_show_hidden").replace("{n}", String(hiddenGoalsCount))}
              </button>
            )}
          </div>
          {/* overflow-y-hidden: overflow-x-auto sozinho vira scroller vertical
              também (ver a barra de abas abaixo) e prenderia o arrasto da página. */}
          <div className="flex gap-2 overflow-x-auto overflow-y-hidden pb-1 scrollbar-none -mx-4 px-4">
            {sortedUserGoals.map((goal) => {
              const isDone = goal.perc >= 100;
              const isHidden = hiddenGoalIds.has(goal.id);
              // Só meta CONCLUÍDA do PRÓPRIO perfil ganha o menu (ocultar/excluir).
              const hasMenu = isDone && !isViewingOtherProfile;
              return (
                <div key={goal.id} className="relative flex-shrink-0" style={{ opacity: isHidden ? 0.5 : 1 }}>
                <button
                  onClick={() => setSelectedGoalForDrawer(goal)}
                  className="w-44 rounded-xl p-3 space-y-2 text-left active:scale-95 transition-transform"
                  style={{
                    background: isDone
                      ? "linear-gradient(rgba(34,197,94,.22),rgba(34,197,94,.08))"
                      : "linear-gradient(rgba(255,255,255,.09),rgba(255,255,255,.03))",
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                    border: isDone ? "1px solid rgba(34,197,94,.35)" : "1px solid rgba(255,255,255,.10)",
                  }}
                >
                  <p className={`text-xs font-medium leading-snug line-clamp-2 ${hasMenu ? "pr-5" : ""}`}>
                    {goal.description}
                  </p>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      {isDone ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          {t("profile_goal_completed")}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{t("goals_progress")}</span>
                      )}
                      <span className={`text-xs font-semibold ${isDone ? "text-emerald-400" : "text-brand"}`}>
                        {goal.perc}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isDone ? "bg-emerald-500" : "bg-brand"}`}
                        style={{ width: `${Math.min(goal.perc, 100)}%` }}
                      />
                    </div>
                  </div>
                </button>
                {hasMenu && (
                  <button
                    type="button"
                    onClick={() => setGoalMenuTarget(goal)}
                    aria-label={t("profile_goal_menu_aria")}
                    className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full flex items-center justify-center active:bg-white/10"
                    style={{ color: "rgba(255,255,255,.7)" }}
                  >
                    {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <MoreHorizontal className="h-4 w-4" />}
                  </button>
                )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Goal Detail Drawer */}
      <GoalDetailDrawer
        goal={selectedGoalForDrawer}
        routines={routines}
        onClose={() => setSelectedGoalForDrawer(null)}
        onEditGoal={handleProfileEditGoal}
        onDeleteGoal={handleProfileDeleteGoal}
        onToggleRoutineLink={handleProfileToggleRoutineLink}
        readOnly={isViewingOtherProfile}
        // Perfil alheio: "Responder" manda DM ao dono com a meta anexada.
        replyTo={isViewingOtherProfile && userId ? { userId, nickname: profile?.nickname ?? "" } : null}
        onCreateRoutine={() => {
          setSelectedGoalForDrawer(null);
          navigate("/metas?tab=rotinas&action=create-routine");
        }}
      />

      {/* Menu da meta concluída: ocultar/mostrar no perfil e excluir */}
      <Drawer open={!!goalMenuTarget} onOpenChange={(o) => { if (!o) setGoalMenuTarget(null); }} {...GLASS_SHEET_PROPS}>
        <DrawerContent style={GLASS_SHEET_STYLE}>
          <DrawerHeader className="text-left">
            <DrawerTitle className="truncate" style={{ color: "#fff" }}>{goalMenuTarget?.description}</DrawerTitle>
          </DrawerHeader>
          {goalMenuTarget && (
            <div className="px-4 space-y-2" style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
              <button
                type="button"
                disabled={goalActionBusy}
                onClick={() => handleToggleGoalHidden(goalMenuTarget)}
                className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left disabled:opacity-60"
                style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", color: "#fff" }}
              >
                {hiddenGoalIds.has(goalMenuTarget.id) ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold">
                    {hiddenGoalIds.has(goalMenuTarget.id) ? t("profile_goal_show_action") : t("profile_goal_hide_action")}
                  </span>
                  <span className="block text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
                    {hiddenGoalIds.has(goalMenuTarget.id) ? t("profile_goal_show_desc") : t("profile_goal_hide_desc")}
                  </span>
                </span>
              </button>
              <button
                type="button"
                disabled={goalActionBusy}
                onClick={() => { setGoalToDelete(goalMenuTarget); setGoalMenuTarget(null); }}
                className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left disabled:opacity-60"
                style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", color: "#f87171" }}
              >
                <Trash2 className="h-5 w-5" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold">{t("profile_goal_delete_action")}</span>
                  <span className="block text-xs" style={{ color: "rgba(248,113,113,.7)" }}>{t("profile_goal_delete_desc")}</span>
                </span>
              </button>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      <AlertDialog open={!!goalToDelete} onOpenChange={(o) => { if (!o && !goalActionBusy) setGoalToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("profile_goal_delete_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("profile_goal_delete_confirm_desc").replace("{goal}", goalToDelete?.description ?? "")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={goalActionBusy}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={goalActionBusy}
              onClick={(e) => { e.preventDefault(); handleConfirmDeleteGoal(); }}
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Flows fixados — logo acima das abas. Segue a mesma privacidade dos
          posts: perfil que esconde posts de quem não segue esconde estes também. */}
      {!(isViewingOtherProfile && profile?.hide_posts_from_non_followers && !viewerFollowsProfile) && (
        <PinnedFlowsStrip
          flows={pinnedFlows}
          onPrefetch={(flow) => prefetchFlowMedia(flow, "auto")}
          onOpen={(flow) => {
            setViewerSource("pinned");
            setSelectedProfileStory(flow);
            setIsStoryViewerOpen(true);
          }}
        />
      )}

      {/* Posts, Shots and Store Tabs */}
      <Tabs defaultValue="posts" className="w-full px-4">
        {/* Com 5 abas (Publicações, Treinos, Clipes, Marcações e Vitrine) a linha
            não cabe na largura do iPhone — rola na horizontal em vez de
            quebrar/comprimir.

            No v1 ficam "Publicações", "Treinos" e "Marcações" (flags próprias
            profileWorkoutsTab / profileTaggedTab, religadas em 28/09/2026).
            Clipes/Vitrine seguem atrás de FEATURES.profileExtraTabs: abas vazias num perfil recém-criado são o
            sinal mais forte de app abandonado, e elas não têm conteúdo no dia 1.

            Por isso o `overflow-x-auto` é condicional: com uma aba só não há o
            que rolar, e o container ainda assim arrastava / dava rubber-band no
            WKWebView — uma faixa que se mexe sem ter conteúdo escondido parece
            defeito. Continua ligado assim que existir mais de uma aba, então
            religar as flags não traz o problema de layout de volta.

            Scroll VERTICAL da barra (corrigido 29/09/2026): pela regra do CSS,
            `overflow-x: auto` força o eixo y a `auto` também — e o sublinhado
            da aba ativa usava `-mb-px` para cobrir a borda, sobrando 1px de
            conteúdo vertical. A barra virava um scroller vertical: o toque que
            começava nela rolava (e dava rubber-band) a própria barra em vez da
            página. Agora o eixo y é travado (`overflow-y-hidden`, e o arrasto
            vertical encadeia para a página) e a linha cinza é uma sombra
            INTERNA da barra: o sublinhado (borda da aba, pintada por cima da
            sombra do pai) a cobre sem sair da caixa, então nada é recortado. */}
        <TabsList className={`w-full justify-start gap-5 !h-auto !bg-transparent !rounded-none !p-0 !shadow-[inset_0_-1px_0_rgba(255,255,255,0.1)] ${visibleTabCount > 1 ? "overflow-x-auto overflow-y-hidden no-scrollbar" : ""}`}>
          <TabsTrigger
            value="posts"
            className="shrink-0 whitespace-nowrap !rounded-none !bg-transparent !shadow-none !px-0 pb-3 border-b-2 border-transparent !text-white/45 data-[state=active]:!border-white data-[state=active]:!text-white text-[14px] font-[640]"
          >
            {t("profile_posts")} ({feedPosts.length})
          </TabsTrigger>
          {FEATURES.profileWorkoutsTab && (
          <TabsTrigger
            value="treinos"
            className="shrink-0 whitespace-nowrap !rounded-none !bg-transparent !shadow-none !px-0 pb-3 border-b-2 border-transparent !text-white/45 data-[state=active]:!border-white data-[state=active]:!text-white text-[14px] font-[640]"
          >
            {t("profile_workouts")} ({workoutPosts.length})
          </TabsTrigger>
          )}
          {FEATURES.profileExtraTabs && FEATURES.shots && (
          <TabsTrigger
            value="shots"
            className="shrink-0 whitespace-nowrap !rounded-none !bg-transparent !shadow-none !px-0 pb-3 border-b-2 border-transparent !text-white/45 data-[state=active]:!border-white data-[state=active]:!text-white text-[14px] font-[640]"
          >
            {t("nav_clips")}{tabsDataLoaded ? ` (${shots.length})` : ""}
          </TabsTrigger>
          )}
          {FEATURES.profileTaggedTab && FEATURES.postTags && (
          <TabsTrigger
            value="marcacoes"
            className="shrink-0 whitespace-nowrap !rounded-none !bg-transparent !shadow-none !px-0 pb-3 border-b-2 border-transparent !text-white/45 data-[state=active]:!border-white data-[state=active]:!text-white text-[14px] font-[640]"
          >
            {t("profile_tagged")}{tabsDataLoaded ? ` (${taggedPosts.length})` : ""}
          </TabsTrigger>
          )}
          {FEATURES.store && profileOffers.length > 0 && (
            <TabsTrigger
              value="vitrine"
              className="shrink-0 whitespace-nowrap !rounded-none !bg-transparent !shadow-none !px-0 pb-3 border-b-2 border-transparent !text-white/45 data-[state=active]:!border-white data-[state=active]:!text-white text-[14px] font-[640]"
            >
              {commercialProfile ? `${t("settings_section_business")} (${profileOffers.length})` : `${t("nav_store")} (${profileOffers.length})`}
            </TabsTrigger>
          )}
        </TabsList>

        {/* Posts Tab */}
        <TabsContent value="posts" className="space-y-4">
          {isViewingOtherProfile && profile?.hide_posts_from_non_followers && !viewerFollowsProfile ? (
            <div className="rounded-xl p-8 text-center flex flex-col items-center gap-2" style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}>
              <Lock className="h-6 w-6" style={{ color: "rgba(255,255,255,.5)" }} />
              <p className="text-sm font-medium text-white">{t("profile_posts_private")}</p>
              <p className="text-xs text-white/50">{t("profile_posts_private_desc")}</p>
            </div>
          ) : feedPosts.length > 0 ? (
            // Grade quase encostada: 3px entre tiles, cantos de 12px e só 4px
            // de margem até a borda da tela (-mx-3 dentro do px-4 das Tabs) —
            // rente à borda, o canto arredondado parecia cortado. Mesma regra
            // nas 4 grades desta tela.
            <div className="-mx-3 grid gap-[3px] grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {feedPosts.map((post) => (
                <button
                  key={post.id}
                  onClick={() => { hapticLight(); setPostsViewer({ tab: "posts", postId: post.id }); }}
                  className="group relative aspect-square overflow-hidden rounded-[12px] bg-muted transition-all cursor-pointer"
                >
                  {/* Miniatura guardada no aparelho (ver @/lib/thumb-cache): a grade
                      monta dezenas de fotos de centenas de KB de uma vez. */}
                  <ImageWithFallback
                    src={post.photo ?? undefined}
                    alt={post.description}
                    thumbSize={GRID_THUMB_PX}
                    className="h-full w-full object-cover group-hover:scale-110 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  {/* Multi-photo indicator */}
                  {post.photos && post.photos.length > 1 && <MultiPhotoBadge count={post.photos.length} />}
                  {post.video_url && <VideoPostBadge />}
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl p-6 text-center" style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}>
              <p className="text-sm text-white/50">
                {t("profile_no_posts")}
              </p>
            </div>
          )}
        </TabsContent>

        {/* Treinos Tab — só os posts de resumo de treino em que a pessoa NÃO
            anexou foto da galeria/câmera (canvas puro). Mantém a aba
            Publicações limpa, com as fotos de verdade. O tile mostra sempre o
            card gerado (`workoutSummary.imageUrl`), que numa corrida com GPS
            não é a primeira imagem do post — a primeira é o mapa do trajeto.
            Abre o MESMO Post Viewer da aba Publicações. */}
        <TabsContent value="treinos" className="space-y-4">
          {isViewingOtherProfile && profile?.hide_posts_from_non_followers && !viewerFollowsProfile ? (
            <div className="rounded-xl p-8 text-center flex flex-col items-center gap-2" style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}>
              <Lock className="h-6 w-6" style={{ color: "rgba(255,255,255,.5)" }} />
              <p className="text-sm font-medium text-white">{t("profile_posts_private")}</p>
              <p className="text-xs text-white/50">{t("profile_posts_private_desc")}</p>
            </div>
          ) : workoutPosts.length > 0 ? (
            <div className="-mx-3 grid gap-[3px] grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {workoutPosts.map((post) => (
                <button
                  key={post.id}
                  onClick={() => { hapticLight(); setPostsViewer({ tab: "treinos", postId: post.id }); }}
                  className="group relative aspect-square overflow-hidden rounded-[12px] bg-muted transition-all cursor-pointer"
                >
                  <ImageWithFallback
                    src={post.workoutSummary?.imageUrl || post.photo || undefined}
                    alt={post.workoutSummary?.routineName || post.description}
                    thumbSize={GRID_THUMB_PX}
                    className="h-full w-full object-cover group-hover:scale-110 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl p-6 text-center" style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}>
              <p className="text-sm text-white/50">
                {t("profile_no_workouts")}
              </p>
            </div>
          )}
        </TabsContent>

        {/* Shots Tab */}
        <TabsContent value="shots" className="space-y-4">
          {isViewingOtherProfile && profile?.hide_posts_from_non_followers && !viewerFollowsProfile ? (
            <div className="rounded-xl p-8 text-center flex flex-col items-center gap-2" style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}>
              <Lock className="h-6 w-6" style={{ color: "rgba(255,255,255,.5)" }} />
              <p className="text-sm font-medium text-white">{t("profile_shots_private")}</p>
              <p className="text-xs text-white/50">{t("profile_shots_private_desc")}</p>
            </div>
          ) : shots.length > 0 ? (
            <div className="-mx-3 grid gap-[3px] grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {shots.map((shot) => (
                <div
                  key={shot.id}
                  className="group relative aspect-square overflow-hidden rounded-[12px] bg-black transition-all"
                >
                  <button
                    onClick={() => navigate(`/shots`, { state: { shotId: shot.id } })}
                    className="w-full h-full cursor-pointer"
                  >
                    {/* ShotThumb: carrega só o que está na tela e LIBERA o player
                        do iOS ao sair — senão a grade estoura o teto de vídeos
                        simultâneos e o shot em tela cheia abre sem imagem. */}
                    <ShotThumb
                      videoUrl={shot.video_url}
                      className="h-full w-full object-cover group-hover:scale-110 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    {/* Glyph de play — sinaliza que o tile é um vídeo clicável */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="rounded-full bg-black/35 backdrop-blur-[2px] p-1.5">
                        <Play className="h-4 w-4 text-white" style={{ fill: "rgba(255,255,255,0.85)" }} />
                      </div>
                    </div>
                  </button>

                  {!isViewingOtherProfile && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedShot(shot);
                        setIsShotEditorOpen(true);
                      }}
                      aria-label={t("edit")}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/55 active:scale-95 transition-transform"
                    >
                      <Settings className="h-4 w-4 text-white" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl p-6 text-center" style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}>
              <p className="text-sm text-white/50">
                {t("profile_no_shots")}
              </p>
            </div>
          )}
        </TabsContent>

        {/* Marcações Tab — posts de OUTRAS pessoas em que este perfil foi
            marcado. A grade é a mesma dos posts; o autor (que não é o dono do
            perfil) aparece no chip do tile e no cabeçalho do drawer. */}
        <TabsContent value="marcacoes" className="space-y-4">
          {isViewingOtherProfile && profile?.hide_posts_from_non_followers && !viewerFollowsProfile ? (
            <div className="rounded-xl p-8 text-center flex flex-col items-center gap-2" style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}>
              <Lock className="h-6 w-6" style={{ color: "rgba(255,255,255,.5)" }} />
              <p className="text-sm font-medium text-white">{t("profile_tagged_private")}</p>
              <p className="text-xs text-white/50">{t("profile_tagged_private_desc")}</p>
            </div>
          ) : taggedPosts.length > 0 ? (
            <div className="-mx-3 grid gap-[3px] grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {taggedPosts.map((post) => (
                <button
                  key={post.id}
                  onClick={() => { hapticLight(); setPostsViewer({ tab: "marcacoes", postId: post.id }); }}
                  className="group relative aspect-square overflow-hidden rounded-[12px] bg-muted transition-all cursor-pointer"
                >
                  {/* Miniatura guardada no aparelho (ver @/lib/thumb-cache): a grade
                      monta dezenas de fotos de centenas de KB de uma vez. */}
                  <ImageWithFallback
                    src={post.photo ?? undefined}
                    alt={post.description}
                    thumbSize={GRID_THUMB_PX}
                    className="h-full w-full object-cover group-hover:scale-110 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  {/* Multi-photo indicator */}
                  {post.photos && post.photos.length > 1 && <MultiPhotoBadge count={post.photos.length} />}
                  {post.video_url && <VideoPostBadge />}
                  {/* Repostado por esta pessoa (2026-10-05): o repost mora só aqui,
                      não em Publicações. */}
                  {post.repostedBy?.some((u) => u.id === profileUserId) && (
                    <span
                      role="img"
                      aria-label={t("profile_reposted_badge_aria")}
                      className="pointer-events-none absolute left-2 top-2 inline-flex h-[22px] w-[22px] items-center justify-center rounded-full text-white"
                      style={{ background: "rgba(10,11,18,.55)", border: "1px solid rgba(255,255,255,.18)", boxShadow: "0 2px 8px rgba(0,0,0,.35)" }}
                    >
                      <Repeat2 className="h-3 w-3" />
                    </span>
                  )}
                  {/* Autor do post — a foto é de outra pessoa, então o tile precisa
                      dizer de quem é sem exigir que o post seja aberto. */}
                  <div className="absolute bottom-0 left-0 right-0 flex items-center gap-1 px-1.5 py-1 pointer-events-none" style={{ background: "linear-gradient(rgba(0,0,0,0),rgba(0,0,0,.6))" }}>
                    <UserAvatar
                      photo={post.userPhoto}
                      nickname={post.userNickname}
                      size="sm"
                      className="h-4 w-4 shrink-0 ring-1 ring-white/25"
                    />
                    <span className="text-[10px] font-medium truncate" style={{ color: "rgba(255,255,255,.9)" }}>
                      {post.userNickname}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl p-6 text-center" style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}>
              <p className="text-sm text-white/50">
                {t("profile_no_tagged")}
              </p>
            </div>
          )}
        </TabsContent>

        {/* Serviços / Vitrine Tab */}
        {profileOffers.length > 0 && (
          <TabsContent value="vitrine" className="space-y-4">
            {/* Cabeçalho do negócio */}
            {commercialProfile && (
              <div className="rounded-2xl bg-card border border-border/50 overflow-hidden">
                {commercialProfile.business_banner_url && (
                  <div className="h-24 w-full overflow-hidden">
                    <img src={commercialProfile.business_banner_url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex items-center gap-3 p-4">
                  <ImageWithFallback
                    src={commercialProfile.business_logo_url ?? undefined}
                    alt={commercialProfile.business_name ?? ""}
                    className="h-12 w-12 rounded-2xl object-cover border-2 border-background shadow-md shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-black tracking-tight">{commercialProfile.business_name}</p>
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20">{t("profile_partner")}</span>
                    </div>
                    {commercialProfile.business_segment && (
                      <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">{commercialProfile.business_segment}</p>
                    )}
                    {commercialProfile.business_description && (
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-snug">{commercialProfile.business_description}</p>
                    )}
                  </div>
                  {isSafeExternalUrl(commercialProfile.business_website) && (
                    <button onClick={() => openExternalUrl(commercialProfile.business_website, Browser.open)} className="shrink-0 text-muted-foreground hover:text-brand transition-colors">
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Cards de serviço */}
            <div className="flex flex-col gap-3">
              {profileOffers.map((offer) => {
                const segment = offer.additional_info?.match(/^\[(.+?)\]/)?.[1] ?? null;
                const plansText = offer.additional_info
                  ? offer.additional_info.replace(/^\[.+?\]\n?/, "")
                  : null;
                const plansLines = plansText
                  ? plansText.split("\n").filter(Boolean).slice(0, 3)
                  : [];
                const isService = !!commercialProfile;

                return (
                  <div
                    key={offer.id}
                    className="bg-card group rounded-2xl border border-border/50 overflow-hidden hover:shadow-lg transition-all duration-300"
                  >
                    <div className="flex gap-0">
                      {/* Foto lateral */}
                      <div className="w-28 sm:w-36 shrink-0 overflow-hidden bg-muted/30">
                        <img
                          src={offer.image_url}
                          alt={offer.title}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                      {/* Conteúdo */}
                      <div className="flex-1 p-4 flex flex-col gap-2 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {segment && (
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20">{segment}</span>
                          )}
                        </div>

                        <h4 className="text-sm font-black leading-tight tracking-tight">{offer.title}</h4>

                        {isService && plansLines.length > 0 && (
                          <ul className="space-y-0.5">
                            {plansLines.map((line, idx) => (
                              <li key={idx} className="text-[11px] text-muted-foreground leading-snug line-clamp-1 flex items-start gap-1">
                                <span className="text-brand shrink-0 mt-0.5">•</span> {line}
                              </li>
                            ))}
                          </ul>
                        )}

                        {!isService && offer.coupon_code && (
                          <div className="flex items-center gap-1">
                            <Tag className="h-3 w-3 text-brand" />
                            <span className="text-[10px] font-black text-brand font-mono uppercase">{offer.coupon_code}</span>
                          </div>
                        )}

                        <div className="mt-auto pt-1 flex items-center justify-between gap-2 flex-wrap">
                          {offer.price && (
                            <span className="text-xs text-muted-foreground font-medium">
                              {isService ? t("profile_from_price") : ""}
                              <span className="text-base font-black text-foreground tracking-tighter">R$ {offer.price}</span>
                            </span>
                          )}
                          <button
                            onClick={() => {
                              incrementOfferClickDb(offer.id, offer.user_id).catch(() => { });
                              openExternalUrl(offer.link_url, Browser.open);
                            }}
                            className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand/90 transition-colors shrink-0"
                          >
                            {isService
                              ? <><Phone className="h-3.5 w-3.5" /> {t("profile_contact_btn")}</>
                              : <><ArrowRight className="h-3.5 w-3.5" /> {t("profile_view_offer")}</>
                            }
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Publicações em tela cheia — mesmo PostCard do feed (ver ProfilePostsViewer) */}
      <ProfilePostsViewer
        open={!!postsViewer}
        onClose={() => setPostsViewer(null)}
        posts={
          postsViewer?.tab === "treinos" ? workoutPosts
            : postsViewer?.tab === "marcacoes" ? taggedPosts
            : feedPosts
        }
        initialPostId={postsViewer?.postId ?? null}
        title={
          postsViewer?.tab === "treinos" ? t("profile_workouts")
            : postsViewer?.tab === "marcacoes" ? t("profile_tagged")
            : t("profile_viewer_posts")
        }
        handle={profile?.handle ?? null}
        ownerGoals={!isViewingOtherProfile ? userGoals : undefined}
        onShare={handleSharePostFromViewer}
        onPostDeleted={(postId) => {
          setPosts((prev) => prev.filter((p) => p.id !== postId));
          // Reflete no card de stats e no rótulo da aba sem esperar o cache expirar
          setStats((prev) => ({ ...prev, postsCount: Math.max(0, prev.postsCount - 1) }));
        }}
        onPostEdited={(postId, description, taggedUsers) => {
          setPosts((prev) =>
            prev.map((p) =>
              p.id === postId
                ? {
                    ...p,
                    ...(description !== undefined ? { description } : {}),
                    ...(taggedUsers !== undefined ? { taggedUsers } : {}),
                  }
                : p,
            ),
          );
        }}
        // Bloquear alguém a partir do post dele: ficar no perfil de quem acabou
        // de ser bloqueado é contraditório — volta para a tela anterior.
        onBlocked={() => navigate(-1)}
      />

      {/* Followers Drawer */}
      <FollowListDrawer
        open={showFollowersModal}
        onOpenChange={setShowFollowersModal}
        type="followers"
        users={followers}
        isLoading={isLoadingFollowers}
        followStatus={followerFollowStatus}
      />

      {/* Following Drawer */}
      <FollowListDrawer
        open={showFollowingModal}
        onOpenChange={setShowFollowingModal}
        type="following"
        users={following}
        isLoading={isLoadingFollowers}
        followStatus={followingFollowStatus}
        emptySuggestions={
          isViewingOtherProfile
            ? undefined
            : {
                title: t("follow_list_suggested_title"),
                description: t("follow_list_suggested_desc"),
                users: suggestedProfiles,
                isLoading: isLoadingSuggested,
              }
        }
      />

      {/* Shot Editor Drawer */}
      <ShotEditorDrawer
        open={isShotEditorOpen}
        onOpenChange={setIsShotEditorOpen}
        shot={selectedShot}
        onSaved={(updatedDescription) => {
          setShots((prev) =>
            prev.map((s) => s.id === selectedShot?.id ? { ...s, description: updatedDescription } : s)
          );
          setSelectedShot(null);
        }}
        onDeleted={(shotId) => {
          setShots((prev) => prev.filter((s) => s.id !== shotId));
          setSelectedShot(null);
        }}
      />

      <ShareDrawer
        open={shareDrawerOpen}
        onOpenChange={setShareDrawerOpen}
        text={shareDrawerText}
        url={shareDrawerUrl}
        title={shareDrawerTitle}
        onShareToFlow={postReshare.shareToFlow}
        onEditFlow={postReshare.editFlow}
        onRepostToFeed={postReshare.repostToFeed}
        repostedToFeed={postReshare.repostedToFeed}
        onUndoRepostToFeed={postReshare.undoRepostToFeed}
      />

      {/* Flow Viewer — mesmo componente do feed, embutido sobre o perfil */}
      {/* Suspense sem fallback: um fallback `fixed` aqui ficaria preso ao
          PageTransition (transform); o spinner do próprio viewer já vai por portal. */}
      {isStoryViewerOpen && selectedProfileStory && (
        <React.Suspense fallback={null}>
          <FlowViewer
            embedded={{
              stories: viewerStories,
              storyId: selectedProfileStory.id,
              onNavigate: (id) => {
                const next = viewerStories.find((s) => s.id === id);
                if (next) setSelectedProfileStory(next);
              },
              onClose: () => {
                setIsStoryViewerOpen(false);
                setSelectedProfileStory(null);
                // Fixou/desafixou com o viewer aberto: agora pode reler a faixa.
                if (!isViewingOtherProfile && profileUserId) {
                  getUserPinnedFlowsDb(profileUserId).then(setPinnedFlows);
                }
                // Ao fechar, ressincroniza o que foi visto: o viewer grava cada
                // visualização enquanto o usuário assiste, e o ring precisa reabrir
                // no lugar certo.
                getMyViewedFlowUserIdsDb(profileStories.map((s) => s.id))
                  .then(setViewedFlowIds)
                  .catch(() => {});
              },
              onDeleted: (id) => {
                setProfileStories((prev) => prev.filter((s) => s.id !== id));
                setPinnedFlows((prev) => prev.filter((s) => s.id !== id));
              },
            }}
          />
        </React.Suspense>
      )}

      {/* Encerrar conta: motivo + aviso do prazo de 30 dias (exclusão agendada) */}
      {user && (
        <DeleteAccountDrawer
          open={isDeleteAccountOpen}
          onOpenChange={setIsDeleteAccountOpen}
          userId={user.id}
        />
      )}

      {/* Centralized confirmation drawer — replaces all native confirm() calls */}
      <Drawer
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
      >
        <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DrawerHeader>
            <DrawerTitle>{confirmDialog.title}</DrawerTitle>
            <p className="text-sm text-muted-foreground mt-1">{confirmDialog.description}</p>
          </DrawerHeader>
          <div className="flex flex-col gap-3 px-4 pb-6">
            <Button
              className="w-full rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                confirmDialog.onConfirm();
                setConfirmDialog((prev) => ({ ...prev, open: false }));
              }}
            >
              {t("confirm")}
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-full"
              onClick={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
            >
              {t("cancel")}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Commercial Dashboard Drawer */}
    </div>
  );
}
