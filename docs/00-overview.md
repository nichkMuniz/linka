# RitmoFit — Visão Geral do Produto

## O que é o RitmoFit?

RitmoFit é uma rede social fitness gamificada. Combina funcionalidades de redes sociais (feed, stories, vídeos curtos, mensagens) com ferramentas de saúde e fitness (metas, rotinas, treinos, dietas, hábitos) e elementos de gamificação (pontos, conquistas, duelos, ranking).

O objetivo central é motivar pessoas a manterem uma rotina saudável através de conexão social, competição saudável e acompanhamento de progresso.

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend | React + TypeScript |
| Roteamento | React Router v6 |
| Estilo | Tailwind CSS + Shadcn UI |
| Backend / BaaS | Supabase (Auth, Database, Storage, Realtime) |
| Ícones | Lucide React |
| Tema | next-themes (dark/light) |

---

## Telas Disponíveis

| # | Tela | Rota | Descrição |
|---|---|---|---|
| 1 | [Feed](./01-feed.md) | `/` | Feed principal com posts e stories |
| 2 | [Login / Cadastro](./02-login.md) | `/login` | Autenticação e criação de conta |
| 3 | [Shots (Clipes)](./03-shots.md) | `/shots` | Feed de vídeos curtos |
| 4 | [Novo Post](./04-novo-post.md) | `/postar` | Criação de posts e shots |
| 5 | [Metas](./05-metas.md) | `/metas` | Gestão de metas, treinos, dietas e hábitos |
| 6 | [Buscar](./06-buscar.md) | `/buscar` | Busca de usuários e rotinas |
| 7 | [Comunidade](./07-comunidade.md) | `/comunidade` | Mensagens, duelos e ranking |
| 8 | [Perfil](./08-perfil.md) | `/perfil` ou `/usuario/:id` | Perfil do usuário |
| 9 | [Detalhe do Post](./09-post-detalhe.md) | `/post/:postId` | Visualização isolada de um post |
| 10 | [Notificações](./10-notificacoes.md) | `/notificacoes` | Central de notificações |
| 11 | [Vitrine / Loja](./11-loja.md) | `/vitrine` | Hub comunitário de promoções fitness e diretório de profissionais |
| 12 | [Página não encontrada](./12-not-found.md) | `*` | Erro 404 |
| 13 | [Layouts e Componentes](./13-layouts-e-componentes.md) | — | Componentes compartilhados e layouts |
| 14 | [Database Schema](./14-database-schema.md) | — | Documentação técnica de todas as tabelas do banco |
| 15 | [Design System](./15-design-system.md) | — | Paleta de cores, tipografia, componentes, padrões visuais |

---

## Navegação Principal

### Bottom Navigation (Mobile)
- **Home** → `/` (Feed)
- **Shots** → `/shots`
- **Nova** → `/postar`
- **Metas** → `/metas`
- **Vitrine** → `/vitrine`

### Side Navigation / Header (Desktop + Mobile)
- **Perfil** (foto do usuário) → `/perfil`
- **Buscar** → `/buscar`
- **Comunidade** → `/comunidade`
- **Notificações** (badge com contagem) → `/notificacoes`

### Floating Action Menu (Mobile)
Menu flutuante arrastável que dá acesso rápido às principais telas.

---

## Funcionalidades Transversais

- **Autenticação** — protege todas as rotas exceto `/login`
- **Tema dark/light** — persiste em localStorage
- **Timer de uso diário** — controle de tempo no app com limite configurável
- **Notificações em tempo real** — via Supabase Realtime
- **Internacionalização (i18n)** — suporte a múltiplos idiomas via `language-context`
- **Toast notifications** — feedback visual de ações
- **Responsividade** — layout distinto para mobile e desktop
- **Cache de queries** — cache em memória com TTL (30s–5min) em `ritmofit-db.ts` via helper `cached()`, com camada persistida em `localStorage` (stale-while-revalidate). Todas as funções de leitura retornam dados cacheados; funções de escrita chamam `invalidateQueryCache(prefix)` para invalidar caches relacionados. Cache limpo automaticamente no logout e, no login, quando o usuário é diferente do dono do cache persistido (marcador `lk:cacheOwner`). Regras anti-envenenamento: `getViewer()` nunca cacheia viewer `null`, e funções user-scoped resolvem o viewer **fora** do `cached()` — com viewer nulo retornam vazio sem gravar no cache (chaves são sufixadas com o id do usuário, ex.: `followingIds:<uid>`).

---

## Conceito de Incentivos

Em vez de um simples "curtir", o RitmoFit usa **incentivos** com 6 tipos distintos:

| ID | Nome | Significado |
|---|---|---|
| 1 | Apoio | Suporte emocional |
| 2 | Continua | Encoraja a persistir |
| 3 | Ganhador | Celebra uma conquista |
| 4 | Consegue Mais | Acredita no potencial |
| 5 | Limite Maior | Motivação de superação |
| 6 | Mais Algum | Desafio para ir além |

---

## Fluxo de Onboarding (Cadastro)

1. **Step 1** — Nome de usuário, email e senha
2. **Step 2** — Foto de perfil e bio
3. **Step 3** — Segmentos de interesse (fitness, cardio, dietas, hábitos, yoga, esportes)
4. **Step 4** — Seguir outros usuários sugeridos
