# Layouts e Componentes Compartilhados

---

## Estrutura de Pastas (`client/components/`)

```
client/components/
├── ui/             ← Shadcn UI (não mexer)
├── layout/         ← Componentes estruturais globais (AppLayout, ShotsLayout, ThemeProvider, FloatingActionMenu)
├── shared/         ← Componentes reutilizáveis em 2+ domínios (ImageWithFallback, AnimatedLoading, PostIncentiveButton, ExerciseImage, DietImage, EmojiPicker, InlineCropPreview)
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
│  [Logo] [Buscar][Notif][Perfil]  │
├──────────────────────────────────┤
│  Conteúdo da tela atual          │
│                                  │
├──────────────────────────────────┤
│  Bottom Navigation (mobile)      │
│  [Home][Shots][Nova][Metas][Vitrine]│
└──────────────────────────────────┘
```

#### Funcionalidades
- **Header:** Logo + ícones de navegação secundária (buscar, notificações, perfil)
- **Badge de mensagens não lidas:** Contador no ícone de Comunidade
- **Badge de notificações:** Contador no ícone de Notificações
- **Vibração ao receber notificação:** A subscription realtime (`app-layout-notif-push`, canal `notifications`) dispara `hapticSuccess()` (`client/lib/haptics.ts`) para qualquer INSERT na tabela `notifications` do usuário logado — independentemente do tipo (follow, incentivo, comentário, duelo, reação) e da tela em que o usuário está, inclusive na própria tela de Notificações. Roda antes da checagem que pula a notificação local visual (`LocalNotifications.schedule`) quando o usuário já está em `/notificacoes`, então a vibração sempre ocorre mesmo quando o banner é suprimido. Sem efeito fora do runtime nativo (Capacitor) — `hapticSuccess()` é no-op no browser.
- **Refetch de badges no refresh do feed:** contadores são carregados no mount e mantidos via subscription realtime do Supabase (que pode cair silenciosamente em background no iOS). Para evitar badge desatualizado, o `AppLayout` também escuta os eventos `ritmofit-refresh-feed` (toque no logo/home) e `ritmofit-refresh-badges` (disparado pelo pull-to-refresh em `Index.tsx`) e refaz o fetch de `getUnreadMessageCountDb`/`getUnreadNotificationsCountDb` a cada um deles
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
- Props: `type`, `isActive`, `onClick`, `loading`

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
**Usado em:** NewPost (Etapa 1, foto de post), WorkoutSummaryOverlay (foto do resumo de treino)

Zoom/pan direto no frame quadrado da foto (pinch-to-zoom + arraste), **sem** passar por uma tela de crop separada (2026-07-02, extraído do `NewPost.tsx` para reuso). Exporta:
- `InlineCropPreview` — componente (canvas) que desenha a foto com o `CropTransform` atual e captura gestos de pointer/touch (drag = pan, pinch = zoom, `MIN_SCALE`–`MAX_SCALE` = 1–5)
- `CropTransform` (`{ scale, offsetX, offsetY }`) e `DEFAULT_TRANSFORM`
- `applyTransformToBlob(dataUrl, transform, containerWidth)` — gera o `Blob` já recortado (JPEG) para upload, replicando visualmente o que o usuário viu no frame
- `getCachedImage(src)` — cache de `HTMLImageElement` decodificado, evita re-decodificar a mesma foto entre re-renders

Cada foto tem seu próprio `CropTransform` guardado por índice (`Record<number, CropTransform>`), reindexado ao remover/reordenar fotos. Como o frame captura o gesto de arraste para pan, telas com múltiplas fotos não podem depender de swipe nativo para navegar entre elas — precisam de setas/dots clicáveis (ver `NewPost.tsx` e `workout-summary-overlay.tsx`).

---

### WorkoutDetailButton
**Arquivo:** `client/components/shared/workout-detail-dialog.tsx`
**Usado em:** Feed (`PostCard`), Perfil (viewer de post), PostDetail

Pill **"Ver treino"** + drawer glass **simplificado** de detalhe do treino, renderizado apenas em posts que carregam um `workout_summary` (posts de resumo de treino compartilhados no feed). Props: `summary: PostWorkoutSummary` (tipo em `client/lib/workout-summary-types.ts`) e `className` (posicionamento do pill). O drawer (padrão glass §9.4) mostra **só** a lista de exercícios: cada linha com a **miniatura do exercício** (`ExerciseImage`, fallback gradiente/emoji por grupo quando sem foto), nome + grupo muscular e as **séries em chips `{kg}kg × {reps}`** — sem stats/banners (o overlay completo é o `WorkoutSummaryOverlay` na tela de Metas). Optou-se por pill dedicado em vez de tornar a imagem inteira clicável, para não conflitar com o duplo-toque de incentivo, o pinch-zoom e o swipe de carrossel já existentes na imagem do post. Ver `docs/01-feed.md` (Detalhe do treino) e `docs/14-database-schema.md` (`posts.workout_summary`).

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
**Arquivo:** `client/components/ui/drawer.tsx`

Todos os drawers (bottom sheets) do app são renderizados por `DrawerContent`. Desde 2026-07-03, o teclado do iOS é tratado pelo **resize nativo do WebView**, não por JavaScript:

- O plugin `@capacitor/keyboard` está configurado com `resize: 'native'` em `capacitor.config.ts`. Quando o teclado abre, o **frame do WKWebView encolhe** para a área visível acima do teclado.
- Consequência: qualquer elemento `fixed bottom-0` (drawers, barras de input) fica automaticamente acima do teclado; unidades `dvh`/`vh` e `window.innerHeight` passam a refletir a área visível. Nenhum reposicionamento via JS é necessário.
- O `repositionInputs` do vaul está **explicitamente desligado** no componente `Drawer` (`repositionInputs={false}`). O mecanismo do vaul depende de eventos de `visualViewport` que são instáveis dentro do WKWebView (altura "travada" obsoleta, movimento duplo) — era a causa dos drawers com input quebrando no iPhone. **Não reativar.**
- **Importante:** nenhum componente deve rodar handler próprio de `visualViewport` para mover drawers. Dois mecanismos mutando `bottom`/`height` do mesmo elemento brigam entre si. (O hack `releaseDrawerHeightLock` do `CreateWizardDrawer`, que existia para desfazer a altura travada do vaul, foi removido junto.)
- Consumidores só precisam de um cap de altura que acompanhe o viewport — o padrão do app é `maxHeight: min(XXdvh, ${viewportHeight - 8}px)` com `viewportHeight` vindo de `useKeyboardAwareHeight` — e `flex-1 min-h-0` na área scrollável. Com o viewport encolhendo, o sheet comprime e o input pinado no rodapé permanece visível.
- **Correção do delay ao focar input (2026-07-06):** dentro do WKWebView o evento `window`/`visualViewport` "resize" que reporta o frame encolhido chega **atrasado** (até ~1s), e unidades `dvh`/`vh` ficam congeladas no valor antigo até lá — por isso um drawer com input focado permanecia em altura cheia por até um segundo antes de saltar para caber acima do teclado. `useKeyboardAwareHeight` agora escuta também os eventos nativos `keyboardWillShow` / `keyboardWillHide` do `@capacitor/keyboard` (que disparam no **início** da animação do teclado e já trazem `keyboardHeight`) e recalcula a altura na hora (`fullHeight - keyboardHeight`), em sincronia com o teclado. Os listeners de `resize`/`orientationchange` permanecem como fallback para web e rotação. **Isso é só dimensionamento (sizing), não reposicionamento** — a regra acima de não mover drawers via `visualViewport` continua valendo.

---

## Estilos de Drawer Glass (`client/lib/glass-styles.ts`)

Fonte única de verdade para o **padrão glass escuro** dos drawers (promoções, duelos, comentários). Em vez de repetir estilos inline, importe os tokens:

| Export | Tipo | Uso |
|---|---|---|
| `GLASS_SHEET_PROPS` | props | Spread no `DrawerContent` — handle branco + `!rounded-t-[32px] !border-0` |
| `GLASS_SHEET_STYLE` | `CSSProperties` | `style` do `DrawerContent` — gradiente escuro + blur + `maxHeight: 90dvh` |
| `GLASS_FIELD_STYLE` / `GLASS_FIELD_CLASS` | style/classe | Inputs, Textareas e SelectTrigger |
| `GLASS_PRIMARY_BTN_STYLE` | `CSSProperties` | Botão principal (gradiente azul → roxo) |
| `GLASS_PANEL_STYLE` | `CSSProperties` | Cards / containers translúcidos internos |
| `GLASS_LABEL_CLASS` | classe | Labels de formulário |

Detalhes e exemplo completo: `docs/15-design-system.md` §9.4. Consumidores atuais: `Store.tsx` (drawers de promoção), `Community.tsx` (drawers de duelos) e os componentes `ClassificationsDrawer` / `AddMembersDrawer` / `EditCheckInDrawer`.
