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
| 3 `comment` | `MessageCircle` | Roxo | Alguém comentou no seu post/shot/flow — ou, quando vem com `duel_check_in_id`, **no seu check-in de duelo** (inserida por `addCheckInCommentDb`) |
| 4 `duel_invite` | `Swords` | Laranja | Convite para duelo |
| 5 `join_request` | `Swords` | Amarelo | Solicitação de entrada no duelo |
| 6 `comment_reaction` | `SmilePlus` | Rosa | Alguém reagiu ao seu comentário |
| 7 `checkin_reaction` | `SmilePlus` | Laranja | Alguém reagiu ao seu check-in de duelo |
| 9 `post_tag` | `AtSign` | Ciano | Alguém marcou você em uma publicação (tabela `post_tags`, trigger `trg_notify_post_tag`) |
| 10 `message` | `Send` | Azul-céu | Mensagem privada recebida — **só push, nunca aparece nesta lista** (ver "Mensagem privada é push-only" abaixo) |
| 11 `duel_checkin` | `Dumbbell` | Esmeralda | Um participante do seu grupo de duelo postou um check-in (inserida por `addGroupCheckInDb`) |
| 12 `promotion_like` | `Heart` | Rose | Alguém curtiu sua promoção (inserida por `togglePromotionLikeDb`) |
| 13 `promotion_expired` | `Clock` | Âmbar | Alguém marcou sua promoção como expirada (inserida por `reportPromotionStatusDb`; `follower_id` = quem deu o voto que fechou a maioria) |
| 14 `checkin_classified` | `CheckCircle2` | Esmeralda | Um participante **classificou** (aprovou) seu check-in num duelo do modo memes (trigger `trg_notify_check_in_vote`) |
| 15 `checkin_disqualified` | `XCircle` | Vermelho | Um participante **desclassificou** (reprovou) seu check-in num duelo do modo memes (trigger `trg_notify_check_in_vote`) |

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
- **Momentos em que a tela marca como lida (2026-07-21):** logo após a lista carregar (mount e pull-to-refresh), a cada notificação que chega pelo Realtime **com a tela aberta**, e no **unmount** (varredura final ao sair). Junto, o `AppLayout` ignora as atualizações de contagem do Realtime enquanto `pathname === "/notificacoes"` — assim o sinalizador de pendência nunca sobrevive à saída da tela
- **A marcação vem DEPOIS do `getNotificationsDb()`, não em paralelo:** marcar como lido invalida o cache `notifications`, e um fetch ainda em voo regravaria por cima o payload antigo (com `read=false`)

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
  - Notificação de comentário em **check-in de duelo** (tipo 3, `checkInId`) → `/comunidade` com `state.openCheckIn = checkInId` (abre o drawer do check-in)
  - Notificação de reação em comentário de **post** (tipo 6, `postId`) → `/post/:postId` com `state.openComments = true`
  - Notificação de reação em comentário de **shot** (tipo 6, `shotId`) → `/shots` com `state.openComments = true` e `state.shotId`
  - Notificação de reação em comentário de **flow** (tipo 6, `flowId`) → `/` (feed) com `state.openFlow = flowId` (abre FlowViewerModal). **Se o flow já expirou** (não está mais no ring, > 24h), o `Index.tsx` redireciona para o Arquivo de Flows (`/perfil` com `state.openFlowArchive`) quando o flow é do próprio usuário, ou mostra um toast "não disponível" quando é de outro usuário — ver `docs/01-feed.md` e `docs/08-perfil.md`
  - Notificação de reação em comentário de **check-in** (tipo 6, `checkInId`) → `/comunidade` com `state.openCheckIn = checkInId` (abre drawer do check-in)
  - Notificação de duelo (tipo 4 ou 5) → `/comunidade?tab=requests` (abre aba "Solicitações")
  - Notificação de reação em check-in de duelo (tipo 7) → `/comunidade` com `state.openCheckIn = checkInId` (abre drawer do check-in)
  - Notificação de marcação em post (tipo 9, `postId`) → `/post/:postId` (fallback genérico por `postId` no `handleNotificationClick`); o card mostra a thumbnail do post quando disponível
  - Notificação de mensagem privada (tipo 10) → `/comunidade?user=:senderId` (abre a conversa com o remetente — mesmo deep link usado pelo botão "Mensagem" do perfil)
  - Notificação de check-in em duelo (tipo 11, `checkInId`) → `/comunidade` com `state.openCheckIn = checkInId` (abre o drawer do check-in); sem `checkInId`, cai em `/comunidade?tab=duels`
  - Notificação de curtida (tipo 12) ou expiração (tipo 13) de promoção → `/vitrine` (mesmo destino do tipo 8)
  - Notificação de check-in classificado (tipo 14) ou desclassificado (tipo 15) → `/comunidade` com `state.openCheckIn = checkInId` (abre o check-in avaliado)

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

## Eventos adicionados em 2026-07-13 (mensagem, check-in de duelo, promoções)

| Evento | Tipo | Quem recebe | Onde é inserida | Deduplicação |
|---|---|---|---|---|
| Mensagem privada recebida | 10 | Destinatário da mensagem | `sendMessageDb` (fire-and-forget, não bloqueia o envio) | **Só push — não aparece na lista** (ver seção abaixo). Uma linha (= um push) por mensagem |
| Check-in de um membro do duelo | 11 | Todos os participantes **aceitos** do grupo, exceto o autor | `addGroupCheckInDb` → `sendDuelCheckInNotificationsDb` | Uma linha por participante por check-in |
| Curtida na sua promoção | 12 | Autor da promoção | `togglePromotionLikeDb` (só no "liked") | Uma por (autor, curtidor, promoção) — descurtir e curtir de novo não gera novo push |
| Promoção marcada como expirada | 13 | Autor da promoção | `reportPromotionStatusDb` → `sendPromotionExpiredNotificationDb` | Só no voto que **cruza** o limiar de expirada (≥ 3 votos de status e maioria em "expired", mesmo `majorityExpired` do `Store.tsx`); os votos seguintes não geram novo push |

- **Reuso de colunas:** `post_id` guarda o id do **grupo de duelo** nos tipos 4, 5 e 11, e o id da **promoção** nos tipos 8, 12 e 13. O conjunto `NOTIF_TYPES_WITHOUT_POST` em `ritmofit-db.ts` centraliza isso — sem ele, `getNotificationsDb` trataria esses ids como posts e o card cairia em `/post/:id`.
- **Tipo 13 aponta para quem votou:** `follower_id` guarda o usuário cujo voto fechou a maioria de "Expirou" — é o nome que aparece no card e no push ("{name} marcou sua promoção como expirada"). O dono nunca é notificado do próprio voto.
- **Sem migração de banco:** nenhum tipo novo exigiu coluna nova. É preciso apenas **redeploy** de `send-push-notification` (`supabase functions deploy send-push-notification`).

---

## Conteúdo do Push (`send-push-notification`)

O corpo do push é montado em runtime por `buildBody()`, com os dados reais da notificação — **nunca** um texto fixo por tipo. Antes o push usava um mapa estático e qualquer tipo fora dele caía em "Você tem uma nova notificação no LinKa", que não dizia ao usuário o que tinha acontecido.

| Tipo | Corpo do push | Lookups |
|---|---|---|
| 1 | "{nome} começou a te seguir." | `profiles` |
| 2 | "{nome} te deu \"{incentivo}\" na sua publicação." (usa `incentive_type`; contexto vira "no seu shot"/"no seu flow" conforme `shots_id`/`flow_id`) | `profiles` |
| 3 | "{nome} comentou na sua publicação." (contexto vira "no seu check-in" quando há `duel_check_in_id`) | `profiles` |
| 4 | "{nome} te convidou para o duelo \"{grupo}\"." | `profiles`, `duel_groups` |
| 5 | "{nome} quer entrar no grupo \"{grupo}\"." | `profiles`, `duel_groups` |
| 6 | "{nome} reagiu ao seu comentário." | `profiles` |
| 7 | "{nome} reagiu ao seu check-in." | `profiles` |
| 8 | "{nome} comentou na sua promoção \"{título}\"." | `profiles`, `promotions` |
| 9 | "{nome} marcou você em uma publicação." | `profiles` |
| 10 | "{nome} te enviou uma mensagem." | `profiles` |
| 11 | "{nome} postou um check-in no duelo \"{grupo}\"." | `profiles`, `duel_groups` |
| 12 | "{nome} curtiu sua promoção \"{título}\"." | `profiles`, `promotions` |
| 13 | "{nome} marcou sua promoção \"{título}\" como expirada." | `profiles`, `promotions` |
| 14 | "{nome} classificou seu check-in no duelo." | `profiles` |
| 15 | "{nome} desclassificou seu check-in no duelo." | `profiles` |

- Cada nome livre (apelido, grupo, título) passa por `short()` para o push não virar um parágrafo; quando o lookup não encontra o registro, o texto cai numa variante sem o nome ("{nome} curtiu sua promoção.") em vez de ficar vazio.
- Falha em qualquer lookup **não derruba o push**: `buildBody` é chamada com `.catch()` e volta ao texto genérico.
- **Deep link:** `deepLinkFor` monta a URL por tipo — tipos 3/6/7/11/14/15 **com `duel_check_in_id`** → `/comunidade?checkin=<id>`, tipo 10 → `/comunidade?user=<remetente>`, tipo 11 sem check-in → `/comunidade?group=<grupo>`, tipos 8/12/13 → `/vitrine`, demais → `/notificacoes`.
- ⚠️ **A edge function só muda em produção com redeploy.** Editar o arquivo no repo não basta: enquanto a versão publicada for antiga, o push continua com o texto genérico dela (`supabase functions deploy send-push-notification`).

---

## Banner em primeiro plano (`client/lib/notification-copy.ts`)

Quando a notificação chega com o **app aberto**, quem mostra o banner não é a edge function — é o próprio app, via `LocalNotifications.schedule` no `AppLayout`, disparado pelo Realtime da tabela `notifications`.

> **Fonte única do banner em foreground (2026-07-20):** `capacitor.config.ts` passou a ter `PushNotifications.presentationOptions: []`. Assim o push remoto (APNs) **não** apresenta banner com o app em primeiro plano — só em background/fechado (o `presentationOptions` só rege o foreground). Antes, com `["badge","sound","alert"]`, o push remoto **também** aparecia em foreground, duplicando o banner local do `AppLayout` e, pior, impedindo qualquer supressão por tela. Agora o `AppLayout` é a fonte única de banner em foreground — é ele que decide mostrar ou não. **Exige `npx cap sync ios` + rebuild no Appflow** para o `capacitor.config.json` nativo ser atualizado.
>
> **Mensagem da conversa aberta só vibra (2026-07-20):** o handler do `AppLayout` **suprime o banner** de uma mensagem nova (type 10) quando o remetente é o contato cuja conversa está **aberta na tela** — o usuário já vê a mensagem chegar em tempo real, então o celular apenas **vibra** (o `hapticSuccess` roda antes, para toda notificação). Em qualquer outra tela (feed, perfil…) ou com o app em background, o banner aparece normalmente. A tela aberta é publicada por `client/lib/active-conversation.ts` (`setActiveConversationUserId`, gravado/limpo pela `Community`) e lida no handler via `getActiveConversationUserId()`; a comparação é direta porque a linha type 10 traz o remetente em `follower_id`.

**Correção 2026-07-21:** esse banner tinha um mapa próprio, com título e corpo **só dos tipos 1–7**, e o corpo nem citava quem tinha originado ("Alguém reagiu à sua postagem"). Tudo fora dessa faixa — promoção, mensagem, marcação, check-in de duelo — caía em "Nova notificação 🔔 / Você tem uma nova notificação no LinKa", e o usuário precisava abrir o app para descobrir o que era.

Agora título, corpo e deep link vêm de `client/lib/notification-copy.ts`:

| Export | Papel |
|---|---|
| `notificationTitle(t, type)` | Título por tipo (chaves `notif_title_1` … `notif_title_13`) |
| `notificationBody(t, row, data)` | Corpo com nome real de quem originou — mesmas chaves `notif_desc_*` da lista |
| `fetchNotificationCopyData(row, fallback)` | Busca o apelido (`profiles`) e, nos tipos 4/5/11, o nome do grupo (`duel_groups`) — uma linha por tabela, bem mais barato que recarregar a lista |
| `notificationDeepLink(row)` | Espelha o `deepLinkFor` da edge function; vai em `extra.url` e é usado no toque do banner |

- **Fonte única com a lista:** `buildDescription` da tela delega para `notificationBody`. O único caso que a tela trata por conta própria é o **agrupado**, que não existe no push: vários incentivos na mesma publicação (`notif_desc_incentive_multi`).
- **Os dois caminhos são independentes:** a edge function (Deno) não enxerga o `i18n.ts`. Ao mudar texto de um lado, espelhe no outro — o comentário no topo dos dois arquivos registra isso.
- **Idioma:** o efeito das subscriptions roda uma vez (`[]`), então `t` é lido de uma **ref** (`tRef`) — capturado direto, o banner ficaria congelado no idioma ativo na montagem do layout.
- **Chaves removidas:** `notif_body_1`…`notif_body_7` e `notif_title_post_tag` saíram do `i18n.ts` — eram os textos genéricos ("Alguém comentou na sua postagem"), sem uso depois da mudança.

---

## Comentário em check-in gravava o tipo errado (corrigido em 2026-07-21)

`addCheckInCommentDb` inseria **tipo 6** (`"{nome} reagiu ao seu comentário"`) ao comentar num check-in de duelo. Quem recebia o comentário lia um evento que não tinha acontecido — e a linha ficava **indistinguível** da reação de verdade, que `toggleCommentReactionDb` grava com a mesma forma (tipo 6 + `duel_check_in_id`).

Agora a inserção é **tipo 3 + `duel_check_in_id`**, e o contexto do texto passou a reconhecer check-in:

| Origem | Linha gravada | Texto |
|---|---|---|
| Comentou no check-in (`addCheckInCommentDb`) | tipo **3** + `duel_check_in_id` | "{nome} comentou no seu check-in" |
| Reagiu a um comentário do check-in (`toggleCommentReactionDb`) | tipo 6 + `duel_check_in_id` | "{nome} reagiu ao seu comentário" |
| Reagiu ao check-in inteiro (`sendCheckInReactionNotificationDb`) | tipo 7 + `duel_check_in_id` | "{nome} reagiu ao seu check-in" |

- **Contexto novo:** `notif_context_checkin` ("no seu check-in" / "on your check-in"); `contextKey()` em `notification-copy.ts` e o `context` da edge function passam a olhar `duel_check_in_id` (e o prefixo legado `checkin:` em `shots_id`) antes de shot/flow/post.
- **Deep link `?checkin=<id>`:** a `Community.tsx` ganhou suporte ao query param, porque um push é só uma URL e não carrega o `state` do router. A lógica de abrir o check-in virou `openCheckInById()`, usada pelos dois caminhos (state interno e query param).
- **Tipo 7 passou a abrir o check-in** ao tocar no card — a doc já dizia isso, mas o código caía em `/comunidade?tab=duels`.
- **Linhas antigas continuam erradas:** as notificações de comentário já gravadas como tipo 6 não têm como ser distinguidas das reações reais, então não há migração — elas seguem exibindo "reagiu ao seu comentário" até serem limpas pelo usuário.

---

## Avaliação de check-in — tipos 14 e 15 (2026-07-21)

Em grupos de duelo do modo **memes**, cada check-in passa pela aprovação dos outros participantes (botões **Classificar** / **Desclassificar**, tabela `duel_check_in_votes` — ver `docs/07-comunidade.md`). Quem postava o check-in não era avisado do resultado: precisava voltar ao grupo e reparar no selo "Anulado".

| Voto | Notificação | Texto |
|---|---|---|
| `classify` | **type 14** + `duel_check_in_id` | "{nome} classificou seu check-in no duelo" |
| `disqualify` | **type 15** + `duel_check_in_id` | "{nome} desclassificou seu check-in no duelo" |
| voto desfeito | — | a notificação daquele votante é **apagada** |

**Migração obrigatória:** `docs/migrations/20260721-checkin-vote-notifications.sql` (cria `notify_check_in_vote()` / `notify_check_in_vote_removed()` e as triggers em `duel_check_in_votes`). **Sem rodá-la, nada acontece** — a notificação não é inserida por código do cliente.

- **Por que trigger `SECURITY DEFINER`, e não insert do cliente:** a RLS de `notifications` dá SELECT/DELETE apenas ao destinatário. O votante **não enxerga** as notificações de quem recebeu o voto, então nenhuma checagem de duplicata feita no cliente funcionaria — o `SELECT` volta vazio e o insert se repetiria a cada troca de voto. A função, rodando como definer, apaga a avaliação anterior daquele votante naquele check-in antes de gravar a nova: **um votante = no máximo uma notificação viva**, trocar de voto reescreve e desfazer remove.
- ⚠️ **Mesma armadilha em `sendCheckInReactionNotificationDb`** (type 7 — "só notifica uma vez por reator"): o `SELECT` de dedup lê `notifications` do **destinatário**, que sob RLS sempre volta vazio. É no-op silencioso — na prática duplica. Não corrigido; a correção passa pelo mesmo caminho (trigger ou RPC `SECURITY DEFINER`). O mesmo problema existia no type 10 e foi resolvido removendo o dedup (ver seção seguinte).
- **Um card por votante**, sem agrupamento: em duelos os participantes são poucos e saber **quem** aprovou é o ponto da modalidade. Se um dia virar barulho, o lugar de colapsar é `collapseIncentives` (por `checkInId`) e `getUnreadNotificationsCountDb`, que precisam usar a mesma chave.
- **Push:** título "Check-in classificado ✅" / "Check-in desclassificado ⛔", corpo com o nome de quem votou, deep link `?checkin=<id>`. Exige o redeploy da edge function.

---

## Mensagem privada é push-only (type 10, 2026-07-21)

O card "{nome} te enviou {n} mensagens" **saiu da tela**. Uma conversa em ritmo de bate-papo enchia a lista de notificações de mensagem e empurrava para baixo justamente o que o usuário abre a tela para ver. A mensagem continua avisando — **no push do iPhone**, que é onde ela faz sentido.

| Onde | Antes | Agora |
|---|---|---|
| Push no iPhone | sim | **sim** (inalterado) |
| Card na tela de Notificações | sim, colapsado por remetente | **não** |
| Badge do sino | contava | **não conta** |
| Badge da Comunidade | contava | conta (inalterado — lê a tabela `messages`) |

**Como:** a linha `type: 10` **continua sendo gravada** — é ela que dispara o webhook `notify-push-on-notification` → edge function → APNs, e não há como pedir o push sem gravá-la (o segredo do webhook não pode viver no cliente). O que mudou é a **leitura**: `getNotificationsDb()` e `getUnreadNotificationsCountDb()` filtram com `.neq("type", NOTIF_TYPE_PUSH_ONLY)`.

- **Consequência a conhecer:** as linhas tipo 10 seguem acumulando na tabela, invisíveis. São apagadas junto com o resto no botão "Limpar" (`clearNotificationsDb` não filtra por tipo). Se um dia isso incomodar, o lugar de podar é um job/cron, não a leitura.
- **Um push por mensagem, de propósito:** a janela de dedup de 60s foi **removida** de `sendMessageNotificationDb`. Ela nunca funcionou (o `SELECT` sob RLS volta vazio — ver seção anterior) e o que ela protegia era justamente a lista, que não mostra mais esses cards. Um push por mensagem é o comportamento normal de um mensageiro, e o iOS agrupa os banners por remetente.
- **O que continua existindo para o tipo 10:** o texto no `notification-copy.ts` (o push e o banner em primeiro plano precisam dele), o deep link `/comunidade?user=<remetente>` e os mapeamentos de ícone/cor na tela. Estes últimos ficaram como rede de segurança — se o filtro de leitura for removido, os cards voltam a renderizar corretamente em vez de cair no ícone genérico.
- **Removido:** a chave `notif_desc_message_multi` e o agrupamento por remetente em `collapseIncentives` / `getUnreadNotificationsCountDb`.

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

- **Descrição renderizada em JSX, nunca em HTML (2026-07-13 — correção de segurança):** o apelido é destacado por `renderDescription()`, que fatia a string e envolve o nome num `<strong>` **em JSX**. Antes usava `dangerouslySetInnerHTML` com o apelido interpolado: como o apelido é campo livre do usuário, qualquer markup nele (ex.: `<img onerror=…>`) era injetado e executado na WebView de **todo mundo que recebesse uma notificação daquele usuário**. Nunca reintroduzir `dangerouslySetInnerHTML` aqui
- **Card é `div[role="button"]`, não `<button>` (2026-07-13):** a notificação de novo seguidor contém um `FollowButton` **real** (o mesmo componente de todas as telas) — e `button` dentro de `button` é HTML inválido. Antes o "Seguir" era um `<span>` estilizado: parecia clicável, mas o toque era engolido pelo card e apenas navegava ao perfil. O `FollowButton` fica dentro de um `span` com `stopPropagation`
- **Voltar usa `navigate(-1)` (2026-07-13):** volta para a tela anterior de verdade (ex.: Perfil), caindo em `/` só quando não há histórico (deep link / push). Antes era `navigate("/")` fixo, que jogava todo mundo no feed
- **Sem strings hardcoded:** títulos, toasts, o rótulo "agora" e o locale de data (`toLocaleDateString`) passam por `t()`/`language`. A tela tinha português cravado no código, quebrando em inglês
- **Pull-to-refresh por refs:** mesmo padrão de `Index.tsx`/`Profile.tsx` — o gesto escreve altura/rotação direto no DOM, sem `setState` por `touchmove` (que re-renderizava a lista inteira a ~60fps durante o arrasto)
- **`markNotificationsAsReadDb()` / `clearNotificationsDb()` só invalidavam o cache em código morto (2026-07-21 — correção):** as duas chamadas de `invalidateQueryCache` estavam **depois** dos `return` da função, então nunca executavam. Resultado: o banco ficava com tudo lido, mas `getUnreadNotificationsCountDb()` continuava servindo a contagem antiga do cache — e como o cache é **persistido** (stale-while-revalidate de até 24 h), o sinalizador de pendência voltava a aparecer ao sair da tela e até no relaunch do app. Regra do projeto: `invalidateQueryCache` **sempre antes** do `return`
- O canal Realtime é cancelado no unmount (`channel?.unsubscribe()`) para evitar memory leak
- A contagem de não lidas no badge da navegação (AppLayout) é gerenciada separadamente com sua própria subscription — que **ignora atualizações enquanto o usuário está em `/notificacoes`**, já que a tela marca como lida tudo que chega ali
- Notificações de posts regulares (incentivo/comentário) são inseridas pelo **trigger do banco** — o código cliente não insere manualmente para evitar duplicação
- **Agrupamento de incentivos:** notificações do tipo 2 (incentivo) para o mesmo `postId`/`shotId` são colapsadas em uma entrada única via `collapseIncentives()`, independente do tipo de incentivo ou do remetente. O campo `groupedUsers` rastreia cada usuário com seus respectivos tipos enviados. A label exibida segue o padrão `"UsuarioX te deu "Vencedor" e outras N reações na sua postagem"`, onde N = total de reações do grupo menos 1. Com apenas 1 reação, exibe a descrição padrão sem agrupamento.
- **Contador do badge de notificações:** `getUnreadNotificationsCountDb()` aplica a mesma lógica de agrupamento: notificações de incentivo (tipo 2) para o mesmo `post_id`/`shots_id` são contadas como **1**, refletindo exatamente o número de itens que o usuário verá na lista.
- **Convite de duelo via modal de Participantes:** `addMembersToGroupDb` agora envia notificações tipo 4 para os novos membros adicionados (mesmo comportamento de `createDuelGroupDb`)
- Notificações de shots (incentivos) são inseridas pelo cliente com `post_id: shotId` (comportamento legado). Notificações de comentário em shots usam `shots_id: shotId` (corrigido). O `NotificationItem` expõe `shotId` quando `shots_id` está presente. O `getNotificationsDb` lê `shots_id` do select e popula `shotId` no retorno
- **Reações a comentários (tipo 6):** inseridas pelo cliente em `toggleCommentReactionDb`. Para flows usa o campo `flow_id` (uuid). Para check-ins de comentário usa `duel_check_in_id` (uuid). Para shots usa `shots_id`. Para posts usa `post_id`. Suporte legado a prefixos `flow:` e `checkin:` em `shots_id` mantido para notificações antigas.
- **Reações a check-ins de duelo (tipo 7):** inseridas em `sendCheckInReactionNotificationDb` usando o campo `duel_check_in_id`. Deduplicadas por `(user_id, follower_id, type, duel_check_in_id)`.
- O `PostCommentsDialog` usa `useRef` para garantir que `defaultOpen` abre o drawer apenas uma vez (evita dupla abertura por re-render do React.lazy/Suspense)
- O `PostDetail` usa `useRef` para garantir que o `PostLikesModal` seja aberto apenas uma vez ao navegar de uma notificação
