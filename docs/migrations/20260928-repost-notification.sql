-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-09-28 — "@fulano repostou sua publicação" → notificação type 21
--
-- Rodar DEPOIS de 20260928-post-reposts.sql.
--
-- Quem é notificado: o autor do post ORIGINAL (`posts.reposted_from_user`,
-- gravado pelo trigger validate_post_repost). A linha aponta para o REPOST
-- (`post_id` = id do repost), por dois motivos:
--   • o toque abre o repost, que é onde o autor vê como a publicação dele
--     apareceu no feed de quem repostou;
--   • apagar o repost (deletePostDb) ou o original (delete_reposts_of_post)
--     já apaga notifications por `post_id` do repost — a notificação some junto,
--     sem código extra.
--
-- Não notifica se houver bloqueio em qualquer direção (user_blocks). Só no
-- INSERT: um repost não é editável a ponto de mudar de origem.
--
-- Depois de rodar: REDEPLOY da edge function `send-push-notification` (texto
-- do push do type 21). `notifications.type` não tem check constraint.
--
-- Rodar no Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.notify_post_repost()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reposted_from is null or new.reposted_from_user is null then
    return new;
  end if;
  if new.reposted_from_user = new.user_id then
    return new;
  end if;

  begin
    if exists (
      select 1 from public.user_blocks b
       where (b.blocker_id = new.reposted_from_user and b.blocked_id = new.user_id)
          or (b.blocker_id = new.user_id and b.blocked_id = new.reposted_from_user)
    ) then
      return new;
    end if;

    insert into public.notifications (user_id, follower_id, type, post_id, read, created_at)
    values (new.reposted_from_user, new.user_id, 21, new.id, false, now());
  exception when others then
    -- Notificação nunca pode impedir o repost de ser salvo.
    raise warning 'notify_post_repost: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists trg_notify_post_repost on public.posts;
create trigger trg_notify_post_repost
  after insert on public.posts
  for each row execute function public.notify_post_repost();
