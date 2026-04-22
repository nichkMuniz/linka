# 14 — Database Schema (Supabase / PostgreSQL)

Documentação técnica de todas as tabelas do banco de dados público (`public`) do projeto RitmoFit.

---

## Índice de Tabelas

| Tabela | Descrição resumida |
|---|---|
| [access_sessions](#access_sessions) | Sessões de acesso dos usuários |
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
| [messages](#messages) | Mensagens diretas entre usuários |
| [notifications](#notifications) | Notificações de usuários |
| [post_complaint](#post_complaint) | Denúncias de posts |
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
| [store_catalog](#store_catalog) | Catálogo de produtos de vitrines |
| [user_complaint](#user_complaint) | Denúncias de usuários |
| [user_diets](#user_diets) | Dietas ativas do usuário |
| [user_diets_hist](#user_diets_hist) | Histórico de dietas do usuário |
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
| `name` | text | ✓ | — | Nome da dieta |
| `description` | text | ✓ | — | Descrição da dieta |
| `photo` | bytea | — | — | Imagem da dieta (binário) |
| `created_at` | timestamptz | ✓ | `now()` | Data de criação |
| `calories` | real | — | — | Calorias associadas |
| `mealdb_id` | integer | — | — | ID de referência no MealDB |
| `category` | text | — | — | Categoria da dieta |

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
| `muscle_group` | text | — | - | Grupo muscular |
| `exercice` | text | — | - | Historico de Exercicios feitos |

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
| `media_url` | text | ✓ | — | URL da mídia (imagem/vídeo) |
| `created_at` | timestamptz | ✓ | `now()` | Data de publicação |

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
| `name` | text | ✓ | — | Nome do hábito |
| `description` | text | ✓ | — | Descrição do hábito |
| `photo` | bytea | — | — | Imagem do hábito (binário) |
| `created_at` | timestamptz | ✓ | `now()` | Data de criação |

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

---

## notifications

Notificações geradas para os usuários (follows, likes, comentários, duelos).

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | bigint | PK (identity) | — | Identificador único |
| `user_id` | uuid | — | `gen_random_uuid()` | Destinatário da notificação |
| `follower_id` | uuid | — | `gen_random_uuid()` | Quem originou a notificação |
| `type` | bigint | — | — | Tipo da notificação |
| `created_at` | timestamptz | ✓ | `now()` | Data de criação |
| `post_id` | uuid | — | — | Post relacionado; também usado para `promotion_id` quando type=8 |
| `read` | boolean | — | `false` | Notificação lida ou não |
| `shots_id` | uuid | — | — | Shot relacionado (se aplicável) |
| `flow_id` | uuid | — | — | Flow relacionado (se aplicável) |
| `duel_check_in_id` | uuid | — | — | Check-in relacionado (se aplicável) |

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
| `objectives` | text[] | — | — | Objetivos fitness selecionados no cadastro (ex: ["fitness", "cardio"]) |
| `gender` | text[] | — | — | sexo do usuario |
| `height` | bigint[] | — | — | altura do usuario |
| `weight` | float[] | — | — | peso do usuario |
| `age` | bigint[] | — | — | idade do usuario |
| `handle` | text[] | — | — | handle do usuario |

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
| `perc` | real | ✓ | `0` | Percentual de conclusão (calculado a partir de days_completed / quantity) |
| `days_completed` | smallint | — | `0` | Dias completados. Incrementado a cada check-in. **Fonte de verdade para o progresso.** |

---

## badges

Catálogo de insígnias disponíveis na plataforma.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único |
| `key` | text | ✓ UNIQUE | — | Chave única (ex: `iniciante`, `sequencia`, `campeao`, `lendario`) |
| `name` | text | ✓ | — | Nome da insígnia |
| `emoji` | text | ✓ | — | Emoji representativo |
| `description` | text | ✓ | — | Descrição do critério |
| `required_checkins` | int | ✓ | `0` | Check-ins semanais necessários para ganhar |
| `sort_order` | int | ✓ | `0` | Ordenação (menor = mais básico) |
| `created_at` | timestamptz | ✓ | `now()` | Data de criação |

---

## user_badges

Insígnias conquistadas por usuário.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único |
| `user_id` | uuid | FK → `profiles.user_id` | — | Usuário |
| `badge_id` | uuid | FK → `badges.id` | — | Insígnia conquistada |
| `earned_at` | timestamptz | ✓ | `now()` | Data de conquista |
| UNIQUE | — | — | — | `(user_id, badge_id)` — cada insígnia é conquistada uma vez |

> RLS: qualquer usuário autenticado pode ler `user_badges` (necessário para exibir no feed sem restrição de seguimento).

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

---

## workouts

Catálogo de treinos disponíveis na plataforma.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único |
| `created_at` | timestamp | — | `now()` | Data de criação |
| `name` | text | ✓ | — | Nome do treino |
| `description` | text | ✓ | — | Descrição do treino |
| `photo` | text | — | — | URL da foto |
| `muscle_group` | text | — | — | Grupo muscular principal |
| `equipment` | text | — | — | Equipamentos necessários |
| `wger_id` | integer | — | — | ID de referência no wger |

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
