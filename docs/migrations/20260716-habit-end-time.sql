-- ============================================================
-- Migration: hora de FIM dos hábitos (2026-07-16)
-- ============================================================
-- `user_habits.scheduled_time` passa a ser a hora de INÍCIO do hábito, e esta
-- coluna guarda a hora de FIM — a janela de execução ("Trabalhar 09:00–18:00",
-- "Almoçar 12:00–13:00").
--
-- OPCIONAL de propósito (NULL = sem hora de fim): hábitos pontuais ("Tomar
-- remédio") ou de dia inteiro ("Não fumar") não têm fim natural, e as rotinas
-- que já existem continuam válidas sem reedição.
--
-- Só `user_habits`: treino/dieta têm um horário único por rotina, sem janela.
--
-- Rodar no Supabase (SQL Editor). Idempotente.
-- ============================================================

ALTER TABLE user_habits
  ADD COLUMN IF NOT EXISTS scheduled_end_time time;

COMMENT ON COLUMN user_habits.scheduled_end_time IS
  'Hora de fim do hábito (scheduled_time = início). NULL = sem hora de fim.';
