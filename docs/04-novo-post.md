# Tela: Novo Post

**Rota:** `/postar`
**Arquivo:** `client/pages/NewPost.tsx`
**Layout:** AppLayout

---

## Objetivo

Tela de criação de conteúdo. Permite ao usuário publicar um post com imagens ou criar um clipe de vídeo (Shot). O draft é persistido na sessão para não perder o conteúdo ao navegar.

---

## Estrutura Visual

```
┌──────────────────────────────────┐
│  Tabs: [Imagens] [Vídeo]         │
├──────────────────────────────────┤
│  Conteúdo da Tab ativa           │
│  (formulário de criação)         │
└──────────────────────────────────┘
```

---

## Tab: Imagens (Post)

### Área de Upload
- Botão grande com ícone `ImagePlus`
- Aceita múltiplas imagens (array de arquivos)
- Preview das imagens selecionadas em carrossel
- Navegação no carrossel com `ChevronLeft` / `ChevronRight`
- Botão `X` para remover imagem individual

### Carrossel de Preview
- Exibe a imagem atual (`currentPreviewIndex`)
- Indicador de posição (ex: "2 / 4")
- Botões de navegação esquerda/direita

### Campos
| Campo | Tipo | Descrição |
|---|---|---|
| Descrição | Textarea | Texto do post, persistido em sessionStorage |
| Meta vinculada | Select | Lista das metas ativas do usuário |

### Botão de Publicar
- Texto: "Publicar Post"
- Desabilitado se: nenhuma imagem selecionada, texto vazio ou requisição em andamento
- Estado de loading: ícone `Loader2` animado
- Ao publicar: chama `createPostDb` → faz upload das imagens no Supabase Storage → navega para `/perfil`

---

## Tab: Vídeo (Shot)

### Área de Upload
- Botão grande com ícone `Video`
- Aceita um único arquivo de vídeo
- Preview do vídeo selecionado (elemento `<video>`)
- Botão `X` para remover vídeo

### Campos
| Campo | Tipo | Descrição |
|---|---|---|
| Descrição | Textarea | Texto do clipe, persistido em sessionStorage |
| Meta vinculada | Select | Lista das metas ativas do usuário |

### Botão de Publicar
- Texto: "Publicar Clipe"
- Desabilitado se: nenhum vídeo selecionado, texto vazio ou requisição em andamento
- Ao publicar: chama `createShotDb` → faz upload do vídeo no Supabase Storage → navega para `/shots`

---

## Persistência de Rascunho (SessionStorage)

Campos automaticamente salvos na sessão:

| Chave | Valor |
|---|---|
| `newpost_description` | Texto da descrição do post |
| `newpost_goal_id` | ID da meta selecionada para o post |
| `newpost_video_description` | Texto da descrição do vídeo |
| `newpost_video_goal_id` | ID da meta selecionada para o vídeo |
| `newpost_tab` | Aba ativa ao sair da tela |

---

## Vincular Meta a um Post

- Dropdown com todas as metas ativas do usuário (`getUserGoalsDb`)
- Ao publicar com meta vinculada: incrementa o progresso da meta (`incrementGoalProgressDb`)
- A meta vinculada aparece no feed junto ao post

---

## Estados da Tela

| Estado | Comportamento |
|---|---|
| Carregando metas | Spinner no Select de metas |
| Enviando post | Botão desabilitado com ícone de loading |
| Upload concluído | Toast de sucesso → redirecionamento |
| Erro no upload | Toast destrutivo com mensagem |
| Sem Supabase | Toast de aviso e botão desabilitado |

---

## Dados Carregados

| Dado | Função DB |
|---|---|
| Metas do usuário | `getUserGoalsDb()` |

---

## Observações Técnicas

- Imagens são convertidas para `File[]` e URLs de preview geradas com `URL.createObjectURL`
- URLs de preview são revogadas no unmount (evita memory leak)
- Tab ativa é preservada em sessionStorage — ao voltar, usuário retorna na mesma aba
- A seleção de arquivos usa `<input type="file" multiple accept="image/*">` oculto
- Para vídeos: `<input type="file" accept="video/*">` oculto
