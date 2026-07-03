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
| Botão excluir | Ícone `Trash2` sobre fundo vermelho — **revelado por swipe** da direita para a esquerda na linha (padrão iOS); abre AlertDialog de confirmação |

> **Swipe-to-delete (2026-06-27):** Cada linha de conversa é envolvida pelo componente `SwipeableConversationRow` (`client/components/community/`). Arrastar a linha da direita para a esquerda desliza o conteúdo e revela um botão de lixeira com fundo vermelho (`#ef4444`, largura 76px). O gesto tem trava de direção (ignora rolagem vertical), resistência ao passar do limite e animação de snap (abre/fecha) ao soltar. Tocar na linha enquanto aberta apenas fecha o swipe; tocar na lixeira abre o AlertDialog de confirmação. Substitui o antigo botão baseado em `hover`, que não funcionava no toque (alvo iOS).

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
| **Dias** (dias restantes) | Abre modal de Detalhes do Grupo |

### Modal de Detalhes do Grupo

Exibe:
- Nome do grupo
- Local (UF)
- Objetivo
- **Modalidade** (`scoringType`) — ícone + nome do sistema de pontuação do grupo (Contagem de check-in, Dias ativos, Pontos de hustle, Duração, Distância, Passos, Calorias ou Memes). Mesmo catálogo de opções usado no wizard de criação (Passo 4 — Sistema de Pontuação)
- Regra do desafio (somente quando `scoringType === "memes"` e `memeRule` está definido)
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
- Mensagens de imagem: prefixo `[image]:url` → renderizadas como `<img>` clicável. Ao tocar, abre um **visualizador fullscreen in-app** (overlay preto via portal, botão de fechar e fechar ao tocar fora) — a URL do Supabase Storage **não** é exposta ao usuário (não usa mais o `Browser` do Capacitor)
- Mensagens de áudio: prefixo `[audio]:url` → renderizadas como player `<audio controls>` com `preload="auto"` (pré-carrega o arquivo assim que a bolha monta, para que a reprodução comece instantaneamente ao tocar play, sem o atraso de buffering do `preload="metadata"`); gravação usa MediaRecorder API priorizando **MP4/AAC** (`audio/mp4;codecs=mp4a.40.2` → `audio/mp4` → `audio/aac`), com WebM/Opus apenas como fallback — MP4/AAC é reproduzível nativamente no WebView do iOS (alvo do app), evitando atraso/falha que o WebM causa no iOS; upload para `posts/message-audio/` no Supabase Storage (extensão `.mp4`/`.webm` conforme o tipo do blob)
- Permissão de microfone já declarada no `Info.plist` iOS (`NSMicrophoneUsageDescription`)

**Realtime:**
- Novas mensagens aparecem em tempo real via Supabase Realtime (canal `messages-{userId}`, evento `INSERT` na tabela `messages`)
- Auto-scroll para última mensagem
- Marca mensagens como lidas ao abrir a conversa (`markMessagesAsReadDb`) e ao receber mensagem em tempo real

> **Auto-scroll para a última mensagem (2026-07-02):** Ao abrir/reabrir uma conversa, a tela sempre inicia posicionada na última mensagem (enviada ou recebida) — sem animação (`scrollIntoView({ behavior: "auto" })`), evitando o efeito de "rolagem visível" desde o topo. Um `ref` (`hasScrolledForConversationRef`) marca se já houve o scroll inicial daquela conversa e é resetado sempre que `selectedConversation.userId` muda. Como imagens/áudio da conversa podem carregar de forma assíncrona e alterar a altura do conteúdo após o primeiro paint, o scroll inicial é reforçado com dois re-snaps (150ms e 400ms) para garantir que a tela permaneça no fim mesmo após esses ajustes de layout. Mensagens novas (enviadas ou recebidas via realtime) continuam usando `behavior: "smooth"`.

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
   - **Card hero** (primeiro grupo) — banner de foto/cor no topo (110px), badge de papel ("Seu grupo" / "Participante"), badge de dias restantes, nome, contagem de participantes + cidade, botão branco "Ver Grupo" (ação: abre a tela do grupo via `openGroupView`)
   - **Cards compactos** (demais grupos) — ícone/foto quadrado (50×50, border-radius 16px), nome, participantes, cidade, dias restantes, chevron para navegar

3. **Da comunidade** — grupos disponíveis para entrar (lista simples):
   - Ícone/foto, nome, contagem + nome do criador, botão "Entrar" / "Ver Grupo" / "⏳ Pendente"
   - Ao clicar "Entrar" → `addMembersToGroupDb` + notificação ao criador; estado muda para "Pendente"

4. **Empty state** — ícone `Swords` com mensagem central quando não há grupos

---

### Tela do Grupo (LinKa Glass — refatorado 2026-06-27)

Aberta via `openGroupView` (botão "Ver Grupo" da lista). Renderizada em portal fullscreen sobre fundo de gradiente escuro (`linear-gradient(rgba(20,19,28,1),rgba(10,10,16,1))`), seguindo o design system LinKa Glass. Toda string usa `t()` (chaves `duels_group_*`).

**Estrutura:**
- **Header** — barra de vidro com blur (`backdrop-filter blur(24px)`) e borda translúcida; botão `ArrowLeft` branco com hover de vidro. Respeita `env(safe-area-inset-top)`.
- **Hero banner** (h-48) — foto de capa do grupo ou, sem foto, gradiente azul→roxo da marca. Overlay escuro na base com o nome do grupo. Botão de editar capa (só criador) é um círculo de vidro com blur no canto superior direito.
- **Cards de estatísticas** (Líder / Você / Dias) — 3 cartões frosted-glass (`rgba(255,255,255,.04)` + borda `rgba(255,255,255,.08)`, `rounded-[18px]`), números em roxo (`#9d6bff`), labels em branco translúcido. Clicáveis (ver tabela abaixo).
- **Tab "Histórico (n)"** — sublinhado roxo (`#9d6bff`).
- **Lista de check-ins** — agrupados por dia (Hoje/Ontem/data); cada item é um cartão de vidro `rounded-[18px]` com avatar, descrição, nome, tag de grupo muscular (roxa), thumbnail e horário. Skeleton de loading e empty state também em estilo glass.
- **Bottom nav** — barra de vidro com blur e `env(safe-area-inset-bottom)`; 3 itens com **ícones Lucide** (`FileText` Detalhes, `Users` Participantes, `Trophy` Classificações) substituindo os emojis antigos.
- **FAB de check-in** — círculo flutuante com gradiente azul→roxo e glow; desabilitado (vidro acinzentado) quando o grupo está encerrado. Posição respeita a safe area inferior.
- **Overlay de reação (long-press)** — sheet de vidro escuro (`rounded-[28px]`, blur 40px) com preview do check-in, 6 emojis rápidos e botão Cancelar.

> **Pull-to-refresh (2026-07-02):** O container de conteúdo da tela do grupo (`flex-1 overflow-y-auto`, banner + stats + histórico) suporta o mesmo gesto de puxar-para-baixo do Feed. Puxar a partir do topo (`scrollTop === 0`) além do limiar (72px) chama `refreshGroupView(groupId)`, que invalida o cache (`groupCheckIns`, `groupParticipants`) e recarrega check-ins, participantes, reações e votos (modo memes) do grupo aberto — sem esvaziar a lista atual antes (evita o flash de estado vazio que `openGroupView` causa ao trocar de grupo). Indicador visual: spinner circular roxo (`#9d6bff`) que gira conforme a distância puxada e roda continuamente (`animate-spin`) durante o refresh.

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
- **Seção de comentários** — lista de comentários com avatar + nome + horário, input para enviar novo comentário (`duel_check_in_comments`)

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

> **Header auto-ocultável ao rolar (2026-07-02):** Igual ao Feed, o header flutuante (perfil/lupa/comunidade/notificações) some ao rolar para baixo e reaparece ao rolar para cima. As 4 abas (Mensagens, Duelos, Ranking, Solicitações) compartilham o mesmo wrapper externo com altura fixa (`calc(100dvh - ...)`) e `overflow-hidden`; cada aba tem seu próprio container interno `flex-1 overflow-y-auto` marcado com `data-community-scroll-container`, que o `AppLayout` usa para detectar o scroll (ver `docs/13-layouts-e-componentes.md`). Antes, apenas as abas Mensagens e Duelos tinham essa altura fixa — Ranking e Solicitações rolavam com a window; agora as 4 são consistentes.

## Design dos Drawers de Duelos (Glass)

Todos os drawers da tela de Duelos seguem o padrão **glass escuro** do novo design (ver `docs/15-design-system.md` §9.4), importando os tokens de `client/lib/glass-styles.ts`:

- **Inline em `Community.tsx`:** Criar Grupo, Adicionar Check-in, Detalhe de Check-in, Visualizador de Reações, Detalhes do Grupo, Participantes e Detalhe do Participante.
- **Componentes dedicados (já no padrão):** `ClassificationsDrawer`, `AddMembersDrawer` e `EditCheckInDrawer`.

Convenções: shell via `GLASS_SHEET_PROPS` + `GLASS_SHEET_STYLE`; títulos `text-white`; campos com `GLASS_FIELD_CLASS`/`GLASS_FIELD_STYLE`; botões principais com `GLASS_PRIMARY_BTN_STYLE`; cards internos com `GLASS_PANEL_STYLE`; botões `outline` ficam `bg-transparent border-white/20 text-white`.
