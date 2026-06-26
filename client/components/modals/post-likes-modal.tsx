import React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/lib/language-context";
import { getIncentiveConfig } from "@/lib/incentive-config";

export interface PostLike {
  userId: string;
  userNickname: string;
  userPhoto: string | null;
  type: number;
}

interface PostLikesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  likes: PostLike[];
}

const BADGE_COLORS: Record<number, string> = {
  1: "#ff5f7a",
  2: "#ffb15e",
  3: "#ffd76a",
  4: "#6ea8ff",
  5: "#5b8cff",
  6: "#ffe14a",
};

export function PostLikesModal({ open, onOpenChange, likes }: PostLikesModalProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [activeFilter, setActiveFilter] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!open) setActiveFilter(null);
  }, [open]);

  const handleUserClick = (userId: string) => {
    navigate(`/usuario/${userId}`);
    onOpenChange(false);
  };

  const totalCount = likes.length;

  const incentiveTypeCounts = likes.reduce(
    (acc, like) => {
      acc[like.type] = (acc[like.type] || 0) + 1;
      return acc;
    },
    {} as { [key: number]: number },
  );

  const filteredLikes =
    activeFilter !== null ? likes.filter((l) => l.type === activeFilter) : likes;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
        className="max-h-[80dvh] flex flex-col !rounded-t-[32px] !border-0"
        style={{
          background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderTop: "1px solid rgba(255,255,255,.14)",
        }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DrawerDescription className="sr-only">{t("incentives_desc")}</DrawerDescription>

        {/* Header */}
        <div className="px-[18px] pb-[14px] shrink-0">
          <DrawerTitle
            className="text-[18px] leading-none mb-[14px]"
            style={{ fontWeight: 740, color: "#fff" }}
          >
            {t("incentives_title")} · {totalCount}
          </DrawerTitle>

          {/* Filter chips */}
          <div
            className="flex gap-2 overflow-x-auto"
            style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
          >
            <button
              onClick={() => setActiveFilter(null)}
              className="flex-shrink-0 flex items-center gap-1.5 text-[13px] rounded-2xl px-[14px] py-[8px] transition-all active:scale-95"
              style={
                activeFilter === null
                  ? { fontWeight: 640, background: "linear-gradient(rgba(255,255,255,.95),rgba(255,255,255,.84))", color: "#0a0b12" }
                  : { fontWeight: 600, background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", color: "#fff" }
              }
            >
              {t("incentives_all")} {totalCount}
            </button>
            {Object.entries(incentiveTypeCounts).map(([typeStr, count]) => {
              const typeNum = Number(typeStr);
              const isActive = activeFilter === typeNum;
              const cfg = getIncentiveConfig(typeNum);
              return (
                <button
                  key={typeStr}
                  onClick={() => setActiveFilter(isActive ? null : typeNum)}
                  className="flex-shrink-0 flex items-center gap-[5px] text-[13px] rounded-2xl px-[13px] py-[8px] transition-all active:scale-95"
                  style={
                    isActive
                      ? { fontWeight: 640, background: "linear-gradient(rgba(255,255,255,.95),rgba(255,255,255,.84))", color: "#0a0b12" }
                      : { fontWeight: 600, background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", color: "#fff" }
                  }
                >
                  {cfg?.emoji} {count}
                </button>
              );
            })}
          </div>
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto px-[18px] pb-[28px]">
          {filteredLikes.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm" style={{ color: "rgba(255,255,255,.5)" }}>
                {likes.length === 0 ? t("incentives_none") : t("incentives_none_type")}
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              {filteredLikes.map((like, idx) => {
                const cfg = getIncentiveConfig(like.type);
                const Icon = cfg?.Icon;
                const badgeColor = BADGE_COLORS[like.type] ?? "#6ea8ff";
                const badgeIconColor = like.type === 3 ? "#0a0b12" : "#fff";
                return (
                  <button
                    key={`${like.userId}-${like.type}-${idx}`}
                    onClick={() => handleUserClick(like.userId)}
                    className="flex items-center gap-3 py-[10px] active:opacity-70 transition-opacity"
                  >
                    {/* Avatar with reaction badge */}
                    <div className="relative flex-shrink-0">
                      <UserAvatar
                        photo={like.userPhoto}
                        nickname={like.userNickname}
                        size="lg"
                      />
                      {Icon && (
                        <span
                          className="absolute flex items-center justify-center"
                          style={{
                            bottom: "-2px",
                            right: "-2px",
                            width: "20px",
                            height: "20px",
                            borderRadius: "50%",
                            background: badgeColor,
                            border: "2px solid #16151c",
                            color: badgeIconColor,
                            flexShrink: 0,
                          }}
                        >
                          <Icon style={{ width: "10px", height: "10px" }} />
                        </span>
                      )}
                    </div>

                    <div className="flex-1 text-left">
                      <div
                        className="text-[14px] leading-tight"
                        style={{ fontWeight: 660, color: "#fff" }}
                      >
                        {like.userNickname}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
