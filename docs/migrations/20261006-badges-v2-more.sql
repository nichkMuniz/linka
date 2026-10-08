-- ============================================================
-- Migration: Insígnias v2 — catálogo ampliado (2026-10-06)
--
-- Roda DEPOIS de `20261006-badges-v2.sql` (que já está no banco). Leva o
-- catálogo de 14 para 41 insígnias: cada métrica ganha uma escada de níveis
-- (treinos 1→500, seguidores 1→500, incentivos 10→500…) para sempre haver um
-- próximo objetivo — e entram três métricas novas:
--
--   incentives_received — incentivos que OUTRAS pessoas deram nos meus posts/flows
--   comments_given      — comentários em posts/flows de outras pessoas
--   following_total     — pessoas que eu sigo
--
-- Só ACRESCENTA: nenhuma linha de `badges` ou `user_badges` é apagada. As 14
-- chaves da v2 continuam as mesmas (só o `sort_order` é renumerado para caber
-- os níveis novos), então quem já ganhou não perde nada. `award_my_badges()`
-- não muda — ela lê qualquer chave que `_badge_metrics` devolver.
--
-- Idempotente.
-- ============================================================

-- ─── 1. Métricas (substitui a função, com as 3 chaves novas) ────────────────

create or replace function public._badge_metrics(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    -- Sessões, não séries (uma linha por série; > 60 s entre linhas = outra sessão).
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
    'posts_total', (
      select count(*) from posts where user_id = p_user
    ),
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
    'party_workouts', (
      select count(*) from workout_party_members
      where user_id = p_user and finished_at is not null
    ),
    'challenges_total', (
      select count(*) from workout_challenge_results where user_id = p_user
    ),
    'incentives_given', (
      (select count(*) from likes l join posts p on p.id = l.post_id
        where l.user_id = p_user and p.user_id <> p_user)
      + (select count(*) from flow_likes fl join flow f on f.id = fl.flow_id
        where fl.user_id = p_user and f.user_id <> p_user)
    ),
    -- NOVA: o outro lado do incentivo — o que eu recebi de outras pessoas.
    -- Conta banida ou com exclusão agendada não conta (esta função ignora a RLS).
    'incentives_received', (
      (select count(*) from likes l join posts p on p.id = l.post_id
        where p.user_id = p_user and l.user_id <> p_user
          and not (l.user_id = any (public.banned_user_ids())))
      + (select count(*) from flow_likes fl join flow f on f.id = fl.flow_id
        where f.user_id = p_user and fl.user_id <> p_user
          and not (fl.user_id = any (public.banned_user_ids())))
    ),
    -- NOVA: comentários (e respostas) no conteúdo de outras pessoas.
    'comments_given', (
      (select count(*) from comments c join posts p on p.id = c.post_id
        where c.user_id = p_user and p.user_id <> p_user)
      + (select count(*) from flow_comments fc join flow f on f.id = fc.flow_id
        where fc.user_id = p_user and f.user_id <> p_user)
    ),
    -- Seguidor banido ou com exclusão agendada não conta (mesma regra do perfil).
    'followers_total', (
      select count(distinct user_id) from following
      where following_id = p_user and user_id <> p_user
        and not (user_id = any (public.banned_user_ids()))
    ),
    -- NOVA: quem eu sigo.
    'following_total', (
      select count(distinct following_id) from following
      where user_id = p_user and following_id <> p_user
    )
  );
$$;

revoke all on function public._badge_metrics(uuid) from public;
revoke all on function public._badge_metrics(uuid) from anon, authenticated;

-- ─── 2. Catálogo completo (upsert — as 14 da v2 + 27 novas) ─────────────────

insert into public.badges
  (key, name, emoji, description, required_checkins, sort_order, condition_type, condition_metadata, premium)
values
  -- Treinos
  ('primeiro_treino',      'Primeiro treino',       '🏋️', 'Finalizou o primeiro treino no app',             1,  10, 'workouts_total',      null, false),
  ('treinos_5',            'Aquecendo',             '👟', 'Finalizou 5 treinos',                             5,  11, 'workouts_total',      null, false),
  ('treinos_10',           'Pegando ritmo',         '🔥', 'Finalizou 10 treinos',                           10,  12, 'workouts_total',      null, false),
  ('treinos_25',           'Constância',            '⚡', 'Finalizou 25 treinos',                           25,  13, 'workouts_total',      null, false),
  ('treinos_50',           'Dedicação',             '💪', 'Finalizou 50 treinos',                           50,  14, 'workouts_total',      null, false),
  ('treinos_100',          'Centenário',            '🏆', 'Finalizou 100 treinos',                         100,  15, 'workouts_total',      null, false),
  ('treinos_250',          'Máquina',               '🦾', 'Finalizou 250 treinos',                         250,  16, 'workouts_total',      null, false),
  ('treinos_500',          'Lenda',                 '👑', 'Finalizou 500 treinos',                         500,  17, 'workouts_total',      null, false),
  ('primeira_rotina',      'Rotina montada',        '📋', 'Criou a primeira rotina de treino',               1,  20, 'routines_total',      null, false),
  ('rotinas_3',            'Organizado',            '🗂️', 'Criou 3 rotinas de treino',                       3,  21, 'routines_total',      null, false),
  ('rotinas_5',            'Estrategista',          '🧠', 'Criou 5 rotinas de treino',                       5,  22, 'routines_total',      null, false),
  -- Conteúdo
  ('primeiro_post',        'Primeiro post',         '📸', 'Publicou o primeiro post no feed',                1,  30, 'posts_total',         null, false),
  ('posts_10',             'Criador',               '✨', 'Publicou 10 posts',                              10,  31, 'posts_total',         null, false),
  ('posts_25',             'Na vitrine',            '📣', 'Publicou 25 posts',                              25,  32, 'posts_total',         null, false),
  ('posts_50',             'Estrela do feed',       '🌟', 'Publicou 50 posts',                              50,  33, 'posts_total',         null, false),
  ('treino_compartilhado', 'Treino compartilhado',  '📤', 'Compartilhou um treino no feed ou num flow',      1,  34, 'workouts_shared',     null, false),
  ('compartilhados_10',    'Inspirando a galera',   '🚀', 'Compartilhou 10 treinos',                        10,  35, 'workouts_shared',     null, false),
  ('compartilhados_25',    'Embaixador',            '🎖️', 'Compartilhou 25 treinos',                        25,  36, 'workouts_shared',     null, false),
  ('primeiro_flow',        'Primeiro flow',         '🎬', 'Publicou o primeiro flow',                        1,  37, 'flows_total',         null, false),
  ('flows_10',             'Contador de histórias', '🎞️', 'Publicou 10 flows',                              10,  38, 'flows_total',         null, false),
  ('flows_30',             'Diretor',               '🎥', 'Publicou 30 flows',                              30,  39, 'flows_total',         null, false),
  -- Juntos
  ('treino_em_conjunto',   'Treino em conjunto',    '🤝', 'Finalizou um treino junto com outra pessoa',      1,  40, 'party_workouts',      null, false),
  ('conjunto_5',           'Parceria',              '👯', 'Finalizou 5 treinos em conjunto',                 5,  41, 'party_workouts',      null, false),
  ('conjunto_20',          'Time unido',            '🏟️', 'Finalizou 20 treinos em conjunto',               20,  42, 'party_workouts',      null, false),
  ('desafiante',           'Desafiante',            '⚔️', 'Participou de um desafio de treino',              1,  43, 'challenges_total',    null, false),
  ('desafios_5',           'Competidor',            '🥊', 'Participou de 5 desafios de treino',              5,  44, 'challenges_total',    null, false),
  ('desafios_20',          'Gladiador',             '🛡️', 'Participou de 20 desafios de treino',            20,  45, 'challenges_total',    null, false),
  -- Comunidade
  ('incentivador',         'Incentivador',          '👏', 'Mandou 10 incentivos para outras pessoas',       10,  50, 'incentives_given',    null, false),
  ('incentivos_100',       'Motivador',             '🙌', 'Mandou 100 incentivos para outras pessoas',     100,  51, 'incentives_given',    null, false),
  ('incentivos_500',       'Torcida organizada',    '🎉', 'Mandou 500 incentivos para outras pessoas',     500,  52, 'incentives_given',    null, false),
  ('aplaudido_10',         'Aplaudido',             '💖', 'Recebeu 10 incentivos',                          10,  53, 'incentives_received', null, false),
  ('aplaudido_100',        'Admirado',              '💎', 'Recebeu 100 incentivos',                        100,  54, 'incentives_received', null, false),
  ('aplaudido_500',        'Inspirador',            '🏵️', 'Recebeu 500 incentivos',                        500,  55, 'incentives_received', null, false),
  ('primeiro_comentario',  'Primeiro comentário',   '💬', 'Comentou no post ou flow de alguém',              1,  56, 'comments_given',      null, false),
  ('comentarios_25',       'Papo em dia',           '🗣️', 'Fez 25 comentários em posts e flows',            25,  57, 'comments_given',      null, false),
  ('conectado_5',          'Conectado',             '🔗', 'Seguiu 5 pessoas',                                5,  58, 'following_total',     null, false),
  ('primeiro_seguidor',    'Primeiro seguidor',     '👥', 'Ganhou o primeiro seguidor',                      1,  59, 'followers_total',     null, false),
  ('seguidores_10',        'Inspiração',            '⭐', 'Chegou a 10 seguidores',                         10,  60, 'followers_total',     null, false),
  ('seguidores_50',        'Popular',               '💫', 'Chegou a 50 seguidores',                         50,  61, 'followers_total',     null, false),
  ('seguidores_100',       'Referência',            '🌍', 'Chegou a 100 seguidores',                       100,  62, 'followers_total',     null, false),
  ('seguidores_500',       'Ícone',                 '🎤', 'Chegou a 500 seguidores',                       500,  63, 'followers_total',     null, false)
on conflict (key) do update set
  name               = excluded.name,
  emoji              = excluded.emoji,
  description        = excluded.description,
  required_checkins  = excluded.required_checkins,
  sort_order         = excluded.sort_order,
  condition_type     = excluded.condition_type,
  condition_metadata = excluded.condition_metadata,
  premium            = excluded.premium;

-- ─── Conferência ────────────────────────────────────────────────────────────
-- select count(*) from badges;                                         -- 41
-- select condition_type, count(*) from badges group by 1 order by 1;   -- 12 métricas
