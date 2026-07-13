# Tela: Hashtag

**Rota:** `/tag/:tag`
**Arquivo:** `client/pages/Hashtag.tsx`
**Layout:** AppLayout (header flutuante + bottom nav global)

---

## Objetivo

Página de descoberta por hashtag, no estilo Instagram. Reúne, numa **grade de miniaturas**, todos os posts cuja legenda contém a hashtag `#tag`. Aberta ao tocar numa hashtag destacada em qualquer legenda (feed ou detalhe do post).

---

## Como se chega aqui

As hashtags nas legendas são renderizadas por `renderWithHashtags` (`client/lib/post-visuals.tsx`), que aceita um callback opcional `onHashtagClick(tag)`. Tanto o `PostCard` (feed) quanto o `PostDetail` passam `(tag) => navigate('/tag/'+encodeURIComponent(tag))`. Só a parte `#tag` do token é clicável — pontuação no fim (ex.: `#fit,`) fica fora do link — e o clique usa `stopPropagation` para não disparar o expandir/recolher da legenda.

---

## Estrutura Visual

```
┌──────────────────────────────────┐
│ [←]  (#) #fitness                │  ← cabeçalho: voltar + ícone + tag
│         42 publicações           │     + contagem
├──────────────────────────────────┤
│  [img] [img] [img]               │  ← grade 3 col (4/5/6 em telas maiores)
│  [img] [img] [img]               │
│  ...                             │
└──────────────────────────────────┘
```

---

## Seções e Componentes

### Cabeçalho
- Botão `ArrowLeft` circular (`bg-muted`) → `navigate(-1)`
- Ícone `Hash` num círculo com gradiente da marca (azul→roxo)
- Título `#{tag}` + subtítulo com a contagem de posts (`hashtag_posts_count` / `hashtag_post_count_one`, singular/plural)

### Grade de Posts
- `grid grid-cols-3 gap-[5px]` (4/5/6 colunas em `sm/md/lg`), itens `aspect-square rounded-[14px]` — **mesmo padrão da grade de posts do Perfil**
- Miniatura: `post.photo` ou a 1ª de `post.photos`; posts sem foto usam o **gradiente determinístico** por id (`getPostGradient`) com um ícone `Hash`
- Indicador de múltiplas fotos (`📷 N`) quando `photos.length > 1`
- Tocar num item → `navigate('/post/:id')` (reaproveita a tela de Detalhe do Post)

### Estados
| Estado | Comportamento |
|---|---|
| Carregando | `LoadingSpinner` centralizado |
| Vazio | Ícone + `hashtag_empty_title` (com a tag) + `hashtag_empty_desc` |
| Com resultados | Grade de miniaturas |

---

## Dados Carregados

| Dado | Função DB |
|---|---|
| Posts com a hashtag | `searchPostsByHashtagDb(tag)` |

### `searchPostsByHashtagDb(tag)` (`client/lib/ritmofit-db.ts`)

- Filtro **amplo** no banco: `posts` com `description ILIKE '%#tag%'`, ordenado por `created_at DESC`, `limit(120)`
- **Refino no cliente** por regex com fronteira de palavra (`#tag` não seguido de letra/número/`_`, via lookahead `(?![\p{L}\p{N}_])`, flag `iu`) — assim `#fit` **não** casa com `#fitness`. A tag é escapada antes de virar regex
- Retorna `HashtagPost[]` (`id, photo, photos, description, created_at, user_id`)
- Sem cache (uso pontual; sempre fresco)

---

## Observações Técnicas

- Rota lazy registrada em `App.tsx` dentro do grupo `<AppLayout />`, com `GenericPageSkeleton`
- O parâmetro `:tag` chega já decodificado pelo React Router; a página remove um eventual `#` inicial
- A privacidade "ocultar posts de quem não te segue" é um gate **client-side** em outras telas e **não** é aplicada aqui (consistente com o Descobrir, que também não filtra no servidor) — hashtags são consideradas descoberta pública
