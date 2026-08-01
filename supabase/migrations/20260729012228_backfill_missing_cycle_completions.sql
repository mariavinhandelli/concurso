-- Refaz os créditos de ciclo perdidos em silêncio. O crédito é decidido no
-- instante do save (studyLogs.service.ts) e amarrado ao subject_id daquele
-- momento: se a matéria não estava no ciclo (ex.: gêmea de catálogo antes do
-- dedupe, ou matéria adicionada ao ciclo depois), o crédito nunca acontece e
-- nada reconcilia depois.
-- client_session_id é preenchido para que editar/apagar a sessão continue
-- propagando para o ciclo (studyLogs.service.ts casa por esse campo).
-- Dupla proteção contra crédito duplo: por client_session_id E por
-- (matéria, dia, minutos), já que completions antigas têm session_id nulo.
with regras as (
  select rr.id as rule_id, rr.user_id, rr.start_date
  from recurrence_rules rr
  where rr.mode = 'ciclo' and rr.is_active
),
candidatos as (
  select
    sl.user_id,
    r.rule_id,
    sl.subject_id,
    (sl.started_at at time zone 'America/Sao_Paulo')::date as completed_date,
    round(sl.duration_sec / 60.0)::int as minutes,
    sl.client_session_id,
    (select ri.id from recurrence_items ri
      where ri.rule_id = r.rule_id and ri.subject_id = sl.subject_id
      order by ri.cycle_order nulls last, ri.position limit 1) as item_id
  from regras r
  join study_logs sl on sl.user_id = r.user_id
  where exists (
      select 1 from recurrence_items ri
      where ri.rule_id = r.rule_id and ri.subject_id = sl.subject_id)
    and (sl.started_at at time zone 'America/Sao_Paulo')::date >= r.start_date
    and round(sl.duration_sec / 60.0) between 1 and 1440
    and not exists (
      select 1 from cycle_completions cc
      where cc.user_id = sl.user_id
        and cc.client_session_id is not null
        and cc.client_session_id = sl.client_session_id)
    and not exists (
      select 1 from cycle_completions cc2
      where cc2.user_id = sl.user_id
        and cc2.subject_id = sl.subject_id
        and cc2.completed_date = (sl.started_at at time zone 'America/Sao_Paulo')::date
        and cc2.minutes = round(sl.duration_sec / 60.0)::int)
)
insert into cycle_completions
  (user_id, rule_id, item_id, subject_id, completed_date, minutes, source, client_session_id)
select user_id, rule_id, item_id, subject_id, completed_date, minutes, 'backfill', client_session_id
from candidatos
on conflict (user_id, client_session_id) do nothing;
