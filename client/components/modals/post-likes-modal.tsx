import React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ImageWithFallback } from "@/components/shared/image-with-fallback";
import { useNavigate } from "react-router-dom";
import { Heart } from "lucide-react";

const INCENTIVE_ICONS: Record<number, string> = {
  1: "👏",
  2: "🔥",
  3: "🏆",
  4: "🚀",
  5: "🎯",
  6: "⚡",
};

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

export function PostLikesModal({ open, onOpenChange, likes }: PostLikesModalProps) {
  const navigate = useNavigate();

  const getIncentiveTypeName = (type: number): string => {
    const incentiveNames: { [key: number]: string } = {
      1: "Apoio",
      2: "Continua",
      3: "Ganhador",
      4: "Consegue Mais",
      5: "Limite Maior",
      6: "Mais Algum",
    };
    return incentiveNames[type] || "Incentivo";
  };

  const handleUserClick = (userId: string) => {
    navigate(`/usuario/${userId}`);
    onOpenChange(false);
  };

  // Count distinct users (not total incentives)
  const distinctUsers = new Set(likes.map((like) => like.userId)).size;

  // Count incentives by type
  const incentiveTypeCounts = likes.reduce(
    (acc, like) => {
      const typeName = getIncentiveTypeName(like.type);
      acc[typeName] = (acc[typeName] || 0) + 1;
      return acc;
    },
    {} as { [key: string]: number }
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[80dvh]">
        <DrawerHeader className="shrink-0 border-b border-border/60">
          <div className="space-y-3">
            <DrawerTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500 fill-red-500" />
              Incentivos
            </DrawerTitle>

            {/* Distinct Users Counter */}
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm font-medium text-foreground">
                {distinctUsers} {distinctUsers === 1 ? "pessoa te incentivou" : "pessoas te incentivaram"}
              </p>
            </div>

            {/* Incentive Type Breakdown with Icons - Single Line */}
            {Object.keys(incentiveTypeCounts).length > 0 && (
              <div className="flex flex-wrap gap-3">
                {Object.entries(incentiveTypeCounts).map(([typeName, count]) => {
                  // Find the type number to get the icon
                  const typeNum = parseInt(
                    Object.keys({
                      1: "Apoio",
                      2: "Continua",
                      3: "Ganhador",
                      4: "Consegue Mais",
                      5: "Limite Maior",
                      6: "Mais Algum",
                    }).find(
                      (k) =>
                        ({
                          1: "Apoio",
                          2: "Continua",
                          3: "Ganhador",
                          4: "Consegue Mais",
                          5: "Limite Maior",
                          6: "Mais Algum",
                        }[parseInt(k)] === typeName)
                    ) || "1"
                  );

                  return (
                    <div
                      key={typeName}
                      className="flex items-center gap-2 px-3 py-1.5 bg-muted/40 rounded-full text-sm"
                    >
                      <span className="font-semibold text-foreground">{count}</span>
                      <p className="text-muted-foreground">{typeName}</p>
                      <span className="text-base ml-1">
                        {INCENTIVE_ICONS[typeNum] || "👍"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-20">
          {likes.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">
                Nenhum incentivo recebido
              </p>
            </div>
          ) : (
            <div className="space-y-2 pt-4">
              {likes.map((like) => (
                <button
                  key={`${like.userId}-${like.type}`}
                  onClick={() => handleUserClick(like.userId)}
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors border border-border/40"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {like.userPhoto ? (
                      <ImageWithFallback
                        src={like.userPhoto}
                        alt={like.userNickname}
                        fallback="/placeholder.svg"
                        className="h-10 w-10 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-muted flex-shrink-0" />
                    )}
                    <p className="text-sm font-medium text-foreground truncate">
                      {like.userNickname}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-semibold bg-red-500/20 text-red-600 px-2 py-1 rounded-full flex items-center gap-1.5">
                      {getIncentiveTypeName(like.type)}
                      <span className="text-sm">
                        {INCENTIVE_ICONS[like.type] || "👍"}
                      </span>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
