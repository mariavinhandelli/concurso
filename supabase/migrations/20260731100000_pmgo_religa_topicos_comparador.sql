-- Auditoria do "Comparar editais" (31/07): comparar PM-GO Soldado × Oficial
-- mostrava "6 alteradas" — mas 5 delas eram DIFF FABRICADO: as curadorias de
-- 15/07 (20260715140000 e posteriores) adicionaram tópicos novos ao catálogo
-- e religaram PC-GO/TJ-GO, deixando as duas grades da PM-GO para trás
-- (soldado com 111 tópicos faltando, oficial com 59, vs o catálogo atual das
-- mesmas matérias). O comparador então "via" dezenas de tópicos removidos que
-- nunca saíram de edital nenhum.
--
-- O padrão do catálogo sempre foi "grade vincula todos os tópicos da matéria"
-- (mesma regra das migrations de PC-GO, TJ-GO, TCE-GO e INSS) — religar a
-- PM-GO apenas restaura a regra. Única diferença REAL que sobra entre os dois
-- cargos: pesos/questões de Direito Processual Penal Militar e Legislação
-- Penal Especial, que é o que o comparador deve mostrar.
insert into public.edital_catalog_topics (edital_catalog_id, topic_catalog_id, incidencia)
select e.id, tc.id, null
from public.editais_catalog e
join public.edital_catalog_subjects ecs on ecs.edital_catalog_id = e.id
join public.topics_catalog tc on tc.subject_catalog_id = ecs.subject_catalog_id
where e.slug in ('pm-go-soldado', 'pm-go-oficial')
and not exists (
  select 1 from public.edital_catalog_topics x
  where x.edital_catalog_id = e.id and x.topic_catalog_id = tc.id
);
