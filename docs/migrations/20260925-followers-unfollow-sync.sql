-- ============================================================================
-- Migration: 20260925 — deixar de seguir apaga também de `followers`
--
-- ⚠️ OBRIGATÓRIA. Rodar DEPOIS de `20260925-followers-dedupe.sql` (ou só esta:
-- ela repete a limpeza antes de criar o índice único).
--
-- O BUG:
--   O app só escreve em `public.following` (`followUserDb` / `unfollowUserDb`).
--   A linha de `public.followers` é criada por um trigger de ESPELHO que só
--   existe no banco (não está versionado). Esse trigger cobre o INSERT, mas nada
--   cobre o DELETE. Por isso, seguir → deixar de seguir → seguir de novo deixava
--   uma linha nova em `followers` a cada ciclo, sem apagar nenhuma. A tabela só
--   crescia.
--
--   Efeitos visíveis: o "Top usuários mais seguidos" do Admin
--   (`20260511-admin-analytics-extended.sql`) conta `followers` e inflava;
--   e cada ciclo disparava `trigger_notify_follow` de novo (notificação type 1).
--
-- O QUE ESTA MIGRAÇÃO FAZ:
--   1. trigger AFTER DELETE em `following` → apaga o espelho em `followers`;
--   2. trigger BEFORE INSERT em `followers` → ignora o insert se o par já
--      existe (o espelho de INSERT fica idempotente, seja ele qual for);
--   3. limpa duplicatas e órfãs já existentes;
--   4. índice único (user_id, follower_id) como trava final.
--
-- Reexecutável.
-- ============================================================================

-- ─── 1. Espelho do DELETE ───────────────────────────────────────────────────
--
-- SECURITY DEFINER porque a policy `followers_delete_own` só deixa o próprio
-- seguidor apagar. Um DELETE em `following` feito por outro caminho (o trigger
-- de bloqueio, a exclusão de conta) também precisa refletir aqui.

create or replace function public.following_mirror_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Só apaga o espelho se não sobrou outra linha do mesmo par em `following`
  -- (a limpeza de duplicatas de 20260925-following-dedupe apaga cópias, não
  -- o follow).
  if not exists (
    select 1 from public.following
     where user_id = old.user_id
       and following_id = old.following_id
  ) then
    delete from public.followers
     where user_id = old.following_id
       and follower_id = old.user_id;
  end if;
  return old;
end;
$$;

drop trigger if exists following_mirror_delete_trg on public.following;
create trigger following_mirror_delete_trg
  after delete on public.following
  for each row execute function public.following_mirror_delete();

-- ─── 2. Insert idempotente em `followers` ───────────────────────────────────
--
-- Retornar NULL num BEFORE INSERT descarta a linha em silêncio: sem erro para
-- quem inseriu (o espelho não quebra o INSERT em `following`) e sem disparar
-- `trigger_notify_follow`, que é AFTER INSERT.

create or replace function public.followers_skip_duplicate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.followers
     where user_id = new.user_id
       and follower_id = new.follower_id
  ) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists followers_skip_duplicate_trg on public.followers;
create trigger followers_skip_duplicate_trg
  before insert on public.followers
  for each row execute function public.followers_skip_duplicate();

-- ─── 3. Limpeza do passivo ──────────────────────────────────────────────────

-- Duplicatas: mantém a linha mais antiga de cada par.
delete from public.followers f
 using public.followers keep
 where keep.user_id = f.user_id
   and keep.follower_id is not distinct from f.follower_id
   and keep.id < f.id;

-- Órfãs: unfollows que aconteceram antes deste trigger existir.
delete from public.followers f
 where not exists (
   select 1 from public.following g
    where g.user_id = f.follower_id
      and g.following_id = f.user_id
 );

-- ─── 4. Trava final ─────────────────────────────────────────────────────────

create unique index if not exists followers_user_follower_uniq
  on public.followers (user_id, follower_id);
