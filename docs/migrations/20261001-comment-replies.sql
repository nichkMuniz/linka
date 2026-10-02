-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-10-01 — Responder um comentário de post → comments.parent_id + type 23
--
-- O drawer de comentários do post ganhou "Responder": a resposta fica presa ao
-- comentário respondido (aparece recuada embaixo dele) e o autor daquele
-- comentário recebe a notificação type 23 ("respondeu seu comentário").
--
-- Regras:
--   • parent_id aponta para o comentário RESPONDIDO (pode ser outra resposta);
--     o app agrupa tudo embaixo do comentário raiz da conversa;
--   • o pai precisa ser do MESMO post (trigger de integridade);
--   • apagar um comentário apaga as respostas dele (on delete cascade);
--   • type 23 não vai para o próprio autor nem quando há bloqueio (user_blocks,
--     as duas direções);
--   • quando o comentário respondido é do DONO do post, ele recebe só a 23 — a
--     type 3 ("comentou no seu post") da mesma inserção é descartada antes de
--     gravar (e, por ser BEFORE, o push dela nem sai);
--   • o autor do comentário respondido sai da lista de menções (type 20) desta
--     inserção — já recebe a 23, seriam dois pushes para o mesmo evento;
--   • só no INSERT: editar uma resposta não renotifica.
--
-- Ordem: rodar ANTES de publicar o build novo (o app lê `parent_id`; sem a
-- coluna ele cai num fallback sem respostas, mas responder falha).
-- Depois de rodar: REDEPLOY da edge function `send-push-notification` (texto do
-- push do type 23). `notifications.type` não tem check constraint.
--
-- Rodar no Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.comments
  add column if not exists parent_id uuid
  references public.comments(id) on delete cascade;

create index if not exists comments_parent_id_idx
  on public.comments(parent_id)
  where parent_id is not null;

-- ── Integridade: o comentário respondido precisa ser do mesmo post ──────────
create or replace function public.comments_check_parent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_id is null then return new; end if;
  if new.parent_id = new.id then
    raise exception 'comment cannot reply to itself';
  end if;
  if not exists (
    select 1 from public.comments c
    where c.id = new.parent_id and c.post_id = new.post_id
  ) then
    raise exception 'parent comment not found in this post';
  end if;
  return new;
end;
$$;

drop trigger if exists comments_check_parent_trg on public.comments;
create trigger comments_check_parent_trg
  before insert or update of parent_id on public.comments
  for each row execute function public.comments_check_parent();

-- ── Notificação type 23 para o autor do comentário respondido ───────────────
-- Nome começa com "trg_" de propósito: triggers do mesmo evento disparam em
-- ordem alfabética, e este precisa rodar ANTES do `trigger_notify_post_comment`
-- (type 3) para o descarte da type 3 duplicada lá embaixo enxergar esta linha.
create or replace function public.notify_post_comment_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_author uuid;
begin
  if new.parent_id is null then return new; end if;
  begin
    select user_id into v_parent_author from public.comments where id = new.parent_id;
    if v_parent_author is null or v_parent_author = new.user_id then return new; end if;
    if exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = v_parent_author and b.blocked_id = new.user_id)
         or (b.blocker_id = new.user_id    and b.blocked_id = v_parent_author)
    ) then
      return new;
    end if;
    insert into public.notifications (user_id, follower_id, type, post_id, read, created_at)
    values (v_parent_author, new.user_id, 23, new.post_id, false, now());
  exception when others then
    -- A notificação nunca pode impedir a resposta de ser salva.
    raise warning 'notify_post_comment_reply: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists trg_notify_post_comment_reply on public.comments;
create trigger trg_notify_post_comment_reply
  after insert on public.comments
  for each row execute function public.notify_post_comment_reply();

-- ── Dono do post respondido: fica só com a 23 ───────────────────────────────
-- `now()` é o instante da TRANSAÇÃO, então a 23 gravada pelo trigger acima e a
-- type 3 que vem logo depois (mesmo INSERT em comments) têm o mesmo created_at.
create or replace function public.notifications_skip_comment_when_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type = 3 and new.post_id is not null and new.follower_id is not null
     and exists (
       select 1 from public.notifications n
       where n.type = 23
         and n.user_id = new.user_id
         and n.follower_id = new.follower_id
         and n.post_id = new.post_id
         and n.created_at = now()
     ) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_skip_comment_when_reply_trg on public.notifications;
create trigger notifications_skip_comment_when_reply_trg
  before insert on public.notifications
  for each row execute function public.notifications_skip_comment_when_reply();

-- ── Menções: o autor do comentário respondido já recebe a 23 ────────────────
-- Mesma função de 20260927-comment-mentions.sql, com o filtro a mais.
create or replace function public.notify_post_comment_mentions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_parent_author uuid;
begin
  if position('@' in coalesce(new.text, '')) = 0 then return new; end if;
  begin
    select user_id into v_owner from public.posts where id = new.post_id;
    if new.parent_id is not null then
      select user_id into v_parent_author from public.comments where id = new.parent_id;
    end if;
    insert into public.notifications (user_id, follower_id, type, post_id, read, created_at)
    select r, new.user_id, 20, new.post_id, false, now()
    from public.comment_mention_recipients(new.text, new.user_id, v_owner) as r
    where r is distinct from v_parent_author;
  exception when others then
    -- Menção nunca pode impedir o comentário de ser salvo.
    raise warning 'notify_post_comment_mentions: %', sqlerrm;
  end;
  return new;
end;
$$;
