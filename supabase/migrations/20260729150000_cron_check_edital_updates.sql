-- Agenda o monitor de fontes de concurso: toda segunda-feira, 07h20 UTC —
-- logo depois do check-lei-updates (07h00), para não competir por recurso.
-- Semanal (e não diário como o de leis) porque são só 4 páginas de listagem e
-- concurso não muda de hora em hora; e porque alerta demais vira ruído que a
-- curadora aprende a ignorar.
select cron.schedule(
  'check-edital-updates-weekly',
  '20 7 * * 1',
  $$
    select net.http_post(
      url := 'https://krkbzeqwjrrxvdpwyqar.supabase.co/functions/v1/check-edital-updates',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || coalesce(
          (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_service_role_key'), ''
        )
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);
