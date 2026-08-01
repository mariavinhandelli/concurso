-- IA invisível · Fase 2 — agenda o processamento noturno do backlog de questões
-- C/E (generate-lei-questoes), 05:00 UTC ≈ 02:00 BRT, antes do refresh de
-- user_features. Reusa o mesmo secret de service role já usado pelo cron do
-- push (vault: reminder_service_role_key) — não é específico de lembretes,
-- é só um service-role JWT para autenticar chamadas internas de cron.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'generate-lei-questoes-nightly') then
    perform cron.unschedule('generate-lei-questoes-nightly');
  end if;
  perform cron.schedule(
    'generate-lei-questoes-nightly',
    '0 5 * * *',
    $cron$
    select net.http_post(
      url := 'https://krkbzeqwjrrxvdpwyqar.supabase.co/functions/v1/generate-lei-questoes',
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
