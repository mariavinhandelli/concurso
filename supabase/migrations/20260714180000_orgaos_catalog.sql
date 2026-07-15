-- Hub de Editais — organização por ÓRGÃO
-- O catálogo ganha a entidade orgaos_catalog (PM-GO, PC-GO, TJ-GO, TCE-GO…):
-- órgão → cargos (editais_catalog) → especificações (subjects/topics/updates).
-- Seeds com DADO REAL verificado em 14/07/2026 (Gran Cursos, Estratégia,
-- FGV Conhecimento, TJGO). Onde a fonte não dava data/valor exato, o fato foi
-- para `aviso` (sem data) ou ficou de fora — nunca inventado.

-- 1) Órgãos
create table if not exists public.orgaos_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  sigla text not null,
  nome text not null,
  uf text,
  esfera text,     -- estadual | federal | municipal
  poder text,      -- executivo | judiciario | legislativo | controle
  site_url text,
  descricao text,
  position int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.orgaos_catalog enable row level security;
drop policy if exists "read orgaos_catalog" on public.orgaos_catalog;
create policy "read orgaos_catalog" on public.orgaos_catalog
  for select to authenticated using (true);

-- 2) FK no catálogo de editais (aditivo; `orgao` texto continua para exibição)
alter table public.editais_catalog
  add column if not exists orgao_id uuid references public.orgaos_catalog(id);

-- 3) Seed de órgãos
insert into public.orgaos_catalog (slug, sigla, nome, uf, esfera, poder, site_url, descricao, position)
select v.* from (values
  ('pm-go', 'PM-GO', 'Polícia Militar do Estado de Goiás', 'GO', 'estadual', 'executivo',
   'https://www.pm.go.gov.br',
   'Policiamento ostensivo e preservação da ordem pública em Goiás. Último concurso em 2022 (Instituto AOCP, 1.670 vagas); novo edital em discussão para 2026.', 1),
  ('pc-go', 'PC-GO', 'Polícia Civil do Estado de Goiás', 'GO', 'estadual', 'executivo',
   'https://www.policiacivil.go.gov.br',
   'Polícia judiciária do Estado de Goiás. Último concurso em 2022 (Instituto AOCP, 864 vagas); segundo o delegado-geral, novos trâmites apenas em 2027/2028.', 2),
  ('tj-go', 'TJ-GO', 'Tribunal de Justiça do Estado de Goiás', 'GO', 'estadual', 'judiciario',
   'https://www.tjgo.jus.br',
   'Justiça estadual de Goiás. 59º concurso para Juiz Substituto em andamento (FGV, 51 vagas); concurso de servidores (Analista Judiciário) autorizado em jun/2025.', 3),
  ('tce-go', 'TCE-GO', 'Tribunal de Contas do Estado de Goiás', 'GO', 'estadual', 'controle',
   'https://portal.tce.go.gov.br',
   'Controle externo da administração pública goiana. FCC contratada em jun/2026 para o edital de Técnico de Controle Externo (16 vagas de nível médio).', 4)
) as v(slug, sigla, nome, uf, esfera, poder, site_url, descricao, position)
where not exists (select 1 from public.orgaos_catalog o where o.slug = v.slug);

-- 4) Vincula os editais existentes aos órgãos
update public.editais_catalog e
set orgao_id = o.id
from public.orgaos_catalog o
where e.orgao_id is null
  and ((e.orgao = 'PM-GO' and o.slug = 'pm-go')
    or (e.orgao = 'TCE-GO' and o.slug = 'tce-go'));

-- 5) Enriquecimento dos editais existentes (dado real, sem sobrescrever curadoria)
-- PM-GO: remunerações atuais (jun/2025, fonte Gran Cursos) e situação do próximo edital
update public.editais_catalog set
  remuneracao = coalesce(remuneracao, 7812.63),
  aviso = coalesce(aviso, 'Novo edital em discussão para 2026 — dados de vagas referem-se à última edição (2022, Instituto AOCP). Remuneração atual de Soldado 2ª Classe (jun/2025).')
where slug = 'pm-go-soldado';
update public.editais_catalog set
  remuneracao = coalesce(remuneracao, 10371.21),
  aviso = coalesce(aviso, 'ASSOF solicitou 180 vagas para Oficial (mar/2025); novo edital em discussão para 2026. Vagas exibidas são da última edição (2022). Remuneração atual de Cadete 1º ano (jun/2025).')
where slug = 'pm-go-oficial';

-- TCE-GO: FCC contratada (Contrato 14/2026, 09/06/2026) — 16 vagas nível médio
update public.editais_catalog set
  vagas = coalesce(vagas, 16),
  nivel = coalesce(nivel, 'médio'),
  aviso = coalesce(aviso, 'FCC contratada em 09/06/2026 (Contrato nº 14/2026): 16 vagas imediatas de nível médio, sem cadastro de reserva — Técnico Administrativo (6) e Tecnologia da Informação (10). Edital esperado ainda em 2026.')
where slug = 'tce-go-tecnico-controle-externo';

-- 6) Novos editais — PC-GO (4 cargos) e TJ-GO (2 carreiras)
-- PC-GO: sem edital vigente; ficha reflete a última edição (2022, Instituto AOCP).
insert into public.editais_catalog
  (slug, orgao, cargo, banca, ano, uf, nivel, concurso_key, situacao, ultima_edicao,
   vagas, remuneracao, aviso, area_id, orgao_id, is_active, position)
select v.slug, 'PC-GO', v.cargo, 'Instituto AOCP', null, 'GO', 'superior', v.slug, 'em_expectativa', 2022,
       v.vagas, v.remuneracao, v.aviso,
       (select id from public.catalog_areas where slug = 'policiais'),
       (select id from public.orgaos_catalog where slug = 'pc-go'),
       true, v.position
from (values
  ('pc-go-agente', 'Agente de Polícia', 450, 6353.13,
   'Sem edital vigente — segundo o delegado-geral (jul/2026), novos trâmites apenas em 2027/2028. Vagas e remuneração da última edição (2022, Instituto AOCP); 430 agentes nomeados em 2024.', 3),
  ('pc-go-escrivao', 'Escrivão de Polícia', 310, 6353.13,
   'Sem edital vigente — segundo o delegado-geral (jul/2026), novos trâmites apenas em 2027/2028. Vagas e remuneração da última edição (2022, Instituto AOCP); 273 escrivães nomeados em 2024.', 4),
  ('pc-go-papiloscopista', 'Papiloscopista', 60, 6353.13,
   'Sem edital vigente — segundo o delegado-geral (jul/2026), novos trâmites apenas em 2027/2028. Vagas e remuneração da última edição (2022, Instituto AOCP); 56 papiloscopistas nomeados em 2024.', 5),
  ('pc-go-delegado', 'Delegado de Polícia', 44, 23811.22,
   'Exige bacharelado em Direito. Sem edital vigente — novos trâmites apenas em 2027/2028 (delegado-geral, jul/2026). Vagas e remuneração da última edição (2022, Instituto AOCP); 40 delegados nomeados em 2024.', 6)
) as v(slug, cargo, vagas, remuneracao, aviso, position)
where not exists (select 1 from public.editais_catalog e where e.slug = v.slug);

-- TJ-GO Juiz Substituto: 59º concurso, EM ANDAMENTO (Edital 01/2025, FGV)
insert into public.editais_catalog
  (slug, orgao, cargo, banca, ano, uf, nivel, concurso_key, situacao,
   vagas, remuneracao, exam_date, inscricoes_ate, edital_url, aviso, area_id, orgao_id, is_active, position)
select 'tj-go-juiz-substituto', 'TJ-GO', 'Juiz Substituto', 'FGV', 2025, 'GO', 'superior',
       'tj-go-juiz-substituto', 'vigente',
       51, 34083.41, '2026-03-29', '2026-01-29',
       'https://conhecimento.fgv.br/sites/default/files/concursos/59_juiz_edital_abertura_consolidado_13-01-2026.pdf',
       '59º concurso da magistratura goiana, em andamento: prova objetiva realizada em 29/03/2026; provas escritas (discursiva e sentenças) em 31/05 e 01/06/2026. Exige bacharelado em Direito e 3 anos de atividade jurídica.',
       (select id from public.catalog_areas where slug = 'juridicas'),
       (select id from public.orgaos_catalog where slug = 'tj-go'),
       true, 7
where not exists (select 1 from public.editais_catalog e where e.slug = 'tj-go-juiz-substituto');

-- TJ-GO Analista Judiciário: autorizado (18/06/2025), banca e vagas a definir
insert into public.editais_catalog
  (slug, orgao, cargo, banca, ano, uf, nivel, concurso_key, situacao,
   vagas, remuneracao, aviso, area_id, orgao_id, is_active, position)
select 'tj-go-analista-judiciario', 'TJ-GO', 'Analista Judiciário', null, null, 'GO', 'superior',
       'tj-go-analista-judiciario', 'em_expectativa',
       null, null,
       'Autorizado pela presidência em 18/06/2025 — banca e vagas a definir (78 cargos vagos no Portal da Transparência). Carreiras previstas: Área Judiciária (inicial R$ 5.683,78), Área Especializada e Apoio Judiciário e Administrativo (inicial R$ 5.115,40).',
       (select id from public.catalog_areas where slug = 'juridicas'),
       (select id from public.orgaos_catalog where slug = 'tj-go'),
       true, 8
where not exists (select 1 from public.editais_catalog e where e.slug = 'tj-go-analista-judiciario');

-- 7) Linha do tempo — só fatos com data verificada
insert into public.edital_updates (edital_catalog_id, tipo, titulo, url, published_at)
select e.id, v.tipo, v.titulo, v.url, v.published_at::date
from (values
  ('tj-go-juiz-substituto', 'noticia', 'Edital 01/2025 publicado: 51 vagas para Juiz Substituto (FGV)',
   'https://conhecimento.fgv.br/concursos/tjgo2025', '2025-12-15'),
  ('tj-go-juiz-substituto', 'retificacao', '1ª Retificação do edital de abertura (texto consolidado)',
   'https://conhecimento.fgv.br/sites/default/files/concursos/59_juiz_edital_abertura_consolidado_13-01-2026.pdf', '2026-01-12'),
  ('tj-go-juiz-substituto', 'noticia', 'Prova objetiva seletiva realizada em Goiânia',
   'https://conhecimento.fgv.br/concursos/tjgo2025', '2026-03-29'),
  ('tj-go-juiz-substituto', 'noticia', 'Provas escritas (discursiva e sentenças cível/criminal) realizadas',
   'https://conhecimento.fgv.br/concursos/tjgo2025', '2026-06-01'),
  ('tj-go-analista-judiciario', 'noticia', 'Presidência autoriza tratativas para o novo edital de Analista Judiciário',
   'https://blog.grancursosonline.com.br/concurso-tj-go/', '2025-06-18'),
  ('pm-go-oficial', 'noticia', 'ASSOF solicita novo edital com 180 vagas para Oficial',
   'https://blog.grancursosonline.com.br/concurso-pm-go/', '2025-03-20'),
  ('tce-go-tecnico-controle-externo', 'noticia', 'FCC contratada como banca (Contrato nº 14/2026) — 16 vagas de nível médio',
   'https://blog.grancursosonline.com.br/concurso-tce-go/', '2026-06-09')
) as v(slug, tipo, titulo, url, published_at)
join public.editais_catalog e on e.slug = v.slug
where not exists (
  select 1 from public.edital_updates u
  where u.edital_catalog_id = e.id and u.titulo = v.titulo
);

-- 8) Histórico do concurso (edital_concurso_stats) — vagas/nomeados reais
insert into public.edital_concurso_stats (concurso_key, ano, vagas, nomeados, fonte_url)
select v.* from (values
  ('pc-go-agente', 2022, 450, 430, 'https://www.estrategiaconcursos.com.br/blog/concurso-pc-go/'),
  ('pc-go-escrivao', 2022, 310, 273, 'https://www.estrategiaconcursos.com.br/blog/concurso-pc-go/'),
  ('pc-go-papiloscopista', 2022, 60, 56, 'https://www.estrategiaconcursos.com.br/blog/concurso-pc-go/'),
  ('pc-go-delegado', 2022, 44, 40, 'https://www.estrategiaconcursos.com.br/blog/concurso-pc-go/'),
  ('pm-go-soldado', 2022, 1520, null, 'https://blog.grancursosonline.com.br/concurso-pm-go/'),
  ('pm-go-oficial', 2022, 100, null, 'https://blog.grancursosonline.com.br/concurso-pm-go/'),
  ('tj-go-juiz-substituto', 2025, 51, null, 'https://conhecimento.fgv.br/concursos/tjgo2025')
) as v(concurso_key, ano, vagas, nomeados, fonte_url)
on conflict (concurso_key, ano) do nothing;
