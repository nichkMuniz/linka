import * as React from "react";
import {
  getConversationsDb,
  getConversationMessagesDb,
  sendMessageDb,
  markMessagesAsReadDb,
  getFollowingDb,
  getRankingDb,
  type Conversation,
  type MessageWithUser,
  type SearchUser,
  type RankingUser,
} from "@/lib/ritmofit-db";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { ArrowLeft, Send, Check, CheckCheck, Trophy, TrendingUp, Plus, X, ChevronRight } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
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
  });
  const [selectedInvitees, setSelectedInvitees] = React.useState<Set<string>>(new Set());
  const [userGroups, setUserGroups] = React.useState<any[]>([]);

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

      {/* Duels Tab */}
      {activeTab === "duels" && (
        <>
          {/* Header */}
          <div className="flex-shrink-0 px-4 pt-4 pb-0 flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight">Duelos</h1>
            <Button
              onClick={() => {
                setGroupStep("config");
                setGroupConfig({ name: "", location: "", goal: "" });
                setSelectedInvitees(new Set());
                setIsCreateGroupModalOpen(true);
              }}
              size="sm"
              className="gap-2 rounded-full"
            >
              <Plus className="h-4 w-4" />
              Criar Grupo
            </Button>
          </div>

          {/* Duels Grid - 2 columns */}
          <div className="flex-1 overflow-y-auto px-3 pb-4 pt-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  icon: "⚔️",
                  name: "Supino Attack",
                  description: "Maior volume de supino",
                  participants: 12,
                  city: "São Paulo",
                  isOfficial: true,
                },
                {
                  icon: "🏃",
                  name: "Cardio Masters",
                  description: "Maior tempo em cardio",
                  participants: 8,
                  city: "Rio de Janeiro",
                  isOfficial: true,
                },
                {
                  icon: "💪",
                  name: "Leg Day Warriors",
                  description: "Volume total de perna",
                  participants: 15,
                  city: "Belo Horizonte",
                  isOfficial: true,
                },
                {
                  icon: "🔥",
                  name: "Calorie Burners",
                  description: "Maior gasto calórico",
                  participants: 10,
                  city: "Curitiba",
                  isOfficial: true,
                },
                ...userGroups,
              ].map((group) => (
                <Card
                  key={group.name}
                  className="border-border/60 hover:shadow-md transition-shadow flex flex-col"
                >
                  <CardContent className="p-3 flex flex-col h-full">
                    {/* Icon and Name */}
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-2xl flex-shrink-0">{group.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-xs line-clamp-2">
                          {group.name}
                        </p>
                        {group.createdBy === user?.id && (
                          <span className="inline-block text-xs bg-brand/20 text-brand px-1.5 py-0.5 rounded-full mt-0.5">
                            Seu Grupo
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                      {group.description}
                    </p>

                    {/* Info Footer */}
                    <div className="space-y-2 mb-3 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          👥 {group.participants}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          📍 {group.city}
                        </span>
                      </div>
                    </div>

                    {/* Action Button */}
                    <Button
                      size="sm"
                      className="w-full rounded-full text-xs h-8"
                      onClick={() => {
                        if (group.createdBy === user?.id) {
                          // View group check-ins for user's own groups
                          toast({
                            title: "Check-ins do Grupo",
                            description: `Grupo: ${group.name} - ${group.participants} participantes`,
                          });
                        } else if (group.isOfficial) {
                          // Join official groups
                          toast({
                            title: "Participando!",
                            description: `Você agora faz parte de "${group.name}"`,
                          });
                        }
                      }}
                    >
                      {group.createdBy === user?.id ? "Ver Check-ins" : "Participar"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
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
        onOpenChange={setIsCreateGroupModalOpen}
      >
        <DrawerContent className="max-h-[90dvh] flex flex-col">
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

                {/* Location */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Localidade *</label>
                  <Input
                    value={groupConfig.location}
                    onChange={(e) =>
                      setGroupConfig({ ...groupConfig, location: e.target.value })
                    }
                    placeholder="Ex: São Paulo, Rio de Janeiro..."
                  />
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

                <Button
                  onClick={() => {
                    if (groupConfig.name && groupConfig.location && groupConfig.goal) {
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
                  <label className="text-sm font-medium">
                    Convidar Participantes ({selectedInvitees.size})
                  </label>
                  <div className="space-y-2 max-h-96">
                    {followers.length > 0 ? (
                      followers.map((follower) => (
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
                            <div className="text-xs text-muted-foreground truncate">
                              @{follower.id}
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
                    onClick={() => {
                      const newGroup = {
                        id: Math.random().toString(36).substr(2, 9),
                        icon: "⚔️",
                        name: groupConfig.name,
                        description: groupConfig.goal,
                        participants: selectedInvitees.size + 1,
                        city: groupConfig.location,
                        createdBy: user?.id,
                        members: Array.from(selectedInvitees),
                        checkIns: [],
                      };
                      setUserGroups([...userGroups, newGroup]);
                      setIsCreateGroupModalOpen(false);
                      toast({
                        title: "Grupo criado!",
                        description: `"${groupConfig.name}" foi criado com sucesso.`,
                      });
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
