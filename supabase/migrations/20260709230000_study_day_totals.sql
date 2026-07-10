-- Perf F4 — agrega study_logs por dia LOCAL no servidor. streak (que paginava ~3
-- anos de logs crus) e goals passam a derivar de poucos day-rows, mantendo a
-- lógica (perdão, limiar 30min, acerto) no cliente. Devolve SEGUNDOS crus (não
-- minutos arredondados) para o resultado ser idêntico ao de hoje. p_tz = fuso do
-- navegador → casa com o agrupamento por data local que o cliente já faz.
create or replace function public.get_study_day_totals(p_tz text, p_days int default 1100)
returns table (day date, seconds int, questions int, correct int)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (l.started_at at time zone p_tz)::date as day,
    sum(coalesce(l.duration_sec, 0))::int as seconds,
    sum(coalesce(l.questions_total, 0))::int as questions,
    sum(coalesce(l.questions_correct, 0))::int as correct
  from public.study_logs l
  where l.user_id = auth.uid()
    and l.started_at >= now() - make_interval(days => p_days)
  group by 1;
$$;

revoke all on function public.get_study_day_totals(text, int) from public, anon;
grant execute on function public.get_study_day_totals(text, int) to authenticated;
