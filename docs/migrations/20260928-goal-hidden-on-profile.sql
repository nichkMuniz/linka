-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-09-28 — Ocultar metas concluídas do perfil
--
-- `hidden_on_profile = true` tira a meta da faixa "Metas" do perfil — para o
-- dono E para quem visita. Não apaga nada: a meta continua na tela de Metas,
-- no histórico e no chip dos posts ligados a ela (isso é `visibility`, que
-- segue com o mesmo significado).
--
-- Escrita pelo próprio dono via a policy de UPDATE que `user_goals` já tem.
--
-- O app lê a coluna numa consulta SEPARADA e tolerante: sem esta migração o
-- perfil só não consegue ocultar (e mostra tudo, como antes) — nenhuma outra
-- leitura de metas depende dela. Rodar no Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.user_goals
  add column if not exists hidden_on_profile boolean not null default false;
