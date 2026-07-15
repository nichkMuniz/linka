-- Migration: estende get_admin_analytics com métricas avançadas
-- Adiciona: WAU, MAU, stickiness, usuários banidos, novos vs recorrentes hoje,
-- retenção D1 / D7 e top usuários mais seguidos.

create or replace function public.get_admin_analytics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today       date := current_date;
  v_week_start  date := date_trunc('week', current_date)::date;
  v_month_start date := date_trunc('month', current_date)::date;
  v_dau         int;
  v_mau         int;
  result jsonb;
begin
  -- valores reusados para stickiness
  select count(distinct user_id) into v_dau
    from access_sessions where session_date = v_today;
  select count(distinct user_id) into v_mau
    from access_sessions where session_date >= v_today - 29;

  select jsonb_build_object(

    -- ── Usuários ────────────────────────────────────────────────────────────
    'usuarios_hoje',   (select count(*) from profiles where created_at::date = v_today),
    'usuarios_semana', (select count(*) from profiles where created_at::date >= v_week_start),
    'usuarios_mes',    (select count(*) from profiles where created_at::date >= v_month_start),
    'total_usuarios',  (select count(*) from profiles),
    'usuarios_banidos',(select count(*) from profiles where coalesce(is_banned, false) = true),

    -- ── Sessões / tempo de uso ───────────────────────────────────────────────
    'dau_hoje',  v_dau,
    'dau_ontem', (select count(distinct user_id) from access_sessions where session_date = v_today - 1),
    'wau',       (select count(distinct user_id) from access_sessions where session_date >= v_today - 6),
    'mau',       v_mau,
    'stickiness',(case when v_mau > 0 then round((v_dau::numeric / v_mau) * 100, 1) else 0 end),

    -- Novos vs recorrentes entre os ativos de hoje
    'novos_ativos_hoje', (
      select count(distinct s.user_id)
      from access_sessions s
      join profiles p on p.user_id = s.user_id
      where s.session_date = v_today and p.created_at::date = v_today
    ),
    'recorrentes_hoje', (
      select count(distinct s.user_id)
      from access_sessions s
      join profiles p on p.user_id = s.user_id
      where s.session_date = v_today and p.created_at::date < v_today
    ),

    'total_sessoes_hoje', (select count(*) from access_sessions where session_date = v_today),
    'avg_sessao_segundos_7d', (
      select coalesce(round(avg(duration_seconds)), 0)
      from access_sessions
      where session_date >= v_today - 6 and duration_seconds > 0
    ),
    'total_horas_hoje', (
      select coalesce(round(sum(duration_seconds) / 3600.0, 1), 0)
      from access_sessions where session_date = v_today
    ),

    -- ── Retenção ─────────────────────────────────────────────────────────────
    -- D1: % de usuários cadastrados nos últimos 14 dias (excluindo hoje) que
    -- voltaram exatamente no dia seguinte ao cadastro.
    'retencao_d1', (
      select case when count(*) = 0 then 0
        else round(100.0 * sum(case when exists (
          select 1 from access_sessions s
          where s.user_id = p.user_id
            and s.session_date = p.created_at::date + 1
        ) then 1 else 0 end) / count(*), 1)
      end
      from profiles p
      where p.created_at::date between v_today - 14 and v_today - 1
    ),
    -- D7: cohort entre 30 e 7 dias atrás, voltou no dia +7
    'retencao_d7', (
      select case when count(*) = 0 then 0
        else round(100.0 * sum(case when exists (
          select 1 from access_sessions s
          where s.user_id = p.user_id
            and s.session_date = p.created_at::date + 7
        ) then 1 else 0 end) / count(*), 1)
      end
      from profiles p
      where p.created_at::date between v_today - 30 and v_today - 7
    ),

    -- ── Conteúdo hoje ────────────────────────────────────────────────────────
    'posts_hoje',     (select count(*) from posts    where created_at::date = v_today),
    'shots_hoje',     (select count(*) from shots    where created_at::date = v_today),
    'comments_hoje',  (select count(*) from comments where created_at::date = v_today),
    'likes_hoje',     (select count(*) from likes    where created_at::date = v_today),
    'check_ins_hoje', (select count(*) from check_ins where check_in_date = v_today),

    -- ── Totais gerais ─────────────────────────────────────────────────────────
    'total_posts',     (select count(*) from posts),
    'total_shots',     (select count(*) from shots),
    'total_check_ins', (select count(*) from check_ins),

    -- ── Top usuários mais seguidos ───────────────────────────────────────────
    'top_seguidos', (
      select coalesce(jsonb_agg(row_to_json(t) order by t.followers desc), '[]'::jsonb)
      from (
        select
          p.user_id,
          coalesce(p.nickname, '—') as nickname,
          coalesce(p.handle, '')    as handle,
          p.photo,
          count(f.id) as followers
        from profiles p
        join followers f on f.user_id = p.user_id
        group by p.user_id, p.nickname, p.handle, p.photo
        order by followers desc
        limit 5
      ) t
    ),

    -- ── Top telas (últimos 7 dias) ────────────────────────────────────────────
    'top_screens', (
      select coalesce(jsonb_agg(row_to_json(t) order by t.total_seconds desc), '[]'::jsonb)
      from (
        select
          screen,
          sum(duration_seconds)   as total_seconds,
          count(*)                as acessos,
          count(distinct user_id) as usuarios_unicos
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
        select created_at::date as dia, count(*) as total
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
        select session_date, count(distinct user_id) as usuarios_ativos
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

grant execute on function public.get_admin_analytics() to authenticated;
