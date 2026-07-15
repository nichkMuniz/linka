-- Push de re-engajamento agendado — 2026-07-13
-- Chama a Edge Function `reengagement-push` 1x/dia (19:00 BRT = 22:00 UTC).
--
-- PRÉ-REQUISITOS (rodar uma vez, no SQL Editor do Supabase):
--   1) Deploy da função:  supabase functions deploy reengagement-push
--   2) Secrets já configurados (os mesmos do send-push-notification):
--      APNS_KEY_P8, APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID
--      (opcional) REENGAGEMENT_CRON_SECRET — se setado, precisa bater com o header abaixo.
--
-- SUBSTITUA os placeholders:
--   <PROJECT_REF>          → ref do projeto (ex.: abcdefghijklmnop)
--   <SERVICE_ROLE_KEY>     → service role key (Settings → API)
--   <CRON_SECRET>          → mesmo valor de REENGAGEMENT_CRON_SECRET (ou remova o header se não usar)

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
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Conferir:   select * from cron.job;
-- Testar já:  select net.http_post(url := 'https://<PROJECT_REF>.functions.supabase.co/reengagement-push',
--                 headers := jsonb_build_object('Content-Type','application/json',
--                   'Authorization','Bearer <SERVICE_ROLE_KEY>','x-cron-secret','<CRON_SECRET>'),
--                 body := '{}'::jsonb);
