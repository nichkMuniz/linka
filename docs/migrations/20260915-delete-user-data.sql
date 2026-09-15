-- ============================================================================
-- Migration: 20260915 — `delete_user_data(uuid)`: excluir conta no servidor
--
-- ⚠️ OBRIGATÓRIA. Sem ela, "Excluir minha conta" falha com a mensagem
--    "Migração 20260915-delete-user-data.sql não aplicada no Supabase".
--
-- ⚠️ SUBSTITUI UMA PROCEDURE DE MESMO NOME. Já existia
--    `delete_user_data` no banco criada como `CREATE PROCEDURE` — e é por isso
--    que ela nunca chegou a rodar: o PostgREST (e portanto `supabase.rpc()`)
--    só expõe FUNCTION, porque chama tudo via `SELECT`. Procedure exige `CALL`,
--    que não existe na REST API. O app nunca conseguiu invocá-la; a exclusão
--    seguia pelo caminho antigo, no cliente, com os defeitos abaixo.
--
--    `create or replace function` sozinho não resolve: o Postgres recusa com
--    `42809: cannot change routine kind`. Por isso o bloco de DROP mais abaixo.
--
--    Antes de aplicar, vale conferir o que a procedure antiga fazia — se ela
--    cobre alguma tabela que não está no `v_targets`, acrescente lá:
--
--      select p.oid::regprocedure as assinatura, p.prokind, p.prosrc
--        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--       where n.nspname = 'public' and p.proname = 'delete_user_data';
--
--    (`prokind`: 'p' = procedure, 'f' = function.)
--
-- POR QUE ISTO EXISTE:
--   `deleteAllUserDataDb` apagava as linhas do usuário com ~45 DELETEs
--   disparados do WebView, um por tabela. Duas falhas estruturais:
--
--   1. DELETE sob RLS é NO-OP SILENCIOSO. Tabela sem policy de DELETE para o
--      dono devolve "0 linhas afetadas" — sem erro. O cliente registrava um
--      `console.error` que ninguém lê no device e seguia em frente, como se
--      tivesse apagado.
--
--   2. A lista ficou para trás. Conferindo o schema real contra o código, 31
--      tabelas com coluna de usuário NUNCA eram tocadas — quase todas criadas
--      depois da função: `post_tags`, `flow_tags`, `user_blocks`,
--      `workout_party_members`, `workout_parties`, `push_tokens`,
--      `user_badges`, `user_weight_logs`, `user_food_logs`, `user_water_logs`,
--      `hydration_logs`, `mood_logs`, `subscriptions`, `promotions` (+ likes,
--      comments, status_reports), `commercial_offers`, `commercial_plans`,
--      `comment_reactions`, `duel_check_in_*`, `message_deletions`,
--      `app_admins`, `user_fitness_*`, `user_nutrition_goals`,
--      `user_training_plans`, `diets/habits/workouts.created_by` e
--      `routines.follower_id`. Toda tabela nova entrava com o mesmo bug: a
--      pessoa "excluía a conta" e seus dados continuavam lá.
--
--   Uma lista mantida à mão no cliente sempre vai ficar para trás. Aqui ela
--   fica ao lado do schema, roda como uma transação só, e `security definer`
--   ignora RLS — o que faz o "0 linhas" virar impossível.
--
-- AUTORIZAÇÃO — a função ignora RLS, então a porta é estreita. São três
--   caminhos legítimos, e só três:
--
--     1. o DONO da conta, pelo app          → `auth.uid() = p_user_id`
--     2. um admin do app, pelo painel       → `is_app_admin(auth.uid())`
--     3. acesso DIRETO ao banco             → SQL Editor, psql, migração
--
--   O caso 3 existe porque o SQL Editor do Supabase não manda JWT: lá
--   `auth.uid()` é NULL e a função respondia `42501: NOT_OWNER` mesmo para
--   quem é dono do projeto. Liberar é seguro e não abre nada: quem já tem
--   conexão direta ao banco pode apagar qualquer linha à mão, então a
--   checagem seria teatro — e o preço dela era o admin não conseguir excluir
--   uma conta manualmente, que é justamente quando isso é mais necessário.
--
--   O que continua barrado: `anon` (JWT sem `sub`) e qualquer usuário
--   autenticado tentando apagar os dados de outra pessoa.
--
-- auth.users — ELA APAGA, quando tem permissão para isso. Como é
--   `security definer`, roda com os privilégios do dono da função (o role que
--   aplicou esta migração, normalmente `postgres`), que alcança o schema
--   `auth`. `auth.sessions`, `auth.identities` e `auth.refresh_tokens` caem
--   por cascade, então o efeito é o mesmo da Admin API.
--
--   Mas o privilégio depende de QUEM aplicou a migração, e isso varia por
--   projeto. Por isso o DELETE fica num bloco que trata `insufficient_privilege`
--   em vez de abortar tudo: o resultado jsonb traz `"auth.users": 1` quando
--   deu certo e **omite a chave** quando não deu. O app usa exatamente esse
--   sinal para decidir se ainda precisa chamar `api/delete-auth-user.ts`
--   (service role, do servidor) — que assim virou fallback, não etapa fixa.
--
-- O QUE ELA NÃO FAZ — mídia no Storage:
--   O Postgres não fala com o Storage. Dá para apagar as linhas de
--   `storage.objects` daqui, e é tentador, mas está ERRADO: o arquivo físico
--   no S3 não vai junto, e sem a linha ele deixa de aparecer em qualquer
--   listagem — vira lixo pago e invisível, que nem o
--   `scripts/sweep-orphan-media.mjs` consegue achar depois. Apagar mídia exige
--   a API do Storage:
--     • no app  → `purgeUserStorageDb`, que roda ANTES (a policy de DELETE do
--                 Storage depende de `auth.uid()`; sem sessão não há posse a
--                 provar);
--     • à mão   → `node scripts/delete-user.mjs <uuid> --apply`, que faz as
--                 duas coisas (Storage + esta função) numa tacada.
-- ============================================================================

-- ─── Remove a rotina antiga, seja qual for o tipo ou a assinatura ───────────
--
-- Um `drop procedure public.delete_user_data(uuid)` escrito à mão quebraria se
-- o parâmetro tivesse outro nome ou outro tipo. Este bloco varre `pg_proc` e
-- derruba tudo que se chame `delete_user_data` no schema `public`, seja
-- procedure ou function — o que também torna a migração reexecutável.

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig, p.prokind
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'delete_user_data'
  loop
    if r.prokind = 'p' then
      execute format('drop procedure %s', r.sig);
    else
      execute format('drop function %s', r.sig);
    end if;
  end loop;
end;
$$;

-- ─── Exclusão total dos dados de um usuário ─────────────────────────────────
--
-- Retorna um jsonb com quantas linhas saíram de cada tabela.coluna (só as que
-- tiveram linhas). Serve para diagnóstico: é o corpo que o app manda ao Sentry
-- quando a exclusão falha, e responde "apagou mesmo?" sem adivinhação.
--
-- A varredura é um loop sobre pares 'tabela.coluna' em vez de 45 DELETEs
-- escritos à mão porque o `exception when undefined_table or undefined_column`
-- deixa a função rodar inteira num banco que ainda não tem alguma tabela
-- (staging, ou migração aplicada fora de ordem) em vez de abortar tudo.
--
-- A ORDEM DO ARRAY É A ORDEM DAS FKs: filhos antes dos pais. Ao acrescentar
-- uma tabela nova, coloque-a acima daquela que ela referencia.

create or replace function public.delete_user_data(p_user_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_targets text[] := array[
    -- reações e comentários (dependem de posts/shots/flow/promoções/duelos)
    'comment_reactions.user_id',
    'duel_check_in_comments.user_id',
    'duel_check_in_reactions.user_id',
    'duel_check_in_votes.user_id',
    'promotion_comments.user_id',
    'promotion_likes.user_id',
    'promotion_status_reports.user_id',
    'flow_comments.user_id',
    'flow_likes.user_id',
    'flow_tags.user_id',
    'flow_complaint.user_id',
    'flow_user_viewed.user_id',
    'flow_user_viewed.follower_id',
    'shots_comments.user_id',
    'shots_likes.user_id',
    'shots_complaint.user_id',
    'shot_user_viewed.user_id',
    'shot_user_viewed.follower_id',
    'comments.user_id',
    'likes.user_id',
    'post_tags.user_id',
    'post_complaint.user_id',
    'user_complaint.user_id',
    'user_complaint.follower_id',

    -- mensagens e notificações (os dois lados da conversa)
    'message_deletions.user_id',
    'messages.user_id',
    'messages.following_id',
    'notifications.user_id',
    'notifications.follower_id',

    -- duelos, check-ins e treino em grupo
    'check_ins.user_id',
    'duel_check_ins.user_id',
    'duel_group_participants.user_id',
    'workout_party_members.user_id',
    'workout_parties.host_id',

    -- histórico (workout_sets_hist cai por cascade de user_workouts_hist)
    'user_workouts_hist.user_id',
    'user_diets_hist.user_id',
    'user_habits_hist.user_id',

    -- registros diários (user_food_logs referencia user_diets: vem antes)
    'user_food_logs.user_id',
    'user_water_logs.user_id',
    'hydration_logs.user_id',
    'mood_logs.user_id',
    'user_weight_logs.user_id',

    -- perfil de treino/nutrição, telemetria e vínculos soltos
    'user_nutrition_goals.user_id',
    'user_fitness_profile.user_id',
    'user_fitness_levels.user_id',
    'user_training_plans.user_id',
    'ranking.user_id',
    'access_sessions.user_id',
    'screen_time_logs.user_id',
    'push_tokens.user_id',
    'user_badges.user_id',
    'subscriptions.user_id',
    'app_admins.user_id',

    -- grafo social (os dois lados)
    'user_blocks.blocker_id',
    'user_blocks.blocked_id',
    'followers.user_id',
    'followers.follower_id',
    'following.user_id',
    'following.following_id',

    -- rotinas e metas (routines referencia user_goals: vem antes)
    'routines.user_id',
    'routines.follower_id',
    'user_goals.user_id',
    'user_workouts.user_id',
    'user_diets.user_id',
    'user_habits.user_id',

    -- conteúdo publicado
    'posts.user_id',
    'shots.user_id',
    'flow.user_id',
    'promotions.user_id',
    'commercial_offers.user_id',
    'commercial_plans.user_id',
    'commercial_profiles.user_id',
    'duel_groups.created_by',

    -- itens de catálogo criados pela pessoa (o catálogo geral tem created_by
    -- nulo e não é afetado — ver docs/14, "Dono dos itens custom")
    'diets.created_by',
    'habits.created_by',
    'workouts.created_by',

    -- por último: o perfil, que quase tudo referencia
    'profiles.user_id'
  ];
  v_target   text;
  v_tbl      text;
  v_col      text;
  v_n        bigint;
  v_out      jsonb := '{}'::jsonb;
  v_caller   uuid := auth.uid();
  -- NULL = a chamada não passou pelo PostgREST. O `true` no segundo argumento
  -- é o que impede `current_setting` de levantar erro quando a chave não foi
  -- definida na sessão (que é exatamente o caso do SQL Editor).
  v_claims   text := nullif(current_setting('request.jwt.claims', true), '');
  v_jwt_role text := case when v_claims is not null
                          then (v_claims::jsonb ->> 'role') end;
begin
  if p_user_id is null then
    raise exception 'INVALID_USER_ID' using errcode = '22023';
  end if;

  if v_claims is null then
    -- Caminho 3: conexão direta ao banco. Ver "AUTORIZAÇÃO" no cabeçalho.
    null;
  elsif v_jwt_role = 'service_role' then
    -- Chamada de servidor com a service role key — que já pode tudo.
    null;
  elsif v_caller is null then
    -- JWT presente mas sem `sub`: é `anon`. Excluir conta exige sessão.
    raise exception 'NOT_OWNER' using errcode = '42501';
  elsif v_caller <> p_user_id and not public.is_app_admin(v_caller) then
    raise exception 'NOT_OWNER' using errcode = '42501';
  end if;

  -- Repost de flow: `reposted_from_user` aponta para a PESSOA ORIGINAL, então
  -- a linha é de outro usuário. Apagar por essa coluna destruiria o conteúdo
  -- de quem repostou. A FK já é `on delete set null`; isto só antecipa.
  begin
    update public.flow set reposted_from_user = null
     where reposted_from_user = p_user_id;
  exception
    when undefined_table or undefined_column then null;
  end;

  foreach v_target in array v_targets loop
    v_tbl := split_part(v_target, '.', 1);
    v_col := split_part(v_target, '.', 2);
    begin
      execute format('delete from public.%I where %I = $1', v_tbl, v_col)
        using p_user_id;
      get diagnostics v_n = row_count;
      if v_n > 0 then
        v_out := v_out || jsonb_build_object(v_target, v_n);
      end if;
    exception
      when undefined_table or undefined_column then
        null;
    end;
  end loop;

  -- ── auth.users, por último ────────────────────────────────────────────
  -- Depois daqui o JWT de quem chamou deixa de valer. É de propósito que seja
  -- a última coisa: qualquer erro acima aborta a transação e a conta continua
  -- utilizável, em vez de virar uma conta viva e vazia.
  begin
    delete from auth.users where id = p_user_id;
    get diagnostics v_n = row_count;
    if v_n > 0 then
      v_out := v_out || jsonb_build_object('auth.users', v_n);
    end if;
  exception
    -- Sem privilégio no schema `auth`: a chave fica de fora e o chamador cai
    -- no fallback com service role. Ver o cabeçalho.
    when insufficient_privilege or undefined_table then
      null;
  end;

  return v_out;
end;
$$;

-- `anon` nunca: exclusão de conta exige sessão. `authenticated` pode chamar,
-- e a checagem de dono dentro da função é que decide de quem são os dados.
revoke all on function public.delete_user_data(uuid) from public, anon;
grant execute on function public.delete_user_data(uuid) to authenticated;

-- ─── Excluir uma conta manualmente (admin) ──────────────────────────────────
--
-- O caminho de um comando só, que faz Storage + linhas + auth.users:
--
--   node scripts/delete-user.mjs <uuid>            # dry-run, só relata
--   node scripts/delete-user.mjs <uuid> --apply    # apaga de verdade
--
-- Se preferir fazer à mão pelo painel, são dois passos — a função não alcança
-- o Storage (ver o cabeçalho):
--
--   1. Storage — o Postgres não fala com o Storage, então isto é fora do SQL:
--      pelo painel (Storage → bucket `posts`), apague `{uid}/`,
--      `checkins/{uid}/`, `workout-summary/{uid}/`, `exercise-photos/{uid}/` e
--      os arquivos `covers/{uid}-*`; no bucket `chat-media`, as pastas cujo
--      nome tenha o uid numa das pontas (`{uidA}_{uidB}`). Alternativa:
--      `node scripts/sweep-orphan-media.mjs` depois, que recolhe o que sobrar.
--
--   2. Linhas + auth.users:
--        select public.delete_user_data('00000000-0000-0000-0000-000000000000');
--      O retorno jsonb diz quantas linhas saíram de cada tabela.coluna. Se
--      vier `"auth.users": 1`, a conta foi encerrada junto; se a chave não
--      aparecer, faltou privilégio no schema `auth` e o registro precisa sair
--      pelo painel (Authentication → Users → Delete user).
--
-- A ordem importa: a policy de DELETE do Storage depende de `auth.uid()`, então
-- apagar a conta antes da mídia deixa o arquivo inalcançável para sempre.

