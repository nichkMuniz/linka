-- ============================================================================
-- Migration: 20260925 — `following` sem follow duplicado
--
-- ⚠️ OBRIGATÓRIA. Rodar DEPOIS de `20260925-followers-unfollow-sync.sql`
-- (esta redefine `following_mirror_delete()` com a mesma guarda, então a
-- ordem inversa também é segura — mas rode as duas).
--
-- O BUG:
--   `followUserDb` faz um INSERT cego em `following`, e a tabela não tinha
--   trava de unicidade. O `FollowButton` nasce como "Seguir" até
--   `isFollowingDb` responder (e esse status fica 30s em cache), então tocar
--   em quem você já segue, ou seguir a mesma pessoa em duas telas, gravava o
--   mesmo par de novo.
--
-- O QUE ESTA MIGRAÇÃO FAZ:
--   1. garante que apagar uma CÓPIA em `following` não derrube o espelho em
--      `followers` (o trigger só apaga se o par sumiu de vez);
--   2. apaga as duplicatas (mantém a linha mais antiga de cada par) e os
--      auto-follows;
--   3. índice único (user_id, following_id) + check contra seguir a si mesmo.
--      Com ele, o insert repetido falha com 23505, que `followUserDb` agora
--      trata como sucesso ("já segue").
--
-- Reexecutável.
-- ============================================================================

-- ─── 0. Diagnóstico (só leitura, opcional) ──────────────────────────────────

-- select user_id, following_id, count(*) as copias, min(id) as id_mantido
--   from public.following
--  group by user_id, following_id
-- having count(*) > 1
--  order by copias desc;

-- ─── 1. Espelho de DELETE com guarda ────────────────────────────────────────

create or replace function public.following_mirror_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

-- ─── 2. Limpeza ─────────────────────────────────────────────────────────────

-- Duplicatas: mantém a linha mais antiga de cada par.
delete from public.following f
 using public.following keep
 where keep.user_id = f.user_id
   and keep.following_id is not distinct from f.following_id
   and keep.id < f.id;

-- Seguir a si mesmo não tem tela que produza, mas se existir é lixo.
delete from public.following
 where user_id = following_id;

-- ─── 3. Travas ──────────────────────────────────────────────────────────────

create unique index if not exists following_user_following_uniq
  on public.following (user_id, following_id);

alter table public.following
  drop constraint if exists following_not_self;
alter table public.following
  add constraint following_not_self check (user_id <> following_id);
