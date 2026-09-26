-- ============================================================================
-- Migration: 20260925 — exercícios criados pelo usuário saem do catálogo
--
-- ⚠️ ORDEM DE ENTREGA (diferente das outras migrações):
--   1. PRIMEIRO publique o build novo do app. Ele funciona com e sem esta
--      migração: enquanto `user_custom_workouts` não existe, continua gravando
--      em `workouts` como sempre.
--   2. DEPOIS que a maioria dos usuários atualizar, rode esta migração.
--
--   Motivo: esta migração troca as FKs de `workout_id` para `workouts` por um
--   trigger. Os builds ANTIGOS leem a agenda, os itens da rotina e o
--   histórico por embed `workouts(...)`, que depende da FK. Sem ela, nesses
--   builds a agenda perde os treinos e os exercícios personalizados aparecem
--   como "Exercício desconhecido" (não trava o app, mas degrada).
--
-- O PROBLEMA:
--   "Criar novo exercício" gravava no catálogo `workouts`
--   (created_by_user = true). O catálogo crescia com item de cada usuário.
--   Copiar a rotina de alguém copiava a REFERÊNCIA ao exercício da outra
--   pessoa, e quando o dono apagava, a cópia ficava apontando para o nada.
--
-- O DESENHO:
--   `user_custom_workouts` guarda o exercício do usuário, com dono. Os ids são
--   uuid nas duas tabelas, então nunca colidem: `user_workouts.workout_id`,
--   `user_workouts_hist.workout_id` e `training_day_exercises.workout_id`
--   continuam guardando o MESMO id, que agora pode estar em qualquer uma das
--   duas tabelas. A FK vira um trigger que confere as duas.
--
-- Reexecutável. Builds antigos continuam criando exercício em `workouts`
-- até atualizarem: para mover esses, rode de novo só a última linha:
--
--   select public.move_custom_workouts_out_of_catalog();
-- ============================================================================

-- ─── 1. Tabela ──────────────────────────────────────────────────────────────

create table if not exists public.user_custom_workouts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null check (char_length(trim(name)) between 1 and 200),
  description  text not null default '',
  photo        text,
  muscle_group text,
  equipment    text,
  type         smallint,
  created_at   timestamptz not null default now()
);

create index if not exists user_custom_workouts_user_id_idx
  on public.user_custom_workouts (user_id);

-- ─── 2. RLS ─────────────────────────────────────────────────────────────────
--
-- Leitura liberada a qualquer usuário logado, como o catálogo: o nome e a
-- foto aparecem na rotina de outra pessoa (copiar rotina, treinar junto,
-- comparar treino, resumo de treino no feed).

alter table public.user_custom_workouts enable row level security;

drop policy if exists "user_custom_workouts_select" on public.user_custom_workouts;
create policy "user_custom_workouts_select"
  on public.user_custom_workouts
  for select to authenticated
  using (true);

drop policy if exists "user_custom_workouts_insert_own" on public.user_custom_workouts;
create policy "user_custom_workouts_insert_own"
  on public.user_custom_workouts
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_custom_workouts_update_own" on public.user_custom_workouts;
create policy "user_custom_workouts_update_own"
  on public.user_custom_workouts
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_custom_workouts_delete_own" on public.user_custom_workouts;
create policy "user_custom_workouts_delete_own"
  on public.user_custom_workouts
  for delete to authenticated
  using (auth.uid() = user_id);

-- ─── 3. workout_id: FK vira trigger que aceita as duas tabelas ──────────────

create or replace function public.assert_workout_ref()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.workout_id is null then
    return new;
  end if;
  if exists (select 1 from public.workouts where id = new.workout_id)
     or exists (select 1 from public.user_custom_workouts where id = new.workout_id) then
    return new;
  end if;
  raise exception 'workout_id % não existe em workouts nem em user_custom_workouts', new.workout_id
    using errcode = '23503';
end;
$$;

do $$
declare
  t text;
  c record;
begin
  foreach t in array array['user_workouts', 'user_workouts_hist', 'training_day_exercises'] loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    -- Remove a FK workout_id → workouts (qualquer nome que ela tenha).
    for c in
      select con.conname
        from pg_constraint con
        join pg_attribute att
          on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
       where con.contype = 'f'
         and con.conrelid = ('public.' || t)::regclass
         and con.confrelid = 'public.workouts'::regclass
         and att.attname = 'workout_id'
    loop
      execute format('alter table public.%I drop constraint %I', t, c.conname);
    end loop;

    execute format('drop trigger if exists %I on public.%I', t || '_assert_workout_ref', t);
    execute format(
      'create trigger %I before insert or update of workout_id on public.%I
         for each row execute function public.assert_workout_ref()',
      t || '_assert_workout_ref', t);
  end loop;
end $$;

-- ─── 4. Apagar o exercício leva as linhas do DONO junto ─────────────────────
--
-- Antes a FK impedia apagar um exercício em uso, e o cliente apagava na mão
-- histórico → itens de rotina → exercício. Agora o banco faz, e só as linhas
-- do dono. (`workout_sets_hist` cai por cascade de `user_workouts_hist`.)

create or replace function public.user_custom_workouts_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.user_workouts_hist
   where workout_id = old.id and user_id = old.user_id;
  delete from public.user_workouts
   where workout_id = old.id and user_id = old.user_id;
  return old;
end;
$$;

drop trigger if exists user_custom_workouts_cleanup_trg on public.user_custom_workouts;
create trigger user_custom_workouts_cleanup_trg
  after delete on public.user_custom_workouts
  for each row execute function public.user_custom_workouts_cleanup();

-- ─── 5. Mover o que já existe ───────────────────────────────────────────────
--
-- Por exercício personalizado em `workouts`:
--   * o DONO (`created_by`; se vazio, quem usou primeiro) fica com o id
--     original, então rotina e histórico dele não mudam;
--   * cada OUTRA pessoa que usa o exercício (rotina copiada, treinar junto)
--     ganha uma cópia própria com id novo, e as linhas dela são remapeadas;
--   * exercício que ninguém usa e sem dono é só apagado.
--
-- Função em vez de bloco solto para poder rodar de novo depois (builds
-- antigos continuam criando exercício em `workouts`).

create or replace function public.move_custom_workouts_out_of_catalog()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  w        record;
  u        record;
  v_owner  uuid;
  v_new    uuid;
  v_moved  int := 0;
  v_clones int := 0;
  v_dropped int := 0;
begin
  for w in
    select * from public.workouts where created_by_user = true order by created_at
  loop
    v_owner := w.created_by;
    if v_owner is null then
      select x.user_id into v_owner from (
        select user_id, created_at from public.user_workouts where workout_id = w.id
        union all
        select user_id, null::timestamptz from public.user_workouts_hist where workout_id = w.id
      ) x
      order by x.created_at nulls last
      limit 1;
    end if;

    if v_owner is not null then
      insert into public.user_custom_workouts
        (id, user_id, name, description, photo, muscle_group, equipment, type, created_at)
      values
        (w.id, v_owner, w.name, coalesce(w.description, ''), w.photo, w.muscle_group,
         w.equipment, w.type, coalesce(w.created_at::timestamptz, now()))
      on conflict (id) do nothing;
      v_moved := v_moved + 1;

      for u in
        select distinct user_id from (
          select user_id from public.user_workouts where workout_id = w.id
          union
          select user_id from public.user_workouts_hist where workout_id = w.id
        ) x
        where user_id is not null and user_id <> v_owner
      loop
        insert into public.user_custom_workouts
          (user_id, name, description, photo, muscle_group, equipment, type)
        values
          (u.user_id, w.name, coalesce(w.description, ''), w.photo, w.muscle_group, w.equipment, w.type)
        returning id into v_new;

        update public.user_workouts      set workout_id = v_new where workout_id = w.id and user_id = u.user_id;
        update public.user_workouts_hist set workout_id = v_new where workout_id = w.id and user_id = u.user_id;
        v_clones := v_clones + 1;
      end loop;
    else
      v_dropped := v_dropped + 1;
    end if;

    -- Referências que só fazem sentido para catálogo.
    begin
      update public.workout_groups set default_workout_id = null where default_workout_id = w.id;
    exception when undefined_table or undefined_column then null;
    end;
    begin
      delete from public.workout_muscles where workout_id = w.id;
    exception when undefined_table then null;
    end;

    delete from public.workouts where id = w.id;
  end loop;

  return jsonb_build_object('movidos', v_moved, 'copias_para_outros_usuarios', v_clones, 'apagados_sem_uso', v_dropped);
end;
$$;

revoke all on function public.move_custom_workouts_out_of_catalog() from public, anon, authenticated;

select public.move_custom_workouts_out_of_catalog();
