import { useNavigate } from "react-router-dom";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { FollowButton } from "@/components/shared/follow-button";
import { UserAvatar } from "@/components/shared/user-avatar";
import { VerifiedBadge } from "@/components/shared/VerifiedBadge";
import type { VerifiedTier } from "@/lib/verified-tier";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/lib/language-context";

interface FollowUser {
  id: string;
  nickname: string;
  photo?: string | null;
  isVerified?: boolean;
  verifiedTier?: VerifiedTier | null;
  /** Mostrado abaixo do nome quando presente (sugestões de perfis mais seguidos). */
  followersCount?: number;
}

interface FollowListDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "followers" | "following";
  users: FollowUser[];
  isLoading: boolean;
  /** Status inicial de seguimento por userId (carregado em batch pelo pai) */
  followStatus?: Record<string, boolean>;
  /** Sobrescreve o título derivado de `type` (ex.: "Pessoas marcadas" num post) */
  title?: string;
  /** Sobrescreve a mensagem de lista vazia derivada de `type` */
  emptyMessage?: string;
  /**
   * Sugestões mostradas no lugar da lista quando ela está vazia — hoje, os
   * perfis mais seguidos na lista "Seguindo" do próprio perfil. Sem sugestão
   * (ou ainda vazia) fica só a mensagem de lista vazia.
   */
  emptySuggestions?: { title: string; description: string; users: FollowUser[]; isLoading: boolean };
}

export function FollowListDrawer({
  open,
  onOpenChange,
  type,
  users,
  isLoading,
  followStatus = {},
  title: titleProp,
  emptyMessage: emptyMessageProp,
  emptySuggestions,
}: FollowListDrawerProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const title = titleProp ?? (type === "followers" ? t("profile_followers") : t("profile_following"));
  const emptyMessage =
    emptyMessageProp ??
    (type === "followers" ? t("follow_list_empty_followers") : t("follow_list_empty_following"));

  const loadingSkeleton = (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
          <div className="h-10 w-10 rounded-full animate-pulse" style={{ background: "rgba(255,255,255,.1)" }} />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded animate-pulse" style={{ background: "rgba(255,255,255,.1)" }} />
            <div className="h-2 w-1/4 rounded animate-pulse" style={{ background: "rgba(255,255,255,.08)" }} />
          </div>
        </div>
      ))}
    </div>
  );

  // `initialIsFollowing` explícito evita a consulta do FollowButton por linha
  // (as sugestões já vêm sem quem a pessoa segue).
  const renderUserRow = (u: FollowUser, initialIsFollowing: boolean | undefined = followStatus[u.id]) => (
    <div
      key={u.id}
      className="flex items-center gap-3 p-3 rounded-2xl transition-all"
      style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}
    >
      <button
        onClick={() => {
          onOpenChange(false);
          navigate(`/usuario/${u.id}`);
        }}
        className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
      >
        <UserAvatar
          photo={u.photo}
          nickname={u.nickname}
          size="md"
          className="flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="flex items-center gap-1 font-medium" style={{ color: "#fff" }}>
            <span className="truncate">{u.nickname}</span>
            {u.verifiedTier && <VerifiedBadge size="sm" tier={u.verifiedTier} />}
          </p>
          {u.followersCount != null && (
            <p className="text-xs truncate" style={{ color: "rgba(255,255,255,.5)" }}>
              {u.followersCount === 1
                ? t("follow_list_followers_one")
                : t("follow_list_followers_many").replace("{n}", u.followersCount.toLocaleString())}
            </p>
          )}
        </div>
      </button>
      {u.id !== user?.id && (
        <div className="shrink-0">
          {/* Sem status em batch → undefined deixa o FollowButton buscar sozinho */}
          <FollowButton
            targetUserId={u.id}
            targetName={u.nickname}
            initialIsFollowing={initialIsFollowing}
          />
        </div>
      )}
    </div>
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
        className="max-h-[80dvh] flex flex-col modal-enter !rounded-t-[32px] !border-0"
        style={{
          background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderTop: "1px solid rgba(255,255,255,.14)",
        }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DrawerHeader className="shrink-0">
          <DrawerTitle style={{ color: "#fff" }}>{title}</DrawerTitle>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-6">
          {isLoading ? (
            loadingSkeleton
          ) : users.length > 0 ? (
            users.map((u) => renderUserRow(u))
          ) : (
            <>
              <div className="text-center py-6 text-sm" style={{ color: "rgba(255,255,255,.5)" }}>
                {emptySuggestions && (emptySuggestions.isLoading || emptySuggestions.users.length > 0)
                  ? emptySuggestions.description
                  : emptyMessage}
              </div>
              {emptySuggestions && (emptySuggestions.isLoading || emptySuggestions.users.length > 0) && (
                <>
                  <p className="px-1 text-[13px] font-semibold" style={{ color: "rgba(255,255,255,.7)" }}>
                    {emptySuggestions.title}
                  </p>
                  {emptySuggestions.isLoading
                    ? loadingSkeleton
                    : emptySuggestions.users.map((u) => renderUserRow(u, false))}
                </>
              )}
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
