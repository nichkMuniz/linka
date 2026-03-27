import * as React from "react";
import {
  getConversationsDb,
  getConversationMessagesDb,
  sendMessageDb,
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
  updateGroupCheckInDb,
  deleteGroupCheckInDb,
  deleteGroupDb,
  getGroupParticipantsDb,
  updateGroupPhotoDb,
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
  getCheckInReactionsDb,
  setCheckInReactionDb,
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
import { ArrowLeft, Send, Check, CheckCheck, Trophy, TrendingUp, Plus, X, ChevronRight, ChevronDown, Trash2, Edit3, Search, PenSquare, MessageCircle, Users } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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
import { useNavigate, useSearchParams } from "react-router-dom";
import { LoadingSpinner } from "@/components/shared/animated-loading";
import { useLayoutMode } from "@/hooks/useLayoutMode";
import { useLanguage } from "@/lib/language-context";
import { UserInsignias } from "@/components/profile/user-insignias";

type ViewMode = "conversations" | "conversation";

export default function Community() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
    photo: "",
    description: "",
    workoutId: "",
  });
  const [checkInPhotoFile, setCheckInPhotoFile] = React.useState<File | null>(null);
  const [completedRoutines, setCompletedRoutines] = React.useState<CompletedRoutine[]>([]);
  const [selectedRoutineKey, setSelectedRoutineKey] = React.useState<string | null>(null);
  const [participantsSearch, setParticipantsSearch] = React.useState("");
  const [selectedCheckInForDetail, setSelectedCheckInForDetail] = React.useState<GroupCheckIn | null>(null);
  const [isCheckInDetailOpen, setIsCheckInDetailOpen] = React.useState(false);
  const [userNickname, setUserNickname] = React.useState<string>("");
  const [isGroupDetailsOpen, setIsGroupDetailsOpen] = React.useState(false);
  const [deleteGroupConfirmOpen, setDeleteGroupConfirmOpen] = React.useState(false);
  const [leaveGroupConfirmOpen, setLeaveGroupConfirmOpen] = React.useState(false);
  const [isClassificationsOpen, setIsClassificationsOpen] = React.useState(false);
  const [isParticipantsModalOpen, setIsParticipantsModalOpen] = React.useState(false);
  const [isAddMembersModalOpen, setIsAddMembersModalOpen] = React.useState(false);
  const [selectedMembers, setSelectedMembers] = React.useState<Set<string>>(new Set());
  const [addMembersSearch, setAddMembersSearch] = React.useState("");
  const [isEditCheckInOpen, setIsEditCheckInOpen] = React.useState(false);
  const [editCheckInForm, setEditCheckInForm] = React.useState({
    workoutInfo: "",
    description: "",
  });
  const [confirmDialog, setConfirmDialog] = React.useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: "", description: "", onConfirm: () => {} });

  const [pendingInvites, setPendingInvites] = React.useState<Array<{ groupId: string; groupName: string; groupGoal: string; groupLocation: string }>>([]);
  const [pendingGroupRequests, setPendingGroupRequests] = React.useState<GroupJoinRequest[]>([]);

  // Check-in comments state
  const [checkInComments, setCheckInComments] = React.useState<CheckInComment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = React.useState(false);
  const [commentText, setCommentText] = React.useState("");
  const [isSendingComment, setIsSendingComment] = React.useState(false);

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
          getCheckInReactionsDb(checkIns.map((c) => c.id)).then(setCheckInReactions).catch(() => {});
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
        setAvailableGroups(enrichedAvailGroups.map(toGroupCard));
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
      getPendingGroupRequestsDb().then(setPendingGroupRequests).catch(() => {});
    }
  }, [activeTab, user?.id]);

  // Restore group view from URL param (?group=<groupId>) after refresh
  React.useEffect(() => {
    const groupIdParam = searchParams.get("group");
    if (!groupIdParam || selectedGroupForView) return;
    // Try to find in already-loaded groups
    const allGroups = [...userCreatedGroups, ...availableGroups];
    const found = allGroups.find((g) => g.id === groupIdParam);
    if (found) {
      openGroupView(found);
      return;
    }
    // Fetch from DB if not loaded yet
    getDuelGroupDb(groupIdParam).then((group) => {
      if (group) {
        const groupCard = { ...group, icon: "⚔️", description: group.goal, city: group.location, isOfficial: false };
        openGroupView(groupCard);
      }
    }).catch((err) => console.error("Error restoring group view:", err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, userCreatedGroups, availableGroups]);

  // Auto-select conversation from URL parameter (?user=<userId>)
  React.useEffect(() => {
    const userIdParam = searchParams.get("user");
    if (!userIdParam) return;
    setActiveTab("messages");
    // Try existing conversation first
    const existing = conversations.find((c) => c.userId === userIdParam);
    if (existing) {
      setSelectedConversation(existing);
      setViewMode("conversation");
      return;
    }
    // If no conversation yet, fetch the user's profile and open an empty conversation
    if (!loading) {
      import("@/lib/ritmofit-db").then(({ getUserProfileDb }) => {
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
        // Reload messages
        const updatedMessages = await getConversationMessagesDb(
          selectedConversation.userId,
        );
        setMessages(updatedMessages);
        setMessageText("");

        // Update last message in conversation list
        setConversations((prev) =>
          prev.map((conv) =>
            conv.userId === selectedConversation.userId
              ? {
                  ...conv,
                  lastMessage: messageText,
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
    }
  }, [messageText, selectedConversation]);

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

    return (
      <div className={`fixed top-0 left-0 md:left-[244px] right-0 ${bottomClass} bg-background flex flex-col z-[60]`}>
        {/* Header */}
        <div className="flex-shrink-0 border-b border-border/60 bg-background px-4 py-3 flex items-center gap-3">
          <button
            onClick={handleBackToConversations}
            className="text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => navigate(`/usuario/${selectedConversation.userId}`)}
            className="flex-1 flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity text-left"
          >
            {selectedConversation.userPhoto && (
              <img
                src={selectedConversation.userPhoto}
                alt={selectedConversation.userNickname}
                className="h-10 w-10 rounded-full object-cover flex-shrink-0"
              />
            )}
            <div className="min-w-0 flex items-center gap-1.5">
              <p className="text-sm font-medium truncate">
                {selectedConversation.userNickname}
              </p>
              <UserInsignias userId={selectedConversation.userId} />
            </div>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 px-4 py-4">
          {messages.length > 0 ? (
            messages.map((message) => {
              const isOwn = message.id_user === user?.id;
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
                      className={`max-w-xs px-4 py-2 rounded-lg space-y-1 break-words select-none ${
                        isOwn
                          ? "bg-brand text-white rounded-br-none"
                          : "bg-muted rounded-bl-none"
                      }`}
                    >
                      {replyQuote && (
                        <div className={`text-xs px-2 py-1 rounded mb-1 border-l-2 ${isOwn ? "bg-white/10 border-white/50 text-white/80" : "bg-muted-foreground/10 border-muted-foreground/40 text-muted-foreground"}`}>
                          <p className="truncate">{replyQuote}</p>
                        </div>
                      )}
                      <p className="text-sm">{mainText}</p>
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`text-xs ${
                            isOwn ? "text-white/70" : "text-muted-foreground"
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

        {/* Input */}
        <div className="flex-shrink-0 border-t border-border/60 bg-background px-4 py-3 flex gap-2">
          <Input
            placeholder={t("community_type_message")}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={isSending}
            className="rounded-full"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!messageText.trim() || isSending}
            size="sm"
            className="rounded-full flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

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
      </div>
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
    <div className="w-full h-[calc(100dvh-68px)] md:h-[calc(100dvh-24px)] flex flex-col overflow-hidden">
      {/* Tabs — minimalista, underline style */}
      <div className="flex-shrink-0 border-b border-border/60 px-4 pt-5 md:pt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-6">
            {(["messages", "duels", "ranking"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-sm font-medium pb-1 ${
                  activeTab === tab
                    ? "text-foreground border-b-2 border-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {tab === "messages" ? t("community_messages") : tab === "duels" ? t("community_duels") : t("community_ranking")}
              </button>
            ))}
            {(pendingInvites.length > 0 || pendingGroupRequests.length > 0) && (
              <button
                onClick={() => setActiveTab("requests")}
                className={`text-sm font-medium pb-1 relative ${
                  activeTab === "requests"
                    ? "text-foreground border-b-2 border-foreground"
                    : "text-muted-foreground"
                }`}
              >
                Solicitações
                <span className="absolute -top-1 -right-3 h-4 w-4 rounded-full bg-destructive text-white text-[10px] flex items-center justify-center ring-2 ring-background font-bold">
                  {pendingInvites.length + pendingGroupRequests.length}
                </span>
              </button>
            )}
          </div>

          {/* Nova conversa — só aparece na aba de mensagens */}
          {activeTab === "messages" && followers.length > 0 && (
            <button
              aria-label="Nova conversa"
              onClick={() => { setSearchQuery(""); setTimeout(() => { document.querySelector<HTMLInputElement>('[placeholder="Buscar conversa..."]')?.focus(); }, 50); }}
              className="p-2 rounded-full hover:bg-muted/50 transition-colors"
            >
              <PenSquare className="h-5 w-5 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Tab */}
      {activeTab === "messages" && (
        <>
          {/* Search Bar */}
          <div className="flex-shrink-0 px-4 pt-3 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar conversa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-full pl-9 bg-muted/30 border-transparent focus:border-border/60 focus:bg-background"
              />
            </div>
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
                        {conversation.userPhoto ? (
                          <img
                            src={conversation.userPhoto}
                            alt={conversation.userNickname}
                            className="h-12 w-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                            <span className="text-sm font-semibold text-muted-foreground">
                              {conversation.userNickname?.charAt(0).toUpperCase() || "?"}
                            </span>
                          </div>
                        )}
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
                    onClick={() => { setSelectedConversation({ userId: follower.id, userNickname: follower.nickname, userPhoto: follower.photo, lastMessage: "", lastMessageTime: new Date().toISOString(), unreadCount: 0 }); setViewMode("conversation"); }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors text-left"
                  >
                    <div className="shrink-0">
                      {follower.photo ? (
                        <img src={follower.photo} alt={follower.nickname} className="h-12 w-12 rounded-full object-cover" />
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
                      onClick={() => { setSelectedConversation({ userId: follower.id, userNickname: follower.nickname, userPhoto: follower.photo, lastMessage: "", lastMessageTime: new Date().toISOString(), unreadCount: 0 }); setViewMode("conversation"); }}
                      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors text-left"
                    >
                      <div className="shrink-0">
                        {follower.photo ? (
                          <img src={follower.photo} alt={follower.nickname} className="h-12 w-12 rounded-full object-cover" />
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
      {selectedGroupForView && (
        <div className="fixed inset-0 bg-background flex flex-col z-[51]">
          {/* Header with Back Button */}
          <div className="flex-shrink-0 px-4 pt-3 pb-0 flex items-center justify-start border-b border-border/40">
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
                  className={`px-2 py-2 text-sm font-medium transition-colors ${
                    activeGroupViewTab === "check-ins"
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
                            const myReaction = (checkInReactions[checkIn.id] ?? []).find((r) => r.userId === user?.id);
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
                                  <div className="w-8 h-8 rounded-full overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
                                    {checkIn.userPhoto ? (
                                      <img src={checkIn.userPhoto} alt={checkIn.userName} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-[10px] font-bold text-muted-foreground">{checkIn.userName.charAt(0).toUpperCase()}</span>
                                    )}
                                  </div>
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
                                {/* Emoji reaction badge */}
                                {myReaction && (
                                  <span className="absolute -bottom-1 left-6 text-sm bg-background border border-border/60 rounded-full px-1 shadow-sm leading-none py-0.5">
                                    {myReaction.emoji}
                                  </span>
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
          <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border/40 z-[52]">
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
          <div className="fixed bottom-20 right-4 z-[53]">
            <button
              onClick={() => {
                if (!user?.id) return;
                // Open modal immediately — load routines in background
                setSelectedRoutineKey(null);
                setCheckInForm({ photo: "", description: "", workoutId: "" });
                setCheckInPhotoFile(null);
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
                          setLongPressedCheckIn(null);
                          setCheckInReactions((prev) => {
                            const current = (prev[checkInId] ?? []).filter((r) => r.userId !== user?.id);
                            if (newEmoji) current.push({ checkInId, userId: user!.id, emoji: newEmoji });
                            return { ...prev, [checkInId]: current };
                          });
                          await setCheckInReactionDb(checkInId, newEmoji);
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
        </div>
      )}

      {/* Duels Tab */}
      {activeTab === "duels" && !selectedGroupForView && (
        <>
          {/* Header */}
          <div className="flex-shrink-0 px-4 pt-4 pb-0 flex items-center justify-start">
            <h1 className="text-2xl font-bold tracking-tight">{t("community_duels")}</h1>
          </div>

          {/* Duels Grid */}
          <div className="flex-1 overflow-y-auto px-3 pb-24 pt-4 space-y-6">
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
                              Seu Grupo
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{group.description}</p>
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

          {/* Centered Create Group Button at Bottom */}
          <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-[51] px-4">
            <Button
              onClick={() => {
                setGroupStep(1);
                setGroupConfig({ name: "", location: "", goal: "", durationDays: "", photo: "" });
                setSelectedInvitees(new Set());
                setIsCreateGroupModalOpen(true);
              }}
              className="gap-2 rounded-full px-6 h-12"
            >
              <Plus className="h-4 w-4" />
              {t("duels_create")}
            </Button>
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
                            {rankUser.userPhoto ? (
                              <img
                                src={rankUser.userPhoto}
                                alt={rankUser.userNickname}
                                className="h-12 w-12 rounded-full object-cover"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-full bg-muted" />
                            )}

                            <div className="flex-1">
                              <p className="font-semibold text-sm">
                                {rankUser.userNickname}
                                {isCurrentUser && <span className="ml-1 text-xs text-brand">({t("ranking_you")})</span>}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {t("ranking_level")} {rankUser.level}
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
                              // Remove pending status from availableGroups so it no longer shows "Pendente"
                              setAvailableGroups((prev) =>
                                prev.map((g) => g.id === invite.groupId ? { ...g, isPending: false } : g)
                              );
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
                        {req.userPhoto ? (
                          <img src={req.userPhoto} alt={req.userNickname} className="h-10 w-10 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-semibold text-muted-foreground">{req.userNickname.charAt(0).toUpperCase()}</span>
                          </div>
                        )}
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
        <DrawerContent className="max-h-[90dvh] flex flex-col z-[100]">
          <DrawerHeader className="shrink-0">
            {/* Progress indicator */}
            <div className="flex items-center gap-2 mb-2">
              {[1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    s <= groupStep ? "bg-brand" : "bg-muted"
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
                            className={`w-full p-3 rounded-lg border transition-all text-left flex items-center gap-2 ${
                              selectedInvitees.has(follower.id) ? "border-brand bg-brand/10" : "border-border hover:border-brand/50"
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
        <DrawerContent className="max-h-[80dvh] flex flex-col z-[100]">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>Adicionar Check-in</DrawerTitle>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="space-y-4">
              {/* Photo Upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Foto do Treino</label>
                <div className="border-2 border-dashed border-brand/40 rounded-lg p-4 text-center">
                  {checkInPhotoFile ? (
                    <div className="space-y-2">
                      <img
                        src={URL.createObjectURL(checkInPhotoFile)}
                        alt="preview"
                        className="w-full h-32 object-cover rounded"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setCheckInPhotoFile(null)}
                        className="w-full text-xs"
                      >
                        Remover Foto
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block">
                      <div className="text-3xl mb-2">📸</div>
                      <p className="text-sm text-muted-foreground mb-2">Clique para selecionar uma foto</p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            setCheckInPhotoFile(e.target.files[0]);
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setCheckInForm({
                                ...checkInForm,
                                photo: reader.result as string,
                              });
                            };
                            reader.readAsDataURL(e.target.files[0]);
                          }
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

                    const checkIn = await addGroupCheckInDb(
                      selectedGroupForView.id,
                      user.id,
                      userNickname || "Usuário",
                      checkInForm.photo,
                      checkInForm.description,
                      exerciseName,
                      selectedRoutine?.totalSeries || 0,
                      selectedRoutine?.totalVolume || 0,
                      selectedRoutine?.primaryMuscleGroup || null,
                      selectedRoutine?.exercises || [],
                      userPhoto,
                    );

                    setGroupCheckIns((prev) => [checkIn, ...prev]);
                    setIsAddCheckInModalOpen(false);
                    setCheckInForm({ photo: "", description: "", workoutId: "" });
                    setCheckInPhotoFile(null);
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

      {/* Check-in Detail Modal */}
      <Drawer open={isCheckInDetailOpen} onOpenChange={setIsCheckInDetailOpen}>
        <DrawerContent className="max-h-[80dvh] flex flex-col z-[100]">
          <DrawerHeader className="shrink-0 flex items-center justify-between">
            <DrawerTitle>Detalhes do Check-in</DrawerTitle>
            {selectedCheckInForDetail && selectedCheckInForDetail.userId === user?.id && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (selectedCheckInForDetail) {
                      setEditCheckInForm({
                        workoutInfo: selectedCheckInForDetail.workoutInfo,
                        description: selectedCheckInForDetail.description,
                      });
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
                        () => {
                          setGroupCheckIns(groupCheckIns.filter((c) => c.id !== selectedCheckInForDetail.id));
                          setIsCheckInDetailOpen(false);
                          toast({ title: "Check-in excluído!", description: "O check-in foi removido com sucesso." });
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
                  <div className="h-8 w-8 rounded-full overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
                    {selectedCheckInForDetail.userPhoto ? (
                      <img src={selectedCheckInForDetail.userPhoto} alt={selectedCheckInForDetail.userName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-bold text-muted-foreground">{selectedCheckInForDetail.userName.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
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

                {/* Photo — proportional, no fixed height */}
                {selectedCheckInForDetail.photo && (
                  <div className="rounded-xl overflow-hidden bg-muted">
                    <img src={selectedCheckInForDetail.photo} alt="check-in" className="w-full object-cover max-h-56" />
                  </div>
                )}

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

                {/* Reactions summary (read-only, shows totals per emoji) */}
                {(() => {
                  const reactions = checkInReactions[selectedCheckInForDetail.id] ?? [];
                  const grouped = CHECKIN_QUICK_EMOJIS.map((emoji) => ({
                    emoji,
                    count: reactions.filter((r) => r.emoji === emoji).length,
                  })).filter((g) => g.count > 0);
                  if (grouped.length === 0) return null;
                  return (
                    <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border/40">
                      {grouped.map(({ emoji, count }) => (
                        <span key={emoji} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-sm bg-muted/40 border border-border/40">
                          {emoji} <span className="text-xs font-medium">{count}</span>
                        </span>
                      ))}
                    </div>
                  );
                })()}

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
                          <div className="w-7 h-7 rounded-full overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
                            {comment.userPhoto ? (
                              <img src={comment.userPhoto} alt={comment.userNickname} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[9px] font-bold text-muted-foreground">{comment.userNickname.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              <span className="text-xs font-semibold">{comment.userNickname}</span>
                              <span className="text-[10px] text-muted-foreground">{new Date(comment.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                            <p className="text-xs text-foreground/90 break-words">{comment.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhum comentário ainda. Seja o primeiro!</p>
                  )}

                  {/* Comment Input */}
                  <div className="flex gap-2 pt-1">
                    <Input
                      placeholder="Adicionar comentário..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && commentText.trim() && !isSendingComment) {
                          e.preventDefault();
                          (async () => {
                            if (!selectedCheckInForDetail) return;
                            setIsSendingComment(true);
                            try {
                              const newComment = await addCheckInCommentDb(selectedCheckInForDetail.id, commentText);
                              setCheckInComments((prev) => [...prev, newComment]);
                              setCommentText("");
                            } catch (err: any) {
                              toast({ title: "Erro ao comentar", description: err?.message || "Tente novamente.", variant: "destructive" });
                            } finally {
                              setIsSendingComment(false);
                            }
                          })();
                        }
                      }}
                      className="rounded-full text-xs h-9"
                      disabled={isSendingComment}
                    />
                    <Button
                      size="sm"
                      className="rounded-full flex-shrink-0 h-9 w-9 p-0"
                      disabled={!commentText.trim() || isSendingComment}
                      onClick={async () => {
                        if (!selectedCheckInForDetail || !commentText.trim()) return;
                        setIsSendingComment(true);
                        try {
                          const newComment = await addCheckInCommentDb(selectedCheckInForDetail.id, commentText);
                          setCheckInComments((prev) => [...prev, newComment]);
                          setCommentText("");
                        } catch (err: any) {
                          toast({ title: "Erro ao comentar", description: err?.message || "Tente novamente.", variant: "destructive" });
                        } finally {
                          setIsSendingComment(false);
                        }
                      }}
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
      <Drawer open={isGroupDetailsOpen} onOpenChange={setIsGroupDetailsOpen}>
        <DrawerContent className="max-h-[80dvh] flex flex-col z-[100]">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>Detalhes do Grupo</DrawerTitle>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {selectedGroupForView && (
              <div className="space-y-4">
                {/* Group Name */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Nome do Grupo</label>
                  <div className="p-3 rounded-lg bg-muted/20">
                    <p className="text-sm font-medium">{selectedGroupForView.name}</p>
                  </div>
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
                  <div className="p-3 rounded-lg bg-muted/20">
                    <p className="text-sm">{selectedGroupForView.goal}</p>
                  </div>
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

                {/* Action Buttons */}
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
                      setAvailableGroups(enriched.map(toGroupCard));
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
                          setAvailableGroups(enriched.map(toGroupCard));
                        }).catch(() => {});
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
      <Drawer open={isClassificationsOpen} onOpenChange={setIsClassificationsOpen}>
        <DrawerContent className="max-h-[80dvh] flex flex-col z-[100]">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>Classificações</DrawerTitle>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="space-y-2">
              {groupCheckIns.length > 0 ? (
                // Group check-ins by user and count
                Object.entries(
                  groupCheckIns.reduce((acc: { [key: string]: { userName: string; count: number } }, checkIn) => {
                    if (!acc[checkIn.userId]) {
                      acc[checkIn.userId] = { userName: checkIn.userName, count: 0 };
                    }
                    acc[checkIn.userId].count++;
                    return acc;
                  }, {})
                )
                  .sort((a, b) => b[1].count - a[1].count)
                  .map(([userId, data], index) => (
                    <div key={userId} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/40">
                      <div className="text-lg font-bold text-brand w-8 text-center">
                        {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{data.userName}</p>
                        <p className="text-xs text-muted-foreground">{data.count} check-ins</p>
                      </div>
                      <div className="text-lg font-bold text-brand">{data.count}</div>
                    </div>
                  ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum check-in ainda</p>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Participants Modal */}
      <Drawer open={isParticipantsModalOpen} onOpenChange={setIsParticipantsModalOpen}>
        <DrawerContent className="max-h-[80dvh] flex flex-col z-[100]">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>Participantes ({groupParticipants.length})</DrawerTitle>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="space-y-2">
              {groupParticipants.length > 0 ? (
                groupParticipants.map((participant) => (
                  <div
                    key={participant.userId}
                    className="p-3 rounded-lg bg-muted/30 border border-border/40 flex items-center gap-3"
                  >
                    {participant.userPhoto ? (
                      <img
                        src={participant.userPhoto}
                        alt={participant.userNickname}
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-semibold text-muted-foreground">{participant.userNickname.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                    <p className="text-sm font-medium flex-1">{participant.userNickname}</p>
                    {selectedGroupForView?.createdBy === user?.id && participant.userId !== user?.id && (
                      <button
                        onClick={() => setRemoveMemberConfirm({ open: true, participant })}
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
                  setSelectedMembers(new Set());
                  setAddMembersSearch("");
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

      {/* Add Members Modal */}
      <Drawer open={isAddMembersModalOpen} onOpenChange={setIsAddMembersModalOpen}>
        <DrawerContent className="max-h-[80dvh] flex flex-col z-[100]">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>Adicionar Membros</DrawerTitle>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col">
            {/* Search Field */}
            {followers.length > 0 && (
              <div className="mb-4">
                <Input
                  placeholder="Pesquisar seguidor..."
                  value={addMembersSearch}
                  onChange={(e) => setAddMembersSearch(e.target.value)}
                  className="rounded-lg"
                />
              </div>
            )}

            {/* Followers List */}
            <div className="space-y-2 flex-1 overflow-y-auto">
              {followers.length > 0 ? (
                followers
                  .filter((f) =>
                    f.nickname.toLowerCase().includes(addMembersSearch.toLowerCase()) &&
                    !groupParticipants.some((p) => p.userId === f.id)
                  )
                  .map((follower) => (
                    <button
                      key={follower.id}
                      onClick={() => {
                        const newSelected = new Set(selectedMembers);
                        if (newSelected.has(follower.id)) {
                          newSelected.delete(follower.id);
                        } else {
                          newSelected.add(follower.id);
                        }
                        setSelectedMembers(newSelected);
                      }}
                      className={`w-full p-3 rounded-lg border transition-all text-left flex items-center gap-2 ${
                        selectedMembers.has(follower.id)
                          ? "border-brand bg-brand/10"
                          : "border-border hover:border-brand/50"
                      }`}
                    >
                      <div
                        className={`h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          selectedMembers.has(follower.id)
                            ? "bg-brand border-brand"
                            : "border-muted-foreground"
                        }`}
                      >
                        {selectedMembers.has(follower.id) && (
                          <Check className="h-3 w-3 text-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {follower.nickname}
                        </div>
                      </div>
                    </button>
                  ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Você não segue ninguém ainda
                </p>
              )}
            </div>

            {/* Add Button */}
            <div className="mt-4 pt-4 border-t border-border/40">
              <Button
                onClick={async () => {
                  try {
                    if (selectedGroupForView && selectedMembers.size > 0) {
                      await addMembersToGroupDb(
                        selectedGroupForView.id,
                        Array.from(selectedMembers)
                      );
                      toast({
                        title: "Membros adicionados!",
                        description: `${selectedMembers.size} membro(s) adicionado(s) ao grupo.`,
                      });
                      setIsAddMembersModalOpen(false);
                      setSelectedMembers(new Set());
                      setAddMembersSearch("");
                      // Refresh participants list
                      if (selectedGroupForView) {
                        getGroupParticipantsDb(selectedGroupForView.id).then(setGroupParticipants).catch((err: any) => {
                          console.error("Error refreshing participants:", err);
                          toast({ title: "Erro ao atualizar participantes", description: err?.message || "Tente novamente.", variant: "destructive" });
                        });
                      }
                    } else if (selectedMembers.size === 0) {
                      toast({
                        title: "Selecione membros",
                        description: "Selecione pelo menos um membro para adicionar",
                        variant: "destructive",
                      });
                    }
                  } catch (error: any) {
                    toast({
                      title: "Erro ao adicionar membros",
                      description: error.message || "Tente novamente",
                      variant: "destructive",
                    });
                  }
                }}
                className="w-full rounded-full"
                disabled={selectedMembers.size === 0}
              >
                Adicionar {selectedMembers.size > 0 ? `(${selectedMembers.size})` : ""}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Edit Check-in Modal */}
      <Drawer open={isEditCheckInOpen} onOpenChange={setIsEditCheckInOpen}>
        <DrawerContent className="max-h-[80dvh] flex flex-col z-[100]">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>Editar Check-in</DrawerTitle>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {selectedCheckInForDetail && (
              <div className="space-y-4">
                {/* Exercise */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Exercício *</label>
                  <Input
                    value={editCheckInForm.workoutInfo}
                    onChange={(e) =>
                      setEditCheckInForm({
                        ...editCheckInForm,
                        workoutInfo: e.target.value,
                      })
                    }
                    placeholder="Ex: Supino Reto..."
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Descrição</label>
                  <Textarea
                    value={editCheckInForm.description}
                    onChange={(e) =>
                      setEditCheckInForm({
                        ...editCheckInForm,
                        description: e.target.value,
                      })
                    }
                    placeholder="Adicione detalhes sobre seu treino..."
                    className="min-h-24"
                  />
                </div>

                {/* Stats (Read-only) */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-3 rounded-lg bg-muted/20">
                    <div className="font-semibold text-brand text-lg">
                      {selectedCheckInForDetail.series}
                    </div>
                    <div className="text-xs text-muted-foreground">Séries</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/20">
                    <div className="font-semibold text-brand text-lg">
                      {selectedCheckInForDetail.volume}
                    </div>
                    <div className="text-xs text-muted-foreground">Volume (kg)</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/20">
                    <div className="font-semibold text-brand text-lg">✓</div>
                    <div className="text-xs text-muted-foreground">Concluído</div>
                  </div>
                </div>

                {/* Save Button */}
                <Button
                  onClick={async () => {
                    try {
                      if (editCheckInForm.workoutInfo.trim()) {
                        await updateGroupCheckInDb(
                          selectedCheckInForDetail.id,
                          editCheckInForm.workoutInfo,
                          editCheckInForm.description
                        );

                        // Update local state
                        const updatedCheckIns = groupCheckIns.map((c) =>
                          c.id === selectedCheckInForDetail.id
                            ? {
                                ...c,
                                workoutInfo: editCheckInForm.workoutInfo,
                                description: editCheckInForm.description,
                              }
                            : c
                        );
                        setGroupCheckIns(updatedCheckIns);
                        setSelectedCheckInForDetail({
                          ...selectedCheckInForDetail,
                          workoutInfo: editCheckInForm.workoutInfo,
                          description: editCheckInForm.description,
                        });

                        setIsEditCheckInOpen(false);
                        toast({
                          title: "Check-in atualizado!",
                          description: "Suas alterações foram salvas com sucesso.",
                        });
                      } else {
                        toast({
                          title: "Campo obrigatório",
                          description: "Preencha o campo de exercício",
                          variant: "destructive",
                        });
                      }
                    } catch (error: any) {
                      toast({
                        title: "Erro ao atualizar check-in",
                        description: error.message || "Tente novamente",
                        variant: "destructive",
                      });
                    }
                  }}
                  className="w-full rounded-full"
                >
                  Salvar Alterações
                </Button>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

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
