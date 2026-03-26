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
- Barra de progresso visual
- Porcentagem de conclusão
- Botão de check-in diário
- Botão para expandir detalhes (rotinas vinculadas)
- Menu de opções: Editar | Excluir

**Check-in Diário:**
- Botão "Fazer check-in hoje"
- Ao clicar, abre dialog de confirmação
- Registra via `createCheckInDb`
- Adiciona pontos ao usuário via `addPointsDb`
- Exibe histórico semanal de check-ins (7 dias)
- Detecta se já fez check-in hoje via `getTodayCheckInDb`

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
- Menu: Editar nome | Excluir rotina

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

---

### Seção: Dietas do Usuário

Lista as refeições/planos alimentares:

Cada dieta exibe:
- Imagem da refeição (`DietImage`)
- Nome e descrição
- Calorias
- Toggle de conclusão diária
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
- Função: `createCustomDietDb`

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
```

---

## Histórico e Progresso

### Histórico de Check-ins
- Calendário visual semanal (últimos 7 dias)
- Cada dia com indicador verde (feito) / cinza (não feito)
- `getWeekCheckInsDb` para carregar

### Histórico de Treinos
- Lista de execuções anteriores por exercício
- Data, séries, repetições e carga de cada sessão
- `getWorkoutHistoryDb` / `getWorkoutHistoriesBatchDb`

### Progresso da Meta
- Barra de progresso de 0 a 100%
- Percentual calculado com base em check-ins

---

## Dados Carregados

| Dado | Função DB |
|---|---|
| Metas programadas | `getProgrammedGoalsDb()` |
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

---

## Observações Técnicas

- Esta é a tela mais extensa do app (~4.854 linhas)
- O catálogo de exercícios é carregado via `fetchExerciseCatalog` (arquivo local + Supabase)
- O catálogo de refeições é carregado via `fetchMealCatalog`
- Rotinas têm tipos específicos (`RoutineTypeCode`) que determinam quais itens podem ser adicionados
- `hasCompletedRoutineToday` verifica se a rotina já foi concluída no dia atual
