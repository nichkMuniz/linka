-- ============================================================
-- Migration: Insígnias v2 — treino, conteúdo e comunidade (2026-10-06)
--
-- O catálogo antigo (38 linhas) era amarrado a coisas que saíram do app:
-- dieta, hábitos, duelos, plano pago e check-in de rotina. Conferido no banco
-- antes desta migração: `user_badges` tinha ZERO linhas — ninguém perde nada.
--
-- O que muda:
--   1. Catálogo novo, focado no que o app tem hoje (treinos, posts, flows,
--      treinar junto, desafios, seguidores, incentivos). As linhas antigas são
--      apagadas (FK de `user_badges` é ON DELETE CASCADE, de
--      `profiles.selected_badge_id` é ON DELETE SET NULL).
--   2. A CONCESSÃO passa para o servidor: `award_my_badges()` conta tudo no
--      banco, grava o que falta e devolve as novas + o progresso de cada
--      métrica. Antes eram ~900 linhas de avaliação no cliente.
--   3. `user_badges` deixa de aceitar INSERT/DELETE do cliente. A policy
--      antiga (`auth.uid() = user_id`) deixava qualquer usuário se dar
--      qualquer insígnia pela API. Agora só a RPC (SECURITY DEFINER) escreve.
--
-- Rodar ANTES do build que liga `FEATURES.badges`. Idempotente.
-- ============================================================

-- ─── 1. Catálogo ────────────────────────────────────────────────────────────
--
-- `required_checkins` (nome histórico) = limiar da métrica do `condition_type`.
-- Nome/descrição em PT ficam aqui como fallback; o app mostra pelas chaves de
-- i18n `badge_<key>_name` / `badge_<key>_desc` (PT e EN).

delete from public.badges
where key not in (
  'primeiro_treino', 'treinos_10', 'treinos_50', 'treinos_100',
  'primeira_rotina',
  'primeiro_post', 'treino_compartilhado', 'primeiro_flow', 'posts_10',
  'treino_em_conjunto', 'desafiante',
  'incentivador', 'primeiro_seguidor', 'seguidores_10'
);

insert into public.badges
  (key, name, emoji, description, required_checkins, sort_order, condition_type, condition_metadata, premium)
values
  ('primeiro_treino',      'Primeiro treino',      '🏋️', 'Finalizou o primeiro treino no app',               1,  10, 'workouts_total',   null, false),
  ('treinos_10',           'Pegando ritmo',        '🔥', 'Finalizou 10 treinos',                              10, 11, 'workouts_total',   null, false),
  ('treinos_50',           'Dedicação',            '💪', 'Finalizou 50 treinos',                              50, 12, 'workouts_total',   null, false),
  ('treinos_100',          'Centenário',           '🏆', 'Finalizou 100 treinos',                            100, 13, 'workouts_total',   null, false),
  ('primeira_rotina',      'Rotina montada',       '📋', 'Criou a primeira rotina de treino',                  1, 20, 'routines_total',   null, false),
  ('primeiro_post',        'Primeiro post',        '📸', 'Publicou o primeiro post no feed',                   1, 30, 'posts_total',      null, false),
  ('treino_compartilhado', 'Treino compartilhado', '📤', 'Compartilhou um treino no feed ou num flow',         1, 31, 'workouts_shared',  null, false),
  ('primeiro_flow',        'Primeiro flow',        '🎬', 'Publicou o primeiro flow',                           1, 32, 'flows_total',      null, false),
  ('posts_10',             'Criador',              '✨', 'Publicou 10 posts',                                 10, 33, 'posts_total',      null, false),
  ('treino_em_conjunto',   'Treino em conjunto',   '🤝', 'Finalizou um treino junto com outra pessoa',         1, 40, 'party_workouts',   null, false),
  ('desafiante',           'Desafiante',           '⚔️', 'Participou de um desafio de treino',                 1, 41, 'challenges_total', null, false),
  ('incentivador',         'Incentivador',         '👏', 'Mandou 10 incentivos para outras pessoas',          10, 50, 'incentives_given', null, false),
  ('primeiro_seguidor',    'Primeiro seguidor',    '👥', 'Ganhou o primeiro seguidor',                         1, 51, 'followers_total',  null, false),
  ('seguidores_10',        'Inspiração',           '⭐', 'Chegou a 10 seguidores',                            10, 52, 'followers_total',  null, false)
on conflict (key) do update set
  name               = excluded.name,
  emoji              = excluded.emoji,
  description        = excluded.description,
  required_checkins  = excluded.required_checkins,
  sort_order         = excluded.sort_order,
  condition_type     = excluded.condition_type,
  condition_metadata = excluded.condition_metadata,
  premium            = excluded.premium;

-- ─── 2. Escrita em user_badges só pela RPC ──────────────────────────────────
--
-- Derruba TODA policy que não seja de leitura (os nomes variaram ao longo das
-- migrações). A leitura continua aberta a autenticados — a insígnia aparece
-- ao lado do nome no feed de qualquer pessoa.

do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_badges'
      and cmd <> 'SELECT'
  loop
    execute format('drop policy if exists %I on public.user_badges', p.policyname);
    raise notice 'policy removida de user_badges: %', p.policyname;
  end loop;
end $$;

-- ─── 3. Métricas ────────────────────────────────────────────────────────────
--
-- Uma chave por `condition_type`. Interna: sem GRANT para o cliente (contaria
-- coisas de qualquer usuário). Quem chama é `award_my_badges()`.

create or replace function public._badge_metrics(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    -- Sessões, não séries: o histórico grava uma linha por SÉRIE, todas no
    -- "Finalizar", a milissegundos umas das outras. Mais de 60 s entre duas
    -- linhas = outra sessão (mesma regra do Histórico de treinos no app).
    'workouts_total', (
      select count(*) from (
        select date_completed,
               lag(date_completed) over (order by date_completed) as prev
        from user_workouts_hist
        where user_id = p_user and date_completed is not null
      ) s
      where s.prev is null or s.date_completed - s.prev > interval '60 seconds'
    ),
    'routines_total', (
      select count(*) from routines where user_id = p_user and type = 1
    ),
    -- Repost não entra: desde 2026-10-05 ele mora em `post_reposts`, não em `posts`.
    'posts_total', (
      select count(*) from posts where user_id = p_user
    ),
    -- Post feito pelo "Resumo do treino" (traz o snapshot) ou flow com o mini
    -- frame de treino colado.
    'workouts_shared', (
      (select count(*) from posts where user_id = p_user and workout_summary is not null)
      + (select count(*) from flow
          where user_id = p_user
            and text_elements is not null
            and jsonb_typeof(text_elements) = 'array'
            and text_elements @> '[{"kind": "workout"}]'::jsonb)
    ),
    'flows_total', (
      select count(*) from flow where user_id = p_user and reposted_from is null
    ),
    -- Treinou de fato: finalizou a sessão da party (o host também é membro).
    'party_workouts', (
      select count(*) from workout_party_members
      where user_id = p_user and finished_at is not null
    ),
    -- Gravou os próprios números num desafio: quem desafia grava ao enviar,
    -- quem foi desafiado ao cumprir.
    'challenges_total', (
      select count(*) from workout_challenge_results where user_id = p_user
    ),
    -- Incentivos em conteúdo dos OUTROS (post e flow) — curtir o próprio post
    -- não conta.
    'incentives_given', (
      (select count(*) from likes l join posts p on p.id = l.post_id
        where l.user_id = p_user and p.user_id <> p_user)
      + (select count(*) from flow_likes fl join flow f on f.id = fl.flow_id
        where fl.user_id = p_user and f.user_id <> p_user)
    ),
    -- `following` é a tabela que o app lê para seguidores (ver 20260914).
    'followers_total', (
      select count(distinct user_id) from following
      where following_id = p_user and user_id <> p_user
    )
  );
$$;

revoke all on function public._badge_metrics(uuid) from public;
revoke all on function public._badge_metrics(uuid) from anon, authenticated;

-- ─── 4. Concessão ───────────────────────────────────────────────────────────
--
-- Retorna `{ "awarded": [badge_id, ...], "metrics": { ... } }`. `awarded` só traz
-- as conquistadas NESTA chamada (o ON CONFLICT descarta as já existentes), então
-- duas chamadas simultâneas nunca celebram a mesma insígnia duas vezes.

create or replace function public.award_my_badges()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_metrics jsonb;
  v_awarded uuid[];
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  v_metrics := public._badge_metrics(v_uid);

  with inserted as (
    insert into user_badges (user_id, badge_id)
    select v_uid, b.id
    from badges b
    where coalesce((v_metrics ->> b.condition_type)::bigint, 0) >= greatest(b.required_checkins, 1)
    on conflict (user_id, badge_id) do nothing
    returning badge_id
  )
  select coalesce(array_agg(badge_id), '{}') into v_awarded from inserted;

  return jsonb_build_object('awarded', to_jsonb(v_awarded), 'metrics', v_metrics);
end;
$$;

revoke all on function public.award_my_badges() from public, anon;
grant execute on function public.award_my_badges() to authenticated;

-- ─── Conferência ────────────────────────────────────────────────────────────
-- select key, emoji, condition_type, required_checkins from badges order by sort_order;  -- 14 linhas
-- select policyname, cmd from pg_policies where tablename = 'user_badges';                -- só SELECT
