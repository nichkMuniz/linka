-- ============================================================================
-- Migration: 20260925 — metas personalizadas saem do catálogo `goals`
--
-- ⚠️ OBRIGATÓRIA e ANTES do próximo build do app. Rodar DEPOIS de
-- `20260925-goals-description-eng.sql`.
--
-- O PROBLEMA:
--   "Meta personalizada" gravava uma linha em `goals` (created_by_user = 1),
--   a mesma tabela do catálogo. O catálogo crescia com texto livre de cada
--   usuário, sem dono (a linha não tinha user_id). Pior: copiar a meta
--   personalizada de um post criava um `user_goals` apontando para a linha de
--   OUTRA pessoa, e quem apagasse primeiro levava a meta do outro junto.
--
-- O DESENHO:
--   `user_custom_goals` guarda o texto/tipo/duração, com dono. `user_goals`
--   ganha `custom_goal_id`: meta de catálogo usa `goal_id`, meta personalizada
--   usa `custom_goal_id` (e `goal_id` fica NULL).
--
--   O app trata `goal_id ?? custom_goal_id` como a IDENTIDADE da meta: é o
--   valor que vai em `routines.goal_id`. Para isso nunca colidir, a tabela
--   nova usa A MESMA SEQUÊNCIA de ids de `goals`. Um id existe em uma tabela
--   ou na outra, nunca nas duas. E como a migração mantém o id original na
--   primeira cópia, as rotinas já vinculadas continuam vinculadas.
--
-- COMPATIBILIDADE COM BUILDS ANTIGOS:
--   O app já publicado continua inserindo em `goals` com created_by_user = 1.
--   O trigger `user_goals_route_custom_goal` intercepta o INSERT em
--   `user_goals` e move a meta para `user_custom_goals` na hora. O catálogo
--   fica limpo mesmo antes de todo mundo atualizar. O que o build antigo NÃO
--   faz é ler `user_custom_goals`: nele, metas personalizadas aparecem sem
--   nome até o usuário atualizar o app.
--
-- Reexecutável: o passo 5 move qualquer meta personalizada que ainda esteja
-- em `goals`.
-- ============================================================================

-- ─── 1. Tabela ──────────────────────────────────────────────────────────────

create table if not exists public.user_custom_goals (
  id          bigint primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  description text not null check (char_length(trim(description)) between 1 and 200),
  type        smallint,
  duration    bigint not null,
  quantity    bigint not null,
  created_at  timestamptz not null default now()
);

create index if not exists user_custom_goals_user_id_idx
  on public.user_custom_goals (user_id);

-- Default = próximo valor da sequência de `goals.id`. O nome da sequência é
-- gerado pelo Postgres, por isso a leitura dinâmica.
do $$
declare
  v_seq text := pg_get_serial_sequence('public.goals', 'id');
begin
  if v_seq is null then
    raise exception 'goals.id não tem sequência (identity/serial) — ajuste manual necessário';
  end if;
  execute format(
    'alter table public.user_custom_goals alter column id set default nextval(%L::regclass)',
    v_seq);
  -- O INSERT do app roda como `authenticated`, que precisa poder chamar
  -- nextval na sequência.
  execute format('grant usage, select on sequence %s to authenticated', v_seq);
end $$;

-- ─── 2. Vínculo em user_goals ───────────────────────────────────────────────

alter table public.user_goals
  add column if not exists custom_goal_id bigint
    references public.user_custom_goals(id) on delete cascade;

create index if not exists user_goals_custom_goal_id_idx
  on public.user_goals (custom_goal_id);

-- ─── 3. RLS ─────────────────────────────────────────────────────────────────

alter table public.user_custom_goals enable row level security;

-- Leitura: o dono, ou qualquer um quando a meta está pública. É a mesma regra
-- de `user_goals` ("Anyone can read public goals"): a meta aparece no card
-- do post e no drawer de meta do feed.
drop policy if exists "user_custom_goals_select" on public.user_custom_goals;
create policy "user_custom_goals_select"
  on public.user_custom_goals
  for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.user_goals ug
       where ug.custom_goal_id = user_custom_goals.id
         and ug.visibility = 1
    )
  );

drop policy if exists "user_custom_goals_insert_own" on public.user_custom_goals;
create policy "user_custom_goals_insert_own"
  on public.user_custom_goals
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_custom_goals_update_own" on public.user_custom_goals;
create policy "user_custom_goals_update_own"
  on public.user_custom_goals
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_custom_goals_delete_own" on public.user_custom_goals;
create policy "user_custom_goals_delete_own"
  on public.user_custom_goals
  for delete to authenticated
  using (auth.uid() = user_id);

-- ─── 4. Triggers ────────────────────────────────────────────────────────────

-- 4a. Apagar a meta do usuário apaga a meta personalizada dela. Antes quem
--     fazia isso era o cliente, em dois passos (e sob RLS).
create or replace function public.user_goals_delete_custom_goal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.custom_goal_id is not null then
    delete from public.user_custom_goals where id = old.custom_goal_id;
  end if;
  return old;
end;
$$;

drop trigger if exists user_goals_delete_custom_goal_trg on public.user_goals;
create trigger user_goals_delete_custom_goal_trg
  after delete on public.user_goals
  for each row execute function public.user_goals_delete_custom_goal();

-- 4b. Build antigo: INSERT em user_goals apontando para uma meta
--     personalizada em `goals`. Move para user_custom_goals antes de gravar.
--     Se o id já foi usado (cópia de meta de outra pessoa pelo feed), a
--     pessoa ganha uma CÓPIA própria com id novo.
create or replace function public.user_goals_route_custom_goal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  g      public.goals%rowtype;
  v_id   bigint;
begin
  if new.goal_id is null then
    return new;
  end if;

  select * into g from public.goals
   where id = new.goal_id and created_by_user = 1;
  if not found then
    return new;
  end if;

  if exists (select 1 from public.user_custom_goals where id = g.id) then
    insert into public.user_custom_goals (user_id, description, type, duration, quantity)
    values (new.user_id, g.description, coalesce(g.type, new.type_goal), g.duration, g.quantity)
    returning id into v_id;
  else
    insert into public.user_custom_goals (id, user_id, description, type, duration, quantity, created_at)
    values (g.id, new.user_id, g.description, coalesce(g.type, new.type_goal), g.duration, g.quantity, g.created_at)
    returning id into v_id;
  end if;

  new.custom_goal_id := v_id;
  new.goal_id := null;

  -- A linha do catálogo só sai se ninguém mais aponta para ela.
  if not exists (select 1 from public.user_goals where goal_id = g.id) then
    delete from public.goals where id = g.id;
  end if;

  return new;
end;
$$;

drop trigger if exists user_goals_route_custom_goal_trg on public.user_goals;
create trigger user_goals_route_custom_goal_trg
  before insert on public.user_goals
  for each row execute function public.user_goals_route_custom_goal();

-- ─── 4c. routines.goal_id deixa de ser FK para `goals` ──────────────────────
--
-- A coluna agora guarda a identidade da meta, que pode estar em `goals` ou em
-- `user_custom_goals`. Uma FK para `goals` barraria o vínculo com meta
-- personalizada, e o delete do passo 5. Se a FK não existir, não faz nada.

do $$
declare
  c record;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_attribute att
        on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
     where con.contype = 'f'
       and con.conrelid = 'public.routines'::regclass
       and con.confrelid = 'public.goals'::regclass
       and att.attname = 'goal_id'
  loop
    execute format('alter table public.routines drop constraint %I', c.conname);
  end loop;
end $$;

-- ─── 5. Mover o que já existe ───────────────────────────────────────────────
--
-- Por meta personalizada em `goals`: o PRIMEIRO user_goals (quem criou)
-- mantém o id original. Quem copiou pelo feed ganha id novo, e as rotinas
-- dessa pessoa que apontavam para o id antigo são remapeadas.

do $$
declare
  g       record;
  ug      record;
  v_first boolean;
  v_id    bigint;
begin
  for g in
    select * from public.goals where created_by_user = 1 order by id
  loop
    v_first := not exists (select 1 from public.user_custom_goals where id = g.id);

    for ug in
      select * from public.user_goals
       where goal_id = g.id
       order by created_at nulls last, id
    loop
      if v_first then
        insert into public.user_custom_goals (id, user_id, description, type, duration, quantity, created_at)
        values (g.id, ug.user_id, g.description, coalesce(g.type, ug.type_goal), g.duration, g.quantity, g.created_at)
        returning id into v_id;
        v_first := false;
      else
        insert into public.user_custom_goals (user_id, description, type, duration, quantity, created_at)
        values (ug.user_id, g.description, coalesce(g.type, ug.type_goal), g.duration, g.quantity, g.created_at)
        returning id into v_id;

        update public.routines
           set goal_id = v_id
         where user_id = ug.user_id
           and goal_id = g.id;
      end if;

      update public.user_goals
         set custom_goal_id = v_id,
             goal_id = null
       where id = ug.id;
    end loop;

    -- Rotinas que ainda apontem para uma meta personalizada sem dono (a meta
    -- já tinha sido apagada) perdem o vínculo antes da linha sair.
    update public.routines r
       set goal_id = null
     where r.goal_id = g.id
       and not exists (select 1 from public.user_custom_goals c where c.id = g.id);

    delete from public.goals where id = g.id;
  end loop;
end $$;

-- ─── 6. Conferência (só leitura) ────────────────────────────────────────────
--
-- As três devem voltar 0.

select
  (select count(*) from public.goals where created_by_user = 1)           as personalizadas_no_catalogo,
  (select count(*) from public.user_goals where goal_id is null
                                             and custom_goal_id is null)  as user_goals_sem_meta,
  (select count(*) from public.user_goals where goal_id is not null
                                             and custom_goal_id is not null) as user_goals_com_as_duas;
