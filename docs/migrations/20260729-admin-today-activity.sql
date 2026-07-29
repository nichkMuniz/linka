-- ============================================================================
-- Migration: 20260729 — Admin: atividade de HOJE por usuário (telas + ações)
--
-- ⚠️ Rodar DEPOIS de `20260729-admin-premium.sql` (usa `is_app_admin`).
--
-- OBJETIVO: no Painel Admin, ver quem entrou hoje e, por pessoa, em quais
-- telas ficou (e quanto tempo em cada uma) + o que fez no app.
--
-- DECISÕES:
--   * "Telas" saem de `screen_time_logs` (tempo real por tela). "Ações" saem
--     das próprias tabelas de conteúdo — o app NÃO tem tabela de eventos, e
--     inventar uma exigiria instrumentar o cliente inteiro. Por isso ação tem
--     CONTAGEM e HORÁRIO da última, não duração: ninguém cronometra um like.
--   * A lista de quem "entrou hoje" é a união de `access_sessions` e
--     `screen_time_logs` do dia: o normal é ter as duas, mas quem navegou sem
--     fechar o app ainda não tem linha de sessão (o flush acontece quando o
--     app vai para segundo plano) — e some da lista se olharmos só uma.
--   * `security definer` + check de admin: `screen_time_logs`/`access_sessions`
--     de terceiros não são legíveis com a anon key, e não devem ser.
--   * Datas comparadas com `current_date` (UTC), igual a `get_admin_analytics`
--     — para os números das duas telas baterem entre si.
-- ============================================================================

create or replace function public.get_admin_today_activity()
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_today  date := current_date;
  v_result jsonb;
begin
  if not public.is_app_admin(auth.uid()) then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  with acessos as (
    select
      s.user_id,
      count(*)                   as sessoes,
      sum(s.duration_seconds)    as total_seconds,
      min(s.created_at)          as primeiro_acesso,
      max(s.created_at)          as ultimo_acesso
    from access_sessions s
    where s.session_date = v_today
    group by s.user_id
  ),
  telas as (
    select
      l.user_id,
      l.screen,
      sum(l.duration_seconds) as seconds,
      count(*)                as registros
    from screen_time_logs l
    where l.log_date = v_today
    group by l.user_id, l.screen
  ),
  -- Quem apareceu hoje por qualquer um dos dois caminhos.
  base as (
    select user_id from acessos
    union
    select user_id from telas
  ),
  acoes as (
    select user_id, 'post'::text as acao, count(*) as total, max(created_at)::timestamptz as ultima
      from posts where created_at::date = v_today group by user_id
    union all
    select user_id, 'shot', count(*), max(created_at)::timestamptz
      from shots where created_at::date = v_today group by user_id
    union all
    select user_id, 'flow', count(*), max(created_at)::timestamptz
      from flow where created_at::date = v_today group by user_id
    union all
    select user_id, 'comentario', count(*), max(created_at)::timestamptz
      from comments where created_at::date = v_today group by user_id
    union all
    select user_id, 'comentario_shot', count(*), max(created_at)::timestamptz
      from shots_comments where created_at::date = v_today group by user_id
    union all
    select user_id, 'curtida', count(*), max(created_at)::timestamptz
      from likes where created_at::date = v_today group by user_id
    union all
    select user_id, 'curtida_shot', count(*), max(created_at)::timestamptz
      from shots_likes where created_at::date = v_today group by user_id
    union all
    select user_id, 'check_in', count(*), max(created_at)::timestamptz
      from check_ins where check_in_date = v_today group by user_id
    union all
    select user_id, 'check_in_duelo', count(*), max(created_at)::timestamptz
      from duel_check_ins where created_at::date = v_today group by user_id
    union all
    select user_id, 'mensagem', count(*), max(created_at)::timestamptz
      from messages where created_at::date = v_today group by user_id
    union all
    select user_id, 'refeicao', count(*), max(created_at)::timestamptz
      from user_food_logs where log_date = v_today group by user_id
    union all
    select user_id, 'treino', count(*), max(created_at)::timestamptz
      from user_workouts_hist where date_completed::date = v_today group by user_id
  )
  select coalesce(
    jsonb_agg(row_to_json(u) order by u.total_seconds desc, u.screen_seconds desc),
    '[]'::jsonb
  )
  into v_result
  from (
    select
      b.user_id,
      coalesce(p.nickname, '—')                    as nickname,
      coalesce(p.handle, '')                       as handle,
      p.photo,
      coalesce(a.sessoes, 0)                       as sessoes,
      coalesce(a.total_seconds, 0)                 as total_seconds,
      a.primeiro_acesso,
      a.ultimo_acesso,
      coalesce((select sum(t.seconds) from telas t where t.user_id = b.user_id), 0) as screen_seconds,
      coalesce((
        select jsonb_agg(
                 jsonb_build_object('screen', t.screen, 'seconds', t.seconds, 'registros', t.registros)
                 order by t.seconds desc
               )
        from telas t where t.user_id = b.user_id
      ), '[]'::jsonb)                              as telas,
      coalesce((
        select jsonb_agg(
                 jsonb_build_object('acao', ac.acao, 'total', ac.total, 'ultima', ac.ultima)
                 order by ac.total desc
               )
        from acoes ac where ac.user_id = b.user_id
      ), '[]'::jsonb)                              as acoes,
      coalesce((select sum(ac.total) from acoes ac where ac.user_id = b.user_id), 0) as acoes_total,
      (p.created_at::date = v_today)               as novo_hoje
    from base b
    left join profiles p on p.user_id = b.user_id
    left join acessos a  on a.user_id = b.user_id
  ) u;

  return v_result;
end;
$$;

grant execute on function public.get_admin_today_activity() to authenticated;

-- ─── Índices de apoio ───────────────────────────────────────────────────────
-- A função filtra sempre pelo dia; sem estes índices vira seq scan nas duas
-- tabelas de telemetria, que só crescem.

create index if not exists screen_time_logs_log_date_idx
  on public.screen_time_logs (log_date);
create index if not exists access_sessions_session_date_idx
  on public.access_sessions (session_date);
