-- Auditoria de performance (02/08) — timeByCategory.service.ts buscava
-- study_logs cru (duration_sec, subject_id, join subjects) sem `.limit()` e
-- somava por disciplina em JS. Na visão "total" o intervalo começa em
-- 2000-01-01 — usuárias antigas puxariam potencialmente dezenas de milhares
-- de linhas. RPC agrupa por disciplina no servidor; o resultado é do tamanho
-- do nº de disciplinas (pequeno), não do nº de sessões.
create or replace function public.get_time_by_category(p_start timestamptz, p_end timestamptz)
returns table (subject_id uuid, subject_name text, subject_color text, seconds int)
language sql
stable
security invoker
set search_path = public
as $$
  select
    l.subject_id,
    s.name as subject_name,
    s.color as subject_color,
    sum(coalesce(l.duration_sec, 0))::int as seconds
  from public.study_logs l
  left join public.subjects s on s.id = l.subject_id
  where l.user_id = auth.uid()
    and l.started_at >= p_start
    and l.started_at <= p_end
  group by l.subject_id, s.name, s.color;
$$;

revoke all on function public.get_time_by_category(timestamptz, timestamptz) from public, anon;
grant execute on function public.get_time_by_category(timestamptz, timestamptz) to authenticated;
