-- ============================================================================
-- Migration: 20260925 — uma notificação de "novo seguidor" por par
--
-- ⚠️ OBRIGATÓRIA. Independe das outras de 20260925, mas faz par com
-- `20260925-followers-unfollow-sync.sql`.
--
-- O BUG:
--   `trigger_notify_follow` (AFTER INSERT em `followers`) cria uma notificação
--   type 1 a cada linha nova. Seguir → deixar de seguir → seguir de novo gera
--   uma linha nova em `followers`, então o destinatário recebia outra
--   notificação e outro push, e a lista mostrava o mesmo "começou a seguir
--   você" repetido.
--
--   Não dá para resolver no cliente: a RLS de `notifications` só deixa o
--   DESTINATÁRIO ler/apagar, então quem segue não enxerga a notificação
--   anterior (ver 20260713-security-hardening.sql).
--
-- O QUE ESTA MIGRAÇÃO FAZ:
--   1. trigger BEFORE INSERT em `notifications`: se já existe uma type 1 do
--      mesmo seguidor para o mesmo destinatário, o insert é descartado em
--      silêncio. Isso também segura o push, porque `notify-push-on-notification`
--      é AFTER INSERT;
--   2. limpa as duplicatas existentes (mantém a MAIS RECENTE de cada par);
--   3. índice para a checagem do passo 1 não varrer a tabela.
--
-- Escolha consciente: deixar de seguir NÃO apaga a notificação antiga.
-- Apagar faria o re-follow gerar um push novo, e alternar seguir/deixar de
-- seguir viraria um jeito de mandar push repetido para alguém.
--
-- Reexecutável.
-- ============================================================================

-- ─── 0. Diagnóstico (só leitura, opcional) ──────────────────────────────────

-- select user_id, follower_id, count(*) as copias
--   from public.notifications
--  where type = 1
--  group by user_id, follower_id
-- having count(*) > 1
--  order by copias desc;

-- ─── 1. Trava contra duplicata ──────────────────────────────────────────────

create or replace function public.notifications_skip_duplicate_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type = 1 and exists (
    select 1 from public.notifications n
     where n.type = 1
       and n.user_id = new.user_id
       and n.follower_id = new.follower_id
  ) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_skip_duplicate_follow_trg on public.notifications;
create trigger notifications_skip_duplicate_follow_trg
  before insert on public.notifications
  for each row
  when (new.type = 1)
  execute function public.notifications_skip_duplicate_follow();

-- ─── 2. Limpeza do passivo ──────────────────────────────────────────────────
--
-- Mantém a mais recente de cada par (reflete o follow atual). Empate de
-- created_at é desempatado pelo id.

delete from public.notifications n
 using public.notifications keep
 where n.type = 1
   and keep.type = 1
   and keep.user_id = n.user_id
   and keep.follower_id = n.follower_id
   and (keep.created_at, keep.id) > (n.created_at, n.id);

-- ─── 3. Índice de apoio ─────────────────────────────────────────────────────

create index if not exists notifications_follow_pair_idx
  on public.notifications (user_id, follower_id)
  where type = 1;
