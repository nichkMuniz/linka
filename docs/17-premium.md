# 17 — LinKa Premium (Freemium)

Sistema de assinatura premium. **Fase 1 (atual): gates sem cobrança** — o status é ativado manualmente via SQL e o paywall mostra "Em breve". **Fase 2 (futura): RevenueCat/StoreKit** — cobrança real via In-App Purchase da Apple.

Princípio de produto: **nunca gatear os loops de retenção** (feed/social/DMs, check-ins, registro de peso/comida, participar de duelos). O premium vende **profundidade, personalização e status** sobre os dados que o usuário gera de graça.

---

## Modelo de dados

- Tabela **`subscriptions`** + função **`is_premium(uid)`** + coluna **`badges.premium`** — ver `docs/14-database-schema.md` e a migração `docs/migrations/20260715-premium-plan.sql`.
- **Decisão D1 — tabela separada, não colunas em `profiles`:** `profiles` tem policy de UPDATE pelo próprio usuário; premium ali permitiria auto-upgrade. `subscriptions` não tem **nenhuma** policy de escrita — só o service role escreve.
- **Decisão D2 — status via RPC, não no select do perfil:** `getUserProfileDb` e seu cache (`userProfile:{id}`, persistido em localStorage) são reusados para perfis de terceiros; o status vem de `supabase.rpc("is_premium")` em `getPremiumStatusDb()` (cache `premium:{uid}`, `CACHE_TTL_MEDIUM` 60s — quem escreve é um terceiro, o TTL é a defesa).
- **Decisão D3 — enforcement client-side na Fase 1:** os limites são checados só no app. Um usuário técnico poderia burlar via API com a anon key. Aceito porque não há dinheiro envolvido nem dado de terceiros exposto. **Fase 2:** policies `WITH CHECK` usando `is_premium(auth.uid())` + contagem nas tabelas `user_workouts`/`duel_groups` etc.
- **Decisão D4 — insígnias premium desbloqueiam por status:** seeds com `condition_type = 'checkin_total'` e `required_checkins = 0` fazem `isBadgeUnlocked()` retornar `true` para todos sem mudança na função; o gate fica na **seleção** (`setSelectedBadgeDb` lança `BADGE_PREMIUM_LOCKED`).

## Camada client

| Peça | Arquivo | Papel |
|---|---|---|
| `getPremiumStatusDb()` / `invalidatePremiumStatus()` | `client/lib/ritmofit-db.ts` | RPC `is_premium` com cache 60s; nunca cacheia com viewer nulo |
| `PremiumProvider` / `usePremium()` | `client/lib/premium-context.tsx` | `{ isPremium, loading, refresh }`; montado em `App.tsx` dentro de `AuthProvider` |
| `PaywallDrawer` | `client/components/shared/paywall-drawer.tsx` | Drawer glass com os 4 benefícios (destaca o `feature` que motivou); CTA Fase 1 = toast "em breve" |
| `PremiumGate` | `client/components/shared/premium-gate.tsx` | Blur(8px) + cadeado + CTA sobre conteúdo premium; premium vê os children direto |

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

```sql
-- SQL Editor do Supabase
insert into public.subscriptions (user_id, status, product_id, store)
values ('<uid do auth.users>', 'active', 'manual', 'manual')
on conflict (user_id) do update
  set status = 'active', current_period_end = null, updated_at = now();

-- Desativar
update public.subscriptions set status = 'inactive', updated_at = now()
where user_id = '<uid>';
```

O cache do status tem TTL de 60s — aguardar 1 min ou relogar para refletir.

## Roteiro Fase 2 (RevenueCat / StoreKit)

1. **Produtos** no App Store Connect (ex: `linka_premium_monthly`, `linka_premium_yearly`) + conta RevenueCat com entitlement `premium`.
2. **Plugin** `@revenuecat/purchases-capacitor` (compatível com Capacitor 7). `app_user_id` = `user.id` do Supabase Auth. Atenção Appflow: deps novas exigem atualizar o lockfile que o Appflow usa.
3. **Webhook**: edge function Supabase nova (ex: `revenuecat-webhook`) seguindo o padrão de `send-push-notification` — `verify_jwt` off + secret no header comparado com `Deno.env.get("REVENUECAT_WEBHOOK_SECRET")` via comparação em tempo constante; escreve em `subscriptions` com service role.
4. **CTA do PaywallDrawer** troca o toast "em breve" pelo fluxo de compra (`Purchases.purchasePackage`) + botão "Restaurar compras" na `settings-drawer.tsx`, chamando `usePremium().refresh()` ao concluir.
5. **RLS server-side** dos limites (D3): `WITH CHECK (is_premium(auth.uid()) OR <contagem dentro do limite>)` em `user_workouts`/`user_diets`/`user_habits`/`duel_groups`.
6. Regras da Apple: assinatura de conteúdo digital **só** via IAP; exibir preço/termos no paywall; link de gerenciamento da assinatura.

## Ideias de conversão (backlog)

- Trial ganho por comportamento: "7 dias de streak → 7 dias de Premium".
- Referral: "convide 3 amigos → 1 mês de Premium".
- Selo premium ao lado do nome no feed (usa `is_premium(uid)` de terceiros).
