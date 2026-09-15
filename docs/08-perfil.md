# Tela: Perfil

> **Recorte v1.0** (ver [20-lancamento-v1.md](./20-lancamento-v1.md)):
> - Só a aba **Publicações** aparece (`FEATURES.profileExtraTabs`). Treinos,
>   Clipes, Marcações e Vitrine ficam guardadas — quatro abas vazias num perfil
>   recém-criado são o sinal mais forte de app abandonado que existe.
> - **O split `feedPosts` / `workoutPosts` é desativado junto.** Ele existe para
>   alimentar a aba "Treinos"; sem ela, filtrar os posts de canvas os faria
>   sumir do perfil inteiro — o usuário publica e o post não aparece em lugar
>   nenhum. Com a flag desligada, "Publicações" volta a receber tudo.
> - O **frame de perfil comercial** também some (`FEATURES.store`): sem a
>   Vitrine, ele anuncia um negócio que não tem para onde levar.
> - **Novo: botão "..." no perfil de outro usuário** → `UserSafetyDrawer`, com
>   **Denunciar** e **Bloquear**. Até então o perfil era a única superfície do app
>   sem nenhuma das duas ações — e é exatamente onde o revisor da Apple procura.
>   Depois de bloquear, a tela volta para a anterior.
> - **Perfil de alguém bloqueado é uma tela à parte (14/09/2026).** Antes o
>   perfil abria inteiro — posts, abas, contagens, flows — com os botões de
>   **seguir, mandar mensagem, compartilhar e bloquear** como se nada tivesse
>   acontecido, contradizendo o que a própria confirmação de bloqueio promete
>   ("vocês não vão mais ver ... nem o perfil um do outro"). Agora `Profile.tsx`
>   tem um `return` próprio para esse caso, com avatar, nome e um aviso; nenhuma
>   ação de contato sobrevive.
>   - A checagem roda no **batch 0** de `loadProfile`, antes de tudo: com
>     bloqueio, os ~12 selects de conteúdo nem são disparados
>   - **A frase depende da direção.** "Eu bloqueei" → nomeia o que houve e
>     oferece **Desbloquear** (`BlockUserDialog mode="unblock"`), e o "..."
>     também vira "Desbloquear" (`UserSafetyDrawer blockedByMe`). "Ele me
>     bloqueou" → **"Perfil indisponível"**, sem dizer o motivo: confirmar isso
>     entregaria uma decisão que o app não revela em nenhuma outra tela
>   - O "..." continua acessível nos dois casos — denunciar quem me bloqueou é
>     legítimo, e bloquear de volta é a única ponta que este usuário controla
> - **Novo: Configurações → Contas bloqueadas** (`BlockedAccountsDrawer`).
>   Como o bloqueado some de todas as outras superfícies, essa lista é o único
>   lugar de onde é possível desbloquear.
> - **Novo: Configurações → Outros → Termos de Uso / Política de Privacidade.**
>   Os dois links só existiam dentro do paywall; sem ele sumiriam do app
>   inteiro, e a Apple exige a política acessível de DENTRO do app. Com o
>   paywall apagado (07/09/2026), esta é a única casa deles.
> - **Insígnias desligadas** (`FEATURES.badges`) — some a fileira ao lado do
>   nome, no perfil e no post viewer. A guarda está dentro do `UserInsignias`,
>   então o card do feed e a conversa privada caem juntos.
> - **Histórico de peso** sai de Dados pessoais (`FEATURES.weightTracking`); o
>   campo de peso permanece, porque alimenta a prescrição da rotina sugerida.
> - A seção **Assinatura** de Configurações foi **removida em 07/09/2026**,
>   junto com todo o código de compras — o app não vende nada e não há o que
>   gerenciar (`docs/17-premium.md`).

**Rota:** `/perfil` (próprio) | `/usuario/:userId` (outro usuário)
**Arquivo:** `client/pages/Profile.tsx`
**Layout:** AppLayout
**Tamanho:** ~1.850 linhas (após a remoção do código morto da antiga aba Rotinas em 2026-07)

---

## Objetivo

Página de perfil do usuário. Exibe informações pessoais, estatísticas, conteúdo publicado (posts, shots, rotinas) e configurações. Quando visualizado por outro usuário, exibe opções de interação social (seguir, mensagem).

---

## Estrutura Visual

```
┌──────────────────────────────────┐
│  Banner do perfil                │
│  [Avatar]  [Nome]  [Stats]       │
│  [Bio]                           │
│  [Seguir] [Mensagem] [Editar]    │
│  Insignias / Badges              │
├──────────────────────────────────┤
│  🎯 Metas (scroll horizontal)    │  ← condicional: só aparece se há metas públicas
├──────────────────────────────────┤
│  Tabs: [Posts][Treinos][Shots]   │  ← + [Marcações] e [Vitrine] (esta só se
│         [Marcações][Vitrine]     │    há ofertas ativas; a linha rola)
├──────────────────────────────────┤
│  Conteúdo da Tab ativa           │
└──────────────────────────────────┘
```

---

## Cabeçalho do Perfil

> **Atualização (Glass design):** O cabeçalho foi equalizado ao design "LinKa Glass".
> - **Banner gradiente** no topo: `radial-gradient(120% 100% at 60% 0%,#d8567a,#7b3ff2 55%,#1a1438 90%)` com fade para `#06070c`.
> - **Avatar à esquerda** (88px) com anel `conic-gradient(from 200deg,#ff8a2a,#d8567a,#7b3ff2,#3a8dff,#ff8a2a)` e borda interna `3px solid #06070c`.
> - **Ações à direita** na mesma linha do avatar: próprio perfil → botão circular de engrenagem (42px) + pílula branca "Editar perfil"; outro perfil → `FollowButton` + botões circulares de mensagem e compartilhar.
> - **Nome/handle/bio alinhados à esquerda** (nome 21px peso 740, handle 13px branco .5, bio 13.5px branco .82).
> - **Stats em 3 cards** (Posts, Seguidores, Seguindo) com `rounded-18px`, fundo `rgba(255,255,255,.05)`, número 17px peso 740.
> - **Tabs em estilo underline** (transparente, indicador `border-b-2` branco no ativo) em vez do `TabsList` boxed. Com as abas **Treinos** e **Marcações** são até 5 abas, que não cabem na largura do iPhone — o `TabsList` ganhou `overflow-x-auto no-scrollbar` (gap reduzido para `gap-5`) e cada `TabsTrigger` é `shrink-0 whitespace-nowrap`, então a linha **rola na horizontal** em vez de comprimir/quebrar os rótulos.
>   **O scroll é condicional desde 2026-09-14** (`visibleTabCount > 1`): no recorte v1 sobra só "Publicações", e a faixa continuava arrastando / dando rubber-band no WKWebView sem ter nada escondido — uma tira que se mexe à toa parece defeito. Com uma aba só não se declara overflow nenhum (e não `overflow-hidden`, que recortaria o sublinhado da aba ativa, desenhado com `-mb-px` por cima da borda da lista). Religar as flags devolve o scroll sozinho. `visibleTabCount` fica logo antes do `return` e precisa ser atualizado junto com qualquer aba nova.
> - **Grids de posts/shots** em 3 colunas, `gap-[5px]`, itens `rounded-[14px]`.
> - **Back chip** circular no topo-esquerdo apenas ao visualizar o perfil de outro usuário.
> - O trigger do `SettingsDrawer` agora é externo (props `open`/`onOpenChange`/`hideTrigger`); a engrenagem e o botão "Editar perfil" abrem o mesmo drawer.

### Foto e Banner
- **Banner:** por padrão é um gradiente colorido radial. No próprio perfil, dois botões circulares "glass" no canto superior direito permitem personalizá-lo:
  - **Editar capa** (ícone `ImagePlus`) → abre seletor de imagem → `ImageCropperDrawer` (aspecto 16/9) → upload para o bucket `posts` (`covers/{userId}-{timestamp}.jpg`) → salvo em `profiles.cover_photo` via `updateUserProfileDb`
  - **Remover capa** (ícone `Trash2`, só aparece quando há capa) → confirmação → volta ao gradiente padrão (`cover_photo = null`)
  - Quando `profile.cover_photo` está preenchido, a imagem (via `ImageWithFallback`, `object-cover`, altura 210px) substitui o gradiente; o fade inferior para `#06070c` é mantido para legibilidade do texto
  - Botões visíveis apenas no próprio perfil; no perfil de outro usuário a capa é somente exibida
- **Avatar:** foto de perfil circular, clicável para ampliar ou editar

### Informações do Usuário
| Campo | Descrição |
|---|---|
| Nome / Nickname | Nome de exibição. Exibe `VerifiedBadge` (badge dourado) ao lado se `is_verified = true` |
| Bio | Descrição pessoal |
| Segmentos | Interesses fitness selecionados no onboarding |
| Data de criação | "Membro desde..." |

### Badge de Conta Verificada
- Componente: `client/components/shared/VerifiedBadge.tsx`
- Aparece ao lado do nome no header do perfil quando `profile.is_verified === true`
- Também aparece em: post-card (overlay do autor), comentários, shots (overlay do criador), notificações (sobre o avatar)
- Gerenciado pelo admin via tela Admin → seção "Contas Verificadas"
- Coluna no banco: `profiles.is_verified` (boolean, default false)

### Frame de Perfil Comercial (se `commercialProfile` existe)
- Nome do negócio (clicável via WhatsApp se tiver telefone)
- Badge de segmento
- Link para website
- Ícone `ListChecks` com contagem de planos → clicável → abre **Modal de Planos e Preços**
  - Lista cada plano com nome, preço e descrição
  - Visível para qualquer visitante do perfil

### Estatísticas (Stats)
| Stat | Descrição | Clicável |
|---|---|---|
| Posts | Total de publicações | Não |
| Shots | Total de clipes | Não |
| Seguidores | Quem segue o usuário | Sim → abre lista |
| Seguindo | Quem o usuário segue | Sim → abre lista |
| Pontos | Pontuação acumulada | Não |
| Sequência | Dias consecutivos de check-in (streak) | Não |

### Botões de Ação

**Perfil próprio:**
- `Editar perfil` → Drawer de edição
- `Configurações` → Drawer de configurações

**Perfil de outro usuário:**
- `Seguir` / `Seguindo` → toggle via `followUserDb` / `unfollowUserDb`
- `Mensagem` → navega para `/comunidade` com conversa aberta

---

## Insignias / Badges

Componente: `UserInsignias`

Exibe conquistas e badges desbloqueadas pelo usuário:
- Baseadas em pontuação, streak, número de posts, etc.
- Exibidas como ícones coloridos abaixo da bio

---

## Tab: Posts

Grade de imagens dos posts do usuário — **exceto** os resumos de treino sem foto do usuário, que vivem na aba **Treinos** (ver abaixo).

> **Contagem no rótulo (26/08/2026):** `Posts (n)` passou a usar `feedPosts.length` (a lista já filtrada) em vez de `stats.postsCount`. O card de stats do cabeçalho continua mostrando o total de publicações — `Posts (n) + Treinos (n)` é que fecha com ele.

**Layout:** Grid 3 colunas (mobile) / 4–6 colunas (telas maiores), `gap-[5px]`, itens `rounded-[14px]`

Cada post na grade:
- Thumbnail da primeira imagem (`loading="lazy"` + `decoding="async"` — até 100 posts não carregam todos de uma vez)
- Ao clicar → abre o post no drawer (Post Viewer)

**Menu de contexto (próprio perfil apenas):**
- `Editar` → Drawer com textarea para editar descrição
- `Excluir` → AlertDialog de confirmação

**Ao expandir um post:**
- Ao salvar uma edição, o `selectedPost` local também é atualizado — a descrição/meta novas aparecem imediatamente no modo visualização (antes ficava o texto antigo até reabrir)
- Ao excluir, o post sai da lista `posts` (e com ela do rótulo da aba Posts **ou** da aba Treinos, conforme o caso), o contador de stats é decrementado localmente e o cache `userPosts`/`userStats` é invalidado no banco (`deletePostDb`)
- Incentivos são **não-bloqueantes**: o toque atualiza a UI na hora (optimistic) e a escrita/refetch rodam em segundo plano com guard de sequência — os 6 botões não ficam mais desabilitados durante o toggle
- O contador de comentários é sincronizado em tempo real via prop `onCountChange` do `PostCommentsDialog`
- Carrossel de imagens (`PostCarousel`)
- Descrição — truncada em até 30 caracteres ou 1 linha; exibe `...` + botão clicável **"mais"** (chave i18n `feed_description_more`) para expandir o texto completo, e botão **"menos"** (`feed_description_less`) para recolher. Estado de expansão é resetado ao abrir um novo post
- **Pill "Ver treino"** (`WorkoutDetailButton`) — só em posts de **resumo de treino** (com `workout_summary`), abaixo da descrição em modo visualização. Abre o drawer simplificado com a lista de exercícios (miniatura + grupo + séries em chips `{kg}kg × {reps}`; mesmo componente do feed/PostDetail). Ver `docs/01-feed.md` (Detalhe do treino)
- **Botão "Comparar com o meu treino"** — **dentro** desse mesmo drawer, acima da lista de exercícios, **só em posts de outra pessoa** (some nos meus). Troca o conteúdo do sheet pelo confronto exercício a exercício com a minha última execução de cada exercício. Ver `docs/01-feed.md` (Comparar treino)
- Botões de incentivo interativos (`PostIncentiveButton` × 6 tipos) — visíveis em modo visualização e edição
- Botão comentários (`PostCommentsDialog`) — visível apenas em modo visualização (oculto ao editar)
- Contador de incentivos clicável → abre `PostLikesModal`

---

## Tab: Treinos

Grade dos **cards de resumo de treino** publicados pelo usuário — os canvas gerados pelo `WorkoutSummaryOverlay` (ver `docs/05-metas.md`) ao terminar um treino.

**Por que a aba existe (26/08/2026):** o resumo de treino é o post mais frequente de quem usa o app com constância, e ele afogava as fotos de verdade na aba Posts. Separando os dois, a aba **Posts** volta a ser o álbum de fotos da pessoa e a **Treinos** vira o histórico visual do que ela treinou.

**Critério de separação** (`isWorkoutCanvasPost`, em `client/lib/workout-summary-types.ts`):

| Post | Aba |
|---|---|
| Resumo de treino, **só o card gerado** (com ou sem o mapa da corrida GPS) | **Treinos** |
| Resumo de treino **com foto da galeria/câmera anexada** | Posts |
| Post comum (foto/texto), sem `workout_summary` | Posts |

O que decide é o campo **`userPhotoCount`** do `posts.workout_summary` — quantas fotos **da pessoa** entraram no post (o card gerado e o mapa do trajeto **não** contam), gravado por `buildPostWorkoutSummary` no momento do compartilhamento. Para posts publicados **antes de 26/08/2026** (sem o campo) vale um fallback baseado na **ordem** em que o overlay monta as URLs — fotos do usuário → mapa → canvas: se a **primeira** imagem do post é o próprio canvas (`workout_summary.imageUrl`), não havia foto do usuário. Consequência conhecida: um resumo **antigo** de corrida com mapa começa pelo mapa e permanece na aba Posts (degradação graciosa; resumos novos caem na aba certa).

**Layout:** mesmo grid das outras abas — 3 colunas (mobile) / 4–6 (telas maiores), `gap-[5px]`, itens `rounded-[14px]`

Cada item na grade:
- Thumbnail = **`workout_summary.imageUrl`** (o card gerado), com fallback para `post.photo`. Usar o `imageUrl` em vez da primeira foto importa nas corridas com GPS, em que a primeira imagem do post é o **mapa do trajeto** — a aba mostraria um mapa onde deveria mostrar o card
- Sem indicador de carrossel: o post pode ter 2 imagens (mapa + card), mas as duas são geradas pelo app
- Ao clicar → abre o **mesmo** Post Viewer da aba Posts (`handleViewPost`), com o pill "Ver treino" e todos os incentivos/comentários

**Privacidade:** mesma regra das abas Posts, Shots e Marcações — com `hide_posts_from_non_followers` ligado, um não seguidor vê o estado bloqueado ("Publicações privadas" + cadeado).

**Sem query nova:** as duas listas são derivadas (`React.useMemo`) do mesmo `getUserPostsDb` do batch 1, então editar/excluir um post continua atualizando as duas abas de uma vez e a contagem `(n)` aparece junto com a tela (não espera o batch 2, como Shots e Marcações).

**Estado vazio:** "Nenhum treino publicado ainda." (`profile_no_workouts`).

---

## Tab: Vitrine

Exibida automaticamente quando o usuário possui ofertas ativas (`profileOffers.length > 0`). Visível tanto no próprio perfil quanto no perfil de outros usuários.

**Layout:** Grid 2 colunas

Quando o usuário tem `commercialProfile`, exibe um banner do negócio no topo com um ícone clicável de planos (se `servicePlans.length > 0`) que abre um modal listando todos os planos e preços cadastrados:
- Logo do negócio (`business_logo_url`)
- Nome e segmento comercial
- Link para website (ícone `ExternalLink`)

Cada card de oferta exibe:
- Imagem do produto
- Cupom (se preenchido)
- Preço
- Botão "Comprar" → abre `link_url` e chama `incrementOfferClickDb`

**Dados carregados:** `getCommercialOffersByUserIdDb(profileUserId)` no batch 2, filtrado por `is_active`

---

## Tab: Shots

Grade de thumbnails dos clipes do usuário.

**Layout:** Grid 3 colunas (mesmo grid dos posts), itens quadrados

**Privacidade:** se o dono ativou **Ocultar posts de quem não te segue** (`hide_posts_from_non_followers`), a aba exibe um estado bloqueado ("Clipes privados" + cadeado) para não seguidores — mesma regra e condição da aba Posts. Ver "Drawer de Privacidade".

Cada shot na grade:
- **Preview do frame do vídeo** via o componente **`ShotThumb`** (`client/components/shared/shot-thumb.tsx`), compartilhado com as grades de Busca e Hashtag. Ele encapsula duas coisas:
  - o `src` passado por **`videoPosterSrc()`** (`client/lib/video-thumb.ts`, anexa `#t=0.1`) — o media fragment força o WebView a fazer *seek* e **pintar** esse frame como thumbnail. Sem ele, `preload="metadata"` sozinho deixa o `<video>` preto no WKWebView do iOS até dar play. Mesmo helper usado na bolha de chat compartilhado e no arquivo de flows — ver `docs/15-design-system.md` §7.4
  - o **ciclo de vida do player de vídeo do iOS**: anexa o `src` só quando a célula chega perto da viewport e o **libera** (`releaseVideoElement`) ao sair dela e ao desmontar. Sem isso, uma grade com muitos shots estourava o teto de players simultâneos do WKWebView e o shot aberto em tela cheia entrava **sem imagem, só com o áudio** — ver `docs/03-shots.md`, "Teto de players de vídeo do iOS"
- Glyph de **play** central (`Play`, `pointer-events-none`) sobre o tile, sinalizando que é um vídeo clicável
- Ao clicar → navega para `/shots` com o shot aberto (que é movido para o topo da lista — ver `docs/03-shots.md`)
- O rótulo da tab só mostra a contagem `(n)` depois que o batch 2 termina (evita o flicker "Shots (0)")

**Botão de edição (próprio perfil apenas):**
- Botão de engrenagem **sempre visível** no canto do tile (antes era `opacity-0 group-hover` — invisível no iOS, onde não há hover) → abre `ShotEditorDrawer` (editar descrição / excluir)

---

## Tab: Marcações

Grade das publicações **de outras pessoas** em que o dono do perfil foi marcado (tabela `post_tags`, criada em `docs/migrations/20260710-post-tags.sql` — ver `docs/04-novo-post.md` para o fluxo de marcação).

> Exemplo: A publica uma foto no feed e marca B nela. No perfil de **B**, essa publicação de **A** aparece na aba Marcações. A aba nunca lista posts do próprio dono do perfil — ninguém pode se marcar (`createPostDb`/`setPostTagsDb` filtram o próprio id).

**Layout:** Grid 3 colunas (mesmo grid dos posts), `gap-[5px]`, itens `rounded-[14px]`

Cada item na grade:
- Thumbnail da primeira imagem (`loading="lazy"` + `decoding="async"`)
- Indicador de carrossel (📷 + contagem) quando o post tem mais de uma foto — igual à aba Posts
- **Chip do autor no rodapé do tile** (avatar 16px + nickname sobre um gradiente preto). Diferente das abas Posts e Shots, a foto **não é do dono do perfil** — sem o chip não dá para saber de quem é a publicação sem abri-la
- Ao clicar → abre o **mesmo** Post Viewer da aba Posts (`handleViewPost`)

**Privacidade:** segue a mesma regra das abas Posts e Shots — com `hide_posts_from_non_followers` ligado, um não seguidor vê o estado bloqueado ("Marcações privadas" + cadeado).

**Contagem no rótulo:** `Marcações (n)` só aparece depois que o batch 2 termina (`tabsDataLoaded`), evitando o flicker "(0)".

### Dono do post ≠ dono do perfil (Post Viewer)

O Post Viewer é compartilhado com a aba Posts, mas um post de Marcações pertence a **outra pessoa** — inclusive no próprio perfil. Por isso as permissões do drawer deixaram de usar `isViewingOtherProfile` (dono do **perfil**) e passaram a usar `isOwnSelectedPost` (`selectedPost.user_id === user.id`, dono do **post**):

| Elemento | Antes | Agora |
|---|---|---|
| Botões Editar / Excluir | `!isViewingOtherProfile` | `isOwnSelectedPost` |
| `isPostOwner` do `PostCommentsDialog` (moderação de comentários) | `!isViewingOtherProfile` | `isOwnSelectedPost` |

Incentivos e comentários continuam liberados normalmente (é um post público como qualquer outro do feed).

### Pessoas marcadas no Post Viewer

O chip "com fulano" / "com fulano e mais N" (mesmo padrão visual do `post-card.tsx` do feed, ícone `UsersRound`) aparece no Post Viewer sempre que `selectedPost.taggedUsers` não está vazio — 1 pessoa navega direto ao perfil dela, 2+ abre um `FollowListDrawer` com a lista completa (título "Pessoas marcadas"). Antes de 2026-08-17, `getUserPostsDb` e `getTaggedPostsDb` não buscavam `post_tags`, então a marcação feita no feed (que usa `post.service.ts`, já batelado) sumia ao abrir o mesmo post pelo perfil (aba Posts ou aba Marcações) — as duas funções agora chamam `getPostTagsBatchDb` em lote, igual ao feed.

### Meta vinculada no Post Viewer

O chip "Meta: {descrição}" (fora do modo de edição) usa `selectedPost.userGoal` — um objeto batelado por `getPostGoalsBatchDb` (mesma query/shape de `post.service.ts`), que só existe quando a meta está pública (`visibility === 1`). Funciona para post de **qualquer** autor, inclusive na aba Marcações. Existia um bug duplo antes de 2026-08-17: `getUserPostsDb` selecionava `user_goal_id` do banco mas **descartava o campo ao montar o objeto de retorno**, então até o post do próprio dono do perfil (aba Posts) ficava sem o chip; e o guard `selectedPost.user_id === profileUserId` escondia o chip inteiro em qualquer post de outro autor (aba Marcações), mesmo com meta pública.

Como `getPostGoalsBatchDb` só retorna metas públicas (para bater com o comportamento do feed, que esconde meta privada até do próprio autor rolando o feed), o Post Viewer mantém um **fallback** só para o post do próprio dono do perfil: se `selectedPost.userGoal` vier vazio mas `selectedPost.user_id === profileUserId`, cai para `userGoals.find(...)` — a lista completa (sem filtro de visibilidade) do dono, carregada no batch 2. Isso preserva o que só faz sentido pro próprio dono olhando o próprio post: ver uma meta que ele mesmo marcou como privada.

**Meta apagada esconde o chip.** Se nem o batch nem o fallback devolvem uma descrição, o `user_goal_id` é uma referência órfã — a meta foi excluída. Desde 2026-09-14 o bloco inteiro **não é renderizado** nesse caso, e o post aparece como se nunca tivesse tido vínculo. Antes disso o chip exibia "Meta removida" (chave `profile_goal_removed_label`, hoje removida do `i18n.ts`), um rótulo sem ação possível: não há meta para abrir nem progresso para ver.

---

## ~~Tab: Rotinas~~ (removida)

A aba Rotinas foi **removida do perfil** — a gestão de rotinas vive na tela de Metas (`docs/05-metas.md`). Em 2026-07 o código morto correspondente (~1.000 linhas de JSX desativado com `{false && ...}`, estados e handlers de criação de rotina/histórico de treino) foi excluído do `Profile.tsx`.

As rotinas ainda são carregadas no batch 2 (`getUserRoutinesDb`) porque alimentam o `GoalDetailDrawer` (vincular/desvincular rotinas a uma meta pela strip de metas).

---

## Drawer de Edição de Perfil (próprio)

Aberto pelo botão "Editar perfil":

| Campo | Tipo |
|---|---|
| Nome / Nickname | Input |
| Bio | Textarea |
| @ Usuário | Input (apenas letras, números, _ e ., máx. 30) → salvo em `profiles.handle` — com verificação de disponibilidade, ver abaixo |
| Objetivos | Botões de seleção múltipla (mesmos do onboarding) → salvo em `profiles.objectives` |
| Foto de perfil | Upload de imagem |
| Banner | Upload de imagem |
| Segmentos de interesse | Checkbox múltiplo |

Botão "Salvar" → `updateUserProfileDb`

### Troca do @usuário (validação)

Editar o handle aqui passa pela **mesma validação do cadastro** (`Login.tsx`, etapa 2), com dois acréscimos: o próprio perfil é ignorado na checagem e a troca é confirmada antes de gravar.

**Verificação de disponibilidade** — `checkHandleExistsDb(handle, userId)` (RPC `check_handle_exists`, `SECURITY DEFINER`), com debounce de **500ms**, só enquanto a aba "Público" do editor está aberta. O `userId` vai como `p_exclude_user`: manter o próprio @ não conta como colisão, então quem não mexe no campo salva normalmente.

| Estado do campo | Retorno visual |
|---|---|
| Handle igual ao atual | Nenhum — sem checagem, sem aviso |
| Menos de 3 caracteres | `settings_handle_too_short` |
| Consultando | `settings_handle_checking` |
| Ocupado | Borda vermelha + `settings_handle_taken` |
| Livre | Borda verde + `settings_handle_available` |

**Aviso de perda do @ antigo** — assim que o campo difere do handle atual (e já havia um handle), aparece um bloco âmbar com `AlertTriangle` informando que ninguém mais encontrará o usuário por `@{antigo}`, e que buscas e links antigos param de funcionar.

**Travas no salvar** (`handleSaveProfile`):

1. Botão "Salvar" desabilitado enquanto o handle novo não voltar como disponível (checando ou ocupado)
2. Toasts de bloqueio: muito curto, ainda verificando, já em uso
3. **Diálogo de confirmação** (portal para `document.body`, `z-[10000]`, mesmo visual do delete de flow) repetindo a consequência da troca — só aparece quando já existia um handle; quem ainda não tinha grava direto
4. `persistProfile()` grava `handle` sempre em **minúsculo**, casando com o índice único do banco e com o que o cadastro escreve

**Corrida na gravação** — se alguém tomar o @ entre a checagem e o save, o Postgres devolve `23505`; `updateUserProfileDb` agora anexa `code: "HANDLE_TAKEN"` ao erro, e o drawer reconhece esse código para remarcar o campo como indisponível e mostrar o toast traduzido (antes dependia da mensagem hardcoded em PT).

---

## Drawer de Configurações (próprio)

Aberto pelo botão "Configurações". O menu é organizado em seções com separadores:

### Linhas da lista (`SettingsRow`)

Todo item da lista é um **`SettingsRow`** — componente local do `settings-drawer.tsx` (rótulo à esquerda, ícone à direita, `rounded-2xl`, vidro `bg-white/[.06]` + borda `border-white/10`).

Antes cada item era um `<Button variant="outline">`. Isso trazia dois problemas de sensação "web" no iPhone (reportados em 13/08/2026):

1. **Linha acesa como se houvesse um cursor parada nela.** O `variant="outline"` carrega `hover:bg-accent`; no WKWebView o `:hover` do toque é grudento — arrastar o dedo pela lista ia acendendo cada linha e a última ficava acesa.
2. **Precisar tocar duas vezes.** O primeiro toque num elemento com estilo de hover é gasto aplicando esse hover; o clique só sai no segundo.

A correção tem três frentes (as duas primeiras valem para o app inteiro):

- `future.hoverOnlyWhenSupported: true` no `tailwind.config.ts` — todo `hover:` passa a viver dentro de `@media (hover: hover) and (pointer: fine)`, ou seja, existe no navegador de dev e **não existe no device**;
- regra base em `client/global.css` para `button/[role=button]/a/label/summary`: `-webkit-touch-callout: none`, `user-select: none` e `touch-action: manipulation` (arrastar o dedo não seleciona mais o rótulo, o press longo não abre o menu de copiar e some o atraso do double-tap-zoom). Campos de texto ficam de fora de propósito;
- feedback de toque exclusivamente por `active:` (`active:scale-[0.985]` + `active:bg-white/[.14]`), inclusive no botão de voltar dos sub-drawers (`active:scale-90`) e no botão Sair.

> Ao adicionar um item novo à lista, use `SettingsRow` — não volte a usar `Button variant="outline"`, que reintroduz o fundo opaco do tema sobre o vidro.

### Seção: Perfil

| Configuração | Tipo | Descrição |
|---|---|---|
| Meu Perfil | Botão → Drawer aninhado com abas | Drawer unificado com duas abas: **Público** (foto, nome, bio, handle) e **Pessoal** (sexo, altura, peso, idade, objetivos). O campo **Peso** tem ao lado um botão **"Histórico"** (ícone `LineChart`) — ver abaixo |
| Conta e Segurança | Botão → Drawer aninhado | Email (editável — ver abaixo), redefinir senha e zona de perigo (encerrar conta) |

#### Encerrar conta (`handleDeleteAccount`)

Exige digitar a palavra de confirmação (`profile_close_account_confirm_word`) e chama `deleteAllUserDataDb`, que roda **três etapas, nesta ordem obrigatória**:

| # | Etapa | Onde | Por que nessa ordem |
|---|---|---|---|
| 1 | `purgeUserStorageDb` | cliente | A policy de DELETE do Storage depende de `auth.uid()`. Depois que a conta sai de `auth.users` não há sessão para provar posse e o arquivo fica órfão para sempre. |
| 2 | `delete_user_data(p_user_id)` | **RPC no banco** | Uma transação só, `security definer` (ignora RLS). Apaga as linhas **e** `auth.users`. |
| 3 | `POST {SHARE_BASE_URL}/api/delete-auth-user` | servidor | **Só como fallback**: quando o retorno da etapa 2 não traz `"auth.users"`, ou seja, a função não teve privilégio no schema `auth`. |

**A etapa 2 virou função no banco (2026-09-15).** Antes eram ~45 DELETEs disparados do WebView, um por tabela, e isso falhava de duas formas ao mesmo tempo: **DELETE sob RLS é no-op silencioso** (tabela sem policy devolve "0 linhas" sem erro — o cliente logava um `console.error` que ninguém lê no device e seguia como se tivesse apagado) e **a lista atrasava** — conferindo o schema real contra o código, **31 tabelas com coluna de usuário nunca eram tocadas**, quase todas criadas depois da função original (`post_tags`, `flow_tags`, `user_blocks`, `workout_party_members`, `push_tokens`, `user_badges`, `user_weight_logs`, `user_food_logs`, `promotions`, `subscriptions`, `app_admins`, `routines.follower_id`, `diets/habits/workouts.created_by`, …). Toda tabela nova entrava com o mesmo defeito. Ver `docs/migrations/20260915-delete-user-data.sql` — **exige rodar a migração**; sem ela o erro é explícito ("Migração 20260915… não aplicada"), não um PGRST202 críptico.

> ⚠️ Ao criar qualquer tabela com coluna de usuário, acrescente o par `tabela.coluna` ao array `v_targets` de `delete_user_data` **na mesma migração**. É o único lugar a manter.

**Excluir uma conta pelo lado do admin:** `node scripts/delete-user.mjs <uuid>` (dry-run) e `--apply` para valer — faz Storage + linhas + `auth.users` num comando, na mesma ordem do app. Existe porque pelo painel do Supabase seriam dois lugares diferentes e é fácil parar no meio, deixando a conta viva e vazia.

**A falha é reportada (`reportHandledError("profile:delete-account")`), não só exibida em toast (2026-09-14).** A ordem torna isso obrigatório: quando algo quebra depois dos lotes de DELETE e antes do `/api/delete-auth-user`, sobra uma **conta viva e vazia** — a pessoa entra, não vê nada e nem sempre alcança o botão de excluir de novo (o `profiles` já foi apagado). Com `catch` + toast sozinho esse caso era invisível no painel.

#### Troca do email de login (Conta e Segurança) — corrigido em 2026-09-14

A ação falhava **sem dizer por quê**: o `onClick` era inline e terminava em `catch {}` mudo, então qualquer motivo (email já cadastrado, sessão vencida, teto de envio, sem internet) virava o mesmo `"Não foi possível alterar o email."`, sem log e sem chegar ao Sentry — nem pelo painel dava para saber o que tinha acontecido.

Agora é `handleChangeEmail`, com quatro correções:

1. **Checagem antes da rede** — formato via `isValidEmail` e existência via `checkEmailExistsDb` (a **mesma RPC `check_email_exists` do cadastro**). Assim o caso mais comum, tentar migrar para um endereço que já tem conta, responde na hora com o motivo certo, em vez de esperar um 422 genérico do GoTrue.
2. **Cada motivo com sua mensagem** — email inválido, já cadastrado, sessão expirada (401/`session_not_found`: pedir de novo não adianta, precisa entrar de novo), teto de envio (429/`over_email_send_rate_limit` — o SMTP embutido do Supabase é de poucos emails por hora) e offline. O que sobra mostra **a mensagem real do servidor** e chama `reportHandledError("settings:change-email")`, conforme a regra de que `catch` + toast sozinho nunca é capturado.
3. **A mensagem de sucesso deixou de ser um chute.** Antes afirmava sempre "confirmação enviada, verifique seu novo email" — mas o envio do link depende da configuração do projeto, e prometer um email que nunca chega é indistinguível de falha. Agora o resultado é **lido da resposta**: `data.user.email` já trocado → "Email alterado"; `data.user.new_email` preenchido → "Confirmação enviada". Resposta 200 que não reflete nem um nem outro é reportada, não comemorada.
4. **O endereço exibido atualiza.** `userEmail` vem de `user.email` do `auth-context`, onde `setUserIfChanged` só troca o objeto quando muda o **id** (de propósito: um refresh de token não pode invalidar os memos do app inteiro). O efeito colateral é que `USER_UPDATED` não propaga o email novo — a troca dava certo e o campo continuava mostrando o antigo. O drawer guarda o valor em `changedEmail` e usa `currentEmail = changedEmail ?? userEmail`.

O helper `isValidEmail` saiu do `Login.tsx` para `client/lib/ritmofit-db.ts`, ao lado de `checkEmailExistsDb` — as duas telas que aceitam email precisam das duas checagens sempre juntas.

**Destino do link de confirmação (mesma data).** O email que chegava era o template padrão do Supabase apontando para `http://localhost:3000`: sem `emailRedirectTo`, o GoTrue usa a **Site URL** do projeto como destino, e ela estava no valor padrão. A chamada agora passa `emailRedirectTo: EMAIL_CONFIRMED_URL` → `https://linkafit.com.br/email-confirmado` (página estática `public/email-confirmado.html`, que só confirma e devolve ao app pelo custom scheme — a troca em si já aconteceu no `/auth/v1/verify`, antes do redirecionamento). **Exige um passo manual no painel**: a URL precisa entrar na allowlist de Redirect URLs, senão o GoTrue a descarta e volta para a Site URL. Detalhes em `docs/19-compartilhamento-e-deep-links.md`.

#### Troca de senha (Conta e Segurança) — 2026-09-14

Duas falhas de segurança foram corrigidas na mesma entrega:

**1. Não pedia a senha atual.** Qualquer pessoa com o telefone destravado na mão trocava a senha da conta em dois toques — e trocar a senha é justamente o que tranca o dono de fora. O formulário agora abre com o campo **Senha atual**.

Como o Supabase não expõe um "conferir senha", a verificação é um `signInWithPassword` com o e-mail atual da conta: se autentica, a senha confere. A sessão que volta é do **mesmo usuário**, então o `setUserIfChanged` do `auth-context` nem troca o objeto (o id é o mesmo) e nada no app remonta. Um `signInWithPassword` que falha **não** derruba a sessão vigente.

**2. A regra de senha era mais fraca que a do cadastro.** Aqui exigia 6 caracteres; o cadastro exige 8 + maiúscula + caractere especial. Dava para criar a conta com senha forte e, minutos depois, rebaixá-la para `123456` por este drawer. A regra virou **`client/lib/password-rules.ts`**, fonte única para o cadastro, o "salvar nova senha" da recuperação e este formulário — com o mesmo checklist ao vivo (`pwd_rule_min` / `pwd_rule_upper` / `pwd_rule_special`) e o mesmo retorno de "senhas conferem".

`isStrongPassword` é **derivada** de `passwordRules`, então o checklist que o usuário vê e a trava que libera o botão não têm como discordar.

Erros tratados um a um (senha atual em branco, senha atual incorreta, senha fraca, senhas diferentes, nova igual à atual, `same_password` do GoTrue, 429, offline); o que sobra vai para `reportHandledError("settings:change-password")`.

**Efeito colateral tratado — credencial do Face ID.** O login por biometria guarda **email + senha** no Keychain (`client/lib/biometric-auth.ts`). Trocar qualquer um dos dois deixa a credencial obsoleta, e o Face ID passa a falhar com "credenciais inválidas" em silêncio, só na próxima vez que a pessoa tentar entrar:

- **Troca de senha** → `updateBiometricCredentials(email, novaSenha)` regrava a credencial **sem novo prompt de biometria** (a identidade acabou de ser provada pela senha atual).
- **Troca de email** → não temos a senha no fluxo, então não há como regravar: a biometria é **desativada** com aviso (`settings_biometric_reset_title`) pedindo para reativar. Vale também quando a troca fica pendente de confirmação por link, porque o email vai mudar depois, fora do app.

#### Validação de altura, peso e idade (Meu Perfil → Pessoal)

Os três campos eram gravados **sem nenhuma validação** — os atributos `min`/`max` do `<input type="number">` são decorativos, não barram digitação. Pior: as faixas estavam escritas à mão em cada tela e já tinham divergido (Configurações aceitava 30–300 kg e 10–120 anos; o cadastro barrava fora de 20–200 kg e 1–100 anos; o histórico de peso aceitava qualquer coisa até 1000 kg).

As faixas agora vivem em **`client/lib/physical-data.ts`**, fonte única para o cadastro (`Login.tsx`, Step 2.8), este formulário, o quiz de rotina sugerida (`docs/05-metas.md`) e o histórico de peso:

| Campo | Faixa | Chave da mensagem |
|---|---|---|
| Idade | 1 a 100 anos | `physical_age_range` |
| Altura | 100 a 300 cm | `physical_height_range` |
| Peso | 20 a 200 kg | `physical_weight_range` |

São limites de **sanidade, não clínicos**: só barram o que é claramente erro de digitação. Campo vazio nunca é erro — os três dados seguem opcionais em todas as telas.

Comportamento: valor fora da faixa pinta a borda de vermelho, mostra a mensagem abaixo do campo e **desabilita o botão "Salvar"** (`hasPhysicalErrors`); `handleSavePersonalData` repete a trava com toast (`settings_toast_physical_invalid`) para proteger qualquer outro caminho de chamada.

Dois ajustes de digitação vieram junto:

- **Altura e idade** usavam `String(Math.trunc(Number(v)))` no `onChange`, que transformava campo vazio em `"0"` — não dava para apagar a altura depois de preenchida. Agora usam `sanitizeIntInput` (só dígitos), como o cadastro.
- **Peso** virou `type="text"` + `inputMode="decimal"` + `sanitizeDecimalInput` (vírgula→ponto, um separador só). Com `type="number"` o iOS esconde o ponto e devolve `""` em estado intermediário (`"70."`), impossibilitando digitar 70,5 — ver a memória `decimal-number-inputs-ios`. O mesmo vale para o input do histórico de peso e para os campos do quiz.

#### Histórico de peso (Meu Perfil → Pessoal)

Ao lado do rótulo **Peso (kg)** há um botão **"Histórico"** (`LineChart`, chave `settings_weight_history`) que abre o **`WeightHistoryDrawer`** — o **mesmo** componente usado pelo lembrete semanal de peso da tela de Metas (`docs/05-metas.md`), agora em `client/components/shared/weight-history-drawer.tsx`.

Conteúdo do drawer: peso atual em destaque + **variação total** desde o primeiro registro, gráfico de tendência (`TrendChart`, sob `PremiumGate feature="charts"`), input para registrar um novo peso e a lista do histórico (mais recente primeiro) com a **variação em relação ao registro anterior** e ação de excluir.

- Dados: `getWeightLogsDb(90)` / `addWeightLogDb` / `deleteWeightLogDb` (tabela `user_weight_logs`, um registro por dia via upsert)
- Os logs são carregados **só ao abrir** o histórico (a maioria das visitas às configurações não o abre; a função já é cacheada por usuário)
- `addWeightLogDb` também grava `profiles.weight`, então após registrar o campo Peso do formulário é atualizado localmente para não exibir valor defasado
- O input do drawer respeita a **mesma faixa de 20–200 kg** (`isWeightOutOfRange`): antes aceitava qualquer valor abaixo de 1000 kg e, fora disso, `submitWeight` saía em silêncio — nem gravava, nem avisava. Agora a borda fica vermelha, a mensagem aparece e o botão "Registrar" fica desabilitado

### Seção: Negócio *(exibida apenas se o usuário tem perfil comercial)*

| Configuração | Tipo | Descrição |
|---|---|---|
| Gerenciar Perfil Comercial | Botão → Drawer aninhado | Dashboard do negócio com stats e edição |
| Perfil Comercial | Botão → Drawer aninhado | Formulário de criação *(exibido quando não há perfil comercial)* |

### ~~Seção: Assinatura~~ *(removida em 07/09/2026)*

A seção inteira e o `SubscriptionDrawer` foram apagados junto com o código de
compras. O app não vende assinatura nem plano, então não há status, cobrança
nem cancelamento a exibir. Ver `docs/17-premium.md`.

### Seção: Preferências

| Configuração | Tipo | Descrição |
|---|---|---|
| Idioma | Botão → Drawer aninhado | Selecionar pt-BR ou en-US |
| Notificações | Botão → Drawer aninhado | Toggles de treino, conquistas, amigos, mensagens, sons |
| Privacidade | Botão → Drawer aninhado | Dois toggles: **Ocultar seguidores e seguindo** e **Ocultar posts de quem não te segue** |
| Gerenciamento de Tempo | Botão → Drawer aninhado | Limite diário de uso em minutos |
| Personalização | Botão → Drawer aninhado | Trocar layout e tema dark/light |

#### Drawer de Privacidade

Dois toggles que salvam imediatamente em `profiles` via `updateUserProfileDb` (atualização otimista + toast):

| Toggle | Coluna | Efeito |
|---|---|---|
| Ocultar seguidores e seguindo | `hide_follow_lists` | No perfil visto por **outros** usuários, os cards de Seguidores/Seguindo exibem um cadeado e, ao tocar, mostram "Esta lista é privada" em vez de abrir a lista. No próprio perfil continua tudo acessível. |
| Ocultar posts de quem não te segue | `hide_posts_from_non_followers` | As abas **Posts** e **Shots** do perfil só são exibidas a quem **segue** o dono. Para não seguidores aparece um estado bloqueado ("Publicações privadas" / "Clipes privados" + cadeado). O dono e seus seguidores veem normalmente. |

O status de seguimento do visitante é carregado com `isFollowingDb(profileUserId)` no carregamento do perfil. O gating é client-side (consistente com o filtro de visibilidade das metas). Ao tocar em **Seguir/Deixar de seguir**, o `onFollowChange` do `FollowButton` atualiza `viewerFollowsProfile` imediatamente — as abas Posts e Shots destravam/travam na hora, sem precisar recarregar o perfil.

> **Escopo:** o mesmo toggle controla Posts e Shots (mesma condição `hide_posts_from_non_followers && !viewerFollowsProfile`). É um gate **da aba do perfil**, não uma ACL de conteúdo: como já acontece com os posts, um shot desse usuário ainda pode aparecer para não seguidores no feed global de `/shots`, na Busca e nas Hashtags — `getShotsDb` não filtra por esse setting. Bloquear essas superfícies exigiria filtro server-side (fora do escopo desta feature, igual aos posts).

### Seção: Outros

| Configuração | Tipo | Descrição |
|---|---|---|
| Termos de Uso | Botão → `Browser.open` | `linkafit.com.br/termos` |
| Política de Privacidade | Botão → `Browser.open` | `linkafit.com.br/privacidade` |
| **Suporte e contato** | Botão → `Browser.open` | `linkafit.com.br/suporte`. **Sempre visível** (ver abaixo) |
| Arquivo de Flows | Botão → Drawer aninhado | Histórico de flows expirados (> 24h) |
| Relatar um problema | Botão → `ReportProblemDrawer` | Relato manual de bug, enviado ao Sentry. **Só aparece quando `isMonitoringEnabled()`** (ver abaixo) |
| Desconectar | Botão destrutivo | Logout |

**Suporte e contato (2026-09-02):** a linha abre a página de suporte
(`SUPPORT_URL` em `shared/share-config.ts`) e **não depende de variável de
ambiente nenhuma**. Existe porque "Relatar um problema" some do binário quando
falta `VITE_SENTRY_DSN` — e um build assim iria para a loja **sem nenhum canal
de contato dentro do app**, o que é rejeição pelas Guidelines 1.2(d) e 1.5. O
formulário do Sentry passou a ser o extra, não o único caminho. A mesma URL é o
valor obrigatório de **Support URL** na App Store Connect (ver
`docs/21-app-store-connect.md`).

**Relatar um problema (2026-08-05):** abre o `ReportProblemDrawer` (`client/components/shared/report-problem-drawer.tsx`), renderizado **fora** do `<Drawer>` de configurações — mesmo motivo dos overlays do Arquivo de Flows (o `vaul` aplica `transform` no `DrawerContent` e viraria containing block). Recebe `defaultEmail={userEmail}` para pré-preencher o contato.

O botão é condicionado a `isMonitoringEnabled()` (`client/lib/monitoring.ts`): sem `VITE_SENTRY_DSN` configurada o formulário não teria destino, então some da lista em vez de virar UI morta. Ver `docs/13-layouts-e-componentes.md → monitoring.ts` para o restante da captura de erros.

**Arquivo de Flows — compartilhar:** cada flow expirado tem uma ação de compartilhar (`Share2`, tanto no grid quanto no viewer expandido) que abre uma action sheet (`flowToShare`, bottom sheet customizado, `z-[10000]`) com duas opções:
- **Recompartilhar no flow** (`handleRepostToNewFlow`) — cria um novo flow ativo (24h) via `createStoryDb`, reaproveitando `description`, `background_color`, `text_position`, `text_elements` e `media_transform` do flow original.
- **Compartilhar no feed / nos Shots** (`handleRepostFlow`) — mesma lógica de antes: a tabela `posts` só suporta foto (`photo`), então o destino depende do tipo de mídia: foto → `createPostDb` (vira post no feed); vídeo (URL `.mp4`/`.mov`/`.webm`) → `createShotDb` (vira um Shot, já que o feed não renderiza vídeo). O label do botão muda de acordo ("Compartilhar no feed" vs. "Compartilhar nos Shots").

O overlay usa z-index acima do viewer fullscreen do flow (`z-9999`) para funcionar mesmo com o flow expandido aberto, e respeita safe area (bottom) conforme a seção 8 deste guia.

**Arquivo de Flows — excluir:** a ação de excluir (`Trash2`, tanto no grid quanto no viewer expandido) abre uma confirmação (`flowToDelete` + overlay customizado, `z-[10000]`) antes de chamar `deleteStoryDb` — antes o clique excluía direto, sem chance de cancelar. O overlay usa z-index acima do viewer fullscreen do flow (`z-9999`) para funcionar mesmo com o flow expandido aberto, e respeita safe area conforme a seção 8 deste guia.

**Arquivo de Flows — os três overlays (viewer fullscreen, confirmação de exclusão e action sheet de compartilhamento) são renderizados via `createPortal(..., document.body)`**, não como filhos diretos do `DrawerContent`. O `vaul` (biblioteca do Drawer) aplica `transform` no `DrawerContent` durante o swipe/animação, o que vira *containing block* de qualquer `position: fixed` descendente — sem o portal, esses overlays "fullscreen" ficavam confinados à altura do drawer (`maxHeight: 80dvh`) em vez de cobrir a tela inteira, e sobrava um scroll indevido no drawer ao abrir o viewer. Qualquer novo overlay fullscreen adicionado dentro deste drawer deve seguir o mesmo padrão de portal.

**Arquivo de Flows — abertura direta vinda de notificação:** o `SettingsDrawer` aceita a prop `initialArchivedFlow?: StoryWithUser | null`. Quando definida (e o drawer está aberto), pula a lista e chama `setExpandedFlow(initialArchivedFlow)` + `openFlowHistory()` imediatamente — mesmo padrão do `directToProfileEdit`. Usado quando o usuário clica em uma notificação de reação/comentário (tipo 2, 3 ou 6) referente a um **flow próprio que já expirou** (não está mais no ring ativo do feed): `Index.tsx` detecta que o `flowId` não está em `stories`, busca o flow via `getFlowByIdDb(flowId)` (busca por id, sem filtro de dono/data) e, se `flow.user_id === user.id`, navega para `/perfil` com `state.openFlowArchive = flow`. O `Profile.tsx` lê esse state, abre o `SettingsDrawer` (`setSettingsOpen(true)`) e repassa o flow via `initialArchivedFlow`, limpando o state da navegação e o valor ao fechar o drawer. Se o flow expirado pertence a **outro usuário** (ex.: reação a um comentário seu num flow alheio), não há tela de arquivo acessível — exibe apenas um toast (`feed_flow_unavailable`).

**Perfil Comercial (se ativado):**
| Campo | Tipo |
|---|---|
| Segmento do negócio | Input (Select) |
| Nome do negócio | Input |
| Descrição | Textarea |
| Telefone | Input |
| Email comercial | Input |
| Website | Input |
| Logo do Negócio | Upload de imagem → `business_logo_url` |
| Planos e Preços | CRUD inline — máx. 5 planos com nome (obrigatório), preço (opcional) e descrição (opcional) |

Função: `createOrUpdateCommercialProfileDb` — salva `service_plans` como jsonb na tabela `commercial_profiles`.

---

## Modal de Seguidores / Seguindo

Aberto ao clicar nas estatísticas:
- Lista de usuários com avatar e nome
- Botão follow/unfollow para cada um
- Campo de busca para filtrar

---

## Stories do Perfil

- Exibe ring de story ativo no avatar (se o usuário tem story ativo)
- Ao clicar no avatar → abre `FlowViewerModal`
- Apenas stories do próprio perfil são mostrados aqui
- **Abre no 1º flow ainda não visto** (`pickFlowEntry`, `client/lib/flow-entry.ts`): o visitante que já viu os flows antigos vai direto ao novo, em vez de recomeçar do mais antigo. O conjunto de vistos vem de `getMyViewedFlowUserIdsDb` (carregado junto dos stories e ressincronizado ao **fechar** o viewer). No **próprio** perfil nenhum flow conta como visto (`recordFlowViewDb` ignora o dono), então o ring sempre começa do primeiro — igual ao Instagram.
- **Abertura sem espera (`prefetchFlowMedia`):** assim que `getUserActiveStoriesDb` responde, o 1º flow é aquecido em modo `"metadata"` (capa inteira + cabeçalho do vídeo); no `onPointerDown` do ring o modo sobe para `"auto"` e o clipe começa a baixar ~200ms antes do modal montar. Somado à capa (`flow.poster_url`), o flow abre já exibindo o frame.

### Barra de progresso do flow (segmentos)

Um segmento por flow do usuário; o segmento ativo enche conforme o tempo do flow.

| Tipo de flow | O que dirige a barra |
|---|---|
| Imagem / texto | Timer de 8s (`setInterval` de 50ms), só avança depois que a mídia carrega (`mediaReady`) |
| Vídeo | `timeupdate` alimenta o progresso e `ended` avança para o próximo flow. A duração de referência é `flow.duration_ms` (medida no post), **não** o `video.duration` |

**Regras de implementação (vale para `FlowViewerModal` e para a página `FlowViewer`):**

- **Cada `<video>` carrega sua própria identidade**: `data-story-id` (a qual flow pertence) e `data-duration-ready` (a duração finita já foi resolvida). Durante a transição do `AnimatePresence` o vídeo do flow **anterior continua montado e tocando**, então `timeupdate`, `ended`, `error`, `loadeddata` e o `ref` só são aceitos quando `data-story-id` bate com o flow atual (`currentStoryIdRef`, atualizado **no render**, nunca em efeito — os eventos de mídia chegam antes dos efeitos).
- **Nunca guardar o "duração pronta" num ref do componente.** Era a causa do bug com mais de um vídeo: o reset do ref na troca de flow apagava o "pronto" que o vídeo novo já tinha sinalizado no `loadedmetadata`, e a barra ficava travada em 0 para sempre (o `loadedmetadata` só dispara uma vez por elemento).
- **A duração NÃO pode vir do arquivo.** MP4 fragmentado (MediaRecorder do iOS) reporta `duration = Infinity` até o clipe **inteiro** baixar — por isso a barra do 2º flow em diante travava em 0 quando o usuário pulava antes do download terminar. A referência é `flow.duration_ms`, medida no post; `video.duration` só é usado como segunda opção, depois de resolvida.
- Sem `duration_ms` (flows antigos), o seek-trick (`currentTime = 1e101` → volta finito → `currentTime = 0`) resolve e marca `data-duration-ready="1"`. Ele força o download completo e **reinicia o vídeo**, então só roda quando a duração não veio do banco.
- Enquanto o clipe carrega, o `<video>` mostra `poster={story.poster_url}` (capa gerada no post) — a barra continua parada até `mediaReady`, mas a tela já tem o frame em vez de preto.
- Ao trocar de flow, os `video[data-flow-video]` de outros flows são pausados — evita dois áudios sobrepostos e eventos do vídeo antigo por cima do atual.
- No modal, o preenchimento do segmento ativo interpola em `0.28s` para vídeo (o `timeupdate` do iOS chega só ~4x/s) e `0.05s` para imagem (timer de 50ms). A página `FlowViewer` amostra `currentTime` via `requestAnimationFrame` e usa `0.05s`.

---

## Dados Carregados

| Dado | Função DB |
|---|---|
| Perfil do usuário | `getUserProfileDb(userId)` |
| Posts do usuário | `getUserPostsDb(userId)` |
| Shots do usuário | `getUserShotsDb(userId)` |
| Posts em que foi marcado (aba Marcações) | `getTaggedPostsDb(userId)` |
| Estatísticas | `getUserStatsDb(userId)` |
| Seguidores | `getFollowersDb(userId)` |
| Seguindo | `getFollowingDb(userId)` |
| Status de seguimento | `isFollowingDb(userId)` / `getFollowingStatusBatchDb` |
| Rotinas (para o GoalDetailDrawer) | `getUserRoutinesDb(userId)` |
| Metas do usuário | `getUserGoalsByUserIdDb(userId)` |
| Perfil comercial | `getCommercialProfileDb()` |
| Stories ativos | `getUserActiveStoriesDb(userId)` |
| Curtidas do post | `getPostLikeUsersDb(postId)` |
| Comentários do post | `getPostCommentsDb(postId)` |
| Incentivos do usuário no post | `getUserPostLikesDb(postId)` |
| Flows expirados (arquivo) | `getExpiredUserFlowsDb()` |

---

## Strip de Metas Públicas

Exibida entre o card de perfil e as tabs, **apenas quando o usuário tem metas**.

- Scroll horizontal de cards compactos (largura fixa 176px cada)
- Cada card mostra: nome da meta (até 2 linhas) + barra de progresso + percentual
- **Filtragem:** no perfil de outro usuário, apenas metas com `visibility === 1` são exibidas; no próprio perfil, todas as metas aparecem
- **Ordenação (`sortedUserGoals`, `React.useMemo`):** metas **pendentes primeiro**, concluídas (`perc >= 100`) empurradas para o fim da strip. O `sort` do JS é estável, então dentro de cada grupo a ordem original de `getUserGoalsByUserIdDb` é preservada
- **Estado concluído (`perc >= 100`):** o card ganha visual verde para sinalizar a conclusão — fundo `linear-gradient(rgba(34,197,94,.22),rgba(34,197,94,.08))`, borda `rgba(34,197,94,.35)`, barra de progresso `bg-emerald-500` e percentual `text-emerald-400`. O rótulo "Progresso" é substituído por um selo `CheckCircle2` + **"Concluída"** (chave i18n `profile_goal_completed`). Metas pendentes mantêm o card glass branco com barra/percentual `brand`
- Ícone `Target` (Lucide) com label "Metas" como cabeçalho da seção
- Seção completamente oculta se `userGoals.length === 0`
- Tocar num card abre o `GoalDetailDrawer` (`readOnly` no perfil de outro usuário). No **próprio** perfil, metas concluídas exibem lá o botão **"Compartilhar conquista"**, que gera um card em canvas e publica no feed vinculado à meta — ver `docs/05-metas.md` (Compartilhar meta concluída)

---

## Diferenças: Próprio Perfil vs. Perfil de Outro Usuário

| Funcionalidade | Próprio | Outro usuário |
|---|---|---|
| Editar perfil | ✅ | ❌ |
| Configurações | ✅ | ❌ |
| Excluir posts/shots | ✅ | ❌ |
| Editar posts/shots | ✅ | ❌ |
| Botão Seguir | ❌ | ✅ |
| Botão Mensagem | ❌ | ✅ |
| Ver posts | ✅ | ✅ (respeitando privacidade) |
| Ver shots | ✅ | ✅ |
| Ver marcações | ✅ | ✅ (respeitando privacidade) |
| Editar/excluir post aberto na aba Marcações | ❌ (o post é de outra pessoa) | ❌ |
| Ver vitrine (se tem ofertas) | ✅ | ✅ |

---

## Observações Técnicas

- A mesma tela (`Profile.tsx`) é usada para `/perfil` e `/usuario/:userId`
- O hook `useAuth()` determina se é o próprio perfil ou não
- **Header some ao rolar (scroll hide):** igual ao feed/shots/vitrine/comunidade/metas, o header flutuante do `AppLayout` (mobile) se esconde ao rolar para baixo e reaparece ao rolar para cima, controlado pela lista `isScrollHidePage` em `app-layout.tsx`
- **Fecha drawers/modais ao trocar de perfil:** `/perfil` e `/usuario/:userId` renderizam o mesmo componente `Profile.tsx`, então navegar de um perfil para outro (ex.: tocar no nome de um usuário dentro dos comentários/incentivos de um post aberto) **não remonta a tela** — sem tratamento, o drawer do post (ou qualquer outro drawer/modal) permanecia aberto sobre o novo perfil carregado. Um efeito dedicado (`prevProfileUserIdRef`) compara o `profileUserId` anterior com o atual e, quando muda (ignorando a montagem inicial, para não quebrar a abertura do Settings vinda de notificação via `openFlowArchive`), fecha todos os drawers/modais: post, likes, shot, story, histórico de treino, exclusão de rotina, seguidores/seguindo, meta, planos, configurações e compartilhamento
- **Guard de corrida no `loadProfile`:** como o componente fica montado ao navegar entre perfis, loads concorrentes podem resolver fora de ordem. Um contador (`loadSeqRef`) garante que só a requisição mais recente grava estado — a mais antiga é descartada silenciosamente
- **Batch 2 não é fatal:** se o batch 1 (perfil/stats/posts) sucede e o batch 2 (rotinas/metas/shots/comercial) falha, a tela permanece com o perfil carregado e só exibe um toast — antes a tela inteira era trocada pela tela de erro. `profileError` também é resetado no início de todo load
- **Pull-to-refresh imperativo:** o gesto atualiza o indicador direto no DOM via refs (sem `setState` por `touchmove`, que re-renderizava a árvore inteira a ~60fps). Ao soltar, o refresh é **soft** — invalida os caches e recarrega mantendo o conteúdo atual na tela, sem voltar ao skeleton
  - **Não dispara a partir de drawers/dialogs abertos (corrigido 2026-07-20):** os handlers de touch ficam no `<div>` raiz do perfil. Drawers (vaul) e dialogs (Radix) são portados para `document.body` (`DrawerPortal`), mas continuam **filhos na árvore React** — então o swipe para fechar um drawer borbulhava pelos **eventos sintéticos** do React até o `onTouchStart` do perfil e disparava o pull-to-refresh por baixo. O guard `if (!e.currentTarget.contains(e.target as Node)) return;` ignora todo gesto cujo alvo real esteja fora do container do perfil (i.e., dentro de qualquer portal). Cobre vaul, Radix e overlays via `createPortal` sem depender de atributos internos de cada biblioteca
- Imagens de banner e avatar são hospedadas no Supabase Storage

### Cache de Dados

O perfil não é uma tela que muda com frequência, então as queries de carregamento usam o cache genérico `cached()` de `ritmofit-db.ts` (memória + `localStorage`, padrão stale-while-revalidate) em vez de buscar do zero a cada entrada na tela:

| Dado | Chave de cache | TTL |
|---|---|---|
| `getUserProfileDb` | `userProfile:{userId}` | 5 min (`CACHE_TTL_LONG`) |
| `getUserStatsDb` | `userStats:{userId}` | 30s |
| `getUserPostsDb` | `userPosts:{userId}` | 30s |
| `getUserShotsDb` | `userShots:{userId}` | 30s |
| `getTaggedPostsDb` | `taggedPosts:{userId}` | 30s |
| `getCommercialProfileDb` | `commercialProfile:{userId}` | 30s |
| `getUserActiveStoriesDb` | `userActiveStories:{userId}` | 60s |
| `isFollowingDb` | `isFollowing:{viewerId}:{followingId}` | 30s |

- Ao reentrar na tela dentro do TTL, os dados vêm da memória sem round-trip de rede. Após o TTL expirar (mas dentro de 24h), o valor persistido em `localStorage` é exibido imediatamente enquanto uma atualização roda em segundo plano — por isso a tela nunca fica "travada" esperando a rede em revisitas.
- `updateUserProfileDb` chama `invalidateProfileCache(userId)` para garantir que uma edição de perfil não fique presa ao cache antigo.
- **`deletePostDb` invalida `userPosts`, `post:` e `userStats:{userId}`; `updatePostDb` invalida `userPosts` e `post:`** — a invalidação roda ANTES do `return` (bug corrigido em 2026-07: as chamadas estavam depois do `try/catch` com `return`, código inalcançável, e o post excluído "ressuscitava" do cache ao reentrar no perfil).
- **`taggedPosts` é invalidado por prefixo** (todos os usuários, não só o viewer) em `createPostDb` (quando o post nasce com marcações), `setPostTagsDb` (quando o diff de marcações não é vazio) e `deletePostDb` — a lista afetada é a de **quem foi marcado**, e o cliente que faz a escrita não sabe qual perfil está em cache.
- **`getDisplayBadgeDb` (`displayBadge:{userId}`) e `getTotalCheckInsDb` (`totalCheckIns:{userId}`) são cacheados (30s)** — o `UserInsignias` monta no header e a cada post aberto no drawer; sem cache eram 2 queries extras por post visualizado. Invalidam em `createCheckInDb` (check-in novo) e `setSelectedBadgeDb` (troca de insígnia).

### Insígnia exibida (persistente)

A insígnia mostrada ao lado do nome é a **escolhida pelo usuário**, guardada em `profiles.selected_badge_id`. Ela **nunca muda sozinha**: conquistar uma insígnia nova só a adiciona ao acervo (`user_badges`) e a libera para seleção — a exibida continua a mesma até o usuário trocar no `InsigniasDrawer`.

- `getDisplayBadgeDb(userId)` → retorna a insígnia de `selected_badge_id` se ela estiver no acervo; se o usuário nunca escolheu nenhuma, cai no fallback histórico (a de maior `sort_order` entre as conquistadas).
- `setSelectedBadgeDb(badgeId)` → valida que a insígnia foi conquistada (`isBadgeUnlocked`) e grava `profiles.selected_badge_id`. **Não apaga `user_badges`.**
- `isBadgeUnlocked(badge, earnedIds, totalCheckIns)` → fonte única da regra de desbloqueio, usada pelo drawer e pela validação: conquistada (linha em `user_badges`) **ou** insígnia de `checkin_total` cujo requisito o total de check-ins já cobre.

### Insígnias com `badges.premium` (2026-07-15, destravadas em 07/09/2026)

Insígnias com `badges.premium = true` (`premium_coroa` 👑, `premium_diamante` 💎) **não custam nada** — o app não vende assinatura (ver `docs/17-premium.md`):

- Aparecem no catálogo do `InsigniasDrawer` para todos, coloridas (seeds com `required_checkins = 0` fazem `isBadgeUnlocked` retornar `true` sem mudança na função).
- **Selecionáveis por qualquer usuário.** O selo "Premium" âmbar, o `PaywallDrawer` e o backstop `BADGE_PREMIUM_LOCKED` de `setSelectedBadgeDb` foram removidos em 07/09/2026.
- Elas ficam **fora** da barra de progresso "próximo nível" do drawer (o `required_checkins = 0` é desbloqueio por status, não marco de check-ins).

> **Bug histórico (corrigido em 14/07/2026, migração `20260714-badge-selection-persist.sql`):** `setSelectedBadgeDb` fazia `delete` de todas as linhas de `user_badges` e inseria só a escolhida, e a exibida era "a de maior `sort_order`". Escolher uma insígnia mais baixa apagava o acervo; no check-in seguinte `awardBadgesForCheckInsDb` reconquistava tudo, a de maior `sort_order` voltava e a escolha do usuário era sobrescrita sozinha ("a badge mudava quando virava o dia"). Nunca voltar a apagar `user_badges` na seleção.
- **Pull-to-refresh** invalida explicitamente todas as chaves acima (incluindo `isFollowing:{viewerId}:{profileUserId}`) antes de chamar `loadProfile({ soft: true })`, já que puxar para atualizar é um pedido explícito de dados frescos — não deve reaproveitar cache.
- **`getUserRoutinesDb` não é cacheado** (ver `docs/05-metas.md`) — sempre busca direto do Supabase, então o resumo de rotinas do perfil também reflete criações/edições feitas em Metas sem esperar TTL nem pull-to-refresh.
