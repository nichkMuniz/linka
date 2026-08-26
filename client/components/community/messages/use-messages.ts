import * as React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

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
  getUserProfileDb,
  setMessageEmojiDb,
  type Conversation,
  type MessageWithUser,
} from "@/lib/ritmofit-db";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/lib/language-context";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { subscribeKeyboardHeight } from "@/lib/keyboard";
import { setActiveConversationUserId } from "@/lib/active-conversation";
import {
  buildReplyPrefix,
  sameMessageList,
  type ViewMode,
} from "@/components/community/community-helpers";

/** Emojis da reação rápida no toque longo da bolha. */
export const QUICK_EMOJIS = ["❤️", "😂", "😮", "😢", "😡", "👍"];

interface UseMessagesOptions {
  /** Lista de conversas — carregada pela tela, junto de followers e ranking. */
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  /** `true` enquanto a carga inicial da Comunidade não terminou. */
  loading: boolean;
  /** `true` quando a aba Mensagens é a ativa. */
  isActive: boolean;
  /** Pedido para trocar a aba ativa para Mensagens (deep link `?user=`). */
  onRequestActive: () => void;
}

/**
 * Estado e comportamento da aba **Mensagens** — lista de conversas, conversa
 * aberta, envio de texto/foto/áudio, realtime, reações e exclusão.
 *
 * A tela (`Community.tsx`) continua dona de `conversations` porque a carga
 * inicial é um `Promise.all` compartilhado com followers e ranking, e é ela que
 * decide quando esconder o skeleton. Todo o resto vive aqui.
 */
export function useMessages({
  conversations,
  setConversations,
  loading,
  isActive,
  onRequestActive,
}: UseMessagesOptions) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [viewMode, setViewMode] = React.useState<ViewMode>("conversations");
  const [selectedConversation, setSelectedConversation] =
    React.useState<Conversation | null>(null);
  const [messages, setMessages] = React.useState<MessageWithUser[]>([]);
  const [messageText, setMessageText] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const [isSendingPhoto, setIsSendingPhoto] = React.useState(false);
  const [imageViewerUrl, setImageViewerUrl] = React.useState<string | null>(null);
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingSeconds, setRecordingSeconds] = React.useState(0);

  const [longPressedMessage, setLongPressedMessage] =
    React.useState<MessageWithUser | null>(null);
  const [replyingTo, setReplyingTo] = React.useState<MessageWithUser | null>(null);
  const [deleteMessageConfirm, setDeleteMessageConfirm] = React.useState<{
    message: MessageWithUser;
    permanent: boolean;
  } | null>(null);

  const [isNewConversationDrawerOpen, setIsNewConversationDrawerOpen] =
    React.useState(false);
  const [deleteConvConfirmOpen, setDeleteConvConfirmOpen] = React.useState(false);
  const [convToDelete, setConvToDelete] = React.useState<Conversation | null>(null);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const messageInputRef = React.useRef<HTMLInputElement>(null);
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const isOpeningConversationRef = React.useRef(true);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const audioMimeTypeRef = React.useRef<string>("audio/webm");
  const recordingTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const conversationChannelRef = React.useRef<
    ReturnType<NonNullable<typeof supabase>["channel"]> | null
  >(null);

  /** A conversa em tela cheia está aberta? A tela usa isto para trocar o render. */
  const isConversationOpen =
    isActive && viewMode === "conversation" && selectedConversation !== null;

  // ── Deep link `?user=` — abre (ou cria) a conversa com aquele usuário ──────
  const convRestoredRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const userIdParam = searchParams.get("user");
    if (!userIdParam || convRestoredRef.current === userIdParam) return;
    onRequestActive();
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
      getUserProfileDb(userIdParam)
        .then((profile) => {
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
        })
        .catch((err: any) => {
          console.error("Error loading user profile for conversation:", err);
          toast({
            title: "Erro ao abrir conversa",
            description: err?.message || "Tente novamente.",
            variant: "destructive",
          });
        });
    }
  }, [searchParams, conversations, loading, onRequestActive]);

  // Hide bottom nav when inside a private conversation
  React.useEffect(() => {
    const isConversation = isActive && viewMode === "conversation";
    document.body.dataset.hideNav = isConversation ? "true" : "false";
    return () => {
      document.body.dataset.hideNav = "false";
    };
  }, [viewMode, isActive]);

  // Marca qual conversa está aberta para o handler de notificações em primeiro
  // plano (AppLayout) suprimir o banner da mensagem que o usuário já está vendo
  // chegar — nesse caso o celular só vibra. Fora da conversa, limpa (null).
  React.useEffect(() => {
    const inConversation = isActive && viewMode === "conversation" && selectedConversation;
    setActiveConversationUserId(inConversation ? selectedConversation.userId : null);
    return () => setActiveConversationUserId(null);
  }, [viewMode, isActive, selectedConversation?.userId]);

  // ── Carga das mensagens da conversa selecionada ───────────────────────────
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
            conv.userId === targetUserId ? { ...conv, unreadCount: 0 } : conv,
          ),
        );
      } catch (err: any) {
        console.error("Error loading messages:", err);
        toast({
          title: "Erro ao carregar mensagens",
          description: err?.message || "Tente novamente.",
          variant: "destructive",
        });
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
  }, [selectedConversation?.userId, viewMode, setConversations]);

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
        setTimeout(
          () => messagesEndRef.current?.scrollIntoView({ behavior: "auto" }),
          delay,
        ),
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
    const clear = () => {
      timers.forEach(clearTimeout);
      timers = [];
    };
    const unsubscribe = subscribeKeyboardHeight(() => {
      clear();
      timers = [0, 120, 280].map((delay) =>
        setTimeout(
          () => messagesEndRef.current?.scrollIntoView({ behavior: "auto" }),
          delay,
        ),
      );
    });
    return () => {
      clear();
      unsubscribe();
    };
  }, [viewMode, selectedConversation?.userId]);

  // Mantém a semente em dia com o que está na tela (enviadas, recebidas via
  // realtime, apagadas) — assim a próxima abertura pinta o estado correto.
  React.useEffect(() => {
    if (viewMode !== "conversation" || !selectedConversation || messages.length === 0)
      return;
    cacheConversationMessages(selectedConversation.userId, messages);
  }, [messages, selectedConversation?.userId, viewMode]);

  // ── Envio ─────────────────────────────────────────────────────────────────
  const handleSendMessage = React.useCallback(async () => {
    if (!messageText.trim() || !selectedConversation) return;

    const fullText = buildReplyPrefix(replyingTo) + messageText;

    setIsSending(true);
    try {
      const newMessage = await sendMessageDb(selectedConversation.userId, fullText);
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
  }, [messageText, selectedConversation, replyingTo, setConversations]);

  const handlePhotoSend = React.useCallback(
    async (file: File) => {
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
        toast({
          title: "Erro ao enviar foto",
          description: err?.message || "Tente novamente.",
          variant: "destructive",
        });
      } finally {
        setIsSendingPhoto(false);
      }
    },
    [selectedConversation, replyingTo],
  );

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
      const mimeType =
        preferredTypes.find((mt) => MediaRecorder.isTypeSupported(mt)) || "";
      audioMimeTypeRef.current = mimeType || "audio/mp4";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(
        () => setRecordingSeconds((s) => s + 1),
        1000,
      );
    } catch {
      toast({
        title: "Sem acesso ao microfone",
        description: "Permita o uso do microfone nas configurações.",
        variant: "destructive",
      });
    }
  }, [selectedConversation, isRecording]);

  const stopRecordingAndSend = React.useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || !selectedConversation) return;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);

    recorder.stop();
    recorder.stream.getTracks().forEach((tr) => tr.stop());

    // Wait for final data
    await new Promise<void>((res) => {
      recorder.onstop = () => res();
    });

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
      toast({
        title: "Erro ao enviar áudio",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSendingPhoto(false);
    }
  }, [selectedConversation, replyingTo]);

  const cancelRecording = React.useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recorder.stop();
    recorder.stream.getTracks().forEach((tr) => tr.stop());
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
  const catchUpMessages = React.useCallback(
    async (targetUserId: string) => {
      try {
        const data = await getConversationMessagesDb(targetUserId);
        setSelectedConversation((current) => {
          if (current?.userId !== targetUserId) return current;
          setMessages((prev) => (sameMessageList(prev, data) ? prev : data));
          return current;
        });
        await markMessagesAsReadDb(targetUserId);
        setConversations((prev) =>
          prev.map((conv) =>
            conv.userId === targetUserId ? { ...conv, unreadCount: 0 } : conv,
          ),
        );
      } catch (err) {
        console.error("Error catching up messages:", err);
      }
    },
    [setConversations],
  );

  // ── Realtime: acrescenta a mensagem nova em vez de recarregar tudo ────────
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
            (msg.user_id === selectedConversation.userId &&
              (msg.id_receiver === user.id || msg.following_id === user.id)) ||
            (msg.user_id === user.id &&
              (msg.id_receiver === selectedConversation.userId ||
                msg.following_id === selectedConversation.userId));
          if (!isRelevant) return;

          const newMsg: MessageWithUser = {
            id: msg.id,
            user_id: msg.user_id,
            following_id: msg.following_id ?? msg.id_receiver,
            text: msg.text ?? "",
            read: msg.read ?? 0,
            created_at: msg.created_at ?? new Date().toISOString(),
            emoji: msg.emoji ?? null,
            senderNickname:
              msg.user_id === user.id
                ? "Você"
                : selectedConversation.userNickname || "Usuário",
            senderPhoto:
              msg.user_id === user.id ? null : selectedConversation.userPhoto || null,
            recipientNickname:
              msg.user_id === user.id
                ? selectedConversation.userNickname || "Usuário"
                : "Você",
            recipientPhoto:
              msg.user_id === user.id ? selectedConversation.userPhoto || null : null,
          };

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          // Update last message preview in conversations list
          setConversations((prev) =>
            prev.map((conv) =>
              conv.userId === selectedConversation.userId
                ? {
                    ...conv,
                    lastMessage: msg.text ?? "",
                    lastMessageTime: msg.created_at ?? new Date().toISOString(),
                  }
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
  }, [selectedConversation?.userId, user?.id, catchUpMessages, setConversations]);

  // ── Navegação entre lista e conversa ──────────────────────────────────────
  const handleOpenConversation = React.useCallback((conversation: Conversation) => {
    setSelectedConversation(conversation);
    setViewMode("conversation");
  }, []);

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
    getConversationsDb()
      .then(setConversations)
      .catch((err: any) => {
        console.error("Error refreshing conversations:", err);
        toast({
          title: "Erro ao atualizar conversas",
          description: err?.message || "Tente novamente.",
          variant: "destructive",
        });
      });
  }, [searchParams, navigate, setConversations]);

  // ── Toque longo na bolha: reagir, responder, apagar ───────────────────────
  const handleMessageLongPress = React.useCallback((message: MessageWithUser) => {
    setLongPressedMessage(message);
  }, []);

  const handleReactToMessage = React.useCallback(
    async (emoji: string) => {
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
    },
    [longPressedMessage],
  );

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
      toast({
        title: t("community_msg_delete_error"),
        description: err?.message || t("retry"),
        variant: "destructive",
      });
    }
  }, [deleteMessageConfirm, t]);

  /** Exclusão da conversa inteira — soft-delete, só para quem pediu. */
  const handleConfirmDeleteConversation = React.useCallback(async () => {
    if (!convToDelete) return;
    setDeleteConvConfirmOpen(false);
    try {
      await deleteConversationForMeDb(convToDelete.userId);
      setConversations((prev) => prev.filter((c) => c.userId !== convToDelete.userId));
      toast({ title: "Conversa excluída!" });
    } catch (err: any) {
      toast({
        title: "Erro ao excluir conversa",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setConvToDelete(null);
    }
  }, [convToDelete, setConversations]);

  /** Abre uma conversa que ainda não existe, a partir de um usuário sugerido. */
  const openConversationWithUser = React.useCallback((conversation: Conversation) => {
    setSelectedConversation(conversation);
    setViewMode("conversation");
  }, []);

  return {
    // estado da conversa
    isConversationOpen,
    selectedConversation,
    messages,
    messageText,
    setMessageText,
    isSending,
    isSendingPhoto,
    imageViewerUrl,
    setImageViewerUrl,
    isRecording,
    recordingSeconds,
    replyingTo,
    setReplyingTo,
    longPressedMessage,
    setLongPressedMessage,
    deleteMessageConfirm,
    setDeleteMessageConfirm,

    // refs
    messagesEndRef,
    messageInputRef,
    photoInputRef,

    // ações da conversa
    handleSendMessage,
    handlePhotoSend,
    startRecording,
    stopRecordingAndSend,
    cancelRecording,
    handleBackToConversations,
    handleMessageLongPress,
    handleReactToMessage,
    handleReplyToMessage,
    handleConfirmDeleteMessage,

    // lista de conversas
    handleOpenConversation,
    openConversationWithUser,
    isNewConversationDrawerOpen,
    setIsNewConversationDrawerOpen,
    deleteConvConfirmOpen,
    setDeleteConvConfirmOpen,
    convToDelete,
    setConvToDelete,
    handleConfirmDeleteConversation,
  };
}

export type MessagesController = ReturnType<typeof useMessages>;
