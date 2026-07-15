# 14 — Database Schema (Supabase / PostgreSQL)

Documentação técnica de todas as tabelas do banco de dados público (`public`) do projeto RitmoFit.

---

## Índice de Tabelas

| Tabela | Descrição resumida |
|---|---|
| [access_sessions](#access_sessions) | Sessões de acesso dos usuários |
| [screen_time_logs](#screen_time_logs) | Tempo por tela por usuário |
| [check_ins](#check_ins) | Check-ins diários de treino |
| [comments](#comments) | Comentários em posts |
| [commercial_offers](#commercial_offers) | Ofertas/produtos publicados por perfis comerciais |
| [commercial_profiles](#commercial_profiles) | Perfis comerciais / vitrines |
| [diets](#diets) | Catálogo de dietas disponíveis |
| [duel_check_ins](#duel_check_ins) | Check-ins dentro de grupos de duelo |
| [duel_group_participants](#duel_group_participants) | Participantes de grupos de duelo |
| [duel_groups](#duel_groups) | Grupos de duelo entre usuários |
| [exercises](#exercises) | Catálogo de exercícios |
| [flow](#flow) | Posts de Flow (Stories) |
| [flow_comments](#flow_comments) | Comentários em Flows |
| [flow_complaint](#flow_complaint) | Denúncias de Flows |
| [flow_likes](#flow_likes) | Curtidas em Flows |
| [followers](#followers) | Seguidores de um usuário |
| [following](#following) | Usuários que alguém segue |
| [goals](#goals) | Catálogo de metas disponíveis |
| [habits](#habits) | Catálogo de hábitos disponíveis |
| [likes](#likes) | Curtidas em posts |
| [message_deletions](#message_deletions) | Soft-delete de mensagens por usuário |
| [messages](#messages) | Mensagens diretas entre usuários |
| [notifications](#notifications) | Notificações de usuários |
| [post_complaint](#post_complaint) | Denúncias de posts |
| [post_tags](#post_tags) | Pessoas marcadas em posts (estilo Instagram) |
| [posts](#posts) | Posts do feed |
| [promotion_comments](#promotion_comments) | Comentários em promoções da Vitrine |
| [promotion_likes](#promotion_likes) | Curtidas em promoções |
| [promotion_status_reports](#promotion_status_reports) | Votos de status (ativa/expirada) de promoções |
| [promotions](#promotions) | Promoções publicadas na Vitrine |
| [profiles](#profiles) | Perfil público dos usuários |
| [ranking](#ranking) | Pontuação e nível dos usuários |
| [routines](#routines) | Rotinas de treino dos usuários |
| [shots](#shots) | Vídeos Shots |
| [shots_comments](#shots_comments) | Comentários em Shots |
| [shots_complaint](#shots_complaint) | Denúncias de Shots |
| [shots_likes](#shots_likes) | Curtidas em Shots |
| [shot_user_viewed](#shot_user_viewed) | Registro de visualizações de Shots |
| [store_catalog](#store_catalog) | Catálogo de produtos de vitrines |
| [subscriptions](#subscriptions) | Assinatura premium por usuário (Fase 1: manual; Fase 2: RevenueCat) |
| [user_complaint](#user_complaint) | Denúncias de usuários |
| [user_diets](#user_diets) | Dietas ativas do usuário |
| [user_diets_hist](#user_diets_hist) | Histórico de dietas do usuário |
| [user_food_logs](#user_food_logs) | Diário alimentar (alimentos consumidos por dia/refeição) |
| [user_nutrition_goals](#user_nutrition_goals) | Meta diária de calorias/macros do usuário |
| [user_goals](#user_goals) | Metas ativas do usuário |
| [user_habits](#user_habits) | Hábitos ativos do usuário |
| [user_habits_hist](#user_habits_hist) | Histórico de hábitos do usuário |
| [flow_user_viewed](#flow_user_viewed) | Registro de visualizações de Flows |
| [user_workouts](#user_workouts) | Treinos salvos do usuário |
| [user_workouts_hist](#user_workouts_hist) | Histórico de treinos realizados |
| [workouts](#workouts) | Catálogo de treinos disponíveis |

---

## promotions

Promoções publicadas pelos usuários na aba "Promoções" da Vitrine.

| Coluna | Tipo | Restrições | Descrição |
|---|---|---|---|
| id | uuid | PK, default gen_random_uuid() | ID da promoção |
| user_id | uuid | FK → auth.users, NOT NULL | Autor da promoção |
| title | text | NOT NULL, max 120 chars | Título da promoção |
| description | text | nullable, max 500 chars | Descrição opcional |
| category | text | NOT NULL | equipamento / suplemento / alimento / vestuario / servico / outro |
| original_price | numeric | nullable, ≥ 0 | Preço original |
| promo_price | numeric | nullable, ≥ 0, ≤ original | Preço promocional |
| discount_percent | numeric | nullable | % de desconto |
| photo_url | text | nullable | URL da imagem (Storage) |
| external_link | text | nullable | Link externo da promoção |
| coupon_code | text | nullable, max 30 chars | Código de cupom (uppercase) |
| expires_at | timestamptz | nullable | Data de expiração |
| is_active | boolean | default true | Soft-delete |
| active_reports | integer | default 0 | Votos "ativo" (legacy, substituído por promotion_status_reports) |
| expired_reports | integer | default 0 | Votos "expirado" (legacy) |
| created_at | timestamptz | default now() | Data de criação |

**RLS:** Leitura pública (is_active=true); criação/edição/exclusão apenas pelo owner.

---

## promotion_likes

Curtidas em promoções.

| Coluna | Tipo | Restrições | Descrição |
|---|---|---|---|
| id | uuid | PK | ID do like |
| promotion_id | uuid | FK → promotions | Promoção curtida |
| user_id | uuid | FK → auth.users | Usuário que curtiu |
| created_at | timestamptz | default now() | Data |

**Unique:** (promotion_id, user_id) — um like por usuário por promoção.

---

## promotion_status_reports

Votos de status (ativa/expirada) por usuário.

| Coluna | Tipo | Restrições | Descrição |
|---|---|---|---|
| id | uuid | PK | ID do voto |
| promotion_id | uuid | FK → promotions | Promoção votada |
| user_id | uuid | FK → auth.users | Usuário que votou |
| status | text | "active" \| "expired" | Resultado do voto |
| created_at | timestamptz | default now() | Data |

**Unique:** (promotion_id, user_id, status).

---

## promotion_comments

Comentários da comunidade em promoções (discussão sobre validade, qualidade, experiência).

| Coluna | Tipo | Restrições | Descrição |
|---|---|---|---|
| id | uuid | PK, default gen_random_uuid() | ID do comentário |
| promotion_id | uuid | FK → promotions, NOT NULL | Promoção comentada |
| user_id | uuid | FK → auth.users, NOT NULL | Autor do comentário |
| text | text | NOT NULL, max 500 chars | Conteúdo do comentário |
| created_at | timestamptz | default now() | Data de criação |
| updated_at | timestamptz | nullable | Data da última edição |

**RLS:** Leitura pública; inserção apenas para usuários autenticados; edição/exclusão apenas pelo owner.

**SQL de criação:**
```sql
CREATE TABLE public.promotion_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text text NOT NULL CHECK (char_length(text) <= 500),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz
);

ALTER TABLE public.promotion_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promotion_comments_select" ON public.promotion_comments
  FOR SELECT USING (true);

CREATE POLICY "promotion_comments_insert" ON public.promotion_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "promotion_comments_update" ON public.promotion_comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "promotion_comments_delete" ON public.promotion_comments
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX promotion_comments_promotion_id_idx ON public.promotion_comments(promotion_id);
CREATE INDEX promotion_comments_created_at_idx ON public.promotion_comments(created_at);
```

---

## access_sessions

Registra cada sessão de acesso de um usuário ao app, com duração em segundos.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único da sessão |
| `user_id` | uuid | FK → `auth.users` | — | Usuário que acessou |
| `duration_seconds` | integer | ✓ | — | Duração da sessão em segundos |
| `session_date` | date | ✓ | — | Data da sessão |
| `created_at` | timestamptz | — | `now()` | Data de criação do registro |

---

## screen_time_logs

Registra o tempo que cada usuário passou em cada tela do app. Um registro é inserido sempre que o usuário navega para outra tela ou encerra a sessão.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único do log |
| `user_id` | uuid | FK → `auth.users` | — | Usuário que navegou |
| `screen` | text | ✓ | — | Pathname da tela (ex: `/`, `/shots`, `/metas`) |
| `duration_seconds` | integer | ✓ | — | Segundos na tela |
| `log_date` | date | ✓ | — | Data do log |
| `created_at` | timestamptz | — | `now()` | Data de criação do registro |

### SQL de criação

```sql
create table public.screen_time_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  screen           text not null,
  duration_seconds integer not null,
  log_date         date not null,
  created_at       timestamptz default now()
);

-- RLS
alter table public.screen_time_logs enable row level security;

create policy "Usuário insere apenas seus próprios logs"
  on public.screen_time_logs for insert
  with check (auth.uid() = user_id);

create policy "Usuário lê apenas seus próprios logs"
  on public.screen_time_logs for select
  using (auth.uid() = user_id);

-- Índice para queries analíticas por usuário e data
create index screen_time_logs_user_date_idx
  on public.screen_time_logs (user_id, log_date desc);
```

---

## check_ins

Registra os check-ins diários de treino do usuário.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único |
| `user_id` | uuid | FK → `auth.users` | — | Usuário que fez check-in |
| `check_in_date` | date | ✓ | — | Data do check-in |
| `day_of_week` | integer | ✓ | — | Dia da semana (0–6) |
| `created_at` | timestamptz | — | `now()` | Data de criação |
| `updated_at` | timestamptz | — | `now()` | Data de atualização |

---

## comments

Comentários feitos por usuários em posts do feed.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único |
| `user_id` | uuid | FK → `auth.users` | — | Autor do comentário |
| `post_id` | uuid | FK → `posts.id` | — | Post comentado |
| `text` | text | — | — | Conteúdo do comentário |
| `created_at` | timestamp | — | `now()` | Data de criação |

---

## commercial_offers

Ofertas e produtos publicados por usuários com perfil comercial.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único |
| `user_id` | uuid | FK → `auth.users` | — | Usuário dono da oferta |
| `title` | text | ✓ | — | Título da oferta |
| `price` | text | ✓ | — | Preço (texto livre, ex: "R$ 49,90") |
| `link_url` | text | ✓ | — | URL de destino da oferta |
| `coupon_code` | text | — | — | Código de cupom opcional |
| `image_url` | text | ✓ | — | URL da imagem da oferta |
| `additional_info` | text | — | — | Informações adicionais |
| `is_active` | boolean | — | `true` | Se a oferta está ativa |
| `view_count` | integer | — | `0` | Contador de visualizações |
| `click_count` | integer | — | `0` | Contador de cliques |
| `created_at` | timestamptz | — | `now()` | Data de criação |

**SQL para criar a tabela:**
```sql
create table public.commercial_offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  price text not null,
  link_url text not null,
  coupon_code text,
  image_url text not null,
  additional_info text,
  is_active boolean not null default true,
  view_count integer not null default 0,
  click_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.commercial_offers enable row level security;

create policy "Qualquer um pode ver ofertas ativas"
  on public.commercial_offers for select
  using (is_active = true or auth.uid() = user_id);

create policy "Usuário pode criar suas próprias ofertas"
  on public.commercial_offers for insert
  with check (auth.uid() = user_id);

create policy "Usuário pode editar suas próprias ofertas"
  on public.commercial_offers for update
  using (auth.uid() = user_id);

create policy "Usuário pode deletar suas próprias ofertas"
  on public.commercial_offers for delete
  using (auth.uid() = user_id);
```

---

## commercial_profiles

Perfil comercial de usuários que atuam como vitrine ou negócio.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único |
| `user_id` | uuid | UNIQUE, FK → `auth.users` | — | Usuário dono do perfil comercial |
| `business_segment` | text | — | — | Segmento do negócio |
| `business_name` | text | — | — | Nome do negócio |
| `business_description` | text | — | — | Descrição do negócio |
| `business_phone` | text | — | — | Telefone de contato |
| `business_email` | text | — | — | E-mail de contato |
| `business_website` | text | — | — | Site do negócio |
| `business_logo_url` | text | — | — | URL do logotipo |
| `business_banner_url` | text | — | — | URL do banner |
| `is_active` | boolean | — | `true` | Perfil ativo ou não |
| `created_at` | timestamptz | — | `now()` | Data de criação |
| `updated_at` | timestamptz | — | `now()` | Data de atualização |

---

## diets

Catálogo de dietas disponíveis na plataforma.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | bigint | PK (identity) | — | Identificador único |
| `name` | text | ✓ | — | Nome da dieta (PT) |
| `description` | text | ✓ | — | Descrição da dieta (PT) |
| `name_eng` | text | — | — | Nome da dieta em inglês (para usuários estrangeiros). Ver `docs/migrations/20260704-catalog-eng-columns.sql` |
| `description_eng` | text | — | — | Descrição da dieta em inglês. Populada a partir de tradução PT→EN (`docs/migrations/20260704-catalog-eng-data.sql`) |
| `photo` | bytea | — | — | Imagem da dieta (binário) |
| `created_at` | timestamptz | ✓ | `now()` | Data de criação |
| `calories` | real | — | — | Calorias associadas (por porção) |
| `mealdb_id` | integer | — | — | ID de referência no MealDB |
| `category` | text | — | — | Categoria da dieta |
| `protein_g` | real | — | — | Proteína por porção (g). Migração `20260714-food-diary.sql` |
| `carbs_g` | real | — | — | Carboidrato por porção (g) |
| `fat_g` | real | — | — | Gordura por porção (g) |
| `fiber_g` | real | — | — | Fibras por porção (g) |
| `sugar_g` | real | — | — | Açúcar por porção (g). Migração `20260714-water-sugar.sql`. **Precisa ser populado** — sem ele, a insígnia `sem_acucar_7d` fica inalcançável (`null` = desconhecido, não zero) |
| `food_quality` | text | — | — | Classificação NOVA simplificada: `in_natura` \| `processado` \| `ultraprocessado` |
| `created_by_user` | boolean | — | `false` | `true` quando o alimento foi cadastrado pelo próprio usuário (criar alimento no wizard de rotina ou registro manual no diário alimentar) |
| `created_by` | uuid | — | — | FK → `auth.users` ON DELETE CASCADE. Dono do item custom; `NULL` nos itens de catálogo. Migração `20260714-custom-items-owner.sql`. **É o que define a visibilidade**: `getDietsDb` mostra o item custom para o seu criador independentemente de existir vínculo em `user_diets` — antes a autoria era inferida do vínculo, e um alimento criado sem virar rotina desaparecia |

**RLS:** leitura pública. Escrita (`insert`/`update`/`delete`) só é permitida em linhas com `created_by_user = true and created_by = auth.uid()` — ninguém edita o catálogo do sistema pelo app.

---

## duel_check_ins

Check-ins realizados dentro de um grupo de duelo.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único |
| `group_id` | uuid | FK → `duel_groups.id` | — | Grupo de duelo |
| `user_id` | uuid | FK → `auth.users` | — | Usuário que fez check-in |
| `user_name` | text | ✓ | — | Nome do usuário (denormalizado) |
| `user_photo` | text | — | — | URL da foto de perfil do usuário (denormalizada) |
| `photo` | text | — | — | URL da foto do check-in |
| `description` | text | — | — | Descrição do check-in |
| `workout_info` | text | — | — | Informações do treino realizado |
| `series` | bigint | — | `0` | Número de séries |
| `volume` | numeric | — | `0` | Volume de treino |
| `created_at` | timestamptz | — | `now()` | Data de criação |
| `updated_at` | timestamptz | — | `now()` | Data de atualização |
| `muscle_group` | text | — | - | Grupo muscular principal (mais frequente entre os exercícios do check-in) |
| `muscle_groups` | text[] | — | `NULL` | **(2026-07-02)** Todos os grupos musculares distintos trabalhados no check-in (ex: `{Pernas,Ombros}`); um treino de vários grupos mostra uma tag por grupo em vez de só o mais frequente. Ver `docs/migrations/20260702-duel-checkin-muscle-groups.sql` |
| `exercises` | text | — | - | JSON (`JSON.stringify`) com a lista de exercícios do check-in (nome, grupo muscular, carga, volume) — nome real da coluna; a linha anterior desta tabela ("exercice") estava desatualizada |
| `duration_minutes` | integer | — | — | Duração do treino em minutos (scoring type `duration`) |
| `distance_km` | numeric(8,2) | — | — | Distância percorrida em km (scoring type `distance`) |
| `steps` | integer | — | — | Passos dados (scoring type `steps`) |
| `calories` | integer | — | — | Calorias queimadas (scoring type `calories`) |

---

## duel_group_participants

Participantes de um grupo de duelo.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único |
| `group_id` | uuid | FK → `duel_groups.id` | — | Grupo de duelo |
| `user_id` | uuid | FK → `auth.users` | — | Participante |
| `joined_at` | timestamptz | — | `now()` | Data de entrada no grupo |
| `status` | text | — | — | Status do participante (ex: `pending`, `accepted`) |

---

## duel_groups

Grupos de duelo criados por usuários para desafios coletivos.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único |
| `created_by` | uuid | FK → `auth.users` | — | Criador do grupo |
| `name` | text | ✓ | — | Nome do grupo |
| `location` | text | ✓ | — | Localização do desafio |
| `goal` | text | ✓ | — | Objetivo do duelo |
| `icon` | text | — | `'⚔️'` | Ícone representativo |
| `created_at` | timestamptz | — | `now()` | Data de criação |
| `updated_at` | timestamptz | — | `now()` | Data de atualização |
| `end_date` | timestamptz | — | — | Data de encerramento do duelo |
| `photo` | text | — | — | URL da foto do grupo |

---

## exercises

Catálogo de exercícios físicos importados (ex: wger / free-exercise-db).

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | text | PK | — | Identificador único (string) |
| `name` | text | ✓ | — | Nome do exercício |
| `force` | text | — | — | Tipo de força (push, pull, static) |
| `level` | text | — | — | Nível (beginner, intermediate, expert) |
| `mechanic` | text | — | — | Mecânica (compound, isolation) |
| `equipment` | text | — | — | Equipamento necessário |
| `category` | text | — | — | Categoria muscular |
| `primary_muscles` | text[] | — | — | Músculos primários trabalhados |
| `secondary_muscles` | text[] | — | — | Músculos secundários |
| `instructions` | text[] | — | — | Instruções de execução |
| `images` | text[] | — | — | URLs das imagens |
| `created_at` | timestamptz | — | `now()` | Data de inserção |

---

## flow

Posts de Flow (formato Stories, mídia efêmera).

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | bigint | PK (identity) | — | Identificador único |
| `user_id` | uuid | FK → `auth.users` | — | Autor do Flow |
| `description` | text | ✓ | — | Legenda do Flow |
| `media_url` | text | ✓ | — | URL da mídia (imagem/vídeo). Vazio quando o Flow é só texto/gradient. |
| `background_color` | text | — | `null` | Gradient CSS de fundo para Flows somente-texto. |
| `text_position` | jsonb | — | `null` | **Legado**. Posição única em flows antigos de texto: `{ "x": number, "y": number }` em % (0–100). Substituído por `text_elements`. |
| `text_elements` | jsonb | — | `null` | Lista de textos em Flows somente-texto: `[{ "text": string, "x": number, "y": number }]` com x/y em % (0–100). Cada elemento pode ser arrastado independentemente pelo autor. |
| `media_transform` | jsonb | — | `null` | Enquadramento da **mídia em vídeo** ajustado na criação (pinça/arraste): `{ "scale": number, "x": number, "y": number }`, onde `x`/`y` são translação em **% do tamanho do elemento** (resolução-independente). Aplicado via CSS `transform` no viewer. Imagens **não** usam este campo (o ajuste é composto no canvas antes do upload). |
| `created_at` | timestamptz | ✓ | `now()` | Data de publicação |

> **Migração (rodar no Supabase SQL Editor):**
> ```sql
> ALTER TABLE public.flow ADD COLUMN IF NOT EXISTS media_transform jsonb;
> ```
> Enquanto a coluna não existir, o app degrada graciosamente (vídeos são salvos sem o enquadramento; o código detecta `42703` e reenvia sem o campo).

---

## flow_comments

Comentários em posts de Flow.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único |
| `user_id` | uuid | — | — | Autor do comentário |
| `text` | text | — | — | Conteúdo do comentário |
| `created_at` | timestamp | — | `now()` | Data de criação |
| `user_handle` | text | — | — | Handle do autor (denormalizado) |
| `read` | smallint | — | — | Flag de leitura |
| `flow_id` | bigint | — | — | Flow comentado |

---

## flow_complaint

Denúncias de conteúdo de Flows por usuários.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | bigint | PK (identity) | — | Identificador único |
| `user_id` | uuid | FK → `auth.users` | — | Usuário que denunciou |
| `flow_id` | bigint | ✓ | — | Flow denunciado |
| `reason` | text | — | — | Motivo da denúncia |
| `created_at` | timestamptz | ✓ | `now()` | Data da denúncia |

---

## flow_likes

Curtidas em posts de Flow.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único |
| `user_id` | uuid | ✓ | — | Usuário que curtiu |
| `type` | smallint | ✓ | — | Tipo de reação |
| `created_at` | timestamptz | ✓ | `now()` | Data da curtida |
| `flow_id` | smallint | — | — | Flow curtido |

> **Atenção:** `flow_id` é `smallint`, o que pode causar overflow para IDs grandes (bigint). Verificar se há necessidade de migração.

---

## followers

Registro de quem segue um usuário.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | bigint | PK (identity) | — | Identificador único |
| `user_id` | uuid | ✓ | — | Usuário seguido |
| `created_at` | timestamptz | ✓ | `now()` | Data do follow |
| `follower_id` | uuid | — | — | Quem está seguindo |

**Índices** (`docs/migrations/20260702-performance-indexes.sql`): `followers_user_id_idx (user_id)`, `followers_follower_id_idx (follower_id)` — cobrem os filtros usados por `getFollowersDb`/`getFollowingIdsDb`.

---

## following

Registro de quem um usuário segue.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | bigint | PK (identity) | — | Identificador único |
| `user_id` | uuid | ✓ | — | Usuário que está seguindo |
| `created_at` | timestamptz | ✓ | `now()` | Data do follow |
| `following_id` | uuid | — | — | Usuário sendo seguido |

> **Nota:** `followers` e `following` são tabelas simétricas. Uma ação de follow deve inserir em ambas.

**Índices** (`docs/migrations/20260702-performance-indexes.sql`): `following_user_id_idx (user_id)`, `following_following_id_idx (following_id)` — cobrem os filtros usados por `getFollowingDb`/`getFollowersDb`.

---

## goals

Catálogo de metas pré-definidas disponíveis na plataforma.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | bigint | PK (identity) | — | Identificador único |
| `description` | text | ✓ | `''` | Descrição da meta |
| `duration` | bigint | ✓ | — | Duração (dias) |
| `quantity` | bigint | ✓ | — | Quantidade alvo |
| `created_at` | timestamptz | ✓ | `now()` | Data de criação |
| `type` | smallint | — | — | Tipo da meta |
| `created_by_user` | smallint | — | `0` | Flag: criado por usuário ou sistema |

---

## habits

Catálogo de hábitos pré-definidos disponíveis na plataforma.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | bigint | PK (identity) | — | Identificador único |
| `name` | text | ✓ | — | Nome do hábito (PT) |
| `description` | text | ✓ | — | Descrição do hábito (PT) |
| `name_eng` | text | — | — | Nome do hábito em inglês (para usuários estrangeiros). Ver `docs/migrations/20260704-catalog-eng-columns.sql` |
| `description_eng` | text | — | — | Descrição do hábito em inglês. Populada a partir de tradução PT→EN (`docs/migrations/20260704-catalog-eng-data.sql`) |
| `photo` | bytea | — | — | Imagem do hábito (binário) |
| `created_at` | timestamptz | ✓ | `now()` | Data de criação |
| `created_by_user` | boolean | — | `false` | `true` quando o hábito foi criado manualmente pelo usuário no wizard de rotina |
| `created_by` | uuid | — | — | FK → `auth.users` ON DELETE CASCADE. Dono do hábito custom; `NULL` no catálogo. Migração `20260714-custom-items-owner.sql`. Define a visibilidade em `getHabitsDb` (mesma regra de `diets.created_by`) |

**RLS:** leitura pública; escrita só nas linhas do próprio usuário (`created_by_user = true and created_by = auth.uid()`).

---

## likes

Curtidas em posts do feed.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único |
| `user_id` | uuid | ✓ | — | Usuário que curtiu |
| `post_id` | uuid | FK → `posts.id` | — | Post curtido |
| `type` | smallint | ✓ | — | Tipo de reação |
| `created_at` | timestamptz | ✓ | `now()` | Data da curtida |

---

## message_deletions

Registra quais mensagens foram soft-deletadas por um usuário específico. Quando um usuário apaga uma mensagem de outra pessoa (ou apaga o histórico inteiro), um registro é inserido aqui em vez de remover a linha da tabela `messages`. A mensagem permanece visível para o outro participante.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único |
| `message_id` | bigint | ✓ | — | FK → `messages.id` (ON DELETE CASCADE) |
| `user_id` | uuid | ✓ | — | FK → `auth.users.id` — usuário para quem a mensagem está oculta |
| `created_at` | timestamptz | ✓ | `now()` | Data da deleção |

**Constraint:** `UNIQUE(message_id, user_id)` — impede duplicatas.

**RLS:** `FOR ALL USING (auth.uid() = user_id)` — usuário só gerencia seus próprios registros.

**Migration SQL:**
```sql
CREATE TABLE message_deletions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id bigint NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(message_id, user_id)
);
ALTER TABLE message_deletions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own deletions" ON message_deletions FOR ALL USING (auth.uid() = user_id);
```

---

## messages

Mensagens diretas trocadas entre usuários.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | bigint | PK (identity) | — | Identificador único |
| `user_id` | uuid | ✓ | — | Remetente da mensagem |
| `text` | text | ✓ | — | Conteúdo da mensagem |
| `read` | smallint | — | `0` | Lida (1) ou não (0) |
| `created_at` | timestamptz | ✓ | `now()` | Data de envio |
| `updated_at` | timestamp | — | `now()` | Data de atualização |
| `following_id` | uuid | — | — | Destinatário da mensagem |
| `emojis` | text | — | — | Emojis da mensagem |

**Índices** (`docs/migrations/20260702-performance-indexes.sql`): `messages_user_id_idx (user_id)`, `messages_following_id_idx (following_id)`, `messages_following_id_read_idx (following_id, read)` (contagem de não lidas), `messages_created_at_idx (created_at DESC)` (ordenação de conversas).

---

## notifications

Notificações geradas para os usuários (follows, likes, comentários, duelos).

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | bigint | PK (identity) | — | Identificador único |
| `user_id` | uuid | — | `gen_random_uuid()` | Destinatário da notificação |
| `follower_id` | uuid | — | `gen_random_uuid()` | Quem originou a notificação |
| `type` | bigint | — | — | Tipo da notificação (1–13 — ver `docs/10-notificacoes.md`) |
| `created_at` | timestamptz | ✓ | `now()` | Data de criação |
| `post_id` | uuid | — | — | Post relacionado; guarda o **id do grupo de duelo** quando type=4, 5 ou 11, e o **id da promoção** quando type=8, 12 ou 13 |
| `read` | boolean | — | `false` | Notificação lida ou não |
| `shots_id` | uuid | — | — | Shot relacionado (se aplicável) |
| `flow_id` | bigint | — | — | Flow relacionado (se aplicável). FK lógica → `flow.id` (bigint, **não** uuid) |
| `duel_check_in_id` | uuid | — | — | Check-in relacionado (se aplicável) — reação em check-in (type=7) e check-in de membro do duelo (type=11) |
| `incentive_type` | smallint | — | — | Tipo de incentivo (1–6) quando type=2; evita lookup nas tabelas de likes |

**Tipos de notificação:**

| type | Evento | Campos usados |
|---|---|---|
| 1 | Novo seguidor | `follower_id` |
| 2 | Incentivo em post/shot/flow | `follower_id`, `post_id` ou `shots_id` ou `flow_id` |
| 3 | Comentário em post/shot/flow | `follower_id`, `post_id` ou `shots_id` ou `flow_id` |
| 4 | Convite para duelo | `follower_id`, `post_id` (= duel_group_id) |
| 5 | Solicitação de entrada em duelo | `follower_id`, `post_id` (= duel_group_id) |
| 6 | Reação em comentário | `follower_id`, `post_id` ou `shots_id` ou `flow_id` |
| 7 | Reação em check-in de duelo | `follower_id`, `duel_check_in_id` |
| 8 | Comentário em promoção | `follower_id`, `post_id` (= promotion_id) |
| 9 | Marcado em um post | `follower_id` (autor do post), `post_id` |

**Como as notificações são criadas:** por **triggers AFTER INSERT** nas tabelas de origem (não pelo código do cliente). Funções `SECURITY DEFINER` que buscam o dono do conteúdo e inserem em `notifications`:

| Tabela de origem | Trigger | Function | Notif gerada |
|---|---|---|---|
| `followers` | `trigger_notify_follow` | `notify_follow()` | type 1 |
| `likes` | `trg_notify_on_post_incentive` | `notify_on_incentive()` | type 2 (post) |
| `shots_likes` | `trg_notify_on_shot_incentive` | `notify_on_shot_incentive()` | type 2 (shot) |
| `flow_likes` | `trg_notify_on_flow_incentive` | `notify_on_flow_incentive()` | type 2 (flow) |
| `comments` | `trigger_notify_post_comment` | `notify_post_comment()` | type 3 (post) |
| `shots_comments` | `notify_shots_comment` | `notify_shots_comment()` | type 3 (shot) |
| `flow_comments` | `trg_notify_flow_comment` | `notify_flow_comment()` | type 3 (flow) |
| `post_tags` | `trg_notify_post_tag` | `notify_post_tag()` | type 9 (marcado em post) |

> A trigger `notify-push-on-notification` (AFTER INSERT em `notifications`) chama a edge function `send-push-notification` para qualquer linha inserida — ou seja, o push é automático.
> As triggers de flow foram adicionadas em `docs/migrations/20260521-flow-notifications.sql`.

**Índices** (`docs/migrations/20260702-performance-indexes.sql`): `notifications_user_id_created_at_idx (user_id, created_at DESC)` (listagem em `getNotificationsDb`), `notifications_user_id_read_idx (user_id, read)` (contagem de não lidas em `getUnreadNotificationsCountDb`).

---

## post_complaint

Denúncias de posts do feed por usuários.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | bigint | PK (identity) | — | Identificador único |
| `user_id` | uuid | — | — | Usuário que denunciou |
| `post_id` | uuid | — | — | Post denunciado |
| `reason` | text | — | — | Motivo da denúncia |
| `created_at` | timestamptz | ✓ | `now()` | Data da denúncia |

---

## post_tags

Pessoas marcadas em posts do feed (estilo Instagram — "marcar quem está junto"). Criada na migração `docs/migrations/20260710-post-tags.sql`.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único |
| `post_id` | uuid | FK → `posts.id` ON DELETE CASCADE | — | Post onde a pessoa foi marcada |
| `user_id` | uuid | FK → `auth.users` ON DELETE CASCADE | — | Pessoa marcada |
| `created_at` | timestamptz | ✓ | `now()` | Data da marcação |

**Constraint:** `unique(post_id, user_id)` — uma marcação por pessoa por post.
**Índices:** `post_tags_post_id_idx (post_id)`, `post_tags_user_id_idx (user_id)`.
**RLS:**
- **SELECT:** pública (`true`) — marcações aparecem no feed para qualquer usuário.
- **INSERT:** apenas o dono do post (`EXISTS` em `posts` com `user_id = auth.uid()`).
- **DELETE:** o dono do post ou a própria pessoa marcada (pode se desmarcar).

**Trigger:** `trg_notify_post_tag` (AFTER INSERT) → `notify_post_tag()` (SECURITY DEFINER) insere notificação **type 9** para a pessoa marcada (ignora auto-marcação); o push é automático via `notify-push-on-notification`.

**Funções relacionadas (`ritmofit-db.ts`):** `createPostDb` (5º parâmetro `taggedUserIds`), `getPostTagsBatchDb` (batch por lista de posts — usado pelo feed e por `getPostByIdDb`) e `setPostTagsDb` (edição — aplica o **diff**: insere só os novos marcados, para a trigger notificar apenas eles, e remove quem saiu; invalida o cache `post:{id}`).

---

## posts

Posts publicados no feed principal.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único |
| `user_id` | uuid | — | `auth.uid()` | Autor do post |
| `description` | text | — | — | Legenda do post |
| `photo` | text | — | — | URL da foto principal |
| `created_at` | timestamp | — | `now()` | Data de publicação |
| `user_goal_id` | bigint | — | — | Meta vinculada ao post |
| `updated_at` | timestamp | — | `now()` | Data de atualização |
| `photos` | jsonb | — | — | Array JSON de fotos adicionais |
| `workout_summary` | jsonb | — | `NULL` | **(2026-07-06)** Snapshot estruturado do treino quando um "resumo do treino" é compartilhado no feed (rotina, duração, séries, volume, `imageUrl` do card gerado e a lista de exercícios com `sets: {kg, reps}` por série). Formato = `PostWorkoutSummary` (`client/lib/workout-summary-types.ts`). Habilita o pill "Ver treino" + o modal de detalhe no feed/Perfil/PostDetail. `NULL` em posts comuns de imagem/texto. Herda as policies RLS de `posts`. Ver `docs/migrations/20260706-post-workout-summary.sql` |

---

## profiles

Perfil público dos usuários da plataforma.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | bigint | PK (identity) | — | Identificador interno |
| `user_id` | uuid | ✓ | `gen_random_uuid()` | Referência ao usuário |
| `bio` | text | — | — | Biografia do usuário |
| `nickname` | text | — | — | Nome de exibição / handle |
| `created_at` | timestamptz | ✓ | `now()` | Data de criação |
| `updated_at` | timestamp | — | `now()` | Data de atualização |
| `photo` | text | — | — | URL da foto de perfil |
| `cover_photo` | text | — | — | URL da foto de capa/banner do perfil. Quando preenchida, substitui o gradiente colorido no topo do perfil. `null` = usar gradiente padrão |
| `objectives` | text[] | — | — | Objetivos fitness selecionados no cadastro (ex: ["fitness", "cardio"]) |
| `gender` | text[] | — | — | sexo do usuario |
| `height` | bigint[] | — | — | altura do usuario |
| `weight` | float[] | — | — | peso do usuario |
| `age` | bigint[] | — | — | idade do usuario |
| `handle` | text[] | — | — | handle do usuario |
| `is_verified` | boolean | ✓ | `false` | Indica conta oficial verificada (badge dourado). Só pode ser alterado via service_role (admin). |
| `hide_follow_lists` | boolean | ✓ | `false` | Privacidade: quando `true`, outros usuários não conseguem abrir as listas de seguidores/seguindo deste perfil (gating client-side em `Profile.tsx`). |
| `hide_posts_from_non_followers` | boolean | ✓ | `false` | Privacidade: quando `true`, a aba Posts do perfil só é visível para quem segue o dono. |
| `selected_badge_id` | uuid | — | `null` | FK → `badges.id`. Insígnia que o usuário **escolheu** exibir. Persistente: check-ins e novas conquistas **nunca** a alteram — só uma troca explícita no `InsigniasDrawer`. `null` = nunca escolheu (exibe a de maior `sort_order` do acervo). Migration: `docs/migrations/20260714-badge-selection-persist.sql` |

> Migration: `docs/migrations/20260626-profile-privacy.sql`

---

## ranking

Pontuação e nível de gamificação dos usuários.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | bigint | PK (identity) | — | Identificador único |
| `points` | bigint | ✓ | `0` | Pontos acumulados |
| `level` | bigint | ✓ | `0` | Nível atual do usuário |
| `created_at` | timestamptz | ✓ | `now()` | Data de criação |
| `updated_at` | timestamp | — | `now()` | Data de atualização |
| `user_id` | uuid | UNIQUE | — | Usuário (um registro por usuário) |

---

## routines

Rotinas de treino dos usuários (estrutura de programação).

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | bigint | PK (identity) | — | Identificador único |
| `user_id` | uuid | ✓ | — | Dono da rotina |
| `follower_id` | bigint | — | — | Referência secundária |
| `type` | integer | ✓ | — | Tipo de rotina |
| `created_at` | timestamptz | ✓ | `now()` | Data de criação |
| `updated_at` | timestamp | — | `now()` | Data de atualização |
| `goal_id` | bigint | — | — | Meta vinculada à rotina |
| `name` | text | — | — | Nome da rotina |
| `last_summary` | jsonb | — | — | Snapshot do resumo do **último treino finalizado** desta rotina (mesmo formato de `WorkoutSummaryData`, sem `userId`/`userGroups` — resolvidos de novo ao reabrir): `routineName`, `totalSeries`, `totalVolume`, `durationSecs`, `badges`, `completedExercises`, `prExercises`, `machinedExercises`, `completedAt`. Sobrescrito a cada "Finalizar" (`updateRoutineLastSummaryDb`) — nunca há mais de um snapshot por rotina, sempre o mais recente. `NULL` = rotina nunca executada. Gateia o ícone de "resumo do treino" no `routine-detail-drawer.tsx` (só aparece quando não-nulo). Migration: `docs/migrations/20260702-routine-last-summary.sql`. |
| `program_meta` | jsonb | — | — | **(2026-07-08)** Metadados do programa que criou a rotina via o **quiz de personalização** do "Sugerido pelo app": `{ origin: "quiz", exercises: [{ name, muscleGroup, series, reps }] }` (formato `RoutineProgramMeta` em `ritmofit-db.ts`, nomes brutos PT do catálogo). Programas gerados são únicos por usuário e não existem no catálogo estático (`suggested-routines-data.ts`), então o **pré-preenchimento de séries×reps** na primeira execução (`getSuggestedSetsForCard` em `goals-helpers.ts`) lê daqui — rotinas antigas/sem meta caem no fallback por nome (`getSuggestedSetsForRoutine`). `NULL` = rotina criada do zero. Gravado por `updateRoutineProgramMetaDb`. Migration: `docs/migrations/20260708-fitness-profile-and-program-meta.sql`. |

---

## shots

Vídeos curtos publicados na aba Shots.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | bigint | PK (identity) | — | Identificador único |
| `user_id` | uuid | FK → `auth.users` | — | Autor do Shot |
| `video_url` | text | ✓ | — | URL do vídeo |
| `description` | text | — | — | Legenda do Shot |
| `created_at` | timestamptz | ✓ | `now()` | Data de publicação |
| `updated_at` | timestamp | — | `now()` | Data de atualização |

---

## shots_comments

Comentários em Shots.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único |
| `user_id` | uuid | — | — | Autor do comentário |
| `text` | text | — | — | Conteúdo do comentário |
| `created_at` | timestamp | — | `now()` | Data de criação |
| `user_handle` | text | — | — | Handle do autor (denormalizado) |
| `read` | smallint | — | — | Flag de leitura |
| `shots_id` | bigint | — | — | Shot comentado |

---

## shots_complaint

Denúncias de Shots por usuários.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | bigint | PK (identity) | — | Identificador único |
| `user_id` | uuid | ✓ | — | Usuário que denunciou |
| `shots_id` | bigint | ✓ | — | Shot denunciado |
| `reason` | text | — | — | Motivo da denúncia |
| `created_at` | timestamptz | ✓ | `now()` | Data da denúncia |

---

## shots_likes

Curtidas em Shots.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único |
| `user_id` | uuid | ✓ | — | Usuário que curtiu |
| `type` | smallint | ✓ | — | Tipo de reação |
| `created_at` | timestamptz | ✓ | `now()` | Data da curtida |
| `shots_id` | smallint | — | — | Shot curtido |

> **Atenção:** `shots_id` é `smallint`, o que pode causar overflow para IDs grandes (bigint). Verificar necessidade de migração.

---

## shot_user_viewed

Registra as visualizações de Shots por usuário — espelha `flow_user_viewed`. Permite ao dono do Shot ver quem visualizou seu clipe (drawer "Visualizações" na tela de Shots). Criada na migração `docs/migrations/20260704-shot-user-viewed.sql`.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único |
| `user_id` | uuid | FK → `auth.users` ON DELETE CASCADE | — | Dono do Shot visualizado |
| `follower_id` | uuid | FK → `auth.users` ON DELETE CASCADE | — | Usuário que visualizou |
| `shot_id` | bigint | FK → `shots.id` ON DELETE CASCADE | — | Shot visualizado |
| `created_at` | timestamptz | ✓ | `now()` | Data da visualização |
| `updated_at` | timestamptz | ✓ | `now()` | Data de atualização |

**Constraint:** `unique(follower_id, shot_id)` — uma visualização por usuário por Shot (dedupe entre sessões/telas).
**Índices:** `shot_user_viewed_shot_idx (shot_id)`, `shot_user_viewed_user_idx (user_id)`.
**RLS:**
- **SELECT:** `auth.uid() = user_id OR auth.uid() = follower_id` — o dono vê quem visualizou; o visualizador enxerga os próprios registros (necessário para o SELECT de dedupe em `recordShotViewDb`).
- **INSERT:** `auth.uid() = follower_id` — usuário só registra as próprias visualizações.
- **UPDATE:** `auth.uid() = follower_id`.
- **DELETE:** `auth.uid() = user_id OR auth.uid() = follower_id` (usado por `deleteAllUserDataDb` e pela exclusão de Shots do próprio dono).

**Funções relacionadas (`ritmofit-db.ts`):** `recordShotViewDb`, `getShotViewersDb`.

---

## store_catalog

Catálogo de produtos de vitrines parceiras.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único |
| `store_id` | uuid | ✓ | — | ID da vitrine |
| `store_name` | varchar | ✓ | — | Nome da vitrine |
| `store_instagram_handle` | varchar | ✓ | — | Handle do Instagram |
| `store_instagram_profile_url` | text | ✓ | — | URL do perfil Instagram |
| `store_logo_url` | text | — | — | URL do logotipo |
| `store_bio` | text | — | — | Bio da vitrine |
| `item_name` | varchar | ✓ | — | Nome do produto |
| `category` | varchar | ✓ | — | Categoria do produto |
| `description` | text | — | — | Descrição do produto |
| `price` | numeric | — | — | Preço do produto |
| `available_colors` | text[] | — | — | Cores disponíveis |
| `available_sizes` | text[] | — | — | Tamanhos disponíveis |
| `item_photo_url` | text | ✓ | — | Foto principal do produto |
| `additional_photos` | text[] | — | — | Fotos adicionais |
| `instagram_post_url` | text | ✓ | — | URL do post Instagram do produto |
| `created_at` | timestamp | — | `now()` | Data de criação |
| `updated_at` | timestamp | — | `now()` | Data de atualização |
| `is_active` | boolean | — | `true` | Produto ativo na vitrine |

---

## user_complaint

Denúncias de usuários por outros usuários.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | bigint | PK (identity) | — | Identificador único |
| `user_id` | uuid | ✓ | — | Usuário que foi denunciado |
| `reason` | text | — | — | Motivo da denúncia |
| `created_at` | timestamptz | ✓ | `now()` | Data da denúncia |
| `follower_id` | uuid | ✓ | — | Usuário que realizou a denúncia |

---

## user_diets

Dietas ativas associadas a um usuário.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | bigint | PK (identity) | — | Identificador único |
| `user_id` | uuid | ✓ | — | Usuário |
| `diet_id` | bigint | FK → `diets.id` | — | Dieta associada |
| `quantity` | double precision | — | — | Quantidade consumida |
| `calories` | double precision | — | — | Calorias registradas |
| `created_at` | timestamptz | ✓ | `now()` | Data de criação |
| `updated_at` | timestamp | — | `now()` | Data de atualização |
| `is_completed` | boolean | — | `false` | Meta concluída |
| `name` | text | — | — | Nome customizado (denormalizado) |
| `scheduled_time` | time | — | — | Horário diário de lembrete (ex: `07:30:00`) |
| `scheduled_days` | text | — | — | Dias da semana do lembrete: índices seg→dom (0–6) separados por vírgula (ex: `0,2,4`). NULL/vazio = todos os dias |
| `routine_id` | bigint | FK → `routines.id` ON DELETE SET NULL | — | Rotina à qual esta dieta pertence |

---

## user_diets_hist

Histórico de dietas realizadas pelo usuário.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | bigint | PK (identity) | — | Identificador único |
| `user_id` | uuid | FK → `auth.users` | — | Usuário |
| `diet_id` | bigint | FK → `diets.id` | — | Dieta |
| `quantity` | double precision | — | — | Quantidade |
| `calories` | double precision | — | — | Calorias |
| `created_at` | timestamptz | — | `now()` | Data de criação |
| `updated_at` | timestamp | — | `now()` | Data de atualização |
| `user_diet_id` | bigint | — | — | Referência ao registro ativo em `user_diets` |

---

## user_goals

Metas ativas vinculadas a um usuário.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | bigint | PK (identity) | — | Identificador único |
| `goal_id` | bigint | FK → `goals.id` | — | Meta do catálogo |
| `user_id` | uuid | ✓ | — | Usuário |
| `type_goal` | smallint | ✓ | — | Tipo da meta |
| `duration` | bigint | ✓ | — | Duração da meta (dias) |
| `quantity` | bigint | ✓ | — | Quantidade alvo |
| `visibility` | smallint | ✓ | `1` | Visibilidade (1 = pública, 0 = privada) |
| `created_at` | timestamptz | ✓ | `now()` | Data de criação |
| `perc` | real | ✓ | `0` | Percentual de conclusão (calculado a partir de `days_completed / duration`, arredondado — ver `incrementGoalProgressDb`) |
| `days_completed` | smallint | — | `0` | Dias completados. Incrementado em +1 por dia (no máx.) ao concluir qualquer rotina vinculada à meta, via `incrementGoalProgressDb`. **Fonte de verdade para o progresso.** |
| `last_progress_date` | date | — | — | Data (YYYY-MM-DD) do último incremento de `days_completed`. Garante que **só a primeira rotina concluída no dia** (treino, dieta ou hábito, entre as vinculadas a esta meta) incrementa o progresso — conclusões seguintes no mesmo dia são ignoradas. Adicionada em 02/07/2026 (`supabase/migrations/20260702220000_add_last_progress_date_to_user_goals.sql`). |

> RLS: o próprio usuário tem acesso total. Qualquer usuário autenticado pode **ler** metas com `visibility = 1` (política "Anyone can read public goals"). Migration: `20260427-user-goals-public-read.sql`.

---

## badges

Catálogo de insígnias disponíveis na plataforma.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único |
| `key` | text | ✓ UNIQUE | — | Chave única (ex: `iniciante`, `noturno`, `streak_7`) |
| `name` | text | ✓ | — | Nome da insígnia |
| `emoji` | text | ✓ | — | Emoji representativo |
| `description` | text | ✓ | — | Descrição do critério |
| `required_checkins` | int | ✓ | `0` | Limiar numérico do critério **do tipo daquela insígnia** — apesar do nome, quase nunca é "total de check-ins": em `checkin_streak` são dias seguidos, em `workout_type` são treinos daquele tipo, em `checkin_before_time` são check-ins feitos antes da hora limite. Nunca usar como desbloqueio genérico (ver `isBadgeUnlocked`). |
| `sort_order` | int | ✓ | `0` | Ordenação (menor = mais básico) |
| `condition_type` | text | ✓ | `checkin_total` | Tipo de condição para concessão (ver tabela abaixo) |
| `condition_metadata` | jsonb | — | `null` | Parâmetros extras da condição (ex: `{"hour": 9}`, `{"type": "cardio"}`) |
| `premium` | boolean | ✓ | `false` | Insígnia exclusiva de assinante. Visível para todos no catálogo (gera desejo), mas a **seleção** é gateada: `setSelectedBadgeDb` lança `BADGE_PREMIUM_LOCKED` para não-assinante. Seeds: `premium_coroa` 👑, `premium_diamante` 💎 — `condition_type = checkin_total` com `required_checkins = 0` (desbloqueio "por status", ver `docs/17-premium.md`) |
| `created_at` | timestamptz | ✓ | `now()` | Data de criação |

### Tipos de condição (`condition_type`)

| Valor | Critério | Exemplo |
|---|---|---|
| `checkin_total` | Total acumulado de check-ins ≥ `required_checkins` | `total_10`, `total_100` |
| `checkin_week` | Check-ins na semana atual (Dom–Sáb) ≥ `required_checkins` | `iniciante`, `lendario` |
| `checkin_streak` | Dias consecutivos de check-in ≥ `required_checkins` | `streak_7`, `streak_30` |
| `checkin_after_midnight` | Check-ins feitos entre 00:00 e 05:59 (hora local) ≥ `required_checkins` | `noturno` |
| `checkin_before_time` | Check-ins feitos antes de `condition_metadata.hour` (hora local) ≥ `required_checkins` | `treino_manha` (antes das 9h) |
| `checkin_comeback` | Primeiro check-in após ≥ 7 dias sem atividade | `comeback` |
| `workout_week` | Treinos realizados na semana atual ≥ `required_checkins` | `treino_3_semana` |
| `workout_type` | Treinos do tipo `condition_metadata.type` ≥ `required_checkins` | `treino_forca_10`, `treino_cardio_10` |
| `app_usage` | Dias distintos com sessão em `access_sessions` ≥ `required_checkins` | `app_7dias`, `app_30dias` |
| `nutrition_no_ultra` | Dias **seguidos** sem ultraprocessado no diário ≥ `required_checkins` | `sem_ultraprocessado_7d` |
| `nutrition_protein` | Dias **seguidos** batendo `user_nutrition_goals.protein_target_g` ≥ `required_checkins` | `proteina_7d` |
| `nutrition_week` | Dias com registro no diário na semana atual (Dom–Sáb) ≥ `required_checkins` | `semana_nutritiva` |
| `nutrition_no_sugar` | Dias **seguidos** com açúcar total ≤ `condition_metadata.max_sugar_g` (25 g, OMS) ≥ `required_checkins` | `sem_acucar_7d` |
| `nutrition_hydration` | Dias **seguidos** batendo a meta de água (`user_nutrition_goals.water_target_ml`, ou `condition_metadata.ml` = 2000) ≥ `required_checkins` | `hidratacao_7dias` |
| `nutrition_fruits` / `nutrition_home_food` | ⚠️ **Sem tracking — nunca concedida.** O diário não classifica fruta nem "comida caseira" | `frutas_7d`, `comida_caseira_5d` |
| `habit_*` | ⚠️ **Sem tracking — nunca concedida.** | `sono_7d`, `meditacao_5d` |
| `challenge_count` | ⚠️ **Sem tracking — nunca concedida.** | `desafio_3x` |

**Insígnias de nutrição** (`awardNutritionBadgesDb`, chamada ao registrar um alimento **ou água**) são avaliadas sobre `user_food_logs` + `user_water_logs`.

> **Desconhecido nunca conta como zero.** A qualidade vem de `diets.food_quality` via `diet_id` e o açúcar de `user_food_logs.sugar_g`. Um dia com qualquer alimento de valor **desconhecido** (entrada manual sem o campo preenchido, ou item de catálogo com `sugar_g` nulo) **não conta** para `nutrition_no_ultra` / `nutrition_no_sugar`: não há como provar que não houve ultraprocessado ou açúcar, e aceitar o desconhecido entregaria a insígnia a quem registra tudo na mão. Consequência prática: enquanto `diets.sugar_g` não estiver populado no catálogo, `sem_acucar_7d` continua (corretamente) inalcançável.

> **Cada insígnia só é concedida quando a condição DELA é satisfeita.** Os tipos marcados com ⚠️ não têm como ser verificados hoje, então `_evaluateBadgeCondition` devolve `false` e eles ficam permanentemente bloqueados — **é intencional**. Liberá-los por contagem de check-ins (o que o drawer fazia até 14/07/2026, via `totalCheckIns >= required_checkins` para todo tipo) entregava, por exemplo, o Madrugador a quem nunca treinou de manhã. Para ativá-los é preciso implementar o tracking + a avaliação, não afrouxar o desbloqueio.

---

## subscriptions

Assinatura **LinKa Premium** — uma linha por usuário. Criada na migração `docs/migrations/20260715-premium-plan.sql`. Na Fase 1 o status é gravado manualmente via SQL (service role); na Fase 2 o webhook do RevenueCat escreverá aqui (campos `rc_app_user_id`, `store`, `environment` já previstos). Ver `docs/17-premium.md`.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `user_id` | uuid | PK, FK → `auth.users.id` ON DELETE CASCADE | — | Usuário assinante |
| `status` | text | ✓ | `'inactive'` | `active` \| `inactive` \| `expired` \| `cancelled` |
| `product_id` | text | — | — | `'manual'` (Fase 1) ou product id do RevenueCat (Fase 2) |
| `store` | text | — | — | `'manual'` \| `'app_store'` |
| `rc_app_user_id` | text | — | — | `app_user_id` do RevenueCat (Fase 2) |
| `environment` | text | — | — | `'production'` \| `'sandbox'` |
| `current_period_end` | timestamptz | — | — | Fim do período pago; `NULL` = sem expiração (ativação manual) |
| `created_at` | timestamptz | ✓ | `now()` | Data de criação |
| `updated_at` | timestamptz | ✓ | `now()` | Data de atualização |

> **RLS:** SELECT apenas da própria linha (`subscriptions_select_own`). **Nenhuma policy de escrita** — só o service role escreve; é isso que impede um usuário de se auto-promover a premium via API.

### Função `is_premium(uid uuid) → boolean`

`SECURITY DEFINER`, `STABLE`, `search_path = public`. Retorna `true` se existe linha com `status = 'active'` e (`current_period_end` nulo ou futuro). Consumida pelo app via RPC (`getPremiumStatusDb` em `ritmofit-db.ts`, cache `premium:{uid}` TTL 60s) e reutilizável em policies `WITH CHECK` na Fase 2. `GRANT EXECUTE` para `authenticated`.

---

## user_badges

**Acervo** de insígnias conquistadas por usuário. Só cresce — uma vez conquistada, a insígnia é do usuário para sempre.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único |
| `user_id` | uuid | FK → `profiles.user_id` | — | Usuário |
| `badge_id` | uuid | FK → `badges.id` | — | Insígnia conquistada |
| `earned_at` | timestamptz | ✓ | `now()` | Data de conquista |
| UNIQUE | — | — | — | `(user_id, badge_id)` — cada insígnia é conquistada uma vez |

> RLS: qualquer usuário autenticado pode ler `user_badges` (necessário para exibir no feed sem restrição de seguimento).

> **Acervo ≠ seleção.** Esta tabela guarda o que foi **conquistado**; a insígnia **exibida** é `profiles.selected_badge_id`. Nunca apagar linhas daqui para trocar a insígnia exibida — era o que `setSelectedBadgeDb` fazia até 14/07/2026 e fazia a insígnia do usuário "virar sozinha" no check-in seguinte (ver `docs/08-perfil.md`). Escrito por `awardBadgesForCheckInsDb` (upsert com `ignoreDuplicates`).

---

## user_habits

Hábitos ativos associados a um usuário.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | bigint | PK (identity) | — | Identificador único |
| `user_id` | uuid | ✓ | — | Usuário |
| `habit_id` | bigint | FK → `habits.id` | — | Hábito |
| `quantity` | bigint | — | — | Quantidade diária alvo |
| `frequency` | bigint | — | — | Frequência semanal |
| `created_at` | timestamptz | ✓ | `now()` | Data de criação |
| `updated_at` | timestamp | — | `now()` | Data de atualização |
| `is_completed` | boolean | — | `false` | Concluído hoje |
| `name` | text | — | — | Nome customizado (denormalizado) |
| `scheduled_time` | time | — | — | Horário diário de lembrete (ex: `07:30:00`) |
| `scheduled_days` | text | — | — | Dias da semana do lembrete: índices seg→dom (0–6) separados por vírgula (ex: `0,2,4`). NULL/vazio = todos os dias |
| `routine_id` | bigint | FK → `routines.id` ON DELETE SET NULL | — | Rotina à qual este hábito pertence |

---

## user_fitness_profile

Perfil fitness do usuário — respostas do **quiz de personalização** do fluxo "Sugerido pelo app" (tela de Metas). Uma linha por usuário, upsert a cada programa criado (`upsertFitnessProfileDb`); lida em `getFitnessProfileDb` para pré-preencher o quiz na próxima criação de programa.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `user_id` | uuid | PK, FK → `auth.users` | — | Usuário (uma linha por usuário) |
| `goal` | text | ✓ | — | Objetivo: `hypertrophy` \| `fat_loss` \| `strength` \| `conditioning` (check constraint) |
| `level` | text | ✓ | — | Nível: `beginner` \| `intermediate` \| `advanced` (check constraint) |
| `training_days` | text | ✓ | `''` | Dias de treino escolhidos — índices Monday-first separados por vírgula (`"0,2,4"` = seg/qua/sex) |
| `session_minutes` | smallint | ✓ | `60` | Tempo por sessão em minutos (30/45/60/75) |
| `emphasis` | text | ✓ | — | Ênfase muscular: `balanced` \| `lower` \| `upper` (check constraint) |
| `location` | text | ✓ | — | Local de treino: `gym` \| `home` (check constraint) |
| `created_at` | timestamptz | — | `now()` | Data de criação |
| `updated_at` | timestamptz | — | `now()` | Última atualização |

**RLS:** `fitness_profile_manage_own` — usuário só lê/escreve a própria linha (`auth.uid() = user_id`).

> Migration: `docs/migrations/20260708-fitness-profile-and-program-meta.sql`

---

## user_food_logs

**Diário alimentar** — uma linha por alimento consumido num dia/refeição, com calorias e macros denormalizados (valor da época do registro). Alimenta o card "Alimentação de hoje" e o drawer do diário na tela de Metas (`food-diary-card.tsx`, ver `docs/05-metas.md`). **Importante:** `calories`/macros da linha já são o **total consumido** (por porção × `quantity`) — somar a coluna dá o total do dia direto.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | bigint | PK (identity) | — | Identificador único |
| `user_id` | uuid | FK → `auth.users` (on delete cascade) | — | Usuário |
| `log_date` | date | ✓ | `current_date` | Dia do registro (o app grava sempre o **dia local**, não UTC) |
| `meal_type` | smallint | ✓ | `0` | Refeição: 0 = café da manhã, 1 = almoço, 2 = lanche, 3 = jantar |
| `diet_id` | bigint | FK → `diets.id` ON DELETE SET NULL | — | Alimento de origem. Desde `20260714-custom-items-owner.sql` o **registro manual também aponta para um `diets`** (linha custom criada na hora, `created_by_user`), então fica NULL só nos registros manuais antigos ou quando a criação do item de catálogo falha |
| `user_diet_id` | bigint | FK → `user_diets.id` ON DELETE SET NULL | — | Preenchido nas entradas **automáticas** criadas ao concluir um item da rotina de dieta; desmarcar o item apaga a entrada do dia por este vínculo |
| `name` | text | ✓ | — | Nome do alimento (denormalizado) |
| `quantity` | real | ✓ | `1` | Porções consumidas |
| `calories` | real | — | — | Calorias totais consumidas |
| `protein_g` | real | — | — | Proteína total (g) |
| `carbs_g` | real | — | — | Carboidrato total (g) |
| `fat_g` | real | — | — | Gordura total (g) |
| `sugar_g` | real | — | — | Açúcar total (g). `null` = **desconhecido** (entrada manual em branco / catálogo sem o dado) — **não** é zero, e invalida o dia para a insígnia `sem_acucar_7d`. `addFoodLogDb` preenche do catálogo quando há `diet_id`. Migração `20260714-water-sugar.sql` |
| `created_at` | timestamptz | ✓ | `now()` | Data de criação |

- **Index** `idx_user_food_logs_user_date (user_id, log_date)`.
- **RLS:** `food_logs_select_own` / `_insert_own` / `_update_own` / `_delete_own` (`auth.uid() = user_id`).
- Funções: `getFoodLogsDb(date)`, `addFoodLogDb(entry)`, `deleteFoodLogDb(id)`, `deleteFoodLogForDietItemDb(userDietId, date)`, `getRecentFoodsDb(limit)`, `getFoodLogDayTotalsDb(days)`.

> Migration: `docs/migrations/20260714-food-diary.sql`

---

## user_nutrition_goals

Meta **diária** de calorias/macros do usuário (uma linha por usuário) — editada na vista "Meta diária" do diário alimentar. Todos os alvos são opcionais (só kcal já basta).

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `user_id` | uuid | PK, FK → `auth.users` (on delete cascade) | — | Usuário |
| `calories_target` | real | — | — | Meta diária de calorias (kcal) |
| `protein_target_g` | real | — | — | Meta diária de proteína (g) |
| `carbs_target_g` | real | — | — | Meta diária de carboidrato (g) |
| `fat_target_g` | real | — | — | Meta diária de gordura (g) |
| `water_target_ml` | real | — | — | Meta diária de água (ml). Sem valor, o app usa 2000 ml. Migração `20260714-water-sugar.sql` |
| `updated_at` | timestamptz | ✓ | `now()` | Última atualização |

- **RLS:** `nutrition_goals_select_own` / `_upsert_own` (insert) / `_update_own` / `_delete_own` (`auth.uid() = user_id`).
- Funções: `getNutritionGoalsDb()`, `upsertNutritionGoalsDb(goals)` (upsert por `user_id`).

> Migration: `docs/migrations/20260714-food-diary.sql`

---

## user_water_logs

**Água bebida por dia** (ml) — alimenta o card de água no diário alimentar e a insígnia `hidratacao_7dias`. O app faz **upsert do total do dia** (não um registro por copo), então a PK composta já garante idempotência.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `user_id` | uuid | PK (composta), FK → `auth.users` (on delete cascade) | — | Usuário |
| `log_date` | date | PK (composta) | `current_date` | Dia do registro (**dia local**, não UTC) |
| `ml` | real | ✓ | `0` | Total bebido no dia |
| `updated_at` | timestamptz | ✓ | `now()` | Última atualização |

- **Index** `idx_user_water_logs_user_date (user_id, log_date)`.
- **RLS:** `water_logs_select_own` / `_insert_own` / `_update_own` / `_delete_own` (`auth.uid() = user_id`).
- Funções: `getWaterLogDb(date)`, `setWaterLogDb(date, ml)`.

> Migration: `docs/migrations/20260714-water-sugar.sql`

---

## user_weight_logs

Histórico de **peso corporal** do usuário — alimenta o card "Peso corporal" e o gráfico de tendência na tela de Metas (`weight-tracker-card.tsx`, ver `docs/05-metas.md`). Um registro por usuário por dia (upsert por `(user_id, logged_at)`).

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único |
| `user_id` | uuid | FK → `auth.users` (on delete cascade) | — | Usuário |
| `weight` | numeric(6,2) | ✓ | — | Peso em kg (`> 0 and < 1000`, check constraint) |
| `logged_at` | date | ✓ | `current_date` | Dia do registro (único por usuário) |
| `created_at` | timestamptz | — | `now()` | Data de criação |

- **UNIQUE** `(user_id, logged_at)` — registrar de novo no mesmo dia **atualiza** o valor (upsert).
- **RLS:** `weight_logs_select_own` / `_insert_own` / `_update_own` / `_delete_own` — usuário só lê/escreve/apaga os próprios registros (`auth.uid() = user_id`).
- Funções: `getWeightLogsDb(limit)` (ordena asc para o gráfico), `addWeightLogDb(weight, loggedAt?)` (upsert + sincroniza `profiles.weight`), `deleteWeightLogDb(id)`.

> Migration: `docs/migrations/20260713-user-weight-logs.sql`

---

## user_habits_hist

Histórico de hábitos realizados pelo usuário.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | bigint | PK (identity) | — | Identificador único |
| `user_id` | uuid | FK → `auth.users` | — | Usuário |
| `habit_id` | bigint | FK → `habits.id` | — | Hábito |
| `quantity` | bigint | — | — | Quantidade realizada |
| `frequency` | bigint | — | — | Frequência |
| `created_at` | timestamptz | — | `now()` | Data de criação |
| `updated_at` | timestamp | — | `now()` | Data de atualização |
| `user_habit_id` | bigint | — | — | Referência ao registro ativo em `user_habits` |

---

## flow_user_viewed

Registra visualizações de Flows por usuários.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único |
| `user_id` | uuid | FK → `auth.users` | — | Dono do Flow visualizado |
| `follower_id` | uuid | FK → `auth.users` | — | Usuário que visualizou |
| `flow_id` | uuid | ✓ | — | Flow visualizado |
| `created_at` | timestamptz | — | `now()` | Data da visualização |
| `updated_at` | timestamptz | — | `now()` | Data de atualização |

---

## push_tokens

Armazena os tokens APNs (iOS) de cada dispositivo registrado pelo usuário para recebimento de push remoto.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único |
| `user_id` | uuid | FK → `auth.users` | — | Usuário dono do token |
| `token` | text | ✓ | — | Token APNs do dispositivo |
| `platform` | text | ✓ | `'ios'` | Plataforma (`ios` / `android`) |
| `created_at` | timestamptz | — | `now()` | Data de criação |
| `updated_at` | timestamptz | — | `now()` | Última atualização |

**Constraint:** `unique(user_id, token)` — evita duplicatas por upsert.
**RLS:** usuário só acessa seus próprios tokens.
**Limpeza automática:** a Edge Function `send-push-notification` remove tokens `BadDeviceToken` / `Unregistered` automaticamente.

---

## user_workouts

Treinos salvos / atribuídos a um usuário.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | bigint | PK (identity) | — | Identificador único |
| `workout_id` | uuid | FK → `workouts.id` | — | Treino do catálogo |
| `user_id` | uuid | ✓ | — | Usuário |
| `created_at` | timestamptz | ✓ | `now()` | Data de associação |
| `updated_at` | timestamp | — | `now()` | Data de atualização |
| `name` | text | — | — | Nome customizado (denormalizado) |
| `scheduled_time` | time | — | — | Horário diário de lembrete (ex: `07:30:00`) |
| `scheduled_days` | text | — | — | Dias da semana do lembrete: índices seg→dom (0–6) separados por vírgula (ex: `0,2,4`). NULL/vazio = todos os dias |
| `routine_id` | bigint | FK → `routines.id` ON DELETE SET NULL | — | Rotina à qual este exercício pertence |
| `notes` | text | — | — | Notas livres do usuário para este exercício |
| `time_to_rest` | integer | — | — | Tempo de descanso entre séries (em segundos) escolhido pelo usuário para este exercício |

---

## user_workouts_hist

Histórico de treinos realizados pelo usuário.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único |
| `user_id` | uuid | FK → `auth.users` | — | Usuário |
| `user_workout_id` | bigint | FK → `user_workouts.id` | — | Treino do usuário |
| `workout_id` | uuid | FK → `workouts.id` | — | Treino do catálogo |
| `kilos` | numeric | — | — | Carga total (kg) |
| `volume` | varchar | — | — | Volume (texto livre) |
| `calories` | numeric | — | — | Calorias gastas |
| `date_completed` | timestamp | — | `now()` | Data de realização |
| `created_at` | timestamp | — | `now()` | Data de criação do registro |
| `km` | float8 | — | - | quilometros percorridos |
| `time` | varchar | — | - | tempo decorrido |
| `routine_id` | bigint | FK → `routines.id` | — | Rotina à qual o treino concluído pertence. Populada ao finalizar o treino a partir de `user_workouts.routine_id`. Usada para gatear a exibição do ícone de resumo da rotina (só aparece se houver ao menos um registro com `routine_id` correspondente). |

---

## workouts

Catálogo de treinos disponíveis na plataforma.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único |
| `created_at` | timestamp | — | `now()` | Data de criação |
| `name` | text | ✓ | — | Nome do treino (PT) |
| `description` | text | ✓ | — | Descrição do treino (PT) |
| `name_eng` | text | — | — | Nome do treino em inglês (para usuários estrangeiros). Ver `docs/migrations/20260704-catalog-eng-columns.sql` |
| `description_eng` | text | — | — | Descrição do treino em inglês. Populada a partir de tradução PT→EN (`docs/migrations/20260704-catalog-eng-data.sql`) |
| `photo` | text | — | — | URL da foto. Itens importados do wger usam o bucket `exercises` via `wger_id` (`exercises/{wger_id}.{ext}`); itens de catálogo sem `wger_id` guardam URL pública completa do bucket `exercises` no caminho `manual/{workout_id}.{ext}` (preenchidos em 2026-07-07: 15 imagens curadas do wger + 12 geradas por IA no estilo anatômico, ~1024px JPEG). Imagens **compartilhadas por nome** (customs criados pelos programas sugeridos + itens de catálogo equivalentes) ficam em `manual/shared/{slug}.{ext}` — sobrescrever o arquivo atualiza todas as linhas que apontam para ele. Linhas de catálogo com imagem errada/quebrada do wger (placeholder-logo, 400, marca d'água) foram corrigidas em 2026-07-07 apontando `photo` para `manual/{workout_id}` (a URL http tem precedência sobre `wger_id` no `resolveWorkoutPhotoUrl`). |
| `muscle_group` | text | — | — | Grupo muscular principal. Para exercícios criados pelo usuário é **obrigatório** (escolhido num select com os grupos existentes). |
| `equipment` | text | — | — | Equipamentos necessários / tipo de máquina. Preenchido pelo formulário "Criar novo exercício" (`createCustomWorkoutDb`). |
| `wger_id` | integer | — | — | ID de referência no wger |
| `created_by_user` | boolean | — | `false` | `true` quando o exercício foi criado manualmente pelo usuário via "Criar novo exercício" (modo treino) ou "Criar Exercício Personalizado". A foto sobe para o bucket `posts` (`uploadCustomExercisePhotoDb`) e fica em `photo` como URL pública; `description` guarda o "como executar". |
| `created_by` | uuid | — | — | FK → `auth.users` ON DELETE CASCADE. Dono do exercício custom; `NULL` nos itens de catálogo. Migração `20260714-custom-items-owner.sql`. Define a visibilidade em `getWorkoutsDb` (mesma regra de `diets.created_by`): o exercício custom aparece para o criador com ou sem vínculo em `user_workouts` |

**RLS:** leitura pública; escrita só nas linhas do próprio usuário (`created_by_user = true and created_by = auth.uid()`). Os seeds de catálogo (`scripts/seed-exercises.mjs`, `scripts/migrate-exercise-images.mjs`) usam service role e passam por cima da RLS. `bulkUpsertCatalogWorkoutsDb` (em `ritmofit-db.ts`, sem callers) escreveria catálogo pelo cliente e **seria bloqueado** pela RLS se voltasse a ser usado.

---

## hydration_logs

Registra entradas de ingestão de água do usuário ao longo do dia.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único |
| `user_id` | uuid | FK → `auth.users` | — | Usuário |
| `amount_ml` | numeric | ✓ | — | Quantidade ingerida em ml |
| `log_date` | date | ✓ | `current_date` | Data do registro |
| `created_at` | timestamptz | — | `now()` | Data de criação |

**RLS:** usuário lê e insere apenas seus próprios registros.  
**Notas:** múltiplos registros por dia são permitidos e somados para calcular o total diário.

---

## mood_logs

Registra o humor diário do usuário. Exibido automaticamente quando o usuário conclui todas as rotinas de Dieta ou Hábitos do dia.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único |
| `user_id` | uuid | FK → `auth.users` | — | Usuário |
| `mood` | text | ✓ | — | Valor do humor: `muito_triste`, `triste`, `neutro`, `feliz`, `muito_feliz` |
| `log_date` | date | ✓ | `current_date` | Data do registro |
| `created_at` | timestamptz | — | `now()` | Data de criação |

**Constraint unique:** `(user_id, log_date)` — apenas um registro por usuário por dia (upsert).  
**RLS:** usuário lê, insere e atualiza apenas seus próprios registros.  
**Migração:** `docs/migrations/20260402-mood-logs.sql`

---

## Segurança / RLS — auditoria de 2026-07-13

Migration: `docs/migrations/20260713-security-hardening.sql`. **As migrações voltaram a ser versionadas** — o `.gitignore` tinha `*.sql`, então nenhuma policy estava no Git.

### O que mudou

| Área | Antes | Depois |
|---|---|---|
| `profiles` (UPDATE) | Policy `only_service_role_can_set_verified` era `FOR UPDATE USING (true)`. Como policies são permissivas e combinadas com **OR**, qualquer autenticado podia dar UPDATE em **qualquer** perfil (nickname, bio, foto de outra pessoa) | `profiles_update_own` (`auth.uid() = user_id`) + trigger `freeze_is_verified` que reverte qualquer mudança de `is_verified` fora do `service_role` |
| `posts` (SELECT) | `hide_posts_from_non_followers` era gating **só no cliente** (`Profile.tsx`) — bastava chamar a API com a anon key para ler tudo | `posts_select_respects_privacy`: dono **ou** perfil não-privado **ou** o viewer segue o autor |
| `following` / `followers` (SELECT) | `hide_follow_lists` também era só client-side | `*_select_respects_privacy`: as duas pontas sempre veem o próprio vínculo; terceiros só veem se nenhum dos dois lados escondeu as listas |
| `messages` | Sem policy versionada — não havia garantia de que a DM fosse privada | SELECT/UPDATE só para remetente e destinatário; INSERT só assinando como remetente; DELETE só das próprias |
| `notifications` | Idem | SELECT/UPDATE/DELETE só do destinatário; INSERT só com `follower_id = auth.uid()` (não dá para forjar quem originou) |
| Mídia de DM | Bucket **público** `posts`, caminho previsível, URL permanente | Bucket **privado** `chat-media`, caminho `{idA}_{idB}/{uuid}.{ext}`, acesso por signed URL de 1 h |

### Funções auxiliares (SECURITY DEFINER)

| Função | Uso |
|---|---|
| `profile_hides_posts(target)` | Lê `hide_posts_from_non_followers` sem recursar na RLS de `profiles` |
| `profile_hides_follow_lists(target)` | Idem para `hide_follow_lists` |
| `viewer_follows(target)` | `auth.uid()` segue `target`? Usada na policy de `posts` |
| `get_profile_counts(target)` | Devolve `posts_count`, `followers_count`, `following_count`. **Necessária**: com a RLS acima, um `count` direto devolveria 0 em perfis privados. O app mostra os números (só as listas e os posts ficam ocultos) — `getUserStatsDb` chama esta RPC |

### Bucket `chat-media`

Privado, 25 MB por arquivo, mime types de imagem/áudio. Policies em `storage.objects` validam que `auth.uid()` é uma das duas pontas do primeiro segmento do caminho (`{uuidA}_{uuidB}`).

---

## Observações Gerais

### Padrão de tipos de ID

| Entidade | Tipo de PK | Motivo |
|---|---|---|
| Usuários (auth) | `uuid` | Padrão Supabase Auth |
| Conteúdo principal (posts, shots, flow) | `uuid` / `bigint identity` | Misto — sem padronização |
| Catálogos (workouts, diets, habits, goals) | `bigint identity` | Sequencial simples |

### Anomalias identificadas

- `flow_likes.flow_id` e `shots_likes.shots_id` usam `smallint` enquanto as PKs das tabelas originais são `bigint` — risco de overflow.
- `followers` e `following` são tabelas simétricas sem constraint de unicidade cruzada — duplicatas são possíveis.
- `notifications.user_id` e `notifications.follower_id` têm `DEFAULT gen_random_uuid()` em vez de FK explícita — sem integridade referencial garantida a nível de banco.

### Tabelas de histórico (padrão `_hist`)

O projeto usa um padrão de duplicação de dados para histórico:

- `user_diets` → `user_diets_hist`
- `user_habits` → `user_habits_hist`
- `user_workouts` → `user_workouts_hist`

Os registros ativos ficam na tabela principal; ao completar, são copiados para a tabela `_hist` com referência ao ID original.
