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
- Menu: Adicionar itens | Editar rotina (renomear) | Vincular Meta | Excluir rotina

Cada **item** dentro da rotina exibe:
- Ícone de sino (`Bell` / `BellOff`): abre o `ScheduledTimeDrawer` para definir ou remover lembrete diário
  - Sino colorido (brand) = lembrete ativo; sino acinzentado = sem lembrete
  - Ao confirmar, salva `scheduled_time` (formato `HH:MM`) no banco e sincroniza com o Service Worker

**Editar rotina:** Dialog para renomear. Atualiza `routines.name`, `user_workouts.name`, `user_diets.name` ou `user_habits.name` via `updateRoutineNameDb`.

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

## Metas Disponíveis (catálogo)

Exibe apenas metas com `created_by_user = 0` (metas padrão do sistema). Metas criadas por usuários (`created_by_user = 1`) ficam visíveis somente para quem as criou via `getUserGoalsDb`.

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

### Criar Meta Customizada
- Dialog com campos:
  - Nome da meta
  - Descrição
  - Tipo (treino / dieta / hábito)
  - Data objetivo
- Função: `createCustomGoalAndSelectDb`

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
                           └─ Salva via createUserDietsDb / createUserHabitsDb
```

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
