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
      <DrawerContent className="max-h-[80dvh] flex flex-col z-[100]" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DrawerHeader className="shrink-0">
          <DrawerTitle>Adicionar Membros</DrawerTitle>
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
              />
            </div>
          )}

          <div className="space-y-2 flex-1 overflow-y-auto">
            {followers.length > 0 ? (
              filtered.map((follower) => (
                <button
                  key={follower.id}
                  onClick={() => toggleMember(follower.id)}
                  className={`w-full p-3 rounded-lg border transition-all text-left flex items-center gap-2 ${
                    selected.has(follower.id)
                      ? "border-brand bg-brand/10"
                      : "border-border hover:border-brand/50"
                  }`}
                >
                  <div
                    className={`h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      selected.has(follower.id)
                        ? "bg-brand border-brand"
                        : "border-muted-foreground"
                    }`}
                  >
                    {selected.has(follower.id) && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{follower.nickname}</div>
                  </div>
                </button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Você não segue ninguém ainda
              </p>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-border/40">
            <Button onClick={handleAdd} className="w-full rounded-full" disabled={selected.size === 0}>
              Adicionar {selected.size > 0 ? `(${selected.size})` : ""}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
