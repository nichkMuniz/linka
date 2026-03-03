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
  getUserProfileDb,
  addMembersToGroupDb,
  updateGroupCheckInDb,
  deleteGroupCheckInDb,
  deleteGroupDb,
  getGroupParticipantsDb,
  type Conversation,
  type MessageWithUser,
  type SearchUser,
  type RankingUser,
  type GroupCheckIn,
  type ExerciseRoutine,
} from "@/lib/ritmofit-db";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { ArrowLeft, Send, Check, CheckCheck, Trophy, TrendingUp, Plus, X, ChevronRight, Trash2, Edit3 } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate, useSearchParams } from "react-router-dom";

type ViewMode = "conversations" | "conversation";

export default function Community() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

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
  const [selectedInvitees, setSelectedInvitees] = React.useState<Set<string>>(new Set());
  const [userCreatedGroups, setUserCreatedGroups] = React.useState<any[]>([]);
  const [availableGroups, setAvailableGroups] = React.useState<any[]>([]);
  const [selectedGroupForView, setSelectedGroupForView] = React.useState<any>(null);
  const [groupCheckIns, setGroupCheckIns] = React.useState<GroupCheckIn[]>([]);
  const [groupParticipants, setGroupParticipants] = React.useState<Array<{ userId: string; userNickname: string; userPhoto: string | null }>>([]);
  const [activeGroupViewTab, setActiveGroupViewTab] = React.useState<"check-ins" | "participants">("check-ins");
  const [isAddCheckInModalOpen, setIsAddCheckInModalOpen] = React.useState(false);
  const [checkInForm, setCheckInForm] = React.useState({
    photo: "",
    description: "",
    workoutId: "",
  });
  const [checkInPhotoFile, setCheckInPhotoFile] = React.useState<File | null>(null);
  const [exerciseRoutines, setExerciseRoutines] = React.useState<ExerciseRoutine[]>([]);
  const [participantsSearch, setParticipantsSearch] = React.useState("");
  const [selectedCheckInForDetail, setSelectedCheckInForDetail] = React.useState<GroupCheckIn | null>(null);
  const [isCheckInDetailOpen, setIsCheckInDetailOpen] = React.useState(false);
  const [userNickname, setUserNickname] = React.useState<string>("");
  const [isGroupDetailsOpen, setIsGroupDetailsOpen] = React.useState(false);
  const [isClassificationsOpen, setIsClassificationsOpen] = React.useState(false);
  const [isAddMembersModalOpen, setIsAddMembersModalOpen] = React.useState(false);
  const [selectedMembers, setSelectedMembers] = React.useState<Set<string>>(new Set());
  const [addMembersSearch, setAddMembersSearch] = React.useState("");
  const [isEditCheckInOpen, setIsEditCheckInOpen] = React.useState(false);
  const [editCheckInForm, setEditCheckInForm] = React.useState({
    workoutInfo: "",
    description: "",
  });

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

        // Load user groups
        const [createdGroups, availGroups] = await Promise.all([
          getUserCreatedDuelGroupsDb(user.id),
          getAvailableDuelGroupsDb(user.id),
        ]);
        setUserCreatedGroups(
          createdGroups.map((group) => ({
            ...group,
            icon: "⚔️",
            description: group.goal,
            participants: 1,
            city: group.location,
            isOfficial: false,
          }))
        );
        setAvailableGroups(
          availGroups.map((group) => ({
            ...group,
            icon: "⚔️",
            description: group.goal,
            participants: 1,
            city: group.location,
            isOfficial: false,
          }))
        );
      } catch (err: any) {
        console.error("Error loading user groups:", err);
      }
    };

    loadUserData();
  }, [user?.id, user?.user_metadata]);

  // Auto-select conversation from URL parameter
  React.useEffect(() => {
    const userIdParam = searchParams.get("user");
    if (userIdParam && conversations.length > 0) {
      const conversation = conversations.find((c) => c.userId === userIdParam);
      if (conversation) {
        setSelectedConversation(conversation);
        setViewMode("conversation");
        setActiveTab("messages");
      }
    }
  }, [searchParams, conversations]);

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
  }, []);

  if (loading) {
    return (
      <div className="mx-auto grid w-full max-w-2xl gap-4 p-4">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (activeTab === "messages" && viewMode === "conversation" && selectedConversation) {
    return (
      <div className="w-full h-[calc(100dvh-140px)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-border/60 bg-background px-4 py-3 flex items-center gap-3">
          <button
            onClick={handleBackToConversations}
            className="text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 flex items-center gap-3 min-w-0">
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
          </div>
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
            placeholder="Envie uma mensagem..."
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
    <div className="w-full h-[calc(100dvh-140px)] flex flex-col overflow-hidden">
      {/* Tabs */}
      <div className="flex-shrink-0 border-b border-border/60 px-4 pt-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 rounded-lg">
            <TabsTrigger value="messages">Mensagens</TabsTrigger>
            <TabsTrigger value="duels">Duelos</TabsTrigger>
            <TabsTrigger value="ranking">Ranking</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Messages Tab */}
      {activeTab === "messages" && (
        <>
          {/* Header */}
          <div className="flex-shrink-0 px-4 pt-4 pb-0">
            <h1 className="text-2xl font-bold tracking-tight">Mensagens</h1>
          </div>

          {/* Search Bar */}
          <div className="flex-shrink-0 border-b border-border/60 px-4 py-3">
            <Input
              placeholder="Pesquisar pessoas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-full"
            />
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {filteredConversations.length > 0 ? (
              <div className="space-y-2">
                {filteredConversations.map((conversation) => (
                  <button
                    key={conversation.userId}
                    onClick={() => handleOpenConversation(conversation)}
                    className="w-full"
                  >
                    <Card className="border-border/60 hover:bg-muted/50 transition-colors cursor-pointer">
                      <CardContent className="p-4 flex items-center gap-3">
                        {conversation.userPhoto ? (
                          <img
                            src={conversation.userPhoto}
                            alt={conversation.userNickname}
                            className="h-12 w-12 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-muted shrink-0" />
                        )}

                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-sm truncate">
                              {conversation.userNickname}
                            </p>
                            <p className="text-xs text-muted-foreground shrink-0">
                              {formatTimeAgo(conversation.lastMessageTime)}
                            </p>
                          </div>
                          <p
                            className={`text-sm truncate ${
                              conversation.unreadCount > 0
                                ? "font-medium text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {conversation.lastMessage}
                          </p>
                        </div>

                        {conversation.unreadCount > 0 && (
                          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-brand text-white text-xs font-semibold shrink-0">
                            {conversation.unreadCount > 9
                              ? "9+"
                              : conversation.unreadCount}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </button>
                ))}
              </div>
            ) : filteredFollowers.length > 0 ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Você ainda não tem conversas. Inicie uma nova conversa
                  </p>
                </div>

                <div className="space-y-2">
                  {filteredFollowers.map((follower) => (
                    <button
                      key={follower.id}
                      onClick={() => {
                        setSelectedConversation({
                          userId: follower.id,
                          userNickname: follower.nickname,
                          userPhoto: follower.photo,
                          lastMessage: "",
                          lastMessageTime: new Date().toISOString(),
                          unreadCount: 0,
                        });
                        setViewMode("conversation");
                      }}
                      className="w-full"
                    >
                      <Card className="border-border/60 hover:bg-muted/50 transition-colors cursor-pointer">
                        <CardContent className="p-4 flex items-center gap-3">
                          {follower.photo ? (
                            <img
                              src={follower.photo}
                              alt={follower.nickname}
                              className="h-12 w-12 rounded-full object-cover shrink-0"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-full bg-muted shrink-0" />
                          )}

                          <div className="flex-1 min-w-0 text-left">
                            <p className="font-medium text-sm">{follower.nickname}</p>
                            {follower.bio && (
                              <p className="text-xs text-muted-foreground truncate">
                                {follower.bio}
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-8 text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  Você ainda não segue ninguém. Procure por pessoas para seguir!
                </p>
                <a href="/buscar">
                  <Button className="rounded-full">Buscar</Button>
                </a>
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
              <div className="bg-gradient-to-br from-brand/20 via-brand/10 to-background relative h-40 flex items-center justify-center border-b border-border/40">
                <div className="text-center">
                  <div className="text-6xl mb-2">{selectedGroupForView.icon}</div>
                  <h1 className="text-2xl font-bold">{selectedGroupForView.name}</h1>
                </div>
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

              {/* Hoje (Today) Section */}
              <div className="px-4 py-2">
                <h3 className="font-semibold text-base mb-3">Hoje</h3>
              </div>

              {/* Check-ins from Participants */}
              <div className="space-y-2 px-3">
                {groupCheckIns.length > 0 ? (
                  groupCheckIns.map((checkIn) => (
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
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum check-in ainda</p>
                )}
              </div>
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
                  const routines = await getUserExerciseRoutinesDb(user.id);
                  setExerciseRoutines(routines || []);
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
            <h1 className="text-2xl font-bold tracking-tight">Duelos</h1>
          </div>

          {/* Duels Grid */}
          <div className="flex-1 overflow-y-auto px-3 pb-24 pt-4 space-y-6">
            {/* User Created Groups Section */}
            {userCreatedGroups.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-brand mb-3">Meus Grupos</h2>
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
                          Ver Grupo
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Available Groups Section */}
            {availableGroups.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground mb-3">Grupos Disponíveis</h2>
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
                          onClick={() => {
                            toast({
                              title: "Participando!",
                              description: `Você agora faz parte de "${group.name}"`,
                            });
                          }}
                        >
                          Participar
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {userCreatedGroups.length === 0 && availableGroups.length === 0 && (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-8 text-center">
                <p className="text-sm text-muted-foreground">Nenhum grupo disponível no momento</p>
              </div>
            )}
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
              Criar Grupo
            </Button>
          </div>
        </>
      )}

      {/* Ranking Tab */}
      {activeTab === "ranking" && (
        <>
          {/* Header */}
          <div className="flex-shrink-0 px-4 pt-4 pb-0">
            <h1 className="text-2xl font-bold tracking-tight">Ranking</h1>
          </div>

          {/* Ranking List */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3 pt-4">
            {ranking.length > 0 ? (
              <div className="space-y-2">
                {ranking.map((user, index) => {
                  const medalEmoji =
                    index === 0
                      ? "🥇"
                      : index === 1
                        ? "🥈"
                        : index === 2
                          ? "🥉"
                          : "";

                  return (
                    <Card key={user.userId} className="border-border/60">
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
                            {user.userPhoto ? (
                              <img
                                src={user.userPhoto}
                                alt={user.userNickname}
                                className="h-12 w-12 rounded-full object-cover"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-full bg-muted" />
                            )}

                            <div className="flex-1">
                              <p className="font-semibold text-sm">
                                {user.userNickname}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Nível {user.level}
                              </p>
                            </div>
                          </div>

                          <div className="flex-shrink-0 text-right">
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-4 w-4 text-brand" />
                              <span className="font-bold text-brand">
                                {user.points}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              pontos
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
                <p className="text-sm text-muted-foreground">
                  Nenhum ranking disponível no momento. Comece a ganhar pontos
                  interagindo no app!
                </p>
              </div>
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
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Você não segue ninguém ainda
                      </p>
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
                          description: groupConfig.goal,
                          participants: selectedInvitees.size + 1,
                          city: groupConfig.location,
                          isOfficial: false,
                        };

                        setUserCreatedGroups([...userCreatedGroups, newGroup]);
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
                        toast({
                          title: "Grupo criado!",
                          description: `"${groupConfig.name}" foi criado com sucesso.`,
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
                    Criar Grupo
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

              {/* Exercise Routine Select */}
              <div className="space-y-2">
                <label className="text-sm font-medium">O que você treinou? *</label>
                <Select value={checkInForm.workoutId} onValueChange={(value) => setCheckInForm({ ...checkInForm, workoutId: value })}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder="Selecione uma rotina de treino" />
                  </SelectTrigger>
                  <SelectContent side="top" className="z-[101]">
                    {exerciseRoutines.length > 0 ? (
                      exerciseRoutines.map((routine) => (
                        <SelectItem key={routine.id} value={routine.id}>
                          {routine.exerciseName}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-4 py-2 text-sm text-muted-foreground">
                        Nenhuma rotina de treino registrada
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={async () => {
                  if (!user || !selectedGroupForView) return;
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
                  }
                }}
                className="w-full rounded-full"
                disabled={!checkInForm.workoutId || !user}
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
                      if (window.confirm("Tem certeza que deseja excluir este check-in? Esta ação é irreversível.")) {
                        setGroupCheckIns(groupCheckIns.filter((c) => c.id !== selectedCheckInForDetail.id));
                        setIsCheckInDetailOpen(false);
                        toast({
                          title: "Check-in excluído!",
                          description: "O check-in foi removido com sucesso.",
                        });
                      }
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
                  <Button
                    onClick={() => {
                      setSelectedMembers(new Set());
                      setAddMembersSearch("");
                      setIsAddMembersModalOpen(true);
                    }}
                    className="w-full rounded-full gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar Membros
                  </Button>

                  <Button
                    onClick={async () => {
                      if (window.confirm("Tem certeza que deseja apagar este grupo? Esta ação é irreversível.")) {
                        try {
                          await deleteGroupDb(selectedGroupForView.id);
                          toast({
                            title: "Grupo apagado!",
                            description: "O grupo foi removido com sucesso.",
                          });
                          setIsGroupDetailsOpen(false);
                          setSelectedGroupForView(null);
                          setGroupCheckIns([]);
                          // Refresh the group lists
                          const [createdGroups, availGroups] = await Promise.all([
                            getUserCreatedDuelGroupsDb(user!.id),
                            getAvailableDuelGroupsDb(user!.id),
                          ]);
                          setUserCreatedGroups(createdGroups.map((group) => ({ ...group })));
                          setAvailableGroups(availGroups);
                        } catch (error: any) {
                          console.error("Error deleting group:", error);
                          toast({
                            title: "Erro ao apagar grupo",
                            description: error?.message || "Tente novamente.",
                            variant: "destructive",
                          });
                        }
                      }
                    }}
                    variant="destructive"
                    className="w-full rounded-full gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Apagar Grupo
                  </Button>
                </div>
              </div>
            )}
          </div>
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
                    f.nickname.toLowerCase().includes(addMembersSearch.toLowerCase())
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
