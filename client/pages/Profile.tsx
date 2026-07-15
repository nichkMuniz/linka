import * as React from "react";
import {
  getUserProfileDb,
  getUserPostsDb,
  getUserStatsDb,
  getUserRoutinesDb,
  updateRoutineGoalDb,
  getFollowersDb,
  getFollowingDb,
  getFollowingStatusBatchDb,
  isFollowingDb,
  getUserShotsDb,
  getUserGoalsByUserIdDb,
  deletePostDb,
  updatePostDb,
  updateUserProfileDb,
  removePostPhotoDb,
  getPostLikeUsersDb,
  flushPendingIncentivesDb,
  getPostCommentsDb,
  getCommercialProfileDb,
  getCommercialOffersByUserIdDb,
  incrementOfferClickDb,
  type CommercialOffer,
  getUserActiveStoriesDb,
  getUserPostLikesDb,
  deleteAllUserDataDb,
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
  type PostIncentiveType,
  updateUserGoalDb,
  deleteUserGoalDb,
  invalidateQueryCache,
  invalidateProfileCache,
} from "@/lib/ritmofit-db";
import { formatTimeAgo } from "@/lib/utils";
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
import { UserAvatar } from "@/components/shared/user-avatar";
import { PostLikesModal } from "@/components/modals/post-likes-modal";
import { PostCommentsDialog } from "@/components/modals/post-comments-dialog";
import { UserInsignias } from "@/components/profile/user-insignias";
import { VerifiedBadge } from "@/components/shared/VerifiedBadge";
import { PostCarousel } from "@/components/post/post-carousel";
import { WorkoutDetailButton } from "@/components/shared/workout-detail-dialog";
import { FlowViewerModal } from "@/components/modals/flow-viewer-modal";
import { PostIncentiveButton } from "@/components/shared/post-incentive-button";
import { FollowButton } from "@/components/shared/follow-button";
import { FollowListDrawer } from "@/components/profile/follow-list-drawer";
import { SettingsDrawer } from "@/components/profile/settings-drawer";
import { ShotEditorDrawer } from "@/components/profile/shot-editor-drawer";
import { GoalDetailDrawer } from "@/components/goals/goal-detail-drawer";
import { togglePostLike } from "../services/post.service";
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
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ProfileSkeleton } from "@/components/shared/animated-loading";
import { ShareDrawer } from "@/components/shared/share-drawer";
import { ImageCropperDrawer } from "@/components/shared/image-cropper-drawer";
import { profileShareUrl } from "@/lib/share-url";
import {
  Edit2,
  ArrowLeft,
  Check,
  Tag,
  Settings,
  Trash2,
  MessageSquare,
  Share2,
  ArrowRight,
  ExternalLink,
  Phone,
  ListChecks,
  Target,
  ShieldCheck,
  ImagePlus,
  Lock,
} from "lucide-react";
import { resetSupabaseAuth, supabase } from "@/lib/supabase";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useLanguage } from "@/lib/language-context";
import { Browser } from "@capacitor/browser";
import { hapticLight } from "@/lib/haptics";

export default function Profile() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { userId } = useParams<{ userId?: string }>();
  const { t } = useLanguage();

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

  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [shareDrawerOpen, setShareDrawerOpen] = React.useState(false);
  const [shareDrawerText, setShareDrawerText] = React.useState("");
  const [shareDrawerUrl, setShareDrawerUrl] = React.useState<string | undefined>(undefined);
  const [posts, setPosts] = React.useState<PostWithUser[]>([]);
  const [shots, setShots] = React.useState<ShotWithUser[]>([]);
  const [routines, setRoutines] = React.useState<Routine[]>([]);
  const [selectedPost, setSelectedPost] = React.useState<PostWithUser | null>(null);
  const [postDescExpanded, setPostDescExpanded] = React.useState(false);
  const [isPostViewerOpen, setIsPostViewerOpen] = React.useState(false);
  const [isEditingPost, setIsEditingPost] = React.useState(false);
  const [editPostDescription, setEditPostDescription] = React.useState("");
  const [editPostGoalId, setEditPostGoalId] = React.useState<string>("");
  const [isUpdatingPost, setIsUpdatingPost] = React.useState(false);
  const [removingPhoto, setRemovingPhoto] = React.useState(false);
  const [postLikes, setPostLikes] = React.useState<any[]>([]);
  const [postCommentCount, setPostCommentCount] = React.useState(0);
  const [postUserLikes, setPostUserLikes] = React.useState<PostIncentiveType[]>([]);
  const postUserLikesRef = React.useRef<PostIncentiveType[]>([]);
  // Sequência da sincronização de incentivos — descarta respostas fora de ordem
  const incentiveSyncSeqRef = React.useRef(0);
  const [isLoadingPostData, setIsLoadingPostData] = React.useState(false);
  const [isLikesModalOpen, setIsLikesModalOpen] = React.useState(false);
  const [selectedShot, setSelectedShot] = React.useState<ShotWithUser | null>(null);
  const [isShotEditorOpen, setIsShotEditorOpen] = React.useState(false);
  const [stats, setStats] = React.useState<UserStats>({
    postsCount: 0,
    followersCount: 0,
    followingCount: 0,
    points: 0,
    level: 1,
  });
  const [loading, setLoading] = React.useState(true);
  const [profileError, setProfileError] = React.useState(false);
  // Batch 2 concluído — evita mostrar "(0)" nas tabs antes dos dados chegarem
  const [tabsDataLoaded, setTabsDataLoaded] = React.useState(false);
  const [userGoals, setUserGoals] = React.useState<UserGoal[]>([]);
  const [profileStories, setProfileStories] = React.useState<StoryWithUser[]>([]);
  const [isStoryViewerOpen, setIsStoryViewerOpen] = React.useState(false);
  const [selectedProfileStory, setSelectedProfileStory] = React.useState<StoryWithUser | null>(null);
  const [showFollowersModal, setShowFollowersModal] = React.useState(false);
  const [showFollowingModal, setShowFollowingModal] = React.useState(false);
  // Indica se o usuário logado segue o dono do perfil (para regras de privacidade)
  const [viewerFollowsProfile, setViewerFollowsProfile] = React.useState(false);
  const [followers, setFollowers] = React.useState<any[]>([]);
  const [following, setFollowing] = React.useState<any[]>([]);
  const [isLoadingFollowers, setIsLoadingFollowers] = React.useState(false);
  const [followerFollowStatus, setFollowerFollowStatus] = React.useState<Record<string, boolean>>({});
  const [followingFollowStatus, setFollowingFollowStatus] = React.useState<Record<string, boolean>>({});

  // Goal detail drawer state
  const [selectedGoalForDrawer, setSelectedGoalForDrawer] = React.useState<UserGoal | null>(null);

  // Edit form state

  const [profileOffers, setProfileOffers] = React.useState<CommercialOffer[]>([]);

  // Commercial profile state
  const [isPlansModalOpen, setIsPlansModalOpen] = React.useState(false);
  const [commercialProfile, setCommercialProfile] = React.useState<CommercialProfile | null>(null);
  const [servicePlans, setServicePlans] = React.useState<ServicePlan[]>([]);

  // Settings drawer (controlled externally so the trigger can be styled per design)
  const [settingsOpen, setSettingsOpen] = React.useState(false);
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
  const [coverCropSrc, setCoverCropSrc] = React.useState<string | null>(null);
  const [isSavingCover, setIsSavingCover] = React.useState(false);

  // Delete account state (UI trigger not yet implemented)
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("");

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
      setRoutines([]);
      setTabsDataLoaded(false);
      setLoading(true);
    }

    try {
      // Batch 1 — critical above-the-fold data: show immediately
      const [profileData, statsData, postsData] = await Promise.all([
        getUserProfileDb(profileUserId),
        getUserStatsDb(profileUserId),
        getUserPostsDb(profileUserId),
      ]);
      if (isStale()) return;
      setProfile(profileData);
      setStats(statsData);
      setPosts(postsData);
      setLoading(false); // unblock UI as soon as critical data arrives
    } catch (err: any) {
      if (isStale()) return;
      console.error("Error loading profile:", err);
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
      ] = await Promise.all([
        getUserRoutinesDb(profileUserId),
        getUserGoalsByUserIdDb(profileUserId),
        getUserShotsDb(profileUserId),
        getCommercialProfileDb(profileUserId),
        getCommercialOffersByUserIdDb(profileUserId),
        getCommercialPlansDb(profileUserId),
      ]);
      if (isStale()) return;
      setRoutines(routinesData);
      setUserGoals(isViewingOtherProfile ? userGoalsData.filter((g) => g.visibility === 1) : userGoalsData);
      setShots(shotsData);
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

    // Batch 3 — stories: fire-and-forget
    getUserActiveStoriesDb(profileUserId)
      .then((stories) => { if (!isStale()) setProfileStories(stories); })
      .catch((err) => console.error("Erro ao carregar stories do perfil:", err));

    // Status de seguimento do visitante (usado nas regras de privacidade)
    if (isViewingOtherProfile) {
      isFollowingDb(profileUserId)
        .then((follows) => { if (!isStale()) setViewerFollowsProfile(follows); })
        .catch(() => { if (!isStale()) setViewerFollowsProfile(false); });
    } else {
      setViewerFollowsProfile(false);
    }
  }, [profileUserId, isViewingOtherProfile]);

  // Pull-to-refresh handlers (declared after loadProfile to avoid forward reference).
  // Atualizam o indicador direto no DOM — nenhum re-render React durante o gesto.
  const onTouchStart = React.useCallback((e: React.TouchEvent) => {
    if (window.scrollY > 0) return;
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
        invalidateQueryCache(`commercialProfile:${profileUserId}`);
        invalidateQueryCache(`userActiveStories:${profileUserId}`);
        if (user?.id) invalidateQueryCache(`isFollowing:${user.id}:${profileUserId}`);
      }
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

  const handleViewPost = React.useCallback(async (post: PostWithUser) => {
    setSelectedPost(post);
    setPostDescExpanded(false);
    setEditPostDescription(post.description);
    setEditPostGoalId(post.user_goal_id || "");
    setIsPostViewerOpen(true);
    setIsEditingPost(false);
    setIsLoadingPostData(true);

    try {
      await flushPendingIncentivesDb(post.id);
      const [likes, comments, userLikes] = await Promise.all([
        getPostLikeUsersDb(post.id),
        getPostCommentsDb(post.id),
        getUserPostLikesDb(post.id),
      ]);
      setPostLikes(likes);
      setPostCommentCount(comments.length);
      setPostUserLikes(userLikes);
    } catch (err) {
      console.error("Error loading post data:", err);
      toast({ title: t("profile_toast_post_data_error"), description: t("retry"), variant: "destructive" });
    } finally {
      setIsLoadingPostData(false);
    }
  }, []);

  const handleUpdatePost = React.useCallback(async () => {
    if (!selectedPost) return;

    setIsUpdatingPost(true);
    try {
      await updatePostDb(selectedPost.id, editPostDescription, editPostGoalId || null);

      // Update local posts list
      setPosts((prevPosts) =>
        prevPosts.map((p) =>
          p.id === selectedPost.id
            ? { ...p, description: editPostDescription, user_goal_id: editPostGoalId || null }
            : p,
        ),
      );
      // O drawer volta ao modo visualização lendo selectedPost — sem isso a
      // descrição/meta antigas continuavam na tela até fechar e reabrir o post
      setSelectedPost((prev) =>
        prev && prev.id === selectedPost.id
          ? { ...prev, description: editPostDescription, user_goal_id: editPostGoalId || null }
          : prev,
      );

      setIsEditingPost(false);
      toast({
        title: t("newpost_success"),
        description: t("profile_toast_post_updated"),
      });
    } catch (err: any) {
      console.error("Error updating post:", err);
      toast({
        title: t("profile_toast_post_update_error"),
        description: err?.message || t("retry"),
        variant: "destructive",
      });
    } finally {
      setIsUpdatingPost(false);
    }
  }, [selectedPost, editPostDescription, editPostGoalId]);

  const handleRemoveCarouselPhoto = React.useCallback(async (photoUrl: string) => {
    if (!selectedPost) return;
    setRemovingPhoto(true);
    try {
      const updatedPhotos = await removePostPhotoDb(selectedPost.id, photoUrl);
      const updatedPost = { ...selectedPost, photos: updatedPhotos };
      setSelectedPost(updatedPost);
      setPosts((prev) => prev.map((p) => p.id === selectedPost.id ? updatedPost : p));
      toast({ title: t("profile_toast_photo_removed") });
    } catch (err: any) {
      toast({ title: t("profile_toast_photo_remove_error"), description: err?.message, variant: "destructive" });
    } finally {
      setRemovingPhoto(false);
    }
  }, [selectedPost]);

  // Keep ref always in sync so handleTogglePostIncentive can read current value without closure staleness
  React.useEffect(() => { postUserLikesRef.current = postUserLikes; }, [postUserLikes]);

  const handleTogglePostIncentive = React.useCallback((type: PostIncentiveType) => {
    if (!selectedPost) return;
    const previousLikes = postUserLikesRef.current;
    const wasActive = previousLikes.includes(type);
    // Otimista e não-bloqueante: a UI responde na hora e os botões continuam
    // liberados; a escrita (debounced) e o refetch do contador rodam em
    // segundo plano, com guard de sequência contra respostas fora de ordem.
    setPostUserLikes(wasActive ? previousLikes.filter((t) => t !== type) : [...previousLikes, type]);
    togglePostLike(selectedPost.id, type, !wasActive);
    const seq = ++incentiveSyncSeqRef.current;
    (async () => {
      try {
        await flushPendingIncentivesDb(selectedPost.id);
        const updatedLikes = await getPostLikeUsersDb(selectedPost.id);
        if (seq === incentiveSyncSeqRef.current) setPostLikes(updatedLikes);
      } catch {
        if (seq !== incentiveSyncSeqRef.current) return;
        setPostUserLikes(previousLikes);
        toast({ title: t("profile_toast_incentive_error"), description: t("retry"), variant: "destructive" });
      }
    })();
  }, [selectedPost]);

  const handleDeletePost = React.useCallback(() => {
    if (!selectedPost) return;
    showConfirm(
      t("post_delete_title"),
      t("post_delete_desc"),
      async () => {
        setIsUpdatingPost(true);
        try {
          await deletePostDb(selectedPost.id);
          setPosts((prevPosts) => prevPosts.filter((p) => p.id !== selectedPost.id));
          // Reflete no card de stats e no rótulo da tab sem esperar o cache expirar
          setStats((prev) => ({ ...prev, postsCount: Math.max(0, prev.postsCount - 1) }));
          setIsPostViewerOpen(false);
          setSelectedPost(null);
          toast({ title: t("newpost_success"), description: t("post_deleted_success") });
        } catch (err: any) {
          console.error("Error deleting post:", err);
          toast({ title: t("post_delete_error"), description: err?.message || t("retry"), variant: "destructive" });
        } finally {
          setIsUpdatingPost(false);
        }
      }
    );
  }, [selectedPost, showConfirm]);


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
  }, [profileUserId]);



  React.useEffect(() => {
    loadProfile();
  }, [profileUserId, loadProfile]);

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

    setIsPostViewerOpen(false);
    setSelectedPost(null);
    setIsEditingPost(false);
    setIsLikesModalOpen(false);
    setSelectedShot(null);
    setIsShotEditorOpen(false);
    setIsStoryViewerOpen(false);
    setSelectedProfileStory(null);
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

  const handleProfileToggleRoutineLink = async (routineId: string, goalId: string | null) => {
    await updateRoutineGoalDb(routineId, goalId);
    const [updatedRoutines, updatedGoals] = await Promise.all([
      getUserRoutinesDb(profileUserId!),
      getUserGoalsByUserIdDb(profileUserId!),
    ]);
    setRoutines(updatedRoutines);
    setUserGoals(updatedGoals);
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (deleteConfirmText !== t("profile_close_account_confirm_word")) {
      toast({
        title: t("profile_toast_delete_confirm_error"),
        description: t("profile_toast_delete_confirm_error_desc"),
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    try {
      // Delete all user data across every table, then sign out
      await deleteAllUserDataDb(user.id);
      await resetSupabaseAuth();

      setIsDeleteAccountOpen(false);
      setDeleteConfirmText("");

      toast({
        title: t("profile_toast_account_deleted"),
        description: t("profile_toast_account_deleted_desc"),
      });

      // Redirect to login after a short delay
      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (err: any) {
      console.error("Error deleting account:", err);
      toast({
        title: t("profile_toast_account_delete_error"),
        description: err?.message || t("retry"),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCoverCropSrc(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = ""; // allow re-selecting the same file
  };

  const handleCoverCropConfirm = async (_dataUrl: string, blob: Blob) => {
    setCoverCropSrc(null);
    if (!user || !supabase) return;
    setIsSavingCover(true);
    try {
      const filePath = `covers/${user.id}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("posts")
        .upload(filePath, blob, { contentType: "image/jpeg" });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("posts").getPublicUrl(filePath);
      const updated = await updateUserProfileDb(user.id, { cover_photo: publicUrl });
      if (updated) setProfile(updated);
      toast({ title: t("profile_cover_updated") });
    } catch (err: any) {
      console.error("Error updating cover photo:", err);
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

      {/* Profile Header with banner */}
      <div className="relative">
        {/* Banner — user cover photo when set, gradient otherwise */}
        {profile.cover_photo ? (
          <div
            aria-hidden
            className="absolute top-0 left-0 right-0 overflow-hidden pointer-events-none"
            style={{ height: "210px" }}
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
            style={{ height: "210px", background: "radial-gradient(120% 100% at 60% 0%,#d8567a,#7b3ff2 55%,#1a1438 90%)" }}
          />
        )}
        <div
          aria-hidden
          className="absolute top-0 left-0 right-0 pointer-events-none"
          style={{ height: "270px", background: "linear-gradient(to bottom,transparent 30%,#06070c 100%)" }}
        />

        {/* Cover photo controls — own profile only */}
        {!isViewingOtherProfile && (
          <div className="absolute z-30 flex gap-2" style={{ top: "8px", right: "12px" }}>
            {profile.cover_photo && (
              <button
                onClick={handleRemoveCover}
                disabled={isSavingCover}
                aria-label={t("profile_remove_cover")}
                className="flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
                style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,.3)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,.18)", color: "#fff" }}
              >
                <Trash2 className="h-[18px] w-[18px]" />
              </button>
            )}
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
          </div>
        )}

        {/* Hidden file input + cropper for the cover photo */}
        <input
          ref={coverFileInputRef}
          type="file"
          accept="image/*"
          onChange={handleCoverFileChange}
          className="hidden"
        />
        <ImageCropperDrawer
          imageSrc={coverCropSrc}
          aspectRatio={16 / 9}
          onConfirm={handleCoverCropConfirm}
          onCancel={() => setCoverCropSrc(null)}
        />

        {/* Back chip — only when viewing another user's profile */}
        {isViewingOtherProfile && (
          <button
            onClick={() => navigate(-1)}
            aria-label={t("goals_back")}
            className="absolute z-30 flex items-center justify-center active:scale-95 transition-transform"
            style={{ top: "8px", left: "12px", width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,.3)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,.18)", color: "#fff" }}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}

        <div className="relative px-4" style={{ paddingTop: "80px" }}>
          {/* Avatar + actions row */}
          <div className="flex items-end justify-between mb-3.5">
            {/* Avatar with conic ring */}
            {(() => {
              const ring = (
                <div style={{ width: 88, height: 88, borderRadius: "50%", padding: "3px", background: "conic-gradient(from 200deg,#ff8a2a,#d8567a,#7b3ff2,#3a8dff,#ff8a2a)" }}>
                  <div className="w-full h-full rounded-full overflow-hidden" style={{ border: "3px solid #06070c" }}>
                    <UserAvatar photo={profile.photo} nickname={profile.nickname} size="2xl" quality={90} className="!h-full !w-full" />
                  </div>
                </div>
              );
              return profileStories.length > 0 ? (
                <button
                  onClick={() => { setSelectedProfileStory(profileStories[0]); setIsStoryViewerOpen(true); }}
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
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => setSettingsOpen(true)}
                  aria-label={t("settings_title")}
                  className="flex items-center justify-center active:scale-95 transition-transform"
                  style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }}
                >
                  <Settings className="h-[19px] w-[19px]" />
                </button>
                <button
                  onClick={() => { setSettingsOpenToProfile(true); setSettingsOpen(true); }}
                  className="active:scale-95 transition-transform"
                  style={{ height: 42, padding: "0 18px", borderRadius: "21px", display: "flex", alignItems: "center", fontSize: "13.5px", fontWeight: 640, color: "#0a0b12", background: "linear-gradient(rgba(255,255,255,.95),rgba(255,255,255,.82))" }}
                >
                  {t("profile_edit_btn")}
                </button>
              </div>
            ) : (
              <div className="flex gap-2 items-center">
                <FollowButton
                  targetUserId={profileUserId!}
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
                    setShareDrawerOpen(true);
                  }}
                  aria-label={t("profile_share")}
                  className="flex items-center justify-center active:scale-95 transition-transform"
                  style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }}
                >
                  <Share2 className="h-[18px] w-[18px]" />
                </button>
              </div>
            )}
          </div>

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
            {profile.is_verified && <VerifiedBadge size="md" />}
            <UserInsignias userId={profileUserId || ""} showStreak />
          </div>

          {/* Botão Admin — visível apenas para o próprio usuário verificado */}
          {!isViewingOtherProfile && profile.is_verified && (
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

              {/* Commercial Profile Info */}
              {commercialProfile && (
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
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4">
            {userGoals.map((goal) => (
              <button
                key={goal.id}
                onClick={() => setSelectedGoalForDrawer(goal)}
                className="flex-shrink-0 w-44 rounded-xl p-3 space-y-2 text-left active:scale-95 transition-transform"
                style={{
                  background: "linear-gradient(rgba(255,255,255,.09),rgba(255,255,255,.03))",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  border: "1px solid rgba(255,255,255,.10)",
                }}
              >
                <p className="text-xs font-medium leading-snug line-clamp-2">
                  {goal.description}
                </p>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{t("goals_progress")}</span>
                    <span className="text-xs font-semibold text-brand">{goal.perc}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand transition-all"
                      style={{ width: `${Math.min(goal.perc, 100)}%` }}
                    />
                  </div>
                </div>
              </button>
            ))}
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
      />

      {/* Posts, Shots and Store Tabs */}
      <Tabs defaultValue="posts" className="w-full px-4">
        <TabsList className="w-full justify-start gap-7 !h-auto !bg-transparent !rounded-none !p-0 border-b border-white/10">
          <TabsTrigger
            value="posts"
            className="!rounded-none !bg-transparent !shadow-none !px-0 pb-3 -mb-px border-b-2 border-transparent !text-white/45 data-[state=active]:!border-white data-[state=active]:!text-white text-[14px] font-[640]"
          >
            {t("profile_posts")} ({stats.postsCount})
          </TabsTrigger>
          <TabsTrigger
            value="shots"
            className="!rounded-none !bg-transparent !shadow-none !px-0 pb-3 -mb-px border-b-2 border-transparent !text-white/45 data-[state=active]:!border-white data-[state=active]:!text-white text-[14px] font-[640]"
          >
            {t("nav_clips")}{tabsDataLoaded ? ` (${shots.length})` : ""}
          </TabsTrigger>
          {profileOffers.length > 0 && (
            <TabsTrigger
              value="vitrine"
              className="!rounded-none !bg-transparent !shadow-none !px-0 pb-3 -mb-px border-b-2 border-transparent !text-white/45 data-[state=active]:!border-white data-[state=active]:!text-white text-[14px] font-[640]"
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
          ) : posts.length > 0 ? (
            <div className="grid gap-[5px] grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {posts.map((post) => (
                <button
                  key={post.id}
                  onClick={() => handleViewPost(post)}
                  className="group relative aspect-square overflow-hidden rounded-[14px] bg-muted transition-all cursor-pointer"
                >
                  <img
                    src={post.photo}
                    alt={post.description}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover group-hover:scale-110 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  {/* Multi-photo indicator */}
                  {post.photos && post.photos.length > 1 && (
                    <div className="absolute top-2 right-2 bg-white/90 rounded-md px-1.5 py-0.5 flex items-center gap-0.5">
                      <span className="text-xs font-semibold text-black">📷</span>
                      <span className="text-xs font-semibold text-black">{post.photos.length}</span>
                    </div>
                  )}
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

        {/* Shots Tab */}
        <TabsContent value="shots" className="space-y-4">
          {shots.length > 0 ? (
            <div className="grid gap-[5px] grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {shots.map((shot) => (
                <div
                  key={shot.id}
                  className="group relative aspect-square overflow-hidden rounded-[14px] bg-black transition-all"
                >
                  <button
                    onClick={() => navigate(`/shots`, { state: { shotId: shot.id } })}
                    className="w-full h-full cursor-pointer"
                  >
                    <video
                      src={shot.video_url}
                      playsInline
                      muted
                      preload="metadata"
                      className="h-full w-full object-cover group-hover:scale-110 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
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

      {/* Post Viewer Drawer */}
      <Drawer
        open={isPostViewerOpen}
        onOpenChange={(open) => {
          if (!open && isEditingPost && editPostDescription !== (selectedPost?.description ?? "")) {
            showConfirm(
              t("profile_discard_title"),
              t("profile_discard_desc"),
              () => { setIsPostViewerOpen(false); setIsEditingPost(false); }
            );
          } else {
            setIsPostViewerOpen(open);
          }
        }}
      >
        <DrawerContent
          handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
          className="max-h-[95dvh] flex flex-col modal-enter !rounded-t-[32px] !border-0"
          style={{
            background: "linear-gradient(rgba(20,18,30,.96),rgba(10,9,18,.98))",
            backdropFilter: "blur(40px) saturate(180%)",
            WebkitBackdropFilter: "blur(40px) saturate(180%)",
            borderTop: "1px solid rgba(255,255,255,.14)",
          }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* Header compacto com autor inline */}
          <DrawerHeader className="shrink-0 pb-2">
            <div className="flex items-center justify-between">
              <DrawerTitle className="text-base" style={{ color: "#fff" }}>
                {isEditingPost ? t("profile_edit_post") : t("profile_post_label")}
              </DrawerTitle>
              {selectedPost && (
                <div className="flex items-center gap-2">
                  <UserAvatar
                    photo={selectedPost.userPhoto}
                    nickname={selectedPost.userNickname}
                    size="sm"
                    className="h-7 w-7 ring-1 ring-white/15"
                  />
                  <span className="text-sm font-medium" style={{ color: "#fff" }}>{selectedPost.userNickname}</span>
                  <UserInsignias userId={selectedPost.user_id} />
                </div>
              )}
            </div>
          </DrawerHeader>

          {selectedPost && (
            <>
              <div className="flex-1 overflow-y-auto">
                <div className="md:flex md:gap-0 md:h-full">
                  {/* Imagem */}
                  <div className="md:w-[55%] md:shrink-0 md:sticky md:top-0">
                    {selectedPost.photos && selectedPost.photos.length > 0 ? (
                      <div className="md:h-full">
                        <PostCarousel
                          photos={selectedPost.photos}
                          alt={selectedPost.description}
                          editMode={isEditingPost}
                          onRemovePhoto={handleRemoveCarouselPhoto}
                          removingPhoto={removingPhoto}
                          objectFit="contain"
                        />
                      </div>
                    ) : (
                      <div className="w-full bg-black overflow-hidden">
                        <img
                          src={selectedPost.photo}
                          alt={selectedPost.description}
                          className="w-full h-auto block"
                        />
                      </div>
                    )}
                  </div>

                  {/* Conteúdo */}
                  <div className="md:flex-1 md:overflow-y-auto px-4 pb-4 pt-3 space-y-3">
                    {/* Description */}
                    {isEditingPost ? (
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium" style={{ color: "#fff" }}>{t("profile_description_label")}</label>
                        <Textarea
                          value={editPostDescription}
                          onChange={(e) => setEditPostDescription(e.target.value)}
                          className="resize-none"
                          rows={3}
                          style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }}
                        />
                      </div>
                    ) : (
                      (() => {
                        const desc = selectedPost.description ?? "";
                        const DESC_MAX = 30;
                        const firstLine = desc.split("\n")[0] ?? "";
                        const truncatable = desc.includes("\n") || desc.length > DESC_MAX;
                        const truncated = firstLine.length > DESC_MAX
                          ? firstLine.slice(0, DESC_MAX).trimEnd()
                          : firstLine;
                        return (
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm leading-relaxed whitespace-pre-wrap flex-1 min-w-0" style={{ color: "rgba(255,255,255,.85)" }}>
                              {!truncatable || postDescExpanded ? (
                                <>
                                  {desc}
                                  {truncatable && postDescExpanded && (
                                    <>
                                      {" "}
                                      <button
                                        type="button"
                                        onClick={() => setPostDescExpanded(false)}
                                        style={{ color: "rgba(255,255,255,.45)" }}
                                      >
                                        {t("feed_description_less")}
                                      </button>
                                    </>
                                  )}
                                </>
                              ) : (
                                <>
                                  {truncated}
                                  {"... "}
                                  <button
                                    type="button"
                                    onClick={() => setPostDescExpanded(true)}
                                    style={{ color: "rgba(255,255,255,.45)" }}
                                  >
                                    {t("feed_description_more")}
                                  </button>
                                </>
                              )}
                            </p>
                            <span className="text-xs font-mono shrink-0" style={{ color: "rgba(255,255,255,.35)" }}>
                              {formatTimeAgo(selectedPost.created_at)}
                            </span>
                          </div>
                        );
                      })()
                    )}

                    {/* Workout summary — "Ver treino" pill opens the detail modal */}
                    {!isEditingPost && selectedPost.workoutSummary && (
                      <WorkoutDetailButton summary={selectedPost.workoutSummary} />
                    )}

                    {/* Goal */}
                    {isEditingPost ? (
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium" style={{ color: "#fff" }}>{t("profile_linked_goal_label")}</label>
                        {userGoals.length > 0 ? (
                          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,.12)" }}>
                            {userGoals.map((goal, idx) => {
                              const selected = editPostGoalId === goal.id;
                              return (
                                <button
                                  key={goal.id}
                                  type="button"
                                  onClick={() => setEditPostGoalId(selected ? "" : goal.id)}
                                  className="w-full text-left px-3 py-2.5 text-sm flex items-center justify-between gap-2 transition-colors active:scale-[0.99]"
                                  style={{
                                    background: selected ? "rgba(91,140,255,.18)" : "rgba(255,255,255,.05)",
                                    color: selected ? "#fff" : "rgba(255,255,255,.7)",
                                    borderTop: idx > 0 ? "1px solid rgba(255,255,255,.07)" : undefined,
                                  }}
                                >
                                  <span className="truncate">{goal.description}</span>
                                  {selected && <Check className="h-4 w-4 shrink-0 text-brand" />}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm" style={{ color: "rgba(255,255,255,.5)" }}>{t("profile_no_goals_created")}</p>
                        )}
                      </div>
                    ) : selectedPost.user_goal_id ? (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
                        <span className="text-xs" style={{ color: "rgba(255,255,255,.45)" }}>{t("profile_goal_label")}</span>
                        <span className="text-xs font-medium truncate" style={{ color: "#fff" }}>
                          {userGoals.find((g) => g.id === selectedPost.user_goal_id)?.description || t("profile_goal_removed_label")}
                        </span>
                      </div>
                    ) : null}

                    {/* Incentives + Comments */}
                    {isLoadingPostData && !isEditingPost && (
                      <div className="flex items-center gap-2 pt-1">
                        {[...Array(6)].map((_, i) => (
                          <div key={i} className="h-8 w-12 rounded-full animate-pulse" style={{ background: "rgba(255,255,255,.08)" }} />
                        ))}
                      </div>
                    )}
                    {!isLoadingPostData && !isEditingPost && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center gap-1 flex-wrap">
                          {([1, 2, 3, 4, 5, 6] as PostIncentiveType[]).map((type) => (
                            <PostIncentiveButton
                              key={type}
                              type={type}
                              isActive={postUserLikes.includes(type)}
                              onClick={() => handleTogglePostIncentive(type)}
                            />
                          ))}
                          {!isEditingPost && selectedPost && (
                            <div className="ml-auto">
                              <PostCommentsDialog
                                postId={selectedPost.id}
                                commentCount={postCommentCount}
                                onCountChange={setPostCommentCount}
                                isPostOwner={!isViewingOtherProfile}
                              />
                            </div>
                          )}
                        </div>
                        {postLikes.length > 0 && (
                          <button
                            onClick={() => setIsLikesModalOpen(true)}
                            className="text-xs font-semibold px-1 transition-colors"
                            style={{ color: "rgba(255,255,255,.7)" }}
                          >
                            {t("profile_incentives_label").replace("{n}", String(postLikes.length))}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    {!isViewingOtherProfile && (
                      <div className="flex gap-2 pt-2" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
                        {!isEditingPost ? (
                          <>
                            <Button
                              className="flex-1 rounded-full gap-2"
                              style={{ background: "rgba(255,255,255,.09)", color: "rgba(255,255,255,.8)", border: "1px solid rgba(255,255,255,.12)" }}
                              onClick={() => setIsEditingPost(true)}
                            >
                              <Edit2 className="h-4 w-4" />
                              {t("edit")}
                            </Button>
                            <Button
                              variant="destructive"
                              className="flex-1 rounded-full gap-2"
                              onClick={handleDeletePost}
                              disabled={isUpdatingPost}
                            >
                              <Trash2 className="h-4 w-4" />
                              {t("delete")}
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              className="flex-1 rounded-full"
                              style={{ background: "rgba(255,255,255,.09)", color: "rgba(255,255,255,.7)", border: "1px solid rgba(255,255,255,.12)" }}
                              onClick={() => setIsEditingPost(false)}
                              disabled={isUpdatingPost}
                            >
                              {t("cancel")}
                            </Button>
                            <Button
                              className="flex-1 rounded-full"
                              style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
                              onClick={handleUpdatePost}
                              disabled={isUpdatingPost}
                            >
                              {isUpdatingPost ? t("saving") : t("save")}
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>

      {/* Post Likes Modal */}
      <PostLikesModal
        open={isLikesModalOpen}
        onOpenChange={setIsLikesModalOpen}
        likes={postLikes}
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
        title={t("profile_share_title")}
      />

      {/* Flow Viewer Modal */}
      <FlowViewerModal
        story={selectedProfileStory}
        stories={profileStories}
        open={isStoryViewerOpen}
        onOpenChange={(open) => {
          setIsStoryViewerOpen(open);
          if (!open) setSelectedProfileStory(null);
        }}
        onNextStory={() => {
          if (!selectedProfileStory) return;
          const idx = profileStories.findIndex((s) => s.id === selectedProfileStory.id);
          if (idx < profileStories.length - 1) {
            setSelectedProfileStory(profileStories[idx + 1]);
          } else {
            setIsStoryViewerOpen(false);
          }
        }}
        onPrevStory={() => {
          if (!selectedProfileStory) return;
          const idx = profileStories.findIndex((s) => s.id === selectedProfileStory.id);
          if (idx > 0) setSelectedProfileStory(profileStories[idx - 1]);
        }}
        onSelectStory={setSelectedProfileStory}
      />

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={isDeleteAccountOpen} onOpenChange={(open) => { setIsDeleteAccountOpen(open); if (!open) setDeleteConfirmText(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">{t("profile_close_account_title")}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">{t("profile_close_account_desc1")}</span>
              <span className="block">{t("profile_close_account_desc2")}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            type="text"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder={t("profile_close_account_placeholder")}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-destructive focus:outline-none bg-background"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteAccount}
              disabled={isDeleting || deleteConfirmText !== t("profile_close_account_confirm_word")}
            >
              {isDeleting ? t("profile_deleting") : t("profile_close_account_action")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
