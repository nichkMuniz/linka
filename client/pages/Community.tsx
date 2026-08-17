import * as React from "react";
import * as ReactDOM from "react-dom";
import {
  getConversationsDb,
  getConversationMessagesDb,
  peekConversationMessages,
  cacheConversationMessages,
  sendMessageDb,
  uploadMessageImageDb,
  uploadMessageAudioDb,
  markMessagesAsReadDb,
  deleteMessagePermanentlyDb,
  deleteMessageForMeDb,
  deleteConversationForMeDb,
  getFollowingDb,
  getRankingDb,
  createDuelGroupDb,
  getDuelGroupDb,
  addGroupCheckInDb,
  getGroupCheckInsDb,
  getGroupCheckInDetailDb,
  getEnrichedDuelGroupsDb,
  getRecentCompletedRoutinesDb,
  getUserProfileDb,
  addMembersToGroupDb,
  leaveGroupDb,
  deleteGroupCheckInDb,
  deleteGroupDb,
  getGroupParticipantsDb,
  updateGroupPhotoDb,
  updateGroupInfoDb,
  acceptGroupInviteDb,
  declineGroupInviteDb,
  sendGroupJoinRequestNotificationDb,
  setMessageEmojiDb,
  getPendingGroupRequestsDb,
  approveGroupRequestDb,
  rejectGroupRequestDb,
  removeGroupMemberDb,
  getCheckInCommentsDb,
  addCheckInCommentDb,
  deleteCheckInCommentDb,
  updateCheckInCommentDb,
  getCheckInReactionsDb,
  getCheckInReactionUsersDb,
  type CheckInReactionWithUser,
  setCheckInReactionDb,
  sendCheckInReactionNotificationDb,
  getCheckInVotesDb,
  setCheckInVoteDb,
  invalidateQueryCache,
  type Conversation,
  type MessageWithUser,
  type SearchUser,
  type RankingUser,
  type GroupCheckIn,
  type CompletedRoutine,
  type GroupJoinRequest,
  type CheckInComment,
  type CheckInReaction,
  type DuelCheckInVote,
  type DuelCheckInVoteType,
} from "@/lib/ritmofit-db";
import { useAuth } from "@/hooks/useAuth";
import { hapticLight } from "@/lib/haptics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// Tabs component replaced by custom underline tabs
import { toast } from "@/components/ui/use-toast";
import { ArrowLeft, Send, Check, CheckCheck, Plus, X, ChevronRight, Trash2, Edit3, Search, PenSquare, MessageCircle, Users, ChevronLeft, Swords, BarChart2, Camera, Image, Mic, Crop, CheckCircle2, XCircle, Pencil } from "lucide-react";
import { CommentReactions } from "@/components/shared/comment-reactions";
import { ClassificationsDrawer } from "@/components/community/classifications-drawer";
import { MemberCheckInsDrawer } from "@/components/community/member-checkins-drawer";
import { NewConversationDrawer } from "@/components/community/new-conversation-drawer";
import { AddMembersDrawer } from "@/components/community/add-members-drawer";
import { EditCheckInDrawer } from "@/components/community/edit-checkin-drawer";
import { SwipeableConversationRow } from "@/components/community/swipeable-conversation-row";
import { SwipeableMessageBubble } from "@/components/community/swipeable-message-bubble";
import { ImageCropperDrawer } from "@/components/shared/image-cropper-drawer";
import {
  InlineCropPreview,
  applyTransformToBlob,
  DEFAULT_TRANSFORM,
  type CropTransform,
} from "@/components/shared/inline-crop-preview";
import { PostCarousel, POST_PHOTO_WIDTH, POST_PHOTO_QUALITY } from "@/components/post/post-carousel";
import { cdnImg } from "@/lib/image-url";
import { compressImageFile } from "@/lib/image-compress";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  GLASS_SHEET_STYLE,
  GLASS_FIELD_STYLE,
  GLASS_PRIMARY_BTN_STYLE,
  GLASS_PANEL_STYLE,
  GLASS_CARD_STYLE,
  GLASS_SHEET_PROPS,
  GLASS_LABEL_CLASS,
  GLASS_FIELD_CLASS,
} from "@/lib/glass-styles";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { CommunitySkeleton } from "@/components/shared/animated-loading";
import { PaywallDrawer } from "@/components/shared/paywall-drawer";
import { usePremium } from "@/lib/premium-context";
import { useLanguage } from "@/lib/language-context";
import { UserInsignias } from "@/components/profile/user-insignias";
import { ImageWithFallback } from "@/components/shared/image-with-fallback";
import { UserAvatar } from "@/components/shared/user-avatar";
import { SharedContentMessage } from "@/components/community/shared-content-message";
import { FlowReplyMessage } from "@/components/community/flow-reply-message";
import { parseFlowReply } from "@/lib/flow-reply";
import { ChatImageMessage, ChatAudioMessage } from "@/components/community/chat-media";
import { RankingTab } from "@/components/community/ranking-tab";
import { subscribeKeyboardHeight } from "@/lib/keyboard";
import { setActiveConversationUserId } from "@/lib/active-conversation";
import { useKeyboardInputScroll } from "@/hooks/use-keyboard-input-scroll";
import {
  specialMessageLabel,
  conversationPreviewText,
  buildReplyPrefix,
  formatTimeAgo,
  sameMessageList,
  DEFAULT_CHECKIN_PHOTO,
  DUEL_SCORING_TYPE_OPTIONS,
  type ViewMode,
} from "@/components/community/community-helpers";

// Helpers puros (specialMessageLabel, formatTimeAgo), constantes (DEFAULT_CHECKIN_PHOTO,
// DUEL_SCORING_TYPE_OPTIONS) e o tipo ViewMode foram extraídos para
// `@/components/community/community-helpers` (ver imports acima).

// Histórico do grupo — paginação de renderização (o fetch traz tudo).
const CHECKINS_INITIAL_COUNT = 50;
const CHECKINS_PAGE_SIZE = 10;
/** Distância do fim da rolagem que dispara a revelação do próximo lote. */
const CHECKINS_LOAD_MORE_OFFSET = 320;

/** Grupo do banco → card do carrossel de duelos. */
const toGroupCard = (group: any) => ({
  ...group,
  icon: "⚔️",
  description: group.goal,
  city: group.location,
  isOfficial: false,
});

export default function Community() {
  const { user } = useAuth();
  const { isPremium } = usePremium();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, language } = useLanguage();
  // A conversa de DM já encolhe com o teclado (bottom: --keyboard-height). Este
  // hook cobre os formulários dos drawers (criar duelo, check-in, editar grupo,
  // editar comentário) cujos campos ficam no meio do scroll. Ref-less: rola o
  // container ativo detectado a partir do campo em foco. Ver hook.
  useKeyboardInputScroll();

  const [activeTab, setActiveTab] = React.useState("messages");

  const [viewMode, setViewMode] = React.useState<ViewMode>("conversations");
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] =
    React.useState<Conversation | null>(null);
  const [messages, setMessages] = React.useState<MessageWithUser[]>([]);
  const [messageText, setMessageText] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [isSending, setIsSending] = React.useState(false);
  const [followers, setFollowers] = React.useState<SearchUser[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [ranking, setRanking] = React.useState<RankingUser[]>([]);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  // Fase de abertura da conversa: enquanto true, qualquer mudança na lista
  // reposiciona no fim SEM animação (a semente do cache, depois a versão da
  // rede). Vira false só quando a busca da rede assenta — daí em diante
  // mensagem nova rola suave.
  const isOpeningConversationRef = React.useRef(true);
  const messageInputRef = React.useRef<HTMLInputElement>(null);
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const [isSendingPhoto, setIsSendingPhoto] = React.useState(false);
  const [imageViewerUrl, setImageViewerUrl] = React.useState<string | null>(null);
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingSeconds, setRecordingSeconds] = React.useState(0);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const audioMimeTypeRef = React.useRef<string>("audio/webm");
  const recordingTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  // Canal realtime da conversa aberta — guardado em ref para poder derrubá-lo
  // antes de criar o próximo (ver comentário no efeito de realtime).
  const conversationChannelRef = React.useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);
  const [isNewConversationDrawerOpen, setIsNewConversationDrawerOpen] = React.useState(false);

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

  const [pendingInvites, setPendingInvites] = React.useState<Array<{ groupId: string; groupName: string; groupGoal: string; groupLocation: string }>>([]);
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

  // Delete conversation state
  const [deleteConvConfirmOpen, setDeleteConvConfirmOpen] = React.useState(false);
  const [convToDelete, setConvToDelete] = React.useState<Conversation | null>(null);

  // Message long-press / context menu state
  const [longPressedMessage, setLongPressedMessage] = React.useState<MessageWithUser | null>(null);
  const [replyingTo, setReplyingTo] = React.useState<MessageWithUser | null>(null);
  const [deleteMessageConfirm, setDeleteMessageConfirm] = React.useState<{ message: MessageWithUser; permanent: boolean } | null>(null);
  const QUICK_EMOJIS = ["❤️", "😂", "😮", "😢", "😡", "👍"];

  const handleMessageLongPress = React.useCallback((message: MessageWithUser) => {
    setLongPressedMessage(message);
  }, []);

  const handleReactToMessage = React.useCallback(async (emoji: string) => {
    if (!longPressedMessage) return;
    const messageId = longPressedMessage.id;
    // Toggle: if same emoji already set, remove it
    const newEmoji = longPressedMessage.emoji === emoji ? null : emoji;
    setLongPressedMessage(null);
    // Optimistic update
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, emoji: newEmoji } : m)),
    );
    await setMessageEmojiDb(messageId, newEmoji);
  }, [longPressedMessage]);

  const handleReplyToMessage = React.useCallback((message: MessageWithUser) => {
    setReplyingTo(message);
    setLongPressedMessage(null);
  }, []);

  const handleConfirmDeleteMessage = React.useCallback(async () => {
    if (!deleteMessageConfirm) return;
    const { message, permanent } = deleteMessageConfirm;
    setDeleteMessageConfirm(null);
    try {
      if (permanent) {
        await deleteMessagePermanentlyDb(message.id);
      } else {
        await deleteMessageForMeDb(message.id);
      }
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
    } catch (err: any) {
      toast({ title: t("community_msg_delete_error"), description: err?.message || t("retry"), variant: "destructive" });
    }
  }, [deleteMessageConfirm, t]);

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

  // Load conversations, following users, and ranking
  React.useEffect(() => {
    const loadData = async () => {
      try {
        const [conversationsData, followingData, rankingData] = await Promise.all([
          getConversationsDb(),
          getFollowingDb(),
          getRankingDb(),
        ]);
        setConversations(conversationsData);
        setFollowers(followingData);
        setRanking(rankingData);
      } catch (err: any) {
        console.error("Error loading community data:", err);
        toast({
          title: "Erro ao carregar dados",
          description: err?.message || "Tente novamente.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Ao (re)entrar na Comunidade e ao voltar do background, relê as conversas do
  // ZERO (cache invalidado). O `loadData` acima usa `getConversationsDb` cacheado
  // (TTL 60s) para o primeiro paint instantâneo — mas quem chegou aqui vindo de
  // outra tela após receber uma mensagem via push encontrava a lista velha, sem o
  // remetente novo. Este refresh roda em paralelo, fora do gate de `loading`:
  // pinta rápido do cache e, logo em seguida, atualiza com quem acabou de mandar.
  React.useEffect(() => {
    const refreshConversations = () => {
      invalidateQueryCache("conversations");
      getConversationsDb()
        .then(setConversations)
        .catch((err) => console.error("Error refreshing conversations:", err));
    };
    refreshConversations();
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshConversations();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

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

  // Auto-select conversation from URL parameter (?user=<userId>) — runs once per param
  const convRestoredRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const userIdParam = searchParams.get("user");
    if (!userIdParam || convRestoredRef.current === userIdParam) return;
    setActiveTab("messages");
    // Try existing conversation first
    const existing = conversations.find((c) => c.userId === userIdParam);
    if (existing) {
      convRestoredRef.current = userIdParam;
      setSelectedConversation(existing);
      setViewMode("conversation");
      return;
    }
    // If no conversation yet, fetch the user's profile and open an empty conversation
    if (!loading) {
      convRestoredRef.current = userIdParam;
      getUserProfileDb(userIdParam).then((profile) => {
        if (profile) {
          const newConv: Conversation = {
            userId: userIdParam,
            userNickname: profile.nickname || "Usuário",
            userPhoto: profile.photo || null,
            lastMessage: "",
            lastMessageTime: new Date().toISOString(),
            unreadCount: 0,
          };
          setSelectedConversation(newConv);
          setViewMode("conversation");
        }
      }).catch((err: any) => {
        console.error("Error loading user profile for conversation:", err);
        toast({ title: "Erro ao abrir conversa", description: err?.message || "Tente novamente.", variant: "destructive" });
      });
    }
  }, [searchParams, conversations, loading]);

  // Hide bottom nav when inside a private conversation
  React.useEffect(() => {
    const isConversation = activeTab === "messages" && viewMode === "conversation";
    document.body.dataset.hideNav = isConversation ? "true" : "false";
    return () => { document.body.dataset.hideNav = "false"; };
  }, [viewMode, activeTab]);

  // Marca qual conversa está aberta para o handler de notificações em primeiro
  // plano (AppLayout) suprimir o banner da mensagem que o usuário já está vendo
  // chegar — nesse caso o celular só vibra. Fora da conversa, limpa (null).
  React.useEffect(() => {
    const inConversation = activeTab === "messages" && viewMode === "conversation" && selectedConversation;
    setActiveConversationUserId(inConversation ? selectedConversation.userId : null);
    return () => setActiveConversationUserId(null);
  }, [viewMode, activeTab, selectedConversation?.userId]);

  // Load conversation messages when selected
  React.useEffect(() => {
    if (!selectedConversation || viewMode !== "conversation") return;

    const targetUserId = selectedConversation.userId;
    let cancelled = false;

    // Semente: as mensagens desta conversa já vistas neste aparelho. A conversa
    // abre pintada e posicionada no fim, em vez de abrir vazia e "carregar" —
    // era isso que dava a sensação de recarregar a cada entrada. Nunca reaproveita
    // a lista da conversa anterior: ou é a semente desta, ou vazio.
    setMessages(peekConversationMessages(targetUserId) ?? []);
    isOpeningConversationRef.current = true;
    // A resposta em preparo pertence à conversa anterior — sem isto, o banner de
    // reply (e o prefixo `↩` ao enviar) vazava da conversa de X para a de Y.
    setReplyingTo(null);

    const loadMessages = async () => {
      try {
        const data = await getConversationMessagesDb(targetUserId);
        if (cancelled) return;

        // Only update state if this conversation is still the selected one
        setSelectedConversation((current) => {
          if (current?.userId !== targetUserId) return current;
          // Quando a rede confirma o que a semente já mostrava, manter o array
          // anterior: sem novo array, sem re-render da lista inteira e sem o
          // piscar de remontar todas as bolhas.
          setMessages((prev) => (sameMessageList(prev, data) ? prev : data));
          return current;
        });

        // Mark messages as read
        await markMessagesAsReadDb(targetUserId);
        if (cancelled) return;

        // Update conversation unread count
        setConversations((prev) =>
          prev.map((conv) =>
            conv.userId === targetUserId
              ? { ...conv, unreadCount: 0 }
              : conv,
          ),
        );
      } catch (err: any) {
        console.error("Error loading messages:", err);
        toast({ title: "Erro ao carregar mensagens", description: err?.message || "Tente novamente.", variant: "destructive" });
      } finally {
        // A rede assentou (ou falhou): mensagem nova daqui pra frente rola com
        // animação. `cancelled` evita que a carga de uma conversa abandonada
        // encerre a fase de abertura da conversa que o usuário abriu depois.
        if (!cancelled) {
          requestAnimationFrame(() => {
            if (!cancelled) isOpeningConversationRef.current = false;
          });
        }
      }
    };

    loadMessages();
    return () => {
      cancelled = true;
    };
  }, [selectedConversation?.userId, viewMode]);

  // Auto-scroll to the last message: instant snap while the conversation is opening
  // (semente + chegada da rede), smooth scroll for messages sent/received afterwards.
  React.useEffect(() => {
    if (messages.length === 0) return;

    const isOpening = isOpeningConversationRef.current;
    messagesEndRef.current?.scrollIntoView({ behavior: isOpening ? "auto" : "smooth" });

    if (isOpening) {
      // Images/audio players can still be loading and shift the layout after the
      // initial paint — re-snap to the bottom once they've had time to settle so
      // the conversation reliably opens on the last message.
      const timers = [150, 400].map((delay) =>
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "auto" }), delay),
      );
      return () => timers.forEach(clearTimeout);
    }
  }, [messages]);

  // Teclado iOS: ao abrir/fechar, o container encolhe/cresce (bottom = --keyboard-height)
  // e a área de mensagens muda de altura. Sem re-fixar, o scroll deixa de mostrar
  // a última mensagem. Re-snapamos no fim algumas vezes ao longo da animação do
  // teclado (~250ms) para manter a conversa colada embaixo, como o WhatsApp.
  React.useEffect(() => {
    if (viewMode !== "conversation" || !selectedConversation) return;
    let timers: ReturnType<typeof setTimeout>[] = [];
    const clear = () => { timers.forEach(clearTimeout); timers = []; };
    const unsubscribe = subscribeKeyboardHeight(() => {
      clear();
      timers = [0, 120, 280].map((delay) =>
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "auto" }), delay),
      );
    });
    return () => { clear(); unsubscribe(); };
  }, [viewMode, selectedConversation?.userId]);

  // Mantém a semente em dia com o que está na tela (enviadas, recebidas via
  // realtime, apagadas) — assim a próxima abertura pinta o estado correto.
  React.useEffect(() => {
    if (viewMode !== "conversation" || !selectedConversation || messages.length === 0) return;
    cacheConversationMessages(selectedConversation.userId, messages);
  }, [messages, selectedConversation?.userId, viewMode]);

  const handleSendMessage = React.useCallback(async () => {
    if (!messageText.trim() || !selectedConversation) return;

    const fullText = buildReplyPrefix(replyingTo) + messageText;

    setIsSending(true);
    try {
      const newMessage = await sendMessageDb(
        selectedConversation.userId,
        fullText,
      );
      setReplyingTo(null);

      if (newMessage) {
        setMessageText("");

        // Optimistic update: add message immediately to UI without waiting for realtime
        const optimisticMsg: MessageWithUser = {
          id: newMessage.id,
          user_id: newMessage.user_id,
          following_id: newMessage.following_id,
          text: newMessage.text ?? "",
          read: newMessage.read ?? 0,
          created_at: newMessage.created_at ?? new Date().toISOString(),
          emoji: newMessage.emoji ?? null,
          senderNickname: "Você",
          senderPhoto: null,
          recipientNickname: selectedConversation.userNickname || "Usuário",
          recipientPhoto: selectedConversation.userPhoto || null,
        };
        setMessages((prev) => {
          if (prev.some((m) => m.id === optimisticMsg.id)) return prev;
          return [...prev, optimisticMsg];
        });

        // Update last message in conversation list
        setConversations((prev) =>
          prev.map((conv) =>
            conv.userId === selectedConversation.userId
              ? {
                ...conv,
                lastMessage: fullText,
                lastMessageTime: new Date().toISOString(),
              }
              : conv,
          ),
        );
      }
    } catch (err: any) {
      console.error("Error sending message:", err);
      toast({
        title: "Erro ao enviar mensagem",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
      messageInputRef.current?.focus();
    }
  }, [messageText, selectedConversation, replyingTo]);

  const handlePhotoSend = React.useCallback(async (file: File) => {
    if (!selectedConversation) return;
    setIsSendingPhoto(true);
    try {
      const mediaRef = await uploadMessageImageDb(file, selectedConversation.userId);
      // Respeita a mensagem marcada como resposta: a foto vai citando-a.
      const imageText = buildReplyPrefix(replyingTo) + `[image]:${mediaRef}`;
      const newMessage = await sendMessageDb(selectedConversation.userId, imageText);
      setReplyingTo(null);
      if (newMessage) {
        const optimisticMsg: MessageWithUser = {
          id: newMessage.id,
          user_id: newMessage.user_id,
          following_id: newMessage.following_id,
          text: newMessage.text ?? "",
          read: newMessage.read ?? 0,
          created_at: newMessage.created_at ?? new Date().toISOString(),
          emoji: newMessage.emoji ?? null,
          senderNickname: "Você",
          senderPhoto: null,
          recipientNickname: selectedConversation.userNickname || "Usuário",
          recipientPhoto: selectedConversation.userPhoto || null,
        };
        setMessages((prev) => {
          if (prev.some((m) => m.id === optimisticMsg.id)) return prev;
          return [...prev, optimisticMsg];
        });
      }
    } catch (err: any) {
      toast({ title: "Erro ao enviar foto", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setIsSendingPhoto(false);
    }
  }, [selectedConversation, replyingTo]);

  const startRecording = React.useCallback(async () => {
    if (!selectedConversation || isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Prefer MP4/AAC: reproduz instantaneamente no WebView do iOS (alvo do app).
      // WebM/Opus fica só como fallback (não é reproduzível nativamente no iOS).
      const preferredTypes = [
        "audio/mp4;codecs=mp4a.40.2",
        "audio/mp4",
        "audio/aac",
        "audio/webm;codecs=opus",
        "audio/webm",
      ];
      const mimeType = preferredTypes.find((mt) => MediaRecorder.isTypeSupported(mt)) || "";
      audioMimeTypeRef.current = mimeType || "audio/mp4";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      toast({ title: "Sem acesso ao microfone", description: "Permita o uso do microfone nas configurações.", variant: "destructive" });
    }
  }, [selectedConversation, isRecording]);

  const stopRecordingAndSend = React.useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || !selectedConversation) return;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);

    recorder.stop();
    recorder.stream.getTracks().forEach((t) => t.stop());

    // Wait for final data
    await new Promise<void>((res) => { recorder.onstop = () => res(); });

    const blob = new Blob(audioChunksRef.current, { type: audioMimeTypeRef.current });
    if (blob.size < 500) return; // muito curto, ignorar

    setIsSendingPhoto(true); // reutiliza loader visual
    try {
      const mediaRef = await uploadMessageAudioDb(blob, selectedConversation.userId);
      // Respeita a mensagem marcada como resposta: o áudio vai citando-a.
      const audioText = buildReplyPrefix(replyingTo) + `[audio]:${mediaRef}`;
      const newMessage = await sendMessageDb(selectedConversation.userId, audioText);
      setReplyingTo(null);
      if (newMessage) {
        const optimisticMsg: MessageWithUser = {
          id: newMessage.id,
          user_id: newMessage.user_id,
          following_id: newMessage.following_id,
          text: newMessage.text ?? "",
          read: newMessage.read ?? 0,
          created_at: newMessage.created_at ?? new Date().toISOString(),
          emoji: newMessage.emoji ?? null,
          senderNickname: "Você",
          senderPhoto: null,
          recipientNickname: selectedConversation.userNickname || "Usuário",
          recipientPhoto: selectedConversation.userPhoto || null,
        };
        setMessages((prev) => {
          if (prev.some((m) => m.id === optimisticMsg.id)) return prev;
          return [...prev, optimisticMsg];
        });
      }
    } catch (err: any) {
      toast({ title: "Erro ao enviar áudio", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setIsSendingPhoto(false);
    }
  }, [selectedConversation, replyingTo]);

  const cancelRecording = React.useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recorder.stop();
    recorder.stream.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingSeconds(0);
  }, []);

  // Recuperação ("catch-up"): relê a conversa e MESCLA sem sacudir a tela — se
  // nada mudou, mantém o array anterior (sem re-render da lista). Usada quando o
  // canal (re)assina e quando o app volta do background: nesses intervalos o
  // websocket pode ter caído e mensagens chegado sem evento, que era exatamente
  // o que obrigava o usuário a sair da conversa e entrar de novo.
  const catchUpMessages = React.useCallback(async (targetUserId: string) => {
    try {
      const data = await getConversationMessagesDb(targetUserId);
      setSelectedConversation((current) => {
        if (current?.userId !== targetUserId) return current;
        setMessages((prev) => (sameMessageList(prev, data) ? prev : data));
        return current;
      });
      await markMessagesAsReadDb(targetUserId);
      setConversations((prev) =>
        prev.map((conv) => (conv.userId === targetUserId ? { ...conv, unreadCount: 0 } : conv)),
      );
    } catch (err) {
      console.error("Error catching up messages:", err);
    }
  }, []);

  // Realtime: append new message instead of full reload
  React.useEffect(() => {
    if (!selectedConversation || !user || !supabase) return;

    const targetUserId = selectedConversation.userId;

    // Sempre derruba o canal anterior ANTES de criar outro. Sem isto, quando o
    // efeito re-roda antes do removeChannel assíncrono terminar (ciclo de vida do
    // Capacitor no iOS), o supabase-js estoura "cannot add callbacks after
    // subscribe()" e a conversa fica sem realtime. Mesmo padrão de Notifications.tsx.
    if (conversationChannelRef.current) {
      supabase.removeChannel(conversationChannelRef.current);
      conversationChannelRef.current = null;
    }

    // Math.random() em vez de Date.now(): no iOS o efeito pode rodar duas vezes
    // dentro do mesmo milissegundo (retorno do background) e o nome colidiria.
    const channelName = `messages:${targetUserId.slice(0, 8)}:${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as any;
          const isRelevant =
            (msg.user_id === selectedConversation.userId && (msg.id_receiver === user.id || msg.following_id === user.id)) ||
            (msg.user_id === user.id && (msg.id_receiver === selectedConversation.userId || msg.following_id === selectedConversation.userId));
          if (!isRelevant) return;

          const newMsg: MessageWithUser = {
            id: msg.id,
            user_id: msg.user_id,
            following_id: msg.following_id ?? msg.id_receiver,
            text: msg.text ?? "",
            read: msg.read ?? 0,
            created_at: msg.created_at ?? new Date().toISOString(),
            emoji: msg.emoji ?? null,
            senderNickname: msg.user_id === user.id ? "Você" : (selectedConversation.userNickname || "Usuário"),
            senderPhoto: msg.user_id === user.id ? null : (selectedConversation.userPhoto || null),
            recipientNickname: msg.user_id === user.id ? (selectedConversation.userNickname || "Usuário") : "Você",
            recipientPhoto: msg.user_id === user.id ? (selectedConversation.userPhoto || null) : null,
          };

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          // Update last message preview in conversations list
          setConversations((prev) =>
            prev.map((conv) =>
              conv.userId === selectedConversation.userId
                ? { ...conv, lastMessage: msg.text ?? "", lastMessageTime: msg.created_at ?? new Date().toISOString() }
                : conv,
            ),
          );

          // Mark as read if from the other user
          if (msg.user_id === selectedConversation.userId) {
            markMessagesAsReadDb(selectedConversation.userId).catch(() => {});
          }
        },
      )
      .subscribe((status) => {
        // Dispara na primeira assinatura E a cada reassinatura após reconexão do
        // websocket — o momento exato em que pode haver mensagem perdida.
        if (status === "SUBSCRIBED") void catchUpMessages(targetUserId);
      });

    conversationChannelRef.current = channel;

    // O app pode ficar minutos em background com o socket morto; ao voltar,
    // buscamos o que chegou nesse meio-tempo sem o usuário precisar sair e entrar.
    const onVisibility = () => {
      if (document.visibilityState === "visible") void catchUpMessages(targetUserId);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (conversationChannelRef.current) {
        supabase.removeChannel(conversationChannelRef.current);
        conversationChannelRef.current = null;
      }
    };
  }, [selectedConversation?.userId, user?.id, catchUpMessages]);

  // Reload reactions whenever the group view is open and check-ins are loaded
  React.useEffect(() => {
    if (groupCheckIns.length === 0) return;
    getCheckInReactionsDb(groupCheckIns.map((c) => c.id))
      .then(setCheckInReactions)
      .catch(() => { });
  }, [groupCheckIns]);

  const handleOpenConversation = React.useCallback(
    (conversation: Conversation) => {
      setSelectedConversation(conversation);
      setViewMode("conversation");
    },
    [],
  );

  const handleBackToConversations = React.useCallback(() => {
    // If opened from a profile page (?user=), go back to that profile
    const fromUserId = searchParams.get("user");
    if (fromUserId) {
      navigate(`/usuario/${fromUserId}`);
      return;
    }
    setViewMode("conversations");
    setSelectedConversation(null);
    // Refresh conversations list so new message appears immediately
    getConversationsDb().then(setConversations).catch((err: any) => {
      console.error("Error refreshing conversations:", err);
      toast({ title: "Erro ao atualizar conversas", description: err?.message || "Tente novamente.", variant: "destructive" });
    });
  }, [searchParams, navigate]);

  if (loading) {
    return <CommunitySkeleton />;
  }

  if (activeTab === "messages" && viewMode === "conversation" && selectedConversation) {
    return ReactDOM.createPortal(
      // O container ocupa só a área ACIMA do teclado do iOS: o tracker global
      // (client/lib/keyboard.ts, Keyboard resize:'none') publica --keyboard-height
      // no <html>, e subir o `bottom` por essa altura encolhe a conversa a partir
      // de baixo — a lista rola menos e a barra de input fica logo acima do
      // teclado, em vez de ficar escondida atrás dele. transition acompanha a
      // animação do teclado. Um portal fixo não é drawer/dialog, então não herda
      // o lift automático de drawer.tsx/dialog.tsx — daí o tratamento aqui.
      <div
        className="fixed top-0 right-0 bg-background flex flex-col z-[100] overflow-hidden"
        style={{
          left: "var(--sidebar-width, 0px)",
          bottom: "var(--keyboard-height, 0px)",
          transition: "bottom 0.25s cubic-bezier(0.22,0.61,0.36,1)",
        }}
      >
        {/* Papel de parede de doodles (estilo WhatsApp). Fica fixo enquanto as
            mensagens rolam por cima. O z-index negativo mantém a camada acima do
            bg-background deste container e abaixo de todo o conteúdo em fluxo
            (header, lista e barra de input), sem precisar empilhar os irmãos. */}
        <div
          aria-hidden="true"
          className="chat-doodle-wallpaper pointer-events-none absolute inset-0 -z-10"
        />

        {/* Header */}
        <div
          className="flex-shrink-0 px-4 py-3 flex items-center gap-3"
          style={{
            paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)",
            background: "linear-gradient(rgba(255,255,255,.08),rgba(255,255,255,.03))",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            borderBottom: "1px solid rgba(255,255,255,.1)",
          }}
        >
          <button
            onClick={handleBackToConversations}
            className="text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => navigate(`/usuario/${selectedConversation.userId}`)}
            className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity text-left"
          >
            <UserAvatar
              photo={selectedConversation.userPhoto}
              nickname={selectedConversation.userNickname}
              size="md"
              className="flex-shrink-0"
            />
            <p className="text-sm font-medium truncate">
              {selectedConversation.userNickname}
            </p>
          </button>
          <UserInsignias userId={selectedConversation.userId} />
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-4 px-4 py-4">
          {/* Profile card — always shown at top of conversation */}
          <div className="flex flex-col items-center gap-3 py-6 mb-2">
            <UserAvatar
              photo={selectedConversation.userPhoto}
              nickname={selectedConversation.userNickname}
              className="w-20 h-20 ring-2 ring-border"
            />
            <p className="font-semibold text-base">{selectedConversation.userNickname}</p>
            {selectedConversation.userBio && (
              <p className="text-sm text-muted-foreground text-center max-w-xs px-4">{selectedConversation.userBio}</p>
            )}
            <button
              onClick={() => navigate(`/usuario/${selectedConversation.userId}`)}
              className="px-5 py-2 rounded-full text-sm font-medium text-white transition-colors hover:bg-white/[.1]"
              style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)" }}
            >
              {t("community_view_profile")}
            </button>
          </div>

          {messages.length > 0 ? (
            messages.map((message) => {
              const isOwn = message.user_id === user?.id;
              // Detect reply prefix: lines starting with "↩ "
              const replyMatch = message.text.match(/^↩ (.+?)\n\n([\s\S]*)$/);
              const replyQuote = replyMatch ? replyMatch[1] : null;
              const mainText = replyMatch ? replyMatch[2] : message.text;
              const flowReply = parseFlowReply(mainText);
              return (
                <div
                  key={message.id}
                  className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                >
                  <SwipeableMessageBubble
                    onReply={() => handleReplyToMessage(message)}
                    onLongPress={() => handleMessageLongPress(message)}
                  >
                    <div
                      onContextMenu={(e) => { e.preventDefault(); handleMessageLongPress(message); }}
                      className={`max-w-xs px-4 py-2.5 space-y-1 break-words select-none text-white ${isOwn ? "rounded-[20px] rounded-br-md" : "rounded-[20px] rounded-bl-md"}`}
                      style={isOwn
                        ? { background: "linear-gradient(135deg,#5b8cff,#7b3ff2)" }
                        : { background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.08)" }}
                    >
                      {replyQuote && (
                        <div className={`text-xs px-2 py-1 rounded mb-1 border-l-2 ${isOwn ? "bg-white/10 border-white/50 text-white/80" : "bg-white/10 border-white/40 text-white/70"}`}>
                          <p className="truncate">{specialMessageLabel(replyQuote, t) ?? replyQuote}</p>
                        </div>
                      )}
                      {flowReply ? (
                        <FlowReplyMessage
                          flowId={flowReply.flowId}
                          text={flowReply.text}
                          isOwn={isOwn}
                        />
                      ) : mainText.startsWith("[post]:") ? (
                        <SharedContentMessage kind="post" contentId={mainText.replace("[post]:", "").trim()} />
                      ) : mainText.startsWith("[shot]:") ? (
                        <SharedContentMessage kind="shot" contentId={mainText.replace("[shot]:", "").trim()} />
                      ) : mainText.startsWith("[image]:") ? (
                        <ChatImageMessage
                          mediaRef={mainText.slice("[image]:".length)}
                          onOpen={setImageViewerUrl}
                        />
                      ) : mainText.startsWith("[audio]:") ? (
                        <ChatAudioMessage
                          mediaRef={mainText.slice("[audio]:".length)}
                          isOwn={isOwn}
                        />
                      ) : (
                        <p className="text-sm">{mainText}</p>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`text-xs ${isOwn ? "text-white/70" : "text-white/50"}`}
                        >
                          {new Date(message.created_at).toLocaleTimeString(
                            "pt-BR",
                            { hour: "2-digit", minute: "2-digit" },
                          )}
                        </p>
                        {isOwn && (
                          <span className="text-white/70 flex-shrink-0">
                            {message.read === 1 ? (
                              <CheckCheck className="h-4 w-4" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    {message.emoji && (
                      <span
                        className={`absolute -bottom-3 ${isOwn ? "left-1" : "right-1"} text-base bg-background border border-border/60 rounded-full px-1 shadow-sm`}
                      >
                        {message.emoji}
                      </span>
                    )}
                  </SwipeableMessageBubble>
                </div>
              );
            })
          ) : (
            <div className="text-center text-white/50 text-sm">
              {t("community_no_messages_yet")}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply banner */}
        {replyingTo && (
          <div className="flex-shrink-0 px-4 py-2 flex items-center gap-2" style={{ background: "rgba(255,255,255,.05)", borderTop: "1px solid rgba(255,255,255,.08)" }}>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/50 mb-0.5">{t("community_replying")}</p>
              <p className="text-xs truncate text-white/80">
                {specialMessageLabel(replyingTo.text.replace(/^↩ .+?\n\n/, ""), t) ?? replyingTo.text.replace(/^↩ .+?\n\n/, "")}
              </p>
            </div>
            <button onClick={() => setReplyingTo(null)} className="text-white/50 hover:text-white flex-shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Input — estilo Instagram */}
        {isRecording ? (
          /* ── Modo gravação ── */
          <div
            className="flex-shrink-0 px-3.5 pt-3 flex items-center gap-2"
            style={{
              background: "linear-gradient(rgba(255,255,255,.08),rgba(255,255,255,.025))",
              backdropFilter: "blur(30px) saturate(180%)",
              WebkitBackdropFilter: "blur(30px) saturate(180%)",
              borderTop: "1px solid rgba(255,255,255,.1)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.12)",
              paddingBottom: "max(0.85rem, calc(env(safe-area-inset-bottom) - var(--keyboard-height, 0px)))",
            }}
          >
            {/* Cancelar */}
            <button
              onClick={cancelRecording}
              className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-white/70 hover:text-destructive hover:bg-white/[.1] active:scale-95 transition-all"
              style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)" }}
              title="Cancelar gravação"
            >
              <X className="h-[21px] w-[21px]" strokeWidth={1.8} />
            </button>
            {/* Indicador de gravação */}
            <div
              className="flex-1 flex items-center gap-2.5 rounded-[26px] px-5"
              style={{ minHeight: "52px", background: "rgba(255,255,255,.09)", border: "1px solid rgba(255,255,255,.13)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.08)" }}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
              <span className="text-[15px] text-white/70 flex-1">
                {t("community_recording")} {Math.floor(recordingSeconds / 60).toString().padStart(2, "0")}:{(recordingSeconds % 60).toString().padStart(2, "0")}
              </span>
            </div>
            {/* Enviar */}
            <button
              onClick={stopRecordingAndSend}
              className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white hover:opacity-90 active:scale-95 transition-all"
              style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", boxShadow: "0 8px 22px -6px rgba(123,63,242,.6), inset 0 1px 0 rgba(255,255,255,.3)" }}
              title="Enviar áudio"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div
            className="flex-shrink-0 px-3.5 pt-3 flex items-center gap-2"
            style={{
              background: "linear-gradient(rgba(255,255,255,.08),rgba(255,255,255,.025))",
              backdropFilter: "blur(30px) saturate(180%)",
              WebkitBackdropFilter: "blur(30px) saturate(180%)",
              borderTop: "1px solid rgba(255,255,255,.1)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.12)",
              paddingBottom: "max(0.85rem, calc(env(safe-area-inset-bottom) - var(--keyboard-height, 0px)))",
            }}
          >
            {/* Câmera */}
            <button
              className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/[.1] active:scale-95 transition-all"
              style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)" }}
              onClick={() => photoInputRef.current?.click()}
              disabled={isSendingPhoto}
              title="Enviar foto da câmera"
            >
              {isSendingPhoto ? (
                <div className="h-5 w-5 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera className="h-[21px] w-[21px]" strokeWidth={1.8} />
              )}
            </button>

            {/* Input de arquivo oculto */}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePhotoSend(file);
                e.target.value = "";
              }}
            />

            {/* Input de texto */}
            <div
              className="flex-1 flex items-center rounded-[26px] px-5 gap-2"
              style={{
                minHeight: "52px",
                background: "rgba(255,255,255,.09)",
                border: "1px solid rgba(255,255,255,.13)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,.08)",
              }}
            >
              <Input
                ref={messageInputRef}
                placeholder={t("community_type_message")}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className="border-0 bg-transparent p-0 h-auto text-[15px] text-white placeholder:text-white/45 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 flex-1"
              />
            </div>

            {/* Ações à direita: quando sem texto → galeria + mic; quando com texto → enviar */}
            {messageText.trim() ? (
              <button
                onClick={handleSendMessage}
                disabled={isSending}
                className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white hover:opacity-90 active:scale-95 transition-all"
                style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", boxShadow: "0 8px 22px -6px rgba(123,63,242,.6), inset 0 1px 0 rgba(255,255,255,.3)" }}
                title="Enviar mensagem"
              >
                <Send className="h-5 w-5" />
              </button>
            ) : (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Galeria */}
                <button
                  className="w-11 h-11 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/[.1] active:scale-95 transition-all"
                  style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)" }}
                  title="Enviar da galeria"
                  onClick={() => {
                    if (photoInputRef.current) {
                      photoInputRef.current.removeAttribute("capture");
                      photoInputRef.current.click();
                      setTimeout(() => photoInputRef.current?.setAttribute("capture", "environment"), 500);
                    }
                  }}
                >
                  <Image className="h-[21px] w-[21px]" strokeWidth={1.8} />
                </button>
                {/* Microfone — iniciar gravação */}
                <button
                  className="w-11 h-11 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/[.1] active:scale-95 transition-all"
                  style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)" }}
                  title="Gravar áudio"
                  onMouseDown={startRecording}
                  onTouchStart={() => { startRecording(); }}
                >
                  <Mic className="h-[21px] w-[21px]" strokeWidth={1.8} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Long-press overlay */}
        {longPressedMessage && (() => {
          const isOwnMsg = longPressedMessage.user_id === user?.id;
          const msgAgeMs = Date.now() - new Date(longPressedMessage.created_at).getTime();
          // "Apagar para todos" (hard delete) só nas próprias mensagens e dentro
          // da janela de 10 min. "Apagar para mim" (soft-delete) vale sempre,
          // inclusive nas próprias — então uma mensagem enviada oferece as duas.
          const canDeletePermanently = isOwnMsg && msgAgeMs < 10 * 60 * 1000;
          const canDeleteForMe = true;
          return (
            <div
              className="fixed inset-0 z-[100] bg-black/40 flex items-end justify-center pb-12"
              onClick={() => setLongPressedMessage(null)}
            >
              <div
                className="bg-background rounded-2xl w-full max-w-sm mx-4 overflow-hidden shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Preview da mensagem */}
                <div className="px-4 py-3 border-b border-border/60">
                  <p className="text-xs text-muted-foreground mb-1">{t("community_message_label")}</p>
                  <p className="text-sm line-clamp-2">
                    {specialMessageLabel(longPressedMessage.text.replace(/^↩ .+?\n\n/, ""), t) ?? longPressedMessage.text.replace(/^↩ .+?\n\n/, "")}
                  </p>
                </div>

                {/* Emoji rápido */}
                <div className="flex items-center justify-around px-4 py-3 border-b border-border/60">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleReactToMessage(emoji)}
                      className="text-2xl active:scale-125 transition-transform"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                {/* Ações */}
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left"
                  onClick={() => handleReplyToMessage(longPressedMessage)}
                >
                  <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">{t("community_msg_reply")}</span>
                </button>
                {canDeleteForMe && (
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left border-t border-border/40 text-destructive"
                    onClick={() => {
                      setDeleteMessageConfirm({ message: longPressedMessage, permanent: false });
                      setLongPressedMessage(null);
                    }}
                  >
                    <Trash2 className="h-5 w-5" />
                    <span className="text-sm font-medium">{t("community_msg_delete_for_me")}</span>
                  </button>
                )}
                {canDeletePermanently && (
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left border-t border-border/40 text-destructive"
                    onClick={() => {
                      setDeleteMessageConfirm({ message: longPressedMessage, permanent: true });
                      setLongPressedMessage(null);
                    }}
                  >
                    <Trash2 className="h-5 w-5" />
                    <span className="text-sm font-medium">{t("community_msg_delete_for_everyone")}</span>
                  </button>
                )}
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left border-t border-border/40"
                  onClick={() => setLongPressedMessage(null)}
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">{t("cancel")}</span>
                </button>
              </div>
            </div>
          );
        })()}

        {/* Delete Message Confirm Dialog — inside portal so it appears above the conversation view */}
        {deleteMessageConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40"
            style={{
              paddingTop: "max(1rem, env(safe-area-inset-top))",
              paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
              paddingLeft: "max(1rem, env(safe-area-inset-left))",
              paddingRight: "max(1rem, env(safe-area-inset-right))",
            }}
          >
            <div
              className="bg-background rounded-2xl w-full max-w-sm mx-4 overflow-hidden shadow-2xl pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 pt-5 pb-3">
                <p className="text-base font-semibold mb-1.5">
                  {deleteMessageConfirm.permanent ? t("community_msg_delete_for_everyone") : t("community_msg_delete_for_me")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {deleteMessageConfirm.permanent
                    ? t("community_msg_delete_for_everyone_desc")
                    : t("community_msg_delete_for_me_desc")}
                </p>
              </div>
              <div className="flex border-t border-border/60">
                <button
                  className="flex-1 py-3.5 text-sm font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
                  onClick={() => setDeleteMessageConfirm(null)}
                >
                  {t("cancel")}
                </button>
                <div className="w-px bg-border/60" />
                <button
                  className="flex-1 py-3.5 text-sm font-semibold text-destructive hover:bg-destructive/10 transition-colors"
                  onClick={handleConfirmDeleteMessage}
                >
                  {t("community_msg_delete_action")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Image Viewer — fullscreen, sem expor a URL do storage */}
        {imageViewerUrl && (
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95"
            style={{
              paddingTop: "max(1rem, env(safe-area-inset-top))",
              paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
              paddingLeft: "max(1rem, env(safe-area-inset-left))",
              paddingRight: "max(1rem, env(safe-area-inset-right))",
            }}
            onClick={() => setImageViewerUrl(null)}
          >
            <button
              onClick={() => setImageViewerUrl(null)}
              className="absolute z-10 flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              style={{
                top: "calc(env(safe-area-inset-top) + 0.5rem)",
                right: "calc(env(safe-area-inset-right) + 0.5rem)",
              }}
              aria-label={t("close")}
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={imageViewerUrl}
              alt="Imagem"
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>,
      document.body
    );
  }

  // Filter conversations and followers based on search query
  const filteredConversations = conversations.filter((conv) =>
    conv.userNickname.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredFollowers = followers.filter((follower) =>
    follower.nickname.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div
      className="w-full flex flex-col overflow-hidden"
      style={{
        // Altura fixa: o <main> compartilhado reserva ~64px de padding para a
        // pílula flutuante do header, que nesta tela fica sempre visível.
        height:
          "calc(100dvh - 64px - env(safe-area-inset-top) - 1.5rem - 4.75rem - env(safe-area-inset-bottom))",
      }}
    >
      {/* Tabs — segmented control style (igual à tela de Loja), sempre visível */}
      <div
        className="flex-shrink-0 px-4 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,.08)" }}
      >
        <div className="flex items-center gap-3">
          {/* Segmented tabs */}
          <div
            className="flex flex-1 rounded-xl overflow-hidden py-1 px-1 gap-1"
            style={{
              background: "linear-gradient(rgba(255,255,255,.07),rgba(255,255,255,.02))",
              backdropFilter: "blur(20px) saturate(160%)",
              WebkitBackdropFilter: "blur(20px) saturate(160%)",
              border: "1px solid rgba(255,255,255,.10)",
            }}
          >
            <button
              onClick={() => setActiveTab("messages")}
              className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-lg transition-colors ${activeTab === "messages" ? "bg-brand text-white" : "text-white/50 hover:text-white/80"}`}
            >
              <MessageCircle className="h-4 w-4" />
              {t("community_messages")}
            </button>
            <button
              onClick={() => setActiveTab("duels")}
              className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-lg transition-colors ${activeTab === "duels" ? "bg-brand text-white" : "text-white/50 hover:text-white/80"}`}
            >
              <Swords className="h-4 w-4" />
              {t("community_duels")}
            </button>
            <button
              onClick={() => setActiveTab("ranking")}
              className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-lg transition-colors ${activeTab === "ranking" ? "bg-brand text-white" : "text-white/50 hover:text-white/80"}`}
            >
              <BarChart2 className="h-4 w-4" />
              {t("community_ranking")}
            </button>
          </div>

          {/* Solicitações pendentes — badge compacto */}
          {(pendingInvites.length > 0 || pendingGroupRequests.length > 0) && (
            <button
              onClick={() => setActiveTab("requests")}
              aria-label={t("duels_requests_aria")}
              className={`relative p-2 rounded-lg transition-colors ${activeTab === "requests" ? "bg-brand text-white" : "text-white/50 hover:text-white/80"}`}
              style={activeTab !== "requests" ? { border: "1px solid rgba(255,255,255,.10)" } : undefined}
            >
              <Users className="h-4 w-4" />
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-white text-[10px] flex items-center justify-center ring-2 ring-background font-bold">
                {pendingInvites.length + pendingGroupRequests.length}
              </span>
            </button>
          )}

        </div>
      </div>

      {/* Messages Tab */}
      {activeTab === "messages" && (
        <>
          {/* Search Bar + Nova conversa */}
          <div className="flex-shrink-0 px-4 pt-3 pb-2 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none z-10" />
              <Input
                placeholder={t("community_search_conversation")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-full pl-9 text-white placeholder:text-white/40 focus-visible:ring-0"
                style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.10)" }}
              />
            </div>
            <button
              aria-label={t("community_new_conversation_aria")}
              onClick={() => { setIsNewConversationDrawerOpen(true); }}
              className="flex-shrink-0 p-2.5 rounded-full hover:bg-white/[.1] transition-colors"
              style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.10)" }}
            >
              <PenSquare className="h-4 w-4 text-white/70" />
            </button>
          </div>

          {/* Conversations List — LinKa Glass cards */}
          <div className="flex-1 overflow-y-auto px-3 pt-1 pb-4">
            {filteredConversations.length > 0 ? (
              <div className="flex flex-col gap-1">
                {filteredConversations.map((conversation) => (
                  <SwipeableConversationRow
                    key={conversation.userId}
                    deleteLabel={t("community_delete_conversation")}
                    onDelete={() => { setConvToDelete(conversation); setDeleteConvConfirmOpen(true); }}
                  >
                    <div
                      className="relative flex items-center gap-3 rounded-[20px] px-3 py-3 transition-colors active:bg-white/[.09]"
                      style={{ background: "rgba(255,255,255,.04)" }}
                    >
                      <button
                        onClick={() => handleOpenConversation(conversation)}
                        className="flex flex-1 items-center gap-3 min-w-0 text-left"
                      >
                        <div className="relative shrink-0">
                          <UserAvatar
                            photo={conversation.userPhoto}
                            nickname={conversation.userNickname}
                            size="lg"
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <p className={`text-sm truncate ${conversation.unreadCount > 0 ? "font-semibold text-white" : "font-medium text-white/90"}`}>
                              {conversation.userNickname}
                            </p>
                            <p className={`text-xs shrink-0 ${conversation.unreadCount > 0 ? "text-brand font-medium" : "text-white/40"}`}>
                              {formatTimeAgo(conversation.lastMessageTime)}
                            </p>
                          </div>
                          <p className={`text-sm truncate ${conversation.unreadCount > 0 ? "font-medium text-white/80" : "text-white/55"}`}>
                            {conversationPreviewText(conversation.lastMessage, t) ?? t("community_start_conversation")}
                          </p>
                        </div>
                      </button>

                      {conversation.unreadCount > 0 && (
                        <span className="flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-brand text-white text-[11px] font-bold shrink-0">
                          {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
                        </span>
                      )}
                    </div>
                  </SwipeableConversationRow>
                ))}

                {/* Separador para sugestões quando há busca */}
                {searchQuery && filteredFollowers.filter(f => !conversations.some(c => c.userId === f.id)).length > 0 && (
                  <div className="px-2 pt-4 pb-1">
                    <p className="text-xs font-semibold text-white/40 uppercase tracking-wide">{t("community_suggestions")}</p>
                  </div>
                )}
                {searchQuery && filteredFollowers.filter(f => !conversations.some(c => c.userId === f.id)).map((follower) => (
                  <button
                    key={follower.id}
                    onClick={() => { setSelectedConversation({ userId: follower.id, userNickname: follower.nickname, userPhoto: follower.photo, lastMessage: "", lastMessageTime: new Date().toISOString(), unreadCount: 0 }); setViewMode("conversation"); }}
                    className="w-full flex items-center gap-3 rounded-[20px] px-3 py-3 hover:bg-white/[.07] transition-colors text-left"
                    style={{ background: "rgba(255,255,255,.04)" }}
                  >
                    <div className="shrink-0">
                      <UserAvatar
                        photo={follower.photo}
                        nickname={follower.nickname}
                        size="lg"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/90">{follower.nickname}</p>
                      {follower.bio && <p className="text-xs text-white/50 truncate">{follower.bio}</p>}
                    </div>
                  </button>
                ))}
              </div>
            ) : filteredFollowers.length > 0 ? (
              <div className="flex flex-col gap-1">
                <div className="py-5 text-center space-y-2">
                  <MessageCircle className="h-10 w-10 mx-auto text-white/30" />
                  <p className="text-sm font-medium text-white/90">{t("community_no_conversation_yet")}</p>
                  <p className="text-xs text-white/50">{t("community_choose_someone")}</p>
                </div>
                <div className="px-2 pb-1">
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wide">{t("community_whom_you_follow")}</p>
                </div>
                {filteredFollowers.map((follower) => (
                  <button
                    key={follower.id}
                    onClick={() => { setSelectedConversation({ userId: follower.id, userNickname: follower.nickname, userPhoto: follower.photo, lastMessage: "", lastMessageTime: new Date().toISOString(), unreadCount: 0 }); setViewMode("conversation"); }}
                    className="w-full flex items-center gap-3 rounded-[20px] px-3 py-3 hover:bg-white/[.07] transition-colors text-left"
                    style={{ background: "rgba(255,255,255,.04)" }}
                  >
                    <div className="shrink-0">
                      <UserAvatar
                        photo={follower.photo}
                        nickname={follower.nickname}
                        size="lg"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/90">{follower.nickname}</p>
                      {follower.bio && <p className="text-xs text-white/50 truncate">{follower.bio}</p>}
                    </div>
                    <ChevronRight className="h-4 w-4 text-white/40 shrink-0" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-8 text-center space-y-4">
                <div className="h-16 w-16 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
                  <MessageCircle className="h-8 w-8 text-white/40" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white/90">{t("community_no_conversation")}</p>
                  <p className="text-xs text-white/50">{t("community_follow_to_message")}</p>
                </div>
                <Button onClick={() => navigate("/buscar")} className="rounded-full" size="sm">
                  {t("community_find_people")}
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Duels Tab - Full Screen Group View */}
      {selectedGroupForView && ReactDOM.createPortal(
        <div
          className="fixed top-0 right-0 bottom-0 flex flex-col z-[100]"
          style={{
            left: "var(--sidebar-width, 0px)",
            // Fundo = token da página + aura da marca pintada direto (radial-gradient,
            // nunca um div com filter: blur — design system §0.3).
            background:
              "radial-gradient(120% 70% at 50% -10%, rgba(91,140,255,.12), rgba(157,107,255,.06) 45%, transparent 70%), hsl(var(--background))",
            fontFamily: "'Manrope', sans-serif",
            // Accents da marca + superfícies translúcidas. O roxo saturado que
            // essa tela usava (#7c3aed/#a855f7) não vinha da paleta; as
            // superfícies de card agora vêm de GLASS_CARD_STYLE (vidro).
            "--surface2": "rgba(255,255,255,.08)",
            "--line": "rgba(255,255,255,.10)",
            "--muted": "rgba(255,255,255,.55)",
            "--accent": "#5b8cff",
            "--accent2": "#9d6bff",
          } as React.CSSProperties}
        >
          {/* Header: voltar · "Grupo" · espaçador */}
          <div
            className="flex-shrink-0 px-5 pb-3 flex items-center justify-between"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.9rem)" }}
          >
            <button
              onClick={() => {
                setSelectedGroupForView(null);
                setGroupCheckIns([]);
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.delete("group");
                  return next;
                }, { replace: true });
              }}
              className="h-9 w-9 rounded-[11px] flex items-center justify-center text-white transition-transform active:scale-90"
              style={GLASS_CARD_STYLE}
            >
              <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </button>
            <span className="text-[13px] font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "var(--muted)" }}>
              {t("duels_group_header")}
            </span>
            {/* Espaçador: equilibra o botão de voltar e mantém "Grupo" no centro.
                O botão de trocar a capa vive dentro do frame da capa. */}
            <span className="h-9 w-9" />
          </div>

          {/* Content */}
          <div
            ref={groupViewScrollRef}
            className="flex-1 overflow-y-auto"
            onScroll={onGroupViewScroll}
            onTouchStart={onGroupTouchStart}
            onTouchMove={onGroupTouchMove}
            onTouchEnd={onGroupTouchEnd}
          >
            {/* Pull-to-refresh indicator */}
            {(groupPullDistance > 0 || isGroupRefreshing) && (
              <div
                className="flex items-center justify-center overflow-hidden transition-all"
                style={{ height: `${isGroupRefreshing ? GROUP_PULL_THRESHOLD : groupPullDistance}px` }}
              >
                <div
                  className={`h-6 w-6 rounded-full border-2 border-t-transparent ${isGroupRefreshing ? "animate-spin" : "transition-transform"}`}
                  style={{
                    borderColor: "var(--accent)",
                    borderTopColor: "transparent",
                    transform: isGroupRefreshing ? undefined : `rotate(${(groupPullDistance / GROUP_PULL_THRESHOLD) * 360}deg)`,
                    opacity: isGroupRefreshing ? 1 : groupPullDistance / GROUP_PULL_THRESHOLD,
                  }}
                />
              </div>
            )}
            <div className="pb-24">
              {/* Hero cover card */}
              <div className="px-5 pt-1">
                <div className="relative h-[130px] rounded-[22px] overflow-hidden" style={{ background: "linear-gradient(135deg,rgba(91,140,255,.28),rgba(157,107,255,.18))", border: "1px solid rgba(255,255,255,.10)" }}>
                  {coverCropSrc ? (
                    // Modo de ajuste: enquadra no próprio hero. Sem scrim nem
                    // título por cima — o frame precisa mostrar o recorte cru,
                    // que é exatamente o que vai subir.
                    <InlineCropPreview
                      imageSrc={coverCropSrc}
                      transform={coverCropTransform}
                      onTransformChange={setCoverCropTransform}
                      containerWidthRef={coverCropWRef}
                      containerHeightRef={coverCropHRef}
                    />
                  ) : (
                    <>
                      {selectedGroupForView.photo ? (
                        <img
                          src={selectedGroupForView.photo}
                          alt={selectedGroupForView.name}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-5xl">{selectedGroupForView.icon}</div>
                      )}
                      <div className="absolute inset-0" style={{ background: "linear-gradient(to top,rgba(0,0,0,.65),rgba(0,0,0,0) 62%)" }} />
                      <h1
                        className="absolute left-[18px] right-[18px] bottom-[14px] text-[24px] font-extrabold leading-tight text-white truncate"
                        style={{ fontFamily: "'Space Grotesk', sans-serif", textShadow: "0 2px 12px rgba(0,0,0,.6)" }}
                      >
                        {selectedGroupForView.name}
                      </h1>
                    </>
                  )}

                  {/* Trocar capa — só o criador. Fica no canto da própria capa,
                      onde a ação se aplica. O scrim do card só escurece a base,
                      então este canto precisa de fundo próprio para o ícone não
                      sumir em fotos claras. */}
                  {selectedGroupForView.createdBy === user?.id && (
                    <>
                      <input
                        ref={editCoverInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          // Permite escolher o mesmo arquivo de novo depois de um erro.
                          e.target.value = "";
                          if (!file) return;
                          // Não sobe ainda: entra em modo de ajuste no hero.
                          setCoverCropTransform(DEFAULT_TRANSFORM);
                          const reader = new FileReader();
                          reader.onloadend = () => setCoverCropSrc(reader.result as string);
                          reader.readAsDataURL(file);
                        }}
                      />
                      {!coverCropSrc && (
                        <button
                          onClick={() => editCoverInputRef.current?.click()}
                          title={t("duels_group_edit_cover")}
                          aria-label={t("duels_group_edit_cover")}
                          className="absolute top-[10px] right-[10px] h-9 w-9 rounded-[11px] flex items-center justify-center text-white transition-transform active:scale-90"
                          style={{
                            background: "rgba(0,0,0,.42)",
                            backdropFilter: "blur(14px) saturate(150%)",
                            WebkitBackdropFilter: "blur(14px) saturate(150%)",
                            border: "1px solid rgba(255,255,255,.22)",
                          }}
                        >
                          <Edit3 className="h-[15px] w-[15px]" strokeWidth={2.2} />
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Ações do modo de ajuste da capa */}
                {coverCropSrc && (
                  <div className="pt-2 space-y-2">
                    <p className="text-[11px] text-center" style={{ color: "var(--muted)" }}>{t("duels_cover_crop_hint")}</p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 rounded-full bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white"
                        disabled={isSavingCover}
                        onClick={() => setCoverCropSrc(null)}
                      >
                        {t("cancel")}
                      </Button>
                      <Button
                        className="flex-1 rounded-full border-0"
                        style={GLASS_PRIMARY_BTN_STYLE}
                        disabled={isSavingCover}
                        onClick={async () => {
                          if (!selectedGroupForView || !coverCropSrc) return;
                          const groupId = selectedGroupForView.id;
                          setIsSavingCover(true);
                          try {
                            const blob = await applyTransformToBlob(
                              coverCropSrc,
                              coverCropTransform,
                              coverCropWRef.current,
                              coverCropHRef.current,
                            );
                            const photoUrl = await updateGroupPhotoDb(
                              groupId,
                              new File([blob], "cover.jpg", { type: "image/jpeg" }),
                            );
                            // Pré-carrega a URL remota antes de trocar, senão a
                            // capa pisca ao sair do modo de ajuste.
                            await new Promise<void>((resolve) => {
                              // `Image` aqui é o ícone do lucide — usar o global.
                              const img = new window.Image();
                              img.onload = () => resolve();
                              img.onerror = () => resolve();
                              img.src = photoUrl;
                            });
                            setSelectedGroupForView((prev: any) =>
                              prev && prev.id === groupId ? { ...prev, photo: photoUrl } : prev
                            );
                            setUserCreatedGroups((prev) =>
                              prev.map((g) => g.id === groupId ? { ...g, photo: photoUrl } : g)
                            );
                            setCoverCropSrc(null);
                            toast({ title: t("duels_group_cover_updated") });
                          } catch {
                            toast({ title: t("duels_group_cover_error"), variant: "destructive" });
                          } finally {
                            setIsSavingCover(false);
                          }
                        }}
                      >
                        {isSavingCover ? t("duels_group_saving") : t("duels_group_save")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Stats Section */}
              <div className="px-5 pt-[18px]">
                {(() => {
                  // Calculate scores respecting scoring type
                  const scoringType = selectedGroupForView.scoringType || "check_in_count";
                  const scoreMap: Record<string, { userName: string; score: number; dates?: Set<string> }> = {};
                  for (const c of groupCheckIns) {
                    if (!scoreMap[c.userId]) scoreMap[c.userId] = { userName: c.userName, score: 0, dates: new Set() };
                    const e = scoreMap[c.userId];
                    // For memes: skip disqualified check-ins
                    if (scoringType === "memes") {
                      const votes = checkInVotes.filter((v) => v.checkInId === c.id);
                      const dq = votes.filter((v) => v.voteType === "disqualify").length;
                      const cl = votes.filter((v) => v.voteType === "classify").length;
                      if (dq > cl && dq > 0) continue;
                      e.score += 1;
                    } else if (scoringType === "check_in_count") e.score += 1;
                    else if (scoringType === "active_days") { e.dates!.add(c.createdAt.slice(0, 10)); e.score = e.dates!.size; }
                    else if (scoringType === "hustle_points") e.score += c.volume || 0;
                    else if (scoringType === "duration") e.score += c.durationMinutes || 0;
                    else if (scoringType === "distance") e.score += c.distanceKm || 0;
                    else if (scoringType === "steps") e.score += c.steps || 0;
                    else if (scoringType === "calories") e.score += c.calories || 0;
                  }
                  const sorted = Object.entries(scoreMap).sort((a, b) => b[1].score - a[1].score);
                  const leaderStats = sorted.length > 0 ? { userId: sorted[0][0], ...sorted[0][1] } : null;
                  const userRanking = sorted.findIndex(([uid]) => uid === user?.id) + 1;

                  // Calculate days remaining
                  const daysRemaining = selectedGroupForView.endDate
                    ? Math.ceil(
                      (new Date(selectedGroupForView.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                    )
                    : null;

                  const SURFACE_CARD_STYLE = GLASS_CARD_STYLE;
                  return (
                    <div className="grid grid-cols-2 gap-[9px]">
                      {/* Your ranking — big gradient hero card */}
                      <button
                        onClick={() => setIsClassificationsOpen(true)}
                        className="row-span-2 rounded-[20px] p-[18px] flex flex-col justify-between items-start text-left min-h-[124px] active:scale-[.98] transition-transform"
                        style={{
                          ...GLASS_PRIMARY_BTN_STYLE,
                          boxShadow: "0 12px 30px -10px rgba(123,63,242,.45), inset 0 1px 0 rgba(255,255,255,.2)",
                        }}
                      >
                        <span className="text-[10.5px] font-semibold uppercase tracking-[.03em]" style={{ color: "rgba(255,255,255,.75)" }}>
                          {t("duels_group_your_ranking")}
                        </span>
                        <span className="text-[38px] font-extrabold leading-none text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                          {userRanking > 0 ? `#${userRanking}` : "–"}
                        </span>
                      </button>

                      {/* Leader */}
                      <button
                        onClick={() => setIsClassificationsOpen(true)}
                        className="rounded-[20px] px-4 py-[14px] text-left active:scale-[.98] transition-transform"
                        style={SURFACE_CARD_STYLE}
                      >
                        <div className="text-[24px] font-extrabold leading-none" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "var(--accent2)" }}>
                          {leaderStats ? Math.round(leaderStats.score) : 0}
                        </div>
                        <div className="text-[10.5px] font-semibold mt-[3px] truncate" style={{ color: "var(--muted)" }}>
                          {leaderStats?.userName ? `${leaderStats.userName} · ${t("duels_group_leader_suffix")}` : t("duels_group_leader")}
                        </div>
                      </button>

                      {/* Days remaining */}
                      <button
                        onClick={() => setIsGroupDetailsOpen(true)}
                        className="rounded-[20px] px-4 py-[14px] text-left active:scale-[.98] transition-transform"
                        style={SURFACE_CARD_STYLE}
                      >
                        <div className="text-[24px] font-extrabold leading-none" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "var(--accent2)" }}>
                          {daysRemaining !== null ? (daysRemaining > 0 ? daysRemaining : t("duels_group_ended_short")) : "–"}
                        </div>
                        <div className="text-[10.5px] font-semibold mt-[3px]" style={{ color: "var(--muted)" }}>
                          {daysRemaining !== null && daysRemaining <= 0 ? t("duels_ended") : t("duels_group_days_left")}
                        </div>
                      </button>
                    </div>
                  );
                })()}
              </div>

              {/* NÃO é um tab bar, apesar do formato segmentado: os três abrem
                  DRAWERS, ninguém troca o conteúdo da tela (o histórico abaixo é
                  sempre o mesmo). Nenhum leva destaque justamente por isso — os
                  três são atalhos equivalentes, e um deles pintado sugeriria
                  "você está aqui", que é falso. O chevron marca "abre painel". */}
              <div className="px-5 pt-5">
                <div className="flex gap-1 p-1 rounded-[15px]" style={GLASS_CARD_STYLE}>
                  <button
                    onClick={() => setIsGroupDetailsOpen(true)}
                    className="flex-1 min-w-0 flex items-center justify-center gap-0.5 py-[9px] rounded-[12px] text-[12.5px] font-semibold transition-transform active:scale-95"
                    style={{ color: "var(--muted)" }}
                  >
                    <span className="truncate">{t("duels_group_tab_details")}</span>
                    <ChevronRight className="h-3 w-3 shrink-0 opacity-60" strokeWidth={2.5} />
                  </button>
                  <button
                    onClick={() => setIsParticipantsModalOpen(true)}
                    className="flex-1 min-w-0 flex items-center justify-center gap-0.5 py-[9px] rounded-[12px] text-[12.5px] font-semibold transition-transform active:scale-95"
                    style={{ color: "var(--muted)" }}
                  >
                    <span className="truncate">{t("duels_group_tab_participants")}</span>
                    <ChevronRight className="h-3 w-3 shrink-0 opacity-60" strokeWidth={2.5} />
                  </button>
                  <button
                    onClick={() => setIsClassificationsOpen(true)}
                    className="flex-1 min-w-0 flex items-center justify-center gap-0.5 py-[9px] rounded-[12px] text-[12.5px] font-semibold transition-transform active:scale-95"
                    style={{ color: "var(--muted)" }}
                  >
                    <span className="truncate">{t("duels_group_tab_ranking_short")}</span>
                    <ChevronRight className="h-3 w-3 shrink-0 opacity-60" strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              {/* History section header */}
              <div className="px-5 pt-5 pb-1 flex items-center justify-between">
                <span className="text-[14px] font-bold text-white">{t("duels_group_history")}</span>
                <span className="text-[11.5px] font-semibold" style={{ color: "var(--muted)" }}>{t("duels_group_records").replace("{n}", String(groupCheckIns.length))}</span>
              </div>

              {/* Check-ins Tab */}
              {activeGroupViewTab === "check-ins" && (
                <div className="space-y-4 px-5 pt-1 pb-4">
                  {isLoadingCheckIns ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="animate-pulse flex gap-[11px] items-center rounded-[17px]" style={{ ...GLASS_CARD_STYLE, padding: "11px 11px 11px 13px", borderLeft: "3px solid var(--line)" }}>
                          <div className="w-10 h-10 rounded-[12px] bg-white/10 flex-none" />
                          <div className="flex-1 space-y-2">
                            <div className="h-3 bg-white/10 rounded w-1/3" />
                            <div className="h-2 bg-white/10 rounded w-1/2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : groupCheckIns.length > 0 ? (() => {
                    // Sort newest first, recorta no lote visível, então agrupa
                    // por dia — cortar antes do sort traria os dias errados.
                    const sorted = [...groupCheckIns]
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .slice(0, visibleCheckInCount);
                    const grouped: { label: string; items: typeof sorted }[] = [];
                    const seenDays = new Map<string, typeof sorted>();
                    for (const checkIn of sorted) {
                      const d = new Date(checkIn.createdAt);
                      const dayKey = d.toDateString();
                      const today = new Date();
                      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
                      const label = dayKey === today.toDateString() ? t("goals_today_label") : dayKey === yesterday.toDateString() ? t("goals_dash_yesterday") : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
                      if (!seenDays.has(dayKey)) {
                        seenDays.set(dayKey, []);
                        grouped.push({ label, items: seenDays.get(dayKey)! });
                      }
                      seenDays.get(dayKey)!.push(checkIn);
                    }
                    const remaining = groupCheckIns.length - sorted.length;
                    return (
                      <>
                        {grouped.map((group) => (
                          <div key={group.label}>
                            <p className="text-[10.5px] font-semibold mb-2 uppercase tracking-[.04em]" style={{ color: "var(--muted)" }}>{group.label}</p>
                            <div className="space-y-2">
                          {group.items.map((checkIn) => {
                            const reactions = checkInReactions[checkIn.id] ?? [];
                            const groupedReactions = CHECKIN_QUICK_EMOJIS
                              .map((emoji) => ({ emoji, count: reactions.filter((r) => r.emoji === emoji).length }))
                              .filter((g) => g.count > 0);
                            return (
                              <div
                                key={checkIn.id}
                                className={`relative ${(() => {
                                  if (selectedGroupForView?.scoringType !== "memes") return "";
                                  const votes = checkInVotes.filter((v) => v.checkInId === checkIn.id);
                                  const dq = votes.filter((v) => v.voteType === "disqualify").length;
                                  const cl = votes.filter((v) => v.voteType === "classify").length;
                                  return dq > cl && dq > 0 ? "opacity-50" : "";
                                })()}`}
                              >
                                <div
                                  className="flex items-center gap-[11px] rounded-[17px] active:opacity-80 transition-opacity cursor-pointer select-none"
                                  style={{
                                    ...GLASS_CARD_STYLE,
                                    // Faixa da marca só no check-in do próprio usuário
                                    borderLeft: `3px solid ${checkIn.userId === user?.id ? "var(--accent)" : "var(--line)"}`,
                                    padding: "11px 11px 11px 13px",
                                  }}
                                  onTouchStart={() => handleCheckInTouchStart(checkIn)}
                                  onTouchEnd={handleCheckInTouchEnd}
                                  onTouchMove={handleCheckInTouchEnd}
                                  onContextMenu={(e) => { e.preventDefault(); setLongPressedCheckIn(checkIn); }}
                                  onClick={async () => {
                                    if (longPressedCheckIn) return;
                                    setSelectedCheckInForDetail(checkIn);
                                    setCheckInComments([]);
                                    setCommentText("");
                                    setIsCheckInDetailOpen(true);
                                    setIsLoadingComments(true);
                                    const [detail, comments, reactions] = await Promise.all([
                                      getGroupCheckInDetailDb(checkIn.id),
                                      getCheckInCommentsDb(checkIn.id),
                                      getCheckInReactionsDb([checkIn.id]),
                                    ]);
                                    if (detail) setSelectedCheckInForDetail(detail);
                                    setCheckInComments(comments);
                                    setCheckInReactions((prev) => ({ ...prev, ...reactions }));
                                    setIsLoadingComments(false);
                                  }}
                                >
                                  {/* Thumbnail / avatar tile */}
                                  {checkIn.photo ? (
                                    <div className="w-10 h-10 rounded-[12px] overflow-hidden flex-none" style={{ background: "var(--surface2)" }}>
                                      <img src={checkIn.photo} alt="check-in" className="w-full h-full object-cover" />
                                    </div>
                                  ) : (
                                    <UserAvatar
                                      photo={checkIn.userPhoto}
                                      nickname={checkIn.userName}
                                      size="md"
                                      className="rounded-[12px]"
                                    />
                                  )}
                                  {/* Content */}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-bold truncate text-white">
                                      {checkIn.description || checkIn.workoutInfo}
                                    </p>
                                    <p className="text-[11px] font-medium truncate" style={{ color: "var(--muted)" }}>
                                      {checkIn.userName} · {new Date(checkIn.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  </div>
                                  {/* Muscle group count pill */}
                                  {checkIn.muscleGroups.length > 0 && (
                                    <span className="text-[10px] font-bold px-2 py-1 rounded-full flex-none leading-none" style={{ background: "rgba(157,107,255,.16)", border: "1px solid rgba(157,107,255,.28)", color: "var(--accent2)" }}>
                                      +{checkIn.muscleGroups.length}
                                    </span>
                                  )}
                                </div>
                                {/* Emoji reactions — all users */}
                                {groupedReactions.length > 0 && (
                                  <div className="flex items-center gap-1 flex-wrap pt-1 pl-16">
                                    {groupedReactions.map(({ emoji, count }) => (
                                      <button
                                        key={emoji}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setReactionViewerState({ checkInId: checkIn.id, emoji, users: [], loading: true });
                                          getCheckInReactionUsersDb(checkIn.id).then((users) => {
                                            setReactionViewerState((prev) => prev ? { ...prev, users, loading: false } : null);
                                          }).catch(() => {
                                            setReactionViewerState((prev) => prev ? { ...prev, loading: false } : null);
                                          });
                                        }}
                                        className="flex items-center gap-0.5 px-2 py-1 rounded-full text-xs leading-none active:opacity-70 transition-opacity text-white/80"
                                        style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}
                                      >
                                        {emoji} {count > 1 && <span className="font-medium">{count}</span>}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                {/* Memes — evaluation bar, visually separated from emoji reactions */}
                                {selectedGroupForView?.scoringType === "memes" && (() => {
                                  const votes = checkInVotes.filter((v) => v.checkInId === checkIn.id);
                                  const classifyCount = votes.filter((v) => v.voteType === "classify").length;
                                  const disqualifyCount = votes.filter((v) => v.voteType === "disqualify").length;
                                  const userVote = votes.find((v) => v.userId === user?.id)?.voteType ?? null;
                                  const disqualified = disqualifyCount > classifyCount && disqualifyCount > 0;
                                  const isOwn = checkIn.userId === user?.id;
                                  // Quem postou não avalia o próprio check-in: só acompanha.
                                  // Anulado já é dito pelo selo à direita — não cabe "pendente" junto.
                                  const label = isOwn
                                    ? (disqualified ? null : `⏳ ${t("duels_group_pending_review")}`)
                                    : `🎭 ${t("duels_group_evaluate")}`;
                                  return (
                                    <div className="ml-16 mt-1.5 flex items-center gap-2 pt-1.5" style={{ borderTop: "1px solid var(--line)" }}>
                                      {label && (
                                        <span className="text-[10px] font-medium shrink-0 tracking-wide" style={{ color: "var(--muted)" }}>{label}</span>
                                      )}
                                      <div className="flex items-center gap-1.5 flex-1">
                                        {!isOwn ? (
                                          <>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const next: DuelCheckInVoteType | null = userVote === "classify" ? null : "classify";
                                                setCheckInVotes((prev) => {
                                                  const filtered = prev.filter((v) => !(v.checkInId === checkIn.id && v.userId === user!.id));
                                                  return next ? [...filtered, { checkInId: checkIn.id, userId: user!.id, voteType: next }] : filtered;
                                                });
                                                setCheckInVoteDb(checkIn.id, next).catch(() => {
                                                  getCheckInVotesDb(selectedGroupForView.id).then(setCheckInVotes).catch(() => {});
                                                });
                                              }}
                                              aria-label="Classificar check-in"
                                              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition-colors min-h-[28px] ${userVote === "classify" ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400" : "bg-transparent border-border/40 text-muted-foreground hover:border-emerald-500/40 hover:text-emerald-600"}`}
                                            >
                                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                              {classifyCount > 0 && <span>{classifyCount}</span>}
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const next: DuelCheckInVoteType | null = userVote === "disqualify" ? null : "disqualify";
                                                setCheckInVotes((prev) => {
                                                  const filtered = prev.filter((v) => !(v.checkInId === checkIn.id && v.userId === user!.id));
                                                  return next ? [...filtered, { checkInId: checkIn.id, userId: user!.id, voteType: next }] : filtered;
                                                });
                                                setCheckInVoteDb(checkIn.id, next).catch(() => {
                                                  getCheckInVotesDb(selectedGroupForView.id).then(setCheckInVotes).catch(() => {});
                                                });
                                              }}
                                              aria-label="Desclassificar check-in"
                                              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition-colors min-h-[28px] ${userVote === "disqualify" ? "bg-destructive/15 border-destructive/40 text-destructive" : "bg-transparent border-border/40 text-muted-foreground hover:border-destructive/40 hover:text-destructive"}`}
                                            >
                                              <XCircle className="h-3.5 w-3.5 shrink-0" />
                                              {disqualifyCount > 0 && <span>{disqualifyCount}</span>}
                                            </button>
                                          </>
                                        ) : (classifyCount > 0 || disqualifyCount > 0) ? (
                                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" />{classifyCount}</span>
                                            <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-destructive" />{disqualifyCount}</span>
                                          </div>
                                        ) : null}
                                      </div>
                                      {disqualified && (
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-destructive bg-destructive/10 border border-destructive/20 px-1.5 py-0.5 rounded shrink-0">
                                          {t("duels_group_annulled")}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            );
                              })}
                            </div>
                          </div>
                        ))}
                        {remaining > 0 && (
                          <p className="text-[11.5px] font-medium text-center py-3" style={{ color: "var(--muted)" }}>
                            {t("duels_group_more_records").replace("{n}", String(remaining))}
                          </p>
                        )}
                      </>
                    );
                  })() : (
                    <p className="text-sm text-center py-8" style={{ color: "var(--muted)" }}>{t("duels_group_no_checkins")}</p>
                  )}

                </div>
              )}

            </div>
          </div>

          {/* Centered Add Check-in Button at Bottom */}
          {(() => {
            const isGroupExpired = selectedGroupForView?.endDate
              ? new Date(selectedGroupForView.endDate) <= new Date()
              : false;
            return (
              <div className="fixed right-[18px] z-[101]" style={{ bottom: "calc(20px + env(safe-area-inset-bottom))" }}>
                <button
                  disabled={isGroupExpired}
                  onClick={() => {
                    if (!user?.id || isGroupExpired) return;
                    // Open modal immediately — load routines in background
                    setSelectedRoutineKey(null);
                    setCheckInForm({ photo: "", photos: [], description: "", workoutId: "" });
                    setCheckInPhotoFiles([]);
                    setCheckInPhotoPreviewUrls([]);
                    setCompletedRoutines([]);
                    setIsAddCheckInModalOpen(true);
                    setIsLoadingRoutines(true);
                    getRecentCompletedRoutinesDb(user.id)
                      .then(setCompletedRoutines)
                      .catch((err: any) => { console.error("Error loading completed routines:", err); })
                      .finally(() => setIsLoadingRoutines(false));
                  }}
                  className="flex items-center gap-[7px] rounded-full text-white transition-transform active:scale-95"
                  style={
                    isGroupExpired
                      ? { padding: "13px 20px", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.1)", color: "rgba(255,255,255,.35)", cursor: "not-allowed" }
                      : { padding: "13px 20px", ...GLASS_PRIMARY_BTN_STYLE, boxShadow: "0 12px 26px -6px rgba(123,63,242,.5), inset 0 1px 0 rgba(255,255,255,.3)" }
                  }
                  title={isGroupExpired ? t("duels_ended") : t("duels_checkin_today")}
                >
                  <Plus className="h-4 w-4" strokeWidth={2.6} />
                  <span className="text-[13px] font-bold">{t("duels_group_checkin_btn")}</span>
                </button>
              </div>
            );
          })()}

          {/* Check-in Emoji Long-Press Overlay */}
          {longPressedCheckIn && (
            <div
              className="fixed inset-0 z-[100] bg-black/40 flex items-end justify-center pb-12"
              onClick={() => setLongPressedCheckIn(null)}
            >
              <div
                className="rounded-[28px] w-full max-w-sm mx-4 overflow-hidden"
                style={{
                  background: "linear-gradient(rgba(30,28,40,.92),rgba(14,13,20,.97))",
                  backdropFilter: "blur(40px) saturate(180%)",
                  WebkitBackdropFilter: "blur(40px) saturate(180%)",
                  border: "1px solid rgba(255,255,255,.12)",
                  boxShadow: "0 24px 60px -12px rgba(0,0,0,.7)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Preview */}
                <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,.08)" }}>
                  <p className="text-xs mb-0.5" style={{ color: "rgba(255,255,255,.5)" }}>{t("duels_group_checkin_of").replace("{name}", longPressedCheckIn.userName)}</p>
                  <p className="text-sm line-clamp-2 font-medium text-white/90">{longPressedCheckIn.description || longPressedCheckIn.workoutInfo}</p>
                </div>

                {/* Emoji rápido */}
                <div className="flex items-center justify-around px-4 py-3">
                  {CHECKIN_QUICK_EMOJIS.map((emoji) => {
                    const reactions = checkInReactions[longPressedCheckIn.id] ?? [];
                    const myReaction = reactions.find((r) => r.userId === user?.id);
                    const isActive = myReaction?.emoji === emoji;
                    return (
                      <button
                        key={emoji}
                        onClick={async () => {
                          const newEmoji = isActive ? null : emoji;
                          const checkInId = longPressedCheckIn.id;
                          const checkInOwnerId = longPressedCheckIn.userId;
                          setLongPressedCheckIn(null);
                          // Optimistic update
                          setCheckInReactions((prev) => {
                            const current = (prev[checkInId] ?? []).filter((r) => r.userId !== user?.id);
                            if (newEmoji) current.push({ checkInId, userId: user!.id, emoji: newEmoji });
                            return { ...prev, [checkInId]: current };
                          });
                          await setCheckInReactionDb(checkInId, newEmoji);
                          // Notify check-in owner when adding a reaction (not removing)
                          if (newEmoji && checkInOwnerId) {
                            sendCheckInReactionNotificationDb(checkInId, checkInOwnerId).catch(() => { });
                          }
                          // Reload from DB so reactions from all users are up to date
                          getCheckInReactionsDb([checkInId]).then((fresh) => {
                            setCheckInReactions((prev) => ({ ...prev, ...fresh }));
                          }).catch(() => { });
                        }}
                        className={`text-2xl active:scale-125 transition-transform relative ${isActive ? "scale-110" : ""}`}
                      >
                        {emoji}
                        {isActive && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: "var(--accent2)" }} />}
                      </button>
                    );
                  })}
                </div>

                {/* Cancelar */}
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors text-left text-white/80 hover:bg-white/[.06]"
                  style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}
                  onClick={() => setLongPressedCheckIn(null)}
                >
                  <X className="h-5 w-5 text-white/60" />
                  <span className="text-sm font-medium">{t("duels_group_cancel")}</span>
                </button>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Duels Tab */}
      {activeTab === "duels" && !selectedGroupForView && (
        <>
          <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4 space-y-5 min-h-0">

            {/* CTA: Criar um duelo */}
            <button
              onClick={() => {
                if (duelGateBlocked) {
                  setDuelPaywallOpen(true);
                  return;
                }
                setGroupStep(1);
                setGroupConfig({ name: "", location: "", goal: "", durationDays: "", photo: "", scoringType: "check_in_count", memeRule: "" });
                setGroupCoverTransform(DEFAULT_TRANSFORM);
                setSelectedInvitees(new Set());
                setIsCreateGroupModalOpen(true);
              }}
              className="w-full flex items-center gap-3 rounded-[20px] p-3.5 text-left active:opacity-80 transition-opacity"
              style={{
                background: "linear-gradient(135deg,rgba(91,140,255,.18),rgba(157,107,255,.1))",
                border: "1px solid rgba(123,99,242,.32)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,.14)",
              }}
            >
              <span
                className="w-[46px] h-[46px] rounded-[14px] flex-shrink-0 flex items-center justify-center text-white"
                style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", boxShadow: "0 6px 16px -4px rgba(123,63,242,.5)" }}
              >
                <Plus className="h-6 w-6" />
              </span>
              <div className="flex-1">
                <div className="text-[15px] font-bold text-white">{t("duels_create")}</div>
                <div className="text-[11.5px] mt-0.5" style={{ color: "rgba(255,255,255,.6)" }}>{t("duels_create_subtitle")}</div>
              </div>
              <ChevronRight className="h-5 w-5 flex-shrink-0" style={{ color: "rgba(255,255,255,.45)" }} />
            </button>

            {/* Meus grupos ativos */}
            {userCreatedGroups.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-bold text-white">{t("duels_my_groups")}</span>
                  <span className="text-[12px] font-semibold" style={{ color: "rgba(255,255,255,.45)" }}>{userCreatedGroups.length}</span>
                </div>

                {/* Todos os grupos — card expande/colapsa in-place ao clicar */}
                {userCreatedGroups.map((group, i) => {
                  const isActive = i === Math.min(activeGroupIndex, userCreatedGroups.length - 1);
                  const daysRemaining = group.endDate
                    ? Math.ceil((new Date(group.endDate).getTime() - Date.now()) / 86400000)
                    : null;
                  return (
                    <div
                      key={group.id}
                      onClick={!isActive ? () => setActiveGroupIndex(i) : undefined}
                      style={{
                        borderRadius: 24,
                        overflow: "hidden",
                        cursor: isActive ? "default" : "pointer",
                        WebkitTapHighlightColor: "transparent",
                        transition: "background 0.35s ease, border-color 0.35s ease",
                        background: isActive
                          ? "linear-gradient(rgba(255,255,255,.07),rgba(255,255,255,.03))"
                          : "rgba(255,255,255,.04)",
                        border: isActive
                          ? "1px solid rgba(255,255,255,.09)"
                          : "1px solid rgba(255,255,255,.08)",
                      }}
                    >
                      {/* Banner — aparece com animação de altura */}
                      <div
                        style={{
                          height: isActive ? 110 : 0,
                          overflow: "hidden",
                          position: "relative",
                          transition: "height 0.38s cubic-bezier(0.4,0,0.2,1)",
                          flexShrink: 0,
                        }}
                      >
                        {group.photo ? (
                          <ImageWithFallback src={group.photo} alt={group.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full" style={{ background: "radial-gradient(circle at 40% 35%,#ffd07a,#ff7a3c 80%)" }} />
                        )}
                        <span
                          style={{ position: "absolute", top: 10, left: 10, padding: "5px 11px", borderRadius: 13, fontSize: 11, fontWeight: 700, color: "#0a0b12", background: "#fff" }}
                        >
                          {group.createdBy === user?.id ? t("duels_your_group") : t("duels_participant")}
                        </span>
                        {daysRemaining !== null && (
                          <span
                            style={{ position: "absolute", top: 10, right: 10, display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 13, fontSize: 11, fontWeight: 700, color: "#fff", background: "rgba(0,0,0,.35)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
                          >
                            ⏳ {daysRemaining > 0 ? `${daysRemaining} ${t("duels_days_remaining")}` : t("duels_ended")}
                          </span>
                        )}
                      </div>

                      {/* Linha de corpo — thumbnail some quando o banner abre */}
                      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 14 }}>
                        {/* Thumbnail (visível só quando colapsado) */}
                        <div
                          style={{
                            width: isActive ? 0 : 50,
                            height: isActive ? 0 : 50,
                            flexShrink: 0,
                            borderRadius: 16,
                            overflow: "hidden",
                            opacity: isActive ? 0 : 1,
                            transition: "width 0.32s cubic-bezier(0.4,0,0.2,1), height 0.32s cubic-bezier(0.4,0,0.2,1), opacity 0.22s ease",
                          }}
                        >
                          {group.photo ? (
                            <ImageWithFallback src={group.photo} alt={group.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[22px]" style={{ background: "rgba(255,255,255,.1)" }}>
                              {group.icon}
                            </div>
                          )}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: isActive ? 15.5 : 14,
                              fontWeight: 700,
                              color: "#fff",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              transition: "font-size 0.3s ease",
                            }}
                          >
                            {group.name}
                          </div>
                          <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.55)", marginTop: 2 }}>
                            {group.participants} participantes · {group.city}
                            {!isActive && daysRemaining !== null && ` · ${daysRemaining > 0 ? `${daysRemaining}d` : t("duels_ended")}`}
                          </div>
                        </div>

                        {/* Chevron (visível só quando colapsado) */}
                        <ChevronRight
                          className="flex-shrink-0"
                          style={{
                            width: 20,
                            height: 20,
                            color: "rgba(255,255,255,.4)",
                            opacity: isActive ? 0 : 1,
                            transition: "opacity 0.2s ease",
                          }}
                        />
                      </div>

                      {/* Botão check-in — expande junto com o banner */}
                      <div
                        style={{
                          maxHeight: isActive ? 70 : 0,
                          overflow: "hidden",
                          paddingLeft: 14,
                          paddingRight: 14,
                          transition: "max-height 0.38s cubic-bezier(0.4,0,0.2,1), padding-bottom 0.38s ease",
                          paddingBottom: isActive ? 14 : 0,
                        }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openGroupView(group);
                          }}
                          style={{
                            width: "100%",
                            height: 42,
                            borderRadius: 21,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            fontSize: 14,
                            fontWeight: 600,
                            color: "#0a0b12",
                            background: "linear-gradient(rgba(255,255,255,.95),rgba(255,255,255,.82))",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          {t("duels_view")}
                          <ChevronRight className="h-[17px] w-[17px]" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Da comunidade */}
            {availableGroups.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-bold text-white">{t("duels_community_groups")}</span>
                  <span className="text-[12px] font-semibold" style={{ color: "#9d6bff" }}>{availableGroups.length}</span>
                </div>

                {availableGroups.map((group) => (
                  <div
                    key={group.id}
                    className="flex items-center gap-3 p-3.5 rounded-[22px]"
                    style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}
                  >
                    <div className="w-[50px] h-[50px] rounded-[16px] flex-shrink-0 overflow-hidden">
                      {group.photo ? (
                        <ImageWithFallback src={group.photo} alt={group.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[22px]" style={{ background: "rgba(255,255,255,.1)" }}>
                          {group.icon}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold text-white truncate">{group.name}</div>
                      <div className="text-[11.5px]" style={{ color: "rgba(255,255,255,.5)" }}>
                        {group.participants} participantes · por {group.creatorNickname}
                      </div>
                    </div>
                    {group.isPending ? (
                      <span
                        className="text-[12px] font-semibold shrink-0 px-3.5 py-1.5 rounded-[14px]"
                        style={{ color: "rgba(255,255,255,.5)", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)" }}
                      >
                        ⏳ {t("duels_pending")}
                      </span>
                    ) : joinedGroupIds.has(group.id) ? (
                      <button
                        onClick={() => openGroupView(group)}
                        className="text-[12px] font-semibold shrink-0 px-3.5 py-1.5 rounded-[14px] active:opacity-80 transition-opacity"
                        style={{ color: "#fff", background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.14)" }}
                      >
                        {t("duels_view")}
                      </button>
                    ) : (
                      <button
                        disabled={joiningGroupId === group.id}
                        onClick={async () => {
                          if (!user) return;
                          setJoiningGroupId(group.id);
                          try {
                            await addMembersToGroupDb(group.id, [user.id]);
                            if (group.createdBy) {
                              await sendGroupJoinRequestNotificationDb(group.id, group.createdBy);
                            }
                            setAvailableGroups((prev) =>
                              prev.map((g) => g.id === group.id ? { ...g, isPending: true } : g)
                            );
                            toast({ title: t("duels_request_sent_title"), description: t("duels_request_sent_desc") });
                          } catch (err: any) {
                            console.error("Error joining group:", err);
                          } finally {
                            setJoiningGroupId(null);
                          }
                        }}
                        className="text-[12px] font-semibold shrink-0 px-3.5 py-1.5 rounded-[14px] disabled:opacity-50 active:opacity-80 transition-opacity"
                        style={{ color: "#fff", background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.14)" }}
                      >
                        {joiningGroupId === group.id ? "..." : t("duels_join")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {userCreatedGroups.length === 0 && availableGroups.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                <div className="h-16 w-16 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,.05)" }}>
                  <Swords className="h-8 w-8" style={{ color: "rgba(255,255,255,.2)" }} />
                </div>
                <p className="text-sm font-semibold text-white">{t("duels_empty")}</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,.4)" }}>{t("duels_empty_desc")}</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Ranking Tab */}
      {activeTab === "ranking" && (
        <RankingTab
          ranking={ranking}
          followers={followers}
          currentUserId={user?.id}
        />
      )}

      {/* Solicitações (Pending Invites + Group Join Requests) Tab */}
      {activeTab === "requests" && (
        <>
          <div className="flex-shrink-0 px-4 pt-4 pb-0">
            <h1 className="text-2xl font-bold tracking-tight">{t("duels_requests_title")}</h1>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4 space-y-3">

            {/* Convites recebidos pelo usuário */}
            {pendingInvites.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-2">{t("duels_requests_invites_section")}</p>
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.groupId}
                    className="rounded-xl p-4 mb-3"
                    style={{
                      background: "linear-gradient(rgba(255,255,255,.09),rgba(255,255,255,.03))",
                      backdropFilter: "blur(20px) saturate(160%)",
                      WebkitBackdropFilter: "blur(20px) saturate(160%)",
                      border: "1px solid rgba(255,255,255,.10)",
                    }}
                  >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">⚔️</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{invite.groupName}</p>
                          <p className="text-xs text-white/50 truncate">{invite.groupGoal}</p>
                          <p className="text-xs text-white/50">{invite.groupLocation}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          className="flex-1 rounded-full text-xs h-11"
                          onClick={async () => {
                            try {
                              await acceptGroupInviteDb(invite.groupId);
                              const updated = pendingInvites.filter((i) => i.groupId !== invite.groupId);
                              setPendingInvites(updated);
                              toast({
                                title: t("duels_requests_invite_accepted_title"),
                                description: t("duels_requests_invite_accepted_desc").replace("{group}", invite.groupName),
                              });

                              // Navigate directly to the group detail view (open instantly)
                              const group = await getDuelGroupDb(invite.groupId);
                              if (group) {
                                setActiveTab("duels");
                                openGroupView(group);
                              }
                            } catch (err: any) {
                              toast({ title: t("error"), description: err?.message || t("retry"), variant: "destructive" });
                            }
                          }}
                        >
                          {t("duels_requests_accept")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 rounded-full text-xs h-11"
                          onClick={async () => {
                            try {
                              await declineGroupInviteDb(invite.groupId);
                              const updated = pendingInvites.filter((i) => i.groupId !== invite.groupId);
                              setPendingInvites(updated);
                              // Refresh groups so duels tab reflects the declined invite
                              void loadGroupsAndRequests({ fresh: true });
                              if (updated.length === 0 && pendingGroupRequests.length === 0) setActiveTab("duels");
                              toast({ title: t("duels_requests_invite_declined") });
                            } catch (err: any) {
                              toast({ title: t("error"), description: err?.message || t("retry"), variant: "destructive" });
                            }
                          }}
                        >
                          {t("duels_requests_decline")}
                        </Button>
                      </div>
                  </div>
                ))}
              </div>
            )}

            {/* Solicitações de entrada nos grupos do usuário (dono) */}
            {pendingGroupRequests.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-2">{t("duels_requests_joins_section")}</p>
                {pendingGroupRequests.map((req) => (
                  <div
                    key={`${req.groupId}-${req.userId}`}
                    className="rounded-xl p-4 mb-3"
                    style={{
                      background: "linear-gradient(rgba(255,255,255,.09),rgba(255,255,255,.03))",
                      backdropFilter: "blur(20px) saturate(160%)",
                      WebkitBackdropFilter: "blur(20px) saturate(160%)",
                      border: "1px solid rgba(255,255,255,.10)",
                    }}
                  >
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          photo={req.userPhoto}
                          nickname={req.userNickname}
                          size="md"
                          className="flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{req.userNickname}</p>
                          <p className="text-xs text-white/50 truncate">{t("duels_requests_wants_to_join")} <span className="font-medium">{req.groupName}</span></p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Users className="h-3 w-3 text-white/40" />
                            <span className="text-xs text-white/40">
                              {t(req.participants === 1 ? "duels_requests_participants_one" : "duels_requests_participants").replace("{n}", String(req.participants))}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          className="flex-1 rounded-full text-xs h-11"
                          onClick={async () => {
                            try {
                              await approveGroupRequestDb(req.groupId, req.userId);
                              setPendingGroupRequests((prev) => prev.filter((r) => !(r.groupId === req.groupId && r.userId === req.userId)));
                              toast({
                                title: t("duels_requests_approved_title"),
                                description: t("duels_requests_approved_desc")
                                  .replace("{name}", req.userNickname)
                                  .replace("{group}", req.groupName),
                              });
                            } catch (err: any) {
                              toast({ title: t("error"), description: err?.message || t("retry"), variant: "destructive" });
                            }
                          }}
                        >
                          {t("duels_requests_approve")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 rounded-full text-xs h-11"
                          onClick={async () => {
                            try {
                              await rejectGroupRequestDb(req.groupId, req.userId);
                              setPendingGroupRequests((prev) => prev.filter((r) => !(r.groupId === req.groupId && r.userId === req.userId)));
                              toast({ title: t("duels_requests_rejected") });
                            } catch (err: any) {
                              toast({ title: t("error"), description: err?.message || t("retry"), variant: "destructive" });
                            }
                          }}
                        >
                          {t("duels_requests_decline")}
                        </Button>
                      </div>
                  </div>
                ))}
              </div>
            )}

            {pendingInvites.length === 0 && pendingGroupRequests.length === 0 && (
              <p className="text-sm text-white/40 text-center py-8">{t("duels_requests_empty")}</p>
            )}
          </div>
        </>
      )}

      {/* Create Group Drawer */}
      <Drawer
        open={isCreateGroupModalOpen}
        onOpenChange={(open) => {
          setIsCreateGroupModalOpen(open);
          if (!open) {
            // Reset form when closing
            setGroupConfig({
              name: "",
              location: "",
              goal: "",
              durationDays: "",
              photo: "",
              scoringType: "check_in_count",
              memeRule: "",
            });
            setGroupPhotoFile(null);
            setSelectedInvitees(new Set());
            setGroupStep(1);
            setParticipantsSearch("");
          }
        }}
      >
        <DrawerContent
          {...GLASS_SHEET_PROPS}
          style={GLASS_SHEET_STYLE}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DrawerHeader className="shrink-0">
            {/* Progress indicator */}
            <div className="flex items-center gap-2 mb-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${s <= groupStep ? "bg-brand" : ""}`}
                  style={s <= groupStep ? undefined : { background: "rgba(255,255,255,.12)" }}
                />
              ))}
            </div>
            <DrawerTitle className="text-white">{t(`duels_wizard_step${groupStep}_title`)}</DrawerTitle>
            <DrawerDescription className="sr-only">{t("duels_wizard_sr_desc")}</DrawerDescription>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,.5)" }}>
              {t(`duels_wizard_step${groupStep}_subtitle`)}
            </p>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {/* Step 1 — Nome, Meta e Foto */}
            {groupStep === 1 && (
              <div className="space-y-4">
                {/* Group Photo */}
                <div className="space-y-2">
                  <label className={GLASS_LABEL_CLASS}>{t("duels_wizard_cover_label")}</label>
                  <div className="relative w-full h-36 rounded-xl overflow-hidden flex items-center justify-center" style={GLASS_PANEL_STYLE}>
                    {groupConfig.photo ? (
                      <>
                        {/* Enquadra no próprio frame: o que se vê aqui é o que
                            sobe, porque o recorte usa estas mesmas medidas. */}
                        <InlineCropPreview
                          imageSrc={groupConfig.photo}
                          transform={groupCoverTransform}
                          onTransformChange={setGroupCoverTransform}
                          containerWidthRef={groupCoverWRef}
                          containerHeightRef={groupCoverHRef}
                        />
                        <button
                          onClick={() => {
                            setGroupConfig({ ...groupConfig, photo: "" });
                            setGroupPhotoFile(null);
                            setGroupCoverTransform(DEFAULT_TRANSFORM);
                          }}
                          className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      // `absolute inset-0`: o label preenche o frame todo, então
                      // qualquer ponto da capa abre o seletor — antes só o
                      // retângulo do ícone+texto, centralizado pelo pai, era
                      // clicável.
                      <label className="absolute inset-0 cursor-pointer flex flex-col items-center justify-center gap-2 text-white/50 active:opacity-70 transition-opacity">
                        <span className="text-3xl">📷</span>
                        <span className="text-xs">{t("duels_wizard_cover_add")}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setGroupPhotoFile(file);
                              setGroupCoverTransform(DEFAULT_TRANSFORM);
                              const reader = new FileReader();
                              reader.onloadend = () => setGroupConfig({ ...groupConfig, photo: reader.result as string });
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                  {groupConfig.photo && (
                    <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>{t("duels_cover_crop_hint")}</p>
                  )}
                </div>

                {/* Group Name */}
                <div className="space-y-2">
                  <label className={GLASS_LABEL_CLASS}>{t("duels_wizard_name_label")}</label>
                  <Input
                    value={groupConfig.name}
                    onChange={(e) => setGroupConfig({ ...groupConfig, name: e.target.value })}
                    placeholder={t("duels_wizard_name_placeholder")}
                    className={GLASS_FIELD_CLASS}
                    style={GLASS_FIELD_STYLE}
                  />
                </div>

                {/* Goal — opcional; a coluna `goal` é NOT NULL, então vazio grava "" */}
                <div className="space-y-2">
                  <label className={GLASS_LABEL_CLASS}>{t("duels_wizard_goal_label")}</label>
                  <Textarea
                    value={groupConfig.goal}
                    onChange={(e) => setGroupConfig({ ...groupConfig, goal: e.target.value })}
                    placeholder={t("duels_wizard_goal_placeholder")}
                    className={`min-h-20 ${GLASS_FIELD_CLASS}`}
                    style={GLASS_FIELD_STYLE}
                  />
                </div>

                <Button
                  onClick={() => {
                    if (groupConfig.name.trim()) {
                      setGroupStep(2);
                    } else {
                      toast({ title: t("duels_wizard_required_title"), description: t("duels_wizard_name_required"), variant: "destructive" });
                    }
                  }}
                  className="w-full rounded-full mt-4 border-0"
                  style={GLASS_PRIMARY_BTN_STYLE}
                >
                  {t("duels_wizard_next")}
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}

            {/* Step 2 — UF */}
            {groupStep === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className={GLASS_LABEL_CLASS}>{t("duels_wizard_state_label")}</label>
                  <Select value={groupConfig.location} onValueChange={(value) => setGroupConfig({ ...groupConfig, location: value })}>
                    <SelectTrigger className={`rounded-lg ${GLASS_FIELD_CLASS}`} style={GLASS_FIELD_STYLE}>
                      <SelectValue placeholder={t("duels_wizard_state_placeholder")} />
                    </SelectTrigger>
                    <SelectContent className="z-[500]">
                      <SelectItem value="AC">Acre (AC)</SelectItem>
                      <SelectItem value="AL">Alagoas (AL)</SelectItem>
                      <SelectItem value="AP">Amapá (AP)</SelectItem>
                      <SelectItem value="AM">Amazonas (AM)</SelectItem>
                      <SelectItem value="BA">Bahia (BA)</SelectItem>
                      <SelectItem value="CE">Ceará (CE)</SelectItem>
                      <SelectItem value="DF">Distrito Federal (DF)</SelectItem>
                      <SelectItem value="ES">Espírito Santo (ES)</SelectItem>
                      <SelectItem value="GO">Goiás (GO)</SelectItem>
                      <SelectItem value="MA">Maranhão (MA)</SelectItem>
                      <SelectItem value="MT">Mato Grosso (MT)</SelectItem>
                      <SelectItem value="MS">Mato Grosso do Sul (MS)</SelectItem>
                      <SelectItem value="MG">Minas Gerais (MG)</SelectItem>
                      <SelectItem value="PA">Pará (PA)</SelectItem>
                      <SelectItem value="PB">Paraíba (PB)</SelectItem>
                      <SelectItem value="PR">Paraná (PR)</SelectItem>
                      <SelectItem value="PE">Pernambuco (PE)</SelectItem>
                      <SelectItem value="PI">Piauí (PI)</SelectItem>
                      <SelectItem value="RJ">Rio de Janeiro (RJ)</SelectItem>
                      <SelectItem value="RN">Rio Grande do Norte (RN)</SelectItem>
                      <SelectItem value="RS">Rio Grande do Sul (RS)</SelectItem>
                      <SelectItem value="RO">Rondônia (RO)</SelectItem>
                      <SelectItem value="RR">Roraima (RR)</SelectItem>
                      <SelectItem value="SC">Santa Catarina (SC)</SelectItem>
                      <SelectItem value="SP">São Paulo (SP)</SelectItem>
                      <SelectItem value="SE">Sergipe (SE)</SelectItem>
                      <SelectItem value="TO">Tocantins (TO)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 mt-4">
                  <Button onClick={() => setGroupStep(1)} variant="outline" className="flex-1 rounded-full bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white">{t("duels_wizard_back")}</Button>
                  <Button
                    onClick={() => {
                      if (groupConfig.location) {
                        setGroupStep(3);
                      } else {
                        toast({ title: t("duels_wizard_required_title"), description: t("duels_wizard_state_required"), variant: "destructive" });
                      }
                    }}
                    className="flex-1 rounded-full border-0"
                    style={GLASS_PRIMARY_BTN_STYLE}
                  >
                    {t("duels_wizard_next")} <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3 — Duração */}
            {groupStep === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className={GLASS_LABEL_CLASS}>{t("duels_wizard_duration_label")}</label>
                  <Select value={groupConfig.durationDays} onValueChange={(value) => setGroupConfig({ ...groupConfig, durationDays: value })}>
                    <SelectTrigger className={`rounded-lg ${GLASS_FIELD_CLASS}`} style={GLASS_FIELD_STYLE}>
                      <SelectValue placeholder={t("duels_wizard_duration_placeholder")} />
                    </SelectTrigger>
                    <SelectContent className="z-[500]">
                      {["30", "60", "90", "120", "180", "360"].map((d) => (
                        <SelectItem key={d} value={d}>{t("duels_wizard_duration_days").replace("{n}", d)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {groupConfig.durationDays && (
                    <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
                      {t("duels_wizard_end_forecast").replace("{date}", (() => {
                        const d = new Date();
                        d.setDate(d.getDate() + parseInt(groupConfig.durationDays));
                        return d.toLocaleDateString(language === "pt" ? "pt-BR" : "en-US", { day: "2-digit", month: "long", year: "numeric" });
                      })())}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 mt-4">
                  <Button onClick={() => setGroupStep(2)} variant="outline" className="flex-1 rounded-full bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white">{t("duels_wizard_back")}</Button>
                  <Button
                    onClick={() => {
                      if (groupConfig.durationDays) {
                        setGroupStep(4);
                      } else {
                        toast({ title: t("duels_wizard_required_title"), description: t("duels_wizard_duration_required"), variant: "destructive" });
                      }
                    }}
                    className="flex-1 rounded-full border-0"
                    style={GLASS_PRIMARY_BTN_STYLE}
                  >
                    {t("duels_wizard_next")} <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4 — Sistema de Pontuação */}
            {groupStep === 4 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  {DUEL_SCORING_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setGroupConfig({ ...groupConfig, scoringType: opt.value })}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left"
                      style={groupConfig.scoringType === opt.value
                        ? { borderColor: "#5b8cff", background: "rgba(91,140,255,.12)" }
                        : { borderColor: "rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)" }}
                    >
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xl shrink-0" style={{ background: groupConfig.scoringType === opt.value ? "rgba(91,140,255,.2)" : "rgba(255,255,255,.06)" }}>
                        {opt.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">{t(opt.titleKey)}</p>
                        <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>{t(opt.descKey)}</p>
                      </div>
                      <div className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors" style={groupConfig.scoringType === opt.value ? { borderColor: "#5b8cff", background: "#5b8cff" } : { borderColor: "rgba(255,255,255,.4)" }}>
                        {groupConfig.scoringType === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Meme rule input — shown only when memes is selected */}
                {groupConfig.scoringType === "memes" && (
                  <div className="space-y-2 pt-1">
                    <label className={GLASS_LABEL_CLASS}>{t("duels_wizard_meme_rule_label")}</label>
                    <Input
                      placeholder={t("duels_group_meme_rule_placeholder")}
                      value={groupConfig.memeRule}
                      onChange={(e) => setGroupConfig({ ...groupConfig, memeRule: e.target.value })}
                      maxLength={200}
                      className={GLASS_FIELD_CLASS}
                      style={GLASS_FIELD_STYLE}
                    />
                    <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>{t("duels_group_meme_rule_hint")}</p>
                  </div>
                )}

                <div className="flex gap-2 mt-4">
                  <Button onClick={() => setGroupStep(3)} variant="outline" className="flex-1 rounded-full bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white">{t("duels_wizard_back")}</Button>
                  <Button
                    onClick={() => {
                      if (groupConfig.scoringType === "memes" && !groupConfig.memeRule.trim()) {
                        toast({ title: t("duels_wizard_required_title"), description: t("duels_group_meme_rule_required"), variant: "destructive" });
                        return;
                      }
                      setGroupStep(5);
                    }}
                    className="flex-1 rounded-full border-0"
                    style={GLASS_PRIMARY_BTN_STYLE}
                  >
                    {t("duels_wizard_next")} <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 5 — Convidar Participantes */}
            {groupStep === 5 && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="p-4 rounded-xl space-y-1" style={{ background: "rgba(91,140,255,.1)", border: "1px solid rgba(91,140,255,.25)" }}>
                  <p className="text-sm font-semibold text-brand">{groupConfig.name}</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
                    {t("duels_wizard_summary_line").replace("{loc}", groupConfig.location).replace("{n}", groupConfig.durationDays)}
                  </p>
                  {groupConfig.goal.trim() && (
                    <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,.5)" }}>{groupConfig.goal}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className={GLASS_LABEL_CLASS}>{t("duels_wizard_invite_label").replace("{n}", String(selectedInvitees.size))}</label>
                    {followers.length > 0 && (
                      <Button
                        onClick={() => {
                          const filteredFollowers = followers.filter((f) =>
                            f.nickname.toLowerCase().includes(participantsSearch.toLowerCase())
                          );
                          if (selectedInvitees.size === filteredFollowers.length) {
                            setSelectedInvitees(new Set());
                          } else {
                            setSelectedInvitees(new Set(filteredFollowers.map(f => f.id)));
                          }
                        }}
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 text-white/70 hover:text-white hover:bg-white/10"
                      >
                        {selectedInvitees.size === followers.length ? t("duels_wizard_deselect_all") : t("duels_wizard_select_all")}
                      </Button>
                    )}
                  </div>

                  {followers.length > 0 && (
                    <Input
                      placeholder={t("duels_wizard_search_follower")}
                      value={participantsSearch}
                      onChange={(e) => setParticipantsSearch(e.target.value)}
                      className={`rounded-lg ${GLASS_FIELD_CLASS}`}
                      style={GLASS_FIELD_STYLE}
                    />
                  )}

                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {followers.length > 0 ? (
                      followers
                        .filter((f) => f.nickname.toLowerCase().includes(participantsSearch.toLowerCase()))
                        .map((follower) => (
                          <button
                            key={follower.id}
                            onClick={() => {
                              const newSelected = new Set(selectedInvitees);
                              if (newSelected.has(follower.id)) {
                                newSelected.delete(follower.id);
                              } else {
                                newSelected.add(follower.id);
                              }
                              setSelectedInvitees(newSelected);
                            }}
                            className="w-full p-3 rounded-lg border transition-all text-left flex items-center gap-2"
                            style={selectedInvitees.has(follower.id)
                              ? { borderColor: "#5b8cff", background: "rgba(91,140,255,.12)" }
                              : { borderColor: "rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)" }}
                          >
                            <div className="h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0" style={selectedInvitees.has(follower.id) ? { background: "#5b8cff", borderColor: "#5b8cff" } : { borderColor: "rgba(255,255,255,.4)" }}>
                              {selectedInvitees.has(follower.id) && <Check className="h-3 w-3 text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate text-white">{follower.nickname}</div>
                            </div>
                          </button>
                        ))
                    ) : (
                      <div className="flex flex-col items-center gap-3 py-4">
                        <p className="text-sm text-center" style={{ color: "rgba(255,255,255,.5)" }}>{t("duels_wizard_no_following")}</p>
                        <Button variant="outline" size="sm" className="rounded-full gap-2 bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white" onClick={() => { setIsCreateGroupModalOpen(false); navigate("/buscar"); }}>
                          <Search className="h-4 w-4" />
                          {t("duels_wizard_search_users")}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => setGroupStep(4)} variant="outline" className="flex-1 rounded-full bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white">{t("duels_wizard_back")}</Button>
                  <Button
                    onClick={async () => {
                      if (!user || isCreatingGroup) return;
                      if (duelGateBlocked) {
                        setIsCreateGroupModalOpen(false);
                        setDuelPaywallOpen(true);
                        return;
                      }
                      setIsCreatingGroup(true);
                      try {
                        let endDate: string | undefined;
                        if (groupConfig.durationDays) {
                          const now = new Date();
                          now.setDate(now.getDate() + parseInt(groupConfig.durationDays));
                          endDate = now.toISOString();
                        }

                        const savedGroup = await createDuelGroupDb(
                          user.id,
                          groupConfig.name.trim(),
                          groupConfig.location,
                          // Meta é opcional, mas a coluna é NOT NULL: vazio grava "".
                          groupConfig.goal.trim(),
                          Array.from(selectedInvitees),
                          endDate,
                          groupConfig.scoringType,
                          groupConfig.memeRule || undefined
                        );

                        // Upload group photo if provided — after group ID is known
                        let photoUrl: string | null = null;
                        if (groupPhotoFile) {
                          try {
                            // Sobe o recorte que o usuário enquadrou no frame do
                            // Passo 1. As refs guardam a medida mesmo com o passo
                            // já desmontado; se nunca mediram, sobe o original.
                            const cw = groupCoverWRef.current;
                            const ch = groupCoverHRef.current;
                            const toUpload = groupConfig.photo && cw > 0 && ch > 0
                              ? new File(
                                  [await applyTransformToBlob(groupConfig.photo, groupCoverTransform, cw, ch)],
                                  "cover.jpg",
                                  { type: "image/jpeg" },
                                )
                              // Sem medida do frame não há recorte: o arquivo é o
                              // original do seletor, então encolhe antes de subir.
                              : await compressImageFile(groupPhotoFile);
                            photoUrl = await updateGroupPhotoDb(savedGroup.id, toUpload);
                          } catch (photoErr) {
                            console.error("Error uploading group photo:", photoErr);
                          }
                        }

                        const newGroup = {
                          ...savedGroup,
                          icon: "⚔️",
                          photo: photoUrl || null,
                          description: groupConfig.goal.trim(),
                          participants: selectedInvitees.size + 1,
                          city: groupConfig.location,
                          isOfficial: false,
                        };

                        // Reset form
                        setIsCreateGroupModalOpen(false);
                        setGroupConfig({ name: "", location: "", goal: "", durationDays: "", photo: "", scoringType: "check_in_count", memeRule: "" });
                        setGroupCoverTransform(DEFAULT_TRANSFORM);
                        setGroupPhotoFile(null);
                        setSelectedInvitees(new Set());
                        setGroupStep(1);

                        // Refresh groups list
                        getEnrichedDuelGroupsDb(user.id).then(({ myGroups }) => {
                          setUserCreatedGroups(myGroups.map((g: any) => ({
                            ...g, icon: "⚔️", description: g.goal, city: g.location, isOfficial: false,
                          })));
                        }).catch(console.error);

                        // Navigate to new group
                        setSelectedGroupForView(newGroup);
                        setActiveGroupViewTab("check-ins");
                        setGroupCheckIns([]);
                        setGroupParticipants([]);

                        toast({ title: t("duels_wizard_created_title"), description: t("duels_wizard_created_desc").replace("{name}", newGroup.name) });
                      } catch (err: any) {
                        toast({ title: t("duels_wizard_create_error"), description: err?.message || t("retry"), variant: "destructive" });
                      } finally {
                        setIsCreatingGroup(false);
                      }
                    }}
                    className="flex-1 rounded-full border-0"
                    style={GLASS_PRIMARY_BTN_STYLE}
                    disabled={isCreatingGroup}
                  >
                    {isCreatingGroup ? t("duels_wizard_creating") : t("duels_create")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Add Check-in Modal */}
      <Drawer
        open={isAddCheckInModalOpen}
        onOpenChange={setIsAddCheckInModalOpen}
      >
        <DrawerContent
          {...GLASS_SHEET_PROPS}
          style={GLASS_SHEET_STYLE}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DrawerHeader className="shrink-0">
            <DrawerTitle className="text-white">Adicionar Check-in</DrawerTitle>
            <DrawerDescription className="sr-only">Registre seu check-in de treino</DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="space-y-4">
              {/* Photo Upload Carousel */}
              <div className="space-y-2">
                <label className={GLASS_LABEL_CLASS}>Fotos do Treino ({checkInPhotoFiles.length})</label>
                <div className="relative border-2 border-dashed border-brand/40 rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,.03)" }}>
                  {checkInPhotoPreviewUrls.length > 0 ? (
                    <div className="space-y-3 p-4">
                      {/* Preview Carousel */}
                      <div className="relative group aspect-square rounded-lg overflow-hidden border border-white/10 bg-black/20">
                        <img
                          src={checkInPhotoPreviewUrls[activePhotoPreviewIndex]}
                          alt={`Preview ${activePhotoPreviewIndex + 1}`}
                          className="w-full h-full object-contain"
                        />

                        {/* Edit (crop) current photo */}
                        <button
                          onClick={() => {
                            const src = checkInPhotoPreviewUrls[activePhotoPreviewIndex];
                            if (src) {
                              setPendingCropIndex(activePhotoPreviewIndex);
                              setPendingCropSrc(src);
                            }
                          }}
                          className="absolute top-2 left-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full shadow-lg transition-colors"
                        >
                          <Crop className="h-4 w-4" />
                        </button>

                        {/* Remove Current Photo */}
                        <button
                          onClick={() => {
                            const newFiles = [...checkInPhotoFiles];
                            newFiles.splice(activePhotoPreviewIndex, 1);
                            setCheckInPhotoFiles(newFiles);
                            if (activePhotoPreviewIndex >= newFiles.length && newFiles.length > 0) {
                              setActivePhotoPreviewIndex(newFiles.length - 1);
                            }
                          }}
                          className="absolute top-2 right-2 bg-destructive/80 hover:bg-destructive text-white p-1.5 rounded-full shadow-lg transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>

                        {/* Navigation */}
                        {checkInPhotoPreviewUrls.length > 1 && (
                          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
                            {checkInPhotoPreviewUrls.map((_, i) => (
                              <div
                                key={i}
                                className={`h-1.5 rounded-full transition-all ${i === activePhotoPreviewIndex ? "w-4 bg-brand" : "w-1.5 bg-brand/30"}`}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Thumbnails + Add More */}
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {checkInPhotoPreviewUrls.map((url, i) => (
                          <button
                            key={i}
                            data-thumb-index={i}
                            onClick={() => {
                              if (!thumbDragState.current?.started) setActivePhotoPreviewIndex(i);
                            }}
                            onTouchStart={(e) => {
                              const touch = e.touches[0];
                              thumbDragState.current = { index: i, started: false, startX: touch.clientX, startY: touch.clientY };
                            }}
                            onTouchMove={(e) => {
                              if (!thumbDragState.current) return;
                              const touch = e.touches[0];
                              if (!thumbDragState.current.started) {
                                const dx = Math.abs(touch.clientX - thumbDragState.current.startX);
                                const dy = Math.abs(touch.clientY - thumbDragState.current.startY);
                                if (dx < 8 && dy < 8) return;
                                thumbDragState.current.started = true;
                                setDraggingThumbIndex(thumbDragState.current.index);
                                setDragOverThumbIndex(thumbDragState.current.index);
                              }
                              const el = document.elementFromPoint(touch.clientX, touch.clientY);
                              const thumbEl = el?.closest('[data-thumb-index]') as HTMLElement | null;
                              if (thumbEl) {
                                const idx = parseInt(thumbEl.dataset.thumbIndex!, 10);
                                if (!isNaN(idx)) {
                                  thumbDragOverRef.current = idx;
                                  setDragOverThumbIndex(idx);
                                }
                              }
                            }}
                            onTouchEnd={() => {
                              if (thumbDragState.current?.started) {
                                const fromIndex = thumbDragState.current.index;
                                const toIndex = thumbDragOverRef.current;
                                if (toIndex !== null && fromIndex !== toIndex) {
                                  const newFiles = [...checkInPhotoFiles];
                                  const [removed] = newFiles.splice(fromIndex, 1);
                                  newFiles.splice(toIndex, 0, removed);
                                  setCheckInPhotoFiles(newFiles);
                                  setActivePhotoPreviewIndex(toIndex);
                                }
                              }
                              thumbDragState.current = null;
                              thumbDragOverRef.current = null;
                              setDraggingThumbIndex(null);
                              setDragOverThumbIndex(null);
                            }}
                            className={`relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all select-none ${
                              i === draggingThumbIndex
                                ? "opacity-40 scale-90 border-brand"
                                : i === dragOverThumbIndex && draggingThumbIndex !== null
                                ? "border-brand scale-105 ring-2 ring-brand/50"
                                : i === activePhotoPreviewIndex
                                ? "border-brand scale-95"
                                : "border-transparent opacity-60"
                            }`}
                          >
                            <img src={url} alt={`Thumb ${i}`} className="w-full h-full object-cover" />
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => checkInCameraInputRef.current?.click()}
                          className="shrink-0 w-14 h-14 rounded-lg border-2 border-dashed border-brand/40 flex items-center justify-center cursor-pointer hover:bg-brand/5"
                          title={t("duels_checkin_camera")}
                        >
                          <Camera className="h-5 w-5 text-brand" />
                        </button>
                        <button
                          type="button"
                          onClick={() => checkInGalleryInputRef.current?.click()}
                          className="shrink-0 w-14 h-14 rounded-lg border-2 border-dashed border-brand/40 flex items-center justify-center cursor-pointer hover:bg-brand/5"
                          title={t("duels_checkin_gallery")}
                        >
                          <Image className="h-5 w-5 text-brand" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center">
                        <Plus className="h-8 w-8 text-brand" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-white">Adicionar Fotos</p>
                        <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,.5)" }}>{t("duels_checkin_photo_hint")}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-full text-xs h-9 px-4 bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white"
                          onClick={() => checkInCameraInputRef.current?.click()}
                        >
                          <Camera className="h-4 w-4 mr-1.5" />
                          {t("duels_checkin_camera")}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-full text-xs h-9 px-4 bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white"
                          onClick={() => checkInGalleryInputRef.current?.click()}
                        >
                          <Image className="h-4 w-4 mr-1.5" />
                          {t("duels_checkin_gallery")}
                        </Button>
                      </div>
                    </div>
                  )}
                  {/* Front camera capture mirrors the resulting photo on iOS WebKit;
                      forcing the rear camera here (matches NewPost.tsx) avoids it. */}
                  <input
                    ref={checkInCameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleCheckInPhotoSelected}
                    className="hidden"
                  />
                  <input
                    ref={checkInGalleryInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCheckInPhotoSelected}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className={GLASS_LABEL_CLASS}>Descrição</label>
                <Textarea
                  value={checkInForm.description}
                  onChange={(e) =>
                    setCheckInForm({ ...checkInForm, description: e.target.value })
                  }
                  placeholder="Como foi seu treino? Deixe uma mensagem..."
                  className={`min-h-20 ${GLASS_FIELD_CLASS}`}
                  style={GLASS_FIELD_STYLE}
                />
              </div>

              {/* Completed Routine Selector */}
              <div className="space-y-2">
                <label className={GLASS_LABEL_CLASS}>O que você treinou? *</label>
                {isLoadingRoutines ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <div key={i} className="animate-pulse rounded-xl p-3" style={GLASS_PANEL_STYLE}>
                        <div className="flex gap-3">
                          <div className="w-5 h-5 rounded-full bg-white/10 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 space-y-2">
                            <div className="h-3 bg-white/10 rounded w-2/3" />
                            <div className="h-2 bg-white/10 rounded w-1/3" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : completedRoutines.length === 0 ? (
                  <div className="rounded-xl p-4 text-center space-y-3" style={GLASS_PANEL_STYLE}>
                    <div>
                      <p className="text-sm font-medium text-white">{t("duels_checkin_no_routines_title")}</p>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,.5)" }}>{t("duels_checkin_no_routines_subtitle")}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full text-xs h-8 px-4 bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white"
                      onClick={() => {
                        setIsAddCheckInModalOpen(false);
                        navigate("/metas");
                      }}
                    >
                      {t("duels_checkin_goto_goals")}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {completedRoutines.map((routine, idx) => {
                      const key = String(idx);
                      const isSelected = selectedRoutineKey === key;
                      const completedDate = new Date(routine.completedAt);
                      const today = new Date();
                      const isToday = completedDate.toDateString() === today.toDateString();
                      const dateLabel = isToday
                        ? "Hoje " + completedDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                        : completedDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) + " " + completedDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                      const alreadyCheckedIn = checkedInRoutineDayKeys.has(routineDayKey(routine.routineName, routine.completedAt));

                      return (
                        <button
                          key={key}
                          onClick={() => {
                            if (alreadyCheckedIn) {
                              toast({ title: t("duels_checkin_duplicate_error_title"), description: t("duels_checkin_duplicate_error_desc"), variant: "destructive" });
                              return;
                            }
                            setSelectedRoutineKey(isSelected ? null : key);
                          }}
                          className={`w-full text-left rounded-xl border overflow-hidden transition-colors ${alreadyCheckedIn ? "cursor-not-allowed" : ""}`}
                          style={alreadyCheckedIn
                            ? { borderColor: "rgba(255,255,255,.08)", background: "rgba(255,255,255,.02)", opacity: 0.55 }
                            : isSelected
                            ? { borderColor: "#5b8cff", background: "rgba(91,140,255,.1)" }
                            : { borderColor: "rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)" }}
                        >
                          <div className="flex items-start gap-3 px-3 py-2.5">
                            <div className="shrink-0 mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors" style={isSelected ? { borderColor: "#5b8cff", background: "#5b8cff" } : { borderColor: "rgba(255,255,255,.3)" }}>
                              {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate text-white">{routine.routineName}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {routine.primaryMuscleGroup && (
                                  <span className="text-xs bg-brand/15 text-brand px-1.5 py-0.5 rounded-full">{routine.primaryMuscleGroup}</span>
                                )}
                                <span className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>{routine.exercises.length} exerc. · {dateLabel}</span>
                                {alreadyCheckedIn && (
                                  <span className="text-xs flex items-center gap-1" style={{ color: "rgba(255,255,255,.45)" }}>
                                    <CheckCircle2 className="h-3 w-3" />
                                    {t("duels_checkin_already_posted")}
                                  </span>
                                )}
                              </div>
                              {/* Exercise list preview */}
                              <div className="mt-1.5 space-y-0.5">
                                {routine.exercises.slice(0, 3).map((ex, i) => (
                                  <p key={i} className="text-xs truncate" style={{ color: "rgba(255,255,255,.5)" }}>• {ex.workoutName}{ex.kilos ? ` — ${ex.kilos}kg` : ""}</p>
                                ))}
                                {routine.exercises.length > 3 && (
                                  <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>+{routine.exercises.length - 3} mais</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Metric input for scoring types that need manual value */}
              {selectedGroupForView?.scoringType && ["duration", "distance", "steps", "calories"].includes(selectedGroupForView.scoringType) && (() => {
                const metricConfig = {
                  duration:  { label: "Duração do treino *",   placeholder: "Ex: 45",  unit: "min",    type: "number" },
                  distance:  { label: "Distância percorrida *", placeholder: "Ex: 5.2", unit: "km",     type: "number" },
                  steps:     { label: "Passos dados *",         placeholder: "Ex: 8000", unit: "passos", type: "number" },
                  calories:  { label: "Calorias queimadas *",   placeholder: "Ex: 350", unit: "kcal",   type: "number" },
                }[selectedGroupForView.scoringType as "duration" | "distance" | "steps" | "calories"];
                return (
                  <div className="space-y-2">
                    <label className={GLASS_LABEL_CLASS}>{metricConfig?.label}</label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        placeholder={metricConfig?.placeholder}
                        value={checkInMetricValue}
                        onChange={(e) => setCheckInMetricValue(e.target.value)}
                        className={`flex-1 ${GLASS_FIELD_CLASS}`}
                        style={GLASS_FIELD_STYLE}
                      />
                      <span className="text-sm shrink-0" style={{ color: "rgba(255,255,255,.5)" }}>{metricConfig?.unit}</span>
                    </div>
                  </div>
                );
              })()}

              <Button
                onClick={async () => {
                  if (!user || !selectedGroupForView || isSubmittingCheckIn) return;
                  if (!selectedRoutineKey) {
                    toast({ title: "Selecione um treino", description: "Escolha o treino que você realizou", variant: "destructive" });
                    return;
                  }
                  const routineToSubmit = completedRoutines[parseInt(selectedRoutineKey)];
                  if (routineToSubmit && checkedInRoutineDayKeys.has(routineDayKey(routineToSubmit.routineName, routineToSubmit.completedAt))) {
                    toast({ title: t("duels_checkin_duplicate_error_title"), description: t("duels_checkin_duplicate_error_desc"), variant: "destructive" });
                    return;
                  }
                  const needsMetric = ["duration", "distance", "steps", "calories"].includes(selectedGroupForView.scoringType || "");
                  if (needsMetric && !checkInMetricValue) {
                    toast({ title: "Campo obrigatório", description: "Informe o valor da métrica para este desafio", variant: "destructive" });
                    return;
                  }
                  setIsSubmittingCheckIn(true);
                  try {
                    const selectedRoutine = completedRoutines[parseInt(selectedRoutineKey)];
                    const exerciseName = selectedRoutine?.routineName || "Treino";

                    // Upload all photos to storage
                    const uploadedUrls: string[] = [];
                    for (let i = 0; i < checkInPhotoFiles.length; i++) {
                      const file = checkInPhotoFiles[i];
                      const timestamp = Date.now();
                      const extension = file.name.split(".").pop() || "jpg";
                      const filePath = `checkins/${user.id}/${timestamp}-${i}.${extension}`;

                      const { error: uploadError } = await supabase.storage
                        .from("posts") // Re-using the posts bucket
                        .upload(filePath, file, {
                          contentType: file.type,
                          upsert: false,
                        });

                      if (!uploadError) {
                        const { data: urlData } = supabase.storage
                          .from("posts")
                          .getPublicUrl(filePath);
                        uploadedUrls.push(urlData.publicUrl);
                      }
                    }

                    const metricVal = checkInMetricValue ? parseFloat(checkInMetricValue) : null;
                    const scoringType = selectedGroupForView.scoringType || "check_in_count";
                    // No photo uploaded → fall back to the default check-in
                    // mascot image instead of leaving the photo slot empty.
                    const finalPhotos = uploadedUrls.length > 0 ? uploadedUrls : [DEFAULT_CHECKIN_PHOTO];
                    const checkIn = await addGroupCheckInDb(
                      selectedGroupForView.id,
                      user.id,
                      finalPhotos[0],
                      checkInForm.description,
                      exerciseName,
                      selectedRoutine?.totalSeries || 0,
                      selectedRoutine?.totalVolume || 0,
                      selectedRoutine?.primaryMuscleGroup || null,
                      selectedRoutine?.exercises || [],
                      finalPhotos,
                      scoringType === "duration" ? metricVal : null,
                      scoringType === "distance" ? metricVal : null,
                      scoringType === "steps" ? metricVal : null,
                      scoringType === "calories" ? metricVal : null,
                      selectedRoutine?.completedAt || null,
                    );

                    setGroupCheckIns((prev) => [checkIn, ...prev]);
                    setIsAddCheckInModalOpen(false);
                    setCheckInForm({ photo: "", photos: [], description: "", workoutId: "" });
                    setCheckInPhotoFiles([]);
                    setCheckInPhotoPreviewUrls([]);
                    setActivePhotoPreviewIndex(0);
                    setSelectedRoutineKey(null);
                    setCheckInMetricValue("");

                    toast({
                      title: "Check-in adicionado!",
                      description: "Seu check-in foi registrado com sucesso.",
                    });
                  } catch (err: any) {
                    toast({
                      title: "Erro ao adicionar check-in",
                      description: err.message || "Tente novamente",
                      variant: "destructive",
                    });
                  } finally {
                    setIsSubmittingCheckIn(false);
                  }
                }}
                className="w-full rounded-full border-0"
                style={GLASS_PRIMARY_BTN_STYLE}
                disabled={!selectedRoutineKey || !user || isSubmittingCheckIn}
              >
                Adicionar Check-in
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Image Cropper for Check-in photos */}
      <ImageCropperDrawer
        imageSrc={pendingCropSrc}
        aspectRatio={1}
        onConfirm={(_dataUrl, blob) => {
          const file = new File([blob], `checkin-${Date.now()}.jpg`, { type: "image/jpeg" });
          if (pendingCropIndex === -1) {
            setCheckInPhotoFiles(prev => {
              const next = [...prev, file];
              setActivePhotoPreviewIndex(next.length - 1);
              return next;
            });
          } else {
            setCheckInPhotoFiles(prev => {
              const next = [...prev];
              next[pendingCropIndex] = file;
              return next;
            });
          }
          setPendingCropSrc(null);
          setPendingCropIndex(-1);
        }}
        onCancel={() => {
          setPendingCropSrc(null);
          setPendingCropIndex(-1);
        }}
      />

      {/* Nova Conversa Drawer */}
      <NewConversationDrawer
        open={isNewConversationDrawerOpen}
        onOpenChange={setIsNewConversationDrawerOpen}
        followers={followers}
        onSelectFollower={(conv) => {
          setSelectedConversation(conv);
          setViewMode("conversation");
        }}
      />

      {/* Reaction Viewer — who reacted with a specific emoji. Same z-index
          fix as the Participant Details Modal below: the base DrawerContent
          defaults to z-[310] with a z-[300] overlay (see
          client/components/ui/drawer.tsx) — the old z-[110] here put this
          drawer's own content *under* its own backdrop. */}
      <Drawer open={!!reactionViewerState} onOpenChange={(open) => { if (!open) setReactionViewerState(null); }}>
        <DrawerContent
          {...GLASS_SHEET_PROPS}
          className="flex flex-col !rounded-t-[32px] !border-0 z-[330]"
          overlayClassName="z-[320]"
          style={{ ...GLASS_SHEET_STYLE, maxHeight: "60dvh" }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {reactionViewerState && (
            <>
              <DrawerHeader className="shrink-0">
                <DrawerTitle className="text-base flex items-center gap-2 text-white">
                  <span className="text-xl">{reactionViewerState.emoji}</span>
                  {!reactionViewerState.loading && (
                    <span>{reactionViewerState.users.filter(u => u.emoji === reactionViewerState.emoji).length} {reactionViewerState.users.filter(u => u.emoji === reactionViewerState.emoji).length === 1 ? "reação" : "reações"}</span>
                  )}
                </DrawerTitle>
                <DrawerDescription className="sr-only">Pessoas que reagiram</DrawerDescription>
              </DrawerHeader>
              <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
                {reactionViewerState.loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 animate-pulse">
                        <div className="w-9 h-9 rounded-full bg-white/10 flex-shrink-0" />
                        <div className="h-3 bg-white/10 rounded w-28" />
                      </div>
                    ))}
                  </div>
                ) : (
                  reactionViewerState.users
                    .filter(u => u.emoji === reactionViewerState.emoji)
                    .map((u) => (
                      <div key={u.userId} className="flex items-center gap-3">
                        <UserAvatar
                          photo={u.userPhoto}
                          nickname={u.userName}
                          className="w-9 h-9 flex-shrink-0"
                        />
                        <span className="text-sm font-medium text-white">{u.userName}</span>
                      </div>
                    ))
                )}
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>

      {/* Check-in Detail Modal */}
      <Drawer open={isCheckInDetailOpen} onOpenChange={setIsCheckInDetailOpen}>
        <DrawerContent
          {...GLASS_SHEET_PROPS}
          style={{ ...GLASS_SHEET_STYLE, maxHeight: "80dvh" }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DrawerHeader className="shrink-0 flex items-center justify-between">
            <DrawerTitle className="text-white">Detalhes do Check-in</DrawerTitle>
            <DrawerDescription className="sr-only">Veja detalhes e comentários do check-in</DrawerDescription>
            {selectedCheckInForDetail && selectedCheckInForDetail.userId === user?.id && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (selectedCheckInForDetail) {
                      setIsEditCheckInOpen(true);
                    }
                  }}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  title="Editar check-in"
                >
                  <Edit3 className="h-4 w-4 text-white/60 hover:text-white" />
                </button>
                <button
                  onClick={() => {
                    if (selectedCheckInForDetail) {
                      showConfirm(
                        "Excluir check-in",
                        "Tem certeza que deseja excluir este check-in? Esta ação é irreversível.",
                        async () => {
                          try {
                            await deleteGroupCheckInDb(selectedCheckInForDetail.id);
                            setGroupCheckIns(groupCheckIns.filter((c) => c.id !== selectedCheckInForDetail.id));
                            setIsCheckInDetailOpen(false);
                            toast({ title: "Check-in excluído!", description: "O check-in foi removido com sucesso." });
                          } catch (error: any) {
                            toast({ title: "Erro ao excluir check-in", description: error.message || "Tente novamente.", variant: "destructive" });
                          }
                        },
                      );
                    }
                  }}
                  className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                  title="Excluir check-in"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </button>
              </div>
            )}
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {selectedCheckInForDetail && (
              <div className="space-y-3">
                {/* User + meta inline */}
                <div className="flex items-center gap-2">
                  <UserAvatar
                    photo={selectedCheckInForDetail.userPhoto}
                    nickname={selectedCheckInForDetail.userName}
                    className="h-8 w-8 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold truncate text-white">{selectedCheckInForDetail.userName}</span>
                      {selectedCheckInForDetail.muscleGroups.map((mg) => (
                        <span key={mg} className="text-[10px] bg-brand/15 text-brand px-1 py-0.5 rounded-full shrink-0 leading-none">{mg}</span>
                      ))}
                    </div>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
                      {new Date(selectedCheckInForDetail.createdAt).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} · {new Date(selectedCheckInForDetail.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>

                {/* Photo — Carousel support for multiple images */}
                {(selectedCheckInForDetail.photos?.length || 0) > 0 ? (
                  <PostCarousel
                    photos={selectedCheckInForDetail.photos || [selectedCheckInForDetail.photo]}
                    alt="check-in"
                    objectFit="contain"
                    priority
                  />
                ) : selectedCheckInForDetail.photo ? (
                  <div className="relative rounded-2xl overflow-hidden aspect-square md:aspect-auto md:h-[400px] bg-slate-950/40 flex-shrink-0 flex items-center justify-center">
                    <img
                      src={selectedCheckInForDetail.photo}
                      alt="check-in"
                      className="max-w-full max-h-full w-auto h-auto object-contain"
                    />
                  </div>
                ) : null}

                {/* Description */}
                {selectedCheckInForDetail.description && (
                  <p className="text-sm" style={{ color: "rgba(255,255,255,.85)" }}>{selectedCheckInForDetail.description}</p>
                )}

                {/* Rotina + stats numa linha */}
                <div className="flex items-center gap-3 py-1" style={{ borderTop: "1px solid rgba(255,255,255,.1)" }}>
                  <span className="text-xs shrink-0" style={{ color: "rgba(255,255,255,.5)" }}>Rotina</span>
                  <span className="text-xs font-medium text-brand truncate flex-1">{selectedCheckInForDetail.workoutInfo}</span>
                  {selectedCheckInForDetail.exercises?.length > 0 && (
                    <span className="text-xs shrink-0" style={{ color: "rgba(255,255,255,.5)" }}>{selectedCheckInForDetail.exercises.length} exerc.</span>
                  )}
                  {selectedCheckInForDetail.volume > 0 && (
                    <span className="text-xs shrink-0" style={{ color: "rgba(255,255,255,.5)" }}>{selectedCheckInForDetail.volume}kg</span>
                  )}
                </div>

                {/* Exercises list — grouped */}
                {selectedCheckInForDetail.exercises && selectedCheckInForDetail.exercises.length > 0 && (() => {
                  const grouped: { name: string; sets: string[] }[] = [];
                  for (const ex of selectedCheckInForDetail.exercises) {
                    const existing = grouped.find(g => g.name === ex.workoutName);
                    if (existing) {
                      if (ex.kilos) existing.sets.push(`${ex.kilos}kg`);
                    } else {
                      grouped.push({ name: ex.workoutName, sets: ex.kilos ? [`${ex.kilos}kg`] : [] });
                    }
                  }
                  return (
                    <div className="space-y-2 pt-0.5">
                      {grouped.map((ex, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-xs flex-1 leading-5 truncate" style={{ color: "rgba(255,255,255,.7)" }}>{ex.name}</span>
                          {ex.sets.length > 0 && (
                            <div className="flex flex-wrap gap-1 justify-end shrink-0 max-w-[55%]">
                              {ex.sets.map((s, j) => (
                                <span key={j} className="text-[10px] font-medium text-brand bg-brand/15 rounded px-1.5 py-0.5 leading-none">{s}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Memes voting section — shown in detail view */}
                {selectedGroupForView?.scoringType === "memes" && selectedCheckInForDetail && (() => {
                  const votes = checkInVotes.filter((v) => v.checkInId === selectedCheckInForDetail.id);
                  const classifyCount = votes.filter((v) => v.voteType === "classify").length;
                  const disqualifyCount = votes.filter((v) => v.voteType === "disqualify").length;
                  const userVote = votes.find((v) => v.userId === user?.id)?.voteType ?? null;
                  const disqualified = disqualifyCount > classifyCount && disqualifyCount > 0;
                  const isOwn = selectedCheckInForDetail.userId === user?.id;
                  return (
                    <div className="py-3 space-y-2" style={{ borderTop: "1px solid rgba(255,255,255,.1)" }}>
                      {selectedGroupForView.memeRule && (
                        <div className="flex items-start gap-2 p-2.5 rounded-lg" style={GLASS_PANEL_STYLE}>
                          <span className="text-base shrink-0">🎭</span>
                          <p className="text-xs" style={{ color: "rgba(255,255,255,.6)" }}>{selectedGroupForView.memeRule}</p>
                        </div>
                      )}
                      {disqualified && (
                        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                          <XCircle className="h-4 w-4 text-destructive shrink-0" />
                          <p className="text-xs font-semibold text-destructive">
                            {t("duels_group_annulled_detail")
                              .replace("{dq}", formatAnnulments(disqualifyCount))
                              .replace("{cl}", formatApprovals(classifyCount))}
                          </p>
                        </div>
                      )}
                      {!isOwn && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const next: DuelCheckInVoteType | null = userVote === "classify" ? null : "classify";
                              setCheckInVotes((prev) => {
                                const filtered = prev.filter((v) => !(v.checkInId === selectedCheckInForDetail.id && v.userId === user!.id));
                                return next ? [...filtered, { checkInId: selectedCheckInForDetail.id, userId: user!.id, voteType: next }] : filtered;
                              });
                              setCheckInVoteDb(selectedCheckInForDetail.id, next).catch(() => {
                                getCheckInVotesDb(selectedGroupForView.id).then(setCheckInVotes).catch(() => {});
                              });
                            }}
                            aria-label="Aprovar check-in"
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-colors ${userVote === "classify" ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-400" : "bg-white/5 border-white/15 text-white/60 hover:border-emerald-500/40 hover:text-emerald-400"}`}
                          >
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            Aprovar
                            {classifyCount > 0 && <span className="text-xs opacity-70">({classifyCount})</span>}
                          </button>
                          <button
                            onClick={() => {
                              const next: DuelCheckInVoteType | null = userVote === "disqualify" ? null : "disqualify";
                              setCheckInVotes((prev) => {
                                const filtered = prev.filter((v) => !(v.checkInId === selectedCheckInForDetail.id && v.userId === user!.id));
                                return next ? [...filtered, { checkInId: selectedCheckInForDetail.id, userId: user!.id, voteType: next }] : filtered;
                              });
                              setCheckInVoteDb(selectedCheckInForDetail.id, next).catch(() => {
                                getCheckInVotesDb(selectedGroupForView.id).then(setCheckInVotes).catch(() => {});
                              });
                            }}
                            aria-label="Anular check-in"
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-colors ${userVote === "disqualify" ? "bg-destructive/15 border-destructive/50 text-destructive" : "bg-white/5 border-white/15 text-white/60 hover:border-destructive/40 hover:text-destructive"}`}
                          >
                            <XCircle className="h-4 w-4 shrink-0" />
                            Anular
                            {disqualifyCount > 0 && <span className="text-xs opacity-70">({disqualifyCount})</span>}
                          </button>
                        </div>
                      )}
                      {isOwn && (
                        <div className="flex gap-4 text-sm text-white/60">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            {formatApprovals(classifyCount)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <XCircle className="h-4 w-4 text-destructive" />
                            {formatAnnulments(disqualifyCount)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Comments Section */}
                <div className="pt-2 space-y-3" style={{ borderTop: "1px solid rgba(255,255,255,.1)" }}>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,.5)" }}>
                    Comentários {checkInComments.length > 0 ? `(${checkInComments.length})` : ""}
                  </p>

                  {isLoadingComments ? (
                    <div className="space-y-2">
                      {[1, 2].map((i) => (
                        <div key={i} className="animate-pulse flex gap-2">
                          <div className="w-7 h-7 rounded-full bg-white/10 flex-shrink-0" />
                          <div className="flex-1 space-y-1">
                            <div className="h-2.5 bg-white/10 rounded w-1/4" />
                            <div className="h-2 bg-white/10 rounded w-3/4" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : checkInComments.length > 0 ? (
                    <div className="space-y-2.5">
                      {checkInComments.map((comment) => (
                        <div key={comment.id} className="flex gap-2">
                          <UserAvatar
                            photo={comment.userPhoto}
                            nickname={comment.userNickname}
                            className="w-7 h-7 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <div className="flex items-baseline gap-1.5 flex-wrap flex-1 min-w-0">
                                <span className="text-xs font-semibold text-white">{comment.userNickname}</span>
                                <span className="text-[10px]" style={{ color: "rgba(255,255,255,.4)" }}>{new Date(comment.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                              </div>
                              {user?.id === comment.userId && editingCommentId !== comment.id && (
                                <div className="flex shrink-0 gap-0.5">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditComment(comment)}
                                    className="rounded-lg p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                                    aria-label="Editar comentário"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCheckInComment(comment.id)}
                                    disabled={deletingCommentId === comment.id}
                                    className="rounded-lg p-1 text-white/50 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50 disabled:cursor-not-allowed"
                                    aria-label={t("comments_delete_title")}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                            {editingCommentId === comment.id ? (
                              <div className="mt-1 flex flex-col gap-1.5">
                                <textarea
                                  value={editCommentDraft}
                                  onChange={(e) => setEditCommentDraft(e.target.value)}
                                  className="w-full resize-none rounded-md px-2 py-1.5 text-xs text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-ring min-h-14"
                                  style={GLASS_FIELD_STYLE}
                                  disabled={isSavingEditComment}
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey && editCommentDraft.trim()) {
                                      e.preventDefault();
                                      handleSaveEditComment(comment.id);
                                    }
                                    if (e.key === "Escape") handleCancelEditComment();
                                  }}
                                />
                                <div className="flex gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditComment(comment.id)}
                                    disabled={!editCommentDraft.trim() || isSavingEditComment}
                                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                  >
                                    <Check className="h-3 w-3" />
                                    Salvar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCancelEditComment}
                                    disabled={isSavingEditComment}
                                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium bg-white/10 text-white/70 hover:bg-white/20 disabled:opacity-50 transition-colors"
                                  >
                                    <X className="h-3 w-3" />
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs break-words" style={{ color: "rgba(255,255,255,.85)" }}>{comment.text}</p>
                            )}
                            <CommentReactions commentType="checkin" commentId={comment.id} commentOwnerId={comment.userId} sourceId={selectedCheckInForDetail?.id} isOwnComment={!!(user?.id === comment.userId)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>{t("comments_empty")}</p>
                  )}

                </div>
              </div>
            )}
          </div>

          {/* Input de comentário — rodapé fixo, FORA do container rolável.
              Dentro do scroll, o lift do teclado erguia a folha mas nada rolava
              até o campo: ele só aparecia quando o WebKit levava o cursor à
              vista, na primeira tecla. Colado na borda inferior da folha, subir
              a folha já basta — mesmo padrão de post-comments-dialog e
              promotion-comments-drawer. */}
          {selectedCheckInForDetail && (
            <div
              className="shrink-0 flex gap-2 items-center px-4 pt-2.5 pb-4"
              style={{ borderTop: "1px solid rgba(255,255,255,.1)" }}
            >
              <Input
                placeholder={t("comments_placeholder")}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendComment(selectedCheckInForDetail.id);
                  }
                }}
                className={`rounded-full text-xs h-9 ${GLASS_FIELD_CLASS}`}
                style={GLASS_FIELD_STYLE}
                disabled={isSendingComment}
              />
              <Button
                size="sm"
                className="rounded-full flex-shrink-0 h-9 w-9 p-0 border-0"
                style={GLASS_PRIMARY_BTN_STYLE}
                disabled={!commentText.trim() || isSendingComment}
                onClick={() => handleSendComment(selectedCheckInForDetail.id)}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* Group Details Modal */}
      <Drawer open={isGroupDetailsOpen} onOpenChange={(open) => { setIsGroupDetailsOpen(open); if (!open) setIsEditingGroupInfo(false); }}>
        <DrawerContent
          {...GLASS_SHEET_PROPS}
          style={{ ...GLASS_SHEET_STYLE, maxHeight: "80dvh" }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DrawerHeader className="shrink-0 flex flex-row items-center justify-between pr-4">
            <div>
              <DrawerTitle className="text-white">{t("duels_group_details_title")}</DrawerTitle>
              <DrawerDescription className="sr-only">{t("duels_group_details_desc")}</DrawerDescription>
            </div>
            {selectedGroupForView?.createdBy === user?.id && !isEditingGroupInfo && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs text-white/60 hover:text-white hover:bg-white/10"
                onClick={() => {
                  setEditGroupName(selectedGroupForView.name);
                  setEditGroupGoal(selectedGroupForView.goal ?? "");
                  setEditGroupRule(selectedGroupForView.memeRule ?? "");
                  setIsEditingGroupInfo(true);
                }}
              >
                <Edit3 className="h-3.5 w-3.5" />
                {t("duels_group_edit")}
              </Button>
            )}
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {selectedGroupForView && (
              <div className="space-y-4">
                {/* Group Name */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">{t("duels_group_name_label")}</label>
                  {isEditingGroupInfo ? (
                    <Input
                      value={editGroupName}
                      onChange={(e) => setEditGroupName(e.target.value)}
                      className="rounded-lg"
                      maxLength={80}
                    />
                  ) : (
                    <div className="p-3 rounded-lg bg-muted/20">
                      <p className="text-sm font-medium">{selectedGroupForView.name}</p>
                    </div>
                  )}
                </div>

                {/* Location */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">{t("duels_group_location_label")}</label>
                  <div className="p-3 rounded-lg bg-muted/20">
                    <p className="text-sm">📍 {selectedGroupForView.city}</p>
                  </div>
                </div>

                {/* Goal */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">{t("duels_group_goal_label")}</label>
                  {isEditingGroupInfo ? (
                    <Textarea
                      value={editGroupGoal}
                      onChange={(e) => setEditGroupGoal(e.target.value)}
                      className="rounded-lg resize-none"
                      rows={3}
                      maxLength={300}
                    />
                  ) : (
                    <div className="p-3 rounded-lg bg-muted/20">
                      {/* Meta é opcional — sem ela, a caixa ficaria vazia. */}
                      {selectedGroupForView.goal?.trim() ? (
                        <p className="text-sm">{selectedGroupForView.goal}</p>
                      ) : (
                        <p className="text-sm italic text-muted-foreground">{t("duels_group_no_goal")}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Modality — scoring type used by the group */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">{t("duels_group_modality_label")}</label>
                  <div className="p-3 rounded-lg bg-muted/20 flex items-center gap-2.5">
                    {(() => {
                      const opt = DUEL_SCORING_TYPE_OPTIONS.find((o) => o.value === (selectedGroupForView.scoringType || "check_in_count")) ?? DUEL_SCORING_TYPE_OPTIONS[0];
                      return (
                        <>
                          <span className="text-base leading-none">{opt.icon}</span>
                          <p className="text-sm font-medium">{t(opt.titleKey)}</p>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Regra do desafio — só existe na modalidade memes. Em edição o
                    campo aparece mesmo sem regra salva, para poder preencher. */}
                {selectedGroupForView?.scoringType === "memes" && (isEditingGroupInfo || selectedGroupForView?.memeRule) && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">{t("duels_group_meme_rule_label")}</label>
                    {isEditingGroupInfo ? (
                      <>
                        <Textarea
                          value={editGroupRule}
                          onChange={(e) => setEditGroupRule(e.target.value)}
                          placeholder={t("duels_group_meme_rule_placeholder")}
                          className="rounded-lg resize-none"
                          rows={2}
                          maxLength={200}
                        />
                        <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>{t("duels_group_meme_rule_hint")}</p>
                      </>
                    ) : (
                      <div className="p-3 rounded-lg bg-brand/5 border border-brand/20">
                        <p className="text-sm">{selectedGroupForView.memeRule}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">{t("duels_group_start_label")}</label>
                    <div className="p-3 rounded-lg bg-muted/20">
                      <p className="text-sm">
                        {selectedGroupForView.createdAt
                          ? new Date(selectedGroupForView.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">{t("duels_group_end_label")}</label>
                    <div className="p-3 rounded-lg bg-muted/20">
                      <p className="text-sm">
                        {selectedGroupForView.endDate
                          ? new Date(selectedGroupForView.endDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
                          : t("duels_group_no_deadline")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Edit action buttons */}
                {isEditingGroupInfo && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1 rounded-full bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white"
                      onClick={() => setIsEditingGroupInfo(false)}
                      disabled={isSavingGroupInfo}
                    >
                      {t("cancel")}
                    </Button>
                    <Button
                      className="flex-1 rounded-full border-0"
                      style={GLASS_PRIMARY_BTN_STYLE}
                      disabled={isSavingGroupInfo || !editGroupName.trim()}
                      onClick={async () => {
                        if (!selectedGroupForView) return;
                        const isMemes = selectedGroupForView.scoringType === "memes";
                        // Mesma exigência do wizard: memes sem regra não faz sentido.
                        if (isMemes && !editGroupRule.trim()) {
                          toast({ title: t("duels_group_meme_rule_required"), variant: "destructive" });
                          return;
                        }
                        setIsSavingGroupInfo(true);
                        try {
                          // `undefined` fora de memes: não encosta na coluna.
                          const nextRule = isMemes ? editGroupRule.trim() : undefined;
                          await updateGroupInfoDb(selectedGroupForView.id, editGroupName.trim(), editGroupGoal.trim(), nextRule);
                          setSelectedGroupForView({
                            ...selectedGroupForView,
                            name: editGroupName.trim(),
                            goal: editGroupGoal.trim(),
                            ...(isMemes ? { memeRule: editGroupRule.trim() } : {}),
                          });
                          // Update the group in the lists
                          setUserCreatedGroups((prev) => prev.map((g) => g.id === selectedGroupForView.id ? { ...g, name: editGroupName.trim(), goal: editGroupGoal.trim(), description: editGroupGoal.trim(), ...(isMemes ? { memeRule: editGroupRule.trim() } : {}) } : g));
                          setIsEditingGroupInfo(false);
                          toast({ title: t("duels_group_updated_title"), description: t("duels_group_updated_desc") });
                        } catch (error: any) {
                          toast({ title: t("duels_group_save_error"), description: error?.message || t("duels_group_retry"), variant: "destructive" });
                        } finally {
                          setIsSavingGroupInfo(false);
                        }
                      }}
                    >
                      {isSavingGroupInfo ? t("duels_group_saving") : t("duels_group_save")}
                    </Button>
                  </div>
                )}

                {/* Action Buttons */}
                {!isEditingGroupInfo && (
                  <div className="space-y-2 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,.1)" }}>
                    {selectedGroupForView.createdBy === user?.id ? (
                      <>
                        <Button
                          onClick={() => setDeleteGroupConfirmOpen(true)}
                          variant="destructive"
                          className="w-full rounded-full gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          {t("duels_group_delete_btn")}
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={() => setLeaveGroupConfirmOpen(true)}
                        variant="outline"
                        className="w-full rounded-full gap-2 bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white"
                      >
                        {t("duels_group_leave_btn")}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Delete group confirmation — inside drawer to avoid focus trap issues */}
          <AlertDialog open={deleteGroupConfirmOpen} onOpenChange={setDeleteGroupConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("duels_group_delete_confirm_title")}</AlertDialogTitle>
                <AlertDialogDescription>{t("duels_group_delete_confirm_desc")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={async (e) => {
                    e.preventDefault();
                    setDeleteGroupConfirmOpen(false);
                    if (!selectedGroupForView) return;
                    const groupId = selectedGroupForView.id;
                    try {
                      await deleteGroupDb(groupId);
                      toast({ title: t("duels_group_deleted_title"), description: t("duels_group_deleted_desc") });
                      setIsGroupDetailsOpen(false);
                      setSelectedGroupForView(null);
                      setGroupCheckIns([]);
                      await loadGroupsAndRequests({ fresh: true });
                    } catch (error: any) {
                      toast({ title: t("duels_group_delete_error"), description: error?.message || t("duels_group_retry"), variant: "destructive" });
                    }
                  }}
                >
                  {t("duels_group_delete_action")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Leave group confirmation — inside drawer */}
          <AlertDialog open={leaveGroupConfirmOpen} onOpenChange={setLeaveGroupConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("duels_group_leave_confirm_title")}</AlertDialogTitle>
                <AlertDialogDescription>{t("duels_group_leave_confirm_desc")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async (e) => {
                    e.preventDefault();
                    setLeaveGroupConfirmOpen(false);
                    if (!selectedGroupForView) return;
                    const groupId = selectedGroupForView.id;
                    try {
                      await leaveGroupDb(groupId);
                      toast({ title: t("duels_group_left_title"), description: t("duels_group_left_desc") });
                      setIsGroupDetailsOpen(false);
                      setSelectedGroupForView(null);
                      setGroupCheckIns([]);
                      setSearchParams((prev) => { const next = new URLSearchParams(prev); next.delete("group"); next.set("tab", "duels"); return next; }, { replace: true });
                      setActiveTab("duels");
                      // Full refresh of groups
                      void loadGroupsAndRequests({ fresh: true });
                    } catch (error: any) {
                      toast({ title: t("duels_group_leave_error"), description: error?.message || t("duels_group_retry"), variant: "destructive" });
                    }
                  }}
                >
                  {t("duels_group_leave_action")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DrawerContent>
      </Drawer>

      {/* Classifications Modal */}
      <ClassificationsDrawer
        open={isClassificationsOpen}
        onOpenChange={setIsClassificationsOpen}
        groupCheckIns={groupCheckIns}
        scoringType={selectedGroupForView?.scoringType}
        checkInVotes={checkInVotes}
        memeRule={selectedGroupForView?.memeRule}
        onSelectMember={setSelectedMemberForCheckIns}
      />

      {/* Calendário de check-ins de um participante — abre por cima das
          Classificações, ao tocar no nome. */}
      <MemberCheckInsDrawer
        open={!!selectedMemberForCheckIns}
        onOpenChange={(open) => { if (!open) setSelectedMemberForCheckIns(null); }}
        memberName={selectedMemberForCheckIns?.userName ?? ""}
        memberPhoto={selectedMemberForCheckIns?.userPhoto ?? null}
        checkIns={selectedMemberCheckIns}
      />

      {/* Participants Modal */}
      <Drawer open={isParticipantsModalOpen} onOpenChange={(open) => {
        setIsParticipantsModalOpen(open);
        if (!open) setParticipantDetailsId(null);
      }}>
        <DrawerContent
          {...GLASS_SHEET_PROPS}
          style={{ ...GLASS_SHEET_STYLE, maxHeight: "80dvh" }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DrawerHeader className="shrink-0">
            <DrawerTitle className="text-white">Participantes ({groupParticipants.length})</DrawerTitle>
            <DrawerDescription className="sr-only">Lista de participantes do grupo</DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {/* Estatísticas do Grupo */}
            {(() => {
              const totalCheckIns = groupCheckIns.length;

              let avgCheckInsPerDay = 0;
              if (selectedGroupForView?.createdAt) {
                const start = new Date(selectedGroupForView.createdAt).getTime();
                const now = new Date().getTime();
                const diffDays = Math.max(1, Math.ceil((now - start) / (1000 * 60 * 60 * 24)));
                avgCheckInsPerDay = totalCheckIns / diffDays;
              }

              const userReactionsCount: Record<string, { count: number; userName: string; userPhoto: string | null }> = {};
              groupCheckIns.forEach(checkIn => {
                const reactions = checkInReactions[checkIn.id] || [];
                if (!userReactionsCount[checkIn.userId]) {
                  userReactionsCount[checkIn.userId] = {
                    count: 0,
                    userName: checkIn.userName,
                    userPhoto: checkIn.userPhoto
                  };
                }
                userReactionsCount[checkIn.userId].count += reactions.length;
              });

              const topReactionUser = Object.values(userReactionsCount).sort((a, b) => b.count - a.count)[0];

              return (
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="p-3 rounded-lg flex flex-col items-center justify-center text-center" style={GLASS_PANEL_STYLE}>
                    <span className="text-xl font-bold text-brand mb-1">{totalCheckIns}</span>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-white/50">Total Check-ins</span>
                  </div>
                  <div className="p-3 rounded-lg flex flex-col items-center justify-center text-center" style={GLASS_PANEL_STYLE}>
                    <span className="text-xl font-bold text-brand mb-1">{avgCheckInsPerDay.toFixed(1)}</span>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-white/50">Média / Dia</span>
                  </div>
                  <div className="p-3 rounded-lg flex flex-col items-center justify-center text-center" style={GLASS_PANEL_STYLE}>
                    {topReactionUser && topReactionUser.count > 0 ? (
                      <>
                        <div className="flex items-center justify-center gap-1.5 mb-1">
                          <span className="text-xl font-bold text-brand leading-none">{topReactionUser.count}</span>
                          <UserAvatar
                            photo={topReactionUser.userPhoto}
                            nickname={topReactionUser.userName}
                            className="h-6 w-6 border border-white/15"
                          />
                        </div>
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-white/50">Mais Reações</span>
                      </>
                    ) : (
                      <>
                        <span className="text-xl font-bold text-brand mb-1">0</span>
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-white/50">Mais Reações</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="space-y-2">
              {groupParticipants.length > 0 ? (
                groupParticipants.map((participant) => (
                  <div
                    key={participant.userId}
                    onClick={() => setParticipantDetailsId(participant.userId)}
                    className="p-3 rounded-lg flex items-center gap-3 cursor-pointer transition-colors hover:brightness-125" style={GLASS_PANEL_STYLE}
                  >
                    <UserAvatar
                      photo={participant.userPhoto}
                      nickname={participant.userNickname}
                      size="md"
                      className="flex-shrink-0"
                    />
                    <p className="text-sm font-medium flex-1 text-white">{participant.userNickname}</p>
                    {selectedGroupForView?.createdBy === user?.id && participant.userId !== user?.id && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setRemoveMemberConfirm({ open: true, participant }); }}
                        className="p-1.5 rounded-full hover:bg-destructive/10 transition-colors text-white/50 hover:text-destructive flex-shrink-0"
                        title="Remover do grupo"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-center py-4" style={{ color: "rgba(255,255,255,.5)" }}>Nenhum participante ainda</p>
              )}
            </div>
          </div>
          {selectedGroupForView?.createdBy === user?.id && (
            <div className="p-4" style={{ borderTop: "1px solid rgba(255,255,255,.1)" }}>
              <Button
                className="w-full rounded-full gap-2 border-0"
                style={GLASS_PRIMARY_BTN_STYLE}
                onClick={() => {
                  setIsParticipantsModalOpen(false);
                  setIsAddMembersModalOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Adicionar Membros
              </Button>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* Participant Details Modal — opens while the Participants list Drawer
          (default z-300/310, see client/components/ui/drawer.tsx) stays open
          behind it, so it needs to sit strictly above that, not below it. */}
      <Drawer open={!!participantDetailsId} onOpenChange={(open) => !open && setParticipantDetailsId(null)}>
        <DrawerContent
          {...GLASS_SHEET_PROPS}
          className="flex flex-col !rounded-t-[32px] !border-0 z-[330]"
          overlayClassName="z-[320]"
          style={{ ...GLASS_SHEET_STYLE, height: "95dvh", maxHeight: "95dvh" }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {(() => {
            if (!participantDetailsId) return null;
            const pInfo = groupParticipants.find(p => p.userId === participantDetailsId);
            const pCheckIns = groupCheckIns.filter(c => c.userId === participantDetailsId);

            // Get month dates
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
            const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

            const monthNames = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
            const dayNames = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'];

            const monthTitle = `${monthNames[currentMonth]} ${currentYear}`;

            const checkInsByDay: Record<number, GroupCheckIn> = {};
            pCheckIns.forEach(c => {
              const d = new Date(c.createdAt);
              if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                checkInsByDay[d.getDate()] = c;
              }
            });

            const activeDays = new Set(pCheckIns.map(c => {
              const d = new Date(c.createdAt);
              return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            })).size;

            const totalDurationMins = pCheckIns.reduce((acc, c) => acc + (c.exercises?.length || 1) * 15, 0);
            const hours = Math.floor(totalDurationMins / 60);
            const mins = totalDurationMins % 60;
            const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

            return (
              <>
                <DrawerHeader className="shrink-0 flex items-center justify-between pb-2">
                  <button onClick={() => setParticipantDetailsId(null)} className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors"><ChevronLeft className="h-6 w-6 text-white" /></button>
                  <div className="flex-1" />
                </DrawerHeader>

                <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col justify-center">
                  <div className="flex flex-col items-center mb-4">
                    <UserAvatar
                      photo={pInfo?.userPhoto}
                      nickname={pInfo?.userNickname}
                      size="xl"
                      className="mb-2 border-2 border-white/15"
                    />
                    <h2 className="text-lg font-bold text-white">{pInfo?.userNickname}</h2>
                  </div>

                  <div className="flex justify-between w-full mb-6 px-2">
                    <div className="text-center flex-1">
                      <p className="text-lg font-bold leading-none mb-1 text-white">{pCheckIns.length}</p>
                      <p className="text-[11px] text-white/50">Check-ins</p>
                    </div>
                    <div className="text-center flex-1">
                      <p className="text-lg font-bold leading-none mb-1 text-white">{activeDays}</p>
                      <p className="text-[11px] text-white/50">Dias ativos</p>
                    </div>
                    <div className="text-center flex-1">
                      <p className="text-lg font-bold leading-none mb-1 text-white">{durationStr}</p>
                      <p className="text-[11px] text-white/50">Duração</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h3 className="text-center font-bold text-base mb-3 text-white">{monthTitle}</h3>
                    <div className="grid grid-cols-7 gap-y-2 text-center mb-1">
                      {dayNames.map(d => (
                        <div key={d} className="text-[10px] text-white/50">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-y-2 text-center items-center justify-items-center">
                      {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                        <div key={`empty-${i}`} className="w-8 h-8" />
                      ))}
                      {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const checkIn = checkInsByDay[day];
                        return (
                          <div key={day} className="w-8 h-8 flex items-center justify-center relative">
                            {checkIn ? (
                              <div className="w-8 h-8 rounded-full overflow-hidden border border-brand/50 flex-shrink-0">
                                <ImageWithFallback src={checkIn.photo} alt="Check-in" className="w-8 h-8 object-cover" fallback="/placeholder.svg" />
                              </div>
                            ) : (
                              <span className="text-xs font-medium opacity-80 text-white">{day}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-center mt-2 pb-2">
                    <Button variant="secondary" size="sm" className="rounded-full px-8 opacity-50 cursor-not-allowed">
                      Ver todos os check-ins
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DrawerContent>
      </Drawer>

      {/* Add Members Modal */}
      <AddMembersDrawer
        open={isAddMembersModalOpen}
        onOpenChange={setIsAddMembersModalOpen}
        groupId={selectedGroupForView?.id ?? ""}
        followers={followers}
        existingMemberIds={groupParticipants.map((p) => p.userId)}
        onMembersAdded={() => {
          if (selectedGroupForView) {
            getGroupParticipantsDb(selectedGroupForView.id)
              .then(setGroupParticipants)
              .catch((err: any) => {
                console.error("Error refreshing participants:", err);
                toast({ title: "Erro ao atualizar participantes", description: err?.message || "Tente novamente.", variant: "destructive" });
              });
          }
        }}
      />

      <EditCheckInDrawer
        open={isEditCheckInOpen}
        onOpenChange={setIsEditCheckInOpen}
        checkIn={selectedCheckInForDetail}
        onUpdated={({ id, workoutInfo, description, photo, photos }) => {
          setGroupCheckIns((prev) =>
            prev.map((c) => c.id === id ? { ...c, workoutInfo, description, photo: photo ?? c.photo, photos: photos ?? c.photos } : c)
          );
          if (selectedCheckInForDetail?.id === id) {
            setSelectedCheckInForDetail({ ...selectedCheckInForDetail, workoutInfo, description, photo: photo ?? selectedCheckInForDetail.photo, photos: photos ?? selectedCheckInForDetail.photos });
          }
        }}
      />

      {/* Remove Member Confirm Dialog */}
      <AlertDialog open={removeMemberConfirm.open} onOpenChange={(open) => setRemoveMemberConfirm((prev) => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover participante</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover {removeMemberConfirm.participant?.userNickname} do grupo?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRemoveMemberConfirm({ open: false, participant: null })}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                if (!removeMemberConfirm.participant || !selectedGroupForView) return;
                const { userId, userNickname } = removeMemberConfirm.participant;
                setRemoveMemberConfirm({ open: false, participant: null });
                try {
                  await removeGroupMemberDb(selectedGroupForView.id, userId);
                  setGroupParticipants((prev) => prev.filter((p) => p.userId !== userId));
                  setSelectedGroupForView((prev: any) => prev ? { ...prev, participants: Math.max(0, (prev.participants ?? 1) - 1) } : prev);
                  toast({ title: "Participante removido", description: `${userNickname} foi removido do grupo.` });
                } catch (err: any) {
                  toast({ title: "Erro ao remover", description: err?.message || "Tente novamente.", variant: "destructive" });
                }
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Conversation Confirm Dialog */}
      <AlertDialog open={deleteConvConfirmOpen} onOpenChange={setDeleteConvConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conversa</AlertDialogTitle>
            <AlertDialogDescription>
              O histórico com {convToDelete?.userNickname} será removido apenas para você. O outro usuário ainda verá as mensagens.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConvToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                if (!convToDelete) return;
                setDeleteConvConfirmOpen(false);
                try {
                  await deleteConversationForMeDb(convToDelete.userId);
                  setConversations((prev) => prev.filter((c) => c.userId !== convToDelete.userId));
                  toast({ title: "Conversa excluída!" });
                } catch (err: any) {
                  toast({ title: "Erro ao excluir conversa", description: err?.message || "Tente novamente.", variant: "destructive" });
                } finally {
                  setConvToDelete(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Centralized Confirm Dialog */}
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
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                setConfirmDialog((prev) => ({ ...prev, open: false }));
                await confirmDialog.onConfirm();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Paywall: limite de duelos criados no plano grátis */}
      <PaywallDrawer open={duelPaywallOpen} onOpenChange={setDuelPaywallOpen} feature="duels" />
    </div>
  );
}

// formatTimeAgo foi movido para `@/components/community/community-helpers`.
