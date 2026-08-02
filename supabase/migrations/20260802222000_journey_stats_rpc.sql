-- Auditoria de performance (02/08) — journey.service.ts buscava study_logs
-- (duration_sec, topic_id) INTEIRO e sem `.limit()` (2 vezes: all-time e
-- últimos 30 dias) para derivar totais e distintos de tópico em JS. Além do
-- risco de truncar em contas com histórico muito grande, o widget aparece na
-- Home. RPC agrega tudo (soma + count distinct por janela) no servidor numa
-- passagem só. p_tz = fuso do navegador, mesmo padrão de get_study_day_totals.
create or replace function public.get_journey_stats(p_tz text)
returns table (
  total_minutes int,
  sessions_this_month int,
  topics_covered int,
  topics_this_week int,
  topics_28d int
)
language sql
stable
security invoker
set search_path = public
as $$
  with bounds as (
    select
      (date_trunc('month', now() at time zone p_tz) at time zone p_tz) as month_start,
      now() - interval '7 days' as week_start,
      now() - interval '28 days' as month28_start
  )
  select
    round(coalesce(sum(l.duration_sec), 0) / 60.0)::int as total_minutes,
    count(*) filter (where l.started_at >= (select month_start from bounds))::int as sessions_this_month,
    count(distinct l.topic_id) filter (where l.topic_id is not null)::int as topics_covered,
    count(distinct l.topic_id) filter (where l.topic_id is not null and l.started_at >= (select week_start from bounds))::int as topics_this_week,
    count(distinct l.topic_id) filter (where l.topic_id is not null and l.started_at >= (select month28_start from bounds))::int as topics_28d
  from public.study_logs l
  where l.user_id = auth.uid();
$$;

revoke all on function public.get_journey_stats(text) from public, anon;
grant execute on function public.get_journey_stats(text) to authenticated;
