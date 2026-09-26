-- ============================================================================
-- Migration: 20260925 — `goals.description_eng` (catálogo de metas em inglês)
--
-- ⚠️ OBRIGATÓRIA e ANTES do próximo build do app: o cliente passa a pedir
-- `description_eng` em todas as leituras de `goals`. Sem a coluna, o
-- PostgREST devolve erro 42703 e as metas somem da tela.
--
-- Mesmo padrão de workouts/diets/habits (`name_eng`/`description_eng`):
-- o app usa `localizedGoalDescription()` → pickLocalized, que cai no
-- português quando a coluna está NULL. Metas criadas pelo usuário
-- (created_by_user = 1) ficam NULL de propósito: é texto dele.
--
-- Rodar DEPOIS de `20260925-goals-catalog-seed.sql` para as 24 metas novas
-- já saírem traduzidas. Reexecutável.
-- ============================================================================

-- ─── 1. Coluna ──────────────────────────────────────────────────────────────

alter table public.goals
  add column if not exists description_eng text;

-- ─── 2. Traduções ───────────────────────────────────────────────────────────
--
-- Casamento pela descrição em português (sem diferenciar maiúsculas/espaços),
-- só no catálogo. Não sobrescreve uma tradução já preenchida.

update public.goals g
   set description_eng = v.eng
  from (values
    -- Fitness
    ('Treinar 30 dias em 2 meses',                       'Work out 30 days in 2 months'),
    ('Completar 12 treinos de perna',                    'Complete 12 leg workouts'),
    ('Ganhar força: 36 treinos de musculação',           'Build strength: 36 weight training sessions'),
    ('Hipertrofia: 48 treinos em 4 meses',               'Hypertrophy: 48 workouts in 4 months'),
    ('Correr 20 vezes',                                  'Go for 20 runs'),
    ('Preparação para 5 km: 24 treinos de corrida',      '5K prep: 24 running workouts'),
    ('Cardio em 25 dias',                                'Cardio on 25 days'),
    ('Treinar em casa por 21 dias',                      'Work out at home for 21 days'),
    ('Abdômen definido: 30 dias de core',                'Defined abs: 30 days of core'),
    ('Voltar a treinar: 10 treinos leves',               'Get back on track: 10 light workouts'),
    ('Alongar ou mobilidade por 30 dias',                'Stretching or mobility for 30 days'),
    ('Treino de glúteos: 16 sessões',                    'Glute training: 16 sessions'),
    -- Saúde
    ('Bater a meta de água por 30 dias',                 'Hit your water goal for 30 days'),
    ('Comer proteína em todas as refeições por 21 dias', 'Eat protein at every meal for 21 days'),
    ('Reduzir o açúcar por 30 dias',                     'Cut back on sugar for 30 days'),
    ('Registrar tudo o que como por 14 dias',            'Log everything you eat for 14 days'),
    ('Comer frutas e verduras todo dia por 30 dias',     'Eat fruits and vegetables every day for 30 days'),
    ('Seguir o plano alimentar por 60 dias',             'Follow your meal plan for 60 days'),
    ('Café da manhã saudável por 21 dias',               'Healthy breakfast for 21 days'),
    -- Hábitos
    ('Dormir 8 horas por 21 dias',                       'Sleep 8 hours for 21 days'),
    ('Caminhar 10 mil passos por 30 dias',               'Walk 10,000 steps for 30 days'),
    ('Acordar cedo por 21 dias',                         'Wake up early for 21 days'),
    ('Meditar 10 minutos por 30 dias',                   'Meditate 10 minutes for 30 days'),
    ('Ficar sem álcool por 30 dias',                     'Go alcohol-free for 30 days')
  ) as v(pt, eng)
 where lower(trim(g.description)) = lower(trim(v.pt))
   and g.created_by_user = 0
   and (g.description_eng is null or trim(g.description_eng) = '');

-- Metas antigas do catálogo (anteriores a 20260925), casadas por id.
update public.goals g
   set description_eng = v.eng
  from (values
    (1::bigint, 'Lose weight'),
    (2::bigint, 'Work out 5x a week'),
    (3::bigint, 'Be more organized'),
    (5::bigint, 'Run 5 km'),
    (6::bigint, 'Be healthier')
  ) as v(id, eng)
 where g.id = v.id
   and g.created_by_user = 0
   and (g.description_eng is null or trim(g.description_eng) = '');

-- ─── 3. O que ainda falta traduzir (só leitura) ─────────────────────────────
--
-- Metas de catálogo que já existiam antes da carga de hoje. Rode, copie o
-- resultado e complete o bloco de traduções acima (ou mande para o Claude).

select id, type, description
  from public.goals
 where created_by_user = 0
   and (description_eng is null or trim(description_eng) = '')
 order by type, id;
