-- ============================================================================
-- Migration: 20260827 — Realtime de UPDATE em `messages` (reação + visualizado)
--
-- ⚠️ OBRIGATÓRIA. Sem ela a correção no cliente é código morto: o handler de
--    UPDATE existe, mas o evento nunca chega.
--
-- Rodar DEPOIS de `20260720-messages-realtime.sql`.
--
-- PROBLEMA QUE ISTO RESOLVE:
--   A conversa privada assinava apenas `event: "INSERT"`. Duas coisas nunca
--   chegavam ao vivo, porque são UPDATE na MESMA linha e não linha nova:
--
--     • a REAÇÃO com emoji (`messages.emoji`, via `setMessageEmojiDb`)
--     • o VISUALIZADO / double check (`messages.read`, via `markMessagesAsReadDb`)
--
--   Quem estava com a conversa aberta só via a mudança ao sair e voltar.
--
-- POR QUE PRECISA DE REPLICA IDENTITY FULL:
--   `20260720-messages-realtime.sql` deixou a identidade padrão (chave
--   primária) DE PROPÓSITO, e documentou o motivo: só o INSERT era ouvido, e o
--   INSERT carrega a linha nova inteira. O próprio comentário previu este dia —
--   "só seria necessária se passássemos a ouvir UPDATE/DELETE com checagem de
--   RLS na linha antiga".
--
--   É exatamente o caso agora. O Realtime do Supabase aplica a RLS de cada
--   assinante antes de entregar o evento; para um UPDATE ele precisa da linha
--   ANTIGA para decidir se aquele assinante podia vê-la. Com a identidade
--   padrão, a linha antiga chega só com a PK — `user_id` e `following_id` vêm
--   nulos, a policy `messages_select_participants` não casa com ninguém e o
--   evento é descartado em silêncio.
--
-- CUSTO ACEITO:
--   REPLICA IDENTITY FULL grava a linha inteira no WAL a cada UPDATE, em vez de
--   só a PK. Em `messages` isso é pequeno — as linhas são curtas (texto, dois
--   uuids, um smallint) e o UPDATE é raro comparado ao INSERT: acontece quando
--   alguém reage a uma mensagem ou abre a conversa. É o preço de ter reação e
--   double check ao vivo.
--
-- Rodar no SQL Editor do Supabase.
-- ============================================================================

-- ─── 1. Identidade completa da linha ────────────────────────────────────────

alter table public.messages replica identity full;

-- ─── 2. Garantia de que a tabela está publicada ─────────────────────────────
--
-- `20260720` já fez isto; repetimos de forma idempotente para o caso de esta
-- migração rodar num ambiente onde aquela não passou.

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
  end if;
end $$;

-- ─── Verificação ────────────────────────────────────────────────────────────
--
-- Deve devolver 'f' (FULL):
--
--   select relreplident
--     from pg_class
--    where oid = 'public.messages'::regclass;
--
-- E a tabela deve aparecer aqui:
--
--   select tablename
--     from pg_publication_tables
--    where pubname = 'supabase_realtime' and schemaname = 'public';
