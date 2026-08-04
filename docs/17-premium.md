# 17 — LinKa Premium (Freemium)

Sistema de assinatura premium com **cobrança real via In-App Purchase da Apple**, intermediada pelo RevenueCat. Migração: `docs/migrations/20260803-premium-iap.sql`.

Princípio de produto: **nunca gatear os loops de retenção** (feed/social/DMs, check-ins, registro de peso/comida, participar de duelos). O premium vende **profundidade, personalização e status** sobre os dados que o usuário gera de graça.

---

## Modelo de dados

- Tabela **`subscriptions`** + função **`is_premium(uid)`** + coluna **`badges.premium`** — ver `docs/14-database-schema.md` e as migrações `20260715-premium-plan.sql` (base) e `20260803-premium-iap.sql` (cobrança).
- **Decisão D1 — tabela separada, não colunas em `profiles`:** `profiles` tem policy de UPDATE pelo próprio usuário; premium ali permitiria auto-upgrade. `subscriptions` não tem **nenhuma** policy de escrita — só o service role escreve.
- **Decisão D6 — dois conjuntos de colunas DISJUNTOS na mesma linha.** `user_id` é a PK: uma linha por usuário. A assinatura paga e a cortesia do admin escreveriam nas mesmas colunas e se destruiriam — liberar cortesia para quem paga apagaria os dados da assinatura, e qualquer evento do RevenueCat (renovação, expiração) apagaria a cortesia. A separação resolve sem tabela nova:

| Conjunto | Colunas | Quem escreve |
|---|---|---|
| Assinatura paga | `status`, `product_id`, `store`, `rc_app_user_id`, `environment`, `current_period_end` | **só** o webhook `revenuecat-webhook` |
| Cortesia | `manual_active`, `manual_until`, `manual_note` | **só** a RPC `admin_set_premium` |

  `is_premium()` é o **OR** dos dois. Um usuário pode ter as duas coisas ao mesmo tempo, e revogar a cortesia de um assinante não cancela nada na Apple.

- **Decisão D7 — assinatura cancelada continua premium até o fim do período pago.** A Apple não estorna o período corrente: quem cancela hoje usa até a data de renovação. Por isso `is_premium()` aceita `status = 'cancelled'` enquanto `current_period_end` estiver no futuro. Sem esse braço, o webhook de `CANCELLATION` cortaria na hora um acesso já pago — e o `SubscriptionDrawer` já exibia essa data como "Acesso até".
- **Decisão D2 — status via RPC, não no select do perfil:** `getUserProfileDb` e seu cache (`userProfile:{id}`, persistido em localStorage) são reusados para perfis de terceiros; o status vem de `supabase.rpc("is_premium")` em `getPremiumStatusDb()` (cache `premium:{uid}`, `CACHE_TTL_MEDIUM` 60s — quem escreve é um terceiro, o TTL é a defesa).
- **Decisão D3 (revista em 03/08/2026) — enforcement agora também no servidor.** A versão original aceitava checagem só no app *"porque não há dinheiro envolvido"*. Com cobrança real a premissa caiu: sem RLS, alguém com a anon key cria rotinas e duelos ilimitados sem pagar. A migração `20260803-premium-limits-rls.sql` adiciona `WITH CHECK` de INSERT em `routines` e `duel_groups` (`is_premium(auth.uid()) OR contagem < 1`), com helpers `SECURITY DEFINER` para não recursar na própria RLS. **Só INSERT** — UPDATE/DELETE ficam livres para quem já passou do limite (assinante que cancelou, ou o quiz que cria N rotinas de uma vez) continuar editando o que tem.
- **Decisão D4 — insígnias premium desbloqueiam por status:** seeds com `condition_type = 'checkin_total'` e `required_checkins = 0` fazem `isBadgeUnlocked()` retornar `true` para todos sem mudança na função; o gate de **seleção/exibição** fica em `setSelectedBadgeDb` (lança `BADGE_PREMIUM_LOCKED`).
  - **Correção 20/07/2026 — gate também na CONCESSÃO:** o `required_checkins = 0` tinha um efeito colateral não previsto no D4 — as award functions (`awardBadgesForCheckInsDb`/`awardNutritionBadgesDb`) inserem em `user_badges` toda insígnia cuja condição bate, e `checkin_total >= 0` é sempre verdade. Resultado: **qualquer** check-in/registro concedia as 2 premium (`premium_diamante`/`premium_coroa`) a **todo mundo** — elas ficavam no acervo e viravam a insígnia exibida (maior `sort_order`), mesmo sem o gate de seleção ser tocado. Agora as duas award functions buscam `getPremiumStatusDb()` (→ `is_premium` → tabela `subscriptions`) e **filtram fora** `badge.premium` quando o usuário não é assinante ativo. Limpeza dos registros já vazados: `docs/migrations/20260720-premium-badges-cleanup.sql` (8 linhas / 4 usuários em 20/07/2026). O gate de seleção continua como backstop.

## Camada client

| Peça | Arquivo | Papel |
|---|---|---|
| `getPremiumStatusDb()` / `invalidatePremiumStatus()` | `client/lib/ritmofit-db.ts` | RPC `is_premium` com cache 60s; nunca cacheia com viewer nulo |
| `PremiumProvider` / `usePremium()` | `client/lib/premium-context.tsx` | `{ isPremium, loading, refresh, applyPurchase }`; montado em `App.tsx` dentro de `AuthProvider` |
| `PaywallDrawer` | `client/components/shared/paywall-drawer.tsx` | Drawer glass com os 4 benefícios (destaca o `feature` que motivou) + seletor de planos, compra, restaurar e links legais |
| `client/lib/purchases.ts` | — | Camada sobre o SDK do RevenueCat: `configurePurchases`, `getPremiumPackages`, `purchasePremium`, `restorePremiumPurchases`, `hasActiveEntitlement`. **No-op fora do app nativo** |
| `PremiumGate` | `client/components/shared/premium-gate.tsx` | Blur(8px) + cadeado + CTA sobre conteúdo premium; premium vê os children direto |
| `getSubscriptionDb()` | `client/lib/ritmofit-db.ts` | Lê a **própria** linha de `subscriptions` (policy `subscriptions_select_own`) para a tela de gerenciar assinatura. **Sem cache** de propósito — é lida ao abrir o drawer (raro), e status/data velhos são piores que um round-trip |
| `SubscriptionDrawer` | `client/components/profile/subscription-drawer.tsx` | Detalhes da assinatura + cancelamento (ver abaixo) |

### Como o status é decidido (duas fontes, combinadas por OR)

`usePremium().isPremium` = **status do banco** `||` **entitlement do RevenueCat**. As duas cobrem casos diferentes e nenhuma sozinha basta:

| Fonte | Cobre |
|---|---|
| Banco (`is_premium` via RPC, cache 60s) | Cortesia do admin — não existe na loja |
| RevenueCat (`getCustomerInfo`, cache local do SDK) | Assinatura recém-comprada, e o caso em que o **webhook falhou ou atrasou** |

Sem o segundo braço, uma falha de webhook deixaria um assinante **pagante sem acesso** — o pior desfecho possível. Sem o primeiro, a cortesia não funcionaria.

`applyPurchase()` libera o acesso **na hora** após compra/restauração: o entitlement da Apple já é definitivo naquele instante, mas a linha em `subscriptions` só aparece quando o webhook chegar (segundos) e o cache de 60s vencer. Sem isso o usuário paga e continua vendo cadeado.

## Fluxo de compra

1. `PaywallDrawer` abre → `getPremiumPackages()` lê a oferta **"current"** do painel do RevenueCat.
2. Os planos **não são hardcoded**: o drawer renderiza o que vier, e `product.priceString` já chega formatado pela Apple na moeda do aparelho. Trocar plano ou preço é mexer no painel do RevenueCat — **sem release novo**.
3. `purchasePremium(pkg)` → folha de pagamento da Apple. Cancelar é desfecho normal (`status: "cancelled"`), sem toast de erro.
4. Sucesso → `applyPurchase()` + toast + fecha o drawer.
5. Em paralelo, o RevenueCat chama a edge function `revenuecat-webhook`, que grava em `subscriptions`.

**Restaurar compras** (`restorePremiumPurchases`) é **obrigatório** pela Guideline 3.1.1 e vive no rodapé do paywall — é onde cai quem reinstalou o app ou trocou de aparelho (esse usuário aparece como não-premium, então vê o paywall).

### Requisitos legais no paywall (Guideline 3.1.2)

O rodapé do `PaywallDrawer` tem, **obrigatoriamente**: condições de renovação automática + links funcionais para **Termos de Uso** e **Política de Privacidade**, abertos com o `Browser` do Capacitor. Páginas em `public/termos.html` e `public/privacidade.html`, servidas em `/termos` e `/privacidade` (rewrites em `vercel.json`), URLs em `shared/share-config.ts`. **Não remover** — é uma das causas mais comuns de rejeição em apps de assinatura.

## Webhook — `supabase/functions/revenuecat-webhook/index.ts`

Deploy com `verify_jwt` **desligado** (o RevenueCat não manda JWT do Supabase):

```
supabase functions deploy revenuecat-webhook --no-verify-jwt
```

Autenticação pelo header `Authorization`, comparado em **tempo constante** com `REVENUECAT_WEBHOOK_SECRET` (mesmo padrão de `send-push-notification`). Sem o segredo configurado a função recusa tudo.

| Evento | `status` gravado |
|---|---|
| `INITIAL_PURCHASE`, `RENEWAL`, `UNCANCELLATION`, `PRODUCT_CHANGE`, `NON_RENEWING_PURCHASE`, `TRANSFER` | `active` |
| `CANCELLATION` | `cancelled` (acesso segue até `current_period_end` — ver D7) |
| `EXPIRATION` | `expired` |
| `SUBSCRIPTION_PAUSED` | `inactive` |
| `BILLING_ISSUE` | **nenhum** — a Apple ainda tenta cobrar no período de graça; cortar aqui seria antes da hora |
| `TEST` e desconhecidos | **nenhum** |

Detalhes que importam:

- **Upsert com `Prefer: resolution=merge-duplicates`** — atualiza só as colunas enviadas, que é o que garante a sobrevivência de `manual_active`/`manual_until` (D6).
- **Retorna 200 para eventos ignorados.** Um não-200 faz o RevenueCat reenfileirar; só a falha de escrita devolve 500, que é quando a reentrega é desejada.
- **`app_user_id` precisa ser um UUID** — é o `user.id` do Supabase, definido em `Purchases.configure()`. Um `$RCAnonymousID:…` significa compra sem sessão: não há linha para atualizar, e o app reconcilia depois via restaurar compras.
- **`TRANSFER`** marca os donos anteriores (`transferred_from`) como `expired`, senão dois usuários ficariam premium com uma assinatura só.

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

## Cortesia — liberar premium para quem você quiser

Continua funcionando com cobrança ligada, e é **independente** de assinaturas pagas: dar ou revogar cortesia nunca altera (nem cancela) a assinatura de quem paga, e nenhum evento do RevenueCat apaga uma cortesia. Ver D6.

### Pelo app — Painel Admin → seção "LinKa Premium" (recomendado)

1. Escolher a **duração**: `Permanente` (padrão, `manual_until = null`), `7 dias` ou `30 dias`.
2. Buscar por **@handle ou nome** (busca com debounce de 350 ms, mín. 2 caracteres) e tocar **Ativar**.
3. A lista abaixo mostra **todas** as linhas de `subscriptions` (ativos primeiro). Cada linha distingue "App Store até DATA" de "cortesia até DATA". O `X` **só aparece quando existe cortesia** e revoga apenas ela — numa assinatura paga o botão não teria efeito nenhum, então não é exibido.

| Peça | Onde |
|---|---|
| Seção da UI | `client/pages/Admin.tsx` (entre "Fila de Moderação" e "Contas Verificadas") |
| `getAdminPremiumUsersDb()` / `adminSetPremiumDb()` / `adminSearchUsersDb()` | `client/lib/ritmofit-db.ts` |
| RPCs `admin_list_premium()` / `admin_set_premium(p_user_id, p_active, p_days, p_note)` | migração `20260803-premium-iap.sql` |

> **Decisão D5 — autorização no servidor, não na lista do App.tsx.** `subscriptions` continua **sem policy de escrita** (D1): as duas RPCs são `SECURITY DEFINER` e checam `is_app_admin(auth.uid())` contra a tabela **`app_admins`**. `ADMIN_USER_IDS` em `client/App.tsx` só esconde a rota — se a autorização dependesse dela, qualquer um com a anon key se daria premium. **Admin novo = inserir em `app_admins` E em `ADMIN_USER_IDS`.**

O cache do status tem TTL de 60s — o app do usuário libera os recursos em até 1 minuto (a UI avisa isso).

### Pelo SQL Editor (equivalente, para quem não é admin no app)

```sql
-- Conceder cortesia permanente
insert into public.subscriptions (user_id, status, manual_active)
values ('<uid do auth.users>', 'inactive', true)
on conflict (user_id) do update
  set manual_active = true, manual_until = null, updated_at = now();

-- Conceder por 30 dias
update public.subscriptions
   set manual_active = true, manual_until = now() + interval '30 days', updated_at = now()
 where user_id = '<uid>';

-- Revogar a cortesia (não mexe na assinatura paga)
update public.subscriptions
   set manual_active = false, manual_until = null, updated_at = now()
 where user_id = '<uid>';
```

> Nunca escreva `status`/`store`/`current_period_end` à mão: essas colunas são do webhook, e o próximo evento do RevenueCat sobrescreveria o que você colocou.

## Produtos na App Store

Grupo de assinatura **"Linka Premium"** com dois produtos (mesmo grupo de propósito: o usuário só pode ter um ativo por vez, e trocar entre eles é upgrade/downgrade nativo da Apple, com proporcional automático):

| Product ID | Duração | Reference Name |
|---|---|---|
| `com.linka.meuapp.premium.monthly` | 1 mês | LinKa Premium Mensal |
| `com.linka.meuapp.premium.annual` | 1 ano | LinKa Premium Anual |

> **Product ID é permanente** — não pode ser renomeado nem reutilizado depois de criado, mesmo que a assinatura seja apagada.

Estes IDs **não aparecem em lugar nenhum do código**: os planos vêm da oferta `current` do RevenueCat em tempo de execução. Adicionar um plano novo (semestral, vitalício) ou mudar preço não exige build.

No RevenueCat, montar os *packages* com os identificadores **pré-definidos** `$rc_monthly` e `$rc_annual` — o `PaywallDrawer` lê `packageType` para escolher o rótulo ("Mensal" + "/mês"). Com identificador customizado o tipo chega como `CUSTOM` e cai no rótulo genérico, sem sufixo de período.

### Screenshot de review

`docs/appstore/subscription-review-640x920.png`, gerada por `scripts/gen-subscription-review-screenshot.mjs` (640×920, sem canal alfa — transparência é recusada pelo App Store Connect com a mensagem genérica "dimensions are wrong"). É um mockup do paywall para o revisor localizar a tela de compra. **Trocar por um print real de device antes de submeter o app para revisão.**

## Configuração externa (fora do repositório)

| Onde | O quê |
|---|---|
| App Store Connect | **Paid Applications Agreement** assinado (dados bancários + fiscais). Sem isso os produtos nem aparecem no sandbox |
| App Store Connect | Os dois produtos acima, em *Ready to Submit* no mínimo |
| App Store Connect | **In-App Purchase Key** (exigida pelo StoreKit 2) e **Sandbox tester** para testar sem cobrança |
| RevenueCat | Projeto iOS + entitlement `premium` + oferta `current` com os pacotes |
| RevenueCat | Webhook apontando para a edge function, com o valor do header `Authorization` |
| Build (Appflow) | `VITE_REVENUECAT_IOS_KEY` — chave pública do SDK iOS |
| Supabase → Secrets | `REVENUECAT_WEBHOOK_SECRET` |

> **Appflow usa npm.** O plugin foi adicionado ao `package.json` **e** ao `package-lock.json` (`npm install --package-lock-only`); sem o lockfile o build do Appflow falha. O plugin entra sozinho no `Package.swift` via `npx cap sync ios` — não há edição de `pbxproj`.

> **Versão do plugin:** `@revenuecat/purchases-capacitor@11.3.2`. A v12+ exige Capacitor 8 e o projeto está no 7 — não atualizar sem migrar o Capacitor junto.

## Ideias de conversão (backlog)

- Trial ganho por comportamento: "7 dias de streak → 7 dias de Premium".
- Referral: "convide 3 amigos → 1 mês de Premium".
- Selo premium ao lado do nome no feed (usa `is_premium(uid)` de terceiros).
