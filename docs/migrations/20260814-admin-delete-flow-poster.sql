-- ============================================================================
-- Migration: 20260814 — Admin: incluir a capa do flow na mídia removida
--
-- ⚠️ Rodar DEPOIS de `20260811-admin-moderation.sql` (recria a função de lá)
--    e de `20260812-flow-poster.sql` (cria a coluna `flow.poster_url`).
--
-- PROBLEMA
--
--   `admin_delete_content` nasceu na 20260811 e coleta a mídia do flow lendo só
--   `flow.media_url`. A coluna `flow.poster_url` — o JPEG do primeiro frame do
--   vídeo, gerado no cliente ao postar — só apareceu no dia seguinte, na
--   20260812-flow-poster, e ninguém voltou aqui.
--
--   Resultado: todo flow em vídeo removido pela moderação desde então deixou a
--   capa órfã no bucket. Arquivo pequeno (dezenas de KB), mas um por flow.
--
-- O QUE MUDA
--
--   Só o ramo `flow`, que passa a acrescentar `poster_url` a `v_media`. O resto
--   da função é idêntico à 20260811 — está reproduzido aqui porque o Postgres
--   não sabe editar um pedaço de function: `create or replace` exige o corpo
--   inteiro.
--
-- ⚠️ A leitura de `poster_url` fica dentro de um bloco com
--    `exception when undefined_column`: se este banco ainda não rodou a
--    20260812, a moderação continua funcionando em vez de estourar.
--
-- Rodar no SQL Editor do Supabase.
-- ============================================================================

create or replace function public.admin_delete_content(
  p_tipo text,
  p_id   text
)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_rows   integer := 0;
  v_media  text[] := '{}';
  v_photos text[];
  v_one    text;
begin
  if not public.is_app_admin(auth.uid()) then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  if p_id is null or btrim(p_id) = '' then
    raise exception 'INVALID_ID' using errcode = '22023';
  end if;

  if p_tipo = 'post' then
    -- Mídia antes do delete, senão a linha já não está lá para ser lida.
    select p.photo into v_one from public.posts p where p.id::text = p_id;
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
    select s.video_url into v_one from public.shots s where s.id::text = p_id;
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
    select f.media_url into v_one from public.flow f where f.id::text = p_id;
    if v_one is not null and v_one <> '' then
      v_media := array_append(v_media, v_one);
    end if;

    -- NOVO (20260814): capa do vídeo. Bloco protegido porque a coluna só
    -- existe a partir da 20260812-flow-poster.
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

  return jsonb_build_object(
    'deleted', v_rows > 0,
    'media',   to_jsonb(v_media)
  );
end;
$$;

grant execute on function public.admin_delete_content(text, text) to authenticated;

-- ─── Conferência ────────────────────────────────────────────────────────────
--
-- Deve conter 'poster_url':
--
--   select prosrc like '%poster_url%' as tem_poster
--     from pg_proc
--    where proname = 'admin_delete_content';
--
-- ⚠️ O REPOST COMPARTILHA O ARQUIVO. `repostStoryDb` reaproveita
--    `media_url`/`poster_url` do original em vez de copiar, então a `media`
--    devolvida aqui pode citar arquivo que outro flow ainda usa. Quem apaga é o
--    cliente (`adminDeleteContentDb`), e ele filtra por `filterUnreferencedUrls`
--    antes de chamar `removeStorageObjects` — não apague esta lista direto.
