-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-09-27 — Menções "@usuario" em comentários → notificação type 20
--
-- O app agora tem autocomplete de "@" nos campos de comentário (post, shot e
-- flow). O texto guarda só "@handle"; quem é mencionado é descoberto AQUI, no
-- banco, a partir do texto — o cliente não precisa (nem pode) inserir
-- notificação para outra pessoa.
--
-- Regras:
--   • handle casa com `profiles.handle` sem diferenciar maiúsculas; ponto/hífen
--     no fim saem ("@ana." é fim de frase) — mesma regra do render no app;
--   • no máximo 10 menções por comentário (anti-spam);
--   • não notifica o próprio autor nem o DONO do conteúdo (ele já recebe o
--     type 3 do comentário — seriam dois pushes para o mesmo evento);
--   • não notifica se houver bloqueio em qualquer direção (user_blocks);
--   • só no INSERT: editar um comentário não reenvia notificação.
--
-- Legenda de post/flow NÃO passa por aqui: lá a menção vira marcação
-- (post_tags / flow_tags), que já notifica (types 9 / 16).
--
-- Depois de rodar: REDEPLOY da edge function `send-push-notification` (texto
-- do push do type 20). `notifications.type` não tem check constraint.
--
-- Rodar no Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- Destinatários das menções de um texto.
create or replace function public.comment_mention_recipients(
  p_text   text,
  p_author uuid,
  p_owner  uuid
)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  with handles as (
    select distinct rtrim(lower(m[1]), '.-') as h
    from regexp_matches(coalesce(p_text, ''), '(?:^|\s)@([a-z0-9._-]+)', 'gi') as m
    limit 10
  )
  select p.user_id
  from public.profiles p
  join handles on lower(p.handle) = handles.h
  where handles.h <> ''
    and p.user_id <> p_author
    and p.user_id is distinct from p_owner
    and not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = p.user_id and b.blocked_id = p_author)
         or (b.blocker_id = p_author  and b.blocked_id = p.user_id)
    );
$$;

-- ── Post (comments) ─────────────────────────────────────────────────────────
create or replace function public.notify_post_comment_mentions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if position('@' in coalesce(new.text, '')) = 0 then return new; end if;
  begin
    select user_id into v_owner from public.posts where id = new.post_id;
    insert into public.notifications (user_id, follower_id, type, post_id, read, created_at)
    select r, new.user_id, 20, new.post_id, false, now()
    from public.comment_mention_recipients(new.text, new.user_id, v_owner) as r;
  exception when others then
    -- Menção nunca pode impedir o comentário de ser salvo.
    raise warning 'notify_post_comment_mentions: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists trg_notify_post_comment_mentions on public.comments;
create trigger trg_notify_post_comment_mentions
  after insert on public.comments
  for each row execute function public.notify_post_comment_mentions();

-- ── Shot (shots_comments) ───────────────────────────────────────────────────
create or replace function public.notify_shot_comment_mentions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if position('@' in coalesce(new.text, '')) = 0 then return new; end if;
  begin
    select user_id into v_owner from public.shots where id = new.shots_id;
    insert into public.notifications (user_id, follower_id, type, shots_id, read, created_at)
    select r, new.user_id, 20, new.shots_id, false, now()
    from public.comment_mention_recipients(new.text, new.user_id, v_owner) as r;
  exception when others then
    raise warning 'notify_shot_comment_mentions: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists trg_notify_shot_comment_mentions on public.shots_comments;
create trigger trg_notify_shot_comment_mentions
  after insert on public.shots_comments
  for each row execute function public.notify_shot_comment_mentions();

-- ── Flow (flow_comments) ────────────────────────────────────────────────────
create or replace function public.notify_flow_comment_mentions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if position('@' in coalesce(new.text, '')) = 0 then return new; end if;
  begin
    select user_id into v_owner from public.flow where id = new.flow_id;
    insert into public.notifications (user_id, follower_id, type, flow_id, read, created_at)
    select r, new.user_id, 20, new.flow_id, false, now()
    from public.comment_mention_recipients(new.text, new.user_id, v_owner) as r;
  exception when others then
    raise warning 'notify_flow_comment_mentions: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists trg_notify_flow_comment_mentions on public.flow_comments;
create trigger trg_notify_flow_comment_mentions
  after insert on public.flow_comments
  for each row execute function public.notify_flow_comment_mentions();
