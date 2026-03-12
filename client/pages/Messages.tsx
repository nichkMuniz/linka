import * as React from "react";
import {
  getConversationsDb,
  getConversationMessagesDb,
  sendMessageDb,
  markMessagesAsReadDb,
  getFollowingDb,
  type Conversation,
  type MessageWithUser,
  type SearchUser,
} from "@/lib/ritmofit-db";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { formatTimeAgo } from "@/lib/utils";
import { ArrowLeft, Send, Check, CheckCheck } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LoadingSpinner } from "@/components/animated-loading";

type ViewMode = "conversations" | "conversation";

type MessageReaction = {
  emoji: string;
  count: number;
  userReacted: boolean;
};

const EMOJI_OPTIONS = ["❤️", "😂", "😮", "😢", "👍", "🔥"];

export default function Messages() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

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
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Emoji reaction state: messageId → emoji → reaction info
  const [reactions, setReactions] = React.useState<
    Record<string, Record<string, MessageReaction>>
  >({});
  const [hoveredMessageId, setHoveredMessageId] = React.useState<string | null>(null);
  const hoverTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load conversations and following users
  React.useEffect(() => {
    const loadData = async () => {
      try {
        const [conversationsData, followingData] = await Promise.all([
          getConversationsDb(),
          getFollowingDb(),
        ]);
        setConversations(conversationsData);
        setFollowers(followingData);
      } catch (err: any) {
        console.error("Error loading messages:", err);
        toast({
          title: "Erro ao carregar mensagens",
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

  const handleReactToMessage = React.useCallback(
    (messageId: string, emoji: string) => {
      setReactions((prev) => {
        const messageReactions = { ...(prev[messageId] || {}) };
        const existing = messageReactions[emoji];
        if (existing?.userReacted) {
          // Remove reaction
          const newCount = existing.count - 1;
          if (newCount <= 0) {
            const updated = { ...messageReactions };
            delete updated[emoji];
            return { ...prev, [messageId]: updated };
          }
          return {
            ...prev,
            [messageId]: {
              ...messageReactions,
              [emoji]: { emoji, count: newCount, userReacted: false },
            },
          };
        } else {
          // Add reaction
          return {
            ...prev,
            [messageId]: {
              ...messageReactions,
              [emoji]: {
                emoji,
                count: (existing?.count || 0) + 1,
                userReacted: true,
              },
            },
          };
        }
      });
      setHoveredMessageId(null);
    },
    [],
  );

  const handleMessageHover = React.useCallback((messageId: string | null) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    if (messageId === null) {
      hoverTimeoutRef.current = setTimeout(() => {
        setHoveredMessageId(null);
      }, 300);
    } else {
      setHoveredMessageId(messageId);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <LoadingSpinner className="h-12 w-12" />
        <p className="text-sm text-muted-foreground">Carregando mensagens...</p>
      </div>
    );
  }

  if (viewMode === "conversation" && selectedConversation) {
    return (
      <div className="fixed top-0 left-0 right-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] bg-background flex flex-col z-50">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-border/60 bg-background px-4 py-3 flex items-center gap-3 pt-safe">
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
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-4">
            {messages.length > 0 ? (
              messages.map((message) => {
                const isOwn = message.id_user === user?.id;
                const messageReactions = reactions[message.id] || {};
                const reactionEntries = Object.values(messageReactions);
                const isHovered = hoveredMessageId === message.id;

                return (
                  <div
                    key={message.id}
                    className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`relative flex ${isOwn ? "flex-row-reverse" : "flex-row"} items-end gap-1`}
                      onMouseEnter={() => handleMessageHover(message.id)}
                      onMouseLeave={() => handleMessageHover(null)}
                    >
                      {/* Emoji Picker (appears on hover) */}
                      {isHovered && (
                        <div
                          className={`absolute bottom-full mb-1 ${isOwn ? "right-0" : "left-0"} flex gap-1 bg-background border border-border/60 rounded-full px-2 py-1 shadow-lg z-10`}
                          onMouseEnter={() => handleMessageHover(message.id)}
                          onMouseLeave={() => handleMessageHover(null)}
                        >
                          {EMOJI_OPTIONS.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => handleReactToMessage(message.id, emoji)}
                              className="text-base hover:scale-125 transition-transform leading-none p-0.5"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}

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

                    {/* Reaction display */}
                    {reactionEntries.length > 0 && (
                      <div
                        className={`flex gap-1 mt-1 flex-wrap ${isOwn ? "justify-end" : "justify-start"}`}
                      >
                        {reactionEntries.map((r) => (
                          <button
                            key={r.emoji}
                            onClick={() =>
                              handleReactToMessage(message.id, r.emoji)
                            }
                            className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full border transition-colors ${
                              r.userReacted
                                ? "bg-brand/10 border-brand/30 text-brand"
                                : "bg-muted/50 border-border/40"
                            }`}
                          >
                            <span>{r.emoji}</span>
                            {r.count > 1 && (
                              <span className="font-medium">{r.count}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
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
        </div>

        {/* Input */}
        <div className="flex-shrink-0 border-t border-border/60 bg-background px-4 py-3 flex gap-2 pb-safe">
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
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4">
        <h1 className="text-2xl font-bold tracking-tight">Mensagens</h1>
      </div>

      {/* Search Bar - Separated */}
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
    </div>
  );
}
