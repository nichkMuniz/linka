import { useState } from "react";
import * as ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCheck,
  Image,
  Mic,
  MoreVertical,
  Send,
  Trash2,
  X,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/lib/language-context";
import { UserAvatar } from "@/components/shared/user-avatar";
import { UserInsignias } from "@/components/profile/user-insignias";
import { SwipeableMessageBubble } from "@/components/community/swipeable-message-bubble";
import { SharedContentMessage } from "@/components/community/shared-content-message";
import { FlowReplyMessage } from "@/components/community/flow-reply-message";
import { ChatImageMessage, ChatAudioMessage } from "@/components/community/chat-media";
import { parseFlowReply } from "@/lib/flow-reply";
import { specialMessageLabel } from "@/components/community/community-helpers";
import { UserSafetyDrawer } from "@/components/shared/user-safety-drawer";

import { QUICK_EMOJIS, type MessagesController } from "./use-messages";

/**
 * Conversa privada em tela cheia. Renderizada num **portal** para o `body`, fora
 * do fluxo da tela de Comunidade.
 *
 * O container ocupa só a área ACIMA do teclado do iOS: o tracker global
 * (`client/lib/keyboard.ts`, Keyboard resize:'none') publica `--keyboard-height`
 * no `<html>`, e subir o `bottom` por essa altura encolhe a conversa a partir de
 * baixo — a lista rola menos e a barra de input fica logo acima do teclado, em
 * vez de ficar escondida atrás dele. Um portal fixo não é drawer/dialog, então
 * não herda o lift automático de `drawer.tsx`/`dialog.tsx` — daí o tratamento aqui.
 */
export function ConversationView({ ctl }: { ctl: MessagesController }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Antes do early return: hook não pode ficar atrás de condicional.
  const [safetyOpen, setSafetyOpen] = useState(false);

  const conversation = ctl.selectedConversation;
  if (!conversation) return null;

  return ReactDOM.createPortal(
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
          onClick={ctl.handleBackToConversations}
          className="text-muted-foreground hover:text-foreground flex-shrink-0"
          aria-label={t("back")}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button
          onClick={() => navigate(`/usuario/${conversation.userId}`)}
          className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity text-left"
        >
          <UserAvatar
            photo={conversation.userPhoto}
            nickname={conversation.userNickname}
            size="md"
            className="flex-shrink-0"
          />
          <p className="text-sm font-medium truncate">{conversation.userNickname}</p>
        </button>
        <UserInsignias userId={conversation.userId} />

        {/* Denunciar / bloquear na PRÓPRIA conversa. A Guideline 1.2 pede a ação
            onde o abuso acontece, e a DM é aberta a qualquer usuário — não só a
            quem você segue. Antes disto, sair da conversa e abrir o perfil era o
            único caminho. */}
        <button
          onClick={() => setSafetyOpen(true)}
          className="ml-auto text-muted-foreground hover:text-foreground flex-shrink-0"
          aria-label={t("user_safety_title")}
        >
          <MoreVertical className="h-5 w-5" />
        </button>
      </div>

      <UserSafetyDrawer
        open={safetyOpen}
        onOpenChange={setSafetyOpen}
        userId={conversation.userId}
        userName={conversation.userNickname}
        onBlocked={ctl.handleBackToConversations}
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-4 px-4 py-4">
        {/* Profile card — always shown at top of conversation */}
        <div className="flex flex-col items-center gap-3 py-6 mb-2">
          <UserAvatar
            photo={conversation.userPhoto}
            nickname={conversation.userNickname}
            className="w-20 h-20 ring-2 ring-border"
          />
          <p className="font-semibold text-base">{conversation.userNickname}</p>
          {conversation.userBio && (
            <p className="text-sm text-muted-foreground text-center max-w-xs px-4">
              {conversation.userBio}
            </p>
          )}
          <button
            onClick={() => navigate(`/usuario/${conversation.userId}`)}
            className="px-5 py-2 rounded-full text-sm font-medium text-white transition-colors hover:bg-white/[.1]"
            style={{
              background: "rgba(255,255,255,.06)",
              border: "1px solid rgba(255,255,255,.12)",
            }}
          >
            {t("community_view_profile")}
          </button>
        </div>

        {ctl.messages.length > 0 ? (
          ctl.messages.map((message) => {
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
                  onReply={() => ctl.handleReplyToMessage(message)}
                  onLongPress={() => ctl.handleMessageLongPress(message)}
                >
                  <div
                    onContextMenu={(e) => {
                      e.preventDefault();
                      ctl.handleMessageLongPress(message);
                    }}
                    className={`max-w-xs px-4 py-2.5 space-y-1 break-words select-none text-white ${isOwn ? "rounded-[20px] rounded-br-md" : "rounded-[20px] rounded-bl-md"}`}
                    style={
                      isOwn
                        ? { background: "linear-gradient(135deg,#5b8cff,#7b3ff2)" }
                        : {
                            background: "rgba(255,255,255,.08)",
                            border: "1px solid rgba(255,255,255,.08)",
                          }
                    }
                  >
                    {replyQuote && (
                      <div
                        className={`text-xs px-2 py-1 rounded mb-1 border-l-2 ${isOwn ? "bg-white/10 border-white/50 text-white/80" : "bg-white/10 border-white/40 text-white/70"}`}
                      >
                        <p className="truncate">
                          {specialMessageLabel(replyQuote, t) ?? replyQuote}
                        </p>
                      </div>
                    )}
                    {flowReply ? (
                      <FlowReplyMessage
                        flowId={flowReply.flowId}
                        text={flowReply.text}
                        isOwn={isOwn}
                      />
                    ) : mainText.startsWith("[post]:") ? (
                      <SharedContentMessage
                        kind="post"
                        contentId={mainText.replace("[post]:", "").trim()}
                      />
                    ) : mainText.startsWith("[shot]:") ? (
                      <SharedContentMessage
                        kind="shot"
                        contentId={mainText.replace("[shot]:", "").trim()}
                      />
                    ) : mainText.startsWith("[image]:") ? (
                      <ChatImageMessage
                        mediaRef={mainText.slice("[image]:".length)}
                        onOpen={ctl.setImageViewerUrl}
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
                      <p className={`text-xs ${isOwn ? "text-white/70" : "text-white/50"}`}>
                        {new Date(message.created_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
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
        <div ref={ctl.messagesEndRef} />
      </div>

      {/* Reply banner */}
      {ctl.replyingTo && (
        <div
          className="flex-shrink-0 px-4 py-2 flex items-center gap-2"
          style={{
            background: "rgba(255,255,255,.05)",
            borderTop: "1px solid rgba(255,255,255,.08)",
          }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/50 mb-0.5">{t("community_replying")}</p>
            <p className="text-xs truncate text-white/80">
              {specialMessageLabel(ctl.replyingTo.text.replace(/^↩ .+?\n\n/, ""), t) ??
                ctl.replyingTo.text.replace(/^↩ .+?\n\n/, "")}
            </p>
          </div>
          <button
            onClick={() => ctl.setReplyingTo(null)}
            className="text-white/50 hover:text-white flex-shrink-0"
            aria-label={t("cancel")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Input — estilo Instagram */}
      {ctl.isRecording ? (
        /* ── Modo gravação ── */
        <div
          className="flex-shrink-0 px-3.5 pt-3 flex items-center gap-2"
          style={{
            background: "linear-gradient(rgba(255,255,255,.08),rgba(255,255,255,.025))",
            backdropFilter: "blur(30px) saturate(180%)",
            WebkitBackdropFilter: "blur(30px) saturate(180%)",
            borderTop: "1px solid rgba(255,255,255,.1)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.12)",
            paddingBottom:
              "max(0.85rem, calc(env(safe-area-inset-bottom) - var(--keyboard-height, 0px)))",
          }}
        >
          {/* Cancelar */}
          <button
            onClick={ctl.cancelRecording}
            className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-white/70 hover:text-destructive hover:bg-white/[.1] active:scale-95 transition-all"
            style={{
              background: "rgba(255,255,255,.05)",
              border: "1px solid rgba(255,255,255,.1)",
            }}
            title={t("community_recording_cancel")}
            aria-label={t("community_recording_cancel")}
          >
            <X className="h-[21px] w-[21px]" strokeWidth={1.8} />
          </button>
          {/* Indicador de gravação */}
          <div
            className="flex-1 flex items-center gap-2.5 rounded-[26px] px-5"
            style={{
              minHeight: "52px",
              background: "rgba(255,255,255,.09)",
              border: "1px solid rgba(255,255,255,.13)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.08)",
            }}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            <span className="text-[15px] text-white/70 flex-1">
              {t("community_recording")}{" "}
              {Math.floor(ctl.recordingSeconds / 60).toString().padStart(2, "0")}:
              {(ctl.recordingSeconds % 60).toString().padStart(2, "0")}
            </span>
          </div>
          {/* Enviar */}
          <button
            onClick={ctl.stopRecordingAndSend}
            className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white hover:opacity-90 active:scale-95 transition-all"
            style={{
              background: "linear-gradient(135deg,#5b8cff,#9d6bff)",
              boxShadow:
                "0 8px 22px -6px rgba(123,63,242,.6), inset 0 1px 0 rgba(255,255,255,.3)",
            }}
            title={t("community_send_audio")}
            aria-label={t("community_send_audio")}
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
            paddingBottom:
              "max(0.85rem, calc(env(safe-area-inset-bottom) - var(--keyboard-height, 0px)))",
          }}
        >
          {/* Câmera */}
          <button
            className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/[.1] active:scale-95 transition-all"
            style={{
              background: "rgba(255,255,255,.05)",
              border: "1px solid rgba(255,255,255,.1)",
            }}
            onClick={() => ctl.photoInputRef.current?.click()}
            disabled={ctl.isSendingPhoto}
            title={t("community_send_camera_photo")}
            aria-label={t("community_send_camera_photo")}
          >
            {ctl.isSendingPhoto ? (
              <div className="h-5 w-5 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Camera className="h-[21px] w-[21px]" strokeWidth={1.8} />
            )}
          </button>

          {/* Input de arquivo oculto */}
          <input
            ref={ctl.photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) ctl.handlePhotoSend(file);
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
              ref={ctl.messageInputRef}
              placeholder={t("community_type_message")}
              value={ctl.messageText}
              onChange={(e) => ctl.setMessageText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ctl.handleSendMessage();
                }
              }}
              className="border-0 bg-transparent p-0 h-auto text-[15px] text-white placeholder:text-white/45 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 flex-1"
            />
          </div>

          {/* Ações à direita: quando sem texto → galeria + mic; quando com texto → enviar */}
          {ctl.messageText.trim() ? (
            <button
              onClick={ctl.handleSendMessage}
              disabled={ctl.isSending}
              className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white hover:opacity-90 active:scale-95 transition-all"
              style={{
                background: "linear-gradient(135deg,#5b8cff,#9d6bff)",
                boxShadow:
                  "0 8px 22px -6px rgba(123,63,242,.6), inset 0 1px 0 rgba(255,255,255,.3)",
              }}
              title={t("community_send_message")}
              aria-label={t("community_send_message")}
            >
              <Send className="h-5 w-5" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Galeria */}
              <button
                className="w-11 h-11 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/[.1] active:scale-95 transition-all"
                style={{
                  background: "rgba(255,255,255,.05)",
                  border: "1px solid rgba(255,255,255,.1)",
                }}
                title={t("community_send_from_gallery")}
                aria-label={t("community_send_from_gallery")}
                onClick={() => {
                  if (ctl.photoInputRef.current) {
                    ctl.photoInputRef.current.removeAttribute("capture");
                    ctl.photoInputRef.current.click();
                    setTimeout(
                      () =>
                        ctl.photoInputRef.current?.setAttribute("capture", "environment"),
                      500,
                    );
                  }
                }}
              >
                <Image className="h-[21px] w-[21px]" strokeWidth={1.8} />
              </button>
              {/* Microfone — iniciar gravação */}
              <button
                className="w-11 h-11 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/[.1] active:scale-95 transition-all"
                style={{
                  background: "rgba(255,255,255,.05)",
                  border: "1px solid rgba(255,255,255,.1)",
                }}
                title={t("community_record_audio")}
                aria-label={t("community_record_audio")}
                onMouseDown={ctl.startRecording}
                onTouchStart={() => {
                  ctl.startRecording();
                }}
              >
                <Mic className="h-[21px] w-[21px]" strokeWidth={1.8} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Long-press overlay */}
      {ctl.longPressedMessage &&
        (() => {
          const pressed = ctl.longPressedMessage;
          const isOwnMsg = pressed.user_id === user?.id;
          const msgAgeMs = Date.now() - new Date(pressed.created_at).getTime();
          // "Apagar para todos" (hard delete) só nas próprias mensagens e dentro
          // da janela de 10 min. "Apagar para mim" (soft-delete) vale sempre,
          // inclusive nas próprias — então uma mensagem enviada oferece as duas.
          const canDeletePermanently = isOwnMsg && msgAgeMs < 10 * 60 * 1000;
          const canDeleteForMe = true;
          return (
            <div
              className="fixed inset-0 z-[100] bg-black/40 flex items-end justify-center pb-12"
              onClick={() => ctl.setLongPressedMessage(null)}
            >
              <div
                className="bg-background rounded-2xl w-full max-w-sm mx-4 overflow-hidden shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Preview da mensagem */}
                <div className="px-4 py-3 border-b border-border/60">
                  <p className="text-xs text-muted-foreground mb-1">
                    {t("community_message_label")}
                  </p>
                  <p className="text-sm line-clamp-2">
                    {specialMessageLabel(pressed.text.replace(/^↩ .+?\n\n/, ""), t) ??
                      pressed.text.replace(/^↩ .+?\n\n/, "")}
                  </p>
                </div>

                {/* Emoji rápido */}
                <div className="flex items-center justify-around px-4 py-3 border-b border-border/60">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => ctl.handleReactToMessage(emoji)}
                      className="text-2xl active:scale-125 transition-transform"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                {/* Ações */}
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left"
                  onClick={() => ctl.handleReplyToMessage(pressed)}
                >
                  <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">{t("community_msg_reply")}</span>
                </button>
                {canDeleteForMe && (
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left border-t border-border/40 text-destructive"
                    onClick={() => {
                      ctl.setDeleteMessageConfirm({ message: pressed, permanent: false });
                      ctl.setLongPressedMessage(null);
                    }}
                  >
                    <Trash2 className="h-5 w-5" />
                    <span className="text-sm font-medium">
                      {t("community_msg_delete_for_me")}
                    </span>
                  </button>
                )}
                {canDeletePermanently && (
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left border-t border-border/40 text-destructive"
                    onClick={() => {
                      ctl.setDeleteMessageConfirm({ message: pressed, permanent: true });
                      ctl.setLongPressedMessage(null);
                    }}
                  >
                    <Trash2 className="h-5 w-5" />
                    <span className="text-sm font-medium">
                      {t("community_msg_delete_for_everyone")}
                    </span>
                  </button>
                )}
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left border-t border-border/40"
                  onClick={() => ctl.setLongPressedMessage(null)}
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">{t("cancel")}</span>
                </button>
              </div>
            </div>
          );
        })()}

      {/* Delete Message Confirm Dialog — inside portal so it appears above the conversation view */}
      {ctl.deleteMessageConfirm && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40"
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
                {ctl.deleteMessageConfirm.permanent
                  ? t("community_msg_delete_for_everyone")
                  : t("community_msg_delete_for_me")}
              </p>
              <p className="text-sm text-muted-foreground">
                {ctl.deleteMessageConfirm.permanent
                  ? t("community_msg_delete_for_everyone_desc")
                  : t("community_msg_delete_for_me_desc")}
              </p>
            </div>
            <div className="flex border-t border-border/60">
              <button
                className="flex-1 py-3.5 text-sm font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
                onClick={() => ctl.setDeleteMessageConfirm(null)}
              >
                {t("cancel")}
              </button>
              <div className="w-px bg-border/60" />
              <button
                className="flex-1 py-3.5 text-sm font-semibold text-destructive hover:bg-destructive/10 transition-colors"
                onClick={ctl.handleConfirmDeleteMessage}
              >
                {t("community_msg_delete_action")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer — fullscreen, sem expor a URL do storage */}
      {ctl.imageViewerUrl && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95"
          style={{
            paddingTop: "max(1rem, env(safe-area-inset-top))",
            paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
            paddingLeft: "max(1rem, env(safe-area-inset-left))",
            paddingRight: "max(1rem, env(safe-area-inset-right))",
          }}
          onClick={() => ctl.setImageViewerUrl(null)}
        >
          <button
            onClick={() => ctl.setImageViewerUrl(null)}
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
            src={ctl.imageViewerUrl}
            alt=""
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>,
    document.body,
  );
}
