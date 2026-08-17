import * as React from "react";

import { sendMessageDb, type StoryWithUser } from "@/lib/ritmofit-db";
import { buildFlowReplyPayload } from "@/lib/flow-reply";
import { useLanguage } from "@/lib/language-context";
import { reportHandledError } from "@/lib/monitoring";
import { toast } from "@/components/ui/use-toast";
import { hapticLight } from "@/lib/haptics";

/**
 * Teto do texto de uma resposta privada. `sendMessageDb` rejeita acima de 1000
 * chars e o payload ainda carrega o prefixo + o id do flow — cortar aqui, com
 * aviso, evita perder o texto num erro genérico de validação.
 */
const MAX_PRIVATE_REPLY_CHARS = 900;

/**
 * Responder um flow **em privado**: em vez de virar comentário (bolha flutuante
 * que todo mundo que abre o flow vê), o texto vai como mensagem direta para o
 * autor, carregando o id do flow para a conversa mostrar a miniatura do que foi
 * respondido (ver `client/lib/flow-reply.ts` e `FlowReplyMessage`).
 *
 * O push sai da notificação **tipo 17** ("respondeu ao seu flow"), que é a mesma
 * mecânica do tipo 10 das mensagens comuns — só muda a frase do banner. Como 17
 * também é push-only, nada disso vira card na tela de Notificações.
 *
 * Vive num hook porque os DOIS viewers de flow têm a mesma doca — a tela
 * `/flows/:storyId` (`FlowViewer.tsx`) e o modal aberto pelo perfil
 * (`flow-viewer-modal.tsx`).
 */
export function useFlowPrivateReply(story: StoryWithUser | null, isOwner: boolean) {
  const { t } = useLanguage();
  const [isSendingPrivateReply, setIsSendingPrivateReply] = React.useState(false);

  /** Devolve `true` quando a mensagem foi gravada — aí o chamador limpa o campo. */
  const sendPrivateReply = React.useCallback(
    async (rawText: string): Promise<boolean> => {
      const text = rawText.trim();
      if (!story || isOwner || !text || isSendingPrivateReply) return false;
      if (text.length > MAX_PRIVATE_REPLY_CHARS) {
        toast({
          title: t("flow_reply_too_long"),
          description: t("flow_reply_too_long_desc").replace("{n}", String(MAX_PRIVATE_REPLY_CHARS)),
          variant: "destructive",
        });
        return false;
      }
      hapticLight();
      setIsSendingPrivateReply(true);
      try {
        const sent = await sendMessageDb(
          story.user_id,
          buildFlowReplyPayload(story.id, text),
          { notificationType: 17, flowId: story.id },
        );
        if (sent) {
          toast({
            title: t("flow_reply_sent_title"),
            description: t("flow_reply_sent_desc").replace("{name}", story.userNickname),
          });
          return true;
        }
        toast({
          title: t("flow_reply_error_title"),
          description: t("flow_reply_error_desc"),
          variant: "destructive",
        });
        return false;
      } catch (err: any) {
        reportHandledError(err, "flow-viewer:private-reply", { flowId: story.id });
        toast({
          title: t("flow_reply_error_title"),
          description: t("flow_reply_error_desc"),
          variant: "destructive",
        });
        return false;
      } finally {
        setIsSendingPrivateReply(false);
      }
    },
    [story, isOwner, isSendingPrivateReply, t],
  );

  return { isSendingPrivateReply, sendPrivateReply };
}
