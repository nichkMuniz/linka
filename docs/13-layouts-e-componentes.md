# Layouts e Componentes Compartilhados

---

## Estrutura de Pastas (`client/components/`)

```
client/components/
├── ui/             ← Shadcn UI (não mexer)
├── layout/         ← Componentes estruturais globais (AppLayout, ShotsLayout, ThemeProvider, FloatingActionMenu)
├── shared/         ← Componentes reutilizáveis em 2+ domínios (ImageWithFallback, AnimatedLoading, PostIncentiveButton, ExerciseImage, DietImage, EmojiPicker, InlineCropPreview, RouteMap, RunSplitsList, CheckInCalendarGrid, ReportDrawer, ReportProblemDrawer, IncomingMessageToast, ShotThumb)
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
- **Vibração ao receber notificação:** A subscription realtime (`app-layout-notif-push`, canal `notifications`) dispara `hapticSuccess()` (`client/lib/haptics.ts`) para qualquer INSERT na tabela `notifications` do usuário logado — independentemente do tipo (follow, incentivo, comentário, duelo, reação) e da tela em que o usuário está, inclusive na própria tela de Notificações. Roda antes da checagem que pula a notificação local visual (`LocalNotifications.schedule`) quando o usuário já está em `/notificacoes`, então a vibração sempre ocorre mesmo quando o banner é suprimido. Sem efeito fora do runtime nativo (Capacitor) — `hapticSuccess()` é no-op no browser. **Exceção: mensagem privada (`type 10`)** sai do handler antes da vibração — quem avisa DM em primeiro plano é o canal de `messages` (item seguinte), e vibrar nos dois seria aviso duplo da mesma mensagem
- **Pop up de mensagem recebida (2026-08-06):** a subscription `app-layout-messages` (INSERT em `messages` com `following_id = usuário logado`) dispara `hapticLight()` — vibração leve, em qualquer tela — e publica no pub/sub `client/lib/incoming-message-toast.ts`, exibido pelo `IncomingMessageToast` montado ao lado dos outros overlays globais. O banner mostra avatar, apelido e preview da mensagem; toque abre `/comunidade?user=<remetente>`. **Suprimido** (só vibra) quando a conversa daquele remetente já está aberta na tela — `getActiveConversationUserId()`. Disparado **fora** do debounce de 1s que existe nesse handler: o debounce protege só a query do badge, o aviso precisa ser instantâneo. Detalhes em `docs/10-notificacoes.md`
- **Refetch de badges no refresh do feed:** contadores são carregados no mount e mantidos via subscription realtime do Supabase (que pode cair silenciosamente em background no iOS). Para evitar badge desatualizado, o `AppLayout` também escuta os eventos `ritmofit-refresh-feed` (toque no logo/home) e `ritmofit-refresh-badges` (disparado pelo pull-to-refresh em `Index.tsx`) e refaz o fetch de `getUnreadMessageCountDb`/`getUnreadNotificationsCountDb` a cada um deles
- **Invalidação no realtime dos badges (performance):** os handlers realtime chamam `invalidateQueryCache("unreadMsgCount"/"conversations")` **antes** de reler o contador. `getUnreadMessageCountDb`/`getUnreadNotificationsCountDb` são cacheadas (30s); sem invalidar, o evento realtime relia a própria entrada em cache e o badge só acertava quando o TTL vencia — o realtime virava no-op
- **Tempo de tela bufferizado (performance):** a troca de rota **não vai mais ao banco**. `bufferScreenTime(tela, segundos)` acumula em `localStorage` (somado por dia+tela) e `flushScreenTimeDb(userId)` envia tudo num **único insert em lote** quando o app vai para background (`appStateChange`/`visibilitychange`), no logout (`settings-drawer`, antes do `signOut` por causa do RLS) e na abertura seguinte (resíduo de sessão encerrada abruptamente). Antes: 1 INSERT por navegação
- **Limite diário sem polling (performance):** a mudança do limite é sinalizada pelo evento `lk:daily-limit-changed` (disparado pelo `settings-drawer` ao salvar) + revalidação no `visibilitychange` (cobre a virada do dia). Substituiu um `setInterval` de 5s que rodava em toda tela, para sempre, só para vigiar uma chave de `localStorage` — o evento nativo `storage` não serve, pois só dispara em outra aba
- **Toast de sincronização offline (2026-07-11):** escuta o evento global `linka-offline-synced` (`OUTBOX_SYNCED_EVENT` de `client/lib/offline-outbox.ts`) e mostra o toast `goals_sync_done_title/desc` em qualquer tela quando a fila de escritas feitas sem internet (treinos/check-ins da tela de Metas) termina de sincronizar — ver "Modo offline" em `docs/05-metas.md`
- **Foto de perfil:** Carregada dinamicamente no ícone de Perfil
- **Bottom Navigation (mobile):** 5 itens fixos na parte inferior
- **Side Navigation (desktop):** Navegação lateral em telas grandes, com botão para **expandir/colapsar** entre 244px (com rótulos) e 68px (só ícones), persistido em `localStorage` (`ritmofit_sidebar_expanded`). **Expansão instantânea (sem animação de largura):** o `<aside>` e o wrapper de conteúdo **não** têm `transition` de largura/margem. Antes, animar o `width` de 68→244px reflui os rótulos enquanto o container ainda está estreito, fazendo as letras "montarem" verticalmente para depois virar horizontal. Agora a barra dá **snap** direto e os nomes das telas já aparecem posicionados. Rótulos usam `whitespace-nowrap` como reforço contra qualquer reflow
- **Timer de uso diário:** Monitora tempo de sessão
- **Limite diário:** Se o usuário configurou um limite, bloqueia o app ao atingir
- **Floating Action Menu:** Menu flutuante arrastável (mobile)
- **Swipe da borda esquerda → voltar (mobile):** Arrastar da borda esquerda para a direita volta para a **tela anterior visitada** (history back). Implementado pelo hook `useEdgeSwipeBack` (`client/hooks/use-edge-swipe-back.ts`), aplicado ao `<main>` do AppLayout via `mainRef`. O conteúdo desliza acompanhando o dedo (header e bottom nav ficam fixos), e ao soltar acima do limiar (~32% da largura ou flick rápido) dispara `hapticLight()` + `navigate(-1)`, animando a tela anterior deslizando da esquerda. Só inicia na faixa de 30px da borda esquerda (para não sequestrar carrosséis horizontais internos), ignora scroll vertical (trava de direção), não dispara com dialog/drawer aberto nem quando não há histórico anterior (`history.state.idx === 0`, evita sair do app). **Desligado em `/postar`** (voltar perderia o rascunho do novo post).

#### Desktop — frame de conteúdo
Em desktop (md+), o conteúdo é limitado a `max-w-[680px]` centralizado após a sidebar (244px). Todas as sobreposições fixas (Dialogs, Drawers) respeitam esse frame usando a classe `md-modal-centered` / `md-drawer-centered` definida em `global.css`, que ajusta o `left` para `calc(50vw + 122px)` (centro do frame de conteúdo).

#### Header/Bottom Nav flutuantes (mobile) — bounce elástico do iOS
Header e Bottom Nav são `position: fixed` com `top`/`bottom` calculados a partir de `env(safe-area-inset-*)`. No WKWebView do iOS, o bounce elástico nativo (rubber-band) pode deslocar/"descolar" momentaneamente elementos fixos durante o overscroll — mais perceptível em telas com safe area maior (Dynamic Island). Como o Feed já implementa seu próprio gesto de pull-to-refresh via touch handlers (`Index.tsx`), o bounce nativo é redundante e foi desativado globalmente com `overscroll-behavior-y: none` em `html`/`body` (`global.css`), eliminando o glitch sem afetar o pull-to-refresh custom.

#### Header flutuante — auto-ocultar ao rolar (mobile)
Nas rotas `/`, `/shots`, `/vitrine`, `/metas`, `/perfil` e `/usuario/:id`, o header pill flutuante some ao rolar para baixo (>96px de scroll e delta > 30px) e reaparece ao rolar para cima (delta < -30px), controlado pelo estado `headerHidden` em `AppLayout` (classe `-translate-y-[200%]` quando oculto). O listener é sempre no `window` (a página inteira rola — `Goals.tsx` usa fluxo normal de documento, sem container de altura fixa).

> **`/comunidade` está fora de propósito (2026-07-21).** A Comunidade tinha um caminho próprio: como a tela é um container de altura fixa com scroll interno, o `AppLayout` escutava `scroll` em fase de captura no `document` filtrando pelo atributo `data-community-scroll-container`, e a `Community.tsx` espelhava a mesma lógica para esconder a barra de abas. **Tudo isso foi removido** — o header e as abas atrapalhavam mais do que ajudavam ali: com uma aba montada por vez e vários containers roláveis (lista de conversas, duelos, ranking, grupo), o header ia e vinha em transições que não eram scroll do usuário, e a barra de abas — que é a navegação principal da tela — sumia justo quando se queria trocar de aba. Não reintroduzir o atributo `data-community-scroll-container`.

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
- **Salvar rascunho** (botão abaixo de "Compartilhar flow"): grava o flow como ele está na **galeria do celular**, sem publicar. Imagem/gradiente são compostos num canvas (`buildDraftCanvas` → `bakeTransformedCanvas` + `drawTextsOnCanvas` / `paintCssGradient`); vídeo é salvo como está, sem as frases. A escrita usa `saveMediaToPhotos` (`client/lib/native-media.ts`)
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
- **Constantes exportadas `POST_PHOTO_WIDTH`/`POST_PHOTO_QUALITY`:** usadas por quem quiser pré-aquecer (`new Image().src = cdnImg(url, { width: POST_PHOTO_WIDTH, quality: POST_PHOTO_QUALITY })`) a mesma URL que o carrossel vai pedir — ver o prefetch de fotos de check-in em `Community.tsx`, que evita o usuário sentir a latência do primeiro fetch ao abrir o modal de detalhe. Desde 2026-08-14 `cdnImg` devolve a URL original (ver *Pipeline de imagens* abaixo), então o prefetch aquece o próprio objeto no CDN — o padrão de uso não muda.

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
- Props `cdnWidth`/`cdnHeight`/`cdnQuality`/`cdnResize`: repassadas a `cdnImg()`. **Inertes desde 2026-08-14** — ver *Pipeline de imagens* abaixo. Mantidas porque descrevem o tamanho real de exibição de cada uso e voltam a valer se a flag for religada.

---

### Pipeline de imagens (`client/lib/image-url.ts` + `image-compress.ts`) — 2026-08-14

**A regra:** a imagem sobe do tamanho em que vai ser exibida. Nada é redimensionado na entrega.

Antes, o app subia o original grande (2160px q0.92) e pedia miniaturas ao endpoint `/storage/v1/render/image/public/` da Supabase via `cdnImg()`. A Supabase cobra **Image Transformations por imagem de origem distinta transformada no mês** — não por requisição. Como todo avatar, toda foto de post e todo flow passavam por lá, o contador crescia linear com a base de usuários e estourou a cota (113/100). Cache de CDN e dedup de request não movem esse número: só reduzir **quantos arquivos diferentes** passam pelo endpoint.

| Origem | Onde o tamanho é definido | Teto | Qualidade |
|---|---|---|---|
| Foto de post, check-in de duelo, capa de grupo, foto do resumo de treino | `inline-crop-preview.tsx` → `applyTransformToBlob` | 1440px | 0.82 |
| Capa de perfil, foto de promoção | `image-cropper-drawer.tsx` (padrão) | 1440px | 0.82 |
| Avatar e logo comercial | `image-cropper-drawer.tsx` via `maxExport={AVATAR_MAX_EXPORT}` | 512px | 0.82 |
| Foto de flow (câmera e galeria) | `flow-creation-dialog.tsx` → `PHOTO_MAX_DIM`/`PHOTO_JPEG_QUALITY` | 1280px | 0.85 |
| Card de resumo de treino e de meta concluída | `canvas-card.ts` → `cardCanvasToBlob()` | 1620px (`CANVAS_SCALE` 3) | 0.92 |
| Arquivo cru do seletor: foto de exercício custom, imagem de conversa privada, foto adicionada no `EditCheckInDrawer` | `image-compress.ts` → `compressImageFile()` | 1440px | 0.82 |

- **`cdnImg()` virou pass-through** — a flag `STORAGE_TRANSFORMS_ENABLED` (em `image-url.ts`) está `false` e a função devolve a URL do objeto. Os call sites (`ImageWithFallback`, `PostCarousel`, `FlowViewer`, `today-dashboard`, `Community`) continuam chamando de propósito: religar a flag restaura o comportamento antigo sem tocar em tela nenhuma.
- **`compressImageFile(file, maxDim?, quality?)`** é a rede de segurança para os fluxos que sobem o arquivo direto do seletor, sem cropper: adicionar foto no `EditCheckInDrawer`, o fallback da capa de grupo no wizard de duelo (quando o frame nunca foi medido), a foto de exercício custom (`uploadCustomExercisePhotoDb`) e a imagem de conversa privada (`uploadMessageImageDb`). Nunca lança — se o WebView não decodificar (HEIC exótico, arquivo corrompido), devolve o arquivo original: melhor subir grande do que impedir o usuário de publicar.
- **Ao criar um upload novo:** passe pelo cropper, por `applyTransformToBlob`, por `compressImageFile` ou — se for um card em canvas — por `cardCanvasToBlob`. Subir um `File` cru do `<input type="file">` (ou um `toBlob("image/png")`) é o antipadrão: sem o transform na entrega, o app baixa o arquivo inteiro para desenhar uma miniatura.
- **Imagens publicadas antes de 2026-08-14** continuam grandes no bucket. Não quebram nada, só gastam mais banda até serem substituídas.
- **Ciclo de vida — excluir conteúdo apaga o arquivo (2026-08-14):** `deletePostDb`, `deleteShotDb`, `deleteStoryDb` e `deleteGroupCheckInDb` leem as colunas de mídia **antes** do DELETE e chamam `removeStorageObjects()`. Exige a migração `20260814-storage-delete-policies.sql` — sem a policy, `storage.remove()` volta 200 com lista vazia e não apaga nada. Detalhes (formatos de caminho, quem limpa o quê, a armadilha do repost) em `docs/14-database-schema.md`, seção *Bucket `posts` — remoção de mídia*.

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
> **Bug corrigido junto:** o teto de export clampava largura e altura **independentemente** (`Math.min` em cada), o que **achata** a imagem quando só um lado passa do limite. Invisível em 1:1 (os dois lados são iguais e clampam junto). Agora é um fator único aplicado aos dois eixos. O mesmo tratamento foi aplicado ao `ImageCropperDrawer` em 2026-08-14.

> **Teto de export (2026-08-14):** `MAX_EXPORT` caiu de 2160 → **1440px** e a qualidade JPEG de 0.92 → **0.82** (`JPEG_QUALITY`). O card do feed tem ~430px CSS no iPhone (~900px depois do DPR), então 1440 sobra; o que existia acima disso só servia para o endpoint de transform da Supabase encolher de novo na entrega. Ver *Pipeline de imagens*.

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

### RunSplitsList
**Arquivo:** `client/components/shared/run-splits.tsx`
**Usado em:** WorkoutSessionDialog (resumo pós-corrida GPS) e WorkoutSummaryOverlay (seção "Corrida ao ar livre" do resumo do treino) — ver `docs/05-metas.md`

Lista das **parciais por km** de uma corrida GPS (`RunSplit[]` de `run-tracker.ts`), na linguagem dos apps de corrida: colunas **Km · Tempo · Ritmo (/km)**, uma linha por quilômetro. Cada linha tem uma **barra proporcional à velocidade do trecho** (`fastestPace / paceSecPerKm`, com piso de 28% para o km mais lento continuar visível), o **km mais rápido** ganha o selo ⚡ (calculado só entre os km **fechados** — um trecho parcial de 80 m não é comparável a um km inteiro) e o **trecho final incompleto** aparece com a distância percorrida (ex.: `0,4`) e o selo `parcial`.

Props: `splits`, `accent` (cor das barras/destaques — quem chama passa a cor do contexto: azul da sessão ou o acento do template escolhido no resumo) e `maxRows` (0 = todas; > 0 mostra N linhas com "Ver todos/Mostrar menos"). Renderiza `null` sem parciais. Tokens de cor **fixos em branco translúcido**: as duas telas que o usam são shells "liquid glass" escuros independentemente do tema.

---

### WorkoutDetailButton
**Arquivo:** `client/components/shared/workout-detail-dialog.tsx`
**Usado em:** Feed (`PostCard`), Perfil (viewer de post), PostDetail

Pill **"Ver treino"** + drawer glass **simplificado** de detalhe do treino, renderizado apenas em posts que carregam um `workout_summary` (posts de resumo de treino compartilhados no feed). Props: `summary: PostWorkoutSummary` (tipo em `client/lib/workout-summary-types.ts`) e `className` (posicionamento do pill). O drawer (padrão glass §9.4) mostra **só** a lista de exercícios: cada linha com a **miniatura do exercício** (`ExerciseImage`, fallback gradiente/emoji por grupo quando sem foto), nome + grupo muscular e as **séries em chips `{kg}kg × {reps}`** — sem stats/banners (o overlay completo é o `WorkoutSummaryOverlay` na tela de Metas). Optou-se por pill dedicado em vez de tornar a imagem inteira clicável, para não conflitar com o duplo-toque de incentivo, o pinch-zoom e o swipe de carrossel já existentes na imagem do post. Ver `docs/01-feed.md` (Detalhe do treino) e `docs/14-database-schema.md` (`posts.workout_summary`).

---

### TagPeopleDrawer
**Arquivo:** `client/components/shared/tag-people-drawer.tsx`
**Usado em:** NewPost (Etapa 2 — "Marcar pessoas"), EditPostDrawer (seção "Pessoas marcadas" — abre por cima do drawer de edição) e WorkoutSummaryOverlay (marcar quem treinou junto antes de publicar o resumo no feed)

Drawer glass de **marcação de pessoas em um post** (estilo Instagram). Seleção controlada pelo pai via `selected: SearchUser[]` / `onChange`:
- Ao abrir, lista quem o usuário segue (`getFollowingDb`); a busca filtra os seguidos **e** procura qualquer pessoa do app (`searchUsersDb`, debounce 300ms), mesclando sem duplicatas e excluindo o próprio usuário
- Cada linha: `UserAvatar` + nickname + check circular (gradiente azul→roxo quando selecionado)
- Limite exportado `MAX_TAGGED_PEOPLE = 10` — exceder mostra toast destrutivo
- Botão "Concluir (n)" apenas fecha (a seleção já está no pai)
- Props: `open`, `onOpenChange`, `selected`, `onChange`, `wrapperClassName?`
- **`wrapperClassName`** repassa classes ao **lift wrapper do portal** do `DrawerContent` (novo prop, 17/08/2026). É o único jeito de abrir o drawer por cima de um overlay de z alto: o wrapper tem `transform` (para subir com o teclado), o que faz dele um **stacking context** — subir o z-index do conteúdo/overlay só reordena *dentro* dele e o drawer inteiro continua pintando no `z-[310]` do wrapper, atrás do overlay. O resumo do treino (`zIndex 9500`) passa `z-[9600]`. Note que isso é diferente do caso de drawer-sobre-drawer (Comunidade), onde os dois estão no mesmo wrapper e `className="z-[330]" + overlayClassName="z-[320]"` resolvem.

---

### ShareDrawer
**Arquivo:** `client/components/shared/share-drawer.tsx`
**Usado em:** Feed (`Index.tsx`), `PostDetail.tsx`, `Profile.tsx`

Drawer glass de compartilhamento externo: share sheet nativa do iOS (`@capacitor/share`) + atalhos de WhatsApp, Instagram, Facebook, Telegram, X, "mais opções" e copiar link. Props: `open`, `onOpenChange`, `text`, `url?`, `title?`, `onSendToFriend?`.

As URLs vêm de `client/lib/share-url.ts`, que reexporta a fonte única `shared/share-config.ts`. **O que acontece do outro lado do link** — Universal Links, custom scheme, prévia Open Graph e landing de instalação — está em `docs/19-compartilhamento-e-deep-links.md`.

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

### useFlowPrivateReply / FlowReplyMessage (2026-08-17)
**Arquivos:** `client/hooks/use-flow-private-reply.ts`, `client/lib/flow-reply.ts`, `client/components/community/flow-reply-message.tsx`
**Usado em:** os **dois** viewers de flow — a tela `/flows/:storyId` (`client/pages/FlowViewer.tsx`) e o modal aberto pelo perfil (`client/components/modals/flow-viewer-modal.tsx`) — e o chat da Comunidade

Responder um flow **em privado**: o texto digitado na doca do viewer, em vez de virar comentário público (balão flutuante), vai como **mensagem direta para o autor**, com a miniatura do flow respondido na conversa.

- **Hook `useFlowPrivateReply(story, isOwner)`** → `{ isSendingPrivateReply, sendPrivateReply(text) }`. Concentra validação (teto de 900 chars — `sendMessageDb` rejeita acima de 1000 e o payload ainda leva prefixo + id), haptic, toasts de sucesso/erro e `reportHandledError`. Devolve `true` quando gravou, e só então o chamador limpa o campo. Existe como hook porque as duas docas são cópias uma da outra: a lógica não podia nascer duplicada uma terceira vez.
- **Doca:** botão circular de vidro com `MessageCircle` **antes** do avião de envio (que segue sendo o comentário público). Só aparece em flow de outra pessoa (`!isOwner`). Como os dois botões agem sobre o mesmo campo, uma linha de dica (`flow_reply_hint`) surge assim que há texto digitado.
- **Protocolo:** `[flowreply]:<flowId>|<texto>` (`buildFlowReplyPayload`/`parseFlowReply` em `client/lib/flow-reply.ts`), na mesma família de `[audio]:`/`[image]:`/`[post]:`/`[shot]:`. **Sem migração** — mas o push usa a notificação **tipo 17** ("respondeu ao seu flow"), então **exige redeploy da `send-push-notification`**. `sendMessageDb` ganhou um 3º parâmetro opcional (`SendMessageContext`: `notificationType` + `flowId`) só para escolher o texto do push; a mensagem em si continua uma linha normal em `messages`.
- **`FlowReplyMessage`** renderiza a bolha no chat: rótulo de contexto, miniatura vertical 68×104 e o texto. Ver `docs/07-comunidade.md` para os estados (flow apagado, flow expirado) e o memo de sessão que evita refetch.

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

### IncomingMessageToast (2026-08-06)
**Arquivo:** `client/components/shared/incoming-message-toast.tsx`
**Usado em:** `AppLayout` (montado uma única vez, aparece sobre qualquer tela)

Pop up glass no topo avisando que chegou uma mensagem privada com o app aberto:
- **Conteúdo:** avatar + apelido do remetente + preview da mensagem (via `conversationPreviewText`, o mesmo helper da lista de conversas — resolve `[audio]:`, `[image]:`, `[post]:`, `[shot]:` e respostas `↩`)
- **Entrada:** pub/sub `client/lib/incoming-message-toast.ts`, alimentado pelo canal realtime de `messages` do `AppLayout` — nunca por props
- **Saída:** some em 5s, arrasta para cima para dispensar, toque abre `/comunidade?user=<remetente>`
- **Safe area:** `top: max(12px, env(safe-area-inset-top))`, `z-[9999]`, wrapper `pointer-events-none` com o botão `pointer-events-auto`
- A **vibração não fica aqui** — mora no `AppLayout`, porque deve ocorrer inclusive quando o banner é suprimido (conversa já aberta)

---

### BannedScreen (2026-08-11)
**Arquivo:** `client/components/shared/banned-screen.tsx`
**Usado em:** `RequireAuth` (`client/App.tsx`) — substitui o `<Outlet/>` inteiro quando a conta está banida

Tela cheia de conta suspensa: ícone `ShieldBan`, título, explicação e botão "Sair" (`resetSupabaseAuth`). Textos traduzidos (`banned_title`, `banned_description`).

- **A trava real não é esta tela** — é o `banned_until` do GoTrue, gravado por `admin_set_banned` (ver `docs/18-admin.md`). Ela cobre a janela em que o access token já emitido ainda vale (até 1h).
- O guard `useBanGuard` **não bloqueia o primeiro render**: consulta `is_current_user_banned()` em background e só então troca a tela. Travar o boot atrás de uma ida ao servidor penalizaria todo mundo pelo caso raro.
- `ritmofit-db` entra por **import dinâmico** dentro do guard — `App.tsx` é o chunk de entrada e não importa o módulo em nenhum outro ponto, de propósito.
- Não redireciona para `/login`: sair sem explicação vira "o app parou de funcionar" no review da App Store.

---

### LazyMount (2026-08-11)
**Arquivo:** `client/components/shared/lazy-mount.tsx`
**Usado em:** `client/pages/Index.tsx` — envolve cada `PostCard` das abas "Seguindo" e "Descobrir"

Mantém no DOM só o que está perto da viewport. Item longe → conteúdo desmontado e substituído por um espaçador com a altura medida antes de sair.

| Prop | Padrão | Descrição |
|---|---|---|
| `estimatedHeight` | `480` | Altura do espaçador enquanto o item nunca foi medido |
| `rootMargin` | `"150%"` | Folga ao redor da viewport que ainda conta como "perto" |

- **O ganho não é re-render** — o `memo` do `PostCard` já cobre isso. É contagem de nós, decodificação de imagem, layout, pintura e composição do `backdrop-filter`, que o WKWebView paga mesmo para o que está a dez telas de distância.
- **Começa montado** de propósito: o feed restaura a posição de scroll ao voltar de outra tela, e com alturas estimadas essa restauração cairia no lugar errado. O observer recolhe no frame seguinte, já com alturas reais.
- **Sem `content-visibility: auto`**, que resolveria com uma linha de CSS: só existe do Safari 18 em diante, e o `IPHONEOS_DEPLOYMENT_TARGET` é 15.0.
- **Sem biblioteca de virtualização**: as existentes assumem altura fixa, e dependência nova exige regenerar os dois lockfiles (npm/Appflow + pnpm/Vercel).
- Sem `IntersectionObserver` no ambiente, vira passthrough — tudo montado, como antes.

> **Não usar em chat.** A conversa privada é capada em 200 mensagens e é ancorada embaixo; desmontar bolhas de altura variável faria o scroll pular.

---

### ShotThumb (2026-08-13)
**Arquivo:** `client/components/shared/shot-thumb.tsx`
**Usado em:** `pages/Profile.tsx` (aba Shots), `pages/Search.tsx` e `pages/Hashtag.tsx` (itens `kind: "shot"` da grade)

Miniatura de um shot nas grades. Substituiu o `<video src={videoPosterSrc(...)} preload="metadata">` que estava duplicado nas três telas.

| Prop | Descrição |
|---|---|
| `videoUrl` | URL do vídeo do shot; `null`/vazio renderiza o elemento sem fonte |
| `className` | Classes do `<video>` (as três telas passam variações de `h-full w-full object-cover`) |

- **Poster sem coluna no banco:** o `src` sai de `videoPosterSrc()` (`lib/video-thumb.ts`), que anexa `#t=0.1` para o WebView fazer *seek* e pintar aquele frame.
- **Gerencia o player de vídeo do iOS**, que é o motivo real de o componente existir. O WKWebView tem um **teto de players simultâneos** e cada `<video>` da grade ocupa um. Estourado o teto, o próximo vídeo a tocar vem **sem faixa de vídeo** — o áudio sai, a tela fica preta. Duas travas:
  - `src` anexado só quando a célula entra na viewport (`rootMargin: 400px`) e solto 2s depois de sair → players vivos acompanham o que está na tela, não o total de shots.
  - `releaseVideoElement` (`lib/media-prefetch.ts`) na limpeza do efeito → ao navegar para `/shots`, todos os players da grade são devolvidos **antes** de o vídeo em tela cheia pedir o dele. Tirar o `<video>` do DOM não basta: o WebKit só solta o recurso na coleta de lixo.
- Sem `IntersectionObserver` no ambiente, carrega tudo direto — a liberação no desmonte, que é a trava principal, continua valendo.

> **Sempre use `releaseVideoElement` ao desmontar um `<video>`** em qualquer tela nova. A tela de Shots faz o mesmo no componente `ShotVideo` (ver `docs/03-shots.md`).

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
**Arquivo:** `client/hooks/useAuth.ts` (contexto em `client/lib/auth-context.tsx`)

Gerencia estado de autenticação:
- `user` — usuário logado (ou null)
- `loading` — se ainda está verificando a sessão
- Integrado com Supabase Auth

**`loading` só é `true` quando NÃO há sessão em disco (2026-08-11).** O provider lê a chave `sb-*-auth-token` do localStorage no estado inicial; se ela traz um usuário, a árvore renderiza na hora e a verificação assíncrona corrige depois.

- **Por quê:** `loading` começava sempre `true`, e o app inteiro ficava atrás da tela vazia do `AuthLoadingScreen` até `getUserSafe()` resolver. Só que `getSession()` **não é local** quando o access token venceu (vive 1h — ou seja, quase todo cold start): com `autoRefreshToken`, ele espera o refresh na rede, e esse fetch ainda passa pelo `fetchWithRetry` (até 4 tentativas, ~2,1 s de backoff em rede ruim).
- **O `null` da verificação inicial não desloga.** `getUserSafe()` também devolve `null` em falha de rede; aceitá-lo jogaria no login quem abriu o app sem internet — justamente o cenário do modo offline. Quem desloga é o `onAuthStateChange` (SIGNED_OUT).
- **A identidade de `user` só muda quando a pessoa muda.** Cada refresh de token entregava um objeto novo com o mesmo id, invalidando todo `useCallback` que depende de `user` — e, por tabela, os `useEffect` de carga das telas: um refresh de token disparava refetch em cascata pelo app inteiro.

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

### route-prefetch (2026-08-11)
**Arquivo:** `client/lib/route-prefetch.ts`
**Usado por:** AppLayout (dois efeitos, montados uma vez)

Aquece o chunk de uma tela antes de ela ser necessária. Todas as páginas são `React.lazy`, então sem isto o chunk só começa a ser buscado quando a rota já mudou — é esse intervalo que dá a sensação de que o app "pensa" antes de trocar de página.

| Export | Quando dispara | O que faz |
|---|---|---|
| `prefetchRoute(path)` | `pointerdown` em qualquer `<a href="/…">` | Carrega o chunk daquela rota |
| `prefetchPrimaryRoutes()` | `requestIdleCallback` (fallback `setTimeout` 2 s) | Aquece `/`, `/metas`, `/comunidade`, `/shots`, uma de cada vez |

- **Um listener delegado no `document`**, em `capture` + `passive`, em vez de um handler por `<Link>`: pega menu, sidebar, header e links dentro das páginas de uma vez, e continua valendo para links criados depois.
- **`pointerdown`, não `click`:** entre encostar e soltar o dedo passam ~100 ms e a navegação só acontece no clique — o chunk viaja dentro dessa folga.
- **Os `import()` são duplicados de propósito** entre este arquivo e o `App.tsx`. O bundler casa chunks pelo especificador **literal**; um wrapper genérico com caminho em variável geraria outro chunk (ou nenhum). Ao adicionar uma tela nova ao menu, adicione aqui também.
- `requestIdleCallback` não existe no WKWebView do iOS — o `setTimeout` é o caminho real no device.

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

### admin.ts / clipboard.ts (2026-08-17)
**Arquivos:** `client/lib/admin.ts`, `client/lib/clipboard.ts`

- `admin.ts` — `ADMIN_USER_IDS` (saiu de `App.tsx` para poder ser usado fora da guarda de rota), `isAdminUser(userId)` e `anatomySqlSnippet(...)`. **Guarda de UI, não autorização**: quem autoriza escrita é `app_admins` no servidor (`docs/18-admin.md`). Consumido pelo `RequireAdmin` e pelo aviso de anatomia faltante em `ExerciseAnatomy`.
- `clipboard.ts` — `copyToClipboard(text)` com fallback `<textarea>` + `execCommand` para o WKWebView (onde `navigator.clipboard` falha sem gesto/contexto seguro). Estava duplicado dentro de `Store.tsx`; agora é fonte única.

---

### network-status.ts
**Arquivo:** `client/lib/network-status.ts`

Monitora conectividade:
- `getNetworkStatus()` — estado atual (`isOnline`, `isSupabaseReachable`)
- `addNetworkStatusListener(callback)` — escuta mudanças
- `checkSupabaseReachability()` — teste de conexão com Supabase

---

### monitoring.ts (captura de erros — 2026-08-05)
**Arquivos:** `client/lib/monitoring.ts`, `client/App.tsx` (ErrorBoundary + `MonitoringBridge`), `client/components/shared/report-problem-drawer.tsx`

**Por que existe:** o app roda dentro de um WKWebView. Um erro de JavaScript **não é um crash do processo iOS** — o relatório automático da Apple (Xcode Organizer / App Store Connect) nunca enxerga esses erros, que são a esmagadora maioria dos bugs reais do app. Sem esta camada, um erro em produção só chegava até nós como review na loja.

**SDK:** `@sentry/capacitor` (nativo + JS) no device, `@sentry/react` no navegador. Configurado por `VITE_SENTRY_DSN`; **sem a variável o módulo inteiro vira no-op** e o Vite tree-shaka o SDK do bundle (custo zero quando não configurado; ~36 kB gzip quando ativo).

| Função | Uso |
|---|---|
| `initMonitoring()` | Chamada no topo de `App.tsx`, **antes de qualquer render** — erro no primeiro frame também precisa chegar |
| `setMonitoringUser(id)` | Só o `id`, nunca e-mail/nome/IP (ver privacidade abaixo) |
| `setMonitoringScreen(path)` | Tag `screen` + breadcrumb de navegação |
| `reportHandledError(err, where)` | Erro que o app **já tratou** (`catch` que só mostra toast). Sem isto, "deu erro" para o usuário = "nunca aconteceu" para nós |
| `reportFatalError(err, stack)` | Usada pelo ErrorBoundary; devolve o `eventId` exibido na tela |
| `sendProblemReport({...})` | Relato manual do usuário, tag `report_source: in_app`, fingerprint único por relato |
| `flushMonitoring()` | Garante que o evento saiu antes de fechar a tela |

**Filtro de ruído (`ignoreErrors` + `beforeSend`):** rede indisponível (`Failed to fetch`, `Load failed`, …) **não é bug** — o app tem modo offline e já trata isso com a fila `lk:outbox`. Também são descartados aborts intencionais, `ResizeObserver loop`, `play() request was interrupted` (Shots/flows) e erros de sessão expirada que o app já resolve redirecionando ao login. Sem esse filtro a cota gratuita do Sentry queima em dias.

**Eventos automáticos de `pnpm dev` são descartados (2026-08-14):** a primeira coisa que o `beforeSend` faz é devolver `null` quando `import.meta.env.DEV` é true, **exceto** para o relato manual (tag `report_source: in_app`, que continua saindo para dar como testar o drawer sem buildar). Motivo: o hot reload executa estados **intermediários de edição** — declaração já cortada, referência ainda no JSX — e o painel enchia de `ReferenceError` que parece bug de produção. Os sete primeiros issues não resolvidos do projeto eram exatamente isso. Ao triar um issue antigo, o critério manual continua valendo: **nome de variável legível na mensagem = ruído de dev**, porque o build de produção é minificado (`ReferenceError: Ce is not defined`).

**Privacidade (relevante para a nutrition label da App Store):** nenhum evento automático carrega e-mail, nome ou IP — `beforeSend` apaga esses campos e `sendDefaultPii: false`. O e-mail só sai do app quando a própria pessoa o digita no `ReportProblemDrawer`, que exibe a lista do que será enviado junto antes do envio.

**Source maps:** `vite.config.ts` só ativa o `@sentry/vite-plugin` quando `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` estão no ambiente (lugar delas: env vars do Appflow). Nesse modo os `.map` são gerados, enviados e **apagados do `dist`** — sem isso viajariam dentro do binário e entregariam o código-fonte. Sem as variáveis o build é idêntico ao de antes, só com stack trace minificado. Falha de upload nunca reprova o build.

**Versão:** `import.meta.env.VITE_APP_VERSION` é lida do `MARKETING_VERSION` do `project.pbxproj` em tempo de build — não existe um segundo lugar a manter em sincronia.

---

### ErrorBoundary raiz (`client/App.tsx`)

Última linha de defesa: um erro de render derrubaria a árvore inteira e deixaria tela branca. Mostra uma tela explicável com **"Tentar novamente"** (reseta o state) e **"Reiniciar o app"** (`location.reload()`), respeita safe area, e reporta via `reportFatalError` exibindo os 8 primeiros caracteres do `eventId` — é o código que o usuário cita no suporte e que nos leva direto ao evento.

O **stack trace só é renderizado em `import.meta.env.DEV`**. Em produção seria um paredão de código para o usuário — e um risco de rejeição na review da Apple. Como o boundary vive **fora** do `LanguageProvider`, o idioma é lido direto de `localStorage["ritmofit-language"]` e traduzido com a função `t(lang, key)` standalone do `i18n.ts`.

**`MonitoringBridge`** (dentro do `BrowserRouter` e do `AuthProvider`) sincroniza usuário e rota atual para o Sentry. **`unhandledrejection`** mantém a supressão de `Failed to fetch` do Supabase e reporta todo o resto — antes só fazia `console.error`, que no device não existe para ninguém.

---

### ReportProblemDrawer
**Arquivo:** `client/components/shared/report-problem-drawer.tsx`

Relato manual de bug. **Por que existe além da captura automática:** o SDK só pega erro que *estoura*. Boa parte dos bugs não estoura — o treino não salvou, a foto subiu girada, o contador veio errado. Para o usuário "está bugado"; para o SDK, nunca aconteceu nada.

| Campo | Regra |
|---|---|
| O que aconteceu? | Textarea, mín. 10 caracteres, máx. 1000 |
| E-mail para contato | Opcional, pré-preenchido com o e-mail da conta |
| Contexto técnico | Anexado sozinho e **exibido antes do envio**: versão + build (`CapApp.getInfo()`), tela (`location.pathname`), plataforma, idioma, online, user agent, viewport |

Bloqueia o envio quando `!navigator.onLine` (senão o relato se perderia em silêncio e o usuário acharia que enviou) e aguarda `flushMonitoring()` antes de fechar. Padrão visual e de teclado idêntico aos demais drawers (glass, `useKeyboardAwareHeight`, `paddingBottom` com `--keyboard-height`).

---

### ReportDrawer (denúncia de conteúdo)
**Arquivo:** `client/components/shared/report-drawer.tsx`

Drawer único de denúncia usado pelo Feed e pela tela de Shots. Seletor de motivo (radio) + botões Cancelar / Enviar denúncia.

| Prop | Descrição |
|---|---|
| `type` | `"user"` \| `"post"` \| `"shot"` — define título, subtítulo e a tabela de destino |
| `target` | `{ id, userId, userName, description? }` — `id` é o post/shot denunciado, `userId` é o autor |

| `type` | Título | Função DB | Tabela |
|---|---|---|---|
| `user` | Denunciar usuário | `reportUserDb(userId, reason)` | `user_complaint` |
| `post` | Denunciar post | `reportPostDb(postId, reason)` | `post_complaint` |
| `shot` | Denunciar shots | `reportShotDb(shotId, reason)` | `shots_complaint` |

- Motivos: Conteúdo inadequado, Spam, Assédio ou bullying, Violação de direitos autorais, Outro
- **Rótulos traduzidos (PT/EN), valor gravado sempre em PT** — a fila de moderação do Admin (`admin_complaints_view`) precisa de `reason` comparável entre usuários de idiomas diferentes
- Todas as strings do drawer passaram a usar `t()` em 2026-08-06 (antes eram hardcoded em PT)

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

#### `useKeyboardInputScroll` — revelar input no meio de um scroll (2026-07-20)

**Arquivo:** `client/hooks/use-keyboard-input-scroll.ts`

O lift wrapper ergue o **sheet inteiro** acima do teclado, mas não rola o **conteúdo interno** até o campo em foco. Quando um input (ou textarea) fica **no meio de uma área `overflow-y-auto` própria** — formulário rolável de drawer, overlay `position:fixed` de tela cheia, ou corpo rolável de página — o iOS deixava o campo atrás do teclado ("o teclado sobe mas eu não vejo o que digito"). O scroll-assist global de `keyboard.ts` (`scrollPageInputIntoView`) não cobre esses casos: usa `window.scrollBy` (no-op num container com scroll próprio) e ainda pula qualquer `[role="dialog"]`.

Este hook é a peça que faltava. Ao focar um campo / abrir o teclado, ele rola o **container interno** até o campo ficar acima do teclado:

- **API:** `useKeyboardInputScroll(scrollRef?, enabled = true)`.
  - Com `scrollRef`: rola aquele container (passe `enabled` = estado `open` do drawer para só escutar quando aberto).
  - **Sem ref** (ref-less): sobe do campo em foco até o ancestral rolável mais próximo. Ideal para telas com **vários** containers roláveis independentes (ex.: `settings-drawer`, um sub-drawer por seção; `Community`, dezenas de drawers de formulário) — uma única chamada cobre todos.
- **Sempre combine com** `paddingBottom: "calc(<folga> + var(--keyboard-height, 0px))"` no MESMO container rolável — sem esse espaço extra não há para onde rolar o último campo.
- **Imune ao lift do drawer:** a referência de "área visível" é `min(fundo do container, linha do teclado)`. Como container e input são medidos no mesmo instante, a conta é invariante ao `transform` do lift — não há dupla contagem mesmo medindo no meio da animação. A mesma fórmula serve para overlay fixo que não sobe (a linha do teclado vence).
- **Não briga com campos já tratados:** um input que **não** está dentro de um `overflow-y-auto` (rodapé fixo `shrink-0`, campo centralizado, barra com `translateY(--keyboard-height)` própria) faz o hook não encontrar container rolável → no-op. Por isso é seguro chamar o ref-less numa tela que já trata o campo principal de outro jeito (ex.: `Community` trata o chat encolhendo o container; `flow-viewer` ergue a barra de resposta).

**Quando NÃO precisa do hook:** (1) input é **rodapé fixo** do drawer (`shrink-0` fora do scroll) — o lift já o mantém acima do teclado (ex.: `post-comments-dialog`, `promotion-comments-drawer`, `send-to-friend-drawer`); (2) input fica **no topo** fixo (busca em `new-conversation`, `tag-people`, `add-members`); (3) `<input type="time"/date>` — abre o **picker de roda** do iOS, não teclado; (4) página que rola com **`window`** (o `scrollPageInputIntoView` global já cobre — ex.: `Admin`).

**Campos centrados / barras próprias** (não-scroll) têm solução própria, não o hook: somar `var(--keyboard-height)` ao `padding-bottom` do wrapper de centralização (`ResetPassword`, `dialog.tsx`, `alert-dialog.tsx`) ou aplicar `transform: translateY(calc(-1 * var(--keyboard-height)))` na barra (`flow-creation-dialog`, `flow-viewer`).

> **Referências pré-existentes** com a mesma lógica inline (não migradas, funcionam): `workout-session-dialog.tsx` (overlay de registrar treino) e `Login.tsx` (form de cadastro rolável). Código novo deve usar o hook.

#### Swipe para fechar — vale no sheet inteiro (2026-08-06)

**Regra:** arrastar para baixo a partir de **qualquer ponto do corpo** do drawer fecha o drawer. Não existe "zona de fechar" no topo — o gesto é o mesmo que o iOS ensina em qualquer sheet, independente de onde o dedo está. Duas coisas quebravam isso e foram removidas:

| Causa | Onde estava | Correção |
|---|---|---|
| `handleOnly` no `<Drawer>` + `<DrawerContent>` | `create-wizard-drawer`, `food-diary-card`, `goal-detail-drawer`, `routine-detail-drawer`, `goal-share-drawer` | prop removida — só a pílula (~38px) arrastava |
| `onPointerDown={(e) => e.stopPropagation()}` no container rolável do corpo | `Store` (3 drawers de promoção), `Shots` (comentários), `promotion-comments-drawer`, `post-comments-dialog`, `item-detail-drawer`, `routine-list-drawer` | handler removido — o `pointerdown` nunca chegava ao `DrawerContent`, então o vaul não iniciava arraste |

- **O vaul já protege o scroll sozinho** — não é preciso ajudá-lo. O `shouldDrag` cancela o dismiss quando o container rolável **não está no topo** (`scrollTop !== 0`) e quando o arraste é para **cima**. Por isso remover o `stopPropagation` não quebra rolagem: o gesto de rolar continua rolando, e só o "puxar para baixo já no topo" fecha.
- **Exceção 1 — campos de formulário (automática):** o `DrawerContent` marca `input`/`textarea`/`[contenteditable]` com **`data-vaul-no-drag`** no *capture* do `pointerdown` (roda antes do handler do próprio vaul). Puxar para baixo a partir de um campo — tipicamente com o teclado aberto — não fecha o drawer nem joga fora o que estava sendo digitado. Vale para **todos** os drawers e para campos renderizados dinamicamente; não é preciso anotar campo por campo.
- **Exceção 2 — widgets com arraste próprio (manual):** quem tem gesto próprio leva `data-vaul-no-drag` no elemento: `inline-crop-preview`, o frame do `image-cropper-drawer` e o `Slider` (`ui/slider.tsx`). Sem isso, arrastar a foto arrastaria o sheet junto. **Ao criar qualquer área com arraste próprio dentro de um drawer, adicione o atributo.**
- **`handleOnly` continua existindo** como escape hatch no `<Drawer>` + `<DrawerContent>` (default `false`, **desligado em todo o app**). Nesse modo o `onPointerDown`/`onPointerMove` do corpo retorna cedo e só o `<DrawerPrimitive.Handle>` arrasta — por isso o `DrawerContent`, com `handleOnly`, renderiza a alça como `Drawer.Handle` (a única que o vaul reconhece) em vez do `<div>` decorativo, com a pílula forçada por `!` (o vaul injeta estilos default de `[data-vaul-handle]` em runtime). Preferir sempre `data-vaul-no-drag` cirúrgico a ligar `handleOnly`.
- As outras formas de fechar seguem inalteradas: **tocar no overlay**, botões **Cancelar/fechar** e o **voltar** do sistema.

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
