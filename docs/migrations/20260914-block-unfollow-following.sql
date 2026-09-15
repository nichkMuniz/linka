-- ============================================================================
-- Migration: 20260914 — bloquear desfaz o follow na tabela CERTA (`following`)
--
-- ⚠️ OBRIGATÓRIA. Rodar DEPOIS de `20260826-user-blocks.sql`.
--
-- O BUG:
--   `user_blocks_unfollow()` (20260826) apagava o follow apenas de
--   `public.followers`. Só que o app NUNCA lê essa tabela — todo o produto
--   trabalha em `public.following`:
--
--     getFollowingIdsDb()   → following.user_id      (feed "Seguindo" + ring de flows)
--     getFollowersDb()      → following.following_id (lista de seguidores)
--     getFollowingDb()      → following.user_id      (lista de seguindo)
--     isFollowingDb()       → following              (botão Seguir/Seguindo)
--     get_profile_counts()  → following (as duas contagens)
--
--   `followers` é uma tabela espelho herdada, que o cliente sequer escreve
--   (`followUserDb` insere só em `following`). Resultado: bloquear alguém
--   parecia não fazer nada — a pessoa continuava no ring de flows do feed e
--   nas contagens, ainda marcada como seguida. O filtro de bloqueio em
--   `getFeedPosts` escondia os POSTS, o que mascarou o problema: os posts
--   sumiam, o vínculo não.
--
-- O QUE ESTA MIGRAÇÃO FAZ:
--   1. reescreve o trigger para apagar das DUAS tabelas, nos dois sentidos;
--   2. limpa o passivo — os follows que sobreviveram a bloqueios já feitos.
--
-- Reexecutável.
-- ============================================================================

-- ─── 1. Trigger corrigido ───────────────────────────────────────────────────
--
-- `followers` continua no delete de propósito: é barato, é idempotente, e
-- enquanto a tabela existir não vale a pena deixar as duas fora de sincronia.
-- Os dois sentidos saem porque o bloqueio é simétrico na leitura (ver o
-- cabeçalho de 20260826): se só o lado de quem bloqueou fosse desfeito, o
-- bloqueado continuaria com a pessoa na própria lista de "Seguindo".

create or replace function public.user_blocks_unfollow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- A tabela que o app realmente lê.
  delete from public.following
   where (user_id = new.blocker_id and following_id = new.blocked_id)
      or (user_id = new.blocked_id and following_id = new.blocker_id);

  -- Espelho legado, mantido em sincronia.
  begin
    delete from public.followers
     where (follower_id = new.blocker_id and user_id = new.blocked_id)
        or (follower_id = new.blocked_id and user_id = new.blocker_id);
  exception
    when undefined_table or undefined_column then null;
  end;

  return new;
end;
$$;

-- O trigger em si não mudou de assinatura, mas recriar aqui torna a migração
-- autossuficiente caso ela seja aplicada num banco onde o `create trigger` de
-- 20260826 não chegou a rodar.
drop trigger if exists user_blocks_unfollow_trg on public.user_blocks;
create trigger user_blocks_unfollow_trg
  after insert on public.user_blocks
  for each row execute function public.user_blocks_unfollow();

-- ─── 2. Backfill: follows que sobreviveram a bloqueios anteriores ───────────
--
-- Todo bloqueio feito antes desta migração deixou a linha de `following` para
-- trás. Sem esta limpeza, o usuário precisaria desbloquear e bloquear de novo
-- para o vínculo sumir.

delete from public.following f
 where exists (
   select 1
     from public.user_blocks b
    where (b.blocker_id = f.user_id and b.blocked_id = f.following_id)
       or (b.blocker_id = f.following_id and b.blocked_id = f.user_id)
 );

delete from public.followers f
 where exists (
   select 1
     from public.user_blocks b
    where (b.blocker_id = f.follower_id and b.blocked_id = f.user_id)
       or (b.blocker_id = f.user_id and b.blocked_id = f.follower_id)
 );
