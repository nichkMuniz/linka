# Tela: Detalhe do Post

**Rota:** `/post/:postId`
**Arquivo:** `client/pages/PostDetail.tsx`
**Layout:** AppLayout (com header próprio, altura fixa, sem scroll)

---

## Objetivo

Visualização isolada de um post específico. Permite ver o post com todas as suas interações de forma ampliada, e gerenciar o post se for o dono.

---

## Estrutura Visual

```
┌──────────────────────────────────┐
│  [←] Post                        │  ← Header (altura fixa)
├──────────────────────────────────┤
│ ┌────────────────────────────┐   │
│ │ [Avatar Nome·tempo]  [🎯]│⋮││  │  ← Pill de identidade + goal badge + menu, sobrepostos na foto
│ │                              │   │
│ │   Imagem/Carrossel (fill)    │   │  ← preenche toda a altura restante
│ │                              │   │
│ │  Legenda (trunca em 80c)     │   │
│ │  [Incentivos...] │ N │ 💬   │   │  ← Barra de ações "glass" sobreposta no rodapé da foto
│ └────────────────────────────┘   │
└──────────────────────────────────┘
```

Estrutura "glass" idêntica à usada nos cards do feed (`PostCard`) — foto em tela cheia com overlays translúcidos por cima, ao invés do antigo layout de card com faixa preta e conteúdo abaixo da imagem.

### Sem scroll vertical (tela de altura fixa)

Como a tela sempre exibe exatamente **1 post**, ela não tem scroll de página — o layout inteiro é dimensionado para caber na viewport:

- Container raiz é `flex flex-col` com `height` calculada via `calc(100dvh - <chrome do AppLayout>)`, reservando a mesma altura que o header flutuante e o bottom nav do `AppLayout` já consomem via padding em `<main>` (`client/components/layout/app-layout.tsx`) — se essas dimensões mudarem lá, a fórmula aqui precisa ser atualizada junto
- Header próprio (`shrink-0`) fica fixo no topo; a área do post é `flex-1 min-h-0`, ocupando todo o espaço restante
- A foto/carrossel usa a prop `fill` do `PostCarousel` (`client/components/post/post-carousel.tsx`) para preencher 100% da altura do card via `h-full`, em vez do `aspect-square` padrão ou do cálculo de `tall` do feed
- Legenda expandida ("ver mais") ganha `max-h-[40vh] overflow-y-auto` — mesmo padrão usado em Shots (`docs/03-shots.md`) — para permitir scroll interno apenas do texto em legendas muito longas, sem nunca rolar a tela inteira

---

## Componentes da Tela

### Header (Sticky)
- Botão `ArrowLeft` → volta para a tela anterior
- Título "Post"

### Card do Post (Glass)
- Wrapper com `borderRadius: 28px` e sombra pronunciada (`0 20px 44px -16px rgba(0,0,0,.7)`), mesmo padrão visual do `PostCard` do feed
- Foto/carrossel via `PostCarousel` (`objectFit="cover"`, `hideDots`, indicador de página renderizado externamente); sem foto → gradiente determinístico por `post.id` (`getPostGradient`, `client/lib/post-visuals.tsx`)
- Overlay de gradiente escuro (`transparent` no meio → `rgba(0,0,0,.65)` embaixo) para garantir contraste do texto branco

### Pill de Identidade (topo-esquerda, sobreposta)
- Avatar + nickname + selo de verificado + tempo relativo, dentro de uma pill com efeito vidro (`GLASS_TOP` de `client/lib/post-visuals.tsx`)
- Toque no avatar/nome → navega para `/usuario/:userId`
- Badge 🎯 com percentual da meta vinculada (`postGoal.perc`), quando o post tem `user_goal_id`

### Menu de Opções (⋮) — topo-direita, sobreposto
- Botão circular translúcido (`backdrop-blur`), **visível para todos os usuários** (antes era exclusivo do dono)
- **Compartilhar** (2026-07-16) — primeira opção, disponível para qualquer usuário. Abre o `ShareDrawer` (`client/components/shared/share-drawer.tsx`) com o link do post (`postShareUrl(post.id)`) e o texto `share_post_text` + a descrição do post. Mesmo padrão do feed (ver `docs/01-feed.md`). O `onSendToFriend` do drawer abre o `SendToFriendDrawer` — o envio por mensagem privada continua disponível, agora como o botão "Amigos" dentro do drawer de compartilhamento
- As opções abaixo aparecem **apenas para o dono do post** (separadas por `DropdownMenuSeparator`):
  - **Editar** — abre `EditPostDrawer` (descrição, meta vinculada e **pessoas marcadas** — ver `docs/01-feed.md`). O `onSaved` devolve `(newDescription, newTaggedUsers)` e a tela atualiza o post em memória sem refetch
  - **Excluir** — `AlertDialog` de confirmação → `deletePostDb`

### Descrição (com truncamento — igual ao feed)
- Sobreposta na parte inferior da foto, texto branco com `textShadow` para legibilidade
- Trunca em **80 caracteres** (ou na primeira quebra de linha) com botão "ver mais" (`feed_description_more`)
- Ao expandir, o texto completo ganha um fundo `glass` (`rgba(0,0,0,.45)` + blur) e botão "ver menos" (`feed_description_less`) para recolher
- Hashtags (`#token`) são destacadas em azul claro (`renderWithHashtags`, `client/lib/post-visuals.tsx`) — mesma função usada no feed. **Clicáveis:** tocar numa hashtag navega para `/tag/:tag` (ver `docs/16-hashtag.md`). `renderWithHashtags` aceita um callback opcional `onHashtagClick(tag)`; feed e PostDetail passam `(tag) => navigate('/tag/'+tag)`. Só a parte `#tag` do token é clicável (pontuação final fica fora do link)
- Constante `DESC_MAX_CHARS = 80` compartilhada com o `PostCard` via `client/lib/post-visuals.tsx`

### Pessoas Marcadas (linha "com fulano")
- Quando o post tem pessoas marcadas (`post.taggedUsers`, carregado por `getPostByIdDb` a partir de `post_tags`), uma linha "👥 com {nick}" (ícone `UsersRound`) aparece no overlay inferior, **acima da descrição** — mesmo padrão do feed
- 1 pessoa marcada → toque navega direto para `/usuario/:id`; 2+ → rótulo "com {nick} e mais {n}" e o toque abre o `FollowListDrawer` (título "Pessoas marcadas", cada linha navega ao perfil e tem `FollowButton`)

### Pill "Ver treino" + comparação (só em posts de resumo de treino)
- Quando o post carrega um `workout_summary`, renderiza o `WorkoutDetailButton` (`client/components/shared/workout-detail-dialog.tsx`) no overlay inferior, acima do indicador de carrossel
- Tocar abre o drawer simplificado com a lista de exercícios (miniatura do exercício + grupo muscular + séries em chips `{kg}kg × {reps}`) — mesmo componente do feed e do Perfil. Ver `docs/01-feed.md` (Detalhe do treino)
- **Dentro** desse drawer, acima da lista, aparece o botão **"Comparar com o meu treino"** (`WorkoutCompareContent` em `client/components/shared/workout-compare-dialog.tsx`) — **oculto no meu próprio post**. Troca o conteúdo do sheet pelo confronto exercício a exercício entre o treino do post e a minha última execução de cada exercício (placar + indicador de quem fez mais). Ver `docs/01-feed.md` (Comparar treino)

### Indicador de Carrossel
- Dots centralizados logo acima da barra de ações, quando o post tem mais de uma foto

### Barra de Ações "Glass" (rodapé da foto)
| Elemento | Posição | Componente |
|---|---|---|
| Incentivos (6 tipos) | Esquerda | `PostIncentiveButton` |
| Contagem de incentivos | Direita (antes do separador) | Abre `PostLikesModal` |
| Comentários | Direita | `PostCommentsDialog` |

> **2026-07-16:** o botão de avião de papel ("enviar para", adicionado em 2026-07-12) foi **removido da barra de ações**. O envio por mensagem privada (prefixo `[post]:<postId>`) agora é alcançado por ⋮ → **Compartilhar** → **Amigos**, igual ao feed.

Fundo com efeito vidro (`GLASS_ACTION` de `client/lib/post-visuals.tsx`), mesma barra usada no feed.

---

## Carregamento do Post

O post é carregado diretamente pelo `postId` da URL (não depende de já ter a lista de posts do usuário carregada):

```
useParams → postId
  └─ getPostByIdDb(postId)
       ├─ Encontrado → carrega em paralelo: getPostLikesDb, getUserPostLikesDb
       │                (+ getUserGoalByIdDb se houver user_goal_id)
       └─ Não encontrado → toast + navigate(-1)
```

Ao chegar via notificação com `location.state = { openLikes: true }`, o modal de "quem incentivou" abre automaticamente (`flushPendingIncentivesDb` + `getPostLikeUsersDb`) e o state de navegação é limpo para não reabrir em back-navigation. Com `{ openComments: true }`, o `PostCommentsDialog` abre via prop `defaultOpen`.

---

## Estados da Tela

| Estado | Comportamento |
|---|---|
| Carregando | `PostDetailSkeleton` |
| Post não encontrado | Toast de erro + volta para a tela anterior |
| Post encontrado | Exibe conteúdo completo |

---

## Dados Carregados

| Dado | Função DB |
|---|---|
| Post (inclui `taggedUsers` de `post_tags`) | `getPostByIdDb(postId)` |
| Estatísticas de incentivo | `getPostLikesDb(postId)` |
| Incentivos do usuário logado | `getUserPostLikesDb(postId)` |
| Meta vinculada (se houver) | `getUserGoalByIdDb(post.user_goal_id)` |
| Lista de quem incentivou (sob demanda) | `getPostLikeUsersDb(postId)` |

---

## Observações Técnicas

- Botões de incentivo totalmente funcionais (toggle otimista via `togglePostIncentiveDb`), ao contrário do preview estático de versões antigas desta tela
- O contador de comentários é passado como `0`/`hasActivity: false` para o `PostCommentsDialog` (limitação conhecida — a tela não busca a contagem real de comentários ao carregar)
- Redirecionamento automático (`navigate(-1)`) se o post não for encontrado ou houver erro ao carregar
- Estilos "glass" (`GLASS_TOP`, `GLASS_ACTION`, gradiente de fallback, truncamento de legenda) centralizados em `client/lib/post-visuals.tsx` e compartilhados com `PostCard` — qualquer ajuste visual deve ser feito lá para manter feed e detalhe consistentes
