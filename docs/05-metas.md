# Tela: Metas

**Rota:** `/metas`
**Arquivo:** `client/pages/Goals.tsx`
**Layout:** AppLayout
**Tamanho:** ~4.854 linhas (tela mais complexa do app)

---

## Objetivo

Central de gestão de saúde e fitness do usuário. Permite criar, acompanhar e gerenciar metas de treino, dietas e hábitos. Também oferece um catálogo de metas pré-programadas e suporte a rotinas completas com check-ins diários.

---

## Estrutura Visual

```
┌──────────────────────────────────┐
│  Tabs: [Rotinas & Metas] [Browse]│
├──────────────────────────────────┤
│  Conteúdo da Tab ativa           │
└──────────────────────────────────┘
```

---

## Tab: Rotinas & Metas

### Seção: Metas Ativas

Lista as metas que o usuário está perseguindo atualmente.

Cada meta exibe:
- Nome e descrição da meta
- Barra de progresso visual com percentual (padrão igual ao feed: label "Progresso" + `X%` + barra `bg-brand`)
- Porcentagem de conclusão calculada via `userGoal.perc`
- Botão de check-in diário
- Botão para expandir detalhes (rotinas vinculadas)
- Menu de opções: Editar | Excluir

**Check-in Diário:**
- Botão "Fazer check-in hoje"
- Ao clicar, abre dialog de confirmação
- Registra via `createCheckInDb`
- Exibe histórico semanal de check-ins (7 dias)
- Detecta se já fez check-in hoje via `getTodayCheckInDb`
- Exibe streak de dias consecutivos **dentro do próprio card de check-in** (frame separado removido)
- **Após cada check-in**, recarrega `checkInHistory` via `getCheckInHistoryDb` e recalcula o streak imediatamente (refresh automático)

**Hábitos/Dietas concluídos:**
- `is_completed` + `completed_at` são salvos juntos ao marcar como concluído
- No carregamento, itens com `is_completed = true` mas `completed_at` de dia anterior têm o campo resetado automaticamente (fire-and-forget)
- Itens concluídos hoje somem da lista de rotinas até o dia seguinte
- Quando todos os itens de uma rotina de dieta/hábito estão concluídos, o dropdown exibe "Todas as tarefas concluídas ✓" em vez de "Nenhum item adicionado"
- O menu de edição das rotinas de dieta e hábito exibe "Mostrar Concluídas" quando há itens concluídos, alternando para "Ocultar Concluídas" quando ativo; state `showCompletedForRoutine: Set<string>` (key do card)

**Modal vincular rotinas:**
- Modo "link": oculta rotinas já vinculadas à meta selecionada
- Rotinas sem nome exibem itens corretamente (filtro por `name IS NULL`)

**Modal resumo do treino:**
- "Compartilhar no Feed" → navega para `/` após postar
- "Compartilhar no Duelo" → navega para `/comunidade` após postar; **botão só aparece se o usuário tiver ao menos 1 grupo de duelo** (grupos carregados ao abrir o modal via `getEnrichedDuelGroupsDb`)
- Grupos de duelo incluem grupos onde o usuário é participante (não só criador)
- **Campo de descrição editável** exibido antes do botão "Compartilhar no Feed"; pré-preenchido com texto padrão (inclui meta vinculada se houver: `🎯 Meta: ...`); state `workoutPostDescription`
- **Meta vinculada**: ao terminar treino de rotina com `goal_id`, o `user_goals.id` é armazenado em `workoutLinkedUserGoalId` e passado como terceiro argumento ao `createPostDb` — o post aparece com a barra de progresso da meta igual ao fluxo do NewPost
- Frame "Como foi o treino?" **removido**
- Frame de PRs exibe mini-row com Duração / Volume / Séries acima da lista de recordes
- Frame de Nutrição Pós-Treino tem **dropdown** (ChevronUp/Down) para ocultar/expandir — sem botão de fechar
- Seleção de foto suporta **múltiplas fotos** (até 4); preview mostra grid 2-colunas quando 2+ fotos; upload usa a primeira foto
- Clicar em data no histórico de treino abre o modal de resumo para aquela sessão

---

### Seção: Rotinas

Lista as rotinas do usuário organizadas por tipo:

| Tipo | Código | Descrição |
|---|---|---|
| Treino | `workout` | Exercícios físicos |
| Dieta | `diet` | Plano alimentar |
| Hábito | `habit` | Hábitos diários |

Cada rotina exibe:
- Nome da rotina
- Tipo (badge colorido)
- Lista de itens (exercícios / refeições / hábitos)
- Status de conclusão diária
- Botão de compartilhar rotina
- **Botão de resumo da rotina** (`BarChart2`): disponível apenas em rotinas de treino (`typeCode === 1`) com exercícios; abre o modal de Resumo do Treino com dados agregados do histórico de cada exercício da rotina (volume, séries, nome dos exercícios)
- Menu: Adicionar itens | Editar rotina (renomear) | Vincular Meta | Excluir rotina

Cada **item** dentro da rotina exibe:
- Ícone de sino (`Bell` / `BellOff`): abre o `ScheduledTimeDrawer` para definir ou remover lembrete diário
  - Sino colorido (brand) = lembrete ativo; sino acinzentado = sem lembrete
  - Ao confirmar, salva `scheduled_time` (formato `HH:MM`) no banco e sincroniza com o Service Worker

**Editar rotina:** Dialog com dois campos:
- **Nome da rotina** — atualiza `routines.name` + `user_workouts.name`/`user_diets.name`/`user_habits.name` via `updateRoutineNameDb`
- **Horário de execução** — input `type="time"` que define um lembrete diário comum a todos os itens da rotina. Salva o mesmo `scheduled_time` (`HH:MM` ou `null`) em todos os `user_workouts`/`user_diets`/`user_habits` daquela rotina via `updateRoutineItemsScheduledTimeDb(userId, typeCode, routineName, scheduledTime)`. Campo é pré-preenchido com o `scheduled_time` do primeiro item da rotina que tiver horário. Quando há horário definido, aparece um botão **Desativar lembrete** (`BellOff`) ao lado do input que limpa o horário (`scheduled_time = null`) — necessário porque o input `type="time"` do WebView iOS não oferece como apagar um valor já preenchido. Ao salvar com horário limpo, `onRenamed` dispara `syncRoutineNotifications()` para cancelar as notificações nativas agendadas.

**Lembrete diário (notificação):** Cada item de rotina pode ter um `scheduled_time` (ex: `07:30`). O `ScheduledTimeDrawer` permite definir ou remover esse horário. Ao salvar:
1. Pede permissão de notificação ao navegador (se ainda não concedida)
2. Persiste `scheduled_time` via `updateRoutineScheduledTimeDb`
3. Sincroniza todos os horários com o Service Worker via `syncAll` do hook `useRoutineNotifications`
4. O SW agenda um `setTimeout` para disparar `showNotification` no horário exato, re-agendando diariamente

**Filtro de grupo muscular / categoria:** Oculto por padrão, expandido ao clicar no ícone de filtro (chevron toggle). Mostra contador de filtros ativos.

---

### Seção: Treinos do Usuário

Lista detalhada dos exercícios do usuário:

Cada exercício exibe:
- Imagem do exercício (`ExerciseImage`)
- Nome
- Grupo muscular
- Séries × Repetições × Carga
- Histórico de execuções anteriores
- Botão para registrar execução (iniciar treino)
- Controles de edição de séries

**Registrar Execução:**
- Dialog/Drawer com cronômetro
- Campos: séries, repetições, carga por série
- Salva histórico via `saveWorkoutHistoryDb`
- Opção de tirar foto do treino (câmera ou galeria)

**Treino minimizado (Floating Button):**
- Se o usuário fechar o drawer de treino com treino em andamento (`workoutStartTime !== null`), o modal é **minimizado** em vez de fechado
- Aparece um botão flutuante (FAB) verde no canto inferior direito da tela em qualquer página
- Clicar no FAB reabre o modal de treino de onde parou
- O cronômetro continua rodando mesmo minimizado (`workoutMinimized` state)

---

### Seção: Hidratação

Card **condicional** — aparece apenas quando o usuário possui uma rotina de hábito com o hábito de id `1` ("beber 2 litros de água por dia"). Verificado via `hasWaterHabit` (userHabits com `habit_id === "1"`).

- Barra de progresso de ml consumidos vs meta diária (padrão: 2000ml)
- Botões de registro rápido: +250ml, +350ml, +500ml
- Botão "-" (desfazer): remove o **último registro** inserido na tabela `hydration_logs` do dia
- Mensagem de meta atingida ao completar 2000ml
- Ao atingir a meta pela primeira vez, tenta conceder o badge `hidratacao_7dias` via `awardNutritionBadgesDb`

Dados: `getTodayHydrationDb` / `addHydrationDb` / `undoLastHydrationDb` (tabela `hydration_logs`)

---

### Seção: Macro do Dia

Card condicional (aparece quando há ao menos 1 dieta concluída com dados de macro), logo abaixo da seção de hidratação:
- Total de calorias, proteína (g), carboidrato (g) e gordura (g) acumulados pelas dietas marcadas hoje
- Score de qualidade: chips coloridos mostrando quantas refeições são in natura / processadas / ultraprocessadas
- Mensagem positiva quando nenhum ultraprocessado foi registrado
- Atualizado automaticamente ao marcar/desmarcar dietas

Dados: `getTodayMacroSummaryDb` (agrega `user_diets` com `is_completed = true` e `completed_at` de hoje)

---

### Seção: Dietas do Usuário

Lista as refeições/planos alimentares:

Cada dieta exibe:
- Imagem da refeição (`DietImage`)
- Nome e descrição
- Macro inline: chips coloridos com Proteína (g), Carboidrato (g), Gordura (g) quando disponíveis
- Badge de qualidade: "Natural" (verde) para `in_natura`, "Ultra" (laranja) para `ultraprocessado`
- Toggle de conclusão diária
- Ao marcar como concluída: atualiza macro do dia, verifica badges nutricionais, exibe aviso contextual para ultraprocessados
- Histórico de adesão

---

### Seção: Hábitos do Usuário

Lista os hábitos diários:

Cada hábito exibe:
- Ícone e nome
- Frequência alvo
- Toggle de conclusão diária
- Streak (dias consecutivos)

---

### Modal: Humor do Dia

Modal exibido automaticamente após o usuário concluir **todas as Dietas** OU **todos os Hábitos** da rotina do dia.

**Trigger:** ao marcar o último item de dieta ou hábito pendente, a função `checkAndShowMoodModal` compara os IDs concluídos com o total de itens e abre o modal caso:
- o humor do dia ainda não tenha sido registrado (`todayMood === null`)
- o modal não tenha sido exibido na sessão atual (`moodModalShownRef.current === false`)

**Conteúdo:**
- Título: "Como você está se sentindo? 😊"
- Subtítulo: "Você completou suas rotinas hoje! Registre seu humor do dia."
- 5 botões com emoji + label:
  - 😢 Muito triste (`muito_triste`)
  - 😕 Triste (`triste`)
  - 😐 Neutro (`neutro`)
  - 😊 Feliz (`feliz`)
  - 😄 Muito feliz (`muito_feliz`)
- Botão "Agora não" para fechar sem registrar

**Ao selecionar um humor:**
- Chama `saveTodayMoodDb(userId, mood)` — faz upsert em `mood_logs`
- Atualiza estado local `todayMood`
- Fecha o modal
- Exibe toast de confirmação

**Estado persistido:** o humor do dia é carregado ao inicializar a tela via `getTodayMoodDb`. Se já registrado, o modal não será exibido novamente na sessão.

Dados: `getTodayMoodDb`, `saveTodayMoodDb` — tabela `mood_logs`

---

### Card: Humor do Dia + Histórico

Card permanente exibido na aba **Rotinas & Metas**, logo após o card de Macro do Dia.

**Conteúdo:**
- Emoji + label do humor registrado hoje (ou "Nenhum registro hoje" se ainda não registrado)
- Botão/link "Ver histórico →" que abre o `MoodHistoryDrawer`

**MoodHistoryDrawer** — `client/components/goals/mood-history-drawer.tsx`

Drawer que sobe do bottom com histórico dos últimos 30 dias:
- **Mini-calendário semanal (7 dias):** grade de 7 colunas mostrando o emoji de cada dia; dia atual com destaque (`ring-brand`); dias sem registro exibem `·`
- **Resumo do período:** humor predominante (moda) + média numérica (1–5) dos últimos 30 dias
- **Lista cronológica:** cada entrada com emoji, label colorido, data formatada e barra de score visual (5 barrinhas preenchidas proporcionalmente)
- **Editar humor:** cada registro tem um botão com ícone de lápis (`Pencil`); ao tocar, um seletor inline com os 5 humores é exibido abaixo da linha; selecionar um novo humor chama `saveMoodForDateDb` e atualiza o estado local; se for o dia de hoje, sincroniza `todayMood` na tela via `onMoodUpdated`
- **Empty state:** ícone 🌱 + mensagem orientando o usuário
- **Skeleton loader** durante carregamento

Dados: `getMoodHistoryDb(userId, 30)`, `saveMoodForDateDb(userId, mood, date)` — tabela `mood_logs`

Componente: `MoodHistoryDrawer` em `client/components/goals/mood-history-drawer.tsx`

---

## Metas Disponíveis (catálogo)

Exibe apenas metas com `created_by_user = 0` (metas padrão do sistema). Metas criadas por usuários (`created_by_user = 1`) ficam visíveis somente para quem as criou via `getUserGoalsDb`.

**Campo de busca:** Input de texto dentro do accordion "Metas Disponíveis" que filtra as metas em tempo real pelo campo `description`. Exibe mensagem de empty state quando nenhuma meta corresponde ao termo buscado. State local: `availableGoalSearch` em `GoalsTab`.

---

## Tab: Browse (Descobrir Metas)

Catálogo de metas pré-programadas disponíveis na plataforma.

### Filtros
- Busca por texto
- Filtro por categoria/tipo

### Cards de Meta Programada

Cada meta no catálogo exibe:
- Ícone e nome
- Descrição
- Duração estimada
- Nível de dificuldade
- Botão "Selecionar esta meta"

**Ao selecionar uma meta:**
1. A meta é adicionada às metas ativas do usuário
2. Uma rotina padrão é criada automaticamente
3. Os exercícios/dietas/hábitos padrão são adicionados

---

## Criação de Conteúdo Customizado

### Criar Meta Customizada (`CreateGoalDrawer`)
- Drawer com campos redesenhados para melhor UX:
  - **Objetivo** (textarea) — placeholder inspirador com contador de caracteres
  - **Categoria** — 3 botões com emoji + label: 💪 Fitness / 🏥 Saúde / ✨ Hábitos
  - **Duração** — chips de preset (30 / 60 / 90 dias) + opção "Personalizado" com input
  - **Frequência** — stepper (− / número / +) com descrição em linguagem humana ("todos os dias" / "a cada N dias")
- Função: `createCustomGoalAndSelectDb`

**Empty state da aba Metas (GoalsTab):**
- Quando o usuário não tem metas ativas nem concluídas, exibe um guia de onboarding focado:
  - Eyebrow chip "Primeiro passo" em `text-brand`
  - Título grande "Defina sua primeira meta" (`goals_onboarding_title`)
  - Subtítulo curto (`goals_onboarding_desc`)
  - 2 cards stacked full-width, cada um com badge gradiente próprio, título, descrição e `ChevronRight`:
    - 📚 **Escolher do catálogo** — scroll suave até o accordion "Metas Disponíveis" (badge azul)
    - ✏️ **Criar minha meta** — abre o drawer de criação (`onCreateGoalDrawerOpen`, badge esmeralda)
  - Footer hint: "Você pode ter várias metas ativas ao mesmo tempo."
- O accordion "Metas Disponíveis" tem `id="goals-available-anchor"` para receber o scroll do card "Escolher do catálogo"
- O accordion abre automaticamente neste estado (já existente)
- O botão duplicado "Crie sua própria meta" no rodapé é ocultado durante o onboarding (já existe o card acima)

**Empty state da aba Rotinas (RoutinesTab):**
- Quando o usuário não tem nenhuma rotina, o card de Check-in Diário é ocultado para dar foco ao onboarding (não há rotina para concluir, então o check-in seria inútil)
- Exibe um guia visual de criação da primeira rotina:
  - Ícone ✨ destacado em badge `bg-brand/10`
  - Título: "Vamos criar sua primeira rotina" (`goals_no_routines_guide_title`)
  - Subtítulo: "Escolha o tipo de rotina para começar" (`goals_no_routines_guide_subtitle`)
- 3 opções em cards stacked (full-width, um por linha), cada um com cor própria, emoji grande, título, descrição e `ChevronRight`:
  - 🏋️ Treino — `bg-orange-500/10 border-orange-500/30`
  - 🥗 Dieta — `bg-green-500/10 border-green-500/30`
  - ✨ Hábito — `bg-purple-500/10 border-purple-500/30`
- Cada card chama `onAddRoutineWithType(typeCode)` que abre o fluxo de criação da rotina

### Criar Treino Customizado
- Busca no catálogo de exercícios
- Filtro por grupo muscular (peito, costas, pernas, ombros, braços, abdômen, cardio)
- Seleção múltipla de exercícios
- Configuração de séries/repetições para cada exercício
- Função: `createCustomWorkoutDb`

### Criar Dieta Customizada
- Busca no catálogo de refeições
- Seleção de refeições
- Configuração de porções/horários
- **Etapa de horário:** após selecionar os itens, aparece um drawer opcional para definir data/hora de execução (`execute_at`); o usuário pode pular
- Função: `createCustomDietDb` / `createUserDietsDb` (aceita `execute_at`)

---

## Fluxo de Adição à Rotina

```
Usuário quer adicionar exercício
  └─ Clica "Adicionar à rotina"
       └─ Busca catálogo de exercícios (fetchExerciseCatalog)
            └─ Filtra por grupo muscular
                 └─ Seleciona exercício
                      └─ Configura séries/reps
                           └─ Salva via createUserWorkoutsDb

Usuário quer adicionar dieta ou hábito
  └─ Clica "Adicionar à rotina" → seleciona tipo Dieta ou Hábito
       └─ Seleciona itens do catálogo
            └─ Clica "Próximo"
                 └─ Drawer de horário (execute_at — opcional)
                      └─ "Salvar" (com horário) ou "Pular" (sem horário)
                           └─ [Se usuário tem metas ativas E é rotina nova]
                                Drawer "Vincular a uma meta?" (LinkGoalStepDrawer)
                                  └─ Selecionar meta + "Vincular e concluir"
                                       OU "Pular e concluir"
                                            └─ Salva via createUserDietsDb / createUserHabitsDb
                                                 └─ Se goal escolhido, updateRoutineGoalDb na rotina criada
```

### Etapa final: vincular meta (LinkGoalStepDrawer)

Após o drawer de horário (`ExecuteAtDrawer`), na criação de **qualquer** tipo de rotina nova (Treino/Dieta/Hábito), aparece o drawer `LinkGoalStepDrawer` permitindo vincular a rotina recém-criada a uma meta ativa.

**Condições para aparecer:**
- `userGoals.filter(g => g.perc < 100).length > 0` — usuário tem ao menos uma meta ativa
- `addToRoutineCardId === null` — não está adicionando itens a uma rotina já existente
- `!isAddingFromWorkout` — não está vindo do fluxo de adicionar do modal de treino

Se qualquer condição falhar, o step é pulado e a rotina é salva direto.

**UX:**
- Eyebrow "Última etapa"
- Título "Vincular a uma meta?" + subtítulo
- Lista de metas ativas com badge colorido por tipo (`fitness`/`health`/`habits`), progress bar e check de seleção
- Botão dinâmico: "Vincular e concluir" se selecionou uma meta, "Pular e concluir" se nenhuma selecionada
- Footer: "Você pode vincular ou trocar a meta depois."

**Persistência:**
- Após `createUserWorkoutsDb`/`createUserDietsDb`/`createUserHabitsDb`, o refresh recarrega `routines`
- A rotina mais recente correspondente (`type === selectedRoutineType && name === routineName`) é localizada
- `updateRoutineGoalDb(routine.id, goalId)` é chamado para gravar `routines.goal_id`
- Mais um refresh para refletir o vínculo na UI

---

## Histórico e Progresso

### Histórico de Check-ins
- Calendário visual semanal (últimos 7 dias)
- Cada dia com indicador verde (feito) / cinza (não feito)
- `getWeekCheckInsDb` para carregar

### Histórico de Treinos
- Lista de execuções anteriores por exercício, agrupada por dia
- Data, séries, repetições e carga de cada sessão
- `getWorkoutHistoryDb` / `getWorkoutHistoriesBatchDb`
- Stats resumidos: Recorde (PR), 1RM estimado (fórmula de Epley), total de sessões
- **Gráfico de progressão de carga** (Recharts LineChart): um ponto por dia com carga máxima, linha de referência no PR, exibido quando há ≥ 2 dias com dados
- **Clicar na data** de uma sessão abre o modal de Resumo do Treino reconstruído com os dados daquele dia (permite postar, ver PRs, etc.)

### Sugestão de Carga no Treino
- Exibida no modal de treino, antes da tabela de séries de cada exercício (exceto cardio)
- Mostra a melhor carga da última sessão e sugere +2.5 kg
- Exemplo: "Última sessão: 80 kg — tente 82.5 kg hoje"

### Compartilhar PR
- Botão "Compartilhar" no bloco de Novos Recordes no resumo de treino pós-sessão
- Cria post no feed com texto formatado listando os PRs batidos
- Usa `createPostDb` sem foto (texto puro com emojis)

### Timing Nutricional Pós-Treino
- Card exibido ao final da tela de Resumo do Treino
- Aparece automaticamente ao concluir qualquer treino (`setShowPostWorkoutNutrition(true)`)
- Mostra recomendações contextuais: proteína (20–40g), carboidrato (30–60g), hidratação (500ml+), timing (janela de 2h)
- Pode ser fechado individualmente pelo usuário
- `showPostWorkoutNutrition` state: boolean, resetado ao fechar o resumo

### GPS — Corrida Externa

Card exclusivo exibido no modal de treino quando o exercício ativo é **Corrida Externa** (`workout_id = '451eea08-8a29-4c8c-b7b3-5ce93bcca08f'`).

- Botão "Iniciar GPS" / "Parar GPS" para controlar o rastreamento
- Enquanto ativo: exibe distância (em **metros** até 1 km, depois em **km** com 2 decimais), pace (min/km) e tempo decorrido em tempo real
- A distância é calculada via plugin nativo `@capacitor-community/background-geolocation` (iOS) com fórmula Haversine
- Ruídos de GPS menores que 2 m são ignorados automaticamente
- **Auto-preenche o campo de distância** à medida que a corrida avança
- O contador de tempo continua correto mesmo com a tela bloqueada — é calculado a partir do timestamp inicial e ressincronizado em cada callback de localização vinda do plugin nativo (que continua disparando em background)
- Ao clicar em **"Parar GPS"**, um diálogo pergunta se o treino deve ser marcado como concluído. Se "Sim", a primeira série (`Marcar como concluído`) é marcada automaticamente
- Estado parado automaticamente ao fechar o modal de treino
- Permissão iOS: `NSLocationWhenInUseUsageDescription` + `NSLocationAlwaysAndWhenInUseUsageDescription` (declaradas no `Info.plist`)

Estados GPS: `gpsActive`, `gpsDistance`, `gpsPace`, `gpsElapsedSecs`
Refs: `gpsWatchIdRef`, `gpsLastPosRef`, `gpsStartTimeRef`, `gpsElapsedIntervalRef`

### Progresso da Meta
- Barra de progresso de 0 a 100%
- Percentual calculado com base em check-ins

---

## Dados Carregados

| Dado | Função DB |
|---|---|
| Metas programadas (apenas padrão) | `getProgrammedGoalsDb()` — filtra `created_by_user = 0` |
| Metas do usuário | `getUserGoalsDb()` |
| IDs de metas selecionadas | `getUserSelectedGoalIdsDb()` |
| Treinos disponíveis | `getWorkoutsDb()` |
| Dietas disponíveis | `getDietsDb()` |
| Hábitos disponíveis | `getHabitsDb()` |
| Treinos do usuário | `getUserWorkoutsDb()` |
| Dietas do usuário | `getUserDietsDb()` |
| Hábitos do usuário | `getUserHabitsDb()` |
| Rotinas do usuário | `getUserRoutinesDb()` |
| Check-in hoje | `getTodayCheckInDb()` |
| Check-ins da semana | `getWeekCheckInsDb()` |
| Histórico de check-ins | `getCheckInHistoryDb()` |
| Histórico de treinos | `getWorkoutHistoriesBatchDb()` |
| Hidratação do dia | `getTodayHydrationDb()` — soma de `hydration_logs` de hoje |
| Macro acumulado do dia | `getTodayMacroSummaryDb()` — agrega dietas concluídas hoje |
| Humor do dia | `getTodayMoodDb()` — registro único de `mood_logs` para hoje |
| Horários de lembretes | `getRoutineSchedulesDb(userId)` — retorna todos os itens com `scheduled_time` não nulo |

---

## Componentes Utilizados

| Dado | Função DB |
|---|---|
| Renomear rotina (routines + items) | `updateRoutineNameDb(userId, oldName, typeCode, newName)` |
| Definir horário de execução da rotina (bulk) | `updateRoutineItemsScheduledTimeDb(userId, typeCode, routineName, scheduledTime)` — aplica o mesmo `scheduled_time` a todos os itens da rotina |
| Salvar horário de lembrete | `updateRoutineScheduledTimeDb(type, id, scheduledTime)` — atualiza `scheduled_time` em `user_workouts`/`user_diets`/`user_habits` |
| Toggle conclusão dieta (com timestamp) | `toggleUserDietCompletionDb(id, isCompleted)` — salva `completed_at` |
| Toggle conclusão hábito (com timestamp) | `toggleUserHabitCompletionDb(id, isCompleted)` — salva `completed_at` |
| Grupos de duelo (criados + participante) | `getEnrichedDuelGroupsDb(userId)` — `myGroups` inclui grupos onde usuário é participante |

---

## Componentes Utilizados

| Componente | Propósito |
|---|---|
| `ExerciseImage` | Card visual de exercício do catálogo |
| `DietImage` | Card visual de refeição do catálogo |
| `Accordion` | Seções expansíveis de rotina |
| `Dialog` | Modais de criação/edição |
| `Drawer` | Painel deslizante de detalhes |
| `Progress` | Barra de progresso |
| `Select` | Seletor de tipo de meta/rotina |
| `ScheduledTimeDrawer` | Drawer para definir/remover horário de lembrete diário de um item de rotina |

---

## Observações Técnicas

- Esta é a tela mais extensa do app (~4.854 linhas)
- O catálogo de exercícios é carregado via `fetchExerciseCatalog` (arquivo local + Supabase)
- O catálogo de refeições é carregado via `fetchMealCatalog`
- Rotinas têm tipos específicos (`RoutineTypeCode`) que determinam quais itens podem ser adicionados
- `hasCompletedRoutineToday` verifica se a rotina já foi concluída no dia atual
