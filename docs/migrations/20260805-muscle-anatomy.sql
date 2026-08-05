-- ============================================================
-- Migration: taxonomia anatômica — porções e cabeças musculares (2026-08-05)
-- ============================================================
-- Fase 2 do plano de treino profissional. Hoje `workouts.muscle_group` é UM
-- texto livre com ~10 valores ("Peito", "Costas", "Tríceps"…). Isso não
-- responde a pergunta que o usuário faz de verdade: *"quais exercícios pegam a
-- porção superior do peito?"* ou *"qual pega a cabeça longa do tríceps?"*.
--
-- Duas tabelas resolvem:
--
--  1. `muscles`         — catálogo canônico de músculos/porções (~40 linhas),
--                         bilíngue como os outros catálogos (name/name_eng).
--  2. `workout_muscles` — quais músculos cada exercício recruta, com PAPEL
--                         (primário/secundário/estabilizador) e ÊNFASE 0–100.
--
-- Por que tabela de ligação e não uma coluna JSON em `workouts`: a consulta que
-- importa é a INVERSA — "me dá os exercícios com ênfase >= 60 em
-- `triceps_cabeca_longa`, do maior para o menor". Com JSON seria preciso baixar
-- o catálogo inteiro e filtrar no cliente.
--
-- `muscle_group` NÃO é substituída: continua sendo o rótulo grosso do card, do
-- filtro atual e do fallback de imagem. A anatomia é uma camada ACIMA dela —
-- `muscles.group_name` casa com os valores já existentes, então tudo que é por
-- grupo continua funcionando sem tocar em nada.
--
-- Ordem: rodar DEPOIS de `20260805-training-mode.sql`. Idempotente.
-- Popular `workout_muscles` com `node scripts/seed-workout-muscles.mjs`.
-- ============================================================

-- ── 1. Catálogo de músculos ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.muscles (
  -- slug estável e legível ('peitoral_clavicular'): é ele que o código do app e
  -- o script de seed referenciam. UUID aqui só criaria indireção sem ganho.
  id          text PRIMARY KEY,
  -- Casa com os valores já usados em `workouts.muscle_group` ('Peito',
  -- 'Costas'…), para a navegação por grupo continuar valendo.
  group_name  text NOT NULL,
  name        text NOT NULL,
  name_eng    text,
  -- Posição dentro do grupo, quando faz sentido ('superior' | 'medio' |
  -- 'inferior' | 'lateral' | 'posterior' | 'anterior'). NULL = o grupo não se
  -- divide (ex.: sóleo). É o que vira a navegação "Peito → Superior/Meio/Inferior".
  region      text,
  -- Região do mapa corporal que este músculo acende, e em qual vista.
  body_part   text NOT NULL,
  view        text NOT NULL CHECK (view IN ('front', 'back')),
  -- Ordem de exibição dentro do grupo (superior → inferior).
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.muscles IS
  'Catálogo canônico de músculos e suas porções/cabeças. Camada ACIMA de workouts.muscle_group (que continua existindo): group_name casa com os valores daquela coluna.';

ALTER TABLE public.muscles ENABLE ROW LEVEL SECURITY;

-- Catálogo: leitura pública, escrita só por service role (seeds), igual a
-- `workouts`/`diets`. Sem policy de INSERT/UPDATE/DELETE = ninguém com a anon
-- key escreve.
DROP POLICY IF EXISTS "muscles_select_all" ON public.muscles;
CREATE POLICY "muscles_select_all" ON public.muscles FOR SELECT USING (true);

-- ── 2. Recrutamento muscular por exercício ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workout_muscles (
  workout_id uuid NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  muscle_id  text NOT NULL REFERENCES public.muscles(id) ON DELETE CASCADE,
  -- primary     = alvo do exercício
  -- secondary   = ajuda de forma relevante (entra no cálculo de volume)
  -- stabilizer  = trabalha isometricamente; aparece na ficha, não conta volume
  role       text NOT NULL CHECK (role IN ('primary', 'secondary', 'stabilizer')),
  -- Quanto do estímulo do exercício vai para este músculo (0–100). NÃO precisa
  -- somar 100 entre as linhas de um exercício: é intensidade relativa por
  -- músculo, não uma repartição percentual. É o que ordena o picker
  -- ("os que mais pegam a porção inferior") e o que pinta o mapa corporal.
  emphasis   int NOT NULL DEFAULT 50 CHECK (emphasis BETWEEN 0 AND 100),
  PRIMARY KEY (workout_id, muscle_id)
);

COMMENT ON COLUMN public.workout_muscles.emphasis IS
  'Intensidade 0–100 do estímulo neste músculo. NÃO é repartição percentual — as linhas de um exercício não somam 100.';

-- A consulta inversa ("exercícios que mais pegam este músculo") é a razão de
-- existir da tabela; este índice é o que a torna barata.
CREATE INDEX IF NOT EXISTS workout_muscles_by_muscle_idx
  ON public.workout_muscles (muscle_id, emphasis DESC);

ALTER TABLE public.workout_muscles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workout_muscles_select_all" ON public.workout_muscles;
CREATE POLICY "workout_muscles_select_all" ON public.workout_muscles FOR SELECT USING (true);

-- Escrita: só nas linhas de exercícios que o PRÓPRIO usuário criou. Assim o
-- formulário "Criar exercício personalizado" pode declarar a anatomia do item
-- custom, sem ninguém conseguir reescrever o catálogo central pela anon key.
-- (Mesma lógica da RLS de escrita de `workouts`.)
DROP POLICY IF EXISTS "workout_muscles_write_own" ON public.workout_muscles;
CREATE POLICY "workout_muscles_write_own" ON public.workout_muscles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workouts w
      WHERE w.id = workout_muscles.workout_id
        AND w.created_by_user = true
        AND w.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workouts w
      WHERE w.id = workout_muscles.workout_id
        AND w.created_by_user = true
        AND w.created_by = auth.uid()
    )
  );

-- ── 3. Seed do catálogo de músculos ─────────────────────────────────────────
-- Reexecutável: ON CONFLICT atualiza os rótulos, preservando as ligações já
-- feitas em workout_muscles (que apontam para o id/slug, não para o nome).

INSERT INTO public.muscles (id, group_name, name, name_eng, region, body_part, view, sort_order) VALUES
  -- Peito ─ o peitoral maior tem 3 porções com estímulo bem diferente por ângulo
  ('peitoral_clavicular', 'Peito', 'Peitoral superior (clavicular)', 'Upper chest (clavicular)', 'superior', 'chest', 'front', 10),
  ('peitoral_esternal',   'Peito', 'Peitoral médio (esternal)',      'Mid chest (sternal)',      'medio',    'chest', 'front', 20),
  ('peitoral_abdominal',  'Peito', 'Peitoral inferior (abdominal)',  'Lower chest (abdominal)',  'inferior', 'chest', 'front', 30),
  ('serratil_anterior',   'Peito', 'Serrátil anterior',              'Serratus anterior',        NULL,       'chest', 'front', 40),

  -- Costas
  ('latissimo_dorsal',  'Costas', 'Grande dorsal (latíssimo)', 'Latissimus dorsi',  NULL,        'lats',       'back', 10),
  ('redondo_maior',     'Costas', 'Redondo maior',             'Teres major',       NULL,        'lats',       'back', 20),
  ('trapezio_superior', 'Costas', 'Trapézio superior',         'Upper trapezius',   'superior',  'traps',      'back', 30),
  ('trapezio_medio',    'Costas', 'Trapézio médio',            'Mid trapezius',     'medio',     'traps',      'back', 40),
  ('trapezio_inferior', 'Costas', 'Trapézio inferior',         'Lower trapezius',   'inferior',  'traps',      'back', 50),
  ('romboides',         'Costas', 'Romboides',                 'Rhomboids',         'medio',     'traps',      'back', 60),
  ('eretores_espinha',  'Costas', 'Eretores da espinha (lombar)', 'Erector spinae',  'inferior',  'lower_back', 'back', 70),

  -- Ombros ─ as 3 cabeças do deltoide quase nunca são treinadas por igual
  ('deltoide_anterior',  'Ombros', 'Deltoide anterior',  'Front delt', 'anterior',  'shoulders_front', 'front', 10),
  ('deltoide_lateral',   'Ombros', 'Deltoide lateral',   'Side delt',  'lateral',   'shoulders_front', 'front', 20),
  ('deltoide_posterior', 'Ombros', 'Deltoide posterior', 'Rear delt',  'posterior', 'shoulders_rear',  'back',  30),
  ('manguito_rotador',   'Ombros', 'Manguito rotador',   'Rotator cuff', NULL,      'shoulders_rear',  'back',  40),

  -- Bíceps e flexores do cotovelo
  ('biceps_cabeca_longa', 'Bíceps', 'Bíceps — cabeça longa',  'Biceps long head',  'lateral', 'biceps', 'front', 10),
  ('biceps_cabeca_curta', 'Bíceps', 'Bíceps — cabeça curta',  'Biceps short head', 'medio',   'biceps', 'front', 20),
  ('braquial',            'Bíceps', 'Braquial',               'Brachialis',        NULL,      'biceps', 'front', 30),

  -- Tríceps ─ as 3 cabeças; a longa só é bem recrutada com o braço acima da cabeça
  ('triceps_cabeca_longa',   'Tríceps', 'Tríceps — cabeça longa',   'Triceps long head',   'posterior', 'triceps', 'back', 10),
  ('triceps_cabeca_lateral', 'Tríceps', 'Tríceps — cabeça lateral', 'Triceps lateral head', 'lateral',  'triceps', 'back', 20),
  ('triceps_cabeca_medial',  'Tríceps', 'Tríceps — cabeça medial',  'Triceps medial head',  'medio',    'triceps', 'back', 30),

  -- Antebraço ─ grupo próprio (o catálogo tem exercícios com muscle_group
  -- 'Antebraço'; deixá-los sob 'Braços' faria o grupo sumir da navegação por
  -- porção enquanto aparece na navegação por grupo). O braquiorradial mora
  -- aqui, mesmo sendo flexor de cotovelo: é onde ele está no corpo.
  ('flexores_antebraco',   'Antebraço', 'Flexores do antebraço',   'Forearm flexors',   NULL, 'forearms', 'front', 10),
  ('extensores_antebraco', 'Antebraço', 'Extensores do antebraço', 'Forearm extensors', NULL, 'forearms', 'front', 20),
  ('braquiorradial',       'Antebraço', 'Braquiorradial',          'Brachioradialis',   NULL, 'forearms', 'front', 30),

  -- Pernas
  ('quadriceps_reto_femoral',  'Pernas', 'Quadríceps — reto femoral',  'Rectus femoris',   'medio',     'quads',      'front', 10),
  ('quadriceps_vasto_lateral', 'Pernas', 'Quadríceps — vasto lateral', 'Vastus lateralis', 'lateral',   'quads',      'front', 20),
  ('quadriceps_vasto_medial',  'Pernas', 'Quadríceps — vasto medial',  'Vastus medialis',  'medio',     'quads',      'front', 30),
  ('isquiotibiais',            'Pernas', 'Isquiotibiais',              'Hamstrings',       'posterior', 'hamstrings', 'back',  40),
  ('gluteo_maximo',            'Pernas', 'Glúteo máximo',              'Gluteus maximus',  'posterior', 'glutes',     'back',  50),
  ('gluteo_medio',             'Pernas', 'Glúteo médio',               'Gluteus medius',   'lateral',   'glutes',     'back',  60),
  ('adutores',                 'Pernas', 'Adutores',                   'Adductors',        'medio',     'adductors',  'front', 70),
  ('flexores_quadril',         'Pernas', 'Flexores do quadril',        'Hip flexors',      'anterior',  'quads',      'front', 80),

  -- Panturrilha
  ('gastrocnemio',    'Panturrilha', 'Gastrocnêmio',    'Gastrocnemius',     NULL, 'calves',       'back',  10),
  ('soleo',           'Panturrilha', 'Sóleo',           'Soleus',            NULL, 'calves',       'back',  20),
  ('tibial_anterior', 'Panturrilha', 'Tibial anterior', 'Tibialis anterior', NULL, 'calves_front', 'front', 30),

  -- Abdômen
  ('reto_abdominal_superior', 'Abdômen', 'Reto abdominal superior', 'Upper abs',          'superior', 'abs',      'front', 10),
  ('reto_abdominal_inferior', 'Abdômen', 'Reto abdominal inferior', 'Lower abs',          'inferior', 'abs',      'front', 20),
  ('obliquos',                'Abdômen', 'Oblíquos',                'Obliques',           'lateral',  'obliques', 'front', 30),
  ('transverso_abdominal',    'Abdômen', 'Transverso do abdômen',   'Transverse abdominis', NULL,     'abs',      'front', 40),

  -- Cardio ─ para exercício aeróbico não ficar sem nenhuma linha de anatomia
  ('sistema_cardiovascular', 'Cardio', 'Sistema cardiovascular', 'Cardiovascular system', NULL, 'cardio', 'front', 10)
ON CONFLICT (id) DO UPDATE SET
  group_name = EXCLUDED.group_name,
  name       = EXCLUDED.name,
  name_eng   = EXCLUDED.name_eng,
  region     = EXCLUDED.region,
  body_part  = EXCLUDED.body_part,
  view       = EXCLUDED.view,
  sort_order = EXCLUDED.sort_order;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- SELECT group_name, count(*) FROM muscles GROUP BY 1 ORDER BY 1;
-- SELECT count(*) FROM workout_muscles;  -- 0 até rodar scripts/seed-workout-muscles.mjs
