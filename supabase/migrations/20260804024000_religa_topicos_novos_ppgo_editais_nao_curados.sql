-- Os 7 tópicos novos criados na curadoria da PP-GO (1 em Informática — SEI;
-- 2 em Direito Administrativo — LGPD/SUSP; 4 em Ética no Serviço Público —
-- decreto estadual + 3 capítulos) ficaram defasados nos 2 outros editais
-- NÃO curados que compartilham essas matérias: inss-tecnico e
-- tce-go-tecnico-controle-externo. Mesmo padrão desta sessão (PM-GO,
-- PC-GO): tópico novo nunca propaga sozinho.
insert into public.edital_catalog_topics (edital_catalog_id, topic_catalog_id)
select e.id, tc.id
from public.editais_catalog e
join public.edital_catalog_subjects ecs on ecs.edital_catalog_id = e.id and not ecs.topicos_curados
join public.subjects_catalog s on s.id = ecs.subject_catalog_id
  and s.name in ('Informática', 'Direito Administrativo', 'Ética no Serviço Público')
join public.topics_catalog tc on tc.subject_catalog_id = s.id
where e.slug in ('inss-tecnico', 'tce-go-tecnico-controle-externo')
and not exists (
  select 1 from public.edital_catalog_topics x
  where x.edital_catalog_id = e.id and x.topic_catalog_id = tc.id
);

-- Backfill do único alvo ativo afetado (tce-go-tecnico-controle-externo).
insert into public.topic_target_exams (target_exam_id, topic_id)
select te.id, t.id
from public.target_exams te
join public.editais_catalog e on e.id = te.catalog_edital_id and e.slug = 'tce-go-tecnico-controle-externo'
join public.topics t on t.user_id = te.user_id
join public.topics_catalog tc on tc.id = t.catalog_id
join public.subjects_catalog s on s.id = tc.subject_catalog_id
  and s.name in ('Informática', 'Direito Administrativo', 'Ética no Serviço Público')
where te.archived_at is null
  and not exists (select 1 from public.topics_catalog c where c.parent_id = tc.id) -- só folha
  and exists (
    select 1 from public.edital_catalog_topics ect
    where ect.edital_catalog_id = e.id and ect.topic_catalog_id = tc.id
  )
  and not exists (
    select 1 from public.topic_target_exams x where x.target_exam_id = te.id and x.topic_id = t.id
  );

do $$
declare v int;
begin
  select count(*) into v from (
    select e.slug, s.name
    from edital_catalog_subjects ecs
    join subjects_catalog s on s.id = ecs.subject_catalog_id
    join editais_catalog e on e.id = ecs.edital_catalog_id
    left join edital_catalog_topics ect on ect.edital_catalog_id = e.id and ect.topic_catalog_id in (select id from topics_catalog where subject_catalog_id = s.id)
    where not ecs.topicos_curados and e.slug in ('inss-tecnico', 'tce-go-tecnico-controle-externo')
    group by e.slug, s.name, s.id
    having (select count(*) from topics_catalog tc where tc.subject_catalog_id = s.id) <> count(distinct ect.topic_catalog_id)
  ) gaps;
  if v <> 0 then raise exception 'ainda há gap de propagação: %', v; end if;
end $$;
