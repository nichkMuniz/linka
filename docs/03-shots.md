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
| Avatar do criador | Inferior esquerdo | Link para perfil (`/usuario/:userId`) |
| Nome do criador | Inferior esquerdo | Nickname do usuário |
| Botão Seguir/Seguindo | Inferior esquerdo | Follow/unfollow inline |
| Descrição | Inferior esquerdo | Texto descritivo do clipe |
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

### Controle de Áudio
- Ícone `Volume2` (com som) / `VolumeX` (mutado)
- Estado global para todos os vídeos da sessão

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
- O hint de swipe é persistido em `localStorage` para não aparecer novamente
- O componente aceita props `footerHeight` e `isDesktop` para ajuste de layout no ShotsLayout
- Ao navegar de uma notificação com `location.state = { openComments: true, shotId }`, o drawer de comentários abre automaticamente para o shot correto
- A abertura via notificação é guardada por `openCommentsFromNotifRef` para evitar dupla abertura
