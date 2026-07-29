-- ============================================================================
-- Migration: 20260729 — Admin: conceder/revogar LinKa Premium pelo app
--
-- OBJETIVO: permitir que o painel Admin ative o premium de um usuário sem
-- rodar INSERT na mão no SQL Editor a cada teste.
--
-- DECISÕES:
--   * `subscriptions` continua SEM policy de escrita (é isso que impede o
--     auto-upgrade via anon key — ver 20260715-premium-plan.sql). A escrita
--     passa por RPC `SECURITY DEFINER` que verifica quem chamou.
--   * Quem é admin vive na tabela `app_admins` (e não numa lista hardcoded na
--     função): o app já tem a lista em `client/App.tsx`, mas aquela lista é só
--     guarda de rota — o servidor precisa da sua própria fonte de verdade,
--     senão a autorização real seria client-side.
--   * `app_admins` tem RLS ligada e NENHUMA policy: só o service role a lê
--     diretamente; as funções `SECURITY DEFINER` abaixo a enxergam porque
--     rodam com o privilégio do dono.
--
-- Rodar no SQL Editor do Supabase.
-- ============================================================================

-- ─── 1. Quem é admin ────────────────────────────────────────────────────────
--
-- Sem FK para auth.users de propósito: um id de admin que ainda não existe
-- (ambiente novo, restore parcial) faria a migração inteira falhar.

create table if not exists public.app_admins (
  user_id    uuid primary key,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;
-- Nenhuma policy: ninguém lê/escreve com a anon key. Só service role + os
-- SECURITY DEFINER abaixo.

-- Mesmos ids de ADMIN_USER_IDS em client/App.tsx.
insert into public.app_admins (user_id, note) values
  ('c954d5ab-9d72-4785-bc21-bf469a5e8052', 'admin principal'),
  ('67e0640a-4762-4758-bb0f-449be951cc6a', 'admin'),
  ('94548d81-76be-4c8b-9ff7-ccb946cd4e69', 'admin')
on conflict (user_id) do nothing;

create or replace function public.is_app_admin(uid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.app_admins a where a.user_id = uid);
$$;

grant execute on function public.is_app_admin(uuid) to authenticated;

-- ─── 2. Conceder / revogar premium ──────────────────────────────────────────
--
-- p_days:
--   null → acesso permanente (current_period_end = null), padrão do tester
--   N    → expira em N dias (útil para trial temporário)
--
-- Revogar mantém a linha (histórico de que a pessoa já teve acesso) e só muda
-- o status para 'inactive' — é o mesmo que o roteiro manual da Fase 1 fazia.

create or replace function public.admin_set_premium(
  p_user_id uuid,
  p_active  boolean,
  p_days    integer default null
)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
begin
  if not public.is_app_admin(auth.uid()) then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  if p_user_id is null then
    raise exception 'INVALID_USER' using errcode = '22023';
  end if;

  if p_active then
    insert into public.subscriptions (user_id, status, product_id, store, current_period_end)
    values (
      p_user_id,
      'active',
      'manual',
      'manual',
      case when p_days is null then null else now() + make_interval(days => p_days) end
    )
    on conflict (user_id) do update
      set status             = 'active',
          product_id         = 'manual',
          store              = 'manual',
          current_period_end = excluded.current_period_end,
          updated_at         = now();
  else
    update public.subscriptions s
      set status     = 'inactive',
          updated_at = now()
    where s.user_id = p_user_id;
  end if;
end;
$$;

grant execute on function public.admin_set_premium(uuid, boolean, integer) to authenticated;

-- ─── 3. Listar assinantes (painel admin) ────────────────────────────────────
--
-- `subscriptions_select_own` só deixa cada um ler a própria linha; o painel
-- precisa ver todas — daí o SECURITY DEFINER com o mesmo check de admin.
-- `is_active` repete a regra de is_premium() para a lista não mostrar como
-- ativo quem tem status 'active' mas período já vencido.

create or replace function public.admin_list_premium()
returns table (
  user_id            uuid,
  nickname           text,
  handle             text,
  photo              text,
  status             text,
  store              text,
  current_period_end timestamptz,
  updated_at         timestamptz,
  is_active          boolean
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_app_admin(auth.uid()) then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  return query
    select
      s.user_id,
      coalesce(p.nickname, '')::text,
      coalesce(p.handle, '')::text,
      p.photo::text,
      s.status::text,
      s.store::text,
      s.current_period_end,
      s.updated_at,
      (s.status = 'active'
        and (s.current_period_end is null or s.current_period_end > now())) as is_active
    from public.subscriptions s
    left join public.profiles p on p.user_id = s.user_id
    order by
      (s.status = 'active'
        and (s.current_period_end is null or s.current_period_end > now())) desc,
      s.updated_at desc;
end;
$$;

grant execute on function public.admin_list_premium() to authenticated;

-- ─── Como adicionar um admin novo ───────────────────────────────────────────
--
--   insert into public.app_admins (user_id, note)
--   values ('<uid>', 'quem é') on conflict do nothing;
--
-- E adicionar o mesmo uid em ADMIN_USER_IDS (client/App.tsx) para liberar a
-- rota /admin no app.
