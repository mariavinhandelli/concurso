-- Prova social do banco de editais: "N pessoas estudando" por edital,
-- calculado de quem ATIVOU o edital e registrou estudo nos últimos 30 dias.
-- Só a contagem sai (security definer lê target_exams/study_logs de todos,
-- mas nada identificável cruza a fronteira da função).
--
-- A régua de exibição (esconder contagens pequenas) fica no cliente: com a
-- base atual, "1 pessoa estudando" é anti-marketing — o banco entrega o
-- número cru e a UI decide o limiar.

create or replace function public.edital_studying_counts()
returns table (edital_catalog_id uuid, estudando integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.catalog_edital_id,
    count(distinct t.user_id)::int as estudando
  from target_exams t
  where t.catalog_edital_id is not null
    and t.archived_at is null
    and exists (
      select 1
      from study_logs sl
      where sl.user_id = t.user_id
        and sl.started_at >= now() - interval '30 days'
    )
  group by t.catalog_edital_id
$$;

-- Banco de editais é público (SEO) — a contagem também.
grant execute on function public.edital_studying_counts() to anon, authenticated;
