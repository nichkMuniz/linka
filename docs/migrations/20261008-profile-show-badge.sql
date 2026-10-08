-- ============================================================================
-- Migration: 20261008 — Mostrar/ocultar a insígnia ao lado do nome
--
-- O usuário pode DESATIVAR a exibição da insígnia (o emoji ao lado do nome no
-- perfil, no feed, nos posts e nas conversas). Pedido de produto: um admin já
-- tem o selo oficial, e selo + insígnia lado a lado poluía o nome; o mesmo
-- vale para qualquer usuário que prefira o nome limpo.
--
-- • Só a EXIBIÇÃO muda. As insígnias continuam sendo conquistadas
--   (`user_badges`, award_my_badges), a escolhida continua salva
--   (`selected_badge_id`) e o drawer de insígnias segue funcionando.
-- • Padrão = ativa (true) — inclusive para quem já existe.
-- • A escrita é do próprio usuário pela policy de UPDATE de `profiles` que já
--   existe (a mesma que grava `selected_badge_id`). Leitura pública, como o
--   resto do perfil: quem vê o nome de alguém precisa saber se exibe a insígnia.
--
-- Sem esta migração o app não quebra: a leitura cai para a consulta sem a
-- coluna (insígnia sempre visível) e o interruptor avisa erro ao salvar.
--
-- Rodar no SQL Editor do Supabase.
-- ============================================================================

alter table public.profiles
  add column if not exists show_badge boolean not null default true;

comment on column public.profiles.show_badge is
  'false = o usuário escondeu a insígnia exibida ao lado do nome (InsigniasDrawer). Não afeta conquista nem seleção.';

-- O PostgREST precisa recarregar o schema para enxergar a coluna nova.
notify pgrst, 'reload schema';
