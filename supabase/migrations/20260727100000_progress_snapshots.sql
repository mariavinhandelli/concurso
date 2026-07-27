-- M3 — curva de retenção. Snapshot diário por usuário do estado agregado de
-- saúde/cobertura. É a infraestrutura que o Raio-X declarou faltar ("não há
-- histórico de snapshots do score") — a partir daqui a evolução REAL fica
-- registrada, sem nunca fabricar passado.

create table public.progress_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null,
  saude_media integer,                       -- média de topic_metrics.saude_atual (null = sem métricas)
  topicos_com_metrica integer not null default 0,
  topicos_dominados integer not null default 0,  -- saúde >= 70 (mesma régua do domínio)
  coverage_pct integer,                      -- cobertura do alvo primário (null = sem alvo/tópicos)
  created_at timestamptz not null default now(),
  primary key (user_id, snapshot_date)
);

alter table public.progress_snapshots enable row level security;

-- Leitura: cada um vê só a própria curva. Escrita: NENHUMA policy — só a
-- função SECURITY DEFINER abaixo (via cron) grava.
create policy progress_snapshots_select_own
  on public.progress_snapshots for select
  using (auth.uid() = user_id);

-- Tira o snapshot do dia para TODOS os usuários com métricas ou alvo.
-- Idempotente: rodar duas vezes no mesmo dia apenas atualiza a linha.
create or replace function public.take_progress_snapshots()
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.progress_snapshots
    (user_id, snapshot_date, saude_media, topicos_com_metrica, topicos_dominados, coverage_pct)
  select
    u.user_id,
    current_date,
    m.saude_media,
    coalesce(m.topicos_com_metrica, 0),
    coalesce(m.topicos_dominados, 0),
    c.coverage_pct
  from (
    select user_id from public.topic_metrics
    union
    select user_id from public.target_exams where archived_at is null
  ) u
  left join lateral (
    select
      round(avg(tm.saude_atual))::integer as saude_media,
      count(*)::integer as topicos_com_metrica,
      (count(*) filter (where tm.saude_atual >= 70))::integer as topicos_dominados
    from public.topic_metrics tm
    where tm.user_id = u.user_id
  ) m on true
  left join lateral (
    -- cobertura do alvo primário: tópicos vinculados com >=1 sessão / total
    select round(
      100.0 * count(distinct sl.topic_id) / greatest(count(distinct tte.topic_id), 1)
    )::integer as coverage_pct
    from public.target_exams te
    join public.topic_target_exams tte on tte.target_exam_id = te.id
    left join public.study_logs sl
      on sl.user_id = u.user_id and sl.topic_id = tte.topic_id
    where te.user_id = u.user_id
      and te.archived_at is null
      and te.id = (
        select id from public.target_exams
        where user_id = u.user_id and archived_at is null
        order by is_primary desc nulls last, created_at asc
        limit 1
      )
    having count(distinct tte.topic_id) > 0
  ) c on true
  on conflict (user_id, snapshot_date) do update set
    saude_media = excluded.saude_media,
    topicos_com_metrica = excluded.topicos_com_metrica,
    topicos_dominados = excluded.topicos_dominados,
    coverage_pct = excluded.coverage_pct;
$$;

-- Ninguém chama direto — nem authenticated. Só o cron (superuser/postgres).
revoke execute on function public.take_progress_snapshots() from anon, authenticated;

-- Diário às 06:10 UTC (~03:10 em São Paulo — depois da virada local, antes do dia começar).
select cron.schedule(
  'progress-snapshots-daily',
  '10 6 * * *',
  $$select public.take_progress_snapshots()$$
);

-- Semente: o primeiro ponto da curva existe já hoje.
select public.take_progress_snapshots();
