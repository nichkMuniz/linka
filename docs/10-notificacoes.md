# Tela: Notificações

**Rota:** `/notificacoes`
**Arquivo:** `client/pages/Notifications.tsx`
**Layout:** AppLayout

---

## Objetivo

Central de notificações do usuário. Exibe todos os alertas e atividades relacionados ao perfil, como curtidas, comentários, novos seguidores, conquistas e interações em duelos.

---

## Estrutura Visual

```
┌──────────────────────────────────┐
│  Notificações         [Limpar]   │
├──────────────────────────────────┤
│  [Ícone] Usuário fez X           │
│          há 2 horas              │
├──────────────────────────────────┤
│  [Ícone] Usuário fez Y           │
│          há 1 dia                │
├──────────────────────────────────┤
│  ... (lista completa)            │
└──────────────────────────────────┘
```

---

## Lista de Notificações

Cada item exibe:
| Elemento | Descrição |
|---|---|
| Ícone de tipo | Ícone colorido indicando o tipo da notificação |
| Texto | Descrição da ação ("João curtiu seu post") |
| Timestamp | Tempo relativo ("há 5 minutos") |
| Indicador de não lida | Ponto colorido se ainda não foi lida |
| Clicável | Navega para a origem da notificação |

---

## Tipos de Notificações e Ícones

| Tipo (DB) | Ícone | Cor | Descrição |
|---|---|---|---|
| 1 `follow` | `UserPlus` | Azul | Alguém começou a te seguir |
| 2 `incentive` | Ícone do incentivo | Amarelo | Alguém incentivou seu post/shot |
| 3 `comment` | `MessageCircle` | Roxo | Alguém comentou no seu post/shot |
| 4 `duel_invite` | `Swords` | Laranja | Convite para duelo |
| 5 `join_request` | `Swords` | Amarelo | Solicitação de entrada no duelo |
| 6 `comment_reaction` | `SmilePlus` | Rosa | Alguém reagiu ao seu comentário |
| 7 `checkin_reaction` | `SmilePlus` | Laranja | Alguém reagiu ao seu check-in de duelo |
| 9 `post_tag` | `AtSign` | Ciano | Alguém marcou você em uma publicação (tabela `post_tags`, trigger `trg_notify_post_tag`) |

### Tipos de Incentivo (subtipo)
Quando o tipo é incentivo, o ícone exibido é o do incentivo específico (não um ícone genérico):
| ID | Nome | Ícone | Cor |
|---|---|---|---|
| 1 | Apoio | `HeartHandshake` | Rose |
| 2 | Continua | `Flame` | Orange |
| 3 | Ganhador | `Trophy` | Emerald |
| 4 | Consegue Mais | `Rocket` | Blue |
| 5 | Limite Maior | `Target` | Purple |
| 6 | Mais Algum | `Zap` | Yellow |

---

## Ações

### Marcar como lida
- **Automático:** Todas as notificações são marcadas como lidas ao abrir a tela (`markNotificationsAsReadDb`)
- O badge do ícone na navegação é zerado ao entrar na tela

### Limpar tudo
- Botão "Limpar" no header
- Abre `AlertDialog` de confirmação:
  - Título: "Limpar notificações"
  - Descrição: Aviso de que a ação é irreversível
  - Botões: Cancelar | Confirmar
- Ao confirmar: `clearNotificationsDb` → lista fica vazia

### Navegar para a origem
- Clicar em uma notificação navega para o contexto relacionado:
  - Notificação de follow (tipo 1) → `/usuario/:userId`
  - Notificação de incentivo em **post** (tipo 2, `postId` presente) → `/post/:postId` com `state.openLikes = true`
  - Notificação de comentário em **post** (tipo 3, `postId` presente) → `/post/:postId` com `state.openComments = true`
  - Notificação de incentivo em **shot** (tipo 2, `shotId` presente) → `/shots` com `state.shotId`
  - Notificação de comentário em **shot** (tipo 3, `shotId` presente) → `/shots` com `state.openComments = true` e `state.shotId` (abre drawer de comentários automaticamente). **Nota:** a notificação usa `shots_id` na tabela — corrigido para não confundir com posts.
  - Notificação de reação em comentário de **post** (tipo 6, `postId`) → `/post/:postId` com `state.openComments = true`
  - Notificação de reação em comentário de **shot** (tipo 6, `shotId`) → `/shots` com `state.openComments = true` e `state.shotId`
  - Notificação de reação em comentário de **flow** (tipo 6, `flowId`) → `/` (feed) com `state.openFlow = flowId` (abre FlowViewerModal). **Se o flow já expirou** (não está mais no ring, > 24h), o `Index.tsx` redireciona para o Arquivo de Flows (`/perfil` com `state.openFlowArchive`) quando o flow é do próprio usuário, ou mostra um toast "não disponível" quando é de outro usuário — ver `docs/01-feed.md` e `docs/08-perfil.md`
  - Notificação de reação em comentário de **check-in** (tipo 6, `checkInId`) → `/comunidade` com `state.openCheckIn = checkInId` (abre drawer do check-in)
  - Notificação de duelo (tipo 4 ou 5) → `/comunidade?tab=requests` (abre aba "Solicitações")
  - Notificação de reação em check-in de duelo (tipo 7) → `/comunidade` com `state.openCheckIn = checkInId` (abre drawer do check-in)
  - Notificação de marcação em post (tipo 9, `postId`) → `/post/:postId` (fallback genérico por `postId` no `handleNotificationClick`); o card mostra a thumbnail do post quando disponível

---

## Realtime

Novas notificações chegam em tempo real:

```javascript
supabase
  .channel("notifications-page")
  .on("postgres_changes", {
    event: "INSERT",
    schema: "public",
    table: "notifications",
    filter: `user_id=eq.${user.id}`
  }, () => {
    // Invalida ANTES de reler — getNotificationsDb() é cacheada (60s)
    invalidateQueryCache("notifications");
    getNotificationsDb().then(setNotifications)
  })
  .subscribe()
```

- Sem polling — usa Supabase Realtime
- Ao receber nova notificação, recarrega a lista completa
- **Invalidação obrigatória antes do refetch:** `getNotificationsDb()` passa pelo cache (`CACHE_TTL_MEDIUM`, 60s). Sem `invalidateQueryCache("notifications")` no handler, o refetch disparado pelo realtime relia a **própria entrada em cache** e a notificação recém-chegada só aparecia quando o TTL vencesse — o realtime era efetivamente um no-op. Mesma regra vale para os badges no `AppLayout` (`unreadNotifCount`, `unreadMsgCount`)

---

## Estados da Tela

| Estado | Comportamento |
|---|---|
| Carregando | Spinner ou skeleton |
| Lista vazia | Mensagem "Nenhuma notificação" |
| Limpando | Botão em loading durante `clearNotificationsDb` |
| Erro | Toast de erro |

---

## Dados Carregados

| Dado | Função DB |
|---|---|
| Lista de notificações | `getNotificationsDb()` |
| Marcar como lidas | `markNotificationsAsReadDb()` |
| Limpar todas | `clearNotificationsDb()` |

---

## Push de Re-engajamento (proativo, agendado)

Além do push **reativo** (evento social → trigger/webhook → `send-push-notification`), há um push **proativo de retenção**, enviado por uma Edge Function **agendada** (`supabase/functions/reengagement-push`), 1x/dia via **pg_cron** (19:00 BRT):

| Gatilho | Condição | Mensagem (PT) | Destino |
|---|---|---|---|
| **Sequência em risco** | Fez check-in **ontem** mas ainda não **hoje**, e streak ≥ 3 | "🔥 Sua sequência está em risco! Você está há {n} dias seguidos…" | `/metas` |
| **Inatividade** | Último check-in foi há **exatamente 3 ou 7 dias** | "Sentimos sua falta 💪 Faz {n} dias que você não treina…" | `/metas` |

- **Não cria card in-app:** ao contrário das notificações sociais, o re-engajamento **não** insere linha em `notifications` — é um lembrete efêmero que vira só o push do iOS (não polui a lista nem o badge de não lidas). Envia APNs direto, reaproveitando os mesmos secrets/JWT do `send-push-notification`.
- **Datas em America/Sao_Paulo** (público majoritariamente BR) — mesma premissa do resto do app. Copy em PT, igual ao push social.
- **Dedup sem tabela de controle:** os limiares são de **dia exato** (ontem / há 3 / há 7 dias), então cada usuário recebe no máximo um nudge por dia (cron diário) sem precisar registrar "já enviado".
- **Só usuários com push ativo** entram no cálculo (join com `push_tokens`); tokens inválidos (`BadDeviceToken`/`Unregistered`) são removidos na hora, como no push social.
- **Deploy:** `supabase functions deploy reengagement-push` + rodar `docs/migrations/20260713-reengagement-cron.sql` (habilita `pg_cron`/`pg_net` e agenda o job; requer preencher `PROJECT_REF`/`SERVICE_ROLE_KEY`/`CRON_SECRET`).

---

## Observações Técnicas

- A tela faz `markNotificationsAsReadDb()` **antes** de carregar a lista, garantindo que o badge de não lidas seja zerado imediatamente
- O canal Realtime é cancelado no unmount (`channel?.unsubscribe()`) para evitar memory leak
- A contagem de não lidas no badge da navegação (AppLayout) é gerenciada separadamente com sua própria subscription
- Notificações de posts regulares (incentivo/comentário) são inseridas pelo **trigger do banco** — o código cliente não insere manualmente para evitar duplicação
- **Agrupamento de incentivos:** notificações do tipo 2 (incentivo) para o mesmo `postId`/`shotId` são colapsadas em uma entrada única via `collapseIncentives()`, independente do tipo de incentivo ou do remetente. O campo `groupedUsers` rastreia cada usuário com seus respectivos tipos enviados. A label exibida segue o padrão `"UsuarioX te deu "Vencedor" e outras N reações na sua postagem"`, onde N = total de reações do grupo menos 1. Com apenas 1 reação, exibe a descrição padrão sem agrupamento.
- **Contador do badge de notificações:** `getUnreadNotificationsCountDb()` aplica a mesma lógica de agrupamento: notificações de incentivo (tipo 2) para o mesmo `post_id`/`shots_id` são contadas como **1**, refletindo exatamente o número de itens que o usuário verá na lista.
- **Convite de duelo via modal de Participantes:** `addMembersToGroupDb` agora envia notificações tipo 4 para os novos membros adicionados (mesmo comportamento de `createDuelGroupDb`)
- Notificações de shots (incentivos) são inseridas pelo cliente com `post_id: shotId` (comportamento legado). Notificações de comentário em shots usam `shots_id: shotId` (corrigido). O `NotificationItem` expõe `shotId` quando `shots_id` está presente. O `getNotificationsDb` lê `shots_id` do select e popula `shotId` no retorno
- **Reações a comentários (tipo 6):** inseridas pelo cliente em `toggleCommentReactionDb`. Para flows usa o campo `flow_id` (uuid). Para check-ins de comentário usa `duel_check_in_id` (uuid). Para shots usa `shots_id`. Para posts usa `post_id`. Suporte legado a prefixos `flow:` e `checkin:` em `shots_id` mantido para notificações antigas.
- **Reações a check-ins de duelo (tipo 7):** inseridas em `sendCheckInReactionNotificationDb` usando o campo `duel_check_in_id`. Deduplicadas por `(user_id, follower_id, type, duel_check_in_id)`.
- O `PostCommentsDialog` usa `useRef` para garantir que `defaultOpen` abre o drawer apenas uma vez (evita dupla abertura por re-render do React.lazy/Suspense)
- O `PostDetail` usa `useRef` para garantir que o `PostLikesModal` seja aberto apenas uma vez ao navegar de uma notificação
