-- ============================================================
-- Migration: Treinar junto (workout party) — 2026-08-26
--
-- Permite que alguém chame QUALQUER número de amigos/seguidores para fazer o
-- mesmo treino ao vivo. Quem convida (`host`) começa a sessão na hora; cada
-- convidado recebe um convite (push type 19) e, ao aceitar, entra numa sessão
-- ESPELHO montada a partir do `snapshot` — os mesmos exercícios, séries e reps
-- sugeridas, mas com as cargas do histórico dele.
--
-- Decisão central: o convidado NÃO ganha uma rotina ao aceitar. A sessão dele é
-- efêmera (nenhuma linha em `routines`/`user_workouts`), e só no fim do treino
-- o app pergunta se ele quer salvar aquela rotina. Por isso o `snapshot` vive
-- aqui, na party: é a única cópia do treino que o convidado tem antes de
-- decidir. O histórico do treino dele é gravado normalmente, com
-- `user_workout_id` e `routine_id` nulos (`workout_history` já aceita isso —
-- é o mesmo caminho dos exercícios avulsos).
--
-- Sem limite de participantes: `workout_party_members` é 1:N, e a UI deixa
-- marcar quantos seguidores quiser (o "treino em dupla" é só o caso N=2).
-- ============================================================

-- ── Tabelas ─────────────────────────────────────────────────

create table if not exists public.workout_parties (
  id           uuid primary key default gen_random_uuid(),
  host_id      uuid not null references auth.users(id) on delete cascade,
  -- Rotina de ORIGEM (a do host). Nula quando ele treina sem rotina salva.
  -- ON DELETE SET NULL: apagar a rotina não pode derrubar o treino em curso.
  routine_id   bigint references public.routines(id) on delete set null,
  routine_name text,
  -- Cópia congelada do treino no momento do convite: exercícios, séries e reps
  -- sugeridas. Formato `WorkoutPartySnapshot` (client/lib/ritmofit-db.ts).
  -- Congelado de propósito: o host pode adicionar/remover exercício durante o
  -- treino sem que a tela do convidado mude embaixo dele.
  snapshot     jsonb not null,
  created_at   timestamptz not null default now(),
  -- Convite morre sozinho: treino é um evento do AGORA. Uma hora depois,
  -- aceitar não faz mais sentido — o host já terminou.
  expires_at   timestamptz not null default now() + interval '60 minutes',
  ended_at     timestamptz
);

create table if not exists public.workout_party_members (
  party_id       uuid not null references public.workout_parties(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  role           text not null default 'guest' check (role in ('host','guest')),
  -- pending  = convidado, ainda não respondeu
  -- accepted = está treinando junto
  -- declined = recusou
  -- left     = entrou e saiu (ou finalizou o treino)
  status         text not null default 'pending' check (status in ('pending','accepted','declined','left')),
  -- Progresso mostrado no header da sessão de todo mundo ("Ana · 3/6").
  -- Exercícios concluídos / total — atualizado a cada exercício, não a cada
  -- série: a cada série seriam ~40 writes por pessoa por treino, e o header
  -- não mostra essa granularidade.
  progress_done  integer not null default 0,
  progress_total integer not null default 0,
  responded_at   timestamptz,
  updated_at     timestamptz not null default now(),
  primary key (party_id, user_id)
);

create index if not exists workout_parties_host_idx
  on public.workout_parties (host_id, created_at desc);

-- Busca do convite pendente ao abrir o app: "minhas linhas, por status".
create index if not exists workout_party_members_user_idx
  on public.workout_party_members (user_id, status);

-- ── RLS ─────────────────────────────────────────────────────

alter table public.workout_parties        enable row level security;
alter table public.workout_party_members  enable row level security;

-- Helper SECURITY DEFINER: sem ele a policy de `workout_party_members`
-- precisaria consultar a própria tabela e o Postgres entra em recursão
-- infinita de policy.
create or replace function public.is_workout_party_member(p_party uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workout_party_members m
     where m.party_id = p_party and m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_workout_party_member(uuid) from public;
grant execute on function public.is_workout_party_member(uuid) to authenticated;

-- parties: quem é membro (host incluso) lê; só o host cria e encerra.
drop policy if exists workout_parties_select on public.workout_parties;
create policy workout_parties_select on public.workout_parties
  for select to authenticated
  using (host_id = auth.uid() or public.is_workout_party_member(id));

drop policy if exists workout_parties_insert on public.workout_parties;
create policy workout_parties_insert on public.workout_parties
  for insert to authenticated
  with check (host_id = auth.uid());

drop policy if exists workout_parties_update on public.workout_parties;
create policy workout_parties_update on public.workout_parties
  for update to authenticated
  using (host_id = auth.uid())
  with check (host_id = auth.uid());

drop policy if exists workout_parties_delete on public.workout_parties;
create policy workout_parties_delete on public.workout_parties
  for delete to authenticated
  using (host_id = auth.uid());

-- members: todo participante enxerga a lista inteira (é o que alimenta os
-- avatares no header da sessão).
drop policy if exists workout_party_members_select on public.workout_party_members;
create policy workout_party_members_select on public.workout_party_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_workout_party_member(party_id));

-- Só o HOST convida (insere linhas de outras pessoas). Isso é o que impede
-- alguém de se auto-adicionar numa party alheia para ler o treino dos outros.
drop policy if exists workout_party_members_insert on public.workout_party_members;
create policy workout_party_members_insert on public.workout_party_members
  for insert to authenticated
  with check (
    exists (
      select 1 from public.workout_parties p
       where p.id = party_id and p.host_id = auth.uid()
    )
  );

-- Cada um responde e reporta o próprio progresso — e só o próprio.
drop policy if exists workout_party_members_update on public.workout_party_members;
create policy workout_party_members_update on public.workout_party_members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── Realtime ────────────────────────────────────────────────
-- O header da sessão mostra quem aceitou e em que exercício cada um está;
-- sem publicar, isso só apareceria ao reabrir a tela.
-- Idempotente: `ALTER PUBLICATION ... ADD TABLE` cru dá erro se já for membro.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'workout_party_members'
  ) then
    alter publication supabase_realtime add table public.workout_party_members;
    raise notice 'workout_party_members adicionada a publicacao supabase_realtime';
  else
    raise notice 'workout_party_members ja estava na publicacao — nada a fazer';
  end if;
end $$;

-- Conferência:
-- select * from pg_policies where tablename in ('workout_parties','workout_party_members');
