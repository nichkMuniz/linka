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
- Upload de imagem para o story: vai direto para a etapa de compartilhar (sem tela de crop intermediária) — o enquadramento é feito ali mesmo, via pinça/arraste, para não duplicar a mesma ação em duas telas
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
- Exibe contagem de visualizações (para o dono), num pill "visualizações" acima da doca (sem ícone de olho — só seta e texto) que também abre o drawer de visualizadores ao tocar
- **Sem ícones de play/pause e de visualizar no header:** essas ações já são alcançáveis por toque/arrasto (zonas de toque e swipe vertical, abaixo), então os botões com ícone foram removidos do cabeçalho para reduzir poluição visual — a funcionalidade continua intacta, só sem o ícone redundante. O header mantém apenas os botões de deletar (dono) e fechar.
- **Botões de deletar/fechar em liquid glass:** os dois botões restantes do header (`Trash2` e `X`) são círculos `h-9 w-9` com o mesmo tratamento glass da doca inferior — gradiente translúcido (`rgba(255,255,255,.12)→.03`), `backdrop-blur(18px) saturate(160%)`, borda `1px solid rgba(255,255,255,.18)` e `boxShadow` com highlight interno (`inset 0 1px 0 rgba(255,255,255,.25)`) + sombra externa suave. `whileTap` do framer-motion encolhe (`scale: 0.88`) ao tocar.
- **Indicador central de pausa:** enquanto o flow está pausado (toque/hold na zona central), um ícone de "Play" grande aparece sobreposto no centro da mídia (fundo glass translúcido) confirmando o estado pausado — some automaticamente ao retomar.
- **Zonas de toque (navegação):** a mídia é dividida em 3 zonas invisíveis — **esquerda** (¼): volta para o flow anterior (`handlePrev`); se já estiver no primeiro flow, reinicia o atual; **centro** (½): pausa/retoma (`handleTogglePause`); **direita** (¼): avança para o próximo flow (`handleNext`). Segurar (>150ms) em qualquer zona pausa enquanto pressionado.
- **Swipe vertical (`handleSwipeTouchStart`/`handleSwipeTouchEnd` em `FlowViewer.tsx`):** arrastar o dedo de **cima para baixo** (mínimo 80px, predominantemente vertical) fecha o flow e volta para o feed (`handleClose`) — disponível para qualquer flow, dono ou não. Arrastar de **baixo para cima** (mínimo 60px), disponível apenas para o **dono** do flow, abre a lista de visualizadores (`handleOpenViewers`).
- **Swipe horizontal — pular de usuário (estilo Instagram, `handleSwipeTouchEnd` em `FlowViewer.tsx`):** arrastar o dedo (predominantemente horizontal, mínimo 60px) **da direita para a esquerda** (`handleNextUser`) pula direto para o flow do **próximo usuário**, **descartando os flows restantes do usuário atual** — ex.: se alguém postou 3 flows e você abriu o primeiro, o swipe leva ao próximo usuário em vez de percorrer os outros 2 flows pendentes. Arrastar **da esquerda para a direita** (`handlePrevUser`) volta ao **primeiro flow do usuário anterior** (se não houver usuário anterior, reinicia o usuário atual no primeiro flow). Isso difere do **toque** na zona direita/esquerda (`handleNext`/`handlePrev`), que avança/retrocede **flow a flow** dentro do mesmo usuário. Um guard (`swipeHandledRef`) impede que o clique de compatibilidade das zonas de toque dispare junto com o swipe.
- **Ordem de navegação entre usuários (`sortStoriesInstagram` em `FlowViewer.tsx`):** o próprio flow do usuário logado sempre ocupa a primeira posição da lista (mesmo comportamento do `FlowCarousel`); os flows dos demais usuários seguem ordenados pelo **mais recente primeiro**. Isso garante que, ao terminar de ver o próprio flow e avançar, o próximo exibido seja sempre o flow mais recentemente postado entre os seguidores — nunca um mais antigo "fora de ordem" por causa de um timestamp intermediário do próprio usuário.
- Botão fechar
- **Mídia full-bleed:** a foto/vídeo ocupa 100% da tela (object-cover). A doca, a legenda e os balões de comentário **flutuam sobre a mídia** (sem faixa preta sólida embaixo) — só um leve gradiente garante legibilidade.
- **Frases sobre a mídia:** quando o flow tem `media_url` **e** `text_elements`, as frases posicionadas são renderizadas ao vivo por cima da foto/vídeo (posição em %, com `style` de cor/fonte/alinhamento) — antes só apareciam em flows de texto puro (`background_color`).
- **Controles do rodapé — "doca de vidro" (Direção B do design):** reações e campo de resposta ficam reunidos num único bloco de vidro (glass) translúcido no rodapé, por cima da imagem. A linha de 6 reações fica acima do campo; a reação selecionada "acende" (fundo tonalizado na cor da reação + ícone preenchido). Abaixo, um campo de resposta com botão de envio em gradiente azul→roxo. A legenda do flow e os balões de comentário ciclados aparecem logo acima da doca.
- **Drawer de comentários (ao tocar num balão):** segue o tema padrão dos demais drawers de comentários (`PostCommentsDialog`, `PromotionCommentsDrawer`) — fundo glass escuro `linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))` com `backdrop-blur`, cantos `rounded-t-[32px]` sem borda, título branco e textos em tons de branco translúcido. Edição de comentário usa textarea glass + botão "Salvar" em gradiente azul→roxo.

**Abrindo um flow via notificação (`state.openFlow`, ver `docs/10-notificacoes.md`):** o `Index.tsx` procura o flow em `stories` (ring ativo). Se não encontrado — flow expirado (> 24h) ou removido —, chama `getFlowByIdDb(flowId)` (busca por id, ignora dono/data) para decidir o que fazer: se o flow existe e pertence ao usuário logado, navega para `/perfil` com `state.openFlowArchive = flow`, que abre o Arquivo de Flows (Settings) direto naquela mídia (ver `docs/08-perfil.md`); caso contrário (flow de outro usuário ou removido), exibe um toast (`feed_flow_unavailable`).

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
| **Pill "Ver treino"** | Só em posts de **resumo de treino** (posts com `workout_summary`). Selo tocável 🏋️ no overlay inferior (acima da barra de incentivos) que abre o `WorkoutDetailButton`/drawer **simplificado** com a lista de exercícios — miniatura do exercício + nome/grupo muscular + as séries em chips `{kg}kg × {reps}`. Ver "Detalhe do treino" abaixo |
| **Meta vinculada** | Card mostrando a meta associada ao post (se houver) |
| **Rotinas vinculadas** | Lista expansível das rotinas da meta |
| **Botões de Incentivo** | 6 reações com ícones expressivos: ❤️ Apoio, 🔥 Fogo, 🏆 Vencedor, 📈 Evolução, 💪 Força, ⚡ Energia (componente `PostIncentiveButton`) |
| **Botão Comentários** | Abre `PostCommentsDialog` — apenas o ícone, sem contador numérico ao lado |
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

## Refresh Automático ao Chegar de Outra Tela (`state.refreshFeed`)

O `Index.tsx` escuta `location.state.refreshFeed` (efeito dedicado): ao chegar na rota `/` com esse flag `true`, ele limpa o state da navegação (`navigate(location.pathname, { replace: true, state: {} })`), rola a lista para o topo e chama `loadFeed(false)` — que ignora o cache do feed e busca `getFeedPosts()`/`getActiveStoriesDb()` direto do servidor, trazendo a publicação recém-criada para o topo imediatamente.

Telas que navegam para `/` disparando esse refresh:
- **`NewPost.tsx`** — ao publicar um post de imagem com sucesso (`handleImageSubmit`), navega com `navigate("/", { state: { refreshFeed: true } })` em vez de um `navigate("/")` simples, para que o feed não fique desatualizado até um refresh manual
- **Compartilhar treino** (outras telas) — mesmo padrão

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
| `WorkoutDetailButton` | Pill "Ver treino" + drawer de detalhe do treino (só em posts de resumo) |
| `ImageWithFallback` | Imagem com fallback |
| `UserInsignias` | Badges do usuário |
| `PostSkeleton` | Loading state |
| `LoadingSpinner` | Spinner genérico |

---

## Fluxo de Dados em Tempo Real

- Feed não tem realtime
- **Feed estático entre navegações (cache de módulo):** o feed **não recarrega** ao voltar de outra tela. Um cache singleton em nível de módulo (`feedCache` em `Index.tsx`) persiste o estado completo entre montagens — posts, posts de Descobrir, stories, rings (`viewedStoryIds`), aba ativa (Seguindo/Descobrir), `hasMoreFeed` e a posição de scroll. Ao remontar, os estados do React são inicializados a partir do cache (sem skeleton, sem refetch), de modo que a tela aparece exatamente como o usuário a deixou — sem o flash de rings desatualizados que ocorria no reload. Um **refresh real de rede** só acontece em 3 situações: (1) primeira carga, (2) toque no ícone **home**/logo (evento `ritmofit-refresh-feed`), (3) gesto de **pull-to-refresh**. O cache é invalidado quando o `user.id` logado muda (login de outro usuário força recarga).
- **Cache de flows sempre invalidado no refresh manual (`loadFeed` em `Index.tsx`):** `getActiveStoriesDb()` (em `ritmofit-db.ts`) usa cache stale-while-revalidate (TTL de 60s, com fallback persistido em `localStorage` por até 24h) — sem cuidado, um refresh manual dentro da janela de TTL devolvia a mesma lista antiga na hora e só disparava um refetch em segundo plano (sem re-render), exigindo repetir o refresh 2-3 vezes até o flow novo de um seguidor aparecer. `loadFeed` agora chama `invalidateQueryCache("activeStories")` antes de buscar, garantindo que toda vez que o usuário força um refresh (home/logo, pull-to-refresh, ou após publicar) os flows vêm sempre frescos do banco na primeira tentativa.
- **Rings otimistas:** ao abrir um flow pelo carrossel, o `story.id` é marcado como visto na hora (`onStoryView` → `viewedStoryIds`), acinzentando o ring imediatamente sem precisar recarregar o feed.
- **Ring reflete TODOS os flows do usuário, não só o mais antigo (`FlowCarousel`):** o carrossel agrupa os flows de cada usuário num único ring, usando sempre o **mais antigo** como representante para abrir a sequência a partir do início. O estado "visto" do ring, porém, é calculado sobre **todos** os flows ativos daquele usuário (`storiesByUserId`) — o ring só fica acinzentado quando todos eles já foram vistos; se o usuário postar um novo flow depois de o anterior já ter sido visto, o ring volta a colorir automaticamente. Ao tocar no ring, todos os flows daquele usuário (não só o representante) são marcados como vistos de uma vez, mantendo o comportamento otimista consistente.
- Clicar no logo **LinKa** no header (quando já está na tela `/`) faz scroll para o topo e recarrega o feed silenciosamente (sem skeleton de loading) via evento `ritmofit-refresh-feed`
- Notificações de novos posts aparecem via badge no ícone de notificações (AppLayout)
- **Refresh do feed também força refetch dos badges de mensagens/notificações:** os contadores no `AppLayout` (ícones de comunidade e notificações no header/sidebar) são carregados uma vez no mount e depois mantidos via subscription realtime do Supabase — que pode cair silenciosamente (app em background no iOS, reconexão de WebView). Para não deixar o usuário com badges desatualizados, o `AppLayout` escuta os mesmos gestos de refresh do feed e refaz o fetch dos contadores: o evento `ritmofit-refresh-feed` (toque no logo/home) e o novo evento `ritmofit-refresh-badges` (disparado pelo `Index.tsx` ao final do gesto de pull-to-refresh). Assim, qualquer refresh explícito do feed atualiza o sistema inteiro — feed, mensagens e notificações.

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
- **Indicador de carrossel (dots) no feed:** No `PostCard` o indicador de fotos é renderizado **logo acima do frame de botões de incentivo** (não mais no topo-centro, onde ficava escondido atrás da pill de identidade). O `PostCarousel` expõe `onIndexChange` (reporta a foto atual) e `hideDots` (oculta os dots internos); o `PostCard` usa ambos para posicionar o indicador no container inferior. O contador em pill (`N/total`) do topo-direito é ocultado no feed via prop `hideCounter`, pois ficava atrás do botão de opções (`...`) e era impossível de ver. Demais telas (Perfil, Comunidade, PostDetail) seguem com os dots internos no topo-centro e o contador em pill visível (sem sobreposição com outros elementos)
- **Posts grandes ("1 post por vez"):** No feed, o frame de imagem do post (via prop `tall` do `PostCarousel`) usa altura calculada via CSS `calc()` que desconta exatamente o espaço de todos os elementos fixos (header, stories, tabs, bottom nav e safe areas), garantindo que o frame completo — do topo até a barra de incentivos — caiba na viewport sem scroll, em qualquer tamanho de tela. A fórmula é `calc(100dvh - max(14px, env(safe-area-inset-top) + 6px) - 314px - env(safe-area-inset-bottom))`, com `maxHeight: 500px`. O post sem foto (gradiente de fundo) e o skeleton de loading usam a mesma altura para evitar layout shift ao carregar
- **Fit adaptativo da foto (`adaptiveFit`, interno ao `ZoomableImage` em `post-carousel.tsx`):** quando o frame é `tall`, a foto é exibida com `object-cover` (preenche 100%, cortando o excedente) **somente se** sua proporção natural for próxima da proporção do frame. Quando a foto destoa muito (ex.: canvas quadrado de resumo de treino — 540×540 — gerado por `workout-summary-overlay.tsx` e compartilhado como post), o componente troca para `object-contain` (mostra a foto inteira, sem cortar nenhuma informação) e preenche o espaço ao redor com uma cópia desfocada (`blur` + `scale`) da própria foto, evitando barras vazias sólidas. A decisão é tomada em tempo de execução (`onLoad` da imagem, comparando `naturalWidth/naturalHeight` com as dimensões do frame) — não depende de metadado algum no post
- **Detalhe do treino (`WorkoutDetailButton` em `client/components/shared/workout-detail-dialog.tsx`):** posts de **resumo de treino** compartilhados via `WorkoutSummaryOverlay` agora persistem um snapshot estruturado em `posts.workout_summary` (coluna `jsonb`, ver `docs/14`) — antes o resumo era só "queimado" na imagem de canvas + legenda, perdendo os dados. Quando um post carrega esse `workout_summary` (tipo `PostWorkoutSummary` em `client/lib/workout-summary-types.ts`), o `PostCard` renderiza o pill **"Ver treino"** no overlay inferior; ao tocar, abre um **drawer glass simplificado** (padrão §9.4) com **apenas a lista de exercícios**: cada linha tem a **miniatura do exercício** (`ExerciseImage`, com fallback de gradiente/emoji por grupo muscular quando não há foto), o **nome + grupo muscular** e as **séries em chips `{kg}kg × {reps}`**. Sem stats/banners extras — é intencionalmente enxuto (o overlay completo com stats/PR/máquina continua sendo o `WorkoutSummaryOverlay` na tela de Metas). Optou-se por um pill dedicado (em vez de tornar a imagem inteira clicável) para não conflitar com o duplo-toque de incentivo, o pinch-zoom e o swipe de carrossel já existentes na imagem. As repetições por série vêm de `completedExercises[].sets` e a foto de `completedExercises[].photo` (`workoutPhoto`), capturados no `WorkoutSessionDialog` ao finalizar o treino — **posts antigos** (sem `workout_summary`) simplesmente não mostram o pill (degradação graciosa). O mesmo pill/drawer aparece no **Perfil** (viewer de post) e no **PostDetail**.
- **Drawer de progresso da meta (tocar no card de meta/badge `🎯 N%` do post, `Index.tsx`):** segue o padrão **Drawer Glass** (`docs/15-design-system.md` §9.4) — shell escuro translúcido via `GLASS_SHEET_STYLE`/`GLASS_SHEET_PROPS`, cards internos (info da meta, grid de stats, accordion de rotinas vinculadas) em `GLASS_PANEL_STYLE`, texto branco/translúcido e botão "Copiar meta" em gradiente azul→roxo (`GLASS_PRIMARY_BTN_STYLE`). O `RoutineAccordion` (sub-componente local do `Index.tsx`, compartilhado entre dono e visitante do post) também foi migrado para o mesmo tema escuro
