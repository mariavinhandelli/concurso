-- TCE-GO ACE 2026: marcado como edital VIGENTE para servir de teste do hub.
-- Datas/vagas/remuneração são valores de teste — conferir no site do TCE-GO.
update public.editais_catalog
set situacao = 'vigente',
    ultima_edicao = 2026,
    exam_date = '2026-09-20',
    inscricoes_ate = '2026-08-10',
    vagas = 24,
    remuneracao = 14666.00,
    aviso = 'Dados de teste para validação do hub — confirme datas e valores no edital oficial.'
where slug = 'tce-go-analista-controle-externo';

-- ── PM-GO Soldado 2022 (Instituto AOCP) — concurso SEM edital vigente ──
-- Base histórica para a central de preparação. Valores aproximados da edição 2022.

-- Nova disciplina de catálogo: Direitos Humanos (não existia)
insert into public.subjects_catalog (id, name, slug, position, is_active)
values ('c0000000-0000-4000-8000-00000000d401', 'Direitos Humanos', 'direitos-humanos', 25, true)
on conflict (id) do nothing;

insert into public.subject_catalog_areas (subject_catalog_id, area_id)
select 'c0000000-0000-4000-8000-00000000d401', id from public.catalog_areas where name = 'Carreiras Policiais'
on conflict do nothing;

insert into public.topics_catalog (id, subject_catalog_id, name, slug, position) values
  ('c0000000-0000-4000-8000-00000000d411', 'c0000000-0000-4000-8000-00000000d401', 'Teoria geral dos direitos humanos: conceito, evolução e características', 'dh-teoria-geral', 1),
  ('c0000000-0000-4000-8000-00000000d412', 'c0000000-0000-4000-8000-00000000d401', 'Gerações (dimensões) dos direitos humanos', 'dh-geracoes', 2),
  ('c0000000-0000-4000-8000-00000000d413', 'c0000000-0000-4000-8000-00000000d401', 'Declaração Universal dos Direitos Humanos (1948)', 'dh-dudh', 3),
  ('c0000000-0000-4000-8000-00000000d414', 'c0000000-0000-4000-8000-00000000d401', 'Pacto Internacional dos Direitos Civis e Políticos', 'dh-pidcp', 4),
  ('c0000000-0000-4000-8000-00000000d415', 'c0000000-0000-4000-8000-00000000d401', 'Convenção Americana sobre Direitos Humanos (Pacto de San José da Costa Rica)', 'dh-pacto-san-jose', 5),
  ('c0000000-0000-4000-8000-00000000d416', 'c0000000-0000-4000-8000-00000000d401', 'Incorporação dos tratados internacionais de direitos humanos ao direito brasileiro', 'dh-incorporacao-tratados', 6),
  ('c0000000-0000-4000-8000-00000000d417', 'c0000000-0000-4000-8000-00000000d401', 'Direitos humanos na Constituição Federal de 1988', 'dh-cf88', 7),
  ('c0000000-0000-4000-8000-00000000d418', 'c0000000-0000-4000-8000-00000000d401', 'Grupos vulneráveis e políticas afirmativas', 'dh-grupos-vulneraveis', 8),
  ('c0000000-0000-4000-8000-00000000d419', 'c0000000-0000-4000-8000-00000000d401', 'Uso da força e direitos humanos na atividade policial', 'dh-uso-da-forca', 9),
  ('c0000000-0000-4000-8000-00000000d41a', 'c0000000-0000-4000-8000-00000000d401', 'Lei nº 13.060/2014 — instrumentos de menor potencial ofensivo', 'dh-lei-13060', 10)
on conflict (id) do nothing;

-- Edital PM-GO Soldado 2022
insert into public.editais_catalog
  (id, slug, orgao, cargo, banca, ano, area_id, nivel, situacao, ultima_edicao, vagas, remuneracao, aviso, is_active, position)
select
  'e0000000-0000-4000-8000-000000000002',
  'pm-go-soldado',
  'PM-GO', 'Soldado', 'Instituto AOCP', 2022,
  a.id, 'superior',
  'em_expectativa', 2022, 1670, 5293.53,
  'Base histórica da edição 2022 (valores aproximados). Novo edital em expectativa.',
  true, 1
from public.catalog_areas a where a.name = 'Carreiras Policiais'
on conflict (id) do nothing;

-- Disciplinas do edital 2022 (pesos e nº de questões aproximados da prova AOCP)
insert into public.edital_catalog_subjects (edital_catalog_id, subject_catalog_id, weight, num_questions_expected, position)
select 'e0000000-0000-4000-8000-000000000002', sc.id, v.weight, v.nq, v.pos
from (values
  ('Língua Portuguesa',              4, 15, 1),
  ('Raciocínio Lógico-Matemático',   3, 10, 2),
  ('Conhecimentos Regionais',        3, 10, 3),
  ('Informática',                    2,  5, 4),
  ('Direito Constitucional',         3,  5, 5),
  ('Direito Administrativo',         2,  5, 6),
  ('Direito Penal',                  4, 10, 7),
  ('Direito Processual Penal',       3,  5, 8),
  ('Direito Penal Militar',          3,  5, 9),
  ('Legislação Penal Especial',      3,  5, 10),
  ('Direitos Humanos',               2,  5, 11)
) as v(name, weight, nq, pos)
join public.subjects_catalog sc on sc.name = v.name
on conflict do nothing;

-- Tópicos do edital: todo o conteúdo das disciplinas selecionadas
insert into public.edital_catalog_topics (edital_catalog_id, topic_catalog_id)
select 'e0000000-0000-4000-8000-000000000002', tc.id
from public.edital_catalog_subjects ecs
join public.topics_catalog tc on tc.subject_catalog_id = ecs.subject_catalog_id
where ecs.edital_catalog_id = 'e0000000-0000-4000-8000-000000000002'
on conflict do nothing;
