# Tela: Perfil

**Rota:** `/perfil` (próprio) | `/usuario/:userId` (outro usuário)
**Arquivo:** `client/pages/Profile.tsx`
**Layout:** AppLayout
**Tamanho:** ~3.896 linhas (segunda maior tela)

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
│  Tabs: [Posts][Shots][Rotinas]   │
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
> - **Tabs em estilo underline** (transparente, indicador `border-b-2` branco no ativo) em vez do `TabsList` boxed.
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

**Layout:** Grid 2 colunas (mobile) / 3 colunas (desktop)

Cada post na grade:
- Thumbnail da primeira imagem
- Ao clicar → abre post em modal ou navega para `/post/:postId`

**Menu de contexto (próprio perfil apenas):**
- `Editar` → Drawer com textarea para editar descrição
- `Excluir` → AlertDialog de confirmação

**Ao expandir um post:**
- Carrossel de imagens (`PostCarousel`)
- Descrição — truncada em até 30 caracteres ou 1 linha; exibe `...` + botão clicável **"mais"** (chave i18n `feed_description_more`) para expandir o texto completo, e botão **"menos"** (`feed_description_less`) para recolher. Estado de expansão é resetado ao abrir um novo post
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

**Layout:** Grid 2 colunas com proporção 9:16 (portrait)

Cada shot na grade:
- Thumbnail de preview do vídeo
- Ícone de play centralizado
- Ao clicar → abre o shot em um player modal

**Menu de contexto (próprio perfil apenas):**
- `Editar` → Drawer para editar descrição do shot
- `Excluir` → AlertDialog de confirmação

---

## Tab: Rotinas

Lista das rotinas públicas do usuário.

Cada rotina exibe:
- Nome da rotina
- Tipo (treino / dieta / hábito)
- Lista de itens (exercícios / refeições)
- Itens carregados via `getRoutineItemsForViewDb`

**Perfil próprio — Gestão de Rotinas:**
- Criar nova rotina
- Editar rotina existente
- Excluir rotina
- Adicionar/remover exercícios de uma rotina
- Adicionar/remover dietas de uma rotina

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

### Seção: Perfil

| Configuração | Tipo | Descrição |
|---|---|---|
| Meu Perfil | Botão → Drawer aninhado com abas | Drawer unificado com duas abas: **Público** (foto, nome, bio, handle) e **Pessoal** (sexo, altura, peso, idade, objetivos) |
| Conta e Segurança | Botão → Drawer aninhado | Email (editável com confirmação via link), redefinir senha e zona de perigo (encerrar conta) |

### Seção: Negócio *(exibida apenas se o usuário tem perfil comercial)*

| Configuração | Tipo | Descrição |
|---|---|---|
| Gerenciar Perfil Comercial | Botão → Drawer aninhado | Dashboard do negócio com stats e edição |
| Perfil Comercial | Botão → Drawer aninhado | Formulário de criação *(exibido quando não há perfil comercial)* |

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
| Ocultar posts de quem não te segue | `hide_posts_from_non_followers` | A aba **Posts** do perfil só é exibida a quem **segue** o dono. Para não seguidores aparece um estado bloqueado ("Publicações privadas" + cadeado). O dono e seus seguidores veem normalmente. |

O status de seguimento do visitante é carregado com `isFollowingDb(profileUserId)` no carregamento do perfil. O gating é client-side (consistente com o filtro de visibilidade das metas).

### Seção: Outros

| Configuração | Tipo | Descrição |
|---|---|---|
| Arquivo de Flows | Botão → Drawer aninhado | Histórico de flows expirados (> 24h) |
| Desconectar | Botão destrutivo | Logout |

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

---

## Dados Carregados

| Dado | Função DB |
|---|---|
| Perfil do usuário | `getUserProfileDb(userId)` |
| Posts do usuário | `getUserPostsDb(userId)` |
| Shots do usuário | `getUserShotsDb(userId)` |
| Estatísticas | `getUserStatsDb(userId)` |
| Seguidores | `getFollowersDb(userId)` |
| Seguindo | `getFollowingDb(userId)` |
| Status de seguimento | `isFollowingDb(userId)` / `getFollowingStatusBatchDb` |
| Rotinas | `getUserRoutinesDb(userId)` |
| Treinos | `getUserWorkoutsDb()` |
| Dietas | `getUserDietsDb()` |
| Hábitos | `getUserHabitsDb()` |
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
- Ícone `Target` (Lucide) com label "Metas" como cabeçalho da seção
- Seção completamente oculta se `userGoals.length === 0`

---

## Diferenças: Próprio Perfil vs. Perfil de Outro Usuário

| Funcionalidade | Próprio | Outro usuário |
|---|---|---|
| Editar perfil | ✅ | ❌ |
| Configurações | ✅ | ❌ |
| Excluir posts/shots | ✅ | ❌ |
| Editar posts/shots | ✅ | ❌ |
| Gerenciar rotinas | ✅ | ❌ |
| Botão Seguir | ❌ | ✅ |
| Botão Mensagem | ❌ | ✅ |
| Ver posts | ✅ | ✅ |
| Ver shots | ✅ | ✅ |
| Ver rotinas | ✅ | ✅ |
| Ver vitrine (se tem ofertas) | ✅ | ✅ |

---

## Observações Técnicas

- A mesma tela (`Profile.tsx`) é usada para `/perfil` e `/usuario/:userId`
- O hook `useAuth()` determina se é o próprio perfil ou não
- `Collapsible` é usado para seções expansíveis de rotina
- Imagens de banner e avatar são hospedadas no Supabase Storage
