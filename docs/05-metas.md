# 05 — Metas (`/metas`)

> Tela de gestão de **metas e rotinas** (treinos, dietas e hábitos), com foco em rotinas de exercícios. Reconstruída em 09/06/2026 (v2); em 11/06/2026 virou **dashboard single-scroll (v3)** a partir do handoff do Claude Design ("Metas e Rotinas - Esboços", opção 3).

## Estrutura visual (v3 — dashboard)

```
┌─────────────────────────────────┐
│      ◜◝ anel de streak ◜◝       │ ← hero sticky: recolhe ao scroll
│      🔥 12  DIAS SEGUIDOS       │
│      S T Q Q S S D (pontinhos)  │
│ ╭─ banner TREINO DE HOJE ─────╮ │
│ │ [foto]            [HOJE]    │ │
│ │ Push — Empurrar             │ │
│ │ 7 exercícios · grupos       │ │
│ │ [▶ Iniciar treino]          │ │
│ ╰─────────────────────────────╯ │
│ ✓ Ontem · Pull — Puxar    Ver   │
│ [🥗 Dieta ▓▓░] [✅ Hábito ▓░░]  │ ← grade 2 col c/ progresso
│ Metas         Ver todas │
│ 🎯 meta [Compartilhar] ▓▓▓ 60%  │
│ Minhas rotinas                  │
│ filtros: Todas·Treino·Dieta·Háb │
│ cards de rotina       ( + ) FAB │
└─────────────────────────────────┘
```

1. **Anel de streak recolhível** (`streak-ring-hero.tsx`) — hero sticky no topo: anel SVG de 7 segmentos (semana seg→dom: feito=laranja, perdido=vermelho/40, hoje=azul `primary`, futuro=neutro), 🔥 + streak no centro e fileira de letras/pontinhos dos dias. Ao rolar (window scroll + rAF + smoothstep, só transform/opacity), o anel **encolhe e ancora à esquerda** num cabeçalho compacto com blur: "Sequência de N dias · X de 7 check-ins esta semana". Estados da semana calculados por `computeWeekCheckins` (em `goals-helpers.ts`) a partir de `check_ins`.
2. **Dashboard de hoje** (`today-dashboard.tsx`):
   - **Banner do treino de hoje** — card com foto do exercício (`workoutPhoto`, fallback gradiente brand), badge `HOJE` (ou `Concluído` em verde se já executado hoje), nome, "N exercícios · grupos musculares · horário". Se a rotina tiver uma meta vinculada, exibe uma linha compacta `🎯 {descrição} · XX%` com mini barra de progresso diretamente no banner. CTA **Iniciar treino / Retomar**. **Mostra apenas o treino agendado para o dia da semana atual** — os demais treinos não aparecem aqui (ficam acessíveis em "Minhas rotinas"). A escolha do treino de hoje usa `buildRoutineWeekdayMap` (em `suggested-routines-data.ts`): casa o nome da rotina com o catálogo de programas para descobrir os dias de cada treino (ex.: Push = seg/qui). Se o usuário segue um programa mas hoje é dia de descanso, exibe um **card de descanso** (ícone lua + "Dia de descanso"). Se nenhuma rotina casa com um programa (todas custom), faz fallback para o treino mais "devido".
   - **Treino de hoje concluído** — quando o treino de hoje já foi executado (`cardLastDate === hoje`, atualizado pelo `loadData` após finalizar), o banner é **substituído** por um card de sucesso emerald (✓ + "Treino de hoje concluído!" + nome da rotina + mensagem motivacional). O card é tocável e abre o detalhe da rotina.
   - **Linha "Ontem"** — se um treino foi executado ontem (via `routineLastDates`): "✓ Ontem · {nome} · Ver" (abre o detalhe).
   - Cards de dieta/hábito foram removidos do dashboard para manter o foco em treinos.
   - Sem rotina de treino cadastrada → componente retorna null (RoutinesTab exibe empty state).
3. **Metas** (`life-goals-section.tsx`) — seção com header "Metas" + **Ver todas/Mostrar menos** (recolhida mostra as 3 primeiras ativas; expandida revela todas + "Concluídas"). Cards com 🎯/🏆, descrição, dias, pill **Compartilhar** (pré-seleciona a meta no NewPost via `sessionStorage newpost_goal_id` e navega para `/postar`), menu "Marcar progresso (+1)"/"Excluir meta" e barra de progresso + %. **Tocar no card** abre o `GoalDetailDrawer` com detalhes completos.
4. **Minhas rotinas** (`routines-tab.tsx`) — seção de gestão no fim da página: exibe apenas rotinas de **treino** (type === 1); chips de filtro por tipo foram removidos. Cards com nome, nº de exercícios, última execução, chips de lembrete e meta vinculada. Empty state oferece "Sugeridas para você" e "Criar Rotina". Rotinas de dieta/hábito persistem no banco mas não aparecem nesta seção.
5. **Criação contextual** — sem FAB (removido por sobrepor os CTAs "Iniciar" das rotinas): pill **"+ Nova"** no header de "Minhas rotinas" (abre o wizard em "O que criar?") e botão circular **"+"** no header de "Metas" (abre o wizard na origem da meta). Empty states mantêm seus próprios CTAs.

> As tabs Rotinas/Metas foram removidas; links `/metas?tab=metas|rotinas` continuam funcionando (a página rola até a seção correspondente).

## Fluxo de criação (wizard)

`create-wizard-drawer.tsx` — bottom sheet em etapas com navegação de volta. A criação de rotina agora é **somente treino** (o seletor de tipo Treino/Dieta/Hábito foi removido):

```
(+) → O que criar? ──► Rotina (treino) ──► Origem: ✨Sugerido | ✏️Do zero
       │                  ✨Sugerido ──► Nível (Iniciante/Inter/Avançado, com descrição)
       │                                  └► Programa da semana (preview)
       │                                      └► Vincular a meta? (última etapa)
       │                  ✏️Do zero ──► Montagem
       │
       │   Programa da semana: card do programa (nome, nº treinos, dias/semana,
       │   tira seg→dom com pontinhos nos dias de treino) + lista dos treinos
       │   distintos (cada um expansível mostra exercícios×séries e em quais dias
       │   da semana aparece) → "Adicionar programa" leva à etapa "Vincular a
       │   meta?" · atalho "Criar do zero".
       │
       │   Vincular a meta? (última etapa): "Não vincular" (default) + lista de
       │   metas ativas (seleção única). Confirmar em "Adicionar programa" cria
       │   TODAS as rotinas de uma vez e vincula cada uma à meta escolhida (se
       │   houver). Sem metas ativas → mostra aviso e só o botão de criar.
       │
       │   Montagem: nome → exercícios (busca + filtro de grupo muscular +
       │   criar exercício custom inline) → horário (lembrete) → vincular a meta
       │   (opcional) → Salvar
       └────────────► Meta ──► Origem: catálogo (goals created_by_user=0) |
                                personalizada (descrição, categoria, duração)
```

- **Programa semanal sugerido**: catálogo client-side em `suggested-routines-data.ts` — **um `WeeklyProgram` por nível** (Iniciante = Corpo Inteiro 3x; Intermediário = ABC; Avançado = Push/Pull/Legs 6x). Cada programa tem `workouts` (treinos distintos a criar) e `week` (7 posições seg→dom apontando para a `key` de um treino ou `null` = descanso). Ao adicionar, **cria uma rotina por treino distinto** de uma só vez (`handleAddWeeklyProgram`). Exercícios são casados com o catálogo `workouts` por nome; quando ausentes, são criados via `createCustomWorkoutDb` (reaproveitados entre os dias do mesmo programa). A tela continua surfando "o treino de hoje" pela heurística do mais devido, que naturalmente rotaciona pelos treinos do programa.
- Rotina criada = inserts em `user_workouts` com `name`; trigger do banco cria a linha em `routines`; `backfillRoutineIdOnItemsDb` preenche `routine_id`; vínculo de meta via `updateRoutineGoalDb`. (Inserts em `user_diets`/`user_habits` permanecem no código mas não há caminho de UI para criá-los nesta iteração.)

## Modo treino

`workout-session-dialog.tsx` — overlay full-screen controlado pelo `workout-context`:

- Timer de duração persistente (sobrevive a lock/background e reload via localStorage)
- Por exercício: presets de descanso (30/60/90/120s), tabela de séries (kg × reps, cardio = km × min), adicionar/remover série, check por série dispara o timer de descanso global
- Cards numerados com header (nº + nome + grupo muscular) para distinção visual entre exercícios; barra **"Ver séries / Fechar séries"** sempre visível abaixo da imagem (com contagem e chevron animado)
- Botão **ⓘ** (top-left da imagem, glassmorphism) abre overlay dark com foto grande + nome + grupo muscular; clicar fora fecha
- **Trava no check da série**: só é possível concluir uma série com os dados preenchidos — força exige kg **e** reps; cardio exige minutos **ou** km. Sem isso o check fica esmaecido/desabilitado e exibe toast de aviso. Ao tentar concluir sem dados, os campos faltantes ganham **borda + fundo vermelhos** (`hsl(var(--destructive))`) e placeholder `!`, limpando-se automaticamente quando preenchidos
- **Modal de descanso** ao concluir uma série: contador regressivo em destaque (anel de progresso) com **Pausar/Retomar** (`globalRestTimerPaused` no `workout-context`), **Minimizar** (minimiza o treino e navega o app durante o descanso; clicar fora do modal/no backdrop tem o mesmo efeito de Minimizar), **Pular** e fechar no X (mantém o timer ativo na barra fina inferior). Modal reabre a cada nova série concluída (via `globalRestTimerKey`)
- Séries pré-preenchidas com a última sessão (`getLastWorkoutSessionSeriesDb`); na **primeira execução** (sem histórico) de uma rotina criada por um programa, o app pré-preenche a **quantidade de séries e as reps sugeridas** pelo programa via `getSuggestedSetsForRoutine` (casa rotina+exercício pelo nome no catálogo de `suggested-routines-data.ts`; reps só entram quando é contagem pura, ex.: "12" — "30s"/"20min" ficam 0). O histórico real sempre tem prioridade sobre a sugestão.
- **Minimizar** → barra flutuante global do `app-layout.tsx` (contrato `workoutMinimized`/`pendingReopen` mantido); o timer de descanso continua correndo e é exibido na barra
- **Finalizar** (com confirmação) → grava `user_workouts_hist` por série concluída → check-in automático (`createCheckInDb`) → badges (`awardBadgesForCheckInsDb`, toast) → +1 progresso na meta vinculada à rotina (`incrementGoalProgressDb`) → `GoalCompletedDialog` ao atingir 100% → toast resumo (séries/volume/duração)

## Detalhe de rotina

`routine-detail-drawer.tsx` — drawer com: lista de itens (foto/check de conclusão para dieta/hábito, remover item), editores inline de **Renomear** / **Lembrete** (horário com permissão de notificação) / **Meta** (vincular/desvincular), botão Iniciar (treino) e Excluir rotina (com confirmação; remove itens + histórico + linha em `routines`).

Concluir todos os itens de uma rotina de dieta/hábito no dia → check-in automático + progresso na meta vinculada.

## Dados carregados

| Dado | Função (`ritmofit-db.ts`) |
|---|---|
| Rotinas | `getUserRoutinesDb` |
| Itens treino/dieta/hábito | `getUserWorkoutsDb` / `getUserDietsDb` / `getUserHabitsDb` |
| Metas do usuário | `getUserGoalsDb` |
| Metas programadas (catálogo) | `getProgrammedGoalsDb` + `getUserSelectedGoalIdsDb` |
| Catálogos de itens | `getWorkoutsDb` / `getDietsDb` / `getHabitsDb` |
| Streak + semana do anel | `getCheckInHistoryDb(60)` → `computeStreak` / `computeWeekCheckins` |
| Última execução por rotina | `getRoutineLastDatesBatchDb` |
| Última sessão (prefill séries) | `getLastWorkoutSessionSeriesDb` |

Mutations: `createUserWorkoutsDb/createUserDietsDb/createUserHabitsDb`, `backfillRoutineIdOnItemsDb`, `updateRoutineItemsScheduledTimeDb`, `updateRoutineGoalDb`, `updateRoutineNameDb`, `deleteRoutineCardDb` (nova), `deleteRoutineItemDb` (nova), `toggleUserDietCompletionDb/toggleUserHabitCompletionDb`, `saveDietHistoryDb/saveHabitHistoryDb`, `saveWorkoutHistoryDb`, `createCheckInDb`, `awardBadgesForCheckInsDb`, `incrementGoalProgressDb`, `createUserGoalDb`, `createCustomGoalAndSelectDb`, `deleteUserGoalDb`, `createCustomWorkoutDb/createCustomDietDb/createCustomHabitDb`.

## Componentes

| Componente | Arquivo |
|---|---|
| Página (orquestrador) | `client/pages/Goals.tsx` |
| Anel de streak recolhível | `client/components/goals/streak-ring-hero.tsx` |
| Dashboard de hoje (banner do treino de hoje/ontem/descanso) | `client/components/goals/today-dashboard.tsx` |
| Seção Metas | `client/components/goals/life-goals-section.tsx` |
| Seção Minhas rotinas | `client/components/goals/routines-tab.tsx` |
| Wizard de criação | `client/components/goals/create-wizard-drawer.tsx` |
| Detalhe de rotina | `client/components/goals/routine-detail-drawer.tsx` |
| Modo treino | `client/components/goals/workout-session-dialog.tsx` |
| Helpers (cards, streak, concluído hoje) | `client/components/goals/goals-helpers.ts` |
| Catálogo de sugestões por nível | `client/components/goals/suggested-routines-data.ts` |
| Drawer de detalhe da meta | `client/components/goals/goal-detail-drawer.tsx` |
| Celebração de meta | `client/components/shared/goal-completed-dialog.tsx` (compartilhado com o feed) |
| Notificações de rotina | `client/hooks/use-routine-notifications.ts` |
| Estado do treino ativo | `client/lib/workout-context.tsx` (+ barra no `app-layout.tsx`) |

## i18n

Chaves reaproveitadas da v1 (`goals_*`) + novas com sub-prefixos `goals_today_*`, `goals_session_*`, `goals_wizard_*`, `goals_suggest_*`, `goals_level_*`, `goals_program_*` (programa semanal), `goals_detail_*` e (v3) `goals_dash_*` — todas em PT e EN.

## Removido na v2 (existia na v1, pode voltar depois)

GPS/corrida ao ar livre, compartilhar treino como post/duelo, celebração de PR, hidratação, macro do dia, humor (mood), resumo semanal de check-ins, drawer de histórico por exercício, "copiar rotina de alguém" dentro do wizard (continua existindo na tela Buscar).
