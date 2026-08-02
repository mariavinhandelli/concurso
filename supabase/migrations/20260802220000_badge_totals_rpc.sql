-- Auditoria de performance (02/08) — badges.service.ts paginava study_logs
-- INTEIRO no cliente (while true + .range de 1000 em 1000) só para somar
-- volume/tempo/maestria e o ritmo dos últimos 30 dias. Com histórico grande
-- (2-3 anos) isso vira dezenas de round-trips sequenciais na tela de
-- Conquistas. RPC agrega tudo numa passagem só no servidor, mesmo padrão de
-- get_study_day_totals (p_tz = fuso do navegador, security invoker).
--
-- Faixas de maestria (q >= 10, cortes 70/80/90%) replicam
-- MIN_QUESTOES_SESSAO_MAESTRIA e MAESTRIA_TIERS de services/badges.service.ts
-- — se aqueles mudarem, atualizar aqui também.
create or replace function public.get_badge_totals(p_tz text)
returns table (
  total_questions int,
  total_correct int,
  total_sec int,
  questoes_bronze int,
  questoes_prata int,
  questoes_ouro int,
  q30 int,
  sec30 int,
  active_days_30 int
)
language sql
stable
security invoker
set search_path = public
as $$
  with logs as (
    select
      coalesce(l.questions_total, 0) as q,
      coalesce(l.questions_correct, 0) as c,
      coalesce(l.duration_sec, 0) as sec,
      l.started_at,
      (l.started_at at time zone p_tz)::date as local_day
    from public.study_logs l
    where l.user_id = auth.uid()
  )
  select
    coalesce(sum(q), 0)::int as total_questions,
    coalesce(sum(c), 0)::int as total_correct,
    coalesce(sum(sec), 0)::int as total_sec,
    coalesce(sum(q) filter (where q >= 10 and c * 100.0 / q >= 70), 0)::int as questoes_bronze,
    coalesce(sum(q) filter (where q >= 10 and c * 100.0 / q >= 80), 0)::int as questoes_prata,
    coalesce(sum(q) filter (where q >= 10 and c * 100.0 / q >= 90), 0)::int as questoes_ouro,
    coalesce(sum(q) filter (where started_at >= now() - interval '30 days'), 0)::int as q30,
    coalesce(sum(sec) filter (where started_at >= now() - interval '30 days'), 0)::int as sec30,
    count(distinct local_day) filter (where started_at >= now() - interval '30 days')::int as active_days_30
  from logs;
$$;

revoke all on function public.get_badge_totals(text) from public, anon;
grant execute on function public.get_badge_totals(text) to authenticated;
