# 22 — Histórico de treinos (`/metas/historico`)

> Criado em 05/10/2026. Desde o mesmo dia dá para **apagar um treino ou o histórico inteiro** (ver "Apagar treinos"; migração `20261005-workout-history-delete.sql`). Lista **todos os treinos finalizados** pelo usuário — de rotina, treino rápido, treinar junto e desafio — com filtro por tipo e o detalhe de cada sessão. A **leitura** não tem migração: tudo sai de tabelas que já existem.

## Como se chega aqui

Botão só com ícone (`History`, relógio) no canto superior direito do **card de streak** em Metas (`StreakBadgesCard`, prop `onOpenHistory`), ao lado do chevron. Ver `docs/05-metas.md` → card de streak. Não há outra entrada.

## Estrutura visual

```
┌─────────────────────────────────┐
│ (←)  Histórico de treinos       │
│ ╭ Este mês           (‹)  (›) ╮ │ ← navega entre meses
│ │ 3 treinos · 38 séries · 13.696 kg de volume │
│ ╰─────────────────────────────╯ │
│ [Todos][Rotinas][Rápidos][Em conjunto][Desafios] ← chips, rolagem horizontal
│ Desafios pendentes              │ ← só com desafio recebido em aberto
│ (◉⚔) Desafio · Hoje, 07:10      │
│      Peito e Tríceps  [Aceitar] │
│      de Camila · 6 exercícios · expira em 6 dias
│ Esta semana / Semana passada / Setembro de 2026
│ [⚔] Desafio · Ontem, 08:21      │
│     Peito e Tríceps   [Venceu 2×1]
│     de Camila · 17 séries       │
│ [👥] Em conjunto · qua., 30 set │
│     Pernas completo      (◉◉)   │ ← avatares de quem treinou junto
│ [⚡] Treino rápido · …        › │
│ [🏋] Rotina · …               › │
│ [Ver treinos mais antigos]      │ ← só se há próxima página
└─────────────────────────────────┘
```

- **Tela cheia dentro do `AppLayout`** (header flutuante e bottom nav continuam), com `ScreenAura variant="goals"` e botão voltar (`navigate(-1)`).
- **Cores por tipo** (`HISTORY_KIND_STYLE`): rotina azul `#93b4ff` (`Dumbbell`), rápido laranja `#ffab66` (`Zap`), em conjunto roxo `#c2a6ff` (`Users`), desafio rosa `#ff8ea1` (`Swords`) — ícone num quadrado de 44px com fundo tingido. O rótulo do tipo vai na linha de cima, com a data.
- **Linha de baixo:** exercícios · séries. No desafio, o adversário entra no lugar dos exercícios ("de Camila" / "para Rafa" / "para Rafa +2") — na linha de cima um nome longo empurrava a data para fora.
- **Lado direito:** desafio = selo do resultado do MEU ponto de vista (`Venceu 2 × 1` verde, `Perdeu` vermelho, `Empate` âmbar, `Aguardando` tracejado, `Recusado`/`Expirou` neutros; vários desafiados = "N desafiados"); em conjunto = até 3 avatares; demais = chevron.
- **Agrupamento:** "Esta semana" e "Semana passada" (semana começa na segunda, dia local); antes disso, por mês ("Setembro de 2026").
- **Estados:** esqueleto (`SkeletonLoader`) na 1ª carga; vazio com ícone + "Nenhum treino ainda"; filtro sem resultado com uma frase; erro = toast `goals_history_load_error` + `reportHandledError`.
- Chips de "Rápidos", "Em conjunto" e "Desafios" só aparecem com as flags `quickWorkout`, `workoutParty` e `workoutChallenge`.

## Resumo por mês (2026-10-08)

O card do topo mostra **treinos · séries · kg de volume** de um mês e tem setas **‹ ›** para navegar (`MonthStatsCard`, em `WorkoutHistory.tsx`). Antes só existia "Este mês", e só aparecia com treino no mês corrente; agora aparece sempre que há histórico (mês sem treino = zeros).

- **Rótulo:** "Este mês" no mês corrente; nos demais, "Setembro de 2026". A seta › para no mês atual; a ‹ para no mês da **1ª série** do usuário (`getWorkoutHistoryFirstDateDb`; sem essa leitura, usa a sessão mais antiga carregada e libera enquanto houver página por carregar).
- **De onde vêm os números:** se a lista já carregada cobre o mês inteiro (não há mais páginas, ou a sessão mais antiga carregada é anterior ao mês), soma as sessões da tela — mesmos números da lista. Senão, `getWorkoutHistoryMonthStatsDb(dia 1 do mês)` lê só as séries daquele mês (limites em dia LOCAL convertidos para UTC, paginado de 1.000 em 1.000) e aplica as mesmas regras: sessão = rajada de séries (`groupHistRowsIntoSessions`, compartilhado com a lista), drop não conta como série, volume = kg × reps só de musculação. Enquanto carrega, os números viram barras pulsando; erro = toast `goals_history_load_error` + `reportHandledError`.
- **Cache:** meses lidos do banco ficam em `monthStatsCache` (memória do módulo); zera ao apagar um treino/o histórico e ao reler a tela (`useAppRefreshTick`).
- O mês escolhido fica na página (`statsMonth`): abrir um treino e voltar mantém o mês.
- Uma sessão que atravessa a meia-noite da virada do mês pode ser contada nos dois meses pela leitura do banco — raro, aceito.

## Desafios pendentes (2026-10-08)

Seção **"Desafios pendentes"** logo abaixo dos chips (filtro "Todos" ou "Desafios"; sem treino nenhum, aparece acima do estado vazio). Lista os desafios que **me mandaram** e que ainda não fiz — `pending` ou `accepted` (aceitei e larguei a sessão) e não expirados — para quem não quis aceitar na hora do push não perder o convite.

- **Linha:** avatar de quem desafiou com um selo rosa de espadas (`Swords`), "Desafio · <quando recebi>", nome do treino e "de Fulano · N exercícios · expira em N dias/Nh" (`expires_at`, 7 dias). Fundo e borda rosados para destacar da lista de treinos feitos.
- **Lado direito:** botão-pílula rosa **"Aceitar"** (`pending`) ou **"Treinar"** (`accepted`).
- **Toque:** vai para `/metas?challenge=<id>` — abre o **mesmo `ChallengeInviteDialog` do push** (aceitar abre a sessão do desafio; recusar; "mais tarde"; com outro treino em andamento o diálogo não deixa aceitar). Aceitar/recusar mora em Metas porque é lá que a sessão de treino é montada. Voltar retorna ao histórico.
- **Dados:** `getPendingWorkoutChallengesDb()` (o mesmo da faixa de desafios de Metas; até 10, mais recentes primeiro; erro = lista vazia, a seção some). Cache do módulo (`lastPending`) e releitura no `useAppRefreshTick`. Só com a flag `workoutChallenge`.
- Quando o desafio é feito, ele sai daqui e a sessão aparece na lista normal como "Desafio" com o placar.

## Apagar treinos (2026-10-05)

Duas ações, as duas com `AlertDialog` de confirmação (botão vermelho, spinner enquanto apaga, o diálogo só fecha depois de apagar) e toast de sucesso/erro:

- **Apagar este treino** — lixeira (`Trash2`, vermelho-claro) no canto direito do cabeçalho do **detalhe** da sessão. Apaga as séries da sessão (`session.rowIds`), tira a sessão da lista e volta para ela (`navigate(-1)`, fecha o `?s=`).
- **Apagar histórico** — menu ⋮ no cabeçalho da **lista** (só aparece com treinos), item vermelho. Apaga **todas** as séries do usuário, inclusive as páginas ainda não carregadas; a tela cai no estado vazio e o filtro volta para "Todos".

O que sai junto (avisado no texto do diálogo): tudo o que é **derivado** do histórico — recordes, coluna ANTERIOR, evolução/progressão dos exercícios, cobertura muscular, "concluída nesta semana" e "último treino" dos cards de rotina. O que **fica**: rotinas, metas, posts publicados (o `workout_summary` é uma cópia), desafios e treinos em conjunto, o `routines.last_summary` do mini frame e o **streak** (vem de `check_ins`, não do histórico).

**Banco:** `deleteWorkoutHistoryDb(rowIds | null)` (`ritmofit-db.ts`) chama a RPC `delete_my_workout_history(p_ids uuid[])` — SECURITY DEFINER, só linhas do próprio usuário, `null` = tudo, devolve quantas saíram (migração `docs/migrations/20261005-workout-history-delete.sql`). RPC porque um DELETE barrado pela RLS volta 0 linhas sem erro, e a policy de DELETE de `user_workouts_hist` (`20260716-hist-delete-rls.sql`) pode não estar aplicada. Sem a função no banco (`PGRST202`) cai no DELETE direto com `count: "exact"`. Nos dois caminhos, **0 linhas apagadas vira erro** (`goals_history_delete_error`) — a tela só oferece apagar o que mostrou. Depois limpa os caches derivados (`invalidateHistDerivedCaches`) e o cache da 1ª página (`lastFirstPage`).

## Detalhe da sessão (`WorkoutHistoryDetail`)

Abre no lugar da lista com `?s=<key>` na URL (push), então o botão e o gesto de voltar fecham o detalhe; a posição de rolagem da lista é restaurada. Link com `s` de uma sessão que não está carregada cai na lista (`replace`).

- Cabeçalho: voltar + rótulo do tipo colorido, título (24px), data/hora e, no treino em conjunto, "com Fulano, Ciclano".
- Card de números: séries · kg de volume (se > 0) · kcal (se registrada).
- **"Resumo do treino" (2026-10-06):** botão em gradiente azul→roxo (`Share2`, `goals_history_summary_cta`) logo abaixo do card de números, em toda sessão com exercícios. Abre o **mesmo `WorkoutSummaryOverlay` do Finalizar** — cards/templates, fotos, legenda, marcação, "Compartilhar no Feed" e "no Flow" (o flow abre no Feed com `createFlowSeed`, igual a Metas; o post vai com `refreshFeed`). Os dados vêm de `buildHistorySummaryData(session, userId)` (`workout-history-detail.tsx`):
  - Se a sessão é o **último treino da rotina** (`routines.last_summary.completedAt` a até 10 min da última série), usa esse snapshot: resumo completo, com duração, recordes, máquina zerada e corrida GPS. O `partyId` vem da party casada pelo histórico ou, se o casamento falhar, do próprio snapshot (`last_summary.partyId`, gravado desde 06/10/2026).
  - Senão, monta só com o que o histórico guarda: exercícios/séries, volume, kcal, título, `partyId` (card "Treino em conjunto" e marcação automática de quem treinou junto). **Sem duração** — o overlay esconde a duração quando `durationSecs` é 0 (legenda, chip da tela, painel do card, tile do template "Números" e o número grande do "Evolução") — e sem recordes/máquina zerada, que não ficam gravados.
  - **Sem duelos** (`userGroups: []`): o check-in de duelo contaria um treino antigo como de hoje. `userGoalId` vai nulo (o post não amarra a barra da meta).
  - O overlay é `React.lazy`; `openSummary` espera o chunk e os dados antes de montar (spinner no botão). Falha = toast `goals_history_summary_error` + `reportHandledError`. Voltar do detalhe ou abrir outra sessão descarta o resumo.
- **Desafio:** um card por desafio ligado à sessão — avatar e "Desafio de/para Fulano"; concluído = `ChallengeComparison` (veredito + placar por exercício) e, se fui eu quem desafiou, botão **"Compartilhar no feed"** (`shareChallengeResultToFeed`, a mesma função do `ChallengeResultDialog`; depois vai ao Feed na aba Seguindo); pendente/recusado/expirado = frase, sem números (a RLS não entrega os do adversário antes).
- **Em conjunto:** "Quem treinou" — `getWorkoutPartyMembersDb(partyId)`, eu primeiro como "Você", com séries · volume e melhor carga de cada um. Sem as colunas live-stats, só os nomes.
- **Exercícios (`HistoryExerciseCard`, redesenhado em 2026-10-05):** um card por exercício.
  - **Cabeçalho:** miniatura do catálogo (`ExerciseThumb` de `workout-detail-dialog.tsx`, 52px — ilustração sobre fundo branco com `object-contain`, porque as do wger são linhas escuras; sem foto → gradiente + emoji do grupo), nome, "grupo · N séries" e, à direita, a **melhor carga** (`bestKg`) ou, no cardio, km + tempo da sessão (`sumCardioSets`). A foto vem de `fetchWorkoutDetailsByIds` resolvida com `resolveWorkoutPhotoUrl` (`WorkoutHistoryExercise.photo`).
  - **Séries, uma por linha:** círculo com o número da série, carga e repetições em destaque ("**80** kg × **8** reps"; sem carga, só as reps) e, quando não é a válida comum, um selo do tipo — Aquecimento (âmbar, o círculo mostra "A"/"W" em vez do número), Falha (vermelho) e Drop (roxo). Numeração igual à da tela de treino: o drop **não** ganha número, aparece recuado com "↳" sob a série de cima. Cardio: "30min · 5,2 km" por série (minutos via `cardioMinutesFromInput`).
  - Antes era uma linha cinza única ("80×8 · 80×8 · 75×7") ao lado de um quadradinho "3×".

## Dados (`getWorkoutHistoryPageDb(before?)` em `ritmofit-db.ts`)

| Fonte | Para quê |
|---|---|
| `user_workouts_hist` (do usuário, desc, 1.500 linhas por página) | As sessões: séries agrupadas por "Finalizar" (todas gravadas a ms umas das outras; intervalo > 60s = outra sessão) |
| `workouts` / `user_custom_workouts` (`fetchWorkoutDetailsByIds`) | Nome, grupo muscular, se é cardio |
| `routines` | Nome da rotina |
| `workout_challenges` (recebidos, `pending`/`accepted`, não expirados — `getPendingWorkoutChallengesDb`) | Seção "Desafios pendentes" |
| `workout_challenge_results` (meus) + `workout_challenges` | Desafio: o resultado que gravei casa com a sessão mais recente terminada até ele (janela de 3h — quem desafia grava ao enviar, no resumo) |
| `workout_parties` + `workout_party_members` + `profiles` | Em conjunto: meu `finished_at` (±15 min) casa com a sessão; sem ele, a janela da party |

**Tipo da sessão:** desafio > em conjunto > rotina (tem `routine_id`) > rápido. Treino rápido **salvo como rotina** ganha `routine_id` e passa a aparecer como rotina.

**Título:** desafio = nome do treino do desafio; demais = nome da rotina; sem rotina = os 2 grupos musculares com mais séries ("Ombros e Abdômen", mesma regra do nome sugerido no resumo) ou "Treino rápido".

**Paginação:** página cheia descarta a sessão mais antiga (pode ter sido cortada pelo `limit`) e devolve `nextBefore` = início da sessão mais antiga que ficou; "Ver treinos mais antigos" busca a próxima.

**Fuso:** `date_completed` é `timestamp` **sem fuso**, gravado em UTC; o PostgREST devolve sem "Z". `parseHistTimestampMs` trata string sem designador como UTC — `new Date()` puro leria como hora local (3h de erro no Brasil).

**Duração não aparece:** o histórico não guarda o início da sessão (as séries são gravadas todas no "Finalizar"), por isso o mock com "48 min" ficou sem esse número.

**Cache:** a 1ª página fica em memória do módulo (`lastFirstPage`): voltar para a tela pinta na hora e relê por baixo. `useAppRefreshTick` relê ao voltar ao app.

## Componentes

| Componente | Arquivo |
|---|---|
| Página (lista, filtros, paginação, resumo por mês — `MonthStatsCard`, desafios pendentes — `PendingChallengeRow`) | `client/pages/WorkoutHistory.tsx` |
| Convite do desafio (aceitar/recusar), aberto via `/metas?challenge=` | `ChallengeInviteDialog` (`workout-challenge.tsx`, montado em `Goals.tsx`) |
| Miniatura do exercício (compartilhada com o "Ver treino" do feed) | `ExerciseThumb` (`client/components/shared/workout-detail-dialog.tsx`, prop `size`) |
| Detalhe + peças compartilhadas (`HISTORY_KIND_STYLE`, `formatHistoryDate`, `challengeBadge`, `challengeSubtitle`) | `client/components/goals/workout-history-detail.tsx` |
| Placar do desafio | `ChallengeComparison` (`workout-challenge.tsx`) |
| Publicar resultado do desafio | `shareChallengeResultToFeed` (`workout-challenge.tsx`) |
| Botão de entrada | `StreakBadgesCard` (`streak-badges-card.tsx`) |
| Resumo do treino (compartilhar no feed/flow) | `WorkoutSummaryOverlay` (`workout-summary-overlay.tsx`, lazy) + `buildHistorySummaryData` |

## i18n

Chaves `goals_history_*` em `i18n.ts` e `i18n-en.ts`; reaproveita `goals_back`, `goals_challenge_you`, `goals_challenge_share_cta`/`_sharing`/`_shared_toast`/`_share_error`, `goals_quick_name_and`, `goals_quick_workout_title` e `retry`.
