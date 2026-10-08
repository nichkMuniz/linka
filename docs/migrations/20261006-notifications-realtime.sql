-- ============================================================
-- Migration: Realtime na tabela `notifications`
--
-- Sintoma (06/10/2026): com o app aberto, incentivo, comentário, seguidor etc.
-- não mostravam pop up nenhum, e o badge do sino só acendia ao atualizar a tela.
-- A mensagem privada mostrava — ela vem pelo Realtime de `messages`.
--
-- Causa, conferida no banco: `public.notifications` NÃO está na publicação
-- `supabase_realtime`. Assinar a tabela devolve
--   "Unable to subscribe to changes with given parameters. Please check
--    Realtime is enabled for the given connect parameters: [... table:
--    notifications ...]"
-- e nenhum INSERT chega ao app. O cliente já estava pronto e não muda:
--   - AppLayout (canal `app-layout-notif-push`) → pop up in-app
--     `IncomingMessageToast` (kind "notification"), em qualquer tela;
--   - `subscribeToUnreadNotificationsDb` → badge do sino ao vivo;
--   - Notifications.tsx → item novo entra na lista sem recarregar.
-- Não havia migração versionada publicando a tabela no repositório.
--
-- NÃO exige build novo: a publicação é do servidor, e os builds já
-- distribuídos passam a receber os eventos assim que esta migração roda.
--
-- Idempotente: só adiciona se ainda não estiver publicada (um
-- `ALTER PUBLICATION ... ADD TABLE` cru daria erro se já fosse membro).
--
-- Sobre RLS: publicar NÃO burla RLS. O Realtime avalia a policy de SELECT do
-- assinante — em `notifications` só o destinatário lê a própria linha — então
-- cada usuário recebe só as notificações dele.
--
-- Sobre REPLICA IDENTITY: o que importa é o INSERT (pop up, badge, lista), que
-- carrega a linha nova inteira — a identidade padrão (chave primária) basta.
-- UPDATE/DELETE (marcar lida, "Limpar") chegam só com a PK e a RLS os descarta;
-- não fazem falta: a própria tela zera o badge ao abrir. FULL só engordaria o
-- WAL de uma tabela que recebe uma linha por curtida.
-- ============================================================

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
    raise notice 'notifications adicionada a publicacao supabase_realtime';
  else
    raise notice 'notifications ja estava na publicacao supabase_realtime — nada a fazer';
  end if;
end $$;

-- Conferência (deve retornar 1 linha):
-- select schemaname, tablename
--   from pg_publication_tables
--  where pubname = 'supabase_realtime' and tablename = 'notifications';
