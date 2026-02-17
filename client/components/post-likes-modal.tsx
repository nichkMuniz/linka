import React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ImageWithFallback } from "@/components/image-with-fallback";
import { useNavigate } from "react-router-dom";

export interface PostLike {
  userId: string;
  userNickname: string;
  userPhoto: string | null;
  type: string;
}

interface PostLikesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  likes: PostLike[];
}

export function PostLikesModal({ open, onOpenChange, likes }: PostLikesModalProps) {
  const navigate = useNavigate();

  const handleUserClick = (userId: string) => {
    navigate(`/usuario/${userId}`);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="shrink-0">
          <DrawerTitle>Incentivos</DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-20">
          {likes.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">
                Nenhum incentivo recebido
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {likes.map((like) => (
                <button
                  key={`${like.userId}-${like.type}`}
                  onClick={() => handleUserClick(like.userId)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {like.userPhoto ? (
                    <ImageWithFallback
                      src={like.userPhoto}
                      alt={like.userNickname}
                      fallback="/placeholder.svg"
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-muted" />
                  )}
                  <p className="text-sm font-medium text-foreground">
                    {like.userNickname}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
