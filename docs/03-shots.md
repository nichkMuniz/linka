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
| Nome do criador | Inferior esquerdo | Nickname do usuário |
| Botão Seguir/Seguindo | Inferior esquerdo | Follow/unfollow inline |
| Descrição | Inferior esquerdo | Texto descritivo do clipe. Se ultrapassar 80 caracteres ou tiver quebra de linha, é truncado com botão "ver mais/menos" (mesmo padrão do feed) — evita que uma descrição longa ocupe a tela toda |
| Menu de opções (⋮) | Superior direito | Editar ou Excluir (só para o dono) |
| Botão Mudo/Som | Superior direito | Toggle de áudio |
| Botões de Incentivo | Lateral direita | 6 tipos de reação |
| Botão Comentários | Lateral direita | Ícone de balão + contagem |
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

### Seguir / Deixar de Seguir
- Botão `UserPlus` (não seguindo) ou `UserCheck` (seguindo)
- Estado carregado em batch via `getFollowingStatusBatchDb`
- Funções: `followUserDb` / `unfollowUserDb`
- Loading individual por usuário

### Menu de Opções (dono do shot)
- **Editar** — Abre Drawer com textarea para editar descrição
- **Excluir** — AlertDialog de confirmação → chama `deleteShotDb` que remove o shot e suas dependências (`shots_likes` e `shots_comments`) em cascata, depois remove o item do estado local

### Descrição Longa ("ver mais")
- Mesmo comportamento do feed (`PostCard`): descrição truncada em 80 caracteres (ou na primeira quebra de linha) com botão "ver mais" (`feed_description_more`) para expandir
- Ao expandir, texto completo aparece com scroll interno limitado (`max-h-[40vh]`) e botão "ver menos" (`feed_description_less`) para recolher
- Clique na descrição (ou nos botões) usa `stopPropagation` para não disparar o toggle de play/pause do vídeo
- Estado de expansão controlado por shot via `expandedDescriptions` (Set de IDs)

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
| Comentários do shot | `getShotCommentsDb(shotId)` |
| Quem mandou incentivos | `getShotLikeUsersDb(shotId)` — carregado sob demanda pelo dono |

---

## Observações Técnicas

- Referências de vídeo armazenadas em `videoRefsMap` (ref map por shotId)
- `IntersectionObserver` detecta qual vídeo está visível e controla play/pause
- **Preload sob demanda (performance):** o atributo `preload` de cada `<video>` é dinâmico conforme a distância para o shot visível — visível = `auto` (buffer), vizinhos imediatos = `metadata`, demais = `none`. Evita que os 50 vídeos baixem metadata ao mesmo tempo no WebView do iOS, acelerando o primeiro frame
- O hint de swipe é persistido em `localStorage` para não aparecer novamente
- O componente aceita props `footerHeight` e `isDesktop` para ajuste de layout no ShotsLayout
- Ao navegar de uma notificação com `location.state = { openComments: true, shotId }`, o drawer de comentários abre automaticamente para o shot correto
- A abertura via notificação é guardada por `openCommentsFromNotifRef` para evitar dupla abertura
- Ao navegar de uma notificação de incentivo recebido em um shot com `location.state = { openIncentives: true, shotId }`, o drawer "Ver incentivos" (lista de quem incentivou, via `handleOpenShotLikes`/`getShotLikeUsersDb`) abre automaticamente para o shot correto
- A abertura via notificação é guardada por `openIncentivesFromNotifRef` para evitar dupla abertura
