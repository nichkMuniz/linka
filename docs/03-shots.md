# Tela: Shots (Clipes)

**Rota:** `/shots`
**Arquivo:** `client/pages/Shots.tsx`
**Layout:** ShotsLayout (layout customizado para vídeos)

---

## Objetivo

Feed de vídeos curtos no estilo TikTok/Reels. O usuário rola verticalmente entre clipes de outros usuários, podendo curtir, comentar, seguir o criador e interagir com o conteúdo.

---

## Estrutura Visual

```
┌──────────────────────────────────┐
│  Vídeo em tela cheia             │
│                                  │
│  [Info do criador]  [Incentivos] │
│  [Descrição]        [Comentários]│
│  [Seguir]                        │
├──────────────────────────────────┤
│  (scroll para próximo vídeo)     │
└──────────────────────────────────┘
```

---

## Comportamento do Feed

- Scroll vertical snap — cada vídeo ocupa a tela inteira
- Reprodução automática do vídeo visível (`IntersectionObserver`)
- Pausa automática ao sair do viewport
- Swipe hint na primeira visita (desaparece após ver)
- Inicialmente mutado (`isMuted: true`) — botão para ativar som

---

## Elementos de Cada Shot

| Elemento | Posição | Descrição |
|---|---|---|
| Vídeo | Fundo | Reprodução em loop, objeto fit cover |
| Barra de progresso | Superior (topo da tela) | Linha fina mostrando o avanço do vídeo — toque ou arraste para avançar/retroceder |
| Avatar do criador | Inferior esquerdo | Link para perfil (`/usuario/:userId`) |
| Nome do criador | Inferior esquerdo | Nickname do usuário + `VerifiedBadge` (se verificado) + `UserInsignias` (insígnia selecionada, mesmo componente do feed/perfil) |
| Botão Seguir/Seguindo | Inferior esquerdo | Follow/unfollow inline |
| Descrição | Inferior esquerdo | Texto descritivo do clipe. Se ultrapassar 80 caracteres ou tiver quebra de linha, é truncado com botão "ver mais/menos" (mesmo padrão do feed) — evita que uma descrição longa ocupe a tela toda |
| Menu de opções (⋮) | Superior direito | Sempre visível. Dono: Editar, Ver incentivos, Ver visualizações, Excluir. Outro usuário: Denunciar usuário, Denunciar shots |
| Botão Mudo/Som | Superior direito | Toggle de áudio |
| Botões de Incentivo | Lateral direita | 6 tipos de reação |
| Botão Comentários | Lateral direita | Ícone de balão + contagem |
| Botão Enviar (avião de papel) | Lateral direita | Abre `SendToFriendDrawer` para enviar o shot a amigos via mensagem privada |
| Botão de Incentivos (dono) | Lateral direita | ❤️ + total de incentivos recebidos — visível apenas para o dono do shot |

---

## Botões e Ações

### Incentivos (Like / Reações)
- 6 tipos de incentivo (mesmos do feed)
- Componente: `PostIncentiveButton` envolvido em um `div` com contador abaixo
- Toggle por tipo — clicar novamente remove o incentivo
- Contador exibido abaixo de cada ícone quando `count > 0` (ex: "1", "3")
- Estado local atualiza tanto `userLikes` quanto `likes` (contadores) otimisticamente
- Função: `toggleShotIncentiveDb`

### Comentários
- Ícone `MessageCircle` + contagem
- Abre **Drawer** pela direita
- Lista todos os comentários com foto e nome do autor
- Campo para digitar novo comentário + botão Send
- Botão para deletar comentário (apenas o autor pode deletar o próprio)
- Suporte a **resposta a comentários** (reply)

### Enviar para Amigo (2026-07-12)
- Ícone `Send` (avião de papel) abaixo do botão de comentários
- Abre o `SendToFriendDrawer` (`components/shared/`) com preview do shot (frame do vídeo)
- Envia mensagem privada com prefixo `[shot]:<shotId>` para até 10 pessoas de uma vez, com texto opcional
- **Deep link de shot (perfil / mensagem compartilhada):** ao abrir `/shots` com `location.state.shotId`, o shot-alvo é **movido para o índice 0** da lista no carregamento — se já está no feed mas fundo, é reordenado para o topo (preservando o resto); se não está entre os shots do feed, é buscado via `getShotByIdDb` e inserido no topo. Ver "Bug do vídeo congelado" em Observações Técnicas

### Insígnia do Criador
- Componente `UserInsignias` (`components/profile/user-insignias.tsx`) ao lado do nome, dentro do botão que abre o perfil do usuário — mesmo padrão do feed (`PostCard`) e da tela de Comunidade
- Mostra a insígnia **selecionada** pelo dono do shot (`getDisplayBadgeDb`, persistida em `profiles.selected_badge_id`) — não a "mais alta" automaticamente
- Clicável: abre o `InsigniasDrawer` com todas as insígnias (desbloqueadas e bloqueadas) do usuário; usa `stopPropagation` (interno ao componente + wrapper) para não disparar a navegação para `/usuario/:userId` do botão pai
- Funciona tanto para o próprio dono do shot quanto para outros usuários — qualquer pessoa pode ver a insígnia de quem postou

### Seguir / Deixar de Seguir
- Botão `UserPlus` (não seguindo) ou `UserCheck` (seguindo)
- Estado carregado em batch via `getFollowingStatusBatchDb`
- Funções: `followUserDb` / `unfollowUserDb`
- Loading individual por usuário

### Menu de Opções (dono do shot)
- **Editar** — Abre Drawer com textarea para editar descrição
- **Ver incentivos recebidos** — Abre `PostLikesModal` com a lista de quem incentivou (via `getShotLikeUsersDb`)
- **Ver visualizações** — Abre o Drawer "Visualizações" com a lista de quem viu o shot (via `getShotViewersDb`) — visível apenas para o dono. Ver seção "Visualizações (quem viu o shot)"
- **Excluir** — AlertDialog de confirmação → chama `deleteShotDb` que remove o shot e suas dependências (`shots_likes`, `shots_comments` e `shot_user_viewed`) em cascata, depois remove o item do estado local

### Menu de Opções (shot de outro usuário) — 2026-08-06
- O botão ⋮ agora aparece **para todos os shots**, não só para os do próprio usuário
- Quando o shot é de outra pessoa, o menu traz as mesmas opções do feed (`PostCard`), com a nomenclatura de Shots:
  - **Denunciar usuário** (`report_user`) — abre o `ReportDrawer` com `type="user"` → grava em `user_complaint` via `reportUserDb`
  - **Denunciar shots** (`report_shot`) — abre o `ReportDrawer` com `type="shot"` → grava em `shots_complaint` via `reportShotDb`
- Componente reutilizado: `ReportDrawer` (`components/shared/report-drawer.tsx`) — o mesmo do feed, estendido com o tipo `"shot"`
- Cabeçalho do drawer mostra "Shot de {nickname}" + a descrição do shot (uma linha), igual ao padrão de post
- As denúncias caem na fila de moderação do Admin (`admin_complaints_view`, tipo `shot`)
- **Motivos**: os rótulos são traduzidos (PT/EN), mas o valor gravado em `reason` é sempre o texto em PT — o painel de admin fica consistente entre usuários de idiomas diferentes

### Visualizações (quem viu o shot)
- Mesmo sistema da tela de Flow ("quem viu o seu flow")
- **Registro:** quando um shot entra na tela (fica visível pelo `IntersectionObserver`), o app grava a visualização via `recordShotViewDb(shotId, ownerId)` na tabela `shot_user_viewed`. O dono do próprio shot **não** é registrado, e há deduplicação por sessão (Set em memória) + verificação no banco para não duplicar entre sessões/telas (constraint `unique(follower_id, shot_id)`)
- **`data-owner-id`** é lido do elemento do shot pelo observer para saber o dono sem depender de closure
- **Consulta (dono):** o item "Ver visualizações" do menu chama `handleOpenShotViewers` → `getShotViewersDb(shotId)`, que retorna a lista de visualizadores (avatar, nickname, quando viu e os tipos de incentivo que enviaram, se enviaram)
- **Drawer "Visualizações":** ícone `Eye` + contagem no título; estados de loading (spinner), vazio (`shots_no_views`) e lista; cada item é clicável e navega para `/usuario/:followerId`; os ícones de incentivo enviados são renderizados via `renderIncentiveIcon`

### Descrição Longa ("ver mais")
- Mesmo comportamento do feed (`PostCard`): descrição truncada em 80 caracteres (ou na primeira quebra de linha) com botão "ver mais" (`feed_description_more`) para expandir
- Ao expandir, texto completo aparece com scroll interno limitado (`max-h-[40vh]`) e botão "ver menos" (`feed_description_less`) para recolher
- Clique na descrição (ou nos botões) usa `stopPropagation` para não disparar o toggle de play/pause do vídeo
- Estado de expansão controlado por shot via `expandedDescriptions` (Set de IDs)
- **Hashtags:** renderizadas via `renderWithHashtags` (mesmo utilitário do feed/`PostDetail`, em `lib/post-visuals.tsx`) — tokens `#tag` aparecem em azul (`#9db8ff`) e são clicáveis, navegando para `/tag/:tag` (tela de Hashtag). O clique usa `stopPropagation` para não disparar o toggle de expandir/recolher da descrição nem o play/pause do vídeo

### Controle de Áudio
- Ícone `Volume2` (com som) / `VolumeX` (mutado)
- Estado global para todos os vídeos da sessão
- **Label auto-colapsável:** o texto "Som"/"Mudo" ao lado do ícone fica visível por 2.5s (ao abrir a tela ou a cada toque no botão) e depois encolhe suavemente (`transition-smooth`, animando `max-width`/`opacity`), deixando só o ícone circular visível para poupar espaço na tela. Tocar no botão reexibe o label e reinicia o timer

### Gestos no Vídeo
- **Toque simples** → pausa / retoma o vídeo (ícone `Play`/`Pause` de feedback por 800ms)
- **Toque duplo** → abre o overlay de incentivo rápido (`QuickIncentiveOverlay`)
- **Pressionar e segurar** → pausa o vídeo enquanto o dedo permanece pressionado; ao soltar, retoma (mesmo sistema do FlowViewer). Movimento > 10px cancela o hold para não conflitar com o scroll/swipe; só retoma se o shot ainda estiver visível
- **Área de toque do vídeo:** o wrapper "Bottom Area" (descrição + ícones de incentivo) usa `pointer-events-none`, reabilitando `pointer-events-auto` apenas no texto da descrição e na coluna de ícones. Isso evita que a área invisível do wrapper (que antes cobria a largura inteira da tela, com altura igual à da coluna de ícones) capture o toque/hold destinado ao vídeo — bug corrigido em 2026-07-03 onde pressionar-e-segurar no meio da tela não pausava o vídeo

### Barra de Progresso do Vídeo
- Linha fina (3px) no topo de cada clipe, dentro de uma faixa de toque maior (16px) para facilitar o toque no mobile
- Preenchimento com o mesmo gradiente azul/roxo/laranja da barra de progresso do Flow (`linear-gradient(to right, #3A8DFF, #7B3FF2, #FF8A2A)` + leve `box-shadow` de brilho)
- **Avanço suave (~60fps):** em vez de depender do evento `timeupdate` (dispara só ~4x/s e causa sensação de "travamento"), o progresso é amostrado a cada frame via `requestAnimationFrame` — mesma técnica usada na barra de progresso do Flow (`FlowViewer.tsx`)
- O `requestAnimationFrame` roda apenas para o shot atualmente visível (`visibleShotId`), evitando custo de rAF em vídeos fora da tela
- **Atualização direto no DOM** (sem `setState`) — evita re-renderizar a lista inteira de shots a cada frame, importante para performance com dezenas de vídeos montados
- **Toque ou arraste** na barra faz *seek* (avança/retrocede) para o ponto tocado — usa `Pointer Events` com `setPointerCapture` para arrasto contínuo mesmo saindo da área da barra
- Durante o arrasto, o vídeo é pausado para permitir um ajuste preciso; ao soltar, retoma a reprodução automaticamente se estava tocando antes
- Interações com a barra usam `stopPropagation` para não disparar os gestos do vídeo (pausar/retomar, like duplo, pressionar-e-segurar)

---

## Drawer de Comentários

```
┌──────────────────────────────────┐
│  ▁▁▁  (handle)                   │
│  Comentários · 12                │
│  [Avatar] Nome · 2h     [✎] [🗑] │
│  Texto do comentário             │
│  reações                         │
│  [Avatar] Nome · 1d              │
│  Texto...                        │
│  ────────────────────────────    │
│  [Avatar] [Input...]        [➤]  │
└──────────────────────────────────┘
```

- Mesmo layout visual do drawer de comentários do feed (`PostCommentsDialog`): fundo glassmorphism escuro (gradiente + `backdrop-blur`), cantos `rounded-t-[32px]`, título `Comentários · N`, tempo relativo (`agora`/`m`/`h`/`d`), avatar do usuário atual na barra de input e botão de enviar circular com gradiente azul/roxo
- Altura fixa em `min(60dvh, viewportHeight - 8px)` (`height` e `maxHeight` iguais), igual ao drawer de comentários do feed — não cresce/encolhe conforme a quantidade de comentários
- Clicar no avatar ou no nome do autor de um comentário fecha o drawer e navega para `/usuario/:userId` (mesmo padrão usado no header do shot e no drawer de Visualizações)
- Altura controlada por `useKeyboardAwareHeight` (não encolhe com o teclado iOS)
- Ao focar o input, quem trata o teclado é o `DrawerContent` compartilhado: ele levanta o drawer inteiro acima do teclado e limita o `max-height` à área visível, mantendo a lista de comentários do mesmo tamanho (sem "estourar" nem subir demais). Esse comportamento vale para todos os drawers do app — nenhum consumidor precisa mais empurrar a própria barra de input com `marginBottom: var(--keyboard-offset)`
- Carrega comentários via `getShotCommentsDb`
- Adiciona via `addShotCommentDb`
- Edita via `updateShotCommentDb`
- Remove via `deleteShotCommentDb`
- Reações por comentário via `CommentReactions`

---

## Drawer de Edição do Shot

- Apenas o dono do shot vê esta opção
- Textarea para editar a descrição
- Botão "Salvar" — chama `updateShotDb`
- Botão "Cancelar"

---

## Estados da Tela

| Estado | Comportamento |
|---|---|
| Carregando | `LoadingSpinner` centralizado |
| Erro ao carregar | Mensagem de erro com botão tentar novamente |
| Feed vazio | Mensagem "Nenhum clipe disponível" |
| Sem conexão | Toast de aviso |

---

## Dados Carregados

| Dado | Função DB |
|---|---|
| Lista de shots | `getShotsDb()` |
| Status de seguimento | `getFollowingStatusBatchDb()` |
| Insígnia exibida do criador | `getDisplayBadgeDb(userId)` — carregado pelo `UserInsignias`, um por shot visível (cacheado 30s) |
| Comentários do shot | `getShotCommentsDb(shotId)` |
| Quem mandou incentivos | `getShotLikeUsersDb(shotId)` — carregado sob demanda pelo dono |
| Quem visualizou o shot | `getShotViewersDb(shotId)` — carregado sob demanda pelo dono |
| Registro de visualização | `recordShotViewDb(shotId, ownerId)` — gravado ao shot ficar visível |
| Denúncia de shot | `reportShotDb(shotId, reason)` → tabela `shots_complaint` |
| Denúncia de usuário | `reportUserDb(userId, reason)` → tabela `user_complaint` |

---

## Observações Técnicas

- Referências de vídeo armazenadas em `videoRefsMap` (ref map por shotId)
- `IntersectionObserver` detecta qual vídeo está visível e controla play/pause
- **Preload sob demanda (performance):** o atributo `preload` de cada `<video>` é dinâmico conforme a distância para o shot visível — visível = `auto` (buffer), vizinhos imediatos = `metadata`, demais = `none`. Evita que os 50 vídeos baixem metadata ao mesmo tempo no WebView do iOS, acelerando o primeiro frame
- **Autoplay do shot ao abrir a tela pelo perfil/busca (`playVideoSafely` + retry, corrigido 2026-07-20):** abrir um shot pelo perfil às vezes deixava o vídeo **pausado mostrando o primeiro frame** (não preto — o vídeo tinha dados, só não tocava). Duas causas somadas, ambas no `play()` do autoplay de chegada:
  1. **No-op silencioso do iOS.** Os shots tocam **com som** (`isMuted` inicia `false`). No WKWebView, um `play()` com áudio sem "ativação do usuário" recente **nem sempre lança erro** — muitas vezes o iOS só **ignora** o `play()` e o vídeo fica pausado. O `playVideoSafely` antigo confiava em `try/catch`; sem rejeição, o fallback mudo nunca disparava. **Corrigido:** ele agora checa `video.paused` **depois** de cada tentativa (não confia no throw) — tenta com som, e se continuar pausado toca **mudo** (autoplay mudo é sempre permitido) + destaca o botão de som (`revealSoundLabel`) para reativar o áudio com um toque. Também é **idempotente** (`if (!video.paused) return`) para não brigar com chamadas concorrentes.
  2. **Prontidão (`readyState`) na chegada.** Logo após montar, o `<video>` do shot-alvo costuma não ter dados suficientes e um **único** `play()` falha em silêncio. O efeito de auto-play do primeiro shot agora **reagenda** (`setTimeout` 200ms, até 8 tentativas) enquanto o primeiro shot seguir pausado e ainda for o shot em foco — o `IntersectionObserver` assume dali em diante se o usuário rolar.
  > Autoplay em si funciona neste app (os shots do feed tocam ao rolar), então **não** era bloqueio nativo do WKWebView nem limite de decoders — era o `play()` de chegada falhando em silêncio sem retry. `playVideoSafely` é usado pelo observer e pelo auto-play inicial; plays por toque (tap/hold/scrub) não precisam dele.
- **Bug do vídeo congelado ao abrir um shot pelo perfil (corrigido 2026-07-20):** abrir o shot de outro usuário (ou um shot compartilhado) que estava fundo no feed reproduzia o áudio mas deixava o **frame congelado** no iOS. Causa: aquele `<video>` renderizava com `preload="none"` (por estar longe do `visibleIndex`) e, no WKWebView, um vídeo que nunca foi compositado, ao ser rolado para a viewport e receber `play()`, toca o áudio sem pintar o primeiro frame. A rolagem normal não sofre disso porque os vizinhos são pré-aquecidos com `preload="metadata"` antes de entrarem; e o próprio perfil "funcionava" só porque os shots do dono ficam no topo do feed (índice pequeno). **Correção:** o shot-alvo é sempre movido para o índice 0 no carregamento, então monta já visível com `preload="auto"`, igual ao primeiro shot do feed. Isso também eliminou um áudio duplicado (o efeito "auto-play first video" tocava o `feed[0]` errado enquanto a tela rolava até o alvo)
- O hint de swipe é persistido em `localStorage` para não aparecer novamente
- O componente aceita props `footerHeight` e `isDesktop` para ajuste de layout no ShotsLayout
- Ao navegar de uma notificação com `location.state = { openComments: true, shotId }`, o drawer de comentários abre automaticamente para o shot correto
- A abertura via notificação é guardada por `openCommentsFromNotifRef` para evitar dupla abertura
- Ao navegar de uma notificação de incentivo recebido em um shot com `location.state = { openIncentives: true, shotId }`, o drawer "Ver incentivos" (lista de quem incentivou, via `handleOpenShotLikes`/`getShotLikeUsersDb`) abre automaticamente para o shot correto
- A abertura via notificação é guardada por `openIncentivesFromNotifRef` para evitar dupla abertura
