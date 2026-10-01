-- ============================================================================
-- Migration: 20261001 — usuário banido some do app para todo mundo
--
-- ⚠️ Rodar DEPOIS de `20260811-admin-ban-user.sql` (coluna `profiles.is_banned`)
--    e de `20260930-official-is-admin.sql` (`is_app_admin`). Reexecutável.
--
-- PROBLEMA
--   O ban derrubava só a sessão do banido. Para os OUTROS ele continuava vivo:
--   perfil na busca, posts e flows no feed, comentários, dava para seguir,
--   mandar mensagem, marcar em post…
--
-- POR QUE NO BANCO (e não tela por tela)
--   São dezenas de leituras espalhadas pelo app (feed, busca, perfil, menções,
--   listas de seguidores, comentários, curtidas, DMs, notificações, duelos…).
--   Um filtro por tela deixaria sempre uma esquecida — e não impede ninguém de
--   chamar a API direto. Mesmo raciocínio do bloqueio (20260826).
--
-- COMO
--   Políticas RLS **RESTRICTIVE**: o Postgres faz AND delas com as policies
--   permissivas que já existem, então nada do que está lá é reescrito — só se
--   acrescenta "e o dono da linha não está banido".
--
--     • SELECT  → linhas de/para banido somem para todo mundo (inclusive anon:
--                 a prévia de link compartilhado lê com a anon key).
--     • INSERT  → não dá para seguir, mandar DM, marcar ou convidar um banido.
--
--   Exceções, em todas: o ADMIN vê tudo (precisa abrir o perfil do banido no
--   painel para decidir o desban) e o próprio banido vê o próprio perfil (a
--   BannedScreen depende disso).
--
--   É reversível sem perda: desbanir faz tudo reaparecer — follows, posts,
--   conversas. Nada é apagado.
--
-- SEGURANÇA DA APLICAÇÃO
--   O bloco que cria as policies PULA (com NOTICE) tabela que não existe,
--   coluna que não existe e tabela com RLS DESLIGADA — ligar RLS numa tabela sem
--   policies permissivas bloquearia tudo, então isto nunca liga RLS sozinho.
--   Confira as NOTICEs na saída: tabela pulada = banido ainda aparece ali.
--
-- DESEMPENHO
--   A lista de banidos vem de UMA função (`banned_user_ids`) chamada dentro de
--   `(select …)`: o planner roda uma vez por query (initplan), não por linha.
--   Índice parcial em `profiles` deixa essa leitura instantânea.
--
--   ⚠️ O CAST em `(select …)::text[]` é obrigatório. Sem ele,
--   `col = any ((select …))` é lido como a forma de SUBCONSULTA do ANY e o
--   Postgres compara cada uuid com o array inteiro (`42883: uuid = uuid[]`).
--   Comparar como texto também protege das divergências de tipo do schema
--   (coluna de pessoa gravada como text em alguma tabela).
--
-- Rodar no SQL Editor do Supabase.
-- ============================================================================

-- ─── 1. Helpers ─────────────────────────────────────────────────────────────

create index if not exists profiles_banned_idx
  on public.profiles (user_id) where is_banned = true;

-- SECURITY DEFINER: lê `profiles` sem passar pela RLS de `profiles` (que vai
-- ganhar a própria policy abaixo — sem isto, recursão).
create or replace function public.banned_user_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(p.user_id), '{}'::uuid[])
    from public.profiles p
   where p.is_banned = true;
$$;

revoke all on function public.banned_user_ids() from public;
grant execute on function public.banned_user_ids() to anon, authenticated;

-- Admin enxerga banidos. `coalesce` porque anon não tem uid.
create or replace function public.viewer_sees_banned()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.is_app_admin(auth.uid()), false);
$$;

revoke all on function public.viewer_sees_banned() from public;
grant execute on function public.viewer_sees_banned() to anon, authenticated;

-- ─── 2. profiles ────────────────────────────────────────────────────────────
-- Coluna direta, sem função: é a tabela mais lida do app.

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
          is_banned is not true
          or user_id = (select auth.uid())
          or (select public.viewer_sees_banned())
        )
    $p$;
  else
    raise notice 'profiles: RLS desligada — perfil de banido continua visível';
  end if;
end $$;

-- ─── 3. Demais tabelas: esconder (SELECT) e barrar (INSERT) ─────────────────
--
-- 'tabela.coluna' = a coluna que aponta para uma PESSOA. Mais de uma coluna na
-- mesma tabela vira mais de uma policy (todas em AND).

do $$
declare
  v_target text;
  v_tbl    text;
  v_col    text;
  v_name   text;
  -- Linha some se QUALQUER uma destas pessoas estiver banida.
  v_hide text[] := array[
    'posts.user_id',              -- feed, perfil, descobrir
    'posts.reposted_from_user',   -- repost de um post de banido
    'flow.user_id',               -- ring de flows
    'flow.reposted_from_user',
    'shots.user_id',
    'comments.user_id',
    'flow_comments.user_id',
    'shots_comments.user_id',
    'likes.user_id',              -- lista de quem incentivou
    'shots_likes.user_id',
    'flow_likes.user_id',
    'following.user_id',          -- listas de seguidores/seguindo (os 2 lados)
    'following.following_id',
    'followers.user_id',
    'followers.follower_id',
    'messages.user_id',           -- conversa some (os 2 lados)
    'messages.following_id',
    'post_tags.user_id',          -- marcação de banido não aparece
    'flow_tags.user_id',
    'notifications.follower_id',  -- notificação originada por banido
    'check_ins.user_id',
    'duel_check_ins.user_id',
    'duel_group_participants.user_id',
    'ranking.user_id',
    'workout_party_members.user_id'
  ];
  -- Não se cria vínculo NOVO com um banido.
  v_block_insert text[] := array[
    'following.following_id',     -- seguir
    'followers.user_id',
    'messages.following_id',      -- mandar DM
    'post_tags.user_id',          -- marcar em post
    'flow_tags.user_id',          -- marcar em flow
    'duel_group_participants.user_id', -- convidar para duelo
    'workout_party_members.user_id'    -- convidar para treinar junto
  ];
  v_ok boolean;
begin
  -- Diagnóstico: avisa (NOTICE) o que vai ficar de fora e por quê.
  foreach v_target in array v_hide || v_block_insert loop
    v_tbl := split_part(v_target, '.', 1);
    v_col := split_part(v_target, '.', 2);

    select c.relrowsecurity
      into v_ok
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = v_tbl and c.relkind = 'r';

    if v_ok is null then
      raise notice '% : tabela não existe — pulada', v_tbl;
      continue;
    elsif not v_ok then
      raise notice '% : RLS desligada — pulada (banido continua visível aqui)', v_tbl;
      continue;
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
         or not (%I::text = any ((select public.banned_user_ids())::text[]))
         or (select public.viewer_sees_banned())
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
         or not (%I::text = any ((select public.banned_user_ids())::text[]))
         or (select public.viewer_sees_banned())
       )',
      v_name, v_tbl, v_col, v_col);
  end loop;
end $$;

-- ─── 4. Contagens do perfil sem banidos ─────────────────────────────────────
-- `get_profile_counts` é SECURITY DEFINER (ignora RLS), então as policies acima
-- não alcançam as contagens: um banido continuaria somando em "seguidores".
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

-- ─── Conferência ────────────────────────────────────────────────────────────
--
-- Policies criadas (deve listar profiles_hide_banned + *_hide_banned_* + *_no_banned_*):
--
--   select tablename, policyname, cmd, permissive
--     from pg_policies
--    where policyname like '%banned%'
--    order by tablename, policyname;
--
-- `permissive` tem que vir 'RESTRICTIVE' em todas.
