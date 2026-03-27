# Tela: Feed (Index)

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
- Clicar em um story abre o `FlowViewerModal`
- Anel colorido indica story não visto

**Botão de criar story:**
- Ícone `+` sobre a foto de perfil do usuário
- Abre `FlowCreationDialog`

**FlowCreationDialog:**
- Upload de imagem para o story
- Botão confirmar publicação

**FlowViewerModal:**
- Visualização em tela cheia do story
- Progresso automático entre stories
- Exibe contagem de visualizações (para o dono)
- Botão fechar

---

### 2. Seletor de Modo do Feed

Dois modos disponíveis (Select dropdown ou botões toggle):

| Modo | Descrição |
|---|---|
| **Seguindo** | Posts dos usuários que o usuário segue |
| **Descobrir** | Posts de toda a plataforma |

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
| **Descrição** | Texto do post |
| **Meta vinculada** | Card mostrando a meta associada ao post (se houver) |
| **Rotinas vinculadas** | Lista expansível das rotinas da meta |
| **Botões de Incentivo** | 6 reações com ícones expressivos: ❤️ Apoio, 🔥 Fogo, 🏆 Vencedor, 📈 Evolução, 💪 Força, ⚡ Energia (componente `PostIncentiveButton`) |
| **Botão Comentários** | Abre `PostCommentsDialog` |
| **Contador de curtidas** | Clicável — abre `PostLikesModal` |

---

## Ações Disponíveis

### Sobre o próprio post (dono)
- **Editar post** — Drawer com textarea para editar descrição + seletor de meta ativa (vincula/desvincula meta do post)
- **Excluir post** — AlertDialog de confirmação → deleta via `deletePostDb`

### Sobre post de outro usuário
- **Denunciar usuário** — Dialog com seletor de motivo
- **Denunciar post** — Dialog com seletor de motivo

### Interações com qualquer post
- **Incentivar** — Toggling nos 6 tipos de incentivo (`togglePostLike`)
- **Comentar** — Abre drawer/dialog de comentários
- **Ver curtidas** — Modal com lista de usuários que curtiram
- **Copiar meta** — Se o post tiver meta, botão para copiar para o próprio perfil

---

## Estados da Tela

| Estado | Comportamento |
|---|---|
| **Carregando** | Exibe `PostSkeleton` (loading skeleton animado) |
| **Feed vazio** | Mensagem de encorajamento + botão para descobrir |
| **Erro de rede** | Toast com mensagem de erro |

---

## Dados Carregados

| Dado | Função DB |
|---|---|
| Posts do feed | `getFeedPosts()` / `getDiscoverPosts()` |
| Stories ativos | `getActiveStoriesDb()` |
| Perfil do usuário | `getUserProfileDb()` |
| Rotinas de uma meta | `getRoutinesByGoalIdDb()` |
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
| `ImageWithFallback` | Imagem com fallback |
| `UserInsignias` | Badges do usuário |
| `PostSkeleton` | Loading state |
| `LoadingSpinner` | Spinner genérico |

---

## Fluxo de Dados em Tempo Real

- Feed não tem realtime — recarrega ao entrar na tela
- Clicar no logo **LinKa** no header (quando já está na tela `/`) faz scroll para o topo e recarrega o feed silenciosamente (sem skeleton de loading) via evento `ritmofit-refresh-feed`
- Notificações de novos posts aparecem via badge no ícone de notificações (AppLayout)

---

## Observações Técnicas

- Posts são paginados ou carregados em batch completo
- Incentivos têm estado otimístico (UI atualiza imediatamente antes da confirmação do servidor)
- Rotinas vinculadas a posts carregam sob demanda (lazy load) ao expandir
- Stories do usuário logado mostram contagem de visualizadores
