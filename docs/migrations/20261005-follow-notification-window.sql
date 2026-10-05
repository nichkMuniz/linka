-- ============================================================================
-- Migration: 20261005 — "começou a seguir você" volta a notificar no re-follow
--
-- O BUG:
--   `20260925-follow-notification-dedupe.sql` descarta a notificação type 1
--   se o MESMO par (seguidor → seguido) já teve uma em QUALQUER data. A ideia
--   era barrar spam de seguir/deixar de seguir, mas o efeito foi: quem deixou
--   de seguir e voltou a seguir semanas depois nunca mais avisa — nem sino,
--   nem push. Em 2026-10-05: LinKa → Cleber (notificação anterior de 01/10),
--   Nichk → Cleber, Cleber → Nichk e Thayger → LinKa ficaram mudos.
--   O primeiro follow sempre funcionou (52 de 52 nos últimos 7 dias).
--
-- A REGRA NOVA (por par seguidor → seguido):
--   * nunca notificou, ou a última foi há MAIS de 24 h → notificação nova e
--     push (a antiga é apagada: continua uma linha por par);
--   * a última foi há MENOS de 24 h → sem push; a notificação existente sobe
--     para o topo e volta a "não lida". Alternar seguir/deixar de seguir dá
--     no máximo um push por dia por par.
--
-- O push não sai no segundo caso porque o webhook `notify-push-on-notification`
-- só escuta INSERT, e aqui o INSERT é descartado (BEFORE INSERT → null).
--
-- Reexecutável. Substitui só a função; trigger e índice de 20260925 ficam.
-- ============================================================================

create or replace function public.notifications_skip_duplicate_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last timestamptz;
begin
  if new.type <> 1 or new.follower_id is null then
    return new;
  end if;

  select max(n.created_at) into v_last
    from public.notifications n
   where n.type = 1
     and n.user_id = new.user_id
     and n.follower_id = new.follower_id;

  if v_last is null then
    return new;
  end if;

  if v_last > now() - interval '24 hours' then
    update public.notifications n
       set created_at = now(),
           read = false
     where n.type = 1
       and n.user_id = new.user_id
       and n.follower_id = new.follower_id;
    return null;
  end if;

  delete from public.notifications n
   where n.type = 1
     and n.user_id = new.user_id
     and n.follower_id = new.follower_id;
  return new;
end;
$$;

-- Trigger de 20260925, recriado caso esta migração rode sozinha.
drop trigger if exists notifications_skip_duplicate_follow_trg on public.notifications;
create trigger notifications_skip_duplicate_follow_trg
  before insert on public.notifications
  for each row
  when (new.type = 1)
  execute function public.notifications_skip_duplicate_follow();

create index if not exists notifications_follow_pair_idx
  on public.notifications (user_id, follower_id)
  where type = 1;
