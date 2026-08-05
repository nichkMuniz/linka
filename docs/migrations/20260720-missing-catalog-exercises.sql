-- ============================================================
-- Inserção dos 14 exercícios do gerador que faltam no catálogo (2026-07-20)
-- ============================================================
-- CONTEXTO: o gerador de programa (program-generator.ts, POOLS) referencia
-- exercícios por nome. 14 desses nomes não existiam em `workouts` e ANTES eram
-- auto-criados por `handleAddWeeklyProgram` — o que poluía o catálogo com
-- duplicatas/dados não confiáveis a cada usuário. Isso foi removido do app; o
-- gerador agora só casa com o catálogo e reporta o que falta.
--
-- Esta migração insere os 14 no catálogo, DE FORMA CURADA (você/admin, não o
-- app). `created_by_user = false` = item de catálogo (não é exercício do usuário).
-- `photo` fica NULL: gerar as imagens com os prompts em `exercise-image-prompts.md`
-- (Lote 3) e apontar `photo` depois, pelo pipeline "Como subir para o app".
--
-- `type`: 1 = academia (peso/máquina) · 2 = em casa (peso do corpo/doméstico).
--
-- SEGURO DE REEXECUTAR: cada INSERT só roda se o nome ainda não existir
-- (NOT EXISTS por nome normalizado, case/acento-insensível via unaccent+lower).
-- Se a extensão `unaccent` não estiver disponível, troque `f_norm` por lower().
-- ============================================================

-- Normalizador local (case + acento) só para o guard de duplicata.
create extension if not exists unaccent;

do $$
declare
  rows_to_insert constant jsonb := '[
    {"name":"Supino reto","eng":"Barbell Bench Press","mg":"Peito","type":1,"equip":"Barra","desc":"Deite no banco reto e empurre a barra do peito até estender os braços.","desc_eng":"Lie on a flat bench and press the barbell from mid-chest to full extension."},
    {"name":"Crucifixo na máquina","eng":"Pec Deck Fly","mg":"Peito","type":1,"equip":"Máquina","desc":"Sentado na máquina peck deck, junte os antebraços à frente contraindo o peito.","desc_eng":"Seated on the pec deck, bring the forearms together in front, squeezing the chest."},
    {"name":"Cadeira extensora","eng":"Leg Extension","mg":"Pernas","type":1,"equip":"Máquina","desc":"Sentado na cadeira extensora, estenda os joelhos elevando o apoio até quase travar.","desc_eng":"Seated on the machine, extend the knees to lift the pad to near lockout."},
    {"name":"Avanço com Halteres","eng":"Dumbbell Lunge","mg":"Pernas","type":1,"equip":"Halteres","desc":"Com um halter em cada mão, dê um passo à frente e desça até o joelho de trás quase tocar o chão.","desc_eng":"Holding a dumbbell in each hand, step forward and lower until the back knee nearly touches the floor."},
    {"name":"Desenvolvimento militar","eng":"Barbell Overhead Press","mg":"Ombros","type":1,"equip":"Barra","desc":"Em pé, empurre a barra da altura dos ombros até acima da cabeça.","desc_eng":"Standing, press the barbell from shoulder height to overhead."},
    {"name":"Tríceps testa","eng":"Lying Triceps Extension","mg":"Tríceps","type":1,"equip":"Barra","desc":"Deitado, flexione os cotovelos descendo a barra em direção à testa e estenda de volta.","desc_eng":"Lying down, bend the elbows to lower the bar toward the forehead, then extend back."},
    {"name":"Esteira","eng":"Treadmill","mg":"Cardio","type":1,"equip":"Esteira","desc":"Corrida ou caminhada em ritmo constante na esteira.","desc_eng":"Steady-pace running or walking on the treadmill."},
    {"name":"Bicicleta Ergométrica","eng":"Stationary Bike","mg":"Cardio","type":1,"equip":"Bicicleta","desc":"Pedale em ritmo constante na bicicleta ergométrica.","desc_eng":"Pedal at a steady pace on the stationary bike."},
    {"name":"Elíptico","eng":"Elliptical","mg":"Cardio","type":1,"equip":"Elíptico","desc":"Movimento contínuo no aparelho elíptico, braços e pernas em oposição.","desc_eng":"Continuous stride on the elliptical, arms and legs in opposition."},
    {"name":"Remo Ergométrico","eng":"Rowing Machine","mg":"Cardio","type":1,"equip":"Remo","desc":"Puxe o remo empurrando com as pernas e trazendo a alça ao abdômen.","desc_eng":"Drive with the legs and pull the handle to the abdomen on the rowing machine."},
    {"name":"Superman","eng":"Superman","mg":"Costas","type":2,"equip":null,"desc":"Deitado de bruços, eleve braços e pernas do chão contraindo a lombar e os glúteos.","desc_eng":"Lying face-down, lift arms and legs off the floor, squeezing the lower back and glutes."},
    {"name":"Agachamento Sumô","eng":"Sumo Squat","mg":"Pernas","type":2,"equip":null,"desc":"Pés bem afastados e pontas para fora, agache mantendo o tronco ereto.","desc_eng":"Feet wide with toes out, squat down keeping the torso upright."},
    {"name":"Corda","eng":"Jump Rope","mg":"Cardio","type":2,"equip":"Corda","desc":"Pule corda em ritmo constante, saltos curtos na ponta dos pés.","desc_eng":"Jump rope at a steady pace with short bounces on the balls of the feet."},
    {"name":"Corrida com Joelhos Altos","eng":"High Knees","mg":"Cardio","type":2,"equip":null,"desc":"Corrida no lugar elevando os joelhos até a altura do quadril.","desc_eng":"Run in place lifting the knees up to hip height."}
  ]'::jsonb;
  r jsonb;
begin
  for r in select * from jsonb_array_elements(rows_to_insert)
  loop
    if not exists (
      select 1 from public.workouts w
      where unaccent(lower(w.name)) = unaccent(lower(r->>'name'))
    ) then
      insert into public.workouts
        (name, name_eng, description, description_eng, muscle_group, type, equipment, created_by_user)
      values
        (r->>'name', r->>'eng', r->>'desc', r->>'desc_eng', r->>'mg',
         (r->>'type')::int, r->>'equip', false);
    end if;
  end loop;
end $$;

-- Conferência: os 14 devem aparecer (photo NULL até subir as imagens).
-- SELECT id, name, muscle_group, type, photo
-- FROM workouts
-- WHERE name IN ('Supino reto','Crucifixo na máquina','Cadeira extensora',
--   'Avanço com Halteres','Desenvolvimento militar','Tríceps testa','Esteira',
--   'Bicicleta Ergométrica','Elíptico','Remo Ergométrico','Superman',
--   'Agachamento Sumô','Corda','Corrida com Joelhos Altos')
-- ORDER BY name;
