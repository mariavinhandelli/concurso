-- PM-GO Oficial (Cadete/CFO) 2022 — dados extraídos e verificados (2x, PDFs
-- independentes) do Edital de Abertura nº 003/2022 (Instituto AOCP), DIFERENTE
-- do Edital 002/2022 (Soldado) usado anteriormente. Escopo desta entrada:
-- cargo Cadete (Tabela 8.1, bacharel em Direito). NÃO inclui as vagas de
-- 2º Tenente QOS (Médico/Odontólogo/Psicólogo — Tabela 8.2, matérias técnicas
-- de saúde fora do escopo do catálogo desta plataforma).

insert into public.editais_catalog
  (id, slug, orgao, cargo, banca, ano, area_id, nivel, situacao, ultima_edicao, vagas, remuneracao,
   exam_date, inscricoes_ate, edital_url, aviso, is_active, position)
select
  'e0000000-0000-4000-8000-000000000003',
  'pm-go-oficial',
  'PM-GO', 'Oficial (Cadete/CFO)', 'Instituto AOCP', 2022,
  a.id, 'superior',
  'em_expectativa', 2022, 100, 8433.73,
  '2022-07-17', '2022-06-06',
  'https://dhg1h5j42swfq.cloudfront.net/2022/04/08090626/edital-abertura-003-2022cadete-tentente-pmgo.pdf',
  'Edital nº 003/2022 (distinto do de Soldado). Vagas e conteúdo aqui referem-se ao cargo de Cadete (bacharel em Direito) — não inclui as 50 vagas de 2º Tenente QOS (Médico/Odontólogo/Psicólogo), fora do escopo de disciplinas do catálogo. Remuneração progressiva: Cadete 1º ano R$ 8.433,73 → 2º ano R$ 9.136,54 → 3º ano R$ 10.542,16 → Aspirante R$ 12.052,99 → 2º Tenente R$ 13.901,60. Novo edital em discussão desde 2025 — ASSOF pediu 180 vagas para Oficial (mar/2025), sem banca, vagas ou data definidas para a próxima edição.',
  true, 2
from public.catalog_areas a where a.name = 'Carreiras Policiais'
on conflict (id) do nothing;

-- Disciplinas — Tabela 8.1 do Edital 003/2022 (prova de 50 questões, Cadete)
insert into public.edital_catalog_subjects (edital_catalog_id, subject_catalog_id, weight, num_questions_expected, position)
select 'e0000000-0000-4000-8000-000000000003', sc.id, v.weight, v.nq, v.pos
from (values
  ('Língua Portuguesa',                 4, 10, 1),
  ('Conhecimentos Regionais',           2,  5, 2),
  ('Direito Penal',                     3,  5, 3),
  ('Direito Constitucional',            3,  6, 4),
  ('Direito Processual Penal',          3,  5, 5),
  ('Direito Administrativo',            3,  6, 6),
  ('Direito Penal Militar',             2,  4, 7),
  ('Direito Processual Penal Militar',  2,  4, 8),
  ('Legislação Penal Especial',         2,  5, 9)
) as v(name, weight, nq, pos)
join public.subjects_catalog sc on sc.name = v.name
on conflict do nothing;

-- Tópicos: o programa de Cadete (Anexo II) é significativamente mais amplo e
-- profundo que o de Soldado (nível bacharel em Direito) — cobre virtualmente
-- toda a extensão das 6 matérias jurídicas centrais. LP e Regionais idênticos
-- ao edital de Soldado (texto verbatim igual no Anexo II).
with leaves as (
  select tc.id, tc.name, sc.name as subject_name, p.name as parent_name
  from public.topics_catalog tc
  join public.subjects_catalog sc on sc.id = tc.subject_catalog_id
  left join public.topics_catalog p on p.id = tc.parent_id
  where not exists (select 1 from public.topics_catalog c where c.parent_id = tc.id)
)
insert into public.edital_catalog_topics (edital_catalog_id, topic_catalog_id)
select 'e0000000-0000-4000-8000-000000000003', id from leaves
where subject_name in ('Língua Portuguesa', 'Conhecimentos Regionais', 'Direito Penal',
                       'Direito Constitucional', 'Direito Processual Penal',
                       'Direito Penal Militar', 'Direito Processual Penal Militar',
                       'Legislação Penal Especial')
   or (subject_name = 'Direito Administrativo'
       and coalesce(parent_name, name) not in ('Bens Públicos', 'Lei de Acesso à Informação e Transparência'))
on conflict do nothing;

-- Linha do tempo: cronograma real da edição 2022 (Cadete) + os mesmos 4 marcos
-- de 2024-2026 sobre o próximo edital — a solicitação da ASSOF (mar/2025) é
-- especificamente sobre vagas de Oficial, pertence aqui tanto quanto no Soldado.
insert into public.edital_updates (edital_catalog_id, tipo, titulo, url, published_at) values
  ('e0000000-0000-4000-8000-000000000003', 'noticia',   'Edital de Abertura nº 003/2022 publicado — 100 vagas Cadete + 50 vagas 2º Tenente QOS', 'https://goias.gov.br/administracao/edital-003-2022-concurso-pm-go-cadete-e-2o-tenente/', '2022-04-08'),
  ('e0000000-0000-4000-8000-000000000003', 'noticia',   'Inscrições abertas de 04/05 a 06/06/2022 (taxa de R$ 130) no site do Instituto AOCP', 'https://goias.gov.br/administracao/edital-003-2022-concurso-pm-go-cadete-e-2o-tenente/', '2022-05-04'),
  ('e0000000-0000-4000-8000-000000000003', 'noticia',   'Aplicação da prova objetiva e discursiva (Cadete)', 'https://goias.gov.br/administracao/edital-003-2022-concurso-pm-go-cadete-e-2o-tenente/', '2022-07-17'),
  ('e0000000-0000-4000-8000-000000000003', 'resultado', 'Resultado da prova objetiva pós-recursos e gabarito definitivo', 'https://goias.gov.br/administracao/edital-003-2022-concurso-pm-go-cadete-e-2o-tenente/', '2022-08-19'),
  ('e0000000-0000-4000-8000-000000000003', 'resultado', 'Resultado da prova discursiva pós-recurso', 'https://goias.gov.br/administracao/edital-003-2022-concurso-pm-go-cadete-e-2o-tenente/', '2022-09-13'),
  ('e0000000-0000-4000-8000-000000000003', 'resultado', 'Homologação do resultado final e classificação', 'https://goias.gov.br/administracao/edital-003-2022-concurso-pm-go-cadete-e-2o-tenente/', '2023-03-13'),
  ('e0000000-0000-4000-8000-000000000003', 'noticia',   'Coronel Durvalino Câmara indica planejamento em fase inicial para novo concurso', 'https://www.estrategiaconcursos.com.br/blog/concurso-pm-go/', '2024-02-01'),
  ('e0000000-0000-4000-8000-000000000003', 'noticia',   'ASSOF solicita, em caráter de urgência, 180 vagas para Oficial em novo edital', 'https://blog.grancursosonline.com.br/concurso-pm-go-solicitacao-180-vagas/', '2025-03-20'),
  ('e0000000-0000-4000-8000-000000000003', 'noticia',   'Comandante-geral confirma discussões para novo certame ("a PM tem que estar presente nos 246 municípios")', 'https://www.direcaoconcursos.com.br/noticias/concurso-pmgo-novo-edital-previsao-2026', '2025-10-10'),
  ('e0000000-0000-4000-8000-000000000003', 'noticia',   'Governo anuncia reajuste salarial de 25,6% para a corporação', 'https://www.direcaoconcursos.com.br/noticias/concurso-pm-go-reajuste-anunciado', '2026-01-19')
on conflict do nothing;
