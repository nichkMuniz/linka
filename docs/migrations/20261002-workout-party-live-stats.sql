-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-10-02 — Treinar junto: "vez de quem" + estatísticas por participante
--
-- Até aqui cada participante só publicava "exercícios concluídos / total"
-- (progress_done/progress_total), uma vez por EXERCÍCIO. Duas coisas novas
-- precisam de mais:
--
--  1. Sinalizar a VEZ: ao concluir uma série e entrar no descanso, a tela mostra
--     que é a vez do amigo (ou que ele também está descansando, com a contagem).
--     Isso exige saber, por participante, quando a última série terminou e até
--     quando vai o descanso — agora escrito a cada SÉRIE concluída (e ao pular
--     o descanso). ~20–40 writes pequenos por pessoa por treino: aceito, porque
--     a alternância é por série e não existe outro jeito de sabê-la ao vivo.
--
--  2. Resumo em conjunto: séries, exercícios, volume e cargas de CADA um — no
--     card "Treino em conjunto" do resumo e no canvas compartilhável.
--
-- Nada muda em RLS: a policy de UPDATE de `workout_party_members` já limita
-- cada um à própria linha, e a de SELECT já deixa os membros se lerem. O
-- realtime da tabela (já publicado em 20260826) entrega as colunas novas.
--
-- Sem a migração o app continua funcionando: a leitura cai para as colunas
-- antigas (sem "vez" nem estatísticas por pessoa).
--
-- Rodar no Supabase SQL Editor. Reexecutável.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.workout_party_members
  -- Séries contadas (mesma regra da barra de números da sessão).
  add column if not exists sets_done      integer not null default 0,
  -- Volume em kg (kg × reps, sem cardio) e maior carga levantada.
  add column if not exists volume_kg      numeric not null default 0,
  add column if not exists best_kg        numeric not null default 0,
  -- Exercício da última série concluída — o "fazendo Supino" da vez.
  add column if not exists current_exercise text,
  -- Quando a última série terminou e até quando vai o descanso (null = sem
  -- descanso em curso). A vez é derivada disso no app: descanso no futuro =
  -- descansando; senão = fazendo a série.
  add column if not exists last_set_at    timestamptz,
  add column if not exists rest_ends_at   timestamptz,
  -- Finalizou o treino (o resumo mostra "treinando…" até aqui).
  add column if not exists finished_at    timestamptz,
  -- Por exercício: [{ name, sets, bestKg, volumeKg }] — o "com quanto peso".
  add column if not exists exercise_stats jsonb not null default '[]'::jsonb;
