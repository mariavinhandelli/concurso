-- Check semanal de legislação — toda segunda-feira às 07:00 UTC (≈ 04:00
-- BRT), fora do horário dos outros 3 crons (05:00/05:30/06:20 UTC) pra não
-- competir por recursos no mesmo minuto.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'check-lei-updates-weekly') then
    perform cron.unschedule('check-lei-updates-weekly');
  end if;
  perform cron.schedule(
    'check-lei-updates-weekly',
    '0 7 * * 1',
    $cron$
    select net.http_post(
      url := 'https://krkbzeqwjrrxvdpwyqar.supabase.co/functions/v1/check-lei-updates',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || coalesce(
          (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_service_role_key'), ''
        )
      ),
      body := '{}'::jsonb
    ) as request_id;
    $cron$
  );
end $$;
