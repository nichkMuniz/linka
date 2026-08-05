-- ============================================================
-- Categoria "Alongamento" no catálogo workouts (2026-07-20)
-- ============================================================
-- Move os exercícios de alongamento + rolo de espuma (liberação miofascial)
-- para o `muscle_group = 'Alongamento'` — um balde de flexibilidade/recuperação
-- separado dos exercícios de força, análogo ao `muscle_group = 'Cardio'`.
--
-- 26 exercícios (19 alongamentos + 7 de rolo de espuma). Escopo confirmado:
-- NÃO inclui mobilidade (Círculos com o Quadril, Rotação de Tornozelo, etc.),
-- que segue como está.
--
-- Antes: espalhados em 'Pernas'/'Ombros'/'Costas'/'Bíceps'/'Tríceps'/'Mobilidade'.
-- Depois: todos em 'Alongamento'. Afeta o agrupamento no picker de exercícios e
-- a tag de grupo muscular exibida nas rotinas que usem esses itens.
--
-- Idempotente: só toca as 26 linhas por nome; rodar de novo não muda mais nada.
-- Não mexe em `type`, `photo` nem em nenhuma outra coluna.
-- ============================================================

UPDATE public.workouts
SET muscle_group = 'Alongamento'
WHERE name IN (
  -- Alongamentos (19)
  'Alongamento Borboleta',
  'Alongamento da Banda Iliotibial em Pé',
  'Alongamento de Bíceps em Pé (Direito)',
  'Alongamento de Braços',
  'Alongamento de Isquiotibiais com Faixa Elástica',
  'Alongamento de Panturrilha em Pé',
  'Alongamento de Panturrilha Sentado (Dorsiflexão)',
  'Alongamento de Pernas',
  'Alongamento de Plantiflexão com Elástico',
  'Alongamento de Quadríceps',
  'Alongamento de Rotação Externa',
  'Alongamento de Tríceps Direito',
  'Alongamento do Corredor',
  'Alongamento do Flexor do Quadril',
  'Alongamento em Quatro Apoiado (Lying Figure Four)',
  'Alongamento Lateral',
  'Alongamento Pombo (Pigeon Stretch)',
  'Joelho ao Peito Deitado',
  'Postura da Criança',
  -- Rolo de espuma / liberação miofascial (7)
  'Rolo de Espuma para Adutores',
  'Rolo de Espuma para Banda Iliotibial',
  'Rolo de Espuma para Glúteos',
  'Rolo de Espuma para Isquiotibiais',
  'Rolo de Espuma para Panturrilhas',
  'Rolo de Espuma para Quadríceps',
  'Rolo de Espuma para Tibial Anterior'
);

-- Conferência: deve retornar 26.
-- SELECT count(*) FROM workouts WHERE muscle_group = 'Alongamento';
-- SELECT name FROM workouts WHERE muscle_group = 'Alongamento' ORDER BY name;
