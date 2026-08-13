-- ============================================================
-- Migration: Realtime em `duel_group_participants` — 2026-08-13
--
-- Contexto: a aba Solicitações (Comunidade) precisa ser AO VIVO. O dono do
-- grupo recebe o push do pedido, toca na notificação e cai direto nela — se a
-- lista vier do cache, ele vê o estado de antes do pedido e só descobre a
-- solicitação fechando e reabrindo o app (bug relatado em 12/08/2026).
--
-- O lado do cliente já foi corrigido em duas frentes:
--   1. leitura sem cache (`{ fresh: true }` em getPendingGroupRequestsDb e
--      getEnrichedDuelGroupsDb) ao entrar na aba e ao voltar do background;
--   2. assinatura `postgres_changes` em public.duel_group_participants, que
--      atualiza pedido/convite/aprovação sem ninguém recarregar nada.
--
-- O item 2 só funciona se a tabela estiver na publicação `supabase_realtime`.
-- Sem isso o app continua correto (o item 1 cobre o caso do push), mas a
-- aprovação não aparece sozinha na tela do solicitante.
--
-- Idempotente: só adiciona se ainda não estiver publicada (um
-- `ALTER PUBLICATION ... ADD TABLE` cru daria erro se já fosse membro).
--
-- Sobre RLS: publicar NÃO burla RLS — o Realtime avalia as policies de SELECT
-- do assinante, as mesmas que o app já usa para ler a tabela. Além disso o
-- cliente descarta eventos que não sejam do próprio usuário ou de grupo do
-- qual ele é dono.
--
-- Sobre REPLICA IDENTITY: mantida a padrão (chave primária). INSERT e UPDATE
-- carregam a linha nova por completo, que é o que o filtro do cliente usa. O
-- DELETE traz só a PK — por isso o cliente trata DELETE como "recarrega", sem
-- tentar filtrar. Setar REPLICA IDENTITY FULL só engordaria o WAL.
-- ============================================================

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'duel_group_participants'
  ) then
    alter publication supabase_realtime add table public.duel_group_participants;
    raise notice 'duel_group_participants adicionada a publicacao supabase_realtime';
  else
    raise notice 'duel_group_participants ja estava na publicacao supabase_realtime — nada a fazer';
  end if;
end $$;

-- Conferência (deve retornar 1 linha):
-- select schemaname, tablename
--   from pg_publication_tables
--  where pubname = 'supabase_realtime' and tablename = 'duel_group_participants';
