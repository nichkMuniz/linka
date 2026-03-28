-- Migration: comment_reactions
-- Tabela unificada para reações em comentários de posts, shots, flows e check-ins de duelos
-- comment_type: 'post' | 'shot' | 'flow' | 'checkin'

create table if not exists comment_reactions (
  id          uuid primary key default gen_random_uuid(),
  comment_type text not null check (comment_type in ('post', 'shot', 'flow', 'checkin')),
  comment_id  text not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  unique (comment_type, comment_id, user_id, emoji)
);

-- Índices para leitura eficiente por lote de IDs
create index if not exists idx_comment_reactions_lookup
  on comment_reactions (comment_type, comment_id);

-- RLS
alter table comment_reactions enable row level security;

-- Qualquer pessoa autenticada pode ver reações
create policy "comment_reactions_select"
  on comment_reactions for select
  to authenticated
  using (true);

-- Usuário autenticado pode inserir a própria reação
create policy "comment_reactions_insert"
  on comment_reactions for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Usuário autenticado pode remover a própria reação
create policy "comment_reactions_delete"
  on comment_reactions for delete
  to authenticated
  using (auth.uid() = user_id);
