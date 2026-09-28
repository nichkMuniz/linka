-- ═══════════════════════════════════════════════════════════════════════════
-- 20260928 — Repostar no feed um post em que você foi marcado
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Quem foi marcado num post (post_tags) pode republicá-lo no próprio feed.
-- O repost é uma linha comum de `posts`, do usuário que repostou, com:
--   reposted_from       → id do post original
--   reposted_from_user  → autor do original (gravado pelo trigger, não pelo app)
-- As fotos são as MESMAS URLs do original (sem novo upload). Por isso:
--   - apagar um repost NÃO apaga arquivo nenhum (o app pula o Storage);
--   - apagar o original apaga os reposts antes (trigger abaixo), e aí sim o
--     app apaga os arquivos, que ficaram sem referência.
--
-- ⚠ RODAR ANTES DE PUBLICAR O BUILD NOVO: o feed passa a pedir
-- `reposted_from` no select, e o PostgREST derruba a query inteira se a coluna
-- não existir. A migração é aditiva — não quebra os builds da loja.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Colunas ─────────────────────────────────────────────────────────────

alter table public.posts
  add column if not exists reposted_from uuid
    references public.posts(id) on delete cascade;

alter table public.posts
  add column if not exists reposted_from_user uuid;

-- Um repost por pessoa por post. Apagar o repost libera repostar de novo.
create unique index if not exists posts_one_repost_per_user
  on public.posts (user_id, reposted_from)
  where reposted_from is not null;

create index if not exists posts_reposted_from_idx
  on public.posts (reposted_from)
  where reposted_from is not null;

-- ─── 2. Quem pode repostar ──────────────────────────────────────────────────
-- A policy de INSERT de posts só garante que a linha é do próprio usuário;
-- a regra do repost mora aqui para valer mesmo com o app contornado.

create or replace function public.validate_post_repost()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_original public.posts%rowtype;
begin
  if tg_op = 'UPDATE' then
    -- O vínculo é fixo: um post comum não vira repost nem o contrário.
    new.reposted_from := old.reposted_from;
    new.reposted_from_user := old.reposted_from_user;
    return new;
  end if;

  if new.reposted_from is null then
    new.reposted_from_user := null;
    return new;
  end if;

  select * into v_original from public.posts where id = new.reposted_from;
  if not found then
    raise exception 'REPOST_ORIGINAL_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Repost de repost não existe: o app sempre aponta para a origem.
  if v_original.reposted_from is not null then
    raise exception 'REPOST_OF_REPOST' using errcode = '22023';
  end if;

  if v_original.user_id = new.user_id then
    raise exception 'REPOST_OWN_POST' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.post_tags t
     where t.post_id = new.reposted_from
       and t.user_id = new.user_id
  ) then
    raise exception 'REPOST_NOT_TAGGED' using errcode = '42501';
  end if;

  -- Autor que só mostra posts para seguidores: o repost levaria as fotos para
  -- fora desse círculo.
  if public.profile_hides_posts(v_original.user_id) then
    raise exception 'REPOST_PRIVATE_AUTHOR' using errcode = '42501';
  end if;

  new.reposted_from_user := v_original.user_id;
  return new;
end;
$$;

drop trigger if exists trg_validate_post_repost on public.posts;
create trigger trg_validate_post_repost
  before insert or update on public.posts
  for each row
  execute function public.validate_post_repost();

-- ─── 3. Apagar o original leva os reposts ───────────────────────────────────
-- O `on delete cascade` sozinho falharia: comments/likes do REPOST apontam para
-- ele sem cascade. E o autor do original não consegue apagar linhas alheias
-- pela RLS (seria um no-op silencioso). Então o trigger, SECURITY DEFINER,
-- limpa as dependências de cada repost e o apaga antes do original sair.

create or replace function public.delete_reposts_of_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in select id from public.posts where reposted_from = old.id loop
    delete from public.notifications  where post_id = r.id;
    delete from public.likes          where post_id = r.id;
    delete from public.comments       where post_id = r.id;
    delete from public.post_tags      where post_id = r.id;
    delete from public.post_complaint where post_id = r.id;
    delete from public.posts          where id      = r.id;
  end loop;
  return old;
end;
$$;

drop trigger if exists trg_delete_reposts_of_post on public.posts;
create trigger trg_delete_reposts_of_post
  before delete on public.posts
  for each row
  execute function public.delete_reposts_of_post();

-- ─── Verificação rápida (opcional) ──────────────────────────────────────────
--
--   select id, user_id, reposted_from, reposted_from_user
--     from public.posts where reposted_from is not null;
