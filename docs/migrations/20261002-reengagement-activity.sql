-- ============================================================================
-- Migration: 20261002 — Lembretes de volta ao app (re-engajamento v2)
--
-- ⚠️ OBRIGATÓRIA para a função `reengagement-push` nova. Rodar ANTES do deploy
-- dela e ANTES de agendar o cron (`20260713-reengagement-cron.sql`).
-- O app funciona sem ela: a chamada de "toque de atividade" falha em silêncio.
--
-- O QUE MUDA:
--   A v1 (13/07/2026) só olhava check-ins de treino. Não sabia quando a
--   pessoa ABRIU o app pela última vez, nem o que os amigos dela postaram.
--   Esta migração dá ao servidor essas duas respostas:
--
--   1. `user_activity` — uma linha por usuário: quando abriu o app pela última
--      vez, o idioma do aparelho (o push sai em PT ou EN), se aceita
--      lembretes (interruptor em Configurações → Notificações) e o último
--      lembrete enviado (limite de 1 por dia).
--
--      PRIVADA: RLS ligada e NENHUMA policy. O "visto por último" nunca vai
--      para `profiles`, que é legível por todo mundo — seria um "online há 2h"
--      exposto a qualquer usuário. Só as RPCs abaixo e o service role tocam.
--
--   2. `touch_user_activity(lang, reminders)` — o app chama ao abrir e ao
--      voltar do segundo plano (com intervalo mínimo no cliente).
--
--   3. `get_reengagement_candidates()` — quem tem push e aceita lembretes, com
--      a última atividade e QUANTOS posts novos de quem a pessoa segue saíram
--      desde que ela abriu o app (ou desde o último lembrete). Só service role.
--
--   4. `mark_reengagement_sent(rows)` — registra o envio sem tocar em
--      `last_active_at` (um UPDATE da função não pode atropelar uma abertura
--      que aconteceu no meio da rodada).
--
-- EXCLUSÃO DE CONTA: `user_activity.user_id` tem `on delete cascade` para
-- `auth.users`, e `delete_user_data` apaga `auth.users` na mesma transação —
-- a tabela já é coberta sem entrar no `v_targets` (mesma convenção de
-- `20261002-workout-challenges.sql`).
--
-- Reexecutável.
-- ============================================================================

-- ─── 1. Tabela ──────────────────────────────────────────────────────────────

create table if not exists public.user_activity (
  user_id                 uuid primary key references auth.users(id) on delete cascade,
  last_active_at          timestamptz not null default now(),
  app_language            text        not null default 'pt',
  reminders_enabled       boolean     not null default true,
  last_reengagement_at    timestamptz,
  last_reengagement_kind  text,
  updated_at              timestamptz not null default now(),
  constraint user_activity_language_chk check (app_language in ('pt', 'en'))
);

alter table public.user_activity enable row level security;
-- Sem policies DE PROPÓSITO (ver cabeçalho). Grants mínimos:
revoke all on public.user_activity from anon, authenticated;

-- Quem não abre há dias — a varredura diária filtra por aqui.
create index if not exists user_activity_last_active_idx
  on public.user_activity (last_active_at);

-- ─── 2. Toque de atividade (app) ────────────────────────────────────────────

create or replace function public.touch_user_activity(
  p_language          text    default null,
  p_reminders_enabled boolean default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_lang text := case when p_language in ('pt', 'en') then p_language end;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  insert into public.user_activity (user_id, last_active_at, app_language, reminders_enabled, updated_at)
  values (v_uid, now(), coalesce(v_lang, 'pt'), coalesce(p_reminders_enabled, true), now())
  on conflict (user_id) do update set
    last_active_at    = now(),
    app_language      = coalesce(v_lang, public.user_activity.app_language),
    reminders_enabled = coalesce(p_reminders_enabled, public.user_activity.reminders_enabled),
    updated_at        = now();
end;
$$;

revoke all on function public.touch_user_activity(text, boolean) from public, anon;
grant execute on function public.touch_user_activity(text, boolean) to authenticated;

-- ─── 3. Candidatos (só service role) ────────────────────────────────────────
--
-- Uma linha por usuário com push iOS, não banido e com lembretes ligados.
-- `last_active_at`: a linha de `user_activity`; sem ela (quem ainda não abriu
-- o app numa versão com o toque), a última sessão de `access_sessions`.
-- Sem nenhuma das duas → fica de fora (não há como saber se sumiu).
--
-- Posts novos: de quem a pessoa SEGUE, depois de max(última abertura, último
-- lembrete) — o mesmo post nunca motiva dois lembretes —, nos últimos 7 dias,
-- sem autor banido e sem bloqueio em nenhum sentido. `security definer`
-- ignora RLS, então banidos e bloqueios são filtrados À MÃO aqui.
-- `posts.created_at` é `timestamp` sem fuso gravado em UTC → `at time zone 'UTC'`.

create or replace function public.get_reengagement_candidates()
returns table (
  user_id               uuid,
  last_active_at        timestamptz,
  app_language          text,
  last_reengagement_at  timestamptz,
  new_posts_count       integer,
  new_post_authors      text[]
)
language sql
stable
security definer
set search_path = public
as $$
  with tok as (
    select distinct pt.user_id
      from public.push_tokens pt
     where pt.platform = 'ios'
  ),
  base as (
    select
      t.user_id,
      coalesce(
        ua.last_active_at,
        (select max(a.created_at) from public.access_sessions a where a.user_id = t.user_id)
      ) as last_active_at,
      coalesce(ua.app_language, 'pt')       as app_language,
      ua.last_reengagement_at,
      coalesce(ua.reminders_enabled, true)  as reminders_enabled
    from tok t
    join public.profiles pr
      on pr.user_id = t.user_id
     and coalesce(pr.is_banned, false) = false
    left join public.user_activity ua on ua.user_id = t.user_id
  )
  select
    b.user_id,
    b.last_active_at,
    b.app_language,
    b.last_reengagement_at,
    coalesce(np.cnt, 0)                      as new_posts_count,
    coalesce(np.authors, '{}'::text[])       as new_post_authors
  from base b
  left join lateral (
    select
      count(*)::integer as cnt,
      -- Mais recentes primeiro; o nome repetido é removido na função (Deno).
      (array_agg(au.nickname order by po.created_at desc)
         filter (where au.nickname is not null and au.nickname <> ''))[1:10] as authors
    from public.following f
    join public.posts po
      on po.user_id = f.following_id
    join public.profiles au
      on au.user_id = po.user_id
     and coalesce(au.is_banned, false) = false
    where f.user_id = b.user_id
      and po.user_id <> b.user_id
      and (po.created_at at time zone 'UTC')
            > greatest(b.last_active_at, coalesce(b.last_reengagement_at, b.last_active_at))
      and (po.created_at at time zone 'UTC') > now() - interval '7 days'
      and not exists (
        select 1 from public.user_blocks ub
         where (ub.blocker_id = b.user_id and ub.blocked_id = po.user_id)
            or (ub.blocker_id = po.user_id and ub.blocked_id = b.user_id)
      )
  ) np on true
  where b.reminders_enabled
    and b.last_active_at is not null;
$$;

revoke all on function public.get_reengagement_candidates() from public, anon, authenticated;
grant execute on function public.get_reengagement_candidates() to service_role;

-- ─── 4. Registrar envio (só service role) ───────────────────────────────────
-- p_rows = [{ "user_id": "...", "kind": "social" | "inactive_1" | ..., "last_active_at": "..." }]
-- Linha nova (quem ainda não tinha `user_activity`) nasce com o `last_active_at`
-- que a varredura usou; linha existente só ganha os campos do lembrete.

create or replace function public.mark_reengagement_sent(p_rows jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.user_activity (user_id, last_active_at, last_reengagement_at, last_reengagement_kind, updated_at)
  select
    (r->>'user_id')::uuid,
    coalesce((r->>'last_active_at')::timestamptz, now()),
    now(),
    r->>'kind',
    now()
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
  where r ? 'user_id'
  on conflict (user_id) do update set
    last_reengagement_at   = now(),
    last_reengagement_kind = excluded.last_reengagement_kind,
    updated_at             = now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_reengagement_sent(jsonb) from public, anon, authenticated;
grant execute on function public.mark_reengagement_sent(jsonb) to service_role;

-- Conferir:
--   select * from public.get_reengagement_candidates() limit 20;
