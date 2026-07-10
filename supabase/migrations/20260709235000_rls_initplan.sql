-- Perf F3 (RLS initplan) — troca `auth.uid()` cru por `(select auth.uid())` em
-- todas as policies do schema public. Semanticamente IDÊNTICO (o subquery escalar
-- devolve o mesmo valor), mas o Postgres passa a avaliar 1× por query (initPlan)
-- em vez de 1× por linha — ganho grande em tabelas grandes (study_logs etc.).
-- Atômico: se qualquer ALTER falhar, o DO inteiro reverte (sem estado parcial).
do $$
declare r record; sql text;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') like '%auth.uid()%' or coalesce(with_check, '') like '%auth.uid()%')
  loop
    sql := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if r.qual is not null then
      sql := sql || format(' using (%s)', replace(r.qual, 'auth.uid()', '(select auth.uid())'));
    end if;
    if r.with_check is not null then
      sql := sql || format(' with check (%s)', replace(r.with_check, 'auth.uid()', '(select auth.uid())'));
    end if;
    execute sql;
  end loop;
end $$;
