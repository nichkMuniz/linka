import * as React from "react";
import { Check, Search, UserRoundPlus } from "lucide-react";
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
import { getFollowingDb, searchUsersDb, type SearchUser } from "@/lib/ritmofit-db";
import { useKeyboardAwareHeight } from "@/hooks/use-keyboard-aware-height";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/lib/language-context";

export const MAX_TAGGED_PEOPLE = 10;

interface TagPeopleDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pessoas já marcadas (controlado pelo pai) */
  selected: SearchUser[];
  onChange: (users: SearchUser[]) => void;
}

/**
 * Drawer de marcação de pessoas em um post (estilo Instagram).
 * Lista quem o usuário segue e permite buscar qualquer pessoa do app;
 * a seleção é controlada pelo pai via `selected`/`onChange`.
 */
export function TagPeopleDrawer({ open, onOpenChange, selected, onChange }: TagPeopleDrawerProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const viewportHeight = useKeyboardAwareHeight();

  const [search, setSearch] = React.useState("");
  const [following, setFollowing] = React.useState<SearchUser[]>([]);
  const [searchResults, setSearchResults] = React.useState<SearchUser[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const searchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (!open) {
      setSearch("");
      setSearchResults([]);
      return;
    }
    setIsLoading(true);
    getFollowingDb()
      .then(setFollowing)
      .catch(() => setFollowing([]))
      .finally(() => setIsLoading(false));
  }, [open]);

  // Busca global com debounce — permite marcar quem não é seguido
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

  // Seguidos filtrados pela busca + resultados globais, sem duplicatas e sem o próprio usuário
  const visibleUsers = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? following.filter((u) => u.nickname.toLowerCase().includes(q))
      : following;
    const merged: SearchUser[] = [...base];
    const seen = new Set(base.map((u) => u.id));
    for (const u of searchResults) {
      if (!seen.has(u.id)) {
        merged.push(u);
        seen.add(u.id);
      }
    }
    return merged.filter((u) => u.id !== user?.id);
  }, [following, searchResults, search, user?.id]);

  const toggleUser = (u: SearchUser) => {
    if (selectedIds.has(u.id)) {
      onChange(selected.filter((s) => s.id !== u.id));
      return;
    }
    if (selected.length >= MAX_TAGGED_PEOPLE) {
      toast({
        title: t("tag_people_max_title"),
        description: t("tag_people_max_desc").replace("{n}", String(MAX_TAGGED_PEOPLE)),
        variant: "destructive",
      });
      return;
    }
    onChange([...selected, u]);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
        className="flex flex-col !rounded-t-[32px] !border-0"
        style={{
          maxHeight: `min(80dvh, ${viewportHeight - 8}px)`,
          background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderTop: "1px solid rgba(255,255,255,.14)",
        }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DrawerHeader className="shrink-0">
          <DrawerTitle style={{ color: "#fff" }}>{t("tag_people_title")}</DrawerTitle>
          <DrawerDescription className="sr-only">{t("tag_people_title")}</DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col min-h-0">
          <div className="mb-4 relative shrink-0">
            <Search
              className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "rgba(255,255,255,.4)" }}
            />
            <Input
              placeholder={t("tag_people_search_placeholder")}
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
                  {t("tag_people_empty")}
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,.08)", paddingBottom: "env(safe-area-inset-bottom)" }}>
            <Button
              onClick={() => onOpenChange(false)}
              className="w-full rounded-full border-0"
              style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
            >
              {t("tag_people_done")}
              {selected.length > 0 ? ` (${selected.length})` : ""}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
