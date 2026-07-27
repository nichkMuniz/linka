-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-07-21 — Notificação de avaliação de check-in (tipos 14 e 15)
--
-- Em grupos de duelo do modo `memes`, cada check-in passa por aprovação dos
-- outros participantes (Classificar / Desclassificar, tabela duel_check_in_votes).
-- Quem postou o check-in não era avisado do resultado — precisava voltar ao grupo
-- e reparar no selo "Anulado".
--
--   type 14 → "{nome} classificou seu check-in"     (vote_type = 'classify')
--   type 15 → "{nome} desclassificou seu check-in"  (vote_type = 'disqualify')
--
-- POR QUE TRIGGER, E NÃO INSERT PELO CLIENTE:
-- a RLS de `notifications` (20260713-security-hardening) permite SELECT/DELETE
-- apenas ao DESTINATÁRIO. O votante não enxerga as notificações de quem recebeu
-- o voto, então nenhuma checagem de duplicata feita no cliente funcionaria — o
-- SELECT volta vazio e o insert acontece de novo a cada troca de voto. Rodando
-- como SECURITY DEFINER, a função apaga a avaliação anterior daquele votante
-- naquele check-in antes de gravar a nova: um voto = no máximo uma notificação,
-- e trocar de voto REESCREVE em vez de empilhar.
--
-- O push sai sozinho: a trigger `notify-push-on-notification` já dispara a edge
-- function `send-push-notification` para qualquer linha inserida.
--
-- Rodar no Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Voto criado ou alterado → substitui a notificação anterior ──────────────
create or replace function public.notify_check_in_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  check_in_owner uuid;
  notif_type     smallint;
begin
  select user_id into check_in_owner
  from public.duel_check_ins
  where id = new.check_in_id;

  -- Ninguém avalia o próprio check-in (a UI já esconde os botões), mas a
  -- checagem fica aqui para o caso de o voto chegar por outro caminho.
  if check_in_owner is null or check_in_owner = new.user_id then
    return new;
  end if;

  notif_type := case when new.vote_type = 'classify' then 14 else 15 end;

  -- Um votante = uma avaliação viva por check-in. Trocar Classificar por
  -- Desclassificar substitui o card em vez de deixar os dois na lista.
  delete from public.notifications
  where user_id = check_in_owner
    and follower_id = new.user_id
    and duel_check_in_id = new.check_in_id
    and type in (14, 15);

  insert into public.notifications
    (user_id, follower_id, type, duel_check_in_id, read, created_at)
  values
    (check_in_owner, new.user_id, notif_type, new.check_in_id, false, now());

  return new;
end;
$$;

drop trigger if exists trg_notify_check_in_vote on public.duel_check_in_votes;
create trigger trg_notify_check_in_vote
  after insert or update on public.duel_check_in_votes
  for each row execute function public.notify_check_in_vote();

-- ── Voto removido → a notificação some junto ────────────────────────────────
-- Sem isto, desfazer o voto deixaria no dono do check-in um aviso de uma
-- avaliação que não existe mais.
create or replace function public.notify_check_in_vote_removed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  check_in_owner uuid;
begin
  select user_id into check_in_owner
  from public.duel_check_ins
  where id = old.check_in_id;

  if check_in_owner is not null then
    delete from public.notifications
    where user_id = check_in_owner
      and follower_id = old.user_id
      and duel_check_in_id = old.check_in_id
      and type in (14, 15);
  end if;

  return old;
end;
$$;

drop trigger if exists trg_notify_check_in_vote_removed on public.duel_check_in_votes;
create trigger trg_notify_check_in_vote_removed
  after delete on public.duel_check_in_votes
  for each row execute function public.notify_check_in_vote_removed();
