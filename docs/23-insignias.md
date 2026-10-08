# 23 — Insígnias (v2)

> Religadas em 06/10/2026 (`FEATURES.badges = true`) com um catálogo novo, focado no que o app tem hoje: **treinos, conteúdo e comunidade**. A v1 dependia de dieta, hábitos, duelos, check-in de rotina e plano pago — tudo fora do v1 — e ficou desligada desde o recorte do lançamento. **Exige a migração `docs/migrations/20261006-badges-v2.sql`** (sem ela o app não quebra: a RPC falta e nada é concedido).

## Objetivo

Recompensar quem **usa o app** — o primeiro treino, o primeiro post, compartilhar um treino, treinar junto — para a pessoa sentir progresso desde o primeiro dia. Marcos maiores (10/50/100 treinos, 10 posts, 10 seguidores) dão para onde ir depois.

## Catálogo (41 insígnias — ampliado em 06/10/2026)

Cada métrica tem uma **escada de níveis**, para sempre existir um próximo objetivo. Migrações: `20261006-badges-v2.sql` (as 14 primeiras + a RPC) e `20261006-badges-v2-more.sql` (as outras 27 + três métricas novas; só acrescenta, nada é apagado).

| Grupo | Métrica (`condition_type`) | Níveis (limiar · chave · emoji · nome PT) |
|---|---|---|
| Treinos | `workouts_total` | 1 `primeiro_treino` 🏋️ Primeiro treino · 5 `treinos_5` 👟 Aquecendo · 10 `treinos_10` 🔥 Pegando ritmo · 25 `treinos_25` ⚡ Constância · 50 `treinos_50` 💪 Dedicação · 100 `treinos_100` 🏆 Centenário · 250 `treinos_250` 🦾 Máquina · 500 `treinos_500` 👑 Lenda |
| Treinos | `routines_total` | 1 `primeira_rotina` 📋 Rotina montada · 3 `rotinas_3` 🗂️ Organizado · 5 `rotinas_5` 🧠 Estrategista |
| Conteúdo | `posts_total` | 1 `primeiro_post` 📸 Primeiro post · 10 `posts_10` ✨ Criador · 25 `posts_25` 📣 Na vitrine · 50 `posts_50` 🌟 Estrela do feed |
| Conteúdo | `workouts_shared` | 1 `treino_compartilhado` 📤 Treino compartilhado · 10 `compartilhados_10` 🚀 Inspirando a galera · 25 `compartilhados_25` 🎖️ Embaixador |
| Conteúdo | `flows_total` | 1 `primeiro_flow` 🎬 Primeiro flow · 10 `flows_10` 🎞️ Contador de histórias · 30 `flows_30` 🎥 Diretor |
| Juntos | `party_workouts` | 1 `treino_em_conjunto` 🤝 Treino em conjunto · 5 `conjunto_5` 👯 Parceria · 20 `conjunto_20` 🏟️ Time unido |
| Juntos | `challenges_total` | 1 `desafiante` ⚔️ Desafiante · 5 `desafios_5` 🥊 Competidor · 20 `desafios_20` 🛡️ Gladiador |
| Comunidade | `incentives_given` | 10 `incentivador` 👏 Incentivador · 100 `incentivos_100` 🙌 Motivador · 500 `incentivos_500` 🎉 Torcida organizada |
| Comunidade | `incentives_received` | 10 `aplaudido_10` 💖 Aplaudido · 100 `aplaudido_100` 💎 Admirado · 500 `aplaudido_500` 🏵️ Inspirador |
| Comunidade | `comments_given` | 1 `primeiro_comentario` 💬 Primeiro comentário · 25 `comentarios_25` 🗣️ Papo em dia |
| Comunidade | `following_total` | 5 `conectado_5` 🔗 Conectado |
| Comunidade | `followers_total` | 1 `primeiro_seguidor` 👥 Primeiro seguidor · 10 `seguidores_10` ⭐ Inspiração · 50 `seguidores_50` 💫 Popular · 100 `seguidores_100` 🌍 Referência · 500 `seguidores_500` 🎤 Ícone |

O limiar fica em `badges.required_checkins` (nome histórico da coluna). Os textos que o app mostra vêm das chaves `badge_<key>_name` / `badge_<key>_desc` (`i18n.ts` / `i18n-en.ts`, com os nomes em inglês); o `name`/`description` do banco é só o fallback de uma linha nova sem tradução. "Juntos" some com `FEATURES.workoutParty` / `workoutChallenge` desligadas (`visibleBadges` em `client/lib/badges.ts`).

### Como cada métrica é contada (`_badge_metrics`, no banco)

| Métrica | Fonte |
|---|---|
| `workouts_total` | **Sessões** em `user_workouts_hist` — o histórico grava uma linha por SÉRIE no "Finalizar"; mais de 60 s entre duas linhas = outra sessão (mesma regra do Histórico de treinos) |
| `routines_total` | `routines` com `type = 1` |
| `posts_total` | `posts` do usuário (repost mora em `post_reposts`, não conta) |
| `workouts_shared` | `posts.workout_summary` não nulo (post feito pelo "Resumo do treino") + `flow.text_elements` com o mini frame de treino (`{"kind":"workout"}`) |
| `flows_total` | `flow` do usuário com `reposted_from` nulo |
| `party_workouts` | `workout_party_members.finished_at` não nulo (finalizou a sessão em conjunto; host incluso) |
| `challenges_total` | Linhas em `workout_challenge_results` (quem desafia grava ao enviar; quem foi desafiado, ao cumprir) |
| `incentives_given` | `likes` + `flow_likes` em conteúdo de **outras** pessoas |
| `incentives_received` | `likes` + `flow_likes` de **outras** pessoas no meu conteúdo |
| `comments_given` | `comments` + `flow_comments` (respostas incluídas) no conteúdo de outras pessoas |
| `followers_total` | `following` com `following_id` = eu |
| `following_total` | `following` com `user_id` = eu |

## Concessão — no servidor

`award_my_badges()` (RPC, `SECURITY DEFINER`) calcula as métricas do `auth.uid()`, insere em `user_badges` tudo que já passou do limiar (`ON CONFLICT DO NOTHING`) e devolve `{ awarded: [badge_id…], metrics: {…} }`. `awarded` traz **só** o que foi conquistado naquela chamada, então chamadas simultâneas nunca celebram a mesma insígnia duas vezes. No cliente: `awardMyBadgesDb()` (`ritmofit-db.ts`).

`user_badges` **não aceita mais escrita do cliente** (a migração derruba as policies de INSERT/DELETE): antes, a policy `auth.uid() = user_id` deixava qualquer usuário se dar qualquer insígnia pela API. A avaliação da v1 (~870 linhas em `ritmofit-db.ts`: `awardBadgesForCheckInsDb`, `awardNutritionBadgesDb` e helpers) e `client/lib/habit-kinds.ts` foram removidos.

**Retroativo:** quem já usava o app ganha, na primeira avaliação, o que já tinha feito (um toast com "N novas insígnias").

## Quando avalia e como celebra

| Momento | Quem chama | Celebração |
|---|---|---|
| Fim do treino | `handleWorkoutFinished` (Metas) | **Diálogo** `BadgeUnlockedDialog`, só depois que o resumo fecha (`pendingBadges` — o diálogo é Radix e travaria o resumo por trás). Os nomes também entram no resumo e no `last_summary` |
| App abre / usuário entra | `BadgeCheckHost` (AppLayout), 2,5 s depois | Pop up de conquista |
| Volta do segundo plano (≥ 15 s fora) | `requestBadgeCheck()` no `onShow` do AppLayout | Pop up de conquista |
| Post, flow, rotina, incentivo (post/flow), comentário (post/flow), seguir alguém, desafio enviado/cumprido | `requestBadgeCheck()` no fim de `createPostDb`, `createStoryDb`, `createRoutineDb`, `togglePostIncentiveDb`, `toggleStoryLikeDb`, `addPostCommentDb`, `addStoryCommentDb`, `followUserDb`, `createWorkoutChallengesDb`, `submitWorkoutChallengeResultDb` | Pop up de conquista |
| Abrir o drawer de insígnias no próprio perfil | `InsigniasDrawer` → `announceBadges` | Pop up de conquista + o drawer recarrega |

Incentivos recebidos e seguidores não têm uma escrita do próprio usuário — chegam pela avaliação de abertura/retorno do app.

`requestBadgeCheck()` (`client/lib/badges.ts`) só **avisa**; o `BadgeCheckHost` avalia com debounce de 1,5 s (uma rajada de incentivos vira uma chamada) e chama `announceBadges(awarded)`. Banco sem a migração (`PGRST202`) não vai para o Sentry.

### Pop up de conquista (`BadgeCelebrationBanner`, redesenhado em 06/10/2026)

Substituiu o toast genérico do shadcn, que jogava tudo numa linha de texto corrido ("🏋️ Primeiro treino · 📸 Primeiro post · …") e ficava ilegível no login de quem ganhava várias de uma vez.

```
┌─ borda em degradê âmbar → roxo, brilho laranja ────────────┐
│ (🏋️)   NOVA INSÍGNIA                (degradê âmbar, 11px) │
│         Primeiro treino              (15px bold)        ›  │
│         Finalizou o primeiro treino no app  (12,5px, 65%)  │
│▔▔▔▔▔▔▔▔▔▔ barra de tempo (6 s)                             │
└────────────────────────────────────────────────────────────┘
Várias:  (🏋️)(📸)+4   6 NOVAS INSÍGNIAS
                       Primeiro treino e mais 5
                       Toque para ver todas
```

- Mesmo lugar e gestos do aviso de mensagem (`IncomingMessageToast`): topo, `max(12px, safe-area-inset-top)`, `z-[9999]`, arrasta para cima para dispensar, some em **6 s** (barra de tempo no rodapé do card). Toque abre o drawer (`/metas`, `state.openBadges`).
- **Não é modal** — pode aparecer sobre qualquer overlay sem travar a tela (o diálogo grande é só do fim de treino, onde Metas controla a vez).
- **Vem sempre DEPOIS do aviso de notificação/mensagem (06/10/2026).** Os dois banners ocupam o mesmo lugar no topo; antes o último a renderizar cobria o outro (ex.: "Fulano começou a seguir você" escondia a insígnia que chegava junto). Agora `IncomingMessageToast` publica quando está na tela (`setSystemBannerVisible`, `client/lib/top-banner-slot.ts`) e o pop up de insígnia: espera na fila enquanto o aviso está visível; se o aviso chega com a insígnia aberta, ela sai e volta depois; entra só 450 ms após o aviso sumir (`TOP_BANNER_HANDOFF_MS`, a saída dele termina antes). Os 6 s só contam com a insígnia na tela — ao voltar ela recomeça o tempo e vibra de novo. Conferido com uma prévia Playwright nas duas ordens de chegada: nunca sobrepostos.
- **Várias de uma vez:** dois medalhões pequenos + chip "+N", título "{primeira} e mais N" (um nome inteiro lê melhor que dois cortados — conferido em 375pt). Conquista que chega com o banner aberto entra nele e reinicia o tempo.
- Entrada em mola, medalhões "pulam" em sequência, um brilho atravessa o card uma vez; `hapticSuccess` ao aparecer. `role="status"` + `aria-live="polite"`.
- Montado sempre (estado normal = sem insígnias): o título só é calculado com pelo menos uma insígnia — com zero, `badges[0]` não existe e quebraria o AppLayout.

### `BadgeMedallion` — a cara da insígnia

Emoji dentro de um disco escuro com aro em degradê âmbar → laranja (`BADGE_ACCENT_GRADIENT`, a cor de conquista do app); bloqueada = aro cinza e emoji apagado. Tamanhos `sm` 36 / `md` 46 / `lg` 104. Usado no pop up, no `BadgeUnlockedDialog` (card escuro com halo laranja, pontinhos de progresso entre várias, botão em degradê) e nas linhas do drawer.

## Onde aparece

- **Card de streak (Metas):** os emojis das 2 insígnias mais recentes + "+N" das que faltam (catálogo visível). Toque abre o drawer.
- **`InsigniasDrawer`** (tokens `GLASS_SHEET_*`): progresso geral ("3 de 41 conquistadas" + barra), insígnias por grupo (Treinos · Conteúdo · Juntos · Comunidade) com a contagem do grupo ("3/11"). Conquistada = cartão laranja, toque escolhe a exibida (`setSelectedBadgeDb`); bloqueada = cadeado e, **no próprio perfil**, barra "3/10" quando o limiar é maior que 1 (vem de `metrics`). Perfil de outra pessoa: só leitura, sem progresso.
- **`UserInsignias`:** o emoji da insígnia exibida ao lado do nome (perfil, post viewer, card do feed, conversa privada), com tooltip e o drawer — **se o dono não a escondeu** (abaixo).

A insígnia **exibida** continua sendo `profiles.selected_badge_id` (escolha persistida; nunca muda sozinha) — ver `docs/08-perfil.md`. Sem escolha, a de maior `sort_order` entre as conquistadas.

## Mostrar ou esconder a insígnia (2026-10-08)

Interruptor **"Mostrar insígnia no perfil"** no topo do `InsigniasDrawer`, logo abaixo do progresso geral, **só no próprio perfil** (mesmo visual de interruptor das Configurações). Pedido de produto: o admin já tem o selo oficial, e selo + insígnia lado a lado poluía o nome; qualquer usuário pode preferir o nome limpo.

- **Padrão: ligado** (`profiles.show_badge default true`, inclusive para contas antigas).
- **Desligado:** o emoji some ao lado do nome **em todo lugar** (perfil, feed, post, conversa — todos passam pelo `UserInsignias`), para todo mundo que vê. Nada mais muda: as insígnias continuam sendo conquistadas, a escolhida continua salva, o pop up de conquista continua, e o card de streak de Metas continua mostrando as recentes (é a tela pessoal).
- No drawer, com a insígnia escondida a escolhida leva o selo **"Escolhida"** em vez de "Ativo", e o rodapé explica que dá para escolher qual mostrar ao religar. Escolher outra insígnia **não** religa a exibição.
- **Onde religar:** com a insígnia escondida o emoji some também do próprio perfil, então a entrada para o drawer é o **card de streak de Metas** (toque nos emojis).
- Otimista: o interruptor muda na hora e volta atrás se a gravação falhar (toast `badges_show_error` + `reportHandledError`); sucesso = toast `badges_show_on_toast`/`badges_show_off_toast`.
- **Banco:** `getBadgeDisplayDb(userId)` → `{ badge, visible }` (a escolhida + `show_badge`), cache `badgeDisplay:{userId}` (a chave mudou de `displayBadge:` porque o formato mudou — um valor antigo salvo no aparelho seria lido errado). `setShowBadgeDb(show)` grava e trata 0 linhas como erro (UPDATE barrado pela RLS não lança). Banco sem a coluna = sempre visível na leitura. Migração `docs/migrations/20261008-profile-show-badge.sql`.

## Componentes e arquivos

| Peça | Arquivo |
|---|---|
| Catálogo visível, grupos, textos traduzidos, `requestBadgeCheck` | `client/lib/badges.ts` |
| Avaliação no servidor | `awardMyBadgesDb` (`client/lib/ritmofit-db.ts`) → RPC `award_my_badges` |
| Avaliação fora de Metas | `BadgeCheckHost` (`client/components/shared/badge-check-host.tsx`) |
| Pop up de conquista | `BadgeCelebrationBanner` (`client/components/shared/badge-celebration-banner.tsx`) — ouve `announceBadges` |
| Medalhão | `BadgeMedallion` (`client/components/shared/badge-medallion.tsx`) |
| Vez no topo (aviso do sistema antes da insígnia) | `client/lib/top-banner-slot.ts` |
| Drawer | `InsigniasDrawer` (`client/components/profile/insignias-drawer.tsx`) |
| Diálogo do fim do treino | `BadgeUnlockedDialog` (`client/components/goals/badge-unlocked-dialog.tsx`) |
| Emoji ao lado do nome | `UserInsignias` (`client/components/profile/user-insignias.tsx`) |
| Chips no card de streak | `StreakBadgesCard` (prop `earnedEmojis`) |

## Adicionar uma insígnia

1. Métrica já existe → só uma linha em `badges` (migração) + as duas chaves de i18n.
2. Métrica nova → nova chave em `_badge_metrics` (SQL), novo valor em `BadgeConditionType` e em `GROUP_OF` (`badges.ts`), e um `requestBadgeCheck()` na escrita que a faz andar.

## i18n

`badges_*` (drawer, inclusive `badges_show_*`, `badges_chosen`, `badges_bottom_hint_hidden`), `badge_banner_*` (pop up), `badge_dialog_*`, `profile_badge_aria` e `badge_<key>_name` / `badge_<key>_desc` para as 41 insígnias.
