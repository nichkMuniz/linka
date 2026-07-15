-- Adiciona coluna last_progress_date na tabela user_goals
-- Usada para garantir que o progresso de uma meta (days_completed/perc) seja
-- incrementado apenas uma vez por dia, independente de quantas rotinas
-- vinculadas o usuário completar (treino, dieta, hábito).
ALTER TABLE user_goals
  ADD COLUMN IF NOT EXISTS last_progress_date date;
