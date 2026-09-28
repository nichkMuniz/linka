-- ═══════════════════════════════════════════════════════════════════════════
-- 20260928 — Modal de parabéns ao ganhar o selo de verificação
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Rodar DEPOIS de 20260928-verified-tiers.sql.
--
-- `verified_seen_tier` guarda o último nível de selo que o PRÓPRIO usuário já
-- viu comemorado. O app compara com `verified_tier` ao abrir: se o nível subiu
-- (null → notable/official, notable → official), mostra o modal e grava o
-- nível atual aqui. Fica no banco (e não no aparelho) para o modal aparecer
-- uma vez só por conta, não uma vez por celular.
--
-- Escrita pelo próprio dono via `profiles_update_own` — de propósito SEM trava:
-- marcar "já vi" não concede nada. O selo em si continua protegido pelo
-- `freeze_verified_tier`.
--
-- O app tolera a coluna ausente (a checagem só é pulada), então esta migração
-- não trava o build.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists verified_seen_tier text;

alter table public.profiles
  drop constraint if exists profiles_verified_seen_tier_check;
alter table public.profiles
  add constraint profiles_verified_seen_tier_check
  check (verified_seen_tier is null or verified_seen_tier in ('official', 'notable'));

-- Contas oficiais (equipe) não precisam de parabéns: marcadas como já vistas.
-- Quem é 'notable' fica sem marca e vê o modal na próxima abertura do app.
update public.profiles
   set verified_seen_tier = verified_tier
 where verified_tier = 'official'
   and verified_seen_tier is null;
