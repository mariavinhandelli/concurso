-- Hub de Editais — "Seguir concurso" + push de novidades.
-- Quem segue um edital (ou já ativou o concurso) recebe web push quando a
-- curadoria publica uma novidade (edital_updates): retificação, notícia,
-- resultado. Reusa a infra de push do N1 (push_subscriptions + VAPID +
-- pg_cron → Edge Function).

-- 1) Seguidores explícitos (quem ativou o concurso é seguidor implícito)
create table if not exists public.edital_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  edital_catalog_id uuid not null references public.editais_catalog(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, edital_catalog_id)
);
alter table public.edital_follows enable row level security;
drop policy if exists "select own edital_follows" on public.edital_follows;
create policy "select own edital_follows" on public.edital_follows
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "insert own edital_follows" on public.edital_follows;
create policy "insert own edital_follows" on public.edital_follows
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "delete own edital_follows" on public.edital_follows;
create policy "delete own edital_follows" on public.edital_follows
  for delete to authenticated using ((select auth.uid()) = user_id);

-- 2) Controle de envio: updates já notificados não repetem.
-- Backfill: tudo que já existia nasce "notificado" — o push vale só para
-- novidades publicadas a partir de agora.
alter table public.edital_updates
  add column if not exists notified_at timestamptz;
update public.edital_updates set notified_at = now() where notified_at is null;

-- 3) Cron horário chamando a Edge Function (mesmo padrão do send-daily-reminders)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'notify-edital-updates-hourly') then
    perform cron.unschedule('notify-edital-updates-hourly');
  end if;
  perform cron.schedule(
    'notify-edital-updates-hourly',
    '15 * * * *',
    $cron$
    select net.http_post(
      url := 'https://krkbzeqwjrrxvdpwyqar.supabase.co/functions/v1/notify-edital-updates',
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
