-- INSS Técnico: grade provisória derivada do edital 2022 (fonte primária) +
-- PDF oficial no botão + novos órgãos no monitor semanal de fontes.
--
-- A grade segue o padrão da provisória do TCE-GO (20260729130000): pesos 1–5
-- sem num_questions_expected (a divisão exata por disciplina do PRÓXIMO edital
-- ninguém tem), grade_provisoria = true e aviso já explicando a derivação.
-- Fonte do conteúdo: Edital nº 1 – INSS, de 13/06/2022 (Cebraspe), seção
-- "Dos objetos de avaliação" — disciplinas e tópicos de primeiro nível.

-- ── 1. Botão do edital passa a apontar o PDF oficial da última edição ───────
-- cdn.cebraspe.org.br está coberto pela allowlist (*.cebraspe.org.br) e o
-- mirror-edital-pdfs vai guardar cópia própria na próxima execução.
update public.editais_catalog
set edital_url = 'https://cdn.cebraspe.org.br/concursos/inss_22/arquivos/ED_1_INSS_22_ABERTURA.PDF'
where slug = 'inss-tecnico';

-- ── 2. Matérias novas no catálogo ───────────────────────────────────────────
insert into public.subjects_catalog (name, slug)
select v.name, v.slug
from (values
  ('Direito Previdenciário', 'direito-previdenciario'),
  ('Ética no Serviço Público', 'etica-no-servico-publico')
) as v(name, slug)
where not exists (select 1 from public.subjects_catalog s where s.name = v.name);

-- Tópicos de primeiro nível do bloco de Conhecimentos Específicos do edital
-- INSS 2022 (Seguridade Social) — macro, sem subtópicos.
insert into public.topics_catalog (subject_catalog_id, name, position)
select s.id, v.name, v.position
from public.subjects_catalog s
join (values
  ('Seguridade social: origem, conceito e princípios constitucionais', 1),
  ('Organização e custeio da seguridade social', 2),
  ('Regime Geral de Previdência Social: beneficiários e segurados obrigatórios', 3),
  ('Segurado facultativo: conceito, filiação e inscrição', 4),
  ('Trabalhadores excluídos do Regime Geral', 5),
  ('Empresa e empregador doméstico: conceito e obrigações', 6),
  ('Salário-de-contribuição: conceito e parcelas integrantes', 7),
  ('Arrecadação e recolhimento das contribuições', 8),
  ('Carência: períodos e contagem', 9),
  ('Benefícios do RGPS: aposentadorias, auxílios, pensão por morte, salário-família e salário-maternidade', 10),
  ('Cálculo do valor dos benefícios e reajustamento', 11),
  ('Acumulação de benefícios, prescrição e decadência', 12),
  ('Justificação administrativa e recursos das decisões', 13),
  ('Seguro-desemprego do pescador artesanal — seguro-defeso (Lei nº 10.779/2003)', 14),
  ('Benefício assistencial de prestação continuada (BPC — Lei nº 8.742/1993)', 15),
  ('Instrução Normativa PRES/INSS nº 128/2022', 16),
  ('Crimes contra a seguridade social', 17)
) as v(name, position) on true
where s.name = 'Direito Previdenciário'
and not exists (
  select 1 from public.topics_catalog t
  where t.subject_catalog_id = s.id and t.name = v.name
);

-- Ética no Serviço Público — tópicos de primeiro nível do edital 2022.
insert into public.topics_catalog (subject_catalog_id, name, position)
select s.id, v.name, v.position
from public.subjects_catalog s
join (values
  ('Ética e moral; ética e função pública', 1),
  ('Ética no setor público: bases constitucionais (art. 37 da CF)', 2),
  ('Código de Ética do Servidor Público Civil Federal (Decreto nº 1.171/1994)', 3),
  ('Lei de Acesso à Informação (Lei nº 12.527/2011)', 4),
  ('Governança pública e integridade (Decreto nº 9.203/2017)', 5),
  ('O servidor público como agente de desenvolvimento social', 6),
  ('Saúde e qualidade de vida no serviço público', 7)
) as v(name, position) on true
where s.name = 'Ética no Serviço Público'
and not exists (
  select 1 from public.topics_catalog t
  where t.subject_catalog_id = s.id and t.name = v.name
);

-- ── 3. Grade do INSS Técnico ────────────────────────────────────────────────
insert into public.edital_catalog_subjects (edital_catalog_id, subject_catalog_id, weight, num_questions_expected, position)
select e.id, s.id, v.weight, null, v.position
from (values
  -- Conhecimentos Específicos dominam a prova do INSS — peso máximo.
  ('Direito Previdenciário', 5, 1),
  ('Língua Portuguesa', 4, 2),
  ('Raciocínio Lógico-Matemático', 3, 3),
  ('Noções de Informática', 3, 4),
  ('Direito Constitucional', 3, 5),
  ('Direito Administrativo', 3, 6),
  ('Ética no Serviço Público', 2, 7)
) as v(subject_name, weight, position)
join public.subjects_catalog s on s.name = case v.subject_name
  when 'Noções de Informática' then 'Informática'
  else v.subject_name end
cross join (select id from public.editais_catalog where slug = 'inss-tecnico') e
where not exists (
  select 1 from public.edital_catalog_subjects x
  where x.edital_catalog_id = e.id and x.subject_catalog_id = s.id
);

-- Tópicos: todos os da matéria (mesmo padrão das demais grades do catálogo).
insert into public.edital_catalog_topics (edital_catalog_id, topic_catalog_id, incidencia)
select ecs.edital_catalog_id, tc.id, null
from public.edital_catalog_subjects ecs
join public.topics_catalog tc on tc.subject_catalog_id = ecs.subject_catalog_id
join public.editais_catalog e on e.id = ecs.edital_catalog_id
where e.slug = 'inss-tecnico'
and not exists (
  select 1 from public.edital_catalog_topics x
  where x.edital_catalog_id = ecs.edital_catalog_id and x.topic_catalog_id = tc.id
);

update public.editais_catalog
set grade_provisoria = true
where slug = 'inss-tecnico';

-- ── 4. Monitor semanal: fontes dos novos órgãos ─────────────────────────────
-- Mesmo contrato do 20260729140000: detecta e avisa, nunca publica sozinho.
-- BB e Correios ficam de fora por ora (páginas de carreiras são JS-render,
-- mesmo caso do tj-go que só registra falha).
insert into public.edital_source_checks (slug, label, source_url) values
  ('sefaz-go-concursos', 'SEFAZ-GO — Secretaria da Economia', 'https://goias.gov.br/economia'),
  ('alego-portal', 'ALEGO — portal (concurso Assistente/Analista + Procurador anunciado)', 'https://portal.al.go.leg.br'),
  ('cbm-go-concursos', 'CBM-GO — página de concursos', 'https://www.bombeiros.go.gov.br/category/concursos'),
  ('policia-penal-go-site', 'Polícia Penal GO — notícias da DGAP', 'https://www.policiapenal.go.gov.br'),
  ('goiania-site', 'Prefeitura de Goiânia — site (Guarda Civil anunciada)', 'https://www.goiania.go.gov.br'),
  ('inss-gov', 'INSS — gov.br (pedido de 10 mil vagas no MGI)', 'https://www.gov.br/inss'),
  ('prf-gov', 'PRF — gov.br (pedido de 269 vagas no MGI)', 'https://www.gov.br/prf'),
  ('pf-gov', 'PF — gov.br (concurso 2025 em nomeações)', 'https://www.gov.br/pf'),
  ('receita-gov', 'Receita Federal — gov.br (concurso autorizado, edital até 04/01/2027)', 'https://www.gov.br/receitafederal'),
  ('cnu-gov', 'CNU — página oficial no MGI', 'https://www.gov.br/gestao/pt-br/concursonacional')
on conflict (slug) do nothing;
