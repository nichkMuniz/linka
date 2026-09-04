# Tela: Feed (Index)

> **Recorte v1.0** (ver [20-lancamento-v1.md](./20-lancamento-v1.md)):
> - **A aba inicial é decidida por usuário, não por flag.** Quem já segue
>   alguém abre em **"Seguindo"** — é o feed que a pessoa montou. Só quem ainda
>   não segue ninguém cai em **"Descobrir"**, porque "Seguindo" mostraria uma
>   tela vazia. A decisão acontece em `loadFeed`, com o resultado de
>   `getFollowingIdsDb()` (cacheado, e já lido por `getFeedPosts` no mesmo
>   tick), **antes do primeiro paint do conteúdo** — a tela ainda está no
>   skeleton, então não há flicker de aba.
> - A escolha automática roda **uma vez por sessão de tela** (`autoTabDecided`).
>   Sem essa trava, um pull-to-refresh de quem não segue ninguém arrastaria a
>   pessoa de volta para "Descobrir" mesmo depois de ela tocar em "Seguindo".
>   Um cache de feed válido também vence o automático.
> - **Novo: "Bloquear" no menu "..." do post** (Guideline 1.2). Denunciar
>   sozinho deixa a vítima esperando moderação; bloquear resolve na hora. O post
>   é onde o incômodo aparece, então é por aqui que a maioria chega à ação.
>   Depois de bloquear, o feed recarrega sem skeleton e o card some sozinho.
> - **Hashtags no texto do post não são tocáveis** (`FEATURES.hashtags`). A rota
>   `/tag/:tag` não existe no v1, e o toque cairia no catch-all que joga o
>   usuário no feed. `renderWithHashtags` ignora o callback quando a flag está
>   desligada — um único ponto conserta feed, detalhe do post, shots e flows.
> - Posts de usuários bloqueados são filtrados no feed e em Descobrir.
> - **Descobrir é puramente cronológico** (27/08/2026). Havia um
>   `rankDiscoverPosts` que reordenava por engajamento (curtidas + 2×comentários)
>   com decaimento de recência de 36h. A intenção era boa e o efeito foi ruim:
>   com base pequena o engajamento se concentra em poucas pessoas, então o score
>   agrupava vários posts do mesmo autor em sequência — inclusive posts antigos
>   passando à frente de recentes. O usuário via "o feed de uma pessoa só".
>   **Removido, não escondido atrás de flag:** ranking por engajamento precisa de
>   volume para não virar isso.

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
- Clicar em um story abre o viewer **no 1º flow ainda não visto** (`pickFlowEntry`, `client/lib/flow-entry.ts`), em ordem cronológica — se o autor postou 3 que você já viu e publicou um 4º, o toque leva direto ao 4º. Só quando **todos** já foram vistos é que volta ao mais antigo (rever de propósito).
- O "já vi" vem de `getMyViewedFlowUserIdsDb` (tabela `flow_user_viewed`), então vale entre sessões e aparelhos. Ao **voltar** ao feed o conjunto é ressincronizado (o cache do feed não recarrega sozinho, e as visualizações foram gravadas uma a uma dentro do viewer).
- O clique marca localmente **apenas o flow que será aberto**, não o grupo inteiro: marcar tudo fazia o toque seguinte concluir que já não havia nada novo e voltar ao 1º flow.
- Anel colorido indica story não visto
- **Ordem do carrossel (2026-08-17):** depois do próprio usuário, vêm primeiro (à esquerda) os autores com flow **pendente de assistir** e, só depois, os que já foram vistos por inteiro (à direita). Dentro de cada bloco a ordem é por **atividade mais recente** — o flow mais novo do autor, não o mais antigo (o representante do grupo é o mais antigo, então ordenar por ele jogava quem acabou de postar para o fim). O critério de "visto" é o mesmo do anel cinza (`viewedByUserId`: todos os flows do autor assistidos), então cor e posição nunca se contradizem. Como o clique marca o flow otimisticamente, o autor migra para o bloco da direita assim que você volta ao feed.
- **Pré-aquecimento no toque (`prefetchFlowMedia`, `client/lib/media-prefetch.ts`):** o `onPointerDown` do ring dispara o download do clipe (`"auto"`) **antes** da navegação. A página `/flows/:storyId` ainda vai buscar os flows no banco antes de montar o player, então esses ~200–500ms passam a ser usados para baixar vídeo em vez de esperar. O helper deduplica por URL, então tocar várias vezes não repete download.

**Botão de criar story:**
- Ícone `+` sobre a foto de perfil do usuário
- Abre `FlowCreationDialog`

**Peso do vídeo postado (o que determina o tempo de carregamento de quem assiste):**

| Etapa | Otimização |
|---|---|
| Gravação no app | **Bitrate por área gravada (2026-08-27)**: `recorderBitrateFor(w, h)` = `w × h × 30 × 0,09`, com piso de 3 Mbps e teto de 6 Mbps, + 128 kbps de áudio. Em 1080x1920 dá ~5,6 Mbps. Antes era um teto FIXO de 2 Mbps (+96 kbps): seguro para o tempo de carregamento, mas em 1080p com movimento — que é todo o conteúdo do app — o H.264 ficava sem orçamento de bits e a imagem virava macrobloco. Como o clipe passou a ser gravado já no enquadramento final (linha abaixo), o arquivo não cresceu na proporção do bitrate. Com 1 min de teto, o pior caso é ~45MB. |
| Gravação no app — enquadramento | **O canvas grava em 9:16, até 1080x1920 (2026-08-27)**, com recorte central da fonte (`centerCrop`), em vez do frame CRU da câmera. Antes, um frame 4:3/16:9 era codificado inteiro e o viewer descartava o excesso no `object-cover`: a maior parte do bitrate ia para área que ninguém via, e a faixa visível ficava com uma fração dos bits. O canvas **nunca amplia** — se o recorte disponível na fonte for menor que 1920 de altura, a saída sai no tamanho do recorte. Dimensões forçadas a pares (exigência do H.264). |
| Upload (`handleCreateStory` no `Index.tsx`) | `contentType` explícito + `cacheControl: "86400"` — o flow vive 24h, então o arquivo fica na borda do CDN durante toda a vida útil e o 2º espectador em diante nem vai à origem. |
| Upload | Capa (JPEG do 1º frame) sobe **em paralelo** com o clipe; falha na capa nunca impede a publicação. |
| Gravação no limite | Ao completar 1 min o clipe é **finalizado e segue para a postagem** — nunca descartado (nem por duração, nem por tamanho) |
| Vídeo da galeria | **Reencodado para 1080p (720p até 2026-08-27)** via `compressVideoBlob` (`client/lib/native-media.ts` → `compressMediaWrite` no `EditedMediaPlugin`), usando `AVAssetExportSession` + `shouldOptimizeForNetworkUse` — a solução nativa que esta linha previa. Antes subia **cru**: com o acervo de órfãos limpo, `stories/` era 879MB em 54 arquivos (~16MB cada), o maior consumidor de Storage do app. Acontece na **seleção**, não no upload, então o preview já é o arquivo que será publicado. Como o transcode processa o clipe inteiro, o timeout de segurança do indicador "preparando" sobe para 180s no caminho de vídeo (foto segue em 25s). Degrada para o original se o codec recusar o preset ou o build for antigo — nunca bloqueia a publicação. **O alvo subiu de 720p para 1080p em 27/08/2026:** o flow é assistido em tela cheia num display de 1080+ de largura, então o player AMPLIAVA o clipe de 720p e o vídeo da galeria chegava mais borrado que na própria fototeca; 1080p ainda corta drasticamente o 4K do sensor, que era o custo real de Storage. O preset cai para 720p sozinho quando o asset não aceita 1080p. |

> **Bug corrigido em 17/08/2026 — vídeo da galeria postava mas não aparecia no flow.** O `Blob` que `compressVideoBlob` devolve vem de um `fetch()` do arquivo reencodado servido pelo scheme customizado do Capacitor (`fetch(webPath).then(r => r.blob())`); o `.type` desse blob nem sempre chega como `"video/mp4"` no WKWebView — às vezes vem vazio. `flow-creation-dialog.tsx` usava esse blob direto para montar o preview/upload, sem reembalar. `handleCreateStory` (`Index.tsx`) deriva o `Content-Type`/extensão do upload só de `blob.type` (`mimeType = blob.type || "image/jpeg"` — fallback pensado para post sem foto), então um `.type` vazio virava `image/jpeg`: o flow publicava normalmente (o preview no dialog tocava porque o WebKit sniffa o conteúdo de um `<video src="blob:...">`, sem depender do MIME), mas subia com extensão de imagem — e o `isVideo` do `FlowViewer`/`FlowViewerModal` (que olha `.mp4`/`.webm`/`.mov` na URL) não reconhecia o vídeo, então nada aparecia. Corrigido reembalando o blob comprimido num `File` com `type: compressed.type || "video/mp4"` explícito antes de virar preview — mesmo padrão já usado em `NewPost.tsx` (`handleVideoFileChange` e o caminho `getCompressedVideoUrl` do shot), que nunca teve esse sintoma por já fazer essa reembalagem. Vídeo **gravado no app** (via `MediaRecorder`) nunca foi afetado — o `Blob` dele já sai com `.type` correto.

**FlowCreationDialog:**
- Upload de imagem para o story: vai direto para a etapa de compartilhar (sem tela de crop intermediária) — o enquadramento é feito ali mesmo, via pinça/arraste, para não duplicar a mesma ação em duas telas
- Captura pela câmera com **obturador inteligente**: **toque rápido = foto**, **segurar (>400ms) = grava vídeo** (estilo Instagram/Snapchat). Solta o obturador para finalizar o vídeo
  - **Travar gravação (mãos livres):** durante a gravação, **arrastar o obturador para cima** (> `LOCK_DRAG_THRESHOLD` = 70px, medido de `shutterStartYRef`) **trava** a gravação — o usuário solta o dedo e a gravação continua sozinha (o botão passa a exibir um cadeado `Lock`). Para encerrar, **toca no obturador de novo** (`recordLockedRef` + guard `ignoreNextShutterUpRef` para o toque de parada não virar "foto"). A dica no rodapé reflete o estado (segurar → "arraste para cima 🔒 para gravar sem segurar" → "toque para parar").
  - Gravação usa `MediaRecorder` com áudio do microfone (permissão lazy; se negada, grava sem som)
  - Limites de vídeo (constantes no topo do arquivo): **duração de até 1 min** (`MAX_RECORD_MS` = 60000 na gravação; `MAX_VIDEO_DURATION_S` = 60 para vídeos da galeria) e **tamanho de até 100MB** (`MAX_MEDIA_BYTES`) — vídeos editados/da galeria costumam ser mais pesados
  - **Ao completar 1 min a gravação é FINALIZADA, não descartada:** o timer de `MAX_RECORD_MS` chama o mesmo `stopRecording()` de quando o usuário solta o dedo, então o vídeo segue direto para a etapa de postagem (com um haptic confirmando). Se o dedo ainda estiver no obturador, `ignoreNextShutterUpRef` é ligado para o `pointerup` seguinte **não** cair no ramo "toque = foto" — que substituiria o vídeo recém-gravado por uma imagem. O flag é zerado em todo `pointerdown`, para não engolir um toque legítimo depois.
  - **Gravação nunca é perdida por tamanho:** antes, um blob acima de `MAX_MEDIA_BYTES` era descartado com um toast — o usuário perdia o minuto inteiro que acabara de gravar. Agora o vídeo segue mesmo assim e o toast só avisa que o envio pode demorar (`flow_video_heavy`). Com o bitrate por área + 1 min o pior caso é ~45MB (um flow típico, de poucos segundos, fica na casa dos MB), então o caso segue inalcançável. Arquivos **da galeria** continuam com rejeição dura (lá nada se perde — o original segue no rolo da câmera).
  - **Qualidade da gravação (27/08/2026):** três mudanças no mesmo caminho, todas no canvas que alimenta o `MediaRecorder`. (1) **Enquadramento** — o canvas passou a ser 9:16 (até 1080x1920) com recorte central da fonte, em vez de copiar o frame cru da câmera; como o viewer sempre corta para 9:16 no `object-cover`, os pixels fora desse recorte eram bitrate jogado fora e a faixa visível saía com uma fração dos bits. É o ganho isolado maior de nitidez. (2) **Bitrate proporcional à área** (`recorderBitrateFor`, ~5,6 Mbps em 1080x1920) no lugar do teto fixo de 2 Mbps, que era o que produzia o macrobloco em cena com movimento. (3) **Taxa de redesenho limitada a 2× `RECORD_FPS`** — o `requestAnimationFrame` acompanha o refresh da tela (120Hz no ProMotion) enquanto o `captureStream` amostra a 30fps, então o app redesenhava o frame até 4× para cada frame aproveitado, roubando CPU/GPU do encoder e da própria pré-visualização (o travamento durante a gravação). O teto é o **dobro** da taxa de captura, não o mesmo valor: desenhando na cadência exata do `captureStream`, as duas entram em batimento de fase e uma amostragem aqui e ali pega frame repetido. O `getUserMedia` também passou a pedir **retrato** (1080x1920, `aspectRatio` 9:16, 30fps) — pedir 1920x1080 num aparelho em pé fazia o WebKit escolher o modo de sensor mais próximo de 1920 **de largura**, podendo entregar um modo bem maior que o necessário (canvas gigante para redesenhar a cada frame) ou um 4:3 do qual o flow só aproveita uma faixa.
  - **Ring de tempo no obturador:** durante a gravação, um anel SVG em volta do botão (`RING_RADIUS`/`RING_CIRCUMFERENCE`, animado por `strokeDashoffset` com framer-motion, `linear` por `MAX_RECORD_MS`) **esvazia** conforme o tempo passa, mostrando quanto ainda dá para gravar. Substitui o antigo anel vermelho pulsante (que não informava nada); o contador `M:SS` continua acima e o quadrado vermelho interno mantém o pulso de "gravando"
  - **Trocar de câmera SEM parar a gravação (corrigido em 18/08/2026):** o `MediaRecorder` sempre grava a partir de um `<canvas>` que redesenha o `<video>` a cada frame (`requestAnimationFrame`), nunca a track bruta da câmera direto — antes isso só acontecia na frontal (só para espelhar o efeito selfie); a traseira gravava a track crua. Como trocar de câmera (`handleFlipCamera` → `facingMode`) reabre `getUserMedia` e **para** as tracks do stream antigo (efeito que reage a `facingMode`, `Trocar câmera` no header), gravar a track bruta direto fazia a gravação **morrer no meio** assim que o usuário trocava de lado — o `MediaRecorder` perdia a fonte de vídeo. Com o canvas sempre no meio, a troca de câmera só troca o `srcObject` por baixo do capô: o canvas continua desenhando o que o `<video>` mostrar a cada frame (a pior consequência é um frame parado por ~100–300ms durante a troca de sensor), sem nunca soltar a track que o gravador de fato usa. O espelhamento (só na frontal) passou a ser decidido **a cada frame** via `facingModeRef` (não mais capturado uma vez no início do clipe), então um clipe que começa na frontal e troca pra traseira no meio para de espelhar exatamente na hora da troca.
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
- **Salvar rascunho na galeria do celular:** abaixo do botão "Compartilhar flow" (nas duas etapas de compartilhar — mídia e modo texto) há **"Salvar rascunho"**, que grava o flow **como ele está na tela** no rolo da câmera, **sem publicar**. Serve para quando o usuário gosta da foto que acabou de tirar e quer guardá-la.
  - **Composição (`buildDraftCanvas`)**: o rascunho é montado num canvas para sair idêntico ao preview — a mídia já enquadrada (`bakeTransformedCanvas`, com o mesmo `cover`/`contain` do bake de publicação) **ou** o gradiente do modo texto (`paintCssGradient`, que interpreta os `GRADIENT_PRESETS`), e por cima as frases desenhadas por `drawTextsOnCanvas` na mesma posição, fonte, cor, alinhamento, realce de fundo (`box-decoration-break` reproduzido como uma caixa arredondada por linha) e sombra. Diferente da publicação, aqui as frases são **queimadas na imagem** — o arquivo da galeria não tem uma camada de texto para renderizar ao vivo. O **mini frame de treino**, quando existe, também é desenhado no canvas (`drawWorkoutStickerOnCanvas`, que espelha o layout do `FlowWorkoutSticker` em px de CSS — sem os ícones dos chips, que não existem no canvas). Sai em JPEG (lado maior 1280px, qualidade 0.92).
  - **Vídeo:** não pode ser recomposto no cliente, então o arquivo é salvo **como está, sem as frases sobrepostas** — o toast de sucesso avisa isso explicitamente.
  - **Escrita na galeria (`saveMediaToPhotos` em `client/lib/native-media.ts`)**: no iOS vai pela ponte nativa `EditedMedia` (`ios/App/App/EditedMediaPlugin.swift`), que ganhou uma API de escrita **fatiada** — `startMediaWrite` → `appendMediaWrite`* → `saveMediaWrite` (ou `cancelMediaWrite`). Os pedaços são de **3MB (múltiplo de 3, para o base64 não ganhar padding no meio do arquivo)**: um vídeo de flow pode ter 100MB e atravessar a ponte de uma vez viraria uma string base64 de ~133MB, estourando a memória do WKWebView. O nativo grava num arquivo de staging em `Caches/LinkaMediaSave` e depois usa `PHAssetCreationRequest` com `shouldMoveFile`. A permissão pedida é `.addOnly` (só escrita → `NSPhotoLibraryAddUsageDescription`, já declarada no `Info.plist`). No navegador (dev) o fallback é um download comum.
  - **Erros tratados com mensagem própria** (`SaveMediaError.reason`): `permission` (usuário negou o acesso às Fotos), `unsupported` (build instalado é anterior ao plugin → "Atualize o app") e `unknown`. Chaves `flow_save_draft*` / `flow_draft_*` no `i18n.ts`.
  - **Bug histórico (corrigido em 12/08/2026):** o botão acusava `unsupported` ("Atualize o app") **em qualquer build**, porque o `Main.storyboard` instanciava o `CAPBridgeViewController` do Capacitor em vez da nossa subclasse `App.ViewController` — sem ela, o `capacitorDidLoad()` que registra o plugin `EditedMedia` nunca rodava e `startMediaWrite` voltava `UNIMPLEMENTED`. Ver `docs/04-novo-post.md` (seção do plugin) para o registro completo, que tem **duas** metades.
- **Marcação de pessoas (estilo Instagram)**: na etapa de compartilhar, o botão **@** (ao lado do "+ Aa") abre o `TagPeopleDrawer` (o mesmo do feed) para marcar quem quiser; os marcados aparecem numa linha de avatares acima da descrição. Os ids são passados no 7º parâmetro de `onCreateStory` → `createStoryDb` → tabela `flow_tags`, e a trigger gera notificação **type 16** ("marcou você em um flow") + push para cada marcado. No viewer (`FlowViewer`/`FlowViewerModal`), os marcados viram chips tocáveis (abrem o perfil) acima da doca; e quem foi marcado ganha um botão **"Repostar no meu flow"** (`repostStoryDb`) que cria um flow próprio reaproveitando a mídia do original — igual ao "adicionar ao seu flow" do Instagram. **Pendências no Supabase:** rodar `docs/migrations/20260729-flow-tags.sql` e redeploy da edge function `send-push-notification`.
- **Citar um treino no flow (mini frame, estilo "repost" — 2026-08-21):** na etapa de compartilhar (tanto sobre a mídia quanto no modo texto), o botão **halter** (`Dumbbell`, ao lado do **@** e do "+ Aa") abre o `WorkoutStickerPickerDrawer` (`client/components/modals/workout-sticker-picker-drawer.tsx`), que lista os **treinos recentes já finalizados** do usuário. Tocar em um deles cola sobre o flow um **mini frame** com o treino inteiro — rotina, dia, séries, volume, duração, calorias, recordes e a lista de exercícios com `séries × carga` — para o usuário mostrar aos seguidores o treino que acabou de fazer.
  - **De onde vêm os treinos:** `getRecentWorkoutSessionsDb` (em `ritmofit-db.ts`) lê o snapshot que cada rotina guarda do seu último "Finalizar" (`routines.last_summary`, ver `docs/05-metas.md`) e devolve as sessões mais recentes primeiro. Ou seja, é sempre **a última execução de cada rotina de treino** — não o histórico série a série de `user_workouts_hist`. **Sem query nova e sem migração**: aproveita `getUserRoutinesDb`, que já tem cópia offline. Quem nunca finalizou um treino vê o estado vazio (`flow_workout_empty`) apontando para as Metas.
  - **Seleção WYSIWYG:** cada linha do drawer já é o **próprio mini frame** renderizado (`FlowWorkoutSticker`), então o usuário escolhe vendo exatamente o que vai colar no flow.
  - **Manipulação:** o mini frame nasce um pouco abaixo do centro e é **arrastável (1 dedo)** e **redimensionável (pinça, 0,6×–1,8×)**, com um **X** no canto para removê-lo. Diferente das frases, ele trata os **próprios ponteiros** (fica acima da camada de gestos da mídia, com `stopPropagation`), então arrastá-lo nunca reenquadra a foto nem abre uma frase nova. É **um por flow**.
  - **Como é salvo:** entra na **mesma** coluna `flow.text_elements` das frases, como um elemento `{ kind: "workout", x, y, scale, workout: {...} }` (x/y em % da viewport) — **sem migração**, pois é jsonb. O conteúdo é um snapshot enxuto (`StoryWorkoutSticker`: nome, data, séries, volume, duração, **calorias** (`caloriesKcal`, desde 21/08/2026), recordes e até 8 exercícios + `extraCount`), então o flow continua correto mesmo que a rotina seja editada ou apagada depois. Como qualquer elemento, é **renderizado ao vivo** nos viewers (nunca queimado na mídia) e sobrevive ao repost do arquivo de flows.
  - **No modo texto (gradiente)** o mini frame sozinho já habilita o "Compartilhar flow" (não é mais obrigatório escrever uma frase); a descrição do flow vira o nome da rotina.
- Botão confirmar publicação

**FlowViewerModal / tela `/flows/:storyId` (`FlowViewer.tsx`):**
- Visualização em tela cheia do story
- Progresso automático entre stories — barras com leve glow no estado ativo/concluído
  - **Flows de imagem/texto:** duração fixa de 8s por story (timer interno).
  - **Barra só avança com a mídia carregada (`mediaReady`):** ao trocar de story, a barra fica parada (e um spinner `Loader2` cobre a área) até a mídia sinalizar que carregou — `onLoad` da `<img>` ou `onLoadedData` do `<video>` chamam `markMediaReady`. Antes a barra rolava por cima de uma imagem/vídeo ainda carregando (mídia de outros usuários demora na rede). O timer de imagem só decrementa quando `mediaReadyRef` é true; vídeo já era naturalmente sincronizado (progresso vem de `currentTime`). Texto puro (sem `media_url`) fica pronto na hora. Rede de segurança de 12s libera mesmo assim se a mídia não sinalizar (erro silencioso/rede ruim), e `onError` também destrava (imagem) ou pula (vídeo). Vale para o `FlowViewer.tsx` e o `FlowViewerModal`.
  - **Flows de vídeo:** a barra de progresso é sincronizada com a duração real do vídeo (eventos `timeupdate`/`ended` do elemento `<video>`) — preenche conforme o vídeo toca e avança automaticamente quando ele termina, em vez de usar o tempo fixo de 8s. Enquanto o usuário digita um comentário ou o flow está pausado, o vídeo também pausa (a barra congela). Vale para o `FlowViewerModal` e a tela `/flows/:storyId` (`FlowViewer.tsx`).
  - **A duração vem do banco (`flow.duration_ms`), não do arquivo:** o MediaRecorder do iOS grava **MP4 fragmentado**, cujo cabeçalho não traz a duração — `video.duration` fica `Infinity` até o arquivo **inteiro** baixar. Era a causa de "o 1º vídeo a barra acompanha, no 2º não": o 1º dava tempo de baixar enquanto era assistido, e ao pular para o próximo o clipe ainda estava baixando, então a barra ficava parada em 0 (e, quando a duração enfim resolvia, o seek-trick reiniciava o vídeo do zero). Agora a duração é medida **no cliente ao postar** (`probeFlowVideo`, arquivo ainda local = instantâneo) e guardada no banco; o viewer usa `duration_ms` desde o 1º frame e **não** roda o seek-trick. Ordem de confiança: `duration_ms` → `video.duration` (só depois de resolvida). `onDurationChange` aproveita quando o WebKit descobre sozinho.
  - **Fallback para flows antigos:** sem `duration_ms` (postados antes da migração), continua valendo o *seek-trick* (`currentTime = 1e101` → ao voltar finito, reseta para 0 e retoma), que é caro porque força o download completo. Como flows expiram em 24h, esse caminho some sozinho. Vídeos da galeria (metadata correta) nunca caem nele.
  - **Identidade por elemento no AnimatePresence (bug "só o 1º flow anda"):** durante a transição o `<video>` que **sai** continua montado e tocando, compartilhando ref e handlers com o que **entra**. Cada `<video>` carrega agora `data-story-id` (a qual flow pertence) e `data-duration-ready` (o seek-trick já resolveu a duração), e `timeupdate`/`ended`/`error`/`loadeddata`/`ref` só são aceitos quando o `data-story-id` bate com o flow atual (`currentStoryIdRef`, atualizado **no render** — os eventos de mídia chegam antes dos efeitos). O "duração pronta" **não pode** morar num ref do componente: com mais de um vídeo, o reset na troca de flow apagava a marca que o vídeo novo já tinha sinalizado no `loadedmetadata` (que dispara uma única vez por elemento) e a barra travava em 0 para sempre. Ao trocar de flow, os `video[data-flow-video]` de outros flows são pausados (sem áudio duplo nem evento do vídeo antigo).
  - **Pré-carregamento do próximo flow:** depois que a mídia atual aparece (`mediaReady`), o próximo flow é aquecido via `prefetchFlowMedia(next, "metadata")` — capa inteira + cabeçalho do vídeo, sem disputar banda com o clipe que está tocando nem baixar arquivos inteiros à toa. Vale para os **dois** viewers (o modal não tinha isso).
  - **Capa do vídeo (`flow.poster_url`):** ao postar, o app extrai o 1º frame em JPEG (`client/lib/video-poster.ts`, ~720px) e sobe junto com o clipe; o viewer usa como `poster` do `<video>`, então **o frame aparece no instante em que o flow abre** em vez de tela preta. Com capa, o overlay de carregamento não escurece a tela (só um spinner discreto). Requer a migração `20260812-flow-poster.sql` — sem ela o campo volta `null` e o comportamento é o antigo.
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
- **Frases sobre a mídia:** quando o flow tem `media_url` **e** `text_elements`, as frases posicionadas são renderizadas ao vivo por cima da foto/vídeo (posição em %, com `style` de cor/fonte/alinhamento) — antes só apareciam em flows de texto puro (`background_color`). Desde 2026-08-21 os dois viewers renderizam cada elemento pelo componente compartilhado **`FlowElementView`** (`client/components/shared/flow-workout-sticker.tsx`), que decide entre **frase** e **mini frame de treino** (`kind: "workout"`) — antes o mesmo JSX estava duplicado em 4 lugares e o modo texto do `FlowViewerModal` ignorava o `style` das frases.
- **Controles do rodapé — "doca de vidro" (Direção B do design):** reações e campo de resposta ficam reunidos num único bloco de vidro (glass) translúcido no rodapé, por cima da imagem. A linha de 6 reações fica acima do campo; a reação selecionada "acende" (fundo tonalizado na cor da reação + ícone preenchido). Abaixo, um campo de resposta com botão de envio em gradiente azul→roxo. A legenda do flow e os balões de comentário ciclados aparecem logo acima da doca.
- **Responder em privado (2026-08-17):** ao lado do botão de envio (avião, gradiente = **comentário público**, comportamento antigo) existe um segundo botão circular de vidro com ícone `MessageCircle` que envia o **mesmo texto digitado** como **mensagem direta para o autor do flow**, sem virar balão público. Só aparece no flow **de outra pessoa** (`!isOwner` — não há para quem mandar no próprio). Vale nos **dois viewers**: a tela `/flows/:storyId` e o `FlowViewerModal` do perfil, que compartilham o hook `useFlowPrivateReply` (`client/hooks/use-flow-private-reply.ts`) em vez de duplicar a lógica. Regras:
  - A mensagem é gravada por `sendMessageDb` com o payload `[flowreply]:<flowId>|<texto>` (`client/lib/flow-reply.ts`), então a conversa consegue mostrar a **miniatura do flow respondido** junto do texto — ver `docs/07-comunidade.md`. **Sem tabela/coluna nova e sem migração**: é o mesmo protocolo de prefixo de `[audio]:`/`[image]:`/`[post]:`/`[shot]:`.
  - O push chega como **"{nome} respondeu ao seu flow"** (notificação **tipo 17**, ver `docs/10-notificacoes.md`), e não como o genérico "te enviou uma mensagem" do tipo 10. O 17 é irmão do 10: mesma mecânica, mesmo destino no toque (`/comunidade?user=<remetente>`) e igualmente **push-only** (nunca vira card na lista do sino). **Exige redeploy da edge function `send-push-notification`** — sem ele o push cai no texto padrão "Você tem uma nova notificação no LinKa", e nada mais quebra.
  - Como os dois botões agem sobre o **mesmo campo**, uma linha de dica (`flow_reply_hint`) aparece sob a doca **assim que há texto digitado** — o momento em que o usuário precisa escolher o destino. Some quando o campo esvazia.
  - Teto de **900 caracteres** (`MAX_PRIVATE_REPLY_CHARS`): `sendMessageDb` rejeita acima de 1000 e o payload ainda carrega prefixo + id. Passar do teto avisa com toast em vez de estourar num erro genérico de validação.
  - Falha de rede cai em `reportHandledError("flow-viewer:private-reply")` + toast — `catch` com toast sozinho não chega ao Sentry.
  - Em **primeiro plano** o aviso é o pop up de mensagem (`IncomingMessageToast`, alimentado pelo realtime de `messages`, com preview `🎞️ <texto>`); o handler de `notifications` no `AppLayout` ignora o tipo 17 pelo mesmo motivo que já ignorava o 10 — senão a mesma resposta avisaria duas vezes.
- **Denunciar (2026-08-17):** no flow de outra pessoa (`!isOwner`), um botão `MoreVertical` no header (onde o dono tem o `Trash2`) abre um menu com **"Denunciar usuário"** e **"Denunciar flow"** — ambos abrem o `ReportDrawer` compartilhado (`client/components/shared/report-drawer.tsx`, ver `docs/13-layouts-e-componentes.md`) já usado por Feed/Shots. "Denunciar flow" grava em `flow_complaint` (`reportFlowDb`); "Denunciar usuário" reusa `reportUserDb`/`user_complaint`, o mesmo caminho de qualquer outra tela. Vale nos **dois viewers** (`FlowViewer.tsx` e o `FlowViewerModal` do perfil), cada um com sua própria cópia do menu — são as mesmas docas duplicadas do botão de resposta privada (ver acima).
  - **O backend já existia antes desta entrega** — só faltava o botão. `AdminComplaint["tipo"]` já aceitava `"flow"`/`"usuario"`, `admin_complaints_view` já unia as duas tabelas, e `admin_delete_content` já tinha o caso especial de flow (solta `reposted_from` dos reposts antes de apagar o original — ver `docs/18-admin.md`). Denúncias de flow feitas antes de 2026-08-17 só podiam ter entrado na tabela via SQL direto; a partir de agora entram pelo app.
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
| **Botão "Comparar com o meu treino"** | **Dentro** do drawer "Ver treino", acima da lista de exercícios, **só em posts de outra pessoa**. Troca o conteúdo do sheet pela **comparação**: cada exercício do post confrontado com a **minha última execução do mesmo exercício** (kg × reps / min × km), com placar e indicador de quem fez mais. O `‹` do cabeçalho volta para a lista. Ver "Comparar treino" abaixo |
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
| `WorkoutCompareContent` | View de confronto exercício a exercício, renderizada **dentro** do drawer do `WorkoutDetailButton` (só em posts de resumo de **outra** pessoa) |
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

## Segurança e moderação (2026-09-02 — Guideline 1.2)

A Apple exige **quatro** mecanismos em todo app com conteúdo de usuário. Os
pontos que vivem nesta tela e nas que saem dela:

| Superfície | Denunciar | Bloquear | Onde |
|---|---|---|---|
| Post do feed | conteúdo + autor | ✅ | `post-card.tsx` → menu "…" |
| **Comentário** | autor | ✅ | `post-comments-dialog.tsx` → "…" por comentário (novo) |
| Detalhe do post | conteúdo + autor | ✅ | ver `docs/09-post-detalhe.md` |
| Viewer de flow (rota e modal) | conteúdo + autor | ✅ | item "Bloquear" acrescentado em 02/09 |
| Perfil de outro usuário | autor | ✅ | ver `docs/08-perfil.md` |
| Conversa privada | autor | ✅ | ver `docs/07-comunidade.md` |

Nos comentários, **bloquear recarrega a lista** — os comentários do bloqueado
somem pelo filtro de `user_blocks` que já existia no servidor
(`ritmofit-db.ts:956`). Denunciar o **comentário em si** não existe: exigiria
tabela `comment_complaint`, migração e fila nova no Admin. Denunciar o autor
cobre a exigência.

### Filtro de conteúdo na publicação

`client/lib/content-filter.ts` — `hasObjectionableContent()` roda **antes de
gravar** em todos os pontos onde se publica texto: legenda do post
(`NewPost.tsx`, imagem e vídeo), comentário e mensagem direta. Bloqueia insulto
pesado, termo de ódio, sexual explícito e ameaça direta, em PT e EN.

O texto é **normalizado** antes da comparação — sem acento, sem leet-speak
(`p0rr@`), sem repetição (`PÔRRRA`) — e comparado **por palavra inteira**, não
por substring: sem isso, "cuidado" casaria com um termo de três letras. Os
termos da lista passam pela mesma normalização, e é por isso que a colapsagem de
letras repetidas funciona dos dois lados.

> Isto é o item **(a)** da Guideline 1.2, que pede filtrar material censurável
> *"from being posted"*. Denúncia é reativa — o conteúdo fica visível até alguém
> agir. Caso ambíguo continua indo para a fila de denúncias, que é o mecanismo
> desenhado para julgamento humano.

## Observações Técnicas

- **`PostCard` é memoizado (2026-08-11):** exportado como `React.memo(PostCardImpl, arePropsEqual)`. A tela tem 46 peças de estado próprias — sem `memo`, abrir qualquer drawer reconstruía a lista inteira, com as imagens, o carrossel e o `backdrop-filter` de cada card. O comparador é **explícito** por causa de uma prop: `togglingIncentives` é um `Set` recriado a cada curtida em qualquer lugar do feed, e comparado por referência (o padrão do `memo`) anularia a memoização toda vez — curtir um post re-renderizaria os outros quarenta. O comparador olha só as chaves `${post.id}-${tipo}` **deste** post.
  - Depende de `sharedCardProps` estar em `useMemo` e dos oito handlers em `useCallback` — **se algum deles voltar a ser recriado por render, a memoização morre em silêncio**. Por isso `handleOpenLikesModal` guarda a trava de reentrada numa **ref** (`likesLoadingRef`) em vez de depender do estado `likesLoading`.
- **Virtualização via `LazyMount` (2026-08-11):** cada `PostCard` (Seguindo e Descobrir) é envolvido por `LazyMount` (ver `docs/13-layouts-e-componentes.md`). O feed é scroll infinito e chegava a 60+ cards montados ao mesmo tempo; agora só o que está a ~1,5 tela de distância fica no DOM, o resto vira espaçador com a altura medida. Não confunda com o `memo`: um evita re-render de React, o outro evita nós, decodificação de imagem, layout e pintura.
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
  - **Overlays somem durante o zoom (2026-08-13):** enquanto a pinça está ativa no feed, o `PostCard` oculta os elementos de texto sobrepostos à foto — a **pill de identidade** (avatar/nome/tempo/badge da meta), a linha de **pessoas marcadas**, a **descrição** e o pill **"Ver treino"** — para que a imagem ampliada não fique coberta. O `ZoomableImage` avisa via a prop opcional `onZoomChange(zooming)` (dispara no 1º toque de dois dedos e ao soltar), o `PostCarousel` só repassa, e o `PostCard` guarda em `isZooming` e aplica `zoomHiddenStyle` (`opacity: 0` + `pointer-events: none`, transição de 180ms). Some por **opacidade, não desmontando** — o layout não pode pular no meio do gesto. A barra de incentivos, os dots e o menu `⋮` continuam visíveis (não cobrem a área útil da foto). O callback é opcional, então as demais telas que usam o `PostCarousel` (PostDetail, Perfil, Comunidade) seguem inalteradas. O `ZoomableImage` também trata `touchcancel` (o iOS cancela toques ao abrir gesto do sistema/drawer) e avisa `false` ao desmontar — sem isso a pinça ficaria "presa" e os overlays sumiriam para sempre
- **Indicador de carrossel (dots) no feed:** No `PostCard` o indicador de fotos é renderizado **logo acima do frame de botões de incentivo** (não mais no topo-centro, onde ficava escondido atrás da pill de identidade). O `PostCarousel` expõe `onIndexChange` (reporta a foto atual) e `hideDots` (oculta os dots internos); o `PostCard` usa ambos para posicionar o indicador no container inferior. O contador em pill (`N/total`) do topo-direito é ocultado no feed via prop `hideCounter`, pois ficava atrás do botão de opções (`...`) e era impossível de ver. Demais telas (Perfil, Comunidade, PostDetail) seguem com os dots internos no topo-centro e o contador em pill visível (sem sobreposição com outros elementos)
- **Posts grandes ("1 post por vez"):** No feed, o frame de imagem do post (via prop `tall` do `PostCarousel`) usa altura calculada via CSS `calc()` que desconta exatamente o espaço de todos os elementos fixos (header, stories, tabs, bottom nav e safe areas), garantindo que o frame completo — do topo até a barra de incentivos — caiba na viewport sem scroll, em qualquer tamanho de tela. A fórmula é `calc(100dvh - max(14px, env(safe-area-inset-top) + 6px) - 314px - env(safe-area-inset-bottom))`, com `maxHeight: 500px`. O post sem foto (gradiente de fundo) e o skeleton de loading usam a mesma altura para evitar layout shift ao carregar
- **Fit adaptativo da foto (`adaptiveFit`, interno ao `ZoomableImage` em `post-carousel.tsx`):** quando o frame é `tall`, a foto é exibida com `object-cover` (preenche 100%, cortando o excedente) **somente se** sua proporção natural for próxima da proporção do frame. Quando a foto destoa muito (ex.: canvas quadrado de resumo de treino — 540×540 — gerado por `workout-summary-overlay.tsx` e compartilhado como post), o componente troca para `object-contain` (mostra a foto inteira, sem cortar nenhuma informação) e preenche o espaço ao redor com uma cópia desfocada (`blur` + `scale`) da própria foto, evitando barras vazias sólidas. A decisão é tomada em tempo de execução (`onLoad` da imagem, comparando `naturalWidth/naturalHeight` com as dimensões do frame) — não depende de metadado algum no post
- **Detalhe do treino (`WorkoutDetailButton` em `client/components/shared/workout-detail-dialog.tsx`):** posts de **resumo de treino** compartilhados via `WorkoutSummaryOverlay` agora persistem um snapshot estruturado em `posts.workout_summary` (coluna `jsonb`, ver `docs/14`) — antes o resumo era só "queimado" na imagem de canvas + legenda, perdendo os dados. Quando um post carrega esse `workout_summary` (tipo `PostWorkoutSummary` em `client/lib/workout-summary-types.ts`), o `PostCard` renderiza o pill **"Ver treino"** no overlay inferior; ao tocar, abre um **drawer glass simplificado** (padrão §9.4) com **apenas a lista de exercícios**: cada linha tem a **miniatura do exercício** (`ExerciseImage`, com fallback de gradiente/emoji por grupo muscular quando não há foto), o **nome + grupo muscular** e as **séries em chips `{kg}kg × {reps}`**. Sem stats/banners extras — é intencionalmente enxuto (o overlay completo com stats/PR/máquina continua sendo o `WorkoutSummaryOverlay` na tela de Metas). **Única exceção (21/08/2026):** um chip `🔥 {n} kcal` no cabeçalho quando o snapshot traz `caloriesKcal` (ver `docs/05-metas.md` → "Calorias gastas") — duração/séries/volume continuam fora, já que estão no card gerado do próprio post. Optou-se por um pill dedicado (em vez de tornar a imagem inteira clicável) para não conflitar com o duplo-toque de incentivo, o pinch-zoom e o swipe de carrossel já existentes na imagem. As repetições por série vêm de `completedExercises[].sets` e a foto de `completedExercises[].photo` (`workoutPhoto`), capturados no `WorkoutSessionDialog` ao finalizar o treino — **posts antigos** (sem `workout_summary`) simplesmente não mostram o pill (degradação graciosa). O mesmo pill/drawer aparece no **Perfil** (viewer de post) e no **PostDetail**.
  - **Cardio mostra min×km, não kg×reps (2026-08-05):** exercícios de cardio (corrida, bike) codificam a série como **kg = MINUTOS** e **reps = KM** (mesmo contrato do `WorkoutSessionDialog`). O drawer trazia isso como "15kg × 3", errado. Cada exercício do resumo agora carrega um flag **`isCardio`** decidido na origem via `isCardioExercise(muscleGroup, workoutId)` (que já embute a exceção do **cardio estacionário** — polichinelo/burpee etc. seguem kg×reps). O flag flui `WorkoutSessionSummary → WorkoutSummaryData → buildPostWorkoutSummary → posts.workout_summary`, e o `formatSet` do `WorkoutDetailButton` renderiza "{min}min × {km}km" quando `isCardio`. **Snapshots anteriores a 05/08/2026** não têm o flag (não dá para inferir cardio sem o `workoutId`) → continuam em kg×reps (degradação graciosa); só posts novos saem corretos.
- **Comparar treino (`WorkoutCompareContent` em `client/components/shared/workout-compare-dialog.tsx`, 26/08/2026):** **dentro** do drawer "Ver treino", posts de resumo de **outra pessoa** ganham o botão **"Comparar com o meu treino"** logo acima da lista de exercícios — é ali, olhando o que a outra pessoa fez, que a vontade de comparar aparece. Tocar troca o conteúdo do **mesmo sheet** pelo **confronto exercício a exercício** entre o treino publicado e a **última vez que eu registrei cada um daqueles exercícios**; o ícone do cabeçalho vira um `‹` que volta para a lista, e fechar o drawer sempre reseta para a lista.
  - **Uma view, não dois drawers (decisão):** empilhar um segundo `Drawer` do vaul por cima do primeiro era a alternativa óbvia, mas dois sheets sobrepostos disputam o scroll-lock do `body` no iOS e deixariam duas alças de arrastar na tela. Trocar a `view` dentro do mesmo `DrawerContent` mantém um scroll, uma alça e um caminho de volta explícito. O `WorkoutDetailButton` passou a receber `authorId`/`authorNickname`/`authorPhoto`; sem eles (ou quando o autor sou eu) o drawer continua sendo só a lista de exercícios, como antes.
  - **A comparação é sempre do MESMO exercício.** O casamento acontece por **`workout_id` do catálogo `workouts`** — supino reto só compara com supino reto, nunca com leg press. Cada exercício do resumo passou a gravar o campo **`workoutId`** no `posts.workout_summary` (ver `docs/14`); para posts publicados **antes de 26/08/2026** (que não têm o campo) há um fallback por **nome normalizado** (minúsculas, sem acento) contra o índice `getWorkoutNameIdIndexDb`, que indexa `name` **e** `name_eng` — então o casamento funciona mesmo entre duas pessoas usando o app em idiomas diferentes. Exercício que não resolve para um id é **descartado** da comparação: comparar por aproximação é justamente o que a feature não pode fazer.
  - **Meu lado = minha última execução** daquele exercício (`getLastExerciseSessionsDb`), não um recorde histórico. Usa a mesma definição de "sessão" do pré-preenchimento da coluna ANTERIOR (janela de 2s sobre `user_workouts_hist`, ver `groupLastSessionByWorkout`) e só **séries de trabalho** — comparar o aquecimento de um contra a série pesada do outro daria uma derrota falsa. A data da minha sessão aparece em letra miúda no card ("Seu último: há 3 dias").
  - **Quem venceu:** força → maior **carga** manda, empate desempata por **volume** e depois por **repetições**; cardio → **distância** manda, tempo desempata. Comparar por carga primeiro é proposital (é a conversa da academia: "quanto você pega no supino?"). O chip `+10kg` só aparece quando a **carga/distância** decidiu; num desempate por volume o chip vira só "venceu", para não exibir um número enganoso. Toda a regra vive em `client/lib/workout-compare.ts` (módulo **puro**, sem rede nem React).
  - **Layout:** cabeçalho com placar (`avatar do autor` **3 × 2** `meu avatar`) e, por exercício, um card com miniatura + nome + chip de veredito e **duas colunas** — a dele e a minha —, cada uma com a **melhor série** em destaque (`80kg × 8`) e uma linha menor com `séries · volume`. A coluna vencedora ganha fundo/borda verde. Cardio troca o par por `km` em destaque e tempo embaixo.
  - **Exercício que eu nunca fiz** não vira derrota: cai numa seção separada **"Sem comparação"**, com a coluna dele preenchida e a minha em placeholder tracejado ("Você ainda não fez"). Não entra no placar.
  - **Custo:** o drawer só é **montado no primeiro toque** (um feed com 20 posts não pode pagar leitura de banco antecipada) e faz **uma** leitura por abertura, mantida enquanto o drawer viver. O índice de nomes do catálogo (agora cacheado por 12h) só é baixado quando o post tem algum exercício **sem** `workoutId`. O pill some no meu próprio post (comparar comigo mesmo) e para quem não tem sessão.
  - **Elevação da esteira (2026-08-17):** na esteira, a inclinação é uma **coluna da série** (ao lado de MIN e KM — ver `docs/05-metas.md`), então viaja em `sets[].elev` e o `formatSet` a acrescenta ao **próprio chip**: `15min × 3km · ⛰ 6%`. É opcional e só vem nas séries em que foi preenchida — séries sem ela, exercícios que não são esteira e todos os snapshots anteriores continuam com o chip de sempre.
- **Rotinas vinculadas escopadas ao dono do post (2026-07-17):** o drawer de progresso da meta lista apenas as rotinas do **autor do post** (`getRoutinesByGoalIdDb(goal_id, post.user_id)`). Antes, a query filtrava só por `goal_id` — e como `goal_id` referencia uma **meta de catálogo compartilhada**, o drawer mostrava as rotinas de **todos os usuários** que vincularam alguma rotina àquela mesma meta. No próprio post isso significa "só as minhas rotinas"; em post de outra pessoa, só as rotinas do autor (as que o botão "Copiar meta" de fato copia)
- **Drawer de progresso da meta (tocar no card de meta/badge `🎯 N%` do post, `Index.tsx`):** segue o padrão **Drawer Glass** (`docs/15-design-system.md` §9.4) — shell escuro translúcido via `GLASS_SHEET_STYLE`/`GLASS_SHEET_PROPS`, cards internos (info da meta, grid de stats, accordion de rotinas vinculadas) em `GLASS_PANEL_STYLE`, texto branco/translúcido e botão "Copiar meta" em gradiente azul→roxo (`GLASS_PRIMARY_BTN_STYLE`). O `RoutineAccordion` (sub-componente local do `Index.tsx`, compartilhado entre dono e visitante do post) também foi migrado para o mesmo tema escuro
