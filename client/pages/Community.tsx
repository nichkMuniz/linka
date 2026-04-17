import * as React from "react";
import * as ReactDOM from "react-dom";
import {
  getConversationsDb,
  getConversationMessagesDb,
  sendMessageDb,
  uploadMessageImageDb,
  uploadMessageAudioDb,
  markMessagesAsReadDb,
  deleteConversationDb,
  getFollowingDb,
  getRankingDb,
  createDuelGroupDb,
  getDuelGroupDb,
  addGroupCheckInDb,
  getGroupCheckInsDb,
  getGroupCheckInDetailDb,
  getEnrichedDuelGroupsDb,
  getCompletedRoutinesTodayDb,
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
  setCheckInReactionDb,
  sendCheckInReactionNotificationDb,
  type Conversation,
  type MessageWithUser,
  type SearchUser,
  type RankingUser,
  type GroupCheckIn,
  type CompletedRoutine,
  type GroupJoinRequest,
  type CheckInComment,
  type CheckInReaction,
} from "@/lib/ritmofit-db";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// Tabs component replaced by custom underline tabs
import { toast } from "@/components/ui/use-toast";
import { ArrowLeft, Send, Check, CheckCheck, Trophy, TrendingUp, Plus, X, ChevronRight, ChevronDown, Trash2, Edit3, Search, PenSquare, MessageCircle, Users, ChevronLeft, Swords, BarChart2, Pencil, Camera, Image, Mic, Smile, Crop } from "lucide-react";
import { CommentReactions } from "@/components/shared/comment-reactions";
import { ClassificationsDrawer } from "@/components/community/classifications-drawer";
import { NewConversationDrawer } from "@/components/community/new-conversation-drawer";
import { AddMembersDrawer } from "@/components/community/add-members-drawer";
import { EditCheckInDrawer } from "@/components/community/edit-checkin-drawer";
import { ImageCropperDrawer } from "@/components/shared/image-cropper-drawer";
import { PostCarousel } from "@/components/post/post-carousel";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { EmojiPicker } from "@/components/shared/emoji-picker";
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
import { LoadingSpinner } from "@/components/shared/animated-loading";
import { useLayoutMode } from "@/hooks/useLayoutMode";
import { useLanguage } from "@/lib/language-context";
import { UserInsignias } from "@/components/profile/user-insignias";
import { ImageWithFallback } from "@/components/shared/image-with-fallback";
import { UserAvatar } from "@/components/shared/user-avatar";

type ViewMode = "conversations" | "conversation";

export default function Community() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { layoutMode } = useLayoutMode();
  const { t } = useLanguage();

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
  const messageInputRef = React.useRef<HTMLInputElement>(null);
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const [isSendingPhoto, setIsSendingPhoto] = React.useState(false);
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingSeconds, setRecordingSeconds] = React.useState(0);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const recordingTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const [isNewConversationDrawerOpen, setIsNewConversationDrawerOpen] = React.useState(false);

  // Group creation state
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = React.useState(false);
  const [groupStep, setGroupStep] = React.useState<1 | 2 | 3 | 4>(1);
  const [isCreatingGroup, setIsCreatingGroup] = React.useState(false);
  const [groupConfig, setGroupConfig] = React.useState({
    name: "",
    location: "",
    goal: "",
    durationDays: "",
    photo: "",
  });
  const [groupPhotoFile, setGroupPhotoFile] = React.useState<File | null>(null);
  const editCoverInputRef = React.useRef<HTMLInputElement>(null);
  const [selectedInvitees, setSelectedInvitees] = React.useState<Set<string>>(new Set());
  const [userCreatedGroups, setUserCreatedGroups] = React.useState<any[]>([]);
  const [availableGroups, setAvailableGroups] = React.useState<any[]>([]);
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
  const [activeGroupViewTab, setActiveGroupViewTab] = React.useState<"check-ins" | "participants">("check-ins");
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
  // pendingCropSrc: data URL waiting to be cropped; pendingCropIndex: index to replace (-1 = append new)
  const [pendingCropSrc, setPendingCropSrc] = React.useState<string | null>(null);
  const [pendingCropIndex, setPendingCropIndex] = React.useState<number>(-1);

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
  const [participantsSearch, setParticipantsSearch] = React.useState("");
  const [selectedCheckInForDetail, setSelectedCheckInForDetail] = React.useState<GroupCheckIn | null>(null);
  const [isCheckInDetailOpen, setIsCheckInDetailOpen] = React.useState(false);
  const [userNickname, setUserNickname] = React.useState<string>("");
  const [isGroupDetailsOpen, setIsGroupDetailsOpen] = React.useState(false);
  const [isEditingGroupInfo, setIsEditingGroupInfo] = React.useState(false);
  const [editGroupName, setEditGroupName] = React.useState("");
  const [editGroupGoal, setEditGroupGoal] = React.useState("");
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
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const QUICK_EMOJIS = ["❤️", "😂", "😮", "😢", "😡", "👍"];

  const handleMessageLongPress = React.useCallback((message: MessageWithUser) => {
    setLongPressedMessage(message);
  }, []);

  const handleMessageTouchStart = React.useCallback((message: MessageWithUser) => {
    longPressTimer.current = setTimeout(() => {
      handleMessageLongPress(message);
    }, 450);
  }, [handleMessageLongPress]);

  const handleMessageTouchEnd = React.useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
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
      toast({ title: "Comentário editado!" });
    } catch (err: any) {
      toast({ title: "Erro ao editar comentário", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setIsSavingEditComment(false);
    }
  }, [editCommentDraft]);

  const handleDeleteCheckInComment = React.useCallback(async (commentId: string) => {
    setDeletingCommentId(commentId);
    try {
      await deleteCheckInCommentDb(commentId);
      setCheckInComments((prev) => prev.filter((c) => c.id !== commentId));
      toast({ title: "Comentário excluído" });
    } catch (err: any) {
      toast({ title: "Erro ao excluir comentário", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setDeletingCommentId(null);
    }
  }, []);

  const [userPhoto, setUserPhoto] = React.useState<string | null>(null);
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
      })
      .catch((err: any) => console.error("Error loading group data:", err))
      .finally(() => {
        if (activeGroupIdRef.current === group.id) setIsLoadingCheckIns(false);
      });
  }, [setSearchParams]);

  const showConfirm = React.useCallback(
    (title: string, description: string, onConfirm: () => void) => {
      setConfirmDialog({ open: true, title, description, onConfirm });
    },
    [],
  );

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

  // Open a specific check-in when navigating from a notification (state.openCheckIn = checkInId)
  React.useEffect(() => {
    const state = location.state as { openCheckIn?: string } | null;
    if (!state?.openCheckIn) return;
    // Clear nav state so back-navigation doesn't re-trigger
    window.history.replaceState({}, "");
    const checkInId = state.openCheckIn;
    (async () => {
      try {
        const [detail, comments, reactions] = await Promise.all([
          getGroupCheckInDetailDb(checkInId),
          getCheckInCommentsDb(checkInId),
          getCheckInReactionsDb([checkInId]),
        ]);
        if (detail) {
          setSelectedCheckInForDetail(detail);
          setCheckInComments(comments);
          setCheckInReactions((prev) => ({ ...prev, ...reactions }));
          setIsCheckInDetailOpen(true);
          // Switch to the duels tab so the check-in is visible
          setActiveTab("duels");
        }
      } catch (err) {
        console.error("Error opening check-in from notification:", err);
      }
    })();
  }, [location.state]);

  // Load user nickname and groups when user changes
  React.useEffect(() => {
    const loadUserData = async () => {
      if (!user?.id) return;
      try {
        // Fetch nickname and all group data in parallel (no waterfall)
        const [userProfile, { myGroups, availableGroups: enrichedAvailGroups, pendingInvites: invites }, joinRequests] =
          await Promise.all([
            getUserProfileDb(user.id),
            getEnrichedDuelGroupsDb(user.id),
            getPendingGroupRequestsDb(),
          ]);

        const nickname = userProfile?.nickname || user.email?.split("@")[0] || "Usuário";
        setUserNickname(nickname);
        setUserPhoto(userProfile?.photo || null);
        setPendingInvites(invites);
        setPendingGroupRequests(joinRequests);

        const toGroupCard = (group: any) => ({
          ...group,
          icon: "⚔️",
          description: group.goal,
          city: group.location,
          isOfficial: false,
        });

        setUserCreatedGroups(myGroups.map(toGroupCard));

        const alreadyJoined = new Set(
          enrichedAvailGroups.filter((g) => g.isAlreadyMember).map((g) => g.id)
        );
        setJoinedGroupIds(alreadyJoined);
        setAvailableGroups(enrichedAvailGroups.filter((g) => !g.isAlreadyMember).map(toGroupCard));
      } catch (err: any) {
        console.error("Error loading user groups:", err);
      }
    };

    loadUserData();
  }, [user?.id]);

  // Auto-select tab from URL parameter (?tab=requests)
  React.useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "requests") {
      setActiveTab("requests");
    } else if (tabParam === "duels") {
      setActiveTab("duels");
    }
  }, [searchParams]);

  // Refresh pending group requests when switching to the requests tab
  React.useEffect(() => {
    if (activeTab === "requests" && user?.id) {
      getPendingGroupRequestsDb().then(setPendingGroupRequests).catch(() => { });
    }
  }, [activeTab, user?.id]);

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

  // Load conversation messages when selected
  React.useEffect(() => {
    if (!selectedConversation || viewMode !== "conversation") return;

    // Clear messages immediately so previous conversation's messages never bleed through
    setMessages([]);

    const targetUserId = selectedConversation.userId;

    const loadMessages = async () => {
      try {
        const data = await getConversationMessagesDb(targetUserId);

        // Only update state if this conversation is still the selected one
        setSelectedConversation((current) => {
          if (current?.userId !== targetUserId) return current;
          setMessages(data);
          return current;
        });

        // Mark messages as read
        await markMessagesAsReadDb(targetUserId);

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
      }
    };

    loadMessages();
  }, [selectedConversation?.userId, viewMode]);

  // Auto-scroll to bottom when messages change
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = React.useCallback(async () => {
    if (!messageText.trim() || !selectedConversation) return;

    const replyText = replyingTo ? `↩ ${replyingTo.text}\n\n` : "";
    const fullText = replyText + messageText;

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
  }, [messageText, selectedConversation]);

  const handlePhotoSend = React.useCallback(async (file: File) => {
    if (!selectedConversation) return;
    setIsSendingPhoto(true);
    try {
      const url = await uploadMessageImageDb(file);
      const imageText = `[image]:${url}`;
      const newMessage = await sendMessageDb(selectedConversation.userId, imageText);
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
  }, [selectedConversation]);

  const startRecording = React.useCallback(async () => {
    if (!selectedConversation) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.start(200);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      toast({ title: "Sem acesso ao microfone", description: "Permita o uso do microfone nas configurações.", variant: "destructive" });
    }
  }, [selectedConversation]);

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

    const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    if (blob.size < 500) return; // muito curto, ignorar

    setIsSendingPhoto(true); // reutiliza loader visual
    try {
      const url = await uploadMessageAudioDb(blob);
      const audioText = `[audio]:${url}`;
      const newMessage = await sendMessageDb(selectedConversation.userId, audioText);
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
  }, [selectedConversation]);

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

  // Realtime: append new message instead of full reload
  React.useEffect(() => {
    if (!selectedConversation || !user || !supabase) return;
    const channel = supabase
      .channel(`messages:${selectedConversation.userId}`)
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
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedConversation?.userId, user?.id]);

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
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <LoadingSpinner className="h-12 w-12" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (activeTab === "messages" && viewMode === "conversation" && selectedConversation) {
    const bottomClass = layoutMode === "novo"
      ? "bottom-0"
      : "bottom-[calc(4.25rem+env(safe-area-inset-bottom))] md:bottom-0";

    return ReactDOM.createPortal(
      <div className={`fixed top-0 right-0 ${bottomClass} bg-background flex flex-col z-[100]`} style={{ left: "var(--sidebar-width, 0px)" }}>
        {/* Header */}
        <div className="flex-shrink-0 border-b border-border/60 bg-background px-4 py-3 flex items-center gap-3" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
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
              gender={selectedConversation.userGender}
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
        <div className="flex-1 overflow-y-auto space-y-4 px-4 py-4">
          {/* Profile card — always shown at top of conversation */}
          <div className="flex flex-col items-center gap-3 py-6 mb-2">
            <UserAvatar
              photo={selectedConversation.userPhoto}
              gender={selectedConversation.userGender}
              nickname={selectedConversation.userNickname}
              className="w-20 h-20 ring-2 ring-border"
            />
            <p className="font-semibold text-base">{selectedConversation.userNickname}</p>
            {selectedConversation.userBio && (
              <p className="text-sm text-muted-foreground text-center max-w-xs px-4">{selectedConversation.userBio}</p>
            )}
            <button
              onClick={() => navigate(`/usuario/${selectedConversation.userId}`)}
              className="px-5 py-2 rounded-xl bg-muted hover:bg-muted/70 text-sm font-medium transition-colors"
            >
              Ver perfil
            </button>
          </div>

          {messages.length > 0 ? (
            messages.map((message) => {
              const isOwn = message.user_id === user?.id;
              // Detect reply prefix: lines starting with "↩ "
              const replyMatch = message.text.match(/^↩ (.+?)\n\n([\s\S]*)$/);
              const replyQuote = replyMatch ? replyMatch[1] : null;
              const mainText = replyMatch ? replyMatch[2] : message.text;
              return (
                <div
                  key={message.id}
                  className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                >
                  <div className="relative">
                    <div
                      onTouchStart={() => handleMessageTouchStart(message)}
                      onTouchEnd={handleMessageTouchEnd}
                      onTouchMove={handleMessageTouchEnd}
                      onContextMenu={(e) => { e.preventDefault(); handleMessageLongPress(message); }}
                      className={`max-w-xs px-4 py-2 rounded-lg space-y-1 break-words select-none ${isOwn
                          ? "bg-brand text-white rounded-br-none"
                          : "bg-muted rounded-bl-none"
                        }`}
                    >
                      {replyQuote && (
                        <div className={`text-xs px-2 py-1 rounded mb-1 border-l-2 ${isOwn ? "bg-white/10 border-white/50 text-white/80" : "bg-muted-foreground/10 border-muted-foreground/40 text-muted-foreground"}`}>
                          <p className="truncate">{replyQuote}</p>
                        </div>
                      )}
                      {mainText.startsWith("[image]:") ? (
                        <img
                          src={mainText.replace("[image]:", "")}
                          alt="Imagem"
                          className="rounded-lg max-w-[220px] max-h-[280px] object-cover cursor-pointer"
                          onClick={() => window.open(mainText.replace("[image]:", ""), "_blank")}
                        />
                      ) : mainText.startsWith("[audio]:") ? (
                        <audio
                          src={mainText.replace("[audio]:", "")}
                          controls
                          className="max-w-[220px] h-10 rounded-lg"
                          style={{ colorScheme: isOwn ? "dark" : "light" }}
                        />
                      ) : (
                        <p className="text-sm">{mainText}</p>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`text-xs ${isOwn ? "text-white/70" : "text-muted-foreground"
                            }`}
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
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center text-muted-foreground text-sm">
              Sem mensagens ainda. Inicie uma conversa!
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply banner */}
        {replyingTo && (
          <div className="flex-shrink-0 border-t border-border/60 bg-muted/40 px-4 py-2 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-0.5">Respondendo</p>
              <p className="text-xs truncate">{replyingTo.text.replace(/^↩ .+?\n\n/, "")}</p>
            </div>
            <button onClick={() => setReplyingTo(null)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Input — estilo Instagram */}
        {isRecording ? (
          /* ── Modo gravação ── */
          <div className="flex-shrink-0 border-t border-border/60 bg-background px-3 py-2 flex items-center gap-3">
            {/* Cancelar */}
            <button
              onClick={cancelRecording}
              className="flex-shrink-0 text-muted-foreground hover:text-destructive transition-colors p-1.5"
              title="Cancelar gravação"
            >
              <X className="h-6 w-6" />
            </button>
            {/* Indicador de gravação */}
            <div className="flex-1 flex items-center gap-2 bg-muted/50 rounded-full px-4 py-2 border border-border/40">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
              <span className="text-sm text-muted-foreground flex-1">
                Gravando... {Math.floor(recordingSeconds / 60).toString().padStart(2, "0")}:{(recordingSeconds % 60).toString().padStart(2, "0")}
              </span>
            </div>
            {/* Enviar */}
            <button
              onClick={stopRecordingAndSend}
              className="flex-shrink-0 bg-brand text-white rounded-full p-2 hover:opacity-80 transition-opacity"
              title="Enviar áudio"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="flex-shrink-0 border-t border-border/60 bg-background px-3 py-2 flex items-center gap-2">
            {/* Câmera */}
            <button
              className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1.5"
              onClick={() => photoInputRef.current?.click()}
              disabled={isSendingPhoto}
              title="Enviar foto da câmera"
            >
              {isSendingPhoto ? (
                <div className="h-5 w-5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera className="h-6 w-6" />
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
            <div className="flex-1 flex items-center bg-muted/50 rounded-full px-4 py-1.5 gap-2 border border-border/40">
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
                className="border-0 bg-transparent p-0 h-auto text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 flex-1"
              />
              {/* Emoji picker real */}
              <EmojiPicker
                placement="top"
                onSelect={(emoji) => setMessageText((prev) => prev + emoji)}
                triggerClassName="flex-shrink-0 p-0.5"
              />
            </div>

            {/* Ações à direita: quando sem texto → galeria + mic; quando com texto → enviar */}
            {messageText.trim() ? (
              <button
                onClick={handleSendMessage}
                disabled={isSending}
                className="flex-shrink-0 text-brand hover:opacity-80 transition-opacity p-1.5"
                title="Enviar mensagem"
              >
                <Send className="h-5 w-5" />
              </button>
            ) : (
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Galeria */}
                <button
                  className="text-muted-foreground hover:text-foreground transition-colors p-1.5"
                  title="Enviar da galeria"
                  onClick={() => {
                    if (photoInputRef.current) {
                      photoInputRef.current.removeAttribute("capture");
                      photoInputRef.current.click();
                      setTimeout(() => photoInputRef.current?.setAttribute("capture", "environment"), 500);
                    }
                  }}
                >
                  <Image className="h-6 w-6" />
                </button>
                {/* Microfone — iniciar gravação */}
                <button
                  className="text-muted-foreground hover:text-foreground transition-colors p-1.5"
                  title="Gravar áudio"
                  onMouseDown={startRecording}
                  onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                >
                  <Mic className="h-6 w-6" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Long-press overlay */}
        {longPressedMessage && (
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
                <p className="text-xs text-muted-foreground mb-1">Mensagem</p>
                <p className="text-sm line-clamp-2">{longPressedMessage.text.replace(/^↩ .+?\n\n/, "")}</p>
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
                <span className="text-sm font-medium">Responder</span>
              </button>
              <button
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left border-t border-border/40"
                onClick={() => setLongPressedMessage(null)}
              >
                <X className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">Cancelar</span>
              </button>
            </div>
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
    <div className="w-full h-[calc(100dvh-68px)] md:h-[calc(100dvh-48px)] flex flex-col overflow-hidden">
      {/* Tabs — segmented control style (igual à tela de Loja) */}
      <div className="flex-shrink-0 border-b border-border/60 px-4 pt-5 pb-3 md:pt-4">
        <div className="flex items-center gap-3">
          {/* Segmented tabs */}
          <div className="flex flex-1 rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setActiveTab("messages")}
              className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 transition-colors ${activeTab === "messages" ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground"}`}
            >
              <MessageCircle className="h-4 w-4" />
              {t("community_messages")}
            </button>
            <button
              onClick={() => setActiveTab("duels")}
              className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 transition-colors ${activeTab === "duels" ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Swords className="h-4 w-4" />
              {t("community_duels")}
            </button>
            <button
              onClick={() => setActiveTab("ranking")}
              className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 transition-colors ${activeTab === "ranking" ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground"}`}
            >
              <BarChart2 className="h-4 w-4" />
              {t("community_ranking")}
            </button>
          </div>

          {/* Solicitações pendentes — badge compacto */}
          {(pendingInvites.length > 0 || pendingGroupRequests.length > 0) && (
            <button
              onClick={() => setActiveTab("requests")}
              aria-label="Solicitações pendentes"
              className={`relative p-2 rounded-lg border border-border transition-colors ${activeTab === "requests" ? "bg-brand text-white border-brand" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar conversa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-full pl-9 bg-muted/30 border-transparent focus:border-border/60 focus:bg-background"
              />
            </div>
            <button
              aria-label="Nova conversa"
              onClick={() => { setIsNewConversationDrawerOpen(true); }}
              className="flex-shrink-0 p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors"
            >
              <PenSquare className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length > 0 ? (
              <div className="divide-y divide-border/40">
                {filteredConversations.map((conversation) => (
                  <div key={conversation.userId} className="flex items-center group">
                    <button
                      onClick={() => handleOpenConversation(conversation)}
                      className="flex-1 flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 active:bg-muted/50 transition-colors text-left min-w-0"
                    >
                      {/* Avatar com ring se não lido */}
                      <div className="relative shrink-0">
                        <UserAvatar
                          photo={conversation.userPhoto}
                          gender={conversation.userGender}
                          nickname={conversation.userNickname}
                          size="lg"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <p className={`text-sm truncate ${conversation.unreadCount > 0 ? "font-semibold text-foreground" : "font-medium"}`}>
                            {conversation.userNickname}
                          </p>
                          <p className={`text-xs shrink-0 ${conversation.unreadCount > 0 ? "text-brand font-medium" : "text-muted-foreground"}`}>
                            {formatTimeAgo(conversation.lastMessageTime)}
                          </p>
                        </div>
                        <p className={`text-sm truncate ${conversation.unreadCount > 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                          {conversation.lastMessage || "Iniciar conversa"}
                        </p>
                      </div>

                      {conversation.unreadCount > 0 && (
                        <div className="flex items-center justify-center h-5 w-5 rounded-full bg-brand text-white text-[11px] font-bold shrink-0">
                          {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
                        </div>
                      )}
                    </button>
                    <button
                      onClick={() => { setConvToDelete(conversation); setDeleteConvConfirmOpen(true); }}
                      className="px-3 py-3.5 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                      aria-label="Excluir conversa"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                {/* Separador para sugestões quando há busca */}
                {searchQuery && filteredFollowers.filter(f => !conversations.some(c => c.userId === f.id)).length > 0 && (
                  <div className="px-4 pt-4 pb-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sugestões</p>
                  </div>
                )}
                {searchQuery && filteredFollowers.filter(f => !conversations.some(c => c.userId === f.id)).map((follower) => (
                  <button
                    key={follower.id}
                    onClick={() => { setSelectedConversation({ userId: follower.id, userNickname: follower.nickname, userPhoto: follower.photo, userGender: follower.gender, lastMessage: "", lastMessageTime: new Date().toISOString(), unreadCount: 0 }); setViewMode("conversation"); }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors text-left"
                  >
                    <div className="shrink-0">
                      <UserAvatar
                        photo={follower.photo}
                        gender={follower.gender}
                        nickname={follower.nickname}
                        size="lg"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{follower.nickname}</p>
                      {follower.bio && <p className="text-xs text-muted-foreground truncate">{follower.bio}</p>}
                    </div>
                  </button>
                ))}
              </div>
            ) : filteredFollowers.length > 0 ? (
              <div>
                <div className="px-4 py-5 text-center space-y-2">
                  <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground/40" />
                  <p className="text-sm font-medium">Nenhuma conversa ainda</p>
                  <p className="text-xs text-muted-foreground">Escolha alguém abaixo para começar</p>
                </div>
                <div className="px-4 pb-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quem você segue</p>
                </div>
                <div className="divide-y divide-border/40">
                  {filteredFollowers.map((follower) => (
                    <button
                      key={follower.id}
                      onClick={() => { setSelectedConversation({ userId: follower.id, userNickname: follower.nickname, userPhoto: follower.photo, userGender: follower.gender, lastMessage: "", lastMessageTime: new Date().toISOString(), unreadCount: 0 }); setViewMode("conversation"); }}
                      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors text-left"
                    >
                      <div className="shrink-0">
                        {follower.photo ? (
                          <ImageWithFallback src={follower.photo} alt={follower.nickname} className="h-12 w-12 rounded-full object-cover" fallback="/placeholder.svg" />
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                            <span className="text-sm font-semibold text-muted-foreground">{follower.nickname?.charAt(0).toUpperCase() || "?"}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{follower.nickname}</p>
                        {follower.bio && <p className="text-xs text-muted-foreground truncate">{follower.bio}</p>}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-8 text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center">
                  <MessageCircle className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Nenhuma conversa</p>
                  <p className="text-xs text-muted-foreground">Siga pessoas para poder trocar mensagens</p>
                </div>
                <Button onClick={() => navigate("/buscar")} className="rounded-full" size="sm">
                  Encontrar pessoas
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Duels Tab - Full Screen Group View */}
      {selectedGroupForView && ReactDOM.createPortal(
        <div className="fixed top-0 right-0 bottom-0 bg-background flex flex-col z-[100]" style={{ left: "var(--sidebar-width, 0px)" }}>
          {/* Header with Back Button */}
          <div className="flex-shrink-0 px-4 pb-0 flex items-center justify-start border-b border-border/40" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
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
              className="p-2 hover:bg-muted rounded-full transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="pb-32">
              {/* Hero Banner Section */}
              <div className="relative h-48 flex items-end border-b border-border/40 overflow-hidden">
                {selectedGroupForView.photo ? (
                  <img
                    src={selectedGroupForView.photo}
                    alt={selectedGroupForView.name}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-brand/20 via-brand/10 to-background" />
                )}
                <div className="relative z-10 w-full px-4 pb-4 bg-gradient-to-t from-black/60 to-transparent">
                  {!selectedGroupForView.photo && (
                    <div className="text-5xl mb-2">{selectedGroupForView.icon}</div>
                  )}
                  <h1 className="text-2xl font-bold text-white drop-shadow">{selectedGroupForView.name}</h1>
                </div>
                {selectedGroupForView.createdBy === user?.id && (
                  <>
                    <input
                      ref={editCoverInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !selectedGroupForView) return;
                        try {
                          const photoUrl = await updateGroupPhotoDb(selectedGroupForView.id, file);
                          setSelectedGroupForView({ ...selectedGroupForView, photo: photoUrl });
                          setUserCreatedGroups((prev) =>
                            prev.map((g) => g.id === selectedGroupForView.id ? { ...g, photo: photoUrl } : g)
                          );
                          toast({ title: "Capa atualizada!" });
                        } catch {
                          toast({ title: "Erro ao salvar capa", variant: "destructive" });
                        }
                      }}
                    />
                    <button
                      className="absolute top-3 right-3 z-20 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
                      onClick={() => editCoverInputRef.current?.click()}
                      title="Editar capa"
                    >
                      <Edit3 className="h-4 w-4 text-white" />
                    </button>
                  </>
                )}
              </div>

              {/* Stats Section */}
              <div className="px-4 py-4 space-y-2">
                {(() => {
                  // Calculate leader stats
                  const leaderStats = groupCheckIns.length > 0
                    ? Object.entries(
                      groupCheckIns.reduce((acc: { [key: string]: { userName: string; count: number } }, checkIn) => {
                        if (!acc[checkIn.userId]) {
                          acc[checkIn.userId] = { userName: checkIn.userName, count: 0 };
                        }
                        acc[checkIn.userId].count++;
                        return acc;
                      }, {})
                    )
                      .sort((a, b) => b[1].count - a[1].count)
                      .map(([userId, data]) => ({ userId, ...data }))[0]
                    : null;

                  // Calculate user ranking position
                  const userRanking = groupCheckIns.length > 0
                    ? Object.entries(
                      groupCheckIns.reduce((acc: { [key: string]: { userName: string; count: number } }, checkIn) => {
                        if (!acc[checkIn.userId]) {
                          acc[checkIn.userId] = { userName: checkIn.userName, count: 0 };
                        }
                        acc[checkIn.userId].count++;
                        return acc;
                      }, {})
                    )
                      .sort((a, b) => b[1].count - a[1].count)
                      .findIndex(([userId]) => userId === user?.id) + 1
                    : 0;

                  // Calculate days remaining
                  const daysRemaining = selectedGroupForView.endDate
                    ? Math.ceil(
                      (new Date(selectedGroupForView.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                    )
                    : null;

                  return (
                    <div className="grid grid-cols-3 gap-3">
                      {/* Leader Card */}
                      <button
                        onClick={() => setIsClassificationsOpen(true)}
                        className="p-3 rounded-lg bg-muted/30 border border-border/40 text-center flex flex-col items-center hover:bg-muted/50 active:scale-95 transition-all"
                      >
                        <div className="text-lg font-bold text-brand mb-1">
                          {leaderStats?.count || 0}
                        </div>
                        {leaderStats?.userName && (
                          <div className="text-xs text-muted-foreground truncate w-full">
                            {leaderStats.userName}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">Líder</div>
                      </button>

                      {/* User Ranking Card */}
                      <button
                        onClick={() => setIsClassificationsOpen(true)}
                        className="p-3 rounded-lg bg-muted/30 border border-border/40 text-center hover:bg-muted/50 active:scale-95 transition-all"
                      >
                        <div className="text-lg font-bold text-brand mb-2">
                          {userRanking > 0 ? `#${userRanking}` : "-"}
                        </div>
                        <div className="text-xs text-muted-foreground">Você</div>
                      </button>

                      {/* Days Remaining Card */}
                      <button
                        onClick={() => setIsGroupDetailsOpen(true)}
                        className="p-3 rounded-lg bg-muted/30 border border-border/40 text-center hover:bg-muted/50 active:scale-95 transition-all"
                      >
                        <div className="text-lg font-bold text-brand mb-2">
                          {daysRemaining !== null ? (daysRemaining > 0 ? daysRemaining : "Fim") : "-"}
                        </div>
                        <div className="text-xs text-muted-foreground">dias</div>
                      </button>
                    </div>
                  );
                })()}
              </div>

              {/* Divider */}
              <div className="px-4 py-3">
                <div className="h-px bg-border/40"></div>
              </div>

              {/* Tabs Header */}
              <div className="px-4 py-2 flex gap-4 border-b border-border/40">
                <button
                  onClick={() => setActiveGroupViewTab("check-ins")}
                  className={`px-2 py-2 text-sm font-medium transition-colors ${activeGroupViewTab === "check-ins"
                      ? "text-foreground border-b-2 border-brand -mb-[2px]"
                      : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  Histórico ({groupCheckIns.length})
                </button>
              </div>

              {/* Check-ins Tab */}
              {activeGroupViewTab === "check-ins" && (
                <div className="space-y-4 px-3 py-4">
                  {isLoadingCheckIns ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="animate-pulse flex gap-3 p-3 rounded-lg bg-muted/30 border border-border/40">
                          <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0" />
                          <div className="flex-1 space-y-2">
                            <div className="h-3 bg-muted rounded w-1/3" />
                            <div className="h-2 bg-muted rounded w-1/2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : groupCheckIns.length > 0 ? (() => {
                    // Sort newest first then group by day
                    const sorted = [...groupCheckIns].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                    const grouped: { label: string; items: typeof sorted }[] = [];
                    const seenDays = new Map<string, typeof sorted>();
                    for (const checkIn of sorted) {
                      const d = new Date(checkIn.createdAt);
                      const dayKey = d.toDateString();
                      const today = new Date();
                      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
                      const label = dayKey === today.toDateString() ? "Hoje" : dayKey === yesterday.toDateString() ? "Ontem" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
                      if (!seenDays.has(dayKey)) {
                        seenDays.set(dayKey, []);
                        grouped.push({ label, items: seenDays.get(dayKey)! });
                      }
                      seenDays.get(dayKey)!.push(checkIn);
                    }
                    return grouped.map((group) => (
                      <div key={group.label}>
                        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">{group.label}</p>
                        <div className="space-y-2">
                          {group.items.map((checkIn) => {
                            const reactions = checkInReactions[checkIn.id] ?? [];
                            const groupedReactions = CHECKIN_QUICK_EMOJIS
                              .map((emoji) => ({ emoji, count: reactions.filter((r) => r.emoji === emoji).length }))
                              .filter((g) => g.count > 0);
                            return (
                              <div
                                key={checkIn.id}
                                className="relative"
                              >
                                <div
                                  className="flex items-center gap-3 px-1 py-2 rounded-lg hover:bg-muted/40 active:bg-muted/60 transition-colors cursor-pointer select-none"
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
                                  {/* Avatar */}
                                  <UserAvatar
                                    photo={checkIn.userPhoto}
                                    gender={checkIn.userGender}
                                    nickname={checkIn.userName}
                                    className="w-8 h-8 flex-shrink-0"
                                  />
                                  {/* Content */}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate text-foreground/90">
                                      {checkIn.description || checkIn.workoutInfo}
                                    </p>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs text-muted-foreground truncate">{checkIn.userName}</span>
                                      {checkIn.muscleGroup && (
                                        <span className="text-[10px] bg-brand/10 text-brand px-1 py-0.5 rounded-full shrink-0 leading-none">{checkIn.muscleGroup}</span>
                                      )}
                                    </div>
                                  </div>
                                  {/* Right side: thumbnail + time always */}
                                  <div className="flex flex-col items-end gap-1 shrink-0">
                                    {checkIn.photo && (
                                      <div className="w-16 h-14 rounded-lg overflow-hidden bg-muted">
                                        <img src={checkIn.photo} alt="check-in" className="w-full h-full object-cover" />
                                      </div>
                                    )}
                                    <span className="text-[11px] text-muted-foreground">{new Date(checkIn.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                </div>
                                {/* Emoji reactions — all users */}
                                {groupedReactions.length > 0 && (
                                  <div className="flex items-center gap-1 flex-wrap pt-1 pl-11">
                                    {groupedReactions.map(({ emoji, count }) => (
                                      <span key={emoji} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs bg-muted/50 border border-border/40 leading-none">
                                        {emoji} {count > 1 && <span className="font-medium">{count}</span>}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })() : (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum check-in ainda</p>
                  )}

                </div>
              )}

            </div>
          </div>

          {/* Bottom Navigation Tabs */}
          <div className="fixed bottom-0 right-0 bg-background border-t border-border/40 z-[52]" style={{ left: "var(--sidebar-width, 0px)" }}>
            <div className="flex items-center justify-around h-16 px-4">
              <button
                onClick={() => setIsGroupDetailsOpen(true)}
                className="flex flex-col items-center justify-center gap-1 flex-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="text-xl">📋</span>
                <span className="text-xs">Detalhes</span>
              </button>
              <button
                onClick={() => setIsParticipantsModalOpen(true)}
                className="flex flex-col items-center justify-center gap-1 flex-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="text-xl">👥</span>
                <span className="text-xs">Participantes</span>
              </button>
              <button
                onClick={() => setIsClassificationsOpen(true)}
                className="flex flex-col items-center justify-center gap-1 flex-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="text-xl">🏆</span>
                <span className="text-xs">Classificações</span>
              </button>
            </div>
          </div>

          {/* Centered Add Check-in Button at Bottom */}
          <div className="fixed bottom-[88px] right-4 z-[101]">
            <button
              onClick={() => {
                if (!user?.id) return;
                // Open modal immediately — load routines in background
                setSelectedRoutineKey(null);
                setCheckInForm({ photo: "", description: "", workoutId: "" });
                setCheckInPhotoFiles([]);
                setCheckInPhotoPreviewUrls([]);
                setCompletedRoutines([]);
                setIsAddCheckInModalOpen(true);
                setIsLoadingRoutines(true);
                getCompletedRoutinesTodayDb(user.id)
                  .then(setCompletedRoutines)
                  .catch((err: any) => { console.error("Error loading completed routines:", err); })
                  .finally(() => setIsLoadingRoutines(false));
              }}
              className="h-14 w-14 rounded-full bg-brand text-white flex items-center justify-center hover:bg-brand/90 transition-colors shadow-lg"
              title="Adicionar check-in"
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>

          {/* Check-in Emoji Long-Press Overlay */}
          {longPressedCheckIn && (
            <div
              className="fixed inset-0 z-[100] bg-black/40 flex items-end justify-center pb-12"
              onClick={() => setLongPressedCheckIn(null)}
            >
              <div
                className="bg-background rounded-2xl w-full max-w-sm mx-4 overflow-hidden shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Preview */}
                <div className="px-4 py-3 border-b border-border/60">
                  <p className="text-xs text-muted-foreground mb-0.5">Check-in de {longPressedCheckIn.userName}</p>
                  <p className="text-sm line-clamp-2 font-medium">{longPressedCheckIn.description || longPressedCheckIn.workoutInfo}</p>
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
                        {isActive && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-brand" />}
                      </button>
                    );
                  })}
                </div>

                {/* Cancelar */}
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left border-t border-border/40"
                  onClick={() => setLongPressedCheckIn(null)}
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">Cancelar</span>
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
          {/* Header */}
          <div className="flex-shrink-0 px-4 pt-4 pb-0 flex items-center justify-start">
            <h1 className="text-2xl font-bold tracking-tight">{t("community_duels")}</h1>
          </div>

          {/* Duels Grid */}
          <div className="flex-1 overflow-y-auto px-3 pb-4 pt-4 space-y-6">
            {/* User Created Groups Section */}
            {userCreatedGroups.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-brand mb-3">{t("duels_my_groups")}</h2>
                <div className="grid grid-cols-2 gap-3">
                  {userCreatedGroups.map((group) => (
                    <Card
                      key={group.id}
                      className="border-border/60 hover:shadow-md transition-shadow flex flex-col"
                    >
                      <CardContent className="p-3 flex flex-col h-full">
                        <div className="flex items-start gap-2 mb-2">
                          <span className="text-2xl flex-shrink-0">{group.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-xs line-clamp-2">{group.name}</p>
                            <span className="inline-block text-xs bg-brand/20 text-brand px-1.5 py-0.5 rounded-full mt-0.5">
                              {group.createdBy === user?.id ? "Seu Grupo" : "Participante"}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{group.description}</p>
                        {/* Creator info */}
                        {(
                          <div className="flex items-center gap-1.5 mb-2">
                            {group.creatorPhoto ? (
                              <img
                                src={group.creatorPhoto}
                                alt={group.creatorNickname}
                                className="h-5 w-5 rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                <span className="text-[9px] font-semibold text-muted-foreground">
                                  {group.creatorNickname?.[0]?.toUpperCase() || "?"}
                                </span>
                              </div>
                            )}
                            <span className="text-xs text-muted-foreground truncate">
                              por <span className="font-medium">{group.creatorNickname}</span>
                            </span>
                          </div>
                        )}
                        <div className="space-y-2 mb-3 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">👥 {group.participants}</span>
                            <span className="text-xs text-muted-foreground">📍 {group.city}</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="w-full rounded-full text-xs h-8"
                          onClick={() => openGroupView(group)}
                        >
                          {t("duels_view")}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* All Groups Section */}
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">{t("duels_all_groups")}</h2>
              {availableGroups.length === 0 ? (
                <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-center">
                  <p className="text-xs text-muted-foreground">{t("duels_no_groups")}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {availableGroups.map((group) => (
                    <Card
                      key={group.id}
                      className="border-border/60 hover:shadow-md transition-shadow flex flex-col"
                    >
                      <CardContent className="p-3 flex flex-col h-full">
                        <div className="flex items-start gap-2 mb-2">
                          <span className="text-2xl flex-shrink-0">{group.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-xs line-clamp-2">{group.name}</p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{group.description}</p>
                        {/* Creator info */}
                        <div className="flex items-center gap-1.5 mb-3">
                          <UserAvatar
                            photo={group.creatorPhoto}
                            gender={group.creatorGender}
                            nickname={group.creatorNickname}
                            className="h-5 w-5 flex-shrink-0"
                          />
                          <span className="text-xs text-muted-foreground truncate">
                            por <span className="font-medium">{group.creatorNickname}</span>
                          </span>
                        </div>
                        <div className="space-y-2 mb-3 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">👥 {group.participants}</span>
                            <span className="text-xs text-muted-foreground">📍 {group.city}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {joinedGroupIds.has(group.id) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full rounded-full text-xs h-8"
                              onClick={() => openGroupView(group)}
                            >
                              {t("duels_view")}
                            </Button>
                          )}
                          {!joinedGroupIds.has(group.id) && !group.isPending && (
                            <Button
                              size="sm"
                              className="w-full rounded-full text-xs h-8"
                              disabled={joiningGroupId === group.id}
                              onClick={async () => {
                                if (!user) return;
                                setJoiningGroupId(group.id);
                                try {
                                  await addMembersToGroupDb(group.id, [user.id]);
                                  // Notify the group creator about the join request
                                  if (group.createdBy) {
                                    await sendGroupJoinRequestNotificationDb(group.id, group.createdBy);
                                  }
                                  setAvailableGroups((prev) =>
                                    prev.map((g) =>
                                      g.id === group.id
                                        ? { ...g, isPending: true }
                                        : g
                                    )
                                  );
                                  toast({ title: "Solicitação enviada!", description: "Aguarde a aprovação do administrador." });
                                } catch (err: any) {
                                  console.error("Error joining group:", err);
                                } finally {
                                  setJoiningGroupId(null);
                                }
                              }}
                            >
                              {joiningGroupId === group.id ? "Enviando..." : "Solicitar Entrada"}
                            </Button>
                          )}
                          {!joinedGroupIds.has(group.id) && group.isPending && (
                            <Button size="sm" variant="outline" className="w-full rounded-full text-xs h-8" disabled>
                              ⏳ Pendente
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Floating Create Group Button */}
          <div className="fixed bottom-20 right-4 z-[53]">
            <button
              onClick={() => {
                setGroupStep(1);
                setGroupConfig({ name: "", location: "", goal: "", durationDays: "", photo: "" });
                setSelectedInvitees(new Set());
                setIsCreateGroupModalOpen(true);
              }}
              className="h-14 w-14 rounded-full bg-brand text-white flex items-center justify-center hover:bg-brand/90 transition-colors shadow-lg"
              title={t("duels_create")}
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>
        </>
      )}

      {/* Ranking Tab */}
      {activeTab === "ranking" && (
        <>
          {/* Header */}
          <div className="flex-shrink-0 px-4 pt-4 pb-0">
            <h1 className="text-2xl font-bold tracking-tight">{t("community_ranking")}</h1>
          </div>

          {/* Ranking List */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3 pt-4">
            {ranking.length > 0 ? (
              <div className="space-y-2">
                {ranking.map((rankUser, index) => {
                  const medalEmoji =
                    index === 0
                      ? "🥇"
                      : index === 1
                        ? "🥈"
                        : index === 2
                          ? "🥉"
                          : "";

                  const isCurrentUser = rankUser.userId === user?.id;

                  return (
                    <Card key={rankUser.userId} className={`border-border/60 ${isCurrentUser ? "ring-2 ring-brand" : ""}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="flex-shrink-0 w-12 text-center">
                            {medalEmoji ? (
                              <span className="text-2xl">{medalEmoji}</span>
                            ) : (
                              <span className="text-lg font-bold text-muted-foreground">
                                #{index + 1}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 flex-1">
                            <UserAvatar
                              photo={rankUser.userPhoto}
                              gender={rankUser.userGender}
                              nickname={rankUser.userNickname}
                              size="lg"
                            />

                            <div className="flex-1">
                              <p className="font-semibold text-sm">
                                {rankUser.userNickname}
                                {isCurrentUser && <span className="ml-1 text-xs text-brand">({t("ranking_you")})</span>}
                              </p>

                            </div>
                          </div>

                          <div className="flex-shrink-0 text-right">
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-4 w-4 text-brand" />
                              <span className="font-bold text-brand">
                                {rankUser.points}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {t("ranking_points")}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-6 text-center">
                <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium mb-1">{t("ranking_empty")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("ranking_empty_desc")}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Solicitações (Pending Invites + Group Join Requests) Tab */}
      {activeTab === "requests" && (
        <>
          <div className="flex-shrink-0 px-4 pt-4 pb-0">
            <h1 className="text-2xl font-bold tracking-tight">Solicitações</h1>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4 space-y-3">

            {/* Convites recebidos pelo usuário */}
            {pendingInvites.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Convites recebidos</p>
                {pendingInvites.map((invite) => (
                  <Card key={invite.groupId} className="border-border/60 mb-3">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">⚔️</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{invite.groupName}</p>
                          <p className="text-xs text-muted-foreground truncate">{invite.groupGoal}</p>
                          <p className="text-xs text-muted-foreground">{invite.groupLocation}</p>
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
                              toast({ title: "Convite aceito!", description: `Você entrou em "${invite.groupName}".` });

                              // Navigate directly to the group detail view (open instantly)
                              const group = await getDuelGroupDb(invite.groupId);
                              if (group) {
                                setActiveTab("duels");
                                openGroupView(group);
                              }
                            } catch (err: any) {
                              toast({ title: "Erro", description: err?.message || "Tente novamente", variant: "destructive" });
                            }
                          }}
                        >
                          Aceitar
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
                              if (user?.id) {
                                const toGroupCard = (g: any) => ({ ...g, icon: "⚔️", description: g.goal, city: g.location, isOfficial: false });
                                getEnrichedDuelGroupsDb(user.id).then(({ myGroups, availableGroups: enriched }) => {
                                  setUserCreatedGroups(myGroups.map(toGroupCard));
                                  setJoinedGroupIds(new Set(enriched.filter((g) => g.isAlreadyMember).map((g) => g.id)));
                                  setAvailableGroups(enriched.filter((g) => !g.isAlreadyMember).map(toGroupCard));
                                }).catch(() => { });
                              }
                              if (updated.length === 0 && pendingGroupRequests.length === 0) setActiveTab("duels");
                              toast({ title: "Convite recusado" });
                            } catch (err: any) {
                              toast({ title: "Erro", description: err?.message || "Tente novamente", variant: "destructive" });
                            }
                          }}
                        >
                          Recusar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Solicitações de entrada nos grupos do usuário (dono) */}
            {pendingGroupRequests.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pedidos para entrar nos seus grupos</p>
                {pendingGroupRequests.map((req) => (
                  <Card key={`${req.groupId}-${req.userId}`} className="border-border/60 mb-3">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          photo={req.userPhoto}
                          nickname={req.userNickname}
                          size="md"
                          className="flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{req.userNickname}</p>
                          <p className="text-xs text-muted-foreground truncate">quer entrar em <span className="font-medium">{req.groupName}</span></p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{req.participants} participante{req.participants !== 1 ? "s" : ""}</span>
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
                              toast({ title: "Aprovado!", description: `${req.userNickname} entrou em "${req.groupName}".` });
                            } catch (err: any) {
                              toast({ title: "Erro", description: err?.message || "Tente novamente", variant: "destructive" });
                            }
                          }}
                        >
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 rounded-full text-xs h-11"
                          onClick={async () => {
                            try {
                              await rejectGroupRequestDb(req.groupId, req.userId);
                              setPendingGroupRequests((prev) => prev.filter((r) => !(r.groupId === req.groupId && r.userId === req.userId)));
                              toast({ title: "Solicitação recusada" });
                            } catch (err: any) {
                              toast({ title: "Erro", description: err?.message || "Tente novamente", variant: "destructive" });
                            }
                          }}
                        >
                          Recusar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {pendingInvites.length === 0 && pendingGroupRequests.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma solicitação pendente</p>
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
            });
            setGroupPhotoFile(null);
            setSelectedInvitees(new Set());
            setGroupStep(1);
            setParticipantsSearch("");
          }
        }}
      >
        <DrawerContent className="max-h-[90dvh] flex flex-col z-[100]" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DrawerHeader className="shrink-0">
            {/* Progress indicator */}
            <div className="flex items-center gap-2 mb-2">
              {[1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${s <= groupStep ? "bg-brand" : "bg-muted"
                    }`}
                />
              ))}
            </div>
            <DrawerTitle>
              {groupStep === 1 && "Passo 1 — Identidade do grupo"}
              {groupStep === 2 && "Passo 2 — Localização"}
              {groupStep === 3 && "Passo 3 — Duração"}
              {groupStep === 4 && "Passo 4 — Convidar participantes"}
            </DrawerTitle>
            <DrawerDescription className="sr-only">Criação de grupo de desafio</DrawerDescription>
            <p className="text-xs text-muted-foreground mt-0.5">
              {groupStep === 1 && "Nome, meta e capa do grupo"}
              {groupStep === 2 && "Estado onde o desafio acontece"}
              {groupStep === 3 && "Por quanto tempo o desafio vai durar"}
              {groupStep === 4 && "Selecione quem vai participar"}
            </p>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {/* Step 1 — Nome, Meta e Foto */}
            {groupStep === 1 && (
              <div className="space-y-4">
                {/* Group Photo */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Capa do Grupo</label>
                  <div className="relative w-full h-36 rounded-xl overflow-hidden bg-muted border border-border/60 flex items-center justify-center">
                    {groupConfig.photo ? (
                      <>
                        <img src={groupConfig.photo} alt="capa" className="w-full h-full object-cover" />
                        <button
                          onClick={() => { setGroupConfig({ ...groupConfig, photo: "" }); setGroupPhotoFile(null); }}
                          className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <label className="cursor-pointer flex flex-col items-center gap-2 text-muted-foreground">
                        <span className="text-3xl">📷</span>
                        <span className="text-xs">Adicionar capa</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setGroupPhotoFile(file);
                              const reader = new FileReader();
                              reader.onloadend = () => setGroupConfig({ ...groupConfig, photo: reader.result as string });
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Group Name */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome do Grupo *</label>
                  <Input
                    value={groupConfig.name}
                    onChange={(e) => setGroupConfig({ ...groupConfig, name: e.target.value })}
                    placeholder="Ex: Supino Masters, Cardio Challenge..."
                  />
                </div>

                {/* Goal */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Meta do Grupo *</label>
                  <Textarea
                    value={groupConfig.goal}
                    onChange={(e) => setGroupConfig({ ...groupConfig, goal: e.target.value })}
                    placeholder="Ex: Maior volume total de supino em 30 dias..."
                    className="min-h-20"
                  />
                </div>

                <Button
                  onClick={() => {
                    if (groupConfig.name && groupConfig.goal) {
                      setGroupStep(2);
                    } else {
                      toast({ title: "Campos obrigatórios", description: "Preencha nome e meta para continuar", variant: "destructive" });
                    }
                  }}
                  className="w-full rounded-full mt-4"
                >
                  Próximo
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}

            {/* Step 2 — UF */}
            {groupStep === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Estado (UF) *</label>
                  <Select value={groupConfig.location} onValueChange={(value) => setGroupConfig({ ...groupConfig, location: value })}>
                    <SelectTrigger className="rounded-lg">
                      <SelectValue placeholder="Selecione um estado" />
                    </SelectTrigger>
                    <SelectContent className="z-[101]">
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
                  <Button onClick={() => setGroupStep(1)} variant="outline" className="flex-1 rounded-full">Voltar</Button>
                  <Button
                    onClick={() => {
                      if (groupConfig.location) {
                        setGroupStep(3);
                      } else {
                        toast({ title: "Campo obrigatório", description: "Selecione um estado para continuar", variant: "destructive" });
                      }
                    }}
                    className="flex-1 rounded-full"
                  >
                    Próximo <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3 — Duração */}
            {groupStep === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Duração do Desafio *</label>
                  <Select value={groupConfig.durationDays} onValueChange={(value) => setGroupConfig({ ...groupConfig, durationDays: value })}>
                    <SelectTrigger className="rounded-lg">
                      <SelectValue placeholder="Selecione a duração" />
                    </SelectTrigger>
                    <SelectContent className="z-[101]">
                      <SelectItem value="30">30 dias</SelectItem>
                      <SelectItem value="60">60 dias</SelectItem>
                      <SelectItem value="90">90 dias</SelectItem>
                      <SelectItem value="120">120 dias</SelectItem>
                      <SelectItem value="180">180 dias</SelectItem>
                      <SelectItem value="360">360 dias</SelectItem>
                    </SelectContent>
                  </Select>
                  {groupConfig.durationDays && (
                    <p className="text-xs text-muted-foreground">
                      Término previsto: {(() => {
                        const d = new Date();
                        d.setDate(d.getDate() + parseInt(groupConfig.durationDays));
                        return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
                      })()}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 mt-4">
                  <Button onClick={() => setGroupStep(2)} variant="outline" className="flex-1 rounded-full">Voltar</Button>
                  <Button
                    onClick={() => {
                      if (groupConfig.durationDays) {
                        setGroupStep(4);
                      } else {
                        toast({ title: "Campo obrigatório", description: "Selecione a duração para continuar", variant: "destructive" });
                      }
                    }}
                    className="flex-1 rounded-full"
                  >
                    Próximo <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4 — Convidar Participantes */}
            {groupStep === 4 && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="p-4 rounded-xl bg-muted/20 border border-brand/20 space-y-1">
                  <p className="text-sm font-semibold text-brand">{groupConfig.name}</p>
                  <p className="text-xs text-muted-foreground">📍 {groupConfig.location} · ⏱ {groupConfig.durationDays} dias</p>
                  <p className="text-xs text-muted-foreground mt-1">{groupConfig.goal}</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Convidar Participantes ({selectedInvitees.size})</label>
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
                        className="text-xs h-7"
                      >
                        {selectedInvitees.size === followers.length ? "Desselecionar Todos" : "Selecionar Todos"}
                      </Button>
                    )}
                  </div>

                  {followers.length > 0 && (
                    <Input
                      placeholder="Pesquisar seguidor..."
                      value={participantsSearch}
                      onChange={(e) => setParticipantsSearch(e.target.value)}
                      className="rounded-lg"
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
                            className={`w-full p-3 rounded-lg border transition-all text-left flex items-center gap-2 ${selectedInvitees.has(follower.id) ? "border-brand bg-brand/10" : "border-border hover:border-brand/50"
                              }`}
                          >
                            <div className={`h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${selectedInvitees.has(follower.id) ? "bg-brand border-brand" : "border-muted-foreground"}`}>
                              {selectedInvitees.has(follower.id) && <Check className="h-3 w-3 text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{follower.nickname}</div>
                            </div>
                          </button>
                        ))
                    ) : (
                      <div className="flex flex-col items-center gap-3 py-4">
                        <p className="text-sm text-muted-foreground text-center">Você não segue ninguém ainda</p>
                        <Button variant="outline" size="sm" className="rounded-full gap-2" onClick={() => { setIsCreateGroupModalOpen(false); navigate("/buscar"); }}>
                          <Search className="h-4 w-4" />
                          Buscar Usuários
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => setGroupStep(3)} variant="outline" className="flex-1 rounded-full">Voltar</Button>
                  <Button
                    onClick={async () => {
                      if (!user || isCreatingGroup) return;
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
                          groupConfig.name,
                          groupConfig.location,
                          groupConfig.goal,
                          Array.from(selectedInvitees),
                          endDate
                        );

                        // Upload group photo if provided — after group ID is known
                        let photoUrl: string | null = null;
                        if (groupPhotoFile) {
                          try {
                            photoUrl = await updateGroupPhotoDb(savedGroup.id, groupPhotoFile);
                          } catch (photoErr) {
                            console.error("Error uploading group photo:", photoErr);
                          }
                        }

                        const newGroup = {
                          ...savedGroup,
                          icon: "⚔️",
                          photo: photoUrl || null,
                          description: groupConfig.goal,
                          participants: selectedInvitees.size + 1,
                          city: groupConfig.location,
                          isOfficial: false,
                        };

                        // Reset form
                        setIsCreateGroupModalOpen(false);
                        setGroupConfig({ name: "", location: "", goal: "", durationDays: "", photo: "" });
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

                        toast({ title: "Grupo criado!", description: `"${newGroup.name}" foi criado com sucesso.` });
                      } catch (err: any) {
                        toast({ title: "Erro ao criar grupo", description: err?.message || "Tente novamente", variant: "destructive" });
                      } finally {
                        setIsCreatingGroup(false);
                      }
                    }}
                    className="flex-1 rounded-full"
                    disabled={isCreatingGroup}
                  >
                    {isCreatingGroup ? "Criando..." : t("duels_create")}
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
        <DrawerContent className="max-h-[80dvh] flex flex-col z-[100]" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DrawerHeader className="shrink-0">
            <DrawerTitle>Adicionar Check-in</DrawerTitle>
            <DrawerDescription className="sr-only">Registre seu check-in de treino</DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="space-y-4">
              {/* Photo Upload Carousel */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Fotos do Treino ({checkInPhotoFiles.length})</label>
                <div className="relative border-2 border-dashed border-brand/40 rounded-xl overflow-hidden bg-muted/10">
                  {checkInPhotoPreviewUrls.length > 0 ? (
                    <div className="space-y-3 p-4">
                      {/* Preview Carousel */}
                      <div className="relative group aspect-square rounded-lg overflow-hidden border border-border/40 bg-black/5">
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
                            onClick={() => setActivePhotoPreviewIndex(i)}
                            className={`relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${i === activePhotoPreviewIndex ? "border-brand scale-95" : "border-transparent opacity-60"}`}
                          >
                            <img src={url} alt={`Thumb ${i}`} className="w-full h-full object-cover" />
                          </button>
                        ))}
                        <label className="shrink-0 w-14 h-14 rounded-lg border-2 border-dashed border-brand/40 flex items-center justify-center cursor-pointer hover:bg-brand/5">
                          <Plus className="h-5 w-5 text-brand" />
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              e.target.value = "";
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                setPendingCropIndex(-1);
                                setPendingCropSrc(ev.target?.result as string);
                              };
                              reader.readAsDataURL(file);
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <label className="cursor-pointer block p-8 text-center transition-colors hover:bg-brand/5 group">
                      <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                        <Plus className="h-8 w-8 text-brand" />
                      </div>
                      <p className="text-sm font-medium">Adicionar Fotos</p>
                      <p className="text-xs text-muted-foreground mt-1">Selecione uma imagem por vez</p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            setPendingCropIndex(-1);
                            setPendingCropSrc(ev.target?.result as string);
                          };
                          reader.readAsDataURL(file);
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Descrição</label>
                <Textarea
                  value={checkInForm.description}
                  onChange={(e) =>
                    setCheckInForm({ ...checkInForm, description: e.target.value })
                  }
                  placeholder="Como foi seu treino? Deixe uma mensagem..."
                  className="min-h-20"
                />
              </div>

              {/* Completed Routine Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium">O que você treinou? *</label>
                {isLoadingRoutines ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <div key={i} className="animate-pulse rounded-xl border border-border/60 bg-muted/20 p-3">
                        <div className="flex gap-3">
                          <div className="w-5 h-5 rounded-full bg-muted flex-shrink-0 mt-0.5" />
                          <div className="flex-1 space-y-2">
                            <div className="h-3 bg-muted rounded w-2/3" />
                            <div className="h-2 bg-muted rounded w-1/3" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : completedRoutines.length === 0 ? (
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-center space-y-3">
                    <div>
                      <p className="text-sm font-medium">Nenhum treino concluído</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Conclua uma rotina nos últimos 7 dias para fazer check-in</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full text-xs h-8 px-4"
                      onClick={() => {
                        setIsAddCheckInModalOpen(false);
                        navigate("/metas");
                      }}
                    >
                      Ir para Metas e Rotinas
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

                      return (
                        <button
                          key={key}
                          onClick={() => setSelectedRoutineKey(isSelected ? null : key)}
                          className={`w-full text-left rounded-xl border overflow-hidden transition-colors ${isSelected ? "border-brand bg-brand/5" : "border-border/60 hover:border-brand/40"}`}
                        >
                          <div className="flex items-start gap-3 px-3 py-2.5">
                            <div className={`shrink-0 mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? "border-brand bg-brand" : "border-border"}`}>
                              {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{routine.routineName}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {routine.primaryMuscleGroup && (
                                  <span className="text-xs bg-brand/10 text-brand px-1.5 py-0.5 rounded-full">{routine.primaryMuscleGroup}</span>
                                )}
                                <span className="text-xs text-muted-foreground">{routine.exercises.length} exerc. · {dateLabel}</span>
                              </div>
                              {/* Exercise list preview */}
                              <div className="mt-1.5 space-y-0.5">
                                {routine.exercises.slice(0, 3).map((ex, i) => (
                                  <p key={i} className="text-xs text-muted-foreground truncate">• {ex.workoutName}{ex.kilos ? ` — ${ex.kilos}kg` : ""}</p>
                                ))}
                                {routine.exercises.length > 3 && (
                                  <p className="text-xs text-muted-foreground">+{routine.exercises.length - 3} mais</p>
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

              <Button
                onClick={async () => {
                  if (!user || !selectedGroupForView || isSubmittingCheckIn) return;
                  if (!selectedRoutineKey) {
                    toast({ title: "Selecione um treino", description: "Escolha o treino que você realizou", variant: "destructive" });
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

                    const checkIn = await addGroupCheckInDb(
                      selectedGroupForView.id,
                      user.id,
                      uploadedUrls[0] || "",
                      checkInForm.description,
                      exerciseName,
                      selectedRoutine?.totalSeries || 0,
                      selectedRoutine?.totalVolume || 0,
                      selectedRoutine?.primaryMuscleGroup || null,
                      selectedRoutine?.exercises || [],
                      uploadedUrls,
                    );

                    setGroupCheckIns((prev) => [checkIn, ...prev]);
                    setIsAddCheckInModalOpen(false);
                    setCheckInForm({ photo: "", photos: [], description: "", workoutId: "" });
                    setCheckInPhotoFiles([]);
                    setCheckInPhotoPreviewUrls([]);
                    setActivePhotoPreviewIndex(0);
                    setSelectedRoutineKey(null);

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
                className="w-full rounded-full"
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

      {/* Check-in Detail Modal */}
      <Drawer open={isCheckInDetailOpen} onOpenChange={setIsCheckInDetailOpen}>
        <DrawerContent className="max-h-[80dvh] flex flex-col z-[100]" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DrawerHeader className="shrink-0 flex items-center justify-between">
            <DrawerTitle>Detalhes do Check-in</DrawerTitle>
            <DrawerDescription className="sr-only">Veja detalhes e comentários do check-in</DrawerDescription>
            {selectedCheckInForDetail && selectedCheckInForDetail.userId === user?.id && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (selectedCheckInForDetail) {
                      setIsEditCheckInOpen(true);
                    }
                  }}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                  title="Editar check-in"
                >
                  <Edit3 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
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
                    gender={selectedCheckInForDetail.userGender}
                    nickname={selectedCheckInForDetail.userName}
                    className="h-8 w-8 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold truncate">{selectedCheckInForDetail.userName}</span>
                      {selectedCheckInForDetail.muscleGroup && (
                        <span className="text-[10px] bg-brand/10 text-brand px-1 py-0.5 rounded-full shrink-0 leading-none">{selectedCheckInForDetail.muscleGroup}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(selectedCheckInForDetail.createdAt).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} · {new Date(selectedCheckInForDetail.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>

                {/* Photo — Carousel support for multiple images */}
                {(selectedCheckInForDetail.photos?.length || 0) > 0 ? (
                  <PostCarousel
                    photos={selectedCheckInForDetail.photos || [selectedCheckInForDetail.photo]}
                    alt="check-in"
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
                  <p className="text-sm text-foreground/90">{selectedCheckInForDetail.description}</p>
                )}

                {/* Rotina + stats numa linha */}
                <div className="flex items-center gap-3 py-1 border-t border-border/40">
                  <span className="text-xs text-muted-foreground shrink-0">Rotina</span>
                  <span className="text-xs font-medium text-brand truncate flex-1">{selectedCheckInForDetail.workoutInfo}</span>
                  {selectedCheckInForDetail.exercises?.length > 0 && (
                    <span className="text-xs text-muted-foreground shrink-0">{selectedCheckInForDetail.exercises.length} exerc.</span>
                  )}
                  {selectedCheckInForDetail.volume > 0 && (
                    <span className="text-xs text-muted-foreground shrink-0">{selectedCheckInForDetail.volume}kg</span>
                  )}
                </div>

                {/* Exercises list — compact */}
                {selectedCheckInForDetail.exercises && selectedCheckInForDetail.exercises.length > 0 && (
                  <div className="divide-y divide-border/30">
                    {selectedCheckInForDetail.exercises.map((ex, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5">
                        <span className="text-xs truncate flex-1 text-foreground/80">{ex.workoutName}</span>
                        {ex.kilos && <span className="text-xs font-medium text-brand ml-2 shrink-0">{ex.kilos} kg</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Comments Section */}
                <div className="pt-2 border-t border-border/40 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Comentários {checkInComments.length > 0 ? `(${checkInComments.length})` : ""}
                  </p>

                  {isLoadingComments ? (
                    <div className="space-y-2">
                      {[1, 2].map((i) => (
                        <div key={i} className="animate-pulse flex gap-2">
                          <div className="w-7 h-7 rounded-full bg-muted flex-shrink-0" />
                          <div className="flex-1 space-y-1">
                            <div className="h-2.5 bg-muted rounded w-1/4" />
                            <div className="h-2 bg-muted rounded w-3/4" />
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
                            gender={comment.userGender}
                            nickname={comment.userNickname}
                            className="w-7 h-7 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <div className="flex items-baseline gap-1.5 flex-wrap flex-1 min-w-0">
                                <span className="text-xs font-semibold">{comment.userNickname}</span>
                                <span className="text-[10px] text-muted-foreground">{new Date(comment.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                              </div>
                              {user?.id === comment.userId && editingCommentId !== comment.id && (
                                <div className="flex shrink-0 gap-0.5">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditComment(comment)}
                                    className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                    aria-label="Editar comentário"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCheckInComment(comment.id)}
                                    disabled={deletingCommentId === comment.id}
                                    className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50 disabled:cursor-not-allowed"
                                    aria-label="Excluir comentário"
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
                                  className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring min-h-14"
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
                                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50 transition-colors"
                                  >
                                    <X className="h-3 w-3" />
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-foreground/90 break-words">{comment.text}</p>
                            )}
                            <CommentReactions commentType="checkin" commentId={comment.id} commentOwnerId={comment.userId} sourceId={selectedCheckInForDetail?.id} isOwnComment={!!(user?.id === comment.userId)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhum comentário ainda. Seja o primeiro!</p>
                  )}

                  {/* Comment Input */}
                  <div className="flex gap-2 pt-1 items-center">
                    <Input
                      placeholder="Adicionar comentário..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && selectedCheckInForDetail) {
                          e.preventDefault();
                          handleSendComment(selectedCheckInForDetail.id);
                        }
                      }}
                      className="rounded-full text-xs h-9"
                      disabled={isSendingComment}
                    />
                    <EmojiPicker
                      placement="top"
                      onSelect={(emoji) => setCommentText((prev) => prev + emoji)}
                    />
                    <Button
                      size="sm"
                      className="rounded-full flex-shrink-0 h-9 w-9 p-0"
                      disabled={!commentText.trim() || isSendingComment}
                      onClick={() => selectedCheckInForDetail && handleSendComment(selectedCheckInForDetail.id)}
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Group Details Modal */}
      <Drawer open={isGroupDetailsOpen} onOpenChange={(open) => { setIsGroupDetailsOpen(open); if (!open) setIsEditingGroupInfo(false); }}>
        <DrawerContent className="max-h-[80dvh] flex flex-col z-[100]" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DrawerHeader className="shrink-0 flex flex-row items-center justify-between pr-4">
            <div>
              <DrawerTitle>Detalhes do Grupo</DrawerTitle>
              <DrawerDescription className="sr-only">Informações e estatísticas do grupo</DrawerDescription>
            </div>
            {selectedGroupForView?.createdBy === user?.id && !isEditingGroupInfo && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs text-muted-foreground"
                onClick={() => {
                  setEditGroupName(selectedGroupForView.name);
                  setEditGroupGoal(selectedGroupForView.goal ?? "");
                  setIsEditingGroupInfo(true);
                }}
              >
                <Edit3 className="h-3.5 w-3.5" />
                Editar
              </Button>
            )}
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {selectedGroupForView && (
              <div className="space-y-4">
                {/* Group Name */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Nome do Grupo</label>
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
                  <label className="text-sm font-medium text-muted-foreground">Local</label>
                  <div className="p-3 rounded-lg bg-muted/20">
                    <p className="text-sm">📍 {selectedGroupForView.city}</p>
                  </div>
                </div>

                {/* Goal */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Objetivo</label>
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
                      <p className="text-sm">{selectedGroupForView.goal}</p>
                    </div>
                  )}
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Início</label>
                    <div className="p-3 rounded-lg bg-muted/20">
                      <p className="text-sm">
                        {selectedGroupForView.createdAt
                          ? new Date(selectedGroupForView.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Encerramento</label>
                    <div className="p-3 rounded-lg bg-muted/20">
                      <p className="text-sm">
                        {selectedGroupForView.endDate
                          ? new Date(selectedGroupForView.endDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
                          : "Sem prazo"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Edit action buttons */}
                {isEditingGroupInfo && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1 rounded-full"
                      onClick={() => setIsEditingGroupInfo(false)}
                      disabled={isSavingGroupInfo}
                    >
                      Cancelar
                    </Button>
                    <Button
                      className="flex-1 rounded-full"
                      disabled={isSavingGroupInfo || !editGroupName.trim()}
                      onClick={async () => {
                        if (!selectedGroupForView) return;
                        setIsSavingGroupInfo(true);
                        try {
                          await updateGroupInfoDb(selectedGroupForView.id, editGroupName.trim(), editGroupGoal.trim());
                          setSelectedGroupForView({ ...selectedGroupForView, name: editGroupName.trim(), goal: editGroupGoal.trim() });
                          // Update the group in the lists
                          setUserCreatedGroups((prev) => prev.map((g) => g.id === selectedGroupForView.id ? { ...g, name: editGroupName.trim(), goal: editGroupGoal.trim(), description: editGroupGoal.trim() } : g));
                          setIsEditingGroupInfo(false);
                          toast({ title: "Grupo atualizado!", description: "Nome e objetivo salvos com sucesso." });
                        } catch (error: any) {
                          toast({ title: "Erro ao salvar", description: error?.message || "Tente novamente.", variant: "destructive" });
                        } finally {
                          setIsSavingGroupInfo(false);
                        }
                      }}
                    >
                      {isSavingGroupInfo ? "Salvando..." : "Salvar"}
                    </Button>
                  </div>
                )}

                {/* Action Buttons */}
                {!isEditingGroupInfo && (
                  <div className="space-y-2 pt-4 border-t border-border/40">
                    {selectedGroupForView.createdBy === user?.id ? (
                      <>
                        <Button
                          onClick={() => setDeleteGroupConfirmOpen(true)}
                          variant="destructive"
                          className="w-full rounded-full gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          Apagar Grupo
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={() => setLeaveGroupConfirmOpen(true)}
                        variant="outline"
                        className="w-full rounded-full gap-2"
                      >
                        Sair do Grupo
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
                <AlertDialogTitle>Apagar grupo</AlertDialogTitle>
                <AlertDialogDescription>Tem certeza que deseja apagar este grupo? Esta ação é irreversível.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={async (e) => {
                    e.preventDefault();
                    setDeleteGroupConfirmOpen(false);
                    if (!selectedGroupForView) return;
                    const groupId = selectedGroupForView.id;
                    try {
                      await deleteGroupDb(groupId);
                      toast({ title: "Grupo apagado!", description: "O grupo foi removido com sucesso." });
                      setIsGroupDetailsOpen(false);
                      setSelectedGroupForView(null);
                      setGroupCheckIns([]);
                      const toGroupCard = (g: any) => ({ ...g, icon: "⚔️", description: g.goal, city: g.location, isOfficial: false });
                      const { myGroups, availableGroups: enriched } = await getEnrichedDuelGroupsDb(user!.id);
                      setUserCreatedGroups(myGroups.map(toGroupCard));
                      setJoinedGroupIds(new Set(enriched.filter((g) => g.isAlreadyMember).map((g) => g.id)));
                      setAvailableGroups(enriched.filter((g) => !g.isAlreadyMember).map(toGroupCard));
                    } catch (error: any) {
                      toast({ title: "Erro ao apagar grupo", description: error?.message || "Tente novamente.", variant: "destructive" });
                    }
                  }}
                >
                  Apagar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Leave group confirmation — inside drawer */}
          <AlertDialog open={leaveGroupConfirmOpen} onOpenChange={setLeaveGroupConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sair do grupo</AlertDialogTitle>
                <AlertDialogDescription>Tem certeza que deseja sair deste grupo?</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async (e) => {
                    e.preventDefault();
                    setLeaveGroupConfirmOpen(false);
                    if (!selectedGroupForView) return;
                    const groupId = selectedGroupForView.id;
                    try {
                      await leaveGroupDb(groupId);
                      toast({ title: "Você saiu do grupo!", description: "Você não é mais participante deste grupo." });
                      setIsGroupDetailsOpen(false);
                      setSelectedGroupForView(null);
                      setGroupCheckIns([]);
                      setSearchParams((prev) => { const next = new URLSearchParams(prev); next.delete("group"); next.set("tab", "duels"); return next; }, { replace: true });
                      setActiveTab("duels");
                      // Full refresh of groups
                      if (user?.id) {
                        getEnrichedDuelGroupsDb(user.id).then(({ myGroups, availableGroups: enriched }) => {
                          const toGroupCard = (g: any) => ({ ...g, icon: "⚔️", description: g.goal, city: g.location, isOfficial: false });
                          setUserCreatedGroups(myGroups.map(toGroupCard));
                          setJoinedGroupIds(new Set(enriched.filter((g) => g.isAlreadyMember).map((g) => g.id)));
                          setAvailableGroups(enriched.filter((g) => !g.isAlreadyMember).map(toGroupCard));
                        }).catch(() => { });
                      }
                    } catch (error: any) {
                      toast({ title: "Erro ao sair do grupo", description: error?.message || "Tente novamente.", variant: "destructive" });
                    }
                  }}
                >
                  Sair
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
      />

      {/* Participants Modal */}
      <Drawer open={isParticipantsModalOpen} onOpenChange={(open) => {
        setIsParticipantsModalOpen(open);
        if (!open) setParticipantDetailsId(null);
      }}>
        <DrawerContent className="max-h-[80dvh] flex flex-col z-[100]" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DrawerHeader className="shrink-0">
            <DrawerTitle>Participantes ({groupParticipants.length})</DrawerTitle>
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
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/40 flex flex-col items-center justify-center text-center">
                    <span className="text-xl font-bold text-brand mb-1">{totalCheckIns}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Total Check-ins</span>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/40 flex flex-col items-center justify-center text-center">
                    <span className="text-xl font-bold text-brand mb-1">{avgCheckInsPerDay.toFixed(1)}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Média / Dia</span>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/40 flex flex-col items-center justify-center text-center">
                    {topReactionUser && topReactionUser.count > 0 ? (
                      <>
                        <div className="flex items-center justify-center gap-1.5 mb-1">
                          <span className="text-xl font-bold text-brand leading-none">{topReactionUser.count}</span>
                          <UserAvatar
                            photo={topReactionUser.userPhoto}
                            nickname={topReactionUser.userName}
                            className="h-6 w-6 border border-border/40"
                            title={topReactionUser.userName}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Mais Reações</span>
                      </>
                    ) : (
                      <>
                        <span className="text-xl font-bold text-brand mb-1">0</span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Mais Reações</span>
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
                    className="p-3 rounded-lg bg-muted/30 border border-border/40 flex items-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <UserAvatar
                      photo={participant.userPhoto}
                      nickname={participant.userNickname}
                      size="md"
                      className="flex-shrink-0"
                    />
                    <p className="text-sm font-medium flex-1">{participant.userNickname}</p>
                    {selectedGroupForView?.createdBy === user?.id && participant.userId !== user?.id && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setRemoveMemberConfirm({ open: true, participant }); }}
                        className="p-1.5 rounded-full hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive flex-shrink-0"
                        title="Remover do grupo"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum participante ainda</p>
              )}
            </div>
          </div>
          {selectedGroupForView?.createdBy === user?.id && (
            <div className="border-t border-border/40 p-4">
              <Button
                className="w-full rounded-full gap-2"
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

      {/* Participant Details Modal */}
      <Drawer open={!!participantDetailsId} onOpenChange={(open) => !open && setParticipantDetailsId(null)}>
        <DrawerContent className="h-[95dvh] flex flex-col z-[110]" onOpenAutoFocus={(e) => e.preventDefault()}>
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
                  <button onClick={() => setParticipantDetailsId(null)} className="p-2 -ml-2 rounded-full hover:bg-muted/50 transition-colors"><ChevronLeft className="h-6 w-6" /></button>
                  <div className="flex-1" />
                </DrawerHeader>

                <div className="flex-1 overflow-y-auto px-4 py-3 bg-background flex flex-col justify-center">
                  <div className="flex flex-col items-center mb-4">
                    <UserAvatar
                      photo={pInfo?.userPhoto}
                      nickname={pInfo?.userNickname}
                      size="xl"
                      className="mb-2 border-2 border-border/40"
                    />
                    <h2 className="text-lg font-bold">{pInfo?.userNickname}</h2>
                  </div>

                  <div className="flex justify-between w-full mb-6 px-2">
                    <div className="text-center flex-1">
                      <p className="text-lg font-bold leading-none mb-1">{pCheckIns.length}</p>
                      <p className="text-[11px] text-muted-foreground">Check-ins</p>
                    </div>
                    <div className="text-center flex-1">
                      <p className="text-lg font-bold leading-none mb-1">{activeDays}</p>
                      <p className="text-[11px] text-muted-foreground">Dias ativos</p>
                    </div>
                    <div className="text-center flex-1">
                      <p className="text-lg font-bold leading-none mb-1">{durationStr}</p>
                      <p className="text-[11px] text-muted-foreground">Duração</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h3 className="text-center font-bold text-base mb-3">{monthTitle}</h3>
                    <div className="grid grid-cols-7 gap-y-2 text-center mb-1">
                      {dayNames.map(d => (
                        <div key={d} className="text-[10px] text-muted-foreground">{d}</div>
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
                              <span className="text-xs font-medium opacity-80">{day}</span>
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
        onUpdated={({ id, workoutInfo, description }) => {
          setGroupCheckIns((prev) =>
            prev.map((c) => c.id === id ? { ...c, workoutInfo, description } : c)
          );
          if (selectedCheckInForDetail?.id === id) {
            setSelectedCheckInForDetail({ ...selectedCheckInForDetail, workoutInfo, description });
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
              Tem certeza que deseja excluir todas as mensagens com {convToDelete?.userNickname}? Esta ação é irreversível.
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
                  await deleteConversationDb(convToDelete.userId);
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
    </div>
  );
}

function formatTimeAgo(date: string): string {
  const now = new Date();
  const msgTime = new Date(date);
  const diffMs = now.getTime() - msgTime.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "agora";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return msgTime.toLocaleDateString("pt-BR", {
    month: "short",
    day: "numeric",
  });
}
