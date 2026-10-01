-- ============================================================================
-- Migration: 20261001 — aviso ao autor quando a moderação remove o conteúdo
--
-- ⚠️ Rodar DEPOIS de `20260814-admin-delete-flow-poster.sql` (recria a função
--    de lá) e ANTES de publicar o build: o app novo chama
--    `admin_delete_content(p_tipo, p_id, p_reason)`. Sem esta migração o app cai
--    no fallback de 2 argumentos (remove, mas o autor não é avisado).
-- ⚠️ Depois de aplicar: REDEPLOY da edge function `send-push-notification`
--    (texto do push do type 22).
--
-- O QUE MUDA
--
--   1. `notifications.meta jsonb` — dados de notificações do SISTEMA, que não
--      têm "quem originou" nem conteúdo vivo para apontar. Para o type 22:
--        { "kind": "post"|"shot"|"flow",
--          "reason": "inappropriate"|"spam"|"harassment"|"copyright"|"other",
--          "preview": "<até 80 caracteres da legenda>" }
--      O conteúdo já foi apagado, então `post_id`/`shots_id`/`flow_id` ficam
--      NULL de propósito: apontar para a linha removida daria um toque em
--      tela vazia. O preview é o que deixa o autor saber QUAL foi.
--
--   2. Type 22 = "seu conteúdo foi removido pela moderação". `follower_id` é
--      NULL — o autor não fica sabendo QUAL admin removeu (a coluna tem default
--      `gen_random_uuid()`, por isso o NULL vai explícito no insert).
--
--   3. `admin_delete_content` ganha `p_reason` e grava o type 22 na MESMA
--      transação do delete — só quando a linha saiu de fato (`deleted: true`),
--      e nunca quando o admin remove o próprio conteúdo. O push sai sozinho
--      pelo webhook de `notifications`.
--
--   A função antiga (2 argumentos) é DERRUBADA antes: com as duas no banco, o
--   PostgREST não sabe qual chamar quando o app manda 2 argumentos.
--
-- Rodar no SQL Editor do Supabase.
-- ============================================================================

-- ─── 1. Coluna de metadados ─────────────────────────────────────────────────
alter table public.notifications
  add column if not exists meta jsonb;

comment on column public.notifications.meta is
  'Dados de notificações do sistema (sem follower_id). Type 22: {kind, reason, preview}.';

-- ─── 2. Remover conteúdo + avisar o autor ───────────────────────────────────
drop function if exists public.admin_delete_content(text, text);

create or replace function public.admin_delete_content(
  p_tipo   text,
  p_id     text,
  p_reason text default null
)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_rows    integer := 0;
  v_media   text[] := '{}';
  v_photos  text[];
  v_one     text;
  v_author  uuid;
  v_preview text;
  v_reason  text;
begin
  if not public.is_app_admin(auth.uid()) then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  if p_id is null or btrim(p_id) = '' then
    raise exception 'INVALID_ID' using errcode = '22023';
  end if;

  -- Motivo fora da lista vira "other": o app traduz pelo código, e um código
  -- desconhecido mostraria a chave crua para o usuário.
  v_reason := case
    when p_reason in ('inappropriate', 'spam', 'harassment', 'copyright', 'other') then p_reason
    else 'other'
  end;

  if p_tipo = 'post' then
    -- Autor, legenda e mídia ANTES do delete, senão a linha já não está lá.
    select p.user_id, p.description, p.photo
      into v_author, v_preview, v_one
      from public.posts p where p.id::text = p_id;
    if v_one is not null and v_one <> '' then
      v_media := array_append(v_media, v_one);
    end if;

    begin
      select coalesce(array_agg(e), '{}'::text[])
        into v_photos
        from public.posts p,
             lateral jsonb_array_elements_text(p.photos) e
       where p.id::text = p_id
         and jsonb_typeof(p.photos) = 'array';
      v_media := v_media || coalesce(v_photos, '{}'::text[]);
    exception when others then
      -- `photos` com formato inesperado não pode impedir a remoção do post.
      null;
    end;

    perform public.admin_purge_refs('notifications',  'post_id', p_id);
    perform public.admin_purge_refs('likes',          'post_id', p_id);
    perform public.admin_purge_refs('comments',       'post_id', p_id);
    perform public.admin_purge_refs('post_tags',      'post_id', p_id);
    perform public.admin_purge_refs('post_complaint', 'post_id', p_id);

    delete from public.posts p where p.id::text = p_id;
    get diagnostics v_rows = row_count;

  elsif p_tipo = 'shot' then
    select s.user_id, s.description, s.video_url
      into v_author, v_preview, v_one
      from public.shots s where s.id::text = p_id;
    if v_one is not null and v_one <> '' then
      v_media := array_append(v_media, v_one);
    end if;

    perform public.admin_purge_refs('notifications',    'shots_id', p_id);
    perform public.admin_purge_refs('shots_likes',      'shots_id', p_id);
    perform public.admin_purge_refs('shots_comments',   'shots_id', p_id);
    perform public.admin_purge_refs('shot_user_viewed', 'shot_id',  p_id);
    perform public.admin_purge_refs('shots_complaint',  'shots_id', p_id);

    delete from public.shots s where s.id::text = p_id;
    get diagnostics v_rows = row_count;

  elsif p_tipo = 'flow' then
    select f.user_id, f.description, f.media_url
      into v_author, v_preview, v_one
      from public.flow f where f.id::text = p_id;
    if v_one is not null and v_one <> '' then
      v_media := array_append(v_media, v_one);
    end if;

    -- Capa do vídeo (20260814). Bloco protegido porque a coluna só existe a
    -- partir da 20260812-flow-poster.
    begin
      execute 'select f.poster_url from public.flow f where f.id::text = $1'
        into v_one using p_id;
      if v_one is not null and v_one <> '' then
        v_media := array_append(v_media, v_one);
      end if;
    exception when undefined_column then
      null;
    end;

    -- Um repost aponta para o original (`flow.reposted_from`): sem soltar a
    -- referência, o delete morre em violação de FK. O repost em si continua no
    -- ar — quem foi denunciado foi o original.
    begin
      execute 'update public.flow set reposted_from = null, reposted_from_user = null
                where reposted_from::text = $1' using p_id;
    exception when undefined_column then
      null;
    end;

    perform public.admin_purge_refs('notifications',    'flow_id', p_id);
    perform public.admin_purge_refs('flow_likes',       'flow_id', p_id);
    perform public.admin_purge_refs('flow_comments',    'flow_id', p_id);
    perform public.admin_purge_refs('flow_user_viewed', 'flow_id', p_id);
    perform public.admin_purge_refs('flow_tags',        'flow_id', p_id);
    perform public.admin_purge_refs('flow_complaint',   'flow_id', p_id);

    delete from public.flow f where f.id::text = p_id;
    get diagnostics v_rows = row_count;

  else
    raise exception 'INVALID_TIPO' using errcode = '22023';
  end if;

  -- ── Aviso ao autor (type 22) ──────────────────────────────────────────────
  -- Bloco protegido: o aviso nunca pode desfazer uma remoção que já aconteceu.
  if v_rows > 0 and v_author is not null and v_author <> auth.uid() then
    begin
      v_preview := nullif(btrim(regexp_replace(coalesce(v_preview, ''), '\s+', ' ', 'g')), '');
      if v_preview is not null and char_length(v_preview) > 80 then
        v_preview := left(v_preview, 79) || '…';
      end if;

      insert into public.notifications (user_id, follower_id, type, read, meta)
      values (
        v_author,
        null,
        22,
        false,
        jsonb_build_object('kind', p_tipo, 'reason', v_reason, 'preview', v_preview)
      );
    exception when others then
      raise warning 'admin_delete_content: aviso ao autor falhou — %', sqlerrm;
    end;
  end if;

  return jsonb_build_object(
    'deleted',  v_rows > 0,
    'media',    to_jsonb(v_media),
    'notified', coalesce(v_rows > 0 and v_author is not null and v_author <> auth.uid(), false)
  );
end;
$$;

grant execute on function public.admin_delete_content(text, text, text) to authenticated;

-- ─── Conferência ────────────────────────────────────────────────────────────
--
-- Só deve existir UMA assinatura, com 3 argumentos:
--
--   select oid::regprocedure from pg_proc where proname = 'admin_delete_content';
--
-- ⚠️ O REPOST COMPARTILHA O ARQUIVO (ver 20260814): a `media` devolvida pode
--    citar arquivo que outro flow/post ainda usa. Quem apaga é o cliente
--    (`adminDeleteContentDb`), filtrando por `filterUnreferencedUrls`.
