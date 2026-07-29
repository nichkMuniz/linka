# 17 — LinKa Premium (Freemium)

Sistema de assinatura premium. **Fase 1 (atual): gates sem cobrança** — o status é ativado manualmente via SQL e o paywall mostra "Em breve". **Fase 2 (futura): RevenueCat/StoreKit** — cobrança real via In-App Purchase da Apple.

Princípio de produto: **nunca gatear os loops de retenção** (feed/social/DMs, check-ins, registro de peso/comida, participar de duelos). O premium vende **profundidade, personalização e status** sobre os dados que o usuário gera de graça.

---

## Modelo de dados

- Tabela **`subscriptions`** + função **`is_premium(uid)`** + coluna **`badges.premium`** — ver `docs/14-database-schema.md` e a migração `docs/migrations/20260715-premium-plan.sql`.
- **Decisão D1 — tabela separada, não colunas em `profiles`:** `profiles` tem policy de UPDATE pelo próprio usuário; premium ali permitiria auto-upgrade. `subscriptions` não tem **nenhuma** policy de escrita — só o service role escreve.
- **Decisão D2 — status via RPC, não no select do perfil:** `getUserProfileDb` e seu cache (`userProfile:{id}`, persistido em localStorage) são reusados para perfis de terceiros; o status vem de `supabase.rpc("is_premium")` em `getPremiumStatusDb()` (cache `premium:{uid}`, `CACHE_TTL_MEDIUM` 60s — quem escreve é um terceiro, o TTL é a defesa).
- **Decisão D3 — enforcement client-side na Fase 1:** os limites são checados só no app. Um usuário técnico poderia burlar via API com a anon key. Aceito porque não há dinheiro envolvido nem dado de terceiros exposto. **Fase 2:** policies `WITH CHECK` usando `is_premium(auth.uid())` + contagem nas tabelas `user_workouts`/`duel_groups` etc.
- **Decisão D4 — insígnias premium desbloqueiam por status:** seeds com `condition_type = 'checkin_total'` e `required_checkins = 0` fazem `isBadgeUnlocked()` retornar `true` para todos sem mudança na função; o gate de **seleção/exibição** fica em `setSelectedBadgeDb` (lança `BADGE_PREMIUM_LOCKED`).
  - **Correção 20/07/2026 — gate também na CONCESSÃO:** o `required_checkins = 0` tinha um efeito colateral não previsto no D4 — as award functions (`awardBadgesForCheckInsDb`/`awardNutritionBadgesDb`) inserem em `user_badges` toda insígnia cuja condição bate, e `checkin_total >= 0` é sempre verdade. Resultado: **qualquer** check-in/registro concedia as 2 premium (`premium_diamante`/`premium_coroa`) a **todo mundo** — elas ficavam no acervo e viravam a insígnia exibida (maior `sort_order`), mesmo sem o gate de seleção ser tocado. Agora as duas award functions buscam `getPremiumStatusDb()` (→ `is_premium` → tabela `subscriptions`) e **filtram fora** `badge.premium` quando o usuário não é assinante ativo. Limpeza dos registros já vazados: `docs/migrations/20260720-premium-badges-cleanup.sql` (8 linhas / 4 usuários em 20/07/2026). O gate de seleção continua como backstop.

## Camada client

| Peça | Arquivo | Papel |
|---|---|---|
| `getPremiumStatusDb()` / `invalidatePremiumStatus()` | `client/lib/ritmofit-db.ts` | RPC `is_premium` com cache 60s; nunca cacheia com viewer nulo |
| `PremiumProvider` / `usePremium()` | `client/lib/premium-context.tsx` | `{ isPremium, loading, refresh }`; montado em `App.tsx` dentro de `AuthProvider` |
| `PaywallDrawer` | `client/components/shared/paywall-drawer.tsx` | Drawer glass com os 4 benefícios (destaca o `feature` que motivou); CTA Fase 1 = toast "em breve" |
| `PremiumGate` | `client/components/shared/premium-gate.tsx` | Blur(8px) + cadeado + CTA sobre conteúdo premium; premium vê os children direto |
| `getSubscriptionDb()` | `client/lib/ritmofit-db.ts` | Lê a **própria** linha de `subscriptions` (policy `subscriptions_select_own`) para a tela de gerenciar assinatura. **Sem cache** de propósito — é lida ao abrir o drawer (raro), e status/data velhos são piores que um round-trip |
| `SubscriptionDrawer` | `client/components/profile/subscription-drawer.tsx` | Detalhes da assinatura + cancelamento (ver abaixo) |

## Gerenciar assinatura (Configurações → Assinatura)

Seção **"Assinatura"** no `settings-drawer.tsx`, entre Negócio e Preferências, renderizada **só quando `usePremium().isPremium`** — quem não assina vê a coroa "Seja Premium" no header do `AppLayout`, que abre o paywall. O item "Gerenciar assinatura" abre o `SubscriptionDrawer` (aninhado, padrão glass do settings), que relê `getSubscriptionDb()` **a cada abertura** (quem escreve a linha é um terceiro — service role/webhook —, então o valor da abertura anterior pode estar velho).

O drawer exibe apenas o que existe de fato na tabela:

| Campo exibido | Origem | Observação |
|---|---|---|
| Status | `subscriptions.status` | Pill colorida: verde (ativa), laranja (cancelada/expirada), cinza (inativa) |
| Início | `subscriptions.created_at` | Formatado no locale do app (pt-BR / en-US) |
| Cobrança | `subscriptions.store` | `app_store` → "App Store"; `manual`/null → "Ativação manual" |
| Próxima cobrança / Acesso até | `subscriptions.current_period_end` | O **rótulo muda com o status**: cancelada/expirada → "Acesso até" (o período pago continua valendo); ativa → "Próxima cobrança". `NULL` → "Sem data de expiração" |

> **Não há preço na tela — de propósito.** A tabela `subscriptions` não tem coluna de valor e a Fase 1 não cobra nada; exibir um preço aqui seria número inventado. Na Fase 2 o valor vem do RevenueCat (`Purchases.getOfferings`) e esta tabela ganha o campo correspondente.

**Cancelamento.** O app **não cancela** a assinatura — no iOS isso é impossível por design: a Apple não expõe API de cancelamento de IAP, e a Guideline 3.1.2 exige mandar o usuário para a tela de assinaturas do Apple ID. Então:

- `store = 'app_store'` → botão **"Gerenciar na App Store"** + **"Cancelar assinatura"** (só se `status = 'active'`). O cancelar abre um `AlertDialog` explicando que quem cancela é a Apple e que o acesso continua até o fim do período pago, e o CTA abre `https://apps.apple.com/account/subscriptions` via `Browser.open` (@capacitor/browser; no iOS essa URL cai direto na tela de assinaturas).
- `store = 'manual'` ou null (**Fase 1 atual**) → **nenhum botão de cancelar**. Mostra a nota `settings_subscription_manual_note`: o acesso foi concedido manualmente, não há cobrança nem renovação, logo não há o que cancelar. Inventar um botão que abre a tela da Apple aqui levaria o usuário a uma lista vazia.

Constante `APPLE_SUBSCRIPTIONS_URL` no próprio componente.

## Mapa de gates (v1)

| Feature | Grátis | Premium | Onde |
|---|---|---|---|
| Gráfico de carga por exercício | Borrado (teaser com dados reais) | Visível | `routine-detail-drawer.tsx` (bloco `TrendChart`) |
| Gráfico do histórico de peso | Borrado; registrar/listar/apagar peso continua livre | Visível | `weight-tracker-card.tsx` (drawer Histórico) |
| Rotinas ativas | **1** (criar a 2ª abre paywall; editar/adicionar itens e metas nunca bloqueiam) | Ilimitadas | `create-wizard-drawer.tsx` (prop `activeRoutineCount` vinda de `Goals.tsx`; intercepta o step "what", abertura direta e backstops em `handleSaveRoutine`/`handleAddWeeklyProgram`) |
| Macros do diário | Grade P/C/G borrada; kcal, barra, água e gráfico de 7 dias livres. Metas: só kcal e água editáveis (macros existentes são **preservados** no save) | Tudo | `food-diary-card.tsx` |
| Insígnias premium | Visíveis no catálogo com selo 👑; tocar abre paywall | Selecionáveis | `insignias-drawer.tsx` + backstop em `setSelectedBadgeDb` |
| Criar duelos | **1 duelo ativo criado** (participar é sempre livre) | Ilimitados | `Community.tsx` (`activeCreatedDuels` = grupos com `createdBy = user` e `endDate` nula/futura) |

> Nota conhecida (aceita na v1): o quiz "Sugerido pelo app" cria N rotinas de uma vez — um usuário grátis com 0 rotinas pode terminar com 3–4. O gate barra as criações **seguintes**.

## Entrada global: ícone "Seja Premium" no header

Além dos gates contextuais acima, existe um ponto de entrada permanente para o paywall: um ícone de coroa (`Crown`, âmbar) no `AppLayout` (`client/components/layout/app-layout.tsx`) — entre logo e Buscar no header mobile, entre a navegação principal e o timer de uso na sidebar desktop. Renderizado só quando `!isPremium`; abre o `PaywallDrawer` **sem** `feature` destacado (entrada genérica, não motivada por um gate específico). O estado (`premiumPaywallOpen`) e o drawer vivem no próprio `AppLayout`, montados uma única vez para toda a navegação.

## Como ativar premium manualmente (Fase 1)

### Pelo app — Painel Admin → seção "LinKa Premium" (recomendado)

Migração: `docs/migrations/20260729-admin-premium.sql`. A tela `/admin` ganhou uma seção que faz o que o SQL abaixo fazia:

1. Escolher a **duração**: `Permanente` (padrão, `current_period_end = null`), `7 dias` ou `30 dias`.
2. Buscar por **@handle ou nome** (busca com debounce de 350 ms, mín. 2 caracteres) e tocar **Ativar**.
3. A lista abaixo mostra **todas** as linhas de `subscriptions` (ativos primeiro, com coroa e data de expiração). O `X` revoga (status → `inactive`, a linha fica como histórico) e **Reativar** concede de novo com a duração selecionada.

| Peça | Onde |
|---|---|
| Seção da UI | `client/pages/Admin.tsx` (entre "Fila de Moderação" e "Contas Verificadas") |
| `getAdminPremiumUsersDb()` / `adminSetPremiumDb()` / `adminSearchUsersDb()` | `client/lib/ritmofit-db.ts` |
| RPCs `admin_list_premium()` / `admin_set_premium(p_user_id, p_active, p_days)` | migração `20260729-admin-premium.sql` |

> **Decisão D5 — autorização no servidor, não na lista do App.tsx.** `subscriptions` continua **sem policy de escrita** (D1): as duas RPCs são `SECURITY DEFINER` e checam `is_app_admin(auth.uid())` contra a tabela **`app_admins`**. `ADMIN_USER_IDS` em `client/App.tsx` só esconde a rota — se a autorização dependesse dela, qualquer um com a anon key se daria premium. **Admin novo = inserir em `app_admins` E em `ADMIN_USER_IDS`.**

O cache do status tem TTL de 60s — o app do usuário libera os recursos em até 1 minuto (a UI avisa isso).

### Pelo SQL Editor (equivalente, para quem não é admin no app)

```sql
insert into public.subscriptions (user_id, status, product_id, store)
values ('<uid do auth.users>', 'active', 'manual', 'manual')
on conflict (user_id) do update
  set status = 'active', current_period_end = null, updated_at = now();

-- Desativar
update public.subscriptions set status = 'inactive', updated_at = now()
where user_id = '<uid>';
```

## Roteiro Fase 2 (RevenueCat / StoreKit)

1. **Produtos** no App Store Connect (ex: `linka_premium_monthly`, `linka_premium_yearly`) + conta RevenueCat com entitlement `premium`.
2. **Plugin** `@revenuecat/purchases-capacitor` (compatível com Capacitor 7). `app_user_id` = `user.id` do Supabase Auth. Atenção Appflow: deps novas exigem atualizar o lockfile que o Appflow usa.
3. **Webhook**: edge function Supabase nova (ex: `revenuecat-webhook`) seguindo o padrão de `send-push-notification` — `verify_jwt` off + secret no header comparado com `Deno.env.get("REVENUECAT_WEBHOOK_SECRET")` via comparação em tempo constante; escreve em `subscriptions` com service role.
4. **CTA do PaywallDrawer** troca o toast "em breve" pelo fluxo de compra (`Purchases.purchasePackage`) + botão "Restaurar compras" na seção **Assinatura** do `settings-drawer.tsx`, chamando `usePremium().refresh()` ao concluir. O `SubscriptionDrawer` já existe e passa a mostrar dados reais sozinho assim que o webhook gravar `store = 'app_store'` + `current_period_end` — falta só **preço** (vem de `Purchases.getOfferings`, exigindo coluna nova ou leitura do RevenueCat) e o botão de restaurar.
5. **RLS server-side** dos limites (D3): `WITH CHECK (is_premium(auth.uid()) OR <contagem dentro do limite>)` em `user_workouts`/`user_diets`/`user_habits`/`duel_groups`.
6. Regras da Apple: assinatura de conteúdo digital **só** via IAP; exibir preço/termos no paywall; link de gerenciamento da assinatura.

## Ideias de conversão (backlog)

- Trial ganho por comportamento: "7 dias de streak → 7 dias de Premium".
- Referral: "convide 3 amigos → 1 mês de Premium".
- Selo premium ao lado do nome no feed (usa `is_premium(uid)` de terceiros).
