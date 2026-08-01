-- Seed de 1 edital demonstrativo, composto do catálogo existente (Área de Controle).
-- Tópicos = folhas (assuntos estudáveis) das matérias selecionadas.
insert into public.editais_catalog (id, slug, orgao, cargo, banca, ano, area_id, position)
values ('e0000000-0000-4000-8000-000000000001', 'tce-go-analista-controle-externo',
        'TCE-GO', 'Analista de Controle Externo', 'FCC', 2026,
        (select id from public.catalog_areas where name = 'Área de Controle'), 0)
on conflict (slug) do nothing;

insert into public.edital_catalog_subjects (edital_catalog_id, subject_catalog_id, weight, num_questions_expected, position)
values
 ('e0000000-0000-4000-8000-000000000001', '35c5776d-556c-4999-b39f-ab43a9c74eed', 2, 15, 0), -- Língua Portuguesa
 ('e0000000-0000-4000-8000-000000000001', '2b802d4d-1600-4cf7-ab29-fc8552e303ea', 1, 10, 1), -- Raciocínio Lógico-Matemático
 ('e0000000-0000-4000-8000-000000000001', '59ca6653-0640-477a-ac2b-427af54f8147', 3, 12, 2), -- Direito Constitucional
 ('e0000000-0000-4000-8000-000000000001', 'c043a1d2-0a58-48d1-b135-493d3f1a6064', 3, 12, 3), -- Direito Administrativo
 ('e0000000-0000-4000-8000-000000000001', 'dc072cfc-b755-42d6-9090-a5557a3a1342', 5, 20, 4), -- Controle Externo
 ('e0000000-0000-4000-8000-000000000001', '4cda6eb8-222b-4d2a-9828-63854b685bb2', 4, 15, 5), -- Auditoria Governamental
 ('e0000000-0000-4000-8000-000000000001', 'ea44d124-6e8d-4ed3-8301-f47a38d201bb', 3, 10, 6), -- Contabilidade Pública
 ('e0000000-0000-4000-8000-000000000001', '91bfa07f-ce80-4c84-934c-e2b331096f97', 3, 10, 7)  -- AFO
on conflict (edital_catalog_id, subject_catalog_id) do nothing;

insert into public.edital_catalog_topics (edital_catalog_id, topic_catalog_id)
select 'e0000000-0000-4000-8000-000000000001', tc.id
from public.topics_catalog tc
where tc.subject_catalog_id in (
    '35c5776d-556c-4999-b39f-ab43a9c74eed','2b802d4d-1600-4cf7-ab29-fc8552e303ea',
    '59ca6653-0640-477a-ac2b-427af54f8147','c043a1d2-0a58-48d1-b135-493d3f1a6064',
    'dc072cfc-b755-42d6-9090-a5557a3a1342','4cda6eb8-222b-4d2a-9828-63854b685bb2',
    'ea44d124-6e8d-4ed3-8301-f47a38d201bb','91bfa07f-ce80-4c84-934c-e2b331096f97')
  and not exists (select 1 from public.topics_catalog c where c.parent_id = tc.id)
on conflict do nothing;
