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
| Fila de moderação | `admin_complaints_view` + `adminDismissComplaintDb` / `adminDeleteContentDb` / `adminBanUserDb` |
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

## Notas

> ⚠️ **A seção "Contas Verificadas" está quebrada desde a migração `20260713-security-hardening`.** `setUserVerifiedDb` faz `UPDATE` direto em `profiles` de outro usuário: a policy `profiles_update_own` limita o UPDATE à própria linha e o trigger `freeze_is_verified` reverte `is_verified` fora do service role. O update casa 0 linhas, **não retorna erro**, e o toast diz "verificado com sucesso" sem ter verificado nada. Correção pendente: RPC `admin_set_verified` no mesmo molde de `admin_set_premium`.
