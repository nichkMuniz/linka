import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { UserAvatar } from "@/components/shared/user-avatar";
import { LoadingSpinner } from "@/components/shared/animated-loading";
import { BlockUserDialog } from "@/components/shared/block-user-dialog";
import { useLanguage } from "@/lib/language-context";
import type { SearchUser } from "@/lib/ritmofit-db";

/**
 * Lista de contas que o usuário bloqueou, com a ação de desbloquear.
 *
 * A Guideline 1.2 não pede só o botão de bloquear: pede que o bloqueio seja
 * REVERSÍVEL pelo próprio usuário. Como quem foi bloqueado desaparece de todas
 * as superfícies (feed, busca, perfil, conversas), esta tela é o ÚNICO lugar de
 * onde é possível desfazer — sem ela, bloquear seria uma porta sem maçaneta.
 */
export function BlockedAccountsDrawer({
  open,
  onOpenChange,
  viewportHeight,
  back,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewportHeight: number;
  /** Botão de voltar do drawer pai (mesmo padrão dos outros sub-drawers). */
  back?: React.ReactNode;
}) {
  const { t } = useLanguage();
  const [users, setUsers] = React.useState<SearchUser[] | null>(null);
  const [target, setTarget] = React.useState<SearchUser | null>(null);

  const load = React.useCallback(async () => {
    const { getBlockedByMeDb } = await import("@/lib/ritmofit-db");
    setUsers(await getBlockedByMeDb());
  }, []);

  React.useEffect(() => {
    if (!open) return;
    // Sempre relê ao abrir: a lista é curta e um item obsoleto aqui significa
    // "desbloqueei e continua na lista", que parece um bug grave.
    setUsers(null);
    void load();
  }, [open, load]);

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
          className="flex flex-col modal-enter !rounded-t-[32px] !border-0"
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
            <div className="flex items-center gap-2">
              {back}
              <DrawerTitle style={{ color: "#fff" }}>{t("blocked_accounts_title")}</DrawerTitle>
            </div>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 space-y-2">
            {users === null ? (
              <div className="flex justify-center py-10">
                <LoadingSpinner />
              </div>
            ) : users.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-medium" style={{ color: "#fff" }}>
                  {t("blocked_accounts_empty")}
                </p>
                <p className="mt-1 text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
                  {t("blocked_accounts_empty_desc")}
                </p>
              </div>
            ) : (
              users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
                  style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}
                >
                  <UserAvatar photo={u.photo} nickname={u.nickname} size="sm" />
                  <span className="flex-1 truncate text-sm font-medium" style={{ color: "#fff" }}>
                    {u.nickname}
                  </span>
                  <button
                    onClick={() => setTarget(u)}
                    className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold active:scale-95 transition-transform"
                    style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.14)", color: "#fff" }}
                  >
                    {t("unblock_user")}
                  </button>
                </div>
              ))
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <BlockUserDialog
        open={!!target}
        onOpenChange={(o) => { if (!o) setTarget(null); }}
        userId={target?.id ?? null}
        userName={target?.nickname ?? ""}
        mode="unblock"
        onDone={() => { setTarget(null); void load(); }}
      />
    </>
  );
}
