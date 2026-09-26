-- ============================================================================
-- Script: 20260925 — limpeza de `public.followers`
--
-- Rodar ANTES de `20260925-followers-unfollow-sync.sql` (que cria o índice
-- único e falharia com duplicatas na tabela). A migração também repete a
-- limpeza, então este arquivo serve principalmente para CONFERIR o estrago
-- antes de apagar.
--
-- Rode os blocos na ordem. Os SELECTs do passo 0 só leem.
-- ============================================================================

-- ─── 0. Diagnóstico (só leitura) ────────────────────────────────────────────

-- Pares (seguido, seguidor) repetidos e quantas cópias cada um tem.
select user_id, follower_id, count(*) as copias, min(id) as id_mantido
  from public.followers
 group by user_id, follower_id
having count(*) > 1
 order by copias desc;

-- Total de linhas que o passo 1 vai apagar.
select coalesce(sum(copias - 1), 0) as duplicatas_a_apagar
  from (
    select count(*) as copias
      from public.followers
     group by user_id, follower_id
    having count(*) > 1
  ) t;

-- Linhas órfãs: o follow já foi desfeito em `following` (a tabela que o app
-- lê) mas a cópia ficou em `followers`.
select count(*) as orfas_a_apagar
  from public.followers f
 where not exists (
   select 1 from public.following g
    where g.user_id = f.follower_id
      and g.following_id = f.user_id
 );

-- ─── 1. Apagar duplicatas (mantém a linha mais antiga de cada par) ──────────

begin;

delete from public.followers f
 using public.followers keep
 where keep.user_id = f.user_id
   and keep.follower_id is not distinct from f.follower_id
   and keep.id < f.id;

-- ─── 2. Apagar órfãs (unfollows antigos que não foram espelhados) ───────────

delete from public.followers f
 where not exists (
   select 1 from public.following g
    where g.user_id = f.follower_id
      and g.following_id = f.user_id
 );

commit;
