# 18 — Painel Admin (`/admin`)

Tela interna de moderação, métricas e gestão de usuários. **Não é traduzida** (`i18n`): é ferramenta interna, todos os textos estão em PT direto no JSX — de propósito, para não inflar `i18n.ts` com strings que nenhum usuário final vê.

**Arquivo:** `client/pages/Admin.tsx` · **Rota:** `/admin` (lazy) · **Skeleton:** `AdminSkeleton` em `animated-loading.tsx`

## Acesso

| Camada | Onde | O que faz |
|---|---|---|
| Guarda de rota | `ADMIN_USER_IDS` em `client/App.tsx` | Esconde a tela; redireciona para `/` quem não está na lista. **Não autoriza nada** |
| Autorização real | Tabela `app_admins` + `is_app_admin(auth.uid())` | Checada dentro das RPCs `SECURITY DEFINER` que leem/escrevem dados de terceiros |

> Promover alguém a admin = inserir nos **dois** lugares (ver `docs/migrations/20260729-admin-premium.sql`).

## Seções (na ordem da tela)

| Seção | Fonte de dados |
|---|---|
| Usuários (cadastros hoje/semana/mês, banidos, gráfico 7 dias) | `get_admin_analytics()` |
| Engajamento (DAU, WAU, MAU, stickiness, sessões, duração média) | `get_admin_analytics()` |
| Retenção (D1, D7) | `get_admin_analytics()` |
| Usuários mais seguidos | `get_admin_analytics()` |
| Usuários mais ativos hoje (ranking) | `getAdminActiveUsersDb()` → `access_sessions` |
| **Atividade de hoje (por usuário)** | `getAdminTodayActivityDb()` → RPC `get_admin_today_activity()` |
| Telas mais acessadas (7 dias) | `get_admin_analytics()` → `screen_time_logs` |
| Conteúdo de hoje / Totais gerais | `get_admin_analytics()` |
| Fila de moderação | `admin_complaints_view` + `adminDismissComplaintDb` / `adminDeleteContentDb` / `adminBanUserDb` → RPC `admin_set_banned()` |
| **LinKa Premium** | `admin_list_premium()` / `admin_set_premium()` — ver `docs/17-premium.md` |
| Contas Verificadas | `getVerifiedAccountsDb()` / `setUserVerifiedDb()` ⚠️ ver nota no fim |

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
- Datas comparadas em **UTC** (`current_date`), igual ao resto do painel — os números batem entre as seções.

## Fila de moderação — o que cada botão faz de verdade

> **A regra que explica os três bugs desta seção:** `DELETE`/`UPDATE` que não casa nenhuma linha **não é erro** no Postgres. Com a anon key do admin, a RLS derruba a escrita em linha de terceiro em silêncio, o `error` volta `null` e a tela comemora. Toda escrita do painel sobre conteúdo/usuário alheio passa por RPC `SECURITY DEFINER` que **devolve quantas linhas mudaram**.

### Remover post / shot / flow

`adminDeleteContentDb(tipo, id)` → RPC `admin_delete_content(p_tipo, p_id)`. Migração: `docs/migrations/20260811-admin-moderation.sql`.

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
| `auth.users.banned_until` + `delete from auth.sessions` | `admin_set_banned` | **A trava real**: o GoTrue recusa login e renovação de token |
| `BannedScreen` no `RequireAuth` | `client/App.tsx` | Fecha a janela em que o access token já emitido ainda vale (até 1h) |

- O retorno da RPC traz `session_revoked`. Se vier `false` (o dono da função sem grant em `auth`), o painel mostra toast **destrutivo** avisando que a conta foi marcada mas o acesso não caiu — nunca um "banido" que não bane.
- Banir a si mesmo é recusado (`CANNOT_BAN_SELF`) — trancaria o admin fora do painel.
- Desbanir: `adminBanUserDb(userId, false)` limpa o flag e o `banned_until`. Ainda **não há botão** para isso na tela; hoje é via SQL/console.
- A denúncia é descartada logo após o ban; outras denúncias contra o mesmo usuário continuam na fila.

### Verificar conta

`setUserVerifiedDb(userId, verified)` → RPC `admin_set_verified()`. Mesma migração da remoção de conteúdo.

Corrigido em 11/08/2026 — batia em **duas** travas: `profiles_update_own` e o trigger `freeze_is_verified`, que revertia a coluna fora do service_role. A migração ensina o trigger a reconhecer `is_app_admin`, senão a RPC gravaria e o trigger desfaria na saída.

## Erros do painel no Sentry

Todo `catch` da tela chama `reportHandledError(err, "admin:*")` antes do toast — sem isso o erro morria no toast e não existia para nós (foi o caso do bug do ban). Tags: `admin:load`, `admin:moderation-action` (com `acao`/`tipo`/`complaint_id`), `admin:set-premium`, `admin:set-verified`.

> Só chega ao painel do Sentry se `VITE_SENTRY_DSN` estiver definida **no ambiente do build** (Appflow/Vercel). Sem a variável, `reportHandledError` cai em `console.error` — ver `client/lib/monitoring.ts`.

## Notas

> ✅ A seção "Contas Verificadas", quebrada desde `20260713-security-hardening`, voltou a funcionar em 11/08/2026 — ver "Verificar conta" acima.

> **Migrações a rodar no Supabase (nesta ordem):** `20260811-admin-ban-user.sql` e `20260811-admin-moderation.sql`. Sem elas os três botões falham com "function does not exist" — que é ruidoso, mas honesto, ao contrário do silêncio de antes.
