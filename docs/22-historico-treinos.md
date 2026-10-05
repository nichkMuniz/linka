# 22 — Histórico de treinos (`/metas/historico`)

> Criado em 05/10/2026. Lista **todos os treinos finalizados** pelo usuário — de rotina, treino rápido, treinar junto e desafio — com filtro por tipo e o detalhe de cada sessão. **Sem migração**: tudo sai de tabelas que já existem.

## Como se chega aqui

Botão só com ícone (`History`, relógio) no canto superior direito do **card de streak** em Metas (`StreakBadgesCard`, prop `onOpenHistory`), ao lado do chevron. Ver `docs/05-metas.md` → card de streak. Não há outra entrada.

## Estrutura visual

```
┌─────────────────────────────────┐
│ (←)  Histórico de treinos       │
│ ╭ Este mês ───────────────────╮ │ ← só com treino no mês corrente
│ │ 3 treinos · 38 séries · 13.696 kg de volume │
│ ╰─────────────────────────────╯ │
│ [Todos][Rotinas][Rápidos][Em conjunto][Desafios] ← chips, rolagem horizontal
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

## Detalhe da sessão (`WorkoutHistoryDetail`)

Abre no lugar da lista com `?s=<key>` na URL (push), então o botão e o gesto de voltar fecham o detalhe; a posição de rolagem da lista é restaurada. Link com `s` de uma sessão que não está carregada cai na lista (`replace`).

- Cabeçalho: voltar + rótulo do tipo colorido, título (24px), data/hora e, no treino em conjunto, "com Fulano, Ciclano".
- Card de números: séries · kg de volume (se > 0) · kcal (se registrada).
- **Desafio:** um card por desafio ligado à sessão — avatar e "Desafio de/para Fulano"; concluído = `ChallengeComparison` (veredito + placar por exercício) e, se fui eu quem desafiou, botão **"Compartilhar no feed"** (`shareChallengeResultToFeed`, a mesma função do `ChallengeResultDialog`; depois vai ao Feed na aba Seguindo); pendente/recusado/expirado = frase, sem números (a RLS não entrega os do adversário antes).
- **Em conjunto:** "Quem treinou" — `getWorkoutPartyMembersDb(partyId)`, eu primeiro como "Você", com séries · volume e melhor carga de cada um. Sem as colunas live-stats, só os nomes.
- **Exercícios:** um por linha, com o nº de séries contadas e as séries ("80×8 · 80×8 · 75×7"); cardio mostra km e tempo (`sumCardioSets`).

## Dados (`getWorkoutHistoryPageDb(before?)` em `ritmofit-db.ts`)

| Fonte | Para quê |
|---|---|
| `user_workouts_hist` (do usuário, desc, 1.500 linhas por página) | As sessões: séries agrupadas por "Finalizar" (todas gravadas a ms umas das outras; intervalo > 60s = outra sessão) |
| `workouts` / `user_custom_workouts` (`fetchWorkoutDetailsByIds`) | Nome, grupo muscular, se é cardio |
| `routines` | Nome da rotina |
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
| Página (lista, filtros, paginação) | `client/pages/WorkoutHistory.tsx` |
| Detalhe + peças compartilhadas (`HISTORY_KIND_STYLE`, `formatHistoryDate`, `challengeBadge`, `challengeSubtitle`) | `client/components/goals/workout-history-detail.tsx` |
| Placar do desafio | `ChallengeComparison` (`workout-challenge.tsx`) |
| Publicar resultado do desafio | `shareChallengeResultToFeed` (`workout-challenge.tsx`) |
| Botão de entrada | `StreakBadgesCard` (`streak-badges-card.tsx`) |

## i18n

Chaves `goals_history_*` em `i18n.ts` e `i18n-en.ts`; reaproveita `goals_back`, `goals_challenge_you`, `goals_challenge_share_cta`/`_sharing`/`_shared_toast`/`_share_error`, `goals_quick_name_and`, `goals_quick_workout_title` e `retry`.
