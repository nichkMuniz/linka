-- ============================================================
-- Migration: garantir Realtime na tabela `messages`
--
-- Contexto: a conversa privada (Comunidade → Mensagens) assina
-- `postgres_changes` INSERT em public.messages para mostrar mensagens novas
-- sem recarregar. Se a tabela NÃO estiver na publicação `supabase_realtime`,
-- nenhum evento chega e o usuário precisa sair da conversa e entrar de novo
-- para ver mensagem nova — por mais correto que esteja o código do cliente.
--
-- Não havia migração versionada disso no repositório (só
-- 20260331-checkin-reactions-realtime.sql, para outra tabela), então a
-- publicação pode ter sido feita só pelo painel do Supabase — ou nunca feita.
--
-- Idempotente: só adiciona se ainda não estiver publicada. Rodar de novo é
-- inofensivo (um `ALTER PUBLICATION ... ADD TABLE` cru daria erro se a tabela
-- já fosse membro).
--
-- Sobre RLS: a publicação NÃO burla RLS. O Realtime avalia as policies de
-- SELECT do assinante (`messages_select_participants`, em
-- 20260713-security-hardening.sql), então cada usuário só recebe eventos das
-- mensagens em que é remetente ou destinatário. Publicar é seguro.
--
-- Sobre REPLICA IDENTITY: só usamos o evento INSERT, que carrega a linha nova
-- por completo — a identidade padrão (chave primária) basta. Não setamos
-- REPLICA IDENTITY FULL de propósito: ela engorda o WAL e só seria necessária
-- se passássemos a ouvir UPDATE/DELETE com checagem de RLS na linha antiga.
-- ============================================================

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
    raise notice 'messages adicionada a publicacao supabase_realtime';
  else
    raise notice 'messages ja estava na publicacao supabase_realtime — nada a fazer';
  end if;
end $$;

-- Conferência (deve retornar 1 linha):
-- select schemaname, tablename
--   from pg_publication_tables
--  where pubname = 'supabase_realtime' and tablename = 'messages';
