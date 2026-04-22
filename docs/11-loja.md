# 11 — Vitrine / Loja (Hub de Promoções e Profissionais)

**Rota:** `/vitrine`  
**Arquivo:** `client/pages/Store.tsx`

---

## Visão Geral

Hub comunitário com duas abas:
- **Promoções:** qualquer usuário autenticado pode divulgar promoções de produtos e serviços fitness — equipamentos, suplementos, alimentos saudáveis, vestuário esportivo e serviços. Funciona como marketplace social: sem pagamentos na plataforma, apenas divulgação com link externo.
- **Profissionais:** diretório de usuários com perfil comercial ativo (personal trainers, nutricionistas, fisioterapeutas, coaches, etc.). Permite descobrir e contatar profissionais diretamente pelo app.

---

## Estrutura Visual

```
┌─────────────────────────────────────────┐
│  Header sticky                          │
│  [🏷 Vitrine]          [+ Publicar]*    │
│  [Promoções N] [Profissionais N] ← tabs │
│  [🔍 Buscar...]  [Categoria ▾]          │
├─────────────────────────────────────────┤
│  Grid 2 colunas (Promoções)             │
│  Grid 1/2 col (Profissionais)           │
└─────────────────────────────────────────┘
* Botão "+ Publicar" visível apenas para usuários autenticados
```

---

## Funcionalidades

### Tabs de Navegação

| Tab | Descrição |
|---|---|
| Promoções | Feed de promoções de produtos/serviços fitness |
| Profissionais | Diretório de usuários com perfil comercial ativo |

Cada tab exibe um badge com o total de itens carregados. O botão "+ Publicar" só aparece na aba Promoções **e apenas para usuários logados**.

---

### Aba: Promoções

#### Carregamento
- Chama `getPromotionsDb(category?)` que retorna promoções com `is_active = true`, ordenadas por `created_at DESC`
- Recarrega automaticamente quando `activeCategory` muda (nova query ao banco)
- Busca textual (título, descrição, nome do autor) em tempo real, client-side, sobre os resultados já carregados

#### Filtros
- **Categoria:** dropdown com as opções de `PROMOTION_CATEGORIES` + "Todos". Ao trocar, dispara nova query ao banco
- **Busca:** filtra client-side sobre a categoria ativa — o placeholder indica contexto, e o empty state informa se a busca está restrita à categoria

#### Card de Promoção (`PromotionCard`)

| Elemento | Descrição |
|---|---|
| Imagem | `ImageWithFallback`, ratio 4:3 (`aspect-[4/3]`), `object-contain` |
| Badge de desconto | Calculado de `discount_percent` ou `(original - promo) / original * 100`. Exibido sobre a imagem |
| Badge "Pode ter expirado" | Aparece quando maioria dos votos de status é `"expired"` (>50% com mínimo 3 votos) |
| Badge de categoria | Com ícone e cor específica por categoria |
| Título | `font-semibold`, máx. 120 chars |
| Descrição | Máx. 3 linhas (`line-clamp-3`), opcional |
| Validade | Exibida se `expires_at` preenchido |
| Cupom | Botão de cópia com fallback para iOS WebView (`copyToClipboard`). Toast de confirmação |
| Preços | Preço promo em destaque (brand color) + original tachado. Só um preço também é válido |
| Votação de status | Apenas para não-donos logados: thumbsup (ativo) / thumbsdown (expirado). Bloqueia double-tap via `votingRef` |
| Autor | Avatar + nickname; navega para `/usuario/:userId` |
| Link externo | Abre via `Browser.open()` do `@capacitor/browser` (não `target="_blank"`) |
| Comentários | Ícone `MessageCircle` com contagem. Abre `PromotionCommentsDrawer` para discussão da comunidade |
| Curtir | Toggle coração com contagem. Optimistic update imediato + rollback em erro. Bloqueia race condition via `likingRef` |
| Menu dono (⋮) | Opções: Editar, Inativar, Remover. Visível apenas para o autor |

#### Curtir
- Usuário logado pode curtir/descurtir
- Optimistic update aplicado imediatamente na UI; rollback em caso de erro de rede
- `likingRef` previne race condition em cliques duplos rápidos
- Tabela: `promotion_likes (id, promotion_id, user_id)`

#### Comentários da Comunidade (`PromotionCommentsDrawer`)

- Qualquer usuário pode ler os comentários (sem login)
- Usuários autenticados podem comentar, editar e excluir os próprios comentários
- Drawer bottom-sheet (`max-h-[85dvh]`), abre ao tocar no ícone `MessageCircle`
- Contagem de comentários (`comments_count`) exibida ao lado do ícone
- Suporta edição inline (textarea substituível) e exclusão com `confirm()`
- Enter sem Shift envia/salva; Escape cancela edição
- Empty state com ícone e CTA convidando a primeira opinião
- Componente: `client/components/modals/promotion-comments-drawer.tsx`
- Tabela: `promotion_comments (id, promotion_id, user_id, text, created_at, updated_at)`
- Funções DB: `getPromotionCommentsDb`, `addPromotionCommentDb`, `updatePromotionCommentDb`, `deletePromotionCommentDb`

#### Votação de Status (Ativo/Expirado)
- Disponível para usuários logados que não são donos da promoção
- Toggle: votar no mesmo status remove o voto; votar no status oposto troca o voto
- Contadores `active_reports` e `expired_reports` atualizados otimisticamente
- `votingRef` previne race condition em double-tap
- Quando >50% dos votos (mínimo 3) são "expired", badge "Pode ter expirado" aparece na imagem

#### Publicar Promoção (`NewPromoDrawer`)

Fluxo em 2 passos:

**Passo 1 — Link:**
- Campo de URL + botão "Buscar"
- Chama `/api/link-preview` (funciona em dev; em iOS WebView, cai no catch e exibe mensagem amigável pedindo preenchimento manual)
- `external_link` é salvo automaticamente ao buscar

**Passo 2 — Revisão (exibido após busca ou falha):**
- **Título** (obrigatório, máx. 120 chars)
- **Descrição** (opcional, máx. 500 chars)
- **Categoria** (select, obrigatório)
- **Preço original / Preço promocional** (R$, opcional; validação: não-negativo, promo ≤ original)
- **Imagem:** toggle URL / Upload da galeria. Upload passa pelo `ImageCropperDrawer` (aspect 1:1) antes de fazer upload no Storage bucket `promotions`
- **Cupom** (opcional, máx. 30 chars, uppercase automático)
- **Válido até** (date picker com `min` = hoje)

Botão "Publicar" só aparece após o Passo 1.

#### Editar Promoção (`EditPromoDrawer`)
- Pré-popula todos os campos com os dados existentes da promoção
- Suporte a upload de imagem da galeria (igual ao `NewPromoDrawer`, com cropper)
- Mesmas validações de preço e data
- Campos: Título, Descrição, Categoria, Preços, Imagem (URL ou upload), Cupom, Válido até

#### Inativar / Remover
- Apenas o autor vê o menu ⋮
- **Inativar:** AlertDialog de confirmação → `is_active = false` → promoção some da lista. Em caso de erro, dialog permanece aberto
- **Remover:** AlertDialog de confirmação → `deletePromotionDb` → promoção some da lista. Em caso de erro, dialog permanece aberto

#### Empty State — Promoções
- Sem promoções + sem filtro: mensagem + botão "Publicar Promoção" (só para logados)
- Com categoria ativa e sem resultados: mensagem com nome da categoria + botão "Ver todas as categorias"
- Com busca textual: exibe o termo buscado e indica se também há filtro de categoria ativo

---

### Aba: Profissionais

Diretório de profissionais fitness com perfil comercial ativo.

**Busca:** filtra client-side por nome do negócio, nickname, descrição e segmento.

**Filtro por segmento:** dropdown com os segmentos de `SEGMENT_LABELS`.

#### Card de Profissional (`ProfessionalCard`)

| Elemento | Descrição |
|---|---|
| Banner / Logo | `business_logo_url` ou `photo` como overlay; avatar circular centralizado |
| Badge de segmento | Cor específica por segmento |
| Nome do negócio | `business_name` ou `nickname` como fallback |
| Handle | `@handle` |
| Descrição | `business_description`, máx. 2 linhas |
| Planos e preços | ≤3 planos exibidos lado a lado; >3 planos em carrossel paginado (3 por vez) com navegação anterior/próximo |
| Links de contato | WhatsApp, Email, Site — todos abertos via `Browser.open()` do `@capacitor/browser` |
| Botão "Ver perfil" | Navega para `/usuario/:userId` |
| Botão "Contatar" | Navega para `/comunidade?user=:userId` |
| Botão "Planos e Preços" | Clique em qualquer plano abre o `Dialog` de planos completo |

#### Modal de Planos (`Dialog`)
- Lista todos os `service_plans` do profissional
- Cada plano exibe: nome, preço (R$), descrição opcional
- Empty state se nenhum plano cadastrado

#### Empty State — Profissionais
- Com busca: "Nenhum profissional encontrado — tente outro termo"
- Com segmento filtrado + sem resultado: nome do segmento + botão "Ver todos os segmentos"
- Sem filtros + sem profissionais: explicação sobre perfil comercial + botão "Ativar perfil comercial" (navega para `/perfil`) para usuários logados

---

## Categorias de Promoção

| Valor | Label | Ícone | Cor |
|---|---|---|---|
| `equipamento` | Equipamento | Dumbbell | Azul |
| `suplemento` | Suplemento | ShoppingBag | Roxo |
| `alimento` | Alimento | Apple | Verde |
| `vestuario` | Vestuário | Shirt | Rosa |
| `servico` | Serviço | Briefcase | Laranja |
| `outro` | Outro | PackageOpen | Muted |

## Segmentos de Profissional

| Valor | Label | Cor |
|---|---|---|
| `personal_trainer` | Personal Trainer | Brand |
| `nutricionista` | Nutricionista | Verde |
| `fisioterapeuta` | Fisioterapeuta | Azul |
| `coach` | Coach | Roxo |
| `medico` | Médico / Dr. | Vermelho |
| `outro` | Outro | Muted |

---

## Dados

### Tabela: `promotions`

| Coluna | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | uuid PK | — | `gen_random_uuid()` |
| `user_id` | uuid FK → auth.users | ✓ | Autor |
| `title` | text | ✓ | Máx. 120 chars |
| `description` | text | — | Opcional, máx. 500 |
| `category` | text | ✓ | Ver categorias acima |
| `original_price` | numeric | — | Preço original (≥ 0) |
| `promo_price` | numeric | — | Preço promocional (≥ 0, ≤ original) |
| `discount_percent` | numeric | — | % de desconto alternativo |
| `photo_url` | text | — | URL da imagem ou URL pública do Storage |
| `external_link` | text | — | Link para compra |
| `coupon_code` | text | — | Cupom, máx. 30 chars |
| `expires_at` | timestamptz | — | Data de expiração (≥ hoje ao criar) |
| `is_active` | boolean | — | `true` (false = soft-delete) |
| `active_reports` | integer | — | Votos "ativo" acumulados |
| `expired_reports` | integer | — | Votos "expirado" acumulados |
| `created_at` | timestamptz | — | `now()` |

### Tabela: `promotion_likes`

| Coluna | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | uuid PK | — | `gen_random_uuid()` |
| `promotion_id` | uuid FK → promotions | ✓ | Promoção curtida |
| `user_id` | uuid FK → auth.users | ✓ | Usuário |
| `created_at` | timestamptz | — | `now()` |
| UNIQUE | `(promotion_id, user_id)` | — | Evita duplicatas |

### Tabela: `commercial_profiles` (profissionais)

| Coluna relevante | Descrição |
|---|---|
| `user_id` | FK → auth.users |
| `business_name` | Nome do negócio |
| `business_segment` | Ver segmentos acima |
| `business_description` | Descrição |
| `business_phone` | Telefone (usado para link WhatsApp) |
| `business_email` | Email de contato |
| `business_website` | Site |
| `business_logo_url` | Logo sobreposta no banner do card |
| `service_plans` | jsonb — array de `{ name, price, description }` |
| `is_active` | boolean — só aparece se `true` |

---

## Funções em `ritmofit-db.ts`

| Função | Descrição |
|---|---|
| `getPromotionsDb(category?)` | Lista promoções ativas com dados do autor, contagem de likes, votos de status e voto do viewer |
| `createPromotionDb(payload)` | Cria nova promoção |
| `updatePromotionDb(id, payload)` | Atualiza campos da promoção (usado para edição e inativação) |
| `deletePromotionDb(id)` | Soft-delete (`is_active = false`), apenas o dono |
| `togglePromotionLikeDb(id)` | Curtir/descurtir, retorna `"liked" \| "unliked"` |
| `reportPromotionStatusDb(id, status)` | Vota no status da promoção; retorna `"voted" \| "removed"` |
| `getProfessionalsDb(segment?)` | Lista usuários com `commercial_profiles` ativos, join com `profiles`. Filtra por segmento se fornecido |
| `getViewer()` | Retorna o usuário autenticado atual (com cache 30s) |

---

## Componentes Utilizados

| Componente | Origem |
|---|---|
| `Card`, `CardContent` | Shadcn |
| `Drawer`, `DrawerContent`, `DrawerHeader`, `DrawerFooter` | Shadcn |
| `Dialog`, `DialogContent`, `DialogHeader` | Shadcn |
| `Button`, `Input`, `Textarea`, `Select` | Shadcn |
| `AlertDialog` | Shadcn |
| `DropdownMenu` | Shadcn |
| `ImageWithFallback` | `components/shared/image-with-fallback` |
| `ImageCropperDrawer` | `components/shared/image-cropper-drawer` |
| `UserAvatar` | `components/shared/user-avatar` |
| `LoadingSpinner` | `components/shared/animated-loading` |
| `toast` | `components/ui/use-toast` |
| `Browser` | `@capacitor/browser` — para abrir links externos e contatos |

---

## Notas de Plataforma (iOS)

- **Links externos:** todos os links externos (produto, WhatsApp, email, site) são abertos via `Browser.open()` do `@capacitor/browser`, nunca com `<a target="_blank">`, conforme exigido pelo CLAUDE.md
- **Importação de link:** a rota `/api/link-preview` não existe em produção iOS (Capacitor WebView). O catch da `fetchLinkPreview` trata isso graciosamente, exibindo o formulário manual com mensagem explicativa
- **Clipboard:** `copyToClipboard()` usa `navigator.clipboard.writeText` com fallback para `document.execCommand('copy')` para compatibilidade com iOS WebView
- **Storage de imagens:** bucket Supabase `promotions`, path `{user_id}/{timestamp}.{ext}`, upload com `upsert: false`