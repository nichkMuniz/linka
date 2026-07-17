# Layouts e Componentes Compartilhados

---

## Estrutura de Pastas (`client/components/`)

```
client/components/
├── ui/             ← Shadcn UI (não mexer)
├── layout/         ← Componentes estruturais globais (AppLayout, ShotsLayout, ThemeProvider, FloatingActionMenu)
├── shared/         ← Componentes reutilizáveis em 2+ domínios (ImageWithFallback, AnimatedLoading, PostIncentiveButton, ExerciseImage, DietImage, EmojiPicker, InlineCropPreview, RouteMap, CheckInCalendarGrid)
├── modals/         ← Modais e Dialogs globais (PostCommentsDialog, PostLikesModal, FlowViewerModal, FlowCreationDialog)
├── post/           ← Componentes de post (PostCarousel)
├── shots/          ← Componentes de shots/flows (FlowCarousel)
└── profile/        ← Componentes de perfil (UserInsignias)
```

---

## Layouts

### AppLayout
**Arquivo:** `client/components/layout/app-layout.tsx`
**Usado por:** Todas as telas exceto Login e Shots

#### Estrutura
```
┌──────────────────────────────────┐
│  Header                          │
│  [Avatar][Logo] [Premium?][Buscar][Vitrine][Notif]│
├──────────────────────────────────┤
│  Conteúdo da tela atual          │
│                                  │
├──────────────────────────────────┤
│  Bottom Navigation (mobile)      │
│  [Home][Shots][Nova][Metas][Comunidade]│
└──────────────────────────────────┘
```

#### Funcionalidades
- **Header:** Avatar (→ Perfil) + logo + ícones de navegação secundária (Buscar, Vitrine, Notificações)
- **Ícone "Seja Premium" (2026-07-15):** coroa âmbar entre o logo e o Buscar (no header mobile) e entre a navegação principal e o timer de uso (na sidebar desktop), **visível só para quem ainda não é assinante** (`!isPremium`, de `usePremium()`). Abre o `PaywallDrawer` genérico (sem `feature` destacado) renderizado uma única vez no `AppLayout`, junto dos outros overlays globais — ver `docs/17-premium.md`
- **Hierarquia da navegação (2026-07-13):** a **Comunidade** (mensagens + duelos + ranking) ocupa o 5º slot do bottom nav; a **Vitrine**, de consulta ocasional, desceu para o header. Antes era o inverso: a superfície social mais rica do app vivia atrás de um ícone de 36px no header — que ainda por cima **some no scroll**, levando junto o acesso e o badge de mensagens não lidas
- **Badge de mensagens não lidas:** contador numérico sobre o ícone de Comunidade **no bottom nav** (sempre visível, ao contrário do header). Era um ponto de 7px
- **Badge de notificações:** contador numérico sobre o ícone de Notificações no header. Era um ponto de 7px
- **Alvos de toque:** os ícones do header são `40×40` (eram `36×36`), aproximando-se do mínimo de 44pt da Apple HIG
- **Toque no logo:** `navigate("/")` quando fora do feed; no feed, dispara `ritmofit-refresh-feed`. **Nunca** `window.location.href` — isso recarregava a WebView inteira (perde cache de feed, remonta a app, refaz auth), que era a maior quebra de fluidez do app
- **Limite diário atingido:** o botão "Ignorar hoje" é `variant="ghost"` (ação terciária). Como ele derrota o propósito do limite, não pode ser o CTA em destaque — os botões de adiar (5/10/30 min) são os `outline`
- **Vibração ao receber notificação:** A subscription realtime (`app-layout-notif-push`, canal `notifications`) dispara `hapticSuccess()` (`client/lib/haptics.ts`) para qualquer INSERT na tabela `notifications` do usuário logado — independentemente do tipo (follow, incentivo, comentário, duelo, reação) e da tela em que o usuário está, inclusive na própria tela de Notificações. Roda antes da checagem que pula a notificação local visual (`LocalNotifications.schedule`) quando o usuário já está em `/notificacoes`, então a vibração sempre ocorre mesmo quando o banner é suprimido. Sem efeito fora do runtime nativo (Capacitor) — `hapticSuccess()` é no-op no browser.
- **Refetch de badges no refresh do feed:** contadores são carregados no mount e mantidos via subscription realtime do Supabase (que pode cair silenciosamente em background no iOS). Para evitar badge desatualizado, o `AppLayout` também escuta os eventos `ritmofit-refresh-feed` (toque no logo/home) e `ritmofit-refresh-badges` (disparado pelo pull-to-refresh em `Index.tsx`) e refaz o fetch de `getUnreadMessageCountDb`/`getUnreadNotificationsCountDb` a cada um deles
- **Invalidação no realtime dos badges (performance):** os handlers realtime chamam `invalidateQueryCache("unreadMsgCount"/"conversations")` **antes** de reler o contador. `getUnreadMessageCountDb`/`getUnreadNotificationsCountDb` são cacheadas (30s); sem invalidar, o evento realtime relia a própria entrada em cache e o badge só acertava quando o TTL vencia — o realtime virava no-op
- **Tempo de tela bufferizado (performance):** a troca de rota **não vai mais ao banco**. `bufferScreenTime(tela, segundos)` acumula em `localStorage` (somado por dia+tela) e `flushScreenTimeDb(userId)` envia tudo num **único insert em lote** quando o app vai para background (`appStateChange`/`visibilitychange`), no logout (`settings-drawer`, antes do `signOut` por causa do RLS) e na abertura seguinte (resíduo de sessão encerrada abruptamente). Antes: 1 INSERT por navegação
- **Limite diário sem polling (performance):** a mudança do limite é sinalizada pelo evento `lk:daily-limit-changed` (disparado pelo `settings-drawer` ao salvar) + revalidação no `visibilitychange` (cobre a virada do dia). Substituiu um `setInterval` de 5s que rodava em toda tela, para sempre, só para vigiar uma chave de `localStorage` — o evento nativo `storage` não serve, pois só dispara em outra aba
- **Toast de sincronização offline (2026-07-11):** escuta o evento global `linka-offline-synced` (`OUTBOX_SYNCED_EVENT` de `client/lib/offline-outbox.ts`) e mostra o toast `goals_sync_done_title/desc` em qualquer tela quando a fila de escritas feitas sem internet (treinos/check-ins da tela de Metas) termina de sincronizar — ver "Modo offline" em `docs/05-metas.md`
- **Foto de perfil:** Carregada dinamicamente no ícone de Perfil
- **Bottom Navigation (mobile):** 5 itens fixos na parte inferior
- **Side Navigation (desktop):** Navegação lateral em telas grandes (244px fixo)
- **Timer de uso diário:** Monitora tempo de sessão
- **Limite diário:** Se o usuário configurou um limite, bloqueia o app ao atingir
- **Floating Action Menu:** Menu flutuante arrastável (mobile)
- **Swipe da borda esquerda → voltar (mobile):** Arrastar da borda esquerda para a direita volta para a **tela anterior visitada** (history back). Implementado pelo hook `useEdgeSwipeBack` (`client/hooks/use-edge-swipe-back.ts`), aplicado ao `<main>` do AppLayout via `mainRef`. O conteúdo desliza acompanhando o dedo (header e bottom nav ficam fixos), e ao soltar acima do limiar (~32% da largura ou flick rápido) dispara `hapticLight()` + `navigate(-1)`, animando a tela anterior deslizando da esquerda. Só inicia na faixa de 30px da borda esquerda (para não sequestrar carrosséis horizontais internos), ignora scroll vertical (trava de direção), não dispara com dialog/drawer aberto nem quando não há histórico anterior (`history.state.idx === 0`, evita sair do app). **Desligado em `/postar`** (voltar perderia o rascunho do novo post).

#### Desktop — frame de conteúdo
Em desktop (md+), o conteúdo é limitado a `max-w-[680px]` centralizado após a sidebar (244px). Todas as sobreposições fixas (Dialogs, Drawers) respeitam esse frame usando a classe `md-modal-centered` / `md-drawer-centered` definida em `global.css`, que ajusta o `left` para `calc(50vw + 122px)` (centro do frame de conteúdo).

#### Header/Bottom Nav flutuantes (mobile) — bounce elástico do iOS
Header e Bottom Nav são `position: fixed` com `top`/`bottom` calculados a partir de `env(safe-area-inset-*)`. No WKWebView do iOS, o bounce elástico nativo (rubber-band) pode deslocar/"descolar" momentaneamente elementos fixos durante o overscroll — mais perceptível em telas com safe area maior (Dynamic Island). Como o Feed já implementa seu próprio gesto de pull-to-refresh via touch handlers (`Index.tsx`), o bounce nativo é redundante e foi desativado globalmente com `overscroll-behavior-y: none` em `html`/`body` (`global.css`), eliminando o glitch sem afetar o pull-to-refresh custom.

#### Header flutuante — auto-ocultar ao rolar (mobile)
Nas rotas `/`, `/vitrine`, `/comunidade` e `/metas`, o header pill flutuante some ao rolar para baixo (>96px de scroll e delta > 30px) e reaparece ao rolar para cima (delta < -30px), controlado pelo estado `headerHidden` em `AppLayout` (classe `-translate-y-[200%]` quando oculto). Em `/`, `/vitrine` e `/metas` o listener é no `window` (a página inteira rola — `Goals.tsx` usa fluxo normal de documento, sem container de altura fixa). Em `/comunidade` a tela usa um container interno de altura fixa com scroll próprio (não a window) — por isso o `AppLayout` escuta `scroll` em fase de captura no `document` e filtra pelo atributo `data-community-scroll-container`, presente no container `flex-1 overflow-y-auto` de cada aba (Mensagens, Duelos, Ranking, Solicitações) em `Community.tsx`. Esse padrão de captura evita referência obsoleta quando o container é desmontado/remontado (troca de aba, abrir/fechar uma conversa).

---

### ShotsLayout
**Arquivo:** `client/components/layout/shots-layout.tsx`
**Usado por:** Rota `/shots`

Layout especializado para visualização de vídeos em tela cheia:
- Remove o AppLayout padrão
- Footer customizado com navegação específica para Shots
- Badges de notificação mantidos
- Integração com perfil do usuário

---

## Componentes Customizados

### FlowCarousel
**Arquivo:** `client/components/shots/flow-carousel.tsx`
**Usado em:** Feed (Index)

Carrossel horizontal de stories (Flows).
- Primeiro item: story do usuário logado (com botão de criação)
- Demais: stories dos usuários seguidos
- Anel colorido em torno do avatar para story não visto
- Auto-scroll para o início quando abre

---

### FlowCreationDialog
**Arquivo:** `client/components/modals/flow-creation-dialog.tsx`
**Usado em:** Feed (Index)

Dialog para criar um novo story:
- Câmera com obturador inteligente: **toque = foto**, **segurar = grava vídeo** (`MediaRecorder`, áudio opcional, máx. 30s/50MB, indicador de gravação)
- Upload de imagem/vídeo da galeria
- Modo texto/gradiente
- **Enquadramento da mídia na tela de compartilhar:** pinça para redimensionar + arraste para mover (estilo Instagram). Imagem → composta via canvas (`bakeTransformedImage`); vídeo → enquadramento persistido em `flow.media_transform` (%), reaplicado no `FlowViewer`. A camada de gestos também bloqueia gestos nativos do iOS sobre o `<video>`
- Preview/legenda antes de publicar
- Botão confirmar: chama `createStoryDb`

---

### FlowViewerModal
**Arquivo:** `client/components/modals/flow-viewer-modal.tsx`
**Usado em:** Feed (Index), Perfil

Modal de visualização de stories:
- Tela cheia com a imagem do story
- Barra de progresso automática
- Navegação entre múltiplos stories
- Exibe contagem de visualizações (para o dono)
- Swipe ou click para avançar
- Campo de comentário com **EmojiPicker** integrado

---

### PostCarousel
**Arquivo:** `client/components/post/post-carousel.tsx`
**Usado em:** Feed (Index), Perfil, PostDetail, Comunidade (modal de detalhe do check-in de duelo)

Carrossel de imagens de um post:
- Navegação com setas esquerda/direita
- Indicador de posição (dots ou números)
- Swipe em mobile
- Imagens com `ImageWithFallback`
- Prop `tall`: frame alto (calculado via `calc(100dvh - ...)`, até `500px`) em vez do padrão `aspect-square` — usado pelo `PostCard` do feed para que cada post ocupe quase a tela inteira ("1 post por vez" ao rolar)
- Prop `fill`: preenche 100% da altura do container pai via `h-full` (em vez de `aspect-square` ou do cálculo de `tall`) — usado pela tela de Detalhe do Post, cujo container pai já tem altura fixa via flexbox (tem prioridade sobre `tall`)
- Quando `tall`, a foto usa fit adaptativo: `cover` (preenche cortando) por padrão, mas troca para `contain` + fundo desfocado quando a proporção da foto destoa muito da do frame (ex.: canvas quadrado de resumo de treino), para não cortar informação do conteúdo
- **Prop `priority` (2026-07-02):** força `loading="eager"` na primeira/única foto em vez de `"lazy"` — usar quando o carrossel já monta visível dentro de um modal/drawer (ex: detalhe do check-in de duelo), onde "lazy" só atrasa o fetch sem nenhum ganho (não há scroll para "chegar" até a imagem). Não usar em contextos de lista/feed, onde "lazy" evita baixar fotos fora da viewport.
- **Fade-in ao carregar (2026-07-02):** a imagem interna (`ZoomableImage`) começa em `opacity: 0` e transiciona para `1` no `onLoad`, em vez de aparecer abruptamente — o fundo do frame já preenche o espaço, então não há flash de conteúdo vazio.
- **Constantes exportadas `POST_PHOTO_WIDTH`/`POST_PHOTO_QUALITY`:** usadas por quem quiser pré-aquecer (`new Image().src = cdnImg(url, { width: POST_PHOTO_WIDTH, quality: POST_PHOTO_QUALITY })`) a mesma URL transformada que o carrossel vai pedir — ver o prefetch de fotos de check-in em `Community.tsx`, que evita o usuário sentir a latência de cache-frio do endpoint de transform do Supabase Storage ao abrir o modal de detalhe.

---

### PostIncentiveButton
**Arquivo:** `client/components/shared/post-incentive-button.tsx`
**Usado em:** Feed, Shots, PostDetail, Perfil

Botão de reação/incentivo:
- 6 tipos diferentes, cada um com ícone e cor distintos
- Estado ativo/inativo visual
- Estado de loading durante a requisição
- Props: `type`, `isActive`, `onClick`, `loading`, `burst`

Os 6 botões ficam enfileirados na barra de ação de vidro do post (feed e `PostDetail`), e o `QuickIncentiveOverlay` (duplo toque na mídia) oferece os mesmos 6 como atalho.

---

### PostCommentsDialog
**Arquivo:** `client/components/modals/post-comments-dialog.tsx`
**Usado em:** Feed, PostDetail, Perfil

Dialog de comentários de um post:
- Lista de comentários com avatar, nome e texto
- Campo para adicionar comentário com **EmojiPicker** integrado
- Contagem de comentários no botão trigger
- Badge de comentário não lido (para o dono do post)
- Deletar comentário próprio — abre um **`AlertDialog` de confirmação** (título `comments_delete_title`, descrição `comments_delete_desc`, botão de ação em `bg-destructive` com estado de carregamento `comments_deleting`), padronizado para ser idêntico ao modal de exclusão de comentário da tela de Shots. Não usa mais o `confirm()` nativo do navegador
- **`onCountChange?: (count: number) => void`** — callback opcional que reporta ao pai a contagem real de comentários sempre que ela muda (após o load inicial, ao adicionar e ao excluir). Só dispara depois do primeiro load real, para não zerar o contador do trigger com o `[]` inicial. Usado pelo Perfil para manter o contador do post viewer sincronizado
- **Altura fixa** (`height: min(60dvh, viewportHeight - 8px)`, não apenas `maxHeight`) — o drawer sempre nasce no mesmo tamanho, com ou sem comentários, para evitar que o drawer "pule" de tamanho quando o primeiro comentário é postado (o novo comentário nascia atrás do input). A lista interna centraliza o estado vazio/loading verticalmente quando não há comentários. `PromotionCommentsDrawer` segue o mesmo padrão.

---

### PostLikesModal
**Arquivo:** `client/components/modals/post-likes-modal.tsx`
**Usado em:** Feed, Perfil

Modal com lista de usuários que curtiram/incentivaram o post:
- Avatar e nome de cada usuário
- Clicável → navega para o perfil
- Agrupado por tipo de incentivo (opcional)

---

### ExerciseImage
**Arquivo:** `client/components/shared/exercise-image.tsx`
**Usado em:** Metas, Perfil

Card visual de exercício do catálogo:
- Imagem do exercício
- Nome
- Grupo muscular (badge)
- Séries × Repetições configuráveis

---

### DietImage
**Arquivo:** `client/components/shared/diet-image.tsx`
**Usado em:** Metas, Perfil

Card visual de refeição do catálogo:
- Imagem da refeição
- Nome
- Calorias
- Descrição nutricional

---

### EmojiPicker
**Arquivo:** `client/components/shared/emoji-picker.tsx`
**Usado em:** PostCommentsDialog, Shots, FlowViewerModal, Community (check-in)

Seletor de emojis nativo (sem dependência externa):
- 4 categorias: Fitness, Emoções, Gestos, Comida
- Popover posicionável (`placement="top"` ou `"bottom"`)
- Fecha automaticamente ao clicar fora ou selecionar emoji
- Props: `onSelect(emoji)`, `placement`, `triggerClassName`

---

### CheckInCalendarGrid
**Arquivo:** `client/components/shared/check-in-calendar-grid.tsx`
**Usado em:** Metas (`CheckInCalendarModal`), Comunidade (`MemberCheckInsDrawer`)

Grade mensal de check-ins — navegação de mês, cabeçalho de dias da semana e os dias marcados (gradiente laranja; hoje contornado). Só apresentação: quem usa define a moldura (modal em Metas, drawer na Comunidade) e o rodapé.
- Props: `checkInDates` (dias `YYYY-MM-DD` **locais**), `monthsBack` (default 2), `footer(checkInsNoMêsVisível)`
- Exporta `localDateStr(date)` — dia local; nunca usar `toISOString().slice(0,10)`, que devolve o dia em UTC e erra a data a oeste de Greenwich
- O mês visível é estado interno, então **desmontar ao fechar** já reabre em hoje. O `footer` é render prop justamente para o consumidor mostrar a contagem do mês visível sem duplicar esse estado.

---

### ImageWithFallback
**Arquivo:** `client/components/shared/image-with-fallback.tsx`
**Usado em:** Feed, PostDetail, Perfil

Wrapper de imagem com tratamento de erro:
- Exibe imagem original se disponível
- Exibe imagem fallback se a original falhar
- Props: `src`, `alt`, `fallback`, `className`

---

### InlineCropPreview
**Arquivo:** `client/components/shared/inline-crop-preview.tsx`
**Usado em:** NewPost (Etapa 1, foto de post), WorkoutSummaryOverlay (foto do resumo de treino), Comunidade (capa do duelo — wizard Passo 1 e hero do grupo)

> **Frames não-quadrados (2026-07-16):** o módulo assumia frame **quadrado** — `clampedOffset` e `applyTransformToBlob` usavam a largura nos dois eixos. Funcionava por acidente: os dois consumidores originais são 1:1 (NewPost `aspectRatio: 1/1`, WorkoutSummary `540/540`). A capa do duelo é um retângulo largo, então o módulo foi generalizado:
> - `coverBase(imgW, imgH, frameW, frameH)` centraliza o cálculo de "cover" comparando o aspecto da imagem com o **do frame** (antes, com 1). Em frame quadrado o resultado é idêntico ao anterior — verificado para foto 4:3, retrato, 16:9 e 1:1.
> - `InlineCropPreview` **mede as duas dimensões** (`clientWidth`/`clientHeight`) em vez de assumir quadrado. Frames 1:1 não mudam de comportamento, pois lá altura == largura.
> - `clampedOffset(img, containerW, **containerH**, scale, ox, oy)` — parâmetro novo. Era interno; nenhum consumidor importava.
> - `applyTransformToBlob(dataUrl, transform, frameW, frameH?)` — `frameH` **omitido = quadrado**, mantendo as chamadas existentes intactas.
> - Prop nova `containerHeightRef`: obrigatória em frame não-quadrado, para repassar a altura ao `applyTransformToBlob`. Sem ela, o recorte exportado não bate com o preview.
>
> **Bug corrigido junto:** o teto de export (`MAX_EXPORT = 2160`) clampava largura e altura **independentemente** (`Math.min` em cada), o que **achata** a imagem quando só um lado passa do limite. Invisível em 1:1 (os dois lados são iguais e clampam junto). Agora é um fator único aplicado aos dois eixos.

Zoom/pan direto no frame quadrado da foto (pinch-to-zoom + arraste), **sem** passar por uma tela de crop separada (2026-07-02, extraído do `NewPost.tsx` para reuso). Exporta:
- `InlineCropPreview` — componente (canvas) que desenha a foto com o `CropTransform` atual e captura gestos de pointer/touch (drag = pan, pinch = zoom, `MIN_SCALE`–`MAX_SCALE` = 1–5)
- `CropTransform` (`{ scale, offsetX, offsetY }`) e `DEFAULT_TRANSFORM`
- `applyTransformToBlob(dataUrl, transform, containerWidth)` — gera o `Blob` já recortado (JPEG) para upload, replicando visualmente o que o usuário viu no frame
- `getCachedImage(src)` — cache de `HTMLImageElement` decodificado, evita re-decodificar a mesma foto entre re-renders

Cada foto tem seu próprio `CropTransform` guardado por índice (`Record<number, CropTransform>`), reindexado ao remover/reordenar fotos. Como o frame captura o gesto de arraste para pan, telas com múltiplas fotos não podem depender de swipe nativo para navegar entre elas — precisam de setas/dots clicáveis (ver `NewPost.tsx` e `workout-summary-overlay.tsx`).

---

### RouteMap / renderRouteMapImage
**Arquivo:** `client/components/shared/route-map.tsx`
**Usado em:** WorkoutSessionDialog (resumo pós-corrida GPS da "Corrida ao Ar Livre") e WorkoutSummaryOverlay (slide de mapa compartilhável no resumo do treino) — ver `docs/05-metas.md`

Mapa **estático** do trajeto de uma corrida GPS, sem dependências de biblioteca de mapas: `computeRouteLayout` calcula o zoom que enquadra o bbox do trajeto e a grade de tiles **CARTO dark** (`basemaps.cartocdn.com/dark_all`, @2x — combina com o tema glass escuro; atribuição "© OpenStreetMap © CARTO" obrigatória no canto). A mesma matemática alimenta **duas saídas**:
- **`<RouteMap/>`** (DOM): tiles em `<img>` + **polyline** SVG por cima (azul `#5b8cff` com glow; início = ponto verde, fim = laranja). Props: `path: RunPoint[][]` (segmentos — quebra a cada pausa→retomada, sem reta ligando os trechos), `height` e `emptyLabel` (estado vazio quando há < 2 pontos).
- **`renderRouteMapImage(path, stats, size=1080)`** (async → `Blob | null`): desenha o mapa num **canvas quadrado** e devolve **JPEG pronto para upload** (slide compartilhável do resumo do treino). Tiles carregados com `crossOrigin:"anonymous"` para não "sujar" o canvas (tile sem CORS é pulado); rodapé com **distância/tempo/ritmo** sobre gradiente escuro (rótulos localizados vêm em `stats.labels`; valores formatados por `formatRunTime`/`formatRunPace` de `run-tracker.ts`) e atribuição no canto. Se `toBlob` falhar por canvas tainted, **redesenha sem tiles** (rota sobre fundo escuro) — a imagem continua válida offline.

Estático de propósito (sem pan/zoom): é um resumo pós-corrida, não um mapa navegável. Requer rede para os tiles (sem CSP no app).

---

### WorkoutDetailButton
**Arquivo:** `client/components/shared/workout-detail-dialog.tsx`
**Usado em:** Feed (`PostCard`), Perfil (viewer de post), PostDetail

Pill **"Ver treino"** + drawer glass **simplificado** de detalhe do treino, renderizado apenas em posts que carregam um `workout_summary` (posts de resumo de treino compartilhados no feed). Props: `summary: PostWorkoutSummary` (tipo em `client/lib/workout-summary-types.ts`) e `className` (posicionamento do pill). O drawer (padrão glass §9.4) mostra **só** a lista de exercícios: cada linha com a **miniatura do exercício** (`ExerciseImage`, fallback gradiente/emoji por grupo quando sem foto), nome + grupo muscular e as **séries em chips `{kg}kg × {reps}`** — sem stats/banners (o overlay completo é o `WorkoutSummaryOverlay` na tela de Metas). Optou-se por pill dedicado em vez de tornar a imagem inteira clicável, para não conflitar com o duplo-toque de incentivo, o pinch-zoom e o swipe de carrossel já existentes na imagem do post. Ver `docs/01-feed.md` (Detalhe do treino) e `docs/14-database-schema.md` (`posts.workout_summary`).

---

### TagPeopleDrawer
**Arquivo:** `client/components/shared/tag-people-drawer.tsx`
**Usado em:** NewPost (Etapa 2 — "Marcar pessoas") e EditPostDrawer (seção "Pessoas marcadas" — abre por cima do drawer de edição)

Drawer glass de **marcação de pessoas em um post** (estilo Instagram). Seleção controlada pelo pai via `selected: SearchUser[]` / `onChange`:
- Ao abrir, lista quem o usuário segue (`getFollowingDb`); a busca filtra os seguidos **e** procura qualquer pessoa do app (`searchUsersDb`, debounce 300ms), mesclando sem duplicatas e excluindo o próprio usuário
- Cada linha: `UserAvatar` + nickname + check circular (gradiente azul→roxo quando selecionado)
- Limite exportado `MAX_TAGGED_PEOPLE = 10` — exceder mostra toast destrutivo
- Botão "Concluir (n)" apenas fecha (a seleção já está no pai)
- Props: `open`, `onOpenChange`, `selected`, `onChange`

---

### SendToFriendDrawer (2026-07-12)
**Arquivo:** `client/components/shared/send-to-friend-drawer.tsx`
**Usado em:** Feed (via `ShareDrawer` → botão "Amigos"), PostDetail (avião de papel na barra de ações) e Shots (avião de papel na coluna de ações)

Drawer glass de **envio de post/shot para amigos via mensagem privada** (estilo Instagram):
- Ao abrir, lista **conversas recentes primeiro** (`getConversationsDb`) seguidas de quem o usuário segue (`getFollowingDb`), sem duplicatas; busca global via `searchUsersDb` (debounce 300ms) permite enviar para quem não é seguido
- Preview compacto do conteúdo no topo (thumbnail do post ou frame do vídeo do shot + @autor)
- Multi-seleção (mesmo padrão visual do `TagPeopleDrawer`, limite 10 destinatários) + campo de **mensagem opcional**
- Ao enviar: `sendMessageDb(recipientId, "[post]:<id>" | "[shot]:<id>")` por destinatário (em paralelo); se houver texto opcional, é enviado como segunda mensagem; toast de sucesso/erro
- Props: `open`, `onOpenChange`, `content: SendableContent | null` (`{ kind: "post" | "shot", id, previewImage?, authorNickname? }`)
- No chat da Comunidade, essas mensagens são renderizadas pelo **`SharedContentMessage`** (`client/components/community/shared-content-message.tsx`): card clicável com autor, thumbnail, descrição e "Ver post"/"Ver shot"; conteúdo apagado mostra "Conteúdo indisponível". Ver `docs/07-comunidade.md`
- **`ShareDrawer`** ganhou a prop opcional `onSendToFriend?: () => void` — quando presente, exibe o botão "Amigos" (gradiente do app + `SendHorizontal`) como primeira opção da fileira de apps; o pai fecha o share e abre este drawer

---

### FollowListDrawer (estendido para listas genéricas de usuários)
**Arquivo:** `client/components/profile/follow-list-drawer.tsx`
**Usado em:** Perfil (seguidores/seguindo), Feed (`PostCard`) e PostDetail (lista "Pessoas marcadas" de um post)

Além do uso original com `type: "followers" | "following"`, aceita `title` e `emptyMessage` opcionais que sobrescrevem os textos derivados de `type` — é assim que o feed/detalhe reutilizam o drawer para mostrar os marcados de um post (2+ pessoas). Quando o pai não passa `followStatus` em batch, o `FollowButton` de cada linha busca o próprio status (`initialIsFollowing` fica `undefined`). Strings padrão traduzidas via `t()` (`profile_followers`, `profile_following`, `follow_list_empty_*`).

---

### UserInsignias
**Arquivo:** `client/components/profile/user-insignias.tsx`
**Usado em:** Feed, Perfil

Exibe badges/conquistas do usuário:
- Ícones coloridos representando conquistas
- Tooltip com nome da conquista
- Baseadas em pontos, streaks, número de posts, etc.

---

### AnimatedLoading
**Arquivo:** `client/components/shared/animated-loading.tsx`

Componentes de estado de loading:
- `LoadingSpinner` — spinner circular animado
- `PostSkeleton` — skeleton de card de post
- Outros skeletons para diferentes contextos

---

### FloatingActionMenu
**Arquivo:** `client/components/layout/floating-action-menu.tsx`

Menu de ação flutuante para mobile:
- Botão arrastável (posição salva em localStorage)
- Ao clicar, expande com atalhos de navegação
- Permite acesso rápido às principais telas sem usar a bottom nav

---

### ThemeProvider
**Arquivo:** `client/components/layout/theme-provider.tsx`

Provedor de tema dark/light:
- Wraps a aplicação inteira
- Persiste preferência em localStorage
- Integrado com `next-themes`

---

## Hooks Customizados

### useAuth
**Arquivo:** `client/hooks/useAuth.ts`

Gerencia estado de autenticação:
- `user` — usuário logado (ou null)
- `loading` — se ainda está verificando a sessão
- Integrado com Supabase Auth

---

### useLayoutMode
**Arquivo:** `client/hooks/useLayoutMode.ts`

Detecta o modo de layout:
- `layoutMode` — `"mobile"` ou `"desktop"`
- Posição do FAB (Floating Action Menu)

---

### use-mobile
**Arquivo:** `client/hooks/use-mobile.tsx`

Hook simples para detectar mobile:
- Baseado em `window.innerWidth`
- Retorna `true` se largura < breakpoint

---

### useEdgeSwipeBack
**Arquivo:** `client/hooks/use-edge-swipe-back.ts`
**Usado por:** AppLayout (aplicado ao `<main>`)

Gesto de "voltar" estilo iOS — arrastar da borda esquerda para a direita retorna à tela anterior visitada:
- **Assinatura:** `useEdgeSwipeBack(ref, enabled)` — `ref` do elemento que desliza; `enabled` para desligar por rota
- **Lógica de voltar:** `navigate(-1)` (history back). Como toda navegação entre telas usa `<Link>` (empilha histórico), voltar uma entrada é sempre a última tela visitada
- **Só edge-swipe:** o toque precisa iniciar nos primeiros 30px da borda esquerda, evitando conflito com carrosséis horizontais internos (PostCarousel, FlowViewer, InlineCropPreview)
- **Trava de direção:** se o movimento inicial for mais vertical que horizontal, trata como scroll e cancela
- **Confirmação:** solta acima de ~32% da largura da tela (mín. 70px) **ou** flick rápido (≥ 0.5px/ms) → `hapticLight()` + `navigate(-1)`
- **Feedback visual:** desliza o `<main>` com o dedo (transform GPU, sem re-render); ao confirmar, anima a tela anterior deslizando da esquerda até 0
- **Guardas:** não dispara se `history.state.idx === 0` (sem tela anterior, evita sair do app) nem com dialog/drawer aberto (`[role="dialog"]`/`[role="alertdialog"]`/`[vaul-drawer]`)

---

## Serviços

### post.service.ts
**Arquivo:** `client/services/post.service.ts`

Funções de acesso a dados para posts:
- `getFeedPosts()` — posts do feed (seguindo)
- `getDiscoverPosts()` — posts para descoberta
- `togglePostLike(postId, type)` — toggle de incentivo
- Tipo `PostWithStats` — post com contagens de likes/comentários

---

## Bibliotecas Principais

### ritmofit-db.ts
**Arquivo:** `client/lib/ritmofit-db.ts`
**Tamanho:** ~173KB (arquivo mais grande do projeto)

Centraliza **todas** as funções de acesso ao banco de dados Supabase.
Organizado por domínio:
- Usuários (perfil, follow, stats)
- Posts (CRUD, likes, comentários)
- Shots (CRUD, incentivos, comentários)
- Stories/Flows
- Metas e rotinas
- Treinos, dietas, hábitos
- Comunidade (mensagens, duelos, ranking)
- Notificações
- Check-ins e pontuação
- Perfil comercial

---

### supabase.ts
**Arquivo:** `client/lib/supabase.ts`

Cliente Supabase configurado:
- `supabase` — instância do cliente
- `hasSupabaseConfig` — boolean se variáveis de ambiente estão presentes

---

### exercise-catalog.ts / diet-catalog.ts
**Arquivos:** `client/lib/exercise-catalog.ts`, `client/lib/diet-catalog.ts`

Catálogos locais de exercícios e refeições:
- `fetchExerciseCatalog()` — retorna lista de exercícios com imagem, nome e grupo muscular
- `fetchMealCatalog()` — retorna lista de refeições com imagem, nome e calorias

---

### network-status.ts
**Arquivo:** `client/lib/network-status.ts`

Monitora conectividade:
- `getNetworkStatus()` — estado atual (`isOnline`, `isSupabaseReachable`)
- `addNetworkStatusListener(callback)` — escuta mudanças
- `checkSupabaseReachability()` — teste de conexão com Supabase

---

### i18n.ts / language-context.tsx
**Arquivos:** `client/lib/i18n.ts`, `client/lib/language-context.tsx`

Sistema de internacionalização:
- Hook `useLanguage()` → retorna função `t(key)` para traduções
- Suporte a múltiplos idiomas (configurável)

---

### DrawerContent (comportamento com teclado iOS)
**Arquivos:** `client/components/ui/drawer.tsx`, `client/lib/keyboard.ts`, `client/hooks/use-keyboard-aware-height.ts`, `client/global.css`

Todos os drawers (bottom sheets) do app são renderizados por `DrawerContent`. Desde **2026-07-06**, o teclado do iOS é tratado com **`resize: 'none'` + ergonomia via CSS var** (substituiu o `resize: 'native'` de 2026-07-03, que causava delay de ~1s + piscada — o resize do frame do WKWebView acontecia *depois* da animação do teclado e forçava relayout/repaint da página inteira):

- **`capacitor.config.ts` → `Keyboard: { resize: 'none' }`**: o frame do WKWebView **nunca** muda quando o teclado abre — o teclado apenas sobrepõe o webview. Zero reflow global, zero piscada. `window.innerHeight` e unidades `dvh` ficam constantes.
- **`client/lib/keyboard.ts` (tracker global, singleton iniciado em `App.tsx`)**: escuta os eventos nativos `keyboardWillShow`/`keyboardWillHide` (disparam no **início** da animação do teclado, já com `keyboardHeight`) e publica:
  - CSS var **`--keyboard-height`** no `<html>` (px; `0px` fechado);
  - classe **`kb-open`** no `<html>` enquanto o teclado está visível;
  - subscribers JS (usados por `useKeyboardAwareHeight`);
  - *scroll assist*: para inputs no fluxo normal da página (fora de drawers/dialogs — ex.: Login, NewPost, Search), rola a janela o suficiente para o campo ficar acima do teclado.
- **Lift wrapper em `drawer.tsx`**: o sheet do vaul é envolvido por um `div fixed inset-0 pointer-events-none` com `transform: translateY(calc(-1 * var(--keyboard-height)))` + `transition` (curva do teclado iOS, 0.28s). Como um ancestral com transform vira o *containing block* de descendentes `fixed`, o sheet inteiro sobe em sincronia com o teclado, via GPU. **Nunca aplicar transform/transition no elemento do próprio vaul** — o vaul muta `transform`/`transition` inline para abrir/fechar/arrastar e qualquer estilo nosso ali briga com ele.
- **Clamp em `global.css`**: `html.kb-open [data-vaul-drawer][data-vaul-drawer-direction="bottom"] { max-height: calc(100dvh - var(--keyboard-height) - 12px) !important }` — garante que nenhum sheet erguido estoure o topo da tela, mesmo drawers com `maxHeight: 90dvh` estático.
- **Dialogs centrados (`dialog.tsx`)**: o wrapper de centralização soma `var(--keyboard-height)` ao padding inferior (com transition), recentralizando o dialog na área visível acima do teclado.
- **`useKeyboardAwareHeight`** agora retorna `window.innerHeight - getKeyboardHeight()` (do tracker) — continua sendo "a área visível acima do teclado", atualizada em sincronia com a animação. Consumidores não mudam: `maxHeight: min(XXdvh, ${viewportHeight - 8}px)` + `flex-1 min-h-0` na área scrollável.
- O `repositionInputs` do vaul continua **explicitamente desligado** (`repositionInputs={false}`) — depende de eventos de `visualViewport` instáveis no WKWebView. **Não reativar.** Também continua valendo: nenhum componente deve rodar handler próprio de `visualViewport` para mover drawers.

#### `handleOnly` — fechar só pela alça (2026-07-16)

Prop opt-in (`handleOnly`) no `<Drawer>` **e** no `<DrawerContent>`. Quando ligada, arrastar para baixo só fecha o drawer a partir da **alça** (a pílula do topo); um swipe no **corpo** (rolar a lista, tocar numa opção, digitar) **nunca** dispara o dismiss. Resolve o miss-click de fechar sem querer durante a interação — relatado nos drawers de criar rotina de dieta/hábito.

- **Mecanismo (vaul):** com `handleOnly`, o `onPointerDown`/`onPointerMove` do corpo do sheet retorna cedo (`if (handleOnly) return`), então o corpo não inicia arraste; só o `<Drawer.Handle>` inicia (via `onPress`). Por isso o `DrawerContent`, no modo `handleOnly`, renderiza a alça como **`DrawerPrimitive.Handle`** (que o vaul reconhece) em vez do `<div>` decorativo. As demais formas de fechar continuam: **tocar no overlay**, botões **Cancelar/fechar**, e o **voltar** do Android/gesto.
- **Aparência:** o vaul injeta estilos default de `[data-vaul-handle]` em runtime, que venceriam utilitárias de igual especificidade; a pílula é forçada com `!` (`!h-1 !w-[38px] !rounded-full !bg-white/25 !opacity-100`), e o `handleClassName` segue mandando na margem. `preventCycle`: sem snap points, o clique na alça não faz nada.
- **É opt-in de propósito** (default `false`): não muda os ~40 drawers do app. Ligado nos de digitação/seleção da tela de Metas: `create-wizard-drawer`, `food-diary-card`, `goal-detail-drawer`, `routine-detail-drawer`, `goal-share-drawer`. Para ligar em outro drawer, passar `handleOnly` nos **dois** (`<Drawer>` e `<DrawerContent>`).
- **Bônus:** como o corpo deixa de capturar o gesto para arraste, o **scroll interno** fica mais confiável.

#### Empilhamento (z-index) — regra do overlay dentro do lift wrapper (2026-07-13)

O lift wrapper tem `transform`, e todo elemento com `transform` cria um **stacking context**. Por isso o `z-index` que um sheet declara (`className="z-[500]"`, `z-[330]`, …) só vale **dentro** do wrapper — para o resto da página o sheet continua valendo `z-[310]` (o z do wrapper). Enquanto o overlay ficou **fora** do wrapper, qualquer overlay com z > 310 (ex.: `!z-[490]` do `ImageCropperDrawer`, `z-[320]` dos drawers empilhados de Comunidade) era pintado **por cima do próprio sheet** — tela escura/fosca e nenhum toque funcionando.

- **O `DrawerOverlay` é renderizado dentro do lift wrapper**, junto com o sheet. Overlay e sheet compartilham o mesmo stacking context, então `overlay z-490` + `content z-500` volta a significar o que o autor escreveu.
- O overlay leva `pointer-events-auto` (o wrapper é `pointer-events-none`) e `bottom: calc(-1 * var(--keyboard-height))`, para continuar cobrindo a tela inteira quando o wrapper sobe com o teclado.
- **Empilhar drawers** (um drawer aberto por cima de outro): não é preciso mexer em z-index — todos os wrappers são `z-[310]` e o portal aberto por último entra depois no DOM, logo pinta por cima. Só use z-index custom para ordenar overlay × conteúdo **do mesmo drawer**.

> **Regra prática (2026-07-16): não declare z-index no `DrawerContent`.** O padrão (content `z-[310]` > overlay `z-[300]`) já está certo, e o `cn()` usa `twMerge` — então um `className="z-[100]"` **substitui** o `z-[310]` da base e enterra o conteúdo sob o próprio overlay.
>
> Foi exatamente o que aconteceu: os drawers nasceram com `z-[100]` para empatar com o overlay da época (`z-[100]`/content `z-[110]`), vencendo por ordem no DOM. O commit `3cb0b34` (2026-05-15) subiu a base para `z-[300]`/`z-[310]` e não atualizou quem fixava o valor na mão — desde então `AddMembers`, `NewConversation`, `EditCheckIn`, `SendToFriend` e `TagPeople` abriam **escurecidos e sem aceitar toque** (overlay `bg-black/80` por cima), e o `ClassificationsDrawer` abria visível mas **engolia os toques** (overlay `bg-transparent`). Corrigido em 2026-07-16 removendo o override dos seis.
>
> Sintoma típico: drawer abre fosco/escuro, ou visível mas todo toque fecha em vez de acionar. Primeiro lugar a olhar: z-index no `DrawerContent`.

---

## Estilos de Drawer Glass (`client/lib/glass-styles.ts`)

Fonte única de verdade para o **padrão glass escuro** dos drawers (promoções, duelos, comentários). Em vez de repetir estilos inline, importe os tokens:

| Export | Tipo | Uso |
|---|---|---|
| `GLASS_SHEET_PROPS` | props | Spread no `DrawerContent` — handle branco + `!rounded-t-[32px] !border-0` |
| `GLASS_SHEET_STYLE` | `CSSProperties` | `style` do `DrawerContent` — gradiente escuro + blur + `maxHeight: 90dvh` |
| `GLASS_FIELD_STYLE` / `GLASS_FIELD_CLASS` | style/classe | Inputs, Textareas e SelectTrigger |
| `GLASS_PRIMARY_BTN_STYLE` | `CSSProperties` | Botão principal (gradiente azul → roxo) |
| `GLASS_PANEL_STYLE` | `CSSProperties` | Cards / containers translúcidos **dentro** de um sheet |
| `GLASS_CARD_STYLE` | `CSSProperties` | Card / superfície de vidro **sobre a página** (fora de sheets) — tem `backdrop-filter` próprio |
| `GLASS_LABEL_CLASS` | classe | Labels de formulário |

Detalhes e exemplo completo: `docs/15-design-system.md` §9.4. Consumidores atuais: `Store.tsx` (drawers de promoção), `Community.tsx` (drawers de duelos + toda a tela do grupo/histórico de check-ins, via `GLASS_CARD_STYLE`) e os componentes `ClassificationsDrawer` / `AddMembersDrawer` / `EditCheckInDrawer`.
