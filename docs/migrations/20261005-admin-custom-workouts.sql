-- ============================================================================
-- Migration: 20261005 — curadoria de exercícios criados pelos usuários (Admin)
--
-- Aba "Exercícios" do painel admin: o admin vê os exercícios de
-- `user_custom_workouts` agrupados por nome e decide, por grupo:
--   * TORNAR OFICIAL → cria a linha no catálogo `workouts` (aparece para todos);
--   * VINCULAR       → o exercício já existia no catálogo com outro nome;
--   * IGNORAR        → é específico daquele usuário, fica como está.
--
-- Nos dois primeiros casos, as cópias pessoais dos usuários podem ser trocadas
-- pela linha do catálogo (rotinas, histórico e programas passam a apontar para
-- ela, e a cópia pessoal é apagada) — senão o criador veria o exercício em
-- dobro no seletor.
--
-- Por que RPC: trocar o `workout_id` de linhas de OUTROS usuários e inserir no
-- catálogo é bloqueado pela RLS — e um UPDATE barrado pela RLS não dá erro, só
-- afeta 0 linhas (docs/18-admin.md, "Fila de moderação").
--
-- Reexecutável.
-- ============================================================================

-- ─── 1. Decisões já tomadas (por nome normalizado) ─────────────────────────

create table if not exists public.admin_custom_workout_reviews (
  name_key    text primary key,
  decision    text not null check (decision in ('promoted', 'linked', 'ignored')),
  workout_id  uuid,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz not null default now()
);

alter table public.admin_custom_workout_reviews enable row level security;

drop policy if exists "admin_custom_workout_reviews_admin" on public.admin_custom_workout_reviews;
create policy "admin_custom_workout_reviews_admin"
  on public.admin_custom_workout_reviews
  for all to authenticated
  using (public.is_app_admin(auth.uid()))
  with check (public.is_app_admin(auth.uid()));

-- ─── 2. Tornar oficial / vincular ──────────────────────────────────────────
--
-- p_target_id NULL  → cria o exercício no catálogo com os campos informados.
-- p_target_id dado  → usa esse exercício do catálogo (vincular).
-- p_merge           → troca as cópias pessoais (p_custom_ids) pela linha do
--                     catálogo em user_workouts, user_workouts_hist e
--                     training_day_exercises, e apaga as cópias.
-- Devolve { workout_id, merged, remapped }.

create or replace function public.admin_promote_custom_workouts(
  p_custom_ids      uuid[],
  p_name_key        text,
  p_target_id       uuid default null,
  p_name            text default null,
  p_name_eng        text default null,
  p_description     text default null,
  p_description_eng text default null,
  p_muscle_group    text default null,
  p_merge           boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id       uuid;
  v_type     smallint;
  v_equip    text;
  v_merged   int := 0;
  v_remapped int := 0;
  v_n        int;
begin
  if not public.is_app_admin(auth.uid()) then
    raise exception 'NOT_ADMIN';
  end if;
  if p_custom_ids is null or array_length(p_custom_ids, 1) is null then
    raise exception 'NO_CUSTOM_IDS';
  end if;

  if p_target_id is null then
    if coalesce(trim(p_name), '') = '' then
      raise exception 'NAME_REQUIRED';
    end if;
    select c.type, c.equipment into v_type, v_equip
      from public.user_custom_workouts c
     where c.id = any (p_custom_ids)
     order by (c.equipment is null), c.created_at
     limit 1;

    insert into public.workouts
      (name, name_eng, description, description_eng, muscle_group, type, equipment, created_by_user, created_by)
    values
      (trim(p_name),
       nullif(trim(coalesce(p_name_eng, '')), ''),
       coalesce(p_description, ''),
       nullif(trim(coalesce(p_description_eng, '')), ''),
       nullif(trim(coalesce(p_muscle_group, '')), ''),
       coalesce(v_type, 1),
       v_equip,
       false,
       null)
    returning id into v_id;
  else
    select w.id into v_id
      from public.workouts w
     where w.id = p_target_id
       and coalesce(w.created_by_user, false) = false;
    if v_id is null then
      raise exception 'TARGET_NOT_IN_CATALOG';
    end if;
  end if;

  if p_merge then
    update public.user_workouts set workout_id = v_id where workout_id = any (p_custom_ids);
    get diagnostics v_n = row_count; v_remapped := v_remapped + v_n;

    update public.user_workouts_hist set workout_id = v_id where workout_id = any (p_custom_ids);
    get diagnostics v_n = row_count; v_remapped := v_remapped + v_n;

    if to_regclass('public.training_day_exercises') is not null then
      update public.training_day_exercises set workout_id = v_id where workout_id = any (p_custom_ids);
      get diagnostics v_n = row_count; v_remapped := v_remapped + v_n;
    end if;

    -- Sem referências, o gatilho de limpeza da cópia não apaga nada além dela.
    delete from public.user_custom_workouts where id = any (p_custom_ids);
    get diagnostics v_merged = row_count;
  end if;

  insert into public.admin_custom_workout_reviews (name_key, decision, workout_id, reviewed_by, reviewed_at)
  values (p_name_key, case when p_target_id is null then 'promoted' else 'linked' end, v_id, auth.uid(), now())
  on conflict (name_key) do update
    set decision = excluded.decision,
        workout_id = excluded.workout_id,
        reviewed_by = excluded.reviewed_by,
        reviewed_at = excluded.reviewed_at;

  return jsonb_build_object('workout_id', v_id, 'merged', v_merged, 'remapped', v_remapped);
end;
$$;

revoke all on function public.admin_promote_custom_workouts(uuid[], text, uuid, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.admin_promote_custom_workouts(uuid[], text, uuid, text, text, text, text, text, boolean) to authenticated;
