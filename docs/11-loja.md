# 11 — Vitrine (Hub de Promoções e Profissionais)

**Rota:** `/loja`  
**Arquivo:** `client/pages/Store.tsx`

---

## Visão Geral

Hub comunitário com duas abas:
- **Promoções:** qualquer usuário pode divulgar promoções de produtos e serviços fitness — equipamentos, suplementos, alimentos saudáveis, vestuário esportivo e serviços. Funciona como marketplace social: sem pagamentos na plataforma, apenas divulgação com link externo.
- **Profissionais:** diretório de usuários com perfil comercial ativo (personal trainers, nutricionistas, fisioterapeutas, coaches, etc.). Permite descobrir e contatar profissionais diretamente pelo app.

---

## Estrutura Visual

```
┌─────────────────────────────────────────┐
│  Header sticky                          │
│  [🏷 Loja]               [+ Publicar]   │
│  [Promoções] [Profissionais]  ← tabs    │
│  [🔍 Buscar...]                         │
│  [Filtro de categoria/segmento]         │
├─────────────────────────────────────────┤
│  Grid 2 colunas                         │
│  (cards de promoção ou profissionais)   │
└─────────────────────────────────────────┘
```

---

## Funcionalidades

### Tabs de Navegação

| Tab | Descrição |
|---|---|
| Promoções | Feed de promoções de produtos/serviços fitness |
| Profissionais | Diretório de usuários com perfil comercial ativo |

O botão "+ Publicar" só aparece na aba Promoções.

---

### Aba: Profissionais

Diretório de profissionais fitness cadastrados com perfil comercial ativo.

**Busca:** input de texto filtra por nome do negócio, nickname, descrição e segmento (client-side).

**Filtro por segmento:** dropdown com os segmentos definidos em `SEGMENT_LABELS`:
- Personal Trainer
- Nutricionista
- Fisioterapeuta
- Coach
- Médico / Dr.
- Outro

**Card de Profissional:**
| Elemento | Descrição |
|---|---|
| Logo / Foto | `business_logo_url` ou `photo` do perfil como overlay; avatar circular centralizado |
| Badge de segmento | Cor específica por segmento |
| Nome do negócio | `business_name` ou `nickname` como fallback |
| Handle | `@handle` do usuário |
| Descrição | `business_description`, máx. 2 linhas |
| Planos e preços | Carrossel de planos: exibe um plano por vez com navegação anterior/próximo e indicador "N / total". Evita crescimento vertical ilimitado do card. |
| Links de contato | WhatsApp (`business_phone`), Email (`business_email`), Site (`business_website`) |
| Botão "Ver perfil" | Navega para `/usuario/:userId` |
| Botão "Contatar" | Navega para `/comunidade?user=:userId` |

**Dados carregados:** `getProfessionalsDb(segment?)` — join entre `commercial_profiles` e `profiles`. Inclui `service_plans` (jsonb).

**Empty state:**
- Com busca: "Nenhum profissional encontrado"
- Sem busca: "Ainda não há profissionais cadastrados" + explicação sobre perfil comercial

---

### Aba: Feed de Promoções
- Carrega todas as promoções ativas (`is_active = true`) da tabela `promotions`
- Ordenadas por `created_at` DESC
- Filtro por categoria via botão dropdown (expande ao clicar, mostra todas as opções)
- Busca textual (título, descrição, nome do autor) em tempo real (client-side)
- Grid responsivo: 1 coluna no mobile, 2 colunas em telas ≥ 640px

### Publicar Promoção (Drawer)
- Abre ao clicar em "+ Publicar" no header
- Campos:
  - **Título** (obrigatório, máx. 120 chars)
  - **Descrição** (opcional, máx. 500 chars)
  - **Categoria** (select: Equipamento, Suplemento, Alimento, Vestuário, Serviço, Outro)
  - **Preço original** (número, R$, opcional)
  - **Preço promocional** (número, R$, opcional)
  - **URL da imagem** (texto, com preview inline)
  - **Link externo** (URL do produto/loja)
  - **Válido até** (date picker, opcional)
- Desconto calculado automaticamente no card se `original_price` e `promo_price` forem fornecidos
- Toast de sucesso/erro após submissão

### Card de Promoção
| Elemento | Descrição |
|---|---|
| Imagem | Renderizada com `ImageWithFallback`, ratio 16:9 |
| Badge de desconto | Calculado automaticamente (% OFF), exibido sobre a imagem |
| Badge de categoria | Com ícone e cor específica por categoria |
| Título | Destaque, `font-semibold` |
| Descrição | Máx. 3 linhas (`line-clamp-3`) |
| Preço | Preço promo em destaque (brand color) + original tachado |
| Validade | Exibida se `expires_at` preenchido |
| Autor | Avatar + nickname + `formatTimeAgo` |
| Link externo | Ícone `ExternalLink`, abre em nova aba |
| Curtir | Toggle coração com contagem, otimista no estado local |
| Menu (dono) | Opção "Remover" (soft-delete: `is_active = false`) |

### Curtir
- Usuário logado pode curtir/descurtir qualquer promoção
- Tabela: `promotion_likes (id, promotion_id, user_id)`
- Estado atualizado otimisticamente no cliente

### Remover
- Apenas o autor pode ver o menu de remoção
- Soft-delete: atualiza `is_active = false`
- AlertDialog de confirmação antes de executar

---

## Categorias

| Valor | Label | Ícone | Cor |
|---|---|---|---|
| `equipamento` | Equipamento | Dumbbell | Azul |
| `suplemento` | Suplemento | ShoppingBag | Roxo |
| `alimento` | Alimento | Apple | Verde |
| `vestuario` | Vestuário | Shirt | Rosa |
| `servico` | Serviço | Briefcase | Laranja |
| `outro` | Outro | PackageOpen | Muted |

---

## Dados

### Tabela: `promotions` (a criar no Supabase)

| Coluna | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | uuid PK | — | `gen_random_uuid()` |
| `user_id` | uuid FK → auth.users | ✓ | Autor da promoção |
| `title` | text | ✓ | Título (máx. 120 chars) |
| `description` | text | — | Descrição detalhada |
| `category` | text | ✓ | equipamento/suplemento/alimento/vestuario/servico/outro |
| `original_price` | numeric | — | Preço original |
| `promo_price` | numeric | — | Preço com desconto |
| `discount_percent` | numeric | — | % de desconto (alternativo ao cálculo) |
| `photo_url` | text | — | URL da imagem do produto |
| `external_link` | text | — | Link para compra |
| `expires_at` | timestamptz | — | Data de expiração |
| `is_active` | boolean | — | `true` (soft-delete) |
| `created_at` | timestamptz | — | `now()` |

### Tabela: `promotion_likes` (a criar no Supabase)

| Coluna | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | uuid PK | — | `gen_random_uuid()` |
| `promotion_id` | uuid FK → promotions | ✓ | Promoção curtida |
| `user_id` | uuid FK → auth.users | ✓ | Usuário que curtiu |
| `created_at` | timestamptz | — | `now()` |
| UNIQUE | `(promotion_id, user_id)` | — | Evita duplicatas |

---

## Funções em `ritmofit-db.ts`

| Função | Descrição |
|---|---|
| `getPromotionsDb(category?)` | Lista promoções ativas com dados do autor e contagem de likes |
| `createPromotionDb(payload)` | Cria nova promoção |
| `deletePromotionDb(id)` | Soft-delete (is_active = false), apenas o dono |
| `togglePromotionLikeDb(id)` | Curtir/descurtir, retorna `"liked" \| "unliked"` |
| `getProfessionalsDb(segment?)` | Lista usuários com `commercial_profiles` ativos, join com `profiles`. Filtra por segmento se fornecido. |

---

## Componentes Utilizados

| Componente | Origem |
|---|---|
| `Card`, `CardContent` | Shadcn |
| `Drawer`, `DrawerContent`, `DrawerHeader`, `DrawerFooter` | Shadcn |
| `Button`, `Input`, `Textarea`, `Select` | Shadcn |
| `AlertDialog` | Shadcn |
| `DropdownMenu` | Shadcn |
| `ImageWithFallback` | `components/shared/image-with-fallback` |
| `LoadingSpinner` | `components/shared/animated-loading` |
| `toast` | `components/ui/use-toast` |
| `formatTimeAgo` | `lib/utils` |
