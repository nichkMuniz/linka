-- ============================================================
-- Migration: Índices de performance — following/followers, messages,
-- notifications (2026-07-02)
-- ============================================================
-- Motivo: telas carregadas logo após o login (quem sigo/seguidores,
-- notificações, mensagens) estavam lentas. As tabelas abaixo nunca tiveram
-- índice nas colunas usadas nos filtros das queries de client/lib/ritmofit-db.ts,
-- então cada consulta fazia table scan. Ver docs/14-database-schema.md para
-- as tabelas atualizadas.
--
-- Rodar no Supabase (SQL Editor) de uma vez. Idempotente (IF NOT EXISTS).

-- following: getFollowingIdsDb/getFollowingDb filtram por user_id;
-- getFollowersDb filtra por following_id (following.following_id = alvo do follow)
CREATE INDEX IF NOT EXISTS following_user_id_idx ON following (user_id);
CREATE INDEX IF NOT EXISTS following_following_id_idx ON following (following_id);

-- followers: espelho de following, mesmo padrão de filtro
CREATE INDEX IF NOT EXISTS followers_user_id_idx ON followers (user_id);
CREATE INDEX IF NOT EXISTS followers_follower_id_idx ON followers (follower_id);

-- messages: getConversationsDb/getConversationMessagesDb filtram por
-- user_id OU following_id; getUnreadMessageCountDb filtra por
-- following_id + read. Índice composto cobre a query de não lidas sem
-- precisar de bookmark lookup adicional.
CREATE INDEX IF NOT EXISTS messages_user_id_idx ON messages (user_id);
CREATE INDEX IF NOT EXISTS messages_following_id_idx ON messages (following_id);
CREATE INDEX IF NOT EXISTS messages_following_id_read_idx ON messages (following_id, read);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages (created_at DESC);

-- notifications: getNotificationsDb ordena por created_at após filtrar por
-- user_id; getUnreadNotificationsCountDb filtra por user_id + read.
CREATE INDEX IF NOT EXISTS notifications_user_id_created_at_idx ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_id_read_idx ON notifications (user_id, read);
