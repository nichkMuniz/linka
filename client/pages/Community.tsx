import * as React from "react";
import {
  getConversationsDb,
  getConversationMessagesDb,
  sendMessageDb,
  markMessagesAsReadDb,
  getFollowingDb,
  getRankingDb,
  createDuelGroupDb,
  getDuelGroupDb,
  addGroupCheckInDb,
  getGroupCheckInsDb,
  getUserCreatedDuelGroupsDb,
  getAvailableDuelGroupsDb,
  getUserExerciseRoutinesDb,
  getUserWorkoutsDb,
  getUserProfileDb,
  addMembersToGroupDb,
  leaveGroupDb,
  updateGroupCheckInDb,
  deleteGroupCheckInDb,
  deleteGroupDb,
  getGroupParticipantsDb,
  updateGroupPhotoDb,
  getPendingInvitesDb,
  acceptGroupInviteDb,
  declineGroupInviteDb,
  sendGroupJoinRequestNotificationDb,
  type Conversation,
  type MessageWithUser,
  type SearchUser,
  type RankingUser,
  type GroupCheckIn,
  type ExerciseRoutine,
  type UserWorkoutWithDetails,
} from "@/lib/ritmofit-db";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// Tabs component replaced by custom underline tabs
import { toast } from "@/components/ui/use-toast";
import { ArrowLeft, Send, Check, CheckCheck, Trophy, TrendingUp, Plus, X, ChevronRight, ChevronDown, Trash2, Edit3, Search, PenSquare, MessageCircle } from "lucide-react";
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
import { LoadingSpinner } from "@/components/animated-loading";
import { useLayoutMode } from "@/hooks/useLayoutMode";
import { useLanguage } from "@/lib/language-context";

type ViewMode = "conversations" | "conversation";

export default function Community() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
  const [groupStep, setGroupStep] = React.useState<"config" | "invite">("config");
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
  const [exerciseRoutines, setExerciseRoutines] = React.useState<ExerciseRoutine[]>([]);
  const [checkInUserWorkouts, setCheckInUserWorkouts] = React.useState<UserWorkoutWithDetails[]>([]);
  const [checkInExpandedRoutine, setCheckInExpandedRoutine] = React.useState<string | null>(null);
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
        // Get user nickname from profile
        const userProfile = await getUserProfileDb(user.id);
        const nickname = userProfile?.nickname || user.email?.split("@")[0] || "Usuário";
        setUserNickname(nickname);

        // Load user groups + all other groups + pending invites
        const [createdGroups, availGroups, invites] = await Promise.all([
          getUserCreatedDuelGroupsDb(user.id),
          getAvailableDuelGroupsDb(user.id),
          getPendingInvitesDb(),
        ]);
        setPendingInvites(invites);

        const toGroupCard = (group: any) => ({
          ...group,
          icon: "⚔️",
          description: group.goal,
          participants: 1,
          city: group.location,
          isOfficial: false,
        });

        setUserCreatedGroups(createdGroups.map(toGroupCard));

        // Enrich available groups with creator profile and membership status
        const enrichedAvailGroups = await Promise.all(
          availGroups.map(async (group: any) => {
            const [creatorProfile, participants] = await Promise.all([
              getUserProfileDb(group.createdBy),
              getGroupParticipantsDb(group.id),
            ]);
            const isPending = invites.some((inv) => inv.groupId === group.id);
            return {
              ...toGroupCard(group),
              creatorNickname: creatorProfile?.nickname || "Usuário",
              creatorPhoto: creatorProfile?.photo || null,
              participants: participants.length,
              isAlreadyMember: participants.some((p: any) => p.userId === user.id),
              isPending,
            };
          })
        );
        const alreadyJoined = new Set(
          enrichedAvailGroups.filter((g) => g.isAlreadyMember).map((g) => g.id)
        );
        setJoinedGroupIds(alreadyJoined);
        setAvailableGroups(enrichedAvailGroups);
      } catch (err: any) {
        console.error("Error loading user groups:", err);
      }
    };

    loadUserData();
  }, [user?.id]);

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
              userNickname: profile.nickname || profile.name || "Usuário",
              userPhoto: profile.photo || null,
              lastMessage: "",
              lastMessageTime: new Date().toISOString(),
            };
            setSelectedConversation(newConv);
            setViewMode("conversation");
          }
        }).catch(console.error);
      });
    }
  }, [searchParams, conversations, loading]);

  // Load conversation messages when selected
  React.useEffect(() => {
    if (!selectedConversation || viewMode !== "conversation") return;

    const loadMessages = async () => {
      try {
        const data = await getConversationMessagesDb(
          selectedConversation.userId,
        );
        setMessages(data);

        // Mark messages as read
        await markMessagesAsReadDb(selectedConversation.userId);

        // Update conversation unread count
        setConversations((prev) =>
          prev.map((conv) =>
            conv.userId === selectedConversation.userId
              ? { ...conv, unreadCount: 0 }
              : conv,
          ),
        );
      } catch (err: any) {
        console.error("Error loading messages:", err);
      }
    };

    loadMessages();
  }, [selectedConversation, viewMode]);

  // Auto-scroll to bottom when messages change
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = React.useCallback(async () => {
    if (!messageText.trim() || !selectedConversation) return;

    setIsSending(true);
    try {
      const newMessage = await sendMessageDb(
        selectedConversation.userId,
        messageText,
      );

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
    setViewMode("conversations");
    setSelectedConversation(null);
    // Refresh conversations list so new message appears immediately
    getConversationsDb().then(setConversations).catch(console.error);
  }, []);

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
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {selectedConversation.userNickname}
              </p>
            </div>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 px-4 py-4">
          {messages.length > 0 ? (
            messages.map((message) => {
              const isOwn = message.id_user === user?.id;
              return (
                <div
                  key={message.id}
                  className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-xs px-4 py-2 rounded-lg space-y-1 break-words ${
                      isOwn
                        ? "bg-brand text-white rounded-br-none"
                        : "bg-muted rounded-bl-none"
                    }`}
                  >
                    <p className="text-sm">{message.text}</p>
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
            {pendingInvites.length > 0 && (
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
                  {pendingInvites.length}
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
                  <button
                    key={conversation.userId}
                    onClick={() => handleOpenConversation(conversation)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 active:bg-muted/50 transition-colors text-left"
                  >
                    {/* Avatar com ring se não lido */}
                    <div className={`relative shrink-0 ${conversation.unreadCount > 0 ? "ring-2 ring-brand ring-offset-2 ring-offset-background rounded-full" : ""}`}>
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
                      <div className="p-3 rounded-lg bg-muted/30 border border-border/40 text-center flex flex-col items-center">
                        <div className="text-lg font-bold text-brand mb-1">
                          {leaderStats?.count || 0}
                        </div>
                        {leaderStats?.userName && (
                          <div className="text-xs text-muted-foreground truncate w-full">
                            {leaderStats.userName}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">Líder</div>
                      </div>

                      {/* User Ranking Card */}
                      <div className="p-3 rounded-lg bg-muted/30 border border-border/40 text-center">
                        <div className="text-lg font-bold text-brand mb-2">
                          {userRanking > 0 ? `#${userRanking}` : "-"}
                        </div>
                        <div className="text-xs text-muted-foreground">Você</div>
                      </div>

                      {/* Days Remaining Card */}
                      <div className="p-3 rounded-lg bg-muted/30 border border-border/40 text-center">
                        <div className="text-lg font-bold text-brand mb-2">
                          {daysRemaining !== null ? (daysRemaining > 0 ? daysRemaining : "Fim") : "-"}
                        </div>
                        <div className="text-xs text-muted-foreground">dias</div>
                      </div>
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
                  {groupCheckIns.length > 0 ? (() => {
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
                          {group.items.map((checkIn) => (
                            <button
                              key={checkIn.id}
                              onClick={() => {
                                setSelectedCheckInForDetail(checkIn);
                                setIsCheckInDetailOpen(true);
                              }}
                              className="w-full text-left"
                            >
                              <div className="p-3 rounded-lg bg-muted/30 border border-border/40 hover:bg-muted/50 transition-colors">
                                <div className="flex gap-3">
                                  {checkIn.photo && (
                                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                                      <img src={checkIn.photo} alt="check-in" className="w-full h-full object-cover" />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold truncate">{checkIn.workoutInfo}</p>
                                    <p className="text-xs text-muted-foreground truncate">{checkIn.userName}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{new Date(checkIn.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                  </div>
                                </div>
                              </div>
                            </button>
                          ))}
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
              onClick={async () => {
                if (!user?.id) return;
                try {
                  const [routines, workouts] = await Promise.all([
                    getUserExerciseRoutinesDb(user.id),
                    getUserWorkoutsDb(user.id),
                  ]);
                  setExerciseRoutines(routines || []);
                  setCheckInUserWorkouts(workouts || []);
                  setCheckInExpandedRoutine(null);
                } catch (err: any) {
                  console.error("Error loading exercise routines:", err);
                  setExerciseRoutines([]);
                  toast({
                    title: "Aviso",
                    description: "Não foi possível carregar as rotinas. Tente novamente.",
                    variant: "destructive",
                  });
                }
                setCheckInForm({ photo: "", description: "", workoutId: "" });
                setCheckInPhotoFile(null);
                setIsAddCheckInModalOpen(true);
              }}
              className="h-14 w-14 rounded-full bg-brand text-white flex items-center justify-center hover:bg-brand/90 transition-colors shadow-lg"
              title="Adicionar check-in"
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>
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
                          onClick={async () => {
                            setSelectedGroupForView(group);
                            setActiveGroupViewTab("check-ins");
                            try {
                              const [checkIns, participants] = await Promise.all([
                                getGroupCheckInsDb(group.id),
                                getGroupParticipantsDb(group.id),
                              ]);
                              setGroupCheckIns(checkIns);
                              setGroupParticipants(participants);
                            } catch (err: any) {
                              console.error("Error loading group data:", err);
                            }
                          }}
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
                              onClick={async () => {
                                setSelectedGroupForView(group);
                                setActiveGroupViewTab("check-ins");
                                try {
                                  const [checkIns, participants] = await Promise.all([
                                    getGroupCheckInsDb(group.id),
                                    getGroupParticipantsDb(group.id),
                                  ]);
                                  setGroupCheckIns(checkIns);
                                  setGroupParticipants(participants);
                                } catch (err: any) {
                                  console.error("Error loading group data:", err);
                                }
                              }}
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
                setGroupStep("config");
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

      {/* Solicitações (Pending Invites) Tab */}
      {activeTab === "requests" && (
        <>
          <div className="flex-shrink-0 px-4 pt-4 pb-0">
            <h1 className="text-2xl font-bold tracking-tight">Solicitações</h1>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4 space-y-3">
            {pendingInvites.map((invite) => (
              <Card key={invite.groupId} className="border-border/60">
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
                      className="flex-1 rounded-full text-xs h-8"
                      onClick={async () => {
                        try {
                          await acceptGroupInviteDb(invite.groupId);
                          const updated = pendingInvites.filter((i) => i.groupId !== invite.groupId);
                          setPendingInvites(updated);
                          toast({ title: "Convite aceito!", description: `Você entrou em "${invite.groupName}".` });

                          // Navigate directly to the group detail view
                          const [group, checkIns, participants] = await Promise.all([
                            getDuelGroupDb(invite.groupId),
                            getGroupCheckInsDb(invite.groupId),
                            getGroupParticipantsDb(invite.groupId),
                          ]);
                          if (group) {
                            setSelectedGroupForView(group);
                            setGroupCheckIns(checkIns);
                            setGroupParticipants(participants);
                            setActiveGroupViewTab("check-ins");
                            setActiveTab("duels");
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
                      className="flex-1 rounded-full text-xs h-8"
                      onClick={async () => {
                        try {
                          await declineGroupInviteDb(invite.groupId);
                          const updated = pendingInvites.filter((i) => i.groupId !== invite.groupId);
                          setPendingInvites(updated);
                          if (updated.length === 0) setActiveTab("duels");
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
            setGroupStep("config");
            setParticipantsSearch("");
          }
        }}
      >
        <DrawerContent className="max-h-[90dvh] flex flex-col z-[100]">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>
              {groupStep === "config" ? "Criar Novo Grupo" : "Convidar Participantes"}
            </DrawerTitle>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {groupStep === "config" ? (
              <div className="space-y-4">
                {/* Group Name */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome do Grupo *</label>
                  <Input
                    value={groupConfig.name}
                    onChange={(e) =>
                      setGroupConfig({ ...groupConfig, name: e.target.value })
                    }
                    placeholder="Ex: Supino Masters, Cardio Challenge..."
                  />
                </div>

                {/* Location - Brazilian States */}
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

                {/* Goal */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Meta do Grupo *</label>
                  <Textarea
                    value={groupConfig.goal}
                    onChange={(e) =>
                      setGroupConfig({ ...groupConfig, goal: e.target.value })
                    }
                    placeholder="Ex: Maior volume total de supino em 30 dias..."
                    className="min-h-20"
                  />
                </div>

                {/* Duration */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Duração do Desafio</label>
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
                </div>

                {/* Group Photo */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Foto do Grupo</label>
                  <div className="flex gap-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setGroupPhotoFile(file);
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setGroupConfig({
                              ...groupConfig,
                              photo: reader.result as string,
                            });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="flex-1"
                    />
                  </div>
                  {groupConfig.photo && (
                    <div className="rounded-lg overflow-hidden bg-muted h-32">
                      <img
                        src={groupConfig.photo}
                        alt="group"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>

                <Button
                  onClick={() => {
                    if (groupConfig.name && groupConfig.location && groupConfig.goal && groupConfig.durationDays) {
                      setGroupStep("invite");
                    } else {
                      toast({
                        title: "Campos obrigatórios",
                        description: "Preencha todos os campos para continuar",
                        variant: "destructive",
                      });
                    }
                  }}
                  className="w-full rounded-full mt-6"
                >
                  Próximo: Convidar Participantes
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Selected Group Info */}
                <div className="p-4 rounded-lg bg-muted/20 border border-brand/20">
                  <div className="text-sm font-semibold text-brand mb-1">
                    {groupConfig.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    📍 {groupConfig.location}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    {groupConfig.goal}
                  </div>
                </div>

                {/* Invite Followers */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">
                      Convidar Participantes ({selectedInvitees.size})
                    </label>
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

                  {/* Search Field */}
                  {followers.length > 0 && (
                    <Input
                      placeholder="Pesquisar seguidor..."
                      value={participantsSearch}
                      onChange={(e) => setParticipantsSearch(e.target.value)}
                      className="rounded-lg"
                    />
                  )}

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {followers.length > 0 ? (
                      followers
                        .filter((f) =>
                          f.nickname.toLowerCase().includes(participantsSearch.toLowerCase())
                        )
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
                            selectedInvitees.has(follower.id)
                              ? "border-brand bg-brand/10"
                              : "border-border hover:border-brand/50"
                          }`}
                        >
                          <div
                            className={`h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                              selectedInvitees.has(follower.id)
                                ? "bg-brand border-brand"
                                : "border-muted-foreground"
                            }`}
                          >
                            {selectedInvitees.has(follower.id) && (
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
                      <div className="flex flex-col items-center gap-3 py-4">
                        <p className="text-sm text-muted-foreground text-center">
                          Você não segue ninguém ainda
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full gap-2"
                          onClick={() => {
                            setIsCreateGroupModalOpen(false);
                            navigate("/buscar");
                          }}
                        >
                          <Search className="h-4 w-4" />
                          Buscar Usuários
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => setGroupStep("config")}
                    variant="outline"
                    className="flex-1 rounded-full"
                  >
                    Voltar
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!user) return;
                      try {
                        // Calculate end date based on duration
                        let endDate: string | undefined;
                        if (groupConfig.durationDays) {
                          const now = new Date();
                          const days = parseInt(groupConfig.durationDays);
                          now.setDate(now.getDate() + days);
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

                        const newGroup = {
                          ...savedGroup,
                          icon: "⚔️",
                          photo: groupConfig.photo || null,
                          description: groupConfig.goal,
                          participants: selectedInvitees.size + 1,
                          city: groupConfig.location,
                          isOfficial: false,
                        };

                        // Refresh created groups from DB
                        getUserCreatedDuelGroupsDb(user.id).then((groups) => {
                          setUserCreatedGroups(groups.map((g: any) => ({
                            ...g,
                            icon: "⚔️",
                            description: g.goal,
                            participants: 1,
                            city: g.location,
                            isOfficial: false,
                          })));
                        }).catch(console.error);
                        setIsCreateGroupModalOpen(false);
                        // Reset form
                        setGroupConfig({
                          name: "",
                          location: "",
                          goal: "",
                          durationDays: "",
                          photo: "",
                        });
                        setGroupPhotoFile(null);
                        setSelectedInvitees(new Set());
                        setGroupStep("config");

                        // Navigate directly to the new group detail view
                        setSelectedGroupForView(newGroup);
                        setActiveGroupViewTab("check-ins");
                        setGroupCheckIns([]);
                        setGroupParticipants([]);

                        toast({
                          title: "Grupo criado!",
                          description: `"${newGroup.name}" foi criado com sucesso.`,
                        });
                      } catch (err: any) {
                        const errorMessage = err?.message || (typeof err === 'string' ? err : JSON.stringify(err)) || "Tente novamente";
                        console.error("Full error details:", err);
                        toast({
                          title: "Erro ao criar grupo",
                          description: errorMessage,
                          variant: "destructive",
                        });
                      }
                    }}
                    className="flex-1 rounded-full"
                    disabled={selectedInvitees.size === 0}
                  >
                    {t("duels_create")}
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
        <DrawerContent className="max-h-[90dvh] flex flex-col z-[100]">
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

              {/* Exercise Routine Selector — expandable cards */}
              <div className="space-y-2">
                <label className="text-sm font-medium">O que você treinou? *</label>
                {exerciseRoutines.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-3">Nenhuma rotina de exercícios registrada</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {exerciseRoutines.map((routine) => {
                      const isSelected = checkInForm.workoutId === routine.id;
                      const isExpanded = checkInExpandedRoutine === routine.id;
                      // exercises belonging to this routine name
                      const exercises = routine.id === "__unnamed__"
                        ? checkInUserWorkouts.filter((w) => !w.name)
                        : checkInUserWorkouts.filter((w) => w.name === routine.exerciseName);
                      return (
                        <div
                          key={routine.id}
                          className={`rounded-xl border overflow-hidden transition-colors ${isSelected ? "border-brand bg-brand/5" : "border-border/60"}`}
                        >
                          <div className="flex items-center gap-3 px-3 py-2.5">
                            {/* Select radio */}
                            <button
                              onClick={() => setCheckInForm({ ...checkInForm, workoutId: routine.id })}
                              className={`shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? "border-brand bg-brand" : "border-border"}`}
                            >
                              {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                            </button>
                            {/* Routine name */}
                            <span className="flex-1 text-sm font-medium">{routine.exerciseName}</span>
                            {/* Expand toggle */}
                            {exercises.length > 0 && (
                              <button
                                onClick={() => setCheckInExpandedRoutine(isExpanded ? null : routine.id)}
                                className="p-1 text-muted-foreground"
                              >
                                <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                              </button>
                            )}
                          </div>
                          {isExpanded && exercises.length > 0 && (
                            <div className="border-t border-border/40 bg-muted/20 px-3 py-2 space-y-1">
                              {exercises.map((w: any) => (
                                <p key={w.id} className="text-xs text-muted-foreground">• {w.workoutName || w.name || "Exercício"}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <Button
                onClick={async () => {
                  if (!user || !selectedGroupForView || isSubmittingCheckIn) return;
                  setIsSubmittingCheckIn(true);
                  try {
                    // Find the selected exercise routine
                    const selectedRoutine = exerciseRoutines.find((r) => r.id === checkInForm.workoutId);
                    const exerciseName = selectedRoutine?.exerciseName || "Exercício desconhecido";

                    const checkIn = await addGroupCheckInDb(
                      selectedGroupForView.id,
                      user.id,
                      userNickname || "Usuário",
                      checkInForm.photo,
                      checkInForm.description,
                      exerciseName,
                      0,
                      0
                    );

                    setGroupCheckIns([...groupCheckIns, checkIn]);
                    setIsAddCheckInModalOpen(false);
                    setCheckInForm({
                      photo: "",
                      description: "",
                      workoutId: "",
                    });
                    setCheckInPhotoFile(null);
                    setParticipantsSearch("");

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
                disabled={!checkInForm.workoutId || !user || isSubmittingCheckIn}
              >
                Adicionar Check-in
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Check-in Detail Modal */}
      <Drawer open={isCheckInDetailOpen} onOpenChange={setIsCheckInDetailOpen}>
        <DrawerContent className="max-h-[90dvh] flex flex-col z-[100]">
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
              <div className="space-y-4">
                {/* User Info */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/20">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm flex-shrink-0">
                    👤
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{selectedCheckInForDetail.userName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(selectedCheckInForDetail.createdAt).toLocaleDateString("pt-BR", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>

                {/* Photo */}
                {selectedCheckInForDetail.photo && (
                  <div className="rounded-lg overflow-hidden bg-muted h-64">
                    <img
                      src={selectedCheckInForDetail.photo}
                      alt="check-in"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Workout Info */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Exercício</label>
                  <div className="p-3 rounded-lg bg-card border border-brand/20">
                    <p className="text-sm font-medium text-brand">{selectedCheckInForDetail.workoutInfo}</p>
                  </div>
                </div>

                {/* Description */}
                {selectedCheckInForDetail.description && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Descrição</label>
                    <div className="p-3 rounded-lg bg-muted/20">
                      <p className="text-sm text-foreground">{selectedCheckInForDetail.description}</p>
                    </div>
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-3 rounded-lg bg-muted/20">
                    <div className="font-semibold text-brand text-lg">{selectedCheckInForDetail.series}</div>
                    <div className="text-xs text-muted-foreground">Séries</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/20">
                    <div className="font-semibold text-brand text-lg">{selectedCheckInForDetail.volume}</div>
                    <div className="text-xs text-muted-foreground">Volume (kg)</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/20">
                    <div className="font-semibold text-brand text-lg">✓</div>
                    <div className="text-xs text-muted-foreground">Concluído</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Group Details Modal */}
      <Drawer open={isGroupDetailsOpen} onOpenChange={setIsGroupDetailsOpen}>
        <DrawerContent className="max-h-[90dvh] flex flex-col z-[100]">
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
                      const [createdGroups, availGroups] = await Promise.all([
                        getUserCreatedDuelGroupsDb(user!.id),
                        getAvailableDuelGroupsDb(user!.id),
                      ]);
                      const toGroupCard = (g: any) => ({ ...g, icon: "⚔️", description: g.goal, participants: 1, city: g.location, isOfficial: false });
                      setUserCreatedGroups(createdGroups.map(toGroupCard));
                      const enriched = await Promise.all(
                        availGroups.map(async (g: any) => {
                          const [creatorProfile, participants] = await Promise.all([getUserProfileDb(g.createdBy), getGroupParticipantsDb(g.id)]);
                          return { ...toGroupCard(g), creatorNickname: creatorProfile?.nickname || "Usuário", creatorPhoto: creatorProfile?.photo || null, participants: participants.length, isAlreadyMember: participants.some((p: any) => p.userId === user!.id) };
                        })
                      );
                      setJoinedGroupIds(new Set(enriched.filter((g) => g.isAlreadyMember).map((g) => g.id)));
                      setAvailableGroups(enriched);
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
                      setJoinedGroupIds((prev) => { const next = new Set(prev); next.delete(groupId); return next; });
                      setAvailableGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, participants: Math.max(0, g.participants - 1), isAlreadyMember: false } : g));
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
        <DrawerContent className="max-h-[90dvh] flex flex-col z-[100]">
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
        <DrawerContent className="max-h-[90dvh] flex flex-col z-[100]">
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
                      <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0" />
                    )}
                    <p className="text-sm font-medium">{participant.userNickname}</p>
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
        <DrawerContent className="max-h-[90dvh] flex flex-col z-[100]">
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
                        getGroupParticipantsDb(selectedGroupForView.id).then(setGroupParticipants).catch(console.error);
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
        <DrawerContent className="max-h-[90dvh] flex flex-col z-[100]">
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
