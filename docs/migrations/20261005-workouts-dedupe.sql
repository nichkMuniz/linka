-- ============================================================================
-- Migration: 20261005 — saneamento do catálogo `workouts` (exercícios repetidos)
--
-- O PROBLEMA:
--   O catálogo veio de três fontes (seed do wger, curadoria manual de julho e
--   programas sugeridos) e ficou com o MESMO exercício cadastrado duas vezes
--   com nomes diferentes ("Supino reto" × "Supino Reto com Barra",
--   "Puxada Alta no Cabo" × "Puxada na frente"). Com o agrupamento de
--   variações (20260812-workout-groups.sql) isso aparece como duas
--   "variações" iguais no seletor, e o histórico/PR do usuário fica partido
--   entre os dois ids.
--
-- CRITÉRIO:
--   Só entra aqui o que é o MESMO exercício (mesmo movimento, mesmo
--   equipamento, mesma pegada). Variação de verdade continua separada, mesmo
--   que o nome pareça: "Desenvolvimento com Barra" (sentado) ≠ "militar"
--   (em pé); "Tríceps no Banco (Paralelas)" (entre dois bancos) ≠ "Fundos
--   para Tríceps" (barras paralelas); "Crossover no Cabo" ≠ "Crucifixo no
--   Cabo" (grupos diferentes, ambos com histórico — fica a critério).
--   Todos os 24 pares abaixo já estão no MESMO grupo de variação.
--
-- O QUE FAZ, por par (redundante → padrão):
--   1. completa o padrão com o que faltar (name_eng, descrição, type,
--      equipamento) a partir do redundante;
--   2. rotina que tinha OS DOIS vira um item só: o histórico do item
--      redundante passa para o item que fica e o redundante é apagado;
--   3. troca o workout_id em user_workouts, user_workouts_hist,
--      training_day_exercises, suggested_routine_exercises,
--      admin_custom_workout_reviews e workout_groups.default_workout_id;
--   4. troca o id dentro dos JSONs que o guardam (posts.workout_summary,
--      routines.last_summary, workout_parties.snapshot,
--      workout_challenges.snapshot, workout_challenge_results.result) e o
--      NOME em routines.program_meta (pré-preenchimento de séries × reps);
--   5. apaga o redundante (workout_muscles cai por cascade);
--   6. grupo que ficou com 1 variação deixa de ser grupo; a rosca alternada
--      passa para o grupo da rosca direta (é o mesmo movimento com halter).
--
-- REDIRECIONAMENTO PERMANENTE (`workout_merges`):
--   O app guarda o catálogo em cache por até 12h e a fila offline pode
--   reenviar séries com o id antigo. Em vez de falhar com 23503, o gatilho
--   `assert_workout_ref()` passa a trocar o id antigo pelo novo na gravação.
--
-- ORDEM DE ENTREGA:
--   1. Publicar o build com o gerador de programas atualizado (ele deixa de
--      pedir "Supino reto", "Remada Sentada no Cabo" e "Puxada no Pulley
--      Pegada Fechada" — o build novo funciona antes e depois daqui).
--   2. Rodar esta migração no Supabase (SQL Editor).
--   Build antigo depois disso: se o cache do índice de nomes expirou, ele
--   cria um exercício PERSONALIZADO com o nome antigo ao gerar programa — cai
--   na aba Exercícios do Admin para vincular.
--
-- Tudo numa transação: se qualquer conferência falhar, nada é aplicado.
-- Reexecutável (par já aplicado é ignorado).
-- ============================================================================

begin;

-- ─── 0. Redirecionamento permanente ────────────────────────────────────────

create table if not exists public.workout_merges (
  old_id    uuid primary key,
  new_id    uuid not null,
  old_name  text,
  merged_at timestamptz not null default now()
);

comment on table public.workout_merges is
  'Exercícios do catálogo apagados por serem duplicados → id que ficou. Usado por assert_workout_ref() para redirecionar gravações com id antigo (cache do app, fila offline).';

alter table public.workout_merges enable row level security;

drop policy if exists "workout_merges_read_all" on public.workout_merges;
create policy "workout_merges_read_all"
  on public.workout_merges for select using (true);

-- ─── 1. Os pares (redundante → padrão) ─────────────────────────────────────

create temp table _m (drop_id uuid primary key, keep_id uuid not null) on commit drop;

insert into _m (drop_id, keep_id) values
  -- Peito
  ('9d1419c3-000f-4159-a615-461453361b96', '9b8f24ca-4dfb-41c0-99e7-e6fd64100b93'), -- Supino reto → Supino Reto com Barra
  ('38495143-8d96-4c6c-8f7a-0cce59c52e73', '7d3148e3-4db3-4820-add2-0483c72e7dc3'), -- Crucifixo na Máquina (Butterfly) → Crucifixo na máquina
  -- Costas
  ('21b3658f-fffa-4b93-ad76-0a34f43a6c00', '9d55dac9-8029-4902-9f7e-fc202a9540d7'), -- Puxada Alta no Cabo → Puxada na frente
  ('a0405664-517d-4ff6-99c0-d3cb61740828', '2e44d300-b746-4fc4-9478-f5b48b047ac5'), -- Puxada no Pulley Pegada Fechada → Puxada Fechada
  ('cb135fa8-16d4-4203-9a05-d94517feb3a1', '8ad0378e-d175-451e-a707-f46e20833105'), -- Remada Sentada no Cabo → Remada Baixa
  ('00563f3b-410b-4de4-84bb-caeb34ec10b1', 'f3bdc8af-7019-43fd-999a-52168edc149f'), -- Hiperextensão → Extensão de Lombar
  ('b10a6d98-54a3-45c6-a947-1af55923d510', 'f2accd60-01fa-4d45-889c-281567a62bf7'), -- Puxada com Braços Retos no Cabo → Pull-over na Polia Alta
  -- Ombros
  ('9720faf8-3632-4f9a-a4da-8e559dece5f0', 'db855de5-f16f-4a95-95d3-7785c1910d9e'), -- Desenvolvimento com Barra acima da Cabeça → Desenvolvimento militar
  ('65c5ed0d-d1f1-4399-9643-e4d3068bfaf6', '87b42969-fa37-47cb-8b34-d86867f673c8'), -- Elevação Lateral → Elevação Lateral com Halter
  ('3f3fafc5-9fbf-4c36-959a-064b053ef4d4', '43531a7b-d84a-458d-92d5-e9ed514c55d1'), -- Arranco e Desenvolvimento com Barra → Arranco e Desenvolvimento
  -- Tríceps
  ('6df46070-735d-4ad4-aca3-526de25e5f61', 'd20b9f53-f57a-4a2d-a05c-42d63d7847a4'), -- Extensão de Tríceps no Cabo → Tríceps Pulley
  ('a340b00f-3614-4eb2-a351-560267ad2f69', 'fc598bd4-c5af-43df-bfc9-2947bc88bfa6'), -- Tríceps acima da Cabeça com Halter → Tríceps francês
  ('f678a909-1009-4a23-a621-719855bc0589', 'dbd3ecb2-f064-4ff8-82f5-665e6e124206'), -- Extensão de Tríceps com Barra acima da Cabeça → Extensão de Tríceps acima da Cabeça
  ('909ef075-c57d-47c8-ab59-9bda3c04ce98', 'f71163b6-5d3b-4969-831e-c63d332a0081'), -- Skull Crusher com Barra W → Tríceps testa
  -- Bíceps
  ('6d0a1a52-1382-4382-a3d1-ffded94b13d3', 'b0583cd3-15db-45a8-a9ae-bdfec02ae538'), -- Rosca Bíceps Alternada com Halter → Rosca Alternada com Halteres
  -- Pernas
  ('ec9d3840-cae7-4085-a3b5-8c91816e6e65', '86638b09-677f-4569-9fa4-812c4a0c7cad'), -- Agachamento Completo com Barra → Agachamento com Barra
  ('87c732d1-4a41-4e00-8e59-e8b70b3dc959', 'e4748a31-952d-4dd1-9676-0610d2ca4c47'), -- Agachamento Búlgaro Unilateral Esquerdo → Agachamento Búlgaro
  ('4f67ce90-771a-446e-9c29-f91f840daa15', 'd3c6f4f0-1f37-4169-a35e-2a8bbbd42193'), -- Investidas → Avanço
  ('f9d2da23-4a49-430a-81a6-a0edfef94ec9', '8d0cd25d-3bdb-4dd9-8611-960a88545e59'), -- Extensão de Joelho → Cadeira extensora
  ('3e343903-39c1-436c-9268-48a68859b78a', 'c6b6d737-a61b-43b3-b472-20773af34edc'), -- Flexão de Joelho Deitado (Leg Curl) → Mesa flexora
  ('f8c59d40-4e54-4485-8471-631bd33ac012', '181296f4-da81-4975-a5d0-4f35db46b25d'), -- Elevação de Calcanhares com Duas Pernas → Elevação de Panturrilha
  ('ad656445-e4a2-4e2c-a9f1-88b645a17f5c', '297601fd-9baf-4282-9613-c8ed0b48d00b'), -- Agachamento Goblet com Halter → Agachamento Goblet
  -- Abdômen
  ('bba6f70d-4875-4870-91a7-ff92429652ee', '86bdc551-ca65-4354-9bf1-9daa68e1f3a1'), -- Elevação de Pernas Deitado → Elevação de Pernas
  -- Cardio
  ('949a9dee-7d46-42e3-a1ea-d3329ae59b49', 'ac6e7d1b-a7c9-4bc4-941c-d9591a1432b9'); -- Cardio na Esteira → Esteira

-- Reexecução: par cujo redundante já foi apagado sai da lista.
delete from _m where not exists (select 1 from public.workouts w where w.id = _m.drop_id);

-- O padrão tem que existir e ser de catálogo; senão aborta tudo.
do $$
declare v_bad text;
begin
  select string_agg(m.keep_id::text, ', ') into v_bad
    from _m m
   where not exists (
     select 1 from public.workouts w
      where w.id = m.keep_id and coalesce(w.created_by_user, false) = false
   );
  if v_bad is not null then
    raise exception 'Exercício padrão ausente no catálogo: %', v_bad;
  end if;
end $$;

insert into public.workout_merges (old_id, new_id, old_name)
select m.drop_id, m.keep_id, w.name
  from _m m join public.workouts w on w.id = m.drop_id
on conflict (old_id) do update set new_id = excluded.new_id;

-- ─── 2. Completar o padrão com o que faltar ────────────────────────────────

update public.workouts k
   set name_eng        = coalesce(nullif(trim(k.name_eng), ''), d.name_eng),
       description_eng = coalesce(nullif(trim(k.description_eng), ''), d.description_eng),
       -- "3x12" / "3x10" das linhas curadas em julho não é descrição.
       description     = case when char_length(coalesce(trim(k.description), '')) < 20
                                   and char_length(coalesce(trim(d.description), '')) >= 20
                              then d.description else k.description end,
       type            = coalesce(k.type, d.type),
       equipment       = coalesce(k.equipment, d.equipment)
  from _m m
  join public.workouts d on d.id = m.drop_id
 where k.id = m.keep_id;

-- name_eng mais reconhecível que o herdado do redundante.
update public.workouts set name_eng = 'Lat Pulldown'                        where id = '9d55dac9-8029-4902-9f7e-fc202a9540d7'; -- Puxada na frente
update public.workouts set name_eng = 'Seated Cable Row'                    where id = '8ad0378e-d175-451e-a707-f46e20833105'; -- Remada Baixa
update public.workouts set name_eng = 'Overhead Dumbbell Triceps Extension' where id = 'fc598bd4-c5af-43df-bfc9-2947bc88bfa6'; -- Tríceps francês
update public.workouts set name_eng = 'Lying Leg Curl'                      where id = 'c6b6d737-a61b-43b3-b472-20773af34edc'; -- Mesa flexora
update public.workouts set name_eng = 'Goblet Squat'                        where id = '297601fd-9baf-4282-9613-c8ed0b48d00b'; -- Agachamento Goblet

-- ─── 3. Rotina com os dois → um item só ────────────────────────────────────
-- (hoje: 4 rotinas — Puxada Fechada, Remada Baixa, Mesa flexora, Panturrilha)

create temp table _uw_dup on commit drop as
select d.id as drop_uw_id,
       (select k.id from public.user_workouts k
         where k.user_id = d.user_id
           and k.routine_id is not distinct from d.routine_id
           and k.workout_id = m.keep_id
         order by k.id limit 1) as keep_uw_id
  from public.user_workouts d
  join _m m on m.drop_id = d.workout_id
 where exists (
   select 1 from public.user_workouts k
    where k.user_id = d.user_id
      and k.routine_id is not distinct from d.routine_id
      and k.workout_id = m.keep_id
 );

update public.user_workouts_hist h
   set user_workout_id = x.keep_uw_id
  from _uw_dup x
 where h.user_workout_id = x.drop_uw_id;

delete from public.user_workouts u using _uw_dup x where u.id = x.drop_uw_id;

-- ─── 4. Trocar o workout_id nas tabelas ────────────────────────────────────

update public.user_workouts u      set workout_id = m.keep_id from _m m where u.workout_id = m.drop_id;
update public.user_workouts_hist h set workout_id = m.keep_id from _m m where h.workout_id = m.drop_id;

do $$
begin
  if to_regclass('public.training_day_exercises') is not null then
    update public.training_day_exercises t set workout_id = m.keep_id from _m m where t.workout_id = m.drop_id;
  end if;
  if to_regclass('public.suggested_routine_exercises') is not null then
    update public.suggested_routine_exercises s set workout_id = m.keep_id from _m m where s.workout_id = m.drop_id;
  end if;
  if to_regclass('public.admin_custom_workout_reviews') is not null then
    update public.admin_custom_workout_reviews r set workout_id = m.keep_id from _m m where r.workout_id = m.drop_id;
  end if;
end $$;

update public.workout_groups g set default_workout_id = m.keep_id from _m m where g.default_workout_id = m.drop_id;

-- ─── 5. Ids dentro de JSON ─────────────────────────────────────────────────
-- uuid é único, então trocar o texto é seguro. Os NOMES nesses snapshots
-- ficam como estão: são o registro do que foi postado/feito naquele dia.

do $$
declare
  r record;
  t record;
begin
  for t in
    select * from (values
      ('posts',                     'workout_summary'),
      ('routines',                  'last_summary'),
      ('workout_parties',           'snapshot'),
      ('workout_challenges',        'snapshot'),
      ('workout_challenge_results', 'result')
    ) v(tbl, col)
  loop
    if to_regclass('public.' || t.tbl) is null then
      continue;
    end if;
    for r in select drop_id, keep_id from _m loop
      execute format(
        'update public.%I set %I = replace(%I::text, %L, %L)::jsonb where %I::text like %L',
        t.tbl, t.col, t.col, r.drop_id::text, r.keep_id::text, t.col, '%' || r.drop_id::text || '%'
      );
    end loop;
  end loop;
end $$;

-- program_meta guarda NOME (é como o pré-preenchimento casa com o item).
update public.routines r
   set program_meta = jsonb_set(
         r.program_meta, '{exercises}',
         (select jsonb_agg(
                   case when n.keep_name is not null
                        then e || jsonb_build_object('name', n.keep_name)
                        else e end
                   order by x.ord)
            from jsonb_array_elements(r.program_meta -> 'exercises') with ordinality as x(e, ord)
            left join (
              select lower(trim(d.name)) as drop_key, k.name as keep_name
                from _m m
                join public.workouts d on d.id = m.drop_id
                join public.workouts k on k.id = m.keep_id
            ) n on n.drop_key = lower(trim(x.e ->> 'name'))))
 where jsonb_typeof(r.program_meta -> 'exercises') = 'array'
   and exists (
     select 1
       from jsonb_array_elements(r.program_meta -> 'exercises') e
       join _m m on true
       join public.workouts d on d.id = m.drop_id
      where lower(trim(e ->> 'name')) = lower(trim(d.name)));

-- ─── 6. Conferência e exclusão ─────────────────────────────────────────────

do $$
declare v_left int;
begin
  select
      (select count(*) from public.user_workouts      where workout_id in (select drop_id from _m))
    + (select count(*) from public.user_workouts_hist where workout_id in (select drop_id from _m))
    into v_left;
  if v_left > 0 then
    raise exception 'Ainda há % referência(s) aos redundantes — nada foi apagado', v_left;
  end if;
end $$;

delete from public.workouts w using _m m where w.id = m.drop_id;

-- ─── 7. Grupos ─────────────────────────────────────────────────────────────

-- Rosca alternada é a rosca com halter feita um braço por vez: variação da
-- rosca direta (como a martelo alternada já é variação da martelo).
update public.workouts
   set group_id = 'rosca_direta'
 where id = 'b0583cd3-15db-45a8-a9ae-bdfec02ae538';

-- Grupo de uma variação só não é grupo (mesma regra de 20260812).
update public.workouts w
   set group_id = null
 where w.group_id in (
   select group_id from public.workouts
    where group_id is not null
    group by group_id having count(*) < 2
 );

delete from public.workout_groups g
 where not exists (select 1 from public.workouts w where w.group_id = g.id);

-- ─── 8. Gatilho: id antigo é redirecionado em vez de recusado ──────────────

create or replace function public.assert_workout_ref()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next uuid;
  i      int := 0;
begin
  if new.workout_id is null then
    return new;
  end if;
  -- Até 5 saltos: um padrão pode ter sido fundido de novo depois.
  loop
    if exists (select 1 from public.workouts where id = new.workout_id)
       or exists (select 1 from public.user_custom_workouts where id = new.workout_id) then
      return new;
    end if;
    select new_id into v_next from public.workout_merges where old_id = new.workout_id;
    exit when v_next is null or i >= 5;
    new.workout_id := v_next;
    i := i + 1;
  end loop;
  raise exception 'workout_id % não existe em workouts nem em user_custom_workouts', new.workout_id
    using errcode = '23503';
end;
$$;

commit;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- Esperado: 249 exercícios no catálogo (273 − 24) e 24 linhas em workout_merges.
--   select count(*) from workouts where coalesce(created_by_user, false) = false;
--   select count(*) from workout_merges;
--
-- Grupos que sumiram (esperado: arranco_desenvolvimento, agachamento_goblet,
-- rosca_alternada):
--   select id from (values ('arranco_desenvolvimento'), ('agachamento_goblet'), ('rosca_alternada')) v(id)
--    where not exists (select 1 from workout_groups g where g.id = v.id);
--
-- Nenhuma referência órfã:
--   select count(*) from user_workouts_hist h
--    where not exists (select 1 from workouts w where w.id = h.workout_id)
--      and not exists (select 1 from user_custom_workouts c where c.id = h.workout_id);
