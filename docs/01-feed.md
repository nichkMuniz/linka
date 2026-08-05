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
  - **Travar gravação (mãos livres):** durante a gravação, **arrastar o obturador para cima** (> `LOCK_DRAG_THRESHOLD` = 70px, medido de `shutterStartYRef`) **trava** a gravação — o usuário solta o dedo e a gravação continua sozinha (o botão passa a exibir um cadeado `Lock`). Para encerrar, **toca no obturador de novo** (`recordLockedRef` + guard `ignoreNextShutterUpRef` para o toque de parada não virar "foto"). A dica no rodapé reflete o estado (segurar → "arraste para cima 🔒 para gravar sem segurar" → "toque para parar").
  - Gravação usa `MediaRecorder` com áudio do microfone (permissão lazy; se negada, grava sem som)
  - Limites de vídeo (constantes no topo do arquivo): **duração de até 1 min** (`MAX_RECORD_MS` = 60000 na gravação; `MAX_VIDEO_DURATION_S` = 60 para vídeos da galeria) e **tamanho de até 100MB** (`MAX_MEDIA_BYTES`) — vídeos editados/da galeria costumam ser mais pesados. Indicador de gravação (anel vermelho + contador `M:SS`)
  - Vídeo gerado é enviado pelo mesmo fluxo de upload (`handleCreateStory`), que detecta o tipo via MIME (`.mp4`/`.webm`)
  - **Vídeo da galeria usa Blob URL** (não data URL): a sonda de duração (`<video preload=metadata>`) rejeita clipes acima de 1 min; data URL de vídeo grande estoura memória e dá tela preta no WebView do iOS. Imagens continuam via data URL (o bake no canvas depende dela). O upload (`handleCreateStory` em `Index.tsx`) faz `fetch()` da URL — funciona igual para blob e data URL — e envia para o bucket `posts`. **Atenção:** o limite de tamanho do bucket `posts` no Supabase precisa ser ≥ 100MB, senão o upload falha no servidor
  - **Preview de vídeo com áudio:** o `<video>` do preview na etapa de compartilhar toca **com som** (mesma dinâmica dos viewers — `onLoadedData` tenta `muted=false; play()` e cai para mudo se o iOS bloquear). Antes o preview saía mudo e o áudio só "voltava" no flow postado, o que confundia. Combina com a `AVAudioSession .playback` do `AppDelegate` (som mesmo no silencioso).
  - **Indicador de preparação** (`isPreparingMedia`): entre selecionar o arquivo na galeria e o preview ficar realmente pronto, um overlay com spinner ("Preparando mídia…") cobre a tela — antes a tela parecia travada na galeria. Para vídeo o indicador cobre as **duas** etapas lentas: (1) leitura da metadata/duração (moov no fim do arquivo) pela sonda `<video preload=metadata>` e (2) decodificação do **1º frame** do `<video>` do preview — quem encerra é o `onLoadedData` desse vídeo (via `finishPreparing`), evitando o flash de frame preto. Para imagem, encerra assim que o `FileReader` termina. Duas redes de segurança impedem que o indicador fique preso: 20s na sonda de metadata (segue mesmo assim) e 25s no total (`prepareSafetyRef`); `resetForm` também limpa tudo
- **Enquadramento da mídia (tela de compartilhar):** na etapa final, imagem **e vídeo** podem ser **redimensionados (pinça)** e **movidos (arraste)** estilo story do Instagram. A camada de gestos cobre a mídia (inclusive o vídeo — isso também impede gestos nativos do iOS sobre o `<video>`)
  - **Imagem:** o enquadramento é **composto num canvas** (`bakeTransformedImage`) com fundo desfocado, para que o resultado salvo seja exatamente o que o usuário vê. O `object-fit` do primeiro plano depende da origem (flag `mediaFromGallery`):
    - **Galeria** → **`contain`** (`containRect` no bake): a imagem inteira aparece por padrão, sem cortar — o fundo desfocado preenche as bordas. Resolve o caso de fotos "menores"/recortadas (ex.: um print de uma frase) que antes saíam cortadas pelo `object-cover`. Imagens da galeria são **sempre** compostas no frame 9:16 (mesmo sem pinça/zoom), então o resultado postado é idêntico ao preview e o `FlowViewer` só dá `object-cover` sobre um frame que já tem o aspecto certo. O usuário pode pinçar/arrastar para reenquadrar/cortar como preferir.
    - **Câmera** → **`cover`** (`coverRect`): full-bleed, pois o viewfinder já é WYSIWYG. Só recompõe no canvas quando houve pinça/arraste; sem transform, o original preenche a tela via `object-cover` no viewer.
  - **Vídeo:** como não pode ser recomposto no cliente, o enquadramento é **persistido** em `flow.media_transform` (`{ scale, x%, y% }`) e reaplicado via CSS `transform` no `FlowViewer`. Requer a coluna `media_transform` (ver `docs/14`); sem ela, o vídeo é salvo sem enquadramento (degradação graciosa)
- **Legenda posicionada sobre a foto/vídeo (etapa de compartilhar):** além da descrição no rodapé, o usuário pode **tocar em qualquer ponto vazio da mídia** — ou no botão **"+ Aa"** — para adicionar **frases livres em qualquer lugar da mídia** (mesma experiência do modo de texto do flow): arrastar para reposicionar, **pinçar para redimensionar**, tocar para reeditar, e escolher **cor, fonte e alinhamento**. O toque é detectado na própria camada de gestos da mídia (`handleMediaPointer*` + `mediaTapRef`): um toque curto sem arraste/pinça abre um novo texto; multitoque ou movimento > 8px viram ajuste da mídia e cancelam o toque. Tocar sobre uma frase já posta a reedita (os itens param a propagação). Os controles de estilo (`textStyleControls`) oferecem uma **paleta ampliada de cores** (row rolável horizontal, `no-scrollbar`) e **10 fontes** de sistema iOS (Bold, Light, Rounded, Impact, Serif, Elegant, Script, Marker, Type, Mono — todas com fallback genérico, sem carregar arquivo de fonte). O **tamanho** da legenda é ajustado por **gesto de pinça** (estilo Instagram), não por slider: `fontSize` em px no `style`, faixa 16–64, padrão 30 (= antigo `text-3xl`). **Roteamento de gestos (regra Instagram):** na etapa de legenda sobre a mídia, as frases são renderizadas **`pointer-events-none`** (`captionTextItems`, registradas em `textElsRef`) e **todos os gestos passam por uma única camada** (`handleMediaPointer*` + `capGestureRef`), que decide o alvo no 1º dedo: **se existe legenda → o gesto controla a legenda** (pinça = `fontSize`, 1 dedo = mover; a que está sob o dedo, senão a última) e a foto fica travada; **se não existe legenda → controla a mídia** (reenquadra foto/vídeo). Isso resolve o bug em que a pinça "escorregava" para a foto quando os dedos saíam de cima do texto pequeno. Toque curto: sobre uma frase (hit-test em `textElsRef`) reedita; em área vazia abre novo texto. No **modo texto puro** (gradient, sem mídia) as frases continuam com handlers próprios (`committedTextItems` + `textGestureRef`), pois não há camada de mídia para conflitar. Consequência da regra: para reenquadrar a foto é preciso não ter legenda ainda (enquadre antes de escrever). Flows antigos sem `fontSize` caem para 30 nos viewers.
  - **Realce de fundo (estilo Instagram):** um botão **"A"** na barra de estilo liga/desliga um **fundo colorido** atrás da legenda (`style.backgroundColor`). Com o realce ligado, a **paleta de cores passa a definir a cor do fundo** e o texto vira automaticamente **preto ou branco** conforme a luminância (`contrastText`), para continuar legível — igual ao Instagram, e a cor do fundo é totalmente personalizável pela paleta. O realce é desenhado como um `<span>` com `box-decoration-break: clone` + padding + `border-radius`, então **cada linha ganha sua própria caixa arredondada** colada ao texto (não um retângulo único). Na `<textarea>` de edição o fundo é uma faixa sólida (aproximação ao vivo); o resultado por-linha aparece na frase já posta e nos viewers. `backgroundColor` é salvo junto do resto do `style` em `flow.text_elements` (sem migração — é jsonb); flows antigos sem o campo aparecem sem fundo. As frases são salvas em `flow.text_elements` (x/y em %, com `style`) — **não são "queimadas" na imagem**: ficam nítidas e são renderizadas ao vivo por cima da mídia no `FlowViewer`/`FlowViewerModal`. Os controles de estilo (`textStyleControls`) e as frases posicionadas (`committedTextItems`) são compartilhados entre o modo de texto e a legenda sobre a foto
- **Marcação de pessoas (estilo Instagram)**: na etapa de compartilhar, o botão **@** (ao lado do "+ Aa") abre o `TagPeopleDrawer` (o mesmo do feed) para marcar quem quiser; os marcados aparecem numa linha de avatares acima da descrição. Os ids são passados no 7º parâmetro de `onCreateStory` → `createStoryDb` → tabela `flow_tags`, e a trigger gera notificação **type 16** ("marcou você em um flow") + push para cada marcado. No viewer (`FlowViewer`/`FlowViewerModal`), os marcados viram chips tocáveis (abrem o perfil) acima da doca; e quem foi marcado ganha um botão **"Repostar no meu flow"** (`repostStoryDb`) que cria um flow próprio reaproveitando a mídia do original — igual ao "adicionar ao seu flow" do Instagram. **Pendências no Supabase:** rodar `docs/migrations/20260729-flow-tags.sql` e redeploy da edge function `send-push-notification`.
- Botão confirmar publicação

**FlowViewerModal / tela `/flows/:storyId` (`FlowViewer.tsx`):**
- Visualização em tela cheia do story
- Progresso automático entre stories — barras com leve glow no estado ativo/concluído
  - **Flows de imagem/texto:** duração fixa de 8s por story (timer interno).
  - **Barra só avança com a mídia carregada (`mediaReady`):** ao trocar de story, a barra fica parada (e um spinner `Loader2` cobre a área) até a mídia sinalizar que carregou — `onLoad` da `<img>` ou `onLoadedData` do `<video>` chamam `markMediaReady`. Antes a barra rolava por cima de uma imagem/vídeo ainda carregando (mídia de outros usuários demora na rede). O timer de imagem só decrementa quando `mediaReadyRef` é true; vídeo já era naturalmente sincronizado (progresso vem de `currentTime`). Texto puro (sem `media_url`) fica pronto na hora. Rede de segurança de 12s libera mesmo assim se a mídia não sinalizar (erro silencioso/rede ruim), e `onError` também destrava (imagem) ou pula (vídeo). Vale para o `FlowViewer.tsx` e o `FlowViewerModal`.
  - **Flows de vídeo:** a barra de progresso é sincronizada com a duração real do vídeo (eventos `timeupdate`/`ended` do elemento `<video>`) — preenche conforme o vídeo toca e avança automaticamente quando ele termina, em vez de usar o tempo fixo de 8s. Enquanto o usuário digita um comentário ou o flow está pausado, o vídeo também pausa (a barra congela). Vale para o `FlowViewerModal` e a tela `/flows/:storyId` (`FlowViewer.tsx`).
  - **Correção do `duration = Infinity` (vídeos gravados):** vídeos do `MediaRecorder` chegam com `video.duration = Infinity` até um seek forçar o cálculo — sem isso a barra **nunca andava** (o guard `isFinite(duration)` falhava). O `onLoadedMetadata` faz o *seek-trick* (`currentTime = 1e101` → ao voltar finito, reseta para 0 e retoma) e só então libera a barra (`videoDurationReadyRef`), evitando também o salto durante o seek. Vale para os dois viewers. Vídeos da galeria (metadata correta) nunca caem nesse caminho.
  - **Ref do `<video>` no AnimatePresence (bug "só o 1º flow anda"):** o `<video>` que **sai** na transição compartilhava `ref={videoRef}` com o que **entra**; ao desmontar (~0,3s depois), zerava `videoRef.current` do vídeo atual → a barra do 2º flow em diante congelava. Agora o ref só é **atribuído no mount** (`ref={(el) => { if (el) videoRef.current = el }}`), então o vídeo que sai não mexe no ponteiro; flows sem vídeo limpam o ref no efeito de troca de story.
  - **Pré-carregamento do próximo flow (`FlowViewer.tsx`):** depois que a mídia atual aparece (`mediaReady`), o próximo flow é pré-carregado — imagem aquece o cache do CDN (`new Image()`), vídeo baixa só a metadata + 1º frame (`preload="metadata"`) — para o avanço ficar mais rápido sem disputar banda com o vídeo atual nem baixar clipes de 100MB inteiros à toa.
  - **Áudio dos vídeos:** o vídeo do flow ativo toca **com som** (o vídeo gravado inclui a track de microfone, e o de galeria preserva o áudio original). O helper `playWithSound` tenta tocar com áudio (`muted = false`) e, se o iOS bloquear o autoplay-com-som (só liberado com gesto do usuário recente — abrir o flow é um toque, então normalmente funciona), cai para mudo em vez de travar num frame preto. Os `<video>` de preview do usuário anterior/próximo continuam `muted`. O áudio sai **mesmo com o iPhone no silencioso**: o `AppDelegate.swift` configura a `AVAudioSession` na categoria `.playback` (em `didFinishLaunchingWithOptions` e reaplicada em `applicationDidBecomeActive`), que faz a mídia do WKWebView ignorar o switch de silencioso — igual a Instagram/TikTok. Como efeito colateral esperado dessa categoria, tocar um vídeo com som interrompe o áudio de fundo (música de outro app) enquanto ele toca.
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
| **Seguindo** | Posts dos usuários que o usuário segue (ordem cronológica) |
| **Descobrir** | Posts de toda a plataforma, **ranqueados por engajamento × recência** |

**Ranking do Descobrir (`rankDiscoverPosts` em `client/services/post.service.ts`):** o Descobrir **não é mais cronológico puro**. Cada página buscada (janela recente, paginada por cursor de `created_at`) é reordenada por um score `(1 + engajamento) × recência × bônus_de_mídia`, onde `engajamento = totalDeIncentivos + 2×comentários`, `recência = 0.5^(idadeEmHoras / 36)` (decaimento exponencial, meia-vida 36h) e `bônus_de_mídia = 1.15` quando o post tem foto. Como todos os candidatos de uma página já vêm de uma faixa recente (via cursor), o efeito é "**entre os posts recentes, mostra os mais engajados primeiro**" — sem starvar conteúdo novo globalmente. Escolha conservadora de propósito para base pequena; um ranking agressivo por likes concentraria o feed nos mesmos poucos posts. _(O modo **Seguindo** continua cronológico — `getFeedPosts` não passa por esse ranking.)_ Match por objetivo do usuário ficou de fora do v1 (posts não têm categoria/tópico no schema).

**Scroll infinito nos dois modos:** tanto **Seguindo** quanto **Descobrir** paginam por cursor de `created_at` via uma **sentinela de fundo** (`IntersectionObserver`, `rootMargin: 800px`). Seguindo usa `getFeedPosts({ before })` (`FEED_PAGE_SIZE = 20`) com o cursor sendo o `created_at` do último post (lista cronológica). Descobrir usa `getDiscoverPosts({ before })` (`DISCOVER_PAGE_SIZE = 20`); como o Descobrir é **ranqueado** (não cronológico — ver acima), o cursor é o `created_at` **mínimo** já carregado, não o último item exibido, garantindo que a próxima página traga posts mais antigos que toda a janela atual (sem sobreposição). Ao mesclar cada nova página, há **dedup por id** (`Set` dos ids já presentes) para nunca repetir um post que já está na tela — importante porque os posts carregam estado otimístico de incentivo. Quando uma página volta com menos itens que o tamanho de página, `hasMoreFeed`/`hasMoreDiscover` viram `false` e a sentinela some. Ambos os flags são persistidos no `feedCache` de módulo (sobrevivem à navegação) e resetados para `true` em todo refresh explícito (toque no logo, pull-to-refresh). Antes, o Descobrir carregava só uma leva fixa de 30 posts e travava ali — dando a sensação de app pequeno.

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
| **Pessoas marcadas** | Linha "👥 com {nick}" (ícone `UsersRound`) logo acima da descrição, quando o autor marcou pessoas no post (`post.taggedUsers`, tabela `post_tags`). 1 pessoa → toque navega direto ao perfil; 2+ → rótulo "com {nick} e mais {n}" e o toque abre o `FollowListDrawer` com título "Pessoas marcadas" (cada linha navega ao perfil e tem `FollowButton`) |
| **Pill "Ver treino"** | Só em posts de **resumo de treino** (posts com `workout_summary`). Selo tocável 🏋️ no overlay inferior (acima da barra de incentivos) que abre o `WorkoutDetailButton`/drawer **simplificado** com a lista de exercícios — miniatura do exercício + nome/grupo muscular + as séries em chips `{kg}kg × {reps}`. Ver "Detalhe do treino" abaixo |
| **Meta vinculada** | Card mostrando a meta associada ao post (se houver) |
| **Rotinas vinculadas** | Lista expansível das rotinas da meta |
| **Botões de Incentivo** | 6 reações com ícones expressivos: ❤️ Apoio, 🔥 Fogo, 🏆 Vencedor, 📈 Evolução, 💪 Força, ⚡ Energia (componente `PostIncentiveButton`) |
| **Botão Comentários** | Abre `PostCommentsDialog` — apenas o ícone, sem contador numérico ao lado |
| **Contador de curtidas** | Clicável — abre `PostLikesModal` |

---

## Ações Disponíveis

### Sobre o próprio post (dono)
- **Editar post** — Drawer (`EditPostDrawer`) com textarea para editar descrição + seletor de meta ativa (vincula/desvincula meta do post) + seção **"Pessoas marcadas"** (chips com X para remover + botão "Marcar" que abre o `TagPeopleDrawer`). Ao salvar, `setPostTagsDb` aplica o diff das marcações (insere só os novos → a trigger notifica apenas quem acabou de ser marcado; remove quem saiu). Após salvar, o feed recarrega (`handlePostSaved` → `loadFeed(false)`)
- **Excluir post** — AlertDialog de confirmação → deleta via `deletePostDb`

### Sobre post de outro usuário
- **Denunciar usuário** — Dialog com seletor de motivo
- **Denunciar post** — Dialog com seletor de motivo

### Interações com qualquer post
- **Abrir a publicação (2026-07-13)** — **toque simples** na mídia navega para `/post/:id` (`PostDetail`). Antes, o toque simples não fazia nada: o único jeito de abrir um post era por notificação ou deep link. O toque só dispara depois da janela de duplo toque (300ms), senão o segundo toque navegaria antes do overlay abrir
- **Incentivo rápido** — **duplo toque** na mídia abre o `QuickIncentiveOverlay` (os 6 tipos)
- **Incentivar** — Toggling nos 6 tipos de incentivo (`togglePostLike`), via barra (primário) ou overlay (secundários)
- **Comentar** — Abre drawer/dialog de comentários
- **Ver curtidas** — Modal com lista de usuários que curtiram
- **Copiar meta** — Se o post tiver meta, botão para copiar para o próprio perfil
- **Compartilhar** (menu ⋮) — Abre o `ShareDrawer` com link externo (`postShareUrl`) **e** botão "Amigos" como primeira opção (2026-07-12): abre o `SendToFriendDrawer`, que envia o post via mensagem privada (prefixo `[post]:<postId>`, renderizado como card rico na conversa da Comunidade)

---

## Estados da Tela

| Estado | Comportamento |
|---|---|
| **Carregando** | Exibe `PostSkeleton` (loading skeleton animado) |
| **Feed vazio (2026-07-13)** | Card glass "Seu feed começa aqui" com **5 perfis sugeridos** (`getAllUsersDb`), cada um com `UserAvatar` + bio + `FollowButton` — seguir acontece ali mesmo, sem sair da tela. Abaixo, botão secundário "Encontrar pessoas" (→ `/buscar`). Antes era só um `text-xs` cinza e um botão fantasma de 28px: a primeira tela de todo usuário novo era um beco sem saída. Os perfis só são buscados quando o empty state de fato aparece |
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
| Pessoas marcadas nos posts | `getPostTagsBatchDb()` (em lote, interno de `getFeedPosts`/`getDiscoverPosts`) |
| Stories ativos | `getActiveStoriesDb()` |
| Perfil do usuário | `getUserProfileDb()` |
| Rotinas de uma meta | `getRoutinesByGoalIdDb(goalId, userId)` — filtra pelo `userId` (dono do post), senão traria as rotinas de todos que vincularam à mesma meta de catálogo |
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
| `FollowListDrawer` | Lista de pessoas marcadas no post (2+), com título customizado via prop `title` |
| `ImageWithFallback` | Imagem com fallback |
| `UserInsignias` | Badges do usuário |
| `PostSkeleton` | Loading state |
| `LoadingSpinner` | Spinner genérico |

---

## Fluxo de Dados em Tempo Real

- Feed não tem realtime
- **Feed estático entre navegações (cache de módulo):** o feed **não recarrega** ao voltar de outra tela. Um cache singleton em nível de módulo (`feedCache` em `Index.tsx`) persiste o estado completo entre montagens — posts, posts de Descobrir, stories, rings (`viewedStoryIds`), aba ativa (Seguindo/Descobrir), `hasMoreFeed` e a posição de scroll. Ao remontar, os estados do React são inicializados a partir do cache (sem skeleton, sem refetch), de modo que a tela aparece exatamente como o usuário a deixou — sem o flash de rings desatualizados que ocorria no reload. Um **refresh real de rede** só acontece em 3 situações: (1) primeira carga, (2) toque no ícone **home**/logo (evento `ritmofit-refresh-feed`), (3) gesto de **pull-to-refresh**. O cache é invalidado quando o `user.id` logado muda (login de outro usuário força recarga).
- **Cache de flows invalidado apenas no refresh EXPLÍCITO (`loadFeed(showLoading, force)` em `Index.tsx`):** `getActiveStoriesDb()` (em `ritmofit-db.ts`) usa cache stale-while-revalidate (TTL de 60s, com fallback persistido em `localStorage` por até 24h) — sem cuidado, um refresh manual dentro da janela de TTL devolvia a mesma lista antiga na hora e só disparava um refetch em segundo plano (sem re-render), exigindo repetir o refresh 2-3 vezes até o flow novo de um seguidor aparecer. `loadFeed` chama `invalidateQueryCache("activeStories")` **somente quando `force = true`**, o que cobre os 4 refreshes pedidos pelo usuário (home/logo, pull-to-refresh, após publicar, `state.refreshFeed`) — os flows vêm frescos do banco na primeira tentativa. Na **carga inicial** (`force = false`) o cache é preservado: invalidar ali descartava uma entrada ainda válida e forçava uma query de flows a **cada abertura do app**, sem que ninguém tivesse pedido dados novos.
- **Rings otimistas:** ao abrir um flow pelo carrossel, o `story.id` é marcado como visto na hora (`onStoryView` → `viewedStoryIds`), acinzentando o ring imediatamente sem precisar recarregar o feed.
- **Ring reflete TODOS os flows do usuário, não só o mais antigo (`FlowCarousel`):** o carrossel agrupa os flows de cada usuário num único ring, usando sempre o **mais antigo** como representante para abrir a sequência a partir do início. O estado "visto" do ring, porém, é calculado sobre **todos** os flows ativos daquele usuário (`storiesByUserId`) — o ring só fica acinzentado quando todos eles já foram vistos; se o usuário postar um novo flow depois de o anterior já ter sido visto, o ring volta a colorir automaticamente. Ao tocar no ring, todos os flows daquele usuário (não só o representante) são marcados como vistos de uma vez, mantendo o comportamento otimista consistente.
- Clicar no logo **LinKa** no header (quando já está na tela `/`) faz scroll para o topo e recarrega o feed silenciosamente (sem skeleton de loading) via evento `ritmofit-refresh-feed`
- Notificações de novos posts aparecem via badge no ícone de notificações (AppLayout)
- **Refresh do feed também força refetch dos badges de mensagens/notificações:** os contadores no `AppLayout` (ícones de comunidade e notificações no header/sidebar) são carregados uma vez no mount e depois mantidos via subscription realtime do Supabase — que pode cair silenciosamente (app em background no iOS, reconexão de WebView). Para não deixar o usuário com badges desatualizados, o `AppLayout` escuta os mesmos gestos de refresh do feed e refaz o fetch dos contadores: o evento `ritmofit-refresh-feed` (toque no logo/home) e o novo evento `ritmofit-refresh-badges` (disparado pelo `Index.tsx` ao final do gesto de pull-to-refresh). Assim, qualquer refresh explícito do feed atualiza o sistema inteiro — feed, mensagens e notificações.

---

## Observações Técnicas

- **Pull-to-refresh sem re-render (2026-07-13):** o gesto é conduzido por **refs + estilo imperativo no DOM** (`pullIndicatorRef`/`pullSpinnerRef`), não por `setState`. Um `setPullDistance()` por `touchmove` re-renderizava a lista inteira de posts a ~60fps — justamente durante o arrasto, quando o frame não pode cair. Mesmo padrão já usado em `Profile.tsx` e agora também em `Notifications.tsx`
- **Dica "puxe para atualizar" ao voltar de background (2026-07-17):** como o feed é um **cache estático entre navegações** (não recarrega sozinho — ver "Feed estático"), um usuário que volta ao app depois de um tempo veria conteúdo velho sem saber. Ao retornar ao **foreground depois de ≥5min em background**, um **tooltip glass flutuante** aparece logo abaixo do header ("Puxe para baixo para atualizar — pode haver novas publicações", chave `feed_refresh_hint`), com um `ChevronDown` que pulsa para baixo indicando o gesto. O tempo em background é medido via `appStateChange` do Capacitor (nativo) ou `visibilitychange` (web), comparando o timestamp em `backgroundedAtRef`. A dica **some sozinha após 9s** e também some quando o feed é atualizado de qualquer forma (pull-to-refresh, toque no logo). **Tocar na dica** dispara o mesmo refresh do logo/home (`ritmofit-refresh-feed`: rola ao topo + `loadFeed(false, true)`), então funciona mesmo se o usuário estiver com a lista rolada (onde o pull-to-refresh sozinho não dispara)
- **Pull-to-refresh não dispara com drawer aberto (2026-07-17):** o `onTouchStart` do container do feed **aborta o gesto** quando há um drawer/dialog/sheet aberto por cima (detector `document.querySelector('[role="dialog"],[role="alertdialog"],[vaul-drawer]')`, o mesmo de `use-edge-swipe-back.ts`). Antes, arrastar de cima para baixo para **fechar um drawer** (gesto nativo do vaul) também atualizava o feed por baixo — dois efeitos no mesmo gesto. Agora, com overlay aberto, o swipe **só fecha o drawer**; o pull-to-refresh só é armado quando não há nenhum overlay na tela
- **Auras de fundo sem `filter: blur` (2026-07-13):** o brilho ambiente é **um** elemento com três `radial-gradient` pintados direto, em vez de três divs com `filter: blur(65px)`. `filter` e `backdrop-filter` são as propriedades mais caras do WebKit e o feed já empilha vários `backdrop-filter` simultâneos (header, bottom nav, segment control, barra de ação de cada card) — o blur das orbs era custo de compositing puro a cada frame de scroll, sem diferença visual relevante. Mesma troca feita em `Goals.tsx` e `Notifications.tsx`
- Posts são paginados ou carregados em batch completo
- Incentivos têm estado otimístico (UI atualiza imediatamente antes da confirmação do servidor)
- Rotinas vinculadas a posts carregam sob demanda (lazy load) ao expandir
- Stories do usuário logado mostram contagem de visualizadores
- Descrições de posts usam `whitespace-pre-wrap` para preservar quebras de linha
- **Hashtags clicáveis:** as hashtags destacadas na legenda (`renderWithHashtags`, `client/lib/post-visuals.tsx`) são tocáveis — o `PostCard` passa `(tag) => navigate('/tag/'+tag)`, abrindo a página da hashtag (grade de posts, ver `docs/16-hashtag.md`). O `stopPropagation` no clique evita disparar o toggle de expandir/recolher a legenda
- Descrições com mais de 30 caracteres ou múltiplas linhas são truncadas exibindo apenas a primeira linha (até 30 chars) seguida de `...` e botão **"mais"** (chave i18n `feed_description_more`); ao expandir, exibe-se o texto completo com botão **"menos"** (`feed_description_less`) para recolher. Estado de expansão é local ao `PostCard`
- O `body` tem `padding-right: 0 !important` no CSS global para evitar layout shift ao abrir modals/drawers (Radix UI injeta padding-right ao bloquear scroll)
- **Pinch-to-zoom em todos os posts:** Toda imagem de post (feed Seguindo, Descobrir e PostDetail) é renderizada via `PostCarousel`, que usa o componente interno `ZoomableImage` com gesto de pinça (dois dedos). Escala de 1x até 5x, origem do zoom segue o ponto médio entre os dedos; ao soltar, retorna a 1x com transição suave. Funciona inclusive para posts legados com campo único `post.photo` (encapsulado como `[post.photo]` no carrossel)
- **Indicador de carrossel (dots) no feed:** No `PostCard` o indicador de fotos é renderizado **logo acima do frame de botões de incentivo** (não mais no topo-centro, onde ficava escondido atrás da pill de identidade). O `PostCarousel` expõe `onIndexChange` (reporta a foto atual) e `hideDots` (oculta os dots internos); o `PostCard` usa ambos para posicionar o indicador no container inferior. O contador em pill (`N/total`) do topo-direito é ocultado no feed via prop `hideCounter`, pois ficava atrás do botão de opções (`...`) e era impossível de ver. Demais telas (Perfil, Comunidade, PostDetail) seguem com os dots internos no topo-centro e o contador em pill visível (sem sobreposição com outros elementos)
- **Posts grandes ("1 post por vez"):** No feed, o frame de imagem do post (via prop `tall` do `PostCarousel`) usa altura calculada via CSS `calc()` que desconta exatamente o espaço de todos os elementos fixos (header, stories, tabs, bottom nav e safe areas), garantindo que o frame completo — do topo até a barra de incentivos — caiba na viewport sem scroll, em qualquer tamanho de tela. A fórmula é `calc(100dvh - max(14px, env(safe-area-inset-top) + 6px) - 314px - env(safe-area-inset-bottom))`, com `maxHeight: 500px`. O post sem foto (gradiente de fundo) e o skeleton de loading usam a mesma altura para evitar layout shift ao carregar
- **Fit adaptativo da foto (`adaptiveFit`, interno ao `ZoomableImage` em `post-carousel.tsx`):** quando o frame é `tall`, a foto é exibida com `object-cover` (preenche 100%, cortando o excedente) **somente se** sua proporção natural for próxima da proporção do frame. Quando a foto destoa muito (ex.: canvas quadrado de resumo de treino — 540×540 — gerado por `workout-summary-overlay.tsx` e compartilhado como post), o componente troca para `object-contain` (mostra a foto inteira, sem cortar nenhuma informação) e preenche o espaço ao redor com uma cópia desfocada (`blur` + `scale`) da própria foto, evitando barras vazias sólidas. A decisão é tomada em tempo de execução (`onLoad` da imagem, comparando `naturalWidth/naturalHeight` com as dimensões do frame) — não depende de metadado algum no post
- **Detalhe do treino (`WorkoutDetailButton` em `client/components/shared/workout-detail-dialog.tsx`):** posts de **resumo de treino** compartilhados via `WorkoutSummaryOverlay` agora persistem um snapshot estruturado em `posts.workout_summary` (coluna `jsonb`, ver `docs/14`) — antes o resumo era só "queimado" na imagem de canvas + legenda, perdendo os dados. Quando um post carrega esse `workout_summary` (tipo `PostWorkoutSummary` em `client/lib/workout-summary-types.ts`), o `PostCard` renderiza o pill **"Ver treino"** no overlay inferior; ao tocar, abre um **drawer glass simplificado** (padrão §9.4) com **apenas a lista de exercícios**: cada linha tem a **miniatura do exercício** (`ExerciseImage`, com fallback de gradiente/emoji por grupo muscular quando não há foto), o **nome + grupo muscular** e as **séries em chips `{kg}kg × {reps}`**. Sem stats/banners extras — é intencionalmente enxuto (o overlay completo com stats/PR/máquina continua sendo o `WorkoutSummaryOverlay` na tela de Metas). Optou-se por um pill dedicado (em vez de tornar a imagem inteira clicável) para não conflitar com o duplo-toque de incentivo, o pinch-zoom e o swipe de carrossel já existentes na imagem. As repetições por série vêm de `completedExercises[].sets` e a foto de `completedExercises[].photo` (`workoutPhoto`), capturados no `WorkoutSessionDialog` ao finalizar o treino — **posts antigos** (sem `workout_summary`) simplesmente não mostram o pill (degradação graciosa). O mesmo pill/drawer aparece no **Perfil** (viewer de post) e no **PostDetail**.
  - **Cardio mostra min×km, não kg×reps (2026-08-05):** exercícios de cardio (corrida, bike) codificam a série como **kg = MINUTOS** e **reps = KM** (mesmo contrato do `WorkoutSessionDialog`). O drawer trazia isso como "15kg × 3", errado. Cada exercício do resumo agora carrega um flag **`isCardio`** decidido na origem via `isCardioExercise(muscleGroup, workoutId)` (que já embute a exceção do **cardio estacionário** — polichinelo/burpee etc. seguem kg×reps). O flag flui `WorkoutSessionSummary → WorkoutSummaryData → buildPostWorkoutSummary → posts.workout_summary`, e o `formatSet` do `WorkoutDetailButton` renderiza "{min}min × {km}km" quando `isCardio`. **Snapshots anteriores a 05/08/2026** não têm o flag (não dá para inferir cardio sem o `workoutId`) → continuam em kg×reps (degradação graciosa); só posts novos saem corretos.
- **Rotinas vinculadas escopadas ao dono do post (2026-07-17):** o drawer de progresso da meta lista apenas as rotinas do **autor do post** (`getRoutinesByGoalIdDb(goal_id, post.user_id)`). Antes, a query filtrava só por `goal_id` — e como `goal_id` referencia uma **meta de catálogo compartilhada**, o drawer mostrava as rotinas de **todos os usuários** que vincularam alguma rotina àquela mesma meta. No próprio post isso significa "só as minhas rotinas"; em post de outra pessoa, só as rotinas do autor (as que o botão "Copiar meta" de fato copia)
- **Drawer de progresso da meta (tocar no card de meta/badge `🎯 N%` do post, `Index.tsx`):** segue o padrão **Drawer Glass** (`docs/15-design-system.md` §9.4) — shell escuro translúcido via `GLASS_SHEET_STYLE`/`GLASS_SHEET_PROPS`, cards internos (info da meta, grid de stats, accordion de rotinas vinculadas) em `GLASS_PANEL_STYLE`, texto branco/translúcido e botão "Copiar meta" em gradiente azul→roxo (`GLASS_PRIMARY_BTN_STYLE`). O `RoutineAccordion` (sub-componente local do `Index.tsx`, compartilhado entre dono e visitante do post) também foi migrado para o mesmo tema escuro
