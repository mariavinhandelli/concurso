-- IA invisível · Fase 3 — agenda o processamento noturno de flashcards a
-- partir do caderno de erros, 05:30 UTC (logo após generate-lei-questoes,
-- 05:00 UTC, pra não competir por rate limit da Anthropic no mesmo minuto).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'generate-error-flashcards-nightly') then
    perform cron.unschedule('generate-error-flashcards-nightly');
  end if;
  perform cron.schedule(
    'generate-error-flashcards-nightly',
    '30 5 * * *',
    $cron$
    select net.http_post(
      url := 'https://krkbzeqwjrrxvdpwyqar.supabase.co/functions/v1/generate-error-flashcards',
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
