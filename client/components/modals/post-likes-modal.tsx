import React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useNavigate } from "react-router-dom";
import { Heart } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { getIncentiveConfig } from "@/lib/incentive-config";

export interface PostLike {
  userId: string;
  userNickname: string;
  userPhoto: string | null;
  userGender?: string | null;
  type: number;
}

interface PostLikesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  likes: PostLike[];
}

export function PostLikesModal({ open, onOpenChange, likes }: PostLikesModalProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [activeFilter, setActiveFilter] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!open) setActiveFilter(null);
  }, [open]);

  const getIncentiveTypeName = (type: number): string => {
    const map: Record<number, "incentive_1"|"incentive_2"|"incentive_3"|"incentive_4"|"incentive_5"|"incentive_6"> = {
      1: "incentive_1", 2: "incentive_2", 3: "incentive_3",
      4: "incentive_4", 5: "incentive_5", 6: "incentive_6",
    };
    return map[type] ? t(map[type]) : t("incentive_default");
  };

  const handleUserClick = (userId: string) => {
    navigate(`/usuario/${userId}`);
    onOpenChange(false);
  };

  // Count distinct users (not total incentives)
  const distinctUsers = new Set(likes.map((like) => like.userId)).size;

  // Count incentives by numeric type
  const incentiveTypeCounts = likes.reduce(
    (acc, like) => {
      acc[like.type] = (acc[like.type] || 0) + 1;
      return acc;
    },
    {} as { [key: number]: number }
  );

  const filteredLikes = activeFilter !== null ? likes.filter((l) => l.type === activeFilter) : likes;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[80dvh] flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DrawerHeader className="shrink-0 border-b border-border/60">
          <div className="space-y-3">
            <DrawerTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500 fill-red-500" />
              {t("incentives_title")}
            </DrawerTitle>
            <DrawerDescription className="sr-only">{t("incentives_desc")}</DrawerDescription>

            {/* Distinct Users Counter */}
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm font-medium text-foreground">
                {distinctUsers} {distinctUsers === 1 ? t("incentives_one") : t("incentives_many")}
              </p>
            </div>

            {/* Incentive Type Breakdown — Filterable */}
            {Object.keys(incentiveTypeCounts).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(incentiveTypeCounts).map(([typeStr, count]) => {
                  const typeNum = Number(typeStr);
                  const isActive = activeFilter === typeNum;
                  const cfg = getIncentiveConfig(typeNum);
                  const Icon = cfg?.Icon;
                  return (
                    <button
                      key={typeStr}
                      onClick={() => setActiveFilter(isActive ? null : typeNum)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all active:scale-95 ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "bg-muted/40 text-foreground hover:bg-muted/70"
                      }`}
                    >
                      <span className="font-semibold">{count}</span>
                      <p className={isActive ? "text-primary-foreground" : "text-muted-foreground"}>{getIncentiveTypeName(typeNum)}</p>
                      {Icon && (
                        <Icon
                          className={`h-4 w-4 ml-1 ${isActive ? "text-primary-foreground" : cfg!.activeClassName}`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {filteredLikes.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">
                {likes.length === 0 ? t("incentives_none") : t("incentives_none_type")}
              </p>
            </div>
          ) : (
            <div className="space-y-2 pt-4">
              {filteredLikes.map((like) => {
                const cfg = getIncentiveConfig(like.type);
                const Icon = cfg?.Icon;
                return (
                  <button
                    key={`${like.userId}-${like.type}`}
                    onClick={() => handleUserClick(like.userId)}
                    className="w-full flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors border border-border/40"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <UserAvatar
                        photo={like.userPhoto}
                        gender={like.userGender}
                        nickname={like.userNickname}
                      />
                      <p className="text-sm font-medium text-foreground truncate">
                        {like.userNickname}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-semibold bg-red-500/20 text-red-600 px-2 py-1 rounded-full flex items-center gap-1.5">
                        {getIncentiveTypeName(like.type)}
                        {Icon && (
                          <Icon className={`h-3.5 w-3.5 ${cfg!.activeClassName}`} />
                        )}
                      </span>
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
