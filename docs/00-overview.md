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
| Monitoramento de erros | Sentry (`@sentry/capacitor` + `@sentry/react`) |

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
| 12 | ~~Página não encontrada~~ | `*` | **Removida em 21/08/2026** — rota desconhecida redireciona para o Feed |
| 16 | [Hashtag](./16-hashtag.md) | `/tag/:tag` | Grade de posts de uma hashtag |
| 13 | [Layouts e Componentes](./13-layouts-e-componentes.md) | — | Componentes compartilhados e layouts |
| 14 | [Database Schema](./14-database-schema.md) | — | Documentação técnica de todas as tabelas do banco |
| 15 | [Design System](./15-design-system.md) | — | Paleta de cores, tipografia, componentes, padrões visuais |
| 16 | [Segurança](./16-seguranca.md) | — | Auditoria 2026-07-13, RLS, rotação de chaves, checklist de deploy |
| 17 | [Premium](./17-premium.md) | — | Plano LinKa Premium: modelo de dados, mapa de gates, roteiro RevenueCat (Fase 2) |
| 18 | [Painel Admin](./18-admin.md) | `/admin` | Moderação, métricas, atividade diária por usuário e gestão de premium/verificados |
| 19 | [Compartilhamento e Deep Links](./19-compartilhamento-e-deep-links.md) | — | Universal Links, custom scheme, prévia Open Graph e landing de instalação |

---

## Navegação Principal

### Bottom Navigation (Mobile)
- **Home** → `/` (Feed)
- **Shots** → `/shots`
- **Nova** → `/postar`
- **Metas** → `/metas`
- **Comunidade** → `/comunidade` (badge com mensagens não lidas)

> Os cinco itens são **só ícone** (sem rótulo de texto), com `aria-label` em cada
> `<Link>`. A Vitrine **não** fica aqui — saiu para o header.

### Side Navigation / Header (Desktop + Mobile)
- **Perfil** (foto do usuário) → `/perfil`
- **Buscar** → `/buscar`
- **Vitrine** → `/vitrine`
- **Notificações** (badge com contagem) → `/notificacoes`

> No desktop a sidebar mostra os mesmos itens **com rótulo**, e expande/recolhe
> entre 68px e 244px.

---

## Funcionalidades Transversais

- **Autenticação** — protege todas as rotas exceto `/login`
- **Tema dark/light** — persiste em localStorage
- **Timer de uso diário** — controle de tempo no app com limite configurável
- **Notificações em tempo real** — via Supabase Realtime
- **Internacionalização (i18n)** — suporte a múltiplos idiomas via `language-context`
- **Toast notifications** — feedback visual de ações
- **Responsividade** — layout distinto para mobile e desktop
- **Cache de queries** — cache em memória com TTL em `ritmofit-db.ts` via helper `cached()`, com camada persistida em `localStorage`. Todas as funções de leitura retornam dados cacheados; funções de escrita chamam `invalidateQueryCache(prefix)` para invalidar caches relacionados. Cache limpo automaticamente no logout e, no login, quando o usuário é diferente do dono do cache persistido (marcador `lk:cacheOwner`). Regras anti-envenenamento: `getViewer()` nunca cacheia viewer `null`, e funções user-scoped resolvem o viewer **fora** do `cached()` — com viewer nulo retornam vazio sem gravar no cache (chaves são sufixadas com o id do usuário, ex.: `followingIds:<uid>`). Ver **Estratégia de cache** abaixo.
- **Captura de erros (2026-08-05)** — Sentry via `client/lib/monitoring.ts`. Como o app roda em WKWebView, erro de JS **não** é crash de processo iOS e nunca aparece no relatório da Apple; esta camada é o único canal para a maioria dos bugs reais. Cobre erro de render (ErrorBoundary raiz), `unhandledrejection`, `catch` tratados (`reportHandledError`), crash nativo de plugin e o relato manual do usuário (**Perfil → Configurações → Outros → Relatar um problema**). Ativada por `VITE_SENTRY_DSN`; sem a variável vira no-op e sai do bundle. Ver `docs/13-layouts-e-componentes.md → monitoring.ts`.
- **Telemetria bufferizada** — tempo de tela (`screen_time_logs`) é acumulado em `localStorage` (`lk:screenTimeBuf`, somado por dia+tela) via `bufferScreenTime()` e enviado num **único insert em lote** por `flushScreenTimeDb()` quando o app vai para background, no logout e na abertura seguinte (resíduo). Antes era 1 INSERT por troca de rota.

---

## Estratégia de Cache (Performance)

O TTL de cada chave é definido pela **mutabilidade do dado — quem pode escrever nele** —, não pela sua importância.

| Tier | TTL | Critério | Exemplos de chave |
|---|---|---|---|
| `CACHE_TTL_SHORT` | 30s | Escrito por **terceiros**; o app não tem como saber que mudou, então o TTL é a única defesa contra dado velho | `postLikes`, `postComments`, `userStats`, `followers`, `unreadNotifCount`, `groupCheckIns` |
| `CACHE_TTL_MEDIUM` | 60s | Listas/feeds com escrita de terceiros | `activeStories`, `conversations`, `ranking`, `notifications`, `shots`, `followingIds` |
| `CACHE_TTL_LONG` | 5min | Muda raro, mas não é escrito só por nós | `userProfile` |
| `CACHE_TTL_OWN` | 15min | Escrito **só pelo próprio usuário**, e toda escrita já chama `invalidateQueryCache()` — o cache nunca envelhece sozinho | `userGoals`, `selectedGoalIds`, `weightLogs`, `workoutHistory`, `completedRoutines`, `exerciseProgress` |
| `CACHE_TTL_STATIC` | 12h | Catálogo global; muda quando **publicamos conteúdo novo**, com semanas de intervalo | `programmedGoals`, `workouts`, `catalogWorkouts`, `diets`, `catalogDiets`, `habits` |

**Regra ao adicionar uma chave nova:** se toda escrita naquele dado passa por uma função que chama `invalidateQueryCache()`, o TTL pode ser longo (`OWN`/`STATIC`) — staleness é impossível por construção. Se um terceiro pode escrever, fica em `SHORT`/`MEDIUM`.

**Persistência (`lk:q:`)** — uma entrada persistida **dentro do TTL é tratada como fresca**: é promovida para a memória e **não vai à rede**. Só quando o TTL vence ela entra em stale-while-revalidate (serve na hora, revalida em background). É isso que faz o TTL valer **entre aberturas do app** — sem esse ramo, todo cold start revalidava todas as chaves, inclusive catálogos imutáveis. Teto de 250KB por entrada e 24h de validade máxima no disco.

**Realtime e cache** — todo handler de realtime que relê um dado cacheado **precisa invalidar antes**. O evento é a prova de que o dado mudou; sem invalidar, a releitura devolve a própria entrada velha e o realtime vira no-op até o TTL vencer (era o caso dos badges de notificação e mensagem).

---

## Fronteira do chunk de entrada (2026-08-11)

> **Regra:** tudo que o `client/App.tsx` importa **estaticamente** é baixado, parseado e executado **antes do primeiro pixel**, em toda abertura do app. Antes de adicionar um `import` lá — ou em qualquer módulo que ele alcance — pergunte se aquilo precisa existir no primeiro frame.

O chunk de entrada estava em **1,34 MB (393 KB gzip)** porque o caminho estático a partir do `App.tsx` alcançava o `ritmofit-db` (12k linhas, 328 funções) por **quatro arestas ao mesmo tempo**: `AppLayout`, `Login`, `PremiumProvider` e `usePushNotifications`. O Sentry (SDK React + ponte Capacitor/Cocoa, **503 KB**) também entrava inteiro, porque `initMonitoring()` era chamado no topo do módulo.

Resultado depois do corte: **369 KB (112 KB gzip)** — 72% menor.

| Módulo | Como entra hoje | Chunk |
|---|---|---|
| `AppLayout`, `Login`, `ResetPassword`, `BannedScreen` | `React.lazy` | próprios |
| `ritmofit-db` | só por telas lazy e `import()` dinâmico | `ritmofit-db-*.js` (208 KB) |
| `@sentry/react` + `@sentry/capacitor` | `import()` dentro de `initMonitoring()`, com fila | `vendor-sentry-*.js` (503 KB) |
| react / react-dom / router, supabase, framer-motion, lucide | `manualChunks` (`vite.config.ts`) | `vendor-*.js` |

**Padrões a manter:**
- Provider ou hook montado no `App.tsx` que só usa `ritmofit-db` dentro de callback assíncrono → `const db = () => import("@/lib/ritmofit-db")` (ver `premium-context.tsx`, `use-push-notifications.ts`, `useBanGuard`).
- Só tipos vindos do `ritmofit-db` → `import type { … }` **explícito**, para o bundler eliminar a aresta (ver `workout-context.tsx`).
- O `i18n.ts` **continua no entry de propósito**: o `LanguageProvider` e o `ErrorBoundary` precisam dele antes de qualquer tela.

Ao mexer nisso, confira com `npx vite build` — o tamanho do `index-*.js` é o número que importa.

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
