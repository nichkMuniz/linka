# 14 — Database Schema (Supabase / PostgreSQL)

Documentação técnica de todas as tabelas do banco de dados público (`public`) do projeto RitmoFit.

---

## Índice de Tabelas

| Tabela | Descrição resumida |
|---|---|
| [access_sessions](#access_sessions) | Sessões de acesso dos usuários |
| [app_admins](#app_admins) | Quem é admin (fonte de verdade do servidor) |
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
| [user_blocks](#user_blocks) | Bloqueio de usuários (App Store Guideline 1.2) |
| [notifications](#notifications) | Notificações de usuários |
| [post_complaint](#post_complaint) | Denúncias de posts |
| [post_tags](#post_tags) | Pessoas marcadas em posts (estilo Instagram) |
| [flow_tags](#flow_tags) | Pessoas marcadas em Flows (estilo Instagram) |
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
| [muscles](#muscles) | Catálogo de músculos e porções (anatomia) |
| [workout_muscles](#workout_muscles) | Recrutamento muscular por exercício (papel + ênfase) |

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

### Função `get_admin_today_activity() → jsonb`

`SECURITY DEFINER`, `STABLE`, `search_path = public`, `GRANT EXECUTE` para `authenticated`, **aborta com `NOT_ADMIN` (`42501`) se `is_app_admin(auth.uid())` for falso** — telemetria de terceiros não é (e não deve ser) legível com a anon key. Migration: `docs/migrations/20260729-admin-today-activity.sql`. Consumida por `getAdminTodayActivityDb()` na seção "Atividade de hoje" do Painel Admin (`docs/18-admin.md`).

Devolve um array de objetos, um por usuário que apareceu hoje — **união** de `access_sessions` e `screen_time_logs` do dia (quem navegou mas ainda não mandou o app para segundo plano só tem a segunda):

| Campo | Origem |
|---|---|
| `user_id`, `nickname`, `handle`, `photo`, `novo_hoje` | `profiles` (`novo_hoje` = cadastrou-se hoje) |
| `sessoes`, `total_seconds`, `primeiro_acesso`, `ultimo_acesso` | `access_sessions` do dia |
| `telas[]` → `{ screen, seconds, registros }` | `screen_time_logs` do dia, agrupado por tela, maior tempo primeiro |
| `screen_seconds` | soma de `telas[].seconds` — pode divergir de `total_seconds` (fontes distintas) |
| `acoes[]` → `{ acao, total, ultima }` e `acoes_total` | contagem do dia em `posts`, `shots`, `flow`, `comments`, `shots_comments`, `likes`, `shots_likes`, `check_ins`, `duel_check_ins`, `messages`, `user_food_logs`, `user_workouts_hist` |

> **Ação tem contagem e horário, não duração.** Não existe tabela de eventos com início/fim no app — duração só faz sentido para tela. A migração também cria os índices `screen_time_logs (log_date)` e `access_sessions (session_date)`, já que a função filtra sempre pelo dia.

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
| `calories` | real | — | — | Calorias associadas (**por porção** — ver `serving_grams`). O catálogo tem duas origens: (a) as ~603 linhas do **TheMealDB**, que não fornece nutrição — dessas, `docs/migrations/20260716-diets-nutrition.sql` preencheu **171** com **estimativas** e as ~432 restantes seguem `NULL` de propósito (a UI mostra "Sem informação nutricional"); (b) os **597 alimentos da Tabela TACO** (`docs/migrations/20260818-taco-food-catalog.sql`), com valor **oficial de análise laboratorial** — só 6 entram sem calorias, porque a própria fonte marca o valor como não analisado |
| `mealdb_id` | integer | — | — | ID de referência no MealDB |
| `category` | text | — | — | Categoria da dieta |
| `protein_g` | real | — | — | Proteína por porção (g). Migração `20260714-food-diary.sql` |
| `carbs_g` | real | — | — | Carboidrato por porção (g) |
| `fat_g` | real | — | — | Gordura por porção (g) |
| `fiber_g` | real | — | — | Fibras por porção (g) |
| `sugar_g` | real | — | — | Açúcar por porção (g). Migração `20260714-water-sugar.sql`. **Continua majoritariamente vazio** — sem ele, a insígnia `sem_acucar_7d` fica inalcançável (`null` = desconhecido, não zero). ⚠️ A carga da TACO **não resolve isto**: a tabela da Unicamp não publica açúcares totais, então os 597 alimentos entram com `sugar_g` NULL |
| `food_quality` | text | — | — | Classificação NOVA simplificada: `in_natura` \| `processado` \| `ultraprocessado` |
| `created_by_user` | boolean | — | `false` | `true` quando o alimento foi cadastrado pelo próprio usuário (criar alimento no wizard de rotina ou registro manual no diário alimentar) |
| `created_by` | uuid | — | — | FK → `auth.users` ON DELETE CASCADE. Dono do item custom; `NULL` nos itens de catálogo. Migração `20260714-custom-items-owner.sql`. **É o que define a visibilidade**: `getDietsDb` mostra o item custom para o seu criador independentemente de existir vínculo em `user_diets` — antes a autoria era inferida do vínculo, e um alimento criado sem virar rotina desaparecia |
| `taco_id` | integer | — | — | ID do alimento na **Tabela TACO 4ª ed. (NEPA/Unicamp)**. `NULL` em tudo que não veio da TACO. Tem índice único parcial (`where taco_id is not null`) — é o que torna `20260818-taco-food-catalog.sql` seguro de reexecutar |
| `serving_grams` | real | — | — | Peso em gramas de **1 porção** — a unidade a que `calories`/`protein_g`/etc. desta linha se referem. Nos itens da TACO é 100 g por padrão (a unidade da fonte), com exceções onde 100 g seria absurdo (óleo → 13 g, bebida → 200 g) ou onde existe medida caseira padronizada (ovo → 50 g, concha de feijão → 80 g). `NULL` nos itens do TheMealDB, que nunca declararam porção |
| `serving_label` | text | — | — | Nome da medida caseira exibido ao usuário — **sem o número na frente** (`"concha"`, não `"1 concha"`), porque a UI já mostra a quantidade ao lado. Gravado em **português**; a tradução acontece na tela, via o mapa `SERVING_KEYS` em `food-diary-card.tsx` (o conjunto de medidas é fechado, criado pela nossa própria migração). `NULL` nos itens do TheMealDB — eles nunca declararam porção, e a UI trata NULL como o genérico "por porção" |

**RLS:** leitura pública. Escrita (`insert`/`update`/`delete`) só é permitida em linhas com `created_by_user = true and created_by = auth.uid()` — ninguém edita o catálogo do sistema pelo app.

### Carga da Tabela TACO (`20260818-taco-food-catalog.sql`)

Os 597 alimentos da Tabela Brasileira de Composição de Alimentos entram como linhas normais de catálogo (`created_by_user = false`, `mealdb_id` nulo) — `getDietsDb` já as mostra a todo mundo pela regra "sem flag de criação manual → visível".

| Detalhe | Como ficou |
|---|---|
| Origem | TACO 4ª ed. (NEPA/Unicamp), dataset público `marcelosanto/tabela_taco` |
| Unidade da fonte | Por 100 g → convertido para a porção da linha (`valor × serving_grams / 100`) |
| `"Tr"` (traços) | Vira `0` — é quantidade conhecida e desprezível |
| `"NA"` / `"*"` / vazio | Vira `NULL` — não foi analisado. Daí 6 alimentos sem calorias (incl. "Leite de vaca integral") e 235 sem fibra |
| Carboidrato negativo | A TACO calcula carboidrato por diferença e 4 alimentos dão ~−0,03 g; a carga zera |
| `food_quality` (NOVA) | Classificação **por regra nossa**, não da TACO: padrão pela categoria + sobrescrita por palavra-chave (salsicha/refrigerante/biscoito → `ultraprocessado`; queijo/pão/conserva → `processado`). Resultado: 409 `in_natura`, 132 `processado`, 56 `ultraprocessado` |
| `name_eng` | `NULL` — a TACO não tem versão em inglês. `pickLocalized` cai no nome em PT para usuário EN; traduzir os 597 nomes é tarefa separada |
| Nome | O invertido da fonte ("Arroz, integral, cozido") vira "Arroz integral cozido" |

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
| `photo` | text | — | — | URL da foto do check-in (a primeira; o mascote padrão do app quando não há foto) |
| `photos` | jsonb | — | — | Array JSON com todas as fotos do check-in (carrossel, até 4). `photo` repete a primeira. Ambas são lidas por `deleteGroupCheckInDb` para limpar o Storage. |
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
| `calories` | integer | — | — | Calorias queimadas (scoring type `calories`). Preenchido pelo check-in manual da Comunidade **e**, desde 21/08/2026, pelo resumo do treino compartilhado no duelo (antes ia sempre `null` e o treino feito pelo app valia 0 num duelo de calorias) |

---

## duel_group_participants

Participantes de um grupo de duelo.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único |
| `group_id` | uuid | FK → `duel_groups.id` | — | Grupo de duelo |
| `user_id` | uuid | FK → `auth.users` | — | Participante |
| `joined_at` | timestamptz | — | `now()` | Data de entrada no grupo |
| `status` | text | — | — | Status do participante (`pending` = pediu para entrar, `invited` = foi convidado, `accepted` = membro) |

> **Realtime (2026-08-13):** a tabela está na publicação `supabase_realtime` (`docs/migrations/20260813-duel-participants-realtime.sql`, idempotente). É o que faz convite/pedido/aprovação aparecerem ao vivo na aba Solicitações da Comunidade. `REPLICA IDENTITY` é a padrão (chave primária): INSERT/UPDATE carregam a linha nova inteira, o DELETE traz só a PK — por isso o cliente trata DELETE como "recarrega tudo" em vez de tentar filtrar.

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
| `scoring_type` | text | — | `'check_in_count'` | Modalidade de pontuação: `check_in_count`, `active_days`, `hustle_points`, `duration`, `distance`, `steps`, `calories` ou `memes`. Definida no Passo 4 do wizard e **não editável** depois |
| `meme_rule` | text | — | — | Regra do desafio, só usada quando `scoring_type = 'memes'`. Obrigatória nesse modo (validado no cliente, tanto no wizard quanto na edição); `NULL` nas demais modalidades |

> **Editável pelo criador:** `name`, `goal`, `photo` e `meme_rule` (este só em grupos de memes) — via `updateGroupInfoDb` / `updateGroupPhotoDb`. `scoring_type`, `location` e `end_date` são definidos na criação e não têm UI de edição: mudar a modalidade recalcularia todo o placar retroativamente.

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
| `poster_url` | text | — | `null` | **Capa do flow em vídeo**: JPEG do 1º frame (~720px, algumas dezenas de KB), extraído no cliente ao postar. O viewer pinta essa imagem instantaneamente (atributo `poster` do `<video>`) enquanto o clipe baixa. `null` em imagens e texto. Migração `20260812-flow-poster.sql`. |
| `duration_ms` | integer | — | `null` | **Duração real do vídeo em ms**, medida no cliente ao postar. O MediaRecorder do iOS grava MP4 **fragmentado**, cujo cabeçalho não traz a duração: no viewer `video.duration` fica `Infinity` até o arquivo **inteiro** baixar, e a barra de progresso trava em 0. Com este valor a barra sincroniza desde o 1º frame. `null` em imagens/texto e em flows anteriores à migração (caem no seek-trick antigo). Migração `20260812-flow-duration.sql`. |
| `background_color` | text | — | `null` | Gradient CSS de fundo para Flows somente-texto. |
| `text_position` | jsonb | — | `null` | **Legado**. Posição única em flows antigos de texto: `{ "x": number, "y": number }` em % (0–100). Substituído por `text_elements`. |
| `text_elements` | jsonb | — | `null` | Lista de textos posicionados: `[{ "text": string, "x": number, "y": number, "style"?: StoryTextStyle }]` com x/y em % (0–100). `style` = `{ fontFamily?, fontWeight?, align?, color?, fontSize?, backgroundColor? }` — cor, fonte, alinhamento, tamanho e **realce de fundo** (estilo Instagram; `null`/ausente = sem fundo). Cada elemento pode ser arrastado/redimensionado independentemente pelo autor. **Desde 2026-08-21 o mesmo array também carrega o mini frame de treino citado no flow**: `{ "kind": "workout", "x", "y", "scale", "workout": StoryWorkoutSticker }`, onde `StoryWorkoutSticker` = `{ name, date, totalSeries, totalVolume, durationSecs, prCount?, caloriesKcal?, exercises: [{ name, sets, kg, isCardio? }], extraCount? }` — snapshot enxuto da sessão (fonte: `routines.last_summary`), sem migração por ser jsonb. Elemento sem `kind` (ou `kind: "text"`) = frase, o formato original. |
| `media_transform` | jsonb | — | `null` | Enquadramento da **mídia em vídeo** ajustado na criação (pinça/arraste): `{ "scale": number, "x": number, "y": number }`, onde `x`/`y` são translação em **% do tamanho do elemento** (resolução-independente). Aplicado via CSS `transform` no viewer. Imagens **não** usam este campo (o ajuste é composto no canvas antes do upload). |
| `reposted_from` | bigint | — | `null` | FK → `flow.id`. Flow original quando este flow é um **repost** (marcado repostou). Migração `20260729-flow-tags.sql`. |
| `reposted_from_user` | uuid | — | `null` | FK → `auth.users`. Autor do flow original (atribuição do repost). |
| `created_at` | timestamptz | ✓ | `now()` | Data de publicação |

> **Migração (rodar no Supabase SQL Editor):**
> ```sql
> ALTER TABLE public.flow ADD COLUMN IF NOT EXISTS media_transform jsonb;
> ALTER TABLE public.flow ADD COLUMN IF NOT EXISTS poster_url text;   -- 20260812-flow-poster.sql
> ALTER TABLE public.flow ADD COLUMN IF NOT EXISTS duration_ms integer; -- 20260812-flow-duration.sql
> ```
> Enquanto as colunas não existirem, o app degrada graciosamente: `selectFlow` cai em camadas (`DURATION → POSTER → FULL → TEXT → BASE`) e o insert detecta `42703` e reenvia sem os campos novos. Sem `poster_url` os flows de vídeo voltam a abrir com tela preta + spinner; sem `duration_ms` a barra de progresso volta a depender do seek-trick (trava até o clipe inteiro baixar). Em ambos os casos só se perde a otimização.

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

> **UI de denúncia entrou em 2026-08-17** (`reportFlowDb`, botão no `FlowViewer`/`FlowViewerModal` — ver `docs/01-feed.md`). O lado admin (`admin_complaints_view`, `admin_delete_content`) já lia/apagava esta tabela desde antes; se o INSERT do app voltar erro de RLS, comparar a policy desta tabela com a de `shots_complaint`/`post_complaint` (INSERT liberado para `authenticated`, sem policy de SELECT/UPDATE/DELETE pro cliente comum) — nenhuma delas está numa migração deste repo, foram criadas direto no painel do Supabase.

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

**Realtime:** publicada em `supabase_realtime` (`20260720-messages-realtime.sql`)
e com **`REPLICA IDENTITY FULL`** desde `20260827-messages-update-realtime.sql`.
A identidade completa é o que permite ouvir **UPDATE** — reação com emoji
(`emoji`) e visualizado (`read`) são UPDATE na mesma linha, não linha nova. Sem
ela o Realtime não consegue avaliar a RLS sobre a linha antiga (que chegaria só
com a PK), e descarta o evento em silêncio.

**Índices** (`docs/migrations/20260702-performance-indexes.sql`): `messages_user_id_idx (user_id)`, `messages_following_id_idx (following_id)`, `messages_following_id_read_idx (following_id, read)` (contagem de não lidas), `messages_created_at_idx (created_at DESC)` (ordenação de conversas).

---

## notifications

Notificações geradas para os usuários (follows, likes, comentários, duelos).

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | bigint | PK (identity) | — | Identificador único |
| `user_id` | uuid | — | `gen_random_uuid()` | Destinatário da notificação |
| `follower_id` | uuid | — | `gen_random_uuid()` | Quem originou a notificação |
| `type` | bigint | — | — | Tipo da notificação (1–19 — ver `docs/10-notificacoes.md`). **Sem check constraint**: adicionar um tipo novo não precisa de migração, só de redeploy da `send-push-notification` para o push ter texto próprio. Os tipos **10 e 17** (mensagem privada / resposta a flow) são filtrados na leitura — existem só para disparar o push |
| `created_at` | timestamptz | ✓ | `now()` | Data de criação |
| `post_id` | uuid | — | — | Post relacionado; guarda o **id do grupo de duelo** quando type=4, 5 ou 11, e o **id da promoção** quando type=8, 12 ou 13 |
| `read` | boolean | — | `false` | Notificação lida ou não |
| `shots_id` | uuid | — | — | Shot relacionado (se aplicável) |
| `flow_id` | bigint | — | — | Flow relacionado (se aplicável). FK lógica → `flow.id` (bigint, **não** uuid) |
| `duel_check_in_id` | uuid | — | — | Check-in relacionado (se aplicável) — comentário (type=3), reação em comentário (type=6), reação em check-in (type=7), check-in de membro do duelo (type=11) e avaliação classificado/desclassificado (type=14/15) |
| `incentive_type` | smallint | — | — | Tipo de incentivo (1–6) quando type=2; evita lookup nas tabelas de likes |

**Tipos de notificação:**

| type | Evento | Campos usados |
|---|---|---|
| 1 | Novo seguidor | `follower_id` |
| 2 | Incentivo em post/shot/flow | `follower_id`, `post_id` ou `shots_id` ou `flow_id` |
| 3 | Comentário em post/shot/flow **ou em check-in de duelo** | `follower_id`, `post_id` ou `shots_id` ou `flow_id` ou `duel_check_in_id` |
| 4 | Convite para duelo | `follower_id`, `post_id` (= duel_group_id) |
| 5 | Solicitação de entrada em duelo | `follower_id`, `post_id` (= duel_group_id) |
| 6 | Reação em comentário | `follower_id`, `post_id` ou `shots_id` ou `flow_id` ou `duel_check_in_id` |
| 7 | Reação em check-in de duelo | `follower_id`, `duel_check_in_id` |
| 8 | Comentário em promoção | `follower_id`, `post_id` (= promotion_id) |
| 9 | Marcado em um post | `follower_id` (autor do post), `post_id` |
| 16 | Marcado em um flow | `follower_id` (autor do flow), `flow_id` |
| 17 | **Resposta privada a um flow** (mensagem, não card) | `follower_id` (quem respondeu), `flow_id` |
| 18 | **Comentaram num flow em que o destinatário também comentou** | `follower_id` (quem comentou agora), `flow_id` |
| 19 | **Convite para treinar junto** (26/08/2026) | `follower_id` (quem convidou), `post_id` (= `workout_parties.id`) |
| 14 | Check-in **classificado** (aprovado) por um participante | `follower_id` (quem votou), `duel_check_in_id` |
| 15 | Check-in **desclassificado** (reprovado) por um participante | `follower_id` (quem votou), `duel_check_in_id` |

> **`duel_check_in_id` sozinho não identifica o evento** — os tipos 3, 6, 7, 11, 14 e 15 usam a mesma coluna. É o `type` que separa "comentou no check-in" (3) de "reagiu ao seu comentário" (6), "reagiu ao seu check-in" (7), "postou um check-in no duelo" (11) e a avaliação do check-in (14/15). Até 2026-07-21 `addCheckInCommentDb` gravava o comentário como tipo 6, colidindo com a reação; ver `docs/10-notificacoes.md`.

**Como as notificações são criadas:** por **triggers AFTER INSERT** nas tabelas de origem (não pelo código do cliente). Funções `SECURITY DEFINER` que buscam o dono do conteúdo e inserem em `notifications`:

| Tabela de origem | Trigger | Function | Notif gerada |
|---|---|---|---|
| `followers` | `trigger_notify_follow` | `notify_follow()` | type 1 |
| `likes` | `trg_notify_on_post_incentive` | `notify_on_incentive()` | type 2 (post) |
| `shots_likes` | `trg_notify_on_shot_incentive` | `notify_on_shot_incentive()` | type 2 (shot) |
| `flow_likes` | `trg_notify_on_flow_incentive` | `notify_on_flow_incentive()` | type 2 (flow) |
| `comments` | `trigger_notify_post_comment` | `notify_post_comment()` | type 3 (post) |
| `shots_comments` | `notify_shots_comment` | `notify_shots_comment()` | type 3 (shot) |
| `flow_comments` | `trg_notify_flow_comment` | `notify_flow_comment()` | type 3 (flow) — só para o **dono** do flow |
| `flow_comments` | `trg_notify_flow_comment_followup` | `notify_flow_comment_followup()` | type 18 — para os **demais comentaristas** do mesmo flow |
| `post_tags` | `trg_notify_post_tag` | `notify_post_tag()` | type 9 (marcado em post) |
| `flow_tags` | `trg_notify_flow_tag` | `notify_flow_tag()` | type 16 (marcado em flow) |
| `duel_check_in_votes` | `trg_notify_check_in_vote` | `notify_check_in_vote()` | type 14 / 15 (check-in classificado / desclassificado) |
| `duel_check_in_votes` | `trg_notify_check_in_vote_removed` | `notify_check_in_vote_removed()` | apaga a 14/15 quando o voto é desfeito |

> A trigger `notify-push-on-notification` (AFTER INSERT em `notifications`) chama a edge function `send-push-notification` para qualquer linha inserida — ou seja, o push é automático.
> As triggers de flow foram adicionadas em `docs/migrations/20260521-flow-notifications.sql`; a do tipo 18, em `docs/migrations/20260818-flow-comment-followup.sql`.
>
> **As duas triggers de `flow_comments` não se sobrepõem:** a `..._followup` exclui da lista de destinatários tanto o autor do comentário novo quanto o dono do flow (que já recebeu o tipo 3 na mesma inserção). Sem essa exclusão o dono levaria dois pushes pela mesma frase. Ela também pula o insert enquanto existir uma 18 **não lida** do mesmo autor no mesmo flow — é o que impede uma rajada de comentários de virar uma rajada de pushes.
>
> **Por que a avaliação de check-in (14/15) é trigger e não insert do cliente** (`docs/migrations/20260721-checkin-vote-notifications.sql`): a RLS de `notifications` dá SELECT/DELETE **só ao destinatário**. O votante não lê nem apaga as notificações de quem recebeu o voto, então nenhuma checagem de duplicata feita no cliente funciona — o SELECT volta vazio e o insert se repete a cada troca de voto. Rodando como `SECURITY DEFINER`, a função apaga a avaliação anterior daquele votante antes de gravar a nova (trocar de voto **reescreve**, e desfazer o voto **remove**).
>
> ⚠️ Pelo mesmo motivo, os dedups client-side que ainda existem em `sendCheckInReactionNotificationDb` (type 7) e `sendMessageNotificationDb` (type 10) são **no-ops silenciosos** — o `SELECT` que eles fazem em `notifications` sempre volta vazio sob RLS. Ver `docs/10-notificacoes.md`.

**Índices** (`docs/migrations/20260702-performance-indexes.sql`): `notifications_user_id_created_at_idx (user_id, created_at DESC)` (listagem em `getNotificationsDb`), `notifications_user_id_read_idx (user_id, read)` (contagem de não lidas em `getUnreadNotificationsCountDb`). Em `20260818-flow-comment-followup.sql`: `notifications_followup_dedup_idx (user_id, type, flow_id) WHERE read = false` (checagem de duplicata da trigger do tipo 18) e `flow_comments_flow_id_user_id_idx (flow_id, user_id)` (varredura dos participantes do flow).

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

## flow_tags

Pessoas marcadas em **Flows** (mesma ideia de `post_tags`, mas para a tabela `flow`; `flow.id` é **bigint**). Criada na migração `docs/migrations/20260729-flow-tags.sql`.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único |
| `flow_id` | bigint | FK → `flow.id` ON DELETE CASCADE | — | Flow onde a pessoa foi marcada |
| `user_id` | uuid | FK → `auth.users` ON DELETE CASCADE | — | Pessoa marcada |
| `created_at` | timestamptz | ✓ | `now()` | Data da marcação |

**Constraint:** `unique(flow_id, user_id)`. **Índices:** `flow_tags_flow_id_idx`, `flow_tags_user_id_idx`.
**RLS:** SELECT pública; INSERT só o dono do flow; DELETE o dono ou a própria pessoa marcada.
**Trigger:** `trg_notify_flow_tag` (AFTER INSERT) → `notify_flow_tag()` (SECURITY DEFINER) insere notificação **type 16** para a pessoa marcada (ignora auto-marcação); push automático.
**Funções (`ritmofit-db.ts`):** `createStoryDb` (7º parâmetro `taggedUserIds`, 8º `repost`), `getFlowTagsDb(flowId)` e `repostStoryDb(flowId)` (cria um flow do próprio usuário reaproveitando a mídia do original + atribuição em `flow.reposted_from*`).

> A migração também adiciona em `flow` as colunas `reposted_from` (bigint → `flow.id`) e `reposted_from_user` (uuid → `auth.users`) para atribuir o repost. `createStoryDb` degrada graciosamente se as colunas ainda não existirem (detecta `42703` e reenvia sem elas).

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
| `workout_summary` | jsonb | — | `NULL` | **(2026-07-06)** Snapshot estruturado do treino quando um "resumo do treino" é compartilhado no feed (rotina, duração, séries, volume, `caloriesKcal` (kcal da sessão, desde 21/08/2026), `imageUrl` do card gerado e a lista de exercícios com `sets: {kg, reps}` por série). Formato = `PostWorkoutSummary` (`client/lib/workout-summary-types.ts`). Habilita o pill "Ver treino" + o modal de detalhe no feed/Perfil/PostDetail. Desde **26/08/2026** traz também **`userPhotoCount`** — quantas fotos da galeria/câmera a pessoa anexou ao resumo (o card gerado e o mapa do trajeto não contam); `0` manda o post para a aba **Treinos** do perfil em vez da aba Posts (ver `docs/08-perfil.md`). Sem migração: é só mais uma chave do jsonb, e posts antigos caem no fallback de `isWorkoutCanvasPost`. Desde **26/08/2026** cada exercício da lista traz também **`workoutId`** (o id no catálogo `workouts`), que é a chave usada pela **comparação de treino** para casar o mesmo exercício entre duas pessoas — posts antigos caem no casamento por nome (ver `docs/01-feed.md` → Comparar treino). Também sem migração. `NULL` em posts comuns de imagem/texto. Herda as policies RLS de `posts`. Ver `docs/migrations/20260706-post-workout-summary.sql` |

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
| `gender` | text[] | — | — | Sexo do usuário — o cadastro grava o **texto** `male` \| `female` \| `other`. Lido por `getUserProfileDb` (normaliza array→texto) e usado pelo gerador de rotina sugerida para calibrar faixa de repetições e descanso (`client/lib/coach-profile.ts`). Escrito também por `updateUserPersonalDataDb` no passo "Sobre você" do quiz |
| `height` | bigint[] | — | — | altura do usuario |
| `weight` | float[] | — | — | peso do usuario |
| `age` | bigint[] | — | — | idade do usuario |
| `handle` | text | — | — | @usuário. Guardado **sem** o prefixo `@` e em minúsculo (o `@` é só exibição). **Único global** via índice `profiles_handle_unique_idx` (`unique (lower(handle)) where handle is not null and handle <> ''`). Escrito pelo trigger `handle_new_user` (com de-colisão por sufixo) e sobrescrito pelo `UPDATE` do cliente no fim do cadastro. Migration: `docs/migrations/20260720-profiles-signup-fixes.sql` |
| `is_verified` | boolean | ✓ | `false` | Indica conta oficial verificada (badge dourado). Só pode ser alterado via service_role (admin). |
| `hide_follow_lists` | boolean | ✓ | `false` | Privacidade: quando `true`, outros usuários não conseguem abrir as listas de seguidores/seguindo deste perfil (gating client-side em `Profile.tsx`). |
| `hide_posts_from_non_followers` | boolean | ✓ | `false` | Privacidade: quando `true`, a aba Posts do perfil só é visível para quem segue o dono. |
| `is_banned` | boolean | ✓ | `false` | Conta banida pela moderação. Escrito **só** pela RPC `admin_set_banned` (o trigger `freeze_is_banned` reverte qualquer outra origem). Sozinho ele **não bloqueia nada** — quem barra o acesso é o `auth.users.banned_until` que a mesma RPC grava; este flag serve ao card de métricas e à tela `BannedScreen`. Migration: `docs/migrations/20260811-admin-ban-user.sql` |
| `selected_badge_id` | uuid | — | `null` | FK → `badges.id`. Insígnia que o usuário **escolheu** exibir. Persistente: check-ins e novas conquistas **nunca** a alteram — só uma troca explícita no `InsigniasDrawer`. `null` = nunca escolheu (exibe a de maior `sort_order` do acervo). Migration: `docs/migrations/20260714-badge-selection-persist.sql` |

> Migration: `docs/migrations/20260626-profile-privacy.sql`

**RLS / funções (migration `20260720-profiles-signup-fixes.sql`):**
- `profiles_insert_own` (INSERT, `with check (auth.uid() = user_id)`) — sem ela, o `upsert` do cliente no cadastro/`ensureProfile` era barrado no braço de INSERT e falhava em silêncio (foto e handle não gravavam). Complementa `profiles_update_own`.
- `profiles_handle_unique_idx` — índice único case-insensitive garante handle único global.
- `check_handle_exists(p_handle text, p_exclude_user uuid default null) → boolean` — RPC `SECURITY DEFINER` (grant `anon, authenticated`) para checar disponibilidade de handle em tempo real no cadastro (`checkHandleExistsDb`), normalizando com/sem `@`.
- `handle_new_user` reescrito: grava `handle` **sem** `@`, com de-colisão por sufixo numérico (nunca quebra o `signUp` por handle duplicado).

**Banimento (migration `20260811-admin-ban-user.sql`):**
- `admin_set_banned(p_user_id uuid, p_banned boolean default true) → jsonb` — RPC `SECURITY DEFINER` (grant `authenticated`) que checa `is_app_admin(auth.uid())`, recusa banir a própria conta (`CANNOT_BAN_SELF`), grava `is_banned` **e** aplica `auth.users.banned_until = now() + 100 anos` + `delete from auth.sessions` (é isto que expulsa o usuário; a RLS não conhece "banido"). Retorna `{"updated": bool, "session_revoked": bool}` — `session_revoked: false` significa que o flag foi gravado mas o acesso continua de pé (dono da função sem grant em `auth`).
- `freeze_is_banned` (trigger `before update`) — reverte `is_banned` para quem não é service_role nem admin, senão qualquer um se desbaniria sozinho via `profiles_update_own`.
- `is_current_user_banned() → boolean` — RPC estreita (grant `authenticated`) usada pelo guard de rota no app. Existe para a tela de bloqueio não precisar de `select` em `profiles`, que é público e permitiria varrer quem foi banido.

**Moderação e verificação (migration `20260811-admin-moderation.sql`):**
- `admin_delete_content(p_tipo text, p_id text) → jsonb` — remove post/shot/flow denunciado com as dependências; retorna `{"deleted": bool, "media": [urls]}` (o cliente apaga o storage). `p_id` é texto porque as três PKs têm tipos diferentes.
- `admin_purge_refs(p_table, p_col, p_id)` — helper **interno** (sem grant) que apaga referências comparando `coluna::text`, tolerando as divergências de tipo do schema e tabelas ausentes.
- `admin_set_verified(p_user_id uuid, p_verified boolean default true) → boolean` — único caminho de escrita de `is_verified`.
- `freeze_is_verified` foi reescrito para reconhecer `is_app_admin` — sem isso a RPC acima gravaria e o trigger reverteria na saída.

> ⚠️ **`profiles.id` é bigint; o uuid do usuário é `user_id`.** Filtrar por `id` com um uuid gera `invalid input syntax for type bigint` — foi exatamente o bug do botão "Banir usuário" do painel admin.
>
> ⚠️ **`UPDATE`/`DELETE` barrado por RLS casa 0 linhas e não retorna erro.** Toda escrita do painel em linha de terceiro precisa de RPC `SECURITY DEFINER` que devolva o `row_count` — foi a causa de "remover conteúdo", "banir" e "verificar conta" fingirem sucesso.

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
| `goal_id` | bigint | — | — | Meta vinculada à rotina (id do catálogo `goals`, não `user_goals.id`). Zerado automaticamente pelo próprio app no dia seguinte a essa meta chegar a 100% (`unlinkCompletedGoalRoutinesDb`, ver `docs/05-metas.md`) — não é RLS nem trigger, é uma checagem no carregamento da tela de Metas. |
| `name` | text | — | — | Nome da rotina |
| `last_summary` | jsonb | — | — | Snapshot do resumo do **último treino finalizado** desta rotina (mesmo formato de `WorkoutSummaryData`, sem `userId`/`userGroups` — resolvidos de novo ao reabrir): `routineName`, `totalSeries`, `totalVolume`, `durationSecs`, `badges`, `completedExercises`, `prExercises`, `machinedExercises`, `caloriesKcal` (kcal da sessão, desde 21/08/2026 — ausente nos snapshots anteriores), `completedAt`. Sobrescrito a cada "Finalizar" (`updateRoutineLastSummaryDb`) — nunca há mais de um snapshot por rotina, sempre o mais recente. `NULL` = rotina nunca executada. Gateia o ícone de "resumo do treino" no `routine-detail-drawer.tsx` (só aparece quando não-nulo). Migration: `docs/migrations/20260702-routine-last-summary.sql`. |
| `training_mode` | text | ✓ | `'simple'` | **(2026-08-05)** Modo da experiência de treino desta rotina — a escolha do usuário no passo `routine-mode` do wizard. `'simple'` = tela clássica de registro (tabela KG × REPS); `'expert'` = série tipada (aquecimento/válida/falha), com o aquecimento contando no volume e na contagem de séries mas fora do PR e da progressão (ver `docs/05-metas.md`). `CHECK (training_mode IN ('simple','expert'))`. É **por rotina**, não por conta: o mesmo usuário pode ter "Peito/Tríceps" no expert e "Corrida de domingo" no simplificado. Só rotinas de treino (`type = 1`) perguntam; dieta/hábito ficam no default. Lido em `getUserRoutinesDb` → `RoutineCard.trainingMode` → prop `trainingMode` do `WorkoutSessionDialog`. Gravado por `updateRoutineTrainingModeDb` (por id, caminho do quiz) e `updateRoutineTrainingModeByNameDb` (por `user_id`+`type`+`name`, caminho "do zero", onde a linha nasce de trigger). Migration: `docs/migrations/20260805-training-mode.sql`. |
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

## user_blocks

Bloqueio de um usuário por outro. Criada em `docs/migrations/20260826-user-blocks.sql`
para atender à **App Store Guideline 1.2** (Safety — User-Generated Content), que
exige que todo app com conteúdo de usuário permita bloquear quem abusa.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | bigint | PK (identity) | — | Identificador único |
| `blocker_id` | uuid | ✓ | — | Quem bloqueou (FK → `auth.users`, ON DELETE CASCADE) |
| `blocked_id` | uuid | ✓ | — | Quem foi bloqueado (FK → `auth.users`, ON DELETE CASCADE) |
| `created_at` | timestamptz | ✓ | `now()` | Data do bloqueio |

**Constraints:** `user_blocks_no_self` (`blocker_id <> blocked_id`) e
`user_blocks_unique` (`blocker_id, blocked_id`) — bloquear de novo é no-op: o
cliente trata o código `23505` como sucesso.

**Índices:** `user_blocks_blocker_idx (blocker_id)` e
`user_blocks_blocked_idx (blocked_id)` — as duas direções são lidas a cada carga
de feed.

**RLS:**

| Policy | Regra |
|---|---|
| `user_blocks_select_involved` | SELECT para quem bloqueou **e** para quem foi bloqueado — o cliente precisa saber que foi bloqueado para esconder o outro do próprio feed |
| `user_blocks_insert_own` | INSERT só assinando como `blocker_id` |
| `user_blocks_delete_own` | DELETE só de quem bloqueou. Sem isto o bloqueado apagaria o próprio bloqueio |

**Função `is_blocked_between(a uuid, b uuid) → boolean`** — `SECURITY DEFINER`,
`stable`. **Simétrica de propósito:** o bloqueio esconde nos dois sentidos. Uma
direção só não protege ninguém — se A bloqueia B mas continua aparecendo para B,
B segue vendo, comentando e reagindo, que é exatamente o assédio que o bloqueio
deveria encerrar. A linha em `user_blocks` guarda quem decidiu; só essa pessoa
desfaz.

**Efeitos em outras tabelas:**

- `messages` — a policy `messages_insert_own` foi **substituída** por
  `messages_insert_not_blocked`, que adiciona
  `not is_blocked_between(auth.uid(), following_id)`. Esta é a única parte do
  bloqueio que vive no banco: esconder no cliente resolve a leitura, mas não
  impede o abusador de **enviar**. Filtro de UI se contorna; policy, não.
- `followers` — o trigger `user_blocks_unfollow_trg` apaga o follow **nos dois
  sentidos** ao bloquear. Continuar seguindo alguém que você bloqueou o manteria
  no feed "Seguindo" e nas contagens, e o bloqueio pareceria não ter funcionado.

**Onde é lido no cliente** (`client/lib/ritmofit-db.ts`):

| Função | Uso |
|---|---|
| `getBlockedIdsDb()` | Ids invisíveis nos dois sentidos. Cache `blockedIds:<uid>` com **TTL curto (30s)** - "alguém me bloqueou" é escrita de TERCEIROS, não passa por `invalidateQueryCache` neste device, e o TTL é a única defesa contra continuar exibindo quem acabou de me bloquear |
| `getBlockedByMeDb()` | Só quem EU bloqueei, com perfil — alimenta "Contas bloqueadas" em Configurações |
| `blockUserDb()` / `unblockUserDb()` | Escrita + invalidação de `blockedIds`, `followingIds`, `followers`, `userStats` e `conversations` |

Superfícies que aplicam o filtro: feed e Descobrir
(`client/services/post.service.ts`), `searchUsersDb`, `getPostCommentsDb` e
`getConversationsDb`.

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
| `workout_week` | **DIAS distintos** com treino na semana atual (Dom–hoje, data local) em `user_workouts_hist` ≥ `required_checkins` | `treino_3_semana` |
| `workout_type` | **DIAS distintos** com treino do tipo `condition_metadata.type` em `user_workouts_hist` ≥ `required_checkins`. O tipo sai de `workouts.muscle_group` (não existe coluna `workout_type`): `cardio` casa com o grupo `Cardio`, `forca` = qualquer grupo que **não** seja `Cardio`/`Alongamento`/`Mobilidade`. Conta **dias**, não linhas — o histórico grava uma linha por SÉRIE. **Corrigido em 21/08/2026**: as duas leituras apontavam para uma tabela `workout_histories` inexistente e nunca concediam nada | `treino_forca_10`, `treino_cardio_10` |
| `app_usage` | Dias distintos com sessão em `access_sessions` ≥ `required_checkins` | `app_7dias`, `app_30dias` |
| `nutrition_no_ultra` | Dias **seguidos** sem ultraprocessado no diário ≥ `required_checkins` | `sem_ultraprocessado_7d` |
| `nutrition_protein` | Dias **seguidos** batendo `user_nutrition_goals.protein_target_g` ≥ `required_checkins` | `proteina_7d` |
| `nutrition_week` | Dias com registro no diário na semana atual (Dom–Sáb) ≥ `required_checkins` | `semana_nutritiva` |
| `nutrition_no_sugar` | Dias **seguidos** com açúcar total ≤ `condition_metadata.max_sugar_g` (25 g, OMS) ≥ `required_checkins` | `sem_acucar_7d` |
| `nutrition_hydration` | Dias **seguidos** batendo a meta de água (`user_nutrition_goals.water_target_ml`, ou `condition_metadata.ml` = 2000) ≥ `required_checkins` | `hidratacao_7dias` |
| `nutrition_fruits` | **(21/08/2026)** Dias **seguidos** com ao menos uma fruta no diário — `diets.category` começando com `Frutas` (é prefixo: `Frutos do Mar` também contém "frut") | `frutas_7d` |
| `nutrition_home_food` | **(21/08/2026)** Dias **seguidos** com **prato preparado** no diário **e** nenhum ultraprocessado. Prato preparado = `diets.category` na lista `PREPARED_DISH_CATEGORIES` (categorias de receita do TheMealDB + `Alimentos preparados` da TACO) — categorias de **ingrediente** da TACO (`Carnes e derivados`, `Cereais e derivados`) ficam de fora | `comida_caseira_5d` |
| `habit_sleep` / `habit_meditation` / `habit_no_alcohol` / `habit_steps` | **(21/08/2026)** Dias **seguidos** com um hábito daquele tipo **marcado como feito** (`user_habits_hist`). O tipo sai do **nome** do hábito (`client/lib/habit-kinds.ts`), não do `habits.id` — hábito custom criado pela pessoa conta igual | `sono_7d`, `meditacao_5d`, `sem_alcool_7d`, `passos_10k_7d` |
| `habit_perfect_week` / `habit_perfect_30d` | **(21/08/2026)** Dias **seguidos** de check-in (mesma sequência do anel de streak) ≥ `required_checkins` | `semana_perfeita` (7), `modo_monge` (30) |
| `habit_perfect_day` | **(21/08/2026)** Um dia com os **três pilares**: treino (`user_workouts_hist`) + hábito (`user_habits_hist`) + alimentação (`user_food_logs`) | `super_dia` |
| `challenge_count` | **(21/08/2026)** Duelos distintos em que o usuário entrou de fato (`duel_group_participants` com `status = 'accepted'`) | `desafio_3x` |

**Insígnias de nutrição** (`awardNutritionBadgesDb`, chamada ao registrar um alimento **ou água** — e, desde 21/08/2026, também ao concluir um item de dieta na rotina) são avaliadas sobre `user_food_logs` + `user_water_logs`. As demais (`checkin_*`, `workout_*`, `habit_*`, `app_usage`, `challenge_count`) ficam em `awardBadgesForCheckInsDb`, chamada ao concluir um treino/rotina **e** ao marcar um hábito.

> ⚠️ **`required_checkins` precisa estar preenchido.** As insígnias de hábito, comida e desafio foram cadastradas pelo painel e ficaram com `0` — inofensivo enquanto elas nunca eram concedidas, fatal depois de 21/08/2026 (`Math.max(1, 0)` = 1 → "Sono 7 dias" na primeira noite). A migração `docs/migrations/20260821-badge-thresholds.sql` grava os valores certos; o cliente ainda tem o piso `CONDITION_MIN_THRESHOLD` como rede de segurança.

> **Desconhecido nunca conta como zero.** A qualidade vem de `diets.food_quality` via `diet_id` e o açúcar de `user_food_logs.sugar_g`. Um dia com qualquer alimento de valor **desconhecido** (entrada manual sem o campo preenchido, ou item de catálogo com `sugar_g` nulo) **não conta** para `nutrition_no_ultra` / `nutrition_no_sugar`: não há como provar que não houve ultraprocessado ou açúcar, e aceitar o desconhecido entregaria a insígnia a quem registra tudo na mão. Consequência prática: enquanto `diets.sugar_g` não estiver populado no catálogo, `sem_acucar_7d` continua (corretamente) inalcançável.

> **Cada insígnia só é concedida quando a condição DELA é satisfeita.** Os tipos marcados com ⚠️ não têm como ser verificados hoje, então `_evaluateBadgeCondition` devolve `false` e eles ficam permanentemente bloqueados — **é intencional**. Liberá-los por contagem de check-ins (o que o drawer fazia até 14/07/2026, via `totalCheckIns >= required_checkins` para todo tipo) entregava, por exemplo, o Madrugador a quem nunca treinou de manhã. Para ativá-los é preciso implementar o tracking + a avaliação, não afrouxar o desbloqueio.

---

## subscriptions

Assinatura **LinKa Premium** — uma linha por usuário. Criada em `docs/migrations/20260715-premium-plan.sql`, estendida para cobrança real em `docs/migrations/20260803-premium-iap.sql`. Ver `docs/17-premium.md`.

> **Dois conjuntos de colunas DISJUNTOS na mesma linha** (Decisão D6). Assinatura paga e cortesia do admin escreveriam nas mesmas colunas e se destruiriam — uma renovação apagaria a cortesia, e liberar cortesia para quem paga apagaria os dados da assinatura. Quem escreve o quê:
> - **Assinatura paga** (`status`, `product_id`, `store`, `rc_app_user_id`, `environment`, `current_period_end`) → **só** a edge function `revenuecat-webhook`
> - **Cortesia** (`manual_active`, `manual_until`, `manual_note`) → **só** a RPC `admin_set_premium`

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `user_id` | uuid | PK, FK → `auth.users.id` ON DELETE CASCADE | — | Usuário assinante |
| `status` | text | ✓ | `'inactive'` | `active` \| `inactive` \| `expired` \| `cancelled`. Só o webhook escreve |
| `product_id` | text | — | — | Product id do RevenueCat |
| `store` | text | — | — | `'app_store'` |
| `rc_app_user_id` | text | — | — | `app_user_id` do RevenueCat (= `user_id` do Supabase). Indexado |
| `environment` | text | — | — | `'production'` \| `'sandbox'` |
| `current_period_end` | timestamptz | — | — | Fim do período pago; `NULL` = nunca houve assinatura paga |
| `manual_active` | boolean | ✓ | `false` | **(2026-08-03)** Cortesia concedida pelo admin. O webhook **nunca** toca nesta coluna |
| `manual_until` | timestamptz | — | — | **(2026-08-03)** Fim da cortesia. `NULL` com `manual_active = true` → permanente |
| `manual_note` | text | — | — | **(2026-08-03)** Motivo da cortesia (só o painel admin lê) |
| `created_at` | timestamptz | ✓ | `now()` | Data de criação |
| `updated_at` | timestamptz | ✓ | `now()` | Data de atualização |

> **RLS:** SELECT apenas da própria linha (`subscriptions_select_own`). **Nenhuma policy de escrita** — só o service role escreve; é isso que impede um usuário de se auto-promover a premium via API.

### Função `is_premium(uid uuid) → boolean`

`SECURITY DEFINER`, `STABLE`, `search_path = public`. Atualizada em `20260803-premium-iap.sql`. Retorna `true` quando **qualquer** um dos três braços vale:

1. `status = 'active'` e (`current_period_end` nulo ou futuro) — assinatura vigente;
2. `status = 'cancelled'` e `current_period_end` no futuro — **cancelada mas dentro do período já pago**. A Apple não estorna o período corrente; sem este braço o webhook de `CANCELLATION` cortaria na hora um acesso pago (Decisão D7);
3. `manual_active` e (`manual_until` nulo ou futuro) — cortesia do admin.

Consumida pelo app via RPC (`getPremiumStatusDb` em `ritmofit-db.ts`, cache `premium:{uid}` TTL 60s) e nas policies `WITH CHECK` de `routines`/`duel_groups`. `GRANT EXECUTE` para `authenticated`.

### Funções de admin sobre `subscriptions`

Migrations: `20260729-admin-premium.sql` (original) e `20260803-premium-iap.sql` (atual). Permitem que o Painel Admin conceda premium sem `INSERT` manual no SQL Editor, **sem** abrir policy de escrita na tabela.

| Função | Assinatura | O que faz |
|---|---|---|
| `admin_set_premium` | `(p_user_id uuid, p_active boolean, p_days integer default null, p_note text default null) → void` | Mexe **só** nas colunas de cortesia. `true`: upsert com `manual_active = true` e `manual_until = now() + p_days` (ou `null` = permanente). `false`: `manual_active = false`. Nunca toca em `status`/`store`/`current_period_end` — conceder cortesia a um assinante não altera a assinatura dele, e revogá-la não cancela nada na Apple |
| `admin_list_premium` | `() → table(user_id, nickname, handle, photo, status, store, current_period_end, updated_at, manual_active, manual_until, manual_note, paid_active, is_active)` | Todas as linhas + perfil, ativos primeiro. `paid_active` = assinatura paga vigente; `is_active` repete a regra completa de `is_premium()` |

### Limites do plano grátis na RLS

Migration: `docs/migrations/20260803-premium-limits-rls.sql` (rodar **separadamente**, depois de validar a compra em sandbox). Policies de **INSERT** que aplicam no servidor os limites que antes só existiam no app:

| Tabela | Policy | Regra |
|---|---|---|
| `routines` | `routines_insert_within_plan` | `is_premium(auth.uid()) OR count_own_routines(auth.uid()) < 1` |
| `duel_groups` | `duel_groups_insert_within_plan` | `is_premium(auth.uid()) OR count_own_active_duels(auth.uid()) < 1` |

Os helpers `count_own_routines` / `count_own_active_duels` são `SECURITY DEFINER` para contar sem recursar na própria RLS da tabela. Só INSERT é limitado — UPDATE/DELETE ficam livres para quem já passou do limite continuar editando o que tem.

Ambas são `SECURITY DEFINER` com `search_path = public`, `GRANT EXECUTE` para `authenticated`, e abortam com `NOT_ADMIN` (errcode `42501`) se `is_app_admin(auth.uid())` for falso.

---

## app_admins

Fonte de verdade **do servidor** sobre quem é admin. Criada em `docs/migrations/20260729-admin-premium.sql`.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `user_id` | uuid | PK | — | `auth.users.id` do admin. **Sem FK** de propósito: um id inexistente faria a migração inteira falhar |
| `note` | text | — | — | Quem é (uso interno) |
| `created_at` | timestamptz | ✓ | `now()` | Data de criação |

> **RLS ligada e NENHUMA policy:** ninguém lê nem escreve com a anon key. Só o service role e as funções `SECURITY DEFINER` (que rodam com o privilégio do dono) enxergam a tabela.

### Função `is_app_admin(uid uuid) → boolean`

`SECURITY DEFINER`, `STABLE`. Usada pelas RPCs de admin. **A lista `ADMIN_USER_IDS` em `client/App.tsx` não autoriza nada** — é só guarda de rota; ao promover alguém a admin, inserir nos **dois** lugares.

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
| `scheduled_time` | time | — | — | Hora de **início** do hábito (ex: `07:30:00`). É **por item** (cada hábito da rotina tem o seu) |
| `scheduled_end_time` | time | — | — | **(2026-07-16)** Hora de **fim** do hábito — o outro lado da janela de execução (`09:00–18:00`). **NULL = sem hora de fim** (hábito pontual como "Tomar remédio", ou de dia inteiro como "Não fumar"); nunca preenchido sem `scheduled_time`. **Pode ser menor que o início**: janelas que viram a noite são válidas (Dormir `23:00–07:00`) — não há constraint de ordem. Gera um **2º lembrete** ("hora de encerrar") em `getRoutineSchedulesDb`, que emite uma entrada `phase:"start"` e outra `phase:"end"`. Só existe em `user_habits` (treino/dieta têm horário único por rotina, sem janela). Gravado por `updateHabitScheduledEndTimeDb`. Migração: `docs/migrations/20260716-habit-end-time.sql` |
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
| `restrictions` | text | — | — | **(13/08/2026)** Articulações em cuidado, CSV: `knee`, `shoulder`, `lower_back`, `wrist`. **Vetam exercícios** no gerador de rotina sugerida (`eligiblePool` em `program-generator.ts`) e alimentam as adaptações de execução na sessão de treino. Mesmo formato CSV de `training_days`. Migration: `docs/migrations/20260813-fitness-profile-restrictions.sql` |
| `created_at` | timestamptz | — | `now()` | Data de criação |
| `updated_at` | timestamptz | — | `now()` | Última atualização |

**RLS:** `fitness_profile_manage_own` — usuário só lê/escreve a própria linha (`auth.uid() = user_id`).

> Migration: `docs/migrations/20260708-fitness-profile-and-program-meta.sql`
>
> ⚠️ `getFitnessProfileDb`/`upsertFitnessProfileDb` **degradam** enquanto a migração de `restrictions` não roda: detectam `42703` (`undefined_column`) e refazem a consulta/escrita sem a coluna. O resto do perfil continua funcionando; só as restrições não persistem entre criações.

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
| `technique` | text | ✓ | `'straight'` | **(2026-08-05)** Técnica deste exercício **nesta** rotina: `straight` (série direta), `drop` (drop-set), `rest_pause`, `biset`/`triset` (exigem `technique_group`). `CHECK` nesses 5 valores. Vive aqui e não em `workouts` porque "supino reto" não é bi-set — é bi-set *nesta rotina*, pareado com um exercício específico. Escolhida no passo `build-technique` do wizard ou no botão "Técnicas" do `RoutineDetailDrawer`, **só no modo expert**. **Desde 12/08/2026 a coluna muda a tela de registrar treino** (ver `docs/05-metas.md`): `biset`/`triset` renderizam **um card com os exercícios lado a lado** e descanso compartilhado, `drop` ganha o chip "+ queda" (cada queda é uma linha com KG/REPS próprios) e `rest_pause` limita o descanso a 15s. Rotina que voltou ao modo simplificado mantém o valor gravado, mas a sessão dela ignora tudo isso. Migration: `docs/migrations/20260805-workout-techniques.sql` |
| `technique_group` | text | — | — | **(2026-08-05)** Chave que liga os exercícios de um mesmo bloco de bi-set/tri-set — mesmo valor = mesmo bloco, executados sem descanso entre eles. `NULL` para técnicas individuais e séries diretas. `updateRoutineTechniquesDb` **normaliza**: grupo com menos de 2 membros volta a `straight` (um bi-set órfão não é bi-set). Índice parcial `user_workouts_technique_group_idx` |
| `order_index` | int | — | — | **(2026-08-05)** Ordem do exercício dentro da rotina (0-based). Existe porque um bloco só funciona com os membros **adjacentes e na ordem** (A1 → A2); `planToAssignments` puxa os membros de cada bloco para junto do primeiro. `NULL` = ordem legada por `created_at`, então rotinas antigas não se reorganizam sozinhas. **Desde 21/08/2026 também é escrita pela tela de treino** (`updateRoutineOrderDb`), quando o usuário reordena os exercícios arrastando — ver `docs/05-metas.md` → "Reordenar exercícios" |

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
| `calories` | numeric | — | — | **(escrita desde 21/08/2026)** Calorias gastas na **SESSÃO** inteira (kcal) — estimadas pelo app e ajustáveis pela pessoa na tela de treino (ver `docs/05-metas.md` → "Calorias gastas"). Como o histórico grava **uma linha por série**, o valor é preenchido na **primeira linha de cada finalização** e fica `NULL` nas demais: **toda leitura por sessão é `MAX(calories)`, nunca `SUM`** (somar multiplicaria o total pelo nº de séries). A coluna já existia e nunca era escrita — **sem migração**. `NULL` = treino anterior à feature ou sem base para estimar. |
| `date_completed` | timestamp | — | `now()` | Data de realização |
| `created_at` | timestamp | — | `now()` | Data de criação do registro |
| `km` | float8 | — | - | quilometros percorridos |
| `time` | varchar | — | - | tempo decorrido |
| `routine_id` | bigint | FK → `routines.id` | — | Rotina à qual o treino concluído pertence. Populada ao finalizar o treino a partir de `user_workouts.routine_id`. Usada para gatear a exibição do ícone de resumo da rotina (só aparece se houver ao menos um registro com `routine_id` correspondente). |
| `set_kind` | text | — | — | **(2026-08-05)** Tipo da série executada, gravado só por rotinas no modo **expert** (`routines.training_mode`): `'warmup'` = aquecimento, `'normal'` = série válida, `'failure'` = série levada à falha, `'drop'` = queda de carga emendada na série anterior (**adicionado em `20260805-workout-techniques.sql`**, que recria o CHECK). `CHECK (set_kind IS NULL OR set_kind IN ('warmup','normal','failure','drop'))`. **`drop` conta como TRABALHO** (volume e PR incluem — é peso levantado de verdade) mas **não conta como SÉRIE** (`countsAsSeries` no `workout-session-dialog.tsx`): quem faz 3×10 com drop na última fez 3 séries, não 4. **`NULL` = série do modo simplificado ou anterior a 05/08/2026 → lida como `'normal'`.** O aquecimento **é gravado** (o registro do treino é fiel ao que foi feito) e **desde 12/08/2026 conta no volume e no contador de séries da sessão** (`countsAsSeries` só exclui o `drop`); o que ele não faz é virar marca — segue filtrado fora de toda leitura de carga/progressão: `getPreviousBestKgDb`, `getExerciseProgressionDb` e `getLastWorkoutSessionSeriesDb` aplicam `WORKING_SETS_FILTER` (`set_kind.is.null,set_kind.neq.warmup` — um `.neq` puro descartaria as linhas NULL, porque `NULL <> 'warmup'` é NULL e não TRUE no Postgres). Índice parcial `user_workouts_hist_working_sets_idx` cobre exatamente essas consultas. Migration: `docs/migrations/20260805-training-mode.sql`. |

**Remover exercício não apaga histórico.** Tirar um exercício da rotina durante o
treino (`removeRoutineItemsKeepHistoryDb`) apaga só a linha de `user_workouts`;
as linhas de `user_workouts_hist` ficam com `user_workout_id` **NULL** (FK
`ON DELETE SET NULL`) e **mantêm `routine_id`** — continuam contando para PR,
coluna ANTERIOR e progressão, que leem por `workout_id`. Não confundir com
`deleteRoutineItemDb`, que apaga o histórico primeiro de propósito. Ver
`docs/05-metas.md` → "A rotina é o que foi executado".

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

| `group_id` | text | — | — | **(2026-08-12)** FK → `workout_groups.id`. Movimento a que esta linha pertence — "Supino Inclinado com Halteres" é uma variação de `supino_inclinado`. `NULL` = exercício sem irmãos (~95 das 273 linhas de catálogo, e é o normal). Definido por **curadoria**, não derivado do nome: "Rosca Martelo" começa igual a "Rosca Direta" e é outro exercício. Índice parcial `workouts_group_idx`. Migration: `docs/migrations/20260812-workout-groups.sql` |

**Anatomia:** o recrutamento muscular fino de cada exercício vive em [workout_muscles](#workout_muscles) → [muscles](#muscles). `muscle_group` **não foi substituída** — continua sendo o rótulo grosso do card, do filtro e do fallback de imagem.

**RLS:** leitura pública; escrita só nas linhas do próprio usuário (`created_by_user = true and created_by = auth.uid()`). Os seeds de catálogo (`scripts/seed-exercises.mjs`, `scripts/migrate-exercise-images.mjs`) usam service role e passam por cima da RLS. `bulkUpsertCatalogWorkoutsDb` (em `ritmofit-db.ts`, sem callers) escreveria catálogo pelo cliente e **seria bloqueado** pela RLS se voltasse a ser usado.

---

## workout_groups

**(2026-08-12)** Movimento que agrupa variações do mesmo exercício — "Supino" para os 13 supinos do catálogo. Migration: `docs/migrations/20260812-workout-groups.sql`.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | text | PK | — | Slug estável (`supino`, `remada`, `agachamento_bulgaro`) — é o que `workouts.group_id` referencia |
| `name` | text | ✓ | — | Nome do movimento em PT ("Supino inclinado") |
| `name_eng` | text | — | — | Nome em EN; localizado no cliente por `pickLocalized`, como os outros catálogos |
| `muscle_group` | text | ✓ | — | Casa com `workouts.muscle_group` |
| `default_workout_id` | uuid | — | — | FK → `workouts.id` `ON DELETE SET NULL`. Variação que a rotina recebe quando o usuário escolhe o GRUPO no picker. Regra da curadoria: a mais comum numa academia (barra livre antes de máquina exótica) |

**Por que existe:** a variação sempre viveu só dentro do NOME do exercício. `equipment` estava preenchida em **17 de 273** linhas, e mesmo cheia não bastaria — em 168 linhas o que muda não é o aparelho, é o ângulo ou a pegada (*inclinado*, *pegada fechada*, *hex press*).

**Critério do agrupamento:** mesmo padrão de movimento + mesmo músculo alvo. Ficam **separados** os casos em que a variação muda o estímulo — supino reto ≠ inclinado ≠ declinado, rosca direta ≠ martelo, agachamento livre ≠ búlgaro, terra convencional ≠ romeno ≠ sumô. Exercício sem irmão não vira grupo de um: a migração desfaz qualquer grupo que termine com menos de 2 variações.

**O que NÃO mudou:** `user_workouts_hist.workout_id` continua gravando a **variação executada**, então PR, gráfico de progressão e coluna ANTERIOR seguem por variação — 80kg na barra não é 80kg em cada halter. `workout_muscles` e a cobertura muscular também continuam por `workout_id`.

**Como a rotina usa:** `user_workouts.workout_id` continua NOT NULL e passa a significar **a variação escolhida por último**. A sessão exibe o nome do grupo, abre na última variação e grava a troca de volta com `updateUserWorkoutExerciseDb`.

**RLS:** leitura pública, sem policy de escrita — só service role popula (mesma postura de `workouts` e `muscles`).

---

---

## workout_parties

**(2026-08-26)** Uma sessão de **treinar junto**: alguém convidou N pessoas para
fazer o mesmo treino agora. Migration: `docs/migrations/20260826-workout-party.sql`.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador da party. Vai em `notifications.post_id` no tipo 19 (mesma convenção dos tipos de duelo) |
| `host_id` | uuid | FK → `auth.users` ON DELETE CASCADE | — | Quem convidou |
| `routine_id` | bigint | FK → `routines.id` ON DELETE SET NULL | — | Rotina de origem (a do host). `NULL` quando ele treina sem rotina salva. `SET NULL` porque apagar a rotina não pode derrubar um treino em curso |
| `routine_name` | text | — | — | Nome exibido no convite e sugerido ao convidado que decidir salvar |
| `snapshot` | jsonb | ✓ | — | Cópia **congelada** do treino no momento do convite — formato `WorkoutPartySnapshot` (`ritmofit-db.ts`): `{ routineName, trainingMode, items: [{ workoutId, name, muscleGroup, photo, series, reps, restSecs, technique, techniqueGroup }] }`. Congelado de propósito: o host pode trocar variação ou adicionar exercício depois sem mudar a tela de quem já aceitou no meio de uma série. É também a **única cópia** que o convidado tem do treino antes de decidir salvá-lo |
| `created_at` | timestamptz | ✓ | `now()` | — |
| `expires_at` | timestamptz | ✓ | `now() + 60 min` | Treino é um evento do AGORA: uma hora depois, aceitar não faz mais sentido |
| `ended_at` | timestamptz | — | — | Preenchida quando o **host finaliza** (`endWorkoutPartyDb`). Convites pendentes deixam de valer na hora |

**RLS:** SELECT para membros (via `is_workout_party_member`, `SECURITY DEFINER`
— sem ele a policy de `workout_party_members` consultaria a própria tabela e o
Postgres entraria em recursão de policy); INSERT/UPDATE/DELETE só do host.

---

## workout_party_members

**(2026-08-26)** Participantes de uma party — **1:N, sem limite**: treinar em
grupo de quatro é tão comum quanto em dupla.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `party_id` | uuid | PK (composta), FK → `workout_parties` ON DELETE CASCADE | — | — |
| `user_id` | uuid | PK (composta), FK → `auth.users` ON DELETE CASCADE | — | — |
| `role` | text | ✓ | `'guest'` | `CHECK (role IN ('host','guest'))`. O host entra já `accepted` — ele é quem está treinando, não há o que responder |
| `status` | text | ✓ | `'pending'` | `CHECK (status IN ('pending','accepted','declined','left'))`. `left` = finalizou o treino, desistiu ou saiu |
| `progress_done` | integer | ✓ | `0` | Exercícios concluídos — o "Ana 3/6" da faixa da sessão. Atualizado **por exercício**, nunca por série (seriam dezenas de writes por treino para um número que nem muda na tela) |
| `progress_total` | integer | ✓ | `0` | Total de exercícios da sessão daquela pessoa |
| `responded_at` | timestamptz | — | — | Quando aceitou/recusou |
| `updated_at` | timestamptz | ✓ | `now()` | Ordena a busca do convite pendente mais recente |

**RLS:** SELECT para qualquer membro da party (é o que alimenta os avatares da
faixa); **INSERT só do host** — é o que impede alguém de se auto-adicionar numa
party alheia para ler o treino dos outros; UPDATE só da própria linha (responder
ao convite e reportar progresso).

**Realtime:** publicada em `supabase_realtime` — a faixa da sessão mostra quem
aceitou e em que exercício cada um está sem ninguém recarregar nada.

**O convidado não ganha rotina.** Aceitar não cria linha em
`routines`/`user_workouts`: a sessão dele é efêmera e o histórico grava com
`user_workout_id` e `routine_id` **nulos** (mesmo caminho dos exercícios
avulsos). Só se ele responder "salvar" à pergunta do resumo é que
`saveRoutineFromWorkoutPartyDb` cria a rotina. Ver `docs/05-metas.md`.


## muscles

**(2026-08-05)** Catálogo canônico de músculos e suas **porções/cabeças** — a camada anatômica fina que `workouts.muscle_group` (um texto grosso, ~10 valores) nunca conseguiu expressar. Migration: `docs/migrations/20260805-muscle-anatomy.sql` (~40 linhas semeadas na própria migração).

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | text | PK | — | Slug estável e legível (`peitoral_clavicular`, `triceps_cabeca_longa`). É o que o app e o script de seed referenciam — UUID aqui só criaria indireção |
| `group_name` | text | ✓ | — | **Casa com os valores de `workouts.muscle_group`** (`Peito`, `Costas`, `Tríceps`…), para a navegação por grupo continuar valendo sem tradução |
| `name` | text | ✓ | — | Nome da porção em PT (`Peitoral superior (clavicular)`) |
| `name_eng` | text | — | — | Nome em EN. Localizado no cliente por `pickLocalized`, como os outros catálogos |
| `region` | text | — | — | Posição dentro do grupo: `superior` \| `medio` \| `inferior` \| `lateral` \| `anterior` \| `posterior`. `NULL` = grupo que não se divide (ex.: sóleo). É o que vira "Peito → Superior/Meio/Inferior" |
| `body_part` | text | ✓ | — | Região do mapa corporal que este músculo acende (`chest`, `lats`, `triceps`…). Vários músculos compartilham uma região — o `MuscleMap` pinta com a MAIOR ênfase entre eles |
| `view` | text | ✓ | — | `front` \| `back` — em qual vista do mapa a região aparece |
| `sort_order` | int | ✓ | `0` | Ordem de exibição dentro do grupo (superior → inferior) |

**RLS:** leitura pública, **sem policy de escrita** — só service role popula (mesma postura de `workouts`).

---

## workout_muscles

**(2026-08-05)** Quais músculos cada exercício recruta, com papel e intensidade. É a tabela que responde a consulta que motivou a fase: *"quais exercícios mais pegam a porção superior do peito?"*.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `workout_id` | uuid | PK (composta) | — | FK → `workouts.id` ON DELETE CASCADE |
| `muscle_id` | text | PK (composta) | — | FK → `muscles.id` ON DELETE CASCADE |
| `role` | text | ✓ | — | `primary` = alvo do exercício · `secondary` = ajuda de forma relevante · `stabilizer` = trabalha isometricamente (aparece na ficha, não conta volume) |
| `emphasis` | int | ✓ | `50` | Intensidade 0–100 do estímulo neste músculo. **NÃO é repartição percentual** — as linhas de um exercício não somam 100. Ordena o picker por porção e pinta o mapa corporal |

Índice `workout_muscles_by_muscle_idx (muscle_id, emphasis DESC)` — é ele que torna a consulta inversa barata.

**Por que tabela de ligação e não JSON em `workouts`:** a consulta que importa é a inversa (músculo → exercícios ordenados por ênfase). Com JSON seria preciso baixar o catálogo inteiro e filtrar no cliente.

**RLS:** leitura pública. Escrita liberada **só nas linhas de exercícios que o próprio usuário criou** (`workouts.created_by_user = true AND created_by = auth.uid()`) — assim o formulário de exercício personalizado pode declarar anatomia sem ninguém reescrever o catálogo central pela anon key. O catálogo é populado por `scripts/seed-workout-muscles.mjs` (service role).

**Seed em duas camadas** (`scripts/seed-workout-muscles.mjs`): (1) `CURATED` — mapa escrito à mão casado pelo nome normalizado, cobrindo os exercícios de academia mais usados; (2) `GROUP_FALLBACK` — todo exercício não curado recebe as linhas genéricas do seu `muscle_group`, com ênfases mais baixas de propósito (é palpite pelo grupo, não análise do movimento). Assim nenhum exercício fica sem anatomia. Alongamento/mobilidade são **pulados** — alongar não é recrutar, e marcá-los poluiria o volume por músculo. Reexecutável: apaga as ligações que saíram do mapa e faz upsert do resto, então corrigir a curadoria e rodar de novo é o fluxo normal.

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

### Bucket `posts` — remoção de mídia (migração `20260814-storage-delete-policies.sql`)

Público para leitura. A policy **`posts_delete_own_media`** (só `DELETE`, só bucket `posts`) deixa o usuário apagar a própria mídia quando o conteúdo é excluído.

> ⚠️ **Sem policy de DELETE, `storage.remove()` responde 200 com lista vazia** — nenhum erro, nenhum arquivo apagado. É o mesmo no-op silencioso de RLS do histórico de rotina (`20260716-hist-delete-rls`) e do painel de moderação (`20260811-admin-moderation`). Por isso `removeStorageObjects` compara o número de caminhos pedidos com o de removidos e avisa no console quando não bate.

O bucket acumulou vários formatos de caminho, e a posse é resolvida por quatro critérios em `OR`:

| Caminho | Conteúdo | Como a posse é provada |
|---|---|---|
| `{uid}/{ts}-{i}.jpg` | Foto de post | 1º segmento = `auth.uid()` |
| `{uid}/profile-{ts}.jpg` | Avatar | idem |
| `{uid}/shots/{ts}.mp4` | Vídeo de shot | idem |
| `{uid}/stories/{ts}-story.*` | Mídia de flow (+ `-poster.jpg`) | idem |
| `checkins/{uid}/…` | Foto de check-in de duelo | 2º segmento = `auth.uid()` |
| `workout-summary/{uid}/…` | Card de resumo de treino | idem |
| `exercise-photos/{uid}/…` | Foto de exercício custom | idem |
| `covers/{uid}-{ts}.jpg` | Capa de perfil | uid no **nome do arquivo** |
| `group-covers/{groupId}/…` | Capa de duelo | **fora da policy** — o caminho traz o id do grupo, não do usuário |

Há ainda o critério `owner = auth.uid()`, preenchido pelo próprio Storage no upload, que cobre qualquer formato novo sem precisar editar a policy.

**Quem limpa o quê (em `ritmofit-db.ts`):**

| Função | Momento | Mídia tratada |
|---|---|---|
| `deletePostDb` | exclusão | `photo` + `photos` (carrossel; o card de resumo entra como último slide) |
| `deleteShotDb` | exclusão | `video_url` |
| `deleteStoryDb` | exclusão | `media_url` + `poster_url`, filtrados por `filterUnreferencedUrls` |
| `deleteGroupCheckInDb` | exclusão | `photo` + `photos` |
| `deleteCustomWorkoutDb` | exclusão | `photo`, filtrada por `filterUnreferencedUrls` (imagem por nome é compartilhada) |
| `adminDeleteContentDb` | moderação | o que a RPC `admin_delete_content` devolve em `media`; em `flow`, filtrado |
| `updateUserProfileDb` | **troca** | avatar e capa anteriores (`removeReplacedMedia`) |
| `updateGroupPhotoDb` | **troca** | capa de grupo anterior |
| `updateCustomWorkoutDb` | **troca** | foto anterior do exercício, filtrada |
| `deleteAllUserDataDb` | exclusão de conta | varre as pastas do usuário nos buckets `posts` e `chat-media` (`purgeUserStorageDb`) |

> **Troca também vazava.** Cada upload grava um caminho novo (`profile-{ts}.jpg`, `covers/{uid}-{ts}.jpg`) para o CDN não servir a versão velha na mesma URL — então, sem `removeReplacedMedia`, toda edição de foto de perfil deixava um arquivo para trás. Apagar o antigo é seguro porque nenhuma tabela guarda cópia histórica de avatar: `duel_check_ins.user_photo` existe mas é coluna morta (nunca lida nem escrita — `getGroupCheckInsDb` re-busca `profiles.photo` de propósito).

> ⚠️ **`purgeUserStorageDb` roda ANTES do Batch 6** de `deleteAllUserDataDb`. A policy de DELETE depende de `auth.uid()`: depois que a conta sai de `auth.users` não há sessão para provar posse, e a mídia ficaria órfã para sempre.

> ⚠️ **Repost de flow compartilha o arquivo.** `repostStoryDb` reaproveita `media_url`/`poster_url` do original em vez de copiar. Apagar o storage ao excluir um dos dois quebraria o outro — por isso `deleteStoryDb` passa por `filterUnreferencedUrls`, que só libera a URL quando nenhuma linha de `flow` a referencia mais. Qualquer conteúdo novo que reaproveite mídia precisa do mesmo cuidado.

> `deletePromotionDb` é **soft delete** (`is_active = false`): a linha continua existindo, então a imagem **não** deve ser apagada.

#### Acervo já órfão — `scripts/sweep-orphan-media.mjs`

As correções acima só valem daqui pra frente. Para o que ficou para trás existe uma varredura que cruza o bucket com todas as colunas de mídia do banco:

```bash
node scripts/sweep-orphan-media.mjs                  # dry-run (padrão, não apaga)
node scripts/sweep-orphan-media.mjs --report=out.txt # salva a lista completa
node scripts/sweep-orphan-media.mjs --only=checkins  # limita a uma pasta
node scripts/sweep-orphan-media.mjs --apply          # apaga
```

Medição de 2026-08-14: **504 objetos no bucket, 270 órfãos, 1,19 GB** — a maior parte em pastas `{uid}/` de mídia de post/shot/flow excluídos antes da correção, mais 18 arquivos (43,5 MB) em `custom-workouts/`, um caminho legado que nenhuma coluna referencia mais.

Três travas de segurança, todas por causa de armadilhas reais:

1. **`MEDIA_SOURCES` precisa ficar completa.** Coluna esquecida vira "ninguém referencia" e o arquivo é apagado. Ao criar feature que sobe arquivo, acrescente a coluna na mesma entrega.
2. **`messages.text` é varrido com regex, não lido como coluna de URL.** Mídia de DM antiga guarda a URL pública completa **dentro do texto**, atrás do prefixo `[image]:`/`[audio]:` (ver protocolo em `docs/07-comunidade.md`). O primeiro dry-run marcou 16 arquivos de DM em uso como órfãos justamente por isso.
3. **Arquivo com menos de 24 h é ignorado.** O app sobe o arquivo antes de gravar a linha; uma varredura no meio dessa janela veria um órfão que não é.

Se uma tabela da lista não existir neste banco, ela é pulada com aviso; qualquer **outra** falha de leitura **aborta** a varredura, em vez de tratar o conteúdo dela como órfão.

#### O inverso — `scripts/fix-broken-media-messages.mjs`

A varredura acima acha **arquivo sem linha**. Este acha **linha sem arquivo**: mensagens de conversa privada cujo áudio/imagem sumiu do Storage.

```bash
node scripts/fix-broken-media-messages.mjs           # dry-run
node scripts/fix-broken-media-messages.mjs --apply   # apaga as linhas
```

Entende os dois formatos do ponteiro (ver protocolo em `docs/07-comunidade.md`): `[audio]:chat:{idA}_{idB}/{uuid}.webm` (bucket privado `chat-media`) e `[audio]:https://…/public/posts/…` (legado, anterior à `20260713`). `[post]:`/`[shot]:` carregam ID e são ignorados; ponteiro em formato desconhecido também é ignorado — nunca se apaga o que não se entendeu.

**Apagar é a única correção possível:** o texto da mensagem é só o ponteiro, então sem o arquivo não há conteúdo a restaurar — fica um player que nunca toca.

Execução de 2026-08-14: **9 mensagens** removidas, todas áudios de abril em `posts/message-audio/`. Verificado antes de apagar que os arquivos não haviam migrado para `chat-media` (que tinha só 13 objetos, todos imagem). Essas referências já estavam quebradas antes da varredura de órfãos: a aritmética fecha (491 − 257 órfãos = 234 objetos), e o único `message-audio` na lista de órfãos era um arquivo de **0 B**, upload que falhou.

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
