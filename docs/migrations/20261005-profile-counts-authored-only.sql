-- ============================================================================
-- Migration: 20261005 — total de posts do perfil volta a ser só os autorais
--
-- `20261005-post-reposts-shared.sql` (seção 7) fez o total de posts do perfil
-- somar os reposts, porque a aba Publicações passou a mostrar os posts
-- repostados. Pedido do usuário em 2026-10-05: o post repostado fica SÓ na aba
-- Marcações (só quem está marcado pode repostar, então ele já está lá). O app
-- tirou o repost de Publicações (`getUserPostsDb`), e o número precisa bater.
--
-- O repost continua levando o post ao feed de quem segue quem repostou — isso
-- é o `post.service`, não muda nada aqui.
--
-- Pré-requisito: 20261001-hide-banned-users.sql (usa `banned_user_ids()`). Se
-- `20261005-post-reposts-shared.sql` ainda não rodou, rode-a antes: a versão
-- dela também já está corrigida, mas esta deixa o resultado final explícito.
--
-- Reexecutável. Supabase SQL Editor. Sem redeploy de edge function.
-- ============================================================================

create or replace function public.get_profile_counts(target uuid)
returns table (posts_count bigint, followers_count bigint, following_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  with banned as (select public.banned_user_ids() as ids)
  select
    (select count(*) from public.posts p where p.user_id = target),
    (select count(*) from public.following f, banned b
      where f.following_id = target and not (f.user_id = any (b.ids))),
    (select count(*) from public.following f, banned b
      where f.user_id = target and not (f.following_id = any (b.ids)));
$$;

grant execute on function public.get_profile_counts(uuid) to authenticated, anon;

-- Conferência (troque o uuid):
--   select * from public.get_profile_counts('00000000-0000-0000-0000-000000000000');
