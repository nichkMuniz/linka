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

| Tipo | Ícone | Cor | Descrição |
|---|---|---|---|
| `like` | `Heart` | Vermelho | Alguém curtiu seu post |
| `comment` | `MessageCircle` | Azul | Alguém comentou no seu post |
| `follow` | `UserPlus` | Verde | Alguém começou a te seguir |
| `incentive` | `Zap` | Amarelo | Alguém incentivou seu post |
| `support` | `HeartHandshake` | Rosa | Tipo de incentivo "Apoio" |
| `streak` | `Flame` | Laranja | Conquista de sequência |
| `achievement` | `Trophy` | Dourado | Nova conquista desbloqueada |
| `goal` | `Rocket` | Roxo | Progresso em meta |
| `challenge` | `Target` | Ciano | Desafio/meta concluída |
| `duel` | `Swords` | Índigo | Atividade em duelo |

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
  - Notificação de follow → `/usuario/:userId`
  - Notificação de incentivo em **post** (tipo 2, `postId` presente) → `/post/:postId` com `state.openLikes = true`
  - Notificação de comentário em **post** (tipo 3, `postId` presente) → `/post/:postId` com `state.openComments = true`
  - Notificação de incentivo em **shot** (tipo 2, `shotId` presente) → `/shots` com `state.shotId`
  - Notificação de comentário em **shot** (tipo 3, `shotId` presente) → `/shots` com `state.openComments = true` e `state.shotId` (abre drawer de comentários automaticamente)
  - Notificação de duelo (tipo 4 ou 5) → `/comunidade?tab=requests` (abre aba "Solicitações")

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
    // Re-fetches full list on new notification
    getNotificationsDb().then(setNotifications)
  })
  .subscribe()
```

- Sem polling — usa Supabase Realtime
- Ao receber nova notificação, recarrega a lista completa

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

## Observações Técnicas

- A tela faz `markNotificationsAsReadDb()` **antes** de carregar a lista, garantindo que o badge de não lidas seja zerado imediatamente
- O canal Realtime é cancelado no unmount (`channel?.unsubscribe()`) para evitar memory leak
- A contagem de não lidas no badge da navegação (AppLayout) é gerenciada separadamente com sua própria subscription
- Notificações de posts regulares (incentivo/comentário) são inseridas pelo **trigger do banco** — o código cliente não insere manualmente para evitar duplicação
- **Agrupamento de incentivos:** notificações do tipo 2 (incentivo) com mesmo `postId`/`shotId` + mesmo `incentiveType` dentro de um mesmo grupo de data são colapsadas em uma entrada única via `collapseIncentives()`. A descrição é alterada para "X e mais N pessoas te deram…". Avatares empilhados indicam múltiplos incentivadores.
- **Convite de duelo via modal de Participantes:** `addMembersToGroupDb` agora envia notificações tipo 4 para os novos membros adicionados (mesmo comportamento de `createDuelGroupDb`)
- Notificações de shots são inseridas pelo **trigger do banco** com o campo `shots_id` populado (em vez de `post_id`). O `NotificationItem` expõe isso como `shotId`. O `getNotificationsDb` lê `shots_id` do select e popula `shotId` no retorno
- O `PostCommentsDialog` usa `useRef` para garantir que `defaultOpen` abre o drawer apenas uma vez (evita dupla abertura por re-render do React.lazy/Suspense)
- O `PostDetail` usa `useRef` para garantir que o `PostLikesModal` seja aberto apenas uma vez ao navegar de uma notificação
