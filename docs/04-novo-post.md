# Tela: Novo Post

> **Recorte v1.0** (ver [20-lancamento-v1.md](./20-lancamento-v1.md)):
> - **Seletor POST/SHOT removido** (`FEATURES.shots`): não há para onde publicar
>   um shot. O default de `mediaType` também é forçado para `"post"`, senão um
>   rascunho salvo em `sessionStorage` reabriria o editor em modo vídeo sem
>   seletor para sair dele.
> - **Marcar pessoas** (`FEATURES.postTags`), o **atalho `#`**
>   (`FEATURES.hashtags`) e o **alfinete de localização**
>   (`FEATURES.postLocation`) ficam guardados na barra da legenda.
> - O alfinete era o **único** caminho do app que pedia localização em primeiro
>   plano (`@capacitor/geolocation`). Com ele fora,
>   `NSLocationWhenInUseUsageDescription` saiu do Info.plist e o app não pede
>   localização de forma alguma. Ao religar a flag, reponha a chave.
> - **Vincular meta continua** — é o que costura o fitness ao social.

**Rota:** `/postar`
**Arquivo:** `client/pages/NewPost.tsx`
**Layout:** AppLayout

---

## Objetivo

Tela de criação de conteúdo. Permite ao usuário publicar um post com imagens ou criar um clipe de vídeo (Shot). O draft é persistido na sessão para não perder o conteúdo ao navegar.

---

## Estrutura Visual (2 etapas — estilo Instagram)

```
ETAPA 1 — Seleção de mídia
┌──────────────────────────────────┐
│  [X]   Novo post         Avançar │  ← header customizado
├──────────────────────────────────┤
│                                  │
│     Preview da foto/vídeo        │  ← aspect-ratio 1:1, full-width
│       selecionada(o)             │
│                                  │
├──────────────────────────────────┤
│  Recentes >        [Selecionar]  │  ← toolbar da galeria
├──────────────────────────────────┤
│  Grade 4 colunas de fotos        │  ← fotos selecionadas
│  selecionadas (toque p/ preview) │
├──────────────────────────────────┤
│    [POST]        [SHOT]          │  ← seletor de tipo de mídia
└──────────────────────────────────┘

ETAPA 2 — Legenda e publicação
┌──────────────────────────────────┐
│  [←]   Novo post    Compartilhar │  ← header com botão de submit
├──────────────────────────────────┤
│  [thumb] Textarea de legenda     │  ← preview miniatura + texto
├──────────────────────────────────┤
│  Tiras de fotos selecionadas     │  ← strip horizontal (se múltiplas)
├──────────────────────────────────┤
│  Contador de caracteres          │
├──────────────────────────────────┤
│  Vincular a uma meta (opcional)  │
├──────────────────────────────────┤
│  Marcar pessoas (opcional)       │  ← chips dos marcados + botão "Marcar"
├──────────────────────────────────┤
│  [     Publicar / Pub. Shot    ] │  ← botão principal
└──────────────────────────────────┘
```

---

## Etapa 1: Seleção de Mídia

### Header
- Botão `X` (fecha/volta à tela anterior via `navigate(-1)`)
- Título "Novo post"
- Botão "Avançar" (habilitado apenas quando há mídia selecionada)

### Preview
- Área full-width com `aspect-ratio: 1/1` (fundo preto)
- Mostra a foto atual (`currentPreviewIndex`) ou o vídeo selecionado
- Se vazio: placeholder com ícone `Camera` ou `Video` + instrução de toque
- Sobre a imagem: botão "Editar" (crop), navegação `ChevronLeft/Right`, dots de posição, badge com total de fotos

### Toolbar da Galeria
- **Label do álbum atual** ("Recentes" por padrão) à esquerda, agora **clicável** — abre um `DropdownMenu` (padrão Instagram) para trocar de álbum/pasta da galeria do dispositivo:
  - Itens fixos no topo: **Recentes** (sem filtro — biblioteca completa, comportamento padrão) e **Favoritos** — este último só aparece se o dispositivo realmente tiver esse álbum inteligente (detectado por título via `/favorit/i` na lista retornada por `PhotoLibrary.getAlbums()`). O atalho fixo de **Vídeos** foi removido (25/07/2026): no modo POST a consulta já pede só imagens, então filtrar por um álbum só-de-vídeo retornava grade vazia; no modo SHOT a galeria já só traz vídeos, tornando o atalho redundante. Se o dispositivo tiver um álbum "Vídeos", ele ainda aparece normalmente dentro de "Todos os álbuns"
  - Submenu **"Todos os álbuns"** — lista o restante dos álbuns do dispositivo (usuário + outros inteligentes), com contagem de itens; a opção **"Dos apps da Meta"** é **sempre excluída** (filtro `/meta/i` no título) por não fazer sentido no contexto do app
  - Item selecionado marcado com um ✓ azul; trocar de álbum recarrega a grade filtrada por aquele álbum (mantendo o filtro de tipo imagem/vídeo do `mediaType` atual)
  - **Limitação do plugin**: `PhotoLibrary.getLibrary` não filtra por álbum na consulta — ao selecionar um álbum específico, o app varre a biblioteca em lotes de 150 (`includeAlbumData: true`, até 1500 itens escaneados por chamada) filtrando client-side por `asset.albumIds`, acumulando até preencher uma página (40 itens) ou esgotar a biblioteca; "carregar mais" continua o scan de onde parou
- Botão "Selecionar vários" **(somente POST)** alterna o `multiSelectMode` — é um chip/pill com estado visual claro: **inativo** = fundo neutro translúcido + círculo vazio (outline); **ativo** = preenchido com o gradiente da marca (azul→roxo), círculo com ✓ branco e o contador `n/5` embutido no próprio label, evitando a ambiguidade de antes (onde só a cor do texto mudava)
  - Ao abrir a tela, a primeira foto da galeria é pré-selecionada automaticamente como preview (comportamento tipo Instagram) — sem que o usuário tenha tocado nela. Se o usuário liga o "Selecionar vários" nesse momento (sem ter tocado em nenhuma foto ainda), essa pré-seleção automática é descartada e o contador começa em `0/5`, em vez de já contar a foto que ninguém escolheu de fato (`autoSelectedActiveRef` em `NewPost.tsx` rastreia se a seleção atual é só a automática ou já foi tocada pelo usuário)

### Grade de Fotos (somente POST)
- 4 colunas, `gap-px`
- Primeira célula: ícone `Camera` (abre file picker)
- Células seguintes: fotos selecionadas (toque define o preview principal)
- Sobre cada foto: botão `X` para remover, número de ordem no canto inferior esquerdo, anel de destaque na foto ativa
- Sem fotos: 12 células de placeholder (só a primeira tem ícone)

### Seletor de Tipo (POST / SHOT)
- Tabs na parte inferior com ícone + label em maiúsculas
- Sublinhado na opção ativa

### Limite de fotos por post
- `MAX_POST_PHOTOS = 5` — no máximo **5 fotos** por publicação (somente POST; SHOT continua sendo 1 vídeo)
- Contador **`n/5`** aparece embutido no próprio botão "Selecionar vários" (chip) quando o modo de seleção múltipla está ativo
- Ao atingir o limite: as miniaturas **não selecionadas** da galeria ficam esmaecidas (`opacity: .35`) e tocar nelas exibe um toast de aviso (`newpost_max_photos_title`/`newpost_max_photos_desc`) em vez de adicionar — vale tanto para o toque na grade quanto para seleção via `<input type="file" multiple>` (fallback web/câmera), que descarta silenciosamente os arquivos excedentes e mostra o mesmo toast uma única vez ao final

---

## Etapa 2: Legenda e Publicação

### Header
- Botão `ArrowLeft` (volta à etapa 1)
- Título "Novo post"
- Botão "Compartilhar" executa o submit (com spinner durante envio)

### Área de Legenda
- Miniatura 64×64 da foto/vídeo selecionado (toque abre o modal de preview, somente POST). A miniatura reflete o `cropTransforms[i]` (zoom/pan feito na Etapa 1) via `CroppedThumb` (`client/components/shared/inline-crop-preview.tsx`) — não é um simples `object-cover` da imagem original
- `Textarea` sem borda (integrado ao layout), máx. 500 chars, com `ref` (`captionTextareaRef`) para permitir inserção de texto na posição do cursor pela barra de ícones abaixo
- Strip horizontal de thumbnails abaixo (apenas se múltiplas fotos selecionadas), **reordenável por arrastar** (ver abaixo)

### Barra de Ícones da Legenda (emoji / localização / hashtag)
Logo abaixo da `Textarea`, três atalhos que inserem texto **na posição do cursor** da legenda ativa (`description` ou `videoDescription`, conforme `mediaType`) — função compartilhada `insertIntoCaption`, que respeita o limite de 500 caracteres e devolve o foco/cursor ao textarea após inserir:

- **Emoji (`Smile`)** — abre o `EmojiPickerDrawer` (`client/components/shared/emoji-picker-drawer.tsx`), um drawer com abas por categoria (rostos, pessoas, animais, comida, atividades, viagens, símbolos) e uma grade de emojis unicode. Como são emojis unicode simples, o WebView do iOS já renderiza com o glyph nativo da Apple — não precisa de fonte/asset extra. O drawer permanece aberto após cada seleção (mesmo comportamento de um teclado de emoji), permitindo inserir vários em sequência
- **Localização (`MapPin`)** — usa o plugin `@capacitor/geolocation` para pedir permissão e obter a posição atual (`getCurrentPosition`, `enableHighAccuracy: false`), depois faz reverse geocoding via API pública **BigDataCloud** (`api.bigdatacloud.net/data/reverse-geocode-client`, sem necessidade de API key) para resolver "Cidade, País" a partir de lat/lng (`localityLanguage` segue o idioma ativo do app). O resultado é inserido na legenda como `📍 Cidade, País `. Mostra spinner (`Loader2`) no ícone enquanto localiza, e toast de sucesso/erro ao final (permissão negada, timeout ou falha de rede). Permissão declarada em `NSLocationWhenInUseUsageDescription` no `Info.plist` (compartilhada com o rastreamento de corrida)
- **Hashtag (`#`)** — insere apenas o caractere `#` na posição do cursor, para o usuário completar (ex.: `#fitness`)

### Reordenar fotos (arrastar na strip)
- Cada miniatura da strip aceita **arrastar horizontalmente** (Pointer Events — `onPointerDown`/`onPointerMove`/`onPointerUp`, `touchAction: "none"` para não conflitar com o scroll da tela) para mudar a ordem de postagem. Ex.: com 3 fotos selecionadas (1,2,3), arrastar a foto 3 para o início produz a ordem 3,1,2 — é essa ordem final que define a sequência publicada no post
- A troca de posição acontece em tempo real conforme o dedo cruza a metade da miniatura vizinha (`reorderPhotos`, passo de 64px = 56px da miniatura + 8px de gap); a foto arrastada ganha leve escala/sombra e segue o dedo, as demais reacomodam com transição suave
- Um toque rápido (sem arrastar) continua selecionando aquela foto como a exibida no preview principal da Etapa 1/Etapa 2 e no modal de preview (carrossel) — o mesmo gesto de toque não é mais o `onClick` direto na imagem, e sim resolvido no fim do gesto de arrastar (`handlePhotoDragEnd`) quando o deslocamento foi menor que um limiar (6px)
- O botão de remover (X) tem prioridade sobre o arrasto (`stopPropagation` no `pointerdown`)
- Reordenar mantém sincronizados `selectedFiles`, `previewUrls`, `selectedAssetIds` (seleção da galeria) e `cropTransforms` (ajustes de crop por foto) — o arquivo, o crop e a miniatura da galeria "viajam" junto com a foto movida
- Cada miniatura da strip (56×56) também usa `CroppedThumb` para refletir o `cropTransforms[i]` daquela foto, igual à miniatura 64×64 do topo — `CroppedThumb` escala `offsetX/offsetY` do transform pela proporção `tamanhoDaMiniatura / cropContainerWidthRef.current` (a largura do frame de crop cheio da Etapa 1, onde o transform foi originalmente capturado), preservando visualmente o mesmo enquadramento em qualquer tamanho de miniatura

### Modal de Preview da Imagem (`imagePreviewOpen`)
- Aberto ao tocar na miniatura 64×64 (somente POST)
- Mostra `previewUrls[currentPreviewIndex]` em tela cheia sobre backdrop escuro (`rgba(0,0,0,.88)`), com botão de fechar (X)
- **Com múltiplas fotos selecionadas**: vira um **carrossel** — setas `ChevronLeft`/`ChevronRight` sobre a imagem (translúcidas, `rgba(0,0,0,.5)`) navegam entre `previewUrls`, e uma fileira de **dots** no rodapé indica a posição atual (mesmo padrão visual do carrossel de preview da Etapa 1). Compartilha o índice `currentPreviewIndex` com o preview/crop da Etapa 1 e com a strip de thumbnails da Etapa 2 — navegar em qualquer um dos três reflete nos demais
- Respeita safe area (wrapper `fixed inset-0` com padding `env(safe-area-inset-*)`)

### Vincular Meta (somente POST)
- `Select` com metas ativas do usuário
- Se sem metas ou pelo atalho "+ Nova meta": navega para `/metas?tab=metas&action=create-goal` — o parâmetro `action=create-goal` faz a tela de Metas **já abrir o wizard de criação direto no passo `goal-origin`** (ver `docs/05-metas.md`), em vez de só cair na tela
- Hint verde com ícone `Sparkles` quando meta selecionada

### Marcar Pessoas (somente POST) — estilo Instagram
Seção "MARCAR PESSOAS · OPCIONAL" logo abaixo da seção de metas, para marcar quem está junto no post:

- Botão tracejado **"Marcar"** (ícone `UserRoundPlus`) abre o **`TagPeopleDrawer`** (`client/components/shared/tag-people-drawer.tsx`): lista quem o usuário segue (`getFollowingDb`) e, ao digitar na busca, também procura qualquer pessoa do app (`searchUsersDb`, debounce de 300ms, resultados mesclados sem duplicatas e sem o próprio usuário). Seleção por toque (check com gradiente da marca), botão "Concluir" fecha o drawer
- Máximo de **10 pessoas por post** (`MAX_TAGGED_PEOPLE`); ao exceder, toast destrutivo (`tag_people_max_title`/`tag_people_max_desc`)
- Cada pessoa selecionada vira um **chip** (avatar + nickname + `X` para remover) ao lado do botão "Marcar"
- A seleção persiste na sessão (`newpost_tagged_users`) junto com o restante do rascunho e é limpa ao publicar
- Ao publicar, os IDs vão no 5º parâmetro de `createPostDb`, que insere em `post_tags` **após** criar o post (falha na marcação não derruba o post). A trigger `trg_notify_post_tag` gera notificação **type 9** ("marcou você em uma publicação") para cada marcado — ver `docs/14-database-schema.md` e `docs/10-notificacoes.md`
- Não disponível para SHOT

### Botão Publicar
- Fixo no rodapé com `env(safe-area-inset-bottom)`
- "Publicar" (POST) ou "Publicar Shot" (SHOT)
- Desabilitado durante envio

---

## Persistência de Rascunho (SessionStorage)

Campos automaticamente salvos na sessão:

| Chave | Valor |
|---|---|
| `newpost_description` | Texto da descrição do post |
| `newpost_goal_id` | ID da meta selecionada para o post |
| `newpost_tagged_users` | Array JSON das pessoas marcadas (`SearchUser[]`) |
| `newpost_video_description` | Texto da descrição do vídeo |
| `newpost_video_goal_id` | ID da meta selecionada para o vídeo |
| `newpost_tab` | Aba ativa ao sair da tela |
| `newpost_image_previews` | Array JSON de base64 das imagens selecionadas |
| `newpost_image_meta` | Array JSON de `{ name, type }` para reconstruir os File objects |
| `newpost_video_preview` | Base64 do vídeo selecionado |
| `newpost_video_meta` | JSON de `{ name, type }` para reconstruir o File object do vídeo |

---

## Vincular Meta a um Post

- Dropdown com todas as metas ativas do usuário (`getUserGoalsDb`)
- Ao publicar com meta vinculada: incrementa o progresso da meta (`incrementGoalProgressDb`)
- A meta vinculada aparece no feed junto ao post

---

## Estados da Tela

| Estado | Comportamento |
|---|---|
| Carregando metas | Spinner no Select de metas |
| Enviando post | Botão desabilitado com ícone de loading |
| Upload concluído | Toast de sucesso → redirecionamento |
| Erro no upload | Toast destrutivo com mensagem |
| Sem Supabase | Toast de aviso e botão desabilitado |

---

## Dados Carregados

| Dado | Função DB |
|---|---|
| Metas do usuário | `getUserGoalsDb()` |
| Pessoas que o usuário segue (drawer de marcação) | `getFollowingDb()` |
| Busca global de pessoas (drawer de marcação) | `searchUsersDb(query)` |

---

## Observações Técnicas

- **Fotos editadas na galeria (recorte, marcação, filtro) — plugin nativo `EditedMedia`:** o arquivo full-res **não** vem mais do `PhotoLibrary.getPhotoUrl` do `@capgo/capacitor-photo-library`, e sim do plugin nativo local `EditedMediaPlugin` (`ios/App/App/EditedMediaPlugin.swift`), acessado pelo wrapper `client/lib/native-media.ts`:
  - **O bug que isso resolve:** edições feitas no app Fotos do iOS são não destrutivas — o asset mantém o recurso `.photo` (arquivo original) e ganha um `.fullSizePhoto` com o render editado. O `@capgo` exporta via `PHAssetResource` pegando o primeiro recurso que casa com `.photo || .fullSizePhoto || .alternatePhoto`, e o `.photo` vem antes → o app publicava **o print inteiro em vez do recorte** que o usuário vê na galeria. A miniatura da grade, que usa `PHImageManager` (default `version = .current`), mostrava o recorte — daí a divergência entre grade e preview
  - **A correção:** `PHImageManager.requestImageDataAndOrientation` com `version = .current`, que sempre devolve o render editado. `asset.width/height` (que já refletiam a versão editada) passam a bater com os bytes retornados
  - **Cache:** o `@capgo` nomeia os arquivos em cache só com o SHA-256 do `localIdentifier`, que **não muda** quando a foto é editada — cópia velha era reusada para sempre. O plugin novo inclui a `modificationDate` na chave, e o método `purgeStaleCache()` (chamado uma vez por sessão em `loadGalleryPage`, antes do primeiro `getLibrary`) apaga do cache do `@capgo` as miniaturas/arquivos gravados antes da última edição do asset
  - **Vídeos (SHOT):** mesma lógica com `PHVideoRequestOptions(version: .current)` — vídeo sem edição é copiado direto do `AVURLAsset`; vídeo aparado vem como composição e é reexportado via `AVAssetExportSession`. Como o trim pode virar mp4 mesmo saindo de um `.MOV`, a extensão usada no upload segue o `contentType` real, não o nome do arquivo original
  - **Compressão do shot para 1080p — `compressVideo` (2026-08-14; alvo elevado de 720p para 1080p em 2026-08-27):** o caminho acima exporta com `AVAssetExportPresetHighestQuality`, ou seja, **mantém o 4K/60fps do sensor**. Medição no bucket: os shots publicados tinham **~66MB de média** (12 arquivos = 794MB), o maior custo isolado de Storage do app — 200× uma foto do feed. O método novo `compressVideo({ id })` reexporta com `AVAssetExportPreset1920x1080` (`compressionPreset(for:)` cai para `AVAssetExportPreset1280x720` sozinho quando o asset não aceita o de 1080p), que encaixa o vídeo na caixa alvo **sem ampliar** (fonte menor sai igual, então chamar nunca piora o arquivo) e liga `shouldOptimizeForNetworkUse` para mover o `moov` ao início. **O alvo era 720p e subiu para 1080p em 27/08/2026:** o vídeo é assistido em tela cheia num display de 1080+ de largura, então o player ampliava o clipe de 720p e ele chegava visivelmente mais borrado que o mesmo vídeo na fototeca — 1080p ainda corta drasticamente o 4K do sensor, que era o custo real de Storage. Cache próprio no mesmo diretório, com prefixo **`c<altura>_`** antes do hash (hoje `c1080_`) — a busca do cache normal nunca casa com um comprimido. A altura entra no nome de propósito: mudar o alvo invalida a geração antiga, e `removeOtherGenerationCompressedFiles` apaga as cópias `c720_` do mesmo asset na primeira compressão seguinte (o `purgeStaleCache` não alcança esses arquivos, porque só casa nomes que **começam** com o hash e aqui o prefixo de geração vem antes dele)
  - **Wrapper `getCompressedVideoUrl(asset)`** (`native-media.ts`) é o que a tela chama para shot; degrada em silêncio para `getNativeMediaUrl` (sem compressão) quando a plataforma não é iOS, o build instalado é anterior ao método, ou o codec não aceita o preset. **Publicar grande é melhor que não publicar** — por isso nunca lança
  - **Estado de carregamento obrigatório:** a reexportação processa o vídeo inteiro e leva segundos. `NewPost` mostra um overlay bloqueante (`isPreparingVideo` → `newpost_preparing_video`) enquanto roda; sem ele o toque na galeria parece não ter feito nada, e um segundo toque dispararia outra exportação concorrente
  - **Vídeo vindo do `<input type="file">` — `compressMediaWrite` + `compressVideoBlob`:** ali o WebView entrega um `File` **sem `PHAsset`**, então o `compressVideo` acima não tem o que buscar na fototeca. A saída reaproveita a escrita fatiada que já existia para salvar na galeria: `startMediaWrite` → `appendMediaWrite`× (pedaços de 3MB) remonta o blob num arquivo nativo, e `compressMediaWrite` reencoda esse arquivo em 1080p (mesmo `compressionPreset(for:)`, com o mesmo fallback para 720p) e devolve o `webPath`. É o **terceiro final possível** de uma sessão de escrita, ao lado de `saveMediaWrite` (vai para a galeria) e `cancelMediaWrite` (descarta). O arquivo de saída fica no diretório de staging para o `fetch` do WebView ler; a limpeza é preguiçosa (`purgeOutgoingLeftovers` apaga o que tem +1h na compressão seguinte), porque ninguém avisa quando essa leitura termina
  - **`compressVideoBlob(blob)`** (`native-media.ts`) é o wrapper desse caminho. Usado por `NewPost.handleVideoFileChange` (shot pelo seletor de arquivos) e pelo `FlowCreationDialog` (vídeo importado da galeria). **Nunca piora**: devolve o blob original se não for iOS, se o build não tiver o método, se o codec recusar o preset, ou se o resultado não ficar menor que a entrada
  - **Fallback em 3 níveis** (`getNativeMediaUrl`): 1) plugin nativo `EditedMedia`; 2) `PhotoLibrary.getThumbnailUrl` pedindo **as dimensões reais do asset** — por dentro é `PHImageManager.requestImage`, cujo `version` default é `.current`, então também devolve o render editado, e passar a proporção real evita que o `contentMode: .aspectFill` do plugin recorte a imagem (só para foto; em vídeo esse método devolveria um frame estático). É o caminho que conserta o bug mesmo se o plugin nativo não registrar. Limitado a 2560px no lado maior, já que o recorte final é exportado com no máximo 2160px; 3) `PhotoLibrary.getPhotoUrl`, último recurso, que é justamente o que devolve o original
  - **Registro (duas metades, as duas obrigatórias):** plugin local não entra no `packageClassList` do `capacitor.config.json`, então é registrado à mão em `ViewController.capacitorDidLoad()` via `bridge?.registerPluginInstance(...)` — **e o `Main.storyboard` precisa instanciar essa subclasse**, com `customClass="ViewController" customModule="App" customModuleProvider="target"`. Até 12/08/2026 o storyboard apontava para o `CAPBridgeViewController` do módulo `Capacitor`, então o `capacitorDidLoad()` nunca rodava e **todo** método do `EditedMedia` voltava `UNIMPLEMENTED`. Como `getMediaUrl` e `purgeStaleCache` têm `catch` com fallback, o app degradava em silêncio (caminho 2) e ninguém percebia; quem denunciou foi o "Salvar rascunho" do flow, que acusava "Atualize o app" num app já atualizado
- **Preview instantâneo:** ao tocar numa foto da galeria, o frame de preview é preenchido **imediatamente** com a thumbnail já carregada (`asset.thumbnail.webPath`); o arquivo full-res é carregado em background (`getNativeMediaUrl` → `fetch` → `FileReader`) e trocado quando pronto. Um token (`tapRequestRef`) descarta carregamentos obsoletos quando o usuário toca rápido em várias fotos. O mesmo vale para o auto-select da primeira foto e o badge de número no multi-select (mostrado antes do carregamento concluir)
- Imagens são convertidas para `File[]` e URLs de preview geradas com `URL.createObjectURL`
- URLs de preview são revogadas no unmount (evita memory leak)
- Tab ativa é preservada em sessionStorage — ao voltar, usuário retorna na mesma aba
- **Persistência do passo (step):** o passo atual (`select` ou `caption`) é salvo em `sessionStorage` (`newpost_step`) e restaurado ao montar a tela — desde que ainda haja conteúdo selecionado (fotos no `imageDraft` ou vídeo no `videoDraft`). Isso cobre o fluxo de "+ Nova meta": usuário está na etapa de legenda, sai para `/metas` para criar uma meta nova, e ao retornar cai direto na etapa de legenda com fotos e texto já preenchidos, em vez de reiniciar na galeria. O `newpost_step` é limpo ao publicar com sucesso (post ou shot)
- A seleção de arquivos usa `<input type="file" multiple accept="image/*">` oculto
- Para vídeos: `<input type="file" accept="video/*">` oculto
