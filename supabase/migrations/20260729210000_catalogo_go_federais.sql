-- Expansão do catálogo: GO profundo + federais populares (decisão de produto
-- 29/07 — "algo parecido com o banco do Estudei em opções e escolha").
-- Cada ficha entra HONESTA: banca e ano da última edição real, situação
-- verdadeira (só SEFAZ-GO e ALEGO têm edital vigente), aviso descrevendo a
-- fase atual, e edital_url apenas quando existe fonte oficial estável.
-- Grade entra "em preparação" — a ativação parcial já funciona (o usuário
-- monta a própria grade ou importa o PDF) e a curadoria prioriza pela fila
-- de pedidos (edital_requests) + contagem de estudantes.
-- Fatos verificados em 29/07/2026 (fontes: órgãos, bancas e imprensa
-- especializada; números não confirmados oficialmente estão sinalizados
-- como estimativa no próprio aviso).

-- ── 1. Allowlist v2: estatais e bancas que faltavam ─────────────────────────
-- BB e Correios são empresas públicas — a página de carreiras delas é fonte
-- primária dos próprios concursos. Cesgranrio (banca histórica do BB) e
-- Instituto Verbena/UFG (banca recorrente em Goiânia) entram como bancas.
create or replace function public.is_official_edital_domain(url text)
returns boolean
language sql
immutable
as $$
  select url is null
    or url ~* '^https://([a-z0-9-]+\.)*(gov\.br|jus\.br|leg\.br|tc\.br|fgv\.br|fcc\.org\.br|institutoaocp\.org\.br|aocp\.com\.br|cebraspe\.org\.br|vunesp\.com\.br|fundatec\.org\.br|ibfc\.org\.br|iades\.com\.br|fepese\.org\.br|fumarc\.com\.br|idecan\.org\.br|quadrix\.org\.br|ibade\.org\.br|cesgranrio\.org\.br|bb\.com\.br|correios\.com\.br|ufg\.br)(/.*)?$'
$$;

-- ── 2. Órgãos novos ─────────────────────────────────────────────────────────
insert into public.orgaos_catalog (slug, sigla, nome, uf, esfera, poder, site_url, position)
values
  ('sefaz-go', 'SEFAZ-GO', 'Secretaria de Estado da Economia de Goiás', 'GO', 'estadual', 'executivo', 'https://goias.gov.br/economia', 5),
  ('alego', 'ALEGO', 'Assembleia Legislativa do Estado de Goiás', 'GO', 'estadual', 'legislativo', 'https://portal.al.go.leg.br', 6),
  ('cbm-go', 'CBM-GO', 'Corpo de Bombeiros Militar do Estado de Goiás', 'GO', 'estadual', 'executivo', 'https://www.bombeiros.go.gov.br', 7),
  ('policia-penal-go', 'PPGO', 'Polícia Penal do Estado de Goiás (DGAP)', 'GO', 'estadual', 'executivo', 'https://www.policiapenal.go.gov.br', 8),
  ('prefeitura-goiania', 'Pref. Goiânia', 'Prefeitura Municipal de Goiânia', 'GO', 'municipal', 'executivo', 'https://www.goiania.go.gov.br', 9),
  ('inss', 'INSS', 'Instituto Nacional do Seguro Social', null, 'federal', 'executivo', 'https://www.gov.br/inss', 10),
  ('prf', 'PRF', 'Polícia Rodoviária Federal', null, 'federal', 'executivo', 'https://www.gov.br/prf', 11),
  ('pf', 'PF', 'Polícia Federal', null, 'federal', 'executivo', 'https://www.gov.br/pf', 12),
  ('receita-federal', 'RFB', 'Receita Federal do Brasil', null, 'federal', 'executivo', 'https://www.gov.br/receitafederal', 13),
  ('bb', 'BB', 'Banco do Brasil', null, 'federal', 'executivo', 'https://www.bb.com.br', 14),
  ('correios', 'Correios', 'Empresa Brasileira de Correios e Telégrafos', null, 'federal', 'executivo', 'https://www.correios.com.br', 15),
  ('mgi', 'CNU/MGI', 'Concurso Nacional Unificado (Min. da Gestão e da Inovação)', null, 'federal', 'executivo', 'https://www.gov.br/gestao', 16)
on conflict (slug) do nothing;

-- ── 3. Editais (fichas honestas; grade em curadoria) ────────────────────────
insert into public.editais_catalog
  (slug, orgao, cargo, banca, ano, uf, nivel, concurso_key, orgao_id, area_id,
   situacao, ultima_edicao, vagas, remuneracao, edital_url, aviso, is_active, position, verificado_em)
select
  v.slug, v.orgao, v.cargo, v.banca, v.ano, v.uf, v.nivel, v.slug,
  o.id, a.id, v.situacao, v.ultima_edicao, v.vagas, v.remuneracao, v.edital_url, v.aviso,
  true, v.position, '2026-07-29'
from (
  values
  -- ── Goiás ──
  ('sefaz-go-auditor', 'SEFAZ-GO', 'Auditor Fiscal da Receita Estadual', 'FCC', 2026, 'GO', 'superior',
   'sefaz-go', 'Área Fiscal', 'vigente', null::int, 75, 32163.30,
   'https://goias.gov.br/economia',
   'Edital 2026 em andamento: prova objetiva aplicada em 17/05/2026 e resultado definitivo da objetiva publicado em 26/06/2026. 75 vagas (50 imediatas + 25 CR). Quem mira este cargo agora estuda para um PRÓXIMO ciclo — sem previsão de novo edital.', 20),
  ('alego-assistente-legislativo', 'ALEGO', 'Assistente Legislativo', 'FGV', 2025, 'GO', 'médio',
   'alego', 'Área Administrativa', 'vigente', null, null, null,
   'https://portal.al.go.leg.br/documentos/edital-concurso-2025.pdf',
   'Concurso 2025 (101 vagas somando Assistente, Analista e Policial Legislativo) com provas aplicadas em 08/02/2026 — em fase de resultados. Novo certame anunciado pela presidência é só para Procurador.', 21),
  ('alego-procurador', 'ALEGO', 'Procurador', null, null, 'GO', 'superior',
   'alego', 'Carreiras Jurídicas', 'em_expectativa', null, null, null,
   'https://portal.al.go.leg.br',
   'Presidência da ALEGO confirmou (jul/2026) novo concurso exclusivo para Procurador, com edital previsto ainda em 2026. Vagas, banca e cronograma sem definição — comissão organizadora em formação.', 22),
  ('cbm-go-soldado', 'CBM-GO', 'Soldado Combatente', 'Instituto AOCP', null, 'GO', 'superior',
   'cbm-go', 'Carreiras Policiais', 'em_expectativa', 2022, null, null,
   'https://goias.gov.br/administracao/edital-004-2022-concurso-cbm-go-soldado-combatente-cadete/',
   'Última edição 2022 (Edital 004/2022, 500 vagas de Soldado Combatente + 40 de Soldado Músico, AOCP), com validade prorrogada. Novo edital sem previsão oficial.', 23),
  ('cbm-go-cadete', 'CBM-GO', 'Cadete (CFO)', 'Instituto AOCP', null, 'GO', 'superior',
   'cbm-go', 'Carreiras Policiais', 'em_expectativa', 2022, null, null,
   'https://goias.gov.br/administracao/edital-004-2022-concurso-cbm-go-soldado-combatente-cadete/',
   'Última edição 2022 (60 vagas de Cadete + 12 de 2º Tenente, AOCP), com validade prorrogada. Novo edital sem previsão oficial.', 24),
  ('policia-penal-go-policial', 'Polícia Penal GO', 'Policial Penal', 'IBFC', null, 'GO', 'superior',
   'policia-penal-go', 'Carreiras Policiais', 'em_expectativa', 2024, null, null,
   'https://www.policiapenal.go.gov.br',
   'Concurso 2024 (1.600 vagas, IBFC) em fase de convocações — mais 400 aprovados chamados em 2026. Novo edital sem previsão oficial; acompanhe o site da Polícia Penal.', 25),
  ('goiania-guarda-civil', 'Pref. Goiânia', 'Guarda Civil Metropolitano', null, null, 'GO', 'médio',
   'prefeitura-goiania', 'Carreiras Policiais', 'em_expectativa', null, null, null,
   'https://www.goiania.go.gov.br',
   'Comissão do concurso formada; prefeitura sinaliza cerca de 700 vagas para a Guarda Civil Metropolitana. Banca e edital sem definição. Banca recorrente do município: Instituto Verbena/UFG.', 26),
  -- ── Federais ──
  ('inss-tecnico', 'INSS', 'Técnico do Seguro Social', 'Cebraspe', null, null, 'médio',
   'inss', 'Área Administrativa', 'em_expectativa', 2022, null, null,
   'https://www.cebraspe.org.br/concursos/inss_22',
   'Pedido de 10 mil vagas (8.501 de Técnico, nível médio) em análise no Ministério da Gestão — sem autorização até 29/07/2026. Última edição: 2022, 1.000 vagas (Cebraspe).', 30),
  ('prf-policial', 'PRF', 'Policial Rodoviário Federal', 'Cebraspe', null, null, 'superior',
   'prf', 'Carreiras Policiais', 'em_expectativa', 2021, null, null,
   'https://www.cebraspe.org.br/concursos/prf_21',
   'Pedido de 269 vagas em análise no Ministério da Gestão; expectativa de edital no 2º semestre de 2026 (validade do concurso anterior expira em dezembro). Última edição: 2021, 1.500 vagas (Cebraspe).', 31),
  ('pf-agente', 'PF', 'Agente de Polícia Federal', 'Cebraspe', null, null, 'superior',
   'pf', 'Carreiras Policiais', 'em_expectativa', 2025, null, null,
   null,
   'Concurso 2025 (1.000 vagas, Cebraspe) em fase de formação e nomeações ao longo de 2026. Novo edital sem previsão oficial.', 32),
  ('pf-escrivao', 'PF', 'Escrivão de Polícia Federal', 'Cebraspe', null, null, 'superior',
   'pf', 'Carreiras Policiais', 'em_expectativa', 2025, null, null,
   null,
   'Concurso 2025 (Cebraspe) em fase de formação e nomeações ao longo de 2026. Novo edital sem previsão oficial.', 33),
  ('receita-auditor', 'Receita Federal', 'Auditor-Fiscal da Receita Federal', null, null, null, 'superior',
   'receita-federal', 'Área Fiscal', 'em_expectativa', 2022, 30, null,
   'https://www.gov.br/receitafederal',
   'Novo concurso AUTORIZADO em jul/2026: 30 vagas de Auditor-Fiscal, com edital obrigatório até 04/01/2027 — banca em contratação. Última edição: 2022/2023 (FGV).', 34),
  ('receita-analista', 'Receita Federal', 'Analista-Tributário da Receita Federal', null, null, null, 'superior',
   'receita-federal', 'Área Fiscal', 'em_expectativa', 2022, 116, null,
   'https://www.gov.br/receitafederal',
   'Novo concurso AUTORIZADO em jul/2026: 116 vagas de Analista-Tributário, com edital obrigatório até 04/01/2027 — banca em contratação. Última edição: 2022/2023 (FGV).', 35),
  ('bb-escriturario', 'Banco do Brasil', 'Escriturário — Agente Comercial', 'Cesgranrio', null, null, 'médio',
   'bb', 'Área Administrativa', 'em_expectativa', 2023, null, null,
   null,
   'Expectativa de novo edital em 2026 — estimativas de mercado citam 7 mil+ vagas, SEM confirmação oficial do banco. Última edição: 2023 (Cesgranrio). Remuneração inicial na última edição: R$ 6.286,78 + benefícios, jornada de 6h.', 36),
  ('correios-atendente', 'Correios', 'Atendente Comercial / Carteiro', 'IBFC', null, null, 'médio',
   'correios', 'Área Administrativa', 'em_expectativa', 2024, null, null,
   null,
   'Concurso 2024 (IBFC) homologado em abr/2025, com convocações adiadas para 2027 pela reestruturação da estatal. Novo edital de Atendente Comercial foi anunciado, mas segue sem data.', 37),
  ('cnu-3-edicao', 'CNU', 'Concurso Nacional Unificado — 3ª edição (diversos cargos)', null, null, null, 'superior',
   'mgi', 'Conhecimentos Gerais', 'em_expectativa', 2025, null, null,
   'https://www.gov.br/gestao/pt-br/concursonacional',
   'MGI descartou edição em 2026 (ano eleitoral); 3ª edição em discussão para 2027, dentro do Orçamento de 2028. A 2ª edição (2025, FGV) está em fase de resultados e convocações. Blocos e cargos da 3ª edição ainda não existem — esta ficha serve para acompanhar.', 38)
) as v(slug, orgao, cargo, banca, ano, uf, nivel, orgao_slug, area_name, situacao, ultima_edicao, vagas, remuneracao, edital_url, aviso, position)
join public.orgaos_catalog o on o.slug = v.orgao_slug
join public.catalog_areas a on a.name = v.area_name
where not exists (select 1 from public.editais_catalog ec where ec.slug = v.slug);
