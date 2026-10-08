-- ============================================================
-- Migration: conta com exclusão agendada some para TODOS (2026-10-06)
--
-- Sintoma: a conta pediu exclusão (aviso de 30 dias), mas posts, flows,
-- incentivos e comentários dela continuavam aparecendo.
--
-- Conferido no banco: a quarentena JÁ funcionava para usuário comum — um
-- cliente sem login enxergava 169 de 170 posts e 117 de 118 flows (o que faltava
-- era justamente o da conta). O que vazava:
--
--   1. ADMIN via tudo. As ~20 policies restritivas de 20261001-hide-banned-users
--      têm a forma "esconde quem está em banned_user_ids() … OU quem olha é
--      admin" (`viewer_sees_banned()`). A exclusão agendada (20261005) entrou
--      em `banned_user_ids()` e herdou essa exceção. Para BANIDO ela é
--      proposital (moderar); para quem pediu para sair não há o que moderar —
--      e quem testa o app pela conta admin achava que a quarentena não existia.
--   2. Tabelas sem esconderijo: desafios de treino (quem desafiou / quem foi
--      desafiado), resultados de desafio e o anfitrião de "treinar junto".
--
-- O que muda:
--   • `hidden_user_ids()` — quem está escondido PARA QUEM OLHA: exclusão
--     agendada sempre; banido só para quem não é admin.
--   • Todas as policies de esconder/barrar são recriadas com essa função, sem a
--     exceção de admin (os mesmos nomes — substituem as antigas).
--   • `profiles`: banido segue visível ao admin; exclusão agendada, não.
--   • `banned_user_ids()` NÃO muda (as RPCs SECURITY DEFINER que filtram por ela
--     — contagens do perfil, "mais seguidos", lembretes — já escondiam a
--     quarentena de todo mundo).
--
-- Reativar a conta (`cancel_account_deletion`) tira o pedido de `pending` e tudo
-- volta a aparecer na hora — nada é apagado aqui.
--
-- Não exige build novo. Idempotente.
-- ============================================================

-- ─── 1. Quem está escondido para quem olha ──────────────────────────────────

create or replace function public.hidden_user_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct x.user_id), '{}'::uuid[])
    from (
      -- Exclusão agendada: para TODOS, admin incluso.
      select r.user_id
        from public.account_deletion_requests r
       where r.status = 'pending' and r.user_id is not null
      union all
      -- Banido: some para todos MENOS o admin (moderação).
      select p.user_id
        from public.profiles p
       where p.is_banned = true
         and not coalesce(public.is_app_admin(auth.uid()), false)
    ) x;
$$;

revoke all on function public.hidden_user_ids() from public;
grant execute on function public.hidden_user_ids() to anon, authenticated;

-- ─── 2. profiles ────────────────────────────────────────────────────────────

do $$
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public' and c.relname = 'profiles' and c.relrowsecurity) then
    execute 'drop policy if exists "profiles_hide_banned" on public.profiles';
    execute $p$
      create policy "profiles_hide_banned"
        on public.profiles
        as restrictive
        for select
        using (
          (
            (is_banned is not true or (select public.viewer_sees_banned()))
            and not (user_id = any ((select public.pending_deletion_user_ids())::uuid[]))
          )
          or user_id = (select auth.uid())
        )
    $p$;
  else
    raise notice 'profiles: RLS desligada — conta escondida continua visível';
  end if;
end $$;

-- ─── 3. Demais tabelas: esconder (SELECT) e barrar (INSERT) ─────────────────
--
-- Mesmas listas de 20261001-hide-banned-users + o que faltava (marcado NOVO).
-- Mesmos nomes de policy: cada uma substitui a antiga.

do $$
declare
  v_target text;
  v_tbl    text;
  v_col    text;
  v_name   text;
  v_hide text[] := array[
    'posts.user_id',
    'posts.reposted_from_user',
    'flow.user_id',
    'flow.reposted_from_user',
    'shots.user_id',
    'comments.user_id',
    'flow_comments.user_id',
    'shots_comments.user_id',
    'likes.user_id',
    'shots_likes.user_id',
    'flow_likes.user_id',
    'following.user_id',
    'following.following_id',
    'followers.user_id',
    'followers.follower_id',
    'messages.user_id',
    'messages.following_id',
    'post_tags.user_id',
    'flow_tags.user_id',
    'notifications.follower_id',
    'check_ins.user_id',
    'duel_check_ins.user_id',
    'duel_group_participants.user_id',
    'ranking.user_id',
    'workout_party_members.user_id',
    'workout_parties.host_id',               -- NOVO: convite/party de quem saiu
    'workout_challenges.challenger_id',      -- NOVO: desafio enviado por quem saiu
    'workout_challenges.challenged_id',      -- NOVO: desafio enviado A quem saiu
    'workout_challenge_results.user_id'      -- NOVO: números de quem saiu
  ];
  v_block_insert text[] := array[
    'following.following_id',
    'followers.user_id',
    'messages.following_id',
    'post_tags.user_id',
    'flow_tags.user_id',
    'duel_group_participants.user_id',
    'workout_party_members.user_id',
    'workout_challenges.challenged_id'       -- NOVO: desafiar quem saiu
  ];
begin
  foreach v_target in array v_hide || v_block_insert loop
    v_tbl := split_part(v_target, '.', 1);
    v_col := split_part(v_target, '.', 2);
    if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                    where n.nspname = 'public' and c.relname = v_tbl and c.relkind = 'r') then
      raise notice '% : tabela não existe — pulada', v_tbl;
    elsif not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                       where n.nspname = 'public' and c.relname = v_tbl and c.relrowsecurity) then
      raise notice '% : RLS desligada — pulada (conta escondida continua visível aqui)', v_tbl;
    elsif not exists (select 1 from information_schema.columns
                       where table_schema = 'public' and table_name = v_tbl and column_name = v_col) then
      raise notice '%.% : coluna não existe — pulada', v_tbl, v_col;
    end if;
  end loop;

  -- SELECT
  foreach v_target in array v_hide loop
    v_tbl := split_part(v_target, '.', 1);
    v_col := split_part(v_target, '.', 2);
    if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                    where n.nspname = 'public' and c.relname = v_tbl and c.relkind = 'r' and c.relrowsecurity)
       or not exists (select 1 from information_schema.columns
                       where table_schema = 'public' and table_name = v_tbl and column_name = v_col) then
      continue;
    end if;
    v_name := left(v_tbl || '_hide_banned_' || v_col, 63);
    execute format('drop policy if exists %I on public.%I', v_name, v_tbl);
    execute format(
      'create policy %I on public.%I as restrictive for select using (
         %I is null
         or not (%I::text = any ((select public.hidden_user_ids())::text[]))
       )',
      v_name, v_tbl, v_col, v_col);
  end loop;

  -- INSERT
  foreach v_target in array v_block_insert loop
    v_tbl := split_part(v_target, '.', 1);
    v_col := split_part(v_target, '.', 2);
    if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                    where n.nspname = 'public' and c.relname = v_tbl and c.relkind = 'r' and c.relrowsecurity)
       or not exists (select 1 from information_schema.columns
                       where table_schema = 'public' and table_name = v_tbl and column_name = v_col) then
      continue;
    end if;
    v_name := left(v_tbl || '_no_banned_' || v_col, 63);
    execute format('drop policy if exists %I on public.%I', v_name, v_tbl);
    execute format(
      'create policy %I on public.%I as restrictive for insert with check (
         %I is null
         or not (%I::text = any ((select public.hidden_user_ids())::text[]))
       )',
      v_name, v_tbl, v_col, v_col);
  end loop;
end $$;

-- ─── 4. post_reposts (policy própria, de 20261005-post-reposts-shared) ──────

do $$
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public' and c.relname = 'post_reposts' and c.relrowsecurity) then
    execute 'drop policy if exists "post_reposts_hide_banned_user_id" on public.post_reposts';
    execute $p$
      create policy "post_reposts_hide_banned_user_id"
        on public.post_reposts
        as restrictive
        for select
        using (
          not (user_id::text = any ((select public.hidden_user_ids())::text[]))
          or user_id = (select auth.uid())
        )
    $p$;
  end if;
end $$;

-- ─── Conferência ────────────────────────────────────────────────────────────
--
-- Nenhuma policy de esconder deve citar mais viewer_sees_banned (só profiles):
--   select tablename, policyname from pg_policies
--    where policyname like '%banned%' and qual not like '%hidden_user_ids%'
--      and tablename <> 'profiles';                       -- 0 linhas
--
-- Logado como admin, a conta com exclusão agendada não aparece:
--   select count(*) from posts where user_id = '<id da conta>';   -- 0
