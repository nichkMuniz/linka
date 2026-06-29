# 05 — Metas (`/metas`)

> Tela de gestão de **metas e rotinas** (treinos, dietas e hábitos). Reconstruída em 09/06/2026 (v2); dashboard single-scroll (v3) em 11/06/2026. Em 28/06/2026 a página foi **reconstruída no padrão glass "Hub do Hoje" (v4)**, fiel ao protótipo do Claude Design ("LinKa Glass" → Direção A). O `Goals.tsx` é apenas o **orquestrador** (carrega dados e compõe os componentes da feature, que já estavam prontos no estilo glass); o app-layout desenha o header glass global, então a página só renderiza conteúdo abaixo dele, sobre auras radiais borradas (laranja/azul).

## Estrutura visual (v4 — glass "Hub do Hoje")

```
┌─────────────────────────────────┐
│ 🔥 12  12 dias seguidos    🏅⚡ ›│ ← card de streak (abre badges)
│      Recorde: 18 dias           │
│ EM FOCO · TREINO DE HOJE        │
│ ╭─ banner TREINO DE HOJE ─────╮ │
│ │ [foto]            [HOJE]    │ │
│ │ Push — Empurrar             │ │
│ │ [▶ Iniciar treino]          │ │
│ ╰─────────────────────────────╯ │
│ ✓ Ontem · Pull — Puxar    Ver   │
│ Suas rotinas                    │
│ [💪 Exercícios FOCO ◴ 60%]      │ ← 3 cards de tipo c/ anel
│ [🥗 Dieta          ◴ 75%]      │
│ [✅ Hábitos        ◴ 40%]      │
│ Metas              opcional · Ver todas │
│ 🎯 meta ▓▓▓ 60% · + Criar meta  │
└─────────────────────────────────┘
```

1. **Card de streak + badges** (`streak-badges-card.tsx`) — card glass com anel `conic-gradient` (preenchimento = check-ins da semana), 🔥 + streak no centro, título "{n} dias seguidos", "Recorde: {n} dias" e mini-fileira de badges. Tocar abre o `InsigniasDrawer` (grade de conquistas). Streak/recorde/semana calculados por `computeStreak`/`computeWeekCheckins` + `computeRecordStreak` (local) a partir de `getCheckInHistoryDb(60)`. _(O `streak-ring-hero.tsx` — anel recolhível da v3 — continua no repositório, mas não é usado pela página atual.)_
2. **Hub do hoje / carrossel de tarefas** (`today-dashboard.tsx`) — apresenta **o que o usuário precisa fazer hoje** considerando os três tipos (treino, dieta e hábitos), não só treino. A regra de "agendado para hoje" usa o `scheduledDays` da rotina (índices seg→dom de `scheduled_days`, vazio = **todo dia**, sempre aparece); para **treino** sem dias explícitos, cai no calendário do programa via `buildRoutineWeekdayMap` (`suggested-routines-data.ts`, ex.: Push = seg/qui). Assim, se hoje é segunda, aparecem as rotinas de exercício/dieta/hábito da segunda; se o usuário não selecionou nenhum dia em suas rotinas, todas aparecem.
   - **Carrossel** — as tarefas de hoje são montadas **sempre na ordem treino → dieta → hábitos**. Com **1 tarefa**, mostra o banner único; com **2+**, vira um **carrossel auto-rotativo** (troca a cada `AUTO_ADVANCE_MS` = 5s, com `setTimeout` reiniciado a cada slide) + **fileira de dots** tocáveis (tocar troca o slide e reinicia o timer). O design de cada slide é o mesmo banner glass.
   - **Banner da tarefa** — card com foto (`workoutPhoto`/`dietPhoto`, hábito usa gradiente brand), badge `HOJE` (ou `Concluído` em verde se feito hoje), nome e subtítulo: treino = "N exercícios · grupos musculares · horário"; dieta/hábito = "{feitos} de {total} itens · horário". Meta vinculada exibe a pill `🎯 {descrição} · XX%`. CTA **Iniciar treino / Retomar** (treino) ou **Abrir rotina** (dieta/hábito).
   - **Tarefa concluída hoje** — treino feito hoje (`cardLastDate === hoje`) ou dieta/hábito com todos os itens concluídos hoje → o banner é **substituído** por um card de sucesso emerald (✓ + título por tipo: "Treino/Dieta/Hábitos de hoje concluído(s)!" + nome + mensagem motivacional). Tocável, abre o detalhe.
   - **Dia de descanso** — se o usuário segue um calendário de treino e hoje não há treino agendado **e não há nenhuma outra tarefa**, exibe o card de descanso (ícone lua).
   - **Linha "Ontem"** — se um treino foi executado ontem (via `routineLastDates`): "✓ Ontem · {nome} · Ver" (abre o detalhe).
   - Sem nenhuma rotina cadastrada (treino/dieta/hábito) → o componente retorna null (a seção some).
3. **Suas rotinas** (`routine-type-cards.tsx`) — fileira de **3 cards de tipo** (Exercícios/Dieta/Hábitos) com ícone gradiente, subtítulo e **anel `conic-gradient`**. O anel usa **um modelo único**: `rotinas concluídas ÷ total de rotinas do tipo` (`isRoutineCompleted` em `goals-helpers.ts`). Uma rotina conta como concluída quando: **treino** = executada em algum dia **desta semana** (seg→dom); **dieta/hábito** = todos os itens concluídos **hoje**. Ex.: 4 rotinas de treino, 2 feitas na semana → 50%. Subtítulos: treino "{done} de {total} treinos na semana"; dieta/hábito "{done} de {total} concluídas hoje". Exercícios mantém o badge **FOCO**. O header tem **somente o título** (a pill "+ Nova" foi removida — a criação de rotina é feita tocando num card de tipo). **Tocar num card** depende de já existir rotina daquele tipo:
   - **Já existe rotina(s) do tipo** → abre o `RoutineListDrawer` (lista das rotinas daquele tipo via `RoutinesTab` filtrado + botão **"+"** no cabeçalho). Cada card mostra um anel **binário (0% ou 100%)** = rotina concluída ou não (mesmo `isRoutineCompleted`) e uma fileira de **chips**: 📅 **dias de execução** (sempre presente — `goals_weekday_*` separados por `·`, ou `Todo dia`/`Every day` quando a rotina não tem dias selecionados), 🔔 horário do lembrete (se houver) e 🎯 meta vinculada (se houver). Os dias vêm do `scheduledDays` da rotina; para **treino** sem dias explícitos, caem no calendário do programa sugerido (`buildRoutineWeekdayMap`), igual à heurística do "Hub do hoje". Tocar numa rotina abre o `RoutineDetailDrawer`; em treino, "Iniciar" começa a sessão; **"+"** abre o wizard de criação daquele tipo.
   - **Não existe nenhuma** → abre direto o wizard: **Exercícios** em `routine-origin` (✨ **Sugerido pelo app** por nível ou ✏️ **Do zero**); **Dieta/Hábitos** em `build-name` (montagem → lista de comidas/hábitos).

   Reintroduz Dieta/Hábitos no resumo (a v3 era só treino).
4. **Metas** (`life-goals-section.tsx`) — seção com header "Metas" + pill `opcional` + **Ver todas/Mostrar menos** (recolhida mostra as 3 primeiras ativas; expandida revela todas + "Concluídas"). Cards glass com 🎯/🏆, descrição, dias e barra de progresso + %. **Tocar no card** abre o `GoalDetailDrawer`. CTA **"+ Criar nova meta"** no padrão **glass** (translúcido com tom roxo `rgba(157,107,255,.1)`, borda `rgba(157,107,255,.24)`, `backdrop-blur` e realce interno) abre o wizard **direto no passo `goal-origin`** — escolher do catálogo ✨ ou criar do zero ✏️ —, sem oferecer a criação de rotina. Empty state com onboarding usa o mesmo CTA, porém com **gradiente glass azul→roxo** (`linear-gradient(135deg,#5b8cff,#9d6bff)` semitranslúcido + borda branca sutil + sombra/realce) como ação primária.

> O `routines-tab.tsx` (v3) voltou a ser usado — agora dentro do `RoutineListDrawer` (genérico por tipo via `filterType`). O anel recolhível (`streak-ring-hero.tsx`) da v3 continua no repositório, mas **não é usado** pela página glass atual. Sem FAB: a criação de **rotina** é feita tocando num card de tipo em "Suas rotinas" (e pelo "+" no `RoutineListDrawer` quando já há rotinas do tipo); a de **meta** pelo CTA "+ Criar nova meta" (Metas), que abre direto no fluxo de meta.

## Fluxo de criação (wizard)

`create-wizard-drawer.tsx` — bottom sheet em etapas com navegação de volta. A criação de rotina agora é **somente treino** (o seletor de tipo Treino/Dieta/Hábito foi removido). O passo genérico **"O que criar?" (`what`) não é mais usado como entrada** na tela de Metas: a criação de rotina entra direto em `routine-origin`/`build-name` (tocando num card de tipo) e a de meta entra direto em `goal-origin` (CTA "+ Criar nova meta"). O passo `what` permanece no componente, mas só seria atingido por um `initialStep="what"` explícito.

```
("O que criar?" — não mais usado como entrada na tela de Metas)
(card tipo) ──► Rotina (treino) ──► Origem: ✨Sugerido | ✏️Do zero
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
       │   Montagem (3 etapas, vale p/ Treino/Dieta/Hábito):
       │     1. build-name      → nome da rotina (opcional) → Continuar
       │     2. build           → itens (cards grandes c/ foto). Alterna entre
       │                          "Lista" (tudo) e "Músculo"/"Categoria"
       │                          (escolhe grupo → itens do grupo). Busca +
       │                          custom inline. O botão Continuar é um
       │                          **rodapé fixo** que surge ao 1º item marcado
       │     3. build-schedule  → horário + dias da semana (chips Seg–Dom) +
       │                          vincular a meta (opcional) → Salvar
       └────────────► Meta ──► Origem: catálogo (goals created_by_user=0) |
                                personalizada (descrição, categoria, duração)
```

- **Montagem em 3 etapas** (`create-wizard-drawer.tsx`): ao abrir pelos cards de tipo (ou "Do zero"), a criação passa por `build-name` → `build` → `build-schedule`. Cada etapa tem botão **Continuar**; a última tem **Salvar**. Na etapa `build`, os itens vêm em **cards grandes com foto** (`ExerciseImage`/`DietImage`) e há uma alternância **Lista** (todos os itens) × **Músculo**/**Categoria** (lista os grupos → ao escolher um, mostra só os itens daquele grupo, com voltar). O antigo filtro em chips foi removido. **Tocar na imagem** de um exercício/dieta abre o `ItemDetailDrawer` (imagem ampliada + "Como executar"/"Como preparar" a partir de `description`); o resto do card alterna a seleção. A etapa de execução define `scheduled_time` **e `scheduled_days`** (índices seg→dom 0–6, vazio = todos os dias) via `updateRoutineItemsScheduledTimeDb`/`updateRoutineItemsScheduledDaysDb`. Os lembretes (`use-routine-notifications.ts`) passam a agendar **uma notificação repetível por dia escolhido** (`schedule.on.weekday`) quando há dias; sem dias, mantém o lembrete diário. Coluna `scheduled_days text` adicionada às tabelas `user_workouts`/`user_diets`/`user_habits` (migração `20260628-routine-scheduled-days.sql`).
- **Programa semanal sugerido**: catálogo client-side em `suggested-routines-data.ts` — **um `WeeklyProgram` por nível** (Iniciante = Corpo Inteiro 3x; Intermediário = ABC; Avançado = Push/Pull/Legs 6x). Cada programa tem `workouts` (treinos distintos a criar) e `week` (7 posições seg→dom apontando para a `key` de um treino ou `null` = descanso). Ao adicionar, **cria uma rotina por treino distinto** de uma só vez (`handleAddWeeklyProgram`). Exercícios são casados com o catálogo `workouts` por nome; quando ausentes, são criados via `createCustomWorkoutDb` (reaproveitados entre os dias do mesmo programa). A tela continua surfando "o treino de hoje" pela heurística do mais devido, que naturalmente rotaciona pelos treinos do programa.
- Rotina criada = inserts em `user_workouts` (ou `user_diets`/`user_habits`) com `name`; trigger do banco cria a linha em `routines`; `backfillRoutineIdOnItemsDb` preenche `routine_id`; vínculo de meta via `updateRoutineGoalDb`.

## Modo treino

`workout-session-dialog.tsx` — overlay full-screen controlado pelo `workout-context`:

- **Visual "liquid glass" (29/06/2026)**: o overlay foi repaginado no padrão glass do app — shell escuro em gradiente (`GLASS_ROOT_BG`) com três **auras radiais borradas** (laranja/azul/roxo) ao fundo; cards de exercício translúcidos (`rgba(255,255,255,.06)`) com `backdrop-filter: blur(24px) saturate(180%)`, borda branca sutil e realce interno; barras flutuantes (timer de descanso e rodapé "Adicionar exercício") em vidro com blur; modais (descanso e confirmar finalização) e dropdown do menu (⋯) como painéis de vidro escuro com blur; CTA primário do descanso e botão de adicionar exercício no estilo glass (gradiente azul→roxo / pílula translúcida). Os tokens de cor (`FG`/`MUTED_FG`/`BORDER`/`CARD`/`SURFACE`) viraram tons brancos translúcidos sobre o shell escuro. A linha de série também é **translúcida** (`rgba(255,255,255,.04)`); o botão de apagar do swipe fica com `opacity:0` no estado normal e só aparece ao deslizar, então nada vaza por trás do vidro.
- Timer de duração persistente (sobrevive a lock/background e reload via localStorage)
- Por exercício: presets de descanso (30/60/90/120s), tabela de séries (kg × reps, cardio = km × min), adicionar/remover série, check por série dispara o timer de descanso global
- Cards numerados com header (nº + nome + grupo muscular) para distinção visual entre exercícios; barra **"Ver séries / Fechar séries"** sempre visível abaixo da imagem (com contagem e chevron animado)
- **Imagem do exercício sobre fundo branco** quando há foto (mesmo motivo do overlay de info: ilustrações em linha escura somem sobre superfície escura); sem foto, mantém o placeholder com listras + ícone de halter
- **Check da série em destaque**: não concluída usa preenchimento `muted` + anel de 2px — **azul** (`primary`) quando pronta para marcar, **cinza** (`muted-foreground`, opacidade reduzida) quando travada; concluída fica preenchida de azul com o tique. Antes o anel usava `border` (quase invisível sobre o card)
- Botão **ⓘ** (top-left da imagem, glassmorphism) abre overlay dark rolável com foto grande (sobre fundo branco para que ilustrações em linha escura fiquem visíveis) + nome + grupo muscular + **descrição/"Como executar"** (`workoutDescription`, com fallback "Nenhuma descrição disponível…" quando vazia); clicar fora fecha
- **Trava no check da série**: só é possível concluir uma série com os dados preenchidos — força exige kg **e** reps; cardio exige minutos **ou** km. Sem isso o check fica esmaecido/desabilitado e exibe um **banner de aviso in-dialog** (mesmo mecanismo do aviso de PR — variante `warn` ⚠️ vermelha; ver abaixo, **não** um toast global, que ficaria atrás do overlay). Ao tentar concluir sem dados, os campos faltantes ganham **borda + fundo vermelhos** (`hsl(var(--destructive))`) e placeholder `!`, limpando-se automaticamente quando preenchidos
- **Modal de descanso** ao concluir uma série: contador regressivo em destaque (anel de progresso) com **Pausar/Retomar** (`globalRestTimerPaused` no `workout-context`), **Minimizar** (minimiza o treino e navega o app durante o descanso; clicar fora do modal/no backdrop tem o mesmo efeito de Minimizar), **Pular** e fechar no X (mantém o timer ativo na barra fina inferior). Modal reabre a cada nova série concluída (via `globalRestTimerKey`)
- **Pré-preenchimento das séries** (`getLastWorkoutSessionSeriesDb`, na abertura):
  - **Primeira execução** (sem histórico): **kg vazio** e coluna **"ANTERIOR" vazia** ("—"). Se a rotina veio de um programa, o app ainda pré-preenche a **quantidade de séries e as reps sugeridas** via `getSuggestedSetsForRoutine` (casa rotina+exercício pelo nome no catálogo de `suggested-routines-data.ts`; reps só entram quando é contagem pura, ex.: "12" — "30s"/"20min" ficam 0).
  - **Execuções seguintes** (com histórico): a coluna **"ANTERIOR"** vem populada (`prevKg`×`prevReps`) e os campos **kg e reps replicam** os valores da última sessão. O histórico real sempre tem prioridade sobre a sugestão do programa.
- **Contagem de séries fixa pela última execução**: a próxima sessão tem **exatamente** o mesmo número de séries da execução anterior — nunca a soma de execuções passadas. Cada "Finalizar" grava as séries em rajada com `date_completed` = base + índice em ms (parâmetro `dateCompleted` em `saveWorkoutHistoryDb`), mantendo a ordem das séries; a leitura (`getLastWorkoutSessionSeriesDb`) isola só a sessão mais recente por uma janela curta (`SESSION_WINDOW_MS`, 2s) e ordena por `date_completed`. Antes, uma janela de 2h misturava finalizações próximas e inflava a contagem.
- **Aviso de PR em tempo real**: ao concluir uma série de **força** com um peso acima do melhor peso **anterior** daquele exercício, exibe um banner 🏆 (`goals_pr_toast_title`/`goals_pr_toast_desc`, auto-some em ~3,8s, tocável para fechar). O baseline vem do próprio campo **ANTERIOR** (o maior `prevKg` carregado da última sessão — o mesmo valor exibido na coluna), guardado/elevado em `prevBestRef` (`workout_id → melhor kg`): o aviso só sai quando havia anterior (`> 0`) e o recorde corrente é elevado ao maior peso já concluído na sessão para não repetir em séries iguais/menores. Cardio é ignorado. _(O PR "all-time" do **Resumo do treino** continua usando `getPreviousBestKgDb` na finalização.)_ **Importante:** o aviso é renderizado **dentro do overlay** (`position:absolute`, topo) e não via toast global — o overlay é `position:fixed z-9999` portado ao `body`, então um toast Radix (mesmo z-index, porém antes no DOM) ficaria **atrás** desta tela e nunca apareceria.
- **Picker "Adicionar Exercício"** (overlay interno acionado pelo rodapé): padronizado no mesmo padrão visual **e de navegação** do drawer **"selecionar itens"** do `create-wizard-drawer.tsx` (29/06/2026). Itens em **cards grandes arredondados** (`borderRadius 16`, borda/fundo branco translúcidos; **selecionado** ou **já na sessão** = borda azul `#5b8cff` + fundo `rgba(91,140,255,.1)`), thumbnail 64px via componente compartilhado **`ExerciseImage`** (mesma ilustração/placeholder por grupo muscular usada na criação de rotina), nome em 15px + grupo muscular esmaecido, e indicador circular de 28px à direita (**+** quando não selecionado, **tique azul** quando selecionado/já na sessão).
  - **Abas Lista × Músculo** (`pickerBrowseMode`): a aba **Músculo** lista os grupos do catálogo em cards (ícone de halter + contagem `goals_browse_count` + nº de selecionados naquele grupo); tocar num grupo (`pickerMuscleFilter`) abre só os exercícios dele com **voltar** e busca. A aba só aparece quando o catálogo tem grupos musculares. Os grupos saem de `pickerMuscleGroups` (derivado de `catalog`, distinto do filtro da sessão ativa).
  - **Seleção múltipla + Confirmar**: tocar num exercício **alterna a seleção** (`pickerSelected`, itens já na sessão ficam travados/esmaecidos) em vez de adicionar na hora. Um **rodapé fixo em vidro** traz o botão **Confirmar** (`goals_picker_confirm` com a contagem; desabilitado/`goals_picker_confirm_empty` quando nada selecionado) que adiciona todos de uma vez (`handleConfirmPicker`) e fecha. `resetPicker` limpa busca/aba/filtro/seleção ao fechar.
  - **Detalhe ao tocar na foto** (`pickerInfo`): cada card tem a thumbnail num botão separado que abre um **overlay dark rolável** (mesmo visual do overlay ⓘ dos exercícios da sessão) com a **foto ampliada sobre fundo branco** + nome + grupo muscular + **"Como executar"** (`description` do catálogo, fallback `goals_exercise_no_description`). O corpo do card (nome + indicador) continua alternando a seleção — thumbnail e seleção são **dois botões distintos** dentro do card (evita botão aninhado).
  - Título, placeholder de busca e estados usam i18n (`goals_add_exercise`, `goals_search_exercise`, `goals_browse_list`/`goals_browse_muscle`/`goals_browse_count`, `goals_picker_loading`, `goals_picker_empty`, `goals_picker_confirm`, `goals_picker_confirm_empty`).
- **Minimizar** → barra flutuante global do `app-layout.tsx` (contrato `workoutMinimized`/`pendingReopen` mantido); o timer de descanso continua correndo e é exibido na barra
- **Finalizar** (com confirmação) → grava `user_workouts_hist` por série concluída → check-in automático (`createCheckInDb`) → badges (`awardBadgesForCheckInsDb`) → +1 progresso na meta vinculada à rotina (`incrementGoalProgressDb`) → carrega os duelos do usuário (`getEnrichedDuelGroupsDb` → `myGroups`) → abre o **Resumo do treino** (`workout-summary-overlay.tsx`)

## Resumo do treino (`workout-summary-overlay.tsx`)

Overlay full-screen (`zIndex 9500`, `pointer-events:auto`) exibido ao finalizar. Mostra card-canvas gerado (variantes **padrão/PR/máquina zerada**), foto opcional do usuário (carrossel), stats (duração/séries/volume), insígnias, banner de PR/máquina e lista de exercícios.
- **Visual "liquid glass" (29/06/2026)**: o overlay foi repaginado no mesmo padrão glass do `workout-session-dialog` — shell escuro em gradiente (`GLASS_ROOT_BG`) com auras radiais borradas (laranja/azul/roxo) **fixas** (não rolam com o conteúdo), header sticky em vidro com blur, e cards translúcidos (`rgba(255,255,255,.06)` + `backdrop-filter: blur(24px) saturate(180%)` + borda branca sutil) para stats, lista de exercícios, textarea de descrição, botão "Compartilhar no Duelo" e o sheet de seleção de grupo (este como vidro escuro, igual aos modais). Os tokens de cor viraram tons brancos translúcidos. Os botões de CTA por variante (verde/laranja/dourado) foram mantidos.
- **Logo no card gerado + refino do canvas (29/06/2026)**: o header do card-canvas agora desenha o **logo oficial** (`/logo-branco.png`, branco) em vez do texto "LINKA" (carregado via `loadLogo()` antes do desenho — `Promise.all([document.fonts.ready, loadLogo()])`; fallback para o wordmark em texto se a imagem falhar). O canvas ganhou polimento visual: fundo da variante padrão em violeta-escuro on-brand (`#1a1726`→`#0c0a12`), divisores com gradiente que esmaece nas pontas, cards de stats com gradiente de "vidro" + borda translúcida + rótulo tingido pelo acento, e halo radial de acento atrás do check de conclusão. É o **único** canvas com a marca no app (os demais — cropper, flow, novo post — só processam imagem).
- **Compartilhar no Feed** → faz upload da imagem (foto + canvas) e cria o post (`createPostDb`); ao concluir, **navega direto para o feed** (`onSharedToFeed` → `navigate("/")`) para o usuário ver a publicação.
- **Compartilhar no Duelo** (só aparece se `data.userGroups.length > 0`) → publica check-in no(s) grupo(s) via `addGroupCheckInDb`. Com **1 grupo**, compartilha direto; com **2+ grupos**, abre um sheet (`showGroupPicker`) com opção **Todos os grupos** (`handleShareAllDuels`) ou um grupo específico (`handleShareDuel`).
- **Diálogos adiados**: as celebrações `BadgeUnlockedDialog` (insígnia) e `GoalCompletedDialog` (meta 100%) são diálogos **Radix** (`z-300/310`) e abririam **atrás** do resumo, travando o `body` com `pointer-events:none`. Por isso ficam **pendentes** (`pendingBadges`/`pendingGoalDesc` em `Goals.tsx`) e só são exibidos no `onClose` do resumo.

## Detalhe de rotina

`routine-detail-drawer.tsx` — drawer com: lista de itens (foto/check de conclusão para dieta/hábito, remover item), editores inline de **Renomear** / **Lembrete** (horário com permissão de notificação) / **Meta** (vincular/desvincular), botão Iniciar (treino) e Excluir rotina (com confirmação; remove itens + histórico + linha em `routines`).

Em rotinas de **treino**, cada exercício é uma **linha expansível (dropdown)**: tocar nela abre um painel com a meta de **séries × reps sugeridas** — as mesmas exibidas na criação da rotina, vindas de `getSuggestedSetsForRoutine(card.name)` (catálogo `suggested-routines-data.ts`, casado pelo nome do treino). Rotinas custom sem correspondência mostram "Você define ao iniciar o treino" (`goals_detail_no_suggested_sets`). Um chevron indica o estado aberto/fechado; só um item fica expandido por vez. Itens de dieta/hábito continuam com o check de conclusão (não expandem).

Concluir todos os itens de uma rotina de dieta/hábito no dia → check-in automático + progresso na meta vinculada.

## Dados carregados

| Dado | Função (`ritmofit-db.ts`) |
|---|---|
| Rotinas | `getUserRoutinesDb` |
| Itens treino/dieta/hábito (incl. `scheduled_time` e `scheduled_days`) | `getUserWorkoutsDb` / `getUserDietsDb` / `getUserHabitsDb` |
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
| Card de streak + badges (v4) | `client/components/goals/streak-badges-card.tsx` |
| Seção "Suas rotinas" — 3 cards de tipo (v4) | `client/components/goals/routine-type-cards.tsx` |
| Sheet de badges/insígnias | `client/components/profile/insignias-drawer.tsx` |
| Dashboard de hoje (banner do treino de hoje/ontem/descanso) | `client/components/goals/today-dashboard.tsx` |
| Seção Metas | `client/components/goals/life-goals-section.tsx` |
| Anel de streak recolhível (v3, não usado pela página atual) | `client/components/goals/streak-ring-hero.tsx` |
| Cards de rotina (usado no `RoutineListDrawer`; `filterType` por tipo) | `client/components/goals/routines-tab.tsx` |
| Wizard de criação | `client/components/goals/create-wizard-drawer.tsx` |
| Detalhe de item (imagem ampliada + descrição) | `client/components/goals/item-detail-drawer.tsx` |
| Lista de rotinas por tipo (+ criar) | `client/components/goals/routine-list-drawer.tsx` |
| Detalhe de rotina | `client/components/goals/routine-detail-drawer.tsx` |
| Modo treino | `client/components/goals/workout-session-dialog.tsx` |
| Helpers (cards, streak, concluído hoje) | `client/components/goals/goals-helpers.ts` |
| Catálogo de sugestões por nível | `client/components/goals/suggested-routines-data.ts` |
| Drawer de detalhe da meta | `client/components/goals/goal-detail-drawer.tsx` |
| Celebração de meta | `client/components/shared/goal-completed-dialog.tsx` (compartilhado com o feed) |
| Notificações de rotina | `client/hooks/use-routine-notifications.ts` |
| Estado do treino ativo | `client/lib/workout-context.tsx` (+ barra no `app-layout.tsx`) |

## i18n

Chaves reaproveitadas da v1 (`goals_*`) + sub-prefixos `goals_today_*`, `goals_session_*`, `goals_wizard_*`, `goals_suggest_*`, `goals_level_*`, `goals_program_*`, `goals_detail_*`, `goals_dash_*` e (v4) `goals_rt_*` / `goals_focus_badge` / `goals_streak_record` / `goals_dash_your_routines` — todas em PT e EN.

## Removido na v2 (existia na v1, pode voltar depois)

GPS/corrida ao ar livre, compartilhar treino como post/duelo, celebração de PR, hidratação, macro do dia, humor (mood), resumo semanal de check-ins, drawer de histórico por exercício, "copiar rotina de alguém" dentro do wizard (continua existindo na tela Buscar).
