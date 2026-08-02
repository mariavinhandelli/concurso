-- Auditoria de performance (02/08) — duas queries de study_logs sem `.limit()`
-- que alimentam gráficos de /progresso, ambas com resultado naturalmente
-- pequeno (poucas disciplinas / 5 níveis de energia) mas hoje buscando linhas
-- cruas sem limite. Agregação no servidor.

-- accuracyReports.service.ts: acerto por disciplina, com corte de data opcional
-- (p_since é calculado no cliente — mesma meia-noite local de antes — e só
-- passado pronto pra manter o comportamento idêntico ao atual).
create or replace function public.get_accuracy_by_subject(p_since timestamptz)
returns table (subject_id uuid, subject_name text, subject_color text, total int, correct int)
language sql
stable
security invoker
set search_path = public
as $$
  select
    l.subject_id,
    coalesce(s.name, 'Matéria') as subject_name,
    coalesce(s.color, '#C9B8DD') as subject_color,
    sum(l.questions_total)::int as total,
    sum(coalesce(l.questions_correct, 0))::int as correct
  from public.study_logs l
  left join public.subjects s on s.id = l.subject_id
  where l.user_id = auth.uid()
    and l.mode = 'questoes'
    and l.subject_id is not null
    and l.questions_total > 0
    and (p_since is null or l.started_at >= p_since)
  group by l.subject_id, s.name, s.color;
$$;

revoke all on function public.get_accuracy_by_subject(timestamptz) from public, anon;
grant execute on function public.get_accuracy_by_subject(timestamptz) to authenticated;

-- performance.service.ts (getEnergiaDesempenho): acerto médio por nível de
-- energia (1-5).
create or replace function public.get_energia_desempenho()
returns table (energia int, total int, correct int, sessoes int)
language sql
stable
security invoker
set search_path = public
as $$
  select
    l.energy_level::int as energia,
    sum(coalesce(l.questions_total, 0))::int as total,
    sum(coalesce(l.questions_correct, 0))::int as correct,
    count(*)::int as sessoes
  from public.study_logs l
  where l.user_id = auth.uid()
    and l.energy_level is not null
    and coalesce(l.questions_total, 0) > 0
  group by l.energy_level
  order by l.energy_level;
$$;

revoke all on function public.get_energia_desempenho() from public, anon;
grant execute on function public.get_energia_desempenho() to authenticated;
