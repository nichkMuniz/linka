-- ============================================================================
-- Migration: 20260925 — `get_conversation_summaries()`: lista de conversas
-- montada no banco
--
-- ⚠️ OBRIGATÓRIA. Sem ela o app cai no caminho antigo (com o bug abaixo),
-- mas continua funcionando.
--
-- O BUG:
--   `getConversationsDb` buscava as 500 mensagens mais recentes do usuário e
--   agrupava por pessoa no aparelho. Quem troca muita mensagem com poucas
--   pessoas via as conversas mais antigas SUMIREM da lista (todas as 500
--   eram de 2 ou 3 conversas). A contagem de não lidas também saía só dessas
--   500, então ficava menor que a real.
--
-- O QUE ESTA MIGRAÇÃO FAZ:
--   Uma função que devolve UMA linha por conversa: com quem, última mensagem,
--   quando e quantas não lidas, respeitando o "apagar conversa"
--   (`message_deletions`). O app só busca os perfis e o estado de bloqueio.
--
--   SECURITY INVOKER de propósito: roda com a RLS de quem chama, então só
--   enxerga as próprias conversas (`messages_select_participants`).
--
-- Reexecutável.
-- ============================================================================

create or replace function public.get_conversation_summaries()
returns table (
  other_user_id   uuid,
  last_message    text,
  last_message_at timestamptz,
  unread_count    bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with visible as (
    select
      m.id,
      m.text,
      m.created_at,
      m.read,
      m.following_id,
      case when m.user_id = auth.uid() then m.following_id else m.user_id end as other_id
    from public.messages m
    where (m.user_id = auth.uid() or m.following_id = auth.uid())
      and not exists (
        select 1 from public.message_deletions d
         where d.message_id = m.id
           and d.user_id = auth.uid()
      )
  ),
  last_per_conversation as (
    select distinct on (other_id)
           other_id, text, created_at
      from visible
     where other_id is not null
     order by other_id, created_at desc, id desc
  ),
  unread as (
    select other_id, count(*) as n
      from visible
     where following_id = auth.uid()
       and read = 0
     group by other_id
  )
  select l.other_id, l.text, l.created_at, coalesce(u.n, 0)
    from last_per_conversation l
    left join unread u using (other_id)
   order by l.created_at desc;
$$;

revoke all on function public.get_conversation_summaries() from public, anon;
grant execute on function public.get_conversation_summaries() to authenticated;

-- Índices para o `distinct on` não varrer a tabela inteira: um por lado da
-- conversa, na ordem em que a função lê.
create index if not exists messages_sender_recipient_created_idx
  on public.messages (user_id, following_id, created_at desc);
create index if not exists messages_recipient_sender_created_idx
  on public.messages (following_id, user_id, created_at desc);
