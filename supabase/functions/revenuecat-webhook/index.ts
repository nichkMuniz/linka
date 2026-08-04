/**
 * Webhook do RevenueCat → tabela `subscriptions`.
 *
 * O RevenueCat é a fonte da verdade do estado da assinatura paga: ele valida o
 * recibo com a Apple e nos avisa a cada evento (compra, renovação, cancelamento,
 * expiração). Esta função traduz o evento para a linha do usuário.
 *
 * DEPLOY (verify_jwt DESLIGADO — o RevenueCat não manda JWT do Supabase):
 *   supabase functions deploy revenuecat-webhook --no-verify-jwt
 *
 * VARIÁVEIS (Supabase → Edge Functions → Secrets):
 *   REVENUECAT_WEBHOOK_SECRET  — valor exato do campo "Authorization header"
 *                                configurado no painel do RevenueCat
 *   SUPABASE_URL               — injetada pela plataforma
 *   SUPABASE_SERVICE_ROLE_KEY  — injetada pela plataforma
 *
 * SEGURANÇA: com `verify_jwt` off, esta URL é pública. A única barreira é o
 * segredo no header Authorization, comparado em TEMPO CONSTANTE (uma comparação
 * com `===` vaza o prefixo correto por timing). Sem o segredo configurado a
 * função recusa tudo — nunca "passa direto".
 *
 * COLUNAS: escreve SOMENTE as de assinatura paga. `manual_active`/`manual_until`
 * são território exclusivo do admin (`admin_set_premium`) — se este webhook as
 * tocasse, uma renovação apagaria a cortesia concedida. Ver `docs/17-premium.md`.
 */

/** Entitlement configurado no painel do RevenueCat. */
const PREMIUM_ENTITLEMENT = "premium";

/** Comparação em tempo constante — não vaza o prefixo correto por timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RevenueCatEvent {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  product_id?: string;
  store?: string;
  environment?: string;
  expiration_at_ms?: number | null;
  entitlement_ids?: string[] | null;
  entitlement_id?: string | null;
  transferred_to?: string[] | null;
  transferred_from?: string[] | null;
}

/** Status da nossa tabela a partir do tipo de evento do RevenueCat. */
function statusForEvent(type: string): string | null {
  switch (type) {
    // Acesso concedido/renovado.
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "PRODUCT_CHANGE":
    case "NON_RENEWING_PURCHASE":
    case "TRANSFER":
      return "active";

    // Cancelou a renovação automática. NÃO é perda de acesso: o período já
    // pago continua valendo, e `is_premium()` honra isso enquanto
    // current_period_end estiver no futuro.
    case "CANCELLATION":
      return "cancelled";

    // Fim de fato do acesso.
    case "EXPIRATION":
      return "expired";

    // Assinatura pausada (recurso da Play Store; inofensivo no iOS).
    case "SUBSCRIPTION_PAUSED":
      return "inactive";

    // Falha de cobrança: a Apple ainda tenta de novo durante o período de
    // graça. Mexer no status aqui cortaria o acesso antes da hora — se não
    // for resolvido, vem um EXPIRATION depois.
    case "BILLING_ISSUE":
      return null;

    // Evento de teste do painel do RevenueCat.
    case "TEST":
      return null;

    default:
      return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const secret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  if (!secret) {
    console.error("REVENUECAT_WEBHOOK_SECRET não configurado — recusando.");
    return new Response("Server misconfigured", { status: 500 });
  }
  if (!safeEqual(req.headers.get("authorization") ?? "", secret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { event?: RevenueCatEvent };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const event = body?.event ?? {};
  const type = String(event.type ?? "");

  // Daqui para baixo o retorno é sempre 200: um não-200 faz o RevenueCat
  // reenfileirar o evento, e reprocessar algo que já foi ignorado de propósito
  // só gera ruído infinito na fila deles.
  const ok = (msg: string) => new Response(msg, { status: 200 });

  const status = statusForEvent(type);
  if (!status) {
    console.log(`[revenuecat] evento ignorado: ${type}`);
    return ok("ignored");
  }

  // O entitlement é o que amarra o produto ao acesso premium. Um evento de
  // outro entitlement (se um dia existir outro) não pode mexer nesta linha.
  const entitlements = event.entitlement_ids ??
    (event.entitlement_id ? [event.entitlement_id] : null);
  if (entitlements && !entitlements.includes(PREMIUM_ENTITLEMENT)) {
    console.log(`[revenuecat] entitlement fora de escopo: ${entitlements.join(",")}`);
    return ok("other entitlement");
  }

  // app_user_id é o user.id do Supabase — definido em Purchases.configure().
  // Um ID anônimo ($RCAnonymousID:…) significa compra sem sessão: não há linha
  // para atualizar, e o app reconcilia depois via restaurar compras.
  const appUserId = String(event.app_user_id ?? "");
  if (!UUID_RE.test(appUserId)) {
    console.warn(`[revenuecat] app_user_id não é um uuid: ${appUserId}`);
    return ok("no supabase user");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const row = {
    user_id: appUserId,
    status,
    product_id: event.product_id ?? null,
    store: event.store === "APP_STORE" ? "app_store" : (event.store ?? "").toLowerCase() || null,
    rc_app_user_id: appUserId,
    environment: (event.environment ?? "").toLowerCase() || null,
    current_period_end: event.expiration_at_ms
      ? new Date(event.expiration_at_ms).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  };

  // `merge-duplicates` gera ON CONFLICT DO UPDATE apenas para as colunas
  // enviadas — é o que garante que manual_active/manual_until sobrevivam.
  const response = await fetch(
    `${supabaseUrl}/rest/v1/subscriptions?on_conflict=user_id`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(row),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`[revenuecat] upsert falhou ${response.status}: ${detail}`);
    // Aqui SIM vale o não-200: a escrita falhou e queremos a reentrega.
    return new Response("Upsert failed", { status: 500 });
  }

  // TRANSFER: a assinatura mudou de dono (mesmo Apple ID em outra conta do
  // app). Os donos antigos perdem o acesso pago — sem isto, dois usuários
  // ficariam premium com uma assinatura só.
  if (type === "TRANSFER" && Array.isArray(event.transferred_from)) {
    const previous = event.transferred_from.filter((id) => UUID_RE.test(id));
    for (const previousId of previous) {
      await fetch(
        `${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${previousId}`,
        {
          method: "PATCH",
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            status: "expired",
            updated_at: new Date().toISOString(),
          }),
        },
      ).catch((error) => console.error("[revenuecat] transfer cleanup", error));
    }
  }

  console.log(`[revenuecat] ${type} → ${status} para ${appUserId}`);
  return ok("ok");
});
