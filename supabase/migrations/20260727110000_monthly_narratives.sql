-- M6 — narrativa do mês. A IA REDIGE; ela não calcula: os números
-- determinísticos entram no prompt e ficam gravados em `stats` ao lado do
-- texto, auditáveis. Conteúdo é privado (números da própria usuária), então
-- vive em tabela own-only — nunca em ai_artifacts (legível por todos).

create table public.monthly_narratives (
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null,               -- 'YYYY-MM' — mês COMPLETO a que a leitura se refere
  frases jsonb not null,             -- array de 2-4 frases em segunda pessoa
  stats jsonb not null,              -- números que fundamentaram o texto (auditoria)
  model text,
  created_at timestamptz not null default now(),
  primary key (user_id, month)
);

alter table public.monthly_narratives enable row level security;

-- Leitura própria; NENHUMA policy de escrita — só a Edge Function (service role).
create policy monthly_narratives_select_own
  on public.monthly_narratives for select
  using (auth.uid() = user_id);

-- Dia 1 de cada mês, 07:30 UTC (~04:30 SP) — depois dos snapshots do dia.
select cron.schedule(
  'monthly-narrative-monthly',
  '30 7 1 * *',
  $$
    select net.http_post(
      url := 'https://krkbzeqwjrrxvdpwyqar.supabase.co/functions/v1/monthly-narrative',
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
