-- IA invisível · Fase 1 — feature store noturno.
-- user_features: 1 linha por usuário, recalculada de madrugada por pg_cron
-- (job refresh-user-features-nightly, 06:20 UTC ≈ 03:20 BRT). Tudo SQL puro
-- sobre dados que já existem (study_logs + profiles.settings) — sem LLM.
--
-- Consumidores (todos degradam para o comportamento antigo se a linha faltar):
--   · Plano de Hoje  → plan_scale (dia leve), floor_minutes (piso pessoal)
--   · fila /revisar  → srs_adjust (multiplicador de intervalo por matéria)
--   · send-daily-reminders → peak_hour (horário pessoal do lembrete)
--
-- O cliente NUNCA escreve aqui: só leitura da própria linha (RLS); a escrita é
-- exclusiva de refresh_user_features() (security definer, chamada pelo cron).

create table public.user_features (
  user_id uuid primary key references auth.users (id) on delete cascade,
  computed_at timestamptz not null default now(),

  -- sinais de atividade
  days_since_study integer,               -- em dias LOCAIS do usuário; null = nunca estudou
  active_days_14d integer not null default 0,
  sessions_60d integer not null default 0,
  median_session_min integer,
  p25_session_min integer,
  peak_hour integer,                      -- hora local modal de início de estudo; null = amostra < 5

  -- decisões derivadas (heurísticas documentadas na função abaixo)
  churn_score numeric(3,2) not null default 0,     -- 0 (engajada) … 1 (abandonando)
  plan_scale numeric(3,2) not null default 1.00,   -- 1 = plano normal; <1 = dia leve
  floor_minutes integer not null default 30,       -- piso pessoal de bloco (10–30)
  srs_adjust jsonb not null default '{}'::jsonb    -- { subject_id: multiplicador 0.7–1.2 }
);

alter table public.user_features enable row level security;

create policy "user_features_select_own" on public.user_features
  for select using ((select auth.uid()) = user_id);

-- Recalcula as features de TODOS os usuários. Heurísticas:
--   churn_score  base por dias sem estudar (0d=.10, 1d=.30, 2d=.45, 3d=.60, 4+=.80;
--                nunca estudou=.50), -.15 se estudou ≥7 dos últimos 14 dias,
--                +.10 se estudou ≤2 deles. Clamp 0–1.
--   plan_scale   ≥.60 → .50 · ≥.35 → .75 · senão 1. Nunca encolhe para quem
--                nunca estudou (não há base para "dia leve" no onboarding).
--   floor_minutes P25 da duração das sessões ≥5min dos últimos 60d, clamp 10–30;
--                precisa de ≥5 sessões, senão mantém o piso legado de 30.
--   srs_adjust   por matéria com ≥20 questões nos últimos 60d: acerto ≥85% → 1.2,
--                ≥70% → 1.0, ≥55% → 0.85, <55% → 0.7. (Sinal independente do
--                ease factor do SM-2 — vem de questões de sessão, não de revisões.)
create or replace function public.refresh_user_features()
returns void
language sql
security definer
set search_path = public
as $fn$
with base as (
  select p.id as user_id,
         coalesce(p.settings->>'reminderTz', 'America/Sao_Paulo') as tz
  from profiles p
),
last_study as (
  select l.user_id, max(l.started_at) as last_at
  from study_logs l
  group by l.user_id
),
recent as (
  select l.user_id, l.started_at, l.duration_sec, l.subject_id,
         l.questions_total, l.questions_correct, b.tz
  from study_logs l
  join base b on b.user_id = l.user_id
  where l.started_at > now() - interval '60 days'
),
sess as (
  select user_id,
         count(*) as n,
         percentile_cont(0.5)  within group (order by duration_sec / 60.0) as med_min,
         percentile_cont(0.25) within group (order by duration_sec / 60.0) as p25_min
  from recent
  where duration_sec is not null and duration_sec >= 300
  group by user_id
),
hours as (
  select user_id,
         count(*) as n,
         mode() within group (order by extract(hour from started_at at time zone tz)::int) as peak_hour
  from recent
  group by user_id
),
act as (
  select user_id,
         count(distinct (started_at at time zone tz)::date) as active_days_14d
  from recent
  where started_at > now() - interval '14 days'
  group by user_id
),
acc as (
  select user_id, subject_id,
         sum(questions_correct)::numeric / nullif(sum(questions_total), 0) as taxa,
         sum(questions_total) as total
  from recent
  where subject_id is not null and questions_total > 0
  group by user_id, subject_id
),
srs as (
  select user_id,
         jsonb_object_agg(subject_id::text,
           case when taxa >= 0.85 then 1.2
                when taxa >= 0.70 then 1.0
                when taxa >= 0.55 then 0.85
                else 0.7 end) as srs_adjust
  from acc
  where total >= 20
  group by user_id
),
feat as (
  select b.user_id,
         case when ls.last_at is null then null
              else ((now() at time zone b.tz)::date - (ls.last_at at time zone b.tz)::date) end as days_since_study,
         coalesce(a.active_days_14d, 0) as active_days_14d,
         coalesce(h.n, 0) as sessions_60d,
         round(s.med_min)::int as median_session_min,
         round(s.p25_min)::int as p25_session_min,
         case when h.n >= 5 then h.peak_hour end as peak_hour,
         case when s.n >= 5 then least(30, greatest(10, round(s.p25_min)::int)) else 30 end as floor_minutes,
         coalesce(srs.srs_adjust, '{}'::jsonb) as srs_adjust
  from base b
  left join last_study ls on ls.user_id = b.user_id
  left join sess s on s.user_id = b.user_id
  left join hours h on h.user_id = b.user_id
  left join act a on a.user_id = b.user_id
  left join srs on srs.user_id = b.user_id
),
scored as (
  select f.*,
         least(1.0, greatest(0.0,
           case when f.days_since_study is null then 0.50
                when f.days_since_study <= 0 then 0.10
                when f.days_since_study = 1 then 0.30
                when f.days_since_study = 2 then 0.45
                when f.days_since_study = 3 then 0.60
                else 0.80 end
           - case when f.active_days_14d >= 7 then 0.15 else 0 end
           + case when f.active_days_14d <= 2 and f.days_since_study is not null then 0.10 else 0 end
         )) as churn_score
  from feat f
)
insert into user_features as uf
  (user_id, computed_at, days_since_study, active_days_14d, sessions_60d,
   median_session_min, p25_session_min, peak_hour,
   churn_score, plan_scale, floor_minutes, srs_adjust)
select user_id, now(), days_since_study, active_days_14d, sessions_60d,
       median_session_min, p25_session_min, peak_hour,
       churn_score,
       case when days_since_study is null then 1.00
            when churn_score >= 0.60 then 0.50
            when churn_score >= 0.35 then 0.75
            else 1.00 end,
       floor_minutes,
       srs_adjust
from scored
on conflict (user_id) do update set
  computed_at        = excluded.computed_at,
  days_since_study   = excluded.days_since_study,
  active_days_14d    = excluded.active_days_14d,
  sessions_60d       = excluded.sessions_60d,
  median_session_min = excluded.median_session_min,
  p25_session_min    = excluded.p25_session_min,
  peak_hour          = excluded.peak_hour,
  churn_score        = excluded.churn_score,
  plan_scale         = excluded.plan_scale,
  floor_minutes      = excluded.floor_minutes,
  srs_adjust         = excluded.srs_adjust;
$fn$;

-- Reescreve features de todo mundo — não pode ser invocável pelo cliente.
revoke execute on function public.refresh_user_features() from public, anon, authenticated;

-- Agendamento noturno (06:20 UTC ≈ 03:20 America/Sao_Paulo), idempotente.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'refresh-user-features-nightly') then
    perform cron.unschedule('refresh-user-features-nightly');
  end if;
  perform cron.schedule(
    'refresh-user-features-nightly',
    '20 6 * * *',
    'select public.refresh_user_features();'
  );
end $$;

-- Primeira carga imediata para a tabela já nascer populada.
select public.refresh_user_features();
