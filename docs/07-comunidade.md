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

### Vista: Lista de Conversas

**Header:**
- Título "Mensagens"
- Botão `PenSquare` (nova conversa / iniciar conversa)

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

Ao clicar → entra na conversa (viewMode: `conversation`)

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

---

### Vista: Conversa Individual

**Header:**
- Botão `ArrowLeft` para voltar à lista
- Avatar + nome do contato
- Clicável → navega para o perfil do contato

**Lista de Mensagens:**
- Mensagens do usuário logado alinhadas à direita (estilo bolha)
- Mensagens do contato alinhadas à esquerda
- Indicador de leitura: `Check` / `CheckCheck`
- Timestamp em cada mensagem
- **Reações emoji** em cada mensagem (emoji picker ao segurar/clicar)

**Campo de Envio:**
- Input de texto
- Botão `Send` para enviar
- Enter também envia a mensagem

**Realtime:**
- Novas mensagens aparecem em tempo real via Supabase Realtime (canal `messages-{userId}`, evento `INSERT` na tabela `messages`)
- Auto-scroll para última mensagem
- Marca mensagens como lidas ao abrir a conversa (`markMessagesAsReadDb`) e ao receber mensagem em tempo real

**Reações de Emoji:**
- Toque na mensagem abre picker com 6 emojis rápidos (❤️ 😂 😮 😢 👍 🔥) + botão "+" para abrir teclado emoji nativo do celular
- Long press / clique com botão direito também abre o picker
- Reações persistidas no banco via `message_reactions` (funções: `addMessageReactionDb`, `removeMessageReactionDb`, `getMessageReactionsDb`)
- Clique na reação existente a remove (toggle)
- Reações com múltiplos usuários exibem contador

---

## Tab: Duelos

Desafios em grupo onde os participantes fazem check-ins para registrar progresso coletivo.

### Lista de Grupos/Duelos

**Header:**
- Título "Duelos"
- Botão `Plus` → abre modal de criação de grupo

**Subseções:**
1. **Convites Pendentes** — grupos para os quais o usuário foi convidado
2. **Meus Grupos** — grupos criados pelo usuário
3. **Grupos Disponíveis** — grupos públicos que o usuário pode entrar

---

### Card de Grupo/Duelo

Cada grupo exibe:
| Elemento | Descrição |
|---|---|
| Foto do grupo | Imagem customizável |
| Nome do grupo | Título do desafio |
| Descrição | Objetivo do grupo |
| Participantes | Contagem + lista de avatares |
| Progresso coletivo | Barra ou percentual |
| Check-ins do dia | Quem já fez check-in hoje |
| Botão Check-in | Registrar participação |
| Botão Ver Detalhes | Expande/recolhe informações |

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
- Nome da rotina + horário

**Modal de Detalhe do Check-in:**
- Foto de perfil do usuário (com fallback para inicial)
- Data + horário completo do check-in
- Tag de grupo muscular
- Lista de exercícios realizados com nome, grupo muscular e carga (kg)
- Volume total e número de exercícios como stats

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
| Rotinas de exercício | `getUserExerciseRoutinesDb()` |
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
