import { useNavigate } from "react-router-dom";
import { ChevronRight, MessageCircle, PenSquare, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/language-context";
import { UserAvatar } from "@/components/shared/user-avatar";
import { SwipeableConversationRow } from "@/components/community/swipeable-conversation-row";
import { NewConversationDrawer } from "@/components/community/new-conversation-drawer";
import {
  conversationPreviewText,
  formatTimeAgo,
} from "@/components/community/community-helpers";
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
import type { Conversation, SearchUser } from "@/lib/ritmofit-db";

import type { MessagesController } from "./use-messages";

interface MessagesTabProps {
  ctl: MessagesController;
  conversations: Conversation[];
  followers: SearchUser[];
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
}

/**
 * Aba **Mensagens** — busca, lista de conversas (com swipe-to-delete) e, quando
 * não há conversa, sugestões de quem o usuário segue.
 *
 * A conversa em si vive em `ConversationView`; aqui só se escolhe qual abrir.
 */
export function MessagesTab({
  ctl,
  conversations,
  followers,
  searchQuery,
  onSearchQueryChange,
}: MessagesTabProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const filteredConversations = conversations.filter((conv) =>
    conv.userNickname.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  const filteredFollowers = followers.filter((follower) =>
    follower.nickname.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  /** Quem o usuário segue e ainda não tem conversa aberta. */
  const suggestedFollowers = filteredFollowers.filter(
    (f) => !conversations.some((c) => c.userId === f.id),
  );

  /** Abre uma conversa nova (ainda sem histórico) a partir de um sugerido. */
  const openWithFollower = (follower: SearchUser) =>
    ctl.openConversationWithUser({
      userId: follower.id,
      userNickname: follower.nickname,
      userPhoto: follower.photo,
      lastMessage: "",
      lastMessageTime: new Date().toISOString(),
      unreadCount: 0,
    });

  const followerRow = (follower: SearchUser, withChevron: boolean) => (
    <button
      key={follower.id}
      onClick={() => openWithFollower(follower)}
      className="w-full flex items-center gap-3 rounded-[20px] px-3 py-3 hover:bg-white/[.07] transition-colors text-left"
      style={{ background: "rgba(255,255,255,.04)" }}
    >
      <div className="shrink-0">
        <UserAvatar photo={follower.photo} nickname={follower.nickname} size="lg" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/90">{follower.nickname}</p>
        {follower.bio && (
          <p className="text-xs text-white/50 truncate">{follower.bio}</p>
        )}
      </div>
      {withChevron && <ChevronRight className="h-4 w-4 text-white/40 shrink-0" />}
    </button>
  );

  return (
    <>
      {/* Search Bar + Nova conversa */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none z-10" />
          <Input
            placeholder={t("community_search_conversation")}
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="rounded-full pl-9 text-white placeholder:text-white/40 focus-visible:ring-0"
            style={{
              background: "rgba(255,255,255,.06)",
              border: "1px solid rgba(255,255,255,.10)",
            }}
          />
        </div>
        <button
          aria-label={t("community_new_conversation_aria")}
          onClick={() => ctl.setIsNewConversationDrawerOpen(true)}
          className="flex-shrink-0 p-2.5 rounded-full hover:bg-white/[.1] transition-colors"
          style={{
            background: "rgba(255,255,255,.06)",
            border: "1px solid rgba(255,255,255,.10)",
          }}
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
                onDelete={() => {
                  ctl.setConvToDelete(conversation);
                  ctl.setDeleteConvConfirmOpen(true);
                }}
              >
                <div
                  className="relative flex items-center gap-3 rounded-[20px] px-3 py-3 transition-colors active:bg-white/[.09]"
                  style={{ background: "rgba(255,255,255,.04)" }}
                >
                  <button
                    onClick={() => ctl.handleOpenConversation(conversation)}
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
                        <p
                          className={`text-sm truncate ${conversation.unreadCount > 0 ? "font-semibold text-white" : "font-medium text-white/90"}`}
                        >
                          {conversation.userNickname}
                        </p>
                        <p
                          className={`text-xs shrink-0 ${conversation.unreadCount > 0 ? "text-brand font-medium" : "text-white/40"}`}
                        >
                          {formatTimeAgo(conversation.lastMessageTime)}
                        </p>
                      </div>
                      <p
                        className={`text-sm truncate ${conversation.unreadCount > 0 ? "font-medium text-white/80" : "text-white/55"}`}
                      >
                        {conversationPreviewText(conversation.lastMessage, t) ??
                          t("community_start_conversation")}
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
            {searchQuery && suggestedFollowers.length > 0 && (
              <div className="px-2 pt-4 pb-1">
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wide">
                  {t("community_suggestions")}
                </p>
              </div>
            )}
            {searchQuery && suggestedFollowers.map((f) => followerRow(f, false))}
          </div>
        ) : filteredFollowers.length > 0 ? (
          <div className="flex flex-col gap-1">
            <div className="py-5 text-center space-y-2">
              <MessageCircle className="h-10 w-10 mx-auto text-white/30" />
              <p className="text-sm font-medium text-white/90">
                {t("community_no_conversation_yet")}
              </p>
              <p className="text-xs text-white/50">{t("community_choose_someone")}</p>
            </div>
            <div className="px-2 pb-1">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wide">
                {t("community_whom_you_follow")}
              </p>
            </div>
            {filteredFollowers.map((f) => followerRow(f, true))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-8 text-center space-y-4">
            <div
              className="h-16 w-16 rounded-full flex items-center justify-center"
              style={{
                background: "rgba(255,255,255,.06)",
                border: "1px solid rgba(255,255,255,.1)",
              }}
            >
              <MessageCircle className="h-8 w-8 text-white/40" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white/90">
                {t("community_no_conversation")}
              </p>
              <p className="text-xs text-white/50">{t("community_follow_to_message")}</p>
            </div>
            <Button onClick={() => navigate("/buscar")} className="rounded-full" size="sm">
              {t("community_find_people")}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Overlays da aba Mensagens que precisam existir fora do container rolável:
 * o drawer de nova conversa e a confirmação de exclusão.
 */
export function MessagesOverlays({
  ctl,
  followers,
}: {
  ctl: MessagesController;
  followers: SearchUser[];
}) {
  const { t } = useLanguage();

  return (
    <>
      <NewConversationDrawer
        open={ctl.isNewConversationDrawerOpen}
        onOpenChange={ctl.setIsNewConversationDrawerOpen}
        followers={followers}
        onSelectFollower={ctl.openConversationWithUser}
      />

      <AlertDialog
        open={ctl.deleteConvConfirmOpen}
        onOpenChange={ctl.setDeleteConvConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("community_delete_conversation_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("community_delete_conversation_desc").replace(
                "{name}",
                ctl.convToDelete?.userNickname ?? "",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => ctl.setConvToDelete(null)}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void ctl.handleConfirmDeleteConversation();
              }}
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
