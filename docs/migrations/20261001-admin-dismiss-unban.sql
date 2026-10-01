-- ============================================================================
-- Migration: 20261001 — Admin: arquivar denúncia de verdade + lista de banidos
--
-- ⚠️ Rodar DEPOIS de `20260811-admin-ban-user.sql` (usa `is_app_admin` e o
--    `banned_until` gravado por `admin_set_banned`). Rodar ANTES do build.
--
-- PROBLEMA 1 — "Ignorar denúncia" e "Banir usuário" não tiravam a denúncia da fila
--
--   `adminDismissComplaintDb` fazia `delete from <tabela>_complaint where id = …`
--   com a anon key do admin. As tabelas de denúncia não têm policy de DELETE
--   (o app comum só faz INSERT), então o DELETE casava 0 linhas e voltava
--   **sem erro** — a mesma doença de 20260811. A denúncia sumia da lista só até
--   o próximo carregamento.
--
--   "Remover conteúdo" escapava por acaso: `admin_delete_content` já apaga a
--   denúncia junto com o conteúdo (`admin_purge_refs('…_complaint', …)`).
--
-- PROBLEMA 2 — não havia como desbanir pelo painel
--
--   `admin_set_banned(uuid, false)` já existia, mas nenhuma tela listava quem
--   está banido.
--
-- O QUE ESTA MIGRAÇÃO CRIA
--   1. `admin_dismiss_complaint(p_tipo, p_id)` → nº de linhas apagadas.
--   2. `admin_resolve_user_complaints(p_user_id)` → apaga TODAS as denúncias de
--      perfil contra essa pessoa (usado depois do ban: elas viram resolvidas).
--   3. `admin_list_banned()` → quem está banido, com a data do ban.
--
-- Rodar no SQL Editor do Supabase.
-- ============================================================================

-- ─── 1. Arquivar uma denúncia ───────────────────────────────────────────────
create or replace function public.admin_dismiss_complaint(
  p_tipo text,
  p_id   text
)
returns integer
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_table text;
  v_rows  integer := 0;
begin
  if not public.is_app_admin(auth.uid()) then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  v_table := case p_tipo
    when 'post'    then 'post_complaint'
    when 'shot'    then 'shots_complaint'
    when 'flow'    then 'flow_complaint'
    when 'usuario' then 'user_complaint'
  end;
  if v_table is null then
    raise exception 'INVALID_TIPO' using errcode = '22023';
  end if;

  execute format('delete from public.%I where id::text = $1', v_table) using p_id;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

grant execute on function public.admin_dismiss_complaint(text, text) to authenticated;

-- ─── 2. Ban resolve as denúncias de perfil contra a pessoa ──────────────────
-- `user_complaint.user_id` = quem FOI denunciado (o denunciante é follower_id).
create or replace function public.admin_resolve_user_complaints(p_user_id uuid)
returns integer
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_rows integer := 0;
begin
  if not public.is_app_admin(auth.uid()) then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  delete from public.user_complaint c where c.user_id = p_user_id;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

grant execute on function public.admin_resolve_user_complaints(uuid) to authenticated;

-- ─── 3. Lista de banidos ────────────────────────────────────────────────────
-- Não existe coluna "banido em": `admin_set_banned` grava
-- `banned_until = now() + 100 anos`, então a data do ban é exatamente
-- `banned_until - 100 anos`. Ban feito por fora do painel (outra duração, ou só
-- o flag em profiles) aparece com `banned_at` NULL.
--
-- A união (flag OU banned_until no futuro) mostra também quem ficou com só uma
-- das duas travas — justamente quem mais precisa de um "desbanir" que limpe
-- as duas.
create or replace function public.admin_list_banned()
returns table (
  user_id   uuid,
  nickname  text,
  handle    text,
  photo     text,
  banned_at timestamptz
)
language plpgsql stable security definer
set search_path = public, auth
as $$
#variable_conflict use_column
-- As colunas de saída (user_id, banned_at…) viram variáveis no plpgsql e
-- colidiriam com as colunas das tabelas — aqui o nome é sempre a coluna.
begin
  if not public.is_app_admin(auth.uid()) then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  return query
  select p.user_id,
         p.nickname::text,
         p.handle::text,
         p.photo::text,
         case
           when u.banned_until > now() + interval '50 years'
             then u.banned_until - interval '100 years'
         end as banned_at
    from public.profiles p
    left join auth.users u on u.id = p.user_id
   where p.is_banned = true
      or (u.banned_until is not null and u.banned_until > now())
   order by banned_at desc nulls last, p.nickname;
end;
$$;

grant execute on function public.admin_list_banned() to authenticated;

-- ─── Conferência ────────────────────────────────────────────────────────────
--   select * from public.admin_list_banned();   -- no SQL Editor dá NOT_ADMIN
--                                                -- (sem JWT); teste pelo painel.
