# Tela: Detalhe do Post

**Rota:** `/post/:postId`
**Arquivo:** `client/pages/PostDetail.tsx`
**Layout:** AppLayout (com header sticky próprio)

---

## Objetivo

Visualização isolada de um post específico. Permite ver o post com todas as suas interações de forma ampliada, e gerenciar o post se for o dono.

---

## Estrutura Visual

```
┌──────────────────────────────────┐
│  [←] Post                     [⋮]│  ← Header sticky
├──────────────────────────────────┤
│  Imagem do post                  │
│                               [⋮]│  ← Menu flutuante na imagem
├──────────────────────────────────┤
│  Descrição do post               │
├──────────────────────────────────┤
│  [Incentivos...]  [Comentários]  │
└──────────────────────────────────┘
```

---

## Componentes da Tela

### Header (Sticky)
- Botão `ArrowLeft` → volta para `/perfil`
- Título "Post"

### Imagem do Post
- Componente `ImageWithFallback`
- Fallback: `/placeholder.svg`
- Largura total, altura máxima de 96 unidades (`max-h-96`)
- `object-cover` para manter proporção

### Menu de Opções (⋮)
- Botão flutuante no canto superior direito da imagem
- Fundo semitransparente preto (`bg-black/40`)
- **Editar** — abre funcionalidade de edição (implementação no componente pai)
- **Excluir** — remove o post com confirmação

### Descrição
- Texto completo do post
- `whitespace-pre-wrap` para preservar quebras de linha

### Meta Vinculada (condicional)
- Exibida logo abaixo da descrição quando o post tem `user_goal_id`
- Card roxo (`bg-violet-500/10`) com ícone `Rocket` e a descrição da meta
- Buscada via `getUserGoalByIdDb(post.user_goal_id)` ao carregar o post

### Botões de Interação
| Elemento | Posição | Componente |
|---|---|---|
| Incentivos (6 tipos) | Esquerda, scroll horizontal | `PostIncentiveButton` |
| Comentários | Direita | `PostCommentsDialog` |

---

## Carregamento do Post

O post é carregado buscando todos os posts do usuário logado e filtrando pelo `postId` da URL:

```
useParams → postId
  └─ getUserPostsDb(user.id)
       └─ find(p => p.id === postId)
            ├─ Encontrado → exibe post
            └─ Não encontrado → toast + navega para /perfil
```

> **Nota:** Atualmente só carrega posts do próprio usuário. Não é possível ver posts de outros usuários por esta rota.

---

## Estados da Tela

| Estado | Comportamento |
|---|---|
| Carregando | Texto "Carregando..." centralizado |
| Post não encontrado | Mensagem de erro + toast |
| Post encontrado | Exibe conteúdo completo |

---

## Dados Carregados

| Dado | Função DB |
|---|---|
| Posts do usuário | `getUserPostsDb(userId)` |

---

## Observações Técnicas

- Esta tela tem funcionalidade básica de edição/exclusão no menu mas a implementação completa está vinculada ao componente
- Os botões de incentivo estão renderizados estaticamente (sem funcionalidade de toggle nesta tela — todos com `isActive: false` e `onClick: () => {}`)
- É uma tela de "detalhe/preview" — a interatividade completa está no feed principal
- Redirecionamento automático para `/perfil` se post não for encontrado
