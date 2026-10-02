-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-10-02 — Desafio de treino (types 24 e 25)
--
-- No fim do treino, a pessoa DESAFIA seguidores a bater os números dela nos
-- mesmos exercícios — sem revelar os números. Quem recebe vê só a lista de
-- exercícios, treina dando o máximo, e no resumo do treino dele aparece o
-- placar exercício a exercício (+ um canvas "Fulano desafiou Ciclano…").
--
-- Duas tabelas, de propósito:
--   • workout_challenges         — o desafio (quem, qual treino, status,
--                                  vencedor). Os DOIS lados leem.
--   • workout_challenge_results  — os números de cada um. A RLS esconde o
--                                  resultado do adversário até você gravar o
--                                  seu: é o que garante o "sem mostrar quanto
--                                  eu treinei" mesmo para quem chama a API
--                                  direto. RLS é por LINHA — por isso os números
--                                  não podem ficar numa coluna da tabela de cima.
--
-- Notificações (triggers SECURITY DEFINER; `post_id` = id do desafio, mesma
-- convenção do convite de treino, type 19):
--   • type 24 — "Fulano te desafiou" (INSERT do desafio) → para o desafiado;
--   • type 25 — "Ciclano completou seu desafio" (status → completed) → para
--     quem desafiou, com `meta` = { winner, challenger_score, challenged_score }.
--
-- Exclusão de conta: as colunas de usuário são ON DELETE CASCADE em auth.users
-- (e os resultados caem junto com o desafio), então `delete_user_data`, que
-- apaga auth.users na mesma transação, já as cobre sem entrar no `v_targets`.
--
-- Depois de rodar: REDEPLOY da edge function `send-push-notification` (texto
-- dos types 24/25). Rodar no Supabase SQL Editor ANTES do build.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.workout_challenges (
  id              uuid primary key default gen_random_uuid(),
  challenger_id   uuid not null references auth.users(id) on delete cascade,
  challenged_id   uuid not null references auth.users(id) on delete cascade,
  routine_name    text not null,
  -- Só a lista de exercícios (id, nome, grupo, foto, nº de séries) — NUNCA
  -- carga ou repetições. Formato `WorkoutChallengeSnapshot` no app.
  snapshot        jsonb not null,
  status          text not null default 'pending'
                  check (status in ('pending', 'accepted', 'completed', 'declined')),
  -- Gravados por quem completa o desafio (o desafiado).
  winner          text check (winner in ('challenger', 'challenged', 'tie')),
  challenger_score integer,
  challenged_score integer,
  created_at      timestamptz not null default now(),
  -- Uma semana para aceitar e treinar.
  expires_at      timestamptz not null default now() + interval '7 days',
  responded_at    timestamptz,
  completed_at    timestamptz,
  check (challenger_id <> challenged_id)
);

create index if not exists workout_challenges_challenged_idx
  on public.workout_challenges (challenged_id, status, created_at desc);
create index if not exists workout_challenges_challenger_idx
  on public.workout_challenges (challenger_id, created_at desc);

create table if not exists public.workout_challenge_results (
  challenge_id  uuid not null references public.workout_challenges(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  -- { exercises: [{ workoutId, name, isCardio, sets, bestKg, reps, volumeKg, km }],
  --   totalVolumeKg, totalSets } — formato `WorkoutChallengeResult` no app.
  result        jsonb not null,
  created_at    timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

alter table public.workout_challenges         enable row level security;
alter table public.workout_challenge_results  enable row level security;

-- Helpers SECURITY DEFINER: a policy de uma tabela consultando a outra (ou a
-- si mesma) direto entraria em recursão de RLS.
create or replace function public.is_workout_challenge_party(p_challenge uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workout_challenges c
     where c.id = p_challenge
       and auth.uid() in (c.challenger_id, c.challenged_id)
  );
$$;

create or replace function public.has_workout_challenge_result(p_challenge uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workout_challenge_results r
     where r.challenge_id = p_challenge and r.user_id = auth.uid()
  );
$$;

revoke all on function public.is_workout_challenge_party(uuid) from public;
revoke all on function public.has_workout_challenge_result(uuid) from public;
grant execute on function public.is_workout_challenge_party(uuid) to authenticated;
grant execute on function public.has_workout_challenge_result(uuid) to authenticated;

-- ── workout_challenges ──────────────────────────────────────────────────────
drop policy if exists workout_challenges_select on public.workout_challenges;
create policy workout_challenges_select on public.workout_challenges
  for select to authenticated
  using (auth.uid() in (challenger_id, challenged_id));

-- Só desafia em nome próprio, e nunca alguém com bloqueio entre os dois.
drop policy if exists workout_challenges_insert on public.workout_challenges;
create policy workout_challenges_insert on public.workout_challenges
  for insert to authenticated
  with check (
    challenger_id = auth.uid()
    and not exists (
      select 1 from public.user_blocks b
       where (b.blocker_id = challenger_id and b.blocked_id = challenged_id)
          or (b.blocker_id = challenged_id and b.blocked_id = challenger_id)
    )
  );

-- O desafiado responde (aceitar/recusar) e grava o resultado final; quem
-- desafiou não muda nada depois de enviar.
drop policy if exists workout_challenges_update on public.workout_challenges;
create policy workout_challenges_update on public.workout_challenges
  for update to authenticated
  using (challenged_id = auth.uid())
  with check (challenged_id = auth.uid());

drop policy if exists workout_challenges_delete on public.workout_challenges;
create policy workout_challenges_delete on public.workout_challenges
  for delete to authenticated
  using (challenger_id = auth.uid());

-- ── workout_challenge_results ───────────────────────────────────────────────
-- O próprio resultado, sempre. O do ADVERSÁRIO, só depois de gravar o seu —
-- quem desafiou grava ao criar, então vê o do desafiado assim que ele terminar;
-- o desafiado só vê o de quem desafiou depois de treinar.
drop policy if exists workout_challenge_results_select on public.workout_challenge_results;
create policy workout_challenge_results_select on public.workout_challenge_results
  for select to authenticated
  using (
    user_id = auth.uid()
    or (
      public.is_workout_challenge_party(challenge_id)
      and public.has_workout_challenge_result(challenge_id)
    )
  );

drop policy if exists workout_challenge_results_insert on public.workout_challenge_results;
create policy workout_challenge_results_insert on public.workout_challenge_results
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_workout_challenge_party(challenge_id)
  );
-- Sem UPDATE/DELETE: o resultado gravado é definitivo.

-- ── Notificação type 24: "Fulano te desafiou" ───────────────────────────────
create or replace function public.notify_workout_challenge_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.notifications (user_id, follower_id, type, post_id, read, created_at, meta)
    values (
      new.challenged_id, new.challenger_id, 24, new.id, false, now(),
      jsonb_build_object('routine_name', new.routine_name)
    );
  exception when others then
    raise warning 'notify_workout_challenge_created: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists trg_notify_workout_challenge_created on public.workout_challenges;
create trigger trg_notify_workout_challenge_created
  after insert on public.workout_challenges
  for each row execute function public.notify_workout_challenge_created();

-- ── Notificação type 25: "Ciclano completou seu desafio" ────────────────────
create or replace function public.notify_workout_challenge_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    begin
      insert into public.notifications (user_id, follower_id, type, post_id, read, created_at, meta)
      values (
        new.challenger_id, new.challenged_id, 25, new.id, false, now(),
        jsonb_build_object(
          'routine_name', new.routine_name,
          'winner', new.winner,
          'challenger_score', new.challenger_score,
          'challenged_score', new.challenged_score
        )
      );
    exception when others then
      raise warning 'notify_workout_challenge_completed: %', sqlerrm;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_workout_challenge_completed on public.workout_challenges;
create trigger trg_notify_workout_challenge_completed
  after update of status on public.workout_challenges
  for each row execute function public.notify_workout_challenge_completed();
