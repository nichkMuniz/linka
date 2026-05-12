import * as React from "react";
import { Search } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/shared/user-avatar";
import { type SearchUser, type Conversation, searchUsersDb } from "@/lib/ritmofit-db";
import { useKeyboardAwareHeight } from "@/hooks/use-keyboard-aware-height";

interface NewConversationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  followers: SearchUser[];
  onSelectFollower: (conversation: Conversation) => void;
}

export function NewConversationDrawer({
  open,
  onOpenChange,
  onSelectFollower,
}: NewConversationDrawerProps) {
  const [search, setSearch] = React.useState("");
  const [results, setResults] = React.useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportHeight = useKeyboardAwareHeight();

  React.useEffect(() => {
    if (!open) {
      setSearch("");
      setResults([]);
    }
  }, [open]);

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!search.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await searchUsersDb(search);
        setResults(data);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex flex-col z-[100]" style={{ maxHeight: `min(80dvh, ${viewportHeight - 8}px)` }} onOpenAutoFocus={(e) => e.preventDefault()}>
        <DrawerHeader className="shrink-0">
          <DrawerTitle>Nova mensagem</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar usuário..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-full pl-9 bg-muted/30 border-transparent"
              autoFocus
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {!search.trim() ? (
            <div className="flex flex-col items-center gap-2 py-10 px-2">
              <Search className="h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground text-sm text-center">
                Digite o nome de um usuário para iniciar uma conversa
              </p>
            </div>
          ) : isSearching ? (
            <div className="py-10 flex justify-center">
              <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : results.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-10">
              Nenhum usuário encontrado
            </p>
          ) : (
            results.map((user) => (
              <button
                key={user.id}
                className="w-full flex items-center gap-3 py-3 hover:bg-muted/30 rounded-lg px-2 transition-colors"
                onClick={() => {
                  onSelectFollower({
                    userId: user.id,
                    userNickname: user.nickname,
                    userPhoto: user.photo,
                    lastMessage: "",
                    lastMessageTime: new Date().toISOString(),
                    unreadCount: 0,
                  });
                  onOpenChange(false);
                }}
              >
                <UserAvatar
                  photo={user.photo}
                  nickname={user.nickname}
                  size="md"
                  className="shrink-0"
                />
                <span className="font-medium text-sm">{user.nickname}</span>
              </button>
            ))
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
