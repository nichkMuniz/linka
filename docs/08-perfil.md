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
│  Tabs: [Posts][Shots][Rotinas]   │
├──────────────────────────────────┤
│  Conteúdo da Tab ativa           │
└──────────────────────────────────┘
```

---

## Cabeçalho do Perfil

### Foto e Banner
- **Banner:** imagem de capa (upload disponível no próprio perfil)
- **Avatar:** foto de perfil circular, clicável para ampliar ou editar

### Informações do Usuário
| Campo | Descrição |
|---|---|
| Nome / Nickname | Nome de exibição |
| Bio | Descrição pessoal |
| Segmentos | Interesses fitness selecionados no onboarding |
| Data de criação | "Membro desde..." |

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
- Descrição
- Botões de incentivo (`PostIncentiveButton`)
- Botão comentários (`PostCommentsDialog`)
- Modal de quem curtiu (`PostLikesModal`)

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
| Foto de perfil | Upload de imagem |
| Banner | Upload de imagem |
| Segmentos de interesse | Checkbox múltiplo |

Botão "Salvar" → `updateUserProfileDb`

---

## Drawer de Configurações (próprio)

Aberto pelo botão "Configurações":

| Configuração | Tipo | Descrição |
|---|---|---|
| Limite de uso diário | Slider / Input | Minutos por dia no app |
| Tema | Toggle | Dark / Light |
| Perfil comercial | Toggle | Ativa/desativa modo comercial |

**Perfil Comercial (se ativado):**
| Campo | Tipo |
|---|---|
| Segmento do negócio | Input |
| Nome do negócio | Input |
| Descrição | Textarea |
| Telefone | Input |
| Email comercial | Input |
| Website | Input |

Função: `createOrUpdateCommercialProfileDb`

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

---

## Observações Técnicas

- A mesma tela (`Profile.tsx`) é usada para `/perfil` e `/usuario/:userId`
- O hook `useAuth()` determina se é o próprio perfil ou não
- `Collapsible` é usado para seções expansíveis de rotina
- Imagens de banner e avatar são hospedadas no Supabase Storage
