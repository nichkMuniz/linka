-- Migration: shot_user_viewed
-- Registra as visualizações de Shots por usuário — espelha a tabela
-- `flow_user_viewed` usada na tela de Flow. Permite ao dono do Shot ver
-- quem visualizou seu clipe (drawer "Visualizações" na tela de Shots).
--
-- Diferença em relação a flow_user_viewed: aqui `shot_id` é bigint, pois
-- `shots.id` é bigint identity (flow.id é numérico da mesma forma).

create table if not exists public.shot_user_viewed (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,       -- dono do Shot visualizado
  follower_id uuid not null references auth.users(id) on delete cascade,       -- usuário que visualizou
  shot_id     bigint not null references public.shots(id) on delete cascade,   -- Shot visualizado
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Uma visualização por usuário por Shot (dedupe entre sessões/telas)
  unique (follower_id, shot_id)
);

-- RLS
alter table public.shot_user_viewed enable row level security;

-- O dono do Shot vê quem o visualizou; o visualizador enxerga os próprios
-- registros (necessário para o SELECT de deduplicação em recordShotViewDb).
create policy "Dono ou visualizador leem visualizacoes do shot"
  on public.shot_user_viewed for select
  using (auth.uid() = user_id or auth.uid() = follower_id);

-- Um usuário só registra as próprias visualizações
create policy "Usuario registra a propria visualizacao"
  on public.shot_user_viewed for insert
  with check (auth.uid() = follower_id);

-- Atualização do updated_at pelo próprio visualizador
create policy "Usuario atualiza a propria visualizacao"
  on public.shot_user_viewed for update
  using (auth.uid() = follower_id);

-- Limpeza: tanto o dono quanto o visualizador podem remover seus registros
-- (usado por deleteAllUserDataDb e pela exclusão de Shots do próprio dono)
create policy "Dono ou visualizador removem visualizacoes"
  on public.shot_user_viewed for delete
  using (auth.uid() = user_id or auth.uid() = follower_id);

-- Índices
create index if not exists shot_user_viewed_shot_idx
  on public.shot_user_viewed (shot_id);
create index if not exists shot_user_viewed_user_idx
  on public.shot_user_viewed (user_id);
