-- ============================================================================
-- Migration: 20260826 — Bloquear usuário (App Store Guideline 1.2)
--
-- ⚠️ OBRIGATÓRIA ANTES DE SUBMETER. Rodar DEPOIS de `20260713-security-hardening.sql`
--    (substitui a policy `messages_insert_own` criada lá).
--
-- POR QUE ISTO EXISTE:
--   A Guideline 1.2 (Safety — User-Generated Content) exige QUATRO mecanismos
--   em todo app com conteúdo de usuário. O LinKa tinha dois:
--
--     ✓ denunciar conteúdo      → `user_complaint` + fila do painel admin
--     ✓ moderar/remover         → `admin_delete_content`, banir
--     ✗ BLOQUEAR usuário abusivo ← esta migração
--     ✗ aceite de termos (EULA)  ← tratado no cliente (tela de cadastro)
--
--   Sem bloqueio, a rejeição por 1.2 é questão de tempo: é o item que o
--   revisor procura explicitamente num app social.
--
-- DECISÃO DE MODELO — bloqueio é MÚTUO na leitura, unilateral na escrita:
--   Quem bloqueia some para o bloqueado, e o bloqueado some para quem
--   bloqueou. Uma direção só não protege ninguém: se A bloqueia B mas continua
--   aparecendo no feed de B, B segue vendo, comentando e reagindo — que é
--   exatamente o assédio que o bloqueio deveria encerrar. Por isso
--   `is_blocked_between` é simétrica, enquanto a linha em `user_blocks` guarda
--   quem tomou a decisão (só essa pessoa pode desfazer).
--
-- Rodar no SQL Editor do Supabase.
-- ============================================================================

-- ─── 1. Tabela ──────────────────────────────────────────────────────────────

create table if not exists public.user_blocks (
  id          bigint generated always as identity primary key,
  blocker_id  uuid not null references auth.users(id) on delete cascade,
  blocked_id  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),

  -- Bloquear a si mesmo tornaria o próprio perfil invisível para o dono.
  constraint user_blocks_no_self check (blocker_id <> blocked_id),
  -- Bloquear duas vezes é no-op, não erro: o cliente faz insert direto.
  constraint user_blocks_unique unique (blocker_id, blocked_id)
);

-- Os dois sentidos são consultados a cada carga de feed (`getBlockedIdsDb` lê
-- as duas colunas num único `or`), então ambos precisam de índice.
create index if not exists user_blocks_blocker_idx on public.user_blocks (blocker_id);
create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_id);

-- ─── 2. RLS ─────────────────────────────────────────────────────────────────
--
-- SELECT nos dois sentidos é proposital: o cliente precisa saber que FOI
-- bloqueado para esconder o outro do seu próprio feed. Isso não vaza nada
-- sensível — no máximo revela que existe um bloqueio, o que o comportamento da
-- UI já denuncia. Já escrever e apagar é privilégio exclusivo de quem bloqueou.

alter table public.user_blocks enable row level security;

drop policy if exists "user_blocks_select_involved" on public.user_blocks;
create policy "user_blocks_select_involved"
  on public.user_blocks
  for select
  to authenticated
  using (auth.uid() = blocker_id or auth.uid() = blocked_id);

drop policy if exists "user_blocks_insert_own" on public.user_blocks;
create policy "user_blocks_insert_own"
  on public.user_blocks
  for insert
  to authenticated
  with check (auth.uid() = blocker_id);

-- Só quem bloqueou desbloqueia. Sem isto o bloqueado apagaria o próprio
-- bloqueio — e o recurso não valeria nada.
drop policy if exists "user_blocks_delete_own" on public.user_blocks;
create policy "user_blocks_delete_own"
  on public.user_blocks
  for delete
  to authenticated
  using (auth.uid() = blocker_id);

-- ─── 3. Predicado simétrico ─────────────────────────────────────────────────
--
-- SECURITY DEFINER porque é chamada de dentro de policies de OUTRAS tabelas,
-- onde o `auth.uid()` da vez não necessariamente enxerga a linha de bloqueio
-- pela RLS acima. `stable` permite ao planner reaproveitar o resultado dentro
-- da mesma query.

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
      from public.user_blocks
     where (blocker_id = a and blocked_id = b)
        or (blocker_id = b and blocked_id = a)
  );
$$;

revoke all on function public.is_blocked_between(uuid, uuid) from public;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;

-- ─── 4. Enforcement real: DM não atravessa bloqueio ─────────────────────────
--
-- Esconder no cliente resolve a leitura, mas não impede o abusador de ENVIAR.
-- Filtro de UI se contorna; policy, não. Esta é a única parte do bloqueio que
-- precisa viver no banco — o resto é apresentação.
--
-- Substitui `messages_insert_own` (20260713), preservando a regra original de
-- que ninguém assina mensagem como outra pessoa.

drop policy if exists "messages_insert_own" on public.messages;
drop policy if exists "messages_insert_not_blocked" on public.messages;
create policy "messages_insert_not_blocked"
  on public.messages
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and not public.is_blocked_between(auth.uid(), following_id)
  );

-- ─── 5. Bloquear desfaz o follow, nos dois sentidos ─────────────────────────
--
-- Continuar seguindo alguém que você bloqueou mantém a pessoa no seu feed
-- "Seguindo" e nas suas contagens — o bloqueio pareceria não ter funcionado.
-- O trigger resolve no banco para valer também quando a linha nasce por outro
-- caminho (admin, script, futura RPC).

create or replace function public.user_blocks_unfollow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.followers
   where (follower_id = new.blocker_id and user_id = new.blocked_id)
      or (follower_id = new.blocked_id and user_id = new.blocker_id);
  return new;
end;
$$;

drop trigger if exists user_blocks_unfollow_trg on public.user_blocks;
create trigger user_blocks_unfollow_trg
  after insert on public.user_blocks
  for each row execute function public.user_blocks_unfollow();
