-- Migration: admin analytics RPC
-- Cria função SECURITY DEFINER que agrega métricas do painel admin,
-- bypassing o RLS das tabelas access_sessions e screen_time_logs.

create or replace function public.get_admin_analytics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today      date := current_date;
  v_week_start date := date_trunc('week', current_date)::date;
  v_month_start date := date_trunc('month', current_date)::date;
  result jsonb;
begin
  select jsonb_build_object(

    -- ── Usuários ────────────────────────────────────────────────────────────
    'usuarios_hoje', (
      select count(*) from profiles
      where created_at::date = v_today
    ),
    'usuarios_semana', (
      select count(*) from profiles
      where created_at::date >= v_week_start
    ),
    'usuarios_mes', (
      select count(*) from profiles
      where created_at::date >= v_month_start
    ),
    'total_usuarios', (
      select count(*) from profiles
    ),

    -- ── Sessões / tempo de uso ───────────────────────────────────────────────
    'dau_hoje', (
      select count(distinct user_id)
      from access_sessions
      where session_date = v_today
    ),
    'dau_ontem', (
      select count(distinct user_id)
      from access_sessions
      where session_date = v_today - 1
    ),
    'total_sessoes_hoje', (
      select count(*)
      from access_sessions
      where session_date = v_today
    ),
    'avg_sessao_segundos_7d', (
      select coalesce(round(avg(duration_seconds)), 0)
      from access_sessions
      where session_date >= v_today - 6
        and duration_seconds > 0
    ),
    'total_horas_hoje', (
      select coalesce(round(sum(duration_seconds) / 3600.0, 1), 0)
      from access_sessions
      where session_date = v_today
    ),

    -- ── Conteúdo hoje ────────────────────────────────────────────────────────
    'posts_hoje', (
      select count(*) from posts
      where created_at::date = v_today
    ),
    'shots_hoje', (
      select count(*) from shots
      where created_at::date = v_today
    ),
    'comments_hoje', (
      select count(*) from comments
      where created_at::date = v_today
    ),
    'likes_hoje', (
      select count(*) from likes
      where created_at::date = v_today
    ),
    'check_ins_hoje', (
      select count(*) from check_ins
      where check_in_date = v_today
    ),

    -- ── Totais gerais ─────────────────────────────────────────────────────────
    'total_posts', (
      select count(*) from posts
    ),
    'total_shots', (
      select count(*) from shots
    ),
    'total_check_ins', (
      select count(*) from check_ins
    ),

    -- ── Top telas (últimos 7 dias) ────────────────────────────────────────────
    'top_screens', (
      select coalesce(jsonb_agg(row_to_json(t) order by t.total_seconds desc), '[]'::jsonb)
      from (
        select
          screen,
          sum(duration_seconds)                        as total_seconds,
          count(*)                                     as acessos,
          count(distinct user_id)                      as usuarios_unicos
        from screen_time_logs
        where log_date >= v_today - 6
        group by screen
        order by total_seconds desc
        limit 8
      ) t
    ),

    -- ── Novos usuários por dia (últimos 7 dias) ───────────────────────────────
    'novos_usuarios_7d', (
      select coalesce(jsonb_agg(row_to_json(t) order by t.dia asc), '[]'::jsonb)
      from (
        select
          created_at::date as dia,
          count(*)         as total
        from profiles
        where created_at::date >= v_today - 6
        group by created_at::date
        order by dia
      ) t
    ),

    -- ── DAU por dia (últimos 7 dias) ──────────────────────────────────────────
    'dau_7d', (
      select coalesce(jsonb_agg(row_to_json(t) order by t.session_date asc), '[]'::jsonb)
      from (
        select
          session_date,
          count(distinct user_id) as usuarios_ativos
        from access_sessions
        where session_date >= v_today - 6
        group by session_date
        order by session_date
      ) t
    )

  ) into result;

  return result;
end;
$$;

-- Garante que qualquer usuário autenticado pode chamar esta função
-- (a restrição de quem é admin fica na camada de aplicação)
grant execute on function public.get_admin_analytics() to authenticated;
