-- Push de re-engajamento agendado — 2026-07-13
-- Chama a Edge Function `reengagement-push` 1x/dia (19:00 BRT = 22:00 UTC).
--
-- PRÉ-REQUISITOS (rodar uma vez, no SQL Editor do Supabase):
--   0) Migração 20261002-reengagement-activity.sql (a função v2 depende dela).
--   1) Deploy da função:  supabase functions deploy reengagement-push
--   2) Secrets já configurados (os mesmos do send-push-notification):
--      APNS_KEY_P8, APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID
--      REENGAGEMENT_CRON_SECRET — OBRIGATÓRIO (sem ele a função recusa tudo);
--      precisa bater com o header abaixo.
--   3) Antes de agendar, teste sem enviar: body '{"dryRun": true}'.
--
-- SUBSTITUA os placeholders:
--   <PROJECT_REF>          → ref do projeto (ex.: abcdefghijklmnop)
--   <ANON_KEY>             → a chave PÚBLICA (anon) — Settings → API Keys, a mesma
--                            VITE_SUPABASE_ANON_KEY do app. NÃO use a service role:
--                            o texto do job fica salvo em `cron.job`, e a chave mais
--                            poderosa do projeto não deve morar numa tabela. O gateway
--                            só exige um JWT válido; quem barra estranhos é o
--                            x-cron-secret, e a função usa a service role dela (env).
--   <CRON_SECRET>          → mesmo valor de REENGAGEMENT_CRON_SECRET

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove agendamento anterior de mesmo nome (idempotente).
select cron.unschedule('reengagement-daily')
where exists (select 1 from cron.job where jobname = 'reengagement-daily');

-- 22:00 UTC todos os dias = 19:00 America/Sao_Paulo.
select cron.schedule(
  'reengagement-daily',
  '0 22 * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.functions.supabase.co/reengagement-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_KEY>',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Conferir:   select * from cron.job;
-- Testar SEM enviar (devolve quem receberia o quê — ver em net._http_response):
--   select net.http_post(url := 'https://<PROJECT_REF>.functions.supabase.co/reengagement-push',
--     headers := jsonb_build_object('Content-Type','application/json',
--       'Authorization','Bearer <ANON_KEY>','x-cron-secret','<CRON_SECRET>'),
--     body := '{"dryRun": true}'::jsonb);
--   select id, status_code, content from net._http_response order by id desc limit 1;
