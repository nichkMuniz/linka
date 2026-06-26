# Tela: Comunidade

**Rota:** `/comunidade`
**Arquivo:** `client/pages/Community.tsx`
**Layout:** AppLayout
**Tamanho:** ~2.540 linhas

---

## Objetivo

Hub social do aplicativo. Reúne mensagens diretas, duelos em grupo (desafios coletivos) e ranking global de pontuação dos usuários.

---

## Estrutura Visual

```
┌──────────────────────────────────┐
│  Tabs: [Mensagens] [Duelos] [Rank]│
├──────────────────────────────────┤
│  Conteúdo da Tab ativa           │
└──────────────────────────────────┘
```

> As tabs usam estilo de sublinhado customizado (não o componente Shadcn padrão).

---

## Tab: Mensagens

> **Visual (LinKa Glass — refatorado 2026-06-26):** A aba de Mensagens segue o design system LinKa Glass. A lista de conversas usa **cartões frosted-glass** empilhados (`rounded-[20px]`, fundo `rgba(255,255,255,.04)`, sem divisórias) em vez de linhas com `divide-y`. A busca é um pill de vidro; o botão de nova conversa é um círculo de vidro. Na conversa individual, as bolhas próprias usam **gradiente azul→roxo** (`linear-gradient(135deg,#5b8cff,#7b3ff2)`) e as do contato usam vidro translúcido (`rgba(255,255,255,.08)`), ambas com cantos `rounded-[20px]` e um canto "rabicho" reduzido. Header, banner de resposta e barra de envio têm fundo de vidro com blur. A **barra de input é mais alta** (pill de `52px` de altura mínima, `rounded-[26px]`, com highlight interno de vidro), os botões de mídia (câmera/galeria/microfone) são alvos circulares de `44px` com **fundo de vidro sutil** (`rgba(255,255,255,.05)` + borda) e ícones de **traço fino** (`strokeWidth 1.8`) para combinar com o glass, e o botão de enviar é um círculo de `48px` com gradiente azul→roxo e sombra. Todas as strings da aba usam `t()` (chaves `community_*`).

### Vista: Lista de Conversas

**Header:**
- Título "Mensagens"
- Botão `PenSquare` → abre drawer "Nova mensagem" com campo de busca dinâmica; busca qualquer usuário da plataforma via `searchUsersDb` (sem restrição de seguir); ao selecionar, abre a conversa diretamente (`setViewMode("conversation")`)

**Busca:**
- Input de pesquisa para filtrar conversas por nome

**Lista de Conversas:**

Cada conversa exibe:
| Elemento | Descrição |
|---|---|
| Avatar do contato | Foto de perfil |
| Nome do contato | Nickname |
| Última mensagem | Preview truncado |
| Timestamp | Hora/data da última mensagem |
| Badge não lida | Ponto/contagem de mensagens não lidas |
| Status lida | `Check` (enviada) / `CheckCheck` (lida) |
| Botão excluir | Ícone `Trash2` — aparece ao hover, abre AlertDialog de confirmação |

Ao clicar na linha → entra na conversa (viewMode: `conversation`)
Ao clicar no botão excluir → soft-delete do histórico apenas para o usuário logado (`deleteConversationForMeDb`); o outro participante continua vendo as mensagens normalmente

---

---

## Tab: Solicitações

A aba aparece quando há convites ou pedidos pendentes. Exibe **duas seções**:

1. **Convites recebidos** — grupos para os quais o usuário foi convidado (aceitar/recusar)
2. **Pedidos para entrar nos seus grupos** — usuários que solicitaram entrada em grupos criados pelo usuário logado (aprovar/recusar)
   - Exibe nome do usuário, foto, grupo e **quantidade de participantes** do grupo
   - Ao aprovar → `approveGroupRequestDb` (muda status para "accepted")
   - Ao recusar → `rejectGroupRequestDb` (remove da tabela)

> A aba recarrega os pendentes sempre que é selecionada (refresh automático).
> Após recusar um convite, se não houver mais solicitações, retorna para a aba de Duelos.

---

### Cards de Estatísticas (clicáveis)

Os 3 cards de estatísticas na tela do grupo são interativos:
| Card | Ação ao clicar |
|---|---|
| **Líder** (check-ins do líder) | Abre modal de Classificações |
| **Você** (posição do usuário) | Abre modal de Classificações |
| **Dias** (dias restantes) | Abre modal de Detalhes do Grupo |

### Modal de Detalhes do Grupo

Exibe:
- Nome do grupo
- Local (UF)
- Objetivo
- **Data de início** (`createdAt`)
- **Data de encerramento** (`endDate` — "Sem prazo" se não definido)
- Botão de sair / apagar grupo (conforme papel do usuário)

**Edição (somente criador):**
- Botão "Editar" no cabeçalho do modal (visível apenas para o criador)
- Ao clicar, os campos Nome e Objetivo tornam-se editáveis (Input / Textarea)
- Botões "Cancelar" e "Salvar" aparecem no lugar dos botões de ação
- Ao salvar → `updateGroupInfoDb(groupId, name, goal)` — atualiza tabela `duel_groups`
- Estado local do grupo (`selectedGroupForView` e `userCreatedGroups`) é atualizado imediatamente sem reload

---

### Vista: Conversa Individual

**Header:**
- Botão `ArrowLeft` para voltar à lista
- Avatar + nome do contato + **insígnia do usuário** (`UserInsignias` component ao lado do nome)
- Clicável → navega para o perfil do contato

**Lista de Mensagens:**
- Mensagens do usuário logado alinhadas à direita (estilo bolha)
- Mensagens do contato alinhadas à esquerda
- Indicador de leitura: `Check` / `CheckCheck`
- Timestamp em cada mensagem
- **Reações emoji** em cada mensagem (emoji picker ao segurar/clicar)

**Campo de Envio (estilo Instagram):**
- Ícone `Camera` à esquerda → abre câmera para capturar e enviar foto diretamente
- Input de texto centralizado com fundo arredondado (pill)
- Ícone `Smile` dentro do input → abre `EmojiPicker` (componente `shared/emoji-picker.tsx`) com 4 categorias; o emoji selecionado é inserido no texto
- Quando sem texto: ícones `Image` (galeria) e `Mic` (gravação de áudio) à direita
- Quando com texto: botão `Send` azul à direita substitui os ícones de mídia
- Enter também envia a mensagem
- Fotos enviadas fazem upload para Supabase Storage (`posts/message-images/`) e são exibidas como imagem na bolha da conversa
- Mensagens de imagem: prefixo `[image]:url` → renderizadas como `<img>` clicável
- Mensagens de áudio: prefixo `[audio]:url` → renderizadas como player `<audio controls>`; gravação usa MediaRecorder API; upload para `posts/message-audio/` no Supabase Storage
- Permissão de microfone já declarada no `Info.plist` iOS (`NSMicrophoneUsageDescription`)

**Realtime:**
- Novas mensagens aparecem em tempo real via Supabase Realtime (canal `messages-{userId}`, evento `INSERT` na tabela `messages`)
- Auto-scroll para última mensagem
- Marca mensagens como lidas ao abrir a conversa (`markMessagesAsReadDb`) e ao receber mensagem em tempo real

**Long Press / Segurar Mensagem:**
- Segurar (touch 450ms) ou clique com botão direito abre um overlay de ações no estilo Instagram
- O overlay exibe preview da mensagem, 6 emojis rápidos (❤️ 😂 😮 😢 😡 👍) e as seguintes ações:
  - **Responder** — sempre disponível para qualquer mensagem
  - **Apagar mensagem** — visível apenas para mensagens próprias enviadas há menos de 10 minutos; hard-delete permanente que remove para ambos os participantes (`deleteMessagePermanentlyDb`)
  - **Apagar para mim** — visível apenas para mensagens do outro usuário; soft-delete que oculta a mensagem somente para o usuário logado (`deleteMessageForMeDb`)
  - Mensagens próprias com mais de 10 minutos não exibem nenhuma opção de deleção
- **Responder mensagem:** seleciona a mensagem como contexto de reply; um banner aparece acima do input mostrando o texto original com botão "X" para cancelar
- A mensagem enviada como reply é prefixada com `↩ <texto original>\n\n<nova mensagem>` no banco
- Na renderização, mensagens com prefixo `↩` exibem uma citação visual (bloco com borda lateral) antes do texto principal

**Reações de Emoji:**
- Emojis rápidos disponíveis no overlay de long press
- Reações persistidas no banco via `message_reactions` (funções: `addMessageReactionDb`, `removeMessageReactionDb`, `getMessageReactionsDb`)
- Clique na reação existente a remove (toggle)
- Reações com múltiplos usuários exibem contador

---

## Tab: Duelos

Desafios em grupo onde os participantes fazem check-ins para registrar progresso coletivo.

### Layout da Lista (LinKa Glass — refatorado 2026-06-26)

Layout em **lista vertical** (anteriormente: grid de 2 colunas). Segue o design system LinKa Glass com cartões frosted-glass e efeito blur.

**Seções:**

1. **CTA "Criar um duelo"** — card de destaque com gradiente azul/roxo no topo da lista; clique abre o wizard de criação de grupo

2. **Meus grupos ativos** — grupos criados pelo usuário ou em que participa:
   - **Card hero** (primeiro grupo) — banner de foto/cor no topo (110px), badge de papel ("Seu grupo" / "Participante"), badge de dias restantes, nome, contagem de participantes + cidade, botão branco "Fazer check-in de hoje" (ação: abre `openGroupView` + modal de check-in simultaneamente)
   - **Cards compactos** (demais grupos) — ícone/foto quadrado (50×50, border-radius 16px), nome, participantes, cidade, dias restantes, chevron para navegar

3. **Da comunidade** — grupos disponíveis para entrar (lista simples):
   - Ícone/foto, nome, contagem + nome do criador, botão "Entrar" / "Ver Grupo" / "⏳ Pendente"
   - Ao clicar "Entrar" → `addMembersToGroupDb` + notificação ao criador; estado muda para "Pendente"

4. **Empty state** — ícone `Swords` com mensagem central quando não há grupos

---

### Ações em Grupos

**Como membro:**
- **Fazer check-in** — registra participação diária via `addGroupCheckInDb`
- **Atualizar check-in** — edita descrição/foto do check-in do dia
- **Deletar check-in** — remove o check-in do dia
- **Sair do grupo** — AlertDialog de confirmação → `leaveGroupDb`

**Como criador:**
- Todas as ações de membro, mais:
- **Convidar membros** — Drawer com lista de usuários seguidos para convidar
- **Alterar foto do grupo** — `updateGroupPhotoDb`
- **Deletar grupo** — AlertDialog de confirmação → `deleteGroupDb`

**Convites pendentes:**
- **Aceitar** → `acceptGroupInviteDb`
- **Recusar** → `declineGroupInviteDb`

---

### Modal de Criação de Grupo (Wizard 4 steps)

Fluxo em 4 etapas com barra de progresso visual no topo:

**Step 1 — Identidade:**
| Campo | Tipo |
|---|---|
| Capa do grupo | Upload de imagem (preview inline) |
| Nome do grupo | Input |
| Meta do grupo | Textarea |

**Step 2 — Localização:**
| Campo | Tipo |
|---|---|
| Estado (UF) | Select com todos os 27 estados |

**Step 3 — Duração:**
| Campo | Tipo |
|---|---|
| Duração em dias | Select (30/60/90/120/180/360 dias) |
| Previsão de término | Calculada automaticamente |

**Step 4 — Participantes:**
- Resumo do grupo criado (nome, UF, duração, meta)
- Lista de usuários seguidos com busca e seleção múltipla
- Botão "Criar" bloqueado com estado `isCreatingGroup` para evitar duplos cliques
- Após criação: faz upload da foto usando `updateGroupPhotoDb` (agora que o ID do grupo existe)

> **Regra de performance:** O foto do grupo é salva APÓS a criação do grupo (com o ID já disponível), garantindo que a capa seja armazenada corretamente no Storage.

---

### Check-in de Grupo

**Drawer de Check-in:**
- Opção de adicionar foto do treino
- Textarea para descrição do check-in
- Seletor de "O que você treinou?" — exibe **apenas rotinas concluídas** nos últimos 7 dias (via `getCompletedRoutinesTodayDb`)
  - Cada opção mostra: nome da rotina, grupo muscular principal, quantidade de exercícios, horário de conclusão
  - Lista expandida mostra cada exercício com carga (kg)
  - Série e volume total preenchidos automaticamente do histórico
- Séries/Volume são salvos da tabela `user_workouts_hist` (reais, não zeros)
- `muscle_group` e `exercises` (JSON) são salvos no check-in para exibição no detalhe

**Cards de Check-in no Histórico:**
- Foto de perfil do usuário ao lado do nome
- Tag de grupo muscular
- Nome da rotina / descrição
- **Horário sempre visível** (mesmo quando há foto) — exibido abaixo da thumbnail

**Modal de Detalhe do Check-in:**
- Foto de perfil do usuário (com fallback para inicial)
- Data + horário completo do check-in
- Tag de grupo muscular
- Lista de exercícios realizados com nome, grupo muscular e carga (kg)
- Volume total e número de exercícios como stats
- **Reações de emoji** — 6 emojis rápidos (❤️ 🔥 💪 😮 👏 🏆), toggle por usuário, contador de reações (`duel_check_in_reactions`); sincronizadas em tempo real via Supabase Realtime (canal `checkin-reactions:{groupId}`) — todos os membros veem as reações atualizadas sem precisar recarregar
- **Seção de comentários** — lista de comentários com avatar + nome + horário, input para enviar novo comentário (`duel_check_in_comments`)

> **Tabelas necessárias:** `duel_check_in_comments` e `duel_check_in_reactions` — ver migration em `docs/migrations/20260327-community-features.sql`

---

## Tab: Ranking

Leaderboard global dos usuários mais pontuados.

**Dados exibidos por usuário:**
| Elemento | Descrição |
|---|---|
| Posição | #1, #2, #3... |
| Avatar | Foto de perfil |
| Nome | Nickname |
| Pontos | Total acumulado |
| Badge de posição | Troféu dourado/prata/bronze para top 3 |

**Ícones especiais:**
- #1: 🏆 `Trophy` dourado
- #2: `TrendingUp` prata
- #3: normal com destaque

Dados carregados via `getRankingDb()`

---

## Dados Carregados

| Dado | Função DB |
|---|---|
| Conversas | `getConversationsDb()` |
| Mensagens de uma conversa | `getConversationMessagesDb(conversationId)` |
| Rotinas concluídas (últimos 7 dias) | `getCompletedRoutinesTodayDb(userId)` |
| Reações de mensagens | `getMessageReactionsDb(messageIds[])` |
| Adicionar reação | `addMessageReactionDb(messageId, emoji)` |
| Remover reação | `removeMessageReactionDb(messageId, emoji)` |
| Usuários seguidos | `getFollowingDb()` |
| Ranking | `getRankingDb()` |
| Grupos criados pelo usuário | `getUserCreatedDuelGroupsDb()` |
| Grupos disponíveis | `getAvailableDuelGroupsDb()` |
| Check-ins de um grupo | `getGroupCheckInsDb(groupId)` |
| Participantes de um grupo | `getGroupParticipantsDb(groupId)` |
| Convites pendentes | `getPendingInvitesDb()` |
| Solicitações de entrada nos grupos do dono | `getPendingGroupRequestsDb()` |
| Comentários de um check-in | `getCheckInCommentsDb(checkInId)` |
| Adicionar comentário em check-in | `addCheckInCommentDb(checkInId, text)` |
| Reações de emoji em check-ins | `getCheckInReactionsDb(checkInIds[])` |
| Adicionar/remover reação | `setCheckInReactionDb(checkInId, emoji)` |
| Apagar histórico (só para mim) | `deleteConversationForMeDb(otherUserId)` |
| Apagar mensagem permanentemente (própria < 10min) | `deleteMessagePermanentlyDb(messageId)` |
| Apagar mensagem só para mim (de outro usuário) | `deleteMessageForMeDb(messageId)` |
| Aprovar solicitação de grupo | `approveGroupRequestDb(groupId, userId)` |
| Recusar solicitação de grupo | `rejectGroupRequestDb(groupId, userId)` |
| Rotinas de exercício | `getUserExerciseRoutinesDb()` |
| Atualizar nome/objetivo do grupo | `updateGroupInfoDb(groupId, name, goal)` |
| Treinos do usuário | `getUserWorkoutsDb()` |
| Perfil do usuário | `getUserProfileDb()` |

---

## Realtime (Mensagens)

- Canal Supabase: `messages-{userId}` (por conversa ativa)
- Evento: `INSERT` na tabela `messages`
- Ao receber nova mensagem: recarrega a conversa ativa automaticamente
- Marca como lida imediatamente ao receber mensagem com a conversa aberta
- Badge de não lidas no ícone de navegação atualiza automaticamente

---

## Observações Técnicas

- `viewMode` controla se exibe lista de conversas ou uma conversa individual
- Tab ativa pode ser controlada via `searchParams` (ex: `?tab=duelos`)
- `useLayoutMode()` detecta mobile/desktop para ajustes de layout
- Grupos têm notificações enviadas ao criador quando alguém pede para entrar (`sendGroupJoinRequestNotificationDb`)
