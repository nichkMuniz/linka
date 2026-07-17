import * as React from "react";
import { Check } from "lucide-react";
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
import { addMembersToGroupDb, type SearchUser } from "@/lib/ritmofit-db";
import { useKeyboardAwareHeight } from "@/hooks/use-keyboard-aware-height";

interface AddMembersDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  followers: SearchUser[];
  existingMemberIds: string[];
  onMembersAdded: () => void;
}

export function AddMembersDrawer({
  open,
  onOpenChange,
  groupId,
  followers,
  existingMemberIds,
  onMembersAdded,
}: AddMembersDrawerProps) {
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const viewportHeight = useKeyboardAwareHeight();

  React.useEffect(() => {
    if (!open) {
      setSearch("");
      setSelected(new Set());
    }
  }, [open]);

  const filtered = followers.filter(
    (f) =>
      f.nickname.toLowerCase().includes(search.toLowerCase()) &&
      !existingMemberIds.includes(f.id)
  );

  const toggleMember = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
  };

  const handleAdd = async () => {
    if (selected.size === 0) {
      toast({ title: "Selecione membros", description: "Selecione pelo menos um membro para adicionar", variant: "destructive" });
      return;
    }
    try {
      await addMembersToGroupDb(groupId, Array.from(selected), "invited");
      toast({ title: "Membros adicionados!", description: `${selected.size} membro(s) adicionado(s) ao grupo.` });
      onOpenChange(false);
      onMembersAdded();
    } catch (error: any) {
      toast({ title: "Erro ao adicionar membros", description: error.message || "Tente novamente", variant: "destructive" });
    }
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
          <DrawerTitle style={{ color: "#fff" }}>Adicionar Membros</DrawerTitle>
          <DrawerDescription className="sr-only">Convide pessoas para o grupo</DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col">
          {followers.length > 0 && (
            <div className="mb-4">
              <Input
                placeholder="Pesquisar seguidor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-lg"
                style={{
                  background: "rgba(255,255,255,.07)",
                  border: "1px solid rgba(255,255,255,.12)",
                  color: "#fff",
                }}
              />
            </div>
          )}

          <div className="space-y-2 flex-1 overflow-y-auto">
            {followers.length > 0 ? (
              filtered.map((follower) => (
                <button
                  key={follower.id}
                  onClick={() => toggleMember(follower.id)}
                  className="w-full p-3 rounded-2xl transition-all text-left flex items-center gap-2 active:scale-[0.99]"
                  style={{
                    background: selected.has(follower.id) ? "rgba(91,140,255,.15)" : "rgba(255,255,255,.06)",
                    border: selected.has(follower.id) ? "1px solid rgba(91,140,255,.5)" : "1px solid rgba(255,255,255,.1)",
                  }}
                >
                  <div
                    className="h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0"
                    style={{
                      background: selected.has(follower.id) ? "linear-gradient(135deg,#5b8cff,#9d6bff)" : "transparent",
                      borderColor: selected.has(follower.id) ? "#5b8cff" : "rgba(255,255,255,.4)",
                    }}
                  >
                    {selected.has(follower.id) && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: "#fff" }}>{follower.nickname}</div>
                  </div>
                </button>
              ))
            ) : (
              <p className="text-sm text-center py-4" style={{ color: "rgba(255,255,255,.5)" }}>
                Você não segue ninguém ainda
              </p>
            )}
          </div>

          <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
            <Button
              onClick={handleAdd}
              className="w-full rounded-full border-0"
              disabled={selected.size === 0}
              style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
            >
              Adicionar {selected.size > 0 ? `(${selected.size})` : ""}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
