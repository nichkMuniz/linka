-- ============================================================================
-- Seed: 20260925 — +24 metas no catálogo (`public.goals`)
--
-- Como o catálogo funciona (ver docs/05-metas.md):
--   type      1 = Fitness · 2 = Saúde · 3 = Hábitos
--   duration  dias da meta. É o DENOMINADOR do progresso: cada dia em que o
--             usuário conclui uma rotina vinculada soma +1 (máx. 1x/dia).
--             Por isso as metas abaixo falam em "dias", não em semanas.
--   quantity  frequência sugerida (dias por semana, 1–7, nunca > duration).
--             Hoje é só informativa.
--   created_by_user = 0 → aparece no catálogo (getProgrammedGoalsDb filtra).
--
-- O usuário pode ajustar duração e frequência no passo "Alterar" do wizard,
-- então os valores aqui são o ponto de partida sugerido.
--
-- Reexecutável: não insere uma descrição que já exista no catálogo.
-- ============================================================================

insert into public.goals (description, type, duration, quantity, created_by_user)
select v.description, v.type, v.duration, v.quantity, 0
  from (values
    -- ─── Fitness (type 1) ───────────────────────────────────────────────────
    ('Treinar 30 dias em 2 meses',                       1, 30, 4),
    ('Completar 12 treinos de perna',                    1, 12, 2),
    ('Ganhar força: 36 treinos de musculação',           1, 36, 3),
    ('Hipertrofia: 48 treinos em 4 meses',               1, 48, 4),
    ('Correr 20 vezes',                                  1, 20, 3),
    ('Preparação para 5 km: 24 treinos de corrida',      1, 24, 3),
    ('Cardio em 25 dias',                                1, 25, 4),
    ('Treinar em casa por 21 dias',                      1, 21, 5),
    ('Abdômen definido: 30 dias de core',                1, 30, 5),
    ('Voltar a treinar: 10 treinos leves',               1, 10, 2),
    ('Alongar ou mobilidade por 30 dias',                1, 30, 7),
    ('Treino de glúteos: 16 sessões',                    1, 16, 2),

    -- ─── Saúde (type 2) ─────────────────────────────────────────────────────
    ('Bater a meta de água por 30 dias',                 2, 30, 7),
    ('Comer proteína em todas as refeições por 21 dias', 2, 21, 7),
    ('Reduzir o açúcar por 30 dias',                     2, 30, 7),
    ('Registrar tudo o que como por 14 dias',            2, 14, 7),
    ('Comer frutas e verduras todo dia por 30 dias',     2, 30, 7),
    ('Seguir o plano alimentar por 60 dias',             2, 60, 6),
    ('Café da manhã saudável por 21 dias',               2, 21, 7),

    -- ─── Hábitos (type 3) ───────────────────────────────────────────────────
    ('Dormir 8 horas por 21 dias',                       3, 21, 7),
    ('Caminhar 10 mil passos por 30 dias',               3, 30, 5),
    ('Acordar cedo por 21 dias',                         3, 21, 5),
    ('Meditar 10 minutos por 30 dias',                   3, 30, 7),
    ('Ficar sem álcool por 30 dias',                     3, 30, 7)
  ) as v(description, type, duration, quantity)
 where not exists (
   select 1 from public.goals g
    where lower(trim(g.description)) = lower(trim(v.description))
      and g.created_by_user = 0
 );
