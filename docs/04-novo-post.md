# Tela: Novo Post

**Rota:** `/postar`
**Arquivo:** `client/pages/NewPost.tsx`
**Layout:** AppLayout

---

## Objetivo

Tela de criação de conteúdo. Permite ao usuário publicar um post com imagens ou criar um clipe de vídeo (Shot). O draft é persistido na sessão para não perder o conteúdo ao navegar.

---

## Estrutura Visual (2 etapas — estilo Instagram)

```
ETAPA 1 — Seleção de mídia
┌──────────────────────────────────┐
│  [X]   Novo post         Avançar │  ← header customizado
├──────────────────────────────────┤
│                                  │
│     Preview da foto/vídeo        │  ← aspect-ratio 1:1, full-width
│       selecionada(o)             │
│                                  │
├──────────────────────────────────┤
│  Recentes >        [Selecionar]  │  ← toolbar da galeria
├──────────────────────────────────┤
│  Grade 4 colunas de fotos        │  ← fotos selecionadas
│  selecionadas (toque p/ preview) │
├──────────────────────────────────┤
│    [POST]        [SHOT]          │  ← seletor de tipo de mídia
└──────────────────────────────────┘

ETAPA 2 — Legenda e publicação
┌──────────────────────────────────┐
│  [←]   Novo post    Compartilhar │  ← header com botão de submit
├──────────────────────────────────┤
│  [thumb] Textarea de legenda     │  ← preview miniatura + texto
├──────────────────────────────────┤
│  Tiras de fotos selecionadas     │  ← strip horizontal (se múltiplas)
├──────────────────────────────────┤
│  Contador de caracteres          │
├──────────────────────────────────┤
│  Vincular a uma meta (opcional)  │
├──────────────────────────────────┤
│  [     Publicar / Pub. Shot    ] │  ← botão principal
└──────────────────────────────────┘
```

---

## Etapa 1: Seleção de Mídia

### Header
- Botão `X` (fecha/volta à tela anterior via `navigate(-1)`)
- Título "Novo post"
- Botão "Avançar" (habilitado apenas quando há mídia selecionada)

### Preview
- Área full-width com `aspect-ratio: 1/1` (fundo preto)
- Mostra a foto atual (`currentPreviewIndex`) ou o vídeo selecionado
- Se vazio: placeholder com ícone `Camera` ou `Video` + instrução de toque
- Sobre a imagem: botão "Editar" (crop), navegação `ChevronLeft/Right`, dots de posição, badge com total de fotos

### Toolbar da Galeria
- Label "Recentes" à esquerda
- Botão "Selecionar" abre o `<input type="file">` correspondente

### Grade de Fotos (somente POST)
- 4 colunas, `gap-px`
- Primeira célula: ícone `Camera` (abre file picker)
- Células seguintes: fotos selecionadas (toque define o preview principal)
- Sobre cada foto: botão `X` para remover, número de ordem no canto inferior esquerdo, anel de destaque na foto ativa
- Sem fotos: 12 células de placeholder (só a primeira tem ícone)

### Seletor de Tipo (POST / SHOT)
- Tabs na parte inferior com ícone + label em maiúsculas
- Sublinhado na opção ativa

---

## Etapa 2: Legenda e Publicação

### Header
- Botão `ArrowLeft` (volta à etapa 1)
- Título "Novo post"
- Botão "Compartilhar" executa o submit (com spinner durante envio)

### Área de Legenda
- Miniatura 64×64 da foto/vídeo selecionado
- `Textarea` sem borda (integrado ao layout), máx. 500 chars
- Strip horizontal de thumbnails abaixo (apenas se múltiplas fotos selecionadas)

### Vincular Meta (somente POST)
- `Select` com metas ativas do usuário
- Se sem metas: link "Criar meta →" navega para `/metas?tab=metas`
- Hint verde com ícone `Sparkles` quando meta selecionada

### Botão Publicar
- Fixo no rodapé com `env(safe-area-inset-bottom)`
- "Publicar" (POST) ou "Publicar Shot" (SHOT)
- Desabilitado durante envio

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
| `newpost_image_previews` | Array JSON de base64 das imagens selecionadas |
| `newpost_image_meta` | Array JSON de `{ name, type }` para reconstruir os File objects |
| `newpost_video_preview` | Base64 do vídeo selecionado |
| `newpost_video_meta` | JSON de `{ name, type }` para reconstruir o File object do vídeo |

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
