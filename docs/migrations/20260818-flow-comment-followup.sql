-- ============================================================
-- Notificação tipo 18 — "também comentaram no flow que você comentou"
-- (2026-08-18)
-- ============================================================
-- O QUE FAZ: quando alguém comenta em um flow, avisa **todo mundo que já havia
--   comentado naquele mesmo flow** — inclusive quando quem comentou foi o dono
--   do flow respondendo. É a notificação de "conversa continuou", igual à que
--   o Instagram manda quando respondem num post em que você comentou.
--
-- POR QUE: até aqui só o DONO do flow era avisado (type 3, trigger
--   `trg_notify_flow_comment`). Quem comentava no flow de outra pessoa nunca
--   ficava sabendo que responderam — nem quando a resposta era do próprio dono
--   dirigida a ele. O comentário morria: só descobria quem reabrisse o flow
--   por acaso, dentro da janela de 24 h em que ele existe.
--
-- QUEM RECEBE: todos os autores de comentários anteriores no mesmo flow,
--   EXCETO:
--     • quem acabou de comentar (não se notifica a si mesmo);
--     • o dono do flow — ele já recebe o type 3 pela trigger existente, e as
--       duas juntas virariam dois pushes para a mesma frase.
--
-- ANTI-ENXURRADA: se o mesmo autor comentar 5 vezes seguidas, o participante
--   recebe UM aviso, não 5. A regra é: já existe uma 18 NÃO LIDA daquele autor,
--   naquele flow, para aquele destinatário? Então pula. Assim que a pessoa
--   abre a tela de Notificações (que marca tudo como lido), o próximo
--   comentário volta a avisar. Pessoas DIFERENTES sempre geram avisos
--   distintos — o que se colapsa é a repetição, não a conversa.
--
-- POR QUE TRIGGER E NÃO INSERT NO CLIENTE: a RLS de `notifications` dá SELECT
--   só ao destinatário. Do cliente, quem comenta não consegue nem ler os
--   comentários-participantes com segurança nem checar duplicata (o SELECT
--   volta vazio e o dedup vira no-op silencioso — mesmo motivo documentado em
--   docs/14-database-schema.md para os tipos 14/15). `SECURITY DEFINER`
--   resolve os dois.
--
-- PUSH: automático. A trigger `notify-push-on-notification` (AFTER INSERT em
--   `notifications`) chama a edge function para qualquer linha nova.
--   ⚠️ Exige REDEPLOY da `send-push-notification` para o push do tipo 18 sair
--   com texto próprio em vez de "Você tem uma nova notificação".
--
-- SEGURO DE REEXECUTAR: CREATE OR REPLACE + DROP TRIGGER IF EXISTS.
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_flow_comment_followup()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $function$
DECLARE
  v_owner_id uuid;
  v_participant uuid;
BEGIN
  SELECT user_id INTO v_owner_id FROM flow WHERE id = NEW.flow_id;

  FOR v_participant IN
    SELECT DISTINCT c.user_id
      FROM public.flow_comments c
     WHERE c.flow_id = NEW.flow_id
       AND c.id <> NEW.id
       AND c.user_id IS NOT NULL
       AND c.user_id <> NEW.user_id
       -- O dono do flow sai daqui: a trigger `trg_notify_flow_comment` já
       -- mandou o type 3 para ele nesta mesma inserção.
       AND (v_owner_id IS NULL OR c.user_id <> v_owner_id)
  LOOP
    -- Já tem um aviso não lido do MESMO autor, no MESMO flow? Não repete.
    IF EXISTS (
      SELECT 1
        FROM public.notifications n
       WHERE n.user_id = v_participant
         AND n.follower_id = NEW.user_id
         AND n.type = 18
         AND n.flow_id = NEW.flow_id
         AND n.read = false
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.notifications (user_id, follower_id, type, flow_id, read)
    VALUES (v_participant, NEW.user_id, 18, NEW.flow_id, false);
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_flow_comment_followup ON public.flow_comments;
CREATE TRIGGER trg_notify_flow_comment_followup
  AFTER INSERT ON public.flow_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_flow_comment_followup();

-- Índice para as duas varreduras que a trigger faz por comentário: listar os
-- participantes do flow e checar a duplicata não lida.
CREATE INDEX IF NOT EXISTS flow_comments_flow_id_user_id_idx
  ON public.flow_comments (flow_id, user_id);
CREATE INDEX IF NOT EXISTS notifications_followup_dedup_idx
  ON public.notifications (user_id, type, flow_id)
  WHERE read = false;
