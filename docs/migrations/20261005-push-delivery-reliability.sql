-- ============================================================================
-- Migration: 20261005 — confiabilidade do push (notificação atrasando/sumindo)
--
-- SINTOMA: incentivo/comentário grava a linha em `notifications` (aparece no
-- sino), mas o push chega tarde ou não chega no iPhone de quem recebeu.
--
-- CAUSAS ENCONTRADAS NO CÓDIGO (corrigidas junto com esta migração):
--   1. JWT da Apple recriado a CADA notificação. A Apple exige reaproveitar
--      o token de provedor por 20–60 min e recusa com 429
--      TooManyProviderTokenUpdates quando ele muda demais — exatamente o que
--      acontece numa rajada de incentivos. O push era perdido em silêncio
--      (a função respondia 200 de qualquer jeito).
--   2. A função só respondia ao webhook depois de falar com a Apple. O
--      Database Webhook (pg_net) desiste no timeout dele (padrão do painel:
--      1000 ms); partida a frio da função passa disso.
--   3. No app, o ouvinte do token era registrado DEPOIS do `register()` (o
--      evento não é retido e podia se perder) e o token só era regravado se
--      mudasse — se a linha sumisse do banco, o aparelho ficava mudo.
--
-- ESTA MIGRAÇÃO CRIA:
--   * `apns_provider_token` — o JWT compartilhado entre execuções da função;
--   * `push_delivery_log`   — resultado de cada envio (status da Apple,
--     motivo e atraso desde a criação da notificação), 30 dias.
-- As duas só são acessadas pela service role (RLS ligada, sem policy).
-- As funções funcionam sem elas (sem cache compartilhado e sem log).
--
-- ORDEM: rodar esta migração → publicar as funções
--   supabase functions deploy send-push-notification
--   supabase functions deploy reengagement-push
-- → no painel, Database Webhooks → webhook de `notifications` → Timeout 5000 ms.
--
-- Reexecutável.
-- ============================================================================

create table if not exists public.apns_provider_token (
  id        smallint primary key check (id = 1),
  jwt       text not null,
  issued_at timestamptz not null
);

comment on table public.apns_provider_token is
  'JWT de provedor da APNs reaproveitado entre execuções das edge functions (a Apple recusa renovação a menos de 20 min). Linha única.';

alter table public.apns_provider_token enable row level security;

create table if not exists public.push_delivery_log (
  id              bigserial primary key,
  created_at      timestamptz not null default now(),
  source          text not null,          -- 'notification' | 'reengagement:<kind>'
  notification_id text,                   -- notifications.id (null no reengajamento)
  user_id         uuid,
  type            smallint,               -- notifications.type (0 no reengajamento)
  token_prefix    text,                   -- 8 primeiros caracteres, só p/ diferenciar aparelhos
  status          smallint not null,      -- HTTP da Apple; 0 = sem token / erro de rede
  reason          text,                   -- motivo da Apple (Unregistered, TooManyProviderTokenUpdates…) ou 'no_tokens'
  delay_ms        integer                 -- da criação da notificação até a resposta da Apple
);

comment on table public.push_delivery_log is
  'Uma linha por tentativa de push (edge functions send-push-notification e reengagement-push). Retenção de 30 dias feita pela própria função.';

create index if not exists push_delivery_log_created_idx on public.push_delivery_log (created_at desc);
create index if not exists push_delivery_log_user_idx on public.push_delivery_log (user_id, created_at desc);

alter table public.push_delivery_log enable row level security;

-- ── Diagnóstico ─────────────────────────────────────────────────────────────
--
-- A) ANTES de publicar a função nova — o que o webhook recebeu nas últimas
--    ~6 h (pg_net guarda por pouco tempo). timed_out = true ou status 401/5xx
--    confirmam a causa 2 / configuração do segredo:
--
--   select created, status_code, timed_out, error_msg, left(content, 160) as resposta
--     from net._http_response
--    order by created desc
--    limit 40;
--
-- B) Configuração do webhook (timeout e se o header do segredo está lá —
--    o valor do segredo é mascarado):
--
--   select tgname,
--          regexp_replace(pg_get_triggerdef(t.oid),
--                         '("x-webhook-secret"\s*:\s*")[^"]*', '\1***', 'g') as definicao
--     from pg_trigger t
--    where t.tgrelid = 'public.notifications'::regclass
--      and not t.tgisinternal;
--
-- C) DEPOIS de publicar — como estão saindo os pushes:
--
--   select date_trunc('hour', created_at) as hora, status, reason,
--          count(*) as envios, round(avg(delay_ms)) as atraso_medio_ms
--     from push_delivery_log
--    where created_at > now() - interval '2 days'
--    group by 1, 2, 3
--    order by 1 desc, envios desc;
