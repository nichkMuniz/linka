-- ============================================================
-- Migration: Correções de cadastro de perfil (2026-07-20)
--
--   1. Policy de INSERT no `profiles` — o upsert do cliente (cadastro /
--      ensureProfile) tinha o braço de INSERT barrado pelo RLS e falhava em
--      silêncio, então a FOTO e o HANDLE escolhidos nunca eram gravados.
--   2. `handle` passa a ser guardado SEM o prefixo "@" (consistência com todo o
--      cliente, que grava/lê sem "@" e só o exibe com "@"). Normaliza os handles
--      existentes.
--   3. Handle ÚNICO global (índice único case-insensitive) + trigger
--      `handle_new_user` à prova de colisão + RPC `check_handle_exists` para a
--      verificação de disponibilidade em tempo real na tela de cadastro.
-- ============================================================

-- ─── 1. Permitir que o usuário crie/insira o PRÓPRIO perfil ─────────────────
-- Escopo mínimo: só a própria linha (auth.uid() = user_id).
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- ─── 2. Normalizar handles existentes: sem "@", minúsculo, sem espaços ──────
update public.profiles
set handle = lower(regexp_replace(regexp_replace(handle, '^@+', ''), '\s+', '', 'g'))
where handle is not null
  and handle <> lower(regexp_replace(regexp_replace(handle, '^@+', ''), '\s+', '', 'g'));

-- ─── 3. De-duplicar handles antes de criar o índice único ──────────────────
-- Mantém o handle do perfil mais antigo; os demais recebem um sufixo por-usuário
-- (fragmento do user_id) que é garantidamente único.
do $$
declare r record;
begin
  for r in
    select user_id, handle
    from (
      select user_id, handle,
             row_number() over (partition by lower(handle) order by created_at asc nulls last) as rn
      from public.profiles
      where handle is not null and handle <> ''
    ) s
    where s.rn > 1
  loop
    update public.profiles
    set handle = r.handle || '_' || substr(replace(r.user_id::text, '-', ''), 1, 6)
    where user_id = r.user_id;
  end loop;
end $$;

-- ─── 4. Índice único global de handle (case-insensitive via lower) ─────────
create unique index if not exists profiles_handle_unique_idx
  on public.profiles (lower(handle))
  where handle is not null and handle <> '';

-- ─── 5. RPC de disponibilidade de handle (usada no cadastro, anon-friendly) ─
create or replace function public.check_handle_exists(
  p_handle       text,
  p_exclude_user uuid default null
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where lower(handle) = lower(regexp_replace(coalesce(p_handle, ''), '^@+', ''))
      and regexp_replace(coalesce(p_handle, ''), '^@+', '') <> ''
      and (p_exclude_user is null or user_id <> p_exclude_user)
  );
$$;

grant execute on function public.check_handle_exists(text, uuid) to anon, authenticated;

-- ─── 6. Reescrever handle_new_user: handle SEM "@" e à prova de colisão ─────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta         jsonb   := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_email        text    := coalesce(new.email, '');
  v_email_prefix text;
  v_nickname     text;
  v_base_handle  text;
  v_handle       text;
  v_suffix       integer := 0;
  v_photo        text;
  v_bio          text;
  v_objectives   text[];
  v_gender       text;
  v_age          integer;
  v_height       numeric;
  v_weight       numeric;
begin
  v_email_prefix := split_part(v_email, '@', 1);

  v_nickname := coalesce(
    nullif(trim(v_meta->>'full_name'), ''),
    nullif(v_email_prefix, ''),
    'Você'
  );

  -- handle limpo: SEM "@", minúsculo, apenas [a-z0-9._-]
  v_base_handle := coalesce(
    nullif(trim(lower(
      regexp_replace(
        regexp_replace(coalesce(v_meta->>'handle', ''), '@', '', 'g'),
        '[^a-z0-9._-]', '', 'g'
      )
    )), ''),
    nullif(lower(regexp_replace(v_email_prefix, '[^a-z0-9._-]', '', 'g')), ''),
    'user'
  );

  -- Garante unicidade: acrescenta sufixo numérico enquanto colidir.
  v_handle := v_base_handle;
  while exists (select 1 from public.profiles where lower(handle) = lower(v_handle)) loop
    v_suffix := v_suffix + 1;
    v_handle := v_base_handle || v_suffix::text;
  end loop;

  v_photo := nullif(trim(coalesce(v_meta->>'avatar_url', '')), '');
  v_bio   := nullif(trim(coalesce(v_meta->>'bio', '')), '');

  if jsonb_typeof(v_meta->'objectives') = 'array' then
    select array_agg(el::text) into v_objectives
    from jsonb_array_elements_text(v_meta->'objectives') as el;
  end if;

  v_gender := nullif(trim(coalesce(v_meta->>'gender', '')), '');
  begin v_age    := (v_meta->>'age')::integer;   exception when others then v_age    := null; end;
  begin v_height := (v_meta->>'height')::numeric; exception when others then v_height := null; end;
  begin v_weight := (v_meta->>'weight')::numeric; exception when others then v_weight := null; end;

  insert into public.profiles (
    user_id, nickname, handle, photo, bio,
    objectives, gender, age, height, weight,
    created_at, updated_at
  ) values (
    new.id, v_nickname, v_handle, v_photo, v_bio,
    v_objectives, v_gender, v_age, v_height, v_weight,
    now(), now()
  )
  on conflict (user_id) do update set
    nickname   = coalesce(excluded.nickname,   profiles.nickname),
    handle     = coalesce(excluded.handle,     profiles.handle),
    photo      = coalesce(excluded.photo,      profiles.photo),
    bio        = coalesce(excluded.bio,        profiles.bio),
    objectives = coalesce(excluded.objectives, profiles.objectives),
    gender     = coalesce(excluded.gender,     profiles.gender),
    age        = coalesce(excluded.age,        profiles.age),
    height     = coalesce(excluded.height,     profiles.height),
    weight     = coalesce(excluded.weight,     profiles.weight),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
