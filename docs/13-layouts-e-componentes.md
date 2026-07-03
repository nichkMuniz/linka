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
- **Refetch de badges no refresh do feed:** contadores são carregados no mount e mantidos via subscription realtime do Supabase (que pode cair silenciosamente em background no iOS). Para evitar badge desatualizado, o `AppLayout` também escuta os eventos `ritmofit-refresh-feed` (toque no logo/home) e `ritmofit-refresh-badges` (disparado pelo pull-to-refresh em `Index.tsx`) e refaz o fetch de `getUnreadMessageCountDb`/`getUnreadNotificationsCountDb` a cada um deles
- **Foto de perfil:** Carregada dinamicamente no ícone de Perfil
- **Bottom Navigation (mobile):** 5 itens fixos na parte inferior
- **Side Navigation (desktop):** Navegação lateral em telas grandes (244px fixo)
- **Timer de uso diário:** Monitora tempo de sessão
- **Limite diário:** Se o usuário configurou um limite, bloqueia o app ao atingir
- **Floating Action Menu:** Menu flutuante arrastável (mobile)

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
- Deletar comentário próprio
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

Todos os drawers (bottom sheets) do app são renderizados por `DrawerContent`, que trata o teclado do iOS **delegando ao comportamento nativo do vaul** (`repositionInputs`, ligado por padrão):
- Quando o teclado abre, o vaul reduz a altura do sheet para a área visível acima do teclado e levanta seu `bottom`, mantendo o conteúdo scrollável
- O input focado é trazido à vista automaticamente — funciona tanto para inputs fixos no rodapé (ex: barra de comentários) quanto para inputs no meio de conteúdo scrollável (ex: textarea de editar legenda)
- **Importante:** `DrawerContent` **não** deve rodar um handler próprio de `visualViewport` em paralelo. Dois handlers mutando `bottom`/`height` do mesmo elemento brigam entre si — era o que fazia o sheet "subir inteiro" e os inputs sobreporem/sumirem. Por isso o antigo `useKeyboardInsets()` e a variável `--keyboard-offset` foram removidos
- Consumidores só precisam definir um `max-height` estável (via `useKeyboardAwareHeight`, que ignora o teclado) e usar `flex-1 min-h-0` na área scrollável; o vaul cuida do resto

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
