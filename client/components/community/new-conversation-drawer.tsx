import * as React from "react";
import { Search, UserSearch } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/shared/user-avatar";
import { type SearchUser, type Conversation } from "@/lib/ritmofit-db";

interface NewConversationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  followers: SearchUser[];
  onSelectFollower: (conversation: Conversation) => void;
}

export function NewConversationDrawer({
  open,
  onOpenChange,
  followers,
  onSelectFollower,
}: NewConversationDrawerProps) {
  const [search, setSearch] = React.useState("");
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const filtered = followers.filter((f) =>
    f.nickname.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[80dvh] flex flex-col z-[100]" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DrawerHeader className="shrink-0">
          <DrawerTitle>Nova mensagem</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar seguidor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-full pl-9 bg-muted/30 border-transparent"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {followers.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-10 px-2">
              <div className="bg-muted/40 rounded-full p-4">
                <UserSearch className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-medium text-sm">Você ainda não segue ninguém</p>
                <p className="text-muted-foreground text-sm mt-1">Siga pessoas para poder enviar mensagens.</p>
              </div>
              <Button
                variant="default"
                className="rounded-full"
                onClick={() => {
                  onOpenChange(false);
                  navigate("/buscar");
                }}
              >
                <Search className="h-4 w-4 mr-2" />
                Encontrar pessoas
              </Button>
            </div>
          ) : (
            filtered.map((follower) => (
              <button
                key={follower.id}
                className="w-full flex items-center gap-3 py-3 hover:bg-muted/30 rounded-lg px-2 transition-colors"
                onClick={() => {
                  onSelectFollower({
                    userId: follower.id,
                    userNickname: follower.nickname,
                    userPhoto: follower.photo,
                    lastMessage: "",
                    lastMessageTime: new Date().toISOString(),
                    unreadCount: 0,
                  });
                  onOpenChange(false);
                }}
              >
                <UserAvatar
                  photo={follower.photo}
                  gender={follower.gender}
                  nickname={follower.nickname}
                  size="md"
                  className="shrink-0"
                />
                <span className="font-medium text-sm">{follower.nickname}</span>
              </button>
            ))
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
