# Tela: Hashtag

**Rota:** `/tag/:tag`
**Arquivo:** `client/pages/Hashtag.tsx`
**Layout:** AppLayout (header flutuante + bottom nav global)

---

## Objetivo

Página de descoberta por hashtag, no estilo Instagram. Reúne, numa **grade de miniaturas**, todo o conteúdo cuja legenda contém a hashtag `#tag` — **posts do feed e Shots**. Aberta ao tocar numa hashtag destacada em qualquer legenda (feed, detalhe do post ou Shots).

---

## Como se chega aqui

As hashtags nas legendas são renderizadas por `renderWithHashtags` (`client/lib/post-visuals.tsx`), que aceita um callback opcional `onHashtagClick(tag)`. O `PostCard` (feed), o `PostDetail` e a tela de `Shots` passam `(tag) => navigate('/tag/'+encodeURIComponent(tag))`. Só a parte `#tag` do token é clicável — pontuação no fim (ex.: `#fit,`) fica fora do link — e o clique usa `stopPropagation` para não disparar o expandir/recolher da legenda.

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

### Grade de Conteúdo
- `grid grid-cols-3 gap-[5px]` (4/5/6 colunas em `sm/md/lg`), itens `aspect-square rounded-[14px]` — **mesmo padrão da grade de posts do Perfil**
- Cada item é um `HashtagItem` com o discriminador `kind` (`"post"` | `"shot"`), que decide miniatura, badge e destino:

| `kind` | Miniatura | Badge | Ao tocar |
|---|---|---|---|
| `post` | `post.photo` ou a 1ª de `post.photos`; sem foto → **gradiente determinístico** por id (`getPostGradient`) + ícone `Hash` | `📷 N` quando `photos.length > 1` | `navigate('/post/:id')` |
| `shot` | `ShotThumb` (`components/shared/shot-thumb.tsx`) — mesmo componente da aba Shots do Perfil e da Busca: `<video>` mudo, carrega só o que está perto da viewport e **libera o player do iOS** ao sair/desmontar (ver `docs/03-shots.md`) | Ícone `Video` sobre `bg-black/55` | `navigate('/shots', { state: { shotId } })` |

- A `key` do React é `` `${kind}-${id}` `` — `posts.id` é uuid e `shots.id` é bigint, então o par evita qualquer colisão entre as fontes
- Shots abertos por aqui funcionam mesmo se não estiverem entre os do feed: a tela de Shots já busca o `shotId` pedido via `getShotByIdDb` e o coloca no topo

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
| Posts **e Shots** com a hashtag | `searchContentByHashtagDb(tag)` |

### `searchContentByHashtagDb(tag)` (`client/lib/ritmofit-db.ts`)

- Consulta as **duas fontes em paralelo** (`Promise.all`), já que post e Shot têm legenda com hashtag clicável:
  - `posts` → `description ILIKE '%#tag%'`, `created_at DESC`, `limit(120)`
  - `shots` → mesmo filtro + `video_url` não nulo/vazio (mesma guarda de `getShotsDb`), `created_at DESC`, `limit(120)`
- **Refino no cliente** por regex com fronteira de palavra (`#tag` não seguido de letra/número/`_`, via lookahead `(?![\p{L}\p{N}_])`, flag `iu`) — assim `#fit` **não** casa com `#fitness`. A tag é escapada antes de virar regex. O mesmo regex vale para as duas fontes
- As duas listas são **intercaladas por `created_at`** (mais recente primeiro), formando uma grade cronológica única
- Se uma fonte falhar, a outra ainda renderiza — cada lado degrada sozinho (erro não zera o resultado inteiro)
- Retorna `HashtagItem[]` (`kind, id, photo, photos, video_url, description, created_at, user_id`)
- Sem cache (uso pontual; sempre fresco)

> **Histórico:** até 2026-07-16 esta função se chamava `searchPostsByHashtagDb` e retornava `HashtagPost[]`, olhando **só** a tabela `posts`. Como a tela de Shots já tornava as hashtags clicáveis, uma tag usada apenas em Shots (ex.: `#caminhada`) levava a uma página vazia.

---

## Observações Técnicas

- Rota lazy registrada em `App.tsx` dentro do grupo `<AppLayout />`, com `GenericPageSkeleton`
- O parâmetro `:tag` chega já decodificado pelo React Router; a página remove um eventual `#` inicial
- A privacidade "ocultar posts de quem não te segue" é um gate **client-side** em outras telas e **não** é aplicada aqui (consistente com o Descobrir, que também não filtra no servidor) — hashtags são consideradas descoberta pública
