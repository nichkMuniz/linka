import * as React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import { getUserIdByHandleDb } from "@/lib/ritmofit-db";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/hooks/useAuth";

/**
 * Toque numa menção "@usuario" em legenda/comentário → abre o perfil. O texto só
 * guarda o handle, então o id é resolvido na hora (uma query curta). Handle que
 * não existe mais (usuário trocou ou apagou a conta) → toast, sem navegar.
 */
export function useOpenProfileByHandle() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  return React.useCallback(
    async (handle: string) => {
      const id = await getUserIdByHandleDb(handle).catch(() => null);
      if (!id) {
        toast({ title: t("mention_user_not_found"), variant: "destructive" });
        return;
      }
      navigate(id === user?.id ? "/perfil" : `/usuario/${id}`);
    },
    [navigate, t, user?.id],
  );
}
