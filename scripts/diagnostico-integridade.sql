-- ============================================================================
-- Diagnóstico de integridade do banco (SÓ LEITURA)
--
-- Cole inteiro no SQL Editor do Supabase e rode. Nada é alterado: tudo vai
-- para uma tabela TEMPORÁRIA, e o resultado sai num único SELECT no final.
-- Checagem que falhar (tabela/coluna que não existe) vira uma linha "erro"
-- em vez de derrubar o script.
--
-- Colunas do resultado:
--   secao     — 1 contagem, 2 duplicata exata, 3 duplicata de chave,
--               4 usuário inexistente, 5 conteúdo inexistente, 6 regras
--   tabela    — onde o problema está
--   problema  — o que foi checado
--   qtd       — linhas afetadas (seções 2–6 só aparecem quando qtd > 0)
--
-- Pode demorar em tabelas grandes (notifications, screen_time_logs).
-- ============================================================================

set statement_timeout = '10min';

drop table if exists pg_temp.diag;
create temp table diag (
  secao    int,
  tabela   text,
  problema text,
  qtd      bigint
);

do $$
declare
  r   record;
  n   bigint;
begin
  -- ─── 1. Contagem de linhas por tabela ─────────────────────────────────────
  for r in
    select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
     order by table_name
  loop
    execute format('select count(*) from public.%I', r.table_name) into n;
    insert into diag values (1, r.table_name, 'linhas', n);
  end loop;

  -- ─── 2. Duplicata exata ───────────────────────────────────────────────────
  -- Linhas idênticas em TODAS as colunas, menos id e timestamps. É o sintoma
  -- clássico de "insert sem trava" (foi o caso do followers).
  for r in
    select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
     order by table_name
  loop
    begin
      execute format($q$
        select coalesce(sum(c - 1), 0) from (
          select count(*) c
            from public.%I t
           group by (to_jsonb(t) - 'id' - 'created_at' - 'updated_at' - 'joined_at')
          having count(*) > 1
        ) s$q$, r.table_name) into n;
      if n > 0 then
        insert into diag values (2, r.table_name,
          'linhas repetidas (iguais fora id/created_at/updated_at) — a apagar', n);
      end if;
    exception when others then
      insert into diag values (2, r.table_name, 'erro: ' || sqlerrm, null);
    end;
  end loop;

  -- ─── 3. Duplicata de chave ────────────────────────────────────────────────
  -- Pares que deveriam ser únicos. Aqui o resto da linha pode diferir (ex.:
  -- created_at), então pega o que a seção 2 deixa passar.
  for r in
    select * from (values
      ('following',               'user_id, following_id'),
      ('followers',               'user_id, follower_id'),
      ('user_blocks',             'blocker_id, blocked_id'),
      ('likes',                   'user_id, post_id, type'),
      ('shots_likes',             'user_id, shots_id, type'),
      ('flow_likes',              'user_id, flow_id, type'),
      ('promotion_likes',         'user_id, promotion_id'),
      ('post_tags',               'post_id, user_id'),
      ('flow_tags',               'flow_id, user_id'),
      ('duel_group_participants', 'group_id, user_id'),
      ('shot_user_viewed',        'user_id, shot_id'),
      ('flow_user_viewed',        'user_id, flow_id'),
      ('profiles',                'user_id'),
      ('ranking',                 'user_id'),
      ('user_nutrition_goals',    'user_id'),
      ('subscriptions',           'user_id'),
      ('app_admins',              'user_id')
    ) as v(tabela, chave)
  loop
    begin
      execute format($q$
        select coalesce(sum(c - 1), 0) from (
          select count(*) c from public.%I group by %s having count(*) > 1
        ) s$q$, r.tabela, r.chave) into n;
      if n > 0 then
        insert into diag values (3, r.tabela, 'chave repetida (' || r.chave || ') — linhas extras', n);
      end if;
    exception when others then
      insert into diag values (3, r.tabela, 'erro: ' || sqlerrm, null);
    end;
  end loop;

  -- ─── 4. Referência a usuário que não existe mais em auth.users ────────────
  -- Resto de conta excluída antes da RPC delete_user_data, ou default
  -- gen_random_uuid() que ninguém sobrescreveu.
  for r in
    select c.table_name, c.column_name
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name
     where c.table_schema = 'public'
       and t.table_type = 'BASE TABLE'
       and c.data_type = 'uuid'
       and c.column_name in (
         'user_id', 'follower_id', 'following_id', 'blocker_id', 'blocked_id',
         'sender_id', 'receiver_id', 'recipient_id', 'created_by', 'owner_id',
         'author_id', 'reporter_id', 'reported_user_id', 'reported_id',
         'invited_user_id', 'inviter_id', 'host_id', 'voter_id', 'granted_by'
       )
     order by 1, 2
  loop
    begin
      execute format($q$
        select count(*) from public.%1$I x
         where x.%2$I is not null
           and not exists (select 1 from auth.users u where u.id = x.%2$I)
      $q$, r.table_name, r.column_name) into n;
      if n > 0 then
        insert into diag values (4, r.table_name, r.column_name || ' aponta para usuário inexistente', n);
      end if;
    exception when others then
      insert into diag values (4, r.table_name, 'erro em ' || r.column_name || ': ' || sqlerrm, null);
    end;
  end loop;

  -- ─── 5. Referência a conteúdo que não existe mais ─────────────────────────
  -- Curtida/comentário/marcação de post, shot ou flow já apagado. Compara via
  -- ::text porque há colunas com tipo divergente do pai (flow_likes.flow_id é
  -- smallint, flow.id é bigint). notifications.post_id fica de fora: ele
  -- também guarda id de duelo e de promoção.
  for r in
    select c.table_name, c.column_name, v.pai
      from (values
        ('post_id',          'posts'),
        ('shots_id',         'shots'),
        ('shot_id',          'shots'),
        ('flow_id',          'flow'),
        ('promotion_id',     'promotions'),
        ('group_id',         'duel_groups'),
        ('duel_group_id',    'duel_groups'),
        ('duel_check_in_id', 'duel_check_ins'),
        ('routine_id',       'routines'),
        ('goal_id',          'goals'),
        ('custom_goal_id',   'user_custom_goals'),
        ('habit_id',         'habits'),
        ('diet_id',          'diets'),
        ('workout_id',       'workouts')
      ) as v(coluna, pai)
      join information_schema.columns c
        on c.table_schema = 'public' and c.column_name = v.coluna
      join information_schema.tables t
        on t.table_schema = 'public' and t.table_name = c.table_name
       and t.table_type = 'BASE TABLE'
     where c.table_name <> v.pai
       and not (c.table_name = 'notifications' and c.column_name = 'post_id')
       -- routines.goal_id guarda goal_id OU custom_goal_id (20260925-user-custom-goals)
       and not (c.table_name = 'routines' and c.column_name = 'goal_id')
       -- workout_id pode estar em workouts OU user_custom_workouts (20260925-user-custom-workouts);
       -- checado na seção 6
       and not (c.column_name = 'workout_id'
                and c.table_name in ('user_workouts', 'user_workouts_hist', 'training_day_exercises'))
     order by 1, 2
  loop
    begin
      execute format($q$
        select count(*) from public.%1$I x
         where x.%2$I is not null
           and not exists (select 1 from public.%3$I p where p.id::text = x.%2$I::text)
      $q$, r.table_name, r.column_name, r.pai) into n;
      if n > 0 then
        insert into diag values (5, r.table_name, r.column_name || ' aponta para ' || r.pai || ' inexistente', n);
      end if;
    exception when others then
      insert into diag values (5, r.table_name, 'erro em ' || r.column_name || ': ' || sqlerrm, null);
    end;
  end loop;

  -- ─── 6. Regras de negócio ─────────────────────────────────────────────────
  for r in
    select * from (values
      ('following',     'segue a si mesmo',
       'select count(*) from public.following where user_id = following_id'),
      ('user_blocks',   'bloqueou a si mesmo',
       'select count(*) from public.user_blocks where blocker_id = blocked_id'),
      ('following',     'follow sem espelho em followers',
       'select count(*) from public.following g where not exists (select 1 from public.followers f where f.user_id = g.following_id and f.follower_id = g.user_id)'),
      ('followers',     'espelho órfão (unfollow não refletido)',
       'select count(*) from public.followers f where not exists (select 1 from public.following g where g.user_id = f.follower_id and g.following_id = f.user_id)'),
      ('following',     'follow entre usuários bloqueados',
       'select count(*) from public.following g join public.user_blocks b on (b.blocker_id = g.user_id and b.blocked_id = g.following_id) or (b.blocker_id = g.following_id and b.blocked_id = g.user_id)'),
      ('notifications', 'notificação para si mesmo',
       'select count(*) from public.notifications where user_id = follower_id'),
      ('notifications', 'type 1 repetida (mesmo seguidor → mesmo usuário)',
       'select coalesce(sum(c - 1), 0) from (select count(*) c from public.notifications where type = 1 group by user_id, follower_id having count(*) > 1) s'),
      ('notifications', 'type 1 de quem já não segue mais',
       'select count(*) from public.notifications n where n.type = 1 and not exists (select 1 from public.following g where g.user_id = n.follower_id and g.following_id = n.user_id)'),
      ('notifications', 'type 2 repetida (mesmo incentivo, mesmo post)',
       'select coalesce(sum(c - 1), 0) from (select count(*) c from public.notifications where type = 2 and post_id is not null group by user_id, follower_id, post_id, incentive_type having count(*) > 1) s'),
      ('notifications', 'type 7 repetida (reação no mesmo check-in)',
       'select coalesce(sum(c - 1), 0) from (select count(*) c from public.notifications where type = 7 group by user_id, follower_id, duel_check_in_id having count(*) > 1) s'),
      ('auth.users',    'usuário sem profile',
       'select count(*) from auth.users u where not exists (select 1 from public.profiles p where p.user_id = u.id)'),
      ('profiles',      'handle repetido (ignorando maiúsculas)',
       'select coalesce(sum(c - 1), 0) from (select count(*) c from public.profiles where handle is not null and handle <> '''' group by lower(handle) having count(*) > 1) s'),
      ('profiles',      'handle ainda com @',
       'select count(*) from public.profiles where handle like ''@%'''),
      ('flow_likes',    'flow_id perto do limite do smallint (32767)',
       'select count(*) from public.flow where id > 30000'),
      ('shots_likes',   'shots_id perto do limite do smallint (32767)',
       'select count(*) from public.shots where id::text ~ ''^\d+$'' and id::text::bigint > 30000'),
      ('goals',         'meta personalizada ainda no catálogo',
       'select count(*) from public.goals where created_by_user = 1'),
      ('workouts',      'exercício personalizado ainda no catálogo (rodar move_custom_workouts_out_of_catalog)',
       'select count(*) from public.workouts where created_by_user = true'),
      ('user_workouts', 'workout_id sem exercício em workouts nem em user_custom_workouts',
       'select count(*) from public.user_workouts x where not exists (select 1 from public.workouts w where w.id = x.workout_id) and not exists (select 1 from public.user_custom_workouts c where c.id = x.workout_id)'),
      ('user_workouts_hist', 'workout_id sem exercício em workouts nem em user_custom_workouts',
       'select count(*) from public.user_workouts_hist x where x.workout_id is not null and not exists (select 1 from public.workouts w where w.id = x.workout_id) and not exists (select 1 from public.user_custom_workouts c where c.id = x.workout_id)'),
      ('routines',      'goal_id sem meta em goals nem em user_custom_goals',
       'select count(*) from public.routines r where r.goal_id is not null and not exists (select 1 from public.goals g where g.id = r.goal_id) and not exists (select 1 from public.user_custom_goals c where c.id = r.goal_id)')
    ) as v(tabela, problema, sql)
  loop
    begin
      execute r.sql into n;
      if n > 0 then
        insert into diag values (6, r.tabela, r.problema, n);
      end if;
    exception when others then
      insert into diag values (6, r.tabela, r.problema || ' — erro: ' || sqlerrm, null);
    end;
  end loop;
end $$;

-- Problemas primeiro (maior quantidade no topo), contagem geral no fim.
select secao, tabela, problema, qtd
  from diag
 order by (secao = 1), secao, qtd desc nulls last, tabela;
