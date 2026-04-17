import * as React from "react";
import {
  getConversationsDb,
  getConversationMessagesDb,
  sendMessageDb,
  markMessagesAsReadDb,
  getFollowingDb,
  getMessageReactionsDb,
  addMessageReactionDb,
  removeMessageReactionDb,
  followUserDb,
  isFollowingDb,
  type Conversation,
  type MessageWithUser,
  type SearchUser,
} from "@/lib/ritmofit-db";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { formatTimeAgo } from "@/lib/utils";
import { ArrowLeft, Send, Check, CheckCheck, Plus } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LoadingSpinner } from "@/components/shared/animated-loading";

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
  const [activePickerMessageId, setActivePickerMessageId] = React.useState<string | null>(null);
  const [followedIds, setFollowedIds] = React.useState<Set<string>>(new Set());
  const [isFollowingChecked, setIsFollowingChecked] = React.useState(false);
  const [isFollowingLoading, setIsFollowingLoading] = React.useState(false);
  // ref for custom emoji input
  const customEmojiInputRef = React.useRef<HTMLInputElement>(null);

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
        setFollowedIds(new Set(followingData.map((f) => f.id)));
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

  // Check follow status directly from DB when a conversation is opened
  React.useEffect(() => {
    if (!selectedConversation || viewMode !== "conversation") return;
    const uid = selectedConversation.userId;
    setIsFollowingChecked(false);
    isFollowingDb(uid)
      .then((result) => {
        setFollowedIds((prev) => {
          const next = new Set(prev);
          if (result) next.add(uid);
          else next.delete(uid);
          return next;
        });
      })
      .catch(() => {
        // on error assume not following so button shows
        setFollowedIds((prev) => {
          const next = new Set(prev);
          next.delete(uid);
          return next;
        });
      })
      .finally(() => setIsFollowingChecked(true));
  }, [selectedConversation?.userId, viewMode]);

  // Load conversation messages when selected
  React.useEffect(() => {
    if (!selectedConversation || viewMode !== "conversation") return;

    const loadMessages = async () => {
      try {
        const data = await getConversationMessagesDb(selectedConversation.userId);
        setMessages(data);

        // Load reactions for these messages
        if (data.length > 0) {
          const messageIds = data.map((m) => m.id);
          const reactionsData = await getMessageReactionsDb(messageIds);

          const reactionsMap: Record<string, Record<string, MessageReaction>> = {};
          reactionsData.forEach((r) => {
            if (!reactionsMap[r.message_id]) reactionsMap[r.message_id] = {};
            const existing = reactionsMap[r.message_id][r.emoji];
            reactionsMap[r.message_id][r.emoji] = {
              emoji: r.emoji,
              count: (existing?.count || 0) + 1,
              userReacted: existing?.userReacted || r.user_id === user?.id,
            };
          });
          setReactions(reactionsMap);
        }

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

  // Realtime subscription for messages in active conversation — append instead of full reload
  React.useEffect(() => {
    if (!selectedConversation || viewMode !== "conversation" || !supabase || !user) return;

    const channel = supabase
      .channel(`messages-${selectedConversation.userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        async (payload) => {
          const msg = payload.new as any;
          // Only react to messages in this conversation
          const isThisConversation =
            (msg.user_id === user.id && msg.following_id === selectedConversation.userId) ||
            (msg.user_id === selectedConversation.userId && msg.following_id === user.id);

          if (!isThisConversation) return;

          // Append the new message directly instead of re-fetching all messages
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
            // Avoid duplicates (optimistic update may have added it already)
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          // If the new message is from the other user, mark as read immediately
          if (msg.user_id === selectedConversation.userId) {
            markMessagesAsReadDb(selectedConversation.userId).catch(() => {});
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation, viewMode, user]);

  // Auto-scroll to bottom when messages change
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Close emoji picker when tapping outside
  React.useEffect(() => {
    if (!activePickerMessageId) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-emoji-picker]")) {
        setActivePickerMessageId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [activePickerMessageId]);

  const handleSendMessage = React.useCallback(async () => {
    if (!messageText.trim() || !selectedConversation) return;

    const textToSend = messageText;
    setMessageText("");
    setIsSending(true);

    try {
      await sendMessageDb(selectedConversation.userId, textToSend);
      // Realtime will update the message list automatically;
      // if for some reason it's slow, do an optimistic update here
      const updatedMessages = await getConversationMessagesDb(selectedConversation.userId);
      setMessages(updatedMessages);

      // Update last message in conversation list
      setConversations((prev) =>
        prev.map((conv) =>
          conv.userId === selectedConversation.userId
            ? {
              ...conv,
              lastMessage: textToSend,
              lastMessageTime: new Date().toISOString(),
            }
            : conv,
        ),
      );
    } catch (err: any) {
      console.error("Error sending message:", err);
      setMessageText(textToSend);
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
    setActivePickerMessageId(null);
  }, []);

  const handleReactToMessage = React.useCallback(
    async (messageId: string, emoji: string) => {
      if (!user) return;

      const prev = reactions[messageId]?.[emoji];
      const isRemoving = prev?.userReacted;

      // Optimistic update
      setReactions((prevReactions) => {
        const messageReactions = { ...(prevReactions[messageId] || {}) };
        if (isRemoving) {
          const newCount = (messageReactions[emoji]?.count || 1) - 1;
          if (newCount <= 0) {
            const updated = { ...messageReactions };
            delete updated[emoji];
            return { ...prevReactions, [messageId]: updated };
          }
          return {
            ...prevReactions,
            [messageId]: {
              ...messageReactions,
              [emoji]: { emoji, count: newCount, userReacted: false },
            },
          };
        } else {
          return {
            ...prevReactions,
            [messageId]: {
              ...messageReactions,
              [emoji]: {
                emoji,
                count: (messageReactions[emoji]?.count || 0) + 1,
                userReacted: true,
              },
            },
          };
        }
      });

      setActivePickerMessageId(null);

      // Persist to DB
      if (isRemoving) {
        await removeMessageReactionDb(messageId, emoji);
      } else {
        await addMessageReactionDb(messageId, emoji);
      }
    },
    [reactions, user],
  );

  const handleFollowConversationUser = React.useCallback(async () => {
    if (!selectedConversation) return;
    setIsFollowingLoading(true);
    try {
      await followUserDb(selectedConversation.userId);
      setFollowedIds((prev) => new Set([...prev, selectedConversation.userId]));
      toast({ title: `Você está seguindo ${selectedConversation.userNickname}` });
    } catch (err: any) {
      toast({ title: "Erro ao seguir", description: err?.message, variant: "destructive" });
    } finally {
      setIsFollowingLoading(false);
    }
  }, [selectedConversation]);

  const handleCustomEmojiInput = React.useCallback(
    (messageId: string, value: string) => {
      // Extract the first emoji-like character from the input
      const emojiRegex = /\p{Emoji}/u;
      const match = value.match(emojiRegex);
      if (match) {
        handleReactToMessage(messageId, match[0]);
      }
    },
    [handleReactToMessage],
  );

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
      <div
        className="fixed top-0 right-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] bg-background flex flex-col z-50 left-0"
        style={{ left: "var(--sidebar-width, 0px)" }}
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b border-border/60 bg-background px-4 py-3 flex items-center gap-3" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
          <button
            onClick={handleBackToConversations}
            className="text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 flex items-center gap-3 min-w-0">
            {selectedConversation.userPhoto ? (
              <img
                src={selectedConversation.userPhoto}
                alt={selectedConversation.userNickname}
                className="h-10 w-10 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-medium text-muted-foreground">
                  {selectedConversation.userNickname.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {selectedConversation.userNickname}
              </p>
            </div>
          </div>
          {isFollowingChecked && !followedIds.has(selectedConversation.userId) && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full flex-shrink-0 text-xs h-8 px-3"
              onClick={handleFollowConversationUser}
              disabled={isFollowingLoading}
            >
              {isFollowingLoading ? "..." : "Seguir"}
            </Button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-4">
            {messages.length > 0 ? (
              messages.map((message) => {
                const isOwn = message.user_id === user?.id;
                const messageReactions = reactions[message.id] || {};
                const reactionEntries = Object.values(messageReactions);
                const isPickerOpen = activePickerMessageId === message.id;

                return (
                  <div
                    key={message.id}
                    className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`relative flex ${isOwn ? "flex-row-reverse" : "flex-row"} items-end gap-1`}
                    >
                      {/* Emoji Picker — opens on long press or tap on reaction area */}
                      {isPickerOpen && (
                        <div
                          data-emoji-picker
                          className={`absolute bottom-full mb-2 ${isOwn ? "right-0" : "left-0"} flex items-center gap-1 bg-card border border-border/60 rounded-full px-2 py-1.5 shadow-xl z-20`}
                        >
                          {EMOJI_OPTIONS.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => handleReactToMessage(message.id, emoji)}
                              className="text-lg hover:scale-125 active:scale-110 transition-transform leading-none p-0.5 min-w-[2rem] min-h-[2rem] flex items-center justify-center"
                            >
                              {emoji}
                            </button>
                          ))}
                          {/* + button to open native emoji keyboard */}
                          <div className="relative">
                            <button
                              className="text-muted-foreground hover:text-foreground min-w-[2rem] min-h-[2rem] flex items-center justify-center rounded-full hover:bg-muted/50"
                              onClick={() => customEmojiInputRef.current?.focus()}
                              aria-label="Mais emojis"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                            <input
                              ref={customEmojiInputRef}
                              type="text"
                              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                              inputMode="text"
                              onChange={(e) => {
                                handleCustomEmojiInput(message.id, e.target.value);
                                e.target.value = "";
                              }}
                              aria-label="Escolher emoji"
                            />
                          </div>
                        </div>
                      )}

                      <div
                        className={`max-w-xs px-4 py-2 rounded-2xl space-y-1 break-words cursor-pointer select-none ${isOwn
                          ? "bg-brand text-white rounded-br-sm"
                          : "bg-muted rounded-bl-sm"
                          }`}
                        onClick={() =>
                          setActivePickerMessageId(
                            isPickerOpen ? null : message.id,
                          )
                        }
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setActivePickerMessageId(
                            isPickerOpen ? null : message.id,
                          );
                        }}
                      >
                        <p className="text-sm">{message.text}</p>
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
                    </div>

                    {/* Reaction display */}
                    {reactionEntries.length > 0 && (
                      <div
                        className={`flex gap-1 mt-1 flex-wrap ${isOwn ? "justify-end" : "justify-start"}`}
                      >
                        {reactionEntries.map((r) => (
                          <button
                            key={r.emoji}
                            onClick={() => handleReactToMessage(message.id, r.emoji)}
                            className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full border transition-colors ${r.userReacted
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
        <div className="flex-shrink-0 border-t border-border/60 bg-background px-4 py-3 flex gap-2">
          <Input
            placeholder="Envie uma mensagem..."
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            className="rounded-full"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!messageText.trim()}
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
                      <div className="relative flex-shrink-0">
                        <img
                          src={conversation.userPhoto}
                          alt={conversation.userNickname}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                        {conversation.unreadCount > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-brand border-2 border-background" />
                        )}
                      </div>
                    ) : (
                      <div className="relative flex-shrink-0">
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-sm font-medium text-muted-foreground">
                            {conversation.userNickname.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        {conversation.unreadCount > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-brand border-2 border-background" />
                        )}
                      </div>
                    )}

                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`text-sm truncate ${conversation.unreadCount > 0
                            ? "font-semibold text-foreground"
                            : "font-medium"
                            }`}
                        >
                          {conversation.userNickname}
                        </p>
                        <p className="text-xs text-muted-foreground shrink-0">
                          {formatTimeAgo(conversation.lastMessageTime)}
                        </p>
                      </div>
                      <p
                        className={`text-sm truncate ${conversation.unreadCount > 0
                          ? "font-medium text-foreground"
                          : "text-muted-foreground"
                          }`}
                      >
                        {conversation.lastMessage}
                      </p>
                    </div>

                    {conversation.unreadCount > 0 && (
                      <div className="flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-brand text-white text-xs font-semibold shrink-0">
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
