-- ============================================================================
-- Migration: 20260814 — Storage: deixar o dono apagar a própria mídia
--
-- PROBLEMA
--
--   Excluir um post/shot/flow/check-in tirava a linha do banco, mas o ARQUIVO
--   continuava no bucket `posts` para sempre. Duas causas somadas:
--
--     1. O código quase nunca pedia a remoção. Só `deletePostDb` tentava, e
--        mesmo assim apenas a foto principal (`photo`) — o carrossel inteiro
--        (`photos`), os vídeos de shot e a mídia de flow nunca eram tocados.
--        Corrigido no cliente em 2026-08-14.
--
--     2. Mesmo onde pedia, a RLS do Storage barrava. `storage.objects` tem RLS
--        ligada e, sem policy de DELETE, `storage.remove()` responde **200 com
--        lista vazia**: nenhum erro, nenhum arquivo apagado. É o mesmo no-op
--        silencioso que já mordeu o histórico de rotina (20260716-hist-delete-rls)
--        e o painel de moderação (20260811-admin-moderation).
--
--   Sem o item 2 desta migração, a correção do cliente não apaga nada.
--
-- ESCOPO
--
--   Só DELETE, só no bucket `posts`, só sobre arquivo do próprio usuário.
--   Não mexe em SELECT (o bucket é público de propósito) nem em INSERT.
--
-- COMO A POSSE É DETERMINADA
--
--   O bucket `posts` acumulou vários formatos de caminho ao longo do tempo:
--
--     {uid}/{ts}-{i}.jpg              → foto de post
--     {uid}/profile-{ts}.jpg          → avatar
--     {uid}/shots/{ts}.mp4            → vídeo de shot
--     {uid}/stories/{ts}-story.jpg    → mídia de flow (+ -poster.jpg)
--     checkins/{uid}/{ts}-{i}.jpg     → foto de check-in de duelo
--     workout-summary/{uid}/{ts}.jpg  → card de resumo de treino
--     exercise-photos/{uid}/{ts}.jpg  → foto de exercício custom
--     covers/{uid}-{ts}.jpg           → capa de perfil (uid no NOME, não em pasta)
--     group-covers/{groupId}/{ts}.jpg → capa de duelo (sem uid no caminho)
--
--   Por isso a policy casa por três caminhos diferentes, mais `owner` — que o
--   Storage preenche com o uid de quem subiu e cobre qualquer formato futuro.
--   `group-covers/` fica de fora de propósito: o caminho traz o id do GRUPO, e
--   quem pode apagar capa de grupo é assunto de moderação do duelo, não desta
--   migração.
-- ============================================================================

-- ─── 1. Apagar a própria mídia no bucket `posts` ────────────────────────────

drop policy if exists "posts_delete_own_media" on storage.objects;
create policy "posts_delete_own_media"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'posts'
    and (
      -- Arquivo subido por mim (o Storage grava isto sozinho no upload).
      owner = auth.uid()
      -- {uid}/... — post, avatar, shot, flow
      or (storage.foldername(name))[1] = auth.uid()::text
      -- {prefixo}/{uid}/... — check-in, resumo de treino, exercício custom
      or (
        (storage.foldername(name))[1] in ('checkins', 'workout-summary', 'exercise-photos')
        and (storage.foldername(name))[2] = auth.uid()::text
      )
      -- covers/{uid}-{ts}.jpg — capa de perfil
      or (
        (storage.foldername(name))[1] = 'covers'
        and name like 'covers/' || auth.uid()::text || '-%'
      )
    )
  );

-- ─── 2. Conferência ─────────────────────────────────────────────────────────
--
-- Deve listar a policy recém-criada:
--
--   select policyname, cmd
--     from pg_policies
--    where schemaname = 'storage' and tablename = 'objects'
--      and policyname = 'posts_delete_own_media';
--
-- Teste de ponta a ponta (no app, logado): publique um post com 2 fotos,
-- exclua, e confirme no painel Storage → posts → {seu uid}/ que os DOIS
-- arquivos sumiram. Se sobrarem, o console do app mostra o aviso
-- "provável falta de policy de DELETE em storage.objects" (removeStorageObjects).
