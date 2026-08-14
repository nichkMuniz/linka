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
- **Expirados:** botão toggle (ícone `History`) ao lado do filtro de categoria. Por padrão o feed mostra só promoções **válidas**; ao ativar, mostra **só** as expiradas. "Expirada" = `expires_at` já passou **ou** maioria dos votos de status (≥3 votos, >50%) marcou "expirou" (helper `isPromoExpired`). Busca e categoria continuam combinando com esse filtro

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
| Comentários | Ícone `MessageCircle` com contagem. Abre `PromotionCommentsDrawer` (drawer dedicado, atalho rápido a partir do grid) para discussão da comunidade |
| Curtir | Toggle coração com contagem. Optimistic update imediato + rollback em erro. Bloqueia race condition via `likingRef` |
| Menu dono (⋮) | Opções: Editar, Inativar, Remover. Visível apenas para o autor |

O clique no card (fora do menu ⋮ e do botão de comentários) abre o `PromotionDetailDrawer` — ver seção própria abaixo.

#### Drawer de Detalhe (`PromotionDetailDrawer`)

Abre ao tocar no card (fora das ações de rodapé). Mostra:

| Elemento | Descrição |
|---|---|
| Menu dono (⋮) | No cabeçalho, ao lado do título. Mesmas opções do card (Editar, Inativar, Remover), visível só para o autor. Cada ação fecha o drawer de detalhe antes de abrir o próximo passo (edição ou confirmação) |
| Imagem ampliada | `aspect-square`, `object-contain`, com badge de desconto e aviso "Pode ter expirado" quando aplicável |
| Categoria, preço, descrição, validade, cupom | Mesmos dados do card, em formato expandido |
| Votação de status | Sim/Expirou — só para não-donos logados |
| "Ir para a promoção" | Abre `external_link` via `Browser.open()` |
| Curtir | Toggle coração |
| **Comentários** | Seção `PromotionCommentsSection` **embutida** no fim do drawer — lista + composer completos (ler, comentar, editar e excluir), sem precisar sair do drawer nem abrir um sheet separado |

#### Curtir
- Usuário logado pode curtir/descurtir
- Optimistic update aplicado imediatamente na UI; rollback em caso de erro de rede
- `likingRef` previne race condition em cliques duplos rápidos
- Tabela: `promotion_likes (id, promotion_id, user_id)`
- **Notifica o dono (tipo 12, 2026-07-13):** ao curtir, `togglePromotionLikeDb` insere uma notificação (+ push) para o autor da promoção, deduplicada por (autor, curtidor, promoção) — descurtir e curtir de novo não gera novo aviso. Ver `docs/10-notificacoes.md`

#### Comentários da Comunidade

- Qualquer usuário pode ler os comentários (sem login)
- Usuários autenticados podem comentar, editar e excluir os próprios comentários
- Suporta edição inline (textarea substituível) e exclusão com `confirm()`
- Enter sem Shift envia/salva; Escape cancela edição
- Empty state com ícone e CTA convidando a primeira opinião
- Componente: `client/components/modals/promotion-comments-drawer.tsx`. A lógica (fetch, comentar, editar, excluir) vive no hook interno `usePromotionComments`, reaproveitado nas duas superfícies:
  - **`PromotionCommentsDrawer`** — drawer dedicado (bottom-sheet, altura fixa `min(60dvh, viewportHeight - 8px)`), aberto pelo ícone `MessageCircle` no rodapé do card do grid
  - **`PromotionCommentsSection`** — versão sem drawer/scroll próprios, **embutida** no fim do `PromotionDetailDrawer` (ver seção acima), para comentar sem sair do drawer de detalhe
- Contagem de comentários (`comments_count`) exibida ao lado do ícone no card e no cabeçalho da seção embutida
- Tabela: `promotion_comments (id, promotion_id, user_id, text, created_at, updated_at)`
- Funções DB: `getPromotionCommentsDb`, `addPromotionCommentDb`, `updatePromotionCommentDb`, `deletePromotionCommentDb`

#### Votação de Status (Ativo/Expirado)
- Disponível para usuários logados que não são donos da promoção
- Toggle: votar no mesmo status remove o voto; votar no status oposto troca o voto
- Contadores `active_reports` e `expired_reports` atualizados otimisticamente
- `votingRef` previne race condition em double-tap
- Quando >50% dos votos (mínimo 3) são "expired", badge "Pode ter expirado" aparece na imagem
- **Notifica o dono (tipo 13, 2026-07-13):** o voto que faz a promoção **cruzar** esse mesmo limiar avisa o autor ("{nome} marcou sua promoção como expirada"), com o apelido de quem fechou a maioria. `sendPromotionExpiredNotificationDb` reconstrói as contagens de antes do voto, então os votos seguintes não geram novo push. Ver `docs/10-notificacoes.md`

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
- **Preço original / Preço promocional** (R$, opcional; `type="text"` + `inputMode="decimal"` — só aceita dígitos e vírgula (`sanitizePriceInput`), nunca outros caracteres; validação: não-negativo, promo ≤ original; convertido vírgula→ponto via `parsePriceInput` antes de salvar)
- **Imagem:** toggle URL / Upload da galeria. Upload passa pelo `ImageCropperDrawer` (aspect 1:1) antes de fazer upload no Storage bucket `promotions`
- **Cupom** (opcional, máx. 30 chars, uppercase automático)
- **Válido até** (date picker com `min` = hoje). Botão próprio **"Limpar"** ao lado do label remove a data de forma confiável — o "x" nativo do `<input type="date">` no WKWebView/iOS às vezes não dispara o evento de mudança, então não dá pra depender dele (o nativo fica oculto via `[&::-webkit-clear-button]:hidden`)

Botão "Publicar" só aparece após o Passo 1.

#### Editar Promoção (`EditPromoDrawer`)
- Pré-popula todos os campos com os dados existentes da promoção (preços convertidos ponto→vírgula via `formatPriceInput`)
- Suporte a upload de imagem da galeria (igual ao `NewPromoDrawer`, com cropper)
- Mesmas validações de preço e data, mesmo botão "Limpar" na validade
- Campos: Título, Descrição, Categoria, Preços, Imagem (URL ou upload), Cupom, Válido até

#### Inativar / Remover
- Autor vê o menu ⋮ tanto no card do grid quanto no cabeçalho do `PromotionDetailDrawer`
- **Editar:** abre o `EditPromoDrawer` (fecha o drawer de detalhe antes, se aberto por lá)
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

**Filtro por segmento:** dropdown com os segmentos de `SEGMENT_LABEL_KEYS` + "Todos os segmentos".

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

O `label` de `PROMOTION_CATEGORIES` (em `ritmofit-db.ts`) é só PT e **não é exibido** — a tela resolve o texto pelo mapa `CATEGORY_LABEL_KEYS`, que aponta cada valor para uma chave de i18n (`categoryLabel(cat, t)`).

| Valor | Chave i18n | PT | EN | Ícone | Cor |
|---|---|---|---|---|---|
| `equipamento` | `store_cat_equipamento` | Equipamento | Equipment | Dumbbell | Azul |
| `suplemento` | `store_cat_suplemento` | Suplemento | Supplement | ShoppingBag | Roxo |
| `alimento` | `store_cat_alimento` | Alimento | Food | Apple | Verde |
| `vestuario` | `store_cat_vestuario` | Vestuário | Apparel | Shirt | Rosa |
| `servico` | `store_cat_servico` | Serviço | Service | Briefcase | Laranja |
| `outro` | `store_cat_outro` | Outro | Other | PackageOpen | Muted |

## Segmentos de Profissional

Os valores abaixo são exatamente os que o cadastro (`Login.tsx`) e o `settings-drawer` gravam em `commercial_profiles.business_segment`. O mapa `SEGMENT_LABEL_KEYS` reaproveita as chaves `seg_*` já usadas no Perfil, então o mesmo segmento aparece com o mesmo nome nas duas telas.

> **Correção 2026-08-14:** a lista antiga da Vitrine tinha `medico` e `outro` (valores que nunca são gravados) e não tinha `academia` nem `psicologo` — o filtro oferecia segmentos inexistentes e mostrava o valor cru (`outros`) para quem se cadastrava como "Outros".

| Valor | Chave i18n | PT | EN | Cor |
|---|---|---|---|---|
| `academia` | `seg_academia` | Academia / Fitness | Gym / Fitness | Laranja |
| `personal_trainer` | `seg_personal_trainer` | Personal Trainer | Personal Trainer | Brand |
| `nutricionista` | `seg_nutricionista` | Nutricionista | Nutritionist | Verde |
| `psicologo` | `seg_psicologo` | Psicólogo | Psychologist | Vermelho |
| `fisioterapeuta` | `seg_fisioterapeuta` | Fisioterapeuta | Physical Therapist | Azul |
| `coach` | `seg_coach` | Coach | Coach | Roxo |
| `outros` | `seg_outros` | Outros | Others | Muted |

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

## Internacionalização (PT / EN)

Desde 2026-08-14 a tela **não tem mais nenhuma string em português no JSX**. Tudo passa por `useLanguage()` → `t("chave")`, com as chaves declaradas nas duas línguas em `client/lib/i18n.ts` sob o prefixo `store_`.

| Área | Chaves |
|---|---|
| Cabeçalho, abas e filtros | `store_title`, `store_publish`, `store_tab_promotions`, `store_tab_professionals`, `store_search_promos_placeholder`, `store_search_pros_placeholder`, `store_category_all`, `store_filter_expired`, `store_segment_all` |
| Categorias | `store_cat_*` (ver tabela de categorias) |
| Card e drawer de detalhe | `store_view_details`, `store_more_options`, `store_deactivate`, `store_expired_badge`, `store_expired_badge_maybe`, `store_maybe_expired`, `store_valid_until`, `store_coupon_copied`, `store_still_active`, `store_mark_active`, `store_mark_expired`, `store_yes`, `store_expired_vote`, `store_go_to_promo`, `store_like`, `store_liked` |
| Estados vazios (promoções) | `store_empty_title`, `store_empty_search_title`, `store_empty_expired_title`, `store_empty_expired_desc`, `store_empty_search_desc`, `store_empty_search_desc_cat`, `store_empty_category_desc`, `store_empty_cta_desc`, `store_see_all_categories`, `store_publish_promo` |
| Toasts da tela | `store_load_error`, `store_pro_load_error`, `store_login_to_vote`, `store_vote_error`, `store_login_to_like`, `store_like_error`, `store_deactivated`, `store_deactivate_error`, `store_removed`, `store_remove_error` |
| Publicar / editar | `store_new_promo_title`, `store_edit_promo_title`, `store_step1_title`, `store_link_placeholder`, `store_fetch`, `store_link_hint`, `store_link_imported`, `store_step2_title`, `store_field_*`, `store_title_placeholder`, `store_desc_placeholder`, `store_desc_placeholder_short`, `store_image_gallery`, `store_pick_from_gallery`, `store_optional`, `store_coupon_placeholder`, `store_clear`, `store_uploading_image`, `store_publishing`, `store_save_changes`, validações (`store_title_required`, `store_title_empty`, `store_price_*`), importação (`store_import_*`), `store_published`, `store_publish_error`, `store_updated`, `store_update_error` |
| Confirmações | `store_deactivate_confirm_title`, `store_deactivate_confirm_desc`, `store_no_back`, `store_yes_deactivate`, `store_remove_confirm_title`, `store_remove_confirm_desc` |
| Profissionais | `store_pro_empty_*`, `store_see_all_segments`, `store_activate_commercial`, `store_prev_plans`, `store_next_plans`, `store_website`, `store_view_profile`, `store_contact`, `store_plans_title`, `store_plans_empty`, `store_email_title`, `store_email_copied`, `store_copied`, `store_copy_email` |
| Comentários da promoção | `store_comments_drawer_title`, `store_comments_drawer_desc`, `store_comments_aria`, `store_comments_empty`, `store_comments_empty_desc`, `store_comments_login_hint`, `store_comment_placeholder`, `store_comment_btn`, `store_comment_edit_aria`, `store_comment_delete_aria`, `store_comments_load_error`, `store_comment_empty`, `store_comment_empty_desc`, `store_comment_login`, `store_comment_login_desc`, `store_comment_sent`, `store_comment_send_error`, `store_comment_edited`, `store_comment_edit_error`, `store_comment_delete_confirm`, `store_comment_deleted`, `store_comment_delete_error` |

**Reaproveitadas do bloco geral:** `edit`, `remove`, `cancel`, `save`, `saving`, `sending`, `retry`, `comments_title` — e os `seg_*` do Perfil para os segmentos.

**Strings com variável:** `store_view_details` (`{title}`), `store_valid_until` (`{date}`), `store_empty_search_desc` / `_cat` (`{q}`), `store_empty_category_desc` (`{cat}`), `store_pro_empty_segment_desc` (`{seg}`) — resolvidas com `.replace("{x}", valor)`.

**Datas:** o helper `formatDate(value, language)` e o `toLocaleString` dos comentários usam `en-US` quando o idioma ativo é EN, e `pt-BR` caso contrário.

**Não traduzido de propósito:** "WhatsApp", "URL" e "Email" (rótulo do link de contato) — idênticos nas duas línguas. Os preços seguem em **R$** por serem valores reais em reais.

---

## Notas de Plataforma (iOS)

- **Links externos:** todos os links externos (produto, WhatsApp, email, site) são abertos via `Browser.open()` do `@capacitor/browser`, nunca com `<a target="_blank">`, conforme exigido pelo CLAUDE.md
- **Importação de link:** a rota `/api/link-preview` não existe em produção iOS (Capacitor WebView). O catch da `fetchLinkPreview` trata isso graciosamente, exibindo o formulário manual com mensagem explicativa
- **Clipboard:** `copyToClipboard()` usa `navigator.clipboard.writeText` com fallback para `document.execCommand('copy')` para compatibilidade com iOS WebView
- **Storage de imagens:** bucket Supabase `promotions`, path `{user_id}/{timestamp}.{ext}`, upload com `upsert: false`

---

## Design dos Drawers (Glass)

Os drawers de promoção — **Visualizar** (`PromotionDetailDrawer`), **Nova** (`NewPromoDrawer`) e **Editar** (`EditPromoDrawer`) — seguem o padrão **glass escuro** do novo design, importando os tokens de `client/lib/glass-styles.ts` (`GLASS_SHEET_PROPS`, `GLASS_SHEET_STYLE`, `GLASS_FIELD_*`, `GLASS_PRIMARY_BTN_STYLE`, `GLASS_LABEL_CLASS`). Ver `docs/15-design-system.md` §9.4 para o padrão completo. A área scrollável usa `flex-1 min-h-0 overflow-y-auto overflow-x-hidden` dentro do shell `flex flex-col` — o `overflow-x-hidden` + `min-w-0`/`w-full` nos inputs da grid de preços evita scroll lateral indesejado nos formulários.