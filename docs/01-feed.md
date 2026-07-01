# Tela: Feed (Index)

**Rota:** `/`
**Arquivo:** `client/pages/Index.tsx`
**Layout:** AppLayout (header + bottom nav)

---

## Objetivo

Tela principal do aplicativo. Apresenta o conteúdo publicado pelos usuários que o usuário logado segue (modo "Following") ou conteúdo de descoberta global (modo "Discover"). Também exibe stories (Flows) no topo.

---

## Estrutura Visual

```
┌──────────────────────────────────┐
│  Header (Logo + navegação)       │
├──────────────────────────────────┤
│  Stories / Flows (carrossel)     │
├──────────────────────────────────┤
│  Seletor: Seguindo | Descobrir   │
├──────────────────────────────────┤
│  Post 1                          │
│    [imagem/carrossel]            │
│    [incentivos] [comentários]    │
├──────────────────────────────────┤
│  Post 2...                       │
├──────────────────────────────────┤
│  Bottom Navigation               │
└──────────────────────────────────┘
```

---

## Seções e Componentes

### 1. Stories / Flows (Carrossel)

Componente: `FlowCarousel`

- Exibe os stories ativos de usuários seguidos
- Primeiro item é sempre o story do próprio usuário (com botão de criação se não tiver story)
- Stories expiram automaticamente após um período
- Clicar em um story abre o `FlowViewerModal`
- Anel colorido indica story não visto

**Botão de criar story:**
- Ícone `+` sobre a foto de perfil do usuário
- Abre `FlowCreationDialog`

**FlowCreationDialog:**
- Upload de imagem para o story
- Captura pela câmera com **obturador inteligente**: **toque rápido = foto**, **segurar (>400ms) = grava vídeo** (estilo Instagram/Snapchat). Solta o obturador para finalizar o vídeo
  - Gravação usa `MediaRecorder` com áudio do microfone (permissão lazy; se negada, grava sem som)
  - Duração máxima de 30s e teto de 50MB; indicador de gravação (anel vermelho + contador `M:SS`)
  - Vídeo gerado é enviado pelo mesmo fluxo de upload (`handleCreateStory`), que detecta o tipo via MIME (`.mp4`/`.webm`)
- **Enquadramento da mídia (tela de compartilhar):** na etapa final, imagem **e vídeo** podem ser **redimensionados (pinça)** e **movidos (arraste)** estilo story do Instagram. A camada de gestos cobre a mídia (inclusive o vídeo — isso também impede gestos nativos do iOS sobre o `<video>`)
  - **Imagem:** o enquadramento é **composto num canvas** (`bakeTransformedImage`) com fundo desfocado, para que o resultado salvo seja exatamente o que o usuário vê
  - **Vídeo:** como não pode ser recomposto no cliente, o enquadramento é **persistido** em `flow.media_transform` (`{ scale, x%, y% }`) e reaplicado via CSS `transform` no `FlowViewer`. Requer a coluna `media_transform` (ver `docs/14`); sem ela, o vídeo é salvo sem enquadramento (degradação graciosa)
- **Legenda posicionada sobre a foto/vídeo (etapa de compartilhar):** além da descrição no rodapé, o usuário pode tocar em **"+ Aa"** para adicionar **frases livres em qualquer lugar da mídia** (mesma experiência do modo de texto do flow): arrastar para reposicionar, tocar para reeditar, e escolher **cor, fonte e alinhamento**. As frases são salvas em `flow.text_elements` (x/y em %, com `style`) — **não são "queimadas" na imagem**: ficam nítidas e são renderizadas ao vivo por cima da mídia no `FlowViewer`/`FlowViewerModal`. Os controles de estilo (`textStyleControls`) e as frases posicionadas (`committedTextItems`) são compartilhados entre o modo de texto e a legenda sobre a foto
- Botão confirmar publicação

**FlowViewerModal / tela `/flows/:storyId` (`FlowViewer.tsx`):**
- Visualização em tela cheia do story
- Progresso automático entre stories — barras com leve glow no estado ativo/concluído
  - **Flows de imagem/texto:** duração fixa de 8s por story (timer interno).
  - **Flows de vídeo:** a barra de progresso é sincronizada com a duração real do vídeo (eventos `timeupdate`/`ended` do elemento `<video>`) — preenche conforme o vídeo toca e avança automaticamente quando ele termina, em vez de usar o tempo fixo de 8s. Enquanto o usuário digita um comentário ou o flow está pausado, o vídeo também pausa (a barra congela). Vale para o `FlowViewerModal` e a tela `/flows/:storyId` (`FlowViewer.tsx`).
- Exibe contagem de visualizações (para o dono)
- **Zonas de toque (navegação):** a mídia é dividida em 3 zonas invisíveis — **esquerda** (¼): volta para o flow anterior (`handlePrev`); se já estiver no primeiro flow, reinicia o atual; **centro** (½): pausa/retoma; **direita** (¼): avança para o próximo flow (`handleNext`). Segurar (>150ms) em qualquer zona pausa enquanto pressionado.
- Botão fechar
- **Mídia full-bleed:** a foto/vídeo ocupa 100% da tela (object-cover). A doca, a legenda e os balões de comentário **flutuam sobre a mídia** (sem faixa preta sólida embaixo) — só um leve gradiente garante legibilidade.
- **Frases sobre a mídia:** quando o flow tem `media_url` **e** `text_elements`, as frases posicionadas são renderizadas ao vivo por cima da foto/vídeo (posição em %, com `style` de cor/fonte/alinhamento) — antes só apareciam em flows de texto puro (`background_color`).
- **Controles do rodapé — "doca de vidro" (Direção B do design):** reações e campo de resposta ficam reunidos num único bloco de vidro (glass) translúcido no rodapé, por cima da imagem. A linha de 6 reações fica acima do campo; a reação selecionada "acende" (fundo tonalizado na cor da reação + ícone preenchido). Abaixo, um campo de resposta com botão de envio em gradiente azul→roxo. A legenda do flow e os balões de comentário ciclados aparecem logo acima da doca.
- **Drawer de comentários (ao tocar num balão):** segue o tema padrão dos demais drawers de comentários (`PostCommentsDialog`, `PromotionCommentsDrawer`) — fundo glass escuro `linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))` com `backdrop-blur`, cantos `rounded-t-[32px]` sem borda, título branco e textos em tons de branco translúcido. Edição de comentário usa textarea glass + botão "Salvar" em gradiente azul→roxo.

---

### 2. Seletor de Modo do Feed

Dois modos disponíveis (Select dropdown ou botões toggle):

| Modo | Descrição |
|---|---|
| **Seguindo** | Posts dos usuários que o usuário segue |
| **Descobrir** | Posts de toda a plataforma |

---

### 3. Lista de Posts

Cada post exibe:

| Elemento | Descrição |
|---|---|
| **Avatar + nome do usuário** | Link para o perfil (`/usuario/:userId`) |
| **Insignias do usuário** | Componente `UserInsignias` — badges/conquistas. Clicável: abre Drawer com detalhes de todas as insígnias (desbloqueadas e bloqueadas) |
| **Tempo relativo** | Ex: "há 2 horas" (via `formatTimeAgo`) |
| **Menu de contexto** (⋮) | Opções: Editar, Excluir, Denunciar, Compartilhar |
| **Imagem(ns)** | Componente `PostCarousel` para múltiplas imagens |
| **Descrição** | Texto do post — truncada em até 30 caracteres ou 1 linha; com botão clicável **"mais"** para expandir e **"menos"** para recolher (estilo Instagram) |
| **Meta vinculada** | Card mostrando a meta associada ao post (se houver) |
| **Rotinas vinculadas** | Lista expansível das rotinas da meta |
| **Botões de Incentivo** | 6 reações com ícones expressivos: ❤️ Apoio, 🔥 Fogo, 🏆 Vencedor, 📈 Evolução, 💪 Força, ⚡ Energia (componente `PostIncentiveButton`) |
| **Botão Comentários** | Abre `PostCommentsDialog` |
| **Contador de curtidas** | Clicável — abre `PostLikesModal` |

---

## Ações Disponíveis

### Sobre o próprio post (dono)
- **Editar post** — Drawer com textarea para editar descrição + seletor de meta ativa (vincula/desvincula meta do post)
- **Excluir post** — AlertDialog de confirmação → deleta via `deletePostDb`

### Sobre post de outro usuário
- **Denunciar usuário** — Dialog com seletor de motivo
- **Denunciar post** — Dialog com seletor de motivo

### Interações com qualquer post
- **Incentivar** — Toggling nos 6 tipos de incentivo (`togglePostLike`)
- **Comentar** — Abre drawer/dialog de comentários
- **Ver curtidas** — Modal com lista de usuários que curtiram
- **Copiar meta** — Se o post tiver meta, botão para copiar para o próprio perfil

---

## Estados da Tela

| Estado | Comportamento |
|---|---|
| **Carregando** | Exibe `PostSkeleton` (loading skeleton animado) |
| **Feed vazio** | Mensagem de encorajamento + botão para descobrir |
| **Erro de rede** | Toast com mensagem de erro |

---

## Dados Carregados

| Dado | Função DB |
|---|---|
| Posts do feed | `getFeedPosts()` / `getDiscoverPosts()` |
| Stories ativos | `getActiveStoriesDb()` |
| Perfil do usuário | `getUserProfileDb()` |
| Rotinas de uma meta | `getRoutinesByGoalIdDb()` |
| Itens de uma rotina | `getRoutineItemsForViewDb()` |
| Quem curtiu o post | `getPostLikeUsersDb()` |
| Treinos/dietas/hábitos do usuário | `getUserWorkoutsDb()`, `getUserDietsDb()`, `getUserHabitsDb()` |

---

## Componentes Utilizados

| Componente | Propósito |
|---|---|
| `FlowCarousel` | Carrossel de stories |
| `FlowCreationDialog` | Criação de story |
| `FlowViewerModal` | Visualização de story |
| `PostCarousel` | Carrossel de imagens do post |
| `PostIncentiveButton` | Botões de reação/incentivo |
| `PostCommentsDialog` | Dialog de comentários |
| `PostLikesModal` | Modal de quem curtiu |
| `ImageWithFallback` | Imagem com fallback |
| `UserInsignias` | Badges do usuário |
| `PostSkeleton` | Loading state |
| `LoadingSpinner` | Spinner genérico |

---

## Fluxo de Dados em Tempo Real

- Feed não tem realtime
- **Feed estático entre navegações (cache de módulo):** o feed **não recarrega** ao voltar de outra tela. Um cache singleton em nível de módulo (`feedCache` em `Index.tsx`) persiste o estado completo entre montagens — posts, posts de Descobrir, stories, rings (`viewedStoryIds`), aba ativa (Seguindo/Descobrir), `hasMoreFeed` e a posição de scroll. Ao remontar, os estados do React são inicializados a partir do cache (sem skeleton, sem refetch), de modo que a tela aparece exatamente como o usuário a deixou — sem o flash de rings desatualizados que ocorria no reload. Um **refresh real de rede** só acontece em 3 situações: (1) primeira carga, (2) toque no ícone **home**/logo (evento `ritmofit-refresh-feed`), (3) gesto de **pull-to-refresh**. O cache é invalidado quando o `user.id` logado muda (login de outro usuário força recarga).
- **Rings otimistas:** ao abrir um flow pelo carrossel, o `story.id` é marcado como visto na hora (`onStoryView` → `viewedStoryIds`), acinzentando o ring imediatamente sem precisar recarregar o feed.
- Clicar no logo **LinKa** no header (quando já está na tela `/`) faz scroll para o topo e recarrega o feed silenciosamente (sem skeleton de loading) via evento `ritmofit-refresh-feed`
- Notificações de novos posts aparecem via badge no ícone de notificações (AppLayout)

---

## Observações Técnicas

- Posts são paginados ou carregados em batch completo
- Incentivos têm estado otimístico (UI atualiza imediatamente antes da confirmação do servidor)
- Rotinas vinculadas a posts carregam sob demanda (lazy load) ao expandir
- Stories do usuário logado mostram contagem de visualizadores
- Descrições de posts usam `whitespace-pre-wrap` para preservar quebras de linha
- Descrições com mais de 30 caracteres ou múltiplas linhas são truncadas exibindo apenas a primeira linha (até 30 chars) seguida de `...` e botão **"mais"** (chave i18n `feed_description_more`); ao expandir, exibe-se o texto completo com botão **"menos"** (`feed_description_less`) para recolher. Estado de expansão é local ao `PostCard`
- O `body` tem `padding-right: 0 !important` no CSS global para evitar layout shift ao abrir modals/drawers (Radix UI injeta padding-right ao bloquear scroll)
- **Pinch-to-zoom em todos os posts:** Toda imagem de post (feed Seguindo, Descobrir e PostDetail) é renderizada via `PostCarousel`, que usa o componente interno `ZoomableImage` com gesto de pinça (dois dedos). Escala de 1x até 5x, origem do zoom segue o ponto médio entre os dedos; ao soltar, retorna a 1x com transição suave. Funciona inclusive para posts legados com campo único `post.photo` (encapsulado como `[post.photo]` no carrossel)
- **Indicador de carrossel (dots) no feed:** No `PostCard` o indicador de fotos é renderizado **logo acima do frame de botões de incentivo** (não mais no topo-centro, onde ficava escondido atrás da pill de identidade). O `PostCarousel` expõe `onIndexChange` (reporta a foto atual) e `hideDots` (oculta os dots internos); o `PostCard` usa ambos para posicionar o indicador no container inferior. O contador em pill (`N/total`) permanece no topo-direito. Demais telas (Perfil, Comunidade, PostDetail) seguem com os dots internos no topo-centro
- **Posts grandes ("1 post por vez"):** No feed, o frame de imagem do post (via prop `tall` do `PostCarousel`) usa altura calculada via CSS `calc()` que desconta exatamente o espaço de todos os elementos fixos (header, stories, tabs, bottom nav e safe areas), garantindo que o frame completo — do topo até a barra de incentivos — caiba na viewport sem scroll, em qualquer tamanho de tela. A fórmula é `calc(100dvh - max(14px, env(safe-area-inset-top) + 6px) - 314px - env(safe-area-inset-bottom))`, com `maxHeight: 500px`. O post sem foto (gradiente de fundo) e o skeleton de loading usam a mesma altura para evitar layout shift ao carregar
- **Fit adaptativo da foto (`adaptiveFit`, interno ao `ZoomableImage` em `post-carousel.tsx`):** quando o frame é `tall`, a foto é exibida com `object-cover` (preenche 100%, cortando o excedente) **somente se** sua proporção natural for próxima da proporção do frame. Quando a foto destoa muito (ex.: canvas quadrado de resumo de treino — 540×540 — gerado por `workout-summary-overlay.tsx` e compartilhado como post), o componente troca para `object-contain` (mostra a foto inteira, sem cortar nenhuma informação) e preenche o espaço ao redor com uma cópia desfocada (`blur` + `scale`) da própria foto, evitando barras vazias sólidas. A decisão é tomada em tempo de execução (`onLoad` da imagem, comparando `naturalWidth/naturalHeight` com as dimensões do frame) — não depende de metadado algum no post
