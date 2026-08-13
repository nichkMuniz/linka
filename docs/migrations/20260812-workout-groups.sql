-- ============================================================
-- Migration: grupos de exercício (variações) — 2026-08-12
-- ============================================================
-- O catálogo tem 13 supinos, 23 remadas, 18 agachamentos. Hoje isso obriga o
-- usuário a decidir na CRIAÇÃO da rotina qual variação ele vai fazer — decisão
-- que ele só toma na academia, olhando o que está livre.
--
-- A variação hoje existe só dentro do NOME ("Supino Inclinado com Halteres").
-- Nenhuma coluna diz que ele é um supino, nem que o equipamento é halter:
-- `equipment` está preenchida em 17 de 273 linhas. Por isso a grade nova.
--
-- MODELO
--   workout_groups          — o movimento ("Supino"), com uma variação padrão
--   workouts.group_id       — a que movimento cada variação pertence
--
-- `user_workouts.workout_id` continua NOT NULL e apontando para uma variação
-- concreta: ele passa a significar **a variação escolhida por último**. A rotina
-- exibe o grupo; a sessão abre já com essa variação e troca com um toque,
-- gravando a troca de volta em `user_workouts.workout_id`. Nada de rotina
-- existente quebra: quem tem `group_id` nulo se comporta exatamente como hoje.
--
-- O QUE NÃO MUDA (de propósito)
--   `user_workouts_hist.workout_id` continua gravando a VARIAÇÃO executada, e
--   PR / progressão / coluna ANTERIOR continuam por variação. Comparar supino
--   com barra e supino com halter no mesmo gráfico compararia coisas
--   diferentes — 80kg na barra não é 80kg em cada halter.
--
-- CRITÉRIO DA CURADORIA (o que virou grupo e o que ficou sozinho)
--   Mesmo padrão de movimento + mesmo músculo alvo = mesmo grupo; o que muda
--   entre os irmãos é equipamento (barra/halter/máquina/cabo) ou pegada.
--   Ficaram SEPARADOS os casos em que a mudança altera o estímulo:
--     · supino reto ≠ inclinado ≠ declinado  (porções diferentes do peitoral)
--     · rosca direta ≠ martelo               (bíceps × braquial)
--     · agachamento livre ≠ búlgaro          (bilateral × unilateral)
--     · terra convencional ≠ romeno ≠ sumô   (padrões de quadril diferentes)
--   Exercício sem irmão continua com `group_id` NULL — não vira grupo de um.
--
-- Rodar no Supabase (SQL Editor). Idempotente.
-- ============================================================

-- ── 1. Tabela de grupos ─────────────────────────────────────────────────────

create table if not exists public.workout_groups (
  id           text primary key,
  name         text not null,
  name_eng     text,
  muscle_group text not null,
  -- Variação que a rotina recebe quando o usuário escolhe o GRUPO no picker.
  -- Deve ser a mais comum/disponível do grupo (barra livre > máquina exótica).
  default_workout_id uuid references public.workouts(id) on delete set null,
  photo        text
);

comment on table public.workout_groups is
  'Movimento que agrupa variações do mesmo exercício (Supino, Remada, Agachamento). O usuário escolhe o grupo ao montar a rotina e a variação na hora do treino.';

alter table public.workout_groups enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workout_groups' and policyname = 'workout_groups_read_all'
  ) then
    -- Leitura pública, escrita só por service role — mesma postura de `workouts`.
    create policy workout_groups_read_all on public.workout_groups for select using (true);
  end if;
end $$;

-- ── 2. Ligação do catálogo ──────────────────────────────────────────────────

alter table public.workouts
  add column if not exists group_id text references public.workout_groups(id) on delete set null;

comment on column public.workouts.group_id is
  'Grupo/movimento a que esta variação pertence (NULL = exercício sem irmãos). Definido por curadoria; não é derivado do nome.';

-- O picker lista as variações de um grupo — este índice cobre exatamente isso.
create index if not exists workouts_group_idx
  on public.workouts (group_id)
  where group_id is not null;

-- ── 3. Os grupos ────────────────────────────────────────────────────────────

insert into public.workout_groups (id, name, name_eng, muscle_group) values
  -- Peito
  ('supino',                'Supino',                  'Bench press',            'Peito'),
  ('supino_inclinado',      'Supino inclinado',        'Incline bench press',    'Peito'),
  ('supino_declinado',      'Supino declinado',        'Decline bench press',    'Peito'),
  ('crucifixo',             'Crucifixo',               'Chest fly',              'Peito'),
  ('crossover',             'Crossover',               'Cable crossover',        'Peito'),
  ('flexao_bracos',         'Flexão de braço',         'Push-up',                'Peito'),
  -- Costas
  ('puxada',                'Puxada',                  'Lat pulldown',           'Costas'),
  ('barra_fixa',            'Barra fixa',              'Pull-up',                'Costas'),
  ('remada',                'Remada',                  'Row',                    'Costas'),
  ('remada_unilateral',     'Remada unilateral',       'Single-arm row',         'Costas'),
  ('pullover',              'Pull-over',               'Pullover',               'Costas'),
  ('levantamento_terra',    'Levantamento terra',      'Deadlift',               'Costas'),
  ('terra_romeno',          'Terra romeno',            'Romanian deadlift',      'Pernas'),
  ('terra_sumo',            'Terra sumô',              'Sumo deadlift',          'Pernas'),
  ('terra_unilateral',      'Terra unilateral',        'Single-leg deadlift',    'Pernas'),
  ('extensao_lombar',       'Extensão de lombar',      'Back extension',         'Costas'),
  -- Ombros
  ('desenvolvimento',       'Desenvolvimento',         'Overhead press',         'Ombros'),
  ('elevacao_lateral',      'Elevação lateral',        'Lateral raise',          'Ombros'),
  ('elevacao_frontal',      'Elevação frontal',        'Front raise',            'Ombros'),
  ('elevacao_posterior',    'Elevação posterior',      'Rear delt raise',        'Ombros'),
  ('remada_alta',           'Remada alta',             'Upright row',            'Ombros'),
  ('encolhimento',          'Encolhimento',            'Shrug',                  'Ombros'),
  ('arranco_desenvolvimento','Arranco e desenvolvimento','Clean and press',      'Ombros'),
  -- Tríceps
  ('triceps_testa',         'Tríceps testa',           'Skull crusher',          'Tríceps'),
  ('triceps_pulley',        'Tríceps pulley',          'Triceps pushdown',       'Tríceps'),
  ('triceps_frances',       'Tríceps francês',         'Overhead extension',     'Tríceps'),
  ('triceps_banco',         'Tríceps no banco',        'Dips / bench dips',      'Tríceps'),
  -- Bíceps
  ('rosca_direta',          'Rosca direta',            'Biceps curl',            'Bíceps'),
  ('rosca_alternada',       'Rosca alternada',         'Alternating curl',       'Bíceps'),
  ('rosca_martelo',         'Rosca martelo',           'Hammer curl',            'Bíceps'),
  ('rosca_concentrada',     'Rosca concentrada',       'Concentration curl',     'Bíceps'),
  -- Pernas
  ('agachamento',           'Agachamento',             'Squat',                  'Pernas'),
  ('agachamento_frontal',   'Agachamento frontal',     'Front squat',            'Pernas'),
  ('agachamento_goblet',    'Agachamento goblet',      'Goblet squat',           'Pernas'),
  ('agachamento_bulgaro',   'Agachamento búlgaro',     'Bulgarian split squat',  'Pernas'),
  ('avanco',                'Avanço',                  'Lunge',                  'Pernas'),
  ('leg_press',             'Leg press',               'Leg press',              'Pernas'),
  ('cadeira_extensora',     'Cadeira extensora',       'Leg extension',          'Pernas'),
  ('mesa_flexora',          'Mesa flexora',            'Leg curl',               'Pernas'),
  ('panturrilha',           'Panturrilha',             'Calf raise',             'Panturrilha'),
  ('elevacao_pelvica',      'Elevação pélvica',        'Hip thrust',             'Gluteos'),
  -- Abdômen / core
  ('abdominal',             'Abdominal',               'Crunch',                 'Abdômen'),
  ('prancha',               'Prancha',                 'Plank',                  'Core'),
  ('elevacao_pernas',       'Elevação de pernas',      'Leg raise',              'Abdômen'),
  ('rotacao_tronco',        'Rotação de tronco',       'Trunk rotation',         'Abdômen')
on conflict (id) do update set
  name = excluded.name,
  name_eng = excluded.name_eng,
  muscle_group = excluded.muscle_group;

-- ── 4. Curadoria: variação → grupo ──────────────────────────────────────────
-- Casa por NOME (é o que dá para revisar a olho). Só linhas de catálogo:
-- exercício criado por usuário nunca entra num grupo, mesmo com nome igual.

create or replace function pg_temp.set_group(p_group text, p_names text[])
returns void language sql as $$
  update public.workouts
     set group_id = p_group
   where name = any(p_names)
     and coalesce(created_by_user, false) = false;
$$;

-- Peito
select pg_temp.set_group('supino', array[
  'Supino reto', 'Supino Reto com Barra', 'Supino com Halteres', 'Supino na Máquina',
  'Supino no Chão com Halteres', 'Supino Hex Press com Halteres', 'Supino Pegada Fechada'
]);
select pg_temp.set_group('supino_inclinado', array[
  'Supino Inclinado com Barra', 'Supino Inclinado com Halteres', 'Supino Inclinado na Máquina (Multi Press)'
]);
select pg_temp.set_group('supino_declinado', array[
  'Supino Declinado com Barra', 'Supino Declinado com Halteres', 'Supino Declinado na Máquina Hammer Strength'
]);
select pg_temp.set_group('crucifixo', array[
  'Crucifixo com Halteres', 'Crucifixo na Máquina (Butterfly)', 'Crucifixo na máquina',
  'Crucifixo no Cabo', 'Crucifixo Sentado no Cabo', 'Crucifixo no TRX', 'Crucifixo Inclinado com Halteres'
]);
select pg_temp.set_group('crossover', array['Crossover no Cabo', 'Crossover no Cabo Baixo']);
select pg_temp.set_group('flexao_bracos', array[
  'Flexão de Braço', 'Flexão Declinada', 'Flexão Inclinada', 'Flexão Diamante',
  'Flexão Pegada Fechada', 'Flexão com Palma', 'Flexão com Peso'
]);

-- Costas
select pg_temp.set_group('puxada', array[
  'Puxada na frente', 'Puxada Alta no Cabo', 'Puxada Fechada', 'Puxada Fechada Supinada',
  'Puxada no Pulley Pegada Fechada', 'Puxada Modificada'
]);
select pg_temp.set_group('barra_fixa', array[
  'Barra Fixa (Chin-up)', 'Barra Fixa Pegada Larga', 'Barra Fixa Pegada Neutra ou Remada TRX',
  'Flexões de Braço (Pull-up)'
]);
select pg_temp.set_group('remada', array[
  'Remada Curvada', 'Remada Baixa', 'Remada Sentada no Cabo', 'Remada Sentada Pegada Estreita',
  'Remada T-bar', 'Remada na Máquina', 'Remada na Máquina Pegada Estreita',
  'Remada na Máquina Pegada Estreita Supinada', 'Remada Curvada Pegada Supinada',
  'Remada com Suporte no Banco Inclinado'
]);
select pg_temp.set_group('remada_unilateral', array[
  'Remada unilateral com halter', 'Remada Unilateral no Cabo'
]);
select pg_temp.set_group('pullover', array[
  'Pull-over na Polia Alta', 'Pull-over com Corda no Cabo', 'Puxada com Braços Retos no Cabo'
]);
select pg_temp.set_group('levantamento_terra', array['Levantamento Terra', 'Levantamento Terra em Rack']);
select pg_temp.set_group('terra_romeno', array[
  'Levantamento Terra Romeno', 'Levantamento Terra Romeno com Halteres'
]);
select pg_temp.set_group('terra_sumo', array[
  'Levantamento Terra Sumô', 'Levantamento Terra Sumô com Halter', 'Levantamento Terra Sumô com Kettlebell'
]);
select pg_temp.set_group('terra_unilateral', array[
  'Levantamento Terra Unilateral com Halter', 'Levantamento Terra Unilateral com Kettlebell'
]);
select pg_temp.set_group('extensao_lombar', array[
  'Extensão de Lombar', 'Extensão de Lombar na Máquina', 'Hiperextensão'
]);

-- Ombros
select pg_temp.set_group('desenvolvimento', array[
  'Desenvolvimento militar', 'Desenvolvimento com Barra', 'Desenvolvimento com Halteres',
  'Desenvolvimento na Máquina', 'Desenvolvimento Militar com Barra W',
  'Desenvolvimento com Barra acima da Cabeça', 'Desenvolvimento com Halter Unilaral'
]);
select pg_temp.set_group('elevacao_lateral', array[
  'Elevação Lateral', 'Elevação Lateral com Halter', 'Elevação Lateral na Máquina',
  'Elevação Lateral no Cabo Unilateral'
]);
select pg_temp.set_group('elevacao_frontal', array[
  'Elevação Frontal', 'Elevação Frontal no Cabo com Barra Curta'
]);
select pg_temp.set_group('elevacao_posterior', array[
  'Elevação Posterior com Halteres', 'Crucifixo Invertido no Cabo', 'Remada Posterior com Halteres',
  'Crucifixo Invertido Inclinado', 'Elevação Posterior Sentado'
]);
select pg_temp.set_group('remada_alta', array[
  'Remada Alta com Barra W', 'Remada Alta com Halteres', 'Remada Alta no Multi Press'
]);
select pg_temp.set_group('encolhimento', array['Encolhimento com Barra', 'Encolhimento com Halteres']);
select pg_temp.set_group('arranco_desenvolvimento', array[
  'Arranco e Desenvolvimento', 'Arranco e Desenvolvimento com Barra'
]);

-- Tríceps
select pg_temp.set_group('triceps_testa', array[
  'Tríceps testa', 'Tríceps testa na polia', 'Skull Crusher com Barra W'
]);
select pg_temp.set_group('triceps_pulley', array[
  'Tríceps Pulley', 'Tríceps na Polia com Corda', 'Extensão de Tríceps no Cabo',
  'Tríceps pulley de costa na polia', 'Extensão de Tríceps Cruzada no Cabo Alto'
]);
select pg_temp.set_group('triceps_frances', array[
  'Tríceps francês', 'Extensão de Tríceps acima da Cabeça', 'Extensão de Tríceps com Barra acima da Cabeça',
  'Extensão de tríceps acima da cabeça na polia', 'Tríceps acima da Cabeça com Halter'
]);
select pg_temp.set_group('triceps_banco', array[
  'Tríceps no Banco', 'Tríceps no Banco (Paralelas)', 'Mergulho no Chão'
]);

-- Bíceps
select pg_temp.set_group('rosca_direta', array[
  'Rosca Direta com Barra Reta', 'Rosca Bíceps com Barra W', 'Rosca Bíceps com Halteres',
  'Rosca Bíceps no Cabo', 'Rosca W Sentado', 'Rosca Bíceps Aberta com Halteres'
]);
select pg_temp.set_group('rosca_alternada', array[
  'Rosca Alternada com Halteres', 'Rosca Bíceps Alternada com Halter'
]);
select pg_temp.set_group('rosca_martelo', array[
  'Rosca Martelo', 'Rosca Martelo Alternada com Halter', 'Rosca Martelo no Cabo'
]);
select pg_temp.set_group('rosca_concentrada', array['Rosca Concentrada', 'Rosca Concentrada no Cabo']);

-- Pernas
select pg_temp.set_group('agachamento', array[
  'Agachamento Livre', 'Agachamento com Barra', 'Agachamento Completo com Barra',
  'Agachamento com Halter', 'Agachamento na Máquina Smith', 'Agachamento Pêndulo (Hack Pendular)'
]);
select pg_temp.set_group('agachamento_frontal', array['Agachamento Frontal', 'Agachamento Frontal com Halteres']);
select pg_temp.set_group('agachamento_goblet', array['Agachamento Goblet', 'Agachamento Goblet com Halter']);
select pg_temp.set_group('agachamento_bulgaro', array[
  'Agachamento Búlgaro', 'Agachamento Búlgaro com Halteres', 'Agachamento Búlgaro Unilateral Esquerdo',
  'Agachamento Split na Máquina Smith'
]);
select pg_temp.set_group('avanco', array[
  'Avanço', 'Avanço com Halteres', 'Avanço Caminhando', 'Avanço Caminhando com Halteres',
  'Avanço Reverso', 'Avanço para Trás com Barra', 'Avanço para Trás com Halteres',
  'Avanço Unilateral com Kettlebell', 'Avanço Lateral Deslizante', 'Avanço com Rotação de Tronco',
  'Investidas'
]);
select pg_temp.set_group('leg_press', array['Leg Press', 'Leg Press Pegada Estreita', 'Leg Press na Máquina Hack']);
select pg_temp.set_group('cadeira_extensora', array[
  'Cadeira extensora', 'Cadeira extensora unilateral', 'Extensão de Joelho'
]);
select pg_temp.set_group('mesa_flexora', array[
  'Mesa flexora', 'Flexão de Joelho Deitado (Leg Curl)', 'Flexão de Joelho Sentado (Leg Curl)',
  'Flexão de Joelho em Pé (Leg Curl)'
]);
select pg_temp.set_group('panturrilha', array[
  'Elevação de Panturrilha', 'Elevação de Panturrilha em Pé', 'Elevação de Panturrilha Sentado com Halter',
  'Elevação de Calcanhares com Duas Pernas', 'Pressão de Panturrilha na Leg Press'
]);
select pg_temp.set_group('elevacao_pelvica', array[
  'Ponte de Glúteo', 'Elevação de Quadril com Halter', 'Elevação de glúteo na maquina'
]);

-- Abdômen / core
select pg_temp.set_group('abdominal', array[
  'Abdominal Tradicional', 'Abdominal Inclinado', 'Abdominal Negativo', 'Abdominal com Peso',
  'Abdominal Bicicleta', 'Abdominal com Cotovelo (Sit Up com Rotação)'
]);
select pg_temp.set_group('prancha', array['Prancha', 'Prancha Lateral', 'Prancha com Toque nos Ombros']);
select pg_temp.set_group('elevacao_pernas', array[
  'Elevação de Pernas', 'Elevação de Pernas Deitado', 'Elevação de Pernas no Banco Declinado'
]);
select pg_temp.set_group('rotacao_tronco', array[
  'Rotação Russa', 'Rotação com Anilha', 'Rotação com Bola Medicinal', 'Rotação de Tronco'
]);

-- ── 5. Variação padrão de cada grupo ────────────────────────────────────────
-- É a que a rotina recebe quando o usuário escolhe o grupo. Regra: a mais
-- comum/mais disponível numa academia — barra livre antes de máquina exótica.

create or replace function pg_temp.set_default(p_group text, p_name text)
returns void language sql as $$
  update public.workout_groups g
     set default_workout_id = w.id
    from public.workouts w
   where g.id = p_group
     and w.name = p_name
     and coalesce(w.created_by_user, false) = false;
$$;

select pg_temp.set_default('supino', 'Supino Reto com Barra');
select pg_temp.set_default('supino_inclinado', 'Supino Inclinado com Barra');
select pg_temp.set_default('supino_declinado', 'Supino Declinado com Barra');
select pg_temp.set_default('crucifixo', 'Crucifixo com Halteres');
select pg_temp.set_default('crossover', 'Crossover no Cabo');
select pg_temp.set_default('flexao_bracos', 'Flexão de Braço');
select pg_temp.set_default('puxada', 'Puxada na frente');
select pg_temp.set_default('barra_fixa', 'Barra Fixa (Chin-up)');
select pg_temp.set_default('remada', 'Remada Curvada');
select pg_temp.set_default('remada_unilateral', 'Remada unilateral com halter');
select pg_temp.set_default('pullover', 'Pull-over na Polia Alta');
select pg_temp.set_default('levantamento_terra', 'Levantamento Terra');
select pg_temp.set_default('terra_romeno', 'Levantamento Terra Romeno');
select pg_temp.set_default('terra_sumo', 'Levantamento Terra Sumô');
select pg_temp.set_default('terra_unilateral', 'Levantamento Terra Unilateral com Halter');
select pg_temp.set_default('extensao_lombar', 'Extensão de Lombar');
select pg_temp.set_default('desenvolvimento', 'Desenvolvimento com Halteres');
select pg_temp.set_default('elevacao_lateral', 'Elevação Lateral com Halter');
select pg_temp.set_default('elevacao_frontal', 'Elevação Frontal');
select pg_temp.set_default('elevacao_posterior', 'Elevação Posterior com Halteres');
select pg_temp.set_default('remada_alta', 'Remada Alta com Halteres');
select pg_temp.set_default('encolhimento', 'Encolhimento com Halteres');
select pg_temp.set_default('arranco_desenvolvimento', 'Arranco e Desenvolvimento');
select pg_temp.set_default('triceps_testa', 'Tríceps testa');
select pg_temp.set_default('triceps_pulley', 'Tríceps Pulley');
select pg_temp.set_default('triceps_frances', 'Tríceps francês');
select pg_temp.set_default('triceps_banco', 'Tríceps no Banco');
select pg_temp.set_default('rosca_direta', 'Rosca Direta com Barra Reta');
select pg_temp.set_default('rosca_alternada', 'Rosca Alternada com Halteres');
select pg_temp.set_default('rosca_martelo', 'Rosca Martelo');
select pg_temp.set_default('rosca_concentrada', 'Rosca Concentrada');
select pg_temp.set_default('agachamento', 'Agachamento Livre');
select pg_temp.set_default('agachamento_frontal', 'Agachamento Frontal');
select pg_temp.set_default('agachamento_goblet', 'Agachamento Goblet');
select pg_temp.set_default('agachamento_bulgaro', 'Agachamento Búlgaro');
select pg_temp.set_default('avanco', 'Avanço');
select pg_temp.set_default('leg_press', 'Leg Press');
select pg_temp.set_default('cadeira_extensora', 'Cadeira extensora');
select pg_temp.set_default('mesa_flexora', 'Mesa flexora');
select pg_temp.set_default('panturrilha', 'Elevação de Panturrilha');
select pg_temp.set_default('elevacao_pelvica', 'Ponte de Glúteo');
select pg_temp.set_default('abdominal', 'Abdominal Tradicional');
select pg_temp.set_default('prancha', 'Prancha');
select pg_temp.set_default('elevacao_pernas', 'Elevação de Pernas');
select pg_temp.set_default('rotacao_tronco', 'Rotação Russa');

-- Segurança: grupo que ficou com menos de 2 variações não é grupo — desfaz.
-- (Acontece se um nome desta migração não casar com o catálogo.)
update public.workouts w
   set group_id = null
 where w.group_id in (
   select group_id from public.workouts
    where group_id is not null
    group by group_id having count(*) < 2
 );

delete from public.workout_groups g
 where not exists (select 1 from public.workouts w where w.group_id = g.id);

-- ── Conferência ─────────────────────────────────────────────────────────────
-- Quantas variações por grupo (esperado: 45 grupos, ~180 linhas agrupadas):
--   select g.id, g.name, count(w.id) as variacoes,
--          (select name from workouts where id = g.default_workout_id) as padrao
--     from workout_groups g left join workouts w on w.group_id = g.id
--    group by g.id, g.name, g.default_workout_id order by variacoes desc;
--
-- Grupos SEM variação padrão (nome não casou — precisa de correção manual):
--   select id, name from workout_groups where default_workout_id is null;
--
-- Exercícios de catálogo que ficaram sem grupo (esperado: ~95, é o normal):
--   select name, muscle_group from workouts
--    where group_id is null and coalesce(created_by_user,false) = false
--    order by muscle_group, name;
