# 14 — Database Schema (Supabase / PostgreSQL)

Documentação técnica de todas as tabelas do banco de dados público (`public`) do projeto RitmoFit.

---

## Índice de Tabelas

| Tabela | Descrição resumida |
|---|---|
| [access_sessions](#access_sessions) | Sessões de acesso dos usuários |
| [check_ins](#check_ins) | Check-ins diários de treino |
| [comments](#comments) | Comentários em posts |
| [commercial_profiles](#commercial_profiles) | Perfis comerciais / lojas |
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
| [profiles](#profiles) | Perfil público dos usuários |
| [ranking](#ranking) | Pontuação e nível dos usuários |
| [routines](#routines) | Rotinas de treino dos usuários |
| [shots](#shots) | Vídeos Shots |
| [shots_comments](#shots_comments) | Comentários em Shots |
| [shots_complaint](#shots_complaint) | Denúncias de Shots |
| [shots_likes](#shots_likes) | Curtidas em Shots |
| [store_catalog](#store_catalog) | Catálogo de produtos de lojas |
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

## commercial_profiles

Perfil comercial de usuários que atuam como loja ou negócio.

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
| `id_user` | uuid | ✓ | — | Remetente da mensagem |
| `text` | text | ✓ | — | Conteúdo da mensagem |
| `read` | smallint | — | `0` | Lida (1) ou não (0) |
| `created_at` | timestamptz | ✓ | `now()` | Data de envio |
| `updated_at` | timestamp | — | `now()` | Data de atualização |
| `id_following` | uuid | — | — | Destinatário da mensagem |
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
| `post_id` | uuid | — | — | Post relacionado (se aplicável) |
| `read` | boolean | — | `false` | Notificação lida ou não |

> **Tipos de notificação comuns:** follow, like, comment, duel invite, etc. (verificar constantes no código).

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

Catálogo de produtos de lojas parceiras.

| Coluna | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | uuid | PK | `gen_random_uuid()` | Identificador único |
| `store_id` | uuid | ✓ | — | ID da loja |
| `store_name` | varchar | ✓ | — | Nome da loja |
| `store_instagram_handle` | varchar | ✓ | — | Handle do Instagram |
| `store_instagram_profile_url` | text | ✓ | — | URL do perfil Instagram |
| `store_logo_url` | text | — | — | URL do logotipo |
| `store_bio` | text | — | — | Bio da loja |
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
