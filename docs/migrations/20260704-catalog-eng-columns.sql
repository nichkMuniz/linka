-- Migration: catalog English columns
-- Adiciona colunas de tradução em inglês aos catálogos de treinos, dietas e
-- hábitos, para que usuários estrangeiros entendam nome e descrição dos itens.
--
-- Padrão de nomenclatura: snake_case, consistente com o restante do schema
-- (muscle_group, wger_id, created_by_user, mealdb_id).
--
-- `name_eng`        → tradução em inglês de `name`
-- `description_eng` → tradução em inglês de `description`
--
-- Os dados (UPDATE) são gravados separadamente — ver
-- 20260704-catalog-eng-data.sql (registro re-executável do que foi aplicado
-- em produção via REST/service_role).

alter table public.workouts add column if not exists name_eng        text;
alter table public.workouts add column if not exists description_eng text;

alter table public.diets    add column if not exists name_eng        text;
alter table public.diets    add column if not exists description_eng text;

alter table public.habits   add column if not exists name_eng        text;
alter table public.habits   add column if not exists description_eng text;
