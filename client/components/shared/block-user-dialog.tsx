import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";
import { useLanguage } from "@/lib/language-context";
import { reportHandledError } from "@/lib/monitoring";

/**
 * Confirmação de bloqueio / desbloqueio de um usuário.
 *
 * Existe para a Guideline 1.2 da App Store — um app com conteúdo de usuário
 * precisa oferecer, além de denúncia e moderação, um jeito de o usuário
 * bloquear quem o incomoda. Ver `docs/migrations/20260826-user-blocks.sql`.
 *
 * Fica num AlertDialog, e não num Drawer, de propósito: bloquear é destrutivo
 * e assimétrico (desfazer exige achar a lista em Configurações), então pede uma
 * confirmação que interrompe, e não uma folha que se fecha ao arrastar sem
 * querer. O AlertDialog base já trata safe area.
 *
 * O componente não decide nada sobre a UI que o cercou — apenas executa e
 * avisa o dono via `onDone`, que tipicamente fecha o perfil ou recarrega a
 * lista.
 */
export function BlockUserDialog({
  open,
  onOpenChange,
  userId,
  userName,
  mode = "block",
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userName: string;
  /** `unblock` é usado pela lista "Contas bloqueadas" em Configurações. */
  mode?: "block" | "unblock";
  onDone?: () => void;
}) {
  const { t } = useLanguage();
  const [busy, setBusy] = React.useState(false);

  const isBlock = mode === "block";

  const handleConfirm = async () => {
    if (!userId) return;
    setBusy(true);
    try {
      const { blockUserDb, unblockUserDb } = await import("@/lib/ritmofit-db");
      if (isBlock) await blockUserDb(userId);
      else await unblockUserDb(userId);

      toast({
        title: t(isBlock ? "block_success_title" : "unblock_success_title"),
        description: isBlock
          ? t("block_success_desc").replace("{name}", userName)
          : undefined,
      });
      onOpenChange(false);
      onDone?.();
    } catch (err) {
      // catch + toast NÃO chega ao Sentry sozinho — só erro não tratado é
      // capturado. Bloqueio que falha em silêncio é exatamente o bug que não
      // podemos descobrir por um review reprovado.
      reportHandledError(err, "BlockUserDialog", { mode, userId });
      toast({
        title: t(isBlock ? "block_error_title" : "unblock_error_title"),
        description: t("report_error_desc"),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t(isBlock ? "block_confirm_title" : "unblock_confirm_title").replace(
              "{name}",
              userName,
            )}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(isBlock ? "block_confirm_desc" : "unblock_confirm_desc").replace(
              /\{name\}/g,
              userName,
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // Sem isto o Radix fecha o diálogo no clique e a Promise termina
              // com o componente já desmontado — o toast some junto.
              e.preventDefault();
              void handleConfirm();
            }}
            disabled={busy}
            className={isBlock ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
          >
            {t(isBlock ? "block_confirm_cta" : "unblock_user")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
