# Tela: Perfil

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
│  Tabs: [Posts][Shots][Marcações] │  ← + [Vitrine], só se há ofertas ativas
│         [Vitrine]                │    (a linha rola na horizontal)
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
> - **Tabs em estilo underline** (transparente, indicador `border-b-2` branco no ativo) em vez do `TabsList` boxed. Com a aba **Marcações** são até 4 abas, que não cabem na largura do iPhone — o `TabsList` ganhou `overflow-x-auto no-scrollbar` (gap reduzido para `gap-5`) e cada `TabsTrigger` é `shrink-0 whitespace-nowrap`, então a linha **rola na horizontal** em vez de comprimir/quebrar os rótulos.
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

Grade de imagens dos posts do usuário.

**Layout:** Grid 3 colunas (mobile) / 4–6 colunas (telas maiores), `gap-[5px]`, itens `rounded-[14px]`

Cada post na grade:
- Thumbnail da primeira imagem (`loading="lazy"` + `decoding="async"` — até 100 posts não carregam todos de uma vez)
- Ao clicar → abre o post no drawer (Post Viewer)

**Menu de contexto (próprio perfil apenas):**
- `Editar` → Drawer com textarea para editar descrição
- `Excluir` → AlertDialog de confirmação

**Ao expandir um post:**
- Ao salvar uma edição, o `selectedPost` local também é atualizado — a descrição/meta novas aparecem imediatamente no modo visualização (antes ficava o texto antigo até reabrir)
- Ao excluir, o contador de posts (stats + rótulo da tab) é decrementado localmente e o cache `userPosts`/`userStats` é invalidado no banco (`deletePostDb`)
- Incentivos são **não-bloqueantes**: o toque atualiza a UI na hora (optimistic) e a escrita/refetch rodam em segundo plano com guard de sequência — os 6 botões não ficam mais desabilitados durante o toggle
- O contador de comentários é sincronizado em tempo real via prop `onCountChange` do `PostCommentsDialog`
- Carrossel de imagens (`PostCarousel`)
- Descrição — truncada em até 30 caracteres ou 1 linha; exibe `...` + botão clicável **"mais"** (chave i18n `feed_description_more`) para expandir o texto completo, e botão **"menos"** (`feed_description_less`) para recolher. Estado de expansão é resetado ao abrir um novo post
- **Pill "Ver treino"** (`WorkoutDetailButton`) — só em posts de **resumo de treino** (com `workout_summary`), abaixo da descrição em modo visualização. Abre o drawer simplificado com a lista de exercícios (miniatura + grupo + séries em chips `{kg}kg × {reps}`; mesmo componente do feed/PostDetail). Ver `docs/01-feed.md` (Detalhe do treino)
- Botões de incentivo interativos (`PostIncentiveButton` × 6 tipos) — visíveis em modo visualização e edição
- Botão comentários (`PostCommentsDialog`) — visível apenas em modo visualização (oculto ao editar)
- Contador de incentivos clicável → abre `PostLikesModal`

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

Como `getPostGoalsBatchDb` só retorna metas públicas (para bater com o comportamento do feed, que esconde meta privada até do próprio autor rolando o feed), o Post Viewer mantém um **fallback** só para o post do próprio dono do perfil: se `selectedPost.userGoal` vier vazio mas `selectedPost.user_id === profileUserId`, cai para `userGoals.find(...)` — a lista completa (sem filtro de visibilidade) do dono, carregada no batch 2. Isso preserva duas coisas que só fazem sentido pro próprio dono olhando o próprio post: ver uma meta que ele mesmo marcou como privada, e o aviso "meta removida" quando a meta foi de fato apagada (referência órfã).

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
| @ Usuário | Input (apenas letras, números, _ e .) → salvo em `profiles.handle` |
| Objetivos | Botões de seleção múltipla (mesmos do onboarding) → salvo em `profiles.objectives` |
| Foto de perfil | Upload de imagem |
| Banner | Upload de imagem |
| Segmentos de interesse | Checkbox múltiplo |

Botão "Salvar" → `updateUserProfileDb`

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
| Conta e Segurança | Botão → Drawer aninhado | Email (editável com confirmação via link), redefinir senha e zona de perigo (encerrar conta) |

#### Histórico de peso (Meu Perfil → Pessoal)

Ao lado do rótulo **Peso (kg)** há um botão **"Histórico"** (`LineChart`, chave `settings_weight_history`) que abre o **`WeightHistoryDrawer`** — o **mesmo** componente usado pelo lembrete semanal de peso da tela de Metas (`docs/05-metas.md`), agora em `client/components/shared/weight-history-drawer.tsx`.

Conteúdo do drawer: peso atual em destaque + **variação total** desde o primeiro registro, gráfico de tendência (`TrendChart`, sob `PremiumGate feature="charts"`), input para registrar um novo peso e a lista do histórico (mais recente primeiro) com a **variação em relação ao registro anterior** e ação de excluir.

- Dados: `getWeightLogsDb(90)` / `addWeightLogDb` / `deleteWeightLogDb` (tabela `user_weight_logs`, um registro por dia via upsert)
- Os logs são carregados **só ao abrir** o histórico (a maioria das visitas às configurações não o abre; a função já é cacheada por usuário)
- `addWeightLogDb` também grava `profiles.weight`, então após registrar o campo Peso do formulário é atualizado localmente para não exibir valor defasado

### Seção: Negócio *(exibida apenas se o usuário tem perfil comercial)*

| Configuração | Tipo | Descrição |
|---|---|---|
| Gerenciar Perfil Comercial | Botão → Drawer aninhado | Dashboard do negócio com stats e edição |
| Perfil Comercial | Botão → Drawer aninhado | Formulário de criação *(exibido quando não há perfil comercial)* |

### Seção: Assinatura *(exibida apenas para assinantes — `usePremium().isPremium`)*

| Configuração | Tipo | Descrição |
|---|---|---|
| Gerenciar assinatura | Botão → Drawer aninhado | Status, data de início, tipo de cobrança e próxima cobrança/acesso até, lidos de `subscriptions`. Cancelamento é feito pela Apple (`https://apps.apple.com/account/subscriptions`), nunca pelo app. Na Fase 1 (ativação manual, sem cobrança) não há botão de cancelar — só uma nota explicando que não existe cobrança associada. Ver `docs/17-premium.md` |

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
| Arquivo de Flows | Botão → Drawer aninhado | Histórico de flows expirados (> 24h) |
| Relatar um problema | Botão → `ReportProblemDrawer` | Relato manual de bug, enviado ao Sentry. **Só aparece quando `isMonitoringEnabled()`** (ver abaixo) |
| Desconectar | Botão destrutivo | Logout |

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

### Insígnias premium (2026-07-15)

Insígnias com `badges.premium = true` (`premium_coroa` 👑, `premium_diamante` 💎) são **exclusivas de assinante** (ver `docs/17-premium.md`):

- Aparecem no catálogo do `InsigniasDrawer` **para todos** com selo "Premium" âmbar (gera desejo), coloridas (seeds com `required_checkins = 0` fazem `isBadgeUnlocked` retornar `true` sem mudança na função).
- Usuário grátis que toca nelas → abre o `PaywallDrawer` (`feature="badges"`); assinante seleciona normalmente.
- Backstop no banco de dados do app: `setSelectedBadgeDb` lança `BADGE_PREMIUM_LOCKED` se o viewer não for premium.
- Elas ficam **fora** da barra de progresso "próximo nível" do drawer (o `required_checkins = 0` é desbloqueio por status, não marco de check-ins).

> **Bug histórico (corrigido em 14/07/2026, migração `20260714-badge-selection-persist.sql`):** `setSelectedBadgeDb` fazia `delete` de todas as linhas de `user_badges` e inseria só a escolhida, e a exibida era "a de maior `sort_order`". Escolher uma insígnia mais baixa apagava o acervo; no check-in seguinte `awardBadgesForCheckInsDb` reconquistava tudo, a de maior `sort_order` voltava e a escolha do usuário era sobrescrita sozinha ("a badge mudava quando virava o dia"). Nunca voltar a apagar `user_badges` na seleção.
- **Pull-to-refresh** invalida explicitamente todas as chaves acima (incluindo `isFollowing:{viewerId}:{profileUserId}`) antes de chamar `loadProfile({ soft: true })`, já que puxar para atualizar é um pedido explícito de dados frescos — não deve reaproveitar cache.
- **`getUserRoutinesDb` não é cacheado** (ver `docs/05-metas.md`) — sempre busca direto do Supabase, então o resumo de rotinas do perfil também reflete criações/edições feitas em Metas sem esperar TTL nem pull-to-refresh.
