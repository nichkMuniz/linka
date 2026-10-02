-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-10-01 — Perfis mais seguidos (sugestão na lista "Seguindo" vazia)
--
-- Quando o usuário ainda não segue ninguém, a lista "Seguindo" do PRÓPRIO
-- perfil mostra os perfis com mais seguidores, com botão de seguir.
--
-- Por que RPC (SECURITY DEFINER) e não um count no cliente: a RLS de
-- `hide_follow_lists` esconde as linhas de `following` de perfis com listas
-- privadas — contar do cliente daria 0 para eles (mesmo motivo do
-- `get_profile_counts`). Só a CONTAGEM sai daqui, nunca quem segue quem.
--
-- Regras (iguais às do `get_profile_counts`, para o número bater com o perfil):
--   • conta em `following` (a tabela que o app lê), sem seguidores banidos;
--   • fora da lista: o próprio usuário, banidos, quem ele já segue e qualquer
--     par com bloqueio (user_blocks, as duas direções) — função DEFINER passa
--     por cima da RLS restrictive de banidos, então o filtro é feito à mão;
--   • só perfis com pelo menos 1 seguidor; limite 1..30 (padrão 15).
--
-- Sem redeploy de edge function. Rodar no Supabase SQL Editor ANTES do build
-- (sem a função a lista vazia só mostra a mensagem de sempre — não quebra).
-- ─────────────────────────────────────────────────────────────────────────────

-- Índice de apoio (following_id) já existe: 20260702-performance-indexes.sql.

create or replace function public.get_most_followed_profiles(p_limit int default 15)
returns table (user_id uuid, followers_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  with banned as (select public.banned_user_ids() as ids)
  select f.following_id as user_id, count(*) as followers_count
  from public.following f, banned b
  where f.following_id <> auth.uid()
    and not (f.following_id = any (b.ids))
    and not (f.user_id = any (b.ids))
    and not exists (
      select 1 from public.following mine
      where mine.user_id = auth.uid() and mine.following_id = f.following_id
    )
    and not exists (
      select 1 from public.user_blocks ub
      where (ub.blocker_id = auth.uid() and ub.blocked_id = f.following_id)
         or (ub.blocker_id = f.following_id and ub.blocked_id = auth.uid())
    )
  group by f.following_id
  order by count(*) desc, f.following_id
  limit greatest(1, least(coalesce(p_limit, 15), 30));
$$;

revoke all on function public.get_most_followed_profiles(int) from public;
grant execute on function public.get_most_followed_profiles(int) to authenticated;
