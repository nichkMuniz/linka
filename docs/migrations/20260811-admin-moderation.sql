-- ============================================================================
-- Migration: 20260811 — Admin: remover conteúdo denunciado + verificar conta
--
-- ⚠️ Rodar DEPOIS de `20260729-admin-premium.sql` (usa `is_app_admin`).
--
-- PROBLEMAS QUE ISTO RESOLVE (a mesma doença, em dois botões):
--
--   1. "Remover post/shot/flow" na fila de moderação não removia nada.
--      `adminDeleteContentDb` fazia `delete from posts where id = ...` com a
--      anon key do admin. A RLS de `posts`/`shots`/`flow` só deixa o AUTOR
--      apagar, então o DELETE casava 0 linhas e voltava **sem erro** — o painel
--      dava baixa na denúncia e o conteúdo continuava no ar.
--
--   2. "Contas Verificadas" tinha o mesmo destino desde a 20260713: além da
--      `profiles_update_own`, o trigger `freeze_is_verified` reverte
--      `is_verified` fora do service_role. O toast dizia "verificado com
--      sucesso" sem ter verificado ninguém.
--
--   DELETE/UPDATE que não casa linha **não é erro** no Postgres. Toda escrita do
--   painel em linha de terceiro precisa passar por RPC `SECURITY DEFINER` e
--   devolver quantas linhas mudaram.
--
-- Rodar no SQL Editor do Supabase.
-- ============================================================================

-- ─── 1. Helper: apagar dependências sem depender do tipo da coluna ──────────
--
-- O schema tem divergências reais de tipo entre a PK e quem a referencia
-- (`shots_likes.shots_id` é smallint, `flow_user_viewed.flow_id` está
-- documentado como uuid enquanto `flow.id` é bigint). Comparar como texto
-- funciona em todos os casos, e o `exception` evita que uma tabela que não
-- existe naquele projeto derrube a remoção inteira.
--
-- É um helper interno: sem grant para `authenticated`.

create or replace function public.admin_purge_refs(
  p_table text,
  p_col   text,
  p_id    text
)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
begin
  execute format('delete from public.%I where %I::text = $1', p_table, p_col)
    using p_id;
exception
  when undefined_table or undefined_column then
    return;
end;
$$;

revoke all on function public.admin_purge_refs(text, text, text) from public, anon, authenticated;

-- ─── 2. Remover conteúdo denunciado ─────────────────────────────────────────
--
-- `p_id` chega como texto porque os três tipos têm PK diferente (posts = uuid,
-- shots e flow = bigint). O `id::text` no where evita cast e não muda nada para
-- quem chama.
--
-- Sim, `coluna::text = $1` descarta o índice e vira seq scan. É de propósito:
-- moderação é ação rara e manual, e um scan de alguns segundos custa menos que
-- um `operator does not exist` em produção por causa das divergências de tipo
-- documentadas em docs/14-database-schema.md.
--
-- Retorno jsonb:
--   deleted → a linha de conteúdo sumiu de fato (false = já não existia)
--   media   → URLs de storage que ficaram órfãs; o cliente apaga em seguida
--             (o Postgres não fala com o Storage).

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

-- ─── 3. Verificar / desverificar conta ──────────────────────────────────────
--
-- O trigger `freeze_is_verified` (20260713) reverte `is_verified` para quem não
-- é service_role. Esta função roda com o JWT do admin, então precisa que o
-- trigger conheça o admin — senão a RPC "funciona" e o trigger desfaz na saída,
-- que é exatamente o bug que estamos consertando.

create or replace function public.freeze_is_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_verified is distinct from old.is_verified
     and coalesce(current_setting('request.jwt.claims', true)::json ->> 'role', '') <> 'service_role'
     and auth.role() <> 'service_role'
     and not public.is_app_admin(auth.uid())
  then
    new.is_verified := old.is_verified;
  end if;
  return new;
end;
$$;

create or replace function public.admin_set_verified(
  p_user_id  uuid,
  p_verified boolean default true
)
returns boolean
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  if not public.is_app_admin(auth.uid()) then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  if p_user_id is null then
    raise exception 'INVALID_USER' using errcode = '22023';
  end if;

  update public.profiles p
     set is_verified = p_verified,
         updated_at  = now()
   where p.user_id = p_user_id;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

grant execute on function public.admin_set_verified(uuid, boolean) to authenticated;

-- ─── Verificação rápida (opcional) ──────────────────────────────────────────
--
--   select public.admin_delete_content('post', '<uuid do post>');
--   → {"deleted": true, "media": ["https://…/storage/v1/object/public/posts/…"]}
--
--   select public.admin_set_verified('<uuid>', true);
--   select is_verified from public.profiles where user_id = '<uuid>';
