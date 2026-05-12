import * as React from "react";
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
      <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DrawerHeader className="shrink-0">
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/3 rounded bg-muted animate-pulse" />
                    <div className="h-2 w-1/4 rounded bg-muted animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : users.length > 0 ? (
            users.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
              >
                <button
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/usuario/${u.id}`);
                  }}
                  className="flex items-center gap-3 flex-1 text-left hover:opacity-80 transition-opacity"
                >
                  <UserAvatar
                    photo={u.photo}
                    nickname={u.nickname}
                    size="md"
                    className="flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{u.nickname}</p>
                  </div>
                </button>
                {u.id !== user?.id && (
                  <FollowButton
                    targetUserId={u.id}
                    initialIsFollowing={followStatus[u.id] ?? false}
                  />
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
