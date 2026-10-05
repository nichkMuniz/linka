# 18 — Painel Admin (`/admin`)

Tela interna de moderação, métricas e gestão de usuários. **Não é traduzida** (`i18n`): é ferramenta interna, todos os textos estão em PT direto no JSX — de propósito, para não inflar `i18n.ts` com strings que nenhum usuário final vê.

**Arquivo:** `client/pages/Admin.tsx` · **Rota:** `/admin` (lazy) · **Skeleton:** `AdminSkeleton` em `animated-loading.tsx`

## Acesso

| Camada | Onde | O que faz |
|---|---|---|
| Guarda de rota | `useIsAdmin(userId)` em `client/lib/admin.ts` (usado pelo `RequireAdmin`) | Admin = `ADMIN_USER_IDS` **ou** selo oficial (`verified_tier = 'official'`). Redireciona para `/` quem não é. **Não autoriza nada** |
| Guarda de UI | `useIsAdmin`, mesmo arquivo | Botão "Admin" do perfil (só selo oficial) e indicadores de curadoria embutidos em telas normais (ver "Anatomia dos exercícios") |
| Autorização real | `is_app_admin(auth.uid())` = tabela `app_admins` **ou** selo oficial | Checada dentro das RPCs `SECURITY DEFINER` que leem/escrevem dados de terceiros |

> **Selo oficial = admin (2026-09-30, migração `20260930-official-is-admin.sql`).** Regra de produto: toda conta com o selo **oficial** (roseta dourada) tem o painel liberado. O selo **verificado** (azul, `notable`) **não** tem. Antes o botão "Admin" já aparecia para o oficial, mas a rota só aceitava a lista fixa: a pessoa caía no feed, e as RPCs devolviam `NOT_ADMIN`.
> - **Promover a admin:** dar o selo oficial pelo painel ("Contas Verificadas" → Oficial). `app_admins` e `ADMIN_USER_IDS` continuam valendo para os donos.
> - **Segurança:** ninguém se autopromove. `verified_tier` só muda por admin ou service_role, porque o trigger `freeze_verified_tier` desfaz o UPDATE da própria pessoa.
> - **Enquanto a migração não rodar:** o oficial abre o painel, mas as ações do servidor (banir, premium, selo, moderação) seguem recusando.

## Estrutura em abas (2026-10-01)

Antes eram 14 seções numa rolagem só, e a fila de denúncias (a única coisa que pede ação) ficava no meio. Agora o cabeçalho (voltar, "Atualizado às HH:MM", Atualizar) e a **barra de abas** ficam **fixos no topo** (`sticky`, com safe area), e cada área vive numa aba:

| Aba | Conteúdo (na ordem) | Selo na aba |
|---|---|---|
| **Indicadores** (padrão) | Card **"Precisa de atenção"** (só aparece com denúncias abertas, exercícios sem anatomia ou sem imagem; cada linha leva à aba) · **Hoje** (ativos com "±N vs ontem · N novos", cadastros, sessões, tempo de uso + gráfico DAU 7 dias) · **Conteúdo de hoje** · **Base de usuários** (total, semana, mês, banidos + gráfico de cadastros) · **Engajamento e retenção** (WAU, MAU, stickiness, duração média, D1, D7) · **Totais gerais** · **Telas mais acessadas** | — |
| **Atividade** | Mais ativos hoje · **Quem entrou hoje** (cards expansíveis) · Mais seguidos (linha abre o perfil) | — |
| **Denúncias** | Fila de moderação | vermelho = nº na fila |
| **Banidos** (2026-10-01) | Lista de quem está banido (avatar, @, "banido em") com botão **Desbanir** + confirmação. Tocar na pessoa abre o perfil | neutro = nº de banidos |
| **Selos** | Card "Dar selo" (nível + @handle) · lista de contas verificadas | neutro = nº de contas |
| **Cortesia** | Card "Conceder acesso" (duração + busca) · contas com acesso | neutro = nº ativos |
| **Anatomia** | Cobertura + fila de exercícios sem músculos mapeados | vermelho = nº pendentes |
| **Imagens** (2026-10-02) | Cobertura + fila de exercícios do catálogo sem `photo`, com prompt de IA e comando de upload por linha | vermelho = nº pendentes (sem os custom) |
| **Exercícios** (2026-10-05) | Exercícios criados pelos usuários, agrupados por nome, para tornar oficial, vincular ou ignorar | neutro = nº de grupos pendentes |

- **Aba na URL** (`/admin?aba=denuncias`, com `replace`): "Ver post"/"Ver perfil" saem do painel; ao voltar, a pessoa continua na mesma aba. Indicadores = sem parâmetro. Trocar de aba volta a rolagem ao topo.
- **Barra rolável na horizontal** (6 abas não cabem em 375px), com o mesmo cuidado da barra do Perfil: `overflow-y-hidden` e linha de base como sombra interna. A aba ativa rola para dentro da área visível quando aberta por link ou pelo "Precisa de atenção".
- **Uma carga só:** as 9 consultas continuam em paralelo no `load()` — os selos das abas e o card de atenção precisam das contagens de denúncias/anatomia/imagens logo de cara.
- **Toque:** abas com 44px; botões de ação da fila de moderação com 40px; X de remover selo/cortesia com 36px e `aria-label`. Avatares via `ImageWithFallback` (`UserAvatar`, miniatura no aparelho).
- Componentes locais do arquivo: `AdminTabBar`, `AttentionRow`, `EmptyState`, `UserAvatar`, `SectionHeader` (`count` + `alert`).

## Fontes de dados

| Bloco | Fonte de dados |
|---|---|
| Hoje / Base de usuários / Engajamento e retenção / Conteúdo de hoje / Totais / Mais seguidos | `get_admin_analytics()` |
| Usuários mais ativos hoje (ranking) | `getAdminActiveUsersDb()` → `access_sessions` |
| **Quem entrou hoje (por usuário)** | `getAdminTodayActivityDb()` → RPC `get_admin_today_activity()` |
| Telas mais acessadas (7 dias) | `get_admin_analytics()` → `screen_time_logs` |
| Fila de moderação | `admin_complaints_view` + `adminDismissComplaintDb` / `adminDeleteContentDb` / `adminBanUserDb` → RPC `admin_set_banned()` |
| **Anatomia dos exercícios** | `getAdminAnatomyCoverageDb()` → `workouts` + `workout_muscles` (leitura direta, sem RPC) |
| **Exercícios sem imagem** | `getAdminImageCoverageDb()` → `workouts` + `workout_muscles` + `muscles` (leitura direta, sem RPC) |
| **Acesso cortesia** | `admin_list_premium()` / `admin_set_premium()` — ver `docs/17-premium.md` |
| **Exercícios criados pelos usuários** | `getAdminCustomWorkoutsDb()` → `user_custom_workouts` + `workouts` + `profiles` + `admin_custom_workout_reviews` (leitura direta) · `adminPromoteCustomWorkoutsDb` → RPC `admin_promote_custom_workouts` · `adminSetCustomWorkoutIgnoredDb` (escrita direta, tabela só de admin) |
| Selos (contas verificadas) | `getVerifiedAccountsDb()` / `setUserVerifiedTierDb()` — dois níveis (oficial/verificado), ver "Verificar conta" |

## Atividade de hoje (por usuário)

Responde "quem entrou hoje, em que telas ficou, por quanto tempo, e o que fez". Migração: `docs/migrations/20260729-admin-today-activity.sql`.

Cada usuário vira um card expansível (`TodayActivityCard`):

- **Fechado:** avatar, nome, selo `novo` (cadastrou-se hoje), nº de telas, nº de ações, horário do último acesso e o tempo total.
- **Aberto:** lista de **telas** com barra proporcional e tempo em cada uma (`screen_time_logs`), lista de **ações** com contagem e horário da última, rodapé com nº de sessões, 1º acesso e atalho "Ver perfil".

Ações rastreadas (contagem + horário da última, derivadas das tabelas de conteúdo): `post`, `shot`, `flow`, `comentario`, `comentario_shot`, `curtida`, `curtida_shot`, `check_in`, `check_in_duelo`, `mensagem`, `refeicao`, `treino`. Rótulo e ícone de cada uma no mapa `ACTION_META` de `Admin.tsx`.

**Limites conhecidos (por design, não são bugs):**

- **Ação não tem duração**, só contagem e horário — o app não tem tabela de eventos com início/fim; cronometrar um like não faria sentido. Duração existe só para **tela**.
- A telemetria (`access_sessions`, `screen_time_logs`) é gravada quando **o app vai para segundo plano** (`flush` no `AppLayout`). Quem está com o app aberto agora só aparece com o que já enviou — a tela avisa isso no rodapé da seção.
- Quem navegou mas ainda não fechou o app pode ter linha em `screen_time_logs` sem linha em `access_sessions`. A RPC usa a **união** das duas para não sumir com ninguém; quando falta a sessão, o card mostra o tempo somado por tela.
- **Desde 2026-09-27 o tempo na tela de registrar treino não entra** em `access_sessions` nem em `screen_time_logs` (ver `docs/13-layouts-e-componentes.md`). Dados anteriores incluem o tempo de treino — comparações de "tempo de uso" antes/depois dessa data não são equivalentes.
- Datas comparadas em **UTC** (`current_date`), igual ao resto do painel — os números batem entre as seções.

## Anatomia dos exercícios (17/08/2026)

Inventário da curadoria de `workout_muscles` — quais exercícios **não têm** a ficha de "músculos trabalhados" que aparece no ⓘ do card. Existe porque `ExerciseAnatomy` não renderiza nada quando falta anatomia (ver `docs/05-metas.md`): a lacuna era invisível, inclusive para quem cura o catálogo, e exercício novo entrava sem ninguém notar.

**Sem migração e sem RPC.** `getAdminAnatomyCoverageDb()` lê `workouts` e `workout_muscles` (as duas têm leitura pública) e faz o diff no cliente — o PostgREST não tem `NOT EXISTS`.

O que a seção mostra:

- **Barra de cobertura:** `mapeados / total` e o %.
- **Fila de trabalho:** exercícios sem anatomia que **não** são alongamento/mobilidade — os que realmente precisam de atenção. Badge `custom` = criado por um usuário (mapear é opcional).
- **Bloco colapsado** com os alongamentos/mobilidade: o seed pula esses de propósito, é **lacuna esperada**. Separar é o que mantém a lista acionável — hoje são ~26 alongamentos contra ~6 exercícios de verdade; juntos, afogariam o sinal.
- **Botão de copiar** por linha: devolve o `INSERT` pronto (`anatomySqlSnippet`, em `client/lib/admin.ts`), com o `workout_id` já preenchido e `SLUG_DO_MUSCULO` para trocar. Os slugs saem de `select id, name from muscles` — são legíveis (`peitoral_clavicular`, `biceps_braquial`), não uuid.

**Decisões:**

- **Sem cache.** É tela de gestão; servir dado de 12h esconderia exatamente o exercício que o admin acabou de mapear.
- **Leitura paginada** (`fetchAllRows`, em `ritmofit-db.ts`): o PostgREST corta em 1000 linhas e `workout_muscles` já passa de 800 — sem paginar, a lista começaria a apontar lacuna falsa conforme a curadoria avança.
- **Preencher continua sendo SQL.** Não há editor de anatomia no painel: escrita em `workout_muscles` pela anon key cairia na RLS **em silêncio** (a regra do topo da seção de moderação), então um editor exigiria RPC `SECURITY DEFINER` + migração. O indicador entrega a fila e o snippet; o INSERT roda no SQL Editor.
- **O mesmo aviso aparece no app**, dentro do detalhe do exercício, só para quem está em `ADMIN_USER_IDS` — a lacuna é vista onde ela incomoda, sem precisar abrir o painel.

## Exercícios sem imagem (02/10/2026)

Inventário de `workouts.photo` vazio — exercício nessa situação aparece com o placeholder em todo card do app. Mesmo esquema da aba Anatomia: só as pendências, uma linha por exercício.

**Sem migração e sem RPC.** `getAdminImageCoverageDb()` lê `workouts` (paginado via `fetchAllRows`) e, só para os que faltam, `workout_muscles` + `muscles` para preencher o prompt.

- **"Sem imagem" = `photo` vazio.** Na data da criação todas as 271 URLs preenchidas respondiam 200; checar cada URL (HEAD) a cada abertura do painel não compensa.
- **Fila:** exercícios do catálogo. Os `custom` (criados por usuário, `created_by_user`) aparecem abaixo como opcionais e não entram no selo.
- **Botão Copiar (prompt):** `exerciseImagePrompt` em `client/lib/admin.ts` — o template do `exercise-image-prompts.md` (render anatômico, figura cinza, músculos em vermelho, fundo branco, 1:1) com o movimento (`name_eng` + nome PT + 1ª frase da descrição) e os músculos já preenchidos. Músculos vêm da anatomia mapeada (primários → secundários, sem estabilizadores); sem anatomia, cai num mapa por `muscle_group`. Alongamento/mobilidade usa "single held position, side view".
- **Botão Upload (comando):** `node scripts/upload-exercise-image.mjs <workout_id> ai-exercise-images/<slug>.png`. O script confere se o exercício existe, aceita png/jpg/jpeg/webp (tenta as outras extensões se o caminho exato não existir), achata em fundo branco, redimensiona 1024×1024 JPEG, sobe em `exercises/manual/<workout_id>.jpg` (upsert, cache 7 dias) e grava `workouts.photo`. Precisa de `SUPABASE_SERVICE_ROLE_KEY` no `.env` — roda no PC, nunca no app.
- **Fluxo:** copiar prompt → gerar a imagem → salvar em `ai-exercise-images/<slug>.png` → copiar e rodar o comando → **Atualizar** no painel.

## Exercícios criados pelos usuários (05/10/2026)

Decide quais exercícios personalizados (`user_custom_workouts`) **faltavam no catálogo** e quais são **específicos** de quem criou. Componente `CustomExercisesPanel` (`client/components/admin/custom-exercises-panel.tsx`). Migração: `docs/migrations/20261005-admin-custom-workouts.sql`.

- **Agrupamento por nome normalizado** (`normalizeExerciseName`: sem acento, minúsculas, pontuação vira espaço). "Supino inclinado na máquina" de 3 pessoas = 1 card com **"3 usuários"**. Ordem: mais usuários primeiro — mais gente criando o mesmo exercício é o sinal mais forte de que ele faltou. O título é a grafia mais usada; "Ver as N criações" mostra quem criou, a grafia de cada um, o grupo e a descrição.
- **"Parecido no catálogo"** (âmbar): até 3 exercícios do catálogo com nome parecido (PT ou EN) — Jaccard das palavras sem preposições, mínimo 0,75 quando todas as palavras do personalizado estão no nome do catálogo ("supino reto" ⊂ "Supino Reto com Barra"). Ajuda a decidir entre "Tornar oficial" e "Já existe".
- **Tornar oficial:** diálogo com nome PT (pré-preenchido em "Title Case"), nome EN, grupo muscular (grupos do catálogo), como executar PT/EN (pré-preenchido com a maior descrição escrita). Cria a linha em `workouts` (`created_by_user = false`, `type`/`equipment` herdados). A **foto dos usuários não é copiada** — o exercício cai na fila de **Imagens** (render no padrão do catálogo) e de **Anatomia**; o toast lembra disso.
- **Já existe:** escolhe o exercício do catálogo (sugestões ou busca) e liga o grupo a ele.
- **Trocar as cópias pela oficial** (caixa marcada por padrão, nos dois casos): a RPC troca o `workout_id` das cópias pelo do catálogo em `user_workouts`, `user_workouts_hist` e `training_day_exercises` (rotinas, histórico, recordes e gráficos continuam, agora no exercício oficial) e apaga as cópias. Desmarcado, cada usuário mantém a sua e o exercício oficial aparece **além** dela.
- **Ignorar:** grava `ignored` em `admin_custom_workout_reviews` — o grupo sai da fila (filtro **Ignorados**, com "Voltar para a fila").
- **Resolvidos:** grupos já oficializados/vinculados que ainda têm cópias (caixa desmarcada, ou alguém criou o mesmo nome depois) — botão "Trocar estas cópias pela oficial".
- A decisão é por **nome normalizado**, então vale para quem criar o mesmo nome depois.

**Limites:** JSONs que guardam `workoutId` (resumo da última execução em `routines.last_summary`, snapshots de desafio e de treinar junto) **não** são reescritos — comparação de um desafio antigo com esse exercício pode não casar. O catálogo fica em cache nos aparelhos (`workouts:`), então o exercício novo aparece para os outros usuários quando esse cache expira.

## Fila de moderação — o que cada botão faz de verdade

> **A regra que explica os três bugs desta seção:** `DELETE`/`UPDATE` que não casa nenhuma linha **não é erro** no Postgres. Com a anon key do admin, a RLS derruba a escrita em linha de terceiro em silêncio, o `error` volta `null` e a tela comemora. Toda escrita do painel sobre conteúdo/usuário alheio passa por RPC `SECURITY DEFINER` que **devolve quantas linhas mudaram**.

### Remover post / shot / flow

`adminDeleteContentDb(tipo, id)` → RPC `admin_delete_content(p_tipo, p_id)`. Migração: `docs/migrations/20260811-admin-moderation.sql`.

> **Aviso ao autor (2026-10-01, migração `20261001-moderation-removal-notice.sql`):** a RPC virou `admin_delete_content(p_tipo, p_id, p_reason)` e grava uma notificação **type 22** para o autor na mesma transação (ver `docs/10-notificacoes.md`). No diálogo de confirmação de **Remover** e **Remover + banir** aparece a fileira **"Motivo — o autor recebe um aviso com ele"** (Conteúdo inadequado · Spam · Assédio ou bullying · Direitos autorais · Outro), já pré-selecionada a partir do texto da denúncia (`reasonFromComplaint`). O toast de sucesso diz se o autor foi avisado (`notified` no retorno da RPC). Banco sem a migração: o cliente recebe `PGRST202`, refaz a chamada com 2 argumentos e remove sem avisar. Banir sozinho não gera aviso — a `BannedScreen` já é o aviso.

> **Entrada de denúncia de flow (2026-08-17):** o caso especial de flow nesta RPC (linha abaixo) já existia antes de a fila ter como receber denúncias reais — não havia botão em nenhuma tela que gravasse em `flow_complaint`. O botão entrou no `FlowViewer`/`FlowViewerModal` (menu "Denunciar usuário"/"Denunciar flow", ver `docs/01-feed.md`), usando o mesmo `ReportDrawer` do Feed/Shots. Nada mudou nesta seção — o pipeline de moderação já estava pronto e só passou a ser alimentado.

> **"Ver flow" na denúncia caía no feed (corrigido em 17/08/2026):** `contentRoute` mandava sempre para `/` no caso `flow` — nunca chegou a apontar pro flow em si. Agora navega para `/flows/{conteudo_id}`. Como flows saem do ring ativo depois de 24h (comum entre a denúncia e a revisão), `FlowViewer` ganhou um fallback: se o id não está em `getActiveStoriesDb()`, busca via `getFlowByIdDb` (já existia, usado pelas notificações) e injeta o resultado nas stories carregadas antes de desistir e voltar pro feed.

Corrigido em 11/08/2026 — o `delete from posts where id = …` casava 0 linhas (a RLS só deixa o **autor** apagar), a denúncia saía da fila e o conteúdo continuava no ar.

- A RPC limpa as dependências antes (`notifications`, likes, comentários, tags, visualizações e a própria denúncia) via helper `admin_purge_refs`, que compara `coluna::text = id` — o schema tem divergência real de tipo entre PK e FK (`shots_likes.shots_id` é smallint; `flow_user_viewed.flow_id` está documentado como uuid com `flow.id` bigint).
- **Flow:** solta `reposted_from` dos reposts antes de apagar o original, senão o delete morre em violação de FK. O repost em si continua no ar — quem foi denunciado foi o original.
- **Storage:** o Postgres não fala com o Storage, então a RPC devolve as URLs de mídia e `removeStorageObjects` (em `ritmofit-db.ts`) apaga os arquivos depois, agrupando por bucket. Best-effort: mídia órfã é desperdício de cota, não pode desfazer uma remoção já feita.
- `deleted: false` agora só pode significar "a linha já não existia" — a tela arquiva a denúncia avisando ("Conteúdo já não existia"), em vez de travá-la na fila para sempre.

### Banir usuário

`adminBanUserDb(userId, banned = true)` → RPC `admin_set_banned()`. Migração: `docs/migrations/20260811-admin-ban-user.sql`.

Corrigido em 11/08/2026 — o botão estourava `invalid input syntax for type bigint: "<uuid>"` porque o `UPDATE` filtrava por `profiles.id` (bigint) com o uuid do usuário. A coluna certa é `profiles.user_id`, mas só trocá-la trocaria um erro visível por um no-op silencioso.

**Como o banimento é aplicado (3 camadas):**

| Camada | Onde | Efeito |
|---|---|---|
| `profiles.is_banned` | `admin_set_banned` | Alimenta o card de métricas; protegido pelo trigger `freeze_is_banned` (ninguém se desbane sozinho) |
| Policies **RESTRICTIVE** (2026-10-01) | `20261001-hide-banned-users.sql` | O banido **some para os outros**: perfil, busca, posts, flows, comentários, curtidas, listas de seguidores, DMs, marcações, notificações e duelos. Seguir, mandar DM, marcar e convidar um banido é barrado no INSERT. O **admin continua vendo** tudo (por isso o "Ver perfil" da aba Banidos funciona). Ver `docs/14-database-schema.md` |
| `auth.users.banned_until` + `delete from auth.sessions` | `admin_set_banned` | **A trava real**: o GoTrue recusa login e renovação de token |
| `BannedScreen` no `RequireAuth` | `client/App.tsx` | Fecha a janela em que o access token já emitido ainda vale (até 1h) |

- O retorno da RPC traz `session_revoked`. Se vier `false` (o dono da função sem grant em `auth`), o painel mostra toast **destrutivo** avisando que a conta foi marcada mas o acesso não caiu — nunca um "banido" que não bane.
- Banir a si mesmo é recusado (`CANNOT_BAN_SELF`) — trancaria o admin fora do painel.
- **Desbanir (2026-10-01):** aba **Banidos** → `adminBanUserDb(userId, false)`, que limpa o flag e o `banned_until`. A lista vem de `getAdminBannedUsersDb()` → RPC `admin_list_banned()` (flag em `profiles` **ou** `banned_until` no futuro — aparece também quem ficou com só uma das travas). Não há coluna de data do ban: como `admin_set_banned` grava `banned_until = now() + 100 anos`, a RPC devolve `banned_at = banned_until − 100 anos`; ban feito por fora do painel vem sem data. A lista tem erro próprio (`bannedError`): sem a migração, só a aba mostra o aviso, o resto do painel carrega.
- **Depois do ban**, a denúncia atual é arquivada **e** todas as denúncias de **perfil** contra a pessoa (`admin_resolve_user_complaints`). Denúncias de **conteúdo** dela continuam na fila — o conteúdo segue no ar até alguém remover.
- Se o ban passar e o arquivamento falhar, o toast diz "Usuário banido, mas a denúncia continua na fila" — nunca um "Erro" genérico que levaria o admin a banir de novo.

### Ignorar / arquivar denúncia

Corrigido em 2026-10-01 (migração `20261001-admin-dismiss-unban.sql`): `adminDismissComplaintDb` fazia `delete()` direto nas tabelas `*_complaint`, que **não têm policy de DELETE** — sob RLS, 0 linhas e nenhum erro. A denúncia saía da tela e **voltava no próximo carregamento** ("Ignorar" e "Banir" nunca arquivaram nada). Agora é a RPC `admin_dismiss_complaint(p_tipo, p_id)`. "Remover conteúdo" escapava por acaso: `admin_delete_content` já apaga a denúncia junto. A lista local filtra por **tipo + id** (cada tabela de denúncia tem sua própria sequência de id; só o `id` casava denúncias de tabelas diferentes).

### Verificar conta

`setUserVerifiedTierDb(userId, tier)` → RPC `admin_set_verified_tier()` (migração `20260928-verified-tiers.sql`). `tier` é `"official"`, `"notable"` ou `null` (remove).

**Dois níveis (2026-09-28):** acima da busca há um seletor com os dois selos: **Verificado** (azul, usuário importante, é o padrão) e **Oficial** (dourado, equipe LinKa). O botão "Verificar" aplica o nível escolhido. Na lista, cada conta mostra o selo do seu nível e um botão **"Tornar oficial" / "Tornar verificado"** para trocar de nível sem remover o selo; o `X` remove.

Corrigido em 11/08/2026 — batia em **duas** travas: `profiles_update_own` e o trigger `freeze_is_verified`, que revertia a coluna fora do service_role. A migração ensina o trigger a reconhecer `is_app_admin`, senão a RPC gravaria e o trigger desfaria na saída.

## Erros do painel no Sentry

Todo `catch` da tela chama `reportHandledError(err, "admin:*")` antes do toast — sem isso o erro morria no toast e não existia para nós (foi o caso do bug do ban). Tags: `admin:load`, `admin:moderation-action` (com `acao`/`tipo`/`complaint_id`), `admin:set-premium`, `admin:set-verified`.

> Só chega ao painel do Sentry se `VITE_SENTRY_DSN` estiver definida **no ambiente do build** (Appflow/Vercel). Sem a variável, `reportHandledError` cai em `console.error` — ver `client/lib/monitoring.ts`.

## Notas

> ✅ A seção "Contas Verificadas", quebrada desde `20260713-security-hardening`, voltou a funcionar em 11/08/2026 — ver "Verificar conta" acima.

> **Migrações a rodar no Supabase (nesta ordem):** `20260811-admin-ban-user.sql` e `20260811-admin-moderation.sql`. Sem elas os três botões falham com "function does not exist" — que é ruidoso, mas honesto, ao contrário do silêncio de antes.
