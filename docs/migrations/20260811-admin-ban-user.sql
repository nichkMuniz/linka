-- ============================================================================
-- Migration: 20260811 — Admin: banir/desbanir usuário pelo painel
--
-- ⚠️ Rodar DEPOIS de `20260729-admin-premium.sql` (usa `is_app_admin`).
--
-- PROBLEMA QUE ISTO RESOLVE:
--   `adminBanUserDb` fazia `update profiles set is_banned = true where id = <uuid>`.
--   `profiles.id` é **bigint** (PK interna) e o uuid do usuário mora em
--   `profiles.user_id` — daí o erro
--     `invalid input syntax for type bigint: "ac218e20-…"`.
--
--   Só trocar a coluna no cliente NÃO bastaria: a policy `profiles_update_own`
--   (20260713-security-hardening) limita o UPDATE à própria linha, então banir
--   outra pessoa casaria 0 linhas **sem retornar erro** — o mesmo no-op
--   silencioso que já quebra a seção "Contas Verificadas" (ver docs/18-admin.md).
--   Por isso a escrita passa por RPC `SECURITY DEFINER`, no mesmo molde de
--   `admin_set_premium`.
--
--   E `is_banned` sozinho não expulsava ninguém: era um flag lido só pelo card
--   de métricas. Quem manda o usuário embora de verdade é o `banned_until` do
--   GoTrue (bloco 4) — sem ele, "banir" era só uma anotação.
--
-- Rodar no SQL Editor do Supabase.
-- ============================================================================

-- ─── 1. Coluna ──────────────────────────────────────────────────────────────
--
-- `get_admin_analytics` já lê `is_banned` (card "Usuários banidos"), mas a
-- coluna nunca foi criada por migração — o `if not exists` cobre os dois casos.

alter table public.profiles
  add column if not exists is_banned boolean not null default false;

-- ─── 2. Ninguém se desbane sozinho ──────────────────────────────────────────
--
-- `profiles_update_own` deixa cada um escrever na própria linha, o que incluiria
-- `is_banned`. Mesmo molde do `freeze_is_verified`, com uma diferença: aqui o
-- admin também passa, porque a RPC abaixo roda com o JWT dele (SECURITY DEFINER
-- troca o privilégio no banco, não o `auth.uid()` visto pelo trigger).

create or replace function public.freeze_is_banned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_banned is distinct from old.is_banned
     and coalesce(current_setting('request.jwt.claims', true)::json ->> 'role', '') <> 'service_role'
     and auth.role() <> 'service_role'
     and not public.is_app_admin(auth.uid())
  then
    new.is_banned := old.is_banned;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_freeze_is_banned on public.profiles;
create trigger trg_freeze_is_banned
  before update on public.profiles
  for each row
  execute function public.freeze_is_banned();

-- ─── 3. O app precisa saber se ESTE usuário está banido ─────────────────────
--
-- A tela de bloqueio no cliente lê por aqui em vez de dar `select is_banned`
-- direto: `profiles` tem SELECT público, e uma RPC estreita não abre caminho
-- para varrer a base atrás de quem foi banido.

create or replace function public.is_current_user_banned()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_banned from public.profiles p where p.user_id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_current_user_banned() to authenticated;

-- ─── 4. Banir / desbanir ────────────────────────────────────────────────────
--
-- Retorno jsonb:
--   updated         → alguma linha de `profiles` mudou (false = perfil inexistente)
--   session_revoked → o GoTrue aceitou o `banned_until` E as sessões foram
--                     derrubadas. Se vier false, o flag foi gravado mas o
--                     usuário continua com acesso — o painel avisa em vez de
--                     dizer "banido" e deixar por isso mesmo.
--
-- Por que mexer em `auth.users`: a RLS não conhece "banido", e sair
-- reescrevendo policy de escrita de trinta tabelas seria muito mais arriscado
-- do que cortar a renovação do token na raiz. `banned_until` faz o GoTrue
-- recusar login e refresh; apagar `auth.sessions` invalida o refresh token que
-- já está no device. O access token corrente ainda vale até expirar (1h) — daí
-- a tela de bloqueio no cliente, que fecha essa janela na hora.

drop function if exists public.admin_set_banned(uuid, boolean);

create or replace function public.admin_set_banned(
  p_user_id uuid,
  p_banned  boolean default true
)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_rows    integer;
  v_revoked boolean := false;
begin
  if not public.is_app_admin(auth.uid()) then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  if p_user_id is null then
    raise exception 'INVALID_USER' using errcode = '22023';
  end if;

  -- Um admin banindo a si mesmo trancaria o painel para fora sem nenhum aviso.
  if p_user_id = auth.uid() then
    raise exception 'CANNOT_BAN_SELF' using errcode = '22023';
  end if;

  update public.profiles p
     set is_banned  = p_banned,
         updated_at = now()
   where p.user_id = p_user_id;

  get diagnostics v_rows = row_count;

  -- O schema `auth` é do `supabase_auth_admin`; o dono desta função costuma ter
  -- o grant, mas se um dia não tiver, o ban não pode explodir por causa disso —
  -- ele só volta com session_revoked = false.
  begin
    update auth.users u
       set banned_until = case when p_banned then now() + interval '100 years' else null end
     where u.id = p_user_id;
    v_revoked := true;
  exception when others then
    v_revoked := false;
  end;

  -- Bloco separado de propósito: um `exception` desfaz TUDO que o bloco fez
  -- (rollback até o savepoint de entrada). Juntas, uma falha ao apagar sessões
  -- levaria o `banned_until` junto — e o ban não valeria nada.
  -- Apagar a sessão é reforço: o `banned_until` sozinho já faz o GoTrue recusar
  -- o refresh; isto só antecipa a queda do token que está no device.
  if p_banned and v_revoked then
    begin
      delete from auth.sessions s where s.user_id = p_user_id;
    exception when others then
      null;
    end;
  end if;

  return jsonb_build_object(
    'updated', v_rows > 0,
    'session_revoked', v_revoked
  );
end;
$$;

grant execute on function public.admin_set_banned(uuid, boolean) to authenticated;

-- ─── Verificação rápida (opcional) ──────────────────────────────────────────
--
--   select public.admin_set_banned('<uuid do alvo>', true);
--   → {"updated": true, "session_revoked": true}
--
--   select id, email, banned_until from auth.users where id = '<uuid do alvo>';
--
-- Desbanir: select public.admin_set_banned('<uuid>', false);
