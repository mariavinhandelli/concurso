-- Mesma classe de bug pela 3ª vez no dia (20260803193000 → 20260803220000 →
-- agora): tópico novo num catálogo compartilhado não propaga sozinho para
-- editais NÃO curados ("vincula toda a matéria"). Desta vez os 4 tópicos de
-- Legislação Estadual — Goiás criados em 20260803230000 ficaram de fora de
-- pc-go-delegado e pc-go-papiloscopista (ambos ainda topicos_curados=false).
--
-- Regra geral, sem escopo de matéria ou slug — para não precisar caçar isto
-- uma quarta vez: religa QUALQUER (edital não curado, matéria) cujo catálogo
-- tenha crescido além do vínculo atual.
insert into public.edital_catalog_topics (edital_catalog_id, topic_catalog_id)
select e.id, tc.id
from public.editais_catalog e
join public.edital_catalog_subjects ecs on ecs.edital_catalog_id = e.id and ecs.topicos_curados = false
join public.topics_catalog tc on tc.subject_catalog_id = ecs.subject_catalog_id
where not exists (
  select 1 from public.edital_catalog_topics x
  where x.edital_catalog_id = e.id and x.topic_catalog_id = tc.id
);

do $$
declare v int;
begin
  select count(*) into v
  from public.editais_catalog e
  join public.edital_catalog_subjects ecs on ecs.edital_catalog_id = e.id and ecs.topicos_curados = false
  where (select count(*) from public.topics_catalog tc where tc.subject_catalog_id = ecs.subject_catalog_id)
      <> (select count(*) from public.edital_catalog_topics x
          join public.topics_catalog tc on tc.id = x.topic_catalog_id
          where x.edital_catalog_id = e.id and tc.subject_catalog_id = ecs.subject_catalog_id);
  if v > 0 then raise exception 'ainda há % (edital,matéria) não curados com catálogo ≠ vínculo', v; end if;
end $$;
