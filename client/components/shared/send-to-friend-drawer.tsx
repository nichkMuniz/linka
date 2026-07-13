import * as React from "react";
import { Check, Search, SendHorizontal, UserRoundPlus } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  getConversationsDb,
  getFollowingDb,
  searchUsersDb,
  sendMessageDb,
  type SearchUser,
} from "@/lib/ritmofit-db";
import { useKeyboardAwareHeight } from "@/hooks/use-keyboard-aware-height";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/lib/language-context";

/** Conteúdo interno do app que pode ser enviado via mensagem privada. */
export type SendableContent = {
  kind: "post" | "shot";
  id: string;
  /** Thumbnail exibida no preview do drawer (foto do post ou url do vídeo do shot) */
  previewImage?: string | null;
  /** Nickname do autor do conteúdo, exibido no preview */
  authorNickname?: string;
};

interface SendToFriendDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: SendableContent | null;
}

const MAX_RECIPIENTS = 10;

/**
 * Drawer de envio de post/shot para amigos via mensagem privada (estilo Instagram).
 * Lista conversas recentes + quem o usuário segue, com busca global e
 * multi-seleção. A mensagem enviada usa o prefixo interno "[post]:" / "[shot]:",
 * renderizado como card rico na conversa da Comunidade.
 */
export function SendToFriendDrawer({ open, onOpenChange, content }: SendToFriendDrawerProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const viewportHeight = useKeyboardAwareHeight();

  const [search, setSearch] = React.useState("");
  const [people, setPeople] = React.useState<SearchUser[]>([]);
  const [searchResults, setSearchResults] = React.useState<SearchUser[]>([]);
  const [selected, setSelected] = React.useState<SearchUser[]>([]);
  const [message, setMessage] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);
  const searchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ao abrir: conversas recentes primeiro (com quem o usuário mais fala), depois seguidos
  React.useEffect(() => {
    if (!open) {
      setSearch("");
      setSearchResults([]);
      setSelected([]);
      setMessage("");
      return;
    }
    setIsLoading(true);
    Promise.all([
      getConversationsDb().catch(() => []),
      getFollowingDb().catch(() => []),
    ])
      .then(([conversations, following]) => {
        const merged: SearchUser[] = [];
        const seen = new Set<string>();
        for (const conv of conversations) {
          if (!seen.has(conv.userId)) {
            merged.push({ id: conv.userId, nickname: conv.userNickname, photo: conv.userPhoto });
            seen.add(conv.userId);
          }
        }
        for (const u of following) {
          if (!seen.has(u.id)) {
            merged.push(u);
            seen.add(u.id);
          }
        }
        setPeople(merged);
      })
      .finally(() => setIsLoading(false));
  }, [open]);

  // Busca global com debounce — permite enviar para quem não é seguido
  React.useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(() => {
      searchUsersDb(search)
        .then(setSearchResults)
        .catch(() => setSearchResults([]));
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search]);

  const selectedIds = React.useMemo(() => new Set(selected.map((u) => u.id)), [selected]);

  const visibleUsers = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q ? people.filter((u) => u.nickname.toLowerCase().includes(q)) : people;
    const merged: SearchUser[] = [...base];
    const seen = new Set(base.map((u) => u.id));
    for (const u of searchResults) {
      if (!seen.has(u.id)) {
        merged.push(u);
        seen.add(u.id);
      }
    }
    return merged.filter((u) => u.id !== user?.id);
  }, [people, searchResults, search, user?.id]);

  const toggleUser = (u: SearchUser) => {
    if (selectedIds.has(u.id)) {
      setSelected((prev) => prev.filter((s) => s.id !== u.id));
      return;
    }
    if (selected.length >= MAX_RECIPIENTS) {
      toast({
        title: t("send_to_friend_max_title"),
        description: t("send_to_friend_max_desc").replace("{n}", String(MAX_RECIPIENTS)),
        variant: "destructive",
      });
      return;
    }
    setSelected((prev) => [...prev, u]);
  };

  const handleSend = async () => {
    if (!content || selected.length === 0 || isSending) return;
    setIsSending(true);
    const payload = `[${content.kind}]:${content.id}`;
    const extraText = message.trim();
    try {
      const results = await Promise.all(
        selected.map(async (recipient) => {
          const sent = await sendMessageDb(recipient.id, payload);
          if (sent && extraText) await sendMessageDb(recipient.id, extraText);
          return sent !== null;
        }),
      );
      const sentCount = results.filter(Boolean).length;
      if (sentCount > 0) {
        toast({
          title: t("send_to_friend_sent_title"),
          description: t("send_to_friend_sent_desc").replace("{n}", String(sentCount)),
        });
        onOpenChange(false);
      } else {
        toast({
          title: t("send_to_friend_error_title"),
          description: t("send_to_friend_error_desc"),
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: t("send_to_friend_error_title"),
        description: t("send_to_friend_error_desc"),
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
        className="flex flex-col z-[100] !rounded-t-[32px] !border-0"
        style={{
          maxHeight: `min(85dvh, ${viewportHeight - 8}px)`,
          background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderTop: "1px solid rgba(255,255,255,.14)",
        }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DrawerHeader className="shrink-0">
          <DrawerTitle style={{ color: "#fff" }}>{t("send_to_friend_title")}</DrawerTitle>
          <DrawerDescription className="sr-only">{t("send_to_friend_title")}</DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col min-h-0">
          {/* Preview compacto do conteúdo sendo enviado */}
          {content && (
            <div
              className="mb-3 shrink-0 flex items-center gap-3 p-2.5 rounded-2xl"
              style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}
            >
              {content.previewImage ? (
                content.kind === "shot" ? (
                  <video
                    src={content.previewImage}
                    muted
                    playsInline
                    preload="metadata"
                    className="h-11 w-11 rounded-xl object-cover shrink-0"
                  />
                ) : (
                  <img
                    src={content.previewImage}
                    alt=""
                    className="h-11 w-11 rounded-xl object-cover shrink-0"
                  />
                )
              ) : (
                <div
                  className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(255,255,255,.08)" }}
                >
                  <SendHorizontal className="h-5 w-5" style={{ color: "rgba(255,255,255,.5)" }} />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "#fff" }}>
                  {content.kind === "shot" ? t("send_to_friend_preview_shot") : t("send_to_friend_preview_post")}
                </p>
                {content.authorNickname && (
                  <p className="text-xs truncate" style={{ color: "rgba(255,255,255,.55)" }}>
                    @{content.authorNickname}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="mb-3 relative shrink-0">
            <Search
              className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "rgba(255,255,255,.4)" }}
            />
            <Input
              placeholder={t("send_to_friend_search_placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg pl-9"
              style={{
                background: "rgba(255,255,255,.07)",
                border: "1px solid rgba(255,255,255,.12)",
                color: "#fff",
              }}
            />
          </div>

          <div className="space-y-2 flex-1 overflow-y-auto min-h-0">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-2xl"
                    style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}
                  >
                    <div className="h-9 w-9 rounded-full animate-pulse" style={{ background: "rgba(255,255,255,.1)" }} />
                    <div className="h-3 w-1/3 rounded animate-pulse" style={{ background: "rgba(255,255,255,.1)" }} />
                  </div>
                ))}
              </div>
            ) : visibleUsers.length > 0 ? (
              visibleUsers.map((u) => {
                const isSelected = selectedIds.has(u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() => toggleUser(u)}
                    className="w-full p-3 rounded-2xl transition-all text-left flex items-center gap-3 active:scale-[0.99]"
                    style={{
                      background: isSelected ? "rgba(91,140,255,.15)" : "rgba(255,255,255,.06)",
                      border: isSelected ? "1px solid rgba(91,140,255,.5)" : "1px solid rgba(255,255,255,.1)",
                    }}
                  >
                    <UserAvatar photo={u.photo} nickname={u.nickname} size="sm" className="flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: "#fff" }}>{u.nickname}</div>
                    </div>
                    <div
                      className="h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isSelected ? "linear-gradient(135deg,#5b8cff,#9d6bff)" : "transparent",
                        borderColor: isSelected ? "#5b8cff" : "rgba(255,255,255,.4)",
                      }}
                    >
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="flex flex-col items-center gap-2 py-8">
                <UserRoundPlus className="h-7 w-7" style={{ color: "rgba(255,255,255,.3)" }} />
                <p className="text-sm text-center" style={{ color: "rgba(255,255,255,.5)" }}>
                  {t("send_to_friend_empty")}
                </p>
              </div>
            )}
          </div>

          <div
            className="mt-3 pt-3 shrink-0 space-y-2"
            style={{ borderTop: "1px solid rgba(255,255,255,.08)", paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <Input
              placeholder={t("send_to_friend_message_placeholder")}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={500}
              className="rounded-full"
              style={{
                background: "rgba(255,255,255,.07)",
                border: "1px solid rgba(255,255,255,.12)",
                color: "#fff",
              }}
            />
            <Button
              onClick={handleSend}
              disabled={selected.length === 0 || isSending}
              className="w-full rounded-full border-0 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
            >
              {isSending ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  {t("send_to_friend_sending")}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <SendHorizontal className="h-4 w-4" />
                  {t("send_to_friend_send")}
                  {selected.length > 0 ? ` (${selected.length})` : ""}
                </span>
              )}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
