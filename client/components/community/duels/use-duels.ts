import * as React from "react";
import {
  getDuelGroupDb,
  getGroupCheckInsDb,
  getGroupCheckInDetailDb,
  getEnrichedDuelGroupsDb,
  getGroupParticipantsDb,
  getPendingGroupRequestsDb,
  getCheckInCommentsDb,
  addCheckInCommentDb,
  deleteCheckInCommentDb,
  updateCheckInCommentDb,
  getCheckInReactionsDb,
  type CheckInReactionWithUser,
  getCheckInVotesDb,
  invalidateQueryCache,
  type GroupCheckIn,
  type CompletedRoutine,
  type GroupJoinRequest,
  type CheckInComment,
  type CheckInReaction,
  type DuelCheckInVote,
} from "@/lib/ritmofit-db";
import { useAuth } from "@/hooks/useAuth";
import { hapticLight } from "@/lib/haptics";
import { toast } from "@/components/ui/use-toast";
import {
  DEFAULT_TRANSFORM,
  type CropTransform,
} from "@/components/shared/inline-crop-preview";
import { POST_PHOTO_WIDTH, POST_PHOTO_QUALITY } from "@/components/post/post-carousel";
import { cdnImg } from "@/lib/image-url";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { usePremium } from "@/lib/premium-context";
import { useLanguage } from "@/lib/language-context";
import { type PendingInvite } from "@/components/community/requests-tab";

import { toGroupCard, CHECKINS_INITIAL_COUNT, CHECKINS_PAGE_SIZE, CHECKINS_LOAD_MORE_OFFSET } from "./duels-constants";

interface UseDuelsOptions {
  /** Aba ativa da Comunidade — o carregamento das solicitações depende dela. */
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

/**
 * Estado e comportamento da aba **Duelos**: grupos criados e disponíveis, vista
 * do grupo, check-ins (com fotos, votos, comentários e reações), participantes,
 * convites e solicitações de entrada.
 *
 * É o maior domínio da Comunidade. Vive aqui inteiro para que a tela
 * (`Community.tsx`) fique só com a casca — abas, carga compartilhada e roteamento.
 *
 * As listas de convites/solicitações moram aqui, e não na aba Solicitações,
 * porque quem as carrega é o `loadGroupsAndRequests` deste domínio e o contador
 * do ícone da aba depende delas.
 */
export function useDuels({ activeTab, setActiveTab }: UseDuelsOptions) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { isPremium } = usePremium();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Group creation state
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = React.useState(false);
  const [groupStep, setGroupStep] = React.useState<1 | 2 | 3 | 4 | 5>(1);
  const [isCreatingGroup, setIsCreatingGroup] = React.useState(false);
  const [groupConfig, setGroupConfig] = React.useState({
    name: "",
    location: "",
    goal: "",
    durationDays: "",
    photo: "",
    scoringType: "check_in_count" as import("@/lib/ritmofit-db").DuelScoringType,
    memeRule: "",
  });
  const [checkInMetricValue, setCheckInMetricValue] = React.useState("");
  const [checkInVotes, setCheckInVotes] = React.useState<DuelCheckInVote[]>([]);
  // Participante escolhido nas Classificações → abre o calendário de check-ins.
  const [selectedMemberForCheckIns, setSelectedMemberForCheckIns] = React.useState<
    { userId: string; userName: string; userPhoto: string | null } | null
  >(null);
  const [groupPhotoFile, setGroupPhotoFile] = React.useState<File | null>(null);
  const editCoverInputRef = React.useRef<HTMLInputElement>(null);

  // ── Enquadramento da capa (zoom/pan direto no frame) ──────────────────────
  // Wizard: ajusta antes de criar; o recorte é aplicado no upload.
  const [groupCoverTransform, setGroupCoverTransform] = React.useState<CropTransform>(DEFAULT_TRANSFORM);
  const groupCoverWRef = React.useRef(0);
  const groupCoverHRef = React.useRef(0);

  // Hero do grupo já criado: escolher a foto entra em modo de ajuste com
  // Salvar/Cancelar — o upload só acontece ao confirmar.
  const [coverCropSrc, setCoverCropSrc] = React.useState<string | null>(null);
  const [coverCropTransform, setCoverCropTransform] = React.useState<CropTransform>(DEFAULT_TRANSFORM);
  const coverCropWRef = React.useRef(0);
  const coverCropHRef = React.useRef(0);
  const [isSavingCover, setIsSavingCover] = React.useState(false);
  const [selectedInvitees, setSelectedInvitees] = React.useState<Set<string>>(new Set());
  const [userCreatedGroups, setUserCreatedGroups] = React.useState<any[]>([]);
  const [availableGroups, setAvailableGroups] = React.useState<any[]>([]);

  // ── Gate premium: grátis cria 1 duelo ativo por vez ────────────────────────
  // `userCreatedGroups` (myGroups) inclui grupos onde o usuário só participa —
  // conta apenas os criados por ele e ainda não expirados. Participar é livre.
  const [duelPaywallOpen, setDuelPaywallOpen] = React.useState(false);
  const activeCreatedDuels = React.useMemo(
    () =>
      userCreatedGroups.filter(
        (g) =>
          g.createdBy === user?.id &&
          (!g.endDate || new Date(g.endDate) > new Date()),
      ).length,
    [userCreatedGroups, user?.id],
  );
  const duelGateBlocked = !isPremium && activeCreatedDuels >= 1;
  const [joinedGroupIds, setJoinedGroupIds] = React.useState<Set<string>>(new Set());
  const [joiningGroupId, setJoiningGroupId] = React.useState<string | null>(null);
  const [selectedGroupForView, setSelectedGroupForView] = React.useState<any>(null);

  React.useEffect(() => {
    if (selectedGroupForView) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [selectedGroupForView]);

  const [groupCheckIns, setGroupCheckIns] = React.useState<GroupCheckIn[]>([]);
  const [groupParticipants, setGroupParticipants] = React.useState<Array<{ userId: string; userNickname: string; userPhoto: string | null }>>([]);

  // Histórico do grupo: o banco devolve todos os check-ins (placar e calendário
  // dependem do conjunto inteiro), mas renderizar centenas de cartões trava a
  // rolagem no WebView. Então revela aos poucos, conforme o usuário desce.
  const [visibleCheckInCount, setVisibleCheckInCount] = React.useState(CHECKINS_INITIAL_COUNT);

  const selectedMemberCheckIns = React.useMemo(
    () => selectedMemberForCheckIns
      ? groupCheckIns.filter((c) => c.userId === selectedMemberForCheckIns.userId)
      : [],
    [groupCheckIns, selectedMemberForCheckIns],
  );

  // Warms the Supabase image-transform cache for the check-in detail photo
  // as soon as the list loads, instead of only starting that request when the
  // user taps a check-in. The detail drawer requests this exact same
  // transformed URL (same width/quality — see `priority` PostCarousel usage
  // below), so by the time someone taps in it's often already cached at the
  // CDN edge, avoiding the cold-transform latency that made photos feel slow
  // to appear.
  const prefetchedCheckInPhotosRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    // Cap + low priority so this background warm-up never competes with the
    // list's own thumbnails (or anything else) for bandwidth/connections —
    // it's a nice-to-have head start, not something worth stalling on.
    groupCheckIns.slice(0, 15).forEach((c) => {
      if (!c.photo) return;
      const url = cdnImg(c.photo, { width: POST_PHOTO_WIDTH, quality: POST_PHOTO_QUALITY });
      if (!url || prefetchedCheckInPhotosRef.current.has(url)) return;
      prefetchedCheckInPhotosRef.current.add(url);
      const img = new window.Image();
      if ("fetchPriority" in img) (img as any).fetchPriority = "low";
      img.src = url;
    });
  }, [groupCheckIns]);
  const [activeGroupViewTab, setActiveGroupViewTab] = React.useState<"check-ins" | "participants">("check-ins");
  const [activeGroupIndex, setActiveGroupIndex] = React.useState(0);
  const [isAddCheckInModalOpen, setIsAddCheckInModalOpen] = React.useState(false);
  const [isSubmittingCheckIn, setIsSubmittingCheckIn] = React.useState(false);
  const [checkInForm, setCheckInForm] = React.useState({
    photo: "", // Legacy first photo string
    photos: [] as string[], // Multiple photo strings
    description: "",
    workoutId: "",
  });
  const [checkInPhotoFiles, setCheckInPhotoFiles] = React.useState<File[]>([]);
  const [checkInPhotoPreviewUrls, setCheckInPhotoPreviewUrls] = React.useState<string[]>([]);
  const [activePhotoPreviewIndex, setActivePhotoPreviewIndex] = React.useState(0);
  const thumbDragState = React.useRef<{ index: number; started: boolean; startX: number; startY: number } | null>(null);
  const thumbDragOverRef = React.useRef<number | null>(null);
  const [draggingThumbIndex, setDraggingThumbIndex] = React.useState<number | null>(null);
  const [dragOverThumbIndex, setDragOverThumbIndex] = React.useState<number | null>(null);
  // pendingCropSrc: data URL waiting to be cropped; pendingCropIndex: index to replace (-1 = append new)
  const [pendingCropSrc, setPendingCropSrc] = React.useState<string | null>(null);
  const [pendingCropIndex, setPendingCropIndex] = React.useState<number>(-1);
  const checkInCameraInputRef = React.useRef<HTMLInputElement>(null);
  const checkInGalleryInputRef = React.useRef<HTMLInputElement>(null);

  const handleCheckInPhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPendingCropIndex(-1);
      setPendingCropSrc(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  React.useEffect(() => {
    if (checkInPhotoFiles.length === 0) {
      setCheckInPhotoPreviewUrls([]);
      return;
    }
    const urls = checkInPhotoFiles.map(file => URL.createObjectURL(file));
    setCheckInPhotoPreviewUrls(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [checkInPhotoFiles]);
  const [completedRoutines, setCompletedRoutines] = React.useState<CompletedRoutine[]>([]);
  const [selectedRoutineKey, setSelectedRoutineKey] = React.useState<string | null>(null);

  // Routine + day combos already checked in to the currently open group —
  // blocks re-posting the exact same workout session as a new check-in
  // there (scoped per group: sharing the same workout across different
  // duels you're in is fine, it's only re-posting *within one group* that
  // would inflate that group's score).
  const checkedInRoutineDayKeys = React.useMemo(() => {
    const set = new Set<string>();
    groupCheckIns.forEach((c) => {
      if (!c.workoutInfo) return;
      const day = new Date(c.createdAt).toDateString();
      set.add(`${c.workoutInfo.trim().toLowerCase()}__${day}`);
    });
    return set;
  }, [groupCheckIns]);
  const routineDayKey = (routineName: string, completedAt: string) =>
    `${routineName.trim().toLowerCase()}__${new Date(completedAt).toDateString()}`;
  const [participantsSearch, setParticipantsSearch] = React.useState("");
  const [selectedCheckInForDetail, setSelectedCheckInForDetail] = React.useState<GroupCheckIn | null>(null);
  const [isCheckInDetailOpen, setIsCheckInDetailOpen] = React.useState(false);
  const [isGroupDetailsOpen, setIsGroupDetailsOpen] = React.useState(false);
  const [isEditingGroupInfo, setIsEditingGroupInfo] = React.useState(false);
  const [editGroupName, setEditGroupName] = React.useState("");
  const [editGroupGoal, setEditGroupGoal] = React.useState("");
  const [editGroupRule, setEditGroupRule] = React.useState("");
  const [isSavingGroupInfo, setIsSavingGroupInfo] = React.useState(false);
  const [deleteGroupConfirmOpen, setDeleteGroupConfirmOpen] = React.useState(false);
  const [leaveGroupConfirmOpen, setLeaveGroupConfirmOpen] = React.useState(false);
  const [isClassificationsOpen, setIsClassificationsOpen] = React.useState(false);
  const [isParticipantsModalOpen, setIsParticipantsModalOpen] = React.useState(false);
  const [participantDetailsId, setParticipantDetailsId] = React.useState<string | null>(null);
  const [isAddMembersModalOpen, setIsAddMembersModalOpen] = React.useState(false);
  const [isEditCheckInOpen, setIsEditCheckInOpen] = React.useState(false);
  const [confirmDialog, setConfirmDialog] = React.useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: "", description: "", onConfirm: () => { } });

  const [pendingInvites, setPendingInvites] = React.useState<PendingInvite[]>([]);
  const [pendingGroupRequests, setPendingGroupRequests] = React.useState<GroupJoinRequest[]>([]);

  // Check-in comments state
  const [checkInComments, setCheckInComments] = React.useState<CheckInComment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = React.useState(false);
  const [commentText, setCommentText] = React.useState("");
  const [isSendingComment, setIsSendingComment] = React.useState(false);
  const [deletingCommentId, setDeletingCommentId] = React.useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = React.useState<string | null>(null);
  const [editCommentDraft, setEditCommentDraft] = React.useState("");
  const [isSavingEditComment, setIsSavingEditComment] = React.useState(false);

  // Check-in emoji reactions state
  const [checkInReactions, setCheckInReactions] = React.useState<Record<string, CheckInReaction[]>>({});
  const CHECKIN_QUICK_EMOJIS = ["❤️", "🔥", "💪", "😮", "👏", "🏆"];
  const [reactionViewerState, setReactionViewerState] = React.useState<{ checkInId: string; emoji: string; users: CheckInReactionWithUser[]; loading: boolean } | null>(null);

  // Check-in long-press (emoji overlay) state
  const [longPressedCheckIn, setLongPressedCheckIn] = React.useState<GroupCheckIn | null>(null);
  const checkInLongPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCheckInTouchStart = React.useCallback((checkIn: GroupCheckIn) => {
    checkInLongPressTimer.current = setTimeout(() => setLongPressedCheckIn(checkIn), 450);
  }, []);
  const handleCheckInTouchEnd = React.useCallback(() => {
    if (checkInLongPressTimer.current) {
      clearTimeout(checkInLongPressTimer.current);
      checkInLongPressTimer.current = null;
    }
  }, []);

  // Remove member from group state
  const [removeMemberConfirm, setRemoveMemberConfirm] = React.useState<{ open: boolean; participant: { userId: string; userNickname: string } | null }>({ open: false, participant: null });

  const handleSendComment = React.useCallback(async (checkInId: string) => {
    if (!commentText.trim() || isSendingComment) return;
    setIsSendingComment(true);
    try {
      const newComment = await addCheckInCommentDb(checkInId, commentText);
      setCheckInComments((prev) => [...prev, newComment]);
      setCommentText("");
    } catch (err: any) {
      toast({ title: "Erro ao comentar", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setIsSendingComment(false);
    }
  }, [commentText, isSendingComment]);

  const handleStartEditComment = React.useCallback((comment: CheckInComment) => {
    setEditingCommentId(comment.id);
    setEditCommentDraft(comment.text);
  }, []);

  const handleCancelEditComment = React.useCallback(() => {
    setEditingCommentId(null);
    setEditCommentDraft("");
  }, []);

  const handleSaveEditComment = React.useCallback(async (commentId: string) => {
    if (!editCommentDraft.trim()) return;
    setIsSavingEditComment(true);
    try {
      await updateCheckInCommentDb(commentId, editCommentDraft);
      setCheckInComments((prev) =>
        prev.map((c) => c.id === commentId ? { ...c, text: editCommentDraft.trim() } : c)
      );
      setEditingCommentId(null);
      setEditCommentDraft("");
      toast({ title: t("comments_edited") });
    } catch (err: any) {
      toast({ title: t("comments_edit_error"), description: err?.message || t("retry"), variant: "destructive" });
    } finally {
      setIsSavingEditComment(false);
    }
  }, [editCommentDraft, t]);

  // `handleDeleteCheckInComment` vive logo abaixo de `showConfirm`, de quem
  // depende — declarado aqui, o array de deps cairia na TDZ do const.

  const [isLoadingCheckIns, setIsLoadingCheckIns] = React.useState(false);
  const [isLoadingRoutines, setIsLoadingRoutines] = React.useState(false);

  // Tracks the last requested group id to discard stale async responses
  const activeGroupIdRef = React.useRef<string | null>(null);

  // Open a group view instantly and load data in background
  const openGroupView = React.useCallback((group: any) => {
    activeGroupIdRef.current = group.id;
    setSelectedGroupForView(group);
    setActiveGroupViewTab("check-ins");
    setGroupCheckIns([]);
    setGroupParticipants([]);
    setVisibleCheckInCount(CHECKINS_INITIAL_COUNT);
    // Sem isto, um ajuste de capa abandonado reabriria no grupo seguinte.
    setCoverCropSrc(null);
    setIsLoadingCheckIns(true);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", "duels");
      next.set("group", group.id);
      return next;
    }, { replace: true });
    Promise.all([
      getGroupCheckInsDb(group.id),
      getGroupParticipantsDb(group.id),
    ])
      .then(([checkIns, participants]) => {
        // Ignore if user has already switched to a different group
        if (activeGroupIdRef.current !== group.id) return;
        setGroupCheckIns(checkIns);
        setGroupParticipants(participants);
        // Load reactions for check-ins
        if (checkIns.length > 0) {
          getCheckInReactionsDb(checkIns.map((c) => c.id)).then(setCheckInReactions).catch(() => { });
        }
        // Load votes for memes scoring mode
        if (group.scoringType === "memes") {
          getCheckInVotesDb(group.id).then(setCheckInVotes).catch(() => { });
        } else {
          setCheckInVotes([]);
        }
      })
      .catch((err: any) => console.error("Error loading group data:", err))
      .finally(() => {
        if (activeGroupIdRef.current === group.id) setIsLoadingCheckIns(false);
      });
  }, [setSearchParams]);

  // Re-fetches check-ins/participants for the open group without clearing the
  // current list first (avoids the empty-state flash `openGroupView` causes) —
  // used by pull-to-refresh below.
  const refreshGroupView = React.useCallback(async (groupId: string) => {
    invalidateQueryCache("groupCheckIns");
    invalidateQueryCache("groupParticipants");
    try {
      const [checkIns, participants] = await Promise.all([
        getGroupCheckInsDb(groupId),
        getGroupParticipantsDb(groupId),
      ]);
      if (activeGroupIdRef.current !== groupId) return;
      setGroupCheckIns(checkIns);
      setGroupParticipants(participants);
      if (checkIns.length > 0) {
        getCheckInReactionsDb(checkIns.map((c) => c.id)).then(setCheckInReactions).catch(() => { });
      }
      if (selectedGroupForView?.scoringType === "memes") {
        getCheckInVotesDb(groupId).then(setCheckInVotes).catch(() => { });
      }
    } catch (err: any) {
      console.error("Error refreshing group data:", err);
    }
  }, [selectedGroupForView?.scoringType]);

  // Revela mais check-ins conforme a rolagem se aproxima do fim da lista.
  // Sem rede: o lote já está em memória, é só deixar de recortá-lo.
  //
  // O scroll dispara dezenas de vezes por segundo e vários eventos cabem antes
  // do próximo render — sem trava, um fling até o fim revelaria 40+ cartões de
  // uma vez, exatamente o que a paginação existe para evitar. A trava libera no
  // efeito abaixo, garantindo no máximo um lote por render commitado.
  const loadMoreLockRef = React.useRef(false);

  const onGroupViewScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (loadMoreLockRef.current || visibleCheckInCount >= groupCheckIns.length) return;
    const el = e.currentTarget;
    const nearEnd = el.scrollHeight - el.scrollTop - el.clientHeight < CHECKINS_LOAD_MORE_OFFSET;
    if (!nearEnd) return;
    loadMoreLockRef.current = true;
    setVisibleCheckInCount(Math.min(visibleCheckInCount + CHECKINS_PAGE_SIZE, groupCheckIns.length));
  }, [visibleCheckInCount, groupCheckIns.length]);

  React.useEffect(() => {
    loadMoreLockRef.current = false;
  }, [visibleCheckInCount]);

  // Pull-to-refresh for the group screen (same UX as the feed)
  const groupViewScrollRef = React.useRef<HTMLDivElement>(null);
  const groupPullStartY = React.useRef(0);
  const [groupPullDistance, setGroupPullDistance] = React.useState(0);
  const [isGroupPulling, setIsGroupPulling] = React.useState(false);
  const [isGroupRefreshing, setIsGroupRefreshing] = React.useState(false);
  const GROUP_PULL_THRESHOLD = 72;

  const onGroupTouchStart = React.useCallback((e: React.TouchEvent) => {
    const scrollEl = groupViewScrollRef.current;
    if (!scrollEl || scrollEl.scrollTop > 0) return;
    groupPullStartY.current = e.touches[0].clientY;
    setIsGroupPulling(true);
  }, []);

  const onGroupTouchMove = React.useCallback((e: React.TouchEvent) => {
    if (!isGroupPulling) return;
    const delta = e.touches[0].clientY - groupPullStartY.current;
    if (delta > 0) setGroupPullDistance(Math.min(delta * 0.4, GROUP_PULL_THRESHOLD + 20));
  }, [isGroupPulling]);

  const onGroupTouchEnd = React.useCallback(() => {
    if (!isGroupPulling) return;
    if (groupPullDistance >= GROUP_PULL_THRESHOLD && selectedGroupForView) {
      hapticLight();
      setIsGroupRefreshing(true);
      refreshGroupView(selectedGroupForView.id).finally(() => setIsGroupRefreshing(false));
    }
    setGroupPullDistance(0);
    setIsGroupPulling(false);
  }, [isGroupPulling, groupPullDistance, selectedGroupForView, refreshGroupView]);

  const showConfirm = React.useCallback(
    (title: string, description: string, onConfirm: () => void) => {
      setConfirmDialog({ open: true, title, description, onConfirm });
    },
    [],
  );

  // Contagem de votos do modo memes. Cada forma tem chave própria: em PT o
  // plural de "aprovação" é "aprovações" (troca "ão" por "ões"), não dá para
  // grudar sufixo. Zero é plural nos dois idiomas ("0 aprovações").
  const formatApprovals = React.useCallback(
    (n: number) =>
      t(n === 1 ? "duels_group_approvals_one" : "duels_group_approvals").replace("{n}", String(n)),
    [t],
  );

  const formatAnnulments = React.useCallback(
    (n: number) =>
      t(n === 1 ? "duels_group_annulments_one" : "duels_group_annulments").replace("{n}", String(n)),
    [t],
  );

  // Excluir comentário é irreversível — confirma antes, pelo mesmo diálogo
  // central que o botão de excluir check-in usa neste drawer, com o texto já
  // usado nos comentários de post (`comments_delete_*`).
  const handleDeleteCheckInComment = React.useCallback((commentId: string) => {
    showConfirm(t("comments_delete_title"), t("comments_delete_desc"), async () => {
      setDeletingCommentId(commentId);
      try {
        await deleteCheckInCommentDb(commentId);
        setCheckInComments((prev) => prev.filter((c) => c.id !== commentId));
        toast({ title: t("comments_deleted") });
      } catch (err: any) {
        console.error("Error deleting check-in comment:", err);
        toast({ title: t("comments_delete_error"), description: err?.message || t("retry"), variant: "destructive" });
      } finally {
        setDeletingCommentId(null);
      }
    });
  }, [showConfirm, t]);

  // Abre um check-in específico (vindo de uma notificação) com comentários e reações.
  const openCheckInById = React.useCallback(async (checkInId: string) => {
    try {
      const [detail, comments, reactions] = await Promise.all([
        getGroupCheckInDetailDb(checkInId),
        getCheckInCommentsDb(checkInId),
        getCheckInReactionsDb([checkInId]),
      ]);
      if (!detail) return;
      // Carrega o grupo por trás do check-in e monta o MESMO estado da tela do
      // duelo (`openGroupView` preenche `selectedGroupForView` e, em grupos de
      // memes, carrega `checkInVotes`). Sem isto, abrir o check-in direto pela
      // notificação deixava `selectedGroupForView` nulo → a barra de
      // aprovar/reprovar (que exige `scoringType === "memes"` + votos) sumia, e
      // ela só voltava ao fechar o drawer e reabrir pela tela do grupo. De
      // brinde, ao fechar o drawer o usuário cai no grupo já carregado, e não
      // numa tela de grupo vazia.
      const group = await getDuelGroupDb(detail.groupId);
      if (group) {
        openGroupView({ ...group, icon: "⚔️", description: group.goal, city: group.location, isOfficial: false });
      }
      setSelectedCheckInForDetail(detail);
      setCheckInComments(comments);
      setCheckInReactions((prev) => ({ ...prev, ...reactions }));
      setIsCheckInDetailOpen(true);
      // Switch to the duels tab so the check-in is visible
      setActiveTab("duels");
    } catch (err) {
      console.error("Error opening check-in from notification:", err);
    }
  }, [openGroupView]);

  // Navegação interna (card da tela de Notificações) → state.openCheckIn
  React.useEffect(() => {
    const state = location.state as { openCheckIn?: string } | null;
    if (!state?.openCheckIn) return;
    // Clear nav state so back-navigation doesn't re-trigger
    navigate(location.pathname, { replace: true, state: {} });
    openCheckInById(state.openCheckIn);
  }, [location.state, navigate, openCheckInById]);

  // Toque no push (?checkin=<id>) — um deep link é só uma URL, não carrega o
  // `state` do router, então o mesmo destino precisa existir como query param.
  const checkInRestoredRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const checkInParam = searchParams.get("checkin");
    if (!checkInParam || checkInRestoredRef.current === checkInParam) return;
    checkInRestoredRef.current = checkInParam;
    openCheckInById(checkInParam);
  }, [searchParams, openCheckInById]);

  // Carrega grupos + solicitações num par de queries paralelas.
  //
  // `fresh` existe porque convite/solicitação é o único dado desta tela que o
  // usuário chega a ver DEPOIS de ser avisado dele (push → aba Solicitações).
  // Com o cache normal (30s/60s + localStorage), o dono tocava na notificação e
  // via a lista de antes do pedido — só fechando e reabrindo o app aparecia.
  const loadGroupsAndRequests = React.useCallback(
    async (opts?: { fresh?: boolean }) => {
      if (!user?.id) return;
      try {
        const [{ myGroups, availableGroups: enrichedAvailGroups, pendingInvites: invites }, joinRequests] =
          await Promise.all([
            getEnrichedDuelGroupsDb(user.id, { fresh: opts?.fresh }),
            getPendingGroupRequestsDb({ fresh: opts?.fresh }),
          ]);

        setPendingInvites(invites);
        setPendingGroupRequests(joinRequests);
        setUserCreatedGroups(myGroups.map(toGroupCard));
        setJoinedGroupIds(new Set(enrichedAvailGroups.filter((g) => g.isAlreadyMember).map((g) => g.id)));
        setAvailableGroups(enrichedAvailGroups.filter((g) => !g.isAlreadyMember).map(toGroupCard));
      } catch (err: any) {
        console.error("Error loading user groups:", err);
      }
    },
    [user?.id],
  );

  // Load user nickname and groups when user changes
  React.useEffect(() => {
    void loadGroupsAndRequests();
  }, [loadGroupsAndRequests]);

  // Auto-select tab from URL parameter (?tab=requests)
  React.useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "requests") {
      setActiveTab("requests");
    } else if (tabParam === "duels") {
      setActiveTab("duels");
    }
  }, [searchParams]);

  // Abrir a aba de Solicitações sempre vai à rede (sem cache). É o destino do
  // toque no push do convite/pedido: o dado que o usuário veio ver nasceu
  // depois da última leitura.
  React.useEffect(() => {
    if (activeTab !== "requests" || !user?.id) return;
    void loadGroupsAndRequests({ fresh: true });
  }, [activeTab, user?.id, loadGroupsAndRequests]);

  // Realtime de convites/solicitações — o dono aprova e o solicitante entra no
  // grupo sem ninguém precisar recarregar nada.
  //
  // Só reage a linha que diz respeito a ESTE usuário: pedido/convite dele
  // (`user_id`) ou pedido em grupo do qual ele é dono. Sem esse filtro, cada
  // entrada de qualquer usuário em qualquer grupo do app dispararia refetch.
  // DELETE é exceção obrigatória: o payload traz só a chave primária (a
  // publicação usa REPLICA IDENTITY padrão), então não há como filtrar — e são
  // eventos raros (recusa/saída de grupo).
  const myGroupIdsRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    myGroupIdsRef.current = new Set(userCreatedGroups.map((g: any) => String(g.id)));
  }, [userCreatedGroups]);

  const participantsChannelRef = React.useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);
  React.useEffect(() => {
    if (!user?.id || !supabase) return;

    // Derruba o canal anterior ANTES de criar outro (mesmo padrão da conversa
    // privada e de Notifications.tsx — ver comentário lá).
    if (participantsChannelRef.current) {
      supabase.removeChannel(participantsChannelRef.current);
      participantsChannelRef.current = null;
    }

    // Coalesce rajadas (aprovar vários pedidos seguidos = um refetch).
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        debounce = null;
        void loadGroupsAndRequests({ fresh: true });
      }, 250);
    };

    const channelName = `duel-participants:${user.id.slice(0, 8)}:${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "duel_group_participants" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            scheduleRefresh();
            return;
          }
          const row = payload.new as { user_id?: string; group_id?: string } | null;
          if (!row) return;
          const isMine = row.user_id === user.id || myGroupIdsRef.current.has(String(row.group_id));
          if (isMine) scheduleRefresh();
        },
      )
      .subscribe((status) => {
        // Dispara na primeira assinatura E a cada reassinatura após reconexão
        // do websocket — momento exato em que pode haver evento perdido.
        if (status === "SUBSCRIBED") void loadGroupsAndRequests({ fresh: true });
      });

    participantsChannelRef.current = channel;

    // O app fica minutos em background com o socket morto; ao voltar (inclusive
    // pelo toque no push), busca o que mudou nesse meio-tempo.
    const onVisibility = () => {
      if (document.visibilityState === "visible") void loadGroupsAndRequests({ fresh: true });
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (debounce) clearTimeout(debounce);
      document.removeEventListener("visibilitychange", onVisibility);
      if (participantsChannelRef.current) {
        supabase.removeChannel(participantsChannelRef.current);
        participantsChannelRef.current = null;
      }
    };
  }, [user?.id, loadGroupsAndRequests]);

  // Restore group view from URL param (?group=<groupId>) after refresh — runs once
  const groupRestoredRef = React.useRef(false);
  React.useEffect(() => {
    const groupIdParam = searchParams.get("group");
    if (!groupIdParam || selectedGroupForView || groupRestoredRef.current) return;
    // Try to find in already-loaded groups
    const allGroups = [...userCreatedGroups, ...availableGroups];
    const found = allGroups.find((g) => g.id === groupIdParam);
    if (found) {
      groupRestoredRef.current = true;
      openGroupView(found);
      return;
    }
    // Fetch from DB if not loaded yet (only once)
    groupRestoredRef.current = true;
    getDuelGroupDb(groupIdParam).then((group) => {
      if (group) {
        const groupCard = { ...group, icon: "⚔️", description: group.goal, city: group.location, isOfficial: false };
        openGroupView(groupCard);
      }
    }).catch((err) => console.error("Error restoring group view:", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, userCreatedGroups, availableGroups]);

  // Reload reactions whenever the group view is open and check-ins are loaded
  React.useEffect(() => {
    if (groupCheckIns.length === 0) return;
    getCheckInReactionsDb(groupCheckIns.map((c) => c.id))
      .then(setCheckInReactions)
      .catch(() => { });
  }, [groupCheckIns]);

  return {
    // vindos dos hooks/props da tela, reexportados para o JSX das abas
    setSearchParams,
    setActiveTab,
    isCreateGroupModalOpen,
    setIsCreateGroupModalOpen,
    groupStep,
    setGroupStep,
    isCreatingGroup,
    setIsCreatingGroup,
    groupConfig,
    setGroupConfig,
    checkInMetricValue,
    setCheckInMetricValue,
    checkInVotes,
    setCheckInVotes,
    selectedMemberForCheckIns,
    setSelectedMemberForCheckIns,
    groupPhotoFile,
    setGroupPhotoFile,
    editCoverInputRef,
    groupCoverTransform,
    setGroupCoverTransform,
    groupCoverWRef,
    groupCoverHRef,
    coverCropSrc,
    setCoverCropSrc,
    coverCropTransform,
    setCoverCropTransform,
    coverCropWRef,
    coverCropHRef,
    isSavingCover,
    setIsSavingCover,
    selectedInvitees,
    setSelectedInvitees,
    userCreatedGroups,
    setUserCreatedGroups,
    availableGroups,
    setAvailableGroups,
    duelPaywallOpen,
    setDuelPaywallOpen,
    activeCreatedDuels,
    duelGateBlocked,
    joinedGroupIds,
    setJoinedGroupIds,
    joiningGroupId,
    setJoiningGroupId,
    selectedGroupForView,
    setSelectedGroupForView,
    groupCheckIns,
    setGroupCheckIns,
    groupParticipants,
    setGroupParticipants,
    visibleCheckInCount,
    setVisibleCheckInCount,
    selectedMemberCheckIns,
    prefetchedCheckInPhotosRef,
    activeGroupViewTab,
    setActiveGroupViewTab,
    activeGroupIndex,
    setActiveGroupIndex,
    isAddCheckInModalOpen,
    setIsAddCheckInModalOpen,
    isSubmittingCheckIn,
    setIsSubmittingCheckIn,
    checkInForm,
    setCheckInForm,
    checkInPhotoFiles,
    setCheckInPhotoFiles,
    checkInPhotoPreviewUrls,
    setCheckInPhotoPreviewUrls,
    activePhotoPreviewIndex,
    setActivePhotoPreviewIndex,
    thumbDragState,
    thumbDragOverRef,
    draggingThumbIndex,
    setDraggingThumbIndex,
    dragOverThumbIndex,
    setDragOverThumbIndex,
    pendingCropSrc,
    setPendingCropSrc,
    pendingCropIndex,
    setPendingCropIndex,
    checkInCameraInputRef,
    checkInGalleryInputRef,
    handleCheckInPhotoSelected,
    completedRoutines,
    setCompletedRoutines,
    selectedRoutineKey,
    setSelectedRoutineKey,
    checkedInRoutineDayKeys,
    routineDayKey,
    participantsSearch,
    setParticipantsSearch,
    selectedCheckInForDetail,
    setSelectedCheckInForDetail,
    isCheckInDetailOpen,
    setIsCheckInDetailOpen,
    isGroupDetailsOpen,
    setIsGroupDetailsOpen,
    isEditingGroupInfo,
    setIsEditingGroupInfo,
    editGroupName,
    setEditGroupName,
    editGroupGoal,
    setEditGroupGoal,
    editGroupRule,
    setEditGroupRule,
    isSavingGroupInfo,
    setIsSavingGroupInfo,
    deleteGroupConfirmOpen,
    setDeleteGroupConfirmOpen,
    leaveGroupConfirmOpen,
    setLeaveGroupConfirmOpen,
    isClassificationsOpen,
    setIsClassificationsOpen,
    isParticipantsModalOpen,
    setIsParticipantsModalOpen,
    participantDetailsId,
    setParticipantDetailsId,
    isAddMembersModalOpen,
    setIsAddMembersModalOpen,
    isEditCheckInOpen,
    setIsEditCheckInOpen,
    confirmDialog,
    setConfirmDialog,
    pendingInvites,
    setPendingInvites,
    pendingGroupRequests,
    setPendingGroupRequests,
    checkInComments,
    setCheckInComments,
    isLoadingComments,
    setIsLoadingComments,
    commentText,
    setCommentText,
    isSendingComment,
    setIsSendingComment,
    deletingCommentId,
    setDeletingCommentId,
    editingCommentId,
    setEditingCommentId,
    editCommentDraft,
    setEditCommentDraft,
    isSavingEditComment,
    setIsSavingEditComment,
    checkInReactions,
    setCheckInReactions,
    CHECKIN_QUICK_EMOJIS,
    reactionViewerState,
    setReactionViewerState,
    longPressedCheckIn,
    setLongPressedCheckIn,
    checkInLongPressTimer,
    handleCheckInTouchStart,
    handleCheckInTouchEnd,
    removeMemberConfirm,
    setRemoveMemberConfirm,
    handleSendComment,
    handleStartEditComment,
    handleCancelEditComment,
    handleSaveEditComment,
    isLoadingCheckIns,
    setIsLoadingCheckIns,
    isLoadingRoutines,
    setIsLoadingRoutines,
    activeGroupIdRef,
    openGroupView,
    refreshGroupView,
    loadMoreLockRef,
    onGroupViewScroll,
    groupViewScrollRef,
    groupPullStartY,
    groupPullDistance,
    setGroupPullDistance,
    isGroupPulling,
    setIsGroupPulling,
    isGroupRefreshing,
    setIsGroupRefreshing,
    GROUP_PULL_THRESHOLD,
    onGroupTouchStart,
    onGroupTouchMove,
    onGroupTouchEnd,
    showConfirm,
    formatApprovals,
    formatAnnulments,
    handleDeleteCheckInComment,
    openCheckInById,
    checkInRestoredRef,
    loadGroupsAndRequests,
    myGroupIdsRef,
    participantsChannelRef,
    groupRestoredRef,
  };
}

export type DuelsController = ReturnType<typeof useDuels>;
