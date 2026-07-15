-- Flow notifications — incentives (flow_likes) and comments (flow_comments)
--
-- Contexto: as notificações do app são criadas por triggers no banco
-- (notify_on_incentive em likes, notify_on_shot_incentive em shots_likes,
-- notify_post_comment em comments, notify_shots_comment em shots_comments...).
-- As tabelas flow_likes e flow_comments NÃO tinham trigger, por isso
-- incentivos/comentários em flows nunca geravam notificação.
--
-- Estas duas triggers espelham exatamente o comportamento das de shots.
-- A trigger `notify-push-on-notification` (na tabela notifications) cuida do
-- push automaticamente para qualquer linha inserida aqui.

-- ─── Incentivo em flow (flow_likes → notification type 2) ───
CREATE OR REPLACE FUNCTION public.notify_on_flow_incentive()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $function$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT user_id INTO v_owner_id FROM flow WHERE id = NEW.flow_id;

  IF v_owner_id IS NULL OR v_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, follower_id, type, flow_id, incentive_type, read)
  VALUES (v_owner_id, NEW.user_id, 2, NEW.flow_id, NEW.type, false);

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_on_flow_incentive ON public.flow_likes;
CREATE TRIGGER trg_notify_on_flow_incentive
  AFTER INSERT ON public.flow_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_flow_incentive();

-- ─── Comentário em flow (flow_comments → notification type 3) ───
CREATE OR REPLACE FUNCTION public.notify_flow_comment()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $function$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT user_id INTO v_owner_id FROM flow WHERE id = NEW.flow_id;

  IF v_owner_id IS NULL OR v_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, follower_id, type, flow_id, read)
  VALUES (v_owner_id, NEW.user_id, 3, NEW.flow_id, false);

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_flow_comment ON public.flow_comments;
CREATE TRIGGER trg_notify_flow_comment
  AFTER INSERT ON public.flow_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_flow_comment();