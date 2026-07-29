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

> **Header e tabs são sempre visíveis (2026-07-21).** Até 21/07 a barra de abas se retraía ao rolar para baixo (e o header do `AppLayout` junto, via `data-community-scroll-container`), com o container da tela subindo `-64px` para ocupar o espaço liberado. Foi **removido por atrapalhar a usabilidade**: as abas são a navegação principal daqui e sumiam justo na hora de trocar de aba, e o vaivém do header disparava em situações que não eram scroll deliberado (troca de aba, abrir/fechar conversa — cada aba tem seu próprio container rolável). O container agora tem altura fixa (`100dvh - 64px - safe areas - bottom nav`) e a barra de abas é estática. Ver `docs/13-layouts-e-componentes.md` → "Header flutuante — auto-ocultar ao rolar".

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
| Botão excluir | Ícone `Trash2` sobre fundo vermelho — **revelado por swipe** da direita para a esquerda na linha (padrão iOS); abre AlertDialog de confirmação |

> **Swipe-to-delete (2026-06-27):** Cada linha de conversa é envolvida pelo componente `SwipeableConversationRow` (`client/components/community/`). Arrastar a linha da direita para a esquerda desliza o conteúdo e revela um botão de lixeira com fundo vermelho (`#ef4444`, largura 76px). O gesto tem trava de direção (ignora rolagem vertical), resistência ao passar do limite e animação de snap (abre/fecha) ao soltar. Tocar na linha enquanto aberta apenas fecha o swipe; tocar na lixeira abre o AlertDialog de confirmação. Substitui o antigo botão baseado em `hover`, que não funcionava no toque (alvo iOS).
>
> **(2026-07-17 — correção)** O "toque na linha aberta fecha o swipe" (`onClickCapture` → `stopPropagation` + `close`) precisa envolver **só o conteúdo da linha**, nunca o wrapper que também contém o botão de lixeira. Enquanto ele ficou no wrapper (ancestral de ambos), com a linha aberta o `stopPropagation` da fase de captura engolia o `onClick` do botão — tocar na lixeira apenas fechava o swipe e nunca disparava `onDelete`/abria o diálogo. Agora o handler de captura vive no `div` do conteúdo, irmão do botão.

Ao clicar na linha → entra na conversa (viewMode: `conversation`)
Ao tocar no botão excluir revelado → soft-delete do histórico apenas para o usuário logado (`deleteConversationForMeDb`); o outro participante continua vendo as mensagens normalmente

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
| **Dias** (dias restantes) | Abre modal de Detalhes do Grupo (mesmo destino da pill **Detalhes**) |

### Drawer de Classificações

| Elemento | Ação ao clicar |
|---|---|
| **Nome do participante** | Abre o `MemberCheckInsDrawer` com o calendário de check-ins dele no grupo |

### Modal de Detalhes do Grupo

Exibe:
- Nome do grupo
- Local (UF)
- Objetivo
- **Modalidade** (`scoringType`) — ícone + nome do sistema de pontuação do grupo (Contagem de check-in, Dias ativos, Pontos de hustle, Duração, Distância, Passos, Calorias ou Memes). Mesmo catálogo de opções usado no wizard de criação (Passo 4 — Sistema de Pontuação)
- Regra do desafio (somente quando `scoringType === "memes"`; em leitura, só aparece se `memeRule` estiver definido)
- **Data de início** (`createdAt`)
- **Data de encerramento** (`endDate` — "Sem prazo" se não definido)
- Botão de sair / apagar grupo (conforme papel do usuário)

**Edição (somente criador):**
- Botão "Editar" no cabeçalho do modal (visível apenas para o criador)
- Ao clicar, tornam-se editáveis: **Nome** (Input), **Objetivo** (Textarea) e — só em grupos de memes — a **Regra do desafio** (Textarea, `maxLength` 200, com o mesmo texto de apoio do wizard)
- Botões "Cancelar" e "Salvar" aparecem no lugar dos botões de ação
- Ao salvar → `updateGroupInfoDb(groupId, name, goal, memeRule?)` — atualiza tabela `duel_groups`
- Estado local do grupo (`selectedGroupForView` e `userCreatedGroups`) é atualizado imediatamente sem reload

> **Regra do desafio na edição (2026-07-16):** o campo só aparece quando `scoringType === "memes"` — nas outras modalidades a regra não existe. Diferente do modo leitura, ele aparece **mesmo sem regra salva**, para o criador poder preencher depois. Salvar espelha a validação do wizard: memes sem regra é bloqueado com toast, porque é a regra que justifica classificar/desclassificar um check-in.
>
> `updateGroupInfoDb` recebe `memeRule` **opcional**: `undefined` (grupo de outra modalidade) não encosta na coluna `meme_rule`, evitando zerá-la sem querer; string vazia limpa. A modalidade em si segue não editável — trocá-la recalcularia o placar retroativamente.

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
- **(2026-07-13 — segurança)** Fotos e áudios de DM vão para o bucket **privado** `chat-media`, no caminho `{idA}_{idB}/{uuid}.{ext}` (os dois uuids da conversa, ordenados). Antes iam para o bucket **público** `posts` (`posts/message-images/`, `posts/message-audio/`), com URL pública permanente e caminho previsível — ou seja, mídia de conversa privada era efetivamente pública para quem tivesse o link. A RLS de `storage.objects` só libera leitura/escrita para quem é uma das duas pontas da conversa (`docs/migrations/20260713-security-hardening.sql`).
- O texto da mensagem passa a guardar `chat:<path>` em vez da URL. Quem resolve para uma URL exibível é `getChatMediaUrlDb()` (`ritmofit-db.ts`), que assina uma **signed URL de 1 h** (com cache em memória e renovação automática ao expirar). Mensagens antigas guardam a URL pública completa e continuam funcionando — o resolver detecta o formato e devolve o valor como está.
- Renderização: `ChatImageMessage` / `ChatAudioMessage` (`client/components/community/chat-media.tsx`) resolvem a URL em efeito e mostram um placeholder pulsante enquanto a assinatura não chega. **(2026-07-17)** Se a signed URL já está no cache em memória, `peekChatMediaUrl()` a devolve de forma síncrona e ela entra direto no estado inicial do `useChatMediaUrl` — a bolha nasce com a mídia, sem passar pelo placeholder. O placeholder ficou só para o que é realmente inédito.
- Mensagens de imagem: prefixo `[image]:` → renderizadas como `<img>` clicável. Ao tocar, abre um **visualizador fullscreen in-app** (overlay preto via portal, botão de fechar e fechar ao tocar fora) — a URL do Supabase Storage **não** é exposta ao usuário (não usa mais o `Browser` do Capacitor)
- Mensagens de áudio: prefixo `[audio]:` → renderizadas como player `<audio controls>` com `preload="auto"` (pré-carrega o arquivo assim que a bolha monta, para que a reprodução comece instantaneamente ao tocar play, sem o atraso de buffering do `preload="metadata"`); gravação usa MediaRecorder API priorizando **MP4/AAC** (`audio/mp4;codecs=mp4a.40.2` → `audio/mp4` → `audio/aac`), com WebM/Opus apenas como fallback — MP4/AAC é reproduzível nativamente no WebView do iOS (alvo do app), evitando atraso/falha que o WebM causa no iOS; upload para `posts/message-audio/` no Supabase Storage (extensão `.mp4`/`.webm` conforme o tipo do blob)
- Permissão de microfone já declarada no `Info.plist` iOS (`NSMicrophoneUsageDescription`)
- **Posts/Shots compartilhados (2026-07-12):** prefixos `[post]:<postId>` e `[shot]:<shotId>` → renderizados como **card rico clicável** (`SharedContentMessage` em `components/community/`): avatar + nome do autor, thumbnail (foto do post ou frame do vídeo do shot com ícone play), descrição truncada em 2 linhas e rótulo "Ver post"/"Ver shot". Tocar navega para `/post/:id` ou `/shots` (com `state.shotId` para scroll direto ao shot). Conteúdo apagado exibe estado "Conteúdo indisponível" (estilo Instagram). O envio parte do `SendToFriendDrawer` (ver `docs/13-layouts-e-componentes.md`)
- Em previews (última mensagem na lista de conversas, citação de reply e banner de resposta), mensagens especiais exibem rótulo curto traduzido em vez do texto bruto: `🎤 Áudio`, `🖼️ Imagem`, `📤 Post`, `🎬 Shot` (helper `specialMessageLabel` em `community-helpers.ts`)
- **(2026-07-20)** O preview da **última mensagem na lista de conversas** usa o helper `conversationPreviewText` (`community-helpers.ts`): quando a última mensagem é uma **resposta** (`↩ <original>\n\n<nova>`), mostra a resposta (o texto novo digitado) precedida de `↩`, em vez do texto cru. Antes, o `specialMessageLabel` recebia a string inteira começando com `↩ `, não casava o prefixo `[audio]:`/`[image]:`… e caía no fallback cru — a lista exibia coisas como `↩ [audio]:https://…supabase.co/…` quando alguém respondia a um áudio/imagem. Se a própria resposta for especial, o rótulo curto é aplicado ao corpo. Mensagens especiais soltas (não-reply) continuam com o rótulo via `specialMessageLabel`. A citação dentro da bolha e o banner de resposta já tratavam o caso (aplicam `specialMessageLabel` ao original citado), então mostram `🎤 Áudio` corretamente.

**Realtime:**
- Novas mensagens aparecem em tempo real via Supabase Realtime (canal `messages-{userId}`, evento `INSERT` na tabela `messages`)
- Auto-scroll para última mensagem
- Marca mensagens como lidas ao abrir a conversa (`markMessagesAsReadDb`) e ao receber mensagem em tempo real

> **Teclado iOS levanta a conversa (2026-07-17):** A conversa individual é um portal `fixed` próprio (montado em `document.body`), então **não** é um drawer (vaul) nem dialog (radix) e **não herda** o lift automático do `--keyboard-height` que `drawer.tsx`/`dialog.tsx` aplicam. Antes, quando o teclado do iOS abria, ele apenas sobrepunha o webview (Keyboard `resize:'none'`) e a barra de input ficava escondida atrás dele — o usuário não via o que digitava. Correção: o container da conversa usa `bottom: var(--keyboard-height, 0px)` (com `transition: bottom 0.25s`) — subir o `bottom` pela altura do teclado encolhe a conversa a partir de baixo, deixando a barra de input logo acima do teclado e a lista rolando na área restante (comportamento do WhatsApp). O `paddingBottom` das barras de input passou a ser `max(0.85rem, calc(env(safe-area-inset-bottom) - var(--keyboard-height)))`, para não sobrar o vão do home indicator acima do teclado quando ele está aberto. Um efeito assina `subscribeKeyboardHeight` (`client/lib/keyboard.ts`) e re-fixa a rolagem no fim (re-snaps em 0/120/280ms) sempre que o teclado abre/fecha, para a última mensagem continuar visível enquanto a área muda de altura. Fora do nativo (browser) o tracker é no-op → `--keyboard-height` fica 0 e nada muda.

> **Auto-scroll para a última mensagem (2026-07-02, revisto em 2026-07-17):** Ao abrir/reabrir uma conversa, a tela sempre inicia posicionada na última mensagem (enviada ou recebida) — sem animação (`scrollIntoView({ behavior: "auto" })`), evitando o efeito de "rolagem visível" desde o topo. Como imagens/áudio da conversa podem carregar de forma assíncrona e alterar a altura do conteúdo após o primeiro paint, o scroll inicial é reforçado com dois re-snaps (150ms e 400ms) para garantir que a tela permaneça no fim mesmo após esses ajustes de layout. Mensagens novas (enviadas ou recebidas via realtime) continuam usando `behavior: "smooth"`.
>
> O que decide entre snap e rolagem suave é o ref `isOpeningConversationRef` (que substituiu `hasScrolledForConversationRef`): ele marca a **fase de abertura** da conversa — vale `true` desde a troca de `selectedConversation.userId` até a busca da rede assentar (flip num `requestAnimationFrame`, no `finally`, para cobrir também o caso de erro). Enquanto está `true`, *qualquer* mudança na lista reposiciona no fim sem animação — é o que faz a semente e a versão da rede entrarem sem rolagem visível. Um flag `cancelled` no cleanup do efeito impede que a carga de uma conversa abandonada encerre a fase de abertura da conversa aberta depois dela.

> **Abertura instantânea da conversa (2026-07-17):** Entrar numa mensagem privada dava a sensação de travar e "recarregar" toda vez. Eram três causas somadas, corrigidas juntas:
>
> 1. **A conversa abria vazia.** O efeito de carga fazia `setMessages([])` e só então ia à rede — tela em branco até a query voltar. Agora existe uma **semente de first paint**: `getConversationMessagesDb` grava as últimas 60 mensagens em `lk:q:chatMessages:{viewerId}:{otherId}` (mesmo prefixo do cache de queries, então sign-out/troca de usuário já purga junto), e a tela lê essa semente de forma **síncrona** com `peekConversationMessages()` ao abrir. A conversa nasce pintada e no fim. **A semente não substitui a rede** — `getConversationMessagesDb` é sempre chamada; ela só evita o branco enquanto a resposta não chega. A tela mantém a semente em dia (`cacheConversationMessages()`) sempre que `messages` muda, para cobrir enviadas/recebidas via realtime/apagadas.
> 2. **A lista inteira remontava ao voltar da rede.** Mesmo quando o servidor devolvia exatamente o que já estava na tela, o array novo re-renderizava todas as bolhas. `sameMessageList()` (em `community-helpers.ts`) compara id/texto/lido/emoji e, se nada mudou, mantém o array anterior — sem re-render.
> 3. **As bolhas de mídia piscavam placeholder.** `useChatMediaUrl` (`chat-media.tsx`) começava com `url = null` e resolvia em efeito, mesmo com a signed URL já em memória — placeholder → imagem a cada remontagem, e a troca ainda mudava a altura da bolha e empurrava a rolagem. Agora `peekChatMediaUrl()` (leitura **síncrona** do `signedUrlCache`) alimenta o estado inicial: com URL válida em cache, a bolha nasce com a mídia.
>
> Além disso, `getConversationMessagesDb` buscava os dois perfis **depois** das mensagens (waterfall de duas idas à rede); agora os três vão no mesmo `Promise.all` — os perfis não dependem das mensagens. Na prática o custo costuma ser zero (`getUserProfileDb` é cacheado), mas no cold start economiza uma ida.
>
> **Semente × exclusão de histórico:** a semente persiste no `localStorage`, então **excluir o histórico precisa apagá-la também** — senão ela repinta as mensagens "apagadas" na próxima abertura da conversa (o histórico é soft-deletado, a rede volta vazia, mas a semente entrava antes). `deleteConversationForMeDb` chama `clearConversationSeed(otherUserId, viewerId)` após o soft-delete. Exclusão de **uma** mensagem (dentro da conversa aberta) não precisa disso: a tela atualiza `messages` e o efeito de sincronia reescreve a semente já sem a mensagem.

**Long Press / Segurar Mensagem:**
- Segurar (touch 450ms) ou clique com botão direito abre um overlay de ações no estilo Instagram
- O overlay exibe preview da mensagem, 6 emojis rápidos (❤️ 😂 😮 😢 😡 👍) e as seguintes ações:
  - **Responder** — sempre disponível para qualquer mensagem
  - **Apagar para mim** — sempre disponível (mensagem própria ou do outro usuário); soft-delete que oculta a mensagem somente para o usuário logado (`deleteMessageForMeDb`)
  - **Apagar para todos** — visível apenas para mensagens **próprias** enviadas há menos de 10 minutos; hard-delete permanente que remove para ambos os participantes (`deleteMessagePermanentlyDb`)
  - **(2026-07-17)** Uma mensagem **enviada** com menos de 10 min oferece as **duas** opções ("Apagar para mim" e "Apagar para todos"); com mais de 10 min, oferece só "Apagar para mim". Antes, a mensagem própria só mostrava "Apagar mensagem" (para todos) na janela de 10 min e ficava sem nenhuma opção depois. O limite de 10 min do "para todos" foi mantido. Todas as strings do overlay/diálogo agora usam `t()` (chaves `community_msg_*`).
- **Responder mensagem:** seleciona a mensagem como contexto de reply; um banner aparece acima do input mostrando o texto original com botão "X" para cancelar
- A mensagem enviada como reply é prefixada com `↩ <texto original>\n\n<nova mensagem>` no banco
- **(2026-07-20)** A resposta vale para **todos os tipos de envio**, não só texto: com uma mensagem marcada, enviar **foto** ou **áudio** também cita aquela mensagem. Os três envios (`handleSendMessage`, `handlePhotoSend`, `stopRecordingAndSend`) montam o prefixo pelo helper compartilhado `buildReplyPrefix` (`community-helpers.ts`) e limpam o `replyingTo` após enviar. O texto guardado fica `↩ <original>\n\n[audio]:<ref>` (ou `[image]:<ref>`) — a bolha já extrai o `mainText` depois do prefixo e é ele que decide renderizar o player/imagem, então a citação aparece acima da mídia sem mudança no render. O helper também **normaliza citação aninhada**: ao responder uma mensagem que já é resposta, cita só o conteúdo próprio dela — antes, o `↩` empilhava e o parser (que corta no primeiro `\n\n`) embaralhava citação e corpo.
- **(2026-07-20 — correção)** O `replyingTo` é limpo (`setReplyingTo(null)`) ao (re)entrar em qualquer conversa, no mesmo efeito de carga keyed em `selectedConversation.userId`. Antes, marcar uma resposta na conversa de X e sair para a de Y sem enviar deixava o banner de reply (e o prefixo `↩` no próximo envio) vazar para a conversa de Y — o estado é global do componente e não pertencia mais à conversa aberta.

> **Arrastar para responder (2026-07-17):** Além do long-press → "Responder", cada bolha pode ser **arrastada para a direita para responder** àquela mensagem específica — padrão WhatsApp. Componente: `SwipeableMessageBubble` (`client/components/community/swipeable-message-bubble.tsx`), que envolve a bolha + o badge de emoji e os translada em bloco. Um ícone de reply (Lucide `Reply`) surge no vão que se abre à esquerda da bolha, com opacidade/escala proporcionais ao arrasto; ao passar do gatilho (`REPLY_TRIGGER = 52px`, limite visual `MAX_DRAG = 76px`) e soltar, dispara `handleReplyToMessage(message)` — ou seja, seleciona **aquela** mensagem como contexto, mesmo que seja a 2ª de uma sequência. Cruzar o gatilho dá um toque de haptics (`hapticLight`). O gesto é só para a direita (à esquerda fica travado em 0) e tem trava de direção: um arrasto vertical deixa a lista rolar normalmente. O **long-press convive** no mesmo componente (timer de 450ms iniciado no touchstart e cancelado a qualquer movimento), então segurar ainda abre o overlay de ações e clicar com o botão direito (`onContextMenu`) também. O container de mensagens ganhou `overflow-x-hidden` para clipar o excedente do arrasto (a bolha própria já fica colada na borda direita) sem afetar a rolagem vertical.
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
   - **Card hero** (primeiro grupo) — banner de foto/cor no topo (110px), badge de papel ("Seu grupo" / "Participante"), badge de dias restantes, nome, contagem de participantes + cidade, botão branco "Ver Grupo" (ação: abre a tela do grupo via `openGroupView`)
   - **Cards compactos** (demais grupos) — ícone/foto quadrado (50×50, border-radius 16px), nome, participantes, cidade, dias restantes, chevron para navegar

3. **Da comunidade** — grupos disponíveis para entrar (lista simples):
   - Ícone/foto, nome, contagem + nome do criador, botão "Entrar" / "Ver Grupo" / "⏳ Pendente"
   - Ao clicar "Entrar" → `addMembersToGroupDb` + notificação ao criador; estado muda para "Pendente"

4. **Empty state** — ícone `Swords` com mensagem central quando não há grupos

---

### Tela do Grupo / Check-ins (paleta do sistema + liquid glass — 2026-07-13)

Aberta via `openGroupView` (botão "Ver Grupo" da lista). Renderizada em portal fullscreen. Toda string usa `t()` (chaves `duels_group_*`).

**Paleta e fontes (definidas via CSS custom properties no container do portal):**
- **2026-07-13 — a tela deixou de ter paleta própria.** O redesign de 2026-07-04 trouxe um roxo saturado (`#0d0a17` de fundo, superfícies opacas arroxeadas `#171128`/`#221a38`, accents `#7c3aed`/`#a855f7`) que **não existe na paleta da marca** e destoava do resto do app. Agora a tela usa os tokens do sistema + vidro:
- **Fundo:** `hsl(var(--background))` (token da página) + aura da marca pintada como `radial-gradient` direto no `background` — nunca um `div` com `filter: blur` (design system §0.3).
- **Superfícies:** todo card/pill/botão de superfície usa **`GLASS_CARD_STYLE`** (`client/lib/glass-styles.ts`) — vidro translúcido com `backdrop-filter`. Não há mais `--surface` opaco.
- **Accents:** `--accent:#5b8cff` (brand blue) · `--accent2:#9d6bff` (brand purple, o roxo real da marca) · `--surface2:rgba(255,255,255,.08)` (tiles) · `--line:rgba(255,255,255,.10)` · `--muted:rgba(255,255,255,.55)` (texto de apoio neutro, sem tint roxo).
- **Superfícies de destaque** (card "Seu ranking", pill ativa das tabs, FAB) usam o gradiente da marca via **`GLASS_PRIMARY_BTN_STYLE`** (`#5b8cff → #9d6bff`) — o mesmo do CTA "Criar um duelo", o que alinha a tela do grupo com a lista de duelos.
- **Fontes:** `Manrope` (corpo, aplicada no container) e `Space Grotesk` (números de destaque, título do hero, label "Grupo"). Ambas importadas junto com Inter em `client/global.css`.

**Estrutura:**
- **Header** — 3 partes: botão `ArrowLeft` em quadrado de vidro (`GLASS_CARD_STYLE`, `rounded-[11px]`), label central "Grupo" (`Space Grotesk`, `--muted`) e um **espaçador `h-9 w-9`** à direita. O espaçador não é decorativo: ele equilibra o botão de voltar para o label ficar centrado de verdade — não remover. Respeita `env(safe-area-inset-top)`.
- **Hero card** — cartão compacto (`h-[130px]`, `rounded-[22px]`, margem lateral `px-5`) com a foto de capa (ou ícone centralizado sem foto), scrim escuro na base e nome do grupo em `Space Grotesk` 24px. Sem foto, o fundo é um gradiente translúcido da marca (azul → roxo) com borda de vidro.
- **Botão de trocar capa (2026-07-16)** — `Edit3` num quadrado de 36px no **canto superior direito do próprio hero card** (`absolute top-[10px] right-[10px]`), só para o criador; o `<input type="file">` escondido vive junto dele. Ficava no header até 16/07 — foi movido para dentro do frame, onde a ação se aplica.
- **Enquadramento da capa (2026-07-16)** — escolher a foto **não sobe na hora**: entra em *modo de ajuste* no próprio hero (`InlineCropPreview`, pinch + arraste), com dica e botões **Cancelar / Salvar** abaixo do card. Só ao Salvar o recorte é aplicado (`applyTransformToBlob`) e enviado. No modo de ajuste, scrim, título e botão de editar são ocultados — o frame mostra o recorte cru, que é exatamente o que vai subir. Ao salvar, a URL remota é pré-carregada antes da troca (sem piscada). `openGroupView` limpa `coverCropSrc`, senão um ajuste abandonado reabriria no grupo seguinte.
  - O mesmo enquadramento existe no **Passo 1 do wizard**, no frame de preview da capa — lá o recorte é aplicado no upload que roda logo após criar o grupo. As refs de medida sobrevivem ao passo desmontar; se nunca mediram (largura 0), sobe o arquivo original como fallback.
  - **Por que não precisou de tela de crop separada:** o `InlineCropPreview` já fazia zoom/pan no próprio frame — só precisou aceitar frames não-quadrados (ver `docs/13`).
  - **Fundo próprio (`rgba(0,0,0,.42)` + blur), não `GLASS_CARD_STYLE`:** o scrim do hero é um gradiente que só escurece a **base** do card; no topo a foto aparece crua, e o vidro claro sumiria em capas claras. Não trocar pelo `GLASS_CARD_STYLE` dos botões do header, que vivem sobre o fundo escuro da página.
  - Aparece **também quando o grupo não tem capa** (estado de ícone) — é justamente quando mais se quer definir uma.
- **Grade de estatísticas assimétrica** — grid 2 colunas: **card grande "Seu ranking"** (`row-span-2`, gradiente da marca via `GLASS_PRIMARY_BTN_STYLE`) com `#{posição}` em 38px; à direita, dois cartões de vidro (`GLASS_CARD_STYLE`) empilhados: **Líder** (pontuação + "{nome} · líder") e **Dias restantes** (nº + label). Números em `Space Grotesk`/`--accent2`. Clicáveis (ver tabela abaixo): ranking e líder → Classificações; dias → Detalhes.
- **Pills segmentadas de atalho** — container de vidro `rounded-[15px]` com 3 botões **visualmente idênticos**, todos abrindo drawers: **Detalhes** (→ Detalhes do Grupo), **Participantes** (→ drawer de participantes) e **Ranking** (→ Classificações). O bottom nav do mock original foi removido por redundância.

> **Não é um tab bar (2026-07-16), apesar do formato segmentado.** Os três são botões que **abrem drawers** — nenhum troca o conteúdo da tela, que é sempre o histórico.
>
> **Nenhum leva destaque, e isso é deliberado:** os três são atalhos equivalentes, então pintar um sugeriria "você está aqui", que é falso. Destacar a pill tocada também não resolveria — seria invisível, já que o drawer sobe cobrindo as pills no mesmo instante. Todos usam `font-semibold` + `var(--muted)` + `ChevronRight` (`opacity-60`), que marca "abre painel". **Não reintroduzir `GLASS_PRIMARY_BTN_STYLE` numa delas.**
>
> Histórico: até 16/07 o controle era lido como abas quebradas ("cliquei e o destaque não mudou"), porque **Detalhes** era um `<div>` decorativo, sem `onClick`, com o gradiente da marca fixo. Na mesma data virou botão (abrindo o mesmo drawer do card **Dias restantes**) e o gradiente saiu.
>
> Se um dia isso virar aba de verdade, o conteúdo dos drawers precisa vir para inline — não adianta só mover o destaque. Resquício dessa história: `activeGroupViewTab` ainda é tipado `"check-ins" | "participants"`, mas `"participants"` nunca é atribuído (sobra de quando Participantes era aba inline); a condição `=== "check-ins"` é sempre verdadeira.
- **Drawer de Classificações** (`ClassificationsDrawer`) — placar do grupo pelo critério do `scoringType`. O **nome de cada participante é tocável** (chevron à direita) e abre o `MemberCheckInsDrawer` por cima, com o calendário de check-ins daquele membro **neste grupo**.
- **Drawer de check-ins do participante** (`MemberCheckInsDrawer`) — header com avatar + nome, calendário mensal (`CheckInCalendarGrid`) com os dias marcados em laranja e o dia de hoje contornado, e rodapé com "{n} dias com check-in" + "{n} check-ins neste mês". A navegação de meses alcança o mês do check-in mais antigo do membro. Sem check-ins, mostra estado vazio. Fonte de dados: `groupCheckIns` já carregado na tela, filtrado por `userId` — sem query nova.
- **Header "Histórico" + "N registros"** — título 14px + contagem em `--muted`. A contagem é sempre o **total** do grupo, não o que está renderizado.
- **Lista de check-ins** — agrupados por dia (Hoje/Ontem/data, label 10.5px `--muted`); cada item é um cartão de vidro (`GLASS_CARD_STYLE`) `rounded-[17px]` com **borda-esquerda de 3px** (azul da marca `--accent` para os check-ins do próprio usuário, `--line` para os demais), tile 40px `rounded-[12px]` (thumbnail da foto ou avatar quadrado), título em negrito, "{nome} · horário" e pill roxa translúcida `+{nº de grupos musculares}`. Reações de emoji e barra de avaliação (modo memes) permanecem abaixo, alinhadas ao tile. Skeleton e empty state seguem a mesma paleta.
- **Barra de avaliação (modo memes)** — só existe quando `scoringType === "memes"`. Ninguém avalia o próprio check-in:
  - **Check-in de outro participante** → rótulo `🎭 avaliar` + botões Classificar (`CheckCircle2`) e Desclassificar (`XCircle`), com o voto do usuário destacado. Tocar de novo no mesmo voto o remove.
  - **Check-in próprio** → rótulo `⏳ pendente` (sem botões), mais a contagem de votos recebidos quando já houver algum. Quando o check-in está anulado, o rótulo `pendente` some, porque o selo **Anulado** à direita já diz o resultado.
  - O selo **Anulado** e a opacidade reduzida do cartão aparecem para todos quando `desclassificar > classificar`.
  - **O dono do check-in é notificado a cada voto (2026-07-21):** `duel_check_in_votes` tem trigger que insere notificação **tipo 14** (classificado) ou **15** (desclassificado); trocar o voto reescreve a notificação e desfazer o voto a apaga. Antes o autor só descobria o resultado voltando ao grupo e reparando no selo "Anulado". Exige a migração `20260721-checkin-vote-notifications.sql`; ver `docs/10-notificacoes.md`
- **FAB de check-in** — **pill** flutuante (ícone `Plus` + label "Check-in") com o gradiente da marca (`GLASS_PRIMARY_BTN_STYLE`) e glow; desabilitado (acinzentado) quando o grupo está encerrado. Ancorada a `calc(20px + env(safe-area-inset-bottom))` do rodapé (antes precisava de 88px para não sobrepor o bottom nav, que não existe mais).
- **Overlay de reação (long-press)** — sheet de vidro escuro (`rounded-[28px]`, blur 40px) com preview do check-in, 6 emojis rápidos e botão Cancelar (mantido do design anterior).

> **Paginação do histórico (2026-07-16):** `getGroupCheckInsDb` **não tem `.limit()`** — o placar (`ClassificationsDrawer`), o card do líder e o calendário do membro (`MemberCheckInsDrawer`) são todos calculados no cliente a partir dessa lista, então um teto no fetch não encurtava a tela, dava **pontuação errada** (era o que o antigo `.limit(50)` fazia em grupos grandes). Quem pagina é a **renderização**: `visibleCheckInCount` começa em `CHECKINS_INITIAL_COUNT` (50) e cresce `CHECKINS_PAGE_SIZE` (10) por vez quando a rolagem chega a `CHECKINS_LOAD_MORE_OFFSET` (320px) do fim, via `onGroupViewScroll`. Um rodapé "Role para ver mais {n} registros" indica o que falta, e `openGroupView` reseta a contagem ao trocar de grupo.
>
> Dois cuidados ao mexer: (1) o recorte vem **depois** do sort por data — cortar antes agruparia os dias errados; (2) `loadMoreLockRef` limita a um lote por render commitado, porque o scroll dispara dezenas de vezes por segundo e um fling revelaria 40+ cartões de uma vez, anulando a paginação. O teto real passa a ser o limite global de 1000 linhas do PostgREST.

> **Pull-to-refresh (2026-07-02):** O container de conteúdo da tela do grupo (`flex-1 overflow-y-auto`, hero + stats + histórico) suporta o mesmo gesto de puxar-para-baixo do Feed. Puxar a partir do topo (`scrollTop === 0`) além do limiar (72px) chama `refreshGroupView(groupId)`, que invalida o cache (`groupCheckIns`, `groupParticipants`) e recarrega check-ins, participantes, reações e votos (modo memes) do grupo aberto — sem esvaziar a lista atual antes (evita o flash de estado vazio que `openGroupView` causa ao trocar de grupo). Indicador visual: spinner circular azul (`--accent`) que gira conforme a distância puxada e roda continuamente (`animate-spin`) durante o refresh.

---

> **Fix: modal de detalhe do participante nascendo atrás da tela (2026-07-02):** No drawer de Participantes, tocar num nome abre o "Participant Details Modal" (avatar, stats, calendário de check-ins do mês) **sem fechar** o drawer de Participantes — os dois ficam montados ao mesmo tempo, um sobre o outro. O `DrawerContent` base (`client/components/ui/drawer.tsx`) usa `z-[310]` (conteúdo) / `z-[300]` (overlay) por padrão; o modal de detalhe tinha um `z-[110]` explícito — **menor** que o do próprio drawer de Participantes que continuava aberto atrás dele, então renderizava por baixo. Corrigido para `z-[330]` (conteúdo) + `overlayClassName="z-[320]"` (novo prop já suportado pelo `DrawerContent`), garantindo que fique acima do drawer pai independente da ordem de montagem no DOM. O **Reaction Viewer** (quem reagiu com um emoji, aberto a partir da lista de check-ins) tinha o mesmo `z-[110]` incorreto — nesse caso o bug era mais sutil: como o overlay dele não era customizado (ficava no `z-[300]` padrão), o **próprio backdrop do drawer renderizava acima do seu próprio conteúdo**. Mesma correção aplicada lá.

### Ações em Grupos

**Como membro:**
- **Fazer check-in** — registra participação diária via `addGroupCheckInDb`
- **Atualizar check-in** — edita descrição/foto do check-in do dia
- **Deletar check-in** — remove o check-in do dia
- **Sair do grupo** — AlertDialog de confirmação → `leaveGroupDb`

**Como criador:**
- Todas as ações de membro, mais:
- **Convidar membros** — Drawer com lista de usuários seguidos para convidar
- **Alterar foto do grupo** — `updateGroupPhotoDb`. A capa escolhida aparece na hora (preview local via `URL.createObjectURL`) enquanto o upload roda por baixo; ao terminar, a URL remota é pré-carregada antes de substituir o blob para não piscar. Se o upload falhar, a capa anterior volta e sai toast de erro.

> **Regra de cache da capa:** cada troca envia para um caminho único (`group-covers/{groupId}/{timestamp}.{ext}`, `upsert: false`) e invalida `enrichedDuelGroups`/`followingGroups`/`userDuelGroups`. Nunca reusar um caminho fixo: a URL pública ficaria idêntica e o CDN do Supabase (1h por padrão) mais o WebView continuariam servindo a imagem antiga.
- **Deletar grupo** — AlertDialog de confirmação → `deleteGroupDb`

**Convites pendentes:**
- **Aceitar** → `acceptGroupInviteDb`
- **Recusar** → `declineGroupInviteDb`

---

### Modal de Criação de Grupo (Wizard 4 steps)

Fluxo em 4 etapas com barra de progresso visual no topo.

> **i18n (2026-07-16):** o wizard era todo hardcoded em PT; hoje usa as chaves `duels_wizard_*` (42, em PT e EN). Dois detalhes ao mexer:
> - Título e subtítulo de cada passo vêm de **chave dinâmica** — `` t(`duels_wizard_step${groupStep}_title`) ``. Isso é type-safe porque `groupStep` é tipado `1 | 2 | 3 | 4 | 5`: o template resolve para exatamente as 5 chaves e o `tsc` reclama se alguma faltar. **Renomear/remover uma dessas chaves quebra o build de propósito** — mas ela não aparece num grep literal, então procure pelo prefixo.
> - A data de "Término previsto" usa `language === "pt" ? "pt-BR" : "en-US"` — não fixar `pt-BR`.
> - Os **nomes dos estados** (Acre, Bahia, …) seguem hardcoded de propósito: são nomes próprios, idênticos nos dois idiomas. Só o rótulo do campo é traduzido.

**Step 1 — Identidade:**
| Campo | Tipo | Obrigatório |
|---|---|---|
| Capa do grupo | Upload de imagem (preview inline) | — |
| Nome do grupo | Input | ✓ — único bloqueio para avançar |
| Meta do grupo | Textarea | — (opcional desde 2026-07-16) |

> **Meta opcional (2026-07-16):** só o **nome** trava o avanço do Step 1. A coluna `duel_groups.goal` é **NOT NULL**, então meta vazia grava `""` — nunca `null`, que quebraria o insert. Nome e meta são gravados com `.trim()`, senão " " passaria na validação e viraria uma meta de espaço em branco.
>
> Quem exibe a meta precisa tratar o vazio: a revisão (Step 5) **oculta** a linha, e o modal de Detalhes mostra "Sem meta definida" (`duels_group_no_goal`) em vez de uma caixa vazia. A edição pelo criador já permitia limpar a meta antes disso — ou seja, grupo sem meta já era possível; o wizard é que exigia.

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

> **Gate premium (2026-07-15):** no plano grátis o usuário mantém **1 duelo ativo criado por ele** (`activeCreatedDuels` = grupos com `createdBy === user.id` e `endDate` nula ou futura). Tentar criar o 2º abre o `PaywallDrawer` (`feature="duels"`) — tanto no CTA "Criar um duelo" quanto no botão final do wizard (backstop). **Participar de duelos é sempre livre.** Ver `docs/17-premium.md`.

---

### Check-in de Grupo

**Drawer de Check-in:**
- Opção de adicionar foto do treino — dois botões dedicados, **Câmera** e **Galeria**, cada um com seu próprio `<input type="file">` oculto. O input da Câmera usa `capture="environment"` (força a câmera traseira), replicando o padrão já usado em `NewPost.tsx`. **Motivo:** no WebKit do iOS, fotos tiradas com a câmera frontal através de `<input type="file">` saem espelhadas (o arquivo capturado é invertido horizontalmente em relação ao que o usuário viu na pré-visualização); forçar a câmera traseira evita o bug por completo. Ambos os fluxos abrem a foto no `ImageCropperDrawer` (mesmo `pendingCropSrc`/`pendingCropIndex` usados para crop).
  - **Foto padrão quando nenhuma é enviada (2026-07-02):** se o usuário publicar o check-in sem escolher nenhuma foto, `photo`/`photos` são preenchidos com o mascote estático `public/Monstrinho_segurando_pesinho_202603301834.jpeg` (`DEFAULT_CHECKIN_PHOTO` em `Community.tsx`, referenciado como `/Monstrinho_segurando_pesinho_202603301834.jpeg` — mesma convenção de asset público usada pelo logo do canvas em `workout-summary-overlay.tsx`), em vez de deixar o check-in sem foto no card/detalhe.
- Textarea para descrição do check-in
- Seletor de "O que você treinou?" — exibe **apenas rotinas concluídas** nos últimos 7 dias (via `getRecentCompletedRoutinesDb`)
  - Cada opção mostra: nome da rotina, grupo muscular principal, quantidade de exercícios, horário de conclusão (rótulo "Hoje HH:mm" para o dia atual, ou "DD mês HH:mm" para dias anteriores)
  - Lista expandida mostra cada exercício com carga (kg)
  - Série e volume total preenchidos automaticamente do histórico
  - **Rotina já postada neste grupo (2026-07-02):** se a mesma rotina (nome + dia) já tiver um check-in nesse grupo, a opção aparece **desabilitada** (opacidade reduzida, `cursor-not-allowed`) com o rótulo "Já postado neste grupo" ao lado do horário; tocar nela mostra um toast em vez de selecionar. O botão "Adicionar Check-in" também bloqueia no submit (checagem redundante caso o estado fique desatualizado). Chave de deduplicação: `nome-da-rotina (lowercase/trim) + dia do calendário` calculada a partir dos check-ins já carregados do grupo (`groupCheckIns`) comparados com `routine.completedAt`. **Escopo por grupo** — a mesma rotina pode ser compartilhada normalmente em outro grupo do qual o usuário participa (cada duelo tem pontuação própria); a regra só impede inflar a pontuação de **um** grupo postando o mesmo treino nele mais de uma vez. Essa checagem existe apenas no drawer manual da tela de Duelos — o botão "Compartilhar no Duelo" do resumo de treino (`workout-summary-overlay.tsx`) não passa por ela.
- Séries/Volume são salvos da tabela `user_workouts_hist` (reais, não zeros)
- `muscle_group`, `muscle_groups` e `exercises` (JSON) são salvos no check-in para exibição no detalhe

> **Data/horário do check-in segue a rotina, não o momento da postagem (2026-07-02):** Como a rotina selecionada pode ter sido concluída em um dia anterior (janela de 7 dias), o check-in é gravado com `created_at` igual ao `completedAt` da rotina escolhida (`addGroupCheckInDb(..., workoutCompletedAt)`), em vez do horário em que o usuário efetivamente tocou em "Adicionar Check-in". Isso garante que o check-in apareça agrupado no dia correto no histórico (Hoje/Ontem/data), na contagem de "dias ativos" e em qualquer ordenação por data — mesmo quando o usuário só lembra de postar depois.

> **Tags de todos os grupos musculares treinados (2026-07-02):** Antes, o check-in guardava só o grupo muscular **mais frequente** entre os exercícios (`muscle_group`) — um treino de Perna + Ombro aparecia sem nenhuma tag de Ombro. `addGroupCheckInDb` agora também calcula `muscle_groups` (todos os grupos distintos, ordenados por frequência) a partir do array `exercises` recebido, e grava na nova coluna `duel_check_ins.muscle_groups` (`text[]`, ver `docs/migrations/20260702-duel-checkin-muscle-groups.sql`). Isso corrige tanto o check-in manual (drawer da tela de Duelos) quanto o "Compartilhar no Duelo" do resumo de treino (`workout-summary-overlay.tsx`), que antes **sempre** enviava `muscleGroup: null` — bug separado, também corrigido, que fazia o check-in aparecer sem tag nenhuma quando compartilhado do resumo.
> - **Card do histórico** (espaço apertado, ao lado da thumbnail): mostra até **2 tags** + um chip `+N` se houver mais, para não competir com o layout compacto da linha.
> - **Modal de detalhe** (mais espaço, sem thumbnail ao lado): mostra **todas** as tags, quebrando linha (`flex-wrap`) quando necessário.

**Cards de Check-in no Histórico:**
- Foto de perfil do usuário ao lado do nome
- Tags de grupo muscular (até 2 + `+N`, ver acima)
- Nome da rotina / descrição
- **Horário sempre visível** (mesmo quando há foto) — exibido abaixo da thumbnail

**Modal de Detalhe do Check-in:**
- Foto de perfil do usuário (com fallback para inicial)
- Data + horário completo do check-in
- Tags de todos os grupos musculares treinados (ver acima)
- Lista de exercícios realizados com nome, grupo muscular e carga (kg)
- Volume total e número de exercícios como stats
- **Reações de emoji** — 6 emojis rápidos (❤️ 🔥 💪 😮 👏 🏆), toggle por usuário, contador de reações (`duel_check_in_reactions`); sincronizadas em tempo real via Supabase Realtime (canal `checkin-reactions:{groupId}`) — todos os membros veem as reações atualizadas sem precisar recarregar
- **Seção de comentários** — lista de comentários com avatar + nome + horário (`duel_check_in_comments`). No próprio comentário aparecem **editar** (`Pencil`) e **excluir** (`Trash2`).
- **Input de comentário (2026-07-16)** — **rodapé fixo (`shrink-0`) do drawer, fora do container rolável**, com borda superior. Fica sempre visível, inclusive ao rolar foto e exercícios.

> **Por que o input é rodapé fixo (não mexer):** enquanto ele vivia no fim do container rolável, focar o campo subia o teclado e o lift wrapper erguia a folha, mas **nada rolava até o campo** — o offset dele dentro do conteúdo rolado não mudava. O campo só aparecia na primeira tecla, quando o WebKit leva o cursor à vista sozinho (era esse o sintoma de "a tela só reajusta quando começo a digitar"). Colado na borda inferior da folha, erguer a folha já basta — é o mesmo padrão de `post-comments-dialog.tsx` e `promotion-comments-drawer.tsx`, que nunca tiveram o problema.
>
> A correção é **estrutural de propósito**: não envolve tocar na arquitetura de teclado (`resize:'none'` + `--keyboard-height`, ver `docs/13`), nem reativar o `repositionInputs` do vaul, nem furar o guard de `[role="dialog"]` do `scrollPageInputIntoView` em `client/lib/keyboard.ts` — esse guard assume que "drawers cuidam de si", o que só é verdade quando o input é rodapé fixo.
  - **Excluir comentário (2026-07-16)** — pede confirmação antes, via o `showConfirm` central da tela (o mesmo diálogo do botão de excluir check-in, logo acima no header do drawer). Antes excluía direto no clique, sem volta. O texto reusa as chaves `comments_delete_title` / `comments_delete_desc` dos comentários de post, então a pergunta é idêntica em todo o app. `deletingCommentId` marca a exclusão em voo e desabilita o botão daquele comentário.

> **Confirmação de ações destrutivas nesta tela:** use sempre o `showConfirm(title, description, onConfirm)` (`Community.tsx`), que alimenta um único `AlertDialog` central ("Centralized Confirm Dialog"). Não monte um `AlertDialog` novo por ação — o diálogo já existe e o shadcn dá o mesmo visual, então um segundo só duplicaria estado e JSX.

> **Tabelas necessárias:** `duel_check_in_comments` e `duel_check_in_reactions` — ver migration em `docs/migrations/20260327-community-features.sql`

> **Performance da foto no modal de detalhe (2026-07-02):** A foto do check-in demorava a aparecer ao abrir o modal. Causas identificadas e corrigidas:
> - `PostCarousel` (usado também no Feed e no Post Detalhe) usava `loading="lazy"` na imagem mesmo quando o carrossel já abre visível dentro de um drawer/modal — o navegador podia adiar o fetch à toa. Novo prop `priority` força `loading="eager"` nesse caso; usado apenas no check-in (`<PostCarousel priority ... />`), sem alterar o comportamento no Feed (onde "lazy" continua correto para posts fora da viewport).
> - A foto passa pelo endpoint de transform-on-the-fly do Supabase Storage (`cdnImg` → `/storage/v1/render/image/public/...`, ver `client/lib/image-url.ts`), que tem latência perceptível no **primeiro** pedido de uma URL transformada (cache frio na borda). Como o card da lista usa a foto original (sem transform), a foto do modal de detalhe pedia uma URL nunca antes buscada. Agora, assim que a lista de check-ins carrega, os primeiros 15 check-ins com foto têm sua URL transformada (mesma largura/qualidade que o modal vai pedir — `POST_PHOTO_WIDTH`/`POST_PHOTO_QUALITY`, exportados de `post-carousel.tsx`) pré-aquecida em segundo plano (`new Image()`, `fetchPriority: "low"` quando suportado) — na prática, a borda do Supabase já está com cache quente quando o usuário toca no check-in.
> - `ZoomableImage` (dentro do `PostCarousel`) agora aplica um fade-in (`opacity` 0→1 no `onLoad`) em vez de a imagem "estourar" assim que termina de carregar — o fundo do frame já preenche o espaço, então não há flash de conteúdo vazio.

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
| Semente de first paint da conversa (leitura síncrona, sem rede) | `peekConversationMessages(otherUserId)` |
| Atualizar a semente da conversa | `cacheConversationMessages(otherUserId, messages)` |
| URL de mídia de DM já assinada (leitura síncrona, sem rede) | `peekChatMediaUrl(ref)` |
| Rotinas concluídas (últimos 7 dias) | `getRecentCompletedRoutinesDb(userId)` |
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

- Canal Supabase: `messages:{prefixo do userId}:{sufixo aleatório}` (por conversa ativa)
- Evento: `INSERT` na tabela `messages` — a mensagem nova é **anexada** à lista (sem recarregar a conversa)
- Marca como lida imediatamente ao receber mensagem com a conversa aberta
- Badge de não lidas no ícone de navegação atualiza automaticamente (assinatura própria em `app-layout.tsx`, com filtro `following_id=eq.{userId}` e debounce)

> **Confiabilidade do realtime (2026-07-20):** A conversa deixava de receber mensagens novas e só atualizava ao sair e entrar de novo. Três correções, alinhando ao padrão já maduro de `Notifications.tsx`:
>
> 1. **Canal derrubado antes de recriar** (via `conversationChannelRef`). Quando o efeito re-roda antes do `removeChannel` assíncrono terminar — comum no ciclo de vida do Capacitor no iOS — o supabase-js estoura `cannot add callbacks after subscribe()` e a conversa fica **sem** realtime, silenciosamente.
> 2. **Nome do canal com `Math.random()`** em vez de `Date.now()`: no iOS o efeito pode rodar duas vezes dentro do mesmo milissegundo (retorno do background) e o nome colidia.
> 3. **Recuperação ("catch-up")** via `catchUpMessages(userId)`: relê a conversa e mescla com `sameMessageList` (se nada mudou, mantém o array anterior — sem re-render). Roda quando o canal atinge `SUBSCRIBED` (inclui **cada reassinatura após reconexão** do websocket) e no `visibilitychange` ao voltar do background. É o que cobre a janela em que o socket esteve morto e mensagens chegaram sem evento.
>
> **Pré-requisito no banco:** a tabela precisa estar na publicação `supabase_realtime`, senão nenhum evento chega por melhor que esteja o cliente. Não havia migração versionada disso (só a de `duel_check_in_reactions`), então criamos `docs/migrations/20260720-messages-realtime.sql` — idempotente, só publica se ainda não estiver. A publicação **não** burla RLS: o Realtime avalia a policy de SELECT do assinante (`messages_select_participants`), então cada usuário só recebe eventos das mensagens em que é participante.

> **Lista de conversas fresca ao entrar (2026-07-20):** ao (re)montar a tela de Comunidade e ao voltar do background (`visibilitychange`), um efeito relê as conversas do **zero** (`invalidateQueryCache("conversations")` + `getConversationsDb()`). O `loadData` inicial usa `getConversationsDb` cacheado (TTL 60s) para o primeiro paint instantâneo, mas quem chegava aqui vindo de outra tela após receber uma mensagem (via push) encontrava a lista velha — sem o remetente/preview/badge novos — até sair e voltar. O refresh roda **fora do gate de `loading`** (paralelo ao `loadData`): pinta rápido do cache e, logo em seguida, substitui pela versão fresca; como invalida antes de buscar, a resposta fresca sempre vence a do cache. Independe do realtime da tabela `messages` estar publicado.

---

## Observações Técnicas

> **Refatoração incremental (2026-07-13):** `Community.tsx` era um monolito de ~5.000 linhas (quase tudo dentro de um único componente). Primeira fatia **segura** de extração, sem mudança de comportamento: helpers puros e constantes (`specialMessageLabel`, `formatTimeAgo`, `DEFAULT_CHECKIN_PHOTO`, `DUEL_SCORING_TYPE_OPTIONS`, tipo `ViewMode`) foram para `client/components/community/community-helpers.ts`, e a **aba Ranking** (puramente apresentacional) virou `client/components/community/ranking-tab.tsx` (`<RankingTab ranking followers currentUserId onScroll />`). As abas **Mensagens** e **Duelos** continuam inline por serem profundamente acopladas ao estado do componente — sua extração deve ser feita de forma incremental e validada em device (o app é iOS/Capacitor, sem verificação de runtime local).

- `viewMode` controla se exibe lista de conversas ou uma conversa individual
- Tab ativa pode ser controlada via `searchParams` (ex: `?tab=duelos`)
- `useLayoutMode()` detecta mobile/desktop para ajustes de layout
- Grupos têm notificações enviadas ao criador quando alguém pede para entrar (`sendGroupJoinRequestNotificationDb`)
- **Mensagem privada gera push, e só push (tipo 10, 2026-07-13; push-only desde 2026-07-21):** `sendMessageDb` insere uma linha em `notifications` (fire-and-forget) — ela existe unicamente para disparar o push, e é **filtrada na leitura**, então não vira card na tela de Notificações nem conta no badge do sino. Quem sinaliza mensagem não lida dentro do app é o badge da Comunidade (`getUnreadMessageCountDb`, que lê a tabela `messages`). O toque no push leva a `/comunidade?user=<remetente>`. Ver `docs/10-notificacoes.md`
- **Check-in em duelo gera notificação/push (tipo 11, 2026-07-13):** `addGroupCheckInDb` avisa todos os participantes **aceitos** do grupo, exceto o autor. O card abre o check-in (`state.openCheckIn`). Ver `docs/10-notificacoes.md`
- **Comentário em check-in gera notificação tipo 3 (2026-07-21):** `addCheckInCommentDb` avisa o dono do check-in com `type: 3` + `duel_check_in_id` → "{nome} comentou no seu check-in". Antes gravava `type: 6`, que é "reagiu ao seu comentário" — evento errado e colidindo com a reação real. Ver `docs/10-notificacoes.md`
- **Abrir um check-in específico:** `openCheckInById(checkInId)` carrega detalhe + comentários + reações, abre o drawer e força a aba Duelos. Dois caminhos chegam nela: `state.openCheckIn` (navegação interna, vinda do card de notificação) e **`?checkin=<id>`** (toque no push — um deep link é só uma URL e não carrega o `state` do router). O param é aplicado uma única vez por id, via ref

> **Header auto-ocultável ao rolar (2026-07-02):** Igual ao Feed, o header flutuante (perfil/lupa/comunidade/notificações) some ao rolar para baixo e reaparece ao rolar para cima. As 4 abas (Mensagens, Duelos, Ranking, Solicitações) compartilham o mesmo wrapper externo com altura fixa (`calc(100dvh - ...)`) e `overflow-hidden`; cada aba tem seu próprio container interno `flex-1 overflow-y-auto` marcado com `data-community-scroll-container`, que o `AppLayout` usa para detectar o scroll (ver `docs/13-layouts-e-componentes.md`). Antes, apenas as abas Mensagens e Duelos tinham essa altura fixa — Ranking e Solicitações rolavam com a window; agora as 4 são consistentes.

## Design dos Drawers de Duelos (Glass)

Todos os drawers da tela de Duelos seguem o padrão **glass escuro** do novo design (ver `docs/15-design-system.md` §9.4), importando os tokens de `client/lib/glass-styles.ts`:

- **Inline em `Community.tsx`:** Criar Grupo, Adicionar Check-in, Detalhe de Check-in, Visualizador de Reações, Detalhes do Grupo, Participantes e Detalhe do Participante.
- **Componentes dedicados (já no padrão):** `ClassificationsDrawer`, `AddMembersDrawer` e `EditCheckInDrawer`.

Convenções: shell via `GLASS_SHEET_PROPS` + `GLASS_SHEET_STYLE`; títulos `text-white`; campos com `GLASS_FIELD_CLASS`/`GLASS_FIELD_STYLE`; botões principais com `GLASS_PRIMARY_BTN_STYLE`; cards internos com `GLASS_PANEL_STYLE`; botões `outline` ficam `bg-transparent border-white/20 text-white`.
