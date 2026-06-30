import { useNavigate } from "react-router-dom";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { FollowButton } from "@/components/shared/follow-button";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/hooks/useAuth";

interface FollowUser {
  id: string;
  nickname: string;
  photo?: string | null;
}

interface FollowListDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "followers" | "following";
  users: FollowUser[];
  isLoading: boolean;
  /** Status inicial de seguimento por userId (carregado em batch pelo pai) */
  followStatus?: Record<string, boolean>;
}

export function FollowListDrawer({
  open,
  onOpenChange,
  type,
  users,
  isLoading,
  followStatus = {},
}: FollowListDrawerProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const title = type === "followers" ? "Seguidores" : "Seguindo";
  const emptyMessage =
    type === "followers" ? "Nenhum seguidor ainda" : "Não está seguindo ninguém";

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
          ) : users.length > 0 ? (
            users.map((u) => (
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
                    <p className="font-medium truncate" style={{ color: "#fff" }}>{u.nickname}</p>
                  </div>
                </button>
                {u.id !== user?.id && (
                  <div className="shrink-0">
                    <FollowButton
                      targetUserId={u.id}
                      initialIsFollowing={followStatus[u.id] ?? false}
                    />
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-sm" style={{ color: "rgba(255,255,255,.5)" }}>
              {emptyMessage}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
