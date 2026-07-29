-- Agenda o espelhamento dos PDFs de edital: segunda 07h40 UTC, depois do
-- check-edital-updates (07h20). Semanal e não só uma vez porque o órgão
-- publica retificação SOBRESCREVENDO o mesmo arquivo — rodando toda semana, o
-- sha256 muda e uma versão nova é gravada (caminho inclui o hash, então a
-- anterior não é perdida). Quando nada muda, o job só toca last_checked_at.
select cron.schedule(
  'mirror-edital-pdfs-weekly',
  '40 7 * * 1',
  $$
    select net.http_post(
      url := 'https://krkbzeqwjrrxvdpwyqar.supabase.co/functions/v1/mirror-edital-pdfs',
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
