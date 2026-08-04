-- Corrige a própria migration anterior (20260803230000): os 4 tópicos novos
-- de Legislação Estadual — Goiás foram CRIADOS no catálogo mas nunca
-- vinculados a edital_catalog_topics para pc-go-agente/pc-go-escrivao — a
-- chamada curar_topicos_multi(..., array[]::text[]) só remove exclusões e
-- marca topicos_curados; não insere o que falta. Mesma classe de erro da
-- regressão de 20260803220000, desta vez dentro da mesma migration.
insert into public.edital_catalog_topics (edital_catalog_id, topic_catalog_id)
select e.id, tc.id
from public.editais_catalog e
join public.edital_catalog_subjects ecs on ecs.edital_catalog_id = e.id
join public.topics_catalog tc on tc.subject_catalog_id = ecs.subject_catalog_id
where e.slug in ('pc-go-agente', 'pc-go-escrivao')
  and ecs.subject_catalog_id = (select id from public.subjects_catalog where name = 'Legislação Estadual — Goiás')
  and not exists (
    select 1 from public.edital_catalog_topics x
    where x.edital_catalog_id = e.id and x.topic_catalog_id = tc.id
  );

do $$
declare v int;
begin
  select count(*) into v
  from public.edital_catalog_topics t
  join public.editais_catalog e on e.id = t.edital_catalog_id and e.slug in ('pc-go-agente', 'pc-go-escrivao')
  join public.topics_catalog tc on tc.id = t.topic_catalog_id
  join public.subjects_catalog s on s.id = tc.subject_catalog_id and s.name = 'Legislação Estadual — Goiás';
  if v <> 14 then raise exception 'Legislação Estadual: esperado 7 tópicos × 2 editais = 14, achei %', v; end if;
end $$;
